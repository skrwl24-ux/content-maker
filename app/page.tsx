"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";

type Fact = { label:string; value:string; sourceText:string };
type ImageTask = { order:number; title:string; keyMessage:string; sourceText:string; imagePrompt:string };
type Analysis = {
  recommendedTitle:string;
  titleCandidates:string[];
  keywords:string[];
  facts:Fact[];
  thumbnail:{title:string;subtitle:string};
  images:ImageTask[];
};
type TaskState = ImageTask & { id?:string; done:boolean; imageDataUrl:string; imageUrl?:string; replaced:boolean };
type Recommendation = { title:string; brief:string };

const TYPES = [
  ["🏠","아파트 블로그","시세·실거래·TOP3"],
  ["💡","생활·아파트 꿀팁","이사·청소·점검"],
  ["🐾","동물·자연","질문형 콘텐츠"],
  ["🤖","AI Price Atlas","가격·국가 비교"],
  ["🎬","집값쓱 쇼츠","장면 6~7개"]
] as const;

const PRESETS:Record<string,{ratio:string,size:string}> = {
  "아파트 블로그":{ratio:"16:9",size:"1536x864"},
  "생활·아파트 꿀팁":{ratio:"16:9",size:"1536x864"},
  "동물·자연":{ratio:"16:9",size:"1536x864"},
  "AI Price Atlas":{ratio:"16:9",size:"1536x864"},
  "집값쓱 쇼츠":{ratio:"9:16",size:"1088x1920"}
};

const TEMPLATES = [
  {key:"modern",name:"Modern",desc:"강한 제목 + 깔끔한 카드"},
  {key:"data",name:"Data Focus",desc:"숫자·비교 중심"},
  {key:"minimal",name:"Minimal",desc:"여백 많은 정보형"}
];

