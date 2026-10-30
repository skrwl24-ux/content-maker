import { NextRequest, NextResponse } from "next/server";

export const dynamic="force-dynamic";
const NAVER_IMAGE_URL="https://naverapihub.apigw.ntruss.com/search/v1/image";
type NaverImage={title?:string;link?:string;thumbnail?:string;sizewidth?:string|number;sizeheight?:string|number};
const MAX_RESULTS=16;

function stripHtml(value:string){
  return String(value||"")
    .replace(/<[^>]*>/g,"")
    .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;/g,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
    .replace(/\s+/g," ").trim().slice(0,220);
}
function safeHttpUrl(value:unknown){
  if(typeof value!=="string"||value.length>2048)return "";
  try{
    const url=new URL(value);
    return (url.protocol==="https:"||url.protocol==="http:")&&!url.username&&!url.password?
      url.toString():"";
  }catch{return "";}
}
function nameHost(value:string){
  try{return new URL(value).hostname.toLowerCase();}catch{return "";}
}
function asNumber(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0&&n<=20000?Math.round(n):null;
}
function queries(name:string,kind:"render"|"environment"){
  return kind==="render"?
    [name+" 아파트 공식 조감도",name+" 단지 조감도"]:
    [name+" 아파트 실제 외관",name+" 주변 생활환경 사진"];
}
export async function GET(req:NextRequest){
  const name=(req.nextUrl.searchParams.get("q")||"").trim();
  const kind=req.nextUrl.searchParams.get("kind");
  if(name.length<2||name.length>100||!["render","environment"].includes(kind||"")){
    return NextResponse.json({error:"단지 이름과 조감도·생활환경 종류를 확인해 주세요."},{status:400});
  }
  const clientId=process.env.NAVER_API_HUB_CLIENT_ID;
  const clientSecret=process.env.NAVER_API_HUB_CLIENT_SECRET;
  if(!clientId||!clientSecret){
    return NextResponse.json({error:"네이버 이미지 검색 API가 아직 설정되지 않았습니다."},{status:503});
  }
  const terms=queries(name,kind as "render"|"environment");
  const results:Array<{
    title:string;imageUrl:string;thumbnailUrl:string;host:string;width:number|null;height:number|null;
    searchTerm:string;sourceState:"unverified";
  }>=[];
  const errors:string[]=[];
  for(const term of terms){
    const url=new URL(NAVER_IMAGE_URL);
    url.searchParams.set("query",term);
    url.searchParams.set("display","12");
    url.searchParams.set("start","1");
    url.searchParams.set("sort","sim");
    url.searchParams.set("filter","all");
    url.searchParams.set("format","json");
    try{
      const response=await fetch(url,{
        headers:{
          "X-NCP-APIGW-API-KEY-ID":clientId,
          "X-NCP-APIGW-API-KEY":clientSecret,
          Accept:"application/json"
        },cache:"no-store",signal:AbortSignal.timeout(10000)
      });
      if(!response.ok){
        errors.push("네이버 이미지 API HTTP "+response.status);
        continue;
      }
      const data=await response.json() as {items?:NaverImage[]};
      for(const item of data.items||[]){
        const imageUrl=safeHttpUrl(item.link);
        const thumbnailUrl=safeHttpUrl(item.thumbnail)||imageUrl;
        if(!imageUrl||!thumbnailUrl)continue;
        results.push({
          title:stripHtml(item.title||"이미지 검색 결과"),
          imageUrl,thumbnailUrl,host:nameHost(imageUrl),
          width:asNumber(item.sizewidth),height:asNumber(item.sizeheight),
          searchTerm:term,sourceState:"unverified"
        });
      }
    }catch{errors.push("네이버 이미지 검색 요청 실패");}
  }
  const unique=new Map<string,typeof results[number]>();
  for(const image of results){
    if(!unique.has(image.imageUrl))unique.set(image.imageUrl,image);
  }
  const images=[...unique.values()].slice(0,MAX_RESULTS);
  const message=images.length?
    "검색 이미지는 공식 출처나 해당 단지의 실제 사진으로 확인된 것이 아닙니다. 원본 페이지·사용 허락을 확인한 후 선택해 주세요.":
    errors.length===terms.length?"네이버 이미지 API가 응답하지 않았습니다. 검색 링크에서 원본을 확인해 주세요.":
      "해당 단지의 사진 후보를 찾지 못했습니다. 원본 사진이나 공식 홈페이지를 직접 첨부해 주세요.";
  return NextResponse.json({images,source:"NAVER Image Search",searched:name,kind,
    message,available:errors.length!==terms.length},
    {headers:{"Cache-Control":"no-store"}});
}
