/* Builds data/statutes.json from the official Bangla text saved from bdlaws.minlaw.gov.bd.
   Input:  data/source/bdlaws-official-bangla.json  (saved by the browser, see README)
   Run:    node scripts/import-bdlaws.js
   Re-run it whenever the source file is refreshed. Team verification fields are kept. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SOURCE = path.join(root, 'data/source/bdlaws-official-bangla.json');
const OUT = path.join(root, 'data/statutes.json');

/* Which Act covers which issue type, and which sections to load. */
const ACTS = {
  748: {
    code: 'prca-1991', act_name: 'Premises Rent Control Act', act_name_bn: 'বাড়ী ভাড়া নিয়ন্ত্রণ আইন', year: 1991, issue: 'rent',
    include: n => !['1', '34', '35', '36'].includes(n), // everything except title, rule-making and repeal sections
    core: ['10', '13', '29'],
    time_limits: {
      29: { en: 'Complaints about offences under sections 23, 25, 26 or 27 cannot be brought more than six months after the offence (section 29).', bn: 'ধারা ২৩, ২৫, ২৬ বা ২৭ এর অধীন অপরাধের অভিযোগ অপরাধ সংঘটনের ছয় মাস পর আনা যাবে না (ধারা ২৯)।' }
    }
  },
  1014: {
    code: 'crpa-2009', act_name: 'Consumer Rights Protection Act', act_name_bn: 'ভোক্তা-অধিকার সংরক্ষণ আইন', year: 2009, issue: 'consumer',
    include: n => n === '2' || (Number(n) >= 37 && Number(n) <= 68) || ['70', '76'].includes(n), // definitions, offences, trial, civil remedies, complaints
    core: ['60', '76'],
    time_limits: {
      60: { en: 'A complaint must be made to the Director General or an authorised officer within 30 days of the cause of action (section 60).', bn: 'কারণ উদ্ভবের ৩০ দিনের মধ্যে মহাপরিচালক বা ক্ষমতাপ্রাপ্ত কর্মকর্তার কাছে অভিযোগ করতে হবে (ধারা ৬০)।' }
    }
  },
  952: {
    code: 'bla-2006', act_name: 'Bangladesh Labour Act', act_name_bn: 'বাংলাদেশ শ্রম আইন', year: 2006, issue: 'wages',
    include: n => ['3', '4', '5', '20', '22', '23', '26', '27', '30', '31', '33', '100', '102', '103', '108', '115', '116', '117', '118', '119'].includes(n) || (parseInt(n, 10) >= 120 && parseInt(n, 10) <= 137),
    core: ['123', '132'],
    time_limits: {
      30: { en: 'All final dues must be paid within thirty working days after the job ends (section 30).', bn: 'চাকুরী শেষ হওয়ার পর সর্বোচ্চ ত্রিশ কর্মদিবসের মধ্যে সকল পাওনা পরিশোধ করতে হবে (ধারা ৩০)।' },
      123: { en: 'Wages must be paid within seven working days after the end of the wage period, and within thirty working days after the job ends (section 123).', bn: 'মজুরীকাল শেষ হওয়ার পর সাত কর্মদিবসের মধ্যে, এবং চাকুরী অবসানের পর ত্রিশ কর্মদিবসের মধ্যে মজুরী পরিশোধ করতে হবে (ধারা ১২৩)।' },
      132: { en: 'An application to the Labour Court for unpaid or deducted wages must be made within twelve months of the date the wages were due or deducted, unless the court accepts a reason for the delay (section 132).', bn: 'মজুরী প্রদেয় হওয়ার বা কর্তনের তারিখ থেকে বারো মাসের মধ্যে শ্রম আদালতে দরখাস্ত করতে হবে, যদি না আদালত দেরির কারণ গ্রহণ করে (ধারা ১৩২)।' }
    }
  }
};

/* Known conversion errors in the source site's Bangla text (old font conversion).
   Only unambiguous ones are fixed; every fix is counted per section. */
