const {test}=require('node:test');const assert=require('node:assert/strict');
const policy=()=>import('../lib/jibssuk-editorial-policy.mjs');
const history=()=>import('../lib/jibssuk-research-history.mjs');
// Synthetic fixtures exercise the information contract, not real-world verification.
const make=(topic,facts,extra={})=>JSON.stringify({topic,checkedAt:'2026-10-30',facts,angles:[{id:'a1',title:'독자의 질문',readerQuestion:'무엇이 다른가?',uniqueValue:'확인된 차이만',factIds:[facts[0].id]}],gaps:[],trendLinks:[],...extra});
const f=(id,claim,extra={})=>({id,claim,sourceUrl:'https://example.org/'+id,publishedAt:'2026-10-29',...extra});
test('A: past 68-floor plan and new share contract stay separate and writer distinguishes stages',async()=>{
 const m=await history();const {buildJibssukIssueArticlePrompt}=await import('../lib/jibssuk-simple-workflow.mjs');
 const r=m.createResearchHistory(make('압구정 한양1·2차',[f('p','기존 68층 계획',{eventDate:'2025-01-01'}),f('c','새 도급계약 지분금액 10472억원',{eventDate:'2026-10-28',scope:'70% 지분'})])).mergedReport;
 const p=buildJibssukIssueArticlePrompt({report:r,selectedAngleId:'a1'});assert.match(p,/기존 68층 계획/);assert.match(p,/70% 지분/);assert.match(p,/선정·계약·승인·착공·준공/);assert.match(p,/제목 작성 전후/);
});
test('B: same text and URL with distinct resupply events or scopes must never collapse',async()=>{
 const m=await history();let h=m.createResearchHistory(make('과천 디에트르 퍼스티지',[f('f1','공급 공고',{eventDate:'2024-06-01',scope:'최초 공급'})]));
 h=m.appendResearchRound(h,make('과천 디에트르 퍼스티지',[f('f1','공급 공고',{eventDate:'2026-10-01',scope:'후속 재공급'})]));
 h=m.appendResearchRound(h,make('과천 디에트르 퍼스티지',[f('f1','공급 공고',{eventDate:'2026-10-01',scope:'별도 회차'})]));assert.equal(h.mergedReport.facts.length,3);
});
test('C: transaction comparison preserves date/area and prompt forbids invented causes',async()=>{
 const m=await history();const {buildJibssukIssueArticlePrompt}=await import('../lib/jibssuk-simple-workflow.mjs');
 const r=m.createResearchHistory(make('화서주공4단지',[f('t1','84㎡ 계약 5억원',{eventDate:'2026-01-01'}),f('t2','84㎡ 계약 6억원',{eventDate:'2026-10-01'})])).mergedReport;
 const p=buildJibssukIssueArticlePrompt({report:r,selectedAngleId:'a1'});assert.match(p,/2026-01-01/);assert.match(p,/2026-10-01/);assert.match(p,/층·향·상태 등 원인 자료가 없으면 이유를 단정하지/);
});
test('D: ordinary news permits no discovery, no mandatory financial twist or investment ending',async()=>{
 const p=await policy();assert.match(p.JIBSSUK_READER_RULES,/발견이 없으면/);assert.match(p.JIBSSUK_READER_RULES,/매수·매도·투자 조언으로 끝내지/);assert.match(p.JIBSSUK_READER_RULES,/가설/);
 assert.deepEqual(p.checkJibssukTitleConsistency('지역 공원 개방 소식','지역 공원이 개방됐습니다.'),[]);
});
test('E: 3 rounds and over 30 facts keep originals; selected + late discovery/conflict evidence survive compact prompts',async()=>{
 const m=await history();const p=await policy();let h=m.createResearchHistory(make('누적 조사',Array.from({length:40},(_,i)=>f('f'+i,'독립 항목 '+String.fromCharCode(0xAC00+i)))),'a1');
 for(let i=0;i<3;i++)h=m.appendResearchRound(h,make('누적 조사',[f('new','후속 사실 '+i)],{discoveries:[{title:'후속 발견 '+i,factIds:['new']}]}));
 const before=JSON.stringify(h);const selected=p.selectJibssukWritingEvidence(h.mergedReport,'a1');
 assert.equal(h.mergedReport.facts.length,43);assert.equal(h.rounds.length,3);assert.equal(h.selectedAngleId,'a1');assert.equal(JSON.stringify(h),before);assert.ok(selected.facts.some(f=>f.claim==='후속 사실 2'));assert.ok(selected.omittedFactIds.length>0);assert.ok(selected.facts.length<43);assert.equal(m.restoreResearchHistory(h,3).mergedReport.facts.length,43);
});
test('title hints are advisory, flag numbers/stages and stay silent on consistent wording',async()=>{
 const p=await policy();assert.equal(p.checkJibssukTitleConsistency('68층 계획','최고 68층 계획입니다.').length,0);
 assert.ok(p.checkJibssukTitleConsistency('68층 준공','기존 68층 계획입니다.').length);
 assert.ok(p.checkJibssukTitleConsistency('68층 준공','도급계약은 67층 기준입니다.').length>=2);
 assert.ok(p.checkJibssukTitleConsistency('사업 확정','추진 계획과 예정 일정입니다.').length);
});
test('F: other channels keep their existing common parser and no Jibssuk policy leaks into Paramma research',async()=>{
 const {buildDeepResearchPrompt}=await import('../lib/research-studio.mjs');const fs=require('node:fs');
 const p=buildDeepResearchPrompt({channel:'Paramma',topic:'동물의 생활'});assert.doesNotMatch(p,/재공급은 최초 분양/);assert.doesNotMatch(p,/구경하는 독자도 있다/);
 const ui=fs.readFileSync('app/jibssuk-queue/JibssukArticleWorkflow.tsx','utf8');assert.ok(ui.indexOf('부족한 정보 추가 조사 요청서 복사')<ui.indexOf('>추가 조사 결과 가져오기'));
});
