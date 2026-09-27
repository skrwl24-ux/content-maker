"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type MegaComplexPreset = {
  id: string;
  name: string;
  region: string;
  households: string;
  moveIn: string;
  scaleNote?: string;
};

const MEGA_COMPLEXES: MegaComplexPreset[] = [
  { id: "olympic-park-foreon", name: "올림픽파크포레온", region: "서울 강동구 둔촌동", households: "12,032세대", moveIn: "2025년", scaleNote: "단일 초대형 단지" },
  { id: "heliocity", name: "헬리오시티", region: "서울 송파구 가락동", households: "9,510세대", moveIn: "2018년", scaleNote: "단일 초대형 단지" },
  { id: "yongin-hansup", name: "e편한세상 용인 한숲시티", region: "경기 용인시 처인구", households: "총 6,800세대", moveIn: "2018년", scaleNote: "1~6단지·연립 포함 합산형" },
  { id: "park-rio", name: "파크리오", region: "서울 송파구 신천동", households: "6,864세대", moveIn: "2008년", scaleNote: "단일 초대형 단지" },
  { id: "dh-firstier", name: "디에이치퍼스티어아이파크", region: "서울 강남구 개포동", households: "6,702세대", moveIn: "2023년", scaleNote: "단일 초대형 단지" },
  { id: "jamsil-els", name: "잠실엘스", region: "서울 송파구 잠실동", households: "5,678세대", moveIn: "2008년", scaleNote: "단일 초대형 단지" },
  { id: "bupyeong-central", name: "더샵부평센트럴시티", region: "인천 부평구 십정동", households: "5,678세대", moveIn: "2022년", scaleNote: "단일 초대형 단지" },
  { id: "ricenz", name: "리센츠", region: "서울 송파구 잠실동", households: "5,563세대", moveIn: "2008년", scaleNote: "단일 초대형 단지" },
  { id: "bupyeong-grandhills", name: "e편한세상부평그랑힐스", region: "인천 부평구 청천동", households: "5,050세대", moveIn: "2023년", scaleNote: "단일 초대형 단지" },
  { id: "godeok-gracium", name: "고덕그라시움", region: "서울 강동구 고덕동", households: "4,932세대", moveIn: "2019년", scaleNote: "단일 초대형 단지" },
];

function researchRules(complex: MegaComplexPreset) {
  return [
    "[검증 규칙]",
    "- 작성 시점의 최신 웹 자료로 세대수·입주년도·최근 매매·전세·거래량을 다시 확인할 것.",
    "- 세대수 기준은 단일 관리단지인지 여러 단지·블록 합산인지 반드시 구분할 것.",
    "- '수도권 세대수 순위'를 단정하려면 동일 기준의 공식 또는 신뢰 가능한 자료로 전체 후보를 다시 검증할 것.",
    "- 동일 기준의 순위 검증이 어려우면 '수도권 대표 초대형단지'라고 표현하고 임의 순위를 만들지 말 것.",
    "- 가격 비교는 비슷한 크기의 32·33·34·35평형을 편의상 '34평대'로 묶어 볼 수 있다.",
    "- 단지마다 실제 표기 평형은 1~3평 차이 날 수 있다는 안내는 한 번만 넣고 이후에는 '34평대'로 통일할 것.",
    "- 최근 실거래는 계약일·실제 면적을 내부적으로 확인하고, 최근 한 건을 단지 전체 현재가로 단정하지 말 것.",
    "- 월별 흐름을 설명할 때 거래가 없는 달을 임의 보간하지 말 것.",
    "- 진행 중인 최신 월 거래량은 '현재까지'라고 표시할 것.",
    "- 과장·투자 권유·가격 상승 확정 표현은 금지할 것.",
  ].join("\n");
}

