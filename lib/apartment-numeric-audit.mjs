/**
 * Audit the article against the same six-month numbers supplied to the author.
 * A separate source reconciliation compares stored monthly aggregates with stored
 * individual non-cancelled contracts. Neither step represents a live MOLIT query.
 */
const WON = 100_000_000;
const MONTH = 10_000;
const moneyPattern = /(?<![\d.])(\d[\d,]*(?:\.\d+)?)\s*억(?:\s*(\d[\d,]*(?:\.\d+)?)\s*만(?:원)?)?|(?<![\d.])(\d[\d,]*(?:\.\d+)?)\s*만(?:원)?/g;
const monthPattern = /(?<!\d)(?:(?:20\d{2})[\s./년-]*)?(0?[1-9]|1[0-2])\s*월(?!\s*\d{1,2}\s*일)/g;
const countPattern = /(\d[\d,]*)\s*건/g;
const numeric = value => Number(String(value ?? "").replace(/,/g, ""));
const monthKey = value => String(value || "").slice(0, 7);
const monthNumber = value => Number(monthKey(value).slice(-2));
const wonText = won => {
  if (!Number.isFinite(won)) return "미확인";
  const eok = Math.floor(won / WON);
  const man = Math.round((won - eok * WON) / MONTH);
  return eok ? eok + "억" + (man ? " " + man.toLocaleString("ko-KR") + "만원" : "") : man.toLocaleString("ko-KR") + "만원";
};
function moneyMatches(text) {
  return [...String(text || "").matchAll(moneyPattern)].map(match => ({
    raw: match[0],
    index: match.index,
    won: match[1] != null
      ? numeric(match[1]) * WON + (match[2] ? numeric(match[2]) * MONTH : 0)
      : numeric(match[3]) * MONTH,
  }));
}
function countMatches(text) {
  return [...String(text || "").matchAll(countPattern)].map(match => ({
    raw: match[0], index: match.index, count: numeric(match[1]),
  }));
}
function monthMatches(text) {
  return [...String(text || "").matchAll(monthPattern)].map(match => ({
    month: Number(match[1]), index: match.index, end: match.index + match[0].length,
  }));
}
function numberEqual(a, b, threshold = 5000) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= threshold;
}
function previousMonth(month) {
  return month === 1 ? 12 : month - 1;
}

/**
 * Recompute six monthly medians and counts from the stored, non-cancelled
 * individual contracts. Caller must filter complex and area group first.
 */
export function reconcileMonthlyWithTrades(monthly, rawTrades, { truncated = false } = {}) {
  if (!Array.isArray(monthly) || !monthly.length || !Array.isArray(rawTrades) || truncated) {
    return { status: "unavailable", comparedMonths: 0, rawTradeCount: 0, mismatches: [],
      reason: truncated ? "개별 계약이 조회 상한을 초과했습니다." : "원본 개별 계약 또는 월별 통계를 가져오지 못했습니다." };
  }
  const recent = monthly.slice(-6);
  const wanted = new Set(recent.map(item => monthKey(item.month ?? item.year_month)));
  const buckets = new Map([...wanted].map(key => [key, []]));
  for (const row of rawTrades) {
    const date = String(row.contract_date || "");
    const key = date.slice(0, 7);
    if (!buckets.has(key)) continue;
    if (row.cancelled === true) continue;
    const amount = Number(row.price_won);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {status:"unavailable",comparedMonths:0,rawTradeCount:0,mismatches:[],reason:"개별 계약의 가격 값이 올바르지 않습니다."};
    }
    buckets.get(key).push(amount);
  }
  const mismatches = [];
  for (const row of recent) {
    const key = monthKey(row.month ?? row.year_month);
    const amounts = (buckets.get(key) || []).sort((a,b) => a-b);
    const expectedCount = Number(row.tradeCount ?? row.trade_count);
    const median = amounts.length
      ? amounts.length % 2
        ? amounts[(amounts.length - 1)/2]
        : (amounts[amounts.length/2-1] + amounts[amounts.length/2])/2
      : null;
    const storedMedianValue = row.medianPrice ?? row.median_price;
    const storedMedian = storedMedianValue == null ? null : Number(storedMedianValue);
    if (expectedCount !== amounts.length) {
      mismatches.push(key + " 거래수: 월별 통계 " + expectedCount + "건 / 개별 계약 " + amounts.length + "건");
    }
    if ((storedMedian == null) !== (median == null)
      || (storedMedian != null && median != null && !numberEqual(storedMedian, median))) {
      mismatches.push(key + " 대표가격: 월별 통계 " + (storedMedian == null ? "없음" : wonText(storedMedian))
        + " / 개별 계약 중앙값 " + (median == null ? "없음" : wonText(median)));
    }
  }
  return {
    status: mismatches.length ? "mismatch" : "matched",
    comparedMonths: recent.length,
    rawTradeCount: [...buckets.values()].reduce((sum, amounts) => sum + amounts.length, 0),
    mismatches: mismatches.slice(0, 10),
    reason: "",
  };
}

