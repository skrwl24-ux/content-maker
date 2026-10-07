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
  "네이버 블로그 본문용 아파트 시세 차트 이미지를 1장 만들어줘.",
  "",
  "[고정 디자인]",
  "- 1600×900 가로형",
  "- 밝은 흰색/연한 배경, 상단에는 은은한 아파트 실루엣과 생활권 느낌",
  "- 제목: {{COMPLEX_NAME}} 평형별 가격 흐름",
  "- 부제: {{YEAR}}년 실거래 기준 · 평형별 현재 가격과 거래 흐름",
  "- 평형별 월 대표가격을 하나의 큰 선 그래프에 서로 다른 색 선으로 표시",
  "- 각 선의 오른쪽 끝에는 현재 대표가격을 크게 표시",
  "- 하단에는 평형별 정보카드를 나란히 배치",
  "- 각 카드에는 평형명, 전용면적대, 현재 대표가격, 1~3월/4~6월/7월~현재 거래건수 표시",
  "- 월별 거래량 막대그래프는 만들지 말 것",
  "- 평면도는 넣지 말 것",
  "- 거래 없는 달의 값을 새로 만들거나 보간하지 말 것",
  "- 입력된 숫자는 변경하거나 재계산하지 말 것",
  "- 출처 문구는 하단에 작게 한 줄만 표시: {{SOURCE_LINE}}",
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
    "아파트 단지 글용 데이터 검수를 해줘.",
    "",
    "[중요]",
    "- 이 단계에서는 글의 관점이나 스토리를 만들지 말 것.",
    "- 반등, 심리, 호재 같은 해석을 하지 말 것.",
    "- 제공된 숫자를 임의로 보정하거나 새로 만들지 말 것.",
    "- 단지명이 다른 데이터가 섞였는지, 월 대표가격 누락/보간이 있는지, 기간별 거래량과 총건수가 논리적으로 맞는지 확인할 것.",
    "- 거래 없는 월은 거래 없음으로 유지되어야 한다.",
    "",
    "[대상]",
    snapshot.complex.name + " / " + [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "기준일: " + snapshot.referenceDate,
    snapshot.rankScopeLabel + " 누적거래 순위: " + snapshot.rank + "위",
    "단지 전체 올해 거래: " + snapshot.totalTransactions + "건",
    "",
    "[평형별 데이터]",
    dataLines(snapshot),
    "",
    "[출력 형식]",
    "설명 없이 아래 JSON만 출력:",
    '{',
    '  "status": "pass" 또는 "warning",',
    '  "warnings": ["문제가 있으면 구체적으로"],',
    '  "chartReady": true 또는 false',
    '}'
  ].join("\n");
}

export function buildStructurePrompt(snapshot: DataSnapshot, needsCheckGroups: number[]) {
  const areas = snapshot.areas.filter((area) => needsCheckGroups.includes(area.areaGroup));
  return [
    "아파트 평형별 방·욕실 구조를 사실 확인해줘.",
    "",
    "[대상 단지]",
    snapshot.complex.name,
    [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong, snapshot.complex.address].filter(Boolean).join(" "),
    "",
    "[확인할 평형]",
    ...areas.map((area) => "- areaGroup " + area.areaGroup + " / " + area.displayName + " / " + area.exclusiveLabel),
    "",
    "[원칙]",
    "- 공식 분양자료, 건설사·공공기관 자료 등 신뢰 가능한 원문을 우선할 것.",
    "- 면적만 보고 방·욕실 수를 추정하지 말 것.",
    "- 같은 전용면적에서 타입별 방·욕실 수가 실제로 다르면 status를 varies로 할 것.",
    "- 신뢰할 만한 자료로 확정하기 어렵다면 반드시 status를 needs_check로 할 것.",
    "- 확인이 어렵다고 판단한 항목은 억지로 채우지 말 것.",
    "",
    "[출력 형식]",
    "설명 없이 JSON만 출력:",
    '{',
    '  "areas": [',
    '    {"areaGroup": 84, "rooms": 3, "baths": 2, "status": "verified", "source": "확인 근거"},',
    '    {"areaGroup": 114, "rooms": null, "baths": null, "status": "needs_check", "source": "확인 불가 사유"}',
    "  ]",
    "}"
  ].join("\n");
}

