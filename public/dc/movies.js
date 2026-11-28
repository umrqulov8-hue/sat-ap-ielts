/* Movies: free films from Wikimedia Commons in our own player, watched together.
   Library and search, rooms (public / private with a code), synced playback, SAT checkpoints, room chat, saved words. */
(function () {
  'use strict';
  var API = 'https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&origin=*';
  var U, box, tab = 'films', rooms = [], roomsErr = false, found = null, query = '', filmCache = {};
  var live = null; /* the room I am in */

  /* [Commons file name, title, year, has English subtitles] — English talking films in HD */
  var CURATED = [
    ['A Star Is Born (1937).webm', 'A Star Is Born', 1937, true],
    ['Cyrano de Bergerac (1950).webm', 'Cyrano de Bergerac', 1950, true],
    ['Night of the Living Dead (1968).webm', 'Night of the Living Dead', 1968, true],
    ['The Most Dangerous Game (1932) High Quality.webm', 'The Most Dangerous Game', 1932, true],
    ['LAST MAN ON EARTH with Vincent Price 1964 HD - CC available.webm', 'The Last Man on Earth', 1964, true],
    ['Santa Fe Trail (1940) by Michael Curtiz.webm', 'Santa Fe Trail', 1940, false],
    ['Go For Broke! (1951) by Robert Pirosh.webm', 'Go for Broke!', 1951, false],
    ['Dementia 13 (1963) by Francis Ford Coppola 2.webm', 'Dementia 13', 1963, false],
    ['Under Western Stars (1938).webm', 'Under Western Stars', 1938, false],
    ['His Girl Friday - Full Movie With Cary Grant & Rosalind Russell.webm', 'His Girl Friday', 1940, false]
  ];

  /* ---------------- helpers ---------------- */
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function btn(label, cls, fn) { var b = el('button', cls || 'mbtn', label); b.type = 'button'; if (fn) b.onclick = fn; return b; }
  function rpc(name, args) { return U.rest('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}), keepCache: true }); }
  function clock(s) { s = Math.max(0, Math.floor(s || 0)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); }
  function setup(e) { return /movie_|schema cache|PGRST20/i.test(String(e && e.message)); }
  function fail(e, text) { U.toast(setup(e) ? 'Movies need one setup step: run supabase/migrations/20261208_movies.sql in Supabase.' : /slow/.test(String(e && e.message)) ? 'Too fast. Wait a few seconds.' : text); }
  function pauseMusic() { try { var c = window.UfqMusicCore || window.parent.UfqMusicCore; if (c) c.pause(); } catch (e) { /* no music */ } }
  function dialog(title) {
    var veil = el('div', 'mveil'), d = el('div', 'mdlg'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', title);
    var top = el('div', 'mrow'); top.appendChild(el('h2', 'srf', title)); top.appendChild(btn('✕', 'mbtn mx', function () { veil.remove(); })); d.appendChild(top);
    veil.onclick = function (e) { if (e.target === veil) veil.remove(); };
    veil.appendChild(d); (live ? live.stage : document.body).appendChild(veil);
    return { box: d, close: function () { veil.remove(); } };
  }

  /* ---------------- films (Wikimedia Commons) ---------------- */
  function strip(title) { return title.replace(/^File:/, '').replace(/\.(webm|ogv|ogg|mpg|mpeg|mp4)$/i, ''); }
  function parse(page) {
    var v = (page.videoinfo || [])[0] || {};
    var file = page.title.replace(/^File:/, '');
    var sources = (v.derivatives || []).filter(function (d) { return /^video\/(webm|mp4)/.test(d.type || '') && d.height >= 240 && /^https:\/\/upload\.wikimedia\.org\//.test(d.src); })
      .map(function (d) { return { h: d.height, src: d.src, type: d.type }; });
    if (v.url && /\.(webm|mp4)$/i.test(v.url.split('?')[0]) && !sources.some(function (s) { return s.h >= v.height; })) sources.push({ h: v.height, src: v.url, type: /mp4$/i.test(v.url) ? 'video/mp4' : 'video/webm', original: true });
    var seen = {};
    sources = sources.sort(function (a, b) { return b.h - a.h; }).filter(function (s) { if (seen[s.h]) return false; seen[s.h] = 1; return true; });
    var known = CURATED.filter(function (c) { return c[0] === file; })[0];
    return { file: file, title: known ? known[1] : strip(page.title), year: known ? known[2] : null, subs: known ? known[3] : (page.categories || []).some(function (c) { return /closed captioning in English/i.test(c.title); }),
      duration: Math.round(v.duration || 0), height: v.height || 0, thumb: v.thumburl || '', sources: sources, categories: (page.categories || []).map(function (c) { return c.title; }), curated: !!known };
  }
  var PROPS = '&action=query&prop=videoinfo%7Ccategories&viprop=size%7Curl%7Cderivatives&viurlwidth=480&cllimit=max';
  function details(files) {
    var need = files.filter(function (f) { return !filmCache[f]; });
    var job = need.length ? fetch(API + PROPS + '&titles=' + encodeURIComponent(need.map(function (f) { return 'File:' + f; }).join('|'))).then(function (r) { return r.json(); }).then(function (j) {
      ((j.query || {}).pages || []).forEach(function (p) { if (!p.missing) { var f = parse(p); filmCache[f.file] = f; } });
    }) : Promise.resolve();
    return job.then(function () { return files.map(function (f) { return filmCache[f]; }).filter(Boolean); });
  }
  var OTHER_LANG = /(Japanese|Hindi|French|German|Chinese|Russian|Spanish|Italian|Korean|Tamil|Telugu|Malayalam|Bengali|Persian|Arabic|Turkish|Polish|Portuguese|Dutch|Swedish|Malay)[- ]language|[Ff]ilms of (Japan|India|France|Germany|China|Russia|Spain|Italy|Korea|the Soviet Union)|porn|erotic|nudity|sexual/i;
  function search(q) {
    var url = API + PROPS + '&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=' + encodeURIComponent('filetype:video filesize:>100000 ' + q.replace(/[:"\\]/g, ' '));
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      return ((j.query || {}).pages || []).sort(function (a, b) { return a.index - b.index; }).map(parse).filter(function (f) {
        return f.duration >= 2400 && f.sources.length && !OTHER_LANG.test(f.categories.join(' ') + ' ' + f.title) && !/[^\u0000-\u024f\u2000-\u206f]/.test(f.title);
      }).map(function (f) { filmCache[f.file] = f; return f; });
    });
  }

  /* ---------------- library page ---------------- */
  function filmCard(f) {
    var card = btn('', 'mcard', function () { startDialog(f); });
    var pic = el('span', 'mpic'); if (f.thumb) { var img = el('img'); img.src = f.thumb; img.alt = ''; img.loading = 'lazy'; pic.appendChild(img); }
    pic.appendChild(el('i', 'mq', f.height >= 1000 ? '1080p' : f.height >= 700 ? '720p' : f.height + 'p'));
    card.appendChild(pic);
    card.appendChild(el('b', '', f.title));
    card.appendChild(el('span', '', [f.year, Math.round(f.duration / 60) + ' min', f.subs ? 'English subtitles' : 'no subtitles'].filter(Boolean).join(' · ')));
    return card;
  }
  function startDialog(f) {
    var d = dialog(f.title), vis = 'public';
    d.box.appendChild(el('p', 'mnote', Math.round(f.duration / 60) + ' minutes · up to ' + f.height + 'p · ' + (f.subs ? 'English subtitles' : 'no subtitles') + '. The film stops now and then for a few SAT questions.'));
    rooms.filter(function (r) { return r.film === f.file; }).forEach(function (r) {
      d.box.appendChild(btn('Join ' + r.host + '’s room · ' + r.count + ' watching', 'mbtn dark', function () { d.close(); join(r.id); }));
    });
    var pick = el('div', 'mchips'), help = el('p', 'mnote');
    [['public', 'Public'], ['private', 'Private']].forEach(function (o) {
      var c = btn(o[1], 'mchip', function () { vis = o[0]; paint(); }); c.dataset.v = o[0]; pick.appendChild(c);
    });
    function paint() {
      Array.prototype.forEach.call(pick.children, function (c) { c.setAttribute('aria-pressed', c.dataset.v === vis ? 'true' : 'false'); });
      help.textContent = vis === 'public' ? 'Anyone can see the room and join.' : 'Friends can join; everyone else needs your room code.';
    }
    paint(); d.box.appendChild(pick); d.box.appendChild(help);
    var go = btn('Create room', 'mbtn red', function () {
      go.disabled = true;
      rpc('movie_create', { p_film: f.file, p_title: f.title, p_duration: f.duration, p_visibility: vis })
        .then(function (id) { d.close(); enter(id); }).catch(function (e) { go.disabled = false; fail(e, 'Could not create the room.'); });
    });
    d.box.appendChild(go);
  }
  function askCode(room) {
    var d = dialog('Private room'), input = el('input', 'minp'); input.maxLength = 6; input.placeholder = 'Room code'; input.setAttribute('aria-label', 'Room code');
    d.box.appendChild(el('p', 'mnote', 'Ask the person who made the room for the 6-character code.'));
    d.box.appendChild(input);
    var go = function () { if (input.value.trim().length < 6) return; join(room ? room.id : null, input.value.trim(), d); };
    input.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    d.box.appendChild(btn('Join', 'mbtn red', go)); input.focus();
  }
  function join(id, code, d) {
    rpc('movie_join', { p_room: id || null, p_code: code || null }).then(function (r) {
      if (r.error === 'private') { askCode({ id: id }); return; }
      if (r.error) { U.toast(r.error === 'code' ? 'That code does not match.' : r.error === 'full' ? 'That room is full (10 people).' : 'That room has closed.'); return; }
      if (d) d.close();
      enter(r.roomId);
    }).catch(function (e) { fail(e, 'Could not join.'); });
  }

  var grid, chips;
  function renderPage() {
    Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c.dataset.k === tab ? 'true' : 'false'); });
    chips.querySelector('[data-k=rooms]').textContent = 'Rooms' + (rooms.length ? ' · ' + rooms.length : '');
    grid.textContent = ''; grid.className = tab === 'words' ? 'mlist' : 'mgrid';
    if (tab === 'films') {
      if (query && found === null) { grid.appendChild(el('p', 'mnote', 'Searching…')); return; }
      var films = query ? found : CURATED.map(function (c) { return filmCache[c[0]]; }).filter(Boolean);
      films.forEach(function (f) { grid.appendChild(filmCard(f)); });
      if (!films.length) grid.appendChild(el('p', 'mnote', query ? 'No free full-length film called “' + query + '” in this library. New cinema films are not in it. Try another title, actor or genre.' : 'Loading films…'));
    } else if (tab === 'rooms') {
      grid.appendChild(btn('Enter a room code', 'mcard mcode', function () { askCode(null); }));
      rooms.forEach(function (r) {
        var hidden = r.visibility === 'private' && !r.open;
        var card = btn('', 'mcard' + (hidden ? ' mblur' : ''), function () { if (hidden) askCode(r); else join(r.id); });
        var pic = el('span', 'mpic'), f = filmCache[r.film];
        if (f && f.thumb) { var img = el('img'); img.src = f.thumb; img.alt = ''; pic.appendChild(img); }
        pic.appendChild(el('i', 'mq', r.visibility === 'private' ? '🔒 Private' : 'Public'));
        card.appendChild(pic);
        card.appendChild(el('b', '', hidden ? 'Private room' : r.title));
        card.appendChild(el('span', '', r.host + ' · ' + r.count + ' in the room · ' + (r.status === 'lobby' ? 'not started' : 'at ' + clock(r.pos))));
        card.appendChild(el('em', '', hidden ? 'Enter code' : 'Join'));
        grid.appendChild(card);
      });
      if (roomsErr) grid.appendChild(el('p', 'mnote', 'Rooms need one setup step: run supabase/migrations/20261208_movies.sql in Supabase.'));
      else if (!rooms.length) grid.appendChild(el('p', 'mnote', 'No rooms are open. Pick a film and create one.'));
    } else {
      grid.appendChild(el('p', 'mnote', 'Loading…'));
      words().then(function (list) {
        if (tab !== 'words') return;
        grid.textContent = '';
        if (!list.length) grid.appendChild(el('p', 'mnote', 'No saved words yet. Click a word in the subtitles while you watch.'));
        list.forEach(function (w) {
          var row = el('div', 'mword'); var t = el('span'); t.appendChild(el('b', '', w.word)); t.appendChild(el('small', '', w.film)); row.appendChild(t);
          var a = el('a', '', 'Meaning'); a.href = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(w.word.toLowerCase()); a.target = '_blank'; a.rel = 'noopener'; row.appendChild(a);
          row.appendChild(btn('Remove', 'mbtn', function () { removeWord(w.word).then(renderPage); }));
          grid.appendChild(row);
        });
      });
    }
  }
  function loadRooms() {
    return rpc('movie_list').then(function (list) {
      roomsErr = false;
      var changed = JSON.stringify(list.map(function (r) { return [r.id, r.count, r.status]; })) !== JSON.stringify(rooms.map(function (r) { return [r.id, r.count, r.status]; }));
      rooms = list;
      return details(list.map(function (r) { return r.film; }).filter(Boolean)).then(function () { if (changed && tab === 'rooms') renderPage(); else if (changed) chips.querySelector('[data-k=rooms]').textContent = 'Rooms' + (rooms.length ? ' · ' + rooms.length : ''); });
    }).catch(function (e) { if (setup(e) && !roomsErr) { roomsErr = true; if (tab === 'rooms') renderPage(); } });
  }

  /* ---------------- saved words ---------------- */
  var LOCAL = 'ufq_movie_words';
  function localWords() { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch (e) { return []; } }
  function words() { return U.rest('/rest/v1/movie_words?select=word,film&order=created_at.desc&limit=500', { keepCache: true }).catch(localWords); }
  function saveWord(word, film) {
    word = String(word).replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').slice(0, 80);
    if (!word) return;
    word = word.toLowerCase();
    U.rest('/rest/v1/movie_words?on_conflict=user_id,word', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ word: word, film: String(film || '').slice(0, 200) }), keepCache: true })
      .catch(function () { try { var l = localWords().filter(function (w) { return w.word !== word; }); l.unshift({ word: word, film: film }); localStorage.setItem(LOCAL, JSON.stringify(l.slice(0, 500))); } catch (e) { /* storage blocked */ } });
    U.toast('Saved “' + word + '” to My words.', 'ok');
  }
  function removeWord(word) {
    try { localStorage.setItem(LOCAL, JSON.stringify(localWords().filter(function (w) { return w.word !== word; }))); } catch (e) { /* storage blocked */ }
    return U.rest('/rest/v1/movie_words?word=eq.' + encodeURIComponent(word), { method: 'DELETE', keepCache: true }).catch(function () { /* local only */ });
  }

  /* ---------------- subtitles ---------------- */
  function seconds(t) { var p = t.trim().replace(',', '.').split(':').map(Number); return p.reduce(function (a, x) { return a * 60 + x; }, 0); }
  function parseVtt(text) {
    return String(text).replace(/\r/g, '').split('\n\n').map(function (block) {
      var lines = block.split('\n'), i = lines.findIndex(function (l) { return l.indexOf('-->') > -1; });
      if (i < 0) return null;
      var t = lines[i].split('-->');
      return { a: seconds(t[0]), b: seconds(t[1].trim().split(' ')[0]), text: lines.slice(i + 1).join(' ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim() };
    }).filter(function (c) { return c && c.text; });
  }
  function subtitles(file) {
    return fetch('https://commons.wikimedia.org/w/api.php?action=timedtext&lang=en&trackformat=vtt&origin=*&title=' + encodeURIComponent('File:' + file))
      .then(function (r) { return r.ok ? r.text() : ''; }).then(parseVtt).catch(function () { return []; });
  }

  /* ---------------- the room ---------------- */
  function checkpoints(duration) {
    var n = Math.min(6, Math.max(1, Math.floor(duration / 900))), out = [];
    for (var i = 1; i <= n; i++) out.push(Math.round(duration * i / (n + 1)));
    return out;
  }
  function enter(id) {
    if (live) close(false);
    pauseMusic();
    var stage = el('div', 'mstage'); document.body.appendChild(stage); document.documentElement.style.overflow = 'hidden';
    live = { id: id, stage: stage, room: null, since: 0, msgs: [], film: null, cues: [], cc: true, chat: false, unread: 0, timer: null, busy: false, view: '', quizKey: '', watchNick: '', qs: {}, at: 0 };
    try { history.replaceState(history.state, '', '/movies?room=' + id); } catch (e) { /* ignore */ }
    stage.appendChild(el('p', 'mload', 'Opening the room…'));
    tick();
  }
  function close(tell) {
    if (!live) return;
    var l = live; live = null;
    clearTimeout(l.timer); stopVoice(false);
    if (l.video) { l.video.pause(); l.video.removeAttribute('src'); l.video.load(); }
    l.stage.remove(); document.documentElement.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(function () { /* already out */ });
    try { history.replaceState(history.state, '', '/movies'); } catch (e) { /* ignore */ }
    if (tell) rpc('movie_leave', { p_room: l.id }).then(function (files) {
      if (files && files.length) U.rest('/storage/v1/object/movie', { method: 'DELETE', body: JSON.stringify({ prefixes: files }), keepCache: true }).catch(function () { /* gone */ });
    }).catch(function () { /* the room cleans itself up */ }).then(loadRooms);
  }
  function tick() {
    var l = live; if (!l) return;
    clearTimeout(l.timer);
    rpc('movie_get', { p_room: l.id, p_since: l.since }).then(function (r) {
      if (live !== l) return;
      if (r.error) { U.toast('This room has closed.'); close(false); loadRooms(); return; }
      var first = !l.room;
      l.room = r.room; l.at = performance.now();
      var ready = first ? details([r.room.film]).then(function (d) {
        l.film = d[0];
        if (!l.film) throw new Error('film');
        if (l.film.subs) subtitles(l.film.file).then(function (c) { l.cues = c; });
      }) : Promise.resolve();
      return ready.then(function () {
        if (live !== l) return;
        if (r.messages.length) {
          l.since = r.messages[r.messages.length - 1].id;
          l.msgs = l.msgs.concat(r.messages).slice(-200);
          if (!l.chat) l.unread += r.messages.filter(function (m) { return !m.mine; }).length;
        }
        draw(r.messages);
      });
    }).catch(function (e) {
      if (live !== l) return;
      if (setup(e)) { fail(e); close(false); return; }
      if (String(e.message) === 'film') { U.toast('This film could not be loaded.'); close(true); }
    }).then(function () {
      if (live === l) l.timer = setTimeout(tick, l.room && l.room.status === 'quiz' ? 1500 : 2000);
    });
  }
  function draw(fresh) {
    var l = live, r = l.room;
    var view = r.status === 'lobby' ? 'lobby' : 'watch';
    if (view !== l.view) {
      var was = l.view; l.view = view;
      if (view === 'lobby') drawLobby(); else buildPlayer(was === 'lobby');
    }
    if (view === 'lobby') updateLobby(); else { sync(); updateWatch(); drawQuiz(); }
    if (fresh.length && l.chatBox) renderChat();
  }

  /* ---- waiting room ---- */
  function drawLobby() {
    var l = live; l.stage.textContent = '';
    var wrap = el('div', 'mlobby'); l.lobby = wrap; l.stage.appendChild(wrap);
    wrap.appendChild(el('span', 'mcap', l.room.visibility === 'private' ? 'Private room' : 'Public room'));
    wrap.appendChild(el('h2', 'srf', l.room.title));
    var code = el('p', 'mcodeline'); code.appendChild(document.createTextNode('Room code ')); code.appendChild(el('b', '', l.room.code));
    code.appendChild(btn('Copy', 'mbtn', function () { try { navigator.clipboard.writeText(l.room.code).then(function () { U.toast('Code copied.', 'ok'); }); } catch (e) { U.toast(l.room.code, 'ok'); } }));
    wrap.appendChild(code);
    l.people = el('div', 'mpeople'); wrap.appendChild(l.people);
    var row = el('div', 'mrow mwrap');
    row.appendChild(btn('Invite friends', 'mbtn', inviteDialog));
    l.startBtn = btn('Start the film', 'mbtn red', function () {
      rpc('movie_control', { p_room: l.id, p_playing: true, p_pos: 0 }).then(tick).catch(function (e) { fail(e, 'Could not start.'); });
    });
    row.appendChild(l.startBtn);
    row.appendChild(btn('Leave', 'mbtn', function () { close(true); }));
    wrap.appendChild(row);
    l.hint = el('p', 'mnote'); wrap.appendChild(l.hint);
  }
  function updateLobby() {
    var l = live, r = l.room;
    l.people.textContent = '';
    r.members.forEach(function (m) { l.people.appendChild(el('span', 'mperson' + (m.online ? '' : ' off'), m.nick + (m.me ? ' (you)' : '') + (m.host ? ' · host' : ''))); });
    l.startBtn.hidden = !r.isHost;
    l.hint.textContent = r.isHost ? 'Start when everyone is in. Up to 10 people.' : 'Waiting for ' + r.host + ' to start the film.';
  }
  function inviteDialog() {
    var l = live, d = dialog('Invite friends'), list = el('div', 'mlist'); d.box.appendChild(list);
    var data = U.friends.last();
    var friends = data ? data.friends : [];
    if (!friends.length) list.appendChild(el('p', 'mnote', 'No friends yet. Add them in Games → Friends, or share the room code.'));
    friends.forEach(function (f) {
      var row = el('div', 'mword'); var t = el('span'); t.appendChild(el('b', '', f.nick)); t.appendChild(el('small', '', f.online ? 'Online' : 'Offline')); row.appendChild(t);
      var b = btn('Invite', 'mbtn red', function () {
        b.disabled = true;
        rpc('movie_invite', { p_room: l.id, p_username: f.nick }).then(function (r) { b.textContent = r.error ? 'Failed' : 'Invited'; }).catch(function (e) { b.disabled = false; fail(e, 'Could not invite.'); });
      });
      row.appendChild(b); list.appendChild(row);
    });
  }

  /* ---- the screen ---- */
  function pickSource() {
    var s = live.film.sources, saved = 0;
    try { saved = Number(localStorage.getItem('ufq_movie_q')) || 0; } catch (e) { /* ignore */ }
    var c = navigator.connection || {};
    /* full quality unless the connection says it is slow or the person asked to save data */
    var want = saved || (c.saveData || /2g/.test(c.effectiveType || '') ? 240 : c.effectiveType === '3g' ? 480 : 1080);
    var video = document.createElement('video');
    var playable = s.filter(function (x) { return video.canPlayType(x.type.split(';')[0]) !== ''; });
    if (!playable.length) playable = s;
    live.sources = playable;
    return playable.filter(function (x) { return x.h <= want; })[0] || playable[playable.length - 1];
  }
  function buildPlayer(fromLobby) {
    var l = live, r = l.room; l.stage.textContent = '';
    var video = el('video', 'mvideo'); video.playsInline = true; video.preload = 'auto'; l.video = video;
    var src = pickSource(); l.height = src.h; video.src = src.src;
    var sub = el('div', 'msub'); l.sub = sub;
    var big = btn('▶ Tap to watch', 'mbtn red mbig', function () { big.hidden = true; video.play().catch(function () { big.hidden = false; }); sync(true); }); big.hidden = true; l.big = big;
    var err = el('div', 'merr'); err.hidden = true; l.err = err;
    video.onerror = function () { if (live !== l) return; err.hidden = false; err.textContent = 'This device cannot play the film. Try another quality, or use Chrome.'; };
    video.onloadedmetadata = function () { if (live !== l) return; err.hidden = true; sync(true); };

    var top = el('div', 'mtop');
    top.appendChild(btn('✕ Leave', 'mbtn glass', function () { if (window.confirm('Leave the room?')) close(true); }));
    var head = el('div', 'mhead'); head.appendChild(el('b', '', r.title)); l.who = el('span'); head.appendChild(l.who); top.appendChild(head);
    top.appendChild(btn('Invite', 'mbtn glass', inviteDialog));
    l.chatBtn = btn('Chat', 'mbtn glass', function () { toggleChat(); }); top.appendChild(l.chatBtn);

    var bar = el('div', 'mbar');
    var seek = el('input', 'mseek'); seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0; seek.setAttribute('aria-label', 'Position in the film'); l.seek = seek;
    var dragging = false; seek.oninput = function () { dragging = true; }; seek.onchange = function () { dragging = false; if (l.room.isHost) { video.currentTime = seek.value / 1000 * (l.film.duration || video.duration); push(!video.paused); } };
    l.dragging = function () { return dragging; };
    var row = el('div', 'mrow mwrap');
    l.playBtn = btn('❚❚', 'mbtn glass', function () {
      if (!l.room.isHost) return;
      var start = !l.room.playing; l.room.playing = start; l.at = performance.now(); l.room.pos = video.currentTime;
      if (start) video.play().catch(function () { big.hidden = false; }); else video.pause();
      push(start);
    });
    row.appendChild(l.playBtn);
    l.time = el('span', 'mtime'); row.appendChild(l.time);
    var vol = el('input', 'mvol'); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = 100; vol.setAttribute('aria-label', 'Volume'); vol.oninput = function () { video.volume = vol.value / 100; video.muted = false; }; row.appendChild(vol);
    var quality = el('select', 'msel'); quality.setAttribute('aria-label', 'Quality');
    l.sources.forEach(function (s) { var o = el('option', '', s.h + 'p'); o.value = s.h; quality.appendChild(o); });
    quality.value = src.h;
    quality.onchange = function () {
      var s = l.sources.filter(function (x) { return x.h === Number(quality.value); })[0]; if (!s) return;
      var at = video.currentTime, playing = !video.paused;
      try { localStorage.setItem('ufq_movie_q', String(s.h)); } catch (e) { /* ignore */ }
      video.src = s.src; video.onloadedmetadata = function () { err.hidden = true; video.currentTime = at; if (playing) video.play().catch(function () { big.hidden = false; }); };
    };
    row.appendChild(quality);
    if (l.film.subs) { var cc = btn('CC', 'mbtn glass', function () { l.cc = !l.cc; cc.setAttribute('aria-pressed', l.cc); }); cc.setAttribute('aria-pressed', 'true'); row.appendChild(cc); }
    row.appendChild(btn('My words', 'mbtn glass', wordDialog));
    var fs = btn('⛶', 'mbtn glass', function () { if (document.fullscreenElement) document.exitFullscreen(); else if (l.stage.requestFullscreen) l.stage.requestFullscreen().catch(function () { /* not allowed */ }); });
    fs.setAttribute('aria-label', 'Full screen'); if (l.stage.requestFullscreen) row.appendChild(fs);
    bar.appendChild(seek); bar.appendChild(row);

    l.chatBox = el('aside', 'mchat'); l.chatBox.hidden = !l.chat; buildChat();
    l.quiz = el('div', 'mquiz'); l.quiz.hidden = true;
    [video, sub, big, err, top, bar, l.chatBox, l.quiz].forEach(function (n) { l.stage.appendChild(n); });
    video.ontimeupdate = function () {
      if (live !== l) return; /* the room was closed */
      var t = video.currentTime;
      if (!dragging) seek.value = Math.round(t / (l.film.duration || video.duration || 1) * 1000);
      l.time.textContent = clock(t) + ' / ' + clock(l.film.duration);
      drawSub(t);
      checkQuiz(t);
    };
    if (fromLobby) { var wipe = el('div', 'mwipe'); wipe.appendChild(el('h2', 'srf', r.title)); l.stage.appendChild(wipe); setTimeout(function () { wipe.remove(); }, 1900); }
  }
  function push(playing) {
    var l = live; if (!l || !l.room.isHost) return;
    l.pushed = performance.now();
    rpc('movie_control', { p_room: l.id, p_playing: playing, p_pos: l.video.currentTime }).catch(function () { /* next heartbeat */ });
  }
  /* where the film should be right now */
  function target() { var l = live; return l.room.pos + (l.room.playing ? (performance.now() - l.at) / 1000 : 0); }
  function sync(force) {
    var l = live, v = l.video; if (!v) return;
    var r = l.room;
    if (r.status === 'quiz') { v.pause(); if (Math.abs(v.currentTime - r.pos) > 3) v.currentTime = r.pos; return; }
    var want = target();
    if (r.isHost && !force && l.synced) {
      /* the host's screen leads; it only reports where it is */
      if (r.playing && v.paused && !v.ended && l.big.hidden) v.play().catch(function () { l.big.hidden = false; });
      if (!l.pushed || performance.now() - l.pushed > 8000) push(r.playing);
      return;
    }
    if (v.readyState < 1) return;
    l.synced = true;
    if (Math.abs(v.currentTime - want) > (r.playing ? 2 : 0.5)) v.currentTime = Math.min(want, (l.film.duration || v.duration || want));
    if (r.playing && v.paused) v.play().then(function () { l.big.hidden = true; }).catch(function () { l.big.hidden = false; });
    if (!r.playing && !v.paused) v.pause();
  }
  function updateWatch() {
    var l = live, r = l.room;
    l.who.textContent = r.members.filter(function (m) { return m.online; }).length + ' watching · ' + (r.isHost ? 'you control the film' : r.host + ' controls the film');
    l.playBtn.textContent = r.playing ? '❚❚' : '▶'; l.playBtn.disabled = !r.isHost; l.playBtn.setAttribute('aria-label', r.playing ? 'Pause for everyone' : 'Play for everyone');
    l.seek.disabled = !r.isHost;
    l.chatBtn.textContent = 'Chat' + (l.unread ? ' · ' + l.unread : '');
  }
  function drawSub(t) {
    var l = live, cue = l.cc ? l.cues.filter(function (c) { return t >= c.a && t <= c.b; })[0] : null;
    var text = cue ? cue.text : '';
    if (l.subText === text && l.sub.dataset.on === '1') return;
    l.subText = text; l.sub.dataset.on = '1'; l.sub.textContent = '';
    text.split(/\s+/).filter(Boolean).forEach(function (w) { l.sub.appendChild(btn(w, 'mw', function () { saveWord(w, l.room.title); })); });
  }
  function wordDialog() {
    var l = live, d = dialog('My words'), input = el('input', 'minp'); input.placeholder = 'Write a new word'; input.maxLength = 80; input.setAttribute('aria-label', 'New word');
    d.box.appendChild(input);
    var list = el('div', 'mlist');
    var load = function () { words().then(function (w) { list.textContent = ''; w.slice(0, 40).forEach(function (x) { var row = el('div', 'mword'); var t = el('span'); t.appendChild(el('b', '', x.word)); t.appendChild(el('small', '', x.film)); row.appendChild(t); list.appendChild(row); }); }); };
    var add = function () { if (!input.value.trim()) return; saveWord(input.value, l.room.title); input.value = ''; setTimeout(load, 500); };
    input.onkeydown = function (e) { if (e.key === 'Enter') add(); };
    d.box.appendChild(btn('Save word', 'mbtn red', add)); d.box.appendChild(list);
    if (l.film.subs) d.box.appendChild(el('p', 'mnote', 'Tip: tap any word in the subtitles to save it.'));
    load();
  }

  /* ---- chat: text and voice ---- */
  var rec = null, signed = {};
  function toggleChat() { var l = live; l.chat = !l.chat; l.chatBox.hidden = !l.chat; l.unread = 0; updateWatch(); l.stage.classList.toggle('chatting', l.chat); if (l.chat) renderChat(); }
  function buildChat() {
    var l = live, c = l.chatBox;
    var top = el('div', 'mrow'); top.appendChild(el('b', '', 'Room chat')); top.appendChild(btn('✕', 'mbtn mx', toggleChat));
    l.feed = el('div', 'mfeed');
    var row = el('div', 'mrow'); l.compose = row;
    c.appendChild(top); c.appendChild(l.feed); c.appendChild(row);
    composer();
    l.stage.classList.toggle('chatting', l.chat);
  }
  function composer() {
    var l = live; if (!l || !l.compose) return;
    var row = l.compose; row.textContent = '';
    if (rec) {
      row.appendChild(el('span', 'mrec', 'Recording…'));
      row.appendChild(btn('Cancel', 'mbtn', function () { stopVoice(false); }));
      row.appendChild(btn('Send voice', 'mbtn red', function () { stopVoice(true); }));
      return;
    }
    var input = el('input', 'minp'); input.maxLength = 500; input.placeholder = 'Message'; input.setAttribute('aria-label', 'Message');
    var send = function () {
      var text = input.value.trim(); if (!text) return; input.value = '';
      rpc('movie_send', { p_room: l.id, p_kind: 'text', p_body: text }).then(tick).catch(function (e) { input.value = text; fail(e, 'Could not send.'); });
    };
    input.onkeydown = function (e) { if (e.key === 'Enter') send(); };
    var mic = btn('🎤', 'mbtn', record); mic.setAttribute('aria-label', 'Record a voice message');
    row.appendChild(input); row.appendChild(mic); row.appendChild(btn('Send', 'mbtn red', send));
  }
  function record() {
    if (rec) return;
    var l = live;
    if (!navigator.mediaDevices || !window.MediaRecorder) { U.toast('This browser cannot record. Open the site in Chrome or Safari.'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
      var r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
      var chunks = [], t0 = Date.now();
      rec = { r: r, keep: false };
      r.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      r.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        clearTimeout(rec.limit); var keep = rec.keep; rec = null; composer();
        if (!keep || !chunks.length || live !== l) return;
        var mime = (r.mimeType || 'audio/webm').split(';')[0], ext = mime === 'audio/mp4' ? 'm4a' : mime === 'audio/ogg' ? 'ogg' : 'webm';
        var path = l.id + '/' + U.newId() + '.' + ext;
        U.rest('/storage/v1/object/movie/' + path, { method: 'POST', headers: { 'Content-Type': mime }, body: new Blob(chunks, { type: mime }), keepCache: true })
          .then(function () { return rpc('movie_send', { p_room: l.id, p_kind: 'voice', p_path: path, p_duration: Math.max(1, Math.round((Date.now() - t0) / 1000)) }); })
          .then(tick).catch(function (e) { fail(e, 'Could not send the voice message.'); });
      };
      r.start(500); composer();
      rec.limit = setTimeout(function () { stopVoice(true); }, 60000);
    }).catch(function () { U.toast('The microphone is blocked. Allow it for this site in your browser settings, then try again.'); });
  }
  function stopVoice(keep) { if (rec) { rec.keep = keep; rec.r.stop(); } }
  function playVoice(path) {
    var l = live;
    var get = signed[path] ? Promise.resolve(signed[path]) : U.rest('/storage/v1/object/sign/movie/' + path, { method: 'POST', body: JSON.stringify({ expiresIn: 3600 }), keepCache: true })
      .then(function (r) { signed[path] = window.UFQ_CONFIG.url + '/storage/v1' + (r.signedURL || r.signedUrl); return signed[path]; });
    get.then(function (url) {
      var a = new Audio(url), was = l.video ? l.video.volume : 1;
      if (l.video) l.video.volume = was * 0.25;
      a.onended = a.onerror = function () { if (l.video) l.video.volume = was; };
      return a.play();
    }).catch(function () { U.toast('Could not play the voice message.'); });
  }
  function renderChat() {
    var l = live; if (!l || !l.feed || !l.chat) return;
    l.unread = 0;
    l.feed.textContent = '';
    l.msgs.forEach(function (m) {
      var b = el('div', 'mmsg' + (m.mine ? ' mine' : ''));
      if (!m.mine) b.appendChild(el('b', '', m.nick));
      if (m.kind === 'voice') b.appendChild(btn('▶ Voice · ' + clock(m.duration), 'mbtn', function () { playVoice(m.path); }));
      else b.appendChild(el('span', '', m.body));
      l.feed.appendChild(b);
    });
    if (!l.msgs.length) l.feed.appendChild(el('p', 'mnote', 'Say hello to the room.'));
    l.feed.scrollTop = l.feed.scrollHeight;
  }

  /* ---- SAT checkpoints ---- */
  function checkQuiz(t) {
    var l = live, r = l.room;
    if (!r.isHost || r.status !== 'playing' || !r.playing || l.starting) return;
    var points = checkpoints(l.film.duration), round = r.quizRound;
    if (round >= points.length || t < points[round]) return;
    l.starting = true;
    var data = window.UfqGameData;
    Promise.all([data.getQuestions({ level: 'hard', count: 1 }), data.getQuestions({ level: 'medium', count: 2 }), data.getQuestions({ level: 'easy', count: 3 })]).then(function (q) {
      var ids = function (list) { return list.map(function (x) { return x.id; }); };
      return rpc('movie_quiz_start', { p_room: l.id, p_round: round + 1, p_quiz: { hard: ids(q[0]), medium: ids(q[1]), easy: ids(q[2]) }, p_pos: l.video.currentTime });
    }).then(tick).catch(function () { /* try again at the next check */ }).then(function () { setTimeout(function () { l.starting = false; }, 5000); });
  }
  /* one hard question; miss it and you get two medium; miss either of those and you get three easy */
  function step(quiz, answers) {
    var n = answers.length;
    if (!n) return { stage: 'Hard question', id: quiz.hard[0] };
    if (answers[0].ok) return null;
    if (n < 3) return { stage: 'Medium · ' + n + ' of 2', id: quiz.medium[n - 1] };
    if (answers[1].ok && answers[2].ok) return null;
    if (n < 6) return { stage: 'Easy · ' + (n - 2) + ' of 3', id: quiz.easy[n - 3] };
    return null;
  }
  function questions(quiz) {
    var l = live, ids = [].concat(quiz.hard, quiz.medium, quiz.easy), need = ids.filter(function (i) { return !l.qs[i]; });
    if (!need.length) return Promise.resolve(l.qs);
    return window.UfqGameData.byIds(need).then(function (list) { list.forEach(function (q) { l.qs[q.id] = q; }); return l.qs; });
  }
  function math(text, cls) { var m = document.createElement('ufq-math'); m.className = cls || ''; m.setAttribute('text', String(text)); return m; }
  function drawQuiz() {
    var l = live, r = l.room;
    if (r.status !== 'quiz' || !r.quiz) { if (!l.quiz.hidden) { l.quiz.hidden = true; l.quiz.textContent = ''; l.quizKey = ''; l.mine = null; l.watchNick = ''; } return; }
    var me = r.members.filter(function (m) { return m.me; })[0] || { answers: [], done: true, round: 0 };
    if (!l.mine || l.mine.round !== r.quizRound) l.mine = { round: r.quizRound, answers: me.round === r.quizRound ? (me.answers || []) : [], picked: null };
    var inRound = me.round === r.quizRound;
    var now = inRound && !me.done ? step(r.quiz, l.mine.answers) : null;
    var others = r.members.filter(function (m) { return !m.me && m.round === r.quizRound; });
    var watched = others.filter(function (m) { return m.nick === l.watchNick; })[0] || others.filter(function (m) { return !m.done; })[0] || others[0];
    var key = now ? 'q' + l.mine.answers.length + (l.mine.picked ? 'p' : '') : 'w' + (watched ? watched.nick + watched.answers.length : '') + others.map(function (m) { return m.nick + (m.done ? 1 : 0); }).join(',');
    l.quiz.hidden = false;
    if (key === l.quizKey) return;
    questions(r.quiz).then(function (qs) {
      if (live !== l || l.room.status !== 'quiz') return;
      l.quizKey = key; l.quiz.textContent = '';
      var card = el('div', 'mcardq'); l.quiz.appendChild(card);
      if (now) {
        var q = qs[now.id];
        card.appendChild(el('span', 'mcap', 'SAT break ' + r.quizRound + ' · ' + now.stage));
        if (!q) { card.appendChild(el('p', 'mnote', 'The question could not be loaded.')); card.appendChild(btn('Skip', 'mbtn', function () { answer(now, -1, false); })); return; }
        card.appendChild(math(q.stem, 'mstem'));
        q.ch.forEach(function (c, i) {
          var b = btn('', 'mopt', function () { if (l.mine.picked) return; answer(now, i, i === q.a); });
          b.appendChild(el('i', '', 'ABCD'[i])); b.appendChild(math(c));
          card.appendChild(b);
        });
      } else {
        card.appendChild(el('span', 'mcap', 'SAT break ' + r.quizRound));
        var waiting = others.filter(function (m) { return !m.done && m.online; });
        card.appendChild(el('h3', 'srf', waiting.length ? 'Done. Waiting for ' + waiting.length + ' more…' : 'The film is about to continue…'));
        if (others.length) {
          var row = el('div', 'mchips');
          others.forEach(function (m) { var c = btn(m.nick + (m.done ? ' ✓' : ''), 'mchip', function () { l.watchNick = m.nick; l.quizKey = ''; drawQuiz(); }); c.setAttribute('aria-pressed', watched && m.nick === watched.nick ? 'true' : 'false'); row.appendChild(c); });
          card.appendChild(el('p', 'mnote', 'Watch someone:')); card.appendChild(row);
        }
        if (watched) {
          var theirs = watched.done ? null : step(r.quiz, watched.answers);
          watched.answers.forEach(function (a, i) { card.appendChild(el('p', 'mline', 'Question ' + (i + 1) + ': chose ' + ('ABCD'[a.c] || '—') + (a.ok ? ' · right' : ' · wrong'))); });
          if (theirs && qs[theirs.id]) {
            card.appendChild(el('p', 'mline', watched.nick + ' is on: ' + theirs.stage));
            card.appendChild(math(qs[theirs.id].stem, 'mstem'));
            qs[theirs.id].ch.forEach(function (c, i) { var o = el('div', 'mopt'); o.appendChild(el('i', '', 'ABCD'[i])); o.appendChild(math(c)); card.appendChild(o); });
          }
        }
      }
    }).catch(function () { /* next tick */ });
  }
  function answer(now, choice, ok) {
    var l = live, r = l.room;
    l.mine.picked = true;
    var opts = l.quiz.querySelectorAll('.mopt'), q = l.qs[now.id];
    Array.prototype.forEach.call(opts, function (b, i) { b.disabled = true; if (q && i === q.a) b.classList.add('ok'); else if (i === choice) b.classList.add('no'); });
    var answers = l.mine.answers.concat([{ q: now.id, c: choice, ok: ok }]);
    var done = !step(r.quiz, answers);
    setTimeout(function () {
      if (live !== l || !l.mine) return;
      l.mine.answers = answers; l.mine.picked = null;
      var me = l.room.members.filter(function (m) { return m.me; })[0]; if (me) { me.answers = answers; me.done = done; }
      drawQuiz();
      rpc('movie_quiz_answer', { p_room: l.id, p_answers: answers, p_done: done }).then(tick).catch(function (e) { fail(e, 'Your answer was not sent.'); });
    }, 1100);
  }

  /* ---------------- start ---------------- */
  function mount() {
    box = document.getElementById('ufq-movies');
    if (!box || box.closest('x-dc') || !window.Ufq || !window.UfqGameData) { setTimeout(mount, 80); return; }
    if (box.dataset.ready) return; box.dataset.ready = '1';
    U = window.Ufq;
    var form = el('form', 'mrow'), q = el('input', 'minp'); q.type = 'search'; q.placeholder = 'Search any film: title, actor, genre'; q.setAttribute('aria-label', 'Search films');
    var go = el('button', 'mbtn red', 'Search'); go.type = 'submit'; form.appendChild(q); form.appendChild(go);
    form.onsubmit = function (e) {
      e.preventDefault(); query = q.value.trim(); tab = 'films'; found = null; renderPage();
      if (!query) return;
      var asked = query;
      search(asked).then(function (list) { if (query === asked) { found = list; renderPage(); } }).catch(function () { if (query === asked) { found = []; U.toast('Search failed. Check your connection.'); renderPage(); } });
    };
    q.oninput = function () { if (!q.value.trim() && query) { query = ''; renderPage(); } };
    chips = el('div', 'mchips');
    [['films', 'Films'], ['rooms', 'Rooms'], ['words', 'My words']].forEach(function (t) { var c = btn(t[1], 'mchip', function () { tab = t[0]; renderPage(); if (tab === 'rooms') loadRooms(); }); c.dataset.k = t[0]; chips.appendChild(c); });
    grid = el('div', 'mgrid');
    var credit = el('p', 'mnote'); credit.innerHTML = 'Free films from <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>. Cinema releases are not available here.';
    box.textContent = ''; [form, chips, grid, credit].forEach(function (n) { box.appendChild(n); });
    renderPage();
    details(CURATED.map(function (c) { return c[0]; })).then(renderPage).catch(function () { grid.textContent = ''; grid.appendChild(el('p', 'mnote', 'Could not reach the film library. Check your connection.')); });
    loadRooms();
    setInterval(function () { if (!document.hidden && !live) loadRooms(); }, 8000);
    var wanted = new URLSearchParams(location.search).get('room');
    if (wanted) join(wanted);
    window.addEventListener('popstate', function () { if (live && location.search.indexOf('room=') < 0) close(true); });
  }
  window.UfqMovies = { checkpoints: checkpoints, step: step };
  mount();
})();
