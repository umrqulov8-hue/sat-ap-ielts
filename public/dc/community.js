/* Community chat: chats, messages with replies, photos, files, voice messages, and admin tools.
   Plain DOM inside #ufq-community (the design page provides the shell and side menu). Text from people is only ever
   set as text (or through the sanitising <ufq-math> element), never as raw HTML. */
(function () {
  'use strict';
  var U, root, me = { admin: false, nick: '' }, chats = [], cur = null, msgs = [], byId = {}, since = null;
  var replyTo = null, pollT = null, listT = null, lastNew = Date.now(), loadingOld = false, noOlder = false, signed = {}, gen = 0, rec = null;
  var MAX_FILE = 20 * 1024 * 1024;
  var OK_EXT = /\.(jpe?g|png|gif|webp|heic|pdf|docx?|xlsx?|pptx?|txt|csv|mp3|m4a|ogg|wav|webm|mp4|mov)$/i;

  function rpc(name, args) { return U.rest('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}), keepCache: true }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = el('button', cls || 'cbtn', label); b.type = 'button'; if (fn) b.onclick = fn; return b; }
  function fail(e, fallback) {
    var m = String((e && e.message) || '');
    if (/slow/.test(m)) U.toast('Too fast — wait a few seconds.');
    else if (/cannot write/i.test(m)) U.toast('You cannot write in this chat.');
    else U.toast(fallback || m || 'Something went wrong.');
  }
  function time(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function day(ms) { var d = new Date(ms), t = new Date(); if (d.toDateString() === t.toDateString()) return 'Today'; t.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return 'Yesterday'; return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }); }
  function size(n) { return !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function dur(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function color(n) { var P = ['#003049', '#C1121F', '#669BBC', '#780000', '#2F6B4F', '#7A4E00'], h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return P[h % P.length]; }

  /* ---------------- files ---------------- */
  function signedUrl(path) {
    var hit = signed[path];
    if (hit && hit.until > Date.now()) return Promise.resolve(hit.url);
    return U.rest('/storage/v1/object/sign/chat/' + path, { method: 'POST', body: JSON.stringify({ expiresIn: 3600 }), keepCache: true }).then(function (r) {
      var url = window.UFQ_CONFIG.url + '/storage/v1' + (r.signedURL || r.signedUrl);
      signed[path] = { url: url, until: Date.now() + 50 * 60000 };
      return url;
    });
  }
  function removeFiles(paths) {
    paths = (paths || []).filter(Boolean);
    if (!paths.length) return Promise.resolve();
    return U.rest('/storage/v1/object/chat', { method: 'DELETE', body: JSON.stringify({ prefixes: paths }), keepCache: true }).catch(function () { /* the message is already gone */ });
  }
  /* big photos are scaled down before upload: saves space and loads faster */
  function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 300 * 1024) return Promise.resolve(file);
    return new Promise(function (resolve) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function upload(chatId, file) {
    var safe = file.name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-60) || 'file';
    var path = chatId + '/' + U.newId() + '-' + safe;
    return U.rest('/storage/v1/object/chat/' + path, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file, keepCache: true }).then(function () { return path; });
  }
  function sendFile(file, kind, duration) {
    if (!cur) return;
    var chat = cur;
    if (kind !== 'voice' && !OK_EXT.test(file.name)) { U.toast('This file type is not allowed. Photos, PDF, Office files, audio and video are.'); return; }
    var status = el('div', 'cup', 'Sending ' + (kind === 'voice' ? 'voice message' : file.name) + '…');
    root.querySelector('.cfeed').appendChild(status); toBottom();
    (kind ? Promise.resolve(file) : shrink(file)).then(function (f) {
      if (f.size > MAX_FILE) throw new Error('The file is larger than 20 MB.');
      var k = kind || (/^image\//.test(f.type) ? 'image' : 'file');
      return upload(chat.id, f).then(function (path) {
        return rpc('chat_send', { p_chat: chat.id, p_body: '', p_reply: replyTo ? replyTo.id : null, p_kind: k, p_path: path, p_name: f.name, p_size: f.size, p_duration: duration || null }).catch(function (e) { removeFiles([path]); throw e; });
      });
    }).then(function (m) { status.remove(); clearReply(); if (cur === chat) merge([m], true); }).catch(function (e) { status.remove(); fail(e); });
  }

  /* ---------------- voice ---------------- */
  /* ---- microphone permission: ask with a clear button; if the browser has blocked it, show how to unblock ---- */
  function micState() {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve('unknown');
    return navigator.permissions.query({ name: 'microphone' }).then(function (r) { return r.state; }).catch(function () { return 'unknown'; });
  }
  function micSteps() {
    var ua = navigator.userAgent, ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (/Telegram|Instagram|FBAN|FBAV|Line\//i.test(ua)) return ['This app’s built-in browser cannot record.', 'Open the site in Chrome or Safari, then try again.'];
    if (ios && /CriOS|FxiOS|EdgiOS/.test(ua)) return ['Open the iPhone/iPad Settings app.', 'Find this browser (e.g. Chrome) and switch Microphone on.', 'Come back and press “Try again”.'];
    if (ios) return ['Tap “aA” (or the ⋯ button) in the address bar.', 'Website Settings → Microphone → Allow.', 'Or: Settings app → Safari → Microphone → Allow.'];
    if (/Android/.test(ua)) return ['Tap the icon to the left of the address (lock or sliders).', 'Permissions → Microphone → Allow.', 'Also check: phone Settings → Apps → your browser → Permissions → Microphone.'];
    if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return ['In the menu bar: Safari → Settings for This Website.', 'Microphone → Allow.'];
    return ['Click the icon to the left of the address.', 'Microphone → Allow.', 'Also check that your computer lets the browser use the microphone.'];
  }
  function micDialog(state) {
    var old = root.querySelector('.cveil'); if (old) old.remove();
    var d = dialog(state === 'denied' ? 'Microphone is blocked' : state === 'unsupported' ? 'Recording is not available' : 'Allow the microphone');
    if (state === 'denied' || state === 'unsupported') {
      d.box.appendChild(el('p', 'cnote', state === 'denied' ? 'Your browser has blocked the microphone for this site. A website cannot change that itself — it takes a moment:' : 'This browser cannot record voice messages here.'));
      var list = el('ol', 'csteps'); micSteps().forEach(function (t) { list.appendChild(el('li', '', t)); }); d.box.appendChild(list);
      d.box.appendChild(btn('Try again', 'cbtn red', function () { d.close(); record(); }));
      d.box.appendChild(btn('Copy the site address', 'cbtn', function () { try { navigator.clipboard.writeText(location.href).then(function () { U.toast('Address copied.', 'ok'); }); } catch (e) { U.toast(location.href, 'ok'); } }));
    } else {
      d.box.appendChild(el('p', 'cnote', 'To record a voice message, allow the microphone. Press the button, then choose “Allow” in the window your browser shows.'));
      d.box.appendChild(btn('🎤 Allow microphone', 'cbtn red', function () { d.close(); record(); }));
    }
  }
  function startVoice() {
    if (rec) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { micDialog('unsupported'); return; }
    micState().then(function (state) {
      if (state === 'prompt') micDialog('prompt');
      else if (state === 'denied') micDialog('denied');
      else record();
    });
  }
  function record() {
    if (rec) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
      var r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
      var chunks = [], t0 = Date.now();
      rec = { r: r, keep: false };
      r.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      r.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(rec.timer); var keep = rec.keep; rec = null; renderComposer();
        if (!keep || !chunks.length) return;
        var mime = (r.mimeType || 'audio/webm').split(';')[0], ext = mime === 'audio/mp4' ? 'm4a' : mime === 'audio/ogg' ? 'ogg' : 'webm';
        sendFile(new File(chunks, 'voice.' + ext, { type: mime }), 'voice', Math.max(1, Math.round((Date.now() - t0) / 1000)));
      };
      r.start(1000);
      renderComposer();
      rec.timer = setInterval(function () {
        var s = (Date.now() - t0) / 1000, lab = root.querySelector('.rectime');
        if (lab) lab.textContent = 'Recording ' + dur(s);
        if (s >= 600) stopVoice(true); /* ten minutes */
      }, 250);
    }).catch(function (e) {
      var name = e && e.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') micDialog('denied');
      else if (name === 'NotFoundError') U.toast('No microphone was found on this device.');
      else micDialog('unsupported');
    });
  }
  function stopVoice(keep) { if (rec) { rec.keep = keep; rec.r.stop(); } }

  /* ---------------- messages ---------------- */
  function feed() { return root.querySelector('.cfeed'); }
  function nearBottom() { var f = feed(); return !f || f.scrollHeight - f.scrollTop - f.clientHeight < 120; }
  function toBottom() { var f = feed(); if (f) f.scrollTop = f.scrollHeight; }
  function rich(text) {
    var box = el('div', 'ctext');
    if (text.indexOf('$') > -1 && window.customElements && customElements.get('ufq-math')) {
      var m = document.createElement('ufq-math');
      m.setAttribute('text', text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      box.appendChild(m); return box;
    }
    text.split(/(https?:\/\/[^\s]+)/g).forEach(function (part) {
      if (/^https?:\/\//.test(part)) { var a = el('a', '', part); a.href = part; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; box.appendChild(a); }
      else if (part) box.appendChild(document.createTextNode(part));
    });
    return box;
  }
  function media(m) {
    var box = el('div', 'cmedia');
    if (m.kind === 'image') {
      var img = el('img', 'cimg'); img.alt = m.fileName || 'Photo'; img.loading = 'lazy'; box.appendChild(img);
      signedUrl(m.path).then(function (u) { var stick = nearBottom(); img.onload = function () { if (stick) toBottom(); }; img.src = u; img.onclick = function () { window.open(u, '_blank', 'noopener'); }; }).catch(function () { img.alt = 'Photo unavailable'; });
    } else if (m.kind === 'voice') {
      var audio = el('audio'); audio.controls = true; audio.preload = 'none';
      var play = btn('▶ Voice message · ' + dur(m.duration), 'cbtn', function () {
        signedUrl(m.path).then(function (u) { audio.src = u; play.replaceWith(audio); audio.play().catch(function () { /* press play */ }); }).catch(function () { U.toast('Could not load the voice message.'); });
      });
      box.appendChild(play);
    } else {
      box.appendChild(btn('📄 ' + (m.fileName || 'File') + ' · ' + size(m.size), 'cbtn', function () {
        signedUrl(m.path).then(function (u) { var a = el('a'); a.href = u + '&download=' + encodeURIComponent(m.fileName || 'file'); a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }).catch(function () { U.toast('Could not open the file.'); });
      }));
    }
    return box;
  }
  function bubble(m) {
    var row = el('div', 'cmsg' + (m.mine ? ' mine' : ''));
    row.id = 'm' + m.id;
    var b = el('div', 'cbub');
    if (!m.mine) { var head = el('div', 'chead'); var n = el('b', '', m.nick); n.style.color = color(m.nick); head.appendChild(n); if (m.admin) head.appendChild(el('span', 'cadm', m.role || 'admin')); b.appendChild(head); }
    if (m.reply) {
      var q = btn('', 'cquote', function () { var t = document.getElementById('m' + m.reply.id); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(function () { t.classList.remove('flash'); }, 1200); } });
      q.appendChild(el('b', '', m.reply.nick)); q.appendChild(el('span', '', m.reply.text)); b.appendChild(q);
    }
    if (m.deleted) b.appendChild(el('div', 'cgone', 'Message deleted'));
    else { if (m.path) b.appendChild(media(m)); if (m.body) b.appendChild(rich(m.body)); }
    var foot = el('div', 'cfoot');
    foot.appendChild(el('span', '', time(m.at)));
    if (!m.deleted) {
      foot.appendChild(btn('Reply', 'clink', function () { replyTo = { id: m.id, nick: m.nick, text: m.body || (m.kind === 'image' ? 'Photo' : m.kind === 'voice' ? 'Voice message' : m.fileName) }; renderReply(); var t = root.querySelector('textarea.cin'); if (t) t.focus(); }));
      if (m.mine || me.admin) foot.appendChild(btn('Delete', 'clink', function () {
        if (!window.confirm('Delete this message for everyone?')) return;
        rpc('chat_delete_message', { p_id: m.id }).then(function (path) { removeFiles([path]); merge([Object.assign({}, m, { deleted: true, body: '', path: null })]); }).catch(function (e) { fail(e, 'Could not delete.'); });
      }));
      if (!m.mine) foot.appendChild(btn('Report', 'clink', function () { rpc('chat_report', { p_id: m.id }).then(function () { U.toast('Reported to the admins.', 'ok'); }).catch(function (e) { fail(e); }); }));
    }
    b.appendChild(foot); row.appendChild(b);
    return row;
  }
  function renderFeed() {
    var f = feed(); if (!f) return;
    f.textContent = '';
    if (!noOlder && msgs.length >= 40) f.appendChild(btn('Load earlier messages', 'cbtn cmore', loadOlder));
    var last = '';
    msgs.forEach(function (m) { var d = day(m.at); if (d !== last) { last = d; f.appendChild(el('div', 'cday', d)); } f.appendChild(bubble(m)); });
    if (!msgs.length) f.appendChild(el('div', 'cempty', 'No messages yet. Say hello.'));
  }
  /* add new messages and apply changes without redrawing what is already on screen */
  function merge(list, mine) {
    if (!list.length) return;
    var stick = mine || nearBottom(), redraw = false;
    list.forEach(function (m) {
      if (byId[m.id]) {
        var old = byId[m.id];
        if (old.deleted !== m.deleted) { Object.assign(old, m); var node = document.getElementById('m' + m.id); if (node) node.replaceWith(bubble(old)); }
        return;
      }
      byId[m.id] = m;
      if (msgs.length && m.id < msgs[msgs.length - 1].id) { msgs.push(m); msgs.sort(function (a, b) { return a.id - b.id; }); redraw = true; return; }
      var prev = msgs[msgs.length - 1]; msgs.push(m); lastNew = Date.now();
      var f = feed(); if (!f) return;
      var empty = f.querySelector('.cempty'); if (empty) empty.remove();
      if (!prev || day(prev.at) !== day(m.at)) f.appendChild(el('div', 'cday', day(m.at)));
      f.appendChild(bubble(m));
    });
    if (redraw) renderFeed();
    if (stick) toBottom();
  }
  function loadOlder() {
    if (loadingOld || !cur || !msgs.length) return;
    loadingOld = true; var chat = cur, f = feed(), h = f.scrollHeight;
    rpc('chat_fetch', { p_chat: chat.id, p_before: msgs[0].id }).then(function (r) {
      loadingOld = false; if (cur !== chat) return;
      if (r.messages.length < 40) noOlder = true;
      r.messages.forEach(function (m) { if (!byId[m.id]) { byId[m.id] = m; msgs.push(m); } });
      msgs.sort(function (a, b) { return a.id - b.id; }); renderFeed(); feed().scrollTop = feed().scrollHeight - h;
    }).catch(function (e) { loadingOld = false; fail(e); });
  }
  /* only what changed is asked for; the pace slows when nothing happens or the tab is hidden */
  function poll() {
    clearTimeout(pollT);
    var chat = cur, g = gen; if (!chat || !chat.joined) return;
    rpc('chat_fetch', { p_chat: chat.id, p_since: since }).then(function (r) {
      if (g !== gen) return;
      since = r.now; merge(r.messages);
      if (r.state && (r.state.closed !== chat.closed || r.state.muted !== chat.muted)) { chat.closed = r.state.closed; chat.muted = r.state.muted; renderComposer(); }
    }).catch(function (e) {
      if (g === gen && /not a member/i.test(String(e.message))) { U.toast('You are no longer in this chat.'); openChat(null); loadList(); }
    }).then(function () {
      if (g !== gen) return;
      var idle = Date.now() - lastNew;
      pollT = setTimeout(poll, document.hidden ? 30000 : idle < 120000 ? 2500 : idle < 600000 ? 6000 : 12000);
    });
  }

  /* ---------------- composer ---------------- */
  function renderReply() {
    var box = root.querySelector('.creply'); if (!box) return;
    box.textContent = ''; box.hidden = !replyTo;
    if (replyTo) { var t = el('span', '', ''); t.appendChild(el('b', '', 'Replying to ' + replyTo.nick + ': ')); t.appendChild(document.createTextNode(String(replyTo.text || '').slice(0, 80))); box.appendChild(t); box.appendChild(btn('✕', 'clink', clearReply)); }
  }
  function clearReply() { replyTo = null; renderReply(); }
  function renderComposer() {
    var c = root.querySelector('.ccompose'); if (!c || !cur) return;
    var draft = c.querySelector('textarea') ? c.querySelector('textarea').value : '';
    c.textContent = '';
    if (!cur.joined) { c.appendChild(btn('Join this chat', 'cbtn red', function () { rpc('chat_join', { p_chat: cur.id }).then(function () { cur.joined = true; openChat(cur); loadList(); }).catch(function (e) { fail(e, 'Could not join.'); }); })); return; }
    if (cur.muted) { c.appendChild(el('div', 'cnote', 'An admin has stopped you from writing in this chat.')); return; }
    if (cur.closed && !me.admin) { c.appendChild(el('div', 'cnote', 'This chat is closed. Only admins can write.')); return; }
    var reply = el('div', 'creply'); reply.hidden = true; c.appendChild(reply);
    var row = el('div', 'crow'); c.appendChild(row);
    if (rec) {
      row.appendChild(el('span', 'rectime', 'Recording 0:00'));
      row.appendChild(btn('Cancel', 'cbtn', function () { stopVoice(false); }));
      row.appendChild(btn('Send voice', 'cbtn red', function () { stopVoice(true); }));
      return;
    }
    var pick = el('input'); pick.type = 'file'; pick.hidden = true; pick.multiple = true;
    pick.onchange = function () { Array.prototype.slice.call(pick.files).slice(0, 10).forEach(function (f) { sendFile(f); }); pick.value = ''; };
    var attach = btn('📎', 'cicon', function () { pick.click(); }); attach.title = 'Send a photo or file'; attach.setAttribute('aria-label', 'Send a photo or file');
    var mic = btn('🎤', 'cicon', startVoice); mic.title = 'Record a voice message'; mic.setAttribute('aria-label', 'Record a voice message');
    var input = el('textarea', 'cin'); input.rows = 1; input.maxLength = 4000; input.placeholder = window.innerWidth < 600 ? 'Message…' : 'Message… ($x^2$ for formulas)'; input.setAttribute('aria-label', 'Message'); input.value = draft;
    var grow = function () { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; };
    var send = function () {
      var text = input.value.trim(); if (!text) return;
      var chat = cur, reply0 = replyTo; input.value = ''; grow(); clearReply();
      rpc('chat_send', { p_chat: chat.id, p_body: text, p_reply: reply0 ? reply0.id : null }).then(function (m) { if (cur === chat) merge([m], true); })
        .catch(function (e) { if (!input.value) { input.value = text; grow(); } replyTo = reply0; renderReply(); fail(e, 'Could not send.'); });
    };
    input.oninput = grow;
    input.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
    input.onpaste = function (e) { var f = e.clipboardData && e.clipboardData.files && e.clipboardData.files[0]; if (f) { e.preventDefault(); sendFile(f); } };
    row.appendChild(pick); row.appendChild(attach); row.appendChild(input); row.appendChild(mic); row.appendChild(btn('Send', 'cbtn red', send));
    renderReply(); grow();
  }

  /* ---------------- chat list and panes ---------------- */
  function renderList() {
    var list = root.querySelector('.clist'); if (!list) return;
    list.textContent = '';
    if (me.admin) {
      var top = el('div', 'ctools');
      top.appendChild(btn('+ New chat', 'cbtn red', newChat));
      top.appendChild(btn('Moderation', 'cbtn', moderation));
      list.appendChild(top);
    }
    chats.forEach(function (c) {
      var it = btn('', 'citem' + (cur && cur.id === c.id ? ' on' : ''), function () { openChat(c); });
      var av = el('span', 'cav', c.name.slice(0, 2).toUpperCase()); av.style.background = color(c.name);
      var mid = el('span', 'cmid'); mid.appendChild(el('b', '', (c.visibility === 'private' ? '🔒 ' : '') + c.name)); mid.appendChild(el('span', '', c.joined ? (c.last || 'No messages yet') : c.members + ' members · not joined'));
      it.appendChild(av); it.appendChild(mid);
      if (c.unread && !(cur && cur.id === c.id)) it.appendChild(el('span', 'cbadge', c.unread > 99 ? '99+' : String(c.unread)));
      list.appendChild(it);
    });
    if (!chats.length) list.appendChild(el('div', 'cempty', me.admin ? 'No chats yet. Create the first one.' : 'No chats yet. An admin will open one soon.'));
  }
  function loadList() {
    return rpc('chat_list').then(function (r) {
      me.admin = r.admin; me.nick = r.nick; chats = r.chats;
      if (cur) { var again = chats.filter(function (c) { return c.id === cur.id; })[0]; if (again) { var changed = again.muted !== cur.muted || again.closed !== cur.closed; Object.assign(cur, again, { unread: 0 }); if (changed) renderComposer(); } else { openChat(null); } }
      renderList();
      var line = root.querySelector('.cinfo'); if (line && cur) line.textContent = info(cur);
    }).catch(function (e) {
      if (/chat_list|schema cache|PGRST202/i.test(String(e.message))) { var m = root.querySelector('.cpane'); m.textContent = ''; m.appendChild(el('div', 'cempty', 'The community needs one setup step: run supabase/migrations/20261204_community.sql in Supabase.')); clearInterval(listT); }
    });
  }
  function info(c) { return (c.visibility === 'private' ? 'Private' : 'Public') + ' · ' + c.members + (c.members === 1 ? ' member' : ' members') + (c.description ? ' · ' + c.description : ''); }
  function openChat(c) {
    gen++; clearTimeout(pollT); stopVoice(false);
    cur = c; msgs = []; byId = {}; since = null; replyTo = null; noOlder = false; lastNew = Date.now();
    root.classList.toggle('inchat', !!c);
    var pane = root.querySelector('.cpane'); pane.textContent = '';
    renderList();
    if (!c) { pane.appendChild(el('div', 'cempty', 'Choose a chat on the left.')); return; }
    var head = el('header', 'cbar');
    head.appendChild(btn('←', 'cicon cback', function () { openChat(null); }));
    var title = el('div', 'ctitle'); title.appendChild(el('b', '', c.name)); title.appendChild(el('span', 'cinfo', info(c))); head.appendChild(title);
    if (c.joined || me.admin) head.appendChild(btn('Members', 'cbtn', function () { members(c); }));
    if (me.admin) head.appendChild(btn('Settings', 'cbtn', function () { settings(c); }));
    else if (c.joined) head.appendChild(btn('Leave', 'cbtn', function () { if (window.confirm('Leave “' + c.name + '”?')) rpc('chat_leave', { p_chat: c.id }).then(function () { openChat(null); loadList(); }); }));
    pane.appendChild(head);
    pane.appendChild(el('div', 'cfeed'));
    pane.appendChild(el('div', 'ccompose'));
    renderComposer();
    if (!c.joined) { feed().appendChild(el('div', 'cempty', c.description || 'Join to read and write messages.')); return; }
    var g = gen;
    rpc('chat_fetch', { p_chat: c.id }).then(function (r) {
      if (g !== gen) return;
      since = r.now; msgs = r.messages; msgs.forEach(function (m) { byId[m.id] = m; }); noOlder = msgs.length < 40; c.unread = 0;
      renderFeed(); toBottom(); renderList(); pollT = setTimeout(poll, 2500);
    }).catch(function (e) { fail(e, 'Could not open the chat.'); });
  }

  /* ---------------- dialogs (admin) ---------------- */
  function dialog(title) {
    var veil = el('div', 'cveil'), box = el('div', 'cdlg'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
    var top = el('div', 'cdtop'); top.appendChild(el('h2', 'srf', title)); top.appendChild(btn('✕', 'cicon', function () { veil.remove(); })); box.appendChild(top);
    veil.onclick = function (e) { if (e.target === veil) veil.remove(); };
    veil.appendChild(box); root.appendChild(veil);
    return { veil: veil, box: box, close: function () { veil.remove(); } };
  }
  function field(box, label, value, placeholder) { var l = el('label', 'cfield', label), i = el('input'); i.type = 'text'; i.value = value || ''; i.placeholder = placeholder || ''; l.appendChild(i); box.appendChild(l); return i; }
  function select(box, label, value) { var l = el('label', 'cfield', label), s = el('select'); [['public', 'Public — anyone can find and join'], ['private', 'Private — only people you add']].forEach(function (o) { var x = el('option', '', o[1]); x.value = o[0]; s.appendChild(x); }); s.value = value || 'public'; l.appendChild(s); box.appendChild(l); return s; }
  function newChat() {
    var d = dialog('New chat'), name = field(d.box, 'Name', '', 'e.g. Math help'), desc = field(d.box, 'Description', '', 'Optional'), vis = select(d.box, 'Who can join');
    d.box.appendChild(btn('Create chat', 'cbtn red', function () {
      rpc('chat_create', { p_name: name.value, p_description: desc.value, p_visibility: vis.value }).then(function (id) {
        d.close(); return loadList().then(function () { var c = chats.filter(function (x) { return x.id === id; })[0]; if (c) { openChat(c); if (c.visibility === 'private') members(c); } });
      }).catch(function (e) { fail(e, 'Could not create the chat.'); });
    }));
    name.focus();
  }
  function settings(c) {
    var d = dialog('Chat settings'), name = field(d.box, 'Name', c.name), desc = field(d.box, 'Description', c.description), vis = select(d.box, 'Who can join', c.visibility);
    var lab = el('label', 'ccheck'), closed = el('input'); closed.type = 'checkbox'; closed.checked = c.closed; lab.appendChild(closed); lab.appendChild(document.createTextNode(' Closed: only admins can write')); d.box.appendChild(lab);
    d.box.appendChild(btn('Save', 'cbtn red', function () {
      rpc('chat_update', { p_chat: c.id, p_name: name.value, p_description: desc.value, p_visibility: vis.value, p_closed: closed.checked }).then(function () { d.close(); return loadList().then(function () { openChat(chats.filter(function (x) { return x.id === c.id; })[0] || null); }); }).catch(function (e) { fail(e); });
    }));
    d.box.appendChild(btn('Delete chat and all its messages', 'cbtn danger', function () {
      if (!window.confirm('Delete “' + c.name + '” with every message and file? This cannot be undone.')) return;
      rpc('chat_delete', { p_chat: c.id }).then(function (paths) { removeFiles(paths); d.close(); openChat(null); loadList(); }).catch(function (e) { fail(e); });
    }));
  }
  function members(c) {
    var d = dialog('Members'), listBox = el('div', 'cmembers');
    var load = function () {
      rpc('chat_members_list', { p_chat: c.id }).then(function (list) {
        listBox.textContent = '';
        list.forEach(function (m) {
          var row = el('div', 'cmember'); var n = el('span', '', m.nick + (m.me ? ' (you)' : '')); if (m.admin) n.appendChild(el('span', 'cadm', m.role || 'admin')); if (m.muted) n.appendChild(el('span', 'cadm', 'muted')); row.appendChild(n);
          if (me.admin && !m.me) {
            row.appendChild(btn(m.muted ? 'Unmute' : 'Mute', 'cbtn', function () { rpc('chat_mute', { p_chat: c.id, p_user: m.id, p_muted: !m.muted }).then(load).catch(function (e) { fail(e); }); }));
            row.appendChild(btn('Remove', 'cbtn', function () { if (window.confirm('Remove ' + m.nick + ' from this chat?')) rpc('chat_remove_member', { p_chat: c.id, p_user: m.id }).then(function () { load(); loadList(); }).catch(function (e) { fail(e); }); }));
          }
          listBox.appendChild(row);
        });
      }).catch(function (e) { fail(e, 'Could not load members.'); });
    };
    if (me.admin) {
      var who = field(d.box, 'Add a person', '', 'Username or account email');
      var add = function () {
        if (!who.value.trim()) return;
        rpc('chat_add_member', { p_chat: c.id, p_who: who.value.trim() }).then(function (r) {
          if (r.error) { U.toast('Nobody with that username or email.'); return; }
          U.toast(r.nick + ' added.', 'ok'); who.value = ''; load(); loadList();
        }).catch(function (e) { fail(e); });
      };
      who.onkeydown = function (e) { if (e.key === 'Enter') add(); };
      d.box.appendChild(btn('Add to chat', 'cbtn red', add));
    }
    d.box.appendChild(listBox); load();
  }
  function moderation() {
    var d = dialog('Moderation'), body = el('div', 'cmembers'); d.box.appendChild(body);
    var load = function () {
      rpc('chat_reports_list').then(function (r) {
        body.textContent = '';
        body.appendChild(el('p', 'cnote', 'Files stored: ' + (size(r.storage) || '0 B') + ' of about 1 GB on the free plan.'));
        body.appendChild(btn('Delete files older than 90 days', 'cbtn', function () {
          if (!window.confirm('Remove photos, files and voice messages older than 90 days from every chat? This cannot be undone.')) return;
          rpc('chat_clear_media', { p_days: 90 }).then(function (paths) { return removeFiles(paths).then(function () { U.toast(paths.length + ' files removed.', 'ok'); load(); }); }).catch(function (e) { fail(e); });
        }));
        body.appendChild(el('b', '', r.reports.length ? 'Reported messages' : 'No reported messages.'));
        r.reports.forEach(function (x) {
          var row = el('div', 'creport');
          row.appendChild(el('b', '', x.nick + ' in ' + x.chat + ' · ' + x.count + ' report' + (x.count > 1 ? 's' : '')));
          row.appendChild(el('span', '', x.kind === 'text' ? x.text : '[' + x.kind + ']'));
          var actions = el('div', 'ctools');
          actions.appendChild(btn('Delete message', 'cbtn danger', function () { rpc('chat_delete_message', { p_id: x.id }).then(function (path) { removeFiles([path]); load(); }).catch(function (e) { fail(e); }); }));
          actions.appendChild(btn('Keep it', 'cbtn', function () { rpc('chat_report_dismiss', { p_id: x.id }).then(load).catch(function (e) { fail(e); }); }));
          row.appendChild(actions); body.appendChild(row);
        });
      }).catch(function (e) { fail(e); });
    };
    load();
  }

  function mount() {
    root = document.getElementById('ufq-community');
    if (!root || root.closest('x-dc') || !window.Ufq) { setTimeout(mount, 60); return; }
    if (root.dataset.ready) return; root.dataset.ready = '1';
    U = window.Ufq;
    root.textContent = '';
    root.appendChild(el('aside', 'clist'));
    root.appendChild(el('section', 'cpane'));
    openChat(null);
    loadList();
    listT = setInterval(function () { if (!document.hidden) loadList(); }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && cur && cur.joined) poll(); });
    window.addEventListener('pagehide', function () { stopVoice(false); });
  }
  mount();
})();
