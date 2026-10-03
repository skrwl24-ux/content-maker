const test = require("node:test");
const assert = require("node:assert/strict");

async function helpers() {
  return import("../lib/apartment-presale.mjs");
}

test("presale writing prompt follows evidence-first benchmarked structure", async () => {
  const { makePresaleArticlePrompt } = await helpers();
  const prompt = makePresaleArticlePrompt(
    "고덕강일3단지 본청약",
    "공식 공고 확인 전 · 과거 추정값은 확정가격과 다름",
    "2026-10-04"
  );
  assert.match(prompt, /고덕강일3단지 본청약/);
  assert.match(prompt, /2026-10-04/);
  assert.match(prompt, /공식 공고 확인 전/);
  assert.match(prompt, /금회 신규 공급 물량/);
  assert.match(prompt, /확정\/예정\/과거 추정치\/미확인/);
  assert.match(prompt, /핵심 POINT/);
  assert.match(prompt, /\[분양 핵심 POINT\]/);
  assert.match(prompt, /\[\/분양 핵심 POINT\]/);
  assert.match(prompt, /짧은 목차/);
  assert.match(prompt, /이 단지만의 킥/);
  assert.match(prompt, /이미지 00/);
  assert.match(prompt, /이미지 01/);
  assert.match(prompt, /이미지 02/);
  assert.doesNotMatch(prompt, /고덕강일.*3억\s*5,500/);
});

test("presale images are fixed to one square cover and two landscape cards", async () => {
  const { makePresaleImagePlan } = await helpers();
  const images = makePresaleImagePlan();
  assert.deepEqual(images.map((item) => item.slot), ["00", "01", "02"]);
  assert.deepEqual(images.map((item) => item.kind), ["thumbnail", "summary", "flow"]);
  assert.deepEqual(images.map(({width,height}) => [width,height]), [[1254,1254],[1600,900],[1600,900]]);
  assert.ok(images.every((item) => item.tableIndex === null));
});

test("individual presale image prompts do not infer unconfirmed prices or fake actual aerial imagery", async () => {
  const { makePresaleImagePlan, makePresaleImagePrompt } = await helpers();
  const plan = makePresaleImagePlan();
  const sample = "총 1,305세대. 신규 물량은 모집공고 확인 필요. 과거 추정가격만 알려져 있음.";
  const prompts = plan.map((item) => makePresaleImagePrompt(item, "고덕강일3단지", sample, "단지 공식 전경의 사용권 미확인"));
  assert.ok(prompts.every((p) => p.includes(sample)));
  assert.ok(prompts.every((p) => p.includes("1장만")));
  assert.ok(prompts.every((p) => p.includes("추정/예정/기준일")));
  assert.match(prompts[0], /실제 모습이라고 속이는/);
  assert.match(prompts[1], /이번 신규 공급/);
  assert.match(prompts[2], /토지임대부/);
  assert.equal(new Set(prompts).size, 3);
});
