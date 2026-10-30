"use client";

import {useEffect,useRef,useState} from "react";
import styles from "./workflow.module.css";

type Kind="render"|"environment";
type ImageCandidate={
  title:string;imageUrl:string;thumbnailUrl:string;host:string;
  width:number|null;height:number|null;searchTerm:string;sourceState:"unverified";
};
function naverImageSearchLink(name:string,kind:Kind){
  return "https://search.naver.com/search.naver?where=image&query="+
    encodeURIComponent(name+(kind==="render"?" 공식 조감도":" 아파트 실제 외관"));
}
function officialSourceLink(name:string){
  const n=name.replace(/\s+/g,"");
  return n.includes("과천")&&n.includes("디에트르")&&n.includes("퍼스티지")?
    "https://www.db-detre.co.kr/web/constcomp/retrieve.do?compSeq=155":"";
}
async function fileToCanvasPng(file:File,mode:"contain"|"cover"){
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>20*1024*1024)
    throw new Error("PNG·JPG·WebP 원본 파일(20MB 이하)을 선택해 주세요.");
  const bitmap=await createImageBitmap(file);
  try{
    if(bitmap.width<1||bitmap.height<1)throw new Error("이미지 크기를 확인할 수 없습니다.");
    const canvas=document.createElement("canvas");
    canvas.width=1600;canvas.height=900;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("이미지 편집 도구를 사용할 수 없습니다.");
    ctx.fillStyle="#f4f6f8";ctx.fillRect(0,0,1600,900);
    const scale=(mode==="contain"?Math.min:Math.max)(1600/bitmap.width,900/bitmap.height);
    const w=bitmap.width*scale,h=bitmap.height*scale;
    ctx.drawImage(bitmap,(1600-w)/2,(900-h)/2,w,h);
    const blob=await new Promise<Blob>((resolve,reject)=>
      canvas.toBlob(value=>value?resolve(value):reject(new Error("PNG로 만들지 못했습니다.")),"image/png"));
    return blob;
  }finally{bitmap.close();}
}

