"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Facility = "상업시설" | "산업단지·공장" | "업무지구·기업" | "병원·대학교" | "기타";
type Travel = "도보" | "대중교통" | "자동차";
type HomeType = "전체" | "매매" | "전세" | "월세";
type Draft = {
  facility: Facility;
  place: string;
  city: string;
  entrance: string;
  travel: Travel;
  travelTarget: string;
  homeType: HomeType;
  budget: string;
  candidateNames: string;
  sourceNotes: string;
  checkedAt: string;
  checkedTrade: boolean;
  checkedListing: boolean;
  checkedRoute: boolean;
};
const KEY = "jibssuk-workplace-comparison-draft-v1";
const DEFAULTS: Draft = {
  facility: "상업시설", place: "스타필드 수원", city: "수원시 장안구",
  entrance: "근무지 실제 출입구(확인 필요)", travel: "도보", travelTarget: "20분 이내",
  homeType: "전체", budget: "", candidateNames: "", sourceNotes: "",
  checkedAt: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
  checkedTrade: false, checkedListing: false, checkedRoute: false,
};

function normalized(v: string, fallback: string) { return v.trim() || fallback; }
function lines(v: string) { return v.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 10); }
function placeTitle(d: Draft) { return normalized(d.place, "근무지") + " 주변 아파트"; }
function buildResearch(d: Draft) {
  const names = lines(d.candidateNames);
  return [
    "[집값쓱 직주근접 아파트 조사 요청서]",
    "오늘 날짜/검증 기준: " + normalized(d.checkedAt, "조사 당일 날짜를 확인"),
    "목적: " + placeTitle(d) + " 중 실제 출퇴근과 주거비를 비교할 수 있는 생활권 안내 글을 준비한다.",
    "근무지 유형: " + d.facility,
    "근무지 이름: " + normalized(d.place, "확인 필요"),
    "지역 힌트: " + normalized(d.city, "확인 필요"),
    "기준 출입구: " + normalized(d.entrance, "실제 출입구 확인 필요"),
    "출퇴근 수단/희망 범위: " + d.travel + " / " + normalized(d.travelTarget, "범위 미설정"),
    "주택 거래 유형: " + d.homeType,
    "예산: " + normalized(d.budget, "미설정(임의로 가정 금지)"),
    "후보 단지: " + (names.length ? names.join(", ") : "주변 아파트 후보 3~5곳을 실제 위치 확인 후 추천"),
    "",
    "필수 조사:",
    "1. 근무지의 정확한 주소와 실제 출입구를 먼저 확인한다. 도로 경계나 직선거리만으로 접근성을 판단하지 않는다.",
    "2. 아파트 후보의 정확한 단지명·주소·준공연도·전용면적을 대조한다. 동명이인 단지와 면적 혼합을 금지한다.",
    "3. 국토교통부 실거래가 공개시스템에서 같은 단지·같은 전용면적의 거래일·층·금액·해제 표시를 확인하고, 매매/전월세 계약 자료를 구분한다.",
    "4. 네이버부동산 등 현재 공개 매물의 호가는 실거래가와 별개로 확인하며, 조사일·거래 유형·보증금·월세·중복 가능성을 표시한다. 매물이 없는 경우 없음/확인 불가를 구분한다.",
    "5. 네이버지도 또는 다른 경로 안내에서 근무지의 실제 출입구↔아파트 출입구를 기준으로 " + d.travel + " 경로를 검증한다. 자동차는 시간대/교통상황, 대중교통은 배차·환승을 구분한다.",
    "6. 근거 링크와 확인일을 항목별로 붙인다. 웹에서 확인할 수 없는 값은 절대 추정하거나 숫자를 만들어내지 말고 '확인 필요(needs_check)'로 표시한다.",
    "7. 장점뿐 아니라 야간 출퇴근, 횡단보도, 정체, 주차, 경사, 출입구 위치 등 실제 입주 전에 확인해야 할 항목을 적는다.",
    "",
    "결과 형식: ① 독자 검색의도·대표 키워드 ② 후보 단지 3~5개 표(단지명/위치/전용면적/실거래가/매물 호가/" + d.travel + "거리·시간/자료 기준일/출처/검증 상태) ③ 데이터 부족 항목 ④ 검색형 제목 3개 ⑤ 독자에게 줄 실용적인 발견 1개.",
    "주의: 실제 검증 자료 없이 예시 가격·거리·분수를 발명하지 마라. 상승·하락 원인이나 출퇴근 편의성을 단정하지 마라.",
  ].join("\n");
}
function buildArticle(d: Draft) {
  return [
    "[집값쓱 직주근접 아파트 최종 원고 요청서]",
    "주제: " + placeTitle(d) + ", 출퇴근과 집값을 함께 비교해 보자",
    "대상: " + d.facility + "에서 근무하거나 이사하려는 사람, 인근 주민",
    "지역: " + normalized(d.city, "확인 필요"),
    "이동 기준: " + d.travel + " / " + normalized(d.travelTarget, "별도 확인"),
    "거래 유형: " + d.homeType + " / 예산 " + normalized(d.budget, "미설정"),
    "후보 단지: " + (lines(d.candidateNames).join(", ") || "검증한 자료에 나온 단지만"),
    "검증 기준일: " + normalized(d.checkedAt, "작성일"),
    "",
    "[검증된 원자료 및 출처 — 입력자가 직접 확인한 내용]",
    normalized(d.sourceNotes, "입력된 사실 자료 없음. 숫자·매물·이동시간을 만들지 말고 확인 필요로 남긴다."),
    "",
    "글 작성 조건:",
    "- 검색 유입 키워드를 자연스럽게 포함하고 독자의 의문에 답하는 제목을 1개 고른다.",
    "- 도입에서 '근무지에 가까운 아파트를 선택할 때 가격과 이동 동선을 동시에 살펴보자'는 질문을 제시한다.",
    "- 첫 핵심 비교표에는 확인된 실거래가(계약일/전용면적/층/해제 여부), 현재 매물 호가(확인일), " + d.travel + " 이동 경로(출입구 기준)만 싣는다.",
    "- 매매 실거래, 전월세 실거래, 현재 매물 가격은 서로 다르다는 점을 명확히 표시한다.",
    "- 주소·거리·시간·금액·건수·교통편을 임의로 보간하거나 상상하지 않는다. 증빙 없는 필드는 '확인 필요'로 둔다.",
    "- '추천 1위' 같은 투자 권유 대신 조건별 장단점과 실거주 체크사항을 공정하게 설명한다.",
    "- 네이버 모바일 기준 짧은 1~2행 문장, 문단 사이 충분한 여백, 친근하면서 과장하지 않는 말투로 작성한다.",
    "- 목차에 ① 위치·이동 ② 아파트·가격 ③ 생활 체크 ④ 자주 묻는 질문을 포함한다.",
    "- 이미지 순서 00 대표 썸네일(1254×1254), 01 실제 생활권 지도, 02 단지 비교, 03 실거래와 매물 호가 차이, 04 출퇴근 경로, 05 실거주 주의점, 06 최종 3줄 요약(본문 이미지는 1600×900).",
    "- 이미지 요청서를 슬롯별로 생성하고, 확인되지 않은 사진·데이터나 지도상 거리를 새로 만들지 않는다.",
    "- 마지막에 확인일·자료명·출처 링크와 해시태그 7~10개를 붙인다.",
    "- 원고 완료 전에 출처/수치/지도 경로/매물 유효성 검수 체크리스트를 표시한다.",
    "",
    "증빙된 내용이 부족하면 완성된 것처럼 꾸미지 말고 부족한 확인 목록을 먼저 반환한다.",
  ].join("\n");
}
async function copyText(value: string, setNotice: (s: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    setNotice("요청서를 복사했습니다. ChatGPT에 한 번 붙여넣으세요.");
  } catch {
    setNotice("클립보드 복사에 실패했습니다. 아래 요청서 텍스트를 직접 선택해 복사하세요.");
  }
}
export default function WorkplaceApartmentStudio() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"research" | "article">("research");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Draft>;
        setDraft({ ...DEFAULTS, ...parsed });
      }
    } catch { /* Keep the editable defaults if local storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* Storage may be unavailable. */ }
  }, [draft, ready]);
  const update = <K extends keyof Draft,>(key: K, value: Draft[K]) => setDraft(old => ({ ...old, [key]: value }));
  const research = useMemo(() => buildResearch(draft), [draft]);
  const article = useMemo(() => buildArticle(draft), [draft]);
  const articleReady = draft.checkedTrade && draft.checkedListing && draft.checkedRoute && draft.sourceNotes.trim().length > 20;
  const keywords = [
    normalized(draft.place, "근무지") + " 근처 아파트",
    normalized(draft.place, "근무지") + " 출퇴근 아파트",
    normalized(draft.place, "근무지") + " 주변 전세",
    normalized(draft.place, "근무지") + " 아파트 실거래가",
  ];
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <a href="/" className={styles.back}>← 콘텐츠 메이커</a>
        <a href="/apartment-bulk" className={styles.subLink}>기존 아파트 제작실</a>
      </header>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>집값쓱 · 생활권 중심 콘텐츠</div>
        <h1>직장 가까운 아파트,<br />가격과 출퇴근을 한 번에 비교</h1>
        <p>스타필드·산업단지·업무지구 주변의 실거주 검색형 글을 만듭니다. 자료가 검증되지 않았으면 숫자를 만들지 않습니다.</p>
        <div className={styles.pills}><span>실거래가</span><span>현재 매물</span><span>실제 이동 경로</span><span>전세·월세</span></div>
      </section>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2><span>01</span> 근무지와 독자 조건</h2>
          <div className={styles.two}>
            <label>근무지 유형
              <select value={draft.facility} onChange={e => update("facility", e.target.value as Facility)}>
                {(["상업시설","산업단지·공장","업무지구·기업","병원·대학교","기타"] as Facility[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>근무지 이름
              <input value={draft.place} onChange={e => update("place", e.target.value)} placeholder="예: 스타필드 수원" />
            </label>
            <label>지역
              <input value={draft.city} onChange={e => update("city", e.target.value)} placeholder="시·구·동" />
            </label>
            <label>이동 기준 출입구
              <input value={draft.entrance} onChange={e => update("entrance", e.target.value)} placeholder="직원 출입구 위치를 확인" />
            </label>
            <label>이동 수단
              <select value={draft.travel} onChange={e => update("travel", e.target.value as Travel)}>
                {(["도보","대중교통","자동차"] as Travel[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>허용 이동 범위
              <input value={draft.travelTarget} onChange={e => update("travelTarget", e.target.value)} placeholder="예: 도보 15분 이내" />
            </label>
            <label>비교 거래 유형
              <select value={draft.homeType} onChange={e => update("homeType", e.target.value as HomeType)}>
                {(["전체","매매","전세","월세"] as HomeType[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>예산 (선택)
              <input value={draft.budget} onChange={e => update("budget", e.target.value)} placeholder="예: 전세 3억 원 이하" />
            </label>
          </div>
          <h2><span>02</span> 아파트 후보와 검증 자료</h2>
          <label>아파트 후보 이름 <small>한 줄에 하나씩 · 없으면 조사 요청서가 후보를 찾도록 안내</small>
            <textarea rows={4} value={draft.candidateNames} onChange={e => update("candidateNames",e.target.value)} placeholder={"단지명 1\n단지명 2\n단지명 3"} />
          </label>
          <label>실제 확인한 자료 및 출처 링크 <small>계약일·면적·해제표시·매물 확인일·실제 경로를 함께 기록하세요.</small>
            <textarea rows={7} value={draft.sourceNotes} onChange={e => update("sourceNotes",e.target.value)} placeholder={"[단지명 / 전용면적]\n매매 실거래: 계약일, 층, 금액, 해제 여부, 출처 URL\n현재 매물: 매매·전세·월세 구분, 호가, 확인일, 출처 URL\n이동: 실제 출입구, 교통수단, 거리·시간, 경로 근거 URL"} />
          </label>
          <label>자료 확인일
            <input type="date" value={draft.checkedAt} onChange={e => update("checkedAt",e.target.value)} />
          </label>
          <div className={styles.checks}>
            <strong>원고 작성 전 검증</strong>
            <label><input type="checkbox" checked={draft.checkedTrade} onChange={e=>update("checkedTrade",e.target.checked)}/> 실거래가·면적·계약해제 여부 확인</label>
            <label><input type="checkbox" checked={draft.checkedListing} onChange={e=>update("checkedListing",e.target.checked)}/> 현재 매물과 실거래가 구분·날짜 확인</label>
            <label><input type="checkbox" checked={draft.checkedRoute} onChange={e=>update("checkedRoute",e.target.checked)}/> 근무지·아파트 출입구 기준 실제 이동 경로 확인</label>
            <p>확인할 수 없는 항목은 가짜 숫자를 넣지 말고 '확인 필요'로 남겨 두세요.</p>
          </div>
        </section>
        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2>독자 검색어 미리보기</h2>
            {keywords.map(k => <div key={k} className={styles.keyword}>{k}</div>)}
            <p className={styles.hint}>키워드는 검색량이 확인된 결과가 아니라 실제 검색 의도를 고려한 제안입니다.</p>
          </section>
          <section className={styles.panel}>
            <h2>기본 자료 확인처</h2>
            <a href="https://rt.molit.go.kr/" target="_blank" rel="noopener noreferrer">국토교통부 실거래가 공개시스템 ↗</a>
            <a href="https://new.land.naver.com/" target="_blank" rel="noopener noreferrer">네이버부동산 ↗</a>
            <a href="https://map.naver.com/" target="_blank" rel="noopener noreferrer">네이버지도 ↗</a>
            <p className={styles.hint}>현재 시세나 거리·시간을 자동 수집하는 기능은 아닙니다. 원문 확인과 출처 입력 후 GPT 요청서를 사용하세요.</p>
          </section>
          <section className={styles.panel}>
            <h2>권장 이미지 흐름</h2>
            <p>00 썸네일 → 01 생활권 위치 → 02 단지 비교 → 03 실거래·호가 → 04 출퇴근 → 05 주의점 → 06 요약</p>
            <p className={styles.hint}>대표 1254×1254 / 본문 1600×900. 거리·가격을 그림에서 임의 생성하지 않습니다.</p>
          </section>
        </aside>
      </div>
      <section className={styles.output}>
        <div className={styles.outputHead}>
          <div><h2>03 · ChatGPT에 붙여넣을 요청서</h2><p>먼저 조사하고, 확인한 자료를 붙인 뒤 발행 원고를 만드세요.</p></div>
          <div className={styles.tabRow}>
            <button type="button" className={tab==="research"?styles.active:""} onClick={()=>setTab("research")}>① 자료 조사</button>
            <button type="button" className={tab==="article"?styles.active:""} onClick={()=>setTab("article")}>② 최종 원고</button>
          </div>
        </div>
        {tab==="article" && !articleReady && <div className={styles.warning}>현재 매물·실거래·출퇴근 거리의 근거와 확인 체크가 부족합니다. 원고 요청서는 볼 수 있지만 발행 전 검증을 완료해야 합니다.</div>}
        <textarea className={styles.prompt} readOnly value={tab==="research"?research:article} aria-label="생성한 ChatGPT 요청서" />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={()=>copyText(tab==="research"?research:article,setNotice)}>요청서 한 번에 복사</button>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
          <button type="button" className={styles.secondary} onClick={()=>{
            if(window.confirm("이 작업의 입력값만 초기화할까요? 기존 아파트 제작실 데이터는 변경되지 않습니다.")){
              setDraft({...DEFAULTS,checkedAt:new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})});setNotice("현재 입력값만 초기화했습니다.");
            }
          }}>입력값 초기화</button>
        </div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <p className={styles.hint}>현재 입력 내용은 이 브라우저에 자동 저장됩니다. 이 페이지는 기존 발행 큐·저장 원고·다른 블로그 도구에 영향을 주지 않습니다.</p>
      </section>
    </main>
  );
}
