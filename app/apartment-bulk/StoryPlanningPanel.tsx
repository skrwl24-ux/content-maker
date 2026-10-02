"use client";

import { useEffect, useMemo, useState } from "react";
import { makeApartmentV3PlanningPrompt, parseApartmentStoryResearch } from "../../lib/apartment-story.mjs";
import type { ApartmentStoryCandidate, ApartmentStoryMode, ApartmentStoryVisualMode } from "../../lib/apartment-story.mjs";
import styles from "./page.module.css";

type PlannerStatus = "idle" | "review" | "skipped";
type PlanningSnapshot = {
  identity: string;
  raw: string;
  candidates: ApartmentStoryCandidate[];
  selectedId: string;
  verified: boolean;
  status: PlannerStatus;
  editedTopic: string;
  editedBridge: string;
  editedVisualFacts: string;
  visualMode: ApartmentStoryVisualMode;
};
type TopicHistory = { identity: string; topic: string; date: string };
export type PlanningInput = {
  mode: ApartmentStoryMode;
  subjectKey: string;
  name: string;
  region: string;
  dataSummary: string;
};

const STORAGE_PREFIX = "apartment-story-planner-v3:";
const HISTORY_KEY = "apartment-story-topic-history-v3";
const VISUAL_CHOICES: Array<{ id: ApartmentStoryVisualMode; label: string }> = [
  { id: "map-hybrid", label: "지도 + 스토리 정보 (기본 60:40)" },
  { id: "photo-info", label: "사용권 확인 사진 + 정보" },
  { id: "timeline", label: "사업·일정 타임라인" },
  { id: "data-card", label: "근거 기반 비교·정보 인포그래픽" },
];
const identityFor = (input: PlanningInput) => input.mode + ":" + input.subjectKey;
const empty = (identity: string): PlanningSnapshot => ({
  identity, raw: "", candidates: [], selectedId: "", verified: false,
  status: "idle", editedTopic: "", editedBridge: "", editedVisualFacts: "", visualMode: "map-hybrid",
});
const readHistory = (): TopicHistory[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.identity === "string" && typeof item.topic === "string").slice(-20);
  } catch { return []; }
};

