import {parseResearchReport,DEFAULT_FINAL_ARTICLE_DIRECTIONS} from "./research-studio.mjs";
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

/**
 * The viewpoint sets the story's focus. Related facts can support it, but a
 * research inventory must not become the published article's table of contents.
 * These instructions are only for the inline Jibssuk flow; Paramma is unchanged.
 */
export function buildJibssukIssueArticlePrompt({topic="",notes="",report,selectedAngleId="",today=""}={}){
  if(!report||!Array.isArray(report.angles))return "";
  const chosen=report.angles.find(a=>a.id===selectedAngleId);
  if(!chosen)return "";

  const facts=(Array.isArray(report.facts)?report.facts:[])
    .filter(f=>typeof f.sourceUrl==="string"&&/^https:\/\//i.test(f.sourceUrl));
  const primary=new Set(chosen.factIds||[]);
  const core=facts.filter(f=>primary.has(f.id));
  if(!core.length)return "";

  const factById=new Map(facts.map(f=>[f.id,f]));
  const supporting=report.angles.filter(a=>a.id!==chosen.id).map(a=>{
    // Keep evidence attached to each alternative angle, but don't dump 27 facts
    // into the writer prompt just because the research was thorough.
    const unique=(a.factIds||[]).map(id=>factById.get(id))
      .filter(Boolean).filter(f=>!primary.has(f.id)).slice(0,4);
    return {title:a.title,question:a.readerQuestion,value:a.uniqueValue,facts:unique};
  }).filter(a=>a.facts.length>0);
  const assignedIds=new Set(report.angles.flatMap(a=>Array.isArray(a.factIds)?a.factIds:[]));
  const unassigned=facts.filter(f=>!assignedIds.has(f.id)).slice(0,2);

  const display=(f,i)=>[
    String(i+1)+". "+f.claim,
    "원문 후보: "+f.sourceUrl,
    f.sourceTitle?"자료명: "+f.sourceTitle:"",
    f.publishedAt?"발표일: "+f.publishedAt:"",
  ].filter(Boolean).join("\n");
  const sample={title:"실제로 확인된 사건과 의외의 발견을 담은 제목",body:"독자가 궁금해한 핵심 답.\n\n자료를 비교해 드러난 뜻밖의 차이와 필요한 맥락.\n\n출처·기준일(필요한 경우)."};

  return [
    "집값쓱 네이버 블로그 최종 원고 작성 요청. 조사 보고서를 요약하는 것이 아니라, 한 가지 화제에서 뜻밖의 사실을 발견해 자기 블로그에 기록하는 한 편의 글을 쓴다.",
    EDITORIAL_DIRECTOR_RULES,
    "[집값쓱 확정 글쓰기 기준 — 최우선 적용]",
    "핵심 콘셉트: 일기처럼 편안한 개인 블로그 말투 + 남들이 지나친 정보를 나만 발견한 듯한 재미 + 원문으로 확인되는 정확한 숫자와 사실.",
    "설명하는 기자나 강사가 아니라, 궁금한 것을 들여다보다 자료의 작은 차이를 발견한 사람이 옆에서 이야기를 건네듯 쓴다. 과장된 독점정보나 비밀 취재처럼 꾸미지는 않는다.",
    "B형의 자연스러운 일기 같은 도입과 C형의 구체적인 정보 밀도를 함께 사용한다. 일기는 문체와 흐름의 비유이지, 실제로 하지 않은 방문·취재·경험·감정·조사 행동을 1인칭으로 꾸미라는 뜻이 아니다.",
    DEFAULT_FINAL_ARTICLE_DIRECTIONS,
    "독자가 제목을 보고 궁금해한 질문에 첫 3~5줄 안에서 바로 답한다. 그 뒤 핵심 발견 한 가지를 중심으로 '무슨 일이 있었나 → 자료를 비교하면 무엇이 달랐나 → 그래서 무엇을 알게 되나'가 자연스럽게 흐르게 한다. 글에 맞지 않으면 이 순서도 강요하지 않는다.",
    "조사는 깊게, 글은 짧고 명확하게. 남들이 지나친 숫자·전후 사건·실제 다른 점 가운데 이번 글에서 기억할 만한 발견 1개(필요할 때 2개)를 뽑아 이야기를 이끈다. 부차적인 정보는 독자가 궁금해할 때만 덧붙인다.",
    "조사 내용은 원고에 전부 옮기는 목록이 아니다. 공급된 모든 동·호수·연혁·경쟁률·신청일정·옵션 내역을 항목별로 빠짐없이 쓰지 마라. 꼭 필요한 경우에만 중요한 수치 1~2개를 비교하고, 세부 내역은 목적이 명확할 때만 표나 짧은 문장으로 보인다.",
    "소제목·Q&A·결론·■ 기호·번호 매긴 항목은 기본값이 아니다. 읽는 흐름에 정말 필요할 때만 사용하고, 짧은 글이면 소제목 없이 자연스럽게 끝낸다.",
    "금지되는 빈말의 예: '살펴보면 조금 흥미로운 사실이 있습니다', '가장 눈여겨볼 부분입니다', '결국 정리하면', '신중히 판단해야 합니다'. 주장하는 글이 아니라 이야기가 이어지도록 군더더기를 지운다.",
    "억지 호기심 유발이나 감탄사·혼잣말을 매번 넣지 마라. 하지만 실제 자료에서 나온 의문과 작은 놀라움을 자연스럽게 표현하는 건 괜찮다. 평서문만 연속한 보도자료 문체도 피한다.",
    "길이를 채우려 하지 않는다. 제목이 약속한 발견과 필요한 사실을 전달했으면 멈춘다. 네이버 모바일에서 문단은 짧되 모든 문장을 한 줄씩 떼어놓지 않는다.",
    "[이번 글의 중심]",
    "주제: "+String(topic||report.topic).slice(0,600),
    "글의 핵심 관점: "+chosen.title,
    "독자가 가장 알고 싶은 질문: "+chosen.readerQuestion,
    "발견 후보(검증 전): "+chosen.uniqueValue,
    "기준일: "+String(today).slice(0,40),
    "[사용자가 전달한 메모 — 원문 확인 전]",
    buildEvidenceHandoff({notes}),
    "[이번 이야기를 뒷받침할 핵심 근거 후보 — 사용자가 확인했다고 가정 금지]",
    ...core.map(display),
    "[관련 내용 — 필요하면 일부만 선택, 기사에 모두 넣지 말 것]",
    ...(supporting.length?supporting.flatMap(a=>[
      "다른 관점: "+a.title,
      "추가 발견 후보(미검증): "+a.value,
      ...a.facts.map(display),
    ]):["관련 보조 근거 없음"]),
    ...(unassigned.length?["[관점에 분류되지 않은 보조 사실 — 필요한 경우만] ",...unassigned.map(display)]:[]),
    "[확인되지 않은 사항 — 관련 있는 내용만 반영]",
    ...(Array.isArray(report.gaps)&&report.gaps.length?report.gaps.slice(0,7).map(g=>"- "+g):["기록 없음"]),
    "[사실 검증 — 글쓰기보다 우선]",
    "AI 보고서에 원문 링크가 있어도 검증이 끝난 것은 아니다. 기사·공식 공고를 실제 열어 사실과 날짜를 다시 확인해라. 숫자도 대조했을 때만 사실로 써라. 웹을 확인할 수 없다면 확인했다고 주장하지 마라. 핵심 사실을 검증하지 못하면 글을 꾸며 완성하지 말고 무엇이 필요한지 밝혀라.",
    "서로 다른 시기의 사건이나 공급 물량을 동일한 것으로 단정하지 마라. 시세차익을 확정 수익으로 표현하지 말고, 검색량 상승은 실측 근거가 없으면 쓰지 마라.",
    "인근 단지 실거래나 분양가 차이, 청약 자격·일정은 선택한 이야기와 직접 이어질 때만 간결하게 포함하고, 모든 항목을 완비하려고 하지 마라. 정확한 금액·날짜가 핵심이라면 빠뜨리지 않는다.",
    "[출력 전 스스로 검사 — 검사 과정은 출력하지 말 것]",
    "읽어보며 다음을 판단하라: (1) 기사를 줄여 쓴 뉴스 요약 같지 않은가? (2) 일기 같은 개인의 목소리와 '나만 발견한 정보'의 재미가 살아 있는가? (3) 가장 중요한 차이를 글 한가운데 두었는가? (4) 조사 목록을 복사하거나 '흥미롭다' 같은 빈말을 쓰지 않았는가? (5) 근거 없는 1인칭 행동·감정·사실을 만들어내지 않았는가? 어긋나면 출력 전에 다시 다듬어라.",
    "[복사 및 사이트 가져오기 형식]",
    "작성할 수 있다면 아래 태그 사이에 유효한 JSON 객체 하나를 넣어라. 태그까지 포함한 답변 전체를 하나의 텍스트 코드블록으로 감싸서 출력해 ChatGPT의 '코드 복사'로 복사할 수 있게 하라. 코드블록 밖 설명은 쓰지 마라. 본문 단락은 JSON 문자열에서 \\n\\n으로 구분한다.",
    "핵심 원문을 확인할 수 없어 원고 작성이 불가능하면 검증된 척하지 말고 확인에 필요한 자료를 요청하라.",
    String.fromCharCode(96).repeat(3)+"text",
    "[NAVER_FINAL_ARTICLE_JSON]",
    JSON.stringify(sample,null,2),
    "[/NAVER_FINAL_ARTICLE_JSON]",
    String.fromCharCode(96).repeat(3)
  ].join("\n\n");
}
