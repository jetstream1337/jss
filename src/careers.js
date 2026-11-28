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
J.suggestMoves = function (seed, opts) {
  seed = seed || Date.now(); opts = opts || {};
  var R = J.rng('moves' + seed), heat = J.FALLOUT[(J.settings && J.settings.fallout) || 'normal']; if (heat == null) heat = 1;
  var Ls = {}, St = {}; LAD.forEach(function (s) { var L = cur(s); if (L) { Ls[s] = L; St[s] = stats(L); } });
  var moves = [], taken = {};
  Object.keys(Ls).forEach(function (s) { var yy = J.seasonNum(Ls[s]) + 1; (Ls[s].moves || []).forEach(function (m) { if (m.status !== 'proposed' && m.season >= yy && !(m.applied && m.applied[Ls[s].id])) taken[m.key] = m; }); }); // only decisions for THIS offseason block a driver; last year's are history
  // "Suggest again" is a fresh slate: whoever the last batch picked for a given kind of move (and was not approved) is mostly passed over this time
  var avoid = {}; Object.keys(Ls).forEach(function (s) { (Ls[s].moves || []).forEach(function (m) { if (m.status === 'proposed' && !m.real && m.kind !== 'renew') (avoid[m.key] = avoid[m.key] || []).push(m.kind); }); });
  var skipPrev = function (k, kind) { return avoid[k] && avoid[k].indexOf(kind) >= 0 && J.rng('avoid' + seed + k + kind)() < 0.85; };
  var yrOf = function (s) { return J.seasonNum(Ls[s]) + 1; };
  var mk = function (o) { o.id = J.uid('mv'); o.status = 'proposed'; o.made = Date.now(); o.through = o.through || o.season + 1 + (R() < 0.5 ? 1 : 0); moves.push(o); taken[o.key] = o; return o; };
  var fromInfo = function (L, k) { var c = L.contracts[k] || {}; return { fromTeamId: c.team || '', fromTeam: teamName(L, c.team), fromCar: c.car || '' }; };
  // 0. moves announced in real life (only while the league is the real 2026 season)
  (opts.real === false ? [] : (J.MOVES_2027 || [])).forEach(function (m) {
    var from = m[2], to = m[3], nm = m[0].replace(/\s*\(.*\)\s*/, ''), Lf = Ls[from], Lt = Ls[to];
    if (!(Lf || Lt) || J.seasonNum(Lf || Lt) !== 2026) return;
    var key = (Lf && findKey(Lf, nm)) || (Lt && findKey(Lt, nm)) || J.driverKey(nm); if (taken[key]) return;
    if (!Lf && m[1] !== 'new' && !(Lt && Lt.contracts[key])) return; // nobody in the league knows this driver
    var kind = m[1] === 'retirement' ? 'retire' : from && to && LAD.indexOf(to) > LAD.indexOf(from) ? 'promote' : from && to && LAD.indexOf(to) < LAD.indexOf(from) ? 'demote' : 'move';
    if (Lf && Lf.contracts[key] && Lf.contracts[key].pt && from === to) kind = 'fulltime';
    mk(Object.assign({ kind: kind, key: key, name: nm, from: from || '', to: to || '', team: m[4] || '', car: m[5] && m[5] !== 'unconfirmed' ? m[5] : '', season: 2027, through: 2028, real: true, why: ['announced for 2027 in real life' + (m[7] ? ' (not fully confirmed)' : '')] }, Lf ? fromInfo(Lf, key) : {}));
  });
  // a real-life announcement does not beat the simulated season: if the driver is a mid-pack finisher here while the points leaders of his series
  // are staying put, the announcement is dropped and the ride goes on results
  if (opts.performance !== false) moves = moves.filter(function (m) {
    if (!m.real || m.kind !== 'promote' || !Ls[m.from]) return true;
    var sd = St[m.from], x = sd.by[m.key]; if (!x || !x.rank || sd.runs / sd.total < 0.5 || x.rank <= 6) return true;
    var top = Object.keys(sd.by).filter(function (k) { return sd.by[k].rank && sd.by[k].rank <= 3 && !J.isOwnerDriver(Ls[m.from], k) && !moves.some(function (o) { return o.key === k && (o.kind === 'promote' || o.kind === 'retire'); }); });
    if (top.length < 2) return true;
    delete taken[m.key]; return false;
  });
  // 1. fallouts, firings, demotions. Owner-drivers and family teams are safe.
  var seats = {}; LAD.forEach(function (s) { seats[s] = []; });
  var seatOf = function (s, m) { return { teamId: m.fromTeamId, team: m.fromTeam, car: m.fromCar, from: m.name, q: Ls[s] ? teamQ(Ls[s], St[s], m.fromTeamId) : 20 }; };
  Object.keys(Ls).forEach(function (s) {
    var L = Ls[s], st = St[s], prog = st.runs / st.total, preds = J.sillyPredictions(L, null, true), pmap = {}, demoted = 0; preds.forEach(function (x) { pmap[x.key] = x; });
    Object.keys(L.contracts).forEach(function (k) {
      var c = L.contracts[k]; if (taken[k] || c.pt || c.callup || c.released || !c.team) return;
      var x = st.by[k], nm = nameOf(L, k), rr = J.rng('fall' + seed + s + k);
      // growing old: retirement is rare before the late 30s, considered in the 40s, and a driver racing at 50 is very uncommon
      var rh = J.retireChance ? J.retireChance(L, k, x && { rank: x.rank, n: st.n, d: x.d }, prog) : 0;
      if (rh > 0 && J.rng('ret' + seed + s + k)() < rh && !skipPrev(k, 'retire')) {
        mk(Object.assign({ kind: 'retire', key: k, name: nm, from: s, to: '', season: yrOf(s), why: J.retireWhy(L, k, x && { rank: x.rank }) }, fromInfo(L, k)));
        return;
      }
      if (!J.isOwnerDriver(L, k)) {
        var tv = J.teamView(L, k) || { score: 60, why: [] };
        var risk = (0.012 + Math.max(0, 45 - tv.score) / 500) * heat * Math.min(1, 0.25 + prog);
        if (rr() < risk && !skipPrev(k, 'fire')) {
          var now = prog > 0.15 && prog < 0.85 && rr() < 0.3;
          mk(Object.assign({ kind: 'fire', when: now ? 'now' : 'season', key: k, name: nm, from: s, to: '', season: yrOf(s), why: [FALL[Math.floor(rr() * FALL.length)]].concat(tv.why.slice(0, 2)) }, fromInfo(L, k)));
          return;
        }
        // sent down a series: a bad season on a team that should do better; rare, and only once the season has a shape
        var down = J.downOf(s);
        if (down && x && x.rank && prog >= 0.4 && demoted < 1 && x.rank > st.n * 0.8 && tv.score < 38 && rr() < 0.3 * heat && !skipPrev(k, 'demote')) {
          demoted++;
          mk(Object.assign({ kind: 'demote', key: k, name: nm, from: s, to: down, season: yrOf(s), why: ['P' + x.rank + ' in points with a ' + x.avg.toFixed(1) + ' average finish'].concat(tv.why.slice(0, 1)) }, fromInfo(L, k)));
          return;
        }
      }
      // contract up: most re-sign, some test the market
      if (c.through <= J.seasonNum(L) && c.resign !== 'no') {
        var p = pmap[k] ? pmap[k].p : 0.4;
        if (c.resign !== 'yes' && rr() < p * 0.5 && !J.isOwnerDriver(L, k) && !skipPrev(k, 'move')) mk(Object.assign({ kind: 'move', key: k, name: nm, from: s, to: s, season: yrOf(s), why: ['contract up after ' + J.seasonNum(L)].concat(pmap[k] ? pmap[k].why.filter(function (w) { return !/contract/.test(w); }).slice(0, 1) : []), free: true }, fromInfo(L, k)));
        else mk({ kind: 'renew', key: k, name: nm, from: s, to: s, teamId: c.team, team: teamName(L, c.team), car: c.car, season: yrOf(s), through: yrOf(s) + (rr() < 0.5 ? 1 : 0) + (rr() < 0.25 ? 1 : 0), why: [pmap[k] && pmap[k].happy ? pmap[k].happy.label.toLowerCase() + ' with the team' : 'wants to stay'] });
      }
    });
  });
  // seats that open for sure: retirements, releases, demotions, real moves out (free agents only open a seat once they sign elsewhere)
  moves.forEach(function (m) { if (m.from && Ls[m.from] && m.fromTeamId && !m.free && m.kind !== 'renew' && !(m.to === m.from && m.kind !== 'move')) seats[m.from].push(seatOf(m.from, m)); });
  // part-time cars a team could run full-time next year
  Object.keys(Ls).forEach(function (s) { J.openSeats(Ls[s], []).filter(function (x) { return x.ptcar; }).forEach(function (x) { if (R() < 0.35) seats[s].push({ teamId: x.teamId, team: x.team, car: x.car, from: '', q: x.q, ptcar: true }); }); });
  // who in the series below has earned a step up: season results decide it (points rank, wins, top 5s, average finish);
  // career history across seasons is only a small nudge, so a champion is never kept down by his name or his real-life resume
  var promoPool = function (s) {
    var L = Ls[s], down = J.downOf(s), out = [], Ld = Ls[down], sd = St[down]; if (!Ld) return out;
    Object.keys(Ld.contracts).forEach(function (k) {
      var c = Ld.contracts[k], x = sd.by[k], fa = taken[k] && taken[k].status === 'proposed' && taken[k].kind === 'move' && taken[k].free && !taken[k].team ? taken[k] : null;
      // a plain re-signing is only a placeholder: it must never keep a points leader from moving up
      var rn = taken[k] && taken[k].status === 'proposed' && taken[k].kind === 'renew' && moves.indexOf(taken[k]) >= 0 ? taken[k] : null;
      if ((taken[k] && !fa && !rn) || c.callup || !x || !x.avg || J.isOwnerDriver(Ld, k)) return;
      var good = (x.rank && x.rank <= Math.max(6, Math.round(sd.n * 0.2))) || x.d.wins >= 1 || x.avg <= sd.field * 0.3 || (c.pt && x.d.starts >= 3 && x.avg <= 9);
      if (!good || x.d.starts < Math.max(2, sd.runs * 0.25) || skipPrev(k, 'promote')) return;
      var cr = J.careerOf(k, c, down).s, upMed = J.medianS(L), nudge = Math.max(-4, Math.min(4, (cr - upMed * 0.8) * 10));
      var perf = (x.rank ? (1 - (x.rank - 1) / Math.max(1, sd.n - 1)) * 40 : 12) + x.d.wins * 4 + (x.d.t5 / Math.max(1, x.d.starts)) * 12 + (sd.field * 0.5 - x.avg) * 0.8;
      out.push({ key: k, name: nameOf(Ld, k), from: down, kind: 'promote', fa: fa, rn: rn, fromL: Ld, exp: x.avg + 6, perf: perf, rank: x.rank, score: perf + nudge + R() * 1.5, why: [(x.rank ? 'P' + x.rank + ' in ' + sLabel(down) + ' points, ' : 'part-time, ') + J.plural(x.d.wins, 'win') + ', ' + x.avg.toFixed(1) + ' average finish'] });
    });
    return out;
  };
  // earned a ride but no seat is open: the weakest full-timers one series up make room (sent down a series)
  if (opts.performance !== false) ['cup', 'xfinity', 'truck'].forEach(function (s) {
    var L = Ls[s], down = J.downOf(s); if (!L || !down || !Ls[down]) return;
    var st = St[s], prog = st.runs / st.total; if (prog < 0.5) return;
    var best = promoPool(s).filter(function (p) { return p.rank && (p.rank <= 3 || (p.rank <= 5 && St[down].by[p.key].d.wins >= 2)); }).sort(function (a, b) { return b.perf - a.perf; });
    var open = seats[s].length, want = Math.min(best.length, 2) - open;
    if (want <= 0) return;
    var weak = Object.keys(L.contracts).map(function (k) { return { k: k, c: L.contracts[k], x: st.by[k] }; }).filter(function (o) { return o.x && o.x.rank && !taken[o.k] && !o.c.pt && !o.c.callup && o.c.team && !J.isOwnerDriver(L, o.k) && o.x.rank > st.n * 0.65 && o.x.d.starts >= Math.max(3, st.runs * 0.5) && o.x.d.wins === 0; }).sort(function (a, b) { return b.x.rank - a.x.rank; });
    for (var i = 0; i < want && i < weak.length; i++) {
      var o = weak[i], bt = best[i]; if (!bt || bt.perf < 28) break;
      var m = mk(Object.assign({ kind: 'demote', key: o.k, name: nameOf(L, o.k), from: s, to: down, season: yrOf(s), why: ['P' + o.x.rank + ' in ' + sLabel(s) + ' points with a ' + o.x.avg.toFixed(1) + ' average finish; ' + bt.name + ' earned the ride'] }, fromInfo(L, o.k)));
      seats[s].push(seatOf(s, m));
    }
  });
  // 2. fill seats from the top down, so a promotion opens a seat in the series below. A few rookies a year, not a flood.
  var CAP = { cup: 3, xfinity: 3, truck: 3, arca: 0 }, claimed = {}, ck = function (team, car) { return String(team || '').toLowerCase() + '#' + String(car || ''); };
  moves.forEach(function (m) { if (m.to && m.team) claimed[ck(m.team, m.car)] = 1; if (m.kind === 'promote' && m.to) CAP[m.to] = Math.max(0, (CAP[m.to] || 0) - 1); });
  ['cup', 'xfinity', 'truck', 'arca'].forEach(function (s) {
    var L = Ls[s]; if (!L) return;
    var st = St[s], down = J.downOf(s), pool = [], promoted = 0;
    if (down && Ls[down]) promoPool(s).forEach(function (p) { pool.push(p); });
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
      if (pick.rn) { var ri = moves.indexOf(pick.rn); if (ri >= 0) moves.splice(ri, 1); pick.rn = null; delete taken[pick.key]; }
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
    if (m.from === sid && (m.to !== sid || m.kind === 'fire' || m.kind === 'retire') && c) { if (m.kind === 'retire' && J.noteRetired) J.noteRetired(L, m, c); delete L.contracts[m.key]; }
    if (m.to === sid && (m.team || m.teamId)) {
      var tid = ensureTeam(L, m), old = L.contracts[m.key] || {};
      Object.keys(L.contracts).forEach(function (k) { var x = L.contracts[k]; if (k !== m.key && x.team === tid && String(x.car) === String(m.car) && !x.pt) { x.pt = true; x.ptSet = true; } }); // the seat holder (if any) becomes the part-timer
      L.contracts[m.key] = { name: m.name, team: tid, car: m.car || old.car || '', through: m.through || J.seasonNum(L) + 1, base: Math.max(old.base || 0, 64), auto: false, pt: false, ptSet: true, from: m.kind === 'promote' ? m.from : undefined };
    }
  }
  m.applied[L.id] = true;
}
// a clean slate: last offseason's moves are history once their season has started. Applied ones are noted in a short log, the rest dropped
J.cleanMoves = function (L) {
  if (!L || L.archived) return 0;
  var y = J.seasonNum(L), n = 0; J.applyMovesFor(L);
  var keep = [], log = L.moveLog && L.moveLog.season === y ? L.moveLog.list : [];
  (L.moves || []).forEach(function (m) {
    if (m.season > y && !(m.applied && m.applied[L.id])) { keep.push(m); return; }
    n++; if (m.status === 'approved' && m.kind !== 'renew' && !log.some(function (x) { return x.id === m.id; })) log.push({ id: m.id, kind: m.kind, name: m.name, from: m.from, to: m.to, team: m.team, fromTeam: m.fromTeam, car: m.car, season: m.season });
  });
  L.moves = keep; if (log.length) L.moveLog = { season: y, list: log };
  return n;
};
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
/* ---------- team cars, open seats, free agent placement ---------- */
// A team's cars are remembered (team.cars) so a seat does not vanish when its driver is promoted, fired, retires or is let go.
// Seats = remembered cars + cars with a contract now + the real full-time cars of teams already in the league, minus cars the commissioner closed.
function carNums(a) { return a.sort(function (x, y) { return (parseInt(x, 10) || 9999) - (parseInt(y, 10) || 9999) || String(x).localeCompare(String(y)); }); }
J.saveDirty = function () { saveAll(); };
J.noteCars = function (S) {
  var n = 0; S.teams = S.teams || {};
  Object.keys(S.contracts || {}).forEach(function (k) {
    var c = S.contracts[k], t = c && c.team && S.teams[c.team]; if (!t || !c.car || c.callup || c.interim) return;
    var cs = t.cars = t.cars || [], v = String(c.car); if (cs.indexOf(v) < 0 && (t.closed || []).indexOf(v) < 0) { cs.push(v); n++; }
  });
  return n;
};
J.teamCars = function (S, tid) {
  var t = S.teams && S.teams[tid]; if (!t) return [];
  var set = {}, add = function (v) { v = String(v || ''); if (v && (t.closed || []).indexOf(v) < 0) set[v] = 1; };
  (t.cars || []).forEach(add);
  Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (c && c.team === tid && c.car && !c.callup && !c.interim && !c.released) add(c.car); });
  var rc = J.rosterCars ? J.rosterCars(S) : {};
  Object.keys(rc).forEach(function (k) { var r = rc[k]; if (r.team.toLowerCase() === String(t.name).toLowerCase()) add(r.number); }); // every car the real team runs, even ones part-timers share
  return carNums(Object.keys(set));
};
// open = nobody full-time (and not released) in the car, and no approved move about to take it
J.openCars = function (S, exceptKey) {
  var out = [], claimed = {};
  (S.moves || []).forEach(function (m) { if (m.status === 'approved' && m.to === S.series.id && !(m.applied && m.applied[S.id]) && m.car && m.team) claimed[String(m.team).toLowerCase() + '#' + m.car] = 1; });
  Object.keys(S.teams || {}).forEach(function (tid) {
    J.teamCars(S, tid).forEach(function (num) {
      if (claimed[String(S.teams[tid].name).toLowerCase() + '#' + num]) return;
      var held = Object.keys(S.contracts || {}).some(function (k) { var c = S.contracts[k]; return k !== exceptKey && c.team === tid && String(c.car) === num && !c.pt && !c.released && !c.callup; });
      if (!held) out.push({ tid: tid, team: S.teams[tid].name, num: num });
    });
  });
  return out;
};

