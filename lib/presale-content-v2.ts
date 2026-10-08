"use client";

export type PresaleCandidateV2 = {
  id: string;
  name: string;
  region: string;
  area?: string;
  stage?: string;
  status?: string;
  schedule?: string;
  supply?: string;
  supplyNote?: string;
  interest?: string;
  kick?: string;
  topic?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  officialUrl?: string;
  officialLabel?: string;
  caution?: string;
  eventKey?: string;
  publicationStatus?: "queue" | "published";
  checkedAt?: string;
  address?: string;
  projectType?: string;
  constructor?: string;
  developer?: string;
  totalUnits?: number | null;
  generalSaleUnits?: number | null;
  exclusiveAreas?: number[];
  moveIn?: string;
  noticeStatus?: string;
};

export type PresaleDraftV2 = {
  title: string;
  priceRaw: string;
  scheduleRaw: string;
  compareRaw: string;
  kickRaw: string;
  finalRaw: string;
  locationImageEnabled: boolean;
  locationNote: string;
  updatedAt: string;
};

export type PromptKeyV2 =
  | "PRESALE_QUEUE_10_V2"
  | "PRESALE_PRICE_V2"
  | "PRESALE_SCHEDULE_V2"
  | "PRESALE_COMPARE_V2"
  | "PRESALE_KICK_V2"
  | "PRESALE_THUMBNAIL_V2"
  | "PRESALE_PRICE_IMAGE_V2"
  | "PRESALE_COMPARE_IMAGE_V2"
  | "PRESALE_KICK_IMAGE_V2"
  | "PRESALE_LOCATION_IMAGE_V2"
  | "PRESALE_FINAL_V2";

export const DEFAULT_QUEUE_10_PROMPT = [
  "다음에 네이버 블로그 분양 글로 제작할 신규 분양 후보 10개를 웹 검색으로 조사해줘.",
  "",
  "[조사 기준일]",
  "{{REFERENCE_DATE}}",
  "",
  "[이미 발행한 후보]",
  "{{PUBLISHED_BLOCK}}",
  "",
  "[목표]",
  "- 서울·경기·인천에서 현재 시점에 글로 만들 가치가 있는 분양·재공급·공공분양 후보를 정확히 10개 선정.",
  "- 같은 사건을 제목만 바꿔 중복 제안하지 말 것.",
  "- 같은 단지라도 새 모집공고·정정공고·재공급·일정 변경처럼 독립된 새 사건이면 가능.",
  "- 공식 모집공고, 청약홈, LH·SH·GH, 지자체, 건설사·사업주체 공식자료를 우선 확인.",
  "- 전체 세대수와 일반분양, 아파트와 오피스텔, 사전청약과 본청약을 구분.",
  "- 공고 전 수치는 예정/추정 상태를 유지하고 확정값처럼 만들지 말 것.",
  "",
  "[후보 기본정보]",
  "각 후보마다 사업명, 지역, 주소·사업지, 사업유형, 시공사, 시행·사업주체, 전체 세대수, 일반분양 세대수, 주요 전용면적, 입주예정, 공고상태, 확인일을 가능한 범위에서 정리.",
  "확인 못 한 값은 null 또는 빈 문자열로 둘 것.",
  "",
  "[사이트 가져오기용 JSON — 답변 맨 마지막]",
  "- 반드시 정확히 10개 candidates를 넣은 JSON 코드블록 하나를 답변 맨 마지막에 출력.",
  "- 코드블록 뒤에는 아무 문장도 쓰지 말 것.",
  "- 최상위: checkedAt, summary, questions, candidates",
  "- candidates 필수 필드: name, region, area, stage, status, schedule, supply, supplyNote, interest, kick, topic, sourceUrl, sourceLabel, officialUrl, officialLabel, caution, eventKey",
  "- 추가 기본정보 필드: address, projectType, constructor, developer, totalUnits, generalSaleUnits, exclusiveAreas, moveIn, noticeStatus",
  "- area는 서울/경기/인천, stage는 planned/later/watch/notice/followup 중 하나.",
  "- sourceUrl과 officialUrl은 실제 확인한 https URL만 사용.",
  "- eventKey는 단지명 대신 사건 종류+핵심 날짜를 반영."
].join("\n");

