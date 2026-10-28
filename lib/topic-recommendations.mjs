import { EDITORIAL_DIRECTOR_RULES } from "./editorial-director.mjs";

const safe = (value, max = 800) => typeof value === "string" ? value.trim().slice(0, max) : "";
const ACCEPTED_CHANNELS = new Set(["집값쓱", "Paramma"]);
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
  channel = "전체", focus = "", lookbackDays = 7, today = "", existingTopics = [],
} = {}) {
  const scope = channel === "집값쓱" || channel === "Paramma" ? channel : "전체";
  const days = lookbackDays === 30 ? 30 : 7;
  const existing = Array.isArray(existingTopics) ? existingTopics.filter(x=>typeof x==="string").map(x=>safe(x,600)).filter(Boolean) : [];
  return [
    "콘텐츠 메이커 · 새로운 글감 발굴 조사. 아직 원고를 작성하지 마세요.",
    EDITORIAL_DIRECTOR_RULES,
    "[추천 설정]",
    "발행 채널: " + scope + " (전체라면 집값쓱/Paramma에 어울리는 소재를 균형 있게 검토)",
    "조사 기준일: " + (safe(today, 40) || "현재 날짜"),
    "우선 살펴볼 기간: 최근 " + days + "일 (기존 이슈의 새로운 발표도 가능)",
    "관심 방향: " + (safe(focus, 2000) || "특정 관심사 지정 없음. 최근 발견할 가치 있는 주제 중심"),
    "[기존 작업 주제 - 중복 회피]", ...(existing.length ? existing.map(v=>"- "+v) : ["기록 없음"]),
    "[조사 순서]",
    "1. 실제 웹 검색이 가능하다면 먼저 최신 소식부터 검색하세요. 검색할 수 없다면 최신이라고 단언하거나 확인하지 않은 출처 URL을 생성하지 마세요.",
    "2. 검색어 한 개에 의존하지 말고 최근 공식 발표·언론 보도·새 연구·방송·예능·드라마·영화·화제 인물·지역·부동산 변화·해외 사례로 확장하세요.",
    "3. '사람들이 지금 관심이 커졌다'고 주장하려면 검색 데이터 또는 관측 근거가 필요합니다. 확인하지 못하면 '최근 이슈'와 '검색 급증'을 혼동하지 마세요.",
    "4. 각 주제는 원문을 열어 확인할 수 있는 최소 하나의 직접적인 출처와 발표일을 찾으세요. 동일 기사 재배포를 교차 검증으로 취급하지 마세요.",
    "5. 연예인·드라마·영화 관련 소재는 실제 공적으로 확인되는 등장 장면·발언·촬영 장소에 한해 연결하세요. 비공개 주거지 추정은 금지합니다.",
    "6. 최근 이슈 중 독자가 구체적으로 무엇을 알고 싶어할지, AI의 짧은 요약보다 한 단계 유용한 어떤 자료를 줄 수 있을지 판단하세요.",
    "7. 기존 작업과 이름만 바뀐 중복 소재를 제외하고 최대 8개의 다른 글감을 추천하세요. 근거 부족 시 무리하게 8개를 채우지 마세요.",
    "8. 발표일·실제 사건일·조사 날짜를 구분하세요. 기사 제목만 보고 사건을 단정하지 마세요.",
    "[응답 형식]",
    "먼저 전체 조사 요약을 4문장 이내로 쓰고, 반드시 아래 태그 사이에 유효한 JSON 객체만 작성하세요. 코드블록을 넣지 마세요.",
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
