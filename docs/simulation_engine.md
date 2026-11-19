# Simulation engine

AinBondhu does not simulate legal outcomes. It never predicts how a court, landlord or employer will act.

What it does have is a **simulation layer for running and checking the pipeline without depending on a live AI service**. This matters for three reasons: judges must be able to see the full pipeline even if the AI service is busy, the team must be able to demonstrate it without spending AI quota, and the safety checks must be testable against bad AI behaviour on purpose.

The layer has four parts.

## 1. Demo mode (no AI key)

When `GEMINI_API_KEY` is not set, the server runs in demo mode:

| Step | What runs |
|---|---|
| Intake, Document, Triage, Risk, Memo | Prepared output for the sample case, in English or Bangla |
| Retrieval | Runs for real over the official statute library |
| Verifier | Runs for real, on the prepared risks and memo |

So even in demo mode the law is retrieved and every citation is checked live. A banner on every page says demo mode is on, and the result says the output was prepared.

A free-text case in demo mode is refused with a clear message instead of being given made-up output.

## 2. Sample cases with prepared output

`data/samples.json` holds three made-up cases, one per issue type, each with prepared outputs for every AI agent in both languages:

| Sample | Document | Cited sections | What it demonstrates |
|---|---|---|---|
| Landlord asks for three months' advance | Rental agreement | Rent Act s.10 (advance and salami), s.13 (receipts) | Risk flagging on a contract; the **Verifier removing a fake citation** ("section 50", which does not exist) |
| Two months' salary not paid | Appointment letter | Labour Act s.123 (time of payment) | A clause that conflicts with the law; time limits from s.123 and s.132 |
| Wrong phone delivered, refund refused | Sales receipt | Consumer Act s.60 (30-day complaint limit), s.45 (failure to supply promised goods) | Urgency driven by a time limit |

Each sample's quotes are copied from the official text programmatically, so the Verifier accepts them for the right reason. The false citation in the rent sample is labelled in the data as a deliberate demonstration.

## 3. Fallback when the live AI fails

With a key set, if every model fails during a step of a **sample** case (busy, slow, rate-limited or a network error), that step uses the sample's prepared output instead of failing:

- the response is marked `live: false, fallback: true`;
- the result shows "The AI service was unavailable, so this sample shows its prepared output", or, if only some steps fell back, that some steps used it;
- the server log records which agent fell back and why.

For the user's own cases there is no prepared output, so a failure shows "The AI service is busy or slow right now. Please wait a minute and try again."

## 4. Offline single-file preview

`node scripts/build-preview.js` builds `dist/preview.html`: the whole app in one HTML file that runs without a server. It bundles the statute library, the sample cases, the Retrieval and Verifier code and the interface. In the preview:

- Retrieval and Verifier run in the browser, on the same code the server uses;
- AI steps use the prepared sample output with a short simulated delay, so the progress trail can be seen;
- free-text cases show the "live AI is not connected" message.

This is how the app was first shared as a private preview.

## 5. Test harness with a simulated AI provider

`npm test` (or `node --test`) runs 23 tests. The live-AI tests replace the network call with a **fake Gemini API** so they can simulate failures that are hard to produce on demand:

| Simulated behaviour | What the test checks |
|---|---|
| Answer wrapped in a markdown code fence | It is still parsed as JSON |
| Output with wrong types, too many questions, unknown values | Lists are cleaned, at most 5 questions are kept, unknown urgency becomes "medium" |
| Risk with an invented "Section 99 of the Sale of Goods Act, 1930" | The sentence is removed |
| Risk citing an id that does not exist | The risk is removed |
| Memo step saying "Go to the Consumer Court within 7 days" | The sentence is removed; the rest of the memo is kept |
| Model busy twice, then succeeds | Succeeds on the third attempt |
| Model busy every time | Stops after the retries with a plain message |
| First model busy, second retired, third works | Falls through to the third model |
| Model never answers | Abandoned after its time limit; the next model answers |
| Every model hangs | The whole step stops within its time budget |
| A model rejects the thinking setting | The setting is dropped and the request retried |
| AI down during a sample case | Prepared output, marked as fallback; free text still fails clearly |
| Unsupported file type | Rejected before any AI call |

The other tests run all three sample cases end to end in both languages and check that at least 3 risks survive verification, at least one cites the law, the deliberately false citation is removed, and the memo is not altered.

## Limits of the simulation

- Prepared outputs show what a good answer looks like; they do not measure how well the live model does on real cases. That needs an evaluation set of real (anonymised) cases, which does not exist yet.
- The fake AI provider tests the app's handling of AI behaviour, not the quality of the AI's legal reasoning.
