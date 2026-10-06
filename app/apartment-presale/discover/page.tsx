"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PRESALE_BASELINE_PUBLISHED_IDS,
  PRESALE_CANDIDATE_SNAPSHOT_DATE,
  PRESALE_CANDIDATES,
  PRESALE_DISCOVERED_STORAGE_KEY,
  makePresaleDiscoveryPrompt,
} from "../../../lib/apartment-presale-candidates.mjs";
import type { PresaleCandidate, PresaleCandidateStage } from "../../../lib/apartment-presale-candidates.mjs";
import styles from "./page.module.css";

type FilterKey = "all" | PresaleCandidateStage;
type AreaKey = "전체" | "서울" | "경기" | "인천";
type QueueView = "queue" | "published";
type PublicationState = { published: string[]; restored: string[] };
type ResearchMeta = { checkedAt: string; summary: string; questions: string[] };

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
const RESEARCH_META_STORAGE_KEY = "content-maker-presale-discovery-meta-v1";
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

function isCandidate(value: unknown): value is PresaleCandidate {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.region === "string" &&
    ["서울", "경기", "인천"].includes(String(item.area)) &&
    ["planned", "later", "watch", "notice", "followup"].includes(String(item.stage)) &&
    typeof item.topic === "string" &&
    typeof item.sourceUrl === "string" &&
    typeof item.officialUrl === "string";
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

function loadDiscoveredCandidates() {
  try {
    const raw = window.localStorage.getItem(PRESALE_DISCOVERED_STORAGE_KEY);
    if (!raw) return [] as PresaleCandidate[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCandidate).slice(0, 240) : [];
  } catch {
    return [] as PresaleCandidate[];
  }
}

function saveDiscoveredCandidates(value: PresaleCandidate[]) {
  try {
    window.localStorage.setItem(PRESALE_DISCOVERED_STORAGE_KEY, JSON.stringify(value.slice(0, 240)));
  } catch {
    // Cards still remain in memory for this session.
  }
}

function loadResearchMeta(): ResearchMeta | null {
  try {
    const raw = window.localStorage.getItem(RESEARCH_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      checkedAt: typeof parsed?.checkedAt === "string" ? parsed.checkedAt : "",
      summary: typeof parsed?.summary === "string" ? parsed.summary : "",
      questions: Array.isArray(parsed?.questions)
        ? parsed.questions.filter((item: unknown): item is string => typeof item === "string").slice(0, 12)
        : [],
    };
  } catch {
    return null;
  }
}

function saveResearchMeta(value: ResearchMeta) {
  try {
    window.localStorage.setItem(RESEARCH_META_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Optional display metadata only.
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
  const [discoveredCandidates, setDiscoveredCandidates] = useState<PresaleCandidate[]>([]);
  const [researchMeta, setResearchMeta] = useState<ResearchMeta | null>(null);
  const [researching, setResearching] = useState(false);
  const [today, setToday] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setToday(localDate());
    setPublicationState(loadPublicationState());
    setDiscoveredCandidates(loadDiscoveredCandidates());
    setResearchMeta(loadResearchMeta());
  }, []);

  const allCandidates = useMemo(() => {
    const items = new Map<string, PresaleCandidate>();
    for (const item of PRESALE_CANDIDATES) items.set(item.id, item);
    for (const item of discoveredCandidates) if (!items.has(item.id)) items.set(item.id, item);
    return Array.from(items.values());
  }, [discoveredCandidates]);

  const publishedCandidates = useMemo(
    () => allCandidates.filter((item) => isPublishedCandidate(item.id, publicationState)),
    [allCandidates, publicationState],
  );
  const queueCandidates = useMemo(
    () => allCandidates.filter((item) => !isPublishedCandidate(item.id, publicationState)),
    [allCandidates, publicationState],
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

  async function autoDiscover() {
    if (researching) return;
    setResearching(true);
    setNotice("공식자료와 최신 웹 자료를 검색하고 있습니다…");
    try {
      const response = await fetch("/api/apartment-presale/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKey: today || localDate(),
          existingIds: allCandidates.map((item) => item.id),
          publishedCandidates: publishedCandidates.map((item) => ({
            name: item.name, region: item.region, status: item.status, topic: item.topic,
          })),
          existingCandidates: allCandidates.map((item) => ({
            name: item.name, region: item.region, status: item.status, topic: item.topic,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "자동 조사에 실패했습니다.");

      const incoming = Array.isArray(data?.candidates)
        ? data.candidates.filter(isCandidate) as PresaleCandidate[]
        : [];
      let added = 0;
      setDiscoveredCandidates((prev) => {
        const known = new Set([...PRESALE_CANDIDATES, ...prev].map((item) => item.id));
        const next = [...prev];
        for (const item of incoming) {
          if (known.has(item.id)) continue;
          known.add(item.id);
          next.unshift(item);
          added += 1;
        }
        saveDiscoveredCandidates(next);
        return next;
      });

      const meta: ResearchMeta = {
        checkedAt: typeof data?.checkedAt === "string" ? data.checkedAt : (today || localDate()),
        summary: typeof data?.summary === "string" ? data.summary : "",
        questions: Array.isArray(data?.questions)
          ? data.questions.filter((item: unknown): item is string => typeof item === "string").slice(0, 12)
          : [],
      };
      setResearchMeta(meta);
      saveResearchMeta(meta);
      setQueueView("queue");
      clearFilters();
      setNotice(added > 0
        ? "새 분양 소재 " + added + "개를 미발행 큐에 자동 추가했습니다."
        : "새 사건으로 확인된 미발행 후보가 없습니다. 기존 카드와 발행 이력을 유지합니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "자동 조사 중 오류가 발생했습니다.");
    } finally {
      setResearching(false);
    }
  }

  function openChatGptResearch() {
    const encoded = encodeURIComponent(researchPrompt);
    if (encoded.length <= 5000) {
      window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
      setNotice("수동 검토용 최신 후보 조사 요청서를 새 ChatGPT 대화에서 열었습니다.");
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
      ? "발행 완료로 보관했습니다. 앞으로 자동 조사에서도 같은 사건은 제외됩니다."
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
      <h1>새 분양을 직접 찾고,<br/>미발행 큐에 바로 넣습니다.</h1>
      <p>사이트 안에서 최신 웹 검색을 실행해 공식 공고와 사업주체 자료를 우선 확인합니다. 이미 발행한 같은 사건은 제외하고, 새 공고·재공급·일정 변경처럼 새 글감만 카드로 추가합니다.</p>
      <div className={styles.heroActions}>
        <button type="button" className={styles.whiteButton} disabled={researching} onClick={() => void autoDiscover()}>
          {researching ? "🔎 공식자료 검색 중…" : "🔎 최신 후보 자동 조사"}
        </button>
        <button type="button" className={styles.ghostButton} onClick={openChatGptResearch}>ChatGPT에서 수동 조사 ↗</button>
        <button type="button" className={styles.ghostButton} onClick={() => void copyResearch()}>요청서 복사</button>
      </div>
    </section>

    <div className={styles.pageInner}>
      <section className={styles.snapshot}>
        <div>
          <small>기본 조사 스냅샷</small>
          <strong>{PRESALE_CANDIDATE_SNAPSHOT_DATE.replace(/-/g, ".")}</strong>
          <span>{researchMeta?.checkedAt
            ? "마지막 자동 조사 " + researchMeta.checkedAt.replace(/-/g, ".")
            : "기존 후보는 삭제하지 않고 발행완료 보관함에 남깁니다."}</span>
        </div>
        <div className={styles.snapshotNumbers}>
          <b>{queueCandidates.length}<small>미발행 큐</small></b>
          <b>{publishedCandidates.length}<small>발행 완료</small></b>
          <b>{allCandidates.length}<small>전체 기록</small></b>
        </div>
      </section>

      <p className={styles.sourceWarning}>
        {queueCandidates.length === 0
          ? "현재 미발행 후보가 없습니다. 상단의 ‘최신 후보 자동 조사’를 누르면 발행 이력과 기존 카드를 제외한 새 사건을 웹에서 직접 찾아 카드로 추가합니다."
          : "자동 조사 카드도 최종 발행 전에는 제작실에서 최신 공식 모집공고·정정공고와 가격·물량을 다시 교차확인하세요. 카드 자체가 청약 권유나 확정 공고를 대신하지 않습니다."}
      </p>

      {researchMeta && (researchMeta.summary || researchMeta.questions.length > 0) &&
        <section className={styles.researchBox}>
          <div>
            <small>최근 자동 조사 · {researchMeta.checkedAt || "날짜 미상"}</small>
            <h2>이번 조사 요약</h2>
            {researchMeta.summary && <p>{researchMeta.summary}</p>}
          </div>
          {researchMeta.questions.length > 0 && <div className={styles.researchQuestions}>
            <b>다음 공식 공고에서 다시 볼 질문</b>
            {researchMeta.questions.map((item, index) => <p key={index}>• {item}</p>)}
          </div>}
        </section>}

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
            ? "자동 조사를 실행하면 공식자료를 우선 검색한 새 후보만 이곳에 추가됩니다."
            : "지역 또는 검색어를 바꾸면 이전 발행 소재를 다시 확인할 수 있습니다."}</p>
          {queueView === "queue"
            ? <button type="button" disabled={researching} onClick={() => void autoDiscover()}>
                {researching ? "조사 중…" : "최신 후보 자동 조사"}
              </button>
            : <button type="button" onClick={clearFilters}>전체 보기</button>}
        </div> : matches.map((item) => {
          const published = isPublishedCandidate(item.id, publicationState);
          const live = item.id.startsWith("live-");
          return <article key={item.id} className={published ? `${styles.card} ${styles.cardPublished}` : styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.region}>{item.region}</span>
              <div className={styles.statusGroup}>
                {live && <span className={styles.liveBadge}>자동 조사</span>}
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
        <h2>자동 조사 → 제작 → 발행완료</h2>
        <p>‘최신 후보 자동 조사’를 누르면 웹 검색을 실행하고, 이미 발행한 같은 사건과 기존 카드를 제외한 후보만 브라우저의 미발행 큐에 저장합니다.</p>
        <p>새 카드의 ‘이 단지 글 만들기’를 누르면 자동 조사 당시의 근거 URL·공급 메모·킥이 분양정보 제작실의 조사 출발점으로 넘어갑니다. 제작이 끝나면 ‘발행 완료 처리’를 눌러 다음 자동 조사에서 같은 사건이 다시 나오지 않게 합니다.</p>
        <p>단지 자체를 영구 차단하지는 않습니다. 새 모집공고·정정공고·무순위·잔여세대·청약결과·의미 있는 일정 변경은 같은 단지라도 새로운 사건으로 다시 후보화할 수 있습니다.</p>
      </section>
    </div>

    {notice && <div role="status" className={styles.notice}>
      {notice}<button type="button" aria-label="알림 닫기" onClick={() => setNotice("")}>×</button>
    </div>}
  </main>;
}