const RECOMMENDATIONS:Record<string,Recommendation[]> = {
  "아파트 블로그":[
    {title:"요즘 거래가 늘어난 아파트 TOP3",brief:"최근 거래가 활발해진 단지 3곳을 비교하고 가격대·입지·거래 증가 이유를 정리합니다."},
    {title:"같은 예산이면 어디 아파트까지 살 수 있을까?",brief:"예산별로 살 수 있는 지역과 전용 84㎡대 아파트를 비교합니다."},
    {title:"지금 아파트 사도 될까? 거래는 줄었는데 가격이 오르는 이유",brief:"거래량과 가격 흐름이 엇갈리는 이유와 실수요자 체크포인트를 정리합니다."},
    {title:"역세권 아파트, 비슷한 가격인데 어디가 다를까?",brief:"비슷한 가격대 역세권 아파트를 교통·연식·학군·생활권 기준으로 비교합니다."},
    {title:"전용 84㎡ 가격 차이가 크게 벌어지는 이유",brief:"신축·역세권·학군·정비사업·입주물량 관점에서 가격 차이를 설명합니다."}
  ],
  "생활·아파트 꿀팁":[
    {title:"신축 아파트 사전점검 체크리스트",brief:"현관·창호·욕실·주방·설비·마감 순서로 실제 점검할 항목을 정리합니다."},
    {title:"이사 전날 꼭 해야 할 일 10가지",brief:"가전·귀중품·엘리베이터·관리사무소·주차 등 놓치기 쉬운 준비를 정리합니다."},
    {title:"입주청소 직접 할까, 업체 맡길까?",brief:"셀프 청소와 업체 청소의 시간·비용·준비물·주의점을 비교합니다."},
    {title:"에어컨 청소, 집에서 어디까지 가능할까?",brief:"사용자가 직접 가능한 범위와 전문가 분해청소가 필요한 경우를 구분합니다."},
    {title:"아파트 관리비 줄이는 현실적인 방법",brief:"전기·난방·수도·공용관리비에서 확인할 수 있는 절약 포인트를 정리합니다."}
  ],
  "동물·자연":[
    {title:"고양이는 왜 박스를 좋아할까?",brief:"안정감·체온 유지·사냥 본능·스트레스 감소 관점에서 설명합니다."},
    {title:"비 온 뒤 흙냄새는 왜 날까?",brief:"페트리코르와 지오스민, 빗방울이 냄새 입자를 퍼뜨리는 과정을 설명합니다."},
    {title:"강아지는 왜 고개를 갸웃할까?",brief:"청각·시야·학습 행동 관점에서 이유를 정리합니다."},
    {title:"문어는 정말 머리가 좋을까?",brief:"문제 해결 능력·도구 사용·위장 행동을 사례 중심으로 소개합니다."},
    {title:"새들은 길을 어떻게 잃지 않을까?",brief:"태양·별·지구 자기장·냄새를 이용한 이동 원리를 쉽게 설명합니다."}
  ],
  "AI Price Atlas":[
    {title:"ChatGPT Plus Price in South Korea 2026",brief:"South Korea 가격, Web vs App, 결제수단과 확인사항을 정리하는 영문 SEO 글입니다."},
    {title:"ChatGPT Plus Price in Japan 2026",brief:"Japan 가격과 Web vs App 결제 차이, JPY 표시 방식 등을 정리합니다."},
    {title:"Claude Pro Price in South Korea 2026",brief:"South Korea 기준 Claude Pro 가격과 결제·세금 포인트를 정리합니다."},
    {title:"Gemini AI Subscription Price in South Korea 2026",brief:"South Korea 기준 Gemini 유료 구독 가격과 결제방식을 정리합니다."},
    {title:"Cheapest Countries for AI Subscriptions in 2026",brief:"국가별 지역 가격·세금·앱스토어 차이를 비교하는 영문 글입니다."}
  ],
  "집값쓱 쇼츠":[
    {title:"연봉 5천이면 얼마짜리 아파트 가능할까?",brief:"연봉 5천만원 기준 대출 가능액과 현금 보유액별 가능 가격을 6~7장면으로 설명합니다."},
    {title:"현금 1억이면 아파트 어디까지 가능할까?",brief:"현금 1억원과 대출 조건에 따라 가능한 가격대를 쇼츠로 구성합니다."},
    {title:"월 대출 100만원 있으면 집 살 때 얼마나 줄어들까?",brief:"기존 대출이 DSR과 주담대 가능액에 미치는 영향을 쉽게 설명합니다."},
    {title:"6억 아파트 사려면 현금 얼마 필요할까?",brief:"6억원 아파트를 예시로 LTV·DSR과 필요한 자금을 30초 안에 정리합니다."},
    {title:"같은 연봉인데 왜 대출 가능액은 다를까?",brief:"기존대출·금리·상환기간에 따라 대출 가능액이 달라지는 이유를 보여줍니다."}
  ]
};

