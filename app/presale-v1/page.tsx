"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { ensureAnonymousSession } from "../../lib/supabase-browser";
import {
  PROMPT_DEFINITIONS_V2,
  PresaleCandidateV2,
  PresaleDraftV2,
  PromptKeyV2,
  buildPromptV2,
  emptyPresaleDraftV2,
  fillPrompt,
  kickFound,
  safeJson,
} from "../../lib/presale-content-v2";
import { parsePresaleArticle } from "../../lib/apartment-presale.mjs";
import { plainPresaleArticle, richArticle } from "../../lib/presale-naver-export.mjs";

type TemplateRow = {
  id?: string;
  template_key: PromptKeyV2;
  name: string;
  template_text: string;
  is_active: boolean;
  reference_image_url?: string;
};

type CandidateApiResponse = {
  candidates?: PresaleCandidateV2[];
  error?: string;
};

const BATCH_KEY = "presale-v2-active-batch";
const DRAFT_PREFIX = "presale-v2-draft:";
const ALL_PROMPT_KEYS = Object.keys(PROMPT_DEFINITIONS_V2) as PromptKeyV2[];

function kstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + "-" + value.month + "-" + value.day;
}

function defaultTemplates() {
  return Object.fromEntries(ALL_PROMPT_KEYS.map((key) => [key, {
    template_key: key,
    name: PROMPT_DEFINITIONS_V2[key].name,
    template_text: PROMPT_DEFINITIONS_V2[key].text,
    is_active: true,
    reference_image_url: "",
  }])) as Record<PromptKeyV2, TemplateRow>;
}

function loadLocalDraft(candidate: PresaleCandidateV2) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + candidate.id);
    if (!raw) return emptyPresaleDraftV2(candidate);
    const parsed = JSON.parse(raw) as PresaleDraftV2;
    return { ...emptyPresaleDraftV2(candidate), ...parsed };
  } catch {
    return emptyPresaleDraftV2(candidate);
  }
}

function stripTextFence(value: string) {
  const text = String(value || "").trim();
  const match = text.match(/\x60\x60\x60(?:text)?\s*([\s\S]*?)\x60\x60\x60/i);
  return (match ? match[1] : text).trim();
}

