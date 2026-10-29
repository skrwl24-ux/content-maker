const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

async function studio() {return import("../lib/research-studio.mjs");}

const reportText=JSON.stringify({
  topic:"가상 드라마 촬영 공간",
  checkedAt:"2026-10-28",
  summary:"공식 원문에서 장소를 확인해야 합니다.",
  facts:[
    {id:"f1",claim:"공식 자료에 공개된 촬영 공간",sourceUrl:"https://example.org/press",sourceTitle:"제작사 발표",publishedAt:"2026-10-27"},
    {id:"f2",claim:"한 배우가 여기 산다는 소문",sourceUrl:"javascript:alert(1)",sourceTitle:"게시물",publishedAt:""},
  ],
  angles:[
    {id:"a1",title:"드라마 속 공간은 어디?",readerQuestion:"실제 장소인가?",uniqueValue:"공식 촬영 자료 대조",factIds:["f1","f2"]},
  ],
  gaps:["실제 거주 여부는 확인할 수 없음"],
  trendLinks:[{subject:"배우",connection:"드라마에 출연",sourceUrl:"https://example.org/show",status:"확인 필요"}],
});

test("deep research prompt requests a structured report and does not write a premature article",async()=>{
  const {buildDeepResearchPrompt}=await studio();
  const p=buildDeepResearchPrompt({channel:"집값쓱",topic:"드라마 나온 아파트",notes:"https://example.org/press",today:"2026-10-28"});
  assert.match(p,/RESEARCH_REPORT_JSON/);
  assert.match(p,/2026-10-28/);
  assert.match(p,/드라마 나온 아파트/);
  assert.match(p,/놓치기 쉬운 사건/);
  assert.match(p,/공식 원문/);
  assert.match(p,/원고는 아직 쓰지 말고/);
  assert.match(p,/https:\/\/example.org\/press/);
});

test("custom research direction takes effect without changing metadata or report JSON",async()=>{
  const {buildDeepResearchPrompt,DEFAULT_DEEP_RESEARCH_DIRECTIONS}=await studio();
  assert.match(DEFAULT_DEEP_RESEARCH_DIRECTIONS,/예상 밖의 차이/);
  const prompt=buildDeepResearchPrompt({channel:"집값쓱",topic:"위례선 트램",today:"2026-10-29",directions:"내가 정한 조사 방향: 교통안전심의 기록 추적"});
  assert.match(prompt,/교통안전심의 기록 추적/);
  assert.doesNotMatch(prompt,/독자가 가장 궁금해할 질문을 먼저 생각하고/);
  assert.match(prompt,/RESEARCH_REPORT_JSON/);
  assert.match(prompt,/위례선 트램/);
});

test("report parser accepts tagged JSON and rejects unsafe URLs and invalid JSON",async()=>{
  const {parseResearchReport}=await studio();
  const r=parseResearchReport("[RESEARCH_REPORT_JSON]\n"+reportText+"\n[/RESEARCH_REPORT_JSON]");
  assert.equal(r.topic,"가상 드라마 촬영 공간");
  assert.equal(r.facts.length,2);
  assert.equal(r.facts[0].sourceUrl,"https://example.org/press");
  assert.equal(r.facts[1].sourceUrl,"");
  assert.equal(r.angles[0].factIds.length,2);
  assert.equal(r.gaps.length,1);
  assert.equal(r.trendLinks[0].sourceUrl,"https://example.org/show");
  assert.equal(parseResearchReport('{"topic":"missing all"}'),null);
  assert.equal(parseResearchReport("not json"),null);
});

test("final article prompt stays blocked until user source verification and selected angle",async()=>{
  const {parseResearchReport,buildFinalArticlePrompt,factKey}=await studio();
  const report=parseResearchReport(reportText);
  const opts={channel:"집값쓱",topic:"드라마 촬영지",report,selectedAngleId:"a1",notes:"추가 메모",today:"2026-10-28"};
  assert.equal(buildFinalArticlePrompt(opts),"");
  const valid=buildFinalArticlePrompt({...opts,approvedKeys:[factKey(report.facts[0])]});
  assert.match(valid,/https:\/\/example.org\/press/);
  assert.match(valid,/독자가 답을 얻어야 할 질문/);
  assert.match(valid,/다시 원문 확인/);
  assert.doesNotMatch(valid,/한 배우가 여기 산다는 소문/);
  assert.doesNotMatch(valid,/javascript:alert/);
  assert.equal(buildFinalArticlePrompt({...opts,approvedKeys:[factKey(report.facts[1])]}),"");
});

