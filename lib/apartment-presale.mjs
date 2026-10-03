// A lightweight, separate editorial workflow for apartment presale articles.
// It deliberately does not share six-month transaction assumptions with bulk analysis.

export function makePresaleArticlePrompt(topic, materials, dateKey) {
  const subject = String(topic || "").trim() || "분양 대상 단지명을 먼저 확인할 것";
  const evidence = String(materials || "").trim() || "사전 입력 자료 없음. 먼저 해당 단지의 최신 공식 입주자모집공고를 찾아 검증할 것.";
  return [
    "네이버 블로그용 신규 아파트 분양정보 글을 최종 발행본으로 작성해줘.",
    "",
    "[작성 기준일] " + (dateKey || "작성 시점"),
    "[분양 단지/주제] " + subject,
    "",
    "[운영자 자료·근거 메모]",
    evidence,
    "",
    "[가장 먼저 할 일: 웹 사실 검증]",
    "- 먼저 작성 기준일 현재 단계를 공식 근거로 판정: 공고 전 / 접수 중 / 접수 마감·당첨 발표 전 / 당첨 발표 후. 후보 카드의 과거 예정 문구보다 최신 공식 공고·정정공고·접수결과를 우선할 것.",
    "- 대상 단지명을 확정한 다음 SH·LH·청약홈·사업주체의 공식 입주자모집공고를 우선 확인할 것. 현재 공고가 없다면 사전예약 자료나 발표자료의 기준일을 표시할 것.",
    "- 공식 모집공고가 없더라도 조사 중단 금지. 발표일이 명시된 사업주체 자료·최근 주요 보도에서 일반분양 예정 물량, 면적별 구성, 예상 분양가의 근거, 분양 일정 변화를 추가로 찾아 예정/추정 상태를 분리할 것.",
    "- 자료가 부족하거나 서로 충돌하면 공식 사업명·통용 단지명·이전 명칭으로 재검색하고, 서로 다른 수치는 자료 날짜와 산정 기준을 병기할 것.",
    "- 독자가 궁금해할 실제 숫자를 우선 확보: 주택형별 공급, 예상 가격, 같은 전용면적대 인근 최근 실거래(단지·면적·거래일·출처), 가정별 계약금·자금 부담. 찾은 근거가 없으면 만들어 넣지 말 것.",
    "- 전체 단지 세대수, 기존 사전예약·사전청약 물량, 금회 신규 공급 물량, 특별·일반공급 물량을 서로 혼동하지 말 것.",
    "- 분양가·토지임대료·청약일·자격·대출·입주예정일은 확정/예정/과거 추정치/미확인을 분리하고, 출처가 없는 수치는 쓰지 말 것.",
    "- 토지임대부 주택이면 건물 소유권과 토지임대료를 함께 설명할 것. 일반 분양주택이면 토지임대료 항목을 억지로 추가하지 말 것.",
    "- 역·학교·공원·거리·도보시간·교통호재는 확인된 시설과 사업 단계만 기술할 것.",
    "- 다른 분양단지를 길게 끼워 넣지 말고 대상 단지에 집중할 것. 청약 권유, 수익 보장, 당첨 가능성 단정은 금지.",
    "- 이미 접수 마감된 단지는 현재 신청 가능하다고 표현하지 말고 실제 접수결과·주택형별 공급가격·당첨자 발표·계약 일정 중심의 후속 분석으로 작성할 것. 아직 발표되지 않은 경쟁률을 만들지 말 것. 불법행위 재공급·무순위는 신규 일반분양과 혼동 금지.",
    "",
    "[글 구성: 벤치마킹한 편집형 레이아웃]",
    "1) 최종 제목 1개: '지역+정확한 단지명+검증된 핵심 숫자/일정+질문'을 자연스럽게 조합. 과장 낚시·확정되지 않은 3억대 등 단정 금지.",
    "2) 도입 2~3문단: 질문형 후킹 → 오늘 글의 답 → 단지 소개. 시작부에 [이미지 00 · 대표 이미지]를 한 줄로 표시.",
    "3) '이번 분양 핵심 POINT'는 꼭 아래의 별도 박스 형식을 사용하고, 값은 검증된 내용으로 채울 것. 코드블록 사용 금지.",
    "[분양 핵심 POINT]",
    "- 기준일 / 전체 규모와 실제 금회 물량 / 주력 면적별 수량·비중 / 가격(확정 또는 근거 있는 최근 추정) / 일정(확정 또는 보도상 계획) 등 독자가 궁금한 핵심 수치 5~7줄. 자료 없는 항목을 억지로 채우지 말 것.",
    "[/분양 핵심 POINT]",
    "4) 짧은 목차: 독자가 원하는 공급·가격·입지·청약 정보를 바로 찾을 수 있게.",
    "5) 왜 지금 이 분양이 주목받는가: 객관적으로 확인된 소식만 설명.",
    "6) 단지 전경/현장 맥락과 공급 규모: 전체 세대수와 금회 신청 가능 물량을 반드시 구분하고, 공식 또는 날짜 있는 보도로 확인한 면적별 예정 물량은 상태를 밝혀 표로 작성. 합계·비중도 검산. 해당 부분 뒤에 [이미지 01 · 공급물량 핵심 카드] 표시.",
    "7) 분양가와 실제 부담: 확정 분양가가 없으면 날짜·산정 근거가 있는 최근 추정가격을 분리 소개. 가능하면 같은 전용면적대 주변 실거래를 거래일과 함께 비교하고, 가정한 계약금 비율로 필요액을 계산하되 이를 확정 계약조건이나 시세차익처럼 쓰지 말 것. 토지임대부이면 건물 분양가와 토지임대료를 구분.",
    "8) '이 단지만의 킥': 독자가 의외로 놓치기 쉬운 조건 한 가지를 현실적인 사례 없이도 이해되게 설명. 해당 부분 뒤에 [이미지 02 · 실제 부담 구조] 표시.",
    "9) 입지·교통·학교·생활권: 확인 가능한 장소만 쓰고 추정 이동시간은 쓰지 말 것.",
    "10) 해당 단계의 일정·조건: 공고 전이면 계획과 발표 예정, 접수 중이면 확정 접수·자격, 접수 마감 후이면 접수결과·당첨 발표·서류·계약 일정으로 구성. 공식 공고 없이는 임의의 접수일이나 조건을 확정하지 말 것.",
    "11) 마무리: 확인할 항목 3개와 중립적인 3줄 요약. 출처 기관·공고명·확인일을 간단히 병기.",
    "",
    "[본문 품질과 디자인]",
    "- 한 문장에 한 가지 사실, 모바일에 맞는 짧은 문단. 제목과 소제목만 크게 구분.",
    "- 본문 초반의 POINT와 목차는 정보 중복을 피하며 간결하게 작성.",
    "- 마크다운 표는 중요한 데이터에만 사용하고 원문 숫자·단위를 보존. 이미지 카드와 달리 표의 원문 정보는 본문에도 유지.",
    "- 이미지 위치는 지정된 00/01/02 세 곳만. 실제 전경 사진의 사용 권한이 없으면 가상의 건물을 해당 단지 실제 전경이라고 주장하지 말 것.",
    "- 태그는 단지명·지역명·청약 관련 핵심어 8~10개. 본문에 없는 키워드를 추가하지 말 것.",
    "- 제목, 본문, 태그만 출력. 근거 없는 수치를 단정하지 말되, 반복되는 미확인·확인 필요 표와 빈 항목을 본문에 늘어놓지 말 것. 청약 전 확인할 중요한 미확정 조건만 마지막에 3가지 이내로 묶어 정리.",
  ].join("\n");
}

