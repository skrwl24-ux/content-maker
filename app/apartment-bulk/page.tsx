"use client";

import { ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";

type ThumbnailTone = "auto" | "standard" | "hook" | "humor";
type ArticleThemeId = "price" | "band" | "trade" | "mixed" | "rebound" | "volatility" | "highlow" | "stable";
type ArticleThemeMode = "auto" | ArticleThemeId;
type ArticleThemeChoice = {
  id: ArticleThemeId;
  label: string;
  angle: string;
  score: number;
};

type DailyContentType = "bulk" | "top3" | "tip" | "moving" | "compare" | "power";
type WorkProgress = "not_started" | "preparing" | "drafting" | "images" | "review";
type WorkAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};
type DailySlot = {
  id: number;
  type: DailyContentType;
  done: boolean;
  workId: string;
};
type DailyWorkSnapshot = {
  workId: string;
  dateKey: string;
  slotId: number;
  contentType: DailyContentType;
  topic: string;
  materials: string;
  body: string;
  imageNotes: string;
  attachments: WorkAttachment[];
  progress: WorkProgress;
  updatedAt: string;
  bulk?: {
    data: ApartmentData;
    monthlyStats: MonthlyStat[];
    mapDataUrl: string;
    aptPoint: Point;
    stationPoint: Point;
    outputs: Outputs | null;
    selectedComplexName: string;
    recommendedAngle: string;
    articleThemeMode: ArticleThemeMode;
    autoMapGenerated: boolean;
    autoMapMessage: string;
    nearbyMessage: string;
  };
};

type ApartmentData = {
  name: string;
  region: string;
  area: string;
  recentPrice: string;
  previousPrice: string;
  households: string;
  moveIn: string;
  station: string;
  locationLine: string;
  question: string;
  thumbnailTone: ThumbnailTone;
};

type Point = { x: number; y: number } | null;
type OutputKey = "price" | "map";
type Outputs = Record<OutputKey, string>;
type MonthlyStat = { month: string; medianPrice: number | null; tradeCount: number };
type NaverBlock = {
  type: "title" | "subheading" | "body" | "image" | "tags";
  text: string;
};
type PhotoCandidate = {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  imageToken: string;
  thumbnailToken: string;
};

type ComplexDetailResponse = {
  complex: {
    id: string;
    name: string;
    sido?: string | null;
    sigungu?: string | null;
    legal_dong?: string | null;
    households?: number | null;
    use_date?: string | null;
  };
  representativeArea: string | null;
  monthly: MonthlyStat[];
  latestTrade: { date: string; price: number; area: number; floor: number | null } | null;
  snapshot?: {
    first_median_price?: number | string | null;
    latest_median_price?: number | string | null;
    recommended_angle?: string | null;
  } | null;
};

const SAMPLE: ApartmentData = {
  name: "산본 퇴계아파트",
  region: "경기 군포시 금정동",
  area: "전용 42㎡",
  recentPrice: "3억 5,000만원",
  previousPrice: "직전 3억 3,000만원",
  households: "1,992세대",
  moveIn: "1993년 6월",
  station: "수리산역",
  locationLine: "수리산역·학교·공원을 가까이 누리는 생활권",
  question: "",
  thumbnailTone: "auto",
};

const DAILY_TYPE_META: Record<DailyContentType, { label: string; short: string }> = {
  bulk: { label: "아파트 대량발행", short: "대량발행" },
  top3: { label: "TOP3 유입글", short: "TOP3" },
  tip: { label: "아파트 꿀팁", short: "꿀팁" },
  moving: { label: "이사 체크리스트", short: "이사체크" },
  compare: { label: "지역·단지 비교글", short: "비교글" },
  power: { label: "파워글 · 주력 콘텐츠", short: "파워글" },
};

const DEFAULT_DAILY_SLOTS: DailySlot[] = [
  { id: 1, type: "bulk", done: false, workId: "" },
  { id: 2, type: "bulk", done: false, workId: "" },
  { id: 3, type: "bulk", done: false, workId: "" },
  { id: 4, type: "top3", done: false, workId: "" },
  { id: 5, type: "bulk", done: false, workId: "" },
  { id: 6, type: "tip", done: false, workId: "" },
  { id: 7, type: "power", done: false, workId: "" },
];

const WORK_DB_NAME = "jibssuk-apartment-work-v1";
const WORK_STORE_NAME = "dailyWorks";

function createWorkId(dateKey: string, slotId: number) {
  const compact = dateKey.replace(/-/g, "");
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `jibssuk-${compact}-${String(slotId).padStart(2, "0")}-${suffix}`;
}

function makeDailySlots(dateKey: string) {
  return DEFAULT_DAILY_SLOTS.map((slot) => ({
    ...slot,
    workId: createWorkId(dateKey, slot.id),
  }));
}

function openWorkDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORK_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORK_STORE_NAME)) {
        db.createObjectStore(WORK_STORE_NAME, { keyPath: "workId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("작업 저장소를 열지 못했습니다."));
  });
}

async function readWorkSnapshot(workId: string): Promise<DailyWorkSnapshot | null> {
  const db = await openWorkDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORK_STORE_NAME, "readonly");
    const request = tx.objectStore(WORK_STORE_NAME).get(workId);
    request.onsuccess = () => resolve((request.result as DailyWorkSnapshot | undefined) || null);
    request.onerror = () => reject(request.error || new Error("작업을 불러오지 못했습니다."));
    tx.oncomplete = () => db.close();
  });
}

async function writeWorkSnapshot(snapshot: DailyWorkSnapshot) {
  const db = await openWorkDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORK_STORE_NAME, "readwrite");
    tx.objectStore(WORK_STORE_NAME).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("작업을 저장하지 못했습니다."));
    };
  });
}

const FONT = 'Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasUrl(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.");
  ctx.textBaseline = "top";
  draw(ctx);
  return canvas.toDataURL("image/png");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number, weight = 800) {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const chars = [...text.trim()];
  let line = "";
  const lines: string[] = [];
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + lineHeight * index));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function dataUrlBase64(dataUrl: string) {
  return dataUrl.split(",")[1] || "";
}

