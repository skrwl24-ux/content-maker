import {JIBSSUK_READER_RULES,JIBSSUK_EVIDENCE_RULES,JIBSSUK_RESEARCH_FIELDS} from "./jibssuk-editorial-policy.mjs";
import {normalizeJibssukCopiedReport} from "./jibssuk-simple-workflow.mjs";
// Jibssuk-only, lossless research ingestion. Other studios keep their existing parser.
export const MAX_RESEARCH_SIZE = 1500000;
const text = v => typeof v === 'string' ? v.trim() : '';
const array = v => Array.isArray(v) ? v : [];
const norm = v => text(v).normalize('NFC').replace(/\s+/g, ' ');
const url = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? v : ''; } catch { return ''; } };
const sourceKey = s => JSON.stringify([s.sourceUrl,s.sourceTitle,s.publishedAt]);
const unique = values => [...new Set(values)];
function allocate(requested, used, prefix) {
  let key = /^[a-z0-9_-]{1,80}$/i.test(requested || '') ? requested : prefix;
  const base = key; let i = 1;
  while (used.has(key)) key = base + '-' + i++;
  used.add(key); return key;
}
export function parseCumulativeReport(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_RESEARCH_SIZE) throw new Error('조사 결과가 너무 큽니다. 원본을 보관하고 회차를 나눠 가져오세요.');
  let content = raw.trim().replace(/^```(?:json|text)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
  const tagged = content.match(/\[(?:RESEARCH_REPORT_JSON|RESEARCH_ADDENDUM_JSON)\]([\s\S]*?)\[\/(?:RESEARCH_REPORT_JSON|RESEARCH_ADDENDUM_JSON)\]/i);
  if (tagged) content = tagged[1];
  let value;
  try { value = JSON.parse(content); } catch { try { value=JSON.parse(normalizeJibssukCopiedReport(raw)); } catch { throw new Error('조사 JSON 형식을 확인해 주세요. 기존 자료는 변경하지 않았습니다.'); } }
  if (!value || typeof value !== 'object' || !text(value.topic)) throw new Error('조사 주제가 없는 보고서입니다.');
  for (const field of ['facts','angles','gaps','trendLinks','discoveries','resolvedGaps']) {
    if (value[field] !== undefined && !Array.isArray(value[field])) throw new Error(field + ' 배열 형식을 확인해 주세요.');
  }
  const ids = new Set(), mapping = new Map();
  const facts = array(value.facts).map((f,i) => {
    if (!f || !text(f.claim)) throw new Error('내용이 없는 사실이 있습니다. 원본을 확인해 주세요.');
    if (f.id && mapping.has(f.id)) throw new Error('보고서 안의 사실 ID가 중복됩니다. 참조를 구분한 뒤 다시 가져오세요.');
    const id = allocate(f.id, ids, 'f'+(i+1)); mapping.set(f.id || id,id);
    const sources = [f,...array(f.sources)].map(s => ({sourceUrl:url(text(s.sourceUrl)),sourceTitle:text(s.sourceTitle),publishedAt:text(s.publishedAt)}));
    return {...f,id,claim:text(f.claim),sourceUrl:sources[0].sourceUrl,sourceTitle:sources[0].sourceTitle,publishedAt:sources[0].publishedAt,sources:[...new Map(sources.map(s=>[sourceKey(s),s])).values()]};
  });
  const angleIds = new Set();
  const refs = v => array(v).map(id => { if (!mapping.has(id)) throw new Error('존재하지 않는 사실 ID 참조: '+id); return mapping.get(id); });
  const angles = array(value.angles).map((a,i) => {
    if (!a || !text(a.title)) throw new Error('관점 제목을 확인해 주세요.');
    return {...a,id:allocate(a.id,angleIds,'a'+(i+1)),title:text(a.title),readerQuestion:text(a.readerQuestion),uniqueValue:text(a.uniqueValue),factIds:refs(a.factIds)};
  });
  const discoveries = array(value.discoveries).map(d => {
    if (!d || !text(d.title)) throw new Error('발견 후보 제목을 확인해 주세요.');
    return {...d,title:text(d.title),factIds:refs(d.factIds)};
  });
  if(array(value.gaps).some(g=>typeof g!=='string'))throw new Error('미해결 질문은 문자열 배열이어야 합니다.');
  const resolvedGaps=array(value.resolvedGaps).map(g=>typeof g==='string'?g:{...g,factIds:refs(g?.factIds)});
  if (!facts.length && !angles.length && !array(value.gaps).length) throw new Error('조사 내용이 비어 있습니다.');
  return {...value,topic:text(value.topic),checkedAt:text(value.checkedAt),summary:text(value.summary),facts,angles,gaps:array(value.gaps),trendLinks:array(value.trendLinks),discoveries,resolvedGaps};
}
export function mergeResearchReports(base, incoming) {
  const result = structuredClone(base);
  const stats = {added:0,duplicates:0,sources:0,conflicts:0};
  const used = new Set(result.facts.map(f=>f.id)), refs = new Map();
  result.conflicts = result.conflicts || [];
  for (const fact of incoming.facts) {
    // Exact statement + event context only. Similar prose is deliberately retained.
    const existing = result.facts.find(f => norm(f.claim) === norm(fact.claim) && norm(f.eventDate) === norm(fact.eventDate) && norm(f.subject) === norm(fact.subject) && norm(f.metric) === norm(fact.metric) && norm(f.scope) === norm(fact.scope) && norm(f.value) === norm(fact.value) && !(f.sourceUrl === fact.sourceUrl && f.publishedAt && fact.publishedAt && f.publishedAt !== fact.publishedAt));
    if (existing) {
      refs.set(fact.id, existing.id); stats.duplicates++;
      const sources = existing.sources || [{sourceUrl:existing.sourceUrl,sourceTitle:existing.sourceTitle,publishedAt:existing.publishedAt}];
      const keys = new Set(sources.map(sourceKey));
      for (const s of fact.sources || [fact]) if (!keys.has(sourceKey(s))) { sources.push(s); keys.add(sourceKey(s)); if(s.sourceUrl)stats.sources++; }
      existing.sources = sources;
      if (!existing.sourceUrl && fact.sourceUrl) Object.assign(existing,{sourceUrl:fact.sourceUrl,sourceTitle:fact.sourceTitle,publishedAt:fact.publishedAt});
    } else {
      const id = allocate(fact.id,used,'f'); refs.set(fact.id,id);
      result.facts.push({...fact,id}); stats.added++;
    }
  }
  const remap = a => ({...a,factIds:unique(array(a.factIds).map(id=>refs.get(id)).filter(Boolean))});
  const angleIds = new Set(result.angles.map(a=>a.id));
  for (const a of incoming.angles) {
    const mapped = remap(a);
    const old = result.angles.find(x=>norm(x.title)===norm(a.title)&&norm(x.readerQuestion)===norm(a.readerQuestion)&&norm(x.uniqueValue)===norm(a.uniqueValue));
    if (old) old.factIds = unique([...old.factIds,...mapped.factIds]);
    else result.angles.push({...mapped,id:allocate(a.id,angleIds,'a')});
  }
  result.gaps = unique([...result.gaps,...incoming.gaps]);
  result.trendLinks = [...new Map([...result.trendLinks,...incoming.trendLinks].map(v=>[JSON.stringify(v),v])).values()];
  result.discoveries = [...(result.discoveries||[]),...array(incoming.discoveries).map(remap)].filter((d,i,all)=>all.findIndex(x=>JSON.stringify(x)===JSON.stringify(d))===i);
  result.resolvedGaps = [...(result.resolvedGaps||[]),...array(incoming.resolvedGaps).map(g=>g&&typeof g==='object'?remap(g):g)].filter((d,i,all)=>all.findIndex(x=>JSON.stringify(x)===JSON.stringify(d))===i);
  // Explicit event/metric/value comparisons avoid confusing a share amount with total cost.
  const conflictKeys = new Set(result.conflicts.map(c=>[...c.factIds].sort().join('|')));
  for(let i=0;i<result.facts.length;i++)for(let j=i+1;j<result.facts.length;j++) {
    const a=result.facts[i],b=result.facts[j];
    const structuredDifference=a.subject&&a.metric&&a.value&&b.value&&a.subject===b.subject&&a.metric===b.metric&&text(a.eventDate)===text(b.eventDate)&&text(a.scope)===text(b.scope)&&norm(a.value)!==norm(b.value);
    // Legacy reports: only flag identical sentence templates with differing numbers,
    // never decide which is correct. Distinct event dates are not merged.
    const skeleton=v=>norm(v).replace(/\d+(?:[.,]\d+)*/g,'#');
    const legacyDifference=!a.metric&&!b.metric&&/\d/.test(a.claim)&&/\d/.test(b.claim)&&norm(a.claim)!==norm(b.claim)&&skeleton(a.claim)===skeleton(b.claim)&&text(a.eventDate)===text(b.eventDate)&&text(a.scope)===text(b.scope);
    if(!structuredDifference&&!legacyDifference)continue;
    const key=[a.id,b.id].sort().join('|');
    if(!conflictKeys.has(key)){result.conflicts.push({factIds:[a.id,b.id],status:'확인 필요',reason:'동일 대상·사건·항목의 값이 다름. 원자료와 비교 조건 확인 필요'});conflictKeys.add(key);stats.conflicts++;}
  }
  result.summary = unique([result.summary,incoming.summary].filter(Boolean)).join('\n\n');
  result.checkedAt = incoming.checkedAt || result.checkedAt;
  return {report:result,stats};
}
export function createResearchHistory(raw, selectedAngleId='') {
  const report=parseCumulativeReport(raw);
  return {version:1,originalReport:raw,rounds:[],activeRounds:0,selectedAngleId:selectedAngleId||report.angles[0]?.id||'',mergedReport:report,updatedAt:new Date().toISOString(),stats:null};
}
export function restoreResearchHistory(history,count) {
  if(!Number.isInteger(count)||count<0||count>history.rounds.length)throw new Error('복원 회차가 올바르지 않습니다.');
  let report=parseCumulativeReport(history.originalReport),stats=null;
  for(const round of history.rounds.slice(0,count)){const merged=mergeResearchReports(report,parseCumulativeReport(round.raw));report=merged.report;stats=merged.stats;}
  return {...history,activeRounds:count,mergedReport:report,stats,updatedAt:new Date().toISOString()};
}
export function appendResearchRound(history,raw) {
  const merged=mergeResearchReports(history.mergedReport,parseCumulativeReport(raw));
  // Restoring a past view preserves every later original round.
  const rounds=[...history.rounds,{raw,createdAt:new Date().toISOString()}];
  if(history.activeRounds!==history.rounds.length)throw new Error('이전 상태를 보는 중입니다. 최신 상태로 돌아온 뒤 추가 조사를 가져오세요.');
  const next={...history,rounds,activeRounds:rounds.length,mergedReport:merged.report,stats:merged.stats,updatedAt:new Date().toISOString()};
  if(JSON.stringify(next).length>MAX_RESEARCH_SIZE)throw new Error('조사 저장 한도에 도달했습니다. 이력을 내려받아 보관해 주세요. 기존 자료는 유지됩니다.');
  return next;
}
export function buildJibssukFollowupPrompt({report,selectedAngleId='',topic='',today=''}) {
  const angle=report.angles.find(a=>a.id===selectedAngleId);
  return [JIBSSUK_READER_RULES,JIBSSUK_EVIDENCE_RULES,JIBSSUK_RESEARCH_FIELDS,'집값쓱 추가 조사. 기존 보고서를 재작성하지 말고 새 사실·새 출처·발견 후보만 반환한다.',
    '주제: '+(topic||report.topic),'기준일: '+today,'선택한 관점 유지: '+JSON.stringify(angle||null),
    '첫 기사와 과거·후속 발표를 비교한다. 관련된 경우만 계획/승인, 시공사 선정/도급계약/착공, 계약 지분금액/전체 사업비, 세금·범위·면적·계약일을 구분한다. 이견 보도가 있어도 계약 체결만으로 갈등 해결을 주장하지 않는다.',
    '독자의 핵심 질문과 직접 답, 놓치기 쉬운 차이·전후 사건을 찾는다. 의미 있는 발견 1~2개를 근거 factIds와 함께 discoveries에 기록한다. 없으면 빈 배열. 억지 반전 금지.',
    '같은 사건의 다른 금액·날짜는 원자료로 비교하고 확인 전에는 한쪽을 삭제하지 않는다. 각 사실의 subject(대상), metric(비교 항목), value(값), eventDate(사건일), scope(세금·지분 등 비교 조건)를 가능한 범위에서 명시한다.',
    '해결한 질문은 resolvedGaps에 {question, factIds, reason}으로 보고하되 사이트가 자동 검증한 사실이 아니다. 원문을 열 수 없으면 확인했다고 하지 않는다.',
    '[누적 자료 — 미검증, 출처·날짜 포함]',JSON.stringify(report),
    '아래 태그를 포함해 하나의 text 코드블록으로 반환한다. factIds는 이번 응답 facts의 ID만 참조한다. 기존 전체 RESEARCH_REPORT_JSON도 호환되지만 신규 자료 중심으로 작성한다.',
    '[RESEARCH_ADDENDUM_JSON]',JSON.stringify({topic:topic||report.topic,checkedAt:today,summary:'추가 조사 요약',facts:[{id:'f1',claim:'실제 조사 사실',sourceUrl:'',sourceTitle:'',publishedAt:'',subject:'',metric:'',value:'',eventDate:'',scope:''}],angles:[],discoveries:[],gaps:[],resolvedGaps:[],trendLinks:[]},null,2),'[/RESEARCH_ADDENDUM_JSON]'].join('\n\n');
}
