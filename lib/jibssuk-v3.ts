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
  "썸네일", "대상 소개 카드", "거래량 그래프", "가격 변화 그래프",
  "주목 포인트 카드", "주의사항 카드", "집값쓱 엔딩"
] as const;
export const SHORTS_LAYOUT = {
  width: 1080, height: 1920, cardBottom: 1320,
  captionTop: 1450, captionBottom: 1660, uiTop: 1720
} as const;

export function sceneKind(scene: OverlayScene): string {
  const kind = scene.screenType || "";
  if (/거래량|막대/.test(kind)) return "bar";
  if (/가격 변화|가격 비교표|가격표|라인차트|가격 그래프/.test(kind)) return "price";
  if (/비교 기준|주의|텍스트 카드/.test(kind)) return "notice";
  if (/대상 소개|지역 소개|단지 소개|기준 카드|조사 기준/.test(kind)) return "criteria";
  if (/주목 포인트|핵심 숫자|강조/.test(kind)) return "highlight";
  if (/엔딩/.test(kind)) return "ending";
  if (/썸네일|질문/.test(kind)) return "cover";
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
  if (sceneKind(scene) === "criteria") return []; // 소개 카드의 순위/이름 라벨은 금액 데이터가 아님.
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


// Older saved scene plans may not contain dataRows. Recover only when names AND values
// are explicitly present in the supplied source; otherwise keep validation blocking export.
function extractVolumeRows(source: string): string {
  const text = source.replace(/\s+/g, " ");
  const pair = text.match(/([가-힣A-Za-z0-9]+)(?:과|와)\s+([가-힣A-Za-z0-9]+)(?:가|이)\s*(?:각각[, ]*)?(\d[\d,]*)건(?:씩|으로|[\s,!])/);
  if (pair) {
    const rows = [
      { label: pair[1], value: pair[3] + "건" },
      { label: pair[2], value: pair[3] + "건" }
    ];
    const tail = text.slice((pair.index || 0) + pair[0].length);
    const third = tail.match(/([가-힣A-Za-z0-9]+)(?:은|는|가|이)\s*(\d[\d,]*)건/);
    if (third) rows.push({ label: third[1], value: third[2] + "건" });
    if (rows.length === 3 && new Set(rows.map(r => r.label)).size === 3)
      return rows.map(r => r.label + " | " + r.value).join(" ; ");
  }
  // Explicit individual "complex-name 14건" patterns, no rank or labels invented.
  const found: Array<{label:string;value:string}> = [];
  const re = /([가-힣A-Za-z0-9]{3,})(?:은|는|가|이)?\s+(\d[\d,]*)건/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) && found.length < 3) {
    const label = match[1];
    if (!found.some(item => item.label === label)) found.push({label,value:match[2] + "건"});
  }
  return found.length === 3 ? found.map(r => r.label+" | "+r.value).join(" ; ") : "";
}

