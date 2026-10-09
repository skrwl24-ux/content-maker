export type RankingMode = "riseRate" | "dropRate" | "tradeCount" | "riseAmount" | "currentPriceLow";

export type Top3Settings = {
  title: string;
  region: string;
  period: string;
  areaRule: string;
  priceRule: string;
  rankingMode: RankingMode;
  candidateCount: number;
};

export type Top3Candidate = {
  name: string;
  location: string;
  exclusiveArea: number | null;
  currentPrice: number | null;
  comparePrice: number | null;
  changeAmount: number | null;
  changeRate: number | null;
  tradeCount: number | null;
  totalUnits: number | null;
  buildYear: number | null;
  sourceUrls: string[];
  sourceNote: string;
};

export type Top3Research = {
  checkedAt: string;
  criteria: {
    region: string;
    period: string;
    areaRule: string;
    priceRule: string;
    rankingMode: RankingMode;
    representativePriceRule: string;
  };
  candidates: Top3Candidate[];
  notes: string[];
};

export type Top3Discovery = {
  headline: string;
  summary: string;
  biggestDiscovery: string;
  editorAngle: string;
  items: Array<{
    rank: number;
    name: string;
    whyRanked: string;
    noticedPoint: string;
    caution: string;
    lifestyleObservation: string;
    sourceUrls: string[];
  }>;
  sources: string[];
};

export const MODE_LABELS: Record<RankingMode, string> = {
  riseRate: "가격 상승률 TOP3",
  dropRate: "가격 하락률 TOP3",
  tradeCount: "거래량 TOP3",
  riseAmount: "가격 상승액 TOP3",
  currentPriceLow: "현재 가격 낮은 순 TOP3",
};

export const DEFAULT_SETTINGS: Top3Settings = {
  title: "최근 6개월 가장 많이 오른 아파트 TOP3",
  region: "",
  period: "최근 6개월",
  areaRule: "전용 84㎡ 전후",
  priceRule: "가격 제한 없음",
  rankingMode: "riseRate",
  candidateCount: 8,
};

function num(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function arr(value: unknown) {
  return Array.isArray(value) ? value.map((x) => String(x || "").trim()).filter(Boolean) : [];
}

export function stripFence(raw: string) {
  const mark = String.fromCharCode(96).repeat(3);
  let text = raw.trim();
  if (text.startsWith(mark)) {
    text = text.slice(3).replace(/^json\s*/i, "");
    if (text.endsWith(mark)) text = text.slice(0, -3);
  }
  return text.trim();
}

function candidate(value: unknown): Top3Candidate | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = String(row.name || "").trim();
  if (!name) return null;
  const currentPrice = num(row.currentPrice);
  const comparePrice = num(row.comparePrice);
  let changeAmount = num(row.changeAmount);
  let changeRate = num(row.changeRate);
  if (changeAmount === null && currentPrice !== null && comparePrice !== null) changeAmount = currentPrice - comparePrice;
  if (changeRate === null && currentPrice !== null && comparePrice !== null && comparePrice !== 0) {
    changeRate = ((currentPrice - comparePrice) / comparePrice) * 100;
  }
  return {
    name,
    location: String(row.location || "").trim(),
    exclusiveArea: num(row.exclusiveArea),
    currentPrice,
    comparePrice,
    changeAmount,
    changeRate,
    tradeCount: num(row.tradeCount),
    totalUnits: num(row.totalUnits),
    buildYear: num(row.buildYear),
    sourceUrls: arr(row.sourceUrls),
    sourceNote: String(row.sourceNote || "").trim(),
  };
}

