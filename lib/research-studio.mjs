import { EDITORIAL_DIRECTOR_RULES, buildEvidenceHandoff } from "./editorial-director.mjs";

export const DEFAULT_DEEP_RESEARCH_DIRECTIONS = [
  "독자가 가장 궁금해할 질문을 먼저 생각하고, 최신 공식 자료와 실제 사례에서 답을 찾는다.",
  "숫자·날짜·가격·이전 발표를 비교해 예상 밖의 차이와 놓치기 쉬운 사건을 발견한다.",
  "발견 후보 중 가장 흥미로운 사실과 왜 주목할 만한지, 어떤 원문이 뒷받침하는지 제시한다.",
  "관련성이 있는 단서가 나오면 후속 원문까지 추적하고, 출처와 자료 기준일을 기록한다.",
  "새로운 발견이 없다면 기본 질문의 답과 확인된 사실만 간결하게 정리한다.",
].join("\n");

export const DEFAULT_FINAL_ARTICLE_DIRECTIONS = [
  "자료를 읽으며 남들이 지나치기 쉬운 사실을 발견한 사람이, 옆에서 혼잣말하듯 자연스럽게 이야기를 풀어낸다.",
  "독자가 궁금해한 답을 초반에 알려주고, 가장 눈에 걸리는 숫자나 의외의 사건을 중심으로 왜 그런지 따라간다.",
  "뉴스를 정리하거나 강의하는 말투보다 스스로 의아해하고 곱씹는 관찰자의 목소리로 쓴다. 독자에게 알려주고 싶은 발견이 이야기의 중심이다.",
  "‘이상한데?’, ‘그러고 보니’ 같은 혼잣말은 정말 어울릴 때만 쓴다. 매번 질문이나 감탄으로 시작하는 고정 패턴은 만들지 않는다.",
  "실제 취재·방문하지 않은 일을 경험담처럼 꾸미지 않고, 공식 자료에서 확인한 발견임을 자연스럽게 드러낸다.",
  "모바일에서 편한 짧은 문단으로 쓰되 모든 문장을 한 줄씩 끊지 않는다. 소제목·결론·이미지 수는 이야기의 필요에 따라 결정한다.",
].join("\n");

/**
 * 집값쓱 전용 고정 편집 기준: 개별 편집창에 저장된 이전 지시문이 있어도
 * 실제 화제의 원문 → 해당 이슈 조사 → 간결한 원고 순서를 보장한다.
 * Paramma·기타 채널에는 적용하지 않는다.
 */
const JIBSSUK_ISSUE_RESEARCH_RULES = [
  "추천·선택된 주제의 출발점은 최근 뉴스·방송·사건·수상·분양·지역 변화에 실제로 등장한 아파트 또는 구체적인 이슈다. 먼저 왜 지금 이 아파트가 뉴스에 나왔는지 확인하라.",
  "실제 단지명과 그 단지가 등장한 원문, 보도·발표일, 사건 발생일이 서로 일치하는지 확인하라. 기사에서 이름이 나오지 않았는데 단지를 추정하거나, 공개되지 않은 거주지·사생활을 추적하지 마라.",
  "주제의 중심 사건·발표가 무엇인지, 지금 유효한 상태인지, 독자가 바로 알고 싶을 구체적 사실이 무엇인지 최신 공식 원문과 신뢰할 만한 1차 자료로 확인하라.",
  "첫 기사만 요약하지 말고 사건의 전후 경과, 공식 발표·추가 보도, 날짜·수치·결과를 교차 확인해 정보가 충분한지 살펴라. 빠진 핵심 사실은 별도 원문으로 재조사하라.",
  "수상 소식이라면 선정 근거와 실제 특징, 분양 소식이라면 공고·분양가·일정·청약 결과, 교통·재건축 소식이라면 결정된 변화와 현재 일정 등 해당 이슈에 직접 필요한 정보를 우선한다.",
  "실거래가격이 주제와 직접 관련된 경우에만 같은 면적·기간·유효 계약으로 추세와 가격 차이를 조사하라. 상승세는 여러 기간의 실제 거래로 확인된 경우에만 보고하고, 사건·방송·수상 글에 실거래 비교를 억지로 붙이지 마라.",
  "원문과 추정은 구분하고 검색량 상승·인기 폭증을 입증할 자료가 없으면 주장하지 마라. 가격이나 피해 원인을 추측하지 마라.",
  "angles는 이슈에서 벗어나지 않는 실질적인 글 관점 1~3개만 제시한다. 각각의 readerQuestion·uniqueValue·factIds를 실제로 확인한 내용과 연결하고, 새 발견이 없어도 확인된 핵심 정보만 제시해도 된다.",
  "사실이 부족할 때는 문장을 늘려 보완하지 말고 관련 원문을 더 조사한다. 끝내 확인할 수 없는 사실은 gaps에 남기고, 글감 가치가 부족하면 그대로 보고한다.",
].join("\n");

