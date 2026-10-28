/**
 * Apartment V4 is an editorial layer. It must never synthesize actual
 * contracts, property photos, prices or transport times from general language.
 */
export const APARTMENT_V4_SCENES = Object.freeze([
  {slot:"00",name:"대표 썸네일",type:"design",hint:"실제 핵심 숫자·짧은 질문·건물/배경 클로즈업 크롭",width:1600,height:900},
  {slot:"01",name:"실제 단지 외관",type:"photo",hint:"정확한 단지명이 확인된 사용권 확보 사진",width:1600,height:900},
  {slot:"02",name:"최근 6개월 실거래 흐름",type:"data",hint:"동일 전용면적의 월별 가격과 거래 건수",width:1600,height:900},
  {slot:"03",name:"최근 거래 비교",type:"data",hint:"검증된 거래일·층·면적·가격만 비교",width:1600,height:900},
  {slot:"04",name:"주변 단지 비교",type:"data",hint:"확인된 인근 단지와 동일 면적 기준으로 비교",width:1600,height:900},
  {slot:"05",name:"이 글의 핵심 발견",type:"data",hint:"실제 거래에서 찾은 놀라운 차이 또는 검증된 생활킥 하나",width:1600,height:900},
  {slot:"06",name:"교통·학군·생활권",type:"photo",hint:"출처 확인된 생활권 사진 또는 위치 설명 도식",width:1600,height:900},
  {slot:"07",name:"추가 발견",type:"data",hint:"앞의 카드에 없는 검증된 가격·거래·생활정보 한 가지",width:1600,height:900},
]);

export function apartmentV4Count(value) {
  return [6,7,8].includes(Number(value)) ? Number(value) : 7;
}

export function apartmentV4Scenes(count = 7) {
  return APARTMENT_V4_SCENES.slice(0, apartmentV4Count(count));
}

export function apartmentV4ArticleOnly(raw) {
  const lines = String(raw || "").replace(/\r\n?/g,"\n").split("\n");
  const index = lines.findIndex(line => {
    const cleaned = line.trim().replace(/^#{1,6}\s*/,"").replace(/^\[/,"").replace(/\]$/,"").trim();
    return /^(?:이미지\s*기획(?:\s*메모)?|검수\s*메모|출처\s*메모)(?:\s*[:：].*)?$/.test(cleaned);
  });
  return (index >= 0 ? lines.slice(0,index) : lines).join("\n").trim();
}

export function apartmentV4Audit(raw, count) {
  const body = apartmentV4ArticleOnly(raw);
  const required = apartmentV4Scenes(count).slice(1).map(scene => scene.slot);
  const found = Array.from(body.matchAll(/\[이미지\s*(0[1-7])(?:\s*[·:\-][^\]]*)?\]/gi), item => item[1]);
  const missing = required.filter(slot => !found.includes(slot));
  const repeated = required.filter(slot => found.filter(id => id===slot).length > 1);
  const unexpected = found.filter(slot => !required.includes(slot));
  const outOfOrder = found.some((slot,index) => index>0 && Number(found[index-1]) > Number(slot));
  return { missing, repeated, unexpected, outOfOrder, hasBody: body.length >= 100, found };
}

export function apartmentV4Snapshot(input) {
  const rows = Array.isArray(input.monthly) ? input.monthly.slice(-6) : [];
  const verifiedRows = rows.filter(row => typeof row.medianPrice === "number" && Number.isFinite(row.medianPrice) && row.medianPrice > 0 && Number(row.tradeCount)>0);
  return {
    name: String(input.name || "").trim(), region: String(input.region || "").trim(),
    area: String(input.area || "").trim(), recentPrice:String(input.recentPrice||"").trim(),
    previousPrice:String(input.previousPrice||"").trim(), households:String(input.households||"").trim(),
    moveIn:String(input.moveIn||"").trim(),station:String(input.station||"").trim(),
    locationLine:String(input.locationLine||"").trim(),
    verifiedSeries: !input.matchingPending && verifiedRows.length>0,
    monthly: rows.map(row=>({
      month:String(row.month||"").slice(0,12),
      medianPrice:typeof row.medianPrice === "number"&&Number.isFinite(row.medianPrice)&&row.medianPrice>0?row.medianPrice:null,
      tradeCount:Math.max(0,Math.round(Number(row.tradeCount)||0)),
    })),
  };
}

