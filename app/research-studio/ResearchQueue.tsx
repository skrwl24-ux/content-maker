"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import styles from "./page.module.css";
import ResearchWorkPanel from "./ResearchWorkPanel";
import TopicRecommendationsPanel from "./TopicRecommendationsPanel";
import { recommendationToResearchNotes } from "../../lib/topic-recommendations.mjs";
import type { TopicRecommendation } from "../../lib/topic-recommendations.mjs";
import {RESEARCH_BATCH_SIZE,emptyResearchSlot,parseResearchBatchTopics,researchSlotKey} from "../../lib/research-batch.mjs";
import {parseResearchReport,factKey} from "../../lib/research-studio.mjs";
import {JIBSSUK_RESEARCH_HANDOFF_KEY,parseResearchHandoff,
  researchNotesFromHandoff,pickResearchDestination} from "../../lib/jibssuk-research-handoff.mjs";
import type {ResearchHandoff} from "../../lib/jibssuk-research-handoff.mjs";
type Summary={topic:string;hasReport:boolean;approvedCount:number};
type Stored={version:number;channel:string;topic:string;notes:string;raw:string;selectedAngleId:string;approvedKeys:string[];finalRaw:string;finalTitle:string;finalBody:string};
const ACTIVE_KEY="content-maker-research-studio-active-slot-v2";
const LEGACY_KEY="content-maker-research-studio-v1";
const emptySummary=():Summary=>({topic:"",hasReport:false,approvedCount:0});
function readSlot(n:number):Stored {
  try {
    const raw=localStorage.getItem(researchSlotKey(n)) || (n===1?localStorage.getItem(LEGACY_KEY):null);
    const value=raw?JSON.parse(raw):null;
    if(value?.version!==1||typeof value.topic!=="string") return emptyResearchSlot();
    return {
      version:1,
      channel:value.channel==="Paramma"||value.channel==="기타"?value.channel:"집값쓱",
      topic:value.topic.slice(0,600),notes:typeof value.notes==="string"?value.notes.slice(0,80000):"",
      raw:typeof value.raw==="string"?value.raw.slice(0,180000):"",
      selectedAngleId:typeof value.selectedAngleId==="string"?value.selectedAngleId:"",
      approvedKeys:Array.isArray(value.approvedKeys)?value.approvedKeys.filter((k:unknown)=>typeof k==="string"):[],
      finalRaw:typeof value.finalRaw==="string"?value.finalRaw.slice(0,180000):"",
      finalTitle:typeof value.finalTitle==="string"?value.finalTitle.slice(0,250):"",
      finalBody:typeof value.finalBody==="string"?value.finalBody.slice(0,120000):"",
    };
  }catch{return emptyResearchSlot();}
}
function summary(n:number):Summary{
  const s=readSlot(n),report=parseResearchReport(s.raw);
  const keys=new Set(report?.facts.filter(f=>f.sourceUrl).map(factKey)||[]);
  return {topic:s.topic,hasReport:Boolean(report),approvedCount:s.approvedKeys.filter(k=>keys.has(k)).length};
}
function saveFile(name:string, value:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export default function ResearchQueue(){
  const [ready,setReady]=useState(false);
  const [active,setActive]=useState(1);
  const [epoch,setEpoch]=useState(0);
  const [summaries,setSummaries]=useState<Summary[]>(Array.from({length:RESEARCH_BATCH_SIZE},emptySummary));
  const [batch,setBatch]=useState("");
  const [batchOpen,setBatchOpen]=useState(false);
  const [recommendOpen,setRecommendOpen]=useState(false);
  const existingTopics=useMemo(()=>summaries.map(s=>s.topic).filter(Boolean),[summaries]);
  const [notice,setNotice]=useState("");
  const [incoming,setIncoming]=useState<ResearchHandoff|null>(null);
  useEffect(()=>{
    try {
      const n=Number(localStorage.getItem(ACTIVE_KEY));
      if(Number.isInteger(n)&&n>=1&&n<=RESEARCH_BATCH_SIZE)setActive(n);
      const raw=localStorage.getItem(JIBSSUK_RESEARCH_HANDOFF_KEY);
      if(raw){
        const handoff=parseResearchHandoff(raw);
        if(!handoff){
          localStorage.removeItem(JIBSSUK_RESEARCH_HANDOFF_KEY);
          setNotice("전달된 글감 형식이 올바르지 않습니다. 집값쓱 목록에서 다시 선택해 주세요.");
        } else {
          const stored=Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>
            localStorage.getItem(researchSlotKey(i+1)) ||
            (i===0?localStorage.getItem(LEGACY_KEY):null));
          const destination=pickResearchDestination(stored,handoff);
          if(destination.kind==="free"){
            const slot=emptyResearchSlot(handoff.title,"집값쓱");
            slot.notes=researchNotesFromHandoff(handoff);
            localStorage.setItem(researchSlotKey(destination.slot),JSON.stringify(slot));
            localStorage.setItem(ACTIVE_KEY,String(destination.slot));
            localStorage.removeItem(JIBSSUK_RESEARCH_HANDOFF_KEY);
            setActive(destination.slot);
            setNotice("집값쓱의 최근 이슈·기사 링크를 "+destination.slot+"번 빈 조사 칸으로 가져왔습니다. 원문을 대조한 뒤 심층 조사를 시작하세요.");
          } else if(destination.kind==="existing"){
            const slot=readSlot(destination.slot);
            const notes=researchNotesFromHandoff(handoff);
            if(!slot.notes.includes(handoff.sourceUrl)){
              const merged=[slot.notes,notes].filter(Boolean).join("\n\n");
              if(merged.length<=80000){
                localStorage.setItem(researchSlotKey(destination.slot),JSON.stringify({...slot,notes:merged}));
              } else {
                setNotice("기존 조사 자료의 메모 용량이 가득 찼습니다. 기사 링크는 기존 자료를 지키기 위해 자동 추가하지 않았습니다.");
              }
            }
            localStorage.setItem(ACTIVE_KEY,String(destination.slot));
            localStorage.removeItem(JIBSSUK_RESEARCH_HANDOFF_KEY);
            setActive(destination.slot);
            setNotice(prev=>prev||"같은 제목의 기존 "+destination.slot+"번 조사 작업을 열었습니다. 기존 근거·원고는 유지하고 새 기사 링크는 메모에만 추가했습니다.");
          } else {
            setIncoming(handoff);
            setNotice("심층 조사 5칸이 모두 사용 중입니다. 기존 작업을 유지하려면 교체할 칸을 직접 선택하거나 가져오기를 취소하세요.");
          }
        }
      }
    }catch{
      setNotice("전달된 글감을 저장하지 못했습니다. 기존 조사 자료는 그대로 유지됩니다. 브라우저 저장소를 확인해 주세요.");
    }
    setSummaries(Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>summary(i+1)));
    setReady(true);
  },[]);
  const onSnapshot=useCallback((slot:number,next:Summary)=>{
    setSummaries(prev=>{
      const old=prev[slot-1];
      if(old && old.topic===next.topic && old.hasReport===next.hasReport && old.approvedCount===next.approvedCount)return prev;
      const items=[...prev];items[slot-1]=next;return items;
    });
  },[]);
  function select(n:number){
    setActive(n);setNotice("");
    try{localStorage.setItem(ACTIVE_KEY,String(n));}catch{/* no-op */}
  }
  function replaceWithIncoming(slotNumber:number){
    if(!incoming)return;
    const previous=readSlot(slotNumber);
    const label=previous.topic||"저장된 자료";
    if(!window.confirm(slotNumber+"번 '"+label+"'의 기존 조사·원고를 새 집값쓱 글감으로 교체합니다. 필요한 경우 먼저 전체 백업을 받으세요. 계속할까요?"))return;
    try {
      const slot=emptyResearchSlot(incoming.title,"집값쓱");
      slot.notes=researchNotesFromHandoff(incoming);
      localStorage.setItem(researchSlotKey(slotNumber),JSON.stringify(slot));
      localStorage.setItem(ACTIVE_KEY,String(slotNumber));
      localStorage.removeItem(JIBSSUK_RESEARCH_HANDOFF_KEY);
      setIncoming(null);setActive(slotNumber);setEpoch(v=>v+1);
      setSummaries(Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>summary(i+1)));
      setNotice(slotNumber+"번에 이슈와 원문 링크를 가져왔습니다. 이전 조사 자료는 교체됐습니다.");
    }catch{setNotice("조사 자료를 교체하지 못했습니다. 저장소를 확인해 주세요.");}
  }
  function cancelIncoming(){
    try {localStorage.removeItem(JIBSSUK_RESEARCH_HANDOFF_KEY);}catch{/* no-op */}
    setIncoming(null);setNotice("집값쓱 글감 가져오기를 취소했습니다. 기존 작업은 유지됩니다.");
  }
  function applyBatch(){
    const result=parseResearchBatchTopics(batch);
    if(result.error){setNotice(result.error);return;}
    const occupied=result.topics.some((_,i)=>{const s=readSlot(i+1);return Boolean(s.topic||s.notes||s.raw||s.finalRaw||s.finalBody);});
    if(occupied&&!window.confirm("1~"+result.topics.length+"번에 저장된 기존 주제·조사 자료를 교체합니다. 먼저 전체 백업을 권장합니다. 계속할까요?"))return;
    try{
      const channel=readSlot(active).channel;
      result.topics.forEach((topic,i)=>localStorage.setItem(researchSlotKey(i+1),JSON.stringify(emptyResearchSlot(topic,channel))));
      setSummaries(Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>summary(i+1)));
      setEpoch(n=>n+1);setActive(1);localStorage.setItem(ACTIVE_KEY,"1");
      setBatch("");setBatchOpen(false);
      setNotice(result.topics.length+"개 주제를 목록에 등록했습니다. 번호별로 따로 조사하고 저장할 수 있습니다.");
    }catch{setNotice("저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");}
  }
  function applyRecommended(items:TopicRecommendation[], checkedAt:string):boolean{
    if(!items.length||items.length>RESEARCH_BATCH_SIZE){
      setNotice("추천 주제는 최대 5개까지 등록할 수 있습니다.");return false;
    }
    const occupied=items.some((_,i)=>{
      const slot=readSlot(i+1);
      return Boolean(slot.topic||slot.notes||slot.raw||slot.finalRaw||slot.finalBody);
    });
    if(occupied&&!window.confirm("1~"+items.length+"번의 기존 주제와 조사 자료를 추천 주제로 교체합니다. 필요하면 먼저 전체 백업하세요. 계속할까요?"))return false;
    try{
      items.forEach((item,i)=>{
        const slot=emptyResearchSlot(item.title,item.channel);
        slot.notes=recommendationToResearchNotes(item,checkedAt);
        localStorage.setItem(researchSlotKey(i+1),JSON.stringify(slot));
      });
      setSummaries(Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>summary(i+1)));
      setEpoch(n=>n+1);setActive(1);localStorage.setItem(ACTIVE_KEY,"1");
      setBatchOpen(false);
      setNotice(items.length+"개 추천 주제를 1번부터 등록했습니다. 각 주제의 메모에 추천 근거가 함께 저장됩니다.");
      return true;
    }catch{
      setNotice("추천 주제를 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.");return false;
    }
  }
  function exportAll(){
    saveFile("content-maker-research-five-topics.json",{
      kind:"content-maker-research-batch",version:2,exportedAt:new Date().toISOString(),
      slots:Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>readSlot(i+1)),
    });
    setNotice("5개 작업을 하나의 파일로 백업했습니다.");
  }
  async function importAll(file:File){
    if(file.size>6000000){setNotice("6MB 이하 JSON 백업만 불러올 수 있습니다.");return;}
    try{
      const obj=JSON.parse(await file.text());
      if(obj?.kind!=="content-maker-research-batch"||obj.version!==2||
        !Array.isArray(obj.slots)||obj.slots.length!==RESEARCH_BATCH_SIZE||
        obj.slots.some((s:unknown)=>!s||typeof s!=="object"||!("topic" in s)||typeof s.topic!=="string"||!("raw" in s)||typeof s.raw!=="string")){
        throw new Error("5개 작업 백업 파일이 아닙니다.");
      }
      if(!window.confirm("현재 5개 작업을 모두 백업 내용으로 교체할까요? 이전 자료는 별도로 백업해 주세요."))return;
      const validated:Stored[]=obj.slots.map((s:Stored)=>{
        const channel=s.channel==="Paramma"||s.channel==="기타"?s.channel:"집값쓱";
        const slot=emptyResearchSlot(String(s.topic).slice(0,600),channel);
        slot.notes=typeof s.notes==="string"?s.notes.slice(0,80000):"";
        slot.raw=typeof s.raw==="string"?s.raw.slice(0,180000):"";
        slot.finalRaw=typeof s.finalRaw==="string"?s.finalRaw.slice(0,180000):"";
        slot.finalTitle=typeof s.finalTitle==="string"?s.finalTitle.slice(0,250):"";
        slot.finalBody=typeof s.finalBody==="string"?s.finalBody.slice(0,120000):"";
        slot.selectedAngleId=typeof s.selectedAngleId==="string"?s.selectedAngleId:"";
        const report=parseResearchReport(slot.raw);
        const keys=new Set(report?.facts.filter(f=>f.sourceUrl).map(factKey)||[]);
        slot.approvedKeys=Array.isArray(s.approvedKeys)?s.approvedKeys.filter(k=>typeof k==="string"&&keys.has(k)).slice(0,200):[];
        if(!report){slot.raw="";slot.selectedAngleId="";slot.approvedKeys=[];}
        else if(!report.angles.some(a=>a.id===slot.selectedAngleId))slot.selectedAngleId=report.angles[0]?.id||"";
        return slot;
      });
      validated.forEach((slot,i)=>localStorage.setItem(researchSlotKey(i+1),JSON.stringify(slot)));
      setSummaries(Array.from({length:RESEARCH_BATCH_SIZE},(_,i)=>summary(i+1)));
      setActive(1);setEpoch(n=>n+1);localStorage.setItem(ACTIVE_KEY,"1");
      setNotice("5개 작업을 불러왔습니다. 기존 근거의 원문을 다시 확인해 주세요.");
    }catch(e){setNotice(e instanceof Error?e.message:"백업을 읽을 수 없습니다.");}
  }
  return <>
    <section className={styles.batchArea}>
      <div className={styles.batchHeading}>
        <div>
          <Link href="/" className={styles.back}>← 콘텐츠 메이커</Link>
          <Link href="/jibssuk-queue" className={styles.back}>집값쓱 발행 목록 ↗</Link>
          <h1>AI 심층 조사 · 5개 작업 목록</h1>
          <p>주제 5개를 한 번에 등록하고 하나씩 조사·검증·원고 작성하세요. 각 번호의 자료는 독립적으로 저장됩니다.</p>
        </div>
        <div className={styles.batchActions}>
          <button type="button" className={styles.minor} onClick={()=>{setRecommendOpen(v=>!v);setBatchOpen(false);}}>{recommendOpen?"AI 추천 닫기":"✨ AI 주제 5개 추천받기"}</button>
          <button type="button" className={styles.minor} onClick={()=>{setBatchOpen(v=>!v);setRecommendOpen(false);}}>{batchOpen?"일괄 입력 닫기":"+ 주제 5개 직접 입력"}</button>
          <button type="button" className={styles.minor} onClick={exportAll}>5개 전체 백업</button>
          <label className={styles.backupLabel}>전체 백업 불러오기
            <input type="file" accept=".json,application/json" onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void importAll(f);e.currentTarget.value="";}}/>
          </label>
        </div>
      </div>
      {incoming&&<div className={styles.batchInputBox}>
        <strong>집값쓱 글감 가져오기 · 조사 칸 5개가 모두 사용 중입니다</strong>
        <p>선택한 글감: <b>{incoming.title}</b></p>
        <p>원문: <a href={incoming.sourceUrl} target="_blank" rel="noopener noreferrer">{incoming.sourceUrl} ↗</a></p>
        <p>기존 자료는 자동으로 지우지 않습니다. 교체할 작업을 직접 선택하면 확인창이 열립니다.</p>
        <div className={styles.slotList}>
          {summaries.map((item,i)=><button type="button" key={i+1}
            className={styles.slotButton} onClick={()=>replaceWithIncoming(i+1)}>
            <span className={styles.slotNumber}>{i+1}</span>
            <span className={styles.slotBody}><strong>{item.topic||"저장된 자료"}</strong><small>이 작업을 교체</small></span>
          </button>)}
        </div>
        <div className={styles.batchActions}><button type="button" className={styles.minor} onClick={cancelIncoming}>가져오기 취소 · 기존 작업 유지</button></div>
      </div>}
      {recommendOpen&&<TopicRecommendationsPanel existingTopics={existingTopics} onApply={applyRecommended}/>}
      {batchOpen&&<div className={styles.batchInputBox}>
        <label htmlFor="topic-five-lines">한 줄에 주제 하나 · 최대 5개</label>
        <textarea id="topic-five-lines" rows={5} value={batch} onChange={e=>setBatch(e.target.value)}
          placeholder={"1. 화제가 된 아파트\n2. 인기 드라마 촬영지\n3. 해외에서 주목받는 동물\n4. 최근 생활 정책 변경\n5. 예능에 등장한 장소"}/>
        <div className={styles.batchInputFooter}>
          <span>입력한 개수만 1번부터 교체하고 나머지 슬롯은 유지합니다. 교체 전 기존 자료가 있으면 확인합니다.</span>
          <button type="button" className={styles.primary} onClick={applyBatch}>5개 목록 등록</button>
        </div>
      </div>}
      {notice&&<p role="status" className={styles.notice}>{notice}</p>}
      <div className={styles.slotList} aria-label="5개 조사 주제 목록">
        {summaries.map((s,i)=><button type="button" key={i+1} onClick={()=>select(i+1)}
          className={active===i+1?styles.slotActive:styles.slotButton}
          aria-current={active===i+1?"step":undefined}>
          <span className={styles.slotNumber}>{i+1}</span>
          <span className={styles.slotBody}>
            <strong>{s.topic||"주제 입력 전"}</strong>
            <small>{s.approvedCount?("출처 "+s.approvedCount+"개 확인"):s.hasReport?"조사 결과 있음":s.topic?"조사 대기":"비어 있음"}</small>
          </span>
        </button>)}
      </div>
    </section>
    {ready&&<ResearchWorkPanel key={String(active)+"-"+String(epoch)} slotId={active} onSnapshot={onSnapshot}/>}
  </>;
}
