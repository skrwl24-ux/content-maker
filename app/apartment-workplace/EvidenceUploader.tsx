"use client";
import { useEffect, useRef, useState } from "react";
import { Evidence, evidenceStore, MAX_FRAMES, prepareEvidence } from "./workplace-media";
import styles from "./page.module.css";
type Props = {episodeId:string;place:string;values:Record<string,string>;onApply:(values:Record<string,string>)=>void};
export default function EvidenceUploader({episodeId,place,values,onApply}:Props) {
 const [files,setFiles]=useState<Evidence[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [notice,setNotice]=useState("");
 const [result,setResult]=useState<Record<string,string>|null>(null);
 const [applyKeys,setApplyKeys]=useState<string[]>([]);
 const mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;
  evidenceStore("load").then(all=>{if(mounted.current){setFiles(all.filter(f=>f.episodeId===episodeId));setReady(true);}}).catch(e=>{if(mounted.current)setNotice(e.message);});
  return()=>{mounted.current=false;};
 },[episodeId]);
 const images=files.flatMap(f=>f.frames.map((url,i)=>({id:`${f.id}:${i}`,url,label:f.labels[i]})));
 async function upload(list:File[]) {
  setBusy(true);setNotice("첨부를 처리하고 있습니다…");setResult(null);
  try {
   for(const file of list) {
    const item=await prepareEvidence(file,episodeId);
    await evidenceStore("put",item);
    if(mounted.current){setFiles(old=>[...old,item]);setSelected(old=>[...old,...item.frames.map((_,i)=>`${item.id}:${i}`)].slice(0,MAX_FRAMES));}
   }
   if(mounted.current)setNotice("첨부를 저장했습니다. 분석할 화면을 선택하세요.");
  } catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:"첨부에 실패했습니다.");}
  finally {if(mounted.current)setBusy(false);}
 }
 async function analyze() {
  const chosen=images.filter(i=>selected.includes(i.id));
  const body=JSON.stringify({images:chosen.map(({url,label})=>({url,label})),place,name:values.name,date:values.date});
  if(new Blob([body]).size>3_900_000){setNotice("선택 화면 용량이 큽니다. 선택 수를 줄여 나눠 분석하세요.");return;}
  setBusy(true);setResult(null);setNotice("선택한 화면에서 정보를 읽고 있습니다…");
  try {
   const r=await fetch("/api/apartment/workplace-evidence",{method:"POST",headers:{"Content-Type":"application/json"},body,signal:AbortSignal.timeout(60000)});
   const data=await r.json();if(!r.ok)throw new Error(data.error||"분석에 실패했습니다.");
   if(!data.values||Object.values(data.values).some(v=>typeof v!=="string"))throw new Error("결과 형식을 확인하지 못했습니다.");
   if(mounted.current){setResult(data.values);setApplyKeys(Object.keys(data.values).filter(k=>data.values[k]&&!values[k]?.trim()));setNotice("판독 결과를 확인하고 반영할 항목을 선택하세요. 기존 입력값은 자동으로 덮어쓰지 않습니다.");}
  }catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:"분석에 실패했습니다.");}
  finally{if(mounted.current)setBusy(false);}
 }
 const labels:Record<string,string>={name:"단지명",address:"주소·사용승인일",area:"면적",route:"출퇴근 경로",sale:"매매 실거래",listing:"현재 호가",rent:"전세 실거래",monthly:"월세 실거래",caution:"확인사항",sources:"출처",notes:"자료 메모"};
 return <section className={styles.evidence} aria-label="캡처·영상 첨부">
  <h3>① 캡처·영상 첨부 → ② 판독 결과 확인 → ③ 원고 만들기</h3>
  <label>자료 첨부<input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" disabled={busy||!ready} onChange={e=>{const list=Array.from(e.target.files||[]);e.target.value="";if(list.length)void upload(list);}} /></label>
  <p className={styles.hint}>파일당 50MB·영상 60초 이내. 긴 캡처는 나눠 읽고 영상은 최대 12개 화면을 추출합니다. 빠르게 지나간 정보는 빠질 수 있으니 화면을 천천히 내려주세요.</p>
  {files.map(f=><div key={f.id} className={styles.evidenceFile}>
   <strong>{f.name}</strong> <span>{f.frames.length}개 화면</span>
   <button type="button" disabled={busy} onClick={async()=>{try{await evidenceStore("delete",f.id);setFiles(old=>old.filter(x=>x.id!==f.id));setSelected(old=>old.filter(x=>!x.startsWith(f.id+":")));setResult(null);}catch(e){setNotice(e instanceof Error?e.message:"삭제 실패");}}}>첨부 삭제</button>
  </div>)}
  <div className={styles.evidenceFrames}>{images.map(i=><label key={i.id}>
   <input type="checkbox" checked={selected.includes(i.id)} disabled={busy} onChange={e=>{if(e.target.checked&&selected.length>=MAX_FRAMES){setNotice("한 번에 최대 12개 화면을 분석할 수 있습니다.");return;}setSelected(old=>e.target.checked?[...old,i.id]:old.filter(x=>x!==i.id));setResult(null);}} />
   <img src={i.url} alt={i.label} loading="lazy" /> <small>{i.label}</small>
   <a href={i.url} target="_blank" rel="noreferrer">크게 보기</a>
  </label>)}</div>
  <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||!selected.length} onClick={analyze}>선택한 {selected.length}개 화면 분석</button></div>
  <p className={styles.hint}>첨부 원본은 이 브라우저에 저장됩니다. 분석을 누르면 선택한 이미지·영상 화면과 단지명·근무지·확인일을 AI 판독 서비스에 전송합니다. 민감한 정보는 가린 뒤 첨부하세요.</p>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {result&&<div className={styles.checks}>
   <h3>판독 결과 검토</h3>
   <p>선택한 항목만 입력칸에 반영합니다. 기존 값이 있으면 내용을 비교하세요. 반영 후에도 원고는 ‘짧은 원고 만들기’로 별도 생성합니다.</p>
   {Object.entries(result).filter(([key])=>key in labels).map(([key,text])=><div key={key}>
    <label><input type="checkbox" checked={applyKeys.includes(key)} disabled={!text.trim()} onChange={e=>setApplyKeys(old=>e.target.checked?[...old,key]:old.filter(k=>k!==key))}/>{labels[key]}{values[key]?.trim()?" · 기존 값 있음":""}</label>
    {values[key]?.trim()&&<p className={styles.hint}>기존: {values[key]}</p>}
    <textarea aria-label={`${labels[key]} 판독 결과`} rows={3} value={text} onChange={e=>setResult(old=>old?{...old,[key]:e.target.value}:old)} />
   </div>)}
   <div className={styles.actions}><button type="button" disabled={!applyKeys.length} onClick={()=>{
    const patch=Object.fromEntries(applyKeys.filter(k=>result[k]?.trim()).map(k=>[k,result[k]]));
    onApply(patch);setResult(null);setNotice("선택한 판독 결과를 입력칸에 반영했습니다. 원자료와 대조한 뒤 원고를 만드세요.");
   }}>선택 항목 반영</button><button type="button" onClick={()=>setResult(null)}>결과 닫기</button></div>
  </div>}
 </section>;
}
