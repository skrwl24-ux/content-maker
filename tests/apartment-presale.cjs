const test = require("node:test");
const assert = require("node:assert/strict");

async function helpers() {
  return import("../lib/apartment-presale.mjs");
}

test("presale writing prompt follows evidence-first benchmarked structure", async () => {
  const { makePresaleArticlePrompt } = await helpers();
  const prompt = makePresaleArticlePrompt(
    "고덕강일3단지 본청약",
    "공식 공고 확인 전 · 과거 추정값은 확정가격과 다름",
    "2026-10-04"
  );
  assert.match(prompt, /고덕강일3단지 본청약/);
  assert.match(prompt, /2026-10-04/);
  assert.match(prompt, /공식 공고 확인 전/);
  assert.match(prompt, /금회 신규 공급 물량/);
  assert.match(prompt, /확정\/예정\/과거 추정치\/미확인/);
  assert.match(prompt, /핵심 POINT/);
  assert.match(prompt, /\[분양 핵심 POINT\]/);
  assert.match(prompt, /\[\/분양 핵심 POINT\]/);
  assert.match(prompt, /짧은 목차/);
  assert.match(prompt, /이 단지만의 킥/);
  assert.match(prompt, /이미지 00/);
  assert.match(prompt, /이미지 01/);
  assert.match(prompt, /이미지 02/);
  assert.doesNotMatch(prompt, /고덕강일.*3억\s*5,500/);
});

test("presale images are fixed to one square cover and two landscape cards", async () => {
  const { makePresaleImagePlan } = await helpers();
  const images = makePresaleImagePlan();
  assert.deepEqual(images.map((item) => item.slot), ["00", "01", "02"]);
  assert.deepEqual(images.map((item) => item.kind), ["thumbnail", "summary", "flow"]);
  assert.deepEqual(images.map(({width,height}) => [width,height]), [[1254,1254],[1600,900],[1600,900]]);
  assert.ok(images.every((item) => item.tableIndex === null));
});

test("individual presale image prompts do not infer unconfirmed prices or fake actual aerial imagery", async () => {
  const { makePresaleImagePlan, makePresaleImagePrompt } = await helpers();
  const plan = makePresaleImagePlan();
  const sample = "총 1,305세대. 신규 물량은 모집공고 확인 필요. 과거 추정가격만 알려져 있음.";
  const prompts = plan.map((item) => makePresaleImagePrompt(item, "고덕강일3단지", sample, "단지 공식 전경의 사용권 미확인"));
  assert.ok(prompts.every((p) => p.includes(sample)));
  assert.ok(prompts.every((p) => p.includes("1장만")));
  assert.ok(prompts.every((p) => p.includes("추정/예정/기준일")));
  assert.match(prompts[0], /실제 모습이라고 속이는/);
  assert.match(prompts[1], /이번 신규 공급/);
  assert.match(prompts[2], /토지임대부/);
  assert.equal(new Set(prompts).size, 3);
});


test("official research and independent review include provenance without inventing announcement status", async () => {
  const { makePresaleResearchPrompt, makePresaleProjectPrompt, makePresaleReviewPrompt } = await helpers();
  const input = { topic: "고덕강일3단지", dateKey: "2026-10-04", sources: "SH 공식공고 URL 후보", materials: "일정 변경은 추가 확인", facts: "[검증 결과]\n공식 모집공고 미확인", kick: "토지임대료 확인", article: "검수할 원고" };
  const research = makePresaleResearchPrompt(input);
  assert.match(research, /공식 모집공고가 없으면/);
  assert.match(research, /단지 전체 세대수 \/ 사전예약/);
  assert.match(research, /\[검증 결과\]/);
  assert.match(research, /SH 공식공고 URL 후보/);
  const writing = makePresaleProjectPrompt(input);
  assert.match(writing, /초안이며 검증 완료를 뜻하지 않습니다/);
  assert.match(writing, /토지임대료 확인/);
  assert.match(writing, /고덕강일3단지/);
  const review = makePresaleReviewPrompt(input);
  assert.match(review, /독립된 두 번째 검증자/);
  assert.match(review, /검수할 원고/);
  assert.match(review, /공식 모집공고/);
  assert.match(review, /원래의 수치를 추측해 대체하지 말고/);
});

