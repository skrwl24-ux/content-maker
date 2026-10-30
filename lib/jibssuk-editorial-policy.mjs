// Shared only by the Jibssuk inline research, writer and image workflow.
export const JIBSSUK_READER_RULES = [
  '글감마다 독자가 클릭할 이유와 핵심 질문을 먼저 가설로 판단한다. 독자의 실제 심리를 측정한 것처럼 단정하지 않는다. 고정 분류나 필수 설문을 만들지 않는다.',
  '재건축은 달라진 내용과 현재 단계, 실거래는 같은 조건의 가격, 유명 단지는 실제 모습과 유명한 이유, 직장 근처는 출퇴근과 주거비, 재공급은 회차별 날짜·가구 수·사유·자격 등 주제에 관련된 궁금증만 다룬다.',
  '흥미는 숫자 비교뿐 아니라 사건의 배경·후속 과정·시간 차이·생활 모습·지역 변화·원문과 알려진 내용의 차이에도 있다. 발견이 없으면 독자가 궁금한 사실만 간결하게 전달한다. 억지 숫자 비교·반전 금지.',
  '구경하는 독자도 있다. 모든 글을 매수·매도·투자 조언으로 끝내지 않는다. 글마다 제목·도입·전개·마무리를 주제에 맞게 달리하며 반복 소식 도입·습관적인 질문·감탄·결론을 강요하지 않는다.',
  '편안한 블로그 서술은 가상 체험담이 아니다. 실제 취재 없이 직접 찾아봤더니·현장에 가보니 같은 행동이나 감정을 꾸미지 않는다. 큰따옴표 제목은 실제 인용으로 오해받지 않게 한다.',
].join('\n');
export const JIBSSUK_EVIDENCE_RULES = [
  '사실마다 원문 URL·제목·발행일, 사건/계약일(eventDate), 자료 확인 기준일(checkedAt), AI의 확인 주장(verificationStatus), 다른 자료와의 차이(comparisonNote)를 가능한 범위에서 기록한다. 누락은 미확인으로 남긴다.',
  '공시·공식 발표·인허가·실제 계약 등 1차 자료를 우선하고 언론 보도와 대조한다. 링크 존재나 AI의 확인 주장은 사이트의 검증 완료를 뜻하지 않는다. 원문을 실제 열지 않았으면 확인했다고 하지 않는다.',
  '이전 발표·현재 확정 상태·향후 계획, 선정·계약·승인·착공·준공을 구분한다. 같은 사건의 지분금액과 전체 사업비, 세금·범위·면적·계약일이 다른 숫자를 같은 조건으로 비교하지 않는다. 재공급은 최초 분양과 회차별 날짜·물량·사유를 분리한다.',
  '같은 면적 거래의 가격 차이가 있어도 층·향·상태 등 원인 자료가 없으면 이유를 단정하지 않는다. 계약만으로 갈등 해결을 주장하지 않는다.',
].join('\n');
export const JIBSSUK_TITLE_RULES = [
  '제목 작성 전후에 본문이 핵심 질문에 답하는지, 강조한 숫자·단위·비교 조건이 일치하는지 검사한다.',
  '이전 계획을 이번 새 발표처럼, 계획을 확정 결과처럼, 도급계약을 착공·준공처럼 쓰지 않는다. 확인되지 않은 원인을 사실로 설명하지 않는다. 오류가 있으면 제목이나 본문을 근거에 맞게 고친다.',
].join('\n');
export const JIBSSUK_RESEARCH_FIELDS = '독자의 클릭 이유는 readerIntent에 가설로 기록한다. discoveries에는 관련된 의미 있는 발견이 있을 때만 {title,readerQuestion,finding,whyItMatters,factIds,uncertainty}를 기록하고 없으면 빈 배열. angles에는 recommendationReason과 uncertainty를 기록한다. 수치 비교 사실에는 subject,metric,value,eventDate,scope를 가능한 범위에서 적는다.';

/** Select evidence without deleting the stored dossier or clipping claims/sources. */
export function selectJibssukWritingEvidence(report, selectedAngleId) {
  const angle=report.angles.find(a=>a.id===selectedAngleId);
  const required=new Set(angle?.factIds||[]);
  // Discoveries and unresolved differences must remain visible, including late rounds.
  const discoveries=report.discoveries||[];
  for(const d of discoveries)for(const id of d.factIds||[])required.add(id);
  for(const c of report.conflicts||[])for(const id of c.factIds||[])required.add(id);
  const core=report.facts.filter(f=>required.has(f.id));
  const optional=report.facts.filter(f=>!required.has(f.id));
  const relatedIds=new Set(report.angles.flatMap(a=>a.factIds||[]));
  const related=optional.filter(f=>relatedIds.has(f.id)).slice(0,8);
  const unassigned=optional.filter(f=>!relatedIds.has(f.id)).slice(0,2);
  const facts=[...core,...related,...unassigned];
  const included=new Set(facts.map(f=>f.id));
  return {...report,facts,omittedFactIds:report.facts.filter(f=>!included.has(f.id)).map(f=>f.id),evidenceSelectionNote:'선택 관점·발견 후보·충돌 근거는 전체 전달. 나머지는 보조 자료만 선택. 생략된 사실은 브라우저의 조사 이력·통합 보고서에 원문 그대로 보존된다. 필요하면 추가 조사 요청으로 원문을 확인한다.'};
}

/** Conservative local hints, never an automatic fact-verification verdict. */
export function checkJibssukTitleConsistency(title,body) {
  if(!title?.trim()||!body?.trim())return [];
  const warnings=[];
  const numbers=s=>Array.from(s.matchAll(/\d+(?:[,.]\d+)*\s*(?:억원|만원|조원|억|만원|원|층|가구|세대|㎡|%|개월)/g),m=>m[0].replace(/[\s,]/g,''));
  const inBody=new Set(numbers(body));
  const missing=[...new Set(numbers(title))].filter(n=>!inBody.has(n));
  if(missing.length)warnings.push('제목 수치 '+missing.join(', ')+'가 본문에서 같은 표기로 보이지 않습니다. 단위·환산·비교 조건을 확인해 주세요.');
  if(/착공|준공/.test(title)&&!/착공|준공/.test(body)&&/계약|계획|예정|선정|인가/.test(body))warnings.push('제목의 착공·준공과 본문에 설명된 사업 단계가 같은 사건인지 확인해 주세요.');
  if(/확정|완료/.test(title)&&/계획|예정|목표/.test(body)&&!/확정|완료/.test(body))warnings.push('본문은 계획·예정 상태를 설명합니다. 제목의 확정·완료 표현을 확인해 주세요.');
  return warnings;
}
