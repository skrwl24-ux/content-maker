// A lightweight, separate editorial workflow for apartment presale articles.
// It deliberately does not share six-month transaction assumptions with bulk analysis.

function compactPromptText(value, max = 8000) {
  const text = String(value == null ? "" : value).trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "\n[긴 입력 일부 생략 · 원문은 사이트 작업에 보관]";
}

export function makePresaleArticlePrompt(topic, materials, dateKey) {
  const subject = compactPromptText(topic, 240) || "분양 대상 단지명을 먼저 확인할 것";
  const evidence = compactPromptText(materials, 12000) || "사전 입력 자료 없음. 먼저 해당 단지의 최신 공식 입주자모집공고를 찾아 검증할 것.";
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
    "- 독자의 판단에 큰 영향을 주는 핵심 정보는 확정 여부와 별개로 반드시 먼저 찾아볼 것. 특히 분양가는 '미정' 한 줄로 끝내지 말고 대상 단지 자체의 최근 예상가·거론가·추산가가 있는지 별도 검색한 뒤, 있으면 상태와 근거를 밝혀 본문에 반영할 것.",
    "- 가격 조사는 0순위 대상 단지 자체의 최근 주요 보도·기관추천·사업주체 자료에 직접 언급된 3.3㎡당 예상가/거론가·주택형별 예상가, 1순위 동일 사업의 선행단지·이전 차수·인접 블록 실제 모집공고, 2순위 같은 생활권의 최근 신규분양, 3순위 주변 신축의 동일 면적대 실제 거래 순으로 찾을 것.",
    "- 3.3㎡당 가격이 확인돼도 전용면적÷3.3에 단순 곱해 타입별 분양가를 만들지 말 것. 기사·공고의 공급면적/계약면적 기준 또는 해당 주택형 환산값이 확인될 때만 59㎡·84㎡ 등 예상 금액을 제시할 것.",
    "- 동일 사업 선행단지 가격이 있으면 인근 일반 단지보다 먼저 사용하고 공고일·전용면적·최저~최고 또는 대표 타입 가격을 표시. 현재 단지의 확정가처럼 쓰지 말고 '가장 가까운 참고선'으로 설명할 것.",
    "- 직접적인 예상 분양가 보도가 있으면 보도일·산정 근거를 붙여 별도 표시. 대상 단지 자체의 예상가가 확인되면 비교단지보다 앞에 배치하되 '예상/거론/추산' 상태를 명확히 표시. 근거가 하나뿐이면 임의의 새 예상가를 만들지 말고 '참고 가격선', 복수 근거가 겹칠 때만 '관찰 범위'로 표현할 것.",
    "- 전체 단지 세대수, 기존 사전예약·사전청약 물량, 금회 신규 공급 물량, 특별·일반공급 물량을 서로 혼동하지 말 것.",
    "- 분양가·토지임대료·청약일·자격·대출·입주예정일은 확정/예정/과거 추정치/미확인을 분리하고, 출처가 없는 수치는 쓰지 말 것.",
    "- 토지임대부 주택이면 건물 소유권과 토지임대료를 함께 설명할 것. 일반 분양주택이면 토지임대료 항목을 억지로 추가하지 말 것.",
    "- 단지 고유 스토리는 가격·물량·일정·자격 검증 뒤 0~1개만 탐색. 우선순위는 ① 실제 판단에 영향을 주는 특별공급·토지임대부·지분적립형 등 제도/공급 구조 ② 사업 과정·이전 부지·공식 설계 같은 사업 스토리 ③ 직접 연결이 확인된 생활·관리 이야기.",
    "- 공개 커뮤니티·SNS는 질문 발견용 단서일 뿐 본문 근거로 쓰지 말고, 공식 공지·기관·사업주체·날짜 확인된 신뢰할 만한 기사로 재확인. 일부 사례를 주민 전체 성향·수준으로 일반화 금지. 검증 가능한 이야기가 없으면 생략.",
    "- 역·학교·공원·거리·도보시간·교통호재는 확인된 시설과 사업 단계만 기술할 것.",
    "- 다른 분양단지를 길게 끼워 넣지 말고 대상 단지에 집중할 것. 청약 권유, 수익 보장, 당첨 가능성 단정은 금지.",
    "- 이미 접수 마감된 단지는 현재 신청 가능하다고 표현하지 말고 실제 접수결과·주택형별 공급가격·당첨자 발표·계약 일정 중심의 후속 분석으로 작성할 것. 아직 발표되지 않은 경쟁률을 만들지 말 것. 불법행위 재공급·무순위는 신규 일반분양과 혼동 금지.",
    "",
    "[글 구성: 분양 전문 가이드형 레이아웃 · 정보 밀도 우선]",
    "1) 최종 제목 1개: '지역+정확한 단지명+검증된 핵심 숫자/일정+질문'을 자연스럽게 조합. 과장 낚시·확정되지 않은 3억대 등 단정 금지.",
    "2) 도입 2~3문단: 질문형 후킹 → 오늘 글의 답 → 단지 소개. 시작부에 [이미지 00 · 대표 이미지]를 한 줄로 표시.",
    "3) '이번 분양 핵심 POINT'는 꼭 아래의 별도 박스 형식을 사용하고, 값은 검증된 내용으로 채울 것. 코드블록 사용 금지.",
    "[분양 핵심 POINT]",
    "- 기준일 / 전체 규모와 실제 금회 물량 / 주력 면적별 수량·비중 / 가격(확정 또는 근거 있는 최근 추정) / 일정(확정 또는 보도상 계획) 등 독자가 궁금한 핵심 수치 5~7줄. 자료 없는 항목을 억지로 채우지 말 것.",
    "[/분양 핵심 POINT]",
    "4) 짧은 목차: 독자가 원하는 공급·가격·입지·청약 정보를 바로 찾을 수 있게. 단지 복잡도에 맞춰 6~10개 정도로 구성하되 빈 장으로 글을 늘리지 말 것.",
    "5) 왜 지금 이 분양이 주목받는가: 객관적으로 확인된 소식만 설명.",
    "6) 단지 전경/현장 맥락과 공급 규모: 전체 세대수와 금회 신청 가능 물량을 반드시 구분하고, 공식 또는 날짜 있는 보도로 확인한 면적별 예정 물량은 상태를 밝혀 표로 작성. 합계·비중도 검산. 해당 부분 뒤에 [이미지 01 · 공급물량 핵심 카드] 표시.",
    "7) 분양가와 실제 부담: 독자가 가장 먼저 궁금해하는 '그래서 얼마를 참고하면 되나?'에 답할 것. 확정 분양가가 있으면 주택형별 확정값을 사용. 확정값이 없으면 먼저 대상 단지 자체의 최근 3.3㎡당 예상가·거론가·주택형별 추산가를 찾아 상태·보도일·산정 근거와 함께 제시하고, 그다음 동일 사업 선행단지·이전 차수 실제 모집공고 → 인근 최근 분양 → 주변 신축 실거래 순으로 교차검증할 것. 직접 예상가가 전혀 없을 때만 비교자료를 '참고 가격선/관찰 범위'로 사용. 가격 미확정이라는 문장은 이 설명 뒤의 짧은 주의문으로 처리하고 섹션 전체를 '모름/확인 필요'로 끝내지 말 것. 가정한 계약금 비율 계산은 실제 계약조건과 구분하고, 토지임대부이면 건물 분양가와 토지임대료를 구분.",
    "8) '이 단지만의 킥': 가격·실부담·금회 물량·공급구조처럼 판단에 직접 필요한 정보를 최우선으로 1개 선정. 검증된 제도·사업·생활 스토리가 더 강하면 같은 섹션 안에 [정보 박스: 이 단지만의 이야기]로 3~5문장만 넣고, 없으면 만들지 말 것. 별도 스토리 섹션을 추가하지 말고 해당 부분 뒤에 [이미지 02 · 분양조건·킥 카드] 표시.",
    "9) 입지·교통·학교·생활권: 확인 가능한 장소만 쓰고 추정 이동시간은 쓰지 말 것.",
    "10) 해당 단계의 일정·조건: 공고 전이면 계획과 발표 예정, 접수 중이면 확정 접수·자격, 접수 마감 후이면 접수결과·당첨 발표·서류·계약 일정으로 구성. 공식 공고 없이는 임의의 접수일이나 조건을 확정하지 말 것.",
    "11) 확인된 근거가 충분하면 '자주 묻는 질문(FAQ)'을 3~5개 배치. Q. 질문 / A. 답변 형식. 공고 전 청약 비율·자격·대출 조건을 추측하지 말 것.",
    "12) 마무리: 확인할 항목 3개와 중립적인 3줄 요약. 출처 기관·공고명·확인일을 간단히 병기.",
    "",
    "[벤치마킹형 가독성: 네이버 편집용 경량 마커]",
    "- 도입 → [이미지 00] → 핵심 POINT 박스 → 목차 → 번호 있는 큰 소제목 → 사진/표/설명 → 결론·FAQ 순서.",
    "- 소제목 아래 짧은 맥락 문단과 근거 자료를 두고, 독자가 저장할 만한 정보만 별도 박스로 보여줄 것. 보조 정보 박스는 2~4개 이내.",
    "- 보조 박스는 다음처럼 정확히 표기하고 닫을 것. [정보 박스: 주목할 포인트] ... [/정보 박스], [정보 박스: 분양 예상] ... [/정보 박스], [정보 박스: 준비 체크리스트] ... [/정보 박스], [정보 박스: 주의사항] ... [/정보 박스]. 내부는 '- 내용' 형식. 해당 주제와 근거가 있는 유형만 사용.",
    "- 동일 정보를 표·박스·이미지로 중복 나열하지 말 것. 가격·공급 시점은 기준일과 확정·예정·과거계획 여부를 같이 표기.",
    "- 사이트가 위 경량 마커를 HTML 서식으로 렌더링하므로 본문에 HTML/CSS, Base64 이미지, 코드블록은 직접 넣지 말 것.",
    "- 근거 있는 설명은 유지하면서 모바일용으로 한 문단 2~4줄, 한 문장 한 사실을 지킬 것.",
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
          "- 이번 분양에서 독자에게 가장 의미 있는 한 가지를 중심으로 구성. 우선순위는 실제 가격 비교 → 실부담·금회 물량·공급구조 → 검증된 제도·사업 스토리. 본문에 동일 사업 선행단지·이전 차수의 실제 분양가가 있으면 '선행단지 실제 가격 → 이번 단지에서 볼 가격 포인트' 비교를 먼저 사용.",
          "- 확정 분양가가 없다는 사실만 크게 보여주는 빈 카드 금지. 비교 가능한 실제 가격이 있으면 공고일·면적·상태를 함께 표시하고, 이번 단지 가격과 혼동되지 않게 '참고', '선행단지 실제 분양가', '이번 단지 확정 전'을 명확히 구분.",
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
    compactPromptText(sources, 1800) || "없음",
    "[운영자 메모]",
    compactPromptText(materials, 2200) || "없음",
    "",
    "SH·LH·청약홈·사업주체의 입주자모집공고 또는 정정공고를 먼저 찾아 공고일·URL을 확인해줘.",
    "작성 기준일 기준으로 공고 전 / 접수 중 / 접수 마감·당첨 발표 전 / 당첨 발표 후 가운데 해당 단계를 확인해줘. 공식 마감일이 지났다면 예전 후보 카드에 '분양 예정'이라 적혀 있어도 최신 공식 접수결과·후속 공지를 우선하고 신청 안내가 아닌 결과 분석으로 전환해줘.",
    "공식 모집공고가 없으면 '본청약 공고 미확인'으로 표시하되 조사를 끝내지 말 것. 날짜가 명시된 사업주체 발표·기관추천 자료·최근 주요 보도에서 일반분양 예정·면적별 공급·예상 분양가와 근거·일정 변화까지 찾아 '발표 당시 계획'으로 구분해줘.",
    "분양가는 독자 핵심정보이므로 별도 검색을 반드시 수행해줘. 대상 단지명 + 예상 분양가 / 평당 분양가 / 3.3㎡당 / 분양가 거론 / 주택형별 예상가 조합으로 최근 자료를 찾아, 대상 단지 자체의 직접적인 가격 신호가 있는지 먼저 확인해줘.",
    "가격은 0순위 대상 단지 자체의 최근 3.3㎡당 예상가·거론가·주택형별 추산가, ① 동일 사업 선행단지·이전 차수·인접 블록의 실제 모집공고 분양가 ② 같은 생활권의 최근 신규분양 실제 분양가 ③ 주변 신축 동일 면적대 실제 거래 순으로 조사해줘. 대상 단지 직접 예상가가 있으면 비교자료보다 먼저 제시하고 보도일·산정 근거·예상/거론 상태를 같이 써줘.",
    "3.3㎡당 가격을 전용면적÷3.3에 단순 곱해 59㎡·84㎡ 예상가를 만들지 말아줘. 기사나 공고가 사용한 공급면적/계약면적 기준 또는 주택형별 환산값이 확인될 때만 타입별 예상 금액을 적어줘.",
    "현재 단지의 확정 분양가가 없더라도 비교 가능한 ①~③이 있으면 '가격 참고선 없음'으로 끝내지 말 것. 다만 비교값을 현재 단지의 예상·확정 분양가로 둔갑시키지 말고 차이의 이유(시기·위치·상품·층/타입)를 함께 적어줘.",
    "검색 결과가 부족하거나 충돌할 경우 공식 사업명·통용 단지명·기존 명칭으로 재검색하고, 자료별 발표일과 산정 기준을 병기해줘.",
    "동일 면적대 인근 실거래 비교가 도움이 된다면 출처·거래일·전용면적이 명확한 사례만 찾아줘. 가격 차이를 확정 시세차익으로 해석하지 말 것.",
    "",
    "[추가 탐색: 이 단지만의 킥·스토리]",
    "핵심 숫자 검증을 끝낸 뒤 이 단지만의 검증 가능한 이야기를 0~1개만 찾아줘. 우선순위: 특별공급·공급방식 같은 제도 → 사업 과정·이전 부지·공식 설계 → 단지와 직접 연결된 생활·관리 사례.",
    "커뮤니티·SNS·게시글은 질문 발견용 단서로만 쓰고 반드시 공식 공지·기관·사업주체·날짜 확인된 기사로 재확인. 확인되지 않으면 '없음'. 주민 전체 성향·수준으로 일반화 금지.",
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
    "대상 단지 자체 가격 신호 — 3.3㎡당 예상/거론가·주택형별 예상가(보도일·근거·상태, 없으면 없음):",
    "가격 비교 1순위 — 동일 사업 선행단지/이전 차수/인접 블록 실제 분양가(공고일·전용면적·가격범위, 없으면 없음):",
    "가격 비교 2순위 — 같은 생활권 최근 신규분양(공고일·전용면적·가격범위, 없으면 생략):",
    "가격 비교 3순위 — 주변 신축 동일 면적대 실거래(실제 거래일·출처, 없으면 생략):",
    "가격 관찰 포인트 — 현재 단지가 비교선의 어느 구간을 유지/넘는지 등 공고에서 볼 질문(예상가로 단정 금지):",
    "건물 분양가·토지임대료(확정/예정/과거 추정/미확인):",
    "청약 일정·자격·대출·거주의무·전매(상태):",
    "입지 중 공식적으로 확인된 내용:",
    "검증된 단지 고유 스토리 후보(없으면 없음): [분류] 사실 / 단지와의 연결 / 원문 URL·자료일 / 글에서 쓸 이유",
    "놓치기 쉬운 조건(킥):",
    "발행 보류·추가 확인:",
    "[/검증 결과]",
  ].join("\n");
}

