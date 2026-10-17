"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";
import {
  APARTMENT_V4_SCENES, apartmentV4Audit, apartmentV4Count, apartmentV4Scenes,
  buildApartmentV4ArticlePrompt, buildApartmentV4ImagePrompt, apartmentV4Snapshot,
} from "../../lib/apartment-photo-story-v4.mjs";
import type { ApartmentV4Input } from "../../lib/apartment-photo-story-v4.mjs";

type Origin = "self" | "licensed" | "ai" | "data";
type SavedPhoto = { blob: Blob; width: number; height: number; origin: Origin; credit: string; sourceUrl: string; savedAt: string };
type DisplayPhoto = SavedPhoto & { url: string };
const DB = "apartment-bulk-v4-studio-images";
const STORE = "scenes";
const MAX_FILE = 15 * 1024 * 1024;

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("이미지 저장소를 열 수 없습니다."));
  });
}

async function getImage(key: string): Promise<SavedPhoto | null> {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function putImage(key: string, image: SavedPhoto | null) {
  const db = await openImageDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    if (image) tx.objectStore(STORE).put(image, key);
    else tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("이미지를 저장하지 못했습니다.")); };
  });
}

async function encodeImage(file: File, maximum: number) {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("PNG·JPG·WEBP만 등록할 수 있습니다.");
  if (file.size > MAX_FILE) throw new Error("15MB 이하 이미지로 등록해주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("사진 파일을 해석하지 못했습니다."));
      node.src = url;
    });
    const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지 변환 기능을 사용할 수 없습니다.");
    context.drawImage(image,0,0,width,height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(file => file ? resolve(file) : reject(new Error("PNG 변환에 실패했습니다.")),"image/png"));
    return { blob, width, height };
  } finally { URL.revokeObjectURL(url); }
}

function dataPlot(input: ApartmentV4Input): Promise<{blob:Blob;width:number;height:number}> {
  const { name, area, monthly, verifiedSeries } = apartmentV4Snapshot(input);
  const rows = monthly.filter(row=>row.medianPrice != null && row.tradeCount > 0);
  if (!verifiedSeries || rows.length < 2) return Promise.reject(new Error("가격이 확인된 거래월이 최소 2개 있어야 시세 그래프를 만들 수 있습니다."));
  const canvas = document.createElement("canvas");
  canvas.width=1600;canvas.height=900;
  const ctx=canvas.getContext("2d");
  if(!ctx) return Promise.reject(new Error("그래프 생성 기능을 사용할 수 없습니다."));
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,1600,900);
  ctx.fillStyle="#17263a";ctx.font="bold 48px sans-serif";ctx.fillText(name.slice(0,26)+" · 6개월 실거래 흐름",88,105);
  ctx.fillStyle="#63758a";ctx.font="27px sans-serif";ctx.fillText("대표 전용면적 "+(area||"확인 필요")+" · 월별 대표값 (개별 거래가 아님)",90,154);
  const vals=rows.map(r=>r.medianPrice as number), min=Math.min(...vals),max=Math.max(...vals);
  const lower=min===max?min*.9:min-(max-min)*.18, upper=min===max?max*1.1:max+(max-min)*.18;
  const L=150,R=1470,T=240,B=660;
  ctx.strokeStyle="#d8e2ec";ctx.lineWidth=2;
  ctx.fillStyle="#728295";ctx.font="23px sans-serif";
  for(let i=0;i<=4;i++){
    const y=B-i*(B-T)/4;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();
    ctx.fillText(((lower+(upper-lower)*i/4)/1e8).toFixed(1)+"억",35,y+7);
  }
  const points=monthly.map((row,index)=>({
    x:L+(monthly.length===1?0:index*(R-L)/(monthly.length-1)),
    y:row.medianPrice==null||row.tradeCount===0?null:B-((row.medianPrice-lower)/(upper-lower))*(B-T),
    row,
  }));
  ctx.strokeStyle="#167a72";ctx.lineWidth=6;ctx.lineJoin="round";
  let last=null as {x:number;y:number}|null;
  for(const p of points){
    if(p.y!==null){if(last){ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
      last={x:p.x,y:p.y};}
  }
  points.forEach(p=>{
    if(p.y!==null){
      ctx.fillStyle="#167a72";ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fill();
      ctx.font="bold 24px sans-serif";ctx.textAlign="center";
      ctx.fillStyle="#143b39";ctx.fillText((p.row.medianPrice!/1e8).toFixed(2)+"억",p.x,p.y-25);
    }
    ctx.fillStyle="#485b71";ctx.font="25px sans-serif";ctx.textAlign="center";
    ctx.fillText(p.row.month.slice(0,7),p.x,B+58);
    ctx.font="22px sans-serif";ctx.fillText(p.row.tradeCount+"건",p.x,B+94);
    if(p.y===null){ctx.fillStyle="#9aa6b5";ctx.font="20px sans-serif";ctx.fillText("대표값 없음",p.x,B-140);}
  });
  ctx.textAlign="left";
  ctx.fillStyle="#f0f5f8";ctx.fillRect(88,785,1424,68);
  ctx.fillStyle="#44566a";ctx.font="23px sans-serif";
  ctx.fillText("자료: 사이트에 연동된 해당 단지 실거래 집계 · 거래일/신고 수정/표본 수는 별도 확인",107,827);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve({blob,width:1600,height:900}):reject(new Error("그래프 저장에 실패했습니다.")),"image/png"));
}

