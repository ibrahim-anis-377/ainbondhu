/* AinBondhu front end. No framework: a small hash router and render functions.
   All text from the AI model or the user is escaped before it is shown. */
(function () {
  'use strict';

  var AGENTS = ['intake', 'document', 'triage', 'retrieval', 'risk', 'verifier', 'memo'];
  var ROUTES = ['', 'case', 'samples', 'library', 'help', 'about', 'impact', 'partners', 'how', 'login', 'cases'];
  var MAX_FILE = 3 * 1024 * 1024;
  var state = { lang: 'en', lib: null, loadError: null, menuOpen: false, c: null, ratings: [] };
  var app = document.getElementById('app');

  try { var saved = localStorage.getItem('ab_lang'); if (saved === 'bn' || saved === 'en') state.lang = saved; } catch (e) { /* storage unavailable */ }

  /* ---------- sign-in and saved cases (stored on this device only) ---------- */
  // Demo sign-in: no SMS is sent yet. When an SMS provider is connected, sendCode() and checkCode()
  // are the only two functions that need to change.
  var DEMO_CODE = '123456';
  var MAX_SAVED = 20;
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  state.user = store.get('ab_user');
  state.login = { step: 'phone', phone: '', error: null };
  function normPhone(input) {
    var d = String(input || '').replace(/[০-৯]/g, function (x) { return String('০১২৩৪৫৬৭৮৯'.indexOf(x)); }).replace(/[^\d+]/g, '');
    d = d.replace(/^\+?880/, '0');
    return /^01[3-9]\d{8}$/.test(d) ? d : null;
  }
  function maskPhone(p) { return p ? p.slice(0, 3) + '*****' + p.slice(-3) : ''; }
  function casesKey() { return state.user ? 'ab_cases_' + state.user.phone : null; }
  function savedCases() { return (casesKey() && store.get(casesKey())) || []; }
  function sendCode(phone) { state.login = { step: 'code', phone: phone, error: null }; return true; }
  function checkCode(code) { return String(code || '').replace(/\s/g, '') === DEMO_CODE; }
  function caseRecord(c) {
    var d = document.getElementById('draft');
    if (d && c.memo) c.memo.draft_complaint = d.innerText;
    return {
      id: c.savedId || ('case-' + Date.now()), saved_at: new Date().toISOString(), lang: c.lang, sample_id: c.sample_id,
      text: c.text, document: c.document, triage: c.triage, entryIds: (c.entries || []).map(function (e) { return { id: e.id, score: e.score, matched: e.matched }; }),
      risks: c.risks, verification: c.verification, memo: c.memo, memoRemoved: c.memoRemoved, live: c.live, mixed: c.mixed, model: c.model, trail: c.trail, rated: c.rated
    };
  }
  function saveCase(c) {
    if (!state.user || !c || !c.memo) return false;
    var rec = caseRecord(c); c.savedId = rec.id;
    var list = savedCases().filter(function (x) { return x.id !== rec.id; });
    list.unshift(rec);
    return store.set(casesKey(), list.slice(0, MAX_SAVED));
  }
  function openSaved(id) {
    var rec = savedCases().filter(function (x) { return x.id === id; })[0]; if (!rec) return;
    var c = newCase(null);
    Object.keys(rec).forEach(function (k) { if (k !== 'entryIds' && k !== 'saved_at') c[k] = rec[k]; });
    c.entries = (rec.entryIds || []).map(function (x) { return Object.assign({ score: x.score, matched: x.matched }, entryById(x.id)); }).filter(function (e) { return e.id; });
    c.savedId = rec.id; c.stage = 'result'; c.fromSaved = true;
    state.c = c; go('case');
  }

  /* ---------- helpers ---------- */
  function t(key) { var s = window.AB_STRINGS[state.lang]; return (s && s[key]) || window.AB_STRINGS.en[key] || key; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function L(obj, base) { return obj[base + '_' + state.lang] || obj[base + '_en'] || ''; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function route() { var r = location.hash.replace(/^#\/?/, '').split('?')[0]; if (r === 'home') r = ''; return ROUTES.indexOf(r) === -1 ? '' : r; }
  function go(r) { if (route() === r) render(); else location.hash = '#' + (r || 'home'); }
  function issueLabel(id) { var it = (state.lib.issue_types || []).filter(function (x) { return x.id === id; })[0]; return it ? L(it, 'label') : id; }
  function entryById(id) { return (state.lib.statutes || []).filter(function (e) { return e.id === id; })[0]; }
  function list(items) { return '<ul>' + (items || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }

  /* ---------- API layer (server, or bundled offline preview) ---------- */
  var OFF = window.AB_OFFLINE || null;
  function apiLibrary() {
    if (OFF) return Promise.resolve({ live: false, model: null, statutes: OFF.statutes, issue_types: OFF.issue_types, samples: OFF.samples.map(function (s) { var c = Object.assign({}, s); delete c.outputs; return c; }) });
    return fetch('api/library').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function offlineAgent(agent, input) {
    var lang = input.lang === 'bn' ? 'bn' : 'en';
    if (agent === 'retrieval') {
      var hits = window.ABLib.retrieve({ issue_type: input.issue_type, text: input.text }, OFF.statutes, 5);
      return { entries: hits.map(function (h) { return Object.assign({ score: h.score, matched: h.matched }, OFF.statutes.filter(function (e) { return e.id === h.id; })[0]); }), library_size: OFF.statutes.length };
    }
    if (agent === 'verifier') return window.ABLib.verifyRisks(input.risks, OFF.statutes, input.retrieved_ids);
    var sample = OFF.samples.filter(function (s) { return s.id === input.sample_id; })[0];
    if (!sample) { var err = new Error(t('need_live')); throw err; }
    var out = JSON.parse(JSON.stringify(sample.outputs[lang][agent]));
    if (agent === 'intake') out.reply_lang = lang;
    if (agent === 'memo') {
      var cited = (input.risks || []).filter(function (r) { return r.verified_citation; }).map(function (r) { return r.citation_id; });
      var v = window.ABLib.verifyMemo(out, OFF.statutes, cited);
      return { memo: v.memo, removed: v.removed, cited_ids: cited };
    }
    return out;
  }
  function apiAgent(agent, input) {
    if (OFF) return new Promise(function (resolve, reject) { setTimeout(function () { try { resolve({ live: false, output: offlineAgent(agent, input) }); } catch (e) { reject(e); } }, 450); });
    return fetch('api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: agent, input: input }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }); })
      .then(function (data) { if (!data.ok) throw new Error(data.error || 'Request failed'); return data; });
  }

  /* ---------- case state ---------- */
  function newCase(sample) {
    var c = { stage: 'input', sample_id: sample ? sample.id : null, text: sample ? L(sample, 'text') : '', file: null, document_text: sample ? sample.document_text : '', document_name: sample ? sample.document_name : '',
      lang: state.lang, document: null, intake: null, answers: [], triage: null, entries: [], risks: [], verification: null, memo: null, memoRemoved: [], live: false, mixed: false, aiSteps: 0, liveSteps: 0, model: null, error: null, busy: false, rated: null, trail: {} };
    AGENTS.forEach(function (a) { c.trail[a] = 'wait'; });
    return c;
  }
  function setTrail(agent, status) { state.c.trail[agent] = status; var el = document.getElementById('trail'); if (el) el.innerHTML = trailItems(); }
  function run(agent, input) {
    var c = state.c;
    setTrail(agent, 'run');
    return apiAgent(agent, Object.assign({ lang: c.lang, sample_id: c.sample_id }, input)).then(function (res) {
      if (state.c !== c) throw new Error('cancelled');
      c.lastLive = !!res.live;
      if (agent !== 'retrieval' && agent !== 'verifier') { c.aiSteps++; if (res.live) c.liveSteps++; c.live = c.liveSteps === c.aiSteps; c.mixed = c.liveSteps > 0 && !c.live; if (res.model) c.model = res.model; }
      setTrail(agent, 'done');
      return res.output;
    }, function (err) { if (state.c === c) setTrail(agent, 'error'); throw err; });
  }
  function fail(err) { var c = state.c; if (!c || err.message === 'cancelled') return; c.busy = false; c.error = err.message || String(err); c.stage = c.stage === 'input' || c.stage === 'questions' ? c.stage : 'error'; render(); }
  function qa() { var c = state.c; return (c.sampleFacts || []).concat((c.intake ? c.intake.questions : []).map(function (q, i) { return { q: q, a: c.answers[i] || '' }; }).filter(function (p) { return p.a; })).slice(0, 10); }

  function startCase() {
    var c = state.c;
    var ta = document.getElementById('case-text'); if (ta) c.text = ta.value.trim();
    c.error = null;
    if (!c.text && !c.file && !c.document_text) { c.error = t('need_input'); return render(); }
    if (!state.lib.live && !c.sample_id) { c.error = t('need_live'); return render(); }
    c.busy = true; c.lang = state.lang; render();
    var hasDoc = !!(c.file || c.document_text);
    var step = hasDoc ? run('document', { file: c.file ? { mime: c.file.mime, data: c.file.data } : undefined, document_text: c.file ? '' : c.document_text }).then(function (d) { c.document = d; })
      : Promise.resolve(setTrail('document', 'skip'));
    step.then(function () { return run('intake', { text: c.text, document: c.document }); })
      .then(function (intake) {
        c.intake = intake; c.lang = intake.reply_lang || c.lang; c.busy = false;
        var sample = sampleById(c.sample_id);
        // Prepared sample questions get the sample's prepared answers. When live AI wrote its own
        // questions, the sample's facts are sent as their own question-and-answer pairs instead.
        c.sampleFacts = sample && c.lastLive && sample.demo_qa ? (sample.demo_qa[c.lang] || []) : [];
        c.answers = intake.questions.map(function (q, i) { return sample && !c.lastLive && sample.demo_answers ? (sample.demo_answers[c.lang] || [])[i] || '' : ''; });
        c.stage = 'questions'; render();
        if (!intake.questions.length) analyse();
      }).catch(fail);
  }

  function analyse() {
    var c = state.c;
    document.querySelectorAll('[data-answer]').forEach(function (el) { c.answers[Number(el.getAttribute('data-answer'))] = el.value.trim(); });
    c.busy = true; c.error = null; c.stage = 'running';
    ['triage', 'retrieval', 'risk', 'verifier', 'memo'].forEach(function (a) { c.trail[a] = 'wait'; });
    render();
    var base = function () { return { text: c.text, document: c.document, qa: qa() }; };
    run('triage', base()).then(function (triage) {
      c.triage = triage;
      if (triage.refused) { c.stage = 'refused'; c.busy = false; render(); throw new Error('cancelled'); }
      if (triage.issue_type === 'out_of_scope') { c.stage = 'oos'; c.busy = false; render(); throw new Error('cancelled'); }
      var searchText = [c.text, qa().map(function (p) { return p.a; }).join(' '), c.document ? JSON.stringify(c.document) : ''].join(' ');
      return run('retrieval', { issue_type: triage.issue_type, text: searchText });
    }).then(function (found) {
      c.entries = found.entries;
      return run('risk', Object.assign(base(), { triage: c.triage, retrieved_ids: c.entries.map(function (e) { return e.id; }) }));
    }).then(function (risk) {
      c.rawRiskCount = risk.risks.length;
      return run('verifier', { risks: risk.risks, retrieved_ids: c.entries.map(function (e) { return e.id; }) });
    }).then(function (v) {
      c.verification = v; c.risks = v.risks;
      return run('memo', Object.assign(base(), { triage: c.triage, risks: c.risks }));
    }).then(function (m) {
      c.memo = m.memo; c.memoRemoved = m.removed || []; c.busy = false; c.stage = 'result'; if (state.user) c.autoSaved = saveCase(c); render(); window.scrollTo(0, 0);
    }).catch(fail);
  }
  function sampleById(id) { return (state.lib.samples || []).filter(function (s) { return s.id === id; })[0]; }

  /* ---------- file and voice input ---------- */
  function readFile(file) {
    var c = state.c; c.error = null;
    if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].indexOf(file.type) === -1) { c.error = t('file_type'); return render(); }
    var done = function (mime, dataUrl) {
      var data = dataUrl.split(',')[1] || '';
      if (data.length * 0.75 > MAX_FILE) { c.error = t('file_too_big'); return render(); }
      keepText(); c.file = { name: file.name, mime: mime, data: data }; c.document_text = ''; c.document_name = file.name; c.sample_id = null; render();
    };
    var reader = new FileReader();
    reader.onerror = function () { c.error = t('error_title'); render(); };
    if (file.type === 'application/pdf') { reader.onload = function () { done('application/pdf', reader.result); }; reader.readAsDataURL(file); return; }
    reader.onload = function () { // shrink photos so they upload quickly on slow connections
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        done('image/jpeg', canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { c.error = t('file_type'); render(); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function keepText() { var ta = document.getElementById('case-text'); if (ta && state.c) state.c.text = ta.value; }
  var recognition = null;
  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var ta = document.getElementById('case-text'); var btn = document.getElementById('mic');
    if (!SR) { state.c.error = t('mic_unsupported'); keepText(); return render(); }
    if (recognition) { recognition.stop(); return; }
    recognition = new SR(); recognition.lang = state.lang === 'bn' ? 'bn-BD' : 'en-US'; recognition.interimResults = false; recognition.continuous = true;
    recognition.onresult = function (ev) { for (var i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) ta.value = (ta.value ? ta.value + ' ' : '') + ev.results[i][0].transcript.trim(); };
    recognition.onend = function () { recognition = null; if (btn) { btn.textContent = t('mic'); btn.setAttribute('aria-pressed', 'false'); } };
    recognition.onerror = recognition.onend;
    recognition.start(); btn.textContent = t('mic_stop'); btn.setAttribute('aria-pressed', 'true');
  }

  /* ---------- shared pieces ---------- */
  var LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0f5c55"/><path d="M16 7v18M9 11h14M9 11l-3 7h6l-3-7zm14 0l-3 7h6l-3-7zM11 25h10" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function shell(content) {
    var r = route();
    var links = [['', 'nav_home'], state.user ? ['cases', 'nav_cases'] : ['login', 'nav_login'], ['samples', 'nav_samples'], ['how', 'nav_arch'], ['library', 'nav_library'], ['help', 'nav_help'], ['impact', 'nav_impact'], ['partners', 'nav_partners'], ['about', 'nav_about']];
    return '<div class="notice" role="note">' + esc(t('disclaimer')) + '</div>' +
      '<header class="top"><div class="wrap wide"><div class="bar">' +
      '<a class="brand" href="#home">' + LOGO + '<span>' + esc(t('brand')) + '<small>' + esc(t('tagline')) + '</small></span></a>' +
      '<button class="btn ghost small" data-act="lang" lang="' + (state.lang === 'bn' ? 'en' : 'bn') + '">' + esc(t('lang_switch')) + '</button>' +
      '<button class="btn ghost small menu-btn" data-act="menu" aria-expanded="' + state.menuOpen + '" aria-controls="menu">' + esc(t('menu')) + '</button></div>' +
      '<nav id="menu" class="menu' + (state.menuOpen ? ' open' : '') + '" aria-label="' + esc(t('menu')) + '">' +
      links.map(function (l) { return '<a href="#' + (l[0] || 'home') + '"' + (r === l[0] ? ' aria-current="page"' : '') + '>' + esc(t(l[1])) + '</a>'; }).join('') +
      '</nav></div></header>' +
      '<main id="main" tabindex="-1"><div class="wrap">' + content + '</div></main>' +
      '<footer><div class="wrap"><p>' + esc(t('footer')) + '</p><p>' + esc(t('disclaimer')) + '</p></div></footer>';
  }
  function modeBanner() { return state.lib.live ? '' : '<div class="banner demo" role="status">' + esc(t('demo_banner')) + '</div>'; }
  function badge(entry) {
    if (entry.verified_by) return '<span class="chip green">' + esc(t('verified')) + '</span>';
    if (entry.source_type === 'official') return '<span class="chip amber">' + esc(t('official_pending')) + '</span>';
    return '<span class="chip red">' + esc(t('unverified')) + '</span>';
  }
  function actName(e) { return state.lang === 'bn' && e.act_name_bn ? e.act_name_bn : e.act_name; }
  function sectionText(e) { // English text if the team has added one, otherwise the official Bangla text
    var en = state.lang === 'en' && e.text_en;
    return '<div class="lawtext" lang="' + (en ? 'en' : 'bn') + '">' + esc(en ? e.text_en : (e.text_bn || e.text_en)) + '</div>' +
      (state.lang === 'en' && !e.text_en && e.text_bn ? '<p class="small muted" style="margin:.3em 0 0">' + esc(t('official_bn_note')) + '</p>' : '');
  }
  function entryCard(e, extra) {
    var url = safeUrl(e.source_url);
    return '<div class="cite"><div class="row"><strong>' + esc(actName(e)) + ', ' + esc(e.year) + ' · ' + esc(t('section')) + ' ' + esc(e.section) + '</strong> ' + badge(e) + '</div>' +
      '<div lang="bn">' + esc(e.heading) + '</div>' + (extra || '') +
      '<div class="small muted">' + (e.verified_by ? esc(t('verified_by')) + ': ' + esc(e.verified_by) + (e.verified_on ? ' (' + esc(e.verified_on) + ')' : '') + ' · ' : '') +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(t('source')) + '</a>' : '') + '</div></div>';
  }
  function trailItems() {
    var c = state.c; var mark = { wait: '', run: '…', done: '✓', skip: '–', error: '!' };
    return AGENTS.map(function (a, i) {
      var st = c.trail[a];
      return '<li class="' + st + '"><span class="dot" aria-hidden="true">' + (mark[st] || (i + 1)) + '</span><span class="name">' + esc(t('a_' + a)) + '<span class="desc">' + esc(t('d_' + a)) + '</span></span><span class="st">' + esc(t('st_' + st)) + '</span></li>';
    }).join('');
  }
  function trailCard() { return '<section class="card flat" aria-live="polite"><h2>' + esc(t('trail_title')) + '</h2><ol class="trail" id="trail">' + trailItems() + '</ol></section>'; }
  function documentCard(d) {
    if (!d) return '';
    var k = d.key_terms || {};
    var block = function (key) { return (k[key] && k[key].length) ? '<dt>' + esc(t(key)) + '</dt><dd>' + list(k[key]) + '</dd>' : ''; };
    return '<section class="card"><h2>' + esc(t('doc_title')) + '</h2><p><span class="chip">' + esc(d.doc_type) + '</span></p><dl class="kv">' + block('parties') + block('amounts') + block('dates') + block('obligations') + '</dl></section>';
  }
  function sampleCards() {
    return '<div class="grid three">' + (state.lib.samples || []).map(function (s) {
      return '<div class="card"><p><span class="chip">' + esc(issueLabel(s.issue_type)) + '</span></p><h3>' + esc(L(s, 'title')) + '</h3><p class="small muted">' + esc(t('made_up')) + '</p><button class="btn small" data-act="sample" data-id="' + esc(s.id) + '">' + esc(t('run_sample')) + '</button></div>';
    }).join('') + '</div>';
  }

  /* ---------- pages ---------- */
  function pageHome() {
    return '<section class="hero"><h1>' + esc(t('hero_title')) + '</h1><p>' + esc(t('hero_text')) + '</p></section>' + modeBanner() +
      '<div class="grid two"><a class="choice" href="#case" data-act="new" data-focus="text"><strong>' + esc(t('cta_describe')) + '</strong><span class="muted">' + esc(t('cta_describe_sub')) + '</span></a>' +
      '<a class="choice" href="#case" data-act="new" data-focus="file"><strong>' + esc(t('cta_upload')) + '</strong><span class="muted">' + esc(t('cta_upload_sub')) + '</span></a></div>' +
      '<section style="margin-top:22px"><h2>' + esc(t('scope_title')) + '</h2><ul class="chips">' + state.lib.issue_types.map(function (it) { return '<li class="chip">' + esc(L(it, 'label')) + '</li>'; }).join('') + '</ul><p class="small muted">' + esc(t('scope_more')) + '</p></section>' +
      '<section><h2>' + esc(t('try_samples')) + '</h2><p class="muted">' + esc(t('try_samples_sub')) + '</p>' + sampleCards() + '</section>' +
      '<section class="grid three" style="margin-top:8px">' + [1, 2, 3].map(function (n) { return '<div class="card flat"><h3>' + esc(t('trust_' + n + '_t')) + '</h3><p class="small" style="margin:0">' + esc(t('trust_' + n + '_d')) + '</p></div>'; }).join('') + '</section>';
  }

  function pageCase() {
    var c = state.c || (state.c = newCase(null));
    var err = c.error ? '<div class="banner err" role="alert">' + esc(c.error) + '</div>' : '';
    var head = '<h1>' + esc(t('case_title')) + '</h1>';
    var restart = '<p class="no-print"><button class="btn ghost small" data-act="new">' + esc(t('start_over')) + '</button></p>';
    if (c.stage === 'input') {
      var sample = sampleById(c.sample_id);
      var fileUi = c.document_name
        ? '<div class="row"><span class="chip">' + esc(c.document_name) + '</span><button class="btn ghost small" data-act="rmfile">' + esc(t('remove')) + '</button></div>' +
          (c.document_text ? '<details style="margin-top:10px"><summary>' + esc(t('view_doc')) + '</summary><div class="inner"><pre class="doc">' + esc(c.document_text) + '</pre></div></details>' : '')
        : '<input type="file" id="file" accept="image/jpeg,image/png,image/webp,application/pdf"><p class="small muted" style="margin:.5em 0 0">' + esc(t('upload_hint')) + '</p>';
      return head + modeBanner() + (sample ? '<div class="banner info">' + esc(L(sample, 'title')) + ' · ' + esc(t('made_up')) + '</div>' : '') + err +
        '<div class="card"><p class="muted">' + esc(t('case_intro')) + '</p>' +
        '<label for="case-text">' + esc(t('cta_describe')) + '</label><textarea id="case-text" placeholder="' + esc(t('case_placeholder')) + '">' + esc(c.text) + '</textarea>' +
        '<div class="row" style="margin:10px 0 18px"><button class="btn ghost small" id="mic" data-act="mic" aria-pressed="false">' + esc(t('mic')) + '</button></div>' +
        '<label for="file">' + esc(t('upload_label')) + '</label><div class="filebox">' + fileUi + '</div>' +
        '<div class="row" style="margin-top:18px"><button class="btn" data-act="start"' + (c.busy ? ' disabled' : '') + '>' + (c.busy ? '<span class="spinner"></span>' : '') + esc(t('continue')) + '</button></div></div>' +
        (c.busy ? trailCard() : '');
    }
    if (c.stage === 'questions') {
      var qs = c.intake.questions;
      return head + err + '<div class="card flat"><h2>' + esc(t('understood')) + '</h2><p style="margin:0">' + esc(c.intake.summary) + '</p></div>' + documentCard(c.document) +
        '<div class="card"><h2>' + esc(t('q_title')) + '</h2>' + (qs.length ? '<p class="muted">' + esc(t('q_intro')) + '</p>' + ((c.sampleFacts || []).length ? '<p class="banner info">' + esc(t('q_sample_live')) + '</p>' : '') + qs.map(function (q, i) {
          return '<div class="q"><label for="q' + i + '">' + (i + 1) + '. ' + esc(q) + '</label><input type="text" id="q' + i + '" data-answer="' + i + '" value="' + esc(c.answers[i] || '') + '"></div>';
        }).join('') : '<p>' + esc(t('q_none')) + '</p>') +
        '<button class="btn" data-act="analyse"' + (c.busy ? ' disabled' : '') + '>' + esc(t('analyse')) + '</button></div>' + trailCard() + restart;
    }
    if (c.stage === 'running') return head + trailCard();
    if (c.stage === 'refused') return head + '<div class="card"><h2>' + esc(t('refused_title')) + '</h2><p>' + esc(t('refused_text')) + '</p>' + (c.triage.refusal_reason ? '<p class="muted">' + esc(c.triage.refusal_reason) + '</p>' : '') + '</div>' + restart;
    if (c.stage === 'oos') return head + '<div class="card"><h2>' + esc(t('oos_title')) + '</h2><p>' + esc(t('oos_text')) + '</p><a class="btn" href="#help">' + esc(t('go_help')) + '</a></div>' + restart;
    if (c.stage === 'error') return head + '<div class="banner err" role="alert"><strong>' + esc(t('error_title')) + '</strong><br>' + esc(c.error) + '</div>' + trailCard() + '<p><button class="btn" data-act="analyse">' + esc(t('retry')) + '</button></p>' + restart;
    return pageResult(c) + restart;
  }

  function pageResult(c) {
    var tr = c.triage; var urgencyClass = { low: 'green', medium: 'amber', high: 'red' }[tr.urgency];
    var limits = c.entries.filter(function (e) { return L(e, 'time_limit'); });
    var deadline = limits.length
      ? limits.map(function (e) { return '<p style="margin:0 0 .6em">' + esc(L(e, 'time_limit')) + '</p>' + entryCard(e); }).join('') + '<p class="small muted" style="margin:.8em 0 0">' + esc(t('deadline_generic')) + '</p>'
      : '<p style="margin:0">' + esc(t('deadline_generic')) + '</p>';
    var risks = c.risks.map(function (r, i) {
      var e = r.verified_citation ? entryById(r.citation_id) : null;
      var cite = e ? entryCard(e, r.quote ? '<blockquote><span class="small muted">' + esc(t('quote')) + ':</span> “' + esc(r.quote) + '”</blockquote>' : '') : '<div class="cite">' + esc(t('no_citation')) + '</div>';
      return '<article class="card risk"><h3>' + (i + 1) + '. ' + esc(r.title) + '</h3><dl class="kv"><dt>' + esc(t('says')) + '</dt><dd>' + esc(r.what_it_says) + '</dd><dt>' + esc(t('matters')) + '</dt><dd>' + esc(r.why_it_matters) + '</dd><dt>' + esc(t('relies')) + '</dt><dd>' + cite + '</dd></dl>' +
        '<span class="chip grey">' + esc(t('confidence')) + ': ' + esc(t('c_' + r.confidence)) + '</span></article>';
    }).join('');
    var cited = c.risks.filter(function (r) { return r.verified_citation; }).map(function (r) { return r.citation_id; }).filter(function (id, i, a) { return a.indexOf(id) === i; }).map(entryById).filter(Boolean);
    var it = state.lib.issue_types.filter(function (x) { return x.id === tr.issue_type; })[0] || {};
    var m = c.memo;
    var memo = '<section class="card memo" id="memo"><h2>' + esc(t('memo_title')) + ' · ' + esc(issueLabel(tr.issue_type)) + '</h2><p class="small muted">' + esc(t('disclaimer')) + '</p>' +
      '<h3>' + esc(t('memo_summary')) + '</h3><p>' + esc(m.summary) + '</p>' +
      '<h3>' + esc(t('memo_facts')) + '</h3>' + list(m.facts) +
      '<h3>' + esc(t('memo_risks')) + '</h3><ol>' + c.risks.map(function (r) { return '<li><strong>' + esc(r.title) + '.</strong> ' + esc(r.why_it_matters) + '</li>'; }).join('') + '</ol>' +
      '<h3>' + esc(t('memo_provisions')) + '</h3>' + (cited.length ? cited.map(function (e) { return entryCard(e, '<div class="small" style="margin:.5em 0">' + sectionText(e) + '</div>'); }).join('<div style="height:8px"></div>') : '<p>' + esc(t('memo_none')) + '</p>') +
      '<h3>' + esc(t('memo_evidence')) + '</h3>' + list(L(it, 'evidence') || []) +
      '<h3>' + esc(t('memo_steps')) + '</h3>' + list(m.next_steps) +
      '<h3>' + esc(t('memo_draft')) + '</h3><div class="draft" id="draft" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + esc(t('memo_draft')) + '">' + esc(m.draft_complaint) + '</div>' +
      '<div class="row no-print" style="margin-top:14px"><button class="btn" data-act="print">' + esc(t('download')) + '</button><button class="btn ghost" data-act="copy">' + esc(t('copy')) + '</button></div><p class="small muted no-print" style="margin:.6em 0 0">' + esc(t('print_hint')) + '</p></section>';
    var removed = (c.verification.removed || []).concat(c.memoRemoved || []);
    var how = '<details><summary>' + esc(t('how_title')) + '</summary><div class="inner">' +
      '<p><span class="chip ' + (c.live ? 'green' : 'amber') + '">' + esc(c.live ? t('how_mode_live') + (c.model || state.lib.model ? ': ' + (c.model || state.lib.model) : '') : t(c.mixed ? 'how_mode_mixed' : (state.lib.live ? 'how_mode_fallback' : 'how_mode_demo'))) + '</span></p>' +
      '<h3>' + esc(t('how_agents')) + '</h3><ol class="trail">' + trailItems() + '</ol>' +
      '<h3 style="margin-top:1em">' + esc(t('how_entries')) + '</h3>' + (c.entries.length ? c.entries.map(function (e) { return entryCard(e, '<div class="small muted">' + esc(t('how_matched')) + ': ' + esc((e.matched || []).join(', ')) + '</div>'); }).join('<div style="height:8px"></div>') : '<p>' + esc(t('how_none')) + '</p>') +
      '<h3 style="margin-top:1em">' + esc(t('how_removed')) + '</h3><p class="small muted">' + esc(t('how_checked')) + ': ' + esc(c.verification.checked) + '</p>' +
      (removed.length ? '<ul>' + removed.map(function (x) { return '<li><strong>' + esc(x.where) + '</strong><br>“' + esc(x.text) + '”<br><span class="small muted">' + esc(t('reason')) + ': ' + esc(x.reason) + '</span></li>'; }).join('') + '</ul>' : '<p>' + esc(t('how_removed_none')) + '</p>') +
      '</div></details>';
    var fb = '<section class="card flat no-print center"><p style="margin-bottom:.6em"><strong>' + esc(t('feedback_q')) + '</strong></p>' + (c.rated === null
      ? '<div class="row" style="justify-content:center"><button class="btn ghost small" data-act="rate" data-v="1">' + esc(t('yes')) + '</button><button class="btn ghost small" data-act="rate" data-v="0">' + esc(t('no')) + '</button></div>'
      : '<p class="muted" style="margin:0">' + esc(t('feedback_thanks')) + '</p>') + '</section>';
    return '<h1 class="no-print">' + esc(t('result_title')) + '</h1>' + (c.live ? '' : '<div class="banner demo">' + esc(t(c.mixed ? 'how_mode_mixed' : (state.lib.live ? 'how_mode_fallback' : 'how_mode_demo'))) + '</div>') +
      '<section class="card no-print"><div class="row"><span class="chip">' + esc(t('issue')) + ': ' + esc(issueLabel(tr.issue_type)) + '</span><span class="chip ' + urgencyClass + '">' + esc(t('urgency')) + ': ' + esc(t('u_' + tr.urgency)) + '</span></div>' +
      '<p style="margin-top:.8em">' + esc(tr.urgency_reason) + '</p>' + (tr.unknowns.length ? '<h3>' + esc(t('unknowns')) + '</h3>' + list(tr.unknowns) : '') + '</section>' +
      '<section class="card no-print"><h2>' + esc(t('deadline_title')) + '</h2>' + deadline + '</section>' +
      '<h2 class="no-print">' + esc(t('risks_title')) + '</h2><div class="no-print">' + risks + '</div>' + memo + saveCard(c) + how + fb +
      '<p class="no-print"><a class="btn" href="#help">' + esc(t('go_help')) + '</a></p>';
  }

  function pageSamples() {
    return '<h1>' + esc(t('samples_title')) + '</h1><p>' + esc(t('samples_intro')) + '</p>' + modeBanner() + (state.lib.samples || []).map(function (s) {
      return '<div class="card"><p><span class="chip">' + esc(issueLabel(s.issue_type)) + '</span> <span class="chip grey">' + esc(t('made_up')) + '</span></p><h2>' + esc(L(s, 'title')) + '</h2><p>' + esc(L(s, 'text')) + '</p>' +
        '<details><summary>' + esc(t('view_doc')) + '</summary><div class="inner"><pre class="doc">' + esc(s.document_text) + '</pre></div></details>' +
        '<button class="btn" data-act="sample" data-id="' + esc(s.id) + '">' + esc(t('run_sample')) + '</button></div>';
    }).join('');
  }
  function pageLibrary() {
    var all = state.lib.statutes || [];
    var checked = all.filter(function (e) { return e.verified_by; }).length;
    var acts = [];
    all.forEach(function (e) { var a = acts.filter(function (x) { return x.name === e.act_name; })[0]; if (!a) acts.push(a = { name: e.act_name, list: [] }); a.list.push(e); });
    return '<h1>' + esc(t('library_title')) + '</h1><p>' + esc(t('library_intro')) + '</p>' +
      '<p><span class="chip">' + all.length + ' ' + esc(t('library_count')) + '</span> <span class="chip green">' + esc(t('verified')) + ': ' + checked + '</span> <span class="chip amber">' + esc(t('official_pending')) + ': ' + (all.length - checked) + '</span></p>' +
      (checked < all.length ? '<div class="banner demo">' + esc(t('library_unverified_warn')) + '</div>' : '') +
      acts.map(function (a) {
        var first = a.list[0];
        return '<details class="act"><summary>' + esc(actName(first)) + ', ' + esc(first.year) + ' <span class="chip grey">' + a.list.length + ' ' + esc(t('library_count')) + '</span> <span class="chip">' + (first.issue_types || []).map(issueLabel).map(esc).join(', ') + '</span></summary><div class="inner">' +
          (first.source_note ? '<p class="small muted">' + esc(first.source_note.replace(/ \d+ known.*$/, '')) + '</p>' : '') +
          a.list.map(function (e) {
            return '<div class="card flat">' + entryCard(e, '<div style="margin:.6em 0">' + sectionText(e) + '</div>' + (L(e, 'time_limit') ? '<p class="small"><strong>' + esc(t('deadline_title')) + ':</strong> ' + esc(L(e, 'time_limit')) + '</p>' : '')) + '</div>';
          }).join('') + '</div></details>';
      }).join('');
  }
  function pageHelp() {
    return '<h1>' + esc(t('help_title')) + '</h1><p>' + esc(t('help_intro')) + '</p>' + [1, 2, 3, 4].map(function (n) {
      return '<div class="card"><p><span class="chip amber">' + esc(t('help_verify')) + '</span></p><h2>' + esc(t('help_' + n)) + '</h2><p style="margin:0">' + esc(t('help_' + n + 'd')) + '</p></div>';
    }).join('') + '<div class="card flat"><h2>' + esc(t('help_bring')) + '</h2><p style="margin:0">' + esc(t('help_bring_d')) + '</p></div>';
  }
  function pageStatic(key, titleKey) { return '<h1>' + esc(t(titleKey)) + '</h1><div class="card">' + (window.AB_PAGES[key][state.lang] || window.AB_PAGES[key].en) + '</div>'; }
  function pageImpact() {
    var demo = { cases: 128, rating: '4.3 / 5', by: { rent: 52, wages: 41, consumer: 35 } }; // sample numbers, labelled as demo data
    var max = Math.max.apply(null, Object.keys(demo.by).map(function (k) { return demo.by[k]; }));
    var up = state.ratings.filter(function (v) { return v === 1; }).length;
    return '<h1>' + esc(t('impact_title')) + ' <span class="chip amber">' + esc(t('impact_demo')) + '</span></h1><div class="banner demo">' + esc(t('impact_demo_note')) + '</div>' +
      '<div class="grid three"><div class="card"><div class="stat">' + demo.cases + '</div><div class="muted">' + esc(t('impact_cases')) + '</div></div><div class="card"><div class="stat">' + demo.rating + '</div><div class="muted">' + esc(t('impact_rating')) + '</div></div><div class="card"><div class="stat">0</div><div class="muted">' + esc(t('impact_zero')) + '</div></div></div>' +
      '<div class="card"><h2>' + esc(t('impact_by_type')) + '</h2>' + Object.keys(demo.by).map(function (k) { return '<div class="barrow"><span>' + esc(issueLabel(k)) + '</span><span class="bartrack"><span class="barfill" style="display:block;width:' + Math.round(demo.by[k] / max * 100) + '%"></span></span><strong>' + demo.by[k] + '</strong></div>'; }).join('') + '</div>' +
      '<div class="card flat"><h2>' + esc(t('impact_session')) + '</h2><p style="margin:0">' + esc(t('yes')) + ': ' + up + ' · ' + esc(t('no')) + ': ' + (state.ratings.length - up) + '</p></div>';
  }
  function pageHow() {
    var code = { retrieval: 1, verifier: 1 }; var w = 150, h = 54, gap = 26, x0 = 20, y = 96;
    var boxes = AGENTS.map(function (a, i) {
      var col = i % 4, rowN = Math.floor(i / 4); var x = x0 + col * (w + gap), yy = y + rowN * 120;
      var fill = code[a] ? '#fbf0dd' : '#e3f0ee', stroke = code[a] ? '#a8641a' : '#0f5c55';
      return { a: a, x: x, y: yy, svg: '<rect x="' + x + '" y="' + yy + '" width="' + w + '" height="' + h + '" rx="10" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/><text x="' + (x + w / 2) + '" y="' + (yy + 33) + '" text-anchor="middle" font-size="16" font-weight="600" fill="#18292a">' + (i + 1) + '. ' + esc(t('a_' + a)) + '</text>' };
    });
    var arrows = boxes.slice(0, -1).map(function (b, i) { var n = boxes[i + 1]; return n.y === b.y ? '<path d="M' + (b.x + w) + ' ' + (b.y + h / 2) + ' H' + (n.x - 4) + '" stroke="#56686a" stroke-width="1.5" marker-end="url(#ar)"/>' : '<path d="M' + (b.x + w / 2) + ' ' + (b.y + h) + ' V' + (b.y + h + 30) + ' H' + (n.x + w / 2) + ' V' + (n.y - 4) + '" fill="none" stroke="#56686a" stroke-width="1.5" marker-end="url(#ar)"/>'; }).join('');
    var ret = boxes[3], ver = boxes[5]; var libX = ret.x, libY = 330;
    var svg = '<svg class="arch" viewBox="0 0 730 400" role="img" aria-label="' + esc(t('arch_title')) + '"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#56686a"/></marker></defs>' +
      '<text x="20" y="40" font-size="15" fill="#56686a">' + esc(t('arch_user')) + ' →</text><text x="716" y="40" font-size="15" fill="#56686a" text-anchor="end">→ ' + esc(t('arch_out')) + '</text>' +
      '<path d="M40 48 V' + (y - 4) + '" stroke="#56686a" stroke-width="1.5" marker-end="url(#ar)"/>' + arrows + boxes.map(function (b) { return b.svg; }).join('') +
      '<path d="M' + (boxes[6].x + w) + ' ' + (boxes[6].y + h / 2) + ' H710 V52" fill="none" stroke="#56686a" stroke-width="1.5" marker-end="url(#ar)"/>' +
      '<rect x="' + libX + '" y="' + libY + '" width="' + w + '" height="50" rx="25" fill="#fff" stroke="#18292a" stroke-width="1.5"/><text x="' + (libX + w / 2) + '" y="' + (libY + 31) + '" text-anchor="middle" font-size="15" font-weight="600" fill="#18292a">' + esc(t('arch_library')) + '</text>' +
      '<path d="M' + (libX + w - 20) + ' ' + libY + ' V' + (ret.y + h + 4) + '" stroke="#a8641a" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#ar)"/>' +
      '<path d="M' + libX + ' ' + (libY + 25) + ' H' + (ver.x + w / 2) + ' V' + (ver.y + h + 4) + '" fill="none" stroke="#a8641a" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#ar)"/></svg>';
    return '<h1>' + esc(t('arch_title')) + '</h1><p>' + esc(t('arch_intro')) + '</p><div class="card">' + svg + '<p class="row small" style="margin:12px 0 0"><span class="chip">' + esc(t('arch_ai')) + '</span><span class="chip amber">' + esc(t('arch_code')) + '</span></p></div>' +
      '<div class="card"><ol>' + AGENTS.map(function (a) { return '<li><strong>' + esc(t('a_' + a)) + ':</strong> ' + esc(t('d_' + a)) + '. <span class="chip ' + (code[a] ? 'amber' : '') + '">' + esc(t(code[a] ? 'arch_code' : 'arch_ai')) + '</span></li>'; }).join('') + '</ol></div>';
  }

  function pageLogin() {
    if (state.user) return '<h1>' + esc(t('login_title')) + '</h1><div class="card"><p>' + esc(t('login_signed_in')) + ' <strong>' + esc(maskPhone(state.user.phone)) + '</strong></p><div class="row"><a class="btn" href="#cases">' + esc(t('nav_cases')) + '</a><button class="btn ghost" data-act="signout">' + esc(t('signout')) + '</button></div></div>';
    var L2 = state.login;
    var err = L2.error ? '<div class="banner err" role="alert">' + esc(L2.error) + '</div>' : '';
    var demo = '<div class="banner demo" role="note">' + esc(t('login_demo')) + '</div>';
    var body = L2.step === 'phone'
      ? '<label for="login-phone">' + esc(t('login_phone')) + '</label><input type="tel" id="login-phone" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" value="' + esc(L2.phone) + '">' +
        '<p class="small muted" style="margin:.5em 0 1em">' + esc(t('login_phone_hint')) + '</p><button class="btn" data-act="send-code">' + esc(t('login_send')) + '</button>'
      : '<p>' + esc(t('login_code_sent')) + ' <strong>' + esc(maskPhone(L2.phone)) + '</strong></p><p class="banner info">' + esc(t('login_demo_code')) + ' <strong>' + DEMO_CODE + '</strong></p>' +
        '<label for="login-code">' + esc(t('login_code')) + '</label><input type="text" id="login-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">' +
        '<div class="row" style="margin-top:1em"><button class="btn" data-act="check-code">' + esc(t('login_verify')) + '</button><button class="btn ghost" data-act="change-phone">' + esc(t('login_change')) + '</button></div>';
    return '<h1>' + esc(t('login_title')) + '</h1><p>' + esc(t('login_intro')) + '</p>' + demo + err + '<div class="card">' + body + '</div>' +
      '<div class="card flat"><h2>' + esc(t('login_privacy_t')) + '</h2><p class="small" style="margin:0">' + esc(t('login_privacy')) + '</p></div>';
  }
  function pageCases() {
    if (!state.user) return '<h1>' + esc(t('nav_cases')) + '</h1><div class="card"><p>' + esc(t('cases_need_login')) + '</p><a class="btn" href="#login">' + esc(t('nav_login')) + '</a></div>';
    var list = savedCases();
    var fmt = function (iso) { try { return new Date(iso).toLocaleString(state.lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };
    return '<h1>' + esc(t('nav_cases')) + '</h1><p class="muted">' + esc(t('cases_intro')) + ' <strong>' + esc(maskPhone(state.user.phone)) + '</strong></p>' +
      (list.length ? list.map(function (x) {
        var urg = x.triage ? { low: 'green', medium: 'amber', high: 'red' }[x.triage.urgency] : 'grey';
        return '<div class="card"><p><span class="chip">' + esc(issueLabel(x.triage ? x.triage.issue_type : '')) + '</span> <span class="chip ' + urg + '">' + esc(t('urgency')) + ': ' + esc(t('u_' + (x.triage ? x.triage.urgency : 'medium'))) + '</span></p>' +
          '<p style="margin-bottom:.4em">' + esc(x.memo ? x.memo.summary : '') + '</p><p class="small muted">' + esc(fmt(x.saved_at)) + ' · ' + (x.risks || []).length + ' ' + esc(t('cases_risks')) + '</p>' +
          '<div class="row"><button class="btn small" data-act="open-case" data-id="' + esc(x.id) + '">' + esc(t('cases_open')) + '</button><button class="btn ghost small" data-act="del-case" data-id="' + esc(x.id) + '">' + esc(t('cases_delete')) + '</button></div></div>';
      }).join('') : '<div class="card flat"><p style="margin:0">' + esc(t('cases_empty')) + '</p></div>') +
      '<div class="row" style="margin-top:8px"><a class="btn" href="#case" data-act="new">' + esc(t('start_over')) + '</a>' + (list.length ? '<button class="btn ghost" data-act="del-all">' + esc(t('cases_delete_all')) + '</button>' : '') + '<button class="btn ghost" data-act="signout">' + esc(t('signout')) + '</button></div>';
  }
  function saveCard(c) {
    if (!state.user) return '<section class="card flat no-print"><p style="margin-bottom:.6em">' + esc(t('save_need_login')) + '</p><button class="btn small" data-act="login-to-save">' + esc(t('nav_login')) + '</button></section>';
    var msg = c.fromSaved ? t('save_opened') : (c.autoSaved === false ? t('save_failed') : t('save_done'));
    return '<section class="card flat no-print"><p style="margin-bottom:.6em">' + esc(msg) + '</p><div class="row"><button class="btn small" data-act="save-case">' + esc(t('save_changes')) + '</button><a class="btn ghost small" href="#cases">' + esc(t('nav_cases')) + '</a></div></section>';
  }

  /* ---------- render and events ---------- */
  function render() {
    document.documentElement.lang = state.lang;
    if (state.loadError) { app.innerHTML = '<div class="wrap" style="padding:40px 16px"><div class="banner err" role="alert"><strong>' + esc(t('error_title')) + '</strong><br>' + esc(state.loadError) + '</div><button class="btn" data-act="reload">' + esc(t('retry')) + '</button></div>'; return; }
    if (!state.lib) { app.innerHTML = '<div class="wrap center" style="padding:60px 16px" role="status">…</div>'; return; }
    var r = route();
    var pages = { '': pageHome, login: pageLogin, cases: pageCases, 'case': pageCase, samples: pageSamples, library: pageLibrary, help: pageHelp, impact: pageImpact, how: pageHow, about: function () { return pageStatic('about', 'about_title'); }, partners: function () { return pageStatic('partners', 'partners_title'); } };
    app.innerHTML = shell(pages[r]());
  }
  function load() {
    state.loadError = null; render();
    apiLibrary().then(function (lib) { state.lib = lib; render(); }).catch(function (e) { state.loadError = 'Could not reach the AinBondhu server (' + e.message + ').'; render(); });
  }

  app.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'lang') { keepText(); state.lang = state.lang === 'bn' ? 'en' : 'bn'; try { localStorage.setItem('ab_lang', state.lang); } catch (e) { /* ignore */ } render(); }
    else if (act === 'menu') { state.menuOpen = !state.menuOpen; keepText(); render(); }
    else if (act === 'reload') load();
    else if (act === 'new') { ev.preventDefault(); state.c = newCase(null); var focus = el.getAttribute('data-focus'); go('case'); setTimeout(function () { var f = document.getElementById(focus === 'file' ? 'file' : 'case-text'); if (f) f.focus(); }, 30); }
    else if (act === 'sample') { state.c = newCase(sampleById(el.getAttribute('data-id'))); go('case'); window.scrollTo(0, 0); startCase(); }
    else if (act === 'start') startCase();
    else if (act === 'analyse') analyse();
    else if (act === 'mic') toggleMic();
    else if (act === 'rmfile') { keepText(); state.c.file = null; state.c.document_text = ''; state.c.document_name = ''; state.c.sample_id = null; render(); }
    else if (act === 'print') window.print();
    else if (act === 'copy') { var text = document.getElementById('draft').innerText; var ok = function () { el.textContent = t('copied'); }; if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () {}); }
    else if (act === 'send-code') {
      var phone = normPhone((document.getElementById('login-phone') || {}).value);
      state.login.phone = (document.getElementById('login-phone') || {}).value || '';
      if (!phone) { state.login.error = t('login_bad_phone'); render(); return; }
      sendCode(phone); render(); setTimeout(function () { var f = document.getElementById('login-code'); if (f) f.focus(); }, 30);
    }
    else if (act === 'check-code') {
      if (!checkCode((document.getElementById('login-code') || {}).value)) { state.login.error = t('login_bad_code'); render(); return; }
      state.user = { phone: state.login.phone, since: new Date().toISOString() };
      if (!store.set('ab_user', state.user)) { state.user = null; state.login.error = t('save_failed'); render(); return; }
      state.login = { step: 'phone', phone: '', error: null };
      if (state.pendingSave) { saveCase(state.pendingSave); state.pendingSave = null; }
      go('cases');
    }
    else if (act === 'change-phone') { state.login = { step: 'phone', phone: state.login.phone, error: null }; render(); }
    else if (act === 'signout') { store.del('ab_user'); state.user = null; state.login = { step: 'phone', phone: '', error: null }; go(''); }
    else if (act === 'login-to-save') { var dd = document.getElementById('draft'); if (dd && state.c.memo) state.c.memo.draft_complaint = dd.innerText; state.pendingSave = state.c; go('login'); }
    else if (act === 'save-case') { var ok = saveCase(state.c); state.c.autoSaved = ok; state.c.fromSaved = false; render(); }
    else if (act === 'open-case') openSaved(el.getAttribute('data-id'));
    else if (act === 'del-case') { var id = el.getAttribute('data-id'); store.set(casesKey(), savedCases().filter(function (x) { return x.id !== id; })); render(); }
    else if (act === 'del-all') { store.del(casesKey()); render(); }
    else if (act === 'rate') { var v = Number(el.getAttribute('data-v')); state.c.rated = v; state.ratings.push(v); if (state.user && state.c.savedId) saveCase(state.c); var d = document.getElementById('draft'); if (d) state.c.memo.draft_complaint = d.innerText; render(); }
  });
  app.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'login-phone') { ev.preventDefault(); var b = document.querySelector('[data-act=send-code]'); if (b) b.click(); }
    if (ev.target.id === 'login-code') { ev.preventDefault(); var b2 = document.querySelector('[data-act=check-code]'); if (b2) b2.click(); }
  });
  app.addEventListener('change', function (ev) { if (ev.target.id === 'file' && ev.target.files[0]) readFile(ev.target.files[0]); });
  app.addEventListener('input', function (ev) { if (ev.target.id === 'case-text' && state.c && state.c.sample_id && ev.target.value.trim() !== (L(sampleById(state.c.sample_id) || {}, 'text') || '').trim() && state.lib.live) state.c.sample_id = null; });
  window.addEventListener('hashchange', function () { state.menuOpen = false; render(); var m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  load();
})();
