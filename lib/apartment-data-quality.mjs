/** Informational data-quality hints. An absent match is never proof of no sale. */
export function assessApartmentDataQuality(input = {}) {
  const monthly = Array.isArray(input.monthly) ? input.monthly : [];
  const area = input.representativeArea ?? null;
  const count = Number(input.sixMonthCount ?? 0);
  const analysisMonth = String(input.analysisDate || "").slice(0, 7);
  const observed = monthly.filter(row =>
    Number(row.tradeCount ?? row.trade_count ?? 0) > 0 &&
    (row.medianPrice ?? row.median_price) != null
  );
  const notes = [];
  if (area == null || count === 0) {
    notes.push("연결된 분석기간 거래가 없거나 대표 면적이 미확정입니다. 0건을 실제 무거래로 단정하지 말고 미연결 원자료와 수집 상태를 확인하세요.");
  }
  if (observed.length && observed.length < 2) {
    notes.push("대표가격이 확인된 월이 1개뿐이므로 6개월 가격 상승·하락 추세를 판단할 수 없습니다.");
  }
  const singleMonths = observed
    .filter(row => Number(row.tradeCount ?? row.trade_count) === 1)
    .map(row => String(row.month ?? row.year_month));
  if (singleMonths.length) {
    notes.push(singleMonths.join(", ") + "은 거래 1건의 가격이 그대로 월 대표값입니다. 시장 전체의 가격 수준으로 일반화하지 마세요.");
  }
  const current = monthly.find(row => String(row.month ?? row.year_month) === analysisMonth);
  if (current) {
    notes.push(analysisMonth + "은 진행 중인 월이며 신고·정정·해제 자료가 추가되면 가격과 건수가 달라질 수 있습니다.");
  }
  return {
    notes,
    observedMonths: observed.length,
    singleTradeMonths: singleMonths,
    matchingPending: area == null || count === 0,
    trendReady: area != null && count > 0 && observed.length >= 2,
  };
}
