/* Virtual NASCAR - careers across the series (commissioner only, never published).
   Call-ups (a few starts one series up), next season's moves (promotions, demotions, fallouts and firings, re-signings,
   real announced moves), applying them when a season rolls over, and who drives the shared cars each week. */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc, LAD = J.LADDER;
J.upOf = function (sid) { var i = LAD.indexOf(sid); return i >= 0 && i < LAD.length - 1 ? LAD[i + 1] : ''; };
J.downOf = function (sid) { var i = LAD.indexOf(sid); return i > 0 ? LAD[i - 1] : ''; };
function cur(sid) { var L = null; Object.keys(J.leagues || {}).forEach(function (k) { var x = J.leagues[k]; if (x.series.id === sid && !x.archived) L = x; }); return L; }
J.curLeague = cur;
function persist(L) { L.updatedAt = Date.now(); if (L === J.S) return; J.store.saveLeague(L).catch(function (e) { J.toast('Could not save: ' + e.message, true); }); }
function saveAll() { Object.keys(J.leagues || {}).forEach(function (k) { if (J.leagues[k] !== J.S && J.leagues[k]._dirty) { delete J.leagues[k]._dirty; persist(J.leagues[k]); } }); J.save(); }
function dirty(L) { if (L && L !== J.S) L._dirty = 1; }
J.FALLOUT = { off: 0, rare: 0.45, normal: 1, wild: 2.2 };
var FALL = ['the relationship with the team broke down', 'a sponsor pulled out and the team could not fund the ride', 'the team is restructuring and wants a new direction', 'a contract dispute that went public', 'a blow-up with team leadership after a wreck', 'comments about the team on a podcast that did not go over well', 'the team wants a younger driver in the seat', 'the team says results are not where they need to be'];

