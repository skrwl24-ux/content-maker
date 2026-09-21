import { NextRequest, NextResponse } from "next/server";
import { createApartmentReadClient } from "@/lib/apartment-server";

export const dynamic = "force-dynamic";

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/아파트$/g, "")
    .replace(/[%_]/g, "");
}

function exclusionReason(snapshot: Record<string, unknown> | null) {
  if (!snapshot) return "아직 후보 분석 데이터가 없습니다.";
  if (snapshot.candidate_status !== "hold") return "현재 자동추천 후보에 포함된 단지입니다.";

  const sixMonthCount = Number(snapshot.six_month_count || 0);
  const daysSinceLastTrade =
    snapshot.days_since_last_trade == null ? null : Number(snapshot.days_since_last_trade);
  const marketSignalCount = Number(snapshot.market_signal_count || 0);

  if (sixMonthCount < 6) {
    return `최근 6개월 실거래가 기준 6건보다 적습니다. (현재 ${sixMonthCount}건)`;
  }
  if (daysSinceLastTrade == null) {
    return "최근 실거래가 단지와 매칭되지 않았습니다.";
  }
  if (daysSinceLastTrade > 60) {
    return `최근 거래가 ${daysSinceLastTrade}일 전이라 60일 기준을 넘었습니다.`;
  }
  if (marketSignalCount < 1) {
    return "거래량 증가·거래 활발·가격 변화·최근 거래 시장신호가 아직 없습니다.";
  }
  return "현재 자동추천 기준을 모두 충족하지 않아 보류 상태입니다.";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regionCode = url.searchParams.get("regionCode") || "";
    const q = normalizeSearch(url.searchParams.get("q") || "");

    if (!regionCode) {
      return NextResponse.json({ error: "지역을 선택해 주세요." }, { status: 400 });
    }
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createApartmentReadClient();
    const { data: complexes, error: complexError } = await supabase
      .from("apt_complexes")
      .select("id,name,legal_dong,households,use_date,match_status,normalized_name")
      .eq("region_code", regionCode)
      .ilike("normalized_name", `%${q}%`)
      .order("households", { ascending: false, nullsFirst: false })
      .limit(10);
    if (complexError) throw complexError;

    const ids = (complexes || []).map((row) => row.id);
    const { data: snapshots, error: snapshotError } = ids.length
      ? await supabase
          .from("apt_candidate_snapshots")
          .select("*")
          .in("complex_id", ids)
          .order("analysis_date", { ascending: false })
      : { data: [], error: null };
    if (snapshotError) throw snapshotError;

    const latestByComplex = new Map<string, Record<string, unknown>>();
    for (const snapshot of snapshots || []) {
      if (!latestByComplex.has(snapshot.complex_id)) {
        latestByComplex.set(snapshot.complex_id, snapshot as Record<string, unknown>);
      }
    }

    const results = (complexes || []).map((complex) => {
      const snapshot = latestByComplex.get(complex.id) || null;
      const status = snapshot ? String(snapshot.candidate_status || "hold") : "unanalysed";
      return {
        id: complex.id,
        name: complex.name,
        legalDong: complex.legal_dong,
        households: complex.households,
        useDate: complex.use_date,
        matchStatus: complex.match_status,
        status,
        recent30Count: snapshot ? Number(snapshot.recent_30_count || 0) : null,
        sixMonthCount: snapshot ? Number(snapshot.six_month_count || 0) : null,
        daysSinceLastTrade:
          snapshot?.days_since_last_trade == null ? null : Number(snapshot.days_since_last_trade),
        marketSignalCount: snapshot ? Number(snapshot.market_signal_count || 0) : null,
        reason: exclusionReason(snapshot),
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "단지 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
