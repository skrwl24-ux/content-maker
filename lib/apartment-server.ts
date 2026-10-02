import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { matchApartmentTrade, normalizeApartmentName } from "./apartment-trade-matching.mjs";
import { mergeKaptApartmentDetail } from "./apartment-detail-merge.mjs";
export { normalizeApartmentName } from "./apartment-trade-matching.mjs";

const FALLBACK_SUPABASE_URL = "https://ygrgamfvykuyhijogxou.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_FPIPh89R0_78FfWzagT7hw_PGWSNE21";

const KAPT_LIST_URL = "https://apis.data.go.kr/1613000/AptListService4/getSidoAptList4";
const KAPT_BASIC_URL = "https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5";
const MOLIT_TRADE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

type JsonRecord = Record<string, unknown>;

export type ApartmentRegion = {
  region_code: string;
  sido_code: string;
  sido_name: string;
  region_name: string;
  enabled: boolean;
  last_synced_at: string | null;
};

type ComplexRow = {
  id: string;
  kapt_code: string | null;
  name: string;
  normalized_name: string;
  legal_dong: string | null;
  bjd_code: string | null;
  region_code: string;
  address: string | null;
  road_address: string | null;
  households: number | null;
  use_date: string | null;
};

type NormalizedTrade = {
  complex_id: string | null;
  source_apartment_name: string;
  normalized_apartment_name: string;
  region_code: string;
  legal_dong: string | null;
  bjd_code: string | null;
  contract_date: string;
  contract_year_month: string;
  exclusive_area: number;
  area_group: number;
  price_won: number;
  floor: number | null;
  jibun: string | null;
  build_year: number | null;
  cancelled: boolean;
  cancellation_date: string | null;
  source_trade_key: string;
  raw: JsonRecord;
};

export function createApartmentReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_PUBLISHABLE_KEY;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createApartmentAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function apartmentSetupState() {
  return {
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasPublicDataKey: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
  };
}

function decodeServiceKey(raw: string) {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function text(v: unknown) {
  return v == null ? "" : String(v).trim();
}

function numberValue(v: unknown) {
  // Number("") === 0, but absent API fields are unknown, not real zero values.
  const raw = String(v ?? "").replace(/,/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function intValue(v: unknown) {
  const n = numberValue(v);
  return n == null ? null : Math.trunc(n);
}

function xmlDecode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function xmlTag(block: string, tag: string) {
  const m = block.match(new RegExp("<" + tag + ">([\\s\\S]*?)<\\/" + tag + ">", "i"));
  return m ? xmlDecode(m[1]) : "";
}

function parseXmlItems(xml: string) {
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return matches.map((match) => {
    const inner = match[1] || "";
    const result: Record<string, string> = {};
    const re = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner))) result[m[1]] = xmlDecode(m[2]);
    return result;
  });
}

function parseXmlTotalCount(xml: string) {
  const value = xmlTag(xml, "totalCount");
  return Number(value || "0") || 0;
}

function assertPublicApiResult(body: string) {
  const code = xmlTag(body, "resultCode");
  if (code && code !== "00" && code !== "000") {
    throw new Error(xmlTag(body, "resultMsg") || "공공데이터 API 오류");
  }
}

function responseItems(json: unknown): JsonRecord[] {
  if (!json || typeof json !== "object") return [];
  const root = json as JsonRecord;
  const response = (root.response && typeof root.response === "object" ? root.response : root) as JsonRecord;
  const body = (response.body && typeof response.body === "object" ? response.body : response) as JsonRecord;
  const items = body.items;
  if (Array.isArray(items)) return items.filter((v): v is JsonRecord => Boolean(v && typeof v === "object"));
  if (items && typeof items === "object") {
    const item = (items as JsonRecord).item;
    if (Array.isArray(item)) return item.filter((v): v is JsonRecord => Boolean(v && typeof v === "object"));
    if (item && typeof item === "object") return [item as JsonRecord];
  }
  const item = body.item;
  if (Array.isArray(item)) return item.filter((v): v is JsonRecord => Boolean(v && typeof v === "object"));
  if (item && typeof item === "object") return [item as JsonRecord];
  return [];
}

