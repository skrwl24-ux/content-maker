// Jibssuk V3: transparent, code-rendered information overlays.
// This module does not render a background image or burn subtitles into PNGs.
export type OverlayScene = {
  order: number;
  narration: string;
  headline: string;
  subtitle: string;
  screenType: string;
  dataRows?: string;
};
export type TimedScene = { scene: OverlayScene; start: number; end: number; duration: number };
export const SCENE_TYPES = [
  "질문 카드", "기준 카드", "거래량 그래프", "가격 비교표",
  "핵심 숫자 카드", "비교 기준 카드", "고정 엔딩"
] as const;
export const SHORTS_LAYOUT = {
  width: 1080, height: 1920, cardBottom: 1350,
  captionTop: 1450, captionBottom: 1660, uiTop: 1720
} as const;

export function sceneKind(scene: OverlayScene): string {
  const kind = scene.screenType || "";
  if (/거래량|막대/.test(kind)) return "bar";
  if (/가격 비교표|가격표/.test(kind)) return "price";
  if (/비교 기준|주의|텍스트 카드/.test(kind)) return "notice";
  if (/기준 카드|조사 기준/.test(kind)) return "criteria";
  if (/핵심 숫자|강조/.test(kind)) return "highlight";
  if (/엔딩/.test(kind)) return "ending";
  if (/질문/.test(kind)) return "cover";
  // Migrate older six/seven-scene plan types without using old AI graphics.
  return ["cover", "criteria", "bar", "price", "highlight", "notice", "ending"][scene.order - 1] || "highlight";
}

export function cleanSceneField(value: string): string {
  return String(value || "")
    .split(/\s+(?=(?:내레이션|큰\s*문구|하단\s*자막|화면\s*방식|데이터행|장면\s*근거|원래\s*화면\s*방식)\s*[:：])/)[0]
    .replace(/^\s*(?:내레이션|큰\s*문구|하단\s*자막|화면\s*방식|데이터행)\s*[:：]\s*/, "")
    .trim();
}

export function parseOverlayRows(raw: string): Array<{ label: string; value: string; numeric: number }> {
  return String(raw || "").split(/[;\n]/).map((part) => {
    const i = part.indexOf("|");
    if (i < 0) return null;
    const label = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    const m = value.match(/^([\d,]+(?:\.\d+)?)/);
    if (!label || !value || !m) return null;
    const numeric = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(numeric) ? { label, value, numeric } : null;
  }).filter((x): x is { label: string; value: string; numeric: number } => x !== null);
}

export function unsupportedRowValues(scene: OverlayScene, source: string): string[] {
  const corpus = source.replace(/,/g, "");
  return parseOverlayRows(scene.dataRows || "").map((r) => r.value).filter((value) => {
    const match = value.replace(/,/g, "").match(/^[\d]+(?:\.\d+)?/);
    if (!match) return true;
    const numeric = match[0];
    return !new RegExp("(^|[^0-9.])" + numeric.replace(".", "\\.") + "(?![0-9.])").test(corpus);
  });
}

export function splitOneLineCaptions(source: string, maxChars = 20): string[] {
  const tokens = String(source || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    if (line && [...line + " " + token].length > maxChars) {
      lines.push(line);
      line = "";
    }
    if ([...token].length > maxChars) {
      if (line) { lines.push(line); line = ""; }
      const chars = [...token];
      while (chars.length > maxChars) lines.push(chars.splice(0, maxChars).join(""));
      line = chars.join("");
    } else {
      line = line ? line + " " + token : token;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatSrtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":") + "," + String(ms % 1000).padStart(3, "0");
}

export function oneLineSrt(timeline: TimedScene[]): string {
  let id = 0;
  const entries: string[] = [];
  for (const item of timeline) {
    const lines = splitOneLineCaptions(item.scene.narration || item.scene.subtitle, 20);
    const weights = lines.map((x) => Math.max(1, [...x.replace(/\s/g, "")].length));
    const total = weights.reduce((sum, x) => sum + x, 0);
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const start = item.start + item.duration * offset / total;
      offset += weights[i];
      const end = i === lines.length - 1 ? item.end : item.start + item.duration * offset / total;
      entries.push(String(++id) + "\n" + formatSrtTime(start) + " --> " + formatSrtTime(end) + "\n" + lines[i]);
    }
  }
  return entries.join("\n\n");
}

const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const NAVY = "#122841";
const BLUE = "#2376E4";
const YELLOW = "#FFD15A";
const WHITE = "#FFFFFF";
const MUTE = "#B9D2ED";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, color: string, align: CanvasTextAlign = "left", minSize = 26) {
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top";
  let fontSize = size;
  do {
    ctx.font = "800 " + fontSize + "px " + FONT;
    if (ctx.measureText(value).width <= width || fontSize <= minSize) break;
    fontSize -= 2;
  } while (fontSize > minSize);
  ctx.fillText(value, x, y, width);
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, source: string, width: number, size: number, maxLines = 3): string[] {
  ctx.save(); ctx.font = "800 " + size + "px " + FONT;
  const pieces = source.replace(/\s*\/\s*/g, "\n").split("\n");
  const lines: string[] = [];
  for (const piece of pieces) {
    let current = "";
    for (const word of piece.split(/\s+/).filter(Boolean)) {
      const next = current ? current + " " + word : word;
      if (current && ctx.measureText(next).width > width) {
        lines.push(current); current = word;
      } else current = next;
    }
    if (current) lines.push(current);
  }
  ctx.restore();
  return lines.slice(0, maxLines);
}

