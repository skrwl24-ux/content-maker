"use client";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import EvidenceUploader from "./EvidenceUploader";
type Episode = { id: string; values: Record<string, string>; article: string; status: string };
const KEY = "jibssuk-workplace-series-v1";
const fields = [
 ["name", "단지명"], ["address", "주소·사용승인일"], ["area", "비교 전용면적(㎡)"],
 ["route", "출퇴근 경로·거리·시간·출입구 확인 여부"],
 ["sale", "매매 실거래(계약일·층·금액·해제 여부)"],
 ["listing", "현재 호가(거래 유형·가격·확인일·중복 가능성)"],
 ["rent", "전세 실거래(계약일·층·보증금·갱신·해제 여부)"],
 ["monthly", "월세 실거래(계약일·층·보증금·월세·갱신·해제 여부)"],
 ["caution", "입주 전 확인사항"], ["sources", "항목별 출처 링크·캡처명·확인 범위"],
 ["notes", "캡처·영상 자료 메모"],
];
const value = (s?: string) => s?.trim() || "확인 필요(needs_check)";
export default function SeriesWorkspace({ place }: { place: string }) {
 const [episodes, setEpisodes] = useState<Episode[]>([]);
 const [selected, setSelected] = useState("");
 const [loaded, setLoaded] = useState(false);
 const [writing, setWriting] = useState(false);
 const [notice, setNotice] = useState("");
 useEffect(() => {
  try {
   const saved = JSON.parse(localStorage.getItem(KEY) || "null");
   if(saved) {
    if(!Array.isArray(saved.episodes) || !saved.episodes.every((e: Episode) => e && typeof e.id === "string" && e.values && typeof e.article === "string" && typeof e.status === "string" && Object.values(e.values).every(v => typeof v === "string"))) throw new Error("Invalid saved data");
    setEpisodes(saved.episodes); setSelected(saved.selected || "");
   }
   setLoaded(true);
  } catch { setNotice("저장 자료를 불러오지 못했습니다. 기존 자료 보호를 위해 자동 저장을 중지했습니다."); }
 }, []);
 useEffect(() => {
  if(!loaded) return;
  try { localStorage.setItem(KEY, JSON.stringify({episodes, selected})); }
  catch { setNotice("자동 저장에 실패했습니다. 원고를 복사해 보관하세요."); }
 }, [episodes, selected, loaded]);
 const current = episodes.find(e => e.id === selected) || episodes[0];
 function update(patch: Partial<Episode>) { if(current) setEpisodes(old => old.map(e => e.id === current.id ? {...e, ...patch} : e)); }
 function field(key: string, text: string) { update({values: {...current.values, [key]: text}}); }
 async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); setNotice("복사했습니다."); }
  catch { setNotice("복사에 실패했습니다. 원고를 직접 선택해 복사하세요."); }
 }
 async function compose() {
  if(current.article && !window.confirm("편집 중인 원고를 입력 자료로 다시 만들까요?")) return;
  const v = current.values;
  const cell = (s?: string) => value(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " / ");
  const article = `# ${place || "근무지"} 출퇴근 아파트 ${episodes.indexOf(current)+1}편 · ${value(v.name)}\n\n${value(v.route)}\n\n- 주소·사용승인: ${value(v.address)}\n- 비교 전용면적: ${value(v.area)}\n\n| 구분 | 확인 내용 |\n|---|---|\n| 매매 실거래 | ${cell(v.sale)} |\n| 현재 매물 호가 | ${cell(v.listing)} |\n| 전세 실거래 | ${cell(v.rent)} |\n| 월세 실거래 | ${cell(v.monthly)} |\n\n입주 전 확인: ${value(v.caution)}\n\n실거래는 과거 계약금액이며 현재 입주 가능한 가격을 뜻하지 않습니다.\n\n자료 확인일: ${value(v.date)}\n출처·검증 범위: ${value(v.sources)}${Object.entries(v).filter(([k,text])=>k.startsWith("_skip_")&&text.trim()).length ? "\n\n미확보 자료:\n"+Object.entries(v).filter(([k,text])=>k.startsWith("_skip_")&&text.trim()).map(([,text])=>"- "+text).join("\n") : ""}`;
  setWriting(true);setNotice("첨부에서 확인한 자료로 짧은 글을 작성하고 있습니다…");
  try {
   const response = await fetch("/api/apartment/workplace-article", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({place,episode:episodes.indexOf(current)+1,values:v}),signal:AbortSignal.timeout(60000)});
   const result = await response.json();
   if(!response.ok || typeof result.article!=="string") throw new Error(result.error||"AI 글 작성 실패");
   update({article:result.article,status:current.status === "자료 수집" ? "초안 작성" : current.status});
   setNotice("글을 작성했습니다. 아래 원고를 확인하고 수정·복사하세요.");
  } catch(e) {
   update({article,status:current.status === "자료 수집" ? "초안 작성" : current.status});
   setNotice((e instanceof Error ? e.message : "AI 연결 실패")+" 입력 자료를 그대로 배치한 기본 초안을 만들었습니다. AI 작성 결과가 아닙니다.");
  } finally {setWriting(false);}

 }
 return <section className={styles.output} aria-label="단지별 시리즈 작업판">
  <h2>단지별 시리즈 작업판</h2>
  <p>한 단지에 한 편씩. 기본정보 → 출퇴근 경로 → 가격표 → 확인사항만 짧게 정리합니다.</p>
  <div className={styles.actions}>
   {episodes.map((e,i) => <button type="button" key={e.id} aria-pressed={e.id === current?.id} className={e.id === current?.id ? styles.primary : styles.secondary} onClick={() => setSelected(e.id)}>{i+1}편 · {e.values.name || "새 단지"} · {e.status}</button>)}
   <button type="button" disabled={!loaded} onClick={() => {
    const e = {id: crypto.randomUUID(), values: {date: new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Seoul"})}, article:"", status:"자료 수집"};
    setEpisodes(old => [...old,e]); setSelected(e.id);
   }}>＋ 단지 추가</button>
  </div>
  {current ? <div className={styles.panel} style={{marginTop:20}}>
   <EvidenceUploader key={current.id} episodeId={current.id} place={place} values={current.values} writing={writing} onCompose={compose} onApply={patch => { setEpisodes(old => old.map(e => e.id === current.id ? {...e, values: {...e.values, ...patch}} : e)); }} />
   <details><summary>단지 정보·자료 직접 수정 (선택)</summary>
   <div className={styles.two}>
    <label>진행 상태<select value={current.status} onChange={e => update({status:e.target.value})}>{["자료 수집","초안 작성","검토 완료","발행 완료"].map(s => <option key={s}>{s}</option>)}</select></label>
    <label>자료 확인일<input type="date" value={current.values.date || ""} onChange={e => field("date", e.target.value)} /></label>
    {fields.map(([key,label]) => <label key={key}>{label}<textarea rows={key === "notes" || key === "sources" ? 4 : 2} value={current.values[key] || ""} onChange={e => field(key,e.target.value)} placeholder="미확인 항목은 비워두거나 확인 필요로 기록" /></label>)}
   </div>
   <div className={styles.actions}>
    <button type="button" className={styles.primary} disabled={writing} onClick={compose}>{writing?"작성 중…":"짧은 원고 만들기"}</button>
    <button type="button" onClick={() => copy(`[${value(current.values.name)} 자료 정리 요청]\n근무지: ${place}\n확인일: ${value(current.values.date)}\n첨부한 캡처·영상에서 단지 기본정보, 같은 전용면적의 매매·전세·월세 실거래, 현재 호가, 실제 출입구 간 경로를 정리해줘. 계약일·층·해제·갱신·중복 여부와 항목별 출처를 구분하고 미확인은 needs_check로 남겨줘. 네이버의 국토부 제공 자료와 국토부 원문 직접 대조 여부를 구분해줘. 숫자를 추정하지 마.\n기존 입력 자료:\n${JSON.stringify(current.values,null,2)}`)}>자료 정리 요청 복사</button>
   </div>
   </details>
   <label style={{marginTop:20}}>편집 가능한 원고<textarea rows={15} disabled={writing} value={current.article} onChange={e => update({article:e.target.value})} /></label>
   <div className={styles.actions}><button type="button" disabled={!current.article.trim()} onClick={() => copy(current.article)}>원고 복사</button></div>
  </div> : <p className={styles.hint}>‘단지 추가’로 1편을 시작하세요.</p>}
  {notice && <p role="status" className={styles.notice}>{notice}</p>}
  <p className={styles.hint}>단지별 자료·원고·상태는 이 브라우저에 자동 저장됩니다. 빈 항목은 확인 필요로 표시합니다. 첨부 화면 판독 후 검토한 항목만 반영하세요. 실제 발행과 진행 상태는 직접 관리합니다.</p>
 </section>;
}
