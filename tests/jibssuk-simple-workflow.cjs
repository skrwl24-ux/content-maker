const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
async function api(){return import("../lib/jibssuk-simple-workflow.mjs");}
const example={
  topic:"과천 디에트르 퍼스티지 2가구 재공급",
  checkedAt:"2026-10-30",summary:"2가구 재공급, 원문 확인 필요",
  facts:[
    {id:"f1",claim:"재공급 사유는 계약 취소",sourceUrl:"https://example.org/press",sourceTitle:"기사 1",publishedAt:"2026-10-29"},
    {id:"f2",claim:"옵션 포함 가격은 별도 확인",sourceUrl:"https://example.org/price",sourceTitle:"기사 2",publishedAt:"2026-10-28"},
    {id:"f3",claim:"청약 접수일",sourceUrl:"https://example.org/apply",sourceTitle:"공고",publishedAt:"2026-10-28"},
    {id:"f4",claim:"출처 없는 주장",sourceUrl:"javascript:alert(1)",sourceTitle:"없음",publishedAt:""},
  ],
  angles:[
    {id:"a1",title:"왜 다시 나왔나?",readerQuestion:"계약 취소일까?",uniqueValue:"재공급 경과",factIds:["f1"]},
    {id:"a2",title:"얼마인가?",readerQuestion:"실제 금액?",uniqueValue:"옵션 금액",factIds:["f2"]},
  ],gaps:["정확한 계약취소 사유는 미확인"],trendLinks:[]
};
test("rich-text copying artifacts from ChatGPT are cleaned without inventing source validation",async()=>{
  const {parseJibssukCopiedReport}=await api();
  const inner=JSON.stringify(example,null,2)
    .replace(/^  /gm,"&#x20;&#x20;")
    .replace(/https:\/\//g,"https\\://").replace(/\.org/g,"\\.org");
  const text="[RESEARCH_REPORT_JSON]\\\n"+inner.split("\n").map(line=>line+"\\").join("\n")+"\n[/RESEARCH_REPORT_JSON]";
  const normalized=parseJibssukCopiedReport(text);
  assert.ok(normalized);
  assert.equal(normalized.report.topic,example.topic);
  assert.equal(normalized.report.facts.length,4);
  assert.equal(normalized.report.facts[0].sourceUrl,"https://example.org/press");
  assert.equal(normalized.report.facts[3].sourceUrl,"");
  assert.ok(parseJibssukCopiedReport("[RESEARCH_REPORT_JSON]\n"+JSON.stringify(example)+"\n[/RESEARCH_REPORT_JSON]"));
  const ticks=String.fromCharCode(96).repeat(3);
  assert.ok(parseJibssukCopiedReport(ticks+"text\n[RESEARCH_REPORT_JSON]\n"+JSON.stringify(example)+"\n[/RESEARCH_REPORT_JSON]\n"+ticks));
  assert.equal(parseJibssukCopiedReport("검증되지 않은 일반 텍스트"),null);
});
test("final prompt keeps selected issue as focus but may use other sourced and relevant facts",async()=>{
  const {parseJibssukCopiedReport,buildJibssukIssueArticlePrompt}=await api();
  const report=parseJibssukCopiedReport(JSON.stringify(example)).report;
  const prompt=buildJibssukIssueArticlePrompt({topic:example.topic,report,selectedAngleId:"a1",today:"2026-10-30"});
  assert.match(prompt,/글의 핵심 관점: 왜 다시 나왔나/);
  assert.match(prompt,/재공급 사유는 계약 취소/);
  assert.match(prompt,/옵션 포함 가격은 별도 확인/);
  assert.match(prompt,/청약 접수일/);
  assert.match(prompt,/사용자가 확인했다고 가정 금지/);
  assert.match(prompt,/원문 후보/);
  assert.match(prompt,/실제 열어 사실과 날짜를 다시 확인/);
  assert.match(prompt,/NAVER_FINAL_ARTICLE_JSON/);
  assert.doesNotMatch(prompt,/javascript:alert/);
  assert.doesNotMatch(prompt,/출처 없는 주장/);
  assert.equal(buildJibssukIssueArticlePrompt({topic:example.topic,report,selectedAngleId:"invalid"}),"");
});
