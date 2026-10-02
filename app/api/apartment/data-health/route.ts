import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createApartmentAdminClient, refetchKaptComplexBasics } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function auth(req: NextRequest) {
  const provided = Buffer.from(req.headers.get("x-apartment-review-secret") || "", "utf8");
  const secrets = [process.env.APARTMENT_REVIEW_SECRET, process.env.APARTMENT_SYNC_SECRET]
    .filter((s): s is string => Boolean(s));
  if (!secrets.length) return "setup";
  return secrets.some(secret => {
    const expected = Buffer.from(secret, "utf8");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }) ? "ok" : "deny";
}
function guard(req: NextRequest) {
  const access = auth(req);
  return access === "ok" ? null : NextResponse.json({
    error: access === "setup" ? "관리자 검토/동기화 비밀키를 먼저 설정해 주세요." : "관리자 검토 키가 올바르지 않습니다."
  }, { status: access === "setup" ? 503 : 401, headers: noStore });
}
function validateRegion(value: string) {
  if (!/^\d{5}$/.test(value)) throw new Error("지역코드 5자리를 선택해 주세요.");
}
function validName(value: string) {
  if (value.length > 40 || /[%_\\]/.test(value))
    throw new Error("검색어는 40자 이하의 일반 단지명으로 입력해 주세요.");
}
function countResult(result: {count:number|null;error: {message:string}|null}) {
  if (result.error) throw new Error(result.error.message);
  return result.count || 0;
}
export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  try {
    const regionCode = (req.nextUrl.searchParams.get("regionCode") || "41410").trim();
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    validateRegion(regionCode); validName(q);
    const db = createApartmentAdminClient();
    if (!db) return NextResponse.json({error:"관리자 DB 연결이 설정되지 않았습니다."},
      {status:503,headers:noStore});
    const base = () => db.from("apt_complexes").select("id",{count:"exact",head:true}).eq("region_code",regionCode);
    const since = new Date(Date.now() - 182*86400000).toISOString().slice(0,10);
    let missingList = db.from("apt_complexes")
      .select("id,kapt_code,name,legal_dong,address,road_address,households,use_date,updated_at")
      .eq("region_code",regionCode)
      .or("households.is.null,use_date.is.null,address.is.null")
      .order("name",{ascending:true}).limit(30);
    if(q) missingList=missingList.ilike("name","%"+q+"%");
    const [
      regions, total, missingHomes, missingDates, missingAddresses,
      unlinkedRecent, pendingGroups, runs, rows
    ] = await Promise.all([
      db.from("apt_tracked_regions").select("region_code,sido_name,region_name,last_synced_at")
        .eq("enabled",true).order("region_code"),
      base(),
      base().is("households",null),
      base().is("use_date",null),
      base().is("address",null),
      db.from("apt_trades").select("source_trade_key",{count:"exact",head:true})
        .eq("region_code",regionCode).is("complex_id",null)
        .eq("cancelled",false).gte("contract_date",since),
      db.from("apt_unmatched_source_candidates").select("candidate_key",{count:"exact",head:true})
        .eq("region_code",regionCode).eq("is_active",true),
      db.from("apt_sync_runs").select("started_at,finished_at,status,region_code,complex_count,trade_count,matched_trade_count,kapt_detail_missing_count,kapt_detail_error_count,kapt_address_missing_count,error_message")
        .eq("region_code",regionCode).order("started_at",{ascending:false}).limit(5),
      missingList,
    ]);
    for(const result of [regions,runs,rows]) if(result.error) throw result.error;
    const summary = {
      complexes:countResult(total),
      householdsMissing:countResult(missingHomes),
      useDateMissing:countResult(missingDates),
      addressMissing:countResult(missingAddresses),
      unlinkedRecentTrades:countResult(unlinkedRecent),
      unmatchedSourceGroups:countResult(pendingGroups),
      recentWindowStart:since,
    };
    return NextResponse.json({
      regionCode,regions:regions.data || [],summary,
      runs:runs.data || [],missingComplexes:rows.data || [],
      missingListLimited:true,checkedAt:new Date().toISOString()
    },{headers:noStore});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"현황 조회에 실패했습니다."},
      {status:400,headers:noStore});
  }
}
export async function POST(req: NextRequest) {
  const denied=guard(req);
  if(denied)return denied;
  try{
    const body=await req.json().catch(()=>({}));
    const id=String(body.complexId||"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return NextResponse.json({error:"단지 ID가 올바르지 않습니다."},{status:400,headers:noStore});
    const result=await refetchKaptComplexBasics(id);
    return NextResponse.json(result,{headers:noStore});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"K-apt 재수집에 실패했습니다."},
      {status:500,headers:noStore});
  }
}
