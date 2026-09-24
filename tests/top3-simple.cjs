const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(name) {
 const out = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/apartment-bulk/'+name+'.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:()=>model});
 return out;
}
const model=require("./load-ts.cjs").load("app/apartment-bulk/top3-model.ts");
const m=require("./load-ts.cjs").load("app/apartment-bulk/top3-simple.ts");
const raw='추천 이유\n[제목]\n테스트 제목\n[/제목]\n[본문]\n본문과 출처\n[/본문]\n[이미지 00]\n썸네일 전용\n[/이미지 00]\n[이미지 01]\n도표 전용\n[/이미지 01]\n[이미지 02]\n체크리스트 전용\n[/이미지 02]';
const parsed=m.parseArticle(raw);
assert.equal(parsed.body,'테스트 제목\n\n본문과 출처');
assert.equal(Object.keys(parsed.plans).length,3);
assert.throws(()=>m.parseArticle(raw.replace('[/이미지 01]','')));
assert.throws(()=>m.parseArticle(raw+'\n[제목]중복[/제목]'));
assert.equal(m.parseArticle(raw+'\n[이미지 03]\n추가\n[/이미지 03]').plans['03'],'추가');
const data=model.emptyTop3();
data.imagePlans=Object.fromEntries(Object.entries(parsed.plans).map(([id,text])=>[id,{text,revision:''}]));
const prompt=m.imageRequest('01',parsed.topic,'',parsed.body,data);
assert.ok(prompt.includes('도표 전용')&&prompt.includes(parsed.body));
assert.ok(!prompt.includes('썸네일 전용')&&!prompt.includes('체크리스트 전용'));
const current=model.revision(parsed.topic,'',parsed.body,data);
for(const id of ['00','01','02']) data.images[id]={dataUrl:'test',revision:model.imageRevision(id,current,data)};
assert.equal(m.exportIssues(parsed.topic,'',parsed.body,data).length,0);
assert.ok(m.exportIssues(parsed.topic,'',parsed.body+'수정',data).length);
assert.ok(m.articleRequest('','').includes('선택 질문으로 멈추지'));
console.log('PASS: whole reply parsing, optional images, malformed reply rejection, isolated image prompts, no evidence gate, stale image detection');
