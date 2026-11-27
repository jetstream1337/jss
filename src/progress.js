/* Virtual NASCAR - ratings and progression (commissioner only, never published).
   Ratings use the same layout as the NR Ratings app: Driver (8), Vehicle (4) and Pitcrew (3), each with a Min and a Max.
   After a season the ratings move with how the driver and team really ran, like player progression in a sports game:
   an attribute can go up by 1 or by 15 or fall by 10, it all depends on the results. */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
var DRV = [['aggression', 'Aggression'], ['consistency', 'Consistency'], ['finishing', 'Finishing'], ['qualifying', 'Qualifying'], ['road', 'Road Course'], ['short', 'Short Track'], ['speedway', 'Speedway'], ['super', 'Super Speedway']];
var VEH = [['aero', 'Aerodynamics'], ['chassis', 'Chassis'], ['engine', 'Engine'], ['reliability', 'Reliability']];
var PIT = [['pcons', 'Consistency'], ['pspeed', 'Speed'], ['pstrat', 'Strategy']];
var DW = { aggression: 0.08, consistency: 0.2, finishing: 0.2, qualifying: 0.1, road: 0.1, short: 0.1, speedway: 0.1, super: 0.12 };
var GROUP = { super: 'super', short: 'short', road: 'road', inter: 'speedway', unique: 'speedway' };
var MECH = /engine|mechanic|transmission|overheat|oil|fuel|brake|suspension|axle|gear|clutch|vibration|valve|piston|electric|ignition|radiator|water|steering|driveshaft|rear end|differential|cooling|tire|tyre|wheel|part/i;
J.RT = { DRV: DRV, VEH: VEH, PIT: PIT };
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function cur(S) { return S.ratings = S.ratings || { drivers: {}, teams: {}, cfg: { strength: 'normal', auto: true }, progressed: null }; }
var mid = J.rtMid = function (a) { return a ? (a[0] + a[1]) / 2 : 50; };
function pct(pos, n) { return n > 1 ? 1 - (pos - 1) / (n - 1) : 0.5; }
function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function sd(a) { if (a.length < 2) return 0.27; var m = avg(a); return Math.sqrt(avg(a.map(function (x) { return (x - m) * (x - m); }))); }

/* ---------- the ratings themselves ---------- */
J.rtOverall = function (rec) { var s = 0; DRV.forEach(function (a) { s += mid(rec.a[a[0]]) * DW[a[0]]; }); return s; };
J.rtTeamOverall = function (rec) { var v = 0, p = 0; VEH.forEach(function (a) { v += mid(rec.a[a[0]]); }); PIT.forEach(function (a) { p += mid(rec.a[a[0]]); }); return (v / VEH.length) * 0.7 + (p / PIT.length) * 0.3; };
function spread(rng, v, lo, hi) { var sp = lo + Math.floor(rng() * (hi - lo + 1)); return [clamp(Math.round(v - sp), 0, 100), clamp(Math.round(v + sp), 0, 100)]; }
J.rtDriver = function (S, key) {
  var r = cur(S); if (r.drivers[key]) return r.drivers[key];
  var c = (S.contracts || {})[key] || {}, o = c.rl && c.rl.s != null ? 38 + c.rl.s * 52 : (c.base != null && isFinite(+c.base) ? +c.base : 55);
  var rng = J.rng('rt' + S.series.id + key), rec = { a: {}, last: {}, was: null };
  DRV.forEach(function (a) { rec.a[a[0]] = spread(rng, o + (rng() - 0.5) * 16, 3, 6); });
  return (r.drivers[key] = rec);
};
J.rtTeam = function (S, tid) {
  var r = cur(S); if (r.teams[tid]) return r.teams[tid];
  var vals = []; Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (c.team === tid && !c.pt && !c.released && !c.callup) vals.push(J.rtOverall(J.rtDriver(S, k))); });
  var o = vals.length ? avg(vals) : 50, rng = J.rng('rtt' + S.series.id + tid), rec = { a: {}, last: {}, was: null };
  VEH.concat(PIT).forEach(function (a) { rec.a[a[0]] = spread(rng, o + (rng() - 0.5) * 14, 3, 6); });
  return (r.teams[tid] = rec);
};
// what the ratings do in the sim: track-type specialties, the car (aero/chassis/engine) and reliability / consistency
var TYPEATTR = { super: 'super', inter: 'speedway', unique: 'speedway', short: 'short', road: 'road' };
J.rtMods = function (S, key) {
  var R = S.ratings, rec = R && R.drivers && R.drivers[key]; if (!rec) return null;
  var c = (S.contracts || {})[key] || {}, o = J.rtOverall(rec), tr = c.team && R.teams && R.teams[c.team], type = {};
  var car = tr ? (J.rtTeamOverall(tr) - 50) / 100 * 0.3 : 0;
  Object.keys(TYPEATTR).forEach(function (t) { var a = rec.a[TYPEATTR[t]]; type[t] = a ? (mid(a) - o) / 100 * 0.6 + car : car; });
  var rel = tr && tr.a.reliability ? mid(tr.a.reliability) : 50, cons = rec.a.consistency ? mid(rec.a.consistency) : 50;
  return { type: type, dnf: clamp(1 + (50 - cons) / 250 + (50 - rel) / 250, 0.6, 1.6) };
};
J.rtSeedAll = function (S) {
  Object.keys(S.contracts || {}).forEach(function (k) { var c = S.contracts[k]; if (c && c.name && !c.callup && !c.released) J.rtDriver(S, k); });
  Object.keys(S.teams || {}).forEach(function (t) { J.rtTeam(S, t); });
};

