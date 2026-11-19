# Backend

The backend is plain Node.js (version 18 or newer) with **no npm dependencies**. It has two API routes, the seven agents, a wrapper for the Google Gemini API, and the statute library. It stores nothing.

## Files

| File | Purpose |
|---|---|
| `server.js` | Local development server: serves `public/`, routes the API, loads `.env`. Not used on Vercel |
| `api/agent.js` | `POST /api/agent`: runs one agent |
| `api/library.js` | `GET /api/library`: statute library, issue types, sample cases, live-AI status |
| `lib/agents.js` | The seven agents, their prompts, input checks and output clean-up |
| `lib/llm.js` | Gemini API wrapper: model order, retries, time limits, JSON parsing |
| `lib/retrieval.js` | Retrieval agent (plain code). Also runs in the browser for the offline preview |
| `lib/verifier.js` | Verifier agent (plain code). Also runs in the browser for the offline preview |

## API

### `GET /api/library`

Returns everything the browser needs to draw the pages:

```json
{
  "live": true,
  "model": "gemini-3.5-flash-lite",
  "statutes": [ { "id": "prca-1991-s10", "act_name": "Premises Rent Control Act", "section": "10", "text_bn": "...", "...": "..." } ],
  "issue_types": [ { "id": "rent", "label_en": "House rent dispute", "label_bn": "...", "evidence_en": ["..."] } ],
  "samples": [ { "id": "sample-rent", "title_en": "...", "document_text": "...", "demo_answers": { "en": ["..."], "bn": ["..."] } } ]
}
```

The prepared outputs of the sample cases are not sent; only the server uses them.

### `POST /api/agent`

Request:

```json
{ "agent": "risk", "input": { "lang": "en", "sample_id": null, "text": "...", "document": {}, "qa": [], "triage": {}, "retrieved_ids": ["prca-1991-s10"] } }
```

Response:

```json
{ "ok": true, "agent": "risk", "live": true, "fallback": false, "model": "gemini-3.5-flash-lite", "output": { "risks": [] } }
```

- `live`: whether a live AI model produced this output.
- `fallback`: true when the AI failed on a sample case and the prepared output was used instead.
- `model`: which model in the fallback order actually answered.

The server keeps no state between calls. The browser sends what each agent needs.

### Inputs each agent reads

| Agent | Main input fields |
|---|---|
| `document` | `file` (`mime`, base64 `data`) or `document_text` |
| `intake` | `text`, `document` |
| `triage` | `text`, `document`, `qa` |
| `retrieval` | `issue_type`, `text` (all case text joined) |
| `risk` | `text`, `document`, `qa`, `triage`, `retrieved_ids` |
| `verifier` | `risks`, `retrieved_ids` |
| `memo` | `text`, `document`, `qa`, `triage`, `risks` (verified) |

Every agent also accepts `lang` (`en` or `bn`) and `sample_id`.

### Errors

| Status | When | Message shown to the user |
|---|---|---|
| 400 | Missing agent name, unknown agent, no text or document, unsupported file type | Specific message, for example "Unsupported file type. Upload a JPG, PNG, WEBP or PDF." |
| 405 | Wrong HTTP method | "Use POST." |
| 413 | File over about 3 MB | "The file is too large. Upload a file under 3 MB." |
| 429 | AI service limit reached | "The AI service limit has been reached for now. Please wait a minute and try again." |
| 502 | AI service busy, slow or returned something unusable | "The AI service is busy or slow right now. Please wait a minute and try again." |
| 503 | No AI key and the case is not a sample | "Live AI is not configured on this server yet. Open one of the three sample cases..." |
| 500 | Unexpected server error | "Something went wrong on the server." (details only in the server log) |

## Agents (`lib/agents.js`)

Each AI agent builds a prompt from a shared rule set plus its own task and JSON schema (all prompts are in [prompt_library.md](prompt_library.md)), calls the AI wrapper, and then cleans the output:

- Strings are cut to a maximum length; lists to a maximum number of items.
- Fields with a fixed set of values (`urgency`, `confidence`, `issue_type`, `input_style`) fall back to a safe default if the model returns anything else.
- Intake never returns more than 5 questions, and Risk never more than 6 risks.
- If the user wrote in Banglish, Intake sets the reply language to Bangla.
- The Memo agent's output goes through the Verifier before it is returned.

Input limits: user text 4,000 characters; files JPG, PNG, WEBP or PDF up to about 3 MB (the browser also shrinks photos before upload).

## AI wrapper (`lib/llm.js`)

- Calls Gemini's `generateContent` REST endpoint with the key in a header (`x-goog-api-key`), a system instruction, JSON output mode, and a low thinking level for speed. If a model rejects the thinking setting, the wrapper drops it and retries.
- Images and PDFs are sent inline to the Document agent.
- Model order: `GEMINI_MODEL`, then `GEMINI_FALLBACK_MODELS`.
- Each request has a 25-second limit; each agent step has a 50-second limit.
- Busy or rate-limited responses get one retry after 1.5 seconds; slow or retired models are skipped straight away.
- Network errors are treated like a busy model.
- Every request is logged with its model, status and time, for example `[ai] gemini-3.5-flash-lite -> 200 in 3.2 s`. Case text is never logged.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | none | Turns on live AI. Without it the app runs in demo mode |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | First model to try |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.1-flash-lite,gemini-3.7-flash,gemini-3.6-flash` | Models to try next, in order; empty turns fallback off |
| `GEMINI_TIMEOUT_MS` | `25000` | Time limit for one AI request |
| `PORT` | `3000` | Local server port |

Locally these go in `.env` (never committed). On Vercel they are Environment Variables.

## Security

- The AI key is read on the server only.
- The local server refuses paths outside `public/` and stops reading request bodies over 6 MB.
- User text and documents are passed to the model as data, and every prompt tells the model to ignore instructions inside them.
- Error details from the AI provider are logged on the server; users see a plain message.
- `scripts/check-key.js` checks the key and lists usable models without printing the key.
