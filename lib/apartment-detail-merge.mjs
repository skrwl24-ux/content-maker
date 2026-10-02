/**
 * Preserve previously verified K-apt detail fields when its per-complex API
 * returns an empty/partial response. Missing values are not zero-valued facts.
 * Do not infer cadastral lots from names or street addresses.
 */
const clean = v => v == null ? "" : String(v).trim();

function firstText(...values) {
  return values.map(clean).find(Boolean) || null;
}
function positiveHouseholds(...values) {
  for (const raw of values) {
    const value=clean(raw).replace(/,/g,"");
    if (!/^\d+$/.test(value)) continue;
    const n=Number(value);
    if (Number.isSafeInteger(n) && n>0) return n;
  }
  return null;
}
function validUseDate(...values) {
  for(const raw of values) {
    const value=clean(raw);
    const digits = /^\d{8}$/.test(value) ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replace(/-/g,"") : "";
    if(!digits) continue;
    const year=Number(digits.slice(0,4)),month=Number(digits.slice(4,6)),day=Number(digits.slice(6,8));
    const parsed=new Date(Date.UTC(year,month-1,day));
    if(year<1900||parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day) continue;
    return digits.slice(0,4)+"-"+digits.slice(4,6)+"-"+digits.slice(6,8);
  }
  return null;
}
export function mergeKaptApartmentDetail(row={}, basic=null, existing=null) {
  return {
    name: firstText(basic?.kaptName,row?.kaptName,existing?.name),
    address: firstText(basic?.kaptAddr,row?.kaptAddr,existing?.address),
    road_address: firstText(basic?.doroJuso,row?.doroJuso,existing?.road_address),
    households: positiveHouseholds(basic?.hoCnt,row?.hoCnt,existing?.households),
    use_date: validUseDate(basic?.kaptUsedate,row?.kaptUsedate,existing?.use_date),
    bjd_code: firstText(basic?.bjdCode,row?.bjdCode,existing?.bjd_code),
    legal_dong: firstText(row?.as3,existing?.legal_dong),
    detailsReceived: !!(basic && typeof basic === "object" && Object.keys(basic).length),
  };
}
