const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
async function api(){return import("../lib/jibssuk-topic-queue.mjs")}
const cand=(title="위례선 트램 개통 일정 변경",category="지역 변화")=>({
 title,category,interestType:"언론 보도",interestEvidence:"2026년 10월 발표를 다룬 기사",
 sourceUrl:"https://example.org/verified-source",sourceDate:"2026-10-29"
});
test("prompt is one fixed JSON contract with user-approved full scope, 7-to-30-day horizon and 10 candidates",async()=>{
 const {buildPrompt,TAG}=await api();
 const p=buildPrompt({scope:"전체",today:"2026-10-29",queue:[{title:"기존 아파트"}],history:[{title:"완료된 교통"}],previousSuggestions:["지난번 추천"]});
 assert.match(p,/최근 7일/);assert.match(p,/최근 30일/);assert.match(p,/최대 10개/);
 assert.match(p,/검색량 급증/);assert.match(p,/실제 커뮤니티/);assert.match(p,/발표일/);
 assert.match(p,/기존 아파트/);assert.match(p,/완료된 교통/);assert.match(p,/지난번 추천/);
 assert.match(p,/아파트 중심과 지역 변화를 모두 조사/);
 assert.match(p,new RegExp("\\["+TAG+"\\]"));
 const pp=buildPrompt({scope:"아파트 중심"});assert.match(pp,/아파트 실거래/);
 assert.match(buildPrompt({scope:"지역 변화"}),/GTX·지하철·트램/);
});
test("parser accepts only version 1 tagged JSON and rejects invented or missing evidence",async()=>{
 const {parseRecommendations,TAG}=await api();
 const original={version:1,checkedAt:"2026-10-29",candidates:[
  cand(),{...cand(),title:" 위례선 트램 개통 일정 변경 "},
  {...cand("근거 없음"),sourceUrl:""}, {...cand("위험 링크"),sourceUrl:"javascript:alert(1)"},
  {...cand("불분명한 날짜"),sourceDate:""},
  cand("판교 실거래 비교","아파트")
 ]};
 const parsed=parseRecommendations("검색 결과 요약\n["+TAG+"]\n"+JSON.stringify(original)+"\n[/"+TAG+"]");
 assert.equal(parsed.error,"");assert.equal(parsed.candidates.length,2);assert.equal(parsed.skipped,4);
 assert.equal(parsed.candidates[1].category,"아파트");
 assert.ok(parseRecommendations("[JIBSSUK_TOPIC_RECOMMENDATIONS_JSON]{}").error);
 assert.ok(parseRecommendations('{"version":2,"candidates":[]}').error);
 assert.ok(parseRecommendations('{"version":1,"candidates":'+JSON.stringify(Array(11).fill(cand()))+'}').error);
});
test("new topics go into candidate pool but never auto-fill the 10 slots",async()=>{
 const {emptyState,addRecommendations}=await api();
 const initial=emptyState();
 assert.equal(initial.queue.length,10);assert.equal(initial.queue.filter(Boolean).length,0);
 const out=addRecommendations(initial,{checkedAt:"2026-10-29",candidates:[cand(),cand("광교 가격 차이","아파트")]});
 assert.equal(out.added,2);assert.equal(out.state.queue.filter(Boolean).length,0);
 assert.equal(out.state.candidates.length,2);
 const rerun=addRecommendations(out.state,{checkedAt:"2026-10-29",candidates:[cand()]});
 assert.equal(rerun.added,0);assert.equal(rerun.state.candidates.length,2);
});
test("only an empty slot or completed slot may be filled; completion is retained in history",async()=>{
 const {emptyState,addRecommendations,placeCandidate,changeStatus}=await api();
 let s=addRecommendations(emptyState(),{candidates:[cand("첫 글감"),cand("두번째 글감")]}).state;
 const first=placeCandidate(s,"첫 글감");assert.equal(first.slot,0);s=first.state;
 assert.equal(s.queue[0].status,"waiting");
 assert.ok(placeCandidate(s,"첫 글감").error);
 assert.ok(placeCandidate(s,"두번째 글감",0).error);
 s=changeStatus(s,0,"working");s=changeStatus(s,0,"done");
 assert.equal(s.history.length,1);assert.equal(s.queue[0].status,"done");
 const second=placeCandidate(s,"두번째 글감",0);assert.equal(second.error,undefined);s=second.state;
 assert.equal(s.queue[0].title,"두번째 글감");assert.equal(s.queue[0].status,"waiting");
 assert.equal(s.history[0].title,"첫 글감");
 assert.ok(placeCandidate(s,"첫 글감").error);
});
test("full queue requires selecting a done slot; undo completion updates history",async()=>{
 const {emptyState,addRecommendations,placeCandidate,changeStatus,restore,QUEUE_SIZE}=await api();
 let s=emptyState();
 const many=Array.from({length:QUEUE_SIZE+1},(_,i)=>cand("지역 관심 "+i));
 s=addRecommendations(s,{candidates:many}).state;
 for(let i=0;i<QUEUE_SIZE;i++)s=placeCandidate(s,many[i].title).state;
 assert.equal(s.queue.filter(Boolean).length,10);
 assert.ok(placeCandidate(s,many[10].title).error);
 s=changeStatus(s,4,"done");assert.equal(s.history.length,1);
 s=changeStatus(s,4,"working");assert.equal(s.history.length,0);
 assert.ok(placeCandidate(s,many[10].title,4).error);
 s=changeStatus(s,4,"done");s=placeCandidate(s,many[10].title,4).state;
 assert.equal(s.queue[4].title,many[10].title);
 assert.equal(restore(s).queue.length,10);
 assert.equal(restore({version:0}).queue.filter(Boolean).length,0);
});
test("production route is separate from Paramma and uses the same contract for prompt and parser",()=>{
 const page=fs.readFileSync("app/jibssuk-queue/page.tsx","utf8");
 assert.match(page,/content-maker-jibssuk-topic-queue-v1/);
 assert.match(page,/buildPrompt\(/);assert.match(page,/parseRecommendations\(raw\)/);
 assert.match(page,/placeCandidate\(state,candidate.title,target\)/);
 assert.match(page,/target===null&&free===0/);
 assert.match(page,/갈아끼우기/);
 const app=fs.readFileSync("app/page.tsx","utf8");
 assert.match(app,/href="\/jibssuk-queue"/);
});