export default function PresaleV2Page() {
  const supabaseRef = useRef<any>(null);
  const userIdRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [candidates, setCandidates] = useState<PresaleCandidateV2[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PresaleDraftV2>(() => emptyPresaleDraftV2());
  const [templates, setTemplates] = useState<Record<PromptKeyV2, TemplateRow>>(() => defaultTemplates());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptKeyV2>("PRESALE_QUEUE_10_V2");
  const [nextTenRaw, setNextTenRaw] = useState("");
  const [naverApplied, setNaverApplied] = useState(false);
  const referenceDate = kstDate();

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const loadTemplates = useCallback(async () => {
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    if (!supabase || !userId) return;
    const { data, error: loadError } = await supabase
      .from("apt_content_prompt_templates")
      .select("id,template_key,name,is_active,template_text,reference_image_url")
      .eq("user_id", userId)
      .in("template_key", ALL_PROMPT_KEYS);
    if (loadError) throw loadError;

    const existing = new Map((data || []).map((row: any) => [row.template_key, row]));
    const next = defaultTemplates();
    const missing: any[] = [];
    ALL_PROMPT_KEYS.forEach((key) => {
      const row = existing.get(key) as TemplateRow | undefined;
      if (row) next[key] = row;
      else missing.push({
        user_id: userId,
        template_key: key,
        name: PROMPT_DEFINITIONS_V2[key].name,
        template_text: PROMPT_DEFINITIONS_V2[key].text,
        is_active: true,
        reference_image_url: "",
      });
    });
    setTemplates(next);

    if (missing.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("apt_content_prompt_templates")
        .upsert(missing, { onConflict: "user_id,template_key" })
        .select("id,template_key,name,is_active,template_text,reference_image_url");
      if (insertError) throw insertError;
      if (inserted?.length) {
        setTemplates((current) => {
          const copy = { ...current };
          inserted.forEach((row: any) => { copy[row.template_key as PromptKeyV2] = row; });
          return copy;
        });
      }
    }
  }, []);

  const loadCandidates = useCallback(async (preferredIds?: string[]) => {
    const response = await fetch("/api/apartment-presale/discover", { cache: "no-store" });
    const payload = await response.json() as CandidateApiResponse;
    if (!response.ok && !payload.candidates) throw new Error(payload.error || "분양 후보를 불러오지 못했습니다.");
    const all = Array.isArray(payload.candidates) ? payload.candidates : [];
    setCandidates(all);

    let ids = preferredIds || [];
    if (!ids.length) {
      try {
        const stored = JSON.parse(localStorage.getItem(BATCH_KEY) || "[]");
        if (Array.isArray(stored)) ids = stored.filter((id) => typeof id === "string");
      } catch {}
    }
    const validIds = ids.filter((id) => all.some((item) => item.id === id));
    if (!validIds.length) {
      validIds.push(...all.filter((item) => item.publicationStatus === "queue").slice(0, 10).map((item) => item.id));
    }
    setBatchIds(validIds.slice(0, 10));
    localStorage.setItem(BATCH_KEY, JSON.stringify(validIds.slice(0, 10)));
    if (!selectedId || !validIds.includes(selectedId)) setSelectedId(validIds[0] || "");
  }, [selectedId]);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const { supabase, session } = await ensureAnonymousSession();
        if (disposed) return;
        supabaseRef.current = supabase;
        userIdRef.current = session.user.id;
        await Promise.all([loadTemplates(), loadCandidates()]);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : "분양 제작실을 불러오지 못했습니다.");
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => { disposed = true; };
  }, [loadCandidates, loadTemplates]);

  const batch = useMemo(() => batchIds
    .map((id) => candidates.find((item) => item.id === id))
    .filter((item): item is PresaleCandidateV2 => Boolean(item)), [batchIds, candidates]);

  const workspace = useMemo(() => candidates.find((item) => item.id === selectedId) || null, [candidates, selectedId]);
  const publishedCount = batch.filter((item) => item.publicationStatus === "published").length;
  const batchComplete = batch.length === 10 && publishedCount === 10;
  const priceReady = Boolean(safeJson(draft.priceRaw));
  const scheduleReady = Boolean(safeJson(draft.scheduleRaw));
  const compareReady = Boolean(safeJson(draft.compareRaw));
  const kickReady = Boolean(safeJson(draft.kickRaw));
  const hasKick = kickReady && kickFound(draft.kickRaw);
  const finalReady = priceReady && scheduleReady && compareReady && kickReady;

  useEffect(() => {
    if (!workspace) return;
    setDraft(loadLocalDraft(workspace));
    setNaverApplied(false);
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_PREFIX + workspace.id, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, workspace]);

  function updateDraft<K extends keyof PresaleDraftV2>(key: K, value: PresaleDraftV2[K]) {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
    setNaverApplied(false);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(label + " 복사 완료");
    } catch {
      setError("클립보드 복사에 실패했습니다.");
    }
  }

  function openInChatGPT(prompt: string) {
    const encoded = encodeURIComponent(prompt);
    if (encoded.length > 7000) {
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      void navigator.clipboard.writeText(prompt).then(() => notify("긴 요청서 복사 완료 · 열린 ChatGPT에서 Ctrl+V"));
      return;
    }
    window.open("https://chatgpt.com/?q=" + encoded, "_blank", "noopener,noreferrer");
  }

  function publishedBlock() {
    const published = candidates.filter((item) => item.publicationStatus === "published");
    return published.length
      ? published.map((item) => "- " + item.name + " · " + item.region + " · " + (item.status || "")).join("\n")
      : "없음";
  }

  function promptFor(key: PromptKeyV2) {
    const template = templates[key]?.template_text || PROMPT_DEFINITIONS_V2[key].text;
    const target = workspace || ({ id: "", name: "", region: "" } as PresaleCandidateV2);
    return buildPromptV2(key, template, target, draft, referenceDate, publishedBlock());
  }

  function validateRaw(value: string, label: string) {
    if (!safeJson(value)) {
      setError(label + " 결과가 유효한 JSON이 아닙니다. ChatGPT의 JSON 코드블록 전체를 붙여넣어 주세요.");
      return false;
    }
    setError("");
    notify(label + " 저장됨");
    return true;
  }

  async function saveTemplate() {
    const supabase = supabaseRef.current;
    const userId = userIdRef.current;
    if (!supabase || !userId) return;
    setBusy("template");
    try {
      const row = templates[selectedTemplate];
      const { data, error: saveError } = await supabase
        .from("apt_content_prompt_templates")
        .upsert({
          user_id: userId,
          template_key: selectedTemplate,
          name: PROMPT_DEFINITIONS_V2[selectedTemplate].name,
          template_text: row.template_text,
          is_active: true,
          reference_image_url: "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,template_key" })
        .select("id,template_key,name,is_active,template_text,reference_image_url")
        .single();
      if (saveError) throw saveError;
      setTemplates((current) => ({ ...current, [selectedTemplate]: data as TemplateRow }));
      notify("요청서 설정 저장 완료");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청서 저장 실패");
    } finally {
      setBusy("");
    }
  }

  async function importNextTen() {
    if (!batchComplete) {
      setError("현재 10개를 모두 발행한 뒤 다음 10개를 채울 수 있습니다.");
      return;
    }
    const parsed = safeJson(nextTenRaw);
    if (!parsed || !Array.isArray(parsed.candidates) || parsed.candidates.length !== 10) {
      setError("다음 후보 JSON에는 candidates가 정확히 10개 있어야 합니다.");
      return;
    }
    setBusy("import");
    try {
      const response = await fetch("/api/apartment-presale/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual-import", ...parsed }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "다음 10개 저장 실패");
      if (!Array.isArray(payload.candidates) || payload.candidates.length !== 10) {
        throw new Error("중복 또는 형식 오류로 10개가 모두 저장되지 않았습니다. 새 후보를 다시 조사해 주세요.");
      }
      const ids = payload.candidates.map((item: PresaleCandidateV2) => item.id);
      localStorage.setItem(BATCH_KEY, JSON.stringify(ids));
      setNextTenRaw("");
      await loadCandidates(ids);
      notify("새 분양 후보 10개 채우기 완료");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "다음 10개 저장 실패");
    } finally {
      setBusy("");
    }
  }

  async function markPublished() {
    if (!workspace) return;
    setBusy("publish");
    try {
      const response = await fetch("/api/apartment-presale/discover", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspace.id, publicationStatus: "published" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "발행 완료 저장 실패");
      setCandidates((current) => current.map((item) => item.id === workspace.id ? { ...item, publicationStatus: "published" } : item));
      notify("발행 완료 처리");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "발행 완료 저장 실패");
    } finally {
      setBusy("");
    }
  }

  async function copyNaver() {
    const body = stripTextFence(draft.finalRaw);
    if (!body) return;
    try {
      const blocks = parsePresaleArticle(body);
      const html = richArticle(blocks);
      const plain = plainPresaleArticle(blocks);
      if (navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        })]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      notify("네이버용 서식 복사 완료");
    } catch {
      await navigator.clipboard.writeText(body);
      notify("텍스트 원고 복사 완료");
    }
  }

  const previewHtml = useMemo(() => {
    if (!naverApplied || !draft.finalRaw.trim()) return "";
    try { return richArticle(parsePresaleArticle(stripTextFence(draft.finalRaw))); }
    catch { return ""; }
  }, [naverApplied, draft.finalRaw]);

  if (loading) return <main className={styles.page}><div className={styles.loading}>분양 제작실 불러오는 중…</div></main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <Link href="/" className={styles.back}>← 콘텐츠 메이커</Link>
        <h1>분양 글 제작실 V2</h1>
        <p>후보 10개 → 파트별 조사 → 이미지 → 최종 원고. 각 요청서는 자기 영역만 담당합니다.</p>
      </div>
      <div className={styles.headerActions}>
        <span className={styles.counter}>발행 {publishedCount} / {batch.length || 10}</span>
        <button onClick={() => setSettingsOpen((value) => !value)}>⚙ 요청서 설정</button>
      </div>
    </header>

    {toast && <div className={styles.toast}>{toast}</div>}
    {error && <div className={styles.error}>{error}<button onClick={() => setError("")}>×</button></div>}

    {settingsOpen && <section className={styles.settings}>
      <div className={styles.sectionHead}>
        <div><span>설정</span><h2>분양 요청서 관리</h2><p>한 번 수정하면 다음 제작부터 그대로 사용됩니다.</p></div>
        <button onClick={() => setSettingsOpen(false)}>닫기</button>
      </div>
      <div className={styles.settingsGrid}>
        <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value as PromptKeyV2)}>
          {ALL_PROMPT_KEYS.map((key) => <option key={key} value={key}>{PROMPT_DEFINITIONS_V2[key].name}</option>)}
        </select>
        <p>{PROMPT_DEFINITIONS_V2[selectedTemplate].description}</p>
        <textarea
          value={templates[selectedTemplate]?.template_text || ""}
          onChange={(event) => setTemplates((current) => ({
            ...current,
            [selectedTemplate]: { ...current[selectedTemplate], template_text: event.target.value },
          }))}
        />
        <div className={styles.row}>
          <button className={styles.secondary} onClick={() => setTemplates((current) => ({
            ...current,
            [selectedTemplate]: { ...current[selectedTemplate], template_text: PROMPT_DEFINITIONS_V2[selectedTemplate].text },
          }))}>기본값 복원</button>
          <button className={styles.primary} disabled={busy === "template"} onClick={saveTemplate}>설정 저장</button>
        </div>
      </div>
    </section>}

    <section className={styles.queue}>
      <div className={styles.sectionHead}>
        <div>
          <span>현재 제작 큐</span>
          <h2>다음에 쓸 분양 후보 10개</h2>
          <p>10개를 모두 발행하면 새 10개를 조사해서 한 번에 교체합니다.</p>
        </div>
        <div className={styles.progressText}>{publishedCount}/{batch.length || 10} 발행</div>
      </div>
      <div className={styles.candidateGrid}>
        {batch.map((item, index) => <button
          key={item.id}
          className={[styles.candidate, item.id === selectedId ? styles.selected : "", item.publicationStatus === "published" ? styles.published : ""].join(" ")}
          onClick={() => setSelectedId(item.id)}
        >
          <span className={styles.slot}>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item.name}</strong>
          <small>{item.region}</small>
          <em>{item.publicationStatus === "published" ? "발행 완료" : item.status || "제작 대기"}</em>
        </button>)}
        {!batch.length && <div className={styles.empty}>현재 후보가 없습니다.</div>}
      </div>

      {batchComplete && <div className={styles.refill}>
        <h3>10개 모두 발행 완료 · 다음 10개 채우기</h3>
        <p>설정에 저장된 조사 요청서를 ChatGPT에 보내고, 답변 마지막 JSON을 그대로 붙여넣으세요.</p>
        <div className={styles.row}>
          <button onClick={() => copyText(fillPrompt(templates.PRESALE_QUEUE_10_V2.template_text, {
            REFERENCE_DATE: referenceDate,
            PUBLISHED_BLOCK: publishedBlock(),
          }), "다음 10개 조사 요청서")}>요청서 복사</button>
          <button className={styles.primary} onClick={() => openInChatGPT(fillPrompt(templates.PRESALE_QUEUE_10_V2.template_text, {
            REFERENCE_DATE: referenceDate,
            PUBLISHED_BLOCK: publishedBlock(),
          }))}>GPT 열기</button>
        </div>
        <textarea value={nextTenRaw} onChange={(event) => setNextTenRaw(event.target.value)} placeholder="ChatGPT 답변의 JSON 코드블록을 붙여넣기" />
        <button className={styles.primary} disabled={busy === "import"} onClick={importNextTen}>새 후보 10개 채우기</button>
      </div>}
    </section>

    {workspace && <section className={styles.workspace}>
      <div className={styles.workspaceTop}>
        <div>
          <span className={styles.eyebrow}>현재 작업</span>
          <h2>{workspace.name}</h2>
          <p>{workspace.region} · {workspace.status || "상태 미입력"}</p>
        </div>
        {workspace.publicationStatus === "published"
          ? <span className={styles.doneBadge}>발행 완료</span>
          : <button className={styles.publishButton} disabled={busy === "publish"} onClick={markPublished}>발행 완료 처리</button>}
      </div>

      <div className={styles.basicBox}>
        <strong>사이트 기본정보</strong>
        <div className={styles.basicGrid}>
          <span><b>전체 규모</b>{workspace.totalUnits ?? workspace.supply ?? "미입력"}</span>
          <span><b>일반분양</b>{workspace.generalSaleUnits ?? "미입력"}</span>
          <span><b>주요 면적</b>{workspace.exclusiveAreas?.length ? workspace.exclusiveAreas.join("·") + "㎡" : "미입력"}</span>
          <span><b>공고 상태</b>{workspace.noticeStatus || workspace.status || "미입력"}</span>
        </div>
        <label>최종 글 제목<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
      </div>

      <div className={styles.steps}>
        <ResearchCard
          no="1" title="분양가·평형 조사" description="타입·세대수·분양가·확장비·납부조건만 조사"
          ready={priceReady} value={draft.priceRaw}
          onChange={(value) => updateDraft("priceRaw", value)}
          onValidate={() => validateRaw(draft.priceRaw, "분양가·평형")}
          onCopy={() => copyText(promptFor("PRESALE_PRICE_V2"), "분양가·평형 요청서")}
          onOpen={() => openInChatGPT(promptFor("PRESALE_PRICE_V2"))}
        />
        <ResearchCard
          no="2" title="청약 일정·자격 조사" description="일정·지역우선·통장·전매·재당첨·거주의무"
          ready={scheduleReady} value={draft.scheduleRaw}
          onChange={(value) => updateDraft("scheduleRaw", value)}
          onValidate={() => validateRaw(draft.scheduleRaw, "청약 일정·자격")}
          onCopy={() => copyText(promptFor("PRESALE_SCHEDULE_V2"), "청약 일정·자격 요청서")}
          onOpen={() => openInChatGPT(promptFor("PRESALE_SCHEDULE_V2"))}
        />
        <ResearchCard
          no="3" title="주변 비교 조사" description="선행단지 1~2 → 최근 분양 1~3 → 주변 실거래 1~3"
          ready={compareReady} value={draft.compareRaw}
          onChange={(value) => updateDraft("compareRaw", value)}
          onValidate={() => validateRaw(draft.compareRaw, "주변 비교")}
          onCopy={() => copyText(promptFor("PRESALE_COMPARE_V2"), "주변 비교 요청서")}
          onOpen={() => openInChatGPT(promptFor("PRESALE_COMPARE_V2"))}
        />
        <ResearchCard
          no="4" title="핵심 킥 선정" description="앞 조사자료에서 가장 눈여겨볼 대표 특징 1개"
          ready={kickReady} value={draft.kickRaw}
          onChange={(value) => updateDraft("kickRaw", value)}
          onValidate={() => validateRaw(draft.kickRaw, "핵심 킥")}
          onCopy={() => copyText(promptFor("PRESALE_KICK_V2"), "핵심 킥 요청서")}
          onOpen={() => openInChatGPT(promptFor("PRESALE_KICK_V2"))}
          disabled={!priceReady || !scheduleReady || !compareReady}
        />
      </div>

      <section className={styles.imageSection}>
        <div className={styles.sectionHead}>
          <div><span>이미지</span><h2>본문 이미지 요청서</h2><p>조사자료를 다시 검색하지 않고 저장된 값만 시각화합니다.</p></div>
        </div>
        <div className={styles.imageGrid}>
          <ImageCard title="00 · 대표 썸네일" note="1254×1254" disabled={!draft.title.trim()}
            onCopy={() => copyText(promptFor("PRESALE_THUMBNAIL_V2"), "썸네일 요청서")}
            onOpen={() => openInChatGPT(promptFor("PRESALE_THUMBNAIL_V2"))} />
          <ImageCard title="01 · 분양가·평형" note="1600×900" disabled={!priceReady}
            onCopy={() => copyText(promptFor("PRESALE_PRICE_IMAGE_V2"), "분양가·평형 이미지 요청서")}
            onOpen={() => openInChatGPT(promptFor("PRESALE_PRICE_IMAGE_V2"))} />
          <ImageCard title="02 · 주변 비교" note="1600×900" disabled={!compareReady}
            onCopy={() => copyText(promptFor("PRESALE_COMPARE_IMAGE_V2"), "주변 비교 이미지 요청서")}
            onOpen={() => openInChatGPT(promptFor("PRESALE_COMPARE_IMAGE_V2"))} />
          <ImageCard title="03 · 핵심 킥" note={hasKick ? "1600×900" : "킥 없으면 자동 생략"} disabled={!hasKick}
            onCopy={() => copyText(promptFor("PRESALE_KICK_IMAGE_V2"), "핵심 킥 이미지 요청서")}
            onOpen={() => openInChatGPT(promptFor("PRESALE_KICK_IMAGE_V2"))} />
        </div>
        <div className={styles.locationCard}>
          <label className={styles.check}><input type="checkbox" checked={draft.locationImageEnabled} onChange={(event) => updateDraft("locationImageEnabled", event.target.checked)} /> 입지 위치 이미지 사용</label>
          <p>네이버지도 캡처를 ChatGPT에 함께 첨부하고, 사업지가 어느 지역인지 한눈에 보이는 안내 이미지로 만듭니다.</p>
          <textarea value={draft.locationNote} onChange={(event) => updateDraft("locationNote", event.target.value)} placeholder="예: 사업지 위치와 경기광주역, 경안천 정도만 표시. 거리 추정 금지." />
          <div className={styles.row}>
            <button disabled={!draft.locationImageEnabled} onClick={() => copyText(promptFor("PRESALE_LOCATION_IMAGE_V2"), "입지 위치 이미지 요청서")}>요청서 복사</button>
            <button className={styles.primary} disabled={!draft.locationImageEnabled} onClick={() => openInChatGPT(promptFor("PRESALE_LOCATION_IMAGE_V2"))}>GPT 열기</button>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className={styles.sectionHead}>
          <div><span>최종</span><h2>저장자료 취합 → 최종 원고</h2><p>이 단계에서는 웹검색을 다시 하지 않습니다.</p></div>
          <span className={finalReady ? styles.readyBadge : styles.waitBadge}>{finalReady ? "원고 생성 가능" : "조사자료 4개 필요"}</span>
        </div>
        <div className={styles.row}>
          <button disabled={!finalReady} onClick={() => copyText(promptFor("PRESALE_FINAL_V2"), "최종 원고 요청서")}>최종 요청서 복사</button>
          <button className={styles.primary} disabled={!finalReady} onClick={() => openInChatGPT(promptFor("PRESALE_FINAL_V2"))}>GPT 열기</button>
        </div>
        <textarea className={styles.finalTextarea} value={draft.finalRaw} onChange={(event) => updateDraft("finalRaw", event.target.value)} placeholder="완성된 최종 글을 그대로 붙여넣기" />
        <div className={styles.row}>
          <button disabled={!draft.finalRaw.trim()} onClick={() => setNaverApplied(true)}>네이버 서식 적용</button>
          <button className={styles.primary} disabled={!draft.finalRaw.trim()} onClick={copyNaver}>네이버용 복사</button>
        </div>
        {naverApplied && previewHtml && <div className={styles.preview}>
          <div className={styles.previewHead}>네이버 서식 미리보기</div>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>}
      </section>
    </section>}
  </main>;
}

