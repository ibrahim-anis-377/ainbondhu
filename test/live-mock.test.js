/* Exercises the live-AI code path with a fake AI provider, so no key or network is needed. */
const test = require('node:test');
const assert = require('node:assert');

test('live pipeline: request shape, output clean-up and verification', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'test-model';
  const calls = [];
  const replies = {
    Document: { doc_type: 'Receipt', text_excerpt: 'x', key_terms: { parties: ['A', 'B'], amounts: ['BDT 100'], dates: [], obligations: 'not-a-list' } },
    Intake: { input_style: 'banglish', summary: 's', questions: ['1', '2', '3', '4', '5', '6', '7'] },
    Triage: { issue_type: 'consumer', urgency: 'extreme', urgency_reason: 'r', unknowns: [], refused: false },
    Risk: { risks: [
      { title: 'Time limit', what_it_says: 'w', why_it_matters: 'Complain within 30 days.', citation_id: 'crpa-2009-s60', quote: 'within 30 days', confidence: 'high' },
      { title: 'Invented', what_it_says: 'w', why_it_matters: 'Section 99 of the Sale of Goods Act, 1930 applies.', citation_id: null, quote: null, confidence: 'high' },
      { title: 'Wrong id', what_it_says: 'w', why_it_matters: 'm', citation_id: 'nope', quote: null, confidence: 'weird' }
    ] },
    Memo: { summary: 's', facts: ['f'], next_steps: ['Go to the Consumer Court within 7 days.', 'See a legal aid provider.'], draft_complaint: 'Dear seller, please refund.' }
  };
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, key: opts.headers['x-goog-api-key'], body });
    const name = /You are the (\w+) agent/.exec(body.contents[0].parts[0].text)[1];
    const payload = JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(replies[name]) + '\n```' }] } }] });
    return { ok: true, status: 200, text: async () => payload };
  };
  try {
    const { runAgent } = require('../lib/agents');
    const doc = await runAgent('document', { file: { mime: 'image/jpeg', data: 'AAAA' }, lang: 'en' });
    assert.deepStrictEqual(doc.key_terms.obligations, []);
    assert.strictEqual(calls[0].body.contents[0].parts[1].inline_data.mime_type, 'image/jpeg');
    assert.ok(calls[0].url.endsWith('/test-model:generateContent'));
    assert.strictEqual(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.strictEqual(calls[0].key, 'test-key');
    const intake = await runAgent('intake', { text: 'ami phone kinechi', document: doc, lang: 'en' });
    assert.strictEqual(intake.questions.length, 5, 'never more than 5 questions');
    assert.strictEqual(intake.reply_lang, 'bn', 'Banglish input is answered in Bangla script');
    const triage = await runAgent('triage', { text: 't', lang: 'bn' });
    assert.strictEqual(triage.urgency, 'medium', 'unknown urgency falls back');
    assert.match(calls[2].body.system_instruction.parts[0].text, /Bangla script/);
    const found = await runAgent('retrieval', { issue_type: triage.issue_type, text: 'refund' });
    const ids = found.entries.map(e => e.id);
    const risk = await runAgent('risk', { text: 't', triage, retrieved_ids: ids, lang: 'en' });
    assert.match(calls[3].body.contents[0].parts[0].text, /crpa-2009-s60/, 'retrieved entries are given to the model');
    const v = await runAgent('verifier', { risks: risk.risks, retrieved_ids: ids });
    assert.deepStrictEqual(v.risks.map(r => r.title), ['Time limit']);
    assert.strictEqual(v.removed.length, 2);
    const memo = await runAgent('memo', { text: 't', triage, risks: v.risks, lang: 'en' });
    assert.deepStrictEqual(memo.memo.next_steps, ['See a legal aid provider.']);
    assert.strictEqual(memo.removed.length, 1);
    await assert.rejects(() => runAgent('document', { file: { mime: 'application/zip', data: 'AAAA' } }), /Unsupported file type/);
  } finally {
    global.fetch = realFetch;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL;
  }
});

test('a busy AI provider is retried, then reported in plain words', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_FALLBACK_MODELS = '';
  const llm = require('../lib/llm');
  llm.overrides = { waits: [1, 1, 1] };
  const realFetch = global.fetch;
  let n = 0;
  try {
    global.fetch = async () => (++n < 3
      ? { ok: false, status: 503, text: async () => 'busy' }
      : { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }) });
    assert.deepStrictEqual(await llm.generateJson({ system: 's', user: 'u' }), { a: 1 });
    assert.strictEqual(n, 3, 'succeeds on the third attempt');
    n = 0;
    global.fetch = async () => { n++; return { ok: false, status: 503, text: async () => 'busy' }; };
    await assert.rejects(() => llm.generateJson({ system: 's', user: 'u' }), /busy or slow right now/);
    assert.strictEqual(n, 4, 'one try plus three retries');
  } finally {
    global.fetch = realFetch; delete llm.overrides; delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_FALLBACK_MODELS;
  }
});

