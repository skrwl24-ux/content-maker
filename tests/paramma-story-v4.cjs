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
  assert.match(prompt,/한마디 제목과 읽히는 도입/);
  assert.match(prompt,/첫 3~5줄/);
});

test("V4 image prompts are one scene each, preserve thumbnail and body formats", async () => {
  const {buildParammaV4ImagePrompt} = await v4();
  const thumbnail = buildParammaV4ImagePrompt(topic,"00","대표 배터리");
  const photo = buildParammaV4ImagePrompt(topic,"06","견적을 확인하는 장면");
  assert.match(thumbnail,/1254×1254/);
  const confirmedCover = buildParammaV4ImagePrompt(topic,"00","대표 배터리","본문 설명","“또 방전됐어?”");
  assert.match(confirmedCover,/\[썸네일 짧은 문구\] “또 방전됐어\?”/);
  assert.match(thumbnail,/교체해야 하나\?/);
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

test("V4 image request prioritizes one confirmed scene without contradictory generic placeholders", async () => {
  const {buildParammaV4ImagePrompt} = await v4();
  const picture = buildParammaV4ImagePrompt(topic, "05",
    "사진 검색 추천 — 정비사가 배터리 모델명을 확인하는 모습",
    "교체 전 규격부터 확인합니다.");
  assert.match(picture,/정비사가 배터리 모델명을 확인/);
  assert.match(picture,/교체 전 규격부터 확인/);
  assert.match(picture,/사진형 장면/);
  assert.doesNotMatch(picture,/해당 슬롯의 원고와 확인된 자료/);
  assert.doesNotMatch(picture,/과도한 카드형 레이아웃/);
  const diagram = buildParammaV4ImagePrompt(topic, "02",
    "AI 설명 이미지 추천 — 배터리 점검 순서 정보 카드");
  assert.match(diagram,/절제된 정보 카드/);
  assert.doesNotMatch(diagram,/사진형 장면으로 표현한다/);
});

test("V4 article context reads its own scene without pulling in image plans or source memo", async () => {
  const {extractParammaV4ImageContext} = await v4();
  const body = [
    "# 자동차 배터리",
    "도입 안내입니다.",
    "[이미지 01]",
    "긴급출동 뒤 상태를 확인합니다.",
    "[이미지 02]",
    "충전과 교체는 다릅니다.",
    "[이미지 기획 메모]",
    "- 이미지 02: 요청서에 들어가면 안 되는 메모 반복",
    "[검수 메모]",
    "출처입니다."
  ].join("\n");
  assert.match(extractParammaV4ImageContext(body, "00"),/도입 안내/);
  assert.match(extractParammaV4ImageContext(body, "01"),/긴급출동/);
  assert.equal(extractParammaV4ImageContext(body, "02"), "충전과 교체는 다릅니다.");
  assert.doesNotMatch(extractParammaV4ImageContext(body, "02"),/요청서에 들어가면/);
});


test("V4 last image context stops at FAQ instead of including unrelated answers", async () => {
  const {extractParammaV4ImageContext} = await v4();
  const body = [
    "# 문화누리카드",
    "[이미지 07]",
    "지원금은 연말까지 사용할 수 있습니다.",
    "## 자주 묻는 질문",
    "Q. 가족 구성원마다 받을 수 있나요?",
    "A. 조건에 해당하면 받을 수 있습니다.",
    "[이미지 기획 메모]",
    "- 이미지 07: 연말 잔액 처리"
  ].join("\n");
  const excerpt = extractParammaV4ImageContext(body, "07");
  assert.match(excerpt, /지원금은 연말까지/);
  assert.doesNotMatch(excerpt, /가족 구성원/);
});
