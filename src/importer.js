/* Jet's Sim Series - race import (commissioner only). Parser ported from the tested beta. */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc, P = J.parse = {};

/* ---------- parsing ---------- */
P.parseDate = function (s) {
  s = String(s || '').trim(); var m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { var y = +m[3]; if (y < 100) y += 2000; return y + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0'); }
  return '';
};
P.csv = function (text) {
  text = text.replace(/^﻿/, '');
  var first = (text.split(/\r?\n/).find(function (x) { return x.trim(); }) || '');
  var cnt = function (c) { return first.split(c).length - 1; };
  var delim = ','; if (cnt('\t') > cnt(',')) delim = '\t'; else if (cnt(';') > cnt(',')) delim = ';';
  var rows = [], row = [], cell = '', q = false;
  var endRow = function () { row.push(cell.trim()); cell = ''; if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; };
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (c === '"') { if (q && text[i + 1] === '"') { cell += '"'; i++; } else q = !q; }
    else if (c === delim && !q) { row.push(cell.trim()); cell = ''; }
    else if ((c === '\n' || c === '\r') && !q) { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else cell += c;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
};
var KEYS = { pos: ['position', 'pos', 'finish', 'finishingposition', 'finishpos', 'place', 'rank', 'f', 'fin', 'p'], start: ['start', 'startpos', 'startingposition', 'grid', 's', 'st', 'qual'], driver: ['driver', 'drivername', 'name', 'driverfullname'], car: ['car', 'carnumber', 'number', 'carno', 'carnum', '#', 'no'], team: ['team', 'owner', 'sponsor'], laps: ['laps', 'lapscompleted', 'completed'], led: ['led', 'lapsled', 'ledlaps'], pts: ['points', 'pts'], status: ['status', 'out', 'reason', 'result'], interval: ['interval', 'gap', 'diff'] };
P.rowsToResults = function (rows) {
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9#]/g, ''); };
  var hi = -1;
  for (var i = 0; i < Math.min(rows.length, 8); i++) { if (rows[i].some(function (c) { return KEYS.driver.indexOf(norm(c)) >= 0; })) { hi = i; break; } }
  var H = {}, data, namesOnly = false;
  if (hi >= 0) { var hdr = rows[hi].map(norm); Object.keys(KEYS).forEach(function (k) { H[k] = hdr.findIndex(function (h) { return KEYS[k].indexOf(h) >= 0; }); }); data = rows.slice(hi + 1); }
  else {
    data = rows;
    var multi = rows.some(function (r) { return r.length > 1; });
    if (!multi) { H.driver = 0; H.pos = -1; namesOnly = true; }
    else {
      var f = rows[0]; var di = f.findIndex(function (c, i) { return i > 0 && c && !/^\d+\*?$/.test(c.trim()); });
      if (!/^\d+$/.test((f[0] || '').trim()) || di < 0) return { error: 'I could not tell which column has the driver names. Columns I saw: ' + f.filter(Boolean).slice(0, 8).join(', ') + '. Add a header row with a Driver column (the CSV template shows the layout), or paste just the names in finishing order.' };
      H.driver = di; H.pos = 0; H.car = di > 1 ? 1 : -1;
    }
  }
  var cellOf = function (r, k) { return (H[k] >= 0) ? String(r[H[k]] || '').trim() : ''; };
  var num = function (s) { var m = String(s).match(/-?\d+/); return m ? parseInt(m[0], 10) : null; };
  var out = [];
  data.forEach(function (r) {
    var name = String(r[H.driver] || '').trim();
    if (namesOnly) name = name.replace(/^\s*P?\d+[.):\-]?\s+/i, '').trim();
    if (!name || /^\d+$/.test(name)) return;
    var pos = H.pos >= 0 ? num(cellOf(r, 'pos')) : null;
    out.push({ position: (pos != null && pos > 0) ? pos : out.length + 1, start: num(cellOf(r, 'start')) || 0, driver: name, car: cellOf(r, 'car').replace(/[^\w]/g, ''), team: cellOf(r, 'team'), laps: num(cellOf(r, 'laps')) || 0, lapsLed: num(cellOf(r, 'led')) || 0, filePoints: cellOf(r, 'pts') !== '' ? num(cellOf(r, 'pts')) : null, status: cellOf(r, 'status'), interval: cellOf(r, 'interval') });
  });
  if (!out.length) {
    var seen = (hi >= 0 ? rows[hi] : rows[0] || []).filter(Boolean).slice(0, 10).join(', ');
    return { error: 'I found the file but no driver rows in it. Columns I saw: ' + (seen || 'none') + '. I need a Driver column. The CSV template shows a layout that works.' };
  }
  out.sort(function (a, b) { return a.position - b.position; });
  return { rows: out };
};
function poleFrom(rows) {
  var h = rows[0].map(function (c) { return c.toLowerCase(); }); var di = h.indexOf('driver'), ti = h.indexOf('time');
  for (var i = 1; i < rows.length; i++) { var r = rows[i]; if (r[di] && (ti < 0 || /\d/.test(r[ti] || ''))) return r[di]; }
  return '';
}
P.nr2003 = function (t) {
  var doc = new DOMParser().parseFromString(t, 'text/html');
  var meta = { source: 'NR2003 export', track: '', date: '' }, session = '', tables = {};
  doc.querySelectorAll('h1,h2,h3,table').forEach(function (el) {
    if (el.tagName === 'TABLE') {
      var rows = Array.prototype.map.call(el.rows, function (r) { return Array.prototype.map.call(r.cells, function (c) { return c.textContent.replace(/\s+/g, ' ').trim(); }); });
      if (rows.length && rows[0].some(function (c) { return /^driver$/i.test(c); }) && !tables[session]) tables[session] = rows;
      return;
    }
    var x = el.textContent.replace(/\s+/g, ' ').trim(), m;
    if ((m = x.match(/^Track:\s*(.+)$/i))) meta.track = J.titleCase(m[1]);
    else if ((m = x.match(/^Date:\s*(.+)$/i))) meta.date = P.parseDate(m[1]);
    else if ((m = x.match(/^Session:\s*(.+)$/i))) session = m[1].toLowerCase();
    else if (/race/.test(session)) {
      if ((m = x.match(/^Weather:\s*(.+)$/i))) meta.weather = m[1].replace(/�/g, '°').replace(/\s+°/, '°');
      else if ((m = x.match(/^Caution Flags:\s*(\d+)/i))) meta.cautions = +m[1];
      else if ((m = x.match(/^Lead Changes:\s*(\d+)\s*\((\d+)/i))) { meta.leadChanges = +m[1]; meta.leadDrivers = +m[2]; }
    }
  });
  var keys = Object.keys(tables), rk = keys.find(function (k) { return /race/.test(k); });
  if (!rk) return { error: /session:\s*race/i.test(t) ? 'The Race part of this file is empty. Export the standings again after the race is finished.' : 'I could not find a Race session in this file. Is it the standings export from NR2003?' };
  var res = P.rowsToResults(tables[rk]); if (res.error) return res;
  var qk = keys.find(function (k) { return /qual/.test(k); }); if (qk) { var p = poleFrom(tables[qk]); if (p) meta.pole = p; }
  res.meta = meta; return res;
};
P.results = function (text, name) {
  var head = text.slice(0, 4000);
  if (/\.html?$/i.test(name || '') || /<\s*(html|table|!doctype)/i.test(head)) return P.nr2003(text);
  var rows = P.csv(text); if (!rows.length) return { error: 'That file looks empty.' };
  var r = P.rowsToResults(rows); if (r.error) return r;
  r.meta = { source: 'CSV' }; return r;
};
P.score = function (rows, mode, bonus, custom) {
  var n = rows.length, maxLed = Math.max.apply(null, rows.map(function (r) { return r.lapsLed || 0; }).concat([0]));
  var arr = String(custom || '').split(',').map(function (x) { return Number(x.trim()); });
  return rows.map(function (r) {
    var p;
    if (mode === 'file') p = r.filePoints != null ? r.filePoints : J.nascarPts(r.position);
    else if (mode === 'simple') p = Math.max(1, n - r.position + 1);
    else if (mode === 'custom') p = isFinite(arr[r.position - 1]) ? arr[r.position - 1] : 0;
    else p = J.nascarPts(r.position);
    if (bonus && mode !== 'file') { if (r.lapsLed > 0) p += 1; if (maxLed > 0 && r.lapsLed === maxLed) p += 1; }
    var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); o.points = p; return o;
  });
};
J.rescoreRace = function (race) { race.rows = P.score(race.rows, race.mode || 'nascar', race.bonus, race.custom); };
P.matchRound = function (S, track) {
  var done = {}; S.races.forEach(function (r) { done[r.sid] = 1; });
  var open = S.schedule.filter(function (r) { return !done[r.id]; });
  var skip = ['motor', 'speedway', 'raceway', 'international'];
  var words = function (s) { return String(s || '').toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length >= 4 && skip.indexOf(w) < 0; }); };
  var tw = words(track);
  if (tw.length) { var hit = open.find(function (r) { return words(r.track + ' ' + r.name).some(function (w) { return tw.indexOf(w) >= 0; }); }); if (hit) return hit; }
  return open[0] || null;
};
J.readFileText = function (f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { rej(r.error); }; r.readAsText(f); }); };

