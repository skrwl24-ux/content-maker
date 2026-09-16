import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

function extForMime(mime:string){if(mime.includes("png"))return"png";if(mime.includes("jpeg")||mime.includes("jpg"))return"jpg";if(mime.includes("webp"))return"webp";if(mime.includes("svg"))return"svg";return"bin";}
function fromDataUrl(src:string){const m=src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);if(!m)return null;return{buffer:Buffer.from(m[2],"base64"),ext:extForMime(m[1])};}
async function imageBuffer(src:string){const local=fromDataUrl(src);if(local)return local;if(!/^https:\/\//i.test(src))return null;const r=await fetch(src);if(!r.ok)return null;return{buffer:Buffer.from(await r.arrayBuffer()),ext:extForMime(r.headers.get("content-type")||"")};}

export async function POST(req:NextRequest){
  try{
    const {projectTitle,contentType,finalTitle,finalBody,tasks,templateKey}=await req.json();
    const zip=new JSZip();
    for(const t of tasks||[]){const src=t.imageDataUrl||t.imageUrl||"";if(!src)continue;const img=await imageBuffer(src);if(!img)continue;const section=String(t.title||"image").replace(/[\\/:*?"<>|\s]+/g,"_");zip.file(`${String(t.order).padStart(2,"0")}_${section}.${img.ext}`,img.buffer);}
    zip.file("final_post.txt",`${finalTitle||""}\n\n${finalBody||""}`);
    zip.file("image_guide.txt",[`프로젝트: ${projectTitle||""}`,`유형: ${contentType||""}`,`템플릿: ${templateKey||"modern"}`,"",...(tasks||[]).map((t:any)=>`${String(t.order).padStart(2,"0")} ${t.title} - ${t.keyMessage}`)].join("\n"));
    zip.file("project.json",JSON.stringify({projectTitle,contentType,finalTitle,finalBody,templateKey,tasks},null,2));
    const buffer=await zip.generateAsync({type:"nodebuffer"});
    const bytes=new Uint8Array(buffer.length);
    bytes.set(buffer);
    return new NextResponse(bytes.buffer,{headers:{"Content-Type":"application/zip","Content-Disposition":"attachment; filename=\"content-maker-project.zip\""}});
  }catch{
    return NextResponse.json({error:"ZIP 생성 실패"},{status:500});
  }
}
