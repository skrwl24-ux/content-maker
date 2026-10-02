"use client";

import { useEffect, useMemo, useState } from "react";
import { makeApartmentV3PlanningPrompt, parseApartmentStoryResearch } from "../../lib/apartment-story.mjs";
import type { ApartmentStoryCandidate, ApartmentStoryMode, ApartmentStoryVisualMode } from "../../lib/apartment-story.mjs";
import styles from "./page.module.css";

type PlannerStatus = "idle" | "review" | "skipped";
type EditableField = "editedTopic" | "editedFacts" | "editedBridge" | "editedVisualFacts" |
  "editedDiscovery" | "editedPlaceName" | "editedAccessInfo" | "editedAccessSourceUrl" | "editedStoryDraft" | "visualMode";
type PlanningSnapshot = {
  identity: string;
  raw: string;
  candidates: ApartmentStoryCandidate[];
  selectedId: string;
  verified: boolean;
  verifiedAt?: string;
  status: PlannerStatus;
  editedTopic: string;
  editedFacts: string;
  editedBridge: string;
  editedVisualFacts: string;
  editedDiscovery: string;
  editedPlaceName: string;
  editedAccessInfo: string;
  editedAccessSourceUrl: string;
  editedStoryDraft: string;
  visualMode: ApartmentStoryVisualMode;
};
type TopicHistory = {
  identity: string; topic: string; date: string;
  region?: string; placeName?: string; sourceDate?: string; sourceUrl?: string;
};
export type PlanningInput = {
  mode: ApartmentStoryMode;
  subjectKey: string;
  name: string;
  region: string;
  dataSummary: string;
};

const STORAGE_PREFIX = "apartment-story-planner-v3:"; // Existing V3 drafts remain accessible.
const HISTORY_KEY = "apartment-story-topic-history-v3";
const VISUAL_CHOICES: Array<{ id: ApartmentStoryVisualMode; label: string }> = [
  { id: "map-hybrid", label: "지도 + 스토리 정보 (기본 60:40)" },
  { id: "photo-info", label: "사용권 확인 사진 + 정보" },
  { id: "timeline", label: "사업·일정 타임라인" },
  { id: "data-card", label: "검증 데이터·정보 인포그래픽" },
];
const identityFor = (input: PlanningInput) => input.mode + ":" + input.subjectKey;
const empty = (identity: string): PlanningSnapshot => ({
  identity, raw: "", candidates: [], selectedId: "", verified: false,
  status: "idle", editedTopic: "", editedFacts: "", editedBridge: "",
  editedVisualFacts: "", editedDiscovery: "", editedPlaceName: "",
  editedAccessInfo: "", editedAccessSourceUrl: "", editedStoryDraft: "", visualMode: "map-hybrid",
});
const readHistory = (): TopicHistory[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.identity === "string" && typeof item.topic === "string").slice(-30);
  } catch { return []; }
};
const cleaned = (value: string | undefined) => (value || "").trim();
const isHttps = (value: string) => {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes("."); }
  catch { return false; }
};
function candidateEdits(candidate: ApartmentStoryCandidate) {
  return {
    editedTopic: candidate.topic || candidate.title,
    editedFacts: candidate.facts,
    editedBridge: candidate.bridge,
    editedVisualFacts: candidate.visualFacts || candidate.facts,
    editedDiscovery: candidate.discovery || candidate.kick || candidate.facts,
    editedPlaceName: candidate.placeName || "",
    editedAccessInfo: candidate.accessInfo || "",
    editedAccessSourceUrl: candidate.accessSourceUrl || "",
    editedStoryDraft: candidate.storyDraft || "",
    visualMode: candidate.visualMode || ("map-hybrid" as ApartmentStoryVisualMode),
  };
}