export const DEFAULT_PRICE_PROMPT = [
  "분양 글 제작에 사용할 평형·분양가 자료를 웹 검색으로 조사해줘.",
  "",
  "[대상 기본정보]",
  "{{BASIC_DATA_BLOCK}}",
  "",
  "[이 단계의 담당]",
  "- 공급 전용면적, 타입, 타입별 공급세대수와 일반분양 세대수",
  "- 타입별 공식 분양가 최저·최고, 층별 가격 차이(공개된 경우)",
  "- 발코니 확장비, 공식 유상옵션 가격",
  "- 계약금·중도금·잔금, 중도금 대출 관련 공식 안내",
  "",
  "[중복 방지]",
  "- 사이트 기본정보를 다시 판단하거나 수정하지 말 것.",
  "- 청약 일정·자격, 주변 시세, 선행단지 가격, 핵심 킥은 조사하지 말 것.",
  "- 주변 가격으로 예상 분양가를 새로 계산하지 말 것.",
  "",
  "[검증]",
  "- 청약홈 모집공고·공식 PDF·공식 분양 홈페이지·건설사/시행사 자료 우선.",
  "- 공고 전이면 없는 분양가를 만들지 말고 priceStatus=not_published.",
  "- 같은 전용면적의 A/B/C 타입은 합치지 말 것.",
  "- 사이트 기본정보와 다른 전체/일반분양 수를 발견하면 덮어쓰지 말고 conflicts에 기록.",
  "- 공식 분양가+확장비가 모두 확인된 경우에만 baseTotalCost 계산. 옵션·취득세·이자는 자동 합산 금지.",
  "",
  "[출력]",
  "설명 없이 JSON 코드블록 하나만 출력.",
  "{",
  "  \"projectName\":\"{{PROJECT_NAME}}\",",
  "  \"priceStatus\":\"not_published\",",
  "  \"noticeVerified\":false,",
  "  \"areas\":[],",
  "  \"payment\":{\"contract\":{\"value\":\"\",\"status\":\"unverified\"},\"intermediate\":{\"value\":\"\",\"status\":\"unverified\"},\"balance\":{\"value\":\"\",\"status\":\"unverified\"},\"loanInfo\":{\"value\":\"\",\"status\":\"unverified\"}},",
  "  \"options\":[], \"conflicts\":[], \"sources\":[], \"checkedDate\":\"{{REFERENCE_DATE}}\"",
  "}"
].join("\n");

export const DEFAULT_SCHEDULE_PROMPT = [
  "분양 글 제작에 사용할 청약 일정·자격 자료를 웹 검색으로 조사해줘.",
  "",
  "[대상 기본정보]",
  "{{BASIC_DATA_BLOCK}}",
  "",
  "[이 단계의 담당]",
  "- 모집공고일, 특별공급, 1순위, 2순위, 당첨자 발표, 서류접수, 정당계약",
  "- 해당/기타지역, 지역우선, 거주기간, 청약통장, 예치금, 세대주·무주택·유주택 신청 여부",
  "- 특별공급 유형",
  "- 전매제한, 재당첨 제한, 거주의무, 분양가상한제",
  "",
  "[중복 방지]",
  "- 분양가·확장비·납부금액, 주변시세, 비교단지, 핵심 킥은 조사하지 말 것.",
  "- 사이트 기본정보와 이전 평형·가격 자료를 수정하지 말 것.",
  "",
  "[검증]",
  "- 청약홈 공식 모집공고/PDF를 최우선. 공식 분양 홈페이지·기관추천 공문·지자체 자료 보조.",
  "- 공고 전에는 공식 예정자료가 있는 날짜만 scheduled로 기록하고 구체 날짜를 추정하지 말 것.",
  "- 특별공급과 일반공급 자격을 섞지 말 것.",
  "- 전매·재당첨·거주의무는 각각 따로 저장.",
  "",
  "[출력]",
  "설명 없이 JSON 코드블록 하나만 출력.",
  "{",
  " \"projectName\":\"{{PROJECT_NAME}}\",\"noticeVerified\":false,",
  " \"schedule\":{},\"eligibility\":{},\"specialSupplyTypes\":[],\"restrictions\":{},",
  " \"conflicts\":[],\"sources\":[],\"checkedDate\":\"{{REFERENCE_DATE}}\"",
  "}"
].join("\n");

