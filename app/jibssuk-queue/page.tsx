"use client";
import {useEffect,useMemo,useState} from "react";
import styles from "./page.module.css";
import {QUEUE_SIZE,SCOPES,emptyState,restore,buildPrompt,parseRecommendations,addRecommendations,placeCandidate,changeStatus,topicKey} from "../../lib/jibssuk-topic-queue.mjs";
import type {JibssukScope,JibssukState,JibssukCandidate} from "../../lib/jibssuk-topic-queue.mjs";
import JibssukArticleWorkflow from "./JibssukArticleWorkflow";
const STORAGE="content-maker-jibssuk-topic-queue-v1";
function seoulDay(){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
const statusText={waiting:"발행 대기",working:"제작 중",done:"발행 완료"} as const;
export default function JibssukTopicQueuePage(){
  const [state,setState]=useState<JibssukState>(emptyState);
  const [hydrated,setHydrated]=useState(false);
  const [scope,setScope]=useState<JibssukScope>("전체");
  const [raw,setRaw]=useState("");
  const [notice,setNotice]=useState("");
  const [target,setTarget]=useState<number|null>(null);
  const [selected,setSelected]=useState<number|null>(null);
  const [showImport,setShowImport]=useState(true);
  useEffect(()=>{
    try{const saved=localStorage.getItem(STORAGE);if(saved)setState(restore(JSON.parse(saved)));}
    catch{setNotice("저장된 목록을 읽지 못했습니다. 기존 기록은 건드리지 않았습니다.");}
    setHydrated(true);
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    try{localStorage.setItem(STORAGE,JSON.stringify(state));}
    catch{setNotice("이 브라우저에 저장하지 못했습니다. 저장공간을 확인해 주세요.");}
  },[state,hydrated]);
  const prompt=useMemo(()=>buildPrompt({
    scope,today:seoulDay(),queue:state.queue.filter((x):x is NonNullable<typeof x>=>Boolean(x)),
    history:state.history,previousSuggestions:state.previousSuggestions
  }),[scope,state.queue,state.history,state.previousSuggestions]);
  const occupied=state.queue.filter(Boolean).length;
  const done=state.queue.filter(x=>x?.status==="done").length;
  const free=QUEUE_SIZE-occupied;
  const active=selected===null?null:state.queue[selected];
  async function copyPrompt(){
    try{await navigator.clipboard.writeText(prompt);setNotice("AI 추천 요청서를 복사했습니다. ChatGPT에서 붙여넣어 조사해 주세요.");}
    catch{setNotice("복사에 실패했습니다. 아래 요청서 미리보기에서 직접 복사해 주세요.");}
  }
  function loadCandidates(){
    const report=parseRecommendations(raw);
    if(report.error){setNotice(report.error);return;}
    const result=addRecommendations(state,report);
    setState(result.state);setRaw("");
    setNotice("추천 결과 인식: 새 후보 "+result.added+"개 저장 · 중복 또는 형식 오류 "+result.skipped+"개 제외.");
    setShowImport(false);
  }
  function chooseCandidate(candidate:JibssukCandidate){
    const result=placeCandidate(state,candidate.title,target);
    if(result.error){setNotice(result.error);return;}
    setState(result.state);setSelected(result.slot??null);
    setNotice('"'+candidate.title+'"을 '+String((result.slot??0)+1).padStart(2,"0")+"번에 등록했습니다.");
    setTarget(null);
  }
  function onDone(slot:number){
    const item=state.queue[slot];if(!item)return;
    if(!window.confirm('"'+item.title+'"을 실제 네이버에 발행한 것으로 기록할까요?'))return;
    setState(old=>changeStatus(old,slot,"done"));
    setNotice("발행 이력에 저장했습니다. 이제 이 자리의 갈아끼우기를 사용할 수 있습니다.");
  }
  function replaceDone(slot:number){
    if(!state.queue[slot]||state.queue[slot]?.status!=="done")return;
    setTarget(slot);setSelected(slot);
    setNotice(String(slot+1).padStart(2,"0")+"번 완료 자리에 넣을 글감을 아래 후보 목록에서 골라 주세요.");
    document.getElementById("jibssuk-suggestions")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  if(!hydrated)return <main className={styles.page}><div className={styles.loading}>집값쓱 발행 목록 불러오는 중…</div></main>;
  return <main className={styles.page}>
    <header className={styles.topbar}>
      <a href="/" className={styles.back}>← 콘텐츠 메이커</a>
      <strong>🏙️ 집값쓱 · 글감 발행 목록</strong>
      <a className={styles.other} href="/paramma-bulk">Paramma 제작실</a>
    </header>
    <section className={styles.hero}>
      <div><span className={styles.overline}>JIBSSUK · PUBLISH QUEUE</span><h1>상시 발행 목록 10개</h1>
      <p>AI가 최근 관심 글감을 찾아오면 내가 골라 등록하고, 발행 완료한 자리만 하나씩 갈아끼웁니다.</p></div>
      <div className={styles.heroCount}><strong>{occupied}<small> / {QUEUE_SIZE}칸</small></strong><span>발행 완료 {done}개 · 빈자리 {free}개</span></div>
    </section>
    {notice&&<div className={styles.notice} role="status">{notice}</div>}
    <section className={styles.layout}>
      <div className={styles.column}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.overline}>01 · ARTICLE QUEUE</span><h2>발행 목록</h2></div><small>Paramma와 같은 10칸 방식</small></div>
          <div className={styles.queue}>
            {state.queue.map((item,index)=><div key={index} className={[styles.queueRow,selected===index?styles.active:""].join(" ")}>
              <button type="button" className={styles.queueSelect} onClick={()=>{setSelected(index);setNotice("");}}>
                <span className={styles.number}>{String(index+1).padStart(2,"0")}</span>
                <span className={styles.queueText}>
                  <strong>{item?.title||"새 글감 대기"}</strong>
                  <small>{item?item.category+" · "+statusText[item.status]:"AI 추천 후보에서 글감 선택"}</small>
                </span>
              </button>
              {item?.status==="done"&&<button className={styles.swap} type="button" onClick={()=>replaceDone(index)}>갈아끼우기</button>}
            </div>)}
          </div>
          <details className={styles.history}>
            <summary>발행 이력 <strong>{state.history.length}개</strong></summary>
            {state.history.length? <div className={styles.historyList}>{[...state.history].reverse().map((x,i)=><div key={x.addedAt+i}><strong>{x.title}</strong><small>{x.completedAt?x.completedAt.slice(0,10):"날짜 미기록"}</small></div>)}</div>:<p className={styles.muted}>발행 완료한 글이 여기에 쌓입니다.</p>}
          </details>
        </section>
        <section id="jibssuk-suggestions" className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.overline}>02 · TOPIC POOL</span><h2>AI 추천 글감 후보</h2></div><small>{state.candidates.length}개 보관</small></div>
          {target!==null&&<div className={styles.targetNotice}><b>{String(target+1).padStart(2,"0")}번 완료 자리를 교체합니다.</b><button type="button" onClick={()=>setTarget(null)}>선택 취소</button></div>}
          {state.candidates.length? <div className={styles.candidates}>
            {state.candidates.map((item,index)=><article key={topicKey(item.title)+index} className={styles.candidate}>
              <div className={styles.candidateMain}>
                <span className={styles.candidateTag}>{item.category}</span><h3>{item.title}</h3>
                <details className={styles.sourceDetail}><summary>관심 근거·원문 확인</summary>
                  <p>{item.interestType} · {item.interestEvidence}</p>
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>
                  <small>발표일 {item.sourceDate} · AI 조사 결과는 원고 작성 전 재확인</small>
                </details>
              </div>
              <button type="button" className={styles.pick} onClick={()=>chooseCandidate(item)}
                disabled={target===null&&free===0}>{target!==null?"이 자리에 넣기":"발행 목록에 등록"}</button>
            </article>)}
          </div>:<p className={styles.empty}>아직 후보가 없습니다. 아래에서 추천 요청서를 복사해 ChatGPT에서 조사해 주세요.</p>}
          {target===null&&free===0&&<p className={styles.muted}>발행 목록이 가득 찼습니다. 발행 완료한 자리에서 ‘갈아끼우기’를 누르면 후보를 선택할 수 있습니다.</p>}
        </section>
      </div>
      <div className={styles.column}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.overline}>03 · AI DISCOVERY</span><h2>새 글감 10개 찾기</h2></div></div>
          <p className={styles.muted}>최근 7일의 관심 주제를 먼저 조사하고, 부족하면 30일까지 넓힙니다. 확인 가능한 근거가 있는 글감만 추천하도록 요청합니다.</p>
          <label className={styles.field}>조사 범위
            <select value={scope} onChange={e=>setScope(e.target.value as JibssukScope)}>
              {SCOPES.map(x=><option key={x} value={x}>{x}{x==="전체"?" · 기본값":""}</option>)}
            </select>
          </label>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={()=>void copyPrompt()}>1 · AI 추천 요청서 복사</button>
            <a className={styles.secondary} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
          </div>
          <details className={styles.preview}><summary>ChatGPT에 보낼 전체 요청서 확인</summary><textarea readOnly rows={10} value={prompt} aria-label="고정된 AI 추천 요청서"/></details>
          <div className={styles.paste}>
            <button type="button" className={styles.sectionToggle} onClick={()=>setShowImport(v=>!v)}>2 · ChatGPT 추천 결과 붙여넣기 {showImport?"▴":"▾"}</button>
            {showImport&&<>
              <textarea rows={9} value={raw} onChange={e=>setRaw(e.target.value)}
                placeholder={"[JIBSSUK_TOPIC_RECOMMENDATIONS_JSON]\n{ \"version\": 1, \"checkedAt\": \"YYYY-MM-DD\", \"candidates\": [] }\n[/JIBSSUK_TOPIC_RECOMMENDATIONS_JSON]"}/>
              <button className={styles.primary} type="button" onClick={loadCandidates} disabled={!raw.trim()}>후보 목록 불러오기</button>
            </>}
          </div>
          <p className={styles.smallInfo}>추천 결과를 붙여넣어도 발행 목록은 자동으로 바뀌지 않습니다. 후보가 소진되면 같은 방식으로 새 글감을 조사합니다.</p>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className={styles.overline}>04 · SELECTED TOPIC</span><h2>선택한 글감</h2></div></div>
          {active&&selected!==null?<div className={styles.selectedTopic}>
            <span className={styles.candidateTag}>{active.category}</span><h3>{active.title}</h3>
            <p>현재 상태: <b>{statusText[active.status]}</b></p>
            <details className={styles.sourceDetail}><summary>이 글감의 원문·추천 근거</summary>
              <p>{active.interestType} · {active.interestEvidence}</p>
              <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>
              <small>원문 발표일 {active.sourceDate} · 조사 전 원문 재확인 필요</small>
            </details>
            <button className={styles.primary} type="button" onClick={()=>document.getElementById("jibssuk-workflow")?.scrollIntoView({behavior:"smooth",block:"start"})}>
              이 화면에서 심층 조사·원고 작성 ↓
            </button>
            {active.status==="waiting"&&<button className={styles.primary} type="button" onClick={()=>setState(old=>changeStatus(old,selected,"working"))}>제작 중으로 표시</button>}
            {active.status==="working"&&<button className={styles.primary} type="button" onClick={()=>onDone(selected)}>네이버 발행 완료 표시</button>}
            {active.status==="done"&&<div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={()=>replaceDone(selected)}>새 글감으로 갈아끼우기</button>
              <button className={styles.secondary} type="button" onClick={()=>setState(old=>changeStatus(old,selected,"working"))}>완료 취소</button>
            </div>}
            <p className={styles.smallInfo}>이 페이지 아래에서 선택한 글감을 바로 조사하고 원고를 작성합니다. 다른 화면으로 이동하지 않으며 글감별로 작업 내용이 저장됩니다.</p>
          </div>:<p className={styles.empty}>발행 목록에서 등록된 글감을 선택하세요.</p>}
        </section>
      </div>
    </section>
    {active&&<JibssukArticleWorkflow key={active.addedAt} item={active}/>}
    <footer className={styles.footer}>현재 브라우저에 자동 저장 · Paramma 및 기존 아파트 제작 데이터와 분리 · 글감과 원고를 한 페이지에서 관리</footer>
  </main>;
}