function stats(L) {
  var ft = J.standings(L), by = {};
  ft.forEach(function (d, i) { by[d.key] = { d: d, rank: i + 1, avg: d.starts ? d.fin / d.starts : null }; });
  J.partTimers(L).forEach(function (d) { by[d.key] = { d: d, rank: null, avg: d.starts ? d.fin / d.starts : null }; });
  return { by: by, n: ft.length, runs: L.races.length, total: Math.max(L.schedule.length, L.races.length, 1), field: Math.max(20, J.agg(L.races).length) };
}
function teamQ(L, st, tid) { var a = J.teamDrivers(L, tid).map(function (k) { return st.by[k] && st.by[k].avg; }).filter(function (v) { return v != null; }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : st.field * 0.55; }
function findKey(L, name) { var nk = J.nameKey ? J.nameKey(name) : J.driverKey(name), hit = ''; Object.keys(L.contracts || {}).some(function (k) { var c = L.contracts[k]; if ((J.nameKey ? J.nameKey(c.name || k) : k) === nk) { hit = k; return true; } }); return hit; }
function nameOf(L, k) { var c = L.contracts[k]; return (c && c.name) || (J.allDrivers(L).find(function (d) { return d.key === k; }) || {}).name || k; }
function teamName(L, tid) { return tid && L.teams && L.teams[tid] ? L.teams[tid].name : ''; }
function sLabel(sid) { var L = cur(sid); return L ? L.series.label : (J.SERIES[sid] || {}).label || sid; }

/* ---------- next season's moves ---------- */
J.suggestMoves = function (seed) {
  seed = seed || Date.now();
  var R = J.rng('moves' + seed), heat = J.FALLOUT[(J.settings && J.settings.fallout) || 'normal']; if (heat == null) heat = 1;
  var Ls = {}, St = {}; LAD.forEach(function (s) { var L = cur(s); if (L) { Ls[s] = L; St[s] = stats(L); } });
  var moves = [], taken = {};
  Object.keys(Ls).forEach(function (s) { (Ls[s].moves || []).forEach(function (m) { if (m.status !== 'proposed') taken[m.key] = m; }); });
  var yrOf = function (s) { return J.seasonNum(Ls[s]) + 1; };
  var mk = function (o) { o.id = J.uid('mv'); o.status = 'proposed'; o.made = Date.now(); o.through = o.through || o.season + 1 + (R() < 0.5 ? 1 : 0); moves.push(o); taken[o.key] = o; return o; };
  var fromInfo = function (L, k) { var c = L.contracts[k] || {}; return { fromTeamId: c.team || '', fromTeam: teamName(L, c.team), fromCar: c.car || '' }; };
  // 0. moves announced in real life (only while the league is the real 2026 season)
  (J.MOVES_2027 || []).forEach(function (m) {
    var from = m[2], to = m[3], nm = m[0].replace(/\s*\(.*\)\s*/, ''), Lf = Ls[from], Lt = Ls[to];
    if (!(Lf || Lt) || J.seasonNum(Lf || Lt) !== 2026) return;
    var key = (Lf && findKey(Lf, nm)) || (Lt && findKey(Lt, nm)) || J.driverKey(nm); if (taken[key]) return;
    if (!Lf && m[1] !== 'new' && !(Lt && Lt.contracts[key])) return; // nobody in the league knows this driver
    var kind = m[1] === 'retirement' ? 'retire' : from && to && LAD.indexOf(to) > LAD.indexOf(from) ? 'promote' : from && to && LAD.indexOf(to) < LAD.indexOf(from) ? 'demote' : 'move';
    if (Lf && Lf.contracts[key] && Lf.contracts[key].pt && from === to) kind = 'fulltime';
    mk(Object.assign({ kind: kind, key: key, name: nm, from: from || '', to: to || '', team: m[4] || '', car: m[5] && m[5] !== 'unconfirmed' ? m[5] : '', season: 2027, through: 2028, real: true, why: ['announced for 2027 in real life' + (m[7] ? ' (not fully confirmed)' : '')] }, Lf ? fromInfo(Lf, key) : {}));
  });
  // 1. fallouts, firings, demotions. Owner-drivers and family teams are safe.
  var seats = {}; LAD.forEach(function (s) { seats[s] = []; });
  var seatOf = function (s, m) { return { teamId: m.fromTeamId, team: m.fromTeam, car: m.fromCar, from: m.name, q: Ls[s] ? teamQ(Ls[s], St[s], m.fromTeamId) : 20 }; };
  Object.keys(Ls).forEach(function (s) {
    var L = Ls[s], st = St[s], prog = st.runs / st.total, preds = J.sillyPredictions(L, null, true), pmap = {}, demoted = 0; preds.forEach(function (x) { pmap[x.key] = x; });
    Object.keys(L.contracts).forEach(function (k) {
      var c = L.contracts[k]; if (taken[k] || c.pt || c.callup || c.released || !c.team) return;
      var x = st.by[k], nm = nameOf(L, k), rr = J.rng('fall' + seed + s + k);
      if (!J.isOwnerDriver(L, k)) {
        var tv = J.teamView(L, k) || { score: 60, why: [] };
        var risk = (0.012 + Math.max(0, 45 - tv.score) / 500) * heat * Math.min(1, 0.25 + prog);
        if (rr() < risk) {
          var now = prog > 0.15 && prog < 0.85 && rr() < 0.3;
          mk(Object.assign({ kind: 'fire', when: now ? 'now' : 'season', key: k, name: nm, from: s, to: '', season: yrOf(s), why: [FALL[Math.floor(rr() * FALL.length)]].concat(tv.why.slice(0, 2)) }, fromInfo(L, k)));
          return;
        }
        // sent down a series: a bad season on a team that should do better; rare, and only once the season has a shape
        var down = J.downOf(s);
        if (down && x && x.rank && prog >= 0.4 && demoted < 1 && x.rank > st.n * 0.8 && tv.score < 38 && rr() < 0.3 * heat) {
          demoted++;
          mk(Object.assign({ kind: 'demote', key: k, name: nm, from: s, to: down, season: yrOf(s), why: ['P' + x.rank + ' in points with a ' + x.avg.toFixed(1) + ' average finish'].concat(tv.why.slice(0, 1)) }, fromInfo(L, k)));
          return;
        }
      }
      // contract up: most re-sign, some test the market
      if (c.through <= J.seasonNum(L)) {
        var p = pmap[k] ? pmap[k].p : 0.4;
        if (rr() < p * 0.5 && !J.isOwnerDriver(L, k)) mk(Object.assign({ kind: 'move', key: k, name: nm, from: s, to: s, season: yrOf(s), why: ['contract up after ' + J.seasonNum(L)].concat(pmap[k] ? pmap[k].why.filter(function (w) { return !/contract/.test(w); }).slice(0, 1) : []), free: true }, fromInfo(L, k)));
        else mk({ kind: 'renew', key: k, name: nm, from: s, to: s, teamId: c.team, team: teamName(L, c.team), car: c.car, season: yrOf(s), through: yrOf(s) + (rr() < 0.5 ? 1 : 0) + (rr() < 0.25 ? 1 : 0), why: [pmap[k] && pmap[k].happy ? pmap[k].happy.label.toLowerCase() + ' with the team' : 'wants to stay'] });
      }
    });
  });
  // seats that open for sure: retirements, releases, demotions, real moves out (free agents only open a seat once they sign elsewhere)
  moves.forEach(function (m) { if (m.from && Ls[m.from] && m.fromTeamId && !m.free && m.kind !== 'renew' && !(m.to === m.from && m.kind !== 'move')) seats[m.from].push(seatOf(m.from, m)); });
  // part-time cars a team could run full-time next year
  Object.keys(Ls).forEach(function (s) { J.openSeats(Ls[s], []).filter(function (x) { return x.ptcar; }).forEach(function (x) { if (R() < 0.35) seats[s].push({ teamId: x.teamId, team: x.team, car: x.car, from: '', q: x.q, ptcar: true }); }); });
  // 2. fill seats from the top down, so a promotion opens a seat in the series below. A few rookies a year, not a flood.
  var CAP = { cup: 3, xfinity: 3, truck: 3, arca: 0 }, claimed = {}, ck = function (team, car) { return String(team || '').toLowerCase() + '#' + String(car || ''); };
  moves.forEach(function (m) { if (m.to && m.team) claimed[ck(m.team, m.car)] = 1; if (m.kind === 'promote' && m.to) CAP[m.to] = Math.max(0, (CAP[m.to] || 0) - 1); });
  ['cup', 'xfinity', 'truck', 'arca'].forEach(function (s) {
    var L = Ls[s]; if (!L) return;
    var st = St[s], down = J.downOf(s), pool = [], promoted = 0;
    if (down && Ls[down]) {
      var sd = St[down], Ld = Ls[down];
      Object.keys(Ld.contracts).forEach(function (k) {
        var c = Ld.contracts[k], x = sd.by[k], fa = taken[k] && taken[k].status === 'proposed' && taken[k].kind === 'move' && taken[k].free && !taken[k].team ? taken[k] : null;
        if ((taken[k] && !fa) || c.callup || !x || !x.avg || J.isOwnerDriver(Ld, k)) return;
        var good = (x.rank && x.rank <= 6) || x.d.wins >= 1 || x.avg <= sd.field * 0.3 || (c.pt && x.d.starts >= 3 && x.avg <= 9);
        if (!good || x.d.starts < Math.max(2, sd.runs * 0.25)) return;
        pool.push({ key: k, name: nameOf(Ld, k), from: down, kind: 'promote', fa: fa, fromL: Ld, exp: x.avg + 6, score: (sd.field * 0.5 - x.avg) + x.d.wins * 3 + (x.rank ? Math.max(0, 8 - x.rank) : 0) + R() * 5, why: [(x.rank ? 'P' + x.rank + ' in ' + sLabel(down) + ' points, ' : 'part-time, ') + J.plural(x.d.wins, 'win') + ', ' + x.avg.toFixed(1) + ' average finish'] });
      });
    }
    moves.forEach(function (m) { if (m.status === 'proposed' && m.kind === 'demote' && m.to === s && !m.team) pool.push({ key: m.key, name: m.name, kind: 'demote', exp: 8, score: 4 + R() * 4, move: m }); });
    moves.forEach(function (m) { if (m.status === 'proposed' && m.kind === 'move' && m.free && m.from === s && !m.team) { var x = st.by[m.key]; pool.push({ key: m.key, name: m.name, kind: 'move', exp: x && x.avg ? x.avg : st.field * 0.5, score: (x && x.avg ? st.field * 0.5 - x.avg : 0) + 1 + R() * 4, move: m, fromL: L }); } });
    Object.keys(L.contracts).forEach(function (k) { var c = L.contracts[k], x = st.by[k]; if (!c.pt || c.callup || taken[k] || !x || x.d.starts < 3 || x.avg > st.field * 0.4 || J.isOwnerDriver(L, k)) return; pool.push({ key: k, name: nameOf(L, k), kind: 'fulltime', exp: x.avg + 2, score: st.field * 0.5 - x.avg + R() * 4, why: ['part-time, ' + x.avg.toFixed(1) + ' average finish in ' + J.plural(x.d.starts, 'start')] }); });
    var q = seats[s].sort(function (a, b) { return a.q - b.q; }), used = {};
    for (var i = 0; i < q.length; i++) {
      var seat = q[i]; if (claimed[ck(seat.team, seat.car)]) continue;
      pool.sort(function (a, b) { return b.score - a.score; });
      // a seat goes to someone who fits it; a top seat stays open (the team signs from outside) rather than go to a back-marker
      var pick = pool.find(function (p) { return !used[p.key] && !(p.kind === 'promote' && promoted >= CAP[s]) && !(p.move && p.move.fromTeamId === seat.teamId && String(p.move.fromCar) === String(seat.car)) && p.exp <= seat.q + 10; });
      if (!pick) continue;
      claimed[ck(seat.team, seat.car)] = 1;
      used[pick.key] = 1; if (pick.kind === 'promote') promoted++;
      var dest = { to: s, teamId: seat.teamId, team: seat.team, car: seat.car, season: yrOf(s) };
      if (pick.fa) { pick.move = pick.fa; pick.move.kind = 'promote'; pick.move.free = false; pick.move.why = (pick.why || []).concat(pick.move.why.slice(0, 1)); }
      if (pick.move) {
        Object.assign(pick.move, dest); if (seat.from) pick.move.why.push('takes over from ' + seat.from);
        if (pick.move.free || pick.fa) { pick.move.free = false; if (pick.move.from === s) q.push(seatOf(s, pick.move)); else if (seats[pick.move.from]) seats[pick.move.from].push(seatOf(pick.move.from, pick.move)); } // the seat he leaves opens up
        continue;
      }
      var own = pick.kind === 'fulltime' && L.contracts[pick.key] && L.contracts[pick.key].team === seat.teamId && String(L.contracts[pick.key].car) === String(seat.car);
      var m = mk(Object.assign({ kind: pick.kind === 'fulltime' ? (own ? 'fulltime' : 'move') : pick.kind, key: pick.key, name: pick.name, from: pick.from || s, why: (pick.why || []).concat(seat.from ? ['takes over from ' + seat.from] : seat.ptcar ? ['the team runs the #' + seat.car + ' full-time'] : []) }, dest, pick.fromL ? fromInfo(pick.fromL, pick.key) : fromInfo(L, pick.key)));
      if (pick.kind === 'promote' && pick.fromL && m.fromTeamId) seats[pick.from].push(seatOf(pick.from, m));
    }
  });
  // free agents nobody signed: they re-sign after all
  moves.forEach(function (m) { if (m.kind === 'move' && m.free && !m.teamId) { m.kind = 'renew'; m.to = m.from; m.teamId = m.fromTeamId; m.team = m.fromTeam; m.car = m.fromCar; m.why = ['tested the market, stays put']; } });
  // store: replace old proposals, keep decisions
  var touched = {};
  Object.keys(Ls).forEach(function (s) { var L = Ls[s]; L.moves = (L.moves || []).filter(function (m) { return m.status !== 'proposed'; }); });
  moves.forEach(function (m) { [m.from, m.to].filter(function (s, i, a) { return s && a.indexOf(s) === i; }).forEach(function (s) { var L = Ls[s]; if (!L) return; L.moves.push(JSON.parse(JSON.stringify(m))); touched[s] = 1; }); });
  Object.keys(Ls).forEach(function (s) { dirty(Ls[s]); });
  saveAll();
  return moves;
};
// one move, everywhere it is stored
function eachCopy(id, fn) { Object.keys(J.leagues || {}).forEach(function (k) { var L = J.leagues[k]; (L.moves || []).forEach(function (m) { if (m.id === id) { fn(m, L); dirty(L); } }); }); }
function ensureTeam(L, m) {
  L.teams = L.teams || {};
  if (m.teamId && L.teams[m.teamId]) return m.teamId;
  var nm = String(m.team || '').trim(); if (!nm) return '';
  var hit = Object.keys(L.teams).find(function (k) { return L.teams[k].name.toLowerCase() === nm.toLowerCase(); }); if (hit) return hit;
  var other = null; Object.keys(J.leagues || {}).some(function (k) { var T = J.leagues[k].teams || {}; return Object.keys(T).some(function (t) { if (T[t].name.toLowerCase() === nm.toLowerCase()) { other = T[t]; return true; } }); });
  var id = J.slug(nm); L.teams[id] = { id: id, name: nm, color: other ? other.color : J.TEAM_COLORS[Object.keys(L.teams).length % J.TEAM_COLORS.length], base: other ? other.base : '', mfr: other ? other.mfr : '' };
  return id;
}
// put an approved move into a league (called at season rollover, or right away when that league is already in the new season)
function applyOne(m, L) {
  var sid = L.series.id; m.applied = m.applied || {}; if (m.applied[L.id]) return;
  var c = L.contracts[m.key];
  if (m.kind === 'renew') { if (c) c.through = m.through; }
  else {
    if (m.from === sid && (m.to !== sid || m.kind === 'fire' || m.kind === 'retire') && c) delete L.contracts[m.key];
    if (m.to === sid && (m.team || m.teamId)) {
      var tid = ensureTeam(L, m), old = L.contracts[m.key] || {};
      Object.keys(L.contracts).forEach(function (k) { var x = L.contracts[k]; if (k !== m.key && x.team === tid && String(x.car) === String(m.car) && !x.pt) { x.pt = true; x.ptSet = true; } }); // the seat holder (if any) becomes the part-timer
      L.contracts[m.key] = { name: m.name, team: tid, car: m.car || old.car || '', through: m.through || J.seasonNum(L) + 1, base: Math.max(old.base || 0, 64), auto: false, pt: false, ptSet: true, from: m.kind === 'promote' ? m.from : undefined };
    }
  }
  m.applied[L.id] = true;
}
J.applyMovesFor = function (L) {
  var y = J.seasonNum(L);
  (L.moves || []).forEach(function (m) { if (m.status === 'approved' && m.season <= y) applyOne(m, L); });
};
function approve(m) {
  eachCopy(m.id, function (x) { x.status = 'approved'; x.approvedAt = Date.now(); });
  // leagues already in the new season get it now; a release "effective now" happens in the current season
  Object.keys(J.leagues || {}).forEach(function (k) {
    var L = J.leagues[k]; if (L.archived) return; var copy = (L.moves || []).find(function (x) { return x.id === m.id; });
    if (copy && J.seasonNum(L) >= copy.season) { applyOne(copy, L); dirty(L); }
    if (copy && copy.kind === 'fire' && copy.when === 'now' && copy.from === L.series.id) releaseNow(copy, L);
  });
}
function releaseNow(m, L) {
  var c = L.contracts[m.key]; if (!c || c.released) return;
  c.released = true; c.team = ''; c.ptSet = true; dirty(L);
  // an interim driver takes the car: a part-timer from the same team, or a standout from the series below
  var interim = Object.keys(L.contracts).find(function (k) { var x = L.contracts[k]; return k !== m.key && x.team === m.fromTeamId && x.pt && !x.released; });
  var nm = interim ? L.contracts[interim].name : '';
  if (!nm) { var Ld = cur(J.downOf(L.series.id)); if (Ld) { var st = stats(Ld), best = Object.keys(st.by).filter(function (k) { return st.by[k].rank && !J.isOwnerDriver(Ld, k); }).sort(function (a, b) { return st.by[a].rank - st.by[b].rank; })[0]; if (best) { nm = st.by[best].d.name; interim = J.driverKey(nm); } } }
  if (!nm) return;
  L.contracts[interim] = Object.assign(L.contracts[interim] || {}, { name: nm, team: m.fromTeamId, car: m.fromCar, pt: true, ptSet: true, interim: true, through: J.seasonNum(L), base: 66 });
  eachCopy(m.id, function (x) { x.interim = nm; });
}
J.moveApprove = approve;

/* ---------- call-ups: a few starts one series up ---------- */
function carGroupsOf(S) {
  var g = {}; Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (!c.team || !c.car || c.released) return; var id = c.team + '#' + c.car; (g[id] = g[id] || { key: id, teamId: c.team, team: teamName(S, c.team), car: String(c.car), members: [] }).members.push({ key: k, name: c.name || k, pt: !!c.pt, callup: c.callup || '' }); });
  return Object.keys(g).map(function (k) { return g[k]; });
}
J.carGroups = carGroupsOf;
J.suggestCallups = function (seed) {
  seed = seed || Date.now(); var R = J.rng('cu' + seed), made = [];
  LAD.forEach(function (down) {
    var up = J.upOf(down), Ld = cur(down), Lu = cur(up); if (!Ld || !Lu) return;
    var st = stats(Ld), left = Lu.schedule.filter(function (r) { return !Lu.races.some(function (x) { return x.sid === r.id; }); });
    if (left.length < 2) return;
    var already = {}; (Lu.callups || []).forEach(function (c) { if (c.status !== 'proposed') already[c.key] = 1; });
    var cands = Object.keys(st.by).filter(function (k) { var x = st.by[k]; return x.rank && !already[k] && !J.isOwnerDriver(Ld, k) && !(Lu.contracts[k] && !Lu.contracts[k].callup) && (x.rank <= 6 || x.d.wins); }).sort(function (a, b) { return st.by[a].rank - st.by[b].rank; });
    if (!cands.length && !Ld.races.length) cands = J.roster(Ld).slice(0, 3).map(function (d) { return d.key; }).filter(function (k) { return !already[k]; });
    var pick = cands.filter(function () { return R() < 0.8; }).slice(0, 3);
    var cars = carGroupsOf(Lu).filter(function (g) { return !g.members.some(function (m) { return !m.pt && !m.callup; }); });
    if (!cars.length) cars = carGroupsOf(Lu).filter(function (g) { return g.members.length > 1; });
    if (!cars.length) return;
    var booked = {}; (Lu.callups || []).forEach(function (c) { if (c.status === 'approved') c.rounds.forEach(function (r) { booked[c.teamId + '#' + c.car + r] = 1; }); });
    pick.forEach(function (k) {
      var c = Ld.contracts[k] || {}, tn = teamName(Ld, c.team).toLowerCase(), first = tn.split(' ')[0];
      var same = cars.filter(function (g) { var n = g.team.toLowerCase(); return n === tn || (first.length > 3 && n.indexOf(first) === 0); });
      var g = (same.length ? same : cars)[Math.floor(R() * (same.length || cars.length))], n = Math.min(left.length, 2 + Math.floor(R() * 3)), rounds = [];
      for (var i = 0; i < left.length && rounds.length < n; i++) { var r = left[Math.floor((i + R()) * left.length / n) % left.length]; if (r && rounds.indexOf(r.id) < 0 && !booked[g.key + r.id]) { rounds.push(r.id); booked[g.key + r.id] = 1; } if (rounds.length * (left.length / n) > left.length) break; }
      if (!rounds.length) return;
      var x = st.by[k] || { rank: null, d: { wins: 0 } };
      made.push({ id: J.uid('cu'), kind: 'callup', key: k, name: nameOf(Ld, k), from: down, to: up, teamId: g.teamId, team: g.team, car: g.car, rounds: rounds, status: 'proposed', season: J.seasonNum(Lu), why: [(x.rank ? 'P' + x.rank + ' in ' + Ld.series.label + ' points' : 'one of the fastest in the ' + Ld.series.label + ' test') + (x.d.wins ? ', ' + J.plural(x.d.wins, 'win') : '')] });
    });
  });
  LAD.forEach(function (s) { var L = cur(s); if (L) { L.callups = (L.callups || []).filter(function (c) { return c.status !== 'proposed'; }); dirty(L); } });
  made.forEach(function (c) { [c.from, c.to].forEach(function (s) { var L = cur(s); if (L) L.callups.push(JSON.parse(JSON.stringify(c))); }); });
  saveAll();
  return made;
};
function eachCallup(id, fn) { Object.keys(J.leagues || {}).forEach(function (k) { var L = J.leagues[k]; (L.callups || []).forEach(function (c) { if (c.id === id) { fn(c, L); dirty(L); } }); }); }
function callupOk(id) {
  eachCallup(id, function (c, L) {
    c.status = 'approved';
    if (L.series.id === c.to && !(L.contracts[c.key] && !L.contracts[c.key].callup)) L.contracts[c.key] = { name: c.name, team: c.teamId, car: c.car, through: J.seasonNum(L), base: 70, auto: false, pt: true, ptSet: true, callup: c.from, extra: true };
  });
}
function callupNo(id) {
  eachCallup(id, function (c, L) { c.status = 'rejected'; if (L.series.id === c.to && L.contracts[c.key] && L.contracts[c.key].callup && !(L.callups || []).some(function (o) { return o.id !== c.id && o.key === c.key && o.status === 'approved'; })) delete L.contracts[c.key]; });
}

