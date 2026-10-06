"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PRESALE_BASELINE_PUBLISHED_IDS,
  PRESALE_CANDIDATE_SNAPSHOT_DATE,
  PRESALE_CANDIDATES,
  makePresaleDiscoveryPrompt,
} from "../../../lib/apartment-presale-candidates.mjs";
import type { PresaleCandidateStage } from "../../../lib/apartment-presale-candidates.mjs";
import styles from "./page.module.css";

type FilterKey = "all" | PresaleCandidateStage;
type AreaKey = "전체" | "서울" | "경기" | "인천";
type QueueView = "queue" | "published";
type PublicationState = { published: string[]; restored: string[] };

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체 후보" },
  { key: "planned", label: "10월 분양 예정" },
  { key: "later", label: "11월 이후" },
  { key: "watch", label: "일정·사업 확인" },
  { key: "notice", label: "특수 재공급" },
  { key: "followup", label: "마감 후 분석" },
];
const AREAS: AreaKey[] = ["전체", "서울", "경기", "인천"];
const PUBLICATION_STORAGE_KEY = "content-maker-presale-publication-v1";
const BASELINE_PUBLISHED = new Set<string>(PRESALE_BASELINE_PUBLISHED_IDS);

function localDate() {
  const date = new Date();
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 120)));
}

function loadPublicationState(): PublicationState {
  try {
    const raw = window.localStorage.getItem(PUBLICATION_STORAGE_KEY);
    if (!raw) return { published: [], restored: [] };
    const parsed = JSON.parse(raw);
    return {
      published: cleanIds(parsed?.published),
      restored: cleanIds(parsed?.restored),
    };
  } catch {
    return { published: [], restored: [] };
  }
}

