const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');
const moduleOut={exports:{}};
function localRequire(name){if(name==="./workplace-blog-v2"){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/workplace-blog-v2.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports});return m.exports;}return require(name);}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/workplace-handoff.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:moduleOut.exports,module:moduleOut,require:localRequire});
const {buildWorkplaceHandoff,safeFileName}=moduleOut.exports;
const steps=[{id:'basic',title:'단지정보'},{id:'route',title:'도보 경로'}];
const files=[{id:'a',name:'../단지.png',step:'basic',frames:['frame'],labels:['단지 구간1']},{id:'b',name:'영상.mp4',step:'route',frames:['f1','f2'],labels:['0.0초','2.0초']}];
test('complete handoff contains originals and frame provenance with missing status',()=>{
 const data=buildWorkplaceHandoff('스타필드 수원',{name:'단지',date:'2026-10-26',_memo_basic:'전용면적 확인 필요',_source_basic:'https://new.land.naver.com/'},files,steps);
 assert.equal(data.entries.length,2);assert.equal(data.entries[1].frames[1].label,'2.0초');
 assert.match(data.prompt,/자동 전송되지/);assert.match(data.prompt,/원문 직접 대조/);assert.match(data.prompt,/전용면적 확인 필요/);
 assert.equal(data.manifest.missing.length,0);assert.equal(data.manifest.notes[0].source,'https://new.land.naver.com/');
 assert.ok(data.entries.every(e=>!e.path.includes('/../')));
});
test('step package excludes other steps and reports missing reasons without inventing data',()=>{
 const data=buildWorkplaceHandoff('근무지',{_skip_route:'직원 출입구 확인 불가'},[],steps,'route');
 assert.equal(data.entries.length,0);assert.equal(data.manifest.missing[0],'도보 경로: 직원 출입구 확인 불가');
 assert.match(data.prompt,/아직 전체 글/);assert.equal(data.manifest.notes.length,1);
 const one=buildWorkplaceHandoff('근무지',{},files,steps,'basic');assert.equal(one.entries.length,1);assert.equal(one.entries[0].id,'a');
});
test('legacy unclassified files remain exportable and duplicate names use distinct paths',()=>{
 const legacy={...files[0],id:'legacy',step:undefined};
 const data=buildWorkplaceHandoff('근무지',{},[...files,legacy],steps);
 assert.equal(data.entries.length,3);assert.match(data.entries[2].path,/unclassified/);
 assert.equal(new Set(data.entries.map(e=>e.path)).size,3);
 assert.equal(safeFileName('../../a/b.png').includes('/'),false);
});
