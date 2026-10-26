export type Evidence = { id: string; episodeId: string; name: string; step?: string; file: File; frames: string[]; labels: string[] };
export const MAX_FRAMES = 12;
export async function evidenceStore(action: "load" | "put" | "delete", item?: Evidence | string): Promise<Evidence[]> {
 const db = await new Promise<IDBDatabase>((resolve,reject) => {
  const r = indexedDB.open("jibssuk-workplace-evidence-v1",1);
  r.onupgradeneeded = () => r.result.createObjectStore("files",{keyPath:"id"});
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error("첨부 저장소를 열지 못했습니다."));
 });
 return new Promise((resolve,reject) => {
  const tx = db.transaction("files",action === "load" ? "readonly" : "readwrite");
  const store = tx.objectStore("files");
  const r = action === "load" ? store.getAll() : action === "put" ? store.put(item) : store.delete(item as string);
  tx.oncomplete = () => { db.close(); resolve(action === "load" ? r.result as Evidence[] : []); };
  tx.onerror = tx.onabort = () => {db.close();reject(new Error("첨부 저장에 실패했습니다. 브라우저 저장 공간을 확인하세요."));};
 });
}
function frame(source: CanvasImageSource,width: number,height: number) {
 const c = document.createElement("canvas"); const scale = Math.min(1,1800/Math.max(width,height));
 c.width = Math.max(1,Math.round(width*scale)); c.height = Math.max(1,Math.round(height*scale));
 const ctx = c.getContext("2d"); if(!ctx) throw new Error("이미지를 처리하지 못했습니다.");
 ctx.drawImage(source,0,0,c.width,c.height); return c.toDataURL("image/jpeg",.88);
}
function event(target: HTMLMediaElement,name: string,begin: () => void) {
 return new Promise<void>((resolve,reject) => {
  const clean = () => {clearTimeout(timer);target.removeEventListener(name,done);target.removeEventListener("error",fail);};
  const done = () => {clean();resolve();};
  const fail = () => {clean();reject(new Error("영상을 읽지 못했습니다. MP4 또는 이미지로 올려주세요."));};
  const timer = setTimeout(fail,15000);
  target.addEventListener(name,done,{once:true});target.addEventListener("error",fail,{once:true});begin();
 });
}
export async function prepareEvidence(file: File,episodeId: string): Promise<Evidence> {
 if(file.size > 50*1024*1024) throw new Error("파일당 50MB 이하로 올려주세요.");
 const url = URL.createObjectURL(file);
 const result: Evidence = {id:crypto.randomUUID(),episodeId,name:file.name,file,frames:[],labels:[]};
 try {
  if(["image/png","image/jpeg","image/webp"].includes(file.type)) {
   const image = new Image();
   await new Promise<void>((resolve,reject) => {image.onload=()=>resolve();image.onerror=()=>reject(new Error("이미지를 읽지 못했습니다."));image.src=url;});
   const h = Math.min(image.naturalHeight,1600), step = 1400;
   const count = image.naturalHeight <= h ? 1 : Math.ceil((image.naturalHeight-h)/step)+1;
   if(count>MAX_FRAMES) throw new Error("너무 긴 캡처입니다. 여러 이미지로 나눠 올려주세요.");
   for(let i=0;i<count;i++) {
    const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=h;
    const ctx=c.getContext("2d");if(!ctx) throw new Error("이미지를 읽지 못했습니다.");
    ctx.drawImage(image,0,Math.min(i*step,image.naturalHeight-h),image.naturalWidth,h,0,0,image.naturalWidth,h);
    result.frames.push(frame(c,c.width,c.height));result.labels.push(`${file.name} · 구간 ${i+1}`);
   }
  } else if(["video/mp4","video/webm","video/quicktime"].includes(file.type)) {
   const video=document.createElement("video");video.muted=true;video.preload="auto";video.playsInline=true;
   try {
    await event(video,"loadeddata",()=>{video.src=url;video.load();});
    if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>60) throw new Error("영상은 60초 이내로 나눠 올려주세요.");
    const count=Math.min(MAX_FRAMES,Math.max(1,Math.ceil(video.duration/2)));
    for(let i=0;i<count;i++) {
     const time=Math.max(0,Math.min(video.duration-.01,.01+(count === 1 ? 0 : i*Math.max(0,video.duration-.06)/(count-1))));
     if(video.currentTime !== time) await event(video,"seeked",()=>{video.currentTime=time;});
     result.frames.push(frame(video,video.videoWidth,video.videoHeight));result.labels.push(`${file.name} · ${time.toFixed(1)}초`);
    }
   } finally {video.removeAttribute("src");video.load();}
  } else throw new Error("PNG·JPG·WebP 또는 MP4·WebM·MOV만 지원합니다.");
  return result;
 } finally {URL.revokeObjectURL(url);}
}
