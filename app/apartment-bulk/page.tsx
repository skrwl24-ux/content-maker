"use client";

import { ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";

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
};

type Point = { x: number; y: number } | null;
type OutputKey = "thumbnail" | "price" | "map";
type Outputs = Record<OutputKey, string>;
type MonthlyStat = { month: string; medianPrice: number | null; tradeCount: number };
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
  question: "요즘 얼마에 거래될까?",
};

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

    points.forEach((p, index) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, index === points.length - 1 ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = index === points.length - 1 ? "#ef746e" : "#0f8b86";
      ctx.fill();
      if (index === points.length - 1) {
        ctx.font = `900 21px ${FONT}`;
        ctx.fillStyle = "#132033";
        ctx.textAlign = "center";
        ctx.fillText(formatWon(p.item.medianPrice), p.x, p.y - 44);
      }
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
    ctx.fillText("월별 중앙값 기준", 1236, 724);
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
  const [complexPhotoDataUrl, setComplexPhotoDataUrl] = useState("");
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [selectedComplexLoading, setSelectedComplexLoading] = useState(false);
  const [selectedComplexName, setSelectedComplexName] = useState("");
  const [autoMapLoading, setAutoMapLoading] = useState(false);
  const [autoMapMessage, setAutoMapMessage] = useState("");
  const [autoMapGenerated, setAutoMapGenerated] = useState(false);
  const [photoCandidates, setPhotoCandidates] = useState<PhotoCandidate[]>([]);
  const [photoCandidatesLoading, setPhotoCandidatesLoading] = useState(false);
  const [photoSearchMessage, setPhotoSearchMessage] = useState("");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState("");
  const [photoSearchStart, setPhotoSearchStart] = useState(1);
  const [aiIllustrationLoading, setAiIllustrationLoading] = useState(false);
  const [aiIllustrationMessage, setAiIllustrationMessage] = useState("");
  const [photoSource, setPhotoSource] = useState<"ai" | "upload" | null>(null);
  const [aptPoint, setAptPoint] = useState<Point>(null);
  const [stationPoint, setStationPoint] = useState<Point>(null);
  const [markMode, setMarkMode] = useState<"apt" | "station" | null>(null);
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [loading, setLoading] = useState(false);
  const mapPreviewRef = useRef<HTMLImageElement | null>(null);

  const ready = useMemo(() => Boolean(data.name.trim() && data.recentPrice.trim() && mapDataUrl), [data.name, data.recentPrice, mapDataUrl]);

  async function searchPhotoCandidates(name: string, region: string, start = 1) {
    if (!name.trim()) return;
    setPhotoCandidatesLoading(true);
    setPhotoSearchMessage("단지 사진 후보를 찾는 중…");
    setSelectedPhotoUrl("");
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
      setPhotoSearchMessage(items.length ? "사진 3장 중 사용할 사진을 하나 선택하세요." : "사진 후보를 찾지 못했습니다. 직접 업로드해 주세요.");
    } catch (e) {
      setPhotoCandidates([]);
      setPhotoSearchMessage(e instanceof Error ? e.message : "사진 자동 검색에 실패했습니다. 직접 업로드할 수 있습니다.");
    } finally {
      setPhotoCandidatesLoading(false);
    }
  }

  async function generateAiIllustration() {
    if (!data.name.trim() || aiIllustrationLoading) return;
    setAiIllustrationLoading(true);
    setAiIllustrationMessage("실제 사진을 복제하지 않는 새 조감도풍 일러스트를 만드는 중…");
    try {
      const res = await fetch("/api/apartment/illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          region: data.region,
          households: data.households,
          moveIn: data.moveIn,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI 조감도풍 생성 실패");
      setComplexPhotoDataUrl(json.imageDataUrl || "");
      setSelectedPhotoUrl("");
      setPhotoSource("ai");
      setAiIllustrationMessage(json.note || "AI 조감도풍 일러스트가 썸네일 배경에 적용됐습니다.");
      setOutputs(null);
    } catch (e) {
      setAiIllustrationMessage(e instanceof Error ? e.message : "AI 조감도풍 이미지 생성에 실패했습니다.");
    } finally {
      setAiIllustrationLoading(false);
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
        setData((prev) => ({
          ...prev,
          name: detail.complex.name || prev.name,
          region: region || prev.region,
          area: detail.representativeArea ? "전용 " + detail.representativeArea : prev.area,
          recentPrice: recent ? formatWon(recent) : prev.recentPrice,
          previousPrice: firstMedian ? "6개월 전 대표값 " + formatWon(firstMedian) : prev.previousPrice,
          households: detail.complex.households ? detail.complex.households.toLocaleString("ko-KR") + "세대" : prev.households,
          moveIn: detail.complex.use_date ? detail.complex.use_date.slice(0, 7).replace("-", "년 ") + "월" : prev.moveIn,
          station: "",
          locationLine: "",
          question: detail.snapshot?.recommended_angle || "요즘 얼마에 거래될까?",
        }));
        setMonthlyStats(detail.monthly || []);
        setSelectedComplexName(detail.complex.name || "");
        setOutputs(null);

        void searchPhotoCandidates(detail.complex.name || "", region, 1);

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

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setComplexPhotoDataUrl(await fileToDataUrl(file));
    setSelectedPhotoUrl("");
    setPhotoSource("upload");
    setAiIllustrationMessage("");
    setPhotoSearchMessage("직접 올린 사진을 썸네일 배경으로 사용합니다.");
    setOutputs(null);
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
      const thumbnail = await makeThumbnail(data, complexPhotoDataUrl);
      const price = makePriceCard(data, monthlyStats);
      const map = await makeMapCard(data, mapDataUrl, aptPoint, stationPoint);
      setOutputs({ thumbnail, price, map });
      requestAnimationFrame(() => document.getElementById("outputs")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!outputs) return;
    const zip = new JSZip();
    zip.file("00_thumbnail.png", dataUrlBase64(outputs.thumbnail), { base64: true });
    zip.file("01_price.png", dataUrlBase64(outputs.price), { base64: true });
    zip.file("02_location.png", dataUrlBase64(outputs.map), { base64: true });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.name || "apartment").replace(/\s+/g, "_")}_3images.zip`;
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
          <h1>데이터와 지도만 바꾸면<br />고정 퀄리티 3장이 바로 완성됩니다.</h1>
          <p>썸네일 1254×1254 · 시세 요약 1600×900 · 입지 지도 1600×900</p>
        </div>
        <a href="/apartment-bulk/discover" className={styles.heroChip}>오늘 쓸 단지 찾기 →</a>
      </section>

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
          <Field label="썸네일 질문" value={data.question} onChange={(v) => update("question", v)} />
          <Field label="한 줄 입지 설명" value={data.locationLine} onChange={(v) => update("locationLine", v)} />

          {autoMapMessage && (
            <div className={styles.autoLoad}>
              {autoMapLoading ? "🗺️ " : autoMapGenerated ? "✅ " : "ℹ️ "}{autoMapMessage}
            </div>
          )}

          {selectedComplexName && (
            <section className={styles.photoSection}>
              <div className={styles.photoHead}>
                <div>
                  <b>AI 조감도풍 썸네일 배경</b>
                  <span>검색 사진을 변환하지 않고 단지명·지역 정보만으로 새 일러스트를 생성합니다.</span>
                </div>
                <button
                  type="button"
                  disabled={aiIllustrationLoading || !data.name.trim()}
                  onClick={() => void generateAiIllustration()}
                >
                  {aiIllustrationLoading ? "생성 중…" : photoSource === "ai" ? "다시 만들기" : "조감도풍 만들기"}
                </button>
              </div>
              {aiIllustrationMessage && <div className={styles.aiMessage}>{aiIllustrationMessage}</div>}
              {photoSource === "ai" && complexPhotoDataUrl && (
                <div className={styles.aiPreview}>
                  <img src={complexPhotoDataUrl} alt="AI 조감도풍 일러스트" />
                  <span>AI 생성 삽화 · 실제 단지 배치와 다를 수 있음</span>
                </div>
              )}
              <p className={styles.photoNotice}>이 이미지는 실제 단지 사진이나 정확한 배치도가 아니라 블로그 썸네일용 창작 일러스트입니다.</p>
            </section>
          )}

          {(selectedComplexName || photoCandidatesLoading || photoCandidates.length > 0) && (
            <section className={styles.photoSection}>
              <div className={styles.photoHead}>
                <div>
                  <b>검색 사진 참고</b>
                  <span>{photoSearchMessage || "자동 검색한 사진 3장은 외관 확인 참고용으로만 보여줍니다."}</span>
                </div>
                <button
                  type="button"
                  disabled={photoCandidatesLoading || !data.name.trim()}
                  onClick={() => {
                    const nextStart = photoSearchStart >= 981 ? 1 : photoSearchStart + 10;
                    void searchPhotoCandidates(data.name, data.region, nextStart);
                  }}
                >
                  {photoCandidatesLoading ? "검색 중…" : "다시 검색"}
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
              <p className={styles.photoNotice}>검색 이미지는 썸네일에 직접 적용하지 않습니다. 사용 권리가 있는 사진은 아래 직접 업로드 기능을 이용하세요.</p>
            </section>
          )}

          <div className={styles.uploadGrid}>
            <label className={styles.uploadBox}>
              <input type="file" accept="image/*" onChange={handlePhoto} />
              <span className={styles.uploadIcon}>🏙️</span>
              <b>{complexPhotoDataUrl ? "단지 사진 직접 교체" : "단지 사진 직접 업로드 · 선택"}</b>
              <small>자동 후보가 마음에 들지 않을 때 직접 올리세요. 마지막으로 선택한 사진이 썸네일 배경에 사용됩니다.</small>
            </label>

            <label className={styles.uploadBox}>
              <input type="file" accept="image/*" onChange={handleMap} />
              <span className={styles.uploadIcon}>🗺️</span>
              <b>{autoMapGenerated ? "네이버 지도 자동 생성 완료" : mapDataUrl ? "지도 이미지 교체" : "지도 이미지 업로드"}</b>
              <small>{autoMapGenerated ? "단지 선택 시 주소를 좌표로 바꿔 위치 마커가 있는 지도를 자동 생성합니다." : "자동 생성이 안 되는 단지는 지도 이미지를 직접 올릴 수 있습니다."}</small>
            </label>
          </div>

          {mapDataUrl && (
            <div className={styles.markPanel}>
              <div className={styles.markActions}>
                <button className={markMode === "apt" ? styles.activeMark : ""} onClick={() => setMarkMode(markMode === "apt" ? null : "apt")}>● 단지 위치 찍기</button>
                <button className={markMode === "station" ? styles.activeMark : ""} onClick={() => setMarkMode(markMode === "station" ? null : "station")}>● 역 위치 찍기</button>
                <button onClick={() => { setAptPoint(null); setStationPoint(null); setOutputs(null); }}>표시 지우기</button>
              </div>
              <div className={`${styles.mapPreview} ${markMode ? styles.marking : ""}`} onClick={markOnMap}>
                <img ref={mapPreviewRef} src={mapDataUrl} alt="업로드한 지도" />
                {aptPoint && <span className={styles.aptDot} style={{ left: `${aptPoint.x * 100}%`, top: `${aptPoint.y * 100}%` }} />}
                {stationPoint && <span className={styles.stationDot} style={{ left: `${stationPoint.x * 100}%`, top: `${stationPoint.y * 100}%` }} />}
              </div>
              <p>{markMode ? "지도에서 위치를 한 번 클릭하세요." : "표시는 선택사항입니다. 원본 지도만으로도 카드 생성이 가능합니다."}</p>
            </div>
          )}

          <button className={styles.generate} disabled={!ready || loading} onClick={generate}>
            {loading ? "3장 만드는 중…" : "이미지 3장 만들기"}
          </button>
          {!mapDataUrl && <p className={styles.helper}>{autoMapLoading ? "지도 자동 생성 중입니다." : "후보 단지를 선택하면 지도를 자동으로 만들고, 실패한 경우에만 직접 업로드하면 됩니다."}</p>}
        </div>

        <aside className={styles.guideCard}>
          <p className={styles.eyebrow}>FIXED TEMPLATE</p>
          <h2>매번 디자인하지 않습니다.</h2>
          <div className={styles.templateItem}><span>01</span><div><b>썸네일</b><small>단지명 + 궁금증형 한 줄</small></div></div>
          <div className={styles.templateItem}><span>02</span><div><b>시세 그래프</b><small>최근 6개월 월별 중앙값 + 거래건수</small></div></div>
          <div className={styles.templateItem}><span>03</span><div><b>지도 카드</b><small>원본 지도 + 최소 강조 + 입지 한 줄</small></div></div>
          <div className={styles.note}><b>대량발행용 원칙</b><p>폰트·색상·여백·정렬은 고정하고, 데이터와 지도만 교체합니다.</p></div>
        </aside>
      </section>

      {outputs && (
        <section id="outputs" className={styles.outputs}>
          <div className={styles.outputHead}>
            <div><p className={styles.eyebrow}>OUTPUT</p><h2>3장 완성</h2><span>아래 이미지를 확인한 뒤 개별 PNG 또는 ZIP으로 저장하세요.</span></div>
            <button onClick={downloadZip}>3장 전체 ZIP 다운로드</button>
          </div>
          <OutputCard title="00 · 썸네일" size="1254×1254" src={outputs.thumbnail} filename="00_thumbnail.png" />
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

function OutputCard({ title, size, src, filename }: { title: string; size: string; src: string; filename: string }) {
  return (
    <article className={styles.outputCard}>
      <div className={styles.outputMeta}><div><b>{title}</b><span>{size}</span></div><button onClick={() => downloadDataUrl(src, filename)}>PNG 다운로드</button></div>
      <img src={src} alt={title} />
    </article>
  );
}
