/**
 * 콘텐츠 메이커 공통 편집장 V2
 * 독자 의도·발견·원문 확인에 집중하며, 개별 채널의 문체는 원고 단계에서 정한다.
 * 원문 메모는 아래 buildEvidenceHandoff에서 손실 없이 보존한다.
 */
export const EDITORIAL_DIRECTOR_VERSION = "2.0";

export const EDITORIAL_DIRECTOR_RULES = [
  "[콘텐츠 메이커 공통 AI 편집장 V2]",
  "1. 독자가 무엇을 알고 싶어 클릭했을지 생각하고, 그 질문에 가장 먼저 답한다.",
  "2. 자료에서 남들이 지나쳤을 법한 숫자, 의외의 차이, 사건의 경과나 새로운 연결을 찾아낸다. 평범한 답만 있어도 억지로 이야기를 만들지 않는다.",
  "3. 확인 가능한 출처와 발표일을 바탕으로 쓴다. 웹 검색을 실제로 수행한 경우에만 최신 원문 확인을 주장하며, 자료에 없는 사실·발언·경험은 만들지 않는다.",
  "4. 방송·예능·드라마·영화 등 화제와의 연결은 실제 근거가 있을 때만 다룬다. 비공개 거주지는 추정하지 않는다.",
  "5. 독자가 필요한 답을 얻으면 자연스럽게 끝낸다. 글의 길이와 구성은 발견한 내용에 맞춘다.",
].join("\n");

/**
 * 운영자가 실제로 저장한 메모와 이전 조사에서 제공받은 링크/기준일을
 * 생성 요청서로 옮긴다. 입력 존재가 사실 검증을 뜻하지 않는다.
 */
export function buildEvidenceHandoff({ notes = "", sourceUrls = [], checkedAt = "" } = {}) {
  const body = typeof notes === "string" ? notes.trim() : "";
  const list = Array.isArray(sourceUrls) ? sourceUrls : [];
  const validUrls = [...new Set([
    ...Array.from(body.matchAll(/https?:\/\/[^\s<>"'()[\]]+/g), match => match[0].replace(/[.,;:]+$/, "")),
    ...list.filter(url => typeof url === "string" && /^https?:\/\/[^\s]+$/i.test(url)).map(url => url.trim()),
  ])];
  const date = typeof checkedAt === "string" && checkedAt.trim() ? checkedAt.trim() : "확인일 미입력";
  return [
    "[전달된 조사 자료 — 원본 보존, 미검증 상태]",
    body || "운영자 메모 없음. 주제에 필요한 사실을 최신 신뢰 출처에서 조사해야 함.",
    "[참고 링크 — 원문 직접 확인 전에는 사실 확정 불가]",
    validUrls.length ? validUrls.map(url => "- " + url).join("\n") : "기록된 링크 없음",
    "[조사 기준일 메모]",
    date,
    "[자료 해석 주의]",
    "- 운영자 메모와 링크는 AI가 이 요청에서 새로 검증한 것이 아니다. 공식 원문과 대조하기 전에는 검증 완료로 표기하지 마라.",
    "- 자료 원문을 확인할 수 없다면 허위 인용 대신 확인이 필요한 부분을 구분하라.",
  ].join("\n");
}
