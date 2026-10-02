// One source of truth for the images needed by a completed daily article.
// Tables keep their source order; a chart is created only for a verified series table.
const LANDSCAPE = { width: 1600, height: 900 };

export function makeWorkImagePlan(tables = []) {
  const slots = [{
    slot: "00", kind: "thumbnail", label: "썸네일", role: "대표 썸네일",
    heading: "", tableIndex: null, width: 1254, height: 1254,
  }];

  if (tables.length) {
    tables.forEach((table, index) => {
      const kind = table.isTimeSeries ? "chart" : "table";
      slots.push({
        slot: index === 0 ? "01" : `01-${index + 1}`,
        kind,
        label: kind === "chart" ? "시세 그래프" : "표 이미지",
        role: kind === "chart" ? "검증된 기간별 시세 그래프" : "본문 표 데이터 이미지",
        heading: table.heading || (kind === "chart" ? "최근 시세 흐름" : "핵심 정보"),
        tableIndex: index,
        ...LANDSCAPE,
      });
    });
  } else {
    slots.push({
      slot: "01", kind: "summary", label: "핵심 정보", role: "본문 핵심 정보 이미지",
      heading: "", tableIndex: null, ...LANDSCAPE,
    });
  }

  slots.push({
    slot: "02", kind: "flow", label: "원인·흐름", role: "본문 원인·비교 이미지",
    heading: "", tableIndex: null, ...LANDSCAPE,
  });
  return slots;
}
