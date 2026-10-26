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
export default function SeriesWorkspace({ place }: { place: string }) {
 const [episodes, setEpisodes] = useState<Episode[]>([]);
 const [selected, setSelected] = useState("");
 const [loaded, setLoaded] = useState(false);
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
 return <section className={styles.output} aria-label="단지별 시리즈 작업판">
  <h2>단지별 시리즈 작업판</h2>
  <p>한 단지에 한 편씩. 자료 수집 → 요청서·자료 ZIP → 챗에서 글 작성 → 완성 원고 보관.</p>
  <div className={styles.actions}>
   {episodes.map((e,i) => <button type="button" key={e.id} aria-pressed={e.id === current?.id} className={e.id === current?.id ? styles.primary : styles.secondary} onClick={() => setSelected(e.id)}>{i+1}편 · {e.values.name || "새 단지"} · {e.status}</button>)}
   <button type="button" disabled={!loaded} onClick={() => {
    const e = {id: crypto.randomUUID(), values: {date: new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Seoul"})}, article:"", status:"자료 수집"};
    setEpisodes(old => [...old,e]); setSelected(e.id);
   }}>＋ 단지 추가</button>
  </div>
  {current ? <div className={styles.panel} style={{marginTop:20}}>
   <div className={styles.two}><label>이번 편의 단지명<input value={current.values.name||""} onChange={e=>field("name",e.target.value)} placeholder="예: 화서주공3단지" /></label><label>자료를 모은 날짜<input type="date" value={current.values.date||""} onChange={e=>field("date",e.target.value)} /></label></div>
   <EvidenceUploader key={current.id} episodeId={current.id} place={place} values={current.values} onApply={patch => { setEpisodes(old => old.map(e => e.id === current.id ? {...e, values: {...e.values, ...patch}} : e)); }} />
   <details><summary>단지 정보·자료 직접 수정 (선택)</summary>
   <div className={styles.two}>
    <label>진행 상태<select value={current.status} onChange={e => update({status:e.target.value})}>{["자료 수집","초안 작성","검토 완료","발행 완료"].map(s => <option key={s}>{s}</option>)}</select></label>
    <label>자료 확인일<input type="date" value={current.values.date || ""} onChange={e => field("date", e.target.value)} /></label>
    {fields.map(([key,label]) => <label key={key}>{label}<textarea rows={key === "notes" || key === "sources" ? 4 : 2} value={current.values[key] || ""} onChange={e => field(key,e.target.value)} placeholder="미확인 항목은 비워두거나 확인 필요로 기록" /></label>)}
   </div>
   </details>
   <label style={{marginTop:20}}>챗에서 받은 원고 붙여넣기<textarea rows={15} value={current.article} onChange={e => update({article:e.target.value})} /></label>
   <div className={styles.actions}><button type="button" disabled={!current.article.trim()} onClick={() => copy(current.article)}>원고 복사</button></div>
  </div> : <p className={styles.hint}>‘단지 추가’로 1편을 시작하세요.</p>}
  {notice && <p role="status" className={styles.notice}>{notice}</p>}
  <p className={styles.hint}>단지별 첨부·메모·챗에서 받은 원고는 이 브라우저에 저장됩니다. 자료 확인과 글 작성은 챗에서 진행하고, 완성 원고를 여기에 붙여넣어 보관하세요.</p>
 </section>;
}
