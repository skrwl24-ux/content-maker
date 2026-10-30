const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=()=>import('../lib/jibssuk-research-history.mjs');
const fact=(i,extra={})=>({id:'f'+i,claim:'고유 사실 '+i,sourceUrl:'https://example.org/'+i,sourceTitle:'자료 '+i,publishedAt:'2026-10-29',...extra});
const report=(facts,extra={})=>JSON.stringify({topic:'압구정 한양1·2차',summary:'기초 자료',facts,angles:[{id:'a1',title:'계약의 의미',readerQuestion:'달라진 것은?',uniqueValue:'선정과 계약의 차이',factIds:facts.length?[facts[0].id]:[]}],gaps:['전체 계약 범위?'],trendLinks:[],...extra});
test('10 initial + 5 incoming including 2 exact duplicates preserve IDs, remap references and selection',async()=>{
 const m=await api();const h=m.createResearchHistory(report(Array.from({length:10},(_,i)=>fact(i+1))),'a1');
 const input=[fact(1),fact(2),fact(3,{claim:'새 사실 A'}),fact(4,{claim:'새 사실 B'}),fact(5,{claim:'새 사실 C'})];
 const next=m.appendResearchRound(h,report(input,{angles:[{id:'a1',title:'새 관점',readerQuestion:'추가 질문',uniqueValue:'새 발견',factIds:['f3','f4']}]}));
 assert.equal(next.mergedReport.facts.length,13);assert.equal(next.stats.duplicates,2);assert.equal(next.stats.added,3);
 assert.equal(next.selectedAngleId,'a1');assert.equal(next.originalReport,h.originalReport);
 assert.deepEqual(next.mergedReport.facts.slice(0,10).map(f=>f.id),h.mergedReport.facts.map(f=>f.id));
 const angle=next.mergedReport.angles[1];assert.notEqual(angle.id,'a1');assert.equal(next.mergedReport.facts.find(f=>f.id===angle.factIds[0]).claim,'새 사실 A');
 assert.equal(h.mergedReport.facts.length,10);
});
test('multiple rounds, legacy tags, addendum tags, source linking and reversible history retain originals',async()=>{
 const m=await api();let h=m.createResearchHistory('[RESEARCH_REPORT_JSON]'+report([fact(1)])+'[/RESEARCH_REPORT_JSON]');
 for(let i=0;i<3;i++)h=m.appendResearchRound(h,'[RESEARCH_ADDENDUM_JSON]'+report([fact(i+2)])+'[/RESEARCH_ADDENDUM_JSON]');
 assert.equal(h.mergedReport.facts.length,4);const restored=m.restoreResearchHistory(h,0);assert.equal(restored.mergedReport.facts.length,1);assert.equal(restored.rounds.length,3);assert.deepEqual(m.restoreResearchHistory(restored,3).mergedReport,h.mergedReport);
 assert.throws(()=>m.appendResearchRound(restored,report([fact(9)])),/최신 상태/);
 const n=m.appendResearchRound(h,report([fact(1,{sourceUrl:'https://other.org/disclosure'})]));assert.equal(n.stats.sources,1);assert.equal(n.stats.duplicates,1);assert.equal(n.mergedReport.facts[0].sources.length,2);
});
test('conflicting figures remain unverified; different dates, similar prose and share vs total are retained',async()=>{
 const m=await api();let h=m.createResearchHistory(report([fact(1,{claim:'계약금액 10472억원',subject:'현대건설',metric:'계약금액',value:'10472억원',eventDate:'2026-10-28',scope:'70% 지분'})]));
 h=m.appendResearchRound(h,report([fact(1,{claim:'계약금액 10500억원',subject:'현대건설',metric:'계약금액',value:'10500억원',eventDate:'2026-10-28',scope:'70% 지분'}),fact(2,{claim:'전체 공사비 추산',subject:'현대건설',metric:'계약금액',value:'14960억원',eventDate:'2026-10-28',scope:'전체 추정'})]));
 assert.equal(h.mergedReport.facts.length,3);assert.equal(h.stats.conflicts,1);assert.equal(h.mergedReport.conflicts[0].status,'확인 필요');
 const a=m.parseCumulativeReport(report([fact(1,{eventDate:'2026-10-28'})]));const b=m.parseCumulativeReport(report([fact(1,{eventDate:'2026-10-29'})]));assert.equal(m.mergeResearchReports(a,b).report.facts.length,2);
});
test('no silent array/text truncation, ambiguous references and oversized input fail without changing prior state',async()=>{
 const m=await api();const raw=report(Array.from({length:55},(_,i)=>fact(i+1,{claim:'긴 주장 '+i+'가'.repeat(2000)})));const h=m.createResearchHistory(raw);assert.equal(h.mergedReport.facts.length,55);assert.ok(h.mergedReport.facts[54].claim.length>2000);
 assert.throws(()=>m.appendResearchRound(h,report([fact(1),fact(1)])),/중복/);assert.throws(()=>m.parseCumulativeReport(report([fact(1)],{angles:[{title:'깨진 참조',factIds:['absent']}]})),/존재하지/);assert.throws(()=>m.appendResearchRound(h,'x'.repeat(m.MAX_RESEARCH_SIZE+1)),/너무 큽니다/);assert.equal(h.rounds.length,0);
});
test('discoveries and all evidence survive final prompt, resolved gaps do not erase questions',async()=>{
 const m=await api();const {buildJibssukIssueArticlePrompt}=await import('../lib/jibssuk-simple-workflow.mjs');let h=m.createResearchHistory(report([fact(1)]));
 h=m.appendResearchRound(h,report([fact(1,{claim:'최신 후속 원문',sourceUrl:'https://example.org/latest'})],{discoveries:[{title:'공시액은 지분 금액',factIds:['f1']}],resolvedGaps:[{question:'전체 계약 범위?',factIds:['f1'],reason:'지분 공시'}]}));
 assert.equal(h.mergedReport.gaps.length,1);assert.equal(h.mergedReport.resolvedGaps[0].factIds[0],h.mergedReport.facts[1].id);
 const p=buildJibssukIssueArticlePrompt({report:h.mergedReport,selectedAngleId:'a1'});assert.match(p,/공시액은 지분 금액/);assert.match(p,/https:\/\/example.org\/latest/);assert.match(p,/과거 갈등이 해결됐다고 주장하지/);assert.match(p,/세금·계약 범위·비율/);
 const follow=m.buildJibssukFollowupPrompt({report:h.mergedReport,selectedAngleId:'a1'});assert.match(follow,/RESEARCH_ADDENDUM_JSON/);assert.match(follow,/기존 보고서를 재작성하지/);assert.match(follow,/계약의 의미/);
});
