// Quoted conversation hooks are an editorial option, never fabricated reporting.
// Apply at copy/open/export time too, so previously saved prompts get current rules.
export const PARAMMA_QUOTED_HEADLINE_RULES = `
[Paramma · “ ” 한마디 제목과 읽히는 도입 · 최종 작성 규칙]
- 발행용 제목을 고르기 전, 검색 키워드와 사실을 명확히 담은 일반 제목 1개와 일상에서 자연스럽게 나올 법한 짧은 한마디를 “ ”로 감싼 제목 1개를 내부적으로 비교한다. 후보 목록은 출력하지 않고 더 좋은 최종 제목 1개만 출력한다.
- 따옴표형 제목이 자연스럽고 검색 의도를 해치지 않을 때만 채택한다. 모든 글에 “ ”를 강제로 넣거나 본문에 없는 극적인 문장을 꾸며내지 않는다.
- “ ” 안에는 의문·당혹감·발견을 표현하는 짧은 일상 표현을 넣는다. 실제 누군가의 발언임을 암시하는 이름·직업·인터뷰 설정은 임의로 쓰지 않는다.
- 인물·기관의 실제 발언을 인용할 때만 출처·발언 맥락·정확한 문구를 확인하고 [검수 메모]에 근거를 남긴다. 확인되지 않은 발언을 실제 인용으로 포장하지 않는다.
- 독자의 머릿속 한마디를 연출한 제목은 실제 사람이 말했다고 서술하지 않는다. 허구의 목격담·후기·기사처럼 보이게 만들지 않는다.
- 예시 제목 형식: “쌀에 거미줄이?” 쌀통 속 하얀 실, 씻어 먹어도 될까? (예시는 형식만 참고하고 현재 주제에 맞게 새로 만든다.)
- 제목 앞부분에 공감되는 한마디를 쓰더라도 검색할 핵심 대상·상황·질문을 제목 안에 분명하게 남긴다. 큰따옴표는 필요할 때 1쌍만 사용한다.
- 글 첫 3~5줄에는 공감할 실제 일상 상황·갈등·질문으로 몰입시키고, 곧바로 핵심 답의 방향이나 확인된 중요한 사실을 알려준다. 답을 끝까지 숨겨 체류를 강요하지 않는다.
- 이어지는 본문은 실제 사례·원리·차이·바로 쓸 수 있는 해결 또는 판단 기준을 연결한다. 형식 채우기용 목차·뻔한 설명·과장된 낚시 제목은 금지한다.
- 글은 짧은 자연스러운 줄과 충분한 문단 여백을 유지하되 각 장면마다 새 정보를 제공한다.
- 썸네일은 확정 제목에서 짧은 “한마디” 부분을 쓰는 편이 더 이해하기 쉬운 경우에만 그 문구를 우선하며, 따옴표가 없으면 기존 후킹 문구를 사용한다.
`;

export function appendParammaQuotedHeadlineRules(raw) {
  const prompt = String(raw || "");
  if (prompt.includes("[Paramma · “ ” 한마디 제목과 읽히는 도입 · 최종 작성 규칙]")) return prompt;
  return prompt + "\n\n" + PARAMMA_QUOTED_HEADLINE_RULES;
}

// A confirmed headline can supply the short thumbnail hook. No AI guesses from body quotes.
export function extractParammaQuotedThumbnailHook(article, fallback = "") {
  const first = String(article || "").replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
  const headline = first.replace(/^#{1,6}\s+/, "").replace(/^\*\*/, "").replace(/\*\*$/, "").trim();
  const match = headline.match(/^[“"]([^”"\n]{2,24})[”"]/);
  if (!match) return String(fallback || "");
  const expression = match[1].trim();
  if (expression.length < 2 || !/[가-힣A-Za-z]/.test(expression)) return String(fallback || "");
  return "“" + expression + "”";
}
