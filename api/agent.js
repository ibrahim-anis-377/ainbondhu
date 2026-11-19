/* POST /api/agent  { agent: string, input: object }  ->  { ok, agent, live, output } */
const { runAgentDetailed } = require('../lib/agents');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body.agent !== 'string') return res.status(400).json({ ok: false, error: 'Missing agent name.' });
  try {
    const result = await runAgentDetailed(body.agent, body.input);
    return res.status(200).json({ ok: true, agent: body.agent, live: result.live, fallback: result.fallback, model: result.model, output: result.output });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500 && status !== 503) console.error('[agent ' + body.agent + ']', err.message);
    return res.status(status).json({ ok: false, error: status === 500 ? 'Something went wrong on the server.' : err.message });
  }
};
