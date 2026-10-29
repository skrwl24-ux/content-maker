"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  buildDeepResearchPrompt, buildFollowupResearchPrompt,
  buildFinalArticlePrompt, parseResearchReport, parseNaverFinalArticle, factKey,
  DEFAULT_DEEP_RESEARCH_DIRECTIONS, DEFAULT_FINAL_ARTICLE_DIRECTIONS,
} from "../../lib/research-studio.mjs";
import type { ResearchReport } from "../../lib/research-studio.mjs";
import { researchSlotKey } from "../../lib/research-batch.mjs";

const LEGACY_STORAGE_KEY = "content-maker-research-studio-v1";
const DEEP_DIRECTIONS_KEY = "content-maker-deep-research-directions-v2";
const FINAL_DIRECTIONS_KEY = "content-maker-final-article-directions-v2";
type SlotSnapshot = { topic: string; hasReport: boolean; approvedCount: number };
type Channel = "집값쓱" | "Paramma" | "기타";
const initialChannel: Channel = "집값쓱";

function localDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}

export default function ResearchWorkPanel({ slotId, onSnapshot }: { slotId: number; onSnapshot: (slotId: number, data: SlotSnapshot) => void }) {
  const STORAGE_KEY = researchSlotKey(slotId);
  const [hydrated, setHydrated] = useState(false);
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [raw, setRaw] = useState("");
  const [finalRaw, setFinalRaw] = useState("");
  const [finalTitle, setFinalTitle] = useState("");
  const [finalBody, setFinalBody] = useState("");
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [selectedAngleId, setSelectedAngleId] = useState("");
  const [approvedKeys, setApprovedKeys] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [deepDirections, setDeepDirections] = useState(DEFAULT_DEEP_RESEARCH_DIRECTIONS);
  const [finalDirections, setFinalDirections] = useState(DEFAULT_FINAL_ARTICLE_DIRECTIONS);
  const [directionsReady, setDirectionsReady] = useState(false);
  const [today, setToday] = useState("");

    useEffect(() => {
    try {
      const deep = window.localStorage.getItem(DEEP_DIRECTIONS_KEY);
      const final = window.localStorage.getItem(FINAL_DIRECTIONS_KEY);
      if (deep !== null) setDeepDirections(deep.slice(0,12000));
      if (final !== null) setFinalDirections(final.slice(0,12000));
    } catch { /* Browser storage is optional. */ }
    setDirectionsReady(true);
  }, []);

  useEffect(() => {
    if (!directionsReady) return;
    try {
      window.localStorage.setItem(DEEP_DIRECTIONS_KEY,deepDirections);
      window.localStorage.setItem(FINAL_DIRECTIONS_KEY,finalDirections);
    } catch {
      setStatus("요청서 설정을 브라우저에 저장하지 못했습니다. 문구를 따로 백업해 주세요.");
    }
  },[directionsReady,deepDirections,finalDirections]);

  useEffect(() => {
    setToday(localDate());
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) || (slotId === 1 ? window.localStorage.getItem(LEGACY_STORAGE_KEY) : null);
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj && obj.version === 1) {
          if (obj.channel === "집값쓱" || obj.channel === "Paramma" || obj.channel === "기타") setChannel(obj.channel);
          if (typeof obj.topic === "string") setTopic(obj.topic.slice(0,600));
          if (typeof obj.notes === "string") setNotes(obj.notes.slice(0,80000));
          if (typeof obj.finalRaw === "string") setFinalRaw(obj.finalRaw.slice(0,180000));
          if (typeof obj.finalTitle === "string") setFinalTitle(obj.finalTitle.slice(0,250));
          if (typeof obj.finalBody === "string") setFinalBody(obj.finalBody.slice(0,120000));
          if (typeof obj.raw === "string") {
            const imported = parseResearchReport(obj.raw);
            setRaw(obj.raw.slice(0,180000));
            if (imported) {
              setReport(imported);
              setSelectedAngleId(imported.angles.some((a) => a.id === obj.selectedAngleId) ? obj.selectedAngleId : (imported.angles[0]?.id || ""));
              const keys = new Set(imported.facts.filter(f => f.sourceUrl).map(factKey));
              setApprovedKeys(Array.isArray(obj.approvedKeys) ? obj.approvedKeys.filter((k: unknown) => typeof k === "string" && keys.has(k)) : []);
            }
          }
        }
      }
    } catch { /* Browser storage can be unavailable; page still works. */ }
    setHydrated(true);
  }, [slotId, STORAGE_KEY]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version:1,channel,topic,notes,raw,selectedAngleId,approvedKeys,finalRaw,finalTitle,finalBody,
      }));
      onSnapshot(slotId, { topic, hasReport: Boolean(report), approvedCount: approvedKeys.length });
    } catch {
      setStatus("브라우저 저장 공간이 부족하거나 차단됐습니다. 중요한 자료는 별도로 백업해 주세요.");
    }
  }, [hydrated,channel,topic,notes,raw,selectedAngleId,approvedKeys,finalRaw,finalTitle,finalBody,report,slotId,STORAGE_KEY,onSnapshot]);

  const researchPrompt = useMemo(() => buildDeepResearchPrompt({channel,topic,notes,today,directions:deepDirections}), [channel,topic,notes,today,deepDirections]);
  const followupPrompt = useMemo(() => buildFollowupResearchPrompt({channel,topic,notes,report,approvedKeys,today,directions:deepDirections}), [channel,topic,notes,report,approvedKeys,today,deepDirections]);
  const articlePrompt = useMemo(() => buildFinalArticlePrompt({
    channel,topic,notes,report,selectedAngleId,approvedKeys,today,directions:finalDirections,
  }), [channel,topic,notes,report,selectedAngleId,approvedKeys,today,finalDirections]);

  const checkedCount = report?.facts.filter(f => f.sourceUrl && approvedKeys.includes(factKey(f))).length || 0;
  const unverifiedCount = (report?.facts.length || 0) - checkedCount;

  async function copy(value: string, label: string, destination = "ChatGPT 새 대화에 붙여넣으세요.") {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(label + " 복사했습니다. " + destination);
    } catch {
      setStatus("클립보드 복사 실패. 화면의 입력 칸에서 직접 복사해 주세요.");
    }
  }

  function importResult() {
    const parsed = parseResearchReport(raw);
    if (!parsed) {
      setStatus("조사 결과를 읽지 못했습니다. [RESEARCH_REPORT_JSON] 태그와 유효한 JSON 내용이 있는지 확인하세요.");
      return;
    }
    const nextKeys = new Set(parsed.facts.filter(f => f.sourceUrl).map(factKey));
    setApprovedKeys(prev => prev.filter(k => nextKeys.has(k)));
    setReport(parsed);
    setSelectedAngleId(prev => parsed.angles.some(a => a.id === prev) ? prev : (parsed.angles[0]?.id || ""));
    setStatus("조사 보고서를 불러왔습니다. 주장을 원문과 대조한 뒤 확인 표시를 해 주세요.");
  }

  function importFinalArticle() {
    const parsed = parseNaverFinalArticle(finalRaw);
    if (!parsed) {
      setStatus("최종 원고를 읽지 못했습니다. [NAVER_FINAL_ARTICLE_JSON] 태그와 유효한 JSON 또는 일반 본문인지 확인해 주세요.");
      return;
    }
    if ((finalTitle || finalBody) && !window.confirm("현재 편집 중인 최종 원고를 붙여넣은 내용으로 교체할까요?")) return;
    setFinalTitle(parsed.title);
    setFinalBody(parsed.body);
    setStatus("최종 원고를 가져왔습니다. 내용과 출처를 확인하고 제목·본문을 별도로 복사할 수 있습니다.");
  }

  function toggleApproval(key: string, checked: boolean) {
    setApprovedKeys(prev => checked ? [...new Set([...prev,key])] : prev.filter(k => k!==key));
  }

  function changeTopic(next: string) {
    if (report || finalRaw || finalBody) {
      if (!window.confirm("주제를 변경하면 기존 조사·최종 원고 자료가 초기화됩니다. 계속할까요?")) return;
      setReport(null);setRaw("");setApprovedKeys([]);setSelectedAngleId("");
      setFinalRaw("");setFinalTitle("");setFinalBody("");
    }
    setTopic(next);
  }

  function changeChannel(next: Channel) {
    if (report || finalRaw || finalBody) {
      if (!window.confirm("발행 블로그를 변경하면 기존 조사·최종 원고 자료가 초기화됩니다. 계속할까요?")) return;
      setReport(null);setRaw("");setApprovedKeys([]);setSelectedAngleId("");
      setFinalRaw("");setFinalTitle("");setFinalBody("");
    }
    setChannel(next);
  }

  function clearWork() {
    if ((report || finalRaw || finalBody) && !window.confirm("현재 조사와 최종 원고를 모두 지우고 새 작업을 시작할까요?")) return;
    setTopic("");setNotes("");setRaw("");setReport(null);
    setApprovedKeys([]);setSelectedAngleId("");
    setFinalRaw("");setFinalTitle("");setFinalBody("");setStatus("새 작업을 시작할 수 있습니다.");
  }

  async function importBackup(file: File) {
    if (file.size > 5_000_000) {
      setStatus("백업 파일이 너무 큽니다. 5MB 이하 JSON 파일만 불러올 수 있습니다.");
      return;
    }
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || obj.version !== 1 || typeof obj.topic !== "string" ||
          typeof obj.notes !== "string" || typeof obj.raw !== "string") {
        throw new Error("콘텐츠 메이커 조사 작업 백업 파일이 아닙니다.");
      }
      if (!window.confirm("현재 작업을 이 백업으로 교체할까요? 현재 작업은 먼저 백업해 주세요.")) return;
      const next = parseResearchReport(obj.raw);
      const validKeys = new Set((next?.facts || []).filter(f=>f.sourceUrl).map(factKey));
      setChannel(obj.channel==="집값쓱" || obj.channel==="Paramma" ? obj.channel : "기타");
      setTopic(obj.topic.slice(0,600));
      setNotes(obj.notes.slice(0,80000));
      setRaw(obj.raw.slice(0,180000));
      setFinalRaw(typeof obj.finalRaw==="string"?obj.finalRaw.slice(0,180000):"");
      setFinalTitle(typeof obj.finalTitle==="string"?obj.finalTitle.slice(0,250):"");
      setFinalBody(typeof obj.finalBody==="string"?obj.finalBody.slice(0,120000):"");
      setReport(next);
      setSelectedAngleId(next?.angles.some(a=>a.id===obj.selectedAngleId) ? obj.selectedAngleId : (next?.angles[0]?.id || ""));
      setApprovedKeys(Array.isArray(obj.approvedKeys) ? obj.approvedKeys.filter((k:unknown)=>typeof k==="string" && validKeys.has(k)) : []);
      setStatus("조사 작업 백업을 불러왔습니다. 확인 표시가 원문과 일치하는지 다시 점검하세요.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "백업을 읽지 못했습니다.");
    }
  }

  function exportBackup() {
    const contents = JSON.stringify({
      version:1, exportedAt:new Date().toISOString(),channel,topic,notes,raw,selectedAngleId,approvedKeys,finalRaw,finalTitle,finalBody,
    },null,2);
    const blob = new Blob([contents],{type:"application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href=url;anchor.download=`content-maker-research-slot-${slotId}.json`;anchor.click();
    URL.revokeObjectURL(url);
    setStatus("현재 작업을 JSON 파일로 백업했습니다.");
  }

  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <div>
          <Link href="/" className={styles.back}>← 콘텐츠 메이커 홈</Link>
          <h1>{slotId}번 주제 조사</h1>
          <p>선택한 {slotId}번 소재를 조사하고 근거를 확인한 뒤 원고를 만듭니다. 다른 번호의 자료와 섞이지 않습니다.</p>
        </div>
        <div className={styles.topActions}>
          <button type="button" className={styles.minor} onClick={exportBackup}>현재 작업 백업</button>
          <label className={styles.backupLabel}>백업 불러오기<input type="file" accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0]; if(file) void importBackup(file); e.currentTarget.value="";}} /></label>
          <button type="button" className={styles.minor} onClick={clearWork}>새 조사</button>
        </div>
      </header>

      <div className={styles.stepper} aria-label="조사 진행 단계">
        <span className={styles.stepActive}>1 · 주제 입력</span>
        <span className={report ? styles.stepDone : styles.step}>2 · AI 조사</span>
        <span className={checkedCount ? styles.stepDone : styles.step}>3 · 근거 확인</span>
        <span className={articlePrompt ? styles.stepDone : styles.step}>4 · 글 제작</span>
      </div>
      {status && <p role="status" className={styles.notice}>{status}</p>}

      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.number}>01</span>
            <div><h2>무엇을 조사할까요?</h2><p>키워드만 넣어도 됩니다. 참고 자료가 있으면 더 좋습니다.</p></div>
          </div>

          <label htmlFor="research-channel">발행 블로그</label>
          <select id="research-channel" value={channel} onChange={e=>changeChannel(e.target.value as Channel)}>
            <option value="집값쓱">집값쓱 · 아파트·지역</option>
            <option value="Paramma">Paramma · 생활·동물·자연</option>
            <option value="기타">기타 콘텐츠</option>
          </select>
          <label htmlFor="research-topic">주제 또는 발견한 소식</label>
          <input id="research-topic" value={topic} maxLength={600} onChange={e=>changeTopic(e.target.value)}
            placeholder="예: 드라마에 나온 아파트가 실제 촬영지인지" />
          <label htmlFor="research-notes">기사 링크·방송 정보·직접 조사한 자료 <small>(선택)</small></label>
          <textarea id="research-notes" value={notes} onChange={e=>setNotes(e.target.value)}
            rows={5} placeholder={"원문 URL:\n발표일 / 실제 사건일:\n직접 확인한 사실:\n아직 불확실한 내용:"}/>
          <div className={styles.actionRow}>
            <button type="button" className={styles.primary} disabled={!topic.trim() || !deepDirections.trim() || !directionsReady}
              onClick={()=>void copy(researchPrompt,"1차 심층 조사 요청서")}>심층 조사 요청서 복사</button>
            <a className={styles.secondary} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
          </div>
          <details className={styles.details} open>
            <summary>AI 심층 조사 요청서 직접 수정하기</summary>
            <p className={styles.smallText}>어떤 발견을 찾을지 자유롭게 수정하세요. 주제·날짜·자료·결과 JSON은 자동으로 붙습니다. 5개 주제에 공통으로 적용됩니다.</p>
            <label htmlFor="deep-prompt-directions" className={styles.promptEditorLabel}>심층 조사 방향</label>
            <textarea id="deep-prompt-directions" className={styles.promptEditor} rows={7}
              value={deepDirections} maxLength={12000} onChange={e=>setDeepDirections(e.target.value)}
              aria-label="심층 조사 지시문 직접 편집"/>
            <div className={styles.promptEditorActions}>
              <span>{directionsReady ? "수정 내용은 이 브라우저에 자동 저장됩니다." : "설정을 불러오는 중입니다."}</span>
              <button type="button" className={styles.secondary} disabled={deepDirections===DEFAULT_DEEP_RESEARCH_DIRECTIONS}
                onClick={()=>{if(window.confirm("심층 조사 지시문을 기본값으로 복원할까요?"))setDeepDirections(DEFAULT_DEEP_RESEARCH_DIRECTIONS);}}>기본 문구 복원</button>
            </div>
            <details className={styles.details}>
              <summary>ChatGPT에 복사될 전체 심층 조사 요청서 보기</summary>
              <textarea className={styles.promptPreview} aria-label="심층 조사 전체 요청서 미리보기" readOnly value={researchPrompt} rows={9}/>
            </details>
          </details>
          <p className={styles.smallText}>이 화면은 직접 웹 검색하지 않습니다. ChatGPT에 요청서를 붙여넣어 조사한 다음 그 결과를 아래에 가져오는 방식입니다.</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.number}>02</span>
            <div><h2>AI 조사 결과 가져오기</h2><p>ChatGPT 답변 전체를 붙여넣으면 조사 결과를 분류합니다.</p></div>
          </div>
          <label htmlFor="research-result">[RESEARCH_REPORT_JSON]이 포함된 조사 결과</label>
          <textarea id="research-result" value={raw} rows={10} onChange={e=>{ setRaw(e.target.value); setReport(null); }}
            placeholder={"[RESEARCH_REPORT_JSON]\n{ \"topic\": \"...\", \"facts\": [], \"angles\": [], \"gaps\": [] }\n[/RESEARCH_REPORT_JSON]"}/>
          <div className={styles.actionRow}>
            <button type="button" className={styles.primary} disabled={!raw.trim()} onClick={importResult}>조사 보고서 불러오기</button>
            {report && <span className={styles.pill}>{report.facts.length}개 사실 · {report.angles.length}개 글감</span>}
          </div>
          {report ? (
            <div className={styles.summary}>
              <strong>{report.topic}</strong>
              <p>{report.summary || "요약은 제공되지 않았습니다."}</p>
              <small>AI 보고서 확인일: {report.checkedAt || "미입력"} · 보고서에 있다는 이유만으로 검증 완료가 아닙니다.</small>
            </div>
          ) : (
            <p className={styles.empty}>조사 보고서를 불러오면 여기서 사실과 글감을 검토할 수 있습니다.</p>
          )}
        </section>
      </div>

      {report && (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.number}>03</span>
            <div><h2>원문 확인과 추가 조사</h2><p>URL을 실제로 열어 주장과 발표일을 대조한 항목만 체크해 주세요.</p></div>
          </div>
          <div className={styles.statRow}>
            <span>사실 후보 <b>{report.facts.length}개</b></span>
            <span>직접 확인 <b>{checkedCount}개</b></span>
            <span>미확인 <b>{unverifiedCount}개</b></span>
          </div>
          {report.facts.length ? (
            <div className={styles.factList}>
              {report.facts.map(f=>(
                <div key={f.id} className={styles.fact}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={approvedKeys.includes(factKey(f))}
                      disabled={!f.sourceUrl}
                      onChange={e=>toggleApproval(factKey(f),e.target.checked)}/>
                    <span>원문 대조 완료</span>
                  </label>
                  <p>{f.claim}</p>
                  {f.sourceUrl ? <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {f.sourceTitle || "원문 열어보기"} ↗</a> : <em>출처 URL 없음 · 확인 불가</em>}
                  {f.publishedAt && <small>원문 발표일: {f.publishedAt}</small>}
                </div>
              ))}
            </div>
          ) : <p className={styles.empty}>원문으로 확인할 사실이 없습니다. 추가 조사를 진행해 주세요.</p>}

          {report.trendLinks.length>0 && <div className={styles.subsection}>
            <h3>방송·인물·트렌드 연결 단서</h3>
            <p className={styles.smallText}>AI가 제시한 관련성 후보입니다. 원문을 확인하기 전까지 확정해서 사용하지 않습니다.</p>
            {report.trendLinks.map((t,i)=>(
              <div key={i} className={styles.trend}>
                <b>{t.subject}</b> · {t.connection}
                <span>{t.status}</span>
                {t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer">원문 확인 ↗</a>}
              </div>
            ))}
          </div>}

          {report.gaps.length>0 && <div className={styles.subsection}>
            <h3>아직 부족한 근거</h3>
            <ul>{report.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul>
          </div>}
          <div className={styles.actionRow}>
            <button type="button" className={styles.secondary} onClick={()=>void copy(followupPrompt,"추가 조사 요청서")}>부족한 근거 재조사 요청서 복사</button>
            <a className={styles.secondary} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
          </div>
          <p className={styles.smallText}>재조사 답변은 전체 최신 보고서로 받아 위 2단계에 붙여넣으세요. 동일한 주장과 URL의 확인 표시는 유지됩니다.</p>
        </section>
      )}

      {report && (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <span className={styles.number}>04</span>
            <div><h2>글감 선택과 원고 요청</h2><p>근거가 있는 관점 하나를 선택해 기존 글쓰기 작업으로 이어갑니다.</p></div>
          </div>
          {report.angles.length ? <div className={styles.angleGrid}>
            {report.angles.map(a=>(
              <label key={a.id} className={selectedAngleId===a.id?styles.angleSelected:styles.angle}>
                <input type="radio" name="selected-angle" checked={selectedAngleId===a.id} onChange={()=>setSelectedAngleId(a.id)}/>
                <strong>{a.title}</strong>
                <small>독자 질문 · {a.readerQuestion || "미입력"}</small>
                <p>{a.uniqueValue || "독자에게 제공할 가치 미입력"}</p>
              </label>
            ))}
          </div> : <p className={styles.empty}>추천 관점이 없습니다. 자료를 더 확인하거나 다른 소재로 조사하세요.</p>}
          <div className={styles.actionRow}>
            <button type="button" className={styles.primary} disabled={!articlePrompt || !finalDirections.trim() || !directionsReady} onClick={()=>void copy(articlePrompt,"최종 원고 요청서")}>검토 자료로 원고 요청서 복사</button>
            <a className={styles.secondary} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
          </div>
          {!articlePrompt && <p className={styles.smallText}>원고 요청서는 선택한 글감에 실제 연결된 출처 사실을 최소 1개 직접 확인하면 활성화됩니다.</p>}
          <details className={styles.details} open>
            <summary>최종 원고 글쓰기 스타일 직접 수정하기</summary>
            <p className={styles.smallText}>남들이 지나친 발견을 혼잣말하듯 풀어내는 기본 문구입니다. 원하는 말투로 바꿀 수 있고, 5개 주제에 공통으로 적용됩니다.</p>
            <label htmlFor="final-prompt-directions" className={styles.promptEditorLabel}>네이버 원고 글쓰기 방향</label>
            <textarea id="final-prompt-directions" className={styles.promptEditor} rows={8}
              value={finalDirections} maxLength={12000} onChange={e=>setFinalDirections(e.target.value)}
              aria-label="네이버 최종 원고 지시문 직접 편집"/>
            <div className={styles.promptEditorActions}>
              <span>{directionsReady ? "수정 내용은 이 브라우저에 자동 저장됩니다." : "설정을 불러오는 중입니다."}</span>
              <button type="button" className={styles.secondary} disabled={finalDirections===DEFAULT_FINAL_ARTICLE_DIRECTIONS}
                onClick={()=>{if(window.confirm("원고 글쓰기 지시문을 기본값으로 복원할까요?"))setFinalDirections(DEFAULT_FINAL_ARTICLE_DIRECTIONS);}}>기본 문구 복원</button>
            </div>
            {articlePrompt && <details className={styles.details}>
              <summary>ChatGPT에 복사될 전체 최종 원고 요청서 보기</summary>
              <textarea className={styles.promptPreview} value={articlePrompt} readOnly rows={12} aria-label="최종 원고 전체 요청서 미리보기"/>
            </details>}
          </details>
          <div className={styles.nextLinks}>
            <span>완성한 글은 기존 제작 화면에서 편집할 수 있습니다.</span>
            <Link href="/apartment-bulk">집값쓱 제작실 ↗</Link>
            <Link href="/paramma-bulk">Paramma 제작실 ↗</Link>
          </div>
        </section>
      )}
      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <span className={styles.number}>05</span>
          <div><h2>네이버 최종 원고 붙여넣기</h2><p>ChatGPT에서 완성한 글을 이곳에 가져와 제목과 본문을 따로 복사하세요.</p></div>
        </div>
        <label htmlFor="naver-final-import">완성 원고 붙여넣기 · [NAVER_FINAL_ARTICLE_JSON] 또는 일반 본문</label>
        <textarea id="naver-final-import" rows={8} value={finalRaw} maxLength={180000}
          onChange={e=>setFinalRaw(e.target.value)}
          placeholder="완성된 JSON 또는 일반 본문을 붙여넣으세요." />
        <div className={styles.actionRow}>
          <button type="button" className={styles.primary} disabled={!finalRaw.trim()} onClick={importFinalArticle}>최종 원고 불러오기</button>
          <span className={styles.finalHint}>태그 형식이 아니어도 일반 본문을 붙여넣을 수 있습니다.</span>
        </div>
        {(finalTitle || finalBody) && <div className={styles.finalEditor}>
          <h3>네이버 발행용 편집 · 복사</h3>
          <p className={styles.smallText}>제목·본문을 바로 수정할 수 있습니다. 복사 시 JSON 태그는 포함되지 않습니다.</p>
          <label htmlFor="naver-final-title">제목</label>
          <input id="naver-final-title" type="text" value={finalTitle} maxLength={250} onChange={e=>setFinalTitle(e.target.value)}
            placeholder="네이버 글 제목을 입력하세요" />
          <label htmlFor="naver-final-body">본문</label>
          <textarea id="naver-final-body" className={styles.finalPreview} rows={15} value={finalBody}
            maxLength={120000} onChange={e=>setFinalBody(e.target.value)} />
          <div className={styles.actionRow}>
            <button type="button" className={styles.secondary} disabled={!finalTitle.trim()}
              onClick={()=>void copy(finalTitle,"제목","네이버 글 제목 칸에 붙여넣으세요.")}>제목 복사</button>
            <button type="button" className={styles.primary} disabled={!finalBody.trim()}
              onClick={()=>void copy(finalBody,"본문","네이버 글 본문 칸에 붙여넣으세요.")}>본문 복사</button>
            <button type="button" className={styles.secondary} disabled={!finalBody.trim()}
              onClick={()=>void copy([finalTitle,finalBody].filter(Boolean).join("\n\n"),"제목+본문","필요한 곳에 붙여넣으세요.")}>전체 복사</button>
          </div>
          <p className={styles.smallText}>이 기능은 원고 보관과 복사만 합니다. 네이버 블로그에 직접 발행하지 않으며, 이미지·표 서식은 별도 편집이 필요합니다.</p>
        </div>}
      </section>
      <footer className={styles.footer}>
        현재 작업은 이 브라우저의 로컬 저장소에 자동 보관됩니다. 다른 기기와 자동 동기화되지 않으므로 백업 파일로 옮겨야 합니다. 시크릿 모드나 브라우저 데이터 삭제 시 사라질 수 있습니다.
        개인정보나 비공개 자료는 붙여넣지 마세요.
      </footer>
    </main>
  );
}