function bodyPrompt(complex: MegaComplexPreset) {
  return [
    "네이버 블로그용 수도권 초대형 아파트 단지 분석글을 최종 발행본으로 작성해줘.",
    "",
    "[단지]",
    "단지명: " + complex.name,
    "지역: " + complex.region,
    "세대수 참고값: " + complex.households,
    "입주년도 참고값: " + complex.moveIn,
    "규모 기준 메모: " + (complex.scaleNote || "확인 필요"),
    "",
    researchRules(complex),
    "",
    "[글의 핵심 방향]",
    "- '이렇게 큰 단지는 실제 집값과 거래가 어떻게 움직일까?'라는 궁금증을 중심으로 쓸 것.",
    "- 초대형단지라는 숫자 자체를 후킹으로 활용하되 세대수가 많다는 이유만으로 좋다고 단정하지 말 것.",
    "- 최근 34평대 매매·전세, 최근 6개월 가격 흐름, 거래량, 역·생활권, 초대형단지의 장단점을 함께 다룰 것.",
    "- 세대수가 많아서 생기는 생활 인프라·커뮤니티·관리·동간 거리·역까지 거리 편차 등 실제 거주 관점도 넣을 것.",
    "",
    "[추천 구조]",
    "1. 세대수 숫자로 시작하는 강한 도입",
    "2. 34평대 최근 매매·전세",
    "3. 최근 6개월 가격·거래량 흐름",
    "4. 단지 규모가 실제 생활에 주는 장점과 불편",
    "5. 역·상권·학교·공원 등 생활권",
    "6. 최근 거래에서 체크할 포인트",
    "7. 3줄 요약",
    "",
    "[34평대 안내]",
    "※ 단지마다 전용·공급면적 구조가 달라 실제 표기 평형은 32~35평 정도 차이가 있을 수 있습니다. 이번 글에서는 비슷한 크기의 대표 평형을 편의상 '34평대'로 묶어 봤습니다.",
    "이 안내는 글 초반에 한 번만 자연스럽게 넣을 것.",
    "",
    "[이미지 위치]",
    "도입 뒤: [이미지 01 — 초대형단지 규모 핵심]",
    "가격 흐름 뒤: [이미지 02 — 34평대 가격·거래 흐름]",
    "입지 설명 뒤: [이미지 03 — 입지·생활권]",
    "",
    "[출력 스타일]",
    "- 한 문장 = 한 문단",
    "- 문장 사이 스페이스바 1칸 간격용 줄 1개",
    "- 제목은 검색형이면서 세대수 숫자 또는 최근 거래 장면을 살릴 것",
    "- 확인되지 않은 원인을 단정하지 말 것",
    "- 최종 제목 1개 + 본문 + 네이버 태그 7개만 출력",
    "- 검색 과정·출처 목록·URL은 최종 글에 넣지 말 것",
    "",
    "네이버 블로그에 바로 붙여넣을 수 있는 최종본만 작성해줘.",
  ].join("\n");
}

function thumbnailPrompt(complex: MegaComplexPreset) {
  return [
    "네이버 블로그용 수도권 초대형 아파트 썸네일 이미지를 1장 만들어줘.",
    "",
    "[단지 정보]",
    "단지명: " + complex.name,
    "지역: " + complex.region,
    "세대수 참고값: " + complex.households,
    "",
    researchRules(complex),
    "",
    "[이미지 역할]",
    "슬롯: 00 · 썸네일",
    "전달할 내용: 초대형단지의 압도적인 세대수와 최근 34평대 가격이 궁금해지게 한다.",
    "",
    "[제작 목표]",
    "정확한 크기 1254×1254px",
    "1:1 정사각형",
    "",
    "[화면 구성]",
    "- 단지명과 세대수를 가장 크게",
    "- 최신 웹 확인 후 34평대 최근 가격에서 강한 숫자가 있으면 보조 숫자 1개만 사용",
    "- 대규모 아파트 동들이 넓게 펼쳐진 느낌을 자연스럽게 표현",
    "- 모바일 중앙 안전영역 안에 핵심 문구 배치",
    "",
    "[스타일]",
    "- 사람 편집형 부동산 카드뉴스",
    "- 색상 2~3개",
    "- 과한 3D·네온·유리질감 금지",
    "- 라벨번호 금지",
  ].join("\n");
}

function scalePrompt(complex: MegaComplexPreset) {
  return [
    "네이버 블로그 본문용 초대형 아파트 규모 인포그래픽 이미지를 1장 만들어줘.",
    "",
    "[단지]",
    complex.name + " · " + complex.region + " · " + complex.households,
    "",
    researchRules(complex),
    "",
    "[이미지 역할]",
    "슬롯: 01 · 본문 이미지 01",
    "역할: 단지 규모 핵심",
    "",
    "[제작 목표]",
    "1600×900px · 16:9",
    "",
    "[쉬운 제목]",
    complex.name + ", 얼마나 큰 단지일까?",
    "",
    "[구성]",
    "- 세대수를 가장 큰 숫자로 표시",
    "- 최신 확인된 동수·주차대수·입주년도 중 신뢰할 수 있는 2~3개 정보만 보조 카드로 표시",
    "- 가능하면 '1만 세대급 / 5천 세대급'처럼 규모가 직관적으로 느껴지는 비교를 넣되, 정확한 비교대상 수치는 반드시 검증",
    "- 합산형 단지라면 여러 블록·단지 합산임을 분명하게 표시",
    "",
    "[스타일]",
    "- 교육용 인포그래픽처럼 간결하게",
    "- 숫자 중심, 장식 최소화",
    "- 라벨번호 금지",
  ].join("\n");
}

