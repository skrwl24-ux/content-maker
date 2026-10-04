const test = require("node:test");
const assert = require("node:assert/strict");

const grader = () => import("../lib/ai-price-atlas-auto-grade.mjs");

const TABLE_RESPONSE = [
  "I recalculated the two-page PDF and found the following inconsistencies.",
  "| Metric | Reported | Corrected |",
  "|---|---:|---:|",
  "| Gel pens | USD 250.00 | USD 240.00 |",
  "| Monitor stands | $336.00 | $360.00 |",
  "| Sales total | $2,200.00 | $2,220.00 |",
  "| Operating expense total | $680.00 | $700.00 |",
  "| On-time delivery rate | 95% | 91% |",
].join("\n");
const PROSE_RESPONSE = [
  "**Arithmetic findings from page one**",
  "Gel pens were listed at 250 but 80 x 3 = 240.",
  "Monitor stands: 15 * 24 = 360, not the displayed 336.",
  "The sales total is 2,220 using independently recalculated line amounts; not 2,200.",
  "**Page two**",
  "Total operating expenses should be $700 (500 + 110 + 90), rather than the printed $680.",
  "The on time delivery rate should equal 91 / 100 = 91%; the report says 95%.",
].join("\n");
const PAIRS_RESPONSE = [
  "Corrected values independently found in the report:",
  "- $250 -> $240",
  "- 336 => 360",
  "- 2,200 -> 2,220",
  "- 680 corrected to 700",
  "- 95% -> 91%",
].join("\n");

test("different table, prose and no-label numeric-pair responses automatically identify all five", async () => {
  const { evaluateLabAnswer, scoreAutoRun } = await grader();
  for (const source of [TABLE_RESPONSE, PROSE_RESPONSE, PAIRS_RESPONSE]) {
    const details = evaluateLabAnswer(source);
    assert.equal(details.evaluated, true);
    assert.deepEqual(details.details.map((r) => r.verdict), Array(5).fill("found"), source);
    const score = scoreAutoRun({ providerId: "gemini", response: source, model: "", plan: "", testedAt: "" });
    assert.equal(score.found, 5, source);
    assert.equal(score.complete, true, "blank model/plan never block numeric grading");
    assert.equal(score.falsePositives, null, "no unsupported zero false positives");
  }
});

test("saved manual grading fields do not alter automatic scoring of pasted reply", async () => {
  const { scoreAutoRun } = await grader();
  const run = { providerId: "chatgpt", model: "", plan: "", response: PROSE_RESPONSE,
    verdicts: { pens: "missed", stands: "missed", sales: "missed", expenses: "missed", "on-time": "missed" },
    falsePositives: 18, falsePositivesReviewed: false };
  assert.equal(scoreAutoRun(run).found, 5);
  assert.equal(scoreAutoRun(run).falsePositives, null);
});

test("mentioned correct values without an issue context are marked ambiguous, not granted full credit", async () => {
  const { evaluateLabAnswer } = await grader();
  const source = "All calculations are discussed. In an unrelated summary the isolated figures 240, 360, 2220, 700, and 91% appear with no item names or before/after mapping.";
  const result = evaluateLabAnswer(source);
  assert.equal(result.evaluated, true);
  assert.deepEqual(result.details.map((r) => r.verdict), Array(5).fill("review"));
});

test("negated correction cannot be treated as finding the proper answer", async () => {
  const { evaluateLabAnswer } = await grader();
  const source = "Gel pens: the claim that the correct value is $240 is wrong; it should actually be 250. The rest of the figures are unaddressed.";
  const result = evaluateLabAnswer(source);
  assert.equal(result.details[0].verdict, "review");
  assert.notEqual(result.details[0].verdict, "found");
});

test("PDF figures repeated without recalculating are not automatically accepted as findings", async () => {
  const { evaluateLabAnswer } = await grader();
  const source = [
    "I transcribed the report rather than auditing it:",
    "Gel pens have listed line value 250.",
    "Monitor stands list total 336.",
    "Sales total is reported as 2200.",
    "Operating expenses total is reported as 680.",
    "On-time delivery rate is reported as 95%.",
  ].join("\n");
  const result = evaluateLabAnswer(source);
  assert.equal(result.details.filter((r) => r.verdict === "found").length, 0);
});

test("unrecognized incomplete answers remain unreviewed and cannot masquerade as 0/5", async () => {
  const { evaluateLabAnswer, scoreAutoRun } = await grader();
  const result = evaluateLabAnswer("Short answer.");
  assert.equal(result.evaluated, false);
  assert.equal(scoreAutoRun({ response: "Short answer." }).unreviewed, 5);
  assert.equal(scoreAutoRun({ response: "Short answer." }).complete, false);
});

test("automatic report and Blogger instructions preserve uncertainty and source provenance", async () => {
  const { makeAutoReport, makeAutoBloggerPrompt, scoreAutoRun } = await grader();
  const a = scoreAutoRun({ providerId: "chatgpt", response: TABLE_RESPONSE });
  const b = scoreAutoRun({ providerId: "claude", response: "No clear errors. I cannot confirm these figures from the report alone. I did not recompute any values." });
  assert.equal(a.found, 5);
  assert.equal(b.found, 0);
  const records = {
    chatgpt: { providerId: "chatgpt", response: TABLE_RESPONSE, model: "", plan: "", testedAt: "2026-10-05" },
    claude: { providerId: "claude", response: "No clear errors. I cannot confirm these figures from the report alone. I did not recompute any values.", model: "", plan: "", testedAt: "2026-10-05" },
  };
  const text = makeAutoReport(records, "2026-10-05");
  assert.match(text, /Corrected-figure matches: 5\/5/);
  assert.match(text, /False positives: NOT ASSESSED/);
  assert.match(text, /not recorded/);
  assert.match(text, /NO RESPONSE \/ NOT ASSESSED/);
  const prompt = makeAutoBloggerPrompt(records, "2026-10-05");
  assert.match(prompt, /not semantic grading/);
  assert.match(prompt, /Do not announce a winner|do not announce a winner/);
  assert.match(prompt, /\[BLOGGER_HTML\]/);
});
