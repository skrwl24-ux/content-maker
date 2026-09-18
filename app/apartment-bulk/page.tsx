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
type OutputKey = "price" | "map";
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


function makeThumbnailPrompt(data: ApartmentData) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
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

[메인 문구]
${value(data.question, "요즘 얼마에 거래될까?")}

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
- 메인 질문은 강하게
- 하단에는 대표면적 / 최근 실거래 / 입지 핵심 정도만 작은 보조정보로 표시
- 배경은 특정 검색 사진을 복사하거나 변형하지 말고, 고급 아파트·도시·건축 분위기의 새로운 그래픽 또는 일러스트로 구성
- 실제 단지 배치를 정확히 재현한 것처럼 보이지 않게 할 것
- 로고, 워터마크, 출처 불명의 사진 사용 금지
- 한글 텍스트 오탈자 없이 제작

[권장 구성]
상단 좌측: 집값쓱
상단 우측: ${value(data.region)}
중앙: ${value(data.name)}
메인 카피: ${value(data.question, "요즘 얼마에 거래될까?")}
하단 보조칩: ${value(data.area)} / 최근 실거래 / 입지 핵심

이미지를 바로 생성해줘.`;
}


function makeBodyPrompt(data: ApartmentData, monthlyStats: MonthlyStat[], recommendedAngle: string) {
  const value = (text: string, fallback = "확인 필요") => text.trim() || fallback;
  const monthly = monthlyStats.slice(-6);
  const monthlyLines = monthly.length
    ? monthly.map((item) =>
        `- ${item.month}: 월 대표값 ${item.medianPrice == null ? "거래 없음" : formatWon(item.medianPrice)}, 거래 ${item.tradeCount}건`
      ).join("\n")
    : "- 월별 실거래 데이터 없음";
  const today = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `네이버 블로그용 아파트 분석글을 최종 발행본으로 작성해줘.

[작성 기준일]
${today}

[글의 목적]
검색 유입과 모바일 체류를 함께 노리는 '집값쓱' 아파트 단지 분석글이야.
단순 홍보글이 아니라 실거래 흐름과 최신 확인 정보를 쉽게 설명하는 정보형 글로 써줘.

[단지 기본 정보]
단지명: ${value(data.name)}
지역: ${value(data.region)}
대표 전용면적: ${value(data.area)}
최근 실거래가: ${value(data.recentPrice)}
비교값: ${value(data.previousPrice)}
세대수: ${value(data.households)}
입주년도: ${value(data.moveIn)}
주요 역: ${value(data.station)}
입지 설명: ${value(data.locationLine)}
이번 글의 핵심 관점: ${value(recommendedAngle || data.question, "최근 실거래 흐름")}

[최근 6개월 실거래 데이터]
${monthlyLines}

[최신 정보 웹 확인 — 반드시 먼저]
웹 검색이 가능한 환경이면 본문 작성 전에 최신 정보를 확인해줘.
특히 아래 항목 중 이 단지와 실제로 관련 있는 것만 확인해.
- 교통: 철도·지하철 연장, GTX, 신설역, 도로사업
- 정비사업: 재건축·리모델링·정비구역 진행상태
- 공급: 인근 입주 예정 물량, 대규모 신규 공급
- 생활권: 학교·상권·공원 등 사실 확인이 가능한 요소
- 개발계획: 지자체·국토부·사업시행자 공식 계획

웹 확인 우선순위:
1) 국토교통부·지자체·공공기관·철도/교통 공식자료
2) 사업시행자·공식 보도자료
3) 신뢰할 수 있는 최신 언론 보도

주의:
- '계획', '추진', '착공', '개통 목표', '확정'을 서로 구분할 것
- 공식자료와 기사 내용이 다르면 공식자료를 우선할 것
- 날짜가 오래된 자료를 현재 확정사항처럼 쓰지 말 것
- 확인되지 않은 호재는 빼고, 불확실하면 '확인 필요'라고 표시할 것
- 사이트에서 계산한 역 거리는 직선거리이므로 이를 도보시간으로 임의 환산하지 말 것
- 웹 검색을 실제로 하지 못한 경우 최신 개발·교통 내용을 추정해서 쓰지 말 것

