const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const m={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/apartment-bulk/top3-naver.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:m});
const r=m.naverCopy('제목\n\n도입 문단\n\n## 소제목\n**강조**와 [자료](https://example.com)\n<img src=x onerror=alert(1)>\n#아파트 #TOP3\n[이미지 00]\n제작 지시','제목');
assert.ok(!r.plain.startsWith('제목'));assert.ok(r.html.includes('<h2'));assert.ok(r.html.includes('<strong>강조</strong>'));assert.ok(r.html.includes('href="https://example.com"'));assert.ok(!r.html.includes('<img'));assert.ok(!r.plain.includes('제작 지시'));assert.ok(r.plain.includes('#아파트 #TOP3'));assert.ok(!r.plain.includes('**'));
const tagged=m.naverCopy('[제목]\n제목\n[/제목]\n[본문]\n글\n[/본문]\n[이미지 00]\n지시','제목');assert.equal(tagged.plain,'글');
console.log('PASS: title separation, headings, emphasis, links, escaped HTML, tags and image-plan exclusion');