export function useApartmentStoryPlanner(input: PlanningInput) {
  const identity = identityFor(input);
  const [snapshot, setSnapshot] = useState<PlanningSnapshot>(() => empty(identity));
  const [history, setHistory] = useState<TopicHistory[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + identity) || "null");
      if (saved?.identity === identity && Array.isArray(saved.candidates)) {
        // Migrate previous V3 state without discarding the user's approved research.
        const old = saved.candidates.find((item: ApartmentStoryCandidate) => item.id === saved.selectedId);
        const defaults = old ? candidateEdits(old) : {};
        setSnapshot({ ...empty(identity), ...defaults, ...saved });
      } else {
        setSnapshot(empty(identity));
      }
    } catch {
      setSnapshot(empty(identity));
    }
    setHistory(readHistory());
    setMessage("");
  }, [identity]);

  const current = snapshot.identity === identity ? snapshot : empty(identity);
  const chosen = current.candidates.find(item => item.id === current.selectedId) || null;
  const approved = useMemo<ApartmentStoryCandidate | null>(() => chosen && current.verified
    ? {
        ...chosen,
        topic: cleaned(current.editedTopic) || chosen.topic || chosen.title,
        facts: cleaned(current.editedFacts) || chosen.facts,
        bridge: cleaned(current.editedBridge) || chosen.bridge,
        visualMode: current.visualMode || chosen.visualMode,
        visualFacts: cleaned(current.editedVisualFacts) || chosen.visualFacts || chosen.facts,
        discovery: cleaned(current.editedDiscovery) || chosen.discovery || chosen.kick,
        placeName: cleaned(current.editedPlaceName) || chosen.placeName || "",
        accessInfo: cleaned(current.editedAccessInfo) || chosen.accessInfo || "",
        accessSourceUrl: isHttps(cleaned(current.editedAccessSourceUrl)) ? cleaned(current.editedAccessSourceUrl) : "",
        storyDraft: cleaned(current.editedStoryDraft) || chosen.storyDraft || "",
      }
    : null, [chosen, current]);
  const recentTopics = history.filter(item => item.identity !== identity).slice(-8).map(item => item.topic);
  const regionKey = input.region.trim().split(/\s+/).slice(0, 2).join(" ");
  const regionalHints = history.filter(item => (
    item.identity !== identity && item.region && regionKey &&
    (item.region.includes(regionKey) || regionKey.includes(item.region.split(/\s+/).slice(0, 2).join(" ")))
  )).slice(-5).map(item =>
    [item.placeName || item.topic, "기록일 " + item.date, item.sourceDate ? "자료일 " + item.sourceDate : "", item.sourceUrl || ""]
      .filter(Boolean).join(" · ")
  );

  function update(next: PlanningSnapshot) {
    setSnapshot(next);
    try { window.localStorage.setItem(STORAGE_PREFIX + identity, JSON.stringify(next)); }
    catch { setMessage("저장 공간이 부족할 수 있습니다. 조사 결과는 별도로 복사해 두세요."); }
  }
  function setRaw(raw: string) {
    if (/\[\/STORY_JSON\]/i.test(raw)) {
      try {
        const candidates = parseApartmentStoryResearch(raw);
        const selected = candidates[0] || null; // Recommended first choice saves one selection step.
        update({
          ...empty(identity), raw, candidates, selectedId: selected?.id || "",
          ...(selected ? candidateEdits(selected) : {}),
          status: selected ? "review" : "skipped",
        });
        setMessage(selected
          ? "추천안 1개를 먼저 펼쳤습니다. 내용·출처만 확인하면 바로 승인할 수 있어요."
          : "적합한 후보가 없어 기존 데이터 중심으로 진행합니다.");
        return;
      } catch { /* Allow the editor to use manual import for incomplete/broken GPT output. */ }
    }
    update({ ...current, raw, candidates: [], selectedId: "", verified: false, verifiedAt: undefined, status: "idle" });
    setMessage("");
  }
  function importResults() {
    try {
      const candidates = parseApartmentStoryResearch(current.raw);
      const selected = candidates[0] || null;
      update({
        ...empty(identity), raw: current.raw, candidates, selectedId: selected?.id || "",
        ...(selected ? candidateEdits(selected) : {}),
        status: selected ? "review" : "skipped",
      });
      setMessage(selected
        ? "가장 먼저 추천된 이야기를 자동 선택했습니다. 원문·장소·생활권 연결 확인 후 승인하세요."
        : "적합한 소재가 없습니다. 기존 데이터 분석글로 진행합니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "조사 결과를 인식하지 못했습니다.");
    }
  }
  function select(id: string) {
    const candidate = current.candidates.find(item => item.id === id);
    if (!candidate) return;
    update({
      ...current, ...candidateEdits(candidate), selectedId: id,
      verified: false, verifiedAt: undefined, status: "review",
    });
    setMessage("다른 소재로 변경했습니다. 출처 확인 후 승인해 주세요.");
  }
  function edit(values: Partial<Pick<PlanningSnapshot, EditableField>>) {
    update({ ...current, ...values, verified: false, verifiedAt: undefined });
    setMessage("사실 카드를 수정했습니다. 이전 승인을 해제했으니 원문 확인 후 다시 승인해 주세요.");
  }
  function approve(verified: boolean) {
    if (!verified) {
      update({ ...current, verified: false, verifiedAt: undefined });
      setMessage("잠금을 해제했습니다. 기존 데이터 중심 요청서로 돌아갑니다.");
      return;
    }
    if (!chosen || !cleaned(current.editedTopic) || !cleaned(current.editedBridge) || !cleaned(current.editedFacts) || !cleaned(current.editedDiscovery)) {
      setMessage("중심 주제·생활 발견·확인 사실·전환 문장이 모두 있어야 승인할 수 있습니다.");
      return;
    }
    if (cleaned(current.editedAccessSourceUrl) && !isHttps(current.editedAccessSourceUrl)) {
      setMessage("이동거리·시간 근거 주소는 실제 HTTPS 원문으로 입력하거나 빈칸으로 남겨 주세요.");
      return;
    }
    const now = new Date().toISOString();
    update({ ...current, verified: true, verifiedAt: now });
    const all = readHistory();
    const next = [
      ...all.filter(item => item.identity !== identity),
      {
        identity, topic: cleaned(current.editedTopic), date: now.slice(0, 10),
        region: input.region, placeName: cleaned(current.editedPlaceName),
        sourceDate: chosen.sourceDate, sourceUrl: chosen.sourceUrl,
      },
    ].slice(-30);
    setHistory(next);
    try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    setMessage("✓ 생활 발견 카드 잠금 완료. 본문·썸네일·03번 이미지는 이제 이 사실 카드 하나만 참조합니다.");
  }
  function skip() {
    update({ ...current, selectedId: "", verified: false, verifiedAt: undefined, status: "skipped" });
    setMessage("이번 글은 스토리를 생략하고 기존 데이터 분석 방식으로 진행합니다.");
  }

  return {
    identity, current, chosen, approved, recentTopics, regionalHints, message,
    setMessage, setRaw, importResults, select, edit, approve, skip,
    handled: current.status !== "idle",
  };
}
export type ApartmentStoryPlanner = ReturnType<typeof useApartmentStoryPlanner>;

