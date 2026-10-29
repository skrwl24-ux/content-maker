/* Topic discovery: the editorial direction is user-editable; output schema stays fixed. */

const safe = (value, max = 800) => typeof value === "string" ? value.trim().slice(0, max) : "";
const ACCEPTED_CHANNELS = new Set(["집값쓱", "Paramma"]);
export const DEFAULT_TOPIC_DISCOVERY_DIRECTIONS = [
  "주제를 검색한 독자가 가장 알고 싶어 할 질문을 가설로 세워라.",
  "최근 공식 발표, 언론 보도, 통계, 연구, 방송·예능·드라마·영화, 지역 변화 등에서 실제로 연결되는 자료를 폭넓게 찾아라.",
  "자료를 비교해 눈에 띄는 변화, 예상 밖의 가격 차이, 새로운 사례, 확인할 만한 발견을 찾아라.",
  "독자가 짧은 AI 요약보다 한 단계 더 얻을 수 있는 구체적인 자료와 비교 조건을 제안하라.",
  "근거가 약한 소재를 억지로 채우지 말고, 각 주제의 원문 출처와 발표일을 기록하라.",
].join("\n");

const recommendationExample = {
  checkedAt: "YYYY-MM-DD",
  candidates: [
    {
      title: "실제로 조사한 주제 이름",
      channel: "집값쓱",
      type: "방송·지역·실거래·정책·생활·자연 등",
      whyNow: "확인 가능한 최근 소식과 그 발표일",
      readerQuestion: "독자가 알고 싶어 할 구체적인 질문",
      extraValue: "일반 AI 요약 이상으로 제공할 확인 가능한 정보",
      sourceUrl: "",
      publishedAt: "YYYY-MM-DD",
    },
  ],
};

export function buildTopicRecommendationPrompt({
  channel = "전체", focus = "", lookbackDays = 7, today = "", existingTopics = [], directions,
} = {}) {
  const scope = channel === "집값쓱" || channel === "Paramma" ? channel : "전체";
  const days = lookbackDays === 30 ? 30 : 7;
  const existing = Array.isArray(existingTopics) ? existingTopics.filter(x=>typeof x==="string").map(x=>safe(x,600)).filter(Boolean) : [];
  return [
    "콘텐츠 메이커 · 새로운 글감 발굴 조사. 지금은 원고를 작성하지 않는다.",
    "[AI 조사 방향 — 사이트에서 직접 수정한 지시문]",
    typeof directions === "string" ? directions.trim().slice(0,12000) : DEFAULT_TOPIC_DISCOVERY_DIRECTIONS,
    "[추천 설정]",
    "발행 채널: " + scope + " (전체라면 집값쓱/Paramma를 균형 있게 검토)",
    "조사 기준일: " + (safe(today, 40) || "현재 날짜"),
    "우선 살펴볼 기간: 최근 " + days + "일",
    "관심 방향: " + (safe(focus, 2000) || "최근 발견할 가치 있는 주제 중심"),
    "[기존 작업 주제 - 중복 회피]", ...(existing.length ? existing.map(v=>"- "+v) : ["기록 없음"]),
    "[자료 확인 기준]",
    "실제 웹 검색이 가능하다면 원문을 열어 확인한다. 확인하지 않은 숫자·사실·출처는 만들지 않는다.",
    "발표일, 사건 발생일, 조사일과 현재 유효 여부를 구분한다. 검색 급증은 실제 검색 데이터가 있을 때만 언급한다.",
    "인물·방송·촬영지 관련 소재는 해당 콘텐츠와 공식적으로 연결되는 사실만 다룬다. 사적인 거주지는 추정하지 않는다.",
    "[응답 형식]",
    "조사 결과를 4문장 이내로 요약한 뒤, 아래 태그 사이에 유효한 JSON 객체만 작성한다. 코드블록을 넣지 않는다.",
    "[TOPIC_RECOMMENDATIONS_JSON]",
    JSON.stringify(recommendationExample, null, 2),
    "[/TOPIC_RECOMMENDATIONS_JSON]",
    "예시 데이터를 실제 조사 결과로 반드시 교체하세요. candidates는 0~8개이며 각 sourceUrl은 실제 열어 확인한 https 원문만 기록하세요.",
    "출처를 열지 못했다면 sourceUrl을 빈 문자열로 놓고 whyNow에 확인 한계를 쓰세요. 출처 미확인 후보는 확정된 최근 유행으로 제시하지 마세요.",
    "각 후보의 channel은 '집값쓱' 또는 'Paramma' 중 하나로 정확히 지정하세요. whyNow와 extraValue를 추상적으로 반복하지 마세요.",
  ].join("\n\n");
}

function safeHttpsUrl(value) {
  const str = safe(value, 900);
  try {
    const url = new URL(str);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? str : "";
  } catch {
    return "";
  }
}

export function parseTopicRecommendations(raw) {
  const str = typeof raw === "string" ? raw : "";
  const tagged = str.match(/\[TOPIC_RECOMMENDATIONS_JSON\]([\s\S]*?)\[\/TOPIC_RECOMMENDATIONS_JSON\]/i);
  const body = (tagged ? tagged[1] : str).trim();
  if (!body || body.length > 100000) return null;
  let value;
  try { value = JSON.parse(body); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.candidates)) return null;
  const seen = new Set();
  const candidates = value.candidates.slice(0,8).map((candidate, i) => {
    if (!candidate || typeof candidate !== "object") return null;
    const title = safe(candidate.title, 250);
    const channel = safe(candidate.channel, 32);
    if (!title || !ACCEPTED_CHANNELS.has(channel)) return null;
    const norm = title.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    if (seen.has(norm)) return null;
    seen.add(norm);
    return {
      id: "suggested-" + i,
      title,
      channel,
      type: safe(candidate.type, 80),
      whyNow: safe(candidate.whyNow, 750),
      readerQuestion: safe(candidate.readerQuestion, 500),
      extraValue: safe(candidate.extraValue, 700),
      sourceUrl: safeHttpsUrl(candidate.sourceUrl),
      publishedAt: safe(candidate.publishedAt, 60),
    };
  }).filter(Boolean);
  return {
    checkedAt: safe(value.checkedAt, 60),
    candidates,
  };
}

export function recommendationToResearchNotes(item, checkedAt = "") {
  return [
    "[AI가 제안한 소재 — 아직 사실 검증 완료 아님]",
    "추천 구분: " + (item.type || "미입력"),
    "관심 이유 또는 최신 소식: " + (item.whyNow || "근거 미확인"),
    "독자의 예상 질문: " + (item.readerQuestion || "추가 조사 필요"),
    "글에서 추가로 줄 수 있는 정보: " + (item.extraValue || "추가 조사 필요"),
    "출처 원문: " + (item.sourceUrl || "미확인 — 실제 원문을 조사해야 함"),
    "원문 발표일: " + (item.publishedAt || "미확인"),
    "AI 조사 기준일: " + (checkedAt || "미기재"),
    "중요: 이 정보는 글쓰기 확정 사실이 아니므로 심층 조사에서 재확인할 것.",
  ].join("\n");
}