test("followup prompt carries gaps and unconfirmed claims",async()=>{
  const {parseResearchReport,buildFollowupResearchPrompt}=await studio();
  const report=parseResearchReport(reportText);
  const prompt=buildFollowupResearchPrompt({channel:"Paramma",topic:"방송 속 장소",report,today:"2026-10-28"});
  assert.match(prompt,/실제 거주 여부/);
  assert.match(prompt,/한 배우가 여기 산다는 소문/);
  assert.match(prompt,/전체 보고서/);
});

test("research studio is reachable from homepage and has five independent saved workspaces",()=>{
  const home=fs.readFileSync("app/page.tsx","utf8");
  const page=fs.readFileSync("app/research-studio/page.tsx","utf8");
  const queue=fs.readFileSync("app/research-studio/ResearchQueue.tsx","utf8");
  const panel=fs.readFileSync("app/research-studio/ResearchWorkPanel.tsx","utf8");
  assert.match(home,/href="\/research-studio"/);
  assert.match(page,/ResearchQueue/);
  assert.match(queue,/parseResearchBatchTopics/);
  assert.match(queue,/slotId=\{active\}/);
  assert.match(queue,/5개 전체 백업/);
  assert.match(queue,/setEpoch/);
  assert.match(panel,/localStorage.setItem/);
  assert.match(panel,/원문 대조 완료/);
  assert.match(panel,/조사 보고서 불러오기/);
  assert.match(panel,/재조사 요청서 복사/);
  assert.match(panel,/buildFinalArticlePrompt/);
  assert.match(panel,/function changeTopic/);
});


test("naver final article parser handles tagged JSON, plain text and invalid research reports",async()=>{
  const {parseNaverFinalArticle}=await studio();
  const result=parseNaverFinalArticle('[NAVER_FINAL_ARTICLE_JSON]\n'+JSON.stringify({title:"독자 질문",body:"첫 문단\n\n둘째 문단"})+'\n[/NAVER_FINAL_ARTICLE_JSON]');
  assert.deepEqual(result,{title:"독자 질문",body:"첫 문단\n\n둘째 문단"});
  assert.deepEqual(parseNaverFinalArticle("본문 하나\n\n본문 둘"),{title:"",body:"본문 하나\n\n본문 둘"});
  assert.equal(parseNaverFinalArticle("[NAVER_FINAL_ARTICLE_JSON]{}"),null);
  assert.equal(parseNaverFinalArticle("[RESEARCH_REPORT_JSON]{}[/RESEARCH_REPORT_JSON]"),null);
  assert.equal(parseNaverFinalArticle('{"title":"missing body"}'),null);
});

test("final prompt includes importable naver article tags and panel supports independent backups",async()=>{
  const {parseResearchReport,buildFinalArticlePrompt,factKey}=await studio();
  const report=parseResearchReport(reportText);
  const prompt=buildFinalArticlePrompt({channel:"집값쓱",topic:"드라마 촬영지",report,selectedAngleId:"a1",approvedKeys:[factKey(report.facts[0])]});
  assert.match(prompt,/NAVER_FINAL_ARTICLE_JSON/);
  assert.match(prompt,/title은 네이버 글 제목/);
  const panel=fs.readFileSync("app/research-studio/ResearchWorkPanel.tsx","utf8");
  const queue=fs.readFileSync("app/research-studio/ResearchQueue.tsx","utf8");
  assert.match(panel,/네이버 최종 원고 붙여넣기/);
  assert.match(panel,/본문 복사/);
  assert.match(panel,/finalRaw,finalTitle,finalBody/);
  assert.match(queue,/slot.finalBody=/);
});


test("custom final writing tone remains grounded in approved evidence and the import schema",async()=>{
  const {parseResearchReport,buildFinalArticlePrompt,buildFollowupResearchPrompt,factKey,DEFAULT_FINAL_ARTICLE_DIRECTIONS}=await studio();
  assert.match(DEFAULT_FINAL_ARTICLE_DIRECTIONS,/혼잣말하듯/);
  const report=parseResearchReport(reportText);
  const opts={channel:"집값쓱",topic:"드라마 촬영지",report,selectedAngleId:"a1",approvedKeys:[factKey(report.facts[0])],directions:"혼자 중얼거리듯 핵심 발견 한 가지부터."};
  const final=buildFinalArticlePrompt(opts);
  assert.match(final,/혼자 중얼거리듯/);
  assert.doesNotMatch(final,/자료를 읽으며 남들이 지나치기 쉬운 사실/);
  assert.match(final,/NAVER_FINAL_ARTICLE_JSON/);
  assert.match(final,/https:\/\/example\.org\/press/);
  assert.doesNotMatch(final,/javascript:alert/);
  const followup=buildFollowupResearchPrompt({...opts,directions:"추적 조사 설정"});
  assert.match(followup,/추적 조사 설정/);
});

