/**
 * Conservative K-apt / MOLIT apartment transaction matching.
 * A trade's legal-dong + cadastral lot must be unambiguous within the region.
 * Names alone never override an explicitly conflicting lot.
 */
export function normalizeApartmentName(name) {
  return String(name || "").normalize("NFKC").toLowerCase()
    .replace(/아파트/g, "").replace(/\bapt\b/g, "")
    .replace(/[\s·ㆍ.\-_,()[\]{}]/g, "").trim();
}

export function normalizeCadastralLot(value) {
  const raw = String(value || "").normalize("NFKC").replace(/\s+/g, "");
  const parts = raw.match(/^(산)?(\d+)(?:-(\d+))?$/);
  if (!parts) return null;
  return (parts[1] || "") + String(Number(parts[2])) +
    (parts[3] == null ? "" : "-" + String(Number(parts[3])));
}

export function extractApartmentLot(address, legalDong) {
  const source = String(address || "");
  const dong = String(legalDong || "").trim();
  if (!source || !dong) return null;
  const index = source.indexOf(dong);
  if (index < 0) return null;
  const tail = source.slice(index + dong.length).trim();
  const match = tail.match(/^((?:산\s*)?\d+(?:-\d+)?)(?=\s|$)/);
  return match ? normalizeCadastralLot(match[1]) : null;
}

function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  const previous = Array.from({length:b.length+1}, (_, i) => i);
  for (let i=1;i<=a.length;i++) {
    let last=i-1;previous[0]=i;
    for(let j=1;j<=b.length;j++) {
      const old=previous[j];
      previous[j]=Math.min(previous[j]+1,previous[j-1]+1,last+(a[i-1]===b[j-1]?0:1));
      last=old;
    }
  }
  return 1-previous[b.length]/Math.max(a.length,b.length);
}

function yearCompatible(buildYear, useDate) {
  const tradeYear=Number(buildYear);
  const usedYear=Number(String(useDate || "").slice(0,4));
  if (!Number.isInteger(tradeYear) || tradeYear < 1900 ||
      !Number.isInteger(usedYear) || usedYear < 1900) return true;
  return Math.abs(tradeYear-usedYear)<=2;
}

/**
 * Accept matching only when:
 * - the transaction and apartment are in the same region/legal dong;
 * - a source cadastral lot uniquely identifies a complex (and build year does not conflict);
 * - OR the lot is unavailable and the apartment name matches unambiguously.
 * Known, contradictory lots are never overridden by name similarity.
 */
export function matchApartmentTrade(trade, complexes) {
  const name=normalizeApartmentName(trade?.name);
  const region=String(trade?.regionCode || "").trim();
  const legalDong=String(trade?.legalDong || "").trim();
  if (!name || !region || !legalDong || !Array.isArray(complexes)) return null;
  const pool=complexes.filter(c=>String(c.region_code || "").trim()===region &&
    String(c.legal_dong || "").trim()===legalDong);
  if (!pool.length) return null;
  const tradeLot=normalizeCadastralLot(trade.jibun);

  // A single cadastral parcel can contain separate K-apt management complexes.
  // Do NOT use a unique known parcel to override an explicit MOLIT building group.
  // Identity rules below are grounded in the distinct government source names,
  // source building numbers, exclusive areas and construction years. K-apt codes
  // (not generated database UUIDs or a display name) identify their destinations.
  if (region==="41410" && legalDong==="금정동" && tradeLot==="875") {
    const sharedParcelGroups=[
      {source:"퇴계주공(351~359동)",kaptCode:"A43575803",year:1993,
       firstDong:351,lastDong:359,areas:[41.85,42.75]},
      {source:"퇴계주공(360~368동)",kaptCode:"A43582405",year:1995,
       firstDong:360,lastDong:368,areas:[37.67,39.87]},
    ];
    const group=sharedParcelGroups.find(g=>trade.name===g.source);
    if (!group) return null; // Unknown subgroup: hold for verification.
    const building=String(trade.buildingDong??"").trim();
    if (building) {
      const parsed=building.match(/^(\d{3})(?:동)?$/);
      if (!parsed || Number(parsed[1])<group.firstDong ||
          Number(parsed[1])>group.lastDong) return null;
    }
    const area=Number(trade.exclusiveArea);
    if (Number(trade.buildYear)!==group.year ||
        !Number.isFinite(area) ||
        !group.areas.some(v=>Math.abs(v-area)<0.011)) return null;
    const matchingKapt=pool.filter(c=>c.kapt_code===group.kaptCode);
    return matchingKapt.length===1?matchingKapt[0]:null;
  }
  const itemLot=c=>extractApartmentLot(c.address,c.legal_dong);
  const compatible=c=>yearCompatible(trade.buildYear,c.use_date);
  // A government source name containing an explicit building range is itself
  // a sub-complex identity. Do not let a unique cadastral lot or fuzzy name
  // erase that range. Unknown aliases require reviewed mapping first.
  const range=String(trade.name||"").match(/\\(\\s*(\\d{1,4})\\s*[~～-]\\s*(\\d{1,4})\\s*동\\s*\\)/);
  if (range) {
    const building=String(trade.buildingDong??"").trim();
    if (building) {
      const match=building.match(/^(\\d{1,4})(?:동)?$/);
      if (!match || Number(match[1])<Number(range[1]) ||
          Number(match[1])>Number(range[2])) return null;
    }
    const exactGroup=pool.filter(c=>compatible(c) &&
      normalizeApartmentName(c.normalized_name||c.name)===name &&
      (!tradeLot || !itemLot(c) || itemLot(c)===tradeLot));
    return exactGroup.length===1?exactGroup[0]:null;
  }
  if (tradeLot) {
    const sameLot=pool.filter(c=>itemLot(c)===tradeLot);
    if (sameLot.length===1) return compatible(sameLot[0])?sameLot[0]:null;
    if (sameLot.length>1) {
      const exact=sameLot.filter(c=>compatible(c) &&
        normalizeApartmentName(c.normalized_name || c.name)===name);
      return exact.length===1?exact[0]:null;
    }
  }
  // A missing K-apt lot can still permit a strictly unique name match.
  // When the trade supplies a lot, do not match an apartment whose *different*
  // cadastral lot is explicitly recorded.
  const candidatePool=pool.filter(c=>compatible(c) && (!tradeLot || !itemLot(c)));
  const exact=candidatePool.filter(c=>normalizeApartmentName(c.normalized_name || c.name)===name);
  if (exact.length===1) return exact[0];
  if (exact.length>1) return null;
  const scored=candidatePool.map(c=>({complex:c,
    score:similarity(name,normalizeApartmentName(c.normalized_name || c.name))}))
    .sort((a,b)=>b.score-a.score);
  return scored[0] && scored[0].score>=0.90 &&
    (!scored[1] || scored[0].score-scored[1].score>=0.07) ? scored[0].complex : null;
}