const ARTICLE = [
  "# 고덕강일3단지 본청약 예정｜분양가와 토지임대료는?",
  "서울에서 3억대라고 소개되는 건물 분양가격이 실제 공고에서는 어떻게 정해질지 궁금합니다. 공식 모집공고 기준일에 따라 달라질 수 있습니다.",
  "[이미지 00 · 대표 이미지]",
  "[분양 핵심 POINT]",
  "- 작성 기준일 2026-10-04",
  "- 전체 단지 1,305세대 (과거 발표 자료 기준)",
  "- 신규 청약 물량은 공식 모집공고 대조 필요",
  "- 분양가는 과거 추정값과 확정값을 구분",
  "[/분양 핵심 POINT]",
  "## 목차",
  "1. 공급물량 / 2. 가격 / 3. 청약 유의사항",
  "## 왜 이 단지가 주목받을까?",
  "해당 단지는 본청약이 계획돼 있어 발표된 공급량과 신청 물량을 따로 확인해야 합니다. 공식 공고가 공개됐는지를 먼저 확인하는 것이 좋습니다.",
  "## 공급물량",
  "| 항목 | 물량 | 상태 |",
  "|---|---:|---|",
  "| 전체 | 1,305세대 | 과거 기준 |",
  "| 금회 신규 | 확인 필요 | 공고 대조 |",
  "[이미지 01 · 공급물량 핵심 카드]",
  "## 분양가와 토지임대료",
  "분양가로 알려진 가격은 과거 사전예약의 추정치입니다. 건물분양가 이외의 토지임대료는 반드시 모집공고와 확인해야 합니다.",
  "## 이 단지만의 킥",
  "토지임대부 방식에서는 건물 소유권과 별도 토지 비용의 구조를 구분해야 합니다. 월 부담을 포함해 확인하고 이를 일반 아파트 거래가격과 단순히 비교하지 않습니다.",
  "[이미지 02 · 실제 부담 구조]",
  "## 입지와 생활권",
  "통학·교통 조건은 공식 지도로 현 위치를 확인합니다.",
  "## 청약 전 확인할 것",
  "접수일과 자격, 대출조건은 공식 공고가 나온 다음 확정 상태를 대조합니다.",
  "## 최종 정리",
  "자료의 발표일과 기준일을 구분해야 실제 신청자가 확인할 항목을 알 수 있습니다.",
  "#고덕강일3단지 #고덕강일 #강동구분양 #서울분양 #토지임대부 #본청약 #공공분양 #분양정보 #청약일정",
].join("\n");

test("editorial audit preserves required structure and rejects duplicate/missing image slots", async () => {
  const { auditPresaleArticle } = await helpers();
  const good = auditPresaleArticle(ARTICLE);
  assert.equal(good.passed, true);
  assert.equal(good.tagCount, 9);
  assert.equal(good.checks.length, 11);
  assert.equal(auditPresaleArticle(ARTICLE.replace("[이미지 02 · 실제 부담 구조]", "")).passed, false);
  assert.equal(auditPresaleArticle(ARTICLE.replace("[이미지 01 · 공급물량 핵심 카드]", "[이미지 00 · 중복]")).passed, false);
  assert.equal(auditPresaleArticle(ARTICLE.replace("[/분양 핵심 POINT]", "")).passed, false);
});

test("Naver preview parser keeps POINT box and all table cells without changing numeric values", async () => {
  const { parsePresaleArticle } = await helpers();
  const blocks = parsePresaleArticle(ARTICLE);
  assert.equal(blocks[0].type, "title");
  const point = blocks.find((block) => block.type === "points");
  assert.ok(point);
  assert.match(point.text, /1,305세대/);
  const table = blocks.find((block) => block.type === "table");
  assert.ok(table);
  assert.deepEqual(table.headers, ["항목", "물량", "상태"]);
  assert.deepEqual(table.rows, [["전체", "1,305세대", "과거 기준"], ["금회 신규", "확인 필요", "공고 대조"]]);
  assert.equal(blocks.filter((block) => block.type === "image").length, 3);
  assert.equal(blocks[blocks.length - 1].type, "tags");
});
