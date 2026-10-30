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