function responseTotalCount(json: unknown, fallback: number) {
  if (!json || typeof json !== "object") return fallback;
  const root = json as JsonRecord;
  const response = (root.response && typeof root.response === "object" ? root.response : root) as JsonRecord;
  const body = (response.body && typeof response.body === "object" ? response.body : response) as JsonRecord;
  return Number(body.totalCount ?? fallback) || fallback;
}

async function fetchJsonOrXml(url: URL) {
  const res = await fetch(url, { cache: "no-store" });
  const raw = await res.text();
  if (!res.ok) {
    const endpoint = url.pathname.split("/").slice(-2).join("/");
    const detail = raw.replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`공공데이터 API HTTP ${res.status} (${endpoint})${detail ? ": " + detail : ""}`);
  }
  if (raw.trim().startsWith("{")) {
    const json = JSON.parse(raw);
    const root = json as JsonRecord;
    const response = (root.response && typeof root.response === "object" ? root.response : root) as JsonRecord;
    const header = (response.header && typeof response.header === "object" ? response.header : {}) as JsonRecord;
    const code = text(header.resultCode);
    if (code && code !== "00" && code !== "000") throw new Error(text(header.resultMsg) || "공공데이터 API 오류");
    return { json, raw };
  }
  assertPublicApiResult(raw);
  return { json: null as unknown, raw };
}

function queryUrl(base: string, params: Record<string, string | number>) {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url;
}

async function fetchKaptList(sidoCode: string, key: string) {
  const result: JsonRecord[] = [];
  const rows = 1000;
  for (let pageNo = 1; pageNo <= 30; pageNo++) {
    const url = queryUrl(KAPT_LIST_URL, {
      serviceKey: decodeServiceKey(key),
      sidoCode,
      pageNo,
      numOfRows: rows,
      _type: "json",
    });
    const { json, raw } = await fetchJsonOrXml(url);
    const items = json ? responseItems(json) : parseXmlItems(raw);
    result.push(...items);
    const total = json ? responseTotalCount(json, result.length) : parseXmlTotalCount(raw);
    if (!items.length || result.length >= total || items.length < rows) break;
  }
  return result;
}

async function fetchKaptBasic(kaptCode: string, key: string) {
  const url = queryUrl(KAPT_BASIC_URL, {
    serviceKey: decodeServiceKey(key),
    kaptCode,
    _type: "json",
  });
  const { json, raw } = await fetchJsonOrXml(url);
  const items = json ? responseItems(json) : parseXmlItems(raw);
  return items[0] || null;
}

async function mapInBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

function koreaNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function currentAnalysisDate() {
  const d = koreaNow();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function recentYearMonths(count: number) {
  const d = koreaNow();
  const result: string[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1));
    result.push(String(t.getUTCFullYear()) + String(t.getUTCMonth() + 1).padStart(2, "0"));
  }
  return result;
}

function monthLabels(count: number) {
  return recentYearMonths(count).map((v) => v.slice(0, 4) + "-" + v.slice(4));
}

async function fetchTradeMonth(regionCode: string, yyyymm: string, key: string) {
  const result: Record<string, string>[] = [];
  const rows = 1000;
  for (let pageNo = 1; pageNo <= 20; pageNo++) {
    const url = queryUrl(MOLIT_TRADE_URL, {
      serviceKey: decodeServiceKey(key),
      LAWD_CD: regionCode,
      DEAL_YMD: yyyymm,
      pageNo,
      numOfRows: rows,
    });
    const res = await fetch(url, { cache: "no-store" });
    const xml = await res.text();
    if (!res.ok) {
      const endpoint = url.pathname.split("/").slice(-2).join("/");
      const detail = xml.replace(/\s+/g, " ").slice(0, 240);
      throw new Error(`실거래 API HTTP ${res.status} (${endpoint})${detail ? ": " + detail : ""}`);
    }
    assertPublicApiResult(xml);
    const items = parseXmlItems(xml);
    result.push(...items);
    const total = parseXmlTotalCount(xml);
    if (!items.length || result.length >= total || items.length < rows) break;
  }
  return result;
}

