"use client";
import { useEffect, useRef, useState } from "react";
import { Evidence, evidenceStore, MAX_FRAMES, prepareEvidence } from "./workplace-media";
import styles from "./page.module.css";
import { evidenceSteps, evidenceLabels } from "./evidence-steps";
type Props = {episodeId:string;place:string;values:Record<string,string>;onApply:(values:Record<string,string>)=>void;onCompose:()=>void;writing:boolean};
export default function EvidenceUploader({episodeId,place,values,onApply,onCompose,writing}:Props) {
 const [active,setActive]=useState(values._activeStep || "workplace");
 const step=evidenceSteps.find(s=>s.id===active);
 function go(id:string) { if(result && !window.confirm("아직 반영하지 않은 판독 결과가 있습니다. 저장하지 않고 이동할까요?")) return; setActive(id);setSelected([]);setResult(null);setNotice("");onApply({_activeStep:id}); }
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
 const scoped=files.filter(f=>f.step===active);
 const images=scoped.flatMap(f=>f.frames.map((url,i)=>({id:`${f.id}:${i}`,url,label:f.labels[i]})));
 async function upload(list:File[]) {
  setBusy(true);setNotice("첨부를 처리하고 있습니다…");setResult(null);
  try {
   for(const file of list) {
    const item=await prepareEvidence(file,episodeId);
    item.step=active;
    await evidenceStore("put",item);
    if(mounted.current){setFiles(old=>[...old,item]);setSelected(old=>[...old,...item.frames.map((_,i)=>`${item.id}:${i}`)].slice(0,MAX_FRAMES));}
   }
   if(mounted.current){onApply({["_reviewed_"+active]:""});setNotice("첨부를 저장했습니다. 분석할 화면을 선택하세요.");}
  } catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:"첨부에 실패했습니다.");}
  finally {if(mounted.current)setBusy(false);}
 }
 async function analyze() {
  const chosen=images.filter(i=>selected.includes(i.id));
  const body=JSON.stringify({images:chosen.map(({url,label})=>({url,label})),place,name:values.name,date:values.date,stage:active});
  if(new Blob([body]).size>3_900_000){setNotice("선택 화면 용량이 큽니다. 선택 수를 줄여 나눠 분석하세요.");return;}
  setBusy(true);setResult(null);setNotice("선택한 화면에서 정보를 읽고 있습니다…");
  try {
   const r=await fetch("/api/apartment/workplace-evidence",{method:"POST",headers:{"Content-Type":"application/json"},body,signal:AbortSignal.timeout(60000)});
   const data=await r.json();if(!r.ok)throw new Error(data.error||"분석에 실패했습니다.");
   if(!data.values||Object.values(data.values).some(v=>typeof v!=="string"))throw new Error("결과 형식을 확인하지 못했습니다.");
   if(mounted.current){setResult(data.values);setApplyKeys(Object.keys(data.values).filter(k=>data.values[k]&& (k==="sources" || k==="notes" || !values[k]?.trim())));setNotice("판독 결과를 확인하고 반영할 항목을 선택하세요. 기존 입력값은 자동으로 덮어쓰지 않습니다.");}
  }catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:"분석에 실패했습니다.");}
  finally{if(mounted.current)setBusy(false);}
 }
 const labels=evidenceLabels;
 return <section className={styles.evidence} aria-label="캡처·영상 첨부">
  <h3>필요한 자료를 하나씩 첨부하면 글이 됩니다</h3>
  <p>자료 위치 확인 → 캡처·영상 첨부 → 내용 읽기 → 검토 후 반영 → 다음 자료</p>
  <nav className={styles.stepNav} aria-label="자료 준비 순서">
   {evidenceSteps.map((s,i)=><button key={s.id} type="button" disabled={busy} aria-current={active===s.id?"step":undefined} onClick={()=>go(s.id)}>
    {i+1}. {s.title}<small>{values["_reviewed_"+s.id]?"내용 반영됨":values["_skip_"+s.id]?"미확보 사유 기록":files.some(f=>f.step===s.id)?"첨부됨 · 검토 필요":"자료 필요"}</small>
   </button>)}
   <button type="button" disabled={busy} aria-current={active==="article"?"step":undefined} onClick={()=>go("article")}>8. 글 작성</button>
  </nav>
  {files.some(f=>!f.step)&&<details><summary>이전에 첨부한 자료 분류하기</summary>{files.filter(f=>!f.step).map(f=><label key={f.id}>{f.name}<select defaultValue="" disabled={busy} onChange={async e=>{const updated={...f,step:e.target.value};try{await evidenceStore("put",updated);setFiles(old=>old.map(x=>x.id===f.id?updated:x));}catch{setNotice("분류를 저장하지 못했습니다.");}}}><option value="" disabled>자료 종류 선택</option>{evidenceSteps.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>)}</details>}
  {active==="article"?<div>
   <h3>중요한 내용만 담은 단지별 글</h3>
   <p>단지 기본정보 → 출퇴근 경로 → 매매·전세·월세 가격표 → 입주 전 확인사항 순서로 작성합니다.</p>
   <ul>{evidenceSteps.map(s=><li key={s.id}>{s.title}: {values["_reviewed_"+s.id]?"판독 내용 반영 · 최종 대조 필요":values["_skip_"+s.id]?"확인 필요 — "+values["_skip_"+s.id]:"아직 내용 반영 전"}</li>)}</ul>
   <p>자료가 부족해도 초안을 만들 수 있습니다. 미확인 값은 확인 필요로 남기며, 첨부만으로 검증 완료로 표시하지 않습니다.</p>
   <div className={styles.actions}><button type="button" className={styles.primary} disabled={writing} onClick={onCompose}>{writing?"글 작성 중…":"중요한 내용만 글 작성"}</button></div>
  </div>:step&&<>
  <div className={styles.stepGuide}><h3>{evidenceSteps.indexOf(step)+1}. {step.title} 자료를 올려주세요</h3>
   <a href={step.url} target="_blank" rel="noreferrer">{step.source} ↗</a>
   <p>{step.instructions}</p><strong>화면에 보여야 할 내용</strong><ul>{step.needs.map(n=><li key={n}>{n}</li>)}</ul>
  </div>
  <label>자료 첨부<input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" disabled={busy||!ready} onChange={e=>{const list=Array.from(e.target.files||[]);e.target.value="";if(list.length)void upload(list);}} /></label>
  <p className={styles.hint}>파일당 50MB·영상 60초 이내. 긴 캡처는 나눠 읽고 영상은 최대 12개 화면을 추출합니다. 빠르게 지나간 정보는 빠질 수 있으니 화면을 천천히 내려주세요.</p>
  {scoped.map(f=><div key={f.id} className={styles.evidenceFile}>
   <strong>{f.name}</strong> <span>{f.frames.length}개 화면</span>
   <button type="button" disabled={busy} onClick={async()=>{try{await evidenceStore("delete",f.id);setFiles(old=>old.filter(x=>x.id!==f.id));setSelected(old=>old.filter(x=>!x.startsWith(f.id+":")));setResult(null);onApply({["_reviewed_"+active]:""});}catch(e){setNotice(e instanceof Error?e.message:"삭제 실패");}}}>첨부 삭제</button>
  </div>)}
  <div className={styles.evidenceFrames}>{images.map(i=><label key={i.id}>
   <input type="checkbox" checked={selected.includes(i.id)} disabled={busy} onChange={e=>{if(e.target.checked&&selected.length>=MAX_FRAMES){setNotice("한 번에 최대 12개 화면을 분석할 수 있습니다.");return;}setSelected(old=>e.target.checked?[...old,i.id]:old.filter(x=>x!==i.id));setResult(null);}} />
   <img src={i.url} alt={i.label} loading="lazy" /> <small>{i.label}</small>
   <a href={i.url} target="_blank" rel="noreferrer">크게 보기</a>
  </label>)}</div>
  <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||!selected.length} onClick={analyze}>이 단계 자료 읽기 ({selected.length}개 화면)</button></div>
  <p className={styles.hint}>첨부 원본은 이 브라우저에 저장됩니다. 분석을 누르면 선택한 이미지·영상 화면과 단지명·근무지·확인일을 AI 판독 서비스에 전송합니다. 민감한 정보는 가린 뒤 첨부하세요.</p>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {result&&<div className={styles.checks}>
   <h3>판독 결과 검토</h3>
   <p>선택한 항목만 입력칸에 반영합니다. 출처와 메모는 기존 기록에 추가합니다. 기존 값이 있으면 내용을 비교하세요. 반영 후에도 원고는 ‘짧은 원고 만들기’로 별도 생성합니다.</p>
   {Object.entries(result).filter(([key])=>key in labels).map(([key,text])=><div key={key}>
    <label><input type="checkbox" checked={applyKeys.includes(key)} disabled={!text.trim()} onChange={e=>setApplyKeys(old=>e.target.checked?[...old,key]:old.filter(k=>k!==key))}/>{labels[key]}{values[key]?.trim()?" · 기존 값 있음":""}</label>
    {values[key]?.trim()&&<p className={styles.hint}>기존: {values[key]}</p>}
    <textarea aria-label={`${labels[key]} 판독 결과`} rows={3} value={text} onChange={e=>setResult(old=>old?{...old,[key]:e.target.value}:old)} />
   </div>)}
   <div className={styles.actions}><button type="button" disabled={!applyKeys.length} onClick={()=>{
    const patch=Object.fromEntries(applyKeys.filter(k=>result[k]?.trim()).map(k=>[k,(k==="sources"||k==="notes")&&values[k]?.trim()?values[k]+"\n\n["+step.title+"]\n"+result[k]:result[k]]));
    patch["_reviewed_"+active]="1";patch["_skip_"+active]="";
    onApply(patch);setResult(null);setNotice("선택한 판독 결과를 입력칸에 반영했습니다. 원자료와 대조한 뒤 원고를 만드세요.");
   }}>선택 항목 반영</button><button type="button" onClick={()=>setResult(null)}>결과 닫기</button></div>
  </div>}
  <details className={styles.stepManual}><summary>자료가 없거나 읽기에 실패했나요?</summary>
   <label>미확보 사유 또는 확인할 내용<textarea rows={2} value={values["_skip_"+active]||""} onChange={e=>onApply({["_skip_"+active]:e.target.value,["_reviewed_"+active]:""})} placeholder="예: 전세 매물 확인 불가 / 직원 출입구 확인 필요" /></label>
   <p>‘없음’과 ‘확인 불가’를 구분해주세요. 숫자를 추정하지 않고 다음 단계로 넘어갈 수 있습니다.</p>
   {step.fields.map(key=><label key={key}>{labels[key]} · 직접 정리<textarea rows={3} value={values[key]||""} onChange={e=>onApply({[key]:e.target.value,["_reviewed_"+active]:""})} /></label>)}
  </details>
  <div className={styles.actions}>
   <button type="button" disabled={busy||evidenceSteps.indexOf(step)===0} onClick={()=>go(evidenceSteps[Math.max(0,evidenceSteps.indexOf(step)-1)].id)}>이전 자료</button>
   <button type="button" disabled={busy} className={styles.primary} onClick={()=>go(evidenceSteps[evidenceSteps.indexOf(step)+1]?.id||"article")}>다음: {evidenceSteps[evidenceSteps.indexOf(step)+1]?.title||"글 작성"} →</button>
  </div>
  </>}
 </section>;
}
