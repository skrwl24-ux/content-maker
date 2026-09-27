"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type SchoolDistrictPreset = {
  id: string;
  label: string;
  region: string;
  academyAnchor: string;
  note: string;
  done?: boolean;
};

const SCHOOL_DISTRICTS: SchoolDistrictPreset[] = [
  { id: "daechi", label: "대치", region: "서울 강남구 대치·도곡 생활권", academyAnchor: "대치동 학원가·은마사거리", note: "1차 · 대치 학군", done: true },
  { id: "mokdong", label: "목동", region: "서울 양천구 목동·신정동 생활권", academyAnchor: "목동 학원가", note: "2차 · 다음 추천" },
  { id: "banpo", label: "반포·잠원", region: "서울 서초구 반포·잠원 생활권", academyAnchor: "반포·잠원 학원가와 서초 교육 생활권", note: "3차" },
  { id: "junggye", label: "중계", region: "서울 노원구 중계동 생활권", academyAnchor: "은행사거리 학원가", note: "4차" },
  { id: "bundang", label: "분당", region: "경기 성남시 분당구 수내·정자 생활권", academyAnchor: "수내·정자 학원가", note: "5차" },
  { id: "pyeongchon", label: "평촌", region: "경기 안양시 동안구 평촌·귀인 생활권", academyAnchor: "평촌 학원가", note: "6차" },
  { id: "songpa", label: "송파·잠실", region: "서울 송파구 잠실·가락 생활권", academyAnchor: "잠실 학원가와 송파 교육 생활권", note: "7차" },
  { id: "ilsan", label: "일산", region: "경기 고양시 일산서구·일산동구", academyAnchor: "후곡·백마 학원가", note: "8차" },
];

function schoolTitle(district: SchoolDistrictPreset) {
  return district.label + " 학군 들어가려면 얼마 필요할까? 34평대 대표 아파트 5곳 비교";
}

function commonResearchRules(district: SchoolDistrictPreset) {
  return [
    "[공통 검증 규칙]",
    "- 작성·제작 시점의 최신 자료를 웹 검색으로 먼저 확인할 것.",
    "- 해당 학군에서 실제로 자주 비교되는 대표 아파트 가운데 비슷한 크기의 32·33·34·35평형 거래를 확인할 수 있는 단지를 우선해 5곳을 선정할 것.",
    "- 이번 콘텐츠에서 '34평대'는 비교 편의를 위해 32~35평형을 한 그룹으로 묶어 부르는 표현이다.",
    "- 단지마다 전용면적·공급면적 구조가 다르므로 세부 면적을 억지로 완전히 같게 맞추지 말 것.",
    "- 글 또는 이미지의 첫 안내에만 '단지마다 실제 표기 평형은 32~35평 정도 차이가 있을 수 있으며, 비슷한 크기의 대표 평형을 34평대로 묶어 비교했다'는 취지를 짧게 알릴 것.",
    "- 이후에는 복잡한 면적 설명을 반복하지 말고 '34평대'로 통일해 표현할 것.",
    "- 매매와 전세는 각 단지에서 확인 가능한 최근 실제 계약을 우선하고, 계약일·실제 전용면적을 내부적으로 검증할 것.",
    "- 전세는 신규·갱신 여부가 확인되면 구분하고, 갱신계약 한 건을 신규 전세 시세처럼 단정하지 말 것.",
    "- 최근 거래 날짜가 단지마다 다르면 현재 가격 순위라고 단정하지 말고 '최근 확인 거래'라고 표현할 것.",
    "- 학원가 접근성은 " + district.academyAnchor + "을 중심으로 확인하되, 정확한 도보 시간이 확인되지 않으면 임의 숫자를 만들지 말 것.",
    "- 특정 아파트 거주가 특정 중학교 배정을 보장한다고 표현하지 말 것.",
    "- 과장·매수 권유·투자 확정 표현은 사용하지 말 것.",
  ].join("\n");
}