function headline(ctx: CanvasRenderingContext2D, source: string, y: number, size = 66, color = WHITE) {
  const lines = wrapText(ctx, cleanSceneField(source), 800, size, 3);
  lines.forEach((line, i) => text(ctx, line, 540, y + i * (size + 17), 820, size, color, "center", 38));
}

export async function renderShortsOverlay(scene: OverlayScene): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = SHORTS_LAYOUT.width; canvas.height = SHORTS_LAYOUT.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("투명 정보판 캔버스를 만들 수 없습니다.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const kind = sceneKind(scene);
  const rows = parseOverlayRows(scene.dataRows || "");
  const header = cleanSceneField(scene.headline);
  if (kind === "cover") {
    roundRect(ctx, 65, 450, 950, 550, 40, "rgba(11,34,59,.91)");
    text(ctx, "집값쓱 · 부동산 TOP3", 540, 510, 840, 43, MUTE, "center");
    headline(ctx, header, 650, 94, WHITE);
    roundRect(ctx, 170, 1040, 740, 14, 7, YELLOW);
  } else if (kind === "bar") {
    roundRect(ctx, 58, 335, 964, 1000, 44, "rgba(12,35,60,.94)");
    headline(ctx, header, 387, 62, WHITE);
    const max = Math.max(1, ...rows.map((r) => r.numeric));
    const rowH = Math.min(227, 740 / Math.max(rows.length, 1));
    rows.forEach((r, i) => {
      const y = 558 + i * rowH;
      roundRect(ctx, 105, y - 8, 50, 50, 25, i < 2 ? YELLOW : "#D6E2EF");
      text(ctx, String(i + 1), 130, y, 42, 32, NAVY, "center");
      text(ctx, r.label, 180, y, 665, 42, WHITE, "left", 27);
      roundRect(ctx, 180, y + 69, 610, 45, 12, "rgba(255,255,255,.18)");
      roundRect(ctx, 180, y + 69, Math.max(16, 610 * r.numeric / max), 45, 12, i < 2 ? BLUE : "#9DBAD8");
      text(ctx, r.value, 953, y + 64, 150, 47, i < 2 ? YELLOW : WHITE, "right", 32);
    });
  } else if (kind === "price") {
    roundRect(ctx, 58, 320, 964, 1020, 44, "rgba(12,35,60,.94)");
    headline(ctx, header, 372, 61, WHITE);
    const rowH = Math.min(250, 770 / Math.max(rows.length, 1));
    rows.forEach((r, i) => {
      const y = 540 + i * rowH;
      roundRect(ctx, 100, y, 880, Math.min(rowH - 20, 210), 28, "rgba(255,255,255,.97)");
      text(ctx, r.label, 130, y + 38, 490, 40, NAVY, "left", 26);
      text(ctx, r.value, 950, y + 83, 750, 84, BLUE, "right", 44);
    });
  } else if (kind === "notice") {
    roundRect(ctx, 62, 365, 956, 905, 42, "rgba(255,255,255,.97)");
    headline(ctx, header, 435, 65, NAVY);
    if (rows.length) {
      rows.slice(0, 3).forEach((r, i) => {
        const y = 715 + i * 163;
        roundRect(ctx, 112, y, 855, 137, 25, i % 2 ? "#FFE49B" : "#D7E9FF");
        text(ctx, r.label, 145, y + 33, 400, 47, NAVY);
        text(ctx, r.value, 920, y + 32, 430, 51, i % 2 ? "#2C4261" : BLUE, "right", 30);
      });
    } else {
      text(ctx, cleanSceneField(scene.subtitle), 540, 910, 795, 40, NAVY, "center", 28);
    }
  } else if (kind === "ending") {
    roundRect(ctx, 77, 515, 926, 540, 50, "rgba(12,35,60,.88)");
    headline(ctx, header, 595, 74, WHITE);
    text(ctx, "집.값.쓱.", 540, 835, 830, 100, YELLOW, "center", 55);
  } else {
    roundRect(ctx, 75, 420, 930, 755, 45, kind === "criteria" ? "rgba(255,255,255,.94)" : "rgba(12,35,60,.92)");
    headline(ctx, header, 575, kind === "highlight" ? 91 : 78, kind === "criteria" ? NAVY : WHITE);
    if (rows.length) {
      rows.slice(0, 3).forEach((r, i) => {
        const y = 815 + i * 100;
        text(ctx, r.label, 180, y, 520, 43, kind === "criteria" ? NAVY : MUTE);
        text(ctx, r.value, 925, y - 7, 290, 58, kind === "criteria" ? BLUE : YELLOW, "right");
      });
    }
  }
  // The entire region y >= 1350 stays alpha transparent; captions are separate.
  return canvas.toDataURL("image/png");
}
