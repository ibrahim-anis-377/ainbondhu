# Implementation

How AinBondhu is built, how to run and test it, and what is not finished.

## Technology

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ with no npm dependencies | Nothing to install; small attack surface; runs the same locally and on Vercel |
| Frontend | Plain HTML, CSS and JavaScript, no framework or build step | Fast on slow phones; easy for the whole team to read |
| AI | Google Gemini through its REST API | Reads Bangla, English, photos and PDFs; JSON output mode; a free tier for building |
| Law search and checking | Plain JavaScript (Retrieval, Verifier) | Predictable and testable; the AI cannot bypass them |
| Hosting | Vercel (static files plus serverless functions) | Free public link; deploys from GitHub |
| Tests | Node's built-in test runner | No extra tools |

About 1,600 lines of code, plus the data files.

## Repository layout

```
api/                 HTTP routes (serverless functions on Vercel)
lib/                 agents, AI wrapper, Retrieval, Verifier
public/              the web app
data/                statute library, issue types, sample cases
data/source/         official text saved from bdlaws.minlaw.gov.bd
scripts/             import-bdlaws.js, check-key.js, build-preview.js
test/                automated tests
docs/                these documents
server.js            local server
start-ainbondhu.bat  one-click start on Windows
```

## How a case runs

The browser drives the case and calls the server once per agent. The server keeps no state.

1. If a document was given, the browser shrinks a photo (at most 1600 pixels, JPEG) and calls **Document**.
2. It calls **Intake** with the text and the extracted document, and shows up to 5 questions.
3. After the user answers, it calls **Triage**. A refusal or an out-of-scope case stops here.
4. It joins the text, the answers and the document, and calls **Retrieval** with the issue type. Retrieval scores every section of that issue's Act by matching words (English and Banglish words are first mapped to the Bangla terms the Act uses), always adds the core sections for the issue, and returns at most 7.
5. It calls **Risk** with the case and the ids of the retrieved sections. The server sends the model only those sections.
6. It calls **Verifier** with the risks and the same ids.
7. It calls **Memo** with the verified risks. The server checks the memo text with the Verifier before returning it.
8. It shows the result, with the evidence checklist for the issue type from `data/issue-types.json`.

## Running it

| Task | Command |
|---|---|
| Start on Windows | Double-click `start-ainbondhu.bat` |
| Start anywhere | `node server.js`, then open http://localhost:3000 |
| Turn on live AI | Copy `.env.example` to `.env` and add `GEMINI_API_KEY` |
| Check the AI key and list usable models | `node scripts/check-key.js` (never prints the key) |
| Rebuild the statute library | `node scripts/import-bdlaws.js` |
| Build the one-file offline preview | `node scripts/build-preview.js` |
| Run the tests | `node --test` |

Deploying to Vercel: push to GitHub, import the repository in Vercel (framework preset "Other"), add the environment variables listed in [backend.md](backend.md), and deploy.

## Tests

23 automated tests, all passing on 18 November 2026:

- **Statute library:** all three Acts present, every section official with a source link, ids unique, conversion errors and footnote markers cleaned.
- **Retrieval:** finds the right sections from English, Bangla and Banglish questions; excludes other issue types; always includes core sections; returns nothing for unrelated text.
- **Verifier:** drops citations that do not exist or were not retrieved; removes invented section numbers and deadlines; keeps references that match, in English and Bangla; removes quotes not in the section; cleans memo text without changing its formatting.
- **End to end:** all three sample cases in both languages.
- **Live AI path with a simulated provider:** output clean-up, retries, fallback models, time limits, the thinking setting and sample fallback. See [simulation_engine.md](simulation_engine.md).

Manual checks: the app was opened in a headless browser at phone and desktop widths, all pages were loaded in both languages, and the sample cases were run with no console errors. Live AI was run on the team's computer against the Gemini API.

## Design decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Retrieval over a curated library, not model training | The law must be traceable to official text, and updated by editing data | The library must be curated and checked by people |
| Official Bangla text only | The Bangla text is the authoritative text of these Acts; the official site has the current Labour Act in Bangla | English users see Bangla law text, explained in English by the AI |
| Word matching for Retrieval, not AI embeddings | No extra service; predictable; works offline in the preview | Needs word lists for English and Banglish; may miss unusual wording, softened by always including core sections |
| The browser orchestrates the agents | Each server call stays under the 60-second limit on Vercel; the progress trail is real | More requests per case |
| Lighter AI models first | During testing on 17 November 2026 the larger Gemini Flash models were often busy or took over 25 seconds | Lighter models are less capable; quality on real cases is not yet evaluated |
| No storage | Privacy; nothing to secure | No case history, no real usage numbers yet |

## Development history

| Date (2026) | Step |
|---|---|
| 15 Nov | Team drafted the first build prompt with Gemini. Reviewed it against the Congress rules and the Legal Copilot challenge; wrote version 2 (statute library, seven agents, verifier, document upload, business model) |
| 15 Nov | Built the app: agents, Retrieval, Verifier, all pages in English and Bangla, three sample cases, tests, offline preview |
| 15 to 17 Nov | Connected live AI. A retired model and busy models caused errors; added retries, time limits, fallback models, sample fallback and a key checker |
| 17 Nov | Replaced 3 placeholder law summaries with 106 sections of official text from bdlaws.minlaw.gov.bd, with a repeatable import script; rebuilt Retrieval for Bangla text; added a one-click Windows start file |
| 18 Nov | Wrote these documents |

## Known limitations

- **Statute check pending:** every section still needs a team member's check against the official page.
- **Live answer quality not evaluated:** there is no test set of real cases yet, and the lighter models may miss risks.
- **Bangla interface text** was written with AI help and needs a native speaker's review.
- **Find help** has placeholders, not verified providers.
- **Impact numbers** are demo data.
- **Voice input** depends on the browser (Chrome and Edge).
- **Uploads** are limited to about 3 MB; a blurry photo or handwriting can be misread.
- **Only three issue types and three Acts.**

## Tools used to build it

Disclosed as the Congress asks:

| Tool | Used for |
|---|---|
| Google Gemini | Drafting the first build prompt; the AI model the app calls at run time |
| Claude (Anthropic) | Reviewing the prompt against the rules, writing the app code, tests, import script and these documents |
| Visual Studio Code and Windows PowerShell | Editing, running and testing the app |

The app uses no MCP servers. The build prompts and the agent prompts are in [prompt_library.md](prompt_library.md).
