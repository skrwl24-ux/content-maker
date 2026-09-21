"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Region = {
  region_code: string;
  sido_code: string;
  sido_name: string;
  region_name: string;
  enabled: boolean;
  last_synced_at: string | null;
};

type Candidate = {
  id: string;
  name: string;
  legalDong: string;
  households: number | null;
  status: "priority" | "candidate";
  recent30Count: number;
  previous30Count: number;
  sixMonthCount: number;
  daysSinceLastTrade: number | null;
  representativeArea: string | null;
  firstMedianPrice: number | null;
  latestMedianPrice: number | null;
  priceChangePct: number | null;
  marketSignalCount: number;
  badges: string[];
  recommendedAngle: string;
};

type CandidateResponse = {
  region: { code: string; name: string; sido?: string };
  analysisDate: string | null;
  lastSyncedAt: string | null;
  totalComplexes: number;
  candidateCount: number;
  priorityCount: number;
  candidates: Candidate[];
  noData: boolean;
  syncConfigured: boolean;
};

type SearchResult = {
  id: string;
  name: string;
  legalDong: string | null;
  households: number | null;
  useDate: string | null;
  matchStatus: string | null;
  status: "priority" | "candidate" | "hold" | "unanalysed";
  recent30Count: number | null;
  sixMonthCount: number | null;
  daysSinceLastTrade: number | null;
  marketSignalCount: number | null;
  reason: string;
};

type Detail = {
  complex: {
    id: string;
    name: string;
    legal_dong: string | null;
    households: number | null;
    use_date: string | null;
  };
  representativeArea: string | null;
  monthly: Array<{ month: string; tradeCount: number; medianPrice: number | null }>;
  latestTrade: { date: string; price: number; area: number; floor: number | null } | null;
};

const FILTERS = [
  ["all", "전체"],
  ["volume_increase", "🔥 거래량 증가"],
  ["price_change", "📈 가격 변화"],
  ["active_trading", "🏠 거래 활발"],
  ["large_complex", "🏢 대단지"],
] as const;

const BADGES: Record<string, string> = {
  volume_increase: "🔥 거래량 증가",
  active_trading: "🏠 거래 활발",
  price_change: "📈 가격 변화",
  recent_trade: "🕒 최근 거래",
  large_complex: "🏢 대단지",
};

function won(value: number | null) {
  if (value == null) return "-";
  const eok = value / 100000000;
  if (eok >= 1) {
    const fixed = eok >= 10 ? eok.toFixed(1) : eok.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "억";
  }
  return Math.round(value / 10000).toLocaleString("ko-KR") + "만원";
}