function savePublicationState(value: PublicationState) {
  try {
    window.localStorage.setItem(PUBLICATION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The baseline archive still works even when browser storage is unavailable.
  }
}

function isPublishedCandidate(id: string, value: PublicationState) {
  if (value.restored.includes(id)) return false;
  return BASELINE_PUBLISHED.has(id) || value.published.includes(id);
}

export default function PresaleDiscoverPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [area, setArea] = useState<AreaKey>("전체");
  const [queueView, setQueueView] = useState<QueueView>("queue");
  const [publicationState, setPublicationState] = useState<PublicationState>({ published: [], restored: [] });
  const [today, setToday] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setToday(localDate());
    setPublicationState(loadPublicationState());
  }, []);

  const publishedCandidates = useMemo(
    () => PRESALE_CANDIDATES.filter((item) => isPublishedCandidate(item.id, publicationState)),
    [publicationState],
  );
  const queueCandidates = useMemo(
    () => PRESALE_CANDIDATES.filter((item) => !isPublishedCandidate(item.id, publicationState)),
    [publicationState],
  );
  const visiblePool = queueView === "queue" ? queueCandidates : publishedCandidates;

  const matches = useMemo(() => {
    const q = query.replace(/\s+/g, "").trim().toLowerCase();
    return visiblePool.filter((item) =>
      (filter === "all" || item.stage === filter) &&
      (area === "전체" || item.area === area) &&
      (!q || [item.name, item.region, item.topic, item.interest, item.kick, item.status]
        .join(" ").replace(/\s+/g, "").toLowerCase().includes(q)));
  }, [visiblePool, query, filter, area]);

  const researchPrompt = useMemo(
    () => makePresaleDiscoveryPrompt(today, publishedCandidates),
    [today, publishedCandidates],
  );

  function discoverAgain() {
    const encoded = encodeURIComponent(researchPrompt);
    if (encoded.length <= 5000) {
      window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
      setNotice("발행 완료 소재를 제외한 조건으로 새 ChatGPT 대화에서 최신 후보 조사를 시작했습니다.");
    } else {
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      void copyResearch();
    }
  }

  async function copyResearch() {
    try {
      await navigator.clipboard.writeText(researchPrompt);
      setNotice("발행 완료 소재가 포함된 최신 후보 조사 요청서를 복사했습니다.");
    } catch {
      setNotice("복사 실패 · 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setArea("전체");
  }

  function setCandidatePublished(id: string, published: boolean) {
    setPublicationState((prev) => {
      const localPublished = new Set(prev.published);
      const restored = new Set(prev.restored);
      if (published) {
        localPublished.add(id);
        restored.delete(id);
      } else {
        localPublished.delete(id);
        if (BASELINE_PUBLISHED.has(id)) restored.add(id);
        else restored.delete(id);
      }
      const next = {
        published: Array.from(localPublished),
        restored: Array.from(restored),
      };
      savePublicationState(next);
      return next;
    });
    setNotice(published
      ? "발행 완료로 보관했습니다. 앞으로 최신 후보 조사 요청에서도 같은 사건은 제외됩니다."
      : "미발행 큐로 복원했습니다.");
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
      <h1>이미 쓴 분양은 빼고,<br/>다음 글감만 남깁니다.</h1>
      <p>발행 완료한 소재는 보관함으로 이동하고 최신 조사 요청에서는 같은 사건을 자동 제외합니다. 같은 단지라도 새 공고·무순위·일정 변경처럼 새 사건이 생기면 다시 후보가 될 수 있습니다.</p>
      <div className={styles.heroActions}>
        <button type="button" className={styles.whiteButton} onClick={discoverAgain}>🔎 미발행 최신 후보 다시 조사 ↗</button>
        <button type="button" className={styles.ghostButton} onClick={() => void copyResearch()}>조사 요청서 복사</button>
      </div>
    </section>

    <div className={styles.pageInner}>
      <section className={styles.snapshot}>
        <div>
          <small>조사 스냅샷</small>
          <strong>{PRESALE_CANDIDATE_SNAPSHOT_DATE.replace(/-/g, ".")}</strong>
          <span>기존 후보는 삭제하지 않고 발행완료 보관함에 남깁니다.</span>
        </div>
        <div className={styles.snapshotNumbers}>
          <b>{queueCandidates.length}<small>미발행 큐</small></b>
          <b>{publishedCandidates.length}<small>발행 완료</small></b>
          <b>{PRESALE_CANDIDATES.length}<small>전체 기록</small></b>
        </div>
      </section>

      <p className={styles.sourceWarning}>
        {queueCandidates.length === 0
          ? "현재 스냅샷의 후보는 모두 발행완료로 보관되어 있습니다. 새 글감은 상단의 ‘미발행 최신 후보 다시 조사’를 눌러 찾으세요. 이미 발행한 단지는 새 공식 공고·재공급·경쟁 결과 등 독립된 새 사건이 있을 때만 다시 후보로 제안하도록 요청합니다."
          : today > PRESALE_CANDIDATE_SNAPSHOT_DATE
            ? "이 목록은 과거 조사 스냅샷입니다. 오늘의 청약일·확정가격으로 사용하지 마세요. 작성 전에 최신 공식자료를 다시 확인하세요."
            : "이 화면의 '예정'은 확정 모집공고가 아닙니다. 작성 버튼을 누르면 최신 공식 자료부터 다시 확인하는 단계로 이동합니다."}
      </p>

      <section className={styles.filterPanel} aria-label="분양 후보 필터">
        <div className={styles.filterTitle}>
          <h2>{queueView === "queue" ? "아직 안 쓴 신규 소재 큐" : "발행 완료 보관함"}</h2>
          <span>단지명이 아니라 ‘발행한 사건’을 관리합니다.</span>
        </div>

        <div className={styles.queueTabs} role="group" aria-label="발행 상태">
          <button type="button" aria-pressed={queueView === "queue"}
            className={queueView === "queue" ? styles.queueTabActive : styles.queueTab}
            onClick={() => { setQueueView("queue"); clearFilters(); }}>
            미발행 큐 <b>{queueCandidates.length}</b>
          </button>
          <button type="button" aria-pressed={queueView === "published"}
            className={queueView === "published" ? styles.queueTabActive : styles.queueTab}
            onClick={() => { setQueueView("published"); clearFilters(); }}>
            발행 완료 <b>{publishedCandidates.length}</b>
          </button>
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
          <span>{matches.length}개 {queueView === "queue" ? "미발행 후보" : "발행 기록"} 표시</span>
          {(query || filter !== "all" || area !== "전체") &&
            <button type="button" onClick={clearFilters}>필터 초기화</button>}
        </div>
      </section>

      <section className={styles.candidateGrid} aria-label="조사된 분양 후보">
        {matches.length === 0 ? <div className={styles.noResults}>
          <b>{queueView === "queue" ? "현재 미발행 후보가 없습니다." : "조건에 맞는 발행 기록이 없습니다."}</b>
          <p>{queueView === "queue"
            ? "이미 쓴 후보를 반복하지 않고 최신 웹 조사로 새로운 사건과 단지를 찾아보세요."
            : "지역 또는 검색어를 바꾸면 이전 발행 소재를 다시 확인할 수 있습니다."}</p>
          {queueView === "queue"
            ? <button type="button" onClick={discoverAgain}>최신 후보 다시 조사</button>
            : <button type="button" onClick={clearFilters}>전체 보기</button>}
        </div> : matches.map((item) => {
          const published = isPublishedCandidate(item.id, publicationState);
          return <article key={item.id} className={published ? `${styles.card} ${styles.cardPublished}` : styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.region}>{item.region}</span>
              <div className={styles.statusGroup}>
                {published && <span className={styles.publishedBadge}>발행 완료</span>}
                <span className={styles.status}>{item.status}</span>
              </div>
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
            <div className={styles.cardActions}>
              <a className={styles.startButton}
                href={"/apartment-presale?candidate=" + encodeURIComponent(item.id) +
                  "&workId=" + encodeURIComponent("curated-" + item.id)}>
                {published ? "이 단지 다시 열기 →" : "이 단지 글 만들기 →"}
              </a>
              <button type="button"
                className={published ? styles.restoreButton : styles.completeButton}
                onClick={() => setCandidatePublished(item.id, !published)}>
                {published ? "↩ 미발행 큐로 복원" : "✓ 발행 완료 처리"}
              </button>
            </div>
          </article>;
        })}
      </section>

      <section className={styles.footerGuide}>
        <h2>이제 후보는 이렇게 관리됩니다</h2>
        <p>발행 완료 처리를 하면 후보를 삭제하지 않고 보관함으로 옮깁니다. 이후 최신 후보 조사 요청서에는 현재 보관된 소재가 자동으로 들어가 같은 사건을 다시 추천하지 않도록 합니다.</p>
        <p>단지 자체를 영구 차단하지는 않습니다. 같은 단지라도 새 모집공고·정정공고·무순위 또는 잔여세대·청약 경쟁률이나 당첨 결과·의미 있는 일정 변경처럼 독립된 새 사건이 생기면 다시 글감이 될 수 있습니다.</p>
        <p>공식공고 원문 또는 건설사 발표자료가 있으면 그 자료를 우선 사용하고, 전체 사업규모와 실제 이번 일반·신규 공급 물량을 분리합니다.</p>
      </section>
    </div>

    {notice && <div role="status" className={styles.notice}>
      {notice}<button type="button" aria-label="알림 닫기" onClick={() => setNotice("")}>×</button>
    </div>}
  </main>;
}