/* ---------- import page ---------- */
var imp = null;          // { rows, meta, file, form:{...} }
J.coverageRun = null;    // { raceId, raceName, steps:[{id,label,state,detail}], done, fails }
var STEP_LABELS = { recap: 'Race recap article (Checkered Wire)', fans: 'Fan reactions in The Garage', outlooks: 'Chase, Race and Season outlook commentary', drift: 'Fans changing sides' };

function coverageHtml() {
  var c = J.coverageRun; if (!c) return '';
  return '<section class="panel" id="covPanel"><h3>Race coverage: ' + esc(c.raceName) + '</h3><p class="sub">' + (c.done ? (c.fails ? 'Finished with ' + J.plural(c.fails, 'problem') + '. You can try again from Races.' : 'All done. It is on the site now.') : J.ai.name() + ' is writing. This takes about a minute. You can keep using the app.') + '</p><ul class="prog">'
    + c.steps.map(function (s) { return '<li class="' + s.state + '"><i></i>' + esc(s.label) + (s.detail ? '<small>' + esc(s.detail) + '</small>' : '') + '</li>'; }).join('') + '</ul>'
    + (c.done ? '<div class="row"><a class="btn sm" href="#/news">See the news</a><a class="btn ghost sm" href="#/garage/feed">See The Garage</a><button class="btn ghost sm" data-act="covDismiss">Dismiss</button></div>' : '') + '</section>';
}
function paintCoverage() { var el = $('covPanel'); if (el) el.outerHTML = coverageHtml(); else if (J.route().name === 'import' && $('covSlot')) $('covSlot').innerHTML = coverageHtml(); }
J.acts.covDismiss = function () { J.coverageRun = null; var el = $('covPanel'); if (el) el.remove(); };

