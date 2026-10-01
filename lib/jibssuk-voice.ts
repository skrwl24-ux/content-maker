// @ts-nocheck — isolated pure-JS pronunciation rules are also exercised with node:test.
// Only the audio narration is rewritten. The display script, overlays and SRT
// must continue using the original numerical spellings.
const DIGITS = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const LARGE = ["", "만", "억", "조", "경"];

function readSmallNumber(value) {
  const n = Number(value);
  if (!n) return "";
  let result = "";
  for (const [unit, name] of [[1000, "천"], [100, "백"], [10, "십"]]) {
    const digit = Math.floor(n / unit) % 10;
    if (digit) result += (digit === 1 ? "" : DIGITS[digit]) + name;
  }
  const last = n % 10;
  return result + (last ? DIGITS[last] : "");
}

function readSino(value) {
  const digits = String(value).replace(/,/g, "").replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(digits)) return value;
  if (/^0+$/.test(digits)) return "영";
  const chunks = [];
  for (let end = digits.length, index = 0; end > 0; end -= 4, index++) {
    const group = Number(digits.slice(Math.max(0, end - 4), end));
    if (group) chunks.unshift(readSmallNumber(group) + (LARGE[index] || ""));
  }
  return chunks.join("");
}

function readDecimal(value) {
  const [integer, decimal] = String(value).replace(/,/g, "").split(".");
  return readSino(integer) + (decimal ? " 점 " + [...decimal].map(d => DIGITS[Number(d)]).join(" ") : "");
}

const NATIVE_ONES = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
const NATIVE_TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
function readNativeCounter(value) {
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isInteger(n) || n <= 0 || n >= 100) return readSino(value);
  if (n === 20) return "스무";
  return (NATIVE_TENS[Math.floor(n / 10)] || "") + NATIVE_ONES[n % 10];
}

function readMonth(value) {
  const n = Number(value);
  if (n === 6) return "유월";
  if (n === 10) return "시월";
  return readSino(value) + "월";
}

function readEokAmount(integer, decimal, extraMan) {
  const whole = Number(String(integer).replace(/,/g, ""));
  // One 억 equals ten thousand 만; keep all four decimal positions.
  const fraction = decimal ? Number(decimal.slice(0, 4).padEnd(4, "0")) : 0;
  const man = fraction + Number(String(extraMan || "0").replace(/,/g, ""));
  const major = whole ? readSino(String(whole)) + "억" : "";
  const minor = man ? readSino(String(man)) + "만" : "";
  return [major, minor].filter(Boolean).join(" ") + " 원";
}

export function toKoreanVoiceScript(source) {
  return String(source || "")
    .replace(/각각\s+(?=\d)/g, "각각, ")
    .replace(/\bTOP\s*3\b/gi, "탑 쓰리")
    .replace(/\bDSR\b/gi, "디에스알")
    .replace(/\bLTV\b/gi, "엘티브이")
    .replace(/\bGTX\b/gi, "지티엑스")
    .replace(/\bAI\b/gi, "에이아이")
    // Handle price groups before ordinary counters so 33억2,500만원 stays one amount.
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*억(?:\s*(\d[\d,]*)\s*만\s*원)?(?:\s*원)?(대)?/g,
      (_all, amount, man, range) => {
        const [major, minor] = amount.split(".");
        return readEokAmount(major, minor, man) + (range || "");
      })
    .replace(/(\d[\d,]*)\s*만\s*원(대)?/g, (_all, man, range) =>
      readSino(man) + "만 원" + (range || ""))
    .replace(/(\d{1,2})\s*[~∼〜–]\s*(\d{1,2})\s*월/g,
      (_all, from, to) => readMonth(from) + "부터 " + readMonth(to) + "까지")
    .replace(/(\d{1,2})\s*월/g, (_all, month) => readMonth(month))
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:㎡|m²|m2)\s*(대)?/gi,
      (_all, value, range) => readDecimal(value) + " 제곱미터" + (range || ""))
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(%|퍼센트)/g,
      (_all, value) => readDecimal(value) + " 퍼센트")
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(배속)/g,
      (_all, value) => readDecimal(value) + " 배속")
    .replace(/(\d[\d,]*)\s*(건|개|명)/g,
      (_all, value, unit) => readNativeCounter(value) + " " + unit)
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(평대|평형|평|세대|개동|호선|층|위)/g,
      (_all, value, unit) => readDecimal(value) + " " + unit)
    .replace(/(\d[\d,]*)\s*년/g, (_all, value) => readSino(value) + " 년")
    .replace(/\d[\d,]*(?:\.\d+)?/g, value => readDecimal(value))
    .replace(/([가-힣])앤([가-힣])/g, "$1 앤 $2")
    .replace(/([가-힣])(푸르지오|래미안|힐스테이트|아이파크|롯데캐슬|더샵|센트럴푸르지오|어바인퍼스트|포레스티아|메가트리아|디에트르|제일풍경채|휴먼시아)/g, "$1 $2")
    .replace(/오늘도\s*,?\s*집\.값\.쓱\./g, "오늘도, 집.값.쓱.")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function hasArabicVoiceDigits(source) {
  return /[0-9]/.test(source);
}
