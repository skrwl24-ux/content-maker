// Shared brand instructions are appended at copy/open/export time.
// Existing saved article drafts, image plans, and image blobs are never rewritten.
export const DEFAULT_DRILLMAL_SETTINGS = Object.freeze({
  enabled: true,
  voice: "balanced",
  imageMode: "all",
  autoStamp: true,
  corner: "right",
});

export function normalizeDrillmalSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    voice: ["light", "balanced", "strong"].includes(value.voice) ? value.voice : "balanced",
    imageMode: ["key", "thumbnail", "all"].includes(value.imageMode) ? value.imageMode : "all",
    autoStamp: typeof value.autoStamp === "boolean" ? value.autoStamp : true,
    corner: value.corner === "left" ? "left" : "right",
  };
}

export function drillmalImageApplies(settings, slot) {
  const s = normalizeDrillmalSettings(settings);
  if (!s.enabled) return false;
  if (s.imageMode === "all") return /^0[0-7]$/.test(String(slot));
  if (s.imageMode === "thumbnail") return slot === "00";
  return ["00", "05", "06"].includes(slot);
}

export function drillmalArticleRules(settings) {
  const s = normalizeDrillmalSettings(settings);
  if (!s.enabled) return "";
  const intensity = s.voice === "light"
    ? "- 완성 본문에서 '드릴말의 한마디' 코너를 가장 중요한 한 곳에서만 선택적으로 사용한다."
    : s.voice === "strong"
      ? "- 도입과 핵심 발견·마무리에서 드릴말의 친근한 진행을 느끼게 하되, 반복되는 캐릭터 대사나 길고 억지스러운 농담은 피한다."
      : "- 도입에서 독자의 궁금증을 자연스럽게 받고, 핵심 발견 근처에서 '드릴말의 한마디'를 1회 정도 사용한다. 억지로 넣어야 하면 생략한다.";
  return `

[드릴말 브랜드 · 추가 작성 규칙]
- 파람마의 진행 캐릭터는 '드릴말'이다. 기존에 확정한 말 얼굴과 드릴 형태의 코를 가진 캐릭터를 뜻한다.
- 정보가 주인공이고 캐릭터는 독자의 질문을 대신 던지고 발견을 짧게 안내하는 조연이다.
- 제목과 앞 3~5줄은 기존 네이버 검색 의도·호기심·사실 확인 규칙을 우선한다. 모든 제목에 드릴말 이름을 넣지 않는다.
- 근거 없는 자기 경험, 가짜 인터뷰, 가공된 전문가 발언, 단정적인 효능이나 홍보는 금지한다.
- 친근한 존댓말과 짧은 모바일 문단을 유지한다.
- "드릴말의 한마디"는 소제목을 무조건 늘리는 고정 코너가 아니다. 필요한 경우에만 짧은 독자 보상으로 활용한다.
${intensity}
- 네이버 본문 텍스트에 캐릭터 이미지 파일 경로·인공지능 그림 생성 지시문을 출력하지 않는다.`;
}

export function drillmalImageRules(settings, slot) {
  if (!drillmalImageApplies(settings, slot)) return "";
  const s = normalizeDrillmalSettings(settings);
  const location = s.corner === "left" ? "왼쪽" : "오른쪽";
  return `

[드릴말 브랜드 · 캐릭터 적용]
- 드릴말은 확정된 '말 얼굴 + 드릴 모양 코' 캐릭터이다. 새로운 생김새를 임의로 디자인하지 않는다.
- 중요: 이 텍스트 요청서는 캐릭터 원본 이미지 파일을 ChatGPT에 자동 첨부하지 않는다.
- 이 채팅에 드릴말 원본 이미지가 실제로 첨부되어 있다면 그 원본 디자인과 비율·코 모양을 기준으로 사용한다.
- 원본 이미지가 첨부되어 있지 않다면 드릴말을 새로 그려 넣지 말고, 이미지 ${location} 아래 모서리에 작은 캐릭터를 합성할 수 있도록 주요 피사체·문구를 피해 여백을 확보한다. 사이트에서 원본 PNG 등록 후 이미지 등록 시 자동으로 합성할 수 있다.
- 캐릭터는 약 12~18% 너비의 작은 조연으로, 장면의 정보와 모바일 가독성을 방해하지 않는다.
- 실제 사진형 장면, 해충·동물 관찰 사진, 과학 설명은 원본의 정보 정확성을 우선한다.
- 사진 속에 진짜 동물·물건처럼 섞어 넣거나 실제 촬영 사실처럼 연출하지 않는다. 사용할 경우 분명히 구분되는 작은 일러스트/스티커다.
- 이미지 생성 채팅에는 원본 파일이 자동 전달되지 않는다. 실제 완성 파일에 동일한 드릴말을 넣으려면 콘텐츠메이커에서 원본 PNG를 등록하고 생성된 이미지를 등록하면 자동 합성된다(자동 적용 설정 ON).`;
}