J.runCoverage = async function (race) {
  if (J.coverageRun && !J.coverageRun.done) { J.toast('Coverage is already running for another race. Try again in a minute.', true); return; }
  var S = J.S;
  var c = J.coverageRun = { raceId: race.id, raceName: race.name, done: false, fails: 0, steps: ['recap', 'fans', 'outlooks', 'drift'].map(function (k) { return { id: k, label: STEP_LABELS[k], state: '', detail: '' }; }) };
  paintCoverage();
  var fails = await J.ai.coverage(S, race, function (name, state, detail) {
    var s = c.steps.find(function (x) { return x.id === name; }); if (s) { s.state = state; s.detail = detail || ''; }
    if (state !== 'run') J.save({ render: false, quiet: true });
    paintCoverage();
  });
  c.done = true; c.fails = fails;
  if (fails && !S.articles.some(function (a) { return a.raceId === race.id; })) S.articles.unshift(J.autoRecap(S, race));
  J.save({ render: J.route().name !== 'import' && J.route().name !== 'studio' });
  paintCoverage();
  J.toast(fails ? 'Coverage finished with ' + J.plural(fails, 'problem') + '.' : 'Race coverage is up.', !!fails);
};

J.routes['import'] = function (S) {
  var hasKey = J.ai && J.ai.hasKey();
  var out = J.phead('Import Race', 'Bring in a finished race from NR2003. Standings, results and the outlooks update right away.')
    + '<div id="covSlot">' + coverageHtml() + '</div>'
    + '<section class="panel"><div class="drop" id="drop"><strong>Drop the race file here</strong><p>Use the standings file NR2003 saves in <b>exports_imports</b> (it ends in .html). A CSV or a plain list of names in finishing order also works. You can drop the file anywhere in this window.</p>'
    + '<div class="row" style="justify-content:center"><button class="btn" data-act="impPick">Choose file</button><button class="btn ghost" data-act="impPasteToggle">Paste results</button><button class="btn ghost" data-act="impTemplate">CSV template</button></div>'
    + '<input type="file" id="impFile" accept=".html,.htm,.csv,.txt,text/html,text/csv,text/plain" hidden></div>'
    + '<div id="pasteBox" hidden><div class="field" style="margin-top:12px"><label for="impPaste">Paste a table or one driver per line, winner first</label><textarea id="impPaste" placeholder="Position,Driver,Car&#10;1,Tyler Reddick,45&#10;2,Chris Buescher,17"></textarea></div><div class="row"><button class="btn sm" data-act="impParsePaste">Read pasted results</button></div></div>'
    + '<div id="impMsg" class="msg" hidden></div></section>'
    + '<div id="impForm"></div>'
    + (!hasKey ? '<p class="fine">No AI key saved yet, so imports get a plain automatic recap. Add a free Gemini key in <a href="#/settings" style="color:var(--blue);font-weight:600">Settings</a> for full articles and fan chatter.</p>' : '');
  return out;
};
J.afters['import'] = function () {
  var f = $('impFile'); if (f) f.addEventListener('change', function () { if (this.files[0]) handleFile(this.files[0]); this.value = ''; });
  if (imp) renderPreview();
};
J.nav.push({ id: 'import', label: 'Import Race', group: 'Commissioner', admin: true });

