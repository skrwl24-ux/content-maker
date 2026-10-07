"use client";

export type ApartmentRankingRow = {
  complex_id: string;
  year: number;
  transaction_count: number;
  national_rank: number;
  name: string;
  sido: string | null;
  sigungu: string | null;
  legal_dong: string | null;
  address: string | null;
  road_address: string | null;
  households: number | null;
  use_date: string | null;
};

export type ApartmentTradeRow = {
  contract_date: string;
  exclusive_area: number | string;
  area_group: number;
  price_won: number | string;
};

export type MonthlyPoint = {
  month: string;
  median: number | null;
  tradeCount: number;
};

export type AreaSnapshot = {
  areaGroup: number;
  displayName: string;
  exclusiveLabel: string;
  exclusiveMin: number;
  exclusiveMax: number;
  currentMedian: number | null;
  latestMonth: string | null;
  q1Count: number;
  q2Count: number;
  h2Count: number;
  totalCount: number;
  monthly: MonthlyPoint[];
};

export type DataSnapshot = {
  referenceDate: string;
  year: number;
  complex: ApartmentRankingRow;
  totalTransactions: number;
  rank: number;
  rankScopeLabel: string;
  areas: AreaSnapshot[];
};

const PYEONG_LABELS: Record<number, string> = {
  39: "17평대",
  49: "21평대",
  59: "24평대",
  74: "29평대",
  84: "34평대",
  101: "39평대",
  114: "45평대",
  135: "55평대",
};

export const DEFAULT_CHART_TEMPLATE = [
  "네이버 블로그 본문용 아파트 평형별 가격 흐름 이미지를 1장 만들어줘.",
  "",
  "[기준 디자인 — APT_PRICE_FLOW_V1]",
  "- 함께 제공된 기준 이미지를 가장 우선적인 레이아웃 레퍼런스로 사용할 것.",
  "- 목표 크기 1600×900, 가로형 한 장.",
  "- 전체는 밝은 흰색~연한 하늘색 배경, 상단에 은은한 아파트 스카이라인/조경을 넣되 데이터보다 튀지 않게 할 것.",
  "- 상단 중앙에 큰 제목: {{COMPLEX_NAME}} 평형별 가격 흐름",
  "- 제목 아래 부제: {{YEAR}}년 실거래 기준 · 평형별 현재 가격과 거래 흐름",
  "- 중앙에는 큰 둥근 모서리 차트 카드 1개.",
  "- 차트 상단 오른쪽에 평형별 범례를 가로로 배치.",
  "- Y축 제목은 가격(억원), X축은 1월부터 작성 기준월까지 월 단위.",
  "- 평형별 가격선을 서로 확실히 구분되는 색으로 표시하고 실제 거래가 있는 월에만 원형 마커를 찍을 것.",
  "- 거래가 없는 월은 데이터 점을 만들지 말 것. 앞뒤 실제 거래월 사이 선 연결은 가능하지만 값을 새로 만들거나 보간하지 말 것.",
  "- 각 평형선의 가장 오른쪽 실제 거래점 옆에 현재 대표가격을 컬러 배지로 크게 표시.",
  "- 하단에는 실제 존재하는 평형 수만큼 요약카드를 균형 있게 배치. 2개면 2개, 4개면 4개처럼 고정 4칸을 강제하지 말 것.",
  "- 각 카드에는 평형명, 정확한 전용면적 범위, 현재 대표가격, 현재 대표가격 기준월, 1~3월/4~6월/7월~현재 거래건수를 표시.",
  "- 현재 대표가격은 가장 최근 거래가 있는 월의 중앙값을 그대로 사용할 것.",
  "- 월 대표가격은 입력값 그대로 사용하고 임의 평균·보정·추세값·예측값을 만들지 말 것.",
  "- 월별 거래량 막대그래프는 만들지 말 것.",
  "- 평면도, 투자 전망, 신고가/저점 배지, 해석 문구, 추가 통계는 넣지 말 것.",
  "- 하단 출처 문구는 딱 한 줄만: {{SOURCE_LINE}}",
  "- 기준 이미지에 있는 예시 숫자·평형·주석은 복사하지 말고 아래 이번 단지 실제 데이터로 모두 교체할 것.",
  "",
  "[이번 단지 데이터]",
  "{{DATA_BLOCK}}"
].join("\n");

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(value);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function monthKeys(year: number, referenceDate: string) {
  const endMonth = Math.max(1, Math.min(12, Number(referenceDate.slice(5, 7)) || 12));
  return Array.from({ length: endMonth }, (_, index) => year + "-" + String(index + 1).padStart(2, "0"));
}

