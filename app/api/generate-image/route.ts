import { NextRequest, NextResponse } from "next/server";

function esc(s:string){return String(s||"").replace(/[<>&'\"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&#39;",'\"':"&quot;"}[c] as string));}

function makeSvg(contentType:string, sectionTitle:string, keyMessage:string, templateKey:string){
  const short = contentType === "집값쓱 쇼츠";
  const w = short ? 1088 : 1536;
  const h = short ? 1920 : 864;
  const dark = templateKey !== "minimal";
  const bg = templateKey === "data" ? ["#111827","#6b7280"] : templateKey === "minimal" ? ["#ffffff","#e5e7eb"] : ["#4338ca","#c7d2fe"];
  const fg = dark ? "#ffffff" : "#111827";
  const max = short ? 12 : 24;
  const a = esc(String(keyMessage||"").slice(0,max));
  const b = esc(String(keyMessage||"").slice(max,max*2));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg[0]}"/><stop offset="100%" stop-color="${bg[1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="${short?80:70}" y="${short?170:80}" width="${w-(short?160:140)}" height="${h-(short?340:160)}" rx="44" fill="${dark?'rgba(255,255,255,.15)':'rgba(255,255,255,.8)'}" stroke="${dark?'rgba(255,255,255,.3)':'#d1d5db'}"/><text x="${short?120:110}" y="${short?330:190}" font-size="${short?72:54}" font-family="sans-serif" font-weight="800" fill="${fg}">${esc(sectionTitle)}</text><text x="${short?120:110}" y="${short?600:430}" font-size="${short?92:76}" font-family="sans-serif" font-weight="900" fill="${fg}">${a}</text><text x="${short?120:110}" y="${short?720:530}" font-size="${short?92:76}" font-family="sans-serif" font-weight="900" fill="${fg}">${b}</text><text x="${short?120:110}" y="${h-(short?140:70)}" font-size="${short?38:28}" font-family="sans-serif" fill="${fg}" opacity=".85">CONTENT MAKER · ${esc(templateKey.toUpperCase())}</text></svg>`;
}

export async function POST(req: NextRequest){
  try{
    const {contentType,sectionTitle,keyMessage,templateKey="modern"}=await req.json();
    const svg=makeSvg(contentType,sectionTitle,keyMessage,templateKey);
    return NextResponse.json({imageDataUrl:`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,mode:"template"});
  }catch{
    return NextResponse.json({error:"이미지 생성 중 오류가 발생했습니다."},{status:500});
  }
}
