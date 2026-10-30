const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

async function api(){return import("../lib/jibssuk-naver-rich-export.mjs");}

test("Naver rich paste preserves the exact article text and formats existing headings, bold and spacing",async()=>{
  const {buildJibssukNaverRichBody}=await api();
  const body=[
    "청약이 끝난 아파트에서 다시 2가구가 나왔습니다.",
    "",
    "■ 왜 다시 나왔을까?",
    "",
    "4월과 이번 동호수를 비교하면 겹치지 않습니다.",
    "",
    "202동 1501호",
    "기본 분양가 8억 5,715만원",
    "합계 8억 9,862만원",
    "",
    "두 차례 공급은 **서로 다른 가구**입니다.",
    "",
    "자료 기준일: 2026년 10월 30일",
    "출처"
  ].join("\n");
  const {plain,html}=buildJibssukNaverRichBody(body);
  assert.equal(plain,body);
  assert.match(html,/<h3[^>]+>왜 다시 나왔을까\?<\/h3>/);
  assert.match(html,/<strong[^>]+>202동 1501호<\/strong>/);
  assert.match(html,/<strong[^>]+>합계 8억 9,862만원<\/strong>/);
  assert.match(html,/<strong[^>]+>서로 다른 가구<\/strong>/);
  assert.match(html,/<br>/);
  assert.match(html,/margin:0 0 20px/);
  assert.match(html,/자료 기준일: 2026년 10월 30일/);
  assert.match(html,/출처<\/h3>/);
  assert.match(html,/font-size:16px/);
});
test("Naver rich paste escapes unsafe content, does not invent headlines and leaves unmarked text unchanged",async()=>{
  const {buildJibssukNaverRichBody}=await api();
  const article="오늘은 <img src=x onerror=alert(1)> & 일반 글이에요.\n\n평범한 설명.\n\nhttps://example.com?a=1&b=2";
  const x=buildJibssukNaverRichBody(article);
  assert.equal(x.plain,article);
  assert.doesNotMatch(x.html,/<img\b/);
  assert.doesNotMatch(x.html,/<script\b/);
  assert.match(x.html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(x.html,/&amp; 일반 글/);
  assert.match(x.html,/https:\/\/example.com\?a=1&amp;b=2/);
  assert.equal((x.html.match(/<h3\b/g)||[]).length,0);
  assert.deepEqual(buildJibssukNaverRichBody(""),{plain:"",html:""});
});
test("Final manuscript editor has an HTML clipboard option with a plain-text fallback and keeps old controls",()=>{
  const panel=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  assert.match(panel,/buildJibssukNaverRichBody\(articleBody\)/);
  assert.match(panel,/new ClipboardItem/);
  assert.match(panel,/"text\/html":new Blob/);
  assert.match(panel,/"text\/plain":new Blob/);
  assert.match(panel,/navigator\.clipboard\.writeText\(naverRich\.plain\)/);
  assert.match(panel,/네이버 서식 복사/);
  assert.match(panel,/네이버 본문 서식 미리보기/);
  assert.match(panel,/본문 복사 \(일반 텍스트\)/);
  assert.match(panel,/제목 복사/);
  assert.match(panel,/전체 복사/);
});
