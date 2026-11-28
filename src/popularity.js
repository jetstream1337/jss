/* Virtual NASCAR - popularity, hatred and fan chatter that do not need an AI key.
   - J.repRace: every race moves each driver's reputation by what he actually did (win, podium, top 5, pole, laps led,
     comebacks, wrecks, bad days, streaks, droughts ending). One combined event per driver per race, so the log reads well.
   - J.repSeason: season awards (champion, podium) and a pull back toward neutral so a new year is a fresh start.
   - J.fanbase: realistic fan / hater numbers for a driver (thousands, not a handful of accounts).
   - J.localChatter: a few fan threads per race written from templates, so simmed seasons are never silent. */
(function () {
'use strict';
var J = window.JSS;

/* ---------- reputation from what happened on track ---------- */
J.REP_PTS = { win: 6, second: 3, third: 3, top5: 2, top10: 1, pole: 1, ledMost: 2, led: 1, comeback15: 3, comeback10: 2, dnf: -2, wreckEarly: -3, bust: -2, last5: -1, streak5: 2, drought: 3, firstWin: 4, dominance: 2 };
function prior(S, race) {
  var idx = S.races.indexOf(race); if (idx < 0) idx = S.races.length;
  var by = {};
  S.races.slice(0, idx).forEach(function (r) {
    r.rows.forEach(function (x) { var k = J.driverKey(x.driver), d = by[k] || (by[k] = { pos: [], wins: 0, lastWin: -1 }); d.pos.push(x.position); if (x.position === 1) { d.wins++; d.lastWin = d.pos.length - 1; } });
  });
  return by;
}
// what one driver earned in one race: { delta, parts: [text...] }
J.repEvents = function (S, race) {
  var info = J.raceInfo(race), P = J.REP_PTS, by = prior(S, race), n = info.rows.length, laps = info.laps || 0, out = [];
  var otherSeasons = {}; Object.keys(J.leagues || {}).forEach(function (id) { var L = J.leagues[id]; if (L === S || !L.races) return; L.races.forEach(function (r) { r.rows.forEach(function (x) { if (x.position === 1) otherSeasons[J.driverKey(x.driver)] = 1; }); }); });
  info.rows.forEach(function (r) {
    var k = J.driverKey(r.driver), h = by[k] || { pos: [], wins: 0, lastWin: -1 }, pts = 0, parts = [], pos = r.position, st = r.start || 0, dnf = J.isDnf(r);
    var add = function (v, t) { pts += v; parts.push(t + ' (' + (v > 0 ? '+' : '') + v + ')'); };
    if (pos === 1) {
      add(P.win, 'won');
      if (!h.wins && !otherSeasons[k]) add(P.firstWin, 'first career win');
      else if (h.pos.length >= 8 && h.wins && h.pos.length - 1 - h.lastWin >= 8) add(P.drought, 'ended a ' + (h.pos.length - 1 - h.lastWin) + '-race winless run');
      if (laps && r.lapsLed >= laps * 0.5) add(P.dominance, 'led ' + r.lapsLed + ' laps');
      var recent = h.pos.slice(-4); if (recent.filter(function (p) { return p === 1; }).length >= 2) add(1, 'winning again and again');
    } else if (pos === 2) add(P.second, 'finished second');
    else if (pos === 3) add(P.third, 'finished third');
    else if (pos <= 5) add(P.top5, 'top 5');
    else if (pos <= 10) add(P.top10, 'top 10');
    if (pos !== 1 && laps && r.lapsLed >= laps * 0.35) add(P.ledMost, 'led ' + r.lapsLed + ' laps');
    else if (pos !== 1 && r.lapsLed >= 20) add(P.led, 'led ' + r.lapsLed + ' laps');
    if (info.poleName && info.poleName.toLowerCase() === String(r.driver).toLowerCase()) add(P.pole, 'won the pole');
    if (!dnf && st && st - pos >= 15 && pos <= 12) add(P.comeback15, 'charged from P' + st + ' to P' + pos);
    else if (!dnf && st && st - pos >= 10 && pos <= 15) add(P.comeback10, 'came from P' + st + ' to P' + pos);
    if (dnf) {
      var early = laps && (r.laps || 0) < laps * 0.5;
      if (early && st && st <= 12) add(P.wreckEarly, 'wrecked out early (' + (r.status || 'out') + ')'); else add(P.dnf, 'did not finish (' + (r.status || 'out') + ')');
    } else if (st && st <= 5 && pos >= Math.max(22, n * 0.6)) add(P.bust, 'started P' + st + ' and finished P' + pos);
    else if (n >= 20 && pos > n - 5 && !(st && st > n - 8)) add(P.last5, 'finished near the back');
    var prev = h.pos.slice(-2); if (pos <= 5 && prev.length === 2 && prev[0] <= 5 && prev[1] <= 5) add(P.streak5, 'third straight top 5');
    if ((pos >= 25 || dnf) && prev.length === 2 && prev.every(function (p) { return p >= 25; })) add(-2, 'third bad day in a row');
    if (pts) out.push({ driver: r.driver, key: k, delta: Math.max(-10, Math.min(10, pts)), raw: pts, parts: parts, pos: pos });
  });
  return out;
};
J.repRace = function (S, race) {
  var evs = J.repEvents(S, race), n = 0;
  evs.forEach(function (e) {
    var why = e.parts.slice(0, 3).join(', ') + ' at ' + race.name;
    if (J.repApply(S, e.driver, e.delta, why.charAt(0).toUpperCase() + why.slice(1), 'track', race.id)) n++;
  });
  return n;
};
J.repSeason = function (S) {
  var ds = J.standings(S), bonus = [12, 7, 4, 2, 2];
  ds.slice(0, 5).forEach(function (d, i) { if (S.races.length >= 5) J.repApply(S, d.name, bonus[i], (i === 0 ? 'Won the ' : 'P' + (i + 1) + ' in the ') + J.seasonYear(S) + ' championship', 'track', ''); });
  Object.keys(S.rep || {}).forEach(function (k) { var r = S.rep[k]; r.score = Math.round(50 + (r.score - 50) * 0.8); r.events = (r.events || []).slice(0, 20); });
};

/* ---------- how many people like / hate a driver ---------- */
var SCALE = { cup: 1, xfinity: 0.26, truck: 0.16, arca: 0.05 };
function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
J.fmtCount = function (n) { n = Math.round(n); return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n); };
J.fanbase = function (S, key) {
  var sid = S.series.id, sc = SCALE[sid] || 0.1, c = (S.contracts || {})[key] || {}, ds = J.standings(S), me = ds.find(function (d) { return d.key === key; });
  var rank = me ? ds.indexOf(me) + 1 : 0, rankPct = me ? 1 - (rank - 1) / Math.max(1, ds.length - 1) : 0.35, wins = me ? me.wins : 0;
  var rating = Math.max(0.15, Math.min(1, (c.base || 60) / 100));
  var seasons = 0; Object.keys(J.leagues || {}).forEach(function (id) { var L = J.leagues[id]; if (L !== S && L.races && L.races.some(function (r) { return r.rows.some(function (x) { return J.driverKey(x.driver) === key; }); })) seasons++; });
  var I = 0.18 + 0.82 * (0.4 * rankPct + 0.25 * Math.min(1, wins / 4) + 0.25 * rating + 0.1 * Math.min(1, seasons / 5));
  var rep = J.repOf(S, key).score, jit = 0.8 + hash(key + sid) * 0.5;
  var total = 1100000 * sc * Math.pow(I, 1.7) * jit * (1 + Math.min(0.5, seasons * 0.06)); // people who care either way
  var fanShare = 0.12 + 0.76 * (rep / 100), hateShare = Math.max(0.03, (1 - fanShare) * 0.6);
  var fans = total * fanShare, haters = total * hateShare, sf = fans * (rep >= 62 ? 0.28 : 0.16), sh = haters * (rep < 40 ? 0.34 : 0.14);
  return { total: total, fans: fans - sf, superfans: sf, haters: haters - sh, superhaters: sh, rep: rep };
};

/* ---------- fan chatter without AI ---------- */
var T = {
  win: { pos: ['{n} WINS. {track}. Let\'s go!!', 'that is why you never count {n} out. what a drive', 'Called it. {n} had the best car all day and finally got the result', '{n} in victory lane and I am a mess right now', 'Take a bow, #{car}. Absolutely earned that one', '{n} started P{st} and still won. Special.'], neg: ['Fine, {n} won. Doesn\'t change what I think of him', 'Another {n} win, another day of hearing about it. Great', 'Lucky caution timing for {n} again and everyone acts like it was skill', 'Enjoy it, {n} fans. Won\'t last', '{n} wins, I log off. Wake me when someone else leads laps'], mix: ['{n} wins {race}. Nobody saw that coming at the start of the day', 'Strong run by {n}. Credit where it\'s due'] },
  second: { pos: ['P2 for {n}. So close, but we take it', '{n} had a win car and ran out of laps. Proud of this team', 'Ugh, {n} was right there. Next week'], neg: ['{n} second again. Always the bridesmaid', 'P2 and I bet we hear how "close" it was'] },
  comeback: { pos: ['{n} from P{st} to P{pos}. The man drove through the entire field', '{n} was on a mission today. P{st} to P{pos}!'], neg: ['{n} gaining spots because everyone ahead crashed. Let\'s not act like it was a masterclass', 'Charging from P{st} is great until you see who he went through to do it'] },
  dnf: { pos: ['That is so unfair to #{car}. {n} deserved better today', 'Gutted for {n} and the whole team. Shake it off', 'Not {n}\'s fault. Anyone saying otherwise didn\'t watch the replay'], neg: ['{n} out early. I am shocked, shocked', 'And {n} takes someone out or gets taken out. Always in the middle of it', 'Rough day for {n}. Couldn\'t happen to a nicer guy'], mix: ['{n} done for the day. {status}. That hurts the points'] },
  bust: { pos: ['Started P{st}, finished P{pos}. What happened to #{car}?? Something was off'], neg: ['{n} from P{st} to P{pos}. That is a collapse', 'All that qualifying speed and {n} still goes backwards. Classic'] },
  led: { pos: ['{n} led {led} laps and got nothing. That is racing, I guess', 'The #{car} was the class of the field for {led} laps. Hold your heads high'], neg: ['{n} led {led} laps and still finished P{pos}. Choked', 'Led all those laps for P{pos}. Impressive in the worst way'] },
  neutral: ['Good race at {track}. Lots of passing, not a ton of cautions', 'That finish was wild. Great show', 'Watched the whole thing. Pit strategy decided it', 'Tires fell off hard late. Whoever managed them won it', 'Lot of cars wrecked up front. Chaos at the end', 'Best race in weeks, honestly']
};
function fill(t, c) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return c[k] != null ? c[k] : ''; }); }
function style(text, fan, lv) {
  if (fan.age === 'teen' && Math.random() < 0.7) text = text.toLowerCase().replace(/\.$/, '');
  if (Math.abs(lv) === 2 && Math.random() < 0.5) text += lv > 0 ? ' 🔥' : ' 🙄';
  return text;
}
J.localChatter = function (S, race, o) {
  o = o || {};
  S.fans = S.fans || []; if (J.ai && J.ai.ensureFans) J.ai.ensureFans(S);
  if (!S.fans.length) return 0;
  var rand = J.rng('lchat' + race.id + S.posts.length), info = J.raceInfo(race), laps = info.laps || 0, added = 0, fresh = [];
  var pick = function (a) { return a[Math.floor(rand() * a.length)]; };
  var at = J.storyTime ? J.storyTime(S, 'recap', { race: race }) + 25 * 60000 : Date.now();
  var byDrv = {}; S.fans.forEach(function (f) { var st = f.stance; if (st && st.driver && st.level) (byDrv[st.driver] = byDrv[st.driver] || []).push(f); });
  var free = S.fans.filter(function (f) { return !(f.stance && f.stance.driver && f.stance.level); });
  var clock = at;
  var post = function (tid, parent, fan, text, plat) { clock += (1 + Math.floor(rand() * 5)) * 60000; var id = J.uid('p'); S.posts.push({ id: id, thread: tid, parent: parent, platform: plat || fan.platform || 'x', title: '', by: { type: 'fan', id: fan.id }, text: text, ts: clock, ref: { type: 'race', id: race.id } }); added++; return id; };
  var figPost = function (tid, fig, text) { clock += 2 * 60000; var id = J.uid('p'); S.posts.push({ id: id, thread: tid, parent: null, platform: 'x', title: '', by: { type: 'figure', id: fig }, text: text, ts: clock, ref: { type: 'race', id: race.id } }); added++; return id; };
  var ctxOf = function (r) { return { n: J.lastName(r.driver), car: r.car || '', st: r.start || '?', pos: r.position, track: race.track || race.name, race: race.name, led: r.lapsLed || 0, status: r.status || 'out' }; };
  var thread = function (kind, r, pool) {
    var drv = J.driverKey(r.driver), grp = byDrv[drv] || [], pos = grp.filter(function (f) { return f.stance.level > 0; }), neg = grp.filter(function (f) { return f.stance.level < 0; }), c = ctxOf(r), tid = J.uid('t'), t = T[kind];
    var ids = [], opener = null;
    var bank = function (sign) { var b = sign > 0 ? t.pos : t.neg; return b && b.length ? b : (t.mix || t.pos || t.neg); };
    var roots = (pos.length && (!neg.length || rand() < 0.6)) ? pos : neg.length ? neg : pos; if (!roots.length) { if (!free.length) return; roots = free; }
    opener = pick(roots); var sign = opener.stance && opener.stance.level ? Math.sign(opener.stance.level) : 0;
    var txt = sign === 0 ? pick(t.mix || t.pos || t.neg) : pick(bank(sign));
    fresh.push(tid); ids[0] = post(tid, null, opener, style(fill(txt, c), opener, opener.stance ? opener.stance.level : 0));
    var other = sign >= 0 ? neg : pos; // the other side shows up
    if (other.length && rand() < 0.75) { var o2 = pick(other), t2 = pick(bank(-sign || 1)); ids[1] = post(tid, ids[0], o2, style(fill(t2, c), o2, o2.stance.level)); if (rand() < 0.5) post(tid, ids[1], opener, style(pick(sign >= 0 ? ['Whatever, the results speak for themselves', 'Sure, keep coping', 'We will see at the next one', 'You say that every week lol', 'Cry about it'] : ['Say what you want, the scoreboard says otherwise', 'Same take every week', 'lol ok']), opener, opener.stance ? opener.stance.level : 0)); }
  };
  var w = info.winner, rows = info.rows;
  thread('win', w);
  if (rows[1]) thread('second', rows[1]);
  if (info.mover && info.mover.gain >= 12 && info.mover.row.position <= 12) thread('comeback', info.mover.row);
  var wrecked = rows.filter(function (r) { return J.isDnf(r) && (r.start || 99) <= 12; }).slice(0, 2); wrecked.forEach(function (r) { thread('dnf', r); });
  var bust = rows.filter(function (r) { return !J.isDnf(r) && r.start && r.start <= 5 && r.position >= 22; })[0]; if (bust) thread('bust', bust);
  var led = info.ledMost; if (led && led !== w && laps && led.lapsLed >= laps * 0.3) thread('led', led);
  // a couple of neutral fans talk about the race itself
  if (free.length) { var nt = J.uid('t'); fresh.push(nt); var f1 = pick(free); var id1 = post(nt, null, f1, style(fill(pick(T.neutral), ctxOf(w)), f1, 0)); if (free.length > 1 && rand() < 0.6) { var f2 = pick(free.filter(function (x) { return x !== f1; })); post(nt, id1, f2, style(pick(['Agreed, that last run was great', 'The restart at the end decided it', 'Missed the first half but caught the finish, wow', 'Fuel mileage could have swung it', 'I just like seeing new names up front']), f2, 0)); } }
  // media accounts
  if (J.FIGURES.sam) { var st = J.uid('t'); fresh.push(st); figPost(st, 'sam', w.driver + ' wins ' + race.name + ', starting P' + (w.start || '?') + (w.lapsLed ? ' and leading ' + w.lapsLed + ' laps' : '') + '.' + (info.cautions != null ? ' ' + info.cautions + ' cautions.' : '') + (rows.length ? ' ' + rows.filter(J.isDnf).length + ' of ' + rows.length + ' cars did not finish.' : '')); }
  if (J.FIGURES.memes && rows.filter(J.isDnf).length >= 3 && rand() < 0.7) { var mt = J.uid('t'); fresh.push(mt); figPost(mt, 'memes', pick(['The caution clock is undefeated at ' + (race.track || race.name), rows.filter(J.isDnf).length + ' cars in the garage early. Left turn go brrr', 'Pit road did what pit road does at ' + (race.track || race.name)])); }
  if (J.trimThreads) J.trimThreads(S, 110, fresh);
  return added;
};
})();
