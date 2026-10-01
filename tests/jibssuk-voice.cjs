const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../lib/jibssuk-voice.ts"), "utf8")
  .replace(/export function /g, "function ");
const context = vm.createContext({});
vm.runInContext(source, context);
const convert = value => context.toKoreanVoiceScript(value);

test("real estate money is read as complete Korean amounts", () => {
  assert.equal(convert("32억7,000만원"), "삼십이억 칠천만 원");
  assert.equal(convert("33억2,500만원"), "삼십삼억 이천오백만 원");
  assert.equal(convert("6.93억"), "육억 구천삼백만 원");
  assert.equal(convert("9.5%"), "구 점 오 퍼센트");
});

test("years months counters and square metres use appropriate readings", () => {
  assert.equal(convert("2026년 4월 26건, 6월 5건, 7월 15건, 8월 3건, 9월 1건"),
    "이천이십육 년 사월 스물여섯 건, 유월 다섯 건, 칠월 열다섯 건, 팔월 세 건, 구월 한 건");
  assert.equal(convert("34평대 전용 84㎡대"), "삼십사 평대 전용 팔십사 제곱미터대");
  assert.equal(convert("6~7월"), "유월부터 칠월까지");
  assert.equal(convert("1.4배속"), "일 점 사 배속");
});

test("narration conversion removes Arabic digits without touching the display script", () => {
  const display = "잠실엘스 34평대 2026년 9월 1건 33억2,500만원";
  const spoken = convert(display);
  assert.equal(context.hasArabicVoiceDigits(spoken), false);
  assert.equal(display, "잠실엘스 34평대 2026년 9월 1건 33억2,500만원");
  assert.match(spoken, /삼십삼억 이천오백만 원/);
});
