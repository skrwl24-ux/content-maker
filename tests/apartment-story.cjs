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


test("V3.1 research asks for lived discovery, landmark access, source and a strict JSON sample", async () => {
  const mod = await import("../lib/apartment-story.mjs");
  const prompt = mod.makeApartmentV3PlanningPrompt({
    mode:"bulk", name:"대전 테스트아파트",region:"대전 중구",
    dataSummary:"실거래 6.5억 / 6개월 거래 흐름",
    previousTopics:"학원가", regionalHints:"성심당 본점 · 자료일 2026-09-15"
  });
  assert.match(prompt, /성심당/);
  assert.match(prompt, /discovery/);
  assert.match(prompt, /placeName/);
  assert.match(prompt, /accessSourceUrl/);
  assert.match(prompt, /storyDraft/);
  assert.match(prompt, /성심당 본점 · 자료일/);
  const sample = prompt.split("\n[STORY_JSON]\n")[1].split("\n[/STORY_JSON]\n")[0];
  assert.ok(JSON.parse(sample).candidates.length === 1);
});

test("V3.1 imports exact destination and editor's living discovery fields", async () => {
  const input = {
    candidates:[{...example,
      topic:"대전 테스트 아파트 매매 흐름",
      discovery:"단지에서 성심당 본점까지의 실제 교통 생활권을 이해할 수 있다.",
      placeName:"성심당 본점",
      accessInfo:"거리 미확인",
      accessSourceUrl:"",
      storyDraft:"가격 흐름을 살펴봤습니다. 지역 생활권에서는 성심당 본점도 알아볼 만합니다.",
      visualMode:"map-hybrid",
      visualFacts:"성심당 본점의 정확한 위치 확인 후 표시"
    }]
  };
  const [story] = await parse("[STORY_JSON]" + JSON.stringify(input) + "[/STORY_JSON]");
  assert.equal(story.placeName, "성심당 본점");
  assert.equal(story.discovery,input.candidates[0].discovery);
  assert.equal(story.storyDraft,input.candidates[0].storyDraft);
  assert.equal(story.accessSourceUrl,"");
});

test("V3.1 fact lock masks route numbers without an independent source in article AND image", async () => {
  const mod = await import("../lib/apartment-story.mjs");
  const plan = {...(await parse(JSON.stringify({candidates:[example]})))[0],
    topic:"대전의 매매 흐름과 성심당 생활권",
    discovery:"성심당 본점까지 도보 10분 안에 갈 수 있다",
    placeName:"성심당 본점",
    accessInfo:"도보 10분",
    accessSourceUrl:"",
    storyDraft:"아파트에서 성심당 본점까지 도보 10분이라고 합니다.",
    visualFacts:"성심당 본점까지 도보 10분",
  };
  const sheet = mod.makeStoryFactSheet(plan);
  const body = mod.makeApprovedStoryBlock(plan);
  const visual = mod.makeApprovedStoryVisualPrompt(plan,{mode:"bulk",
    name:"대전 테스트 아파트",region:"대전",finalStoryExcerpt:"본문에 도보 10분이라고 써 있었습니다."
  });
  assert.doesNotMatch(sheet,/10분/);
  assert.doesNotMatch(body,/10분/);
  assert.doesNotMatch(visual,/10분/);
  assert.match(sheet,/독립적인 경로 근거/);
  assert.match(visual,/이동거리·시간 미확인/);
  const sourced = {...plan,accessSourceUrl:"https://www.example.org/real-route"};
  assert.match(mod.makeStoryFactSheet(sourced),/도보 10분/);
});

test("V3.1 finished article excerpt requires the exact subject and destination", async () => {
  const mod = await import("../lib/apartment-story.mjs");
  const plan = {...(await parse(JSON.stringify({candidates:[example]})))[0],
    placeName:"성심당 본점",
  };
  const body = "대전 테스트아파트 최근 거래가격 6.5억.\n가격 흐름과 함께 성심당 본점 접근성도 살펴봅니다.\n거리는 경로 확인이 필요합니다.";
  assert.match(mod.extractStoryExcerpt(body,plan,"대전 테스트아파트"),/성심당 본점/);
  assert.equal(mod.extractStoryExcerpt(body,plan,"다른 아파트"),"");
  assert.equal(mod.extractStoryExcerpt(body,{...plan,placeName:"다른 지점"},"대전 테스트아파트"),"");
});

test("V3.1 final-copy audit catches mismatched name, missing tags, unknown travel claims", async () => {
  const mod = await import("../lib/apartment-publish-check.mjs");
  const plan = {...(await parse(JSON.stringify({candidates:[example]})))[0],
    placeName:"성심당 본점",
    accessInfo:"",
    accessSourceUrl:"",
  };
  const wrong = mod.auditApartmentArticle({
    mode:"bulk", name:"대전 테스트아파트", plan,
    body:"다른 아파트 6.5억.\n[이미지 01]\n도보 10분 거리입니다.\n[이미지 03]\n#아파트 #시세",
  });
  assert.equal(wrong.ready,true);
  assert.ok(wrong.checks.some(item => item.status === "warning" && item.label.includes("현재 대상")));
  assert.ok(wrong.checks.some(item => item.status === "warning" && item.label.includes("이미지 위치")));
  assert.ok(wrong.checks.some(item => item.status === "warning" && item.label.includes("태그")));
  assert.ok(wrong.checks.some(item => item.status === "warning" && item.label.includes("거리·시간")));
});