export default function JibssukPropertyPhotos({initialName,onSourceChange}:{
  initialName:string;
  onSourceChange:(metadata:string)=>void;
}){
  const [name,setName]=useState(initialName);
  const [kind,setKind]=useState<Kind>("render");
  const [images,setImages]=useState<ImageCandidate[]>([]);
  const [selected,setSelected]=useState<ImageCandidate|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [fileLabel,setFileLabel]=useState("");
  const [crop,setCrop]=useState<"contain"|"cover">("contain");
  const [ready,setReady]=useState(false);
  const seq=useRef(0);
  const fileRef=useRef<HTMLInputElement|null>(null);

  // A confirmed map selection can fill and search the photo list without retyping.
  useEffect(()=>{
    const term=initialName.trim();
    if(!term)return;
    setName(term);
    void search(term);
    // Only changes to the selected article/map name should restart this search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initialName]);
  function clearSelection(){
    setSelected(null);setFile(null);setFileLabel("");
    if(fileRef.current)fileRef.current.value="";
    onSourceChange("");
  }
  function changeName(value:string){
    seq.current+=1;setLoading(false);setName(value);setImages([]);clearSelection();setMessage("");
  }
  function changeKind(next:Kind){
    seq.current+=1;setLoading(false);setKind(next);setImages([]);clearSelection();setMessage("");
  }
  async function search(nameOverride?:string){
    const term=(nameOverride??name).trim();
    if(term.length<2){setMessage("아파트 이름을 두 글자 이상 입력해 주세요.");return;}
    const current=++seq.current;
    clearSelection();setLoading(true);setImages([]);setMessage("");
    try{
      const res=await fetch("/api/apartment/visual-photos?q="+encodeURIComponent(term)+
        "&kind="+encodeURIComponent(kind),{cache:"no-store"});
      const data=await res.json();
      if(current!==seq.current)return;
      if(!res.ok)throw new Error(data.error||"이미지 검색에 실패했습니다.");
      const list=(Array.isArray(data.images)?data.images:[]).filter((x:ImageCandidate)=>
        typeof x.imageUrl==="string"&&typeof x.thumbnailUrl==="string");
      setImages(list.slice(0,16));
      setMessage(data.message||"검색을 마쳤습니다.");
    }catch(error){
      if(current===seq.current)setMessage(error instanceof Error?error.message:"이미지 검색 실패");
    }finally{if(current===seq.current)setLoading(false);}
  }
  function choose(image:ImageCandidate){
    setSelected(image);setFile(null);setFileLabel("");
    if(fileRef.current)fileRef.current.value="";
    // Candidate selection is not confirmation that the photo depicts this site.
    onSourceChange([
      "03 이미지 종류: "+(kind==="render"?"조감도 후보":"실제 생활환경 사진 후보"),
      "검색 단지명: "+name.trim(),
      "검색 출처: NAVER Image Search (검색 후보 · 공식 여부/단지 동일성 미확인)",
      "검색된 이미지 제목: "+image.title,
      "검색된 이미지 호스트: "+image.host,
      "이미지 원본 링크: "+image.imageUrl,
      "공식 자료·촬영 시점·저작권 및 재사용 허락 여부는 사용자가 별도 확인해야 함.",
      "위 링크만으로 원본 이미지가 ChatGPT에 자동 첨부되지는 않음."
    ].join("\n"));
    setMessage("이미지 후보를 선택했습니다. 원본 링크를 열어 실제 단지인지, 사용 가능한 사진인지 확인한 뒤 파일을 저장해 주세요.");
  }
  function selectFile(fileValue:File|undefined){
    if(!fileValue)return;
    if(!["image/png","image/jpeg","image/webp"].includes(fileValue.type)||fileValue.size>20*1024*1024){
      setMessage("PNG·JPG·WebP 원본 이미지만 선택할 수 있습니다(20MB 이하).");
      if(fileRef.current)fileRef.current.value="";
      return;
    }
    setFile(fileValue);setFileLabel(fileValue.name);
    setMessage("원본을 불러왔습니다. 전체 보기 또는 꽉 채우기 방식을 골라 1600×900 PNG로 저장하거나 복사할 수 있습니다.");
    if(!selected){
      onSourceChange(["03 이미지 원본: 사용자가 직접 업로드한 "+fileValue.name,
        "원본 출처·단지 동일성·재사용 허락을 별도로 확인해야 함.",
        "이미지 파일 자체는 ChatGPT에 자동 첨부되지 않음."].join("\n"));
    }
  }
  async function exportPng(action:"copy"|"download"){
    if(!file)return;
    setReady(true);
    try{
      const blob=await fileToCanvasPng(file,crop);
      if(action==="copy"){
        if(typeof ClipboardItem==="undefined"||!navigator.clipboard?.write)throw new Error("브라우저에서 PNG 복사를 지원하지 않습니다.");
        await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
        setMessage("1600×900 PNG가 클립보드에 복사됐습니다. ChatGPT에 03번 요청서를 붙여넣은 다음 Ctrl+V로 이미지를 첨부하세요.");
      }else{
        const url=URL.createObjectURL(blob);
        const anchor=document.createElement("a");
        anchor.href=url;anchor.download="jibssuk-03-property-photo-1600x900.png";
        document.body.appendChild(anchor);anchor.click();anchor.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),5000);
        setMessage("1600×900 PNG 저장 완료. ChatGPT에서 이미지 파일을 첨부해 사용하세요.");
      }
    }catch(error){
      setMessage((error instanceof Error?error.message:"PNG 제작 실패")+
        (action==="copy"?" · 복사가 안 되면 PNG 저장을 사용해 주세요.":""));
    }finally{setReady(false);}
  }
  const official=officialSourceLink(name);
  return <div className={styles.propertyPhotoFinder}>
    <div className={styles.autoNaverMapHeading}>
      <strong>03 · 조감도·생활환경 사진 찾기</strong>
      <span>네이버 이미지 검색 · 원본 출처 확인</span>
    </div>
    <p className={styles.hint}>지도에서 선택한 단지명을 자동으로 가져와 조감도 후보를 검색합니다. 검색 결과가 공식 조감도나 실제 단지 사진이라는 뜻은 아닙니다.
      출처를 확인한 사진만 최종 이미지로 사용해 주세요.</p>
    <div className={styles.propertyPhotoModes} role="group" aria-label="사진 종류">
      <button type="button" className={kind==="render"?styles.selectedMode:styles.otherButton}
        aria-pressed={kind==="render"} onClick={()=>changeKind("render")}>조감도</button>
      <button type="button" className={kind==="environment"?styles.selectedMode:styles.otherButton}
        aria-pressed={kind==="environment"} onClick={()=>changeKind("environment")}>실제 외관·생활환경</button>
    </div>
    <div className={styles.propertyPhotoSearch}>
      <label htmlFor="jibssuk-property-photo-name">아파트 이름
        <input id="jibssuk-property-photo-name" value={name} maxLength={100}
          onChange={e=>changeName(e.target.value)} placeholder="예: 과천 디에트르 퍼스티지"
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void search();}}}/>
      </label>
      <button type="button" className={styles.mainButton} onClick={()=>void search()}
        disabled={name.trim().length<2||loading}>{loading?"찾는 중…":"사진 후보 자동 찾기"}</button>
    </div>
    <div className={styles.photoSourceLinks}>
      {official&&<a href={official} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>대방건설 공식 단지 페이지 열기 ↗</a>}
      <a href={naverImageSearchLink(name,kind)} target="_blank" rel="noopener noreferrer"
        className={styles.sourceLink}>네이버 이미지 검색 원본 열기 ↗</a>
    </div>
    {message&&<p className={styles.autoMapMessage} role="status">{message}</p>}
    {images.length>0&&<div className={styles.propertyPhotoGrid} aria-label="조감도와 생활환경 검색 결과">
      {images.map((candidate,index)=><div key={candidate.imageUrl+"-"+index}
          className={selected?.imageUrl===candidate.imageUrl?styles.propertyPhotoSelected:styles.propertyPhotoCard}>
        <div className={styles.propertyPhotoThumb}>
          <img src={candidate.thumbnailUrl} alt={candidate.title||"이미지 검색 후보"}
            loading="lazy" referrerPolicy="no-referrer"/>
        </div>
        <strong title={candidate.title}>{candidate.title||"사진 후보"}</strong>
        <small>{candidate.host} · {candidate.width&&candidate.height?candidate.width+"×"+candidate.height:"크기 미확인"}</small>
        <small>출처·실제 단지 여부 미확인</small>
        <div className={styles.propertyPhotoActions}>
          <a href={candidate.imageUrl} target="_blank" rel="noopener noreferrer">원본 열기</a>
          <button type="button" className={styles.otherButton} onClick={()=>choose(candidate)}>
            {selected?.imageUrl===candidate.imageUrl?"선택한 후보":"03번 자료로 선택"}
          </button>
        </div>
      </div>)}
    </div>}
    <div className={styles.propertyPhotoExport}>
      <strong>03 · 원본 파일로 1600×900 PNG 만들기</strong>
      <p className={styles.hint}>공식 홈페이지 또는 원본 이미지에서 저장한 파일을 선택해 주세요. 외부 검색 이미지의 사용 허락을 자동으로 확인하거나 가져오지는 않습니다.</p>
      <label htmlFor="jibssuk-property-source-file" className={styles.propertyPhotoFile}>
        원본 이미지 파일 선택 (PNG · JPG · WebP)
        <input ref={fileRef} id="jibssuk-property-source-file" type="file"
          accept="image/png,image/jpeg,image/webp" onChange={e=>selectFile(e.target.files?.[0])}/>
      </label>
      {file&&<div className={styles.propertyPhotoExportReady}>
        <small>선택한 파일: {fileLabel}</small>
        <div className={styles.propertyPhotoModes} role="group" aria-label="이미지 배치 방식">
          <button type="button" className={crop==="contain"?styles.selectedMode:styles.otherButton}
            aria-pressed={crop==="contain"} onClick={()=>setCrop("contain")}>전체 보기 (여백 가능)</button>
          <button type="button" className={crop==="cover"?styles.selectedMode:styles.otherButton}
            aria-pressed={crop==="cover"} onClick={()=>setCrop("cover")}>꽉 채우기 (가장자리 잘림)</button>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.mainButton} disabled={ready}
            onClick={()=>void exportPng("copy")}>1600×900 PNG 복사</button>
          <button type="button" className={styles.otherButton} disabled={ready}
            onClick={()=>void exportPng("download")}>1600×900 PNG 저장</button>
        </div>
      </div>}
    </div>
  </div>;
}