export function makePresaleImagePlan() {
  return [
    { slot: "00", kind: "thumbnail", label: "대표 이미지·전경", role: "질문형 썸네일과 단지의 정확한 정체성", heading: "분양 대표 이미지", tableIndex: null, width: 1254, height: 1254 },
    { slot: "01", kind: "summary", label: "공급물량 핵심", role: "전체/금회 공급과 면적별 물량 구분", heading: "공급물량", tableIndex: null, width: 1600, height: 900 },
    { slot: "02", kind: "flow", label: "분양조건·킥", role: "실제 부담 구조 및 확인할 분양 조건", heading: "분양가와 실제 부담", tableIndex: null, width: 1600, height: 900 },
  ];
}

export function makePresaleImagePrompt(item, topic, body, notes) {
  const slot = String(item?.slot || "");
  const instruction = slot === "00"
    ? [
        "- 신뢰감 있는 편집형 썸네일. 짧은 질문형 문구 + 단지명 + 본문에서 확인된 주요 숫자 1개까지만.",
        "- 사용 권한이 있는 공식 전경·투시도를 참고자료로 직접 첨부했다면 출처·사용 범위에 맞게 이용. 그렇지 않다면 특정 단지의 실제 모습이라고 속이는 항공사진/투시도를 만들지 말고 일반화된 그래픽 배경을 쓸 것.",
      ]
    : slot === "01"
      ? [
          "- 실제 공급 유형에 맞는 비교 카드: 민간 재건축이면 전체 사업규모와 보도상 일반분양 예정·면적별 수량, 공공 사전예약 단지이면 전체/과거 예약/금회 신규, 접수 마감 단지이면 실제 공급·면적별 수량·마감 상태. 해당 없는 항목은 넣지 말 것.",
          "- 면적별 물량은 본문에 근거와 상태가 밝혀진 값이 있을 때만 추가. 값이 없으면 빈칸이나 확인 필요 카드를 만들지 말고 확인된 정보만 보여줄 것.",
        ]
      : [
          "- 이번 분양의 킥 한 가지를 중심으로 건물 분양가와 별도 비용(존재할 때만), 예정/확정 상태를 시각화.",
          "- 일반분양이면 토지임대료를 만들지 말 것. 토지임대부이면 과거 추정값과 확정값을 혼동하지 말 것.",
        ];
  return [
    "네이버 블로그 분양정보형 이미지 1장만 만들어줘.",
    "",
    "[단지/주제] " + String(topic || "").trim(),
    "[슬롯] " + slot + " · " + String(item?.label || ""),
    "[크기] " + item.width + "×" + item.height + "px",
    "[이미지 구성]",
    ...instruction,
    "- 모바일에서도 핵심 글자가 읽히도록 편집형 카드 디자인. 2~3가지 색상, 과한 3D/네온/광고 배너 스타일 금지.",
    "- 본문에 없는 가격, 공급량, 시기, 입지 정보를 임의 생성하지 말 것. 숫자에는 필요한 경우 '추정/예정/기준일'을 함께 표시.",
    "- 3장 합본 금지. 이 요청은 해당 슬롯 1장만 제작할 것.",
    "",
    "[추가 메모]",
    String(notes || "").trim() || "없음",
    "",
    "[최종 작성 본문: 사실 근거]",
    String(body || "").trim().slice(0, 10000),
  ].join("\n");
}


