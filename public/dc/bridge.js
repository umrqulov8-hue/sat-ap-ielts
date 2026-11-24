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
  var page = m ? m[1] : null;
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
