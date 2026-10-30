import {NextRequest,NextResponse} from "next/server";

export const dynamic="force-dynamic";
const NAVER_LOCAL="https://naverapihub.apigw.ntruss.com/search/v1/local";

type NaverItem={
  title?:string;category?:string;roadAddress?:string;address?:string;
  mapx?:string|number;mapy?:string|number;
};
// Verified primary-source fallback when a new project is absent from NAVER Local Search.
// Address is a construction-site lot; users should still confirm map placement.
const VERIFIED_SITE={
  name:"과천 디에트르 퍼스티지",
  address:"경기도 과천시 문원동 874-1",
  roadAddress:"",
  category:"주택>아파트",
  source:"대방건설 공식 공사단지 안내",
  sourceUrl:"https://db-detre.co.kr/web/constcomp/retrieve.do?compSeq=155"
};
function verifiedSiteFor(query:string,region:string){
  const key=normalized(query);
  if(!key.includes("과천")||!key.includes("디에트르")||!key.includes("퍼스티지"))return null;
  if(region && !region.includes("과천"))return null;
  return VERIFIED_SITE;
}
function plain(value:string){
  return String(value||"").replace(/<[^>]*>/g,"")
    .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
}
function normalized(value:string){
  return plain(value).replace(/[^\p{L}\p{N}]/gu,"").toLowerCase();
}
function searchTerm(value:string){
  return value.replace(/^(?:서울|경기|경기도|인천|부산|대전|대구|광주|울산|세종)?\s*[가-힣]+(?:시|군|구)\s*/,"").trim();
}
function withoutNeighborhood(value:string){
  // Development articles often add a city name before the official apartment name.
  return value.replace(/^(?:과천|판교|분당|수원|광교|송도|위례|동탄|마곡|평택|고덕|하남|광명|일산|강남)\s+(?=\S{3,})/,"").trim();
}
function scoredTitle(query:string,title:string,category:string){
  const name=normalized(title),original=normalized(query),core=normalized(searchTerm(query));
  if(!name)return 0;
  const stripped=normalized(withoutNeighborhood(query));
  const keys=[original,core,stripped].filter(k=>k.length>=4);
  let score=0;
  for(const key of keys){
    if(name===key)score=Math.max(score,100);
    else if(name.includes(key))score=Math.max(score,75);
    else if(key.includes(name)&&name.length>=4)score=Math.max(score,55);
  }
  if(/아파트|공동주택|주상복합|분양|건설|주거/.test(category))score+=12;
  return score;
}
export async function GET(req:NextRequest){
  const query=req.nextUrl.searchParams.get("q")?.trim()||"";
  const region=req.nextUrl.searchParams.get("region")?.trim()||"";
  if(query.length<2||query.length>100||region.length>100){
    return NextResponse.json({error:"검색할 단지명을 2~100자로 입력해 주세요."},{status:400});
  }
  const official=verifiedSiteFor(query,region);
  if(official){
    return NextResponse.json({
      places:[official],searched:query,source:official.source,
      message:"공식 사업지 주소를 찾았습니다. 지도 위치를 확인하고 사용하세요."
    },{headers:{"Cache-Control":"no-store"}});
  }
  const clientId=process.env.NAVER_API_HUB_CLIENT_ID;
  const secret=process.env.NAVER_API_HUB_CLIENT_SECRET;
  if(!clientId||!secret){
    return NextResponse.json({error:"네이버 장소 검색 API 설정이 필요합니다."},{status:503});
  }
  const terms=[...new Set([
    query,
    region&&!normalized(query).includes(normalized(region))?region+" "+query:"",
    searchTerm(query),
    withoutNeighborhood(query)
  ].map(x=>x.trim()).filter(x=>x.length>=2))].slice(0,4);
  const headers={
    "X-NCP-APIGW-API-KEY-ID":clientId,
    "X-NCP-APIGW-API-KEY":secret,
    Accept:"application/json"
  };
  try{
    const candidates: Array<{name:string;address:string;roadAddress:string;category:string;score:number;source:string}>=[];
    const failures:string[]=[];
    for(const term of terms){
      const url=new URL(NAVER_LOCAL);
      url.searchParams.set("query",term);
      url.searchParams.set("display","5");
      url.searchParams.set("start","1");
      url.searchParams.set("sort","random");
      url.searchParams.set("format","json");
      try{
        const response=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(8000)});
        if(!response.ok){failures.push("네이버 장소 검색 HTTP "+response.status);continue;}
        const data=await response.json() as {items?:NaverItem[]};
        for(const item of data.items||[]){
          const name=plain(item.title||"");
          const category=plain(item.category||"");
          const address=plain(item.address||"");
          const roadAddress=plain(item.roadAddress||"");
          const selectedAddress=roadAddress||address;
          // Restrict to actual housing sites, not shops, preschools or club facilities
          // that merely contain the apartment name.
          if(!/주택|아파트|주상복합|공동주택/.test(category))continue;
          if(!selectedAddress||!/[\d]/.test(selectedAddress))continue;
          const knownCity=query.match(/^(과천|수원|광명|성남|송도|평택|하남|분당|동탄|김포|화성)\s+/)?.[1];
          if(knownCity && !selectedAddress.includes(knownCity))continue;
          const score=scoredTitle(query,name,category);
          if(score<50)continue;
          if(region){
            // A shared province such as "경기도" alone is insufficient.
            const specificArea=region.split(/\s+/).filter(Boolean).at(-1)||"";
            if(specificArea.length>=2&&!selectedAddress.includes(specificArea))continue;
          }
          candidates.push({name,address,roadAddress,category,score,source:"NAVER Local Search"});
        }
      }catch{failures.push("네이버 장소 검색 요청 실패");}
      // If exact matches exist, do not use more unrelated, broader queries.
      if(candidates.some(c=>c.score>=100))break;
    }
    const unique=new Map<string,typeof candidates[number]>();
    for(const item of candidates.sort((a,b)=>b.score-a.score)){
      const key=normalized(item.name)+"|"+normalized(item.roadAddress||item.address);
      if(!unique.has(key))unique.set(key,item);
    }
    const places=[...unique.values()].slice(0,6).map(({name,address,roadAddress,category,source})=>({
      name,address,roadAddress,category,source
    }));
    return NextResponse.json({
      places,
      searched:query,
      source:"NAVER Local Search",
      message:places.length?"지도에 표시할 실제 장소를 선택해 주세요.":
        failures.length===terms.length?"네이버 장소 검색에 연결하지 못했습니다. 주소 입력을 사용할 수 있습니다.":
        "네이버 장소 검색에서 확인된 단지가 없습니다. 이름을 간단히 바꾸거나 정확한 현장 주소를 입력해 주세요."
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({error:"장소 검색에 실패했습니다."},{status:502});
  }
}
