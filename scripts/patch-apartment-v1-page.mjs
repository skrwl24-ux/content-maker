import fs from "node:fs";

const path = "app/apartment-v1/page.tsx";
let s = fs.readFileSync(path, "utf8");

function once(oldText, newText, label) {
  if (s.includes(newText)) return;
  if (!s.includes(oldText)) throw new Error("apartment-v1 patch anchor missing: " + label);
  s = s.replace(oldText, newText);
}

if (!s.includes("function kstDateFromTimestamp")) {
  once(
`function kstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
`,
`function kstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function kstDateFromTimestamp(value: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year && values.month && values.day
    ? values.year + "-" + values.month + "-" + values.day
    : "";
}
`,
"kst timestamp helper"
  );
}

once(
`type ComplexIdentityState = {
  loaded: boolean;
  kaptCode: string;
  regionCode: string;
  legalDong: string;
  lot: string;
  address: string;
  roadAddress: string;
  unresolved: IdentityCandidate[];
};
`,
`type ComplexIdentityState = {
  loaded: boolean;
  kaptCode: string;
  regionCode: string;
  legalDong: string;
  lot: string;
  address: string;
  roadAddress: string;
  unresolved: IdentityCandidate[];
};

type MonthCoverageRow = {
  year_month: string;
  fetched_at: string;
  raw_trade_count: number;
};

function expectedCoverageMonths(referenceDate: string) {
  const year = referenceDate.slice(0, 4);
  const endMonth = Math.max(1, Math.min(12, Number(referenceDate.slice(5, 7)) || 12));
  return Array.from({ length: endMonth }, (_, index) =>
    year + "-" + String(index + 1).padStart(2, "0")
  );
}
`,
"type coverage"
);

once(
`  const [structureRaw, setStructureRaw] = useState("");`,
`  const [tradeCoverage, setTradeCoverage] = useState<MonthCoverageRow[]>([]);
  const [structureRaw, setStructureRaw] = useState("");`,
"coverage state"
);

once(
`    setIdentityState({
      loaded: false,`,
`    setTradeCoverage([]);
    setIdentityState({
      loaded: false,`,
"coverage reset"
);

once(
`      if (identityRow.region_code && legalDong && lot) {
        const { data: unresolvedRows, error: unresolvedError } = await supabase
          .from("apt_unmatched_source_candidates")
          .select("candidate_key,source_apartment_name,build_year,classification,raw_trade_count,area_groups")
          .eq("region_code", identityRow.region_code)
          .eq("legal_dong", legalDong)
          .eq("jibun", lot)
          .eq("is_active", true)
          .order("raw_trade_count", { ascending: false });
        if (unresolvedError) throw unresolvedError;
        unresolved = (unresolvedRows || []) as IdentityCandidate[];
      }

      const built = buildDataSnapshot(complex, tradeResult.data || [], referenceDate, rankScopeLabel);
      const identityReady = Boolean(lot && unresolved.length === 0 && built.totalTransactions > 0);
      const identityMeta = {
        source: "molit_api",
        identityStatus: identityReady ? "matched" : "review",
        kaptCode: String(identityRow.kapt_code || ""),
        regionCode: String(identityRow.region_code || ""),
        legalDong,
        jibun: lot,
        unresolvedCount: unresolved.length,
        unresolvedSourceNames: unresolved.map((item) => item.source_apartment_name),
      };
`,
`      if (identityRow.region_code && legalDong && lot) {
        const { data: unresolvedRows, error: unresolvedError } = await supabase
          .from("apt_unmatched_source_candidates")
          .select("candidate_key,source_apartment_name,build_year,classification,raw_trade_count,area_groups")
          .eq("region_code", identityRow.region_code)
          .eq("legal_dong", legalDong)
          .eq("jibun", lot)
          .eq("is_active", true)
          .order("raw_trade_count", { ascending: false });
        if (unresolvedError) throw unresolvedError;
        unresolved = (unresolvedRows || []) as IdentityCandidate[];
      }

      const expectedMonths = expectedCoverageMonths(referenceDate);
      let coverageRows: MonthCoverageRow[] = [];
      if (identityRow.region_code && expectedMonths.length) {
        const { data: coverageData, error: coverageError } = await supabase
          .from("apt_trade_month_coverage")
          .select("year_month,fetched_at,raw_trade_count")
          .eq("region_code", identityRow.region_code)
          .in("year_month", expectedMonths)
          .order("year_month", { ascending: true });
        if (coverageError) throw coverageError;
        coverageRows = (coverageData || []) as MonthCoverageRow[];
      }

      const coverageMap = new Map(coverageRows.map((row) => [row.year_month, row]));
      const missingCoverage = expectedMonths.filter((month) => !coverageMap.has(month));
      const currentCoverage = coverageMap.get(referenceDate.slice(0, 7));
      const currentCoverageFresh = Boolean(
        currentCoverage && kstDateFromTimestamp(currentCoverage.fetched_at) >= referenceDate
      );
      const coverageReady = missingCoverage.length === 0 && currentCoverageFresh;

      const built = buildDataSnapshot(complex, tradeResult.data || [], referenceDate, rankScopeLabel);
      const identityReady = Boolean(lot && unresolved.length === 0);
      const identityMeta = {
        source: "molit_api",
        identityStatus: identityReady ? "matched" : "review",
        kaptCode: String(identityRow.kapt_code || ""),
        regionCode: String(identityRow.region_code || ""),
        legalDong,
        jibun: lot,
        unresolvedCount: unresolved.length,
        unresolvedSourceNames: unresolved.map((item) => item.source_apartment_name),
        coverageReady,
        missingCoverage,
      };
`,
"coverage fetch"
);

