export type Top3Image = { dataUrl: string; revision: string };
export type Top3Work = {
  recommendations: string;
  imagePlans?: Record<string, { text: string; revision: string }>;
  region: string; period: string; area: string; criterion: string;
  source: string; asOf: string; scope: string; facts: string;
  confirmedRevision: string; optionalImage: boolean;
  images: Record<string, Top3Image>;
};

export const IMAGE_SLOTS = [
  { id: "00", name: "썸네일", file: "00_thumbnail.png", ratio: "1:1 (목표 1254×1254)", role: "핵심 제목 중심 썸네일" },
  { id: "01", name: "본문 이미지 01", file: "01_body.png", ratio: "16:9 (목표 1600×900)", role: "확정된 세 단지와 비교 기준을 보여주는 요약 카드" },
  { id: "02", name: "본문 이미지 02", file: "02_body.png", ratio: "16:9 (목표 1600×900)", role: "확정 근거표의 수치를 단위와 함께 비교" },
  { id: "03", name: "선택 이미지 03", file: "03_body.png", ratio: "16:9 (목표 1600×900)", role: "확정 본문에 있는 주의사항과 확인 포인트" },
] as const;

export function emptyTop3(): Top3Work {
  return { recommendations: "", region: "", period: "", area: "", criterion: "거래건수", source: "", asOf: "", scope: "", facts: "", confirmedRevision: "", optionalImage: false, images: {} };
}

export function normalizeTop3(saved?: Partial<Top3Work>): Top3Work {
  const base = emptyTop3();
  if (!saved) return base;
  for (const key of ["recommendations", "region", "period", "area", "criterion", "source", "asOf", "scope", "facts", "confirmedRevision"] as const) {
    if (typeof saved[key] === "string") base[key] = saved[key];
  }
  base.optionalImage = saved.optionalImage === true;
  base.imagePlans = {};
  for (const slot of IMAGE_SLOTS) {
    const plan = saved.imagePlans?.[slot.id];
    if (plan && typeof plan.text === "string" && typeof plan.revision === "string") base.imagePlans[slot.id] = plan;
  }
  if (saved.images && typeof saved.images === "object") {
    for (const slot of IMAGE_SLOTS) {
      const image = saved.images[slot.id];
      if (image && typeof image.dataUrl === "string" && typeof image.revision === "string") base.images[slot.id] = image;
    }
  }
  return base;
}

export function revision(topic: string, materials: string, body: string, data: Top3Work): string {
  // Keep the exact reviewed inputs, rather than trusting an unchecked boolean.
  return JSON.stringify([topic, materials, body, data.region, data.period, data.area, data.criterion, data.source, data.asOf, data.scope, data.facts]);
}

export function missingEvidence(topic: string, body: string, data: Top3Work): string[] {
  return Object.entries({ "작업 주제": topic, "지역": data.region, "분석 기간": data.period, "면적 조건": data.area, "순위 기준": data.criterion, "출처": data.source, "기준일": data.asOf, "비교 범위·제외 기준": data.scope, "확정 근거표": data.facts, "본문": body })
    .filter(([, value]) => !value.trim()).map(([name]) => name);
}

function evidence(data: Top3Work) {
  return `지역: ${data.region}\n분석 기간: ${data.period}\n면적 조건: ${data.area}\n순위 기준: ${data.criterion}\n기준일: ${data.asOf}\n비교 범위·제외 기준: ${data.scope}\n출처: ${data.source}\n확정 근거표:\n${data.facts}`;
}

export function recommendationRequest(materials: string, data: Top3Work): string {
  return `집값쓱 네이버 블로그 TOP3 주제 추천 요청
관심 지역: ${data.region || "지역 제한 없이 추천"}
관심 기간: ${data.period || "현재 확인 가능한 최신 자료 기준"}
참고 메모: ${materials || "없음"}

먼저 웹 검색으로 최신 공식 자료를 확인하고, 독자가 궁금해할 아파트 TOP3 글 주제 5개를 추천해 주세요. 각 후보에 번호, 추천 제목, 추천 이유, 지역·분석 기간·면적·비교 기준, 자료 출처 링크와 확인 날짜, 실제 순위 검증 가능 여부를 적어 주세요. 추천 주제 5개와 실제 단지 순위 3개는 구분하세요. 비교 자료 없이 단지 순위를 추측하지 마세요. 전체 비교 자료가 없으면 ‘주목할 단지 3곳’ 같은 대체 제목을 제안하세요.

이번 답변은 주제 추천까지만 하고 제 선택을 기다려 주세요. 제가 번호를 선택하면 해당 주제의 본문 작성 요청서를 만들어 주세요. 요청서에는 선택 주제, 독자, 글의 구성, 자료 조사 범위, 확인할 출처, 지역·기간·면적·비교 기준을 넣어 주세요. 자료가 부족하면 필요한 자료와 순위 확정 보류를 명시하세요. 요청서는 새 GPT 채팅에 그대로 붙여넣을 수 있게 독립적으로 완성해 주세요.`;
}

