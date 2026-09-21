"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Top3Work, IMAGE_SLOTS, recommendationRequest, bodyRequest, imageRequest, revision, missingEvidence, exportIssues } from "./top3-model";
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
  const confirmed = data.confirmedRevision === current && !missingEvidence(topic, body, data).length;
  const request = bodyRequest(topic, materials, data);
  const recommendation = recommendationRequest(materials, data);
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
    const imageRevision = current;
    setBusy(id); setMessage("");
    try {
      const dataUrl = await toPng(file);
      if (!alive.current) return;
      onChange((prev) => ({ ...prev, images: { ...prev.images, [id]: { dataUrl, revision: imageRevision } } }));
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

  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <h3>1. GPT에서 TOP3 주제 추천받기</h3>
      <p>GPT에서 주제 5개를 추천받고, 마음에 드는 번호를 답하면 해당 주제의 본문 요청서를 만들어 줍니다. 관심 지역은 비워 두어도 시작할 수 있어요.</p>
      <label>관심 지역 (선택)<input value={data.region} onChange={(e) => patch("region", e.target.value)} placeholder="예: 남양주시 / 비워 두면 지역도 추천" /></label>
      {promptButtons(recommendation, "GPT에서 TOP3 추천받기")}
      <details><summary>추천 요청서 펼치기</summary><pre>{recommendation}</pre></details>
      <p>GPT 답변은 자동으로 가져오지 않습니다. 선택한 주제와 GPT가 만든 요청서를 아래에 붙여넣으세요. 채팅에 요청서가 나타나지 않으면 ‘요청서 복사’를 사용하세요.</p>
      <label>선택한 TOP3 주제<input value={topic} onChange={(e) => onTopicChange(e.target.value)} placeholder="추천받은 제목 중 이번에 작성할 주제" /></label>
      <label>GPT 추천 결과·선택 후 요청서<textarea value={data.recommendations} onChange={(e) => patch("recommendations", e.target.value)} placeholder="GPT 추천 결과나 선택 후 만들어 준 본문 요청서를 붙여넣으세요." /></label>
    </section>
    <section className={styles.panel}>
      <h3>2. 본문 요청서 만들기 · 작성 결과</h3>
      <p>선택한 주제와 붙여넣은 GPT 요청서가 반영됩니다. 자료가 없어도 조사부터 요청할 수 있습니다.</p>
      {topic.trim() ? <>{promptButtons(request, "GPT에서 본문 작성하기")}<details><summary>본문 요청서 펼치기</summary><pre>{request}</pre></details></> : <p>먼저 위에 선택한 TOP3 주제를 입력하세요.</p>}
      <label>최종 본문<textarea data-testid="work-body" className={styles.body} value={body} onChange={(e) => onBodyChange(e.target.value)} placeholder="ChatGPT에서 작성한 제목·본문·태그를 붙여넣으세요." /></label>
    </section>
    <section className={styles.panel}>
      <h3>3. 조사 결과 확인 · 본문 확정</h3>
      <p>GPT가 조사한 출처와 비교 자료를 옮기고 본문과 대조하세요. 이 화면은 순위를 자동 계산하지 않습니다.</p>
      <div className={styles.grid}>
        {([
          ["region", "지역", "예: 남양주시"], ["period", "분석 기간", "예: 2026-06-01 ~ 2026-08-31"],
          ["area", "면적 조건", "예: 전용 84㎡대 / 전체 면적"], ["criterion", "순위 기준", "예: 매매 거래건수"],
          ["asOf", "자료 기준일", "예: 2026-09-21"],
        ] as const).map(([key, label, placeholder]) => <label key={key}>{label}<input value={data[key]} onChange={(e) => patch(key, e.target.value)} placeholder={placeholder} /></label>)}
      </div>
      <label>비교 범위·제외 기준<textarea value={data.scope} onChange={(e) => patch("scope", e.target.value)} placeholder="지역 전체인지 일부 분석 대상인지, 취소·중복 거래 제외 여부, 표본 수와 동률 처리 등을 적어주세요." /></label>
      <label>출처·자료 링크<textarea value={data.source} onChange={(e) => patch("source", e.target.value)} placeholder="원자료 출처, 링크, 확인 날짜" /></label>
      <label>확정 근거표<textarea value={data.facts} onChange={(e) => patch("facts", e.target.value)} placeholder="각 단지의 이름·순위·거래건수·가격·단위를 정확히 적어주세요. 근거가 없는 수치는 넣지 마세요." /></label>
      <p>확정 전에 본문과 근거표의 단지명·순위·수치·단위를 직접 대조하세요.</p>
      <button type="button" disabled={missingEvidence(topic, body, data).length > 0 || confirmed} onClick={() => patch("confirmedRevision", current)}>{confirmed ? "본문·근거 확정됨" : "본문과 근거 일치 확인 · 확정"}</button>
      {missingEvidence(topic, body, data).length > 0 && <p>확정 전 입력: {missingEvidence(topic, body, data).join(", ")}</p>}
      {!confirmed && data.confirmedRevision && <p className={styles.warning}>내용이 변경되었습니다. 다시 확정하고 이미지를 재등록해 주세요. 기존 파일은 보관됩니다.</p>}
    </section>
    <section className={styles.panel}>
      <h3>4. 이미지 요청서 · 등록</h3>
      <label className={styles.check}><input type="checkbox" checked={data.optionalImage} onChange={(e) => patch("optionalImage", e.target.checked)} />선택 이미지 03 사용 (해제해도 파일 보존)</label>
      {!confirmed && <p>본문·근거 확정 후 이미지 요청서와 업로드가 열립니다.</p>}
      <div className={styles.grid}>{slots.map((slot) => {
        const prompt = imageRequest(slot.id, topic, materials, body, data);
        const image = data.images[slot.id];
        return <article className={styles.imageCard} key={slot.id}>
          <h4>{slot.id} · {slot.name}</h4>
          <p>{slot.ratio}</p>
          <strong>{image ? image.revision === current ? "등록 완료" : "이전 내용 이미지 · 재등록 필요" : "대기"}</strong>
          {prompt && <>{promptButtons(prompt)}<details><summary>이미지 {slot.id} 요청서 펼치기</summary><pre>{prompt}</pre></details></>}
          <label>이미지 {slot.id} 등록·교체<input aria-label={`이미지 ${slot.id} 등록·교체`} type="file" accept="image/png,image/jpeg,image/webp" disabled={!confirmed || !!busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(slot.id, file); }} /></label>
          {image && <><img src={image.dataUrl} alt={`등록 이미지 ${slot.id}`} /><button type="button" disabled={!!busy} onClick={() => onChange((prev) => { const images = { ...prev.images }; delete images[slot.id]; return { ...prev, images }; })}>이미지 {slot.id} 등록 해제</button></>}
        </article>;
      })}</div>
    </section>
    <section className={styles.panel}>
      <h3>5. 최종 검수 · 내보내기</h3>
      <p>같은 브라우저에 자동 저장됩니다. 상단의 저장 완료 표시를 확인한 뒤 창을 닫아주세요.</p>
      {issues.length ? <p>준비할 항목: {issues.join(", ")}</p> : <strong className={styles.ready}>발행 준비 완료 · 실제 게시 여부는 별도 확인</strong>}
      <div className={styles.actions}>
        <button type="button" disabled={!body.trim()} onClick={() => void copy(body)}>최종 본문 복사</button>
        <button type="button" disabled={!!issues.length || !!busy} onClick={() => void download()}>ZIP 다운로드</button>
      </div>
    </section>
    <p role="status" aria-live="polite">{busy ? "처리 중… " : ""}{message}</p>
  </div>;
}
