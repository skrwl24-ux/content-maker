import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

const REASONS = new Set([
  "kapt_lot_not_found",
  "multiple_kapt_same_lot",
  "year_check_failed",
  "unique_lot_unresolved",
]);

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams;
    const regionCode = (query.get("regionCode") || "").trim();
    const reason = (query.get("reason") || "").trim();
    const name = (query.get("name") || "").trim();
    const pageRaw = Number(query.get("page") || "0");
    if (regionCode && !/^\d{5}$/.test(regionCode)) {
      return NextResponse.json({ error: "지역코드가 올바르지 않습니다." }, { status: 400 });
    }
    if (reason && !REASONS.has(reason)) {
      return NextResponse.json({ error: "후보 분류가 올바르지 않습니다." }, { status: 400 });
    }
    if (name.length > 40 || /[%_\\]/.test(name)) {
      return NextResponse.json({ error: "검색어는 40자 이하의 단지명으로 입력해 주세요." }, { status: 400 });
    }
    if (!Number.isSafeInteger(pageRaw) || pageRaw < 0 || pageRaw > 200) {
      return NextResponse.json({ error: "페이지 번호가 올바르지 않습니다." }, { status: 400 });
    }

    const pageSize = 30;
    const supabase = createApartmentReadClient();
    let request = supabase
      .from("apt_unmatched_source_candidates")
      .select(
        "candidate_key,region_code,legal_dong,jibun,source_apartment_name,build_year," +
        "classification,same_lot_kapt_count,year_compatible_kapt_count," +
        "raw_trade_count,recent_valid_trade_count,cancelled_trade_count," +
        "latest_contract_date,area_groups,analysis_date,review_status",
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("recent_valid_trade_count", { ascending: false })
      .order("raw_trade_count", { ascending: false })
      .order("source_apartment_name", { ascending: true })
      .range(pageRaw * pageSize, (pageRaw + 1) * pageSize - 1);

    if (regionCode) request = request.eq("region_code", regionCode);
    if (reason) request = request.eq("classification", reason);
    if (name) request = request.ilike("source_apartment_name", "%" + name + "%");

    const { data, count, error } = await request;
    if (error) throw error;

    return NextResponse.json(
      { candidates: data || [], total: count || 0, page: pageRaw, pageSize },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "미연결 거래 후보 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
