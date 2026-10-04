// Local, deterministic first-pass grading for the fixed 2-page arithmetic fixture.
// No API calls. Explicitly avoids claiming semantic verification or false-positive counts.
import { LAB_ISSUES, LAB_PROVIDERS, LAB_VERSION, makeLabPrompt } from "./ai-price-atlas-lab.mjs";

const RULES = [
  { id: "pens", label: /\b(?:gel[\s-]*pens?|pens?\s+(?:line|amount|total))\b/gi, old: 250, correct: 240 },
  { id: "stands", label: /\b(?:monitor[\s-]*stands?|stand\s+(?:line|amount|total))\b/gi, old: 336, correct: 360 },
  { id: "sales", label: /\b(?:sales|revenue)\s+(?:total|sum|figure|amount)|\b(?:total|sum)\s+(?:sales|revenue)|recomputed\s+line\s+amounts/gi, old: 2200, correct: 2220 },
  { id: "expenses", label: /\b(?:operating\s+)?expenses?\s+(?:total|sum)|\btotal\s+(?:operating\s+)?expenses?|total\s+operating\s+costs?/gi, old: 680, correct: 700 },
  { id: "on-time", label: /\bon[\s-]*time(?:\s+(?:delivery|deliveries|rate|percentage))?|\bdeliver(?:ed|y|ies)\s+on[\s-]*time|\bdelivery\s+rate/gi, old: 95, correct: 91, percent: true },
];