function areaDisplayName(areaGroup: number) {
  return PYEONG_LABELS[areaGroup] || "전용 " + areaGroup + "㎡대";
}

export function formatWon(price: number | null) {
  if (!price) return "-";
  const eok = price / 100000000;
  if (eok >= 10) return eok.toFixed(1).replace(/\.0$/, "") + "억";
  return eok.toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "억";
}

export function buildDataSnapshot(
  complex: ApartmentRankingRow,
  trades: ApartmentTradeRow[],
  referenceDate: string,
  rankScopeLabel: string
): DataSnapshot {
  const year = Number(referenceDate.slice(0, 4));
  const grouped = new Map<number, ApartmentTradeRow[]>();

  for (const trade of trades) {
    const group = Number(trade.area_group);
    if (!Number.isFinite(group)) continue;
    const current = grouped.get(group) || [];
    current.push(trade);
    grouped.set(group, current);
  }

  const months = monthKeys(year, referenceDate);
  const areas: AreaSnapshot[] = [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([areaGroup, rows]) => {
      const exactAreas = rows.map((row) => numberValue(row.exclusive_area)).filter((value) => value > 0);
      const monthly: MonthlyPoint[] = months.map((month) => {
        const matching = rows.filter((row) => String(row.contract_date || "").slice(0, 7) === month);
        const prices = matching.map((row) => numberValue(row.price_won)).filter((value) => value > 0);
        return {
          month,
          median: median(prices),
          tradeCount: matching.length,
        };
      });
      const latest = [...monthly].reverse().find((point) => point.median !== null) || null;
      const q1Count = rows.filter((row) => {
        const month = Number(String(row.contract_date).slice(5, 7));
        return month >= 1 && month <= 3;
      }).length;
      const q2Count = rows.filter((row) => {
        const month = Number(String(row.contract_date).slice(5, 7));
        return month >= 4 && month <= 6;
      }).length;
      const h2Count = rows.filter((row) => Number(String(row.contract_date).slice(5, 7)) >= 7).length;
      const minArea = exactAreas.length ? Math.min(...exactAreas) : areaGroup;
      const maxArea = exactAreas.length ? Math.max(...exactAreas) : areaGroup;

      return {
        areaGroup,
        displayName: areaDisplayName(areaGroup),
        exclusiveLabel: minArea === maxArea
          ? "전용 " + minArea.toFixed(1).replace(/\.0$/, "") + "㎡"
          : "전용 " + minArea.toFixed(1) + "~" + maxArea.toFixed(1) + "㎡",
        exclusiveMin: minArea,
        exclusiveMax: maxArea,
        currentMedian: latest?.median || null,
        latestMonth: latest?.month || null,
        q1Count,
        q2Count,
        h2Count,
        totalCount: rows.length,
        monthly,
      };
    });

  return {
    referenceDate,
    year,
    complex,
    totalTransactions: trades.length,
    rank: complex.national_rank,
    rankScopeLabel,
    areas,
  };
}


function researchPriceWon(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1000000 ? Math.round(value) : null;
  }
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) return null;
  const eok = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*억$/);
  if (eok) return Math.round(Number(eok[1]) * 100000000);
  const man = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*만(?:원)?$/);
  if (man) return Math.round(Number(man[1]) * 10000);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1000000 ? Math.round(n) : null;
}

