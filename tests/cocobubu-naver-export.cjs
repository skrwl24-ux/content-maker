const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
async function build(title,raw){
  const {buildCocobubuNaverRichArticle}=await import("../lib/cocobubu-naver-export.mjs");
  return buildCocobubuNaverRichArticle(title,raw);
}
test("cocobubu original 3-column costs table stays one native HTML table",async()=>{
  const input="# 생수 vs 정수기, 뭐가 더 나을까?\n\n2인 가구는 약 40만원입니다.\n이렇게 계산했습니다.\n\n| 구분 | 한 달 | 1년 |\n|---|---:|---:|\n| 2인 가구 | 약 3만 2천원 | 약 40만원 |\n| 4인 가구 | 약 6만 5천원 | 약 79만원 |\n\n## 비용 비교\n\n**첫해만 비교하세요.**";
  const result=await build("오래된 제목",input);
  assert.equal(result.title,"생수 vs 정수기, 뭐가 더 나을까?");
  assert.equal(result.tables.length,1);
  assert.deepEqual(result.tables[0].headers,["구분","한 달","1년"]);
  assert.deepEqual(result.tables[0].rows[1],["4인 가구","약 6만 5천원","약 79만원"]);
  assert.equal((result.html.match(/<table\b/g)||[]).length,1);
  assert.equal((result.html.match(/<tr>/g)||[]).length,3);
  assert.match(result.html,/font-size:32px/);
  assert.match(result.bodyHtml,/font-size:30px/);
  assert.match(result.bodyHtml,/2인 가구는 약 40만원입니다\.<br>이렇게 계산했습니다/);
  assert.ok(!result.bodyHtml.includes("<div style=\"font-family:'Nanum Gothic'"));
  assert.match(result.bodyPlain,/약 3만 2천원 \| 약 40만원/);
});
test("four-column table remains four columns, not split into mobile cards",async()=>{
  const input="비용을 비교했습니다.\n\n| 종류 | 1개월 | 1년 | 설명 |\n|---|---:|---:|---|\n| 생수 | 3만원 | 40만원 | 정기 구매 |\n| 정수기 | 1만원 | 12만원 | 첫해 행사 |\n\n다음 이야기";
  const result=await build("비교",input);
  assert.equal(result.tables.length,1);
  assert.equal(result.tables[0].headers.length,4);
  assert.deepEqual(result.tables[0].rows,[["생수","3만원","40만원","정기 구매"],["정수기","1만원","12만원","첫해 행사"]]);
  assert.equal((result.html.match(/<table\b/g)||[]).length,1);
  assert.equal((result.html.match(/<th /g)||[]).length,4);
  assert.ok(!result.html.includes("비교표 1 · 1/2"));
});
test("invalid width does not silently lose data; HTML input is escaped",async()=>{
  const input="| 항목 | 내용 |\n|---|---|\n| A | B | C |\n\n| X | Y |\n|---|---|\n| <script>alert(1)</script> | **안전** |";
  const r=await build("검증",input);
  assert.equal(r.tables.length,1);
  assert.match(r.bodyPlain,/A \| B \| C/);
  assert.match(r.bodyHtml,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(r.bodyHtml,/<script>/);
  assert.match(r.tables[0].html,/<strong>안전<\/strong>/);
});
test("Naver clipboard UI includes rich HTML, plain fallback and per-table actions",()=>{
  const page=fs.readFileSync("app/cocobubu-queue/page.tsx","utf8");
  assert.match(page,/buildCocobubuNaverRichArticle/);
  assert.match(page,/new ClipboardItem/);
  assert.match(page,/"text\/html"/);
  assert.match(page,/"text\/plain"/);
  assert.match(page,/네이버 전체 서식 복사 \(제목 포함\)/);
  assert.match(page,/본문만 서식 복사/);
  assert.match(page,/표 \{index \+ 1\}만 서식 복사/);
  assert.match(page,/네이버 붙여넣기 미리보기/);
  assert.match(page,/selected\.article/);
});
