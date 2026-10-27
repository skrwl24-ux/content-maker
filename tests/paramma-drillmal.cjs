const test = require("node:test");
const assert = require("node:assert/strict");
const brand = () => import("../lib/paramma-drillmal.mjs");

test("Drillmal brand defaults and safe disabled mode", async () => {
  const {DEFAULT_DRILLMAL_SETTINGS, normalizeDrillmalSettings, drillmalArticleRules, drillmalImageRules} = await brand();
  assert.deepEqual(normalizeDrillmalSettings(null), DEFAULT_DRILLMAL_SETTINGS);
  const off = {...DEFAULT_DRILLMAL_SETTINGS, enabled: false};
  assert.equal(drillmalArticleRules(off), "");
  assert.equal(drillmalImageRules(off,"00"), "");
});

test("Drillmal brand keeps factual slots clear by default", async () => {
  const {DEFAULT_DRILLMAL_SETTINGS, drillmalImageApplies, drillmalImageRules} = await brand();
  assert.equal(drillmalImageApplies(DEFAULT_DRILLMAL_SETTINGS,"00"), true);
  assert.equal(drillmalImageApplies(DEFAULT_DRILLMAL_SETTINGS,"05"), true);
  assert.equal(drillmalImageApplies(DEFAULT_DRILLMAL_SETTINGS,"03"), false);
  assert.match(drillmalImageRules(DEFAULT_DRILLMAL_SETTINGS,"00"),/자동 첨부하지 않는다/);
  assert.match(drillmalImageRules(DEFAULT_DRILLMAL_SETTINGS,"05"),/드릴말 붙이기/);
});

test("Thumbnail/all modes, corner and narrative intensity are respected", async () => {
  const {normalizeDrillmalSettings, drillmalImageApplies, drillmalImageRules, drillmalArticleRules} = await brand();
  const thumb = normalizeDrillmalSettings({imageMode:"thumbnail",corner:"left", voice:"strong"});
  assert.equal(drillmalImageApplies(thumb,"05"),false);
  assert.match(drillmalImageRules(thumb,"00"),/왼쪽/);
  assert.match(drillmalArticleRules(thumb),/마무리/);
  const all = normalizeDrillmalSettings({imageMode:"all",voice:"light"});
  assert.equal(drillmalImageApplies(all,"03"),true);
  assert.match(drillmalArticleRules(all),/한 곳에서만/);
  assert.equal(normalizeDrillmalSettings({voice:"invalid",imageMode:"unsafe"}).voice,"balanced");
});
