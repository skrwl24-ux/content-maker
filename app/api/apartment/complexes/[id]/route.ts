import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

import { requestedMonths, analysisRows, matchesArea, AREA_RULE, describePeriod, MonthlyStat, AreaTrade, rebuildMonthly } from "@/lib/apartment-analysis";

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
    const months = requestedMonths();
    const lastMonth = months[months.length - 1];
    const [year, month] = lastMonth.split("-").map(Number);
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0,10);
    const monthlyQuery = supabase
      .from("apt_monthly_stats")
      .select("year_month,trade_count,median_price,min_price,max_price")
      .eq("complex_id", id)
      .order("year_month", { ascending: false })
      .gte("year_month", months[0])
      .lte("year_month", lastMonth);

    const { data: monthly, error: monthlyError } = areaGroup == null
      ? { data: [], error: null }
      : await monthlyQuery.eq("area_group", areaGroup);
    if (monthlyError) throw monthlyError;

    const trades: AreaTrade[] = [];
    if (areaGroup != null) {
      for (let offset = 0; ; offset += 1000) {
        const {data: page, error} = await supabase.from("apt_trades")
          .select("id,contract_date,price_won,exclusive_area,area_group,floor")
          .eq("complex_id", id).eq("cancelled", false).eq("area_group", areaGroup)
          .gte("exclusive_area", areaGroup).lt("exclusive_area", areaGroup + 1)
          .gte("contract_date", months[0] + "-01").lte("contract_date", endDate)
          .order("contract_date", {ascending:false}).order("id", {ascending:false})
          .range(offset, offset + 999);
        if(error) throw error;
        trades.push(...(page || []));
        if(!page || page.length < 1000) break;
      }
    }
    const latestTrade = trades.find(trade => matchesArea(Number(trade.exclusive_area), areaGroup) && Number.isFinite(Number(trade.price_won)) && Number(trade.price_won) > 0) || null;
    const rows: MonthlyStat[] = (monthly || []).map(row => ({month:row.year_month, tradeCount:row.trade_count, medianPrice:row.median_price == null ? null : Number(row.median_price)}));
    const verifiedTrade = latestTrade && matchesArea(Number(latestTrade.exclusive_area), areaGroup) ? latestTrade : null;
    return NextResponse.json({
      complex,
      analysisDate: snapshot?.analysis_date || null,
      representativeAreaGroup: areaGroup,
      areaMatchingRule: AREA_RULE,
      analysisPeriod: describePeriod(rebuildMonthly(rows, trades, areaGroup)),
      latestTradeStatus: verifiedTrade ? "matched" : "해당 면적 최근 거래 확인 필요",
      representativeArea: areaGroup == null ? null : areaGroup + "㎡대",
      snapshot,
      monthly: analysisRows(rebuildMonthly(rows, trades, areaGroup)),
      latestTrade: verifiedTrade ? {
        date: verifiedTrade.contract_date,
        price: Number(verifiedTrade.price_won),
        area: Number(verifiedTrade.exclusive_area),
        areaGroup: verifiedTrade.area_group,
        floor: verifiedTrade.floor,
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "단지 상세 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