export function buildApartmentV4ArticlePrompt(input, count = 7) {
  const data = apartmentV4Snapshot(input);
  const scenes = apartmentV4Scenes(count);
  const plans = scenes.map(scene=>`- ${scene.slot} ${scene.name}: ${scene.hint} · ${scene.type === "photo"?"사용권 확보 사진 또는 정확한 출처가 있는 이미지":"검증 데이터·설명 이미지"}`).join("\n");
  return `집값쓱 아파트 네이버 블로그 글을 **V5 뉴스형 발견 스토리 + 검증 데이터**로 작성해줘. 이 요청서는 콘텐츠 메이커에 고정된 마스터 규칙이야.

[단지·원본 정보]
단지명: ${data.name || "미확인"}
지역: ${data.region || "미확인"}
대표 전용면적: ${data.area || "미확인"}
최근 실거래 비교 표시: ${data.recentPrice || "미확인"}
이전 실거래 비교 표시: ${data.previousPrice || "미확인"}
세대수: ${data.households || "미확인"} / 입주: ${data.moveIn || "미확인"}
주요 역: ${data.station || "미확인"} / 입지 메모: ${data.locationLine || "미확인"}
단지 동일성·원본 월별 실거래 연결: ${data.verifiedSeries?"사이트에서 유효 거래 월이 확인됨. 외부 원문으로 추가 대조 필요":"확인되지 않음. 가격 증감·거래량 숫자나 그래프를 단정하지 말 것"}
[동일 면적 기준 월별 데이터 — 가격 원 단위]
${data.monthly.length?data.monthly.map(row=>`${row.month}: ${row.medianPrice==null?"대표 가격 없음":row.medianPrice+"원"} / ${row.tradeCount}건`).join("\n"):"월별 원본 데이터 없음"}

[집값쓱 고정 마스터 V5 — 제목·본문·썸네일 공통]
- 가장 중요한 목표: 네이버 홈판에서 클릭하고, 첫 3~5줄에 몰입하고, 본문 중간마다 검증된 새로운 발견 2~3개를 확인하도록 한다. 평범한 아파트 안내문이 아니라 실거래 숫자·생활정보에서 찾은 뉴스형 이야기로 쓴다.
- 제목 후보 5개를 먼저 만들고, 가장 강하면서 사실에 맞는 1개를 추천한다. 지역명·단지명을 앞에 배치하고, 실제 금액·가격 차이·거래량을 근거로 호기심을 만든다. 큰따옴표 대사는 가상 인터뷰·실제 인물 발언으로 오해되게 하지 않는다.
- 도입부 첫 3~5줄은 한마디·의외의 실제 숫자·독자가 궁금해할 질문으로 시작한다. '안녕하세요', 세대수 장황한 나열, 억지로 답을 끝까지 숨기는 전개는 금지한다.
- 본문은 핵심 POINT→간결한 목차→실거래(계약일·전용면적·층수·가격)→실제 비교에서 드러난 차이→거래량·월별 중앙값→단지 기본정보와 구조→생활킥→Q&A 3개→숫자 중심 마무리→근거 출처→해시태그 10개를 기본 순서로 하되, 흥미로운 실제 발견을 앞당길 수 있다.
- 월 대표값은 검증된 같은 기준의 월 실거래 중앙값(개별 거래가 아님)으로 표현하고 거래 건수를 병기한다. 매매/전세/월세/호가, 계약일/신고일, 공급/전용면적, 취소 거래를 섞지 않는다. 같은 평형의 차이 원인을 확인 없이 꾸며내지 않는다.
- 모든 정보는 공공·공식·신뢰할 수 있는 최신 자료로 검증하고 근거 URL과 확인 기준일을 기록한다. 현재 수집값만으로 개별 거래일·층수·주변 단지·도보 시간을 알 수 없다면 확인 필요로 명시하고 입력 자료를 요청한다. 미확인 개발 호재는 확정처럼 쓰지 않는다.
- 생활킥은 지도·공공 자료 등으로 확인된 지하철, 직장, 상업시설, 학교, 공원 등의 구체적 한 가지를 소개한다. 노선·도보시간·거리·학군·실거주 후기를 지어내지 않는다.
- 불필요한 훈계와 문구 금지: '거래가 많다고 좋은 집은 아닙니다', '투자는 신중히', '종합적으로 고려해야', '가격은 다양한 요인', '호가와 실거래는 다릅니다' 같은 상투적 결론 대신 실제 데이터가 말하는 발견만 제시한다. 자료 한계가 분석에 중요한 경우에만 사실 그대로 표기한다.
- 네이버 편집 권장 크기: 제목 32 / 소제목 30 / 본문 15 / 핵심 강조문 19. 짧고 자연스러운 문장, 15~20자 안팎의 읽기 쉬운 수동 줄바꿈, 문단마다 빈 줄 한 줄, 질문형 소제목, 과도한 반복 금지. 중요한 고유명사·숫자·단위를 임의로 분리하지 않는다.
- 대표 썸네일과 모든 본문 카드의 제작 규격은 **1600×900px(16:9)**로 통일한다. 특히 대표 썸네일은 건물/배경을 과감히 확대하여 화면 밖으로 크롭해도 좋지만, 문구·금액·단지명은 중앙 정사각 안전영역(X=350~1250, Y=0~900) 안쪽에 여유 있게 배치한다. 작은 모바일 화면에서 단번에 읽히는 질문 1개와 핵심 숫자 1개를 우선하고, 네온·과한 3D·복잡한 장식 금지. 정사각형 자동 잘림에 대해 모든 노출 위치의 안전을 보증하지는 않는다.
- 실제 단지 사진이 없으면 특정 단지 외관을 AI가 가짜 실사진처럼 만들지 않는다. 배경 상징 이미지와 원본 사진 사용을 분리하고, 원본 필요 시 요청한다. 외부 사진·지도 사용권 확인.
- 각 본문 이미지는 새롭고 서로 다른 사실 한 가지씩만 보여준다. 00은 클릭 유도, 01 이후는 본문 각 이미지 전후의 발견이 이어지게 설계한다.

[V4 작성 원칙]
- 총 이미지 ${scenes.length}장(썸네일 00 + 본문 ${scenes.length-1}장). 사진과 짧은 2~3줄 설명을 번갈아 배치.
- 모바일 가독성: 각 장면은 독립된 소제목 → [이미지 NN] 독립된 줄 → 핵심 설명 1~3개의 짧은 문장 순서로 구성할 것.
- [모바일 수동 줄바꿈 · 최우선] 일반 본문은 한 줄에 한글 약 15~20자(공백 포함) 안팎을 목표로 하고, 화면 자동 줄바꿈에 맡기지 말 것. 의미 단위로 미리 엔터를 넣어 1~2줄을 한 문단으로 묶고 문단 사이 실제 빈 줄 하나를 둘 것.
- 긴 문장은 먼저 짧고 친근한 문장으로 다시 쓰고, 단어·조사만 따로 떨어지는 기계적인 줄 자르기는 금지한다. 소제목·표·데이터 원문·이미지 마커에는 이 길이 목표를 강제하지 않는다.
- 단지명·가격·숫자와 단위는 중간 분리하지 말 것. 긴 단지명은 별도 줄로 놓고 설명을 다음 줄에 적는다. 정확한 수치와 자연스러운 의미 흐름이 줄 길이 목표보다 우선한다. 가운데 정렬은 네이버 편집기에서 운영자가 직접 적용한다.
- 제시된 데이터가 실제 계약인지·같은 전용면적인지·계약일과 층이 확인됐는지 검증. 확인 안 된 거래일·층·가격·인근 시세는 **미확인**으로 표시.
- 월별 대표가격은 개별 실거래와 다름을 필요할 때만 명확히 표시하며, 거래 없음·진행 중인 월·적은 표본은 실제 비교 해석에 영향이 있을 때만 짧게 알린다.
- **실제 단지 사진을 이미 확보한 것처럼 말하지 않는다.** 사진 검색이 필요하면 구체적 검색 대상과 권리 확인 항목만 안내.
- 사진은 01 단지 외관과 06 생활권을 우선하고, 이미지 02~05는 데이터 그래프·거래 표·비교·핵심 발견 등 정보 밀도 우선.
- 주변 단지 실거래, 학교 배정, 역세권 도보시간, 정비 계획 등은 독립적으로 확인한 공식 근거가 없으면 숫자를 만들지 않는다.
- 실거래 수치·평형·비교 기간의 기준을 섞지 않는다. 가격 상승·하락 원인을 단정하거나 시세차익을 확정적으로 표현하지 않는다.
- 글은 사진마다 한 가지 핵심 메시지. 각 이미지는 독립적으로 새 사실을 보여주고 긴 글 덩어리를 피한다.
- 이미지 글씨로 숫자를 만드는 대신, 확인된 숫자만 본문과 이미지 메모에 제시.
- 제목 32, 소제목 30, 본문 15, 강조 19를 고려한 네이버 글. 문단마다 실제 빈 줄 한 줄. 마지막에 중복 없는 검색용 해시태그 10개를 별도로 작성한다.
- 공백만 있는 줄, &#x20;·&nbsp; 같은 HTML 공백 엔티티, 줄바꿈용 역슬래시 및 네이버 편집기 UI 문구('image', '사진 삭제', 'AI 활용 설정')는 원고에 넣지 않는다.

[장면 순서 · 정확히 준수]
${plans}
- 00은 별도 대표 썸네일. 본문에는 01부터 ${scenes[scenes.length-1].slot}까지 [이미지 NN] 표시를 각각 정확히 한 번, 오름차순으로 넣는다.
- 장면의 근거가 부족하면 해당 슬롯은 '자료 미확인·추가 조사 필요'를 명시한 정보 카드로 기획. 실제 자료가 있는 척하지 않는다.
- 표나 그래프에 없는 숫자를 AI 이미지에서 새로 만들지 않는다.

[출력 순서]
1. 제목 후보 5개(최종 추천 1개 포함)
2. 네이버 발행용 최종 원고: 강한 3~5줄 도입→핵심 POINT→목차→새로운 실거래/가격/거래량 발견→기본정보/구조→생활킥→Q&A 3개→숫자 중심 마무리
3. 실제 근거 출처·분석 기준일·검색용 해시태그 10개
4. [이미지 기획 메모] 00 대표 썸네일·본문 이미지별 독립 요청서, 정확한 수치·사진/정보카드 구분·원본 필요 항목·자료 출처
5. [검수 메모] 확정·추정·미확인 분리, 근거 URL과 수치 확인 상황

최신 웹 근거를 확인할 수 없으면 추정치를 사실처럼 쓰지 말고 부족한 자료를 밝힌 후 글을 작성해줘.`;
}