/* ---------- progression: what the season did to everyone ---------- */
var STRENGTH = { low: 18, normal: 30, high: 45 };
J.progressionPlan = function (S) {
  var R = cur(S); J.rtSeedAll(S);
  var M = STRENGTH[R.cfg.strength || 'normal'] || 30, yr = J.seasonNum(S), minStarts = Math.max(3, Math.round(Math.max(S.races.length, 1) * 0.25)), fieldN = 20;
  var E = {}, TE = {};
  S.races.forEach(function (race) {
    var n = race.rows.length, G = GROUP[J.raceType(S, race)] || 'speedway'; fieldN = Math.max(fieldN, n);
    race.rows.forEach(function (r) {
      var k = J.driverKey(r.driver), c = S.contracts[k], p = pct(r.position, n), sp = pct(r.start || r.position, n), gain = ((r.start || r.position) - r.position) / n, dnf = J.isDnf(r), mech = dnf && MECH.test(String(r.status || '')) && !/crash|accident|wreck|spin|collision|contact/i.test(String(r.status || ''));
      var e = E[k] || (E[k] = { key: k, name: r.driver.trim(), p: [], sp: [], gain: [], by: { super: [], short: [], road: [], speedway: [] }, dnf: 0, wins: 0, t5: 0 });
      e.p.push(p); e.sp.push(sp); e.gain.push(gain); e.by[G].push(p); if (dnf) e.dnf++; if (r.position === 1) e.wins++; if (r.position <= 5) e.t5++;
      var t = c && c.team; if (t) { var te = TE[t] || (TE[t] = { id: t, p: [], sp: [], gain: [], by: { super: [], short: [], road: [], speedway: [] }, dnf: 0, mech: 0 }); te.p.push(p); te.sp.push(sp); te.gain.push(gain); te.by[G].push(p); if (dnf) te.dnf++; if (mech) te.mech++; }
    });
  });
  var plan = { year: yr, drivers: {}, teams: {}, races: S.races.length, strength: R.cfg.strength || 'normal' };
  // expected finish from the current ratings: where the rating ranks him among the drivers who ran enough
  var list = Object.keys(E).filter(function (k) { return E[k].p.length >= minStarts; }).sort(function (a, b) { return J.rtOverall(J.rtDriver(S, b)) - J.rtOverall(J.rtDriver(S, a)); }), N = list.length, expP = {};
  list.forEach(function (k, i) { expP[k] = N > 1 ? 1 - i / (N - 1) : 0.5; });
  var sc = function (over, abs) { return 0.6 * over + 0.4 * abs; };
  list.forEach(function (k) {
    var e = E[k], c = S.contracts[k] || {}, rt = J.rtDriver(S, k), ex = expP[k], rng = J.rng('prog' + S.series.id + k + yr), ap = avg(e.p), aq = avg(e.sp), dnfRate = e.dnf / e.p.length, g = avg(e.gain);
    var part = c.pt ? 0.6 : 1, age = c.age ? (c.age < 24 ? 3 : c.age <= 30 ? 0 : c.age <= 36 ? -1 : -3) : 0, d = {};
    var typeScore = function (G) { var arr = e.by[G], w = Math.min(1, arr.length / 3), at = arr.length ? avg(arr) : ap; return w * sc(at - ex, at - 0.5) + (1 - w) * 0.5 * sc(ap - ex, ap - 0.5); };
    var raw = {
      finishing: sc(ap - ex, ap - 0.5) * M + Math.min(6, e.wins * 1.5),
      qualifying: sc(aq - ex, aq - 0.5) * M,
      consistency: clamp((0.27 - sd(e.p)) * 3 - (dnfRate - 0.09) * 4, -1, 1.2) * 0.8 * M,
      aggression: clamp(g * 5, -1, 1.2) * 0.8 * M,
      road: typeScore('road') * M, short: typeScore('short') * M, speedway: typeScore('speedway') * M, super: typeScore('super') * M
    };
    DRV.forEach(function (a) { d[a[0]] = Math.round(raw[a[0]] * part + age + (rng() - 0.5) * 4); });
    var ovr = J.rtOverall(rt), after = 0; DRV.forEach(function (a) { var m = mid(rt.a[a[0]]); after += clamp(m + d[a[0]], 0, 100) * DW[a[0]]; });
    var expFin = Math.round((1 - ex) * (fieldN - 1) + 1);
    plan.drivers[k] = { name: c.name || e.name, team: c.team || '', starts: e.p.length, d: d, before: ovr, after: after, why: 'avg finish ' + (((1 - ap) * (fieldN - 1)) + 1).toFixed(1) + ' (rated for about P' + expFin + ')' + (e.wins ? ', ' + J.plural(e.wins, 'win') : '') + (e.dnf ? ', ' + J.plural(e.dnf, 'DNF') : '') };
  });
  // teams
  var tl = Object.keys(TE).filter(function (t) { return TE[t].p.length >= minStarts && S.teams[t]; }).sort(function (a, b) { return J.rtTeamOverall(J.rtTeam(S, b)) - J.rtTeamOverall(J.rtTeam(S, a)); }), tx = {};
  tl.forEach(function (t, i) { tx[t] = tl.length > 1 ? 1 - i / (tl.length - 1) : 0.5; });
  tl.forEach(function (t) {
    var e = TE[t], rt = J.rtTeam(S, t), ex = tx[t], rng = J.rng('progt' + S.series.id + t + yr), ap = avg(e.p), aq = avg(e.sp), g = avg(e.gain), mechRate = e.mech / e.p.length;
    var grp = function (gs) { var arr = []; gs.forEach(function (G) { arr = arr.concat(e.by[G]); }); var w = Math.min(1, arr.length / 4), at = arr.length ? avg(arr) : ap; return w * sc(at - ex, at - 0.5) + (1 - w) * 0.5 * sc(ap - ex, ap - 0.5); };
    var raw = {
      aero: grp(['super', 'speedway']) * M, chassis: grp(['short', 'road']) * M,
      engine: (0.5 * sc(ap - ex, ap - 0.5) + 0.5 * grp(['super'])) * M,
      reliability: clamp((0.045 - mechRate) * 10, -1, 1.2) * 0.8 * M,
      pcons: clamp((0.3 - sd(e.p)) * 3, -1, 1.2) * 0.8 * M, pspeed: clamp(g * 5, -1, 1.2) * 0.8 * M, pstrat: clamp((ap - aq) * 4, -1, 1.2) * 0.8 * M
    }, d = {};
    VEH.concat(PIT).forEach(function (a) { d[a[0]] = Math.round(raw[a[0]] * 0.8 + (rng() - 0.5) * 4); });
    var t0 = J.rtTeamOverall(rt), tmp = { a: {} }; VEH.concat(PIT).forEach(function (a) { var m = mid(rt.a[a[0]]); tmp.a[a[0]] = [clamp(m + d[a[0]], 0, 100), clamp(m + d[a[0]], 0, 100)]; });
    plan.teams[t] = { name: S.teams[t].name, d: d, before: t0, after: J.rtTeamOverall(tmp), starts: e.p.length };
  });
  return plan;
};
J.applyProgression = function (S, plan) {
  var R = cur(S); plan = plan || J.progressionPlan(S);
  R.snap = JSON.stringify({ drivers: R.drivers, teams: R.teams, bases: baseMap(S) });
  var shift = function (rec, d) { rec.last = {}; Object.keys(d).forEach(function (k) { var v = rec.a[k]; if (!v) return; var mn = clamp(v[0] + d[k], 0, 100), mx = clamp(v[1] + d[k], 0, 100); rec.last[k] = Math.round(mid([mn, mx]) - mid(v)); rec.a[k] = [mn, mx]; }); };
  Object.keys(R.drivers).forEach(function (k) { R.drivers[k].last = {}; R.drivers[k].was = null; });
  Object.keys(R.teams).forEach(function (t) { R.teams[t].last = {}; R.teams[t].was = null; });
  Object.keys(plan.drivers).forEach(function (k) { var rec = J.rtDriver(S, k); rec.was = J.rtOverall(rec); shift(rec, plan.drivers[k].d); var c = S.contracts[k]; if (c) c.base = Math.round(J.rtOverall(rec)); });
  Object.keys(plan.teams).forEach(function (t) { var rec = J.rtTeam(S, t); rec.was = J.rtTeamOverall(rec); shift(rec, plan.teams[t].d); });
  R.progressed = plan.year; R.ranAt = Date.now(); R.ranRaces = plan.races;
  return plan;
};
function baseMap(S) { var m = {}; Object.keys(S.contracts || {}).forEach(function (k) { if (S.contracts[k].base != null) m[k] = S.contracts[k].base; }); return m; }
J.undoProgression = function (S) {
  var R = cur(S); if (!R.snap) return false;
  var o = JSON.parse(R.snap); R.drivers = o.drivers; R.teams = o.teams; Object.keys(o.bases || {}).forEach(function (k) { if (S.contracts[k]) S.contracts[k].base = o.bases[k]; });
  R.snap = null; R.progressed = null; return true;
};
// when a season is finished: progression runs by itself (unless turned off), once
J.progressAuto = function (S) {
  var R = cur(S); if (R.cfg.auto === false || R.progressed === J.seasonNum(S) || !S.races.length) return false;
  J.applyProgression(S); return true;
};