export function parseResearch(raw: string): { data: Top3Research | null; errors: string[] } {
  if (!raw.trim()) return { data: null, errors: ["조사 결과 JSON을 붙여넣어 주세요."] };
  try {
    const parsed = JSON.parse(stripFence(raw)) as Record<string, unknown>;
    const rc = parsed.criteria && typeof parsed.criteria === "object" ? parsed.criteria as Record<string, unknown> : {};
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.map(candidate).filter(Boolean) as Top3Candidate[]
      : [];
    const errors: string[] = [];
    if (candidates.length < 3) errors.push("후보가 3개 미만입니다.");
    const dups = candidates.map((x) => x.name).filter((name, i, all) => all.indexOf(name) !== i);
    if (dups.length) errors.push("중복 단지가 있습니다: " + [...new Set(dups)].join(", "));
    const noSource = candidates.filter((x) => x.sourceUrls.length === 0).map((x) => x.name);
    if (noSource.length) errors.push("출처 URL이 없는 단지: " + noSource.join(", "));
    return {
      data: {
        checkedAt: String(parsed.checkedAt || "").trim(),
        criteria: {
          region: String(rc.region || "").trim(),
          period: String(rc.period || "").trim(),
          areaRule: String(rc.areaRule || "").trim(),
          priceRule: String(rc.priceRule || "").trim(),
          rankingMode: String(rc.rankingMode || "riseRate") as RankingMode,
          representativePriceRule: String(rc.representativePriceRule || "").trim(),
        },
        candidates,
        notes: arr(parsed.notes),
      },
      errors,
    };
  } catch {
    return { data: null, errors: ["JSON 형식을 읽지 못했습니다. GPT 결과의 JSON 전체를 그대로 붙여넣어 주세요."] };
  }
}

function metric(x: Top3Candidate, mode: RankingMode) {
  if (mode === "riseRate" || mode === "dropRate") return x.changeRate;
  if (mode === "tradeCount") return x.tradeCount;
  if (mode === "riseAmount") return x.changeAmount;
  return x.currentPrice;
}

export function rankTop3(rows: Top3Candidate[], mode: RankingMode) {
  return rows
    .filter((x) => metric(x, mode) !== null)
    .slice()
    .sort((a, b) => {
      const av = metric(a, mode) as number;
      const bv = metric(b, mode) as number;
      return mode === "dropRate" || mode === "currentPriceLow" ? av - bv : bv - av;
    })
    .slice(0, 3);
}

export function validationNotes(rows: Top3Candidate[], mode: RankingMode) {
  const notes: string[] = [];
  if (rows.filter((x) => metric(x, mode) !== null).length < 3) notes.push("현재 기준으로 순위를 계산할 후보가 3개 미만입니다.");
  if (["riseRate", "dropRate", "riseAmount"].includes(mode)) {
    const missing = rows.filter((x) => x.currentPrice === null || x.comparePrice === null).map((x) => x.name);
    if (missing.length) notes.push("현재/비교 가격 누락: " + missing.join(", "));
  }
  const low = rows.filter((x) => x.tradeCount !== null && x.tradeCount <= 1).map((x) => x.name);
  if (low.length) notes.push("거래 표본 1건 이하: " + low.join(", "));
  return notes;
}

export function formatPrice(value: number | null) {
  if (value === null) return "확인 필요";
  const eok = value / 100000000;
  if (Math.abs(eok) >= 1) return eok.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "억";
  return Math.round(value / 10000).toLocaleString("ko-KR") + "만원";
}