function numberRegex(value, requirePercent = false) {
  const digits = value === 2220 ? "2,?220" : value === 2200 ? "2,?200" : String(value);
  const end = requirePercent ? "(?:\\s*%|\\s*(?:percent|per\\s+cent))" : "";
  return new RegExp("(?<![\\d.,])(?:\\$\\s*|USD\\s*)?" + digits + "(?:\\.0{1,2})?" + end + "(?![\\d.,])", "gi");
}
function hasNumber(value, number, percent) {
  return numberRegex(number, percent).test(value);
}
function negatedValue(segment, target) {
  const hits = [...segment.matchAll(numberRegex(target, false))];
  if (!hits.length) return false;
  return hits.every((hit) => {
    const index = hit.index || 0;
    const before = segment.slice(Math.max(0, index - 35), index);
    const after = segment.slice(index + hit[0].length, index + hit[0].length + 30);
    return /(?:not|never|isn't|is\s+not|wrong|incorrect|false|rather\s+than)\s*(?:be\s+|equal\s+)?(?:USD\s*|\$\s*)?$/i.test(before) ||
      /^\s*(?:is|was|as)\s*(?:wrong|incorrect|false|not\s+correct)/i.test(after) ||
      /(?:reported|original|wrong|incorrect)\s*(?:amount|figure|value|total|rate|number|was|is)?\s*(?:is|of|:|=)?\s*(?:USD\s*|\$\s*)?$/i.test(before);
  });
}
function excerptsByIssue(answer) {
  const lines = String(answer).normalize("NFKC").replace(/\r\n?/g, "\n")
    .replace(/[→⇒⟶]/g, " -> ").replace(/[\u200b-\u200d\ufeff]/g, "").split("\n");
  const segments = Object.fromEntries(RULES.map((rule) => [rule.id, []]));
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    const matches = [];
    for (const rule of RULES) {
      const regex = new RegExp(rule.label.source, "gi");
      for (const match of line.matchAll(regex)) {
        if (!matches.some((entry) => entry.id === rule.id && entry.index === match.index)) {
          matches.push({ id: rule.id, index: match.index || 0 });
        }
      }
    }
    matches.sort((a, b) => a.index - b.index);
    for (let n = 0; n < matches.length; n++) {
      const match = matches[n];
      const next = matches.slice(n + 1).find((item) => item.id !== match.id);
      const prior = matches.slice(0, n).some((item) => item.id !== match.id) ? "" : line.slice(0, match.index);
      let snippet = (prior + " " + line.slice(match.index, next ? next.index : undefined)).trim();
      if (!next && snippet.length < 230) {
        // Headings followed by a short 2-line Markdown row / corrected-value statement.
        for (let offset = 1; offset <= 2 && index + offset < lines.length; offset++) {
          const follow = lines[index + offset].trim();
          if (!follow || follow.length > 210) break;
          if (RULES.some((rule) => new RegExp(rule.label.source, "i").test(follow))) break;
          snippet += " " + follow;
        }
      }
      if (snippet.length > 420) snippet = snippet.slice(0, 420);
      if (!segments[match.id].includes(snippet)) segments[match.id].push(snippet);
    }
  }
  return segments;
}
function directPair(answer, rule) {
  const before = numberRegex(rule.old, Boolean(rule.percent)).source;
  const after = numberRegex(rule.correct, Boolean(rule.percent)).source;
  const connector = "(?:\\s|[*:()|,-]){0,20}(?:->|=>|should\\s+be|corrected\\s+to|instead\\s+of|rather\\s+than)(?:\\s|[*:()|,-]){0,20}";
  return new RegExp(before + connector + after, "i").exec(answer)?.[0] || "";
}
function judgeIssue(answer, rule, snippets) {
  const candidates = snippets[rule.id] || [];
  for (const excerpt of candidates) {
    const right = hasNumber(excerpt, rule.correct, Boolean(rule.percent));
    const original = hasNumber(excerpt, rule.old, Boolean(rule.percent));
    if (right && !negatedValue(excerpt, rule.correct)) {
      return { id: rule.id, verdict: "found", evidence: excerpt, explanation: "오류 항목과 올바른 수정값이 연결됨" };
    }
    if (right) {
      return { id: rule.id, verdict: "review", evidence: excerpt, explanation: "수정값이 부정문 또는 원본 수치로 등장해 자동 확정 불가" };
    }
    if (original && /(?:error|incorrect|wrong|mismatch|inconsisten|miscalculat|should|instead|mistake|오류|잘못|수정)/i.test(excerpt)) {
      return { id: rule.id, verdict: "partial", evidence: excerpt, explanation: "문제를 언급했으나 정확한 수정값 확인 불가" };
    }
  }
  const pair = directPair(answer, rule);
  if (pair) return { id: rule.id, verdict: "found", evidence: pair, explanation: "보고된 값에서 수정값으로 이어지는 고유 숫자쌍 확인" };
  if (candidates.some((part) => hasNumber(part, rule.old, Boolean(rule.percent)))) {
    return { id: rule.id, verdict: "missed", evidence: candidates[0], explanation: "잘못된 기존 값만 인용하고 수정하지 않음" };
  }
  if (candidates.length) return {
    id: rule.id, verdict: "review", evidence: candidates[0],
    explanation: "해당 항목은 언급했지만 수정값을 확실히 판독할 수 없음",
  };
  if (hasNumber(answer, rule.correct, Boolean(rule.percent))) {
    const hit = numberRegex(rule.correct, Boolean(rule.percent)).exec(answer);
    const at = hit?.index || 0;
    return {
      id: rule.id, verdict: "review",
      evidence: answer.slice(Math.max(0, at - 80), Math.min(answer.length, at + 85)).trim(),
      explanation: "정답 숫자는 있으나 어느 항목의 수정값인지 연결되지 않음",
    };
  }
  return { id: rule.id, verdict: "missed", evidence: "", explanation: "해당 수정값의 근거를 찾지 못함" };
}

export function evaluateLabAnswer(response) {
  const answer = String(response || "").trim();
  if (answer.length < 30) return {
    evaluated: false,
    details: LAB_ISSUES.map((issue) => ({ id: issue.id, verdict: "unreviewed", evidence: "", explanation: "답변을 붙여넣어 주세요" })),
  };
  const excerpts = excerptsByIssue(answer);
  return { evaluated: true, details: RULES.map((rule) => judgeIssue(answer, rule, excerpts)) };
}

export function scoreAutoRun(run) {
  const grading = evaluateLabAnswer(run?.response);
  const results = grading.details.map((item) => item.verdict);
  const found = results.filter((item) => item === "found").length;
  const partial = results.filter((item) => item === "partial").length;
  const missed = results.filter((item) => item === "missed").length;
  const uncertain = results.filter((item) => item === "review").length;
  return {
    found, partial, missed, uncertain,
    unreviewed: grading.evaluated ? 0 : LAB_ISSUES.length,
    falsePositives: null,
    evaluated: grading.evaluated,
    complete: grading.evaluated && uncertain === 0,
    details: grading.details,
  };
}

