"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  makePresaleResearchPrompt, makePresaleProjectPrompt, makePresaleReviewPrompt,
  makePresaleImagePlan, makePresaleImagePrompt, auditPresaleArticle, parsePresaleArticle,
} from "../../lib/apartment-presale.mjs";
import type { PresaleArticleBlock } from "../../lib/apartment-presale.mjs";
import { renderPresaleLinks, richArticle, plainPresaleArticle, presaleByteCount, createPresaleCopyParts, PRESALE_COPY_BUDGET } from "../../lib/presale-naver-export.mjs";
import { makePresaleCandidateSeed } from "../../lib/apartment-presale-candidates.mjs";
import styles from "./page.module.css";

type ImageSlot = "00" | "01" | "02";
type SourceStatus = "unchecked" | "published" | "prior";
type PresaleDraft = {
  topic: string;
  dateKey: string;
  sourceStatus: SourceStatus;
  sourceUrl: string;
  sourceDate: string;
  materials: string;
  facts: string;
  kick: string;
  article: string;
  imageNotes: string;
  sitePhoto: string;
  sitePhotoCaption: string;
  sitePhotoRights: boolean;
  images: Partial<Record<ImageSlot, string>>;
};
type StoredDraft = { id: string; draft: PresaleDraft; savedAt: string };

const DB_NAME = "content-maker-presale-v1";
const DB_STORE = "drafts";
const IMAGE_SLOTS: ImageSlot[] = ["00", "01", "02"];
const SLOT_NAMES: Record<ImageSlot, string> = {
  "00": "대표 썸네일",
  "01": "공급물량 핵심 카드",
  "02": "분양조건·킥 카드",
};
const PRESALE_CHECK_NOTICE = "자동검사는 원고 구성만 점검하며 공식 공고의 사실관계를 대신 검증하지 않습니다. 공고 전 자료와 추정치는 최종 원고에서 상태를 구분해 주세요.";