export const DEFAULT_COMPARE_PROMPT = [
  "분양 글 제작에 사용할 주변 비교 자료를 웹 검색으로 조사해줘.",
  "",
  "[대상 기본정보]",
  "{{BASIC_DATA_BLOCK}}",
  "",
  "[저장된 평형·분양가 자료]",
  "{{PRICE_DATA_BLOCK}}",
  "",
  "[비교 순서]",
  "1. 동일 사업 선행단지/이전 차수/인접 블록 1~2개",
  "2. 같은 생활권 최근 분양 1~3개(최근 2년 우선)",
  "3. 주변 주요 아파트 실거래 1~3개",
  "",
  "[비교 규칙]",
  "- 대상 주력 전용면적과 같은 면적 우선. 없으면 ±2~3㎡까지 허용하고 실제 면적 표시.",
  "- 분양가/확장비/분양권/입주권/아파트 실거래를 반드시 구분.",
  "- 최근 실거래를 우선하되 튀는 최고가 한 건만 대표값처럼 쓰지 말 것.",
  "- 이 단계에서 대상 사업 예상 분양가·확정 시세차익·투자추천을 만들지 말 것.",
  "- 대상 사업 분양가·청약일정을 다시 검색해 덮어쓰지 말 것.",
  "- 국토부 실거래와 공식 모집공고를 우선.",
  "",
  "[출력]",
  "설명 없이 JSON 코드블록 하나만 출력.",
  "{",
  " \"projectName\":\"{{PROJECT_NAME}}\",",
  " \"precedingProject\":{\"found\":false,\"items\":[]},",
  " \"recentSales\":[],\"nearbyTransactions\":[],",
  " \"comparisonSummary\":{\"precedingProjectAvailable\":false,\"recentSaleAvailable\":false,\"nearbyTradeAvailable\":false,\"note\":\"\"},",
  " \"conflicts\":[],\"sources\":[],\"checkedDate\":\"{{REFERENCE_DATE}}\"",
  "}"
].join("\n");

export const DEFAULT_KICK_PROMPT = [
  "분양 글 제작에 사용할 대표 핵심 특징 1개를 선정해줘.",
  "",
  "[대상]",
  "{{BASIC_DATA_BLOCK}}",
  "",
  "[분양가·평형]",
  "{{PRICE_DATA_BLOCK}}",
  "",
  "[청약 일정·자격]",
  "{{SCHEDULE_DATA_BLOCK}}",
  "",
  "[주변 비교]",
  "{{COMPARE_DATA_BLOCK}}",
  "",
  "[원칙]",
  "- 핵심 킥은 좋은 점이 아니라 이 분양에서 가장 눈여겨볼 대표 특징 1개.",
  "- 저장자료만으로 판단 가능하면 웹검색 금지. 정말 필요한 사실 하나의 확인에만 공식 웹검색 허용.",
  "- 가격·실부담·물량·평형구성·청약조건·재공급 구조처럼 독자 의사결정에 직접 영향을 주는 특징 우선.",
  "- 공고 전 공식 분양가가 없으면 가격 메리트를 확정 킥으로 만들지 말 것.",
  "- 기존 숫자를 새 검색값으로 변경하지 말고 충돌은 conflicts에 기록.",
  "- 억지로 장점을 만들지 말되 대표 특징을 찾을 수 있으면 kickFound=true.",
  "",
  "[출력]",
  "설명 없이 JSON 코드블록 하나만 출력.",
  "{",
  " \"projectName\":\"{{PROJECT_NAME}}\",\"kickFound\":false,",
  " \"kick\":{\"title\":\"\",\"category\":\"\",\"summary\":\"\",\"keyNumber\":\"\",\"whyImportant\":\"\",\"evidence\":[],\"status\":\"unverified\"},",
  " \"additionalSearchUsed\":false,\"additionalSources\":[],\"conflicts\":[],\"checkedDate\":\"{{REFERENCE_DATE}}\"",
  "}"
].join("\n");

export const DEFAULT_THUMBNAIL_PROMPT = [
  "네이버 블로그용 분양 글 썸네일 이미지를 1장 만들어줘.",
  "",
  "[고정 문구 — 다른 글자 추가 금지]",
  "{{TITLE}}",
  "",
  "- 1254×1254px, 1:1 정사각형.",
  "- 문구는 고정 제목만 사용하고 부제·가격·평형·지역·숫자를 추가하지 말 것.",
  "- 1~2줄 카드형으로 크고 선명하게.",
  "- 색상 2~3개, 주거단지/분양 느낌을 자연스럽게.",
  "- 실제 특정 배치·건축 디테일을 사실처럼 만들지 말 것.",
  "- 운영자가 직접 편집한 느낌. 과도한 AI·네온·3D·복잡한 배지 금지."
].join("\n");

