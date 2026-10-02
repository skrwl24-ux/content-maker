"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type Region = {
  region_code: string;
  sido_name: string;
  region_name: string;
};

type KaptTarget = {
  id: string;
  kapt_code: string | null;
  name: string;
  address: string | null;
  road_address: string | null;
  households: number | null;
  use_date: string | null;
  region_code: string;
  legal_dong: string | null;
};

type StageResult = {
  staged: boolean;
  sourceCount: number;
  sameParcel: boolean | null;
  targetParcelKnown: boolean;
  sharedSourceParcel: boolean;
  targetConstructionYear: number | null;
  targetName: string;
};

type Candidate = {
  candidate_key: string;
  region_code: string;
  legal_dong: string;
  jibun: string;
  source_apartment_name: string;
  build_year: number | null;
  classification: string;
  same_lot_kapt_count: number;
  year_compatible_kapt_count: number;
  raw_trade_count: number;
  recent_valid_trade_count: number;
  cancelled_trade_count: number;
  latest_contract_date: string | null;
  area_groups: number[];
  analysis_date: string;
  review_status: string;
};

const REASONS = [
  ["", "전체 미연결 사유"],
  ["kapt_lot_not_found", "K-apt 동일 지번 확인 불가"],
  ["multiple_kapt_same_lot", "동일 지번에 여러 단지"],
  ["year_check_failed", "준공연도 검증 불일치"],
  ["unique_lot_unresolved", "동일 지번·연결 미완료"],
] as const;

const REASON_NAME = Object.fromEntries(REASONS);

function verificationPrompt(item: Candidate, regionName: string) {
  return [
    "[국토부 미연결 아파트 단지 식별 조사 · 사실 확인 요청]",
    "아래 항목은 실제 국토부 매매 신고에서 추출했지만 K-apt 단지 식별이 완료되지 않은 자료입니다.",
    "조사 기준: " + item.analysis_date,
    "국토부 원문 단지명: " + item.source_apartment_name,
    "지역: " + regionName + " / " + item.legal_dong,
    "원자료 지번: " + item.jibun,
    "원자료 건축연도: " + (item.build_year ?? "미확인"),
    "원자료 거래 수(전체 수집 범위): " + item.raw_trade_count + "건",
    "분류: " + (REASON_NAME[item.classification] || item.classification),
    "",
    "공식 출처(K-apt, 국토교통부, 건축물대장·지자체 등)와 자료 URL을 검색하여 확인해 주세요.",
    "1. 실제 아파트의 공식 단지명, 법정동·지번, 준공연도가 동일한지 각각 대조할 것.",
    "2. 공동 지번 또는 여러 관리 단지가 있으면 건물·동 범위를 추가로 구분할 것.",
    "3. K-apt 코드와 도로명주소는 공식 근거가 있을 때만 기재할 것.",
    "4. 확실하지 않은 정보는 '미확인'으로 표기하고 추측으로 단지를 연결하지 말 것.",
    "5. 확인된 출처 URL, 출처의 게시/수정일, 서로 불일치하는 항목을 별도로 정리할 것.",
    "6. 이 조사는 신원 확인용이며 실거래 분석·블로그 발행 또는 DB 자동 연결 승인이 아닙니다.",
  ].join("\n");
}

