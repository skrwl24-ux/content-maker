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
