"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";

type Fact = { label: string; value: string; sourceText: string };
type ImagePlan = { order: number; title: string; keyMessage: string; sourceText: string; imagePrompt: string };
type Analysis = { recommendedTitle: string; titleCandidates: string[]; keywords: string[]; facts: Fact[]; images: ImagePlan[] };
type Task = ImagePlan & { done: boolean; imageDataUrl: string; imageUrl?: string; replaced: boolean };
type Recommendation = { title: string; brief: string };

const TYPES = ["아파트 블로그", "생활·아파트 꿀팁", "동물·자연", "AI Price Atlas", "집값쓱 쇼츠"];
const TEMPLATES = ["modern", "data", "minimal"];

const RECOMMENDATIONS: Record<string, Recommendation[]> = {
  "아파트 블로그": [
    { title: "요즘 거래가 늘어난 아파트 TOP3", brief: "최근 거래가 활발해진 단지 3곳을 비교하고, 가격대·입지·거래 증가 이유와 앞으로 확인할 포인트를 정리하는 글입니다." },
    { title: "같은 예산이면 어디 아파트까지 살 수 있을까?", brief: "예산 구간별로 살 수 있는 대표 지역과 전용 84㎡대 아파트를 비교하고, 대출·현금·입지 차이를 쉽게 설명하는 글입니다." },
    { title: "지금 아파트 사도 될까? 거래는 줄었는데 가격이 오르는 이유", brief: "최근 거래량과 가격 흐름이 엇갈리는 이유를 설명하고, 실수요자가 매수 전에 체크할 항목을 정리하는 글입니다." },
    { title: "역세권 아파트, 비슷한 가격인데 어디가 더 다를까?", brief: "비슷한 가격대 역세권 아파트를 교통·연식·학군·생활권·실거래 관점에서 비교하는 글입니다." },
    { title: "전용 84㎡ 가격 차이가 크게 벌어지는 이유", brief: "같은 지역의 전용 84㎡대 아파트도 가격이 다른 이유를 신축 여부·역세권·학군·정비사업·입주물량으로 나눠 설명하는 글입니다." }
  ],
  "생활·아파트 꿀팁": [
    { title: "신축 아파트 사전점검 체크리스트", brief: "현관·창호·욕실·주방·설비·마감 순서로 직접 확인할 수 있는 실전 사전점검 체크리스트를 만드는 글입니다." },
    { title: "이사 전날 꼭 해야 할 일 10가지", brief: "이사 전날 놓치기 쉬운 냉장고·가전·귀중품·엘리베이터·관리사무소·주차 관련 준비를 순서대로 정리하는 글입니다." },
    { title: "입주청소 직접 할까, 업체 맡길까?", brief: "셀프 청소와 업체 청소의 시간·비용·준비물·주의점을 비교해서 어떤 경우에 각각 유리한지 알려주는 글입니다." },
    { title: "에어컨 청소, 집에서 어디까지 가능할까?", brief: "필터 청소와 사용자가 직접 해도 되는 범위, 전문가 분해청소가 필요한 경우를 구분해서 설명하는 글입니다." },
    { title: "아파트 관리비 줄이는 현실적인 방법", brief: "전기·난방·수도·공용관리비에서 실제로 확인할 수 있는 절약 포인트를 체크리스트 형태로 정리하는 글입니다." }
  ],
  "동물·자연": [
    { title: "고양이는 왜 박스를 좋아할까?", brief: "고양이가 박스에 들어가는 이유를 안정감·체온 유지·사냥 본능·스트레스 감소 관점에서 쉽게 설명하는 글입니다." },
    { title: "비 온 뒤 흙냄새는 왜 날까?", brief: "페트리코르와 지오스민, 빗방울이 냄새 입자를 공기 중으로 퍼뜨리는 과정을 흥미롭게 설명하는 글입니다." },
    { title: "강아지는 왜 고개를 갸웃할까?", brief: "강아지가 사람의 말이나 소리에 반응해 고개를 기울이는 이유를 청각·시야·학습 행동 관점에서 정리하는 글입니다." },
    { title: "문어는 정말 머리가 좋을까?", brief: "문어의 문제 해결 능력·도구 사용·위장 행동을 사례 중심으로 소개하는 자연과학형 글입니다." },
    { title: "새들은 길을 어떻게 잃지 않을까?", brief: "철새가 태양·별·지구 자기장·냄새를 이용해 이동 경로를 찾는 원리를 쉽게 설명하는 글입니다." }
  ],
  "AI Price Atlas": [
    { title: "ChatGPT Plus Price in South Korea 2026", brief: "South Korea에서 ChatGPT Plus의 웹·앱 결제 가격, 결제수단, 세금 및 구독 전 확인사항을 정리하는 영문 SEO 글입니다." },
    { title: "ChatGPT Plus Price in Japan 2026", brief: "Japan에서 ChatGPT Plus 가격과 Web vs App 결제 차이, JPY 표시 방식과 확인할 사항을 정리하는 영문 SEO 글입니다." },
    { title: "Claude Pro Price in South Korea 2026", brief: "South Korea 기준 Claude Pro 가격, 결제 방식, 세금과 ChatGPT Plus와의 가격 차이를 정리하는 영문 SEO 글입니다." },
    { title: "Gemini AI Subscription Price in South Korea 2026", brief: "South Korea 기준 Gemini 유료 구독 가격과 Google 결제 방식, 포함 기능, 확인사항을 정리하는 영문 SEO 글입니다." },
    { title: "Cheapest Countries for AI Subscriptions in 2026", brief: "국가별 AI 구독 가격을 단순 환율 비교가 아니라 지역 가격·세금·앱스토어 결제 차이 관점에서 설명하는 영문 글입니다." }
  ],
  "집값쓱 쇼츠": [
    { title: "연봉 5천이면 얼마짜리 아파트 가능할까?", brief: "30초 쇼츠용으로 연봉 5천만원 기준 대출 가능액과 현금 보유액에 따라 가능한 아파트 가격을 6~7장면으로 설명합니다." },
    { title: "현금 1억이면 서울 아파트 어디까지 가능할까?", brief: "현금 1억원을 가진 실수요자가 대출 조건에 따라 어느 가격대까지 볼 수 있는지 강한 훅과 비교 장면으로 구성합니다." },
    { title: "월 대출 100만원 있으면 집 살 때 얼마나 줄어들까?", brief: "기존 대출 상환액이 DSR과 주택담보대출 가능액에 미치는 영향을 짧고 이해하기 쉽게 보여주는 쇼츠입니다." },
    { title: "6억 아파트 사려면 현금 얼마 필요할까?", brief: "6억원 아파트를 예시로 LTV·DSR·취득 관련 자금까지 어떤 항목을 확인해야 하는지 30초 안에 정리하는 쇼츠입니다." },
    { title: "같은 연봉인데 왜 대출 가능액은 다를까?", brief: "연봉이 같아도 기존대출·금리·상환기간에 따라 대출 가능액이 달라지는 이유를 장면별로 보여주는 쇼츠입니다." }
  ]
};

