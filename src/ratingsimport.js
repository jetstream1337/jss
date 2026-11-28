/* Virtual NASCAR - fill ratings from NR Ratings (commissioner only).
   Drop a screenshot (or several) or an export file on the Ratings page and the ratings go in for each driver.
   Screenshots are read with the AI key; text/CSV/JSON exports are read locally (and by the AI when the layout is odd).
   Names are matched to drivers by name, then by car number. Anything the app is unsure about is shown once in a small list. */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc, RT = J.RT;
var DRV = RT.DRV, VEH = RT.VEH, PIT = RT.PIT;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
var ALIAS = { aggression: 'aggression', consistency: 'consistency', finishing: 'finishing', qualifying: 'qualifying', 'road course': 'road', road: 'road', 'road courses': 'road', 'short track': 'short', short: 'short', 'short tracks': 'short', speedway: 'speedway', speedways: 'speedway', 'super speedway': 'super', superspeedway: 'super', 'super speedways': 'super', super: 'super',
  aerodynamics: 'aero', aero: 'aero', chassis: 'chassis', engine: 'engine', reliability: 'reliability', speed: 'pspeed', strategy: 'pstrat' };
var LABELS = Object.keys(ALIAS).sort(function (a, b) { return b.length - a.length; });
function groupOf(k) { return DRV.some(function (a) { return a[0] === k; }) ? 'driver' : VEH.some(function (a) { return a[0] === k; }) ? 'vehicle' : 'pitcrew'; }

