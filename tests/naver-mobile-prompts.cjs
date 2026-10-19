const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("TOP3 and general apartment instructions require mobile-safe article copy", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/apartment-bulk/page.tsx"), "utf8");
  assert.match(source, /contentType === "top3"/);
  assert.match(source, /\$\{top3MobileRules\}/);
  assert.match(source, /공동 순위는 묶어 생략하지 말고/);
  assert.match(source, /\[모바일 가독성 · 네이버 붙여넣기 형식\]/);
  assert.match(source, /단지명, 숫자와 단위/);
});

test("Paramma V4 prompt alternates image markers and short mobile explanations", async () => {
  const { buildParammaV4ArticlePrompt } = await import("../lib/paramma-story-v4.mjs");
  const prompt = buildParammaV4ArticlePrompt({
    category: "생활 속 궁금증", title: "금속 숟가락이 더 차가운 이유",
    brief: "손에서 금속으로 이동하는 열", thumbnailHook: "왜 더 차갑지?",
  }, 7, "2026-10-19");
  assert.match(prompt, /\[이미지 NN\] 표시는 독립된 줄/);
  assert.match(prompt, /문단 사이에는 실제 빈 줄/);
  assert.match(prompt, /숫자/);
});

test("apartment V4 prompt preserves verified facts and adds mobile scene structure", async () => {
  const { buildApartmentV4ArticlePrompt } = await import("../lib/apartment-photo-story-v4.mjs");
  const prompt = buildApartmentV4ArticlePrompt({
    name: "검증 단지", region: "경기도", area: "84㎡", monthly: [],
  }, 7);
  assert.match(prompt, /독립된 소제목 → \[이미지 NN\]/);
  assert.match(prompt, /숫자와 단위/);
  assert.match(prompt, /단지 동일성·원본 월별 실거래 연결/);
});

test("presale prompt requests short paragraphs without breaking names or amounts", async () => {
  const { makePresaleArticlePrompt } = await import("../lib/apartment-presale.mjs");
  const prompt = makePresaleArticlePrompt("검증 분양", "공고 확인 필요", "2026-10-19");
  assert.match(prompt, /한 문단 1~2개의 짧은 문장/);
  assert.match(prompt, /주택형·금액 단위 중간을 쪼개지 말 것/);
  assert.match(prompt, /공고 확인 필요/);
});