const JIBSSUK_ISSUE_ARTICLE_RULES = [
  "최우선: 지금 화제가 된 특정 아파트 또는 사건·수상·분양·방송·지역 변화의 맥락에서 벗어나지 않는다. 주제의 실제 이슈와 확인된 내용을 중심으로 쓴다.",
  "조사는 깊게, 글은 짧고 명확하게. 확인된 사실·날짜·가격·변화·흐름 중 독자가 궁금해할 핵심만 골라 쓰고, 조사 과정·미해결 조사 메모를 본문에 늘어놓지 않는다.",
  "도입은 실제 소식과 상황에서 편안하게 시작하고, 본문은 그 소식을 이해하는 데 필요한 구체적 정보가 자연스럽게 이어지게 쓴다. B형 도입과 C형 정보 밀도의 장점을 쓰되 고정된 문단 순서나 목차를 만들지 않는다.",
  "제목이 약속한 정보를 초반에 알려주고, 문단마다 새로운 확인 사실이나 핵심 수치가 나오도록 한다. 억지 반전·호기심 질문·감탄·혼잣말·반복 해설로 연결하지 않는다.",
  "실거래 자료가 있다면 '어느 날 얼마에 거래됐다'처럼 계약일·면적·가격을 직접 써라. 여러 기간 실제 자료에서 상승 흐름이 확인되면 '최근 1년 동안 상승세가 이어졌다'처럼 짧고 분명하게 전달하라. 단기간 몇 건만으로 장기 상승세를 만들어내지는 마라.",
  "층수·동·향·내부 상태처럼 원인 근거가 없으면 가격 차이의 이유를 상상하거나 '확인할 수 있다면'으로 글을 채우지 마라. '몇 건만으로 시세라고 볼 수 없다', '신중히 판단해야 한다' 같은 뻔한 주의사항·훈계·불필요한 부연을 붙이지 마라.",
  "수상·방송·사건·분양 관련 글에 가격과 비교표를 형식적으로 추가하지 않는다. 무엇이 일어났고 실제로 무엇이 확인됐는지 짧게 전달하는 것만으로 충분할 수 있다.",
  "출처로 확인되지 않은 인과관계·거주자 신원·사생활·직접 방문 경험·실제 인용처럼 보이는 가상 발언은 쓰지 않는다. 사고·피해 관련 주제는 피해자를 자극적으로 소비하지 않는다.",
  "독자가 원하는 답을 얻었다면 자연스럽게 끝낸다. 결론·훈계·Q&A·요약·소제목·분량을 의무적으로 채우지 않는다. 자료가 부족하면 길게 쓰지 말고 확인된 범위만 쓴다.",
].join("\n");

