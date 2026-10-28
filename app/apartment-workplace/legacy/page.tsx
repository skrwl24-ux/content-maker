"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";
import SeriesWorkspace from "../SeriesWorkspace";

import { buildResearch, buildArticle, buildImagePrompt, imageSlots, candidateLines, type WorkplaceDraft as Draft, type Facility, type Travel, type HomeType } from "../../../lib/workplace-blog-v2";

const KEY = "jibssuk-workplace-comparison-draft-v1";
const DEFAULTS: Draft = {
  articleText: "",
  address: "", facility: "상업시설", place: "스타필드 수원", city: "수원시 장안구",
  entrance: "근무지 실제 출입구(확인 필요)", travel: "도보", travelTarget: "20분 이내",
  homeType: "전체", budget: "", candidateNames: "", sourceNotes: "",
  checkedAt: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
  checkedTrade: false, checkedListing: false, checkedRoute: false,
};

async function copyText(value: string, setNotice: (s: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    setNotice("복사했습니다. 원하는 곳에 붙여넣으세요.");
  } catch {
    setNotice("클립보드 복사에 실패했습니다. 아래 요청서 텍스트를 직접 선택해 복사하세요.");
  }
}
export default function WorkplaceApartmentStudio() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
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
  const stages = ["근무지·조건", "후보 조사", "자료 첨부·챗 전달", "비교글 작성", "이미지 제작", "최종 확인"];
  return (
    <main className={styles.page}>
      <header className={styles.top}><a href="/" className={styles.back}>← 콘텐츠 메이커</a><a href="/apartment-workplace" className={styles.subLink}>기존 아파트 제작실</a></header>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>집값쓱 · 직주근접 블로그 V2</div>
        <h1>위에서 아래로,<br />자료부터 발행 준비까지</h1>
        <p>사이트에서 자료를 모으고 챗에서 글과 이미지를 만듭니다. 입력한 이동 범위는 희망 조건이며 실제 출입구 경로 확인 전 확정하지 않습니다.</p>
      </section>
      <nav className={styles.productionNav} aria-label="블로그 제작 순서">{stages.map((name,i)=><a key={name} href={"#workplace-step-"+(i+1)}><span>{String(i+1).padStart(2,"0")}</span>{name}</a>)}</nav>
      {notice && <p className={styles.workflowNotice} role="status">{notice}</p>}
      <section id="workplace-step-1" aria-labelledby="workplace-heading-1" className={`${styles.panel} ${styles.workflowStep}`}>
        <h2 id="workplace-heading-1"><span>01</span> 근무지·조건 입력</h2>
        <p>어디로 출근하는지, 어떤 집을 찾는지 정하세요. 모르는 정보와 예산은 비워둬도 됩니다.</p>
        <div className={styles.two}>
          <label>근무지 유형<select value={draft.facility} onChange={e=>update("facility",e.target.value as Facility)}>{(["상업시설","산업단지·공장","업무지구·기업","병원·대학교","기타"] as Facility[]).map(v=><option key={v}>{v}</option>)}</select></label>
          <label>근무지 이름<input value={draft.place} onChange={e=>update("place",e.target.value)} placeholder="예: 스타필드 수원" /></label>
          <label>지역<input value={draft.city} onChange={e=>update("city",e.target.value)} placeholder="시·구·동" /></label>
          <label>근무지 공식 주소<input value={draft.address} onChange={e=>update("address",e.target.value)} placeholder="미확인은 needs_check" /></label>
          <label>이동 기준 출입구<input value={draft.entrance} onChange={e=>update("entrance",e.target.value)} placeholder="실제 이용할 출입구 · 확인 필요" /></label>
          <label>이동 수단<select value={draft.travel} onChange={e=>update("travel",e.target.value as Travel)}>{(["도보","대중교통","자동차"] as Travel[]).map(v=><option key={v}>{v}</option>)}</select></label>
          <label>희망 이동 범위<input value={draft.travelTarget} onChange={e=>update("travelTarget",e.target.value)} placeholder="예: 20분 이내 · 실제 경로 검증 전 희망 조건" /></label>
          <label>비교 거래 유형<select value={draft.homeType} onChange={e=>update("homeType",e.target.value as HomeType)}>{(["전체","매매","전세","월세"] as HomeType[]).map(v=><option key={v}>{v}</option>)}</select></label>
          <label>예산 (선택)<input value={draft.budget} onChange={e=>update("budget",e.target.value)} placeholder="미설정이면 비워두기" /></label>
          <label>자료 확인일<input type="date" value={draft.checkedAt} onChange={e=>update("checkedAt",e.target.value)} /></label>
        </div>
        <div className={styles.actions}><a href="#workplace-step-2">다음: 후보 조사 →</a></div>
      </section>
      <section id="workplace-step-2" aria-labelledby="workplace-heading-2" className={`${styles.panel} ${styles.workflowStep}`}>
        <h2 id="workplace-heading-2"><span>02</span> 후보 3~5곳 조사</h2>
        <p>조사 요청서를 챗에 보내 후보를 찾고, 실제 위치를 대조한 후보 이름을 아래에 기록하세요.</p>
        <div className={styles.actions}><button type="button" className={styles.primary} onClick={()=>copyText(research,setNotice)}>조사 요청서 복사</button><a href={"https://chatgpt.com/?q="+encodeURIComponent(research)} target="_blank" rel="noreferrer">챗에서 후보 조사 ↗</a></div>
        <details className={styles.requestDetails}><summary>조사 요청서 보기</summary><textarea className={styles.prompt} readOnly value={research} aria-label="조사 요청서" /></details>
        <label>아파트 후보 이름 <small>한 줄에 하나씩. 위치 미확인은 추천 확정을 뜻하지 않습니다.</small><textarea rows={4} value={draft.candidateNames} onChange={e=>update("candidateNames",e.target.value)} placeholder={"단지명 1\n단지명 2\n단지명 3"} /></label>
        <details className={styles.requestDetails}><summary>자료 확인처</summary><div className={styles.actions}><a href="https://rt.molit.go.kr/" target="_blank" rel="noreferrer">국토부 실거래 ↗</a><a href="https://new.land.naver.com/" target="_blank" rel="noreferrer">네이버부동산 ↗</a><a href="https://map.naver.com/" target="_blank" rel="noreferrer">네이버지도 ↗</a></div></details>
        <div className={styles.actions}><a href="#workplace-step-3">다음: 자료 첨부·챗 전달 →</a></div>
      </section>
      <section id="workplace-step-3" aria-labelledby="workplace-heading-3" className={`${styles.output} ${styles.workflowStep}`}>
        <h2 id="workplace-heading-3">03 · 자료 첨부·챗 전달</h2>
        <p>후보별로 작업을 추가하고 단지정보·매매·전세·월세·현재 매물·경로를 첨부하세요. 자료 ZIP은 챗에 직접 올려 확인받습니다.</p>
        <SeriesWorkspace place={draft.place} />
        <p className={styles.hint}>기존 단지별 원고는 보관 영역에서 열 수 있습니다. 모든 후보의 자료가 모이면 04에서 비교글을 요청하세요.</p>
        <div className={styles.actions}><a href="#workplace-step-4">다음: 비교글 작성 →</a></div>
      </section>
      <section id="workplace-step-4" aria-labelledby="workplace-heading-4" className={`${styles.panel} ${styles.workflowStep}`}>
        <h2 id="workplace-heading-4"><span>04</span> 챗에서 비교글 작성</h2>
        <p>후보별로 챗에서 확인한 내용을 모아 아래에 붙여넣고 최종 원고를 요청하세요. 자료 ZIP도 같은 챗에 직접 첨부해야 합니다.</p>
        <label>실제 확인한 자료 및 출처 링크 <small>각 후보의 정확한 전용면적·계약일·층·금액·해제 여부·호가 확인일·실제 경로·출처를 함께 기록하세요. 03의 파일은 요청서로 자동 전송되지 않습니다.</small><textarea rows={7} value={draft.sourceNotes} onChange={e=>update("sourceNotes",e.target.value)} placeholder="후보별 확인 내용과 출처, 미확인 항목을 챗에서 받아 붙여넣기" /></label>
        <div className={styles.warning}>{hasSourceNotes?"입력 메모는 검증 완료를 뜻하지 않습니다. 정확한 면적·해제 여부·출입구 경로와 출처를 대조하세요.":"아직 자료 메모가 없습니다. 미확인 수치와 경로는 needs_check로 남깁니다."} 후보 {candidates.length}곳 입력 · 비교 후보 3~5곳을 실제 위치 대조 후 선정하세요.</div>
        <div className={styles.actions}><button type="button" className={styles.primary} onClick={()=>copyText(article,setNotice)}>최종 원고 요청서 복사</button><a href={"https://chatgpt.com/?q="+encodeURIComponent(article)} target="_blank" rel="noreferrer">챗에서 비교글 작성 ↗</a></div>
        <details className={styles.requestDetails}><summary>최종 원고 요청서 보기</summary><textarea className={styles.prompt} readOnly value={article} aria-label="최종 원고 요청서" /></details>
        <label>챗에서 받은 비교글 원고<textarea rows={10} value={draft.articleText||""} onChange={e=>update("articleText",e.target.value)} placeholder="완성 원고를 여기에 붙여넣으세요. 다음 이미지 요청서에 함께 포함됩니다." /></label>
        <div className={styles.actions}><a href="#workplace-step-5">다음: 이미지 제작 →</a></div>
      </section>
      <section id="workplace-step-5" aria-labelledby="workplace-heading-5" className={`${styles.output} ${styles.workflowStep}`}>
        <h2 id="workplace-heading-5">05 · 이미지 00~07 제작</h2>
        <p>완성 원고를 같은 챗에 두고 슬롯별 요청서를 보내세요. 이미지 한 장 뒤에 설명 2~3줄을 넣습니다.</p>
        {!draft.articleText?.trim()&&<p className={styles.warning}>04에 비교글 원고를 붙여넣으면 이미지 요청서에도 포함됩니다. 원고 없이 작업하면 챗에 원고와 자료를 별도로 첨부하세요.</p>}
        <div className={styles.imageSlots}>{imageSlots.map(slot=><article className={styles.imageSlot} key={slot.id}>
          <h3>{slot.id} · {slot.title}</h3><p>{slot.size} · {slot.message}</p>
          <div className={styles.actions}><button type="button" onClick={()=>copyText(buildImagePrompt(draft,slot),setNotice)}>이미지 {slot.id} 요청서 복사</button><a href={"https://chatgpt.com/?q="+encodeURIComponent(buildImagePrompt(draft,slot))} target="_blank" rel="noreferrer">ChatGPT 열기 ↗</a></div>
          <details><summary>요청서·사진 추천 보기</summary><textarea readOnly rows={8} aria-label={"이미지 "+slot.id+" 요청서"} value={buildImagePrompt(draft,slot)} /></details>
        </article>)}</div>
        <div className={styles.actions}><a href="#workplace-step-6">다음: 최종 확인 →</a></div>
      </section>
      <section id="workplace-step-6" aria-labelledby="workplace-heading-6" className={`${styles.panel} ${styles.workflowStep}`}>
        <h2 id="workplace-heading-6"><span>06</span> 최종 확인·발행 준비</h2>
        <div className={styles.checks}><strong>발행 전 사용자 점검</strong>
          <label><input type="checkbox" checked={draft.checkedTrade} onChange={e=>update("checkedTrade",e.target.checked)} /> 단지·전용면적·계약일·층·금액·해제 여부와 출처 대조</label>
          <label><input type="checkbox" checked={draft.checkedListing} onChange={e=>update("checkedListing",e.target.checked)} /> 실거래와 현재 호가 구분·조회일·전월세 계약 조건 확인</label>
          <label><input type="checkbox" checked={draft.checkedRoute} onChange={e=>update("checkedRoute",e.target.checked)} /> 실제 출입구 경로 확인·미확인 값 needs_check 표시</label>
          <p>체크는 점검 메모이며 공식 검증 상태를 부여하지 않습니다.</p>
        </div>
        <p>이미지 사이 설명 2~3줄, Q&A 3개, 결론·3줄 요약과 조사일·출처를 확인한 뒤 블로그에서 이미지를 배치하고 발행하세요.</p>
        <div className={styles.actions}><button type="button" className={styles.primary} disabled={!draft.articleText?.trim()} onClick={()=>copyText(draft.articleText||"",setNotice)}>비교글 원고 복사</button><a href="#workplace-step-4">원고 수정으로 돌아가기</a></div>

        <p className={styles.hint}>입력과 원고는 이 브라우저에 자동 저장됩니다. 사이트에서 블로그에 자동 발행하지 않습니다.</p>
      </section>
    </main>
  );
}
