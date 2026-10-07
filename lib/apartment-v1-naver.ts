export type ApartmentV1NaverBlock = {
  type: "title" | "subheading" | "emphasis" | "body" | "image" | "tags" | "card";
  text: string;
};

export type ApartmentV1AuditCheck = {
  status: "pass" | "warning" | "review";
  label: string;
  detail: string;
};

function cleanLine(raw: string) {
  return raw
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^(\*\*|__)([\s\S]+)\1$/, "$2")
    .trim();
}

function splitTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cleanLine(cell));
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function tableCard(headers: string[], row: string[]) {
  const primaryIndex = headers.findIndex((header) => /(평형|구분|항목|이름|단지|지역)/.test(header));
  const mainIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const title = row[mainIndex] || row.find(Boolean) || "항목";
  const details = headers
    .map((header, index) => ({ header, value: row[index] || "", index }))
    .filter((item) => item.index !== mainIndex && item.value)
    .map((item) => (item.header || "항목") + " " + item.value)
    .join(" · ");
  return details ? title + "\n" + details : title;
}

export function parseApartmentV1Naver(raw: string): ApartmentV1NaverBlock[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ApartmentV1NaverBlock[] = [];
  let firstContent = true;

  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index].trim();
    if (!original) continue;

    if (
      index + 1 < lines.length &&
      original.includes("|") &&
      splitTableRow(original).length >= 2 &&
      isTableDivider(lines[index + 1])
    ) {
      const headers = splitTableRow(original);
      index += 2;
      while (index < lines.length) {
        const line = lines[index].trim();
        if (!line || !line.includes("|")) {
          index -= 1;
          break;
        }
        const row = splitTableRow(line);
        if (row.length < 2 || isTableDivider(line)) {
          index -= 1;
          break;
        }
        blocks.push({ type: "card", text: tableCard(headers, row) });
        index += 1;
      }
      firstContent = false;
      continue;
    }

    const line = cleanLine(original);
    if (!line) continue;

    if (firstContent) {
      blocks.push({ type: "title", text: line });
      firstContent = false;
      continue;
    }

    const hashtagCount = (line.match(/#[^\s#]+/g) || []).length;
    if (line.startsWith("#") && hashtagCount >= 2) {
      blocks.push({ type: "tags", text: line });
      continue;
    }

    if (
      /^\[(?:평형별 가격 흐름 차트 이미지|생활 킥 이미지|이미지\s*\d+)/i.test(line) ||
      /^\[.*이미지.*\]$/.test(line)
    ) {
      blocks.push({ type: "image", text: line });
      continue;
    }

    const markdownHeading = /^#{1,6}\s+/.test(original);
    const numberedHeading = /^\d+\.\s+/.test(line) && line.length <= 60;
    if (markdownHeading || numberedHeading) {
      blocks.push({ type: "subheading", text: line });
      continue;
    }

    if (/^(\*\*|__)[\s\S]+\1$/.test(original) || /^>\s+/.test(original)) {
      blocks.push({ type: "emphasis", text: line });
      continue;
    }

    blocks.push({ type: "body", text: line });
  }

  return blocks;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function apartmentV1NaverPlainText(blocks: ApartmentV1NaverBlock[]) {
  return blocks.map((block, index) => {
    const next = blocks[index + 1];
    const separator = block.type === "card" && next?.type === "card" ? "\r\n" : "\r\n \r\n";
    return block.text + (index < blocks.length - 1 ? separator : "");
  }).join("");
}

export function apartmentV1NaverRichHtml(blocks: ApartmentV1NaverBlock[]) {
  const font = "'Nanum Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif";
  const html = blocks.map((block) => {
    const safe = escapeHtml(block.text);
    if (block.type === "title") {
      return '<div style="font-family:' + font + ';font-size:32px;line-height:1.35;font-weight:700;margin:0;">' + safe + "</div>";
    }
    if (block.type === "subheading") {
      return '<div style="font-family:' + font + ';font-size:30px;line-height:1.45;font-weight:700;margin:0;">' + safe + "</div>";
    }
    if (block.type === "emphasis") {
      return '<div style="font-family:' + font + ';font-size:19px;line-height:1.65;font-weight:700;margin:0;">' + safe + "</div>";
    }
    if (block.type === "tags") {
      return '<div style="font-family:' + font + ';font-size:15px;line-height:1.7;font-weight:400;margin:0;">' + safe + "</div>";
    }
    if (block.type === "image") {
      return '<div style="font-family:' + font + ';font-size:15px;line-height:1.7;font-weight:600;margin:0;">' + safe + "</div>";
    }
    if (block.type === "card") {
      const [title, ...details] = safe.split("\n");
      return '<div style="font-family:' + font + ';font-size:15px;line-height:1.75;font-weight:400;margin:0;padding:10px 12px;border-left:3px solid #8aa99d;"><div style="font-weight:700;margin:0 0 4px;">' +
        title + "</div>" + (details.length ? "<div>" + details.join("<br>") + "</div>" : "") + "</div>";
    }
    return '<div style="font-family:' + font + ';font-size:15px;line-height:1.8;font-weight:400;margin:0;">' + safe + "</div>";
  });

  const spacer = '<div style="font-family:' + font + ';font-size:15px;line-height:1.8;margin:0;"><br></div>';
  return "<div>" + html.map((item, index) => {
    const next = blocks[index + 1];
    const separator = blocks[index]?.type === "card" && next?.type === "card" ? "" : spacer;
    return item + (index < html.length - 1 ? separator : "");
  }).join("") + "</div>";
}

function normalizeForSearch(value: string) {
  return value
    .replace(/\*\*|__|#+/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function priceVariants(priceWon: number) {
  const eok = priceWon / 100000000;
  const compact = eok.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const rounded1 = eok.toFixed(1).replace(/\.0$/, "");
  const eokInt = Math.floor(priceWon / 100000000);
  const man = Math.round((priceWon % 100000000) / 10000);
  const korean = man > 0 ? eokInt + "억" + man.toLocaleString("ko-KR") + "만원" : eokInt + "억";
  return [compact + "억", rounded1 + "억", korean].map((value) => value.replace(/\s+/g, ""));
}

export function auditApartmentV1Article(input: {
  body: string;
  complexName: string;
  referenceDate: string;
  areas: Array<{ displayName: string; currentMedian: number | null }>;
  includeStructure: boolean;
  kickTitle: string;
}) {
  const body = input.body.trim();
  const normalized = normalizeForSearch(body);
  const checks: ApartmentV1AuditCheck[] = [];

  if (!body) {
    return {
      ready: false,
      checks: [{ status: "warning" as const, label: "원고", detail: "최종 원고를 먼저 붙여넣어 주세요." }],
    };
  }

  const expectedTitle = input.complexName + " 얼마일까?";
  checks.push(normalized.includes(normalizeForSearch(expectedTitle))
    ? { status: "pass", label: "제목", detail: "고정 제목이 확인됐습니다." }
    : { status: "warning", label: "제목", detail: "제목을 '" + expectedTitle + "'로 맞춰주세요." });

  checks.push(normalized.includes(normalizeForSearch(input.complexName))
    ? { status: "pass", label: "단지 일치", detail: "현재 작업 단지명이 원고에 확인됩니다." }
    : { status: "warning", label: "단지 일치", detail: "현재 작업 단지명이 원고에서 확인되지 않습니다." });

  const requiredSections = [
    "평형별 지금 가격은 얼마일까?",
    ...(input.includeStructure ? ["평형별 구조는 어떻게 다를까?"] : []),
    "여기 살면 어떤 점이 좋을까?",
  ];
  const missingSections = requiredSections.filter((section) => !normalized.includes(normalizeForSearch(section)));
  checks.push(missingSections.length
    ? { status: "warning", label: "목차·소제목", detail: "빠진 항목: " + missingSections.join(", ") }
    : { status: "pass", label: "목차·소제목", detail: "V1 고정 구성의 소제목이 모두 확인됐습니다." });

  const chartMarker = /\[\s*평형별\s*가격\s*흐름\s*차트\s*이미지\s*\]/i.test(body);
  checks.push(chartMarker
    ? { status: "pass", label: "가격 차트 위치", detail: "평형별 가격 흐름 차트 위치가 있습니다." }
    : { status: "warning", label: "가격 차트 위치", detail: "[평형별 가격 흐름 차트 이미지] 표시가 없습니다." });

  const lifeMarker = /\[\s*생활\s*킥\s*이미지\s*\]/i.test(body);
  checks.push(lifeMarker
    ? { status: "pass", label: "생활 킥 이미지 위치", detail: "생활 킥 이미지 위치가 있습니다." }
    : { status: "warning", label: "생활 킥 이미지 위치", detail: "[생활 킥 이미지] 표시가 없습니다." });

  if (input.kickTitle) {
    checks.push(normalized.includes(normalizeForSearch(input.kickTitle))
      ? { status: "pass", label: "생활 킥 일치", detail: "검증된 생활 킥이 원고에 사용됐습니다." }
      : { status: "warning", label: "생활 킥 일치", detail: "검증된 생활 킥 '" + input.kickTitle + "'이 원고에서 확인되지 않습니다." });
  }

  const missingAreas = input.areas.filter((area) => {
    if (!normalized.includes(normalizeForSearch(area.displayName))) return true;
    if (!area.currentMedian) return false;
    return !priceVariants(area.currentMedian).some((variant) => normalized.includes(normalizeForSearch(variant)));
  });
  checks.push(missingAreas.length
    ? { status: "warning", label: "평형·현재가격", detail: "현재가격 표기가 확인되지 않는 평형: " + missingAreas.map((area) => area.displayName).join(", ") }
    : { status: "pass", label: "평형·현재가격", detail: "대상 평형과 현재 대표가격이 원고에서 확인됩니다." });

  const sourceLine = input.referenceDate.replace(/-/g, ".") + " 기준 · 국토부 실거래 자료";
  checks.push(normalized.includes(normalizeForSearch(sourceLine))
    ? { status: "pass", label: "출처", detail: "기준일과 국토부 실거래 출처가 확인됐습니다." }
    : { status: "warning", label: "출처", detail: "원고 끝에 '" + sourceLine + "'를 넣어주세요." });

  checks.push(/확인\s*필요|자료\s*없음|추정(?:입니다|함|치)?/i.test(body)
    ? { status: "review", label: "수동 확인 문구", detail: "확인 필요·자료 없음·추정 표현이 있습니다. 발행 전 문맥을 한 번 확인하세요." }
    : { status: "pass", label: "미확정 문구", detail: "눈에 띄는 미확정 표현이 없습니다." });

  return { ready: true, checks };
}
