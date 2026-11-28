/* The Games screens' only data access (replaces the prototype's bots and sample questions).
   Questions come from the real bank, scores and matches from Supabase (supabase/migrations/20261128_games.sql). */
(function () {
  'use strict';
  var SPEED_MODES = [60, 120, 180];
  var DOM = { 'algebra': 'Algebra', 'advanced-math': 'Advanced Math', 'problem-solving': 'Problem-Solving & Data', 'data-analysis': 'Problem-Solving & Data', 'geometry': 'Geometry & Trig' };
  var COLS = 'id,subject_id,difficulty,question_text,options,correct_index,image_url,explanation';
  function Ufq() { return window.Ufq; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rpc(name, args) { return Ufq().rest('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }).catch(friendly); }
  function friendly(e) {
    var m = String((e && e.message) || e || '');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    if (/game_|schema cache|does not exist|PGRST20/i.test(m)) { if (window.Ufq) window.Ufq.toast('Games need one more setup step: run supabase/migrations/20261128_games.sql.'); throw new Error('server'); }
    var err = new Error(/missing/i.test(m) ? 'missing' : 'server'); err.detail = m; if (window.console) console.warn('games:', m);
    throw err;
  }

  /* ---------------- questions ---------------- */
  var seen = {}; // ids already served in this visit
  function subjectsMap() { return Ufq().subjects().then(function (subs) { var m = {}; subs.forEach(function (s) { m[s.id] = s.slug; }); return m; }); }
  function toGameQ(row, slugs) {
    var ch = Array.isArray(row.options) ? row.options : [];
    if (ch.length !== 4 || !(row.correct_index >= 0 && row.correct_index < 4)) return null;
    var stem = String(row.question_text || '');
    if (row.image_url) {
      var sp = Ufq().figNote(stem);
      stem = sp.stem + '<div><img src="' + String(row.image_url).replace(/"/g, '') + '" alt="Figure"></div>' + (sp.note ? '<p style="text-align:center">' + sp.note + '</p>' : '');
    }
    return { id: row.id, d: row.difficulty === 'easy' ? 'easy' : row.difficulty === 'medium' || row.difficulty === 'mixing' ? 'medium' : 'hard', dom: DOM[slugs[row.subject_id]] || 'Algebra', stem: stem, ch: ch.map(String), a: row.correct_index, ex: String(row.explanation || '') };
  }
  var counts = {};
  function countDiff(d) {
    if (counts[d]) return counts[d];
    counts[d] = Ufq().restCount('/rest/v1/questions?select=id&difficulty=eq.' + d + '&question_type=eq.multiple_choice');
    return counts[d];
  }
  /* n random multiple-choice questions of one difficulty, from a few random places in the bank */
  function sample(d, n, slugs, exclude) {
    if (n <= 0) return Promise.resolve([]);
    return countDiff(d).then(function (total) {
      var windows = Math.min(4, Math.max(1, Math.ceil(n / 5))), size = Math.ceil(n * 1.6 / windows) + 1, jobs = [];
      for (var i = 0; i < windows; i++) {
        var off = Math.floor(Math.random() * Math.max(1, total - size));
        jobs.push(Ufq().rest('/rest/v1/questions?select=' + COLS + '&difficulty=eq.' + d + '&question_type=eq.multiple_choice&order=id&limit=' + size + '&offset=' + off));
      }
      return Promise.all(jobs).then(function (parts) {
        var got = {}, out = [];
        shuffle([].concat.apply([], parts)).forEach(function (row) {
          if (got[row.id] || exclude[row.id]) return; got[row.id] = 1;
          var q = toGameQ(row, slugs); if (q) out.push(q);
        });
        return out.slice(0, n);
      });
    });
  }
  function byIds(ids) {
    return Promise.all([subjectsMap(), Ufq().rest('/rest/v1/questions?select=' + COLS + '&id=in.(' + ids.join(',') + ')&limit=100')]).then(function (r) {
      var by = {}; r[1].forEach(function (row) { by[row.id] = toGameQ(row, r[0]); });
      return ids.map(function (id) { return by[id]; }).filter(Boolean);
    });
  }

  /* ---------------- weekly numbers ---------------- */
  var matches = {}, lastPush = {}, lastPull = {};

  var G = {
    simulate: 'none',
    _ls: function (k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } },
    _ss: function (k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } },
    _net: function () { return Promise.resolve(); },
    /* week = Monday 00:00 -> Sunday 23:59, Tashkent time (UTC+5) */
    week: function (now) {
      var t = new Date((now || Date.now()) + 5 * 3600e3), dow = (t.getUTCDay() + 6) % 7;
      var start = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - dow) - 5 * 3600e3;
      return { id: new Date(start + 5 * 3600e3).toISOString().slice(0, 10), start: start, resetsAt: start + 7 * 864e5, day: dow };
    },
    /* f: { difficulty: 'easy' | ['easy','medium'], count, exclude: [ids] } */
    getQuestions: function (f) {
      var ds = [].concat(f.difficulty || ['easy', 'medium']), ex = {};
      (f.exclude || []).forEach(function (id) { ex[id] = 1; });
      Object.keys(seen).forEach(function (id) { ex[id] = 1; });
      var per = Math.ceil(f.count / ds.length);
      return subjectsMap().then(function (slugs) {
        return Promise.all(ds.map(function (d) { return sample(d, per, slugs, ex); }));
      }).then(function (parts) {
        var out = shuffle([].concat.apply([], parts)).slice(0, f.count);
        out.forEach(function (q) { seen[q.id] = 1; });
        if (!out.length) throw new Error('server');
        return out;
      }).catch(friendly);
    },

    /* ---------------- solo runs and personal bests ---------------- */
    _myRuns: function () { var uid = (Ufq().user() || {}).id; return Ufq().rest('/rest/v1/game_runs?select=game,mode,score,correct,reached,created_at&user_id=eq.' + uid + '&order=score.desc&limit=500').catch(friendly); },
    _profile: function () {
      var uid = (Ufq().user() || {}).id;
      return Ufq().rest('/rest/v1/game_profiles?select=opt_in,nick&user_id=eq.' + uid).then(function (r) { return r[0] ? { optIn: r[0].opt_in, nick: r[0].nick } : { optIn: false, nick: '' }; }).catch(friendly);
    },
    saveRun: function (game, result) {
      var last = { game: game, mode: result.mode, at: Date.now(), score: result.score, missed: result.missed || [] };
      this._ss('ufq.games.last', last); this._ls('ufq.games.last', last);
      if (game === 'duel') return Promise.resolve({ isRecord: false, firstRun: false, best: result.score, prev: result.score });
      var mode = game === 'speed' ? (result.mode || 60) : 0;
      return this._myRuns().then(function (runs) {
        var prev = runs.filter(function (r) { return r.game === game && r.mode === mode; }).reduce(function (m, r) { return Math.max(m, r.score); }, 0);
        var row = { user_id: (Ufq().user() || {}).id, game: game, mode: mode, score: Math.round(result.score), correct: result.correct || 0, reached: result.reached || 0 };
        return Ufq().rest('/rest/v1/game_runs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) }).catch(friendly).then(function () {
          return { isRecord: result.score > prev && prev > 0, firstRun: prev === 0, best: Math.max(prev, result.score), prev: prev };
        });
      });
    },
    getLastRun: function () { return this._ss('ufq.games.last') || this._ls('ufq.games.last'); },
    getPersonalBests: function () {
      var w = this.week(), self = this;
      return Promise.all([self._myRuns(), rpc('game_my_wins'), self._profile()]).then(function (r) {
        var runs = r[0], wins = r[1] || { total: 0, week: 0 };
        var best = function (game, mode, since) { var list = runs.filter(function (x) { return x.game === game && x.mode === mode && (!since || new Date(x.created_at).getTime() >= since); }); return list.length ? list.reduce(function (a, b) { return b.score > a.score ? b : a; }) : null; };
        var modes = {}; SPEED_MODES.forEach(function (m) { modes[m] = best('speed', m); });
        var wsp = best('speed', 60, w.start), wsv = best('survival', 0, w.start);
        var week = { id: w.id, speed: wsp ? wsp.score : 0, survival: wsv ? wsv.score : 0, duelWins: wins.week };
        week.points = week.speed + week.survival + 150 * week.duelWins;
        return { speed: modes[60], speedModes: modes, survival: best('survival', 0), duelWins: wins.total, week: week, profile: r[2] };
      });
    },
    /* mid-run marker: leaving or refreshing ends the run */
    beginRun: function (game) { this._ss('ufq.games.active', { game: game, at: Date.now() }); },
    endRun: function () { this._ss('ufq.games.active', null); },
    abandonedRun: function (game) { var a = this._ss('ufq.games.active'); if (a && a.game === game) { this.endRun(); return true; } return false; },

    /* ---------------- leaderboard ---------------- */
    setLeaderboardOptIn: function (on, nick) {
      var uid = (Ufq().user() || {}).id;
      return this._profile().then(function (p) {
        var row = { user_id: uid, opt_in: !!on, nick: on ? nick : p.nick, updated_at: new Date().toISOString() };
        return Ufq().rest('/rest/v1/game_profiles?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) })
          .catch(function (e) { if (/duplicate|unique/i.test(String(e.message))) { Ufq().toast('That nickname is taken — try another.'); throw new Error('taken'); } return friendly(e); })
          .then(function () { return { optIn: !!on, nick: row.nick }; });
      });
    },
    getLeaderboard: function (tab, mode) {
      var w = this.week();
      return Promise.all([rpc('game_leaderboard', { p_mode: mode || 60 }), this._profile()]).then(function (r) {
        var profile = r[1];
        var key = tab === 'speed' ? 'speed' : tab === 'survival' ? 'survival' : 'overall';
        var rows = (r[0] || []).map(function (x) { return { nick: x.nick, me: x.me, speed: x.speed, speed60: x.speed60, survival: x.survival, duelWins: x.duel_wins, overall: x.overall, delta: 0 }; });
        rows = rows.filter(function (x) { return x[key] > 0 || x.me; }).sort(function (a, b) { return b[key] - a[key] || a.nick.localeCompare(b.nick); });
        rows = rows.map(function (x, i) { return Object.assign({}, x, { rank: i + 1, pts: x[key] }); });
        var me = rows.filter(function (x) { return x.me; })[0] || null;
        return { rows: rows, me: me, total: rows.length, profile: profile, resetsAt: w.resetsAt, empty: rows.length === 0, history: [] };
      });
    },
    getRewards: function () {
      return [
        { id: 'crown', rank: '#1', name: 'Horizon Crown', desc: 'Held by the player at the top of this week’s board.', tone: 'gold' },
        { id: 'podium', rank: 'Top 3', name: 'Dawn Medal', desc: 'For the three highest scores of the week.', tone: 'silver' },
        { id: 'climber', rank: 'Top 10', name: 'Climber Badge', desc: 'For a place in this week’s top ten.', tone: 'bronze' },
        { id: 'finisher', rank: '1,000+ pts', name: 'Weekly Finisher', desc: 'For everyone who reaches 1,000 points in a week.', tone: 'navy' }
      ];
    },

    /* ---------------- multiplayer matches (2–20 players) ---------------- */
    _pub: function (m) {
      var players = (m.players || []).map(function (p) { return { nick: p.nick, me: !!p.me, host: !!p.host, answered: p.answered || 0, points: p.points || 0, right: p.right || 0, finished: !!p.finished, offline: !!p.offline, qAgo: p.qAgo || 0, per: p.per || [] }; });
      return { id: m.id, code: m.code, name: m.name, host: m.host, visibility: m.visibility, maxPlayers: m.maxPlayers, players: players, status: m.status, createdAt: m.createdAt,
        hasPassword: m.visibility === 'private', isHost: !!m.isHost, joined: players.some(function (p) { return p.me; }), count: players.length, full: players.length >= m.maxPlayers, age: Date.now() - m.createdAt };
    },
    /* a match with its questions; remembers the raw server copy for the live standings */
    _full: function (raw) {
      var self = this, prev = matches[raw.id];
      var qsP = prev && prev.qs ? Promise.resolve(prev.qs) : byIds(raw.questionIds || []);
      return qsP.then(function (qs) { matches[raw.id] = { raw: raw, qs: qs }; return Object.assign(self._pub(raw), { qs: qs }); });
    },
    listMatches: function () { var self = this; return rpc('game_list_matches').then(function (list) { return (list || []).map(function (m) { return self._pub(m); }); }); },
    createMatch: function (opt) {
      var self = this;
      return subjectsMap().then(function (slugs) { return Promise.all([sample('easy', 3, slugs, {}), sample('medium', 4, slugs, {}), sample('hard', 3, slugs, {})]); }).then(function (p) {
        var ids = [].concat(p[0], p[1], p[2]).map(function (q) { return q.id; });
        return rpc('game_create_match', { p_name: opt.name || '', p_visibility: opt.visibility, p_password: opt.password || '', p_max: opt.maxPlayers, p_questions: ids });
      }).then(function (raw) { try { localStorage.setItem('ufq_lobby', raw.id); } catch (e) { /* ignore */ } return self._full(raw); });
    },
    joinMatch: function (idOrCode, password) {
      var self = this;
      return rpc('game_join_match', { p_key: String(idOrCode || ''), p_password: password || null }).then(function (r) {
        if (r.error) return { error: r.error, match: r.match ? self._pub(r.match) : undefined };
        return self._full(r.match).then(function (m) { return { match: m }; });
      });
    },
    getMatch: function (id) { var self = this; return rpc('game_get_match', { p_id: id }).then(function (raw) { return self._full(raw); }); },
    startMatch: function (id) { var self = this; return rpc('game_start_match', { p_id: id }).then(function (raw) { return self._full(raw); }); },
    leaveMatch: function (id) { delete matches[id]; try { localStorage.removeItem('ufq_lobby'); } catch (e) { /* ignore */ } return rpc('game_leave_match', { p_id: id }); },
    /* called every second during play: shows the last known standings and, in the background, sends my progress and fetches theirs */
    liveStandings: function (m, mine) {
      var id = m.id, now = Date.now(), c = matches[id];
      if (mine.length !== lastPush[id]) { lastPush[id] = mine.length; if (mine.length) rpc('game_push_answers', { p_id: id, p_per: mine, p_finished: false }).then(function (raw) { if (matches[id]) matches[id].raw = raw; }).catch(function () { lastPush[id] = -1; }); }
      else if (!lastPull[id] || now - lastPull[id] > 2500) { lastPull[id] = now; rpc('game_get_match', { p_id: id }).then(function (raw) { if (matches[id]) matches[id].raw = raw; }).catch(function () { /* next tick */ }); }
      var players = (c && c.raw.players) || m.players || [];
      var rows = players.filter(function (p) { return !p.me; }).map(function (p) { return { nick: p.nick, n: p.answered || 0, pts: p.points || 0, me: false }; });
      rows.push({ nick: 'You', n: mine.length, pts: mine.reduce(function (t, a) { return t + a.pts; }, 0), me: true });
      return rows.sort(function (a, b) { return b.pts - a.pts || b.n - a.n; }).map(function (x, i) { return Object.assign(x, { rank: i + 1 }); });
    },
    /* everyone has finished, or the server closed the match */
    allDone: function (m) { return m.status === 'done' || m.players.every(function (p) { return p.finished; }); },
    /* send my final answers; the standings are shown only when allDone */
    submitMatch: function (id, answers) {
      var self = this;
      return rpc('game_push_answers', { p_id: id, p_per: answers, p_finished: true }).then(function (raw) { return self._full(raw); }).then(function (m) { return { done: self.allDone(m), match: m }; });
    },
    resultOf: function (m, answers) {
      var rows = m.players.map(function (p) {
        return { nick: p.nick, me: !!p.me, pts: p.me ? answers.reduce(function (t, a) { return t + a.pts; }, 0) : p.points, right: p.me ? answers.filter(function (a) { return a.correct; }).length : p.right, per: p.me ? answers : (p.per || []), finished: true };
      }).sort(function (a, b) { return b.pts - a.pts; }).map(function (x, i) { return Object.assign(x, { rank: i + 1 }); });
      return { match: m, rows: rows, me: rows.filter(function (x) { return x.me; })[0] };
    }
  };
  window.UfqGameData = G;
})();
