# Submission

**Event:** International AI Builders Congress 2026, organised by CloudCamp Bangladesh with Daffodil International University
**Competition:** Idea to Unicorn (team)
**Domain:** JusticeSphere AI
**Challenge:** Legal Copilot
**Project:** AinBondhu (আইনবন্ধু)

| Stage | Deadline (Bangladesh time) | Status |
|---|---|---|
| Preliminary Submission | 23:59, Friday 20 November 2026 | In progress |
| Final Submission | 24:00, Thursday 24 December 2026 | Not started |
| Congress Day | Saturday 26 December 2026, Daffodil International University, Ashulia | |

Items in [square brackets] are still to be filled in.

## Links

| Link | Value |
|---|---|
| Prototype (public, no login) | https://ainbondhu-sigma.vercel.app |
| Repository | https://github.com/ibrahim-anis-377/ainbondhu |
| Demo video (required for the final submission) | [YouTube link, public or unlisted] |

## Preliminary Submission fields

### Project name
AinBondhu

### One-line pitch
An AI legal copilot that reads your rental agreement, job letter or receipt in Bangla or English, flags the risks, and prepares your next step, with every legal point tied to the official text of Bangladeshi law.

### Public summary
Most people in Bangladesh facing a rent dispute, unpaid wages or a consumer complaint cannot afford a lawyer and do not know which law protects them. AinBondhu lets them describe the problem by text or voice, or upload the document itself. A pipeline of seven agents extracts the key terms, flags at least three risks, and writes a one-page case memo with a draft complaint. Every legal statement comes from a library of 106 sections of official Bangla law text, and a code-based verifier removes anything it cannot match. It gives general information, not legal advice, and hands users to legal-aid providers.

### Primary team language
Bangla and English

### Problem statement
**Who the user is.** Tenants, wage workers and everyday consumers in Bangladesh who cannot pay for legal advice, many of whom are more comfortable in Bangla than in legal English.

**The problem today.** They sign or receive documents they do not fully understand. When something goes wrong they do not know their rights, what evidence to keep, where to complain, or how long they have. Some remedies have short time limits: a consumer complaint must be made within 30 days (Consumer Rights Protection Act 2009, section 60), and a claim for unpaid wages within 12 months (Bangladesh Labour Act 2006, section 132).

**Why existing solutions fail.** Lawyers are unaffordable for small disputes. Legal-aid offices are few and busy. General AI chatbots answer confidently but can invent section numbers and deadlines. Existing legal AI products are built for law firms and companies, in English.

**Measurable outcome.** For each case, the user leaves with a one-page memo citing official law and a draft complaint in under 10 minutes. We will measure: answers showing an unverified citation as verified (target 0, enforced by the verifier), the helpfulness rating, and the share of users who go on to contact a legal-aid provider.

### Proposed solution
**Product.** A mobile-first, bilingual web app. The user describes a problem (text, Bangla voice or Banglish) or uploads a photo or PDF; AinBondhu returns a triage summary, time limits, risk cards and a case memo with an editable draft complaint.

**AI system architecture.** Seven agents: Intake, Document (reads photos and PDFs), Triage, Retrieval, Risk, Verifier and Memo. Retrieval and Verifier are plain code, not AI. Retrieval selects at most 7 sections of the relevant Act from a library of 106 official sections; the Risk agent may cite only those; the Verifier checks every citation, quote, section number, deadline and court name against the official text and removes what it cannot match. Every result shows how it was made.

**Key features.** Document upload and risk flagging; citations with exact quotes from official text; time limits from the Acts; Bangla, English and Banglish; voice input; a "How this answer was made" panel; refusal of fraud, harassment, forgery and evidence tampering; nothing stored.

**User journey.** Describe or upload, answer up to five questions, see the risks and time limits, read the memo, edit the draft, download it, find help.

**Fit with the challenge.** Legal Copilot asks for a multi-agent system that ingests a raw legal document, identifies at least three non-obvious risks, and generates a verified memorandum citing real statutes. AinBondhu does each of these for three everyday issue types under Bangladeshi law, for citizens rather than law firms.

**Business model.** Free for citizens. Revenue from a paid partner dashboard for NGOs, legal-aid organisations and worker groups, and referral fees from verified lawyers.

