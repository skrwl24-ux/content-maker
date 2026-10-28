"use client";

import { useEffect, useMemo, useState } from "react";
import { buildApartmentV4ArticlePrompt } from "../../lib/apartment-photo-story-v4.mjs";
import styles from "./ApartmentQuickStart.module.css";

type MonthlyRow = { month: string; medianPrice: number | null; tradeCount: number };
type LinkedApartment = { name: string; region: string; area: string; monthly: MonthlyRow[]; matchingPending: boolean };
type DraftSettings = { name: string; region: string; area: string; topic: string; period: string; evidence: string };
const STORAGE_KEY = "content-maker-apartment-quick-v5";
const INITIAL: DraftSettings = { name: "", region: "", area: "전용 84㎡", topic: "실거래가격과 가격 차이", period: "최근 6개월", evidence: "" };

export default function ApartmentQuickStart({ linked, advancedOpen, onToggleAdvanced }: {
  linked: LinkedApartment | null;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
}) {
  const [form, setForm] = useState<DraftSettings>(INITIAL);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<DraftSettings> | null;
      if (saved && typeof saved === "object") {
        setForm({ ...INITIAL, ...Object.fromEntries(Object.entries(saved).filter(([key, value]) => key in INITIAL && typeof value === "string")) });
      }
    } catch { /* A blocked or older local entry must never block writing. */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch { /* browser storage optional */ }
    }
  }, [form, loaded]);
  useEffect(() => {
    if (!linked?.name) return;
    setForm(prev => prev.name === linked.name && prev.region === linked.region && prev.area === linked.area
      ? prev
      : { ...prev, name: linked.name, region: linked.region, area: linked.area || prev.area });
  }, [linked?.name, linked?.region, linked?.area]);

  function change(key: keyof DraftSettings, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setMessage("");
  }

  const matched = Boolean(linked && linked.name.trim() === form.name.trim() && linked.region.trim() === form.region.trim());
  const verified = matched && !linked!.matchingPending && linked!.monthly.some(row => row.medianPrice != null && row.tradeCount > 0);
  const prompt = useMemo(() => {
    const name = form.name.trim(), region = form.region.trim(), area = form.area.trim();
    if (!name) return "";
    const monthly = verified && linked ? linked.monthly : [];
    return [
      "[집값쓱 V5 · 콘텐츠 메이커 간편 글쓰기]",
      "이번 글의 사용자 지정 조건을 아래 고정 마스터보다 우선 적용하되 사실 검증 원칙은 유지할 것.",
      "단지명: " + name,
      "지역: " + (region || "최신 공식 자료로 확인"),
      "주요 면적: " + (area || "자료에서 확인되는 대표 전용면적"),
      "분석 기간: " + form.period + " (고정 템플릿의 6개월 예시는 이 조건으로 해석; 부족한 기간 데이터는 조사하거나 미확인 표시)",
      "글의 핵심 주제: " + form.topic,
      "작성 기준: 실제 조회 가능한 최신 실거래·공식 단지 자료를 조사하고 계약일과 집계 기간을 명시",
      "첨부·추가 자료: " + (form.evidence.trim() || "없음. 없는 거래·지도·사진·인용을 창작하지 말 것"),
      verified ? "사이트가 연결한 월별 가격 집계가 아래 포함됨. 여전히 최신 정정·취소 여부를 공식 원자료와 대조할 것." : "연동 실거래 집계 미확인: 아래의 빈 값·예시를 실거래 사실로 표현하지 말고 공식 자료부터 확인할 것.",
      "",
      buildApartmentV4ArticlePrompt({
        name, region, area,
        recentPrice: "", previousPrice: "", households: "", moveIn: "",
        station: "", locationLine: "", monthly,
        matchingPending: !verified,
      }, 7),
      "",
      "[최종 지시] 완성 원고와 각 이미지 요청서를 순서대로 제시. 대표 썸네일과 본문 모두 1600×900px, 대표는 배경 클로즈업 크롭·문구/숫자는 중앙 안전영역에.",
    ].join("\n");
  }, [form, linked, verified]);

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("V5 최종 요청서를 복사했습니다. ChatGPT에 붙여넣으세요.");
    } catch { setMessage("복사가 차단됐습니다. 아래 요청서 미리보기를 열어 직접 복사하세요."); }
  }

  return <section className={styles.shell} aria-label="집값쓱 간편 글쓰기">
    <div className={styles.heading}>
      <div>
        <small>집값쓱 · 고정 마스터 V5</small>
        <h1>아파트 글쓰기</h1>
        <p>단지명만 입력해도 제목 5개, 뉴스형 원고, 실거래 분석, 생활킥, 이미지 요청서를 한 번에 준비합니다.</p>
      </div>
      <span className={styles.imagePill}>모든 이미지 1600×900 · 썸네일 클로즈업</span>
    </div>
    <div className={styles.fields}>
      <label><span>아파트 이름 <b>*</b></span><input value={form.name} onChange={e=>change("name",e.target.value)} placeholder="예: 화서주공4단지" /></label>
      <label><span>지역</span><input value={form.region} onChange={e=>change("region",e.target.value)} placeholder="예: 수원시 팔달구 화서동" /></label>
      <label><span>주요 면적</span><input value={form.area} onChange={e=>change("area",e.target.value)} placeholder="예: 전용 59.98㎡" /></label>
      <label><span>분석 기간</span><select value={form.period} onChange={e=>change("period",e.target.value)}><option>최근 3개월</option><option>최근 6개월</option><option>최근 12개월</option></select></label>
      <label className={styles.wide}><span>이번 글에서 강조할 내용</span>
        <select value={form.topic} onChange={e=>change("topic",e.target.value)}>
          <option>실거래가격과 가격 차이</option><option>매매 거래량과 인기 평형</option><option>생활환경과 직장 접근성</option><option>단지 종합 분석</option><option>지역 TOP3 비교</option>
        </select>
      </label>
      <label className={styles.wide}><span>추가 실거래·지도·생활정보 (선택)</span><textarea value={form.evidence} onChange={e=>change("evidence",e.target.value)} rows={3} placeholder="확인된 자료가 있으면 붙여넣으세요. 비워 두면 공식 자료 확인을 요청합니다." /></label>
    </div>
    {matched && <p className={styles.dataStatus}>{verified ? "연결된 단지의 월별 실거래 자료를 요청문에 포함합니다. 발행 전 최신 자료 확인이 필요합니다." : "선택된 단지는 있으나 월별 실거래 연결이 확인되지 않았습니다. 확인되지 않은 수치는 자동 입력하지 않습니다."}</p>}
    <div className={styles.actions}>
      <button className={styles.primary} type="button" disabled={!form.name.trim()} onClick={() => void copyPrompt()}>최종 요청서 복사</button>
      <a className={styles.secondary} href={prompt ? "https://chatgpt.com/?q=" + encodeURIComponent(prompt) : undefined}
        aria-disabled={!prompt} onClick={event=>{if(!prompt)event.preventDefault();}} target="_blank" rel="noopener noreferrer">ChatGPT에서 글 작성 ↗</a>
    </div>
    {message && <p role="status" className={styles.notice}>{message}</p>}
    <details className={styles.promptPreview}><summary>생성된 최종 요청서 확인</summary><textarea aria-label="생성된 최종 요청서" readOnly value={prompt} rows={12}/></details>
    <div className={styles.advancedRow}>
      <p>예전 발행 큐·학군·단지 데이터·사진 작업은 보존돼 있습니다. 필요할 때만 열어 사용하세요.</p>
      <button type="button" onClick={onToggleAdvanced} aria-expanded={advancedOpen}>{advancedOpen ? "기존 상세 기능 닫기" : "기존 상세 기능 열기"}</button>
    </div>
  </section>;
}