export function makePresaleProjectPrompt({ topic = "", dateKey = "", sources = "", materials = "", facts = "", kick = "" } = {}) {
  const notes = [
    "운영자가 입력한 아래 자료는 초안이며 검증 완료를 뜻하지 않습니다. 공고 원문과 재대조하세요.",
    "[공식 출처 확인 대상]\n" + (compactPromptText(sources, 1800) || "미입력"),
    "[사전조사 메모]\n" + (compactPromptText(materials, 2200) || "없음"),
    "[GPT가 조사하고 운영자가 붙여넣은 사실표]\n" + (compactPromptText(facts, 8500) || "없음: 먼저 직접 공식 공고를 찾을 것"),
    "[이번 글의 킥·스토리 후보]\n" + (compactPromptText(kick, 1500) || "가격·실부담·공급구조를 우선하고, 검증된 단지 고유 스토리가 있으면 1개만 사용"),
    "출처 없는 숫자·시설·접수일을 단정하지 말 것. 조사한 예정·추정 정보는 출처와 발표일을 밝혀 활용하고, 정말 중요한 미확정 조건만 마지막에 모아 정리할 것.",
  ].join("\n\n");
  return makePresaleArticlePrompt(topic, notes, dateKey);
}

export function makePresaleReviewPrompt({ topic = "", dateKey = "", sources = "", facts = "", article = "" } = {}) {
  return [
    "다음 신규 아파트 분양 발행 초안을 '독립된 두 번째 검증자' 입장에서 웹으로 검수해줘.",
    "[대상] " + (String(topic).trim() || "단지명 확인"),
    "[기준일] " + (dateKey || "오늘"),
    "[공식자료 후보 URL]\n" + (compactPromptText(sources, 1800) || "공식 공고를 직접 검색할 것"),
    "[사전조사 결과: 독립적으로 재확인할 것]\n" + (compactPromptText(facts, 8500) || "없음"),
    "",
    "[검증 규칙]",
    "1. SH·LH·청약홈·사업주체 공식 모집공고/정정공고의 공고일과 내용을 우선 재확인.",
    "2. 전체 단지 규모와 금회 신규 공급, 사전예약/사전청약, 특별/일반 물량의 숫자·단위·기준일 혼동을 검사.",
    "3. 분양가·토지임대료·접수일·자격·대출·입주일의 과거 추정/계획/확정 상태와 출처 점검.",
    "4. 입지시설·거리·교통호재·건물 전경이 근거 없이 단정되거나 광고성으로 표현됐는지 검사.",
    "5. 글이 도입→대표 이미지→POINT→목차→공급·가격→킥→입지→청약 체크 구조인지 확인.",
    "6. 오류 발견 시 원래의 수치를 추측해 대체하지 말고 공식 근거로 수정하거나 확인 필요로 남겨줘.",
    "7. 확정 공고가 없더라도 검증표·최근 자료에 예정 공급, 면적별 구성, 예상가격의 근거, 비교할 실거래가 있는데 본문에서 빠지고 미확인만 반복되면 정보 누락으로 지적할 것. 근거 없는 수치 추가는 금지.",
    "7-1. 현재 단지 분양가가 미확정이면 단지명과 '예상 분양가/평당 분양가/3.3㎡당/분양가 거론/주택형별 예상가'를 조합해 최근 자료를 독립적으로 다시 검색할 것. 대상 단지 자체의 직접 예상가·거론가가 존재하는데 본문에서 빠졌으면 중요한 정보 누락으로 지적할 것.",
    "7-2. 대상 단지 직접 예상가가 없더라도 동일 사업 선행단지·이전 차수의 실제 모집공고 가격이 존재하면, 이를 가장 가까운 참고선으로 본문 가격 섹션에 쓰지 않은 것을 정보 누락으로 지적할 것.",
    "7-3. 가격 섹션이 '확정 분양가 미확인'만 반복하고 실제 금액이 하나도 없으면 대상 단지 직접 예상가 → 동일 사업 선행단지 → 인근 최근 분양 → 주변 신축 실거래 순으로 다시 조사하게 할 것. 비교값은 현재 단지 예상가로 단정하지 말 것.",
    "7-4. 3.3㎡당 가격에서 타입별 예상가를 계산했다면 공급면적/계약면적 근거가 있는지 확인하고, 전용면적÷3.3 단순 계산이면 오류로 지적할 것.",
    "7-5. 기준일에 이미 마감된 공고를 접수 가능한 단지로 소개하거나, 토지임대부 주택의 월 임대료를 일반 민간분양에 적용하는 등 단계·주택 유형이 뒤섞이면 중대한 오류로 지적할 것.",
    "8. POINT가 빈 항목·미확인 나열인지, 계산한 비중·금액이 원문과 맞는지, 추정가격과 주변 실거래 비교를 확정 시세차익으로 오인하게 만들지 않는지 점검할 것.",
    "9. '이 단지만의 이야기'가 있으면 원문 출처·자료일·단지와의 직접 연결을 재확인. 커뮤니티·SNS만 근거인 이야기, 주민 전체를 일반화하는 표현, 다른 단지 사례의 전용은 삭제하거나 확인 필요로 돌릴 것. 스토리가 없어도 글 완성도 오류로 보지 말 것.",
    "",
    "[출력]",
    "중대한 수치 오류·출처 충돌 / 확인 전 문구 / 구성 누락 / 수정 근거(URL·공고일) / 바로 붙여넣을 수 있는 수정된 제목+본문+태그 순서.",
    "",
    "[검수 대상 원고]\n" + (compactPromptText(article, 16000) || "아직 작성되지 않음"),
  ].join("\n");
}