function parseExclusiveRange(value: unknown, fallbackMin: number, fallbackMax: number) {
  const raw = String(value ?? "").replace(/㎡/g, "").trim();
  const nums = raw.match(/[0-9]+(?:\.[0-9]+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: fallbackMin, max: fallbackMax };
}

export function buildResearchSnapshot(base: DataSnapshot, result: any): DataSnapshot {
  const collection = result?.externalCollection;
  if (!collection?.performed || !Array.isArray(collection?.areaGroups) || !collection.areaGroups.length) {
    return base;
  }

  const months = monthKeys(base.year, base.referenceDate);
  const areas: AreaSnapshot[] = collection.areaGroups
    .filter((group: any) => Number.isFinite(Number(group?.areaGroup)))
    .map((group: any) => {
      const areaGroup = Number(group.areaGroup);
      const fallback = base.areas.find((area) => area.areaGroup === areaGroup);
      const range = parseExclusiveRange(
        group.exclusiveRange,
        fallback?.exclusiveMin ?? areaGroup,
        fallback?.exclusiveMax ?? areaGroup
      );
      const sourceMonthly = Array.isArray(group.monthly) ? group.monthly : [];

      const monthly: MonthlyPoint[] = months.map((month) => {
        const point = sourceMonthly.find((item: any) => String(item?.month || "") === month);
        return {
          month,
          median: researchPriceWon(point?.medianPriceWon ?? point?.medianPrice ?? null),
          tradeCount: Math.max(0, Number(point?.tradeCount) || 0),
        };
      });

      const latest = [...monthly].reverse().find((point) => point.tradeCount > 0 && point.median !== null) || null;
      const countByMonths = (from: number, to: number) => monthly
        .filter((point) => {
          const m = Number(point.month.slice(5, 7));
          return m >= from && m <= to;
        })
        .reduce((sum, point) => sum + point.tradeCount, 0);

      const totalCount = monthly.reduce((sum, point) => sum + point.tradeCount, 0);

      return {
        areaGroup,
        displayName: fallback?.displayName || areaDisplayName(areaGroup),
        exclusiveLabel: range.min === range.max
          ? "전용 " + range.min.toFixed(1).replace(/\.0$/, "") + "㎡"
          : "전용 " + range.min.toFixed(1) + "~" + range.max.toFixed(1) + "㎡",
        exclusiveMin: range.min,
        exclusiveMax: range.max,
        currentMedian: latest?.median ?? researchPriceWon(group.latestMedianPriceWon ?? group.latestMedianPrice ?? null),
        latestMonth: latest?.month || String(group.latestValidMonth || "") || null,
        q1Count: Number.isFinite(Number(group.q1Count)) ? Number(group.q1Count) : countByMonths(1, 3),
        q2Count: Number.isFinite(Number(group.q2Count)) ? Number(group.q2Count) : countByMonths(4, 6),
        h2Count: Number.isFinite(Number(group.h2Count)) ? Number(group.h2Count) : countByMonths(7, 12),
        totalCount,
        monthly,
      };
    })
    .sort((a, b) => a.areaGroup - b.areaGroup);

  if (!areas.length) return base;

  return {
    ...base,
    totalTransactions: areas.reduce((sum, area) => sum + area.totalCount, 0),
    areas,
  };
}

function dataLines(snapshot: DataSnapshot) {
  const lines: string[] = [];
  for (const area of snapshot.areas) {
    lines.push(area.displayName + " (" + area.exclusiveLabel + ")");
    for (const point of area.monthly) {
      lines.push("  " + point.month + " / 대표가격 " + (point.median ? formatWon(point.median) : "거래 없음") + " / 거래 " + point.tradeCount + "건");
    }
    lines.push("  현재 대표가격: " + formatWon(area.currentMedian));
    lines.push("  현재 대표가격 기준월: " + (area.latestMonth || "없음"));
    lines.push("  1~3월 거래: " + area.q1Count + "건");
    lines.push("  4~6월 거래: " + area.q2Count + "건");
    lines.push("  7월~현재 거래: " + area.h2Count + "건");
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function buildDataCheckPrompt(snapshot: DataSnapshot) {
  return [
    "아파트 단지 글에 사용할 2026년 실거래 자료를 웹에서 직접 조사·수집해줘.",
    "",
    "[목표]",
    "- 이 결과가 이후 가격 차트와 최종 블로그 글의 기준 자료가 된다.",
    "- 사이트에 적힌 숫자를 정답으로 가정하지 말고, 웹에서 독립적으로 자료를 조사한다.",
    "- 대상 단지의 2026년 1월 1일부터 기준일까지 실거래 자료를 수집한다.",
    "- 평형군별 월 거래건수와 월 대표가격 흐름을 정리한다.",
    "- 사이트 데이터는 누락·혼입을 발견하기 위한 참고 비교용으로만 사용한다.",
    "",
    "[수집 대상 기간]",
    snapshot.year + "-01-01 ~ " + snapshot.referenceDate,
    "",
    "[외부 수집 출처 우선순위]",
    "- 1순위: 국토교통부 실거래가 공개시스템, 공공데이터포털 등 공식 실거래 원문",
    "- 2순위: 공동주택관리정보, 지자체·공공기관·건설사 등 단지 기본정보 원문",
    "- 3순위: 공식 원문만으로 보조 확인이 필요한 경우 신뢰할 수 있는 부동산 공개자료",
    "- 최소 2개 출처를 확인하고, 그중 최소 1개는 공식·공공 출처여야 한다.",
    "",
    "[1단계 — 외부 자료 수집]",
    "- 단지명 + 법정동 + 주소를 함께 대조해 정확히 같은 단지를 확정한다.",
    "- 같은 이름의 다른 단지, 1차/2차, 블록, 인접 단지 거래가 섞이지 않도록 한다.",
    "- 2026년 1월부터 기준일까지 확인 가능한 정상 매매 거래를 수집한다.",
    "- 각 거래에서 최소한 계약일 또는 계약월, 전용면적, 거래가격을 확인한다.",
    "- 확인 가능한 경우 취소·해제·정정 여부도 같이 확인하고 정상 거래만 집계한다.",
    "- 해당 단지에서 실제 존재하는 전용면적군을 확인한다.",
    "- 외부 자료로 확인 가능한 범위에서 월별 거래건수와 월 대표가격을 정리한다.",
    "- JSON의 medianPriceWon/latestMedianPriceWon은 반드시 원 단위 정수로 넣는다. 예: 6억원이면 600000000.",
    "- 월 대표가격은 해당 평형군의 그 달 정상 거래가격 중앙값으로 계산한다.",
    "- 거래가 없는 달은 거래 없음/null로 유지하고 값을 만들지 않는다.",
    "",
    "[2단계 — 사이트 참고 데이터와 비교]",
    "- 사이트의 평형군/전용면적 범위와 외부에서 확인한 면적군을 비교한다.",
    "- 월별 거래건수를 비교한다.",
    "- 월 대표가격을 비교한다.",
    "- 1~3월, 4~6월, 7월~기준일 거래건수 합계를 비교한다.",
    "- 사이트의 최근 대표가격이 실제 거래가 있는 가장 최근 월의 중앙값인지 확인한다.",
    "- 사이트의 연간 누적 거래건수를 외부에서 정확히 확인할 수 있으면 비교한다.",
    "- 외부에서 연간 총건수를 정확히 확정할 수 없으면 annualCountMatch=null로 두고 억지로 pass 처리하지 않는다.",
    "",
    "[3단계 — 누락/혼입 원인 점검]",
    "- 사이트에 특정 월이 0건인데 외부 자료에는 거래가 있으면 dataGap=true.",
    "- 실거래 원문에서 단지명이 여러 이름으로 신고되는 경우 sourceNames에 모두 적는다.",
    "- 같은 K-apt 관리단지에 여러 신고 단지명이 대응될 가능성이 있으면 identityNeedsReview=true.",
    "- 다른 단지 거래가 섞인 정황이 있으면 mixedComplexSuspected=true.",
    "- 취소·해제 거래가 정상 거래로 포함된 정황이 있으면 cancellationIssue=true.",
    "",
    "[사이트 참고 데이터 — 조사 대상의 힌트일 뿐, 최종 자료로 그대로 복사하지 말 것]",
    "단지명: " + snapshot.complex.name,
    "지역: " + [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "주소: " + (snapshot.complex.road_address || snapshot.complex.address || "주소 정보 없음"),
    "세대수: " + (snapshot.complex.households ?? "확인 필요"),
    "사용승인일: " + (snapshot.complex.use_date || "확인 필요"),
    "기준일: " + snapshot.referenceDate,
    snapshot.rankScopeLabel + " 누적거래 순위: " + snapshot.rank + "위",
    "사이트 2026년 단지 전체 거래: " + snapshot.totalTransactions + "건",
    "",
    "[사이트 평형별 2026년 월 데이터]",
    dataLines(snapshot),
    "",
    "[판정 원칙]",
    "- 외부 자료 수집을 실제로 하지 못하면 status=warning, chartReady=false.",
    "- 2026년 월별 데이터에 누락이 확인되면 status=warning, chartReady=false.",
    "- 단지 식별이 불확실하면 status=warning, chartReady=false.",
    "- 최근 실거래 샘플과 사이트 데이터가 충돌하면 status=warning, chartReady=false.",
    "- chartReady는 외부 조사자료 자체가 충분하고 단지 식별이 확실할 때 true로 한다. 사이트 참고 데이터와 차이가 있다는 이유만으로 false로 만들지 말 것.",
    "- 사이트와 차이가 있으면 comparison/issues/warnings에 차이를 남기되, 신뢰할 수 있는 외부 조사자료가 완성됐다면 그 조사자료를 최종 기준으로 삼는다.",
    "",
    "[출력 형식 — 복사 버튼 한 번으로 가져갈 수 있게]",
    "- 반드시 하나의 ```json 코드블록으로 출력할 것.",
    "- JSON 안에는 웹 인용 UI를 섞지 말고, 출처는 sources 배열의 문자열로 정리할 것.",
    "",
    "```json",
    "{",
    '  "status": "warning",',
    '  "externalCollection": {',
    '    "performed": false,',
    '    "identityConfirmed": false,',
    '    "sourceNames": [],',
    '    "areaGroups": [',
    '      {',
    '        "areaGroup": 59,',
    '        "exclusiveRange": "59.7~59.8㎡",',
    '        "monthly": [',
    '          {"month":"2026-01","tradeCount":0,"medianPriceWon":null}',
    '        ],',
    '        "latestValidMonth": null,',
    '        "latestMedianPriceWon": null,',
    '        "q1Count": 0,',
    '        "q2Count": 0,',
    '        "h2Count": 0',
    '      }',
    '    ],',
    '    "recentTradeSamples": [],',
    '    "sources": []',
    "  },",
    '  "comparison": {',
    '    "areaGroupsMatch": null,',
    '    "monthlyCountsMatch": null,',
    '    "monthlyMediansMatch": null,',
    '    "periodCountsMatch": null,',
    '    "latestPriceRuleOk": null,',
    '    "annualCountMatch": null',
    "  },",
    '  "issues": {',
    '    "dataGap": false,',
    '    "identityNeedsReview": false,',
    '    "mixedComplexSuspected": false,',
    '    "cancellationIssue": false',
    "  },",
    '  "warnings": [],',
    '  "chartReady": false',
    "}",
    "```"
  ].join("\n");
}

export function buildStructurePrompt(snapshot: DataSnapshot, needsCheckGroups: number[]) {
  const areas = snapshot.areas.filter((area) => needsCheckGroups.includes(area.areaGroup));
  return [
    "아파트 평형별 방·욕실 구조를 웹 검색으로 사실 확인해줘.",
    "",
    "[대상 단지]",
    "단지명: " + snapshot.complex.name,
    "지역: " + [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "주소: " + (snapshot.complex.road_address || snapshot.complex.address || "주소 정보 없음"),
    "",
    "[확인할 평형]",
    ...areas.map((area) => "- areaGroup " + area.areaGroup + " / " + area.displayName + " / " + area.exclusiveLabel),
    "",
    "[검증 원칙 — 반드시 지킬 것]",
    "- 반드시 웹 검색을 실제로 수행할 것.",
    "- 공식 분양자료, 건설사 원문, 공공기관·지자체·공동주택 관련 원문을 최우선으로 확인할 것.",
    "- 면적만 보고 방·욕실 수를 추정하지 말 것.",
    "- 같은 전용면적에 A/B/C 등 여러 타입이 있으면 타입별 방·욕실 수가 같은지 확인할 것.",
    "- 같은 평형군의 실제 타입별 방·욕실 수가 다르면 status=varies.",
    "- 신뢰할 만한 원문으로 확정하면 status=verified.",
    "- 자료가 불충분하거나 서로 충돌하면 status=needs_check로 두고 rooms/baths는 null.",
    "- 확인이 어렵다고 판단한 항목을 억지로 채우지 말 것.",
    "- 다른 단지나 같은 이름의 인접 단지 평면도를 섞지 말 것.",
    "",
    "[출력 형식 — 복사 버튼 한 번으로 가져갈 수 있게]",
    "- 반드시 ```json 코드블록 하나로 출력할 것.",
    "- 코드블록 안에는 유효한 JSON만 넣을 것.",
    "- 출처 칩·웹 인용 UI는 JSON 문자열 안에 넣지 말 것.",
    "",
    "```json",
    "{",
    '  "areas": [',
    '    {',
    '      "areaGroup": 84,',
    '      "rooms": null,',
    '      "baths": null,',
    '      "status": "needs_check",',
    '      "source": "",',
    '      "note": ""',
    "    }",
    "  ]",
    "}",
    "```"
  ].join("\n");
}

export function buildLifeKickPrompt(snapshot: DataSnapshot) {
  return [
    "아파트 단지의 생활·입지 킥을 웹 검색으로 1개만 조사해줘.",
    "",
    "[대상]",
    "단지명: " + snapshot.complex.name,
    "지역: " + [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "주소: " + (snapshot.complex.road_address || snapshot.complex.address || "주소 정보 없음"),
    "",
    "[목표]",
    "이 아파트에 실제로 살 때 의미가 큰 대표 생활 요소 1개만 고른다.",
    "후보: 대형마트·트레이더스·코스트코·주요 역·중심상권·전통시장·공원·호수·하천·산책로·도서관·문화시설·체육시설·지역 대표 축제·가족생활 시설.",
    "",
    "[검증 원칙 — 반드시 지킬 것]",
    "- 반드시 웹 검색을 실제로 수행할 것.",
    "- 지자체·공공기관·운영기관·공식 시설 페이지 등 최신 공식자료를 우선 확인할 것.",
    "- 현재 운영 여부와 정확한 시설/역/공원 지점을 확인할 것.",
    "- 단지와 실제 같은 생활권에서 이용 가능한지 확인할 것.",
    "- 생활 킥이 역·마트·시장·공원·도서관 등 실제 방문 지점이라면 도보 경로도 추가로 확인할 것.",
    "- 도보 시간·거리는 지도/길찾기 결과나 경로 자료에서 실제 경로가 확인된 경우에만 입력할 것.",
    "- 직선거리로 도보시간을 계산하거나 평균 보행속도로 추정하지 말 것.",
    "- 도보 경로 시작점과 도착점을 명확히 적을 것. 역이면 가능하면 출구 번호까지 확인할 것.",
    "- 경로 자료가 없거나 검색 결과를 신뢰하기 어려우면 walkingVerified=false, walkingMinutes=null, walkingDistanceM=null.",
    "- 축제는 " + snapshot.year + "년 실제 개최 여부를 공식 자료로 확인한 경우에만 선택할 것.",
    "- 광고성 표현이나 '초역세권·바로 앞·도보권' 같은 과장 표현은 근거 없으면 쓰지 말 것.",
    "- 내부적으로 여러 후보를 비교해도 최종 출력은 가장 강한 1개만.",
    "- 적절한 킥을 검증하지 못하면 kickFound=false.",
    "",
    "[출력 형식 — 복사 버튼 한 번으로 가져갈 수 있게]",
    "- 반드시 ```json 코드블록 하나로 출력할 것.",
    "- 코드블록 안에는 유효한 JSON만 넣을 것.",
    "- 출처 칩·웹 인용 UI는 JSON 문자열 안에 넣지 말 것.",
    "",
    "```json",
    "{",
    '  "kickFound": false,',
    '  "title": "",',
    '  "category": "",',
    '  "summary": "",',
    '  "walkingVerified": false,',
    '  "walkingMinutes": null,',
    '  "walkingDistanceM": null,',
    '  "routeFrom": "",',
    '  "routeTo": "",',
    '  "routeSource": {"name":"","url":"","checked":""},',
    '  "sourceText": "",',
    '  "sources": [],',
    '  "verified": false',
    "}",
    "```"
  ].join("\n");
}

export function buildChartPrompt(snapshot: DataSnapshot, template: string) {
  const sourceLine = snapshot.referenceDate.replace(/-/g, ".") + " 기준 · 국토부 실거래 자료";
  const filled = template
    .replaceAll("{{COMPLEX_NAME}}", snapshot.complex.name)
    .replaceAll("{{YEAR}}", String(snapshot.year))
    .replaceAll("{{SOURCE_LINE}}", sourceLine)
    .replaceAll("{{DATA_BLOCK}}", dataLines(snapshot));
  const guard = [
    "",
    "[이번 제작에서 반드시 유지할 규칙]",
    "- 첨부한 APT_PRICE_FLOW_V1 기준 이미지의 정보 구조와 배치를 우선적으로 따라갈 것.",
    "- 기준 이미지의 예시 숫자·평형·주석은 복사하지 말고 이번 단지 실제 데이터로 교체할 것.",
    "- 거래 없는 월에는 점을 만들지 말 것. 실제 거래월 사이 선 연결은 가능하지만 값 보간은 금지.",
    "- 하단 평형 카드는 실제 존재하는 평형 수만큼만 만들 것.",
    "- 출처는 '" + sourceLine + "' 한 줄만 표시할 것.",
    "- 그 밖의 추가 주석·투자 해석·신고가/저점 배지·평면도는 넣지 말 것."
  ].join("\n");
  if (filled.includes("{{")) {
    return filled + "\n\n[데이터]\n" + dataLines(snapshot) + "\n" + sourceLine + guard;
  }
  return filled + guard;
}

export function buildLifeImagePrompt(
  snapshot: DataSnapshot,
  kick: {
    title: string;
    category?: string;
    summary: string;
    walkingVerified?: boolean;
    walkingMinutes?: number | null;
    walkingDistanceM?: number | null;
    routeFrom?: string;
    routeTo?: string;
  }
) {
  const walkingLine = kick.walkingVerified && kick.walkingMinutes
    ? "검증된 도보 정보: " + (kick.routeFrom || "단지") + " → " + (kick.routeTo || kick.title) + " / 약 " + kick.walkingMinutes + "분" +
      (kick.walkingDistanceM ? " / " + kick.walkingDistanceM + "m" : "")
    : "";

  return [
    "네이버 블로그 본문용 아파트 생활·입지 이미지 1장을 만들어줘.",
    "",
    "[단지]",
    snapshot.complex.name + " / " + [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "",
    "[검증 완료된 생활 킥 — 이것만 사용]",
    kick.title,
    kick.category ? "종류: " + kick.category : "",
    kick.summary,
    walkingLine,
    "",
    "[제작 규칙]",
    "- 1600×900 가로형 한 장.",
    "- 검증 완료된 생활 킥 1개만 시각화할 것. 다른 시설·역·공원·상권을 새로 추가하지 말 것.",
    "- 실제 생활에서 왜 의미 있는지 한눈에 이해되는 장면으로 구성할 것.",
    "- 위에 '검증된 도보 정보'가 있을 때만 도보 시간·거리를 표시할 것.",
    "- 검증된 도보 정보가 없으면 거리·도보시간·차량시간을 새로 만들지 말 것.",
    "- 실제 브랜드/기관 로고를 임의로 변형하거나 복제하지 말 것.",
    "- 과장된 광고·네온·3D 인포그래픽 느낌보다 자연스럽고 신뢰감 있는 블로그 정보 이미지.",
    "- 하단에 별도 출처문구나 새로운 사실을 추가하지 말 것."
  ].filter(Boolean).join("\n");
}

export function buildThumbnailPrompt(snapshot: DataSnapshot) {
  return [
    "네이버 블로그용 아파트 단지 글 썸네일 이미지를 1장 만들어줘.",
    "",
    "[고정 문구 — 다른 글자 추가 금지]",
    snapshot.complex.name + " 얼마일까?",
    "",
    "[제작 규칙]",
    "- 1254×1254px, 1:1 정사각형.",
    "- 문구는 정확히 '" + snapshot.complex.name + " 얼마일까?'만 사용하고 부제·가격·평형·지역·숫자 추가 금지.",
    "- 문구는 1~2줄 카드형으로 크고 선명하게.",
    "- 색상은 2~3개 안에서 정돈하고 배경과 글자 대비를 충분히 확보.",
    "- 아파트 조감도/주거단지 느낌을 자연스럽게 사용하되 실제 특정 동 배치나 건축 디테일을 사실처럼 만들어내지 말 것.",
    "- 네이버 블로그 운영자가 직접 편집한 것처럼 깔끔하고 신뢰감 있게.",
    "- 과도한 AI 느낌, 네온, 번쩍이는 효과, 복잡한 아이콘, 불필요한 배지 금지."
  ].join("\n");
}

export function buildFinalArticlePrompt(
  snapshot: DataSnapshot,
  structures: Array<{ area_group: number; room_count: number | null; bath_count: number | null; status: string }>,
  kick: {
    title: string;
    summary: string;
    walkingVerified?: boolean;
    walkingMinutes?: number | null;
    walkingDistanceM?: number | null;
    routeFrom?: string;
    routeTo?: string;
  },
  includeStructure: boolean
) {
  const structureLines = structures
    .filter((item) => item.status === "verified" || item.status === "varies")
    .map((item) => {
      const area = snapshot.areas.find((candidate) => candidate.areaGroup === item.area_group);
      const label = area ? area.displayName + " / " + area.exclusiveLabel : "전용 " + item.area_group + "㎡대";
      if (item.status === "varies") return "- " + label + " / 타입별 상이";
      return "- " + label + " / 방 " + item.room_count + " / 욕실 " + item.bath_count;
    });

  return [
    "네이버 블로그용 아파트 단지 글을 최종 발행본으로 작성해줘.",
    "",
    "[작성 기준일]",
    snapshot.referenceDate.replace(/-/g, "."),
    "",
    "[고정 제목]",
    snapshot.complex.name + " 얼마일까?",
    "",
    "[이 글의 목적]",
    "- 독자가 지금 가격, 어떤 평형이 있는지, 방·욕실 구조, 2026년 가격·거래 흐름, 생활 킥 1개를 빠르게 확인하게 한다.",
    "- 길게 분석하는 투자글이 아니라 실제 데이터 확인형 단지 글이다.",
    "",
    "[가장 중요한 원칙]",
    "- 아래에 모아둔 조사자료만 사용할 것.",
    "- 새 가격·새 거래건수·새 변화율·새 거리·새 생활시설을 만들어내지 말 것.",
    "- 제공되지 않은 방·욕실 수를 면적만 보고 추정하지 말 것.",
    "- 반등·심리·호재·저점·고점·매수추천 같은 투자 해석을 길게 하지 말 것.",
    "- 가격 흐름은 월 대표가격의 실제 방향을 1~2문장으로만 짧게 설명할 것.",
    "- 거래 없는 월의 값을 보간하거나 거래가 있었던 것처럼 쓰지 말 것.",
    "- 생활 킥은 아래 검증 완료된 1개만 사용할 것.",
    "- 모바일에서 읽기 쉽게 문장마다 한 줄씩 띄울 것.",
    "",
    "[저장된 2026년 실거래 조사자료]",
    dataLines(snapshot),
    "",
    includeStructure ? "[확인된 평형 구조]" : "[평형 구조]",
    includeStructure && structureLines.length ? structureLines.join("\n") : "구조 섹션 제외",
    "",
    "[저장된 생활·입지 조사자료]",
    kick.title,
    kick.summary,
    ...(kick.walkingVerified && kick.walkingMinutes ? [
      "검증된 도보 정보: " + (kick.routeFrom || "단지") + " → " + (kick.routeTo || kick.title) + " / 약 " + kick.walkingMinutes + "분" +
        (kick.walkingDistanceM ? " / " + kick.walkingDistanceM + "m" : "")
    ] : []),
    "",
    "[최종 글 구성 — 순서 고정]",
    "제목: " + snapshot.complex.name + " 얼마일까?",
    "짧은 도입: 이 단지의 2026년 평형별 현재 가격과 거래 흐름을 확인한다는 내용 2~3문장.",
    "목차:",
    "1. 평형별 지금 가격은 얼마일까?",
    ...(includeStructure && structureLines.length
      ? ["2. 평형별 구조는 어떻게 다를까?", "3. 여기 살면 어떤 점이 좋을까?"]
      : ["2. 여기 살면 어떤 점이 좋을까?"]),
    "",
    "[1번 섹션]",
    "- [평형별 가격 흐름 차트 이미지]를 한 줄로 표시.",
    "- 주요 평형의 현재 대표가격을 짧게 정리.",
    "- 2026년 월별 대표가격 흐름을 근거로 1~2문장만 설명.",
    "- 별도 투자 해석은 하지 말 것.",
    "",
    ...(includeStructure && structureLines.length ? [
      "[2번 섹션]",
      "- 확인된 정보만 표 형태로 정리: 평형대 | 전용면적 | 방 | 욕실.",
      "- status=varies인 경우 숫자를 억지로 하나로 만들지 말고 '타입별 상이'라고 표시.",
      ""
    ] : []),
    "[생활 킥 섹션]",
    "- [생활 킥 이미지]를 한 줄로 표시.",
    "- 검증된 킥이 실제 생활에서 어떤 의미가 있는지 짧은 생활 시나리오 느낌으로 2~4문장.",
    "- 검증된 도보 정보가 제공된 경우에만 '도보 약 ○분'과 확인된 거리 정보를 자연스럽게 포함할 것.",
    "- 도보 정보가 제공되지 않았으면 거리나 시간을 추정해서 넣지 말 것.",
    "- 직접 살아본 후기처럼 쓰지 말 것.",
    "",
    "[마무리]",
    "- 2~3문장으로 짧게 끝낼 것.",
    "- 매수·매도 권유 금지.",
    "",
    "[출처 표기 — 마지막에 한 줄만]",
    snapshot.referenceDate.replace(/-/g, ".") + " 기준 · 국토부 실거래 자료",
    "",
    "[출력 형식 — 복사 버튼 한 번으로 가져갈 수 있게]",
    "- 최종 글 전체를 ```text 코드블록 하나로 출력할 것.",
    "- 코드블록 밖에는 설명을 붙이지 말 것.",
    "- 해시태그나 별도 SEO 메모를 추가하지 말 것."
  ].join("\n");
}

export function safeParseJson(raw: string) {
  const cleaned = raw.trim()
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/^\`\`\`\s*/i, "")
    .replace(/\s*\`\`\`$/, "");
  return JSON.parse(cleaned);
}
