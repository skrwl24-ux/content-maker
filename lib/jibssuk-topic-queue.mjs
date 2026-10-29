// 집값쓱 발행 큐 1단계: 조사 요청서, 고정 JSON 결과, 후보 목록, 10칸 상태 전환.
export const QUEUE_SIZE=10;
export const TAG="JIBSSUK_TOPIC_RECOMMENDATIONS_JSON";
export const SCOPES=["전체","아파트 중심","지역 변화"];
const CATEGORIES=new Set(["아파트","지역 변화"]);
const TYPES=new Set(["검색 트렌드","언론 보도","커뮤니티 반응","공식 발표","실거래 자료"]);
const clean=(v,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
const url=(v)=>{try{const u=new URL(clean(v,1000));return u.protocol==="https:"&&u.hostname&&!u.username&&!u.password?u.href:"";}catch{return ""}};
export function topicKey(title){return clean(title,250).normalize("NFKC").toLowerCase().replace(/[^가-힣a-z0-9]/g,"");}
export function buildPrompt({scope="전체",today="",queue=[],history=[],previousSuggestions=[]}={}){
  const selected=SCOPES.includes(scope)?scope:"전체";
  const used=[...queue,...history,...previousSuggestions].map(x=>clean(typeof x==="string"?x:x?.title,200)).filter(Boolean);
  const excluded=[...new Set(used)].slice(-130);
  const sample={version:1,checkedAt:"YYYY-MM-DD",candidates:[{
    title:"실제 확인한 관심 주제",category:"아파트",interestType:"언론 보도",
    interestEvidence:"실제로 확인한 최근 관심 근거",sourceUrl:"https://확인한-원문-링크",sourceDate:"YYYY-MM-DD"
  }]};
  return [
    "집값쓱 · 새 글감 발굴 조사. 블로그 원고는 작성하지 않는다.",
    "[목표] 최근 사람들이 실제 관심을 보이는 집값쓱 글감 최대 10개를 조사한다. 단순히 신문에 나온 새 소식과 실제 검색 관심 증가를 혼동하지 않는다.",
    "[조사 설정]",
    "조사 기준일: "+(clean(today,30)||"오늘 (한국 시간)"),
    "선택한 범위: "+selected,
    selected==="아파트 중심"?"아파트 실거래·거래량·가격 차이·직장 주변 주거지를 우선한다.":
      selected==="지역 변화"?"GTX·지하철·트램·교통 변화·재개발·재건축·지역개발을 우선한다.":
      "아파트 중심과 지역 변화를 모두 조사한다. 비율을 억지로 맞추지 말고 실제 관심이 큰 주제를 우선한다.",
    "먼저 최근 7일을 조사한다. 확인된 글감이 부족하면 최근 30일까지 넓힌다. 오래된 사건을 새 소식처럼 소개하지 않는다.",
    "[추천 근거]",
    "네이버 데이터랩·구글 트렌드 등 실제 검색 동향, 최근 다수 언론 보도, 실제 커뮤니티 질문·반응, 정부·지자체 공식 발표, 국토부 실거래 자료를 찾아본다.",
    "추천은 반드시 실제 웹 검색과 원문 확인을 거친 자료를 근거로 한다. 검색 데이터가 없으면 '검색량 급증'이라고 쓰지 않는다.",
    "언론에서 화제가 된 경우는 언론 보도, 검색 증가를 확인한 경우는 검색 트렌드로 정확히 구분한다.",
    "실거래가·거래량·기간·면적 등을 임의로 만들지 않는다. 같은 면적과 계약 조건을 비교할 때 차이를 분명하게 밝힌다.",
    "독자가 실제로 궁금해할 질문과 눈에 띄는 발견을 담은 구체적 제목을 추천한다.",
    "근거가 약하면 10개를 억지로 채우지 않는다.",
    "[이미 발행·제작·추천했던 글감 — 유사 주제도 제외]",
    ...(excluded.length?excluded.map(x=>"- "+x):["기록 없음"]),
    "[사이트 연동용 고정 출력 계약]",
    "아래 태그 사이에 유효한 JSON 객체 1개만 넣는다. 코드블록이나 태그 밖의 다른 문장을 쓰지 않는다.",
    "version=1, checkedAt=YYYY-MM-DD, candidates=0~10개.",
    "title은 실제 글감 제목, category는 '아파트' 또는 '지역 변화', interestType은 '검색 트렌드'/'언론 보도'/'커뮤니티 반응'/'공식 발표'/'실거래 자료' 중 정확히 하나다.",
    "interestEvidence에는 실제 관심의 구체적 확인 근거, sourceUrl에는 실제 열어 확인한 https 원문, sourceDate에는 그 자료의 발표일(YYYY-MM-DD)을 넣는다.",
    "링크가 없거나 날짜를 확인할 수 없다면 후보를 제외한다. 가짜 링크·날짜·검색량을 만들지 않는다.",
    "["+TAG+"]",JSON.stringify(sample,null,2),"[/"+TAG+"]",
    "위는 형식 예시다. 실제 확인된 항목으로 교체한다."
  ].join("\n\n");
}
export function parseRecommendations(raw){
  const s=typeof raw==="string"?raw:"";
  if(!s.trim()||s.length>160000)return {error:"결과가 없거나 너무 깁니다.",candidates:[]};
  const start="["+TAG+"]",end="[/"+TAG+"]";
  const left=s.indexOf(start),right=s.indexOf(end);
  if((left>=0)!==(right>=0)||(left>=0&&right<=left))return {error:"결과 시작·종료 태그가 맞지 않습니다.",candidates:[]};
  let x;try{x=JSON.parse((left<0?s:s.slice(left+start.length,right)).trim())}catch{return {error:"JSON 형식을 인식하지 못했습니다. ChatGPT 결과 전체를 붙여넣으세요.",candidates:[]}}
  if(!x||Array.isArray(x)||x.version!==1||!Array.isArray(x.candidates))return {error:"결과 버전 또는 candidates 형식이 다릅니다.",candidates:[]};
  if(x.candidates.length>10)return {error:"한 번에 추천된 글감은 최대 10개여야 합니다.",candidates:[]};
  const seen=new Set(),out=[];let skipped=0;
  for(const c of x.candidates){
    if(!c||typeof c!=="object"||Array.isArray(c)){skipped++;continue}
    const title=clean(c.title,220),key=topicKey(title),category=clean(c.category,30),
      interestType=clean(c.interestType,40),interestEvidence=clean(c.interestEvidence,800),
      sourceUrl=url(c.sourceUrl),sourceDate=clean(c.sourceDate,10);
    if(!key||seen.has(key)||!CATEGORIES.has(category)||!TYPES.has(interestType)||!interestEvidence||!sourceUrl||
      !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)){skipped++;continue}
    seen.add(key);out.push({title,category,interestType,interestEvidence,sourceUrl,sourceDate});
  }
  return {error:"",checkedAt:clean(x.checkedAt,20),candidates:out,skipped};
}
export function emptyState(){return {version:1,queue:Array(QUEUE_SIZE).fill(null),candidates:[],history:[],previousSuggestions:[],lastCheckedAt:""}}
export function restore(raw){
  const e=emptyState();
  if(!raw||raw.version!==1||!Array.isArray(raw.queue))return e;
  const queue=Array.from({length:QUEUE_SIZE},(_,i)=>{
    const x=raw.queue[i];if(!x||!topicKey(x.title))return null;
    return {...x,status:["waiting","working","done"].includes(x.status)?x.status:"waiting"};
  });
  return {...e,queue,candidates:Array.isArray(raw.candidates)?raw.candidates.slice(0,200):[],
    history:Array.isArray(raw.history)?raw.history.slice(-500):[],
    previousSuggestions:Array.isArray(raw.previousSuggestions)?raw.previousSuggestions.slice(-300):[],
    lastCheckedAt:clean(raw.lastCheckedAt,20)};
}
const contains=(items,title)=>items.some(x=>topicKey(x?.title)===topicKey(title));
export function addRecommendations(state,report){
  const base=restore(state),next={...base,candidates:[...base.candidates],previousSuggestions:[...base.previousSuggestions]};
  let added=0,skipped=Number(report?.skipped)||0;
  for(const c of report?.candidates||[]){
    if(!topicKey(c?.title)){skipped++;continue}
    if(!next.previousSuggestions.some(x=>topicKey(x)===topicKey(c.title)))next.previousSuggestions.push(c.title);
    if(contains(next.queue.filter(Boolean),c.title)||contains(next.history,c.title)||contains(next.candidates,c.title)||next.candidates.length>=200){
      skipped++;continue;
    }
    next.candidates.push({...c,checkedAt:report.checkedAt||""});added++;
  }
  next.previousSuggestions=next.previousSuggestions.slice(-300);
  next.lastCheckedAt=clean(report?.checkedAt,20);
  return {state:next,added,skipped};
}
export function placeCandidate(state,title,target=null){
  const base=restore(state),k=topicKey(title),c=base.candidates.find(x=>topicKey(x.title)===k);
  if(!c)return {state:base,error:"저장된 후보에 없는 글감입니다."};
  if(contains(base.queue.filter(Boolean),title)||contains(base.history,title))return {state:base,error:"이미 등록하거나 발행했던 글감입니다."};
  const slot=target===null?base.queue.findIndex(x=>x===null):target;
  if(!Number.isInteger(slot)||slot<0||slot>=QUEUE_SIZE)return {state:base,error:"빈자리가 없습니다. 발행 완료 자리에서 갈아끼우기를 눌러 주세요."};
  if(base.queue[slot]&&base.queue[slot].status!=="done")return {state:base,error:"대기·제작 중인 자리는 교체할 수 없습니다."};
  const queue=[...base.queue];queue[slot]={...c,status:"waiting",addedAt:new Date().toISOString(),completedAt:""};
  return {state:{...base,queue,candidates:base.candidates.filter(x=>topicKey(x.title)!==k)},slot};
}
export function changeStatus(state,slot,status){
  const base=restore(state),old=base.queue[slot];if(!old||!["waiting","working","done"].includes(status))return base;
  const queue=[...base.queue],history=[...base.history];
  if(old.status==="done"&&status!=="done"){const idx=history.findIndex(x=>x.addedAt===old.addedAt);if(idx>=0)history.splice(idx,1)}
  const item={...old,status,completedAt:status==="done"?(old.completedAt||new Date().toISOString()):""};queue[slot]=item;
  if(status==="done"&&!history.some(x=>x.addedAt===item.addedAt))history.push(item);
  return {...base,queue,history:history.slice(-500)};
}
