/* Verifier agent: deterministic checks that every legal claim is grounded in
   the statute library. No AI model is involved in this step.
   Works in Node (module.exports) and in the browser (window.ABLib). */
(function (root) {
  var BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  function toAsciiDigits(s) {
    return String(s || '').replace(/[০-৯]/g, function (d) { return String(BN_DIGITS.indexOf(d)); });
  }
  function norm(s) {
    return toAsciiDigits(String(s || '').normalize('NFC').toLowerCase())
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  }
  function splitSentences(text) {
    return String(text || '').split(/(?<=[.!?।])\s+|\n+/).filter(function (s) { return s.trim(); });
  }

  // Patterns that look like a legal reference. Each returns {kind, value}.
  var PATTERNS = [
    { kind: 'section', re: /\b(?:section|sec\.|u\/s)\s*(\d+[a-z]?)/gi },
    { kind: 'section', re: /(?:ধারা)\s*(\d+)/g },
    { kind: 'act', re: /\b(?:act|ordinance|rules|code)\b,?\s*(?:of\s*)?(\d{4})/gi },
    { kind: 'act', re: /(?:আইন|অধ্যাদেশ|বিধিমালা),?\s*(\d{4})/g },
    { kind: 'deadline', re: /\bwithin\s+(\d+)\s*(?:working\s+)?(?:day|month|year)s?/gi },
    { kind: 'deadline', re: /(\d+)\s*(?:কর্ম)?(?:দিন|দিবস|মাস|বছর)(?:ের)?\s*মধ্যে/g },
    { kind: 'court', re: /\b(?:labour|high|supreme|district|magistrate|civil|consumer)\s+court\b/gi },
    { kind: 'court', re: /(?:শ্রম আদালত|হাইকোর্ট|সুপ্রিম কোর্ট|জেলা জজ|ম্যাজিস্ট্রেট আদালত)/g }
  ];

  function findReferences(sentence) {
    var s = toAsciiDigits(sentence);
    var refs = [];
    PATTERNS.forEach(function (p) {
      p.re.lastIndex = 0;
      var m;
      while ((m = p.re.exec(s)) !== null) refs.push({ kind: p.kind, value: (m[1] || m[0]).toLowerCase(), raw: m[0] });
    });
    return refs;
  }

  // Bangla number words used in the Acts, so "within 7 days" can match "সাত কর্মদিবসের মধ্যে".
  var BN_WORDS = [['ত্রিশ', 30], ['নব্বই', 90], ['ষাট', 60], ['পনের', 15], ['বারো', 12], ['বার', 12], ['দশ', 10], ['সাত', 7], ['ছয়', 6], ['ছয়', 6], ['পাঁচ', 5], ['চার', 4], ['তিন', 3], ['দুই', 2], ['এক', 1]];
  function withNumberWords(s) {
    var out = s;
    BN_WORDS.forEach(function (p) { out = out.split(p[0] + ' ').join(p[1] + ' '); });
    return out;
  }
  function entryText(e) {
    var t = norm([e.act_name, e.act_name_bn, e.year, e.section, e.heading, e.text_en, e.text_bn, e.time_limit_en, e.time_limit_bn].join(' '));
    return t + ' ' + withNumberWords(t);
  }

  /** Is this reference supported by at least one of the allowed entries? */
  function supported(ref, entries) {
    return entries.some(function (e) {
      if (ref.kind === 'section') return String(e.section).toLowerCase() === ref.value;
      var hay = entryText(e);
      if (ref.kind === 'act') return String(e.year) === ref.value || hay.indexOf(ref.value) !== -1;
      if (ref.kind === 'deadline') return hay.indexOf(norm(ref.raw)) !== -1 || new RegExp('(^|[^\\d])' + ref.value + '\\s*(?:\\([^)]{0,20}\\)\\s*)?(?:working\\s+|কর্ম\\s*)?(?:day|month|year|দিন|দিবস|মাস|বছর|বৎসর)').test(hay);
      return hay.indexOf(norm(ref.raw)) !== -1;
    });
  }

  /** Remove sentences that contain unsupported legal references. */
  function scrub(text, entries, where, removed) {
    if (!text) return text;
    var kept = [];
    var before = removed.length;
    splitSentences(text).forEach(function (sentence) {
      var bad = findReferences(sentence).filter(function (r) { return !supported(r, entries); });
      if (bad.length) {
        removed.push({ where: where, text: sentence.trim(), reason: 'Legal reference not found in the cited library entries: ' + bad.map(function (b) { return b.raw; }).join(', ') });
      } else kept.push(sentence.trim());
    });
    if (removed.length === before) return text; // nothing removed: keep original formatting
    return kept.join(String(text).indexOf('\n') !== -1 ? '\n' : ' ');
  }

  /**
   * Verify risk cards.
   * @param {Array} risks output of the Risk agent
   * @param {Array} library full statute library
   * @param {string[]} retrievedIds ids the Retrieval agent supplied to the Risk agent
   */
  function verifyRisks(risks, library, retrievedIds) {
    var byId = {};
    (library || []).forEach(function (e) { byId[e.id] = e; });
    var removed = [];
    var checked = 0;
    var out = [];
    (risks || []).forEach(function (r, i) {
      var where = 'Risk ' + (i + 1) + ': ' + (r.title || '');
      var risk = Object.assign({}, r);
      var entry = null;
      if (risk.citation_id) {
        checked++;
        entry = byId[risk.citation_id];
        if (!entry || (retrievedIds && retrievedIds.indexOf(risk.citation_id) === -1)) {
          removed.push({ where: where, text: (risk.why_it_matters || '') + ' [cited: ' + risk.citation_id + ']', reason: entry ? 'Cited entry was not supplied by the Retrieval agent.' : 'Cited entry does not exist in the statute library.' });
          return; // drop the whole claim
        }
        if (risk.quote) {
          checked++;
          if (entryText(entry).indexOf(norm(risk.quote)) === -1) {
            removed.push({ where: where, text: 'Quote: "' + risk.quote + '"', reason: 'Quoted words do not appear in the cited entry.' });
            risk.quote = null;
          }
        }
      }
      risk.why_it_matters = scrub(risk.why_it_matters, entry ? [entry] : [], where, removed);
      risk.title = scrub(risk.title, entry ? [entry] : [], where, removed) || risk.title;
      if (!risk.why_it_matters) return; // nothing left after scrubbing
      risk.verified_citation = !!entry;
      out.push(risk);
    });
    return { risks: out, removed: removed, checked: checked };
  }

  /** Verify memo text against the entries cited by verified risks. */
  function verifyMemo(memo, library, citedIds) {
    var entries = (library || []).filter(function (e) { return (citedIds || []).indexOf(e.id) !== -1; });
    var removed = [];
    var m = Object.assign({}, memo);
    m.summary = scrub(m.summary, entries, 'Memo summary', removed);
    ['facts', 'next_steps'].forEach(function (key) {
      m[key] = (m[key] || []).map(function (line) { return scrub(line, entries, 'Memo ' + key.replace('_', ' '), removed); }).filter(Boolean);
    });
    m.draft_complaint = scrub(m.draft_complaint, entries, 'Draft complaint', removed);
    return { memo: m, removed: removed };
  }

  var api = { verifyRisks: verifyRisks, verifyMemo: verifyMemo, findReferences: findReferences };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.ABLib = root.ABLib || {}; root.ABLib.verifyRisks = verifyRisks; root.ABLib.verifyMemo = verifyMemo; }
})(typeof window !== 'undefined' ? window : globalThis);
