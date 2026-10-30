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
import {buildJibssukNaverRichArticle} from "../../lib/jibssuk-naver-rich-export.mjs";
import {buildJibssukApartmentImagePrompts} from "../../lib/jibssuk-apartment-image-prompts.mjs";
import JibssukAutoNaverMap from "./JibssukAutoNaverMap";
import type {JibssukNaverTableGroup} from "../../lib/jibssuk-naver-rich-export.mjs";
import styles from "./workflow.module.css";

const STORAGE_PREFIX="content-maker-jibssuk-inline-workflow-v1:";
function koreanDay(){
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

const TABLE_IMAGE_ROWS=12;

// Each download contains a complete column-group and a bounded set of rows.
// No cell values are shortened or omitted: wrap and grow the canvas instead.
function wrapCanvasCell(ctx:CanvasRenderingContext2D,value:string,width:number){
  const lines:string[]=[];let line="";
  for(const char of Array.from(value)){
    if(line && ctx.measureText(line+char).width>width){lines.push(line);line="";}
    line+=char;
  }
  lines.push(line);
  return lines;
}
async function saveNaverTablePng(table:JibssukNaverTableGroup,page:number){
  const rows=table.rows.slice(page*TABLE_IMAGE_ROWS,(page+1)*TABLE_IMAGE_ROWS);
  if(!rows.length)throw new Error("표에 저장할 행이 없습니다.");
  const width=1600,padding=72,inner=width-padding*2;
  const cols=table.headers.length,colWidth=inner/cols;
  const canvas=document.createElement("canvas");
  canvas.width=width;
  const context=canvas.getContext("2d");
  if(!context)throw new Error("이미지 캔버스를 열 수 없습니다.");
  const ctx:CanvasRenderingContext2D=context;
  ctx.font="bold 32px Malgun Gothic, sans-serif";
  const headings=table.headers.map(s=>wrapCanvasCell(ctx,s,colWidth-36));
  ctx.font="30px Malgun Gothic, sans-serif";
  const wrapped=rows.map(row=>row.map(v=>wrapCanvasCell(ctx,v,colWidth-36)));
  const headHeight=Math.max(76,...headings.map(w=>w.length*42+28));
  const rowHeights=wrapped.map(row=>Math.max(66,...row.map(w=>w.length*42+24)));
  const contentHeight=185+headHeight+rowHeights.reduce((a,b)=>a+b,0)+95;
  canvas.height=Math.max(900,contentHeight);
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,canvas.height);
  ctx.fillStyle="#203b57";ctx.font="bold 46px Malgun Gothic, sans-serif";
  const label="비교표 "+table.tableNumber+(table.partCount>1?" · "+table.partNumber+"/"+table.partCount:"")+
    (table.rows.length>TABLE_IMAGE_ROWS?" · "+(page+1)+"/"+Math.ceil(table.rows.length/TABLE_IMAGE_ROWS)+"페이지":"");
  ctx.fillText(label,padding,106);
  let y=180;
  function drawRow(values:string[][],height:number,header:boolean,rowNo:number){
    const top=y;
    ctx.fillStyle=header?"#edf3f9":rowNo%2?"#f9fbfd":"#ffffff";
    ctx.fillRect(padding,top,inner,height);
    ctx.strokeStyle="#cddbe8";ctx.lineWidth=2;
    for(let i=0;i<=cols;i++){
      const x=padding+i*colWidth;
      ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+height);ctx.stroke();
    }
    ctx.beginPath();ctx.moveTo(padding,top);ctx.lineTo(padding+inner,top);ctx.stroke();
    ctx.beginPath();ctx.moveTo(padding,top+height);ctx.lineTo(padding+inner,top+height);ctx.stroke();
    ctx.font=(header?"bold ":"")+"30px Malgun Gothic, sans-serif";
    ctx.fillStyle="#203b57";
    values.forEach((lines,i)=>lines.forEach((line,j)=>ctx.fillText(line,padding+i*colWidth+18,top+43+j*42)));
    y+=height;
  }
  drawRow(headings,headHeight,true,0);
  wrapped.forEach((row,i)=>drawRow(row,rowHeights[i],false,i));
  const blob=await new Promise<Blob>((resolve,reject)=>{
    canvas.toBlob(v=>v?resolve(v):reject(new Error("PNG 생성에 실패했습니다.")),"image/png");
  });
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const suffix=table.partCount>1?"-part"+table.partNumber:"";
  a.href=url;
  a.download="jibssuk-table-"+table.tableNumber+suffix+"-page"+(page+1)+".png";
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),5000);
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
  const [imageMapEvidence,setImageMapEvidence]=useState("");
  const [imageAutoMapEvidence,setImageAutoMapEvidence]=useState("");
  const [imagePriceEvidence,setImagePriceEvidence]=useState("");
  const [imageLifestyleEvidence,setImageLifestyleEvidence]=useState("");
  const [imageExtraEvidence,setImageExtraEvidence]=useState("");
  const [imageExtraEnabled,setImageExtraEnabled]=useState(false);
  const [status,setStatus]=useState("");
  const report=useMemo(()=>parseResearchReport(acceptedRaw),[acceptedRaw]);
  const naverRich=useMemo(()=>buildJibssukNaverRichArticle(articleTitle,articleBody),[articleTitle,articleBody]);
  const imageBriefs=useMemo(()=>buildJibssukApartmentImagePrompts({
    title:articleTitle,body:articleBody,
    mapEvidence:imageMapEvidence,autoMapEvidence:imageAutoMapEvidence,priceEvidence:imagePriceEvidence,
    lifestyleEvidence:imageLifestyleEvidence,extraEvidence:imageExtraEvidence,
    includeExtra:imageExtraEnabled
  }),[articleTitle,articleBody,imageMapEvidence,imageAutoMapEvidence,imagePriceEvidence,imageLifestyleEvidence,imageExtraEvidence,imageExtraEnabled]);
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
          setImageMapEvidence(text(data.imageMapEvidence,15000));
          setImagePriceEvidence(text(data.imagePriceEvidence,15000));
          setImageLifestyleEvidence(text(data.imageLifestyleEvidence,15000));
          setImageExtraEvidence(text(data.imageExtraEvidence,15000));
          setImageExtraEnabled(data.imageExtraEnabled===true);
        }
      }
    }catch{setStatus("저장된 작업을 불러오지 못했습니다. 기존 저장 데이터는 변경하지 않았습니다.");}
    setHydrated(true);
  },[storageKey]);

  useEffect(()=>{
    if(!hydrated)return;
    try{
      localStorage.setItem(storageKey,JSON.stringify({
        version:1,topic:item.title,acceptedRaw,reportPaste,approved,angleId,finalPaste,articleTitle,articleBody,
        imageMapEvidence,imagePriceEvidence,imageLifestyleEvidence,imageExtraEvidence,imageExtraEnabled
      }));
    }catch{setStatus("이 브라우저에 작업을 저장하지 못했습니다. 저장 공간을 확인해 주세요.");}
  },[hydrated,storageKey,item.title,acceptedRaw,reportPaste,approved,angleId,finalPaste,articleTitle,articleBody,
    imageMapEvidence,imagePriceEvidence,imageLifestyleEvidence,imageExtraEvidence,imageExtraEnabled]);

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
  async function copyNaverFormatted(includeTitle:boolean){
    const plain=includeTitle?naverRich.plain:naverRich.bodyPlain;
    const html=includeTitle?naverRich.html:naverRich.bodyHtml;
    if(!plain)return;
    try{
      if(typeof ClipboardItem==="undefined" || !navigator.clipboard?.write)throw new Error("HTML clipboard unavailable");
      await navigator.clipboard.write([new ClipboardItem({
        "text/html":new Blob([html],{type:"text/html"}),
        "text/plain":new Blob([plain],{type:"text/plain"})
      })]);
      setStatus((includeTitle?"제목과 본문":"본문")+" 서식 복사 완료 · 네이버에서 Ctrl+V 해주세요. 실제 붙여넣기 서식은 네이버 편집기에서 확인해 주세요.");
    }catch{
      try{
        await navigator.clipboard.writeText(plain);
        setStatus("서식 복사가 제한되어 네이버용 문단 간격 텍스트로 복사했습니다.");
      }catch{
        setStatus("클립보드 복사가 차단됐습니다. 본문 편집 칸에서 직접 복사해 주세요.");
      }
    }
  }
  async function downloadTableImage(table:JibssukNaverTableGroup,page:number){
    try{
      await saveNaverTablePng(table,page);
      setStatus("표 PNG 이미지를 저장했습니다. 네이버에서는 사진으로 별도 등록하세요. 원고의 표 데이터는 그대로 유지됩니다.");
    }catch(error){
      setStatus(error instanceof Error?error.message:"표 이미지 저장에 실패했습니다.");
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
    <div className={styles.progress}><span>1 · 결과 가져오기</span><span>2 · 관점 선택</span><span>3 · 원고 작성</span><span>4 · 이미지 요청서</span></div>

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
          <h4>네이버 붙여넣기 미리보기</h4>
          <p className={styles.hint}>기존 Paramma·아파트 대량발행과 동일하게 제목 32 · 소제목 30 · 강조 19 · 본문 15 · 문단 사이 한 줄 띄기를 적용합니다. {naverRich.blockCount}개 블록 자동 인식.</p>
          <div className={styles.naverPreview} role="region" aria-label="네이버 붙여넣기 미리보기"
            dangerouslySetInnerHTML={{__html:naverRich.html}}/>
          {naverRich.tables.length>0&&<div className={styles.tableFallback}>
            <p><b>비교표 {new Set(naverRich.tables.map(t=>t.tableNumber)).size}개 감지</b> · 3열 이하는 비교표로 유지하고 넓은 표는 열을 나눠 표시합니다. 모든 원본 행과 값은 유지합니다.</p>
            <details>
              <summary>네이버에서 표가 깨질 때 · 표 PNG 이미지 저장 (선택)</summary>
              <p>이미지로 바꾸어도 표 데이터는 본문에 남습니다. PNG를 선택해 저장하고 네이버에 사진으로 등록하세요.</p>
              <div className={styles.tableImageButtons}>
                {naverRich.tables.flatMap((table,i)=>Array.from({length:Math.ceil(table.rows.length/TABLE_IMAGE_ROWS)},(_,page)=>(
                  <button key={i+"-"+page} type="button" className={styles.otherButton}
                    onClick={()=>void downloadTableImage(table,page)}>
                    표 {table.tableNumber}{table.partCount>1?"-"+table.partNumber:""}{table.rows.length>TABLE_IMAGE_ROWS?" · "+(page+1)+"쪽":""} PNG 저장
                  </button>
                )))}
              </div>
            </details>
          </div>}
        </div>}
        <div className={styles.actions}>
          <button type="button" className={styles.otherButton} disabled={!articleTitle.trim()} onClick={()=>void copy(articleTitle,"제목")}>제목 복사</button>
          <button type="button" className={styles.mainButton} disabled={!naverRich.bodyPlain} onClick={()=>void copyNaverFormatted(true)}>네이버 전체 서식 복사 (제목 포함)</button>
          <button type="button" className={styles.otherButton} disabled={!naverRich.bodyPlain} onClick={()=>void copyNaverFormatted(false)}>본문만 서식 복사</button>
          <button type="button" className={styles.otherButton} disabled={!articleBody.trim()} onClick={()=>void copy(articleBody,"본문")}>본문 복사 (일반 텍스트)</button>
          <button type="button" className={styles.otherButton} disabled={!articleBody.trim()} onClick={()=>void copy([articleTitle,articleBody].filter(Boolean).join("\n\n"),"제목+본문")}>전체 복사</button>
        </div>
        <p className={styles.hint}>네이버 스마트에디터 ONE은 외부 HTML 서식을 일부 제거하거나 변경할 수 있습니다. 네이버에 붙여넣은 뒤 결과를 확인해 주세요.</p>
      </div>}
    </section>}
    {(articleTitle||articleBody)&&<section className={styles.step} aria-label="집값쓱 아파트 개별 이미지 요청서">
      <h3>4. 아파트 글 · 이미지 요청서</h3>
      <p><b>대표 썸네일 + 본문 3장</b>이 기본입니다. 필요한 경우에만 추가 04번을 사용합니다.
        모든 이미지 규격은 <b>1600×900 (16:9)</b>이고, 각 장면의 목적과 필요한 근거 자료가 다릅니다.</p>
      <p className={styles.hint}>이 기능은 아파트 단지 중심 글 전용입니다. 일반 뉴스·생활정보 글에는 강제로 적용하지 마세요.
        입지 지도는 기존 네이버지도 API로 자동 준비할 수 있습니다. 지도·조감도·사진 파일은 ChatGPT에 별도로 첨부해야 합니다.</p>
      <JibssukAutoNaverMap
        onReady={map=>{
          setImageAutoMapEvidence([
            "지도 출처: NAVER Cloud Static Map API",
            "선택 단지: "+map.complexName,
            "선택 지역: "+map.regionName,
            "단지 ID: "+map.complexId,
            map.stationName?"지도에 표시된 검색 역: "+map.stationName:"",
            map.straightDistanceMeters!=null?"단지-역 직선거리(도보거리 아님): "+map.straightDistanceMeters+"m":"",
            "지도에는 실제 보행 경로·도보 시간 표시 없음. PNG 파일은 별도로 ChatGPT에 첨부할 것."
          ].filter(Boolean).join("\n"));
        }}
        onClear={()=>setImageAutoMapEvidence("")}/>
      <details className={styles.details}>
        <summary>수동 지도 메모·실거래·조감도 자료 입력 (선택 · 글감별 저장)</summary>
        <p className={styles.hint}>원자료를 직접 확인한 뒤 필요한 만큼만 입력하세요. 입력한 문구는 자동 검증되지 않으며, 첨부 사진 파일은 이 입력칸에서 전송되지 않습니다.</p>
        <label htmlFor="image-evidence-map">01 · 네이버지도 직접 캡처·경로 보충 메모 (자동 지도와 별도)</label>
        <textarea id="image-evidence-map" rows={3} maxLength={15000} value={imageMapEvidence}
          onChange={e=>setImageMapEvidence(e.target.value)}
          placeholder="단지 주소·지도 출처·캡처 날짜·지도에 실제 표시된 역/목적지/도보 경로 등. 지도 캡처는 ChatGPT에서 따로 첨부"/>
        <label htmlFor="image-evidence-price">02 · 실거래·월별 시세 원본</label>
        <textarea id="image-evidence-price" rows={5} maxLength={15000} value={imagePriceEvidence}
          onChange={e=>setImagePriceEvidence(e.target.value)}
          placeholder={"계약일 | 전용면적 | 층 | 거래유형 | 금액 | 출처/기준일\n동일 면적 12개월 월별 자료가 있으면 월별 기준값·거래 건수도 첨부"}/>
        <label htmlFor="image-evidence-life">03 · 공식 조감도·실제 생활환경 자료</label>
        <textarea id="image-evidence-life" rows={3} maxLength={15000} value={imageLifestyleEvidence}
          onChange={e=>setImageLifestyleEvidence(e.target.value)}
          placeholder="공식 조감도/실제 사진의 출처·촬영 시점·확인된 주변 시설·사용권 메모. 이미지 파일은 별도 첨부"/>
      </details>
      <button type="button" className={styles.imageExtraToggle} aria-pressed={imageExtraEnabled}
        onClick={()=>setImageExtraEnabled(value=>!value)}>
        {imageExtraEnabled?"04 · 추가 발견 이미지 사용 중 (누르면 제외)":"04 · 추가 발견 이미지 사용하기 (선택)"}
      </button>
      {imageExtraEnabled&&<div>
        <label htmlFor="image-evidence-extra">04 · 추가 발견의 확인된 사실·근거</label>
        <textarea id="image-evidence-extra" rows={3} maxLength={15000} value={imageExtraEvidence}
          onChange={e=>setImageExtraEvidence(e.target.value)}
          placeholder="앞의 3장과 겹치지 않는 핵심 발견, 관련 사실·날짜·숫자·원문 출처"/>
      </div>}
      <div className={styles.imageBriefList}>
        {imageBriefs.map(brief=><div className={styles.imageBriefCard} key={brief.slot}>
          <div className={styles.imageBriefHead}>
            <strong>{brief.slot} · {brief.label}</strong>
            <span>1600×900</span>
          </div>
          <p>{brief.purpose}</p>
          {brief.slot!=="00"&&<p className={styles.hint}>
            {brief.evidenceEntered?"지도/API 또는 근거 메모 있음 · 원본 이미지 첨부 필요":"원본 자료 미입력 · 요청서에서 자료를 먼저 요구함"}
          </p>}
          <p className={styles.hint}>{brief.sourceHint}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.mainButton}
              onClick={()=>void copy(brief.prompt,"이미지 "+brief.slot+" 요청서")}>이미지 {brief.slot} 요청서 복사</button>
          </div>
          <details className={styles.details}>
            <summary>이미지 {brief.slot} 요청서 전체 보기</summary>
            <textarea readOnly rows={11} value={brief.prompt} aria-label={"이미지 "+brief.slot+" 요청서 미리보기"}/>
          </details>
        </div>)}
      </div>
    </section>}
    <p className={styles.disclaimer}>작업은 이 브라우저에 글감별로 따로 보관됩니다. 원문·실거래 검증 및 네이버 발행은 자동으로 실행되지 않습니다.</p>
  </section>;
}
