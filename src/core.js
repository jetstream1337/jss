/* Jet's Sim Series - core engine (shared by the desktop app and the public site) */
(function () {
'use strict';
var J = window.JSS = window.JSS || {};
var doc = document;
J.MODE = doc.documentElement.getAttribute('data-mode') === 'admin' ? 'admin' : 'public';
J.isPublicView = function () { return J.MODE === 'public' || doc.body.classList.contains('as-public'); };

/* ---------- small helpers ---------- */
J.$ = function (id) { return doc.getElementById(id); };
J.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
J.uid = function (p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
J.todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
J.fmtDate = function (s) { if (!s) return ''; var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s); return isNaN(d) ? String(s) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
J.fmtStamp = function (ts) { var d = new Date(ts); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
J.ago = function (ts) {
  var s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
  return J.fmtDate(new Date(ts).toISOString().slice(0, 10));
};
J.agoText = function (ts) { var a = J.ago(ts); return a === 'now' ? 'just now' : /^\d+[mhd]$/.test(a) ? a + ' ago' : 'on ' + a; };
J.hash = function (s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
J.rng = function (seed) { var a = J.hash(seed); return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
J.pick = function (rand, arr) { return arr[Math.floor(rand() * arr.length)]; };
J.shuffle = function (arr, rand) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
J.toast = function (msg, bad) { var t = J.$('toast'); if (!t) return; t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.style.display = 'block'; clearTimeout(J.toast.t); J.toast.t = setTimeout(function () { t.style.display = 'none'; }, bad ? 6000 : 3200); };
J.download = function (name, content, type) { var b = new Blob([content], { type: type || 'text/csv' }); var u = URL.createObjectURL(b); var a = doc.createElement('a'); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); };
J.driverKey = function (n) { return String(n || '').trim().toLowerCase(); };
J.lastName = function (n) { var p = String(n || '').trim().split(/\s+/); var l = p[p.length - 1] || ''; if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(l) && p.length > 1) l = p[p.length - 2]; return l; };
J.titleCase = function (s) { return String(s).toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); };
J.isDnf = function (r) { return !!(r && r.status && !/^(running|finished|ok|classified)/i.test(String(r.status).trim())); };
J.nascarPts = function (p) { return p === 1 ? 40 : Math.max(1, 37 - p); };

/* ---------- series, tracks, outlets, figures ---------- */
J.SERIES = {
  cup: { id: 'cup', label: 'Cup Series', short: 'CUP', chaseSize: 16, regularRaces: 26, winLocks: true },
  xfinity: { id: 'xfinity', label: "O'Reilly Auto Parts Series", short: "O'REILLY", chaseSize: 12, regularRaces: 26, winLocks: true }, // id kept as 'xfinity' so saved leagues and published files keep working
  truck: { id: 'truck', label: 'Truck Series', short: 'TRUCKS', chaseSize: 10, regularRaces: 16, winLocks: true }
};
J.TYPES = { super: 'Superspeedway', inter: 'Intermediate', short: 'Short track', road: 'Road course', unique: 'Flat / unique' };
J.TYPE_KEYS = Object.keys(J.TYPES);
J.guessType = function (name) {
  var s = String(name || '').toLowerCase();
  if (/daytona|talladega|superspeedway/.test(s)) return 'super';
  if (/sonoma|watkins|road america|circuit of the americas|cota|roval|mid-ohio|portland|sears point|infineon|road course|street/.test(s)) return 'road';
  if (/bristol|martinsville|richmond|new hampshire|loudon|north wilkesboro|irwindale|iowa|milwaukee|gateway|nashville|rockingham|dover|short track/.test(s)) return 'short';
  if (/darlington|pocono|indianapolis|indy|phoenix|flat/.test(s)) return 'unique';
  return 'inter';
};
var STARTER = [
  ['Daytona 500', 'Daytona International Speedway'], ['Rockingham', 'Rockingham Speedway'], ['Las Vegas', 'Las Vegas Motor Speedway'], ['Atlanta', 'Atlanta Motor Speedway'],
  ['Darlington', 'Darlington Raceway'], ['Bristol', 'Bristol Motor Speedway'], ['Texas', 'Texas Motor Speedway'], ['Martinsville', 'Martinsville Speedway'],
  ['Talladega', 'Talladega Superspeedway'], ['California', 'California Speedway'], ['Richmond', 'Richmond International Raceway'], ['Charlotte', 'Lowe\'s Motor Speedway'],
  ['Dover', 'Dover International Speedway'], ['Pocono', 'Pocono Raceway'], ['Michigan', 'Michigan International Speedway'], ['Sonoma', 'Sears Point Raceway'],
  ['Daytona Summer Race', 'Daytona International Speedway'], ['Chicago', 'Chicagoland Speedway'], ['New Hampshire', 'New Hampshire International Speedway'], ['Pocono Fall', 'Pocono Raceway'],
  ['Indianapolis', 'Indianapolis Motor Speedway'], ['Watkins Glen', 'Watkins Glen International'], ['Michigan Fall', 'Michigan International Speedway'], ['Bristol Night Race', 'Bristol Motor Speedway'],
  ['Southern 500', 'Darlington Raceway'], ['Richmond Fall', 'Richmond International Raceway'], ['New Hampshire Fall', 'New Hampshire International Speedway'], ['Dover Fall', 'Dover International Speedway'],
  ['Kansas', 'Kansas Speedway'], ['Talladega Fall', 'Talladega Superspeedway'], ['Charlotte Fall', 'Lowe\'s Motor Speedway'], ['Martinsville Fall', 'Martinsville Speedway'],
  ['Atlanta Fall', 'Atlanta Motor Speedway'], ['Phoenix', 'Phoenix International Raceway'], ['Rockingham Fall', 'Rockingham Speedway'], ['Homestead', 'Homestead-Miami Speedway']
];
J.starterSchedule = function (seriesId) {
  var list = STARTER.map(function (r, i) { return { id: 's' + (i + 1), name: r[0], track: r[1], type: J.guessType(r[1]), date: '', note: '' }; });
  if (seriesId === 'xfinity') list = list.filter(function (_, i) { return i % 12 !== 11; });
  if (seriesId === 'truck') list = list.filter(function (_, i) { return i % 3 !== 1; });
  return list.map(function (r, i) { r.id = 's' + (i + 1); return r; });
};

J.OUTLETS = {
  wire: { id: 'wire', name: 'Checkered Wire', tag: 'Race coverage', color: '#1f4fb4', staff: ['Jamie Kowalski', 'Ross Delgado'] },
  silly: { id: 'silly', name: 'Silly Season Daily', tag: 'Contracts, rides and rumors', color: '#e3202c', staff: ['Marcy Teague', 'Cole Whitaker'] },
  notes: { id: 'notes', name: 'Pit Notes', tag: 'Analysis and features', color: '#b88a00', staff: ['Wes Ostrander', 'Priya Nandakumar'] }
};
J.FIGURES = {
  ray: { id: 'ray', name: 'Ray Calloway', handle: '@RayCallowayRaces', badge: 'Reporter', followers: '412K', color: '#2f6fff', bio: 'Pit road reporter. Post-race interviews, facts first.', voice: 'beat reporter: short factual posts, quotes drivers, "per" and "told me", corrects rumors, never takes sides' },
  tommy: { id: 'tommy', name: 'Tommy Bishop', handle: '@TurnThreeTommy', badge: 'YouTuber', followers: '1.1M', color: '#e3202c', bio: 'Racing YouTuber. New video every race week. Hot takes included.', voice: 'loud YouTuber: big confident takes, plugs his next video, loves a poll, owns his bad predictions with a joke' },
  dana: { id: 'dana', name: 'Dana Whitfield', handle: '@DanaOnTheWall', badge: 'Analyst', followers: '188K', color: '#06b6d4', bio: 'Loop data, tire falloff and the numbers you did not ask for.', voice: 'data analyst: numbers first, average running position, passes, polite but pointed, threads with "1/" style' },
  lou: { id: 'lou', name: 'Big Lou Marchetti', handle: '@LouOnTheRadio', badge: 'Radio', followers: '96K', color: '#ffc20e', bio: 'Weeknight racing radio. Thirty years of opinions, one microphone.', voice: 'old-school radio host: tells a story, mildly grumpy about the modern sport, invites callers' },
  nate: { id: 'nate', name: 'Nate Kessler', handle: '@KesslerKnows', badge: 'Insider', followers: '231K', color: '#a855f7', bio: 'Silly season, sponsors and who is talking to whom.', voice: 'silly season insider: "hearing...", "per multiple sources", teases news with eyes emoji, never fully confirms, only rides and contracts and sponsors' },
  sam: { id: 'sam', name: 'Lap By Lap Stats', handle: '@LapByLapStats', badge: 'Stats', followers: '74K', color: '#94a3b8', bio: 'Numbers only. No opinions. (Some opinions.)', voice: 'stats account: deadpan, starts with a stat, "first driver since...", only league numbers from the facts, no adjectives' },
  pod: { id: 'pod', name: 'The Bump Draft Pod', handle: '@BumpDraftPod', badge: 'Podcast', followers: '58K', color: '#22c55e', bio: 'Two guys, two mics, one race a week.', voice: 'podcast account: casual, "new episode up", asks fans questions, argues between its two hosts in the post' },
  kayla: { id: 'kayla', name: 'Kayla Reyes', handle: '@KaylaRacesToo', badge: 'Streamer', followers: '143K', color: '#ec4899', bio: 'Sim racer and streamer. Live on race nights.', voice: 'sim racing streamer: talks setups and lines like a driver, upbeat, playful trash talk, "chat was screaming"' },
  hank: { id: 'hank', name: 'Hank Purcell', handle: '@HankOnTheBox', badge: 'Ex-crew chief', followers: '67K', color: '#f97316', bio: 'Twenty years on the box. Now I just yell at the TV.', voice: 'retired crew chief: explains strategy calls and adjustments, calm, blunt about bad calls, "I would have taken two"' },
  memes: { id: 'memes', name: 'Caution Clock Memes', handle: '@CautionClockMemes', badge: 'Memes', followers: '305K', color: '#eab308', bio: 'Shitposting about left turns since 2019.', voice: 'meme account: one-line jokes, "nobody: / driver:" formats, describes the meme in words, never mean about anything but racing' }
};
J.STANCE = { 2: 'superfan', 1: 'fan', '-1': 'hater', '-2': 'superhater' };

/* ---------- league (one per series) ---------- */
J.newLeague = function (seriesId, name) {
  var s = J.SERIES[seriesId] || J.SERIES.cup;
  return J.normalize({
    v: 3, id: s.id, series: { id: s.id, label: s.label, short: s.short },
    league: { name: name || "Jet's Sim Series" },
    chase: { name: 'The Chase', size: s.chaseSize, regularRaces: s.regularRaces, winLocks: s.winLocks },
    schedule: J.starterSchedule(s.id)
  });
};
J.normalize = function (S) {
  S = S || {};
  var sid = (S.series && S.series.id) || S.id || 'cup';
  var base = J.SERIES[sid] || J.SERIES.cup;
  S.v = 3; S.id = sid;
  S.series = S.series || { id: base.id, label: base.label, short: base.short };
  if (J.SERIES[sid]) { S.series.label = base.label; S.series.short = base.short; } // series names follow the current official names
  S.league = S.league || { name: "Jet's Sim Series" };
  S.chase = S.chase || {};
  if (!S.chase.name) S.chase.name = 'The Chase';
  if (!S.chase.size) S.chase.size = base.chaseSize;
  if (!S.chase.regularRaces) S.chase.regularRaces = base.regularRaces;
  if (S.chase.winLocks == null) S.chase.winLocks = base.winLocks;
  S.schedule = Array.isArray(S.schedule) ? S.schedule : J.starterSchedule(sid);
  S.schedule.forEach(function (r, i) { if (!r.id) r.id = 's' + Date.now().toString(36) + i; if (!r.type) r.type = J.guessType(r.track || r.name); });
  S.races = Array.isArray(S.races) ? S.races : [];
  S.races.forEach(function (r, i) { if (!r.id) r.id = 'r' + i; r.meta = r.meta || {}; r.rows = r.rows || []; });
  ['articles', 'posts', 'fans', 'media', 'interviews', 'sessions'].forEach(function (k) { S[k] = Array.isArray(S[k]) ? S[k] : []; });
  S.sessions.forEach(function (x) { x.rows = x.rows || []; x.meta = x.meta || {}; });
  S.rep = S.rep || {};
  S.ai = S.ai || {};
  S.announcement = S.announcement || { text: '', date: '' };
  S.updatedAt = S.updatedAt || Date.now();
  return S;
};

/* ---------- season maths ---------- */
J.agg = function (races) {
  var m = {};
  races.forEach(function (race) {
    race.rows.forEach(function (r) {
      var k = J.driverKey(r.driver);
      var d = m[k] || (m[k] = { key: k, name: r.driver.trim(), car: '', team: '', starts: 0, wins: 0, t5: 0, t10: 0, poles: 0, led: 0, pts: 0, fin: 0, dnf: 0, hist: [] });
      d.name = r.driver.trim(); if (r.car) d.car = r.car; if (r.team) d.team = r.team;
      d.starts++; d.fin += r.position; if (r.position === 1) d.wins++; if (r.position <= 5) d.t5++; if (r.position <= 10) d.t10++;
      d.led += r.lapsLed || 0; d.pts += r.points || 0; if (J.isDnf(r)) d.dnf++;
      d.hist.push({ race: race.name, raceId: race.id, pos: r.position, start: r.start, led: r.lapsLed || 0, pts: r.points || 0, status: r.status });
    });
    var pole = race.meta && race.meta.pole;
    if (pole && m[J.driverKey(pole)]) m[J.driverKey(pole)].poles++;
  });
  var arr = Object.keys(m).map(function (k) { return m[k]; });
  arr.forEach(function (d) { d.avg = d.starts ? d.fin / d.starts : 0; });
  arr.sort(function (a, b) { return b.pts - a.pts || b.wins - a.wins || b.t5 - a.t5 || a.avg - b.avg || a.name.localeCompare(b.name); });
  return arr;
};
J.raceInfo = function (race) {
  var rows = race.rows.slice().sort(function (a, b) { return a.position - b.position; });
  var winner = rows[0] || { driver: '', position: 1 };
  var laps = Math.max.apply(null, rows.map(function (r) { return r.laps || 0; }).concat([0]));
  var mover = null; rows.forEach(function (r) { if (r.start > 0) { var g = r.start - r.position; if (!mover || g > mover.gain) mover = { row: r, gain: g }; } });
  var ledMost = rows.slice().sort(function (a, b) { return (b.lapsLed || 0) - (a.lapsLed || 0); })[0] || winner;
  var dnfs = rows.filter(J.isDnf);
  var poleName = (race.meta && race.meta.pole) || '';
  var poleRow = poleName ? rows.find(function (r) { return r.driver.toLowerCase() === poleName.toLowerCase(); }) : null;
  var margin = null;
  if (rows[1] && rows[1].interval && !/l/i.test(rows[1].interval)) { var mm = parseFloat(String(rows[1].interval).replace(/[^\d.\-]/g, '')); if (isFinite(mm)) margin = Math.abs(mm); }
  var meta = race.meta || {};
  return { rows: rows, winner: winner, laps: laps, mover: mover, ledMost: ledMost, dnfs: dnfs, poleName: poleName, poleRow: poleRow, margin: margin, cautions: meta.cautions, leadChanges: meta.leadChanges, leadDrivers: meta.leadDrivers };
};
J.nextRound = function (S) { var done = {}; S.races.forEach(function (r) { done[r.sid] = 1; }); return S.schedule.find(function (r) { return !done[r.id]; }) || null; };
J.seasonYear = function (S) { var r = S.races[S.races.length - 1]; var y = r && r.date ? r.date.slice(0, 4) : ''; return /^\d{4}$/.test(y) ? y : String(new Date().getFullYear()); };
J.raceType = function (S, race) { var sc = S.schedule.find(function (x) { return x.id === race.sid; }); return (sc && sc.type) || J.guessType(race.track || race.name); };
J.pointsFor = function (S, pos, n) {
  var last = S.races[S.races.length - 1], mode = last && last.mode;
  if (mode === 'simple') return Math.max(1, n - pos + 1);
  if (mode === 'custom' && last.custom) { var a = last.custom.split(',').map(function (x) { return Number(x.trim()); }); return isFinite(a[pos - 1]) ? a[pos - 1] : 0; }
  return J.nascarPts(pos);
};
/* ---------- practice / qualifying / happy hour ---------- */
J.SESSIONS = { practice: 'Practice', qualifying: 'Qualifying', happy: 'Happy Hour' };
J.SESSION_ORDER = ['practice', 'qualifying', 'happy'];
J.sessionsFor = function (S, sid) { return (S.sessions || []).filter(function (x) { return sid && x.sid === sid; }).sort(function (a, b) { return J.SESSION_ORDER.indexOf(a.type) - J.SESSION_ORDER.indexOf(b.type); }); };
J.sessionOf = function (S, sid, type) { return (S.sessions || []).find(function (x) { return x.sid === sid && x.type === type; }) || null; };
J.timeSecs = function (t) { var s = String(t || '').trim(), m = s.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/); return m ? (m[1] ? +m[1] * 60 : 0) + parseFloat(m[2]) : null; };
/* Everyone in the league: drivers with race results first (standings order), then drivers only seen in practice/qualifying. */
J.roster = function (S) {
  var out = J.agg(S.races).map(function (d) { return { key: d.key, name: d.name, car: d.car, raced: true }; }), seen = {};
  out.forEach(function (d) { seen[d.key] = 1; });
  (S.sessions || []).slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).forEach(function (x) { x.rows.forEach(function (r) { var k = J.driverKey(r.driver); if (k && !seen[k]) { seen[k] = 1; out.push({ key: k, name: String(r.driver).trim(), car: r.car || '', raced: false }); } }); });
  return out;
};
J.findDriver = function (S, name) {
  var ds = J.roster(S); if (!name || !ds.length) return null;
  var k = J.driverKey(name), hit = ds.find(function (d) { return d.key === k; });
  if (hit) return hit;
  var ln = J.lastName(name).toLowerCase();
  var m = ds.filter(function (d) { return J.lastName(d.name).toLowerCase() === ln; });
  if (m.length === 1) return m[0];
  m = ds.filter(function (d) { return d.key.indexOf(k) >= 0 || k.indexOf(d.key) >= 0; });
  return m.length === 1 ? m[0] : null;
};

/* ---------- Chase picture: who is in on points right now, and how far from the cut line ----------
   Race winners are locked in first (when win-locks are on). The rest of the spots go by points.
   toCut: points above (+) or below (-) the cut line. For drivers inside it is the gap to the first driver out;
   for drivers outside it is the gap to the last driver in. */
J.chasePicture = function (S) {
  var ds = J.agg(S.races), size = S.chase.size, total = Math.max(S.schedule.length, S.races.length);
  if (!ds.length) return null;
  var decided = S.races.length >= Math.min(S.chase.regularRaces, total);
  var winners = S.chase.winLocks ? ds.filter(function (d) { return d.wins > 0; }).sort(function (a, b) { return b.wins - a.wins || b.pts - a.pts; }) : [];
  var lockedW = winners.slice(0, size), lockSet = {}; lockedW.forEach(function (d) { lockSet[d.key] = 1; });
  var others = ds.filter(function (d) { return !lockSet[d.key]; });
  var spots = Math.max(0, size - lockedW.length);
  var inPts = others.slice(0, spots), outPts = others.slice(spots);
  var lastIn = inPts[inPts.length - 1] || null, firstOut = outPts[0] || null;
  var info = {};
  ds.forEach(function (d, i) {
    var o = { key: d.key, pos: i + 1, locked: !!lockSet[d.key], in: false, toCut: null, status: '' };
    if (o.locked) { o.in = true; o.status = 'win'; }
    else if (inPts.indexOf(d) >= 0) { o.in = true; o.toCut = firstOut ? d.pts - firstOut.pts : null; o.status = 'points'; }
    else { o.in = false; o.toCut = spots > 0 && lastIn ? d.pts - lastIn.pts : null; o.status = spots > 0 ? 'out' : 'needwin'; }
    info[d.key] = o;
  });
  var grid = lockedW.concat(inPts, outPts);
  // where the line falls in plain points order: before the first driver who is out
  var cutIndex = ds.findIndex(function (d) { return !info[d.key].in; });
  var bubble = { lastIn: inPts.slice(-2), firstOut: outPts.slice(0, 2) };
  return { info: info, grid: grid, cutIndex: cutIndex, size: size, spots: spots, winners: lockedW.length, decided: decided, bubble: bubble, lastIn: lastIn, firstOut: firstOut, cutRace: Math.min(S.chase.regularRaces, total), left: Math.max(0, Math.min(S.chase.regularRaces, total) - S.races.length) };
};

/* ---------- outlook simulations (deterministic, seeded) ---------- */
var K0 = 4, KT = 3;
var TYPE_SIGMA = { super: 1.5, inter: 0.95, short: 1.0, road: 1.1, unique: 1.0 };
var TYPE_DNF = { super: 1.9, inter: 0.8, short: 1.0, road: 1.1, unique: 0.9 };
function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
J.ratings = function (S) {
  var D = {};
  S.races.forEach(function (race) {
    var n = race.rows.length, T = J.raceType(S, race);
    race.rows.forEach(function (r) {
      var k = J.driverKey(r.driver);
      var d = D[k] || (D[k] = { key: k, name: r.driver.trim(), car: '', n: 0, sum: 0, byType: {}, dnf: 0, finSum: 0 });
      d.car = r.car || d.car; var p = n > 1 ? 1 - (r.position - 1) / (n - 1) : 0.5;
      d.n++; d.sum += p; d.finSum += r.position; if (J.isDnf(r)) d.dnf++;
      var b = d.byType[T] || (d.byType[T] = { n: 0, sum: 0, fin: 0 }); b.n++; b.sum += p; b.fin += r.position;
    });
  });
  Object.keys(D).forEach(function (k) {
    var d = D[k]; d.overall = (d.sum + 0.5 * K0) / (d.n + K0); d.skill = {};
    J.TYPE_KEYS.forEach(function (t) { var b = d.byType[t] || { n: 0, sum: 0 }; d.skill[t] = (b.sum + d.overall * KT) / (b.n + KT); });
    d.dnfRate = (d.dnf + 0.06 * 3) / (d.n + 3);
  });
  return D;
};
function simOne(arr, T, rand) {
  var sc = new Array(arr.length);
  for (var i = 0; i < arr.length; i++) {
    var d = arr[i], z = (d.skill[T] - 0.5) * 4 + (d.boost || 0) + gauss(rand) * TYPE_SIGMA[T];
    var dnf = rand() < d.dnfRate * TYPE_DNF[T]; if (dnf) z = -5 - rand();
    sc[i] = { i: i, z: z, dnf: dnf };
  }
  sc.sort(function (a, b) { return b.z - a.z; });
  return sc;
}
function chaseSet(pts, wins, cfg) {
  var idx = pts.map(function (_, i) { return i; }), size = cfg.size, set = {};
  idx.sort(function (a, b) { return pts[b] - pts[a] || wins[b] - wins[a]; });
  if (cfg.winLocks) {
    var w = idx.filter(function (i) { return wins[i] > 0; }).slice(0, size);
    w.forEach(function (i) { set[i] = 1; });
  }
  for (var k = 0; k < idx.length && Object.keys(set).length < size; k++) set[idx[k]] = 1;
  return set;
}
function cacheKey(S, tag) { var last = S.races[S.races.length - 1], sig = 0; S.races.forEach(function (r) { r.rows.forEach(function (x) { sig = (sig * 31 + (x.points || 0) * 7 + x.position + J.hash(x.driver) % 997) % 2147483647; }); }); return tag + '|' + sig + '|' + S.races.map(function (r) { return r.sid; }).join(',') + '|' + S.schedule.map(function (r) { return r.id; }).join(',') + '|' + (last ? last.id : '') + '|' + S.schedule.length + '|' + S.chase.size + '|' + S.chase.regularRaces + '|' + S.chase.winLocks + '|' + S.schedule.map(function (r) { return r.type; }).join(''); }
var CACHE = {};
J.simulateSeason = function (S, N) {
  var key = cacheKey(S, 'season'); if (CACHE[key]) return CACHE[key];
  N = N || 2500;
  var D = J.ratings(S), arr = Object.keys(D).map(function (k) { return D[k]; });
  if (!arr.length) return null;
  var ag = {}; J.agg(S.races).forEach(function (d) { ag[d.key] = d; });
  var done = {}; S.races.forEach(function (r) { done[r.sid] = 1; });
  var remaining = S.schedule.filter(function (x) { return !done[x.id]; });
  var played = S.races.length, total = played + remaining.length;
  var cutAt = Math.min(S.chase.regularRaces, total), n = arr.length;
  var base = arr.map(function (d) { var a = ag[d.key] || {}; return { pts: a.pts || 0, wins: a.wins || 0 }; });
  var rand = J.rng(key);
  var acc = arr.map(function () { return { chase: 0, pts: 0, wins: 0, champ: 0, fin: 0, finN: 0, ranks: [] }; });
  var fixedSet = cutAt <= played ? chaseSet(base.map(function (b) { return b.pts; }), base.map(function (b) { return b.wins; }), S.chase) : null;
  for (var s = 0; s < N; s++) {
    var pts = base.map(function (b) { return b.pts; }), wins = base.map(function (b) { return b.wins; }), cs = fixedSet;
    for (var j = 0; j < remaining.length; j++) {
      var res = simOne(arr, remaining[j].type || 'inter', rand);
      for (var p = 0; p < n; p++) { var o = res[p]; pts[o.i] += J.pointsFor(S, p + 1, n); acc[o.i].fin += p + 1; acc[o.i].finN++; if (p === 0) wins[o.i]++; }
      if (played + j + 1 === cutAt) cs = chaseSet(pts, wins, S.chase);
    }
    if (!cs) cs = chaseSet(pts, wins, S.chase);
    var order = pts.map(function (_, i) { return i; }).sort(function (a, b) { return pts[b] - pts[a] || wins[b] - wins[a]; });
    order.forEach(function (i, rank) { acc[i].ranks.push(rank + 1); });
    for (var i2 = 0; i2 < n; i2++) { if (cs[i2]) acc[i2].chase++; acc[i2].pts += pts[i2]; acc[i2].wins += wins[i2]; }
    acc[order[0]].champ++;
  }
  var out = arr.map(function (d, i) {
    var a = acc[i], r = a.ranks.slice().sort(function (x, y) { return x - y; }), ag0 = ag[d.key] || { fin: 0, starts: 0, pts: 0, wins: 0 };
    var nFin = ag0.starts + (a.finN / N);
    return {
      key: d.key, name: d.name, car: d.car, curPts: ag0.pts || 0, curWins: ag0.wins || 0, starts: ag0.starts || 0,
      chaseOdds: a.chase / N, projPts: a.pts / N, projWins: a.wins / N, champOdds: a.champ / N,
      rankMed: r[Math.floor(N / 2)], rankLo: r[Math.floor(N * 0.1)], rankHi: r[Math.floor(N * 0.9)],
      projAvg: nFin ? ((ag0.fin || 0) + a.fin / N) / nFin : 0, skill: d.skill, overall: d.overall, byType: d.byType
    };
  });
  var res = { N: N, drivers: out, cutAt: cutAt, played: played, remaining: remaining.length, size: S.chase.size, decided: cutAt <= played };
  CACHE[key] = res; return res;
};
/* how much a session tells us about race pace, by track type (qualifying matters most where passing is hard) */
var SESSION_W = { qualifying: { super: 0.35, inter: 0.9, short: 1.0, road: 1.0, unique: 0.9 }, happy: { super: 0.25, inter: 0.8, short: 0.7, road: 0.7, unique: 0.8 }, practice: { super: 0.15, inter: 0.5, short: 0.5, road: 0.5, unique: 0.5 } };
J.sessionBoost = function (S, sid, T) {
  var out = {}, used = [];
  J.sessionsFor(S, sid).forEach(function (x) {
    var n = x.rows.length, w = (SESSION_W[x.type] || SESSION_W.practice)[T] || 0.5; if (n < 2) return; used.push(x.type);
    x.rows.forEach(function (r) { var k = J.driverKey(r.driver), p = 1 - (r.position - 1) / (n - 1); out[k] = (out[k] || 0) + (p - 0.5) * 2 * w; });
  });
  return { boost: out, used: used };
};
J.raceOutlook = function (S) {
  var nx = J.nextRound(S); if (!nx) return { none: true };
  var T = nx.type || J.guessType(nx.track || nx.name);
  var D = J.ratings(S), sb = J.sessionBoost(S, nx.id, T);
  J.sessionsFor(S, nx.id).forEach(function (x) { x.rows.forEach(function (r) { var k = J.driverKey(r.driver); if (k && !D[k]) { var sk = {}; J.TYPE_KEYS.forEach(function (t) { sk[t] = 0.5; }); D[k] = { key: k, name: String(r.driver).trim(), car: r.car || '', n: 0, sum: 0, byType: {}, dnf: 0, finSum: 0, overall: 0.5, skill: sk, dnfRate: 0.06, fresh: true }; } }); });
  var field = {}; J.sessionsFor(S, nx.id).forEach(function (x) { x.rows.forEach(function (r) { field[J.driverKey(r.driver)] = 1; }); });
  var arr = Object.keys(D).map(function (k) { return D[k]; });
  if (Object.keys(field).length >= 5) arr = arr.filter(function (d) { return field[d.key]; });
  if (!arr.length) return { empty: true, next: nx, type: T };
  var key = cacheKey(S, 'race' + nx.id) + '|' + (S.sessions || []).filter(function (x) { return x.sid === nx.id; }).map(function (x) { return x.id + x.rows.length; }).join(','); if (CACHE[key]) return CACHE[key];
  arr.forEach(function (d) { d.boost = sb.boost[d.key] || 0; });
  var N = 3000, rand = J.rng(key), acc = arr.map(function () { return { w: 0, t5: 0, t10: 0, fin: 0, dnf: 0 }; });
  for (var s = 0; s < N; s++) { var res = simOne(arr, T, rand); res.forEach(function (o, p) { var a = acc[o.i]; if (p === 0) a.w++; if (p < 5) a.t5++; if (p < 10) a.t10++; a.fin += p + 1; if (o.dnf) a.dnf++; }); }
  var qpos = {}, qs = J.sessionOf(S, nx.id, 'qualifying'); if (qs) qs.rows.forEach(function (r) { qpos[J.driverKey(r.driver)] = r.position; });
  var rows = arr.map(function (d, i) {
    var a = acc[i], hist = []; S.races.forEach(function (r) { if (nx.track && r.track === nx.track) { var x = r.rows.find(function (q) { return J.driverKey(q.driver) === d.key; }); if (x) hist.push(x.position); } });
    var tb = d.byType[T];
    return { key: d.key, name: d.name, car: d.car, win: a.w / N, top5: a.t5 / N, top10: a.t10 / N, avg: a.fin / N, dnf: a.dnf / N, skill: d.skill[T], overall: d.overall, typeN: tb ? tb.n : 0, typeAvg: tb ? tb.fin / tb.n : null, avgAll: d.n ? d.finSum / d.n : null, qual: qpos[d.key] || null, trackHist: hist };
  }).sort(function (a, b) { return b.win - a.win || b.top10 - a.top10; });
  var fav = rows.slice(0, 5), used = {}; fav.forEach(function (r) { used[r.key] = 1; });
  var well = rows.filter(function (r) { return !used[r.key]; }).sort(function (a, b) { return b.top10 - a.top10; }).slice(0, 6); well.forEach(function (r) { used[r.key] = 1; });
  var dark = rows.filter(function (r) { return !used[r.key] && r.typeN > 0 && r.skill > r.overall; }).sort(function (a, b) { return (b.skill - b.overall) - (a.skill - a.overall); }).slice(0, 4);
  var avoid = rows.slice().sort(function (a, b) { return a.top10 - b.top10; }).slice(0, 6);
  var risk = rows.slice().sort(function (a, b) { return b.dnf - a.dnf; }).slice(0, 4);
  var out = { next: nx, type: T, rows: rows, favorites: fav, shouldRunWell: well, darkHorses: dark, notUpFront: avoid, wreckRisk: risk, N: N, sessionsUsed: sb.used };
  CACHE[key] = out; return out;
};
J.chaseOutlook = function (S) {
  var sim = J.simulateSeason(S); if (!sim) return null;
  var rows = sim.drivers.slice().sort(function (a, b) { return b.curPts - a.curPts || b.curWins - a.curWins; });
  rows.forEach(function (r, i) {
    r.pos = i + 1;
    var o = r.chaseOdds;
    r.status = sim.decided ? (i < S.chase.size || r.chaseOdds > 0.5 ? 'Qualified' : 'Eliminated') : o >= 0.97 ? 'Virtually in' : o >= 0.75 ? 'In good shape' : o >= 0.4 ? 'On the bubble' : o >= 0.1 ? 'Needs help' : 'Long shot';
    var typesRun = J.TYPE_KEYS.filter(function (t) { return r.byType[t]; });
    r.best = typesRun.length < 2 ? [] : typesRun.filter(function (t) { return r.byType[t].n >= 2 && r.skill[t] > r.overall + 0.03; }).sort(function (a, b) { return (r.skill[b] - r.skill[a]); }).slice(0, 2);
  });
  return { sim: sim, rows: rows };
};
J.seasonOutlook = function (S) {
  var sim = J.simulateSeason(S); if (!sim) return null;
  var rows = sim.drivers.slice().sort(function (a, b) { return a.rankMed - b.rankMed || b.projPts - a.projPts; });
  var cur = sim.drivers.slice().sort(function (a, b) { return b.curPts - a.curPts || b.curWins - a.curWins; }); var cr = {}; cur.forEach(function (d, i) { cr[d.key] = i + 1; });
  rows.forEach(function (r, i) { r.projRank = i + 1; r.curRank = cr[r.key]; });
  return { sim: sim, rows: rows };
};

/* ---------- driver reputation + fan drift ---------- */
J.repOf = function (S, key) { return S.rep[key] || { score: 50, events: [] }; };
J.repLabel = function (v) { return v >= 80 ? 'Beloved' : v >= 62 ? 'Liked' : v >= 40 ? 'Mixed' : v >= 22 ? 'Disliked' : 'Hated'; };
J.repTrend = function (S, key) { var e = J.repOf(S, key).events.slice(0, 3); return e.reduce(function (a, b) { return a + b.delta; }, 0); };
J.repApply = function (S, name, delta, why, src, refId) {
  var d = J.findDriver(S, name); if (!d) return false;
  delta = Math.max(-10, Math.min(10, Math.round(Number(delta) || 0))); if (!delta) return false;
  var r = S.rep[d.key] || (S.rep[d.key] = { score: 50, events: [] });
  r.score = Math.max(0, Math.min(100, r.score + delta));
  r.events.unshift({ t: Date.now(), delta: delta, why: String(why || '').slice(0, 220), src: src || 'track', ref: refId || '' });
  r.events = r.events.slice(0, 30);
  return true;
};
var LV = [-2, -1, 1, 2];
J.driftFans = function (S) {
  var changes = [], rand = J.rng('drift' + S.races.length + ':' + S.articles.length + ':' + Date.now().toString(36).slice(0, 6));
  var ds = J.agg(S.races), pop = {}; ds.slice(0, 12).forEach(function (d) { pop[d.key] = 1; });
  S.fans.forEach(function (f) {
    var st = f.stance || {};
    if (st.driver && st.level) {
      var r = S.rep[st.driver]; if (!r) return;
      var seen = st.seen || 0, fresh = r.events.length - seen; st.seen = r.events.length;
      if (fresh <= 0) return;
      var net = r.events.slice(0, Math.min(fresh, 6)).reduce(function (a, b) { return a + b.delta; }, 0), i = LV.indexOf(st.level);
      if (net >= 8 && rand() < 0.4 && i < 3) { st.level = LV[i + 1]; changes.push({ fan: f.id, driver: st.driver, to: st.level }); }
      else if (net <= -8 && rand() < 0.4 && i > 0) { st.level = LV[i - 1]; changes.push({ fan: f.id, driver: st.driver, to: st.level }); }
    } else {
      Object.keys(pop).forEach(function (k) {
        var r2 = S.rep[k]; if (!r2 || st.driver) return;
        var net2 = r2.events.slice(0, 3).reduce(function (a, b) { return a + b.delta; }, 0);
        if (Math.abs(net2) >= 12 && rand() < 0.12) { f.stance = { driver: k, level: net2 > 0 ? 1 : -1, seen: r2.events.length }; st = f.stance; changes.push({ fan: f.id, driver: k, to: st.level }); }
      });
    }
  });
  return changes;
};

/* ---------- posts / threads ---------- */
J.threadsOf = function (S) {
  var byT = {};
  S.posts.forEach(function (p) { (byT[p.thread] = byT[p.thread] || []).push(p); });
  return Object.keys(byT).map(function (t) {
    var ps = byT[t].sort(function (a, b) { return a.ts - b.ts; });
    var root = ps.find(function (p) { return !p.parent; }) || ps[0];
    return { id: t, root: root, posts: ps, ts: Math.max.apply(null, ps.map(function (p) { return p.ts; })), ref: root.ref || null, platform: root.platform };
  }).sort(function (a, b) { return b.root.ts - a.root.ts; });
};
J.postAuthor = function (S, p) {
  if (p.by.type === 'figure') { var f = J.FIGURES[p.by.id]; return f ? { figure: true, name: f.name, handle: f.handle, badge: f.badge, color: f.color } : null; }
  var fan = S.fans.find(function (x) { return x.id === p.by.id; }); if (!fan) return null;
  return { figure: false, fan: fan, name: fan.name || fan.handle, handle: (fan.platform === 'forum' ? 'u/' : '@') + fan.handle, color: fan.color || '#5b6a86' };
};
J.likesFor = function (p, isFigure) {
  var r = J.rng('likes' + p.id), base = isFigure ? 300 + Math.floor(r() * 4200) : (p.parent ? 1 + Math.floor(Math.pow(r(), 2.2) * 90) : 4 + Math.floor(Math.pow(r(), 2) * 220));
  return base;
};

/* ---------- plain (no-AI) recap so News is never empty ---------- */
J.autoRecap = function (S, race) {
  var info = J.raceInfo(race), w = info.winner, ds = J.agg(S.races), L = ds[0], R = ds[1], paras = [];
  paras.push(w.driver + ' won ' + race.name + (race.track ? ' at ' + race.track : '') + ', starting P' + (w.start || '?') + (w.lapsLed ? ' and leading ' + w.lapsLed + ' laps' : '') + '. ' + (info.rows[1] ? info.rows[1].driver + ' finished second' + (info.rows[2] ? ' and ' + info.rows[2].driver + ' was third' : '') + '.' : ''));
  var bits = []; if (info.cautions != null) bits.push(info.cautions + ' caution' + (info.cautions === 1 ? '' : 's')); if (info.leadChanges != null) bits.push(info.leadChanges + ' lead changes' + (info.leadDrivers ? ' among ' + info.leadDrivers + ' drivers' : ''));
  if (bits.length) paras.push('The race ran ' + (info.laps ? info.laps + ' laps with ' : 'with ') + bits.join(' and ') + '.');
  if (info.mover && info.mover.gain >= 8) paras.push(info.mover.row.driver + ' was the biggest mover, gaining ' + info.mover.gain + ' spots from P' + info.mover.row.start + ' to P' + info.mover.row.position + '.');
  if (info.poleRow) paras.push('Pole sitter ' + info.poleRow.driver + ' finished P' + info.poleRow.position + (J.isDnf(info.poleRow) ? ' (' + info.poleRow.status + ')' : '') + '.');
  if (L) paras.push(L.name + ' leads the championship with ' + L.pts + ' points' + (R ? ', ' + (L.pts - R.pts) + ' ahead of ' + R.name : '') + '.');
  return { id: J.uid('a'), outlet: 'wire', auto: true, headline: w.driver + ' wins ' + race.name, dek: 'Official finish, points and how the championship looks after the race.', body: paras.join('\n\n'), author: J.OUTLETS.wire.staff[0], ts: Date.now(), raceId: race.id, tags: [w.driver], media: [] };
};

/* ---------- what actually gets published ---------- */
J.publicData = function (S) {
  var o = JSON.parse(JSON.stringify(S, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }));
  o.media = (o.media || []).filter(function (m) { return m.published; });
  return o;
};

/* ---------- navigation registry (views.js + admin.js fill these) ---------- */
J.routes = {}; J.nav = []; J.acts = {};
})();