// Accept a normal ChatGPT heading as a POINT card, so a valid article is not
// blocked just because the model omitted the internal [POINT] delimiters.
// Explicit delimiters (including an incomplete pair) remain untouched, which
// preserves the audit's ability to detect a genuinely broken manual box.
export function normalizePresaleArticle(article) {
  const raw = String(article || "").replace(/\r\n?/g, "\n");
  if (raw.includes("[분양 핵심 POINT]") || raw.includes("[/분양 핵심 POINT]")) return raw;
  const lines = raw.split("\n");
  const heading = /^(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:📌\s*)?(?:이번\s+)?분양\s+핵심\s*POINT\s*(?:\*\*|__)?\s*[:：]?\s*$/i;
  const bullet = /^[-*•]\s+\S/;
  const index = lines.findIndex((line) => heading.test(line.trim()));
  if (index < 0) return raw;
  let start = index + 1;
  while (start < lines.length && !lines[start].trim()) start += 1;
  if (start >= lines.length || !bullet.test(lines[start].trim())) return raw;
  let lastBullet = -1;
  for (let i = start; i < lines.length; i += 1) {
    if (bullet.test(lines[i].trim())) {
      lastBullet = i;
      continue;
    }
    if (!lines[i].trim()) {
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next += 1;
      if (next < lines.length && bullet.test(lines[next].trim())) continue;
    }
    break;
  }
  if (lastBullet < start) return raw;
  return [
    ...lines.slice(0, index),
    "[분양 핵심 POINT]",
    ...lines.slice(index + 1, lastBullet + 1),
    "[/분양 핵심 POINT]",
    ...lines.slice(lastBullet + 1),
  ].join("\n");
}