const safe = (v, n=1800) => typeof v==="string" ? v.trim().slice(0,n) : "";
const list = (v, n=12) => Array.isArray(v) ? v.slice(0,n) : [];
const id = (v,fallback) => /^[a-z0-9_-]{1,36}$/i.test(v||"") ? v : fallback;
const validUrl = (v) => {
  const str=safe(v,600);
  try { const u=new URL(str); return u.protocol==="https:" && !u.username && !u.password ? str : ""; }
  catch { return ""; }
};
const sample={topic:"조사 주제",checkedAt:"YYYY-MM-DD",summary:"현재 알 수 있는 사실과 한계",facts:[{id:"f1",claim:"원문에서 확인한 단일 사실",sourceUrl:"",sourceTitle:"원문 제목",publishedAt:"YYYY-MM-DD"}],angles:[{id:"a1",title:"글감 제목",readerQuestion:"독자가 궁금한 것",uniqueValue:"독자에게 새롭게 제공할 정보",factIds:["f1"]}],gaps:["추가로 확인할 질문"],trendLinks:[{subject:"방송·인물·영화·장소",connection:"실제 관련성",sourceUrl:"",status:"확인 필요"}]};

export function buildDeepResearchPrompt({channel="기타",topic="",notes="",today="",directions}={}) {
  return [
    "콘텐츠 메이커 AI 심층 조사. 원고는 아직 쓰지 말고 조사 결과만 제출한다.",
    EDITORIAL_DIRECTOR_RULES,
    "[작업]", "발행 채널: "+safe(channel,40), "주제: "+safe(topic,600), "기준일: "+safe(today,40),
    buildEvidenceHandoff({notes}),
    "[심층 조사 방향 — 운영자 설정]",
    typeof directions === "string" ? directions.trim().slice(0,12000) : DEFAULT_DEEP_RESEARCH_DIRECTIONS,
    ...(channel==="집값쓱" ? ["[집값쓱 이슈 중심 심층 조사 — 다른 문체·일반 지시보다 우선]",JIBSSUK_ISSUE_RESEARCH_RULES] : []),
    "[자료 확인]",
    "가능한 공식 원문을 실제로 열어 확인하고, 검색이 불가능하면 확인했다고 말하지 않는다.",
    "발표일·실제 사건일·조사 기준일과 출처가 불분명한 부분을 구분한다.",
    "찾지 못한 근거와 해결되지 않은 질문은 gaps에 남긴다.",
    "[반환 형식]",
    "아래 형식과 같은 유효한 JSON을 실제 조사 결과로 채워 정확히 [RESEARCH_REPORT_JSON]과 [/RESEARCH_REPORT_JSON] 사이에 넣는다. 태그 내부에는 마크다운 코드블록을 넣지 않는다.",
    "[RESEARCH_REPORT_JSON]", JSON.stringify(sample,null,2), "[/RESEARCH_REPORT_JSON]",
    "facts는 원문에서 확인 가능한 단일 주장과 해당 https URL을 연결한다. 찾지 못했다면 sourceUrl은 빈 문자열로 적는다. angles의 factIds는 facts의 실제 id를 참조한다.",
  ].join("\n\n");
}

export function parseResearchReport(raw) {
  const source=typeof raw==="string" ? raw : "";
  const match=source.match(/\[RESEARCH_REPORT_JSON\]([\s\S]*?)\[\/RESEARCH_REPORT_JSON\]/i);
  const json=(match?match[1]:source).trim();
  if(!json||json.length>180000) return null;
  let value;
  try { value=JSON.parse(json); } catch { return null; }
  if(!value || typeof value!=="object" || Array.isArray(value) || !safe(value.topic,600)) return null;
  const seenFacts=new Set();
  const facts=list(value.facts,30).map((v,i)=>{
    if(!v||typeof v!=="object"||!safe(v.claim)) return null;
    let key=id(v.id,"f"+(i+1)); if(seenFacts.has(key))key="f-index-"+i;seenFacts.add(key);
    return {id:key,claim:safe(v.claim),sourceUrl:validUrl(v.sourceUrl),sourceTitle:safe(v.sourceTitle,250),publishedAt:safe(v.publishedAt,60)};
  }).filter(Boolean);
  const seenAngles=new Set();
  const angles=list(value.angles,5).map((v,i)=>{
    if(!v||typeof v!=="object"||!safe(v.title,250))return null;
    let key=id(v.id,"a"+(i+1));if(seenAngles.has(key))key="a-index-"+i;seenAngles.add(key);
    return {id:key,title:safe(v.title,250),readerQuestion:safe(v.readerQuestion,800),uniqueValue:safe(v.uniqueValue,1200),factIds:list(v.factIds,30).filter(x=>typeof x==="string"&&seenFacts.has(x))};
  }).filter(Boolean);
  const trendLinks=list(value.trendLinks,10).map(v=>v&&typeof v==="object"&&safe(v.subject,250)?{subject:safe(v.subject,250),connection:safe(v.connection,700),sourceUrl:validUrl(v.sourceUrl),status:safe(v.status,100)||"확인 필요"}:null).filter(Boolean);
  const gaps=list(value.gaps,20).map(v=>safe(v,600)).filter(Boolean);
  if(!facts.length&&!angles.length&&!gaps.length) return null;
  return {topic:safe(value.topic,600),checkedAt:safe(value.checkedAt,60),summary:safe(value.summary,3500),facts,angles,gaps,trendLinks};
}