function ResearchCard(props: {
  no: string;
  title: string;
  description: string;
  ready: boolean;
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
  onCopy: () => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  return <section className={[styles.researchCard, props.disabled ? styles.disabledCard : ""].join(" ")}>
    <div className={styles.cardHead}>
      <span>{props.no}</span>
      <div><h3>{props.title}</h3><p>{props.description}</p></div>
      <em className={props.ready ? styles.ok : styles.pending}>{props.ready ? "저장됨" : "대기"}</em>
    </div>
    <div className={styles.row}>
      <button disabled={props.disabled} onClick={props.onCopy}>요청서 복사</button>
      <button className={styles.primary} disabled={props.disabled} onClick={props.onOpen}>GPT 열기</button>
    </div>
    <textarea disabled={props.disabled} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder="ChatGPT JSON 결과를 붙여넣기" />
    <button disabled={props.disabled || !props.value.trim()} onClick={props.onValidate}>결과 저장·검사</button>
  </section>;
}

function ImageCard(props: { title: string; note: string; disabled: boolean; onCopy: () => void; onOpen: () => void }) {
  return <div className={[styles.imageCard, props.disabled ? styles.disabledCard : ""].join(" ")}>
    <strong>{props.title}</strong>
    <small>{props.note}</small>
    <div className={styles.row}>
      <button disabled={props.disabled} onClick={props.onCopy}>복사</button>
      <button className={styles.primary} disabled={props.disabled} onClick={props.onOpen}>GPT 열기</button>
    </div>
  </div>;
}
