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

test("Drillmal brand covers all slots by default when mascot PNG is registered", async () => {
  const {DEFAULT_DRILLMAL_SETTINGS, drillmalImageApplies, drillmalImageRules} = await brand();
  assert.equal(drillmalImageApplies(DEFAULT_DRILLMAL_SETTINGS,"00"), true);
  assert.equal(drillmalImageApplies(DEFAULT_DRILLMAL_SETTINGS,"05"), true);
  assert.equal(drillmalImageApplies(DEFAULT_DRILLMAL_SETTINGS,"03"), true);
  assert.equal(DEFAULT_DRILLMAL_SETTINGS.autoStamp, true);
  assert.match(drillmalImageRules(DEFAULT_DRILLMAL_SETTINGS,"00"),/자동 첨부하지 않는다/);
  assert.match(drillmalImageRules(DEFAULT_DRILLMAL_SETTINGS,"05"),/자동 합성/);
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

test("existing saved settings upgrade to auto compositing without discarding choices", async () => {
  const {normalizeDrillmalSettings, drillmalImageApplies} = await brand();
  const fromOldVersion = normalizeDrillmalSettings({enabled:true,voice:"light",imageMode:"key",corner:"left"});
  assert.equal(fromOldVersion.autoStamp,true);
  assert.equal(fromOldVersion.imageMode,"key");
  assert.equal(drillmalImageApplies(fromOldVersion,"03"),false);
  assert.equal(drillmalImageApplies(fromOldVersion,"05"),true);
  assert.equal(normalizeDrillmalSettings({enabled:true,autoStamp:false}).autoStamp,false);
  assert.equal(normalizeDrillmalSettings({imageMode:"garbage"}).imageMode,"all");
});
