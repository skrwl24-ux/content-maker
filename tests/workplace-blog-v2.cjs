const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const vm=require('node:vm');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/workplace-blog-v2.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports});
const {buildResearch,buildArticle,buildImagePrompt,buildComparisonTable,imageSlots}=mod.exports;
const draft={facility:'상업시설',place:'스타필드 수원',city:'수원시 장안구',address:'',entrance:'',travel:'도보',travelTarget:'20분 이내',homeType:'전체',budget:'',candidateNames:'',sourceNotes:'',checkedAt:'2026-10-26',checkedTrade:false,checkedListing:false,checkedRoute:false};
test('Starfield article has fixed ordered sections, Q&A 3 and summary, with no fabricated candidates or prices',()=>{
 const output=buildArticle(draft);let previous=-1;
 for(const text of ['01. 10초 핵심 비교표','02. 근무지와 출입구','03. 후보 아파트','04. 실제 출퇴근 동선','05. 실거래와 주거비','06. 실거주 장단점','07. 유용한 발견 1개','08. Q&A 3개','09. 결론·3줄 요약·출처']){const index=output.indexOf(text);assert.ok(index>previous,text);previous=index;}
 assert.match(output,/희망 범위\(검증 결과 아님\): 20분 이내/);assert.match(output,/공식 주소: 확인 필요/);assert.match(output,/예산: 미설정/);
 const table=buildComparisonTable(draft);assert.match(table,/후보 선정 필요/);assert.match(table,/needs_check/);assert.doesNotMatch(table,/\d+억|\d+분|0원/);
});
test('checkboxes and notes do not grant verified status or claim official lookup',()=>{
 const output=buildArticle(draft),checked=buildArticle({...draft,checkedTrade:true,checkedListing:true,checkedRoute:true});assert.equal(output,checked);
 assert.match(output,/verified를 자동 부여하지 않는다/);assert.match(buildResearch(draft),/자동 조회·검증을 완료하지 않았다/);
});
test('eight image requests have exact dimensions, distinct messages, photo guidance and missing-evidence fallback',()=>{
 assert.equal(imageSlots.length,8);
 imageSlots.forEach((slot,i)=>{assert.equal(slot.id,String(i).padStart(2,'0'));assert.equal(slot.size,i===0?'1254×1254':'1600×900');const prompt=buildImagePrompt(draft,slot);assert.match(prompt,/AI 설명 이미지 요청서/);assert.match(prompt,/사진 검색·직접 촬영 추천/);assert.match(prompt,/needs_check/);assert.ok(prompt.includes(slot.message));});
 assert.match(buildImagePrompt(draft,imageSlots[5]),/경로 근거가 없으면.*체크리스트/);
});
test('templates require exact unit identity, excluded cancelled trades, separate rentals/listings and genuine routes',()=>{
 const d={...draft,sourceNotes:'동명이인 후보 / 전용 84.79㎡와 84.9㎡ / 해제 거래 / 직선거리만 확인 / 전월세 접근 불가'};
 for(const output of [buildResearch(d),buildArticle(d),buildImagePrompt(d,imageSlots[4])]){
  assert.match(output,/동명단지를 혼합하지/);assert.match(output,/정확히 같은 전용면적/);assert.match(output,/area_group/);assert.match(output,/해제 거래는 유효 최고가·가격 비교에서 제외/);
  assert.match(output,/전세·월세는 별도의 검증된 계약 자료/);assert.match(output,/실거래와 현재 매물 호가/);assert.match(output,/직선거리를 도보 거리나 시간으로 환산하지/);assert.match(output,/미확인 ≠ 거래 없음/);
 }
});
test('candidate placeholders retain supplied names, escape tables and never fill unverified fields',()=>{
 const d={...draft,candidateNames:'후보 A\n후보 B|별칭\n후보 C'};const table=buildComparisonTable(d);
 assert.match(table,/후보 A/);assert.ok(table.includes('후보 B\\|별칭'));assert.match(table,/후보 C/);assert.equal((table.match(/\| needs_check \|/g)||[]).length>0,true);
 assert.doesNotMatch(table,/verified|0분|0원/);
});