test('a busy or retired model falls through to the next model in the chain', async () => {
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'main'; process.env.GEMINI_FALLBACK_MODELS = 'gone, backup';
  const llm = require('../lib/llm');
  llm.overrides = { waits: [1] };
  const realFetch = global.fetch;
  const seen = [];
  try {
    global.fetch = async url => {
      const model = /models\/([^:]+):/.exec(url)[1]; seen.push(model);
      if (model === 'main') return { ok: false, status: 503, text: async () => 'busy' };
      if (model === 'gone') return { ok: false, status: 404, text: async () => 'retired' };
      return { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) };
    };
    assert.deepStrictEqual(await llm.generateJson({ system: 's', user: 'u' }), { ok: true });
    assert.deepStrictEqual(seen, ['main', 'main', 'gone', 'backup']);
    assert.strictEqual(llm.lastModel, 'backup');
  } finally {
    global.fetch = realFetch; delete llm.overrides;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; delete process.env.GEMINI_FALLBACK_MODELS;
  }
});

test('when the AI service is down, a sample case falls back to prepared output and says so; free text still fails clearly', async () => {
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_FALLBACK_MODELS = '';
  const llm = require('../lib/llm');
  llm.overrides = { waits: [] };
  const realFetch = global.fetch; const realError = console.error; console.error = () => {};
  try {
    global.fetch = async () => ({ ok: false, status: 503, text: async () => 'busy' });
    const { runAgentDetailed } = require('../lib/agents');
    const r = await runAgentDetailed('intake', { sample_id: 'sample-wages', lang: 'en', text: 'x' });
    assert.strictEqual(r.live, false);
    assert.strictEqual(r.fallback, true);
    assert.ok(r.output.questions.length > 0);
    await assert.rejects(() => runAgentDetailed('intake', { lang: 'en', text: 'my own case' }), /busy or slow right now/);
  } finally {
    global.fetch = realFetch; console.error = realError; delete llm.overrides;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_FALLBACK_MODELS;
  }
});

test('a model that never answers is abandoned after the time limit and the next model is used', async () => {
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'stuck'; process.env.GEMINI_FALLBACK_MODELS = 'fast';
  const llm = require('../lib/llm');
  llm.overrides = { attemptMs: 1000, budgetMs: 8000, waits: [1] };
  const realFetch = global.fetch; const realLog = console.log; console.log = () => {};
  const seen = [];
  try {
    global.fetch = (url, opts) => {
      const model = /models\/([^:]+):/.exec(url)[1]; seen.push(model);
      if (model === 'stuck') return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason)));
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"done":true}' }] } }] }) });
    };
    const t0 = Date.now();
    assert.deepStrictEqual(await llm.generateJson({ system: 's', user: 'u' }), { done: true });
    assert.deepStrictEqual(seen, ['stuck', 'fast'], 'a slow model is not retried, the next one is tried');
    assert.ok(Date.now() - t0 < 4000, 'gave up on the stuck model quickly');
    assert.strictEqual(llm.lastModel, 'fast');
  } finally {
    global.fetch = realFetch; console.log = realLog; delete llm.overrides;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; delete process.env.GEMINI_FALLBACK_MODELS;
  }
});

test('the whole step stops within its time budget even if every model hangs', async () => {
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'a'; process.env.GEMINI_FALLBACK_MODELS = 'b,c,d';
  const llm = require('../lib/llm');
  llm.overrides = { attemptMs: 1500, budgetMs: 3500, waits: [] };
  const realFetch = global.fetch; const realLog = console.log; const realErr = console.error; console.log = () => {}; console.error = () => {};
  try {
    global.fetch = (url, opts) => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason)));
    const t0 = Date.now();
    await assert.rejects(() => llm.generateJson({ system: 's', user: 'u' }), /busy or slow/);
    assert.ok(Date.now() - t0 < 5000, 'stopped within the budget');
  } finally {
    global.fetch = realFetch; console.log = realLog; console.error = realErr; delete llm.overrides;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; delete process.env.GEMINI_FALLBACK_MODELS;
  }
});

test('thinking level is requested, and dropped if a model rejects it', async () => {
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'm'; process.env.GEMINI_FALLBACK_MODELS = '';
  const llm = require('../lib/llm');
  const realFetch = global.fetch; const realLog = console.log; console.log = () => {};
  const bodies = [];
  try {
    global.fetch = async (url, opts) => {
      const body = JSON.parse(opts.body); bodies.push(body);
      if (body.generationConfig.thinkingConfig) {
        return { ok: false, status: 400, text: async () => 'Unknown name "thinkingConfig"' };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"x":1}' }] } }] }) };
    };
    assert.deepStrictEqual(await llm.generateJson({ system: 's', user: 'u' }), { x: 1 });
    assert.strictEqual(bodies[0].generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.strictEqual(bodies[1].generationConfig.thinkingConfig, undefined);
  } finally {
    global.fetch = realFetch; console.log = realLog;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; delete process.env.GEMINI_FALLBACK_MODELS;
  }
});
