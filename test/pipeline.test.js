const test = require('node:test');
const assert = require('node:assert');
delete process.env.GEMINI_API_KEY; // tests run in demo mode
const { retrieve } = require('../lib/retrieval');
const { verifyRisks, verifyMemo } = require('../lib/verifier');
const { runAgent, library } = require('../lib/agents');
const statutes = require('../data/statutes.json');
const samples = require('../data/samples.json');

test('retrieval finds the right official sections from English, Bangla and Banglish', () => {
  const ids = (issue, text) => retrieve({ issue_type: issue, text }, statutes).map(r => r.id);
  assert.ok(ids('rent', 'landlord took three months advance, no receipt').includes('prca-1991-s10'));
  assert.ok(ids('rent', 'বাড়িওয়ালা রসিদ দেয় না').includes('prca-1991-s13'));
  assert.ok(ids('wages', 'আমার বেতন বকেয়া').includes('bla-2006-s123'));
  assert.ok(ids('wages', 'amar beton 2 mash bokeya').includes('bla-2006-s132'));
  assert.ok(ids('consumer', 'they delivered the wrong phone').includes('crpa-2009-s45'));
  assert.match(retrieve({ text: 'I want a refund for a defective phone' }, statutes)[0].id, /^crpa-2009-/);
  assert.deepStrictEqual(retrieve({ text: 'weather today' }, statutes), []);
  const rent = ids('rent', 'advance is non-refundable, salary, refund');
  assert.ok(rent.length <= 7 && rent.every(id => id.startsWith('prca-1991-')), 'entries for other issue types are excluded');
  for (const core of ['prca-1991-s10', 'prca-1991-s13', 'prca-1991-s29']) assert.ok(ids('rent', 'repair').includes(core), 'core sections are always offered');
});

test('statute library holds official text for all three Acts', () => {
  const acts = new Set(statutes.map(e => e.act_name));
  assert.deepStrictEqual([...acts].sort(), ['Bangladesh Labour Act', 'Consumer Rights Protection Act', 'Premises Rent Control Act']);
  assert.ok(statutes.length > 90);
  assert.ok(statutes.every(e => e.text_bn && e.source_type === 'official' && /bdlaws\.minlaw\.gov\.bd/.test(e.source_url)));
  assert.strictEqual(new Set(statutes.map(e => e.id)).size, statutes.length, 'ids are unique');
  assert.ok(!statutes.some(e => /\u09F0|\d\[/.test(e.text_bn)), 'conversion errors and footnote markers are cleaned');
});

test('verifier drops a citation that is not in the library', () => {
  const r = verifyRisks([{ title: 'x', why_it_matters: 'Bad.', citation_id: 'made-up-s1' }], statutes, ['prca-1991-s10']);
  assert.strictEqual(r.risks.length, 0);
  assert.strictEqual(r.removed.length, 1);
});

test('verifier drops a citation the retrieval agent did not supply', () => {
  const r = verifyRisks([{ title: 'x', why_it_matters: 'Bad.', citation_id: 'crpa-2009-s60' }], statutes, ['prca-1991-s10']);
  assert.strictEqual(r.risks.length, 0);
});

test('verifier removes invented section numbers and deadlines from uncited text', () => {
  const r = verifyRisks([{ title: 'x', why_it_matters: 'This is risky. Under section 44 you must act within 15 days. Keep your receipts.', citation_id: null }], statutes, []);
  assert.strictEqual(r.risks[0].why_it_matters, 'This is risky. Keep your receipts.');
  assert.strictEqual(r.removed.length, 1);
});

test('verifier keeps references that match the cited entry, in English and Bangla', () => {
  const en = verifyRisks([{ title: 'x', why_it_matters: 'Section 60 says complain within 30 days.', citation_id: 'crpa-2009-s60', quote: 'within 30 days' }], statutes, ['crpa-2009-s60']);
  assert.strictEqual(en.removed.length, 0);
  assert.strictEqual(en.risks[0].verified_citation, true);
  const bn = verifyRisks([{ title: 'x', why_it_matters: 'ধারা ৬০ অনুযায়ী ৩০ দিনের মধ্যে অভিযোগ করতে হয়।', citation_id: 'crpa-2009-s60', quote: '৩০ দিনের মধ্যে' }], statutes, ['crpa-2009-s60']);
  assert.strictEqual(bn.removed.length, 0);
});

test('verifier removes a quote that is not in the entry', () => {
  const r = verifyRisks([{ title: 'x', why_it_matters: 'Fine.', citation_id: 'crpa-2009-s60', quote: 'within 90 days' }], statutes, ['crpa-2009-s60']);
  assert.strictEqual(r.risks[0].quote, null);
  assert.strictEqual(r.removed.length, 1);
});

test('memo verifier scrubs unsupported law and keeps formatting otherwise', () => {
  const memo = { summary: 'ok', facts: ['Paid rent.'], next_steps: ['File in the Labour Court under the Act of 1999.', 'See legal aid.'], draft_complaint: 'Dear Sir,\n\nPlease pay.' };
  const r = verifyMemo(memo, statutes, []);
  assert.deepStrictEqual(r.memo.next_steps, ['See legal aid.']);
  assert.strictEqual(r.memo.draft_complaint, 'Dear Sir,\n\nPlease pay.');
});

for (const lang of ['en', 'bn']) {
  for (const s of samples) {
    test('full demo pipeline: ' + s.id + ' (' + lang + ')', async () => {
      const base = { sample_id: s.id, lang, text: s['text_' + lang] };
      const document = await runAgent('document', { ...base, document_text: s.document_text });
      const intake = await runAgent('intake', { ...base, document });
      assert.ok(intake.questions.length <= 5);
      const qa = intake.questions.map((q, i) => ({ q, a: s.demo_answers[lang][i] }));
      const triage = await runAgent('triage', { ...base, document, qa });
      assert.strictEqual(triage.issue_type, s.issue_type);
      const found = await runAgent('retrieval', { issue_type: triage.issue_type, text: base.text + ' ' + JSON.stringify(document) });
      const ids = found.entries.map(e => e.id);
      assert.ok(ids.length >= 1);
      const risk = await runAgent('risk', { ...base, document, qa, triage, retrieved_ids: ids });
      const verified = await runAgent('verifier', { risks: risk.risks, retrieved_ids: ids });
      assert.ok(verified.risks.length >= 3, 'at least 3 risks survive verification');
      assert.ok(verified.risks.some(r => r.verified_citation), 'at least one risk has a verified citation');
      if (s.id === 'sample-rent') assert.strictEqual(verified.removed.length, 1, 'the deliberately unsupported claim is removed');
      else assert.strictEqual(verified.removed.length, 0);
      const memo = await runAgent('memo', { ...base, document, qa, triage, risks: verified.risks });
      assert.strictEqual(memo.removed.length, 0);
      assert.ok(memo.memo.draft_complaint.length > 50);
    });
  }
}

test('demo mode refuses free text clearly instead of faking an answer', async () => {
  await assert.rejects(() => runAgent('intake', { text: 'my landlord', lang: 'en' }), /Live AI is not configured/);
});

test('library endpoint hides prepared outputs', () => {
  const lib = library();
  assert.strictEqual(lib.live, false);
  assert.ok(lib.samples.every(s => !s.outputs));
});
