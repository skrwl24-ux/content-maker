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
  "네이버 블로그 본문용 아파트 평형별 가격 흐름 이미지를 1장 만들어줘.",
  "",
  "[기준 디자인 — APT_PRICE_FLOW_V1]",
  "- 함께 제공된 기준 이미지를 가장 우선적인 레이아웃 레퍼런스로 사용할 것.",
  "- 목표 크기 1600×900, 가로형 한 장.",
  "- 전체는 밝은 흰색~연한 하늘색 배경, 상단에 은은한 아파트 스카이라인/조경을 넣되 데이터보다 튀지 않게 할 것.",
  "- 상단 중앙에 큰 제목: {{COMPLEX_NAME}} 평형별 가격 흐름",
  "- 제목 아래 부제: {{YEAR}}년 실거래 기준 · 평형별 현재 가격과 거래 흐름",
  "- 중앙에는 큰 둥근 모서리 차트 카드 1개.",
  "- 차트 상단 오른쪽에 평형별 범례를 가로로 배치.",
  "- Y축 제목은 가격(억원), X축은 1월부터 작성 기준월까지 월 단위.",
  "- 평형별 가격선을 서로 확실히 구분되는 색으로 표시하고 실제 거래가 있는 월에만 원형 마커를 찍을 것.",
  "- 거래가 없는 월은 데이터 점을 만들지 말 것. 앞뒤 실제 거래월 사이 선 연결은 가능하지만 값을 새로 만들거나 보간하지 말 것.",
  "- 각 평형선의 가장 오른쪽 실제 거래점 옆에 현재 대표가격을 컬러 배지로 크게 표시.",
  "- 하단에는 실제 존재하는 평형 수만큼 요약카드를 균형 있게 배치. 2개면 2개, 4개면 4개처럼 고정 4칸을 강제하지 말 것.",
  "- 각 카드에는 평형명, 정확한 전용면적 범위, 현재 대표가격, 현재 대표가격 기준월, 1~3월/4~6월/7월~현재 거래건수를 표시.",
  "- 현재 대표가격은 가장 최근 거래가 있는 월의 중앙값을 그대로 사용할 것.",
  "- 월 대표가격은 입력값 그대로 사용하고 임의 평균·보정·추세값·예측값을 만들지 말 것.",
  "- 월별 거래량 막대그래프는 만들지 말 것.",
  "- 평면도, 투자 전망, 신고가/저점 배지, 해석 문구, 추가 통계는 넣지 말 것.",
  "- 하단 출처 문구는 딱 한 줄만: {{SOURCE_LINE}}",
  "- 기준 이미지에 있는 예시 숫자·평형·주석은 복사하지 말고 아래 이번 단지 실제 데이터로 모두 교체할 것.",
  "",
  "[이번 단지 데이터]",
  "{{DATA_BLOCK}}"
].join("\n");

export const DEFAULT_STRUCTURE_PROMPT_TEMPLATE = [
  "아파트 평형별 방·욕실 구조를 웹 검색으로 사실 확인해줘.",
  "",
  "[대상 단지]",
  "단지명: {{COMPLEX_NAME}}",
  "지역: {{LOCATION}}",
  "주소: {{ADDRESS}}",
  "",
  "[확인할 평형]",
  "{{AREA_LIST}}",
  "",
  "[검증 원칙 — 반드시 지킬 것]",
  "- 반드시 웹 검색을 실제로 수행할 것.",
  "- 공식 분양자료, 건설사 원문, 공공기관·지자체·공동주택 관련 원문을 최우선으로 확인할 것.",
  "- 면적만 보고 방·욕실 수를 추정하지 말 것.",
  "- 같은 전용면적에 A/B/C 등 여러 타입이 있으면 타입별 방·욕실 수가 같은지 확인할 것.",
  "- 같은 평형군의 실제 타입별 방·욕실 수가 다르면 status=varies.",
  "- 신뢰할 만한 원문으로 확정하면 status=verified.",
  "- 자료가 불충분하거나 서로 충돌하면 status=needs_check로 두고 rooms/baths는 null.",
  "- 확인이 어렵다고 판단한 항목을 억지로 채우지 말 것.",
  "- 다른 단지나 같은 이름의 인접 단지 평면도를 섞지 말 것.",
  "",
  "[출력 형식 — 복사 버튼 한 번으로 가져갈 수 있게]",
  "- 반드시 ```json 코드블록 하나로 출력할 것.",
  "- 코드블록 안에는 유효한 JSON만 넣을 것.",
  "- 출처 칩·웹 인용 UI는 JSON 문자열 안에 넣지 말 것.",
  "",
  "```json",
  "{",
  '  "areas": [',
  '    {"areaGroup":84,"rooms":null,"baths":null,"status":"needs_check","source":"","note":""}',
  "  ]",
  "}",
  "```"
].join("\n");

