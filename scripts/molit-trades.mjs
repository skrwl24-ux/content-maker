#!/usr/bin/env node
// Codex read-only client for MOLIT apartment SALE transactions.
// Set DATA_GO_KR_SERVICE_KEY as a secret in the Codex execution environment.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENDPOINT = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

function xmlDecode(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
}
export function xmlTag(xml, name) {
  const re = new RegExp('<' + name + '>([\\s\\S]*?)<\\/' + name + '>', 'i');
  return xmlDecode(xml.match(re)?.[1] || '');
}
export function xmlItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
}
function num(value) {
  const raw = String(value || '').replace(/,/g, '').trim();
  if (!raw) return null;
  const valueNum = Number(raw);
  return Number.isFinite(valueNum) ? valueNum : null;
}
export function normalizeTrade(item) {
  const y = num(xmlTag(item, 'dealYear'));
  const m = num(xmlTag(item, 'dealMonth'));
  const d = num(xmlTag(item, 'dealDay'));
  const hasDate = Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
    m >= 1 && m <= 12 && d >= 1 && d <= 31;
  const cdealType = xmlTag(item, 'cdealType');
  const cdealDay = xmlTag(item, 'cdealDay');
  return {
    apartmentName: xmlTag(item, 'aptNm') || null,
    apartmentSequence: xmlTag(item, 'aptSeq') || null,
    legalDong: xmlTag(item, 'umdNm') || null,
    jibun: xmlTag(item, 'jibun') || null,
    exclusiveAreaSqm: num(xmlTag(item, 'excluUseAr')),
    contractDate: hasDate ? y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') : null,
    floor: num(xmlTag(item, 'floor')),
    amountTenThousandKrw: num(xmlTag(item, 'dealAmount')),
    cancelled: Boolean(cdealType || cdealDay),
    cancellationType: cdealType || null,
    cancellationDay: cdealDay || null,
  };
}
export function parseArgs(argv) {
  const valid = new Set(['region','month','name','area','dong','jibun','limit']);
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i+1]) throw new Error('Arguments must be --key value pairs.');
    const key = argv[i].slice(2);
    if (!valid.has(key) || Object.hasOwn(args, key)) throw new Error('Unknown or duplicate option: ' + key);
    args[key] = argv[i+1];
  }
  if (!/^\d{5}$/.test(args.region || '')) throw new Error('--region must be a 5-digit LAWD_CD.');
  if (!/^\d{6}$/.test(args.month || '') || !Number(args.month.slice(4)) || Number(args.month.slice(4)) > 12)
    throw new Error('--month must be YYYYMM (01-12).');
  if (args.area != null && !(Number(args.area) > 0 && Number.isFinite(Number(args.area))))
    throw new Error('--area must be a positive number in square meters.');
  if (args.limit != null && !/^[1-9]\d*$/.test(args.limit)) throw new Error('--limit must be a positive integer.');
  args.limit = Math.min(Number(args.limit || 100), 200);
  return args;
}
export async function queryMolit(args, rawKey, fetchFn = fetch) {
  if (!rawKey) throw new Error('DATA_GO_KR_SERVICE_KEY is not configured in this environment.');
  let serviceKey = rawKey;
  if (rawKey.includes('%')) {
    try { serviceKey = decodeURIComponent(rawKey); }
    catch { throw new Error('Service key encoding is invalid.'); }
  }
  const rawItems = [];
  let totalCount = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(ENDPOINT);
    for (const [k, v] of Object.entries({
      serviceKey, LAWD_CD: args.region, DEAL_YMD: args.month, pageNo: page, numOfRows: PAGE_SIZE
    })) url.searchParams.set(k, String(v));
    let response;
    try { response = await fetchFn(url, { signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error('MOLIT API network request failed. Check Codex network access.'); }
    if (!response.ok) throw new Error('MOLIT API returned HTTP ' + response.status + '.');
    const body = await response.text();
    const resultCode = xmlTag(body, 'resultCode');
    if (resultCode && resultCode !== '00' && resultCode !== '000')
      throw new Error('MOLIT API rejected query (resultCode ' + resultCode + ').');
    if (!body.includes('<response') && !body.includes('<items') && !body.includes('<item>'))
      throw new Error('Unexpected MOLIT API response format.');
    const pageItems = xmlItems(body);
    const count = num(xmlTag(body, 'totalCount'));
    if (count != null) totalCount = count;
    rawItems.push(...pageItems);
    if (!pageItems.length || pageItems.length < PAGE_SIZE || (totalCount != null && rawItems.length >= totalCount)) break;
  }
  const filtered = rawItems.map(normalizeTrade).filter(t =>
    (args.name == null || t.apartmentName === args.name.trim()) &&
    (args.area == null || (t.exclusiveAreaSqm != null && Math.abs(t.exclusiveAreaSqm-Number(args.area)) < 0.00001)) &&
    (args.dong == null || t.legalDong === args.dong.trim()) &&
    (args.jibun == null || t.jibun === args.jibun.trim())
  );
  return {
    source: '국토교통부 아파트 매매 실거래 자료 API',
    sourceEndpoint: ENDPOINT,
    retrievedAt: new Date().toISOString(),
    regionCode: args.region,
    yearMonth: args.month,
    filters: { name: args.name || null, area: args.area ? Number(args.area) : null,
      dong: args.dong || null, jibun: args.jibun || null },
    sourceTotalCount: totalCount,
    fetchedCount: rawItems.length,
    matchingCount: filtered.length,
    returnedCount: Math.min(filtered.length, args.limit),
    truncated: (totalCount != null && rawItems.length < totalCount) || filtered.length > args.limit,
    trades: filtered.slice(0, args.limit),
    notes: [
      '매매 신고 자료만 조회합니다. 전월세 및 현재 매물 호가가 아닙니다.',
      'amountTenThousandKrw의 단위는 만원입니다.',
      'cancelled는 API cdealType/cdealDay에 표시된 계약 해제 여부입니다.',
      '동명 아파트는 apartmentSequence, legalDong, jibun 등으로 대조해야 합니다.',
      '해제 및 정정은 수집 이후 바뀔 수 있습니다. 누락/실패/잘림은 needs_check 처리하세요.'
    ]
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await queryMolit(parseArgs(process.argv.slice(2)), process.env.DATA_GO_KR_SERVICE_KEY);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e) {
    // Never log request URL, request body, raw API error text, or secret values.
    process.stderr.write('ERROR: ' + (e instanceof Error ? e.message : 'Unknown error') + '\n');
    process.exitCode = 1;
  }
}
