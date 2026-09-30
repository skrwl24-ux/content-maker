import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

type SnapshotRow = {
  complex_id: string;
  candidate_status: string;
  recent_30_count: number;
  previous_30_count: number;
  six_month_count: number;
  days_since_last_trade: number | null;
  representative_area_group: number | null;
  six_month_change_pct: number | string | null;
  market_signal_count: number;
  recommended_angle: string | null;
};

function dateSeed(dateKey: string) {
  return dateKey.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function cityGroup(regionName: string) {
  const first = regionName.trim().split(/\s+/)[0] || regionName;
  return first.replace(/(특별시|광역시)$/, "");
}

function rowScore(row: SnapshotRow) {
  return (row.candidate_status === "priority" ? 1000 : 0)
    + Number(row.market_signal_count || 0) * 100
    + Math.min(60, Number(row.recent_30_count || 0)) * 4
    + Math.min(80, Number(row.six_month_count || 0))
    - Math.min(90, Number(row.days_since_last_trade ?? 90));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateKey = url.searchParams.get("date") || new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const limit = Math.min(48, Math.max(12, Number(url.searchParams.get("limit") || 36)));
    const supabase = createApartmentReadClient();

    const { data: regionRows, error: regionError } = await supabase
      .from("apt_tracked_regions")
      .select("region_code,sido_name,region_name,enabled")
      .eq("enabled", true)
      .order("sido_name")
      .order("region_name");
    if (regionError) throw regionError;

    const regions = rotate(regionRows || [], dateSeed(dateKey));
    const regionSample = regions.slice(0, Math.min(regions.length, 20));

    const batches = await Promise.all(regionSample.map(async (region) => {
      const { data: latest, error: latestError } = await supabase
        .from("apt_candidate_snapshots")
        .select("analysis_date")
        .eq("region_code", region.region_code)
        .order("analysis_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError || !latest) return [];

      const { data: snapshots, error: snapshotError } = await supabase
        .from("apt_candidate_snapshots")
        .select("complex_id,candidate_status,recent_30_count,previous_30_count,six_month_count,days_since_last_trade,representative_area_group,six_month_change_pct,market_signal_count,recommended_angle")
        .eq("region_code", region.region_code)
        .eq("analysis_date", latest.analysis_date)
        .neq("candidate_status", "hold")
        .limit(8);
      if (snapshotError) return [];

      return ((snapshots || []) as SnapshotRow[])
        .sort((a, b) => rowScore(b) - rowScore(a))
        .slice(0, 5)
        .map((row) => ({
          ...row,
          regionCode: region.region_code,
          sidoName: region.sido_name,
          regionName: region.region_name,
          regionGroup: cityGroup(region.region_name),
          analysisDate: latest.analysis_date,
          score: rowScore(row),
        }));
    }));

    const rows = batches.flat();
    const ids = [...new Set(rows.map((row) => row.complex_id))];
    const { data: complexes, error: complexError } = ids.length
      ? await supabase
          .from("apt_complexes")
          .select("id,name,legal_dong,households,use_date")
          .in("id", ids)
      : { data: [], error: null };
    if (complexError) throw complexError;

    const complexMap = new Map((complexes || []).map((complex) => [complex.id, complex]));
    const candidates = rows
      .map((row) => {
        const complex = complexMap.get(row.complex_id);
        if (!complex) return null;
        return {
          id: row.complex_id,
          name: complex.name,
          legalDong: complex.legal_dong || "",
          households: complex.households ?? null,
          useDate: complex.use_date || null,
          regionCode: row.regionCode,
          regionLabel: [row.sidoName, row.regionName].filter(Boolean).join(" "),
          regionGroup: row.regionGroup,
          representativeArea: row.representative_area_group == null ? null : row.representative_area_group + "㎡대",
          recent30Count: Number(row.recent_30_count || 0),
          sixMonthCount: Number(row.six_month_count || 0),
          daysSinceLastTrade: row.days_since_last_trade,
          priceChangePct: row.six_month_change_pct == null ? null : Number(row.six_month_change_pct),
          marketSignalCount: Number(row.market_signal_count || 0),
          recommendedAngle: row.recommended_angle || "최근 거래는 어떻게 움직이고 있을까?",
          status: row.candidate_status,
          score: row.score,
          analysisDate: row.analysisDate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0;
        return b.score - a.score || b.recent30Count - a.recent30Count;
      })
      .slice(0, limit);

    return NextResponse.json({
      date: dateKey,
      candidateCount: candidates.length,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "오늘의 단지 후보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