/* ---------- shared cars: who drives this week ---------- */
J.carPick = function (S, roundId, g) {
  var o = S.carWeek && S.carWeek[roundId] && S.carWeek[roundId][g.key]; if (o && g.members.some(function (m) { return m.name === o; })) return o;
  var cu = (S.callups || []).find(function (c) { return c.status === 'approved' && c.teamId + '#' + c.car === g.key && c.rounds.indexOf(roundId) >= 0; }); if (cu) return cu.name;
  // same weekend, same driver: whoever already ran this car in practice or qualifying for this round
  var prior = null; (S.sessions || []).forEach(function (x) { if (x.sid !== roundId || prior) return; var r = x.rows.find(function (q) { return String(q.car) === g.car; }); if (r && g.members.some(function (m) { return J.driverKey(m.name) === J.driverKey(r.driver); })) prior = r.driver; });
  if (prior) return prior;
  var ft = g.members.filter(function (m) { return !m.pt && !m.callup; }); if (ft.length) return ft[0].name;
  var pts = g.members.filter(function (m) { return !m.callup; }); if (!pts.length) pts = g.members; if (pts.length === 1) return pts[0].name;
  var look = J.rosterLookup ? J.rosterLookup(S) : null, w = pts.map(function (m) { var k = look && look(m.name); return Math.max(1, (k && k.starts) || 1); }), W = w.reduce(function (a, b) { return a + b; }, 0);
  var idx = Math.max(0, S.schedule.findIndex(function (r) { return r.id === roundId; })), x = ((idx + 1) * 0.6180339887 % 1) * W;
  for (var i = 0; i < pts.length; i++) { x -= w[i]; if (x < 0) return pts[i].name; }
  return pts[0].name;
};
// NR2003 shows one driver per car: put this week's driver in shared cars (and in a released driver's old car)
J.carWeekSwap = function (S, roundId, rows, opts) {
  opts = opts || {}; if (!roundId) return { rows: rows, swaps: [] };
  var byCar = {}; carGroupsOf(S).forEach(function (g) { (byCar[g.car] = byCar[g.car] || []).push(g); });
  var swaps = [], out = rows.map(function (r) {
    var list = byCar[String(r.car || '')]; if (!list || list.length !== 1) return r;
    var g = list[0], pick = J.carPick(S, roundId, g), rk = J.driverKey(r.driver); if (!pick || J.driverKey(pick) === rk) return r;
    var c = S.contracts[rk], member = g.members.some(function (m) { return m.key === rk; });
    if (!(member || (c && c.released))) return r;
    swaps.push({ car: r.car, from: r.driver, to: pick }); var o = Object.assign({}, r); o.driver = pick; o._swap = r.driver; return o;
  });
  if (opts.dedupe) { var seenD = {}, seenC = {}; out = out.filter(function (r) { var dk = J.driverKey(r.driver), ck = String(r.car || ''); if (seenD[dk] || (ck && seenC[ck])) return false; seenD[dk] = 1; if (ck) seenC[ck] = 1; return true; }); out.forEach(function (r, i) { r.position = i + 1; }); }
  return { rows: out, swaps: swaps };
};