[작성 규칙]
- 먼저 검색형 제목 후보 5개를 제시하고 그중 1개를 최종 제목으로 선택
- 제목에서 답을 전부 말하지 말고 클릭할 이유를 남길 것
- 네이버 모바일에서 읽기 쉽게 한 문단 1~3문장
- 과장, 매수 권유, 투자 확정 표현 금지
- 제공되지 않은 실거래 숫자를 임의로 만들지 말 것
- 실거래 숫자는 위 자료를 우선하고, 최신 외부 정보는 웹 확인 결과와 구분해서 작성
- 전용면적은 '전용 84㎡대' 같은 방식으로 표현하고 공급면적과 혼동하지 말 것
- 이모지는 🏠📊🚉🔎✅📌 정도만 자연스럽게 사용
- SEO 키워드는 단지명, 지역명, '아파트 실거래가', '아파트 시세'를 자연스럽게 포함
- 글 끝에 매수 권유 대신 앞으로 확인할 체크포인트를 넣을 것
- 웹에서 확인한 최신 정보는 본문 문장 안에서 출처 기관 또는 자료 성격이 드러나게 표현할 것
- 본문 끝에는 실제 확인에 사용한 핵심 출처 3~5개를 '확인한 자료'로 짧게 정리할 것

[본문 구조]
① 2~3문장 강한 도입
② 최근 6개월 거래·가격 흐름
③ 단지 기본정보 핵심
④ 최근 실거래에서 눈여겨볼 점
⑤ 입지와 생활권
⑥ 최신 교통·정비·공급 이슈 — 실제 관련 있고 웹에서 확인된 내용만
⑦ 앞으로 체크할 것
⑧ 3줄 요약

[이미지 위치]
본문에 아래 표시를 정확히 넣어줘.
[이미지 1 — ChatGPT에서 만든 썸네일]
[이미지 2 — 최근 6개월 시세 그래프]
[이미지 3 — 입지 지도]

[내부링크]
본문 흐름을 해치지 않는 위치에 내부링크 추천 위치를 2~3개 표시해줘.
실제 URL은 만들지 말고 아래 형식으로 표시해.
[내부링크 추천 — 같은 지역 아파트 비교글 / 추천 앵커문구: ○○○]
[내부링크 추천 — 인근 단지 분석글 / 추천 앵커문구: ○○○]
관련 글이 억지스러우면 개수를 줄여도 돼.

[발행 마무리]
본문 뒤에 아래를 추가해줘.
- 네이버 태그 10~15개
- 검색 노출용 한 줄 요약 1개
- 확인한 최신 자료 3~5개
- 내부링크 추천 위치 2~3개 요약