// The independent fact-check stage can run before OR after the first draft.
// URLs are leads for verification, never a claim that a source has been read.
export function makePresaleResearchPrompt({ topic = "", dateKey = "", sources = "", materials = "" } = {}) {
  return [
    "다음 신규 아파트 분양 단지의 공식 자료부터 조사하고, 블로그 독자에게 필요한 숫자까지 검증한 사실표를 만들어줘.",
    "[대상] " + (String(topic).trim() || "단지명부터 정확히 확정"),
    "[기준일] " + (dateKey || "오늘"),
    "[조사 시작점(제공받은 URL, 확인 완료를 의미하지 않음)]",
    String(sources).trim() || "없음",
    "[운영자 메모]",
    String(materials).trim() || "없음",
    "",
    "SH·LH·청약홈·사업주체의 입주자모집공고 또는 정정공고를 먼저 찾아 공고일·URL을 확인해줘.",
    "작성 기준일 기준으로 공고 전 / 접수 중 / 접수 마감·당첨 발표 전 / 당첨 발표 후 가운데 해당 단계를 확인해줘. 공식 마감일이 지났다면 예전 후보 카드에 '분양 예정'이라 적혀 있어도 최신 공식 접수결과·후속 공지를 우선하고 신청 안내가 아닌 결과 분석으로 전환해줘.",
    "공식 모집공고가 없으면 '본청약 공고 미확인'으로 표시하되 조사를 끝내지 말 것. 날짜가 명시된 사업주체 발표·최근 주요 보도에서 일반분양 예정·면적별 공급·예상 분양가와 근거·일정 변화까지 찾아 '발표 당시 계획'으로 구분해줘.",
    "검색 결과가 부족하거나 충돌할 경우 공식 사업명·통용 단지명·기존 명칭으로 재검색하고, 자료별 발표일과 산정 기준을 병기해줘.",
    "동일 면적대 인근 실거래 비교가 도움이 된다면 출처·거래일·전용면적이 명확한 사례만 찾아줘. 가격 차이를 확정 시세차익으로 해석하지 말 것.",
    "단지 전체 세대수 / 사전예약·사전청약 물량 / 금회 신규 공급 / 특별·일반공급 / 면적별 물량을 서로 구분해줘.",
    "분양가(토지임대부면 건물분양가+별도 토지임대료) / 청약 접수일 / 자격 / 대출 / 거주의무·전매 / 입주 예정일 가운데 이 단지와 현재 단계에 해당하는 항목의 출처와 확정·예정·과거 추정·미확인 상태를 구분해줘.",
    "확인되지 않은 정보와 출처 간 충돌을 별도의 '발행 보류·추가 확인' 항목으로 남겨줘. 과장·청약 권유 금지.",
    "아래처럼 복사하기 쉬운 짧은 조사 결과를 줘. 출처 링크 및 확인 기준일을 반드시 포함해줘.",
    "",
    "[검증 결과]",
    "정확한 단지명:",
    "작성 기준일 현재 단계(공고 전/접수 중/마감 후/발표 후)와 공식 공고일:",
    "공식 출처 URL(최대 3개):",
    "전체 단지 세대수(기준일·상태):",
    "기존 사전예약/사전청약 물량(상태):",
    "금회 신규 공급(상태):",
    "특별/일반공급(상태):",
    "면적별 물량(상태):",
    "최근 보도상 예정 물량·예상 가격(보도일·산정 근거):",
    "인근 동일 면적대 실거래 비교(실제 거래일·출처, 없으면 생략):",
    "건물 분양가·토지임대료(확정/예정/과거 추정/미확인):",
    "청약 일정·자격·대출·거주의무·전매(상태):",
    "입지 중 공식적으로 확인된 내용:",
    "놓치기 쉬운 조건(킥):",
    "발행 보류·추가 확인:",
    "[/검증 결과]",
  ].join("\n");
}

