/* Checks the Gemini key in .env without printing it, and tests every model the app uses.
   Run from the project folder:  node scripts/check-key.js */
const fs = require('fs');
const path = require('path');

const env = {};
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {
  console.log('No .env file found in the project folder.');
  process.exit(1);
}

const key = env.GEMINI_API_KEY;
if (!key) { console.log('GEMINI_API_KEY is missing or empty in .env.'); process.exit(1); }
const main = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const fallbacks = (env.GEMINI_FALLBACK_MODELS === undefined ? 'gemini-3.1-flash-lite,gemini-3.7-flash,gemini-3.6-flash' : env.GEMINI_FALLBACK_MODELS)
  .split(',').map(s => s.trim()).filter(Boolean);
const chain = [...new Set([main, ...fallbacks])];
const base = 'https://generativelanguage.googleapis.com/v1beta/models';
const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
console.log('Key found: ' + key.length + ' characters, starting "' + key.slice(0, 4) + '".');

async function call(url, body, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    const text = await res.text();
    let data = {}; try { data = JSON.parse(text); } catch (e) { /* not JSON */ }
    return { status: res.status, data, secs: (Date.now() - t0) / 1000 };
  } catch (e) {
    return { status: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK ERROR', data: { error: { message: e.message } }, secs: (Date.now() - t0) / 1000 };
  } finally { clearTimeout(timer); }
}

(async () => {
  const list = await call(base + '?pageSize=200', null, 20000);
  if (list.status !== 200) {
    const err = list.data.error || {};
    console.log('\nCould not list models (' + list.status + '): ' + (err.message || ''));
    if (list.status === 400 || list.status === 403) console.log('The key looks invalid. Create a new one at https://aistudio.google.com/apikey');
    process.exit(1);
  }
  const names = (list.data.models || []).map(m => m.name.replace('models/', ''));
  console.log('KEY WORKS.\n\nTesting the models the app uses, the same way the app calls them (up to 30 s each):');

  // Same request shape as the app: system instruction, JSON output, low thinking.
  const body = withThinking => ({
    system_instruction: { parts: [{ text: 'Return only a JSON object.' }] },
    contents: [{ role: 'user', parts: [{ text: 'Return {"ok": true}.' }] }],
    generationConfig: Object.assign({ responseMimeType: 'application/json' }, withThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {})
  });
  let working = null;
  for (const model of chain) {
    if (!names.includes(model)) { console.log('  ' + model.padEnd(24) + 'NOT AVAILABLE for this key'); continue; }
    let r = await call(base + '/' + encodeURIComponent(model) + ':generateContent', body(true), 30000);
    let note = '';
    if (r.status === 400) { // maybe the thinking setting is not supported: retry without it
      const again = await call(base + '/' + encodeURIComponent(model) + ':generateContent', body(false), 30000);
      note = ' (thinking setting rejected; without it: ' + again.status + ')';
      if (again.status === 200) r = again;
    }
    const err = (r.data.error || {}).message;
    console.log('  ' + model.padEnd(24) + String(r.status).padEnd(14) + r.secs.toFixed(1) + ' s' + note + (r.status === 200 ? '   OK' : err ? '   ' + err.slice(0, 120) : ''));
    if (r.status === 200 && !working) working = model;
  }
  console.log('');
  if (working) console.log('The app can use: ' + working + (working === main ? ' (your main model).' : '. Set GEMINI_MODEL=' + working + ' in .env for faster answers.'));
  else console.log('No model answered. Copy everything above and send it so the cause can be found.');
})();
