import { analysisRows, MonthlyStat } from "./apartment-analysis";
export type ArticleThemeId = "price" | "band" | "trade" | "mixed" | "rebound" | "volatility" | "highlow" | "stable" | "gap" | "context";
export type ArticleThemeMode = "auto" | ArticleThemeId;
export type ArticleThemeChoice = { id: ArticleThemeId; label: string; angle: string; score: number };
export const ARTICLE_THEME_META: Record<ArticleThemeId, { label: string; angle: string }> = {
  price: {
    label: "가격 변화",
    angle: "확인 기간 첫 대표값과 최근 대표값의 변화폭·변화율을 중심으로 보되 단순 숫자 나열은 피한다.",
  },
  band: {
    label: "가격대 전환",
    angle: "몇 억대에서 몇 억대로 가격대가 바뀌었는지와 그 과정의 월별 흐름을 중심으로 본다.",
  },
  trade: {
    label: "거래량 변화",
    angle: "거래가 유독 몰린 달·줄어든 달을 찾고 가격 흐름과 함께 해석한다. 거래량만으로 심리를 단정하지 않는다.",
  },
  mixed: {
    label: "가격·거래 엇갈림",
    angle: "가격 방향과 거래량 방향이 서로 다르게 움직였는지를 중심으로 본다.",
  },
  rebound: {
    label: "저점·고점·반등",
    angle: "확인 기간 중간 저점 또는 고점 이후 최근 대표값이 어디까지 회복·조정됐는지를 중심으로 본다.",
  },
  volatility: {
    label: "가격 변동성",
    angle: "월별 대표값의 고저 차이와 출렁임 자체를 핵심 장면으로 잡는다.",
  },
  highlow: {
    label: "확인 기간 고점·저점 위치",
    angle: "최근 대표값이 확인 기간 범위의 고점·저점 중 어디에 가까운지를 중심으로 본다.",
  },
  gap: { label: "거래 공백", angle: "수집이 확인된 월의 무거래 구간과 거래 재개 여부를 중심으로 설명한다. 미확인 월을 거래 공백으로 단정하지 않는다." },
  context: { label: "단지·입지 특징", angle: "가격 방향은 판단하지 말고 확인된 단지 기본정보·역·입주·생활권 중 차별점을 찾아 설명한다. 외부 사실은 공식 출처 확인 후 사용한다." },
  stable: {
    label: "보합·관망",
    angle: "큰 방향성보다 좁은 가격 범위와 거래량 변화를 중심으로 차분하게 본다.",
  },
};