별도의 작성 설명은 빼고, 제목 후보부터 최종 발행용 본문과 발행 마무리까지 한 번에 완성해줘.`;
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
  const [aptPoint, setAptPoint] = useState<Point>(null);
  const [stationPoint, setStationPoint] = useState<Point>(null);
  const [markMode, setMarkMode] = useState<"apt" | "station" | null>(null);
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [bodyPromptCopied, setBodyPromptCopied] = useState(false);
  const mapPreviewRef = useRef<HTMLImageElement | null>(null);

  const ready = useMemo(() => Boolean(data.name.trim() && data.recentPrice.trim() && mapDataUrl), [data.name, data.recentPrice, mapDataUrl]);
  const thumbnailPrompt = useMemo(() => makeThumbnailPrompt(data), [data]);
  const bodyPrompt = useMemo(() => makeBodyPrompt(data, monthlyStats, recommendedAngle), [data, monthlyStats, recommendedAngle]);

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
          question: detail.snapshot?.recommended_angle || "요즘 얼마에 거래될까?",
        };
        setData(nextData);
        setMonthlyStats(detail.monthly || []);
        setSelectedComplexName(detail.complex.name || "");
        setRecommendedAngle(detail.snapshot?.recommended_angle || "");
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
    const url = "https://chatgpt.com/?q=" + encodeURIComponent(bodyPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
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
          <h1>단지 데이터만 고르면<br />썸네일·본문 요청서와 분석 이미지가 준비됩니다.</h1>
          <p>ChatGPT 썸네일 요청서 · 블로그 본문 요청서 · 시세 그래프 · 입지 지도 2장</p>
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
              <h2>이제 아래 3개만 누르면 됩니다.</h2>
              <span>썸네일과 본문은 ChatGPT에서, 반복 데이터 이미지는 여기서 자동 생성합니다.</span>
            </div>

            <div className={styles.actionGrid}>
              <button type="button" className={styles.actionButton} onClick={openThumbnailPromptInChatGPT}>
                <span className={styles.actionIcon}>🖼️</span>
                <b>1. 썸네일 만들기</b>
                <small>ChatGPT 요청서 자동 입력</small>
              </button>

              <button type="button" className={styles.actionButton} onClick={openBodyPromptInChatGPT}>
                <span className={styles.actionIcon}>📝</span>
                <b>2. 본문 작성하기</b>
                <small>최신 웹 확인 + 태그 + 내부링크</small>
              </button>

              <button
                type="button"
                className={styles.actionButton}
                disabled={!ready || loading}
                onClick={generate}
              >
                <span className={styles.actionIcon}>📊</span>
                <b>{loading ? "본문 이미지 만드는 중…" : "3. 본문 이미지 2장"}</b>
                <small>{mapDataUrl ? "시세 그래프 + 입지 지도" : "지도 준비 후 생성 가능"}</small>
              </button>
            </div>
          </section>

          <details className={styles.advancedDetails}>
            <summary>요청서 확인 · 복사</summary>
            <div className={styles.advancedBody}>
              <section className={styles.promptSection}>
                <div className={styles.promptHead}>
                  <div>
                    <b>🤖 썸네일 요청서</b>
                    <span>단지 데이터가 바뀌면 자동으로 갱신됩니다.</span>
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
                    <b>📝 본문 요청서</b>
                    <span>실거래 + 최신 웹 확인 + 발행 마무리까지 포함합니다.</span>
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
            <summary>참고 사진 · 지도 세부설정</summary>
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
                <p className={styles.photoNotice}>검색 이미지는 참고용이며 썸네일에 직접 적용하지 않습니다.</p>
              </section>

              <div className={styles.uploadGrid}>
                <label className={styles.uploadBox}>
                  <input type="file" accept="image/*" onChange={handleMap} />
                  <span className={styles.uploadIcon}>🗺️</span>
                  <b>{autoMapGenerated ? "네이버 지도 자동 생성 완료" : mapDataUrl ? "지도 이미지 교체" : "지도 이미지 업로드"}</b>
                  <small>{autoMapGenerated ? "자동 생성된 지도를 그대로 써도 됩니다." : "자동 지도가 실패한 경우에만 직접 업로드하세요."}</small>
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
                    <img ref={mapPreviewRef} src={mapDataUrl} alt="지도 미리보기" />
                    {aptPoint && <span className={styles.aptDot} style={{ left: `${aptPoint.x * 100}%`, top: `${aptPoint.y * 100}%` }} />}
                    {stationPoint && <span className={styles.stationDot} style={{ left: `${stationPoint.x * 100}%`, top: `${stationPoint.y * 100}%` }} />}
                  </div>
                  <p>{markMode ? "지도에서 위치를 한 번 클릭하세요." : "표시는 선택사항입니다. 자동 지도 그대로 사용해도 됩니다."}</p>
                </div>
              )}
            </div>
          </details>

          {!mapDataUrl && <p className={styles.helper}>{autoMapLoading ? "지도 자동 생성 중입니다." : "후보 단지를 선택하면 지도를 자동으로 준비합니다."}</p>}
        </div>

        <aside className={styles.guideCard}>
          <p className={styles.eyebrow}>PUBLISH FLOW</p>
          <h2>썸네일은 ChatGPT, 본문 이미지는 자동.</h2>
          <div className={styles.templateItem}><span>01</span><div><b>ChatGPT 썸네일</b><small>요청서 자동 생성 → 새 채팅에서 제작</small></div></div>
          <div className={styles.templateItem}><span>02</span><div><b>시세 그래프</b><small>최근 6개월 월별 중앙값 + 거래건수</small></div></div>
          <div className={styles.templateItem}><span>03</span><div><b>입지 지도</b><small>네이버 지도 자동 생성 + 최소 강조</small></div></div>
          <div className={styles.note}><b>대량발행용 원칙</b><p>썸네일 퀄리티는 ChatGPT에서 확보하고, 반복 데이터 이미지는 사이트에서 자동화합니다.</p></div>
        </aside>
      </section>

      {outputs && (
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

function OutputCard({ title, size, src, filename }: { title: string; size: string; src: string; filename: string }) {
  return (
    <article className={styles.outputCard}>
      <div className={styles.outputMeta}><div><b>{title}</b><span>{size}</span></div><button onClick={() => downloadDataUrl(src, filename)}>PNG 다운로드</button></div>
      <img src={src} alt={title} />
    </article>
  );
}