function makeSchoolBodyPrompt(district: SchoolDistrictPreset) {
  return [
    "네이버 블로그용 학군 아파트 비교글을 최종 발행본으로 작성해줘.",
    "",
    "[글 제목]",
    schoolTitle(district),
    "",
    "[지역]",
    district.region,
    "",
    "[학원가 기준]",
    district.academyAnchor,
    "",
    commonResearchRules(district),
    "",
    "[대표 단지 5곳 선정]",
    "- 최신 웹 자료를 확인해 이 학군에서 실제로 많이 비교되는 대표 아파트 5곳을 선정할 것.",
    "- 학원가 접근성, 단지 인지도, 세대수, 주거환경, 32~35평형 비교 가능 여부를 함께 고려할 것.",
    "- 행정동이 조금 달라도 같은 학원가 생활권으로 실제 함께 비교되는 단지는 포함할 수 있으며 그 사실을 짧게 밝힐 것.",
    "",
    "[반드시 넣을 내용]",
    "1. 도입: '이 학군에 34평대 아파트로 들어가려면 실제 얼마가 필요한가?'라는 질문으로 시작",
    "2. 5개 단지 한눈에 비교: 단지명 / 최근 34평대 매매 / 최근 34평대 전세 / 학원가 접근 특징",
    "3. 같은 학군인데 최근 매매가가 얼마나 차이 나는지 금액 차이를 계산",
    "4. 단지별 설명: 최근 매매·전세 + 학원가 접근성 + 단지 성격",
    "5. 전세로 들어갈 때 체크할 점: 신규·갱신, 구축 수리상태 등",
    "6. 학원가 접근성 비교: 아이가 실제로 다닐 동선을 중심으로 설명",
    "7. 마지막 정리: 가격만이 아니라 학원가 거리·주거환경·대단지 여부·정비사업 기대 등을 함께 봐야 한다는 내용",
    "",
    "[34평대 안내문]",
    "도입 초반에 아래 취지의 문장을 한 번만 자연스럽게 넣어줘.",
    "※ 단지마다 전용·공급면적 구조가 달라 실제 표기 평형은 32~35평 정도 차이가 있을 수 있습니다. 이번 글에서는 비슷한 크기의 대표 평형을 편의상 '34평대'로 묶어 비교했습니다.",
    "",
    "[이미지 위치]",
    "가격 비교 설명 뒤: [이미지 01 — 34평대 매매·전세 비교]",
    "학원가 접근 설명 뒤: [이미지 02 — 학원가 접근 비교]",
    "마무리 정리 뒤: [이미지 03 — 핵심 정리]",
    "",
    "[출력 스타일]",
    "- 제목 → 본문 → 이미지 위치 → 태그 순서",
    "- 한 문장 = 한 문단",
    "- 문장 사이 스페이스바 1칸이 들어간 간격용 줄 1개",
    "- 모바일에서 쉽게 읽히도록 짧은 문장",
    "- 숫자를 반복해서 늘어놓지 말고 독자가 궁금해할 비교 포인트를 중심으로 설명",
    "- 제목 1개, 최종 본문, 네이버 태그 7개만 출력",
    "- 검색 과정·출처 목록·URL은 최종 발행본문에 넣지 말 것",
    "",
    "복사해서 네이버 블로그에 바로 붙여넣을 수 있는 최종본만 작성해줘.",
  ].join("\n");
}

function makeSchoolThumbnailPrompt(district: SchoolDistrictPreset) {
  return [
    "네이버 블로그용 아파트·학군 썸네일 이미지를 1장 만들어줘.",
    "",
    "[글 정보]",
    "주제: " + schoolTitle(district),
    "지역: " + district.region,
    "",
    commonResearchRules(district),
    "",
    "[이미지 역할]",
    "슬롯: 00 · 썸네일",
    "역할: 대표 썸네일",
    "전달할 내용: " + district.label + " 학군에 34평대 아파트로 들어가려면 실제 얼마가 필요한지 궁금증을 강하게 유발한다.",
    "",
    "[제작 목표]",
    "정확한 크기: 1254×1254px",
    "비율: 1:1 정사각형",
    "",
    "[정확한 메인 문구]",
    district.label + " 학군",
    "얼마 필요할까?",
    "",
    "[보조 문구]",
    "34평대 5곳 비교",
    "",
    "[화면 구성]",
    "- " + district.label + "을 떠올릴 수 있는 아파트·교육 생활권 분위기를 자연스럽게 표현",
    "- 최신 5개 단지의 최근 매매가격 범위를 웹에서 확실히 확인했다면 핵심 숫자 1개만 크게 표시",
    "- 최신 가격 범위를 확실히 검증하지 못했다면 숫자를 임의로 넣지 말 것",
    "- 아파트 + 숫자 + 질문형 문구 중심의 간결한 카드형 구성",
    "",
    "[스타일]",
    "- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게",
    "- 색상 2~3개, 과한 네온·유리질감·3D 금지",
    "- 모바일에서 메인 문구가 즉시 읽히게",
    "- 라벨번호를 이미지에 넣지 말 것",
    "- 핵심 문구는 중앙 안전영역에 배치",
  ].join("\n");
}

