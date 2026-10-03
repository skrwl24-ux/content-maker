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
  assert.match(prompt, /조사 중단 금지/);
  assert.match(prompt, /공고 전 \/ 접수 중 \/ 접수 마감/);
  assert.match(prompt, /접수결과·주택형별 공급가격/);
  assert.match(prompt, /인근 최근 실거래/);
  assert.match(prompt, /반복되는 미확인/);
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
  assert.match(prompts[1], /금회 신규/);
  assert.match(prompts[2], /토지임대부/);
  assert.equal(new Set(prompts).size, 3);
});


test("official research and independent review include provenance without inventing announcement status", async () => {
  const { makePresaleResearchPrompt, makePresaleProjectPrompt, makePresaleReviewPrompt } = await helpers();
  const input = { topic: "고덕강일3단지", dateKey: "2026-10-04", sources: "SH 공식공고 URL 후보", materials: "일정 변경은 추가 확인", facts: "[검증 결과]\n공식 모집공고 미확인", kick: "토지임대료 확인", article: "검수할 원고" };
  const research = makePresaleResearchPrompt(input);
  assert.match(research, /공식 모집공고가 없으면/);
  assert.match(research, /조사를 끝내지 말 것/);
  assert.match(research, /공고 전 \/ 접수 중 \/ 접수 마감/);
  assert.match(research, /예전 후보 카드/);
  assert.match(research, /최근 보도상 예정 물량/);
  assert.match(research, /기존 명칭으로 재검색/);
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
  assert.match(review, /정보 누락으로 지적/);
  assert.match(review, /POINT가 빈 항목/);
  assert.match(review, /단계·주택 유형이 뒤섞이면/);
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
  assert.equal(good.qualityWarnings.length, 1); // old fixture has only one substantive POINT number
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


// Dated editorial scenarios based on public research. These are regression inputs,
// not claims that a local unit test can independently open a live website.
const SCENARIOS = [
  {
    name: "Banpo private rebuild before official announcement",
    topic: "반포 디에이치 클래스트",
    source: "서초구 2026년 변경 고시 / 2026.09.22 주요 보도",
    facts: "공고 전. 현대건설 정정 공시상 5,007세대. 9월 보도상 일반분양 예정 1,832세대, 84㎡ 1,358세대. 11월 분양 추진, 84㎡ 예상 30~33억원은 확정 분양가가 아님.",
    point: [
      "사업규모 5,007세대(정정 공시)",
      "일반분양 예정 1,832세대(9월 보도)",
      "주력 84㎡ 1,358세대, 약 74%",
      "84㎡ 예상 30~33억원(9월 기사 추산)",
    ],
    story: "일반분양 1,832세대와 전체 사업규모 5,007세대를 혼동하면 안 됩니다. 예상 가격은 보도일과 심의 전이라는 조건을 붙여 설명합니다. 민간 재건축은 매월 토지임대료를 내는 토지임대부 주택이 아닙니다.",
  },
  {
    name: "Godeok land lease with preregistration",
    topic: "고덕강일3단지",
    source: "SH 2023년 사전예약 공고 및 2026년 공급계획 자료",
    facts: "본청약 공고 전. 전체 1,305호, 사전예약 1,090호, 계획상 신규 59㎡ 215호. 전용 49㎡는 과거 사전예약 590호, 59㎡는 500호. 토지임대부로 건물 추정 분양가와 월 토지임대료는 서로 다른 항목.",
    point: [
      "전체 1,305호(사업계획)",
      "기존 사전예약 1,090호",
      "금회 신규 59㎡ 215호 예정",
      "토지임대부: 건물가격과 월 임대료 별도",
    ],
    story: "총 1,305호가 모두 신규 물량이 아닙니다. 토지임대부는 건물 분양대금 외에 월 토지임대료를 따로 검토해야 합니다. 오래된 사전예약의 가격 추정치를 새 본청약 확정가격이라고 쓰지 않습니다.",
  },
  {
    name: "Incheon Gyeyang LH after applications close",
    topic: "인천계양 A6블록",
    source: "LH 2026.08.31 입주자모집공고·정정공고 / 2026.10.02 일반공급 접수결과 공지",
    facts: "공식 모집공고가 있는 단지. 전용 59㎡ 529세대 등 총 663세대. 일반공급 접수 2026.10.02 마감. LH 접수결과가 게시됐고 당첨자 발표는 2026.10.21.",
    point: [
      "공공분양 총 663세대(LH 모집공고)",
      "전용 59㎡ 529세대",
      "일반공급 10월 2일 접수 종료",
      "당첨자 발표 10월 21일",
    ],
    story: "10월 4일 기준 이미 접수가 끝났습니다. 신청을 독려하는 원고가 아니라 LH가 발표한 접수결과와 앞으로의 당첨·서류·계약 일정을 중심으로 다뤄야 합니다. 발표 전 당첨 결과나 경쟁률은 만들어내면 안 됩니다.",
  },
];

function scenarioArticle({ topic, point, story }) {
  return [
    "# " + topic + "｜현재 공급 규모와 핵심 일정은?",
    "[이미지 00 · 대표 이미지]",
    "이번 사업의 최신 공급 상태를 이전 안내자료와 비교해 보겠습니다. 가격과 면적별 물량은 각 정보가 발표된 날짜를 함께 살펴봐야 정확하게 이해할 수 있습니다.",
    "[분양 핵심 POINT]",
    ...point.map((line) => "- " + line),
    "[/분양 핵심 POINT]",
    "## 목차",
    "공급규모 / 분양가격과 실제 부담 / 단지 고유의 조건 / 후속 일정",
    "## 공급물량",
    story,
    "| 구분 | 기준 |",
    "|---|---|",
    "| 첫째 수치 | " + point[0] + " |",
    "| 둘째 수치 | " + point[1] + " |",
    "[이미지 01 · 공급물량 핵심 카드]",
    "## 가격과 실제 부담",
    "예정 가격과 확정 가격을 구분합니다. 필요 자금 분석은 계약금 비율을 가정한 시뮬레이션이며 실제 납부 조건이 아닙니다.",
    "## 이 단지만의 킥",
    story,
    "[이미지 02 · 실제 부담 구조]",
    "## 입지·생활권",
    "교통과 학교 정보는 공적 사업자료에서 확인한 범위에 한정해 설명합니다.",
    "## 청약 또는 후속 일정",
    "기준일에 적용되는 공고와 접수·당첨자 발표 자료를 우선합니다.",
    "#신규분양 #아파트분양 #청약정보 #분양가 #공급물량 #청약일정 #실제부담 #분양분석",
  ].join("\n");
}

test("three housing types and announcement phases keep one adaptable presale workflow", async () => {
  const { makePresaleResearchPrompt, makePresaleProjectPrompt, makePresaleReviewPrompt,
    auditPresaleArticle, parsePresaleArticle, makePresaleImagePlan, makePresaleImagePrompt } = await helpers();
  for (const item of SCENARIOS) {
    const input = { topic: item.topic, dateKey: "2026-10-04", sources: item.source, facts: item.facts, kick: item.story };
    const research = makePresaleResearchPrompt(input);
    const writing = makePresaleProjectPrompt(input);
    const article = scenarioArticle(item);
    const review = makePresaleReviewPrompt({ ...input, article });
    assert.ok(research.includes(item.topic), item.name);
    assert.ok(writing.includes(item.facts), item.name);
    assert.ok(writing.includes(item.story), item.name);
    assert.match(writing, /공고 전 \/ 접수 중 \/ 접수 마감/);
    assert.ok(review.includes(item.facts), item.name);
    assert.ok(review.includes(article), item.name);
    const audit = auditPresaleArticle(article);
    assert.equal(audit.passed, true, item.name);
    assert.deepEqual(audit.qualityWarnings, [], item.name);
    const blocks = parsePresaleArticle(article);
    assert.equal(blocks.filter((v) => v.type === "points").length, 1, item.name);
    assert.equal(blocks.filter((v) => v.type === "image").length, 3, item.name);
    assert.equal(blocks.filter((v) => v.type === "table").length, 1, item.name);
    assert.ok(blocks.some((v) => v.type === "body" && v.text.includes(item.story.slice(0, 15))), item.name);
    const images = makePresaleImagePlan().map((slot) => makePresaleImagePrompt(slot, item.topic, article, ""));
    assert.equal(images.length, 3);
    assert.ok(images.every((value) => value.includes(item.point[0])), item.name);
  }
});

test("poor POINT density is flagged without blocking sparse but sourced work", async () => {
  const { auditPresaleArticle } = await helpers();
  const placeholder = ARTICLE.replace(
    "- 전체 단지 1,305세대 (과거 발표 자료 기준)",
    "- 전체 규모 미확인",
  ).replace(
    "- 신규 청약 물량은 공식 모집공고 대조 필요",
    "- 금회 물량 확인 필요",
  );
  const audit = auditPresaleArticle(placeholder);
  assert.equal(audit.passed, true);
  assert.equal(audit.qualityWarnings.length, 2);
  assert.match(audit.qualityWarnings.join(" "), /구체적 수치/);
  assert.match(audit.qualityWarnings.join(" "), /미확인/);
});