function safeDate(year: number | null, month: number | null, day: number | null) {
  if (!year || !month || !day) return null;
  const iso = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function normalizeTrade(item: Record<string, string>, regionCode: string, complexes: ComplexRow[]): NormalizedTrade | null {
  const aptName = text(item.aptNm);
  const area = numberValue(item.excluUseAr);
  const dealAmount = numberValue(item.dealAmount);
  const year = intValue(item.dealYear);
  const month = intValue(item.dealMonth);
  const day = intValue(item.dealDay);
  const contractDate = safeDate(year, month, day);
  if (!aptName || area == null || dealAmount == null || !contractDate || !year || !month) return null;

  const legalDong = text(item.umdNm) || null;
  const floor = intValue(item.floor);
  const jibun = text(item.jibun) || null;
  const buildYear = intValue(item.buildYear);
  const matched = matchApartmentTrade({
    name: aptName, regionCode, legalDong, jibun, buildYear,
    buildingDong: text(item.aptDong) || null, exclusiveArea: area,
  }, complexes);
  const aptSeq = text(item.aptSeq) || normalizeApartmentName(aptName);
  const cancelled = Boolean(text(item.cdealType) || text(item.cdealDay));
  const priceWon = Math.round(dealAmount * 10000);
  const yearMonth = String(year) + String(month).padStart(2, "0");
  const key = [regionCode, aptSeq, contractDate, area.toFixed(3), priceWon, floor ?? "", jibun ?? ""].join("|");

  return {
    complex_id: matched?.id || null,
    source_apartment_name: aptName,
    normalized_apartment_name: normalizeApartmentName(aptName),
    region_code: regionCode,
    legal_dong: legalDong,
    bjd_code: null,
    contract_date: contractDate,
    contract_year_month: yearMonth,
    exclusive_area: area,
    area_group: Math.floor(area),
    price_won: priceWon,
    floor,
    jibun,
    build_year: buildYear,
    cancelled,
    cancellation_date: null,
    source_trade_key: key,
    raw: item,
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function dateToMs(iso: string) {
  return new Date(iso + "T00:00:00+09:00").getTime();
}

function dayDiff(analysisDate: string, target: string) {
  return Math.floor((dateToMs(analysisDate) - dateToMs(target)) / 86400000);
}

function recommendedAngle(volume: boolean, priceChange: boolean, active: boolean) {
  if (volume) return "최근 거래가 왜 늘었을까?";
  if (priceChange) return "최근 6개월 가격은 얼마나 움직였을까?";
  if (active) return "요즘 얼마에 거래될까?";
  return "최근 거래는 어떻게 움직이고 있을까?";
}

async function upsertInChunks(client: SupabaseClient, table: string, rows: JsonRecord[], onConflict: string, size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    if (!chunk.length) continue;
    const { error } = await client.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

export async function syncApartmentRegion(regionCode: string) {
  const client = createApartmentAdminClient();
  const publicKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!client || !publicKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY와 DATA_GO_KR_SERVICE_KEY 설정이 필요합니다.");
  }

  const { data: region, error: regionError } = await client
    .from("apt_tracked_regions")
    .select("*")
    .eq("region_code", regionCode)
    .eq("enabled", true)
    .maybeSingle();
  if (regionError) throw regionError;
  if (!region) throw new Error("등록되지 않은 분석 지역입니다.");

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await client
    .from("apt_sync_runs")
    .insert({ region_code: regionCode, sync_type: "manual", started_at: startedAt, status: "running" })
    .select("id")
    .single();
  if (runError) throw runError;

  try {
    const kaptList = await fetchKaptList(region.sido_code, publicKey);
    const regionKapt = kaptList.filter((row) => text(row.bjdCode).startsWith(regionCode));

    // The per-complex K-apt detail endpoint may fail or return only part of a
    // record. Read existing verified fields BEFORE upserting so a transient
    // upstream failure cannot erase address, households or use date.
    const { data: existingRows, error: existingError } = await client
      .from("apt_complexes")
      .select("kapt_code,name,legal_dong,bjd_code,address,road_address,households,use_date")
      .eq("region_code", regionCode);
    if (existingError) throw existingError;
    const existingByCode = new Map(
      (existingRows || []).filter(row => row.kapt_code).map(row => [row.kapt_code as string, row])
    );
    let kaptDetailErrors = 0;
    let kaptDetailEmpty = 0;

    const enriched = await mapInBatches(regionKapt, 5, async (row) => {
      const kaptCode = text(row.kaptCode);
      let basic: JsonRecord | null = null;
      if (kaptCode) {
        try {
          basic = await fetchKaptBasic(kaptCode, publicKey);
        } catch {
          kaptDetailErrors++;
        }
        if (!basic) kaptDetailEmpty++;
      }
      const merged = mergeKaptApartmentDetail(row, basic, existingByCode.get(kaptCode));
      return {
        kapt_code: kaptCode || null,
        name: merged.name,
        normalized_name: normalizeApartmentName(merged.name || ""),
        sido: text(row.as1 || region.sido_name) || null,
        sigungu: text(row.as2 || region.region_name) || null,
        legal_dong: merged.legal_dong,
        bjd_code: merged.bjd_code,
        region_code: regionCode,
        address: merged.address,
        road_address: merged.road_address,
        households: merged.households,
        use_date: merged.use_date,
        source: "kapt",
        match_status: "pending",
        updated_at: new Date().toISOString(),
      };
    });

    const validComplexes = enriched.filter((row) => row.kapt_code && row.name) as JsonRecord[];
    const kaptAddressMissing = validComplexes.filter(row => !row.address).length;
    await upsertInChunks(client, "apt_complexes", validComplexes, "kapt_code", 200);

    const { data: complexRows, error: complexError } = await client
      .from("apt_complexes")
      .select("id,kapt_code,name,normalized_name,legal_dong,bjd_code,region_code,address,road_address,households,use_date")
      .eq("region_code", regionCode);
    if (complexError) throw complexError;
    const complexes = (complexRows || []) as ComplexRow[];

    // Durable operator-approved identity aliases must be applied BEFORE
    // both the raw-trade upsert and monthly/snapshot calculations. The SQL
    // trigger separately prevents future imports from silently losing them.
    const { data: approvedRows, error: approvedError } = await client
      .from("apt_verified_source_aliases")
      .select("region_code,legal_dong,jibun,source_apartment_name,build_year,target_complex_id")
      .eq("region_code", regionCode)
      .eq("is_active", true);
    if (approvedError) throw approvedError;
    const aliasKey = (code: string, dong: string | null, lot: string | null,
      source: string, year: number | null) =>
      JSON.stringify([code,dong,lot,source,year]);
    const approvedAliases = new Map((approvedRows || []).map(row => [
      aliasKey(row.region_code,row.legal_dong,row.jibun,row.source_apartment_name,row.build_year),
      row.target_complex_id as string,
    ]));

    const rawTradeMonths = await mapInBatches(recentYearMonths(7), 2, async (ym) => fetchTradeMonth(regionCode, ym, publicKey));
    const normalized = rawTradeMonths
      .flat()
      .map((row) => normalizeTrade(row, regionCode, complexes))
      .filter((row): row is NormalizedTrade => Boolean(row))
      .map(row => {
        const approved = approvedAliases.get(aliasKey(
          row.region_code,row.legal_dong,row.jibun,row.source_apartment_name,row.build_year
        ));
        if (!approved) return row;
        if (row.complex_id && row.complex_id !== approved) {
          throw new Error("국토부 원자료의 자동 단지 매칭이 관리자 승인 결과와 충돌합니다: " +
            row.source_apartment_name + " / " + row.jibun);
        }
        return { ...row, complex_id: approved };
      });

    // The current trade API does not always expose a unique transaction id.
    // Preserve otherwise-identical rows by assigning a deterministic occurrence suffix.
    const occurrenceByKey = new Map<string, number>();
    for (const row of normalized) {
      const baseKey = row.source_trade_key;
      const occurrence = (occurrenceByKey.get(baseKey) || 0) + 1;
      occurrenceByKey.set(baseKey, occurrence);
      if (occurrence > 1) row.source_trade_key = baseKey + "|occ:" + occurrence;
    }

    const tradeRows = normalized.map((row) => ({ ...row, updated_at: new Date().toISOString() })) as unknown as JsonRecord[];
    await upsertInChunks(client, "apt_trades", tradeRows, "source_trade_key", 400);

    const matchedCodes = new Set(normalized.filter((t) => t.complex_id).map((t) => t.complex_id as string));
    if (matchedCodes.size) {
      const { error } = await client
        .from("apt_complexes")
        .update({ match_status: "matched", updated_at: new Date().toISOString() })
        .in("id", [...matchedCodes]);
      if (error) throw error;
    }

    const activeTrades = normalized.filter((t) => t.complex_id && !t.cancelled);
    const monthlyMap = new Map<string, { complexId: string; areaGroup: number; yearMonth: string; prices: number[] }>();
    for (const t of activeTrades) {
      const key = t.complex_id + "|" + t.area_group + "|" + t.contract_year_month;
      const current = monthlyMap.get(key) || {
        complexId: t.complex_id as string,
        areaGroup: t.area_group,
        yearMonth: t.contract_year_month,
        prices: [],
      };
      current.prices.push(t.price_won);
      monthlyMap.set(key, current);
    }
    const monthlyRows = [...monthlyMap.values()].map((group) => ({
      complex_id: group.complexId,
      area_group: group.areaGroup,
      year_month: group.yearMonth.slice(0, 4) + "-" + group.yearMonth.slice(4),
      trade_count: group.prices.length,
      median_price: median(group.prices),
      min_price: Math.min(...group.prices),
      max_price: Math.max(...group.prices),
      calculated_at: new Date().toISOString(),
    })) as unknown as JsonRecord[];
    await upsertInChunks(client, "apt_monthly_stats", monthlyRows, "complex_id,area_group,year_month", 400);

    // A transaction may move from one apartment to another after better lot matching.
    // Prune orphaned month/area rows only AFTER the new raw trades and aggregates
    // were successfully upserted; never delete the underlying government data.
    const { data: removedObsoleteMonthly, error: cleanupError } = await client.rpc(
      "cleanup_apartment_monthly_stats",
      { p_region_code: regionCode, p_months: monthLabels(7) }
    );
    if (cleanupError) throw cleanupError;

    const analysisDate = currentAnalysisDate();
    // Include the current and previous six calendar months, then keep the last
    // six valid monthly prices. This matches the six points shown by the editor.
    const sixMonthLabels = new Set(monthLabels(7));
    const snapshots: JsonRecord[] = [];

    for (const complex of complexes) {
      const own = activeTrades.filter((t) => t.complex_id === complex.id);
      const recent30 = own.filter((t) => {
        const d = dayDiff(analysisDate, t.contract_date);
        return d >= 0 && d <= 29;
      });
      const previous30 = own.filter((t) => {
        const d = dayDiff(analysisDate, t.contract_date);
        return d >= 30 && d <= 59;
      });
      const sixMonth = own.filter((t) => {
        const d = dayDiff(analysisDate, t.contract_date);
        return d >= 0 && d <= 182;
      });

      const latestDays = own.length ? Math.min(...own.map((t) => Math.max(0, dayDiff(analysisDate, t.contract_date)))) : null;
      const areaCounts = new Map<number, number>();
      for (const t of sixMonth) areaCounts.set(t.area_group, (areaCounts.get(t.area_group) || 0) + 1);
      const representativeArea = [...areaCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
      const repTrades = representativeArea == null ? [] : sixMonth.filter((t) => t.area_group === representativeArea);

      const repMonthly = monthlyRows
        .filter((r) => r.complex_id === complex.id && r.area_group === representativeArea && sixMonthLabels.has(String(r.year_month)))
        .sort((a, b) => String(a.year_month).localeCompare(String(b.year_month)));
      const validMonthly = repMonthly.filter((r) => r.median_price != null).slice(-6);
      const firstMedian = validMonthly.length ? Number(validMonthly[0].median_price) : null;
      const latestMedian = validMonthly.length ? Number(validMonthly[validMonthly.length - 1].median_price) : null;
      const changePct = firstMedian && latestMedian ? ((latestMedian - firstMedian) / firstMedian) * 100 : null;

      const badgeVolume = recent30.length >= 4 &&
        recent30.length - previous30.length >= 2 &&
        (previous30.length === 0 || recent30.length / previous30.length >= 1.5);
      const badgeActive = sixMonth.length >= 12 && recent30.length >= 3;
      const badgePrice = validMonthly.length >= 3 && repTrades.length >= 6 && changePct != null && Math.abs(changePct) >= 5;
      const badgeRecent = latestDays != null && latestDays <= 14 && recent30.length >= 3;
      const badgeLarge = (complex.households || 0) >= 1000;
      const marketSignals = [badgeVolume, badgeActive, badgePrice, badgeRecent].filter(Boolean).length;
      const qualified = sixMonth.length >= 6 && latestDays != null && latestDays <= 60 && marketSignals >= 1;
      const status = !qualified ? "hold" : marketSignals >= 2 ? "priority" : "candidate";

      snapshots.push({
        analysis_date: analysisDate,
        complex_id: complex.id,
        region_code: regionCode,
        households: complex.households,
        recent_30_count: recent30.length,
        previous_30_count: previous30.length,
        six_month_count: sixMonth.length,
        days_since_last_trade: latestDays,
        representative_area_group: representativeArea,
        representative_area_six_month_count: repTrades.length,
        first_median_price: firstMedian,
        latest_median_price: latestMedian,
        six_month_change_pct: changePct == null ? null : Number(changePct.toFixed(3)),
        badge_volume_increase: badgeVolume,
        badge_active_trading: badgeActive,
        badge_price_change: badgePrice,
        badge_recent_trade: badgeRecent,
        badge_large_complex: badgeLarge,
        market_signal_count: marketSignals,
        candidate_status: status,
        recommended_angle: recommendedAngle(badgeVolume, badgePrice, badgeActive),
        created_at: new Date().toISOString(),
      });
    }

    await upsertInChunks(client, "apt_candidate_snapshots", snapshots, "analysis_date,complex_id", 300);

    // Refresh the independent source-only review queue AFTER raw trades and
    // monthly statistics have been reconciled. Never auto-create a verified
    // K-apt complex from an unmatched MOLIT apartment name or parcel.
    const { data: sourceQueueRefresh, error: sourceQueueError } = await client.rpc(
      "refresh_apartment_unmatched_candidates",
      { p_region_code: regionCode, p_analysis_date: analysisDate }
    );
    if (sourceQueueError) throw sourceQueueError;
    const unmatchedSourceGroups = Number(
      (sourceQueueRefresh as Record<string, unknown> | null)?.activeCandidatesUpserted || 0
    );

    const candidateCount = snapshots.filter((s) => s.candidate_status !== "hold").length;
    const priorityCount = snapshots.filter((s) => s.candidate_status === "priority").length;

    const finishedAt = new Date().toISOString();
    await client.from("apt_tracked_regions").update({ last_synced_at: finishedAt, updated_at: finishedAt }).eq("region_code", regionCode);
    await client.from("apt_sync_runs").update({
      finished_at: finishedAt,
      status: "success",
      complex_count: complexes.length,
      trade_count: normalized.length,
      matched_trade_count: activeTrades.length,
      candidate_count: candidateCount,
      priority_count: priorityCount,
      kapt_detail_missing_count: kaptDetailEmpty,
      kapt_detail_error_count: kaptDetailErrors,
      kapt_address_missing_count: kaptAddressMissing,
    }).eq("id", run.id);

    return {
      success: true,
      regionCode,
      analysisDate,
      complexes: complexes.length,
      trades: normalized.length,
      matchedTrades: activeTrades.length,
      obsoleteMonthlyRowsRemoved: Number(removedObsoleteMonthly || 0),
      unmatchedSourceGroups,
      kaptDetailEmpty,
      kaptDetailErrors,
      kaptAddressMissing,
      candidates: candidateCount,
      priorityCandidates: priorityCount,
    };
  } catch (error) {
    let message = "알 수 없는 오류";
    if (error instanceof Error) {
      message = error.message;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }
    await client.from("apt_sync_runs").update({
      finished_at: new Date().toISOString(),
      status: "failed",
      error_message: message.slice(0, 1000),
    }).eq("id", run.id);
    throw error;
  }
}


/**
 * Recheck ONE existing K-apt record, filling previously unknown non-identity
 * attributes only. Conflicting verified data and identity fields are never
 * silently rewritten; raw trades and historical aggregates are untouched.
 */
export async function refetchKaptComplexBasics(complexId: string) {
  const client = createApartmentAdminClient();
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!client || !key) throw new Error("관리자 DB 키와 공공데이터 인증키가 필요합니다.");
  const { data: current, error: currentError } = await client
    .from("apt_complexes")
    .select("id,kapt_code,name,bjd_code,address,road_address,households,use_date,updated_at")
    .eq("id", complexId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current || !current.kapt_code) throw new Error("K-apt 코드가 연결된 기존 단지만 재수집할 수 있습니다.");
  const basic = await fetchKaptBasic(current.kapt_code, key);
  if (!basic || Object.keys(basic).length === 0)
    throw new Error("K-apt 기본정보 응답이 비어 있습니다. 기존 값을 변경하지 않았습니다.");
  const merged = mergeKaptApartmentDetail({}, basic, current);
  const conflicts: string[] = [];
  const normal = (v: unknown) => String(v ?? "").trim().replace(/\s+/g,"");
  if (basic.kaptName && current.name && normal(basic.kaptName) !== normal(current.name))
    conflicts.push("단지명 불일치");
  if (basic.bjdCode && current.bjd_code && normal(basic.bjdCode) !== normal(current.bjd_code))
    conflicts.push("법정동 코드 불일치");
  const fields = ["address","road_address","households","use_date"] as const;
  const fill: Record<string,unknown> = {};
  for (const field of fields) {
    const oldValue = current[field];
    const newValue = merged[field];
    if ((oldValue === null || oldValue === "") && newValue != null && newValue !== "")
      fill[field] = newValue;
    else if (oldValue != null && oldValue !== "" && newValue != null && newValue !== "" &&
      normal(oldValue) !== normal(newValue)) conflicts.push(field + " 기존값과 신규값 불일치");
  }
  // Identity disagreement requires a separate official-source review before
  // even benign-looking fields can be filled.
  const identityConflict = conflicts.some(v => v === "단지명 불일치" || v === "법정동 코드 불일치");
  if (identityConflict) return { status:"hold", complexId, filled:[], conflicts,
    message:"신원 정보가 서로 달라 기존 DB를 변경하지 않았습니다." };
  if (Object.keys(fill).length) {
    const { data: changed, error: updateError } = await client
      .from("apt_complexes")
      .update({ ...fill, updated_at:new Date().toISOString() })
      .eq("id",current.id).eq("updated_at",current.updated_at)
      .select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!changed) throw new Error("조회 이후 단지 정보가 변경되었습니다. 새로 조회한 뒤 다시 시도해 주세요.");
  }
  return { status:conflicts.length?"review":"ok", complexId,
    filled:Object.keys(fill), conflicts,
    message:conflicts.length?"비어 있던 항목만 보완했습니다. 충돌한 기존값은 유지했습니다.":"기본정보를 재확인했습니다." };
}
