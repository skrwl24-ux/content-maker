/**
 * 5개 묶음 주제 입력 검증. 빈 줄은 무시하고, 주제는 한 줄당 하나씩만 등록한다.
 * 슬롯의 조사/근거 상태는 UI에서 명시적 확인 후에만 교체한다.
 */
export const RESEARCH_BATCH_SIZE = 5;

export function parseResearchBatchTopics(input) {
  const lines = typeof input === "string" ? input.split(/\r?\n/) : [];
  const topics = lines.map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[1-5][.)]\s+/, "").trim());
  if (!topics.length) return { topics: [], error: "주제를 한 줄에 하나씩 입력해 주세요." };
  if (topics.length > RESEARCH_BATCH_SIZE) return { topics: [], error: "한 번에 최대 5개까지 입력할 수 있습니다." };
  if (topics.some(topic => !topic || topic.length > 600)) return { topics: [], error: "각 주제는 600자 이하로 입력해 주세요." };
  return { topics, error: "" };
}

export function researchSlotKey(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > RESEARCH_BATCH_SIZE) throw new RangeError("연구 작업 번호는 1~5만 허용합니다.");
  return "content-maker-research-studio-v2-slot-" + slot;
}

export function emptyResearchSlot(topic = "", channel = "집값쓱") {
  return {
    version: 1,
    channel: ["집값쓱", "Paramma", "기타"].includes(channel) ? channel : "집값쓱",
    topic,
    notes: "",
    raw: "",
    selectedAngleId: "",
    approvedKeys: [],
  };
}
