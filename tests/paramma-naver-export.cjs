const test = require("node:test");
const assert = require("node:assert/strict");

test("manual line breaks stay inside one body paragraph", async () => {
  const { parseParammaNaverBlog, parammaNaverPlainText, parammaNaverRichHtml } =
    await import("../lib/paramma-naver-export.mjs");
  const article = [
    "2026 도시가스 요금 감면 신청",
    "",
    "겨울 난방비를 줄이고 싶다면",
    "먼저 도시가스 고지서를 확인하세요.",
    "",
    "공급사·고객번호·경감 자격",
    "이 세 가지를 확인하는 것이",
    "신청의 시작입니다.",
    "",
    "## 자주 묻는 질문",
    "",
    "Q. 신청하면 언제부터 적용될까요?",
    "",
    "원칙적으로 신청한 다음 날부터",
    "경감이 적용됩니다.",
    "",
    "첫 달은 적용일수에 따라",
    "할인한도가 계산됩니다.",
    "",
    "#도시가스 #난방비 #다자녀",
    "",
    "---",
    "",
    "[이미지 기획 메모]",
    "- 이미지 00: 썸네일"
  ].join("\n");
  const blocks = parseParammaNaverBlog(article);
  assert.equal(blocks[0].type, "title");
  assert.equal(blocks[1].text, "겨울 난방비를 줄이고 싶다면\n먼저 도시가스 고지서를 확인하세요.");
  assert.equal(blocks[2].text, "공급사·고객번호·경감 자격\n이 세 가지를 확인하는 것이\n신청의 시작입니다.");
  assert.equal(blocks.find((b) => b.type === "subheading").text, "자주 묻는 질문");
  assert.equal(blocks.find((b) => b.type === "tags").text, "#도시가스 #난방비 #다자녀");
  assert.ok(!blocks.some((b) => b.text.includes("이미지 기획 메모") || b.text === "---"));
  const plain = parammaNaverPlainText(blocks);
  assert.match(plain, /줄이고 싶다면\r\n먼저/);
  assert.match(plain, /확인하세요\.\r\n\r\n공급사/);
  assert.ok(!plain.includes("\r\n \r\n"));
  const html = parammaNaverRichHtml(blocks);
  assert.match(html, /줄이고 싶다면<br>먼저/);
  assert.match(html, /font-size:32px/);
  assert.match(html, /font-size:30px/);
  assert.match(html, /font-size:15px/);
});

test("image markers, highlights, CRLF and HTML escaping are preserved", async () => {
  const { parseParammaNaverBlog, parammaNaverRichHtml } = await import("../lib/paramma-naver-export.mjs");
  const blocks = parseParammaNaverBlog("# 제목\r\n\r\n[이미지 01]\r\n\r\n**주의하세요**\r\n\r\n첫째 줄 < 둘째\r\n다음 줄 & 셋째");
  assert.deepEqual(blocks.map((b) => b.type), ["title", "image", "emphasis", "body"]);
  assert.equal(blocks[3].text, "첫째 줄 < 둘째\n다음 줄 & 셋째");
  const html = parammaNaverRichHtml(blocks);
  assert.match(html, /font-size:19px/);
  assert.match(html, /첫째 줄 &lt; 둘째<br>다음 줄 &amp; 셋째/);
});

test("stray end-of-line slash markers are removed without damaging URLs and dates", async () => {
  const { parseParammaNaverBlog, parammaNaverPlainText, parammaNaverRichHtml } = await import("../lib/paramma-naver-export.mjs");
  const raw = [
    "제목", "",
    "줄바꿈을 유지합니다. \\",
    "도시가스 감면 신청/",
    "고객번호를 확인하세요 /",
    "혜택이 적용됩니다. \\\\",
    "https://www.gov.kr/",
    "2026/10/20 기준",
    "취사/난방 겸용",
    "슬래시만 있는 별도 행", "/",
    "마지막 줄"
  ].join("\n");
  const blocks = parseParammaNaverBlog(raw);
  const body = blocks.filter((b) => b.type === "body").map((b) => b.text).join("\n");
  assert.match(body, /줄바꿈을 유지합니다\.\n도시가스 감면 신청\n고객번호를 확인하세요\n혜택이 적용됩니다\./);
  assert.ok(!body.includes("신청/"));
  assert.ok(!body.includes("됩니다. \\"));
  assert.ok(!body.split("\n").includes("/"));
  assert.match(body, /https:\/\/www\.gov\.kr\//);
  assert.match(body, /2026\/10\/20 기준/);
  assert.match(body, /취사\/난방 겸용/);
  assert.match(parammaNaverPlainText(blocks), /유지합니다\.\r\n도시가스/);
  assert.match(parammaNaverRichHtml(blocks), /유지합니다\.<br>도시가스/);
});