function normalizeId(value: string) { return value.trim().slice(0,150).replace(/[^a-zA-Z0-9가-힣._-]/g,"-"); }

export default function ApartmentV4Studio({
  identity, data, body, onBodyChange,
}: {
  identity:string;
  data:ApartmentV4Input;
  body:string;
  onBodyChange:(value:string)=>void;
}) {
  const [mode,setMode]=useState<"v3"|"v4">("v4");
  const [count,setCount]=useState(7);
  const [photos,setPhotos]=useState<Record<string,DisplayPhoto>>({});
  const [origin,setOrigin]=useState<Record<string,Origin>>({});
  const [credit,setCredit]=useState<Record<string,string>>({});
  const [sourceUrl,setSourceUrl]=useState<Record<string,string>>({});
  const [rights,setRights]=useState<Record<string,boolean>>({});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [ready,setReady]=useState(false);
  const [exporting,setExporting]=useState(false);
  const objectUrls=useRef<string[]>([]);
  const scenes=useMemo(()=>apartmentV4Scenes(count),[count]);
  const audit=useMemo(()=>apartmentV4Audit(body,count),[body,count]);
  const prompt=useMemo(()=>buildApartmentV4ArticlePrompt(data,count),[data,count]);
  const absent=scenes.filter(scene=>!photos[scene.slot]).map(scene=>scene.slot);
  const canExport=audit.hasBody && !audit.missing.length && !audit.repeated.length && !audit.unexpected.length && !audit.outOfOrder && !absent.length;
  const storagePrefix="apartment-v4-work:"+normalizeId(identity);
  const knownRows=apartmentV4Snapshot(data);
  useEffect(()=>{
    let cancelled=false;
    let fresh:string[]=[];
    setPhotos({});setReady(false);
    try {
      const saved=JSON.parse(localStorage.getItem(storagePrefix)||"{}");
      setMode(saved.mode==="v3"?"v3":"v4");
      setCount(apartmentV4Count(saved.count));
    } catch {setMode("v4");setCount(7);}
    (async()=>{
      const next:Record<string,DisplayPhoto>={};
      for(const scene of APARTMENT_V4_SCENES){
        try {
          const photo=await getImage(storagePrefix+":"+scene.slot);
          if(photo){const url=URL.createObjectURL(photo.blob);fresh.push(url);next[scene.slot]={...photo,url};}
        } catch {}
      }
      if(cancelled){fresh.forEach(URL.revokeObjectURL);return;}
      objectUrls.current.push(...fresh);setPhotos(next);setReady(true);
    })();
    return ()=>{cancelled=true;fresh.forEach(url=>URL.revokeObjectURL(url));};
  },[storagePrefix]);
  function updateSettings(nextMode:"v3"|"v4",nextCount:number){
    setMode(nextMode);setCount(nextCount);
    try {localStorage.setItem(storagePrefix,JSON.stringify({mode:nextMode,count:nextCount}));}
    catch {setMessage("제작 방식 저장이 제한된 브라우저입니다.");}
  }

  async function save(slot:string,record:SavedPhoto) {
    await putImage(storagePrefix+":"+slot,record);
    const url=URL.createObjectURL(record.blob);
    objectUrls.current.push(url);
    setPhotos(prev=>{
      if(prev[slot])URL.revokeObjectURL(prev[slot].url);
      return {...prev,[slot]:{...record,url}};
    });
  }
  async function upload(slot:string,event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file || busy)return;
    const kind=origin[slot]||((slot==="01"||slot==="06")?"self":"ai");
    const note=(credit[slot]||"").trim();
    const url=(sourceUrl[slot]||"").trim();
    if(kind==="licensed" && (!rights[slot] || !note || !/^https:\/\//i.test(url))){
      setMessage("외부 실사진은 사용 허락 확인·사진가/출처 이름·https 출처 링크를 입력해야 합니다.");return;
    }
    setBusy(slot);
    try {
      const png=await encodeImage(file,slot==="00"?1254:1600);
      await save(slot,{...png,origin:kind,credit:kind==="self"?"직접 촬영":kind==="data"?"원본 자료 기반 정보 이미지":kind==="ai"?"AI 제작 이미지":note,sourceUrl:kind==="licensed"?url:"",savedAt:new Date().toISOString()});
      setMessage(slot+" 이미지가 등록됐습니다. 원본 비율은 보존하며 ZIP에는 PNG로 저장됩니다.");
    } catch(error){setMessage(error instanceof Error?error.message:"이미지 저장에 실패했습니다. 기존 파일은 보존했습니다.");}
    finally{setBusy("");}
  }
  async function generatePlot(){
    if(busy)return;
    setBusy("02");
    try {
      const png=await dataPlot(data);
      await save("02",{...png,origin:"data",credit:"사이트에 연동된 단지 실거래 집계",sourceUrl:"",savedAt:new Date().toISOString()});
      setMessage("02번 실거래 그래프를 사이트 원본 월별 값으로 생성·등록했습니다. 실거래 신고 정정 여부는 발행 전 대조하세요.");
    }catch(error){setMessage(error instanceof Error?error.message:"그래프를 만들지 못했습니다.");}
    finally{setBusy("");}
  }
  async function remove(slot:string){
    if(!window.confirm(slot+" 이미지를 삭제할까요? 기존 원고는 유지됩니다."))return;
    try {await putImage(storagePrefix+":"+slot,null);
      setPhotos(prev=>{const next={...prev};if(next[slot])URL.revokeObjectURL(next[slot].url);delete next[slot];return next;});
      setMessage(slot+" 이미지가 삭제됐습니다.");
    } catch {setMessage("이미지를 삭제하지 못했습니다.");}
  }
  async function copy(value:string){
    try{await navigator.clipboard.writeText(value);setMessage("요청서를 복사했습니다.");}
    catch{setMessage("클립보드 사용이 제한됐습니다. ChatGPT 열기 버튼을 사용하세요.");}
  }
  async function exportZip(){
    if(!canExport || exporting)return;
    setExporting(true);
    try{
      const zip=new JSZip(),folder=zip.folder(normalizeId(data.name||"apartment")+"_V4");
      if(!folder)throw new Error("ZIP 폴더를 만들 수 없습니다.");
      const credits:string[]=[];
      for(const scene of scenes){
        const photo=await getImage(storagePrefix+":"+scene.slot);
        if(!photo)throw new Error(scene.slot+" 이미지 누락");
        folder.file(scene.slot+(scene.slot==="00"?"_thumbnail":"_body")+".png",photo.blob);
        credits.push(scene.slot+" · "+scene.name+" · "+photo.credit+(photo.sourceUrl?" · "+photo.sourceUrl:""));
      }
      folder.file("final_post.txt",body);
      folder.file("image_prompts.txt",scenes.map(s=>"["+s.slot+" "+s.name+"]\n"+buildApartmentV4ImagePrompt(data,s.slot,count,body)).join("\n\n==========\n\n"));
      folder.file("image_sources.txt",credits.join("\n"));
      folder.file("validation.json",JSON.stringify({date:new Date().toISOString(),complex:data.name,area:data.area,sourceSeriesVerified:knownRows.verifiedSeries,articleAudit:audit,scenes:scenes.map(s=>({slot:s.slot,name:s.name}))},null,2));
      const blob=await zip.generateAsync({type:"blob"});const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=normalizeId(data.name||"apartment")+"_V4.zip";a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("이미지·본문·출처를 포함한 V4 ZIP을 만들었습니다.");
    } catch(error){setMessage(error instanceof Error?error.message:"ZIP 생성에 실패했습니다.");}
    finally{setExporting(false);}
  }

  return <section className={styles.aptV4Studio}>
    <div className={styles.aptV4Header}>
      <div><span className={styles.aptV4Eyebrow}>APARTMENT BLOG · V4</span>
        <h2>실제 사진 + 실거래 데이터 스토리 편집</h2>
        <p>사진을 따라가며 가격 흐름을 이해하도록 구성합니다. 기존 V3 데이터·이미지·검수는 그대로 유지됩니다.</p>
      </div>
      <div className={styles.aptV4Switch}>
        <button type="button" className={mode==="v3"?styles.aptV4Selected:""} onClick={()=>updateSettings("v3",count)}>V3 기존 방식</button>
        <button type="button" className={mode==="v4"?styles.aptV4Selected:""} onClick={()=>updateSettings("v4",count)}>V4 사진 스토리</button>
      </div>
    </div>
    {mode==="v3" ? <p className={styles.aptV4Hint}>기존 아래쪽의 본문·시세 그래프·스토리 이미지 제작 기능을 그대로 사용할 수 있습니다. V4를 켜도 기존 자료는 삭제되지 않습니다.</p> :
    <>
      <div className={styles.aptV4Count}>
        <b>이미지 장수 · 썸네일 포함</b>
        {[6,7,8].map(n=><button type="button" key={n} className={count===n?styles.aptV4Selected:""} onClick={()=>updateSettings("v4",n)}>{n}장</button>)}
        <small>{knownRows.verifiedSeries?"월별 실거래 연결됨 · 숫자 재확인 필요":"실거래 자료 매칭 미확인 · 시세 단정 금지"}</small>
      </div>
      <div className={styles.aptV4Prompt}>
        <strong>① V4 원고 요청서</strong>
        <p>실제 사진 2~3장과 실거래 표·그래프 중심. 각 장면 사이에 짧은 2~3줄 설명을 넣습니다.</p>
        <div>
          <button type="button" onClick={()=>void copy(prompt)}>요청서 복사</button>
          <a href={"https://chatgpt.com/?q="+encodeURIComponent(prompt)} target="_blank" rel="noopener noreferrer">ChatGPT에서 V4 원고 작성 ↗</a>
        </div>
      </div>
      <label className={styles.aptV4BodyLabel}><b>② V4 완성 원고 · 네이버 최종 편집과 연결</b>
        <textarea value={body} onChange={e=>onBodyChange(e.target.value)} placeholder={"제목\n\n도입 설명\n\n[이미지 01]\n사진 설명 2~3줄\n\n[이미지 02]\n시세 해설 2~3줄\n\n…\n\n[이미지 기획 메모]"} />
      </label>
      <div className={styles.aptV4Audit} aria-live="polite">
        <b>원고·이미지 체크</b>
        <span>{!audit.hasBody?"원고 100자 이상 필요":"원고 입력 확인"} · 이미지 {scenes.length-absent.length}/{scenes.length}장 등록</span>
        {(audit.missing.length>0 || audit.repeated.length>0 || audit.unexpected.length>0 || audit.outOfOrder) &&
          <p>누락 {audit.missing.join(", ")||"없음"} · 중복 {audit.repeated.join(", ")||"없음"} · 범위 밖 {audit.unexpected.join(", ")||"없음"}{audit.outOfOrder?" · 이미지 순서 오류":""}</p>}
        <small>기존 자동 가격·거래량 검사는 화면 아래 ‘네이버 최종편집 · 발행 전 검사’에서도 반드시 확인해주세요.</small>
      </div>
      <div className={styles.aptV4SceneGrid}>
        {scenes.map(scene=>{
          const pic=photos[scene.slot],kind=origin[scene.slot]|| (scene.type==="photo"?"self":"ai");
          const imagePrompt=buildApartmentV4ImagePrompt(data,scene.slot,count,body);
          return <article key={scene.slot} className={styles.aptV4Scene}>
            <div className={styles.aptV4SceneHead}>
              <b>{scene.slot} · {scene.name}</b><small>{scene.width}×{scene.height}</small>
            </div>
            <p>{scene.hint}</p>
            <div className={styles.aptV4ImagePreview}>
              {pic?<img src={pic.url} alt={scene.name+" 등록 이미지"}/>:<span>이미지 미등록 · {scene.type==="photo"?"사용권 확인된 실사진 권장":"원본 정보로 제작"}</span>}
            </div>
            {pic && <div className={styles.aptV4PhotoSource}>✓ {pic.credit}{pic.sourceUrl && <a href={pic.sourceUrl} target="_blank" rel="noopener noreferrer"> · 원본 출처 ↗</a>}</div>}
            <div className={styles.aptV4SceneActions}>
              <button type="button" onClick={()=>void copy(imagePrompt)}>AI 이미지 요청서 복사</button>
              <a href={"https://chatgpt.com/?q="+encodeURIComponent(imagePrompt)} target="_blank" rel="noopener noreferrer">AI 제작 ↗</a>
              {scene.type==="photo" && <>
                <a href={"https://search.naver.com/search.naver?where=image&query="+encodeURIComponent((data.name||"아파트")+" "+(scene.slot==="01"?"단지 외관":"인근 지하철역 주변"))} target="_blank" rel="noopener noreferrer">실제 장소 사진 찾기 ↗</a>
                <a href={"https://www.pexels.com/search/"+encodeURIComponent(scene.slot==="01"?"apartment buildings":"subway station")+"/"} target="_blank" rel="noopener noreferrer">Pexels 예시 사진 ↗</a>
              </>}
            </div>
            {scene.slot==="02" && <button type="button" className={styles.aptV4DataGenerate} onClick={()=>void generatePlot()} disabled={!knownRows.verifiedSeries || knownRows.monthly.filter(x=>x.medianPrice!=null&&x.tradeCount>0).length<2||Boolean(busy)}>📈 사이트 실거래 데이터로 시세 그래프 만들기</button>}
            <label className={styles.aptV4Field}><span>이미지 종류</span>
              <select value={kind} onChange={e=>setOrigin(prev=>({...prev,[scene.slot]:e.target.value as Origin}))}>
                <option value="self">직접 촬영한 실제 사진</option>
                <option value="licensed">사용 허락받은 외부 사진</option>
                <option value="ai">AI 제작 이미지</option>
                <option value="data">원본 데이터로 제작한 정보 이미지</option>
              </select>
            </label>
            {kind==="licensed" && <div className={styles.aptV4License}>
              <input aria-label={scene.slot+" 사진가 또는 출처명"} placeholder="사진가·제공기관·허락받은 출처" value={credit[scene.slot]||""} onChange={e=>setCredit(prev=>({...prev,[scene.slot]:e.target.value}))}/>
              <input aria-label={scene.slot+" 원본 출처 URL"} placeholder="https://원본사진URL" value={sourceUrl[scene.slot]||""} onChange={e=>setSourceUrl(prev=>({...prev,[scene.slot]:e.target.value}))}/>
              <label><input type="checkbox" checked={!!rights[scene.slot]} onChange={e=>setRights(prev=>({...prev,[scene.slot]:e.target.checked}))}/> 블로그 이용권을 직접 확인했습니다.</label>
            </div>}
            <div className={styles.aptV4Upload}>
              <label>{busy===scene.slot?"저장 중…":pic?"이미지 교체":"이미지 등록"}
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)||!ready} onChange={e=>void upload(scene.slot,e)}/>
              </label>
              <button type="button" disabled={!pic||Boolean(busy)} onClick={()=>void remove(scene.slot)}>삭제</button>
            </div>
          </article>;
        })}
      </div>
      <div className={styles.aptV4CombinedPreview}>
        <h3>③ 네이버 사진·글 연결 미리보기</h3>
        <p>등록 사진은 각 [이미지 NN] 자리에 표시됩니다. ‘네이버 서식 복사’는 기존 기능으로 글만 복사하므로 사진은 네이버에 별도 등록해야 합니다.</p>
        {body.trim() ? <div className={styles.aptV4PreviewBody}>
          {photos["00"] && <figure><img src={photos["00"].url} alt="썸네일"/><figcaption>대표 썸네일 00</figcaption></figure>}
          {apartmentV4ArticleOnly(body).split(/(\[이미지\s*0[1-7](?:\s*[·:\-][^\]]*)?\])/gi).map((part,index)=>{
            const match=part.match(/^\[이미지\s*(0[1-7])/i);
            if(match){const pic=photos[match[1]];return pic?<figure key={index}><img src={pic.url} alt={match[1]+" 사진"}/><figcaption>{match[1]} · {APARTMENT_V4_SCENES.find(s=>s.slot===match[1])?.name}</figcaption></figure>:
              <div key={index} className={styles.aptV4MissingImage}>{part} · 이미지 미등록</div>;}
            return part.trim()?<div key={index} className={styles.aptV4PreviewText}>{part.trim()}</div>:null;
          })}
        </div>:<p>원고를 붙여넣으면 사진과 글이 이어진 모습이 표시됩니다.</p>}
      </div>
      <div className={styles.aptV4Export}>
        <div><b>④ 최종 V4 ZIP</b><small>본문 + 선택한 모든 이미지 + 요청서 + 사진 출처 + 구조 검사 결과</small></div>
        <button type="button" onClick={()=>void exportZip()} disabled={!ready||!canExport||exporting}>{exporting?"ZIP 만드는 중…":canExport?"V4 ZIP 다운로드":"원고 위치·이미지 등록 확인 필요"}</button>
      </div>
      {message && <p className={styles.aptV4Message} role="status">{message}</p>}
    </>}
  </section>;
}
