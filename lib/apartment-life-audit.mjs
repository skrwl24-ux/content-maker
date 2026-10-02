/**
 * Editorial hand-off for live neighborhood fact checks. This module DOES NOT
 * browse sources: it drafts a research request, accepts AI-researched links
 * as leads, and guards exact textual edits in the current article.
 */
const short = (value, max = 1500) => String(value == null ? "" : value).trim().slice(0, max);
const compact = value => String(value || "").replace(/\s+/g, "").toLowerCase();
const https = value => /^https:\/\/[^/\s]+\.[^/\s]+(?:[/?#][^\s]*)?$/i.test(String(value || ""));
const numberOf = (text, fragment) => fragment ? String(text).split(fragment).length - 1 : 0;

export function lifeAuditRequestId(name, body) {
  const value = String(name || "") + "\n" + String(body || "");
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "LIFE-" + (hash >>> 0).toString(16).padStart(8, "0");
}

export function makeLifeVerificationPrompt({ mode = "bulk", name = "", region = "", body = "", placeName = "" } = {}) {
  const requestId = lifeAuditRequestId(name, body);
  return [
    "[아파트 콘텐츠메이커 V3.2 · 생활정보 웹 검증]",
    "검증 ID: " + requestId,
    "유형: " + mode + " / 대상: " + name + " / 지역: " + region,
    placeName ? "승인 사실카드의 정확한 장소명: " + placeName : "별도 승인 장소 없음. 완성 원고에 실제로 나온 장소만 확인할 것.",
    "",
    "[이번 요청에서 실제로 해야 할 일]",
    "웹 검색을 사용하여 아래 완성 원고의 외부 생활정보 주장을 재확인하라. 웹 검색에 접근할 수 없다면 검색한 척하거나 확인·합격 판정을 하지 말고 webAccess를 unavailable로 출력하라.",
    "가격·거래량·변화율·세대수는 사이트 내부 실거래 대조 영역이므로 이번 검증에서 제외한다.",
    "원고에 실제로 존재하는 개별 장소·지점/매장 운영 여부·이전/폐점·공원·학교·문화시설·행사 날짜·교통 개통 단계·지도 위치 및 단지에서 해당 장소까지의 접근성·도보/차량 소요시간 주장만 추출하라.",
    "지역명이 같다고 가까운 시설인 것처럼 단정하지 말고, 개별 상호명은 본점/지점을 유지하라. 지도의 핀·좌표·방향·거리·통학로를 지어내지 마라.",
    "우선순위: 운영 기관/업체 공식 홈페이지 또는 공공기관 공지 > 지도/실제 경로를 제공하는 원문 > 출처와 날짜가 분명한 보도. 검색 결과의 제목·스니펫만 보고 확정하지 말고 실제 원문을 확인할 것.",
    "영업시간·운영 여부는 오래된 자료로 현재 상태를 확정하지 말 것. 도보시간·거리 수치는 단지 → 목적지 실제 경로 및 이동수단을 직접 확인할 수 있는 자료가 있을 때만 confirmed/update 처리한다. 확인되지 않으면 unverified로 표시하고 원고에서는 해당 수치를 빼도록 제안하라.",
    "검증한 자료의 실제 HTTPS 원문 링크를 각 항목에 한 개씩 붙일 것. 출처를 만들어내지 말 것. 기사 게시일과 행사 개최일을 혼동하지 말 것.",
    "status: confirmed=출처가 해당 주장까지 뒷받침함, update=근거가 있는 정확한 내용으로 문장을 고쳐야 함, unverified=근거 부족·영업 여부 불명·동선 미확인 등으로 문장을 지우거나 완화해야 함.",
    "원고에서 외부 생활정보 주장이 하나도 없다면 checks=[]로 출력하고 summary에 '검증할 외부 생활정보 없음'이라고 적을 것.",
    "original은 아래 완성 원고에서 글자와 문장부호를 수정하지 않고 정확히 복사한 연속 텍스트(가능하면 한 줄/한 문장)여야 한다. 바꿀 텍스트만 선택하고 제목·가격 표·이미지 슬롯·태그는 변경하지 말 것.",
    "recommendedText는 update일 때 검증된 대체 문장, unverified일 때 근거 없는 정보를 제거한 안전한 대체 문장 또는 완전 삭제를 의미하는 빈 문자열이다. confirmed는 빈 문자열.",
    "원고 전체를 새로 작성하지 말 것. 확인 결과 요약 후 반드시 아래 기계 판독 JSON 블록을 출력하라. JSON 문자열 안에 줄바꿈이 필요하면 \\n으로 이스케이프하고 다른 코드펜스는 사용하지 말 것.",
    "",
    "[반드시 출력할 결과 형식]",
    "[LOCAL_AUDIT_JSON]",
    "{",
    '  "requestId": "' + requestId + '",',
    '  "subjectName": "' + name.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",',
    '  "webAccess": "available",',
    '  "summary": "실제 웹 조사에서 확인한 내용의 짧은 요약",',
    '  "checkedAt": "YYYY-MM-DD",',
    '  "checks": [',
    "    {",
    '      "topic": "장소/영업/교통/경로/시설/행사/기타",',
    '      "status": "confirmed/update/unverified",',
    '      "original": "원고에 실제 존재하는 원문 문장 그대로",',
    '      "recommendedText": "교체해야 할 안전한 문장 또는 빈 문자열",',
    '      "finding": "어떤 사실이 확인되었고 어떤 부분은 미확인인지",',
    '      "sourceTitle": "실제로 읽은 공식/신뢰 원문 제목 또는 없음",',
    '      "sourceUrl": "https://직접-확인한-원문 또는 빈 문자열",',
    '      "sourceDate": "YYYY-MM-DD 또는 확인 불가"',
    "    }",
    "  ]",
    "}",
    "[/LOCAL_AUDIT_JSON]",
    "검색이 불가능하면 webAccess=unavailable, checks=[]로 출력하고 검색 불가능 사유를 summary에 밝힐 것.",
    "",
    "[검증 대상 · 최종 원고 시작]",
    String(body || ""),
    "[최종 원고 끝]",
  ].join("\n");
}

export function parseLifeVerificationResult(raw, { name = "", body = "" } = {}) {
  if (!String(body || "").trim()) throw new Error("먼저 완성 본문을 붙여넣어 주세요.");
  const source = String(raw || "").trim();
  const found = source.match(/\[LOCAL_AUDIT_JSON\]([\s\S]*?)\[\/LOCAL_AUDIT_JSON\]/);
  const json = found ? found[1].trim() : source.startsWith("{") ? source : "";
  if (!json) throw new Error("GPT 응답에서 [LOCAL_AUDIT_JSON] 결과를 찾을 수 없습니다. 검증 결과 블록 전체를 복사해 주세요.");
  let value;
  try { value = JSON.parse(json); } catch { throw new Error("검증 결과 JSON 형식이 올바르지 않습니다. 처음부터 끝까지 다시 복사해 주세요."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("검증 결과는 JSON 객체여야 합니다.");
  const requestId = lifeAuditRequestId(name, body);
  if (value.requestId !== requestId || compact(value.subjectName) !== compact(name)) {
    throw new Error("이 검증 결과는 현재 선택된 단지 또는 본문과 일치하지 않습니다. 현재 글로 다시 웹 검증을 요청해 주세요.");
  }
  if (value.webAccess !== "available") throw new Error("이번 GPT 응답에는 실제 웹 검색 결과가 없습니다. 웹 검색을 사용할 수 있는 채팅에서 다시 실행해 주세요.");
  if (!Array.isArray(value.checks) || value.checks.length > 30) throw new Error("검증 항목이 없거나 형식이 잘못됐습니다.");
  const checks = value.checks.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error((i + 1) + "번 검증 항목 형식이 잘못됐습니다.");
    const original = short(item.original, 1000);
    const recommendedText = short(item.recommendedText, 1400);
    const sourceUrl = short(item.sourceUrl, 600);
    let status = ["confirmed", "update", "unverified"].includes(item.status) ? item.status : "unverified";
    const evidence = https(sourceUrl);
    if (status !== "unverified" && !evidence) status = "unverified";
    return {
      topic: short(item.topic, 40),
      status, original, recommendedText, finding: short(item.finding, 700),
      sourceTitle: short(item.sourceTitle, 200), sourceUrl: evidence ? sourceUrl : "",
      sourceDate: short(item.sourceDate, 45), matchCount: numberOf(body, original),
      id: requestId + ":" + i,
    };
  });
  return {
    requestId, name: short(name), summary: short(value.summary, 800),
    checkedAt: short(value.checkedAt, 35), checks,
  };
}

export function applyLifeVerificationChanges(body, report, selectedIds) {
  let result = String(body || "");
  const selected = new Set(selectedIds || []);
  if (!report || !selected.size || report.requestId !== lifeAuditRequestId(report.name, result)) {
    return { body: result, applied: 0, skipped: selected.size };
  }
  let applied = 0, skipped = 0;
  for (const item of report.checks) {
    if (!selected.has(item.id)) continue;
    const canApply = item.status === "update" && https(item.sourceUrl)
      || item.status === "unverified" && item.recommendedText === "";
    if (!canApply || !item.original || numberOf(result, item.original) !== 1 || result === result.replace(item.original, item.recommendedText) ||
        /https?:\/\//i.test(item.recommendedText)) { skipped++; continue; }
    result = result.replace(item.original, item.recommendedText);
    applied++;
  }
  return { body: result, applied, skipped };
}
