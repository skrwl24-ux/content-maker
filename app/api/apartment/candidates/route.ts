import { NextRequest, NextResponse } from "next/server";
import { apartmentSetupState, createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

function badgeList(row: Record<string, unknown>) {
  const badges: string[] = [];
  if (row.badge_volume_increase) badges.push("volume_increase");
  if (row.badge_active_trading) badges.push("active_trading");
  if (row.badge_price_change) badges.push("price_change");
  if (row.badge_recent_trade) badges.push("recent_trade");
  if (row.badge_large_complex) badges.push("large_complex");
  return badges;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regionCode = url.searchParams.get("regionCode") || "41410";
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") || 10)));
    const filter = url.searchParams.get("filter") || "all";
    const supabase = createApartmentReadClient();

    const [{ data: region, error: regionError }, { count: totalComplexes }] = await Promise.all([
      supabase.from("apt_tracked_regions").select("*").eq("region_code", regionCode).maybeSingle(),
      supabase.from("apt_complexes").select("id", { count: "exact", head: true }).eq("region_code", regionCode),
    ]);
    if (regionError) throw regionError;

    const { data: latest, error: latestError } = await supabase
      .from("apt_candidate_snapshots")
      .select("analysis_date")
      .eq("region_code", regionCode)
      .order("analysis_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    if (!latest) {
      return NextResponse.json({
        region: region ? { code: region.region_code, name: region.region_name, sido: region.sido_name } : { code: regionCode, name: regionCode },
        analysisDate: null,
        lastSyncedAt: region?.last_synced_at || null,
        totalComplexes: totalComplexes || 0,
        candidateCount: 0,
        priorityCount: 0,
        candidates: [],
        noData: true,
        syncConfigured: Object.values(apartmentSetupState()).every(Boolean),
      });
    }

    const { data: snapshots, error: snapError } = await supabase
      .from("apt_candidate_snapshots")
      .select("*")
      .eq("region_code", regionCode)
      .eq("analysis_date", latest.analysis_date)
      .neq("candidate_status", "hold");
    if (snapError) throw snapError;

    const ids = [...new Set((snapshots || []).map((r) => r.complex_id))];
    const { data: complexes, error: complexError } = ids.length
      ? await supabase.from("apt_complexes").select("id,name,legal_dong,households,use_date").in("id", ids)
      : { data: [], error: null };
    if (complexError) throw complexError;

    const complexMap = new Map((complexes || []).map((c) => [c.id, c]));
    let rows = (snapshots || []).map((row) => {
      const complex = complexMap.get(row.complex_id);
      return {
        id: row.complex_id,
        name: complex?.name || "단지명 확인 필요",
        legalDong: complex?.legal_dong || "",
        households: row.households ?? complex?.households ?? null,
        useDate: complex?.use_date || null,
        status: row.candidate_status,
        recent30Count: row.recent_30_count,
        previous30Count: row.previous_30_count,
        sixMonthCount: row.six_month_count,
        daysSinceLastTrade: row.days_since_last_trade,
        representativeArea: row.representative_area_group == null ? null : row.representative_area_group + "㎡대",
        representativeAreaGroup: row.representative_area_group,
        representativeAreaSixMonthCount: row.representative_area_six_month_count,
        firstMedianPrice: row.first_median_price == null ? null : Number(row.first_median_price),
        latestMedianPrice: row.latest_median_price == null ? null : Number(row.latest_median_price),
        priceChangePct: row.six_month_change_pct == null ? null : Number(row.six_month_change_pct),
        marketSignalCount: row.market_signal_count,
        badges: badgeList(row),
        recommendedAngle: row.recommended_angle,
      };
    });

    if (filter !== "all") {
      rows = rows.filter((row) => row.badges.includes(filter));
    }

    rows.sort((a, b) => {
      const statusA = a.status === "priority" ? 1 : 0;
      const statusB = b.status === "priority" ? 1 : 0;
      return statusB - statusA ||
        b.marketSignalCount - a.marketSignalCount ||
        b.recent30Count - a.recent30Count ||
        (a.daysSinceLastTrade ?? 9999) - (b.daysSinceLastTrade ?? 9999);
    });

    const all = snapshots || [];
    return NextResponse.json({
      region: region ? { code: region.region_code, name: region.region_name, sido: region.sido_name } : { code: regionCode, name: regionCode },
      analysisDate: latest.analysis_date,
      lastSyncedAt: region?.last_synced_at || null,
      totalComplexes: totalComplexes || 0,
      candidateCount: all.length,
      priorityCount: all.filter((r) => r.candidate_status === "priority").length,
      candidates: rows.slice(0, limit),
      noData: false,
      syncConfigured: Object.values(apartmentSetupState()).every(Boolean),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "후보 단지를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
