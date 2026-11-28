/* Ufq music — free, full tracks from Audius (audio only, our own player).
   The site is made of separate pages, so while music plays the page that owns the <audio> stays alive
   and the next pages open in a full-window frame on top of it ("hosting"). */
(function () {
  'use strict';
  if (window.__ufqMusic) return;
  window.__ufqMusic = true;

  var CATS = [['today', 'Daily mix'], ['lofi', 'Lo-fi'], ['classical', 'Classical'], ['piano', 'Piano'], ['ambient', 'Ambient'], ['nature', 'Nature']];
  var API = 'https://api.audius.co/v1';
  var STORE = 'ufq_music';
  var hostWin = null;
  try { if (window.parent !== window && window.parent.UfqMusicCore) hostWin = window.parent; } catch (e) { /* framed by another site */ }

  /* ---------------- the player (lives in the top page) ---------------- */
  function makeCore() {
    var audio = new Audio(); audio.preload = 'none';
    var list = [], index = -1, cat = 'today', fails = 0, subs = [], pending = 0, saved = 0;
    function track() { return list[index] || null; }
    function emit() {
      subs = subs.filter(function (fn) { try { fn(); return true; } catch (e) { return false; } });
    }
    function save() {
      try { if (!track()) localStorage.removeItem(STORE); else localStorage.setItem(STORE, JSON.stringify({ list: list, index: index, cat: cat, time: audio.currentTime || pending || 0, volume: audio.volume })); } catch (e) { /* storage blocked */ }
    }
    function load(i, autoplay) {
      if (!list.length) return;
      index = (i + list.length) % list.length; pending = 0;
      audio.src = API + '/tracks/' + encodeURIComponent(list[index].id) + '/stream?app_name=ufq';
      if (autoplay) start();
      if ('mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: list[index].t, artist: list[index].a, album: 'Ufq' });
      save(); emit();
    }
    function start() {
      if (!track()) return;
      var p = audio.play(); if (p && p.catch) p.catch(function () { emit(); });
    }
    var core = {
      audio: audio,
      state: function () {
        return { track: track(), list: list, index: index, cat: cat, playing: !!track() && !audio.paused, time: audio.currentTime || pending || 0, duration: isFinite(audio.duration) && audio.duration ? audio.duration : (track() ? track().d : 0), volume: audio.volume };
      },
      /* copies keep the list alive after the page that passed it is gone */
      play: function (tracks, i, category) { list = JSON.parse(JSON.stringify(tracks)); cat = category; fails = 0; load(i, true); },
      toggle: function () { if (!track()) return; if (audio.paused) { if (!audio.src) load(index, true); else start(); } else audio.pause(); },
      pause: function () { audio.pause(); },
      next: function () { load(index + 1, true); },
      prev: function () { if (audio.currentTime > 4) audio.currentTime = 0; else load(index - 1, true); },
      seek: function (f) { var d = core.state().duration; if (d && audio.src) { try { audio.currentTime = f * d; } catch (e) { /* not seekable yet */ } } },
      setVolume: function (v) { audio.volume = Math.max(0, Math.min(1, v)); save(); emit(); },
      stop: function () { audio.pause(); audio.removeAttribute('src'); list = []; index = -1; save(); emit(); },
      on: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; }
    };
    audio.addEventListener('ended', function () { load(index + 1, true); });
    audio.addEventListener('playing', function () { fails = 0; emit(); });
    ['pause', 'play', 'loadedmetadata'].forEach(function (n) { audio.addEventListener(n, function () { save(); emit(); }); });
    audio.addEventListener('timeupdate', function () { if (Date.now() - saved > 4000) { saved = Date.now(); save(); } emit(); });
    audio.addEventListener('error', function () { if (!audio.getAttribute('src')) return; if (++fails < 4) load(index + 1, true); else emit(); });
    if ('mediaSession' in navigator) {
      [['play', core.toggle], ['pause', core.pause], ['nexttrack', core.next], ['previoustrack', core.prev]].forEach(function (h) { try { navigator.mediaSession.setActionHandler(h[0], h[1]); } catch (e) { /* unsupported */ } });
    }
    /* after a full reload: the same song, paused, from where it was */
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && s.list && s.list[s.index]) {
        list = s.list; index = s.index; cat = s.cat || 'today'; pending = s.time || 0; audio.volume = s.volume >= 0 ? s.volume : 1;
        audio.src = API + '/tracks/' + encodeURIComponent(list[index].id) + '/stream?app_name=ufq';
        audio.addEventListener('loadedmetadata', function once() { audio.removeEventListener('loadedmetadata', once); if (pending) { try { audio.currentTime = pending; } catch (e) { /* ignore */ } pending = 0; } });
      }
    } catch (e) { /* nothing saved */ }
    return core;
  }

  /* ---------------- keep playing across pages ---------------- */
  var STAY_OUT = /^\/(|auth|reset-password|welcome|api\/.*|dc\/(Main|Auth|ResetPassword|Welcome)\.dc\.html)$/;
  function setupHosting(core) {
    var frame = null;
    function inApp(u) { return u.origin === location.origin && !STAY_OUT.test(u.pathname); }
    function sync() {
      try {
        var w = frame.contentWindow, l = w.location;
        if (l.origin !== location.origin) return;
        history.replaceState(history.state, '', l.pathname + l.search + l.hash);
        document.title = w.document.title;
        w.addEventListener('hashchange', sync);
      } catch (e) { /* mid navigation */ }
    }
    function host(u) {
      /* the page underneath is done: stop its timers (polling, countdowns) and drop its content */
      var last = setTimeout(function () {}, 0);
      for (var i = 0; i <= last; i++) { clearTimeout(i); clearInterval(i); }
      frame = document.createElement('iframe');
      frame.setAttribute('allow', 'autoplay; microphone; clipboard-write; fullscreen');
      frame.setAttribute('title', 'Ufq');
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;margin:0;z-index:2147483000;background:#fff';
      frame.addEventListener('load', sync);
      frame.src = u.href;
      history.pushState(null, '', u.href);
      document.documentElement.style.overflow = 'hidden';
      document.body.innerHTML = '';
      document.body.appendChild(frame);
      frame.focus();
    }
    function wanted(u) { return !frame && core.state().playing && inApp(u); }
    if (window.navigation && window.navigation.addEventListener) {
      window.navigation.addEventListener('navigate', function (e) {
        if (!e.cancelable || e.hashChange || e.downloadRequest !== null || e.formData || e.destination.sameDocument || e.navigationType === 'traverse' || e.navigationType === 'reload') return;
        var u = new URL(e.destination.url);
        if (wanted(u)) { e.preventDefault(); host(u); }
      });
    } else {
      window.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.getAttribute('href').charAt(0) === '#') return;
        var u = new URL(a.href, location.href);
        if (wanted(u)) { e.preventDefault(); host(u); }
      });
    }
    window.addEventListener('popstate', function () {
      if (!frame) return;
      try { var l = frame.contentWindow.location; if (l.pathname + l.search !== location.pathname + location.search) l.replace(location.href); } catch (e) { frame.src = location.href; }
    });
  }

  var core;
  if (hostWin) core = hostWin.UfqMusicCore;
  else { core = makeCore(); window.UfqMusicCore = core; setupHosting(core); }

  /* ---------------- catalogue ---------------- */
  var catalogue = null, tableMissing = false;
  function loadCatalogue(force) {
    if (catalogue && !force) return catalogue;
    var base = fetch('/dc/music-tracks.json').then(function (r) { return r.json(); });
    var extra = window.Ufq ? window.Ufq.rest('/rest/v1/music_tracks?select=track_id,category,title,artist,duration,hidden&order=created_at.desc&limit=1000', { fresh: true })
      .then(function (rows) { tableMissing = false; return rows || []; }, function () { tableMissing = true; return []; }) : Promise.resolve([]);
    catalogue = Promise.all([base, extra]).then(function (r) {
      var out = {};
      CATS.slice(1).forEach(function (c) {
        var key = c[0], mine = r[1].filter(function (x) { return x.category === key; });
        var gone = {}; mine.forEach(function (x) { gone[x.track_id] = 1; });
        out[key] = mine.filter(function (x) { return !x.hidden; }).map(function (x) { return { id: x.track_id, t: x.title, a: x.artist, d: x.duration }; })
          .concat((r[0][key] || []).filter(function (t) { return !gone[t.id]; }));
      });
      out.today = daily(out);
      return out;
    }).catch(function (e) { catalogue = null; throw e; });
    return catalogue;
  }
  /* the same 15 songs all day, new ones tomorrow */
  function daily(all) {
    var day = new Date().toLocaleDateString('en-CA'), seed = 0;
    for (var i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) % 2147483647;
    function rnd() { seed = (seed * 48271) % 2147483647; return seed / 2147483647; }
    var out = [];
    CATS.slice(1).forEach(function (c) {
      var pool = all[c[0]].slice();
      for (var n = 0; n < 3 && pool.length; n++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    });
    for (var j = out.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)), t = out[j]; out[j] = out[k]; out[k] = t; }
    return out;
  }

  /* ---------------- small helpers ---------------- */
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function btn(cls, label, aria, fn) { var b = el('button', cls); b.type = 'button'; b.innerHTML = label; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', fn); return b; }
  function clock(s) { s = Math.max(0, Math.floor(s || 0)); var m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); }
  function svg(d, fill) { return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  var ICON = { play: svg('M8 5l11 7-11 7z', true), pause: svg('M8 5v14M16 5v14'), next: svg('M6 6l9 6-9 6zM18 6v12', true), prev: svg('M18 6l-9 6 9 6zM6 6v12', true), close: svg('M6 6l12 12M18 6L6 18'), note: svg('M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z') };

  var CSS = '*{box-sizing:border-box;margin:0;font-family:"Inter Tight","Helvetica Neue",Arial,sans-serif}' +
    'button{border:0;background:none;color:inherit;cursor:pointer;font-weight:600;font-size:13px;line-height:1}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #669BBC;outline-offset:2px}' +
    '.ic{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:none}.ic:hover{background:rgba(102,155,188,.18)}.go{width:46px;height:46px;background:#C1121F;color:#fff}.go:hover{background:#A00F1A}' +
    '.meta{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3;text-align:left}.meta b,.meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta b{font-size:14px}.meta span{font-size:12px;opacity:.65}' +
    '.row{display:flex;align-items:center;gap:6px;min-width:0}input[type=range]{width:100%;accent-color:#C1121F;height:24px}.time{font-size:11px;opacity:.6;width:44px;flex:none;text-align:center}' +
    '.chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:none}.chip{flex:none;padding:0 13px;height:34px;border-radius:999px;background:#EEF2F5;color:#003049}.chip[aria-pressed=true]{background:#003049;color:#fff}' +
    '.list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;min-height:0;scrollbar-width:thin}.item{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:12px;width:100%;color:#003049}.item:hover{background:#F1F4F7}.item.on{background:#FBF3E3}.item .num{width:22px;flex:none;display:grid;place-items:center;font-size:12px;opacity:.55}.item.on .num{opacity:1;color:#C1121F}' +
    '.note{font-size:13px;opacity:.65;padding:10px 4px;line-height:1.45}.credit{font-size:11px;opacity:.55}.credit a{color:inherit}';

  /* ---------------- floating pill + pop-up player (every page) ---------------- */
  function isMock() { return /[?&]mock=/.test(location.search) && /practice/i.test(location.pathname); }
  var tight = /\/(practice\/session|games\/(speed|survival|duel)|community)|(Practice|SpeedRound|Survival|Duel|Community)\.dc/.test(location.pathname);

  var rootHost = el('div'); rootHost.id = 'ufq-music-ui';
  var shadow = rootHost.attachShadow({ mode: 'open' });
  var style = el('style');
  style.textContent = CSS +
    '.pill{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9000;display:flex;align-items:center;gap:4px;padding:6px;width:min(330px,calc(100vw - 32px));background:#003049;color:#fff;border-radius:999px;box-shadow:0 18px 40px -18px rgba(0,30,46,.7)}' +
    '.tab{position:fixed;right:0;top:58%;z-index:9000;width:30px;height:48px;border-radius:14px 0 0 14px;background:#003049;color:#fff;display:grid;place-items:center;opacity:.9}' +
    '.veil{position:fixed;inset:0;z-index:9001}' +
    '.panel{position:fixed;z-index:9002;width:min(360px,calc(100vw - 24px));max-height:min(560px,calc(100dvh - 24px));display:flex;flex-direction:column;gap:10px;padding:14px;background:#fff;color:#003049;border-radius:22px;box-shadow:0 0 0 1px rgba(0,48,73,.12),0 30px 70px -26px rgba(0,30,46,.55);animation:grow .42s cubic-bezier(.16,1,.3,1)}' +
    '@keyframes grow{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.panel{animation:none}}' +
    '.head{display:flex;align-items:center;justify-content:space-between}.head b{font-family:Newsreader,Georgia,serif;font-size:24px;font-weight:500}.panel .list{height:210px;flex:1 1 auto}';
  shadow.appendChild(style);
  var slot = el('div'); shadow.appendChild(slot);

  var panel = null, panelCat = null, pillSig = '';
  function nowRow(big) {
    var wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:none';
    var top = el('div', 'row');
    var meta = el('div', 'meta'), t = el('b'), a = el('span'); meta.appendChild(t); meta.appendChild(a);
    var play = btn('ic go', ICON.play, 'Play', function () { if (core.state().track) core.toggle(); else loadCatalogue().then(function (c) { core.play(c.today, 0, 'today'); }); });
    top.appendChild(meta); top.appendChild(btn('ic', ICON.prev, 'Previous song', core.prev)); top.appendChild(play); top.appendChild(btn('ic', ICON.next, 'Next song', core.next));
    var seekRow = el('div', 'row'), at = el('span', 'time'), seek = el('input'), end = el('span', 'time');
    seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.setAttribute('aria-label', 'Position in song');
    var dragging = false;
    seek.addEventListener('input', function () { dragging = true; });
    seek.addEventListener('change', function () { dragging = false; core.seek(seek.value / 1000); });
    seekRow.appendChild(at); seekRow.appendChild(seek); seekRow.appendChild(end);
    var volRow = el('div', 'row'), vl = el('span', 'time', 'Vol'), vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.setAttribute('aria-label', 'Volume');
    vol.addEventListener('input', function () { core.setVolume(vol.value / 100); });
    volRow.appendChild(vl); volRow.appendChild(vol); volRow.appendChild(el('span', 'time'));
    wrap.appendChild(top); wrap.appendChild(seekRow); if (big) wrap.appendChild(volRow);
    var was = null;
    wrap.update = function () {
      var s = core.state();
      t.textContent = s.track ? s.track.t : 'Nothing playing yet';
      a.textContent = s.track ? s.track.a : 'Press play for today’s mix';
      if (was !== s.playing) { was = s.playing; play.innerHTML = s.playing ? ICON.pause : ICON.play; play.setAttribute('aria-label', s.playing ? 'Pause' : 'Play'); }
      at.textContent = clock(s.time); end.textContent = clock(s.duration);
      if (!dragging) seek.value = s.duration ? Math.round(s.time / s.duration * 1000) : 0;
      vol.value = Math.round(s.volume * 100);
    };
    return wrap;
  }
  function trackItem(tracks, i, category) {
    var t = tracks[i];
    var b = btn('item', '', 'Play ' + t.t, function () { var s = core.state(); if (s.track && s.track.id === t.id) core.toggle(); else core.play(tracks, i, category); });
    var num = el('span', 'num', String(i + 1)), meta = el('span', 'meta'); meta.appendChild(el('b', '', t.t)); meta.appendChild(el('span', '', t.a));
    b.appendChild(num); b.appendChild(meta); b.appendChild(el('span', 'time', clock(t.d)));
    b.dataset.id = t.id; b.dataset.n = i + 1;
    return b;
  }
  function markList(node) {
    var s = core.state(), id = s.track && s.track.id;
    Array.prototype.forEach.call(node.querySelectorAll('.item'), function (b) {
      var on = b.dataset.id === id, state = on ? (s.playing ? 'p' : 's') : '';
      if (b.dataset.s === state) return; b.dataset.s = state;
      b.classList.toggle('on', on);
      b.firstChild.innerHTML = on ? (s.playing ? ICON.pause : ICON.play) : b.dataset.n;
    });
  }

  function closePanel() { if (!panel) return; panel.veil.remove(); panel.box.remove(); panel = null; refresh(); }
  function openPanel(anchor) {
    if (panel) { closePanel(); return; }
    var veil = el('div', 'veil'); veil.addEventListener('click', closePanel);
    var box = el('div', 'panel'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Music');
    var head = el('div', 'head'); head.appendChild(el('b', '', 'Music')); head.appendChild(btn('ic', ICON.close, 'Close', closePanel));
    var now = nowRow(true), chips = el('div', 'chips'), list = el('div', 'list');
    var all = el('p', 'credit'); all.innerHTML = '<a href="/music">All music →</a> · from <a href="https://audius.co" target="_blank" rel="noopener">Audius</a>';
    box.appendChild(head); box.appendChild(chips); box.appendChild(now); box.appendChild(list); box.appendChild(all);
    all.querySelector('a').addEventListener('click', function (e) { e.preventDefault(); location.assign('/music'); });
    slot.appendChild(veil); slot.appendChild(box);
    panel = { veil: veil, box: box, now: now, list: list };
    panelCat = core.state().track ? core.state().cat : 'today';
    function show() {
      Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c.dataset.k === panelCat ? 'true' : 'false'); });
      list.innerHTML = ''; list.appendChild(el('p', 'note', 'Loading…'));
      var want = panelCat;
      loadCatalogue().then(function (c) {
        if (want !== panelCat) return;
        list.innerHTML = '';
        c[want].forEach(function (t, i) { list.appendChild(trackItem(c[want], i, want)); });
        markList(list);
      }).catch(function () { list.innerHTML = ''; list.appendChild(el('p', 'note', 'Could not load the songs. Check your connection.')); });
    }
    CATS.forEach(function (c) { var chip = btn('chip', c[1], null, function () { panelCat = c[0]; show(); }); chip.dataset.k = c[0]; chips.appendChild(chip); });
    show(); now.update();
    /* grow out of the button that opened it */
    var r = anchor && anchor.getBoundingClientRect(), w = box.offsetWidth, h = Math.min(560, window.innerHeight - 24);
    if (r && r.width) {
      var left = Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w));
      var below = r.bottom + 10, up = below + 420 > window.innerHeight;
      box.style.left = left + 'px';
      if (up) { box.style.bottom = '12px'; box.style.transformOrigin = (r.left + r.width / 2 - left) + 'px bottom'; }
      else { box.style.top = below + 'px'; box.style.maxHeight = Math.min(h, window.innerHeight - below - 12) + 'px'; box.style.transformOrigin = (r.left + r.width / 2 - left) + 'px top'; }
    } else { box.style.right = '12px'; box.style.bottom = '12px'; box.style.transformOrigin = 'bottom right'; }
    refresh();
  }

  var pill = null;
  function refresh() {
    var s = core.state();
    var want = s.track && !panel && !isMock() && !document.getElementById('ufq-music') && !document.querySelector('.dmveil') ? (tight ? 'tab' : 'pill') : '';
    if (want !== pillSig) {
      if (pill) pill.remove(); pill = null; pillSig = want;
      if (want === 'tab') pill = btn('tab', ICON.note, 'Open music player', function () { openPanel(null); });
      else if (want === 'pill') {
        pill = el('div', 'pill');
        var play = btn('ic go', ICON.play, 'Play', core.toggle), meta = btn('meta', '<b></b><span></span>', 'Open music player', function () { openPanel(pill); });
        pill.appendChild(play); pill.appendChild(meta); pill.appendChild(btn('ic', ICON.next, 'Next song', core.next)); pill.appendChild(btn('ic', ICON.close, 'Stop music', core.stop));
        pill.update = function () {
          var st = core.state(); if (!st.track) return;
          if (pill.was !== st.playing) { pill.was = st.playing; play.innerHTML = st.playing ? ICON.pause : ICON.play; play.setAttribute('aria-label', st.playing ? 'Pause' : 'Play'); }
          meta.children[0].textContent = st.track.t; meta.children[1].textContent = st.track.a;
        };
      }
      if (pill) slot.appendChild(pill);
    }
    if (pill && pill.update) pill.update();
    if (panel) { panel.now.update(); markList(panel.list); }
    if (page) page.update();
  }

  /* ---------------- the Music page ---------------- */
  var page = null;
  function mountPage(box) {
    var cat = core.state().track ? core.state().cat : 'today', admin = false, data = null;
    var sh = box.attachShadow({ mode: 'open' });
    var css = el('style');
    css.textContent = CSS + '.wrap{display:flex;flex-direction:column;gap:14px;color:#003049}.card{background:#fff;border-radius:22px;box-shadow:inset 0 0 0 1px rgba(0,48,73,.12);padding:16px}' +
      '.now{position:sticky;top:8px;z-index:2;box-shadow:0 0 0 1px rgba(0,48,73,.12),0 18px 40px -30px rgba(0,30,46,.6)}.list{overflow:visible}.line{display:flex;align-items:center;gap:6px}.line .item{flex:1;min-width:0}' +
      '.small{height:30px;padding:0 12px;border-radius:999px;background:#EEF2F5;flex:none}.small.red{background:#C1121F;color:#fff}.small:disabled{opacity:.5}' +
      '.admin{display:flex;flex-direction:column;gap:10px}.admin input[type=search],.admin select{height:42px;border:0;border-radius:12px;box-shadow:inset 0 0 0 1.5px rgba(0,48,73,.22);padding:0 12px;font-size:15px;color:#003049;background:#fff;min-width:0}.admin input{flex:1}';
    sh.appendChild(css);
    var wrap = el('div', 'wrap'), chips = el('div', 'chips'), nowCard = el('div', 'card now'), now = nowRow(true), listCard = el('div', 'card'), list = el('div', 'list'), adminCard = el('div', 'card admin');
    nowCard.appendChild(now); listCard.appendChild(list); adminCard.style.display = 'none';
    var credit = el('p', 'credit'); credit.innerHTML = 'Songs by independent artists, streamed from <a href="https://audius.co" target="_blank" rel="noopener">Audius</a>. Music pauses during mock tests.';
    [chips, nowCard, adminCard, listCard, credit].forEach(function (n) { wrap.appendChild(n); });
    sh.appendChild(wrap);

    function row(c, rows) {
      if (!tableMissing) return window.Ufq.rest('/rest/v1/music_tracks?on_conflict=track_id,category', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(Object.assign({ category: c }, rows)) });
      return Promise.reject(new Error('Run supabase/migrations/20261206_music.sql first.'));
    }
    function reload() { return loadCatalogue(true).then(function (c) { data = c; show(); }); }
    function show() {
      Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c.dataset.k === cat ? 'true' : 'false'); });
      list.innerHTML = '';
      if (!data) { list.appendChild(el('p', 'note', 'Loading…')); return; }
      if (!data[cat].length) list.appendChild(el('p', 'note', 'No songs here yet.'));
      data[cat].forEach(function (t, i) {
        var line = el('div', 'line'); line.appendChild(trackItem(data[cat], i, cat));
        if (admin && cat !== 'today') line.appendChild(btn('small', 'Remove', 'Remove ' + t.t, function () {
          row(cat, { track_id: t.id, title: t.t.slice(0, 120), artist: t.a.slice(0, 80), duration: t.d, hidden: true }).then(reload).catch(function (e) { window.Ufq.toast(e.message); });
        }));
        list.appendChild(line);
      });
      markList(list);
    }
    function buildAdmin() {
      adminCard.style.display = '';
      adminCard.appendChild(el('b', '', 'Add songs (admin)'));
      var form = el('form', 'row'), q = el('input'), pick = el('select'), results = el('div', 'list');
      q.type = 'search'; q.placeholder = 'Search Audius: song or artist'; q.setAttribute('aria-label', 'Search Audius');
      CATS.slice(1).forEach(function (c) { var o = el('option', '', c[1]); o.value = c[0]; pick.appendChild(o); });
      pick.setAttribute('aria-label', 'Add to');
      var go = el('button', 'small red', 'Search'); go.type = 'submit';
      form.appendChild(q); form.appendChild(pick); form.appendChild(go);
      adminCard.appendChild(form); adminCard.appendChild(results);
      if (tableMissing) adminCard.appendChild(el('p', 'note', 'To save changes, run supabase/migrations/20261206_music.sql once in Supabase.'));
      form.addEventListener('submit', function (e) {
        e.preventDefault(); if (!q.value.trim()) return;
        results.innerHTML = ''; results.appendChild(el('p', 'note', 'Searching…'));
        fetch(API + '/tracks/search?app_name=ufq&limit=15&query=' + encodeURIComponent(q.value.trim())).then(function (r) { return r.json(); }).then(function (j) {
          var found = (j.data || []).filter(function (x) { return x.is_streamable && !x.is_delete && !x.is_stream_gated; })
            .map(function (x) { return { id: x.id, t: String(x.title).slice(0, 120), a: String((x.user || {}).name || '').slice(0, 80), d: x.duration || 0 }; });
          results.innerHTML = '';
          if (!found.length) results.appendChild(el('p', 'note', 'Nothing found.'));
          found.forEach(function (t, i) {
            var line = el('div', 'line'); line.appendChild(trackItem(found, i, 'search'));
            var add = btn('small red', 'Add', 'Add ' + t.t, function () {
              add.disabled = true;
              row(pick.value, { track_id: t.id, title: t.t, artist: t.a, duration: t.d, hidden: false }).then(function () { add.textContent = 'Added'; return reload(); }).catch(function (er) { add.disabled = false; window.Ufq.toast(er.message); });
            });
            line.appendChild(add); results.appendChild(line);
          });
          markList(results);
        }).catch(function () { results.innerHTML = ''; results.appendChild(el('p', 'note', 'Search failed. Try again.')); });
      });
      page.results = results;
    }
    CATS.forEach(function (c) { var chip = btn('chip', c[1], null, function () { cat = c[0]; show(); }); chip.dataset.k = c[0]; chips.appendChild(chip); });
    page = { update: function () { now.update(); markList(list); if (page.results) markList(page.results); } };
    show(); now.update();
    loadCatalogue(true).then(function (c) {
      data = c; show();
      var uid = window.Ufq && (window.Ufq.user() || {}).id;
      if (uid) window.Ufq.rest('/rest/v1/profiles?select=role&id=eq.' + uid).then(function (r) {
        var role = r && r[0] && r[0].role;
        if (role === 'admin' || role === 'owner') { admin = true; buildAdmin(); show(); }
      }).catch(function () { /* not an admin view */ });
    }).catch(function () { list.innerHTML = ''; list.appendChild(el('p', 'note', 'Could not load the songs. Check your connection.')); });
  }

  /* ---------------- wire up ---------------- */
  function ready() {
    document.body.appendChild(rootHost);
    var off = core.on(refresh);
    window.addEventListener('pagehide', off);
    window.addEventListener('pageshow', function (e) { if (e.persisted) off = core.on(refresh); });
    if (isMock()) core.pause();
    /* the page content is drawn after this script runs, and may be drawn again: keep the Music page filled */
    function find() {
      var box = document.getElementById('ufq-music');
      if (box && !box.shadowRoot && !box.closest('x-dc')) { mountPage(box); refresh(); }
    }
    if (/\/music$|Music\.dc/.test(location.pathname)) { find(); setInterval(find, 200); }
    refresh();
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('[data-ufq-music-open]');
    if (a) { e.preventDefault(); openPanel(a); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  /* recording a voice message must not pick up the music */
  var md = navigator.mediaDevices;
  if (md && md.getUserMedia) { var gum = md.getUserMedia.bind(md); md.getUserMedia = function (c) { if (c && c.audio) core.pause(); return gum(c); }; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