/**
 * Compare unambiguous month-attached figures in the finished draft.
 * A statement with a value absent or grammatically ambiguous is not
 * silently treated as verified; the coverage count is reported.
 */
export function auditArticleFigures({
  body = "", monthly = [], latestTradePrice = null, sourceKind = "input",
  sourceAudit = null,
} = {}) {
  const rows = (Array.isArray(monthly) ? monthly : []).slice(-6);
  if (!rows.length) return [{
    status:"review",label:"실거래 자료 연결 대기",
    detail:"월별 기준 자료가 연결되지 않았습니다. 단지를 자동 선택해 가격·거래 데이터를 불러오면 원고 수치를 자동 대조할 수 있습니다.",
  }];
  const byMonth = new Map(rows.map(row => [monthNumber(row.month), row]));
  const checks = [];
  const problems = [];
  const seenProblems = new Set();
  const found = { prices:0, trades:0, deltas:0, rates:0, latest:0 };
  const report = (problem) => {
    if (!seenProblems.has(problem)) { problems.push(problem); seenProblems.add(problem); }
  };
  const draftLines = String(body || "").replace(/\\#/g, "#").split(/\r?\n/)
    .map(line => line.replace(/\*+/g, "").trim())
    .filter(line => line && !/^#|^\[\s*이미지/.test(line));
  const valid = rows.filter(row => row.medianPrice != null && Number(row.medianPrice) > 0);
  const first = valid[0], last = valid[valid.length-1];
  const elapsed = first && last ? Number(last.medianPrice) - Number(first.medianPrice) : null;
  const overallRate = first && last && Number(first.medianPrice)
    ? 100 * elapsed / Number(first.medianPrice) : null;
  for (const line of draftLines) {
    const months = monthMatches(line).filter(match => byMonth.has(match.month));
    const seenMonths = [...new Set(months.map(item => item.month))];
    const money = moneyMatches(line);
    const counts = countMatches(line);
    for (let index = 0; index < months.length; index++) {
      const anchor = months[index];
      const row = byMonth.get(anchor.month);
      const part = line.slice(anchor.end, months[index+1]?.index ?? line.length);
      const partMoney = moneyMatches(part);
      const partCounts = countMatches(part);
      if (partMoney.length && row.medianPrice != null) {
        const lead = part.slice(0, partMoney[0].index);
        // Ignore a difference amount ('4월과 9월 차이 7,300만원')
        // and any explicitly individual transaction ('최근 개별 실거래').
        if (!/차이|차액|변화폭|변화액|증가폭|하락폭|상승폭|고저|전월보다|개별\s*실거래/.test(lead)
          && partMoney[0].index <= 65) {
          found.prices++;
          if (!numberEqual(partMoney[0].won, Number(row.medianPrice))) {
            report(anchor.month + "월 대표값: 원고 " + partMoney[0].raw + " / 기준 " + wonText(Number(row.medianPrice)));
          }
        }
      }
      if (partCounts.length && partCounts[0].index <= 68
        && !/차이|증감|전월보다/.test(part.slice(0, partCounts[0].index))) {
        found.trades++;
        if (partCounts[0].count !== Number(row.tradeCount)) {
          report(anchor.month + "월 거래량: 원고 " + partCounts[0].raw + " / 기준 " + Number(row.tradeCount) + "건");
        }
      }
    }
    // A sentence containing two comparison months can state an explicit
    // difference. The last amount is the difference only if there are
    // 3+ monetary figures (two month prices plus the difference), or one
    // monetary figure (the difference alone).
    if (seenMonths.length >= 2) {
      const left = byMonth.get(seenMonths[0]);
      const right = byMonth.get(seenMonths[seenMonths.length-1]);
      const diffClaim = /차이|변화액|증감|변화폭|고저|상승폭|하락폭|감소폭/.test(line);
      if (diffClaim && money.length && (money.length === 1 || money.length >= 3)
        && left.medianPrice != null && right.medianPrice != null) {
        const claimed = money[money.length-1];
        const expected = Math.abs(Number(right.medianPrice) - Number(left.medianPrice));
        found.deltas++;
        if (!numberEqual(claimed.won, expected)) {
          report(seenMonths[0] + "→" + seenMonths[seenMonths.length-1] + "월 가격 차이: 원고 "
            + claimed.raw + " / 기준 " + wonText(expected));
        }
      }
      if (/감소|증가|줄어|늘어|차이/.test(line) && counts.length >= 3) {
        const expected = Math.abs(Number(right.tradeCount) - Number(left.tradeCount));
        found.deltas++;
        const claimed = counts[counts.length-1];
        if (claimed.count !== expected) report(seenMonths[0] + "→" + seenMonths[seenMonths.length-1]
          + "월 거래량 차이: 원고 " + claimed.raw + " / 기준 " + expected + "건");
      }
    } else if (seenMonths.length === 1 && /전월보다/.test(line)) {
      const month = seenMonths[0];
      const now = byMonth.get(month);
      const prior = byMonth.get(previousMonth(month));
      if (prior && now) {
        if (money.length >= 2 && now.medianPrice != null && prior.medianPrice != null) {
          found.deltas++;
          const claimed = money[money.length-1];
          const expected = Math.abs(Number(now.medianPrice) - Number(prior.medianPrice));
          if (!numberEqual(claimed.won, expected)) report(month + "월 전월 대비 가격 차이: 원고 "
            + claimed.raw + " / 기준 " + wonText(expected));
        }
        if (counts.length >= 2) {
          found.deltas++;
          const claimed = counts[counts.length-1], expected = Math.abs(Number(now.tradeCount)-Number(prior.tradeCount));
          if (claimed.count !== expected) report(month + "월 전월 대비 거래량 차이: 원고 "
            + claimed.raw + " / 기준 " + expected + "건");
        }
      }
    }
    const pct = [...line.matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g)];
    if (overallRate != null && pct.length && (
      (seenMonths.length >= 2 && seenMonths.includes(monthNumber(first.month)) && seenMonths.includes(monthNumber(last.month)))
      || /(?:최근\s*)?6개월|변화율|고저.*?차이/.test(line)
    )) {
      found.rates++;
      const stated = numeric(pct[0][1]);
      if (Math.abs(stated-overallRate) > .16) {
        report("비교 기간 변화율: 원고 " + pct[0][0] + " / 기준 " + overallRate.toFixed(1) + "%");
      }
    }
    if (Number.isFinite(latestTradePrice) && latestTradePrice > 0
      && /최근\s*(?:개별\s*)?실거래(?:가|가격)/.test(line) && money.length) {
      // Do not confuse the comparison value that precedes the 'recent trade' phrase.
      const start = line.search(/최근\s*(?:개별\s*)?실거래(?:가|가격)/);
      const inClause = moneyMatches(line.slice(start));
      if (inClause.length) {
        found.latest++;
        if (!numberEqual(inClause[0].won, Number(latestTradePrice))) {
          report("최근 개별 실거래가: 원고 " + inClause[0].raw + " / 기준 " + wonText(Number(latestTradePrice)));
        }
      }
    }
  }
  if (problems.length) checks.push({
    status:"warning",label:"실거래 숫자 불일치 · " + problems.length + "곳",
    detail:problems.slice(0, 8).join(" / ") + (problems.length > 8 ? " 외 " + (problems.length-8) + "곳" : "") + ". 해당 숫자를 수정한 뒤 발행하세요.",
  });
  const total = Object.values(found).reduce((a,b)=>a+b,0);
  checks.push({
    status: total ? (problems.length ? "review" : "pass") : "review",
    label: total ? "실거래 숫자 자동 대조" : "월별 수치 표현 감지 대기",
    detail: total
      ? "기준 월별 데이터와 가격 " + found.prices + "곳·거래량 " + found.trades
        + "곳·증감 " + found.deltas + "곳·변화율 " + found.rates
        + "곳·최근 개별 계약 " + found.latest + "곳, 총 " + total + "개 명시적 주장을 자동 대조했습니다."
        + (problems.length ? " 위 불일치를 확인하세요." : " 대조 가능한 표현에서 불일치를 발견하지 못했습니다.")
      : "문맥이 명확한 월별 가격·거래량을 찾지 못했습니다. 원고에 월별 자료와 기준이 명시돼 있는지 확인하세요.",
  });
  if (sourceKind === "db" && sourceAudit?.status === "matched") {
    checks.push({
      status:"pass",label:"사이트 수집 DB · 개별 계약 재계산",
      detail:"동일 단지·대표 면적의 취소되지 않은 개별 계약 " + sourceAudit.rawTradeCount
        + "건으로 최근 " + sourceAudit.comparedMonths + "개월 거래수·가격 중앙값을 다시 계산해 저장된 월별 통계와 대조했습니다.",
    });
  } else if (sourceKind === "db" && sourceAudit?.status === "mismatch") {
    checks.push({
      status:"warning",label:"수집 데이터 자체 불일치",
      detail:sourceAudit.mismatches.slice(0,5).join(" / ") + ". 데이터 수집·집계 기준을 재확인하기 전 발행을 보류하세요.",
    });
  } else {
    checks.push({
      status:"review",label:"원본 데이터의 검증 범위",
      detail:sourceKind === "db"
        ? "개별 계약 재조회가 완료되지 않아 사이트에 저장된 월별 자료까지만 대조했습니다. " + (sourceAudit?.reason || "")
        : "현재 편집창에 입력된 월별 수치를 기준으로 자동 대조했습니다. 수집 DB에서 자동 선택한 단지가 아니므로 외부 계약 원본의 정확성까지 보장하지 않습니다.",
    });
  }
  return checks;
}
