const assert=require('node:assert/strict');
const {load,storage}=require('./load-ts.cjs');
const a=load('lib/apartment-analysis.ts');
const t=load('lib/apartment-themes.ts');
const p=load('app/apartment-bulk/page.tsx').testOnly;
const months=a.requestedMonths().slice(-6);
const fixture=(prices,counts=[3,3,3,3,3,3])=>prices.map((v,i)=>({month:months[i],medianPrice:v==null?null:v*1e8,tradeCount:counts[i]}));
const cases=[['A',fixture([4.2,4.5,4.3,4.5,4.4,4.3]),'rebound'],['B',fixture([4.8,4.9,5.3,5.95,6.06,6.0]),'band'],['C',fixture([10.1,10.1,10.2,10.1,10.2,10.2],[2,2,3,4,6,9]),'trade'],['C-stable',fixture([10.1,10.1,10.2,10.1,10.2,10.2]),'stable']];
const data={name:'시험단지',region:'시험지역',area:'전용 84㎡대',sourceArea:'전용 84㎡대',sourceName:'시험단지',sourceRegion:'시험지역',sourceVersion:1,tradeArea:84.97,tradeDate:months.at(-1)+'-15',recentPrice:'6억원',previousPrice:'4.8억원',households:'확인 필요',moveIn:'확인 필요',station:'',locationLine:'',question:'',thumbnailTone:'auto'};
for(const [name,rows,expected] of cases){
 const theme=t.selectArticleTheme(rows,'auto',[],'');assert.equal(theme.id,expected,name);
 // A recently completed matching theme must not force an unrelated weaker story.
 assert.equal(t.selectArticleTheme(rows,'auto',[expected],'').id,expected);
 const prompt=p.makeBodyPrompt(data,rows,'',theme);
 assert.ok(prompt.includes(theme.angle));assert.ok(prompt.includes('희망 분석기간:'));assert.ok(!prompt.includes('70% 고정'));
 console.log('PASS scene',name,'=>',theme.label);
}
assert.equal(t.selectArticleTheme([],'auto',[],'').id,'context');
assert.equal(t.selectArticleTheme(fixture([5,5,5,5,5,5],[1,1,1,1,1,1]),'auto',[],'').id,'context');
const gap=fixture([5,null,5,5,null,5],[3,0,3,3,0,3]);assert.equal(t.selectArticleTheme(gap,'auto',[],'').id,'gap');
assert.equal(a.matchesArea(84.99,84),true);assert.equal(a.matchesArea(85,84),false);assert.equal(a.matchesArea(101.88,134),false);assert.equal(a.matchesArea(NaN,84),false);
assert.ok(p.priceContext({...data,tradeArea:101.88}).includes('확인 필요'));
assert.ok(!p.priceContext({...data,sourceVersion:undefined}).includes('6억원'));
assert.ok(p.priceContext({...data,area:'전용 59㎡대'}).includes('변경'));
const w=a.requestedMonths('2026-01-02');assert.equal(w[0],'2025-01');assert.equal(w.at(-1),'2025-12');
const missing=a.analysisRows([{month:'2025-03',medianPrice:5e8,tradeCount:3},{month:'2025-05',medianPrice:null,tradeCount:0}], '2026-01-02');
assert.equal(missing.find(r=>r.month==='2025-04').status,'unverified');assert.equal(missing.find(r=>r.month==='2025-04').medianPrice,null);assert.equal(missing.find(r=>r.month==='2025-05').status,'no_trades');
assert.ok(a.monthLine(missing[3]).includes('미확인'));assert.ok(!a.monthLine(missing[3]).includes('0건'));
const graph=p.makePriceImagePrompt(data,fixture([4.2,null,4.3,4.5,4.4,4.3]));assert.ok(graph.includes('보간'));assert.ok(graph.includes('희망 분석기간'));assert.ok(graph.includes('미확인') || graph.includes('가격 없음'));
const before=storage.size;p.makeBodyPrompt(data,cases[0][1],'',t.selectArticleTheme(cases[0][1],'auto',[],''));assert.equal(storage.size,before,'request does not record completion');
const raw='새 단지 제목\n'+('실제로 붙여넣은 도입 문장입니다. '.repeat(5))+'\n두 번째 문단입니다.\n세 번째 문단입니다.';
const excerpt=a.finishedExcerpt(raw,'work-1','rebound');assert.ok(excerpt);a.rememberFinished(excerpt);assert.equal(a.readFinished().length,1);
a.rememberFinished({...excerpt,title:'수정한 제목'});assert.equal(a.readFinished().length,1);assert.ok(a.diversityPrompt(a.readFinished(),'other').includes('수정한 제목'));assert.ok(!a.diversityPrompt(a.readFinished(),'work-1').includes('수정한 제목'));
assert.equal(a.finishedExcerpt('짧은 초안','x'),null);
const top=load('app/apartment-bulk/top3-simple.ts');assert.ok(top.articleRequest('','').includes('시장신호 종합순'));assert.ok(top.articleRequest('','').includes('12개월'));assert.ok(top.articleRequest('','').includes('전체 비교 범위'));
console.log('PASS area boundaries, legacy unsafe values, missing months, completed-month window, actual-finished history, rank claims');