/* ---------- the page ---------- */
function chg(n) { n = Math.round(n); return n > 0 ? '<span class="rtup">+' + n + '</span>' : n < 0 ? '<span class="rtdn">' + n + '</span>' : '<span class="dim">0</span>'; }
function topMoves(last, lab) { var a = Object.keys(last || {}).filter(function (k) { return last[k]; }).sort(function (x, y) { return Math.abs(last[y]) - Math.abs(last[x]); }).slice(0, 3); return a.map(function (k) { return esc(lab[k]) + ' ' + chg(last[k]); }).join(', '); }
var LAB = {}; DRV.concat(VEH, PIT).forEach(function (a) { LAB[a[0]] = a[1]; });
J.routes.ratings = function (S) {
  var R = cur(S); J.rtSeedAll(S);
  var ds = Object.keys(R.drivers).filter(function (k) { var c = S.contracts[k]; return c && c.name && !c.released && !c.callup; }).map(function (k) { var c = S.contracts[k], rec = R.drivers[k], o = J.rtOverall(rec); return { k: k, c: c, rec: rec, o: o, ch: rec.was != null ? o - rec.was : null }; }).sort(function (a, b) { return b.o - a.o; });
  var ts = Object.keys(R.teams).filter(function (t) { return S.teams[t]; }).map(function (t) { var rec = R.teams[t], o = J.rtTeamOverall(rec); return { t: t, rec: rec, o: o, ch: rec.was != null ? o - rec.was : null }; }).sort(function (a, b) { return b.o - a.o; });
  var moved = ds.filter(function (x) { return x.ch != null && Math.round(x.ch); }), up = moved.slice().sort(function (a, b) { return b.ch - a.ch; }).slice(0, 5), dn = moved.slice().sort(function (a, b) { return a.ch - b.ch; }).filter(function (x) { return x.ch < 0; }).slice(0, 5);
  var out = J.phead('Ratings', 'Driver, vehicle and pit crew ratings in the NR Ratings layout. They move with how each driver and team runs.');
  out += '<section class="panel"><h3>Progression</h3><p class="sub">At the end of a season every rating moves with how the season went, like player progression in a sports game. A driver who beats what his rating says goes up, sometimes by 1, sometimes by 15 or more. One who runs worse than his rating goes down. Short-track results move Short Track, road courses move Road Course, and so on. Teams move too (Aerodynamics, Chassis, Engine, Reliability and the pit crew). It runs by itself when you press <b>Finish season, start next</b>, or you can run it now.</p>'
    + '<div class="row artopts"><label class="field" style="margin:0"><span>How big the changes are</span><select id="rtStrength">' + [['low', 'Small'], ['normal', 'Normal'], ['high', 'Big swings']].map(function (o) { return '<option value="' + o[0] + '"' + ((R.cfg.strength || 'normal') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>'
    + '<label class="check"><input type="checkbox" id="rtAuto"' + (R.cfg.auto === false ? '' : ' checked') + '> Run progression by itself when I press Finish season</label>'
    + '<div class="row"><button class="btn" data-act="rtPreview"' + (S.races.length ? '' : ' disabled') + '>Run progression now</button>' + (R.snap ? '<button class="btn ghost sm" data-act="rtUndo">Undo the last run</button>' : '') + '</div>'
    + (R.progressed ? '<p class="dim">Last run for the ' + esc(R.progressed) + ' season after ' + J.plural(R.ranRaces || 0, 'race') + '.</p>' : '<p class="dim">' + (S.races.length ? 'Not run yet this season.' : 'Run some races first: progression needs results.') + '</p>') + '</section>';
  if (moved.length) out += '<section class="panel"><h3>Biggest movers</h3><div class="two"><div><h4>Risers</h4>' + up.map(function (x) { return '<div class="mvrow"><b>' + esc(x.c.name) + '</b> <span class="dim">' + Math.round(x.o - x.ch) + ' to ' + Math.round(x.o) + '</span> ' + chg(x.ch) + '<small>' + topMoves(x.rec.last, LAB) + '</small></div>'; }).join('') + '</div><div><h4>Fallers</h4>' + (dn.length ? dn.map(function (x) { return '<div class="mvrow"><b>' + esc(x.c.name) + '</b> <span class="dim">' + Math.round(x.o - x.ch) + ' to ' + Math.round(x.o) + '</span> ' + chg(x.ch) + '<small>' + topMoves(x.rec.last, LAB) + '</small></div>'; }).join('') : '<p class="dim">Nobody fell.</p>') + '</div></div></section>';
  out += '<section class="panel"><h3>Drivers (' + ds.length + ')</h3><p class="sub">Overall is the weighted average of the eight driver ratings. Click Edit to see and change every Min and Max, laid out like NR Ratings.</p><div class="tw"><table class="data"><thead><tr><th>Driver</th><th>Team</th><th>Overall</th><th>Last change</th><th>Biggest moves</th><th></th></tr></thead><tbody>'
    + ds.map(function (x) { var t = x.c.team && S.teams[x.c.team]; return '<tr><td><b>' + esc(x.c.name) + '</b>' + (x.c.pt ? ' <small class="dim">part-time</small>' : '') + '</td><td>' + esc(t ? t.name : '') + (x.c.car ? ' #' + esc(x.c.car) : '') + '</td><td>' + Math.round(x.o) + '</td><td>' + (x.ch == null ? '' : chg(x.ch)) + '</td><td>' + topMoves(x.rec.last, LAB) + '</td><td><button class="btn ghost sm" data-act="rtEdit" data-k="' + esc(x.k) + '">Edit</button></td></tr>'; }).join('') + '</tbody></table></div></section>';
  out += '<section class="panel"><h3>Teams (' + ts.length + ')</h3><p class="sub">Vehicle (Aerodynamics, Chassis, Engine, Reliability) and Pitcrew (Consistency, Speed, Strategy).</p><div class="tw"><table class="data"><thead><tr><th>Team</th><th>Overall</th><th>Last change</th><th>Biggest moves</th><th></th></tr></thead><tbody>'
    + ts.map(function (x) { return '<tr><td><b>' + esc(S.teams[x.t].name) + '</b></td><td>' + Math.round(x.o) + '</td><td>' + (x.ch == null ? '' : chg(x.ch)) + '</td><td>' + topMoves(x.rec.last, LAB) + '</td><td><button class="btn ghost sm" data-act="rtEdit" data-t="' + esc(x.t) + '">Edit</button></td></tr>'; }).join('') + '</tbody></table></div></section>';
  out += '<section class="panel"><h3>Use them in NR Ratings</h3><p class="sub">Download the ratings as a spreadsheet to type into NR Ratings, or edit the numbers in a spreadsheet and bring the file back here. Keep the first row (the headers) as it is.</p><div class="row"><button class="btn sm" data-act="rtCsv" data-w="drivers">Download driver ratings</button><button class="btn sm" data-act="rtCsv" data-w="teams">Download team ratings</button><label class="btn ghost sm" style="cursor:pointer">Bring a spreadsheet back<input type="file" id="rtFile" accept=".csv,text/csv" hidden></label></div></section>';
  return out;
};
J.nav.push({ id: 'ratings', label: 'Ratings', group: 'Commissioner', admin: true });

/* editor, laid out like NR Ratings */
function block(title, attrs, rec) {
  return '<h4 style="margin:12px 0 4px;text-decoration:underline">' + title + '</h4>' + attrs.map(function (a) { var v = rec.a[a[0]] || [50, 50];
    return '<div class="rtrow"><span>' + esc(a[1]) + '</span><input type="number" min="0" max="100" id="rt_' + a[0] + '_0" value="' + v[0] + '" aria-label="' + esc(a[1]) + ' min"><input type="number" min="0" max="100" id="rt_' + a[0] + '_1" value="' + v[1] + '" aria-label="' + esc(a[1]) + ' max">' + (rec.last && rec.last[a[0]] ? chg(rec.last[a[0]]) : '') + '</div>'; }).join('');
}
J.acts.rtEdit = function (el) {
  var S = J.S, isT = !!el.dataset.t, id = el.dataset.t || el.dataset.k, rec = isT ? J.rtTeam(S, id) : J.rtDriver(S, id), nm = isT ? (S.teams[id] || {}).name : (S.contracts[id] || {}).name;
  $('dlgBody').innerHTML = '<div class="dlg-h"><h3>Ratings: ' + esc(nm || id) + '</h3><button class="dlg-x" data-act="closeDlg" aria-label="Close">&#10005;</button></div><div class="dlg-b"><div class="rtrow rthead"><span></span><b>Min</b><b>Max</b></div>'
    + (isT ? block('Vehicle', VEH, rec) + block('Pitcrew', PIT, rec) : block('Driver', DRV, rec))
    + '<div class="row"><button class="btn" data-act="rtSave" data-id="' + esc(id) + '" data-team="' + (isT ? 1 : 0) + '">Save</button><button class="btn ghost" data-act="closeDlg">Cancel</button></div></div>';
  $('dlg').showModal();
};
J.acts.rtSave = function (el) {
  var S = J.S, isT = el.dataset.team === '1', rec = isT ? J.rtTeam(S, el.dataset.id) : J.rtDriver(S, el.dataset.id);
  (isT ? VEH.concat(PIT) : DRV).forEach(function (a) { var lo = clamp(parseInt($('rt_' + a[0] + '_0').value, 10) || 0, 0, 100), hi = clamp(parseInt($('rt_' + a[0] + '_1').value, 10) || 0, 0, 100); rec.a[a[0]] = lo <= hi ? [lo, hi] : [hi, lo]; });
  if (!isT && S.contracts[el.dataset.id]) S.contracts[el.dataset.id].base = Math.round(J.rtOverall(rec));
  J.acts.closeDlg(); J.save(); J.toast('Ratings saved.');
};
J.acts.rtPreview = function () {
  var S = J.S, plan = J.progressionPlan(S), keys = Object.keys(plan.drivers).sort(function (a, b) { return Math.abs(plan.drivers[b].after - plan.drivers[b].before) - Math.abs(plan.drivers[a].after - plan.drivers[a].before); });
  J.ui.rtPlan = plan;
  if (!keys.length) { J.toast('Nobody has run enough races yet (at least 3, or a quarter of the schedule).', true); return; }
  $('dlgBody').innerHTML = '<div class="dlg-h"><h3>Progression: ' + esc(plan.year) + '</h3><button class="dlg-x" data-act="closeDlg" aria-label="Close">&#10005;</button></div><div class="dlg-b"><p class="sub">This is what the season would do. Nothing changes until you press Apply (you can undo it afterwards).</p><div class="tw"><table class="data"><thead><tr><th>Driver</th><th>Overall</th><th>Biggest moves</th><th>Why</th></tr></thead><tbody>'
    + keys.map(function (k) { var p = plan.drivers[k]; return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + Math.round(p.before) + ' to ' + Math.round(p.after) + ' ' + chg(p.after - p.before) + '</td><td>' + topMoves(p.d, LAB) + '</td><td><small>' + esc(p.why) + '</small></td></tr>'; }).join('') + '</tbody></table></div>'
    + (Object.keys(plan.teams).length ? '<h4 style="margin:12px 0 4px">Teams</h4><div class="tw"><table class="data"><tbody>' + Object.keys(plan.teams).map(function (t) { var p = plan.teams[t]; return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + Math.round(p.before) + ' to ' + Math.round(p.after) + ' ' + chg(p.after - p.before) + '</td><td>' + topMoves(p.d, LAB) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '')
    + '<div class="row"><button class="btn" data-act="rtApply">Apply progression</button><button class="btn ghost" data-act="closeDlg">Cancel</button></div></div>';
  $('dlg').showModal();
};
J.acts.rtApply = function () { var S = J.S; J.applyProgression(S, J.ui.rtPlan); J.ui.rtPlan = null; J.acts.closeDlg(); J.save(); J.toast('Progression applied. You can undo it on the Ratings page.'); };
J.acts.rtUndo = function () { if (!confirm('Undo the last progression run? Every rating goes back to how it was before.')) return; if (J.undoProgression(J.S)) { J.save(); J.toast('Back to the ratings from before the run.'); } };

/* ---------- spreadsheet out and in ---------- */
function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function csvParse(txt) {
  var rows = [], row = [], cell = '', q = false;
  for (var i = 0; i < txt.length; i++) { var ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; } else cell += ch; }
  row.push(cell); if (row.some(function (x) { return x !== ''; })) rows.push(row); return rows;
}
J.acts.rtCsv = function (el) {
  var S = J.S, isT = el.dataset.w === 'teams', attrs = isT ? VEH.concat(PIT) : DRV, head = [isT ? 'Team' : 'Driver'].concat(isT ? [] : ['Team', 'Car']);
  attrs.forEach(function (a) { var g = isT ? (VEH.indexOf(a) >= 0 ? 'Vehicle ' : 'Pitcrew ') : ''; head.push(g + a[1] + ' Min', g + a[1] + ' Max'); });
  var rows = [head], R = cur(S); J.rtSeedAll(S);
  if (isT) Object.keys(R.teams).filter(function (t) { return S.teams[t]; }).forEach(function (t) { rows.push([S.teams[t].name].concat([].concat.apply([], attrs.map(function (a) { return R.teams[t].a[a[0]]; })))); });
  else Object.keys(R.drivers).filter(function (k) { var c = S.contracts[k]; return c && c.name && !c.released && !c.callup; }).forEach(function (k) { var c = S.contracts[k]; rows.push([c.name, c.team && S.teams[c.team] ? S.teams[c.team].name : '', c.car || ''].concat([].concat.apply([], attrs.map(function (a) { return R.drivers[k].a[a[0]]; })))); });
  J.download('ratings-' + S.series.id + '-' + (isT ? 'teams' : 'drivers') + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'));
};
function importCsv(txt) {
  var S = J.S, rows = csvParse(txt), h = rows.shift(); if (!h) return 0;
  var isT = /^team/i.test(h[0]), attrs = isT ? VEH.concat(PIT) : DRV, col = {}, n = 0;
  attrs.forEach(function (a) { var g = isT ? (VEH.indexOf(a) >= 0 ? 'vehicle ' : 'pitcrew ') : ''; col[a[0]] = [h.findIndex(function (x) { return x.trim().toLowerCase() === g + a[1].toLowerCase() + ' min'; }), h.findIndex(function (x) { return x.trim().toLowerCase() === g + a[1].toLowerCase() + ' max'; })]; });
  J.rtSeedAll(S);
  rows.forEach(function (r) {
    var nm = (r[0] || '').trim(), id = null;
    if (isT) Object.keys(S.teams).forEach(function (t) { if (S.teams[t].name.toLowerCase() === nm.toLowerCase()) id = t; });
    else Object.keys(S.contracts).forEach(function (k) { if (J.driverKey(S.contracts[k].name || k) === J.driverKey(nm)) id = k; });
    if (!id) return;
    var rec = isT ? J.rtTeam(S, id) : J.rtDriver(S, id), hit = 0;
    attrs.forEach(function (a) { var c = col[a[0]]; if (c[0] < 0 || c[1] < 0) return; var lo = parseInt(r[c[0]], 10), hi = parseInt(r[c[1]], 10); if (isNaN(lo) || isNaN(hi)) return; lo = clamp(lo, 0, 100); hi = clamp(hi, 0, 100); rec.a[a[0]] = lo <= hi ? [lo, hi] : [hi, lo]; hit++; });
    if (hit) { n++; if (!isT && S.contracts[id]) S.contracts[id].base = Math.round(J.rtOverall(rec)); }
  });
  return n;
}
document.addEventListener('change', function (e) {
  var t = e.target, S = J.S; if (!t || !S) return;
  if (t.id === 'rtStrength') { cur(S).cfg.strength = t.value; J.save({ render: false }); J.toast('Saved.'); }
  else if (t.id === 'rtAuto') { cur(S).cfg.auto = t.checked; J.save({ render: false }); J.toast(t.checked ? 'Progression runs when you finish the season.' : 'Progression will not run by itself.'); }
  else if (t.id === 'rtFile' && t.files && t.files[0]) { var f = t.files[0], rd = new FileReader(); rd.onload = function () { var n = importCsv(String(rd.result || '')); J.save(); J.toast(n ? n + ' ratings rows updated.' : 'No matching rows found. Check the first row is the same as the downloaded file.', !n); }; rd.readAsText(f); t.value = ''; }
});
})();
