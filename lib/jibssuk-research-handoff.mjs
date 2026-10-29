/**
 * 집값쓱 발행 목록(10칸)에서 심층 조사(5칸)로 넘기는 단일 임시 핸드오프.
 * 같은 브라우저·같은 출처의 localStorage에서만 동작한다.
 * 글감 추천 근거는 아직 사실로 검증되지 않은 메모다.
 */
export const JIBSSUK_RESEARCH_HANDOFF_KEY="content-maker-jibssuk-research-handoff-v1";
const trim=(x,n)=>typeof x==="string"?x.trim().slice(0,n):"";
const secureUrl=(x)=>{
  try {
    const u=new URL(trim(x,1000));
    return u.protocol==="https:"&&u.hostname&&!u.username&&!u.password?u.href:"";
  } catch { return ""; }
};
const date=(x)=>/^\d{4}-\d{2}-\d{2}$/.test(trim(x,10))?trim(x,10):"";
const key=(s)=>trim(s,600).normalize("NFKC").toLowerCase().replace(/\s+/g," ");
export function makeResearchHandoff(candidate){
  const title=trim(candidate?.title,600),sourceUrl=secureUrl(candidate?.sourceUrl),sourceDate=date(candidate?.sourceDate);
  if(!title||!sourceUrl||!sourceDate)return null;
  return {version:1,title,
    category:trim(candidate?.category,40),
    interestType:trim(candidate?.interestType,80),
    interestEvidence:trim(candidate?.interestEvidence,800),
    sourceUrl,sourceDate,
    checkedAt:date(candidate?.checkedAt),
  };
}
export function parseResearchHandoff(raw){
  if(typeof raw!=="string"||raw.length>12000)return null;
  try{
    const obj=JSON.parse(raw);
    if(!obj||obj.version!==1||typeof obj.title!=="string"||
      typeof obj.sourceUrl!=="string"||typeof obj.sourceDate!=="string"||
      !obj.title.trim()||obj.title.length>600)return null;
    return makeResearchHandoff(obj);
  }catch{return null;}
}
export function researchNotesFromHandoff(h){
  return [
    "[집값쓱 발행 목록에서 전달한 글감 — 원문 확인 전]",
    "글감: "+h.title,
    h.category?"분류: "+h.category:"",
    h.interestType?"발견 경로: "+h.interestType:"",
    h.interestEvidence?"최근 이슈·추천 근거(AI 조사 결과, 미검증): "+h.interestEvidence:"",
    "원문 발표일(추천 결과): "+h.sourceDate,
    h.checkedAt?"글감 조사 기준일: "+h.checkedAt:"",
    "기사·발표 원문 URL: "+h.sourceUrl,
    "확인 지시: 위 원문에서 실제 단지명·발표일·이슈 내용을 확인한 뒤, 해당 사건에 필요한 추가 공식 자료를 조사한다. 이 메모 자체는 검증된 사실이 아니다.",
  ].filter(Boolean).join("\n");
}
/**
 * @param {Array<string|null>} raws 조사 슬롯 저장소의 원문 JSON (1번은 legacy fallback 포함)
 * 기존 슬롯은 절대 자동 교체하지 않는다. 알 수 없는 저장 내용도 사용 중으로 취급한다.
 */
export function pickResearchDestination(raws,handOff){
  if(!handOff||!Array.isArray(raws)||raws.length!==5)return {kind:"invalid",slot:0};
  let free=0;
  for(let i=0;i<5;i++){
    const raw=raws[i];
    if(raw===null||raw===undefined||raw===""){if(!free)free=i+1;continue;}
    let obj;
    try{obj=typeof raw==="string"?JSON.parse(raw):null;}catch{return {kind:"full",slot:0};}
    if(!obj||obj.version!==1||typeof obj.topic!=="string")return {kind:"full",slot:0};
    if(key(obj.topic)===key(handOff.title))return {kind:"existing",slot:i+1};
    const occupied=Boolean(obj.topic||obj.notes||obj.raw||obj.finalRaw||obj.finalTitle||obj.finalBody||
      obj.selectedAngleId||(Array.isArray(obj.approvedKeys)&&obj.approvedKeys.length));
    if(!occupied&&!free)free=i+1;
  }
  return free?{kind:"free",slot:free}:{kind:"full",slot:0};
}
