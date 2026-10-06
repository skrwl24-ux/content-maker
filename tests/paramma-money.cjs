const test = require("node:test");
const assert = require("node:assert/strict");

async function api() {
  return import("../lib/paramma-money.mjs");
}

test("parses tagged money candidates and sorts by total score", async () => {
  const { parseParammaMoneyCandidates, moneyCandidateScore } = await api();
  const raw = `설명
[MONEY_JSON]
{"candidates":[
  {"category":"생활 속 궁금증","title":"A","thumbnailHook":"A?","brief":"A 설명","intent":"비용","action":"비용 확인","keywords":["가격"],"whyNow":"지금","expiresAt":"상시","moneyScore":3,"timelinessScore":2,"fitScore":4,"sourceUrls":["https://example.com/a"]},
  {"category":"신기한 우리 몸","title":"B","thumbnailHook":"B?","brief":"B 설명","intent":"신청","action":"예약","mainKeyword":"독감 예방접종 비용","subKeywords":["무료대상","예약"],"actionQuestions":["무료 대상인가?"],"faqQuestions":["예약 없이 가능한가?"],"keywords":["무료대상"],"whyNow":"이번 달","expiresAt":"2026-10-31","moneyScore":5,"timelinessScore":5,"fitScore":5,"sourceUrls":["https://example.com/b"]}
]}
[/MONEY_JSON]`;
  const items = parseParammaMoneyCandidates(raw);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "B");
  assert.equal(items[0].mainKeyword, "독감 예방접종 비용");
  assert.deepEqual(items[0].subKeywords, ["무료대상", "예약"]);
  assert.deepEqual(items[0].actionQuestions, ["무료 대상인가?"]);
  assert.deepEqual(items[0].faqQuestions, ["예약 없이 가능한가?"]);
  assert.equal(moneyCandidateScore(items[0]), 15);
  assert.equal(items[1].category, "생활 속 궁금증");
});

test("falls back invalid category and intent safely", async () => {
  const { parseParammaMoneyCandidates } = await api();
  const items = parseParammaMoneyCandidates(JSON.stringify({
    candidates: [{
      category: "재테크",
      title: "테스트",
      thumbnailHook: "테스트?",
      brief: "설명",
      intent: "광고",
      moneyScore: 99,
      timelinessScore: 0,
      fitScore: 3
    }]
  }));
  assert.equal(items[0].category, "생활 속 궁금증");
  assert.equal(items[0].intent, "비교");
  assert.equal(items[0].moneyScore, 5);
  assert.equal(items[0].timelinessScore, 1);
});

test("rejects malformed or incomplete results", async () => {
  const { parseParammaMoneyCandidates } = await api();
  assert.deepEqual(parseParammaMoneyCandidates("not json"), []);
  assert.deepEqual(parseParammaMoneyCandidates('{"candidates":[{"title":"제목만"}]}'), []);
});

test("research prompt encodes 7 plus 3 strategy and action intents", async () => {
  const { buildParammaMoneyResearchPrompt } = await api();
  const prompt = buildParammaMoneyResearchPrompt({
    date: "2026. 10. 06.",
    queueTitles: ["기존 글"],
    historyTitles: ["발행한 글"]
  });
  assert.match(prompt, /일반 호기심형 7개 \+ 수익형 행동 검색형 3개/);
  assert.match(prompt, /신청방법, 홈페이지, 모바일/);
  assert.match(prompt, /mainKeyword/);
  assert.match(prompt, /actionQuestions/);
  assert.match(prompt, /faqQuestions/);
  assert.match(prompt, /MONEY_JSON/);
  assert.match(prompt, /기존 글/);
  assert.match(prompt, /발행한 글/);
});
