"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {ensureAnonymousSession} from "@/lib/supabase-browser";
import styles from "./page.module.css";
import {
 STORAGE_KEY,CATEGORIES,STATUS,STATUS_LABEL,PROVIDERS,IMAGE_SLOTS,
 createExperiment,buildCommonQuestion,isLegacyCommonQuestion,parseBulkTopics,isDuplicateTopic,buildIdeasPrompt,buildAnalysisPrompt,
 buildArticlePrompt,buildArticleRepairPrompt,buildHeroPrompt,buildInsightPrompt,responsesReady,parseArticle,
 assembleArticle,validPublishedUrl,relatedProjects,
 evidenceSignature,articleSignature,analysisIsFresh,articleIsFresh,imageSourceSignature,imageIsFresh
} from "@/lib/ai-three-atlas-v3.mjs";
import type {AtlasProject,Provider,ImageSlot,Status} from "@/lib/ai-three-atlas-v3.mjs";

type Stage="topics"|"collect"|"analysis"|"publish";
const STAGES: Array<{id:Stage;name:string;desc:string}>=[
 {id:"topics",name:"01 · 주제 보관함",desc:"중복 없는 발행 리스트"},
 {id:"collect",name:"02 · 답변 수집",desc:"공통 질문·원문·AI 이미지"},
 {id:"analysis",name:"03 · GPT 종합 분석",desc:"세 원문을 그대로 비교"},
 {id:"publish",name:"04 · 글 조립·발행",desc:"목차·이미지·내부 링크"}
];
const DISPLAY:Record<Provider,string>={chatgpt:"ChatGPT",claude:"Claude",gemini:"Gemini"};
const AI_SITES:Record<Provider,string>={chatgpt:"https://chatgpt.com/",claude:"https://claude.ai/",gemini:"https://gemini.google.com/app"};
function todayLocal() {
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function isProject(v:unknown):v is AtlasProject {
 if(!v||typeof v!=="object")return false;
 const item=v as Partial<AtlasProject>;
 return typeof item.id==="string"&&typeof item.topic==="string"&&typeof item.question==="string"
  &&!!item.responses&&typeof item.responses==="object"
  &&!!item.images&&typeof item.images==="object";
}
function normalizeProjects(input:unknown):AtlasProject[] {
 if(!Array.isArray(input))return [];
 const unique=new Set<string>();
 return input.filter(isProject).filter(p=>{if(unique.has(p.id))return false;unique.add(p.id);return true;}).map(p=>({
  ...p,category:typeof p.category==="string"?p.category:CATEGORIES[0],
  status:STATUS.includes(p.status)?p.status:"idea",
  notes:typeof p.notes==="string"?p.notes:"",
  analysis:typeof p.analysis==="string"?p.analysis:"",
  articleRaw:typeof p.articleRaw==="string"?p.articleRaw:"",
  analysisSignature:typeof p.analysisSignature==="string"?p.analysisSignature:"",
  articleSignature:typeof p.articleSignature==="string"?p.articleSignature:"",
  imageSourceSigs:p.imageSourceSigs&&typeof p.imageSourceSigs==="object"?p.imageSourceSigs:{},
  publishedUrl:typeof p.publishedUrl==="string"?p.publishedUrl:"",
  date:typeof p.date==="string"?p.date:todayLocal(),
  updatedAt:typeof p.updatedAt==="string"?p.updatedAt:todayLocal(),
  responses:{chatgpt:String(p.responses?.chatgpt||""),claude:String(p.responses?.claude||""),gemini:String(p.responses?.gemini||"")},
  images:{hero:String(p.images?.hero||""),chatgpt:String(p.images?.chatgpt||""),claude:String(p.images?.claude||""),gemini:String(p.images?.gemini||""),insight:String(p.images?.insight||"")}
 }));
}
function downloadJson(data:object,filename:string) {
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function writeClipboard(text:string) {
 await navigator.clipboard.writeText(text);
}

export default function AiThreeComparisonStudioV3() {
 const [ready,setReady]=useState(false);
 const [projects,setProjects]=useState<AtlasProject[]>([]);
 const [selectedId,setSelectedId]=useState("");
 const [stage,setStage]=useState<Stage>("topics");
 const [topicInput,setTopicInput]=useState("");
 const [category,setCategory]=useState(CATEGORIES[0]);
 const [search,setSearch]=useState("");
 const [statusFilter,setStatusFilter]=useState("all");
 const [message,setMessage]=useState("");
 const [uploading,setUploading]=useState<ImageSlot|null>(null);
 const [registerOpen,setRegisterOpen]=useState(false);
 const [importTitle,setImportTitle]=useState("");
 const [importUrl,setImportUrl]=useState("");
 const [importCategory,setImportCategory]=useState(CATEGORIES[0]);
 const [showPreview,setShowPreview]=useState(true);
 const importRef=useRef<HTMLInputElement>(null);
 const storageSafe=useRef(true);

 useEffect(()=>{
  try{
   const raw=localStorage.getItem(STORAGE_KEY);
   if(raw){
    const state=JSON.parse(raw);
    if(state?.version!==3||!Array.isArray(state?.projects))throw Error("Unknown V3 storage format");
    const items=normalizeProjects(state.projects);
    if(items.length!==state.projects.length)throw Error("Invalid V3 project data");
    setProjects(items);if(items.length)setSelectedId(items[0].id);
   }
  }catch{storageSafe.current=false;setMessage("저장 자료가 손상되어 자동 저장을 중단했습니다. JSON 백업을 병합해 복구하세요. 기존 저장값은 덮어쓰지 않습니다.");}
  setReady(true);
 },[]);
 useEffect(()=>{
  if(!ready||!storageSafe.current)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:3,projects}));}
  catch{setMessage("브라우저 저장 용량이 부족합니다. JSON 백업을 내려받은 다음 오래된 초안을 정리하세요.");}
 },[projects,ready]);

 const selected=projects.find(p=>p.id===selectedId)||null;
 const sorted=useMemo(()=>projects
  .filter(p=>statusFilter==="all"||p.status===statusFilter)
  .filter(p=>!search||((p.topic+" "+p.category).toLowerCase().includes(search.toLowerCase())))
  .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)),[projects,statusFilter,search]);
 const counts=useMemo(()=>({
  total:projects.length,complete:projects.filter(p=>p.status==="published").length,
  active:projects.filter(p=>p.status!=="published"&&p.status!=="idea").length
 }),[projects]);
 const preview=selected?assembleArticle(selected,projects,true):null;
 const liveResult=selected?assembleArticle(selected,projects,false):null;
 const parsed=selected?parseArticle(selected.articleRaw):null;
 const readyImages=selected?IMAGE_SLOTS.filter(s=>imageIsFresh(selected,s.id)).length:0;
 const readyToCopy=!!selected&&!!parsed?.valid&&analysisIsFresh(selected)&&articleIsFresh(selected)&&readyImages===IMAGE_SLOTS.length&&liveResult?.errors.length===0;
 const related=selected?relatedProjects(selected,projects):[];
 function updateCommonQuestion() {
  if(!selected)return;
  if(selected.status==="published"){setMessage("이미 발행한 실험의 공통 질문은 변경할 수 없습니다.");return;}
  const next=buildCommonQuestion(selected.topic,selected.date);
  if(selected.question===next){setMessage("이미 글과 이미지 분리 규칙이 적용된 질문입니다.");return;}
  const hasEvidence=PROVIDERS.some(id=>!!selected.responses[id]?.trim()||!!selected.images[id]) ||
   !!selected.analysis.trim()||!!selected.articleRaw.trim()||!!selected.images.hero||!!selected.images.insight;
  if(hasEvidence&&!window.confirm("이미 수집한 원문·이미지가 있습니다. 질문을 변경하면 기존 자료와 다른 실험이 되므로 세 AI에게 동일한 새 질문으로 다시 실험해야 합니다. 저장된 답변은 삭제하지 않지만 이전 분석·이미지·최종 글은 재검증 전 발행할 수 없습니다. 변경할까요?"))return;
  patchProject(selected.id,{question:next});
  setMessage("새 공통 질문 규칙 적용 완료. 이미지와 글을 분리하되 같은 질문을 3사에 한 번씩 입력하세요.");
 }
 function patchProject(id:string,patch:Partial<AtlasProject>) {
  setProjects(prev=>prev.map(p=>p.id===id?{...p,...patch,updatedAt:todayLocal()}:p));
 }
 function move(id:string,next:Stage){
  setSelectedId(id);setStage(next);setMessage("");
 }
 function addTopics(){
  const parsed=parseBulkTopics(topicInput,projects);
  if(!parsed.items.length){setMessage("추가할 새 주제가 없습니다. 기존 목록과 중복되는지 확인하세요.");return;}
  const newItems=parsed.items.map(topic=>createExperiment(topic,category,todayLocal()));
  setProjects(prev=>[...newItems,...prev]);
  setSelectedId(newItems[0].id);setTopicInput("");
  setMessage("주제 "+newItems.length+"개 추가 · 중복 "+parsed.skipped.length+"개 제외. 각 주제는 고유 ID로 독립 저장됩니다.");
 }
 async function copy(text:string,what:string) {
  try{await writeClipboard(text);setMessage(what+" 복사 완료 · ChatGPT 또는 각 AI 채팅에 붙여넣으세요.");}
  catch{setMessage("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인하세요.");}
 }
 function copyFactory(create:()=>string,name:string) {
  try{void copy(create(),name);}catch(error){setMessage(error instanceof Error?error.message:"필수 자료를 먼저 입력하세요.");}
 }
 function markPublished() {
  if(!selected)return;
  if(!readyToCopy){setMessage("완성 글 검증과 이미지 5장 연결을 마친 후 발행 완료로 표시하세요.");return;}
  if(!validPublishedUrl(selected.publishedUrl)){setMessage("실제 공개된 Blogger URL을 먼저 입력하세요. 예정 주소로 발행 처리하지 않습니다.");return;}
  patchProject(selected.id,{status:"published"});
  setMessage("발행 완료로 기록했습니다. 이후 새 글이 늘어나면 관련 글 목록이 갱신됩니다. 이미 발행한 글 본문은 자동 수정되지 않습니다.");
 }
 function registerPublished() {
  const title=importTitle.trim(),url=importUrl.trim();
  if(!title||!validPublishedUrl(url)){setMessage("기존 글 제목과 실제 AI Price Atlas Blogger 게시물 URL(.html)을 입력하세요.");return;}
  if(isDuplicateTopic(title,projects)){setMessage("이미 유사한 주제가 등록되어 있습니다.");return;}
  const row=createExperiment(title,importCategory,todayLocal());
  setProjects(prev=>[{...row,status:"published",publishedUrl:url},...prev]);
  setSelectedId(row.id);setRegisterOpen(false);setImportTitle("");setImportUrl("");
  setMessage("기존 글을 내부 링크 후보로 등록했습니다. 원문이 없는 기존 글은 새 실험으로 재사용하지 마세요.");
 }
 async function importBackup(file:File|null){
  if(!file)return;
  try{
   const data=JSON.parse(await file.text());
   if(data?.version!==3||!Array.isArray(data.projects))throw Error("V3 형식의 백업만 가져올 수 있습니다.");
   const imported=normalizeProjects(data.projects);
   if(!imported.length||imported.length!==data.projects.length)throw Error("유효한 주제가 있는 V3 백업만 복원할 수 있습니다.");
   storageSafe.current=true;
   setProjects(prev=>{
    const ids=new Set(prev.map(p=>p.id));
    const next=imported.filter(p=>!ids.has(p.id));
    return [...next,...prev];
   });
   setMessage("백업을 확인했습니다. 기존 같은 ID는 보호하고 새 자료만 병합합니다.");
  }catch(e){setMessage(e instanceof Error?e.message:"백업 파일을 읽지 못했습니다.");}
 }
 async function uploadImage(slot:ImageSlot,file:File|null){
  if(!file||!selected)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setMessage("JPG·PNG·WebP만 업로드할 수 있습니다.");return;}
  if(file.size>6*1024*1024){setMessage("이미지는 6MB 이하로 줄여 업로드해 주세요. 긴 원본 답변은 그대로 유지됩니다.");return;}
  setUploading(slot);
  try{
   const {supabase,session}=await ensureAnonymousSession();
   const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
   const safe=selected.id.replace(/[^a-z0-9-]/gi,"-");
   const path=session.user.id+"/ai-price-atlas-v3/"+safe+"/"+slot+"-"+Date.now()+"."+ext;
   const {error}=await supabase.storage.from("content-maker-assets").upload(path,file,{
    contentType:file.type,cacheControl:"31536000",upsert:false
   });
   if(error)throw error;
   const url=supabase.storage.from("content-maker-assets").getPublicUrl(path).data.publicUrl;
   patchProject(selected.id,{images:{...selected.images,[slot]:url},imageSourceSigs:{...selected.imageSourceSigs,[slot]:imageSourceSignature(selected,slot)}});
   setMessage("이미지 "+slot+" 저장 완료. 공개 URL을 본문에 연결합니다.");
  }catch(e){setMessage("업로드 실패: "+(e instanceof Error?e.message:"스토리지 또는 권한을 확인하세요."));}
  finally{setUploading(null);}
 }
 function changeImageUrl(slot:ImageSlot,url:string){
  if(!selected)return;
  patchProject(selected.id,{images:{...selected.images,[slot]:url},imageSourceSigs:{...selected.imageSourceSigs,[slot]:url?imageSourceSignature(selected,slot):""}});
 }
 function setReply(provider:Provider,value:string){
  if(!selected)return;
  patchProject(selected.id,{responses:{...selected.responses,[provider]:value},status:selected.status==="idea"?"collecting":selected.status});
 }
 function setStatus(value:Status){
  if(!selected)return;
  if(value==="published"){markPublished();return;}
  patchProject(selected.id,{status:value});
 }
 function deleteProject(){
  if(!selected||!window.confirm("현재 항목을 V3 목록에서 삭제할까요? 원문과 이미지 주소 기록이 함께 제거됩니다. 먼저 JSON 백업을 권장합니다."))return;
  const remaining=projects.filter(p=>p.id!==selected.id);
  setProjects(remaining);setSelectedId(remaining[0]?.id||"");setStage("topics");setMessage("선택한 V3 항목을 삭제했습니다. 다른 제작실 기록에는 영향이 없습니다.");
 }
 if(!ready)return <main className={styles.shell}><p>로컬 발행 목록을 확인하고 있습니다.</p></main>;
 return <main className={styles.shell}>
  <header className={styles.header}>
   <div>
    <a className={styles.brand} href="/"><span>AI PRICE ATLAS</span><small>THREE-AI COMPARISON STUDIO / V3</small></a>
    <h1>AI 3사 비교 전용 제작실</h1>
    <p>궁금한 것을 직접 물어보고, 실제 답변을 비교해, 나만의 관찰을 담은 글로 발행하세요.</p>
   </div>
   <div className={styles.headActions}>
    <a href="https://aipriceatlas.blogspot.com/" target="_blank" rel="noreferrer">블로그 보기 ↗</a>
    <a href="/google-blog-schedule">기존 제작실 ↗</a>
   </div>
  </header>
  <div className={styles.stats}>
   <div><b>{counts.total}</b><span>총 주제</span></div>
   <div><b>{counts.active}</b><span>제작 진행</span></div>
   <div><b>{counts.complete}</b><span>발행 완료</span></div>
   <div><b>3 → 1</b><span>세 AI 답변 · GPT 종합</span></div>
  </div>
  {message&&<div className={styles.notice} role="status"><span>{message}</span><button type="button" onClick={()=>setMessage("")}>닫기 ×</button></div>}
  <nav className={styles.stepNav} aria-label="제작 단계">
   {STAGES.map(step=><button type="button" key={step.id} onClick={()=>setStage(step.id)}
    className={stage===step.id?styles.active:""}>
    <strong>{step.name}</strong><small>{step.desc}</small>
   </button>)}
  </nav>
  <div className={styles.grid}>
   <aside className={styles.sidebar}>
    <div className={styles.sideHead}><b>발행 주제</b><span>{sorted.length}개</span></div>
    <input aria-label="주제 검색" placeholder="제목·카테고리 검색" value={search} onChange={e=>setSearch(e.target.value)}/>
    <select aria-label="상태 필터" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
     <option value="all">모든 상태</option>
     {STATUS.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
    <div className={styles.topicList}>
     {sorted.map(p=><button type="button" key={p.id} className={p.id===selected?.id?styles.selectedTopic:styles.topic}
      onClick={()=>{setSelectedId(p.id);setMessage("");if(stage==="topics")setStage("collect");}}>
      <b>{p.topic}</b>
      <small>{p.category}</small><span>{STATUS_LABEL[p.status]} · {p.date}</span>
     </button>)}
     {!sorted.length&&<p className={styles.muted}>표시할 주제가 없습니다. 새 주제를 추가하세요.</p>}
    </div>
    <div className={styles.backup}>
     <button type="button" onClick={()=>downloadJson({version:3,exportedAt:new Date().toISOString(),projects},"ai-price-atlas-v3-backup.json")}>JSON 전체 백업 ↓</button>
     <button type="button" onClick={()=>importRef.current?.click()}>백업 병합 ↑</button>
     <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={e=>{void importBackup(e.currentTarget.files?.[0]||null);e.currentTarget.value="";}}/>
     <small>V3 전용 로컬 저장. 기존 가격·아파트·Paramma 자료와 분리. 브라우저를 바꾸려면 백업을 옮기세요.</small>
    </div>
   </aside>
   <div className={styles.workspace}>
    {stage==="topics"&&<section className={styles.panel}>
     <div className={styles.sectionTitle}><span>STEP 01</span><h2>주제 보관함 · 한 번에 추가</h2><p>새 주제는 줄바꿈으로 입력하세요. 기존 주제와 중복되면 자동 제외합니다.</p></div>
     <label>카테고리
      <select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
     </label>
     <label>주제 한 줄에 하나씩
      <textarea rows={7} value={topicInput} placeholder={"가장 살기 좋은 나라는 어디일까?\nAI 3사가 추천하는 미래의 직업은?"} onChange={e=>setTopicInput(e.target.value)}/>
     </label>
     <div className={styles.actions}>
      <button className={styles.primary} type="button" onClick={addTopics} disabled={!topicInput.trim()}>중복 제거하고 주제 추가</button>
      <button type="button" onClick={()=>void copy(buildIdeasPrompt(projects),"새 주제 12개 요청서")}>GPT로 새 주제 12개 요청</button>
     </div>
     <div className={styles.rule}>
      <b>기존 발행 글도 연결 목록에 등록할 수 있어요.</b>
      <p>이미 Blogger에 공개한 AI 비교 글은 제목과 URL만 입력하면 새 글의 관련 실험 후보가 됩니다.</p>
      <button type="button" onClick={()=>setRegisterOpen(v=>!v)}>{registerOpen?"등록 접기":"기존 발행 글 등록하기"}</button>
      {registerOpen&&<div className={styles.register}>
       <label>기존 글 제목<input value={importTitle} onChange={e=>setImportTitle(e.target.value)}/></label>
       <label>실제 Blogger URL<input value={importUrl} onChange={e=>setImportUrl(e.target.value)} placeholder="https://aipriceatlas.blogspot.com/2026/10/example.html"/></label>
       <label>카테고리<select value={importCategory} onChange={e=>setImportCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
       <button type="button" className={styles.primary} onClick={registerPublished}>기존 발행 글 링크로 등록</button>
      </div>}
     </div>
    </section>}

    {stage==="collect"&&<section className={styles.panel}>
     {!selected?<NoSelection/>:<>
      <div className={styles.sectionTitle}><span>STEP 02</span><h2>공통 질문과 AI 3사 답변</h2><p>같은 질문을 세 AI에 각각 붙여넣고 답변과 원본 이미지를 저장하세요. 내용은 줄이거나 재작성하지 않습니다.</p></div>
      <ProjectTitle selected={selected}/>
      <label>공통 질문 (영어)
       <textarea rows={9} value={selected.question} onChange={e=>patchProject(selected.id,{question:e.target.value})}/>
      </label>
      <p className={styles.muted}>공통 질문 하나에 ‘일반 글 답변 + 글자 없는 이미지 1장’을 동시에 요청합니다. 세 AI 모두 정확히 같은 문구를 사용하세요.</p>
      {isLegacyCommonQuestion(selected.question,selected.topic,selected.date)&&<p className={styles.warning}>이 주제는 예전 질문 형식입니다. 아래 버튼으로 이미지·글 분리 규칙을 적용할 수 있습니다. 기존 답변은 자동 변경하지 않습니다.</p>}
      <div className={styles.actions}>
       <button type="button" className={styles.primary} disabled={!selected.question.trim()} onClick={()=>void copy(selected.question,"공통 질문")}>세 AI 공통 질문 복사</button>
       <button type="button" disabled={selected.status==="published"||selected.question===buildCommonQuestion(selected.topic,selected.date)} onClick={updateCommonQuestion}>이미지·글 분리 규칙 적용</button>
      </div>
      <label>실제 운영자 메모 (선택)
       <textarea rows={3} placeholder="실제로 궁금했던 이유나 개인적인 관찰이 있다면 적어주세요. 없는 경험을 생성하지 않습니다." value={selected.notes} onChange={e=>patchProject(selected.id,{notes:e.target.value})}/>
      </label>
      <div className={styles.responseGrid}>
       {PROVIDERS.map(id=><div className={styles.responseCard} key={id}>
        <div className={styles.responseHead}>
         <b>{DISPLAY[id]}</b>
         <div className={styles.responseHeadActions}>
          <span>{selected.responses[id]?.length||0}자</span>
          <a href={AI_SITES[id]} target="_blank" rel="noopener noreferrer" aria-label={DISPLAY[id]+" 공식 사이트 새 탭에서 열기"}>사이트 열기 ↗</a>
         </div>
        </div>
        <textarea aria-label={DISPLAY[id]+" 원문"} rows={12} value={selected.responses[id]} placeholder={DISPLAY[id]+"의 실제 답변을 처음부터 끝까지 그대로 붙여넣으세요."}
         onChange={e=>setReply(id,e.target.value)}/>
        <div className={styles.imageMini}>
         {/^https:\/\//.test(selected.images[id])?<img src={selected.images[id]} alt={DISPLAY[id]+" 생성 이미지"}/>:<span>원본 이미지 업로드 전</span>}
        </div>
        <label className={styles.fileLabel}>{uploading===id?"업로드 중…":"원본 이미지 업로드"}
         <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading!==null} onChange={e=>{void uploadImage(id,e.currentTarget.files?.[0]||null);e.currentTarget.value="";}}/>
        </label>
       </div>)}
      </div>
      <div className={styles.actions}>
       <button type="button" className={styles.primary} disabled={!responsesReady(selected)} onClick={()=>{setStatus("analyzing");setStage("analysis");}}>세 AI 답변 저장 → GPT 분석</button>
      </div>
     </>}
    </section>}

    {stage==="analysis"&&<section className={styles.panel}>
     {!selected?<NoSelection/>:<>
      <div className={styles.sectionTitle}><span>STEP 03</span><h2>ChatGPT 한 곳에서 종합 분석</h2>
       <p>사이트는 원문 그대로 질문서에 넣고 GPT가 중요한 쟁점을 직접 발견하도록 요청합니다. Claude·Gemini에 다시 묻지 않습니다.</p>
      </div>
      <ProjectTitle selected={selected}/>
      <div className={styles.progressLine}>{PROVIDERS.map(id=><span key={id}>{selected.responses[id]?.trim()?"✓":"○"} {DISPLAY[id]}</span>)}</div>
      <div className={styles.actions}>
       <button type="button" disabled={!responsesReady(selected)} className={styles.primary} onClick={()=>copyFactory(()=>buildAnalysisPrompt(selected),"GPT 종합 분석 요청서")}>세 원문 포함 분석 요청서 복사</button>
       <a className={styles.anchorButton} href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT 열기 ↗</a>
      </div>
      <label>GPT가 작성한 종합 분석 결과 전체
       <textarea rows={17} placeholder="ChatGPT에서 받은 종합 분석 결과를 이곳에 붙여넣어 저장하세요." value={selected.analysis} onChange={e=>patchProject(selected.id,{analysis:e.target.value,analysisSignature:e.target.value?evidenceSignature(selected):"",status:"analyzing"})}/>
      </label>
      <div className={styles.rule}><b>핵심 포인트 이미지도 여기서 시작합니다.</b><p>종합 분석에서 가장 중요한 발견 하나만 뽑아 1600×900 영문 이미지로 만듭니다. 이미지 요청서는 실제 원문과 분석을 함께 참조합니다.</p></div>
      <div className={styles.actions}>
       <button type="button" disabled={!analysisIsFresh(selected)} onClick={()=>copyFactory(()=>buildInsightPrompt(selected),"핵심 포인트 이미지 요청서")}>핵심 이미지 요청서 복사</button>
       <button type="button" className={styles.primary} disabled={!responsesReady(selected)||!analysisIsFresh(selected)} onClick={()=>{setStatus("drafting");setStage("publish");}}>블로그 최종 글 제작으로 →</button>
      </div>
     </>}
    </section>}

    {stage==="publish"&&<section className={styles.panel}>
     {!selected?<NoSelection/>:<>
      <div className={styles.sectionTitle}><span>STEP 04</span><h2>최종 글 · 목차 · 이미지 · 관련 글</h2>
       <p>원문과 클릭형 목차는 사이트가 자동 삽입합니다. GPT는 실제 영문 기사 문단을 작성하면 됩니다. 이미 발행된 글만 내부링크로 연결합니다.</p>
      </div>
      <ProjectTitle selected={selected}/>
      <div className={styles.rule}>
       <b>자동으로 삽입되는 글 구조</b>
       <p>1인칭 궁금증 → 클릭형 목차 → 각 AI 원문 + 생성 이미지 → GPT 분석과 운영자의 해석 → 핵심 카드 → 관련 AI 실험 링크</p>
      </div>
      <div className={styles.actions}>
       <button type="button" disabled={!responsesReady(selected)||!analysisIsFresh(selected)} className={styles.primary}
        onClick={()=>copyFactory(()=>buildArticlePrompt(selected),"최종 Blogger 글 요청서")}>최종 글 요청서 복사</button>
       <a className={styles.anchorButton} href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT 열기 ↗</a>
       <button type="button" onClick={()=>void copy(buildHeroPrompt(selected),"대표 썸네일 이미지 요청서")}>대표 썸네일 요청서</button>
        <button type="button" disabled={!selected.articleRaw.trim()||!parsed?.errors.length||!analysisIsFresh(selected)} onClick={()=>copyFactory(()=>buildArticleRepairPrompt(selected),"누락된 본문 재작성 요청서")}>오류 원고 재작성 요청서 복사</button>
      </div>
      <label>GPT에서 받은 최종 발행 글 전체 (마커 포함)
       <textarea rows={11} value={selected.articleRaw} onChange={e=>patchProject(selected.id,{articleRaw:e.target.value,articleSignature:e.target.value?articleSignature(selected):"",status:"drafting"})}
        placeholder={"[FINAL_TITLE]\n...\n[META_DESCRIPTION]\n...\n[SLUG]\n...\n[LABELS]\n...\n[BLOGGER_HTML]\n<h2>...</h2>\n[/BLOGGER_HTML]"}/>
      </label>
      <div className={parsed?.valid?styles.validationGood:styles.validation}>
       <b>{parsed?.valid?(parsed.navigationGenerated?"✓ HTML 검증 통과 · 클릭형 목차 자동 생성":"✓ 최종 HTML 형식·목차 검사 통과"):"최종 글 검사"}</b>
       {parsed?.errors.length?parsed.errors.map((err,i)=><p key={i}>• {err}</p>):<p>원고 마커, 목차 이동 링크, 원문/이미지 표지, HTML 안전 규칙을 확인합니다.</p>}
      </div>
      {parsed?.valid&&<div className={styles.metaGrid}>
       {[
        {label:"최종 제목",value:parsed.title},
        {label:"검색 설명",value:parsed.description},
        {label:"맞춤 퍼머링크",value:parsed.slug},
        {label:"Blogger 라벨",value:parsed.labels}
       ].map(field=><div key={field.label}>
        <small>{field.label}</small><strong>{field.value}</strong>
        <button type="button" onClick={()=>void copy(field.value,field.label)}>{field.label} 복사</button>
       </div>)}
      </div>}
      {selected.analysis.trim()&&!analysisIsFresh(selected)&&<p className={styles.warning}>⚠️ 질문 또는 AI 원문이 GPT 분석 후 바뀌었습니다. 종합 분석을 다시 받아 저장해야 합니다.</p>}
       {selected.articleRaw.trim()&&!articleIsFresh(selected)&&<p className={styles.warning}>⚠️ 글 생성 이후 근거가 바뀌었습니다. 최신 원문과 분석으로 최종 글을 다시 작성해야 합니다.</p>}
       <h3 className={styles.subhead}>이미지 5장 연결 <span>{readyImages}/5</span></h3>
      <div className={styles.uploadGrid}>
       {IMAGE_SLOTS.map(slot=><div className={styles.uploadCard} key={slot.id}>
        <b>{slot.label}</b><small>{slot.note}</small>
        <div className={styles.assetPreview}>{/^https:\/\//.test(selected.images[slot.id])?<img src={selected.images[slot.id]} alt={slot.label}/>:<span>이미지 없음</span>}</div>
        {!!selected.images[slot.id]&&!imageIsFresh(selected,slot.id)&&<small style={{color:"#9d5c2b"}}>원문/분석 변경됨 · 이미지 재확인 필요</small>}
         <label className={styles.fileLabel}>{uploading===slot.id?"업로드 중…":"파일 업로드"}
         <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading!==null} onChange={e=>{void uploadImage(slot.id,e.currentTarget.files?.[0]||null);e.currentTarget.value="";}}/>
        </label>
        <input aria-label={slot.label+" 이미지 URL"} placeholder="또는 HTTPS 이미지 URL" value={selected.images[slot.id]} onChange={e=>changeImageUrl(slot.id,e.target.value)} />
       </div>)}
      </div>
      <h3 className={styles.subhead}>자동 관련 글 연결 <span>{related.length}개 후보</span></h3>
      <div className={styles.related}>
       {related.length?related.map(p=><a target="_blank" rel="noreferrer" key={p.id} href={p.publishedUrl}>{p.topic} ↗</a>):
        <p>아직 연결할 발행 글이 없습니다. AI 3사 비교 글을 더 발행하면 자동으로 후보가 생깁니다.</p>}
       <small>본문 중간에 1개, 하단에 최대 3개를 중복 없이 삽입합니다. 실제 발행 URL이 기록된 글만 사용합니다.</small>
      </div>
      <div className={styles.actions}>
       <button type="button" disabled={!readyToCopy} className={styles.primary} onClick={()=>void copy(liveResult?.html||"","완성 Blogger HTML")}>완성 HTML 전체 복사</button>
       <button type="button" onClick={()=>setShowPreview(v=>!v)}>{showPreview?"미리보기 접기":"미리보기 보기"}</button>
       <a className={styles.anchorButton} href="https://www.blogger.com/" target="_blank" rel="noreferrer">Blogger 열기 ↗</a>
      </div>
      {!readyToCopy&&<p className={styles.warning}>최종 글·분석의 근거 일치와 이미지 5장 최신 연결이 완료되면 HTML 전체 복사 버튼이 활성화됩니다. {liveResult?.errors.join(" / ")}</p>}
      {showPreview&&<div className={styles.preview}>
       <div><b>Blogger HTML 미리보기</b><span>이미지·AI 원문·내부링크 자동 삽입</span></div>
       {parsed?.valid?<iframe title="AI 비교글 Blogger 미리보기" sandbox="" srcDoc={'<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#213045;margin:24px auto;max-width:790px;padding:0 18px;line-height:1.7}h2{font-size:25px}h3{font-size:20px}img{max-width:100%;height:auto}blockquote{white-space:normal;background:#f5f7fa;padding:14px;border-left:3px solid #99adbd;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd7e2;padding:7px}a{color:#16619a}</style></head><body>'+(preview?.html||"")+'</body></html>'}/>:
        <div className={styles.previewEmpty}>최종 글을 붙여넣으면 목차와 이미지가 조립된 모습이 보입니다.</div>}
      </div>}
      <div className={styles.publishRecord}>
       <h3>발행 완료 기록</h3>
       <p>Blogger에 직접 발행한 뒤 실제 공개 URL을 입력하세요. 초안 주소나 추정 주소는 완료 처리하지 않습니다.</p>
       <input aria-label="실제 발행 URL" value={selected.publishedUrl} placeholder="https://aipriceatlas.blogspot.com/2026/10/your-post.html" onChange={e=>patchProject(selected.id,{publishedUrl:e.target.value})}/>
       <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={!readyToCopy||!validPublishedUrl(selected.publishedUrl)} onClick={markPublished}>실제 URL 저장 · 발행 완료</button>
       </div>
       {selected.status==="published"&&<p className={styles.success}>✓ 이 실험이 다른 글의 내부링크 후보에 포함됩니다.</p>}
       <small>이전 발행 글의 본문을 자동으로 수정하는 기능은 아직 없습니다. 새 링크를 반영하려면 기존 글의 HTML을 다시 복사·갱신하세요.</small>
      </div>
     </>}
    </section>}
    {selected&&<div className={styles.bottomBar}>
     <span>선택: <strong>{selected.topic}</strong></span>
     <select aria-label="작업 상태" value={selected.status} onChange={e=>setStatus(e.target.value as Status)}>
      {STATUS.map(id=><option key={id} value={id}>{STATUS_LABEL[id]}</option>)}
     </select>
     <button className={styles.danger} type="button" onClick={deleteProject}>항목 삭제</button>
    </div>}
   </div>
  </div>
  <footer className={styles.footer}>AI Price Atlas V3 · 별도 브라우저 저장공간 · 유료 API 호출 없음 · 실제 AI 원문 보존 · 모든 발행은 운영자가 검수</footer>
 </main>;
}
function NoSelection(){return <div className={styles.empty}><h2>먼저 주제를 추가해 주세요.</h2><p>왼쪽 목록 또는 주제 보관함에서 새 AI 비교 실험을 만들 수 있어요.</p></div>;}
function ProjectTitle({selected}:{selected:AtlasProject}){return <div className={styles.current}><strong>{selected.topic}</strong><span>{selected.category} · {STATUS_LABEL[selected.status]}</span></div>;}
