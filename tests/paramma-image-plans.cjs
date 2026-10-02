const test = require("node:test");
const assert = require("node:assert/strict");

async function extract(body) {
  const { extractParammaImagePlans } = await import("../lib/paramma-image-plans.mjs");
  return extractParammaImagePlans(body);
}

test("reads the four explicit notes and stops before the source memo", async () => {
  const body = [
    "# 거미는 왜 거미줄에 붙지 않을까?",
    "[이미지 00]",
    "거미 발의 과학을 설명합니다.",
    "[이미지 01]",
    "제거 방법을 소개합니다.",
    "## 이미지 기획 메모",
    "- 이미지 00: 거미가 거미줄 위에 선 질문형 썸네일",
    "- 이미지 01: 방사실과 포획실 구조의 차이를 보여주는 설명",
    "- 이미지 02: 집 안 거미줄 제거 3단계 카드",
    "- 이미지 03: 방충망·틈새·조명 관리로 재발 줄이기",
    "## 검수 메모",
    "- 이미지 02: 잘못된 내용을 읽어서는 안 됩니다."
  ].join("\n");
  assert.deepEqual(await extract(body), {
    "00": "거미가 거미줄 위에 선 질문형 썸네일",
    "01": "방사실과 포획실 구조의 차이를 보여주는 설명",
    "02": "집 안 거미줄 제거 3단계 카드",
    "03": "방충망·틈새·조명 관리로 재발 줄이기"
  });
});

test("accepts numbered headings and bold slot labels from existing articles", async () => {
  const body = [
    "**4. 이미지 00~03 기획 메모**",
    "- **00 · 썸네일**: 거미의 전신과 물음표",
    "- **이미지 01 · 핵심 원리:** 비점착 방사실과 점착 나선실",
    "- **본문 이미지 02:** 거미줄 제거 순서",
    "- [이미지 03] 재발 방지 체크 카드",
    "**5. 검수 메모**"
  ].join("\n");
  assert.deepEqual(await extract(body), {
    "00": "썸네일: 거미의 전신과 물음표",
    "01": "핵심 원리: 비점착 방사실과 점착 나선실",
    "02": "거미줄 제거 순서",
    "03": "재발 방지 체크 카드"
  });
});

test("does not interpret article placement markers without a plan section", async () => {
  const body = [
    "거미줄은 종류마다 다릅니다.",
    "[이미지 00]",
    "[이미지 01] 이 아래는 원리 설명입니다.",
    "[이미지 02]",
    "본문 내용으로 제거 방법을 설명합니다.",
    "#거미줄 #자연"
  ].join("\n");
  assert.deepEqual(await extract(body), {});
});

test("omits optional slot 03 when the article explicitly says to omit it", async () => {
  const body = [
    "[이미지 기획 메모]",
    "- 이미지 00: 질문형 썸네일",
    "- 이미지 01: 거미 발 확대",
    "- 이미지 02: 정리 카드",
    "- 이미지 03: 생략",
    "[검수 메모]"
  ].join("\n");
  assert.deepEqual(await extract(body), {
    "00": "질문형 썸네일",
    "01": "거미 발 확대",
    "02": "정리 카드"
  });
});

test("supports a description on the line below a slot label", async () => {
  const body = [
    "### 이미지 배치 및 기획 메모",
    "- 이미지 02:",
    "  - 거미줄 제거 전 안전 확인부터 청소까지 3단계",
    "- 이미지 03: 재발 방지용 체크 카드"
  ].join("\n");
  assert.deepEqual(await extract(body), {
    "02": "거미줄 제거 전 안전 확인부터 청소까지 3단계",
    "03": "재발 방지용 체크 카드"
  });
});

test("a changed article yields its new image plan rather than stale cached text", async () => {
  const base = "[이미지 기획 메모]\n- 이미지 02: ";
  assert.equal((await extract(base + "거미줄 제거"))["02"], "거미줄 제거");
  assert.equal((await extract(base + "베란다 안전 청소"))["02"], "베란다 안전 청소");
});

test("does not mistake an image description ending in 구성 for another plan heading", async () => {
  const body = [
    "[이미지 기획 메모]",
    "- 이미지 00: 거미와 실을 대비하는 썸네일 구성",
    "- 이미지 01: 끈끈한 실과 그렇지 않은 실의 비교 구성",
    "- 이미지 02: 제거 방법 정보 카드",
    "[검수 메모]"
  ].join("\n");
  assert.equal((await extract(body))["00"], "거미와 실을 대비하는 썸네일 구성");
  assert.equal((await extract(body))["01"], "끈끈한 실과 그렇지 않은 실의 비교 구성");
});


test("recognizes the new optional 03 role label and captures its following content", async () => {
  const body = [
    "[이미지 기획 메모]",
    "- 이미지 02: 집 안 거미줄 안전하게 제거하기",
    "- 이미지 03 · 추가 실용 정보 · 예방 · 비교",
    "  - 거미줄이 다시 생기는 일을 줄이는 관리법",
    "[검수 메모]"
  ].join("\n");
  assert.deepEqual(await extract(body), {
    "02": "집 안 거미줄 안전하게 제거하기",
    "03": "추가 실용 정보 · 예방 · 비교 — 거미줄이 다시 생기는 일을 줄이는 관리법"
  });
});
