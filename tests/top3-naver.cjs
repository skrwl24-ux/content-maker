const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const m={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/apartment-bulk/top3-naver.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:m});
const r=m.naverCopy('제목\n\n도입 문단\n\n## 소제목\n**강조**와 [자료](https://example.com)\n<img src=x onerror=alert(1)>\n#아파트 #TOP3\n[이미지 00]\n제작 지시','제목');
assert.ok(!r.plain.startsWith('제목'));assert.ok(r.html.includes('<h2'));assert.ok(r.html.includes('<strong style="font-weight:700;">강조</strong>'));assert.ok(r.html.includes('href="https://example.com"'));assert.ok(!r.html.includes('<img'));assert.ok(!r.plain.includes('제작 지시'));assert.ok(r.plain.includes('#아파트 #TOP3'));assert.ok(!r.plain.includes('**'));
const tagged=m.naverCopy('[제목]\n제목\n[/제목]\n[본문]\n글\n[/본문]\n[이미지 00]\n지시','제목');assert.equal(tagged.plain,'글');
console.log('PASS: title separation, headings, emphasis, links, escaped HTML, tags and image-plan exclusion');

assert.match(r.titleHtml,/font-size:20pt/); assert.match(r.html,/<h2[^>]+font-size:18pt/); assert.match(r.html,/<p[^>]+font-size:15pt/); assert.ok(!r.html.includes("font-size:16px")); assert.ok(r.fullHtml.startsWith(r.titleHtml)); assert.ok(r.fullPlain.startsWith("제목\n\n")); assert.equal((r.fullHtml.match(/<h1 /g)||[]).length,1);
console.log("PASS: 20pt title / 18pt headings / 15pt body and explicit bold in rich-copy HTML");

const positioned=m.naverCopy("[본문]\n도입\n[이미지 위치: 00 · 썸네일]\n## 비교\n가격 **8억원**\n[이미지 위치: 01 · 가격 비교]\n후속 본문\n[이미지 02 · 거래량]\n마지막 문장\n[/본문]\n[이미지 00]\n생성 지시\n[/이미지 00]","제목");
assert.equal((positioned.html.match(/data-image-position/g)||[]).length,3); assert.ok(positioned.plain.includes("마지막 문장")); assert.ok(!positioned.plain.includes("생성 지시")); assert.ok(positioned.plain.indexOf("가격 8억원")<positioned.plain.indexOf("[이미지 위치: 01"));
console.log("PASS: image positions survive copy in order without generation instructions");
