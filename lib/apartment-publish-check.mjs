/**
 * V3.1 local editorial checks. Bulk articles can additionally compare every
 * explicit price / trade-count / percentage claim against the structured
 * transaction data already loaded in the content maker.
 */
import { safeStoryDisplayText } from "./apartment-story.mjs";
const compact = (text) => String(text || "").replace(/\s+/g, "").toLowerCase();
const travelNumber = /(\d+(?:[.,]\d+)?\s*(?:km|㎞|미터|분|m))(?![a-z\d])/gi;
const uniq = values => [...new Set(values)];

function parseWonText(value) {
  const text = String(value || "").replace(/\s+/g, "");
  const eok = text.match(/(\d+(?:\.\d+)?)억(?:([\d,]+)만원)?/);
  if (eok) return Math.round(Number(eok[1]) * 100000000 + Number((eok[2] || "0").replace(/,/g, "")) * 10000);
  const man = text.match(/([\d,]+)만원/);
  return man ? Number(man[1].replace(/,/g, "")) * 10000 : null;
}
function extractWonClaims(text) {
  const re = /(?:(\d+(?:\.\d+)?)\s*억(?:\s*([\d,]+)\s*만원)?|([\d,]+)\s*만원)/g;
  return Array.from(String(text || "").matchAll(re), match => ({
    raw: match[0],
    value: match[1] != null
      ? Math.round(Number(match[1]) * 100000000 + Number((match[2] || "0").replace(/,/g, "")) * 10000)
      : Number(match[3].replace(/,/g, "")) * 10000,
  }));
}
function extractCountClaims(text) {
  return Array.from(String(text || "").matchAll(/([\d,]+)\s*건/g), match => ({
    raw: match[0], value: Number(match[1].replace(/,/g, "")),
  }));
}
function extractPercentClaims(text) {
  return Array.from(String(text || "").matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g), match => ({
    raw: match[0], value: Number(match[1]),
  }));
}
function pairwiseDiffs(values) {
  const out = [];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) out.push(Math.abs(values[j] - values[i]));
  return out;
}
function allowedRates(values) {
  const out = [];
  for (let i = 0; i + 1 < values.length; i++) {
    if (values[i]) out.push(((values[i + 1] - values[i]) / values[i]) * 100);
  }
  if (values.length > 1 && values[0]) out.push(((values[values.length - 1] - values[0]) / values[0]) * 100);
  return out;
}
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

