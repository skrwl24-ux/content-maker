const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/apartment-bulk/top3-model.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const m = exportsObject;
const work = { ...m.emptyTop3(), region: '테스트 지역', period: '2026-06 ~ 2026-08', area: '84㎡', source: '테스트 원자료', asOf: '2026-09-21', scope: '분석 대상 3곳, 취소 제외', facts: '1. 가단지 12건 / 2. 나단지 8건 / 3. 다단지 5건' };
const topic = '분석 대상 거래건수 TOP3';
const body = `${topic}\n${work.facts}`;
assert.equal(m.imageRequest('00', topic, '', body, work), null, 'unreviewed body must not produce images');
work.confirmedRevision = m.revision(topic, '', body, work);
for (const slot of ['00', '01', '02']) {
  const prompt = m.imageRequest(slot, topic, '', body, work);
  assert.ok(prompt.includes(work.facts) && prompt.includes(body), 'all images share exact reviewed facts and body');
  work.images[slot] = { dataUrl: 'data:image/png;base64,test', revision: work.confirmedRevision };
}
assert.equal(m.exportIssues(topic, '', body, work).length, 0);
assert.equal(m.imageRequest('01', topic, '', body + '변경', work), null);
assert.ok(m.exportIssues(topic, '', body + '변경', work).length > 0, 'stale content blocks export');
work.optionalImage = true;
assert.ok(m.exportIssues(topic, '', body, work).some((item) => item.includes('03')));
work.images['03'] = { dataUrl: 'kept', revision: work.confirmedRevision };
work.optionalImage = false;
assert.equal(m.exportIssues(topic, '', body, work).length, 0);
assert.equal(work.images['03'].dataUrl, 'kept');
assert.equal(m.imageRequest('03', topic, '', body, work), null);
const restored = m.normalizeTop3(JSON.parse(JSON.stringify(work)));
assert.equal(restored.confirmedRevision, work.confirmedRevision);
assert.equal(restored.images['00'].revision, work.confirmedRevision);
assert.equal(m.normalizeTop3().region, '', 'old snapshots have safe defaults');
const other = m.normalizeTop3();
other.images['00'] = { dataUrl: 'other', revision: '' };
assert.notEqual(other.images['00'].dataUrl, work.images['00'].dataUrl);
assert.ok(m.bodyRequest(topic, '', work).includes('순위 확정을 보류'));
console.log('PASS: shared facts, confirmation invalidation, optional image gating, legacy defaults, independent snapshots');

