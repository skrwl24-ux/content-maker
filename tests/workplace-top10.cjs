const test = require("node:test");
const assert = require("node:assert/strict");
const getModule = () => import("../lib/workplace-top10.mjs");
const sample = {
 place:"LG사이언스파크",region:"서울 강서구 마곡동",neighborhoods:"마곡동·발산동·가양동",
 period:"최근 12개월",area:"전용 59㎡대와 84㎡대",researchNotes:"",articleText:""
};
test("workplace TOP10 provides five clear presets and seven 16:9 image slots",async()=>{
 const {WORKPLACE_TOP10_PRESETS,WORKPLACE_TOP10_SLOTS,buildTop10ImagePrompt}=await getModule();
 assert.equal(WORKPLACE_TOP10_PRESETS.length,5);
 assert.deepEqual(WORKPLACE_TOP10_SLOTS.map(x=>x.id),["00","01","02","03","04","05","06"]);
 assert.match(buildTop10ImagePrompt(sample,WORKPLACE_TOP10_SLOTS[0]),/1600×900/);
 assert.match(buildTop10ImagePrompt(sample,WORKPLACE_TOP10_SLOTS[0]),/X=350~1250/);
 assert.match(buildTop10ImagePrompt(sample,WORKPLACE_TOP10_SLOTS[0]),/클로즈업/);
});
test("research asks for a truthful all-area sale count across specified neighborhoods",async()=>{
 const {buildTop10ResearchPrompt}=await getModule();
 const p=buildTop10ResearchPrompt(sample);
 for (const x of ["마곡동·발산동·가양동","최근 12개월","전용면적 전체","TOP 10","계약 해제","출처","거래 건수"]) assert.ok(p.includes(x),x);
 assert.match(p,/전수 확인이 불가능하면/);
 assert.match(p,/자동 조회하거나 순위를 검증하지 않았어/);
});
test("article prompt preserves user-provided evidence and news V5 safeguards",async()=>{
 const {buildTop10ArticlePrompt}=await getModule();
 const p=buildTop10ArticlePrompt({...sample,researchNotes:"공식 자료 7건 확인, 개별 계약일과 가격은 재확인 필요"});
 for (const x of ["공식 자료 7건 확인","제목 후보 5개","생활킥","Q&A 3개","해시태그 10개","1600×900px","중앙 정사각 안전영역"]) assert.ok(p.includes(x),x);
 assert.match(p,/절대적 TOP 10으로 단정하지 않는다/);
});
test("individual image prompts depend on confirmed manuscript and never fabricate data",async()=>{
 const {WORKPLACE_TOP10_SLOTS,buildTop10ImagePrompt}=await getModule();
 const noText=buildTop10ImagePrompt(sample,WORKPLACE_TOP10_SLOTS[4]);
 assert.match(noText,/최종 원고 없음/);
 assert.match(noText,/계약일·면적·층수·금액/);
 const withText=buildTop10ImagePrompt({...sample,articleText:"원고에 넣은 숫자는 검증 후 표시"} ,WORKPLACE_TOP10_SLOTS[2]);
 assert.match(withText,/원고에 넣은 숫자는 검증 후 표시/);
 assert.equal(buildTop10ImagePrompt(sample,{id:"09",title:"없는 장면"}),"");
});