function auditStructuredTransactions(sourceData, text, add) {
  if (!sourceData?.monthly?.length) return false;
  const monthly = sourceData.monthly.filter(item => item && Number.isFinite(item.medianPrice));
  const monthlyPrices = monthly.map(item => Number(item.medianPrice));
  const parsedRecent = parseWonText(sourceData.recentPrice);
  const parsedPrevious = parseWonText(sourceData.previousPrice);
  const basePrices = uniq([...monthlyPrices, parsedRecent, parsedPrevious].filter(Number.isFinite));
  const allowedPriceValues = uniq([...basePrices, ...pairwiseDiffs(basePrices)].filter(value => value > 0));
  const tradeCounts = sourceData.monthly.map(item => Number(item.tradeCount)).filter(Number.isFinite);
  const allowedCounts = uniq([...tradeCounts, ...pairwiseDiffs(tradeCounts)]);
  const rates = allowedRates(monthlyPrices);
  if (parsedRecent && parsedPrevious) rates.push(((parsedRecent - parsedPrevious) / parsedPrevious) * 100);

  const priceClaims = extractWonClaims(text);
  const countClaims = extractCountClaims(text);
  const percentClaims = extractPercentClaims(text);
  const badPrices = uniq(priceClaims.filter(claim => !allowedPriceValues.some(v => near(claim.value, v, 500000))).map(c => c.raw));
  const badCounts = uniq(countClaims.filter(claim => !allowedCounts.some(v => near(claim.value, v, 0))).map(c => c.raw));
  const badRates = uniq(percentClaims.filter(claim => !rates.some(v => near(Math.abs(claim.value), Math.abs(v), 0.15))).map(c => c.raw));

  const sourceMonths = sourceData.monthly.filter(item => item.medianPrice != null).length;
  if (badPrices.length || badCounts.length || badRates.length) {
    const parts = [];
    if (badPrices.length) parts.push("가격 " + badPrices.slice(0, 6).join(", "));
    if (badCounts.length) parts.push("거래량 " + badCounts.slice(0, 6).join(", "));
    if (badRates.length) parts.push("변화율 " + badRates.slice(0, 6).join(", "));
    add("warning", "실거래 수치 자동 대조", "사이트 원본 데이터와 맞지 않는 숫자를 찾았습니다: " + parts.join(" / ") + ". 원고 숫자를 수정한 뒤 다시 확인하세요.");
  } else if (priceClaims.length || countClaims.length || percentClaims.length) {
    add("pass", "실거래 수치 자동 대조", "본문의 가격 " + priceClaims.length + "곳·거래량 " + countClaims.length + "곳·변화율 " + percentClaims.length + "곳을 사이트에 불러온 최근 " + sourceMonths + "개월 원본 데이터 및 그 계산값과 자동 대조했습니다.");
  } else {
    add("warning", "실거래 수치 자동 대조", "본문에서 가격·거래량·변화율 숫자가 감지되지 않았습니다.");
  }

  const area = String(sourceData.area || "").trim();
  if (area) {
    const areaNumber = area.match(/\d+(?:\.\d+)?/)?.[0];
    if (areaNumber && !new RegExp(areaNumber.replace(".", "\\.") + "\\s*㎡").test(text)) {
      add("warning", "대표 면적", "원본 대표 면적 '" + area + "'과 일치하는 ㎡ 표기가 본문에서 확인되지 않습니다.");
    } else if (areaNumber) {
      add("pass", "대표 면적", "본문 면적 표기를 사이트 원본 대표 면적과 대조했습니다.");
    }
  }
  return true;
}

