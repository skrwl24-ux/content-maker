const CONTENT_TYPES = new Set(["bulk", "top3", "presale", "tip", "moving", "compare", "power"]);

function safeText(value, max = 900) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeArray(value, max = 8, itemMax = 220) {
  return Array.isArray(value)
    ? value.map((item) => safeText(item, itemMax)).filter(Boolean).slice(0, max)
    : [];
}

function safeKeyNumbers(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const label = safeText(item.label, 100);
    const numberValue = safeText(item.value, 140);
    const basis = safeText(item.basis, 180);
    if (!label || !numberValue) return null;
    return { label, value: numberValue, basis };
  }).filter(Boolean).slice(0, 6);
}

export function parseApartmentSearchPlan(raw) {
  const source = typeof raw === "string" ? raw.trim() : "";
  if (!source) return null;

  const tagged = source.match(/\[SEARCH_PLAN_JSON\]([\s\S]*?)\[\/SEARCH_PLAN_JSON\]/i)?.[1];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const jsonText = (tagged || fenced || source).trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  const mainKeyword = safeText(parsed?.mainKeyword, 140);
  const answerFirst = safeText(parsed?.answerFirst, 900);
  const readerQuestions = safeArray(parsed?.readerQuestions, 6, 180);
  if (!mainKeyword || !answerFirst || readerQuestions.length === 0) return null;

  return {
    hypotheses: safeArray(parsed?.hypotheses, 5, 220),
    searchType: safeText(parsed?.searchType, 80) || "검색 의도 확인",
    mainKeyword,
    subKeywords: safeArray(parsed?.subKeywords, 6, 120),
    readerQuestions,
    answerFirst,
    keyNumbers: safeKeyNumbers(parsed?.keyNumbers),
    evidenceNotes: safeArray(parsed?.evidenceNotes, 6, 260),
    sourceUrls: safeArray(parsed?.sourceUrls, 5, 500).filter((url) => /^https?:\/\//i.test(url)),
    checkedAt: safeText(parsed?.checkedAt, 40),
  };
}

function contentTypeGuide(contentType) {
  if (contentType === "bulk") return [
    "단지 실거래 분석",
    "최근 가격·6개월 변화·거래량·가격대 전환·고점/저점 위치를 우선 가설로 검토한다.",
    "개별 최근 실거래와 월 대표값을 섞지 않는다.",
  ];
  if (contentType === "presale") return [
    "신규 분양·청약",
    "대상 단지 자체의 직접 예상 분양가(3.3㎡당·주택형별 예상/거론가)·일반분양 물량·일정·자격을 먼저 확인하고, 선행단지·인근 분양·주변 신축 비교를 이어서 검토한다.",
    "확정 분양가가 없으면 '미정'에서 끝내지 말고 단지명+예상 분양가/평당/3.3㎡당/분양가 거론을 별도 검색해 직접 가격 신호를 먼저 찾는다. 직접 예상가가 없을 때만 선행단지→인근 최근 분양→주변 신축 실거래를 참고 가격선으로 쓰며, 모두 현재 단지 확정값처럼 표현하지 않는다.",
  ];
  if (contentType === "top3") return [
    "지역 TOP3",
    "순위 기준·기간·실제 거래건수·대표 면적·상위 단지 간 차이를 우선 검토한다.",
    "서로 다른 기간이나 면적 기준을 섞어서 순위를 만들지 않는다.",
  ];
  if (contentType === "compare") return [
    "지역·단지 비교",
    "비교 기준을 먼저 고정하고 가격·면적·입지·생활권 등 독자의 실제 선택 질문을 우선 검토한다.",
    "조건이 다른 대상을 억지로 같은 기준처럼 비교하지 않는다.",
  ];
  if (contentType === "tip") return [
    "검색형 정보",
    "독자가 바로 해결하려는 질문과 실제 확인 절차를 중심으로 가설을 세운다.",
    "검색량을 직접 확인하지 않았다면 많다고 단정하지 않는다.",
  ];
  if (contentType === "power") return [
    "주력 분석 콘텐츠",
    "핵심 숫자·배경 변수·독자가 다음에 확인할 지표를 중심으로 가설을 세운다.",
    "원인을 하나로 단정하지 않는다.",
  ];
  return [
    "생활·기타 정보",
    "독자가 실제로 해결하려는 질문을 중심으로 검색 가설을 세운다.",
    "검증되지 않은 숫자나 일정은 만들지 않는다.",
  ];
}

export function buildApartmentSearchPlanResearchPrompt({
  date,
  contentType,
  topic,
  materials = "",
  dataSummary = "",
} = {}) {
  const type = CONTENT_TYPES.has(contentType) ? contentType : "tip";
  const [typeLabel, priority, caution] = contentTypeGuide(type);

  return `아파트 콘텐츠메이커용 '검색 가설 → 사실 검증 → 최종 SEARCH_PLAN'을 만들어줘.

[작성 기준일]
${date || "현재 날짜"}

[콘텐츠 유형]
${typeLabel}

[작업 주제]
${safeText(topic, 500) || "주제 미정"}

[운영자 자료·근거 메모]
${safeText(materials, 5000) || "별도 메모 없음"}

[사이트가 가진 데이터 요약]
${safeText(dataSummary, 6000) || "별도 데이터 요약 없음"}

[이번 작업의 목적]
키워드를 먼저 정해 사실을 끼워 맞추는 것이 아니다.
먼저 검색자가 궁금해할 질문을 '가설'로 세운 뒤 최신 자료를 조사하고, 검증된 사실에서 최종 검색 구조를 뽑아라.

[1단계 · 검색 가설]
- 이 주제를 검색할 사람이 가장 먼저 알고 싶을 질문을 3~5개 가설로 세운다.
- 가설 단계에서는 아직 확인되지 않은 가격·일정·호재를 사실처럼 단정하지 않는다.
- 콘텐츠 유형 우선순위: ${priority}

[2단계 · 사실 검증]
- 반드시 최신 웹 검색으로 현재 유효한 사실을 확인한다.
- 국토교통부·지자체·LH·SH·청약홈·사업주체 공식 공고·공시 등 1차 자료를 우선한다.
- 실거래 데이터는 제공된 원자료가 있으면 그것을 우선하고, 개별 계약과 월 대표값을 구분한다.
- 일정·사업 단계는 예정/검토/추진/승인/착공/확정 상태를 구분한다.
- 독자가 실제 판단에 쓰는 핵심 숫자는 '아직 확정되지 않았다'는 이유만으로 검색을 생략하지 않는다. 확인 가능한 예상·거론·계획·과거 실제값을 적극적으로 찾고, 각각의 상태와 기준일을 표시한다.
- ${caution}
- 운영자 메모와 웹 자료가 충돌하면 최신 1차 출처를 우선하고 충돌 사실을 evidenceNotes에 남긴다.
- 검색량·자동완성·연관검색어를 실제 확인하지 않았다면 확인했다고 쓰지 않는다.

[3단계 · 최종 SEARCH_PLAN]
검증된 사실만 이용해 다음을 정한다.
- searchType: 이 글의 핵심 검색 의도. 예: 가격·거래 / 분양·청약 / 학군·예산 / 비교
- mainKeyword: 실제 독자가 검색할 법한 핵심 검색어 1개
- subKeywords: 본문에서 자연스럽게 다룰 세부 검색어 2~5개
- readerQuestions: 이 글이 반드시 답해야 할 독자 질문 2~5개
- answerFirst: 첫 화면에 들어갈 2~4문장. 가장 중요한 질문에 먼저 답하고, 숫자의 한계나 확정/예정 상태가 있으면 함께 밝힌다.
- keyNumbers: 첫 화면이나 핵심 요약에서 보여줄 검증된 숫자 0~5개. 분양 콘텐츠는 확정가가 없더라도 신뢰할 수 있는 대상 단지 예상/거론가 또는 가장 가까운 실제 비교 가격선이 확인되면 상태를 붙여 포함한다. 정말 근거가 없을 때만 비운다.
- evidenceNotes: SEARCH_PLAN을 만들 때 중요한 검증 메모·주의점 1~5개
- sourceUrls: 실제 확인한 공식·신뢰 출처 URL 1~5개
- checkedAt: 확인 기준일 YYYY-MM-DD

[ANSWER_FIRST 원칙]
- '안녕하세요', '오늘은 알아보겠습니다'로 시작하지 않는다.
- 독자가 검색한 질문의 답을 뒤로 미루지 않는다.
- 숫자가 강하면 첫 문장 또는 두 번째 문장에 바로 보여준다.
- 다만 소수 거래, 진행 중인 월, 분양가 미확정, 일정 변경 가능성처럼 해석 제한이 있으면 같은 블록에서 함께 말한다.
- 매수·청약 권유나 가격 전망을 확정적으로 쓰지 않는다.

[사이트 입력용 출력]
설명은 JSON 앞에 5줄 이내로만 작성해도 된다.
마지막에는 반드시 아래 형식의 유효한 JSON을 출력한다.

[SEARCH_PLAN_JSON]
{
  "hypotheses": [
    "독자가 처음 가질 가능성이 높은 질문",
    "두 번째 검색 가설"
  ],
  "searchType": "가격·거래",
  "mainKeyword": "단지명 실거래가",
  "subKeywords": ["최근 거래가", "6개월 가격 변화", "거래량"],
  "readerQuestions": [
    "최근 얼마에 거래됐나?",
    "6개월 동안 실제로 얼마나 달라졌나?"
  ],
  "answerFirst": "검증된 사실만으로 작성한 첫 화면용 2~4문장.",
  "keyNumbers": [
    {"label":"6개월 대표값","value":"2.72억 → 3.73억","basis":"월 대표값 기준"}
  ],
  "evidenceNotes": ["개별 최근 실거래와 월 대표값은 서로 다른 값이다."],
  "sourceUrls": ["https://공식출처"],
  "checkedAt": "YYYY-MM-DD"
}
[/SEARCH_PLAN_JSON]

중요: SEARCH_PLAN_JSON 안에는 주석이나 마크다운을 넣지 말고 유효한 JSON만 넣어줘.`;
}

export function apartmentSearchPlanPromptBlock(plan) {
  if (!plan?.mainKeyword || !plan?.answerFirst) return "";
  const keyNumbers = Array.isArray(plan.keyNumbers) ? plan.keyNumbers : [];
  const lines = [
    "",
    "",
    "[검증된 SEARCH_PLAN — 제목·도입·본문 기획에서 최우선 반영]",
    "- 검색 유형: " + (plan.searchType || "검색 의도 확인"),
    "- 메인 검색어: " + plan.mainKeyword,
    Array.isArray(plan.subKeywords) && plan.subKeywords.length ? "- 세부 검색어: " + plan.subKeywords.join(" · ") : "",
    Array.isArray(plan.readerQuestions) && plan.readerQuestions.length
      ? "[이 글이 반드시 답할 독자 질문]\n- " + plan.readerQuestions.join("\n- ")
      : "",
    "[ANSWER_FIRST]\n" + plan.answerFirst,
    keyNumbers.length
      ? "[첫 화면 핵심 숫자]\n" + keyNumbers.map((item) => "- " + item.label + ": " + item.value + (item.basis ? " (" + item.basis + ")" : "")).join("\n")
      : "",
    Array.isArray(plan.evidenceNotes) && plan.evidenceNotes.length
      ? "[검증 주의]\n- " + plan.evidenceNotes.join("\n- ")
      : "",
    "- 최종 제목은 메인 검색어를 자연스럽게 반영하되 키워드 나열식으로 만들지 말 것.",
    "- 도입 첫 2~4문장은 위 ANSWER_FIRST의 사실과 한계를 유지해 자연스럽게 다듬을 것. 중요한 숫자나 확정/예정 상태를 뒤로 미루지 말 것.",
    "- 본문 소제목은 독자 질문에 순서대로 답하도록 구성하되 같은 키워드를 반복 삽입하지 말 것.",
    "- SEARCH_PLAN과 이후 웹 확인 결과가 충돌하면 더 최신의 1차 출처를 우선하고, 최종 글에서는 사실을 바로잡을 것.",
  ].filter(Boolean);
  return lines.join("\n");
}