test("research studio edits and saves two independent directions across all five slots",()=>{
  const panel=fs.readFileSync("app/research-studio/ResearchWorkPanel.tsx","utf8");
  assert.match(panel,/setDeepDirections\(e.target.value\)/);
  assert.match(panel,/setFinalDirections\(e.target.value\)/);
  assert.match(panel,/localStorage.setItem\(DEEP_DIRECTIONS_KEY,deepDirections\)/);
  assert.match(panel,/localStorage.setItem\(FINAL_DIRECTIONS_KEY,finalDirections\)/);
  assert.match(panel,/심층 조사 요청서 직접 수정하기/);
  assert.match(panel,/최종 원고 글쓰기 스타일 직접 수정하기/);
  assert.match(panel,/기본 문구 복원/);
  assert.match(panel,/전체 최종 원고 요청서 보기/);
});


test("Jibssuk research follows the verified news event, without forcing real-estate prices or popularity claims",async()=>{
  const {buildDeepResearchPrompt,parseResearchReport,buildFollowupResearchPrompt}=await studio();
  const prompt=buildDeepResearchPrompt({channel:"집값쓱",topic:"OO단지 살기 좋은 아파트 수상 소식",directions:"임의로 저장된 과거 조사 스타일"});
  assert.match(prompt,/선택된 주제의 출발점은 최근 뉴스·방송·사건·수상·분양/);
  assert.match(prompt,/왜 지금 이 아파트가 뉴스에 나왔는지/);
  assert.match(prompt,/공식 수상 발표|선정 근거/);
  assert.match(prompt,/실거래 비교를 억지로 붙이지 마라/);
  assert.match(prompt,/검색량 상승·인기 폭증을 입증할 자료가 없으면 주장하지 마라/);
  assert.match(prompt,/임의로 저장된 과거 조사 스타일/);
  assert.match(prompt,/RESEARCH_REPORT_JSON/);
  const report=parseResearchReport(reportText);
  const follow=buildFollowupResearchPrompt({channel:"집값쓱",topic:"드라마 나온 아파트",report,directions:"보존할 개인 설정"});
  assert.match(follow,/집값쓱 이슈 중심 추가 조사/);
  assert.match(follow,/보존할 개인 설정/);
  assert.match(follow,/전체 보고서를 다시 작성하라/);
});

test("Jibssuk final writing is concise, issue-led, and grounded, including for legacy custom prose",async()=>{
  const {parseResearchReport,buildFinalArticlePrompt,factKey,buildDeepResearchPrompt}=await studio();
  const report=parseResearchReport(reportText);
  const prompt=buildFinalArticlePrompt({
    channel:"집값쓱",topic:"드라마 나온 아파트",
    report,selectedAngleId:"a1",approvedKeys:[factKey(report.facts[0])],
    directions:"예전에 저장한 지시문: 혼잣말을 길게 써라",
  });
  assert.match(prompt,/집값쓱 이슈 중심 최종 원고/);
  assert.match(prompt,/조사는 깊게, 글은 짧고 명확하게/);
  assert.match(prompt,/사건·수상·분양·방송·지역 변화/);
  assert.match(prompt,/B형 도입과 C형 정보 밀도/);
  assert.match(prompt,/억지 반전·호기심 질문·감탄·혼잣말/);
  assert.match(prompt,/가격과 비교표를 형식적으로 추가하지 않는다/);
  assert.match(prompt,/최근 1년 동안 상승세가 이어졌다/);
  assert.match(prompt,/예전에 저장한 지시문/);
  assert.match(prompt,/NAVER_FINAL_ARTICLE_JSON/);
  assert.doesNotMatch(prompt,/javascript:alert/);
  const other=buildDeepResearchPrompt({channel:"Paramma",topic:"생활 소식"});
  assert.doesNotMatch(other,/집값쓱 이슈 중심 심층 조사/);
  const otherFinal=buildFinalArticlePrompt({channel:"Paramma",topic:"생활 소식",report,selectedAngleId:"a1",approvedKeys:[factKey(report.facts[0])]});
  assert.doesNotMatch(otherFinal,/집값쓱 이슈 중심 최종 원고/);
});

test("Jibssuk guidance is visible without overwriting existing saved directions or schemas",()=>{
  const panel=fs.readFileSync("app/research-studio/ResearchWorkPanel.tsx","utf8");
  assert.match(panel,/해당 아파트가 화제가 됐는지 확인하고/);
  assert.match(panel,/이전에 저장한 문체 설정보다 우선/);
  assert.match(panel,/localStorage.setItem\(DEEP_DIRECTIONS_KEY,deepDirections\)/);
  assert.match(panel,/localStorage.setItem\(FINAL_DIRECTIONS_KEY,finalDirections\)/);
});
