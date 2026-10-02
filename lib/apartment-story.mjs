/**
 * Read only the explicitly marked structured research result copied from GPT.
 * The output is untrusted research input: links and key fields are validated,
 * and nothing becomes publishable before the editor checks the original source.
 */
const STORY_FIELDS = [
  "title", "kind", "facts", "connection", "bridge",
  "sourceTitle", "sourceUrl", "sourceDate", "eventDate", "timing", "communityNote",
  "topic", "kick", "discovery", "placeName", "accessInfo", "accessSourceUrl", "storyDraft", "visualMode", "visualFacts",
];

// GPT can occasionally return human-readable JSON with unescaped quotes inside
// Korean sentences, literal line breaks, or a missing comma. Recover field
// boundaries without evaluating arbitrary text as code. Sources are still
// required, and the editor must verify them before a candidate enters a post.
function recoverStoryCandidates(content) {
  if (/"candidates"\s*:\s*\[\s*\]/i.test(content)) return [];

  const fields = STORY_FIELDS.join("|");
  const keyPattern = new RegExp('["“](' + fields + ')["”]\\s*:', "g");
  const matches = Array.from(content.matchAll(keyPattern));
  const candidates = [];
  let candidate = null;

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const key = current[1];
    if (key === "title") {
      if (candidate) candidates.push(candidate);
      candidate = {};
    }
    if (!candidate) continue;
    const from = current.index + current[0].length;
    const to = index + 1 < matches.length ? matches[index + 1].index : content.length;
    let value = content.slice(from, to).trim();

    // Trim only the structural quotes, commas and brackets. Quotation marks
    // within the factual sentence are preserved, not guessed away.
    value = value.replace(/^["“']\s*/, "")
      .replace(/["”']\s*[,}\]\{\s]*$/, "")
      .replace(/\\n/g, " ")
      .replace(/\r?\n/g, " ")
      .replace(/\\"/g, '"')
      .trim();
    candidate[key] = value;
  }
  if (candidate) candidates.push(candidate);
  return candidates.filter(item => item.title && item.sourceUrl).slice(0, 3);
}

function readStoryPayload(raw) {
  const fullBlocks = Array.from(raw.matchAll(/\[STORY_JSON\]([\s\S]*?)\[\/STORY_JSON\]/gi));
  if (fullBlocks.length) return fullBlocks[fullBlocks.length - 1][1].trim();
  const start = raw.lastIndexOf("[STORY_JSON]");
  if (start >= 0) {
    return raw.slice(start + "[STORY_JSON]".length)
      .replace(/\[\/STORY_JSON\][\s\S]*$/i, "").trim();
  }
  return raw.trim();
}

export function parseApartmentStoryResearch(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("조사 결과를 먼저 붙여넣어 주세요.");
  }

  const content = readStoryPayload(raw)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let candidates;
  try {
    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.candidates)) {
      throw new Error("missing candidates");
    }
    candidates = parsed.candidates;
  } catch {
    candidates = recoverStoryCandidates(content);
    if (!candidates.length && !/["“]candidates["”]\s*:\s*\[\s*\]/i.test(content)) {
      throw new Error("조사 결과를 인식하지 못했습니다. title, facts, connection, bridge, sourceUrl 항목이 들어 있는 조사 결과 전체를 붙여넣어 주세요.");
    }
  }

  const str = (value, length = 400) => typeof value === "string"
    ? value.trim().slice(0, length) : "";
  const url = (value) => {
    const candidate = str(value, 2000).replace(/\s+/g, "");
    try {
      const parsedUrl = new URL(candidate);
      return parsedUrl.protocol === "https:" && parsedUrl.hostname.includes(".")
        && !parsedUrl.username && !parsedUrl.password ? parsedUrl.href : "";
    } catch {
      return "";
    }
  };

  const result = candidates.slice(0, 3).map((item, index) => ({
    id: String(index + 1),
    title: str(item?.title, 100),
    kind: str(item?.kind, 50),
    facts: str(item?.facts, 550),
    connection: str(item?.connection, 350),
    bridge: str(item?.bridge, 500),
    sourceTitle: str(item?.sourceTitle, 120),
    sourceUrl: url(item?.sourceUrl),
    sourceDate: str(item?.sourceDate, 30),
    eventDate: str(item?.eventDate, 60),
    timing: str(item?.timing, 40),
    communityNote: str(item?.communityNote, 240),
    topic: str(item?.topic || item?.title, 140),
    kick: str(item?.kick || item?.facts, 550),
    discovery: str(item?.discovery || item?.kick || item?.facts, 260),
    placeName: str(item?.placeName || "", 100),
    accessInfo: str(item?.accessInfo || "", 250),
    accessSourceUrl: url(item?.accessSourceUrl),
    storyDraft: str(item?.storyDraft || "", 750),
    visualMode: ["map-hybrid", "photo-info", "timeline", "data-card"].includes(item?.visualMode) ? item.visualMode : "map-hybrid",
    visualFacts: str(item?.visualFacts || "", 500),
  })).filter(item => item.title && item.facts && item.connection && item.bridge && item.sourceUrl);

  if (candidates.length && !result.length) {
    throw new Error("후보를 찾았지만 제목·핵심 사실·단지 연결·연결 문장·HTTPS 원문 주소가 모두 있는 항목은 없습니다. 조사 결과를 확인해 주세요.");
  }
  return result;
}

/**
 * Generate a research-only prompt. The user pastes the GPT web result back
 * into the editor; this app does not claim to have searched the web itself.
 */
export function makeApartmentStoryResearchPrompt(data, articleTheme) {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return [
    "[아파트 동네 스토리 V2.1 · 웹 조사 요청]",
    "작성 기준일: " + date,
    "단지: " + (data.name || "확인 필요"),
    "지역: " + (data.region || "확인 필요"),
    "대표 면적: " + (data.area || "확인 필요"),
    "주요 역: " + (data.station || "미확인"),
    "입지 메모: " + (data.locationLine || "미확인"),
    "이번 실거래 글의 관점: " + articleTheme.label + " · " + articleTheme.angle,
    "",
    "목적: 집값을 보러 온 독자가 이 아파트가 자리한 동네의 계절·문화·일상·최근 변화까지 알게 하는 이야기 후보를 최신 웹 검색으로 0~3개 찾아라. 가격과 지역 이슈 사이에 인과관계를 만들어서는 안 된다.",
    "",
    "[탐색 순서]",
    "1. 단지에 직접 관련된 뉴스·공지·생활 이슈.",
    "2. 실제로 접근 가능한 생활권의 공원·학교·교통·상권·공공시설·가까운 행사.",
    "3. 지역의 정체성을 설명할 대표 축제·계절 행사·역사·자연 이야기. 같은 시·구라는 이유만으로 먼 행사를 단지 인근인 듯 연결하지 말 것.",
    "4. 공개 지역 커뮤니티의 관심사를 참고하되 탐색 단서로만 활용하고 비공개 자료·개인 신상·확인되지 않은 소문은 사용하지 말 것. 일부 의견을 전체 주민 의견이라고 표현하지 말 것.",
    "",
    "[선정·검증 기준]",
    "- 적합한 후보가 없으면 candidates: []로 출력하고 억지로 세 가지를 채우지 말 것.",
    "- 화제성보다 해당 단지와의 실제 생활권 연결, 독자가 얻는 가치, 시의성을 우선.",
    "- 후보마다 원문에서 확인한 실제 https 출처 URL을 최소 하나 포함.",
    "- 원문 발표일과 행사/사업일을 서로 구분. 종료·진행 중·예정·상시를 정확히 표시.",
    "- 원문 발표일이 확인되지 않으면 '날짜 확인 불가', 행사일이 해당되지 않으면 '해당 없음'으로 표시.",
    "- 오래된 행사라면 '최근/곧 개최' 같은 표현 금지. 주민 반응을 검색량·관심도 순위처럼 꾸미지 말 것.",
    "- bridge는 입지·생활권 설명에서 이어지는 자연스러운 연결문장 2~3개. 가격 변화의 원인이라고 엮지 말 것.",
    "",
    "아래 태그로 둘러싼 JSON만 출력할 것. 필드를 누락하거나 마크다운 표·코드블록으로 바꾸지 말 것. 각 값은 한 줄의 문자열로 작성하고, 본문 안에 큰따옴표가 필요하면 작은따옴표(\u2018\u2019)로 바꾸어 JSON 문법을 깨지 않도록 할 것. 항목 사이에는 쉼표를 넣을 것. 확인되지 않는 후보는 제외할 것.",
    "[STORY_JSON]",
    '{ "candidates": [',
    '  {',
    '    "title": "구체적인 스토리 제목",',
    '    "kind": "단지 직접 / 생활권 / 지역 문화 / 지역 현안",',
    '    "facts": "확인된 사실 2~3개",',
    '    "connection": "이 단지와의 관계 및 위치·생활권 근거",',
    '    "bridge": "실거래 분석 이후 입지 설명에서 이어질 자연스러운 2~3문장",',
    '    "sourceTitle": "실제 열람한 공식자료/기사 제목",',
    '    "sourceUrl": "원문에서 확인한 유효한 https URL",',
    '    "sourceDate": "YYYY-MM-DD 또는 날짜 확인 불가",',
    '    "eventDate": "실제 행사·사업 날짜 또는 해당 없음",',
    '    "timing": "종료 / 진행 중 / 예정 / 상시",',
    '    "communityNote": "공개 커뮤니티에서 발견한 관심사 단서 또는 없음"',
    '  }',
    '] }',
    "[/STORY_JSON]",
    '적합한 후보가 없다면 [STORY_JSON]{"candidates":[]}[/STORY_JSON]로 출력할 것. JSON 밖에는 다른 설명을 쓰지 말 것.',
  ].join("\n");
}


// V3 shared editorial planner. Research is carried out in a fresh GPT chat,
// not by the website. All proposals are untrusted until the user checks source,
// recency and the geographic/educational connection.
const V3_KIND_RULES = {
  bulk: [
    "일반 단지: 제공된 최근 6개월 실거래/거래량이 글의 중심이다.",
    "단지명/인근 역/동네를 네이버 검색과 공개 지역 커뮤니티에서 조사해 독자가 실제로 궁금해할 만한 질문을 발굴할 것.",
    "육아·통학, 출퇴근, 상권, 녹지, 역사, 관리, 지역 변화, 문화, 대표 명소·랜드마크, 오래된 맛집·빵집, 카페·상권 중 실제 관련성이 확인되는 이야기만 채택. 축제부터 찾지 말 것.",
    "동일 지역 다른 아파트의 경험담을 이 단지의 실거주 후기처럼 포장하지 말 것.",
  ],
  school: [
    "학군 시리즈: 이 학원가 생활권에서 실제 함께 비교되는 대표 아파트 5곳의 34평대(32~35평형) 매매·전세가 중심이다.",
    "학원가 기준점을 반드시 고정하고 비교 단지 전체에 해당하는 교육·이동·거주·통학 생활권 질문을 하나만 조사할 것. 실제 생활 동선에 있는 학생·학부모 식사 공간, 도서관, 지역 대표 카페·명소도 가능하지만 학군 비교가 중심이다.",
    "초중학교 실제 배정, 학원가 접근성, 학부모 공개 질문을 구분. 어느 특정 단지 거주가 학교 배정을 보장한다는 표현 금지.",
    "개별 5개 단지별로 독립적인 스토리 다섯 개를 만들지 말 것.",
  ],
  mega: [
    "초대형 단지: 세대수·단일 관리단지/블록 합산 구분과 34평대(32~35평형) 매매·전세·거래 데이터가 중심이다.",
    "대규모 단지의 내부 이동, 관리·시설, 통학, 동별 생활권 편차, 공원, 상권, 교통 또는 실제 접근 가능한 대표 맛집·카페·문화 장소처럼 규모와 지역 생활에 연결되는 질문을 찾을 것.",
    "단일단지와 합산형 수치를 뒤섞거나, 일부 입주민 의견을 전체 단지의 평가로 일반화하지 말 것.",
  ],
};

export function makeApartmentV3PlanningPrompt({ mode, name, region, dataSummary, previousTopics = "", regionalHints = "" }) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return [
    "[아파트 콘텐츠메이커 V3 · AI 주제와 스토리 킥 통합 기획]",
    "조사 기준일: " + today,
    "유형: " + (mode === "school" ? "학군 5단지 비교" : mode === "mega" ? "초대형 아파트" : "일반 아파트"),
    "대상: " + name,
    "지역/생활권: " + region,
    "[사이트에 입력된 검토용 데이터/조건]",
    dataSummary || "추가 확인 필요",
    "",
    "[이번 글의 원칙]",
    ...(V3_KIND_RULES[mode] || V3_KIND_RULES.bulk),
    "실거래·평형·기간 등은 입력 자료와 검증된 최신 실거래에 근거해야 하며, 단순 검색 결과로 가격을 새로 만들지 말 것.",
    "네이버 검색(단지명 + 질문, 지역 공개 카페/블로그, 주변 시설/상권)을 이야기의 탐색 단서로 활용하되 접근이 제한된 카페 글은 읽었다고 주장하지 말 것.",
    "개인의 사연이나 닉네임/사진/개인정보를 옮기지 말 것. 공개 커뮤니티의 작은 표본을 '주민 전체 반응'이나 '검색량'으로 일반화하지 말 것.",
    "발견한 주제가 필요하다면 공공기관, 교육청, 실제 운영시설, 공식 사업 안내 또는 신뢰할 만한 기사로 재확인할 것.",
    "단지-장소 사이의 실질적 생활권 연결을 확인할 것. 같은 시/구라는 이유로 먼 이슈를 가까운 일처럼 말하지 말 것.",
    "원문 발표일과 실제 행사/사업일은 구분할 것. 종료된 소식을 현재 진행형이나 예고로 쓰지 말 것.",
    "이벤트/축제/공사에 가격 변화 원인을 억지로 연결하지 말 것.",
    "최근 소식이 없다면 평소의 지역 정체성·교육·육아·출퇴근·녹지·주말 생활 질문으로 넓혀 볼 것. 적절한 후보가 없으면 candidates를 []로 출력.",
    "독자는 먼저 실거래 가격을 확인하러 방문한다. 글을 다 읽고 '아, 여기 살면 이런 생활도 할 수 있겠구나' 하고 새롭게 발견할 만한 구체적 실생활 장면 하나를 발굴할 것.",
    "대표 빵집(예: 대전 성심당), 노포·맛집·카페거리, 스포츠 경기장, 촬영지, 역사·문화 명소 등 지역 정체성과 실제 거주 생활의 연결도 탐색할 것. 특정 소재에 고정 우선순위를 매기지 말 것.",
    "장소명은 본점/지점까지 정확히 확인하고 단지에서 그 장소까지의 이동거리·시간은 실제 경로자료와 확인 가능한 이동수단이 있을 때만 적을 것. 같은 도시의 명소일 뿐이라면 가까운 동네 시설이라고 표현하지 말 것.",
    "개별 업소는 현재 운영/이전 여부를 확인하고 광고성 찬양, 인기순위 단정, 가격 상승의 원인 연결을 피할 것.",
    "discovery는 반드시 '이 단지에 살면 독자가 새롭게 알 수 있는 경험/동선'을 한 문장으로 요약할 것. 거리 미확인이라면 거리·시간 숫자를 절대 추정하지 말 것.",
    "storyDraft는 가격·거래 분석과 바로 붙일 수 있는 독립적 동네 소개가 아닌 본문 3~5문장의 자연스러운 초안으로 작성할 것. 제공되지 않은 사실·독자 감정·매수 결심을 창작하지 말 것.",
    "독자가 글을 읽고 얻는 '새로운 답'이 무엇인지 중심 주제와 스토리 킥을 1:1로 연결할 것.",
    "과거 같은 지역에서 조사한 소재는 재검증의 단서로만 참고할 것. 마지막 확인일이 오래됐으면 영업/경로/시설 정보를 새로 확인할 것.",
    "[같은 지역 기존 조사 단서] " + (regionalHints || "(저장된 기록 없음)"),
    "아래 최근 사용 소재와 중복되는 중심 주제·킥은 가능하면 피할 것. " + (previousTopics || "(저장된 기록 없음)"),
    "",
    "[이미지 구상]",
    "선정된 주제가 위치 중심이면 map-hybrid, 사용 허가가 있는 실제 사진 자료가 중심이면 photo-info, 공식 사업 단계/일정이면 timeline, 비교 가능한 검증 데이터면 data-card.",
    "map-hybrid는 1600x900 기준 지도 약 60% + 설명 40%의 구성안이다. 실제 위치/좌표/학교/노선을 새로 지어내거나 GPT로 그럴듯한 가짜 지도를 생성하지 말 것.",
    "지도 API나 사용 권한이 있는 지도/참고 이미지가 확인되지 않으면 시설·동선을 배경 지도인 것처럼 그리지 말고, 검증된 사실 중심의 도식/정보판으로 안전하게 구성할 것.",
    "photo-info는 사용 권한을 확인할 사진만 사용. 출처 불명 이미지·로고·지도 타일 무단 복제 금지.",
    "visualFacts에는 이미지에 반드시 표시할 검증된 구체 사실과 빠져야 할 미확인 정보를 1~3줄로 구분해서 적을 것.",
    "",
    "[출력 규격 · 조사 후보 0~3개, 추천안은 candidates의 첫 번째]",
    "반드시 [STORY_JSON]부터 [/STORY_JSON]까지 표시하고 아래 형식의 유효한 JSON으로만 출력. 모든 필드는 문자열, 한 줄 내용, 내부 큰따옴표 대신 작은따옴표 사용. 출처 URL은 실제로 직접 확인한 HTTPS 원문만 사용할 것.",
    "[STORY_JSON]",
    "{",
    '  "candidates": [',
    "    {",
    '      "title": "검색 결과로 정한 구체 후보 제목",',
    '      "topic": "가격/비교 데이터가 중심인 네이버 발행용 글 주제 1개",',
    '      "kick": "지역 검색에서 발견한 실생활 질문과 추가로 답할 가치 1~2문장",',
    '      "discovery": "독자가 읽고 나면 이곳에 살면서 누릴 수 있다고 새롭게 알게 되는 실제 생활 장면 한 문장",',
    '      "placeName": "정확한 대표 장소명과 지점명, 특정 장소가 없으면 빈 문자열",',
    '      "accessInfo": "단지에서 장소까지 실제 확인된 이동 정보 또는 이동 경로 미확인이라고 명시",',
    '      "accessSourceUrl": "이동 정보의 원문 HTTPS URL, 없으면 빈 문자열",',
    '      "storyDraft": "실거래 분석에서 자연스럽게 넘어가 독자의 생활 질문을 답하는 검증 사실 기반 3~5문장",',
    '      "kind": "단지 직접 / 생활권 / 교육 / 단지 규모 / 지역 변화 / 데이터 자체",',
    '      "facts": "원문에서 확인한 사실. 확인되지 않은 부분은 단정하지 않음",',
    '      "connection": "해당 단지 또는 비교 생활권과 실제로 연결되는 구체 근거",',
    '      "bridge": "가격·비교 데이터에서 생활권 이야기로 넘어가는 자연스러운 2~3문장",',
    '      "sourceTitle": "검증에 활용한 원문 제목",',
    '      "sourceUrl": "https://실제로-열람한-원문-주소",',
    '      "sourceDate": "YYYY-MM-DD 또는 날짜 확인 불가",',
    '      "eventDate": "실제 행사/사업일 또는 해당 없음",',
    '      "timing": "종료 / 진행 중 / 예정 / 상시",',
    '      "communityNote": "공개 커뮤니티에서 발견한 질문의 비식별 요약 또는 없음",',
    '      "visualMode": "map-hybrid / photo-info / timeline / data-card 중 하나",',
    '      "visualFacts": "실제 이미지로 시각화할 근거/장소/수치. 근거 없는 이동 시간 등 제외"',
    "    }",
    "  ]",
    "}",
    "[/STORY_JSON]",
    '적절한 외부 소재가 없으면 [STORY_JSON]{"candidates":[]}[/STORY_JSON]로 출력. 이 경우 실거래 자료 중심의 기존 제작을 유지한다.',
  ].join("\n");
}

