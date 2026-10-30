const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

async function api(){return import("../lib/jibssuk-apartment-image-prompts.mjs");}
const SAMPLE={title:"과천 아파트 재공급, 무슨 일이?",body:"청약이 끝난 뒤 재공급 소식이 나왔습니다.\n\n원문 자료를 확인해야 합니다."};

test("apartment image slots default to thumbnail + map + data + actual environment; optional 04",async()=>{
  const {buildJibssukApartmentImagePrompts,JIBSSUK_APARTMENT_IMAGE_SIZE}=await api();
  const base=buildJibssukApartmentImagePrompts(SAMPLE);
  assert.deepEqual(JIBSSUK_APARTMENT_IMAGE_SIZE,{width:1600,height:900});
  assert.deepEqual(base.map(x=>x.slot),["00","01","02","03"]);
  assert.deepEqual(buildJibssukApartmentImagePrompts({...SAMPLE,includeExtra:true}).map(x=>x.slot),["00","01","02","03","04"]);
  assert.deepEqual(buildJibssukApartmentImagePrompts({}),[]);
  assert.ok(base.every(x=>x.prompt.includes("1600×900px")));
  assert.ok(base.every(x=>x.prompt.includes(SAMPLE.title)));
  assert.ok(base.every(x=>x.prompt.includes(SAMPLE.body)));
  assert.ok(base.every(x=>x.prompt.includes("콜라주 금지")));
});

test("thumbnail is image-first visually curious without fictional real apartment photography",async()=>{
  const {buildJibssukApartmentImagePrompts}=await api();
  const x=buildJibssukApartmentImagePrompts(SAMPLE)[0].prompt;
  assert.match(x,/그림 자체를 보고/);
  assert.match(x,/극단적 확대·부분 크롭/);
  assert.match(x,/문구가 주인공이 되지 않는다/);
  assert.match(x,/콘셉트 이미지/);
  assert.doesNotMatch(x,/1254×1254/);
});

test("map brief requires user Naver screenshot and forbids inventing walking routes or changing provided map",async()=>{
  const {buildJibssukApartmentImagePrompts}=await api();
  const map=buildJibssukApartmentImagePrompts(SAMPLE)[1];
  assert.equal(map.evidenceEntered,false);
  assert.match(map.prompt,/실제 네이버지도 캡처/);
  assert.match(map.prompt,/경로·거리·시간/);
  assert.match(map.prompt,/임의로 바꾸거나 다시 그리지 않는다/);
  assert.match(map.prompt,/가짜 지도 재현을 하지 말고/);
  const supplied=buildJibssukApartmentImagePrompts({...SAMPLE,mapEvidence:"캡처 날짜: 2026-10-30 / 화서역 1호선"} )[1];
  assert.equal(supplied.evidenceEntered,true);
  assert.match(supplied.prompt,/2026-10-30/);
  assert.match(supplied.prompt,/따로 첨부/);
});

test("chart brief distinguishes verified one-year series from recent contracts without fabricated trend",async()=>{
  const {buildJibssukApartmentImagePrompts}=await api();
  const chart=buildJibssukApartmentImagePrompts({...SAMPLE,priceEvidence:"계약일 2026-10-20 | 전용 59.98㎡ | 10층 | 9억 9,000만원 | 국토부 원문"})[2];
  assert.equal(chart.evidenceEntered,true);
  assert.match(chart.prompt,/12개월 월별 값/);
  assert.match(chart.prompt,/최근 계약의 가격 비교/);
  assert.match(chart.prompt,/빈 달을 보간하지 않는다/);
  assert.match(chart.prompt,/같은 전용면적·같은 거래 유형/);
  assert.match(chart.prompt,/거래 취소 여부/);
  assert.match(chart.prompt,/2026-10-20/);
  assert.match(chart.prompt,/9억 9,000만원/);
  assert.match(buildJibssukApartmentImagePrompts(SAMPLE)[2].prompt,/제공된 거래\/월별 원자료 없음/);
});

test("environment brief does not fake official renderings or location, optional image requires independent evidence",async()=>{
  const {buildJibssukApartmentImagePrompts}=await api();
  const [,,,life,extra]=buildJibssukApartmentImagePrompts({...SAMPLE,includeExtra:true});
  assert.match(life.prompt,/공식 조감도/);
  assert.match(life.prompt,/AI가 특정 단지의 가짜 항공 사진/);
  assert.match(life.prompt,/출처·촬영 시점/);
  assert.match(life.prompt,/필요한 공식 조감도/);
  assert.equal(extra.evidenceEntered,false);
  assert.match(extra.prompt,/04 생략/);
  const supplied=buildJibssukApartmentImagePrompts({...SAMPLE,includeExtra:true,
    lifestyleEvidence:"공식 조감도 링크와 사용권 확인",
    extraEvidence:"당첨자 재공급 공고 2026-10-27"}) ;
  assert.equal(supplied[3].evidenceEntered,true);
  assert.equal(supplied[4].evidenceEntered,true);
  assert.match(supplied[4].prompt,/2026-10-27/);
});

test("image prompts never mistake user notes for checked sources and do not auto attach image files",async()=>{
  const {buildJibssukApartmentImagePrompts}=await api();
  const result=buildJibssukApartmentImagePrompts({...SAMPLE,mapEvidence:"비확인 메모: 123분"});
  assert.ok(result.every(x=>x.prompt.includes("자동 검증")));
  assert.ok(result.every(x=>x.prompt.includes("별도 첨부")||x.prompt.includes("따로 첨부")));
  assert.match(result[1].prompt,/123분/);
  assert.match(result[1].prompt,/없는 도보시간/);
});

test("jibssuk final article screen exposes source memo and individual copy buttons without changing saved schema",()=>{
  const screen=fs.readFileSync("app/jibssuk-queue/JibssukArticleWorkflow.tsx","utf8");
  assert.match(screen,/buildJibssukApartmentImagePrompts/);
  assert.match(screen,/imageBriefs\.map/);
  assert.match(screen,/이미지 \{brief\.slot\} 요청서 복사/);
  assert.match(screen,/imageMapEvidence/);
  assert.match(screen,/imagePriceEvidence/);
  assert.match(screen,/imageLifestyleEvidence/);
  assert.match(screen,/imageExtraEnabled/);
  assert.match(screen,/글감별 저장/);
  assert.match(screen,/version:1,topic:item.title/);
  assert.match(screen,/네이버 전체 서식 복사 \(제목 포함\)/);
});