### Target user
Primary: low- and middle-income tenants, wage workers and consumers in Bangladeshi cities, starting with Dhaka. Secondary: legal-aid organisations and NGOs that want to screen and prepare cases faster.

### Prototype link or repo
Prototype: https://ainbondhu-sigma.vercel.app
Repository: https://github.com/ibrahim-anis-377/ainbondhu
Both open without login.

### Team roles

| Member | Role | Owns |
|---|---|---|
| Niloy Ghosh (team leader) | Product lead | Submission, demo, pitch |
| Ibrahim Anis | AI and engineering | Agent pipeline, retrieval, deployment |
| Maisha Maliha | Legal domain lead | Checking the statute library, sample cases |
| Zarin Subah Prapty | Business and growth | Partner model, user testing, pitch deck |

### Initial mentor engagement notes
No mentor has been assigned yet. We plan to request one through the platform, and would like guidance on (1) checking the statute library against the official text, (2) evaluating answer quality on real cases, and (3) partnerships with legal-aid organisations.

## How AinBondhu maps to the judging criteria

| Criterion | Weight | Evidence |
|---|---|---|
| Innovation | 20% | Citizen-facing legal copilot in Bangla and Banglish; reads photographed documents; a code-based verifier that removes unsupported legal claims ([architecture.md](architecture.md)) |
| Technical execution | 20% | Seven-agent pipeline; Retrieval and Verifier in plain code; fallback models and time limits; 23 automated tests including a simulated failing AI service ([implementation.md](implementation.md), [simulation_engine.md](simulation_engine.md)) |
| Business model and global readiness | 20% | Free for citizens; paid partner dashboard; lawyer referrals; issue types and Acts added as data ([product_plan.md](product_plan.md)) |
| Real-world impact and ethical AI | 20% | Official law text with source links; "How this answer was made" on every result; refusals; no storage; made-up sample data ([data_source.md](data_source.md)) |
| Scalability and NRB collaboration | 10% | Stateless server; new Acts and issue types added as data through the import script. No NRB or international collaborator yet; the open repository and documentation let remote contributors add Acts |
| Presentation | 10% | Pitch and demo video to be prepared for the final submission and Congress Day |

## Final Submission (24 December): what is still needed

| Item | Status |
|---|---|
| Working demo link | Done: https://ainbondhu-sigma.vercel.app |
| GitHub repository | Done: https://github.com/ibrahim-anis-377/ainbondhu |
| YouTube demo, 3 to 5 minutes, public or unlisted | Not started. Suggested order: problem, solution walkthrough, live demo on a real document, team, call to action |
| Tooling and IDE disclosure | Ready below |
| MCP usage disclosure | Ready below |
| Prompt library | Ready: [prompt_library.md](prompt_library.md) |
| Data and AI provenance | Ready: [data_source.md](data_source.md) |

### Tooling and IDE disclosure
- Google Gemini: drafted the first build prompt; the AI model the app calls at run time.
- Claude (Anthropic): reviewed the prompt against the Congress rules, wrote the app code, tests, import script and documentation.
- Visual Studio Code; Windows PowerShell.
- Memory or context files: none in the repository.

### MCP usage disclosure
The application does not use MCP servers and is not an MCP client.

### Data and AI provenance (short form)
- Law: official Bangla text of 106 sections of the Premises Rent Control Act 1991, the Consumer Rights Protection Act 2009 and the Bangladesh Labour Act 2006, from bdlaws.minlaw.gov.bd, extracted 17 November 2026; each section is marked "team check pending" until checked.
- Sample cases and dashboard numbers: made up by the team and labelled.
- Personal data: none stored; the public demo uses made-up data.
- Models: Google Gemini (`gemini-3.5-flash-lite`, then `gemini-3.1-flash-lite`, `gemini-3.7-flash`, `gemini-3.6-flash`) through Google's API. No training or fine-tuning.

## Before submitting: checklist

- [x] Push the project to a public GitHub repository (check that `.env` is not included)
- [x] Deploy to Vercel with the environment variables in [backend.md](backend.md)
- [x] Open the Vercel link in a private window and run a sample case
- [ ] Paste the Vercel and GitHub links into the form
- [ ] Every member's profile is 100% complete; the team has a logo
- [ ] Team leader clicks Submit before 23:59 on 20 November; links show PASS
