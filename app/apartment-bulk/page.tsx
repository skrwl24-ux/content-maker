"use client";

import { ChangeEvent, MouseEvent, useMemo, useRef, useState } from "react";
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

function makeThumbnail(data: ApartmentData) {
  return canvasUrl(1254, 1254, (ctx) => {
    const bg = ctx.createLinearGradient(0, 0, 1254, 1254);
    bg.addColorStop(0, "#0d1b2f");
    bg.addColorStop(0.58, "#162b46");
    bg.addColorStop(1, "#0c5c6f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1254, 1254);

    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#6ee7d8";
    ctx.beginPath();
    ctx.arc(1040, 220, 270, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    drawBrand(ctx, 88, 82);

    roundRect(ctx, 88, 196, 310, 58, 29);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fill();
    ctx.font = `700 25px ${FONT}`;
    ctx.fillStyle = "#a8f3e6";
    ctx.fillText(data.region || "지역", 116, 211);

    ctx.fillStyle = "#ffffff";
    const nameSize = fitText(ctx, data.name || "아파트 단지", 900, 82, 56, 900);
    ctx.font = `900 ${nameSize}px ${FONT}`;
    ctx.fillText(data.name || "아파트 단지", 88, 332);

    ctx.font = `900 74px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    drawWrapped(ctx, data.question || "요즘 얼마에 거래될까?", 88, 455, 780, 96, 2);

    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(88, 702);
    ctx.lineTo(1166, 702);
    ctx.stroke();

    ctx.font = `700 25px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,.60)";
    ctx.fillText("단지별 실거래 · 입지 핵심 정리", 88, 748);

    const bx = 852, by = 770;
    ctx.fillStyle = "rgba(255,255,255,.09)";
    roundRect(ctx, bx, by, 270, 330, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(bx + 46, by - 74, 178, 74);
    ctx.fillStyle = "rgba(168,243,230,.72)";
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        roundRect(ctx, bx + 42 + col * 52, by + 42 + row * 42, 24, 20, 5);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,.86)";
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText("단지 한눈에 보기", 88, 1102);
  });
}

function makePriceCard(data: ApartmentData) {
  return canvasUrl(1600, 900, (ctx) => {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, 0, 1600, 900);

    drawBrand(ctx, 82, 58, true);
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#75839a";
    ctx.textAlign = "right";
    ctx.fillText(data.region || "지역", 1518, 70);
    ctx.textAlign = "left";

    roundRect(ctx, 70, 152, 1460, 650, 34);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e1e8f1";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = "#168c8c";
    ctx.fillText("최근 실거래 핵심", 118, 204);

    const nameSize = fitText(ctx, data.name || "아파트 단지", 870, 54, 38, 900);
    ctx.font = `900 ${nameSize}px ${FONT}`;
    ctx.fillStyle = "#101b2c";
    ctx.fillText(data.name || "아파트 단지", 118, 252);

    roundRect(ctx, 118, 334, 220, 50, 25);
    ctx.fillStyle = "#e7f7f5";
    ctx.fill();
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = "#0f7e7d";
    ctx.fillText(data.area || "대표 전용면적", 148, 347);

    ctx.font = `700 24px ${FONT}`;
    ctx.fillStyle = "#718096";
    ctx.fillText("최근 실거래가", 118, 446);
    const priceSize = fitText(ctx, data.recentPrice || "가격 입력", 810, 82, 54, 900);
    ctx.font = `900 ${priceSize}px ${FONT}`;
    ctx.fillStyle = "#0e1726";
    ctx.fillText(data.recentPrice || "가격 입력", 118, 490);

    roundRect(ctx, 118, 612, 520, 62, 18);
    ctx.fillStyle = "#f0f4f9";
    ctx.fill();
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = "#536278";
    ctx.fillText(data.previousPrice || "비교값 입력", 146, 630);

    ctx.strokeStyle = "#e5ebf3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(972, 224);
    ctx.lineTo(972, 726);
    ctx.stroke();

    const info = [
      ["세대수", data.households || "-"],
      ["입주", data.moveIn || "-"],
      ["가까운 역", data.station || "-"],
    ];
    info.forEach(([label, value], i) => {
      const y = 248 + i * 150;
      ctx.font = `700 22px ${FONT}`;
      ctx.fillStyle = "#8793a5";
      ctx.fillText(label, 1040, y);
      const size = fitText(ctx, value, 390, 40, 28, 900);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.fillStyle = "#162033";
      ctx.fillText(value, 1040, y + 40);
    });

    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = "#9aa5b5";
    ctx.fillText("※ 입력한 데이터 기준 요약 카드", 118, 748);
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
  const [aptPoint, setAptPoint] = useState<Point>(null);
  const [stationPoint, setStationPoint] = useState<Point>(null);
  const [markMode, setMarkMode] = useState<"apt" | "station" | null>(null);
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [loading, setLoading] = useState(false);
  const mapPreviewRef = useRef<HTMLImageElement | null>(null);

  const ready = useMemo(() => Boolean(data.name.trim() && data.recentPrice.trim() && mapDataUrl), [data.name, data.recentPrice, mapDataUrl]);

  function update<K extends keyof ApartmentData>(key: K, value: ApartmentData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setOutputs(null);
  }

  async function handleMap(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMapDataUrl(await fileToDataUrl(file));
    setAptPoint(null);
    setStationPoint(null);
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
      const thumbnail = makeThumbnail(data);
      const price = makePriceCard(data);
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
        <div className={styles.heroChip}>템플릿 3종 고정</div>
      </section>

      <section className={styles.layout}>
        <div className={styles.formCard}>
          <div className={styles.cardHead}>
            <div><b>단지 데이터</b><span>샘플: 산본 퇴계아파트</span></div>
            <button type="button" onClick={() => { setData(SAMPLE); setOutputs(null); }}>샘플값 복원</button>
          </div>

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

          <label className={styles.uploadBox}>
            <input type="file" accept="image/*" onChange={handleMap} />
            <span className={styles.uploadIcon}>🗺️</span>
            <b>{mapDataUrl ? "지도 캡처 교체" : "네이버 지도 캡처 업로드"}</b>
            <small>원본 비율을 유지하고 네이버 로고·출처 영역을 지우지 않습니다.</small>
          </label>

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
          {!mapDataUrl && <p className={styles.helper}>지도 캡처를 올리면 생성 버튼이 활성화됩니다.</p>}
        </div>

        <aside className={styles.guideCard}>
          <p className={styles.eyebrow}>FIXED TEMPLATE</p>
          <h2>매번 디자인하지 않습니다.</h2>
          <div className={styles.templateItem}><span>01</span><div><b>썸네일</b><small>단지명 + 궁금증형 한 줄</small></div></div>
          <div className={styles.templateItem}><span>02</span><div><b>시세 카드</b><small>면적 + 실거래 + 핵심 정보 3개</small></div></div>
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
          <OutputCard title="01 · 시세 요약 카드" size="1600×900" src={outputs.price} filename="01_price.png" />
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
