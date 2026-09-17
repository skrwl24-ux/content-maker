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

    const { data: latestTrade, error: tradeError } = await supabase
      .from("apt_trades")
      .select("contract_date,price_won,exclusive_area,area_group,floor")
      .eq("complex_id", id)
      .eq("cancelled", false)
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
