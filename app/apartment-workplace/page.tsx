"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import SeriesWorkspace from "./SeriesWorkspace";

import { buildResearch, buildArticle, buildImagePrompt, imageSlots, candidateLines, type WorkplaceDraft as Draft, type Facility, type Travel, type HomeType } from "../../lib/workplace-blog-v2";

const KEY = "jibssuk-workplace-comparison-draft-v1";
const DEFAULTS: Draft = {
  address: "", facility: "상업시설", place: "스타필드 수원", city: "수원시 장안구",
  entrance: "근무지 실제 출입구(확인 필요)", travel: "도보", travelTarget: "20분 이내",
  homeType: "전체", budget: "", candidateNames: "", sourceNotes: "",
  checkedAt: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
  checkedTrade: false, checkedListing: false, checkedRoute: false,
};

function normalized(v: string, fallback: string) { return v.trim() || fallback; }
async function copyText(value: string, setNotice: (s: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    setNotice("요청서를 복사했습니다. ChatGPT에 한 번 붙여넣으세요.");
  } catch {
    setNotice("클립보드 복사에 실패했습니다. 아래 요청서 텍스트를 직접 선택해 복사하세요.");
  }
}
export default function WorkplaceApartmentStudio() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"research" | "article">("research");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Draft>;
        setDraft({ ...DEFAULTS, ...parsed });
      }
    } catch { /* Keep the editable defaults if local storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* Storage may be unavailable. */ }
  }, [draft, ready]);
  const update = <K extends keyof Draft,>(key: K, value: Draft[K]) => setDraft(old => ({ ...old, [key]: value }));
  const research = useMemo(() => buildResearch(draft), [draft]);
  const article = useMemo(() => buildArticle(draft), [draft]);
  const hasSourceNotes = draft.sourceNotes.trim().length > 0;
  const candidates = candidateLines(draft.candidateNames);
  const keywords = [
    normalized(draft.place, "근무지") + " 근처 아파트",
    normalized(draft.place, "근무지") + " 출퇴근 아파트",
    normalized(draft.place, "근무지") + " 주변 전세",
    normalized(draft.place, "근무지") + " 아파트 실거래가",
  ];
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <a href="/" className={styles.back}>← 콘텐츠 메이커</a>
        <a href="/apartment-bulk" className={styles.subLink}>기존 아파트 제작실</a>
      </header>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>집값쓱 · 생활권 중심 콘텐츠</div>
        <h1>직장 가까운 아파트,<br />가격과 출퇴근을 한 번에 비교</h1>
        <p>스타필드·산업단지·업무지구 주변의 실거주 검색형 글을 만듭니다. 자료가 검증되지 않았으면 숫자를 만들지 않습니다.</p>
        <label className={styles.workplaceInput}>이번 글의 근무지<input value={draft.place} onChange={e=>update("place",e.target.value)} placeholder="예: 스타필드 수원" /></label>
        <div className={styles.pills}><span>실거래가</span><span>현재 매물</span><span>실제 이동 경로</span><span>전세·월세</span></div>
      </section>
      <section className={styles.workflowIntro}><h2>근무지 주변 아파트 3~5곳 비교 · V2</h2><p>조건·자료 정리 → 요청서 복사 → 챗에서 글 작성 → 이미지 00~07 요청서</p><p>사이트는 자료와 요청서를 준비합니다. 입력한 이동 범위는 희망 조건이며 실제 출입구 경로 확인 전 확정하지 않습니다.</p></section>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2><span>01</span> 근무지와 독자 조건</h2>
          <div className={styles.two}>
            <label>근무지 유형
              <select value={draft.facility} onChange={e => update("facility", e.target.value as Facility)}>
                {(["상업시설","산업단지·공장","업무지구·기업","병원·대학교","기타"] as Facility[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>근무지 이름
              <input value={draft.place} onChange={e => update("place", e.target.value)} placeholder="예: 스타필드 수원" />
            </label>
            <label>지역
              <input value={draft.city} onChange={e => update("city", e.target.value)} placeholder="시·구·동" />
            </label>
            <label>근무지 공식 주소
              <input value={draft.address} onChange={e=>update("address",e.target.value)} placeholder="공식 주소를 원문과 대조 · 미확인은 needs_check" />
            </label>
            <label>이동 기준 출입구
              <input value={draft.entrance} onChange={e => update("entrance", e.target.value)} placeholder="직원 출입구 위치를 확인" />
            </label>
            <label>이동 수단
              <select value={draft.travel} onChange={e => update("travel", e.target.value as Travel)}>
                {(["도보","대중교통","자동차"] as Travel[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>허용 이동 범위
              <input value={draft.travelTarget} onChange={e => update("travelTarget", e.target.value)} placeholder="예: 도보 15분 이내" />
            </label>
            <label>비교 거래 유형
              <select value={draft.homeType} onChange={e => update("homeType", e.target.value as HomeType)}>
                {(["전체","매매","전세","월세"] as HomeType[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>예산 (선택)
              <input value={draft.budget} onChange={e => update("budget", e.target.value)} placeholder="예: 전세 3억 원 이하" />
            </label>
          </div>
          <h2><span>02</span> 아파트 후보와 검증 자료</h2>
          <label>아파트 후보 이름 <small>한 줄에 하나씩 · 없으면 조사 요청서가 후보를 찾도록 안내</small>
            <textarea rows={4} value={draft.candidateNames} onChange={e => update("candidateNames",e.target.value)} placeholder={"단지명 1\n단지명 2\n단지명 3"} />
          </label>
          <label>실제 확인한 자료 및 출처 링크 <small>계약일·면적·해제표시·매물 확인일·실제 경로를 함께 기록하세요.</small>
            <textarea rows={7} value={draft.sourceNotes} onChange={e => update("sourceNotes",e.target.value)} placeholder={"[단지명 / 전용면적]\n매매 실거래: 계약일, 층, 금액, 해제 여부, 출처 URL\n현재 매물: 매매·전세·월세 구분, 호가, 확인일, 출처 URL\n이동: 실제 출입구, 교통수단, 거리·시간, 경로 근거 URL"} />
          </label>
          <label>자료 확인일
            <input type="date" value={draft.checkedAt} onChange={e => update("checkedAt",e.target.value)} />
          </label>
          <div className={styles.checks}>
            <strong>원고 작성 전 사용자 점검</strong>
            <label><input type="checkbox" checked={draft.checkedTrade} onChange={e=>update("checkedTrade",e.target.checked)}/> 실거래가·면적·계약해제 여부 확인</label>
            <label><input type="checkbox" checked={draft.checkedListing} onChange={e=>update("checkedListing",e.target.checked)}/> 현재 매물과 실거래가 구분·날짜 확인</label>
            <label><input type="checkbox" checked={draft.checkedRoute} onChange={e=>update("checkedRoute",e.target.checked)}/> 근무지·아파트 출입구 기준 실제 이동 경로 확인</label>
            <p>체크는 점검 메모이며 공식 검증 상태를 부여하지 않습니다. 항목별 출처·확인일을 대조하고 미확인은 needs_check로 남기세요.</p>
          </div>
        </section>
        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2>독자 검색어 미리보기</h2>
            {keywords.map(k => <div key={k} className={styles.keyword}>{k}</div>)}
            <p className={styles.hint}>키워드는 검색량이 확인된 결과가 아니라 실제 검색 의도를 고려한 제안입니다.</p>
          </section>
          <section className={styles.panel}>
            <h2>기본 자료 확인처</h2>
            <a href="https://rt.molit.go.kr/" target="_blank" rel="noopener noreferrer">국토교통부 실거래가 공개시스템 ↗</a>
            <a href="https://new.land.naver.com/" target="_blank" rel="noopener noreferrer">네이버부동산 ↗</a>
            <a href="https://map.naver.com/" target="_blank" rel="noopener noreferrer">네이버지도 ↗</a>
            <p className={styles.hint}>현재 시세나 거리·시간을 자동 수집하는 기능은 아닙니다. 원문 확인과 출처 입력 후 GPT 요청서를 사용하세요.</p>
          </section>
          <section className={styles.panel}>
            <h2>권장 이미지 흐름</h2>
            <p>00 썸네일 → 01 근무지 → 02 위치 → 03 후보 비교 → 04 주거비 → 05 경로 → 06 생활 조건 → 07 발견·요약</p>
            <p className={styles.hint}>대표 1254×1254 / 본문 1600×900. 거리·가격을 그림에서 임의 생성하지 않습니다.</p>
          </section>
        </aside>
      </div>
      <section className={styles.output}>
        <div className={styles.outputHead}>
          <div><h2>03 · ChatGPT에 붙여넣을 요청서</h2><p>먼저 조사하고, 확인한 자료를 붙인 뒤 발행 원고를 만드세요.</p></div>
          <div className={styles.tabRow}>
            <button type="button" className={tab==="research"?styles.active:""} onClick={()=>setTab("research")}>① 자료 조사</button>
            <button type="button" className={tab==="article"?styles.active:""} onClick={()=>setTab("article")}>② 최종 원고</button>
          </div>
        </div>
        {tab==="article" && <div className={styles.warning}>{hasSourceNotes?"입력 메모는 검증 완료를 뜻하지 않습니다. 항목별 출처·정확한 면적·해제 여부·출입구 경로를 챗에서 대조하세요.":"자료가 아직 없습니다. 요청서는 복사할 수 있지만 수치와 경로는 needs_check로 남겨야 합니다."} 후보 {candidates.length}곳 입력{candidates.length<3||candidates.length>5?" · 비교 후보 3~5곳을 실제 위치 대조 후 선정하세요.":" · 실제 위치 대조 전에는 추천 확정 금지."}</div>}
        <textarea className={styles.prompt} readOnly value={tab==="research"?research:article} aria-label="생성한 ChatGPT 요청서" />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={()=>copyText(tab==="research"?research:article,setNotice)}>요청서 한 번에 복사</button>
          <a href={"https://chatgpt.com/?q="+encodeURIComponent(tab==="research"?research:article)} target="_blank" rel="noopener noreferrer">ChatGPT에서 이어서 작업 ↗</a>
          <button type="button" className={styles.secondary} onClick={()=>{
            if(window.confirm("이 작업의 입력값만 초기화할까요? 기존 아파트 제작실 데이터는 변경되지 않습니다.")){
              setDraft({...DEFAULTS,checkedAt:new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})});setNotice("현재 입력값만 초기화했습니다.");
            }
          }}>입력값 초기화</button>
        </div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <p className={styles.hint}>현재 입력 내용은 이 브라우저에 자동 저장됩니다. 이 페이지는 기존 발행 큐·저장 원고·다른 블로그 도구에 영향을 주지 않습니다.</p>
      </section>
      <section className={styles.output} aria-label="V2 이미지 요청서">
        <h2>04 · 이미지 00~07 요청서</h2>
        <p>각 이미지에 핵심 메시지 하나, 이미지 사이 설명 2~3줄. 실제 사진과 AI 설명 카드는 구분합니다.</p>
        <div className={styles.imageSlots}>{imageSlots.map(slot=><article className={styles.imageSlot} key={slot.id}>
          <h3>{slot.id} · {slot.title}</h3><p>{slot.size} · {slot.message}</p>
          <div className={styles.actions}><button type="button" onClick={()=>copyText(buildImagePrompt(draft,slot),setNotice)}>이미지 {slot.id} 요청서 복사</button><a href={"https://chatgpt.com/?q="+encodeURIComponent(buildImagePrompt(draft,slot))} target="_blank" rel="noreferrer">ChatGPT 열기 ↗</a></div>
          <details><summary>요청서·사진 추천 보기</summary><textarea readOnly rows={8} aria-label={"이미지 "+slot.id+" 요청서"} value={buildImagePrompt(draft,slot)} /></details>
        </article>)}</div>
        <p role="status" className={styles.notice}>{notice}</p>
      </section>
      <details className={styles.legacyTools}><summary>단지별 시리즈 자료 모으기·챗 전달·받은 원고 보관</summary><SeriesWorkspace place={draft.place} /></details>
    </main>
  );
}