s = s.replaceAll(
`          data_status: identityReady ? "pass" : "warning",`,
`          data_status: identityReady && coverageReady ? "pass" : "warning",`
);
s = s.replaceAll(
`        data_status: identityReady ? "pass" : "warning",`,
`        data_status: identityReady && coverageReady ? "pass" : "warning",`
);

once(
`      setSnapshot(built);
      setStructures((structureResult.data || []) as StructureRow[]);`,
`      setSnapshot(built);
      setTradeCoverage(coverageRows);
      setStructures((structureResult.data || []) as StructureRow[]);`,
"coverage state set"
);

once(
`  const apiDataReady = Boolean(
    snapshot &&
    identityState.loaded &&
    identityState.lot &&
    identityState.unresolved.length === 0 &&
    snapshot.totalTransactions > 0
  );

`,
`  const expectedTradeMonths = useMemo(
    () => snapshot ? expectedCoverageMonths(snapshot.referenceDate) : [],
    [snapshot]
  );
  const coveredTradeMonths = useMemo(
    () => new Map(tradeCoverage.map((row) => [row.year_month, row])),
    [tradeCoverage]
  );
  const missingTradeMonths = useMemo(
    () => expectedTradeMonths.filter((month) => !coveredTradeMonths.has(month)),
    [coveredTradeMonths, expectedTradeMonths]
  );
  const currentTradeCoverage = snapshot ? coveredTradeMonths.get(snapshot.referenceDate.slice(0, 7)) : null;
  const tradeCoverageReady = Boolean(
    snapshot &&
    missingTradeMonths.length === 0 &&
    currentTradeCoverage &&
    kstDateFromTimestamp(currentTradeCoverage.fetched_at) >= snapshot.referenceDate
  );
  const identityReady = Boolean(
    identityState.loaded &&
    identityState.lot &&
    identityState.unresolved.length === 0
  );
  const apiDataReady = Boolean(
    snapshot &&
    identityReady &&
    tradeCoverageReady &&
    snapshot.totalTransactions > 0
  );

`,
"readiness"
);

once(
`    placeholders: ["{{TITLE}}", "{{DATA_BLOCK}}", "{{STRUCTURE_DATA_BLOCK}}", "{{LIFE_KICK_BLOCK}}", "{{TOC_BLOCK}}", "{{SOURCE_LINE}}"],`,
`    placeholders: ["{{TITLE}}", "{{COMPLEX_DATA_BLOCK}}", "{{DATA_BLOCK}}", "{{STRUCTURE_DATA_BLOCK}}", "{{LIFE_KICK_BLOCK}}", "{{TOC_BLOCK}}", "{{SOURCE_LINE}}"],`,
"final prompt placeholder"
);

const transactionMarker = `          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>자동 수집</span>
                <h2>실거래 자료</h2>`;
if (!s.includes("<h2>단지 기본정보</h2>")) {
  if (!s.includes(transactionMarker)) throw new Error("apartment-v1 patch anchor missing: transaction section");
  const basicSection = `          <section className={styles.workflowCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.stepLabel}>자동 수집</span>
                <h2>단지 기본정보</h2>
              </div>
              <span className={styles.goodPill}>✓ K-apt</span>
            </div>
            <div className={styles.doubleCheckGrid}>
              <div>
                <span>세대수</span>
                <strong>{workspace.households ? workspace.households.toLocaleString() + "세대" : "확인 필요"}</strong>
              </div>
              <div>
                <span>사용승인일</span>
                <strong>{workspace.use_date || "확인 필요"}</strong>
              </div>
              <div>
                <span>주소</span>
                <strong>{identityState.roadAddress || identityState.address || workspace.road_address || workspace.address || "확인 필요"}</strong>
              </div>
              <div>
                <span>확인 평형</span>
                <strong>{snapshot.areas.map((area) => area.displayName).join(", ") || "확인 필요"}</strong>
              </div>
            </div>
          </section>

`;
  s = s.replace(transactionMarker, basicSection + transactionMarker);
}

