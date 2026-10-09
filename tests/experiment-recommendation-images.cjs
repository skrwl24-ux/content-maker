const { test } = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../lib/experiment-recommendation-images.mjs");

const report = {
  mode: "subjective_recommendation_comparison",
  title: "We asked 3 AIs for the best country to live in",
  commonQuestion: "As of October 2026, choose ONE country best to live in. Explain three strengths, two tradeoffs, and uncertainty.",
  independentReplies: [
    { provider: "ChatGPT", verbatimResponse: [
      "Final answer: Denmark.",
      "",
      "I favor strong public services and long-term well-being.",
      "",
      "Three strengths",
      "1. Strong social safety net",
      "2. Work-life balance",
      "3. Social trust",
      "",
      "Two tradeoffs",
      "1. High taxes and living costs",
      "2. Long dark winters and language barriers",
      "",
      "Uncertainty",
      "Choices depend on income, family, health, climate and language."
    ].join("\n") },
    { provider: "Claude", verbatimResponse: [
      "**Final answer: Norway**",
      "No browsing was used.",
      "**Criteria:** High wages, institutions, safety and healthcare.",
      "**Three strengths**",
      "1. Strong institutions",
      "2. Economic security",
      "3. Nature and low crime",
      "**Two tradeoffs**",
      "1. High cost of living and taxes",
      "2. Dark winters and social integration",
      "**Uncertainty**",
      "- Moving there is not equally easy for everyone."
    ].join("\n") },
    { provider: "Gemini", verbatimResponse: [
      "**Final Answer:** Switzerland",
      "### Reasoning & Criteria",
      "* **Criteria:** Political stability, economic prosperity, healthcare.",
      "* **Three Strengths:**",
      "1. Economic stability",
      "2. Healthcare and clean environment",
      "3. Stable governance",
      "* **Two Tradeoffs:**",
      "1. Extremely high cost of living",
      "2. Harder integration",
      "* **Uncertainty:** Best depends on career goals and values."
    ].join("\n") },
  ]
};

function generate(buildRecommendationImagePrompt, id) {
  return buildRecommendationImagePrompt({ title: report.title, labReport: JSON.stringify(report) }, { id });
}

test("only subjective recommendation reports activate the special image slots", async () => {
  const { parseRecommendationReport, buildRecommendationImagePrompt } = await load();
  assert.equal(parseRecommendationReport(JSON.stringify({ mode: "scored_benchmark" })), null);
  assert.equal(parseRecommendationReport("plain legacy report"), null);
  assert.equal(buildRecommendationImagePrompt({ labReport: "plain legacy report" }, { id: "02" }), null);
  assert.equal(parseRecommendationReport(JSON.stringify(report)).mode, "subjective_recommendation_comparison");
});

test("00 is a square hook, 01 holds only the common prompt", async () => {
  const { buildRecommendationImagePrompt: build } = await load();
  const hero = generate(build, "00");
  const setup = generate(build, "01");
  assert.match(hero, /1254×1254/);
  assert.doesNotMatch(hero, /Final answer: Denmark/);
  assert.match(setup, /choose ONE country/);
  assert.doesNotMatch(setup, /Final answer: Denmark/);
  assert.match(setup, /1600×900/);
});

test("02 names only recorded recommendations, 03 only criteria and strengths", async () => {
  const { buildRecommendationImagePrompt: build } = await load();
  const choices = generate(build, "02");
  assert.match(choices, /ChatGPT — 실제 기록된 선택:\s*Denmark/);
  assert.match(choices, /Claude — 실제 기록된 선택:\s*Norway/);
  assert.match(choices, /Gemini — 실제 기록된 선택:\s*Switzerland/);
  assert.doesNotMatch(choices, /High taxes and living costs/);
  const reasons = generate(build, "03");
  assert.match(reasons, /Strong social safety net/);
  assert.match(reasons, /Political stability, economic prosperity, healthcare/);
  assert.match(reasons, /High wages, institutions, safety and healthcare/);
  assert.doesNotMatch(reasons, /Extremely high cost of living/);
});

