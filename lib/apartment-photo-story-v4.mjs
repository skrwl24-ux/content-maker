/**
 * Apartment V4 is an editorial layer. It must never synthesize actual
 * contracts, property photos, prices or transport times from general language.
 */
export const APARTMENT_V4_SCENES = Object.freeze([
  {slot:"00",name:"대표 썸네일",type:"design",hint:"단지명·대표 면적·검증된 핵심 변화 1개",width:1254,height:1254},
  {slot:"01",name:"실제 단지 외관",type:"photo",hint:"정확한 단지명이 확인된 사용권 확보 사진",width:1600,height:900},
  {slot:"02",name:"최근 6개월 실거래 흐름",type:"data",hint:"동일 전용면적의 월별 가격과 거래 건수",width:1600,height:900},
  {slot:"03",name:"최근 거래 비교",type:"data",hint:"검증된 거래일·층·면적·가격만 비교",width:1600,height:900},
  {slot:"04",name:"주변 단지 비교",type:"data",hint:"확인된 인근 단지와 동일 면적 기준으로 비교",width:1600,height:900},
  {slot:"05",name:"이 글의 핵심 발견",type:"data",hint:"가격을 해석할 때 놓치기 쉬운 판단 기준 한 가지",width:1600,height:900},
  {slot:"06",name:"교통·학군·생활권",type:"photo",hint:"출처 확인된 생활권 사진 또는 위치 설명 도식",width:1600,height:900},
  {slot:"07",name:"한계·확인할 점",type:"data",hint:"거래 표본·계약 취소·월 진행 중 여부 등 주의점",width:1600,height:900},
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
  return `집값쓱 네이버 아파트 단지 분석 글을 **V4 실제 사진 + 검증된 데이터** 스토리형으로 작성해줘.

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

[V4 작성 원칙]
- 총 이미지 ${scenes.length}장(썸네일 00 + 본문 ${scenes.length-1}장). 사진과 짧은 2~3줄 설명을 번갈아 배치.
- 모바일 가독성: 각 장면은 독립된 소제목 → [이미지 NN] 독립된 줄 → 핵심 설명 1~3개의 짧은 문장 순서로 구성할 것. 한 문단에는 한 가지 사실만 담고 문단 사이 빈 줄 하나를 둘 것.
- 단지명·가격·숫자와 단위를 줄 길이에 맞춰 억지로 중간 분리하지 말고, 문장 자체를 짧게 만들어 모바일 화면에서 자연스럽게 접히게 할 것.
- 제시된 데이터가 실제 계약인지·같은 전용면적인지·계약일과 층이 확인됐는지 검증. 확인 안 된 거래일·층·가격·인근 시세는 **미확인**으로 표시.
- 월별 대표가격은 개별 실거래와 다름을 밝히고, 거래 없음·진행 중인 월과 적은 표본의 한계를 설명.
- **실제 단지 사진을 이미 확보한 것처럼 말하지 않는다.** 사진 검색이 필요하면 구체적 검색 대상과 권리 확인 항목만 안내.
- 사진은 01 단지 외관과 06 생활권을 우선하고, 이미지 02~05는 데이터 그래프·거래 표·비교·핵심 발견 등 정보 밀도 우선.
- 주변 단지 실거래, 학교 배정, 역세권 도보시간, 정비 계획 등은 독립적으로 확인한 공식 근거가 없으면 숫자를 만들지 않는다.
- 실거래 수치·평형·비교 기간의 기준을 섞지 않는다. 가격 상승·하락 원인을 단정하거나 시세차익을 확정적으로 표현하지 않는다.
- 글은 사진마다 한 가지 핵심 메시지. 각 이미지는 독립적으로 새 사실을 보여주고 긴 글 덩어리를 피한다.
- 이미지 글씨로 숫자를 만드는 대신, 확인된 숫자만 본문과 이미지 메모에 제시.
- 제목 32, 소제목 30, 본문 15, 강조 19를 고려한 네이버 글. 문단마다 실제 빈 줄 한 줄. 해시태그는 넣지 않는다.
- 공백만 있는 줄, &#x20;·&nbsp; 같은 HTML 공백 엔티티, 줄바꿈용 역슬래시 및 네이버 편집기 UI 문구('image', '사진 삭제', 'AI 활용 설정')는 원고에 넣지 않는다.

[장면 순서 · 정확히 준수]
${plans}
- 00은 별도 대표 썸네일. 본문에는 01부터 ${scenes[scenes.length-1].slot}까지 [이미지 NN] 표시를 각각 정확히 한 번, 오름차순으로 넣는다.
- 장면의 근거가 부족하면 해당 슬롯은 '자료 미확인·추가 조사 필요'를 명시한 정보 카드로 기획. 실제 자료가 있는 척하지 않는다.
- 표나 그래프에 없는 숫자를 AI 이미지에서 새로 만들지 않는다.

[출력 순서]
1. 검색형 제목 1줄과 질문형 도입
2. 이미지 01부터 각 장면별 [이미지 NN]와 짧은 설명 2~3줄, 필요할 때만 추가 세부 문단
3. 한눈에 보는 사실과 확인할 점
4. [이미지 기획 메모] 이미지별 사진/데이터 역할·필요한 원본·자료 출처
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
- 이미지를 만들고 나서 장황한 텍스트 설명을 붙이지 말 것.`;
}
