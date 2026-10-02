const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const quality = import(pathToFileURL(path.join(__dirname,"../lib/apartment-data-quality.mjs")).href);
test("unmatched zero is not described as verified zero transactions", async () => {
  const {assessApartmentDataQuality}=await quality;
  const r=assessApartmentDataQuality({representativeArea:null,sixMonthCount:0,monthly:[]});
  assert.equal(r.matchingPending,true);
  assert.equal(r.trendReady,false);
  assert.match(r.notes[0],/실제 무거래로 단정하지/);
});
test("single-sale month and partial current month carry separate cautions", async () => {
  const {assessApartmentDataQuality}=await quality;
  const r=assessApartmentDataQuality({
    representativeArea:84,sixMonthCount:3,analysisDate:"2026-10-02",
    monthly:[{month:"2026-09",tradeCount:2,medianPrice:300000000},{month:"2026-10",tradeCount:1,medianPrice:350000000}]
  });
  assert.equal(r.trendReady,true);
  assert.deepEqual(r.singleTradeMonths,["2026-10"]);
  assert.ok(r.notes.some(v=>v.includes("진행 중인 월")));
});
test("one priced month never produces a price-trend-ready status", async () => {
  const {assessApartmentDataQuality}=await quality;
  const r=assessApartmentDataQuality({representativeArea:59,sixMonthCount:1,monthly:[{month:"2026-09",tradeCount:1,medianPrice:100}]});
  assert.equal(r.trendReady,false);
});
