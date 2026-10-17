export const PARAMMA_V4_SLOTS = [
  { id: "00", role: "대표 썸네일", scene: "핵심 질문을 보여주는 대표 사진 또는 편집 썸네일" },
  { id: "01", role: "첫 장면", scene: "독자의 실제 생활이나 현상을 보여주는 도입 장면" },
  { id: "02", role: "핵심 원리", scene: "왜 그런지 가장 중요한 원인이나 구조를 설명하는 장면" },
  { id: "03", role: "실제 모습·사례", scene: "원리가 실제로 나타나는 구체적인 상황이나 관찰 사진" },
  { id: "04", role: "상황 비교", scene: "다른 조건에서 나타나는 차이나 판단 기준을 비교하는 장면" },
  { id: "05", role: "이번 글의 발견·보상", scene: "독자가 가져갈 검증된 실용 방법 또는 새로운 발견" },
  { id: "06", role: "추가 정보", scene: "예방·비용·주의점·관찰 요령 등 추가로 유용한 사실" },
  { id: "07", role: "오해 해소·마무리", scene: "오해·한계 또는 주제를 마무리하는 독립적인 사실" },
];

export function parammaV4Count(value) {
  const count = Number(value);
  return count === 6 || count === 7 || count === 8 ? count : 7;
}

export function parammaActiveSlots(version, imageCount, optional03 = false) {
  if (version !== "v4") return optional03 ? ["00","01","02","03"] : ["00","01","02"];
  return PARAMMA_V4_SLOTS.slice(0, parammaV4Count(imageCount)).map((item) => item.id);
}

export function parammaV4MissingMarkers(raw, imageCount) {
  const source = String(raw || "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const ending = lines.findIndex((line) => {
    const normalized = line.replace(/^\s*#{1,6}\s+/, "").trim()
      .replace(/^\[/, "").replace(/\]$/, "").trim();
    return /^(?:이미지\s*기획\s*메모|검수\s*메모)(?:\s*[:：].*)?$/.test(normalized);
  });
  const article = (ending >= 0 ? lines.slice(0, ending) : lines).join("\n");
  return parammaActiveSlots("v4", imageCount).filter((id) => id !== "00" &&
    !new RegExp("\\[이미지\\s*" + id + "\\]", "i").test(article));
}