const VISUAL_MODE_NAME = {
  "map-hybrid": "검증된 지도·위치 자료 60% + 스토리 정보 40%",
  "photo-info": "사용 권한이 확인된 실제 사진 + 짧은 정보판",
  timeline: "공식 단계와 날짜를 보여주는 타임라인",
  "data-card": "확인된 수치·질문·설명을 엮은 정보형 인포그래픽",
};

// One canonical, editor-approved fact card is reused in article/thumbnail/visual.
export function makeStoryFactSheet(plan) {
  if (!plan) return "";
  const access = plan.accessInfo && plan.accessSourceUrl
    ? plan.accessInfo + " (경로 확인 근거: " + plan.accessSourceUrl + ")"
    : "독립적인 경로 근거가 없으므로 거리·도보/차량 시간 숫자는 발행본문과 이미지에서 표기하지 말 것.";
  return [
    "[V3.1 오늘의 생활 발견 · 승인된 사실 원본 카드]",
    "중심 주제: " + (plan.topic || plan.title),
    "독자가 새롭게 발견할 생활: " + (plan.discovery || plan.kick || plan.facts),
    "스토리 킥: " + plan.kick,
    "정확한 대표 장소/지점: " + (plan.placeName || "특정 시설 없음"),
    "검증된 원문 사실: " + plan.facts,
    "단지와 실제 연결: " + plan.connection,
    "장소 접근 정보: " + access,
    "출처: " + plan.sourceTitle + " / " + plan.sourceUrl,
    "출처 날짜: " + plan.sourceDate + " / 실제 행사·사업일: " + plan.eventDate + " / 상태: " + plan.timing,
    "본문과 모든 이미지에서 위 장소명/지점/단위/기간을 동일하게 사용. 근거 없는 새 숫자·장소·시설·동선은 추가하지 말 것.",
    "출처에서 확인되지 않은 사실이 있으면 그 사실만 빼고 실제 데이터를 중심으로 쓸 것. 단지와 먼 도시 대표 명소는 동네 근접 시설처럼 소개하지 말 것.",
  ].join("\n");
}