export function researchPrompt(s: Top3Settings) {
  return [
    "네이버 부동산 TOP3 글 제작에 사용할 후보 자료를 웹 검색으로 조사해줘.",
    "",
    "[주제]",
    "예정 제목: " + s.title,
    "지역: " + s.region,
    "비교 기간: " + s.period,
    "평형 기준: " + s.areaRule,
    "가격 조건: " + s.priceRule,
    "순위 기준: " + MODE_LABELS[s.rankingMode],
    "후보 목표: " + s.candidateCount + "개",
    "",
    "[조사 원칙]",
    "- 반드시 실제 웹 검색을 수행할 것.",
    "- 국토교통부 실거래가 공개시스템, 공공데이터, 지자체·공공기관, 공식 단지 정보 등 1차 자료를 우선할 것.",
    "- 모든 후보를 동일한 기간·면적 기준으로 비교할 것.",
    "- 면적을 ±2~3㎡ 범위로 확장했다면 exclusiveArea에 실제 면적을 기록할 것.",
    "- 신고가 1건만 골라 대표가격으로 쓰지 말 것. 표본이 적으면 sourceNote에 명시할 것.",
    "- currentPrice와 comparePrice는 원 단위 숫자로 출력할 것. 예: 8억 5천만원 = 850000000.",
    "- changeAmount와 changeRate는 같은 두 가격을 기준으로 계산할 것.",
    "- 거래량 순위라면 집계 기간을 모든 후보에 동일하게 맞출 것.",
    "- 가격 조건을 만족하지 않는 단지는 후보에서 제외할 것.",
    "- 숫자·거래건수·세대수·준공연도를 추정하지 말 것.",
    "",
    "[출력] 설명문 없이 JSON 하나만 출력.",
    "{",
    '  "checkedAt": "YYYY-MM-DD",',
    '  "criteria": {"region":"' + s.region + '","period":"' + s.period + '","areaRule":"' + s.areaRule + '","priceRule":"' + s.priceRule + '","rankingMode":"' + s.rankingMode + '","representativePriceRule":"대표가격 선정 실제 기준"},',
    '  "candidates": [{"name":"단지명","location":"시·구·동","exclusiveArea":84.9,"currentPrice":850000000,"comparePrice":790000000,"changeAmount":60000000,"changeRate":7.59,"tradeCount":6,"totalUnits":1200,"buildYear":2018,"sourceUrls":["https://..."],"sourceNote":"대표값과 표본 메모"}],',
    '  "notes": ["공통 주의사항"]',
    "}",
  ].join("\n");
}

export function discoveryPrompt(s: Top3Settings, top3: Top3Candidate[], research: Top3Research) {
  return [
    "아래 확정 TOP3를 바탕으로 네이버 글에 넣을 '자료를 직접 살펴본 느낌의 발견 메모'를 만들어줘.",
    "",
    "[규칙]",
    "- 순위는 사이트가 계산해 확정했다. 절대 바꾸지 말 것.",
    "- 저장된 가격·거래량 숫자를 수정하거나 새 숫자를 만들지 말 것.",
    "- 실제 방문하지 않았으므로 '직접 가봤다', '걸어봤다', '살아보니', '주민에게 물어봤다' 같은 표현 금지.",
    "- '자료를 펼쳐보니', '거래를 하나씩 대조해보니', '세 단지를 같은 기준으로 놓고 보니' 같은 실제 조사 과정 표현은 가능.",
    "- 지도·생활권 관찰은 웹에서 확인된 사실만 사용. 거리·도보시간·소음·경사 추정 금지.",
    "- TOP3 중심을 유지하고 관찰은 단지별 1~2문장만.",
    "",
    "[주제]",
    JSON.stringify(s, null, 2),
    "",
    "[조사 기준]",
    JSON.stringify(research.criteria, null, 2),
    "",
    "[확정 TOP3]",
    JSON.stringify(top3.map((x, i) => ({ rank: i + 1, ...x })), null, 2),
    "",
    "[출력] 설명문 없이 JSON 하나만 출력.",
    "{",
    '  "headline":"가장 먼저 눈에 들어온 한 문장",',
    '  "summary":"세 곳 전체 요약",',
    '  "biggestDiscovery":"순위 외 가장 의외였던 한 가지",',
    '  "editorAngle":"최종 글의 관찰 관점",',
    '  "items":[{"rank":1,"name":"단지명","whyRanked":"숫자 근거","noticedPoint":"자료에서 눈에 띈 점","caution":"주의점","lifestyleObservation":"확인된 생활권 한 줄 또는 빈 문자열","sourceUrls":["https://..."]}],',
    '  "sources":["https://..."]',
    "}",
  ].join("\n");
}

