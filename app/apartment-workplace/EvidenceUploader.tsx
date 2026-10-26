"use client";
import { useEffect, useRef, useState } from "react";
import { Evidence, evidenceStore, prepareEvidence } from "./workplace-media";
import { buildWorkplaceHandoff, safeFileName } from "../../lib/workplace-handoff";
import styles from "./page.module.css";
import { evidenceSteps } from "./evidence-steps";
type Props={episodeId:string;place:string;values:Record<string,string>;onApply:(values:Record<string,string>)=>void};
export default function EvidenceUploader({episodeId,place,values,onApply}:Props) {
 const [active,setActive]=useState(evidenceSteps.some(s=>s.id===values._activeStep)||values._activeStep==="article"?values._activeStep:"workplace");
 const step=evidenceSteps.find(s=>s.id===active);
 const [files,setFiles]=useState<Evidence[]>([]);
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [notice,setNotice]=useState("");
 const mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;
  evidenceStore("load").then(all=>{if(mounted.current){setFiles(all.filter(f=>f.episodeId===episodeId));setReady(true);}}).catch(e=>{if(mounted.current)setNotice(e.message);});
  return()=>{mounted.current=false;};
 },[episodeId]);
 const scoped=files.filter(f=>f.step===active);
 const bundle=buildWorkplaceHandoff(place,values,files,evidenceSteps,active==="article"?undefined:active);
 function go(id:string){setActive(id);setNotice("");onApply({_activeStep:id});}
 async function upload(list:File[]) {
  setBusy(true);setNotice("자료를 보관하고 있습니다…");
  try {
   for(const file of list){const item=await prepareEvidence(file,episodeId);item.step=active;await evidenceStore("put",item);if(mounted.current)setFiles(old=>[...old,item]);}
   if(mounted.current)setNotice("자료를 보관했습니다. 다음 자료를 모으거나 이 단계 자료를 챗으로 가져가세요.");
  }catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:"첨부에 실패했습니다.");}
  finally{if(mounted.current)setBusy(false);}
 }
 async function copy(){try{await navigator.clipboard.writeText(bundle.prompt);setNotice("작업 요청서를 복사했습니다. ChatGPT에 자료 ZIP을 직접 첨부하고 요청서를 붙여넣으세요.");}catch{setNotice("복사에 실패했습니다. 아래 요청서를 직접 선택해 복사하세요.");}}
 async function download(){
  setBusy(true);setNotice("챗에 첨부할 자료 ZIP을 준비하고 있습니다…");
  try{
   const JSZip=(await import("jszip")).default;const zip=new JSZip();
   zip.file("00_request.txt",bundle.prompt);zip.file("01_index.json",JSON.stringify(bundle.manifest,null,2));
   zip.file("README.txt","이 패키지는 사이트에서 모은 자료이며 AI 판독이나 검증 결과가 아닙니다.\nChatGPT에서 ZIP을 직접 첨부하고 00_request.txt 요청서를 전송하세요.\nsources/에는 첨부 원본, frames/에는 읽기용 분할 이미지·영상 추출 화면이 있습니다. 영상 추출 화면은 전체 영상을 대체하지 않으며 빠르게 지나간 정보는 누락될 수 있습니다.\n첨부만으로 사실 검증 완료를 뜻하지 않습니다.");
   for(const entry of bundle.entries){const file=files.find(f=>f.id===entry.id);if(!file)continue;zip.file(entry.path,await file.file.arrayBuffer());entry.frames.forEach((frame,i)=>zip.file(frame.path,file.frames[i].split(",")[1],{base64:true}));}
   const blob=await zip.generateAsync({type:"blob"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=safeFileName(`${values.name||"아파트"}_${active==="article"?"전체자료":step?.title}_${values.date||""}`)+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
   if(mounted.current)setNotice("자료 ZIP을 받았습니다. ChatGPT를 열고 ZIP을 직접 첨부하세요. 현재 대화를 이어가려면 이 채팅에 첨부하면 됩니다.");
  }catch{if(mounted.current)setNotice("ZIP 준비에 실패했습니다. 원본 파일을 챗에 직접 첨부하고 요청서를 복사해 주세요.");}
  finally{if(mounted.current)setBusy(false);}
 }
 const chatPrompt=bundle.prompt.length<6000?bundle.prompt:"아파트 시리즈 글을 이어서 작업하려고 합니다. 제가 첨부할 자료 ZIP의 00_request.txt와 01_index.json을 읽고 원본 자료를 확인한 뒤 요청대로 작업해주세요. ZIP 첨부 전에는 자료를 읽었다고 말하지 말아주세요.";
 function handoff(){return <div className={styles.handoff}>
  <h3>{active==="article"?"모은 자료로 챗에서 글 작성":"이 단계 자료를 챗에서 확인하기"}</h3>
  <p>① 자료 ZIP 받기 → ② ChatGPT 열기 → ③ ZIP 직접 첨부 → ④ 요청서 전송</p>
  <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||!ready} onClick={download}>자료 ZIP 받기 ({bundle.entries.length}개 원본)</button><button type="button" onClick={copy}>작업 요청서 복사</button><a href={"https://chatgpt.com/?q="+encodeURIComponent(chatPrompt)} target="_blank" rel="noreferrer">ChatGPT에서 이어서 작업 ↗</a></div>
  <p className={styles.hint}>새 챗이 열립니다. 파일은 자동 전송되지 않으므로 다운로드한 ZIP을 직접 첨부하세요. 지금 대화에서 계속하려면 ZIP과 요청서를 이 채팅에 보내주세요.</p>
  <details><summary>챗에 전달할 요청서 보기</summary><textarea aria-label="챗 작업 요청서" rows={10} readOnly value={bundle.prompt}/></details>
 </div>;}
 return <section className={styles.evidence} aria-label="캡처·영상 첨부">
  <h3>사이트에서 자료 모으기 → 챗에서 확인·글 작성</h3>
  <p>필요한 화면을 순서대로 첨부하세요. 사이트는 자료를 보관하고 요청서와 함께 묶어줍니다.</p>
  <nav className={styles.stepNav} aria-label="자료 준비 순서">{evidenceSteps.map((s,i)=><button key={s.id} type="button" disabled={busy} aria-current={active===s.id?"step":undefined} onClick={()=>go(s.id)}>{i+1}. {s.title}<small>{files.some(f=>f.step===s.id)?"첨부됨 · 챗에서 확인":values["_skip_"+s.id]?"미확보 사유 기록":"자료 필요"}</small></button>)}<button type="button" disabled={busy} aria-current={active==="article"?"step":undefined} onClick={()=>go("article")}>8. 챗으로 전달</button></nav>
  {files.some(f=>!f.step)&&<details><summary>이전에 첨부한 자료 분류하기</summary>{files.filter(f=>!f.step).map(f=><label key={f.id}>{f.name}<select defaultValue="" disabled={busy} onChange={async e=>{const updated={...f,step:e.target.value};try{await evidenceStore("put",updated);setFiles(old=>old.map(x=>x.id===f.id?updated:x));}catch{setNotice("분류를 저장하지 못했습니다.");}}}><option value="" disabled>자료 종류 선택</option>{evidenceSteps.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>)}</details>}
  {active==="article"?<div><h3>자료 준비 현황</h3><ul>{evidenceSteps.map(s=><li key={s.id}>{s.title}: {files.filter(f=>f.step===s.id).length}개 첨부{values["_skip_"+s.id]?" / "+values["_skip_"+s.id]:""}</li>)}</ul><p>첨부됨은 검증 완료를 뜻하지 않습니다. 부족한 항목도 요청서에 함께 기록합니다.</p>{handoff()}</div>:step&&<>
   <div className={styles.stepGuide}><h3>{evidenceSteps.indexOf(step)+1}. {step.title} 자료를 올려주세요</h3><a href={step.url} target="_blank" rel="noreferrer">{step.source} ↗</a><p>{step.instructions}</p><strong>화면에 보여야 할 내용</strong><ul>{step.needs.map(n=><li key={n}>{n}</li>)}</ul></div>
   <label>자료 첨부<input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" disabled={busy||!ready} onChange={e=>{const list=Array.from(e.target.files||[]);e.target.value="";if(list.length)void upload(list);}}/></label>
   <p className={styles.hint}>파일당 50MB·영상 60초 이내. 원본을 보관하고 긴 캡처·영상은 챗에서 읽을 수 있는 화면도 함께 준비합니다.</p>
   {scoped.map(f=><div key={f.id} className={styles.evidenceFile}><strong>{f.name}</strong><span>원본 + 읽기용 화면 {f.frames.length}장</span><button type="button" disabled={busy} onClick={async()=>{try{await evidenceStore("delete",f.id);setFiles(old=>old.filter(x=>x.id!==f.id));}catch{setNotice("첨부 삭제에 실패했습니다.");}}}>첨부 삭제</button></div>)}
   {scoped.length>0&&<details><summary>첨부 화면 미리보기</summary><div className={styles.evidenceFrames}>{scoped.flatMap(f=>f.frames.map((url,i)=><div key={`${f.id}:${i}`}><img src={url} alt={f.labels[i]} loading="lazy"/><small>{f.labels[i]}</small></div>))}</div></details>}
   <label>이 자료의 원본 링크 (선택)<input type="url" value={values["_source_"+active]||""} onChange={e=>onApply({["_source_"+active]:e.target.value})} placeholder="복사할 수 있으면 원본 페이지 주소를 붙여넣으세요"/></label>
   <label>챗에 알려줄 메모 (선택)<textarea rows={2} value={values["_memo_"+active]||""} onChange={e=>onApply({["_memo_"+active]:e.target.value})} placeholder="예: 전용 84.79㎡로 비교 / 직원 출입구는 아직 모름"/></label>
   <details className={styles.stepManual}><summary>자료를 구하지 못했나요?</summary><label>미확보 사유<textarea rows={2} value={values["_skip_"+active]||""} onChange={e=>onApply({["_skip_"+active]:e.target.value})} placeholder="예: 현재 전세 매물 확인 불가"/></label><p>없음과 확인 불가를 구분하세요. 사유를 남기고 다음으로 넘어가도 됩니다.</p></details>
   <details><summary>이 자료부터 챗에 보내기</summary>{handoff()}</details>
   <div className={styles.actions}><button type="button" disabled={busy||evidenceSteps.indexOf(step)===0} onClick={()=>go(evidenceSteps[Math.max(0,evidenceSteps.indexOf(step)-1)].id)}>이전 자료</button><button type="button" className={styles.primary} disabled={busy} onClick={()=>go(evidenceSteps[evidenceSteps.indexOf(step)+1]?.id||"article")}>다음: {evidenceSteps[evidenceSteps.indexOf(step)+1]?.title||"챗으로 전달"} →</button></div>
  </>}
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  <p className={styles.hint}>첨부와 메모는 이 브라우저에 저장됩니다. 자료 정리는 브라우저에서 처리하며 사이트에서 AI 서버로 전송하지 않습니다.</p>
 </section>;
}
