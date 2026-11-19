/* Thin wrapper around the Gemini REST API. The API key stays on the server. */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

function isLive() {
  return !!process.env.GEMINI_API_KEY;
}

function modelName() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
}

/* Models to try, in order. If the main model is busy, slow or retired, the next one is used. */
function modelChain() {
  const extra = (process.env.GEMINI_FALLBACK_MODELS === undefined ? 'gemini-3.1-flash-lite,gemini-3.7-flash,gemini-3.6-flash' : process.env.GEMINI_FALLBACK_MODELS)
    .split(',').map(m => m.trim()).filter(Boolean);
  return [...new Set([modelName(), ...extra])];
}

function settings() {
  const o = module.exports.overrides || {};
  return {
    attemptMs: o.attemptMs || Number(process.env.GEMINI_TIMEOUT_MS) || 25000, // one request
    budgetMs: o.budgetMs || 50000, // everything for one agent step (Vercel stops functions at 60 s)
    waits: o.waits || [1500]
  };
}

let thinkingSupported = true; // switched off for the rest of the run if a model rejects the setting

function buildBody(req, withThinking) {
  const parts = [{ text: req.user }];
  if (req.file && req.file.data) parts.push({ inline_data: { mime_type: req.file.mime, data: req.file.data } });
  const generationConfig = { responseMimeType: 'application/json' };
  // Newer Gemini models think before answering. A low level keeps each step fast.
  if (withThinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  return JSON.stringify({ system_instruction: { parts: [{ text: req.system }] }, contents: [{ role: 'user', parts }], generationConfig });
}

/* One request with a hard time limit that covers both the reply headers and the body. */
async function send(model, req, withThinking, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const res = await fetch(API_BASE + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: buildBody(req, withThinking),
      signal: controller.signal
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: async () => text, json: async () => JSON.parse(text) };
  } catch (e) {
    const timedOut = controller.signal.aborted;
    const msg = timedOut ? 'no answer within ' + Math.round(timeoutMs / 1000) + ' s' : 'network error: ' + e.message;
    return { ok: false, status: timedOut ? 504 : 503, text: async () => msg, json: async () => ({}) };
  } finally {
    clearTimeout(timer);
  }
}

async function post(model, req, timeoutMs) {
  const started = Date.now();
  let res = await send(model, req, thinkingSupported, timeoutMs);
  if (res.status === 400 && thinkingSupported && /thinking/i.test(await res.text())) {
    thinkingSupported = false;
    res = await send(model, req, false, timeoutMs - (Date.now() - started));
  }
  console.log('[ai] ' + model + ' -> ' + res.status + ' in ' + ((Date.now() - started) / 1000).toFixed(1) + ' s');
  return res;
}

/**
 * Ask the model for a JSON object.
 * @param {{system: string, user: string, file?: {mime: string, data: string}}} req
 */
async function generateJson(req) {
  const { attemptMs, budgetMs, waits } = settings();
  const deadline = Date.now() + budgetMs;
  const left = () => deadline - Date.now();
  const models = modelChain();
  let res = null;
  let used = models[0];
  outer:
  for (let m = 0; m < models.length && left() > 2000; m++) {
    used = models[m];
    for (let attempt = 0; ; attempt++) {
      res = await post(used, req, Math.min(attemptMs, left()));
      if (res.ok) break outer;
      // Busy or overloaded: wait briefly and retry the same model once. Slow (504) or retired (404): move on.
      const retrySame = [429, 500, 503].includes(res.status) && attempt < waits.length && left() > waits[attempt] + 2000;
      if (!retrySame) break;
      await new Promise(resolve => setTimeout(resolve, waits[attempt]));
    }
    if (![404, 429, 500, 503, 504].includes(res.status)) break; // a real error such as a bad request: do not try other models
    if (m < models.length - 1 && left() > 2000) console.log('[ai] ' + used + ' unavailable; trying ' + models[m + 1]);
  }
  module.exports.lastModel = used;
  if (!res || !res.ok) {
    const status = res ? res.status : 504;
    const detail = res ? (await res.text()).slice(0, 300) : 'time budget used up';
    console.error('[ai] giving up: ' + status + ' ' + detail);
    let message = 'AI provider error ' + status + ': ' + detail;
    if ([500, 503, 504].includes(status)) message = 'The AI service is busy or slow right now. Please wait a minute and try again.';
    else if (status === 429) message = 'The AI service limit has been reached for now. Please wait a minute and try again.';
    else if (status === 404) message = 'The AI model name is not available (check GEMINI_MODEL): ' + detail;
    const err = new Error(message);
    err.status = status === 429 ? 429 : 502;
    throw err;
  }
  const data = await res.json();
  const text = (((data.candidates || [])[0] || {}).content || {}).parts
    ? data.candidates[0].content.parts.map(p => p.text || '').join('')
    : '';
  if (!text) {
    const err = new Error('The AI model returned no answer (it may have been blocked by a safety filter).');
    err.status = 502;
    throw err;
  }
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch (e) {
    const err = new Error('The AI model returned an answer that was not valid JSON.');
    err.status = 502;
    throw err;
  }
}

module.exports = { isLive, modelName, modelChain, generateJson };