export function makeApprovedStoryBlock(plan) {
  if (!plan) return "";
  return [
    makeStoryFactSheet(plan),
    "",
    "[가격에서 생활로 자연스럽게 이어지는 V3.1 본문 엔진 — 필수]",
    "글의 중심은 실거래·매매/전세·거래량·단지 분석 약 75~80%, 생활 발견 약 20%다. 독자는 집값을 보러 왔음을 잊지 말 것.",
    "권장 독서 흐름: ① 지역·단지·핵심 가격/규모 훅 ② 실제 계약과 통계 구분한 데이터 해석 ③ 단지 입지에서 생활 질문으로 연결 ④ 오늘의 생활 발견에 3~5문장으로 실제 답하기 ⑤ 이동 정보의 확인 가능 범위와 제약을 설명 ⑥ 다시 가격·주거환경에서 체크할 것으로 마무리.",
    "스토리를 '뜬금없는 동네 소식', 광고성 맛집 추천, 지역 명소 나열, 집값 변화의 억지 원인으로 만들지 말 것.",
    "전환 문장 참고(본문 흐름에 맞춰 재작성): " + plan.bridge,
    "스토리 본문 초안(사실관계만 참고하고 통째로 붙여넣지 말 것): " + (plan.storyDraft || plan.kick),
    "독자에게 남길 한 문장: " + (plan.discovery || plan.kick),
    "개별 장소명/지점은 카드 그대로 표기하고 경로 근거가 없으면 거리·시간 수치를 쓰지 말 것.",
    "'한편', '또한'을 반복하며 문단을 덧붙이는 기계적인 연결을 피하고, 가격 다음에 실제 거주 시 경험할 생활을 자연스럽게 이어갈 것.",
    "선정한 생활 장면만 설명하고 다른 미확인 후보를 새로 추가하지 말 것.",
    "승인된 카드에서 숫자·지점·날짜를 임의로 수정하지 말 것. 가격 상승/하락이 이 스토리 때문이라는 인과 주장 금지.",
    "원문은 작성 직전 재확인. 최종 네이버 발행본문에는 조사용 URL/개인정보/조사 JSON을 붙이지 말 것.",
    "이미지 위치·기존 장수·평형·실거래 기준과 다른 편집 규칙은 해당 콘텐츠 유형 규칙을 그대로 유지.",
  ].join("\n");
}