/* ---------- the page ---------- */
var KIND = { promote: 'Moves up', demote: 'Sent down', fire: 'Released', renew: 'Re-signs', move: 'New team', retire: 'Retiring', fulltime: 'Goes full-time', callup: 'Call-up' };
function moveRow(m, S) {
  var on = m.status === 'approved', no = m.status === 'rejected', done = m.applied && Object.keys(m.applied).length;
  return '<div class="mvrow k-' + m.kind + (on ? ' ok' : '') + (no ? ' no' : '') + '"><span class="mvk">' + esc(KIND[m.kind] || m.kind) + (m.when === 'now' ? ' now' : '') + '</span><div class="mvb"><b>' + esc(m.name) + '</b> <span class="dim">' + esc(J.moveLine(m, S)) + '</span>' + (m.real ? ' <span class="chip">Real life</span>' : '') + '<small>' + esc((m.why || []).join('; ')) + (m.interim ? '; ' + esc(m.interim) + ' drives the car for now' : '') + '</small></div><div class="mvact">'
    + (no ? '<button class="btn ghost sm" data-act="mvUndo" data-id="' + esc(m.id) + '">Undo</button>' : on ? '<span class="chip g">' + (done ? 'Done' : 'Approved') + '</span>' + (done ? '' : '<button class="btn ghost sm" data-act="mvUndo" data-id="' + esc(m.id) + '">Undo</button>') : '<button class="btn sm" data-act="mvOk" data-id="' + esc(m.id) + '">Approve</button><button class="btn ghost sm" data-act="mvNo" data-id="' + esc(m.id) + '">Reject</button>') + '</div></div>';
}
function cuRow(c, S) {
  var rn = c.rounds.map(function (id) { var L = cur(c.to), r = L && L.schedule.find(function (x) { return x.id === id; }); return r ? r.name : id; });
  return '<div class="mvrow k-callup' + (c.status === 'approved' ? ' ok' : c.status === 'rejected' ? ' no' : '') + '"><span class="mvk">' + (c.to === S.series.id ? 'Call-up in' : 'Call-up out') + '</span><div class="mvb"><b>' + esc(c.name) + '</b> <span class="dim">' + esc(J.plural(c.rounds.length, 'start') + ' in the ' + sLabel(c.to) + ' ' + c.team + ' #' + c.car) + '</span><small>' + esc(c.why.join('; ') + '. Races: ' + rn.join(', ')) + '</small></div><div class="mvact">'
    + (c.status === 'proposed' ? '<button class="btn sm" data-act="cuOk" data-id="' + esc(c.id) + '">Approve</button><button class="btn ghost sm" data-act="cuNo" data-id="' + esc(c.id) + '">Reject</button>' : '<span class="chip' + (c.status === 'approved' ? ' g' : '') + '">' + (c.status === 'approved' ? 'Approved' : 'Rejected') + '</span>') + '</div></div>';
}
J.routes.careers = function (S) {
  var sid = S.series.id, nx = J.nextRound(S), all = !!J.ui.cmAll, fall = (J.settings && J.settings.fallout) || 'normal';
  var mv = (S.moves || []).slice(); if (all) { mv = []; var seen = {}; LAD.forEach(function (s) { var L = cur(s); (L && L.moves || []).forEach(function (m) { if (!seen[m.id]) { seen[m.id] = 1; mv.push(m); } }); }); }
  var order = { fire: 0, retire: 1, demote: 2, promote: 3, move: 4, fulltime: 5, renew: 6 }; mv.sort(function (a, b) { return (a.status === 'rejected') - (b.status === 'rejected') || (order[a.kind] - order[b.kind]) || a.name.localeCompare(b.name); });
  var out = J.phead('Career Moves', 'Drivers move between the series like real life: ARCA standouts get a few Truck starts, then a full-time ride; Truck drivers move up to the O\'Reilly series, O\'Reilly drivers to Cup. Teams can also fall out with a driver and release him, or send a struggling driver down a series. Owner-drivers and family teams are safe.');
  // shared cars this week
  var gs = carGroupsOf(S).filter(function (g) { return g.members.length > 1 || g.members.some(function (m) { return m.callup; }); });
  out += '<section class="panel"><h3>Shared cars: who drives ' + (nx ? 'at ' + esc(nx.name) : 'next') + '</h3><p class="sub">NR2003 only shows one driver per car. When you import this race, the app swaps in the driver picked here for these cars (you can turn that off on the import screen). Set the same driver in NR2003 if you want the names to match in the game too.</p>'
    + (nx && gs.length ? '<div class="tw"><table class="data cwk"><thead><tr><th>Car</th><th>Team</th><th>This week</th></tr></thead><tbody>' + gs.map(function (g) { var p = J.carPick(S, nx.id, g); return '<tr><td>' + J.carTag(g.car) + '</td><td>' + esc(g.team) + '</td><td><select data-cw="' + esc(g.key) + '" data-r="' + esc(nx.id) + '" aria-label="Driver of the #' + esc(g.car) + '">' + g.members.map(function (m) { return '<option' + (m.name === p ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim">' + (nx ? 'No shared cars in this series yet.' : 'The season is over.') + '</p>') + '</section>';
  // call-ups
  var cus = (S.callups || []).slice().sort(function (a, b) { return (a.status === 'rejected') - (b.status === 'rejected'); });
  out += '<section class="panel"><h3>Call-ups this season</h3><p class="sub">Standouts from the series below get a few starts in a part-time car one series up. Approve one and that driver is put in the car for those races.</p>'
    + (cus.length ? cus.map(function (c) { return cuRow(c, S); }).join('') : '<p class="dim">None yet.</p>') + '<div class="row"><button class="btn sm" data-act="cmCallups">Suggest call-ups</button></div></section>';
  // next season
  out += '<section class="panel"><h3>Next season\'s moves</h3><p class="sub">Suggestions from this season\'s results, contracts, happiness and how each team sees its driver, plus real moves already announced. Nothing happens until you approve it. Approved moves take effect when you start next season on the League page (a "released now" takes effect right away).</p>'
    + '<div class="row artopts"><label class="field" style="margin:0"><span>How often teams fall out with drivers</span><select id="falloutSel">' + [['off', 'Never'], ['rare', 'Rarely'], ['normal', 'Sometimes (like real life)'], ['wild', 'A lot (drama)']].map(function (o) { return '<option value="' + o[0] + '"' + (fall === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label><label class="chk"><input type="checkbox" id="cmAll"' + (all ? ' checked' : '') + '> Show every series</label></div>'
    + (mv.length ? mv.map(function (m) { return moveRow(m, S); }).join('') : '<p class="dim">No moves yet. Click Suggest moves.</p>')
    + '<div class="row"><button class="btn sm" data-act="cmSuggest">' + (mv.some(function (m) { return m.status === 'proposed'; }) ? 'Suggest again' : 'Suggest moves') + '</button>' + (mv.some(function (m) { return m.status === 'proposed'; }) ? '<button class="btn ghost sm" data-act="mvAll">Approve all suggestions</button>' : '') + '</div></section>';
  return out;
};
J.nav.push({ id: 'careers', label: 'Career Moves', group: 'Commissioner', admin: true });
J.acts.cmSuggest = function () { var n = J.suggestMoves(Date.now()); J.toast(J.plural(n.length, 'move') + ' suggested across the series.'); };
J.acts.cmCallups = function () { var n = J.suggestCallups(Date.now()); J.toast(n.length ? J.plural(n.length, 'call-up') + ' suggested.' : 'No call-ups to suggest (each series needs the one below it running, and races left).', !n.length); };
J.acts.mvOk = function (el) { var m = null; eachCopy(el.dataset.id, function (x) { m = x; }); if (m) { approve(m); saveAll(); } };
J.acts.mvNo = function (el) { eachCopy(el.dataset.id, function (x) { x.status = 'rejected'; }); saveAll(); };
J.acts.mvUndo = function (el) { eachCopy(el.dataset.id, function (x) { if (!(x.applied && Object.keys(x.applied).length)) x.status = 'proposed'; }); saveAll(); };
J.acts.mvAll = function () { var list = []; var seen = {}; LAD.forEach(function (s) { var L = cur(s); (L && L.moves || []).forEach(function (m) { if (m.status === 'proposed' && !seen[m.id] && (J.ui.cmAll || m.from === J.S.series.id || m.to === J.S.series.id)) { seen[m.id] = 1; list.push(m); } }); }); if (!confirm('Approve all ' + list.length + ' suggested moves?')) return; list.forEach(approve); saveAll(); };
J.acts.cuOk = function (el) { callupOk(el.dataset.id); saveAll(); };
J.acts.cuNo = function (el) { callupNo(el.dataset.id); saveAll(); };
document.addEventListener('change', function (e) {
  var t = e.target, S = J.S; if (!t || !S) return;
  if (t.id === 'falloutSel') { J.settings.fallout = t.value; J.saveSettings(); return; }
  if (t.id === 'cmAll') { J.ui.cmAll = t.checked; J.refresh(); return; }
  if (t.dataset && t.dataset.cw) { S.carWeek = S.carWeek || {}; (S.carWeek[t.dataset.r] = S.carWeek[t.dataset.r] || {})[t.dataset.cw] = t.value; J.save({ render: false }); }
});
})();