export default function Home() {
  const [phase, setPhase] = useState<"home"|"input"|"analysis"|"images"|"review"|"done">("home");
  const [contentType, setContentType] = useState("아파트 블로그");
  const [projectTitle, setProjectTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [templateKey, setTemplateKey] = useState("modern");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saved, setSaved] = useState<any[]>([]);
  const [finalTitle, setFinalTitle] = useState("");
  const [finalBody, setFinalBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const current = tasks[currentIndex];
  const completeCount = useMemo(() => tasks.filter(t => t.done).length, [tasks]);
  const recommendationItems = RECOMMENDATIONS[contentType] || [];

  useEffect(() => { refreshSaved().catch(() => {}); }, []);

  async function refreshSaved() {
    const { supabase } = await ensureAnonymousSession();
    const { data, error } = await supabase.from("projects").select("id,project_title,content_type,updated_at,status").order("updated_at", { ascending: false }).limit(20);
    if (error) throw error;
    setSaved(data || []);
  }

  function applyRecommendation(item: Recommendation) {
    setProjectTitle(item.title);
    setRawContent(`${item.brief}\n\n이 주제로 독자가 가장 궁금해할 질문부터 시작하고, 핵심 비교 포인트와 체크사항을 이해하기 쉽게 정리해주세요. 확인되지 않은 숫자나 사실은 임의로 만들지 마세요.`);
    setError("");
  }

  async function analyze() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, projectTitle, rawContent }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "분석 실패");
      setAnalysis(data);
      setFinalTitle(data.recommendedTitle);
      setTasks(data.images.map((x: ImagePlan) => ({ ...x, done: false, imageDataUrl: "", replaced: false })));
      setPhase("analysis");
    } catch (e: any) { setError(e.message || "분석 오류"); }
    finally { setLoading(false); }
  }

  function updateCurrent(fields: Partial<Task>) {
    setTasks(prev => prev.map((t, i) => i === currentIndex ? { ...t, ...fields } : t));
  }

  async function generateImage() {
    if (!current) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, sectionTitle: current.title, keyMessage: current.keyMessage, templateKey }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "이미지 생성 실패");
      updateCurrent({ imageDataUrl: data.imageDataUrl, replaced: false });
    } catch (e: any) { setError(e.message || "이미지 생성 오류"); }
    finally { setLoading(false); }
  }

  function replaceImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => updateCurrent({ imageDataUrl: String(reader.result), replaced: true });
    reader.readAsDataURL(file);
  }

  async function uploadImage(dataUrl: string, userId: string, project: string, order: number) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return dataUrl.startsWith("https://") ? dataUrl : "";
    const ext = match[1].includes("svg") ? "svg" : match[1].includes("jpeg") ? "jpg" : match[1].includes("webp") ? "webp" : "png";
    const raw = atob(match[2]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const { supabase } = await ensureAnonymousSession();
    const path = `${userId}/${project}/${String(order).padStart(2, "0")}.${ext}`;
    const { error } = await supabase.storage.from("content-maker-assets").upload(path, bytes, { contentType: match[1], upsert: true });
    if (error) throw error;
    return supabase.storage.from("content-maker-assets").getPublicUrl(path).data.publicUrl;
  }

  async function saveCloud() {
    setLoading(true); setError("");
    try {
      const { supabase, session } = await ensureAnonymousSession();
      const payload = {
        user_id: session.user.id,
        content_type: contentType,
        project_title: projectTitle || analysis?.recommendedTitle || "새 콘텐츠",
        raw_content: rawContent,
        memo: "",
        recommended_title: analysis?.recommendedTitle || "",
        template_key: templateKey,
        final_title: finalTitle,
        final_body: finalBody,
        status: phase === "done" ? "done" : "draft",
        analysis_json: analysis || {},
        updated_at: new Date().toISOString()
      };

      let pid = projectId;
      if (pid) {
        const { error } = await supabase.from("projects").update(payload).eq("id", pid);
        if (error) throw error;
        await supabase.from("image_tasks").delete().eq("project_id", pid);
      } else {
        const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
        if (error) throw error;
        pid = data.id; setProjectId(pid);
      }

      const rows = [];
      for (const t of tasks) {
        const url = t.imageDataUrl ? await uploadImage(t.imageDataUrl, session.user.id, pid!, t.order) : (t.imageUrl || "");
        rows.push({ project_id: pid, user_id: session.user.id, order_no: t.order, section_title: t.title, key_message: t.keyMessage, source_text: t.sourceText, image_prompt: t.imagePrompt, image_url: url, status: t.done ? "done" : "pending", replaced: t.replaced });
      }
      if (rows.length) {
        const { error } = await supabase.from("image_tasks").insert(rows);
        if (error) throw error;
      }
      await refreshSaved();
      alert("클라우드에 저장했습니다.");
    } catch (e: any) { setError(e.message || "저장 실패"); }
    finally { setLoading(false); }
  }

  async function loadProject(id: string) {
    setLoading(true); setError("");
    try {
      const { supabase } = await ensureAnonymousSession();
      const { data: p, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: imgs, error: ie } = await supabase.from("image_tasks").select("*").eq("project_id", id).order("order_no");
      if (ie) throw ie;
      setProjectId(id); setContentType(p.content_type); setProjectTitle(p.project_title); setRawContent(p.raw_content); setTemplateKey(p.template_key || "modern"); setFinalTitle(p.final_title || p.recommended_title || ""); setFinalBody(p.final_body || ""); setAnalysis(p.analysis_json);
      setTasks((imgs || []).map((x: any) => ({ order: x.order_no, title: x.section_title, keyMessage: x.key_message, sourceText: x.source_text, imagePrompt: x.image_prompt, imageDataUrl: x.image_url, imageUrl: x.image_url, done: x.status === "done", replaced: x.replaced })));
      setCurrentIndex(0); setPhase((imgs || []).length ? "images" : "analysis");
    } catch (e: any) { setError(e.message || "불러오기 실패"); }
    finally { setLoading(false); }
  }

  async function exportZip() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectTitle, contentType, finalTitle, finalBody, tasks, templateKey }) });
      if (!r.ok) throw new Error("ZIP 생성 실패");
      const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "content-maker-project.zip"; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message || "ZIP 오류"); }
    finally { setLoading(false); }
  }

  function prepareFinal() {
    const markers = tasks.map(t => `[이미지 ${String(t.order).padStart(2, "0")} - ${t.title}]`).join("\n\n");
    setFinalBody(`${rawContent.trim()}\n\n---\n\n${markers}`);
    setPhase("done");
  }

  return <main className="wrap">
    <header className="header"><div className="brand">콘텐츠 메이커</div><div className="badge">LIVE BETA</div></header>
    <section className="hero"><h1>본문 하나로 카드뉴스 제작</h1><p>주제 추천 → 본문 분석 → 이미지 구성 → 한 장씩 제작 → 검수 → 클라우드 저장 → ZIP 다운로드</p></section>
    {error && <div className="error">{error}</div>}

    <section className="panel">
      <div className="steps">{["자료입력","분석","이미지","검수","완료"].map((x,i)=><div key={x} className={"step "+(((phase==="home"||phase==="input")&&i===0)||(phase==="analysis"&&i===1)||(phase==="images"&&i===2)||(phase==="review"&&i===3)||(phase==="done"&&i===4)?"active":"")}>{i+1} {x}</div>)}</div>

      {phase === "home" && <>
        <h2>새 작업</h2>
        <div className="types">{TYPES.map((t,i)=><button key={t} className={"type "+(contentType===t?"sel":"")} onClick={()=>setContentType(t)}><span className="ico">{["🏠","💡","🐾","🤖","🎬"][i]}</span><b>{t}</b><small>콘텐츠 제작</small></button>)}</div>
        <div className="actions"><button className="primary" onClick={()=>setPhase("input")}>새 작업 시작</button></div>
        <div className="box"><h3>저장 프로젝트</h3><div className="savedList">{saved.map(p=><div className="savedItem" key={p.id}><div><b>{p.project_title}</b><small>{p.content_type}</small></div><button className="secondary" onClick={()=>loadProject(p.id)}>불러오기</button></div>)}</div>{saved.length===0&&<div className="small">아직 저장된 작업이 없습니다.</div>}</div>
      </>}

      {phase === "input" && <>
        <h2>자료 입력</h2>
        <div className="box">
          <h3>✨ {contentType} 주제 자동 추천</h3>
          <div className="small" style={{marginBottom:10}}>마음에 드는 주제를 누르면 제목과 시작용 본문이 자동으로 채워집니다.</div>
          <div className="savedList">
            {recommendationItems.map((item, i)=><div className="savedItem" key={item.title}>
              <div><b>{i+1}. {item.title}</b><small>{item.brief}</small></div>
              <button className="secondary" onClick={()=>applyRecommendation(item)}>이 주제로 시작</button>
            </div>)}
          </div>
        </div>
        <label>작업 제목</label><input value={projectTitle} onChange={e=>setProjectTitle(e.target.value)} placeholder="직접 입력하거나 위 추천을 선택하세요"/>
        <label>본문</label><textarea value={rawContent} onChange={e=>setRawContent(e.target.value)} placeholder="본문을 붙여넣거나 위 추천을 선택하세요."/>
        <div className="small">현재 {rawContent.trim().length}자 · 30자 이상이면 분석할 수 있습니다.</div>
        <div className="actions"><button className="secondary" onClick={()=>setPhase("home")}>이전</button><button className="primary" disabled={rawContent.trim().length<30||loading} onClick={analyze}>{loading?"분석 중...":"분석하기"}</button></div>
      </>}

      {phase === "analysis" && analysis && <>
        <h2>분석 결과</h2><div className="grid"><div className="box"><h3>추천 제목</h3><div className="recommended">{analysis.recommendedTitle}</div></div><div className="box"><h3>핵심 키워드</h3><div className="tags">{analysis.keywords.map(x=><span key={x}>{x}</span>)}</div></div></div>
        <div className="box"><h3>이미지 구성</h3>{analysis.images.map(x=><div className="imageRow" key={x.order}><span>{String(x.order).padStart(2,"0")}</span><div><b>{x.title}</b><p>{x.keyMessage}</p></div></div>)}</div>
        <div className="actions"><button className="secondary" onClick={saveCloud}>☁ 저장</button><button className="primary" onClick={()=>setPhase("images")}>이미지 제작</button></div>
      </>}

      {phase === "images" && current && <>
        <h2>이미지 제작</h2><div className="templates">{TEMPLATES.map(t=><button key={t} className={"template "+(templateKey===t?"sel":"")} onClick={()=>setTemplateKey(t)}><div className={"templatePreview "+t}>{t.toUpperCase()}</div><b>{t}</b></button>)}</div>
        <div className="imageLayout"><aside className="taskList">{tasks.map((t,i)=><button key={t.order} className={"taskItem "+(i===currentIndex?"active ":"")+(t.done?"done":"")} onClick={()=>setCurrentIndex(i)}><span className="taskNo">{String(t.order).padStart(2,"0")}</span><div className="taskText"><b>{t.title}</b><small>{t.keyMessage}</small></div><span className={"taskState "+(t.done?"done":"wait")}>{t.done?"완료":"대기"}</span></button>)}</aside>
        <div className="previewArea"><div className="previewCard">{current.imageDataUrl?<img src={current.imageDataUrl} alt={current.title}/>:<div className="placeholder">아직 이미지가 없습니다</div>}</div><div className="box"><h3>{current.title}</h3><label>핵심 문구</label><input value={current.keyMessage} onChange={e=>updateCurrent({keyMessage:e.target.value})}/><label>이미지 교체</label><input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(f) replaceImage(f)}}/><div className="actions row"><button className="secondary" onClick={generateImage} disabled={loading}>{loading?"생성 중...":"이미지 만들기"}</button><button className="primary" onClick={()=>{updateCurrent({done:true}); if(currentIndex<tasks.length-1)setCurrentIndex(currentIndex+1)}}>확정 ✓</button></div></div></div></div>
        <div className="actions"><button className="secondary" onClick={saveCloud}>☁ 저장</button><button className="primary" onClick={()=>setPhase("review")}>검수하기</button></div>
      </>}

      {phase === "review" && <><h2>자동 검수</h2><div className="review"><div className="reviewItem"><span>이미지 확정</span><b className={completeCount===tasks.length?"ok":"warn"}>{completeCount}/{tasks.length}</b></div><div className="reviewItem"><span>업로드 교체</span><b>{tasks.filter(t=>t.replaced).length}장</b></div></div><div className="actions"><button className="secondary" onClick={()=>setPhase("images")}>이미지 수정</button><button className="primary" onClick={prepareFinal}>최종 본문 만들기</button></div></>}

      {phase === "done" && <><h2>완료 🎉</h2><label>최종 제목</label><input value={finalTitle} onChange={e=>setFinalTitle(e.target.value)}/><label>최종 본문</label><textarea className="editor" value={finalBody} onChange={e=>setFinalBody(e.target.value)}/><div className="actions"><button className="secondary" onClick={saveCloud}>☁ 저장</button><button className="primary" onClick={exportZip} disabled={loading}>전체 ZIP 다운로드</button></div></>}
    </section>
  </main>;
}
