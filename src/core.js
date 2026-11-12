/* Virtual NASCAR - core engine (shared by the desktop app and the public site) */
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
J.localDay = function (ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
J.ago = function (ts) {
  if (ts > Date.now() + 60000) return J.fmtDate(J.localDay(ts)); // dated ahead (a preview for an upcoming race)
  var s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
  return J.fmtDate(J.localDay(ts));
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
/* ---------- points templates (real NASCAR systems + your own). table[0] is the winner's points before bonuses.
   Stage points are not counted: NASCAR Racing 2003 does not run stages. ---------- */
J.POINTS = {
  p2026: { name: "The Chase (2026)", years: "2026", table: [55, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1], led: 0, most: 0, note: "55 for the win, 35 for 2nd, 34 for 3rd, then one less per spot down to 1. No playoff bonus points, no win-and-in: the top drivers in points make the Chase.", chase: {"winLocks": false} },
  p2017: { name: "Stage era (2017-2025)", years: "2017-2025", table: [40, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1], led: 0, most: 0, note: "40 for the win, 35 for 2nd, 34 for 3rd, then one less per spot down to 1. A win puts you in the playoffs.", chase: {"winLocks": true} },
  p2016: { name: "2016 (40-car fields)", years: "2016", table: [43, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1], led: 1, most: 1, note: "40 for 1st plus 3 for the win, 39 for 2nd down to 1. +1 for leading a lap, +1 for leading the most." },
  p2011: { name: "2011-2015", years: "2011-2015", table: [46, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], led: 1, most: 1, note: "43 for 1st plus 3 for the win, 42 for 2nd down to 1 for 43rd. +1 for leading a lap, +1 for leading the most." },
  chase07: { name: "Chase era (2007-2010)", years: "2007-2010", table: [185, 170, 165, 160, 155, 150, 146, 142, 138, 134, 130, 127, 124, 121, 118, 115, 112, 109, 106, 103, 100, 97, 94, 91, 88, 85, 82, 79, 76, 73, 70, 67, 64, 61, 58, 55, 52, 49, 46, 43, 40, 37, 34], led: 5, most: 5, note: "Winston Cup points with 185 for the win. +5 for leading a lap, +5 for leading the most." },
  chase04: { name: "Chase era (2004-2006)", years: "2004-2006", table: [180, 170, 165, 160, 155, 150, 146, 142, 138, 134, 130, 127, 124, 121, 118, 115, 112, 109, 106, 103, 100, 97, 94, 91, 88, 85, 82, 79, 76, 73, 70, 67, 64, 61, 58, 55, 52, 49, 46, 43, 40, 37, 34], led: 5, most: 5, note: "Winston Cup points with 180 for the win. +5 for leading a lap, +5 for leading the most." },
  winston: { name: "Winston Cup (1975-2003)", years: "1975-2003", table: [175, 170, 165, 160, 155, 150, 146, 142, 138, 134, 130, 127, 124, 121, 118, 115, 112, 109, 106, 103, 100, 97, 94, 91, 88, 85, 82, 79, 76, 73, 70, 67, 64, 61, 58, 55, 52, 49, 46, 43, 40, 37, 34], led: 5, most: 5, note: "175 for the win, 170, 165, 160... down to 34 for 43rd. +5 for leading a lap, +5 for leading the most. Champion is simply the points leader." },
  arca: { name: "ARCA (2020-today)", years: "2020-", table: [46, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], led: 1, most: 1, note: "43 for 1st plus 3 for the win, 42 for 2nd down to 1. +1 for leading a lap, +1 for leading the most." },
  arca2019: { name: "ARCA (2019 and before)", years: "2019", table: [235, 220, 215, 210, 205, 200, 195, 190, 185, 180, 175, 170, 165, 160, 155, 150, 145, 140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 25, 25], led: 5, most: 5, note: "235 for the win, 220 for 2nd, then 5 less per spot. +5 for leading a lap, +5 for leading the most." },
  simple: { name: 'One point per car beaten', years: '', table: null, led: 0, most: 0, note: 'Last place gets 1, every car you beat is worth one more.' },
  custom: { name: 'My own system', years: '', table: null, led: 0, most: 0, note: 'Your own points list and bonuses.' }
};
J.POINTS_ORDER = ['p2026', 'p2017', 'p2016', 'p2011', 'chase07', 'chase04', 'winston', 'arca', 'arca2019', 'simple', 'custom'];
// the season's points system: { template, table (custom only), led, most }
J.seasonPoints = function (S) { var p = S.points || {}; var t = J.POINTS[p.template] || J.POINTS.p2017; return { template: J.POINTS[p.template] ? p.template : 'p2017', name: t.name, table: p.template === 'custom' ? (p.table || []) : t.table, led: p.template === 'custom' ? (+p.led || 0) : t.led, most: p.template === 'custom' ? (+p.most || 0) : t.most }; };
J.templatePoints = function (id, pos, n, custom) {
  var t = J.POINTS[id]; if (!t) return J.nascarPts(pos);
  if (id === 'simple') return Math.max(1, n - pos + 1);
  var tab = id === 'custom' ? custom || [] : t.table;
  return tab[pos - 1] != null ? tab[pos - 1] : (tab.length ? tab[tab.length - 1] : 0);
};

/* ---------- series, tracks, outlets, figures ---------- */
J.SERIES = {
  cup: { id: 'cup', label: 'Cup Series', short: 'CUP', chaseSize: 16, regularRaces: 26, winLocks: true },
  xfinity: { id: 'xfinity', label: "O'Reilly Auto Parts Series", short: "O'REILLY", chaseSize: 12, regularRaces: 26, winLocks: true }, // id kept as 'xfinity' so saved leagues and published files keep working
  truck: { id: 'truck', label: 'Craftsman Truck Series', short: 'TRUCKS', chaseSize: 10, regularRaces: 16, winLocks: true },
  arca: { id: 'arca', label: 'ARCA Menards Series', short: 'ARCA', chaseSize: 0, regularRaces: 20, winLocks: false }
};
J.SERIES_ORDER = ['cup', 'xfinity', 'truck', 'arca'];
J.APP_NAME = 'Virtual NASCAR';
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

J.OUTLET_BASE = {
  wire: { id: 'wire', name: 'Speedway Herald', tag: 'Race coverage', color: '#1f4fb4', staff: ['Jamie Kowalski', 'Ross Delgado'] },
  silly: { id: 'silly', name: 'The Garage Insider', tag: 'Contracts, rides and rumors', color: '#e3202c', staff: ['Marcy Teague', 'Cole Whitaker'] },
  notes: { id: 'notes', name: 'The Pit Board', tag: 'Analysis and features', color: '#b88a00', staff: ['Wes Ostrander', 'Priya Nandakumar'] }
};
J.OUTLETS = JSON.parse(JSON.stringify(J.OUTLET_BASE));
// each league can rename its outlets (League page); everything reads J.OUTLETS, so point it at the open league's names
J.useOutlets = function (S) {
  Object.keys(J.OUTLET_BASE).forEach(function (k) {
    var b = J.OUTLET_BASE[k], o = (S && S.outletNames && S.outletNames[k]) || {};
    J.OUTLETS[k] = { id: k, name: o.name || b.name, tag: o.tag || b.tag, color: b.color, staff: (o.staff && o.staff.length ? o.staff : b.staff).slice() };
  });
};
J.outlet = function (S, id) { return J.OUTLETS[id] || J.OUTLETS.wire; };
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
J.FIGURE_BASE = JSON.parse(JSON.stringify(J.FIGURES));
// a league can give its media personalities new names (Garage Tools, Regenerate); roles and voices stay
J.useFigures = function (S) {
  Object.keys(J.FIGURE_BASE).forEach(function (k) { var b = J.FIGURE_BASE[k], o = (S && S.figureOverrides && S.figureOverrides[k]) || {}; J.FIGURES[k] = Object.assign({}, b, o); });
};

/* ---------- league (one per series) ---------- */
J.newLeague = function (seriesId, name) {
  var s = J.SERIES[seriesId] || J.SERIES.cup;
  return J.normalize({
    v: 3, id: s.id, series: { id: s.id, label: s.label, short: s.short },
    league: { name: name || J.APP_NAME },
    chase: { name: 'The Chase', size: s.chaseSize, regularRaces: s.regularRaces, winLocks: s.winLocks },
    schedule: J.starterSchedule(s.id),
    points: { template: s.id === 'arca' ? 'arca' : 'p2026' }
  });
};
J.normalize = function (S) {
  S = S || {};
  var sid = (S.series && S.series.id) || S.id || 'cup';
  var base = J.SERIES[sid] || J.SERIES.cup;
  S.v = 3; S.id = S.archived && S.id ? S.id : sid; // past seasons keep their own id, like cup-2025
  S.series = S.series || { id: base.id, label: base.label, short: base.short };
  if (J.SERIES[sid]) { S.series.label = base.label; S.series.short = base.short; } // series names follow the current official names
  if (sid === 'truck' && S.season >= 2027) S.series.label = 'FedEx Freight Truck Series'; // the Truck Series' name from 2027 on
  S.league = S.league || { name: J.APP_NAME };
  if (S.league.name === "Jet's Sim Series") S.league.name = J.APP_NAME; // the league's new name
  S.chase = S.chase || {};
  if (!S.chase.name) S.chase.name = 'The Chase';
  if (!S.chase.size) S.chase.size = base.chaseSize;
  if (!S.chase.regularRaces) S.chase.regularRaces = base.regularRaces;
  if (S.chase.winLocks == null) S.chase.winLocks = base.winLocks;
  S.schedule = Array.isArray(S.schedule) ? S.schedule : J.starterSchedule(sid);
  S.schedule.forEach(function (r, i) { if (!r.id) r.id = 's' + Date.now().toString(36) + i; if (!r.type) r.type = J.guessType(r.track || r.name); });
  S.races = Array.isArray(S.races) ? S.races : [];
  S.races.forEach(function (r, i) { if (!r.id) r.id = 'r' + i; r.meta = r.meta || {}; r.rows = r.rows || []; });
  ['articles', 'posts', 'fans', 'media', 'interviews', 'sessions', 'silly'].forEach(function (k) { S[k] = Array.isArray(S[k]) ? S[k] : []; });
  S.sessions.forEach(function (x) { x.rows = x.rows || []; x.meta = x.meta || {}; });
  S.rep = S.rep || {}; S.teams = S.teams || {}; S.contracts = S.contracts || {};
  S.ai = S.ai || {};
  S.announcement = S.announcement || { text: '', date: '' };
  S.updatedAt = S.updatedAt || Date.now();
  if (!(S.clock >= 2)) J.migrateClock(S);
  if (S.clock === 2) { S.clock = 3; J.realignAll(S); }
  return S;
};

/* ---------- seasons: the current one has the series id (cup), past ones are kept as cup-2025 etc. ---------- */
J.seasonIndex = {}; // public site: filled from data/index.json
J.seasonsFor = function (seriesId) {
  var out = [];
  if (J.leagues) Object.keys(J.leagues).forEach(function (k) { var L = J.leagues[k]; if (L.series.id === seriesId) out.push({ id: k, year: J.seasonYear(L), label: J.seasonYear(L) + (L.archived ? (L.cancelled ? ' (cancelled)' : '') : ' (current)'), current: !L.archived }); });
  else (J.seasonIndex[seriesId] || []).forEach(function (x) { out.push(x); });
  return out.sort(function (a, b) { return (b.current ? 1 : 0) - (a.current ? 1 : 0) || String(b.year).localeCompare(String(a.year)); });
};
// a new season for the same series: carries over the league, fans, reputations, open silly season stories and settings
J.nextSeason = function (prev, o) {
  o = o || {};
  var L = J.newLeague(prev.series.id, prev.league.name);
  L.season = o.year || (parseInt(J.seasonYear(prev), 10) + 1);
  L.chase = JSON.parse(JSON.stringify(prev.chase));
  if (prev.points) L.points = JSON.parse(JSON.stringify(prev.points));
  if (prev.outletNames) L.outletNames = JSON.parse(JSON.stringify(prev.outletNames));
  if (prev.art) L.art = JSON.parse(JSON.stringify(prev.art));
  if (prev.power && prev.power.cfg) L.power = { cfg: JSON.parse(JSON.stringify(prev.power.cfg)) };
  if (prev.oddsGate) L.oddsGate = JSON.parse(JSON.stringify(prev.oddsGate));
  L.fans = prev.fans; L.rep = prev.rep; L.teams = JSON.parse(JSON.stringify(prev.teams || {})); L.contracts = JSON.parse(JSON.stringify(prev.contracts || {}));
  L.moves = (prev.moves || []).filter(function (m) { return m.status === 'approved'; }).map(function (m) { return JSON.parse(JSON.stringify(m)); });
  var ny = parseInt(L.season, 10);
  Object.keys(L.contracts).forEach(function (k) {
    var c = L.contracts[k], rr = J.rng('resign' + k + ny);
    if (c.callup || c.released) { delete L.contracts[k]; return; } // one-off starts and released drivers do not carry over
    if (c.through < ny) { c.through = ny + (rr() < 0.55 ? 1 : 0) + (rr() < 0.3 ? 1 : 0); c.resigned = ny; } // most expiring drivers re-sign
  });
  if (J.applyMovesFor) J.applyMovesFor(L);
  L.silly = (prev.silly || []).filter(function (x) { return x.stage !== 'confirmed' && x.stage !== 'dead'; });
  L.schedule = o.schedule || prev.schedule.map(function (r) { var x = JSON.parse(JSON.stringify(r)); x.id = x.id; if (/^\d{4}-/.test(x.date || '')) x.date = String(L.season) + x.date.slice(4); x.note = ''; return x; });
  return J.normalize(L);
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
J.seasonYear = function (S) { if (S.season) return String(S.season); var r = S.races[S.races.length - 1]; var y = r && r.date ? r.date.slice(0, 4) : ''; return /^\d{4}$/.test(y) ? y : String(new Date().getFullYear()); };
J.raceType = function (S, race) { var sc = S.schedule.find(function (x) { return x.id === race.sid; }); return (sc && sc.type) || J.guessType(race.track || race.name); };
J.pointsFor = function (S, pos, n) { var sp = J.seasonPoints(S); return J.templatePoints(sp.template, pos, n, sp.table); };
/* ---------- story dates: news is dated to the race it is about ----------
   preview: race day 9 AM. recap: race night. analysis: the next day. silly season: midweek. Never later than now
   for things that already happened; previews may be dated ahead (the commissioner asked for that). */
J.rawRoundDate = function (S, sid) {
  var race = S.races.find(function (r) { return sid && r.sid === sid; }), r = S.schedule.find(function (x) { return x.id === sid; });
  var d = (race && race.date) || (r && r.date) || ''; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
};
// The day a round's stories and fan posts are dated. Same as its date, except when two rounds sit on the same day (or
// out of order) in the schedule: then the later one is nudged to 3 days after the one before, so the two weekends never mix.
J.roundDate = function (S, sid) {
  var prev = 0, out = '';
  for (var i = 0; i < S.schedule.length; i++) {
    var d = J.rawRoundDate(S, S.schedule[i].id); if (!d) { if (S.schedule[i].id === sid) return ''; continue; }
    var t = new Date(d + 'T12:00:00').getTime(); if (prev && t < prev + 3 * 864e5) t = prev + 3 * 864e5; prev = t;
    if (S.schedule[i].id === sid) { var x = new Date(t); out = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); return out; }
  }
  return J.rawRoundDate(S, sid);
};
// Re-date every race weekend that has something in it (after any date change; nudges can shift later rounds too)
J.realignAll = function (S) { if (!J.dated(S)) return; var did = {}; S.races.forEach(function (r) { if (r.sid) did[r.sid] = 1; }); S.sessions.forEach(function (x) { if (x.sid) did[x.sid] = 1; }); S.articles.forEach(function (a) { if (a.preSid) did[a.preSid] = 1; }); S.schedule.forEach(function (r) { if (did[r.id]) J.alignRound(S, r.id); }); };
// Rounds whose date is the same as, or before, the round before them (shown as a warning in Edit Schedule and Import)
J.dateClashes = function (S) {
  var out = {}, prev = null;
  S.schedule.forEach(function (r) { var d = J.rawRoundDate(S, r.id); if (!d) return; if (prev && d <= prev.d) out[r.id] = prev; prev = { id: r.id, d: d, name: r.name }; });
  return out;
};
J.atLocal = function (day, h, m) { var d = new Date(day + 'T00:00:00'); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
J.storyTime = function (S, kind, o) {
  o = o || {}; var now = Date.now(), day = '';
  if (o.race && /^\d{4}-\d{2}-\d{2}$/.test(o.race.date || '')) day = (o.race.sid && J.roundDate(S, o.race.sid)) || o.race.date;
  else if (o.sid) day = J.roundDate(S, o.sid);
  if (!day) return now - (o.slot || 0) * 60000;
  var t;
  if (kind === 'preview') t = J.atLocal(day, 9, 0) - (o.slot || 0) * 47 * 60000;
  else if (kind === 'recap') t = J.atLocal(day, 21, 40);
  else if (kind === 'analysis') t = J.atLocal(day, 24 + 10, 15) + (o.slot || 0) * 53 * 60000;
  else if (kind === 'silly') t = J.atLocal(day, 48 + 14, 5) + (o.slot || 0) * 61 * 60000;
  else t = J.atLocal(day, 22, 30) + (o.slot || 0) * 30 * 60000;
  return t;
};

/* ---------- league calendar ----------
   When the schedule has dates, everything (stories, fan posts, practice and qualifying) is dated on the league's own
   calendar, so the newest race weekend is always on top even when the league's dates are months away from real time. */
var ISO = /^\d{4}-\d{2}-\d{2}$/;
J.dated = function (S) { return S.schedule.some(function (x) { return ISO.test(x.date || ''); }) || S.races.some(function (r) { return ISO.test(r.date || ''); }); };
J.SESSION_CLOCK = { practice: [-1, 14, 0], happy: [-1, 16, 30], qualifying: [-1, 18, 30] };
J.sessionTime = function (S, x) {
  var day = J.roundDate(S, x.sid) || (ISO.test(x.date || '') ? x.date : ''); if (!day) return x.ts || Date.now();
  var c = J.SESSION_CLOCK[x.type] || J.SESSION_CLOCK.practice; return J.atLocal(day, 24 * c[0] + c[1], c[2]);
};
// the moment the league is "at": just after the newest thing that has happened, never past the next race morning
J.leagueNow = function (S) {
  if (S.pinTs) return S.pinTs; // the commissioner set the league date by hand (Garage Tools, Story Studio)
  if (!J.dated(S)) return Date.now();
  var nx = J.nextRound(S), nd = nx && J.roundDate(S, nx.id), cap = nd ? J.atLocal(nd, 12, 0) : Infinity, t = 0;
  var see = function (ts) { if (ts && ts <= cap && ts > t) t = ts; };
  S.articles.forEach(function (a) { see(a.ts); }); S.posts.forEach(function (p) { see(p.ts); });
  S.sessions.forEach(function (x) { see(J.sessionTime(S, x)); });
  S.races.forEach(function (r) { if (ISO.test(r.date || '')) see(J.storyTime(S, 'recap', { race: r }) - 10 * 60000); });
  if (!t) { var first = S.schedule.find(function (x) { return ISO.test(x.date || ''); }); t = first ? J.atLocal(first.date, -72 + 12, 0) : Date.now(); }
  return Math.min(t + 60000, cap === Infinity ? t + 60000 : cap);
};
// a midweek moment between the last race and the next one (for "this week" news)
J.weekTime = function (S) {
  if (S.pinTs) return S.pinTs;
  var now = J.leagueNow(S); if (!J.dated(S)) return now;
  var last = S.races[S.races.length - 1], mid = last && ISO.test(last.date || '') ? J.storyTime(S, 'recap', { race: last }) + (72 + 11 - 21) * 3600000 - 40 * 60000 : 0;
  var nx = J.nextRound(S), nd = nx && J.roundDate(S, nx.id), cap = nd ? J.atLocal(nd, -24 + 9, 0) : Infinity;
  return Math.max(now, Math.min(mid, cap));
};

// One-time move of things written before the league calendar existed (dated by the real clock) onto the league calendar.
// Practice/qualifying imports and race recaps are the anchors: their real import time and their league time are both known.
J.migrateClock = function (S) {
  if (S.clock >= 2) return false; S.clock = 3;
  if (!J.dated(S)) return false;
  var A = [];
  S.sessions.forEach(function (x) { if (x.ts) A.push({ r: x.ts, l: J.sessionTime(S, x) }); });
  S.races.forEach(function (race) {
    if (!ISO.test(race.date || '')) return; var l = J.storyTime(S, 'recap', { race: race });
    var recaps = S.articles.filter(function (a) { return a.raceId === race.id && !a.desk && !a.preSid && a.ts > l + 2 * 864e5; }).sort(function (a, b) { return a.ts - b.ts; });
    if (recaps.length) A.push({ r: recaps[0].ts, l: l });
  });
  if (!A.length) return false;
  A.sort(function (a, b) { return a.r - b.r; });
  var M = []; A.forEach(function (x) { if (!M.length || x.l > M[M.length - 1].l) M.push(x); });
  var realStart = M[0].r - 2 * 864e5;
  var nx = J.nextRound(S), nd = nx && J.roundDate(S, nx.id), cap = nd ? J.atLocal(nd, 8, 0) : Infinity;
  var map = function (r) {
    if (!r || r < realStart) return r;
    var i = 0; while (i < M.length - 1 && M[i + 1].r <= r) i++;
    var a = M[i], d = r - a.r;
    if (d < 0) return a.l + Math.max(d, -3 * 864e5);
    var b = M[i + 1];
    if (!b) return Math.min(a.l + d, Math.max(a.l + 60000, cap));
    var gap = b.l - a.l, rgap = b.r - a.r;
    return a.l + (rgap <= gap ? d : d * gap / rgap);
  };
  var n = 0, fix = function (o) { var t = map(o.ts); if (t !== o.ts) { o.ts = t; n++; } };
  S.articles.forEach(fix); S.posts.forEach(fix); S.media.forEach(fix); S.interviews.forEach(fix);
  (S.silly || []).forEach(function (x) { (x.history || []).forEach(fix); });
  var sids = {}; S.races.forEach(function (r) { if (r.sid) sids[r.sid] = 1; }); S.sessions.forEach(function (x) { if (x.sid) sids[x.sid] = 1; });
  S.schedule.forEach(function (r) { if (sids[r.id]) J.alignRound(S, r.id); });
  return n;
};

// Put everything about one race weekend at the right moment on the league calendar (after a date changes, or after the
// race is imported with a different date than the previews used). Fan posts move with the story or session they react to.
// Give a story a date and time of the commissioner's choosing. Its fan posts and pit road quotes move with it (same gaps as before),
// and the calendar re-alignment leaves it where it is. ts = null puts it back on the race calendar.
J.setArticleTime = function (S, a, ts) {
  if (!a) return;
  if (ts == null) { delete a.dateSet; if (a.preSid) J.alignRound(S, a.preSid); else if (a.raceId) { var rc = S.races.find(function (r) { return r.id === a.raceId; }); if (rc && rc.sid) J.alignRound(S, rc.sid); } return; }
  var d = ts - a.ts; a.ts = ts; a.dateSet = true;
  var by = {}; S.posts.forEach(function (p) { (by[p.thread] = by[p.thread] || []).push(p); });
  Object.keys(by).forEach(function (t) { var ps = by[t].slice().sort(function (x, y) { return x.ts - y.ts; }), r0 = ps[0].ref; if (r0 && r0.type === 'article' && r0.id === a.id) ps.forEach(function (p) { p.ts += d; }); });
  (S.interviews || []).forEach(function (iv) { if (iv.ref === a.id) iv.ts = ts; });
  (S.media || []).forEach(function (m) { if ((a.media || []).indexOf(m.id) >= 0) m.ts = ts; });
};
J.alignRound = function (S, sid) {
  var day = J.roundDate(S, sid); if (!day) return 0;
  var race = S.races.find(function (r) { return r.sid === sid; }), moved = {}, n = 0;
  var set = function (a, t) { if (a.dateSet) return; if (a.ts !== t) { moved[a.id] = t - a.ts; a.ts = t; n++; } };
  var byNew = function (a, b) { return b.ts - a.ts; };
  S.articles.filter(function (a) { return a.preSid === sid && !a.week; }).sort(byNew).forEach(function (a, i) { set(a, J.storyTime(S, 'preview', { sid: sid }) - i * 20 * 60000); });
  if (race) {
    var mine = S.articles.filter(function (a) { return a.raceId === race.id && !a.preSid; }).sort(function (a, b) { return a.ts - b.ts; }), k = { own: 0, notes: 0, silly: 0 };
    mine.forEach(function (a) {
      if (!a.desk) set(a, J.storyTime(S, 'recap', { race: race }) + (k.own++) * 15 * 60000);
      else if (a.outlet === 'silly') set(a, J.storyTime(S, 'silly', { race: race, slot: k.silly++ }));
      else set(a, J.storyTime(S, 'analysis', { race: race, slot: k.notes++ }));
    });
    S.media.forEach(function (m) { if (m.raceId === race.id) m.ts = J.storyTime(S, 'recap', { race: race }) + 20 * 60000; });
  }
  var sess = {}; S.sessions.forEach(function (x) { if (x.sid === sid) sess[x.id] = x; });
  var clamp = function (d, lo, hi) { return Math.max(lo, Math.min(hi, d)); };
  var arts = {}; S.articles.forEach(function (a) { arts[a.id] = a; });
  var threads = {}; S.posts.forEach(function (p) { (threads[p.thread] = threads[p.thread] || []).push(p); });
  Object.keys(threads).forEach(function (t) {
    var ps = threads[t].sort(function (a, b) { return a.ts - b.ts; }), ref = ps[0].ref, base = null, start = ps[0].ts;
    if (ref && ref.type === 'article' && moved[ref.id] != null) base = arts[ref.id].ts + clamp(start - (arts[ref.id].ts - moved[ref.id]), 60000, 30 * 3600000);
    else if (ref && ref.type === 'session' && sess[ref.id]) { var st = J.sessionTime(S, sess[ref.id]); if (Math.abs(start - st) > 20 * 3600000 || start < st) base = st + 10 * 60000 + (start % 3600000) / 3; }
    else if (ref && ref.type === 'race' && race && ref.id === race.id) base = J.storyTime(S, 'recap', { race: race }) + 5 * 60000;
    if (base == null) return;
    var shift = base - start; ps.forEach(function (p) { p.ts += shift; }); n++;
  });
  S.interviews.forEach(function (iv) { if (arts[iv.ref] && moved[iv.ref] != null) iv.ts = arts[iv.ref].ts; });
  return n;
};

/* ---------- silly season calendar (modeled on real NASCAR) ----------
   Real NASCAR: almost nothing about next year is announced in the first weeks; spring brings whispers about drivers in
   contract years and some extensions; most of next year's lineups are confirmed from early summer up to the playoffs
   (usually midweek, or at a Friday press conference at the track); teams go quiet during the title fight; crew chief
   swaps, number changes and sponsor reveals land in the offseason. Same shape here, scaled to this league's schedule. */
J.SILLY_STAGES = ['whisper', 'rumor', 'talks', 'close', 'confirmed', 'dead'];
J.SILLY_LABEL = { whisper: 'Whisper', rumor: 'Rumor', talks: 'In talks', close: 'Close to a deal', confirmed: 'Confirmed', dead: 'Fell through' };
J.sillyPhase = function (S) {
  var total = Math.max(S.schedule.length, S.races.length) || 1, run = S.races.length, cut = Math.min(S.chase.regularRaces, total);
  var P = function (id, label, rate, maxStage, guide) { return { id: id, label: label, rate: rate, maxStage: maxStage, guide: guide, run: run, total: total, cut: cut }; };
  if (run === 0) return P('preseason', 'Preseason', 0.5, 'confirmed', 'The season has not started. Next year is not on anyone\'s mind yet. Allowed: final sponsor and paint scheme reveals for THIS season, a late crew chief pairing, a part-time schedule being finalized. No rumors about next season\'s rides yet.');
  if (run >= total) return P('offseason', 'Offseason', 0.95, 'confirmed', 'The season is over. This is when real teams announce crew chief swaps, car number changes, new sponsors and the last open seats. Rumors from the season can now be confirmed or fall through. Announcements are matter-of-fact team releases.');
  if (run >= total - 1) return P('finale', 'Championship week', 0.2, 'close', 'Championship week. Teams hold announcements so they do not step on the title fight. At most a quiet note about an open seat or a team "expected to announce after the season". No new big rumors, no confirmations.');
  if (run >= cut) return P('playoffs', 'Playoffs', 0.55, 'confirmed', 'The playoffs. Most lineups for next year are already set. What is left: the last open seats, drivers eliminated from ' + S.chase.name + ' linked to new rides, crew chief changes whispered (but usually announced after the season), sponsors renewing. Teams keep it low-key while the title is decided.');
  if (run / total < 0.2) return P('early', 'Early season', 0.3, 'rumor', 'Early season. In real NASCAR teams almost never announce next year this early. Allowed: whispers about drivers in a contract year, a sponsor adding races THIS season, a lower-series prospect getting test laps. Everything about next season is speculation; nothing is confirmed.');
  if (run < cut * 0.55) return P('spring', 'Spring', 0.6, 'talks', 'Spring. Rumor season heats up. Drivers in contract years get asked about it every week; established drivers sometimes sign extensions; teams start "talks". Big moves are rumors or talks, not announcements yet.');
  return P('summer', 'Peak silly season', 0.9, 'confirmed', 'Peak silly season, the stretch before the field for ' + S.chase.name + ' is set. In real NASCAR this is when most of next year is confirmed: extensions, team switches, retirements, promotions from the lower series. Earlier rumors can now be confirmed or fall apart. Announcements come midweek or at a Friday press conference at the track.');
};
/* ---------- what people talk about at each point of the season (modeled on NASCAR Twitter/X, r/NASCAR, YouTube,
   podcasts and the big NASCAR sites). The cut line is background noise most of the year: fans only start living on it about
   four races out, the media a little before that. playoff: 0 = nobody brings it up, 1 = analysts and stats accounts only,
   2 = the media's main storyline and a growing fan topic, 3 = everything. ---------- */
J.theChase = function (S) { var n = S.chase.name || 'the Chase'; return /^the\s/i.test(n) ? 'the ' + n.slice(4) : 'the ' + n; };
J.talkPhase = function (S) {
  var total = Math.max(S.schedule.length, S.races.length) || 1, run = S.races.length, cut = Math.min(S.chase.regularRaces, total), left = cut - run, C = S.chase.name, T = J.theChase(S), Tc = T.charAt(0).toUpperCase() + T.slice(1);
  var P = function (id, label, playoff, fans, media) { return { id: id, label: label, playoff: playoff, fans: fans, media: media, run: run, total: total, cut: cut, left: left }; };
  if (run === 0) return P('preseason', 'Preseason', 0, 'Season-opener hype. New paint schemes and rides, rookies, bold predictions nobody will remember, "it\'s the superspeedway lottery, anything can happen", people counting down to green flag. Nobody talks points or ' + T + '.', 'Season previews, storylines to watch, new driver and team pairings, predictions. No points talk yet.');
  if (run >= total) return P('offseason', 'Offseason', 1, 'Offseason. Arguing about whether the champion deserved it, season grades, best and worst race of the year, favorite moments, silly season moves, complaints about next year\'s schedule, "how many days until the opener".', 'Season reviews, driver grades, top moments, offseason moves.');
  if (run === total - 1) return P('finale', 'Championship week', 3, 'Title week. Picks for the champion, legacy talk, the format debate (old-heads hate deciding it in one race), "last race of the year" feelings, drivers with nothing to lose playing spoiler.', 'Title contender breakdowns, the path to the championship for each driver, final-race storylines.');
  if (left < 0) return P('playoffs', C, 3, Tc + ' is on. Every week is elimination math: who is above or below the line, must-win talk, "win and you\'re in", contenders who had a bad day, the format debate (some love the drama, old-heads hate it), drivers out of ' + T + ' playing spoiler. Silly season talk fades.', C + ' standings and scenarios every week: who is safe, who needs a win, what each contender needs.');
  if (left === 0) return P('cutset', 'Field just set', 3, Tc + ' field was JUST set. Heartbreak and celebration: who made it, who missed it by a few points, who backed in, "points racing paid off" vs "should have won a race", predictions for ' + T + '.', 'Who made ' + T + ', who missed it and why, early title favorites.');
  if (left <= 1) return P('cutrace', 'Cut race next', 3, 'The cut race is next. It is all anyone talks about: the bubble, the exact points gaps, must-win for the drivers outside, "points racing vs going for the win", nerves, wild scenarios. Even casual fans are doing math.', 'Bubble watch, cut-race scenarios, what each bubble driver needs.');
  if (left <= 4) return P('bubble', 'Bubble watch', 2, Tc + ' is finally a real topic: about four races out, so fans start bubble-watching. Who is in danger, "my guy needs a win", winless drivers feeling the heat, stage points suddenly mattering, someone posting the points gaps. Still plenty of normal race talk.', 'Bubble watch pieces start: the cut line, who is safe with a win, who is in danger, "races left" countdowns.');
  if (left <= 6) return P('approach', 'Cut line on the horizon', 1, 'Fans still talk race by race. The cut line only comes up as an aside, mostly from stats accounts and the analyst, or someone saying "it\'s getting late for my driver". Do not make it a main topic yet.', 'Analysts start the "playoff picture" piece now and then; most coverage is still about the races.');
  if (run <= 4) return P('opening', 'Opening stretch', 0, 'Opening stretch. Overreaction culture: one good run and "X IS BACK", one bad run and "washed", replies pushing back with "it\'s been ' + run + ' race' + (run === 1 ? '' : 's') + '" and "small sample size". Who looks fast, new rides, rookies, first-time winners, the broadcast, track-specific gripes. Points mean nothing yet; nobody talks about ' + T + ' or the cut line (at most a joke about the points leader after ' + run + ' race' + (run === 1 ? '' : 's') + ').', 'Early-season takeaways, who looks fast, surprises, rookies. Points tables are a footnote. No cut-line or ' + T + ' math.');
  return P('midseason', 'Midseason', 0, 'The long middle of the season. Narratives settle: who is fast, who is winless and getting asked about it, grudges from earlier races, slumps, track-type specialists, road course ringers, weather, broadcast complaints, fantasy leagues, silly season rumors creeping in. ' + T + ' and the cut line are background noise: fans basically do not bring them up.', 'Weekly formats rotate: power rankings, winners and losers, "what we learned", by-the-numbers, trends at this kind of track, a feature on a driver. The cut line is not the story yet.');
};
J.talkLine = function (S) { var t = J.talkPhase(S); return 'WHERE THE SEASON IS: ' + t.label + ' (race ' + t.run + ' of ' + t.total + (t.left > 0 ? ', ' + t.left + ' before ' + J.theChase(S) + ' cut' : '') + '). WHAT REAL NASCAR FANS TALK ABOUT RIGHT NOW: ' + t.fans; };

J.sillyActive = function (S) { return (S.silly || []).filter(function (x) { return x.stage !== 'confirmed' && x.stage !== 'dead'; }); };

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
  if (S.preseason && S.preseason.rows) S.preseason.rows.forEach(function (r) { var k = J.driverKey(r.driver); if (k && !seen[k]) { seen[k] = 1; out.push({ key: k, name: String(r.driver).trim(), car: r.car || '', raced: false }); } });
  return out;
};
/* ---------- teams, contracts, happiness (shared: the website shows them too) ----------
   S.teams { id: { id, name, color, base, mfr } }   S.contracts { driverKey: { team, through, car } }
   Happiness is worked out from the data every time (form, wins, teammate, contract year, rumors), so it always matches
   what happened on track. */
J.slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'; };
J.TEAM_COLORS = ['#e3202c', '#2f6fff', '#ffc20e', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#94a3b8', '#14b8a6', '#eab308', '#8b5cf6'];
J.seasonNum = function (S) { return parseInt(J.seasonYear(S), 10) || new Date().getFullYear(); };
// how long a driver is signed for when nobody typed it in: real announcements first, then team size (big teams sign longer),
// and drivers the real world has leaving are in their final year. Only about one in eight small-team drivers is in a contract year.
var BIG_TEAMS = /hendrick|penske|gibbs|trackhouse|23xi|childress|rfk|roush|jr motorsports|spire|front row|tricon|thorsport|kaulig|wood brothers|legacy|haas|mcanally/i;
J.autoThrough = autoThrough;
function autoThrough(S, key, tname, real) {
  var yr = J.seasonNum(S), rand = J.rng('ct2' + S.series.id + key);
  if (real && real.kind === 'retain') return Math.max(yr + 1, real.through || yr + 1);
  if (real && (real.kind === 'move' || real.kind === 'retire')) return yr;
  var t = BIG_TEAMS.test(tname || '') ? [1, 2, 2, 2, 3, 3, 3, 4] : [0, 1, 1, 1, 2, 2, 2, 3];
  return yr + t[Math.floor(rand() * 8)];
}
J.ensureContracts = function (S, lookup) {
  S.teams = S.teams || {}; S.contracts = S.contracts || {};
  var yr = J.seasonNum(S), changed = 0, ds = J.roster(S), lastRow = {};
  if (lookup && (S.ptVer || 0) < 2) { Object.keys(S.contracts).forEach(function (k) { var c = S.contracts[k]; if (!c.ptSet && !c.extra && !c.callup) c.pt = null; }); S.ptVer = 2; changed++; }
  var starts = {}; S.races.forEach(function (r) { r.rows.forEach(function (x) { var k = J.driverKey(x.driver); lastRow[k] = x; starts[k] = (starts[k] || 0) + 1; }); });
  // in this league they ran (nearly) every race: full-time here, whatever the real roster says
  var everyRace = function (k) { return S.races.length >= 3 && (starts[k] || 0) >= S.races.length * 0.8; };
  var addTeam = function (tname, known) { var tid = tname ? J.slug(tname) : ''; if (tid && !S.teams[tid]) S.teams[tid] = { id: tid, name: tname, color: (known && known.color) || J.TEAM_COLORS[Object.keys(S.teams).length % J.TEAM_COLORS.length], base: (known && known.base) || '', mfr: (known && known.mfr) || '' }; return tid; };
  ds.forEach(function (d) {
    var c = S.contracts[d.key], rand = J.rng('contract' + S.series.id + d.key);
    var known = lookup && lookup(d.name), rowTeam = lastRow[d.key] && lastRow[d.key].team;
    if (c) {
      if (!c.name) c.name = d.name;
      if (c.released) return;
      if (c.auto && !c.team && known) { c.team = addTeam(known.team, known); if (known.number) c.car = known.number; changed++; }
      if (c.pt == null && !c.ptSet) {
        var seen = lastRow[d.key] && lastRow[d.key].car || d.car, r0 = c.auto ? realCar(lookup, d.name, seen, known, rowTeam) : null;
        if (r0) { c.team = addTeam(r0.team, r0); c.car = r0.number; }
        c.pt = everyRace(d.key) ? false : ptFor(S, lookup, r0, known, d.name, c.car || d.car); changed++;
      }
      return;
    }
    // the car NR2003 shows wins: Heim in the #1 truck is the Tricon #1, even though he also runs the #5
    var real = realCar(lookup, d.name, d.car, known, rowTeam), tname = real ? real.team : (known && known.team) || rowTeam || '';
    var tid = addTeam(tname, real ? { color: real.color, base: real.base, mfr: real.mfr } : known);
    var pt = everyRace(d.key) ? false : ptFor(S, lookup, real, known, d.name, d.car);
    S.contracts[d.key] = { name: d.name, team: tid, through: yr + [0, 1, 1, 1, 2, 2, 2, 3][Math.floor(rand() * 8)], car: real ? real.number : (known && known.number) || d.car || '', base: 52 + Math.floor(rand() * 26), auto: true, pt: pt };
    changed++;
  });
  // real cars run by several drivers: bring in everyone who shares it, as part-timers on that team
  if (lookup && lookup.cars) Object.keys(S.contracts).forEach(function (k) {
    var c = S.contracts[k], t = c.team && S.teams[c.team]; if (!t || !c.car) return;
    var car = lookup.cars[t.name + '#' + c.car]; if (!car || car.drivers.length < 2) return;
    car.drivers.forEach(function (n) { var nk = J.driverKey(n); if (S.contracts[nk]) return; var rand = J.rng('contract' + S.series.id + nk); var ftTaken = Object.keys(S.contracts).some(function (q) { var x = S.contracts[q]; return x.team === c.team && String(x.car) === String(c.car) && !x.pt; });
      S.contracts[nk] = { name: n, team: c.team, through: yr + Math.floor(rand() * 2), car: c.car, base: 52 + Math.floor(rand() * 26), auto: true, pt: ftTaken || !isFTDriver(car, n), extra: true }; changed++; });
  });
  // real-world signals: who the real teams have announced they are keeping, who is leaving, and which series each driver really races in.
  // These feed the silly season odds (a driver announced to return is not a move candidate; a driver the real world has leaving is).
  var withReal = !!(lookup && J.realStatus);
  Object.keys(S.contracts).forEach(function (k) {
    var c = S.contracts[k]; if (!c.name) return;
    if (withReal) {
      var rs = yr <= 2026 ? J.realStatus(S.series.id, c.name) : null;
      c.real = rs ? { kind: rs.kind, through: rs.through || 0, to: rs.to || '', date: rs.date || '', unconf: !!rs.unconf } : null;
      if (J.homeSeries) { var hs = J.homeSeries(c.name); if (hs) c.home = hs; }
      if (J.realScore) c.rl = J.realScore(S.series.id, c.name);
    }
    if ((S.ctVer || 0) < 2 && (withReal || !J.realStatus) && c.auto && !c.callup && !c.released) { c.through = autoThrough(S, k, c.team && S.teams[c.team] ? S.teams[c.team].name : '', c.real); changed++; }
  });
  if ((S.ctVer || 0) < 2 && (withReal || !J.realStatus)) S.ctVer = 2;
  return changed;
};
// which real car is this? the driver's own car with this number, else the only real car with this number
function realCar(lookup, name, car, known, rowTeam) {
  if (!lookup || !lookup.cars || !car) return null;
  var key = J.driverKey(name), list = Object.keys(lookup.cars).map(function (k) { return lookup.cars[k]; }).filter(function (x) { return String(x.number) === String(car); });
  var mine = list.filter(function (x) { return x.drivers.some(function (n) { return J.driverKey(n) === key; }); });
  if (mine.length) return mine[0];
  if (known) return null; // a real driver in someone else's number: keep their own team
  if (rowTeam) { var t = list.filter(function (x) { return J.slug(x.team) === J.slug(rowTeam); }); if (t.length) return t[0]; }
  return list.length === 1 ? list[0] : null;
}
function ptFor(S, lookup, real, known, name, car) {
  if (real) return real.fullTime ? (real.drivers.some(function (n) { return J.driverKey(n) === J.driverKey(name); }) ? !isFTDriver(real, name) : false) : true;
  return known ? !known.fullTime : sharedNumber(S, lookup, car);
}
function isFTDriver(car, name) { return !!(car.ftNames && car.ftNames.some(function (n) { return J.driverKey(n) === J.driverKey(name); })); }
// a car number the real roster runs part-time only (no full-time driver), so whoever is in it is part-time
function sharedNumber(S, lookup, car) {
  if (!lookup || !lookup.cars || !car) return false;
  var hits = Object.keys(lookup.cars).map(function (k) { return lookup.cars[k]; }).filter(function (x) { return String(x.number) === String(car); });
  return hits.length > 0 && hits.every(function (x) { return !x.fullTime; });
}
// owner-drivers and family teams do not get fired or sent down (Cody Ware at Rick Ware Racing, Jordan Anderson, Joey Gase...)
var OWNERS = { codyware: 'rick ware', austindillon: 'childress', tygibbs: 'gibbs', ryansieg: 'rss', kylesieg: 'rss', jasonkitzmiller: 'cr7', stewartfriesen: 'friesen', bjmcleod: 'live fast', joshreaume: 'reaume', jeremyclements: 'clements', jordananderson: 'anderson', joeygase: 'gase', timmyhill: 'hill motorsports', calebcostner: 'costner', bradsmith: 'brad smith', alexclubb: 'clubb', michaelmaples: 'maples', normbenning: 'benning', gregvanalst: 'van alst', kriswright: 'wright' };
J.isOwnerDriver = function (S, key) {
  var c = (S.contracts || {})[key]; if (!c) return false; if (c.owner != null) return !!c.owner;
  var t = c.team && S.teams && S.teams[c.team]; if (!t) return false; var tn = t.name.toLowerCase(), nk = String(c.name || key).toLowerCase().replace(/[^a-z]/g, '');
  if (OWNERS[nk]) return tn.indexOf(OWNERS[nk]) >= 0;
  var last = J.lastName(c.name || key).toLowerCase(); return last.length >= 4 && new RegExp('\\b' + last.replace(/[^a-z]/g, '') + '\\b').test(tn) && !/hendrick|penske|childress|roush|keselowski|petty|earnhardt|busch|wallace|harvick|stewart|johnson|hamlin/.test(last);
};
J.isPT = function (S, key) { var c = S.contracts && S.contracts[key]; return !!(c && c.pt); };
// the points standings count full-time drivers only; part-timers are listed on their own
J.standings = function (S, races) { return J.agg(races || S.races).filter(function (d) { return !J.isPT(S, d.key); }); };
J.partTimers = function (S, races) { return J.agg(races || S.races).filter(function (d) { return J.isPT(S, d.key); }); };
// everyone in the series: drivers who raced or ran a session, plus part-timers who share a real car
J.allDrivers = function (S) {
  var out = J.roster(S), seen = {}; out.forEach(function (d) { seen[d.key] = 1; });
  Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (!seen[k] && c.name) { seen[k] = 1; out.push({ key: k, name: c.name, car: c.car || '', raced: false, extra: true }); } });
  return out;
};
J.sharesCar = function (S, key) { var c = S.contracts && S.contracts[key]; if (!c || !c.car || !c.team) return []; return Object.keys(S.contracts).filter(function (k) { var x = S.contracts[k]; return k !== key && x.team === c.team && String(x.car) === String(c.car); }).map(function (k) { return S.contracts[k].name || k; }); };
J.teamOf = function (S, key) { var c = S.contracts && S.contracts[key]; return c && c.team && S.teams && S.teams[c.team] ? S.teams[c.team] : null; };
J.teamDrivers = function (S, tid) { if (!tid) return []; return Object.keys(S.contracts || {}).filter(function (k) { return S.contracts[k].team === tid; }); };
J.contractInfo = function (S, key) {
  var c = (S.contracts || {})[key]; if (!c) return null;
  var yr = J.seasonNum(S), left = c.through - yr;
  return { team: J.teamOf(S, key), through: c.through, left: left, label: left < 0 ? 'Free agent' : left === 0 ? 'Final year (through ' + c.through + ')' : 'Signed through ' + c.through, status: left < 0 ? 'free' : left === 0 ? 'expiring' : left === 1 ? 'short' : 'long' };
};
// how the team sees the driver: results against the teammates (or the field), points, wins, DNFs, attitude
J.teamView = function (S, key) {
  var c = (S.contracts || {})[key]; if (!c || !c.team) return null;
  var ds = J.agg(S.races), d = ds.find(function (x) { return x.key === key; }), ft = J.standings(S), rank = ft.findIndex(function (x) { return x.key === key; }) + 1, field = Math.max(20, ds.length);
  var score = 62, why = [];
  if (d && d.starts >= 3) {
    var avg = d.fin / d.starts, mates = J.teamDrivers(S, c.team).filter(function (k) { return k !== key; }).map(function (k) { return ds.find(function (x) { return x.key === k; }); }).filter(function (x) { return x && x.starts >= 2; });
    var exp = mates.length ? mates.reduce(function (a, m) { return a + m.fin / m.starts; }, 0) / mates.length : field * 0.5, gap = avg - exp;
    score -= Math.max(-15, Math.min(25, gap * 1.6));
    if (gap > 5) why.push(mates.length ? 'well behind the teammates' : 'running below what the team expects');
    else if (gap < -4) why.push(mates.length ? 'beating the teammates' : 'getting more out of the car than expected');
    if (rank && rank > ft.length * 0.7) { score -= 8; why.push('P' + rank + ' in points'); }
    if (d.wins) { score += d.wins * 6; why.push(J.plural(d.wins, 'win')); }
    var dnf = d.hist.filter(function (h) { return J.isDnf({ status: h.status }); }).length; if (dnf >= 3) { score -= dnf * 2; why.push(dnf + ' DNFs'); }
  }
  var h = J.happiness(S, key); if (h && h.score < 35) { score -= 8; why.push('unhappy, and the team knows it'); }
  if (J.isOwnerDriver(S, key)) { score = Math.max(score, 70); why.unshift('owns the team (or it is the family team)'); }
  score = Math.round(Math.max(5, Math.min(98, score)));
  return { score: score, label: score >= 70 ? 'Valued' : score >= 50 ? 'Secure' : score >= 35 ? 'Under pressure' : 'Hot seat', why: why };
};
J.HAPPY_LABEL = function (s) { return s >= 80 ? 'Thrilled' : s >= 65 ? 'Happy' : s >= 50 ? 'Content' : s >= 35 ? 'Frustrated' : 'Unhappy'; };
J.happiness = function (S, key) {
  var c = (S.contracts || {})[key]; if (!c) return null;
  var ds = J.agg(S.races), d = ds.find(function (x) { return x.key === key; }), score = c.base || 60, why = [];
  if (d && d.starts) {
    var hist = d.hist.slice(-5), avg5 = hist.reduce(function (a, h) { return a + h.pos; }, 0) / Math.max(1, hist.length), avg = d.fin / d.starts;
    var team = J.teamDrivers(S, c.team).filter(function (k) { return k !== key; }).map(function (k) { return ds.find(function (x) { return x.key === k; }); }).filter(function (x) { return x && x.starts; });
    if (d.wins) { score += Math.min(16, d.wins * 6); why.push(J.plural(d.wins, 'win') + ' this season'); }
    if (hist.length >= 3) {
      var trend = avg - avg5; score += Math.max(-12, Math.min(12, trend * 1.4));
      if (trend > 3) why.push('running better lately (' + avg5.toFixed(1) + ' average finish in the last ' + hist.length + ')');
      else if (trend < -3) why.push('struggling lately (' + avg5.toFixed(1) + ' average finish in the last ' + hist.length + ')');
    }
    var dnf = hist.filter(function (h) { return J.isDnf({ status: h.status }); }).length; if (dnf >= 2) { score -= dnf * 3; why.push(dnf + ' DNFs in the last ' + hist.length); }
    if (team.length) {
      var tavg = team.reduce(function (a, t) { return a + t.fin / t.starts; }, 0) / team.length, gap = tavg - avg;
      score += Math.max(-10, Math.min(8, gap * 0.8));
      if (gap > 4) why.push('beating the teammates'); else if (gap < -4) why.push('behind the teammates');
    }
  }
  var rep = S.rep && S.rep[key]; if (rep && rep.score != null) score += (rep.score - 50) / 8;
  var yr = J.seasonNum(S); if (c.through <= yr) { score -= 5; why.push('playing out a contract year'); }
  var sl = (S.silly || []).filter(function (x) { return (x.drivers || []).some(function (n) { return J.driverKey(n) === key; }) && x.stage !== 'dead'; }).pop();
  if (sl && /talks|close/.test(sl.stage)) { score -= 8; why.push('linked with a move (' + J.SILLY_LABEL[sl.stage].toLowerCase() + ')'); }
  score = Math.round(Math.max(5, Math.min(98, score)));
  return { score: score, label: J.HAPPY_LABEL(score), why: why };
};
// Who is likely to change rides next season, and where to. Built from contracts, happiness, form and the rumor mill.
J.STAGE_WEIGHT = { whisper: 0.05, rumor: 0.12, talks: 0.25, close: 0.45, confirmed: 1, dead: -0.2 };
J.sillyPredictions = function (S, cross, quick) {
  var ds = J.standings(S), yr = J.seasonNum(S), byKey = {}; ds.forEach(function (d, i) { byKey[d.key] = { d: d, rank: i + 1 }; }); J.partTimers(S).forEach(function (d) { byKey[d.key] = { d: d, rank: null }; });
  var out = [];
  var ph = J.sillyPhase(S), scale = ({ preseason: 0.12, early: 0.3, spring: 0.65, summer: 1, playoffs: 0.9, finale: 0.5, offseason: 1 })[ph.id];
  if (scale == null) scale = 0.5;
  Object.keys(S.contracts || {}).forEach(function (k) {
    var ci = J.contractInfo(S, k), h = J.happiness(S, k), info = byKey[k], c = S.contracts[k]; if (!ci) return;
    // a part-timer who really races for points in another series (Zilisch running a few Trucks) is not a ride candidate here, and nobody
    // shown as a call-up is either; the Silly Season page is about the people whose seat is actually in play
    if (J.isPT(S, k) && (c.callup || (c.home && c.home !== S.series.id))) return;
    var ev = info && info.d.starts ? Math.min(1, info.d.starts / 6) : 0, real = c.real || null;
    var p0 = ({ free: 0.5, expiring: 0.14, short: 0.04, long: 0.015 })[ci.status] || 0.02, why = [];
    var p = ci.status === 'free' ? p0 * Math.max(scale, 0.7) : p0 * scale;
    if (real && real.kind === 'retain') { p = Math.min(p, 0.03); why.push('announced to return in ' + real.through); }
    else if (real && (real.kind === 'move' || real.kind === 'retire')) { var reveal = Math.max(0, Math.min(1, (scale - 0.2) / 0.8)); p += (real.unconf ? 0.2 : 0.4) * reveal; if (reveal > 0.3) why.push(real.kind === 'retire' ? 'retirement is a real possibility' : 'a real-world move is expected' + (real.to && reveal > 0.6 ? ' (' + real.to + ')' : '')); }
    if (J.isPT(S, k)) { p += 0.03 * scale; why.push('part-time, so full-time offers are possible'); if (info && info.d.starts >= 3 && info.d.fin / info.d.starts < 12) { p += 0.1 * scale * ev; why.push(info.d.fin / info.d.starts < 8 ? 'running up front in limited starts' : 'solid in limited starts'); } }
    if (ci.status === 'expiring' && ph.id !== 'preseason') why.push('contract runs out after ' + ci.through);
    if (h && h.score < 50 && ev >= 0.5) { p += (50 - h.score) / 100 * ev * scale; why.push(h.label.toLowerCase() + ' with the team'); }
    var sl = (S.silly || []).filter(function (x) { return (x.drivers || []).some(function (n) { return J.driverKey(n) === k; }); }).pop();
    if (sl) { p += J.STAGE_WEIGHT[sl.stage] || 0; why.push('in the rumor mill: ' + J.SILLY_LABEL[sl.stage].toLowerCase()); }
    var team = ci.team, teamRank = team ? (function () { var ks = J.teamDrivers(S, team.id), best = 99; ks.forEach(function (x) { if (byKey[x] && byKey[x].rank < best && x !== k) best = byKey[x].rank; }); return best; })() : 99;
    if (info && info.d.starts >= 6 && info.rank <= 8 && teamRank > 15) { p += 0.1 * scale; why.push('a top driver on a smaller team'); }
    var mv = (S.moves || []).filter(function (m) { return m.key === k && (m.status === 'approved' || m.status === 'done') && m.kind !== 'renew'; }).pop();
    if (mv) { p = 1; why.unshift(J.moveLine ? J.moveLine(mv, S) : 'deal done'); }
    else if ((S.moves || []).some(function (m) { return m.key === k && m.status === 'approved' && m.kind === 'renew'; })) { p = 0.02; why.unshift('re-signed'); }
    p = Math.max(0.01, Math.min(sl && sl.stage === 'confirmed' || mv ? 1 : 0.9, p));
    var avg = info && info.d.starts ? info.d.fin / info.d.starts : null;
    out.push({ owner: J.isOwnerDriver(S, k), avg: avg, wins: info ? info.d.wins : 0, starts: info ? info.d.starts : 0, move: mv || null, pt: J.isPT(S, k), key: k, name: info ? info.d.name : (S.contracts[k].name || k), car: (S.contracts[k].car || (info && info.d.car) || ''), team: team, p: p, why: why, contract: ci, happy: h, rank: info ? info.rank : null, storyline: sl || null });
  });
  out.sort(function (a, b) { return b.p - a.p; });
  if (quick) return out;
  // top 3 landing spots: open seats in this series, the series above (strong drivers) and below (struggling ones)
  var here = J.openSeats(S, out), field = Math.max(20, ds.length), mid = field * 0.5;
  out.forEach(function (x) {
    if (x.move) { x.spots = [{ label: J.moveDest ? J.moveDest(x.move, S) : 'done deal', pct: 100, sid: x.move.to }]; x.dest = [x.spots[0].label]; return; }
    if (x.p < 0.15 || ph.id === 'preseason') { x.spots = []; x.dest = []; return; } // no landing-spot lists for people who are not really moving
    var avg = x.avg != null ? x.avg : mid, strong = Math.max(0, Math.min(1, (field * 0.45 - avg) / (field * 0.35))) + (x.rank && x.rank <= 3 ? 0.4 : 0) + Math.min(0.6, (x.wins || 0) * 0.2);
    if (x.pt && x.avg != null && x.avg < 10) strong += 0.3;
    var weak = Math.max(0, Math.min(1, (avg - field * 0.6) / (field * 0.3)));
    var opts = [];
    here.forEach(function (s) { if (x.team && s.teamId === x.team.id) return; if (x.owner) return; if (J.driverKey(s.from || '') === x.key) return; var fit = 1 / (1 + Math.abs((s.q != null ? s.q : mid) - avg) / 8); opts.push({ label: s.team + (s.car ? ' #' + s.car : ''), w: fit * (s.ptcar ? 0.7 : 1), sid: S.series.id }); });
    if (x.pt && x.team) opts.push({ label: x.team.name + ' #' + (x.car || '') + ' full-time', w: 0.9 + strong * 0.6, sid: S.series.id });
    if (x.owner) x.p = Math.min(x.p, 0.08);
    if (cross && cross.upSeats && !x.owner) cross.upSeats.forEach(function (s) { if (strong > 0.35) opts.push({ label: s.team + (s.car ? ' #' + s.car : '') + ' (' + s.short + ')', w: strong * 1.3 / (1 + (s.q != null ? s.q / 25 : 0.6)), sid: s.sid }); });
    if (cross && cross.downSeats && !x.owner) cross.downSeats.forEach(function (s) { if (weak > 0.3) opts.push({ label: s.team + (s.car ? ' #' + s.car : '') + ' (' + s.short + ')', w: weak * 0.8, sid: s.sid }); });
    if (x.storyline && x.storyline.stage !== 'dead' && x.storyline.team) { var hit = opts.filter(function (o) { return o.label.toLowerCase().indexOf(String(x.storyline.team).toLowerCase()) === 0; }); if (hit.length) hit.forEach(function (o) { o.w += 2; }); else opts.push({ label: x.storyline.team, w: 2, sid: S.series.id }); }
    var seen = {}; opts = opts.filter(function (o) { if (seen[o.label]) return false; seen[o.label] = 1; return true; }).sort(function (a, b) { return b.w - a.w; });
    var W = opts.reduce(function (a, o) { return a + o.w; }, 0) || 1;
    x.spots = opts.slice(0, 3).map(function (o) { return { label: o.label, sid: o.sid, pct: Math.max(1, Math.round(x.p * 100 * o.w / W)) }; });
    x.dest = x.spots.map(function (o) { return o.label; });
    if (!x.dest.length && cross && cross.up) x.dest = ['a ride in the ' + cross.up];
  });
  return out;
};
// seats likely to open next season in this series: drivers likely to leave, approved moves out, part-time cars that could go full-time
J.openSeats = function (S, preds) {
  preds = preds || J.sillyPredictions(S, null, true);
  var ds = J.agg(S.races), avgOf = function (k) { var d = ds.find(function (x) { return x.key === k; }); return d && d.starts ? d.fin / d.starts : null; };
  var teamQ = function (tid) { var a = J.teamDrivers(S, tid).map(avgOf).filter(function (v) { return v != null; }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; };
  var out = [], seen = {};
  var add = function (tid, car, from, ptcar) { var t = S.teams && S.teams[tid]; if (!t) return; var id = tid + '#' + car; if (seen[id]) return; seen[id] = 1; out.push({ teamId: tid, team: t.name, car: car || '', from: from || '', q: teamQ(tid), ptcar: !!ptcar, sid: S.series.id, short: ({ cup: 'Cup', xfinity: "O'Reilly", truck: 'Trucks', arca: 'ARCA' })[S.series.id] || S.series.short || S.series.label }); };
  preds.forEach(function (x) { if (x.team && !x.pt && x.p >= 0.35) add(x.team.id, x.car, x.name); });
  (S.moves || []).forEach(function (m) { if ((m.status === 'approved' || m.status === 'done') && m.from === S.series.id && m.to !== S.series.id && m.fromTeamId) add(m.fromTeamId, m.fromCar, m.name); });
  var groups = {}; Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (!c.team || !c.car || c.callup) return; var g = groups[c.team + '#' + c.car] = groups[c.team + '#' + c.car] || { tid: c.team, car: c.car, ft: false }; if (!c.pt) g.ft = true; });
  Object.keys(groups).forEach(function (g) { if (!groups[g].ft) add(groups[g].tid, groups[g].car, '', true); });
  return out.sort(function (a, b) { return (a.q == null ? 99 : a.q) - (b.q == null ? 99 : b.q); });
};
// stars of the other series (for cross-series rumors): best average finish with 2+ starts
J.seriesStars = function (S, n) {
  return J.agg(S.races).filter(function (d) { return d.starts >= 2; }).map(function (d) { return { name: d.name, car: d.car, wins: d.wins, avg: d.fin / d.starts, pts: d.pts }; }).sort(function (a, b) { return a.avg - b.avg; }).slice(0, n || 5);
};
J.LADDER = ['arca', 'truck', 'xfinity', 'cup'];
// The other series in this league family (the app knows all of them; the website gets a summary baked in when publishing)
J.crossCompute = function (S) {
  if (!J.leagues) return null;
  var i = J.LADDER.indexOf(S.series.id), cur = function (id) { return J.leagues[id] && !J.leagues[id].archived ? J.leagues[id] : null; };
  var down = i > 0 ? cur(J.LADDER[i - 1]) : null, up = i >= 0 && i < J.LADDER.length - 1 ? cur(J.LADDER[i + 1]) : null;
  var heads = [];
  J.SERIES_ORDER.forEach(function (id) { var L = cur(id); if (!L || L.series.id === S.series.id) return; L.articles.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 2).forEach(function (a) { heads.push({ series: L.series.label, sid: id, headline: a.headline, outlet: a.outlet, ts: a.ts }); }); });
  heads.sort(function (a, b) { return b.ts - a.ts; });
  var drivers = {};
  J.roster(S).forEach(function (d) { J.SERIES_ORDER.forEach(function (id) { var L = cur(id); if (!L || L.series.id === S.series.id) return; var ds = J.agg(L.races), x = ds.find(function (q) { return q.key === d.key; }); if (x) (drivers[d.key] = drivers[d.key] || []).push({ series: L.series.label, line: 'P' + (ds.indexOf(x) + 1) + ' in points, ' + J.plural(x.wins, 'win') + ' in ' + J.plural(x.starts, 'start') }); }); });
  return { down: down ? down.series.id : '', downLabel: down ? down.series.label : '', stars: down ? J.seriesStars(down, 5) : [], up: up ? up.series.label : '', upOpen: up ? J.sillyPredictions(up, null, true).filter(function (x) { return x.p >= 0.35 && x.team && !x.pt; }).slice(0, 4).map(function (x) { return { team: x.team.name, from: x.name }; }) : [], upSeats: up ? J.openSeats(up).slice(0, 8) : [], downSeats: down ? J.openSeats(down).slice(0, 6) : [], headlines: heads.slice(0, 6), drivers: drivers };
};
J.crossFor = function (S) { return S.cross || J.crossCompute(S); };
J.otherSeriesFor = function (S, name) { var c = J.crossFor(S); return (c && c.drivers && c.drivers[J.driverKey(name)]) || []; };
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
  var ds = J.standings(S), size = S.chase.size, total = Math.max(S.schedule.length, S.races.length);
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
function cacheKey(S, tag) { var last = S.races[S.races.length - 1], sig = J.hash(Object.keys(S.contracts || {}).filter(function (k) { return S.contracts[k].pt; }).join(',')) % 9973; S.races.forEach(function (r) { r.rows.forEach(function (x) { sig = (sig * 31 + (x.points || 0) * 7 + x.position + J.hash(x.driver) % 997) % 2147483647; }); }); return tag + '|' + sig + '|' + S.races.map(function (r) { return r.sid; }).join(',') + '|' + S.schedule.map(function (r) { return r.id; }).join(',') + '|' + (last ? last.id : '') + '|' + S.schedule.length + '|' + S.chase.size + '|' + S.chase.regularRaces + '|' + S.chase.winLocks + '|' + S.schedule.map(function (r) { return r.type; }).join(''); }
var CACHE = {};
/* ---------- when odds are allowed to exist ----------
   Real media do not publish title odds after two races. Chase odds start once there is a small sample (default race 5), title
   odds once there is a decent one (default race 10, or halfway on a short schedule), and until the sample is big the numbers are
   pulled toward "everyone is equal" (conf 0 = equal odds, 1 = the raw simulation). S.oddsGate = { chase, title } overrides. */
