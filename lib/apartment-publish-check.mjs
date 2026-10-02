/**
 * V3.1 local editorial checks only. The browser does not visit sources or verify
 * the accuracy of an image; "review" never masquerades as fact verification.
 */
import { safeStoryDisplayText } from "./apartment-story.mjs";
import { auditArticleFigures } from "./apartment-numeric-audit.mjs";
const compact = (text) => String(text || "").replace(/\s+/g, "").toLowerCase();
const travelNumber = /(\d+(?:[.,]\d+)?\s*(?:km|㎞|미터|분|m))(?![a-z\d])/gi;
export function auditApartmentArticle({ mode = "bulk", name = "", body = "", plan = null, dataSummary = "", numericReference = null, autoStoryEnabled = true }) {
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

  // Compare explicit claims with structured numbers instead of asking the
  // editor to manually inspect every money/count-looking token in the draft.
  // For school/mega the five-complex live reference has not yet been supplied.
  if (mode === "bulk") checks.push(...auditArticleFigures({
    body: text,
    monthly: numericReference?.monthly || [],
    latestTradePrice: numericReference?.latestTradePrice ?? null,
    sourceKind: numericReference?.sourceKind || "input",
    sourceAudit: numericReference?.sourceAudit || null,
  }));
  else add("review", "시리즈 실거래 검증 범위",
    "학군·초대형 비교는 단지별 매매·전세 계약의 별도 구조화 자료가 제공되지 않아 외부 거래 진위까지 자동 판정하지 않습니다. 제공 데이터 없이 '검증 통과'로 표시하지 않습니다.");

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
    add("pass", autoStoryEnabled ? "자동 생활 스토리 모드" : "데이터 집중 모드",
      autoStoryEnabled
        ? "별도 승인 카드는 없지만 본문에서 생활 이야기를 자동 탐색하는 모드입니다. 03번 이미지도 완성글을 기준으로 제작하며 장소·이동 사실은 출처가 있을 때만 표기합니다."
        : "사용자가 생활 스토리 생략을 선택했습니다. 실거래·단지 비교 중심의 원고로 검사합니다.");
  }
  return { ready: true, checks };
}
