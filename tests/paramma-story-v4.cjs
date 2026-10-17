const test = require("node:test");
const assert = require("node:assert/strict");
const topic = { category: "생활 속 궁금증", title: "자동차 배터리 방전과 교체", brief: "긴급출동 후 교체 판단", thumbnailHook: "교체해야 하나?" };
async function v4() { return import("../lib/paramma-story-v4.mjs"); }
async function imageParser() { return import("../lib/paramma-image-plans.mjs"); }

test("V3 active slots remain unchanged while V4 offers 6-8 images", async () => {
  const {parammaActiveSlots,parammaV4Count} = await v4();
  assert.deepEqual(parammaActiveSlots("v3",7),["00","01","02"]);
  assert.deepEqual(parammaActiveSlots("v3",7,true),["00","01","02","03"]);
  assert.deepEqual(parammaActiveSlots("v4",6),["00","01","02","03","04","05"]);
  assert.deepEqual(parammaActiveSlots("v4",8),["00","01","02","03","04","05","06","07"]);
  assert.equal(parammaV4Count(19),7);
});

test("V4 article prompt is short-paragraph, distinct-scene and marker-based", async () => {
  const {buildParammaV4ArticlePrompt} = await v4();
  const prompt = buildParammaV4ArticlePrompt(topic,7,"2026-10-17");
  assert.match(prompt,/사진 중심 스토리형\(V4\)/);
  assert.match(prompt,/2~3줄/);
  assert.match(prompt,/\[이미지 06\]/);
  assert.doesNotMatch(prompt,/\[이미지 07\]/);
  assert.match(prompt,/사진 검색 추천/);
  assert.match(prompt,/AI 설명 이미지 추천/);
  assert.match(prompt,/공식기관/);
});

test("V4 image prompts are one scene each, preserve thumbnail and body formats", async () => {
  const {buildParammaV4ImagePrompt} = await v4();
  const thumbnail = buildParammaV4ImagePrompt(topic,"00","대표 배터리");
  const photo = buildParammaV4ImagePrompt(topic,"06","견적을 확인하는 장면");
  assert.match(thumbnail,/1254×1254/);
  assert.match(photo,/1600×900/);
  assert.match(photo,/견적을 확인하는 장면/);
  assert.doesNotMatch(photo,/썸네일 짧은 문구/);
});

test("V4 marker validation ignores notes and identifies missing body images", async () => {
  const {parammaV4MissingMarkers} = await v4();
  const source = "# 제목\n" + ["01","02","03","04","05"].map((id) => "[이미지 " + id + "]\n짧은 설명").join("\n") +
    "\n[이미지 기획 메모]\n- 이미지 06: 내용에 [이미지 06] 포함\n- 이미지 07: 생략";
  assert.deepEqual(parammaV4MissingMarkers(source,7),["06"]);
});

test("image planning parser recognizes extra slots without mistaking body markers for plans", async () => {
  const {extractParammaImagePlans} = await imageParser();
  const raw = "# 제목\n[이미지 04]\n본문 설명\n[이미지 기획 메모]\n- 이미지 04: 배터리 점검\n- 이미지 05: 교체 비교\n- 이미지 06: 비용\n- 이미지 07: 주의사항\n[검수 메모]\n- 이미지 04: 무시";
  const result = extractParammaImagePlans(raw);
  assert.equal(result["04"], "배터리 점검");
  assert.equal(result["05"], "교체 비교");
  assert.equal(result["06"], "비용");
  assert.equal(result["07"], "주의사항");
});