function makeSchoolPricePrompt(district: SchoolDistrictPreset) {
  return [
    "네이버 블로그 본문용 아파트 가격 비교 인포그래픽 이미지를 1장 만들어줘.",
    "",
    "[글 정보]",
    "주제: " + schoolTitle(district),
    "",
    commonResearchRules(district),
    "",
    "[이미지 역할]",
    "슬롯: 01 · 본문 이미지 01",
    "역할: 핵심 가격 비교",
    "",
    "[제작 목표]",
    "정확한 크기: 1600×900px",
    "비율: 16:9 가로형",
    "",
    "[쉬운 제목]",
    district.label + " 학군 34평대, 가격은 얼마나 차이 날까?",
    "",
    "[화면 구성]",
    "- 최신 웹 검색으로 선정한 대표 아파트 5곳을 한 장에서 비교",
    "- 각 카드에는 단지명 / 최근 34평대 매매 / 최근 34평대 전세만 크게 표시",
    "- 최근 거래일이 서로 다르면 '최근 확인 거래'임을 작은 문구로 안내",
    "- 전세가 갱신계약이면 갱신 표시 또는 오해가 없도록 주석 처리",
    "- 가장 비싼 단지와 낮은 단지의 최근 매매 가격 차이가 확인되면 하단에 한 줄 요약",
    "",
    "[하단 안내]",
    "※ 실제 표기 평형은 단지별로 32~35평 정도 차이가 있을 수 있으며, 비슷한 크기의 대표 평형을 '34평대'로 묶어 비교.",
    "",
    "[스타일]",
    "- 5개 카드형 또는 깔끔한 가로 비교표",
    "- 숫자가 가장 눈에 띄게",
    "- 모바일 가독성 우선",
    "- 과장색·과한 3D·불필요한 장식 금지",
    "- 라벨번호를 이미지에 넣지 말 것",
  ].join("\n");
}

function makeSchoolAcademyPrompt(district: SchoolDistrictPreset) {
  return [
    "네이버 블로그 본문용 학원가 접근 비교 인포그래픽 이미지를 1장 만들어줘.",
    "",
    "[글 정보]",
    "주제: " + schoolTitle(district),
    "학원가 기준점: " + district.academyAnchor,
    "",
    commonResearchRules(district),
    "",
    "[이미지 역할]",
    "슬롯: 02 · 본문 이미지 02",
    "역할: 입지·학원가 접근 비교",
    "",
    "[제작 목표]",
    "정확한 크기: 1600×900px",
    "비율: 16:9 가로형",
    "",
    "[쉬운 제목]",
    "학원가 가까운 단지는 어디일까?",
    "",
    "[화면 구성]",
    "- 중앙에 " + district.academyAnchor + "을 상징하는 기준점을 둔다.",
    "- 웹에서 선정·검증한 대표 아파트 5곳을 주변에 카드 또는 위치점으로 배치한다.",
    "- 정확한 도보 시간이 신뢰할 만한 자료에서 확인되면 시간으로 표시한다.",
    "- 정확한 시간이 불확실하면 '초근접 / 도보권 / 이동 필요'처럼 과장 없는 정성 표현을 사용한다.",
    "- 실제 지도 서비스의 타일·로고·폰트·UI를 복제하지 말고 단순화한 부동산 입지 인포그래픽으로 새로 구성한다.",
    "",
    "[핵심 문구]",
    "같은 " + district.label + " 학군이라도 실제 학원 동선은 단지마다 다릅니다.",
    "",
    "[스타일]",
    "- 사람 편집형 교육·부동산 인포그래픽",
    "- 도로선과 위치점은 단순하게",
    "- 모바일에서도 단지명과 접근성이 읽히게",
    "- 라벨번호를 이미지에 넣지 말 것",
  ].join("\n");
}

function makeSchoolSummaryPrompt(district: SchoolDistrictPreset) {
  return [
    "네이버 블로그 본문용 학군 아파트 핵심 정리 인포그래픽 이미지를 1장 만들어줘.",
    "",
    "[글 정보]",
    "주제: " + schoolTitle(district),
    "",
    commonResearchRules(district),
    "",
    "[이미지 역할]",
    "슬롯: 03 · 본문 이미지 03",
    "역할: 핵심 정리",
    "",
    "[제작 목표]",
    "정확한 크기: 1600×900px",
    "비율: 16:9 가로형",
    "",
    "[쉬운 제목]",
    district.label + " 학군 아파트, 이렇게 보면 쉬워집니다",
    "",
    "[화면 구성]",
    "- 대표 아파트 5곳을 카드로 정리한다.",
    "- 각 단지는 '가격대 / 학원가 접근 / 단지의 가장 큰 특징'을 한 줄씩만 표시한다.",
    "- 상단에는 검증된 최근 34평대 매매가격 범위를 한 줄로 요약한다.",
    "- 하단에는 매매가 / 전세가 / 학원가 거리 / 주거환경 4개 체크포인트를 넣는다.",
    "",
    "[핵심 메시지]",
    "가격만 보지 말고 아이의 실제 학원 동선과 주거환경을 함께 비교하세요.",
    "",
    "[스타일]",
    "- 깔끔한 체크리스트·카드형 인포그래픽",
    "- 교육용 정보 이미지처럼 신뢰감 있게",
    "- 숫자와 핵심 단어 위주",
    "- 과장색·네온·유리질감·불필요한 3D 금지",
    "- 라벨번호를 이미지에 넣지 말 것",
  ].join("\n");
}

