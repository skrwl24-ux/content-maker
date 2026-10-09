const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../lib/ai-world-experiment-packet.mjs");

test("built-in fake-country fixture is complete and has exactly ten names", async () => {
  const { FAKE_COUNTRY_PACKET, canLockExperiment } = await load();
  const listed = FAKE_COUNTRY_PACKET.material.split("\n").filter(x => /^\d+\./.test(x));
  assert.equal(listed.length, 10);
  assert.equal(new Set(listed).size, 10);
  assert.match(FAKE_COUNTRY_PACKET.groundTruth, /7\. Norvessa/);
  assert.equal(canLockExperiment({ ...FAKE_COUNTRY_PACKET, sourceVerified: true }), true);
});

test("blind test prompt contains material but never discloses answer or hidden twist", async () => {
  const { buildBlindPrompt, FAKE_COUNTRY_PACKET } = await load();
  const p = buildBlindPrompt(FAKE_COUNTRY_PACKET);
  assert.match(p, /7\. Norvessa/); // a candidate name is legitimately visible
  assert.doesNotMatch(p, /invented name|correct answer must|remaining nine|UN member/i);
  assert.doesNotMatch(p, /Ground Truth|PRIVATE answer|score/i);
  assert.match(p, /10\. Nauru/);
});

test("generic packet request mandates dataset and private answer separately", async () => {
  const { buildPacketRequest } = await load();
  const p = buildPacketRequest({ title: "Test topic", hook: "One fake item" });
  assert.match(p, /ACTUAL REPRODUCIBLE TEST MATERIAL/);
  assert.match(p, /needs_verification/);
  assert.match(p, /EXPERIMENT_PACKET_JSON/);
  assert.match(p, /Do not run the experiment/);
});

test("parser accepts a tagged complete packet and rejects missing evidence or leaked key", async () => {
  const { FAKE_COUNTRY_PACKET, parseExperimentPacket } = await load();
  const good = parseExperimentPacket("[EXPERIMENT_PACKET_JSON]\n" + JSON.stringify(FAKE_COUNTRY_PACKET) + "\n[/EXPERIMENT_PACKET_JSON]");
  assert.equal(good.error, "");
  assert.equal(good.packet.testQuestion, FAKE_COUNTRY_PACKET.testQuestion);
  assert.equal(parseExperimentPacket("{}").packet, null);
  assert.equal(parseExperimentPacket(JSON.stringify({ ...FAKE_COUNTRY_PACKET, material: FAKE_COUNTRY_PACKET.groundTruth })).packet, null);
  assert.equal(parseExperimentPacket(JSON.stringify({ ...FAKE_COUNTRY_PACKET, sourceStatus: "unknown" })).packet.sourceStatus, "needs_verification");
});

test("no material or unreviewed sources means experiment cannot be locked", async () => {
  const { FAKE_COUNTRY_PACKET, canLockExperiment } = await load();
  assert.equal(canLockExperiment({ ...FAKE_COUNTRY_PACKET, sourceVerified: false }), false);
  assert.equal(canLockExperiment({ ...FAKE_COUNTRY_PACKET, material: "", sourceVerified: true }), false);
});
