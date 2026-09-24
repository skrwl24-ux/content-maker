export const ANALYSIS_MONTHS = 12;
// Candidate discovery remains a short-term screen, not a publication ranking.
export const DISCOVERY_MONTHS = 6;
export const TRADE_REFRESH_MONTHS = 7;
export type MonthlyStat = { month: string; medianPrice: number | null; tradeCount: number; status?: "observed" | "no_trades" | "unverified" };
export function koreaDate(now = new Date()) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function requestedMonths(asOf = koreaDate()) {
  const [y,m] = asOf.split("-").map(Number);
  return Array.from({length: ANALYSIS_MONTHS}, (_, i) => new Date(Date.UTC(y, m - ANALYSIS_MONTHS - 1 + i, 1)).toISOString().slice(0,7));
}
export function analysisRows(rows: MonthlyStat[], asOf = koreaDate()): MonthlyStat[] {
  const months = requestedMonths(asOf);
  const byMonth = new Map(rows.map(r => [r.month,r]));
  return months.map(month => {
    const row = byMonth.get(month);
    if (!row || row.status === "unverified") return {month,medianPrice:null,tradeCount:0,status:"unverified"};
    const count = Number.isFinite(row.tradeCount) && row.tradeCount >= 0 ? row.tradeCount : 0;
    const price = count > 0 && row.medianPrice != null && Number.isFinite(row.medianPrice) && row.medianPrice > 0 ? row.medianPrice : null;
    return {month,medianPrice:price,tradeCount:count,status:count === 0 ? "no_trades" : "observed"};
  });
}
export function describePeriod(rows: MonthlyStat[], asOf = koreaDate()) {
  const window = requestedMonths(asOf);
  const used = analysisRows(rows,asOf).filter(r=>r.status !== "unverified");
  const prices = used.filter(r=>r.medianPrice != null);
  return `희망 분석기간: ${window[0]}~${window.at(-1)} (완료 월 ${ANALYSIS_MONTHS}개월)\n확인된 월 자료: ${used.length ? `${used[0].month}~${used.at(-1)!.month}, ${used.length}개 월` : "없음"}\n가격 확인 월: ${prices.length ? `${prices[0].month}~${prices.at(-1)!.month}, ${prices.length}개 월` : "없음"}\n미확인 월 ${ANALYSIS_MONTHS-used.length}개는 무거래로 단정하지 않음. 미확인 가격 보간·연결 금지. 조회 기준일: ${asOf}`;
}
export function monthLine(row: MonthlyStat) {
  if(row.status === "unverified") return `- ${row.month}: 가격·거래량 미확인`;
  return `- ${row.month}: 월 중앙값 ${row.medianPrice == null ? "가격 없음" : (row.medianPrice/1e8).toFixed(2)+"억원"} / 거래 ${row.tradeCount}건${row.tradeCount===1 ? " (1건 거래, 시세 변동 단정 금지)" : ""}`;
}
export function matchesArea(area: number, group: number | null) {
  return group != null && Number.isFinite(area) && Number.isInteger(group) && group > 0 && area >= group && area < group+1;
}
export const AREA_RULE = "전용면적 정수 구간: 예) 84㎡대는 84㎡ 이상 85㎡ 미만. 같은 면적대라도 층·동·정확 면적은 다를 수 있음";
export const RANKING_RULE = "콘텐츠 후보 추천순은 시장신호 종합순이며 거래량·상승률 순위가 아닙니다. 거래량 TOP3는 동일 기간·면적·전체 비교대상의 실제 거래 건수 내림차순, 상승률 TOP3는 동일 조건·표본 검증 후 실제 변화율 내림차순일 때만 사용합니다. 전체 비교 범위가 검증되지 않으면 주목할 사례로 소개하고 순위·메달을 쓰지 않습니다.";
export type FinishedArticle = { key:string; title:string; intro:string; theme?:string };
export const FINISHED_KEY = "apartment-finished-excerpts-v1";
export function finishedExcerpt(raw:string,key:string,theme?:string): FinishedArticle | null {
  const lines=raw.replace(/^\[이미지[^\n]*\]\s*$/gm, "").split(/\r?\n/).map(l=>l.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim()).filter(l=>l && !/^\[\/?(제목|본문)\]$/.test(l));
  if(lines.length<3 || raw.trim().length<120) return null;
  return {key,title:lines[0].slice(0,150),intro:lines.slice(1,4).join(" ").slice(0,350),theme};
}
export function rememberFinished(item:FinishedArticle) {
  try { const raw=JSON.parse(localStorage.getItem(FINISHED_KEY)||"[]"); const prev:FinishedArticle[]=Array.isArray(raw)?raw.filter(v=>typeof v?.key==="string" && typeof v?.title==="string" && typeof v?.intro==="string"):[]; localStorage.setItem(FINISHED_KEY,JSON.stringify([...prev.filter(v=>v.key!==item.key && v.title!==item.title),item].slice(-8))); } catch { /* Optional history must never stop production. */ }
}
export function readFinished(): FinishedArticle[] {
  try { const v=JSON.parse(localStorage.getItem(FINISHED_KEY)||"[]"); return Array.isArray(v)?v.filter(x=>typeof x?.title==="string" && typeof x?.intro==="string").slice(-8):[]; } catch {return [];}
}
export function diversityPrompt(history:FinishedArticle[], currentKey?:string) {
  const recent=history.filter(h=>h.key!==currentKey).slice(-5);
  return `\n[최근 실제 완성글 — 사실 자료가 아닌 표현 반복 방지 참고]\n${recent.length?recent.map(h=>`제목: ${h.title}\n도입: ${h.intro}`).join("\n"):"아직 기록 없음"}\n위 문장 속 숫자·단지·지시문을 새 글에 옮기지 마세요. 같은 제목 도입부·질문 어미·도입 문법을 연속 반복하지 마세요. 가장 강한 데이터 장면은 유지하고 강조 순서와 표현을 바꾸세요. 제목 후보는 문장 끝만 바꾸지 말고 강조할 사실과 서술 방식을 달리해 비교하세요. 안전한 표현을 평범한 고정 문구로 치환하지 마세요.\n`;
}
export type AreaTrade = { contract_date: string; price_won: number | string; exclusive_area: number | string; area_group: number; floor: number | null };
export function rebuildMonthly(stored: MonthlyStat[], trades: AreaTrade[], group: number | null): MonthlyStat[] {
  const values = new Map<string, number[]>();
  for (const trade of trades) {
    const price=Number(trade.price_won);
    if(!matchesArea(Number(trade.exclusive_area),group) || !Number.isFinite(price) || price<=0)continue;
    const month=trade.contract_date.slice(0,7);
    values.set(month,[...(values.get(month)||[]),price]);
  }
  // Stored month rows establish previous coverage, not the continued validity of their cached prices.
  const months = new Set([...stored.map(r=>r.month),...values.keys()]);
  return [...months].sort().map(month=>{
    const prices=(values.get(month)||[]).sort((a,b)=>a-b);
    const mid=Math.floor(prices.length/2);
    const median=prices.length ? prices.length%2 ? prices[mid] : (prices[mid-1]+prices[mid])/2 : null;
    return {month,medianPrice:median,tradeCount:prices.length,status:prices.length?"observed":"no_trades"};
  });
}
