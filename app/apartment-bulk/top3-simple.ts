import { IMAGE_SLOTS, Top3Work, revision, imageRevision } from "./top3-model";

export function articleRequest(topic: string, materials: string): string {
  return `집값쓱 네이버 블로그 TOP3 글을 만들어 주세요.
관심 주제·지역 (비어 있으면 직접 추천): ${topic}
참고 사항: ${materials}

최신 웹 검색과 공식 출처를 확인해 좋은 주제를 추천하고, 가장 적합한 하나를 직접 선정해 완성된 제목·본문·태그까지 한 번에 작성하세요. 선택 질문으로 멈추지 마세요. 추천 이유는 본문 앞에 짧게 적으세요. 비교 범위·기간·기준·출처 링크·확인 날짜를 본문에 포함하세요. 검색에서 찾은 세 단지를 지역 전체 TOP3라고 단정하거나 숫자를 추측하지 마세요. 순위 근거가 없으면 제목에는 ‘주목할 아파트 TOP3’를 사용하되 본문 도입에 통계상 상위 순위가 아닌 선정 사례 3곳임을 명확히 밝히고 선정 기준을 설명하세요.

주제 선정은 개별 아파트 단지를 중심으로 최근 3~6개월의 가격 변화·상승액·거래량 변화·저점 대비 반등 등 확인 가능한 흐름을 우선하세요. 자료에 따라 기간을 조정하고, 자치구별 주간 가격지수 순위는 사용자가 요청한 경우에만 선택하세요. 위 관심 주제·지역에 사용자가 명시한 요청만 우선하세요. 주간 통계를 요청하지 않았다면 자료를 찾기 쉽다는 이유로 자치구 주간 지수 기사로 대체하지 마세요. 단지 비교 순위의 근거가 부족하면 확인 가능한 단지 사례 3곳을 선정하고 순위가 아닌 사례 비교라고 밝히세요. 확인 가능한 사례도 부족하면 부족한 자료를 알려주고 숫자나 단지를 만들지 마세요.

제목은 분석 기간보다 자료에서 확인된 변화와 독자의 궁금증을 앞세우세요. '최근 6개월', '최근', '요즘'을 제목마다 기계적으로 붙이지 마세요. 최종 제목에는 ‘TOP3’를 반드시 한 번 포함하세요. 개수를 뜻하는 ‘3단지’, ‘세 단지’, ‘3곳’ 대신 제목에서는 ‘아파트 TOP3’를 사용하세요. 단, 실제 고유 단지명에 포함된 ‘3단지’는 임의로 바꾸지 마세요. 검증된 순위일 때만 ‘상승률 TOP3’, ‘거래량 TOP3’처럼 쓰고, 사례 선정 글은 ‘주목할 아파트 TOP3’로 표현하세요. TOP3 앞의 문장은 해당 자료의 특징에 맞춰 다양하게 작성하세요. 현재 가격 수준만 비교한 자료는 ‘가격대가 다르다’, ‘가격 차이’로 표현하고, 기간에 따른 변화 차이가 확인될 때만 ‘흐름이 갈렸다’라고 쓰세요. 거래 증가, 가격대 전환, 반등, 같은 지역 내 흐름 차이 등 해당 자료에 맞는 관점과 문장 구조를 선택하세요. '거래 몰렸다', '반등했다', '다시 ○억대' 같은 표현은 실제 비교 자료로 확인될 때만 쓰고, 근거 없는 급등·폭등·매수 유도 표현은 사용하지 마세요. 제목 후보를 내부적으로 비교해 가장 적합한 최종 제목 하나만 [제목]에 넣으세요. 정확한 분석 시작일·종료일과 자료 기준일은 본문에 명시하고, 그래프와 수치 비교 이미지에도 표시하세요. 썸네일은 최종 제목의 핵심 변화를 짧게 표현하되 새로운 주장을 추가하지 마세요.

이어서 이 본문에 필요한 이미지 항목을 작성하세요. 00은 썸네일, 01·02는 서로 다른 본문 이미지이며 03은 필요한 경우에만 추가하세요. 각 항목에는 사용할 정확한 문구·수치·단위, 구체적인 화면 구성, 본문과의 연결을 적으세요. 본문에 없는 사실은 추가하지 마세요. 이미지를 직접 생성하지는 마세요.

콘텐츠메이커에 답변 전체를 한 번에 붙여넣을 수 있도록 아래 구분자를 각 줄에 정확히 사용하세요. 제목에는 실제 제목만, 본문에는 발행할 완성 글·출처·태그만 넣으세요. 안내 문구나 생략 표시로 채우지 마세요. 필요 없는 이미지 03 구간은 통째로 생략하세요.
[제목]
완성 제목
[/제목]
[본문]
완성 본문과 출처 및 태그
[/본문]
[이미지 00]
썸네일 문구와 구성
[/이미지 00]
[이미지 01]
본문 이미지 01 문구와 구성
[/이미지 01]
[이미지 02]
본문 이미지 02 문구와 구성
[/이미지 02]
[이미지 03]
필요한 경우만 작성
[/이미지 03]`;
}

