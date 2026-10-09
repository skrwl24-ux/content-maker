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
  assert.match(choices, /Final answer: Denmark/);
  assert.match(choices, /Final answer: Norway/i);
  assert.match(choices, /Final Answer:\*\* Switzerland/);
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
