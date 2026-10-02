const test = require("node:test");
const assert = require("node:assert/strict");

async function plan(input) {
  const { makeWorkImagePlan } = await import("../lib/work-image-plan.mjs");
  return makeWorkImagePlan(input);
}

test("three source tables yield three separate requests and five total images", async () => {
  const result = await plan([
    { heading: "금리 비교" },
    { heading: "당일 환율" },
    { heading: "생활 영향" },
  ]);
  assert.deepEqual(result.map(item => item.slot), ["00", "01", "01-2", "01-3", "02"]);
  assert.deepEqual(result.map(item => item.kind), ["thumbnail", "table", "table", "table", "flow"]);
  assert.deepEqual(result.filter(item => item.tableIndex !== null).map(item => item.tableIndex), [0, 1, 2]);
});

test("chart is requested only when its source table is identified as a time series", async () => {
  const result = await plan([
    { heading: "금리 비교" },
    { heading: "검증된 최근 1년 월별 환율", isTimeSeries: true },
  ]);
  assert.deepEqual(result.map(item => item.kind), ["thumbnail", "table", "chart", "flow"]);
  assert.equal(result[2].slot, "01-2");
  assert.equal(result[2].heading, "검증된 최근 1년 월별 환율");
});

test("without any source table, preserve the original thumbnail/summary/flow slots", async () => {
  const result = await plan([]);
  assert.deepEqual(result.map(item => item.slot), ["00", "01", "02"]);
  assert.deepEqual(result.map(item => item.kind), ["thumbnail", "summary", "flow"]);
  assert.equal(result[0].width, 1254);
  assert.equal(result[1].height, 900);
});

test("extra tables receive unique stable slots without dropping data", async () => {
  const result = await plan(Array.from({length: 7}, (_, i) => ({heading: "표 " + (i+1)})));
  assert.equal(result.length, 9);
  assert.equal(new Set(result.map(item => item.slot)).size, 9);
  assert.equal(result[7].slot, "01-7");
});