test("V3.1 final-copy audit recognizes three markers, seven tags, matching exact place", async () => {
  const mod = await import("../lib/apartment-publish-check.mjs");
  const plan = {...(await parse(JSON.stringify({candidates:[example]})))[0],
    placeName:"성심당 본점",
    accessInfo:"",
    accessSourceUrl:"",
  };
  const draft = [
    "대전 테스트아파트 최근 실거래 6.5억.",
    "[이미지 01 — 가격]",
    "성심당 본점이 어떤 위치에 있는지도 함께 확인할 만합니다.",
    "[이미지 02 — 가격 비교]",
    "[이미지 03 — 오늘의 스토리]",
    "#대전 #테스트아파트 #실거래 #시세 #생활권 #성심당 #아파트",
  ].join("\n");
  const result = mod.auditApartmentArticle({mode:"bulk",name:"대전 테스트아파트",body:draft,plan});
  assert.equal(result.checks.filter(item => item.status === "warning").length,0);
  assert.ok(result.checks.some(item => item.status === "review" && item.label.includes("실거래")));
  assert.ok(result.checks.some(item => item.status === "pass" && item.label.includes("태그")));
  assert.ok(result.checks.some(item => item.status === "pass" && item.label.includes("장소")));
});


test("V3.1 default body instructions search for a real living story even without an approved card", async () => {
  const mod=await import("../lib/apartment-story.mjs");
  for(const mode of ["bulk","school","mega"]){
    const guide=mod.makeAutomaticLivingStoryBlock({
      mode,name:"테스트 단지",region:"테스트지역",
    });
    assert.match(guide,/기본 ON/);
    assert.match(guide,/실거래|매매|가격/);
    assert.match(guide,/실생활|생활 이야기|생활 장면/);
    assert.match(guide,/3~5문장/);
    assert.match(guide,/검증|근거/);
    assert.match(guide,/거리를|이동거리|소요시간/);
    assert.match(guide,/성심당/);
    assert.match(guide,/없거나 웹 검색이 불가능하면|찾지 못하거나 웹 검색이 불가능하면/);
  }
});

test("V3.1 unapproved auto-story image prompt follows the actual article for the current complex", async () => {
  const mod=await import("../lib/apartment-story.mjs");
  const body=[
    "군포 산본 테스트아파트 실거래 분석",
    "최근 6개월 월 대표값을 분석했습니다.",
    "여기 살면 무엇이 다를까?",
    "검증된 자료를 바탕으로 철쭉동산의 계절 풍경을 살펴볼 수 있습니다.",
    "다만 도보 10분은 경로 근거가 없어 확인이 필요합니다.",
    "#군포 #산본",
  ].join("\n");
  const prompt=mod.makeArticleBasedStoryVisualPrompt({
    mode:"bulk",name:"산본 테스트아파트",region:"경기 군포시",body,
  });
  assert.match(prompt,/철쭉동산/);
  assert.match(prompt,/실제 본문과 연동/);
  assert.doesNotMatch(prompt,/10분/);
  assert.match(prompt,/이동거리·시간 미확인/);
  assert.match(prompt,/새로운 명소|전혀 새로운 명소/);
  assert.equal(mod.makeArticleBasedStoryVisualPrompt({
    mode:"bulk",name:"다른 아파트",region:"경기",body,
  }),"");
  assert.equal(mod.makeArticleBasedStoryVisualPrompt({
    mode:"mega",name:"산본 테스트아파트",region:"경기",body:"",
  }),"");
});


test("V3.1 automatic story fallback is actually wired to all three article actions and image prompts", () => {
  const fs = require("node:fs");
  const files = {
    bulk: fs.readFileSync("app/apartment-bulk/page.tsx", "utf8"),
    school: fs.readFileSync("app/apartment-bulk/SchoolDistrictWorkspace.tsx", "utf8"),
    mega: fs.readFileSync("app/apartment-bulk/MegaComplexWorkspace.tsx", "utf8"),
  };
  for (const source of Object.values(files)) {
    assert.match(source, /makeAutomaticLivingStoryBlock/);
    assert.match(source, /makeArticleBasedStoryVisualPrompt/);
    assert.match(source, /status !== "skipped"/);
  }
  assert.match(files.bulk, /autoArticleVisualPrompt \|\| makeLocationImagePrompt/);
  assert.match(files.bulk, /본문 먼저 → 2\. 완성글 붙여넣기/);
  assert.match(files.school, /autoVisual \|\| makeSchoolSummaryPrompt/);
  assert.match(files.mega, /autoVisual \|\| locationPrompt/);
});
