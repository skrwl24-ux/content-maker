const test = require("node:test");
const assert = require("node:assert/strict");
const parse = async (raw) => (await import("../lib/apartment-story.mjs")).parseApartmentStoryResearch(raw);
const example = {
  title: "인근 공원 이용 소식",
  kind: "생활권",
  facts: "공원 시설 운영 안내.",
  connection: "단지에서 접근 가능한 생활권임을 별도 확인.",
  bridge: "입지와 생활환경도 함께 살펴보겠습니다. 단지 인근에는 공원이 있습니다.",
  sourceTitle: "공식 안내",
  sourceUrl: "https://www.gunpo.go.kr/",
  sourceDate: "2026-10-01",
  eventDate: "상시",
  timing: "상시",
  communityNote: "공개 게시글에서 산책 질문이 발견됐으나 주민 전체 의견은 아님"
};
test("reads a bounded candidate and preserves source and temporal context", async () => {
  const input = "조사 결과\n[STORY_JSON]\n" + JSON.stringify({ candidates: [example] }) + "\n[/STORY_JSON]";
  const candidates = await parse(input);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourceUrl, example.sourceUrl);
  assert.equal(candidates[0].eventDate, "상시");
  assert.ok(candidates[0].connection.includes("단지"));
});
test("allows zero candidates instead of fabricating a filler story", async () => {
  assert.deepEqual(await parse('[STORY_JSON]{"candidates":[]}[/STORY_JSON]'), []);
});
test("rejects candidates without an https source and limits output to three", async () => {
  const result = await parse(JSON.stringify({candidates:[
    {...example,sourceUrl:"javascript:alert(1)"},
    example, example, example
  ]}));
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.sourceUrl.startsWith("https://")));
});
test("rejects unstructured notes instead of guessing", async () => {
  await assert.rejects(parse("철쭉 축제를 조사했습니다."), /STORY_JSON/);
});
