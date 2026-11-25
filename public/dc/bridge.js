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
    signOut: function (to) {
      var s = read();
      var done = function () { save(null); location.assign(typeof to === 'string' ? to : '/'); };
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
    s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|li|tr)>/gi, '\n').replace(/<\/?(?:p|div|b|i|em|strong|u|span|sub|sup|table|thead|tbody|tr|td|th|ul|ol|li)[^>]*>/gi, ' ');
    s = s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (_, a) { return conv(a); }).replace(/\$([^$]+)\$/g, function (_, a) { return conv(a); });
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (_, a) { return conv(a); }).replace(/\\\[([\s\S]+?)\\\]/g, function (_, a) { return conv(a); });
    if (/\\[A-Za-z]/.test(s)) s = conv(s);
    return s.replace(/[ \t\f\v]+/g, ' ').replace(/ *\n+ */g, '\n').trim();
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
  function countOf(subjectId, hard) {
    return ensureFresh().then(function (s) {
      var h = authHeaders(s && s.access_token); h.Prefer = 'count=exact'; h.Range = '0-0'; h['Range-Unit'] = 'items';
      return fetch(cfg.url + '/rest/v1/questions?select=id&subject_id=eq.' + subjectId + (hard ? '&difficulty=in.(hard,elite)' : ''), { headers: h }).then(function (r) {
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
    var all = o.count === 'all';
    var want = all ? 100000 : Math.max(1, Math.min(Number(o.count) || 10, 120));
    return Ufq.subjects().then(function (subjects) {
      var chosen = subjects.filter(function (x) { return !(o.slugs && o.slugs.length) || o.slugs.indexOf(x.slug) > -1; });
      return Promise.all(chosen.map(function (x) { return countOf(x.id, o.hard).then(function (n) { return { sub: x, n: n }; }); })).then(function (pools) {
        pools = pools.filter(function (p) { return p.n > 0; });
        var total = pools.reduce(function (t, p) { return t + p.n; }, 0);
        if (!total) return [];
        if (all) {
          var hq = o.hard ? '&difficulty=in.(hard,elite)' : '';
          var pageOf = function (p, from) {
            return Ufq.rest('/rest/v1/questions?select=' + QCOLS + '&subject_id=eq.' + p.sub.id + hq + '&order=id&limit=1000&offset=' + from).then(function (rows) {
              rows = rows || [];
              var mapped = rows.map(function (q) { return toQuestion(q, p.sub); }).filter(Boolean);
              return rows.length === 1000 ? pageOf(p, from + 1000).then(function (rest) { return mapped.concat(rest); }) : mapped;
            });
          };
          return Promise.all(pools.map(function (p) { return pageOf(p, 0); })).then(function (lists) { return shuffle([].concat.apply([], lists)); });
        }
        var got = {}, out = [], rounds = 0;
        var hardQ = o.hard ? '&difficulty=in.(hard,elite)' : '';
        function round() {
          rounds++;
          var need = want - out.length + 6, jobs = [];
          pools.forEach(function (p) {
            var k = Math.min(p.n, Math.ceil(need * p.n / total) + 2);
            if (k <= 0) return;
            var start = Math.floor(Math.random() * Math.max(1, p.n - k + 1));
            jobs.push(Ufq.rest('/rest/v1/questions?select=' + QCOLS + '&subject_id=eq.' + p.sub.id + hardQ + '&order=id&limit=' + k + '&offset=' + start)
              .then(function (rows) { return (rows || []).map(function (q) { return { q: q, sub: p.sub }; }); }));
          });
          return Promise.all(jobs).then(function (lists) {
            var all = shuffle([].concat.apply([], lists));
            all.forEach(function (it) {
              if (got[it.q.id] || out.length >= want) return;
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


  /* how many questions the bank holds per subject: { algebra: 724, ... } */
  Ufq.bankCounts = function () {
    if (!Ufq._bank) {
      Ufq._bank = Ufq.subjects().then(function (subs) {
        return Promise.all(subs.map(function (x) { return countOf(x.id).then(function (n) { return [x.slug, n]; }); }));
      }).then(function (pairs) { var o = {}; pairs.forEach(function (p) { o[p[0]] = p[1]; }); return o; });
    }
    return Ufq._bank;
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
        return { id: i + 1, rid: r.id, d: MON[d.getMonth()] + ' ' + d.getDate(), t: r.title, ty: r.subject === 'SAT' ? 'mock' : 'practice', acc: acc, min: Math.max(1, Number(r.duration) || 1), sc: r.score, max: r.total, ts: d.getTime(), subject: r.subject, dom: dom, answers: r.answers, note: 'Saved from your practice set.' };
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
  (function () { var raw = Ufq.dashboard; Ufq.dashboard = function (fresh) { if (!fresh && Ufq._dashP && Date.now() - Ufq._dashT < 20000) return Ufq._dashP; Ufq._dashT = Date.now(); Ufq._dashP = raw(); return Ufq._dashP; }; })();
  /* remove the design's sample-only areas and fix role-based links */
  var hideAdmin = document.createElement('style'); hideAdmin.textContent = 'a.nv[href="/admin"]{display:none!important}'; (document.head || document.documentElement).appendChild(hideAdmin);
  if (Ufq.isSignedIn()) {
    Ufq.rest('/rest/v1/profiles?select=role&id=eq.' + (Ufq.user() || {}).id).then(function (rows) {
      var role = rows && rows[0] && rows[0].role;
      if (role === 'admin' || role === 'owner') {
        var st2 = document.createElement('style');
        st2.textContent = 'a.nv[href="/admin"]{display:flex!important}';
        document.head.appendChild(st2);
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


  /* ---------------- plan, mock tests, notifications ---------------- */
  var MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  /* weeks between the join date and the test month chosen in the goal (14 when unknown) */
  Ufq.plan = function (R) {
    var g = Ufq.goal(), join = new Date(((R && R.join) || Ufq.today()) + 'T00:00:00'), now = new Date();
    var total = 14, test = null;
    var m = /^([A-Za-z]{3}) (\d{4})$/.exec(g.date || '');
    if (m && MONTHS[m[1]] !== undefined) { test = new Date(Number(m[2]), MONTHS[m[1]], 15); total = Math.max(4, Math.min(30, Math.ceil((test - join) / 604800000))); }
    var week = Math.max(1, Math.min(total, Math.floor((now - join) / 604800000) + 1));
    return { total: total, week: week, daysLeft: test ? Math.max(0, Math.round((test - now) / 86400000)) : null };
  };
  /* full-length SAT tests from the question bank + this user's attempts */
  Ufq.satTests = function () {
    return Promise.all([
      Ufq.rest('/rest/v1/sat_tests?select=id,title,total_questions&total_questions=gt.0&order=created_at.asc'),
      Ufq.rest('/rest/v1/practice_tests?select=id,title,score,total,taken_at&subject=eq.SAT&order=taken_at.desc&limit=100'),
    ]).then(function (r) {
      return (r[0] || []).map(function (t) {
        var att = (r[1] || []).filter(function (a) { return a.title === t.title; })[0] || null;
        return { id: t.id, title: t.title, questions: t.total_questions, attempt: att };
      });
    });
  };
  function agoMin(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : m < 2880 ? 'Yesterday' : Math.round(m / 1440) + ' days ago';
  }
  /* notifications worked out from the user's own activity */
  Ufq.notifications = function (R, tests) {
    var out = [], id = 0, g = function (ts) { return Date.now() - ts < 86400000 ? 'Today' : 'Earlier'; };
    var wk = R.weakest, plan = Ufq.plan(R);
    var doneToday = (R.history || []).some(function (h) { return Ufq.today() === ymd(new Date(h.ts)); });
    if (!doneToday) out.push({ id: ++id, key: 'today-' + Ufq.today(), k: 'plan', t: 'Today’s session is waiting', s: (wk ? wk.name : 'Mixed practice') + ' — ten questions, about 15 minutes.', when: 'Today', g: 'Today', unread: true, href: '/practice/session?n=10' + (wk ? '&d=' + wk.q : ''), cta: 'Start session' });
    if (R.last) out.push({ id: ++id, key: 'last-' + R.last.rid, k: 'test', t: R.last.t + ': ' + R.last.sc + '/' + R.last.max, s: 'Your latest attempt was saved. Open History to see every answer.', when: agoMin(R.last.ts), g: g(R.last.ts), unread: true, href: '/history', cta: 'Open history' });
    if (R.streak >= 2) out.push({ id: ++id, key: 'streak-' + R.streak, k: 'streak', t: R.streak + '-day streak', s: 'You have studied ' + R.streak + ' days in a row. Longest so far: ' + R.longest + '.', when: 'Today', g: 'Today', unread: true, href: '/dashboard', cta: 'See progress' });
    if (R.mistakes) out.push({ id: ++id, key: 'mist-' + R.mistakes, k: 'mistake', t: R.mistakes + ' mistake' + (R.mistakes === 1 ? '' : 's') + ' ready to redo', s: 'Practice them again to clear them from your log.', when: 'Today', g: 'Today', unread: true, href: '/mistakes', cta: 'Redo mistakes' });
    var ready = (tests || []).filter(function (t) { return !t.attempt; })[0];
    if (ready) out.push({ id: ++id, key: 'mock-' + ready.id, k: 'test', t: ready.title + ' is ready', s: 'A full-length test with ' + ready.questions + ' questions.', when: 'Available', g: 'Earlier', unread: true, href: '/mock-tests', cta: 'Open mock tests' });
    out.push({ id: ++id, key: 'week-' + plan.week, k: 'plan', t: 'Week ' + plan.week + ' of ' + plan.total, s: plan.daysLeft !== null ? plan.daysLeft + ' days to your test. Keep the pace.' : 'Set your test date in Settings to see the countdown.', when: 'This week', g: 'Earlier', unread: true, href: '/plan', cta: 'Open plan' });
    var readSet = {}; try { readSet = JSON.parse(localStorage.getItem('ufq_notif_read') || '{}'); } catch (e) { readSet = {}; }
    var dropped = {}; try { dropped = JSON.parse(localStorage.getItem('ufq_notif_gone') || '{}'); } catch (e) { dropped = {}; }
    return out.filter(function (n) { return !dropped[n.key]; }).map(function (n) { n.unread = !readSet[n.key]; return n; });
  };
  Ufq.notifState = function (items, gone) {
    var read = {}, drop = {}; try { read = JSON.parse(localStorage.getItem('ufq_notif_read') || '{}'); drop = JSON.parse(localStorage.getItem('ufq_notif_gone') || '{}'); } catch (e) { /* ignore */ }
    items.forEach(function (n) { if (!n.unread) read[n.key] = 1; else delete read[n.key]; });
    (gone || []).forEach(function (k) { drop[k] = 1; });
    try { localStorage.setItem('ufq_notif_read', JSON.stringify(read)); localStorage.setItem('ufq_notif_gone', JSON.stringify(drop)); } catch (e) { /* ignore */ }
  };
  /* sidebar: real target line, initial, streak-freeze count */
  Ufq.decorate = function (R) {
    var g = Ufq.goal();
    var line = 'Target ' + g.target + (g.date ? ' · ' + g.date.replace(/ \d{4}$/, '') : '');
    var init = ((Ufq.displayName() || 'U').trim()[0] || 'U').toUpperCase();
    var apply = function () {
      document.querySelectorAll('a.acct').forEach(function (a) {
        var spans = a.querySelectorAll('span');
        if (spans[0] && spans[0].textContent !== init) spans[0].textContent = init;
        spans.forEach(function (sp) { if (/^Target \d+/.test(sp.textContent) && sp.textContent !== line) sp.textContent = line; });
      });
      var fr = document.querySelector('[data-ufq="freeze"]');
      if (fr && R) {
        var used = 0, d = new Date();
        for (var i = 1; i < 7; i++) { var dd = new Date(); dd.setDate(dd.getDate() - i); if (!R.days[ymd(dd)] && ymd(dd) >= R.join) used++; }
        var left = used > 0 ? 0 : 1; var txt = left + ' left';
        if (fr.textContent !== txt) fr.textContent = txt;
      }
    };
    apply(); new MutationObserver(apply).observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (Ufq.isSignedIn() && page && !PUBLIC[page]) {
    Ufq.dashboard().then(function (R) { Ufq.decorate(R); }).catch(function () { Ufq.decorate(null); });
  }
  /* every signed-in page: pick up a pending invite once, turn suspended accounts away, guard Admin */
  if (Ufq.isSignedIn() && page && !PUBLIC[page]) {
    var me0 = Ufq.user() || {};
    var claimed = ''; try { claimed = sessionStorage.getItem('ufq_claimed') || ''; } catch (e) { /* ignore */ }
    var claim = claimed === me0.id ? Promise.resolve() : Ufq.rest('/rest/v1/rpc/claim_invite', { method: 'POST', body: '{}' }).then(function () { try { sessionStorage.setItem('ufq_claimed', me0.id); } catch (e) { /* ignore */ } }).catch(function () { /* migration not applied yet */ });
    claim.then(function () { return Ufq.rest('/rest/v1/profiles?select=role,suspended&id=eq.' + me0.id).catch(function () { return Ufq.rest('/rest/v1/profiles?select=role&id=eq.' + me0.id); }); }).then(function (rows) {
      var row = rows && rows[0] || {};
      if (row.suspended) { Ufq.signOut('/auth?suspended=1'); return; }
      if (page === 'Admin' && row.role !== 'admin' && row.role !== 'owner') location.replace('/dashboard');
    }).catch(function () { if (page === 'Admin') location.replace('/dashboard'); });
  }
  if (page === 'Auth' && /[?&]suspended=1/.test(location.search)) setTimeout(function () { Ufq.toast('This account has been suspended. Contact your administrator.'); }, 400);

  /* everything this user has saved, as a downloadable file */
  Ufq.exportData = function () {
    return Promise.all([Ufq.history(), Ufq.rest('/rest/v1/login_streaks?select=login_date&order=login_date'), Ufq.rest('/rest/v1/user_scores?select=*')]).then(function (r) {
      var data = { account: { email: Ufq.email(), name: Ufq.displayName() }, goal: Ufq.goal(), attempts: r[0], login_days: (r[1] || []).map(function (x) { return x.login_date; }), scores: r[2] };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ufq-my-data.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  };
  /* removes the user's saved results (their sign-in itself can only be removed by an admin) and signs out */
  Ufq.deleteMyData = function () {
    var uid = (Ufq.user() || {}).id; if (!uid) return Promise.reject(new Error('Not signed in'));
    var del = function (t) { return Ufq.rest('/rest/v1/' + t + '?user_id=eq.' + uid, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); };
    return Promise.all(['practice_tests', 'user_scores', 'user_activity', 'login_streaks', 'user_total_scores'].map(del)).then(function () {
      ['ufq_goal', 'ufq_settings', 'ufq_notif_read', 'ufq_notif_gone', 'ufq_notif_prefs', 'ufq_login_' + uid].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    });
  };


  /* ---------------- admin: everything the Admin page shows comes from the database ---------------- */
  var DOM_BY_SLUG = { 'algebra': 'Algebra', 'advanced-math': 'Advanced Math', 'problem-solving': 'Problem-Solving & Data', 'data-analysis': 'Problem-Solving & Data', 'geometry': 'Geometry & Trig' };
  var DOM_BY_TITLE = { 'Algebra': 'Algebra', 'Advanced Math': 'Advanced Math', 'Problem Solving': 'Problem-Solving & Data', 'Data Analysis': 'Problem-Solving & Data', 'Geometry': 'Geometry & Trig' };
  var SLUG_BY_DOM = { 'Algebra': 'algebra', 'Advanced Math': 'advanced-math', 'Problem-Solving & Data': 'problem-solving', 'Geometry & Trig': 'geometry' };
  var DIFF_NUM = { easy: 1, medium: 2, hard: 3, elite: 3, mixing: 2 };
  var QSEL = 'id,subject_id,difficulty,question_text,options,correct_index,image_url,explanation,question_type,created_at';
  function adminQ(row, slugById, stats) {
    var mc = row.question_type !== 'written';
    var opts = Array.isArray(row.options) ? row.options : [];
    var st = stats && stats[row.id];
    return { id: row.id, stem: row.question_text, dom: DOM_BY_SLUG[slugById[row.subject_id]] || 'Algebra', sk: DOM_BY_SLUG[slugById[row.subject_id]] || 'General', d: DIFF_NUM[row.difficulty] || 2, t: mc ? 'MC' : 'Grid',
      cr: st && st.attempts >= 3 ? Math.round(st.correct / st.attempts * 100) : 0, st: 'Live',
      ch: mc ? opts.concat(['', '', '', '']).slice(0, Math.max(4, opts.length)) : ['', '', '', ''], c: mc ? Math.max(0, row.correct_index) : 0, ans: mc ? '' : (row.explanation || ''), ex: mc ? (row.explanation || '') : '',
      img: row.image_url || '', lay: 'auto', iw: 0, ih: 0 };
  }
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function rpc(name, args) { return Ufq.rest('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }); }
  Ufq.adminRpc = rpc;

  /* o: { term, dom, diff ('Easy'|'Medium'|'Hard') } -> newest 400 matching questions */
  Ufq.adminQuestions = function (o, slugById, stats) {
    o = o || {};
    var q = '/rest/v1/questions?select=' + QSEL + '&order=created_at.desc&limit=400';
    if (o.term && o.term.trim().length >= 2) q += '&question_text=ilike.*' + encodeURIComponent(o.term.trim().replace(/[*%,()]/g, ' ')) + '*';
    if (o.dom && o.dom !== 'All') {
      var ids = Object.keys(slugById).filter(function (id) { return DOM_BY_SLUG[slugById[id]] === o.dom; });
      if (!ids.length) return Promise.resolve([]);
      q += '&subject_id=in.(' + ids.join(',') + ')';
    }
    if (o.diff && o.diff !== 'All') q += '&difficulty=in.(' + (o.diff === 'Easy' ? 'easy' : o.diff === 'Hard' ? 'hard,elite' : 'medium,mixing') + ')';
    return Ufq.rest(q).then(function (rows) { return rows.map(function (r) { return adminQ(r, slugById, stats); }); });
  };

  Ufq.adminLoad = function () {
    return Ufq.subjects().then(function (subs) {
      var slugById = {}, idBySlug = {}; subs.forEach(function (x) { slugById[x.id] = x.slug; idBySlug[x.slug] = x.id; });
      var me = Ufq.user() || {};
      var soft = function (p, d) { return p.catch(function () { return d; }); };
      return Promise.all([
        soft(rpc('get_all_profiles'), []),
        soft(rpc('get_all_practice_tests'), []),
        soft(rpc('get_all_logins'), []),
        soft(rpc('get_question_stats'), []),
        Ufq.bankCounts(),
        soft(Ufq.satTests(), []),
        soft(Ufq.rest('/rest/v1/admin_audit?select=*&order=created_at.desc&limit=300'), []),
        soft(Ufq.rest('/rest/v1/invites?select=*&order=created_at.desc'), []),
      ]).then(function (r) {
        var profiles = r[0] || [], attempts = r[1] || [], logins = r[2] || [], statRows = r[3] || [], bank = r[4], sats = r[5] || [], audit = r[6] || [], invites = r[7] || [];
        var stats = {}; statRows.forEach(function (x) { stats[x.question_id] = { attempts: Number(x.attempts), correct: Number(x.correct) }; });
        var total = Object.keys(bank).reduce(function (t, k) { return t + bank[k]; }, 0);
        var today = new Date(); var dayKey = function (d) { return ymd(d); };
        var loginsBy = {}; logins.forEach(function (l) { (loginsBy[l.user_id] = loginsBy[l.user_id] || {})[l.login_date] = 1; });
        var attBy = {}; attempts.forEach(function (a) { (attBy[a.user_id] = attBy[a.user_id] || []).push(a); });
        var streakOf = function (days) { var c = 0, d = new Date(); if (!days[dayKey(d)]) d.setDate(d.getDate() - 1); while (days[dayKey(d)]) { c++; d.setDate(d.getDate() - 1); } return c; };
        var users = profiles.map(function (p) {
          var mine = p.id === me.id, d = new Date(p.created_at), A = attBy[p.id] || [], days = loginsBy[p.id] || {};
          var lastTs = Math.max.apply(null, [0].concat(A.map(function (a) { return new Date(a.taken_at).getTime(); }), Object.keys(days).map(function (k) { return new Date(k + 'T00:00:00').getTime(); })));
          var sumT = A.reduce(function (t, a) { return t + a.total; }, 0), sumC = A.reduce(function (t, a) { return t + a.score; }, 0);
          var best = A.reduce(function (m, a) { return Math.max(m, a.total ? Math.round(a.score / a.total * 800) : 0); }, 0);
          return { id: mine ? 1 : p.id, rid: p.id, n: mine ? 'You' : (p.display_name || (p.email || 'Student').split('@')[0]), e: p.email || '—',
            r: p.role === 'owner' ? 'Owner' : p.role === 'admin' ? 'Admin' : 'Student', s: p.suspended ? 'Suspended' : 'Active',
            j: MON3[d.getMonth()] + ' ' + d.getFullYear(), la: lastTs ? (mine ? 'Now' : agoMin(lastTs)) : 'Never', m: best || '—', k: Object.keys(days).length ? streakOf(days) : '—', qd: sumT || '—', ac: sumT ? Math.round(sumC / sumT * 100) + '%' : '—' };
        });
        invites.filter(function (i) { return !i.accepted; }).forEach(function (i) {
          users.push({ id: 'inv:' + i.email, rid: null, n: i.email.split('@')[0], e: i.email, r: i.role === 'admin' ? 'Admin' : 'Student', s: 'Invited', j: MON3[new Date(i.created_at).getMonth()] + ' ' + new Date(i.created_at).getFullYear(), la: 'Not yet', m: '—', k: '—', qd: '—', ac: '—' });
        });
        if (!users.some(function (u) { return u.id === 1; })) users.unshift({ id: 1, rid: me.id, n: 'You', e: me.email || '', r: 'Admin', s: 'Active', j: '—', la: 'Now', m: '—', k: '—', qd: '—', ac: '—' });
        // charts
        var daysBack = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return d; };
        var signSeries = []; for (var i = 29; i >= 0; i--) { var key = dayKey(daysBack(i)); signSeries.push(logins.filter(function (l) { return l.login_date === key; }).length); }
        var wau = []; for (var w = 7; w >= 0; w--) { var from = daysBack(w * 7 + 6), to = daysBack(w * 7), set = {}; logins.forEach(function (l) { var t = new Date(l.login_date + 'T00:00:00'); if (t >= new Date(ymd(from) + 'T00:00:00') && t <= new Date(ymd(to) + 'T23:59:59')) set[l.user_id] = 1; }); wau.push(Object.keys(set).length); }
        var wkAgo = Date.now() - 7 * 86400000, moAgo = Date.now() - 30 * 86400000;
        var week = attempts.filter(function (a) { return new Date(a.taken_at).getTime() > wkAgo; });
        var scaled = attempts.filter(function (a) { return a.total && new Date(a.taken_at).getTime() > moAgo; }).map(function (a) { return Math.round(a.score / a.total * 800); });
        var avgScore = scaled.length ? Math.round(scaled.reduce(function (t, x) { return t + x; }, 0) / scaled.length) : 0;
        var activeWeek = {}; logins.forEach(function (l) { if (new Date(l.login_date + 'T00:00:00').getTime() > wkAgo) activeWeek[l.user_id] = 1; });
        var hist = []; for (var b = 200; b <= 750; b += 50) hist.push([String(b), attempts.filter(function (a) { if (!a.total) return false; var sc = Math.round(a.score / a.total * 800); return sc >= b && sc < b + 50 + (b === 750 ? 51 : 0); }).length]);
        var domAcc = ['Algebra', 'Advanced Math', 'Problem-Solving & Data', 'Geometry & Trig'].map(function (name) {
          var A = attempts.filter(function (a) { return DOM_BY_TITLE[a.subject] === name; }), t = A.reduce(function (x, a) { return x + a.total; }, 0), c = A.reduce(function (x, a) { return x + a.score; }, 0);
          return [name, t ? Math.round(c / t * 100) : 0];
        });
        var hardIds = statRows.filter(function (x) { return Number(x.attempts) >= 3; }).sort(function (a, b2) { return a.correct / a.attempts - b2.correct / b2.attempts; }).slice(0, 5).map(function (x) { return x.question_id; });
        var hardP = hardIds.length ? soft(Ufq.rest('/rest/v1/questions?select=' + QSEL + '&id=in.(' + hardIds.join(',') + ')'), []) : Promise.resolve([]);
        return Promise.all([Ufq.adminQuestions({}, slugById, stats), hardP]).then(function (qr) {
          var questions = qr[0];
          var hardestQs = qr[1].map(function (r) { return adminQ(r, slugById, stats); }).sort(function (a, b2) { return a.cr - b2.cr; });
          var tests = sats.map(function (t) {
            var A = attempts.filter(function (a) { return a.subject === 'SAT' && a.title === t.title; });
            var avg = A.length ? Math.round(A.reduce(function (x, a) { return x + (a.total ? a.score / a.total : 0); }, 0) / A.length * 100) + '%' : '—';
            return { id: t.id, n: t.title, ty: 'Full mock', st: 'Published', at: A.length, avg: avg, q: t.questions, mods: [] };
          });
          var aud = audit.map(function (a) { return { who: a.who_name || 'Admin', a: a.action, k: a.kind || 'Content', t: agoMin(new Date(a.created_at).getTime()) }; });
          return { questions: questions, total: total, users: users, tests: tests, idBySlug: idBySlug, slugById: slugById, stats: stats, aud: aud,
            kpi: { students: profiles.filter(function (p) { return p.role === 'user'; }).length, active: Object.keys(activeWeek).length, tests7: week.length, avgScore: avgScore },
            sig: signSeries, wau: wau, hist: hist, domAcc: domAcc, hardest: hardestQs };
        });
      });
    });
  };
  Ufq.adminLog = function (action, kind) {
    var me = Ufq.user() || {};
    return Ufq.rest('/rest/v1/admin_audit', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ who: me.id, who_name: Ufq.displayName() || me.email || 'Admin', action: action, kind: kind || 'Content' }) }).catch(function () { /* log is best effort */ });
  };
  Ufq.adminSaveQuestion = function (e, idBySlug) {
    var mc = e.t === 'MC';
    var body = { question_text: e.stem, options: mc ? e.ch.filter(function (x) { return String(x).trim() !== ''; }) : [], correct_index: mc ? e.c : -1, question_type: mc ? 'multiple_choice' : 'written', explanation: mc ? (e.ex || '') : (e.ans || ''), image_url: e.img || '', difficulty: e.d === 1 ? 'easy' : e.d === 3 ? 'hard' : 'medium', subject_id: idBySlug[SLUG_BY_DOM[e.dom] || 'algebra'] };
    var isNew = !e.id || /^Q-/.test(String(e.id));
    if (isNew) return Ufq.rest('/rest/v1/questions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }).then(function (rows) { return rows[0]; });
    return Ufq.rest('/rest/v1/questions?id=eq.' + e.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }).then(function (rows) { return rows[0]; });
  };
  Ufq.adminDeleteQuestion = function (id) { return Ufq.rest('/rest/v1/questions?id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); };
  Ufq.setRole = function (profileId, role) { return rpc('set_user_role', { target_user_id: profileId, new_role: role === 'Admin' ? 'admin' : role === 'Owner' ? 'owner' : 'user' }); };
  Ufq.adminSuspend = function (profileId, flag) { return rpc('admin_set_suspended', { target: profileId, flag: flag }); };
  Ufq.adminRemove = function (profileId) { return rpc('admin_remove_user', { target: profileId }); };
  Ufq.adminTransfer = function (profileId) { return rpc('transfer_ownership', { new_owner: profileId }); };
  Ufq.adminInvite = function (email, role) {
    var me = Ufq.user() || {};
    return Ufq.rest('/rest/v1/invites?on_conflict=email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ email: email.toLowerCase(), role: role === 'Admin' ? 'admin' : 'user', invited_by: me.id, accepted: false }) }).then(function () {
      var link = location.origin + '/auth';
      location.href = 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('You are invited to Ufq') + '&body=' + encodeURIComponent('Hi!\n\nI invited you to Ufq as ' + (role === 'Admin' ? 'an Admin' : 'a Student') + '. Sign up with this email address here:\n' + link + '\n');
    });
  };
  Ufq.adminRemoveInvite = function (email) { return Ufq.rest('/rest/v1/invites?email=eq.' + encodeURIComponent(email), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); };


  /* name edits from the Profile page */
  Ufq.saveName = function (name) {
    var u = Ufq.user(); if (!u || !name.trim()) return Promise.resolve();
    return ensureFresh().then(function (s) {
      return Promise.all([
        api('/auth/v1/user', { method: 'PUT', headers: authHeaders(s.access_token), body: JSON.stringify({ data: { display_name: name.trim(), full_name: name.trim() } }) }).then(function (nu) { s.user = nu; save(s); }),
        Ufq.rest('/rest/v1/profiles?id=eq.' + u.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ display_name: name.trim() }) }),
      ]);
    });
  };
  Ufq.saveGoal = function (target, date) { try { localStorage.setItem('ufq_goal', JSON.stringify({ target: target, date: date })); } catch (e) { /* ignore */ } };

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
    e.preventDefault(); e.stopPropagation(); location.assign(window.__ufqMock ? '/sat-test/' + window.__ufqMock : '/practice/sat-tests');
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
