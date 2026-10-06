const MONEY_INTENTS = new Set(["comparison","signup","billing","problem-solving","pricing","upgrade","refund","evergreen","news"]);

function safeText(value, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeArray(value, max = 8, itemMax = 220) {
  return Array.isArray(value) ? value.map(v => safeText(v, itemMax)).filter(Boolean).slice(0, max) : [];
}

export function parseGoogleContentPlan(raw) {
  const source = typeof raw === "string" ? raw.trim() : "";
  if (!source) return null;
  const tagged = source.match(/\[GOOGLE_PLAN_JSON\]([\s\S]*?)\[\/GOOGLE_PLAN_JSON\]/i)?.[1];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const jsonText = (tagged || fenced || source).trim();

  let parsed;
  try { parsed = JSON.parse(jsonText); } catch { return null; }

  const primaryQuery = safeText(parsed?.primaryQuery, 160);
  const userDecision = safeText(parsed?.userDecision, 360);
  const originalValue = safeText(parsed?.originalValue, 800);
  const answerFirst = safeText(parsed?.answerFirst, 900);
  if (!primaryQuery || !userDecision || !originalValue || !answerFirst) return null;

  return {
    moneyIntent: MONEY_INTENTS.has(parsed?.moneyIntent) ? parsed.moneyIntent : "comparison",
    cluster: safeText(parsed?.cluster, 160),
    primaryQuery,
    secondaryQueries: safeArray(parsed?.secondaryQueries, 7, 160),
    userDecision,
    originalValue,
    originalValueType: safeText(parsed?.originalValueType, 80) || "official-comparison",
    answerFirst,
    evidenceLevel: safeText(parsed?.evidenceLevel, 40) || "B",
    sourceUrls: safeArray(parsed?.sourceUrls, 6, 500).filter(url => /^https?:\/\//i.test(url)),
    checkedAt: safeText(parsed?.checkedAt, 40),
    notes: safeArray(parsed?.notes, 6, 280),
  };
}

export function buildGoogleContentPlanPrompt({date, title, keyword, note, existingTitles = []} = {}) {
  const existing = safeArray(existingTitles, 30, 220);
  return `AI Price Atlas용 Google Blog 글을 빠르게 만들기 위한 '조사·기획 통합' 작업을 해줘.

[기준일]
${date || "현재 날짜"}

[예정 글]
제목: ${safeText(title, 260) || "미입력"}
현재 키워드: ${safeText(keyword, 180) || "미입력"}
운영 메모: ${safeText(note, 800) || "없음"}

[AI Price Atlas의 주 목적]
AI 서비스를 실제로 결제·업그레이드·비교·해지·문제 해결하기 직전의 사용자가 의사결정을 내릴 수 있도록
최신 공식 정보와 독창적인 비교·검증 가치를 제공하는 영어 사이트다.

[이번 조사에서 한 번에 결정할 것]
1. MONEY INTENT
2. SEARCH PLAN
3. ORIGINAL VALUE
4. ANSWER FIRST

[MONEY INTENT]
아래 중 가장 가까운 1개를 고른다.
comparison / signup / billing / problem-solving / pricing / upgrade / refund / evergreen / news

[SEARCH PLAN]
- primaryQuery: 실제 영어 검색자가 입력할 법한 핵심 검색어 1개
- secondaryQueries: 실제 다음 질문 3~6개
- userDecision: 이 글을 읽은 사람이 실제로 결정하려는 한 가지
- cluster: 연결할 주제 클러스터. 예: ChatGPT Pricing / Claude Pricing / AI Subscription Comparison / Billing & Refunds
- 검색량이나 자동완성을 실제 확인하지 않았다면 확인했다고 쓰지 않는다.

[ORIGINAL VALUE]
단순 공식 가격표 재작성만으로 끝내지 않는다. 아래 우선순위로 이 글만의 가치를 하나 정한다.
A. 직접 수행 가능한 실제 비교·테스트 또는 기존 실전 검증실 결과
B. 같은 기준일의 공식 가격·플랜·세금·제한을 통일 기준으로 비교한 자체 표·판단 기준
C. 공식 도움말 여러 개를 하나의 실제 행동 순서로 재구성한 문제 해결 가이드
단순 요약밖에 만들 수 없으면 evidenceLevel을 C로 낮추고 발행 우선순위가 낮다는 notes를 남긴다.
실제 사용하지 않은 서비스나 플랜을 직접 써본 것처럼 표현하지 않는다.

[ANSWER FIRST]
- 검색자가 원하는 답을 영어 2~4문장으로 먼저 제시한다.
- 가격·플랜·제한은 최신 공식 자료에서 확인한 값만 쓴다.
- 지역·세금·앱스토어 등 조건에 따라 달라지면 같은 블록에서 제한을 밝힌다.
- 추천·수익·성능을 과장하지 않는다.

[최신 검증]
- 반드시 최신 웹 검색을 사용한다.
- OpenAI, Anthropic, Google, Apple App Store, Google Play, 공식 도움말 등 1차 출처를 우선한다.
- 가격·세금·플랜명·사용 제한·환불·해지 절차는 현재 날짜와 맞는지 확인한다.
- 과거 정보와 현재 정보를 섞지 않는다.
- 다른 블로그나 SEO 글을 근거의 중심으로 삼지 않는다.

[중복 방지 참고]
${existing.length ? existing.map((v,i)=>`${i+1}. ${v}`).join("\n") : "(기존 글 목록 없음)"}

[출력]
설명은 JSON 앞에 최대 5줄.
마지막에는 반드시 아래 형식의 유효한 JSON만 넣는다.

[GOOGLE_PLAN_JSON]
{
  "moneyIntent": "comparison",
  "cluster": "ChatGPT Pricing",
  "primaryQuery": "ChatGPT Plus vs Pro",
  "secondaryQueries": ["ChatGPT Plus price", "ChatGPT Pro price", "ChatGPT Plus limits"],
  "userDecision": "Which plan is worth paying for based on actual usage needs?",
  "originalValue": "Compare current official pricing and plan limits on the same date, then turn the differences into a decision guide by user type.",
  "originalValueType": "official-comparison",
  "answerFirst": "A concise 2–4 sentence English answer using only verified current facts.",
  "evidenceLevel": "B",
  "sourceUrls": ["https://official-source.example"],
  "checkedAt": "YYYY-MM-DD",
  "notes": ["Any limitation or freshness warning."]
}
[/GOOGLE_PLAN_JSON]

GOOGLE_PLAN_JSON 안에는 주석이나 마크다운을 넣지 말 것.`;
}

export function googleContentPlanBlock(plan) {
  if (!plan?.primaryQuery || !plan?.answerFirst) return "";
  return [
    "",
    "",
    "[GOOGLE CONTENT PLAN — 우선 적용]",
    "- MONEY INTENT: " + plan.moneyIntent,
    plan.cluster ? "- Topic cluster: " + plan.cluster : "",
    "- Primary query: " + plan.primaryQuery,
    plan.secondaryQueries?.length ? "- Secondary queries: " + plan.secondaryQueries.join(" · ") : "",
    "- User decision: " + plan.userDecision,
    "- Original value: " + plan.originalValue,
    "- Original value type: " + (plan.originalValueType || "official-comparison"),
    "- Evidence level: " + (plan.evidenceLevel || "B"),
    "[ANSWER_FIRST]",
    plan.answerFirst,
    plan.notes?.length ? "[Planning cautions]\n- " + plan.notes.join("\n- ") : "",
    "- The final article must answer the primary query in the first 100 words and preserve the factual limits in ANSWER_FIRST.",
    "- The article must visibly deliver the stated Original Value. Do not replace it with generic background explanation.",
    "- Use secondary queries as coverage guidance, not as repeated keyword stuffing.",
    "- If fresh official sources contradict this saved plan, update the facts in the article and prefer the newer official source.",
  ].filter(Boolean).join("\n");
}

export function googleImagePlanBlock(plan, slotId) {
  if (!plan?.primaryQuery) return "";
  const slotRule = slotId === "00"
    ? "Hero: show the primary query/topic and one verified decision-driving point, not a generic AI illustration."
    : slotId === "01"
      ? "Use the strongest verified price/plan snapshot that supports the user's decision."
      : slotId === "02"
        ? "Show a real comparison dimension or limitation relevant to the decision; do not force web-vs-app if the topic is different."
        : slotId === "03"
          ? "Prioritize the article's ORIGINAL VALUE: decision matrix, actual comparison, test result, or action sequence."
          : slotId === "04"
            ? "Show an important condition, limitation, region/tax context, or who-each-option-fits guidance."
            : "Summarize the decision criteria and next action without adding new claims.";
  return [
    "",
    "",
    "[GOOGLE CONTENT PLAN FOR IMAGE]",
    "- Primary query: " + plan.primaryQuery,
    "- User decision: " + plan.userDecision,
    "- Original value: " + plan.originalValue,
    "- " + slotRule,
    "- Only visualize facts verified in the final article or current official sources. Never invent prices, limits, rankings, or test results.",
  ].join("\n");
}