test("04 isolates tradeoffs; 05 isolates personal uncertainty and checklist", async () => {
  const { buildRecommendationImagePrompt: build } = await load();
  const risks = generate(build, "04");
  const takeaway = generate(build, "05");
  assert.match(risks, /High taxes and living costs/);
  assert.match(risks, /Extremely high cost of living/);
  assert.doesNotMatch(risks, /Strong social safety net/);
  assert.match(takeaway, /Choices depend on income, family, health, climate and language/);
  assert.match(takeaway, /Moving there is not equally easy for everyone/);
  assert.match(takeaway, /Best depends on career goals and values/);
  assert.doesNotMatch(takeaway, /Extremely high cost of living/);
  assert.match(takeaway, /NO three-country cards/);
});

test("no fabricated answer for missing providers or malformed evidence", async () => {
  const { buildRecommendationImagePrompt: build } = await load();
  const incomplete = { ...report, independentReplies: [report.independentReplies[0]] };
  const result = build({ labReport: JSON.stringify(incomplete) }, { id: "02" });
  assert.match(result, /Claude: NOT RECORDED/);
  assert.match(result, /Gemini: NOT RECORDED/);
  assert.equal(build({ labReport: "{}" }, { id: "03" }), null);
  assert.equal(build({ labReport: JSON.stringify(report) }, { id: "99" }), null);
});


test("legacy text schedule transfers are normalized into evidence-scoped slots", async () => {
  const { buildRecommendationImagePrompt: build, parseRecommendationReport: parse } = await load();
  const legacy = [
    "AI COMPARISON — NO SINGLE OBJECTIVE RIGHT ANSWER",
    "Topic: Best country to live",
    "Exact identical question: Choose ONE country and explain the strengths and tradeoffs.",
    "Date: 2026-10-10",
    "Human comments (only when recorded): Not recorded",
    "Human choice: Not recorded",
    "ChatGPT (model not recorded)\nSelected: Denmark\nSelection rationale: social security\nOriginal answer:\nFinal answer: Denmark.\nThree strengths\n1. Safety net\nTwo tradeoffs\n1. High taxes\nUncertainty\nChoice depends on personal priorities.",
    "Claude (model not recorded)\nSelected: Norway\nSelection rationale: stability\nOriginal answer:\nFinal answer: Norway.\nThree strengths\n1. High wages\nTwo tradeoffs\n1. High living costs\nUncertainty\nMoving is hard.",
    "Gemini (model not recorded)\nSelected: Switzerland\nSelection rationale: prosperity\nOriginal answer:\nFinal Answer: Switzerland\nThree strengths\n1. Economic opportunity\nTwo tradeoffs\n1. High costs\nUncertainty\nPersonal fit matters.",
    "LIMIT: One experiment does not prove an overall model ranking."
  ].join("\n\n");
  const parsed = parse(legacy);
  assert.equal(parsed?.mode, "subjective_recommendation_comparison");
  assert.equal(parsed?.independentReplies?.[1]?.recordedChoice, "Norway");
  const get = id => build({ title: "Best country to live", labReport: legacy }, { id });
  assert.match(get("01"), /Choose ONE country/);
  assert.doesNotMatch(get("01"), /Selected: Denmark/);
  assert.match(get("02"), /Switzerland/);
  assert.doesNotMatch(get("02"), /High taxes/);
  assert.match(get("04"), /High living costs/);
  assert.doesNotMatch(get("04"), /Safety net/);
  assert.match(get("05"), /Personal fit matters/);
  assert.doesNotMatch(get("05"), /High living costs/);
});

test("non-travel comparison does not tell image generator to draw country scenery", async () => {
  const { buildRecommendationImagePrompt: build } = await load();
  const reportForPhones = {
    ...report, title: "Which smartphone is best?",
    commonQuestion: "As of October 2026 pick the best smartphone",
    independentReplies: [
      { provider: "ChatGPT", verbatimResponse: "Final answer: Phone A" },
      { provider: "Claude", verbatimResponse: "Final answer: Phone B" },
      { provider: "Gemini", verbatimResponse: "Final answer: Phone C" }
    ],
  };
  const prompt = build({ labReport: JSON.stringify(reportForPhones) }, { id: "00" });
  assert.doesNotMatch(prompt, /travel-magazine cover/i);
  assert.match(prompt, /정사각형/);
});
