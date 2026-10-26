import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, normalizeTrade, xmlItems, queryMolit } from '../scripts/molit-trades.mjs';

const tradeXml = '<item><aptNm>테스트아파트</aptNm><aptSeq>41111-TEST</aptSeq><umdNm>정자동</umdNm><jibun>10</jibun><excluUseAr>59.78</excluUseAr><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>21</dealDay><floor>29</floor><dealAmount>128,000</dealAmount><cdealType>O</cdealType><cdealDay>26.10.25</cdealDay></item>';
const xml = '<response><header><resultCode>00</resultCode></header><body><items>' +
  tradeXml + '</items><totalCount>1</totalCount></body></response>';

test('checks required district and month, and validates area', () => {
  assert.equal(parseArgs(['--region','41111','--month','202610','--area','59.78']).region,'41111');
  assert.throws(() => parseArgs(['--region','411','--month','202610']), /region/);
  assert.throws(() => parseArgs(['--region','41111','--month','202613']), /month/);
  assert.throws(() => parseArgs(['--region','41111','--month','202610','--area','invalid']), /area/);
});
test('retains price unit, exact area and source cancellation flags', () => {
  const t = normalizeTrade(xmlItems(xml)[0]);
  assert.equal(t.amountTenThousandKrw, 128000);
  assert.equal(t.exclusiveAreaSqm, 59.78);
  assert.equal(t.contractDate, '2026-10-21');
  assert.equal(t.cancelled, true);
  assert.equal(t.cancellationDay, '26.10.25');
});
test('matches exact area and never returns the service key', async () => {
  const args = parseArgs(['--region','41111','--month','202610','--name','테스트아파트','--area','59.78']);
  const data = await queryMolit(args, 'TEST_SECRET_NOT_FOR_OUTPUT', async (url) => {
    assert.equal(url.searchParams.get('LAWD_CD'), '41111');
    assert.equal(url.searchParams.get('DEAL_YMD'), '202610');
    return { ok:true, text:async()=>xml };
  });
  assert.equal(data.matchingCount,1);
  assert.equal(data.trades[0].cancelled,true);
  assert.equal(JSON.stringify(data).includes('TEST_SECRET_NOT_FOR_OUTPUT'),false);
});
test('fails when environment key missing or API rejects', async () => {
  const args = parseArgs(['--region','41111','--month','202610']);
  await assert.rejects(()=>queryMolit(args,''),/not configured/);
  await assert.rejects(()=>queryMolit(args,'test',async()=>({
    ok:true,text:async()=>'<response><header><resultCode>30</resultCode></header></response>'
  })), /resultCode/);
});
