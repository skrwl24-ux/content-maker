/**
 * Read only the explicitly marked structured research result copied from GPT.
 * The output is untrusted research input: links and key fields are validated,
 * and nothing becomes publishable before the editor checks the original source.
 */
export function parseApartmentStoryResearch(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("조사 결과를 먼저 붙여넣어 주세요.");
  const block = raw.match(/\[STORY_JSON\]([\s\S]*?)\[\/STORY_JSON\]/i);
  const content = (block ? block[1] : raw).trim()
    .replace(/^\x60\x60\x60(?:json)?\s*/i, "")
    .replace(/\s*\x60\x60\x60$/, "");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("[STORY_JSON]부터 [/STORY_JSON]까지 포함한 조사 결과를 그대로 붙여넣어 주세요.");
  }
  if (!parsed || !Array.isArray(parsed.candidates)) {
    throw new Error("조사 결과에 candidates 배열이 없습니다. 스토리 조사 요청서로 다시 조사해 주세요.");
  }
  const str = (value, length = 400) => typeof value === "string" ? value.trim().slice(0, length) : "";
  const url = (value) => {
    const candidate = str(value, 2000);
    try {
      const parsedUrl = new URL(candidate);
      return parsedUrl.protocol === "https:" && parsedUrl.hostname.includes(".") ? parsedUrl.href : "";
    } catch {
      return "";
    }
  };
  return parsed.candidates.slice(0, 3).map((candidate, index) => ({
    id: String(index + 1),
    title: str(candidate?.title, 100),
    kind: str(candidate?.kind, 50),
    facts: str(candidate?.facts, 550),
    connection: str(candidate?.connection, 350),
    bridge: str(candidate?.bridge, 500),
    sourceTitle: str(candidate?.sourceTitle, 120),
    sourceUrl: url(candidate?.sourceUrl),
    sourceDate: str(candidate?.sourceDate, 30),
    eventDate: str(candidate?.eventDate, 60),
    timing: str(candidate?.timing, 40),
    communityNote: str(candidate?.communityNote, 240),
  })).filter(candidate => candidate.title && candidate.facts && candidate.connection && candidate.bridge && candidate.sourceUrl);
}
