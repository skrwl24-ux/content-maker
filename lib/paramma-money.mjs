const CATEGORIES = new Set(["신기한 동물이야기", "신비로운 자연", "생활 속 궁금증", "신기한 우리 몸"]);
const INTENTS = new Set(["신청", "비용", "비교", "구매", "가입", "시즌"]);

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 3;
  return Math.min(5, Math.max(1, Math.round(num)));
}

function safeText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeArray(value, max = 8) {
  return Array.isArray(value)
    ? value.map((item) => safeText(item, 180)).filter(Boolean).slice(0, max)
    : [];
}

export function moneyCandidateScore(candidate) {
  return clampScore(candidate?.moneyScore) + clampScore(candidate?.timelinessScore) + clampScore(candidate?.fitScore);
}

export function parseParammaMoneyCandidates(raw) {
  const source = typeof raw === "string" ? raw.trim() : "";
  if (!source) return [];

  const tagged = source.match(/\[MONEY_JSON\]([\s\S]*?)\[\/MONEY_JSON\]/i)?.[1];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const jsonText = (tagged || fenced || source).trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  return items
    .map((item) => {
      const title = safeText(item?.title, 180);
      const thumbnailHook = safeText(item?.thumbnailHook, 90);
      const brief = safeText(item?.brief, 360);
      if (!title || !thumbnailHook || !brief) return null;

      const category = CATEGORIES.has(item?.category) ? item.category : "생활 속 궁금증";
      const intent = INTENTS.has(item?.intent) ? item.intent : "비교";
      const candidate = {
        category,
        title,
        thumbnailHook,
        brief,
        intent,
        action: safeText(item?.action, 180),
        mainKeyword: safeText(item?.mainKeyword, 120) || safeText(item?.keywords?.[0], 120),
        subKeywords: safeArray(item?.subKeywords, 8),
        actionQuestions: safeArray(item?.actionQuestions, 6),
        faqQuestions: safeArray(item?.faqQuestions, 6),
        keywords: safeArray(item?.keywords, 8),
        whyNow: safeText(item?.whyNow, 320),
        expiresAt: safeText(item?.expiresAt, 40),
        moneyScore: clampScore(item?.moneyScore),
        timelinessScore: clampScore(item?.timelinessScore),
        fitScore: clampScore(item?.fitScore),
        sourceUrls: safeArray(item?.sourceUrls, 4).filter((url) => /^https?:\/\//i.test(url)),
      };
      return candidate;
    })
    .filter(Boolean)
    .sort((a, b) => moneyCandidateScore(b) - moneyCandidateScore(a));
}

export function buildParammaMoneyResearchPrompt({ date, queueTitles = [], historyTitles = [] } = {}) {
  const queue = queueTitles.filter(Boolean).slice(0, 20);
  const history = historyTitles.filter(Boolean).slice(0, 80);

  return `Paramma 블로그에 넣을 '수익형 행동 검색 주제' 후보를 조사해줘.

[기준일]
${date || "현재 날짜"}

[Paramma 운영 방향]
- 기존 블로그의 핵심은 생활 속 '왜 그럴까?'를 쉽게 설명하는 정보형 콘텐츠다.
- 전체 발행 큐 10개 중 일반 호기심형 7개 + 수익형 행동 검색형 3개 정도를 목표로 한다.
- 수익형 글도 광고 문구부터 시작하지 말고, 독자가 실제로 신청·비교·구매·가입·예약·방문하기 직전에 검색하는 질문을 해결해야 한다.
- 가능한 카테고리는 신기한 동물이야기 / 신비로운 자연 / 생활 속 궁금증 / 신기한 우리 몸 중 하나로 배치한다. 금융·정책·IT 구매형은 기본적으로 '생활 속 궁금증', 예방접종·건강 행동형은 '신기한 우리 몸'을 우선 검토한다.

[가장 중요한 조사 방식]
- 반드시 최신 웹 검색으로 현재 유효한 주제인지 확인한다.
- 정부·공공기관·금융기관·제조사·공식 발표·병원/의학기관 등 1차 출처를 우선한다.
- 이미 종료된 신청, 지난 시즌 일정, 출시가 취소되거나 바뀐 제품 정보를 후보로 올리지 않는다.
- 검색량을 실제로 확인하지 않았다면 검색량이 많다고 단정하지 않는다.
- 뉴스성 이슈는 실제 사건일/접수일/출시일을 기준일과 대조한다.
- 건강·금융 주제는 과장된 효능·수익·추천이 아니라 대상·비용·조건·비교·주의사항 중심으로 다룬다.

[돈 되는 검색 의도]
다음 6가지 중 하나로 분류한다.
1. 신청: 신청방법, 홈페이지, 모바일, 대상, 기간, 준비물
2. 비용: 가격, 비용, 무료대상, 지원, 환급, 저렴한 곳 찾기
3. 비교: A vs B, 차이, 장단점, 갈아타기, 무엇이 유리한가
4. 구매: 출시일, 사전예약, 후기, 단점, 용량, 색상, 실사용 비교
5. 가입: 금리, 조건, 만기, 중도해지, 특판, 모바일 가입
6. 시즌: 예방접종, 난방, 연말정산, 명절, 휴가, 입학 등 기간성 행동

[후보 선정 질문]
'내가 실제로 이걸 신청/구매/가입/방문하려는 사람이라면 직전에 무엇을 검색할까?'를 기준으로 잡아라.
단순 정보성 호기심보다 실제 다음 행동이 분명한 주제를 우선한다.

[검색 설계 — 각 후보마다 반드시 작성]
- mainKeyword: 이 글이 가장 직접적으로 답해야 할 메인 검색어 1개. 지나치게 넓은 단어보다 실제 검색 문구에 가깝게 작성.
- subKeywords: 메인 검색어와 함께 본문에서 자연스럽게 다룰 세부 키워드 3~6개.
- actionQuestions: 독자가 실제 행동 직전에 검색할 질문 2~4개. 예: "모바일로 신청할 수 있나?", "비용은 얼마인가?", "중도해지하면 어떻게 되나?"
- faqQuestions: 본문을 읽은 뒤에도 남기 쉬운 자주 묻는 질문 3~5개. actionQuestions와 같은 질문을 문장만 바꿔 중복하지 말 것.
- 검색량·자동완성·연관검색어를 실제 확인하지 않았다면 '많이 검색된다', '자동완성에 뜬다'고 표현하지 말 것.
- 제목은 mainKeyword와 가장 중요한 subKeyword 하나를 자연스럽게 반영하되 키워드 나열식 제목은 금지한다.

[현재 큐와 중복 금지]
${queue.length ? queue.map((title, index) => `${index + 1}. ${title}`).join("\n") : "(현재 큐 정보 없음)"}

[최근 발행과 중복 금지]
${history.length ? history.map((title, index) => `${index + 1}. ${title}`).join("\n") : "(최근 발행 정보 없음)"}

[후보 수]
- 최종 8개만 선정
- 지금 바로 쓸 이유가 약한 상시 키워드만으로 8개를 채우지 말고, 현재 시점성이 강한 후보와 상시 구매/비용형을 섞는다.
- 서로 같은 사건이나 상품의 제목만 바꾼 중복 후보는 금지한다.

[점수]
각 1~5점.
- moneyScore: 신청·구매·가입·비용 발생 등 '돈과 행동의 거리'
- timelinessScore: 지금 써야 하는 이유의 강도
- fitScore: Paramma의 생활 질문형 정보글로 자연스럽게 풀 수 있는 정도

[반드시 JSON만 별도 블록으로 출력]
설명은 JSON 블록 앞에 5줄 이내로 짧게 써도 되지만, 사이트가 읽을 수 있도록 마지막에는 정확히 아래 형식으로 출력한다.

[MONEY_JSON]
{
  "candidates": [
    {
      "category": "생활 속 궁금증",
      "title": "실제 발행용 제목",
      "thumbnailHook": "짧은 썸네일 문구",
      "brief": "왜 이 주제를 쓰는지와 독자가 얻을 답",
      "intent": "신청",
      "action": "독자가 실제로 하려는 행동",
      "mainKeyword": "국가유산 여행 신청 방법",
      "subKeywords": ["온라인 신청", "모바일 신청", "신청 기간", "대상"],
      "actionQuestions": ["휴대폰으로 신청할 수 있나?", "신청은 언제까지인가?"],
      "faqQuestions": ["선착순인가?", "신청 후 변경이나 취소가 가능한가?", "준비해야 할 정보는 무엇인가?"],
      "keywords": ["국가유산 여행 신청", "온라인 신청", "모바일 신청"],
      "whyNow": "지금 써야 하는 구체적 이유와 확인한 일정",
      "expiresAt": "2026-10-31 또는 상시",
      "moneyScore": 5,
      "timelinessScore": 5,
      "fitScore": 4,
      "sourceUrls": ["https://공식출처1", "https://공식출처2"]
    }
  ]
}
[/MONEY_JSON]

중요: MONEY_JSON 안에는 주석이나 마크다운을 넣지 말고 유효한 JSON만 넣어줘.`;
}