export function parseArticle(raw: string) {
  const read = (name: string) => {
    const open = `[${name}]`, close = `[/${name}]`;
    const start = raw.indexOf(open), end = raw.indexOf(close, start + open.length);
    if (start < 0 || end < 0 || raw.indexOf(open, start + open.length) >= 0) throw new Error(`${name} 구간을 확인해 주세요. GPT 요청서의 구분자를 포함해 답변 전체를 복사해 주세요.`);
    const value = raw.slice(start + open.length, end).trim();
    if (!value) throw new Error(`${name} 내용이 비어 있습니다.`);
    return value;
  };
  const topic = read("제목"), body = read("본문");
  const plans: Record<string, string> = {};
  for (const id of ["00", "01", "02"]) plans[id] = read(`이미지 ${id}`);
  if (raw.includes("[이미지 03]") || raw.includes("[/이미지 03]")) plans["03"] = read("이미지 03");
  return { topic, body: `${topic}\n\n${body}`, plans };
}

export function imageRequest(id: string, topic: string, materials: string, body: string, data: Top3Work): string | null {
  const slot = IMAGE_SLOTS.find(item => item.id === id);
  const plan = data.imagePlans?.[id]?.text.trim();
  if (!slot || !body.trim() || !plan || (id === "03" && !data.optionalImage)) return null;
  return `아래 내용에 맞는 이미지 한 장을 바로 생성하세요. 요청서나 설명만 작성하지 마세요.
이미지 ${id}: ${slot.name}
비율: ${slot.ratio}
주제: ${topic}
이 이미지에 필요한 내용·구성:
${plan}

참고 본문:
${body}

이 이미지 항목만 제작하세요. 다른 이미지 항목을 합치지 마세요. 본문과 항목에 있는 사실·수치·단위를 그대로 사용하고 새로 검색하거나 추측하지 마세요. 항목이 본문과 충돌하면 본문을 우선하세요. 한국어가 선명하고 읽기 쉬운 흰 배경·남색 글자·청록 강조 스타일로 통일하세요. 로고와 워터마크는 넣지 마세요.`;
}

export function exportIssues(topic: string, materials: string, body: string, data: Top3Work): string[] {
  const issues: string[] = [];
  if (!body.trim()) issues.push("본문 붙여넣기");
  const current = revision(topic, materials, body, data);
  for (const slot of IMAGE_SLOTS.filter(slot => slot.id !== "03" || data.optionalImage)) {
    if (!data.imagePlans?.[slot.id]?.text.trim()) issues.push(`이미지 ${slot.id} 내용`);
    if (!data.images[slot.id] || data.images[slot.id].revision !== imageRevision(slot.id, current, data)) issues.push(`이미지 ${slot.id} 등록 또는 재등록`);
  }
  return issues;
}
