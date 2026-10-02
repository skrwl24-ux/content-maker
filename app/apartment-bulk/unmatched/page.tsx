"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type Region = {
  region_code: string;
  sido_name: string;
  region_name: string;
};

type Candidate = {
  candidate_key: string;
  region_code: string;
  legal_dong: string;
  jibun: string;
  source_apartment_name: string;
  build_year: number | null;
  classification: string;
  same_lot_kapt_count: number;
  year_compatible_kapt_count: number;
  raw_trade_count: number;
  recent_valid_trade_count: number;
  cancelled_trade_count: number;
  latest_contract_date: string | null;
  area_groups: number[];
  analysis_date: string;
  review_status: string;
};

const REASONS = [
  ["", "전체 미연결 사유"],
  ["kapt_lot_not_found", "K-apt 동일 지번 확인 불가"],
  ["multiple_kapt_same_lot", "동일 지번에 여러 단지"],
  ["year_check_failed", "준공연도 검증 불일치"],
  ["unique_lot_unresolved", "동일 지번·연결 미완료"],
] as const;

const REASON_NAME = Object.fromEntries(REASONS);

function verificationPrompt(item: Candidate, regionName: string) {
  return [
    "[국토부 미연결 아파트 단지 식별 조사 · 사실 확인 요청]",
    "아래 항목은 실제 국토부 매매 신고에서 추출했지만 K-apt 단지 식별이 완료되지 않은 자료입니다.",
    "조사 기준: " + item.analysis_date,
    "국토부 원문 단지명: " + item.source_apartment_name,
    "지역: " + regionName + " / " + item.legal_dong,
    "원자료 지번: " + item.jibun,
    "원자료 건축연도: " + (item.build_year ?? "미확인"),
    "원자료 거래 수(전체 수집 범위): " + item.raw_trade_count + "건",
    "분류: " + (REASON_NAME[item.classification] || item.classification),
    "",
    "공식 출처(K-apt, 국토교통부, 건축물대장·지자체 등)와 자료 URL을 검색하여 확인해 주세요.",
    "1. 실제 아파트의 공식 단지명, 법정동·지번, 준공연도가 동일한지 각각 대조할 것.",
    "2. 공동 지번 또는 여러 관리 단지가 있으면 건물·동 범위를 추가로 구분할 것.",
    "3. K-apt 코드와 도로명주소는 공식 근거가 있을 때만 기재할 것.",
    "4. 확실하지 않은 정보는 '미확인'으로 표기하고 추측으로 단지를 연결하지 말 것.",
    "5. 확인된 출처 URL, 출처의 게시/수정일, 서로 불일치하는 항목을 별도로 정리할 것.",
    "6. 이 조사는 신원 확인용이며 실거래 분석·블로그 발행 또는 DB 자동 연결 승인이 아닙니다.",
  ].join("\n");
}