export function buildLifeKickPrompt(snapshot: DataSnapshot) {
  return [
    "아파트 단지의 생활·입지 킥을 1개만 조사해줘.",
    "",
    "[대상]",
    snapshot.complex.name,
    [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "주소: " + (snapshot.complex.road_address || snapshot.complex.address || "주소 정보 없음"),
    "",
    "[목표]",
    "이 아파트에 살면 실제 생활에서 의미 있는 대표 요소 1개를 고른다.",
    "대형마트·트레이더스·코스트코·주요 역·중심상권·전통시장·공원·호수·하천·도서관·문화시설·지역 대표 축제 등을 확인한다.",
    "",
    "[검증 원칙]",
    "- 현재 운영 여부와 정확한 지점을 확인할 것.",
    "- 단지와 실제로 같은 생활권에서 이용할 수 있는지 확인할 것.",
    "- 경로 자료가 없으면 도보 몇 분, 차량 몇 분 같은 시간을 추정하지 말 것.",
    "- 축제는 해당 연도 실제 개최 여부를 공식 자료로 확인할 것.",
    "- 가장 강한 1개만 선택할 것.",
    "- 적절한 킥을 검증하지 못하면 kickFound=false로 끝낼 것.",
    "",
    "[출력 형식]",
    "설명 없이 JSON만 출력:",
    '{',
    '  "kickFound": true,',
    '  "title": "시설 또는 장소명",',
    '  "category": "공원/마트/시장/교통/문화 등",',
    '  "summary": "거주 생활에서 어떤 의미가 있는지 짧게",',
    '  "sourceText": "확인한 근거와 출처 요약",',
    '  "verified": true',
    '}'
  ].join("\n");
}

export function buildChartPrompt(snapshot: DataSnapshot, template: string) {
  const sourceLine = snapshot.referenceDate.replace(/-/g, ".") + " 기준 · 국토부 실거래 자료";
  const filled = template
    .replaceAll("{{COMPLEX_NAME}}", snapshot.complex.name)
    .replaceAll("{{YEAR}}", String(snapshot.year))
    .replaceAll("{{SOURCE_LINE}}", sourceLine)
    .replaceAll("{{DATA_BLOCK}}", dataLines(snapshot));
  if (filled.includes("{{")) {
    return filled + "\n\n[데이터]\n" + dataLines(snapshot) + "\n" + sourceLine;
  }
  return filled;
}

export function buildLifeImagePrompt(snapshot: DataSnapshot, kick: { title: string; category?: string; summary: string }) {
  return [
    "네이버 블로그 본문용 아파트 생활·입지 이미지 1장을 만들어줘.",
    "",
    "[단지]",
    snapshot.complex.name + " / " + [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    "",
    "[확정된 생활 킥]",
    kick.title,
    kick.category ? "종류: " + kick.category : "",
    kick.summary,
    "",
    "[제작 규칙]",
    "- 1600×900 가로형 한 장",
    "- 위에 적힌 생활 킥만 시각화할 것. 새로운 장소나 시설을 추가하지 말 것.",
    "- 실제 거주 생활에서 어떤 장점인지 한눈에 이해되는 장면으로 구성할 것.",
    "- 직접 살아본 사람의 후기처럼 표현하지 말 것.",
    "- 과장된 광고 느낌보다 자연스럽고 신뢰감 있는 네이버 블로그 정보 이미지로 만들 것."
  ].filter(Boolean).join("\n");
}

export function buildThumbnailPrompt(snapshot: DataSnapshot) {
  return [
    "네이버 블로그용 아파트 썸네일 이미지를 1장 만들어줘.",
    "",
    "[문구]",
    snapshot.complex.name,
    "얼마일까?",
    "",
    "[제작 규칙]",
    "- 1254×1254 정사각형",
    "- 문구는 위 두 줄만 사용",
    "- 가격, 평형, 부제, 추가 설명 문구를 넣지 말 것",
    "- 아파트 주제임을 한눈에 알 수 있는 깔끔하고 신뢰감 있는 디자인"
  ].join("\n");
}

export function buildFinalArticlePrompt(
  snapshot: DataSnapshot,
  structures: Array<{ area_group: number; room_count: number | null; bath_count: number | null; status: string }>,
  kick: { title: string; summary: string },
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
    "[제목]",
    snapshot.complex.name + " 얼마일까?",
    "",
    "[작성 기준일]",
    snapshot.referenceDate.replace(/-/g, "."),
    "",
    "[가장 중요한 원칙]",
    "- 제공된 숫자만 사용할 것. 새 가격을 계산하거나 만들지 말 것.",
    "- 제공되지 않은 평형, 방·욕실 수, 생활시설을 추가하지 말 것.",
    "- 전망·매수추천·시장심리 해석을 길게 하지 말 것.",
    "- 글을 짧고 모바일에서 읽기 쉽게 만들 것.",
    "- 가격 흐름 설명은 한두 문장으로만 쓸 것.",
    "",
    "[가격 데이터]",
    dataLines(snapshot),
    "",
    includeStructure ? "[확인된 평형 구조]" : "[평형 구조]",
    includeStructure && structureLines.length ? structureLines.join("\n") : "구조 섹션 제외",
    "",
    "[검증된 생활 킥 1개]",
    kick.title,
    kick.summary,
    "",
    "[고정 목차]",
    "1. 평형별 지금 가격은 얼마일까?",
    ...(includeStructure && structureLines.length ? ["2. 평형별 구조는 어떻게 다를까?", "3. 여기 살면 어떤 점이 좋을까?"] : ["2. 여기 살면 어떤 점이 좋을까?"]),
    "",
    "[이미지 자리]",
    "- 가격 섹션에는 [평형별 가격 흐름 차트 이미지]라고 한 줄 표시",
    "- 생활 킥 섹션에는 [생활 킥 이미지]라고 한 줄 표시",
    "",
    "[출처 표기]",
    snapshot.referenceDate.replace(/-/g, ".") + " 기준 · 국토부 실거래 자료",
    "",
    "도입은 짧게, 각 섹션도 불필요하게 늘리지 말고 최종 발행본만 출력해줘."
  ].join("\n");
}

export function safeParseJson(raw: string) {
  const cleaned = raw.trim()
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/^\`\`\`\s*/i, "")
    .replace(/\s*\`\`\`$/, "");
  return JSON.parse(cleaned);
}
