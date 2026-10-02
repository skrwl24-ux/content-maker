import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const candidateKey=(req.nextUrl.searchParams.get("candidateKey") || "").trim();
    const name=(req.nextUrl.searchParams.get("name") || "").trim();
    if(!/^[a-f0-9]{32}$/.test(candidateKey) || name.length>45 || /[%_\\]/.test(name)) {
      return NextResponse.json({error:"조회 조건이 올바르지 않습니다."},{status:400});
    }
    const db=createApartmentReadClient();
    const {data:c,error:ce}=await db
      .from("apt_unmatched_source_candidates")
      .select("candidate_key,region_code,legal_dong,jibun,source_apartment_name,build_year,classification,is_active")
      .eq("candidate_key",candidateKey).eq("is_active",true).maybeSingle();
    if(ce)throw ce;
    if(!c)return NextResponse.json({error:"현재 유효한 검토 후보가 아닙니다."},{status:404});
    let request=db.from("apt_complexes")
      .select("id,kapt_code,name,address,road_address,households,use_date,region_code,legal_dong")
      .eq("region_code",c.region_code).eq("legal_dong",c.legal_dong)
      .order("name",{ascending:true}).limit(30);
    if(name)request=request.ilike("name","%"+name+"%");
    const {data:options,error:oe}=await request;
    if(oe)throw oe;
    return NextResponse.json({candidate:c,targets:options||[],warning:
      "후보 목록은 동일 지역·법정동만 필터링합니다. 단지명만 유사한 것으로 동일 단지를 확정할 수 없습니다."},
      {headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"연결 대상 단지 조회 실패"},
      {status:500});
  }
}
