/* Retrieval agent: deterministic search over the statute library (official Bangla text).
   Questions may be in English, Bangla or Banglish, so English and Banglish words are
   expanded to the Bangla legal terms used in the Acts before matching.
   Works in Node (module.exports) and in the browser (window.ABLib). */
(function (root) {
  /* English / Banglish word (lower case, matched as a word prefix) -> Bangla terms in the Acts. */
  var EXPAND = {
    // house rent
    landlord: ['বাড়ী-মালিক', 'বাড়ীর মালিক'], bariwala: ['বাড়ী-মালিক'], bariwalla: ['বাড়ী-মালিক'], malik: ['মালিক'],
    tenant: ['ভাড়াটিয়া'], varatia: ['ভাড়াটিয়া'], bharatia: ['ভাড়াটিয়া'], rent: ['ভাড়া'], vara: ['ভাড়া'], bhara: ['ভাড়া'],
    advance: ['অগ্রিম', 'অগ্রীম'], ogrim: ['অগ্রিম', 'অগ্রীম'], deposit: ['জামানত', 'অগ্রিম'], security: ['জামানত'], jamanat: ['জামানত'],
    salami: ['সালামী'], premium: ['প্রিমিয়াম', 'সালামী'], receipt: ['রশিদ'], roshid: ['রশিদ'], rosid: ['রশিদ'],
    increase: ['বৃদ্ধি'], raise: ['বৃদ্ধি'], barate: ['বৃদ্ধি'], baray: ['বৃদ্ধি'], standard: ['মানসম্মত'],
    evict: ['উচ্ছেদ'], eviction: ['উচ্ছেদ'], vacate: ['উচ্ছেদ', 'দখল'], ucched: ['উচ্ছেদ'], notice: ['নোটিশ'],
    repair: ['মেরামত'], meramot: ['মেরামত'], electricity: ['বিদ্যুত্', 'বিদ্যুৎ'], water: ['পানি'], gas: ['গ্যাস'],
    controller: ['নিয়ন্ত্রক'], furniture: ['আসবাবপত্র'],
    // wages and work
    wage: ['মজুরী', 'মজুরি'], wages: ['মজুরী', 'মজুরি'], salary: ['মজুরী', 'মজুরি'], pay: ['মজুরী', 'পরিশোধ'], paid: ['পরিশোধ', 'মজুরী'],
    beton: ['মজুরী'], mojuri: ['মজুরী'], bokeya: ['বকেয়া'], unpaid: ['বকেয়া', 'পরিশোধ'], due: ['বকেয়া', 'পাওনা'], dues: ['পাওনা'],
    late: ['বিলম্ব'], delay: ['বিলম্ব'], deduct: ['কর্তন'], deduction: ['কর্তন'], cut: ['কর্তন'], fine: ['জরিমানা'],
    overtime: ['অধিকাল', 'অতিরিক্ত ভাতা'], hours: ['কর্মঘণ্টা'], leave: ['ছুটি'], holiday: ['ছুটি'], chuti: ['ছুটি'],
    appointment: ['নিয়োগপত্র'], letter: ['নিয়োগপত্র'], niyog: ['নিয়োগপত্র'], card: ['পরিচয়পত্র'],
    worker: ['শ্রমিক'], employee: ['শ্রমিক'], sromik: ['শ্রমিক'], employer: ['মালিক'], factory: ['প্রতিষ্ঠান'],
    fired: ['বরখাস্ত', 'অবসান', 'ডিসচার্জ'], dismiss: ['বরখাস্ত'], terminate: ['অবসান'], termination: ['অবসান'], resign: ['অবসান', 'চাকুরীর অবসান'],
    retrench: ['ছাঁটাই'], layoff: ['লে-অফ', 'ছাঁটাই'], final: ['চূড়ান্ত পাওনা'], gratuity: ['গ্রাচুইটি'], court: ['আদালত'], certificate: ['প্রত্যয়নপত্র'],
    // consumer
    consumer: ['ভোক্তা'], vokta: ['ভোক্তা'], buyer: ['ভোক্তা', 'ক্রেতা'], seller: ['বিক্রেতা'], shop: ['বিক্রেতা'],
    complaint: ['অভিযোগ'], complain: ['অভিযোগ'], ovijog: ['অভিযোগ'], obhijog: ['অভিযোগ'],
    refund: ['ক্ষতিপূরণ', 'প্রতিশ্রুত'], wrong: ['প্রতিশ্রুত'], promised: ['প্রতিশ্রুত'], deliver: ['সরবরাহ', 'প্রতিশ্রুত'], delivered: ['সরবরাহ', 'প্রতিশ্রুত'], order: ['সরবরাহ'],
    fake: ['নকল'], counterfeit: ['নকল'], nokol: ['নকল'], adulterated: ['ভেজাল'], vejal: ['ভেজাল'], expired: ['মেয়াদ উত্তীর্ণ'], expiry: ['মেয়াদ'],
    overcharge: ['অধিক মূল্যে', 'ধার্য্যকৃত মূল্য'], price: ['মূল্য'], weight: ['ওজন'], measure: ['পরিমাপ'],
    advertisement: ['বিজ্ঞাপন'], ad: ['বিজ্ঞাপন'], misleading: ['মিথ্যা বিজ্ঞাপন'], defective: ['ত্রুটি'], damage: ['ক্ষতি'], compensation: ['ক্ষতিপূরণ'],
    service: ['সেবা'], hospital: ['সেবা'], negligence: ['অবহেলা'], package: ['মোড়ক'], label: ['মোড়ক']
  };

  function norm(s) {
    return String(s || '').normalize('NFC').toLowerCase()
      .replace(/য়/g, 'য়').replace(/ড়/g, 'ড়').replace(/ঢ়/g, 'ঢ়')
      .replace(/ী/g, 'ি').replace(/ূ/g, 'ু').replace(/[।৷]/g, ' ');
  }

  /* Everyday Bangla words -> the terms the Acts use. */
  var BN_SYN = {
    'বাড়িওয়ালা': ['বাড়ী-মালিক'], 'বাড়িওয়ালা': ['বাড়ী-মালিক'], 'ভাড়াটে': ['ভাড়াটিয়া'], 'রসিদ': ['রশিদ'], 'এডভান্স': ['অগ্রিম', 'অগ্রীম'], 'অ্যাডভান্স': ['অগ্রিম', 'অগ্রীম'],
    'বেতন': ['মজুরী'], 'সেলারি': ['মজুরী'], 'চাকরি': ['চাকুরী'], 'ছাঁটাই': ['ছাঁটাই'], 'ওভারটাইম': ['অধিকাল', 'অতিরিক্ত ভাতা'],
    'রিফান্ড': ['ক্ষতিপূরণ', 'প্রতিশ্রুত'], 'ডেলিভারি': ['সরবরাহ', 'প্রতিশ্রুত'], 'মেয়াদোত্তীর্ণ': ['মেয়াদ উত্তীর্ণ'], 'দোকান': ['বিক্রেতা']
  };
  // Everyday Bangla words that say nothing about the law.
  var STOP = {};
  ['আমার', 'আমি', 'আমাকে', 'আমাদের', 'তিনি', 'তারা', 'তাদের', 'তার', 'উনি', 'এখন', 'কিন্তু', 'এবং', 'অথবা', 'থেকে', 'জন্য', 'দিয়ে', 'নিয়ে', 'নিয়েছে', 'নিয়েছেন', 'দেয়', 'দেন', 'দিচ্ছে', 'দিচ্ছেন', 'দিয়েছে', 'বলছে', 'বলছেন', 'করছে', 'করছেন', 'করে', 'করেছে', 'হয়েছে', 'হবে', 'আছে', 'নেই', 'কোন', 'কোনো', 'কী', 'কি', 'কেন', 'এই', 'সেই', 'মাস', 'দিন', 'টাকা'].forEach(function (w) { STOP[norm(w)] = true; });
  // Common Bangla endings, stripped so "মজুরীর" matches "মজুরী".
  var SUFFIX = /(গুলোর|গুলো|দের|য়ের|ের|কে|তে|েও|টি|টা|র|ে|ও|ই)$/;

  function queryTerms(text) {
    var t = norm(text);
    var terms = {};
    (t.match(/[a-z]+/g) || []).forEach(function (w) {
      Object.keys(EXPAND).forEach(function (k) {
        if (w === k || (k.length >= 4 && w.indexOf(k) === 0)) EXPAND[k].forEach(function (b) { terms[norm(b)] = true; });
      });
    });
    (t.match(/[ঀ-৿\-]+/g) || []).forEach(function (w) {
      var stem = w.replace(SUFFIX, '');
      if (stem.length >= 3 && !STOP[stem] && !STOP[w]) {
        terms[stem] = true;
        Object.keys(BN_SYN).forEach(function (k) { if (stem.indexOf(norm(k)) === 0) BN_SYN[k].forEach(function (b) { terms[norm(b)] = true; }); });
      }
    });
    return Object.keys(terms);
  }

  function count(hay, needle) {
    var n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1 && n < 5) { n++; i += needle.length; }
    return n;
  }

  /**
   * @param {{issue_type?: string, text?: string}} query
   * @param {Array} library entries from data/statutes.json
   * @param {number} k max results
   * @returns {Array<{id:string, score:number, matched:string[]}>}
   */
  function retrieve(query, library, k) {
    k = k || 7;
    var issue = query && query.issue_type;
    var terms = queryTerms(query && query.text);
    var results = [];
    (library || []).forEach(function (entry) {
      var types = entry.issue_types || [];
      // When triage has named the issue, entries filed under other issue types are not eligible.
      if (issue && types.length && types.indexOf(issue) === -1) return;
      var head = norm(entry.heading);
      var body = norm([entry.text_bn, entry.text_en, entry.time_limit_en].join(' '));
      var score = 0, matched = [];
      terms.forEach(function (term) {
        var h = head.indexOf(term) !== -1, b = count(body, term);
        if (h || b) { score += (h ? 4 : 0) + Math.min(b, 3); matched.push(term); }
      });
      (entry.keywords || []).forEach(function (kw) { if (norm(query && query.text).indexOf(norm(kw)) !== -1) { score += 2; matched.push(kw); } });
      // Core sections (where and when to complain, the most common rules) are always offered for their issue type.
      if (issue && entry.core) { score += 3; matched.unshift('core section for ' + issue); }
      if (score > 0) results.push({ id: entry.id, score: score, matched: matched.slice(0, 8) });
    });
    results.sort(function (a, b) { return b.score - a.score || (a.id < b.id ? -1 : 1); });
    var isCore = function (r) { return r.matched[0] === 'core section for ' + issue; };
    var cores = results.filter(isCore);
    return cores.concat(results.filter(function (r) { return !isCore(r); }).slice(0, Math.max(0, k - cores.length)))
      .sort(function (a, b) { return b.score - a.score || (a.id < b.id ? -1 : 1); });
  }

  var api = { retrieve: retrieve, queryTerms: queryTerms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.ABLib = root.ABLib || {}; root.ABLib.retrieve = retrieve; }
})(typeof window !== 'undefined' ? window : globalThis);
