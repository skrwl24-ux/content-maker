const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
async function paramma(){return import("../lib/paramma-naver-export.mjs");}

async function api(){return import("../lib/jibssuk-naver-rich-export.mjs");}

test("Jibssuk reuses Paramma's 32/30/19/15 Naver block styles and exact paragraph spacers",async()=>{
  const {buildJibssukNaverRichArticle,buildJibssukNaverRichBody}=await api();
  const title="과천 디에트르, 왜 다시 공급됐을까?";
  const body=[
    "청약이 끝난 줄 알았던 단지에서 또 2가구가 나왔습니다.",
    "",
    "## 왜 다시 나왔을까?",
    "",
    "**이번에 나온 가구는 이전 공급분과 달랐습니다.**",
    "",
    "분양가 8억 5,715만원",
    "총액 8억 9,862만원",
    "",
    "자료 기준일: 2026년 10월 30일"
  ].join("\n");
  const article=buildJibssukNaverRichArticle(title,body);
  const bodyOnly=buildJibssukNaverRichBody(body);
  assert.match(article.html,/font-size:32px/);
  assert.match(article.html,/font-size:30px/);
  assert.match(article.html,/font-size:19px/);
  assert.match(article.html,/font-size:15px/);
  assert.match(article.html,/왜 다시 나왔을까\?/);
  assert.match(article.html,/이번에 나온 가구는 이전 공급분과 달랐습니다/);
  assert.match(article.html,/<br>/);
  assert.match(article.plain,/과천 디에트르, 왜 다시 공급됐을까\?/);
  assert.match(article.plain,/왜 다시 나왔을까\?/);
  assert.doesNotMatch(article.plain,/##|\*\*/);
  assert.doesNotMatch(article.bodyHtml,/과천 디에트르, 왜 다시 공급됐을까\?/);
  assert.equal(article.bodyPlain,bodyOnly.plain);
  assert.equal(article.bodyHtml,bodyOnly.html);
  assert.equal((article.html.match(/font-size:32px/g)||[]).length,1);
  assert.match(article.html,/Nanum Gothic/);
  assert.ok(article.blockCount>=4);
});

test("Paramma parser remains backward-compatible and Jibssuk body mode preserves first sentence as 15px body",async()=>{
  const {buildJibssukNaverRichBody}=await api();
  const raw="이것은 제목이 아니라 첫 본문 문장입니다.\n\n## 다음 내용\n\n더 자세한 설명.";
  const {parseParammaNaverBlog,parammaNaverRichHtml,parammaNaverPlainText}=await paramma();
  const old=parseParammaNaverBlog(raw);
  assert.equal(old[0].type,"title");
  const parsed=parseParammaNaverBlog(raw,{includeTitle:false});
  assert.equal(parsed[0].type,"body");
  assert.equal(parsed[1].type,"subheading");
  assert.equal(parammaNaverRichHtml(parsed),buildJibssukNaverRichBody(raw).html);
  assert.equal(parammaNaverPlainText(parsed),buildJibssukNaverRichBody(raw).plain);
  assert.doesNotMatch(buildJibssukNaverRichBody(raw).html,/font-size:32px/);
});

test("Legacy Jibssuk square heading markers map to a 30px heading",async()=>{
  const {buildJibssukNaverRichBody}=await api();
  const formatted=buildJibssukNaverRichBody("■ 왜 다시 공급됐을까?\n\n실제 계약 취소로 재공급됐습니다.");
  assert.match(formatted.html,/font-size:30px/);
  assert.match(formatted.plain,/왜 다시 공급됐을까\?/);
  assert.doesNotMatch(formatted.plain,/■/);
});

test("Naver rich output escapes unsafe source strings and handles empty input",async()=>{
  const {buildJibssukNaverRichBody,buildJibssukNaverRichArticle}=await api();
  const raw="오늘은 <img src=x onerror=alert(1)> & 일반 글이에요.\n\nhttps://example.com?a=1&b=2";
  const x=buildJibssukNaverRichBody(raw);
  assert.match(x.html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(x.html,/&amp; 일반 글/);
  assert.match(x.html,/https:\/\/example.com\?a=1&amp;b=2/);
  assert.doesNotMatch(x.html,/<img\b/);
  assert.doesNotMatch(x.html,/<script\b/);
  assert.deepEqual(buildJibssukNaverRichBody(""),{plain:"",html:""});
  assert.equal(buildJibssukNaverRichArticle("","").plain,"");
});

test("Final manuscript offers complete styled Naver copy, body-only, and unchanged plain-text fallback",()=>{
  const panel=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  const prompt=fs.readFileSync("lib/jibssuk-simple-workflow.mjs","utf8");
  assert.match(panel,/buildJibssukNaverRichArticle\(articleTitle,articleBody\)/);
  assert.match(panel,/new ClipboardItem/);
  assert.match(panel,/"text\/html":new Blob/);
  assert.match(panel,/"text\/plain":new Blob/);
  assert.match(panel,/navigator\.clipboard\.writeText\(plain\)/);
  assert.match(panel,/네이버 전체 서식 복사 \(제목 포함\)/);
  assert.match(panel,/본문만 서식 복사/);
  assert.match(panel,/네이버 붙여넣기 미리보기/);
  assert.match(panel,/본문 복사 \(일반 텍스트\)/);
  assert.match(panel,/제목 복사/);
  assert.match(panel,/전체 복사/);
  assert.match(prompt,/JSON title 필드에 한 번만 작성/);
  assert.match(prompt,/## 소제목/);
  assert.match(prompt,/\*\*강조 문장 전체\*\*/);
});


test("three-column real estate Markdown table remains a compact comparable HTML table",async()=>{
  const {buildJibssukNaverRichArticle}=await api();
  const body="화서주공4단지 · 전용 59.98㎡\n\n"+
    "| 계약일 | 층 | 매매가격 |\n|---|---|---|\n"+
    "| 2026.10.07 | 2층 | 8억 1,000만원 |\n"+
    "| 2026.10.14 | 2층 | 8억 6,200만원 |\n"+
    "| 2026.10.20 | 10층 | 9억 9,000만원 |\n\n"+
    "**최저·최고 거래가격 차이 1억 8,000만원**";
  const article=buildJibssukNaverRichArticle("화서주공4단지 매매 비교",body);
  assert.equal(article.tables.length,1);
  assert.deepEqual(article.tables[0].headers,["계약일","층","매매가격"]);
  assert.deepEqual(article.tables[0].rows,[
    ["2026.10.07","2층","8억 1,000만원"],
    ["2026.10.14","2층","8억 6,200만원"],
    ["2026.10.20","10층","9억 9,000만원"]
  ]);
  assert.equal((article.html.match(/<table\b/g)||[]).length,1);
  assert.equal((article.html.match(/<tr>/g)||[]).length,4);
  assert.match(article.html,/font-size:15px/);
  assert.match(article.html,/8억 1,000만원/);
  assert.match(article.html,/9억 9,000만원/);
  assert.match(article.html,/1억 8,000만원/);
  assert.doesNotMatch(article.bodyHtml,/font-size:32px/);
  assert.match(article.bodyPlain,/2026\.10\.20  \|  10층  \|  9억 9,000만원/);
});

test("wide five-column table is divided into compact tables with first column repeated and zero data loss",async()=>{
  const {buildJibssukNaverRichArticle}=await api();
  const data=[
    ["단지","계약일","면적","층","가격"],
    ["화서주공4단지","2026.10.07","59.98㎡","2층","8억 1,000만원"],
    ["화서주공3단지","2026.10.19","84.79㎡","10층","11억 2,000만원"]
  ];
  const raw="비교 자료\n\n"+data[0].join(" | ")+"\n---|---|---|---|---\n"+
    data.slice(1).map(row=>row.join(" | ")).join("\n")+"\n\n원문 기준일: 2026.10.30";
  const r=buildJibssukNaverRichArticle("집값쓱",raw);
  assert.equal(r.tables.length,2);
  assert.deepEqual(r.tables[0].headers,["단지","계약일","면적"]);
  assert.deepEqual(r.tables[1].headers,["단지","층","가격"]);
  assert.equal((r.html.match(/<table\b/g)||[]).length,2);
  const reconstructed=r.tables[0].rows.map((row,i)=>[...row,...r.tables[1].rows[i].slice(1)]);
  assert.deepEqual(reconstructed,data.slice(1));
  for(const row of data.slice(1))for(const cell of row)assert.ok(r.bodyHtml.includes(cell));
  assert.match(r.html,/비교표 1 · 2\/2/);
  assert.match(r.bodyPlain,/8억 1,000만원/);
  assert.match(r.bodyPlain,/11억 2,000만원/);
});

test("malformed comparison table is never silently converted with dropped cells",async()=>{
  const {buildJibssukNaverRichArticle}=await api();
  const original="| 계약일 | 층 | 매매가격 |\n|---|---|---|\n| 10.07 | 2층 | 8억 1,000만원 |\n| 10.20 | 10층 | 9억 9,000만원 | 추가열";
  const r=buildJibssukNaverRichArticle("검증",original);
  assert.equal(r.tables.length,0);
  assert.match(r.bodyPlain,/10\.07 \| 2층 \| 8억 1,000만원/);
  assert.match(r.bodyPlain,/추가열/);
});

test("escaped pipes in comparison data remain within the original table cell",async()=>{
  const {buildJibssukNaverRichArticle}=await api();
  const original="| 단지 | 가격 |\n|---|---|\n| A\\|B단지 | 11억 2,000만원 |";
  const r=buildJibssukNaverRichArticle("검증",original);
  assert.equal(r.tables.length,1);
  assert.deepEqual(r.tables[0].rows,[["A|B단지","11억 2,000만원"]]);
  assert.match(r.bodyHtml,/A\|B단지/);
});

test("table-image fallback is explicit, page-bounded, and does not replace the real comparison table",()=>{
  const panel=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  const prompt=fs.readFileSync("lib/jibssuk-simple-workflow.mjs","utf8");
  assert.match(panel,/TABLE_IMAGE_ROWS=12/);
  assert.match(panel,/saveNaverTablePng/);
  assert.match(panel,/canvas\.toBlob/);
  assert.match(panel,/PNG 저장/);
  assert.match(panel,/별도 등록/);
  assert.match(panel,/네이버에서 표가 깨질 때/);
  assert.match(panel,/naverRich\.tables/);
  assert.match(panel,/네이버 전체 서식 복사 \(제목 포함\)/);
  assert.match(prompt,/2~3개 열로 비교/);
  assert.match(prompt,/4열 이상의 비교표/);
  assert.match(prompt,/모든 수치를 임의 삭제/);
});
