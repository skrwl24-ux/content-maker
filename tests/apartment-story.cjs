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
  await assert.rejects(parse("철쭉 축제를 조사했습니다."), /조사 결과를 인식하지/);
});

test("recovers GPT output with an unescaped quote and multiline source URL", async () => {
  const input = [
    "조사 후보가 있습니다.",
    "[STORY_JSON]",
    '{"candidates":[{"title":"빛누리아트홀 공연",',
    '"kind":"지역 문화",',
    '"facts":"실제 확인한 공연 일정과 관람 안내.",',
    '"connection":"해당 단지와 생활권 연결을 재확인해야 합니다.",',
    '"bridge":"입지를 둘러보면 "오늘의 소신" 공연 같은 문화생활도 눈에 들어옵니다. 정확한 일정을 확인하세요.",',
    '"sourceTitle":"빛누리아트홀 공지",',
    '"sourceUrl":"https://www.example.org/sub/no_notice.php?',
    'board_mode=view&board_no=116&board_page=1",',
    '"sourceDate":"2026-09-21",',
    '"eventDate":"2026-10-31 17:00",',
    '"timing":"예정",',
    '"communityNote":"일부 공개 게시글에서 공연 관련 질문을 보았습니다."}]}',
    "[/STORY_JSON]",
  ].join("\n");
  const candidates = await parse(input);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].bridge, /"오늘의 소신"/);
  assert.match(candidates[0].sourceUrl, /board_no=116/);
  assert.equal(candidates[0].eventDate, "2026-10-31 17:00");
});

test("accepts fenced JSON and an omitted closing STORY_JSON marker", async () => {
  const candidate = {...example, title:"같은 생활권의 공원"};
  const fence = String.fromCharCode(96).repeat(3);
  const body = fence + "json\n" + JSON.stringify({ candidates: [candidate] }) + "\n" + fence;
  assert.equal((await parse("[STORY_JSON]\n" + body)).length, 1);
});

test("recovers missing commas between GPT-generated fields", async () => {
  const broken = [
    "[STORY_JSON]",
    '{"candidates":[{"title":"공원 행사"',
    '"kind":"생활권"',
    '"facts":"행사 안내를 공식 페이지에서 확인했습니다."',
    '"connection":"단지와의 실질적 거리는 추가 확인 필요."',
    '"bridge":"주변 생활권을 보면 공원 행사가 있습니다."',
    '"sourceTitle":"공식 페이지"',
    '"sourceUrl":"https://www.example.org/events"',
    '"sourceDate":"2026-10-01"',
    '"eventDate":"2026-10-08"',
    '"timing":"예정"',
    '"communityNote":"없음"}]}',
    "[/STORY_JSON]",
  ].join("\n");
  const result = await parse(broken);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "공원 행사");
});

test("never turns a source-free recovered story into a selectable candidate", async () => {
  const invalid = '[STORY_JSON]{"candidates":[{"title":"소문","facts":"부풀려진 주장","connection":"가깝다고 주장","bridge":"연결문장","sourceUrl":"http://example.org/"}]}[/STORY_JSON]';
  await assert.rejects(parse(invalid), /HTTPS 원문 주소/);
});

test("keeps legitimate empty results even if JSON includes extra trailing comma", async () => {
  assert.deepEqual(await parse('[STORY_JSON]{ "candidates": [], }[/STORY_JSON]'), []);
});


test("V3 research includes distinct rules for bulk, school and mega without defaulting to festivals", async () => {
  const mod = await import("../lib/apartment-story.mjs");
  const base = {name:"테스트 아파트",region:"경기 테스트시",dataSummary:"최근 6개월 월 대표가격과 거래량",previousTopics:"통학 이야기"};
  const bulk = mod.makeApartmentV3PlanningPrompt({...base,mode:"bulk"});
  const school = mod.makeApartmentV3PlanningPrompt({...base,mode:"school"});
  const mega = mod.makeApartmentV3PlanningPrompt({...base,mode:"mega"});
  assert.match(bulk, /축제부터 찾지 말 것/);
  assert.match(bulk, /네이버 검색/);
  assert.match(bulk, /통학 이야기/);
  assert.match(school, /32~35평형/);
  assert.match(school, /학교 배정/);
  assert.match(mega, /단일 관리단지\/블록 합산/);
  assert.match(mega, /34평대/);
  for (const item of [bulk,school,mega]) {
    assert.match(item, /\[STORY_JSON\]/);
    assert.match(item, /visualMode/);
    assert.match(item, /visualFacts/);
  }
});

test("V3 candidate preserves editorial topic, story kick and visual mode", async () => {
  const input = {
    candidates:[{
      ...example,
      topic:"실거래 변화와 아이들 생활권은?",
      kick:"공개 커뮤니티의 통학 질문을 공식 정보로 다시 확인",
      visualMode:"map-hybrid",
      visualFacts:"정확한 학교·공원 위치가 확인되면 지도에만 반영",
    }]
  };
  const result=await parse("[STORY_JSON]"+JSON.stringify(input)+"[/STORY_JSON]");
  assert.equal(result.length,1);
  assert.equal(result[0].topic,input.candidates[0].topic);
  assert.equal(result[0].visualFacts,input.candidates[0].visualFacts);
  assert.equal(result[0].visualMode,"map-hybrid");
  assert.ok(result[0].sourceUrl.startsWith("https://"));
});

test("V3 approved body/visual share topic while map mode avoids invented geography", async () => {
  const mod=await import("../lib/apartment-story.mjs");
  const plan={...(await parse(JSON.stringify({candidates:[example]})))[0],
    topic:"실거래와 지역 생활의 연결",
    kick:"학군 질문을 정확히 확인",
    visualMode:"map-hybrid",
    visualFacts:"공식 학교 안내 자료의 시설명"
  };
  const body=mod.makeApprovedStoryBlock(plan);
  const visual=mod.makeApprovedStoryVisualPrompt(plan,{mode:"school",name:"테스트 학군",region:"테스트시"});
  assert.match(body,/실거래와 지역 생활의 연결/);
  assert.match(body,/가격 변동 원인으로/);
  assert.match(visual,/실거래와 지역 생활의 연결/);
  assert.match(visual,/가짜 위치 지도\/경로/);
  assert.match(visual,/본문 이미지 03/);
  assert.doesNotMatch(body,/닉네임:/);
});

test("V3 parser preserves existing V2 story research as safe fallbacks", async () => {
  const result = await parse("[STORY_JSON]"+JSON.stringify({candidates:[example]})+"[/STORY_JSON]");
  assert.equal(result.length,1);
  assert.equal(result[0].topic,example.title);
  assert.equal(result[0].kick,example.facts);
  assert.equal(result[0].visualMode,"map-hybrid");
});
