import fs from "node:fs";

const path = "lib/apartment-content-v1.ts";
let s = fs.readFileSync(path, "utf8");

function once(oldText, newText, label) {
  if (s.includes(newText)) return;
  if (!s.includes(oldText)) throw new Error("apartment-content-v1 patch anchor missing: " + label);
  s = s.replace(oldText, newText);
}

if (!s.includes("function complexDataLines")) {
  const marker = "function dataLines(snapshot: DataSnapshot) {";
  const index = s.indexOf(marker);
  if (index < 0) throw new Error("apartment-content-v1 patch anchor missing: dataLines");
  const helper = `function complexDataLines(snapshot: DataSnapshot) {
  const location = [snapshot.complex.sido, snapshot.complex.sigungu, snapshot.complex.legal_dong]
    .filter(Boolean)
    .join(" ");
  const areaSummary = snapshot.areas
    .map((area) => area.displayName + " (" + area.exclusiveLabel + ")")
    .join(", ");

  return [
    "단지명: " + snapshot.complex.name,
    "지역: " + (location || "확인 필요"),
    "주소: " + (snapshot.complex.road_address || snapshot.complex.address || "확인 필요"),
    "세대수: " + (snapshot.complex.households ? snapshot.complex.households.toLocaleString() + "세대" : "확인 필요"),
    "사용승인일: " + (snapshot.complex.use_date || "확인 필요"),
    "확인된 평형 구성: " + (areaSummary || "확인 필요"),
  ].join("\\n");
}

`;
  s = s.slice(0, index) + helper + s.slice(index);
}

once(
`  "[국토부 실거래 API로 수집·식별된 {{YEAR}}년 자료]",
  "{{DATA_BLOCK}}",`,
`  "[단지 기본정보]",
  "{{COMPLEX_DATA_BLOCK}}",
  "",
  "[국토부 실거래 API로 수집·식별된 {{YEAR}}년 자료]",
  "{{DATA_BLOCK}}",`,
"final template complex block"
);

once(
`    TITLE: snapshot.complex.name + " 얼마일까?",
    DATA_BLOCK: dataLines(snapshot),`,
`    TITLE: snapshot.complex.name + " 얼마일까?",
    COMPLEX_DATA_BLOCK: complexDataLines(snapshot),
    DATA_BLOCK: dataLines(snapshot),`,
"final template values"
);

fs.writeFileSync(path, s);