once(
`            <div className={styles.doubleCheckPanel}>
              <div className={styles.doubleCheckHead}>
                <div>
                  <strong>{apiDataReady ? "단지 식별 완료" : "단지 식별 확인 필요"}</strong>
                  <span>
                    {identityState.legalDong || "법정동 미확인"}
                    {identityState.lot ? " · 지번 " + identityState.lot : " · 지번 미확인"}
                    {identityState.kaptCode ? " · K-apt " + identityState.kaptCode : ""}
                  </span>
                </div>
                <b className={apiDataReady ? styles.statusGood : styles.statusWarn}>
                  {apiDataReady ? "✓ 국토부 자료 사용 가능" : "⚠ 확인 필요"}
                </b>
              </div>
              <div className={styles.doubleCheckGrid}>
                <div>
                  <span>기준 주소</span>
                  <strong>{identityState.address || "주소 확인 필요"}</strong>
                </div>
                <div>
                  <span>도로명주소</span>
                  <strong>{identityState.roadAddress || "미확인"}</strong>
                </div>
                <div>
                  <span>올해 연결 거래</span>
                  <strong>{snapshot.totalTransactions}건</strong>
                </div>
                <div>
                  <span>미연결 신고명</span>
                  <strong>{identityState.unresolved.length}개</strong>
                </div>
              </div>
              {identityState.unresolved.length ? (
                <div className={styles.doubleCheckWarnings}>
                  {identityState.unresolved.map((item) => (
                    <div key={item.candidate_key}>
                      ⚠ {item.source_apartment_name} · 지번 {identityState.lot} · 원자료 {item.raw_trade_count}건
                    </div>
                  ))}
                  <Link
                    className={styles.secondaryLink}
                    href={"/apartment-bulk/unmatched?regionCode=" + encodeURIComponent(identityState.regionCode) +
                      "&name=" + encodeURIComponent(identityState.unresolved[0]?.source_apartment_name || workspace.name)}
                  >
                    이 단지 식별 검토함 열기 →
                  </Link>
                </div>
              ) : !identityState.lot ? (
                <div className={styles.doubleCheckWarnings}>
                  <div>⚠ K-apt 주소에서 지번을 확정하지 못했습니다. 주소를 먼저 확인해야 합니다.</div>
                </div>
              ) : null}
            </div>

            <p className={styles.muted}>
              K-apt의 법정동·지번을 기준으로 국토부 실거래를 연결합니다. 같은 지번의 K-apt 관리단지가 하나뿐이면 신고명이 달라도 자동으로 포함하고, 여러 단지가 같은 지번을 쓸 때만 별도 식별 확인을 거칩니다.
            </p>

`,
`            <div className={styles.doubleCheckPanel}>
              <div className={styles.doubleCheckHead}>
                <div>
                  <strong>
                    {!identityReady ? "단지 식별 확인 필요" :
                     !tradeCoverageReady ? "국토부 자료 새로고침 필요" :
                     snapshot.totalTransactions > 0 ? "실거래 자료 준비 완료" : "수집 완료 · 올해 거래 없음"}
                  </strong>
                  <span>
                    {tradeCoverageReady
                      ? snapshot.year + "년 1~" + Number(snapshot.referenceDate.slice(5, 7)) + "월 수집 완료 · 연결 거래 " + snapshot.totalTransactions + "건"
                      : missingTradeMonths.length
                        ? "수집 확인이 안 된 월: " + missingTradeMonths.map((month) => Number(month.slice(5, 7)) + "월").join(", ")
                        : "현재 월 자료를 기준일까지 다시 확인해주세요."}
                  </span>
                </div>
                <b className={apiDataReady ? styles.statusGood : styles.statusWarn}>
                  {apiDataReady ? "✓ 차트 제작 가능" : "⚠ 확인 필요"}
                </b>
              </div>
              {!identityReady ? (
                <div className={styles.doubleCheckWarnings}>
                  <div>⚠ 단지 식별이 필요한 자료가 있습니다. 이 경우에만 별도 확인합니다.</div>
                  {identityState.unresolved.length ? (
                    <Link
                      className={styles.secondaryLink}
                      href={"/apartment-bulk/unmatched?regionCode=" + encodeURIComponent(identityState.regionCode) +
                        "&name=" + encodeURIComponent(identityState.unresolved[0]?.source_apartment_name || workspace.name)}
                    >
                      단지 식별 확인 →
                    </Link>
                  ) : null}
                </div>
              ) : !tradeCoverageReady ? (
                <div className={styles.doubleCheckWarnings}>
                  <div>⚠ 거래 0건인 달과 아직 수집하지 않은 달을 구분하기 위해 1월~현재 자료를 한 번 새로고침해주세요.</div>
                </div>
              ) : null}
            </div>

`,
"simplified transaction status"
);

fs.writeFileSync(path, s);