J.oddsGate = function (S) {
  var total = Math.max(S.schedule.length, S.races.length) || 1, played = S.races.length, g = S.oddsGate || {};
  var chaseFrom = g.chase != null ? Math.max(0, +g.chase) : Math.min(5, Math.ceil(total / 4));
  var titleFrom = g.title != null ? Math.max(0, +g.title) : Math.min(10, Math.ceil(total / 2));
  var cut = Math.min(S.chase.regularRaces, total), decided = played >= cut;
  var conf = decided ? 1 : Math.max(0, Math.min(1, (played - 2) / Math.max(6, cut * 0.65 - 2)));
  return { played: played, total: total, chaseFrom: chaseFrom, titleFrom: titleFrom, conf: conf,
    chase: decided || played >= titleFrom ? 'full' : played >= chaseFrom ? 'early' : 'none',
    title: played >= titleFrom + 4 || decided ? 'full' : played >= titleFrom ? 'early' : 'none' };
};
J.simulateSeason = function (S, N) {
  var key = cacheKey(S, 'season') + '|' + JSON.stringify(S.oddsGate || ''); if (CACHE[key]) return CACHE[key];
  N = N || 2500;
  var D = J.ratings(S), arr = Object.keys(D).map(function (k) { return D[k]; }).filter(function (d) { return !J.isPT(S, d.key); }); // part-timers can't win the title
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
  var gate = J.oddsGate(S), conf = cutAt <= played ? 1 : gate.conf, priorChase = Math.min(1, S.chase.size / n), priorChamp = 1 / n;
  var out = arr.map(function (d, i) {
    var a = acc[i], r = a.ranks.slice().sort(function (x, y) { return x - y; }), ag0 = ag[d.key] || { fin: 0, starts: 0, pts: 0, wins: 0 };
    var nFin = ag0.starts + (a.finN / N);
    return {
      key: d.key, name: d.name, car: d.car, curPts: ag0.pts || 0, curWins: ag0.wins || 0, starts: ag0.starts || 0,
      chaseOdds: priorChase + conf * (a.chase / N - priorChase), rawChase: a.chase / N, projPts: a.pts / N, projWins: a.wins / N, champOdds: priorChamp + conf * (a.champ / N - priorChamp), rawChamp: a.champ / N,
      rankMed: r[Math.floor(N / 2)], rankLo: r[Math.floor(N * 0.1)], rankHi: r[Math.floor(N * 0.9)],
      projAvg: nFin ? ((ag0.fin || 0) + a.fin / N) / nFin : 0, skill: d.skill, overall: d.overall, byType: d.byType
    };
  });
  var res = { N: N, drivers: out, cutAt: cutAt, played: played, remaining: remaining.length, size: S.chase.size, decided: cutAt <= played, gate: gate };
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
// Auto-sim one race from the season so far (track-type form, practice/qualifying, wreck risk). Returns result rows like an import.
J.simRace = function (S, round, seed) {
  var T = round.type || J.guessType(round.track || round.name), D = J.ratings(S), sb = J.sessionBoost(S, round.id, T);
  var field = {}; J.sessionsFor(S, round.id).forEach(function (x) { x.rows.forEach(function (r) { field[J.driverKey(r.driver)] = r; }); });
  J.roster(S).forEach(function (d) { if (!D[d.key]) { var sk = {}; J.TYPE_KEYS.forEach(function (t) { sk[t] = 0.42; }); D[d.key] = { key: d.key, name: d.name, car: d.car, n: 0, overall: 0.42, skill: sk, dnfRate: 0.08, byType: {} }; } });
  var arr = Object.keys(D).map(function (k) { return D[k]; });
  if (Object.keys(field).length >= 10) arr = arr.filter(function (d) { return field[d.key]; });
  else { var last = S.races[S.races.length - 1], n = last ? last.rows.length : 38; arr.sort(function (a, b) { return b.n - a.n || b.overall - a.overall; }); arr = arr.slice(0, Math.max(n, Math.min(arr.length, 36))); }
  if (arr.length < 3) return null;
  arr.forEach(function (d) { d.boost = sb.boost[d.key] || 0; var c = S.contracts && S.contracts[d.key]; if (c && c.car) d.car = c.car; });
  var rand = J.rng('sim' + S.id + round.id + (seed || Date.now())), res = simOne(arr, T, rand);
  var LAPS = { super: 188, inter: 200, short: 300, road: 70, unique: 200 }, sameTrack = S.races.filter(function (r) { return r.track && r.track === round.track; }).pop();
  var laps = sameTrack && sameTrack.rows[0] && sameTrack.rows[0].laps ? sameTrack.rows[0].laps : LAPS[T];
  var q = J.sessionOf(S, round.id, 'qualifying'), qpos = {}; if (q) q.rows.forEach(function (r) { qpos[J.driverKey(r.driver)] = r.position; });
  var starts = arr.map(function (d, i) { return { i: i, z: qpos[d.key] ? -qpos[d.key] : (d.skill[T] - 0.5) * 3 + gauss(rand) * 1.2 }; }).sort(function (a, b) { return qpos[arr[a.i].key] || qpos[arr[b.i].key] ? a.z < b.z ? 1 : -1 : b.z - a.z; });
  var startOf = {}; starts.forEach(function (s, p) { startOf[s.i] = qpos[arr[s.i].key] || p + 1; });
  // laps led: the front runners share most of them, the winner usually the most
  var ledPool = res.slice(0, 8).filter(function (o) { return !o.dnf; }), w = ledPool.map(function (o, p) { return Math.max(0.05, Math.exp(o.z / 1.4) * (p === 0 ? 1.8 : 1)); }), wt = w.reduce(function (a, b) { return a + b; }, 0), led = {}, left = laps;
  ledPool.forEach(function (o, p) { var x = p === ledPool.length - 1 ? left : Math.round(laps * w[p] / wt); x = Math.min(x, left); led[o.i] = x; left -= x; });
  var STAT = ['Accident', 'Accident', 'Accident', 'Engine', 'DVP', 'Suspension', 'Transmission', 'Overheating'];
  var rows = res.map(function (o, p) {
    var d = arr[o.i], lapsDone = o.dnf ? Math.max(1, Math.floor(laps * (0.05 + rand() * 0.9))) : p < 18 ? laps : laps - Math.floor(Math.max(0, (p - 14) / 7 + rand() * 1.4));
    var interval = p === 0 ? '' : o.dnf ? '' : lapsDone < laps ? '-' + (laps - lapsDone) + ' lap' + (laps - lapsDone > 1 ? 's' : '') : '-' + (p * 0.35 + rand() * 1.2).toFixed(3);
    return { position: p + 1, start: startOf[o.i], driver: d.name, car: d.car || '', team: '', laps: lapsDone, lapsLed: led[o.i] || 0, status: o.dnf ? J.pick(rand, STAT) : 'Running', interval: interval };
  });
  // a DNF can't finish ahead of a running car
  var run = rows.filter(function (r) { return r.status === 'Running'; }), out = rows.filter(function (r) { return r.status !== 'Running'; }).sort(function (a, b) { return b.laps - a.laps; });
  rows = run.concat(out).map(function (r, i) { r.position = i + 1; return r; });
  return { rows: rows, laps: laps, cautions: Math.round((T === 'super' ? 9 : T === 'short' ? 10 : T === 'road' ? 4 : 7) * (0.5 + rand())), simmed: true };
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
  var ds = J.standings(S), pop = {}; ds.slice(0, 12).forEach(function (d) { pop[d.key] = 1; });
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
// Keep the Garage a sensible size: the newest `max` threads, plus up to 3 per story (so older stories keep their reactions)
J.trimThreads = function (S, max, fresh) {
  var ths = J.threadsOf(S); if (ths.length <= max) return;
  var keep = {}, per = {}, arts = {}; S.articles.forEach(function (a) { arts[a.id] = 1; });
  (fresh || []).forEach(function (t) { keep[t] = 1; });
  ths.forEach(function (t, i) {
    var a = t.ref && t.ref.type === 'article' && arts[t.ref.id] ? t.ref.id : null;
    if (a) per[a] = (per[a] || 0) + 1;
    if (i < max || (a && per[a] <= 3)) keep[t.id] = 1;
  });
  S.posts = S.posts.filter(function (p) { return keep[p.thread]; });
};
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
  if (p.by.type === 'figure') { var f = J.FIGURES[p.by.id]; return f ? { figure: true, id: p.by.id, name: f.name, handle: f.handle, badge: f.badge, color: f.color } : null; }
  var fan = S.fans.find(function (x) { return x.id === p.by.id; }); if (!fan) return null;
  return { figure: false, fan: fan, name: fan.name || fan.handle, handle: (fan.platform === 'forum' ? 'u/' : '@') + fan.handle, color: fan.color || '#5b6a86' };
};
J.likesFor = function (p, isFigure) {
  var r = J.rng('likes' + p.id), base = isFigure ? 300 + Math.floor(r() * 4200) : (p.parent ? 1 + Math.floor(Math.pow(r(), 2.2) * 90) : 4 + Math.floor(Math.pow(r(), 2) * 220));
  return base;
};

/* ---------- plain (no-AI) recap so News is never empty ---------- */
J.autoRecap = function (S, race) {
  var info = J.raceInfo(race), w = info.winner, ds = J.standings(S), L = ds[0], R = ds[1], paras = [];
  paras.push(w.driver + ' won ' + race.name + (race.track ? ' at ' + race.track : '') + ', starting P' + (w.start || '?') + (w.lapsLed ? ' and leading ' + w.lapsLed + ' laps' : '') + '. ' + (info.rows[1] ? info.rows[1].driver + ' finished second' + (info.rows[2] ? ' and ' + info.rows[2].driver + ' was third' : '') + '.' : ''));
  var bits = []; if (info.cautions != null) bits.push(info.cautions + ' caution' + (info.cautions === 1 ? '' : 's')); if (info.leadChanges != null) bits.push(info.leadChanges + ' lead changes' + (info.leadDrivers ? ' among ' + info.leadDrivers + ' drivers' : ''));
  if (bits.length) paras.push('The race ran ' + (info.laps ? info.laps + ' laps with ' : 'with ') + bits.join(' and ') + '.');
  if (info.mover && info.mover.gain >= 8) paras.push(info.mover.row.driver + ' was the biggest mover, gaining ' + info.mover.gain + ' spots from P' + info.mover.row.start + ' to P' + info.mover.row.position + '.');
  if (info.poleRow) paras.push('Pole sitter ' + info.poleRow.driver + ' finished P' + info.poleRow.position + (J.isDnf(info.poleRow) ? ' (' + info.poleRow.status + ')' : '') + '.');
  if (L) paras.push(L.name + ' leads the championship with ' + L.pts + ' points' + (R ? ', ' + (L.pts - R.pts) + ' ahead of ' + R.name : '') + '.');
  return { id: J.uid('a'), outlet: 'wire', auto: true, headline: w.driver + ' wins ' + race.name, dek: 'Official finish, points and how the championship looks after the race.', body: paras.join('\n\n'), author: J.OUTLETS.wire.staff[0], ts: J.storyTime(S, 'recap', { race: race }) - 10 * 60000, raceId: race.id, tags: [w.driver], media: [] };
};

/* ---------- what actually gets published ---------- */

/* ---------- Power Rankings ----------
   Like a weekly AP poll: before the season it is the drivers' REAL-life form (last real points finish, team strength); once races
   are run the league's own results mix in. Part-timers are never ranked. Every number comes from a formula the commissioner can
   edit (S.power.cfg); each week is recomputed from the data, so changing the formula rewrites the whole history consistently.
   Weekly stability: each week's score is blended with last week's so one race cannot send anyone flying. */
J.POWER_STATS = [
  { id: 'rlRank', grp: 'real', label: 'Real points finish', hint: 'Where the driver really finished in the last real standings', w: 6 },
  { id: 'rlTeam', grp: 'real', label: 'Real team strength', hint: 'How strong the real team is (its drivers\' real finishes)', w: 3 },
  { id: 'avg', grp: 'game', label: 'Average finish', hint: 'Average finishing position in this league', w: 6 },
  { id: 'wins', grp: 'game', label: 'Wins', hint: 'Wins per start', w: 5 },
  { id: 'top5', grp: 'game', label: 'Top 5 rate', hint: 'Share of starts that ended in the top 5', w: 3 },
  { id: 'top10', grp: 'game', label: 'Top 10 rate', hint: 'Share of starts that ended in the top 10', w: 3 },
  { id: 'pts', grp: 'game', label: 'Points standing', hint: 'Position in the points', w: 5 },
  { id: 'led', grp: 'game', label: 'Laps led', hint: 'Laps led per start', w: 2 },
  { id: 'poles', grp: 'game', label: 'Poles', hint: 'Poles per start', w: 1 },
  { id: 'dnf', grp: 'game', label: 'Staying out of trouble', hint: 'Fewer DNFs is better', w: 2 },
  { id: 'form', grp: 'game', label: 'Recent form', hint: 'Average finish over the last 5 races', w: 3 }
];
J.POWER_DEFAULT = function () {
  var w = {}; J.POWER_STATS.forEach(function (x) { w[x.id] = x.w; });
  return { w: w, mode: 'blend', real: 60, rampFrom: 90, rampTo: 40, rampRaces: 16, calm: 35, shrink: 3 };
};
J.powerCfg = function (S) {
  var d = J.POWER_DEFAULT(), c = (S.power && S.power.cfg) || {}, out = { w: {} };
  Object.keys(d).forEach(function (k) { if (k !== 'w') out[k] = c[k] != null ? c[k] : d[k]; });
  J.POWER_STATS.forEach(function (x) { out.w[x.id] = c.w && c.w[x.id] != null ? Math.max(0, +c.w[x.id]) : d.w[x.id]; });
  return out;
};
J.POWER_MODES = { blend: 'Mix real life and the league', real: 'Real life only', game: 'League results only', ramp: 'Fade real life out over the season' };
// how much of the score is real life after n races
J.powerRealShare = function (cfg, n) {
  if (!n || cfg.mode === 'real') return 1; if (cfg.mode === 'game') return 0;
  if (cfg.mode === 'ramp') { var t = Math.min(1, n / Math.max(1, cfg.rampRaces)); return (cfg.rampFrom + (cfg.rampTo - cfg.rampFrom) * t) / 100; }
  return cfg.real / 100;
};
function pctOf(vals, v, higher) { // 0..1 position among the field (ties share)
  var less = 0, eq = 0; vals.forEach(function (x) { if (x === v) eq++; else if (higher ? x < v : x > v) less++; });
  return vals.length <= 1 ? 0.5 : (less + (eq - 1) / 2) / (vals.length - 1);
}
J.powerField = function (S) { // who gets ranked: full-time drivers only
  var seen = {}, out = [];
  var add = function (k, name) { if (seen[k] || J.isPT(S, k)) return; var c = (S.contracts || {})[k]; if (c && (c.released || c.callup)) return; seen[k] = 1; out.push({ key: k, name: name || (c && c.name) || k }); };
  J.standings(S).forEach(function (d) { add(d.key, d.name); });
  Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (c && c.name && !c.pt && !c.extra) add(k, c.name); });
  return out;
};
J.powerWeek = function (S, n, cfg, prev) {
  var field = J.powerField(S), races = S.races.slice(0, n), ag = J.agg(races), byK = {}; ag.forEach(function (d) { byK[d.key] = d; });
  var rl = {}, teamRl = {};
  field.forEach(function (f) { var c = (S.contracts || {})[f.key]; rl[f.key] = c && c.rl && c.rl.s != null ? c.rl.s : null; });
  Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (!c || !c.team || c.pt || c.released || rl[k] == null) return; (teamRl[c.team] = teamRl[c.team] || []).push(rl[k]); });
  var pop = field.filter(function (f) { return byK[f.key] && byK[f.key].starts > 0; }).map(function (f) { return byK[f.key]; });
  var rank = {}; ag.filter(function (d) { return !J.isPT(S, d.key); }).forEach(function (d, i) { rank[d.key] = i + 1; });
  var vals = { avg: [], wins: [], top5: [], top10: [], led: [], poles: [], dnf: [], form: [] };
  var f5 = function (d) { var h = d.hist.slice(-5); return h.reduce(function (a, x) { return a + x.pos; }, 0) / Math.max(1, h.length); };
  pop.forEach(function (d) { vals.avg.push(d.avg); vals.wins.push(d.wins / d.starts); vals.top5.push(d.t5 / d.starts); vals.top10.push(d.t10 / d.starts); vals.led.push(d.led / d.starts); vals.poles.push(d.poles / d.starts); vals.dnf.push(d.dnf / d.starts); vals.form.push(f5(d)); });
  var a = J.powerRealShare(cfg, n), rows = field.map(function (f) {
    var c = (S.contracts || {})[f.key] || {}, d = byK[f.key], w = cfg.w, num = 0, den = 0, gn = 0, gd = 0, st = {};
    // real life
    if (rl[f.key] != null) { st.rlRank = rl[f.key]; num += w.rlRank * st.rlRank; den += w.rlRank; }
    var tr = c.team && teamRl[c.team]; if (tr && tr.length) { st.rlTeam = tr.reduce(function (x, y) { return x + y; }, 0) / tr.length; num += w.rlTeam * st.rlTeam; den += w.rlTeam; }
    var R = den > 0 ? num / den : 0.4;
    // this league
    var G = R, k = 0;
    if (d && d.starts) {
      var g = { avg: pctOf(vals.avg, d.avg, false), wins: pctOf(vals.wins, d.wins / d.starts, true), top5: pctOf(vals.top5, d.t5 / d.starts, true), top10: pctOf(vals.top10, d.t10 / d.starts, true), led: pctOf(vals.led, d.led / d.starts, true), poles: pctOf(vals.poles, d.poles / d.starts, true), dnf: pctOf(vals.dnf, d.dnf / d.starts, false), form: pctOf(vals.form, f5(d), false), pts: rank[f.key] ? 1 - (rank[f.key] - 1) / Math.max(1, Object.keys(rank).length - 1) : 0.5 };
      J.POWER_STATS.forEach(function (x) { if (x.grp === 'game' && w[x.id] > 0) { gn += w[x.id] * g[x.id]; gd += w[x.id]; } });
      if (gd > 0) { k = d.starts / (d.starts + Math.max(0, cfg.shrink)); G = k * (gn / gd) + (1 - k) * R; }
    }
    var raw = a * R + (1 - a) * G, calm = Math.max(0, Math.min(0.85, cfg.calm / 100)), pv = prev && prev[f.key] != null ? prev[f.key] : null;
    var score = pv == null ? raw : calm * pv + (1 - calm) * raw;
    return { key: f.key, name: f.name, car: c.car || (d && d.car) || '', team: c.team && S.teams && S.teams[c.team] ? S.teams[c.team].name : '', score: score, raw: raw, R: R, G: G, a: a, k: k,
      starts: d ? d.starts : 0, wins: d ? d.wins : 0, t5: d ? d.t5 : 0, t10: d ? d.t10 : 0, avg: d && d.starts ? d.avg : null, pts: d ? d.pts : 0, rl: c.rl || null };
  });
  rows.sort(function (x, y) { return y.score - x.score || y.raw - x.raw || x.name.localeCompare(y.name); });
  rows.forEach(function (r, i) { r.rank = i + 1; });
  return rows;
};
// every week from the preseason list to now: [{ n, label, rows }], each row has prev rank and movement
J.powerHistory = function (S) {
  var cfg = J.powerCfg(S), key = 'power|' + cacheKey(S, 'p') + '|' + JSON.stringify(cfg) + '|' + Object.keys(S.contracts || {}).map(function (k) { var c = S.contracts[k]; return k + (c.pt ? 'p' : '') + (c.rl ? Math.round(c.rl.s * 100) : ''); }).join(','); if (CACHE[key]) return CACHE[key];
  var weeks = [], prev = null, prevRank = null;
  for (var n = 0; n <= S.races.length; n++) {
    var rows = J.powerWeek(S, n, cfg, prev); prev = {}; rows.forEach(function (r) { prev[r.key] = r.score; });
    rows.forEach(function (r) { r.prevRank = prevRank ? (prevRank[r.key] || null) : null; r.move = r.prevRank ? r.prevRank - r.rank : null; });
    prevRank = {}; rows.forEach(function (r) { prevRank[r.key] = r.rank; });
    var race = n ? S.races[n - 1] : null; weeks.push({ n: n, label: n ? 'After ' + (race.name || 'race ' + n) : 'Preseason', rows: rows });
  }
  CACHE[key] = weeks; return weeks;
};

J.publicData = function (S) {
  var o = JSON.parse(JSON.stringify(S, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }));
  o.media = (o.media || []).filter(function (m) { return m.published; });
  o.moves = (o.moves || []).filter(function (m) { return m.status === 'approved' || m.status === 'done'; });
  o.callups = (o.callups || []).filter(function (m) { return m.status === 'approved'; });
  delete o.carWeek; if (o.art) delete o.art.orig;
  return o;
};

/* ---------- navigation registry (views.js + admin.js fill these) ---------- */
J.routes = {}; J.nav = []; J.acts = {};
})();