/* ---------- career strength: every season's results count, not just this one ---------- */
// Everything is on a Cup-equivalent 0..1 scale (a good ARCA season is worth less than a good Cup season). Recent seasons count more.
// With little or no history the driver's real-life form (or his base rating) is the starting point.
var SW = { arca: 0.6, truck: 0.72, xfinity: 0.85, cup: 1 }, lgCache = {};
function lgStats(L) {
  var rs = L.races || [], ck = L.id + '|' + rs.length + '|' + (rs.length ? rs[rs.length - 1].id : '');
  if (lgCache[ck]) return lgCache[ck];
  var by = {}, ag = J.agg(rs); ag.forEach(function (d) { by[d.key] = d; });
  return (lgCache[ck] = { by: by, n: Math.max(20, ag.length) });
}
J.careerOf = function (key, c, sid) {
  c = c || {}; var Ls = J.leagues || {}, now = 0, num = 0, den = 0, seasons = 0, starts = 0;
  Object.keys(Ls).forEach(function (id) { now = Math.max(now, J.seasonNum(Ls[id])); });
  Object.keys(Ls).forEach(function (id) {
    var L = Ls[id], st = L.races && L.races.length ? lgStats(L) : null, d = st && st.by[key]; if (!d || d.starts < 2) return;
    var sw = SW[L.series.id] || 0.7, perf = Math.max(0, Math.min(1, 1 - (d.fin / d.starts - 1) / (st.n - 1)));
    perf = Math.min(1, perf + Math.min(0.06, d.wins * 0.015 + d.t5 * 0.002)) * sw;
    var w = Math.min(d.starts, 24) / 24 * Math.pow(0.6, Math.max(0, now - J.seasonNum(L)));
    num += perf * w; den += w; seasons++; starts += d.starts;
  });
  var rl = c.rl && c.rl.s != null ? c.rl.s : Math.max(0.05, Math.min(1, (c.base || 60) / 100)), prior = rl * (SW[sid] || 0.8);
  return { s: (prior * 0.5 + num) / (0.5 + den), seasons: seasons, starts: starts, note: seasons ? '(' + seasons + (seasons === 1 ? ' season' : ' seasons') + ' of results)' : '(real-life form)' };
};
function fullTimeS(L) { var a = []; Object.keys(L.contracts || {}).forEach(function (k) { var c = L.contracts[k]; if (c.team && !c.pt && !c.released && !c.callup) a.push(J.careerOf(k, c, L.series.id).s); }); return a.sort(function (x, y) { return x - y; }); }
function medianS(L) { var a = fullTimeS(L); return a.length ? a[Math.floor(a.length / 2)] : 0.3 * (SW[L.series.id] || 1); }
J.medianS = medianS;