/**
 * ChatGPT의 최종 네이버 원고 응답을 독립적으로 가져온다.
 * 태그 JSON/일반 본문 모두 수용하며, HTML로 해석하지 않는다.
 */
export function parseNaverFinalArticle(raw) {
  const source = typeof raw==="string" ? raw.trim() : "";
  if (!source || source.length>180000) return null;
  const tagged=source.match(/\[NAVER_FINAL_ARTICLE_JSON\]([\s\S]*?)\[\/NAVER_FINAL_ARTICLE_JSON\]/i);
  if (/\[NAVER_FINAL_ARTICLE_JSON\]/i.test(source) && !tagged) return null;
  if (tagged || source.startsWith("{")) {
    let value;
    try { value=JSON.parse((tagged ? tagged[1] : source).trim()); } catch { return null; }
    if (!value || typeof value!=="object" || Array.isArray(value) || typeof value.body!=="string" || !value.body.trim() || value.body.length>120000) return null;
    return {title:safe(value.title,250),body:value.body.trim()};
  }
  if (/\[(?:RESEARCH_REPORT_JSON|TOPIC_RECOMMENDATIONS_JSON)\]/i.test(source)) return null;
  return {title:"",body:source.slice(0,120000)};
}

export function factKey(fact) { return [fact?.claim||"",fact?.sourceUrl||""].join("||"); }

export function buildFollowupResearchPrompt({channel,topic,notes="",report,approvedKeys=[],today="",directions}={}) {
  if(!report)return "";
  const confirmed=new Set(approvedKeys);
  const remaining=report.facts.filter(f=>!confirmed.has(factKey(f)));
  return [
    "콘텐츠 메이커 AI 추가 조사: 다음 정보에서 빠진 원문과 연결 근거를 찾아라.",
    EDITORIAL_DIRECTOR_RULES,
    "[심층 조사 방향 — 운영자 설정]", typeof directions === "string" ? directions.trim().slice(0,12000) : DEFAULT_DEEP_RESEARCH_DIRECTIONS,
    ...(channel==="집값쓱" ? ["[집값쓱 이슈 중심 추가 조사 — 다른 문체·일반 지시보다 우선]",JIBSSUK_ISSUE_RESEARCH_RULES] : []),
    "채널: "+safe(channel,40),"주제: "+safe(topic||report.topic,600),"확인 기준일: "+safe(today,40),
    buildEvidenceHandoff({notes}),
    "[이전 조사 요약 - 검증된 사실로 간주하지 말 것]",report.summary,
    "[미해결 질문]",...(report.gaps.length?report.gaps.map(x=>"- "+x):["- 새로 발견된 근거가 있는지 검토"]),
    "[사용자가 원문 확인하지 않은 주장]",...(remaining.length?remaining.map(f=>"- "+f.claim+" / "+(f.sourceUrl||"원문 없음")):["- 현재 없음"]),
    "검색 결과에서 실제 원문을 확인하고 이전 사실을 포함한 전체 보고서를 다시 작성하라. 일부 변경 사항만 보내지 마라.",
    "결과는 아래 스키마의 [RESEARCH_REPORT_JSON] ... [/RESEARCH_REPORT_JSON]로 제출. 예시 값은 채우지 말고 진짜 조사 결과로 교체하라.",
    JSON.stringify(sample,null,2),
  ].join("\n\n");
}

