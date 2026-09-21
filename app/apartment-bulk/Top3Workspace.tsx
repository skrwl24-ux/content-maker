"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Top3Work, IMAGE_SLOTS, imageRevision, revision } from "./top3-model";
import { articleRequest, parseArticle, imageRequest, exportIssues } from "./top3-simple";
import styles from "./top3.module.css";

type Props = {
  workId: string; topic: string; materials: string; body: string;
  onBodyChange: (body: string) => void;
  onTopicChange: (topic: string) => void;
  data: Top3Work; onChange: Dispatch<SetStateAction<Top3Work>>;
};

async function toPng(file: File): Promise<string> {
  if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error("PNG, JPG, WEBP 파일을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하 이미지를 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.width || !img.height || img.width * img.height > 40_000_000) throw new Error("이미지 크기를 확인해 주세요. 최대 4천만 픽셀을 지원합니다.");
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 변환할 수 없습니다.");
    context.drawImage(img, 0, 0);
    const result = canvas.toDataURL("image/png");
    if (!result.startsWith("data:image/png;base64,")) throw new Error("PNG 변환에 실패했습니다.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}

export default function Top3Workspace({ workId, topic, materials, body, onBodyChange, onTopicChange, data, onChange }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = revision(topic, materials, body, data);
  const request = articleRequest(topic, materials);
  const issues = exportIssues(topic, materials, body, data);
  const slots = IMAGE_SLOTS.filter((slot) => slot.id !== "03" || data.optionalImage);
  const patch = (key: keyof Top3Work, value: string | boolean) => onChange((prev) => ({ ...prev, [key]: value }));

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); if (alive.current) setMessage("복사했습니다. 새 채팅에 붙여넣을 수 있어요."); }
    catch { if (alive.current) setMessage("복사하지 못했습니다. 요청서 펼치기에서 직접 선택해 복사해 주세요."); }
  }

  function promptButtons(text: string, label = "ChatGPT 열기") {
    return <div className={styles.actions}>
      <a href={"https://chatgpt.com/?q=" + encodeURIComponent(text)} target="_blank" rel="noopener noreferrer">{label}</a>
      <button type="button" onClick={() => void copy(text)}>요청서 복사</button>
    </div>;
  }

  async function upload(id: string, file: File) {
    const uploadedRevision = imageRevision(id, current, data);
    setBusy(id); setMessage("");
    try {
      const dataUrl = await toPng(file);
      if (!alive.current) return;
      onChange((prev) => ({ ...prev, images: { ...prev.images, [id]: { dataUrl, revision: uploadedRevision } } }));
      setMessage(`이미지 ${id} 등록 완료. 원본 비율·크기를 유지해 PNG로 저장합니다.`);
    } catch (error) { if (alive.current) setMessage(`${error instanceof Error ? error.message : "등록 실패"} 기존 이미지는 유지됩니다.`); }
    finally { if (alive.current) setBusy(""); }
  }

  async function download() {
    if (issues.length || busy) return;
    setBusy("zip"); setMessage("");
    try {
      const zip = new JSZip();
      const folder = zip.folder(workId.replace(/[^a-zA-Z0-9_-]/g, "_"))!;
      folder.file("final_post.txt", body);
      folder.file("article_request.txt", request);
      folder.file("image_prompts.txt", slots.map((slot) => imageRequest(slot.id, topic, materials, body, data)).join("\n\n---\n\n"));
      folder.file("evidence.json", JSON.stringify({ topic, materials, region: data.region, period: data.period, area: data.area, criterion: data.criterion, source: data.source, asOf: data.asOf, scope: data.scope, facts: data.facts }, null, 2));
      for (const slot of slots) {
        const payload = data.images[slot.id].dataUrl.split(",")[1];
        const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
        if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw new Error(`이미지 ${slot.id}의 PNG 형식을 확인해 주세요.`);
        folder.file(slot.file, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${workId}.zip`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("ZIP 다운로드를 요청했습니다. 실제 블로그 게시 후 발행 완료를 체크해 주세요.");
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : "ZIP 생성 실패"); }
    finally { if (alive.current) setBusy(""); }
  }

  function importResult() {
    try {
      const parsed = parseArticle(data.recommendations);
      const nextRevision = revision(parsed.topic, materials, parsed.body, data);
      onTopicChange(parsed.topic);
      onBodyChange(parsed.body);
      onChange(prev => ({ ...prev, optionalImage: !!parsed.plans["03"], imagePlans: Object.fromEntries(Object.entries(parsed.plans).map(([id, text]) => [id, { text, revision: nextRevision }])) }));
      setMessage("본문과 이미지 항목을 나눴습니다. 아래에서 이미지별로 GPT에 요청하세요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "답변을 확인해 주세요. 기존 본문과 이미지는 유지됩니다."); }
  }

  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <h3>1. GPT에서 TOP3 글 만들기</h3>
      <p>GPT가 주제를 추천·선정하고, 본문과 필요한 이미지 내용을 한 번에 작성합니다.</p>
      {promptButtons(request, "GPT에서 TOP3 글 만들기")}
      <details><summary>글 요청서 보기</summary><pre>{request}</pre></details>
    </section>
    <section className={styles.panel}>
      <h3>2. GPT 답변 전체 붙여넣기</h3>
      <p>제목·본문·이미지 항목이 포함된 GPT 답변 전체를 붙여넣으세요. 채팅에 요청서가 나타나지 않으면 요청서 복사를 사용하세요.</p>
      <label>GPT 답변<textarea value={data.recommendations} onChange={e => patch("recommendations", e.target.value)} placeholder="[제목], [본문], [이미지 00] 등이 포함된 답변 전체" /></label>
      <button type="button" disabled={!data.recommendations.trim() || !!busy} onClick={importResult}>본문·이미지 항목 나누기</button>
      <details><summary>나눈 본문 확인·수정</summary><label>본문<textarea className={styles.body} value={body} onChange={e => onBodyChange(e.target.value)} /></label></details>
    </section>
    <section className={styles.panel}>
      <h3>3. 이미지별 GPT에서 만들기</h3>
      <p>각 버튼은 해당 이미지의 내용과 본문을 함께 담은 요청서를 엽니다. GPT에서 생성한 이미지를 내려받아 등록하세요.</p>
      <label className={styles.check}><input type="checkbox" checked={data.optionalImage} onChange={e => patch("optionalImage", e.target.checked)} />선택 이미지 03 사용</label>
      <div className={styles.grid}>{slots.map(slot => {
        const prompt = imageRequest(slot.id, topic, materials, body, data);
        const plan = data.imagePlans?.[slot.id];
        const image = data.images[slot.id];
        return <article className={styles.imageCard} key={slot.id}>
          <h4>{slot.id} · {slot.name}</h4>
          <label>이미지에 들어갈 내용<textarea value={plan?.text || ""} onChange={e => { const text = e.target.value; onChange(prev => ({ ...prev, imagePlans: { ...prev.imagePlans, [slot.id]: { text, revision: current } } })); }} placeholder="GPT 답변을 나누면 여기에 이미지 내용이 들어옵니다. 직접 수정할 수도 있어요." /></label>
          {prompt ? <>{promptButtons(prompt, `GPT에서 이미지 ${slot.id} 만들기`)}<details><summary>이미지 요청서 보기</summary><pre>{prompt}</pre></details></> : <p>본문과 이 이미지의 내용을 넣으면 만들기 버튼이 나타납니다.</p>}
          <strong>{image ? image.revision === imageRevision(slot.id, current, data) ? "등록 완료" : "내용 변경됨 · 이미지 재등록 필요" : "이미지 등록 대기"}</strong>
          <label>생성 이미지 등록<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!prompt || !!busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(slot.id, file); }} /></label>
          {image && <><img src={image.dataUrl} alt={`등록 이미지 ${slot.id}`} /><button type="button" disabled={!!busy} onClick={() => onChange(prev => { const images = { ...prev.images }; delete images[slot.id]; return { ...prev, images }; })}>등록 해제</button></>}
        </article>;
      })}</div>
    </section>
    <section className={styles.panel}>
      <h3>4. 저장 · 다운로드</h3>
      <p>같은 브라우저에 자동 저장됩니다. 저장 완료 표시를 확인한 뒤 창을 닫으세요.</p>
      {issues.length > 0 && <p>남은 항목: {issues.join(", ")}</p>}
      <div className={styles.actions}><button type="button" disabled={!body.trim()} onClick={() => void copy(body)}>본문 복사</button><button type="button" disabled={!!issues.length || !!busy} onClick={() => void download()}>ZIP 다운로드</button></div>
    </section>
    <p role="status" aria-live="polite">{busy ? "처리 중… " : ""}{message}</p>
  </div>;
}