export const DEFAULT_PRICE_IMAGE_PROMPT = [
  "네이버 블로그 본문용 분양가·평형 인포그래픽 1장을 만들어줘.",
  "[단지] {{PROJECT_NAME}}",
  "[크기] 1600×900",
  "",
  "[저장자료]",
  "{{PRICE_DATA_BLOCK}}",
  "",
  "- 확인된 평형/타입, 공급세대수, 분양가 범위, 확장비를 정보 중심 카드로 구성.",
  "- 공고 전 가격이 없으면 분양가 미공개로 표시하고 숫자를 만들지 말 것.",
  "- 같은 면적의 타입을 임의 합산하지 말 것.",
  "- 밝고 정돈된 네이버 운영자 편집 느낌. 과한 AI·네온·3D 금지."
].join("\n");

export const DEFAULT_COMPARE_IMAGE_PROMPT = [
  "네이버 블로그 본문용 주변 가격 비교 이미지 1장을 만들어줘.",
  "[단지] {{PROJECT_NAME}}",
  "[크기] 1600×900",
  "",
  "[비교자료]",
  "{{COMPARE_DATA_BLOCK}}",
  "",
  "- 선행단지 → 최근 분양 → 주변 실거래 순서로 실제 존재하는 비교군만 표시.",
  "- 각 군 1~3개, 동일·유사 전용면적 우선.",
  "- 분양가/분양권/입주권/실거래 가격 성격을 명확하게 구분.",
  "- 시세차익 확정, 투자전망, 임의 예상분양가 문구 금지.",
  "- 정보 중심, 모바일에서 숫자가 읽히는 카드형 편집."
].join("\n");

export const DEFAULT_KICK_IMAGE_PROMPT = [
  "네이버 블로그 본문용 분양 핵심 특징 이미지 1장을 만들어줘.",
  "[단지] {{PROJECT_NAME}}",
  "[크기] 1600×900",
  "",
  "[확정된 핵심 킥]",
  "{{KICK_DATA_BLOCK}}",
  "",
  "- 위 킥 1개만 중심으로 구성. 다른 장점·숫자를 새로 추가하지 말 것.",
  "- keyNumber가 있으면 가장 눈에 띄게, 없으면 제목+핵심 설명 중심.",
  "- 정보 중심, 운영자 편집 느낌. 과장 광고·투자추천 표현 금지."
].join("\n");

export const DEFAULT_LOCATION_IMAGE_PROMPT = [
  "네이버 블로그 본문용 분양 입지 위치 안내 이미지 1장을 만들어줘.",
  "[단지] {{PROJECT_NAME}} / {{LOCATION}}",
  "[크기] 1600×900",
  "",
  "[지도 참고 메모]",
  "{{LOCATION_NOTE}}",
  "",
  "- 함께 첨부한 네이버지도 캡처는 위치 참고자료로만 사용.",
  "- 지도 캡처를 그대로 복제하지 말고 사업지가 어느 지역·생활권인지 한눈에 보이는 안내형 이미지로 재구성.",
  "- 사업지 위치 핀 + 확인 가능한 대표 지점 1~2개만 표시.",
  "- 실제 도로·거리·도보시간을 추정하지 말 것.",
  "- 복잡한 지도보다 위치 이해 중심. 밝고 깔끔한 편집형 스타일."
].join("\n");

