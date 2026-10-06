const test = require("node:test");
const assert = require("node:assert/strict");

async function api() { return import("../lib/google-content-plan.mjs"); }

test("parses Google content plan", async () => {
  const { parseGoogleContentPlan } = await api();
  const raw = `[GOOGLE_PLAN_JSON]
{"moneyIntent":"comparison","cluster":"ChatGPT Pricing","primaryQuery":"ChatGPT Plus vs Pro","secondaryQueries":["ChatGPT Plus price","ChatGPT Pro price"],"userDecision":"Which plan should I pay for?","originalValue":"Same-date official pricing and limits comparison.","originalValueType":"official-comparison","answerFirst":"Plus is the lower-cost paid option for most users, while Pro targets heavier usage. Check current official limits before paying more.","evidenceLevel":"B","sourceUrls":["https://example.com"],"checkedAt":"2026-10-06","notes":["Limits can change."]}
[/GOOGLE_PLAN_JSON]`;
  const plan = parseGoogleContentPlan(raw);
  assert.equal(plan.primaryQuery, "ChatGPT Plus vs Pro");
  assert.equal(plan.moneyIntent, "comparison");
  assert.equal(plan.secondaryQueries.length, 2);
  assert.equal(plan.evidenceLevel, "B");
});

test("rejects incomplete plan", async () => {
  const { parseGoogleContentPlan } = await api();
  assert.equal(parseGoogleContentPlan("bad"), null);
  assert.equal(parseGoogleContentPlan('{"primaryQuery":"x"}'), null);
});

test("planning prompt includes money intent, original value and answer first", async () => {
  const { buildGoogleContentPlanPrompt } = await api();
  const prompt = buildGoogleContentPlanPrompt({
    date:"2026-10-06", title:"ChatGPT Plus vs Pro", keyword:"ChatGPT Plus vs Pro", note:"comparison"
  });
  assert.match(prompt, /MONEY INTENT/);
  assert.match(prompt, /ORIGINAL VALUE/);
  assert.match(prompt, /ANSWER FIRST/);
  assert.match(prompt, /GOOGLE_PLAN_JSON/);
});

test("article and image blocks carry plan forward", async () => {
  const { googleContentPlanBlock, googleImagePlanBlock } = await api();
  const plan = {
    moneyIntent:"comparison", cluster:"ChatGPT Pricing", primaryQuery:"ChatGPT Plus vs Pro",
    secondaryQueries:["price"], userDecision:"Which plan?", originalValue:"Official comparison",
    originalValueType:"official-comparison", answerFirst:"Answer first.", evidenceLevel:"B",
    sourceUrls:[], checkedAt:"2026-10-06", notes:[]
  };
  assert.match(googleContentPlanBlock(plan), /Primary query: ChatGPT Plus vs Pro/);
  assert.match(googleContentPlanBlock(plan), /Original value: Official comparison/);
  assert.match(googleImagePlanBlock(plan, "03"), /ORIGINAL VALUE/);
});