export default function UnmatchedCandidatePage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [region, setRegion] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    fetch("/api/apartment/regions", { cache: "no-store" })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "지역 목록 조회 실패");
        return body;
      })
      .then(body => setRegions(body.regions || []))
      .catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (region) params.set("regionCode", region);
    if (reason) params.set("reason", reason);
    if (appliedName) params.set("name", appliedName);
    setLoading(true);
    setError("");
    fetch("/api/apartment/unmatched-candidates?" + params, {
      cache: "no-store", signal: controller.signal,
    })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "검토 후보 조회에 실패했습니다.");
        return body;
      })
      .then(body => {
        if (controller.signal.aborted) return;
        setItems(body.candidates || []);
        setTotal(body.total || 0);
        setPageSize(body.pageSize || 30);
        setLoading(false);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "데이터 조회 오류");
      });
    return () => controller.abort();
  }, [region, reason, appliedName, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedName(search.trim());
    setPage(0);
  }

  function getRegionName(item: Candidate) {
    const found = regions.find(entry => entry.region_code === item.region_code);
    return found ? found.sido_name + " " + found.region_name : item.region_code;
  }

  async function copyPrompt(item: Candidate) {
    try {
      await navigator.clipboard.writeText(verificationPrompt(item, getRegionName(item)));
      setCopyMessage(item.candidate_key);
    } catch {
      setCopyMessage("copy_failed");
    }
  }

  const pages = Math.ceil(total / pageSize);

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <a href="/apartment-bulk" className={styles.back}>← 아파트 콘텐츠메이커</a>
        <h1>국토부 미연결 실거래 검토함</h1>
        <p>기존 K-apt 단지에 안전하게 연결되지 않은 원자료를 별도로 모았습니다.</p>
      </header>

      <section className={styles.notice}>
        <strong>단지 식별 전 · 발행용 데이터 아님</strong>
        <p>한 행은 하나의 검토 후보(지역·법정동·지번·국토부 표기 단지명·건축연도 조합)입니다.
        동일 지번에 여러 관리 단지가 있을 수 있으며, 여기에 나타나는 거래 수를
        확인된 K-apt 단지의 실거래량으로 사용하면 안 됩니다. 자동 연결·발행 기능은 없습니다.</p>
      </section>

      <section className={styles.controlPanel} aria-label="미연결 거래 필터">
        <form onSubmit={submitSearch} className={styles.filters}>
          <label>
            <span>지역</span>
            <select value={region} onChange={e => { setRegion(e.target.value); setPage(0); }}>
              <option value="">전체 지역</option>
              {regions.map(item => (
                <option key={item.region_code} value={item.region_code}>
                  {item.sido_name} {item.region_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>미연결 사유</span>
            <select value={reason} onChange={e => { setReason(e.target.value); setPage(0); }}>
              {REASONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.search}>
            <span>국토부 원문 단지명</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              maxLength={40} placeholder="예: 충무주공, 매교역푸르지오" />
          </label>
          <button type="submit">후보 찾기</button>
        </form>
        <div className={styles.resultStatus} aria-live="polite">
          <strong>{loading ? "조회 중…" : total.toLocaleString("ko-KR") + "개 후보"}</strong>
          {appliedName && <span>검색어: {appliedName}</span>}
          <span>검증 전 원자료 · 참고용 목록</span>
        </div>
      </section>

      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!loading && !error && !items.length && <p className={styles.empty}>해당 조건의 후보가 없습니다.</p>}

      <div className={styles.results}>
        {items.map(item => (
          <article className={styles.card} key={item.candidate_key}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.source}>국토부 원문 · 미검증</span>
                <h2>{item.source_apartment_name}</h2>
                <p>{getRegionName(item)} {item.legal_dong} · 지번 {item.jibun}</p>
              </div>
              <span className={styles.reason}>{REASON_NAME[item.classification] || item.classification}</span>
            </div>
            <div className={styles.facts}>
              <span>건축연도 <b>{item.build_year ? item.build_year + "년" : "미확인"}</b></span>
              <span>수집된 원자료 <b>{item.raw_trade_count.toLocaleString("ko-KR")}건</b></span>
              <span>최근 182일 정상 신고 <b>{item.recent_valid_trade_count.toLocaleString("ko-KR")}건</b></span>
              <span>최근 계약일 <b>{item.latest_contract_date || "미확인"}</b></span>
              <span>신고된 전용면적대 <b>{item.area_groups.length ? item.area_groups.join("·") + "㎡대" : "미확인"}</b></span>
              <span>K-apt 동일 지번 후보 <b>{item.same_lot_kapt_count}개</b></span>
            </div>
            <div className={styles.cardFooter}>
              <small>확인 기준일 {item.analysis_date} · 식별 검토가 끝나기 전에는 기존 단지에 연결하지 않습니다.</small>
              <button type="button" onClick={() => void copyPrompt(item)}>
                {copyMessage === item.candidate_key ? "✓ 검증 요청서 복사됨" : "웹 검증 요청서 복사"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {copyMessage === "copy_failed" && <p role="alert" className={styles.error}>클립보드 접근이 제한됐습니다. 브라우저 권한을 확인해 주세요.</p>}

      {!loading && !error && pages > 1 && (
        <nav className={styles.pagination} aria-label="후보 페이지 이동">
          <button type="button" disabled={page <= 0} onClick={() => setPage(v => Math.max(v - 1, 0))}>이전</button>
          <span>{page + 1} / {pages}페이지</span>
          <button type="button" disabled={page + 1 >= pages || page >= 200}
            onClick={() => setPage(v => v + 1)}>다음</button>
        </nav>
      )}
    </main>
  );
}