// UI checks only editorial completeness. It cannot establish legal or factual correctness.
export function auditPresaleArticle(article) {
  const raw = normalizePresaleArticle(article).trim();
  const tags = raw.split(/\r?\n/).find((line) => (line.match(/#[^\s#]+/g) || []).length >= 2) || "";
  const tagCount = (tags.match(/#[^\s#]+/g) || []).length;
  const slotCount = (slot) => (raw.match(new RegExp("\\[이미지\\s*" + slot + "(?:\\s|·|\\])", "gi")) || []).length;
  const checks = [
    { key: "body", label: "발행 본문 300자 이상", ok: raw.length >= 300 },
    { key: "points", label: "분양 핵심 POINT 요약 카드 인식", ok: raw.includes("[분양 핵심 POINT]") && raw.includes("[/분양 핵심 POINT]") },
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
  // Editorial heuristics only: highlight empty-looking results without pretending
  // to verify source accuracy, and never block articles with legitimately sparse evidence.
  const pointBody = raw.match(/\[분양 핵심 POINT\]([\s\S]*?)\[\/분양 핵심 POINT\]/)?.[1] || "";
  const pointNumbers = pointBody.replace(/\b20\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?\b/g, "")
    .match(/\d[\d,]*(?:\.\d+)?\s*(?:세대|가구|호|건|억원|억|만원|원|%|㎡|평)/g) || [];
  const meaningfulNumbers = new Set(pointNumbers.map((value) => value.replace(/\s/g, ""))).size;
  const placeholderCount = (pointBody.match(/미확인|확인 필요|미정|미공개/g) || []).length;
  const qualityWarnings = [];
  if (raw.length >= 300 && pointBody && meaningfulNumbers < 2) {
    qualityWarnings.push("POINT에 공급·가격 등 서로 다른 구체적 수치가 2개 미만입니다. 확인된 자료에서 독자에게 유용한 핵심 정보를 더 찾아보세요.");
  }
  if (raw.length >= 300 && placeholderCount >= 2) {
    qualityWarnings.push("POINT에 미확인·확인 필요 문구가 반복됩니다. 조사로 보완할 수 있는 예정 정보는 출처와 발표일을 표시해 활용하세요.");
  }
  const priceUncertain = /분양가[^\n]{0,35}(?:미확인|미정|미공개|확정\s*(?:전|아님|아니))|(?:미확인|미정|미공개)[^\n]{0,35}분양가/.test(raw);
  const moneyValues = raw.match(/\d[\d,]*(?:\.\d+)?\s*(?:억(?:원)?|억원|만원|원)/g) || [];
  const directPriceSignal = /(?:3\.3\s*㎡당|평당)[^\n]{0,30}\d[\d,.]*\s*(?:만원|억|억원)|(?:예상|거론|추산)[^\n]{0,45}\d[\d,.]*\s*(?:억(?:원)?|억원|만원)/.test(raw);
  const priceReference = directPriceSignal || /(선행\s*단지|이전\s*차수|인접\s*(?:단지|블록)|1단지|같은\s*사업|인근\s*(?:분양|신축|실거래)|주변\s*(?:분양|신축|실거래)|참고\s*(?:가격|가격선)|보도상\s*(?:예상|추산))/.test(raw);
  if (raw.length >= 300 && priceUncertain && moneyValues.length === 0) {
    qualityWarnings.push("분양가가 미확정이라는 설명만 있고 실제 가격 정보가 없습니다. 대상 단지의 예상·거론가를 먼저 검색하고, 없으면 동일 사업 선행단지 → 인근 최근 분양 → 주변 신축 실거래 순으로 가격 참고선을 조사하세요.");
  } else if (raw.length >= 300 && priceUncertain && !priceReference) {
    qualityWarnings.push("가격 숫자는 있지만 대상 단지 예상가인지 비교 가격인지 근거가 약합니다. 예상·거론·선행단지·인근분양·실거래 중 어떤 가격인지 출처와 기준일을 밝혀 주세요.");
  }
  return { checks, passed: checks.every((item) => item.ok), tagCount, qualityWarnings };
}

const stripHeading = (value) => String(value).replace(/^#{1,6}\s*/, "").replace(/^\*\*([\s\S]+)\*\*$/, "$1").trim();
const parseRow = (value) => String(value).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isDivider = (value) => /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(value) && /-{3,}/.test(value);

// Keeps source table data and copy markers; no date/price conversion in preview.
export function parsePresaleArticle(article) {
  const lines = normalizePresaleArticle(article).split("\n").map((s) => s.trim()).filter(Boolean);
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
    if (line === "[/분양 핵심 POINT]" || line === "[/정보 박스]") continue;
    const infoMatch = /^\[정보 박스:\s*([^\]\n]+)\]$/.exec(line);
    if (infoMatch) {
      const end = lines.indexOf("[/정보 박스]", index + 1);
      if (end >= 0) {
        const title = infoMatch[1].trim();
        const tone = /주의|경고|위험/.test(title) ? "warning"
          : /체크|준비|확인/.test(title) ? "check"
          : /예상|계획|일정/.test(title) ? "estimate" : "note";
        blocks.push({ type: "info", title, tone, text: lines.slice(index + 1, end).join("\n") });
        index = end;
        continue;
      }
    }
    if (/^-{3,}$/.test(line)) {
      blocks.push({ type: "divider", text: "" });
      continue;
    }
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
      const text = stripHeading(line);
      if (/^(?:📋\s*)?목차$/.test(text)) {
        const toc = [];
        let j = index + 1;
        while (j < lines.length && toc.length < 12 &&
          !/^(?:#{2,6}\s|\[이미지\s*|\[정보 박스:|\[분양 핵심 POINT\]|-{3,}$)/.test(lines[j])) {
          toc.push(lines[j]);
          j += 1;
        }
        blocks.push({ type: "toc", text: toc.join("\n") });
        index = j - 1;
        continue;
      }
      blocks.push({ type: "heading", text, level: /^#{3,6}\s/.test(line) ? 3 : 2 });
      continue;
    }
    if (/^Q[.:]\s*|^Q\s*[.)]\s*/i.test(line)) {
      blocks.push({ type: "faqQuestion", text: line });
      continue;
    }
    blocks.push({ type: "body", text: line });
  }
  return blocks;
}
