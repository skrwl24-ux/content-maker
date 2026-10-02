import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

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
    const asOf = String(snapshot?.analysis_date || new Date().toISOString().slice(0, 10));
    const asOfDate = new Date(asOf + "T00:00:00Z");
    const startMonth = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() - 6, 1))
      .toISOString().slice(0, 7);
    const monthlyQuery = supabase
      .from("apt_monthly_stats")
      .select("year_month,trade_count,median_price,min_price,max_price")
      .eq("complex_id", id)
      .gte("year_month", startMonth)
      .order("year_month", { ascending: false })
      .limit(7);

    const { data: monthly, error: monthlyError } = areaGroup == null
      ? { data: [], error: null }
      : await monthlyQuery.eq("area_group", areaGroup);
    if (monthlyError) throw monthlyError;

    // Never show an 84㎡ or 70㎡ last trade as the latest transaction of a 59㎡
    // representative series. No area group means this data is still unlinked.
    const { data: latestTrade, error: tradeError } = areaGroup == null
      ? { data: null, error: null }
      : await supabase
        .from("apt_trades")
        .select("contract_date,price_won,exclusive_area,area_group,floor")
        .eq("complex_id", id)
        .eq("cancelled", false)
        .eq("area_group", areaGroup)
        .order("contract_date", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (tradeError) throw tradeError;

    return NextResponse.json({
      complex,
      analysisDate: snapshot?.analysis_date || null,
      representativeArea: areaGroup == null ? null : areaGroup + "㎡대",
      snapshot,
      monthly: (monthly || []).reverse().map((row) => ({
        month: row.year_month,
        tradeCount: row.trade_count,
        medianPrice: row.median_price == null ? null : Number(row.median_price),
        minPrice: row.min_price == null ? null : Number(row.min_price),
        maxPrice: row.max_price == null ? null : Number(row.max_price),
      })),
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
