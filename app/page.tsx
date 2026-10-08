"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";
import { cleanSceneField, parseOverlayRows, unsupportedRowValues, renderShortsOverlay, oneLineSrt, sceneKind, SCENE_TYPES, splitOneLineCaptions, resolveOverlayScenes } from "@/lib/jibssuk-v3";
import { narrationDifference, restoreOriginalNarration } from "@/lib/jibssuk-narration";
import { toKoreanVoiceScript, hasArabicVoiceDigits } from "@/lib/jibssuk-voice";
import { JIBSSUK_MASTER_REFERENCE_KEY, JIBSSUK_MASTER_STYLE, JIBSSUK_SCENE_TEMPLATES, buildJibssukImagePrompt } from "@/lib/jibssuk-master-prompts";

type Fact = { label: string; value: string; sourceText: string };
type ImagePlan = { order: number; title: string; keyMessage: string; sourceText: string; imagePrompt: string };
type Analysis = { recommendedTitle: string; titleCandidates: string[]; keywords: string[]; facts: Fact[]; images: ImagePlan[] };
type Task = ImagePlan & { done: boolean; imageDataUrl: string; imageUrl?: string; sourceDataUrl?: string; replaced: boolean; assetKind?: "background" | "graphic" };
type Recommendation = { title: string; brief: string };
type ShortsScene = { order: number; narration: string; headline: string; subtitle: string; screenType: string; dataRows?: string };
type Phase = "home" | "input" | "script" | "analysis" | "images" | "review" | "done";
const SHORTS_NAV_PHASES: Phase[] = ["input", "script", "analysis", "images", "review"];

const TYPES = [
  ["🏠", "아파트 블로그", "시세·실거래·TOP3"],
  ["💡", "생활·아파트 꿀팁", "이사·청소·점검"],
  ["🌿", "Paramma 블로거", "추천 10개 순차 발행"],
  ["🤖", "AI Price Atlas", "실전 검증 · 가격 비교"],
  ["🎬", "집값쓱 쇼츠", "배경 1장 + 코드 정보판 7장"],
] as const;

const PARAMMA_CATEGORIES = [
  ["🐾", "신기한 동물이야기", "동물의 행동·능력·생태"],
  ["🌌", "신비로운 자연", "기묘한 자연현상과 숨은 원리"],
  ["💡", "생활 속 궁금증", "일상에서 문득 궁금한 이유"],
] as const;

const RECOMMENDATIONS: Record<string, Recommendation[]> = {
  "아파트 블로그": [
    { title: "요즘 거래가 늘어난 아파트 TOP3", brief: "최근 거래가 활발해진 단지 3곳을 비교하고 가격대·입지·거래 증가 이유를 정리합니다." },
    { title: "같은 예산이면 어디 아파트까지 살 수 있을까?", brief: "예산별로 살 수 있는 지역과 전용 84㎡대 아파트를 비교합니다." },
    { title: "지금 아파트 사도 될까? 거래는 줄었는데 가격이 오르는 이유", brief: "거래량과 가격 흐름이 엇갈리는 이유와 체크포인트를 정리합니다." },
    { title: "역세권 아파트, 비슷한 가격인데 어디가 다를까?", brief: "비슷한 가격대 역세권 아파트를 교통·연식·학군·생활권 기준으로 비교합니다." },
    { title: "전용 84㎡ 가격 차이가 크게 벌어지는 이유", brief: "신축·역세권·학군·정비사업·입주물량 관점에서 가격 차이를 설명합니다." },
  ],
  "생활·아파트 꿀팁": [
    { title: "신축 아파트 사전점검 체크리스트", brief: "현관·창호·욕실·주방·설비·마감 순서로 실제 점검할 항목을 정리합니다." },
    { title: "이사 전날 꼭 해야 할 일 10가지", brief: "가전·귀중품·엘리베이터·관리사무소·주차 등 놓치기 쉬운 준비를 정리합니다." },
    { title: "입주청소 직접 할까, 업체 맡길까?", brief: "셀프 청소와 업체 청소의 시간·비용·준비물·주의점을 비교합니다." },
    { title: "에어컨 청소, 집에서 어디까지 가능할까?", brief: "직접 가능한 범위와 전문가 분해청소가 필요한 경우를 구분합니다." },
    { title: "아파트 관리비 줄이는 현실적인 방법", brief: "전기·난방·수도·공용관리비에서 확인할 수 있는 절약 포인트를 정리합니다." },
  ],
  "신기한 동물이야기": [
    { title: "고양이는 왜 박스를 좋아할까?", brief: "안정감·체온 유지·사냥 본능과 연결해 쉽게 설명합니다." },
    { title: "문어는 정말 머리가 좋을까?", brief: "문제 해결 능력·도구 사용·학습 행동을 사례 중심으로 소개합니다." },
    { title: "새들은 길을 어떻게 잃지 않을까?", brief: "태양·별·지구 자기장 등을 이용한 이동 원리를 쉽게 설명합니다." },
    { title: "피스톨새우는 어떻게 총소리를 낼까?", brief: "집게가 만드는 초고속 물줄기와 충격파의 원리를 설명합니다." },
    { title: "돌고래는 잠잘 때 어떻게 숨을 쉴까?", brief: "뇌의 한쪽씩 쉬는 수면 방식과 호흡을 연결해 설명합니다." },
    { title: "해달은 왜 돌을 들고 다닐까?", brief: "먹이를 깨는 도구 사용과 돌을 보관하는 행동을 소개합니다." },
    { title: "부엉이는 왜 고개를 크게 돌릴 수 있을까?", brief: "목뼈 구조와 혈류를 유지하는 신체 특징을 쉽게 설명합니다." },
    { title: "카멜레온은 왜 색을 바꿀까?", brief: "위장뿐 아니라 체온·감정·의사소통과 관련된 이유를 설명합니다." },
    { title: "플라밍고는 왜 한쪽 다리로 서 있을까?", brief: "체온 유지와 에너지 절약 가설을 중심으로 정리합니다." },
    { title: "문어의 팔은 왜 각각 따로 움직일 수 있을까?", brief: "분산된 신경계와 팔의 독립적인 움직임을 흥미롭게 설명합니다." },
  ],
  "신비로운 자연": [
    { title: "블러드폴스는 왜 피처럼 빨갛게 흐를까?", brief: "남극의 붉은 폭포가 생기는 철 성분과 산화 과정을 설명합니다." },
    { title: "바닷속에도 고드름이 생길까? 브리니클의 정체", brief: "차가운 염수가 내려오며 얼음 기둥을 만드는 과정을 설명합니다." },
    { title: "밤바다가 파랗게 빛나는 이유는 뭘까?", brief: "생물발광 플랑크톤이 빛을 내는 원리와 조건을 소개합니다." },
    { title: "비 온 뒤 흙냄새는 왜 더 진하게 날까?", brief: "페트리코르와 지오스민, 빗방울이 냄새를 퍼뜨리는 과정을 설명합니다." },
    { title: "오로라는 왜 초록색으로 보일까?", brief: "태양 입자와 대기 기체의 충돌로 색이 생기는 원리를 설명합니다." },
    { title: "번개는 왜 지그재그로 칠까?", brief: "전기가 공기 중에서 경로를 찾아가는 과정을 쉽게 풀어냅니다." },
    { title: "사막의 모래는 왜 밤에 급격히 차가워질까?", brief: "수분과 열용량, 지표의 열 방출 차이로 설명합니다." },
    { title: "무지개는 왜 항상 같은 색 순서일까?", brief: "빛의 굴절·반사·분산으로 색 순서가 정해지는 이유를 설명합니다." },
    { title: "파도는 왜 해변 가까이에서 더 크게 부서질까?", brief: "수심이 얕아질 때 파도의 속도와 높이가 바뀌는 과정을 설명합니다." },
    { title: "눈 결정은 왜 모두 육각형일까?", brief: "물 분자의 결합 구조가 만들어내는 육각 대칭을 쉽게 설명합니다." },
  ],
  "생활 속 궁금증": [
    { title: "9월인데 모기가 왜 이렇게 많지? 가을 모기가 사라지지 않는 이유", brief: "기온과 습도, 가을철 모기 활동이 이어지는 이유를 생활 관점에서 설명합니다." },
    { title: "가을 모기는 여름 모기보다 정말 더 독할까?", brief: "계절에 따라 더 독하게 느껴지는 이유와 실제 차이를 구분해 설명합니다." },
    { title: "모기는 왜 나만 물까? 유독 잘 물리는 사람의 특징", brief: "이산화탄소·체온·냄새 등 모기가 사람을 찾는 단서를 설명합니다." },
    { title: "가을에 벌이 더 무섭게 느껴지는 이유", brief: "먹이 활동과 계절 변화 속에서 벌을 자주 마주치는 이유를 설명합니다." },
    { title: "밤에 창문을 열면 벌레가 불빛으로 몰려드는 이유", brief: "빛을 이용해 방향을 잡는 곤충의 행동과 인공조명의 영향을 설명합니다." },
    { title: "비 온 다음날 지렁이가 길 위로 올라오는 이유", brief: "젖은 토양과 이동·호흡 가설을 중심으로 쉽게 설명합니다." },
    { title: "가을 하늘은 왜 유난히 높고 파랗게 보일까?", brief: "습도와 대기 상태, 빛의 산란을 연결해 설명합니다." },
    { title: "은행나무 열매는 왜 그렇게 냄새가 심할까?", brief: "은행 열매 바깥 과육에서 나는 냄새 성분의 이유를 설명합니다." },
    { title: "나뭇잎은 왜 가을이 되면 빨강·노랑으로 변할까?", brief: "엽록소가 줄고 다른 색소가 드러나는 과정을 설명합니다." },
    { title: "환절기에는 왜 정전기가 더 자주 생길까?", brief: "건조한 공기와 전하 이동이 정전기를 늘리는 이유를 설명합니다." },
  ],
  "AI Price Atlas": [
    { title: "ChatGPT Plus Price in South Korea 2026", brief: "South Korea 가격, Web vs App, 결제수단과 확인사항을 정리하는 영문 SEO 글입니다." },
    { title: "ChatGPT Plus Price in Japan 2026", brief: "Japan 가격과 Web vs App 결제 차이, JPY 표시 방식 등을 정리합니다." },
    { title: "Claude Pro Price in South Korea 2026", brief: "South Korea 기준 Claude Pro 가격과 결제·세금 포인트를 정리합니다." },
    { title: "Gemini AI Subscription Price in South Korea 2026", brief: "South Korea 기준 Gemini 유료 구독 가격과 결제방식을 정리합니다." },
    { title: "Cheapest Countries for AI Subscriptions in 2026", brief: "국가별 지역 가격·세금·앱스토어 차이를 비교하는 영문 글입니다." },
  ],
  "집값쓱 쇼츠": [
    { title: "연봉 5천이면 얼마짜리 아파트 가능할까?", brief: "연봉 5천만원 기준 대출 가능액과 현금 보유액별 가능 가격을 7장면으로 설명합니다." },
    { title: "현금 1억이면 아파트 어디까지 가능할까?", brief: "현금 1억원과 대출 조건에 따라 가능한 가격대를 쇼츠로 구성합니다." },
    { title: "월 대출 100만원 있으면 집 살 때 얼마나 줄어들까?", brief: "기존 대출이 DSR과 주담대 가능액에 미치는 영향을 쉽게 설명합니다." },
    { title: "6억 아파트 사려면 현금 얼마 필요할까?", brief: "6억원 아파트를 예시로 LTV·DSR과 필요한 자금을 30초 안에 정리합니다." },
    { title: "같은 연봉인데 왜 대출 가능액은 다를까?", brief: "기존대출·금리·상환기간에 따라 대출 가능액이 달라지는 이유를 보여줍니다." },
  ],
};

const PRESETS: Record<string, { width: number; height: number; label: string }> = {
  "집값쓱 쇼츠": { width: 1080, height: 1920, label: "1080×1920 · 9:16" },
  default: { width: 1600, height: 900, label: "1600×900 · 16:9" },
};

const SHORTS_DRAFT_KEY = "content-maker-jibssuk-shorts-draft-v1";
const LAST_CONTENT_TYPE_KEY = "content-maker-last-content-type-v1";
const SHORTS_PLAYBACK_RATE = 1.4;

function cleanName(v: string) {
  return v.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 38) || "image";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith("http")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const chars = [...text.trim()];
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line.trim());
      line = ch;
      if (lines.length >= maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  if (lines.length === maxLines && chars.join("").length > lines.join("").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.…]*$/, "") + "…";
  }
  return lines;
}