export default function Home(){
  const [phase,setPhase]=useState<"home"|"input"|"analysis"|"images"|"review"|"editor"|"done">("home");
  const [contentType,setContentType]=useState("");
  const [projectTitle,setProjectTitle]=useState("");
  const [rawContent,setRawContent]=useState("");
  const [memo,setMemo]=useState("");
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [tasks,setTasks]=useState<TaskState[]>([]);
  const [currentIndex,setCurrentIndex]=useState(0);
  const [templateKey,setTemplateKey]=useState("modern");
  const [finalTitle,setFinalTitle]=useState("");
  const [finalBody,setFinalBody]=useState("");
  const [cloudProjects,setCloudProjects]=useState<any[]>([]);
  const [projectId,setProjectId]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const fileRef=useRef<HTMLInputElement|null>(null);

  const current=tasks[currentIndex];
  const preset=PRESETS[contentType] || {ratio:"-",size:"-"};
  const recommendationItems=RECOMMENDATIONS[contentType] || [];
  const completed=useMemo(()=>tasks.filter(t=>t.done).length,[tasks]);
  const missingFacts=useMemo(()=>{
    const corpus=tasks.map(t=>`${t.keyMessage} ${t.imagePrompt}`).join(" ").toLowerCase();
    return (analysis?.facts||[]).filter(f=>!corpus.includes(String(f.value).toLowerCase()));
  },[analysis,tasks]);

  useEffect(()=>{ loadCloudProjects().catch(()=>{}); },[]);

  async function loadCloudProjects(){
    const {supabase}=await ensureAnonymousSession();
    const {data,error}=await supabase.from("projects").select("id,project_title,content_type,status,updated_at").order("updated_at",{ascending:false}).limit(20);
    if(error) throw error;
    setCloudProjects(data||[]);
  }

  async function analyzeText(){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentType,projectTitle,rawContent,memo})});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"분석 실패");
      setAnalysis(data);
      setFinalTitle(data.recommendedTitle);
      setPhase("analysis");
    }catch(e:any){setError(e.message||"오류");}
    finally{setLoading(false);}
  }

  function startImages(){
    if(!analysis)return;
    setTasks(analysis.images.map(x=>({...x,done:false,imageDataUrl:"",replaced:false})));
    setCurrentIndex(0);
    setPhase("images");
  }

  function updateCurrent(fields:Partial<TaskState>){
    setTasks(prev=>prev.map((t,i)=>i===currentIndex?{...t,...fields}:t));
  }

  function applyRecommendation(item:Recommendation){
    setProjectTitle(item.title);
    setRawContent(`${item.brief}\n\n이 주제로 독자가 가장 궁금해할 질문부터 시작하고, 핵심 비교 포인트와 체크사항을 이해하기 쉽게 정리해주세요. 확인되지 않은 숫자나 사실은 임의로 만들지 마세요.`);
    setMemo("검색 유입과 모바일 가독성을 고려하고, 이미지에 들어갈 핵심 문구는 짧게 정리");
    setError("");
  }

  function imageRequest(task:TaskState){
    const style=TEMPLATES.find(t=>t.key===templateKey)?.name || "Modern";
    const oneOnly=contentType==="집값쓱 쇼츠"
      ? "9:16 세로 이미지 한 장만 생성. 여러 장면 합본 금지."
      : "16:9 가로 이미지 한 장만 생성. 여러 장면 합본 금지.";
    return [
      `[${contentType}용 이미지 제작 요청]`,
      ``,
      `장면: ${String(task.order).padStart(2,"0")} · ${task.title}`,
      `핵심 문구: ${task.keyMessage}`,
      `스타일: ${style}`,
      `권장 크기: ${preset.size} / ${preset.ratio}`,
      ``,
      task.imagePrompt || "",
      task.sourceText ? `근거 문장: ${task.sourceText}` : "",
      ``,
      oneOnly,
      `블로그/쇼츠에 바로 사용할 수 있는 완성도 높은 이미지로 제작.`,
      `본문에 없는 숫자·날짜·가격·단지명·정책 내용을 임의로 만들지 말 것.`,
      `핵심 문구 외 불필요한 글자는 넣지 말고, 한글이 들어가면 오탈자 없이 정확히 표기.`,
      `중요 요소는 가장자리에서 충분히 띄워 잘리지 않게 구성.`
    ].filter(Boolean).join("\n");
  }

  async function copyCurrentPrompt(){
    if(!current)return;
    try{
      await navigator.clipboard.writeText(imageRequest(current));
      alert("현재 이미지 제작 요청서를 복사했습니다. ChatGPT에 붙여넣어 이미지를 만든 뒤 여기 업로드하세요.");
    }catch{
      setError("복사하지 못했습니다. 요청문을 직접 선택해서 복사해주세요.");
    }
  }

  async function copyAllPrompts(){
    const text=tasks.map(t=>imageRequest(t)).join("\n\n====================\n\n");
    try{
      await navigator.clipboard.writeText(text);
      alert(`이미지 ${tasks.length}장 제작 요청서를 모두 복사했습니다.`);
    }catch{
      setError("전체 요청서 복사에 실패했습니다.");
    }
  }

  async function replaceWithFile(file:File){
    const reader=new FileReader();
    reader.onload=()=>updateCurrent({imageDataUrl:String(reader.result),replaced:true});
    reader.readAsDataURL(file);
  }

  function confirmCurrent(){
    if(!current)return;
    updateCurrent({done:true});
    if(currentIndex<tasks.length-1)setCurrentIndex(currentIndex+1);
  }

  function buildFinalBody(){
    const markers=tasks.map(t=>`[이미지 ${String(t.order).padStart(2,"0")} - ${t.title}]`).join("\n\n");
    setFinalBody(`${rawContent.trim()}\n\n---\n\n${markers}`);
  }

  async function uploadDataUrlToStorage(dataUrl:string, path:string){
    const {supabase,session}=await ensureAnonymousSession();
    const match=dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if(!match)return "";
    const binary=atob(match[2]);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const fullPath=`${session.user.id}/${path}`;
    const {error}=await supabase.storage.from("content-maker-assets").upload(fullPath,bytes,{contentType:match[1],upsert:true});
    if(error)throw error;
    const {data}=supabase.storage.from("content-maker-assets").getPublicUrl(fullPath);
    return data.publicUrl;
  }

  async function saveCloud(){
    setLoading(true);setError("");
    try{
      const {supabase,session}=await ensureAnonymousSession();
      const projectPayload={
        user_id:session.user.id,
        content_type:contentType,
        project_title:projectTitle||analysis?.recommendedTitle||"새 콘텐츠",
        raw_content:rawContent,
        memo,
        recommended_title:analysis?.recommendedTitle||"",
        template_key:templateKey,
        final_title:finalTitle,
        final_body:finalBody,
        status:phase==="done"?"done":"draft",
        analysis_json:analysis||{}
      };

      let pid=projectId;
      if(pid){
        const {error}=await supabase.from("projects").update({...projectPayload,updated_at:new Date().toISOString()}).eq("id",pid);
        if(error)throw error;
        await supabase.from("image_tasks").delete().eq("project_id",pid);
      }else{
        const {data,error}=await supabase.from("projects").insert(projectPayload).select("id").single();
        if(error)throw error;
        pid=data.id; setProjectId(pid);
      }

      const rows=[];
      for(const t of tasks){
        let imageUrl=t.imageUrl||"";
        if(t.imageDataUrl?.startsWith("data:image/")){
          imageUrl=await uploadDataUrlToStorage(t.imageDataUrl,`${pid}/${String(t.order).padStart(2,"0")}.png`);
        }
        rows.push({
          project_id:pid,
          user_id:session.user.id,
          order_no:t.order,
          section_title:t.title,
          key_message:t.keyMessage,
          source_text:t.sourceText||"",
          image_prompt:t.imagePrompt,
          image_url:imageUrl,
          status:t.done?"done":"pending",
          replaced:t.replaced
        });
      }
      if(rows.length){
        const {error}=await supabase.from("image_tasks").insert(rows);
        if(error)throw error;
      }
      await loadCloudProjects();
      alert("Supabase에 저장했습니다.");
    }catch(e:any){setError(e.message||"클라우드 저장 실패");}
    finally{setLoading(false);}
  }

  async function loadCloudProject(id:string){
    setLoading(true);setError("");
    try{
      const {supabase}=await ensureAnonymousSession();
      const {data:p,error}=await supabase.from("projects").select("*").eq("id",id).single();
      if(error)throw error;
      const {data:imgs,error:imgErr}=await supabase.from("image_tasks").select("*").eq("project_id",id).order("order_no");
      if(imgErr)throw imgErr;

      setProjectId(id);
      setContentType(p.content_type);
      setProjectTitle(p.project_title);
      setRawContent(p.raw_content);
      setMemo(p.memo);
      setTemplateKey(p.template_key||"modern");
      setFinalTitle(p.final_title||p.recommended_title||"");
      setFinalBody(p.final_body||"");
      setAnalysis(p.analysis_json as Analysis);
      setTasks((imgs||[]).map((x:any)=>({
        order:x.order_no,title:x.section_title,keyMessage:x.key_message,sourceText:x.source_text,
        imagePrompt:x.image_prompt,imageDataUrl:x.image_url,imageUrl:x.image_url,done:x.status==="done",replaced:x.replaced
      })));
      setCurrentIndex(0);
      setPhase((imgs||[]).length?"images":"analysis");
    }catch(e:any){setError(e.message||"불러오기 실패");}
    finally{setLoading(false);}
  }

  async function exportZip(){
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        projectTitle,contentType,finalTitle,finalBody,tasks,templateKey
      })});
      if(!r.ok){const data=await r.json();throw new Error(data.error||"ZIP 생성 실패");}
      const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download=`${(projectTitle||"content-maker-project").replace(/[\\/:*?"<>|]+/g,"_")}.zip`;a.click();URL.revokeObjectURL(url);
    }catch(e:any){setError(e.message||"ZIP 오류");}
    finally{setLoading(false);}
  }

  return <main className="wrap">
    <header className="header"><div className="brand">콘텐츠 메이커</div><div className="badge">FREE WORKFLOW · LIVE BETA</div></header>
    <section className="hero"><h1>본문 분석부터 이미지 정리까지 한 번에</h1><p>주제 추천 → 본문 분석 → ChatGPT 이미지 요청서 → 이미지 업로드 → 검수 → 클라우드 저장 → ZIP 다운로드</p></section>
    {error && <div className="error">{error}</div>}

    <section className="panel">
      <div className="steps">
        <div className={"step "+((phase==="home"||phase==="input")?"active":"")}>1 자료입력</div>
        <div className={"step "+(phase==="analysis"?"active":"")}>2 AI 분석</div>
        <div className={"step "+(phase==="images"?"active":"")}>3 이미지 준비</div>
        <div className={"step "+(phase==="review"?"active":"")}>4 검수</div>
        <div className={"step "+((phase==="editor"||phase==="done")?"active":"")}>5 완료</div>
      </div>

      {phase==="home" && <>
        <h2>새 작업</h2>
        <div className="types">{TYPES.map(([ico,name,desc])=><button key={name} className={"type "+(contentType===name?"sel":"")} onClick={()=>setContentType(name)}><span className="ico">{ico}</span><b>{name}</b><small>{desc}</small></button>)}</div>
        <div className="actions"><button className="primary" disabled={!contentType} onClick={()=>setPhase("input")}>새 작업 시작</button></div>
        <div className="box">
          <h3>Supabase 저장 프로젝트</h3>
          {cloudProjects.length===0 && <div className="small">저장된 작업이 없습니다.</div>}
          <div className="savedList">{cloudProjects.map(p=><div className="savedItem" key={p.id}><div><b>{p.project_title||"새 콘텐츠"}</b><small>{p.content_type} · {new Date(p.updated_at).toLocaleString()}</small></div><button className="secondary" onClick={()=>loadCloudProject(p.id)}>불러오기</button></div>)}</div>
        </div>
      </>}

      {phase==="input" && <>
        <h2>자료 입력</h2>
        <div className="small">{contentType}</div>
        <div className="box" style={{marginTop:14}}>
          <h3>✨ 주제 자동 추천</h3>
          <div className="small" style={{marginBottom:10}}>주제를 고르면 제목과 시작용 본문이 자동으로 채워집니다.</div>
          <div className="savedList">
            {recommendationItems.map((item,i)=><div className="savedItem" key={item.title}>
              <div><b>{i+1}. {item.title}</b><small>{item.brief}</small></div>
              <button className="secondary" onClick={()=>applyRecommendation(item)}>이 주제로 시작</button>
            </div>)}
          </div>
        </div>
        <label>작업 제목</label><input value={projectTitle} onChange={e=>setProjectTitle(e.target.value)} placeholder="직접 입력하거나 위 추천을 선택하세요"/>
        <label>본문</label><textarea value={rawContent} onChange={e=>setRawContent(e.target.value)} placeholder="완성된 본문을 붙여넣거나 위 추천으로 시작하세요."/>
        <div className="small">현재 {rawContent.trim().length}자 · 30자 이상이면 분석할 수 있습니다.</div>
        <label>메모</label><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="예: 숫자 오류 없이, 모바일 가독성 우선"/>
        <div className="actions"><button className="secondary" onClick={()=>setPhase("home")}>이전</button><button className="primary" disabled={rawContent.trim().length<30||loading} onClick={analyzeText}>{loading?"분석 중...":"분석하기"}</button></div>
      </>}

      {phase==="analysis" && analysis && <>
        <h2>AI 분석 결과</h2>
        <div className="grid">
          <div><div className="box"><h3>추천 제목</h3><div className="recommended">{analysis.recommendedTitle}</div></div><div className="box"><h3>제목 후보</h3>{analysis.titleCandidates.map((x,i)=><div className="candidate" key={i}>{x}</div>)}</div></div>
          <div><div className="box"><h3>키워드</h3><div className="tags">{analysis.keywords.map(x=><span key={x}>{x}</span>)}</div></div><div className="box"><h3>핵심 데이터</h3>{analysis.facts.map((f,i)=><div className="fact" key={i}><b>{f.label}: {f.value}</b><small>{f.sourceText}</small></div>)}</div></div>
        </div>
        <div className="box"><h3>이미지 구성</h3>{analysis.images.map(im=><div className="imageRow" key={im.order}><span>{String(im.order).padStart(2,"0")}</span><div><b>{im.title}</b><p>{im.keyMessage}</p></div></div>)}</div>
        <div className="actions"><button className="secondary" onClick={saveCloud} disabled={loading}>☁ 저장</button><button className="primary" onClick={startImages}>이미지 준비하기</button></div>
      </>}

      {phase==="images" && current && <>
        <h2>이미지 준비 · 업로드</h2>
        <div className="box">
          <h3>💡 무료 작업 방식</h3>
          <div className="small">① 요청문 복사 → ② ChatGPT에서 이미지 생성 → ③ 생성한 이미지를 여기 업로드 → ④ 확인 후 확정. 이 사이트에서는 이미지 API 요금이 들지 않습니다.</div>
        </div>
        <div className="templates">{TEMPLATES.map(t=><button key={t.key} className={"template "+(templateKey===t.key?"sel":"")} onClick={()=>setTemplateKey(t.key)}><div className={"templatePreview "+t.key}>{t.name}</div><b>{t.name}</b><small>{t.desc}</small></button>)}</div>
        <div className="actions" style={{justifyContent:"flex-start",marginBottom:14}}>
          <button className="secondary" onClick={copyAllPrompts}>📋 전체 이미지 요청서 복사</button>
        </div>
        <div className="imageLayout">
          <aside className="taskList">{tasks.map((t,i)=><button key={t.order} className={"taskItem "+(i===currentIndex?"active ":"")+(t.done?"done":"")} onClick={()=>setCurrentIndex(i)}><span className="taskNo">{String(t.order).padStart(2,"0")}</span><div className="taskText"><b>{t.title}</b><small>{t.keyMessage}</small></div><span className={"taskState "+(t.done?"done":"wait")}>{t.done?"완료":t.imageDataUrl?"업로드됨":"대기"}</span></button>)}</aside>
          <div className="previewArea">
            <div className="previewCard">{current.imageDataUrl?<img src={current.imageDataUrl} alt={current.title}/>:<div className="placeholder">ChatGPT에서 만든 이미지를 업로드하면 여기에 표시됩니다</div>}</div>
            <div>
              <div className="box">
                <h3>{String(current.order).padStart(2,"0")} · {current.title}</h3>
                <label>핵심 문구</label><input value={current.keyMessage} onChange={e=>updateCurrent({keyMessage:e.target.value})}/>
                <label>ChatGPT 이미지 제작 요청문</label>
                <textarea value={imageRequest(current)} readOnly style={{minHeight:260}}/>
                <div className="actions row">
                  <button className="primary" onClick={copyCurrentPrompt}>📋 이 요청문 복사</button>
                </div>
              </div>
              <div className="box">
                <h3>완성 이미지 업로드</h3>
                <div className="helper">ChatGPT에서 이미지를 만든 뒤 다운로드해서 올려주세요. 비율 {preset.ratio} · 권장 {preset.size}</div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{const f=e.target.files?.[0];if(f)replaceWithFile(f)}}/>
                <div className="actions row">
                  <button className="secondary" onClick={()=>setCurrentIndex(Math.max(0,currentIndex-1))}>이전</button>
                  <button className="secondary" onClick={()=>setCurrentIndex(Math.min(tasks.length-1,currentIndex+1))}>다음</button>
                  <button className="primary" disabled={!current.imageDataUrl} onClick={confirmCurrent}>이 이미지 확정 ✓</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="actions"><button className="secondary" onClick={saveCloud} disabled={loading}>☁ 저장</button><button className="primary" onClick={()=>setPhase("review")}>검수하기</button></div>
      </>}

      {phase==="review" && <>
        <h2>자동 검수</h2>
        <div className="review">
          <div className="reviewItem"><span>이미지 확정</span><b className={completed===tasks.length?"ok":"warn"}>{completed}/{tasks.length}</b></div>
          <div className="reviewItem"><span>스타일</span><b>{templateKey}</b></div>
          <div className="reviewItem"><span>핵심 데이터 누락</span><b className={missingFacts.length?"warn":"ok"}>{missingFacts.length}개</b></div>
          <div className="reviewItem"><span>업로드 이미지</span><b>{tasks.filter(t=>t.imageDataUrl).length}장</b></div>
        </div>
        <div className="box"><h3>누락 데이터</h3>{missingFacts.length?missingFacts.map((f,i)=><div className="fact" key={i}><b>{f.label}: {f.value}</b></div>):<div className="ok">누락 없음</div>}</div>
        <div className="actions"><button className="secondary" onClick={()=>setPhase("images")}>이미지 수정</button><button className="primary" onClick={()=>{buildFinalBody();setPhase("editor")}}>최종 본문 편집</button></div>
      </>}

      {phase==="editor" && <>
        <h2>최종 본문 편집기</h2>
        <label>최종 제목</label><input value={finalTitle} onChange={e=>setFinalTitle(e.target.value)}/>
        <label>최종 본문</label><textarea className="editor" value={finalBody} onChange={e=>setFinalBody(e.target.value)}/>
        <div className="actions"><button className="secondary" onClick={buildFinalBody}>이미지 위치 재삽입</button><button className="secondary" onClick={saveCloud} disabled={loading}>☁ 저장</button><button className="primary" onClick={()=>setPhase("done")}>완료</button></div>
      </>}

      {phase==="done" && <>
        <h2>완료 🎉</h2>
        <div className="box"><h3>무료 제작 흐름 완료</h3><p>본문 분석, 이미지 요청서, 업로드 이미지, 검수, 최종 본문과 ZIP을 한 프로젝트로 관리할 수 있습니다.</p></div>
        <div className="actions"><button className="secondary" onClick={saveCloud} disabled={loading}>☁ 저장</button><button className="primary" onClick={exportZip} disabled={loading}>{loading?"처리 중...":"전체 ZIP 다운로드"}</button></div>
      </>}
    </section>
  </main>
}