export function parseDiscovery(raw: string): Top3Discovery | null {
  if (!raw.trim()) return null;
  try {
    const p = JSON.parse(stripFence(raw)) as Record<string, unknown>;
    const items = Array.isArray(p.items) ? p.items.filter((x) => x && typeof x === "object").map((x) => {
      const r = x as Record<string, unknown>;
      return {
        rank: Number(r.rank || 0),
        name: String(r.name || "").trim(),
        whyRanked: String(r.whyRanked || "").trim(),
        noticedPoint: String(r.noticedPoint || "").trim(),
        caution: String(r.caution || "").trim(),
        lifestyleObservation: String(r.lifestyleObservation || "").trim(),
        sourceUrls: arr(r.sourceUrls),
      };
    }) : [];
    return {
      headline: String(p.headline || "").trim(),
      summary: String(p.summary || "").trim(),
      biggestDiscovery: String(p.biggestDiscovery || "").trim(),
      editorAngle: String(p.editorAngle || "").trim(),
      items,
      sources: arr(p.sources),
    };
  } catch {
    return null;
  }
}

function candidateText(x: Top3Candidate, rank: number) {
  return [
    rank + "위 " + x.name,
    "지역: " + (x.location || "확인 필요"),
    "전용: " + (x.exclusiveArea === null ? "확인 필요" : x.exclusiveArea + "㎡"),
    "현재 대표가격: " + formatPrice(x.currentPrice),
    "비교시점 대표가격: " + formatPrice(x.comparePrice),
    "변동액: " + formatPrice(x.changeAmount),
    "변동률: " + (x.changeRate === null ? "확인 필요" : x.changeRate.toFixed(2) + "%"),
    "거래건수: " + (x.tradeCount === null ? "확인 필요" : x.tradeCount + "건"),
    "세대수: " + (x.totalUnits === null ? "확인 필요" : x.totalUnits.toLocaleString("ko-KR") + "세대"),
    "준공연도: " + (x.buildYear === null ? "확인 필요" : x.buildYear),
    "자료 메모: " + (x.sourceNote || "없음"),
  ].join("\n");
}


export function finalPrompt(s: Top3Settings, research: Top3Research, top3: Top3Candidate[], discovery: Top3Discovery | null) {
  return [
    "네이버 블로그 '부동산 꿀팁'용 TOP3 글을 최종 발행본으로 작성해줘.",
    "",
    "[고정 제목]",
    s.title,
    "",
    "[선정 기준]",
    "지역: " + s.region,
    "기간: " + s.period,
    "평형: " + s.areaRule,
    "가격 조건: " + s.priceRule,
    "순위 기준: " + MODE_LABELS[s.rankingMode],
    "확인일: " + (research.checkedAt || "확인 필요"),
    "대표값 기준: " + (research.criteria.representativePriceRule || "조사 결과 기준"),
    "",
    "[사이트가 계산한 확정 TOP3 — 순위 변경 금지]",
    top3.map((x, i) => candidateText(x, i + 1)).join("\n\n"),
    "",
    "[발견 메모]",
    discovery ? JSON.stringify(discovery, null, 2) : "없음",
    "",
    "[핵심 문체]",
    "- TOP3 형식이 중심. 임장기처럼 길게 쓰지 말 것.",
    "- 독자가 3위 → 2위 → 1위를 계속 궁금해하도록 전개.",
    "- 각 순위에 실제 자료를 대조한 편집자 관찰 1~2문장만 추가.",
    "- 사용 가능: '자료를 펼쳐보니', '거래를 하나씩 대조해보니', '같은 기준으로 놓고 보니', '지도에서 주변을 확인해보니'.",
    "- 금지: '직접 다녀왔다', '걸어봤다', '현장에서 느꼈다', '주민에게 물어봤다', '살아보니'.",
    "- 저장된 조사에 없는 생활권·학교·역·상권 사실을 만들지 말 것.",
    "- 1위가 모든 면에서 최고라고 단정하지 말고 표본과 거래건수 한계를 같이 볼 것.",
    "- 투자 권유·미래 가격 단정·확정적 시세차익 금지.",
    "",
    "[본문 순서]",
    "## 이번 TOP3는 이렇게 골랐습니다",
    "## 3위 · 단지명",
    "## 2위 · 단지명",
    "## 1위 · 단지명",
    "## 세 곳 한눈에 비교",
    "## 자료를 보며 눈에 띈 한 가지",
    "## 정리",
    "",
    "[작성법]",
    "- 도입 3~5문장 안에 조사 이유와 비교 기준을 알려주되 1위를 바로 공개하지 말 것.",
    "- 각 순위 첫 문장에서 핵심 숫자를 바로 공개하고, 눈에 띈 점과 주의점을 이어 쓸 것.",
    "- 다음 순위로 넘어갈 때 짧은 연결 문장 1개를 사용할 것.",
    "- '세 곳 한눈에 비교'에는 단지/전용면적/현재가격/비교가격/변동률/거래건수 마크다운 표 1개.",
    "- 강조할 핵심 문장 1~2개만 > 인용구로 표시.",
    "- 일반 본문은 한 문장 또는 짧은 문단마다 한 줄 비우기.",
    "- 해시태그 8~10개.",
    "",
    "[이미지 위치 — 정확히 한 줄씩]",
    "[이미지 00 · TOP3 썸네일]",
    "[이미지 01 · TOP3 순위표]",
    "[이미지 02 · 가격 변화 비교]",
    "[이미지 03 · 거래 흐름 비교]",
    "[이미지 04 · 이번 조사에서 발견한 점]",
    "",
    "[출처]",
    "글 끝에 '" + (research.checkedAt || "확인일") + " 기준 · 공개 실거래 및 확인 자료'를 한 줄로 표시.",
    "본문에는 긴 URL을 나열하지 말 것.",
    "",
    "[출력] 코드블록 없이 최종 글만 출력.",
  ].join("\n");
}