function pricePrompt(complex: MegaComplexPreset) {
  return [
    "네이버 블로그 본문용 아파트 가격·거래 흐름 인포그래픽 이미지를 1장 만들어줘.",
    "",
    "[단지]",
    complex.name + " · " + complex.region,
    "",
    researchRules(complex),
    "",
    "[이미지 역할]",
    "슬롯: 02 · 본문 이미지 02",
    "역할: 34평대 최근 가격·거래 흐름",
    "",
    "[제작 목표]",
    "1600×900px · 16:9",
    "",
    "[구성]",
    "- 32~35평형을 '34평대'로 묶어 최신 거래를 확인",
    "- 최근 6개월 월별 대표가격과 거래건수를 가능하면 함께 표시",
    "- 거래 없는 월은 선을 임의로 보간하지 말고 실제 데이터 유무를 정확히 반영",
    "- 최신 월이 진행 중이면 거래건수에 '현재까지' 표시",
    "- 개별 최근 실거래와 월 대표값을 섞지 말 것",
    "",
    "[스타일]",
    "- 가격선 + 거래건수 또는 간결한 카드 조합",
    "- 모바일에서 숫자와 월이 읽히게",
    "- 과장색 금지",
    "- 라벨번호 금지",
  ].join("\n");
}

function locationPrompt(complex: MegaComplexPreset) {
  return [
    "네이버 블로그 본문용 초대형 아파트 입지·생활권 인포그래픽 이미지를 1장 만들어줘.",
    "",
    "[단지]",
    complex.name + " · " + complex.region,
    "",
    researchRules(complex),
    "",
    "[이미지 역할]",
    "슬롯: 03 · 본문 이미지 03",
    "역할: 입지·생활권",
    "",
    "[제작 목표]",
    "1600×900px · 16:9",
    "",
    "[구성]",
    "- 최신 웹 검색으로 가장 가까운 주요 역, 상권, 학교, 공원 또는 생활시설을 확인",
    "- 초대형단지는 동 위치에 따라 역까지 체감거리가 달라질 수 있다는 점을 반영",
    "- 단지 전체와 주요 역·생활권의 상대적 위치가 한눈에 보이게",
    "- 실제 지도 서비스 타일·로고·UI를 복제하지 말고 새 인포그래픽으로 재구성",
    "",
    "[스타일]",
    "- 깔끔한 부동산 입지 인포그래픽",
    "- 도로·위치점 단순화",
    "- 모바일 가독성 우선",
    "- 라벨번호 금지",
  ].join("\n");
}

function makeNextMegaBatchPrompt() {
  const current = MEGA_COMPLEXES.map((item) => item.name).join(", ");
  return [
    "현재 수도권 초대형 아파트 단지 시리즈 10개를 모두 작성했습니다.",
    "",
    "[이미 작성한 단지 — 반드시 제외]",
    current,
    "",
    "이 목록과 겹치지 않게 다음에 발행할 수도권 대규모·초대형 아파트 단지 10곳을 새로 추천해줘.",
    "",
    "[선정 기준]",
    "- 최신 웹 검색으로 세대수·입주년도·단지 구성을 확인할 것.",
    "- 세대수, 검색 관심도, 최근 거래 이슈, 입지, 신축·재건축·재개발 등 콘텐츠성이 있는 단지를 우선할 것.",
    "- 단일 관리단지와 여러 블록·단지 합산형을 반드시 구분할 것.",
    "- 이미 작성한 단지는 제외하고 서울·경기·인천을 적절히 섞을 것.",
    "- 가능하면 3,000세대 이상을 우선하되, 규모는 조금 작아도 콘텐츠성이 강하면 포함할 수 있다.",
    "",
    "[각 항목에 포함]",
    "발행순서 / 단지명 / 지역 / 세대수 / 입주년도 / 단일단지·합산형 여부 / 콘텐츠 포인트 / 예상 제목",
    "",
    "1번부터 10번까지 실제 다음 발행 순서로 정리해줘.",
  ].join("\n");
}

function openChat(prompt: string) {
  window.open("https://chatgpt.com/?q=" + encodeURIComponent(prompt), "_blank", "noopener,noreferrer");
}

