export type Top3Image = { dataUrl: string; revision: string };
export type Top3Work = {
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
  return { region: "", period: "", area: "", criterion: "거래건수", source: "", asOf: "", scope: "", facts: "", confirmedRevision: "", optionalImage: false, images: {} };
}

export function normalizeTop3(saved?: Partial<Top3Work>): Top3Work {
  const base = emptyTop3();
  if (!saved) return base;
  for (const key of ["region", "period", "area", "criterion", "source", "asOf", "scope", "facts", "confirmedRevision"] as const) {
    if (typeof saved[key] === "string") base[key] = saved[key];
  }
  base.optionalImage = saved.optionalImage === true;
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

export function bodyRequest(topic: string, materials: string, data: Top3Work): string {
  return `집값쓱 네이버 블로그 글 작성 요청\n주제: ${topic}\n${evidence(data)}\n자료 메모:\n${materials}\n\n최신 웹 자료와 공식 출처를 확인하고 제목·본문·태그를 작성하세요. 출처와 확인 날짜를 명시하세요. 이 요청은 자동 순위 분석 결과가 아닙니다. 지역 전체 TOP3는 동일 조건의 전체 비교 자료가 검증된 경우에만 사용하세요. 취소·중복 거래, 표본 수, 면적과 기간의 비교 가능성을 확인하세요. 자료가 부족하면 순위 확정을 보류하고 필요한 자료를 먼저 알려주세요. 검색에서 발견한 세 단지를 지역 전체 TOP3로 단정하지 마세요. 분석 대상이 제한됐다면 제목과 본문에 그 범위를 밝히세요. 제공 수치와 검색 결과가 다르면 임의로 교체하지 말고 차이를 알려주세요. 숫자·출처를 추측하지 마세요. 확정 근거표와 본문의 단지명·순위·가격·거래건수·단위를 일치시키세요.`;
}

export function imageRequest(id: string, topic: string, materials: string, body: string, data: Top3Work): string | null {
  if (missingEvidence(topic, body, data).length || data.confirmedRevision !== revision(topic, materials, body, data)) return null;
  const slot = IMAGE_SLOTS.find((item) => item.id === id);
  if (!slot || (id === "03" && !data.optionalImage)) return null;
  return `집값쓱 네이버 블로그 이미지 제작\n이미지 ${id}: ${slot.name}\n주제: ${topic}\n역할: ${slot.role}\n비율: ${slot.ratio}\n공통 스타일: 흰 배경, 진한 남색 글자, 청록 강조, 가독성 높은 한국어 정보 디자인.\n${evidence(data)}\n\n확정 본문:\n${body}\n\n위 확정 자료만 사용하세요. 새로 검색하거나 단지·순위·숫자를 추측하지 마세요. 단지명·순위·가격·거래건수·단위를 원문 그대로 사용하세요. 문구는 확정 제목과 본문에서 짧게 선택하세요. 자료에 없는 지역 전체 순위, 지도, 입지, 투자 전망은 만들지 마세요. 비교 범위·기간·기준일을 읽을 수 있게 표시하세요. 로고·워터마크·과한 장식·작은 글자 남발은 제외하세요. 읽을 수 없는 수치는 임의로 복원하지 말고 확인을 요청하세요.`;
}

export function exportIssues(topic: string, materials: string, body: string, data: Top3Work): string[] {
  const missing = missingEvidence(topic, body, data);
  const current = revision(topic, materials, body, data);
  if (data.confirmedRevision !== current) missing.push("본문·근거 확정");
  for (const slot of IMAGE_SLOTS.filter((slot) => slot.id !== "03" || data.optionalImage)) {
    const image = data.images[slot.id];
    if (!image?.dataUrl || image.revision !== current) missing.push(`이미지 ${slot.id} 등록 또는 재등록`);
  }
  return missing;
}