export function makePresaleProjectPrompt({ topic = "", dateKey = "", sources = "", materials = "", facts = "", kick = "" } = {}) {
  const notes = [
    "운영자가 입력한 아래 자료는 초안이며 검증 완료를 뜻하지 않습니다. 공고 원문과 재대조하세요.",
    "[공식 출처 확인 대상]\n" + (String(sources).trim() || "미입력"),
    "[사전조사 메모]\n" + (String(materials).trim() || "없음"),
    "[GPT가 조사하고 운영자가 붙여넣은 사실표]\n" + (String(facts).trim() || "없음: 먼저 직접 공식 공고를 찾을 것"),
    "[이번 글의 킥 후보]\n" + (String(kick).trim() || "검증된 단지 고유 조건에서 선정할 것"),
    "출처 없는 숫자·시설·접수일을 단정하지 말 것. 조사한 예정·추정 정보는 출처와 발표일을 밝혀 활용하고, 정말 중요한 미확정 조건만 마지막에 모아 정리할 것.",
  ].join("\n\n");
  return makePresaleArticlePrompt(topic, notes, dateKey);
}

export function makePresaleReviewPrompt({ topic = "", dateKey = "", sources = "", facts = "", article = "" } = {}) {
  return [
    "다음 신규 아파트 분양 발행 초안을 '독립된 두 번째 검증자' 입장에서 웹으로 검수해줘.",
    "[대상] " + (String(topic).trim() || "단지명 확인"),
    "[기준일] " + (dateKey || "오늘"),
    "[공식자료 후보 URL]\n" + (String(sources).trim() || "공식 공고를 직접 검색할 것"),
    "[사전조사 결과: 독립적으로 재확인할 것]\n" + (String(facts).trim() || "없음"),
    "",
    "[검증 규칙]",
    "1. SH·LH·청약홈·사업주체 공식 모집공고/정정공고의 공고일과 내용을 우선 재확인.",
    "2. 전체 단지 규모와 금회 신규 공급, 사전예약/사전청약, 특별/일반 물량의 숫자·단위·기준일 혼동을 검사.",
    "3. 분양가·토지임대료·접수일·자격·대출·입주일의 과거 추정/계획/확정 상태와 출처 점검.",
    "4. 입지시설·거리·교통호재·건물 전경이 근거 없이 단정되거나 광고성으로 표현됐는지 검사.",
    "5. 글이 도입→대표 이미지→POINT→목차→공급·가격→킥→입지→청약 체크 구조인지 확인.",
    "6. 오류 발견 시 원래의 수치를 추측해 대체하지 말고 공식 근거로 수정하거나 확인 필요로 남겨줘.",
    "7. 확정 공고가 없더라도 검증표·최근 자료에 예정 공급, 면적별 구성, 예상가격의 근거, 비교할 실거래가 있는데 본문에서 빠지고 미확인만 반복되면 정보 누락으로 지적할 것. 근거 없는 수치 추가는 금지.",
    "7-1. 기준일에 이미 마감된 공고를 접수 가능한 단지로 소개하거나, 토지임대부 주택의 월 임대료를 일반 민간분양에 적용하는 등 단계·주택 유형이 뒤섞이면 중대한 오류로 지적할 것.",
    "8. POINT가 빈 항목·미확인 나열인지, 계산한 비중·금액이 원문과 맞는지, 추정가격과 주변 실거래 비교를 확정 시세차익으로 오인하게 만들지 않는지 점검할 것.",
    "",
    "[출력]",
    "중대한 수치 오류·출처 충돌 / 확인 전 문구 / 구성 누락 / 수정 근거(URL·공고일) / 바로 붙여넣을 수 있는 수정된 제목+본문+태그 순서.",
    "",
    "[검수 대상 원고]\n" + (String(article).trim() || "아직 작성되지 않음"),
  ].join("\n");
}

