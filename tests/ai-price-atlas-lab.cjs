const test = require("node:test");
const assert = require("node:assert/strict");

const helpers = () => import("../lib/ai-price-atlas-lab.mjs");

test("fixture has exactly five independent seeded arithmetic errors", async () => {
  const { LAB_ISSUES, LAB_PDF_PAGES } = await helpers();
  assert.equal(LAB_ISSUES.length, 5);
  assert.equal(new Set(LAB_ISSUES.map((i) => i.id)).size, 5);
  assert.equal(LAB_PDF_PAGES.length, 2);
  assert.ok(LAB_ISSUES.every((issue) => issue.page === 1 || issue.page === 2));
  assert.equal(80 * 3, 240);
  assert.equal(15 * 24, 360);
  assert.equal(600 + 240 + 450 + 480 + 360 + 90, 2220);
  assert.equal(500 + 110 + 90, 700);
  assert.equal(91 / 100 * 100, 91);
  assert.deepEqual(LAB_ISSUES.map((issue) => issue.corrected),
    ["USD 240.00", "USD 360.00", "USD 2,220.00", "USD 700.00", "91%"]);
});

test("generates a structurally valid two-page PDF with correct xref byte position", async () => {
  const { buildLabPdf } = await helpers();
  const pdfBytes = buildLabPdf();
  const pdf = new TextDecoder().decode(pdfBytes);
  assert.ok(pdfBytes.length > 1500);
  assert.ok(pdf.startsWith("%PDF-1.4\n"));
  assert.match(pdf, /\/Type \/Pages \/Kids \[4 0 R 6 0 R\] \/Count 2/);
  assert.equal((pdf.match(/\/Type \/Page \/Parent/g) || []).length, 2);
  assert.match(pdf, /Gel pens/);
  assert.match(pdf, /Monitor stands/);
  assert.match(pdf, /Reported on-time delivery rate/);
  const offset = pdf.match(/startxref\n(\d+)\n%%EOF\n$/);
  assert.ok(offset, "startxref must appear at the end of the PDF");
  assert.equal(pdf.slice(Number(offset[1]), Number(offset[1]) + 4), "xref");
  assert.deepEqual(Array.from(buildLabPdf()), Array.from(pdfBytes), "PDF bytes must be reproducible");
});

test("common prompt does not reveal five planted answers or hand out hints", async () => {
  const { makeLabPrompt, makeLabAnswerKey } = await helpers();
  const prompt = makeLabPrompt();
  assert.match(prompt, /two-page business report/);
  assert.match(prompt, /Do not assume a fixed number of mistakes/);
  assert.doesNotMatch(prompt, /\bfive\b|2,220|240\.00|91%/);
  const key = makeLabAnswerKey();
  assert.match(key, /five intentionally planted numerical errors/);
  assert.match(key, /USD 2,220\.00/);
  assert.match(key, /FALSE|MISSED|PARTIAL/i);
});

test("unreviewed response is never scored as a validated comparison", async () => {
  const { newLabRun, scoreLabRun, makeLabReport } = await helpers();
  const r = newLabRun("chatgpt", "2026-10-05");
  r.model = "Fixture model";
  r.plan = "Free";
  r.response = "This is a full-length sample response from the provider, but not yet scored.";
  assert.equal(scoreLabRun(r).complete, false);
  assert.equal(scoreLabRun(r).unreviewed, 5);
  assert.match(makeLabReport({ chatgpt: r }, "2026-10-05"), /INCOMPLETE \/ UNVERIFIED/);
  assert.match(makeLabReport({ chatgpt: r }, "2026-10-05"), /Completed provider runs: 0\/3/);
});

test("manual five-issue verdicts with false-positive confirmation form one complete run", async () => {
  const { newLabRun, LAB_ISSUES, scoreLabRun, makeLabReport } = await helpers();
  const run = newLabRun("claude", "2026-10-05");
  run.model = "Specific-model-version";
  run.plan = "Paid";
  run.response = "Here are the original findings and corrected figures identified from the supplied report.";
  run.verdicts = Object.fromEntries(LAB_ISSUES.map((issue, i) => [issue.id, i < 3 ? "found" : i === 3 ? "partial" : "missed"]));
  run.falsePositives = 1;
  assert.equal(scoreLabRun(run).complete, false, "default zero or manually typed count must not imply reviewed");
  run.falsePositivesReviewed = true;
  assert.deepEqual(scoreLabRun(run), { found: 3, partial: 1, missed: 1, unreviewed: 0, falsePositives: 1, complete: true });
  const report = makeLabReport({ claude: run }, "2026-10-05");
  assert.match(report, /Correctly found: 3\/5 \| Partial: 1\/5 \| Missed: 1\/5 \| False positives: 1/);
  assert.match(report, /Completed provider runs: 1\/3/);
  assert.match(report, /Gemini: INCOMPLETE \/ UNVERIFIED/);
});

test("blog-writing request enforces no fake model rankings, prices, or missing tests", async () => {
  const { makeLabBloggerPrompt } = await helpers();
  const prompt = makeLabBloggerPrompt({}, "2026-10-05");
  assert.match(prompt, /synthetic two-page arithmetic\/PDF test/);
  assert.match(prompt, /Do not claim you tested any missing\/incomplete provider/);
  assert.match(prompt, /operator's manual verdict/);
  assert.match(prompt, /\[BLOGGER_HTML\]/);
});