function makeSchoolPrompts(district: SchoolDistrictPreset) {
  return {
    thumbnail: makeSchoolThumbnailPrompt(district),
    price: makeSchoolPricePrompt(district),
    academy: makeSchoolAcademyPrompt(district),
    summary: makeSchoolSummaryPrompt(district),
    body: makeSchoolBodyPrompt(district),
  };
}

function openChat(prompt: string) {
  window.open("https://chatgpt.com/?q=" + encodeURIComponent(prompt), "_blank", "noopener,noreferrer");
}

export default function SchoolDistrictWorkspace() {
  const [selectedId, setSelectedId] = useState("mokdong");
  const [copied, setCopied] = useState(false);
  const district = useMemo(
    () => SCHOOL_DISTRICTS.find((item) => item.id === selectedId) || SCHOOL_DISTRICTS[1],
    [selectedId]
  );
  const prompts = useMemo(() => makeSchoolPrompts(district), [district]);

  async function copyAllImagePrompts() {
    const all = [
      "===== 00 썸네일 =====",
      prompts.thumbnail,
      "",
      "===== 01 가격 비교 =====",
      prompts.price,
      "",
      "===== 02 학원가 접근 =====",
      prompts.academy,
      "",
      "===== 03 핵심 정리 =====",
      prompts.summary,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(all);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={styles.dailyBoard}>
      <div className={styles.dailyBoardHead}>
        <div>
          <p className={styles.eyebrow}>SCHOOL DISTRICT SERIES</p>
          <h2>학군 아파트 시리즈 · <strong>대치 다음부터 순서대로</strong></h2>
          <span>32~35평형은 비교 편의를 위해 모두 ‘34평대’로 묶고, 가격·전세·학원가 동선을 중심으로 만듭니다.</span>
        </div>
      </div>

      <div className={styles.dailySlots}>
        {SCHOOL_DISTRICTS.map((item, index) => (
          <article key={item.id} className={styles.dailySlot}>
            <div className={styles.dailySlotNumber}>{item.done ? "✓" : index + 1}</div>
            <div className={styles.dailySlotMain}>
              <b>{item.label} 학군</b>
              <small>{item.region} · {item.academyAnchor}</small>
              <code className={styles.dailyWorkId}>{item.done ? "대치 글 완료 · 필요하면 다시 생성" : item.note}</code>
            </div>
            <div className={styles.dailySlotActions}>
              <button
                type="button"
                className={selectedId === item.id ? styles.dailyActiveWork : styles.dailyStart}
                onClick={() => setSelectedId(item.id)}
              >
                {selectedId === item.id ? "선택됨" : "선택"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className={styles.actionPanel}>
        <div className={styles.actionHead}>
          <p className={styles.eyebrow}>SELECTED · {district.label}</p>
          <h2>{schoolTitle(district)}</h2>
          <span>각 버튼은 최신 자료 확인 규칙과 34평대 기준이 포함된 요청서를 새 ChatGPT 채팅으로 바로 엽니다.</span>
        </div>

        <div className={styles.actionGrid}>
          <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.thumbnail)}>
            <span className={styles.actionIcon}>🖼️</span>
            <b>00. 썸네일 챗 열기</b>
            <small>1254×1254 · 질문형 썸네일</small>
          </button>

          <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.price)}>
            <span className={styles.actionIcon}>💰</span>
            <b>01. 가격 비교 챗 열기</b>
            <small>1600×900 · 매매·전세 5곳 비교</small>
          </button>

          <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.academy)}>
            <span className={styles.actionIcon}>🎓</span>
            <b>02. 학원가 챗 열기</b>
            <small>1600×900 · 실제 학원 동선 비교</small>
          </button>

          <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.summary)}>
            <span className={styles.actionIcon}>✅</span>
            <b>03. 핵심 정리 챗 열기</b>
            <small>1600×900 · 5개 단지 특징 요약</small>
          </button>

          <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.body)}>
            <span className={styles.actionIcon}>📝</span>
            <b>본문 챗 열기</b>
            <small>최신 웹 확인 · 34평대 매매·전세·학원가</small>
          </button>
        </div>

        <div className={styles.promptActionsCompact}>
          <button type="button" onClick={() => void copyAllImagePrompts()}>
            {copied ? "✓ 이미지 4장 요청서 복사 완료" : "이미지 4장 요청서 전체복사"}
          </button>
        </div>
      </section>
    </section>
  );
}
