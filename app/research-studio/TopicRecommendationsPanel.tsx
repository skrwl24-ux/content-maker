"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  buildTopicRecommendationPrompt,
  DEFAULT_TOPIC_DISCOVERY_DIRECTIONS,
  parseTopicRecommendations,
} from "../../lib/topic-recommendations.mjs";
import type { TopicRecommendation, TopicRecommendationReport } from "../../lib/topic-recommendations.mjs";

type Scope = "전체" | "집값쓱" | "Paramma";
const DIRECTION_STORAGE_KEY = "content-maker-topic-discovery-directions-v1";

function localDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}

export default function TopicRecommendationsPanel({
  existingTopics,
  onApply,
}:{
  existingTopics:string[];
  onApply:(items:TopicRecommendation[],checkedAt:string)=>boolean;
}){
  const [scope,setScope] = useState<Scope>("전체");
  const [days,setDays] = useState(7);
  const [focus,setFocus] = useState("");
  const [directions,setDirections] = useState(DEFAULT_TOPIC_DISCOVERY_DIRECTIONS);
  const [directionsReady,setDirectionsReady] = useState(false);
  useEffect(()=>{
    try {
      const saved=window.localStorage.getItem(DIRECTION_STORAGE_KEY);
      if(saved!==null) setDirections(saved.slice(0,12000));
    } catch { /* Storage is optional. */ }
    setDirectionsReady(true);
  },[]);
  useEffect(()=>{
    if(!directionsReady) return;
    try { window.localStorage.setItem(DIRECTION_STORAGE_KEY,directions); }
    catch { setNotice("이 브라우저에서 요청서 설정을 저장할 수 없습니다. 문구를 따로 백업해 주세요."); }
  },[directions,directionsReady]);
  const [raw,setRaw] = useState("");
  const [report,setReport] = useState<TopicRecommendationReport | null>(null);
  const [selected,setSelected] = useState<string[]>([]);
  const [notice,setNotice] = useState("");
  const prompt=useMemo(()=>buildTopicRecommendationPrompt({
    channel:scope,
    focus,
    lookbackDays:days,
    today:localDate(),
    existingTopics,
    directions,
  }),[scope,days,focus,existingTopics,directions]);

  async function copyPrompt(){
    if(!directions.trim()) {
      setNotice("AI 조사 방향을 입력하거나 기본 문구로 복원한 뒤 복사해 주세요.");
      return;
    }
    try{
      await navigator.clipboard.writeText(prompt);
      setNotice("최신 소재 추천 조사 요청서를 복사했습니다. ChatGPT에서 붙여넣어 조사해 주세요.");
    } catch {
      setNotice("복사하지 못했습니다. 아래 요청서를 직접 선택해 복사해 주세요.");
    }
  }
  function importReport(){
    const parsed=parseTopicRecommendations(raw);
    if(!parsed){
      setNotice("추천 결과를 읽지 못했습니다. [TOPIC_RECOMMENDATIONS_JSON] 태그와 JSON을 확인하세요.");
      return;
    }
    setReport(parsed);
    setSelected([]);
    setNotice(parsed.candidates.length ? "추천 후보를 불러왔습니다. 5개까지 선택해 등록하세요." : "조사에서 추천할 만큼 확인된 후보가 없었습니다.");
  }
  function toggle(id:string,checked:boolean){
    setSelected(prev=>{
      if(!checked) return prev.filter(x=>x!==id);
      if(prev.includes(id))return prev;
      if(prev.length>=5){setNotice("한 번에 최대 5개까지 선택할 수 있습니다.");return prev;}
      return [...prev,id];
    });
  }
  function apply(){
    if(!report)return;
    const items=report.candidates.filter(c=>selected.includes(c.id));
    if(!items.length){setNotice("등록할 주제를 선택해 주세요.");return;}
    const ok=onApply(items,report.checkedAt);
    if(ok) setNotice(items.length+"개 추천 주제를 1번부터 등록했습니다. 각 주제를 클릭해 심층 조사를 진행하세요.");
  }
  return (
    <section className={styles.recommendPanel}>
      <div className={styles.recommendHeading}>
        <div>
          <h2>✨ AI에게 최신 주제 추천받기</h2>
          <p>최근 뉴스·방송·드라마·연예인·부동산·생활 이슈에서 실제 글로 발전시킬 소재를 찾습니다.</p>
        </div>
        <span className={styles.recommendFootnote}>ChatGPT 검색 활용</span>
      </div>
      <div className={styles.recommendControls}>
        <label>추천 범위
          <select value={scope} onChange={e=>setScope(e.target.value as Scope)}>
            <option value="전체">집값쓱 + Paramma</option>
            <option value="집값쓱">집값쓱</option>
            <option value="Paramma">Paramma</option>
          </select>
        </label>
        <label>관심 기간
          <select value={days} onChange={e=>setDays(Number(e.target.value))}>
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
          </select>
        </label>
        <label className={styles.recommendFocus}>관심사 · 선택
          <input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="예: 드라마 촬영지, 지역 부동산, 신기한 동물" maxLength={2000}/>
        </label>
      </div>
      <div className={styles.actionRow}>
        <button type="button" className={styles.primary} onClick={()=>void copyPrompt()}>1 · AI 주제 추천 요청서 복사</button>
        <a className={styles.secondary} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
      </div>
      <details className={styles.details} open>
        <summary>조사 요청서 직접 수정하기</summary>
        <p className={styles.smallText}>아래는 AI가 무엇을 발견할지 정하는 지시문입니다. 자유롭게 수정하세요. 날짜·추천 범위·결과 JSON 형식은 자동으로 붙습니다.</p>
        <label htmlFor="discovery-directions" className={styles.promptEditorLabel}>AI 조사 방향 · 직접 편집</label>
        <textarea id="discovery-directions" className={styles.promptEditor} value={directions} rows={7} maxLength={12000}
          onChange={e=>setDirections(e.target.value)} aria-label="수정 가능한 AI 주제 추천 조사 방향" />
        <div className={styles.promptEditorActions}>
          <span>{directionsReady ? "변경 내용은 이 브라우저에 자동 저장됩니다." : "설정을 불러오는 중입니다."}</span>
          <button type="button" className={styles.secondary} disabled={directions===DEFAULT_TOPIC_DISCOVERY_DIRECTIONS}
            onClick={()=>{if(window.confirm("AI 조사 방향을 기본 문구로 복원할까요?")){setDirections(DEFAULT_TOPIC_DISCOVERY_DIRECTIONS);setNotice("기본 조사 지시문으로 복원했습니다.");}}}>기본 문구 복원</button>
        </div>
        <details className={styles.details}>
          <summary>ChatGPT에 복사되는 전체 요청서 미리보기</summary>
          <textarea className={styles.promptPreview} readOnly value={prompt} aria-label="전체 AI 주제 추천 요청서 미리보기" rows={10}/>
        </details>
      </details>
      <div className={styles.recommendImport}>
        <label htmlFor="recommendation-result">2 · ChatGPT의 추천 조사 결과 붙여넣기</label>
        <textarea id="recommendation-result" rows={5} value={raw} onChange={e=>{setRaw(e.target.value);setReport(null);setSelected([]);}}
          placeholder={"[TOPIC_RECOMMENDATIONS_JSON]\n{ \"checkedAt\": \"YYYY-MM-DD\", \"candidates\": [] }\n[/TOPIC_RECOMMENDATIONS_JSON]"}/>
        <button type="button" className={styles.secondary} disabled={!raw.trim()} onClick={importReport}>추천 목록 불러오기</button>
      </div>
      {notice&&<p className={styles.recommendNotice} role="status">{notice}</p>}
      {report&&<>
        <div className={styles.recommendListHead}>
          <strong>3 · 주제 선택 <small>최대 5개 ({selected.length}/5)</small></strong>
          <small>AI 조사 기준일: {report.checkedAt||"미기재"} · 원문을 다시 확인해야 합니다.</small>
        </div>
        {report.candidates.length ? <div className={styles.recommendList}>
          {report.candidates.map(item=><label className={styles.recommendItem} key={item.id}>
            <input type="checkbox" checked={selected.includes(item.id)}
              disabled={!selected.includes(item.id)&&selected.length>=5}
              onChange={e=>toggle(item.id,e.target.checked)}/>
            <span className={styles.recommendContent}>
              <strong>{item.title}</strong>
              <small>{item.channel} · {item.type||"주제"}</small>
              {item.whyNow&&<span>최근 관심 이유: {item.whyNow}</span>}
              {item.extraValue&&<span>글에서 줄 정보: {item.extraValue}</span>}
              {item.sourceUrl?<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                onClick={e=>e.stopPropagation()}>근거 원문 확인 ↗</a>:
                <em>출처 미확인 · 심층 조사 필요</em>}
            </span>
          </label>)}
        </div>:<p className={styles.empty}>확인된 추천 후보가 없습니다. 다른 범위로 다시 조사해 보세요.</p>}
        <div className={styles.actionRow}>
          <button type="button" className={styles.primary} disabled={!selected.length} onClick={apply}>
            선택한 {selected.length}개를 작업 목록에 넣기
          </button>
        </div>
        <p className={styles.smallText}>기존 작업을 덮어쓰게 되면 별도로 확인합니다. 추천된 제목과 자료는 심층 조사 단계에서 다시 검증해야 합니다.</p>
      </>}
    </section>
  );
}
