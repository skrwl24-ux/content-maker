import { EDITORIAL_DIRECTOR_RULES, buildEvidenceHandoff } from "./editorial-director.mjs";

const safe = (v, n=1800) => typeof v==="string" ? v.trim().slice(0,n) : "";
const list = (v, n=12) => Array.isArray(v) ? v.slice(0,n) : [];
const id = (v,fallback) => /^[a-z0-9_-]{1,36}$/i.test(v||"") ? v : fallback;
const validUrl = (v) => {
  const str=safe(v,600);
  try { const u=new URL(str); return u.protocol==="https:" && !u.username && !u.password ? str : ""; }
  catch { return ""; }
};
const sample={topic:"조사 주제",checkedAt:"YYYY-MM-DD",summary:"현재 알 수 있는 사실과 한계",facts:[{id:"f1",claim:"원문에서 확인한 단일 사실",sourceUrl:"",sourceTitle:"원문 제목",publishedAt:"YYYY-MM-DD"}],angles:[{id:"a1",title:"글감 제목",readerQuestion:"독자가 궁금한 것",uniqueValue:"독자에게 새롭게 제공할 정보",factIds:["f1"]}],gaps:["추가로 확인할 질문"],trendLinks:[{subject:"방송·인물·영화·장소",connection:"실제 관련성",sourceUrl:"",status:"확인 필요"}]};

export function buildDeepResearchPrompt({channel="기타",topic="",notes="",today=""}={}) {
  return [
    "콘텐츠 메이커 AI 심층 조사. 원고는 아직 쓰지 말고 조사 결과만 제출한다.",
    EDITORIAL_DIRECTOR_RULES,
    "[작업]", "발행 채널: "+safe(channel,40), "주제: "+safe(topic,600), "기준일: "+safe(today,40),
    buildEvidenceHandoff({notes}),
    "[검색 진행]",
    "1. 검색 도구가 있을 때 실제 웹 검색을 수행한다. 사용할 수 없을 때는 검색했다고 주장하지 않는다.",
    "2. 주제명과 동의어부터 공식 원문·지역·회사·사건·출연자·방송·예능·드라마·영화·촬영 장소·해외 원문으로 조사 범위를 확장한다. 실질적 관련성이 없는 화제는 연결하지 않는다.",
    "3. 유용한 단서를 발견하면 후속 검색을 수행한다. 같은 기사를 옮겨 쓴 페이지로 교차 검증했다고 주장하지 않는다.",
    "4. 공식 발표일·사건 발생일·원문 작성일·검색 확인일을 구분한다. 제목만 보지 말고 원문을 열어 확인한다.",
    "5. TV에 나온 공간/실제 촬영지/출연자의 공개 발언/실제 거주 여부를 혼동하지 않는다. 유명인의 비공개 주거지를 찾지 않는다.",
    "6. 독자가 궁금해할 질문과 AI의 일반적 답변보다 더 제공할 수 있는 가치를 찾는다. 억지로 글감 3개를 채우지 않아도 된다.",
    "7. 근거가 없는 숫자·인용·사실·URL은 절대로 만들어내지 않는다. 확인 불가한 부분은 gaps에 남긴다.",
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

export function buildFollowupResearchPrompt({channel,topic,notes="",report,approvedKeys=[],today=""}={}) {
  if(!report)return "";
  const confirmed=new Set(approvedKeys);
  const remaining=report.facts.filter(f=>!confirmed.has(factKey(f)));
  return [
    "콘텐츠 메이커 AI 추가 조사: 다음 정보에서 빠진 원문과 연결 근거를 찾아라.",
    EDITORIAL_DIRECTOR_RULES,
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

export function buildFinalArticlePrompt({channel,topic,notes="",report,selectedAngleId="",approvedKeys=[],today=""}={}) {
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
    "[집필 지시]",
    "1. 링크를 실제 열어 사실이 맞는지 재확인한다. 열 수 없으면 그 정보를 확인된 사실처럼 쓰지 말고 필요한 원문을 요청한다.",
    "2. 원문에 없는 관련 인물·드라마·영화·촬영지·숫자·인과관계나 개인정보를 창작하지 않는다.",
    "3. 클릭한 독자가 원하는 답을 먼저 준다. 글이 짧아도 충분하면 끝낸다.",
    "4. 고정 목차·이미지 수·FAQ·3줄 요약이나 억지 결론을 만들지 않는다.",
    "5. 사실과 의견, 확인된 사건일과 발표일을 구분한다. 직접 확인되지 않은 주장은 억지로 넣지 않는다.",
    "6. 본문은 네이버 편집기에 붙여넣을 수 있는 일반 텍스트로 쓴다. 제목을 본문에 반복하지 말고, 불필요한 Markdown 기호나 임의 이미지 삽입을 피한다.",
    "7. 출처와 자료 기준일이 필요하면 본문 말미에 넣되, 확인하지 않은 URL과 날짜를 만들지 않는다.",
    "[최종 출력 · 콘텐츠 메이커로 가져오기]",
    "답변은 반드시 [NAVER_FINAL_ARTICLE_JSON]과 [/NAVER_FINAL_ARTICLE_JSON] 사이에 유효한 JSON 객체 하나로 출력한다. 마크다운 코드블록이나 태그 밖 안내문은 넣지 않는다.",
    "title은 네이버 글 제목, body는 네이버에 그대로 붙여넣을 본문이다. 본문 단락 사이는 JSON 문자열에서 \\n\\n으로 구분한다. 내용은 아래 예시를 그대로 쓰지 말고 실제 검증된 원고로 채운다.",
    "[NAVER_FINAL_ARTICLE_JSON]",
    JSON.stringify({title:"검증된 내용에 맞는 실제 제목",body:"독자가 궁금한 질문의 직접적인 답.\\n\\n확인된 내용과 필요한 비교.\\n\\n출처 및 기준일(필요한 경우)."},null,2),
    "[/NAVER_FINAL_ARTICLE_JSON]",
  ].join("\n\n");
}
