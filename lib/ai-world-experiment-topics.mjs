export const TOPIC_BANK_VERSION = "TOPIC-BANK-V1";
export const TOPIC_SEEDS = Object.freeze([
  {category:"World & Lifestyle",title:"AI 3사에게 가장 살기 좋은 나라를 물어봤다",question:"As of October 2026, choose ONE country you consider the best place to live overall for an average adult. Explain your criteria, three strengths, two tradeoffs, and uncertainty. Do not claim this is a universal fact."},
  {category:"Technology",title:"AI 3사가 추천하는 최고의 스마트폰은?",question:"As of October 2026, recommend ONE best overall smartphone for most people. Explain the evaluation criteria, major strengths and tradeoffs. Distinguish verified facts from personal judgments."},
  {category:"Technology",title:"최고의 노트북 한 대만 고르라면 AI 3사는?",question:"As of October 2026, choose ONE best overall laptop for most people. State your criteria, strengths, limitations, and uncertainty. Do not invent prices or specifications."},
  {category:"Technology",title:"AI 3사에게 최고의 TV를 물어봤다",question:"As of October 2026, recommend ONE best overall television for picture quality, practicality and features. Explain the conditions and tradeoffs, and distinguish your opinion from measured specifications."},
  {category:"Brands",title:"세계 브랜드 평판 1위, AI 3사의 선택은?",question:"As of October 2026, name ONE brand you consider to have the strongest global reputation. Explicitly explain the definition of reputation. Do not claim a formal ranking number one without naming a reputable index, year, and methodology."},
  {category:"Media",title:"AI 3사가 추천하는 가장 퀄리티 높은 유튜브 채널",question:"As of October 2026, recommend ONE YouTube channel with consistently outstanding content quality for an international audience. Explain clear evaluation criteria, strengths, limitations, and uncertainty."},
  {category:"Automotive",title:"세계 최고의 자동차 브랜드를 하나만 고르라면?",question:"As of October 2026, choose ONE best overall car brand for an average consumer worldwide. Explain safety, reliability, value and other criteria, as well as tradeoffs and regional variation."},
  {category:"Travel",title:"평생 단 한 나라만 여행한다면 AI 3사는?",question:"If you could recommend visiting only ONE country for a lifetime of travel, which would it be? Explain your criteria, three reasons, tradeoffs and uncertainty."},
  {category:"Lifestyle",title:"AI 3사가 추천하는 은퇴 후 살기 좋은 도시는?",question:"As of October 2026, recommend ONE city for retirement. Consider healthcare, safety, affordability, community and visas, while making your assumptions and uncertainty explicit."},
  {category:"Audio",title:"AI 3사에게 가장 추천하는 무선 이어폰을 물어봤다",question:"As of October 2026, recommend ONE best overall wireless earbuds model for most people. Explain sound, comfort, battery, value, and limitations without inventing specs or current prices."},
]);

export function topicKey(value) {
  return String(value||"").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g,"");
}
export function sanitizeTopic(value, index=0) {
  if (!value || typeof value!=="object") return null;
  const title=String(value.title||"").trim().slice(0,180);
  if (title.length<5) return null;
  const status=["pending","active","used"].includes(value.status)?value.status:"pending";
  const question=String(value.question||"").trim().slice(0,1700);
  const category=String(value.category||"AI Comparison").trim().slice(0,100);
  return {
    id: typeof value.id==="string"&&/^[a-zA-Z0-9_-]{3,90}$/.test(value.id) ? value.id : "topic-"+topicKey(title).slice(0,40)+"-"+index,
    title,category,question,status,
    createdAt:typeof value.createdAt==="string"?value.createdAt:"",
    usedAt:status==="used"&&typeof value.usedAt==="string"?value.usedAt:"",
  };
}
export function initialTopics() {
  return TOPIC_SEEDS.map((entry,i)=>({...sanitizeTopic(entry,i),id:"seed-"+String(i+1).padStart(2,"0"),status:"pending",createdAt:"",usedAt:""}));
}
export function mergeTopics(existing, incoming) {
  const list=[],keys=new Set(),ids=new Set();
  for(const [index,value] of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(incoming)?incoming:[])].entries()){
    const topic=sanitizeTopic(value,index);
    if (!topic || keys.has(topicKey(topic.title))) continue;
    keys.add(topicKey(topic.title));
    if(ids.has(topic.id))topic.id="topic-"+topicKey(topic.title).slice(0,40)+"-"+index;
    ids.add(topic.id);
    list.push(topic);
  }
  return list.slice(0,500);
}
export function parseBulkTopics(raw) {
  return String(raw||"").split(/\r?\n/).map(s=>s.replace(/^\s*(?:[-*]|\d+[.)])\s*/,"").trim())
    .filter(s=>s.length>=5).slice(0,50).map((title,i)=>({title,category:"AI Comparison",question:"",id:"manual-"+topicKey(title).slice(0,40)+"-"+i}));
}
export function countTopics(topics) {
  const list=Array.isArray(topics)?topics:[];
  return {total:list.length,pending:list.filter(t=>t.status==="pending").length,active:list.filter(t=>t.status==="active").length,used:list.filter(t=>t.status==="used").length};
}
