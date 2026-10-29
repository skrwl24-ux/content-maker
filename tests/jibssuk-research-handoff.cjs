const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
async function api(){return import("../lib/jibssuk-research-handoff.mjs");}
const candidate={title:"수상한 OO아파트, 실제로 어떤 평가 받았나?",category:"아파트",
  interestType:"언론 보도",interestEvidence:"2026년 10월 29일 아파트 수상 발표 기사",
  sourceUrl:"https://example.org/award?case=1",sourceDate:"2026-10-29",checkedAt:"2026-10-30"};
const slot=(topic="",notes="")=>JSON.stringify({version:1,channel:"집값쓱",topic,notes,raw:"",
  selectedAngleId:"",approvedKeys:[],finalRaw:"",finalTitle:"",finalBody:""});
test("news issue handoff preserves named apartment, reason, link and dates as unverified notes",async()=>{
  const {JIBSSUK_RESEARCH_HANDOFF_KEY,makeResearchHandoff,parseResearchHandoff,researchNotesFromHandoff}=await api();
  const handoff=makeResearchHandoff(candidate);
  assert.equal(JIBSSUK_RESEARCH_HANDOFF_KEY,"content-maker-jibssuk-research-handoff-v1");
  assert.equal(handoff.title,candidate.title);
  assert.equal(parseResearchHandoff(JSON.stringify(handoff)).sourceUrl,candidate.sourceUrl);
  const notes=researchNotesFromHandoff(handoff);
  assert.match(notes,/수상 발표 기사/);assert.match(notes,/2026-10-29/);
  assert.match(notes,/2026-10-30/);assert.match(notes,/https:\/\/example.org\/award/);
  assert.match(notes,/미검증/);assert.match(notes,/원문 확인 전/);
});
test("handoff rejects malformed sources and unsafe links without changing any workspace",async()=>{
  const {makeResearchHandoff,parseResearchHandoff}=await api();
  assert.equal(makeResearchHandoff({...candidate,sourceUrl:"javascript:alert(1)"}),null);
  assert.equal(makeResearchHandoff({...candidate,sourceDate:""}),null);
  assert.equal(makeResearchHandoff({...candidate,title:" "}),null);
  assert.equal(parseResearchHandoff("not JSON"),null);
  assert.equal(parseResearchHandoff(JSON.stringify({version:2,...candidate})),null);
  assert.equal(parseResearchHandoff(JSON.stringify({...candidate,version:1,sourceUrl:"http://insecure.test"})),null);
});
test("empty research slot chosen without clobbering any occupied slot",async()=>{
  const {makeResearchHandoff,pickResearchDestination}=await api();
  const incoming=makeResearchHandoff(candidate);
  assert.deepEqual(pickResearchDestination([slot("기존 조사"),null,slot("Paramma 작업"),null,null],incoming),{kind:"free",slot:2});
  assert.deepEqual(pickResearchDestination([null,null,null,null,null],incoming),{kind:"free",slot:1});
  assert.deepEqual(pickResearchDestination([slot("","원문 메모 있음"),null,null,null,null],incoming),{kind:"free",slot:2});
  assert.deepEqual(pickResearchDestination([slot("이미 연구 중"),slot(candidate.title),null,null,null],incoming),{kind:"existing",slot:2});
  assert.deepEqual(pickResearchDestination([slot("a"),slot("b"),slot("c"),slot("d"),slot("e")],incoming),{kind:"full",slot:0});
  assert.deepEqual(pickResearchDestination(["{garbled",null,null,null,null],incoming),{kind:"full",slot:0});
  assert.deepEqual(pickResearchDestination([null,null],incoming),{kind:"invalid",slot:0});
});
test("queue sends chosen story and source to research, research imports only with empty space or confirmation",()=>{
  const queue=fs.readFileSync("app/jibssuk-queue/page.tsx","utf8");
  const research=fs.readFileSync("app/research-studio/ResearchQueue.tsx","utf8");
  assert.match(queue,/makeResearchHandoff\(active\)/);
  assert.match(queue,/localStorage\.setItem\(JIBSSUK_RESEARCH_HANDOFF_KEY,JSON\.stringify\(handoff\)\)/);
  assert.match(queue,/window\.location\.assign\("\/research-studio"\)/);
  assert.match(queue,/심층 조사·원고 작성으로 이동/);
  assert.match(research,/pickResearchDestination\(stored,handoff\)/);
  assert.match(research,/destination.kind==="free"/);
  assert.match(research,/destination.kind==="existing"/);
  assert.match(research,/window\.confirm\(slotNumber/);
  assert.match(research,/setIncoming\(handoff\)/);
  assert.match(research,/setEpoch\(v=>v\+1\)/);
  assert.match(research,/researchNotesFromHandoff\(handoff\)/);
  assert.match(research,/가져오기 취소 · 기존 작업 유지/);
  assert.match(research,/ResearchWorkPanel/);
});
