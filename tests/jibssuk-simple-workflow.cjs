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


test("Jibssuk final writer includes the agreed diary-style discovery voice, not just factual summary rules",async()=>{
  const {parseJibssukCopiedReport,buildJibssukIssueArticlePrompt}=await api();
  const report=parseJibssukCopiedReport(JSON.stringify(example)).report;
  const prompt=buildJibssukIssueArticlePrompt({topic:example.topic,report,selectedAngleId:"a1",today:"2026-10-30"});
  assert.match(prompt,/일기처럼 편안한 개인 블로그 말투/);
  assert.match(prompt,/남들이 지나친 정보를 나만 발견한 듯한 재미/);
  assert.match(prompt,/B형의 자연스러운 일기 같은 도입과 C형의 구체적인 정보 밀도/);
  assert.match(prompt,/자료를 읽으며 남들이 지나치기 쉬운 사실을 발견한 사람이/);
  assert.match(prompt,/뉴스를 정리하거나 강의하는 말투보다/);
  assert.match(prompt,/■ 기호/);
  assert.match(prompt,/실제로 하지 않은 방문·취재·경험·감정/);
  assert.match(prompt,/독점정보나 비밀 취재처럼 꾸미지는 않는다/);
  assert.match(prompt,/출력 전에 다시 다듬어라/);
  assert.match(prompt,/조사는 깊게, 글은 짧고 명확하게/);
});

test("Jibssuk selects one discovery and caps secondary evidence instead of dumping 27 facts",async()=>{
  const {parseJibssukCopiedReport,buildJibssukIssueArticlePrompt}=await api();
  const facts=Array.from({length:27},(_,i)=>({
    id:"f"+(i+1),claim:"원문에서 확인할 주장 고유항목-"+(i+1),
    sourceUrl:"https://example.org/f"+(i+1),sourceTitle:"원문"+(i+1),publishedAt:"2026-10-29"
  }));
  const angles=[
    {id:"a1",title:"다시 공급된 이유",readerQuestion:"다시 나온 이유?",uniqueValue:"두 날짜의 동호수가 다름",factIds:facts.slice(0,7).map(f=>f.id)},
    {id:"a2",title:"실제 돈은 얼마인가",readerQuestion:"옵션 포함 금액?",uniqueValue:"선택품목까지 계산하면 금액이 달라짐",factIds:facts.slice(7,17).map(f=>f.id)},
    {id:"a3",title:"청약할 수 있나",readerQuestion:"접수 조건?",uniqueValue:"무주택세대주 및 접수일",factIds:facts.slice(17,27).map(f=>f.id)}
  ];
  const report=parseJibssukCopiedReport(JSON.stringify({topic:example.topic,checkedAt:"2026-10-30",facts,angles,gaps:[],trendLinks:[]})).report;
  const prompt=buildJibssukIssueArticlePrompt({topic:example.topic,report,selectedAngleId:"a1",today:"2026-10-30"});
  assert.match(prompt,/원문에서 확인할 주장 고유항목-7\b/);
  assert.match(prompt,/원문에서 확인할 주장 고유항목-8\b/);
  assert.match(prompt,/원문에서 확인할 주장 고유항목-11\b/);
  assert.match(prompt,/원문에서 확인할 주장 고유항목-18\b/);
  assert.match(prompt,/원문에서 확인할 주장 고유항목-21\b/);
  assert.doesNotMatch(prompt,/원문에서 확인할 주장 고유항목-12\b/);
  assert.doesNotMatch(prompt,/원문에서 확인할 주장 고유항목-22\b/);
  assert.match(prompt,/조사 내용은 원고에 전부 옮기는 목록이 아니다/);
  assert.match(prompt,/발견 1개\(필요할 때 2개\)/);
});

test("Jibssuk style is topic-neutral and final import format remains unchanged",async()=>{
  const {parseJibssukCopiedReport,buildJibssukIssueArticlePrompt}=await api();
  const report=parseJibssukCopiedReport(JSON.stringify(example)).report;
  const p=buildJibssukIssueArticlePrompt({topic:"다른 도시 아파트 수상",report,selectedAngleId:"a1",today:"2026-10-30"});
  assert.doesNotMatch(p,/4월 사건의 사유가 10월 사건에도/);
  assert.match(p,/서로 다른 시기의 사건이나 공급 물량/);
  assert.match(p,/NAVER_FINAL_ARTICLE_JSON/);
  assert.match(p,/코드 복사/);
  assert.match(p,/title/);
  assert.match(p,/body/);
});
