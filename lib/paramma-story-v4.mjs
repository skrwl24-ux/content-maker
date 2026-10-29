import { appendParammaQuotedHeadlineRules } from "./paramma-quote-headline.mjs";

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

export const PARAMMA_V4_DISCOVERY_BLOCK = `[V4 · 발견을 따라가는 혼잣말 편집 원칙]
- 이 글의 가장 흥미로운 사실 하나를 먼저 고른다. 독자가 일반적인 AI 요약에서는 놓칠 법한 숫자·차이·의외의 원리·실제 상황을 근거에서 찾는다.
- 뉴스를 전달하거나 설명서를 읽는 말투보다, 그 사실을 우연히 알아차리고 혼자 곱씹듯 자연스럽게 풀어낸다. 독자에게 강의하지 않는다.
- 시작할 때는 독자가 가장 궁금해할 답과 함께 눈길이 가는 발견을 보여준다. 뒤로 갈수록 왜 그런지 확인된 근거를 따라간다.
- '잠깐, 이게 왜 그렇지?' 같은 생각이나 짧은 혼잣말은 장면에 어울릴 때만 쓴다. 매번 같은 질문·감탄·반전으로 시작하지 않는다.
- 직접 취재·실험·관찰한 것처럼 꾸미지 않는다. 출처에서 확인한 사실을 발견한 사람의 관찰자 목소리로 쓴다.
- 이미지 슬롯 번호와 이미지 기획 메모 형식은 그대로 지키되, 똑같은 설명을 여러 장에 나눠 채우지 않는다. 각 장면은 다른 정보를 보여준다.
- 본문은 실제로 이야기하듯 이어지는 문단으로 쓴다. 모바일 가독성을 챙기되 문장마다 줄을 끊는 기계적인 줄바꿈은 피한다.
- 자료에 특별한 발견이 없으면 질문의 답을 정확하고 간결하게 전달한다. 억지 결론이나 반복 요약으로 글을 늘리지 않는다.`;

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
  return appendParammaQuotedHeadlineRules(`Paramma 네이버 블로그용 사진 중심 스토리형(V4) 최종 발행 원고를 작성해줘.

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
- [모바일 수동 줄바꿈 · 최우선] 일반 본문은 한 줄에 한글 약 15~20자(공백 포함) 안팎을 목표로 작성한다. 화면 자동 줄바꿈에 맡기지 말고 의미가 자연스럽게 이어지는 구간에서 미리 엔터로 줄을 나눈다.
- 1~2개의 짧은 줄을 하나의 문단으로 묶고 문단 사이에는 실제 빈 줄 한 줄을 둔다. 긴 문장은 먼저 쉬운 문장으로 고친 뒤 줄을 나누며, 단어나 조사만 덩그러니 남기는 기계적인 글자 수 자르기는 금지한다.
- 사람에게 이야기하듯 친근한 말투로 질문 → 쉬운 설명 → 발견의 흐름을 만든다. 제목·소제목·해시태그·이미지 표시는 길이 제한 대상이 아니다.
- 긴 고유명사·정확한 숫자와 단위는 중간에 자르지 않는다. 한 줄 기준보다 사실의 정확성과 자연스러운 문장 흐름을 우선한다. 가운데 정렬은 운영자가 네이버 편집기에서 직접 적용하므로 HTML이나 정렬 태그는 쓰지 않는다.
- 각 [이미지 NN] 표시는 독립된 줄에 놓고, 이미지 뒤의 설명은 1~2개 짧은 문단으로 제한하되 필요한 사실 설명은 생략하지 않는다.
- 설명을 너무 줄여 핵심 사실이나 실용 방법이 빠져서는 안 된다. 필요한 부분만 짧은 추가 문단을 허용한다.
- 각 이미지는 서로 다른 정보와 장면을 맡는다. 장수만 채우기 위해 사진을 반복하거나 없는 사실을 넣지 않는다.
- 실제 사진에 적합한 장면은 '사진 검색 추천', 구조·원리·비교는 'AI 설명 이미지 추천'으로 구분한다.
- 제목은 검색형으로 자연스럽고 호기심을 자극하되 과장하지 않는다.
- 소제목은 반드시 ## 소제목 형식으로, 3~5개 이내에서 필요한 경우 사용한다.
- 강조 문장은 **강조** 형태로 꼭 필요한 1~3곳만 사용한다.
- 네이버 본문 글자 15, 제목 32, 소제목 30, 강조 19를 고려한다.
- 문단 사이에는 실제 빈 줄 한 줄을 둔다. 공백만 채운 빈 줄이나 &#x20;·&nbsp; 같은 HTML 엔티티, 불필요한 역슬래시를 출력하지 않는다.
- 'image', '사진 삭제', 'AI 활용 설정', '사진 설명을 입력하세요' 등 네이버 편집기 안내 문구나 임의 사진 URL은 본문에 넣지 않는다.
- 해시태그는 마지막에 8~12개만 넣는다.
- 글 끝은 허술한 감상문 대신 유용한 결론으로 짧게 마무리한다.

${PARAMMA_V4_DISCOVERY_BLOCK}

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

반드시 조사 후 작성하고, 00~${String(slots.length-1).padStart(2,"0")} 슬롯을 빠짐없이 독립된 장면으로 기획해줘.`);
}