export const DEFAULT_FINAL_PROMPT = [
  "네이버 블로그용 분양 글을 최종 발행본으로 작성해줘.",
  "",
  "[작성 기준일]",
  "{{REFERENCE_DATE}}",
  "",
  "[고정 제목]",
  "{{TITLE}}",
  "",
  "[사이트 기본정보]",
  "{{BASIC_DATA_BLOCK}}",
  "",
  "[분양가·평형 조사자료]",
  "{{PRICE_DATA_BLOCK}}",
  "",
  "[청약 일정·자격 조사자료]",
  "{{SCHEDULE_DATA_BLOCK}}",
  "",
  "[주변 비교 조사자료]",
  "{{COMPARE_DATA_BLOCK}}",
  "",
  "[핵심 킥 조사자료]",
  "{{KICK_DATA_BLOCK}}",
  "",
  "[가장 중요한 원칙]",
  "- 이 단계는 조사 단계가 아니라 편집·취합 단계다.",
  "- 위 저장자료만 사용하고 웹검색을 새로 하지 말 것.",
  "- 저장자료의 숫자·날짜·세대수·가격·상태를 임의 변경하거나 새로 만들지 말 것.",
  "- confirmed는 확정, scheduled는 예정, estimated는 예상/거론/참고, unverified는 확정 사실처럼 쓰지 말 것.",
  "- 공고 전/후를 구분하고 시세차익·경쟁률·향후 가격을 확정적으로 예측하지 말 것.",
  "",
  "[편집 구조]",
  "- 도입 2~3문단 뒤 [이미지 00 · 대표 썸네일].",
  "- [분양 핵심 POINT] ... [/분양 핵심 POINT] 박스에 확인된 핵심 5~7줄.",
  "- 실제 본문 소제목만 들어간 📋 목차.",
  "- 번호 소제목: 어떤 분양사업일까? → 어떤 평형이 얼마나 나오나? → 분양가는 얼마일까? → 주변과 비교하면? → 청약 일정과 자격은? → 이번 분양에서 눈여겨볼 점(킥 있을 때) → 입지는 어디쯤일까?(위치 이미지 사용 시) → 자주 묻는 질문.",
  "- 자료 없는 선택 섹션은 생략하고 번호와 목차를 다시 맞출 것.",
  "- 평형/분양가 자료가 충분하면 표: 평형/타입 | 공급세대수 | 분양가 | 확장비.",
  "- 주변 비교는 선행단지 → 최근 분양 → 주변 실거래 순서.",
  "- 청약 일정표 먼저, 아래 핵심 자격·전매·재당첨·거주의무.",
  "- FAQ 3~5개. 저장자료로 답할 수 있는 질문만.",
  "- 마무리 2~3문단, 출처 한 번, 해시태그 7~10개 한 줄.",
  "",
  "[이미지 위치]",
  "[이미지 01 · 분양가·평형]은 평형 또는 분양가 설명 뒤.",
  "[이미지 02 · 주변 비교]는 주변 비교 섹션 뒤.",
  "kickFound=true면 [이미지 03 · 핵심 킥].",
  "LOCATION_IMAGE_ENABLED={{LOCATION_IMAGE_ENABLED}}",
  "true일 때만 입지 섹션에 [이미지 04 · 입지 위치].",
  "",
  "[네이버 편집]",
  "- 한 문장 한 사실, 문단 사이 한 줄.",
  "- 과장 낚시·무조건·대박·로또·폭등 표현 금지.",
  "- 같은 숫자를 여러 섹션에서 과도하게 반복하지 말 것.",
  "- 제목/본문/태그만 출력하고 HTML/CSS는 쓰지 말 것.",
  "",
  "[출력 형식]",
  "최종 글 전체를 text 코드블록 하나로 출력. 코드블록 밖 설명 금지."
].join("\n");

export const PROMPT_DEFINITIONS_V2: Record<PromptKeyV2, { name: string; description: string; text: string }> = {
  PRESALE_QUEUE_10_V2: { name: "다음 분양 후보 10개 조사", description: "10개 소진 후 새 후보를 일괄 조사하는 요청서", text: DEFAULT_QUEUE_10_PROMPT },
  PRESALE_PRICE_V2: { name: "분양가·평형 조사", description: "타입·세대수·분양가·확장비·납부조건", text: DEFAULT_PRICE_PROMPT },
  PRESALE_SCHEDULE_V2: { name: "청약 일정·자격 조사", description: "일정·지역우선·통장·규제조건", text: DEFAULT_SCHEDULE_PROMPT },
  PRESALE_COMPARE_V2: { name: "주변 비교 조사", description: "선행단지→최근 분양→주변 실거래", text: DEFAULT_COMPARE_PROMPT },
  PRESALE_KICK_V2: { name: "핵심 킥 선정", description: "저장자료에서 대표 특징 1개 선정", text: DEFAULT_KICK_PROMPT },
  PRESALE_THUMBNAIL_V2: { name: "공통 썸네일", description: "1254×1254 고정 제목 썸네일", text: DEFAULT_THUMBNAIL_PROMPT },
  PRESALE_PRICE_IMAGE_V2: { name: "분양가·평형 이미지", description: "1600×900 평형/가격 카드", text: DEFAULT_PRICE_IMAGE_PROMPT },
  PRESALE_COMPARE_IMAGE_V2: { name: "주변 비교 이미지", description: "1600×900 3단 비교", text: DEFAULT_COMPARE_IMAGE_PROMPT },
  PRESALE_KICK_IMAGE_V2: { name: "핵심 킥 이미지", description: "1600×900 대표 특징 한 장", text: DEFAULT_KICK_IMAGE_PROMPT },
  PRESALE_LOCATION_IMAGE_V2: { name: "입지 위치 이미지", description: "네이버지도 캡처 참고형 위치 안내", text: DEFAULT_LOCATION_IMAGE_PROMPT },
  PRESALE_FINAL_V2: { name: "최종 원고", description: "저장자료만 취합하는 네이버 발행본", text: DEFAULT_FINAL_PROMPT },
};

