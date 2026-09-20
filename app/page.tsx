"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";

type Fact = { label: string; value: string; sourceText: string };
type ImagePlan = { order: number; title: string; keyMessage: string; sourceText: string; imagePrompt: string };
type Analysis = { recommendedTitle: string; titleCandidates: string[]; keywords: string[]; facts: Fact[]; images: ImagePlan[] };
type Task = ImagePlan & { done: boolean; imageDataUrl: string; imageUrl?: string; sourceDataUrl?: string; replaced: boolean };
type Recommendation = { title: string; brief: string };
type Phase = "home" | "input" | "analysis" | "images" | "review" | "done";

const TYPES = [
  ["🏠", "아파트 블로그", "시세·실거래·TOP3"],
  ["💡", "생활·아파트 꿀팁", "이사·청소·점검"],
  ["🌿", "Paramma 블로거", "추천 10개 순차 발행"],
  ["🤖", "AI Price Atlas", "가격·국가 비교"],
  ["🎬", "집값쓱 쇼츠", "세로 장면 6~7개"],
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
    { title: "연봉 5천이면 얼마짜리 아파트 가능할까?", brief: "연봉 5천만원 기준 대출 가능액과 현금 보유액별 가능 가격을 6~7장면으로 설명합니다." },
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const bulkRef = useRef<HTMLInputElement | null>(null);

  const current = tasks[currentIndex];
  const effectiveContentType = contentType === "Paramma 블로거" ? parammaCategory : contentType;
  const preset = PRESETS[contentType] || PRESETS.default;
  const completeCount = useMemo(() => tasks.filter(t => t.done).length, [tasks]);
  const imageCount = useMemo(() => tasks.filter(t => !!t.imageDataUrl).length, [tasks]);
  const factUsage = useMemo(() => {
    const corpus = tasks.map(t => `${t.keyMessage} ${t.title}`).join(" ").toLowerCase();
    return (analysis?.facts || []).map(f => ({ ...f, used: corpus.includes(String(f.value).toLowerCase()) }));
  }, [analysis, tasks]);

  useEffect(() => { refreshSaved().catch(() => {}); }, []);

  async function refreshSaved() {
    const { supabase } = await ensureAnonymousSession();
    const { data, error } = await supabase.from("projects").select("id,project_title,content_type,updated_at,status").order("updated_at", { ascending: false }).limit(20);
    if (error) throw error;
    setSaved(data || []);
  }

  function resetNew() {
    setProjectId(null); setProjectTitle(""); setRawContent(""); setAnalysis(null); setTasks([]); setCurrentIndex(0); setFinalTitle(""); setFinalBody(""); setError(""); setPhase("home");
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
    const ratio = contentType === "집값쓱 쇼츠" ? "9:16 세로" : "16:9 가로";
    return [
      `[${effectiveContentType} 이미지 배경 제작]`,
      `장면 ${String(task.order).padStart(2, "0")} · ${task.title}`,
      task.sourceText ? `근거: ${task.sourceText}` : "",
      task.imagePrompt || "",
      `${ratio} 이미지 한 장만 생성. 여러 장 합본 금지.`,
      `중요: 이미지 안에 글자, 숫자, 제목, 로고를 넣지 말 것. 무문자 배경 이미지로 제작.`,
      `본문에 없는 가격·날짜·단지명·정책·수치를 임의로 시각화하지 말 것.`,
      `핵심 피사체는 중앙과 상단 2/3에 두고 하단에는 문구를 합성할 여백을 남길 것.`
    ].filter(Boolean).join("\n");
  }

  async function copyPrompt(task: Task) {
    try { await navigator.clipboard.writeText(promptFor(task)); alert("무문자 이미지 요청문을 복사했습니다."); }
    catch { setError("클립보드 복사에 실패했습니다."); }
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
        const composed = await composeImage(src, next[i], contentType);
        next[i] = { ...next[i], sourceDataUrl: src, imageDataUrl: composed, replaced: true, done: true };
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
      const composed = await composeImage(src, current, contentType);
      updateTask(currentIndex, { sourceDataUrl: src, imageDataUrl: composed, replaced: true, done: true });
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
        memo: "",
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
      setProjectTitle(p.project_title); setRawContent(p.raw_content); setFinalTitle(p.final_title || p.recommended_title || ""); setFinalBody(p.final_body || ""); setAnalysis(p.analysis_json);
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
      <button className="brandBtn" onClick={resetNew}><span className="brand">콘텐츠 메이커</span><span className="badge">V7 · 무료 워크플로</span></button>
      <button className="secondary compact" onClick={saveCloud} disabled={loading || phase === "home"}>☁ 저장</button>
    </header>

    <section className="hero">
      <div><h1>AI 이미지는 밖에서, 정리·문구·검수·ZIP은 여기서</h1><p>본문 분석 → 이미지 요청서 → 일괄 업로드 → 정확한 문구 자동 합성 → 검수 → 네이버/쇼츠 규격 ZIP</p></div>
      <div className="heroPill">{preset.label}</div>
    </section>

    {error && <div className="error">{error}</div>}

    <section className="panel">
      <div className="steps">{["자료입력", "분석", "이미지", "검수", "완료"].map((x, i) => {
        const active = ((phase === "home" || phase === "input") && i === 0) || (phase === "analysis" && i === 1) || (phase === "images" && i === 2) || (phase === "review" && i === 3) || (phase === "done" && i === 4);
        return <div key={x} className={`step ${active ? "active" : ""}`}>{i + 1} {x}</div>;
      })}</div>

      {phase === "home" && <>
        <div className="sectionHead"><div><h2>무엇을 만들까요?</h2><p>카테고리를 고르면 그 작업에 맞게 이미지 구성과 규격을 준비합니다.</p></div></div>
        <div className="types">{TYPES.map(([ico, name, desc]) => <button key={name} className={`type ${contentType === name ? "sel" : ""}`} onClick={() => setContentType(name)}><span className="ico">{ico}</span><b>{name}</b><small>{desc}</small></button>)}</div>
        {contentType === "Paramma 블로거" && <div className="box parammaBox"><h3>🌿 Paramma 블로거 · 순차 발행 모드</h3><p className="muted">신기한 동물이야기 · 신비로운 자연 · 생활 속 궁금증을 한 발행 큐에 섞어 1번부터 10번까지 순서대로 진행합니다.</p></div>}
        <div className="actions"><button className="primary" onClick={() => { if (contentType === "Paramma 블로거") window.location.href = "/paramma-bulk"; else setPhase("input"); }}>{contentType === "Paramma 블로거" ? "발행 10개 열기" : "새 작업 시작"}</button></div>
        <div className="box"><h3>저장 프로젝트</h3>{saved.length === 0 ? <div className="muted">아직 저장된 작업이 없습니다.</div> : <div className="savedList">{saved.map(p => <div className="savedItem" key={p.id}><div><b>{p.project_title}</b><small>{p.content_type}</small></div><button className="secondary compact" onClick={() => loadProject(p.id)}>불러오기</button></div>)}</div>}</div>
      </>}

      {phase === "input" && <>
        <div className="sectionHead"><div><h2>자료 입력</h2><p>{contentType === "Paramma 블로거" ? `Paramma 블로거 · ${parammaCategory}` : "본문이 있으면 붙여넣고, 없으면 추천 주제로 시작하세요."}</p></div><span className="counter">{rawContent.trim().length}자</span></div>
        {contentType === "Paramma 블로거" && <div className="box parammaBox"><h3>카테고리 선택</h3><div className="parammaGrid compactGrid">{PARAMMA_CATEGORIES.map(([ico, name, desc]) => <button key={name} className={`parammaCard ${parammaCategory === name ? "sel" : ""}`} onClick={() => setParammaCategory(name)}><span className="ico">{ico}</span><b>{name}</b><small>{desc}</small></button>)}</div></div>}
        <div className="box"><h3>{contentType === "Paramma 블로거" ? `✨ ${parammaCategory} · 추천 발행 순서 10개` : "✨ 시작용 주제 추천"}</h3>{contentType === "Paramma 블로거" && <p className="muted">1번부터 10번까지 순서대로 진행하고, 모두 끝나면 다음 10개로 교체해서 이어갈 수 있습니다.</p>}<div className="recommendGrid">{(RECOMMENDATIONS[effectiveContentType] || []).map((item, i) => <button key={item.title} className="recommend" onClick={() => applyRecommendation(item)}><span>{i + 1}</span><div><b>{item.title}</b><small>{item.brief}</small></div></button>)}</div></div>
        <label>작업 제목</label><input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="예: 송도 아파트 시세" />
        <label>본문</label><textarea value={rawContent} onChange={e => setRawContent(e.target.value)} placeholder="본문을 붙여넣으세요. 30자 이상이면 분석할 수 있습니다." />
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("home")}>이전</button><button className="primary" disabled={rawContent.trim().length < 30 || loading} onClick={analyze}>{loading ? "분석 중..." : "본문 분석"}</button></div>
      </>}

      {phase === "analysis" && analysis && <>
        <div className="sectionHead"><div><h2>이미지 제작 계획</h2><p>숫자와 문구를 먼저 확정한 뒤 이미지 배경을 준비합니다.</p></div><span className="counter">총 {tasks.length}장</span></div>
        <div className="grid2"><div className="box"><h3>추천 제목</h3><div className="recommended">{analysis.recommendedTitle}</div><div className="candidateList">{analysis.titleCandidates?.slice(0, 5).map(t => <button key={t} onClick={() => setFinalTitle(t)}>{t}</button>)}</div></div><div className="box"><h3>본문에서 찾은 핵심 숫자</h3><div className="tags">{analysis.facts?.length ? analysis.facts.map(f => <span key={f.value}>{f.value}</span>) : <span>숫자 정보 없음</span>}</div><p className="muted">이미지에는 원문에 있는 숫자만 사용하도록 검수합니다.</p></div></div>
        <div className="box"><h3>이미지 구성</h3>{tasks.map(t => <div className="imageRow" key={`${t.order}-${t.title}`}><span>{String(t.order).padStart(2, "0")}</span><div><b>{t.title}</b><p>{t.keyMessage}</p></div></div>)}</div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("input")}>본문 수정</button><button className="primary" onClick={() => setPhase("images")}>이미지 작업 시작</button></div>
      </>}

      {phase === "images" && current && <>
        <div className="sectionHead"><div><h2>이미지 일괄 정리</h2><p>ChatGPT 등에서 만든 <b>무문자 배경 이미지</b>를 한꺼번에 올리면 00부터 순서대로 배치하고 문구를 자동 합성합니다.</p></div><span className="counter">{imageCount}/{tasks.length} 업로드</span></div>
        <div className="toolbar box"><input ref={bulkRef} type="file" accept="image/*" multiple onChange={e => handleBulk(e.target.files)} /><button className="secondary" onClick={copyAllPrompts}>📋 전체 이미지 요청서 복사</button><span className="muted">파일명 00, 01, 02… 순으로 저장해두면 자동 정렬이 가장 정확합니다.</span></div>

        <div className="workspace">
          <aside className="taskList">{tasks.map((t, i) => <button key={`${t.order}-${t.title}`} draggable onDragStart={() => setDragIndex(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIndex !== null) reorder(dragIndex, i); setDragIndex(null); }} onClick={() => setCurrentIndex(i)} className={`taskItem ${i === currentIndex ? "active" : ""} ${t.imageDataUrl ? "hasImage" : ""}`}><span className="taskNo">{String(t.order).padStart(2, "0")}</span><div className="taskText"><b>{t.title}</b><small>{t.keyMessage}</small></div><span className="taskState">{t.imageDataUrl ? "✓" : "대기"}</span></button>)}</aside>

          <div className="previewArea">
            <div className={`previewCard ${contentType === "집값쓱 쇼츠" ? "vertical" : ""}`}>{current.imageDataUrl ? <img src={current.imageDataUrl} alt={current.title} /> : <div className="placeholder"><b>{String(current.order).padStart(2, "0")} {current.title}</b><span>배경 이미지를 업로드하면<br />{preset.label}로 자동 맞춤 + 문구 합성</span></div>}</div>
            <div className="box editorBox">
              <div className="miniHead"><h3>{String(current.order).padStart(2, "0")} · {current.title}</h3><button className="secondary compact" onClick={() => copyPrompt(current)}>📋 요청문 복사</button></div>
              <label>사이트가 정확하게 합성할 문구</label><textarea className="smallArea" value={current.keyMessage} onChange={e => updateTask(currentIndex, { keyMessage: e.target.value, done: false })} />
              <div className="inlineActions"><label className="fileBtn">이미지 1장 교체<input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) replaceOne(f); }} /></label><button className="secondary" disabled={!current.sourceDataUrl || loading} onClick={recomposeCurrent}>문구 다시 합성</button><button className="primary" disabled={!current.imageDataUrl} onClick={() => updateTask(currentIndex, { done: true })}>확정 ✓</button></div>
              <div className="muted">이미지 AI가 글자를 쓰는 방식이 아니라, 업로드한 배경 위에 사이트가 문구를 직접 그립니다. 그래서 한글·숫자 오타를 줄일 수 있습니다.</div>
            </div>
          </div>
        </div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("analysis")}>구성으로 돌아가기</button><button className="primary" onClick={() => setPhase("review")}>자동 검수</button></div>
      </>}

      {phase === "review" && <>
        <div className="sectionHead"><div><h2>자동 검수</h2><p>OCR 대신 사이트가 직접 합성한 문구와 원문 데이터를 비교합니다.</p></div></div>
        <div className="reviewGrid"><div className="reviewCard"><span>이미지 업로드</span><b className={imageCount === tasks.length ? "ok" : "warn"}>{imageCount}/{tasks.length}</b><small>빠진 이미지 확인</small></div><div className="reviewCard"><span>확정 완료</span><b className={completeCount === tasks.length ? "ok" : "warn"}>{completeCount}/{tasks.length}</b><small>문구 확인 후 확정</small></div><div className="reviewCard"><span>최종 규격</span><b className="ok">{preset.label}</b><small>업로드 시 자동 변환</small></div></div>
        <div className="box"><h3>본문 숫자 사용 확인</h3>{factUsage.length === 0 ? <p className="muted">본문에서 별도 숫자를 찾지 못했습니다.</p> : <div className="factList">{factUsage.map(f => <div key={f.value} className="factItem"><span>{f.value}</span><b className={f.used ? "ok" : "neutral"}>{f.used ? "이미지 문구에 사용" : "미사용 (문제 아님)"}</b></div>)}</div>}<p className="muted">미사용은 오류가 아닙니다. 사이트가 본문에 없는 숫자를 새로 만들어내지 않는지가 핵심입니다.</p></div>
        <div className="box"><h3>최종 파일명 미리보기</h3>{tasks.map(t => <div className="filename" key={t.order}>{String(t.order).padStart(2, "0")}_{cleanName(t.title)}.png</div>)}</div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("images")}>이미지 수정</button><button className="primary" disabled={imageCount === 0} onClick={prepareFinal}>최종 본문 + ZIP 준비</button></div>
      </>}

      {phase === "done" && <>
        <div className="sectionHead"><div><h2>완료</h2><p>이미지 위치 표시가 들어간 본문과 정리된 이미지 ZIP을 받을 수 있습니다.</p></div></div>
        <label>최종 제목</label><input value={finalTitle} onChange={e => setFinalTitle(e.target.value)} />
        <label>최종 본문</label><textarea className="finalEditor" value={finalBody} onChange={e => setFinalBody(e.target.value)} />
        <div className="box summaryBox"><b>ZIP 포함</b><span>00 썸네일 + 본문 이미지 · final_post.txt · image_guide.txt · project.json</span></div>
        <div className="actions spread"><button className="secondary" onClick={() => setPhase("review")}>검수로 돌아가기</button><div className="inlineActions"><button className="secondary" onClick={saveCloud} disabled={loading}>☁ 저장</button><button className="primary" onClick={exportZip} disabled={loading}>{loading ? "준비 중..." : "전체 ZIP 다운로드"}</button></div></div>
      </>}
    </section>
  </main>;
}