async function composeImage(src: string, task: Task, contentType: string) {
  const preset = PRESETS[contentType] || PRESETS.default;
  const { width: w, height: h } = preset;
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 합성 기능을 사용할 수 없습니다.");

  drawCover(ctx, img, w, h);
  const grad = ctx.createLinearGradient(0, h * 0.38, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.62, "rgba(0,0,0,.52)");
  grad.addColorStop(1, "rgba(0,0,0,.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const isThumb = task.order === 0;
  const pad = contentType === "집값쓱 쇼츠" ? 76 : 94;
  const small = contentType === "집값쓱 쇼츠" ? 38 : 34;
  const big = contentType === "집값쓱 쇼츠" ? (isThumb ? 82 : 68) : (isThumb ? 84 : 64);
  const label = task.order === 0 ? "대표 썸네일" : `${String(task.order).padStart(2, "0")} · ${task.title}`;

  ctx.textBaseline = "top";
  ctx.font = `700 ${small}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillText(label, pad, h - (contentType === "집값쓱 쇼츠" ? 460 : 250));

  ctx.font = `800 ${big}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.lineWidth = Math.max(3, Math.round(big * 0.07));
  ctx.strokeStyle = "rgba(0,0,0,.7)";
  ctx.fillStyle = "#fff";
  const maxWidth = w - pad * 2;
  const lines = wrapLines(ctx, task.keyMessage || task.title, maxWidth, contentType === "집값쓱 쇼츠" ? 4 : 2);
  const lineH = big * 1.18;
  const startY = h - pad - lineH * lines.length;
  lines.forEach((line, i) => {
    const y = startY + i * lineH;
    ctx.strokeText(line, pad, y);
    ctx.fillText(line, pad, y);
  });

  return canvas.toDataURL("image/png", 0.96);
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("home");
  const [contentType, setContentType] = useState("아파트 블로그");
  const [parammaCategory, setParammaCategory] = useState("신기한 동물이야기");
  const [projectTitle, setProjectTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saved, setSaved] = useState<any[]>([]);
  const [finalTitle, setFinalTitle] = useState("");
  const [finalBody, setFinalBody] = useState("");
  const [shortsScript, setShortsScript] = useState("");
  const [shortsSceneText, setShortsSceneText] = useState("");
  const [shortsPreview, setShortsPreview] = useState("");
  const [shortsPreviewFrames, setShortsPreviewFrames] = useState<string[]>([]);
  const [shortsPreviewIndex, setShortsPreviewIndex] = useState(0);
  const [shortsScenes, setShortsScenes] = useState<ShortsScene[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmMemo, setBgmMemo] = useState("");
  const [shortsVoiceOverride, setShortsVoiceOverride] = useState<string | null>(null);
  const [voiceFileForScript, setVoiceFileForScript] = useState<string | null>(null);
  const [sceneBoundaryOverrides, setSceneBoundaryOverrides] = useState<number[] | null>(null);
  const [shortsMasterReference, setShortsMasterReference] = useState("");
  const [shortsImagePromptPreview, setShortsImagePromptPreview] = useState(0);
  const [shortsCustomOverlays, setShortsCustomOverlays] = useState<string[]>(() => Array(7).fill(""));
  const [shortsOverlayNotice, setShortsOverlayNotice] = useState("");
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const bulkRef = useRef<HTMLInputElement | null>(null);

  const current = tasks[currentIndex];
  const effectiveContentType = contentType === "Paramma 블로거" ? parammaCategory : contentType;
  const isShorts = contentType === "집값쓱 쇼츠";
  const preset = PRESETS[contentType] || PRESETS.default;
  function normalizeShortsVoiceText(text: string) {
    return toKoreanVoiceScript(text);
  }

  const shortsCharCount = useMemo(() => shortsScript.replace(/\s/g, "").length, [shortsScript]);
  const shortsEstimatedSeconds = useMemo(() => shortsCharCount ? shortsCharCount / 6.8 : 0, [shortsCharCount]);
  const autoShortsVoiceScript = useMemo(() => normalizeShortsVoiceText(shortsScript), [shortsScript]);
  const shortsVoiceScript = shortsVoiceOverride ?? autoShortsVoiceScript;
  const shortsVoiceDigitsRemain = hasArabicVoiceDigits(shortsVoiceScript);
  const voiceMatchesScript = !!voiceFile && voiceFileForScript === shortsVoiceScript && !shortsVoiceDigitsRemain;
  const shortsVoiceCharCount = useMemo(() => shortsVoiceScript.replace(/\s/g, "").length, [shortsVoiceScript]);
  const finalVoiceDuration = voiceDuration ? voiceDuration / SHORTS_PLAYBACK_RATE : 0;
  const shortsBgm = useMemo(() => {
    const text = `${projectTitle} ${rawContent}`;
    if (/(하락|급락|주의|부담|위험|감소|실패)/.test(text)) return { label: "B · 긴장형", note: "하락·주의 포인트에 맞는 보컬 없는 긴장감 있는 리듬" };
    if (/(대출|DSR|LTV|금리|계산|비교|설명|세금)/i.test(text)) return { label: "C · 차분형", note: "대출·금리·설명형에 맞는 차분한 정보형 리듬" };
    return { label: "A · 기본형", note: "TOP3·거래·가격 흐름에 맞는 밝고 빠른 정보형 리듬" };
  }, [projectTitle, rawContent]);
  const completeCount = useMemo(() => tasks.filter(t => t.done).length, [tasks]);
  const imageCount = useMemo(() => tasks.filter(t => !!t.imageDataUrl).length, [tasks]);
  const backgroundCount = useMemo(() => tasks.filter(t => t.assetKind !== "graphic").length, [tasks]);
  const graphicCount = useMemo(() => tasks.filter(t => t.assetKind === "graphic").length, [tasks]);
  const backgroundReady = useMemo(() => tasks.filter(t => t.assetKind !== "graphic" && !!t.imageDataUrl).length, [tasks]);
  const graphicReady = useMemo(() => tasks.filter(t => t.assetKind === "graphic" && !!t.imageDataUrl).length, [tasks]);
  const resolvedShortsScenes = useMemo(() => resolveOverlayScenes(shortsScenes, rawContent + "\n" + shortsScript), [shortsScenes, rawContent, shortsScript]);
  const autoSceneTimeline = useMemo(() => {
    if (!voiceMatchesScript || !finalVoiceDuration || !resolvedShortsScenes.length) return [] as Array<{ scene: ShortsScene; start: number; end: number; duration: number }>;
    const weights = resolvedShortsScenes.map(s => Math.max(1, normalizeShortsVoiceText(s.narration || s.subtitle || s.headline).replace(/\s/g, "").length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return resolvedShortsScenes.map((scene, i) => {
      const duration = i === shortsScenes.length - 1 ? Math.max(0, finalVoiceDuration - cursor) : finalVoiceDuration * (weights[i] / totalWeight);
      const start = cursor;
      const end = i === shortsScenes.length - 1 ? finalVoiceDuration : Math.min(finalVoiceDuration, start + duration);
      cursor = end;
      return { scene, start, end, duration: end - start };
    });
  }, [resolvedShortsScenes, finalVoiceDuration, voiceMatchesScript]);
  const sceneTimeline = useMemo(() => {
    if (!sceneBoundaryOverrides || sceneBoundaryOverrides.length !== 6 || autoSceneTimeline.length !== 7) return autoSceneTimeline;
    const bounds = [0, ...sceneBoundaryOverrides, finalVoiceDuration];
    if (bounds.some((n, index) => !Number.isFinite(n) || (index > 0 && n - bounds[index - 1] <= 0.1))) return autoSceneTimeline;
    return autoSceneTimeline.map((item, index) => ({
      ...item, start: bounds[index], end: bounds[index + 1], duration: bounds[index + 1] - bounds[index]
    }));
  }, [autoSceneTimeline, sceneBoundaryOverrides, finalVoiceDuration]);

  function updateSceneBoundary(index: number, newValue: string) {
    if (!newValue.trim() || autoSceneTimeline.length !== 7) return;
    const time = Number(newValue);
    if (!Number.isFinite(time) || index < 0 || index >= 6) return;
    const oldBounds = (sceneBoundaryOverrides ?? autoSceneTimeline.slice(0, -1).map(item => item.end)).slice();
    const left = index === 0 ? 0 : oldBounds[index - 1];
    const right = index === 5 ? finalVoiceDuration : oldBounds[index + 1];
    if (time <= left + 0.1 || time >= right - 0.1) return;
    oldBounds[index] = time;
    setSceneBoundaryOverrides(oldBounds);
  }


  // Information-heavy graph/comparison scenes may hold for up to seven seconds.
  // Keep six seconds as the limit for the other five scenes.
  const shortsExtendedGraphScenes = useMemo(() => sceneTimeline.filter(item =>
    (item.scene.order === 3 || item.scene.order === 4) && item.duration > 6 && item.duration <= 7
  ), [sceneTimeline]);
  const shortsLongScenes = useMemo(() => sceneTimeline.filter(item =>
    item.duration > ((item.scene.order === 3 || item.scene.order === 4) ? 7 : 6)
  ), [sceneTimeline]);
  const shortsCaptionReady = useMemo(() => shortsScenes.length > 0 && shortsScenes.every(s => (s.narration || s.subtitle || s.headline).trim().length > 0), [shortsScenes]);
  const shortsVisualReady = tasks.length === 1 && !!tasks[0]?.imageDataUrl;
  const shortsSceneCountReady = shortsScenes.length === 7;
  const shortsDurationReady = finalVoiceDuration > 0 && finalVoiceDuration >= 28 && finalVoiceDuration <= 34;
  // Missing/one-point chart data now produces a fact-only card, not an export blocker.
  // Explicit numerical values absent from the source are still rejected.
  const shortsDataIssues = resolvedShortsScenes.flatMap(s =>
    unsupportedRowValues(s, rawContent + "\n" + shortsScript)
      .map(v => "장면 " + s.order + ": 원문에 없는 값 " + v)
  );
  const shortsScriptDifference = useMemo(() =>
    shortsScript.trim() && shortsScenes.length > 0
      ? narrationDifference(shortsScript, shortsScenes.map(s => s.narration))
      : null, [shortsScript, shortsScenes]);
  const shortsScriptReady = !!shortsScript.trim() && shortsScenes.length > 0 && !shortsScriptDifference;
  const shortsAssemblyReady = shortsSceneCountReady && shortsCaptionReady && shortsVisualReady && shortsDataIssues.length === 0 && shortsScriptReady && voiceMatchesScript && sceneTimeline.length === shortsScenes.length && shortsLongScenes.length === 0;

  const factUsage = useMemo(() => {
    const corpus = tasks.map(t => `${t.keyMessage} ${t.title}`).join(" ").toLowerCase();
    return (analysis?.facts || []).map(f => ({ ...f, used: corpus.includes(String(f.value).toLowerCase()) }));
  }, [analysis, tasks]);

  useEffect(() => {
    refreshSaved().catch(() => {});
    try {
      const savedMaster = window.localStorage.getItem(JIBSSUK_MASTER_REFERENCE_KEY);
      if (savedMaster?.startsWith("data:image/")) setShortsMasterReference(savedMaster);
    } catch {}
    try {
      const lastType = window.localStorage.getItem(LAST_CONTENT_TYPE_KEY);
      const raw = window.localStorage.getItem(SHORTS_DRAFT_KEY);
      if (lastType === "집값쓱 쇼츠" && raw) {
        const draft = JSON.parse(raw);
        setContentType("집값쓱 쇼츠");
        setProjectTitle(String(draft.projectTitle || ""));
        setRawContent(String(draft.rawContent || ""));
        setShortsScript(String(draft.shortsScript || ""));
        setShortsSceneText(String(draft.shortsSceneText || ""));
        setShortsScenes(Array.isArray(draft.shortsScenes) ? draft.shortsScenes.map((s: any, i: number) => ({ ...s, narration: String(s.narration || ""), screenType: SCENE_TYPES[i] || s.screenType, dataRows: String(s.dataRows || "") })) : []);
        setBgmMemo(String(draft.bgmMemo || ""));
        setShortsVoiceOverride(typeof draft.shortsVoiceOverride === "string" ? draft.shortsVoiceOverride : null);
        setFinalTitle(String(draft.finalTitle || ""));
        setFinalBody(String(draft.finalBody || ""));
        setAnalysis(draft.analysis || null);
        setProjectId(draft.projectId || null);
        const oldBackground = Array.isArray(draft.tasks) ? draft.tasks.find((t: Task) => t.assetKind !== "graphic") : null;
        const restoredTasks: Task[] = draft.shortsScenes?.length ? [{
          order: 0, title: "공통 아파트 배경", keyMessage: "무문자 배경 한 장",
          sourceText: "", imagePrompt: "한 장의 아파트 배경을 전체 영상에 고정 사용.",
          done: false, imageDataUrl: "", sourceDataUrl: undefined, replaced: false,
          assetKind: "background", imageUrl: oldBackground?.imageUrl || ""
        }] : [];
        setTasks(restoredTasks);
        setCurrentIndex(Math.max(0, Math.min(Number(draft.currentIndex || 0), Math.max(0, restoredTasks.length - 1))));
        const savedPhase = String(draft.phase || "");
        const allowedPhases: Phase[] = ["input", "script", "analysis", "images", "review"];
        const fallbackPhase: Phase = draft.shortsScenes?.length ? "analysis" : draft.shortsScript ? "script" : draft.rawContent ? "input" : "home";
        setPhase(allowedPhases.includes(savedPhase as Phase) ? savedPhase as Phase : fallbackPhase);
      }
    } catch {
      try { window.localStorage.removeItem(SHORTS_DRAFT_KEY); } catch {}
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try { window.localStorage.setItem(LAST_CONTENT_TYPE_KEY, contentType); } catch {}
  }, [draftReady, contentType]);

  useEffect(() => {
    if (!draftReady || !isShorts) return;
    const safeTasks = tasks.map(({ sourceDataUrl, imageDataUrl, ...t }) => ({
      ...t,
      imageDataUrl: imageDataUrl?.startsWith("https://") ? imageDataUrl : "",
      imageUrl: t.imageUrl || (imageDataUrl?.startsWith("https://") ? imageDataUrl : "")
    }));
    const payload = {
      projectId,
      projectTitle,
      rawContent,
      shortsScript,
      shortsSceneText,
      shortsScenes,
      bgmMemo,
      shortsVoiceOverride,
      finalTitle,
      finalBody,
      analysis,
      tasks: safeTasks,
      currentIndex,
      phase,
      savedAt: new Date().toISOString()
    };
    try { window.localStorage.setItem(SHORTS_DRAFT_KEY, JSON.stringify(payload)); } catch {}
  }, [draftReady, isShorts, projectId, projectTitle, rawContent, shortsScript, shortsSceneText, shortsScenes, bgmMemo, shortsVoiceOverride, finalTitle, finalBody, analysis, tasks, currentIndex, phase]);

  async function refreshSaved() {
    const { supabase } = await ensureAnonymousSession();
    const { data, error } = await supabase.from("projects").select("id,project_title,content_type,updated_at,status").order("updated_at", { ascending: false }).limit(20);
    if (error) throw error;
    setSaved(data || []);
  }

  function resetNew() {
    setProjectId(null); setProjectTitle(""); setRawContent(""); setAnalysis(null); setTasks([]); setCurrentIndex(0); setFinalTitle(""); setFinalBody(""); setShortsScript(""); setShortsSceneText(""); setShortsScenes([]); setShortsCustomOverlays(Array(7).fill("")); setShortsImagePromptPreview(0); setShortsOverlayNotice(""); setVoiceFile(null); setBgmFile(null); setBgmMemo(""); setShortsVoiceOverride(null); setVoiceFileForScript(null); setSceneBoundaryOverrides(null); setVoiceDuration(0); setError(""); setPhase("home");
  }

  function applyRecommendation(item: Recommendation) {
    setProjectTitle(item.title);
    setRawContent(`${item.brief}\n\n독자가 가장 궁금해할 질문부터 시작하고 핵심 비교 포인트와 체크사항을 이해하기 쉽게 정리합니다. 확인되지 않은 숫자나 사실은 임의로 만들지 않습니다.`);
    setError("");
  }

  async function analyze() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: effectiveContentType, projectTitle, rawContent }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "분석 실패");
      setAnalysis(data);
      setFinalTitle(data.recommendedTitle);
      setTasks((data.images || []).map((x: ImagePlan) => ({ ...x, done: false, imageDataUrl: "", replaced: false })));
      setCurrentIndex(0);
      setPhase("analysis");
    } catch (e: any) { setError(e.message || "분석 오류"); }
    finally { setLoading(false); }
  }

  function updateTask(index: number, fields: Partial<Task>) {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, ...fields } : t));
  }

  function promptFor(task: Task) {
    if (isShorts && task.assetKind === "graphic") {
      return [
        "[집값쓱 쇼츠 그래프·숫자 카드 제작]",
        `주제: ${projectTitle || "아래 자료의 핵심 주제"}`,
        `장면: ${task.title}`,
        `화면 핵심: ${task.keyMessage}`,
        task.sourceText ? `장면 근거: ${task.sourceText}` : "",
        "",
        "[제작 기준]",
        "- 1080×1920, 9:16 세로형 정보 이미지 한 장",
        "- 아래 원문에 실제로 있는 숫자·기간·단지명만 사용할 것",
        "- 데이터가 시계열이면 라인차트, 비교값이면 막대그래프 또는 숫자 카드 중 더 읽기 쉬운 방식 선택",
        "- 그래프는 가능하면 코드로 정확하게 제작하고 숫자·한글 오타가 없게 확인",
        "- 카드만 덩그러니 놓인 PPT 스타일보다, 해당 아파트를 연상시키는 실제 아파트 배경 위에 주식 시세 앱처럼 선명한 차트·숫자를 오버레이한 스타일을 우선",
        "- 배경은 차트 가독성을 위해 살짝 어둡게 또는 흐리게 처리하고, 차트는 상단~중앙 영역에 배치",
        "- 원문에 데이터가 부족하면 임의로 보간하거나 숫자를 만들지 말고 숫자 카드로 단순화",
        "- 모바일 쇼츠에서 한눈에 읽히도록 큰 숫자와 짧은 라벨 중심",
        "- 그래프·숫자·핵심 라벨은 화면 상단~중앙 약 70~75% 안에 배치",
        "- 하단 약 25%는 영상 자막 합성용 안전영역으로 비워둘 것",
        "- 하단 안전영역에는 축 라벨, 핵심 숫자, 단지명 등 중요한 정보를 두지 말 것",
        "- 맨 아래 약 150~200px은 쇼츠 UI와 자막 여유를 위해 특히 단순하게 비워둘 것",
        "- 광고 배너처럼 만들지 말고 깔끔한 부동산 정보 카드 스타일",
        "- 원문에 없는 전망·정책·가격·날짜 추가 금지",
        "",
        "[원문 자료]",
        rawContent.trim()
      ].filter(Boolean).join("\n");
    }
    const ratio = isShorts ? "9:16 세로" : "16:9 가로";
    return [
      `[${effectiveContentType} 이미지 배경 제작]`,
      `장면 ${String(task.order).padStart(2, "0")} · ${task.title}`,
      task.sourceText ? `근거: ${task.sourceText}` : "",
      task.imagePrompt || "",
      `${ratio} 이미지 한 장만 생성. 여러 장 합본 금지.`,
      "중요: 이미지 안에 글자, 숫자, 제목, 로고를 넣지 말 것. 무문자 배경 이미지로 제작.",
      "본문에 없는 가격·날짜·단지명·정책·수치를 임의로 시각화하지 말 것.",
      isShorts ? [
        "핵심 피사체는 화면 상단~중앙 약 70% 안에 배치할 것.",
        "하단 약 25%는 영상 자막 합성용 안전영역으로 비워둘 것.",
        "하단 안전영역에는 사람 얼굴, 건물 핵심 부분, 지도 포인트 등 중요한 요소를 두지 말 것.",
        "하단은 도로·바닥·하늘·벽처럼 단순한 배경으로 자연스럽게 이어지게 하고, 필요하면 아래로 갈수록 살짝 어두워지는 그라데이션은 허용.",
        "맨 아래 약 150~200px은 쇼츠 UI와 자막 여유를 위해 특히 비워둘 것."
      ].join("\n") : "핵심 피사체는 중앙과 상단 2/3에 두고 하단에는 문구를 합성할 여백을 남길 것."
    ].filter(Boolean).join("\n");
  }

  async function copyPrompt(task: Task) {
    try { await navigator.clipboard.writeText(promptFor(task)); alert("무문자 이미지 요청문을 복사했습니다."); }
    catch { setError("클립보드 복사에 실패했습니다."); }
  }

  async function copyText(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); alert(message); }
    catch { setError("클립보드 복사에 실패했습니다."); }
  }

  function openGPT(text = "") {
    const prompt = text.trim();
    const url = prompt ? `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}` : "https://chatgpt.com/";
    window.open(url, "_blank", "noopener,noreferrer");
    if (prompt) navigator.clipboard.writeText(prompt).catch(() => {});
  }

  function shortsScriptPrompt() {
    return [
      "[집값쓱 유튜브 쇼츠 대본 제작]",
      `주제: ${projectTitle || "아래 자료의 핵심 주제"}`,
      "",
      "[고정 제작 기준]",
      "- 음성은 1.4배속으로 사용할 예정",
      "- 완성 영상 목표 30~33초",
      "- 전체 내레이션은 공백 제외 210~225자로 작성",
      "- 새로운 고정 배경 정보판 7장면으로 자연스럽게 나눌 수 있는 흐름",
      "- 숫자·단지명·기간은 아래 원문에 있는 정보만 사용",
      "- 가격·면적·퍼센트·영문 약어는 원문의 화면용 표기(예: 6.93억, 84㎡, 9.5%, DSR)를 그대로 유지",
      "- 발음용 변환은 AI 음성 단계에서 별도로 처리하므로 대본에서 임의로 '6억 9천만원', '제곱미터' 등으로 풀어쓰지 말 것",
      "- 과장된 매수·매도 권유 금지",
      "- 짧고 또렷한 구어체로 작성",
      "",
      "[집값쓱 고정 대본 문법]",
      "- 시작은 반드시 지역명과 핵심 질문이 바로 들어가는 질문형 후킹 1문장으로 시작",
      "- 예: '일산에서 요즘 거래가 제일 활발한 아파트, 어디일까요?'",
      "- 두 번째 문장은 기준 기간·거래 기준 등 비교 기준을 짧게 설명",
      "- 조사 기준 설명 직후 반드시 독립 멘트 '집.값.쓱. 해보겠습니다.'를 넣을 것. 표기·마침표·띄어쓰기를 생략하거나 합치지 말 것",
      "- 중간은 순위·가격·거래량·변화 등 원문 핵심 데이터만 빠르게 전달하되 숫자만 나열하지 말 것",
      "- 순위·거래량 등 핵심 데이터 다음에는 같은 면적의 가격이나 지역별 차이 등 원문에 있는 두 번째 비교 포인트를 전달",
      "- 핵심 비교 직후 반드시 독립 문장 '차이가 꽤 나죠.'를 넣을 것. 가격 비교가 없는 주제는 원문에 있는 다른 수치의 차이를 활용",
      "- 마무리 전환은 반드시 '근데 여기서 잠깐.'으로 시작",
      "- 그 다음 문장에서 거래량·가격·순위 등을 단정적으로 해석하지 않도록 주의점 1개를 짧게 설명",
      "- 마지막 문장은 반드시 '[대표 지역명] 집값, 오늘도. 집.값.쓱.' 형식으로 끝낼 것. '오늘도 집값쓱.'으로 합치지 말 것",
      "- 지역명이 여러 곳이면 글의 대표 지역명을 사용",
      "- 전체 흐름 고정: 지역 질문형 훅 → 기준 설명 → 집.값.쓱. 해보겠습니다. → 첫 핵심 데이터 → 두 번째 핵심 데이터·비교 → 차이가 꽤 나죠. → 근데 여기서 잠깐. → 주의점 1개 → 지역명 집값, 오늘도. 집.값.쓱.",
      "- 시작·고정 멘트·마무리는 위 문법 그대로 유지하고, 주제에 맞춰 중간 데이터만 바꿀 것",
      "",
      "[출력 전 필수 자가 검수 · 검수 결과는 출력하지 말 것]",
      "- 공백과 줄바꿈을 모두 제외한 실제 내레이션이 210~225자인지 세고, 범위를 벗어나면 고정 멘트는 유지한 채 중간 설명을 다듬을 것",
      "- '집.값.쓱. 해보겠습니다.' / '차이가 꽤 나죠.' / '근데 여기서 잠깐.' / '[대표 지역명] 집값, 오늘도. 집.값.쓱.' 네 구절의 존재·순서·표기를 확인할 것",
      "- 원문 밖의 숫자·순위·단지명은 없는지, 월 진행 중 집계와 서로 다른 면적·거래 기준을 섞어 단정하지 않았는지 확인할 것",
      "- 정확히 7장면으로 끊기 쉬운 짧은 호흡인지, 1.4배속에서도 발음이 뭉개지지 않을지 확인할 것",
      "",
      "[출력 형식]",
      "- 설명이나 제목, 글자 수, 검수 결과를 붙이지 말 것",
      "- 장면 번호를 붙이지 말 것",
      "- TTS에 바로 넣을 수 있는 완성 내레이션만 출력",
      "",
      "[원문 자료]",
      rawContent.trim()
    ].join("\n");
  }

  function shortsSilentPrompt() {
    return [
      "[집값쓱 쇼츠 · 7장 이미지 구성 정보 추출]",
      "주제: " + (projectTitle || "아래 자료의 핵심 주제"), "",
      "[목표]",
      "- GPT가 완성 대본을 한 문장도 수정·누락·중복하지 않고 7개 장면에 나누어 준다.",
      "- 실제 고품질 이미지는 이후 1~7번 개별 마스터 요청서로 제작한다. 여기서는 각 장면 제목·내레이션·데이터를 정확하게 정리한다.",
      "- 배경은 7장 모두 같은 공통 아파트 배경 1개로 고정한다. 이미지 내부에 영상용 하단 자막을 넣지 않는다.",
      "- 큰문구에는 짧은 화면 제목만 넣는다. 하단자막은 해당 장면 대사를 그대로 넣고, 사이트에서 음성 싱크에 맞춰 한 줄씩 분할한다.",
      "- 장면 역할 순서: 1 썸네일 / 2 대상 소개 / 3 거래량 등 핵심 수치 / 4 실제 가격 변화 그래프 / 5 주목 포인트 / 6 주의사항 / 7 집값쓱 브랜드 엔딩.",
      "- 전체 평형 거래량과 특정 면적 가격 등 기준이 다른 수치를 절대 합치지 않는다.",
      "- 3번 데이터행은 '실제 이름 | 원문 건수 ; 실제 이름 | 원문 건수' 형식으로 기입한다. 거래량 없는 주제는 실제 첫 번째 핵심 수치를 입력한다.",
      "- 4번은 최근 1년 자료가 실제로 존재할 때만 1년 가격 변화. 4~9월의 6개월 자료뿐이면 6개월만 사용한다.",
      "- 4번 데이터행은 시계열 차트를 그릴 수 있게 '단지명·4월 | 6.75억 ; 단지명·5월 | 6.72억'처럼 확인되는 월별 값만 반복한다.",
      "- 4번에 월별 자료가 부족하면 존재하는 대표 가격만 제시하고, 없는 달이나 값을 추측·보간하지 않는다.",
      "- 다른 장면에서 구조화된 표가 필요하면 '라벨 | 값 ; 라벨 | 값' 형식, 필요 없으면 데이터행을 비운다.",
      "- 각 장면은 내레이션 / 큰문구 / 하단자막 / 화면방식 / 데이터행 5개 필드를 반드시 다른 줄에 넣는다.",
      "",
      "[출력 형식: 반드시 정확히 7장면]",
      "[장면 1]", "내레이션: ...", "큰문구: ...", "하단자막: ...", "화면방식: 썸네일", "데이터행:", "",
      "[장면 2]", "내레이션: ...", "큰문구: ...", "하단자막: ...", "화면방식: 대상 소개 카드", "데이터행: 실제단지명1 | 1위 ; 실제단지명2 | 공동 1위 ; 실제단지명3 | 3위", "",
      "[장면 3]", "내레이션: ...", "큰문구: ...", "하단자막: ...", "화면방식: 거래량 그래프", "데이터행: 실제단지명1 | 원문건수1 ; 실제단지명2 | 원문건수2 ; 실제단지명3 | 원문건수3", "",
      "[장면 4]", "내레이션: ...", "큰문구: ...", "하단자막: ...", "화면방식: 가격 변화 그래프", "데이터행: 실제단지명·실제월 | 원문월대표값 ; 실제단지명·실제월 | 원문월대표값", "",
      "[장면 5]", "내레이션: ...", "큰문구: ...", "하단자막: ...", "화면방식: 주목 포인트 카드", "데이터행:", "",
      "[장면 6]", "내레이션: ...", "큰문구: ...", "하단자막: ...", "화면방식: 주의사항 카드", "데이터행:", "",
      "[장면 7]", "내레이션: ...", "큰문구: 집.값.쓱.", "하단자막: ...", "화면방식: 집값쓱 엔딩", "데이터행:", "",
      "주의: 위 라벨과 수치는 형식 예시일 뿐이며 반드시 아래 자료의 실제 이름·기간·값으로 바꾼다.",
      "", "[완성 대본]", shortsScript.trim(), "", "[원문 자료]", rawContent.trim()
    ].join("\n");
  }

  function parseShortsScenes(value: string): ShortsScene[] {
    const scenes: ShortsScene[] = [];
    const re = /\[장면\s*(\d+)\]\s*([\s\S]*?)(?=\n\s*\[장면\s*\d+\]|$)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value)) !== null) {
      const body = match[2];
      const field = (label: RegExp) => cleanSceneField(body.match(label)?.[1] || "");
      const narration = field(/^\s*내레이션\s*[:：]\s*(.*)$/m);
      const headline = field(/^\s*큰\s*문구\s*[:：]\s*(.*)$/m);
      const subtitle = field(/^\s*하단\s*자막\s*[:：]\s*(.*)$/m);
      const screenType = field(/^\s*화면\s*방식\s*[:：]\s*(.*)$/m);
      const dataRows = field(/^\s*데이터행\s*[:：]\s*(.*)$/m);
      if (narration || headline) scenes.push({ order: Number(match[1]), narration, headline, subtitle, screenType: screenType || SCENE_TYPES[Math.min(scenes.length, 6)], dataRows });
    }
    return scenes.sort((x, y) => x.order - y.order).slice(0, 7);
  }

  function buildShortsImageTasks(scenes: ShortsScene[], previous: Task[] = tasks): Task[] {
    if (!scenes.length) return [];
    const existing = previous.find(t => t.title === "공통 아파트 배경");
    return [{
      order: 0, title: "공통 아파트 배경", keyMessage: "글자 없는 공통 배경 한 장",
      sourceText: projectTitle, imagePrompt: "고화질 한국 아파트 전경. 영상 전체에 고정으로 사용. 문자와 차트 금지.",
      done: !!existing?.imageDataUrl, imageDataUrl: existing?.imageDataUrl || "",
      imageUrl: existing?.imageUrl || "", sourceDataUrl: existing?.sourceDataUrl,
      replaced: existing?.replaced || false, assetKind: "background"
    }];
  }

  function applyShortsSceneText(text: string) {
    setSceneBoundaryOverrides(null);
    setShortsSceneText(text);
    setShortsPreview(""); setShortsPreviewFrames([]);
    const parsed = parseShortsScenes(text);
    setShortsScenes(parsed);
    if (parsed.length) {
      const nextTasks = buildShortsImageTasks(parsed);
      setTasks(nextTasks);
      setCurrentIndex(0);
    }
  }

  function updateShortsScene(index: number, fields: Partial<ShortsScene>) {
    setSceneBoundaryOverrides(null);
    setShortsPreview(""); setShortsPreviewFrames([]);
    setShortsScenes(prev => prev.map((scene, i) => i === index ? { ...scene, ...fields } : scene));
  }

  function restoreShortsOriginalScript() {
    const repaired = restoreOriginalNarration(shortsScript, shortsScenes.map(s => s.narration));
    if (!repaired || repaired.length !== 7) {
      setError("기준 대본 또는 7장면 내레이션이 부족해 복원할 수 없습니다.");
      return;
    }
    const updated = shortsScenes.map((scene, i) => ({
      ...scene, narration: repaired[i], subtitle: repaired[i]
    }));
    // Keep the editable pasted plan and its parsed scenes in sync after repair.
    applyShortsSceneText(updated.map(scene => [
      "[장면 " + scene.order + "]",
      "내레이션: " + scene.narration,
      "큰문구: " + scene.headline,
      "하단자막: " + scene.subtitle,
      "화면방식: " + scene.screenType,
      "데이터행: " + (scene.dataRows || "")
    ].join("\n")).join("\n\n"));
    setShortsOverlayNotice("7장면 내레이션과 하단 자막을 원본 완성 대본으로 복원했습니다. 큰 문구·데이터행과 재계산된 시간을 확인해 주세요.");
    setError("");
  }

  function imagePromptForScene(order: number) {
    const scene = resolvedShortsScenes.find(x => x.order === order);
    return buildJibssukImagePrompt({
      order, projectTitle, rawContent, script: shortsScript,
      narration: scene?.narration || "",
      headline: scene?.headline || "",
      dataRows: scene?.dataRows || ""
    });
  }

  async function saveMasterReference(file: File) {
    try {
      if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 등록할 수 있습니다.");
      const original = await loadImage(await fileToDataUrl(file));
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 720 / original.width, 1280 / original.height);
      canvas.width = Math.max(1, Math.round(original.width * scale));
      canvas.height = Math.max(1, Math.round(original.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("이미지 변환을 시작할 수 없습니다.");
      ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.78);
      window.localStorage.setItem(JIBSSUK_MASTER_REFERENCE_KEY, image);
      setShortsMasterReference(image);
      setShortsOverlayNotice("승인 마스터 이미지를 이 브라우저에 저장했습니다. GPT 요청 시 참고 이미지로 함께 첨부하세요.");
      setError("");
    } catch (e: any) {
      setError(e.message || "마스터 이미지 저장에 실패했습니다.");
    }
  }

  function downloadMasterReference() {
    if (!shortsMasterReference) return;
    const link = document.createElement("a");
    link.href = shortsMasterReference;
    link.download = "jibssuk_approved_master_reference.jpg";
    link.click();
  }

  async function uploadCustomOverlay(index: number, file: File) {
    try {
      if (file.type !== "image/png" && file.type !== "image/webp") throw new Error("정보판은 투명 PNG 또는 WebP 파일로 올려주세요.");
      const source = await loadImage(await fileToDataUrl(file));
      // First normalize the entire image. Never clip the bottom of an uploaded information card.
      const scan = document.createElement("canvas");
      scan.width = 1080; scan.height = 1920;
      const scanCtx = scan.getContext("2d", { willReadFrequently: true });
      if (!scanCtx) throw new Error("정보판 분석을 시작할 수 없습니다.");
      scanCtx.drawImage(source, 0, 0, 1080, 1920);
      const pixels = scanCtx.getImageData(0, 0, 1080, 1920).data;
      let left = 1080, top = 1920, right = -1, bottom = -1;
      let hasTransparency = false;
      // Ignore barely visible antialiasing noise, but include soft card shadows in fitting.
      for (let y = 0; y < 1920; y += 2) {
        for (let x = 0; x < 1080; x += 2) {
          const alpha = pixels[(y * 1080 + x) * 4 + 3];
          if (alpha < 245) hasTransparency = true;
          if (alpha < 12) continue;
          left = Math.min(left, x); right = Math.max(right, x + 1);
          top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
        }
      }
      if (!hasTransparency) throw new Error("정보판이 불투명해 공통 배경을 가립니다. GPT에서 투명 배경(RGBA)으로 다시 제작해주세요.");
      if (right < left || bottom < top) throw new Error("투명 이미지에서 정보판 내용을 찾을 수 없습니다.");
      const canvas = document.createElement("canvas");
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("정보판 변환에 실패했습니다.");
      const needsFit = bottom > 1320 || left < 0 || right > 1080;
      if (!needsFit) {
        // Already inside the subtitle safe boundary: retain the artist's original placement.
        ctx.drawImage(scan, 0, 0);
      } else {
        // Preserve every visible pixel (including shadows), aspect ratio and centered position.
        // Allow a maximum content width of 1000px and content height of 1220px.
        const scale = Math.min(1, 1000 / (right - left), 1220 / (bottom - top));
        const dx = 540 - (left + right) * scale / 2;
        const dy = Math.min(80, top * scale) - top * scale;
        ctx.drawImage(scan, dx, dy, 1080 * scale, 1920 * scale);
      }
      const overlay = canvas.toDataURL("image/png");
      setShortsCustomOverlays(prev => prev.map((src, i) => i === index ? overlay : src));
      setShortsPreview(""); setShortsPreviewFrames([]);
      setShortsOverlayNotice(String(index + 1) + "번 GPT 정보판을 적용했습니다. 자막 영역을 침범하면 내용이 잘리지 않도록 자동 축소·상향 배치합니다. 한글·숫자는 미리보기에서 검토하세요.");
      setError("");
    } catch (e: any) { setError(e.message || "정보판 업로드에 실패했습니다."); }
  }

  function openShortsScriptMaker() {
    setPhase("script");
    openGPT(shortsScriptPrompt());
  }

  function openShortsSceneMaker() {
    setPhase("analysis");
    openGPT(shortsSilentPrompt());
  }

  function shortsVoicePrompt() {
    return [
      "[집값쓱 쇼츠 AI 음성 제작]",
      `주제: ${projectTitle || "아래 대본의 핵심 주제"}`,
      "",
      "[음성 기준]",
      "- 아래 대본 그대로 한국어 내레이션 음성으로 제작",
      "- 부동산 정보 쇼츠에 어울리는 자연스럽고 또렷한 톤",
      "- 광고처럼 과하게 흥분된 톤은 피하고 신뢰감 있게",
      "- 아래 'AI 음성용 대본'은 사이트에서 발음용으로 이미 변환한 최종 원고이므로 숫자·단위·금액 표현을 다시 바꾸지 말 것",
      "- 숫자, 금액, 단지명, 지역명은 적힌 그대로 정확하게 발음",
      "- 대본의 띄어쓰기는 고유명사 발음 단위이므로 최대한 그대로 반영",
      "- 쉼표에서는 아주 짧게 쉬고, 마침표에서는 한 호흡 쉬어 자연스럽게 연결",
      "- '집.값.쓱.'처럼 마침표로 나눈 표현은 각 음절을 또렷하게 끊어 읽을 것",
      "- 짧고 빠른 정보 전달형 템포",
      "- 음성 파일 자체는 원본 속도로 생성해도 됨. 최종 쇼츠 편집 단계에서 정확히 1.4배속 적용 예정",
      "- BGM, 효과음 없이 내레이션 음성만 출력",
      "- MP3 또는 WAV 파일로 제공",
      "- 대본을 요약하거나 바꾸지 말 것",
      "",
      "[AI 음성용 대본]",
      shortsVoiceScript.trim()
    ].join("\n");
  }

  function formatSrtTime(seconds: number) {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const milli = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
  }

  function shortsSrt() {
    return oneLineSrt(sceneTimeline, line => toKoreanVoiceScript(line).replace(/\s/g, "").length);
  }

  function overlayFileName(order: number) {
    return String(order).padStart(2, "0") + "_overlay.png";
  }

  function shortsEditPlanExport() {
    return [
      "방식: 하나의 background.png를 영상 전 구간에 정지 상태로 표시.",
      "배경 줌, 패닝, 새 배경 생성 금지. 1080×1920, 9:16.",
      "투명 PNG는 overlays 폴더의 각 파일을 순서대로 합성. 정보판만 단순 컷 또는 0.2초 페이드.",
      "자막은 투명 정보판에 포함되지 않음. subtitles_full.srt를 영상 상단 기준 Y 1450~1660에 1줄만 표시.",
      "Y 1720~1920은 쇼츠 UI 여유 공간으로 비워둘 것.", "",
      ...sceneTimeline.map(item => [
        "장면 " + item.scene.order + " · " + item.start.toFixed(3) + "~" + item.end.toFixed(3) + "초",
        "공통 배경: background.png",
        "정보판: overlays/" + overlayFileName(item.scene.order),
        "종류: " + item.scene.screenType,
        "큰 문구: " + cleanSceneField(item.scene.headline),
        "내레이션: " + item.scene.narration,
        "데이터행: " + (item.scene.dataRows || "")
      ].join("\n"))
    ].join("\n\n");
  }

  function shortsAudioPlanExport() {
    return [
      voiceDuration
        ? `음성 원본: ${voiceDuration.toFixed(1)}초 → 반드시 1.4배속 → 최종 약 ${finalVoiceDuration.toFixed(1)}초`
        : "음성: 반드시 1.4배속 적용",
      "BGM: 보컬 없이 사용하고 내레이션이 항상 명확하게 들리도록 낮게 유지",
      "권장 BGM 레벨: 내레이션보다 약 18~24dB 낮게 시작하고, 말하는 동안 더 낮춰도 됨",
      "효과음: 기본적으로 사용하지 않음",
      "영상 전체 길이는 1.4배속 적용된 음성 길이를 기준으로 맞출 것",
      "장면 경계는 사용자가 최종 음성에 맞춰 보정한 값을 반영합니다. 자막 큐 내부 구간은 한글 발음 길이에 따른 추정치이므로 최종 청취 확인 필요"
    ].join("\n");
  }

  function shortsTimelineExport() {
    return sceneTimeline.map(item => [
      `장면 ${item.scene.order} · ${item.start.toFixed(1)}~${item.end.toFixed(1)}초`,
      `내레이션: ${item.scene.narration}`,
      `큰 문구: ${item.scene.headline}`,
      `하단 자막: ${item.scene.subtitle}`,
      `화면: ${item.scene.screenType}`
    ].join("\n")).join("\n\n");
  }

  function shortsSceneExport() {
    // Export the recovered, source-verified rows rather than the old blank plan.
    return resolvedShortsScenes.map(scene => {
      const timing = sceneTimeline.find(t => t.scene.order === scene.order);
      return [
        `장면 ${scene.order}${timing ? ` · ${timing.start.toFixed(1)}~${timing.end.toFixed(1)}초` : ""}`,
        `내레이션: ${scene.narration}`,
        `큰 문구: ${scene.headline}`,
        `하단 자막: ${scene.subtitle}`,
        `화면: ${scene.screenType}`,
        `데이터행: ${scene.dataRows || ""}`
      ].join("\n");
    }).join("\n\n");
  }

  function shortsTimingRevisionPrompt() {
    return [
      "[집값쓱 쇼츠 V3 · 7장면 시간 재분배 요청]",
      "주제: " + (projectTitle || "아래 원본 대본의 핵심 주제"),
      "",
      "[수정 목표]",
      "- 완성된 원본 대본의 문구·순서·문장·숫자·단위를 바꾸거나 누락하거나 중복하지 마세요.",
      "- 7장면 구성 유지. 총 영상 길이와 음성 속도 1.4배속을 유지하세요.",
      "- 장면 3(핵심 수치)과 4(가격 그래프)는 각각 최대 7초, 나머지 장면은 각각 최대 6초로 배분하세요.",
      "- 장면 경계에서 내레이션을 자연스럽게 옮기되 모든 원본 문장은 순서대로 정확히 한 번씩 등장해야 합니다.",
      "- 내레이션은 [원본 완성 대본]에서 문구를 문자 그대로 잘라 사용하세요. 조사·숫자·단위·기호(예: ~, ㎡, %)·브랜드 멘트의 표기까지 다시 쓰거나 요약하지 마세요.",
      "- 내레이션 7개만 순서대로 이어서 공백과 문장부호를 제외한 글자가 원본과 동일한지 검산하세요. 누락·중복이 있다면 출력 전에 고치세요.",
      "- 이동한 내레이션에 맞춰 큰 문구·하단 자막·화면 방식·데이터행도 함께 갱신하세요.",
      "- 하단 자막은 해당 장면 내레이션 전체와 동일하게 입력합니다. 실제 영상에서는 사이트가 1줄씩 분할합니다.",
      "- 원문에 없는 새 수치나 데이터는 만들지 마세요. 그래프·표의 데이터행은 해당 장면과 실제로 대응해야 합니다.",
      "- 영상은 공통 배경 1장 + 투명 정보판 7장 방식 그대로 유지합니다.",
      "",
      "[현재 시간 초과 장면]",
      ...shortsLongScenes.map(item => `장면 ${item.scene.order}: ${item.duration.toFixed(2)}초 (허용 ${item.scene.order === 3 || item.scene.order === 4 ? 7 : 6}초)`),
      "",
      "[현재 타임라인 · 최종 1.4배속 기준]",
      shortsTimelineExport(),
      "",
      "[원본 완성 대본 · 아래 문구 그대로 보존]",
      shortsScript,
      "",
      "[기존 7장면 · 데이터행까지 확인]",
      shortsSceneExport(),
      "",
      "[출력 형식]",
      "장면 1부터 7까지 빠짐없이 아래 형식을 반복해 주세요. 사이트의 3단계 장면표 입력란에 결과를 붙여넣을 예정입니다.",
      "[장면 1]",
      "내레이션: ...",
      "큰문구: ...",
      "하단자막: ...",
      "화면방식: ...",
      "데이터행: ...",
      "",
      "최종 점검: 7장면 내레이션을 순서대로 합쳤을 때 원본 완성 대본과 정확히 일치해야 합니다."
    ].join("\n");
  }

  function shortsBackgroundDataUrl() {
    const image = tasks.find(t => t.assetKind !== "graphic");
    return image?.sourceDataUrl || image?.imageDataUrl || "";
  }

  async function composeShortsBackground() {
    const source = shortsBackgroundDataUrl();
    if (!source) throw new Error("공통 아파트 배경 한 장을 업로드하세요.");
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("배경 캔버스를 생성할 수 없습니다.");
    drawCover(ctx, image, 1080, 1920);
    return canvas.toDataURL("image/png");
  }

  async function composeShortsSceneFrame(scene: ShortsScene, background: string, withCaption = true) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("장면 미리보기를 만들 수 없습니다.");
    const base = await loadImage(background);
    ctx.drawImage(base, 0, 0, 1080, 1920);
    const overlay = await loadImage(shortsCustomOverlays[scene.order - 1] || await renderShortsOverlay(scene));
    ctx.drawImage(overlay, 0, 0, 1080, 1920);
    // Thumbnail uses exactly the same background and scene-01 overlay, minus subtitles.
    const caption = withCaption ? (splitOneLineCaptions(scene.narration || scene.subtitle)[0] || "") : "";
    if (caption) {
      // First cue preview. Final video uses every cue from subtitles_full.srt.
      const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.font = '800 86px ' + fontFamily;
      const measured = ctx.measureText(caption).width;
      const fontSize = Math.min(86, Math.max(45, Math.floor(86 * 910 / Math.max(measured, 1))));
      ctx.font = '800 ' + fontSize + 'px ' + fontFamily;
      ctx.fillStyle = "rgba(0,0,0,.84)";
      ctx.beginPath(); ctx.roundRect(45, 1468, 990, 170, 28); ctx.fill();
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffffff";
      ctx.fillText(caption, 540, 1553, 910);
    }
    return canvas.toDataURL("image/png");
  }

  async function composeShortsContactSheet(frames: Array<{ order: number; dataUrl: string }>) {
    const cols = 3;
    const thumbW = 216;
    const thumbH = 384;
    const gap = 24;
    const top = 56;
    const labelH = 34;
    const rows = Math.ceil(frames.length / cols);
    const canvas = document.createElement("canvas");
    canvas.width = gap + cols * (thumbW + gap);
    canvas.height = top + rows * (thumbH + labelH + gap);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("콘택트시트를 만들 수 없습니다.");

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = '800 24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText("집값쓱 쇼츠 · 장면 흐름 미리보기", gap, 18);

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gap + col * (thumbW + gap);
      const y = top + row * (thumbH + labelH + gap);
      const img = await loadImage(frame.dataUrl);
      ctx.drawImage(img, x, y, thumbW, thumbH);
      ctx.fillStyle = "#111827";
      ctx.font = '700 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`장면 ${frame.order}`, x, y + thumbH + 8);
    }

    return canvas.toDataURL("image/png", 0.92);
  }

  async function previewShortsCards() {
    setLoading(true); setError("");
    if (shortsDataIssues.length) { setError(shortsDataIssues.join(" / ")); setLoading(false); return; }
    try {
      if (!shortsVisualReady || shortsScenes.length !== 7) throw new Error("공통 배경과 7장면을 먼저 준비해주세요.");
      const background = await composeShortsBackground();
      const frames: Array<{ order: number; dataUrl: string }> = [];
      for (const scene of resolvedShortsScenes) frames.push({ order: scene.order, dataUrl: await composeShortsSceneFrame(scene, background) });
      setShortsPreviewFrames(frames.map(f => f.dataUrl)); setShortsPreviewIndex(0);
      setShortsPreview(await composeShortsContactSheet(frames));
    } catch (e: any) { setError(e.message || "정보판 미리보기 생성에 실패했습니다."); }
    finally { setLoading(false); }
  }

  function shortsVideoPrompt() {
    return [
      "[집값쓱 쇼츠 V3 · 고정 배경 + 정보판 최종 조립]",
      "주제: " + (projectTitle || "첨부 패키지의 주제"), "",
      "[첨부 파일 확인]",
      "- 이 요청서와 함께 사이트에서 다운로드한 빠른 조립 ZIP 파일 1개를 GPT 대화에 직접 첨부하세요.",
      "- 첨부 ZIP이 보이지 않거나 필수 파일이 없다면 임의 영상 제작을 시작하지 말고 재첨부를 요청하세요.",
      "- scene_contact_sheet.png는 검수용 미리보기이며 영상 레이어로 사용하지 마세요.",
      "",
      "[ZIP 내용만 정확하게 조립할 것]",
      "- background.png는 영상 시작부터 종료까지 한 장으로 고정. 절대 움직이거나 다른 배경으로 교체하지 말 것.",
      "- overlays/01_overlay.png ~ 07_overlay.png는 투명 RGBA 파일. edit_plan.txt 시간에 맞춰 같은 배경 위에서만 바꿔 표시.",
      "- 투명 정보판에는 이미 코드로 그린 정확한 한글·숫자와 그래프가 있음. 새 그래프·숫자·문구 생성 금지.",
      "- 각 정보판이 사라지고 다음 정보판이 나타나는 효과는 0.2초 이내의 페이드 또는 단순 컷만 사용.",
      "- subtitles_full.srt는 최종 1.4배속 음성 전체 길이, 한글 발음 길이와 보정된 장면 경계를 반영한 1줄 자막입니다. 숫자/대사를 바꾸지 말고 큐를 사용하되 실제 음성을 들으며 싱크를 최종 확인하세요.",
      "- 모든 자막은 동일한 고정 위치 X540/Y1553(1080×1920) 중앙 정렬, Y1450~1660 범위에 정확히 1줄만 표시하세요.",
      "- 자막 글꼴은 굵은 고딕 ExtraBold, 기본 86px(기존 47px보다 약 1.8배), 흰색에 짙은 그림자. 긴 단지명·숫자는 잘라내거나 두 줄로 넘기지 말고 해당 큐의 글꼴만 너비 910px 안에 비례 축소하세요.",
      "- 자막 배경은 모든 장면에서 X45~1035/Y1468~1638의 동일한 짙은 반투명 둥근 박스를 사용하세요. 위치·높이·기준선을 장면마다 바꾸지 마세요.",
      "- Y 1720~1920은 쇼츠 UI 영역이므로 비워두기.",
      "- voice.mp3 또는 voice.wav는 정확히 1.4배속 적용. SRT 속도를 다시 바꾸지 않기.",
      "- bgm.mp3 또는 bgm.wav는 audio_plan.txt 기준으로 음성보다 충분히 낮게 재생.",
      "- 모든 레이어는 마지막 음성과 마지막 자막이 끝나는 지점에서 동시에 종료.",
      "", "[편집표]", shortsEditPlanExport()
    ].join("\n");
  }

  async function readAudioDuration(file: File) {
    return await new Promise<number>((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        URL.revokeObjectURL(url);
        resolve(duration);
      };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      audio.src = url;
    });
  }

  async function handleVoiceFile(file: File | null) {
    setVoiceFile(file);
    setVoiceFileForScript(file ? shortsVoiceScript : null);
    setSceneBoundaryOverrides(null);
    setShortsPreview("");
    setVoiceDuration(0);
    setVoiceDuration(file ? await readAudioDuration(file) : 0);
  }

  function packageAudioFileName(kind: "voice" | "bgm", file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".wav") || file.type.includes("wav")) return `${kind}.wav`;
    return `${kind}.mp3`;
  }

  async function downloadShortsThumbnail() {
    setLoading(true); setError("");
    try {
      const cover = resolvedShortsScenes.find(scene => scene.order === 1);
      if (!cover) throw new Error("01번 썸네일 장면을 먼저 준비하세요.");
      if (!shortsVisualReady) throw new Error("공통 아파트 배경 한 장을 먼저 업로드하세요.");

      // Reuse the first video frame's exact layering, but omit spoken captions.
      // This is a standalone 1080×1920 PNG and must NOT be added to the ZIP.
      const background = await composeShortsBackground();
      const thumbnail = await composeShortsSceneFrame(cover, background, false);
      const link = document.createElement("a");
      link.href = thumbnail;
      link.download = "thumbnail.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      setError(e.message || "썸네일 PNG 다운로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function exportShortsPackage(includeSources = false) {
    setLoading(true); setError("");
    try {
      if (!shortsAssemblyReady) {
        const problems = [
          !shortsSceneCountReady && "정확히 7장면이 필요합니다.",
          !shortsScriptReady && "장면 내레이션 전체와 원본 대본이 일치하지 않습니다.",
          !shortsVisualReady && "공통 배경을 업로드하세요.",
          !shortsCaptionReady && "내레이션이 비어 있습니다.",
          !voiceFile && "음성 파일을 첨부하세요.",
          shortsVoiceDigitsRemain && "음성용 대본에 아라비아 숫자가 남아 있습니다.",
          !!voiceFile && !voiceMatchesScript && "발음용 대본 변경 후 음성 파일을 다시 생성·업로드하세요.",
          ...shortsDataIssues
        ].filter(Boolean);
        throw new Error(problems.join(" / ") || "제작 패키지 검수가 완료되지 않았습니다.");
      }
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder(cleanName(projectTitle || "jibssuk-shorts"))!;
      const background = await composeShortsBackground();
      const backgroundMatch = background.match(/^data:image\/png;base64,(.+)$/);
      if (!backgroundMatch) throw new Error("공통 배경 PNG 변환에 실패했습니다.");
      folder.file("background.png", backgroundMatch[1], { base64: true });

      const frames: Array<{ order: number; dataUrl: string }> = [];
      for (const scene of resolvedShortsScenes) {
        const overlay = shortsCustomOverlays[scene.order - 1] || await renderShortsOverlay(scene);
        const match = overlay.match(/^data:image\/png;base64,(.+)$/);
        if (!match) throw new Error("장면 " + scene.order + " 정보판 PNG 출력에 실패했습니다.");
        folder.file("overlays/" + overlayFileName(scene.order), match[1], { base64: true });
        frames.push({ order: scene.order, dataUrl: await composeShortsSceneFrame(scene, background) });
      }
      const contactSheet = await composeShortsContactSheet(frames);
      const contactMatch = contactSheet.match(/^data:image\/png;base64,(.+)$/);
      if (contactMatch) folder.file("scene_contact_sheet.png", contactMatch[1], { base64: true });

      if (includeSources) {
        const original = tasks[0]?.sourceDataUrl || tasks[0]?.imageDataUrl || "";
        const originalMatch = original.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (originalMatch) folder.file("source_background." + (originalMatch[1].includes("jpeg") ? "jpg" : "png"), originalMatch[2], { base64: true });
        folder.file("display_script.txt", shortsScript);
        folder.file("voice_script.txt", shortsVoiceScript);
        folder.file("scene_plan.txt", shortsSceneExport());
        folder.file("timeline.txt", shortsTimelineExport());
        if (bgmMemo.trim()) folder.file("bgm_note.txt", bgmMemo.trim());
      }
      folder.file("overlay_data.json", JSON.stringify(resolvedShortsScenes.map(s => ({
        order: s.order, headline: cleanSceneField(s.headline), screenType: s.screenType,
        dataRows: parseOverlayRows(s.dataRows || "").map(r => ({ label: r.label, value: r.value }))
      })), null, 2));
      folder.file("README.txt", [
        "집값쓱 V3: 공통 background.png + 투명 overlays 7장.",
        "scene_contact_sheet.png는 자막 위치를 포함한 확인용이며 영상 소재로 사용하지 마세요.",
        "GPT에서 만든 개별 투명 정보판을 업로드했다면 그 파일을 우선 사용하며, 없는 장면은 기존 코드 렌더링으로 보완합니다.",
        "투명 오버레이 자체에는 자막이 들어 있지 않습니다.",
        "자막은 subtitles_full.srt의 1줄짜리 큐를 edit_plan.txt 기준으로 별도 합성합니다.",
        "업로드 정보판은 내용이 잘리지 않도록 Y 1320 이내로 자동 맞춤 처리되며, 자막은 Y 1450~1660에 배치합니다.",
        "shorts_request.txt는 ZIP을 GPT에 첨부하여 영상을 최종 조립할 때, youtube_upload_request.txt는 완성 영상의 유튜브 업로드 문구를 만들 때 사용합니다."
      ].join("\n"));
      if (voiceFile) folder.file(packageAudioFileName("voice", voiceFile), voiceFile);
      if (bgmFile) folder.file(packageAudioFileName("bgm", bgmFile), bgmFile);
      folder.file("subtitles_full.srt", shortsSrt());
      folder.file("edit_plan.txt", shortsEditPlanExport());
      folder.file("audio_plan.txt", shortsAudioPlanExport());
      folder.file("shorts_request.txt", shortsVideoPrompt());
      folder.file("youtube_upload_request.txt", shortsUploadPrompt());

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = cleanName(projectTitle || "jibssuk-shorts") + (includeSources ? "_backup_package" : "_quick_assembly") + "_v3.zip";
      link.click(); URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "V3 조립용 ZIP 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function shortsUploadPrompt() {
    return [
      "[집값쓱 YouTube Shorts 전체 업로드 패키지 제작]",
      `주제: ${projectTitle || "아래 대본의 핵심 주제"}`,
      "",
      "[공통 제작 원칙]",
      "- 실제 유튜브 업로드 화면에 복사할 문구와 설정 안내를 한 번에 작성한다. 영상 제작 또는 자동 업로드를 요청하는 것이 아니다.",
      "- 검색 키워드(지역명·단지명·실거래가·거래량 등)는 원문에 해당하는 내용만 자연스럽게 사용한다.",
      "- 완성 대본과 원문에 없는 숫자·날짜·순위·가격·단지 정보·검증되지 않은 사실은 추가하지 않는다.",
      "- 거래량과 가격의 조사 기간 또는 평형 기준이 서로 다르면 반드시 구분해 쓴다.",
      "- 과장·낚시성 표현, 투자 성과 보장, 매수·매도 권유를 금지한다.",
      "- 문구는 짧고 또렷한 한국어로, 실제 입력란에 바로 붙여넣을 수 있도록 작성한다.",
      "- 해시태그(# 포함)와 동영상 검색 태그(# 없음)는 서로 다른 항목으로 구분한다.",
      "- 아래 01~07 섹션을 빠짐없이 출력하고, 제목·설명·검색 태그·댓글은 별도 복사가 쉽게 작성한다.",
      "",
      "[필수 출력 형식]",
      "01. 영상 제목 3개: 검색형(추천) / 비교형 / 정보형으로 작성하고, 추천 제목 1개를 명시한다.",
      "02. 영상 설명란: 핵심 사실 2~3문장. 비교 기준이 다르면 짧은 주의 문구를 덧붙인다. 설명란에 붙일 해시태그 5~8개를 맨 아래 별도 한 줄로 제공한다.",
      "03. 동영상 검색 태그: 원문에 등장하는 지역·단지·지표와 관련된 태그를 쉼표로 구분한 복사용 한 줄로 제공한다. # 기호 없이 작성하며 무관하거나 중복된 키워드는 넣지 않는다.",
      "04. 고정댓글 1개: 핵심 내용을 간단히 상기시키고 시청자가 답할 수 있는 자연스러운 질문 1개를 넣는다. 비교 기준 주의가 필요하면 짧게 덧붙인다.",
      "05. 썸네일: 집값쓱 01번 장면에 사용할 짧은 문구 1~2줄과 9:16 화면 기준을 제안한다. 실제 쇼츠 업로드 화면에서 가능한 대표 프레임 선택 방식으로 안내하고, 외부 이미지를 직접 업로드할 수 있다고 단정하지 않는다.",
      "06. 유튜브 업로드 기본 설정: 항목/권장 설정/확인할 사항의 간단한 표를 만든다. 콘텐츠 형식(Shorts), 재생목록(집값쓱｜아파트 실거래가, 없으면 생성), 카테고리(교육), 영상 언어·제목/설명 언어(한국어), 아동용 여부(일반 부동산 정보는 아동용 아님), 연령 제한, 유료 프로모션(실제 협찬 여부 확인), 변경·합성 콘텐츠 공개(실제처럼 보이는 AI 합성 장면이 시청자를 오인시킬 수 있는 경우 해당 정책에 따라 표시), 라이선스, 댓글, 좋아요 수, 공개/예약, Shorts 리믹스, 관련 동영상을 포함한다. 사용자 계정에 따라 달라지는 값은 임의로 확정하지 않는다.",
      "07. 업로드 최종 체크리스트: 9:16 비율, 음성 1.4배속, 7장 장면·전환, 하단 자막 및 정보판 잘림, 숫자·단지명·비교 기준, 썸네일/대표 프레임, 제목·설명·해시태그·별도 검색 태그, BGM·이미지 사용권, 시청자/유료 프로모션/AI 표시, 저작권 검사, 공개/예약, 업로드 후 고정댓글 등록을 체크박스로 제공한다.",
      "",
      "[완성 대본]",
      shortsScript.trim(),
      "",
      "[원문 자료]",
      rawContent.trim()
    ].join("\n");
  }

  async function copyAllPrompts() {
    try { await navigator.clipboard.writeText(tasks.map(promptFor).join("\n\n====================\n\n")); alert(`${tasks.length}장 요청문을 한 번에 복사했습니다.`); }
    catch { setError("클립보드 복사에 실패했습니다."); }
  }

  async function handleBulk(files: FileList | null) {
    if (!files?.length) return;
    setLoading(true); setError("");
    try {
      const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
      const next = [...tasks];
      for (let i = 0; i < Math.min(sorted.length, next.length); i++) {
        const src = await fileToDataUrl(sorted[i]);
        if (isShorts) {
          next[i] = { ...next[i], sourceDataUrl: src, imageDataUrl: src, replaced: true, done: true };
        } else {
          const composed = await composeImage(src, next[i], contentType);
          next[i] = { ...next[i], sourceDataUrl: src, imageDataUrl: composed, replaced: true, done: true };
        }
      }
      setTasks(next);
      setCurrentIndex(0);
    } catch (e: any) { setError(e.message || "이미지 일괄 처리에 실패했습니다."); }
    finally { setLoading(false); if (bulkRef.current) bulkRef.current.value = ""; }
  }

  async function replaceOne(file: File) {
    if (!current) return;
    setLoading(true); setError("");
    try {
      const src = await fileToDataUrl(file);
      if (isShorts) {
        updateTask(currentIndex, { sourceDataUrl: src, imageDataUrl: src, replaced: true, done: true });
      } else {
        const composed = await composeImage(src, current, contentType);
        updateTask(currentIndex, { sourceDataUrl: src, imageDataUrl: composed, replaced: true, done: true });
      }
    } catch (e: any) { setError(e.message || "이미지 처리에 실패했습니다."); }
    finally { setLoading(false); }
  }

  async function recomposeCurrent() {
    if (!current?.sourceDataUrl) return;
    setLoading(true); setError("");
    try {
      const composed = await composeImage(current.sourceDataUrl, current, contentType);
      updateTask(currentIndex, { imageDataUrl: composed, done: true });
    } catch (e: any) { setError(e.message || "문구 재합성에 실패했습니다."); }
    finally { setLoading(false); }
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= tasks.length || to >= tasks.length) return;
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((t, i) => ({ ...t, order: i }));
    setTasks(renumbered);
    setCurrentIndex(to);
  }

  async function uploadImage(dataUrl: string, userId: string, project: string, order: number) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return dataUrl.startsWith("https://") ? dataUrl : "";
    const ext = match[1].includes("jpeg") ? "jpg" : match[1].includes("webp") ? "webp" : match[1].includes("svg") ? "svg" : "png";
    const raw = atob(match[2]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const { supabase } = await ensureAnonymousSession();
    const path = `${userId}/${project}/${String(order).padStart(2, "0")}.${ext}`;
    const { error } = await supabase.storage.from("content-maker-assets").upload(path, bytes, { contentType: match[1], upsert: true });
    if (error) throw error;
    return supabase.storage.from("content-maker-assets").getPublicUrl(path).data.publicUrl;
  }

  async function saveCloud() {
    setLoading(true); setError("");
    try {
      const { supabase, session } = await ensureAnonymousSession();
      const payload = {
        user_id: session.user.id,
        content_type: contentType === "Paramma 블로거" ? `Paramma 블로거 · ${parammaCategory}` : contentType,
        project_title: projectTitle || analysis?.recommendedTitle || "새 콘텐츠",
        raw_content: rawContent,
        memo: isShorts ? shortsScript : "",
        recommended_title: analysis?.recommendedTitle || "",
        template_key: "overlay-v7",
        final_title: finalTitle,
        final_body: finalBody,
        status: phase === "done" ? "done" : "draft",
        analysis_json: analysis || {},
        updated_at: new Date().toISOString(),
      };
      let pid = projectId;
      if (pid) {
        const { error } = await supabase.from("projects").update(payload).eq("id", pid);
        if (error) throw error;
        await supabase.from("image_tasks").delete().eq("project_id", pid);
      } else {
        const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
        if (error) throw error;
        pid = data.id; setProjectId(pid);
      }
      const rows = [];
      for (const t of tasks) {
        const url = t.imageDataUrl ? await uploadImage(t.imageDataUrl, session.user.id, pid!, t.order) : (t.imageUrl || "");
        rows.push({ project_id: pid, user_id: session.user.id, order_no: t.order, section_title: t.title, key_message: t.keyMessage, source_text: t.sourceText, image_prompt: t.imagePrompt, image_url: url, status: t.done ? "done" : "pending", replaced: t.replaced });
      }
      if (rows.length) {
        const { error } = await supabase.from("image_tasks").insert(rows);
        if (error) throw error;
      }
      await refreshSaved();
      alert("클라우드에 저장했습니다.");
    } catch (e: any) { setError(e.message || "저장 실패"); }
    finally { setLoading(false); }
  }

  async function loadProject(id: string) {
    setLoading(true); setError("");
    try {
      const { supabase } = await ensureAnonymousSession();
      const { data: p, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: imgs, error: ie } = await supabase.from("image_tasks").select("*").eq("project_id", id).order("order_no");
      if (ie) throw ie;
      setProjectId(id);
      const savedType = String(p.content_type || "");
      if (savedType.startsWith("Paramma 블로거 · ")) {
        setContentType("Paramma 블로거");
        setParammaCategory(savedType.replace("Paramma 블로거 · ", "") || "신기한 동물이야기");
      } else if (savedType === "동물·자연") {
        setContentType("Paramma 블로거");
        setParammaCategory("신기한 동물이야기");
      } else {
        setContentType(savedType);
      }
      setProjectTitle(p.project_title); setRawContent(p.raw_content); setFinalTitle(p.final_title || p.recommended_title || ""); setFinalBody(p.final_body || ""); setShortsScript(savedType === "집값쓱 쇼츠" ? (p.memo || "") : ""); setShortsCustomOverlays(Array(7).fill("")); setAnalysis(p.analysis_json);
      setTasks((imgs || []).map((x: any) => ({ order: x.order_no, title: x.section_title, keyMessage: x.key_message, sourceText: x.source_text, imagePrompt: x.image_prompt, imageDataUrl: x.image_url, imageUrl: x.image_url, done: x.status === "done", replaced: x.replaced })));
      setCurrentIndex(0); setPhase((imgs || []).length ? "images" : "analysis");
    } catch (e: any) { setError(e.message || "불러오기 실패"); }
    finally { setLoading(false); }
  }

  function buildFinalBody() {
    const paragraphs = rawContent.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    const thumb = tasks.find(t => t.order === 0);
    const bodyTasks = tasks.filter(t => t.order !== 0);
    const out: string[] = [];
    if (thumb) out.push(`[대표 이미지 00 - ${thumb.title}]`);
    paragraphs.forEach((p, i) => {
      out.push(p);
      const markerIndexes = bodyTasks.filter((_, idx) => Math.min(paragraphs.length - 1, Math.floor(((idx + 1) * paragraphs.length) / (bodyTasks.length + 1))) === i);
      markerIndexes.forEach(t => out.push(`[본문 이미지 ${String(t.order).padStart(2, "0")} - ${t.title}]`));
    });
    return out.join("\n\n");
  }

  function prepareFinal() {
    setFinalBody(buildFinalBody());
    setPhase("done");
  }

  async function exportZip() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectTitle, contentType: effectiveContentType, finalTitle, finalBody, tasks, templateKey: "overlay-v7" }) });
      if (!r.ok) throw new Error("ZIP 생성 실패");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${cleanName(projectTitle || finalTitle || "content-maker")}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message || "ZIP 오류"); }
    finally { setLoading(false); }
  }

  return <main className="wrap">
    <header className="header">
      <button className="brandBtn" onClick={resetNew}><span className="brand">콘텐츠 메이커</span><span className="badge">V13 · 정보판 가독성 V4</span></button>
      <div className="inlineActions">
        <a className="presaleNavLink" href="/apartment-presale/discover">🔎 관심 분양 찾기</a>
        <a className="presaleNavLink" href="/presale-v1">🏙️ 분양 제작실 V2</a>
        <button className="secondary compact" onClick={() => window.location.href = "/google-blog-schedule/lab"}>🔬 AI 실전 검증실</button>
        <button className="secondary compact" onClick={() => window.location.href = "/google-blog-schedule"}>📅 구글 블로그 스케줄</button>
        <button className="secondary compact" onClick={saveCloud} disabled={loading || phase === "home"}>☁ 저장</button>
      </div>
    </header>

    <section className="hero">
      <div><h1>{isShorts ? "집값쓱 쇼츠 제작기" : "AI 이미지는 밖에서, 정리·문구·검수·ZIP은 여기서"}</h1><p>{isShorts ? "자료 → 대본 → 정보판 7장 → 배경·음성 → 고정 배경 조립" : "본문 분석 → 이미지 요청서 → 일괄 업로드 → 정확한 문구 자동 합성 → 검수 → 네이버/쇼츠 규격 ZIP"}</p></div>
      <div className="heroPill">{preset.label}</div>
    </section>

    {phase === "home" && <section className="contentHub">
      <div className="contentHubHead">
        <div>
          <span>집값쓱 · 아파트 블로그 콘텐츠메이커</span>
          <h2>오늘 만들 글을 고르세요</h2>
          <p>각 카테고리에서 추천 후보 2개를 보고 바로 제작을 시작하는 구조로 바꾸고 있습니다.</p>
        </div>
        <span className="contentHubVersion">V1</span>
      </div>
      <div className="contentHubTabs">
        <a className="contentHubTab active" href="/apartment-v1">
          <span className="contentHubIcon">🏢</span>
          <b>아파트 단지 글</b>
          <small>거래량 추천 2개 · 새 제작 흐름</small>
        </a>
        <a className="contentHubTab" href="/presale-v1">
          <span className="contentHubIcon">🏙️</span>
          <b>분양 글</b>
          <small>후보 10개 · 파트별 조사 · 최종 원고</small>
        </a>
        <button className="contentHubTab" type="button" disabled>
          <span className="contentHubIcon">💰</span>
          <b>금융·재테크 글</b>
          <small>다음 구현</small>
        </button>
        <button className="contentHubTab" type="button" disabled>
          <span className="contentHubIcon">💡</span>
          <b>부동산 꿀팁</b>
          <small>다음 구현</small>
        </button>
      </div>
      <div className="contentHubFocus">
        <div>
          <strong>아파트 단지 글 V1</strong>
          <p>올해 누적 실거래 기준 추천 단지 2개 → 평형별 가격 → 구조 확인 → 생활 킥 1개 → 최종 원고까지 한 화면에서 진행합니다.</p>
        </div>
        <a href="/apartment-v1">추천 단지 2개 보기 →</a>
      </div>
    </section>}
    {error && <div className="error">{error}</div>}

    <section className="panel">
      <div className="steps">{(isShorts ? ["자료", "대본", "이미지 7장", "제작자료", "GPT 제작"] : ["자료입력", "분석", "이미지", "검수", "완료"]).map((x, i) => {
        const active = isShorts
          ? (((phase === "home" || phase === "input") && i === 0) || (phase === "script" && i === 1) || (phase === "analysis" && i === 2) || (phase === "images" && i === 3) || ((phase === "review" || phase === "done") && i === 4))
          : (((phase === "home" || phase === "input") && i === 0) || (phase === "analysis" && i === 1) || (phase === "images" && i === 2) || (phase === "review" && i === 3) || (phase === "done" && i === 4));
        return isShorts && phase !== "home"
          ? <button key={x} type="button" className={`step stepLink ${active ? "active" : ""}`} aria-current={active ? "step" : undefined} onClick={() => { setError(""); setPhase(SHORTS_NAV_PHASES[i]); }} title={`${x} 단계 열기`}>{i + 1} {x}</button>
          : <div key={x} className={`step ${active ? "active" : ""}`}>{i + 1} {x}</div>;
      })}</div>
      {isShorts && phase !== "home" && <p className="stageHint">단계 메뉴를 누르면 자료를 아직 넣지 않아도 다음 작업을 미리 볼 수 있습니다. 실제 생성·조립은 필요한 입력이 준비된 후 가능합니다.</p>}

      {phase === "home" && <>
        <div className="sectionHead"><div><h2>무엇을 만들까요?</h2><p>카테고리를 고르면 그 작업에 맞게 이미지 구성과 규격을 준비합니다.</p></div></div>
        <div className="types">{TYPES.map(([ico, name, desc]) => <button key={name} className={`type ${contentType === name ? "sel" : ""}`} onClick={() => setContentType(name)}><span className="ico">{ico}</span><b>{name}</b><small>{desc}</small></button>)}</div>
        {contentType === "Paramma 블로거" && <div className="box parammaBox"><h3>🌿 Paramma 블로거 · 순차 발행 모드</h3><p className="muted">신기한 동물이야기 · 신비로운 자연 · 생활 속 궁금증을 한 발행 큐에 섞어 1번부터 10번까지 순서대로 진행합니다.</p></div>}
        {contentType === "AI Price Atlas" && <div className="box parammaBox"><h3>🔬 AI Price Atlas · 직접 검증 콘텐츠</h3><p className="muted">실전 테스트 PDF 생성 → 동일 질문으로 AI 3종 비교 → 원문 답변 저장 → 정답 대조 → 결과 기반 영문 글 기획. API 사용 없이 기존 AI 계정으로 진행합니다.</p></div>}
        <div className="actions"><button className="primary" onClick={() => { if (contentType === "Paramma 블로거") window.location.href = "/paramma-bulk"; else if (contentType === "AI Price Atlas") window.location.href = "/google-blog-schedule/lab"; else setPhase("input"); }}>{contentType === "Paramma 블로거" ? "발행 10개 열기" : contentType === "AI Price Atlas" ? "실전 검증 시작" : "새 작업 시작"}</button></div>
        <div className="box"><h3>저장 프로젝트</h3>{saved.length === 0 ? <div className="muted">아직 저장된 작업이 없습니다.</div> : <div className="savedList">{saved.map(p => <div className="savedItem" key={p.id}><div><b>{p.project_title}</b><small>{p.content_type}</small></div><button className="secondary compact" onClick={() => loadProject(p.id)}>불러오기</button></div>)}</div>}</div>
      </>}

      {phase === "input" && (isShorts ? <>
        <div className="sectionHead"><div><h2>1. 자료</h2><p>쇼츠로 만들 원문과 주제만 넣습니다. 입력 내용은 자동 임시저장됩니다.</p></div><span className="counter">{rawContent.trim().length}자</span></div>
        <label>쇼츠 주제</label><input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="예: 김포 아파트 8월 거래 TOP3" />
        <label>원문 자료</label><textarea value={rawContent} onChange={e => setRawContent(e.target.value)} placeholder="블로그 글이나 실거래 자료를 붙여넣으세요." />
        <div className="box">
          <h3>다음 단계에서 자동으로 지킬 기준</h3>
          <div className="tags"><span>1.4x 음성</span><span>210~225자</span><span>30~33초</span><span>질문형 시작</span><span>집.값.쓱. 고정 멘트</span><span>차이가 꽤 나죠.</span></div>
        </div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("home")}>이전</button><div className="inlineActions"><button className="secondary" disabled={rawContent.trim().length < 30} onClick={() => copyText(shortsScriptPrompt(), "쇼츠 대본 요청서를 복사했습니다.")}>📋 요청서 복사</button><button className="primary" disabled={rawContent.trim().length < 30} onClick={openShortsScriptMaker}>GPT로 대본 만들기 ↗</button></div></div>
      </> : <>
        <div className="sectionHead"><div><h2>자료 입력</h2><p>{contentType === "Paramma 블로거" ? `Paramma 블로거 · ${parammaCategory}` : "본문이 있으면 붙여넣고, 없으면 추천 주제로 시작하세요."}</p></div><span className="counter">{rawContent.trim().length}자</span></div>
        {contentType === "Paramma 블로거" && <div className="box parammaBox"><h3>카테고리 선택</h3><div className="parammaGrid compactGrid">{PARAMMA_CATEGORIES.map(([ico, name, desc]) => <button key={name} className={`parammaCard ${parammaCategory === name ? "sel" : ""}`} onClick={() => setParammaCategory(name)}><span className="ico">{ico}</span><b>{name}</b><small>{desc}</small></button>)}</div></div>}
        <div className="box"><h3>{contentType === "Paramma 블로거" ? `✨ ${parammaCategory} · 추천 발행 순서 10개` : "✨ 시작용 주제 추천"}</h3>{contentType === "Paramma 블로거" && <p className="muted">1번부터 10번까지 순서대로 진행하고, 모두 끝나면 다음 10개로 교체해서 이어갈 수 있습니다.</p>}<div className="recommendGrid">{(RECOMMENDATIONS[effectiveContentType] || []).map((item, i) => <button key={item.title} className="recommend" onClick={() => applyRecommendation(item)}><span>{i + 1}</span><div><b>{item.title}</b><small>{item.brief}</small></div></button>)}</div></div>
        <label>작업 제목</label><input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="예: 송도 아파트 시세" />
        <label>본문</label><textarea value={rawContent} onChange={e => setRawContent(e.target.value)} placeholder="본문을 붙여넣으세요. 30자 이상이면 분석할 수 있습니다." />
        {isShorts && <div className="box">
          <div className="miniHead"><h3>① 쇼츠 대본</h3><div className="inlineActions"><button className="secondary compact" disabled={rawContent.trim().length < 30} onClick={() => copyText(shortsScriptPrompt(), "쇼츠 대본 요청서를 복사했습니다.")}>📋 대본 요청서 복사</button><button className="secondary compact" onClick={() => openGPT(shortsScriptPrompt())}>↗ GPT 열기</button></div></div>
          <p className="muted">GPT에 요청서를 붙여넣고 나온 완성 내레이션만 아래에 붙여넣으세요. 기준은 1.4배속 · 공백 제외 210~225자 · 30~33초입니다. 입력 내용은 이 브라우저에 자동 임시저장됩니다.</p>
          <label>완성 대본</label>
          <textarea className="smallArea" value={shortsScript} onChange={e => setShortsScript(e.target.value)} placeholder="GPT에서 만든 완성 내레이션을 붙여넣으세요." />
          <div className="tags">
            <span>1.4x</span>
            <span>목표 30~33초</span>
            <span className={shortsCharCount >= 210 && shortsCharCount <= 225 ? "ok" : shortsCharCount ? "warn" : ""}>공백 제외 {shortsCharCount}/210~225자</span>
            {shortsCharCount > 0 && <span>글자수 기준 약 {shortsEstimatedSeconds.toFixed(1)}초</span>}
          </div>
          <p className="muted">예상 시간은 글자수 기준 참고값입니다. 최종 길이는 실제 1.4배속 TTS 파일을 기준으로 확인합니다.</p>
        </div>}
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("home")}>이전</button><button className="primary" disabled={rawContent.trim().length < 30 || loading || (isShorts && shortsScript.trim().length < 50)} onClick={analyze}>{loading ? "분석 중..." : isShorts ? "쇼츠 요청서 구성" : "본문 분석"}</button></div>
      </>)}

      {phase === "script" && isShorts && <>
        <div className="sectionHead"><div><h2>2. 대본</h2><p>GPT에서 만든 완성 내레이션만 붙여넣고 길이를 확인합니다.</p></div><span className="counter">{shortsCharCount}/210~225자</span></div>
        {rawContent.trim().length < 30 && <p className="stagePreviewNote">미리보기: 1. 자료 단계에 원문을 입력하면 GPT 대본 요청서에 자동 포함됩니다.</p>}
        <div className="box">
          <div className="miniHead"><h3>기준 대본 · 화면/자막용</h3><div className="inlineActions"><button className="secondary compact" disabled={rawContent.trim().length < 30} onClick={() => openGPT(shortsScriptPrompt())}>↗ GPT로 다시 만들기</button><button className="secondary compact" disabled={!shortsScript.trim()} onClick={() => copyText(shortsScript.trim(), "기준 대본을 복사했습니다.")}>📋 기준 대본 복사</button></div></div>
          <textarea className="shortsScriptArea" value={shortsScript} onChange={e => { setShortsScript(e.target.value); setShortsVoiceOverride(null); }} placeholder="GPT에서 만든 대본을 여기에 붙여넣으세요. 가격·면적은 6.93억, 84㎡처럼 원문 표기를 유지합니다." />
          <div className="tags">
            <span>화면 숫자 원문 유지</span>
            <span className={shortsCharCount >= 210 && shortsCharCount <= 225 ? "ok" : shortsCharCount ? "warn" : ""}>기준 대본 {shortsCharCount}자</span>
            {shortsCharCount > 0 && <span>기준 약 {shortsEstimatedSeconds.toFixed(1)}초</span>}
          </div>
          <p className="muted">이 대본이 장면표·화면 문구·자막의 데이터 기준입니다. 6.93억, 84㎡ 같은 표기를 여기서는 바꾸지 않습니다.</p>
        </div>

        {shortsScript.trim() && <div className="box voiceScriptBox">
          <div className="miniHead"><h3>AI 음성용 발음·호흡 보정</h3><div className="inlineActions"><button className="secondary compact" onClick={() => setShortsVoiceOverride(null)}>↻ 자동 보정 다시 적용</button><button className="secondary compact" onClick={() => copyText(shortsVoiceScript.trim(), "AI 음성용 대본을 복사했습니다.")}>📋 음성용 복사</button><button className="primary compact" onClick={() => openGPT(shortsVoicePrompt())}>🎙 AI 음성 만들기 ↗</button></div></div>
          <textarea className="voiceScriptEditor" value={shortsVoiceScript} onChange={e => setShortsVoiceOverride(e.target.value)} />
          <p className="muted">금액·연월·거래 건수까지 AI가 읽을 한글 발음으로 자동 변환합니다. 화면용 대본과 SRT의 아라비아 숫자는 유지합니다. 이미 업로드한 음성은 대본 수정 후 다시 생성해야 합니다.</p>
          {shortsVoiceDigitsRemain && <p className="voiceWarning">음성용 대본에 아라비아 숫자가 남아 있습니다. 한글로 직접 수정하거나 자동 보정을 다시 적용하세요.</p>}
          {!!voiceFile && !voiceMatchesScript && <p className="voiceWarning">⚠ 발음용 대본이 변경되어 기존 음성이 만료됐습니다. 수정된 음성을 다시 업로드하세요.</p>}
          <div className="tags">
            <span>1.4x 기준</span>
            <span>목표 30~33초</span>
            <span>음성용 {shortsVoiceCharCount}자 (발음 표기)</span>
            <span>시간은 실제 음성 파일 업로드 후 확인</span>
            {shortsVoiceCharCount !== shortsCharCount && <span>변환 후 {shortsVoiceCharCount > shortsCharCount ? "+" : ""}{shortsVoiceCharCount - shortsCharCount}자</span>}
          </div>
          <p className="muted">예: 6.93억 → 육억 구천삼백만 원 / 84㎡ → 팔십사 제곱미터. 음성 길이 예측은 참고용이며 실제 녹음 파일의 1.4배속 길이가 기준입니다.</p>
        </div>}
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("input")}>자료 수정</button><button className="primary" disabled={shortsScript.trim().length < 50} onClick={openShortsSceneMaker}>GPT로 장면표 만들기 ↗</button></div>
      </>}

      {phase === "analysis" && (isShorts ? <>
        <div className="sectionHead"><div><h2>3. 이미지 7장 제작</h2><p>승인된 썸네일 스타일을 기준으로 장면별 GPT 요청서를 만들고, 완성된 투명 정보판을 장면마다 적용합니다.</p></div><span className="counter">{shortsScenes.length || 0}/7장면 설계</span></div>
        {shortsScript.trim().length < 50 && <p className="stagePreviewNote">미리보기: 2. 대본 단계에 완성 대본을 넣으면 이 단계의 GPT 장면표 요청서에 자동 포함됩니다.</p>}
        <div className="box scenePasteBox">
          <div className="miniHead"><h3>① GPT로 7장 정보 구성 · 붙여넣기</h3><div className="inlineActions"><button className="secondary compact" disabled={shortsScript.trim().length < 50} onClick={() => copyText(shortsSilentPrompt(), "장면표 요청서를 복사했습니다.")}>📋 요청서 복사</button><button className="secondary compact" disabled={shortsScript.trim().length < 50} onClick={() => openGPT(shortsSilentPrompt())}>↗ GPT 열기</button></div></div>
          <textarea className="smallArea" value={shortsSceneText} onChange={e => applyShortsSceneText(e.target.value)} placeholder={"GPT 결과를 그대로 붙여넣으세요.\n\n[장면 1]\n내레이션: ...\n큰문구: ...\n하단자막: ...\n화면방식: 썸네일\n데이터행:"} />
          <div className="tags"><span className={shortsSceneCountReady ? "ok" : "warn"}>{shortsScenes.length}/7장면</span><span>공통 배경 1개</span><span>GPT 정보판 우선 · 미제작 장면 코드 보완</span><span className={shortsDataIssues.length ? "warn" : "ok"}>숫자 검수 {shortsDataIssues.length ? shortsDataIssues.length + "건 확인 필요" : "✓"}</span></div>
        </div>
        {shortsScenes.length > 0 && <div className="sceneTable">
          <div className="sceneTableHead"><span>장면</span><span>내레이션</span><span>큰 문구 + 데이터행</span><span>하단 대사</span><span>정보판 종류</span></div>
          {shortsScenes.map((scene, i) => <div className="sceneTableRow" key={scene.order}>
            <b>{scene.order}</b>
            <input value={scene.narration} onChange={e => updateShortsScene(i, { narration: e.target.value })} />
            <div style={{display:"grid",gap:6}}>
              <input value={scene.headline} onChange={e => updateShortsScene(i, { headline: cleanSceneField(e.target.value) })} />
              <textarea rows={2} value={scene.dataRows || ""} onChange={e => updateShortsScene(i, { dataRows: e.target.value })} placeholder="단지명 | 실제건수 ; 단지명 | 실제건수" style={{width:"100%",minWidth:0}} />
              {!scene.dataRows && !!resolvedShortsScenes[i]?.dataRows &&
                <div style={{fontSize:12,color:"#2365A8",lineHeight:1.4}}>
                  원문에서 자동 추출: {resolvedShortsScenes[i].dataRows}
                  <button type="button" className="secondary compact" onClick={() => updateShortsScene(i,{dataRows:resolvedShortsScenes[i].dataRows})}>값 확인·적용</button>
                </div>}
            </div>
            <input value={scene.subtitle} onChange={e => updateShortsScene(i, { subtitle: e.target.value })} />
            <select value={scene.screenType} onChange={e => updateShortsScene(i, { screenType: e.target.value })}>
              {SCENE_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </div>)}
        </div>}
        <div className="box masterReferenceBox">
          <div className="miniHead"><h3>② 집값쓱 스타일 마스터 V2 · 고품질 이미지 제작</h3><span className="muted">요청서 7종 · 사이트에 고정 저장</span></div>
          <p className="muted">먼저 위에서 7장 구성표를 붙여넣어 주세요. 승인한 김포 썸네일은 한 번 등록하면 디자인 기준으로 사용합니다. 다른 지역 영상에 김포의 숫자와 문구를 복사하지 않습니다.</p>
          <div className="masterReferenceLayout">
            {shortsMasterReference
              ? <img src={shortsMasterReference} alt="집값쓱 승인 마스터 썸네일 미리보기" className="masterReferenceThumb" />
              : <div className="masterReferencePlaceholder">승인된 마스터 썸네일<br />이미지를 1회 등록하세요</div>}
            <div className="masterReferenceActions">
              <label className="fileBtn compact">{shortsMasterReference ? "✓ 마스터 이미지 교체" : "📤 마스터 이미지 등록"}<input type="file" accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(f) void saveMasterReference(f); e.currentTarget.value=""; }} /></label>
              <button className="secondary compact" disabled={!shortsMasterReference} onClick={downloadMasterReference}>📥 참고 이미지 받기</button>
              <button className="secondary compact" onClick={() => copyText(JIBSSUK_MASTER_STYLE, "집값쓱 공통 스타일 규칙을 복사했습니다.")}>📋 공통 디자인 규칙</button>
              <p className="muted">마스터 이미지는 이 브라우저에 보관됩니다. 마스터 등록 + 원문·대본 입력 후 요청 버튼이 활성화됩니다. GPT 요청 버튼은 텍스트만 전달하므로 내려받은 참고 이미지 파일을 GPT 대화에 직접 첨부해주세요.</p>
              {shortsOverlayNotice && <p className="ok">{shortsOverlayNotice}</p>}
            </div>
          </div>
          <div className="masterSceneCards">
            {JIBSSUK_SCENE_TEMPLATES.map((scene, index) => <div key={scene.order} className="masterSceneCard">
              <div><b>{String(scene.order).padStart(2,"0")} · {scene.title}</b><small>{scene.subtitle}</small></div>
              <div className="inlineActions">
                <button className="secondary compact" onClick={() => setShortsImagePromptPreview(prev => prev === scene.order ? 0 : scene.order)}>{shortsImagePromptPreview === scene.order ? "접기" : "요청서 보기"}</button>
                <button className="secondary compact" disabled={!shortsMasterReference || shortsScript.trim().length < 50 || rawContent.trim().length < 30} onClick={() => copyText(imagePromptForScene(scene.order), scene.order + "번 이미지 요청서를 복사했습니다.")}>📋 요청서 복사</button>
                <button className="primary compact" disabled={!shortsMasterReference || shortsScript.trim().length < 50 || rawContent.trim().length < 30} onClick={() => openGPT(imagePromptForScene(scene.order))}>↗ GPT 제작</button>
                <label className="fileBtn compact">{shortsCustomOverlays[index] ? "✓ 이미지 교체" : "투명 PNG 넣기"}<input type="file" accept="image/png,image/webp" onChange={e => { const f=e.target.files?.[0]; if(f) void uploadCustomOverlay(index,f); e.currentTarget.value=""; }} /></label>
                {shortsCustomOverlays[index] && <button className="secondary compact" onClick={() => {setShortsCustomOverlays(prev=>prev.map((v,i)=>i===index?"":v));setShortsPreview("");setShortsPreviewFrames([]);}}>기본 정보판 사용</button>}
              </div>
              {shortsImagePromptPreview === scene.order && <pre className="masterPromptPreview">{imagePromptForScene(scene.order)}</pre>}
            </div>)}
          </div>
          <p className="muted">제작한 투명 PNG를 장면별로 올리면 자동 정보판 대신 우선 적용합니다. 사이트가 정보판의 투명 영역을 확인하고, Y 1320 아래로 내용이 넘어오면 자르지 않고 비율대로 자동 축소·상향 배치해 자막 공간을 보호합니다. 업로드 이미지는 현재 작업 화면에서 유지되며, 새로고침하면 다시 선택해야 합니다.</p>
        </div>
        <div className="box">
          <div className="miniHead"><h3>공통 아파트 배경 · 단 1장</h3><span className="muted">그래프·숫자·한글은 사이트가 자동 렌더링</span></div>
          {tasks.map(t => <div className="imageRow" key={t.title}><span>BG</span><div><b>{t.title}</b><p>투명 오버레이 7장 아래에서 계속 고정됩니다.</p></div><button className="secondary compact" onClick={() => openGPT(promptFor(t))}>배경 만들기 ↗</button></div>)}
          <p className="muted">데이터행 형식: 풍무푸르지오센트레빌 | 14건 ; 풍무센트럴푸르지오 | 14건. 4번 월별 가격은 원문에서 자동 복원되며, 비교값이 부족하면 임의 생성 없이 정보 카드로 전환합니다. 원문에 없는 숫자는 ZIP 검수에서 차단됩니다.</p>
          {shortsDataIssues.map(issue => <p key={issue} className="voiceWarning">{issue}</p>)}
          {!shortsScriptReady && shortsScenes.length > 0 && <>
            <p className="voiceWarning">장면 내레이션과 기준 대본의 첫 차이 {shortsScriptDifference ? "· 장면 " + shortsScriptDifference.scene + " 부근 (비교 위치 " + shortsScriptDifference.position + ")" : ""}</p>
            {shortsScriptDifference && <div style={{border:"1px solid #f6d7a7",borderRadius:12,padding:12,fontSize:13,lineHeight:1.55,overflowWrap:"anywhere"}}>
              <div><b>기준 대본</b> · {shortsScriptDifference.original}</div>
              <div><b>장면 합본</b> · {shortsScriptDifference.revised}</div>
            </div>}
            <div className="inlineActions">
              <button type="button" className="secondary compact" disabled={shortsScenes.length !== 7} onClick={restoreShortsOriginalScript}>↻ 원본 대본으로 7장면 내레이션 복원</button>
            </div>
            <p className="muted">현재 재분배 결과의 장면 경계를 참고해 원본 문구를 빠짐없이 복원하며 하단 자막도 동일하게 맞춥니다. 복원 후 큰 문구·데이터행과 허용 시간을 확인하세요.</p>
          </>}
        </div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("script")}>대본 수정</button><button className="primary" disabled={!shortsSceneCountReady} onClick={() => setPhase("images")}>제작자료 준비</button></div>
      </> : analysis ? <>
        <div className="sectionHead"><div><h2>이미지 제작 계획</h2><p>숫자와 문구를 먼저 확정한 뒤 이미지 배경을 준비합니다.</p></div><span className="counter">총 {tasks.length}장</span></div>
        <div className="grid2"><div className="box"><h3>추천 제목</h3><div className="recommended">{analysis.recommendedTitle}</div><div className="candidateList">{analysis.titleCandidates?.slice(0, 5).map(t => <button key={t} onClick={() => setFinalTitle(t)}>{t}</button>)}</div></div><div className="box"><h3>본문에서 찾은 핵심 숫자</h3><div className="tags">{analysis.facts?.length ? analysis.facts.map(f => <span key={f.value}>{f.value}</span>) : <span>숫자 정보 없음</span>}</div><p className="muted">이미지에는 원문에 있는 숫자만 사용하도록 검수합니다.</p></div></div>
        <div className="box"><h3>이미지 구성</h3>{tasks.map(t => <div className="imageRow" key={`${t.order}-${t.title}`}><span>{String(t.order).padStart(2, "0")}</span><div><b>{t.title}</b><p>{t.keyMessage}</p></div></div>)}</div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("input")}>본문 수정</button><button className="primary" onClick={() => setPhase("images")}>이미지 작업 시작</button></div>
      </> : null)}

      {phase === "images" && (isShorts ? <>
        <div className="sectionHead"><div><h2>4. 공통 배경 · 음성 준비</h2><p>배경 한 장만 업로드하면 정보판 7장은 사이트가 직접 렌더링합니다.</p></div><span className="counter">공통 배경 {backgroundReady}/1</span></div>
        {!shortsSceneCountReady && <p className="stagePreviewNote">미리보기: 장면표 7개를 붙여넣으면 공통 배경 업로드 칸과 자동 정보판 제작이 준비됩니다.</p>}

        <div className="box">
          <div className="miniHead"><h3>① 공통 아파트 배경 (1장)</h3><span className="muted">{backgroundReady}/1 업로드</span></div>
          <p className="muted">이 사진이 영상 시작부터 끝까지 고정됩니다. 제목·가격·그래프·자막은 배경 이미지에 넣지 마세요.</p>
          {tasks.length === 0 && <p className="muted">공통 배경 업로드 칸 대기 중 · 3. 장면표 입력 후 나타납니다.</p>}
          {tasks.map((t, i) => <div className="assetRow" key={t.title}>
            <div><b>{t.title}</b><p>9:16 무문자 아파트 전경</p></div>
            <div className="inlineActions"><button className="secondary compact" onClick={() => openGPT(promptFor(t))}>GPT 배경 요청서 ↗</button>
              <label className="fileBtn compact">{t.imageDataUrl ? "✓ 배경 교체" : "배경 PNG/JPG 넣기"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f) return; fileToDataUrl(f).then(src => {updateTask(i,{sourceDataUrl:src,imageDataUrl:src,replaced:true,done:true});setShortsPreview("");}).catch(()=>setError("배경 업로드 실패")); }} /></label>
            </div>
          </div>)}
          <p className="muted">② 3단계에서 업로드한 고품질 GPT 투명 정보판을 우선 적용합니다. 현재 {shortsCustomOverlays.filter(Boolean).length}/7장 적용 중이며, 나머지는 큰 문구와 데이터행으로 사이트가 자동 생성합니다.</p>
          {shortsDataIssues.map(issue => <p className="voiceWarning" key={issue}>{issue}</p>)}
        </div>

        <div className="grid2">
          <div className="box assetUploadBox">
            <div className="miniHead"><h3>② AI 음성</h3><button className="primary compact" disabled={shortsScript.trim().length < 50} onClick={() => openGPT(shortsVoicePrompt())}>🎙 AI 음성 만들기 ↗</button></div>
            <p className="muted">완성 대본 그대로, BGM 없이 MP3/WAV 내레이션만 요청합니다.</p>
            <label className="assetDrop">완성 음성파일 넣기<input type="file" accept="audio/*" onChange={e => handleVoiceFile(e.target.files?.[0] || null)} /></label>
            {voiceFile ? <div className="assetReady"><b>✓ {voiceFile.name}</b><span>{voiceDuration ? `원본 ${voiceDuration.toFixed(1)}초 → 1.4x 최종 ${finalVoiceDuration.toFixed(1)}초` : "길이 확인 중"}</span></div> : <p className="muted">원본 음성을 넣으면 1.4배속 최종 길이로 자동 환산해 타임라인과 SRT를 만듭니다.</p>}
          </div>

          <div className="box assetUploadBox">
            <h3>③ BGM</h3>
            <div className="recommended">{shortsBgm.label}</div>
            <p className="muted">{shortsBgm.note}</p>
            <label className="assetDrop">BGM MP3 / WAV 넣기<input type="file" accept="audio/*" onChange={e => setBgmFile(e.target.files?.[0] || null)} /></label>
            {bgmFile && <div className="assetReady"><b>✓ {bgmFile.name}</b><span>BGM 준비 완료</span></div>}
            <label>BGM 출처·사용권 메모</label>
            <input value={bgmMemo} onChange={e => setBgmMemo(e.target.value)} placeholder="예: YouTube Audio Library · 사용 가능 확인" />
          </div>
        </div>

        <div className="box">
          <div className="miniHead"><h3>④ 한 줄 자막·타임라인</h3><div className="inlineActions"><button className="secondary compact" onClick={() => copyText(shortsSceneExport(), "장면표를 복사했습니다.")}>📋 장면표 복사</button>{sceneTimeline.length > 0 && <button className="secondary compact" onClick={() => copyText(shortsSrt(), "전체대사 SRT를 복사했습니다.")}>📋 전체대사 SRT</button>}{sceneTimeline.length > 0 && <button className="secondary compact" onClick={() => copyText(shortsEditPlanExport(), "편집표를 복사했습니다.")}>📋 edit plan</button>}</div></div>
          {sceneTimeline.length > 0 ? <div className="timelineSimple">{sceneTimeline.map(item => <div key={item.scene.order}><b>{item.scene.order}. {item.start.toFixed(1)}~{item.end.toFixed(1)}초</b><span>{item.scene.headline}</span><small>{item.scene.subtitle} · {item.scene.screenType}</small></div>)}</div> : <p className="muted">음성파일을 넣으면 실제 음성 길이를 기준으로 장면 시간을 자동 배분합니다.</p>}
          {sceneTimeline.length === 7 && voiceFile && <div style={{marginTop:12,border:"1px solid #dae3ed",padding:12,borderRadius:12}}>
            <p className="muted">장면 시작/끝은 음성 총길이와 한글 발음 분량으로 먼저 추정합니다. 음성을 들어보고 각 장면 종료 시각(최종 1.4배속 기준)을 조정하면 다음 장면의 시작 시각, SRT 및 edit_plan.txt가 함께 변경됩니다. 마지막 장면은 음성 종료 시각에 자동으로 맞춥니다.</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              {sceneTimeline.slice(0,6).map((item,index) => <label key={item.scene.order} style={{display:"flex",flexDirection:"column",gap:4,fontSize:13}}>
                {item.scene.order}번 장면 종료(초)
                <input aria-label={item.scene.order + "번 장면 종료 시각"} type="number" min={0.1} max={finalVoiceDuration - 0.1} step={0.1} value={Number(item.end.toFixed(2))} onChange={e => updateSceneBoundary(index,e.target.value)} style={{width:105,padding:"5px 8px"}} />
              </label>)}
            </div>
            {sceneBoundaryOverrides && <button type="button" className="secondary compact" style={{marginTop:10}} onClick={() => setSceneBoundaryOverrides(null)}>↻ 시간 자동 배분으로 복원</button>}
          </div>}
          <p className="muted">SRT 문구는 화면용 원본 숫자 그대로 유지하고, 음성의 한글 발음 분량으로 큐 시간을 추정합니다. 단어별 강제 정렬은 아니므로 최종 음성 청취로 실제 싱크를 확인하세요. 배경·정보판·자막은 별도 레이어입니다.</p>
        </div>

        <div className="assetChecklist">
          <span className={backgroundReady === backgroundCount ? "ready" : ""}>배경 {backgroundReady}/{backgroundCount}</span>
          <span className={shortsSceneCountReady && shortsDataIssues.length===0 ? "ready" : ""}>코드 정보판 {!shortsSceneCountReady ? `${shortsScenes.length}/7 · 장면표 대기` : shortsDataIssues.length ? "데이터 수정 필요" : "7장 자동 생성 ✓"}</span>
          <span className={voiceFile ? "ready" : ""}>음성 {voiceFile ? (finalVoiceDuration ? finalVoiceDuration.toFixed(1) + "초(1.4x) ✓" : "✓") : "대기"}</span>
          <span className={shortsCaptionReady && shortsScriptReady ? "ready" : ""}>한 줄 SRT {shortsCaptionReady && shortsScriptReady ? "✓" : "대본 확인"}</span>
          <span className={bgmFile ? "ready" : ""}>BGM {bgmFile ? "✓" : "선택"}</span>
        </div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("analysis")}>장면표로 돌아가기</button><button className="primary" disabled={!voiceFile || !shortsSceneCountReady || !shortsVisualReady} onClick={() => setPhase("review")}>7장 정보판 조립 단계로</button></div>
      </> : current ? <>
        <div className="sectionHead"><div><h2>{isShorts ? "4. 이미지" : "이미지 일괄 정리"}</h2><p>{isShorts ? <>장면표에서 <b>새 이미지</b>로 정한 장면만 작업합니다. 나머지 장면은 재사용·텍스트 카드·숫자 카드로 처리합니다.</> : <>ChatGPT 등에서 만든 <b>무문자 배경 이미지</b>를 한꺼번에 올리면 00부터 순서대로 배치하고 문구를 자동 합성합니다.</>}</p></div><span className="counter">{imageCount}/{tasks.length} 업로드</span></div>
        <div className="toolbar box"><input ref={bulkRef} type="file" accept="image/*" multiple onChange={e => handleBulk(e.target.files)} /><button className="secondary" onClick={copyAllPrompts}>📋 전체 이미지 요청서 복사</button><span className="muted">파일명 00, 01, 02… 순으로 저장해두면 자동 정렬이 가장 정확합니다.</span></div>

        <div className="workspace">
          <aside className="taskList">{tasks.map((t, i) => <button key={`${t.order}-${t.title}`} draggable onDragStart={() => setDragIndex(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIndex !== null) reorder(dragIndex, i); setDragIndex(null); }} onClick={() => setCurrentIndex(i)} className={`taskItem ${i === currentIndex ? "active" : ""} ${t.imageDataUrl ? "hasImage" : ""}`}><span className="taskNo">{String(t.order).padStart(2, "0")}</span><div className="taskText"><b>{t.title}</b><small>{t.keyMessage}</small></div><span className="taskState">{t.imageDataUrl ? "✓" : "대기"}</span></button>)}</aside>

          <div className="previewArea">
            <div className={`previewCard ${contentType === "집값쓱 쇼츠" ? "vertical" : ""}`}>{current.imageDataUrl ? <img src={current.imageDataUrl} alt={current.title} /> : <div className="placeholder"><b>{String(current.order).padStart(2, "0")} {current.title}</b><span>배경 이미지를 업로드하면<br />{preset.label}로 자동 맞춤 + 문구 합성</span></div>}</div>
            <div className="box editorBox">
              <div className="miniHead"><h3>{String(current.order).padStart(2, "0")} · {current.title}</h3><div className="inlineActions"><button className="secondary compact" onClick={() => copyPrompt(current)}>📋 요청문 복사</button>{isShorts && <button className="secondary compact" onClick={() => openGPT(promptFor(current))}>↗ GPT에서 만들기</button>}</div></div>
              <label>사이트가 정확하게 합성할 문구</label><textarea className="smallArea" value={current.keyMessage} onChange={e => updateTask(currentIndex, { keyMessage: e.target.value, done: false })} />
              <div className="inlineActions"><label className="fileBtn">이미지 1장 교체<input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) replaceOne(f); }} /></label><button className="secondary" disabled={!current.sourceDataUrl || loading} onClick={recomposeCurrent}>문구 다시 합성</button><button className="primary" disabled={!current.imageDataUrl} onClick={() => updateTask(currentIndex, { done: true })}>확정 ✓</button></div>
              <div className="muted">이미지 AI가 글자를 쓰는 방식이 아니라, 업로드한 배경 위에 사이트가 문구를 직접 그립니다. 그래서 한글·숫자 오타를 줄일 수 있습니다.</div>
            </div>
          </div>
        </div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("analysis")}>{isShorts ? "장면표로 돌아가기" : "구성으로 돌아가기"}</button><button className="primary" onClick={() => setPhase("review")}>{isShorts ? "제작용 묶음 보기" : "자동 검수"}</button></div>
      </> : null)}

      {phase === "review" && (isShorts ? <>
        <div className="sectionHead"><div><h2>5. 집값쓱 V3 조립 패키지</h2><p>공통 배경 1장과 코드로 만든 투명 정보판 7장, 한 줄 SRT를 ZIP으로 출력합니다.</p></div><span className="counter">{finalVoiceDuration ? finalVoiceDuration.toFixed(1) + "초 · 1.4x" : "음성 기준"}</span></div>
        {!shortsAssemblyReady && <p className="stagePreviewNote">미리보기: 조립에 필요한 장면표·배경·음성이 준비되면 검수가 완료되고 ZIP 다운로드가 활성화됩니다.</p>}

        <div className="box finalPackageBox">
          <div className="miniHead"><h3>자동 최종검사</h3><span className={shortsAssemblyReady ? "ok" : "warn"}>{shortsAssemblyReady ? "빠른 조립 준비 완료" : shortsScenes.length || shortsScript.trim() ? "수정 필요" : "준비 전"}</span></div>
          <div className="assetChecklist">
            <span className={shortsSceneCountReady ? "ready" : ""}>장면 {shortsScenes.length}/7 {shortsSceneCountReady ? "✓" : ""}</span>
            <span className={shortsCaptionReady && shortsScriptReady ? "ready" : ""}>원문과 일치하는 한 줄 자막 {shortsCaptionReady && shortsScriptReady ? "✓" : "대본 재확인"}</span>
            <span className={shortsVisualReady ? "ready" : ""}>공통 배경 {backgroundReady}/1 {shortsVisualReady ? "✓" : ""}</span>
            <span className={shortsSceneCountReady && shortsDataIssues.length === 0 ? "ready" : ""}>정보판 데이터 {!shortsSceneCountReady ? "장면표 대기" : shortsDataIssues.length ? shortsDataIssues.length + "건 오류" : "✓"}</span>
            <span className={voiceFile ? "ready" : ""}>음성 {voiceFile ? "✓" : "없음"}</span>
            <span className={shortsDurationReady ? "ready" : ""}>최종 길이 {finalVoiceDuration ? finalVoiceDuration.toFixed(1) + "초" : "미확인"}</span>
            <span className={shortsLongScenes.length === 0 && sceneTimeline.length ? "ready" : ""}>장면 시간 {shortsLongScenes.length ? "조정 필요 · " + shortsLongScenes.map(x => "장면" + x.scene.order + "(" + x.duration.toFixed(1) + "초)").join(", ") : shortsExtendedGraphScenes.length ? "그래프 7초 예외 허용 ✓" : sceneTimeline.length ? "정상 ✓" : "미확인"}</span>
            <span className={bgmFile ? "ready" : ""}>BGM {bgmFile ? "✓" : "선택"}</span>
          </div>
          {shortsExtendedGraphScenes.length > 0 && <p className="muted">그래프·비교표 장면 {shortsExtendedGraphScenes.map(x => x.scene.order + "번(" + x.duration.toFixed(1) + "초)").join(", ")}은 6~7초 허용 구간입니다. 장면을 추가로 나누지 않아도 ZIP 제작을 진행할 수 있습니다.</p>}
          {shortsLongScenes.length > 0 && <>
            <p className="voiceWarning">허용 시간을 넘는 장면이 있습니다: {shortsLongScenes.map(x => x.scene.order + "번 " + x.duration.toFixed(1) + "초").join(", ")}. 일반 장면은 6초, 3·4번 그래프 장면은 7초까지 허용합니다. 아래 수정 요청서를 복사해 7장면 내레이션을 재분배해 주세요.</p>
            <div className="inlineActions">
              <button type="button" className="secondary compact" onClick={() => copyText(shortsTimingRevisionPrompt(), "7장면 시간 수정 요청서를 복사했습니다.")}>📋 장면 시간 수정 요청 복사</button>
              <button type="button" className="secondary compact" onClick={() => setPhase("analysis")}>장면표 수정하기</button>
            </div>
          </>}
          {shortsDataIssues.map(issue => <p key={issue} className="voiceWarning">{issue}</p>)}
          {!shortsScriptReady && (shortsScenes.length > 0 || !!shortsScript.trim()) && <p className="voiceWarning">원본 대본과 장면 내레이션이 다릅니다. 3단계에서 차이 위치를 확인하고 원본 대본 복원을 적용해 주세요.</p>}
          {!shortsDurationReady && finalVoiceDuration > 0 && <p className="muted">권장 최종 길이는 약 28~34초입니다. 현재 {finalVoiceDuration.toFixed(1)}초입니다.</p>}

          <h3>빠른 조립 패키지</h3>
          <div className="packageGrid five">
            <div><span>배경 + 정보판</span><b>1 + {shortsScenes.length}장</b></div>
            <div><span>음성</span><b>{voiceFile ? packageAudioFileName("voice", voiceFile) : "없음"}</b></div>
            <div><span>SRT</span><b>{sceneTimeline.length ? "전체대사" : "없음"}</b></div>
            <div><span>BGM</span><b>{bgmFile ? packageAudioFileName("bgm", bgmFile) : "선택"}</b></div>
            <div><span>편집표</span><b>{sceneTimeline.length ? "준비됨" : "없음"}</b></div>
          </div>
          <p className="muted">빠른 ZIP에는 background.png, overlays/01~07_overlay.png, 미리보기, voice, bgm, 한 줄 subtitles_full.srt, 편집표, 검수용 overlay_data.json과 영상 조립·유튜브 업로드 요청서 TXT 2개를 담습니다. 정보판 PNG에는 자막이 새겨지지 않습니다.</p>
          <div className="inlineActions"><button className="secondary compact" disabled={loading || !shortsVisualReady || !shortsSceneCountReady || shortsDataIssues.length>0} onClick={previewShortsCards}>👁 배경 + 정보판 7장 미리보기</button></div>
          {shortsPreview && <div className="box" style={{marginTop:12}}>
            <h3>장면별 크게 확인하기</h3>
            <p className="muted">작은 모아보기에서는 글자가 실제보다 작게 보입니다. 아래에서 장면을 골라 모바일 크기로 확인하세요.</p>
            <div className="inlineActions" style={{flexWrap:"wrap",gap:8}}>
              {shortsPreviewFrames.map((_,i)=><button key={i} type="button" className={shortsPreviewIndex===i?"primary compact":"secondary compact"} onClick={()=>setShortsPreviewIndex(i)}>{i+1}번 장면</button>)}
            </div>
            {!!shortsPreviewFrames[shortsPreviewIndex] && <div style={{display:"flex",justifyContent:"center",padding:"16px 0"}}>
              <img src={shortsPreviewFrames[shortsPreviewIndex]} alt={"집값쓱 " +(shortsPreviewIndex+1)+"번 장면 확대 미리보기"} style={{width:"100%",maxWidth:420,aspectRatio:"9 / 16",height:"auto",objectFit:"contain",borderRadius:12}} />
            </div>}
            <details><summary style={{cursor:"pointer",fontWeight:700}}>7장면 전체 모아보기</summary>
              <img src={shortsPreview} alt="7장면 콘택트시트" style={{width:"100%",height:"auto",maxWidth:850,marginTop:10}} /></details>
          </div>}
          <div className="inlineActions">
            <button className="primary" onClick={() => exportShortsPackage(false)} disabled={loading || !shortsAssemblyReady}>{loading ? "ZIP 만드는 중..." : "⚡ 빠른 조립 ZIP 다운로드"}</button>
            <button className="secondary" onClick={() => exportShortsPackage(true)} disabled={loading}>{loading ? "준비 중..." : "🗂 원본 포함 백업 ZIP"}</button>
          </div>
        </div>

        <div className="box">
          <div className="miniHead"><h3>유튜브 썸네일 · 별도 PNG</h3><span className="muted">1080×1920 · 9:16</span></div>
          <p className="muted">공통 아파트 배경 + 현재 적용된 01번 썸네일 정보판을 원래 위치 그대로 합성합니다. 01번 영상 장면과 동일한 디자인이며, 영상 하단 내레이션 자막은 넣지 않습니다. ZIP과 별도로 thumbnail.png 파일만 다운로드합니다.</p>
          <div className="inlineActions">
            <button type="button" className="primary" disabled={loading || !shortsVisualReady || !resolvedShortsScenes.some(scene => scene.order === 1)} onClick={downloadShortsThumbnail}>{loading ? "준비 중..." : "🖼 썸네일 PNG 별도 다운로드"}</button>
          </div>
          {!shortsVisualReady && <p className="muted">01번 장면 구성과 공통 아파트 배경을 준비하면 다운로드할 수 있습니다. 음성 파일이나 ZIP 완성은 필요하지 않습니다.</p>}
        </div>

        <div className="box">
          <div className="miniHead"><h3>최종 영상 조립 요청서 · ZIP 첨부용</h3><div className="inlineActions"><button className="secondary compact" disabled={!shortsAssemblyReady} onClick={() => copyText(shortsVideoPrompt(), "영상 조립 요청서를 복사했습니다. 다운로드한 ZIP을 GPT에 첨부하세요.")}>📋 영상 조립 요청서 복사</button><button className="primary" disabled={!shortsAssemblyReady} onClick={() => openGPT(shortsVideoPrompt())}>GPT에서 영상 조립 ↗</button></div></div>
          <p className="muted">빠른 조립 ZIP 다운로드 → GPT 열기 → ZIP 파일 1개 직접 첨부 → 조립 요청서 붙여넣고 전송. SRT는 의미 단위 한 줄 자막으로 분할하며, 영상 자막은 약 86px 굵기로 같은 Y 위치에 고정합니다. ZIP 첨부는 브라우저 보안상 직접 해야 합니다.</p>
          <div className="requestSummary">
            <b>1080×1920 · 9:16</b>
            <span>background.png 한 장을 영상 끝까지 고정 + overlays/01~07 정보판만 교체</span>
            <span>배경 완전 정지, 정보판만 단순 컷 또는 0.2초 페이드</span>
            <span>전체 대사를 한 줄씩 Y 1450~1660 안전영역에 표시</span>
            <span>edit_plan.txt 시간표를 최우선 적용</span>
            <span>BGM은 audio_plan.txt 기준으로 낮게</span>
          </div>
        </div>

        <div className="box">
          <div className="miniHead">
            <h3>유튜브 업로드 요청서 · 전체 업로드 패키지</h3>
            <div className="inlineActions">
              <button type="button" className="secondary compact" disabled={!shortsScript.trim()} onClick={() => copyText(shortsUploadPrompt(), "유튜브 업로드 요청서를 복사했습니다.")}>📋 업로드 요청서 복사</button>
              <button type="button" className="primary compact" disabled={!shortsScript.trim()} onClick={() => openGPT(shortsUploadPrompt())}>GPT에서 업로드 문구 만들기 ↗</button>
            </div>
          </div>
          <p className="muted">영상 조립용 ZIP 요청서와 별개입니다. 완성 대본과 원문으로 업로드용 문구·검색 태그·기본 설정·검수 체크리스트까지 한 번에 생성합니다. 대본만 준비되면 요청서를 복사할 수 있고, 다운로드 ZIP에도 youtube_upload_request.txt로 포함됩니다.</p>
          <div className="requestSummary">
            <b>업로드 패키지 포함 항목 · 01~07</b>
            <span>① 제목 3개(추천 1개) · ② 설명문 2~3문장 + 해시태그 5~8개</span>
            <span>③ 별도 검색 태그(쉼표 구분) · ④ 고정댓글 1개 · ⑤ 01번 썸네일 문구</span>
            <span>⑥ 재생목록·카테고리·언어·시청자·AI 표시 등 업로드 설정표 · ⑦ 최종 체크리스트</span>
            <span>검색어는 자연스럽게 반영 · 원문 밖 숫자와 사실 추가 금지 · 기준이 다른 거래량과 가격은 분리</span>
          </div>
        </div>

        <div className="actions spread"><button className="secondary" onClick={() => setPhase("images")}>제작자료 수정</button><button className="primary" onClick={resetNew}>새 쇼츠 만들기</button></div>
      </> : <>
        <div className="sectionHead"><div><h2>자동 검수</h2><p>OCR 대신 사이트가 직접 합성한 문구와 원문 데이터를 비교합니다.</p></div></div>
        <div className="reviewGrid"><div className="reviewCard"><span>이미지 업로드</span><b className={imageCount === tasks.length ? "ok" : "warn"}>{imageCount}/{tasks.length}</b><small>빠진 이미지 확인</small></div><div className="reviewCard"><span>확정 완료</span><b className={completeCount === tasks.length ? "ok" : "warn"}>{completeCount}/{tasks.length}</b><small>문구 확인 후 확정</small></div><div className="reviewCard"><span>최종 규격</span><b className="ok">{preset.label}</b><small>업로드 시 자동 변환</small></div></div>
        <div className="box"><h3>본문 숫자 사용 확인</h3>{factUsage.length === 0 ? <p className="muted">본문에서 별도 숫자를 찾지 못했습니다.</p> : <div className="factList">{factUsage.map(f => <div key={f.value} className="factItem"><span>{f.value}</span><b className={f.used ? "ok" : "neutral"}>{f.used ? "이미지 문구에 사용" : "미사용 (문제 아님)"}</b></div>)}</div>}<p className="muted">미사용은 오류가 아닙니다. 사이트가 본문에 없는 숫자를 새로 만들어내지 않는지가 핵심입니다.</p></div>
        <div className="box"><h3>최종 파일명 미리보기</h3>{tasks.map(t => <div className="filename" key={t.order}>{String(t.order).padStart(2, "0")}_{cleanName(t.title)}.png</div>)}</div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("images")}>이미지 수정</button><button className="primary" disabled={imageCount === 0} onClick={prepareFinal}>최종 본문 + ZIP 준비</button></div>
      </>)}

      {phase === "done" && !isShorts && <>
        <div className="sectionHead"><div><h2>완료</h2><p>이미지 위치 표시가 들어간 본문과 정리된 이미지 ZIP을 받을 수 있습니다.</p></div></div>
        <label>최종 제목</label><input value={finalTitle} onChange={e => setFinalTitle(e.target.value)} />
        <label>최종 본문</label><textarea className="finalEditor" value={finalBody} onChange={e => setFinalBody(e.target.value)} />
        <div className="box summaryBox"><b>ZIP 포함</b><span>00 썸네일 + 본문 이미지 · final_post.txt · image_guide.txt · project.json</span></div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("review")}>검수로 돌아가기</button><div className="inlineActions"><button className="secondary" onClick={saveCloud} disabled={loading}>☁ 저장</button><button className="primary" onClick={exportZip} disabled={loading}>{loading ? "준비 중..." : "전체 ZIP 다운로드"}</button></div></div>
      </>}
    </section>
  </main>;
}