export function emptyPresaleDraftV2(candidate?: PresaleCandidateV2 | null): PresaleDraftV2 {
  return {
    title: candidate?.topic || (candidate?.name ? candidate.name + " 분양 정보" : ""),
    priceRaw: "",
    scheduleRaw: "",
    compareRaw: "",
    kickRaw: "",
    finalRaw: "",
    locationImageEnabled: false,
    locationNote: "",
    updatedAt: new Date().toISOString(),
  };
}

export function fillPrompt(template: string, values: Record<string, string | number | boolean | null | undefined>) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.split("{{" + key + "}}").join(value == null ? "" : String(value));
  }, template);
}

export function basicDataBlock(candidate: PresaleCandidateV2) {
  return [
    "사업명: " + (candidate.name || ""),
    "지역: " + (candidate.region || ""),
    "주소·사업지: " + (candidate.address || "미입력"),
    "사업유형: " + (candidate.projectType || "미입력"),
    "시공사: " + (candidate.constructor || "미입력"),
    "시행·사업주체: " + (candidate.developer || "미입력"),
    "전체 세대수: " + (candidate.totalUnits ?? candidate.supply ?? "미입력"),
    "일반분양 세대수: " + (candidate.generalSaleUnits ?? "미입력"),
    "주요 전용면적: " + (Array.isArray(candidate.exclusiveAreas) && candidate.exclusiveAreas.length ? candidate.exclusiveAreas.join("㎡ · ") + "㎡" : "미입력"),
    "입주예정: " + (candidate.moveIn || "미입력"),
    "공고상태: " + (candidate.noticeStatus || candidate.status || "미입력"),
    "일정 메모: " + (candidate.schedule || ""),
    "공급 메모: " + (candidate.supplyNote || ""),
    "확인일: " + (candidate.checkedAt || ""),
    "공식 확인처: " + (candidate.officialUrl || candidate.sourceUrl || ""),
    "주의: " + (candidate.caution || ""),
  ].join("\n");
}

export function stripJsonFence(raw: string) {
  const text = String(raw || "").trim();
  const fenced = text.match(/\x60\x60\x60json\s*([\s\S]*?)\x60\x60\x60/i);
  return (fenced ? fenced[1] : text).trim();
}

export function safeJson(raw: string): any | null {
  try { return JSON.parse(stripJsonFence(raw)); } catch { return null; }
}

export function kickFound(raw: string) {
  const parsed = safeJson(raw);
  return parsed?.kickFound === true;
}

export function buildPromptV2(
  key: PromptKeyV2,
  template: string,
  candidate: PresaleCandidateV2,
  draft: PresaleDraftV2,
  referenceDate: string,
  publishedBlock = ""
) {
  const basic = basicDataBlock(candidate);
  return fillPrompt(template, {
    REFERENCE_DATE: referenceDate,
    PUBLISHED_BLOCK: publishedBlock,
    PROJECT_NAME: candidate.name,
    LOCATION: candidate.region,
    BASIC_DATA_BLOCK: basic,
    PRICE_DATA_BLOCK: draft.priceRaw || "미조사",
    SCHEDULE_DATA_BLOCK: draft.scheduleRaw || "미조사",
    COMPARE_DATA_BLOCK: draft.compareRaw || "미조사",
    KICK_DATA_BLOCK: draft.kickRaw || "미조사",
    TITLE: draft.title,
    LOCATION_NOTE: draft.locationNote || "네이버지도 캡처를 함께 첨부하고 사업지 위치를 참고할 것.",
    LOCATION_IMAGE_ENABLED: draft.locationImageEnabled ? "true" : "false",
  });
}
