"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WORKPLACE_TOP10_PRESETS, WORKPLACE_TOP10_SLOTS,
  buildTop10ArticlePrompt, buildTop10ImagePrompt, buildTop10ResearchPrompt,
  type WorkplaceTop10Input
} from "../../lib/workplace-top10.mjs";
import styles from "./top10.module.css";

const KEY = "jibssuk-workplace-top10-v1";
const DEFAULTS: WorkplaceTop10Input = {
  place:"", region:"", neighborhoods:"", period:"최근 12개월", area:"전용 59㎡대와 84㎡대",
  researchNotes:"", articleText:""
};

export default function WorkplaceTop10Studio() {
  const [draft,setDraft] = useState<WorkplaceTop10Input>(DEFAULTS);
  const [hydrated,setHydrated] = useState(false);
  const [notice,setNotice] = useState("");
  const [showAdvanced,setShowAdvanced] = useState(false);

  useEffect(()=>{
    try {
      const old = JSON.parse(localStorage.getItem(KEY)||"null") as Partial<WorkplaceTop10Input> | null;
      if (old && typeof old==="object") {
        const updated = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as Array<keyof WorkplaceTop10Input>) {
          if (typeof old[key] === "string") updated[key] = old[key];
        }
        setDraft(updated);
      }
    } catch {setNotice("이전에 저장한 내용을 읽지 못했습니다. 기존 자료는 삭제하지 않았습니다.");}
    setHydrated(true);
  },[]);
  useEffect(()=>{
    if (!hydrated) return;
    try {localStorage.setItem(KEY,JSON.stringify(draft));}
    catch {setNotice("이 브라우저에서는 자동 저장이 제한됩니다. 작성한 결과를 별도로 복사해 두세요.");}
  },[draft,hydrated]);

  function update(key:keyof WorkplaceTop10Input,value:string) {
    setDraft(prev=>({...prev,[key]:value}));
  }
  const hasPlace = Boolean(draft.place.trim());
  const research = useMemo(()=>buildTop10ResearchPrompt(draft),[draft]);
  const article = useMemo(()=>buildTop10ArticlePrompt(draft),[draft]);

  async function copy(value:string,message:string) {
    try {await navigator.clipboard.writeText(value);setNotice(message);}
    catch {setNotice("클립보드 복사가 차단됐습니다. 해당 요청서 펼치기에서 직접 복사해 주세요.");}
  }
  function applyPreset(preset:typeof WORKPLACE_TOP10_PRESETS[number]){
    setDraft(prev=>({...prev,...preset}));
    setNotice(preset.place+" 기준으로 입력했습니다. 생활권은 실제 자료 확인 후 조정하세요.");
  }

  return <main className={styles.page}>
    <div className={styles.top}>
      <a href="/" className={styles.back}>← 콘텐츠 메이커</a>
      <a href="/apartment-bulk" className={styles.back}>일반 아파트 글쓰기</a>
    </div>
    <header className={styles.hero}>
      <span className={styles.kicker}>집값쓱 · 직장인 아파트 시리즈</span>
      <h1>직장 이름 하나로<br/>주변 아파트 TOP 10 글쓰기</h1>
      <p>판교테크노밸리처럼 회사·업무지구를 먼저 고르고, 주변 아파트의 거래량과 실제 계약가격을 비교합니다.</p>
      <div className={styles.rules}><span>최근 12개월 매매 거래량</span><span>실거래가격 비교</span><span>이미지 1600×900</span></div>
    </header>

    <section className={styles.card} aria-labelledby="step1">
      <div className={styles.heading}><span className={styles.number}>01</span><div><h2 id="step1">어느 직장 주변을 볼까요?</h2><p>아래 예시를 눌러 바로 시작하거나 직접 입력하세요.</p></div></div>
      <div className={styles.presets}>
        {WORKPLACE_TOP10_PRESETS.map(p=><button type="button" key={p.place} onClick={()=>applyPreset(p)} className={draft.place===p.place?styles.presetSelected:styles.preset}>{p.place}</button>)}
      </div>
      <div className={styles.formGrid}>
        <label><span>업무지구·회사 이름 <strong>*</strong></span><input value={draft.place} onChange={e=>update("place",e.target.value)} placeholder="예: LG사이언스파크" /></label>
        <label><span>위치</span><input value={draft.region} onChange={e=>update("region",e.target.value)} placeholder="예: 서울 강서구 마곡동" /></label>
        <label className={styles.wide}><span>비교할 주변 생활권 <small>실제 순위를 매길 지역 범위</small></span><input value={draft.neighborhoods} onChange={e=>update("neighborhoods",e.target.value)} placeholder="예: 마곡동·발산동·가양동" /></label>
        <label><span>거래량 비교 기간</span><select value={draft.period} onChange={e=>update("period",e.target.value)}><option>최근 12개월</option><option>최근 6개월</option><option>최근 3개월</option></select></label>
        <label><span>실거래가격 비교 면적</span><select value={draft.area} onChange={e=>update("area",e.target.value)}><option>전용 59㎡대와 84㎡대</option><option>전용 59㎡대</option><option>전용 84㎡대</option><option>전체 면적</option></select></label>
      </div>
    </section>

    <section className={styles.card} aria-labelledby="step2">
      <div className={styles.heading}><span className={styles.number}>02</span><div><h2 id="step2">TOP 10 실거래 조사</h2><p>한 번의 요청으로 업무지구 규모, 거래량 순위, 실제 가격을 조사합니다.</p></div></div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!hasPlace} onClick={()=>void copy(research,"조사 요청서를 복사했습니다. ChatGPT에 붙여넣으세요.")}>조사 요청서 복사</button>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className={styles.secondary}>ChatGPT 열기 ↗</a>
      </div>
      <details className={styles.details}><summary>조사 요청서 미리보기</summary><textarea readOnly value={research} rows={10} aria-label="조사 요청서 미리보기" /></details>
      <label className={styles.textareaLabel}><span>조사 결과 붙여넣기 <small>선택 · 실제 출처와 수치가 포함된 결과</small></span>
        <textarea value={draft.researchNotes} onChange={e=>update("researchNotes",e.target.value)} rows={6} placeholder="ChatGPT가 확인한 아파트 거래량 TOP 10, 계약일·층수·가격, 근거 링크를 여기에 붙여넣으세요." />
      </label>
      <p className={styles.tip}>이 사이트는 실거래를 자동 조회하지 않습니다. 조사 결과에 확인되지 않은 가격이나 순위가 있으면 최종 글에도 사실처럼 사용하지 않도록 요청합니다.</p>
    </section>

    <section className={styles.card} aria-labelledby="step3">
      <div className={styles.heading}><span className={styles.number}>03</span><div><h2 id="step3">최종 블로그 글 만들기</h2><p>집값쓱 V5 고정 규칙이 자동 적용됩니다. 제목 5개 · 발견 중심 본문 · 생활킥 · Q&A · 출처.</p></div></div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!hasPlace} onClick={()=>void copy(article,"최종 원고 요청서를 복사했습니다. 같은 ChatGPT 대화에 붙여넣으세요.")}>최종 글 요청서 복사</button>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className={styles.secondary}>ChatGPT 열기 ↗</a>
      </div>
      <details className={styles.details}><summary>최종 원고 요청서 미리보기</summary><textarea readOnly value={article} rows={10} aria-label="최종 원고 요청서 미리보기" /></details>
      <label className={styles.textareaLabel}><span>완성 글 붙여넣기 <small>이미지 요청서에 연결됩니다</small></span>
        <textarea value={draft.articleText} onChange={e=>update("articleText",e.target.value)} rows={7} placeholder="완성된 제목과 본문을 여기에 붙여넣으세요."/>
      </label>
      <div className={styles.articleActions}><button type="button" disabled={!draft.articleText.trim()} onClick={()=>void copy(draft.articleText,"완성된 블로그 원고를 복사했습니다.")}>완성 원고 복사</button><span>본문과 입력값은 이 브라우저에 자동 저장됩니다.</span></div>
    </section>

    <section className={styles.card} aria-labelledby="step4">
      <div className={styles.heading}><span className={styles.number}>04</span><div><h2 id="step4">이미지 개별 요청서</h2><p>썸네일부터 본문까지 모두 1600×900px. 대표 썸네일은 클로즈업 크롭으로 고정합니다.</p></div></div>
      {!draft.articleText.trim() && <p className={styles.tip}>위에 완성 글을 붙여넣으면 이미지별 내용이 자동 연결됩니다. 원고가 없을 때는 이미지 요청서를 사용할 수 없습니다.</p>}
      <div className={styles.images}>
        {WORKPLACE_TOP10_SLOTS.map(slot=><div key={slot.id} className={styles.imageRow}>
          <div className={styles.imageInfo}><b>{slot.id} · {slot.title}</b><span>{slot.purpose}</span></div>
          <button type="button" disabled={!draft.articleText.trim() || !hasPlace} onClick={()=>void copy(buildTop10ImagePrompt(draft,slot),slot.id+"번 이미지 요청서를 복사했습니다.")}>요청서 복사</button>
          <details className={styles.imageDetails}><summary>내용 보기</summary><textarea rows={8} readOnly value={buildTop10ImagePrompt(draft,slot)} aria-label={slot.id+"번 이미지 요청서"}/></details>
        </div>)}
      </div>
      <p className={styles.tip}>실제 사진이나 공식 자료가 없는 이미지는 억지로 만들지 않습니다. 모든 슬롯은 한 번에 한 장씩 요청하세요.</p>
    </section>

    <footer className={styles.footer}>
      <button type="button" onClick={()=>setShowAdvanced(x=>!x)} aria-expanded={showAdvanced}>{showAdvanced?"이전 제작실 안내 닫기":"기존 직주근접 제작실 사용하기"}</button>
      {showAdvanced && <p>이전에 작성한 3~5개 단지 비교·단지별 첨부 자료가 필요한 경우 <a href="/apartment-workplace/legacy">기존 제작실 열기 ↗</a>를 이용하세요. 기존 저장 자료는 삭제하지 않았습니다.</p>}
    </footer>
    {notice && <div className={styles.toast} role="status">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="알림 닫기">×</button></div>}
  </main>;
}
