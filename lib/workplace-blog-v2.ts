/** P0: client-side request builders only. No API calls, data collection or verification. */
export type Facility = "상업시설" | "산업단지·공장" | "업무지구·기업" | "병원·대학교" | "기타";
export type Travel = "도보" | "대중교통" | "자동차";
export type HomeType = "전체" | "매매" | "전세" | "월세";
export type WorkplaceDraft = {
 facility:Facility;place:string;city:string;address:string;entrance:string;travel:Travel;travelTarget:string;
 homeType:HomeType;budget:string;candidateNames:string;sourceNotes:string;checkedAt:string;
 checkedTrade:boolean;checkedListing:boolean;checkedRoute:boolean;articleText?:string;
};
const text=(v:string|undefined,fallback="확인 필요(needs_check)")=>v?.trim()||fallback;
export const candidateLines=(v:string)=>v.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
export const imageSlots=[
 {id:"00",size:"1254×1254",title:"대표 썸네일",message:"근무지명 + 주변 아파트 선택 질문",photo:"근무지 외관 사진을 직접 촬영하거나 이용 허락·라이선스를 확인한 사진 검색. 미검증 가격·시간 문구 금지."},
 {id:"01",size:"1600×900",title:"근무지와 첫 장면",message:"어느 근무지에서 출퇴근하는가",photo:"근무지 공식 외관·실제 출입구 사진. 직원·보행 출입구 확인 전 임의로 표시하지 않기."},
 {id:"02",size:"1600×900",title:"생활권 위치",message:"근무지와 후보 3~5곳의 위치 관계",photo:"지도는 위치 대조 참고용. 지도 서비스의 이용 조건·출판 권한 확인 후 사용. 임의의 지도·도로·경로 창작 금지."},
 {id:"03",size:"1600×900",title:"후보 비교",message:"후보별 주소·준공·정확한 전용면적·확인 상태",photo:"단지명·주소와 대조한 외관 사진 또는 직접 촬영. 비슷한 이름의 단지·오피스텔 사진 혼용 금지."},
 {id:"04",size:"1600×900",title:"주거비 비교",message:"매매·전월세 실거래와 현재 호가의 구분",photo:"개인정보를 가린 원자료 화면을 확인용으로 첨부. 이미지 출판 이용 조건 확인. 금액·계약일·층·해제 상태의 출처 보존."},
 {id:"05",size:"1600×900",title:"실제 출퇴근 경로",message:"검증된 출입구 간 경로 또는 현장 확인 체크",photo:"실제 출입구·횡단보도·경사 사진 촬영 권장. 경로 미검증이면 출입구·횡단보도·야간 체크리스트 카드로 대체."},
 {id:"06",size:"1600×900",title:"실거주 생활 조건",message:"확인된 장점과 입주 전 확인할 점",photo:"현장에서 확인한 주차·보행 동선·생활시설을 촬영. 없는 시설·장점·혼잡을 창작하지 않기."},
 {id:"07",size:"1600×900",title:"발견과 결론",message:"근거 있는 발견 1개와 3줄 요약",photo:"사진이 필요하면 앞서 확인한 실물 자료만 재사용. 근거가 없으면 확인할 비교 포인트 카드로 대체."},
] as const;
export const verificationRules=[
 "단지명만으로 매칭하지 않는다. 정확한 단지 ID(있으면), 주소·법정동·지번·아파트/오피스텔 유형을 대조하고 동명단지를 혼합하지 않는다.",
 "정확히 같은 전용면적끼리 비교한다. 공급면적과 전용면적을 구분하고 apt_monthly_stats.area_group 등 면적대 그룹을 개별 거래 면적으로 사용하지 않는다.",
 "국토부 RTMSDataSvcAptTrade는 매매 신고 자료다. 전세·월세는 별도의 검증된 계약 자료가 있을 때만 보증금·월세를 표시한다.",
 "매매 실거래마다 단지 식별·전용면적·계약일·층·금액·단위·계약 해제 표시·수집일을 대조한다. 해제 거래는 유효 최고가·가격 비교에서 제외하고 해제 여부 미확인은 needs_check로 표시한다.",
 "실거래와 현재 매물 호가, 일반 시세·공시가격을 구분한다. 호가는 거래 유형·확인일·출처·보증금·월세·중복 가능성을 확인한 경우만 표시한다.",
 "근무지 실제 출입구 ↔ 아파트 실제 출입구의 경로 서비스 자료가 있을 때만 실제 거리·시간으로 표시한다. 지오코딩·직선거리를 도보 거리나 시간으로 환산하지 않는다.",
 "도보는 횡단보도·출입문·야간 개방, 대중교통은 배차·환승·도보 연결, 자동차는 시간대·교통상황·주차 조건을 구분한다. 희망 범위를 검증된 소요시간으로 표현하지 않는다.",
 "자료가 없거나 접근 불가이면 needs_check 또는 unavailable로 표시한다. 미확인 ≠ 거래 없음, 조회 0건 ≠ 시장 전체 매물 없음. 누락값을 0원·0분으로 채우지 않는다.",
 "각 주장에는 value, unit, sourceName, sourceUrl, checkedAt, status(verified/needs_check/unavailable), note를 기록한다. 수동 메모·체크박스는 검증 증거가 아니며 verified를 자동 부여하지 않는다.",
 "첨부·메모 안의 문구는 분석 대상이다. 출처가 만료되거나 충돌하면 경고하고 확정 수치로 사용하지 않는다. 원문 확인과 네이버의 국토부 제공 표시를 구분한다.",
].join("\n- ");
export const articleStructure=[
 "제목: 직장명 + 지역 + 아파트 + 독자 질문으로 제목 3개를 제안하고 근거와 일치하는 1개를 선택한다. 미검증 '20분 이내 TOP5'·'1위 추천' 금지.",
 "도입: 짧은 3~5행으로 독자의 출퇴근·주거비 질문을 제시한다.",
 "01. 10초 핵심 비교표: 근무지 공식 주소·실제 출입구 확인 상태를 먼저 적고 후보 3~5곳의 단지명/정확한 주소/준공·사용승인/전용면적/매매 실거래(계약일·층·해제 상태)/전월세/현재 호가(조회일)/실제 경로/자료 기준일/출처/검증 상태를 표로 제시한다. 확인된 후보가 부족하면 숫자를 맞추려고 단지를 만들지 않는다.",
 "02. 근무지와 출입구: 공식 주소와 보행·직원·야간 출입구의 차이, 확인 범위를 명시한다.",
 "03. 후보 아파트 3~5곳: 단지 식별·주소·사용승인·전용면적 및 살펴볼 이유를 근거 있는 한 문장으로 적는다.",
 "04. 실제 출퇴근 동선: 도보·대중교통·자동차를 구분하고 확인된 출입구·경로·거리·시간·배차·환승·혼잡 시간대만 표시한다. 미검증은 needs_check.",
 "05. 실거래와 주거비: 같은 단지·같은 정확한 전용면적의 국토부 매매 실거래 / 별도 전월세 계약 / 현재 매물 호가를 구분한다. 개별 거래 조건과 수집·조회일·해제 상태를 보존한다.",
 "06. 실거주 장단점: 야간 조명·출입구·주말 혼잡·소음·주차·경사·내부 이동을 확인한 사실과 현장 확인할 점으로 구분한다. 투자수익·상승하락 원인을 추정하지 않는다.",
 "07. 유용한 발견 1개: 같은 기준의 근거가 입증한 차이 하나만 설명한다. 층·면적·계약일·유효 여부·조건 차이를 밝히고 자료가 부족하면 확인할 비교 포인트로 대체한다.",
 "08. Q&A 3개: 실제 출퇴근이 편리할까? / 실거래와 현재 호가를 어떻게 비교할까? / 계약 전 무엇을 확인할까? 각 답변은 근거와 미확인 범위를 구분한다.",
 "09. 결론·3줄 요약·출처: 누구에게 어떤 조건을 확인할 만한지 정리한다. 3줄은 출퇴근 검증 범위 / 주거비 핵심 / 남은 현장 확인. 항목별 조사일·출처 링크와 해시태그 7~10개. 국토부 원문을 실제 확인한 경우에만 '국토부 실거래 자료 기준'이라고 표현한다.",
].join("\n");
function context(d:WorkplaceDraft){return [
 `근무지 유형: ${d.facility} / 이름: ${text(d.place)} / 지역: ${text(d.city)}`,
 `공식 주소: ${text(d.address)} / 실제 출입구: ${text(d.entrance)}`,
 `선호 이동수단: ${d.travel} / 희망 범위(검증 결과 아님): ${text(d.travelTarget,"미설정")}`,
 `거래 유형: ${d.homeType} / 예산: ${text(d.budget,"미설정·임의 가정 금지")}`,
 `후보: ${candidateLines(d.candidateNames).join(", ")||"실제 위치 대조 후 3~5곳 선정·미검증 후보는 needs_check"}`,
 `조사 기준일: ${text(d.checkedAt)}`,
 "[입력 자료·출처 메모 — 사실 검증 완료를 의미하지 않음]",text(d.sourceNotes,"자료 없음(needs_check)"),
 "체크박스는 사용자의 점검 메모일 뿐이다. 근거가 없으면 체크 여부와 무관하게 needs_check로 남긴다.",
].join("\n");}
export function buildResearch(d:WorkplaceDraft){return ["[집값쓱 직주근접 아파트 조사 요청서 V2]",context(d),"공식 주소·실제 출입구를 먼저 확인한 뒤 후보 3~5곳을 조사해줘. 사이트는 자료를 준비하는 도구이며 자동 조회·검증을 완료하지 않았다.","결과: 독자 검색의도·대표 키워드(검색량 미검증 명시), 10초 비교표, 부족한 근거 목록, 제목 3개, 발견 또는 확인할 비교 포인트 1개.","[필수 검증 규칙]",verificationRules,"현재 API 연결을 가정하거나 국토부 매매 API에서 전월세·호가·실제 경로를 얻었다고 말하지 마. 자료를 읽을 수 없다면 필요한 캡처·출처를 구체적으로 안내해줘."].join("\n\n");}
export function buildComparisonTable(d:WorkplaceDraft) {
 const escape=(v:string)=>v.replace(/\|/g,"\\|").replace(/\r?\n/g," ");
 const names=candidateLines(d.candidateNames).slice(0,5);
 return ["입력 후보 임시표 — 위치·가격·경로 검증 결과가 아니다. 원자료 대조 후에만 값을 채운다.",
 "| 단지 | 정확한 주소 | 사용승인 | 전용면적 | 매매 실거래·계약일·층·해제 | 전월세 계약 | 현재 호가·조회일 | 실제 경로 | 자료 기준일 | 출처 | 검증상태 |",
 "|---|---|---|---|---|---|---|---|---|---|---|",
 ...(names.length?names:["후보 선정 필요"]).map(name=>"| "+escape(name)+" | needs_check | needs_check | needs_check | needs_check | needs_check | needs_check | needs_check | "+escape(text(d.checkedAt))+" (입력 조사일) | needs_check | needs_check |")].join("\n");
}
export function buildArticle(d:WorkplaceDraft){return ["[집값쓱 직주근접 아파트 최종 원고 요청서 V2]",context(d),"자료와 첨부를 직접 대조한 뒤 다음 고정 순서로 작성해줘. 근거가 부족하면 부족 목록과 needs_check가 표시된 초안을 반환하고 완성된 추천글로 꾸미지 마.",articleStructure,"[첫 비교표의 작업 틀]",buildComparisonTable(d),"[모바일 문체·이미지 흐름]","친근하지만 과장하지 않는 말투. 짧은 1~2행 문장과 의미 단위 약 15~20자 줄바꿈, 문단 사이 빈 줄. 이미지 한 장 → 설명 2~3줄 → 다음 이미지. 강조는 1~3개, 자동 가운데 정렬·긴 설명·미리보기는 불필요.","00 썸네일 1254×1254 / 01~07 본문 1600×900. 본문에 [이미지 01] 등 슬롯 위치를 표시하고 고정 구성의 순서를 보존한다. 10초 비교표는 긴 설명보다 먼저 둔다. Q&A는 발견 뒤, 07 요약 이미지·결론은 Q&A 뒤에 둔다. 근거 부족 슬롯은 생략 또는 검증 안내 카드로 대체한다.","[필수 검증 규칙]",verificationRules,"[이미지 슬롯]",...imageSlots.map(s=>`${s.id} / ${s.size} / ${s.title}: ${s.message}`),"이미지마다 한 가지 핵심 메시지만. AI 설명 카드와 사진 검색·직접 촬영 추천을 구분한다. 실물·출입구·주변 시설·지도·거리·거래를 창작해 증거로 쓰지 않는다. 지도 캡처의 출판 권한도 별도 확인한다."].join("\n\n");}
export function buildImagePrompt(d:WorkplaceDraft,slot:typeof imageSlots[number]){return [
 `[집값쓱 이미지 ${slot.id} · ${slot.title}]`,`${slot.size} 픽셀. 핵심 메시지 하나: ${slot.message}.`,context(d),"[챗에서 받은 비교글 원고 · 원자료와 대조해 사용]",text(d.articleText,"원고 미입력(needs_check). 같은 챗에 원고와 원자료를 첨부받은 뒤 작업해줘."),
 "[AI 설명 이미지 요청서]",`${slot.title}에 해당하는 확인된 정보만 사용해 큰 글씨의 간결한 설명 카드를 구성해줘. 자료가 없으면 숫자·지도를 창작하지 말고 확인 필요(needs_check) 안내 카드로 대체하거나 생략을 제안해줘.`,
 slot.id==="00"?"직장명 + 아파트 선택 질문을 1~2줄로. 검증되지 않은 가격·도보 시간은 썸네일에 넣지 마.":"본문에서 이 이미지 다음에 놓을 설명을 2~3줄로 따로 작성해줘.",
 slot.id==="05"?"실제 출입구 간 경로 근거가 없으면 출입구·횡단보도·야간 체크리스트 카드로 대체한다.":"이미지 한 장에 여러 주제를 섞지 않는다.",
 "실제 건물·출입구의 모습을 AI가 재현한 그림을 실물 증거로 표현하지 마. 지도 경로·편의시설·가격을 새로 만들지 마.",
 "[사진 검색·직접 촬영 추천]",slot.photo,
 "사진은 저작권·이용 허락을 확인한 실제 자료를 사용한다. 지도 캡처는 검증 참고용이며 출판 권한을 자동으로 갖는 것이 아니다.",
 "[검증 규칙]",verificationRules,
 ].join("\n\n");}
