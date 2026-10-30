"use client";

import {useEffect,useRef,useState} from "react";
import styles from "./workflow.module.css";

type Region={region_code:string;sido_name:string;region_name:string};
type Complex={id:string;name:string;legalDong?:string;matchStatus?:string};
type MapReady={complexId:string;complexName:string;regionName:string;stationName:string;straightDistanceMeters:number|null};

export default function JibssukAutoNaverMap({onReady,onClear}:{
  onReady:(data:MapReady)=>void;onClear:()=>void;
}){
  const [regions,setRegions]=useState<Region[]>([]);
  const [regionCode,setRegionCode]=useState("");
  const [query,setQuery]=useState("");
  const [candidates,setCandidates]=useState<Complex[]>([]);
  const [selected,setSelected]=useState<Complex|null>(null);
  const [mapUrl,setMapUrl]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [searching,setSearching]=useState(false);
  const mapBlob=useRef<Blob|null>(null);
  const urlRef=useRef("");
  const searchSequence=useRef(0);
  const mapSequence=useRef(0);

  function clearMap(){
    mapSequence.current+=1;setLoading(false);
    if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current="";}
    setMapUrl("");setSelected(null);mapBlob.current=null;onClear();
  }
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/apartment/regions",{signal:controller.signal,cache:"no-store"})
      .then(async res=>{
        const json=await res.json();
        if(!res.ok)throw new Error(json.error||"지역 목록을 가져오지 못했습니다.");
        setRegions(Array.isArray(json.regions)?json.regions:[]);
      }).catch(error=>{
        if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"지역 검색 준비에 실패했습니다.");
      });
    return ()=>{
      controller.abort();
      mapSequence.current+=1;
      if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current="";}
    };
  },[]);

  function switchRegion(value:string){
    searchSequence.current+=1;setSearching(false);setRegionCode(value);setCandidates([]);setQuery("");setMessage("");clearMap();
  }
  function switchQuery(value:string){
    searchSequence.current+=1;setSearching(false);setQuery(value);setCandidates([]);setMessage("");clearMap();
  }

  async function search(){
    const q=query.trim();
    if(!regionCode||q.length<2){setMessage("지역을 고른 뒤 단지명을 두 글자 이상 입력해 주세요.");return;}
    const sequence=++searchSequence.current;
    setSearching(true);setMessage("");setCandidates([]);clearMap();
    try{
      const url="/api/apartment/search?regionCode="+encodeURIComponent(regionCode)+"&q="+encodeURIComponent(q);
      const response=await fetch(url,{cache:"no-store"});
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||"단지 검색 실패");
      if(sequence!==searchSequence.current)return;
      const list=(Array.isArray(json.results)?json.results:[])
        .filter((row:Complex)=>typeof row.id==="string"&&typeof row.name==="string")
        .map((row:Complex)=>({id:row.id,name:row.name,legalDong:row.legalDong,matchStatus:row.matchStatus}));
      setCandidates(list);
      setMessage(list.length?"검색 결과에서 실제 단지를 선택해 주세요.":"검색된 단지가 없습니다. 지역·단지명을 확인하거나 수동 캡처를 사용하세요.");
    }catch(error){
      if(sequence===searchSequence.current)setMessage(error instanceof Error?error.message:"단지 검색에 실패했습니다.");
    }finally{if(sequence===searchSequence.current)setSearching(false);}
  }
  async function loadMap(complex:Complex){
    clearMap();setLoading(true);setMessage("기존 네이버지도 API로 단지 지도를 불러오는 중…");
    const sequence=++mapSequence.current;
    try{
      const res=await fetch("/api/apartment/map?complexId="+encodeURIComponent(complex.id),{cache:"no-store"});
      if(!res.ok){
        const data=await res.json().catch(()=>({}));
        throw new Error(data.error||"지도 생성에 실패했습니다.");
      }
      const blob=await res.blob();
      if(!blob.type.startsWith("image/"))throw new Error("지도 서버에서 이미지가 아닌 응답을 받았습니다.");
      if(sequence!==mapSequence.current)return;
      const url=URL.createObjectURL(blob);
      urlRef.current=url;mapBlob.current=blob;
      setMapUrl(url);setSelected(complex);
      const region=regions.find(x=>x.region_code===regionCode);
      const station=decodeURIComponent(res.headers.get("X-Map-Station")||"");
      const distanceRaw=res.headers.get("X-Map-Station-Distance")||"";
      const distance=distanceRaw&&Number.isFinite(Number(distanceRaw))?Number(distanceRaw):null;
      onReady({complexId:complex.id,complexName:complex.name,
        regionName:region?(region.sido_name+" "+region.region_name):"",
        stationName:station,straightDistanceMeters:distance});
      setMessage("네이버지도 자동 생성 완료 · 빨간 표식은 단지, 파란 표식은 검색된 역입니다. 실제 도보 경로는 제공하지 않습니다.");
    }catch(error){
      if(sequence===mapSequence.current)setMessage((error instanceof Error?error.message:"지도 생성 실패")+" 수동 네이버지도 캡처를 대신 사용하세요.");
    }finally{if(sequence===mapSequence.current)setLoading(false);}
  }
  async function copyMap(){
    if(!mapBlob.current)return;
    try{
      if(!mapBlob.current.type.startsWith("image/png"))throw new Error("PNG 지도 파일이 아닙니다.");
      // Some providers include a charset in Content-Type. The clipboard needs clean image/png.
      const blob=new Blob([await mapBlob.current.arrayBuffer()],{type:"image/png"});
      if(typeof ClipboardItem==="undefined"||!navigator.clipboard?.write)throw new Error("클립보드 이미지 복사가 지원되지 않습니다.");
      await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
      setMessage("네이버지도 PNG 복사 완료. ChatGPT에 이미지 01 요청서를 붙여넣은 뒤 Ctrl+V로 지도도 첨부하세요.");
    }catch{setMessage("지도 복사가 차단됐습니다. PNG 저장 후 ChatGPT에 이미지 파일을 첨부하세요.");}
  }
  function downloadMap(){
    if(!urlRef.current||!selected)return;
    const link=document.createElement("a");
    link.href=urlRef.current;
    link.download="jibssuk-naver-map-"+selected.id+".png";
    document.body.appendChild(link);link.click();link.remove();
  }
  return <div className={styles.autoNaverMap}>
    <div className={styles.autoNaverMapHeading}>
      <strong>01 · 네이버지도 자동 불러오기</strong>
      <span>기존 아파트 대량발행 API 재사용</span>
    </div>
    <p className={styles.hint}>아래에서 단지를 선택하면 기존 네이버 Static Map API가 실제 위치 지도를 준비합니다.
      원고의 단지명만으로 자동 확정하지 않고 직접 검색 결과를 선택합니다.</p>
    <div className={styles.autoNaverMapSearch}>
      <label>지역
        <select aria-label="지도 검색 지역" value={regionCode} onChange={e=>switchRegion(e.target.value)}>
          <option value="">지역 선택</option>
          {regions.map(region=><option key={region.region_code} value={region.region_code}>
            {region.sido_name} · {region.region_name}
          </option>)}
        </select>
      </label>
      <label>아파트 단지명
        <input aria-label="지도 단지 검색어" value={query} onChange={e=>switchQuery(e.target.value)}
          placeholder="예: 화서주공4단지" maxLength={120}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void search();}}}/>
      </label>
      <button type="button" className={styles.otherButton} onClick={()=>void search()}
        disabled={!regionCode||query.trim().length<2||searching}>{searching?"검색 중…":"단지 검색"}</button>
    </div>
    {candidates.length>0&&<div className={styles.autoNaverMapResults} aria-label="지도 검색된 단지">
      {candidates.map(complex=><button type="button" className={styles.otherButton}
        key={complex.id} disabled={loading} onClick={()=>void loadMap(complex)}>
        {complex.name}{complex.legalDong?" · "+complex.legalDong:""}
      </button>)}
    </div>}
    {message&&<p role="status" className={styles.autoMapMessage}>{message}</p>}
    {loading&&<p className={styles.hint}>네이버지도 이미지 가져오는 중…</p>}
    {mapUrl&&selected&&<div className={styles.autoNaverMapResult}>
      <div className={styles.autoNaverMapPreview}>
        <img src={mapUrl} alt={selected.name+" 네이버지도 API 지도 · 아파트 및 검색된 지하철역 마커"} />
      </div>
      <p className={styles.hint}>출처: NAVER Cloud Static Map · 위치 마커/역 위치는 API 조회 결과.
        파란 표식의 역은 지역 검색 후보이며 도보 거리·도보시간을 뜻하지 않습니다.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.mainButton} onClick={()=>void copyMap()}>지도 PNG 클립보드 복사</button>
        <button type="button" className={styles.otherButton} onClick={downloadMap}>지도 PNG 저장</button>
      </div>
    </div>}
    <details className={styles.details}>
      <summary>수동 캡처 사용 · 지도 자동 조회 실패 또는 실제 도보 경로가 필요할 때</summary>
      <p className={styles.hint}>기존 01번 이미지 요청서에 별도로 네이버지도 캡처를 첨부할 수 있습니다.
        도보 경로·소요시간은 Static Map에 표시되지 않으므로 실제 네이버지도 길찾기 캡처가 필요합니다.</p>
    </details>
  </div>;
}
