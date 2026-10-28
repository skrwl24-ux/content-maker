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
  assert.match(p,/실질적 관련성이 없는/);
  assert.match(p,/비공개 주거지/);
  assert.match(p,/원고는 아직 쓰지 말고/);
  assert.match(p,/https:\/\/example.org\/press/);
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

test("research studio is reachable from homepage and preserves draft in browser storage",()=>{
  const home=fs.readFileSync("app/page.tsx","utf8");
  const page=fs.readFileSync("app/research-studio/page.tsx","utf8");
  assert.match(home,/href="\/research-studio"/);
  assert.match(page,/localStorage.setItem/);
  assert.match(page,/원문 대조 완료/);
  assert.match(page,/조사 보고서 불러오기/);
  assert.match(page,/재조사 요청서 복사/);
  assert.match(page,/buildFinalArticlePrompt/);
  assert.match(page,/function changeTopic/);
});