export function bodyRequest(topic: string, materials: string, data: Top3Work): string {
  return `집값쓱 네이버 블로그 글 작성 요청\n주제: ${topic}\n${evidence(data)}\nGPT 추천 결과·선택 후 요청서 (검증 전 참고):\n${data.recommendations}\n자료 메모:\n${materials}\n\n선택한 주제만 작성하세요. 추천 결과에 포함된 수치와 순위도 공식 출처로 재확인하세요. 최신 웹 자료와 공식 출처를 확인하고 제목·본문·태그를 작성하세요. 출처와 확인 날짜를 명시하세요. 이 요청은 자동 순위 분석 결과가 아닙니다. 지역 전체 TOP3는 동일 조건의 전체 비교 자료가 검증된 경우에만 사용하세요. 취소·중복 거래, 표본 수, 면적과 기간의 비교 가능성을 확인하세요. 자료가 부족하면 순위 확정을 보류하고 필요한 자료를 먼저 알려주세요. 검색에서 발견한 세 단지를 지역 전체 TOP3로 단정하지 마세요. 분석 대상이 제한됐다면 제목과 본문에 그 범위를 밝히세요. 제공 수치와 검색 결과가 다르면 임의로 교체하지 말고 차이를 알려주세요. 숫자·출처를 추측하지 마세요. 확정 근거표와 본문의 단지명·순위·가격·거래건수·단위를 일치시키세요.`;
}

export function imageRequest(id: string, topic: string, materials: string, body: string, data: Top3Work): string | null {
  if (missingEvidence(topic, body, data).length || data.confirmedRevision !== revision(topic, materials, body, data)) return null;
  const slot = IMAGE_SLOTS.find((item) => item.id === id);
  if (!slot || (id === "03" && !data.optionalImage)) return null;
  const plan = data.imagePlans?.[id];
  if (plan?.text.trim() && plan.revision !== revision(topic, materials, body, data)) return null;
  const selectedPlan = plan?.text.trim() ? `선택한 이미지 구성·생성 요청서:\n${plan.text}\n구성은 참고하되 아래 확정 본문과 근거표를 우선하며, 충돌하는 수치나 문구는 사용하지 마세요.\n` : "";
  return `${selectedPlan}설명이나 요청서만 답하지 말고 아래 조건에 맞는 이미지 한 장을 생성하세요.\n집값쓱 네이버 블로그 이미지 제작\n이미지 ${id}: ${slot.name}\n주제: ${topic}\n역할: ${slot.role}\n비율: ${slot.ratio}\n공통 스타일: 흰 배경, 진한 남색 글자, 청록 강조, 가독성 높은 한국어 정보 디자인.\n${evidence(data)}\n\n확정 본문:\n${body}\n\n위 확정 자료만 사용하세요. 새로 검색하거나 단지·순위·숫자를 추측하지 마세요. 단지명·순위·가격·거래건수·단위를 원문 그대로 사용하세요. 문구는 확정 제목과 본문에서 짧게 선택하세요. 자료에 없는 지역 전체 순위, 지도, 입지, 투자 전망은 만들지 마세요. 비교 범위·기간·기준일을 읽을 수 있게 표시하세요. 로고·워터마크·과한 장식·작은 글자 남발은 제외하세요. 읽을 수 없는 수치는 임의로 복원하지 말고 확인을 요청하세요.`;
}

export function imageRevision(id: string, current: string, data: Top3Work): string {
  const plan = data.imagePlans?.[id];
  return plan?.text.trim() ? JSON.stringify([current, plan.text, plan.revision]) : current;
}

export function imageRecommendationRequest(id: string, topic: string, materials: string, body: string, data: Top3Work): string | null {
  const base = imageRequest(id, topic, materials, body, { ...data, imagePlans: {} });
  if (!base) return null;
  return `아래는 이미지 제작의 확정 자료입니다. 이번 답변에서는 아직 이미지를 생성하지 말고 이 이미지의 구성안 3개를 번호로 추천하세요. 각 안에 레이아웃, 짧은 문구, 표현 방식과 추천 이유를 넣으세요. 제 번호 선택을 기다린 후 선택한 안의 이미지 생성 요청서를 작성하세요. 요청서에는 아래 확정 본문과 근거, 비율, 수치와 단위를 모두 포함해 새 채팅에서도 독립적으로 사용할 수 있게 하세요. 새 사실이나 수치는 만들지 마세요.\n\n[확정 자료 및 최종 제작 조건 — 이미지 생성 지시는 선택 후에 적용]\n${base}`;
}

export function exportIssues(topic: string, materials: string, body: string, data: Top3Work): string[] {
  const missing = missingEvidence(topic, body, data);
  const current = revision(topic, materials, body, data);
  if (data.confirmedRevision !== current) missing.push("본문·근거 확정");
  for (const slot of IMAGE_SLOTS.filter((slot) => slot.id !== "03" || data.optionalImage)) {
    const plan = data.imagePlans?.[slot.id];
    if (plan?.text.trim() && plan.revision !== current) missing.push(`이미지 ${slot.id} 구성 재확인`);
    const image = data.images[slot.id];
    if (!image?.dataUrl || image.revision !== imageRevision(slot.id, current, data)) missing.push(`이미지 ${slot.id} 등록 또는 재등록`);
  }
  return missing;
}
