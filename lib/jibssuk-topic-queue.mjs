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
    "[가장 중요한 목적] 최근 7일간 실제 뉴스·방송·사건·수상·분양 등에서 등장한 아파트 글감 최대 10개를 찾는다. 특히 사람들이 알아보고 싶어질 만한 '실제 아파트 단지'를 찾아라. 단순 집값 상승이나 일반 시장 동향을 우선 추천하는 것이 아니다.",
    "아파트 이름이 실제 원문에 등장하고, 최근 어떤 사건·소식으로 주목받았는지 확인된 글감을 찾는다. 반드시 검색량 상승을 증명해야 하는 것은 아니다. 뉴스에 등장했다는 사실과 검색량이 늘었다는 주장은 분리한다.",
    "[조사 설정]",
    "조사 기준일: "+(clean(today,30)||"오늘 (한국 시간)"),
    "선택한 범위: "+selected,
    selected==="아파트 중심"?"뉴스·방송·사건·수상·분양 등으로 등장한 특정 아파트 단지부터 찾는다. 필요할 때만 해당 단지의 실거래·거래량·가격 차이를 조사할 후속 소재로 참고한다.":
      selected==="지역 변화"?"GTX·지하철·트램·교통 변화·재개발·재건축·지역개발의 최신 이슈를 찾아 주민과 관심 지역 독자가 궁금해할 구체적 변화를 추천한다.":
      "아파트 중심과 지역 변화를 모두 조사한다. 다만 뉴스·방송·사건·수상·분양으로 최근 이슈가 된 실제 아파트를 먼저 폭넓게 찾고, 근거 있는 지역 변화도 포함한다. 분야별 개수를 억지로 맞추지 않는다.",
    "먼저 최근 7일을 조사한다. 확인된 글감이 부족하면 최근 30일까지 넓힌다. 오래된 사건을 새 소식처럼 소개하지 않는다.",
    "[실제 뉴스에서 글감 찾는 방법]",
    "1. 사건·사고, 하자, 주민 갈등, 관리 문제 등 최근 보도에 등장한 이름이 확인되는 아파트. 피해자 신상·개별 세대 등 사생활 정보는 다루거나 추정하지 않는다.",
    "2. 방송·예능·인터뷰·연예인 관련 소식으로 실제 이름이 공개되어 화제가 된 아파트. 프로그램 또는 공개 발언의 원문을 확인한다. 연예인의 사적인 집 주소·거주 단지는 유추하지 않는다.",
    "3. 살기 좋은 아파트 선정, 주거·조경·건축상 수상, 특별한 시설로 소개된 아파트. 공식 수상 발표와 수상 단지명을 확인한다.",
    "4. 최근 분양, 분양가 논란, 청약 흥행, 미분양, 특별공급 등으로 보도된 실제 신규 아파트. 공식 모집공고와 기사 날짜를 확인한다.",
    "5. 재건축·교통·지역 변화로 보도된 아파트. 해당 단지와 이슈 사이의 실제 연결 근거를 확인한다.",
    "네이버 데이터랩·구글 트렌드 등 검증 가능한 검색 동향, 최근 언론 보도, 실제 커뮤니티 반응, 공식 발표를 참고하되 검색량 데이터가 없으면 검색량 급증이라고 쓰지 않는다.",
    "[각 후보를 정하는 기준]",
    "반드시 '어떤 아파트가 무슨 일로 최근 주목받았는지'를 말할 수 있어야 한다. 아파트 명칭·사건 또는 소식·원문 발표일을 확인한다. 지역 변화는 구체적 장소·변화·발표일을 확인한다.",
    "글감 제목에는 아파트 이름과 실제 이슈의 핵심을 짧게 담는다. 예: 'OO아파트, 최근 살기 좋은 아파트로 선정된 이유'처럼 관심의 계기가 드러나야 한다. 허위 인용·사실 단정·자극적인 사고 표현을 피한다.",
    "실제로 해당 단지가 등장하지 않는 기사로 연관성을 만들어내거나, 이슈 없이 'OO아파트 실거래 분석' 같은 일반 주제를 억지로 추천하지 않는다.",
    "interestEvidence에는 왜 지금 이 아파트가 등장했는지 구체적인 사건·발표·방송 내용과 출처·날짜를 적는다. 관심·인기가 '급증했다'는 주장은 측정 근거가 있을 때만 쓴다.",
    "실거래가·거래량·기간·면적 등을 임의로 만들지 않는다. 실거래 세부 조사와 글쓰기는 주제 선택 뒤에 진행하므로 여기서는 검증된 글감 추천에 집중한다.",
    "추천은 실제 웹 검색과 원문 확인이 가능한 경우에만 수행한다. 링크를 열 수 없으면 확인했다고 주장하지 말고 해당 후보를 제외한다. 근거가 약하면 10개를 억지로 채우지 않는다.",
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