// Placing free agents. Strongest first. Full-time cars before part-time: his own series and (if his results say he is ready) one series up,
// then one series down, and only when every car is full does he go part-time. Better drivers land with better teams.
J.placeFreeAgents = function (S, only) {
  var sid = S.series.id, yr = J.seasonNum(S), res = { full: 0, part: 0, left: 0, list: [] }, up = J.upOf(sid), dn = J.downOf(sid);
  var fl = (S.freeAgents || []).slice(); if (only) fl = fl.filter(function (f) { return f.key === only; });
  // free agents who are getting on in years may simply retire instead of looking for a ride
  if (!only && J.RETIRE) { var mul = J.RETIRE[(J.settings && J.settings.retire) || 'normal']; if (mul == null) mul = 1;
    fl = fl.filter(function (f) { var age = J.ageOfFA(S, f), hz = age < 38 ? 0 : (age >= 52 ? 0.92 : (age >= 50 ? 0.75 : age >= 47 ? 0.45 : age >= 44 ? 0.3 : age >= 41 ? 0.15 : 0.06)) * mul * 1.3;
      if (hz > 0 && J.rng('faret' + f.key + yr)() < Math.min(0.97, hz)) { S.retired = S.retired || []; S.retired.push({ key: f.key, name: f.name, age: age, year: yr, series: sid, team: f.from || '', car: f.car || '', base: f.base || 60, rl: f.rl || null, birth: f.birth != null ? f.birth : null, fictional: !!f.fictional }); S.freeAgents = (S.freeAgents || []).filter(function (x) { return x.key !== f.key; }); res.retired = (res.retired || []).concat(f.name + ' (' + age + ')'); return false; } return true; }); }
  fl.forEach(function (f) { f._s = J.careerOf(f.key, f, sid).s; }); fl.sort(function (a, b) { return b._s - a._s; });
  var tsC = {}, teamS = function (L, tid) {
    var ck = L.series.id + '|' + tid; if (ck in tsC) return tsC[ck];
    var a = []; Object.keys(L.contracts || {}).forEach(function (k) { var c = L.contracts[k]; if (c.team === tid && !c.pt && !c.released && !c.callup) a.push(J.careerOf(k, c, L.series.id).s); });
    return (tsC[ck] = a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0.3 * (SW[L.series.id] || 1));
  };
  var movedIn = function (L) { return (L.moves || []).filter(function (m) { return m.status === 'approved' && m.to === L.series.id && m.kind === 'promote' && !(m.applied && m.applied[L.id]); }).length; };
  var Lu = up && cur(up), Ld = dn && cur(dn), med = {}; if (Lu) med.up = medianS(Lu);
  var done = {}, own = 0;
  fl.forEach(function (f) {
    var rr = J.rng('place' + f.key + yr + sid), s = f._s, seats = [];
    var fit = function (L, o) { return 1 - Math.abs(teamS(L, o.tid) - s) * 1.2 + rr() * 0.4; };
    J.openCars(S).filter(function (o) { return o.tid !== f.fromId; }).forEach(function (o) { seats.push({ L: S, o: o, sc: fit(S, o) }); });
    if (!seats.length) J.openCars(S).forEach(function (o) { seats.push({ L: S, o: o, sc: fit(S, o) }); }); // the only open car is his old team's
    if (Lu && s >= med.up * 0.92 && movedIn(Lu) < 4) J.openCars(Lu).forEach(function (o) { seats.push({ L: Lu, o: o, sc: fit(Lu, o) + (s > med.up ? 0.15 : -0.05) }); });
    var pick = null;
    if (seats.length) { seats.sort(function (a, b) { return b.sc - a.sc; }); pick = seats[0]; }
    else if (Ld) { var ds = J.openCars(Ld).map(function (o) { return { L: Ld, o: o, sc: fit(Ld, o) }; }); ds.sort(function (a, b) { return b.sc - a.sc; }); pick = ds[0] || null; }
    if (pick && pick.L === S) {
      S.contracts[f.key] = { name: f.name, team: pick.o.tid, car: pick.o.num, through: yr + 1 + (rr() < 0.5 ? 1 : 0), base: f.base || 60, rl: f.rl || null, auto: false, pt: false, ptSet: true, signedFa: yr, birth: f.birth != null ? f.birth : undefined, fictional: f.fictional || undefined };
      res.full++; own++; res.list.push(f.name + ' (' + pick.o.team + ' #' + pick.o.num + ')');
    } else if (pick) { // another series: an approved move, applied there when that series starts its new season (right now if it already has)
      var T = pick.L, m = { id: J.uid('mv'), kind: LAD.indexOf(T.series.id) > LAD.indexOf(sid) ? 'promote' : 'demote', key: f.key, name: f.name, from: sid, to: T.series.id, teamId: pick.o.tid, team: pick.o.team, car: pick.o.num, season: yr, through: yr + 1 + (rr() < 0.5 ? 1 : 0), status: 'approved', fa: true, approvedAt: Date.now(), made: Date.now(), why: ['free agent, ' + Math.round(s * 100) + ' career rating, ' + J.careerOf(f.key, f, sid).note.replace(/[()]/g, '')], fromTeam: f.from || '', fromTeamId: f.fromId || '', fromCar: f.car || '', applied: {} };
      S.moves = S.moves || []; var mine = JSON.parse(JSON.stringify(m)); mine.applied[S.id] = true; S.moves.push(mine);
      T.moves = T.moves || []; var theirs = JSON.parse(JSON.stringify(m)); T.moves.push(theirs);
      if (J.seasonNum(T) >= theirs.season) applyOne(theirs, T);
      dirty(T); res.full++; res.list.push(f.name + ' → ' + T.series.label + ' (' + pick.o.team + ' #' + pick.o.num + ', ' + (m.kind === 'promote' ? 'moves up' : 'steps down') + ')');
    } else { // every car is full: part-time with a team that fits
      var tids = Object.keys(S.teams || {}); if (!tids.length) { res.left++; return; }
      var ft = tids.filter(function (t) { return t !== f.fromId; }); if (!ft.length) ft = tids;
      ft.sort(function (a, b) { return (1 - Math.abs(teamS(S, b) - s) + rr() * 0.4) - (1 - Math.abs(teamS(S, a) - s) + rr() * 0.4); });
      var tid = ft[0], cs = J.teamCars(S, tid), num = cs.length ? cs[Math.floor(rr() * cs.length)] : '';
      S.contracts[f.key] = { name: f.name, team: tid, car: num, through: yr + 1 + (rr() < 0.5 ? 1 : 0), base: f.base || 60, rl: f.rl || null, auto: false, pt: true, ptSet: true, signedFa: yr, birth: f.birth != null ? f.birth : undefined, fictional: f.fictional || undefined };
      res.part++; res.list.push(f.name + ' (part-time, ' + S.teams[tid].name + (num ? ' #' + num : '') + ')');
    }
    done[f.key] = 1;
  });
  S.freeAgents = (S.freeAgents || []).filter(function (f) { return !done[f.key]; }); res.left = S.freeAgents.length;
  // the entry-level series brings in new young drivers for seats nobody was found for (not more than there were vacancies)
  if (!dn && !only && J.spawnRookies && !(J.settings && J.settings.rookies === false) && S.vacated > 0) {
    var want = Math.min(S.vacated - own, 6); S.vacated = 0;
    if (want > 0) { var made = J.spawnRookies(S, want); res.rookies = made; made.forEach(function (x) { res.list.push('Rookie ' + x); }); res.full += made.length; }
  }
  J.noteCars(S);
  return res;
};
J.acts.faPlace = function (quiet) {
  var tot = { full: 0, part: 0, left: 0, retired: 0, rookies: 0 }; (J.ui.cmAll ? LAD : [J.S.series.id]).forEach(function (s) { var L = cur(s); if (!L || !(L.freeAgents || []).length) return; var r = J.placeFreeAgents(L); tot.full += r.full; tot.part += r.part; tot.left += r.left; tot.retired += (r.retired || []).length; tot.rookies += (r.rookies || []).length; dirty(L); });
  saveAll(); if (quiet === true) return; J.toast((tot.retired ? tot.retired + ' retired, ' : '') + (tot.rookies ? tot.rookies + ' new young drivers, ' : '') + tot.full + ' signed full-time, ' + tot.part + ' part-time' + (tot.left ? ', ' + tot.left + ' still unsigned' : '') + '.');
};
J.acts.carAdd = async function (el) {
  var S = J.S, t = S.teams[el.dataset.id]; if (!t) return;
  var v = await J.ask('Add a car for ' + t.name, 'Car number', ''); v = (v || '').replace(/^#/, '').trim(); if (!v) return;
  t.closed = (t.closed || []).filter(function (x) { return x !== v; }); t.cars = t.cars || []; if (t.cars.indexOf(v) < 0) t.cars.push(v); J.save();
};
J.acts.carClose = function (el) {
  var S = J.S, t = S.teams[el.dataset.id], v = el.dataset.num; if (!t) return;
  t.cars = (t.cars || []).filter(function (x) { return x !== v; }); t.closed = (t.closed || []).concat([v]); J.save();
};
// the dropdown for signing a free agent: every open car by team, then a part-time ride if all are full
function signOptions(L, f) {
  var open = J.openCars(L), by = {};
  open.forEach(function (o) { (by[o.tid] = by[o.tid] || []).push(o); });
  var html = '<option value="">Choose a car…</option>';
  if (open.length) html += '<optgroup label="Open full-time cars">' + Object.keys(by).sort(function (a, b) { return L.teams[a].name.localeCompare(L.teams[b].name); }).map(function (t) { return by[t].map(function (o) { return '<option value="' + esc(o.tid + '|' + o.num) + '">' + esc(o.team) + ' #' + esc(o.num) + (o.tid === f.fromId ? ' (his old team)' : '') + '</option>'; }).join(''); }).join('') + '</optgroup>';
  html += '<optgroup label="' + (open.length ? 'Or part-time with' : 'No open cars, part-time with') + '">' + Object.keys(L.teams || {}).sort(function (a, b) { return L.teams[a].name.localeCompare(L.teams[b].name); }).map(function (t) { return '<option value="' + esc(t + '|pt') + '">' + esc(L.teams[t].name) + ' (part-time)</option>'; }).join('') + '</optgroup>';
  return html;
}
// who re-signs: the commissioner decides. "Let go" = not renewed at rollover; he joins the free agent pool and is signed by another team
function resignPanel(S, all) {
  var rows = [];
  (all ? LAD : [S.series.id]).forEach(function (s) {
    var L = cur(s); if (!L) return; var y = J.seasonNum(L);
    Object.keys(L.contracts || {}).forEach(function (k) { var c = L.contracts[k]; if (!c || !c.name || c.callup || c.released || !c.team) return; if (c.through <= y || c.resign) rows.push({ s: s, L: L, k: k, c: c }); });
  });
  rows.sort(function (a, b) { return LAD.indexOf(a.s) - LAD.indexOf(b.s) || a.c.name.localeCompare(b.c.name); });
  var opt = function (v, cv, label) { return '<option value="' + v + '"' + ((cv || '') === v ? ' selected' : '') + '>' + label + '</option>'; };
  return '<section class="panel" id="resignPanel"><h3>Step 2: Contracts that end this season</h3><p class="sub">Leave everyone on <b>Automatic</b> and the app decides. Pick <b>Let go</b> to make a driver a free agent when the season rolls over (he gets signed somewhere else), or <b>Re-sign</b> to make sure he stays.</p>'
    + (rows.length ? '<div class="tw"><table class="data"><thead><tr>' + (all ? '<th>Series</th>' : '') + '<th>Driver</th><th>Team</th><th>Through</th><th>What happens</th></tr></thead><tbody>' + rows.map(function (r) { var t = r.c.team && r.L.teams[r.c.team]; return '<tr>' + (all ? '<td>' + esc(sLabel(r.s)) + '</td>' : '') + '<td><b>' + esc(r.c.name) + '</b></td><td>' + esc(t ? t.name : '') + (r.c.car ? ' #' + esc(r.c.car) : '') + '</td><td>' + esc(r.c.through) + '</td><td><select data-rs="' + esc(r.k) + '" data-sid="' + esc(r.s) + '" aria-label="What happens to ' + esc(r.c.name) + '">' + opt('', r.c.resign, 'Automatic') + opt('yes', r.c.resign, 'Re-sign') + opt('no', r.c.resign, 'Let go') + '</select></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim">Nobody has a deal ending this season.</p>')
    + '</section>';
}
// free agents: anyone without a ride. One button signs them all (full-time cars first, then part-time); or pick a car yourself.
J.freeAgentPanel = function (S, all) {
  var fa = [];
  (all ? LAD : [S.series.id]).forEach(function (s) { var L = cur(s); (L && L.freeAgents || []).forEach(function (f) { fa.push({ s: s, f: f, L: L }); }); });
  var open = 0; (all ? LAD : [S.series.id]).forEach(function (s) { var L = cur(s); if (L) open += J.openCars(L).length; });
  return '<section class="panel" id="faPanel"><h3>Step 3: Free agents (' + fa.length + ')</h3><p class="sub">Drivers without a ride. <b>Sign them all</b> gives each one an open full-time car first (better drivers get better cars, and the very best can move up a series); if every car is full he goes part-time. Right now there ' + (open === 1 ? 'is 1 open car' : 'are ' + open + ' open cars') + '. Or pick a car for a driver yourself.</p>'
    + (fa.length ? '<div class="row"><button class="btn sm" data-act="faPlace">Sign them all</button></div><div class="tw"><table class="data"><thead><tr>' + (all ? '<th>Series</th>' : '') + '<th>Driver</th><th>Last team</th><th>Rating</th><th>Pick a car</th></tr></thead><tbody>' + fa.map(function (x) { var cs = J.careerOf(x.f.key, x.f, x.s); return '<tr>' + (all ? '<td>' + esc(sLabel(x.s)) + '</td>' : '') + '<td><b>' + esc(x.f.name) + '</b></td><td>' + esc(x.f.from || 'no team') + '</td><td>' + Math.round(cs.s * 100) + '<small class="dim"> ' + esc(cs.note) + '</small></td><td><select data-fa="' + esc(x.f.key) + '" data-sid="' + esc(x.s) + '" aria-label="Sign ' + esc(x.f.name) + '">' + signOptions(x.L, x.f) + '</select></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim">No free agents right now. Drivers you let go or teams release show up here when the next season starts.</p>')
    + (S.placed && S.placed.length ? '<details style="margin-top:10px"><summary>Signed when this season started (' + S.placed.length + ')</summary><ul class="plain">' + S.placed.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '')
    + '</section>';
};
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.dataset || !t.dataset.sid) return;
  if (t.dataset.rs != null) {
    var L = cur(t.dataset.sid), c = L && L.contracts[t.dataset.rs]; if (!c) return;
    if (t.value) c.resign = t.value; else delete c.resign;
    if (t.value === 'no') Object.keys(J.leagues || {}).forEach(function (k) { var X = J.leagues[k]; if (X.archived) return; var n = (X.moves || []).length; X.moves = (X.moves || []).filter(function (m) { return !(m.key === t.dataset.rs && m.status === 'proposed' && (m.kind === 'renew' || (m.kind === 'move' && m.free))); }); if (X.moves.length !== n) dirty(X); });
    dirty(L); saveAll(); J.render();
  } else if (t.dataset.fa != null && t.value) {
    var L2 = cur(t.dataset.sid); if (!L2) return;
    var fl = L2.freeAgents || [], i = -1; fl.forEach(function (f, n) { if (f.key === t.dataset.fa) i = n; }); if (i < 0) return;
    var f = fl[i], parts = t.value.split('|'), tm = L2.teams[parts[0]]; if (!tm) return;
    var pt = parts[1] === 'pt', num = pt ? '' : parts[1];
    if (pt) { var cs = J.teamCars(L2, parts[0]); num = cs.length ? cs[0] : ''; }
    L2.contracts[f.key] = { name: f.name, team: parts[0], car: num, through: J.seasonNum(L2) + 1 + (J.rng('fa' + f.key)() < 0.5 ? 1 : 0), base: f.base || 60, rl: f.rl || null, auto: false, pt: pt, ptSet: true, signedFa: J.seasonNum(L2), birth: f.birth != null ? f.birth : undefined, fictional: f.fictional || undefined };
    fl.splice(i, 1); L2.freeAgents = fl; J.noteCars(L2); dirty(L2); saveAll(); J.toast(f.name + ' signs with ' + tm.name + (num ? ' (#' + num + (pt ? ', part-time' : '') + ')' : '') + '.'); J.render();
  }
});
J.routes.careers = function (S) {
  var cleaned = 0; LAD.forEach(function (s) { var L = cur(s); if (L) { var n = J.cleanMoves(L); if (n) { cleaned += n; dirty(L); } } }); if (cleaned) saveAll(); // old seasons' moves never sit on this screen
  var sid = S.series.id, nx = J.nextRound(S), all = !!J.ui.cmAll, fall = (J.settings && J.settings.fallout) || 'normal';
  var mv = (S.moves || []).slice(); if (all) { mv = []; var seen = {}; LAD.forEach(function (s) { var L = cur(s); (L && L.moves || []).forEach(function (m) { if (!seen[m.id]) { seen[m.id] = 1; mv.push(m); } }); }); }
  var order = { fire: 0, retire: 1, demote: 2, promote: 3, move: 4, fulltime: 5, renew: 6 }; mv.sort(function (a, b) { return (a.status === 'rejected') - (b.status === 'rejected') || (order[a.kind] - order[b.kind]) || a.name.localeCompare(b.name); });
  var proposed = mv.some(function (m) { return m.status === 'proposed'; }), auto = !(J.settings && J.settings.autopilot === false);
  var out = J.phead('Career Moves', 'Who drives where next year, in three steps. Or press one button and let the app do it.');
  out += '<section class="panel"><h3>Let the app do it</h3><p class="sub">Press the button and the app decides the whole offseason: who re-signs, who gets released, who moves up or down a series, and who signs a free agent\'s open car. It looks at every season a driver has run, not just this one. Then press <b>Finish season, start next</b> on the League page.</p>'
    + '<div class="row"><button class="btn" data-act="cmAuto">Run the offseason for me</button><label class="chk"><input type="checkbox" id="cmAll"' + (all ? ' checked' : '') + '> Show every series</label></div>'
    + '<label class="check"><input type="checkbox" id="apOn"' + (auto ? ' checked' : '') + '> Autopilot: when I press Finish season, approve any moves I have not decided on (moves I rejected stay rejected)</label></section>';
  // step 1: moves
  out += '<section class="panel"><h3>Step 1: Moves for next season</h3><p class="sub">Suggested from results, contracts, team happiness and real-life announcements. <b>Approve</b> the ones you like; they happen when the next season starts.</p>'
    + '<div class="row artopts"><label class="field" style="margin:0"><span>How often teams fall out with drivers</span><select id="falloutSel">' + [['off', 'Never'], ['rare', 'Rarely'], ['normal', 'Sometimes (like real life)'], ['wild', 'A lot (drama)']].map(function (o) { return '<option value="' + o[0] + '"' + (fall === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label><label class="field" style="margin:0"><span>Retirements</span><select id="retireSel">' + [['off', 'Nobody retires'], ['rare', 'Less often'], ['normal', 'Realistic by age'], ['more', 'More often']].map(function (o) { return '<option value="' + o[0] + '"' + (((J.settings && J.settings.retire) || 'normal') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>'
    + (mv.length ? mv.map(function (m) { return moveRow(m, S); }).join('') : '<p class="dim">No moves yet. Click Suggest moves.</p>')
    + '<div class="row"><button class="btn sm" data-act="cmSuggest">' + (proposed ? 'Suggest again' : 'Suggest moves') + '</button>' + (proposed ? '<button class="btn ghost sm" data-act="mvAll">Approve all suggestions</button>' : '') + '</div></section>';
  out += resignPanel(S, all) + J.freeAgentPanel(S, all);
  // extras
  var gs = carGroupsOf(S).filter(function (g) { return g.members.length > 1 || g.members.some(function (m) { return m.callup; }); });
  var cus = (S.callups || []).slice().sort(function (a, b) { return (a.status === 'rejected') - (b.status === 'rejected'); });
  var lg = S.moveLog && S.moveLog.list || [];
  out += '<details class="panel" style="padding:14px 18px"><summary><b>Last offseason' + (lg.length ? ' (' + lg.length + ' moves)' : '') + '</b></summary><p class="sub">What happened going into ' + esc(String(S.moveLog ? S.moveLog.season : '')) + '. Just a record; it does not stop anyone from moving this year.</p>'
    + (lg.length ? '<ul class="dim">' + lg.map(function (m) { return '<li>' + esc(m.name) + ': ' + esc(m.kind) + (m.to ? ' to ' + esc(sLabel(m.to)) : '') + (m.team ? ', ' + esc(m.team) + (m.car ? ' #' + esc(m.car) : '') : '') + '</li>'; }).join('') + '</ul>' : '<p class="dim">Nothing logged yet.</p>') + '</details>';
  out += '<details class="panel" style="padding:14px 18px"><summary><b>Extras: retired drivers, call-ups and shared cars</b></summary>' + (J.retiredPanel ? J.retiredPanel(S, all, LAD, cur, sLabel) : '')
    + '<h3 style="margin-top:14px">Call-ups this season</h3><p class="sub">A standout from the series below gets a few starts in a part-time car. Approve one and he is put in the car for those races.</p>'
    + (cus.length ? cus.map(function (c) { return cuRow(c, S); }).join('') : '<p class="dim">None yet.</p>') + '<div class="row"><button class="btn sm" data-act="cmCallups">Suggest call-ups</button></div>'
    + '<h3 style="margin-top:14px">Shared cars: who drives ' + (nx ? 'at ' + esc(nx.name) : 'next') + '</h3><p class="sub">NR2003 shows one driver per car. When you import a race the app swaps in the driver picked here (you can turn that off on the import screen).</p>'
    + (nx && gs.length ? '<div class="tw"><table class="data cwk"><thead><tr><th>Car</th><th>Team</th><th>This week</th></tr></thead><tbody>' + gs.map(function (g) { var p = J.carPick(S, nx.id, g); return '<tr><td>' + J.carTag(g.car) + '</td><td>' + esc(g.team) + '</td><td><select data-cw="' + esc(g.key) + '" data-r="' + esc(nx.id) + '" aria-label="Driver of the #' + esc(g.car) + '">' + g.members.map(function (m) { return '<option' + (m.name === p ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim">No shared cars this week.</p>')
    + '</details>';
  return out;
};
J.nav.push({ id: 'careers', label: 'Career Moves', group: 'Commissioner', admin: true });
J.acts.cmSuggest = function () {
  // the first click brings in the moves announced in real life; "Suggest again" is a new slate, so those are left out (approved ones stay)
  var again = LAD.some(function (s) { var L = cur(s); return L && (L.moves || []).some(function (m) { return m.status === 'proposed'; }); });
  var n = J.suggestMoves(Date.now(), { real: !again });
  J.toast(again ? J.plural(n.length, 'move') + ' in a fresh slate (real announced moves left out; approved ones stay).' : J.plural(n.length, 'move') + ' suggested across the series.');
};
// one button: moves (real announced ones included the first time), everything approved
J.autoOffseason = function () {
  // free agents who signed in another series are moves too, but they are not a offseason slate: only suggest when nothing else is there yet
  var any = LAD.some(function (s) { var L = cur(s); return L && (L.moves || []).some(function (m) { return !m.fa; }); });
  if (!any) J.suggestMoves(Date.now(), { real: true });
  var list = [], seen = {};
  LAD.forEach(function (s) { var L = cur(s); (L && L.moves || []).forEach(function (m) { if (m.status === 'proposed' && !seen[m.id]) { seen[m.id] = 1; list.push(m); } }); });
  list.forEach(approve); saveAll(); return list.length;
};
J.acts.cmAuto = function () {
  var n = J.autoOffseason(), fa = 0; LAD.forEach(function (s) { var L = cur(s); if (L) fa += (L.freeAgents || []).length; });
  if (fa) J.acts.faPlace(true);
  J.toast(n + ' moves approved' + (fa ? ', free agents signed' : '') + '. When the season is over, press Finish season, start next on the League page.'); J.refresh();
};
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
  if (t.id === 'retireSel') { J.settings.retire = t.value; J.saveSettings(); J.toast('Saved. Click Suggest again to see who retires.'); return; }
  if (t.id === 'cmAll') { J.ui.cmAll = t.checked; J.refresh(); return; }
  if (t.id === 'apOn') { J.settings.autopilot = t.checked; J.saveSettings(); J.toast(t.checked ? 'Autopilot on.' : 'Autopilot off. You approve every move yourself.'); return; }
  if (t.dataset && t.dataset.cw) { S.carWeek = S.carWeek || {}; (S.carWeek[t.dataset.r] = S.carWeek[t.dataset.r] || {})[t.dataset.cw] = t.value; J.save({ render: false }); }
});
})();
