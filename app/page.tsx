"use client";

import { useEffect, useMemo, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase-browser";

type Fact = { label: string; value: string; sourceText: string };
type ImagePlan = { order: number; title: string; keyMessage: string; sourceText: string; imagePrompt: string };
type Analysis = { recommendedTitle: string; titleCandidates: string[]; keywords: string[]; facts: Fact[]; images: ImagePlan[] };
type Task = ImagePlan & { done: boolean; imageDataUrl: string; imageUrl?: string; replaced: boolean };

const TYPES = ["아파트 블로그", "생활·아파트 꿀팁", "동물·자연", "AI Price Atlas", "집값쓱 쇼츠"];
const TEMPLATES = ["modern", "data", "minimal"];

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

  useEffect(() => { refreshSaved().catch(() => {}); }, []);

  async function refreshSaved() {
    const { supabase } = await ensureAnonymousSession();
    const { data, error } = await supabase.from("projects").select("id,project_title,content_type,updated_at,status").order("updated_at", { ascending: false }).limit(20);
    if (error) throw error;
    setSaved(data || []);
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
    <section className="hero"><h1>본문 하나로 카드뉴스 제작</h1><p>본문 분석 → 이미지 구성 → 한 장씩 제작 → 검수 → 클라우드 저장 → ZIP 다운로드</p></section>
    {error && <div className="error">{error}</div>}

    <section className="panel">
      <div className="steps">{["자료입력","분석","이미지","검수","완료"].map((x,i)=><div key={x} className={"step "+((phase==="home"||phase==="input")&&i===0||phase==="analysis"&&i===1||phase==="images"&&i===2||phase==="review"&&i===3||phase==="done"&&i===4?"active":"")}>{i+1} {x}</div>)}</div>

      {phase === "home" && <>
        <h2>새 작업</h2>
        <div className="types">{TYPES.map((t,i)=><button key={t} className={"type "+(contentType===t?"sel":"")} onClick={()=>setContentType(t)}><span className="ico">{["🏠","💡","🐾","🤖","🎬"][i]}</span><b>{t}</b><small>콘텐츠 제작</small></button>)}</div>
        <div className="actions"><button className="primary" onClick={()=>setPhase("input")}>새 작업 시작</button></div>
        <div className="box"><h3>저장 프로젝트</h3><div className="savedList">{saved.map(p=><div className="savedItem" key={p.id}><div><b>{p.project_title}</b><small>{p.content_type}</small></div><button className="secondary" onClick={()=>loadProject(p.id)}>불러오기</button></div>)}</div>{saved.length===0&&<div className="small">아직 저장된 작업이 없습니다.</div>}</div>
      </>}

      {phase === "input" && <>
        <h2>자료 입력</h2><label>작업 제목</label><input value={projectTitle} onChange={e=>setProjectTitle(e.target.value)} placeholder="예: 송도 아파트 시세"/><label>본문</label><textarea value={rawContent} onChange={e=>setRawContent(e.target.value)} placeholder="본문을 붙여넣으세요."/><div className="actions"><button className="secondary" onClick={()=>setPhase("home")}>이전</button><button className="primary" disabled={rawContent.trim().length<30||loading} onClick={analyze}>{loading?"분석 중...":"분석하기"}</button></div>
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
