"use client";

import {useEffect,useMemo,useState} from "react";
import type {JibssukItem} from "../../lib/jibssuk-topic-queue.mjs";
import {makeResearchHandoff,researchNotesFromHandoff} from "../../lib/jibssuk-research-handoff.mjs";
import {
  buildDeepResearchPrompt,buildFollowupResearchPrompt,
  parseResearchReport,parseNaverFinalArticle,factKey,
  DEFAULT_DEEP_RESEARCH_DIRECTIONS
} from "../../lib/research-studio.mjs";
import {parseJibssukCopiedReport,buildJibssukIssueArticlePrompt} from "../../lib/jibssuk-simple-workflow.mjs";
import {buildJibssukNaverRichBody} from "../../lib/jibssuk-naver-rich-export.mjs";
import styles from "./workflow.module.css";

const STORAGE_PREFIX="content-maker-jibssuk-inline-workflow-v1:";
function koreanDay(){
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export default function JibssukArticleWorkflow({item}:{item:JibssukItem}){
  // AddedAt belongs to the selected queue entry, not its position.
  // Replacing a completed queue slot never overwrites the previous article draft.
  const storageKey=STORAGE_PREFIX+item.addedAt;
  const [hydrated,setHydrated]=useState(false);
  const [acceptedRaw,setAcceptedRaw]=useState("");
  const [reportPaste,setReportPaste]=useState("");
  const [approved,setApproved]=useState<string[]>([]);
  const [angleId,setAngleId]=useState("");
  const [finalPaste,setFinalPaste]=useState("");
  const [articleTitle,setArticleTitle]=useState("");
  const [articleBody,setArticleBody]=useState("");
  const [status,setStatus]=useState("");
  const report=useMemo(()=>parseResearchReport(acceptedRaw),[acceptedRaw]);
  const naverRich=useMemo(()=>buildJibssukNaverRichBody(articleBody),[articleBody]);
  const handoff=useMemo(()=>makeResearchHandoff(item),[item]);
  const notes=useMemo(()=>handoff?researchNotesFromHandoff(handoff):"",[handoff]);
  const today=koreanDay();

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(storageKey);
      if(raw){
        const data=JSON.parse(raw);
        if(data?.version===1){
          const text=(v:unknown,n:number)=>typeof v==="string"?v.slice(0,n):"";
          setAcceptedRaw(text(data.acceptedRaw,180000));
          setReportPaste(text(data.reportPaste,180000));
          setApproved(Array.isArray(data.approved)?data.approved.filter((v:unknown)=>typeof v==="string").slice(0,100):[]);
          setAngleId(text(data.angleId,60));
          setFinalPaste(text(data.finalPaste,180000));
          setArticleTitle(text(data.articleTitle,250));
          setArticleBody(text(data.articleBody,120000));
        }
      }
    }catch{setStatus("저장된 작업을 불러오지 못했습니다. 기존 저장 데이터는 변경하지 않았습니다.");}
    setHydrated(true);
  },[storageKey]);

  useEffect(()=>{
    if(!hydrated)return;
    try{
      localStorage.setItem(storageKey,JSON.stringify({
        version:1,topic:item.title,acceptedRaw,reportPaste,approved,angleId,finalPaste,articleTitle,articleBody
      }));
    }catch{setStatus("이 브라우저에 작업을 저장하지 못했습니다. 저장 공간을 확인해 주세요.");}
  },[hydrated,storageKey,item.title,acceptedRaw,reportPaste,approved,angleId,finalPaste,articleTitle,articleBody]);

  const researchPrompt=useMemo(()=>buildDeepResearchPrompt({
    channel:"집값쓱",topic:item.title,notes,today,
    directions:DEFAULT_DEEP_RESEARCH_DIRECTIONS
  })+"\n\n[복사하기 쉬운 출력 형식 — 마지막 우선]\n최종 답변은 [RESEARCH_REPORT_JSON]과 [/RESEARCH_REPORT_JSON]을 포함해 하나의 텍스트 코드블록으로만 출력해라. ChatGPT의 '코드 복사' 버튼으로 전체 결과를 복사할 수 있어야 한다. 태그 안은 유효한 JSON만 사용하고 HTML 문자 엔터티·줄 끝 역슬래시는 출력하지 마라.",[item.title,notes,today]);
  const followupPrompt=useMemo(()=>report?buildFollowupResearchPrompt({
    channel:"집값쓱",topic:item.title,notes,report,approvedKeys:approved,today,
    directions:DEFAULT_DEEP_RESEARCH_DIRECTIONS
  }):"",[item.title,notes,report,approved,today]);
  const selectedAngle=report?.angles.find(a=>a.id===angleId);
  const finalPrompt=useMemo(()=>report?buildJibssukIssueArticlePrompt({
    topic:item.title,notes,report,selectedAngleId:angleId,today
  }):"",[item.title,notes,report,angleId,today]);

  async function copy(value:string,label:string){
    try{await navigator.clipboard.writeText(value);setStatus(label+" 복사했습니다. ChatGPT에서 붙여넣어 사용하세요.");}
    catch{setStatus("복사하지 못했습니다. 아래 미리보기에서 직접 복사해 주세요.");}
  }
  async function copyNaverFormatted(){
    if(!naverRich.plain)return;
    try{
      if(typeof ClipboardItem==="undefined" || !navigator.clipboard?.write)throw new Error("HTML clipboard unavailable");
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html":new Blob([naverRich.html],{type:"text/html"}),
          "text/plain":new Blob([naverRich.plain],{type:"text/plain"}),
        })
      ]);
      setStatus("네이버 본문에 Ctrl+V로 붙여넣으세요. 소제목·굵기·문단 서식을 포함해 복사했습니다. 네이버 편집기에서 일부 서식이 달라질 수 있으니 발행 전 확인해 주세요.");
    }catch{
      try{
        await navigator.clipboard.writeText(naverRich.plain);
        setStatus("브라우저에서 서식 복사가 지원되지 않아 일반 텍스트로 복사했습니다. 네이버 본문에 붙여넣은 뒤 서식을 적용해 주세요.");
      }catch{
        setStatus("복사가 차단됐습니다. 아래 본문 편집 칸에서 직접 복사해 주세요.");
      }
    }
  }
  function importResearchText(input:string){
    const parsed=parseJibssukCopiedReport(input);
    if(!parsed){setStatus("조사 결과를 인식하지 못했습니다. ChatGPT의 코드 복사 버튼으로 전체 결과를 복사하거나 아래 칸에 붙여넣어 주세요.");return;}
    if((articleTitle||articleBody)&&!window.confirm("새 조사 보고서를 가져오면 기존 원고가 초기화됩니다. 계속할까요?"))return;
    const keys=new Set(parsed.report.facts.filter(f=>f.sourceUrl).map(factKey));
    setApproved(old=>old.filter(k=>keys.has(k)));
    setAcceptedRaw(parsed.stored);
    setReportPaste(input.slice(0,180000));
    setAngleId(old=>parsed.report.angles.some(a=>a.id===old)?old:parsed.report.angles[0]?.id||"");
    setFinalPaste("");setArticleTitle("");setArticleBody("");
    setStatus("조사 결과를 가져왔습니다. 개별 체크는 필요 없습니다. 글의 관점을 선택하세요.");
  }
  function importFinalText(input:string){
    const result=parseNaverFinalArticle(input);
    if(!result){setStatus("원고 형식을 인식하지 못했습니다. 원고 전체를 코드 복사해 주세요.");return;}
    if((articleTitle||articleBody)&&!window.confirm("현재 편집 중인 원고를 새 원고로 교체할까요?"))return;
    setFinalPaste(input.slice(0,180000));
    setArticleTitle(result.title);setArticleBody(result.body);
    setStatus("최종 원고를 가져왔습니다. 제목·본문을 편집하거나 복사하세요.");
  }
  async function importFromClipboard(which:"research"|"final"){
    try{
      const input=await navigator.clipboard.readText();
      if(!input.trim()){setStatus("클립보드가 비어 있습니다. ChatGPT 답변에서 코드 복사를 먼저 눌러 주세요.");return;}
      if(which==="research")importResearchText(input);else importFinalText(input);
    }catch{setStatus("클립보드 접근이 차단됐습니다. 아래 '직접 붙여넣기'를 열어 Ctrl+V를 사용하세요.");}
  }
  function importFinal(){importFinalText(finalPaste);}
  if(!hydrated)return <div className={styles.loading}>선택한 글감의 조사 내용을 불러오는 중…</div>;

  return <section id="jibssuk-workflow" className={styles.shell} aria-label="선택한 글감 심층 조사·원고 작성">
    <div className={styles.header}>
      <div><span className={styles.eyebrow}>JIBSSUK · ONE PAGE WORKFLOW</span>
        <h2>선택한 글감 조사부터 원고까지</h2>
        <p className={styles.topic}>{item.title}</p>
        <p className={styles.hint}>집값쓱 화면에서 계속 작업합니다. 뉴스·방송·사건·수상·분양 관련 원문을 확인하고 핵심만 자연스럽게 씁니다.</p>
      </div>
      <a className={styles.sourceLink} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">추천 기사 원문 보기 ↗</a>
    </div>
    {status&&<p role="status" className={styles.notice}>{status}</p>}
    <div className={styles.progress}><span>1 · 결과 가져오기</span><span>2 · 관점 선택</span><span>3 · 원고 작성</span></div>

    <section className={styles.step}>
      <h3>1. AI 심층 조사</h3>
      <p>글감 제목·최근 이슈·기사 날짜·원문 링크가 자동으로 포함된 요청서입니다. 직접 다시 입력하지 않아도 됩니다.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.mainButton} disabled={!handoff} onClick={()=>void copy(researchPrompt,"심층 조사 요청서")}>심층 조사 요청서 복사</button>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className={styles.otherButton}>ChatGPT 열기 ↗</a>
      </div>
      <details className={styles.details}><summary>조사 요청서 전체 보기</summary>
        <textarea aria-label="심층 조사 요청서 미리보기" readOnly rows={8} value={researchPrompt}/>
      </details>
      <p className={styles.hint}>ChatGPT 조사 답변에서 <b>코드 복사</b>를 누른 뒤 아래 버튼을 누르면 됩니다. 드래그하거나 직접 붙여넣을 필요가 없습니다.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.mainButton} onClick={()=>void importFromClipboard("research")}>클립보드에서 조사 결과 가져오기</button>
      </div>
      <details className={styles.details}><summary>직접 붙여넣기 (클립보드 버튼이 안 될 때)</summary>
        <label htmlFor="jibssuk-research-paste">ChatGPT 조사 결과</label>
        <textarea id="jibssuk-research-paste" rows={5} maxLength={180000} value={reportPaste} onChange={e=>setReportPaste(e.target.value)}
          placeholder={"[RESEARCH_REPORT_JSON]\\n{ ... }\\n[/RESEARCH_REPORT_JSON]"}/>
        <button type="button" className={styles.otherButton} disabled={!reportPaste.trim()} onClick={()=>importResearchText(reportPaste)}>붙여넣은 조사 결과 가져오기</button>
      </details>
    </section>

    {report&&<section className={styles.step}>
      <h3>2. 글의 관점 선택</h3>
      <p><b>사실마다 체크할 필요 없습니다.</b> 아래에서 글의 관점 하나만 고르세요. 원문 내용은 AI가 원고를 작성할 때 다시 확인하도록 요청합니다.</p>
      {report.summary&&<details className={styles.details}><summary>조사 요약 펼쳐보기</summary><p className={styles.summary}>{report.summary}</p></details>}
      <details className={styles.details}><summary>조사한 사실·기사 원문 {report.facts.length}개 펼쳐보기 (선택)</summary>
        <p className={styles.hint}>보고서에 출처가 있다고 검증 완료는 아닙니다. 필요할 때 원문을 직접 확인할 수 있습니다.</p>
        <div className={styles.factList}>
          {report.facts.map(f=><div key={f.id} className={styles.fact}>
            <p>{f.claim}</p>
            {f.sourceUrl?<a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{f.sourceTitle||"기사 원문 보기"} ↗</a>:<small>원문 주소 없음 · 확인 불가</small>}
            {f.publishedAt&&<small>발표일 {f.publishedAt}</small>}
          </div>)}
        </div>
      </details>
      <label htmlFor="jibssuk-angle">원고에 사용할 관점</label>
      <select id="jibssuk-angle" value={selectedAngle?.id||""} onChange={e=>setAngleId(e.target.value)}>
        {report.angles.length===0?<option value="">확인된 관점 없음</option>:
          report.angles.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
      </select>
      {selectedAngle&&<p className={styles.summary}>{selectedAngle.readerQuestion} · {selectedAngle.uniqueValue}</p>}
      {report.gaps.length>0&&<details className={styles.details}><summary>아직 부족한 정보 {report.gaps.length}개</summary>
        <ul>{report.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul>
      </details>}
      <div className={styles.actions}>
        <button type="button" className={styles.otherButton} onClick={()=>void copy(followupPrompt,"추가 조사 요청서")}>부족한 정보 추가 조사 요청서 복사</button>
      </div>
    </section>}

    {report&&<section className={styles.step}>
      <h3>3. 네이버 원고 작성</h3>
      <p>선택한 사건을 중심으로 <b>일기 같은 자연스러운 말투와 남들이 지나친 발견</b>을 살려 원고를 요청합니다. 조사 내용은 필요한 만큼만 쓰고 원문은 다시 확인합니다.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.mainButton} disabled={!finalPrompt}
          onClick={()=>void copy(finalPrompt,"네이버 최종 원고 요청서")}>최종 원고 요청서 복사</button>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className={styles.otherButton}>ChatGPT 열기 ↗</a>
      </div>
      {!finalPrompt&&<p className={styles.hint}>선택한 관점에 연결된 출처 링크가 있어야 원고 요청서를 만들 수 있습니다.</p>}
      {finalPrompt&&<details className={styles.details}><summary>원고 요청서 전체 보기</summary>
        <textarea readOnly rows={9} aria-label="원고 요청서 미리보기" value={finalPrompt}/>
      </details>}
      <p className={styles.hint}>ChatGPT 원고 답변에서 <b>코드 복사</b>를 누르고 아래 버튼으로 가져오세요.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.mainButton} onClick={()=>void importFromClipboard("final")}>클립보드에서 완성 원고 가져오기</button>
      </div>
      <details className={styles.details}><summary>직접 붙여넣기 (대체 방법)</summary>
        <label htmlFor="jibssuk-final-paste">ChatGPT 완성 원고</label>
        <textarea id="jibssuk-final-paste" rows={5} maxLength={180000} value={finalPaste} onChange={e=>setFinalPaste(e.target.value)}
          placeholder={"[NAVER_FINAL_ARTICLE_JSON]\\n{ ... }\\n[/NAVER_FINAL_ARTICLE_JSON]"}/>
        <button type="button" className={styles.otherButton} disabled={!finalPaste.trim()} onClick={importFinal}>붙여넣은 완성 원고 가져오기</button>
      </details>
      {(articleTitle||articleBody)&&<div className={styles.editor}>
        <h3>네이버 발행용 편집</h3>
        <label htmlFor="jibssuk-article-title">제목</label>
        <input id="jibssuk-article-title" value={articleTitle} maxLength={250} onChange={e=>setArticleTitle(e.target.value)}/>
        <label htmlFor="jibssuk-article-body">본문</label>
        <textarea id="jibssuk-article-body" value={articleBody} rows={13} maxLength={120000}
          onChange={e=>setArticleBody(e.target.value)}/>
        {naverRich.html&&<div className={styles.naverPreviewPanel}>
          <h4>네이버 본문 서식 미리보기</h4>
          <p className={styles.hint}>소제목·강조·문단 간격을 반영했습니다. 아래 버튼으로 서식을 포함해 복사하세요.</p>
          <div className={styles.naverPreview} role="region" aria-label="네이버 본문 서식 미리보기"
            dangerouslySetInnerHTML={{__html:naverRich.html}}/>
        </div>}
        <div className={styles.actions}>
          <button type="button" className={styles.otherButton} disabled={!articleTitle.trim()} onClick={()=>void copy(articleTitle,"제목")}>제목 복사</button>
          <button type="button" className={styles.mainButton} disabled={!articleBody.trim()} onClick={()=>void copyNaverFormatted()}>네이버 서식 복사</button>
          <button type="button" className={styles.otherButton} disabled={!articleBody.trim()} onClick={()=>void copy(articleBody,"본문")}>본문 복사 (일반 텍스트)</button>
          <button type="button" className={styles.otherButton} disabled={!articleBody.trim()} onClick={()=>void copy([articleTitle,articleBody].filter(Boolean).join("\n\n"),"제목+본문")}>전체 복사</button>
        </div>
        <p className={styles.hint}>네이버 스마트에디터 ONE은 외부 HTML 서식을 일부 제거하거나 변경할 수 있습니다. 네이버에 붙여넣은 뒤 결과를 확인해 주세요.</p>
      </div>}
    </section>}
    <p className={styles.disclaimer}>작업은 이 브라우저에 글감별로 따로 보관됩니다. 원문·실거래 검증 및 네이버 발행은 자동으로 실행되지 않습니다.</p>
  </section>;
}