function cleanNaverLine(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .replace(/^__(.*?)__$/, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\\#/g, "#")
    .trim();
}

function parseNaverBlog(raw: string): NaverBlock[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line &&
      !/^:::writing\b/i.test(line) &&
      line !== ":::" &&
      !/^---option\b/i.test(line)
    );

  if (!lines.length) return [];

  const blocks: NaverBlock[] = [];
  let firstContent = true;

  for (const original of lines) {
    const line = cleanNaverLine(original);
    if (!line) continue;

    if (firstContent) {
      blocks.push({ type: "title", text: line });
      firstContent = false;
      continue;
    }

    const hashtagCount = (line.match(/#[^\s#]+/g) || []).length;
    if (hashtagCount >= 2 && line.startsWith("#")) {
      blocks.push({ type: "tags", text: line });
      continue;
    }

    if (/^\[이미지\s*\d+/i.test(line)) {
      blocks.push({ type: "image", text: line });
      continue;
    }

    const markdownHeading = /^#{2,6}\s+/.test(original);
    const wholeBold = /^(\*\*|__)[\s\S]+\1$/.test(original);
    const emojiHeading = /^[🏠📊🚉🔎✅📌]/u.test(line) && line.length <= 40 && !/[.!?]$/.test(line);

    if (markdownHeading || wholeBold || emojiHeading) {
      blocks.push({ type: "subheading", text: line });
      continue;
    }

    blocks.push({ type: "body", text: line });
  }

  return blocks;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function naverPlainText(blocks: NaverBlock[]) {
  return blocks.map((block) => block.text).join("\r\n \r\n");
}

function naverRichHtml(blocks: NaverBlock[]) {
  const font = "'Nanum Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif";
  const blockHtml = blocks.map((block) => {
    const safe = escapeHtml(block.text);
    if (block.type === "title") {
      return `<div style="font-family:${font};font-size:20pt;line-height:1.5;font-weight:700;margin:0;">${safe}</div>`;
    }
    if (block.type === "subheading") {
      return `<div style="font-family:${font};font-size:18pt;line-height:1.55;font-weight:700;margin:0;">${safe}</div>`;
    }
    if (block.type === "tags") {
      return `<div style="font-family:${font};font-size:13.5pt;line-height:1.6;font-weight:400;margin:0;">${safe}</div>`;
    }
    if (block.type === "image") {
      return `<div style="font-family:${font};font-size:15pt;line-height:1.6;font-weight:600;margin:0;">${safe}</div>`;
    }
    return `<div style="font-family:${font};font-size:15pt;line-height:1.7;font-weight:400;margin:0;">${safe}</div>`;
  });

  const spacer = `<div style="font-family:${font};font-size:15pt;line-height:1.7;margin:0;"><br></div>`;
  return `<div>${blockHtml.join(spacer)}</div>`;
}

function drawBrand(ctx: CanvasRenderingContext2D, x: number, y: number, dark = false) {
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = dark ? "#0d1827" : "rgba(255,255,255,.94)";
  ctx.fillText("집값쓱", x, y);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = dark ? "#65748b" : "rgba(255,255,255,.62)";
  ctx.fillText("APARTMENT NOTE", x, y + 42);
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}


function buildThumbnailHook(monthlyStats: MonthlyStat[], fallback = "요즘 얼마에 거래될까?") {
  const monthly = monthlyStats.slice(-6);
  const valid = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last || !first.medianPrice) return fallback;

  const delta = last.medianPrice - first.medianPrice;
  const rate = (delta / first.medianPrice) * 100;
  const priceStrong = Math.abs(delta) >= 70000000 || Math.abs(rate) >= 8;
  const firstTrades = first.tradeCount ?? 0;
  const lastTrades = last.tradeCount ?? 0;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isCurrentMonthIncomplete = last.month === currentMonthKey && now.getDate() < lastDayOfMonth;
  const completedTradeLast = isCurrentMonthIncomplete && valid.length >= 2 ? valid[valid.length - 2] : last;
  const completedLastTrades = completedTradeLast?.tradeCount ?? 0;

  const tradeSurge = lastTrades >= 3 && (
    (firstTrades === 0 && lastTrades >= 3) ||
    (firstTrades > 0 && lastTrades >= firstTrades * 2 && lastTrades - firstTrades >= 2)
  );
  const tradeDrop = firstTrades >= 3 &&
    completedLastTrades <= Math.max(1, Math.floor(firstTrades / 2)) &&
    firstTrades - completedLastTrades >= 2;

  if (priceStrong && delta !== 0) {
    return delta > 0
      ? "6개월 새 00억 올랐다"
      : "6개월 새 00억 빠졌다";
  }
  if (tradeSurge) return "거래가 다시 몰렸다";
  if (tradeDrop) return "거래가 눈에 띄게 줄었다";
  return fallback;
}

const ARTICLE_THEME_META: Record<ArticleThemeId, { label: string; angle: string }> = {
  price: {
    label: "가격 변화",
    angle: "6개월 첫 대표값과 최근 대표값의 변화폭·변화율을 중심으로 보되 단순 숫자 나열은 피한다.",
  },
  band: {
    label: "가격대 전환",
    angle: "몇 억대에서 몇 억대로 가격대가 바뀌었는지와 그 과정의 월별 흐름을 중심으로 본다.",
  },
  trade: {
    label: "거래량 변화",
    angle: "거래가 유독 몰린 달·줄어든 달을 찾고 가격 흐름과 함께 해석한다. 거래량만으로 심리를 단정하지 않는다.",
  },
  mixed: {
    label: "가격·거래 엇갈림",
    angle: "가격 방향과 거래량 방향이 서로 다르게 움직였는지를 중심으로 본다.",
  },
  rebound: {
    label: "저점·고점·반등",
    angle: "6개월 중간 저점 또는 고점 이후 최근 대표값이 어디까지 회복·조정됐는지를 중심으로 본다.",
  },
  volatility: {
    label: "가격 변동성",
    angle: "월별 대표값의 고저 차이와 출렁임 자체를 핵심 장면으로 잡는다.",
  },
  highlow: {
    label: "6개월 고점·저점 위치",
    angle: "최근 대표값이 6개월 범위의 고점·저점 중 어디에 가까운지를 중심으로 본다.",
  },
  stable: {
    label: "보합·관망",
    angle: "큰 방향성보다 좁은 가격 범위와 거래량 변화를 중심으로 차분하게 본다.",
  },
};

function analyzeArticleThemes(monthlyStats: MonthlyStat[]): ArticleThemeChoice[] {
  const valid = monthlyStats.slice(-6).filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const baseScores: Record<ArticleThemeId, number> = {
    price: 25,
    band: 5,
    trade: 15,
    mixed: 5,
    rebound: 5,
    volatility: 10,
    highlow: 15,
    stable: 5,
  };

  if (valid.length < 2) {
    return (Object.keys(baseScores) as ArticleThemeId[])
      .map((id) => ({ id, ...ARTICLE_THEME_META[id], score: baseScores[id] }))
      .sort((a, b) => b.score - a.score);
  }

  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = last.medianPrice - first.medianPrice;
  const rate = first.medianPrice ? (delta / first.medianPrice) * 100 : 0;
  const prices = valid.map((item) => item.medianPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minIndex = prices.indexOf(minPrice);
  const maxIndex = prices.indexOf(maxPrice);
  const rangeRate = minPrice ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const completed = valid.filter((item) => !(item.month === currentMonthKey && now.getDate() < lastDayOfMonth));
  const tradeStats = completed.length ? completed : valid;
  const tradeCounts = tradeStats.map((item) => item.tradeCount ?? 0);
  const sortedTrades = [...tradeCounts].sort((a, b) => a - b);
  const medianTrade = sortedTrades.length
    ? sortedTrades[Math.floor(sortedTrades.length / 2)]
    : 0;
  const firstTrades = tradeStats[0]?.tradeCount ?? 0;
  const lastTrades = tradeStats[tradeStats.length - 1]?.tradeCount ?? 0;
  const maxTrades = Math.max(...tradeCounts, 0);
  const tradeSurge = lastTrades >= 3 && firstTrades > 0 && lastTrades >= firstTrades * 1.6 && lastTrades - firstTrades >= 2;
  const tradeDrop = firstTrades >= 3 && lastTrades <= Math.max(1, Math.floor(firstTrades * 0.6)) && firstTrades - lastTrades >= 2;
  const tradeConcentration = maxTrades >= 5 && maxTrades >= Math.max(5, medianTrade * 1.7);

  baseScores.price = 35 + Math.min(35, Math.abs(rate) * 2.4);

  const firstBand = Math.floor(first.medianPrice / 100000000);
  const lastBand = Math.floor(last.medianPrice / 100000000);
  if (firstBand !== lastBand) baseScores.band = 88;

  if (tradeSurge || tradeDrop) baseScores.trade = 84;
  else if (tradeConcentration) baseScores.trade = 72;

  const priceUp = rate >= 4;
  const priceDown = rate <= -4;
  if ((priceUp && tradeDrop) || (priceDown && tradeSurge)) baseScores.mixed = 92;
  else if ((priceUp && lastTrades < firstTrades) || (priceDown && lastTrades > firstTrades)) baseScores.mixed = 70;

  const reboundedFromLow = minIndex > 0 && minIndex < valid.length - 1 && minPrice > 0 && ((last.medianPrice - minPrice) / minPrice) * 100 >= 5;
  const pulledBackFromHigh = maxIndex > 0 && maxIndex < valid.length - 1 && maxPrice > 0 && ((maxPrice - last.medianPrice) / maxPrice) * 100 >= 4;
  if (reboundedFromLow || pulledBackFromHigh) baseScores.rebound = 86;

  if (rangeRate >= 12) baseScores.volatility = 82;
  else if (rangeRate >= 8) baseScores.volatility = 68;

  const nearHigh = maxPrice > 0 && last.medianPrice >= maxPrice * 0.98;
  const nearLow = minPrice > 0 && last.medianPrice <= minPrice * 1.02;
  if (nearHigh || nearLow) baseScores.highlow = 74;

  if (Math.abs(rate) <= 3 && rangeRate <= 6) baseScores.stable = 88;
  else if (Math.abs(rate) <= 5 && rangeRate <= 8) baseScores.stable = 68;

  return (Object.keys(baseScores) as ArticleThemeId[])
    .map((id) => ({ id, ...ARTICLE_THEME_META[id], score: baseScores[id] }))
    .sort((a, b) => b.score - a.score);
}

function selectArticleTheme(
  monthlyStats: MonthlyStat[],
  mode: ArticleThemeMode,
  recentThemes: ArticleThemeId[],
  recommendedAngle: string
): ArticleThemeChoice {
  const candidates = analyzeArticleThemes(monthlyStats);
  if (mode !== "auto") {
    const manual = candidates.find((item) => item.id === mode);
    if (manual) return manual;
  }

  const recent = new Set(recentThemes.slice(-2));
  const fresh = candidates.find((item) => item.score >= 60 && !recent.has(item.id));
  const choice = fresh || candidates.find((item) => !recent.has(item.id)) || candidates[0];

  if (recommendedAngle.trim() && monthlyStats.filter((item) => item.medianPrice != null).length < 2) {
    return { ...choice, angle: recommendedAngle.trim() };
  }
  return choice;
}

function makeThumbnailPrompt(data: ApartmentData, monthlyStats: MonthlyStat[], articleTheme: ArticleThemeChoice) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const valid = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = first && last ? last.medianPrice - first.medianPrice : null;
  const changeRate = first?.medianPrice && last?.medianPrice
    ? (delta! / first.medianPrice) * 100
    : null;
  const userMainCopy = data.question.trim();
  const toneLabel: Record<ThumbnailTone, string> = {
    auto: "자동 추천",
    standard: "정석형",
    hook: "후킹형",
    humor: "유머형",
  };
  const toneInstruction: Record<ThumbnailTone, string> = {
    auto: "정석형·후킹형·유머형 3가지를 내부적으로 비교한 뒤 가장 잘 맞는 1픽을 선택할 것.",
    standard: "정석형만 사용. 데이터가 바로 이해되는 안정적이고 신뢰감 있는 문구를 선택할 것.",
    hook: "후킹형만 사용. 실제 데이터에 근거한 놀람·의문·반전 표현으로 클릭을 유도하되 과장하지 말 것.",
    humor: "유머형만 사용. 부동산 신뢰감을 해치지 않는 선에서 가볍고 재치 있는 문구를 선택할 것.",
  };
  const mainCopyBlock = userMainCopy
    ? `\n[사용자 지정 메인 문구]\n${userMainCopy}\n- 사용자가 직접 입력한 문구이므로 이 문구를 우선 사용하되, 숫자나 사실이 제공 데이터와 충돌하면 데이터에 맞게 최소 수정할 것.\n`
    : "";
  const selectedCopyGuide = userMainCopy
    ? userMainCopy
    : data.thumbnailTone === "auto"
      ? "정석형·후킹형·유머형 3가지를 내부적으로 비교해 고른 최종 1픽"
      : `${toneLabel[data.thumbnailTone]} 톤으로 고른 최종 1픽`;

  return `네이버 블로그용 아파트 썸네일 이미지를 만들어줘.

[기본 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
최근 실거래가: ${value(data.recentPrice)}
비교 가격: ${value(data.previousPrice)}
세대수: ${value(data.households)}
입주년도: ${value(data.moveIn)}
주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}

[가격·거래 흐름 정보]
비교 시점: 최근 6개월
비교값: ${first ? formatWon(first.medianPrice) : "확인 필요"}
최근값: ${last ? formatWon(last.medianPrice) : "확인 필요"}
변화액: ${delta == null ? "계산 불가" : (delta >= 0 ? "+" : "-") + formatWon(Math.abs(delta))}
변화율: ${changeRate == null ? "계산 불가" : (changeRate >= 0 ? "+" : "") + changeRate.toFixed(1) + "%"}
첫 유효월 거래량: ${first ? first.tradeCount + "건" : "확인 필요"}
최근 유효월 거래량: ${last ? last.tradeCount + "건" : "확인 필요"}

${mainCopyBlock}
[이번 글의 주제 방향]
주제: ${articleTheme.label}
관점: ${articleTheme.angle}

[썸네일 톤 선택]
${toneLabel[data.thumbnailTone]}
${toneInstruction[data.thumbnailTone]}

[썸네일 메인 문구 생성 규칙]
- 사용자가 메인 문구를 직접 입력했다면 그 문구를 우선 사용한다.
- 입력값이 비어 있으면 위 [썸네일 톤 선택]을 최우선으로 따를 것.
- 자동 추천이면 반드시 3가지 톤을 내부 비교할 것: ① 정석형 = 데이터가 바로 이해되는 안정형 ② 후킹형 = 놀람·의문·반전으로 클릭을 유도하는 형 ③ 유머형 = 부동산 신뢰감을 해치지 않는 선에서 살짝 재치 있는 형.
- 정석형·후킹형·유머형 중 하나를 직접 선택했다면 다른 톤과 비교하지 말고 선택한 톤 안에서 가장 좋은 문구를 만들 것.
- 후보를 사용자에게 나열하지 말고 최종 1픽만 이미지에 사용할 것.
- 위 [이번 글의 주제 방향]을 우선 반영해 본문과 썸네일이 같은 핵심 이야기를 하게 할 것.
- 가격 상승·하락, 가격대 전환, 저점 반등, 고점 접근, 거래량 급증·감소, 가격과 거래량의 엇갈림 중 선택된 주제 안에서 가장 눈에 띄는 장면을 찾을 것.
- '6개월 새 00억 올랐다' 같은 하나의 고정 문법을 기본값으로 반복하지 말 것.
- 가격 변화가 강하더라도 상승액만 기계적으로 요약하지 말고 '4억대였는데 5억 넘었다', '저점 찍고 다시 5억대'처럼 사람이 한눈에 이해하는 장면형 표현도 적극 검토할 것.
- 후킹형은 '초원부영, 5억 넘었다고?'처럼 실제 데이터에 근거한 가벼운 놀람·의문형을 사용할 수 있다.
- 유머형은 '조용했는데 가격은 안 조용했다'처럼 한 스푼 정도의 재치만 허용하고, '폭등', '무조건 오른다', '지금 안 보면 후회' 같은 과장·투자유도 표현은 금지한다.
- 진행 중인 최신 월의 낮은 거래건수만으로 거래 감소형을 선택하지 말고 완료된 월끼리 비교할 것.
- 거래량만으로 사람들의 심리나 의도를 추정하지 말 것.
- 본문 제목과 썸네일 문구는 완전히 같을 필요가 없다. 다만 같은 글이라는 느낌이 들도록 동일한 가격·거래 데이터 맥락 안에서 연결할 것.
- 숫자와 기간은 제공된 데이터만 사용하고 임의로 만들지 말 것.
- 모바일 목록에서 한 번에 읽히도록 짧고 강하게 작성할 것.
- 최종 이미지에는 선택 과정이나 '정석형/후킹형/유머형' 라벨을 표시하지 말 것.

[이미지 제작 기준]
- 네이버 블로그 썸네일용
- 정확한 크기 1254×1254px
- 정사각형 1:1
- 모바일 목록에서 잘리지 않도록 핵심 문구는 중앙 안전영역에 배치
- 집값쓱 부동산 콘텐츠 스타일
- 깔끔하고 신뢰감 있는 고급 부동산 디자인
- 모바일에서도 단지명과 메인 문구가 즉시 읽히도록 큰 글씨 사용
- 너무 많은 정보는 넣지 말 것
- 단지명은 크게
- 숫자형 메인 카피의 금액과 기간을 가장 강하게 강조
- 하단에는 대표면적 / 최근 실거래 / 입지 핵심 정도만 작은 보조정보로 표시
- 배경은 특정 검색 사진을 복사하거나 변형하지 말고, 고급 아파트·도시·건축 분위기의 새로운 그래픽 또는 일러스트로 구성
- 실제 단지 배치를 정확히 재현한 것처럼 보이지 않게 할 것
- 로고, 워터마크, 출처 불명의 사진 사용 금지
- 한글 텍스트 오탈자 없이 제작

[권장 구성]
상단 좌측: 집값쓱
상단 우측: ${value(data.region)}
중앙: ${value(data.name)}
메인 카피: ${selectedCopyGuide}
하단 보조칩: ${value(data.area)} / 최근 실거래 / 입지 핵심

이미지를 바로 생성해줘.`;
}


function makePriceImagePrompt(data: ApartmentData, monthlyStats: MonthlyStat[]) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const valid = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const change = first?.medianPrice && last?.medianPrice
    ? ((last.medianPrice - first.medianPrice) / first.medianPrice) * 100
    : null;
  const lines = monthly.length
    ? monthly.map((item) =>
        `- ${item.month}: 대표가격 ${item.medianPrice == null ? "거래 없음" : formatWon(item.medianPrice)} / 거래 ${item.tradeCount}건`
      ).join("\n")
    : "- 최근 6개월 데이터 없음";

  return `네이버 블로그 본문용 아파트 시세 그래프 이미지를 만들어줘.

[단지 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}

[최근 6개월 월별 실거래 데이터]
${lines}

[요약값]
첫 유효 대표값: ${first ? formatWon(first.medianPrice) : "확인 필요"}
최근 유효 대표값: ${last ? formatWon(last.medianPrice) : "확인 필요"}
대표값 변화율: ${change == null ? "계산 불가" : (change >= 0 ? "+" : "") + change.toFixed(1) + "%"}

[이미지 제작 기준]
- 정확한 크기 1600×900px
- 네이버 블로그 본문용 가로 이미지
- 집값쓱 부동산 콘텐츠 스타일
- 깔끔하고 신뢰감 있는 고급 정보형 디자인
- 제목은 '최근 6개월 실거래 흐름'
- 선그래프로 월별 대표가격 흐름을 보여줄 것
- 거래가 있는 모든 월의 데이터 포인트 위에 가격 라벨을 반드시 표시할 것
- 최신 월 가격 라벨은 다른 월보다 조금 더 크게 강조할 것
- 각 월 아래에는 거래건수도 표시할 것
- 거래가 없는 달은 임의의 가격을 만들지 말고 '거래 없음'으로 표시할 것
- 오른쪽 요약 영역에 최근 대표값 / 첫 대표값 / 변화율을 정리할 것
- 제공한 숫자를 임의로 수정하거나 새로운 가격을 만들어내지 말 것
- 한글과 숫자 오탈자가 없도록 검수할 것
- 불필요한 장식은 줄이고 모바일에서도 가격 숫자가 바로 읽히게 할 것

이미지를 바로 생성해줘.`;
}

function makeLocationImagePrompt(data: ApartmentData) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  return `네이버 블로그 본문용 아파트 입지 인포그래픽 이미지를 만들어줘.

[단지 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
가까운 주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}

[지도 참고 방식]
- 이 요청과 함께 붙여넣은 네이버 지도 캡처를 '위치 관계 확인용 참고자료'로 사용해줘.
- 지도 캡처가 첨부되어 있지 않다면 이미지를 임의로 만들지 말고 지도 캡처를 먼저 요청해줘.
- 캡처에서 단지 위치, 주요 역, 도로와 주변 생활권의 상대적 위치를 파악해줘.
- 네이버 지도의 지도 타일, 색상, 폰트, 아이콘, 로고, UI를 그대로 복제하지 말 것.
- 원본 지도를 배경으로 그대로 재사용하지 말고 새로운 부동산 입지 인포그래픽으로 재구성할 것.
- 정확한 축척 지도처럼 오해될 표현은 피하고 '입지 한눈에 보기' 정보 카드로 표현할 것.
- 지도에서 확인되지 않는 학교·공원·상권·교통시설을 임의로 추가하지 말 것.

[이미지 제작 기준]
- 정확한 크기 1600×900px
- 네이버 블로그 본문용 가로 이미지
- 집값쓱 부동산 콘텐츠 스타일
- 단지 위치를 가장 분명하게 강조
- 주요 역은 두 번째로 강조
- 필요한 도로·생활권 요소만 최소한으로 표시
- 우측 또는 하단에 한 줄 입지 설명을 별도 정보 카드로 배치
- 깔끔하고 신뢰감 있는 고급 부동산 인포그래픽
- 한글 텍스트 오탈자 없이 제작

지도 캡처의 위치 관계를 참고해서 새로운 입지 이미지를 바로 생성해줘.`;
}


function makeBodyPrompt(
  data: ApartmentData,
  monthlyStats: MonthlyStat[],
  recommendedAngle: string,
  articleTheme: ArticleThemeChoice
) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const monthlyLines = monthly.length
    ? monthly.map((item) =>
        `- ${item.month}: 월 대표값 ${item.medianPrice == null ? "거래 없음" : formatWon(item.medianPrice)}, 거래 ${item.tradeCount}건`
      ).join("\n")
    : "- 월별 실거래 데이터 없음";
  const validMonthly = monthly.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const firstMonthly = validMonthly[0];
  const lastMonthly = validMonthly[validMonthly.length - 1];
  const priceDelta = firstMonthly && lastMonthly ? lastMonthly.medianPrice - firstMonthly.medianPrice : null;
  const priceRate = firstMonthly?.medianPrice && lastMonthly?.medianPrice
    ? (priceDelta! / firstMonthly.medianPrice) * 100
    : null;
  const firstTradeCount = firstMonthly?.tradeCount ?? null;
  const lastTradeCount = lastMonthly?.tradeCount ?? null;
  const articleAngle = recommendedAngle.trim();
  const today = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `네이버 블로그용 아파트 분석글을 최종 발행본으로 작성해줘.

[작성 기준일]
${today}

[단지 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
최근 실거래가: ${value(data.recentPrice)}
비교값: ${value(data.previousPrice)}
세대수: ${value(data.households)}
입주년도: ${value(data.moveIn)}
주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}
참고 관점: ${articleAngle || "없음 — GPT가 최근 6개월 데이터에서 직접 선정"}

[이번 글의 주제 — 최우선]
주제 유형: ${articleTheme.label}
핵심 관점: ${articleTheme.angle}
- 제목, 도입부, ⑤ 이 단지만의 핵심 포인트는 이 주제를 중심으로 작성할 것.
- 선택 주제가 '가격 변화'가 아닌데 가격 상승폭만 다시 메인 제목으로 가져오지 말 것.
- 데이터가 선택 주제를 뒷받침하지 못할 때만 가장 가까운 다른 주제로 최소 조정할 것.

[최근 6개월 실거래 데이터]
${monthlyLines}

[제목용 요약 — 월 대표값 기준]
첫 유효 대표값: ${firstMonthly ? formatWon(firstMonthly.medianPrice) : "확인 필요"}
최근 유효 대표값: ${lastMonthly ? formatWon(lastMonthly.medianPrice) : "확인 필요"}
대표값 변화액: ${priceDelta == null ? "계산 불가" : (priceDelta >= 0 ? "+" : "-") + formatWon(Math.abs(priceDelta))}
대표값 변화율: ${priceRate == null ? "계산 불가" : (priceRate >= 0 ? "+" : "") + priceRate.toFixed(1) + "%"}
첫 유효월 거래량: ${firstTradeCount == null ? "확인 필요" : firstTradeCount + "건"}
최근 유효월 거래량: ${lastTradeCount == null ? "확인 필요" : lastTradeCount + "건"}

중요:
최근 실거래가는 개별 계약 가격이고 월 대표값은 월별 통계값이다.
두 값을 하나의 가격처럼 섞거나 서로 비교해 상승률을 계산하지 말 것.

[최신 정보 확인]
- 웹 검색이 가능하면 작성 전에 이 단지와 직접 관련된 최신 정보만 확인할 것.
- 정비사업, 교통, 공급, 생활권, 개발계획은 공식자료를 우선할 것.
- 계획·검토·추진·지정·착공·개통 목표·확정을 정확히 구분할 것.
- 확인되지 않은 호재나 인과관계는 쓰지 말 것.
- 정비사업이나 교통 이슈와 거래 증가가 동시에 나타났더라도 직접 원인이라고 단정하지 말 것.
- 웹 검색이 불가능하면 최신 정보를 추정하지 말 것.
- 직선거리 정보를 도보시간으로 임의 환산하지 말 것.
- 최종 발행본문에는 원문 URL, 마크다운 링크, 괄호형 출처 링크, UTM 주소를 절대 넣지 말 것.
- 외부 정보를 반영할 때는 '군포시 고시자료에 따르면', 'LH 보도자료에 따르면'처럼 기관명과 자료 성격만 자연스러운 일반 문장으로 적을 것.
- 별도의 출처 목록이나 링크 모음은 출력하지 말 것.

[제목 규칙]
- 최종 제목 1개만 출력할 것.
- 제목 후보는 내부적으로 최소 5개를 만들어 비교한 뒤 가장 좋은 1개만 출력할 것. 후보 목록은 최종 결과에 표시하지 말 것.
- 단지명을 제목 앞부분에 자연스럽게 넣고, 지역명·대표 전용면적·아파트 시세 검색어는 필요할 때만 자연스럽게 조합할 것.
- 위 [이번 글의 주제 — 최우선]을 제목의 핵심 소재로 사용할 것.
- 자동 주제는 가격 변화, 가격대 전환, 거래량 변화, 가격·거래 엇갈림, 저점·고점·반등, 가격 변동성, 6개월 고점·저점 위치, 보합·관망의 8개 계열에서 데이터에 맞게 선택된다.
- '6개월 새 ○○억 올랐다' 같은 한 가지 제목 문법을 모든 단지에 반복하지 말 것.
- 최근 글들이 가격 상승형으로 몰리지 않도록 거래량·고점/저점·반등·변동성·엇갈림처럼 데이터가 뒷받침되는 다른 관점을 적극 사용할 것.
- 상승액·상승률이 크더라도 숫자를 단순 나열하는 방식만 고집하지 말고 가격대 변화, 반등, 거래 흐름 등 더 직관적인 장면이 있으면 그쪽을 우선 검토할 것.
- 검색 유입을 고려해 무엇을 다루는 글인지 바로 알 수 있게 쓰되, 답을 전부 공개하지 않아 클릭할 이유는 남길 것.
- 가능하면 32자 이내, 최대 38자 이내로 작성할 것.
- 작성 기준일이 해당 월의 말일 이전이면 최신 월 거래량은 아직 집계 중인 값으로 취급할 것.
- 진행 중인 최신 월의 거래건수를 사용할 때는 반드시 '현재' 또는 '현재까지'라는 의미가 드러나게 표현할 것.
- 거래 증가·감소 판단은 가급적 완료된 월끼리 비교하고, 진행 중인 월은 보조 정보로만 사용할 것.
- 거래량만으로 사람들의 심리나 관심을 사실처럼 추정하지 말 것.
- '왜/이유/까닭'은 원인이 확인됐을 때만 사용할 것. 원인이 확정되지 않았다면 '배경은?', '무엇이 달라졌나', '이어질까'처럼 열어 둘 것.
- 최근 실거래가와 월 대표값을 하나의 가격처럼 섞어 제목을 만들지 말 것.
- 썸네일 문구와 제목은 완전히 같을 필요가 없다. 서로 쌩뚱맞지 않도록 같은 데이터·주제 맥락만 유지할 것.
- 과장, 매수 권유, 투자 확정 표현은 금지할 것.

[본문 규칙]
- 한 문장 = 한 문단으로 작성할 것.
- 한 문단에 2문장 이상 붙이지 말 것.
- 짧고 자연스러운 문장을 우선할 것.
- 과장, 매수 권유, 투자 확정 표현 금지.
- 제공되지 않은 숫자를 만들지 말 것.
- 개별 계약 가격은 '최근 실거래가' 또는 '개별 실거래가'라고 표현할 것.
- 월별 통계값은 반드시 '월 대표값'이라고 표현할 것.
- 전용면적은 '전용 84㎡대'처럼 표현할 것.
- 이모지는 🏠📊🚉🔎✅📌 정도만 자연스럽게 사용할 것.
- 단지명, 지역명, 아파트 실거래가, 아파트 시세 키워드를 자연스럽게 포함할 것.
- 확인되지 않은 원인은 '~때문이다'라고 단정하지 말고 '배경 중 하나로 볼 수 있다', '함께 살펴볼 요소다'처럼 표현할 것.
- 거래 건수가 적으면 소수 거래의 영향도 함께 언급할 것.

[본문 구조 — 70% 고정 + 30% 가변]
① 강한 도입 2~3문장
② 최근 6개월 시세 흐름
③ 거래량 변화
④ 입지·생활권
⑤ 이 단지만의 핵심 포인트
⑥ 앞으로 체크할 것
⑦ 짧은 마무리 + 3줄 요약
- 세대수·입주년도 같은 기본정보는 별도 정보 나열로 길게 빼지 말고 도입이나 관련 섹션에 자연스럽게 녹일 것.
- ⑤ 핵심 포인트는 단지별 데이터에 따라 반등, 거래 급증·감소, 고점 접근, 가격과 거래량의 엇갈림, 정비사업, 신축·입주 등으로 자유롭게 바꿀 것.
- 전체 원칙은 '틀은 일정하게, 내용과 후킹은 다르게'로 할 것.
- 모바일 가독성을 위해 한 문단은 짧게 유지하고, 같은 숫자와 같은 설명을 여러 섹션에서 반복하지 말 것.

[이미지 위치]
도입부 뒤:
[이미지 1 — 썸네일]

최근 6개월 가격 흐름 설명 뒤:
[이미지 2 — 최근 6개월 시세 그래프]

입지와 생활권 설명 전후:
[이미지 3 — 입지 인포그래픽]

각 이미지 문구는 반드시 한 줄 단독으로 출력할 것.

[폰트·출력 서식 — 최우선]
- 제목 20pt / 소제목 18pt / 일반 본문 15pt / 태그 13~14pt 기준으로 작성할 것.
- 실제 최종 글에 '20pt', '18pt', '15pt', '13~14pt' 같은 편집 지시문은 출력하지 말 것.
- 일반 본문은 네이버 블로그 기본 본문 크기로 유지하고 제목과 소제목만 크게 구분할 것.
- 제목은 가장 크게, 소제목은 본문보다 한 단계 크게 보이도록 각각 독립된 줄로 작성할 것.
- 소제목은 굵게, 일반 본문은 기본 굵기로 유지할 것.
- 네이버 모바일에서 읽기 쉽게 본문은 '한 문장 = 한 문단'으로 작성할 것.
- 일반 본문 문장과 다음 문장 사이에는 네이버 블로그에 붙여넣어도 간격이 유지되도록 스페이스바 1칸이 들어간 간격용 줄을 1개 넣을 것.
- 기본 형식은 '문장 → 엔터 → 스페이스바 1칸이 있는 줄 → 엔터 → 다음 문장'으로 할 것.
- 완전히 비어 있는 빈 줄을 사용하지 말 것.
- 제목 다음에도 스페이스바 1칸이 들어간 간격용 줄을 1개 넣을 것.
- 소제목 앞뒤에도 각각 같은 간격용 줄을 1개 넣을 것.
- 이미지 위치 문구는 한 줄 단독으로 두고 위아래 각각 같은 간격용 줄을 1개 넣을 것.
- 3줄 요약은 각 문장을 한 줄씩 따로 쓰고 문장 사이에도 같은 간격용 줄을 1개 넣을 것.
- 일반 텍스트가 있는 줄의 시작에는 불필요한 공백을 넣지 말 것.
- 코드블록과 HTML은 사용하지 말 것.

[마무리]
- 앞으로 체크할 것은 매수 권유가 아니라 월 대표값, 거래량, 개별 실거래가, 정비사업 진행 단계 등 실제 데이터 중심으로 작성할 것.
- 3줄 요약은 정확히 3문장으로 작성할 것.
- 네이버 태그는 단지명·지역명·핵심 검색어 중심으로 중복 없이 정확히 7개만 작성할 것.
- 태그는 마지막 한 줄에 '#백두동성 #산본동아파트'처럼 일반 # 기호를 그대로 사용해 출력할 것.
- 태그 앞의 #을 '\#'처럼 백슬래시로 이스케이프하지 말 것.
- 태그에 마크다운 기호나 코드 표시를 붙이지 말 것.

[최종 출력]
아래 3가지만 출력할 것.
1) 최종 제목 1개
2) 최종 본문
3) 네이버 태그 7개

제목 후보, 검색 과정, 출처 목록, 작성 설명, 내부링크 추천, 기타 부가 설명은 출력하지 말 것.

[출력 직전 자가검수]
- 제목 1개
- 태그 정확히 7개
- 모든 문장·제목·소제목·이미지 위치·요약 사이에 스페이스바 1칸이 들어간 간격용 줄 1개
- 완전히 비어 있는 빈 줄 0개
- 코드블록/HTML 사용 없음
- 최근 실거래가와 월 대표값 혼동 없음
- 제공되지 않은 숫자 생성 없음
- 이미지 위치 3개 포함
- 3줄 요약 정확히 3문장
- 원문 URL/마크다운 링크/괄호형 링크 0개
- 태그의 # 앞에 백슬래시 0개
- 진행 중인 최신 월 거래량은 '현재/현재까지'로 표시

하나라도 어기면 스스로 수정한 뒤 최종 발행본만 출력할 것.

복사해서 네이버 블로그에 바로 붙여넣을 수 있는 내용만 작성해줘.`;

}

