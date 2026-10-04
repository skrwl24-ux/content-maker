// AI Price Atlas: reproducible synthetic benchmark (no AI API, no network request).
// Versioned fixture, rubric, two-page printable PDF and editorial report utilities.

export const LAB_VERSION = "pdf-arithmetic-v1";
export const LAB_TITLE = "Can AI find five numerical errors in the same PDF?";
export const LAB_PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", label: "Claude", url: "https://claude.ai/" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/" },
];

export const LAB_ISSUES = [
  {
    id: "pens",
    page: 1,
    label: "Gel pens line total",
    reported: "80 units x USD 3.00 = USD 250.00",
    corrected: "USD 240.00",
    explanation: "80 multiplied by 3 is 240, not 250.",
  },
  {
    id: "stands",
    page: 1,
    label: "Monitor stands line total",
    reported: "15 units x USD 24.00 = USD 336.00",
    corrected: "USD 360.00",
    explanation: "15 multiplied by 24 is 360, not 336.",
  },
  {
    id: "sales",
    page: 1,
    label: "Reported sales total",
    reported: "USD 2,200.00",
    corrected: "USD 2,220.00",
    explanation: "Recompute each line: 600 + 240 + 450 + 480 + 360 + 90 = 2,220. The displayed reported line amounts add to 2,206; do not mistake those erroneous figures for the correct sales total.",
  },
  {
    id: "expenses",
    page: 2,
    label: "Operating expense total",
    reported: "USD 680.00",
    corrected: "USD 700.00",
    explanation: "Rent 500 + packaging 110 + courier costs 90 = 700.",
  },
  {
    id: "on-time",
    page: 2,
    label: "On-time delivery percentage",
    reported: "95%",
    corrected: "91%",
    explanation: "91 on-time orders out of 100 completed orders equals 91%.",
  },
];

export const LAB_PDF_PAGES = [
  [
    "MERIDIAN OFFICE SUPPLIES",
    "Q2 2026 SALES AUDIT - SYNTHETIC DATASET",
    "Benchmark ID: pdf-arithmetic-v1 | Currency: USD | Page 1 of 2",
    "---------------------------------------------------------------",
    "SALES LINE ITEMS",
    "Item                Qty     Unit price      Reported line amount",
    "A4 paper            120       5.00              600.00",
    "Gel pens             80       3.00              250.00",
    "Desk lamps           25      18.00              450.00",
    "USB hubs             40      12.00              480.00",
    "Monitor stands       15      24.00              336.00",
    "Desk trays           30       3.00               90.00",
    "---------------------------------------------------------------",
    "Reported sales total (USD):                       2,200.00",
    "",
    "AUDIT NOTES",
    "- Verify each line as quantity multiplied by unit price.",
    "- The correct sales total must use recomputed line amounts.",
    "- Values and business names are fictional and created for testing.",
    "",
    "End of page 1. See page 2 for independent operating metrics."
  ],
  [
    "MERIDIAN OFFICE SUPPLIES",
    "Q2 2026 OPERATIONS SUMMARY - SYNTHETIC DATASET",
    "Benchmark ID: pdf-arithmetic-v1 | Currency: USD | Page 2 of 2",
    "---------------------------------------------------------------",
    "OPERATING EXPENSES",
    "Rent (USD):                                          500.00",
    "Packaging (USD):                                     110.00",
    "Courier costs (USD):                                  90.00",
    "---------------------------------------------------------------",
    "Reported operating expense total (USD):             680.00",
    "",
    "DELIVERY PERFORMANCE",
    "Completed orders:                                       100",
    "Delivered on time:                                       91",
    "Reported on-time delivery rate:                         95%",
    "",
    "AUDIT NOTES",
    "- Expense total must equal the sum of its three components.",
    "- On-time rate = on-time deliveries divided by completed orders.",
    "- All values in this document are synthetic, not real business data.",
    "",
    "End of benchmark PDF."
  ],
];

