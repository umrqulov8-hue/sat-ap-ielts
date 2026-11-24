/* Ufq bridge — connects the exported design pages (*.dc.html) to the real site.
   - clean URLs (/dashboard instead of /dc/Dashboard.dc.html)
   - shared Supabase session with the rest of the site (localStorage "satap_session")
   - sign in / sign up / reset / Google, sign out
   - redirects signed-out visitors away from the app pages
   The design pages themselves are otherwise unchanged. */
(function () {
  'use strict';

  var ROUTES = {
    Main: '/', Auth: '/auth', ResetPassword: '/reset-password', Welcome: '/welcome', Dashboard: '/dashboard',
    Lesson: '/lesson', PracticeHub: '/practice', Practice: '/practice/session', MockTests: '/mock-tests',
    MockTest: '/mock-test', Plan: '/plan', Mistakes: '/mistakes', Report: '/report', History: '/history',
    Profile: '/profile', Settings: '/settings', Notifications: '/notifications', Help: '/help', Admin: '/admin',
    NotFound: '/404',
  };
  var PUBLIC = { Main: 1, Auth: 1, ResetPassword: 1, NotFound: 1, Help: 1 };
  var KEY = 'satap_session';

  var m = /\/([A-Za-z]+)\.dc\.html$/.exec(location.pathname);
  var BY_PATH = {};
  Object.keys(ROUTES).forEach(function (k) { BY_PATH[ROUTES[k]] = k; });
  var cleanPath = location.pathname.replace(/\/+$/, '') || '/';
  var page = m ? m[1] : (BY_PATH[cleanPath] || null);
  var cfg = window.UFQ_CONFIG || { url: '', key: '' };

  /* ---------------- session ---------------- */
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(s) {
    if (!s) { try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } return null; }
    if (!s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + Number(s.expires_in);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
    return s;
  }
  function authHeaders(token) {
    return { apikey: cfg.key, Authorization: 'Bearer ' + (token || cfg.key), 'Content-Type': 'application/json' };
  }
  function api(path, opts) {
    return fetch(cfg.url + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) {
          var msg = (j && (j.msg || j.message || j.error_description || j.error)) || ('Request failed (' + r.status + ')');
          var err = new Error(friendly(msg)); err.status = r.status; throw err;
        }
        return j;
      });
    });
  }
  function friendly(msg) {
    msg = String(msg);
    if (/invalid login/i.test(msg)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox.';
    if (/already registered|already been registered/i.test(msg)) return 'This email already has an account. Log in instead.';
    if (/password.*(short|least)/i.test(msg)) return 'Password must be at least 6 characters.';
    if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Try again in a minute.';
    if (/provider is not enabled/i.test(msg)) return 'Google sign-in is not enabled yet.';
    return msg;
  }

  var refreshing = null;
  function ensureFresh() {
    var s = read();
    if (!s || !s.refresh_token) return Promise.resolve(s);
    if (s.expires_at && s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s);
    if (!refreshing) {
      refreshing = api('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token: s.refresh_token }),
      }).then(function (j) { return save(j); }).catch(function () { return null; }).then(function (r) { refreshing = null; return r; });
    }
    return refreshing;
  }

  /* ---------------- public API ---------------- */
  var Ufq = {
    config: cfg,
    session: read,
    user: function () { var s = read(); return s && s.user || null; },
    isSignedIn: function () { var s = read(); return !!(s && s.access_token); },
    displayName: function () {
      var u = Ufq.user(); if (!u) return '';
      var md = u.user_metadata || {};
      return md.display_name || md.full_name || md.name || (u.email ? u.email.split('@')[0] : '');
    },
    firstName: function () { return (Ufq.displayName() || '').split(' ')[0]; },
    email: function () { var u = Ufq.user(); return u && u.email || ''; },
    signIn: function (email, password) {
      return api('/auth/v1/token?grant_type=password', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email: email, password: password }) })
        .then(function (j) { return save(j); });
    },
    signUp: function (email, password, name) {
      return api('/auth/v1/signup', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ email: email, password: password, data: { display_name: name, full_name: name } }),
      }).then(function (j) {
        if (j && j.access_token) { save(j); return { signedIn: true }; }
        return { signedIn: false, needsConfirm: true };
      });
    },
    resetPassword: function (email) {
      return api('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + '/reset-password'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ email: email }),
      });
    },
    updatePassword: function (password) {
      return ensureFresh().then(function (s) {
        if (!s) throw new Error('This reset link has expired. Request a new one.');
        return api('/auth/v1/user', { method: 'PUT', headers: authHeaders(s.access_token), body: JSON.stringify({ password: password }) });
      });
    },
    google: function () {
      return fetch(cfg.url + '/auth/v1/settings', { headers: { apikey: cfg.key } }).then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }).then(function (set) {
          if (set && set.external && set.external.google === false) throw new Error(friendly('provider is not enabled'));
          location.assign(cfg.url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + '/auth'));
        });
    },
    signOut: function () {
      var s = read();
      var done = function () { save(null); location.assign('/'); };
      if (!s) return done();
      fetch(cfg.url + '/auth/v1/logout', { method: 'POST', headers: authHeaders(s.access_token) }).then(done, done);
    },
    /* authenticated PostgREST call, e.g. Ufq.rest('/rest/v1/profiles?select=*&id=eq.' + id) */
    rest: function (path, opts) {
      return ensureFresh().then(function (s) {
        var token = s && s.access_token;
        opts = opts || {};
        opts.headers = Object.assign(authHeaders(token), opts.headers || {});
        return api(path, opts);
      });
    },
    go: function (name) { location.assign(ROUTES[name] || '/'); },
    toast: function (message, kind) {
      var el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.textContent = message;
      el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translate(-50%,12px);z-index:2147483000;max-width:min(92vw,460px);padding:13px 20px;border-radius:999px;font:600 14px/1.35 "Inter Tight",system-ui,sans-serif;color:#fff;background:' + (kind === 'ok' ? '#003049' : '#C1121F') + ';box-shadow:0 12px 40px rgba(0,48,73,.28);opacity:0;transition:opacity .25s,transform .25s;text-align:center';
      document.body.appendChild(el);
      requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'translate(-50%,0)'; });
      setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 4200);
    },
  };
  window.Ufq = Ufq;

  /* ---------------- LaTeX -> readable text (the design renders plain text, simple fractions included) ---------------- */
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ', 'k': 'ᵏ', 't': 'ᵗ' };
  var SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'x': 'ₓ' };
  var SYM = { pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ', phi: 'φ', omega: 'ω', cdot: '·', times: '×', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', pm: '±', mp: '∓', infty: '∞', circ: '°', degree: '°', angle: '∠', triangle: '△', approx: '≈', to: '→', rightarrow: '→', in: '∈', cup: '∪', cap: '∩', lt: '<', gt: '>', ldots: '…', dots: '…', cdots: '…', perp: '⊥', parallel: '∥', sim: '~', cong: '≅', prime: '′' };
  function mapChars(str, table) {
    var ok = str.split('').every(function (c) { return table[c]; });
    return ok ? str.split('').map(function (c) { return table[c]; }).join('') : null;
  }
  function conv(m) {
    var t = m, prev;
    t = t.replace(/\\(?:left|right|big|Big|bigg|Bigg)\b\s*/g, '').replace(/\\[,;:! ]|\\quad|\\qquad/g, ' ');
    t = t.replace(/\\(?:text|textbf|mathrm|mathbf|mathit|operatorname|mbox)\s*\{([^{}]*)\}/g, '$1');
    t = t.replace(/\\[dt]frac/g, '\\frac');
    do { // innermost fractions first
      prev = t;
      t = t.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, function (_, a, b) {
        var simple = function (x) { return /^[A-Za-z0-9.]+$/.test(x.trim()); };
        return (simple(a) ? a.trim() : '(' + a + ')') + '/' + (simple(b) ? b.trim() : '(' + b + ')');
      });
    } while (t !== prev);
    do {
      prev = t;
      t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, function (_, n, x) { return (n === '3' ? '∛' : n === '4' ? '∜' : '^' + n + '√') + '(' + x + ')'; });
      t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, function (_, x) { return /^[A-Za-z0-9.]+$/.test(x) ? '√' + x : '√(' + x + ')'; });
    } while (t !== prev);
    t = t.replace(/\\sqrt\s*([A-Za-z0-9])/g, '√$1');
    t = t.replace(/\\overline\s*\{([^{}]*)\}/g, function (_, x) { return x.split('').join('̅') + '̅'; });
    t = t.replace(/\\(?:vec|hat|bar)\s*\{([^{}]*)\}/g, '$1');
    t = t.replace(/\^\s*\{?\\circ\}?/g, '°');
    t = t.replace(/\^\s*\{([^{}]*)\}/g, function (_, x) { return mapChars(x, SUP) || '^(' + x + ')'; });
    t = t.replace(/\^\s*([A-Za-z0-9+\-])/g, function (_, x) { return SUP[x] || '^' + x; });
    t = t.replace(/_\s*\{([^{}]*)\}/g, function (_, x) { return mapChars(x, SUB) || '_(' + x + ')'; });
    t = t.replace(/_\s*([0-9n])/g, function (_, x) { return SUB[x] || '_' + x; });
    t = t.replace(/\\%/g, '%').replace(/\\\$/g, '$').replace(/\\&/g, '&').replace(/\\#/g, '#');
    t = t.replace(/\\(sin|cos|tan|cot|sec|csc|log|ln|min|max|lim)\b/g, '$1');
    t = t.replace(/\\([A-Za-z]+)/g, function (all, name) { return Object.prototype.hasOwnProperty.call(SYM, name) ? SYM[name] : name; });
    t = t.replace(/[{}]/g, '').replace(/\\\\/g, ' ').replace(/\\/g, '');
    return t;
  }
  Ufq.tex = function (input) {
    if (input == null) return '';
    var s = String(input);
    s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?(?:p|div|b|i|em|strong|u|span|sub|sup)[^>]*>/gi, '');
    s = s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (_, a) { return conv(a); }).replace(/\$([^$]+)\$/g, function (_, a) { return conv(a); });
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (_, a) { return conv(a); }).replace(/\\\[([\s\S]+?)\\\]/g, function (_, a) { return conv(a); });
    if (/\\[A-Za-z]/.test(s)) s = conv(s);
    return s.replace(/\s+/g, ' ').trim();
  };

  /* ---------------- questions + saving results ---------------- */
  var SLUGS = { 'algebra': 1, 'geometry': 1, 'advanced-math': 1, 'data-analysis': 1, 'problem-solving': 1 };
  Ufq.subjects = function () {
    if (!Ufq._subjects) {
      Ufq._subjects = fetch(cfg.url + '/rest/v1/subjects?select=id,slug,title&order=order_index', { headers: { apikey: cfg.key } })
        .then(function (r) { return r.json(); }).then(function (rows) { return rows.filter(function (x) { return SLUGS[x.slug]; }); });
    }
    return Ufq._subjects;
  };
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function steps(text) {
    var t = Ufq.tex(text || '');
    if (!t) return [];
    var parts = t.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/).map(function (x) { return x.trim(); }).filter(Boolean);
    return parts.slice(0, 5);
  }
  /* Written (grid-in) answers: the stored key may list alternatives, "87/2 or 43.5" */
  function toNumber(raw) {
    var t = String(raw == null ? '' : raw).trim().replace(/[$,\s]/g, '').replace(/^\+/, '');
    if (!t) return NaN;
    var frac = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
    if (/^-?\d*\.?\d+$/.test(t)) return Number(t);
    return NaN;
  }
  Ufq.isWrittenCorrect = function (input, key) {
    var given = String(input == null ? '' : input).trim();
    if (!given) return false;
    var cands = String(key == null ? '' : key).split(/\s+or\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
    var g = toNumber(given);
    for (var i = 0; i < cands.length; i++) {
      var cand = cands[i];
      if (given.toLowerCase() === cand.toLowerCase()) return true;
      var c = toNumber(cand);
      if (isNaN(g) || isNaN(c)) continue;
      if (Math.abs(g - c) <= 1e-9 * Math.max(1, Math.abs(c))) return true;
      if (cand.indexOf('/') > -1 && /^-?\d*\.\d{2,3}$/.test(given.replace(/,/g, '')) && Math.abs(g - c) <= 0.0051) return true;
    }
    return false;
  };

  var QCOLS = 'id,subject_id,difficulty,question_text,options,correct_index,image_url,explanation,question_type';
  function countOf(subjectId) {
    return ensureFresh().then(function (s) {
      var h = authHeaders(s && s.access_token); h.Prefer = 'count=exact'; h.Range = '0-0'; h['Range-Unit'] = 'items';
      return fetch(cfg.url + '/rest/v1/questions?select=id&subject_id=eq.' + subjectId, { headers: h }).then(function (r) {
        var m = /\/(\d+)$/.exec(r.headers.get('content-range') || ''); return m ? Number(m[1]) : 0;
      });
    });
  }
  function toQuestion(q, sub) {
    var written = q.question_type === 'written';
    var options = Array.isArray(q.options) ? q.options : [];
    if (!written && (options.length < 2 || options.length > 4)) return null;
    var key = written ? Ufq.tex(q.explanation || '') : '';
    return {
      id: q.id, subjectId: q.subject_id, subject: sub.title || 'Math',
      stem: Ufq.tex(q.question_text), written: written, key: key,
      opts: written ? [] : options.map(function (x) { return Ufq.tex(x); }),
      c: written ? key : ('ABCD'[q.correct_index] || 'A'),
      fig: q.image_url || '', steps: written ? (key ? ['The correct answer is ' + key + '.'] : []) : steps(q.explanation), trap: '', skill: sub.title || 'Math',
      raw: { id: q.id, question_text: q.question_text, options: q.options, correct_index: q.correct_index, explanation: q.explanation, question_type: q.question_type },
    };
  }
  /* options: { slugs: ['algebra', ...] (empty = all five), count: 10 }
     Draws random questions from the whole bank (multiple choice and written). */
  Ufq.loadQuestions = function (o) {
    o = o || {};
    var want = Math.max(1, Math.min(Number(o.count) || 10, 40));
    return Ufq.subjects().then(function (subjects) {
      var chosen = subjects.filter(function (x) { return !(o.slugs && o.slugs.length) || o.slugs.indexOf(x.slug) > -1; });
      return Promise.all(chosen.map(function (x) { return countOf(x.id).then(function (n) { return { sub: x, n: n }; }); })).then(function (pools) {
        pools = pools.filter(function (p) { return p.n > 0; });
        var total = pools.reduce(function (t, p) { return t + p.n; }, 0);
        if (!total) return [];
        var got = {}, out = [], rounds = 0;
        function pickOne(used) {
          var r = Math.floor(Math.random() * total), p = null;
          for (var k = 0; k < pools.length; k++) { if (r < pools[k].n) { p = pools[k]; break; } r -= pools[k].n; }
          var key = p.sub.id + ':' + r;
          if (used[key]) return null;
          used[key] = 1;
          return Ufq.rest('/rest/v1/questions?select=' + QCOLS + '&subject_id=eq.' + p.sub.id + '&order=id&limit=1&offset=' + r)
            .then(function (rows) { return rows && rows[0] ? { q: rows[0], sub: p.sub } : null; });
        }
        function round() {
          rounds++;
          var need = Math.min(want - out.length + 4, total), jobs = [], used = {};
          for (var i = 0; i < need * 3 && jobs.length < need; i++) { var j = pickOne(used); if (j) jobs.push(j); }
          return Promise.all(jobs).then(function (items) {
            items.forEach(function (it) {
              if (!it || got[it.q.id] || out.length >= want) return;
              var q = toQuestion(it.q, it.sub); if (!q) return;
              got[it.q.id] = 1; out.push(q);
            });
            return out.length < want && rounds < 4 ? round() : out;
          });
        }
        return round();
      });
    });
  };

  /* full-screen cover while a page loads its real data; call the returned function to remove it */
  Ufq.cover = function (text) {
    var c = document.createElement('div');
    c.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#FFFFFF;display:flex;align-items:center;justify-content:center;font:500 22px "Newsreader",Georgia,serif;font-style:italic;color:#003049';
    c.textContent = text || 'Loading…';
    (document.body || document.documentElement).appendChild(c);
    return function () { c.remove(); };
  };
  var DOMAIN_INDEX = { 'Algebra': 0, 'Advanced Math': 1, 'Problem Solving': 2, 'Data Analysis': 2, 'Geometry': 3 };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* real practice attempts, newest first, in the shape the History page uses */
  Ufq.history = function () {
    return Ufq.rest('/rest/v1/practice_tests?select=id,title,subject,score,total,duration,taken_at,answers&order=taken_at.desc&limit=200').then(function (rows) {
      var list = rows.map(function (r, i) {
        var d = new Date(r.taken_at);
        var acc = r.total ? Math.round(r.score / r.total * 100) : 0;
        var dom = [0, 0, 0, 0]; var di = DOMAIN_INDEX[r.subject]; if (di !== undefined) dom[di] = acc;
        return { id: i + 1, rid: r.id, d: MON[d.getMonth()] + ' ' + d.getDate(), t: r.title, ty: 'practice', acc: acc, min: Math.max(1, Number(r.duration) || 1), sc: r.score, max: r.total, ts: d.getTime(), subject: r.subject, dom: dom, answers: r.answers, note: 'Saved from your practice set.' };
      });
      list.forEach(function (x, i) {
        var prev = list.slice(i + 1).find(function (y) { return y.subject === x.subject; });
        x.delta = prev ? (x.acc - prev.acc >= 0 ? '+' : '') + (x.acc - prev.acc) : 'First';
      });
      return list;
    });
  };


  var GROUPS = { 'Algebra': 'Algebra', 'Geometry': 'Geometry & Trig', 'Advanced Math': 'Advanced Math', 'Problem Solving': 'Problem-Solving & Data', 'Data Analysis': 'Problem-Solving & Data' };
  function ago(ts) {
    var d = Math.floor((Date.now() - ts) / 86400000);
    return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? d + ' days ago' : d < 14 ? '1 week ago' : Math.floor(d / 7) + ' weeks ago';
  }
  /* open mistakes from saved attempts, in the Mistakes page's row shape:
     [type, domain, when, stem, 'B · yours', 'C · right', why, streak] */
  Ufq.mistakes = function (given) {
    return (given ? Promise.resolve(given) : Ufq.history()).then(function (list) {
      var seen = {}, out = [];
      list.forEach(function (t) {
        (t.answers || []).forEach(function (a) {
          var q = a && a.question; if (!q || a.correct || !q.id || seen[q.id]) return;
          seen[q.id] = 1;
          var opts = Array.isArray(q.options) ? q.options : [];
          var wr = q.question_type === 'written';
          var mine = (a.selected === null || a.selected === undefined || a.selected === '') ? '—' : wr ? String(a.selected) : 'ABCD'[a.selected] + ' · ' + Ufq.tex(opts[a.selected]);
          var right = wr ? Ufq.tex(q.explanation) : 'ABCD'[q.correct_index] + ' · ' + Ufq.tex(opts[q.correct_index]);
          var why = wr ? 'The correct answer is ' + Ufq.tex(q.explanation) + '.' : ((Ufq.tex(q.explanation || '').split(/(?<=[.!?])\s+/)[0]) || 'Open the review for this question to see the steps.');
          out.push([mine === '—' ? 'time' : 'concept', GROUPS[t.subject] || 'Algebra', ago(t.ts), Ufq.tex(q.question_text), mine, right, why, 0]);
        });
      });
      return out;
    });
  };


  /* ---------------- login streak + dashboard numbers ---------------- */
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  Ufq.today = function () { return ymd(new Date()); };
  Ufq.trackLogin = function () {
    var u = Ufq.user(); if (!u) return;
    var today = Ufq.today(), key = 'ufq_login_' + u.id;
    try { if (localStorage.getItem(key) === today) return; } catch (e) { /* storage blocked */ }
    Ufq.rest('/rest/v1/login_streaks?on_conflict=user_id,login_date', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ user_id: u.id, login_date: today }) })
      .then(function () { try { localStorage.setItem(key, today); } catch (e) { /* ignore */ } }).catch(function () { /* will retry next visit */ });
  };
  Ufq.goal = function () {
    var g = null; try { g = JSON.parse(localStorage.getItem('ufq_goal') || 'null'); } catch (e) { g = null; }
    return { target: g && g.target ? Number(g.target) : 750, date: g && g.date ? g.date : '' };
  };
  var STAGE_AT = [0, 400, 550, 700];
  function stageOf(score) { return score >= 700 ? 3 : score >= 550 ? 2 : score >= 400 ? 1 : 0; }
  var DOMAINS = [
    { name: 'Algebra', slugs: ['algebra'], q: 'algebra' },
    { name: 'Advanced Math', slugs: ['advanced-math'], q: 'advanced-math' },
    { name: 'Problem-Solving & Data', slugs: ['problem-solving', 'data-analysis'], q: 'problem-solving,data-analysis' },
    { name: 'Geometry & Trig', slugs: ['geometry'], q: 'geometry' },
  ];
  /* everything the Dashboard shows, from the user's real activity */
  Ufq.dashboard = function () {
    return Promise.all([
      Ufq.subjects(),
      Ufq.rest('/rest/v1/user_scores?select=subject_id,score'),
      Ufq.history(),
      Ufq.rest('/rest/v1/login_streaks?select=login_date&order=login_date.desc&limit=500'),
    ]).then(function (r) {
      var subjects = r[0], scores = r[1] || [], hist = r[2] || [], logins = r[3] || [];
      var idSlug = {}; subjects.forEach(function (x) { idSlug[x.id] = x.slug; });
      var bySlug = {}; scores.forEach(function (x) { bySlug[idSlug[x.subject_id]] = x.score; });
      var domains = DOMAINS.map(function (d) {
        var vals = d.slugs.map(function (sl) { return bySlug[sl]; }).filter(function (v) { return v !== undefined; });
        var score = vals.length ? Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) : 0;
        return { name: d.name, q: d.q, score: score, started: vals.length > 0, stage: stageOf(score) };
      });
      var weakest = domains.slice().sort(function (a, b) { return a.score - b.score; })[0];
      var days = {}; logins.forEach(function (x) { days[x.login_date] = 1; });
      hist.forEach(function (h) { days[ymd(new Date(h.ts))] = 1; });
      var today = Ufq.today();
      days[today] = 1;
      var keys = Object.keys(days).sort();
      var cur = 0, d = new Date(); if (!days[ymd(d)]) d.setDate(d.getDate() - 1);
      while (days[ymd(d)]) { cur++; d.setDate(d.getDate() - 1); }
      var longest = 0, run = 0, prev = null;
      keys.forEach(function (k) { var t = new Date(k + 'T00:00:00'); if (prev && Math.round((t - prev) / 86400000) === 1) run++; else run = 1; if (run > longest) longest = run; prev = t; });
      var join = keys[0] || today;
      var weekIn = 0; for (var i = 0; i < 7; i++) { var dd = new Date(); dd.setDate(dd.getDate() - i); if (days[ymd(dd)]) weekIn++; }
      var now = Date.now(), wk = 7 * 86400000;
      var thisW = hist.filter(function (h) { return now - h.ts < wk; }), lastW = hist.filter(function (h) { return now - h.ts >= wk && now - h.ts < 2 * wk; });
      var pct = function (list) { var t = list.reduce(function (a, h) { return a + h.max; }, 0), c = list.reduce(function (a, h) { return a + h.sc; }, 0); return t ? Math.round(c / t * 100) : null; };
      return Ufq.mistakes(hist).then(function (mis) {
        return { domains: domains, weakest: weakest, days: days, join: join, today: today, streak: cur, longest: longest, weekIn: weekIn, signedIn: keys.length, since: Math.max(1, Math.round((new Date(today + 'T00:00:00') - new Date(join + 'T00:00:00')) / 86400000) + 1), history: hist, last: hist[0] || null, accWeek: pct(thisW), accPrev: pct(lastW), mistakes: mis.length };
      });
    });
  };
  /* remove the design's sample-only areas and fix role-based links */
  var REMOVED = { Plan: 1, Report: 1, Notifications: 1, Lesson: 1 };
  if (page && REMOVED[page]) { location.replace('/dashboard'); return; }
  if (page === 'MockTests') { location.replace('/practice/sat-tests'); return; }
  if (page === 'Admin') { location.replace('/admin/questions'); return; }
  (function () {
    var st = document.createElement('style');
    st.textContent = 'a.nv[href="/plan"],a.nv[href="/report"],a.nv[href="/notifications"],a.nv[href="/lesson"],a.nv[href="/admin"],a[href="/admin"],button[aria-label="Notifications"]{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  })();
  if (Ufq.isSignedIn()) {
    Ufq.rest('/rest/v1/profiles?select=role&id=eq.' + (Ufq.user() || {}).id).then(function (rows) {
      var role = rows && rows[0] && rows[0].role;
      if (role === 'admin' || role === 'owner') {
        var st2 = document.createElement('style');
        st2.textContent = 'a.nv[href="/admin"],a[href="/admin"],a[href="/admin/questions"]{display:flex!important}';
        document.head.appendChild(st2);
        var fix = function () { document.querySelectorAll('a[href="/admin"]').forEach(function (a) { a.setAttribute('href', '/admin/questions'); }); };
        fix(); new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true });
      }
    }).catch(function () { /* not an admin */ });
    Ufq.trackLogin();
  }


  /* saved preferences (Settings page) that apply everywhere */
  Ufq.applyPrefs = function () {
    var sv = null; try { sv = JSON.parse(localStorage.getItem('ufq_settings') || 'null'); } catch (e) { sv = null; }
    var el = document.getElementById('ufq-prefs');
    if (!el) { el = document.createElement('style'); el.id = 'ufq-prefs'; (document.head || document.documentElement).appendChild(el); }
    el.textContent = sv && sv.motion ? '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition-duration:.001s!important}' : '';
  };
  Ufq.applyPrefs();

  /* result: { title, subjectId (or null), subjectTitle, score, total, minutes, answers:[{qIdx, selected, correct, question}] } */
  Ufq.savePractice = function (r) {
    var u = Ufq.user(); if (!u) return Promise.reject(new Error('Not signed in'));
    var uid = u.id;
    var row = { user_id: uid, subject_id: r.subjectId || null, title: r.title, subject: r.subjectTitle || 'Mixed', score: r.score, total: r.total, duration: String(r.minutes || 0), answers: r.answers };
    return Ufq.rest('/rest/v1/practice_tests', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }).then(function (saved) {
      var pct = r.total ? r.score / r.total : 0;
      var jobs = [Ufq.rest('/rest/v1/user_activity', { method: 'POST', body: JSON.stringify({ user_id: uid, action: 'Test completed', detail: r.title + ' — ' + r.score + '/' + r.total + ' (' + Math.round(pct * 100) + '%)' }) })];
      if (r.subjectId) {
        var scaled = Math.round(pct * 800);
        jobs.push(Ufq.rest('/rest/v1/user_scores?select=score&user_id=eq.' + uid + '&subject_id=eq.' + r.subjectId).then(function (ex) {
          if (ex && ex.length && ex[0].score >= scaled) return null;
          return Ufq.rest('/rest/v1/user_scores?on_conflict=user_id,subject_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: uid, subject_id: r.subjectId, score: scaled, max_score: 800, last_updated: new Date().toISOString() }) });
        }));
      }
      return Promise.all(jobs).then(function () { return saved; });
    });
  };

  /* ---------------- OAuth / recovery return (#access_token=...) ---------------- */
  var hash = location.hash && location.hash.indexOf('access_token=') > -1 ? new URLSearchParams(location.hash.slice(1)) : null;
  if (hash && hash.get('access_token')) {
    var type = hash.get('type');
    var sess = {
      access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'),
      expires_in: Number(hash.get('expires_in') || 3600), token_type: 'bearer',
    };
    sess.expires_at = hash.get('expires_at') ? Number(hash.get('expires_at')) : undefined;
    save(sess);
    // fetch the user object, then continue to the right page
    fetch(cfg.url + '/auth/v1/user', { headers: authHeaders(sess.access_token) }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }).then(function (u) {
        if (u) { sess.user = u; save(sess); }
        history.replaceState(null, '', location.pathname);
        if (type === 'recovery') { if (page !== 'ResetPassword') location.replace('/reset-password'); else location.reload(); }
        else location.replace('/dashboard');
      });
    window.__ufqHold = true;
    return;
  }

  /* ---------------- guard + clean URL ---------------- */
  if (page && !PUBLIC[page] && !Ufq.isSignedIn()) {
    location.replace('/auth');
    return;
  }
  if (page && ROUTES[page] && page !== 'NotFound' && location.pathname !== ROUTES[page]) {
    try { history.replaceState(null, '', ROUTES[page] + location.search + location.hash); } catch (e) { /* ignore */ }
  }

  if (page === 'Auth' && Ufq.isSignedIn()) { location.replace('/dashboard'); return; }

  // refresh an almost-expired token in the background
  ensureFresh();

  // any "Sign out" / "Log out" control signs the user out of the real session
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('a,button');
    if (!el || !/^(sign out|log out)$/i.test((el.textContent || '').replace(/\s+/g, ' ').trim())) return;
    e.preventDefault(); e.stopPropagation(); Ufq.signOut();
  }, true);

  // full mock tests run on the site's real SAT test engine (questions, modules, timer, scoring)
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || !/^(\/mock-test|[^?#]*MockTest\.dc\.html)(\?|#|$)/.test(a.getAttribute('href') || '')) return;
    e.preventDefault(); e.stopPropagation(); location.assign('/practice/sat-tests');
  }, true);

  // keep the browser's relative links working when the page is shown at a clean URL
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var t = document.getElementById(id);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
})();