export function buildFinalArticlePrompt({channel,topic,notes="",report,selectedAngleId="",approvedKeys=[],today="",directions}={}) {
  if(!report)return "";
  const chosen=report.angles.find(a=>a.id===selectedAngleId);
  const checked=new Set(approvedKeys);
  const facts=report.facts.filter(f=>f.sourceUrl&&checked.has(factKey(f)));
  if(!chosen)return "";
  const relevant=facts.filter(f=>chosen.factIds.includes(f.id));
  if(!relevant.length)return "";
  return [
    "콘텐츠 메이커 AI 최종 원고 작성. 검증 가능한 자료만을 이용하라.",
    EDITORIAL_DIRECTOR_RULES,
    "[대상]", "채널: "+safe(channel,40), "주제: "+safe(topic||report.topic,600), "작성 기준일: "+safe(today,40),
    "[글의 관점]",chosen.title,
    "독자가 답을 얻어야 할 질문: "+chosen.readerQuestion,
    "이 글에서 실제로 제공할 정보: "+chosen.uniqueValue,
    "[사용자가 원문 확인 체크한 주장 - AI가 다시 원문 확인해야 함]",
    ...relevant.map((f,i)=>(i+1)+". "+f.claim+"\n원문: "+f.sourceUrl+(f.sourceTitle?"\n원문 제목: "+f.sourceTitle:"")+(f.publishedAt?"\n발표일: "+f.publishedAt:"")),
    "[운영자 메모 - 미검증, 원본 보존]",buildEvidenceHandoff({notes}),
    "[이전 조사에서 해결되지 않은 질문]",...(report.gaps.length?report.gaps.map(g=>"- "+g):["기록 없음"]),
    "[글쓰기 방향 — 운영자 설정]",
    typeof directions === "string" ? directions.trim().slice(0,12000) : DEFAULT_FINAL_ARTICLE_DIRECTIONS,
    ...(channel==="집값쓱" ? ["[집값쓱 이슈 중심 최종 원고 — 다른 문체·일반 지시보다 우선]",JIBSSUK_ISSUE_ARTICLE_RULES] : []),
    "[사실 확인과 네이버 원고 작성]",
    "확인된 주장과 원문을 다시 대조하고, 직접 확인할 수 없는 정보는 사실로 사용하지 않는다.",
    "독자가 원하는 답을 빠르게 전달한다. 필요하지 않은 목차·요약·결론은 추가하지 않는다.",
    "네이버 편집기에 붙여넣을 일반 텍스트로 작성한다. 제목을 본문에 반복하거나 불필요한 Markdown·이미지 안내를 넣지 않는다.",
    "출처와 자료 기준일이 필요하면 말미에 기록한다.",
    "[최종 출력 · 콘텐츠 메이커로 가져오기]",
    "답변은 반드시 [NAVER_FINAL_ARTICLE_JSON]과 [/NAVER_FINAL_ARTICLE_JSON] 사이에 유효한 JSON 객체 하나로 출력한다. 마크다운 코드블록이나 태그 밖 안내문은 넣지 않는다.",
    "title은 네이버 글 제목, body는 네이버에 그대로 붙여넣을 본문이다. 본문 단락 사이는 JSON 문자열에서 \\n\\n으로 구분한다. 내용은 아래 예시를 그대로 쓰지 말고 실제 검증된 원고로 채운다.",
    "[NAVER_FINAL_ARTICLE_JSON]",
    JSON.stringify({title:"검증된 내용에 맞는 실제 제목",body:"독자가 궁금한 질문의 직접적인 답.\n\n확인된 내용과 필요한 비교.\n\n출처 및 기준일(필요한 경우)."},null,2),
    "[/NAVER_FINAL_ARTICLE_JSON]",
  ].join("\n\n");
}