export type ImageSlot = "00" | "01" | "02" | "03" | "04";

export function imagePrompt(slot: ImageSlot, s: Top3Settings, top3: Top3Candidate[], discovery: Top3Discovery | null) {
  const base = [
    "네이버 블로그 '부동산 꿀팁 TOP3'용 이미지 1장을 만들어줘.",
    "실제 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게.",
    "과도한 AI 느낌, 네온, 유리질감, 과한 3D, 복잡한 배지 금지.",
    "저장된 숫자 외의 가격·거래량·거리·순위를 새로 만들지 말 것.",
    "특정 실제 단지 외관·동배치·조경을 사실처럼 만들어내지 말 것.",
  ];
  if (slot === "00") return [
    ...base,
    "슬롯: 00 · 대표 썸네일",
    "크기: 1254×1254px, 1:1",
    "고정 문구: " + s.title,
    "문구는 고정 제목만 사용. 다른 숫자·부제·배지 추가 금지.",
    "1~2줄 카드형, 모바일에서 제목이 크게 읽히게.",
  ].join("\n");

  const role = slot === "01" ? "1·2·3위와 핵심 숫자를 한눈에 보여주는 TOP3 순위표"
    : slot === "02" ? "세 단지의 비교시점 가격 → 현재 대표가격 변화를 동일 기준으로 보여주는 비교"
    : slot === "03" ? "세 단지의 거래건수와 가격 흐름을 함께 보여주는 비교"
    : "자료를 대조하며 발견한 가장 의외의 한 가지를 보여주는 저장형 정보 카드";

  return [
    ...base,
    "슬롯: " + slot,
    "크기: 1600×900px, 16:9",
    "역할: " + role,
    "[주제]",
    JSON.stringify(s, null, 2),
    "[확정 TOP3]",
    JSON.stringify(top3.map((x, i) => ({ rank: i + 1, ...x })), null, 2),
    "[발견 메모]",
    discovery ? JSON.stringify(discovery, null, 2) : "없음",
    slot === "04" && !discovery ? "발견 메모가 없으므로 새 사실을 만들지 말고 비교 기준 정리 카드로 구성." : "위 저장자료만 사용.",
    "한 요청 = 현재 슬롯 1장만 제작. 합본 금지.",
  ].join("\n");
}
