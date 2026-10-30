"use client";

import {useEffect,useRef,useState} from "react";
import styles from "./workflow.module.css";

type Region={region_code:string;sido_name:string;region_name:string};
type Complex={id:string;name:string;legalDong?:string;matchStatus?:string;source?:"naver"|"manual"|"verified"};
type Place={name:string;address:string;roadAddress:string;category:string;source:string;sourceUrl?:string};
type MapReady={complexId:string;complexName:string;regionName:string;stationName:string;straightDistanceMeters:number|null;mapAddress:string;sourceType:"db"|"naver"|"manual"|"verified";};

export default function JibssukAutoNaverMap({onReady,onClear}:{
  onReady:(data:MapReady)=>void;onClear:()=>void;
}){
  const [regions,setRegions]=useState<Region[]>([]);
  const [regionCode,setRegionCode]=useState("");
  const [query,setQuery]=useState("");
  const [manualAddress,setManualAddress]=useState("");
  const [manualExpanded,setManualExpanded]=useState(false);
  const [candidates,setCandidates]=useState<Complex[]>([]);
  const [places,setPlaces]=useState<Place[]>([]);
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
    searchSequence.current+=1;setSearching(false);setRegionCode(value);setCandidates([]);setPlaces([]);setQuery("");setManualAddress("");setManualExpanded(false);setMessage("");clearMap();
  }
  function switchQuery(value:string){
    searchSequence.current+=1;setSearching(false);setQuery(value);setCandidates([]);setPlaces([]);setMessage("");clearMap();
  }

  async function search(){
    const q=query.trim();
    if(q.length<2){setMessage("아파트 이름을 두 글자 이상 입력해 주세요.");return;}
    const sequence=++searchSequence.current;
    setSearching(true);setMessage("");setCandidates([]);setPlaces([]);clearMap();
    try{
      let dbList:Complex[]=[];
      if(regionCode){
        try{
          const dbUrl="/api/apartment/search?regionCode="+encodeURIComponent(regionCode)+"&q="+encodeURIComponent(q);
          const dbResponse=await fetch(dbUrl,{cache:"no-store"});
          const dbJson=await dbResponse.json();
          if(dbResponse.ok){
            dbList=(Array.isArray(dbJson.results)?dbJson.results:[])
              .filter((row:Complex)=>typeof row.id==="string"&&typeof row.name==="string")
              .map((row:Complex)=>({id:row.id,name:row.name,legalDong:row.legalDong,matchStatus:row.matchStatus}));
          }
        }catch{/* DB availability must not prevent searching NAVER places. */}
      }
      if(sequence!==searchSequence.current)return;
      setCandidates(dbList);
      if(dbList.length){
        setMessage("등록된 단지를 찾았습니다. 원하는 단지를 선택하면 지도가 바로 표시됩니다.");
        return;
      }
      const region=regions.find(x=>x.region_code===regionCode);
      const regionHint=region?(region.sido_name+" "+region.region_name):"";
      const placeUrl="/api/apartment/map-places?q="+encodeURIComponent(q)+
        (regionHint?"&region="+encodeURIComponent(regionHint):"");
      const response=await fetch(placeUrl,{cache:"no-store"});
      const json=await response.json();
      if(sequence!==searchSequence.current)return;
      if(!response.ok)throw new Error(json.error||"네이버 장소 검색 실패");
      const items=(Array.isArray(json.places)?json.places:[]).filter((p:Place)=>
        p&&typeof p.name==="string"&&typeof p.address==="string"&&typeof p.roadAddress==="string");
      setPlaces(items);
      if(!items.length)setManualExpanded(true);
      setMessage(items.length?(items.some((item:Place)=>Boolean(item.sourceUrl))?"공식 사업지 주소를 찾았습니다. 이 위치로 지도 보기를 누르세요.":"네이버 장소 검색에서 주소를 찾았습니다. 맞는 아파트를 선택해 주세요."):
        json.message||"장소를 찾지 못했습니다. 현장 주소를 직접 입력할 수 있습니다.");
    }catch(error){
      if(sequence===searchSequence.current){
        setManualExpanded(true);
        setMessage(error instanceof Error?error.message:"장소 검색에 실패했습니다. 주소 입력을 사용할 수 있습니다.");
      }
    }finally{if(sequence===searchSequence.current)setSearching(false);}
  }
  function selectPlace(place:Place){
    const address=place.roadAddress||place.address;
    if(!address)return;
    void loadMap({id:"",name:place.name,source:place.sourceUrl?"verified":"naver"},address);
  }
  async function loadMap(complex:Complex,address=""){
    clearMap();setLoading(true);setMessage("기존 네이버지도 API로 단지 지도를 불러오는 중…");
    const sequence=++mapSequence.current;
    try{
      const endpoint=address?"/api/apartment/map?address="+encodeURIComponent(address):"/api/apartment/map?complexId="+encodeURIComponent(complex.id);
      const res=await fetch(endpoint,{cache:"no-store"});
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
      onReady({complexId:complex.id,complexName:complex.name,sourceType:complex.id?"db":complex.source==="verified"?"verified":complex.source==="naver"?"naver":"manual",
        regionName:region?(region.sido_name+" "+region.region_name):"",
        stationName:station,straightDistanceMeters:distance,
        mapAddress:decodeURIComponent(res.headers.get("X-Map-Query")||"")});
      setMessage(address?(complex.source==="verified"?"공식 공사단지 안내 주소로 지도 준비 완료. 마커 위치를 확인하세요.":complex.source==="naver"?"네이버 장소 검색 결과로 지도 준비 완료. 단지명과 마커 위치가 일치하는지 확인하세요.":"입력한 주소로 네이버지도 준비 완료. 빨간 마커가 실제 해당 단지 위치인지 직접 확인하세요.")+" 도보 경로는 포함되지 않습니다.":"네이버지도 자동 생성 완료 · 빨간 표식은 단지, 파란 표식은 검색된 역입니다. 실제 도보 경로는 제공하지 않습니다.");
    }catch(error){
      if(sequence===mapSequence.current)setMessage((error instanceof Error?error.message:"지도 생성 실패")+" 수동 네이버지도 캡처를 대신 사용하세요.");
    }finally{if(sequence===mapSequence.current)setLoading(false);}
  }
  function loadAddress(){
    const address=manualAddress.trim();
    if(address.length<7 || !/[0-9]/.test(address)){
      setMessage("도로명 번호 또는 지번이 포함된 정확한 현장 주소를 입력해 주세요.");
      return;
    }
    const region=regions.find(x=>x.region_code===regionCode);
    // The candidate is explicitly identified as an address lookup, not a verified complex.
    const label=query.trim()||"주소 조회 지점";
    const displayName=region?label+" · "+region.region_name:label;
    void loadMap({id:"",name:displayName,source:"manual"},address);
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
    link.download="jibssuk-naver-map-"+(selected.id||"address")+".png";
    document.body.appendChild(link);link.click();link.remove();
  }
  return <div className={styles.autoNaverMap}>
    <div className={styles.autoNaverMapHeading}>
      <strong>01 · 네이버지도 자동 불러오기</strong>
      <span>기존 아파트 대량발행 API 재사용</span>
    </div>
    <p className={styles.hint}>아파트 이름만 입력하고 검색하세요. 등록된 단지는 기존 DB에서, 등록되지 않은 새 단지는 네이버 장소 검색으로 주소 후보를 찾아줍니다. 맞는 주소를 한 번 확인하면 지도가 바로 표시됩니다.</p>
    <div className={styles.autoNaverMapSearch}>
      <label>지역 (선택)
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
        disabled={query.trim().length<2||searching}>{searching?"네이버에서 찾는 중…":"주소 자동 찾기"}</button>
    </div>
    {candidates.length>0&&<div className={styles.autoNaverMapResults} aria-label="지도 검색된 단지">
      {candidates.map(complex=><button type="button" className={styles.otherButton}
        key={complex.id} disabled={loading} onClick={()=>void loadMap(complex)}>
        {complex.name}{complex.legalDong?" · "+complex.legalDong:""}
      </button>)}
    </div>}
    {places.length>0&&<div className={styles.autoNaverMapPlaces} aria-label="네이버에서 찾은 주소 후보">
      <p className={styles.hint}><b>네이버에서 찾은 주소 후보</b> · 주소를 확인한 다음 지도 보기를 누르세요.</p>
      {places.map((place,i)=><div key={place.name+"-"+place.address+"-"+i} className={styles.autoNaverMapPlace}>
        <div><strong>{place.name}</strong><span>{place.roadAddress||place.address}</span>
          {place.source&&<small>출처: {place.source}</small>}
          {place.sourceUrl&&<a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">공식 출처 확인</a>}
          {place.category&&<small>{place.category}</small>}</div>
        <button type="button" className={styles.mainButton} disabled={loading}
          onClick={()=>selectPlace(place)}>이 위치로 지도 보기</button>
      </div>)}
    </div>}
    <div className={styles.autoMapFallback}>
      <button type="button" className={styles.otherButton} aria-expanded={manualExpanded}
        onClick={()=>setManualExpanded(value=>!value)}>
        {manualExpanded?"주소 직접 입력 접기":"주소를 직접 입력하기 (자동 검색이 안 될 때)"}
      </button>
      {manualExpanded&&<div className={styles.autoMapManualInput}>
        <label htmlFor="jibssuk-map-manual-address">공식 안내문에 적힌 정확한 도로명·지번 주소
          <input id="jibssuk-map-manual-address" value={manualAddress} maxLength={160}
            placeholder="예: 경기도 ○○시 ○○동 123-4" onChange={e=>setManualAddress(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();loadAddress();}}}/>
        </label>
        <button type="button" className={styles.mainButton} disabled={loading||manualAddress.trim().length<7}
          onClick={loadAddress}>{loading?"불러오는 중…":"해당 주소 지도 보기"}</button>
        <p className={styles.hint}>자동 장소 검색에 없는 신규 분양 현장일 때만 사용합니다. 표시된 위치가 실제 사업지와 일치하는지 확인하세요.</p>
        <a href={"https://map.naver.com/p/search/"+encodeURIComponent(query.trim()||manualAddress.trim())}
          target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>네이버지도 원본 검색 열기 ↗</a>
      </div>}
    </div>
    {message&&<p role="status" className={styles.autoMapMessage}>{message}</p>}
    {loading&&<p className={styles.hint}>네이버지도 이미지 가져오는 중…</p>}
    {mapUrl&&selected&&<div className={styles.autoNaverMapResult}>
      <div className={styles.autoNaverMapPreview}>
        <img src={mapUrl} alt={selected.name+" 네이버지도 API 지도 · 아파트 및 검색된 지하철역 마커"} />
      </div>
      <p className={styles.hint}>출처: NAVER Cloud Static Map · {selected.id?"단지 DB 주소 기반":selected.source==="verified"?"공식 사업지 안내 주소 기반(위치 확인 필요)":selected.source==="naver"?"네이버 장소 검색에서 선택한 주소 기반(위치 확인 필요)":"직접 입력한 주소 기반(해당 단지 여부 확인 필요)"} · 위치 마커/역 위치는 API 조회 결과.
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