export function resolveOverlayScenes<T extends OverlayScene>(scenes: T[], fullSource: string): T[] {
  const barScene = scenes.find(s => sceneKind(s) === "bar");
  let volumeRows = parseOverlayRows(barScene?.dataRows || "");
  if (volumeRows.length < 3 && barScene) {
    const extracted = extractVolumeRows(barScene.narration + " " + fullSource);
    volumeRows = parseOverlayRows(extracted);
  }
  return scenes.map(scene => {
    if (parseOverlayRows(scene.dataRows || "").length >= 2) return scene;
    const kind = sceneKind(scene);
    if (kind === "bar" && volumeRows.length >= 3) {
      return { ...scene, dataRows: volumeRows.slice(0,3).map(r => r.label+" | "+r.value).join(" ; ") };
    }
    if (kind === "price" && volumeRows.length === 3) {
      const specific = scene.narration || scene.subtitle;
      let values = [...specific.matchAll(/(\d+(?:\.\d+)?)\s*억(?!대)/g)].map(m => m[1] + "억");
      if (values.length !== 3) {
        const priceLine = fullSource.match(/(?:84\s*㎡|대표값|가격)[^\n!?]{0,180}/);
        values = priceLine ? [...priceLine[0].matchAll(/(\d+(?:\.\d+)?)\s*억(?!대)/g)].map(m => m[1]+"억") : [];
      }
      if (values.length === 3 && values.every(v => fullSource.includes(v) || specific.includes(v))) {
        return { ...scene, dataRows: volumeRows.map((r, i) => r.label + " | " + values[i]).join(" ; ") };
      }
    }
    return scene;
  });
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
  const source = header + " " + scene.narration;
  const panel = (top: number, height: number, light = false) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 38; ctx.shadowOffsetY = 18;
    roundRect(ctx, 65, top, 950, height, 38, light ? "rgba(250,253,255,.97)" : "rgba(10,34,59,.94)");
    ctx.restore();
    roundRect(ctx, 112, top + 27, 120, 9, 5, light ? BLUE : YELLOW);
  };
  const titleLines = (s: string, y: number, size: number, color: string, max = 3) => {
    const lines = wrapText(ctx, s, 820, size, max);
    lines.forEach((line, i) => text(ctx, line, 540, y + i*(size+12), 835, size, color, "center", 38));
    return lines.length;
  };
  if (kind === "cover") {
    panel(410, 690);
    text(ctx, "집값쓱  |  부동산 정보", 540, 485, 810, 43, MUTE, "center");
    titleLines(header, 610, 93, WHITE);
    roundRect(ctx, 215, 995, 650, 15, 7, YELLOW);
  } else if (kind === "criteria") {
    panel(315, 890, true);
    const items = String(scene.dataRows || "").split(/[;\n]/).map(v => v.split("|")[0].trim()).filter(Boolean).slice(0, 3);
    text(ctx, items.length ? "이번 비교 대상" : "비교 기준", 540, 395, 750, 43, BLUE, "center");
    if (items.length) {
      titleLines(header, 474, 56, NAVY, 2);
      items.forEach((item, i) => {
        const y = 652 + i * 167;
        roundRect(ctx, 115, y, 850, 138, 23, i===0?"#FFF1CB":"#E7EFFA");
        text(ctx, item, 540, y+42, 780, 56, NAVY, "center", 36);
      });
    } else {
    const date = header.match(/\d{4}년\s*\d{1,2}월/);
    if (date) {
      text(ctx, date[0], 540, 570, 810, 105, NAVY, "center", 70);
      const rest = header.replace(date[0], "").replace(/^[,\s/·-]+/, "");
      titleLines(rest || "매매 신고 기준", 765, 69, NAVY);
    } else titleLines(header, 660, 86, NAVY);
    roundRect(ctx, 250, 1000, 580, 13, 7, BLUE);
    }
  } else if (kind === "bar") {
    panel(270, 1025);
    titleLines(header, 336, 60, WHITE, 2);
    roundRect(ctx, 118, 505, 844, 2, 1, "rgba(255,255,255,.25)");
    const max = Math.max(1, ...rows.map(r => r.numeric));
    rows.slice(0,3).forEach((row, i) => {
      const y = 545 + i * 232;
      const rank = 1 + rows.filter(r => r.numeric > row.numeric).length;
      roundRect(ctx, 120, y+7, 62, 62, 31, rank===1 ? YELLOW : "#D9E5F1");
      text(ctx, String(rank), 151, y+15, 55, 42, NAVY, "center", 34);
      text(ctx, row.label, 205, y+8, 730, 46, WHITE, "left", 29);
      roundRect(ctx, 205, y+100, 590, 48, 14, "rgba(255,255,255,.19)");
      roundRect(ctx, 205, y+100, Math.max(18, 590*row.numeric/max), 48, 14, rank===1 ? BLUE : "#9DBADB");
      text(ctx, row.value, 944, y+94, 145, 51, rank===1 ? YELLOW : WHITE, "right", 34);
    });
    if (rows.length < 2) {
      titleLines("거래량 데이터 확인 필요", 790, 65, YELLOW, 2);
      text(ctx, "장면표의 데이터행을 확인하세요", 540, 920, 800, 43, WHITE, "center");
    }
  } else if (kind === "price") {
    panel(260, 1050);
    titleLines(header, 325, 59, WHITE, 2);
    rows.slice(0,3).forEach((row, i) => {
      const y = 525+i*247;
      roundRect(ctx, 115, y, 850, 213, 28, "rgba(255,255,255,.98)");
      roundRect(ctx, 115, y, 14, 213, 6, i===1 ? YELLOW : BLUE);
      text(ctx, row.label, 165, y+29, 745, 43, NAVY, "left", 29);
      text(ctx, row.value, 930, y+103, 720, 85, BLUE, "right", 62);
    });
    if (rows.length < 2) {
      titleLines("가격 비교 데이터 확인 필요", 790, 62, YELLOW, 2);
      text(ctx, "장면표의 데이터행을 확인하세요", 540, 922, 800, 40, WHITE, "center");
    }
  } else if (kind === "highlight") {
    panel(405, 770);
    const prices = [...header.matchAll(/\d+(?:\.\d+)?억대/g)].map(m => m[0]);
    if (prices.length>=2) {
      text(ctx, header.split(prices[0])[0].replace(/[/,]/g," ").trim() || "가격 차이", 540, 475, 810, 71, WHITE, "center", 50);
      roundRect(ctx, 125, 635, 830, 191, 26, "rgba(255,255,255,.98)");
      text(ctx, prices[0]+"부터", 540, 674, 780, 96, BLUE, "center", 65);
      roundRect(ctx, 125, 855, 830, 191, 26, "rgba(255,209,90,.99)");
      text(ctx, prices[1]+"까지", 540, 895, 780, 94, NAVY, "center", 65);
    } else titleLines(header, 625, 85, WHITE);
  } else if (kind === "notice") {
    panel(350, 870, true);
    titleLines(header.split("/")[0], 425, 61, NAVY, 2);
    if (/전체\s*평형/.test(source) && /84\s*㎡/.test(source)) {
      roundRect(ctx, 115, 685, 402, 365, 29, BLUE);
      roundRect(ctx, 563, 685, 402, 365, 29, YELLOW);
      text(ctx, "거래량", 316, 733, 360, 57, WHITE, "center");
      text(ctx, "전체 평형", 316, 855, 365, 68, WHITE, "center", 46);
      text(ctx, "가격", 764, 733, 360, 57, NAVY, "center");
      text(ctx, "84㎡대", 764, 855, 365, 77, NAVY, "center", 50);
      text(ctx, "≠", 540, 813, 110, 75, NAVY, "center", 52);
    } else if (rows.length>=2) {
      rows.slice(0,2).forEach((row,i)=>{
        const y=680+i*183;
        roundRect(ctx, 125, y, 825, 145, 24, i===0?"#DCEBFF":"#FFE49B");
        text(ctx,row.label,160,y+44,430,50,NAVY);
        text(ctx,row.value,912,y+38,385,58,i===0?BLUE:NAVY,"right");
      });
    } else {
      titleLines(header.split("/").slice(1).join(" / ") || cleanSceneField(scene.subtitle), 730, 56, NAVY, 3);
    }
    roundRect(ctx, 200, 1114, 680, 10, 5, BLUE);
  } else if (kind === "ending") {
    panel(480, 665);
    const withoutBrand = header.replace(/집\s*\.?\s*값\s*\.?\s*쓱\.?/g,"").replace(/[/\s]+$/g,"").trim();
    titleLines(withoutBrand || "오늘도", 610, 69, WHITE);
    text(ctx, "집.값.쓱.", 540, 830, 835, 106, YELLOW, "center", 76);
  } else {
    panel(410, 695);
    titleLines(header, 650, 79, WHITE);
  }
  // Hard-cut all visual pixels from Y 1320 down: captions and Shorts UI are separate layers.
  ctx.clearRect(0, SHORTS_LAYOUT.cardBottom, SHORTS_LAYOUT.width, SHORTS_LAYOUT.height - SHORTS_LAYOUT.cardBottom);
  return canvas.toDataURL("image/png");
}