function escapePdfText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Standalone PDF 1.4; no PDF library, font download or external service required.
export function buildLabPdf() {
  const encoder = new TextEncoder();
  const streams = LAB_PDF_PAGES.map((lines) => [
    "BT",
    "/F1 11 Tf",
    "46 749 Td",
    "16 TL",
    ...lines.flatMap((line) => ["(" + escapePdfText(line) + ") Tj", "T*"]),
    "ET",
  ].join("\n") + "\n");
  const streamObject = (content) =>
    "<< /Length " + encoder.encode(content).length + " >>\nstream\n" + content + "endstream";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    streamObject(streams[0]),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 7 0 R >>",
    streamObject(streams[1]),
  ];
  let pdf = "%PDF-1.4\n%AI Price Atlas synthetic benchmark\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += (index + 1) + " 0 obj\n" + body + "\nendobj\n";
  });
  const xrefStart = encoder.encode(pdf).length;
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index++) {
    pdf += String(offsets[index]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\n";
  pdf += "startxref\n" + xrefStart + "\n%%EOF\n";
  return encoder.encode(pdf);
}

export function makeLabPrompt() {
  return [
    "You are reviewing an attached synthetic two-page business report.",
    "Independently verify all arithmetic, sums, percentages and numerical consistency.",
    "For every error you find, provide: page number, line/metric, reported value, corrected value, and your calculation.",
    "Do not assume a fixed number of mistakes. Do not count a downstream error twice when explaining it.",
    "Do not invent missing numbers, and distinguish verified mistakes from uncertain observations.",
    "Answer in English using a compact table. Do not ask me for hints.",
  ].join("\n");
}

export function makeLabAnswerKey() {
  return [
    "AI PRICE ATLAS | PRIVATE ANSWER KEY | " + LAB_VERSION,
    "This fictional PDF contains exactly five intentionally planted numerical errors.",
    "Keep this file hidden from the AI systems while running the benchmark.",
    "",
    ...LAB_ISSUES.flatMap((issue, index) => [
      (index + 1) + ". Page " + issue.page + " - " + issue.label,
      "   Reported: " + issue.reported,
      "   Correct: " + issue.corrected,
      "   Why: " + issue.explanation,
    ]),
    "",
    "Scoring: FOUND requires identifying the correct location, the original issue, AND the corrected value.",
    "PARTIAL means an issue was spotted but the page/calculation/correction is missing or wrong.",
    "MISSED means it was not identified. Record unrelated false positives separately.",
    "This rubric is manually assessed by the operator, not automatically verified by another AI.",
  ].join("\n");
}

export function newLabRun(providerId, localDate) {
  return {
    providerId: providerId,
    model: "",
    plan: "",
    testedAt: localDate || "",
    response: "",
    verdicts: Object.fromEntries(LAB_ISSUES.map((item) => [item.id, "unreviewed"])),
    falsePositives: 0,
    falsePositivesReviewed: false,
    notes: "",
  };
}

export function scoreLabRun(run) {
  const verdicts = LAB_ISSUES.map((issue) => run?.verdicts?.[issue.id] || "unreviewed");
  const found = verdicts.filter((value) => value === "found").length;
  const partial = verdicts.filter((value) => value === "partial").length;
  const missed = verdicts.filter((value) => value === "missed").length;
  const falsePositives = Number(run?.falsePositives);
  const complete = Boolean(
    run && LAB_PROVIDERS.some((p) => p.id === run.providerId) &&
    String(run.model || "").trim() && String(run.plan || "").trim() && String(run.testedAt || "").trim() &&
    String(run.response || "").trim().length >= 30 &&
    verdicts.every((value) => ["found", "partial", "missed"].includes(value)) &&
    run.falsePositivesReviewed === true &&
    Number.isInteger(falsePositives) && falsePositives >= 0 && falsePositives <= 99
  );
  return { found, partial, missed, unreviewed: LAB_ISSUES.length - found - partial - missed, falsePositives, complete };
}

export function makeLabReport(runs, reportDate) {
  const lines = [
    "AI PRICE ATLAS | FIRST-HAND SYNTHETIC TEST RECORD",
    "Fixture: " + LAB_VERSION + " | Recorded on: " + (reportDate || "not specified"),
    "Method: identical two-page PDF and identical prompt; individual provider websites; manual scoring against the private answer key.",
    "Limit: a small illustrative test, NOT a representative, independently audited AI benchmark.",
    "",
    "FIXTURE AND PROMPT",
    "Five intentionally planted numerical issues across two pages.",
    makeLabPrompt(),
    "",
    "PROVIDER RECORDS",
  ];
  let completedCount = 0;
  for (const provider of LAB_PROVIDERS) {
    const run = runs?.[provider.id];
    const scored = scoreLabRun(run);
    lines.push("");
    lines.push(provider.label + ": " + (scored.complete ? "COMPLETE" : "INCOMPLETE / UNVERIFIED"));
    if (!run) continue;
    lines.push("Model: " + (run.model || "unrecorded") + " | Plan: " + (run.plan || "unrecorded") + " | Date: " + (run.testedAt || "unrecorded"));
    if (scored.complete) {
      completedCount++;
      lines.push("Correctly found: " + scored.found + "/5 | Partial: " + scored.partial +
        "/5 | Missed: " + scored.missed + "/5 | False positives: " + scored.falsePositives);
      for (const issue of LAB_ISSUES) lines.push("- Page " + issue.page + ", " + issue.label + ": " + run.verdicts[issue.id]);
      if (String(run.notes || "").trim()) lines.push("Operator evidence/notes: " + run.notes.trim());
    } else {
      lines.push("No completed score: collect the full response, model, plan, date, all five verdicts and false-positive confirmation first.");
    }
  }
  lines.push("");
  lines.push("Completed provider runs: " + completedCount + "/3. Missing or incomplete runs must never be shown as failures or used to imply a winner.");
  lines.push("Original AI responses and the exact PDF are included separately when exporting the test archive.");
  return lines.join("\n");
}

export function makeLabBloggerPrompt(runs, reportDate) {
  return [
    "Write an English first-hand AI Price Atlas Blogger post using ONLY the attached/source test evidence below.",
    "",
    makeLabReport(runs, reportDate),
    "",
    "[Editorial requirements]",
    "- This is a small synthetic two-page arithmetic/PDF test, not a scientific model ranking.",
    "- Do not claim you tested any missing/incomplete provider. Do not invent model names, screenshots, timings, prices, repeated trials or winner.",
    "- Explicitly identify the exact provider/model/plan and test date for every completed run.",
    "- Show the 5 planted mistakes with independently checkable correct answers and a fair score comparison (found, partial, missed, false positives).",
    "- Explain practical strengths and failure modes with examples from the saved responses; if verbatim evidence is needed, request the original response files rather than inventing quotes.",
    "- Link to the actual fixture, prompt and answer-key download only if the author has uploaded them; never fabricate URLs.",
    "- Distinguish the operator's manual verdict from an automatically measured result.",
    "- Clearly state that one short run is not enough to judge a model's overall quality.",
    "- Provide a useful reader takeaway focused on what work still requires human checks.",
    "- Within BLOGGER_HTML, place these six exact image markers on their own lines at relevant sections: [IMAGE 00 — Hero], [IMAGE 01 — Benchmark PDF], [IMAGE 02 — Verified results], [IMAGE 03 — An error example], [IMAGE 04 — Scoring rubric], [IMAGE 05 — Limits and takeaway].",
    "- Use real verified numbers only. Do not generate false screenshots of actual AI outputs or invented benchmarks.",
    "- Produce a curiosity-driven FINAL_TITLE, META_DESCRIPTION, SLUG, LABELS, and simple BLOGGER_HTML suitable for Blogger HTML view.",
    "- Return those sections in [FINAL_TITLE], [META_DESCRIPTION], [SLUG], [LABELS], [BLOGGER_HTML] ... [/BLOGGER_HTML] format, no markdown code fence.",
  ].join("\n");
}
