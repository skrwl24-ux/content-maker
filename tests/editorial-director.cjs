const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("common editor prioritizes reader intent and treats entertainment trends as optional and verifiable", async () => {
  const mod = await import("../lib/editorial-director.mjs");
  assert.match(mod.EDITORIAL_DIRECTOR_RULES, /독자가 무엇을 알고 싶어/);
  assert.match(mod.EDITORIAL_DIRECTOR_RULES, /방송·예능·드라마·영화/);
  assert.match(mod.EDITORIAL_DIRECTOR_RULES, /비공개 거주지/);
  assert.match(mod.EDITORIAL_DIRECTOR_RULES, /웹 검색을 실제로 수행/);
  assert.match(mod.EDITORIAL_DIRECTOR_RULES, /출처/);
});

test("source packet preserves long user notes and labels them unverified", async () => {
  const { buildEvidenceHandoff } = await import("../lib/editorial-director.mjs");
  const notes = "공식 보도 확인 필요. " + "자료".repeat(12000) + "\nhttps://example.org/source?a=1";
  const packet = buildEvidenceHandoff({
    notes,
    sourceUrls: ["https://example.org/source?a=1", "https://example.org/second", "javascript:alert(1)"],
    checkedAt: "2026-10-28",
  });
  assert.ok(packet.includes(notes));
  assert.equal(packet.split("https://example.org/source?a=1").length - 1, 2); // once in original notes, once in link inventory
  assert.match(packet, /https:\/\/example.org\/second/);
  assert.doesNotMatch(packet, /javascript:alert/);
  assert.match(packet, /미검증 상태/);
  assert.match(packet, /2026-10-28/);
});

test("shared director is wired to apartment, search plan and Paramma prompts without modifying stored articles", () => {
  const apt = fs.readFileSync("app/apartment-bulk/page.tsx", "utf8");
  const paramma = fs.readFileSync("app/paramma-bulk/page.tsx", "utf8");
  const plan = fs.readFileSync("lib/apartment-search-plan.mjs", "utf8");
  assert.match(apt, /\$\{EDITORIAL_DIRECTOR_RULES\}/);
  assert.match(apt, /buildEvidenceHandoff\(\{ notes: materials/);
  assert.match(paramma, /buildEvidenceHandoff\(\{ notes: work.searchNotes/);
  assert.match(paramma, /function articlePromptForWork/);
  assert.match(plan, /이전 조사에서 보고된 출처 URL/);
  assert.match(plan, /이전 조사 기준일/);
});

test("truncated research memo is explicitly warned, never silently presented as complete", async () => {
  const { buildApartmentSearchPlanResearchPrompt } = await import("../lib/apartment-search-plan.mjs");
  const prompt = buildApartmentSearchPlanResearchPrompt({ contentType: "tip", topic: "정책 변경", materials: "x".repeat(6000) });
  assert.match(prompt, /입력 메모 6000자 중 앞 5000자만/);
  assert.match(prompt, /원본 전체를 별도 첨부/);
});

test("search plan source URLs and check date travel to the final handoff", async () => {
  const { apartmentSearchPlanPromptBlock } = await import("../lib/apartment-search-plan.mjs");
  const packet = apartmentSearchPlanPromptBlock({
    mainKeyword: "방송에 나온 촬영 아파트",
    answerFirst: "촬영 장소는 원문 확인이 필요합니다.",
    readerQuestions: ["어디서 촬영했나?"],
    sourceUrls: ["https://example.org/press"],
    checkedAt: "2026-10-28",
  });
  assert.match(packet, /https:\/\/example.org\/press/);
  assert.match(packet, /2026-10-28/);
  assert.match(packet, /다시 열어 대조/);
});
