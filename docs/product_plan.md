# Product plan

**AinBondhu (আইনবন্ধু)** is an AI legal copilot for people in Bangladesh who cannot afford a lawyer. A user describes a problem or uploads a document (a rental agreement, appointment letter, pay slip or receipt). Seven agents extract the key terms, flag at least three risks, and write a one-page case memo with an editable draft complaint. Every legal statement is tied to the official text of Bangladeshi law, and a code-based verifier removes anything it cannot match.

Entry: International AI Builders Congress 2026, competition **Idea to Unicorn**, domain **JusticeSphere AI**, challenge **Legal Copilot**.

AinBondhu gives general information, not legal advice.

## The problem

- Tenants, wage workers and consumers sign or receive documents they do not fully understand.
- When something goes wrong, they do not know which law protects them, what evidence to keep, where to complain, or how long they have.
- Some remedies have short time limits. The Consumer Rights Protection Act 2009, section 60, requires a complaint within 30 days of the cause of action. A worker who waits too long can lose a remedy.
- A lawyer costs more than many small disputes are worth. Legal-aid offices are few and busy.
- General AI chatbots answer confidently but can invent section numbers and deadlines, which is dangerous in legal matters.
- Legal AI products (the Legal Copilot challenge lists Harvey, CoCounsel, Spellbook and Ironclad) are built for law firms and companies, in English.

## Who it is for

| User | Need | What AinBondhu gives them |
|---|---|---|
| Tenant | Understand an agreement; respond to an advance, rent increase or eviction threat | Risk cards citing the Premises Rent Control Act 1991; a draft message to the landlord |
| Wage worker | Get unpaid wages, understand an appointment letter | Risk cards citing the Bangladesh Labour Act 2006; time limits; a draft demand to the employer |
| Consumer | Get a refund or the right product | Risk cards citing the Consumer Rights Protection Act 2009; the 30-day complaint limit; a draft complaint |
| Legal-aid worker or NGO (secondary) | Screen and prepare cases faster | Clients arrive with a one-page memo, extracted document terms and an evidence checklist |

Primary users read Bangla more comfortably than legal English and use phones. The interface is bilingual (Bangla and English), accepts Banglish (Bangla in English letters), and supports Bangla voice input.

## Scope of version 1 (built)

- Three issue types only: house rent disputes, unpaid wages, consumer complaints. Issue types are a configuration file, so more can be added later without redesigning the app.
- Input by text, voice, or a photo or PDF of a document.
- Seven-agent pipeline: Intake, Document, Triage, Retrieval, Risk, Verifier, Memo.
- A statute library of 106 sections of official Bangla text from the government's Laws of Bangladesh website.
- Result: triage summary, time-limit card, risk cards with citations, case memo, draft complaint, PDF download, and a "How this answer was made" panel.
- Three made-up sample cases that run the full pipeline in one click.
- Pages: Find help (placeholders, marked "verify before use"), About (limits, privacy, responsible-AI policy), Impact dashboard (labelled demo data), For partners (pricing outline), How it works (architecture diagram), Statute library.

## Out of scope for version 1

- Legal advice or representation. AinBondhu prepares the user; a person helps them.
- Issue types other than the three above. Other cases are classified "out of scope" and sent to Find help.
- Accounts, saved cases or case history. Nothing is stored.
- Real legal-aid provider contacts. These are placeholders until the team verifies them.

## Business model

| Plan | For | Price |
|---|---|---|
| Citizen | Anyone with a legal problem | Free |
| Partner dashboard | NGOs, legal-aid groups, worker organisations | Monthly fee, to be set with pilot partners |
| Lawyer referral | Verified lawyers who accept referred cases | Referral fee per accepted case, to be set |

Prices are an outline. They will be set with the first pilot partners.

## How we will measure success

None of these has been measured yet; the dashboard in the app shows labelled demo data.

| Measure | Target |
|---|---|
| Answers showing an unverified citation as verified | 0 (enforced by the Verifier) |
| Time from first message to case memo | Under 10 minutes |
| "Was this helpful?" rating | To be set after a pilot |
| Users who contact a legal-aid provider after using the app | To be measured in a pilot |

## Current status (18 November 2026)

| Item | Status |
|---|---|
| Working app (seven agents, three issue types, bilingual) | Built and tested: 23 automated tests pass |
| Official statute text (106 sections) | Loaded; each section still needs a team member's check against the official page |
| Live AI (Google Gemini) | Connected; the larger Gemini models were often overloaded during testing, so the app uses lighter models first and falls back automatically |
| Public link and repository | To be published before the preliminary deadline (20 November 2026) |
| Pilot with real users | Not started |
| Bangla interface text | Written with AI help; needs review by a native speaker on the team |

## Risks and how we handle them

| Risk | Mitigation |
|---|---|
| The AI invents law | It may cite only library entries; a code-based Verifier removes unmatched citations, quotes, section numbers, deadlines and court names |
| The statute text has extraction errors | Official source, reproducible import script, every section marked "team check pending" until checked |
| Users treat it as legal advice | "General information, not legal advice" on every page and in every memo; next steps always include a legal-aid provider |
| Personal data exposure | Nothing is stored; sample cases use made-up details; the public demo should use only made-up or anonymised data |
| AI service is busy or slow | Retries, time limits, fallback models; sample cases fall back to prepared output and say so |
| Misuse | The Triage agent refuses fraud, harassment, forgery and evidence tampering |
