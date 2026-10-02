import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createApartmentAdminClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type EvidenceSource = { url:string; fact:string };
type Audit = {
  verdict:"match"|"hold";
  candidateKey:string;
  regionCode:string;
  legalDong:string;
  jibun:string;
  sourceApartmentName:string;
  buildYear:number|null;
  targetComplexId:string;
  targetComplexName:string;
  sources:EvidenceSource[];
  explanation:string;
};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(req:NextRequest):"ok"|"unconfigured"|"unauthorized" {
  const expected=process.env.APARTMENT_REVIEW_SECRET || process.env.APARTMENT_SYNC_SECRET;
  if(!expected)return "unconfigured";
  const received=req.headers.get("x-apartment-review-secret")||"";
  const a=Buffer.from(expected,"utf8"),b=Buffer.from(received,"utf8");
  return a.length===b.length && timingSafeEqual(a,b) ? "ok":"unauthorized";
}

function officialSource(raw:unknown):raw is EvidenceSource {
  if(!raw||typeof raw!=="object")return false;
  const value=raw as Record<string,unknown>;
  if(typeof value.url!=="string"||value.url.length>1500 ||
     typeof value.fact!=="string"||value.fact.trim().length<8||value.fact.length>600)return false;
  try {
    const url=new URL(value.url);
    if(url.protocol!=="https:"||url.username||url.password||url.port)return false;
    const host=url.hostname.toLowerCase();
    const allowed=host.endsWith(".go.kr") || host==="go.kr" ||
      host==="gov.kr"||host.endsWith(".gov.kr") ||
      host==="k-apt.go.kr"||host.endsWith(".k-apt.go.kr");
    return allowed && (url.pathname!=="/" || !!url.search);
  }catch{return false;}
}

