/**
 * Extract only explicitly labeled image-planning notes from a completed
 * Paramma article. Body [이미지 01] placement markers are not image plans.
 *
 * @param {string} raw
 * @returns {Partial<Record<"00"|"01"|"02"|"03", string>>}
 */
export function extractParammaImagePlans(raw) {
  if (typeof raw !== "string" || !raw.trim()) return {};

  const plans = {};
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  let inPlanSection = false;
  let currentSlot = null;
  let awaitingDescription = false;

  for (const original of lines) {
    const line = normalizeLine(original);
    if (isPlanHeading(line)) {
      inPlanSection = true;
      currentSlot = null;
      awaitingDescription = false;
      continue;
    }
    if (!inPlanSection) continue;
    if (isEndHeading(line, original)) break;
    if (!line) continue;

    const match = matchImagePlan(line);
    if (match) {
      currentSlot = match[1];
      const description = match[2].trim();
      awaitingDescription = !description || isRoleOnly(description);
      if (isOmitted(description)) {
        delete plans[currentSlot];
        currentSlot = null;
        awaitingDescription = false;
      } else if (description) {
        plans[currentSlot] = description.slice(0, 500);
      }
      continue;
    }

    // Some GPT outputs put a slot's description on the line after its label.
    // Never consume unrelated paragraphs or an entirely new section.
    if (awaitingDescription && currentSlot && !isEndHeading(line, original)) {
      const continuation = line.replace(/^[-•]\s+/, "").trim();
      if (continuation && !isOmitted(continuation)) {
        plans[currentSlot] = (
          (plans[currentSlot] ? plans[currentSlot] + " — " : "") + continuation
        ).slice(0, 500);
      }
      awaitingDescription = false;
      currentSlot = null;
    }
  }

  return plans;
}

function normalizeLine(raw) {
  return raw.trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-•]\s+/, "")
    .replace(/(?:\*\*|__|\x60)/g, "")
    .trim();
}

function isPlanHeading(line) {
  const normalized = line.replace(/^\d+[.)]\s*/, "")
    .replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!normalized.startsWith("이미지")) return false;
  if (normalized.length > 105) return false;
  return /(?:기획|배치|삽입\s*위치|구성)\s*(?:및\s*삽입\s*위치|메모|안|계획|정리)?\s*[:：]?$/.test(normalized);
}

function isEndHeading(line, raw) {
  const normalized = line.replace(/^\d+[.)]\s*/, "")
    .replace(/^\[/, "").replace(/\]$/, "").trim();
  if (/^(?:검수\s*메모|출처|참고\s*(?:자료|문헌)|자료\s*출처|팩트\s*체크|태그)(?:\s*[:：].*)?$/.test(normalized)) return true;
  // Stop at a new Markdown heading, but never at an image slot.
  return /^#{1,6}\s/.test(raw.trim()) && !matchImagePlan(line);
}

function matchImagePlan(line) {
  const normalized = line.replace(/^\[\s*(이미지\s*0[0-3])\s*\]/i, "$1: ")
    .replace(/^\[\s*(0[0-3])\s*\]/, "$1: ");
  const labeled = normalized.match(/^(?:(?:본문|대표|선택)\s*)?(?:이미지|image)\s*(0[0-3])(?:번)?\s*(?:\([^)]{1,32}\))?\s*(?:[·.:\-–—|)]|\s+)\s*(.*)$/i);
  if (labeled) return [labeled[0], labeled[1], labeled[2]];
  const short = normalized.match(/^(0[0-3])(?:번)?\s*(?:[·.:\-–—|)]|\s+)\s*(.+)$/i);
  return short ? [short[0], short[1], short[2]] : null;
}

function isRoleOnly(value) {
  return /^(?:썸네일|대표\s*썸네일|본문\s*이미지\s*0[1-3]|핵심\s*원리|추가\s*(?:보상|설명|비교)|이번\s*글의\s*(?:킥|보상))(?:\s*[:：-])?$/.test(value);
}

function isOmitted(value) {
  return /^(?:(?:선택\s*)?(?:생략|미사용)|없음|불필요|필요\s*없음|사용\s*안\s*함)(?:[.!。]?\s*)$/.test(value);
}