export function useApartmentStoryPlanner(input: PlanningInput) {
  const identity = identityFor(input);
  const [snapshot, setSnapshot] = useState<PlanningSnapshot>(() => empty(identity));
  const [history, setHistory] = useState<TopicHistory[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + identity) || "null");
      setSnapshot(saved?.identity === identity && Array.isArray(saved.candidates) ? saved : empty(identity));
    } catch {
      setSnapshot(empty(identity));
    }
    setHistory(readHistory());
    setMessage("");
  }, [identity]);

  const current = snapshot.identity === identity ? snapshot : empty(identity);
  const chosen = current.candidates.find(item => item.id === current.selectedId) || null;
  const approved: ApartmentStoryCandidate | null = chosen && current.verified
    ? {
        ...chosen,
        topic: current.editedTopic.trim() || chosen.topic || chosen.title,
        bridge: current.editedBridge.trim() || chosen.bridge,
        visualMode: current.visualMode,
        visualFacts: current.editedVisualFacts.trim() || chosen.visualFacts || chosen.facts,
      }
    : null;
  const recentTopics = history.filter(item => item.identity !== identity).slice(-8).map(item => item.topic);

  function update(next: PlanningSnapshot) {
    setSnapshot(next);
    try { window.localStorage.setItem(STORAGE_PREFIX + identity, JSON.stringify(next)); } catch {
      setMessage("저장 공간이 부족할 수 있습니다. 필요한 결과는 별도 복사해 두세요.");
    }
  }
  function setRaw(raw: string) {
    update({ ...current, raw, candidates: [], selectedId: "", verified: false, status: "idle" });
    setMessage("");
  }
  function importResults() {
    try {
      const candidates = parseApartmentStoryResearch(current.raw);
      update({
        ...current, candidates, selectedId: "", verified: false,
        editedTopic: "", editedBridge: "", editedVisualFacts: "",
        status: candidates.length ? "review" : "skipped",
      });
      setMessage(candidates.length
        ? "후보 " + candidates.length + "개를 불러왔습니다. 원문·날짜·생활권 연결을 확인하고 하나만 승인해 주세요."
        : "적합한 후보가 없어 기존 데이터 중심의 글로 진행합니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "조사 결과를 인식하지 못했습니다.");
    }
  }
  function select(id: string) {
    const candidate = current.candidates.find(item => item.id === id);
    if (!candidate) return;
    update({
      ...current, selectedId: id, verified: false, status: "review",
      editedTopic: candidate.topic || candidate.title,
      editedBridge: candidate.bridge,
      editedVisualFacts: candidate.visualFacts || candidate.facts,
      visualMode: candidate.visualMode || "map-hybrid",
    });
  }
  function edit(values: Partial<Pick<PlanningSnapshot, "editedTopic" | "editedBridge" | "editedVisualFacts" | "visualMode">>) {
    update({ ...current, ...values, verified: false });
    setMessage("내용을 변경했습니다. 원문과 비교한 뒤 다시 승인해 주세요.");
  }
  function approve(verified: boolean) {
    if (!chosen || !current.editedTopic.trim() || !current.editedBridge.trim()) {
      setMessage("중심 주제와 전환 문장을 확인한 뒤 승인해 주세요.");
      return;
    }
    update({ ...current, verified });
    if (verified) {
      const all = readHistory();
      const next = [
        ...all.filter(item => item.identity !== identity),
        { identity, topic: current.editedTopic.trim(), date: new Date().toISOString().slice(0, 10) },
      ].slice(-20);
      setHistory(next);
      try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      setMessage("승인 완료. 이 중심 주제와 스토리 킥이 본문·썸네일·스토리 이미지 요청서에 함께 반영됩니다.");
    } else {
      setMessage("승인을 해제했습니다. 기존 데이터 중심 요청서로 돌아갑니다.");
    }
  }
  function skip() {
    update({ ...current, selectedId: "", verified: false, status: "skipped" });
    setMessage("이번 대상은 외부 스토리를 생략하고 기존 데이터 분석을 사용합니다.");
  }

  return {
    identity, current, chosen, approved, recentTopics, message,
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
  }), [input.mode, input.name, input.region, input.dataSummary, planner.recentTopics.join(" / ")]);
  const current = planner.current;
  const chosen = planner.chosen;
  const recentDuplicate = chosen && planner.recentTopics.some(topic => (
    topic.replace(/\s+/g, "").includes((current.editedTopic || chosen.topic).replace(/\s+/g, ""))
  ));

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(researchPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      planner.setMessage("조사 요청서를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  }

  return (
    <section className={styles.storyPanel}>
      <div className={styles.storyHeader}>
        <div>
          <p className={styles.eyebrow}>STORY PLANNER V3 · ALL APARTMENT FORMATS</p>
          <h2>AI 주제 · 스토리 킥 기획</h2>
          <span>본문을 만들기 전에 실제 데이터를 읽고, 네이버 지역 검색·공개 커뮤니티에서 발견한 질문을 검증해 이번 글의 방향부터 정합니다. 축제나 최신 뉴스는 필수가 아닙니다.</span>
        </div>
        <span className={styles.storyStatus}>{planner.approved ? "주제 승인 완료" : "선택 제작"}</span>
      </div>

      <div className={styles.storyActions}>
        <button type="button" onClick={() => window.open(
          "https://chatgpt.com/?q=" + encodeURIComponent(researchPrompt), "_blank", "noopener,noreferrer"
        )} disabled={!input.name.trim() || !input.region.trim()}>
          1. AI 주제·스토리 조사
        </button>
        <button type="button" onClick={() => void copyPrompt()} disabled={!input.name.trim() || !input.region.trim()}>
          {copied ? "✓ 요청서 복사됨" : "조사 요청서 복사"}
        </button>
      </div>
      <label className={styles.workField}>
        <span>2. ChatGPT 조사 결과 전체 붙여넣기 (STORY_JSON 포함)</span>
        <textarea
          className={styles.storyTextarea}
          value={current.raw}
          onChange={event => planner.setRaw(event.target.value)}
          placeholder="새 AI 기획 요청서의 [STORY_JSON] 전체를 붙여넣으세요. 기존 동네 조사 결과도 읽을 수 있습니다."
        />
      </label>
      <div className={styles.storyActions}>
        <button type="button" disabled={!current.raw.trim()} onClick={planner.importResults}>3. 후보 불러오기</button>
        <button type="button" onClick={planner.skip}>스토리 없이 기존 데이터형으로 진행</button>
      </div>
      {planner.message && <p className={styles.storyNotice} role="status">{planner.message}</p>}
      {!!current.candidates.length && (
        <div className={styles.storyCandidates}>
          <b>4. 중심 주제 선정 · 첫 번째 후보는 GPT의 제안이며 직접 변경 가능</b>
          {current.candidates.map((item, index) => (
            <label key={item.id} className={current.selectedId === item.id ? styles.storyCandidateSelected : styles.storyCandidate}>
              <input type="radio" name={"story-planner-" + planner.identity} checked={current.selectedId === item.id}
                onChange={() => planner.select(item.id)} />
              <div>
                <strong>{index + 1}. {item.topic || item.title}</strong>
                <p><b>검색에서 발견한 킥:</b> {item.kick || item.facts}</p>
                <p><b>단지와 연결되는 이유:</b> {item.connection}</p>
                <small>출처 발표일: {item.sourceDate || "확인 불가"} · 행사/사업일: {item.eventDate || "해당 없음"} · {item.timing || "시점 확인"}</small>
                {item.communityNote && item.communityNote !== "없음" && <small>공개 커뮤니티 탐색 단서: {item.communityNote}</small>}
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  원문 열기 ↗ {item.sourceTitle || item.sourceUrl}
                </a>
              </div>
            </label>
          ))}
        </div>
      )}

      {chosen && (
        <div className={styles.storyPreview}>
          <b>5. 글의 방향과 이미지까지 함께 확정</b>
          {recentDuplicate && <p className={styles.storyNotice}>비슷한 중심 주제가 최근 다른 작업에서 사용됐습니다. 소재 중복을 확인해 주세요.</p>}
          <label className={styles.workField}>
            <span>이번 글의 중심 주제</span>
            <input value={current.editedTopic} maxLength={140}
              onChange={event => planner.edit({ editedTopic: event.target.value })} />
          </label>
          <label className={styles.workField}>
            <span>가격·비교 데이터에서 동네 이야기로 넘어가는 전환 문장</span>
            <textarea value={current.editedBridge}
              onChange={event => planner.edit({ editedBridge: event.target.value })} />
          </label>
          <label className={styles.workField}>
            <span>03번 스토리 비주얼 형식 (일반 단지에서는 기존 입지 이미지 슬롯)</span>
            <select value={current.visualMode} onChange={event => planner.edit({
              visualMode: event.target.value as ApartmentStoryVisualMode,
            })}>
              {VISUAL_CHOICES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className={styles.workField}>
            <span>이미지에 사용할 검증된 정보 · 실제 위치/수치가 없으면 만들지 않기</span>
            <textarea value={current.editedVisualFacts}
              onChange={event => planner.edit({ editedVisualFacts: event.target.value })} />
          </label>
          <p>지도형은 정확한 지도·좌표 자료가 있을 때만 위치를 표시합니다. 자료가 없으면 거짓 지도를 만들지 않고 사실 중심의 풍부한 도식으로 전환합니다.</p>
          <label className={styles.storyConfirm}>
            <input type="checkbox" checked={current.verified} onChange={event => planner.approve(event.target.checked)} />
            원문 출처·실제 날짜·단지 및 생활권 연결·이미지에 표시할 사실을 직접 확인했습니다.
          </label>
          <p className={styles.storyResult}>{planner.approved
            ? "✓ 승인됨 — 본문·썸네일·마지막 스토리 이미지의 요청서에 함께 반영됩니다."
            : "승인 전에는 기존 실거래/비교 중심 요청서가 유지됩니다."}</p>
        </div>
      )}
      <p className={styles.storyFootnote}>조사·편집 자료만 브라우저에 작업별 저장됩니다. 타인 카페 글의 신상·댓글을 그대로 복제하거나 행사 때문에 가격이 움직였다고 단정하지 않습니다.</p>
    </section>
  );
}
