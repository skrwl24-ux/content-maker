/**
 * Read only the explicitly marked structured research result copied from GPT.
 * The output is untrusted research input: links and key fields are validated,
 * and nothing becomes publishable before the editor checks the original source.
 */
export function parseApartmentStoryResearch(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("조사 결과를 먼저 붙여넣어 주세요.");
  const block = raw.match(/\[STORY_JSON\]([\s\S]*?)\[\/STORY_JSON\]/i);
  const content = (block ? block[1] : raw).trim()
    .replace(/^\x60\x60\x60(?:json)?\s*/i, "")
    .replace(/\s*\x60\x60\x60$/, "");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("[STORY_JSON]부터 [/STORY_JSON]까지 포함한 조사 결과를 그대로 붙여넣어 주세요.");
  }
  if (!parsed || !Array.isArray(parsed.candidates)) {
    throw new Error("조사 결과에 candidates 배열이 없습니다. 스토리 조사 요청서로 다시 조사해 주세요.");
  }
  const str = (value, length = 400) => typeof value === "string" ? value.trim().slice(0, length) : "";
  const url = (value) => {
    const candidate = str(value, 2000);
    try {
      const parsedUrl = new URL(candidate);
      return parsedUrl.protocol === "https:" && parsedUrl.hostname.includes(".") ? parsedUrl.href : "";
    } catch {
      return "";
    }
  };
  return parsed.candidates.slice(0, 3).map((candidate, index) => ({
    id: String(index + 1),
    title: str(candidate?.title, 100),
    kind: str(candidate?.kind, 50),
    facts: str(candidate?.facts, 550),
    connection: str(candidate?.connection, 350),
    bridge: str(candidate?.bridge, 500),
    sourceTitle: str(candidate?.sourceTitle, 120),
    sourceUrl: url(candidate?.sourceUrl),
    sourceDate: str(candidate?.sourceDate, 30),
    eventDate: str(candidate?.eventDate, 60),
    timing: str(candidate?.timing, 40),
    communityNote: str(candidate?.communityNote, 240),
  })).filter(candidate => candidate.title && candidate.facts && candidate.connection && candidate.bridge && candidate.sourceUrl);
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
    "아래 태그로 둘러싼 유효한 JSON만 출력할 것. 필드를 누락하거나 마크다운 표로 바꾸지 말 것. 문자열 내용은 실제 확인한 정보로 대체하되 확인되지 않는 후보는 제외할 것.",
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