function msg(text, err) { var m = $('impMsg'); if (!m) return; m.hidden = false; m.className = 'msg' + (err ? ' err' : ''); m.textContent = text; }
function handleFile(f) { return J.readFileText(f).then(function (t) { loadText(t, f.name); }).catch(function (e) { msg('Could not read that file: ' + (e && e.message || e), true); }); }
J.importFile = function (f) { if (J.route().name !== 'import') { J.go('import'); setTimeout(function () { handleFile(f); }, 60); } else handleFile(f); };
function loadText(text, name) {
  var S = J.S;
  if (!text || !text.trim()) { msg('That file is empty.', true); return; }
  var res;
  try { res = P.results(text, name); } catch (e) { console.error(e); msg('I could not understand that file (' + e.message + '). Try the CSV template instead.', true); return; }
  if (res.error) { msg(res.error, true); imp = null; $('impForm').innerHTML = ''; return; }
  var m = res.meta || {}, round = P.matchRound(S, m.track);
  imp = { rows: res.rows, meta: m, file: name, form: { round: round ? round.id : '', name: round ? round.name : (m.track || name.replace(/\.[^.]+$/, '')), track: round ? (round.track || m.track || '') : (m.track || ''), date: m.date || J.todayISO(), mode: (S.races[S.races.length - 1] || {}).mode || 'nascar', bonus: false, custom: '' } };
  msg('Read ' + name + ': ' + imp.rows.length + ' finishers' + (m.source === 'NR2003 export' ? ' (NR2003 export)' : '') + '. Check the preview below, then import.', false);
  renderPreview();
  var el = $('impForm'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function readForm() {
  if (!imp) return; var f = imp.form, g = function (id) { var e = $(id); return e ? e : null; };
  if (g('impRound')) { f.round = g('impRound').value; f.name = g('impName').value; f.track = g('impTrack').value; f.date = g('impDate').value; f.mode = g('impScoring').value; f.bonus = g('impBonus').checked; f.custom = g('impCustom').value; }
}
function renderPreview() {
  var S = J.S, el = $('impForm'); if (!el || !imp) return;
  var f = imp.form, rows = P.score(imp.rows, f.mode, f.bonus, f.custom); imp.scored = rows;
  var done = {}; S.races.forEach(function (r) { done[r.sid] = 1; });
  var warns = [], seen = {}, dup = false;
  rows.forEach(function (r) { if (seen[r.position]) dup = true; seen[r.position] = 1; });
  if (dup) warns.push('Two drivers share the same finishing position. Check the file.');
  if (rows.length < 5) warns.push('Only ' + rows.length + ' drivers found. Is this the whole field?');
  if (f.mode === 'file' && rows.some(function (r) { return r.filePoints == null; })) warns.push('Some rows have no points in the file, so NASCAR-style points were used for them.');
  if (f.mode === 'custom' && rows.some(function (r) { return r.points === 0; })) warns.push('Your custom points list is shorter than the field. Drivers past the end get 0.');
  var nm = f.name.trim().toLowerCase();
  if (nm && S.races.some(function (r) { return r.name.toLowerCase() === nm && r.date === f.date; })) warns.push('A race with this name and date is already imported. Importing again counts it twice.');
  if (f.round && done[f.round]) warns.push('That schedule round already has a result. Pick another round or remove the old race first.');
  var opts = '<option value="">Not on the schedule</option>' + S.schedule.map(function (r, i) { return '<option value="' + esc(r.id) + '"' + (r.id === f.round ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(r.name) + (done[r.id] ? ' (has a result)' : '') + '</option>'; }).join('');
  var hasKey = J.ai && J.ai.hasKey();
  el.innerHTML = '<section class="panel"><h3>Check the race</h3><div class="fgrid">'
    + '<div class="field"><label for="impRound">Schedule round</label><select id="impRound">' + opts + '</select></div>'
    + '<div class="field"><label for="impName">Race name</label><input id="impName" value="' + esc(f.name) + '"></div>'
    + '<div class="field"><label for="impTrack">Track</label><input id="impTrack" value="' + esc(f.track) + '"></div>'
    + '<div class="field"><label for="impDate">Date</label><input id="impDate" type="date" value="' + esc(f.date) + '"></div>'
    + '<div class="field"><label for="impScoring">Points</label><select id="impScoring"><option value="nascar"' + (f.mode === 'nascar' ? ' selected' : '') + '>NASCAR style (40, 35, 34...)</option><option value="file"' + (f.mode === 'file' ? ' selected' : '') + '>Use the points in the file</option><option value="simple"' + (f.mode === 'simple' ? ' selected' : '') + '>One per car beaten</option><option value="custom"' + (f.mode === 'custom' ? ' selected' : '') + '>My own list</option></select></div>'
    + '<div class="field"' + (f.mode === 'custom' ? '' : ' hidden') + '><label for="impCustom">Points for P1, P2, P3... (commas)</label><input id="impCustom" value="' + esc(f.custom) + '" placeholder="43,38,36,35"></div></div>'
    + '<label class="check"' + (f.mode === 'file' ? ' hidden' : '') + '><input type="checkbox" id="impBonus"' + (f.bonus ? ' checked' : '') + '> Bonus points: +1 for leading a lap, +1 more for leading the most laps</label>'
    + (imp.meta.pole || imp.meta.weather || imp.meta.cautions != null ? '<div class="chips" style="margin:6px 0 0;padding:10px 0;background:none;border:0">' + (imp.meta.pole ? '<span class="chip">Pole <b>' + esc(imp.meta.pole) + '</b></span>' : '') + (imp.meta.weather ? '<span class="chip">Weather <b>' + esc(imp.meta.weather) + '</b></span>' : '') + (imp.meta.cautions != null ? '<span class="chip">Cautions <b>' + imp.meta.cautions + '</b></span>' : '') + (imp.meta.leadChanges != null ? '<span class="chip">Lead changes <b>' + imp.meta.leadChanges + '</b></span>' : '') + '</div>' : '')
    + warns.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('')
    + '<div class="row"><button class="btn" data-act="impConfirm">Import ' + rows.length + ' drivers</button><button class="btn ghost" data-act="impCancel">Cancel</button>'
    + (hasKey ? '<label class="check" style="margin:0 0 0 6px"><input type="checkbox" id="impCover"' + (J.settings.autoCoverage !== false ? ' checked' : '') + '> Have ' + J.ai.name() + ' write the recap and fan reactions</label>' : '') + '</div></section>'
    + '<div class="card"><div class="tw"><table class="data"><thead><tr><th>Fin</th><th>Start</th><th>Car</th><th>Driver</th><th>Laps</th><th>Led</th><th>Status</th><th>Pts</th></tr></thead><tbody>'
    + rows.map(function (r) { return '<tr><td class="rank">' + r.position + '</td><td>' + (r.start || '-') + '</td><td><span class="car">' + esc(r.car || '-') + '</span></td><td><b>' + esc(r.driver) + '</b></td><td>' + (r.laps || '-') + '</td><td>' + (r.lapsLed || 0) + '</td><td class="' + (J.isDnf(r) ? 'dnf' : 'dim') + '">' + esc(r.status || '-') + '</td><td class="pts"><b>' + r.points + '</b></td></tr>'; }).join('')
    + '</tbody></table></div></div>';
}
document.addEventListener('change', function (e) {
  var t = e.target; if (!imp || !t.id || !/^imp(Round|Name|Track|Date|Scoring|Bonus|Custom)$/.test(t.id)) return;
  if (t.id === 'impRound') { var r = J.S.schedule.find(function (x) { return x.id === t.value; }); if (r) { $('impName').value = r.name; if (r.track) $('impTrack').value = r.track; } }
  readForm(); renderPreview();
});
J.acts.impPick = function () { $('impFile').click(); };
J.acts.impPasteToggle = function () { $('pasteBox').hidden = !$('pasteBox').hidden; if (!$('pasteBox').hidden) $('impPaste').focus(); };
J.acts.impParsePaste = function () { loadText($('impPaste').value, 'pasted-results.csv'); };
J.acts.impTemplate = function () { J.download('jss-results-template.csv', 'Position,Driver,Car,Team,Start,Led,Status\n1,Example Driver,24,Example Racing,3,45,Running\n2,Another Driver,11,Another Racing,1,12,Running\n3,Third Driver,5,Third Racing,8,0,Running\n'); };
J.acts.impCancel = function () { imp = null; $('impForm').innerHTML = ''; var m = $('impMsg'); if (m) m.hidden = true; };
J.acts.impConfirm = function () {
  var S = J.S; if (!imp || !imp.scored) return; readForm();
  var f = imp.form, name = f.name.trim(); if (!name) { msg('Give the race a name first.', true); return; }
  var cover = $('impCover') ? $('impCover').checked : false;
  var meta = {}; Object.keys(imp.meta).forEach(function (k) { meta[k] = imp.meta[k]; });
  var race = { id: J.uid('r'), sid: f.round || '', name: name, track: f.track.trim(), date: f.date || J.todayISO(), mode: f.mode, bonus: f.bonus, custom: f.custom, seed: 0, meta: meta, rows: P.score(imp.rows, f.mode, f.bonus, f.custom) };
  if (race.sid && !S.schedule.some(function (x) { return x.id === race.sid; })) race.sid = '';
  S.races.push(race);
  S.races.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  imp = null;
  // On-track reputation: small, automatic nudges from the result itself
  var info = J.raceInfo(race);
  J.repApply(S, info.winner.driver, 2, 'Won ' + race.name, 'track', race.id);
  if (info.mover && info.mover.gain >= 12) J.repApply(S, info.mover.row.driver, 1, 'Charged from P' + info.mover.row.start + ' to P' + info.mover.row.position + ' at ' + race.name, 'track', race.id);
  if (!(cover && J.ai && J.ai.hasKey())) S.articles.unshift(J.autoRecap(S, race));
  J.save({ render: true });
  J.toast('Imported ' + name + '. Standings updated.');
  if (cover && J.ai && J.ai.hasKey()) J.runCoverage(race);
};

/* drop a file anywhere in the window */
['dragenter', 'dragover'].forEach(function (ev) { window.addEventListener(ev, function (e) { if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return; e.preventDefault(); var d = $('drop') || $('sDrop'); if (d) d.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (ev) { window.addEventListener(ev, function (e) { if (ev === 'drop' || e.target === document.documentElement || !e.relatedTarget) { var d = $('drop'), s = $('sDrop'); if (d) d.classList.remove('over'); if (s) s.classList.remove('over'); } }); });
window.addEventListener('drop', function (e) {
  var files = e.dataTransfer && e.dataTransfer.files; if (!files || !files.length) return;
  e.preventDefault();
  var f = files[0], media = /^(image|video)\//.test(f.type);
  if (media || J.route().name === 'studio') { if (J.studioAddFiles) { if (J.route().name !== 'studio') J.go('studio'); setTimeout(function () { J.studioAddFiles(files); }, 60); } return; }
  J.importFile(f);
});
})();
