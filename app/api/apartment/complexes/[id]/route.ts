import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";
import { reconcileMonthlyWithTrades } from "@/lib/apartment-numeric-audit.mjs";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createApartmentReadClient();

    const { data: complex, error: complexError } = await supabase
      .from("apt_complexes")
      .select("id,name,sido,sigungu,legal_dong,address,road_address,households,use_date,region_code")
      .eq("id", id)
      .single();
    if (complexError) throw complexError;

    const { data: snapshot, error: snapshotError } = await supabase
      .from("apt_candidate_snapshots")
      .select("*")
      .eq("complex_id", id)
      .order("analysis_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotError) throw snapshotError;

    const areaGroup = snapshot?.representative_area_group ?? null;
    const monthlyQuery = supabase
      .from("apt_monthly_stats")
      .select("year_month,trade_count,median_price,min_price,max_price")
      .eq("complex_id", id)
      .order("year_month", { ascending: false })
      .limit(12);

    const { data: monthly, error: monthlyError } = areaGroup == null
      ? { data: [], error: null }
      : await monthlyQuery.eq("area_group", areaGroup);
    if (monthlyError) throw monthlyError;

    // A "latest deal" must use the same representative area group as the
    // monthly graph; an unrelated larger/smaller layout is not comparable.
    let latestQuery = supabase
      .from("apt_trades")
      .select("contract_date,price_won,exclusive_area,area_group,floor")
      .eq("complex_id", id)
      .eq("cancelled", false)
      .order("contract_date", { ascending: false })
      .limit(1);
    if (areaGroup != null) latestQuery = latestQuery.eq("area_group", areaGroup);
    const { data: latestTrade, error: tradeError } = await latestQuery.maybeSingle();
    if (tradeError) throw tradeError;

    const normalizedMonthly = (monthly || []).reverse().map((row) => ({
      month: row.year_month,
      tradeCount: Number(row.trade_count),
      medianPrice: row.median_price == null ? null : Number(row.median_price),
      minPrice: row.min_price == null ? null : Number(row.min_price),
      maxPrice: row.max_price == null ? null : Number(row.max_price),
    }));
    // Reconcile the saved six-month medians against individual contracts in
    // our own database. This is NOT a live external MOLIT API verification.
    let sourceAudit = {status:"unavailable",comparedMonths:0,rawTradeCount:0,
      mismatches:[] as string[],reason:"조회할 대표 면적의 월별 자료가 없습니다."};
    const recentSix = normalizedMonthly.slice(-6);
    if (areaGroup != null && recentSix.length) {
      const firstKey = String(recentSix[0].month).slice(0, 7);
      const lastKey = String(recentSix[recentSix.length - 1].month).slice(0, 7);
      const [year, month] = lastKey.split("-").map(Number);
      const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7) + "-01";
      const {data: tradeRows, count: total, error: rawError} = await supabase
        .from("apt_trades")
        .select("contract_date,price_won", {count:"exact"})
        .eq("complex_id", id)
        .eq("area_group", areaGroup)
        .eq("cancelled", false)
        .gte("contract_date", firstKey + "-01")
        .lt("contract_date", next)
        .order("contract_date", {ascending: true})
        .limit(1001);
      if (rawError) sourceAudit.reason = "개별 계약 재조회 실패";
      else {
        sourceAudit = reconcileMonthlyWithTrades(recentSix, tradeRows || [], {
          truncated: total != null && total > (tradeRows || []).length,
        });
      }
    }

    return NextResponse.json({
      complex,
      analysisDate: snapshot?.analysis_date || null,
      representativeArea: areaGroup == null ? null : areaGroup + "㎡대",
      snapshot,
      monthly: normalizedMonthly,
      sourceAudit,
      latestTrade: latestTrade ? {
        date: latestTrade.contract_date,
        price: Number(latestTrade.price_won),
        area: Number(latestTrade.exclusive_area),
        areaGroup: latestTrade.area_group,
        floor: latestTrade.floor,
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "단지 상세 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
