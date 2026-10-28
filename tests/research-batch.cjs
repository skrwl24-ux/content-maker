const test=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");

async function batch(){return import("../lib/research-batch.mjs");}

test("five topics can be entered together with blank lines and numbering",async()=>{
 const {parseResearchBatchTopics}=await batch();
 assert.deepEqual(parseResearchBatchTopics("1. 판교\n\n2) 스타필드\n3. 드라마 촬영지\n4. 동물\n5. 정책"),{
   topics:["판교","스타필드","드라마 촬영지","동물","정책"],error:"",
 });
 assert.deepEqual(parseResearchBatchTopics("하나"),{topics:["하나"],error:""});
});

test("batch rejects more than five topics, empty list and too-long topics",async()=>{
 const {parseResearchBatchTopics}=await batch();
 assert.match(parseResearchBatchTopics("a\nb\nc\nd\ne\nf").error,/최대 5개/);
 assert.match(parseResearchBatchTopics(" \n \n ").error,/주제를/);
 assert.match(parseResearchBatchTopics("x".repeat(601)).error,/600자/);
});

test("work slots have distinct storage keys and begin with separate empty evidence",async()=>{
 const {researchSlotKey,emptyResearchSlot,RESEARCH_BATCH_SIZE}=await batch();
 assert.equal(RESEARCH_BATCH_SIZE,5);
 const keys=Array.from({length:5},(_,i)=>researchSlotKey(i+1));
 assert.equal(new Set(keys).size,5);
 assert.throws(()=>researchSlotKey(6),RangeError);
 assert.throws(()=>researchSlotKey(0),RangeError);
 const workA=emptyResearchSlot("주제 A");
 const workB=emptyResearchSlot("주제 B","Paramma");
 assert.deepEqual(workA.approvedKeys,[]);
 workA.approvedKeys.push("approved A");
 assert.deepEqual(workB.approvedKeys,[]);
 assert.equal(workB.channel,"Paramma");
});

test("batch UI saves each slot independently, confirms replacement and supports whole-list backup",()=>{
 const ui=readFileSync("app/research-studio/ResearchQueue.tsx","utf8");
 assert.match(ui,/localStorage\.setItem\(researchSlotKey\(i\+1\)/);
 assert.match(ui,/window\.confirm/);
 assert.match(ui,/content-maker-research-five-topics\.json/);
 assert.match(ui,/active===i\+1/);
 assert.match(ui,/ResearchWorkPanel/);
});