export function buildApartmentV4ImagePrompt(input, slot, count=7, body="") {
  const data=apartmentV4Snapshot(input);
  const scene=apartmentV4Scenes(count).find(item=>item.slot===slot);
  if(!scene) return "";
  const related=apartmentV4ArticleOnly(body).slice(0,3600);
  return `네이버 아파트 블로그 이미지 **1장만** 제작해줘.

[단지] ${data.region} ${data.name} · 대표 전용면적 ${data.area||"미확인"}
[장면 ${scene.slot}] ${scene.name}
[역할] ${scene.hint}
[크기] ${scene.width}×${scene.height}px
[자료 상태] ${data.verifiedSeries?"실거래 연결 확인. 제공된 월별 값만 인용":"실거래 연결 미확인: 가격·날짜·층수 수치 임의 생성 금지"}
[월별 자료]
${data.monthly.map(row=>`${row.month}: ${row.medianPrice==null?"미확인":row.medianPrice+"원"} / ${row.tradeCount}건`).join("\n")||"없음"}
[최종 원고 참고]
${related||"원고 미작성. 장면만 기획하되 구체적인 수치를 지어내지 말 것."}

${scene.type==="photo"
 ? "- 실제 단지·학교·상가의 사진이 필요하면 사용권이 확인된 실사진을 등록할 것. AI가 가상의 건물 외관을 특정 실제 단지라고 주장하는 이미지 금지. 정보 설명용 제작이라면 반드시 '예시·설명 이미지'임을 구분."
 : "- 데이터 장면은 검증 원본만 차트·표·정보 카드로 표현하고, 월별 가격이나 개별 실거래를 혼동하지 말 것."}
- 비교 데이터가 없다면 가격 차이를 그리지 말고 '공식 자료 추가 확인 필요'로 표시.
- 지도 타일·포털 로고·타인의 사진을 무단 복제하지 말 것.
- 사진·비교·실거래 정보가 뒤섞인 콜라주 금지. 네온·유리 질감·과한 3D 금지.
- 00은 질문형 썸네일, 01~07은 본문 장면. 해당 슬롯의 핵심 메시지 한 가지에 집중.
${scene.slot==="00"
 ? "- [00 대표 썸네일 고정] 출력은 1600×900px 가로형. 건물·배경 피사체만 클로즈업해 과감히 가장자리에서 자른다. 메인 문구는 짧은 질문, 실제 핵심 수치 하나는 아주 크게. 가로형의 중앙 900×900px(X=350~1250) 안전영역 내부에 모든 글자와 숫자를 넣고 추가 안쪽 여백을 둔다. 실제 단지 사진을 받지 않았다면 일반 도시 상징 이미지로만 표현하고 실제 건물로 주장하지 않는다."
 : "- [본문 이미지 고정] 출력 1600×900px 16:9. 이 장면에서 검증된 새로운 숫자·사진·생활 사실 한 가지만 선명하게 전달."}
- 이미지를 만들고 나서 장황한 텍스트 설명을 붙이지 말 것.`;
}