export const DEFAULT_LIFE_KICK_PROMPT_TEMPLATE = [
  "아파트 단지의 생활·입지 킥을 웹 검색으로 1개만 조사해줘.",
  "",
  "[대상]",
  "단지명: {{COMPLEX_NAME}}",
  "지역: {{LOCATION}}",
  "주소: {{ADDRESS}}",
  "",
  "[목표]",
  "이 아파트에 실제로 살 때 의미가 큰 대표 생활 요소 1개만 고른다.",
  "후보: 대형마트·트레이더스·코스트코·주요 역·중심상권·전통시장·공원·호수·하천·산책로·도서관·문화시설·체육시설·지역 대표 축제·가족생활 시설.",
  "",
  "[검증 원칙 — 반드시 지킬 것]",
  "- 반드시 웹 검색을 실제로 수행할 것.",
  "- 지자체·공공기관·운영기관·공식 시설 페이지 등 최신 공식자료를 우선 확인할 것.",
  "- 현재 운영 여부와 정확한 시설/역/공원 지점을 확인할 것.",
  "- 단지와 실제 같은 생활권에서 이용 가능한지 확인할 것.",
  "- 생활 킥이 역·마트·시장·공원·도서관 등 실제 방문 지점이라면 도보 경로도 추가로 확인할 것.",
  "- 도보 시간·거리는 지도/길찾기 결과나 경로 자료에서 실제 경로가 확인된 경우에만 입력할 것.",
  "- 직선거리로 도보시간을 계산하거나 평균 보행속도로 추정하지 말 것.",
  "- 도보 경로 시작점과 도착점을 명확히 적을 것. 역이면 가능하면 출구 번호까지 확인할 것.",
  "- 경로 자료가 없거나 검색 결과를 신뢰하기 어려우면 walkingVerified=false, walkingMinutes=null, walkingDistanceM=null.",
  "- 축제는 {{YEAR}}년 실제 개최 여부를 공식 자료로 확인한 경우에만 선택할 것.",
  "- 광고성 표현이나 '초역세권·바로 앞·도보권' 같은 과장 표현은 근거 없으면 쓰지 말 것.",
  "- 내부적으로 여러 후보를 비교해도 최종 출력은 가장 강한 1개만.",
  "- 적절한 킥을 검증하지 못하면 kickFound=false.",
  "",
  "[출력 형식 — 복사 버튼 한 번으로 가져갈 수 있게]",
  "- 반드시 ```json 코드블록 하나로 출력할 것.",
  "- 코드블록 안에는 유효한 JSON만 넣을 것.",
  "- 출처 칩·웹 인용 UI는 JSON 문자열 안에 넣지 말 것.",
  "",
  "```json",
  "{",
  '  "kickFound": false,',
  '  "title": "",',
  '  "category": "",',
  '  "summary": "",',
  '  "walkingVerified": false,',
  '  "walkingMinutes": null,',
  '  "walkingDistanceM": null,',
  '  "routeFrom": "",',
  '  "routeTo": "",',
  '  "routeSource": {"name":"","url":"","checked":""},',
  '  "sourceText": "",',
  '  "sources": [],',
  '  "verified": false',
  "}",
  "```"
].join("\n");

export const DEFAULT_LIFE_IMAGE_PROMPT_TEMPLATE = [
  "네이버 블로그 본문용 아파트 생활·입지 이미지 1장을 만들어줘.",
  "",
  "[단지]",
  "{{COMPLEX_NAME}} / {{LOCATION}}",
  "",
  "[검증 완료된 생활 킥 — 이것만 사용]",
  "{{KICK_TITLE}}",
  "{{KICK_CATEGORY_LINE}}",
  "{{KICK_SUMMARY}}",
  "{{WALKING_LINE}}",
  "",
  "[제작 규칙]",
  "- 1600×900 가로형 한 장.",
  "- 검증 완료된 생활 킥 1개만 시각화할 것. 다른 시설·역·공원·상권을 새로 추가하지 말 것.",
  "- 실제 생활에서 왜 의미 있는지 한눈에 이해되는 장면으로 구성할 것.",
  "- 위에 '검증된 도보 정보'가 있을 때만 도보 시간·거리를 표시할 것.",
  "- 검증된 도보 정보가 없으면 거리·도보시간·차량시간을 새로 만들지 말 것.",
  "- 실제 브랜드/기관 로고를 임의로 변형하거나 복제하지 말 것.",
  "- 과장된 광고·네온·3D 인포그래픽 느낌보다 자연스럽고 신뢰감 있는 블로그 정보 이미지.",
  "- 하단에 별도 출처문구나 새로운 사실을 추가하지 말 것."
].join("\n");

export const DEFAULT_THUMBNAIL_PROMPT_TEMPLATE = [
  "네이버 블로그용 아파트 단지 글 썸네일 이미지를 1장 만들어줘.",
  "",
  "[고정 문구 — 다른 글자 추가 금지]",
  "{{TITLE}}",
  "",
  "[제작 규칙]",
  "- 1254×1254px, 1:1 정사각형.",
  "- 문구는 정확히 '{{TITLE}}'만 사용하고 부제·가격·평형·지역·숫자 추가 금지.",
  "- 문구는 1~2줄 카드형으로 크고 선명하게.",
  "- 색상은 2~3개 안에서 정돈하고 배경과 글자 대비를 충분히 확보.",
  "- 아파트 조감도/주거단지 느낌을 자연스럽게 사용하되 실제 특정 동 배치나 건축 디테일을 사실처럼 만들어내지 말 것.",
  "- 네이버 블로그 운영자가 직접 편집한 것처럼 깔끔하고 신뢰감 있게.",
  "- 과도한 AI 느낌, 네온, 번쩍이는 효과, 복잡한 아이콘, 불필요한 배지 금지."
].join("\n");