export function makeAutoReport(runs, date) {
  const lines = [
    "AI PRICE ATLAS | RULE-BASED AUTO CHECK OF THE SYNTHETIC PDF TEST",
    "Fixture: " + LAB_VERSION + " | Record date: " + (date || "not specified"),
    "Same PDF and question were used with each provider's chat site. The operator pasted the complete replies.",
    "IMPORTANT: browser-local deterministic matching of the known five figures, NOT a semantic AI judge, independent audit or representative model ranking.",
    "Ambiguous matching is held as REVIEW, not counted as a correct find or a failure.",
    "FALSE POSITIVES: NOT ASSESSED. Do not invent a count of zero.",
    "",
    "COMMON TEST QUESTION",
    makeLabPrompt(),
    "",
    "PROVIDER RESULTS",
  ];
  let assessed = 0;
  let resolved = 0;
  for (const provider of LAB_PROVIDERS) {
    const run = runs?.[provider.id];
    const score = scoreAutoRun(run);
    lines.push("");
    lines.push(provider.label + ": " + (!score.evaluated ? "NO RESPONSE / NOT ASSESSED" : score.complete ? "AUTO CHECK COMPLETED" : "PROVISIONAL — AMBIGUOUS EVIDENCE"));
    if (!run) continue;
    lines.push("Model: " + (run.model || "not recorded") + " | Plan: " + (run.plan || "not recorded") + " | Test date: " + (run.testedAt || "not recorded"));
    if (!score.evaluated) continue;
    assessed++;
    if (score.complete) resolved++;
    lines.push("Corrected-figure matches: " + score.found + "/5 | Partial: " + score.partial +
      "/5 | Not identified: " + score.missed + "/5 | Ambiguous: " + score.uncertain +
      "/5 | False positives: NOT ASSESSED");
    for (const result of score.details) {
      const issue = LAB_ISSUES.find((item) => item.id === result.id);
      lines.push("- Page " + issue.page + " / " + issue.label + ": " + result.verdict.toUpperCase() + " — " + result.explanation);
      if (result.evidence) lines.push("  Evidence: " + result.evidence.replace(/\s+/g, " ").slice(0, 360));
    }
  }
  lines.push("");
  lines.push("Replies auto-inspected: " + assessed + "/3 | All 5 items resolved: " + resolved + "/3.");
  lines.push("Do not declare an overall winner: false-positive detection and ambiguous passages were not fully verified.");
  lines.push("The original full replies, private answer key and source fixture are separate files in the evidence archive.");
  return lines.join("\n");
}

export function makeAutoBloggerPrompt(runs, date) {
  return [
    "Create an evidence-based English AI Price Atlas Blogger article using ONLY the record below.",
    "",
    makeAutoReport(runs, date),
    "",
    "[Mandatory accuracy rules]",
    "- The fixture is a synthetic two-page arithmetic report with five intentional problems. Do not present one run as a general AI model ranking.",
    "- The results are rule-based automatic extraction, not semantic grading. Do not treat REVIEW cases as zero or as discoveries.",
    "- False-positive counts were NOT ASSESSED. Do not claim zero, do not announce a winner, and do not invent model names or subscriptions that are recorded as not provided.",
    "- Include only models with actual original pasted responses. Compare named correction matches with the exact supporting passage, not unsupported reasoning.",
    "- The source PDF and full original AI responses must be consulted for any verbatim quotations; do not fabricate them.",
    "- Include an easy-to-understand 5-issue answer table and the evidence-based provider results with uncertainty visibly marked.",
    "- Never fabricate performance timing, repeat counts, paid API access or publisher file URLs.",
    "- Six single-image positions inside BLOGGER_HTML, on separate lines: [IMAGE 00 — Hero], [IMAGE 01 — Benchmark PDF], [IMAGE 02 — Verified results], [IMAGE 03 — An error example], [IMAGE 04 — Scoring rubric], [IMAGE 05 — Limits and takeaway].",
    "- Produce [FINAL_TITLE], [META_DESCRIPTION], [SLUG], [LABELS], [BLOGGER_HTML] ... [/BLOGGER_HTML] as clean Blogger HTML and metadata; no code fence.",
  ].join("\n");
}
