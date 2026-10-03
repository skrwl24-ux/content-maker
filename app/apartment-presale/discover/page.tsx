"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PRESALE_CANDIDATE_SNAPSHOT_DATE, PRESALE_CANDIDATES,
  getPresaleCandidateCounts, makePresaleDiscoveryPrompt,
} from "../../../lib/apartment-presale-candidates.mjs";
import type { PresaleCandidateStage } from "../../../lib/apartment-presale-candidates.mjs";
import styles from "./page.module.css";

type FilterKey = "all" | PresaleCandidateStage;
type AreaKey = "전체" | "서울" | "경기" | "인천";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체 후보" },
  { key: "planned", label: "10월 분양 예정" },
  { key: "later", label: "11월 이후" },
  { key: "watch", label: "일정·사업 확인" },
  { key: "notice", label: "특수 재공급" },
  { key: "followup", label: "마감 후 분석" },
];
const AREAS: AreaKey[] = ["전체", "서울", "경기", "인천"];
function localDate() {
  const date = new Date();
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

export default function PresaleDiscoverPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [area, setArea] = useState<AreaKey>("전체");
  const [today, setToday] = useState("");
  const [notice, setNotice] = useState("");
  const counts = useMemo(() => getPresaleCandidateCounts(), []);
  useEffect(() => setToday(localDate()), []);
  const matches = useMemo(() => {
    const q = query.replace(/\s+/g, "").trim().toLowerCase();
    return PRESALE_CANDIDATES.filter((item) =>
      (filter === "all" || item.stage === filter) &&
      (area === "전체" || item.area === area) &&
      (!q || [item.name, item.region, item.topic, item.interest, item.kick, item.status]
        .join(" ").replace(/\s+/g, "").toLowerCase().includes(q)));
  }, [query, filter, area]);
  const researchPrompt = useMemo(() => makePresaleDiscoveryPrompt(today), [today]);

  function discoverAgain() {
    // This launches a fresh research request. It does NOT change the dated snapshot behind the cards.
    const encoded = encodeURIComponent(researchPrompt);
    if (encoded.length <= 5000) {
      window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
      setNotice("새 ChatGPT 대화에서 최신 분양 후보를 다시 조사하도록 요청했습니다.");
    } else {
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      void copyResearch();
    }
  }
  async function copyResearch() {
    try {
      await navigator.clipboard.writeText(researchPrompt);
      setNotice("최신 후보 조사 요청서를 복사했습니다. ChatGPT에 붙여넣으면 됩니다.");
    } catch {
      setNotice("복사 실패 · 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }
  function clearFilters() {
    setQuery(""); setFilter("all"); setArea("전체");
  }

  return <main className={styles.page}>
    <nav className={styles.topbar}>
      <a href="/" className={styles.brand}>← 콘텐츠메이커</a>
      <div className={styles.links}>
        <a href="/apartment-presale">분양정보 제작실</a>
        <a href="/apartment-bulk">기존 아파트 분석</a>
      </div>
    </nav>

    <section className={styles.hero}>
      <span className={styles.eyebrow}>집값쓱 · PRESALE DISCOVERY</span>
      <h1>무슨 분양 글을 쓸지,<br/>우리가 먼저 찾아드립니다.</h1>
      <p>서울·경기·인천의 신규 분양계획과 공공청약을 살펴보고, 숫자와 고유한 이야기가 있는 단지만 편집 후보로 추렸습니다.</p>
      <div className={styles.heroActions}>
        <button type="button" className={styles.whiteButton} onClick={discoverAgain}>🔎 ChatGPT로 최신 후보 다시 조사 ↗</button>
        <button type="button" className={styles.ghostButton} onClick={() => void copyResearch()}>조사 요청서 복사</button>
      </div>
    </section>

    <div className={styles.pageInner}>
      <section className={styles.snapshot}>
        <div>
          <small>조사 스냅샷</small>
          <strong>{PRESALE_CANDIDATE_SNAPSHOT_DATE.replace(/-/g, ".")}</strong>
          <span>분양계획·모집공고·사후 분석 소재를 구분한 목록입니다.</span>
        </div>
        <div className={styles.snapshotNumbers}>
          <b>{counts.total}<small>전체 후보</small></b>
          <b>{counts.planned}<small>10월 예정</small></b>
          <b>{counts.notice + counts.followup}<small>재공급·후속</small></b>
        </div>
      </section>
      <p className={styles.sourceWarning}>
        {today > PRESALE_CANDIDATE_SNAPSHOT_DATE
          ? "이 목록은 과거 조사 스냅샷입니다. 오늘의 청약일·확정가격으로 사용하지 마세요. 상단의 최신 조사 버튼 또는 아래 공식자료 링크로 재확인하세요."
          : "이 화면의 '예정'은 확정 모집공고가 아닙니다. 작성 버튼을 누르면 최신 공식 자료부터 다시 확인하는 단계로 이동합니다."}
      </p>

      <section className={styles.filterPanel} aria-label="분양 후보 필터">
        <div className={styles.filterTitle}>
          <h2>관심 분양 후보 찾기</h2>
          <span>실제 검색량 순위나 청약 추천 점수는 아닙니다.</span>
        </div>
        <label className={styles.searchLabel}>
          <span>단지명·지역·글 소재 검색</span>
          <input type="search" placeholder="예: 강동 / 롯데캐슬 / 토지임대부 / 광교" value={query}
            onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup} role="group" aria-label="진행 상태">
            {FILTERS.map((item) => <button type="button" key={item.key} aria-pressed={filter === item.key}
              className={filter === item.key ? styles.filterActive : styles.filterButton}
              onClick={() => setFilter(item.key)}>{item.label}</button>)}
          </div>
          <div className={styles.filterGroup} role="group" aria-label="지역">
            {AREAS.map((item) => <button type="button" key={item} aria-pressed={area === item}
              className={area === item ? styles.areaActive : styles.areaButton}
              onClick={() => setArea(item)}>{item}</button>)}
          </div>
        </div>
        <div className={styles.resultsHead}>
          <span>{matches.length}개 후보 표시</span>
          {(query || filter !== "all" || area !== "전체") &&
            <button type="button" onClick={clearFilters}>필터 초기화</button>}
        </div>
      </section>

      <section className={styles.candidateGrid} aria-label="조사된 분양 후보">
        {matches.length === 0 ? <div className={styles.noResults}>
          <b>조건에 맞는 후보가 없습니다.</b>
          <p>지역 또는 검색어를 바꾸거나 ChatGPT로 최신 단지를 추가 조사해 보세요.</p>
          <button type="button" onClick={clearFilters}>전체 보기</button>
        </div> : matches.map((item) =>
          <article key={item.id} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.region}>{item.region}</span>
              <span className={styles.status}>{item.status}</span>
            </div>
            <h3>{item.name}</h3>
            <p className={styles.schedule}>{item.schedule}</p>
            <div className={styles.supply}><small>공급 정보 · 기준일 확인 필요</small><strong>{item.supply}</strong><span>{item.supplyNote}</span></div>
            <p className={styles.interest}>{item.interest}</p>
            <div className={styles.kick}><small>이 글의 킥</small><p>{item.kick}</p></div>
            <p className={styles.caution}>{item.caution}</p>
            <div className={styles.sources}>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">확인 근거 · {item.sourceLabel} ↗</a>
              <a href={item.officialUrl} target="_blank" rel="noopener noreferrer">{item.officialLabel} ↗</a>
            </div>
            <a className={styles.startButton}
              href={"/apartment-presale?candidate=" + encodeURIComponent(item.id) +
                "&workId=" + encodeURIComponent("curated-" + item.id)}>
              이 단지 글 만들기 →
            </a>
          </article>
        )}
      </section>

      <section className={styles.footerGuide}>
        <h2>목록이 만들어지는 기준</h2>
        <p>공식공고 원문 또는 건설사 발표자료가 있으면 그 자료를 우선 사용하고, 예정 보도는 별도 상태로 표시합니다. 전체 단지 규모와 실제 이번 일반·신규 공급 물량을 나눕니다.</p>
        <p>후보의 ‘킥’은 독자가 궁금해할 설명 관점이지 사실 확정이나 청약 권유가 아닙니다. 단지 선택 시 분양정보 제작실에 조사 메모와 근거 URL이 준비되지만, 원문을 직접 확인하기 전까지 검증 완료로 처리되지 않습니다.</p>
      </section>
    </div>
    {notice && <div role="status" className={styles.notice}>
      {notice}<button type="button" aria-label="알림 닫기" onClick={() => setNotice("")}>×</button>
    </div>}
  </main>;
}
