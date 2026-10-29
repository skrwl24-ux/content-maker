import {parseResearchReport} from "./research-studio.mjs";
import {EDITORIAL_DIRECTOR_RULES,buildEvidenceHandoff} from "./editorial-director.mjs";

/** Decode only copy/presentation escaping. A parsed report is not verified. */
export function normalizeJibssukCopiedReport(raw){
  if(typeof raw!=="string"||raw.length>240000)return "";
  let content=raw.trim().replace(/\r\n?/g,"\n");
  content=content.replace(/\\[ \t]*(?=\n|$)/gm,"");
  content=content.replace(/&#x20;|&#32;|&nbsp;/gi," ")
    .replace(/&quot;|&#34;/gi,'"').replace(/&amp;/gi,"&")
    .replace(/&#x0?a;|&#10;/gi,"\n");
  content=content.replace(/\\([:/.~])/g,"$1");
  const tagged=content.match(/\[RESEARCH_REPORT_JSON\]([\s\S]*?)\[\/RESEARCH_REPORT_JSON\]/i);
  if(tagged)return tagged[1].trim();
  const fenced=content.match(/^\x60{3}(?:json|text)?\s*\n([\s\S]*?)\n\x60{3}\s*$/i);
  return fenced?fenced[1].trim():content;
}
export function parseJibssukCopiedReport(raw){
  const prepared=normalizeJibssukCopiedReport(raw);
  const report=parseResearchReport(prepared);
  return report?{report,stored:JSON.stringify(report)}:null;
}

/** The selected angle guides the article, not which otherwise relevant facts survive. */
export function buildJibssukIssueArticlePrompt({topic="",notes="",report,selectedAngleId="",today=""}={}){
  if(!report||!Array.isArray(report.angles))return "";
  const chosen=report.angles.find(a=>a.id===selectedAngleId);
  if(!chosen)return "";
  const facts=(Array.isArray(report.facts)?report.facts:[])
    .filter(f=>typeof f.sourceUrl==="string"&&/^https:\/\//i.test(f.sourceUrl));
  if(!facts.length)return "";
  const primary=new Set(chosen.factIds||[]);
  const core=facts.filter(f=>primary.has(f.id));
  const other=facts.filter(f=>!primary.has(f.id));
  if(!core.length)return "";
  const display=(f,i)=>[
    String(i+1)+". "+f.claim,
    "원문 후보: "+f.sourceUrl,
    f.sourceTitle?"제목: "+f.sourceTitle:"",
    f.publishedAt?"발표일: "+f.publishedAt:"",
  ].filter(Boolean).join("\n");
  const sample={title:"실제로 확인된 사건을 드러낸 제목",body:"확인된 최근 이슈에 대한 직접적인 답.\n\n관련 있는 구체적 내용.\n\n원문 출처·기준일(필요한 경우)."};
  return [
    "집값쓱 네이버 블로그 최종 원고 제작. 최근 이슈에 관한 자료를 재검증하고 짧고 명확한 글을 작성하라.",
    EDITORIAL_DIRECTOR_RULES,
    "[글의 중심]","대상 글감: "+String(topic||report.topic).slice(0,600),
    "글의 핵심 관점: "+chosen.title,
    "독자가 알고 싶은 것: "+chosen.readerQuestion,
    "이번 글에서 보여줄 발견: "+chosen.uniqueValue,
    "조사 기준일: "+String(today).slice(0,40),
    "[사용자가 전달한 메모 — 원문 확인 전]",buildEvidenceHandoff({notes}),
    "[AI 조사보고서의 핵심 근거 후보 — 사용자가 확인했다고 가정 금지]",
    ...core.map(display),
    "[나머지 근거 후보 — 이슈 이해에 필요한 것만 골라 사용, 전부 넣지 말 것]",
    ...(other.length?other.map(display):["추가 후보 없음"]),
    "[미해결 문제 — 확인 전에는 원고 사실로 사용 금지]",
    ...(Array.isArray(report.gaps)&&report.gaps.length?report.gaps.map(v=>"- "+v):["추가 기록 없음"]),
    "[원고 작성 고정 기준]",
    "1. AI 보고서에 출처 URL이 있다는 이유만으로 사실 검증이 끝난 것은 아니다. 최신 공식 공고·원문 기사·1차 자료를 실제 열어 사실과 날짜를 다시 확인해라. 검색·원문 확인이 불가능하고 핵심 사실의 검증이 어려우면 최종 글을 지어내지 말고 필요한 자료를 밝혀라.",
    "2. 선택한 관점을 글의 중심에 두되, 다른 관점에 속한 가격·청약 조건·일정·배경 등 독자가 함께 궁금해할 관련 사실을 골라서 포함하라. 무관한 자료나 모든 조사 숫자를 억지로 넣지 마라.",
    "3. 제목에 약속한 정보는 첫 문단에서 알려줘라. B형의 자연스러운 도입과 C형의 구체적인 정보 밀도를 갖추되 고정 목차·의례적 마무리를 사용하지 마라.",
    "4. 조사는 깊게, 글은 짧고 명확하게. 억지 질문·혼잣말·뻔한 주의사항·훈계·반복 요약·허위 인용·근거 없는 가격 원인을 만들지 마라.",
    "5. 검색량 급증·시세차익 확정을 증명 없이 단정하지 마라. 기사 보도일·사건 발생일을 구분하고, 과거 분양 물량을 이번 물량으로 혼동하지 마라.",
    "6. 실거래 자료는 주제에 직접 필요할 때만 정확한 계약일·면적·층·기간 기준으로 비교하고, 확인되지 않은 숫자는 빼라.",
    "7. 원본 조사 JSON과 제작 지시문을 네이버 본문에 설명하지 마라.",
    "[복사·가져오기 형식]",
    "원고 작성이 가능하면 아래 태그 사이에 유효한 JSON 객체 하나를 넣어라. 태그까지 포함한 답변 전체를 하나의 텍스트 코드블록으로 감싸서 표시하라. 코드블록 밖 설명은 쓰지 마라. 본문 단락 구분은 JSON 문자열에서 \\n\\n을 사용한다.",
    "원문을 검증하기 어려워 원고 작성이 불가능하다면 확인에 필요한 자료를 밝혀라. 확인되지 않은 정보를 검증된 완성 기사처럼 쓰지 마라.",
    "\u0060\u0060\u0060text",
    "[NAVER_FINAL_ARTICLE_JSON]",
    JSON.stringify(sample,null,2),
    "[/NAVER_FINAL_ARTICLE_JSON]",
    "\u0060\u0060\u0060"
  ].join("\n\n");
}
