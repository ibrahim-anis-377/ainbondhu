# Data sources

AinBondhu uses three kinds of data: the law (official text), app configuration and made-up sample cases. It stores no user data.

## 1. The law: official text of three Acts

**Source:** Laws of Bangladesh, the official website of the Legislative and Parliamentary Affairs Division, Government of Bangladesh: [bdlaws.minlaw.gov.bd](http://bdlaws.minlaw.gov.bd). The text is the official Bangla text as published there, including amendments incorporated by the site.

**Extracted:** 17 November 2026.

| Act | Official page | Sections loaded | Issue type |
|---|---|---|---|
| Premises Rent Control Act 1991 (বাড়ী ভাড়া নিয়ন্ত্রণ আইন, ১৯৯১) | [act-details-748](http://bdlaws.minlaw.gov.bd/act-details-748.html) | 32 of 36: all except the short title, rule-making, saving and repeal sections | House rent |
| Consumer Rights Protection Act 2009 (ভোক্তা-অধিকার সংরক্ষণ আইন, ২০০৯) | [act-details-1014](http://bdlaws.minlaw.gov.bd/act-details-1014.html) | 35: section 2 (definitions), 37 to 56 (offences and penalties), 57 to 65 (trial, complaints, time limits), 66 to 68 (civil remedies), 70 and 76 | Consumer |
| Bangladesh Labour Act 2006 (বাংলাদেশ শ্রম আইন, ২০০৬) | [act-details-952](http://bdlaws.minlaw.gov.bd/act-details-952.html) | 39: appointment, classification and termination (3, 4, 5, 20, 22, 23, 26, 27, 30, 31, 33), working hours, overtime and leave (100, 102, 103, 108, 115 to 119), and the whole wages chapter (120 to 137) | Unpaid wages |

Total: **106 sections, about 80,000 characters** of Bangla text.

The rest of the Labour Act (369 sections: factories, safety, trade unions and so on) is left out because it does not bear on unpaid wages.

### How it was collected and processed

1. The three official pages were opened in a browser, and each section's heading, chapter and text were saved exactly as displayed to `data/source/bdlaws-official-bangla.json`.
2. `scripts/import-bdlaws.js` turns that file into `data/statutes.json`. Anyone can re-run it and get the same result. It:
   - selects the sections listed above;
   - removes footnote reference numbers that the website places before amended text (for example `158[`), keeping the brackets that mark amendments;
   - corrects a fixed list of known font-conversion errors that appear on the website itself, for example `ৰ` written for `ক্ষ` (`ৰতি` for `ক্ষতি`), `বিরম্নদ্ধে` for `বিরুদ্ধে` and `দরখাসত্দ` for `দরখাস্ত`. Each section records how many corrections were made;
   - keeps any team verification already recorded when it is re-run.

### What each section record holds

| Field | Meaning |
|---|---|
| `id` | For example `prca-1991-s10` (Act code, year, section) |
| `act_name`, `act_name_bn`, `year`, `section`, `heading`, `chapter` | Identification |
| `text_bn` | The official Bangla text of the section |
| `text_en` | Empty. No official English translation is loaded; the AI explains the law in English |
| `source_url`, `source_type`, `source_note` | Where it came from and what processing was applied |
| `verified_by`, `verified_on` | Filled in when a team member has checked the section against the official page |
| `issue_types`, `core` | Which issue type it serves; whether Retrieval always includes it |
| `time_limit_en`, `time_limit_bn` | A plain-language summary of a time limit in the section (only on 5 sections) |

### Time limits

These summaries were written for the app from the official text, and are marked `time_limit_is_summary`.

| Section | Time limit |
|---|---|
| Labour Act, section 123 | Wages within 7 working days after the wage period; within 30 working days after the job ends |
| Labour Act, section 30 | Final dues within 30 working days after the job ends |
| Labour Act, section 132 | Labour Court application within 12 months of the wages being due or deducted |
| Consumer Act, section 60 | Complaint within 30 days of the cause of action |
| Rent Act, section 29 | Complaints about offences under sections 23, 25, 26 or 27 within 6 months |

### Verification status

Every section currently shows **"Official text · team check pending"**. The text comes from the official source, but it was copied automatically and lightly corrected, so a team member still needs to compare each section with the official page and record their name and date.

### Use and licence

The Acts are laws of Bangladesh published by the Government on its official website. AinBondhu shows them with a link to the official page for each section. The app's code is released under the MIT licence (see `package.json`); that licence does not cover the text of the law.

## 2. App configuration

| File | Content | Source |
|---|---|---|
| `data/issue-types.json` | The three issue types, their English and Bangla labels, and evidence checklists | Written by the team |
| `lib/retrieval.js` (word lists) | English and Banglish words (for example "advance", "beton", "salami") and everyday Bangla words (for example বেতন, রসিদ) mapped to the terms used in the Acts (মজুরী, রশিদ) | Written by the team |

## 3. Sample cases

`data/samples.json` holds three cases, one per issue type. **All names, addresses, amounts and documents are made up.** Each sample includes a made-up document (a rental agreement, an appointment letter or a sales receipt), answers to the clarifying questions, and prepared outputs in English and Bangla for every AI agent, used in demo mode (see [simulation_engine.md](simulation_engine.md)).

The rent sample includes one deliberately false citation (a "section 50" that does not exist) to show the Verifier removing it. The prepared output is labelled to say so.

## 4. Impact dashboard

The numbers on the Impact page (128 cases, 4.3 out of 5 and so on) are **demo data**, labelled as such on the page. They will be replaced with real pilot numbers. The only real numbers on that page are the ratings given in the current browser session.

## 5. User data

- **Nothing is stored on the server.** There is no database. Signing in is optional and in demo mode (no SMS is sent); a signed-in user's saved cases and phone number stay in their own browser on their own device.
- A user's text and document are sent to the server only to produce their result and are not saved or logged by AinBondhu.
- In live mode the text and document are processed by the Google Gemini API. The About page tells users this, and asks them not to upload anything they are not comfortable sharing.
- The public demo should use only the made-up sample cases or other made-up or anonymised data.

## 6. AI models

Google Gemini, called from the server through Google's API. The order of models is `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.7-flash`, `gemini-3.6-flash` (configurable). No model was trained or fine-tuned. The models receive only the case and, at most, 7 retrieved sections of law per step.
