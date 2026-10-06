const test = require("node:test");
const assert = require("node:assert/strict");

async function api() {
  return import("../lib/apartment-search-plan.mjs");
}

test("parses tagged apartment SEARCH_PLAN and keeps verified numbers", async () => {
  const { parseApartmentSearchPlan } = await api();
  const raw = `설명
[SEARCH_PLAN_JSON]
{
  "hypotheses":["최근 얼마나 올랐나?","거래량도 늘었나?"],
  "searchType":"가격·거래",
  "mainKeyword":"금정퇴계2차 실거래가",
  "subKeywords":["최근 거래가","6개월 가격 변화","거래량"],
  "readerQuestions":["최근 얼마에 거래됐나?","6개월 동안 얼마나 달라졌나?"],
  "answerFirst":"최근 6개월 월 대표값은 2.72억에서 3.73억으로 달라졌습니다. 다만 최근 거래건수는 함께 확인해야 합니다.",
  "keyNumbers":[{"label":"6개월 대표값","value":"2.72억 → 3.73억","basis":"월 대표값 기준"}],
  "evidenceNotes":["개별 실거래와 월 대표값을 구분한다."],
  "sourceUrls":["https://example.com/official"],
  "checkedAt":"2026-10-06"
}
[/SEARCH_PLAN_JSON]`;
  const plan = parseApartmentSearchPlan(raw);
  assert.equal(plan.mainKeyword, "금정퇴계2차 실거래가");
  assert.equal(plan.keyNumbers[0].value, "2.72억 → 3.73억");
  assert.equal(plan.readerQuestions.length, 2);
  assert.equal(plan.checkedAt, "2026-10-06");
});

test("rejects malformed or incomplete SEARCH_PLAN", async () => {
  const { parseApartmentSearchPlan } = await api();
  assert.equal(parseApartmentSearchPlan("not json"), null);
  assert.equal(parseApartmentSearchPlan('{"mainKeyword":"실거래가"}'), null);
});

test("research prompt separates hypothesis from verified final plan", async () => {
  const { buildApartmentSearchPlanResearchPrompt } = await api();
  const prompt = buildApartmentSearchPlanResearchPrompt({
    date: "2026-10-06",
    contentType: "presale",
    topic: "상대원2구역 재개발",
    materials: "전체 4,885가구",
  });
  assert.match(prompt, /검색 가설 → 사실 검증 → 최종 SEARCH_PLAN/);
  assert.match(prompt, /확정 분양가가 없으면 '미정'에서 끝내지 말고/);
  assert.match(prompt, /3\.3㎡당/);
  assert.match(prompt, /직접 가격 신호/);
  assert.match(prompt, /핵심 숫자는 '아직 확정되지 않았다'는 이유만으로 검색을 생략하지 않는다/);
  assert.match(prompt, /ANSWER_FIRST/);
  assert.match(prompt, /SEARCH_PLAN_JSON/);
});

test("prompt block injects answer-first and reader questions", async () => {
  const { apartmentSearchPlanPromptBlock } = await api();
  const block = apartmentSearchPlanPromptBlock({
    hypotheses: [],
    searchType: "가격·거래",
    mainKeyword: "금정퇴계2차 실거래가",
    subKeywords: ["거래량"],
    readerQuestions: ["최근 얼마에 거래됐나?"],
    answerFirst: "최근 가격 흐름을 먼저 보여준다.",
    keyNumbers: [{ label: "최근 대표값", value: "3.73억", basis: "월 대표값" }],
    evidenceNotes: ["소수 거래 주의"],
    sourceUrls: [],
    checkedAt: "2026-10-06",
  });
  assert.match(block, /검증된 SEARCH_PLAN/);
  assert.match(block, /\[ANSWER_FIRST\]/);
  assert.match(block, /최근 얼마에 거래됐나/);
  assert.match(block, /3.73억/);
});