function formatWon(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  const eok = value / 100000000;
  if (eok >= 1) {
    const fixed = eok >= 10 ? eok.toFixed(1) : eok.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "억";
  }
  return Math.round(value / 10000).toLocaleString("ko-KR") + "만원";
}

async function makeThumbnail(data: ApartmentData, photoDataUrl: string) {
  const photo = photoDataUrl ? await loadImage(photoDataUrl) : null;
  return canvasUrl(1254, 1254, (ctx) => {
    if (photo) {
      drawCover(ctx, photo, 0, 0, 1254, 1254);
      const shade = ctx.createLinearGradient(0, 0, 0, 1254);
      shade.addColorStop(0, "rgba(8,19,34,.36)");
      shade.addColorStop(.42, "rgba(8,19,34,.28)");
      shade.addColorStop(1, "rgba(5,16,30,.92)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, 1254, 1254);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 1254, 1254);
      bg.addColorStop(0, "#0a1829");
      bg.addColorStop(.58, "#123c50");
      bg.addColorStop(1, "#0a6d70");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1254, 1254);

      ctx.save();
      ctx.globalAlpha = .18;
      ctx.strokeStyle = "#b9fff4";
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        roundRect(ctx, 740 + i * 48, 160 + i * 36, 250, 760 - i * 38, 18);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,.06)";
      roundRect(ctx, 760, 300, 330, 650, 22);
      ctx.fill();
      ctx.fillStyle = "rgba(161,246,231,.42)";
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
          roundRect(ctx, 804 + col * 62, 356 + row * 60, 30, 24, 5);
          ctx.fill();
        }
      }
    }

    drawBrand(ctx, 78, 70);

    roundRect(ctx, 862, 70, 314, 52, 26);
    ctx.fillStyle = "rgba(8,22,36,.52)";
    ctx.fill();
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.textAlign = "center";
    ctx.fillText(data.region || "지역", 1019, 83);
    ctx.textAlign = "left";

    ctx.font = `700 23px ${FONT}`;
    ctx.fillStyle = "#88efe2";
    ctx.fillText("단지 실거래 · 가격 흐름", 78, 328);

    const nameSize = fitText(ctx, data.name || "아파트 단지", 1080, 94, 58, 900);
    ctx.font = `900 ${nameSize}px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.28)";
    ctx.shadowBlur = 18;
    ctx.fillText(data.name || "아파트 단지", 78, 374);
    ctx.shadowBlur = 0;

    roundRect(ctx, 78, 650, 1098, 196, 32);
    ctx.fillStyle = "rgba(7,20,34,.78)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ff8f84";
    roundRect(ctx, 78, 650, 14, 196, 7);
    ctx.fill();

    ctx.font = `900 66px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    drawWrapped(ctx, data.question || "요즘 얼마에 거래될까?", 128, 690, 980, 80, 2);

    const chips = [data.area || "대표면적", "최근 실거래", "입지 핵심"];
    let chipX = 78;
    chips.forEach((label) => {
      ctx.font = `800 22px ${FONT}`;
      const w = Math.max(150, ctx.measureText(label).width + 48);
      roundRect(ctx, chipX, 914, w, 54, 27);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText(label, chipX + 24, 928);
      chipX += w + 14;
    });

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.moveTo(78, 1040);
    ctx.lineTo(1176, 1040);
    ctx.stroke();

    ctx.font = `700 24px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.fillText("실거래 원자료를 기준으로 최근 흐름을 정리했습니다.", 78, 1084);
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = "#86e9dc";
    ctx.textAlign = "right";
    ctx.fillText("집값쓱", 1176, 1088);
    ctx.textAlign = "left";
  });
}

function makePriceCard(data: ApartmentData, monthlyStats: MonthlyStat[]) {
  return canvasUrl(1600, 900, (ctx) => {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, 0, 1600, 900);
    drawBrand(ctx, 76, 52, true);

    const stats = monthlyStats.slice(-6);
    const valid = stats.filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
    const last = valid[valid.length - 1];

    ctx.font = `900 46px ${FONT}`;
    ctx.fillStyle = "#101b2c";
    ctx.fillText("최근 6개월 실거래 흐름", 76, 134);

    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#718096";
    ctx.fillText(`${data.name} · ${data.area || "대표 전용면적"}`, 76, 198);

    if (!valid.length) {
      roundRect(ctx, 76, 270, 1448, 500, 30);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e1e8f1";
      ctx.stroke();
      ctx.font = `900 38px ${FONT}`;
      ctx.fillStyle = "#203047";
      ctx.fillText("실거래 데이터 연결 후 그래프가 자동 생성됩니다.", 154, 430);
      ctx.font = `700 22px ${FONT}`;
      ctx.fillStyle = "#7a8799";
      ctx.fillText("월별 중앙값 · 거래건수 · 최근 대표값을 한 장에서 보여줍니다.", 154, 494);
      return;
    }

    const lastMonth = last.month.split("-");
    ctx.textAlign = "right";
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = "#78869a";
    ctx.fillText(`${lastMonth[0]}년 ${Number(lastMonth[1])}월 확인 기준`, 1524, 64);
    ctx.textAlign = "left";

    roundRect(ctx, 76, 260, 1090, 540, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e1e8f1";
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, 1192, 260, 332, 540, 30);
    ctx.fillStyle = "#0f2036";
    ctx.fill();

    const prices = valid.map((v) => v.medianPrice);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (min === max) {
      min *= .96;
      max *= 1.04;
    } else {
      const pad = (max - min) * .18;
      min -= pad;
      max += pad;
    }

    const gx = 152, gy = 344, gw = 936, gh = 320;
    ctx.strokeStyle = "#e8edf3";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = gy + (gh / 3) * i;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
    }

    const points: Array<{ x: number; y: number; item: MonthlyStat }> = [];
    stats.forEach((item, index) => {
      const x = gx + (stats.length === 1 ? gw / 2 : (gw * index) / (stats.length - 1));
      if (item.medianPrice != null) {
        const y = gy + gh - ((item.medianPrice - min) / (max - min)) * gh;
        points.push({ x, y, item });
      }
      ctx.font = `700 18px ${FONT}`;
      ctx.fillStyle = "#728196";
      ctx.textAlign = "center";
      ctx.fillText(item.month.slice(5) + "월", x, gy + gh + 34);
      ctx.font = `700 16px ${FONT}`;
      ctx.fillStyle = "#9aa5b4";
      ctx.fillText(item.tradeCount ? item.tradeCount + "건" : "거래 없음", x, gy + gh + 64);
    });

    if (points.length >= 2) {
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = "#0f8b86";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Show the representative price on every valid monthly point.
    points.forEach((p, index) => {
      const isLatest = index === points.length - 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isLatest ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isLatest ? "#ef746e" : "#0f8b86";
      ctx.fill();

      const label = formatWon(p.item.medianPrice);
      ctx.font = `${isLatest ? 900 : 800} ${isLatest ? 21 : 18}px ${FONT}`;
      const labelWidth = ctx.measureText(label).width + (isLatest ? 26 : 22);
      const labelHeight = isLatest ? 36 : 32;
      const labelY = p.y - (isLatest ? 54 : 48);

      roundRect(ctx, p.x - labelWidth / 2, labelY, labelWidth, labelHeight, labelHeight / 2);
      ctx.fillStyle = isLatest ? "#fff0ee" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isLatest ? "rgba(239,116,110,.34)" : "rgba(15,139,134,.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isLatest ? "#d85f59" : "#28545a";
      ctx.textAlign = "center";
      ctx.fillText(label, p.x, labelY + (isLatest ? 7 : 6));
    });
    ctx.textAlign = "left";

    const first = valid[0];
    const change = first.medianPrice ? ((last.medianPrice - first.medianPrice) / first.medianPrice) * 100 : null;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = "#83eadc";
    ctx.fillText("최근 대표값", 1236, 320);
    ctx.font = `900 50px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(formatWon(last.medianPrice), 1236, 360);

    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.moveTo(1236, 444);
    ctx.lineTo(1480, 444);
    ctx.stroke();

    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.fillText("6개월 첫 대표값", 1236, 486);
    ctx.font = `900 31px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(formatWon(first.medianPrice), 1236, 524);

    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.fillText("대표값 변화", 1236, 594);
    ctx.font = `900 34px ${FONT}`;
    ctx.fillStyle = change != null && change < 0 ? "#83c9ff" : "#ff9a96";
    ctx.fillText(change == null ? "-" : (change >= 0 ? "+" : "") + change.toFixed(1) + "%", 1236, 632);

    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.48)";
    ctx.fillText("각 월 대표가격 · 중앙값 기준", 1236, 724);
    ctx.fillText("거래 없는 달은 공백 처리", 1236, 750);
  });
}

function drawContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.22)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  roundRect(ctx, x + 22, y - 23, 142, 46, 18);
  ctx.fillStyle = "rgba(255,255,255,.96)";
  ctx.fill();
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = "#172033";
  ctx.fillText(label, x + 38, y - 13);
  ctx.restore();
}

async function makeMapCard(data: ApartmentData, mapDataUrl: string, aptPoint: Point, stationPoint: Point) {
  const image = await loadImage(mapDataUrl);
  return canvasUrl(1600, 900, (ctx) => {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, 0, 1600, 900);
    drawBrand(ctx, 70, 48, true);

    ctx.font = `900 42px ${FONT}`;
    ctx.fillStyle = "#101b2c";
    ctx.fillText("입지 한눈에 보기", 70, 132);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#6e7d92";
    ctx.fillText(`${data.name} · ${data.station}`, 70, 188);

    const mapX = 70, mapY = 244, mapW = 1080, mapH = 590;
    roundRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#e9eef5";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    const box = drawContain(ctx, image, mapX, mapY, mapW, mapH);
    if (aptPoint) drawMarker(ctx, box.x + aptPoint.x * box.w, box.y + aptPoint.y * box.h, "단지", "#ef476f");
    if (stationPoint) drawMarker(ctx, box.x + stationPoint.x * box.w, box.y + stationPoint.y * box.h, data.station || "주요 역", "#118ab2");
    ctx.restore();
    roundRect(ctx, mapX, mapY, mapW, mapH, 30);
    ctx.strokeStyle = "#dce4ee";
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, 1190, 244, 340, 590, 30);
    ctx.fillStyle = "#0f2036";
    ctx.fill();
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = "#8de8db";
    ctx.fillText("LOCATION NOTE", 1232, 294);
    ctx.font = `900 36px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(data.station || "주요 역", 1232, 350);
    ctx.font = `700 25px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.78)";
    drawWrapped(ctx, data.locationLine || "한 줄 입지 설명", 1232, 430, 250, 38, 5);
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.moveTo(1232, 660);
    ctx.lineTo(1488, 660);
    ctx.stroke();
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.52)";
    ctx.fillText("지도 출처 표시는 원본 유지", 1232, 706);
    ctx.fillText("왜곡 없이 비율 보존", 1232, 738);
  });
}

export default function ApartmentBulkPage() {
  const [data, setData] = useState<ApartmentData>(SAMPLE);
  const [mapDataUrl, setMapDataUrl] = useState("");
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [selectedComplexLoading, setSelectedComplexLoading] = useState(false);
  const [selectedComplexName, setSelectedComplexName] = useState("");
  const [autoMapLoading, setAutoMapLoading] = useState(false);
  const [autoMapMessage, setAutoMapMessage] = useState("");
  const [autoMapGenerated, setAutoMapGenerated] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyMessage, setNearbyMessage] = useState("");
  const [photoCandidates, setPhotoCandidates] = useState<PhotoCandidate[]>([]);
  const [photoCandidatesLoading, setPhotoCandidatesLoading] = useState(false);
  const [photoSearchMessage, setPhotoSearchMessage] = useState("");
  const [photoSearchStart, setPhotoSearchStart] = useState(1);
  const [recommendedAngle, setRecommendedAngle] = useState("");
  const [articleThemeMode, setArticleThemeMode] = useState<ArticleThemeMode>("auto");
  const [recentArticleThemes, setRecentArticleThemes] = useState<ArticleThemeId[]>([]);
  const [aptPoint, setAptPoint] = useState<Point>(null);
  const [stationPoint, setStationPoint] = useState<Point>(null);
  const [markMode, setMarkMode] = useState<"apt" | "station" | null>(null);
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [pricePromptCopied, setPricePromptCopied] = useState(false);
  const [locationPromptCopied, setLocationPromptCopied] = useState(false);
  const [bodyPromptCopied, setBodyPromptCopied] = useState(false);
  const [finalBlogText, setFinalBlogText] = useState("");
  const [naverCopyMessage, setNaverCopyMessage] = useState("");
  const [mapCopyMessage, setMapCopyMessage] = useState("");
  const [dailyDateKey, setDailyDateKey] = useState("");
  const [dailySlots, setDailySlots] = useState<DailySlot[]>(DEFAULT_DAILY_SLOTS);
  const [activeWorkId, setActiveWorkId] = useState("");
  const [activeWorkType, setActiveWorkType] = useState<DailyContentType | null>(null);
  const [workTopic, setWorkTopic] = useState("");
  const [workMaterials, setWorkMaterials] = useState("");
  const [workBody, setWorkBody] = useState("");
  const [workImageNotes, setWorkImageNotes] = useState("");
  const [workAttachments, setWorkAttachments] = useState<WorkAttachment[]>([]);
  const [workProgress, setWorkProgress] = useState<WorkProgress>("not_started");
  const [startedWorkIds, setStartedWorkIds] = useState<string[]>([]);
  const [workSaveMessage, setWorkSaveMessage] = useState("");
  const workHydratingRef = useRef(false);
  const mapPreviewRef = useRef<HTMLImageElement | null>(null);

  const ready = useMemo(() => Boolean(data.name.trim() && data.recentPrice.trim() && mapDataUrl), [data.name, data.recentPrice, mapDataUrl]);
  const selectedArticleTheme = useMemo(
    () => selectArticleTheme(monthlyStats, articleThemeMode, recentArticleThemes, recommendedAngle),
    [monthlyStats, articleThemeMode, recentArticleThemes, recommendedAngle]
  );
  const thumbnailPrompt = useMemo(() => makeThumbnailPrompt(data, monthlyStats, selectedArticleTheme), [data, monthlyStats, selectedArticleTheme]);
  const priceImagePrompt = useMemo(() => makePriceImagePrompt(data, monthlyStats), [data, monthlyStats]);
  const locationImagePrompt = useMemo(() => makeLocationImagePrompt(data), [data]);
  const bodyPrompt = useMemo(
    () => makeBodyPrompt(data, monthlyStats, recommendedAngle, selectedArticleTheme),
    [data, monthlyStats, recommendedAngle, selectedArticleTheme]
  );
  const naverBlocks = useMemo(() => parseNaverBlog(finalBlogText), [finalBlogText]);
  const dailyDoneCount = useMemo(() => dailySlots.filter((slot) => slot.done).length, [dailySlots]);
  const dailyBulkCount = useMemo(() => dailySlots.filter((slot) => slot.type === "bulk").length, [dailySlots]);
  const nextDailySlot = useMemo(() => dailySlots.find((slot) => !slot.done) || null, [dailySlots]);
  const activeWorkSlot = useMemo(
    () => dailySlots.find((slot) => slot.workId && slot.workId === activeWorkId) || null,
    [dailySlots, activeWorkId]
  );

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateKey = formatter.format(new Date());
    setDailyDateKey(dateKey);
    try {
      const raw = window.localStorage.getItem("apartment-bulk-daily-board-v1:" + dateKey);
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length === 7) {
        const validTypes = new Set(Object.keys(DAILY_TYPE_META));
        const normalized = saved.map((slot, index) => ({
          id: index + 1,
          type: validTypes.has(slot?.type) ? slot.type as DailyContentType : DEFAULT_DAILY_SLOTS[index].type,
          done: Boolean(slot?.done),
          workId: typeof slot?.workId === "string" && slot.workId
            ? slot.workId
            : createWorkId(dateKey, index + 1),
        }));
        setDailySlots(normalized);
        window.localStorage.setItem("apartment-bulk-daily-board-v1:" + dateKey, JSON.stringify(normalized));
      } else {
        const next = makeDailySlots(dateKey);
        setDailySlots(next);
        window.localStorage.setItem("apartment-bulk-daily-board-v1:" + dateKey, JSON.stringify(next));
      }
      const indexRaw = window.localStorage.getItem("apartment-bulk-work-index-v1:" + dateKey);
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      setStartedWorkIds(Array.isArray(index) ? index.filter((item): item is string => typeof item === "string") : []);
    } catch {
      setDailySlots(makeDailySlots(dateKey));
      setStartedWorkIds([]);
    }
  }, []);

  useEffect(() => {
    if (!dailyDateKey || activeWorkId || !dailySlots.some((slot) => slot.workId)) return;
    try {
      const lastActive = window.localStorage.getItem("apartment-bulk-active-work-v1:" + dailyDateKey) || "";
      const slot = dailySlots.find((item) => item.workId === lastActive);
      if (slot) void openDailyWork(slot, false);
    } catch {
      // 자동 이어하기가 실패해도 작업판은 그대로 사용합니다.
    }
  }, [dailyDateKey, dailySlots, activeWorkId]);

  useEffect(() => {
    if (!activeWorkId || !activeWorkType || workHydratingRef.current) return;
    const timer = window.setTimeout(() => {
      void persistActiveWork();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    activeWorkId,
    activeWorkType,
    workTopic,
    workMaterials,
    workBody,
    workImageNotes,
    workAttachments,
    workProgress,
    data,
    monthlyStats,
    mapDataUrl,
    aptPoint,
    stationPoint,
    outputs,
    selectedComplexName,
    recommendedAngle,
    articleThemeMode,
    autoMapGenerated,
    autoMapMessage,
    nearbyMessage,
    finalBlogText,
  ]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("apartment-bulk-theme-history-v1") || "[]");
      if (Array.isArray(saved)) {
        const valid = saved.filter((item): item is ArticleThemeId => Object.prototype.hasOwnProperty.call(ARTICLE_THEME_META, item));
        setRecentArticleThemes(valid.slice(-6));
      }
    } catch {
      setRecentArticleThemes([]);
    }
  }, []);

  async function searchPhotoCandidates(name: string, region: string, start = 1) {
    if (!name.trim()) return;
    setPhotoCandidatesLoading(true);
    setPhotoSearchMessage("단지 참고 사진을 찾는 중…");
    try {
      const params = new URLSearchParams({
        query: name.trim(),
        region: region.trim(),
        start: String(start),
      });
      const res = await fetch("/api/apartment/photo-search?" + params.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "사진 검색 실패");
      const items = (json.items || []) as PhotoCandidate[];
      setPhotoCandidates(items);
      setPhotoSearchStart(start);
      setPhotoSearchMessage(items.length ? "검색 사진 3장은 외관 확인 참고용입니다." : "검색 사진을 찾지 못했습니다.");
    } catch (e) {
      setPhotoCandidates([]);
      setPhotoSearchMessage(e instanceof Error ? e.message : "사진 자동 검색에 실패했습니다. 직접 업로드할 수 있습니다.");
    } finally {
      setPhotoCandidatesLoading(false);
    }
  }


  useEffect(() => {
    const complexId = new URLSearchParams(window.location.search).get("complexId");
    if (!complexId) return;
    setSelectedComplexLoading(true);
    fetch("/api/apartment/complexes/" + encodeURIComponent(complexId), { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "단지 데이터를 불러오지 못했습니다.");
        return json as ComplexDetailResponse;
      })
      .then(async (detail) => {
        const firstMedian = detail.snapshot?.first_median_price == null ? null : Number(detail.snapshot.first_median_price);
        const recent = detail.latestTrade?.price ?? (detail.snapshot?.latest_median_price == null ? null : Number(detail.snapshot.latest_median_price));
        const region = [detail.complex.sido, detail.complex.sigungu, detail.complex.legal_dong].filter(Boolean).join(" ");
        const nextData: ApartmentData = {
          ...SAMPLE,
          name: detail.complex.name || SAMPLE.name,
          region: region || SAMPLE.region,
          area: detail.representativeArea ? "전용 " + detail.representativeArea : SAMPLE.area,
          recentPrice: recent ? formatWon(recent) : SAMPLE.recentPrice,
          previousPrice: firstMedian ? "6개월 전 대표값 " + formatWon(firstMedian) : SAMPLE.previousPrice,
          households: detail.complex.households ? detail.complex.households.toLocaleString("ko-KR") + "세대" : SAMPLE.households,
          moveIn: detail.complex.use_date ? detail.complex.use_date.slice(0, 7).replace("-", "년 ") + "월" : SAMPLE.moveIn,
          station: "",
          locationLine: "",
          question: "",
          thumbnailTone: "auto",
        };
        setData(nextData);
        setMonthlyStats(detail.monthly || []);
        setSelectedComplexName(detail.complex.name || "");
        setRecommendedAngle(detail.snapshot?.recommended_angle || "");
        setArticleThemeMode("auto");
        setOutputs(null);

        setNearbyLoading(true);
        setNearbyMessage("가까운 주요 역을 자동으로 찾는 중…");
        void fetch("/api/apartment/nearby?complexId=" + encodeURIComponent(complexId), { cache: "no-store" })
          .then(async (nearbyRes) => {
            const nearbyJson = await nearbyRes.json();
            if (!nearbyRes.ok) throw new Error(nearbyJson.error || "가까운 역 검색 실패");
            setData((prev) => ({
              ...prev,
              station: nearbyJson.station || prev.station,
              locationLine: nearbyJson.locationLine || prev.locationLine,
            }));
            if (nearbyJson.station) {
              const distance = Number(nearbyJson.distanceMeters);
              const distanceText = Number.isFinite(distance) ? ` · 직선거리 약 ${distance.toLocaleString("ko-KR")}m` : "";
              setNearbyMessage(`✅ ${nearbyJson.station} 자동 입력 완료${distanceText}`);
            } else {
              setNearbyMessage("ℹ️ 가까운 역을 찾지 못해 입지 정보는 직접 확인해 주세요.");
            }
          })
          .catch((e) => {
            setNearbyMessage(e instanceof Error ? "ℹ️ " + e.message : "ℹ️ 가까운 역 자동 검색에 실패했습니다.");
          })
          .finally(() => setNearbyLoading(false));

        setAutoMapLoading(true);
        setAutoMapMessage("네이버 지도를 자동으로 만드는 중…");
        setAutoMapGenerated(false);
        try {
          const mapRes = await fetch("/api/apartment/map?complexId=" + encodeURIComponent(complexId), { cache: "no-store" });
          if (!mapRes.ok) {
            const errorJson = await mapRes.json().catch(() => ({}));
            throw new Error(errorJson.error || "지도 자동 생성 실패");
          }
          const mapBlob = await mapRes.blob();
          setMapDataUrl(await blobToDataUrl(mapBlob));
          setAptPoint(null);
          setStationPoint(null);
          setAutoMapGenerated(true);
          setAutoMapMessage("단지 위치가 표시된 네이버 지도를 자동으로 불러왔습니다.");
        } catch (e) {
          setAutoMapMessage(e instanceof Error ? e.message : "지도 자동 생성에 실패했습니다. 직접 업로드할 수 있습니다.");
        } finally {
          setAutoMapLoading(false);
        }
      })
      .catch(() => {})
      .finally(() => setSelectedComplexLoading(false));
  }, []);

  function update<K extends keyof ApartmentData>(key: K, value: ApartmentData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setOutputs(null);
  }

  function saveDailySlots(next: DailySlot[]) {
    setDailySlots(next);
    if (!dailyDateKey) return;
    try {
      window.localStorage.setItem("apartment-bulk-daily-board-v1:" + dailyDateKey, JSON.stringify(next));
    } catch {
      // 저장이 막혀 있어도 화면에서는 계속 사용할 수 있습니다.
    }
  }

  function updateDailyType(id: number, type: DailyContentType) {
    saveDailySlots(dailySlots.map((slot) => slot.id === id ? { ...slot, type } : slot));
    if (activeWorkSlot?.id === id) setActiveWorkType(type);
  }

  function toggleDailyDone(id: number) {
    saveDailySlots(dailySlots.map((slot) => slot.id === id ? { ...slot, done: !slot.done } : slot));
  }

  function resetDailyBoard() {
    const next = makeDailySlots(dailyDateKey || new Date().toISOString().slice(0, 10));
    saveDailySlots(next);
    setActiveWorkId("");
    setActiveWorkType(null);
    setWorkTopic("");
    setWorkMaterials("");
    setWorkBody("");
    setWorkImageNotes("");
    setWorkAttachments([]);
    setWorkProgress("not_started");
    setWorkSaveMessage("");
    setStartedWorkIds([]);
    if (dailyDateKey) {
      try {
        window.localStorage.removeItem("apartment-bulk-work-index-v1:" + dailyDateKey);
        window.localStorage.removeItem("apartment-bulk-active-work-v1:" + dailyDateKey);
      } catch {
        // 초기화는 화면 기준으로 계속 진행합니다.
      }
    }
  }

  function markWorkStarted(workId: string) {
    if (!dailyDateKey || !workId) return;
    const next = Array.from(new Set([...startedWorkIds, workId]));
    setStartedWorkIds(next);
    try {
      window.localStorage.setItem("apartment-bulk-work-index-v1:" + dailyDateKey, JSON.stringify(next));
      window.localStorage.setItem("apartment-bulk-active-work-v1:" + dailyDateKey, workId);
    } catch {
      // 인덱스 저장 실패는 본문 작업 저장을 막지 않습니다.
    }
  }

  function buildActiveWorkSnapshot(): DailyWorkSnapshot | null {
    if (!activeWorkId || !activeWorkType) return null;
    const slot = dailySlots.find((item) => item.workId === activeWorkId);
    if (!slot) return null;
    const isBulk = activeWorkType === "bulk";
    return {
      workId: activeWorkId,
      dateKey: dailyDateKey,
      slotId: slot.id,
      contentType: activeWorkType,
      topic: workTopic,
      materials: workMaterials,
      body: isBulk ? finalBlogText : workBody,
      imageNotes: workImageNotes,
      attachments: workAttachments,
      progress: workProgress,
      updatedAt: new Date().toISOString(),
      bulk: isBulk ? {
        data,
        monthlyStats,
        mapDataUrl,
        aptPoint,
        stationPoint,
        outputs,
        selectedComplexName,
        recommendedAngle,
        articleThemeMode,
        autoMapGenerated,
        autoMapMessage,
        nearbyMessage,
      } : undefined,
    };
  }

  async function persistActiveWork() {
    const snapshot = buildActiveWorkSnapshot();
    if (!snapshot || workHydratingRef.current) return;
    try {
      setWorkSaveMessage("저장 중…");
      await writeWorkSnapshot(snapshot);
      markWorkStarted(snapshot.workId);
      setWorkSaveMessage("자동 저장됨");
    } catch (error) {
      setWorkSaveMessage(error instanceof Error ? "저장 실패 · " + error.message : "저장 실패");
    }
  }

  function resetBulkWorkspace() {
    setData(SAMPLE);
    setMonthlyStats([]);
    setMapDataUrl("");
    setAptPoint(null);
    setStationPoint(null);
    setOutputs(null);
    setSelectedComplexName("");
    setRecommendedAngle("");
    setArticleThemeMode("auto");
    setAutoMapGenerated(false);
    setAutoMapMessage("");
    setNearbyMessage("");
    setFinalBlogText("");
  }

  async function openDailyWork(slot: DailySlot, scroll = true) {
    if (!slot.workId) return;
    if (activeWorkId && activeWorkId !== slot.workId) {
      await persistActiveWork();
    }

    workHydratingRef.current = true;
    setWorkSaveMessage("작업 불러오는 중…");
    try {
      const saved = await readWorkSnapshot(slot.workId);
      setActiveWorkId(slot.workId);
      setActiveWorkType(slot.type);

      if (saved) {
        setWorkTopic(saved.topic || "");
        setWorkMaterials(saved.materials || "");
        setWorkBody(saved.body || "");
        setWorkImageNotes(saved.imageNotes || "");
        setWorkAttachments(Array.isArray(saved.attachments) ? saved.attachments : []);
        setWorkProgress(saved.progress || "preparing");

        if (slot.type === "bulk" && saved.bulk) {
          setData(saved.bulk.data || SAMPLE);
          setMonthlyStats(saved.bulk.monthlyStats || []);
          setMapDataUrl(saved.bulk.mapDataUrl || "");
          setAptPoint(saved.bulk.aptPoint || null);
          setStationPoint(saved.bulk.stationPoint || null);
          setOutputs(saved.bulk.outputs || null);
          setSelectedComplexName(saved.bulk.selectedComplexName || "");
          setRecommendedAngle(saved.bulk.recommendedAngle || "");
          setArticleThemeMode(saved.bulk.articleThemeMode || "auto");
          setAutoMapGenerated(Boolean(saved.bulk.autoMapGenerated));
          setAutoMapMessage(saved.bulk.autoMapMessage || "");
          setNearbyMessage(saved.bulk.nearbyMessage || "");
          setFinalBlogText(saved.body || "");
        } else if (slot.type === "bulk") {
          resetBulkWorkspace();
        }
        markWorkStarted(slot.workId);
        setWorkSaveMessage("저장된 작업 복원됨");
      } else {
        setWorkTopic("");
        setWorkMaterials("");
        setWorkBody("");
        setWorkImageNotes("");
        setWorkAttachments([]);
        setWorkProgress("preparing");
        if (slot.type === "bulk") resetBulkWorkspace();
        markWorkStarted(slot.workId);
        setWorkSaveMessage("새 작업 시작");
      }
    } catch (error) {
      setActiveWorkId(slot.workId);
      setActiveWorkType(slot.type);
      setWorkSaveMessage(error instanceof Error ? "불러오기 실패 · " + error.message : "불러오기 실패");
    } finally {
      window.setTimeout(() => {
        workHydratingRef.current = false;
        if (scroll) document.getElementById("active-work")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

  async function addWorkAttachments(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (!files.length) return;
    const converted = await Promise.all(files.map(async (file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      dataUrl: await fileToDataUrl(file),
    })));
    setWorkAttachments((prev) => [...prev, ...converted].slice(0, 6));
    e.target.value = "";
  }

  function removeWorkAttachment(index: number) {
    setWorkAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function copyThumbnailPrompt() {
    try {
      await navigator.clipboard.writeText(thumbnailPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  }

  function openThumbnailPromptInChatGPT() {
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(thumbnailPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyPriceImagePrompt() {
    try {
      await navigator.clipboard.writeText(priceImagePrompt);
      setPricePromptCopied(true);
      window.setTimeout(() => setPricePromptCopied(false), 1800);
    } catch {
      setPricePromptCopied(false);
    }
  }

  function openPriceImagePromptInChatGPT() {
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(priceImagePrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLocationImagePrompt() {
    try {
      await navigator.clipboard.writeText(locationImagePrompt);
      setLocationPromptCopied(true);
      window.setTimeout(() => setLocationPromptCopied(false), 1800);
    } catch {
      setLocationPromptCopied(false);
    }
  }

  async function copyMapCaptureToClipboard() {
    if (!mapDataUrl) {
      setMapCopyMessage("지도 준비가 먼저 필요합니다.");
      return false;
    }
    try {
      const [header, encoded] = mapDataUrl.split(",", 2);
      const mime = header.match(/^data:([^;]+)/)?.[1] || "image/png";
      if (mime !== "image/png") throw new Error("PNG 지도만 바로 복사할 수 있습니다.");
      const binary = atob(encoded || "");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMapCopyMessage("✅ 지도 캡처가 복사됐습니다. ChatGPT에서 Ctrl+V로 붙여넣으세요.");
      return true;
    } catch (error) {
      setMapCopyMessage(error instanceof Error ? "ℹ️ " + error.message : "ℹ️ 지도 복사에 실패했습니다.");
      return false;
    }
  }

  function openLocationImagePromptInChatGPT() {
    const chatWindow = window.open("about:blank", "_blank");
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(locationImagePrompt);
    void copyMapCaptureToClipboard().finally(() => {
      if (chatWindow) chatWindow.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  async function copyBodyPrompt() {
    try {
      await navigator.clipboard.writeText(bodyPrompt);
      setBodyPromptCopied(true);
      window.setTimeout(() => setBodyPromptCopied(false), 1800);
    } catch {
      setBodyPromptCopied(false);
    }
  }

  function openBodyPromptInChatGPT() {
    const nextHistory = [...recentArticleThemes, selectedArticleTheme.id].slice(-6);
    setRecentArticleThemes(nextHistory);
    try {
      window.localStorage.setItem("apartment-bulk-theme-history-v1", JSON.stringify(nextHistory));
    } catch {
      // localStorage가 막혀 있어도 본문 생성은 계속 진행합니다.
    }
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(bodyPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyNaverRichText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("ChatGPT 완성글을 먼저 붙여넣어 주세요.");
      return;
    }

    const plain = naverPlainText(naverBlocks);
    const html = naverRichHtml(naverBlocks);

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        setNaverCopyMessage("✅ 서식 포함 전체복사 완료 · 네이버에 Ctrl+V 하세요.");
      } else {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("ℹ️ 브라우저 제한으로 한줄띄기 텍스트로 복사했습니다.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("ℹ️ 서식 복사가 제한되어 한줄띄기 텍스트로 복사했습니다.");
      } catch {
        setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
      }
    }
  }

  async function copyNaverSafeText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("ChatGPT 완성글을 먼저 붙여넣어 주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(naverPlainText(naverBlocks));
      setNaverCopyMessage("✅ 한줄띄기 안전복사 완료 · 폰트는 네이버 기본 설정을 사용합니다.");
    } catch {
      setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  async function handleMap(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMapDataUrl(await fileToDataUrl(file));
    setAptPoint(null);
    setStationPoint(null);
    setAutoMapGenerated(false);
    setAutoMapMessage("직접 올린 지도 이미지를 사용합니다.");
    setOutputs(null);
  }

  function markOnMap(e: MouseEvent<HTMLDivElement>) {
    if (!markMode || !mapPreviewRef.current) return;
    const imgRect = mapPreviewRef.current.getBoundingClientRect();
    if (e.clientX < imgRect.left || e.clientX > imgRect.right || e.clientY < imgRect.top || e.clientY > imgRect.bottom) return;
    const point = {
      x: (e.clientX - imgRect.left) / imgRect.width,
      y: (e.clientY - imgRect.top) / imgRect.height,
    };
    if (markMode === "apt") setAptPoint(point);
    else setStationPoint(point);
    setMarkMode(null);
    setOutputs(null);
  }

  async function generate() {
    if (!ready) return;
    setLoading(true);
    try {
      const price = makePriceCard(data, monthlyStats);
      const map = await makeMapCard(data, mapDataUrl, aptPoint, stationPoint);
      setOutputs({ price, map });
      requestAnimationFrame(() => document.getElementById("outputs")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!outputs) return;
    const zip = new JSZip();
    zip.file("01_price.png", dataUrlBase64(outputs.price), { base64: true });
    zip.file("02_location.png", dataUrlBase64(outputs.map), { base64: true });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.name || "apartment").replace(/\s+/g, "_")}_body_images.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <a href="/" className={styles.back}>← 콘텐츠 메이커</a>
        <span className={styles.modeBadge}>아파트 단지 대량발행</span>
      </div>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>집값쓱 APARTMENT BULK MAKER</p>
          <h1>단지 데이터만 고르면<br />이미지·본문 요청서가 한 번에 준비됩니다.</h1>
          <p>썸네일 · 시세 그래프 · 입지 이미지 · 블로그 본문까지 ChatGPT 요청서로 연결합니다.</p>
        </div>
        <a href="/apartment-bulk/discover" className={styles.heroChip}>오늘 쓸 단지 찾기 →</a>
      </section>

      <section className={styles.dailyBoard}>
        <div className={styles.dailyBoardHead}>
          <div>
            <p className={styles.eyebrow}>TODAY · 7 POSTS</p>
            <h2>오늘 집값쓱 발행 <strong>{dailyDoneCount}/7</strong></h2>
            <span>{dailyDateKey || "오늘"} · 7개 완료하면 아파트 블로그 작업 종료</span>
          </div>
          <div className={styles.dailyBoardActions}>
            <div className={styles.dailyProgressText}>{dailyDoneCount === 7 ? "🎉 오늘 할당 완료" : nextDailySlot ? `다음: ${nextDailySlot.id}번 · ${DAILY_TYPE_META[nextDailySlot.type].short}` : "오늘 할당 완료"}</div>
            <button type="button" onClick={resetDailyBoard}>오늘판 초기화</button>
          </div>
        </div>

        <div className={styles.dailyProgressTrack} aria-label={`오늘 발행 진행률 ${dailyDoneCount}/7`}>
          <span style={{ width: `${(dailyDoneCount / 7) * 100}%` }} />
        </div>

        <div className={styles.dailySlots}>
          {dailySlots.map((slot) => (
            <article key={slot.id} className={slot.done ? styles.dailySlotDone : styles.dailySlot}>
              <div className={styles.dailySlotNumber}>{slot.done ? "✓" : slot.id}</div>
              <div className={styles.dailySlotMain}>
                <select
                  aria-label={`${slot.id}번 발행 유형`}
                  value={slot.type}
                  onChange={(e) => updateDailyType(slot.id, e.target.value as DailyContentType)}
                >
                  {(Object.keys(DAILY_TYPE_META) as DailyContentType[]).map((type) => (
                    <option key={type} value={type}>{DAILY_TYPE_META[type].label}</option>
                  ))}
                </select>
                <small>
                  {slot.type === "bulk" ? "단지 데이터 기반 자동 주제" :
                   slot.type === "top3" ? "조회 유입용 지역 TOP3" :
                   slot.type === "tip" ? "검색형 에버그린 정보" :
                   slot.type === "moving" ? "이사 전·후 실용 체크" :
                   slot.type === "compare" ? "지역·단지 차이를 비교" :
                   "시간을 더 쓰는 주력 콘텐츠"}
                </small>
                <code className={styles.dailyWorkId}>{slot.workId || "작업 ID 준비 중"}</code>
              </div>
              <div className={styles.dailySlotActions}>
                <button
                  type="button"
                  className={activeWorkId === slot.workId ? styles.dailyActiveWork : styles.dailyStart}
                  onClick={() => void openDailyWork(slot)}
                >
                  {activeWorkId === slot.workId ? "작업 중" : startedWorkIds.includes(slot.workId) ? "이어하기" : "작업 시작"}
                </button>
                <button
                  type="button"
                  className={slot.done ? styles.dailyUndo : styles.dailyComplete}
                  onClick={() => toggleDailyDone(slot.id)}
                >
                  {slot.done ? "완료 취소" : "완료"}
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className={dailyBulkCount > 4 ? styles.dailyWarning : styles.dailyRule}>
          {dailyBulkCount > 4
            ? `대량발행이 ${dailyBulkCount}개입니다. 4개를 넘으면 꿀팁·비교글·파워글로 바꾸는 걸 권장합니다.`
            : `현재 대량발행 ${dailyBulkCount}개 · 나머지는 TOP3/꿀팁/비교/파워글로 구성합니다.`}
        </div>
      </section>

      {activeWorkId && activeWorkSlot && (
        <section id="active-work" className={styles.activeWorkPanel}>
          <div className={styles.activeWorkHead}>
            <div>
              <p className={styles.eyebrow}>ACTIVE WORK</p>
              <h2>{activeWorkSlot.id}번 · {DAILY_TYPE_META[activeWorkType || activeWorkSlot.type].label}</h2>
              <code>{activeWorkId}</code>
            </div>
            <div className={styles.activeWorkMeta}>
              <select value={workProgress} onChange={(e) => setWorkProgress(e.target.value as WorkProgress)}>
                <option value="not_started">미시작</option>
                <option value="preparing">자료 준비</option>
                <option value="drafting">본문 작성</option>
                <option value="images">이미지 작업</option>
                <option value="review">검수</option>
              </select>
              <button type="button" onClick={() => void persistActiveWork()}>지금 저장</button>
              <span>{workSaveMessage || "변경 내용 자동 저장"}</span>
            </div>
          </div>

          <div className={styles.workPrepGrid}>
            <label className={styles.workField}>
              <span>작업 주제</span>
              <input
                data-testid="work-topic"
                value={workTopic}
                onChange={(e) => setWorkTopic(e.target.value)}
                placeholder={activeWorkType === "bulk" ? "예: 산본 퇴계아파트 · 거래량 변화" : "오늘 만들 구체적인 주제를 적어두세요."}
              />
            </label>
            <label className={styles.workField}>
              <span>자료·근거 메모</span>
              <textarea
                data-testid="work-materials"
                value={workMaterials}
                onChange={(e) => setWorkMaterials(e.target.value)}
                placeholder="확인할 자료, 출처, 수치, 비교 기준 등을 저장합니다."
              />
            </label>
          </div>

          {activeWorkType === "bulk" ? (
            <div className={styles.bulkWorkBridge}>
              <div>
                <b>기존 단지 제작 화면과 연결됨</b>
                <p>아래 단지 데이터·본문·지도·생성 이미지가 이 작업 ID에 독립적으로 자동 저장됩니다.</p>
              </div>
              <div className={styles.bulkSaveState}>
                <span>본문 {finalBlogText.trim() ? "저장됨" : "미작성"}</span>
                <span>지도 {mapDataUrl ? "저장됨" : "없음"}</span>
                <span>본문 이미지 {outputs ? "저장됨" : "없음"}</span>
              </div>
              <label className={styles.workField}>
                <span>이미지·검수 메모</span>
                <textarea value={workImageNotes} onChange={(e) => setWorkImageNotes(e.target.value)} placeholder="외부에서 만든 썸네일이나 수정할 이미지 메모를 적어두세요." />
              </label>
            </div>
          ) : (
            <div className={styles.prepOnlyPanel}>
              <div className={styles.prepOnlyNotice}>
                <b>{DAILY_TYPE_META[activeWorkType || activeWorkSlot.type].label} 준비 화면</b>
                <span>이번 단계에서는 분석·자동 생성 기능을 추가하지 않고, 주제와 자료를 작업별로 저장합니다.</span>
              </div>
              <label className={styles.workField}>
                <span>본문 초안·구성 메모</span>
                <textarea
                  data-testid="work-body"
                  value={workBody}
                  onChange={(e) => setWorkBody(e.target.value)}
                  placeholder="본문 초안, 소제목 구성, ChatGPT 결과 등을 임시 저장할 수 있습니다."
                />
              </label>
              <label className={styles.workField}>
                <span>이미지 메모</span>
                <textarea
                  data-testid="work-image-notes"
                  value={workImageNotes}
                  onChange={(e) => setWorkImageNotes(e.target.value)}
                  placeholder="필요한 이미지 구성이나 제작 메모를 적어두세요."
                />
              </label>
              <div className={styles.workAttachmentBox}>
                <label>
                  참고 이미지 저장
                  <input type="file" accept="image/*" multiple onChange={(e) => void addWorkAttachments(e)} />
                </label>
                <span>작업별로 최대 6장까지 브라우저 저장소에 보관합니다.</span>
              </div>
              {workAttachments.length > 0 && (
                <div className={styles.workAttachmentGrid}>
                  {workAttachments.map((item, index) => (
                    <div key={item.name + index} className={styles.workAttachmentCard}>
                      <img src={item.dataUrl} alt={item.name} />
                      <span>{item.name}</span>
                      <button type="button" onClick={() => removeWorkAttachment(index)}>삭제</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {(!activeWorkId || activeWorkType === "bulk") && (
      <section className={styles.layout}>
        <div className={styles.formCard}>
          <div className={styles.cardHead}>
            <div><b>단지 데이터</b><span>샘플: 산본 퇴계아파트</span></div>
            <button type="button" onClick={() => { setData(SAMPLE); setOutputs(null); }}>샘플값 복원</button>
          </div>

          {selectedComplexLoading && <div className={styles.autoLoad}>후보 단지 데이터를 불러오는 중…</div>}
          {selectedComplexName && !selectedComplexLoading && (
            <div className={styles.autoLoad}><b>{selectedComplexName}</b> 실거래 데이터가 자동으로 입력됐습니다.</div>
          )}

          <div className={styles.grid2}>
            <Field label="단지명" value={data.name} onChange={(v) => update("name", v)} />
            <Field label="지역" value={data.region} onChange={(v) => update("region", v)} />
            <Field label="대표 전용면적" value={data.area} onChange={(v) => update("area", v)} />
            <Field label="최근 실거래가" value={data.recentPrice} onChange={(v) => update("recentPrice", v)} />
            <Field label="이전 실거래가 / 비교값" value={data.previousPrice} onChange={(v) => update("previousPrice", v)} />
            <Field label="세대수" value={data.households} onChange={(v) => update("households", v)} />
            <Field label="입주년도" value={data.moveIn} onChange={(v) => update("moveIn", v)} />
            <Field label="가까운 주요 역" value={data.station} onChange={(v) => update("station", v)} />
          </div>
          <SelectField
            label="본문 주제"
            value={articleThemeMode}
            onChange={setArticleThemeMode}
            options={[
              { value: "auto", label: "자동 다양화 · 데이터 + 최근 주제 중복 회피" },
              { value: "price", label: "가격 변화 · 상승/하락폭 중심" },
              { value: "band", label: "가격대 전환 · 4억대→5억대 같은 장면" },
              { value: "trade", label: "거래량 변화 · 몰린 달/줄어든 달" },
              { value: "mixed", label: "가격·거래 엇갈림" },
              { value: "rebound", label: "저점·고점·반등" },
              { value: "volatility", label: "가격 변동성 · 월별 출렁임" },
              { value: "highlow", label: "6개월 고점·저점 위치" },
              { value: "stable", label: "보합·관망" },
            ]}
          />
          <div className={styles.autoLoad}>
            이번 글 추천 주제: <b>{selectedArticleTheme.label}</b> · {selectedArticleTheme.angle}
          </div>
          <SelectField
            label="썸네일 문구 톤"
            value={data.thumbnailTone}
            onChange={(v) => update("thumbnailTone", v)}
            options={[
              { value: "auto", label: "자동 추천 · 정석/후킹/유머 중 1픽" },
              { value: "standard", label: "정석형 · 깔끔하고 신뢰감 있게" },
              { value: "hook", label: "후킹형 · 놀람/의문/반전" },
              { value: "humor", label: "유머형 · 재치 한 스푼" },
            ]}
          />
          <Field label="썸네일 메인 문구 (비워두면 선택 톤으로 GPT 추천)" value={data.question} onChange={(v) => update("question", v)} />
          <Field label="한 줄 입지 설명" value={data.locationLine} onChange={(v) => update("locationLine", v)} />

          {(nearbyMessage || autoMapMessage) && (
            <div className={styles.statusStack}>
              {nearbyMessage && (
                <div className={styles.statusChip}>
                  {nearbyLoading ? "🚉 검색 중" : nearbyMessage}
                </div>
              )}
              {autoMapMessage && (
                <div className={styles.statusChip}>
                  {autoMapLoading ? "🗺️ 지도 생성 중" : autoMapGenerated ? "✅ 지도 준비 완료" : autoMapMessage}
                </div>
              )}
            </div>
          )}

          <section className={styles.actionPanel}>
            <div className={styles.actionHead}>
              <p className={styles.eyebrow}>PUBLISH ACTIONS</p>
              <h2>이미지 3장과 본문을 ChatGPT에서 만듭니다.</h2>
              <span>입지 이미지는 자동 준비된 네이버 지도 캡처를 클립보드에 복사한 뒤 새 채팅에서 Ctrl+V만 하면 됩니다.</span>
            </div>

            <div className={styles.actionGrid}>
              <button type="button" className={styles.actionButton} onClick={openThumbnailPromptInChatGPT}>
                <span className={styles.actionIcon}>🖼️</span>
                <b>1. 썸네일 만들기</b>
                <small>1254×1254 · ChatGPT 요청서 자동 입력</small>
              </button>

              <button
                type="button"
                className={styles.actionButton}
                disabled={!monthlyStats.length}
                onClick={openPriceImagePromptInChatGPT}
              >
                <span className={styles.actionIcon}>📈</span>
                <b>2. 시세 그래프 만들기</b>
                <small>6개월 월별 가격 + 거래건수 자동 입력</small>
              </button>

              <button
                type="button"
                className={styles.actionButton}
                disabled={!mapDataUrl}
                onClick={openLocationImagePromptInChatGPT}
              >
                <span className={styles.actionIcon}>🗺️</span>
                <b>3. 입지 이미지 만들기</b>
                <small>{mapDataUrl ? "지도 캡처 자동 복사 → 새 채팅에서 Ctrl+V" : "지도 준비 중"}</small>
              </button>

              <button type="button" className={styles.actionButton} onClick={openBodyPromptInChatGPT}>
                <span className={styles.actionIcon}>📝</span>
                <b>4. 본문 작성하기</b>
                <small>최신 웹 확인 + 제목 + 본문 + 태그</small>
              </button>
            </div>

            {mapCopyMessage && <div className={styles.mapCopyNotice}>{mapCopyMessage}</div>}
          </section>

          <section className={styles.naverEditor}>
            <div className={styles.naverEditorHead}>
              <div>
                <p className={styles.eyebrow}>NAVER FINAL COPY</p>
                <h2>5. 네이버 최종 편집 · 전체복사</h2>
                <span>ChatGPT 완성글을 붙여넣으면 제목 20pt · 소제목 18pt · 본문 15pt · 태그 13~14pt와 한 줄 띄기를 자동 적용합니다.</span>
              </div>
            </div>

            <div className={styles.naverEditorGrid}>
              <div className={styles.naverInputPane}>
                <b>① ChatGPT 완성글 붙여넣기</b>
                <textarea
                  className={styles.naverInput}
                  value={finalBlogText}
                  onChange={(e) => {
                    setFinalBlogText(e.target.value);
                    setNaverCopyMessage("");
                  }}
                  placeholder="ChatGPT에서 생성된 제목 + 본문 + 태그 전체를 여기에 붙여넣으세요."
                />
              </div>

              <div className={styles.naverPreviewPane}>
                <div className={styles.naverPreviewHead}>
                  <b>② 네이버 붙여넣기 미리보기</b>
                  <span>{naverBlocks.length ? `${naverBlocks.length}개 블록 자동 인식` : "완성글을 붙여넣으면 미리보기가 나타납니다."}</span>
                </div>
                <div className={styles.naverPreview}>
                  {naverBlocks.length ? naverBlocks.map((block, index) => (
                    <div key={index}>
                      <div
                        className={
                          block.type === "title" ? styles.naverTitle :
                          block.type === "subheading" ? styles.naverSubheading :
                          block.type === "tags" ? styles.naverTags :
                          block.type === "image" ? styles.naverImageLine :
                          styles.naverBody
                        }
                      >
                        {block.text}
                      </div>
                      {index < naverBlocks.length - 1 && <div className={styles.naverSpacer} aria-hidden="true">&nbsp;</div>}
                    </div>
                  )) : (
                    <div className={styles.naverPreviewEmpty}>제목 · 소제목 · 본문 · 태그의 실제 크기와 한 줄 띄기를 여기서 확인할 수 있습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.naverCopyActions}>
              <button type="button" className={styles.naverPrimaryCopy} onClick={() => void copyNaverRichText()}>
                ③ 서식 포함 전체복사
              </button>
              <button type="button" onClick={() => void copyNaverSafeText()}>
                한줄띄기 안전복사
              </button>
              <span>기본은 서식 포함 전체복사 → 네이버 Ctrl+V</span>
            </div>

            {naverCopyMessage && <div className={styles.naverCopyNotice}>{naverCopyMessage}</div>}
          </section>

          <details className={styles.advancedDetails}>
            <summary>이미지 · 본문 요청서 확인 · 복사</summary>
            <div className={styles.advancedBody}>
              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>🖼️ 썸네일 요청서</b>
                    <span>1254×1254 정사각형 썸네일용</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={thumbnailPrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyThumbnailPrompt()}>
                    {promptCopied ? "✓ 복사 완료" : "썸네일 요청서 복사"}
                  </button>
                </div>
              </section>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>📈 시세 그래프 요청서</b>
                    <span>최근 6개월 월별 대표가격과 거래건수가 자동으로 들어갑니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={priceImagePrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyPriceImagePrompt()}>
                    {pricePromptCopied ? "✓ 복사 완료" : "시세 그래프 요청서 복사"}
                  </button>
                </div>
              </section>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>🗺️ 입지 이미지 요청서</b>
                    <span>네이버 지도는 위치 관계 참고용으로만 사용하도록 요청합니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={locationImagePrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyLocationImagePrompt()}>
                    {locationPromptCopied ? "✓ 복사 완료" : "입지 요청서 복사"}
                  </button>
                  <button type="button" disabled={!mapDataUrl} onClick={() => void copyMapCaptureToClipboard()}>
                    지도 캡처 복사
                  </button>
                </div>
              </section>

              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>📝 본문 요청서</b>
                    <span>최종 제목 + 본문(이미지 위치·문단 여백 포함) + 태그 7개만 나오도록 구성합니다.</span>
                  </div>
                </div>
                <textarea className={styles.promptBoxCompact} value={bodyPrompt} readOnly />
                <div className={styles.promptActionsCompact}>
                  <button type="button" onClick={() => void copyBodyPrompt()}>
                    {bodyPromptCopied ? "✓ 복사 완료" : "본문 요청서 복사"}
                  </button>
                </div>
              </section>
            </div>
          </details>

          <details className={styles.advancedDetails}>
            <summary>지도 참고 캡처 · 사진 참고</summary>
            <div className={styles.advancedBody}>
              <section className={styles.photoSection}>
                <div className={styles.photoHead}>
                  <div>
                    <b>검색 사진 참고</b>
                    <span>{photoSearchMessage || "필요할 때만 단지 외관 참고 사진을 검색합니다."}</span>
                  </div>
                  <button
                    type="button"
                    disabled={photoCandidatesLoading || !data.name.trim()}
                    onClick={() => {
                      const nextStart = photoCandidates.length ? (photoSearchStart >= 981 ? 1 : photoSearchStart + 10) : 1;
                      void searchPhotoCandidates(data.name, data.region, nextStart);
                    }}
                  >
                    {photoCandidatesLoading ? "검색 중…" : photoCandidates.length ? "다시 검색" : "참고 사진 찾기"}
                  </button>
                </div>
                {photoCandidates.length > 0 && (
                  <div className={styles.photoGrid}>
                    {photoCandidates.map((candidate, index) => (
                      <div key={candidate.imageUrl + index} className={styles.photoCard}>
                        <img
                          src={candidate.thumbnailUrl}
                          alt={candidate.title || `단지 참고 사진 ${index + 1}`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <span>{`참고 ${index + 1}`}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className={styles.photoNotice}>검색 이미지는 참고용이며 생성 이미지에 직접 복제하지 않습니다.</p>
              </section>

              <div className={styles.uploadGrid}>
                <label className={styles.uploadBox}>
                  <input type="file" accept="image/*" onChange={handleMap} />
                  <span className={styles.uploadIcon}>🗺️</span>
                  <b>{autoMapGenerated ? "네이버 지도 자동 준비 완료" : mapDataUrl ? "지도 이미지 교체" : "지도 이미지 업로드"}</b>
                  <small>{autoMapGenerated ? "입지 이미지 버튼을 누르면 이 지도가 클립보드에 복사됩니다." : "자동 지도가 실패했을 때만 직접 올리면 됩니다."}</small>
                </label>
              </div>

              {mapDataUrl && (
                <div className={styles.mapReferencePanel}>
                  <div className={styles.mapReferenceHead}>
                    <div>
                      <b>입지 참고용 지도</b>
                      <span>ChatGPT에서 그대로 쓰는 게 아니라 위치 관계 참고용으로만 붙여넣습니다.</span>
                    </div>
                    <button type="button" onClick={() => void copyMapCaptureToClipboard()}>지도 캡처 복사</button>
                  </div>
                  <div className={styles.mapPreview}>
                    <img src={mapDataUrl} alt="입지 참고용 네이버 지도" />
                  </div>
                  <p>{mapCopyMessage || "복사 후 ChatGPT 새 채팅에서 Ctrl+V로 붙여넣으면 됩니다."}</p>
                </div>
              )}
            </div>
          </details>

          {!mapDataUrl && <p className={styles.helper}>{autoMapLoading ? "지도 자동 생성 중입니다." : "후보 단지를 선택하면 지도를 자동으로 준비합니다."}</p>}
        </div>

        <aside className={styles.guideCard}>
          <p className={styles.eyebrow}>PUBLISH FLOW</p>
          <h2>이미지 3장 모두 ChatGPT에서 제작.</h2>
          <div className={styles.templateItem}><span>01</span><div><b>썸네일</b><small>1254×1254 요청서 자동 생성</small></div></div>
          <div className={styles.templateItem}><span>02</span><div><b>시세 그래프</b><small>6개월 월별 가격·거래건수 요청서 자동 생성</small></div></div>
          <div className={styles.templateItem}><span>03</span><div><b>입지 이미지</b><small>네이버 지도 자동 복사 → Ctrl+V → 새 인포그래픽 제작</small></div></div>
          <div className={styles.note}><b>최종 흐름</b><p>사이트는 데이터와 지도 참고자료를 준비하고, 실제 이미지는 ChatGPT에서 고품질로 제작합니다.</p></div>
        </aside>
      </section>
      )}

      {(!activeWorkId || activeWorkType === "bulk") && outputs && (
        <section id="outputs" className={styles.outputs}>
          <div className={styles.outputHead}>
            <div><p className={styles.eyebrow}>OUTPUT</p><h2>본문 이미지 2장 완성</h2><span>썸네일은 위 ChatGPT 요청서로 만들고, 아래 2장은 블로그 본문에 사용하세요.</span></div>
            <button onClick={downloadZip}>본문 이미지 2장 ZIP 다운로드</button>
          </div>
          <OutputCard title="01 · 시세 그래프 카드" size="1600×900" src={outputs.price} filename="01_price_graph.png" />
          <OutputCard title="02 · 입지 지도 카드" size="1600×900" src={outputs.map} filename="02_location.png" />
        </section>
      )}
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className={styles.field}><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function OutputCard({ title, size, src, filename }: { title: string; size: string; src: string; filename: string }) {
  return (
    <article className={styles.outputCard}>
      <div className={styles.outputMeta}><div><b>{title}</b><span>{size}</span></div><button onClick={() => downloadDataUrl(src, filename)}>PNG 다운로드</button></div>
      <img src={src} alt={title} />
    </article>
  );
}