export function auditApartmentArticle({ mode = "bulk", name = "", body = "", plan = null, dataSummary = "", sourceData = null }) {
  const draft = String(body || "");
  if (!draft.trim()) return {
    ready: false,
    checks: [{ status: "review", label: "최종 원고 대기", detail: "ChatGPT 완성글을 한 번 붙여넣으면 자동 텍스트 검사가 시작됩니다." }],
  };
  const checks = [];
  const add = (status, label, detail) => checks.push({status, label, detail});
  const text = draft.replace(/\\#/g, "#");
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const cleanName = String(name || "").trim();
  if (cleanName && !compact(text).includes(compact(cleanName))) {
    add("warning", "현재 대상 이름 확인", "본문에 선택된 단지/학군명 '" + cleanName + "'이 보이지 않습니다. 다른 글이 붙여넣어진 것은 아닌지 확인하세요.");
  } else add("pass", "대상명", "현재 선택된 제작 대상명과 원고를 비교했습니다.");

  const imageIndices = Array.from(text.matchAll(/\[\s*이미지\s*0?([1-3])(?=\s|[—·\-\]])/g), match => Number(match[1]));
  const missing = [1,2,3].filter(i => !imageIndices.includes(i));
  const duplicates = [1,2,3].filter(i => imageIndices.filter(n => n === i).length > 1);
  if (missing.length || duplicates.length) add("warning", "본문 이미지 위치", [
    missing.length ? "빠진 이미지 위치: " + missing.map(i => "0" + i).join(", ") : "",
    duplicates.length ? "중복된 위치: " + duplicates.map(i => "0" + i).join(", ") : "",
    "이미지 위치 문구 [이미지 01/02/03]을 확인하세요.",
  ].filter(Boolean).join(" "));
  else add("pass", "본문 이미지 위치", "01·02·03번이 각각 한 번씩 있습니다. 실제 파일 내용은 별도 확인이 필요합니다.");

  const last = lines[lines.length-1] || "";
  const hashtags = Array.from(last.matchAll(/#[^\s#]+/g), match => match[0]);
  const tagCount = hashtags.length;
  const normalizedTags = hashtags.map(tag => compact(tag).replace(/^#/, ""));
  const duplicatedTags = [...new Set(normalizedTags.filter((tag, index) => normalizedTags.indexOf(tag) !== index))];
  if (tagCount < 8 || tagCount > 10) add("warning", "네이버 태그", "마지막 줄에서 태그 " + tagCount + "개가 감지됐습니다. 8~10개(권장 9개)로 작성하세요.");
  else if (duplicatedTags.length) add("warning", "네이버 태그", "태그 " + tagCount + "개 중 같은 태그가 반복됩니다: " + duplicatedTags.map(tag => "#" + tag).join(", ") + ". 중복을 줄이고 실제 글에 맞는 태그를 넣으세요.");
  else add("pass", "네이버 태그", "마지막 줄의 중복 없는 해시태그 " + tagCount + "개가 확인됐습니다(권장 8~10개).");

  if (/https?:\/\/|www\./i.test(text)) add("warning", "발행본문 URL", "출처 주소가 본문에 남아 있습니다. 조사 자료는 카드에 보관하고 최종 글에서는 제거해 주세요.");
  else add("pass", "출처 링크 노출", "본문에서 일반적인 URL 표기는 검출되지 않았습니다.");

  const structuredChecked = mode === "bulk" && auditStructuredTransactions(sourceData, text, add);
  if (!structuredChecked) {
    const priceLike = text.match(/\d+(?:[.,]\d+)?\s*(?:억|만원|건)/g) || [];
    if (priceLike.length) add("review", "실거래 수치", "구조화된 원본 실거래 데이터가 이 글에 연결되지 않아 숫자 " + priceLike.length + "곳은 자동 대조하지 못했습니다.");
    else add("warning", "실거래 수치", "원고에서 가격·거래 숫자가 감지되지 않았습니다. 데이터 중심 글인지 확인하세요.");
  }

  if (plan) {
    const place = String(plan.placeName || "").trim();
    if (place && !text.includes(place)) add("warning", "사실 카드 · 정확한 장소명", "잠긴 장소명 '" + place + "'이 본문에 그대로 나오지 않습니다. 다른 지점으로 바뀌었는지 살펴보세요.");
    else if (place) add("pass", "사실 카드 · 장소명", "승인된 정확한 장소/지점명이 본문에서 확인됐습니다.");
    else add("review", "생활 발견 내용", "장소를 지정하지 않은 이야기입니다. 승인한 생활 발견이 본문 약 20%에 자연스럽게 들어갔는지 읽어 주세요.");
    const claims = Array.from(text.matchAll(travelNumber), match => match[1]);
    const allowed = compact([
      plan.accessSourceUrl ? plan.accessInfo : "",
      safeStoryDisplayText(plan.facts, plan),
      safeStoryDisplayText(plan.connection, plan),
      dataSummary,
    ].join(" "));
    const extra = [...new Set(claims.filter(item => !allowed.includes(compact(item))))];
    if (extra.length) add("warning", "새로운 거리·시간 숫자", "잠긴 카드/입력 데이터와 문자열이 일치하지 않는 표현: " + extra.slice(0, 6).join(", ") + ". 실제 경로자료로 검증하거나 삭제하세요.");
    else add("pass", "추가 거리·시간 표현", "잠긴 카드 밖의 이동 수치가 문자열 검사상 발견되지 않았습니다. 실제 경로 진위는 자동 확인하지 않습니다.");
    if (plan.accessInfo && !plan.accessSourceUrl && Array.from(plan.accessInfo.matchAll(travelNumber)).length) {
      add("warning", "이동 정보의 출처", "카드에는 이동 수치가 있지만 별도 HTTPS 경로 근거가 없습니다. 본문/이미지에 수치를 넣지 마세요.");
    }
    add("review", "사진·지도와 원문 사실", "03번 이미지에서 실제 지점·거리·사진 이용 권한·지도 위치가 카드/완성 원고와 일치하는지 마지막으로 확인하세요.");
  } else {
    add("review", "생활 스토리", "별도 승인 카드는 없습니다. 자동 생성 본문의 생활 이야기는 외부 원문까지 이 로컬 검사에서 재조회하지 않으므로 장소·영업 여부·경로 수치는 필요할 때 원문 확인이 남습니다.");
  }
  return { ready: true, checks };
}
