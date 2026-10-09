const test=require("node:test");
const assert=require("node:assert/strict");
const f=import("../lib/ai-world-experiment-schedule.mjs");
const responses={
 chatgpt:{model:"basic",response:"For most people I would pick Denmark because of healthcare and trust."},
 claude:{model:"basic",response:"I pick Switzerland, though housing is expensive."},
 gemini:{model:"basic",response:"My recommendation is Finland for education and social support."},
};
const state={mode:"recommend",title:"Best country according to AI",category:"Lifestyle",
 testQuestion:"What is the best country to live in? Choose exactly one and explain.",
 human:{choice:"",notes:"",photos:[]},runs:responses};
test("schedule comparison writes original provider responses verbatim and forbids objective winner",async()=>{
 const {buildExperimentScheduleReport,buildExperimentSchedulePrompt}=await f;
 const report=buildExperimentScheduleReport(state),prompt=buildExperimentSchedulePrompt(state);
 assert.match(report,/I pick Switzerland, though housing is expensive/);
 assert.match(report,/My recommendation is Finland/);
 assert.match(prompt,/추천 대결/);assert.match(prompt,/객관적으로 정해진 단일 정답 없음/);
 assert.match(prompt,/\[FINAL_TITLE\]/);assert.match(prompt,/\[BLOGGER_HTML\]/);
 assert.doesNotMatch(prompt,/\[WORLD_BLOG_DRAFT_JSON\]/);
});
test("schedule prompt maps to all six existing Blogger image slots",async()=>{
 const {buildExperimentSchedulePrompt}=await f;const p=buildExperimentSchedulePrompt(state);
 for(let i=0;i<6;i++)assert.match(p,new RegExp("\\[IMAGE 0"+i+" — "));
});
test("quiz version preserves original answer and warns against changing it",async()=>{
 const {buildExperimentSchedulePrompt}=await f;
 const p=buildExperimentSchedulePrompt({...state,mode:"quiz",groundTruth:"Singapore",sources:"source URLs",
 fixtureMode:"pdf",pdf:{name:"receipt.pdf",sha256:"abc123"}});
 assert.match(p,/Singapore/);assert.match(p,/receipt.pdf/);
 assert.match(p,/정답키와 PDF가 충돌/);assert.match(p,/\[IMAGE 03 — Answer revealed\]/);
});