/* ---------- reading text exports ---------- */
function splitNums(s) { var m = String(s).match(/\d{1,3}(?:\.\d+)?/g); return m ? m.map(parseFloat) : []; }
J.rtParseText = function (txt) {
  txt = String(txt || '').replace(/^﻿/, '').trim(); if (!txt) return [];
  if (/^[\[{]/.test(txt)) { try { var j = JSON.parse(txt); var arr = Array.isArray(j) ? j : (j.entries || j.drivers || j.ratings || [j]); return arr.map(fromObj).filter(Boolean); } catch (e) {} }
  var lines = txt.split(/\r?\n/);
  // table with a header row (CSV, TSV or semicolons): attribute names with Min / Max columns
  var delim = /\t/.test(lines[0]) ? '\t' : /;/.test(lines[0]) && !/,/.test(lines[0]) ? ';' : ',';
  var head = lines[0].split(delim).map(function (x) { return x.replace(/^"|"$/g, '').trim().toLowerCase(); });
  if (head.length >= 5 && head.some(function (h) { return /\b(min|max)\b/.test(h) || /aggression/.test(h); })) {
    var cols = [], section = '';
    head.forEach(function (h, i) {
      var g = /vehicle/.test(h) ? 'vehicle' : /pit/.test(h) ? 'pitcrew' : /driver/.test(h) && i > 0 && /min|max/.test(h) ? 'driver' : '';
      var lab = LABELS.filter(function (l) { return new RegExp('(^|[^a-z])' + l.replace(/ /g, '\\s*') + '([^a-z]|$)').test(h); })[0];
      if (lab) { var key = ALIAS[lab]; if (key === 'consistency' && (g === 'pitcrew' || /pit/.test(h))) key = 'pcons'; cols.push({ i: i, key: key, side: /max/.test(h) ? 1 : /min/.test(h) ? 0 : -1 }); }
    });
    var nameCol = Math.max(0, head.findIndex(function (h) { return /^(driver|name|team)$/.test(h); })), carCol = head.findIndex(function (h) { return /^(car|#|number|no\.?)$/.test(h); }), out = [];
    lines.slice(1).forEach(function (ln) {
      var r = ln.split(delim).map(function (x) { return x.replace(/^"|"$/g, '').trim(); }); if (r.length < 5) return;
      var e = { kind: /^team/.test(head[nameCol]) ? 'team' : 'driver', name: r[nameCol] || '', car: carCol >= 0 ? r[carCol] : '', a: {} }, tmp = {};
      cols.forEach(function (c) { var v = parseFloat(r[c.i]); if (isNaN(v)) return; var t = tmp[c.key] = tmp[c.key] || []; if (c.side === -1) { t[0] = v; t[1] = v; } else t[c.side] = v; });
      Object.keys(tmp).forEach(function (k) { var t = tmp[k]; if (t[0] == null) t[0] = t[1]; if (t[1] == null) t[1] = t[0]; e.a[k] = [clamp(Math.round(Math.min(t[0], t[1])), 0, 100), clamp(Math.round(Math.max(t[0], t[1])), 0, 100)]; });
      if (Object.keys(e.a).length) out.push(e);
    });
    if (out.length) return out;
  }
  // free text: a name line, then "Aggression 45 62" style lines, under Driver / Vehicle / Pitcrew headings
  var ents = [], e = null, sect = 'driver', lastName = '';
  lines.forEach(function (ln) {
    var s = ln.trim(); if (!s) return;
    var low = s.toLowerCase().replace(/[:\-]+$/, '').trim();
    if (/^(driver|vehicle|pit ?crew)\b[^a-z]*$/.test(low)) { sect = /vehicle/.test(low) ? 'vehicle' : /pit/.test(low) ? 'pitcrew' : 'driver'; return; }
    var lab = LABELS.filter(function (l) { return low.indexOf(l) === 0; })[0];
    if (lab) {
      var nums = splitNums(s.slice(lab.length)); if (nums.length < 1) return;
      var key = ALIAS[lab]; if (key === 'consistency' && sect === 'pitcrew') key = 'pcons';
      if (!e || (e.a[key] && true)) { e = { kind: 'driver', name: lastName, car: '', a: {} }; ents.push(e); if (key === 'pspeed' || key === 'pstrat') {} }
      var lo = nums[0], hi = nums.length > 1 ? nums[1] : nums[0]; e.a[key] = [clamp(Math.round(Math.min(lo, hi)), 0, 100), clamp(Math.round(Math.max(lo, hi)), 0, 100)]; return;
    }
    var nm = s.replace(/^(driver|name|team)\s*[:\-]\s*/i, '').replace(/#\s*\d+/, '').trim();
    if (/[a-z]/i.test(nm) && nm.length < 60) { sect = 'driver'; lastName = nm; if (e && Object.keys(e.a).length) e = null; var cm = s.match(/#\s*(\d{1,3})/); if (cm) lastName = nm; }
  });
  return ents.filter(function (x) { return Object.keys(x.a).length >= 3; });
};
function fromObj(o) {
  if (!o || typeof o !== 'object') return null;
  var e = { kind: o.kind === 'team' ? 'team' : 'driver', name: String(o.name || o.driver || o.team || ''), car: String(o.car || o.number || ''), a: {} };
  var src = o.ratings || o.a || o; ['driver', 'vehicle', 'pitcrew', 'pit'].forEach(function (g) { if (src[g] && typeof src[g] === 'object') Object.keys(src[g]).forEach(function (k) { put(e, k, src[g][k], g); }); });
  Object.keys(src).forEach(function (k) { if (!/^(driver|vehicle|pitcrew|pit|name|car|kind|number|team)$/.test(k)) put(e, k, src[k], ''); });
  return Object.keys(e.a).length ? e : null;
}
function put(e, k, v, g) {
  var key = ALIAS[String(k).toLowerCase().replace(/[_-]/g, ' ').trim()] || (DRV.concat(VEH, PIT).some(function (a) { return a[0] === k; }) ? k : null); if (!key) return;
  if (key === 'consistency' && /pit/.test(g)) key = 'pcons';
  var lo, hi; if (Array.isArray(v)) { lo = +v[0]; hi = +(v[1] != null ? v[1] : v[0]); } else if (v && typeof v === 'object') { lo = +(v.min != null ? v.min : v.Min); hi = +(v.max != null ? v.max : v.Max); } else { lo = hi = +v; }
  if (isNaN(lo) || isNaN(hi)) return; e.a[key] = [clamp(Math.round(Math.min(lo, hi)), 0, 100), clamp(Math.round(Math.max(lo, hi)), 0, 100)];
}

/* ---------- reading screenshots ---------- */
J.ai = J.ai || {};
J.ai.readRatings = async function (S, images, names) {
  var keys = 'driver: aggression, consistency, finishing, qualifying, road (Road Course), short (Short Track), speedway, super (Super Speedway); vehicle: aero (Aerodynamics), chassis, engine, reliability; pitcrew: pcons (Consistency), pspeed (Speed), pstrat (Strategy)';
  var user = 'These are screenshots from the NR Ratings app for NASCAR Racing 2003. Each shows rating boxes with a Min and a Max number for a Driver section (8 ratings), a Vehicle section (4) and a Pitcrew section (3). A screenshot may show one driver or a table of many.\n'
    + (names.length ? 'Drivers in this league: ' + names.join(', ') + '.\n' : '')
    + 'For every driver or team record you can see, return its name EXACTLY as written on screen when a name is visible (a title, a list row or a selected name), else an empty string. Also the car number if shown. Copy every Min and Max you can read. Never invent a number; leave a rating out when it is not visible.\n'
    + 'Use these keys, grouped by section: ' + keys + '.\n'
    + 'Return ONLY JSON: {"entries":[{"kind":"driver","name":"","car":"","driver":{"aggression":[min,max],...},"vehicle":{"aero":[min,max],...},"pitcrew":{"pcons":[min,max],...}}]}. A team record uses kind "team".';
  var res = await J.ai.json({ system: 'You transcribe rating numbers from screenshots of the NR Ratings app exactly as shown. You never guess or invent values or names.', user: user, images: images, role: 'writer', maxTokens: 8000 });
  return (res.entries || []).map(fromObj).filter(Boolean);
};
function shrink(file) {
  return new Promise(function (res, rej) {
    var u = URL.createObjectURL(file), im = new Image();
    im.onload = function () { var s = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res({ type: 'image/png', data: c.toDataURL('image/png').split(',')[1] }); };
    im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Could not open ' + file.name)); };
    im.src = u;
  });
}

/* ---------- matching entries to drivers ---------- */
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim(); }
function candidates(S) { return Object.keys(S.contracts || {}).map(function (k) { return { k: k, c: S.contracts[k] }; }).filter(function (x) { return x.c && x.c.name && !x.c.released && !x.c.callup; }); }
J.rtMatch = function (S, e) {
  var cs = candidates(S), n = norm(e.name); if (e.kind === 'team') { var tk = Object.keys(S.teams || {}).filter(function (t) { return norm(S.teams[t].name) === n || (n && norm(S.teams[t].name).indexOf(n) >= 0); })[0]; return tk ? { team: tk } : null; }
  var hit = n && cs.filter(function (x) { return norm(x.c.name) === n || J.driverKey(x.c.name) === J.driverKey(e.name); })[0];
  if (!hit && n) { var last = n.split(' ').pop(), first = n.split(' ')[0]; var m = cs.filter(function (x) { var p = norm(x.c.name).split(' '); return p[p.length - 1] === last && (p[0][0] === first[0] || p[0] === first); }); if (m.length === 1) hit = m[0]; }
  if (!hit && e.car) { var cm = cs.filter(function (x) { return String(x.c.car) === String(e.car).replace(/#/g, '') && !x.c.pt; }); if (cm.length === 1) hit = cm[0]; }
  return hit ? { key: hit.k } : null;
};

/* ---------- applying ---------- */
function snap(S) { var R = S.ratings; return JSON.stringify({ drivers: R.drivers, teams: R.teams }); }
J.rtApplyEntries = function (S, pairs) {
  J.rtSeedAll(S); var R = S.ratings; R.importSnap = snap(S);
  var teamAcc = {}, nd = 0, nt = 0;
  pairs.forEach(function (p) {
    var e = p.entry; if (p.team) { var tr = J.rtTeam(S, p.team); VEH.concat(PIT).forEach(function (a) { if (e.a[a[0]]) tr.a[a[0]] = e.a[a[0]]; }); nt++; return; }
    var rec = J.rtDriver(S, p.key), hit = 0; DRV.forEach(function (a) { if (e.a[a[0]]) { rec.a[a[0]] = e.a[a[0]]; hit++; } });
    if (hit) { nd++; if (S.contracts[p.key]) S.contracts[p.key].base = Math.round(J.rtOverall(rec)); rec.was = null; }
    var t = S.contracts[p.key] && S.contracts[p.key].team; if (t) VEH.concat(PIT).forEach(function (a) { if (e.a[a[0]]) { var acc = teamAcc[t] = teamAcc[t] || {}; (acc[a[0]] = acc[a[0]] || []).push(e.a[a[0]]); } });
  });
  Object.keys(teamAcc).forEach(function (t) { var tr = J.rtTeam(S, t); Object.keys(teamAcc[t]).forEach(function (k) { var v = teamAcc[t][k]; tr.a[k] = [Math.round(v.reduce(function (s, x) { return s + x[0]; }, 0) / v.length), Math.round(v.reduce(function (s, x) { return s + x[1]; }, 0) / v.length)]; }); nt++; });
  return { drivers: nd, teams: Object.keys(teamAcc).length + pairs.filter(function (p) { return p.team; }).length };
};
J.acts.rtImportUndo = function () { var R = J.S.ratings; if (!R || !R.importSnap) return; var o = JSON.parse(R.importSnap); R.drivers = o.drivers; R.teams = o.teams; delete R.importSnap; J.save(); J.toast('Ratings are back to how they were before the import.'); };

function summary(e) { var ks = Object.keys(e.a); return ks.slice(0, 4).map(function (k) { return k + ' ' + e.a[k][0] + '-' + e.a[k][1]; }).join(', ') + (ks.length > 4 ? ' and ' + (ks.length - 4) + ' more' : ''); }
function assignDialog(S, entries) {
  return new Promise(function (resolve) {
    var d = $('dlg'), done = false, cs = candidates(S).sort(function (a, b) { return a.c.name.localeCompare(b.c.name); });
    var finish = function (v) { if (done) return; done = true; d.removeEventListener('close', onClose); try { if (d.close) d.close(); else d.removeAttribute('open'); } catch (e) {} resolve(v); }, onClose = function () { if (!d.open) finish(null); };
    $('dlgBody').innerHTML = '<div class="dlg-h"><h3>Whose ratings are these?</h3><button class="dlg-x" id="raX" aria-label="Close">&#10005;</button></div><div class="dlg-b"><p class="sub">The app could not tell for these. Pick the driver for each one (or leave it on Skip).</p><div class="ragrid">' + entries.map(function (x, i) {
      return '<div class="rarow"><div><b>' + esc(x.entry.name || 'No name on the picture') + (x.entry.car ? ' #' + esc(x.entry.car) : '') + '</b><small>' + esc(summary(x.entry)) + '</small></div><select data-i="' + i + '"><option value="">Skip</option>' + cs.map(function (c) { return '<option value="' + esc(c.k) + '"' + (x.guess === c.k ? ' selected' : '') + '>' + esc(c.c.name) + (c.c.car ? ' #' + esc(c.c.car) : '') + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</div><div class="row" style="margin-top:12px"><button class="btn" id="raOk">Fill these in</button><button class="btn ghost" id="raNo">Skip all</button></div></div>';
    d.addEventListener('close', onClose);
    $('raOk').addEventListener('click', function () { finish(entries.map(function (x, i) { var v = d.querySelector('select[data-i="' + i + '"]').value; return v ? { entry: x.entry, key: v } : null; }).filter(Boolean)); });
    $('raNo').addEventListener('click', function () { finish([]); }); $('raX').addEventListener('click', function () { finish(null); });
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  });
}
var busy = false;
function say(t, bad) { var m = $('rtMsg'); if (m) { m.hidden = false; m.className = 'msg' + (bad ? ' err' : ' ok'); m.textContent = t; } else J.toast(t, bad); }
J.rtImportFiles = async function (files) {
  var S = J.S; if (busy) return; busy = true;
  try {
    var imgs = files.filter(function (f) { return /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name); }), texts = files.filter(function (f) { return imgs.indexOf(f) < 0; }), entries = [];
    for (var i = 0; i < texts.length; i++) {
      var tx = await new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result || '')); }; r.onerror = function () { res(''); }; r.readAsText(texts[i]); });
      var got = J.rtParseText(tx);
      if (!got.length && J.ai && J.ai.hasKey() && tx.trim()) { say('Reading ' + texts[i].name + ' with the AI...'); try { var rr = await J.ai.json({ system: 'You convert an NR Ratings export into JSON. You never invent numbers.', user: 'Convert this export. Keys: driver: aggression, consistency, finishing, qualifying, road, short, speedway, super; vehicle: aero, chassis, engine, reliability; pitcrew: pcons, pspeed, pstrat. Each rating is [min,max]. Return ONLY {"entries":[{"kind":"driver","name":"","car":"","driver":{},"vehicle":{},"pitcrew":{}}]}.\n\n' + tx.slice(0, 60000), role: 'writer', maxTokens: 8000 }); got = (rr.entries || []).map(fromObj).filter(Boolean); } catch (e) { say(e.message, true); } }
      entries = entries.concat(got);
    }
    if (imgs.length) {
      if (!J.ai || !J.ai.hasKey()) { if (!entries.length) { say('Reading a screenshot needs your AI key (a free Gemini key works). Add it in Settings, or drop the NR Ratings export file instead.', true); return; } }
      else {
        say('Reading ' + J.plural(imgs.length, 'screenshot') + '. This takes 10 to 40 seconds...');
        var shots = []; for (var k = 0; k < Math.min(imgs.length, 8); k++) shots.push(await shrink(imgs[k]));
        var names = candidates(S).map(function (x) { return x.c.name + (x.c.car ? ' #' + x.c.car : ''); }).slice(0, 90);
        try { entries = entries.concat(await J.ai.readRatings(S, shots, names)); } catch (e) { say('Could not read the screenshot: ' + e.message, true); if (!entries.length) return; }
      }
    }
    if (!entries.length) { say('Found no ratings in that. A screenshot needs to show the Min and Max numbers; a file should be the NR Ratings export or the CSV downloaded from this page.', true); return; }
    var sure = [], ask = [];
    entries.forEach(function (e) { var m = J.rtMatch(S, e); if (m && m.team) sure.push({ entry: e, team: m.team }); else if (m && m.key) sure.push({ entry: e, key: m.key }); else ask.push({ entry: e, guess: '' }); });
    var seen = {}; sure = sure.filter(function (p) { var id = p.team ? 't' + p.team : p.key; if (seen[id]) return false; seen[id] = 1; return true; });
    if (ask.length) { var chosen = await assignDialog(S, ask); if (chosen) chosen.forEach(function (c) { if (!seen[c.key]) { seen[c.key] = 1; sure.push(c); } }); }
    if (!sure.length) { say('Nothing was filled in.', true); return; }
    var r = J.rtApplyEntries(S, sure); J.save();
    say('Filled in ratings for ' + J.plural(r.drivers, 'driver') + (r.teams ? ' and ' + J.plural(r.teams, 'team') : '') + (ask.length && sure.length < entries.length ? '; ' + (entries.length - sure.length) + ' skipped' : '') + '. Use Undo below if that is wrong.');
  } catch (e) { say('Import failed: ' + e.message, true); console.error(e); }
  finally { busy = false; }
};
J.acts.rtShotPick = function () { var i = $('rtShots'); if (i) i.click(); };
var base = J.routes.ratings;
J.routes.ratings = function (S) {
  var out = base(S), R = S.ratings || {}, key = J.ai && J.ai.hasKey();
  var panel = '<section class="panel"><h3>Fill the ratings in from NR Ratings</h3><p class="sub">Send a screenshot of NR Ratings (or the export file) and the ratings go in for each driver by themselves. Several screenshots at once is fine. Names are matched to your drivers; if a picture shows no name the app asks you once who it is.' + (key ? '' : ' Screenshots need your AI key (a free Gemini key works, add it in Settings). Export files work without one.') + '</p>'
    + '<div class="drop" id="rtDrop"><strong>Drop screenshots or the export file here</strong><p>PNG, JPG, CSV, TXT or JSON</p><div class="row" style="justify-content:center"><button class="btn" data-act="rtShotPick">Choose files</button></div><input type="file" id="rtShots" accept="image/*,.csv,.txt,.json,.tsv" multiple hidden></div><div id="rtMsg" class="msg" hidden></div>'
    + (R.importSnap ? '<div class="row"><button class="btn ghost sm" data-act="rtImportUndo">Undo the last import</button></div>' : '') + '</section>';
  var at = out.indexOf('<section class="panel"><h3>Progression');
  return at < 0 ? out + panel : out.slice(0, at) + panel + out.slice(at);
};
var baseAfter = J.afters.ratings;
J.afters.ratings = function () {
  if (baseAfter) baseAfter();
  var inp = $('rtShots'); if (inp) inp.addEventListener('change', function () { if (this.files.length) J.rtImportFiles(Array.prototype.slice.call(this.files)); this.value = ''; });
  var d = $('rtDrop'); if (!d) return;
  d.addEventListener('dragover', function (e) { e.preventDefault(); d.classList.add('over'); }); d.addEventListener('dragleave', function () { d.classList.remove('over'); });
  d.addEventListener('drop', function (e) { e.preventDefault(); d.classList.remove('over'); var fs = Array.prototype.slice.call(e.dataTransfer.files || []); if (fs.length) J.rtImportFiles(fs); });
};
// a screenshot pasted straight from the clipboard works too
document.addEventListener('paste', function (e) {
  if (!J.S || (location.hash || '').indexOf('ratings') < 0) return; var f = [], it = (e.clipboardData && e.clipboardData.items) || []; for (var i = 0; i < it.length; i++) if (/^image\//.test(it[i].type)) { var x = it[i].getAsFile(); if (x) f.push(x); }
  if (f.length) { e.preventDefault(); J.rtImportFiles(f); }
});
})();
