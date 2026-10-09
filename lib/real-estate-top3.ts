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
