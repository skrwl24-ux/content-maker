/**
 * V3.1 local editorial checks only. The browser does not visit sources or verify
 * the accuracy of an image; "review" never masquerades as fact verification.
 */
const compact = (text) => String(text || "").replace(/\s+/g, "").toLowerCase();
const travelNumber = /(\d+(?:[.,]\d+)?\s*(?:km|㎞|미터|분|m))(?![a-z가-힣\d])/gi;
export function auditApartmentArticle({ mode = "bulk", name = "", body = "", plan = null, dataSummary = "" }) {
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
  const tagCount = Array.from(last.matchAll(/#[^\s#]+/g)).length;
  if (tagCount !== 7) add("warning", "네이버 태그", "마지막 줄에서 태그 " + tagCount + "개가 감지됐습니다. 정확히 7개인지 확인하세요.");
  else add("pass", "네이버 태그", "최종 줄에서 7개의 해시태그가 확인됐습니다.");

  if (/https?:\/\/|www\./i.test(text)) add("warning", "발행본문 URL", "출처 주소가 본문에 남아 있습니다. 조사 자료는 카드에 보관하고 최종 글에서는 제거해 주세요.");
  else add("pass", "출처 링크 노출", "본문에서 일반적인 URL 표기는 검출되지 않았습니다.");

  const priceLike = text.match(/\d+(?:[.,]\d+)?\s*(?:억|만원|건)/g) || [];
  if (priceLike.length) add("review", "실거래 수치", "가격·거래 숫자 " + priceLike.length + "곳을 감지했습니다. 원본 실거래, 개별 계약/월 대표값, 면적, 진행 중 월을 대조해 주세요. 텍스트 검사만으로 계약 진위를 확인할 수 없습니다.");
  else add("warning", "실거래 수치", "원고에서 가격·거래 숫자가 감지되지 않았습니다. 데이터 중심 글인지 확인하세요.");

  if (plan) {
    const place = String(plan.placeName || "").trim();
    if (place && !text.includes(place)) add("warning", "사실 카드 · 정확한 장소명", "잠긴 장소명 '" + place + "'이 본문에 그대로 나오지 않습니다. 다른 지점으로 바뀌었는지 살펴보세요.");
    else if (place) add("pass", "사실 카드 · 장소명", "승인된 정확한 장소/지점명이 본문에서 확인됐습니다.");
    else add("review", "생활 발견 내용", "장소를 지정하지 않은 이야기입니다. 승인한 생활 발견이 본문 약 20%에 자연스럽게 들어갔는지 읽어 주세요.");
    const claims = Array.from(text.matchAll(travelNumber), match => match[1]);
    const allowed = compact([plan.accessInfo, plan.facts, plan.connection, dataSummary].join(" "));
    const extra = [...new Set(claims.filter(item => !allowed.includes(compact(item))))];
    if (extra.length) add("warning", "새로운 거리·시간 숫자", "잠긴 카드/입력 데이터와 문자열이 일치하지 않는 표현: " + extra.slice(0, 6).join(", ") + ". 실제 경로자료로 검증하거나 삭제하세요.");
    else add("pass", "추가 거리·시간 표현", "잠긴 카드 밖의 이동 수치가 문자열 검사상 발견되지 않았습니다. 실제 경로 진위는 자동 확인하지 않습니다.");
    if (plan.accessInfo && !plan.accessSourceUrl && Array.from(plan.accessInfo.matchAll(travelNumber)).length) {
      add("warning", "이동 정보의 출처", "카드에는 이동 수치가 있지만 별도 HTTPS 경로 근거가 없습니다. 본문/이미지에 수치를 넣지 마세요.");
    }
    add("review", "사진·지도와 원문 사실", "03번 이미지에서 실제 지점·거리·사진 이용 권한·지도 위치가 카드/완성 원고와 일치하는지 마지막으로 확인하세요.");
  } else {
    add("review", "데이터형 글", "승인된 생활 스토리가 없습니다. 이번 원고는 실거래·단지 비교 중심으로 검수합니다.");
  }
  return { ready: true, checks };
}
