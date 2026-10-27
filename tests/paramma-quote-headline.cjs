const test = require("node:test");
const assert = require("node:assert/strict");
async function quote() { return import("../lib/paramma-quote-headline.mjs"); }

test("quoted headline rules protect real quotations and require early reader payoff", async () => {
  const {PARAMMA_QUOTED_HEADLINE_RULES, appendParammaQuotedHeadlineRules} = await quote();
  assert.match(PARAMMA_QUOTED_HEADLINE_RULES,/실제 발언/);
  assert.match(PARAMMA_QUOTED_HEADLINE_RULES,/검색 키워드/);
  assert.match(PARAMMA_QUOTED_HEADLINE_RULES,/첫 3~5줄/);
  assert.match(PARAMMA_QUOTED_HEADLINE_RULES,/최종 제목 1개만/);
  assert.match(PARAMMA_QUOTED_HEADLINE_RULES,/끝까지 숨겨/);
  const once = appendParammaQuotedHeadlineRules("글을 작성해줘.");
  assert.equal(appendParammaQuotedHeadlineRules(once), once);
});

test("use confirmed lead quote as thumbnail hook, preserving optional fallback", async () => {
  const {extractParammaQuotedThumbnailHook} = await quote();
  assert.equal(extractParammaQuotedThumbnailHook("# “쌀에 거미줄이?” 쌀통 속 하얀 실, 씻어 먹어도 될까?\n\n본문", "쌀 속 하얀 실"),"“쌀에 거미줄이?”");
  assert.equal(extractParammaQuotedThumbnailHook("**“왜 이럴까?” 냉장고의 소음**", "냉장고 소음"),"“왜 이럴까?”");
  assert.equal(extractParammaQuotedThumbnailHook("# 곰팡이는 왜 생길까?\n\n“이게 뭐지?”","기존 썸네일"), "기존 썸네일");
  assert.equal(extractParammaQuotedThumbnailHook("“” 아무 의미 없음","원래 문구"), "원래 문구");
});
