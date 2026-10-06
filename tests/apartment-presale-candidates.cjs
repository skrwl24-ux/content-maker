const test = require("node:test");
const assert = require("node:assert/strict");

async function helpers() {
  return import("../lib/apartment-presale-candidates.mjs");
}

test("dated curated presale leads have unique IDs, precise source URLs and meaningful stages", async () => {
  const { PRESALE_CANDIDATES, PRESALE_CANDIDATE_SNAPSHOT_DATE } = await helpers();
  assert.equal(PRESALE_CANDIDATE_SNAPSHOT_DATE, "2026-10-04");
  assert.ok(PRESALE_CANDIDATES.length >= 10);
  assert.equal(new Set(PRESALE_CANDIDATES.map((item) => item.id)).size, PRESALE_CANDIDATES.length);
  assert.ok(PRESALE_CANDIDATES.every((item) => ["planned", "later", "watch", "notice", "followup"].includes(item.stage)));
  assert.ok(PRESALE_CANDIDATES.every((item) => ["서울", "경기", "인천"].includes(item.area)));
  assert.ok(PRESALE_CANDIDATES.every((item) => [item.name, item.region, item.supply, item.topic, item.kick, item.caution].every(Boolean)));
  assert.ok(PRESALE_CANDIDATES.every((item) => /^https:\/\//.test(item.sourceUrl) && /^https:\/\//.test(item.officialUrl)));
});

test("the 2026-10-04 snapshot starts in the published archive", async () => {
  const { PRESALE_CANDIDATES, PRESALE_BASELINE_PUBLISHED_IDS, getBaselinePublishedCandidates } = await helpers();
  assert.equal(PRESALE_BASELINE_PUBLISHED_IDS.length, PRESALE_CANDIDATES.length);
  assert.equal(new Set(PRESALE_BASELINE_PUBLISHED_IDS).size, PRESALE_BASELINE_PUBLISHED_IDS.length);
  assert.deepEqual(
    new Set(getBaselinePublishedCandidates().map((item) => item.id)),
    new Set(PRESALE_CANDIDATES.map((item) => item.id)),
  );
});

test("candidate selection seeds only preliminary leads and never grants fact-check approval", async () => {
  const { PRESALE_CANDIDATES, getPresaleCandidate, makePresaleCandidateSeed } = await helpers();
  for (const item of PRESALE_CANDIDATES) {
    assert.equal(getPresaleCandidate(item.id).name, item.name);
    const seed = makePresaleCandidateSeed(item.id);
    assert.equal(seed.topic, item.topic);
    assert.equal(seed.sourceStatus, "unchecked");
    assert.equal(seed.sourceReviewed, false);
    assert.equal(seed.finalReviewed, false);
    assert.equal(seed.sourceDate, "");
    assert.equal(seed.facts, "");
    assert.match(seed.materials, /2026-10-04/);
    assert.match(seed.materials, /공식 모집공고/);
    assert.match(seed.materials, /가격 조사 우선순위/);
    assert.ok(seed.materials.includes(item.sourceUrl));
    if (item.officialUrl === "https://www.applyhome.co.kr/") assert.equal(seed.sourceUrl, "");
  }
  assert.equal(makePresaleCandidateSeed("not-present"), null);
});

test("official builder facts distinguish large complexes, apt counts, new and old application", async () => {
  const { getPresaleCandidate } = await helpers();
  assert.match(getPresaleCandidate("godeok-gangil-3").supply, /신규 청약 215호 계획/);
  assert.match(getPresaleCandidate("banpo-dh-claest").supply, /5,007세대/);
  assert.doesNotMatch(getPresaleCandidate("banpo-dh-claest").topic, /5,002가구/);
  assert.match(getPresaleCandidate("gyeonggi-gwangju-lotte-2").supply, /1,249세대/);
  assert.match(getPresaleCandidate("gyeonggi-gwangju-lotte-2").kick, /1단지의 2026년 실제 모집공고/);
  assert.match(getPresaleCandidate("hyangnam-lotte-signature").supply, /1,542세대/);
  assert.match(getPresaleCandidate("forena-jije").supply, /1,098가구/);
  assert.match(getPresaleCandidate("ansan-armuse-xi").supply, /아파트 984가구 \+ 오피스텔 370실/);
  assert.match(getPresaleCandidate("junghwa-raon-centro").supply, /일반분양 113가구/);
  assert.match(getPresaleCandidate("gwanggyo-a17").supply, /지분적립형 240호 \/ 일반분양 360호/);
  assert.equal(getPresaleCandidate("incheon-gyeyang-a6").stage, "followup");
  assert.equal(getPresaleCandidate("seongnam-sangdaewon-2").stage, "watch");
});

test("fresh-discovery prompt demands web verification and does not present old snapshot as live", async () => {
  const { makePresaleDiscoveryPrompt } = await helpers();
  const prompt = makePresaleDiscoveryPrompt("2026-10-11");
  assert.match(prompt, /2026-10-11/);
  assert.match(prompt, /2026-10-04/);
  assert.match(prompt, /현재 확정 상태로 간주하면 안 됨/);
  assert.match(prompt, /SH\/서울주거포털/);
  assert.match(prompt, /검색량을 측정하지 못했으면/);
  assert.match(prompt, /근거 URL·확인일/);
  assert.match(prompt, /마감 후 분석/);
  assert.match(prompt, /이미 발행한 소재/);
  assert.match(prompt, /고덕강일3단지/);
  assert.match(prompt, /새로운 공식 모집공고/);
  assert.match(prompt, /제목만 바꿔 반복 제안하지 말 것/);
});


test("dynamic discovery candidates can seed the same production workflow", async () => {
  const { PRESALE_DISCOVERED_STORAGE_KEY, makePresaleCandidateSeedFromItem } = await helpers();
  assert.equal(PRESALE_DISCOVERED_STORAGE_KEY, "content-maker-presale-discovered-v1");
  const item = {
    id: "live-demo",
    name: "테스트 신규단지",
    region: "경기 수원시",
    area: "경기",
    stage: "planned",
    status: "모집공고 확인",
    schedule: "2026년 10월 7일",
    supply: "전체 500가구 / 금회 일반 120가구",
    supplyNote: "전체와 금회 물량 구분",
    interest: "신규 공고",
    kick: "금회 물량과 전체 규모를 나눠 본다.",
    topic: "테스트 신규단지 모집공고｜금회 120가구 확인",
    sourceUrl: "https://example.com/source",
    sourceLabel: "공식 자료",
    officialUrl: "https://example.com/official",
    officialLabel: "공식 모집공고",
    caution: "최종 공고 재확인",
  };
  const seed = makePresaleCandidateSeedFromItem(item, "2026-10-07");
  assert.equal(seed.topic, item.topic);
  assert.equal(seed.sourceUrl, item.officialUrl);
  assert.match(seed.materials, /2026-10-07/);
  assert.match(seed.materials, /테스트 신규단지/);
  assert.match(seed.materials, /대상 단지 자체의 확정·예상·거론 분양가/);
});