const FIXES = [
  [/ৰ/g, 'ক্ষ'],       // ৰ used for ক্ষ, e.g. ৰতি -> ক্ষতি
  [/রম্্ন|রম্ন/g, 'রু'],     // বিরম্নদ্ধে -> বিরুদ্ধে
  [/সত্দ/g, 'স্ত'],          // দরখাসত্দ -> দরখাস্ত
  [/শিস্ন/g, 'শ্লি'],        // সংশিস্নষ্ট -> সংশ্লিষ্ট
  [/তু্য/g, 'ত্যু'],          // মৃতু্য -> মৃত্যু
  [/বু্য/g, 'ব্যু'],          // ট্রাইবু্যনাল -> ট্রাইব্যুনাল
  [/ঊধের্্ব/g, 'ঊর্ধ্ব'],
  [/সমপর্ক/g, 'সম্পর্ক'],
  [/সমপ্রসা+রি/g, 'সম্প্রসারি'],
  [/সমপ্রসারণ/g, 'সম্প্রসারণ'],
  [/অা/g, 'আ'],
  [/্্/g, '্'],
  [/৷/g, '।']          // ৷ (currency sign) used as the danda
];

const BN = '০১২৩৪৫৬৭৮৯';
const ascii = s => s.replace(/[০-৯]/g, d => String(BN.indexOf(d)));

function sectionNumber(body) {
  const m = ascii(body.slice(0, 40)).match(/^\s*(?:\d+\s*\[\s*)?(\d+[ক-হ]?)\s*[।.৷]/);
  return m ? m[1] : null;
}

function clean(text) {
  let fixes = 0;
  let out = text;
  for (const [re, rep] of FIXES) out = out.replace(re, () => { fixes++; return rep; });
  // Footnote reference numbers from the source page, e.g. "158[" -> "[" (the brackets mark amended text).
  for (let i = 0; i < 2; i++) out = out.replace(/(^|[^\d])\d{1,3}\[\s*/g, (m, pre) => pre + '['); // twice for nested ones like 44[45[
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  return { text: out, fixes };
}

function main() {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  let previous = [];
  try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* first run */ }
  const kept = {};
  previous.forEach(e => { if (e.verified_by) kept[e.id] = { verified_by: e.verified_by, verified_on: e.verified_on, text_en: e.text_en }; });

  const entries = [];
  for (const act of source.acts) {
    const cfg = ACTS[act.id];
    if (!cfg) continue;
    for (const s of act.sections) {
      const n = sectionNumber(s.body);
      if (!n || !cfg.include(n)) continue;
      const body = clean(s.body);
      const head = clean(s.head.replace(/[।৷]\s*$/, ''));
      const id = cfg.code + '-s' + n;
      const tl = cfg.time_limits[n];
      const entry = {
        id,
        act_name: cfg.act_name,
        act_name_bn: cfg.act_name_bn,
        year: cfg.year,
        section: n,
        heading: head.text,
        chapter: clean(s.chapter || '').text,
        text_bn: body.text,
        text_en: '',
        source_url: act.url,
        source_type: 'official',
        source_note: 'Official Bangla text from the Laws of Bangladesh website, extracted ' + String(act.extracted_at).slice(0, 10) + '. ' + (body.fixes + head.fixes) + ' known font-conversion errors corrected for display.',
        verified_by: '',
        verified_on: '',
        issue_types: [cfg.issue],
        core: cfg.core.includes(n)
      };
      if (tl) { entry.time_limit_en = tl.en; entry.time_limit_bn = tl.bn; entry.time_limit_is_summary = true; }
      if (kept[id]) Object.assign(entry, kept[id]); // keep a team member's verification
      entries.push(entry);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(entries, null, 2) + '\n');
  const by = {};
  entries.forEach(e => { by[e.act_name] = (by[e.act_name] || 0) + 1; });
  console.log('Wrote ' + entries.length + ' sections to data/statutes.json');
  Object.keys(by).forEach(k => console.log('  ' + k + ': ' + by[k]));
}

main();
