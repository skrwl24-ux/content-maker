// The seven-scene timing assistant can rephrase a word while redistributing sentences.
// Keep genuine omissions/duplicates blocked, but make the first discrepancy visible and
// allow the editor to restore the original wording without discarding scene timings.
export type NarrationDifference = {
  scene: number;
  position: number;
  original: string;
  revised: string;
};

export function narrationKey(value: string): string {
  return String(value || "").normalize("NFKC")
    .replace(/[∼〜]/g, "~")
    // Numeric decimals are data, unlike the dots in the fixed 집.값.쓱. brand.
    .replace(/(\d)\.(?=\d)/g, "$1\uE000")
    .replace(/[\s\u200B-\u200D\uFEFF.,!?。！？·:：，、'"‘’“”()（）\[\]{}]/g, "")
    .replace(/\uE000/g, ".");
}

export function narrationDifference(original: string, narrations: string[]): NarrationDifference | null {
  const expected = Array.from(narrationKey(original));
  const actual = Array.from(narrationKey(narrations.join("")));
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
  if (i === expected.length && i === actual.length) return null;
  let accumulated = 0;
  let scene = Math.max(1, narrations.length);
  for (let index = 0; index < narrations.length; index++) {
    accumulated += Array.from(narrationKey(narrations[index])).length;
    if (i < accumulated || index === narrations.length - 1) {
      scene = index + 1;
      break;
    }
  }
  const excerpt = (chars: string[]) =>
    (i > 10 ? "…" : "") + chars.slice(Math.max(0, i - 10), i).join("")
    + "【" + (chars[i] || "끝") + "】"
    + chars.slice(i + 1, i + 27).join("")
    + (i + 27 < chars.length ? "…" : "");
  return { scene, position: i + 1, original: excerpt(expected), revised: excerpt(actual) };
}

// Redistribute the *unaltered original tokens* at positions nearest to the
// current GPT scene boundaries. This is an explicit editor action, never an
// automatic bypass of the script-integrity check.
export function restoreOriginalNarration(original: string, narrations: string[]): string[] | null {
  const tokens = String(original || "").trim().match(/\S+/gu) || [];
  const count = narrations.length;
  if (count === 0 || tokens.length < count || narrations.every(s => !s.trim())) return null;
  const cumulativeOriginal: string[] = [""];
  for (const token of tokens) cumulativeOriginal.push(cumulativeOriginal[cumulativeOriginal.length - 1] + narrationKey(token));
  const desired: string[] = [];
  let current = "";
  for (const narration of narrations) {
    current += narrationKey(narration);
    desired.push(current);
  }

  const editDistance = (left: string, right: string): number => {
    const a = Array.from(left), b = Array.from(right);
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) {
        next[j] = Math.min(previous[j] + 1, next[j - 1] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = next;
    }
    return previous[b.length];
  };

  const boundaries = [0];
  for (let index = 0; index < count - 1; index++) {
    const min = boundaries[boundaries.length - 1] + 1;
    const max = tokens.length - (count - index - 1);
    let best = min, bestScore = Infinity;
    for (let end = min; end <= max; end++) {
      // Prefer matching the GPT's cumulative boundary, then natural phrase ends.
      const score = editDistance(cumulativeOriginal[end], desired[index])
        + Math.abs(cumulativeOriginal[end].length - desired[index].length) * 0.02
        - (/[.!?。！？]$/.test(tokens[end - 1]) ? 0.15 : 0);
      if (score < bestScore) { best = end; bestScore = score; }
    }
    boundaries.push(best);
  }
  boundaries.push(tokens.length);
  const restored = narrations.map((_, index) =>
    tokens.slice(boundaries[index], boundaries[index + 1]).join(" "));
  return narrationKey(restored.join("")) === narrationKey(original) ? restored : null;
}
