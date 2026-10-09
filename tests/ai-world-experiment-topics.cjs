const test=require("node:test");
const assert=require("node:assert/strict");


const loaded=import("../lib/ai-world-experiment-topics.mjs");

test("topic bank starts with ten evergreen comparison ideas",async()=>{
 const {initialTopics,countTopics}=await loaded; const initial=initialTopics();assert.equal(initial.length,10);assert.equal(countTopics(initial).pending,10);
 assert.ok(initial.every(t=>t.question&&t.status==="pending"));
});
test("normalize Korean spacing and case to prevent near identical title duplicates",async()=>{
 const {initialTopics,mergeTopics,countTopics}=await loaded; const first=initialTopics();const input=[
 {title:"AI 3사에게 가장 살기 좋은 나라를 물어봤다"},
 {title:"AI 3사에게 가장 살기 좋은 나라를 물어봤다!"},
 {title:"100만원 최고의 노트북"},
 {title:"100만원 최고의 노트북"}];
 const merged=mergeTopics(first,input);
 assert.equal(merged.length,11);assert.equal(countTopics(merged).used,0);
});
test("used status survives reimport and newer duplicates never erase it",async()=>{
 const {initialTopics,mergeTopics}=await loaded; const t={...initialTopics()[0],status:"used",usedAt:"2026-10-09"};
 const merged=mergeTopics([t],[{title:t.title,status:"pending"}]);
 assert.equal(merged[0].status,"used");assert.equal(merged[0].usedAt,"2026-10-09");
});
test("bulk paste strips list prefixes and ignores empty lines",async()=>{
 const {parseBulkTopics}=await loaded; const topics=parseBulkTopics("1. AI가 고른 차\n- AI가 고른 나라\n\n* 최고의 노트북");
 assert.equal(topics.length,3);assert.equal(topics[0].title,"AI가 고른 차");
});
test("invalid or enormous bank entries are rejected or constrained",async()=>{
 const {sanitizeTopic,mergeTopics,topicKey}=await loaded; assert.equal(sanitizeTopic({title:"x"}),null);assert.equal(mergeTopics([{title:"A valid title"}],[{title:"A valid title"}]).length,1);
 assert.equal(topicKey("AI 3사 / 최고의 TV!"),"ai3사최고의tv");
});