function parseReport(value:unknown):Audit {
  if(typeof value!=="string"||!value.trim()||value.length>16000)
    throw new Error("검증 JSON 원문을 붙여넣어 주세요(최대 16,000자).");
  const markers=value.match(/\[APT_IDENTITY_AUDIT_JSON\]([\s\S]*?)\[\/APT_IDENTITY_AUDIT_JSON\]/);
  const body=markers?markers[1].trim():value.trim();
  let parsed:Record<string,unknown>;
  try {parsed=JSON.parse(body);}catch{throw new Error("검증 JSON 형식이 올바르지 않습니다. 표식 안의 JSON 또는 JSON 객체만 넣어 주세요.");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
    throw new Error("JSON 객체 하나만 입력해 주세요.");
  if(parsed.verdict!=="match")throw new Error("보류/불일치 결과는 승인 대기 상태로 저장할 수 없습니다.");
  const keys=["candidateKey","regionCode","legalDong","jibun","sourceApartmentName",
    "targetComplexId","targetComplexName","explanation"];
  for(const k of keys)if(typeof parsed[k]!=="string"||!(parsed[k] as string).trim())
    throw new Error("검증 보고서 필수 항목이 누락됐습니다: "+k);
  if(parsed.buildYear!==null &&
      (!Number.isInteger(parsed.buildYear)||Number(parsed.buildYear)<1900||Number(parsed.buildYear)>2100))
    throw new Error("건축연도는 숫자 또는 null이어야 합니다.");
  if(typeof parsed.explanation!=="string"||parsed.explanation.trim().length<30||
    parsed.explanation.length>3000)throw new Error("근거 설명은 30~3,000자로 작성해 주세요.");
  if(!Array.isArray(parsed.sources)||parsed.sources.length<2||parsed.sources.length>6||
    !parsed.sources.every(officialSource))throw new Error("서로 다른 공식 기관의 해당 단지 근거 URL 2~6개와 확인한 사실을 기재해 주세요.");
  const hosts=(parsed.sources as EvidenceSource[]).map(s=>new URL(s.url).hostname);
  if(new Set(hosts).size<2)throw new Error("서로 다른 공식 출처 호스트가 최소 2개 필요합니다.");
  if(!/^[a-f0-9]{32}$/.test(parsed.candidateKey as string) ||
    !uuid.test(parsed.targetComplexId as string) ||
    String(parsed.regionCode).length!==5)
    throw new Error("검토 후보 키나 대상 단지 ID가 올바르지 않습니다.");
  return parsed as Audit;
}

function failure(error:unknown) {
  const message=error instanceof Error?error.message:String(error);
  return NextResponse.json({error:message.slice(0,400)},
    {status:409,headers:{"Cache-Control":"no-store"}});
}

export async function POST(req:NextRequest) {
  const state=authorized(req);
  if(state!=="ok")return NextResponse.json({
    error:state==="unconfigured"?
      "관리자 검토 키 설정이 필요합니다(APARTMENT_REVIEW_SECRET 또는 APARTMENT_SYNC_SECRET).":
      "관리자 검토 키가 올바르지 않습니다."
  },{status:state==="unconfigured"?503:401,headers:{"Cache-Control":"no-store"}});
  const origin=req.headers.get("origin");
  if(origin && origin!==req.nextUrl.origin)return NextResponse.json(
    {error:"허용되지 않은 요청 출처입니다."},{status:403});
  if(Number(req.headers.get("content-length")||0)>22000)return NextResponse.json(
    {error:"검증 보고서가 너무 큽니다."},{status:413});
  const db=createApartmentAdminClient();
  if(!db)return NextResponse.json({error:"서버 DB 관리자 키가 설정되지 않았습니다."},{status:503});
  try {
    const body=await req.json() as Record<string,unknown>;
    const candidateKey=String(body.candidateKey||"");
    const targetComplexId=String(body.targetComplexId||"");
    const expectedCount=Number(body.expectedRawCount);
    if(!/^[a-f0-9]{32}$/.test(candidateKey)||!uuid.test(targetComplexId)||
      !Number.isSafeInteger(expectedCount)||expectedCount<1)
      return NextResponse.json({error:"검토 키·대상·거래 건수가 올바르지 않습니다."},{status:400});
    if(body.action==="stage") {
      const audit=parseReport(body.auditText);
      if(audit.candidateKey!==candidateKey||audit.targetComplexId.toLowerCase()!==targetComplexId.toLowerCase())
        throw new Error("선택한 후보·대상 단지와 검증 보고서가 다릅니다.");
      const {data:c,error:ce}=await db.from("apt_unmatched_source_candidates")
        .select("candidate_key,region_code,legal_dong,jibun,source_apartment_name,build_year,raw_trade_count,is_active")
        .eq("candidate_key",candidateKey).single();
      if(ce)throw ce;
      const {data:t,error:te}=await db.from("apt_complexes")
        .select("id,name,region_code,legal_dong")
        .eq("id",targetComplexId).single();
      if(te)throw te;
      if(!c.is_active || c.region_code!==audit.regionCode || c.legal_dong!==audit.legalDong||
        c.jibun!==audit.jibun||c.source_apartment_name!==audit.sourceApartmentName||
        c.build_year!==audit.buildYear || c.raw_trade_count!==expectedCount||
        t.name!==audit.targetComplexName||t.region_code!==c.region_code||t.legal_dong!==c.legal_dong)
        throw new Error("검증 JSON과 최신 원자료 또는 K-apt 단지 정보가 일치하지 않습니다.");
      const {data,error}=await db.rpc("stage_apartment_identity_review",{
        p_candidate_key:candidateKey,p_target_complex_id:targetComplexId,
        p_evidence:audit,p_expected_raw_count:expectedCount
      });
      if(error)throw error;
      return NextResponse.json({result:data},{headers:{"Cache-Control":"no-store"}});
    }
    if(body.action==="approve") {
      if(body.explicitApproval!==true||typeof body.confirmedSourceName!=="string")
        return NextResponse.json({error:"검증한 국토부 원문 단지명을 직접 입력하고 승인에 동의해 주세요."},{status:400});
      const {data:c,error:ce}=await db.from("apt_unmatched_source_candidates")
        .select("source_apartment_name").eq("candidate_key",candidateKey).single();
      if(ce)throw ce;
      if(body.confirmedSourceName.trim()!==c.source_apartment_name)
        return NextResponse.json({error:"직접 입력한 단지명이 국토부 원문과 다릅니다."},{status:400});
      const {data,error}=await db.rpc("approve_apartment_identity_review",{
        p_candidate_key:candidateKey,p_target_complex_id:targetComplexId,
        p_expected_raw_count:expectedCount
      });
      if(error)throw error;
      return NextResponse.json({result:data},{headers:{"Cache-Control":"no-store"}});
    }
    return NextResponse.json({error:"지원하지 않는 검토 작업입니다."},{status:400});
  }catch(error){return failure(error);}
}