export const DEFAULT_FINAL_ARTICLE_TEMPLATE = [
  "네이버 블로그용 아파트 단지 글을 최종 발행본으로 작성해줘.",
  "",
  "[작성 기준일]",
  "{{REFERENCE_DATE}}",
  "",
  "[고정 제목]",
  "{{TITLE}}",
  "",
  "[이 글의 목적]",
  "- 독자가 지금 가격, 어떤 평형이 있는지, 방·욕실 구조, {{YEAR}}년 가격·거래 흐름, 생활 킥 1개를 빠르게 확인하게 한다.",
  "- 길게 분석하는 투자글이 아니라 실제 데이터 확인형 단지 글이다.",
  "- 모바일에서 빠르게 훑어봐도 핵심 정보가 바로 들어오게 작성한다.",
  "",
  "",
  "[가장 중요한 원칙]",
  "",
  "- 아래에 모아둔 자료만 사용할 것.",
  "- 새 가격·새 거래건수·새 변화율·새 거리·새 생활시설을 만들어내지 말 것.",
  "- 제공되지 않은 방·욕실 수를 면적만 보고 추정하지 말 것.",
  "- 같은 평형군에서도 타입별 구조가 다르면 하나의 방·욕실 수로 합치지 말 것.",
  "- 구조 정보가 충분하지 않으면 억지로 채우지 말 것.",
  "- 반등·심리·호재·저점·고점·매수추천 같은 투자 해석을 하지 말 것.",
  "- 가격 흐름은 월 대표가격의 실제 방향만 짧게 설명할 것.",
  "- 거래 없는 월의 값을 보간하거나 거래가 있었던 것처럼 쓰지 말 것.",
  "- 생활 킥은 아래 검증 완료된 1개만 사용할 것.",
  "- 생활 킥과 관계없는 주변 시설을 임의로 추가하지 말 것.",
  "- Q&A도 반드시 아래 제공 자료 안에서만 작성할 것.",
  "- 직접 살아본 후기처럼 쓰지 말 것.",
  "- 모바일에서 읽기 쉽게 문장이 끝날 때마다 한 줄씩 띄울 것.",
  "- 한 문단을 너무 길게 만들지 말 것.",
  "",
  "",
  "[중복 방지 원칙 — 매우 중요]",
  "",
  "- 같은 숫자와 같은 설명을 핵심 POINT, 본문, Q&A, 마무리에서 반복하지 말 것.",
  "- 영역별 역할을 명확하게 분리할 것.",
  "",
  "핵심 POINT = 전체 내용을 빠르게 보는 요약",
  "본문 = 숫자의 근거와 실제 흐름",
  "Q&A = 독자가 헷갈릴 만한 부분의 보충 설명",
  "마무리 = 숫자를 다시 나열하지 않는 짧은 정리",
  "",
  "- 핵심 POINT 문장을 본문에서 거의 그대로 반복하지 말 것.",
  "- 본문에서 충분히 설명한 내용을 Q&A에서 그대로 다시 질문하지 말 것.",
  "- 마무리에서 가격·거래건수·거리·도보시간을 다시 나열하지 말 것.",
  "- 같은 숫자는 꼭 필요한 경우를 제외하면 글 전체에서 최대 2회 정도만 노출할 것.",
  "- 차트와 표에서 이미 확인 가능한 데이터를 본문에서 전부 다시 나열하지 말 것.",
  "",
  "",
  "[단지 기본정보]",
  "{{COMPLEX_DATA_BLOCK}}",
  "",
  "",
  "[국토부 실거래 API로 수집·식별된 {{YEAR}}년 자료]",
  "{{DATA_BLOCK}}",
  "",
  "",
  "[저장된 평형 구조 조사자료]",
  "{{STRUCTURE_DATA_BLOCK}}",
  "",
  "",
  "[저장된 생활·입지 조사자료]",
  "{{LIFE_KICK_BLOCK}}",
  "",
  "",
  "",
  "────────────────────",
  "[최종 글 구성 — 순서 고정]",
  "────────────────────",
  "",
  "",
  "제목: {{TITLE}}",
  "",
  "",
  "[짧은 도입]",
  "",
  "- {{YEAR}}년 현재 가격과 거래 흐름을 확인한다는 내용으로 2~3문장 작성할 것.",
  "- 평형·구조·생활 포인트도 함께 살펴본다는 정도까지만 안내할 것.",
  "- 도입에서 구체적인 가격·거래건수·거리 숫자를 미리 나열하지 말 것.",
  "- 투자 평가나 전망으로 시작하지 말 것.",
  "",
  "",
  "",
  "────────────────────",
  "[핵심 POINT]",
  "────────────────────",
  "",
  "첫 줄:",
  "",
  "✨ 이 단지 핵심 POINT",
  "",
  "- 4~5개 bullet만 작성할 것.",
  "- 각 항목은 `•`로 시작할 것.",
  "- 한 항목은 가급적 한 줄로 끝낼 것.",
  "- 모든 데이터를 넣으려고 하지 말 것.",
  "",
  "우선순위:",
  "1. 현재 대표가격",
  "2. 확인된 평형",
  "3. {{YEAR}}년 거래 흐름에서 가장 눈에 띄는 사실 1개",
  "4. 구조 정보 상태",
  "5. 대표 생활 킥",
  "",
  "- 기간별 거래량 3개를 핵심 POINT에서 모두 나열하지 말 것.",
  "- 생활 킥에서는 정확한 거리·도보시간을 반복하지 않고 시설명 또는 특징 위주로 짧게 표시할 것.",
  "- 세대수·사용승인일 등은 이번 글 이해에 꼭 필요할 때만 포함할 것.",
  "",
  "예시 형태:",
  "",
  "✨ 이 단지 핵심 POINT",
  "",
  "• 현재 대표가격: 24평대 6억",
  "",
  "• 확인된 평형: 24평대 · 전용 59.7~59.8㎡",
  "",
  "• 최근 구간에서 거래량이 가장 많이 확인됨",
  "",
  "• 방·욕실 구조: 타입별 상이",
  "",
  "• 생활 포인트: 수인분당선 망포역 도보권",
  "",
  "※ 위 숫자와 문구는 예시이며 실제 출력에서는 제공된 자료만 사용할 것.",
  "",
  "",
  "",
  "────────────────────",
  "[목차]",
  "────────────────────",
  "",
  "- 핵심 POINT 바로 아래에 목차를 넣을 것.",
  "- 첫 줄은 반드시 정확히 `📋 목차`로 작성할 것.",
  "- 목차 항목은 바로 아래에 `1. 2. 3.` 번호 형식으로 한 줄씩 작성할 것.",
  "- 목차 안에는 별도 설명문을 넣지 말 것.",
  "- 목차 제목이나 항목 앞에 `┃`, `│`, `|`, `>` 등의 장식 문자를 붙이지 말 것.",
  "- 목차를 직접 박스처럼 꾸미거나 세로선을 문자로 표현하지 말 것.",
  "- 배경색, 왼쪽 포인트 라인, 제목 강조 등 목차 디자인은 사이트의 네이버 최종편집 단계에서 자동 적용한다.",
  "- 목차 문구와 실제 본문 소제목은 정확히 동일해야 한다.",
  "- 목차 순서와 실제 본문 순서도 정확히 동일해야 한다.",
  "- `📋 목차` 다음에는 반드시 {{TOC_BLOCK}}에 포함된 항목만 작성할 것.",
  "",
  "목차 내용:",
  "{{TOC_BLOCK}}",
  "",
  "출력 형태:",
  "",
  "📋 목차",
  "",
  "1. 첫 번째 소제목",
  "2. 두 번째 소제목",
  "3. 세 번째 소제목",
  "",
  "※ 실제 문구는 반드시 {{TOC_BLOCK}}을 따를 것.",
  "",
  "",
  "",
  "────────────────────",
  "[가격 섹션]",
  "────────────────────",
  "",
  "제목:",
  "1. 평형별 지금 가격은 얼마일까?",
  "",
  "제목 바로 아래:",
  "",
  "[평형별 가격 흐름 차트 이미지]",
  "",
  "- 현재 대표가격을 가장 먼저 짧게 알려줄 것.",
  "- 평형이 여러 개라면 제공된 평형별 현재 대표가격만 정리할 것.",
  "",
  "[가격 흐름 서술 규칙]",
  "",
  "- 차트에 월별 가격이 표시되므로 모든 월 가격을 본문에서 다시 나열하지 말 것.",
  "- 현재 대표가격 1문장 + 가격 흐름 1~2문장 + 거래량 1문장 정도로 압축할 것.",
  "- 가격 흐름은 시작점 → 주요 변화점 → 현재 정도만 선택해서 설명할 것.",
  "- 월별 가격 숫자를 4개 이상 연속으로 나열하지 말 것.",
  "- 거래가 없는 월은 흐름을 연결해서 표현하지 말 것.",
  "- 반등·회복·저점·고점·매수세 같은 해석 표현은 사용하지 말 것.",
  "",
  "[거래량 서술]",
  "",
  "- 1~3월, 4~6월, 7월~현재 거래건수는 한 문장 안에서 짧게 정리할 것.",
  "- 제공된 거래건수만 사용할 것.",
  "- 새 변화율을 계산해 넣지 말 것.",
  "- 어느 기간의 거래가 상대적으로 많거나 적다는 사실은 제공된 숫자로 명확할 때만 짧게 표현할 수 있다.",
  "",
  "예시 구조:",
  "",
  "현재 확인된 ○○평대의 {{YEAR}}년 ○월 대표가격은 ○억입니다.",
  "",
  "대표가격은 연초 ○억에서 ○월 ○억까지 움직인 뒤 최근에는 ○억이 확인됐습니다.",
  "",
  "거래량은 1~3월 ○건, 4~6월 ○건, 7월~현재 ○건입니다.",
  "",
  "※ 위 숫자는 형식 예시이며 실제 자료만 사용할 것.",
  "",
  "",
  "",
  "────────────────────",
  "[평형 구조 섹션]",
  "────────────────────",
  "",
  "{{STRUCTURE_SECTION_BLOCK}}",
  "",
  "[평형 구조 공통 규칙]",
  "",
  "- 확인된 정보만 표로 작성할 것.",
  "",
  "기본 표:",
  "",
  "평형대 | 전용면적 | 방 | 욕실",
  "",
  "- 방·욕실 수가 확정된 경우에만 숫자로 표시할 것.",
  "- status=varies 또는 타입별 차이가 확인된 경우 `타입별 상이`라고 표시할 것.",
  "- 확인되지 않은 방·욕실 수를 일반적인 아파트 구조를 기준으로 추정하지 말 것.",
  "- 같은 전용면적에서도 타입 차이가 있다면 그대로 표시할 것.",
  "",
  "[표 아래 설명]",
  "",
  "- 표에서 이미 확인 가능한 내용을 여러 문장으로 반복하지 말 것.",
  "- 필요한 주의사항만 1문장 작성할 것.",
  "",
  "예:",
  "같은 평형군에서도 타입별 구조가 달라 방·욕실 수를 하나로 표시하지 않았습니다.",
  "",
  "",
  "",
  "────────────────────",
  "[생활 킥 섹션]",
  "────────────────────",
  "",
  "- 제목은 목차 번호와 실제 목차 문구를 그대로 사용할 것.",
  "- 제목 문구가 `여기 살면 어떤 점이 좋을까?`라면 그대로 사용할 것.",
  "",
  "제목 아래:",
  "",
  "[생활 킥 이미지]",
  "",
  "- 검증 완료된 생활 킥 1개만 사용할 것.",
  "- 다른 생활시설을 추가하지 말 것.",
  "- 생활 킥 본문에서 처음으로 정확한 거리와 도보시간을 자세히 표시할 것.",
  "- 검증된 거리와 시간이 둘 다 있는 경우에만 둘 다 사용할 것.",
  "- 거리만 확인됐으면 시간을 추정하지 말 것.",
  "- 시간만 확인됐으면 거리를 추정하지 말 것.",
  "",
  "[생활 킥 작성 방식]",
  "",
  "- 2~4문장으로 작성할 것.",
  "- 첫 문장: 어떤 생활 포인트인지",
  "- 두 번째 문장: 검증된 거리·시간 등 구체적인 정보",
  "- 세 번째 문장: 실제 생활에서 어떤 의미가 있는지 짧게 설명",
  "- 직접 살아본 것처럼 쓰지 말 것.",
  "- 투자 가치나 호재와 연결하지 말 것.",
  "",
  "예시 흐름:",
  "",
  "대표 생활 포인트는 ○○역 이용입니다.",
  "",
  "단지에서 ○○역까지 확인된 경로는 약 ○m, 도보 ○분입니다.",
  "",
  "출퇴근이나 외출 때 걸어서 역을 이용할 수 있다는 점이 생활 측면의 특징입니다.",
  "",
  "",
  "",
  "────────────────────",
  "[Q&A]",
  "────────────────────",
  "",
  "제목:",
  "❓ 자주 묻는 질문",
  "",
  "- Q&A는 3개만 작성할 것.",
  "- 본문 내용을 그대로 다시 묻고 답하는 반복형 Q&A를 만들지 말 것.",
  "- 독자가 데이터를 보고 헷갈릴 수 있는 부분을 보충하는 역할로 작성할 것.",
  "- 답변은 1~2문장으로 짧게 작성할 것.",
  "- 새로운 정보를 추가하지 말 것.",
  "",
  "[질문 우선순위]",
  "",
  "1. 현재 대표가격이 어느 기준월의 자료인지",
  "2. 방·욕실 수를 하나로 표시하지 않은 이유",
  "3. 최근 거래량을 볼 때 확인해야 할 기준",
  "4. 생활 킥의 거리·시간이 어떤 경로 기준인지",
  "5. 여러 평형이 있다면 평형별 차이",
  "",
  "- 위 후보 중 제공 자료로 명확하게 답할 수 있는 질문 3개만 선택할 것.",
  "- 단순히 `현재 가격은 얼마인가요?`, `어떤 평형인가요?`처럼 본문을 그대로 복사하는 질문은 가급적 피할 것.",
  "- 단, 중요한 주의사항 전달에 필요하면 사용할 수 있다.",
  "",
  "출력 형태:",
  "",
  "Q. 질문",
  "",
  "답변.",
  "",
  "",
  "Q. 질문",
  "",
  "답변.",
  "",
  "",
  "Q. 질문",
  "",
  "답변.",
  "",
  "",
  "",
  "────────────────────",
  "[마무리]",
  "────────────────────",
  "",
  "- 1~2문장만 작성할 것.",
  "- 가격·거래건수·거리·도보시간 등의 숫자를 다시 나열하지 말 것.",
  "- 글에서 확인한 범위를 짧게 정리할 것.",
  "- 매수·매도 권유 금지.",
  "- 향후 가격 전망 금지.",
  "- 투자 가치 평가 금지.",
  "",
  "예시 흐름:",
  "",
  "이번 글에서는 ○○아파트의 {{YEAR}}년 실거래 흐름과 평형 구조, 대표 생활 포인트를 확인했습니다.",
  "",
  "실제 단지를 살펴볼 때는 평형별 타입 차이도 함께 확인하면 됩니다.",
  "",
  "",
  "",
  "────────────────────",
  "[출처]",
  "────────────────────",
  "",
  "- 글 마지막에 아래 출처 문구를 한 줄만 넣을 것.",
  "",
  "{{SOURCE_LINE}}",
  "",
  "- 별도의 출처 목록이나 URL을 추가하지 말 것.",
  "",
  "",
  "",
  "────────────────────",
  "[해시태그]",
  "────────────────────",
  "",
  "- 출처 다음에 네이버 블로그용 해시태그를 7~10개 작성할 것.",
  "- 단지명 태그를 가장 먼저 배치할 것.",
  "- 제공된 단지명·지역·평형·실거래·생활 킥 자료 안에서만 만들 것.",
  "- 자료에 없는 시설명·역명·호재·투자 키워드를 임의로 추가하지 말 것.",
  "- 비슷한 의미의 태그를 과도하게 반복하지 말 것.",
  "- 해시태그는 한 줄로 작성할 것.",
  "",
  "",
  "────────────────────",
  "[전체 편집 스타일]",
  "────────────────────",
  "",
  "- 네이버 블로그 모바일 화면에서 읽기 쉽게 작성할 것.",
  "- 문장이 끝날 때마다 한 줄 띄울 것.",
  "- 한 문단은 최대 1~3문장 정도로 짧게 구성할 것.",
  "- 소제목은 본문과 확실히 구분할 것.",
  "- 핵심 POINT, 목차, Q&A가 한눈에 보이게 할 것.",
  "- 이모지는 정보 구분 용도로만 적당히 사용할 것.",
  "- 이모지를 문장마다 붙이지 말 것.",
  "- 과도한 감탄사·광고성 표현을 사용하지 말 것.",
  "- 정보 확인형 글답게 차분하고 자연스럽게 작성할 것.",
  "- 같은 정보를 표현만 바꿔 반복해서 글자 수를 늘리지 말 것.",
  "- 목차의 시각적 디자인은 텍스트로 흉내 내지 말고 사이트 자동 서식에 맡길 것.",
  "",
  "",
  "",
  "────────────────────",
  "[최종 자체 검수 — 출력 전에 반드시 확인]",
  "────────────────────",
  "",
  "최종 글을 출력하기 전에 다음을 내부적으로 확인할 것.",
  "",
  "- 같은 가격이 불필요하게 3번 이상 반복되지 않았는가?",
  "- 같은 거래건수가 POINT·본문·Q&A에 계속 반복되지 않았는가?",
  "- 같은 거리·도보시간이 여러 섹션에서 반복되지 않았는가?",
  "- 표에 있는 내용을 바로 아래 문장에서 그대로 반복하지 않았는가?",
  "- Q&A가 본문 복사본이 되지 않았는가?",
  "- 마무리에서 숫자를 다시 요약하고 있지 않은가?",
  "- 자료에 없는 방·욕실·생활시설·가격을 추가하지 않았는가?",
  "- 목차와 실제 소제목 문구 및 번호가 정확히 일치하는가?",
  "- 목차 앞에 `┃`, `│`, `|`, `>` 같은 장식 문자가 들어가지 않았는가?",
  "- `📋 목차`와 번호 항목이 사이트가 인식할 수 있는 단순한 텍스트 구조로 출력됐는가?",
  "",
  "문제가 있으면 중복 문장을 삭제하거나 더 짧게 수정한 뒤 최종 출력할 것.",
  "",
  "",
  "",
  "────────────────────",
  "[출력 형식 — 매우 중요]",
  "────────────────────",
  "",
  "- 최종 글 전체를 ```text 코드블록 하나로 출력할 것.",
  "- 코드블록 밖에는 어떠한 설명도 붙이지 말 것.",
  "- SEO 메모를 추가하지 말 것.",
  "- 작성 과정이나 검증 과정 설명을 추가하지 말 것.",
  "- 요청서 지시문을 최종 글에 노출하지 말 것.",
  "- `{{변수명}}` 같은 템플릿 변수는 최종 결과에 남기지 말 것.",
  "- `[평형별 가격 흐름 차트 이미지]`와 `[생활 킥 이미지]`는 지정된 위치에 그대로 한 줄씩 표시할 것.",
  "",
  "최종 순서:",
  "",
  "제목",
  "→ 짧은 도입",
  "→ ✨ 이 단지 핵심 POINT",
  "→ 📋 목차",
  "→ 가격",
  "→ 평형 구조",
  "→ 생활 킥",
  "→ ❓ 자주 묻는 질문",
  "→ 짧은 마무리",
  "→ 출처",
  "→ 해시태그",
  "",
  "- 위 순서를 반드시 지킬 것.",
].join("\n");