export default function StoryPlanningPanel({
  input, planner,
}: { input: PlanningInput; planner: ApartmentStoryPlanner }) {
  const [copied, setCopied] = useState(false);
  const researchPrompt = useMemo(() => makeApartmentV3PlanningPrompt({
    mode: input.mode, name: input.name, region: input.region, dataSummary: input.dataSummary,
    previousTopics: planner.recentTopics.join(" / "),
    regionalHints: planner.regionalHints.join("\n"),
  }), [input.mode, input.name, input.region, input.dataSummary, planner.recentTopics.join(" / "), planner.regionalHints.join(" / ")]);
  const current = planner.current;
  const chosen = planner.chosen;
  const recentDuplicate = chosen && planner.recentTopics.some(topic => {
    const a = topic.replace(/\s+/g, "");
    const b = (current.editedTopic || chosen.topic || "").replace(/\s+/g, "");
    return b.length >= 7 && (a.includes(b) || b.includes(a));
  });
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(researchPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      planner.setMessage("복사에 실패했습니다. 클립보드 권한을 확인해 주세요.");
    }
  }
  return (
    <section className={styles.storyPanel}>
      <div className={styles.storyHeader}>
        <div>
          <p className={styles.eyebrow}>FAST PUBLISH V3.1 · 오늘의 생활 발견</p>
          <h2>가격에서 시작해 생활로 이어지는 글</h2>
          <span>성심당 같은 지역 대표 명소, 카페·맛집, 공원·통학·문화생활 등 이 단지에 살면서 누릴 수 있는 실제 생활 장면을 한 개만 고릅니다.</span>
        </div>
        <span className={styles.storyStatus}>{planner.approved ? "사실 카드 잠김" : current.status === "skipped" ? "데이터형" : "기획 단계"}</span>
      </div>
      <div className={styles.storyActions}>
        <button type="button" disabled={!input.name.trim() || !input.region.trim()} onClick={() =>
          window.open("https://chatgpt.com/?q=" + encodeURIComponent(researchPrompt), "_blank", "noopener,noreferrer")
        }>1. 생활 스토리 통합 조사</button>
        <button type="button" disabled={!input.name.trim() || !input.region.trim()} onClick={() => void copyPrompt()}>
          {copied ? "✓ 복사됨" : "조사 요청서 복사"}
        </button>
      </div>
      {!!planner.regionalHints.length && (
        <p className={styles.storyFootnote}>같은 지역의 이전 조사 단서 {planner.regionalHints.length}건을 요청서에 참고용으로 추가했습니다. 운영 여부·거리·날짜는 다시 확인하도록 지시합니다.</p>
      )}
      <label className={styles.workField}>
        <span>2. 조사 결과 붙여넣기 · 완성된 STORY_JSON은 자동 불러오기</span>
        <textarea
          className={styles.storyTextarea}
          value={current.raw}
          onChange={event => planner.setRaw(event.target.value)}
          placeholder="ChatGPT 조사 결과를 통째로 붙여넣으세요. 정상적인 STORY_JSON이면 추천 첫 번째 후보가 바로 나타납니다."
        />
      </label>
      <div className={styles.storyActions}>
        <button type="button" disabled={!current.raw.trim()} onClick={planner.importResults}>수동으로 결과 불러오기</button>
        <button type="button" onClick={planner.skip}>스토리 생략 · 데이터형으로 진행</button>
      </div>
      {planner.message && <p className={styles.storyNotice} role="status">{planner.message}</p>}

      {chosen && (
        <div className={styles.storyPreview}>
          <div className={styles.storyV31Header}>
            <b>오늘의 생활 발견 · 추천 주제</b>
            <span>{planner.approved ? "🔒 승인된 사실 원본" : "원문 확인 전"}</span>
          </div>
          <h3>{current.editedTopic || chosen.title}</h3>
          <p className={styles.storyV31Discovery}>{current.editedDiscovery || chosen.discovery || chosen.kick}</p>
          <div className={styles.storyV31Facts}>
            <p><b>장소/지점</b> {current.editedPlaceName || "특정 장소 없이 지역의 생활 질문을 다룹니다."}</p>
            <p><b>접근성</b> {current.editedAccessInfo || "거리·시간 미확인: 실제 경로 확인 전까지 숫자 생략"}</p>
            <p><b>검증 사실</b> {current.editedFacts || chosen.facts}</p>
            <p><b>입지 연결</b> {chosen.connection}</p>
            <p><b>본문 전환</b> {current.editedBridge || chosen.bridge}</p>
          </div>
          {recentDuplicate && <p className={styles.storyNotice}>최근 다른 작업과 주제가 비슷합니다. 소재 중복을 확인해 주세요.</p>}
          <a className={styles.storyV31Link} href={chosen.sourceUrl} target="_blank" rel="noopener noreferrer">
            확인할 원문 ↗ {chosen.sourceTitle || chosen.sourceUrl} · 자료일 {chosen.sourceDate || "불명"}
          </a>
          {current.editedAccessSourceUrl && (
            <a className={styles.storyV31Link} href={current.editedAccessSourceUrl} target="_blank" rel="noopener noreferrer">이동 경로 근거 열기 ↗</a>
          )}
          <details className={styles.advancedDetails}>
            <summary>중심 주제·확인 사실·거리·문장·03번 이미지 형식 수정</summary>
            <div className={styles.advancedBody}>
              {([
                ["editedTopic", "중심 주제"],
                ["editedDiscovery", "독자가 얻는 오늘의 생활 발견 한 문장"],
                ["editedPlaceName", "정확한 장소명·본점/지점 (없으면 비워두기)"],
                ["editedAccessInfo", "검증된 실제 거리·이동 정보 (미확인이면 비우기)"],
                ["editedAccessSourceUrl", "이동 정보 확인 원문 HTTPS 주소 (없으면 비우기)"],
                ["editedFacts", "확인된 구체 사실 · 이 내용이 본문과 이미지의 원본"],
                ["editedBridge", "가격 분석에서 생활 이야기로 연결할 전환 문장"],
                ["editedStoryDraft", "생활 스토리 3~5문장 초안 · 실제 본문에서 자연스럽게 재작성"],
                ["editedVisualFacts", "03번 이미지에 표시할 검증된 정보"],
              ] as Array<[Exclude<EditableField, "visualMode">, string]>).map(([key, label]) => (
                <label key={key} className={styles.workField}>
                  <span>{label}</span>
                  {key === "editedPlaceName" || key === "editedTopic" || key === "editedAccessSourceUrl"
                    ? <input value={current[key] || ""} onChange={event => planner.edit({ [key]: event.target.value })} />
                    : <textarea value={current[key] || ""} onChange={event => planner.edit({ [key]: event.target.value })} />}
                </label>
              ))}
              <label className={styles.workField}>
                <span>03번 스토리 비주얼 형식</span>
                <select value={current.visualMode} onChange={event => planner.edit({ visualMode: event.target.value as ApartmentStoryVisualMode })}>
                  {VISUAL_CHOICES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
          </details>
          <label className={styles.storyConfirm}>
            <input type="checkbox" checked={current.verified} onChange={event => planner.approve(event.target.checked)} />
            출처·날짜·실제 생활권 연결을 확인했고, 거리·시간이 있다면 경로 근거도 확인했습니다. 위 사실 카드를 잠급니다.
          </label>
          <p className={styles.storyResult}>{planner.approved
            ? "✓ 잠금 완료 · 이후 문장을 수정하면 자동으로 승인이 풀립니다. 본문/썸네일/스토리 이미지에서 같은 사실 카드를 사용합니다."
            : "승인하기 전에는 기존의 데이터 중심 제작 기능을 그대로 사용할 수 있습니다."}</p>
        </div>
      )}
      {!!current.candidates.length && (
        <details className={styles.advancedDetails}>
          <summary>다른 스토리 후보 보기 ({current.candidates.length}개)</summary>
          <div className={styles.advancedBody}>
            <div className={styles.storyCandidates}>
              {current.candidates.map((item, index) => (
                <label key={item.id} className={current.selectedId === item.id ? styles.storyCandidateSelected : styles.storyCandidate}>
                  <input type="radio" name={"story-planner-" + planner.identity}
                    checked={current.selectedId === item.id} onChange={() => planner.select(item.id)} />
                  <div>
                    <strong>{index + 1}. {item.topic || item.title}</strong>
                    <p>{item.discovery || item.kick || item.facts}</p>
                    <small>{item.sourceTitle} · {item.sourceDate} · {item.timing}</small>
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>원문 열기 ↗</a>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </details>
      )}
      <p className={styles.storyFootnote}>일부 카페 의견은 탐색 단서일 뿐 주민 전체의 평가가 아닙니다. 도시 대표 명소는 가까운 시설처럼 소개하지 않고, 경로 근거가 없으면 이동 수치를 본문에 넣지 않습니다.</p>
    </section>
  );
}