export function analyzeArticleThemes(monthlyStats: MonthlyStat[]): ArticleThemeChoice[] {
  const valid = analysisRows(monthlyStats).filter((item) => item.medianPrice != null) as Array<MonthlyStat & { medianPrice: number }>;
  const baseScores: Record<ArticleThemeId, number> = {
    price: 25,
    band: 5,
    trade: 15,
    mixed: 5,
    rebound: 5,
    volatility: 10,
    highlow: 15,
    stable: 5, gap: 0, context: 0,
  };

  const observed = analysisRows(monthlyStats).filter(r => r.status !== "unverified");
  const counts = observed.map(r => r.tradeCount);
  const countChanged = counts.length >= 2 && Math.max(...counts)-Math.min(...counts) >= 2;
  const hasGap = observed.some(r => r.tradeCount === 0) && observed.some(r => r.tradeCount > 0);
  const supported = valid.filter(r => r.tradeCount >= 2);
  if (valid.length < 2 || supported.length < 2 || valid[0].tradeCount < 2 || valid.at(-1)!.tradeCount < 2) {
    return [{id: hasGap ? "gap" : countChanged ? "trade" : "context", ...ARTICLE_THEME_META[hasGap ? "gap" : countChanged ? "trade" : "context"], score: 90}];
  }

  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = last.medianPrice - first.medianPrice;
  const rate = first.medianPrice ? (delta / first.medianPrice) * 100 : 0;
  const prices = valid.map((item) => item.medianPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minIndex = prices.indexOf(minPrice);
  const maxIndex = prices.indexOf(maxPrice);
  const rangeRate = minPrice ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

  const tradeStats = observed;
  const tradeCounts = tradeStats.map(item => item.tradeCount);
  const sortedTrades = [...tradeCounts].sort((a, b) => a - b);
  const medianTrade = sortedTrades.length
    ? sortedTrades[Math.floor(sortedTrades.length / 2)]
    : 0;
  const firstTrades = tradeStats[0]?.tradeCount ?? 0;
  const lastTrades = tradeStats[tradeStats.length - 1]?.tradeCount ?? 0;
  const maxTrades = Math.max(...tradeCounts, 0);
  const tradeSurge = lastTrades >= 3 && firstTrades > 0 && lastTrades >= firstTrades * 1.6 && lastTrades - firstTrades >= 2;
  const tradeDrop = firstTrades >= 3 && lastTrades <= Math.max(1, Math.floor(firstTrades * 0.6)) && firstTrades - lastTrades >= 2;
  const tradeConcentration = maxTrades >= 5 && maxTrades >= Math.max(5, medianTrade * 1.7);

  baseScores.price = 35 + Math.min(35, Math.abs(rate) * 2.4);

  const firstBand = Math.floor(first.medianPrice / 100000000);
  const lastBand = Math.floor(last.medianPrice / 100000000);
  if (firstBand !== lastBand && Math.abs(rate) >= 5) baseScores.band = 94;

  if (tradeSurge || tradeDrop) baseScores.trade = Math.abs(rate) <= 3 ? 94 : 84;
  else if (tradeConcentration) baseScores.trade = 72;

  const priceUp = rate >= 4;
  const priceDown = rate <= -4;
  if ((priceUp && tradeDrop) || (priceDown && tradeSurge)) baseScores.mixed = 92;
  else if ((priceUp && lastTrades < firstTrades) || (priceDown && lastTrades > firstTrades)) baseScores.mixed = 70;

  const reboundedFromLow = minIndex > 0 && minIndex < valid.length - 1 && minPrice > 0 && ((last.medianPrice - minPrice) / minPrice) * 100 >= 5;
  const pulledBackFromHigh = maxIndex > 0 && maxIndex < valid.length - 1 && maxPrice > 0 && ((maxPrice - last.medianPrice) / maxPrice) * 100 >= 4;
  if (reboundedFromLow || pulledBackFromHigh) baseScores.rebound = 90;
  if (hasGap) baseScores.gap = 85;

  if (rangeRate >= 12) baseScores.volatility = 82;
  else if (rangeRate >= 8) baseScores.volatility = 68;

  const nearHigh = maxPrice > 0 && last.medianPrice >= maxPrice * 0.98;
  const nearLow = minPrice > 0 && last.medianPrice <= minPrice * 1.02;
  if (nearHigh || nearLow) baseScores.highlow = 74;

  if (Math.abs(rate) <= 3 && rangeRate <= 6) baseScores.stable = countChanged ? 70 : 88;
  else if (Math.abs(rate) <= 5 && rangeRate <= 8) baseScores.stable = 68;

  return (Object.keys(baseScores) as ArticleThemeId[])
    .map((id) => ({ id, ...ARTICLE_THEME_META[id], score: baseScores[id] }))
    .sort((a, b) => b.score - a.score);
}

export function selectArticleTheme(
  monthlyStats: MonthlyStat[],
  mode: ArticleThemeMode,
  recentThemes: ArticleThemeId[],
  recommendedAngle: string
): ArticleThemeChoice {
  const candidates = analyzeArticleThemes(monthlyStats);
  if (mode !== "auto") {
    const manual = candidates.find((item) => item.id === mode);
    if (manual) return manual;
  }

  // Preserve the strongest scene. Repetition can break a near tie, not invent a weaker story.
  const recent = new Set(recentThemes.slice(-2));
  return candidates.find(item => item.score >= candidates[0].score - 3 && !recent.has(item.id)) || candidates[0];
}