export default function UnmatchedCandidatePage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [region, setRegion] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [reviewItem, setReviewItem] = useState<Candidate | null>(null);
  const [targetQuery, setTargetQuery] = useState("");
  const [targets, setTargets] = useState<KaptTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [targetLoading, setTargetLoading] = useState(false);
  const [auditText, setAuditText] = useState("");
  // This operator secret stays in component memory only, never localStorage.
  const [adminSecret, setAdminSecret] = useState("");
  const [stageResult, setStageResult] = useState<StageResult | null>(null);
  const [approvalResult, setApprovalResult] = useState<{linkedTradeCount:number; targetComplexId:string; snapshot?:{sixMonthCount:number;representativeAreaGroup:number|null}} | null>(null);
  const [confirmedSourceName, setConfirmedSourceName] = useState("");
  const [explicitApproval, setExplicitApproval] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    fetch("/api/apartment/regions", { cache: "no-store" })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "지역 목록 조회 실패");
        return body;
      })
      .then(body => setRegions(body.regions || []))
      .catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (region) params.set("regionCode", region);
    if (reason) params.set("reason", reason);
    if (appliedName) params.set("name", appliedName);
    setLoading(true);
    setError("");
    fetch("/api/apartment/unmatched-candidates?" + params, {
      cache: "no-store", signal: controller.signal,
    })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "검토 후보 조회에 실패했습니다.");
        return body;
      })
      .then(body => {
        if (controller.signal.aborted) return;
        setItems(body.candidates || []);
        setTotal(body.total || 0);
        setPageSize(body.pageSize || 30);
        setLoading(false);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "데이터 조회 오류");
      });
    return () => controller.abort();
  }, [region, reason, appliedName, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedName(search.trim());
    setPage(0);
  }

  function getRegionName(item: Candidate) {
    const found = regions.find(entry => entry.region_code === item.region_code);
    return found ? found.sido_name + " " + found.region_name : item.region_code;
  }

  async function copyPrompt(item: Candidate) {
    try {
      await navigator.clipboard.writeText(verificationPrompt(item, getRegionName(item)));
      setCopyMessage(item.candidate_key);
    } catch {
      setCopyMessage("copy_failed");
    }
  }

  async function fetchTargets(item: Candidate, query: string) {
    setTargetLoading(true);
    setReviewError("");
    try {
      const params = new URLSearchParams({candidateKey:item.candidate_key});
      if(query.trim())params.set("name",query.trim());
      const response=await fetch("/api/apartment/unmatched-candidates/targets?"+params,{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"동일 지역 단지 조회 실패");
      setTargets(body.targets||[]);
    }catch(error){
      setTargets([]);
      setReviewError(error instanceof Error?error.message:"연결 대상 조회 오류");
    }finally{setTargetLoading(false);}
  }

  function openReview(item: Candidate) {
    setReviewItem(item);
    setTargetQuery("");
    setTargetId("");
    setTargets([]);
    setAuditText("");
    setStageResult(null);
    setApprovalResult(null);
    setConfirmedSourceName("");
    setExplicitApproval(false);
    setReviewError("");
    setReviewMessage("");
    void fetchTargets(item,"");
  }

  function selectTarget(id: string) {
    setTargetId(id);
    setStageResult(null);
    setApprovalResult(null);
    setReviewError("");
    setReviewMessage("");
  }

  function makeIdentityAuditPrompt(item: Candidate, target: KaptTarget) {
    return [
      "[국토부 원자료 ↔ K-apt 단지 신원 검증 · JSON 결과 요청]",
      "반드시 정부·K-apt 등 공식 웹 원문을 열어 증거를 확인하세요. 문서 링크를 추정하거나 만들어내지 마세요.",
      "두 개 이상의 서로 다른 공식 기관 호스트에 있는 개별 근거 문서를 확인해 주세요.",
      "원문에 근거가 부족하거나 지번·준공연도가 다르면 verdict는 hold로 표시하세요.",
      "동일 지번에 여러 관리 단지가 있으면 동/건물 단위까지 확인하기 전에는 hold로 표시하세요.",
      "원자료 단지명: "+item.source_apartment_name,
      "지역코드: "+item.region_code+" / 법정동: "+item.legal_dong,
      "원자료 지번: "+item.jibun+" / 건축연도: "+(item.build_year??"미확인"),
      "확인 대상 K-apt 단지명: "+target.name,
      "K-apt 코드: "+(target.kapt_code||"미확인"),
      "K-apt 주소: "+(target.address||"미확인"),
      "K-apt 입주일: "+(target.use_date||"미확인"),
      "주의: 검색 결과 요약이나 단지명 유사성만으로 match를 표시하지 마세요.",
      "다음 표식과 JSON을 정확히 사용하고, 해당 후보의 불변 ID·명칭·숫자는 변경하지 마세요.",
      "[APT_IDENTITY_AUDIT_JSON]",
      JSON.stringify({
        verdict:"hold",
        candidateKey:item.candidate_key,
        regionCode:item.region_code,
        legalDong:item.legal_dong,
        jibun:item.jibun,
        sourceApartmentName:item.source_apartment_name,
        buildYear:item.build_year,
        targetComplexId:target.id,
        targetComplexName:target.name,
        sources:[
          {url:"공식 개별 문서의 https URL",fact:"원문에서 실제로 확인된 지역·지번·단지 정보"},
          {url:"다른 기관의 공식 개별 문서 https URL",fact:"원문에서 실제로 확인된 준공연도 또는 관리 단지 정보"}
        ],
        explanation:"동일 단지로 판단하는지, 지번 및 명칭 차이가 무엇인지 공식 자료에 근거하여 30자 이상으로 설명"
      },null,2),
      "[/APT_IDENTITY_AUDIT_JSON]",
      "검증 불가일 때는 verdict를 hold로 유지하고 없는 출처를 지어내지 마세요.",
      "이 검증 보고서를 붙여넣더라도 DB는 바뀌지 않습니다. 실제 연결은 운영자 별도 승인만 가능합니다."
    ].join("\n");
  }

  async function copyIdentityAuditPrompt() {
    const target=targets.find(x=>x.id===targetId);
    if(!reviewItem||!target)return;
    try {
      await navigator.clipboard.writeText(makeIdentityAuditPrompt(reviewItem,target));
      setReviewMessage("선택된 두 단지의 JSON 검증 요청서를 복사했어. 실제 원문 확인 후 결과만 붙여넣어 줘.");
    }catch{setReviewError("클립보드에 복사하지 못했습니다.");}
  }

  async function submitReview(action:"stage"|"approve") {
    if(!reviewItem||!targetId)return;
    setReviewBusy(true);
    setReviewError("");
    setReviewMessage("");
    try {
      const response=await fetch("/api/apartment/unmatched-candidates/review",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json","x-apartment-review-secret":adminSecret},
        body:JSON.stringify({
          action,candidateKey:reviewItem.candidate_key,targetComplexId:targetId,
          expectedRawCount:reviewItem.raw_trade_count,
          ...(action==="stage"?{auditText}:{explicitApproval,confirmedSourceName})
        })
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"검토 저장에 실패했습니다.");
      if(action==="stage"){
        setStageResult(body.result);
        setReviewMessage("검증 보고서를 관리자 검토 기록에 저장했어. 거래 연결값·시세는 아직 변경되지 않았어.");
      }else{
        setApprovalResult(body.result);
        setStageResult(null);
        setAdminSecret("");
        setReviewMessage("운영 승인 완료. 실거래 재연결·감사 기록·월별 가격 및 단지 요약값을 함께 갱신했어.");
        setItems(list=>list.filter(x=>x.candidate_key!==reviewItem.candidate_key));
        setTotal(value=>Math.max(0,value-1));
      }
    }catch(error){
      setReviewError(error instanceof Error?error.message:"관리자 검토 처리 오류");
    }finally{setReviewBusy(false);}
  }

  const currentTarget=targets.find(x=>x.id===targetId);
  const approvalBlocked=Boolean(stageResult && (
    stageResult.sharedSourceParcel ||
    (stageResult.targetParcelKnown && !stageResult.sameParcel) ||
    (stageResult.targetConstructionYear!=null && reviewItem?.build_year!=null &&
      Math.abs(stageResult.targetConstructionYear-reviewItem.build_year)>2)
  ));

  const pages = Math.ceil(total / pageSize);

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <a href="/apartment-bulk" className={styles.back}>← 아파트 콘텐츠메이커</a>
        <h1>국토부 미연결 실거래 검토함</h1>
        <p>기존 K-apt 단지에 안전하게 연결되지 않은 원자료를 별도로 모았습니다.</p>
      </header>

      <section className={styles.notice}>
        <strong>단지 식별 전 · 발행용 데이터 아님</strong>
        <p>한 행은 하나의 검토 후보(지역·법정동·지번·국토부 표기 단지명·건축연도 조합)입니다.
        동일 지번에 여러 관리 단지가 있을 수 있으며, 여기에 나타나는 거래 수를
        확인된 K-apt 단지의 실거래량으로 사용하면 안 됩니다. 자동 연결·발행 기능은 없습니다.</p>
      </section>

      <section className={styles.controlPanel} aria-label="미연결 거래 필터">
        <form onSubmit={submitSearch} className={styles.filters}>
          <label>
            <span>지역</span>
            <select value={region} onChange={e => { setRegion(e.target.value); setPage(0); }}>
              <option value="">전체 지역</option>
              {regions.map(item => (
                <option key={item.region_code} value={item.region_code}>
                  {item.sido_name} {item.region_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>미연결 사유</span>
            <select value={reason} onChange={e => { setReason(e.target.value); setPage(0); }}>
              {REASONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.search}>
            <span>국토부 원문 단지명</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              maxLength={40} placeholder="예: 충무주공, 매교역푸르지오" />
          </label>
          <button type="submit">후보 찾기</button>
        </form>
        <div className={styles.resultStatus} aria-live="polite">
          <strong>{loading ? "조회 중…" : total.toLocaleString("ko-KR") + "개 후보"}</strong>
          {appliedName && <span>검색어: {appliedName}</span>}
          <span>검증 전 원자료 · 참고용 목록</span>
        </div>
      </section>

      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!loading && !error && !items.length && <p className={styles.empty}>해당 조건의 후보가 없습니다.</p>}

      {reviewItem && (
        <section className={styles.reviewPanel} aria-label="미연결 실거래 신원 검증">
          <div className={styles.reviewHeading}>
            <div>
              <strong>검증 결과 반영 · {reviewItem.source_apartment_name}</strong>
              <p>국토부 지번 {reviewItem.jibun} / {reviewItem.legal_dong} · 현재 원자료 {reviewItem.raw_trade_count}건</p>
            </div>
            <button type="button" onClick={() => {setReviewItem(null);setAdminSecret("");}}>검토 닫기</button>
          </div>
          {approvalResult ? (
            <div className={styles.approvalDone} role="status">
              <b>관리자 승인 및 재계산 완료</b>
              <p>이번 승인으로 {approvalResult.linkedTradeCount}건을 단지에 연결했어.
              변경 이력과 영구 매칭 규칙이 저장됐고, 대표 면적은 {approvalResult.snapshot?.representativeAreaGroup??"미확인"}㎡대,
              분석기간 연결 거래는 {approvalResult.snapshot?.sixMonthCount??"미확인"}건이야.</p>
              <a href={"/apartment-bulk?complexId="+encodeURIComponent(approvalResult.targetComplexId)}>콘텐츠메이커로 돌아가기 →</a>
            </div>
          ) : (
            <>
              <p className={styles.reviewCaution}>① 동일 지역·법정동의 K-apt 등록 단지를 직접 선택해야 해. 주소 또는 입주연도가 미확인인 단지는 공식 원문에서 추가 확인이 필요해.</p>
              <form className={styles.targetSearch} onSubmit={e=>{e.preventDefault();void fetchTargets(reviewItem,targetQuery);}}>
                <label>
                  K-apt 연결 대상 단지 검색
                  <input value={targetQuery} onChange={e=>setTargetQuery(e.target.value)}
                    maxLength={45} placeholder="예: 율곡, 충무, 주공" />
                </label>
                <button type="submit" disabled={targetLoading}>{targetLoading?"검색 중":"같은 동에서 검색"}</button>
              </form>
              <label className={styles.reviewLabel}>
                검증 대상 K-apt 등록 단지 ({targets.length}건 조회)
                <select value={targetId} onChange={e=>selectTarget(e.target.value)}>
                  <option value="">직접 선택해 주세요</option>
                  {targets.map(t=><option key={t.id} value={t.id}>
                    {t.name} · {t.address||"지번 주소 미확인"} · {t.use_date||"입주일 미확인"}
                  </option>)}
                </select>
              </label>
              {currentTarget && (
                <div className={styles.targetComparison}>
                  <b>대조할 두 개의 원자료</b>
                  <div><span>국토부</span><p>{reviewItem.source_apartment_name} / {reviewItem.legal_dong} {reviewItem.jibun} / {reviewItem.build_year??"미확인"}년</p></div>
                  <div><span>K-apt</span><p>{currentTarget.name} / {currentTarget.address||"지번 주소 미확인"} / {currentTarget.use_date||"입주일 미확인"}</p></div>
                  <small>이름이 비슷하다는 이유만으로는 동일 단지로 확정할 수 없어. 지번 상충·공동 지번은 승인 단계에서 차단돼.</small>
                </div>
              )}
              <button className={styles.reviewAction} type="button" disabled={!currentTarget}
                onClick={() => void copyIdentityAuditPrompt()}>
                ② 선택 단지 포함 JSON 검증 요청서 복사
              </button>
              <label className={styles.reviewLabel}>
                ③ 공식 원문 조사 결과 붙여넣기
                <textarea value={auditText} onChange={e=>{setAuditText(e.target.value);setStageResult(null);}}
                  rows={10} maxLength={16000}
                  placeholder="[APT_IDENTITY_AUDIT_JSON] ... [/APT_IDENTITY_AUDIT_JSON] 또는 JSON 객체를 붙여넣어 주세요. verdict=hold이면 승인하지 않습니다." />
              </label>
              <label className={styles.reviewLabel}>
                관리자 검토 키 (저장하지 않고 현재 페이지에서만 사용)
                <input type="password" value={adminSecret} autoComplete="off"
                  onChange={e=>setAdminSecret(e.target.value)}
                  placeholder="APARTMENT_REVIEW_SECRET 또는 기존 APARTMENT_SYNC_SECRET" />
              </label>
              <button className={styles.reviewAction} type="button"
                disabled={!currentTarget||!auditText.trim()||!adminSecret||reviewBusy}
                onClick={() => void submitReview("stage")}>
                {reviewBusy?"확인 중…":"④ 검증 결과 저장 · 승인 전 대조"}
              </button>
              {stageResult && (
                <div className={styles.stagedReview}>
                  <b>관리자 검토 기록 저장 완료 · 아직 실거래 원자료 변경 없음</b>
                  <p>연결 예정: {stageResult.targetName} / 검토 대상 {stageResult.sourceCount}건</p>
                  <p>등록 지번 확인: {stageResult.targetParcelKnown?(stageResult.sameParcel?"일치":"상충"):"대상 지번 미확인"}.
                  {stageResult.sharedSourceParcel?" 동일 지번 관리 단지가 중복돼.":""}</p>
                  {approvalBlocked ? (
                    <p role="alert">지번 또는 준공연도 상충·공동 지번 사례는 그룹 전체 자동 승인이 금지돼. 공식 자료로 단지 정보를 먼저 정리해야 해.</p>
                  ) : (
                    <div className={styles.explicitApproval}>
                      <b>⑤ 최종 승인 · 실제 DB에 반영됨</b>
                      <p>관리자가 근거 URL의 원문과 단지명을 직접 확인한 경우에만 진행해. 제출된 URL은 형식만 검사하며 내용 자체를 서버가 자동 검증하지는 않아.</p>
                      <label>
                        아래 국토부 단지명을 정확히 직접 입력
                        <input value={confirmedSourceName} onChange={e=>setConfirmedSourceName(e.target.value)}
                          placeholder={reviewItem.source_apartment_name} autoComplete="off" />
                      </label>
                      <label className={styles.explicitCheckbox}>
                        <input type="checkbox" checked={explicitApproval} onChange={e=>setExplicitApproval(e.target.checked)} />
                        <span>두 공식 근거의 원문을 내가 확인했고, 이 단지에 원자료 {reviewItem.raw_trade_count}건을 연결하여 월별 통계를 재계산하는 것에 동의합니다.</span>
                      </label>
                      <button type="button" className={styles.approveButton}
                        disabled={!adminSecret||reviewBusy||!explicitApproval||
                          confirmedSourceName.trim()!==reviewItem.source_apartment_name}
                        onClick={() => void submitReview("approve")}>
                        관리자 최종 승인 · 실거래 재연결
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {reviewMessage && <p role="status" className={styles.reviewMessage}>{reviewMessage}</p>}
          {reviewError && <p role="alert" className={styles.reviewError}>{reviewError}</p>}
        </section>
      )}

      <div className={styles.results}>
        {items.map(item => (
          <article className={styles.card} key={item.candidate_key}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.source}>국토부 원문 · 미검증</span>
                <h2>{item.source_apartment_name}</h2>
                <p>{getRegionName(item)} {item.legal_dong} · 지번 {item.jibun}</p>
              </div>
              <span className={styles.reason}>{REASON_NAME[item.classification] || item.classification}</span>
            </div>
            <div className={styles.facts}>
              <span>건축연도 <b>{item.build_year ? item.build_year + "년" : "미확인"}</b></span>
              <span>수집된 원자료 <b>{item.raw_trade_count.toLocaleString("ko-KR")}건</b></span>
              <span>최근 182일 정상 신고 <b>{item.recent_valid_trade_count.toLocaleString("ko-KR")}건</b></span>
              <span>최근 계약일 <b>{item.latest_contract_date || "미확인"}</b></span>
              <span>신고된 전용면적대 <b>{item.area_groups.length ? item.area_groups.join("·") + "㎡대" : "미확인"}</b></span>
              <span>K-apt 동일 지번 후보 <b>{item.same_lot_kapt_count}개</b></span>
            </div>
            <div className={styles.cardFooter}>
              <small>확인 기준일 {item.analysis_date} · 식별 검토가 끝나기 전에는 기존 단지에 연결하지 않습니다.</small>
              <div className={styles.cardButtons}>
                <button type="button" onClick={() => void copyPrompt(item)}>
                  {copyMessage === item.candidate_key ? "✓ 검증 요청서 복사됨" : "웹 검증 요청서 복사"}
                </button>
                <button type="button" onClick={() => openReview(item)}>
                  {reviewItem?.candidate_key===item.candidate_key?"선택됨 · 검증 진행":"검증 결과 붙여넣기·승인"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {copyMessage === "copy_failed" && <p role="alert" className={styles.error}>클립보드 접근이 제한됐습니다. 브라우저 권한을 확인해 주세요.</p>}

      {!loading && !error && pages > 1 && (
        <nav className={styles.pagination} aria-label="후보 페이지 이동">
          <button type="button" disabled={page <= 0} onClick={() => setPage(v => Math.max(v - 1, 0))}>이전</button>
          <span>{page + 1} / {pages}페이지</span>
          <button type="button" disabled={page + 1 >= pages || page >= 200}
            onClick={() => setPage(v => v + 1)}>다음</button>
        </nav>
      )}
    </main>
  );
}
