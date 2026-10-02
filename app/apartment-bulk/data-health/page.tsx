"use client";

import { FormEvent, useState } from "react";
import styles from "./page.module.css";

type Region={region_code:string;sido_name:string;region_name:string;last_synced_at:string|null};
type Summary={
  complexes:number;householdsMissing:number;useDateMissing:number;addressMissing:number;
  unlinkedRecentTrades:number;unmatchedSourceGroups:number;recentWindowStart:string;
};
type Complex={id:string;kapt_code:string|null;name:string;legal_dong:string|null;
  households:number|null;use_date:string|null;address:string|null;road_address:string|null;updated_at:string};
type Run={started_at:string;finished_at:string|null;status:string;complex_count:number|null;
  trade_count:number|null;matched_trade_count:number|null;kapt_detail_missing_count:number|null;
  kapt_detail_error_count:number|null;kapt_address_missing_count:number|null;error_message:string|null};
type Health={regionCode:string;regions:Region[];summary:Summary;runs:Run[];
  missingComplexes:Complex[];checkedAt:string};
function time(v:string|null|undefined){return v?new Date(v).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"미확인";}
const viewNumber=(n:number|null|undefined)=>typeof n==="number"?n.toLocaleString("ko-KR"):"미확인";

export default function DataHealthPage(){
  const [secret,setSecret]=useState("");
  const [regionCode,setRegionCode]=useState("41410");
  const [query,setQuery]=useState("");
  const [health,setHealth]=useState<Health|null>(null);
  const [loading,setLoading]=useState(false);
  const [refreshing,setRefreshing]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load(region=regionCode,q=query){
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/apartment/data-health?regionCode="+encodeURIComponent(region)+
        "&q="+encodeURIComponent(q),{
        headers:{"x-apartment-review-secret":secret},cache:"no-store"
      });
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||"현황 조회에 실패했습니다.");
      setHealth(json as Health);
    }catch(e){setError(e instanceof Error?e.message:"현황 조회에 실패했습니다.");}
    finally{setLoading(false);}
  }
  function submit(e:FormEvent){e.preventDefault();void load();}
  async function refresh(id:string){
    setRefreshing(id);setMessage("");setError("");
    try{
      const res=await fetch("/api/apartment/data-health",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-apartment-review-secret":secret},
        body:JSON.stringify({complexId:id}),cache:"no-store"
      });
      const result=await res.json();
      if(!res.ok)throw new Error(result.error||"K-apt 재수집에 실패했습니다.");
      setMessage(result.message+" / 채운 항목: "+(result.filled?.join(", ")||"없음")+
        (result.conflicts?.length?" / 충돌 검토: "+result.conflicts.join(", "):""));
      await load();
    }catch(e){setError(e instanceof Error?e.message:"재수집에 실패했습니다.");}
    finally{setRefreshing("");}
  }
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <nav><a href="/apartment-bulk">← 콘텐츠메이커</a><a href="/apartment-bulk/unmatched">미연결 원자료 검토함 →</a></nav>
        <p className={styles.kicker}>APARTMENT DATA CONTROL</p>
        <h1>실거래 · 단지정보 관리 현황판</h1>
        <p>기존 K-apt 단지와 국토부 신고 데이터의 연결 상태를 구분해 확인합니다.
          누락 수치가 곧 실제 무거래라는 뜻은 아닙니다.</p>
      </header>
      <form className={styles.filter} onSubmit={submit}>
        <label>관리자 검토 키
          <input type="password" autoComplete="off" value={secret}
            onChange={e=>setSecret(e.target.value)}
            placeholder="검토 또는 동기화 비밀키" required/>
        </label>
        <label>지역
          <select value={regionCode} onChange={e=>setRegionCode(e.target.value)}>
            {health?.regions?.length
              ? health.regions.map(r=><option key={r.region_code} value={r.region_code}>
                  {r.sido_name} {r.region_name} ({r.region_code})
                </option>)
              : <option value="41410">군포시 (41410) · 최초 조회</option>}
          </select>
        </label>
        <label>기본정보 누락 단지 검색
          <input value={query} onChange={e=>setQuery(e.target.value)}
            maxLength={40} placeholder="단지명 · 비워두면 전체"/>
        </label>
        <button disabled={loading||!secret.trim()}>{loading?"조회 중…":"데이터 현황 조회"}</button>
        <small>관리자 키는 현재 화면의 입력 상태로만 유지하며 URL이나 로컬 저장소에 넣지 않습니다.</small>
      </form>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {message&&<p className={styles.message} role="status">{message}</p>}
      {health&&<>
        <div className={styles.asOf}>확인 시각 {time(health.checkedAt)} · 대상 지역 {health.regionCode}</div>
        <section className={styles.metrics} aria-label="데이터 품질 현황">
          <article><span>K-apt 등록 단지</span><strong>{viewNumber(health.summary.complexes)}</strong><small>해당 지역</small></article>
          <article><span>세대수 미확인</span><strong>{viewNumber(health.summary.householdsMissing)}</strong><small>0세대로 대체하지 않음</small></article>
          <article><span>사용승인일 미확인</span><strong>{viewNumber(health.summary.useDateMissing)}</strong><small>임의 입주연도 사용 금지</small></article>
          <article><span>지번주소 미확인</span><strong>{viewNumber(health.summary.addressMissing)}</strong><small>신원 검토 필요</small></article>
          <article><span>최근 미연결 정상거래</span><strong>{viewNumber(health.summary.unlinkedRecentTrades)}</strong>
            <small>{health.summary.recentWindowStart} 이후 계약</small></article>
          <article><span>미연결 원자료 그룹</span><strong>{viewNumber(health.summary.unmatchedSourceGroups)}</strong>
            <small>자동 병합하지 않음</small></article>
        </section>
        <section className={styles.panel}>
          <h2>지역 동기화 이력</h2>
          <p>최근 실행 상태를 확인한 뒤 재수집이 필요하면 해당 단지의 기본정보만 별도로 확인하세요.</p>
          <div className={styles.tableWrap}><table><thead><tr>
            <th>시작</th><th>결과</th><th>종료</th><th>등록 단지</th><th>원자료</th><th>연결 정상거래</th><th>K-apt 상세 누락/오류</th>
          </tr></thead><tbody>
            {health.runs.map((run,i)=><tr key={i}>
              <td>{time(run.started_at)}</td><td>{run.status}</td><td>{time(run.finished_at)}</td>
              <td>{viewNumber(run.complex_count)}</td><td>{viewNumber(run.trade_count)}</td>
              <td>{viewNumber(run.matched_trade_count)}</td>
              <td>{viewNumber(run.kapt_detail_missing_count)} / {viewNumber(run.kapt_detail_error_count)}
                {run.error_message&&<p className={styles.errorText}>{run.error_message}</p>}</td>
            </tr>)}
          </tbody></table></div>
          {!health.runs.length&&<p>현재 확인되는 동기화 실행 이력이 없습니다.</p>}
        </section>
        <section className={styles.panel}>
          <h2>기본정보 미확인 단지</h2>
          <p>세대수·사용승인일·주소 중 하나라도 없는 단지를 단지명 순으로 최대 30개 표시합니다.
            K-apt 재수집은 기존 확인값을 덮어쓰지 않고 빈 칸만 채웁니다. 서로 다르면 검토 항목으로 남깁니다.</p>
          <div className={styles.cards}>
          {health.missingComplexes.map(c=><article key={c.id} className={styles.complex}>
            <div><h3>{c.name}</h3><small>{c.legal_dong||"법정동 미확인"} · K-apt 코드 {c.kapt_code||"미연결"}</small></div>
            <div className={styles.facts}>
              <span>세대수 <b>{c.households?viewNumber(c.households)+"세대":"미확인"}</b></span>
              <span>사용승인일 <b>{c.use_date||"미확인"}</b></span>
              <span>지번주소 <b>{c.address||"미확인"}</b></span>
            </div>
            <button disabled={!c.kapt_code||Boolean(refreshing)||loading}
              onClick={()=>void refresh(c.id)}>
              {refreshing===c.id?"재수집 중…":"K-apt 기본정보 다시 확인"}
            </button>
          </article>)}
          </div>
          {!health.missingComplexes.length&&<p>검색 조건에 해당하는 기본정보 미확인 단지가 없습니다.</p>}
        </section>
        <footer>안내: 최근 신고일·취소·면적별 월 대표값을 살펴보지 않고 단순 0건, 1건 또는 진행 중인 달로 추세를 단정하지 마세요.</footer>
      </>}
    </main>
  );
}