function fillPromptTemplate(template: string, values: Record<string, string>) {
  let output = String(template || "");
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll("{{" + key + "}}", value);
  }
  return output;
}


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

export function buildStructurePrompt(
  snapshot: DataSnapshot,
  needsCheckGroups: number[],
  template = DEFAULT_STRUCTURE_PROMPT_TEMPLATE
) {
  const areas = snapshot.areas.filter((area) => needsCheckGroups.includes(area.areaGroup));
  return fillPromptTemplate(template, {
    COMPLEX_NAME: snapshot.complex.name,
    LOCATION: [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    ADDRESS: snapshot.complex.road_address || snapshot.complex.address || "주소 정보 없음",
    AREA_LIST: areas.map((area) => "- areaGroup " + area.areaGroup + " / " + area.displayName + " / " + area.exclusiveLabel).join("\n"),
    YEAR: String(snapshot.year),
  });
}

export function buildLifeKickPrompt(
  snapshot: DataSnapshot,
  template = DEFAULT_LIFE_KICK_PROMPT_TEMPLATE
) {
  return fillPromptTemplate(template, {
    COMPLEX_NAME: snapshot.complex.name,
    LOCATION: [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    ADDRESS: snapshot.complex.road_address || snapshot.complex.address || "주소 정보 없음",
    YEAR: String(snapshot.year),
  });
}

export function buildChartPrompt(snapshot: DataSnapshot, template: string) {
  const sourceLine = snapshot.referenceDate.replace(/-/g, ".") + " 기준 · 국토부 실거래 자료";
  const filled = template
    .replaceAll("{{COMPLEX_NAME}}", snapshot.complex.name)
    .replaceAll("{{YEAR}}", String(snapshot.year))
    .replaceAll("{{SOURCE_LINE}}", sourceLine)
    .replaceAll("{{DATA_BLOCK}}", dataLines(snapshot));
  const guard = [
    "",
    "[이번 제작에서 반드시 유지할 규칙]",
    "- 첨부한 APT_PRICE_FLOW_V1 기준 이미지의 정보 구조와 배치를 우선적으로 따라갈 것.",
    "- 기준 이미지의 예시 숫자·평형·주석은 복사하지 말고 이번 단지 실제 데이터로 교체할 것.",
    "- 거래 없는 월에는 점을 만들지 말 것. 실제 거래월 사이 선 연결은 가능하지만 값 보간은 금지.",
    "- 하단 평형 카드는 실제 존재하는 평형 수만큼만 만들 것.",
    "- 출처는 '" + sourceLine + "' 한 줄만 표시할 것.",
    "- 그 밖의 추가 주석·투자 해석·신고가/저점 배지·평면도는 넣지 말 것."
  ].join("\n");
  if (filled.includes("{{")) {
    return filled + "\n\n[데이터]\n" + dataLines(snapshot) + "\n" + sourceLine + guard;
  }
  return filled + guard;
}

export function buildLifeImagePrompt(
  snapshot: DataSnapshot,
  kick: {
    title: string;
    category?: string;
    summary: string;
    walkingVerified?: boolean;
    walkingMinutes?: number | null;
    walkingDistanceM?: number | null;
    routeFrom?: string;
    routeTo?: string;
  },
  template = DEFAULT_LIFE_IMAGE_PROMPT_TEMPLATE
) {
  const walkingLine = kick.walkingVerified && kick.walkingMinutes
    ? "검증된 도보 정보: " + (kick.routeFrom || "단지") + " → " + (kick.routeTo || kick.title) + " / 약 " + kick.walkingMinutes + "분" +
      (kick.walkingDistanceM ? " / " + kick.walkingDistanceM + "m" : "")
    : "";

  return fillPromptTemplate(template, {
    COMPLEX_NAME: snapshot.complex.name,
    LOCATION: [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    KICK_TITLE: kick.title,
    KICK_CATEGORY_LINE: kick.category ? "종류: " + kick.category : "",
    KICK_SUMMARY: kick.summary,
    WALKING_LINE: walkingLine,
    YEAR: String(snapshot.year),
  });
}

export function buildThumbnailPrompt(
  snapshot: DataSnapshot,
  template = DEFAULT_THUMBNAIL_PROMPT_TEMPLATE
) {
  return fillPromptTemplate(template, {
    COMPLEX_NAME: snapshot.complex.name,
    TITLE: snapshot.complex.name + " 얼마일까?",
    LOCATION: [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong].filter(Boolean).join(" "),
    YEAR: String(snapshot.year),
  });
}

export function buildFinalArticlePrompt(
  snapshot: DataSnapshot,
  structures: Array<{ area_group: number; room_count: number | null; bath_count: number | null; status: string }>,
  kick: {
    title: string;
    summary: string;
    walkingVerified?: boolean;
    walkingMinutes?: number | null;
    walkingDistanceM?: number | null;
    routeFrom?: string;
    routeTo?: string;
  },
  includeStructure: boolean,
  template = DEFAULT_FINAL_ARTICLE_TEMPLATE
) {
  const structureByGroup = new Map(
    structures.map((item) => [Number(item.area_group), item])
  );
  const structureLines = snapshot.areas.map((area) => {
    const item = structureByGroup.get(area.areaGroup);
    const label = area.displayName + " / " + area.exclusiveLabel;

    if (!item || item.status === "needs_check") {
      return "- " + label + " / 방 확인 필요 / 욕실 확인 필요";
    }
    if (item.status === "varies") {
      return "- " + label + " / 방 타입별 상이 / 욕실 타입별 상이";
    }
    return "- " + label + " / 방 " + item.room_count + " / 욕실 " + item.bath_count;
  });

  const hasStructure = includeStructure && structureLines.length > 0;
  const hasLifeKick = Boolean(kick.title.trim() && kick.summary.trim());
  const structureDataBlock = hasStructure
    ? "[저장된 평형 구조 조사자료]\n" + structureLines.join("\n")
    : "[평형 구조]\n구조 섹션 제외";
  const structureSectionBlock = hasStructure
    ? [
        "[평형 구조 섹션]",
        "- 제목: 2. 평형별 구조는 어떻게 다를까?",
        "- 확인된 정보만 표 형태로 정리: 평형대 | 전용면적 | 방 | 욕실.",
        "- status=varies인 경우 숫자를 억지로 하나로 만들지 말고 '타입별 상이'라고 표시.",
        "- needs_check이거나 확인되지 않은 평형도 표에서 빼지 말고 방·욕실을 '확인 필요'로 표시."
      ].join("\n")
    : "";
  const tocItems = ["1. 평형별 지금 가격은 얼마일까?"];
  if (hasStructure) tocItems.push((tocItems.length + 1) + ". 평형별 구조는 어떻게 다를까?");
  if (hasLifeKick) tocItems.push((tocItems.length + 1) + ". 여기 살면 어떤 점이 좋을까?");
  tocItems.push((tocItems.length + 1) + ". 자주 묻는 질문");
  const faqHeading = tocItems[tocItems.length - 1];
  const tocBlock = tocItems.join("\n");
  const lifeKickBlock = hasLifeKick
    ? [
        kick.title,
        kick.summary,
        kick.walkingVerified && kick.walkingMinutes
          ? "검증된 도보 정보: " + (kick.routeFrom || "단지") + " → " + (kick.routeTo || kick.title) + " / 약 " + kick.walkingMinutes + "분" +
            (kick.walkingDistanceM ? " / " + kick.walkingDistanceM + "m" : "")
          : ""
      ].filter(Boolean).join("\n")
    : "검증 완료된 생활·입지 킥 없음 — 생활 킥 섹션과 생활 킥 관련 Q&A는 작성하지 말 것.";
  const referenceDate = snapshot.referenceDate.replace(/-/g, ".");
  const sourceLine = referenceDate + " 기준 · 국토부 실거래 API 자료";

  const normalizedTemplate = template
    .replace(
      "- 제목: 자주 묻는 질문",
      "- 제목: " + faqHeading
    )
    .replace(
      "- 생활 킥은 아래 검증 완료된 1개만 사용할 것.",
      "- 생활 킥은 아래 검증 완료된 자료가 있을 때만 사용할 것. 검증 완료된 생활 킥이 없으면 해당 섹션과 관련 Q&A를 생략할 것."
    )
    .replace(
      [
        "[생활 킥 섹션]",
        "- 제목은 목차 번호에 맞춰 '여기 살면 어떤 점이 좋을까?'로 쓸 것.",
        "- [생활 킥 이미지]를 한 줄로 표시.",
        "- 검증된 킥 1개만 사용할 것."
      ].join("\n"),
      [
        "[생활 킥 섹션]",
        "- 위 [저장된 생활·입지 조사자료]에 검증 완료된 킥이 있을 때만 작성할 것.",
        "- 검증 완료된 킥이 없다고 적혀 있으면 이 섹션 전체를 생략할 것.",
        "- 작성하는 경우 제목은 목차 번호에 맞춰 '여기 살면 어떤 점이 좋을까?'로 쓸 것.",
        "- [생활 킥 이미지]를 한 줄로 표시.",
        "- 검증된 킥 1개만 사용할 것."
      ].join("\n")
    );

  return fillPromptTemplate(normalizedTemplate, {
    REFERENCE_DATE: referenceDate,
    YEAR: String(snapshot.year),
    COMPLEX_NAME: snapshot.complex.name,
    TITLE: snapshot.complex.name + " 얼마일까?",
    DATA_BLOCK: dataLines(snapshot),
    STRUCTURE_DATA_BLOCK: structureDataBlock,
    STRUCTURE_SECTION_BLOCK: structureSectionBlock,
    LIFE_KICK_BLOCK: lifeKickBlock,
    TOC_BLOCK: tocBlock,
    FAQ_HEADING: faqHeading,
    SOURCE_LINE: sourceLine,
  });
}

export function safeParseJson(raw: string) {
  const cleaned = raw.trim()
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/^\`\`\`\s*/i, "")
    .replace(/\s*\`\`\`$/, "");
  return JSON.parse(cleaned);
}