// UI checks only editorial completeness. It cannot establish legal or factual correctness.
export function auditPresaleArticle(article) {
  const raw = String(article || "").trim();
  const tags = raw.split(/\r?\n/).find((line) => (line.match(/#[^\s#]+/g) || []).length >= 2) || "";
  const tagCount = (tags.match(/#[^\s#]+/g) || []).length;
  const slotCount = (slot) => (raw.match(new RegExp("\\[이미지\\s*" + slot + "(?:\\s|·|\\])", "gi")) || []).length;
  const checks = [
    { key: "body", label: "발행 본문 300자 이상", ok: raw.length >= 300 },
    { key: "points", label: "분양 핵심 POINT 박스 시작·종료", ok: raw.includes("[분양 핵심 POINT]") && raw.includes("[/분양 핵심 POINT]") },
    { key: "toc", label: "목차 포함", ok: /목차/.test(raw) },
    { key: "supply", label: "공급·물량 설명", ok: /공급|세대수|물량/.test(raw) },
    { key: "price", label: "분양가·자금 부담 설명", ok: /분양가|분양 대금|분양대금|가격/.test(raw) },
    { key: "kick", label: "이 단지만의 킥·중요 조건", ok: /킥|놓치기 쉬운|핵심 포인트|중요 조건/.test(raw) },
    { key: "subscription", label: "청약 조건·일정 설명", ok: /청약/.test(raw) },
    { key: "image00", label: "이미지 00 위치 정확히 1회", ok: slotCount("00") === 1 },
    { key: "image01", label: "이미지 01 위치 정확히 1회", ok: slotCount("01") === 1 },
    { key: "image02", label: "이미지 02 위치 정확히 1회", ok: slotCount("02") === 1 },
    { key: "tags", label: "네이버 태그 8~10개", ok: tagCount >= 8 && tagCount <= 10 },
  ];
  return { checks, passed: checks.every((item) => item.ok), tagCount };
}

const stripHeading = (value) => String(value).replace(/^#{1,6}\s*/, "").replace(/^\*\*([\s\S]+)\*\*$/, "$1").trim();
const parseRow = (value) => String(value).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isDivider = (value) => /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(value) && /-{3,}/.test(value);

// Keeps source table data and copy markers; no date/price conversion in preview.
export function parsePresaleArticle(article) {
  const lines = String(article || "").replace(/\r\n?/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean);
  const blocks = [];
  let hasTitle = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "[분양 핵심 POINT]") {
      const end = lines.indexOf("[/분양 핵심 POINT]", index + 1);
      if (end >= 0) {
        blocks.push({ type: "points", text: lines.slice(index + 1, end).join("\n") });
        index = end;
        continue;
      }
    }
    if (line === "[/분양 핵심 POINT]") continue;
    if (index + 1 < lines.length && line.includes("|") && isDivider(lines[index + 1])) {
      const headers = parseRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    if (!hasTitle) {
      blocks.push({ type: "title", text: stripHeading(line) });
      hasTitle = true;
      continue;
    }
    if (/^\[이미지\s*(00|01|02)(?:\s|·|\])/i.test(line)) {
      blocks.push({ type: "image", text: line });
      continue;
    }
    if ((line.match(/#[^\s#]+/g) || []).length >= 2 && line.startsWith("#")) {
      blocks.push({ type: "tags", text: line });
      continue;
    }
    if (/^#{2,6}\s/.test(line) || (/^\*\*.+\*\*$/.test(line) && line.length < 90) || (/^(이번 분양 핵심|목차|이 단지만의 킥)/.test(line) && line.length < 60)) {
      blocks.push({ type: "heading", text: stripHeading(line) });
      continue;
    }
    blocks.push({ type: "body", text: line });
  }
  return blocks;
}