// Pull only the article passage associated with a slot, never planning/source notes.
export function extractParammaV4ImageContext(raw, slot) {
  const lines = String(raw || "").replace(/\r\n?/g, "\n").split("\n");
  const sectionEnd = lines.findIndex((line) =>
    /^\s*(?:#{1,6}\s*)?\[?\s*(?:이미지\s*기획\s*메모|검수\s*메모)\s*\]?\s*$/.test(line));
  const body = sectionEnd >= 0 ? lines.slice(0, sectionEnd) : lines;
  const markers = body.flatMap((line, index) => {
    const match = line.match(/^\s*\[이미지\s*(0[1-7])\]/i);
    return match ? [{ id: match[1], index }] : [];
  });
  const current = slot === "00" ? { index: -1 } : markers.find((item) => item.id === slot);
  if (!current) return "";
  const next = markers.find((item) => item.index > current.index);
  const end = next?.index ?? body.length;
  // Especially for the last slot, FAQ and references are not image context.
  const faqIndex = body.findIndex((line, i) => i > current.index &&
    /^\s*(?:#{1,6}\s*)?(?:자주\s*묻는\s*질문|FAQ|참고\s*(?:자료|출처)|공식\s*출처)(?:\s*[:：].*)?\s*$/i.test(line));
  const cutoff = faqIndex >= 0 ? Math.min(end, faqIndex) : end;
  const excerpt = body.slice(current.index + 1, cutoff)
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s/.test(line) &&
      !/^\[이미지\s*0[0-7]\]/i.test(line) && !/^#\S/.test(line) &&
      !/^(?:태그|자주\s*묻는\s*질문)\s*[:：]?$/.test(line))
    .map((line) => line.replace(/^[-•]\s*/, "").replace(/\*\*/g, ""));
  return excerpt.join(" ").replace(/\s+/g, " ").slice(0, 650).trim();
}

export function buildParammaV4ImagePrompt(topic, slot, plan = "", articleContext = "", thumbnailHook = "") {
  const info = PARAMMA_V4_SLOTS.find((item) => item.id === slot);
  if (!info) return "";
  const thumbnail = slot === "00";
  const coverText = String(thumbnailHook || "").trim() || topic.thumbnailHook;
  const confirmedPlan = String(plan || "").trim();
  const excerpt = String(articleContext || "").trim();
  const photoScene = /사진\s*검색\s*추천/.test(confirmedPlan) && !/AI\s*설명\s*이미지\s*추천/.test(confirmedPlan);
  const style = photoScene
    ? "기획에 맞는 자연스러운 사진형 장면으로 표현한다. AI 재현을 실제 촬영·보도 사진이라고 주장하지 않는다."
    : "기획에서 원리·순서·비교를 요구하면 읽기 쉬운 설명 그림 또는 절제된 정보 카드로 표현한다. 사진 장면이라면 사진형으로 표현한다.";

  return `Paramma 네이버 블로그용 이미지 정확히 1장 제작해줘.

[주제] ${topic.title}
[카테고리] ${topic.category}
[이미지 슬롯] ${slot} · ${info.role}
[최종 원고의 확정 장면 기획 — 가장 우선]
${confirmedPlan || "이 슬롯의 이미지 기획 메모를 찾지 못했습니다. 완성 원고와 해당 슬롯 메모를 먼저 입력해야 합니다."}
${excerpt ? "\n[해당 이미지와 연결된 본문]\n" + excerpt + "\n" : ""}
[출력] ${thumbnail ? "1254×1254, 1:1 정사각형 대표 썸네일" : "1600×900, 16:9 본문 이미지"} 1장
${thumbnail ? "[썸네일 짧은 문구] " + coverText + "\n" : ""}
- 위 확정 장면 기획과 관련 본문에 맞춰 이 장면 한 가지에 집중한다.
- ${style}
- 본문에 없는 사실·수치·효능·출처·브랜드 로고를 지어내지 않는다.
- 불필요한 장식, 작은 글씨, 과도한 3D·네온 효과는 피한다.`;
}
