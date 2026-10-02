const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const modulePromise = import("../lib/apartment-trade-matching.mjs");
const complex = (name, lot, id = name, options = {}) => ({
  id, name, normalized_name: name,
  region_code: "41285", legal_dong: "장항동",
  address: "경기도 고양시 일산동구 장항동 " + lot + " " + name,
  use_date: "1994-10-01", ...options,
});
const trade = (name, jibun, options = {}) => ({
  name, regionCode:"41285", legalDong:"장항동", jibun,
  buildYear:1994, ...options,
});

test("lot parser requires an explicit address lot directly after legal dong", async () => {
  const mod=await modulePromise;
  assert.equal(mod.extractApartmentLot("경기도 고양시 일산동구 장항동 881 장항호수마을2단지현대","장항동"),"881");
  assert.equal(mod.extractApartmentLot("경기도 고양시 장항동 산 12-3 현대아파트","장항동"),"산12-3");
  assert.equal(mod.normalizeCadastralLot(" 0881 "),"881");
  assert.equal(mod.extractApartmentLot("경기도 고양시 장항동 현대아파트","장항동"),null);
  assert.equal(mod.extractApartmentLot("경기도 고양시 장항동 1576- 현대아파트","장항동"),null);
});

test("MOLIT 호수마을(현대) matches K-apt 장항호수마을2단지현대 by unique lot 881", async () => {
  const mod=await modulePromise;
  const complexes=[
    complex("장항호수마을2단지현대","881","correct"),
    complex("호수마을1단지대우","902","other"),
  ];
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881"),complexes)?.id,"correct");
  assert.equal(mod.matchApartmentTrade(trade("호수마을(대우)","902",{buildYear:1996}),[
    {...complexes[1], use_date:"1996-02-01"}
  ])?.id,"other");
});

test("different known lots and build years never get linked by matching names", async () => {
  const mod=await modulePromise;
  const c=complex("호수마을현대","881","correct");
  assert.equal(mod.matchApartmentTrade(trade("호수마을현대","902"),[c]),null);
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881",{buildYear:2006}),[c]),null);
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881",{legalDong:"마두동"}),[c]),null);
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881",{regionCode:"41281"}),[c]),null);
});

test("shared-lot subdivisions remain unmatched unless one name exactly disambiguates", async () => {
  const mod=await modulePromise;
  const c=[complex("1단지현대","881","one"),complex("2단지현대","881","two")];
  assert.equal(mod.matchApartmentTrade(trade("호수마을(현대)","881"),c),null);
  assert.equal(mod.matchApartmentTrade(trade("2단지현대","881"),c)?.id,"two");
});

test("name fallback works when no reliable parcel, but never overrides conflicting recorded parcel", async () => {
  const mod=await modulePromise;
  const c=complex("백두마을동성","", "lot-unknown", {address:"경기도 군포시 산본동 백두마을동성",region_code:"41410",legal_dong:"산본동"});
  assert.equal(mod.matchApartmentTrade(trade("백두마을동성","1087",{regionCode:"41410",legalDong:"산본동",buildYear:1995}),[c])?.id,"lot-unknown");
  const known={...c,address:"경기도 군포시 산본동 1090 백두마을동성"};
  assert.equal(mod.matchApartmentTrade(trade("백두마을동성","1087",{regionCode:"41410",legalDong:"산본동",buildYear:1995}),[known]),null);
  assert.equal(mod.matchApartmentTrade(trade("백두마을동성",null,{regionCode:"41410",legalDong:"산본동",buildYear:1995}),[known])?.id,"lot-unknown");
});

test("selected real complex never inherits sample apartment prices when trades cannot be linked", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  const page=fs.readFileSync("app/apartment-bulk/page.tsx","utf8");
  assert.match(server,/matchApartmentTrade\(/);
  assert.doesNotMatch(server,/matchComplex\(aptName/);
  assert.match(page,/selectedComplexNeedsMatching/);
  assert.match(page,/실거래 원본 매칭 대기/);
  assert.doesNotMatch(page,/recent \? formatWon\(recent\) : SAMPLE\.recentPrice/);
  assert.doesNotMatch(page,/representativeArea \? "전용 " \+ detail\.representativeArea : SAMPLE\.area/);
});


test("representative snapshot and most recent deal share the same area and six-point window", () => {
  const server=fs.readFileSync("lib/apartment-server.ts","utf8");
  const detail=fs.readFileSync("app/api/apartment/complexes/[id]/route.ts","utf8");
  assert.match(server,/new Set\(monthLabels\(7\)\)/);
  assert.match(server,/const validMonthly = repMonthly\.filter\(\(r\) => r\.median_price != null\)\.slice\(-6\)/);
  assert.match(detail,/\.gte\("year_month", startMonth\)/);
  assert.match(detail,/\.eq\("area_group", areaGroup\)/);
  assert.match(detail,/areaGroup == null\s*\?\s*\{ data: null, error: null \}/);
});