// Match a completed draft to the locked place. No match = never guess a paragraph.
export function extractStoryExcerpt(body, plan, name = "") {
  if (!plan || typeof body !== "string" || !body.trim()) return "";
  if (name && !body.includes(name)) return "";
  const place = (plan.placeName || "").trim();
  if (!place) return "";
  const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const index = lines.findIndex(line => line.includes(place) && !/^\[?이미지\s*0?\d/.test(line));
  if (index < 0) return "";
  return lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 3))
    .filter(line => !/^#/.test(line) && !/^\[?이미지\s*0?\d/.test(line))
    .join(" ").slice(0, 850);
}

export function makeApprovedStoryVisualPrompt(plan, {
  mode = "bulk", name = "", region = "", mapProvided = false, finalStoryExcerpt = "",
} = {}) {
  if (!plan) return "";
  const visual = VISUAL_MODE_NAME[plan.visualMode] || VISUAL_MODE_NAME["data-card"];
  const slot = mode === "bulk" ? "본문 세 번째 이미지(기존 입지 이미지 대체)" : "본문 이미지 03(기존 마지막 이미지 대체)";
  return [
    "[V3.1 동일한 생활 발견 카드로 만든 스토리 비주얼]",
    "대상: " + name + " / " + region,
    "슬롯: " + slot,
    makeStoryFactSheet(plan),
    "권장 시각화: " + visual,
    "시각화할 검증 사실: " + (plan.visualFacts || plan.facts),
    finalStoryExcerpt
      ? "[최종 원고의 실제 생활 문단 — 이 내용과 일치시키고 새로운 장소·수치를 추가하지 말 것]\n" + finalStoryExcerpt
      : "최종 원고를 아직 붙여넣지 않았습니다. 위 승인 사실 카드의 장소·수치·동선만 사용하고, 본문 완성 후 재검수할 것.",
    "크기: 1600×900, 한 장만 출력. 중요한 장소명·지점·숫자는 사실 카드와 1:1 일치시킬 것.",
    plan.visualMode === "map-hybrid"
      ? (mapProvided
        ? "함께 제공한 기존 지도 캡처/확인된 좌표에서 실제 장소의 위치만 참고하라. 임의 도로, 학교, 노선, 방향, 거리, 횡단보도, 통학로를 추가하지 마라. 지도 서비스를 그대로 복제하지 말고 확실한 위치 관계만 간결히 정리. 지도 60%와 정보 40% 기본."
        : "현재 검증된 지도 캡처나 좌표는 함께 제공되지 않았다. 가짜 위치 지도/경로를 그리지 말 것. 실제 장소명과 검증 사실을 풍부한 정보형 도식으로 정리하고, 정확한 지도는 별도 확인이 필요함을 표시."
      )
      : plan.visualMode === "photo-info"
        ? "실제 사진은 사용권을 확보한 자료가 제공될 때만 사용. 제공되지 않으면 특정 시설 사진인 듯한 가짜 사진을 만들지 않고 일러스트/정보판을 사용."
        : plan.visualMode === "timeline"
          ? "출처에서 확인한 날짜와 단계만 시간순으로 표현. 확정되지 않은 계획은 예정이라고 명시."
          : "핵심 정보 3~4개를 비교·질문·답변 구조로 풍부하게 배치. 존재하지 않는 통계, 사람의 여론, 장소 정보를 만들지 말 것.",
    "불분명한 학교 배정·도보시간·직선거리·사업 완료 시점 등을 임의로 확정하지 말 것.",
    "실제 지도 타일/로고/UI, 타인 사진을 복제하지 말 것. 지역·단지명을 정확하게 표기.",
  ].join("\n");
}