export function buildParammaV4ArticlePrompt(topic, imageCount, date) {
  const slots = parammaActiveSlots("v4", imageCount);
  const plans = PARAMMA_V4_SLOTS.filter((s) => slots.includes(s.id))
    .map((s) => "- 이미지 " + s.id + ": " + s.role + " — " + s.scene).join("\n");
  const markers = slots.filter((id) => id !== "00").map((id) => "[이미지 " + id + "]").join(", ");
  return `Paramma 네이버 블로그용 사진 중심 스토리형(V4) 최종 발행 원고를 작성해줘.

[기준일]
${date}

[기획]
카테고리: ${topic.category}
주제: ${topic.title}
기획 의도: ${topic.brief}
대표 썸네일 후킹 문구: ${topic.thumbnailHook}

[필수 사실 확인]
- 먼저 최신 웹 검색으로 공식기관·논문·공공자료·제조사 등 신뢰할 수 있는 근거를 확인한다.
- 시간·가격·자격·제품 수치·효과는 임의 생성하지 않는다.
- 실제 사건이나 직접 촬영했다는 허위 경험담을 작성하지 않는다.
- 사진으로 표현할 수 없는 추상적 사실은 원리 그림이나 정보 카드로 제안한다.
- 타인의 보도 사진을 허가 없이 사용하는 방식은 권장하지 않는다.

[V4 · 사진 중심 스토리텔링]
- 이 글에는 썸네일 포함 이미지 ${slots.length}장을 사용한다. 본문 이미지 ${slots.length - 1}장이다.
- 실제 생활 장면 → 핵심 원리 → 사례 → 비교 → 발견·실용 보상 → 필요한 주의점 순서로 자연스럽게 이어간다.
- 각 이미지 사이에는 독자가 사진만 따라가도 이해되도록 짧은 설명 2~3줄(대체로 1~3문장)을 쓴다.
- 설명을 너무 줄여 핵심 사실이나 실용 방법이 빠져서는 안 된다. 필요한 부분만 짧은 추가 문단을 허용한다.
- 각 이미지는 서로 다른 정보와 장면을 맡는다. 장수만 채우기 위해 사진을 반복하거나 없는 사실을 넣지 않는다.
- 실제 사진에 적합한 장면은 '사진 검색 추천', 구조·원리·비교는 'AI 설명 이미지 추천'으로 구분한다.
- 제목은 검색형으로 자연스럽고 호기심을 자극하되 과장하지 않는다.
- 소제목은 반드시 ## 소제목 형식으로, 3~5개 이내에서 필요한 경우 사용한다.
- 강조 문장은 **강조** 형태로 꼭 필요한 1~3곳만 사용한다.
- 네이버 본문 글자 15, 제목 32, 소제목 30, 강조 19를 고려한다.
- 문단 사이에는 빈 줄 한 줄을 둔다. 해시태그는 마지막에 8~12개만 넣는다.
- 글 끝은 허술한 감상문 대신 유용한 결론으로 짧게 마무리한다.

[장면 설계 — 순서와 역할 고정]
${plans}

[이미지 위치]
- 이미지 00은 썸네일용이므로 본문에 [이미지 00]을 넣지 않는다.
- 본문에는 정확히 다음 표시를 오름차순으로 각각 한 번만 삽입: ${markers}
- 각 [이미지 NN] 바로 앞이나 뒤에 해당 장면에 어울리는 짧은 설명을 배치한다.
- 실제 사진 URL을 지어내지 말고, 사진 검색 시 사용할 구체적인 장면 설명만 기획한다.

[최종 출력]
1. 최종 제목 (맨 처음 한 줄)
2. 네이버 본문: 이미지 표시와 2~3줄 설명이 교대로 이어지는 구성
3. 태그 한 줄
4. [이미지 기획 메모]
${plans}
   각 줄 끝에 '사진 검색 추천' 또는 'AI 설명 이미지 추천'과 실제 담을 사실·피사체를 한 줄로 구체화할 것.
5. [검수 메모]: 정확한 공식 출처와 확인한 핵심 사실을 짧게 기록한다. 메모 내용은 발행 본문에 포함하지 않는다.

반드시 조사 후 작성하고, 00~${String(slots.length-1).padStart(2,"0")} 슬롯을 빠짐없이 독립된 장면으로 기획해줘.`;
}

export function buildParammaV4ImagePrompt(topic, slot, plan = "") {
  const info = PARAMMA_V4_SLOTS.find((item) => item.id === slot);
  if (!info) return "";
  const thumbnail = slot === "00";
  return `Paramma 네이버 블로그용 이미지 정확히 1장 제작해줘.

[주제] ${topic.title}
[카테고리] ${topic.category}
[이미지 슬롯] ${slot} · ${info.role}
[이미지 역할] ${info.scene}
[최종 원고에서 확인된 구체적인 장면 기획]
${plan || "해당 슬롯의 원고와 확인된 자료를 바탕으로 장면을 구성. 원고가 아직 없으면 사실을 추가하지 않음."}

[출력] ${thumbnail ? "1254×1254 정사각형 썸네일" : "1600×900, 16:9 단일 본문 사진/이미지"} 1장만 제작한다.
${thumbnail ? "[썸네일 짧은 문구] " + topic.thumbnailHook : "- 본문 사진처럼 자연스럽게 보이도록 구성하고 큰 제목·과도한 카드형 레이아웃을 피한다."}
- 실제 사진이 적합하면 사실적인 한 장면으로, 원리·수치·비교가 필요하면 절제된 정보형 이미지로 표현한다.
- 실제 사건의 현장 사진처럼 허위 묘사하지 않는다. 실제 자료와 AI 재현을 명확하게 구분한다.
- 과한 네온, 유리효과, 3D, 작은 글씨·장식 금지.
- 원문에 없는 수치·의학적 효능·사진 출처·브랜드 로고를 지어내지 않는다.
- 이 슬롯의 장면만 그리며 앞뒤 장면과 중복하지 않는다.`;
}