export default function MegaComplexWorkspace() {
  const [selectedId, setSelectedId] = useState(MEGA_COMPLEXES[0].id);
  const [copied, setCopied] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const complex = useMemo(
    () => MEGA_COMPLEXES.find((item) => item.id === selectedId) || MEGA_COMPLEXES[0],
    [selectedId]
  );
  const prompts = useMemo(() => ({
    thumbnail: thumbnailPrompt(complex),
    scale: scalePrompt(complex),
    price: pricePrompt(complex),
    location: locationPrompt(complex),
    body: bodyPrompt(complex),
  }), [complex]);
  const doneCount = completedIds.filter((id) => MEGA_COMPLEXES.some((item) => item.id === id)).length;

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("apartment-mega-series-done-v1") || "null");
      if (Array.isArray(saved)) setCompletedIds(saved.filter((item): item is string => typeof item === "string"));
    } catch {
      setCompletedIds([]);
    }
  }, []);

  function toggleDone(id: string) {
    setCompletedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try { window.localStorage.setItem("apartment-mega-series-done-v1", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function copyAllImages() {
    const text = [
      "===== 00 썸네일 =====", prompts.thumbnail, "",
      "===== 01 단지 규모 =====", prompts.scale, "",
      "===== 02 가격·거래 흐름 =====", prompts.price, "",
      "===== 03 입지·생활권 =====", prompts.location,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
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
          <p className={styles.eyebrow}>METRO MEGA COMPLEX SERIES</p>
          <h2>수도권 초대형단지 <strong>{doneCount}/10</strong></h2>
          <span>단일 관리단지와 합산형을 구분하고, 실제 글에서는 최신 세대수와 34평대 거래를 다시 확인합니다.</span>
        </div>
        <div className={styles.dailyBoardActions}>
          <div className={styles.dailyProgressText}>{doneCount === 10 ? "🎉 1차 10개 완료" : "완료한 글은 체크해 두세요"}</div>
          <button type="button" disabled={doneCount < 10} onClick={() => openChat(makeNextMegaBatchPrompt())}>
            다음 10개 추천받기
          </button>
        </div>
      </div>

      <div className={styles.dailyProgressTrack} aria-label={`초대형단지 시리즈 진행률 ${doneCount}/10`}>
        <span style={{ width: `${doneCount * 10}%` }} />
      </div>

      <div className={styles.dailySlots}>
        {MEGA_COMPLEXES.map((item, index) => {
          const done = completedIds.includes(item.id);
          return (
            <article key={item.id} className={done ? styles.dailySlotDone : styles.dailySlot}>
              <div className={styles.dailySlotNumber}>{done ? "✓" : index + 1}</div>
              <div className={styles.dailySlotMain}>
                <b>{item.name}</b>
                <small>{item.households} · {item.region}</small>
                <code className={styles.dailyWorkId}>{item.scaleNote || "초대형단지"}</code>
              </div>
              <div className={styles.dailySlotActions}>
                <button
                  type="button"
                  className={selectedId === item.id ? styles.dailyActiveWork : styles.dailyStart}
                  onClick={() => setSelectedId(item.id)}
                >
                  {selectedId === item.id ? "선택됨" : "선택"}
                </button>
                <button type="button" className={done ? styles.dailyUndo : styles.dailyComplete} onClick={() => toggleDone(item.id)}>
                  {done ? "완료 취소" : "완료"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.dailyRule}>
        세대수는 후보 선정을 위한 참고값입니다. TOP 순위 콘텐츠는 동일한 기준으로 다시 검증합니다.
      </div>

      <section className={styles.actionPanel}>
        <div className={styles.actionHead}>
          <p className={styles.eyebrow}>SELECTED · {complex.name}</p>
          <h2>{complex.households} 초대형단지 · 34평대 가격과 실제 생활은?</h2>
          <span>본문과 이미지 요청서 모두 최신 웹 확인 규칙이 포함되어 있습니다.</span>
        </div>

        <div className={styles.actionGrid}>
          <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.body)}>
            <span className={styles.actionIcon}>📝</span>
            <b>본문 만들기</b>
            <small>최신 실거래·전세·거래량까지 확인</small>
          </button>
          <button type="button" className={styles.actionButton} onClick={() => void copyAllImages()}>
            <span className={styles.actionIcon}>🖼️</span>
            <b>{copied ? "✓ 이미지 요청서 복사됨" : "이미지 4장 요청서 전체복사"}</b>
            <small>00 썸네일 + 01 규모 + 02 가격 + 03 입지</small>
          </button>
        </div>

        <details className={styles.advancedDetails}>
          <summary>이미지 4장 개별 챗 열기</summary>
          <div className={styles.advancedBody}>
            <div className={styles.actionGrid}>
              <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.thumbnail)}><b>00. 썸네일</b><small>1254×1254</small></button>
              <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.scale)}><b>01. 단지 규모</b><small>1600×900</small></button>
              <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.price)}><b>02. 가격·거래</b><small>1600×900</small></button>
              <button type="button" className={styles.actionButton} onClick={() => openChat(prompts.location)}><b>03. 입지·생활권</b><small>1600×900</small></button>
            </div>
          </div>
        </details>
      </section>
    </section>
  );
}