function todayLocal() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function emptyDraft(): PresaleDraft {
  return {
    topic: "", dateKey: "", sourceStatus: "unchecked",
    sourceUrl: "", sourceDate: "", materials: "", facts: "", kick: "",
    article: "", imageNotes: "",
    sitePhoto: "", sitePhotoCaption: "", sitePhotoRights: false, images: {},
  };
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("작업 저장소를 열 수 없습니다."));
  });
}
async function loadDraft(id: string): Promise<PresaleDraft | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredDraft | undefined)?.draft || null);
    request.onerror = () => reject(request.error || new Error("작업을 불러오지 못했습니다."));
    tx.oncomplete = () => db.close();
  });
}
async function storeDraft(item: StoredDraft): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(item);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error || new Error("저장 실패"));
    tx.onabort = () => reject(tx.error || new Error("저장 중단"));
  });
}
async function toImageData(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("PNG·JPG·WebP 사진만 업로드할 수 있습니다.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("이미지 한 장은 10MB 이하로 사용해 주세요.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
function safeBase64(dataUrl: string) {
  const found = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!found) return null;
  return { ext: found[1] === "jpeg" ? "jpg" : found[1], base64: found[2] };
}
function plainArticle(blocks: PresaleArticleBlock[]) {
  return plainPresaleArticle(blocks);
}

export default function PresalePage() {
  const [id, setId] = useState("main");
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<PresaleDraft>(emptyDraft);
  const [saveStatus, setSaveStatus] = useState("작업 불러오는 중…");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const imagePlan = useMemo(() => makePresaleImagePlan(), []);
  const parsed = useMemo(() => parsePresaleArticle(draft.article), [draft.article]);
  const articleAudit = useMemo(() => auditPresaleArticle(draft.article), [draft.article]);
  const copyParts = useMemo(() => createPresaleCopyParts(parsed), [parsed]);
  const completeCopyBytes = useMemo(() =>
    Math.max(presaleByteCount(richArticle(parsed)), presaleByteCount(plainArticle(parsed))), [parsed]);
  const unsafeCopyParts = copyParts.filter((part) => part.oversized);
  const researchPrompt = useMemo(() => makePresaleResearchPrompt({
    topic: draft.topic, dateKey: draft.dateKey, sources: draft.sourceUrl, materials: draft.materials,
  }), [draft.topic, draft.dateKey, draft.sourceUrl, draft.materials]);
  const writingPrompt = useMemo(() => makePresaleProjectPrompt({
    topic: draft.topic, dateKey: draft.dateKey, sources: draft.sourceUrl,
    materials: draft.materials, facts: draft.facts, kick: draft.kick,
  }), [draft.topic, draft.dateKey, draft.sourceUrl, draft.materials, draft.facts, draft.kick]);
  const reviewPrompt = useMemo(() => makePresaleReviewPrompt({
    topic: draft.topic, dateKey: draft.dateKey, sources: draft.sourceUrl,
    facts: draft.facts, article: draft.article,
  }), [draft.topic, draft.dateKey, draft.sourceUrl, draft.facts, draft.article]);
  const imagePrompts = useMemo(() => Object.fromEntries(imagePlan.map((slot) =>
    [slot.slot, makePresaleImagePrompt(slot, draft.topic, draft.article, draft.imageNotes)])) as Record<ImageSlot, string>,
    [imagePlan, draft.topic, draft.article, draft.imageNotes]);
  const imageDone = IMAGE_SLOTS.filter((slot) => Boolean(draft.images[slot])).length;
  const introReady = draft.topic.trim().length > 1;
  const sourceInfoRecorded = Boolean(draft.sourceUrl.trim() || draft.facts.trim());
  const articleReady = draft.article.trim().length >= 300;
  const missing = articleAudit.checks.filter((item) => !item.ok);
  // Export is a user-controlled copy/download, not official publication approval.
  // Never lock a finished article behind redundant hand-checked confirmation flags.
  const readyForFinal = articleAudit.passed;

  useEffect(() => {
    let disposed = false;
    const qs = new URLSearchParams(window.location.search);
    const workId = (qs.get("workId") || "main").slice(0, 100);
    const initialTopic = (qs.get("topic") || "").slice(0, 180);
    const candidateSeed = makePresaleCandidateSeed((qs.get("candidate") || "").slice(0, 100));
    const initialDraft = { ...emptyDraft(), dateKey: todayLocal(), topic: initialTopic, ...(candidateSeed || {}) };
    void loadDraft(workId).then((saved) => {
      if (disposed) return;
      setDraft(saved ? { ...emptyDraft(), ...saved, dateKey: saved.dateKey || todayLocal(), images: saved.images || {} } : initialDraft);
      setId(workId);
      setHydrated(true);
      setSaveStatus(saved ? "저장된 작업 복원됨" : "새 분양 작업 시작");
    }).catch(() => {
      if (disposed) return;
      setDraft(initialDraft);
      setId(workId);
      setHydrated(true);
      setSaveStatus("저장소 접근 불가 · 이 브라우저의 저장 권한을 확인하세요.");
    });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus("저장 대기…");
    const timer = window.setTimeout(() => {
      void storeDraft({ id, draft, savedAt: new Date().toISOString() }).then(() => {
        setSaveStatus("자동 저장됨 · 이 브라우저에 보관");
      }).catch(() => {
        setSaveStatus("자동 저장 실패 · 다시 시도 필요");
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [id, draft, hydrated]);

  function update<K extends keyof PresaleDraft>(field: K, value: PresaleDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }
  async function copyPrompt(value: string, name: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(name + " 복사 완료. ChatGPT 대화창에 붙여넣으세요.");
    } catch {
      setNotice("클립보드 권한이 없어 복사하지 못했습니다. HTTPS 환경 또는 브라우저 권한을 확인하세요.");
    }
  }
  function openPrompt(value: string, name: string) {
    const query = encodeURIComponent(value);
    // Long article prompts exceed reliable URL lengths: open chat and copy the full text.
    if (query.length <= 5000) {
      window.open("https://chatgpt.com/?q=" + query, "_blank", "noopener,noreferrer");
      setNotice(name + " 요청서를 새 ChatGPT 창으로 열었습니다.");
    } else {
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      void copyPrompt(value, name);
    }
  }
  async function uploadImage(event: ChangeEvent<HTMLInputElement>, slot: ImageSlot | "site") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await toImageData(file);
      setDraft((prev) => slot === "site"
        ? { ...prev, sitePhoto: dataUrl, sitePhotoRights: false }
        : { ...prev, images: { ...prev.images, [slot]: dataUrl } });
      setNotice(file.name + " 업로드 완료. 편집 미리보기에 반영됐습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "이미지를 읽지 못했습니다.");
    }
    event.target.value = "";
  }
  async function copyFinal(partIndex = 0) {
    if (!readyForFinal) {
      setNotice("원고 구성 검사에서 누락된 항목을 먼저 수정해 주세요.");
      return;
    }
    const part = copyParts[partIndex];
    if (!part) {
      setNotice("복사할 원고가 없습니다.");
      return;
    }
    const prefix = copyParts.length > 1 ? "(" + (partIndex + 1) + "/" + copyParts.length + ") " : "";
    if (part.oversized && part.textBytes > PRESALE_COPY_BUDGET) {
      setNotice(prefix + "하나의 긴 표·문단이 복붙 권장 크기를 넘었습니다. ZIP의 텍스트 원고를 사용하거나 해당 단락을 분리해 주세요.");
      return;
    }
    try {
      if (!part.oversized && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([part.html], { type: "text/html" }),
          "text/plain": new Blob([part.text], { type: "text/plain" }),
        })]);
        setNotice(prefix + "네이버용 서식 복사 완료. 붙여넣은 뒤 다음 구간을 복사하세요. 링크는 클릭 가능하며 이미지는 별도 삽입합니다.");
      } else {
        await navigator.clipboard.writeText(part.text);
        setNotice(prefix + "경량 텍스트 복사 완료. 해당 구간을 네이버에 붙여넣으세요.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(part.text);
        setNotice(prefix + "서식 복사가 제한돼 해당 구간을 텍스트로 복사했습니다.");
      } catch {
        setNotice("클립보드 복사 실패. 브라우저 권한을 확인해 주세요.");
      }
    }
  }
  async function exportZip() {
    if (!readyForFinal || busy) {
      setNotice("원고 구성 검사에서 누락된 항목을 먼저 수정해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const zip = new JSZip();
      zip.file("final-article.txt", plainArticle(parsed));
      zip.file("final-article.html", richArticle(parsed));
      if (copyParts.length > 1) {
        copyParts.forEach((part, index) => {
          const name = "part-" + String(index + 1).padStart(2, "0");
          zip.file("naver-copy/" + name + ".html", part.html);
          zip.file("naver-copy/" + name + ".txt", part.text);
        });
        zip.file("naver-copy/README.txt", "네이버 편집기에 part-01부터 순서대로 붙여넣으세요. 이미지는 별도로 삽입합니다. 용량은 복붙 전 HTML/UTF-8 계산값이며 네이버 실제 처리 크기와 다를 수 있습니다.");
      }
      zip.file("source-research.txt", draft.facts + "\n\n[공고 상태] " + draft.sourceStatus +
        "\n[공식 URL]\n" + draft.sourceUrl + "\n[자료 기준일] " + draft.sourceDate);
      zip.file("requests/01-research.txt", researchPrompt);
      zip.file("requests/02-article.txt", writingPrompt);
      zip.file("requests/03-independent-review.txt", reviewPrompt);
      imagePlan.forEach((slot) => {
        zip.file("requests/image-" + slot.slot + ".txt", imagePrompts[slot.slot as ImageSlot]);
      });
      IMAGE_SLOTS.forEach((slot) => {
        const image = safeBase64(draft.images[slot] || "");
        if (image) zip.file("images/" + ({ "00": "00-thumbnail", "01": "01-supply", "02": "02-cost-kick" } as Record<ImageSlot, string>)[slot] +
          "." + image.ext, image.base64, { base64: true });
      });
      if (draft.sitePhotoRights) {
        const photo = safeBase64(draft.sitePhoto);
        if (photo) {
          zip.file("images/optional-site-photo." + photo.ext, photo.base64, { base64: true });
          zip.file("images/site-photo-credit.txt", draft.sitePhotoCaption || "출처 표기 필요");
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "apartment-presale-" + draft.dateKey.replace(/-/g, "") + ".zip";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("ZIP 저장 완료. 경량 HTML·텍스트 원고, 분할 복사본(필요 시), 근거·요청서·개별 이미지를 묶었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? "ZIP 제작 오류: " + error.message : "ZIP 제작에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <a href="/" className={styles.brand}>← 콘텐츠메이커</a>
        <nav className={styles.toplinks}>
          <span className={styles.primaryTag}>주력 · 분양정보</span>
          <a href="/apartment-presale/discover">관심 분양 리스트 ↗</a>
          <a href="/apartment-bulk">기존 아파트 분석 ↗</a>
        </nav>
      </div>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PRESALE EDITORIAL STUDIO · 집값쓱</p>
          <h1>분양정보는 정확하게.<br />글은 끝까지 읽고 싶게.</h1>
          <p>공식공고 조사 → 질문형 도입·POINT·목차 → 공급·가격·킥 → 이미지 3장 → 네이버 최종편집</p>
        </div>
        <div className={styles.heroAside}>
          <a href="/apartment-presale/discover" style={{ color: "white", fontWeight: 900, textDecoration: "underline" }}>신규분양 미발행 후보 큐 보기 →</a>
          <b>신규 분양정보 제작실</b>
          <span>작성 기준일 · {draft.dateKey || "불러오는 중"}</span>
          <small>{saveStatus}</small>
        </div>
      </section>
      <nav className={styles.stages} aria-label="분양 제작 순서">
        <a href="#step-source"><b>01</b><span>단지·공식자료</span></a>
        <a href="#step-article"><b>02</b><span>원고·교차검증</span></a>
        <a href="#step-images"><b>03</b><span>이미지·전경</span></a>
        <a href="#step-publish"><b>04</b><span>네이버 발행</span></a>
      </nav>

      {!hydrated ? <div className={styles.panel}>저장된 분양 작업을 불러오는 중입니다…</div> : (
        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            <section id="step-source" className={styles.panel}>
              <header className={styles.sectionHead}>
                <div><small>STEP 01 · 준비</small><h2>단지명만 넣고 공식자료부터 확인</h2>
                  <p>고덕강일3단지처럼 본청약 전인 단지도 시작할 수 있습니다. 확인되지 않은 수치는 비워 둡니다.</p></div>
                <button className={styles.minorButton} type="button" onClick={() => {
                  update("topic", "고덕강일3단지 본청약 예정｜공급물량·분양가·토지임대료 확인");
                }}>고덕강일 예시 입력</button>
              </header>
              <p className={styles.softNotice}>단지명을 직접 찾을 필요 없이 <a href="/apartment-presale/discover" style={{ color: "#127a70", fontWeight: 900 }}>조사된 관심 분양 리스트</a>에서 후보를 선택하면 제목·킥·근거 출발점을 자동으로 채웁니다. 최신 공고는 아래에서 재확인합니다.</p>
              <div className={styles.twoFields}>
                <label className={styles.field}>분양 단지·글 주제 <input value={draft.topic} onChange={(e) => update("topic", e.target.value)}
                  placeholder="예: 고덕강일3단지 본청약 예정" /></label>
                <label className={styles.field}>작성 기준일 <input type="date" value={draft.dateKey} onChange={(e) => update("dateKey", e.target.value)} /></label>
                <label className={styles.field}>공식공고 확인 상태 <select value={draft.sourceStatus} onChange={(e) => update("sourceStatus", e.target.value as SourceStatus)}>
                  <option value="unchecked">아직 확인 전</option><option value="published">최신 공식 모집공고 확인</option>
                  <option value="prior">모집공고 미확인 · 과거 사전자료/발표자료 기준</option></select></label>
                <label className={styles.field}>확인한 공고·자료 날짜 (선택) <input type="date" value={draft.sourceDate} onChange={(e) => update("sourceDate", e.target.value)} /></label>
              </div>
              <label className={styles.field}>공식 출처 URL·공고명 (여러 줄 가능)
                <textarea rows={3} value={draft.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)}
                  placeholder={"SH/LH/청약홈/사업주체 공식 모집공고 URL\n공고가 없으면 확인한 사전예약 자료와 발표일을 기재"} /></label>
              <label className={styles.field}>운영자 메모 (선택)
                <textarea rows={3} value={draft.materials} onChange={(e) => update("materials", e.target.value)}
                  placeholder="관심 포인트, 비교할 조건, 추정으로만 알려진 자료 등을 입력하세요." /></label>
              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} disabled={!introReady}
                  onClick={() => openPrompt(researchPrompt, "공식자료 조사")}>🔎 ChatGPT 공식자료 조사</button>
                <button type="button" className={styles.minorButton} disabled={!introReady}
                  onClick={() => void copyPrompt(researchPrompt, "공식자료 조사 요청서")}>요청서 복사</button>
              </div>
              <div className={styles.subsection}>
                <div className={styles.subHead}><h3>조사 결과 붙여넣기</h3><span>자료 출처와 기준일도 함께 저장</span></div>
                <textarea className={styles.longInput} value={draft.facts} onChange={(e) => update("facts", e.target.value)}
                  placeholder={"GPT 검증 결과 전체를 붙여넣으세요.\n[검증 결과]\n정확한 단지명: ...\n공식 공고 상태 및 공고일: ...\n전체 세대수 / 금회 신규 공급 / 가격상태 ...\n[/검증 결과]"} />
                <label className={styles.field}>이 단지만의 킥 후보 (선택)
                  <input value={draft.kick} onChange={(e) => update("kick", e.target.value)}
                    placeholder="예: 분양가 외에 매월 발생하는 토지임대료" /></label>
                <p className={styles.hint}>조사·검증 결과와 출처를 입력하면 작업에 보관하고 ZIP에도 함께 담습니다. 공고 전이거나 자료 날짜가 비어 있어도 완성 원고 복사·저장을 막지 않습니다.</p>
              </div>
            </section>

            <section id="step-article" className={styles.panel}>
              <header className={styles.sectionHead}><div><small>STEP 02 · 원고</small><h2>벤치마킹형 원고를 제작하고 한 번 더 검증</h2>
                <p>질문형 제목, 실제 정보 중심의 POINT 박스, 목차, 공급·가격, 킥, 입지·청약 체크를 고정합니다.</p></div></header>
              <div className={styles.editorialGuide}>
                <div><b>제목·대표 비주얼</b><span>독자의 질문으로 시작</span></div>
                <div><b>핵심 POINT·목차</b><span>첫 화면에서 핵심 파악</span></div>
                <div><b>공급·가격·입지</b><span>공고 숫자와 상태 구분</span></div>
                <div><b>이 단지만의 킥·FAQ</b><span>검증된 실부담·조건, 정보 박스까지 자동 편집</span></div>
              </div>
              {!draft.facts.trim() && <p className={styles.softNotice}>조사 결과를 생략해도 원고 요청은 가능합니다. 이때 ChatGPT가 공식자료 검색부터 수행하게 하며 완성 후 별도 검증이 필요합니다.</p>}
              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} disabled={!introReady}
                  onClick={() => openPrompt(writingPrompt, "벤치마킹형 원고")}>✍️ ChatGPT 본문 작성</button>
                <button type="button" className={styles.minorButton} disabled={!introReady}
                  onClick={() => void copyPrompt(writingPrompt, "본문 제작 요청서")}>요청서 복사</button>
              </div>
              <label className={styles.field}>ChatGPT 완성 글 붙여넣기 (제목·본문·표·태그 전체)
                <textarea className={styles.articleInput} value={draft.article} onChange={(e) => update("article", e.target.value)}
                  placeholder={"완성 글 전체를 이곳에 한 번만 붙여넣으세요.\nPOINT 일반 제목과 [분양 핵심 POINT] 전용 박스 모두 자동으로 요약 카드로 변환됩니다. [이미지 00/01/02] 위치도 인식합니다."} /></label>
              <div className={styles.auditBox}>
                <div className={styles.subHead}><h3>글 구성 자동검사</h3><span>{articleAudit.checks.length - missing.length}/{articleAudit.checks.length} 항목 확인</span></div>
                <div className={styles.auditGrid}>{articleAudit.checks.map((item) => <span key={item.key}
                  className={item.ok ? styles.auditPass : styles.auditMissing}>{item.ok ? "✓" : "!"} {item.label}</span>)}</div>
                {articleAudit.qualityWarnings.map((warning) => <p className={styles.warning} key={warning}>정보 밀도 점검: {warning}</p>)}
                <p className={styles.hint}>{PRESALE_CHECK_NOTICE}</p>
              </div>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" disabled={!articleReady}
                  onClick={() => openPrompt(reviewPrompt, "독립 교차검증")}>🛡️ ChatGPT 2차 교차검증</button>
                <button className={styles.minorButton} type="button" disabled={!articleReady}
                  onClick={() => void copyPrompt(reviewPrompt, "2차 교차검증 요청서")}>검증 요청서 복사</button>
              </div>
              <p className={styles.hint}>2차 검증에서 수정본이 나오면 원고를 교체하세요. 구성 자동검사 결과는 즉시 갱신되며 별도 수동 확인 체크는 필요하지 않습니다.</p>
            </section>

            <section id="step-images" className={styles.panel}>
              <header className={styles.sectionHead}><div><small>STEP 03 · 이미지</small><h2>ChatGPT 전용 이미지 요청서 3장</h2>
                <p>완성 본문에 있는 숫자만 사용합니다. 표가 여러 개여도 요청서가 무한히 늘어나지 않습니다.</p></div>
                <b className={styles.counter}>{imageDone}/3장 업로드</b></header>
              {!articleReady && <p className={styles.softNotice}>먼저 완성 원고를 300자 이상 붙여넣어야 이미지 제작 버튼이 열립니다.</p>}
              <div className={styles.imageList}>{imagePlan.map((slot) => {
                const code = slot.slot as ImageSlot;
                return <div className={styles.imageCard} key={code}>
                  <div className={styles.imageMeta}><span className={styles.imageNumber}>{slot.slot}</span>
                    <div><b>{slot.label}</b><small>{slot.width}×{slot.height} · {slot.role}</small></div></div>
                  <div className={styles.imageActions}>
                    <button className={styles.secondaryButton} disabled={!articleReady}
                      onClick={() => openPrompt(imagePrompts[code], SLOT_NAMES[code])}>ChatGPT에서 한 장 제작 ↗</button>
                    <button className={styles.minorButton} disabled={!articleReady}
                      onClick={() => void copyPrompt(imagePrompts[code], SLOT_NAMES[code] + " 요청서")}>요청서 복사</button>
                    <label className={styles.uploadButton}>완성 이미지 등록
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImage(e, code)} /></label>
                  </div>
                  {draft.images[code] ? <div className={styles.imagePreview}>
                    {/* Source is restricted to locally uploaded image data. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.images[code]} alt={slot.label + " 업로드 미리보기"} />
                    <button className={styles.textButton} onClick={() => setDraft((prev) => {
                      const next = { ...prev.images }; delete next[code];
                      return { ...prev, images: next };
                    })}>교체 전 이미지 제거</button></div>
                    : <p className={styles.hint}>한 장씩 제작해 업로드하면 아래 최종 미리보기에 즉시 반영됩니다.</p>}
                </div>;
              })}</div>
              <label className={styles.field}>이미지 제작 시 추가 메모
                <textarea rows={2} value={draft.imageNotes} onChange={(e) => update("imageNotes", e.target.value)}
                  placeholder="선호하는 실제 자료나 문구를 메모하세요. 이미지 생성에 사용할 사진은 ChatGPT 대화창에 직접 첨부해야 합니다." /></label>
              <div className={styles.subsection}>
                <div className={styles.subHead}><h3>현장·전경 사진 (선택)</h3><span>벤치마킹한 블로그처럼 큰 현장 사진을 배치할 때만</span></div>
                <p className={styles.hint}>직접 촬영했거나 사용 허락을 받은 실제 사진을 등록합니다. 다른 블로그·영상의 캡처를 무단으로 재가공하지 않습니다. 사진은 AI 요청서 3장과 별도로 취급합니다.</p>
                <label className={styles.uploadButton}>전경 사진 올리기
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImage(e, "site")} /></label>
                {draft.sitePhoto && <div className={styles.sitePhotoPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.sitePhoto} alt="전경 사진 참고 미리보기" />
                  <button className={styles.textButton} onClick={() => setDraft((prev) => ({ ...prev, sitePhoto: "", sitePhotoRights: false }))}>사진 제거</button>
                </div>}
                <label className={styles.field}>사진 출처·촬영자·사용 허락 정보
                  <input value={draft.sitePhotoCaption} onChange={(e) => update("sitePhotoCaption", e.target.value)}
                    placeholder="예: 직접 촬영 / 사업주체 제공, 블로그 사용 허락 확인" /></label>
                <label className={styles.checkLabel}><input type="checkbox" checked={draft.sitePhotoRights}
                  onChange={(e) => update("sitePhotoRights", e.target.checked)} disabled={!draft.sitePhoto || !draft.sitePhotoCaption.trim()} />
                  <span>이 사진을 네이버 블로그에 게시할 권리가 있고 출처 표기 조건을 확인했습니다.</span></label>
              </div>
            </section>

            <section id="step-publish" className={styles.panel}>
              <header className={styles.sectionHead}><div><small>STEP 04 · 발행</small><h2>벤치마킹형 네이버 글 미리보기</h2>
                <p>POINT 카드·소제목·표·이미지 삽입 위치가 모바일에도 읽기 쉽게 표시됩니다.</p></div></header>
              {draft.article.trim() ? <article className={styles.naverPreview}>
                {parsed.map((block, index) => {
                  if (block.type === "title") return <div key={index}>
                    <h2>{block.text}</h2>
                    {draft.sitePhoto && draft.sitePhotoRights && <figure className={styles.featurePhoto}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.sitePhoto} alt="사용 권한 확인된 단지 전경" /><figcaption>{draft.sitePhotoCaption}</figcaption>
                    </figure>}
                  </div>;
                  if (block.type === "heading") return block.level === 3
                    ? <h4 key={index} className={styles.previewSubheading}>{block.text}</h4>
                    : <h3 key={index}>{block.text}</h3>;
                  if (block.type === "divider") return <hr key={index} className={styles.previewDivider} />;
                  if (block.type === "toc") return <div className={styles.previewToc} key={index}>
                    <strong>📋 목차</strong>{block.text.split("\n").map((line, lineIndex) =>
                      <p key={lineIndex}>{line}</p>)}</div>;
                  if (block.type === "info") return <div key={index}
                    className={styles.previewInfo + " " +
                      (block.tone === "warning" ? styles.infoWarning : block.tone === "estimate"
                        ? styles.infoEstimate : block.tone === "check" ? styles.infoCheck : styles.infoNote)}>
                    <strong>{block.title}</strong>{block.text.split("\n").map((line, lineIndex) =>
                      <p key={lineIndex}>{line.replace(/^[-•]\s*/, "• ")}</p>)}</div>;
                  if (block.type === "faqQuestion") return <p key={index} className={styles.previewFaq}>{block.text}</p>;
                  if (block.type === "points") return <div className={styles.previewPoints} key={index}>
                    <strong>📌 이번 분양 핵심 POINT</strong>{block.text.split("\n").map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}</div>;
                  if (block.type === "table") return <div className={styles.tableWrap} key={index}><table><thead><tr>
                    {block.headers.map((head, i) => <th key={i}>{head}</th>)}</tr></thead><tbody>
                    {block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}
                    </tbody></table></div>;
                  if (block.type === "image") {
                    const match = /^\[이미지\s*(00|01|02)(?:\s|·|\])/i.exec(block.text);
                    const slot = match?.[1] as ImageSlot | undefined;
                    return slot && draft.images[slot] ? <figure key={index} className={styles.previewFigure}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.images[slot]} alt={SLOT_NAMES[slot]} /><figcaption>{block.text}</figcaption>
                    </figure> : <div key={index} className={styles.previewPlaceholder}>{block.text} · 업로드 대기</div>;
                  }
                  if (block.type === "tags") return <p key={index} className={styles.previewTags}>{block.text}</p>;
                  return <p key={index} className={styles.previewText} dangerouslySetInnerHTML={{ __html: renderPresaleLinks(block.text) }} />;
                })}
              </article> : <div className={styles.emptyPreview}>완성 원고를 붙여넣으면 이곳에 실제 편집 형태가 나타납니다.</div>}
              {missing.length > 0 && <p className={styles.warning}>원고 구성 {missing.length}건 미인식 · 빨간색으로 표시된 항목을 확인해 주세요. 사실관계 검증 여부와는 별개입니다.</p>}
              <div className={styles.copyMeter} role="status">
                <strong>네이버 복붙 데이터 · {(completeCopyBytes / 1024).toFixed(1)}KB</strong>
                <span>1회 권장 상한 {(PRESALE_COPY_BUDGET / 1024).toFixed(0)}KB · HTML/텍스트 중 큰 크기를 UTF-8로 계산 (네이버 실제 허용량과는 다를 수 있음)</span>
                <span>{copyParts.length > 1
                  ? "긴 원고이므로 " + copyParts.length + "개 구간으로 자동 분리했습니다. 아래 번호대로 복사·붙여넣기 하세요."
                  : "한 번에 복사 가능한 크기입니다."}</span>
                {unsafeCopyParts.length > 0 && <span className={styles.warning}>긴 단일 표·문단 {unsafeCopyParts.length}개는 경량 텍스트 복사로 처리하거나 원고를 분리해야 합니다.</span>}
              </div>
              <p className={styles.hint}>표·핵심 요약·목차·보조 박스·출처 링크는 경량 HTML로 복사합니다. PNG/JPG는 HTML에 넣지 않고 네이버 편집기에서 해당 위치에 별도 삽입하세요.</p>
              <div className={styles.actions}>
                {copyParts.length <= 1
                  ? <button type="button" className={styles.primaryButton} disabled={!readyForFinal}
                      onClick={() => void copyFinal(0)}>📋 네이버 서식 포함 전체복사</button>
                  : copyParts.map((part, index) => <button key={index} type="button"
                      className={styles.primaryButton} disabled={!readyForFinal}
                      onClick={() => void copyFinal(index)}>📋 {index + 1}/{copyParts.length} 구간 복사 ({(Math.max(part.htmlBytes, part.textBytes) / 1024).toFixed(0)}KB)</button>)}
                <button type="button" className={styles.secondaryButton} disabled={!readyForFinal || busy}
                  onClick={() => void exportZip()}>{busy ? "ZIP 제작 중…" : "📦 원고·이미지·근거 ZIP"}</button>
              </div>
              {!readyForFinal && <p className={styles.hint}>원고 구성 자동검사 11개 항목을 충족하면 전체복사와 ZIP 저장이 활성화됩니다. 추가 수동 체크는 필요하지 않습니다.</p>}
            </section>
          </div>
          <aside className={styles.sideColumn}>
            <div className={styles.statusCard}>
              <small>현재 제작 상태</small><h2>분양 원고 체크</h2>
              <div className={styles.statusRow}><span>단지명 입력</span><b>{introReady ? "완료" : "대기"}</b></div>
              <div className={styles.statusRow}><span>출처·조사 메모</span><b>{sourceInfoRecorded ? "기록됨" : "선택"}</b></div>
              <div className={styles.statusRow}><span>본문 형식 검사</span><b>{articleAudit.checks.length - missing.length}/{articleAudit.checks.length}</b></div>
              <div className={styles.statusRow}><span>이미지 등록</span><b>{imageDone}/3</b></div>
              <div className={styles.statusRow}><span>복붙 크기</span><b>{(completeCopyBytes / 1024).toFixed(0)}KB · {copyParts.length || 0}회</b></div>
              <div className={styles.statusRow}><span>전체복사·ZIP</span><b>{readyForFinal ? "준비 완료" : "구성검사 대기"}</b></div>
              <hr />
              <p>공고 미발표 상태에서도 작업할 수 있습니다. 다만 과거 추정치·예정 일정은 절대 확정값으로 표시하지 않습니다.</p>
              {id !== "main" && <code>작업 ID · {id}</code>}
              <small className={styles.saved}>{saveStatus}</small>
            </div>
          </aside>
        </div>
      )}
      {notice && <div className={styles.toast} role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div>}
    </main>
  );
}