function dateTime(value: string | null) {
  if (!value) return "아직 없음";
  const d = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function useYear(value: string | null) {
  if (!value) return "사용승인 확인 중";
  const year = value.slice(0, 4);
  return year ? year + "년 사용승인" : "사용승인 확인 중";
}

function searchStatus(result: SearchResult) {
  if (result.status === "priority") return "우선 검토";
  if (result.status === "candidate") return "발행 후보";
  if (result.status === "hold") return "자동추천 제외";
  return "분석 전";
}

export default function ApartmentDiscoverPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionCode, setRegionCode] = useState("41410");
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");

  useEffect(() => {
    fetch("/api/apartment/regions", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setRegions(json.regions || []);
        if (json.regions?.length && !json.regions.some((r: Region) => r.region_code === regionCode)) {
          setRegionCode(json.regions[0].region_code);
        }
      })
      .catch(() => setError("지역 목록을 불러오지 못했습니다."));
  }, []);

  async function loadCandidates(nextFilter = filter) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        "/api/apartment/candidates?regionCode=" + encodeURIComponent(regionCode) +
          "&limit=10&filter=" + encodeURIComponent(nextFilter),
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "후보 조회 실패");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "후보 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (regionCode) loadCandidates(filter);
  }, [regionCode, filter]);

  useEffect(() => {
    setSearchResults([]);
    setSearchMessage("");
  }, [regionCode]);

  async function searchComplexes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchMessage("단지명을 두 글자 이상 입력해 주세요.");
      return;
    }

    setSearchLoading(true);
    setSearchMessage("");
    try {
      const res = await fetch(
        "/api/apartment/search?regionCode=" + encodeURIComponent(regionCode) +
          "&q=" + encodeURIComponent(q),
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "단지 검색 실패");
      const results = (json.results || []) as SearchResult[];
      setSearchResults(results);
      setSearchMessage(results.length ? "" : "선택한 지역에서 일치하는 단지를 찾지 못했습니다.");
    } catch (e) {
      setSearchResults([]);
      setSearchMessage(e instanceof Error ? e.message : "단지 검색 실패");
    } finally {
      setSearchLoading(false);
    }
  }

  async function openDetail(id: string) {
    if (detailId === id) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch("/api/apartment/complexes/" + id, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "상세 분석 실패");
      setDetail(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상세 분석 실패");
    } finally {
      setDetailLoading(false);
    }
  }

  const selectedRegion = useMemo(
    () => regions.find((r) => r.region_code === regionCode),
    [regions, regionCode]
  );

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <a href="/apartment-bulk" className={styles.back}>← 이미지 제작 화면</a>
        <span className={styles.modeBadge}>단지 콘텐츠 발굴기 V1</span>
      </div>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>집값쓱 DISCOVERY</p>
          <h1>오늘 쓸 아파트를<br />데이터가 먼저 찾아줍니다.</h1>
          <p>거래 증가 · 가격 변화 · 거래 활발 · 최근성 신호를 보고 후보만 추립니다.</p>
        </div>
        <div className={styles.heroSide}>
          <span>지역 선택</span>
          <select value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
            {regions.length ? regions.map((r) => (
              <option key={r.region_code} value={r.region_code}>
                {r.sido_name} {r.region_name}
              </option>
            )) : <option value="41410">경기도 군포시</option>}
          </select>
          <button type="button" onClick={() => loadCandidates(filter)}>↻ 화면 새로고침</button>
        </div>
      </section>

      <section className={styles.summary}>
        <div><span>분석 단지</span><b>{data?.totalComplexes ?? "-"}</b></div>
        <div><span>발행 후보</span><b>{data?.candidateCount ?? "-"}</b></div>
        <div><span>우선 검토</span><b>{data?.priorityCount ?? "-"}</b></div>
        <div><span>마지막 갱신</span><b className={styles.smallStat}>{dateTime(data?.lastSyncedAt || selectedRegion?.last_synced_at || null)}</b></div>
      </section>

      <section className={styles.searchPanel}>
        <div className={styles.searchHeading}>
          <div>
            <span>직접 찾기</span>
            <h2>자동추천에 없어도 단지명으로 바로 찾기</h2>
            <p>네이버 인기급상승·청약·입주·뉴스처럼 외부 이슈로 찾은 단지를 검색하세요.</p>
          </div>
          <small>{selectedRegion ? selectedRegion.sido_name + " " + selectedRegion.region_name : "선택 지역"} 안에서 검색</small>
        </div>
        <form className={styles.searchForm} onSubmit={searchComplexes}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="예: 철산자이더헤리티지"
            aria-label="단지명 직접 검색"
          />
          <button type="submit" disabled={searchLoading}>
            {searchLoading ? "검색 중…" : "단지 검색"}
          </button>
        </form>

        {searchMessage && <p className={styles.searchMessage}>{searchMessage}</p>}

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map((result) => (
              <article key={result.id} className={styles.searchCard}>
                <div className={styles.searchCardTop}>
                  <div>
                    <div className={styles.statusLine}>
                      <span className={result.status === "hold" || result.status === "unanalysed" ? styles.hold : result.status === "priority" ? styles.priority : styles.candidate}>
                        {searchStatus(result)}
                      </span>
                      <span>{result.legalDong || "법정동 확인 중"}</span>
                    </div>
                    <h3>{result.name}</h3>
                    <p>
                      {result.households ? result.households.toLocaleString("ko-KR") + "세대" : "세대수 확인 중"}
                      {" · "}
                      {useYear(result.useDate)}
                    </p>
                  </div>
                  <a href={"/apartment-bulk?complexId=" + result.id}>이 단지로 글 만들기 →</a>
                </div>

                <div className={styles.searchReason}>
                  <b>{result.status === "hold" ? "자동추천에서 빠진 이유" : "현재 상태"}</b>
                  <span>{result.reason}</span>
                </div>

                <div className={styles.searchStats}>
                  <div><span>최근 30일</span><b>{result.recent30Count == null ? "-" : result.recent30Count + "건"}</b></div>
                  <div><span>최근 6개월</span><b>{result.sixMonthCount == null ? "-" : result.sixMonthCount + "건"}</b></div>
                  <div><span>최근 거래</span><b>{result.daysSinceLastTrade == null ? "없음" : result.daysSinceLastTrade + "일 전"}</b></div>
                  <div><span>시장신호</span><b>{result.marketSignalCount == null ? "-" : result.marketSignalCount + "개"}</b></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className={styles.filters}>
        <div className={styles.filterButtons}>
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? styles.activeFilter : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span>{data?.analysisDate ? data.analysisDate + " 분석 기준" : "분석 데이터 준비 전"}</span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <section className={styles.empty}>
          <div className={styles.spinner} />
          <b>후보 단지를 불러오는 중…</b>
        </section>
      ) : data?.noData ? (
        <section className={styles.empty}>
          <div className={styles.emptyIcon}>🏢</div>
          <h2>후보 발굴 화면과 DB는 준비됐습니다.</h2>
          <p>
            {data.syncConfigured
              ? "이 지역은 등록됐지만 아직 첫 데이터 동기화가 완료되지 않았습니다. 첫 동기화가 끝나면 분석 단지와 발행 후보가 자동으로 표시됩니다."
              : "실거래 자동수집을 시작하려면 Vercel에 공공데이터 키와 Supabase 서버키를 연결하면 됩니다."}
          </p>
          <div className={styles.setupBox}>
            <b>{data?.lastSyncedAt ? "현재 등록 지역" : "첫 동기화 대기 지역"}</b>
            <span>{selectedRegion ? selectedRegion.sido_name + " " + selectedRegion.region_name : "경기도 군포시"}</span>
            <small>가짜 후보를 채우지 않고 실제 데이터가 들어온 뒤부터 노출합니다.</small>
          </div>
        </section>
      ) : data && data.candidates.length === 0 ? (
        <section className={styles.empty}>
          <div className={styles.emptyIcon}>🔎</div>
          <h2>이 조건에 맞는 후보가 없습니다.</h2>
          <p>필터를 ‘전체’로 바꾸거나 다음 갱신 데이터를 확인해보세요.</p>
        </section>
      ) : (
        <section className={styles.list}>
          {data?.candidates.map((candidate) => (
            <article key={candidate.id} className={candidate.status === "priority" ? styles.priorityCard : styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.statusLine}>
                    <span className={candidate.status === "priority" ? styles.priority : styles.candidate}>
                      {candidate.status === "priority" ? "우선 검토" : "발행 후보"}
                    </span>
                    <span>{candidate.legalDong}</span>
                  </div>
                  <h2>{candidate.name}</h2>
                  <p>
                    {candidate.households ? candidate.households.toLocaleString("ko-KR") + "세대" : "세대수 확인 중"}
                    {" · "}
                    {candidate.daysSinceLastTrade == null ? "최근 거래 없음" : "최근 거래 " + candidate.daysSinceLastTrade + "일 전"}
                  </p>
                </div>
                <div className={styles.signalCount}>
                  <b>{candidate.marketSignalCount}</b>
                  <span>시장신호</span>
                </div>
              </div>

              <div className={styles.badges}>
                {candidate.badges.map((badge) => <span key={badge}>{BADGES[badge] || badge}</span>)}
              </div>

              <div className={styles.metrics}>
                <div><span>최근 30일</span><b>{candidate.recent30Count}건</b></div>
                <div><span>직전 30일</span><b>{candidate.previous30Count}건</b></div>
                <div><span>최근 6개월</span><b>{candidate.sixMonthCount}건</b></div>
                <div><span>{candidate.representativeArea || "대표면적"}</span><b>{won(candidate.latestMedianPrice)}</b></div>
              </div>

              <div className={styles.priceLine}>
                <span>6개월 대표가격</span>
                <b>{won(candidate.firstMedianPrice)} → {won(candidate.latestMedianPrice)}</b>
                {candidate.priceChangePct != null && (
                  <em className={candidate.priceChangePct >= 0 ? styles.up : styles.down}>
                    {candidate.priceChangePct >= 0 ? "+" : ""}{candidate.priceChangePct.toFixed(1)}%
                  </em>
                )}
              </div>

              <div className={styles.angle}>
                <span>추천 글 방향</span>
                <b>“{candidate.recommendedAngle}”</b>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={() => openDetail(candidate.id)}>
                  {detailId === candidate.id ? "상세 닫기" : "분석 보기"}
                </button>
                <a href={"/apartment-bulk?complexId=" + candidate.id}>이 단지로 글 만들기 →</a>
              </div>

              {detailId === candidate.id && (
                <div className={styles.detail}>
                  {detailLoading ? <p>상세 데이터를 불러오는 중…</p> : detail ? (
                    <>
                      <div className={styles.detailHead}>
                        <div><span>대표면적</span><b>{detail.representativeArea || "-"}</b></div>
                        <div><span>최근 실거래</span><b>{detail.latestTrade ? won(detail.latestTrade.price) : "-"}</b></div>
                        <div><span>최근 거래일</span><b>{detail.latestTrade?.date || "-"}</b></div>
                      </div>
                      <div className={styles.monthly}>
                        {detail.monthly.slice(-6).map((m) => (
                          <div key={m.month}>
                            <span>{m.month.slice(5)}월</span>
                            <b>{m.medianPrice == null ? "거래 없음" : won(m.medianPrice)}</b>
                            <small>{m.tradeCount}건</small>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p>상세 데이터를 표시할 수 없습니다.</p>}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <section className={styles.ruleNote}>
        <b>V1 후보 기준</b>
        <p>최근 6개월 6건 이상 + 최근 거래 60일 이내를 기본자격으로 보고, 거래량 증가·거래 활발·가격 변화·최근 거래 중 최소 1개 시장신호가 있어야 후보로 표시합니다. 대단지는 보조신호로만 사용합니다.</p>
      </section>
    </main>
  );
}
