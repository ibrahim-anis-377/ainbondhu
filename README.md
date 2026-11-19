# AinBondhu (আইনবন্ধু)

An AI legal copilot for people in Bangladesh who cannot afford a lawyer. The user describes a problem or uploads a document; seven agents extract the key terms, flag at least three risks, and write a one-page case memo with a draft complaint. Every legal statement must come from a statute library the team has verified.

Built for the International AI Builders Congress 2026. Domain: JusticeSphere AI. Challenge: Legal Copilot.

**General information, not legal advice.**

## Documentation

| Document | What it covers |
|---|---|
| [Product plan](docs/product_plan.md) | Problem, users, scope, business model, status and risks |
| [Architecture](docs/architecture.md) | System diagram, the seven agents, trust boundaries, failure handling |
| [Backend](docs/backend.md) | API, agents, AI wrapper, configuration, security |
| [Frontend](docs/frontend.md) | Pages, case flow, language, accessibility |
| [Data sources](docs/data_source.md) | Official law text and how it was processed, sample data, privacy |
| [Simulation engine](docs/simulation_engine.md) | Demo mode, sample cases, offline preview, simulated AI failures in tests |
| [Implementation](docs/implementation.md) | Technology, how to run and test, design decisions, known limitations |
| [Prompt library](docs/prompt_library.md) | Build prompts and every agent's run-time prompt |
| [Submission](docs/submission.md) | Congress submission text, judging criteria mapping, disclosures |

## Run it on your computer

You need Node.js 18 or newer. There is nothing to install.

```
npm run dev
```

Open http://localhost:3000. Without an AI key the app runs in **demo mode**: the three sample cases show prepared output, while the Retrieval and Verifier steps run for real.

## Turn on live AI

1. Get a free key at https://aistudio.google.com/apikey
2. Copy `.env.example` to `.env` and paste the key after `GEMINI_API_KEY=`.
3. Set `GEMINI_MODEL` to a model your key can use (the model list is in Google AI Studio).
4. Run `npm run dev` again. The banner changes from demo mode to live.

The key is read only on the server and is never sent to the browser. Do not commit `.env`.

Note: the live path has been tested with a simulated AI provider (`test/live-mock.test.js`), not with a real Gemini key. Test it with your own key before the demo.

## Put it online (public link, no login)

1. Push this folder to a GitHub repository.
2. On https://vercel.com choose "Add New Project" and import the repository. Leave the build settings empty.
3. Under Settings, Environment Variables, add `GEMINI_API_KEY` and `GEMINI_MODEL`.
4. Deploy. Vercel serves `public/` as the site and `api/` as serverless functions.

Open the link in a private browser window to confirm it works without login.

## The seven agents

| # | Agent | What it does | How |
|---|---|---|---|
| 1 | Intake | Reads the user's words (Bangla, English or Banglish) and asks up to 5 questions | AI model |
| 2 | Document | Extracts parties, amounts, dates and obligations from a photo or PDF | AI model |
| 3 | Triage | Classifies the issue type and urgency; refuses fraud, harassment, forgery, evidence tampering | AI model |
| 4 | Retrieval | Searches `data/statutes.json` | Plain code |
| 5 | Risk | Flags 3 to 6 risks, each tied to a library entry or marked as a practical risk | AI model |
| 6 | Verifier | Checks every citation and quote against the library; removes invented sections, Acts, courts and deadlines | Plain code |
| 7 | Memo | Writes facts, next steps and an editable draft complaint; its text is verified before it is shown | AI model |

Retrieval and Verifier are ordinary code on purpose: the AI model cannot talk its way past them.

## Project layout

```
api/agent.js        POST /api/agent   runs one agent
api/library.js      GET  /api/library statute library, issue types, samples
lib/agents.js       the seven agents and their prompts
lib/retrieval.js    Retrieval agent
lib/verifier.js     Verifier agent
lib/llm.js          Gemini API wrapper (server side only)
data/statutes.json  the statute library
data/issue-types.json  issue types and evidence checklists
data/samples.json   three made-up sample cases with prepared demo output
public/             the web app (HTML, CSS, JavaScript; no framework)
server.js           local development server
test/               automated tests (npm test)
scripts/build-preview.js  builds one self-contained preview file
```

## The statute library

`data/statutes.json` holds **106 sections of official Bangla law text** from the government's Laws of Bangladesh website (bdlaws.minlaw.gov.bd):

| Act | Sections loaded | Issue type |
|---|---|---|
| Premises Rent Control Act 1991 (বাড়ী ভাড়া নিয়ন্ত্রণ আইন) | 32 of 36 (all except title, rule-making and repeal) | House rent |
| Consumer Rights Protection Act 2009 (ভোক্তা-অধিকার সংরক্ষণ আইন) | 35: definitions, offences (37 to 56), trial and complaints (57 to 65), civil remedies (66 to 68), 70, 76 | Consumer |
| Bangladesh Labour Act 2006 (বাংলাদেশ শ্রম আইন) | 39: appointment and termination, working hours and leave, and the whole wages chapter (120 to 137) | Unpaid wages |

How it was built:

1. The browser saved the Acts' official pages to `data/source/bdlaws-official-bangla.json`.
2. `node scripts/import-bdlaws.js` selects the sections above, corrects a few known font-conversion errors on the source site (for example `ৰ` for `ক্ষ`), removes footnote numbers, and writes `data/statutes.json`. The script lists every correction it makes.

Each section shows an amber **"Official text · team check pending"** badge until a team member checks it. To mark a section checked, compare it with the official page, then fill `verified_by` (name) and `verified_on` (date) in `data/statutes.json`. Re-running the importer keeps these fields.

The time-limit notes (`time_limit_en` / `time_limit_bn`) are short plain-language summaries written for the app, marked `time_limit_is_summary`. Check them too.

The official text is in Bangla; `text_en` is empty. The AI explains the law in English when the user chooses English. If you add an English translation to `text_en`, the app shows it in English mode.

## Add a new issue type

1. Add an object to `data/issue-types.json` with an `id`, labels and evidence lists.
2. Add the Act to `ACTS` in `scripts/import-bdlaws.js` (or add entries to `data/statutes.json` by hand) with that `issue_types` value.
3. Optionally add a sample case to `data/samples.json`.

No code changes are needed.

## Privacy and safety

- Uploaded documents are sent to the server for that request only and are not stored. There are no accounts and no database.
- In live mode the text and document are processed by the Gemini API.
- Photos are shrunk in the browser before upload; files are limited to 3 MB.
- Sample cases and the impact dashboard use made-up data and are labelled.
- The "Find help" page holds placeholders until the team has verified real providers.

## Tests

```
npm test
```

23 tests cover the official statute library, retrieval in English, Bangla and Banglish, the verifier, all three sample cases in both languages, and the live-AI path with a simulated provider.

## Tools used (for the Congress tooling disclosure)

- Google Gemini: first draft of the build prompt; AI model at run time.
- Claude (Anthropic): prompt revision, application code, tests and documentation.
- No MCP servers are used by the application.
