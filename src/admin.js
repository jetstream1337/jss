/* Virtual NASCAR - commissioner pages and app startup (never published) */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
J.seriesList = J.SERIES_ORDER.map(function (k) { return { id: k, label: J.SERIES[k].label }; });

/* ---------- saving ---------- */
var saveT = null;
J.save = function (o) {
  o = o || {}; var S = J.S; if (!S) return;
  try { if (!S.archived) J.ensureContracts(S, J.rosterLookup ? J.rosterLookup(S) : null); } catch (e) { console.error(e); }
  S.updatedAt = Date.now();
  if (J.leagues) J.leagues[S.id] = S;
  clearTimeout(saveT);
  saveT = setTimeout(function () { J.store.saveLeague(S).catch(function (e) { J.toast('Could not save: ' + e.message, true); }); }, 120);
  if (J.publisher) J.publisher.schedule();
  if (o.render !== false) J.refresh(); else if (J.renderFoot) J.renderFoot();
};
J.saveSettings = function () { return J.store.saveSettings(J.settings); };
window.addEventListener('beforeunload', function () { if (saveT && J.S) { clearTimeout(saveT); J.store.saveLeague(J.S); } });

/* ---------- startup ---------- */
J.boot = async function () {
  try {
    J.settings = await J.store.loadSettings();
    var st = await J.store.loadLeagues();
    J.leagues = st.leagues;
    if (!Object.keys(J.leagues).length) { var L = J.newLeague('cup'); J.leagues.cup = L; await J.store.saveLeague(L); }
    J.S = J.leagues[st.active] || J.leagues[Object.keys(J.leagues)[0]];
    Object.keys(J.leagues).forEach(function (k) { var L = J.leagues[k]; if (!L.archived) { try { J.ensureContracts(L, J.rosterLookup ? J.rosterLookup(L) : null); } catch (e) { console.error(e); } } });
    await J.store.loadBlobs(J.S);
  } catch (e) { console.error(e); J.toast('Could not load your league: ' + e.message, true); J.S = J.S || J.newLeague('cup'); J.leagues = J.leagues || { cup: J.S }; }
  if (!location.hash) location.hash = J.S.races.length ? '#/home' : '#/import';
  J.render();
  if (J.publisher) J.publisher.init();
  setInterval(function () { if (J.renderFoot) J.renderFoot(); }, 30000);
};

/* ---------- series / leagues ---------- */
J.acts.switchSeason = async function (id) {
  var S = J.S, L = J.leagues[id]; if (!L || (S && S.id === id)) return;
  if (S) await J.store.saveLeague(S);
  J.S = L; await J.store.setActive(id); await J.store.loadBlobs(J.S);
  J.render(); J.toast('Opened the ' + J.seasonYear(L) + ' ' + L.series.label + ' season.');
};
async function archive(L, cancelled) {
  var year = J.seasonYear(L), id = L.series.id + '-' + year, n = 2; while (J.leagues[id]) id = L.series.id + '-' + year + '-' + (n++);
  var old = L.id; L.id = id; L.archived = true; L.season = year; if (cancelled) L.cancelled = true;
  delete J.leagues[old]; await J.store.deleteLeague(old);
  J.leagues[id] = L; await J.store.saveLeague(L); return L;
}
// Finish (or cancel) the current season of this series and start the next one
J.acts.seasonNew = async function (el) {
  var sid = el.dataset.id, cur = J.leagues[sid], cancel = el.dataset.mode === 'cancel'; if (!cur) return;
  var year = parseInt(J.seasonYear(cur), 10), next = cancel ? year : year + 1;
  var msg = cancel ? 'Cancel the ' + year + ' ' + cur.series.label + ' season? It is kept under past seasons marked "cancelled" (you can delete it there), and a fresh ' + next + ' season starts with the same league, fans and settings.'
    : 'Finish the ' + year + ' ' + cur.series.label + ' season and start ' + next + '? ' + year + ' moves to past seasons (still on the website), and ' + next + ' starts with the same league, fans and settings.';
  if (!confirm(msg)) return;
  var y = prompt('Year for the new season', String(next)); if (y === null) return; y = parseInt(y, 10) || next;
  if (J.S && J.S.id === sid) await J.store.saveLeague(J.S);
  await archive(cur, cancel);
  var L = J.nextSeason(cur, { year: y }); L.id = sid; J.leagues[sid] = L; await J.store.saveLeague(L);
  J.S = L; await J.store.setActive(sid); await J.store.loadBlobs(J.S);
  J.save(); J.toast(cancel ? 'Season cancelled. ' + y + ' is ready.' : y + ' season started. Pick a schedule in Edit Schedule.');
};
J.acts.seasonDel = async function (el) {
  var id = el.dataset.id, L = J.leagues[id]; if (!L) return;
  if (!L.archived) return J.acts.leagueDel(el);
  if (!confirm('Delete the ' + J.seasonYear(L) + ' ' + L.series.label + ' season for good? It disappears from the app and the website.')) return;
  for (var i = 0; i < L.media.length; i++) { try { await J.store.delMedia(L.media[i].id); await J.store.delMedia(L.media[i].id + ':poster'); } catch (e) {} }
  delete J.leagues[id]; await J.store.deleteLeague(id);
  if (J.S.id === id) { J.S = J.leagues[L.series.id] || J.leagues[Object.keys(J.leagues)[0]]; await J.store.setActive(J.S.id); await J.store.loadBlobs(J.S); }
  J.save(); J.toast('Season deleted.');
};
J.acts.switchSeries = async function (el) {
  var id = el.value, S = J.S; if (S && id === S.id) return;
  if (!J.SERIES[id]) return J.acts.switchSeason(id);
  if (!J.leagues[id]) {
    if (!confirm('Start a new ' + J.SERIES[id].label + ' league? It gets its own schedule, standings, news and fans.')) { el.value = S.id; return; }
    J.leagues[id] = J.newLeague(id, S ? S.league.name : '');
    await J.store.saveLeague(J.leagues[id]);
  }
  if (S) await J.store.saveLeague(S);
  J.S = J.leagues[id]; await J.store.setActive(id); await J.store.loadBlobs(J.S);
  J.render(); J.toast('Switched to ' + J.S.series.label + '.');
  if (J.publisher) J.publisher.schedule();
};

/* ---------- preview the public site ---------- */
J.acts.preview = function () {
  var on = document.body.classList.toggle('as-public');
  var r = J.route(); if (on && J.nav.some(function (n) { return n.admin && n.id === r.name; })) J.go('home'); else J.render();
};
J.routes.preview = function () { setTimeout(function () { document.body.classList.add('as-public'); J.go('home'); }, 0); return ''; };

/* ---------- sync status in the sidebar ---------- */
J.acts.pubNow = function (t, e) { if (e && e.preventDefault) e.preventDefault(); J.publisher.run(true).then(function (m) { J.toast(m); }, function (err) { J.toast(err.message, true); }); };
J.syncStatusHtml = function () {
  var P = J.publisher, s = P ? P.state : { kind: 'off' }, S = J.S;
  var label = { off: 'Website not set up', ok: 'Website up to date', busy: 'Publishing...', pending: 'Changes waiting to publish', err: 'Publishing problem' }[s.kind] || '';
  var sub = s.kind === 'off' ? '<a href="#/settings" style="color:var(--yellow)">Set it up in Settings</a>' : s.kind === 'err' ? esc(s.msg || '') + ' <a href="#" data-act="pubNow" style="color:var(--yellow)">Try now</a>' : s.kind === 'ok' && s.at ? 'Last publish ' + esc(J.agoText(s.at)) : '';
  return '<div class="sync ' + s.kind + '"><b><i></i>' + label + '</b><small>' + sub + '</small>' + (S ? '<small>Saved ' + esc(J.agoText(S.updatedAt)) + '</small>' : '') + '</div>';
};

/* ---------- Races ---------- */
var MODES = {}; J.POINTS_ORDER.forEach(function (k) { MODES[k] = J.POINTS[k].name; }); MODES.file = 'Points in the file'; MODES.nascar = J.POINTS.p2017.name;
J.routes.races = function (S) {
  var list = S.races.slice().reverse();
  return J.phead('Races', S.races.length ? 'Rename, re-date, re-score or remove imported races, practice and qualifying.' : 'No races imported yet.', '<a class="btn sm" href="#/import">Import results</a>')
    + (list.length ? '<section class="panel">' + list.map(function (r) {
      var info = J.raceInfo(r), arts = S.articles.filter(function (a) { return a.raceId === r.id; }).length;
      return '<div class="mrow"><div class="inl" style="flex:1"><input data-race="name" data-id="' + esc(r.id) + '" value="' + esc(r.name) + '" aria-label="Race name" style="min-width:200px;flex:1"><input type="date" data-race="date" data-id="' + esc(r.id) + '" value="' + esc(r.date || '') + '" aria-label="Date">'
        + '<select data-race="mode" data-id="' + esc(r.id) + '" aria-label="Points">' + Object.keys(MODES).filter(function (k) { return k !== 'nascar'; }).map(function (k) { return '<option value="' + k + '"' + ((r.mode === 'nascar' ? 'p2017' : r.mode || 'p2017') === k ? ' selected' : '') + '>' + MODES[k] + '</option>'; }).join('') + '</select>'
        + (r.mode === 'custom' ? '<input data-race="custom" data-id="' + esc(r.id) + '" value="' + esc(r.custom || '') + '" placeholder="43,38,36..." aria-label="Custom points">' : '') + '</div>'
        + '<div class="inl"><small>Won by ' + esc(info.winner.driver) + ', ' + r.rows.length + ' cars, ' + J.plural(arts, 'story') + '</small><a class="btn ghost sm" href="#/results/' + esc(r.id) + '">View</a>' + (J.ai.hasKey() ? '<button class="btn ghost sm" data-act="raceCover" data-id="' + esc(r.id) + '">Write coverage</button>' : '') + '<button class="btn danger sm" data-act="raceDel" data-id="' + esc(r.id) + '">Remove</button></div></div>';
    }).join('') + '</section>' : J.empty('No races yet', 'Import your first race and it shows up here.', '<a class="btn sm" href="#/import">Import a race</a>'))
    + sessionsPanel(S);
};
function sessionsPanel(S) {
  var by = {}; (S.sessions || []).forEach(function (x) { (by[x.sid] = by[x.sid] || []).push(x); });
  var rounds = S.schedule.filter(function (r) { return by[r.id]; }); if (!rounds.length) return '';
  return '<section class="panel"><h3>Practice and qualifying</h3><p class="sub">These never change the standings. They show on the site and feed the Race Outlook.</p>' + rounds.map(function (r) {
    return J.sessionsFor(S, r.id).map(function (x) { return '<div class="mrow"><div><b>' + esc(r.name) + ': ' + esc(J.SESSIONS[x.type]) + '</b><small>' + J.plural(x.rows.length, 'car') + (x.rows[0] ? ', fastest ' + esc(x.rows[0].driver) + (x.rows[0].time ? ' (' + esc(x.rows[0].time) + ')' : '') : '') + (x.source ? ', from ' + esc(x.source) : '') + '</small></div><div class="inl"><a class="btn ghost sm" href="#/garage/race">View</a><button class="btn danger sm" data-act="sessDel" data-id="' + esc(x.id) + '">Remove</button></div></div>'; }).join('');
  }).join('') + '</section>';
}
J.acts.sessDel = function (el) { var S = J.S, x = S.sessions.find(function (q) { return q.id === el.dataset.id; }); if (!x || !confirm('Remove ' + J.SESSIONS[x.type].toLowerCase() + ' for ' + x.name + '?')) return; S.sessions = S.sessions.filter(function (q) { return q.id !== x.id; }); J.save(); J.toast('Removed.'); };
J.nav.push({ id: 'races', label: 'Races', group: 'Commissioner', admin: true });
document.addEventListener('change', function (e) {
  var t = e.target, f = t.dataset && t.dataset.race; if (!f) return;
  var S = J.S, r = S.races.find(function (x) { return x.id === t.dataset.id; }); if (!r) return;
  if (f === 'name') r.name = t.value.trim() || r.name;
  else if (f === 'date') { r.date = t.value; S.races.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }); J.realignAll(S); }
  else if (f === 'mode' || f === 'custom') { r[f] = t.value; J.rescoreRace(r); J.toast('Points recalculated for ' + r.name + '.'); }
  J.save({ render: f === 'mode' });
});
J.acts.raceDel = function (el) {
  var S = J.S, r = S.races.find(function (x) { return x.id === el.dataset.id; }); if (!r) return;
  var auto = S.articles.filter(function (a) { return a.raceId === r.id && a.auto; }).length;
  if (!confirm('Remove "' + r.name + '" and its points? Stories about it stay, except the automatic recap.')) return;
  S.races = S.races.filter(function (x) { return x.id !== r.id; });
  if (auto) S.articles = S.articles.filter(function (a) { return !(a.raceId === r.id && a.auto); });
  J.save(); J.toast('Race removed.');
};
J.acts.raceCover = function (el) { var r = J.S.races.find(function (x) { return x.id === el.dataset.id; }); if (!r) return; J.go('import'); setTimeout(function () { J.runCoverage(r); }, 50); };

/* ---------- Schedule editor ---------- */
function typeSel(r) { return '<select data-sch="type" data-id="' + esc(r.id) + '" aria-label="Track type">' + J.TYPE_KEYS.map(function (k) { return '<option value="' + k + '"' + (r.type === k ? ' selected' : '') + '>' + esc(J.TYPES[k]) + '</option>'; }).join('') + '</select>'; }
J.routes.editschedule = function (S) {
  var done = {}; S.races.forEach(function (r) { done[r.sid] = 1; }); var clash = J.dateClashes(S);
  var warnRow = function (r) { var c = clash[r.id]; if (!c) return ''; var run = S.races.find(function (x) { return x.sid === r.id; }); return '<div class="schwarn" role="note">' + (run && run.date !== r.date ? 'This race was run with the date ' + esc(J.fmtDate(run.date)) + ' (change that on the Races page). ' : '') + 'That is the same day as, or before, ' + esc(c.name) + ' (' + esc(J.fmtDate(c.d)) + (S.races.some(function (x) { return x.sid === c.id && x.date !== (S.schedule.find(function (y) { return y.id === c.id; }) || {}).date; }) ? ', the date it was run with on the Races page' : '') + '). Two race weekends that close get their stories and fan posts mixed together, so give each race its own weekend.</div>'; };
  return J.phead('Edit Schedule', S.schedule.length + ' races. Track type drives the Race Outlook, so set it right.', '<button class="btn ghost sm" data-act="schStarter">Load starter schedule</button>')
    + tplPanel(S)
    + '<section class="panel"><div class="schr hdr" style="background:none;border:0;padding:0 10px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em"><span>Race name</span><span>Track</span><span>Type</span><span>Date</span><span>Time (ET)</span><span>TV / streaming</span><span>Note</span><span></span></div>'
    + S.schedule.map(function (r, i) {
      return '<div class="schr' + (i + 1 === S.chase.regularRaces ? ' cut' : '') + '"><input data-sch="name" data-id="' + esc(r.id) + '" value="' + esc(r.name) + '" aria-label="Race ' + (i + 1) + ' name"><input data-sch="track" data-id="' + esc(r.id) + '" value="' + esc(r.track || '') + '" aria-label="Track">' + typeSel(r) + '<input type="date" data-sch="date" data-id="' + esc(r.id) + '" value="' + esc(r.date || '') + '" aria-label="Date"><input type="time" data-sch="time" data-id="' + esc(r.id) + '" value="' + esc(r.time || '') + '" aria-label="Start time (Eastern)"><input data-sch="tv" data-id="' + esc(r.id) + '" value="' + esc([r.tv, r.stream].filter(Boolean).join(' / ')) + '" placeholder="TV / streaming" aria-label="TV and streaming"><input data-sch="note" data-id="' + esc(r.id) + '" value="' + esc(r.note || '') + '" placeholder="' + (done[r.id] ? 'Run' : 'Note') + '" aria-label="Note">'
        + '<div class="inl" style="flex-wrap:nowrap"><button class="btn ghost sm" data-act="schMove" data-d="-1" data-id="' + esc(r.id) + '" aria-label="Move up"' + (i ? '' : ' disabled') + '>&#9650;</button><button class="btn ghost sm" data-act="schMove" data-d="1" data-id="' + esc(r.id) + '" aria-label="Move down"' + (i < S.schedule.length - 1 ? '' : ' disabled') + '>&#9660;</button><button class="btn danger sm" data-act="schDel" data-id="' + esc(r.id) + '" aria-label="Delete"' + (done[r.id] ? ' disabled title="Has a result"' : '') + '>&#10005;</button></div></div>'
        + warnRow(r)
        + (i + 1 === S.chase.regularRaces ? '<div class="cutrow" style="margin:-2px 0 8px">' + esc(S.chase.name) + ' field is set after race ' + (i + 1) + '</div>' : '');
    }).join('')
    + '<div class="row"><button class="btn sm" data-act="schAdd">Add a race</button></div></section>';
};
J.nav.push({ id: 'editschedule', label: 'Edit Schedule', group: 'Commissioner', admin: true });
document.addEventListener('change', function (e) {
  var t = e.target, f = t.dataset && t.dataset.sch; if (!f) return;
  var S = J.S, r = S.schedule.find(function (x) { return x.id === t.dataset.id; }); if (!r) return;
  r[f] = t.value.trim();
  if (f === 'tv') r.stream = ''; // one box holds both
  if (f === 'track' && t.value.trim()) { var g = J.guessType(t.value); if (g !== r.type) { r.type = g; J.save(); J.toast('Track type set to ' + J.TYPES[g] + '. Change it if that is wrong.'); return; } }
  if (f === 'date') { J.realignAll(S); J.save(); return; } // stories and fan posts move with the date; warnings update
  J.save({ render: false });
});
J.acts.schAdd = function () { var S = J.S; S.schedule.push({ id: J.uid('s'), name: 'New race', track: '', type: 'inter', date: '', note: '' }); J.save(); setTimeout(function () { var x = document.querySelectorAll('[data-sch="name"]'); if (x.length) { x[x.length - 1].focus(); x[x.length - 1].select(); } }, 30); };
J.acts.schDel = function (el) { var S = J.S; S.schedule = S.schedule.filter(function (x) { return x.id !== el.dataset.id; }); J.save(); };
J.acts.schMove = function (el) { var l = J.S.schedule, i = l.findIndex(function (x) { return x.id === el.dataset.id; }), j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= l.length) return; var t = l[i]; l[i] = l[j]; l[j] = t; J.save(); };
/* ---------- schedule templates: real series schedules (templates.js) and the commissioner's own ---------- */
function myTpls() { return (J.settings && J.settings.schedTemplates) || []; }
function allTpls(S) {
  var real = (J.SCHEDULE_TEMPLATES || []).slice().sort(function (a, b) { return (a.series === S.series.id ? 0 : 1) - (b.series === S.series.id ? 0 : 1) || b.season - a.season || J.SERIES_ORDER.indexOf(a.series) - J.SERIES_ORDER.indexOf(b.series); });
  return real.concat(myTpls().map(function (t) { return Object.assign({ mine: true }, t); }));
}
function tplPanel(S) {
  var list = allTpls(S);
  return '<section class="panel"><h3>Schedule templates</h3><p class="sub">Load a real schedule with every race name, track, date, start time and TV channel filled in, or one you saved. You can still change anything after. Exhibition races (Clash, Duels, All-Star) are left out because they do not pay points.</p>'
    + '<div class="inl tplrow"><select id="schTplSel" aria-label="Schedule template">' + '<optgroup label="Real schedules">' + list.filter(function (t) { return !t.mine; }).map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.label) + ' (' + t.rows.length + ' races)' + (t.series === S.series.id ? '' : ' (other series)') + '</option>'; }).join('') + '</optgroup>'
    + (myTpls().length ? '<optgroup label="My templates">' + myTpls().map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.label) + ' (' + t.rows.length + ' races)</option>'; }).join('') + '</optgroup>' : '') + '</select>'
    + '<button class="btn sm" data-act="schTpl">Load template</button><button class="btn ghost sm" data-act="schTplSave">Save this schedule as a template</button>' + (myTpls().length ? '<button class="btn ghost sm" data-act="schTplDel">Delete selected (mine only)</button>' : '') + '</div>'
    + '<label class="check"><input type="checkbox" id="schTplChase" checked> Also use that season\'s ' + esc(S.chase.name) + ' format (how many drivers make it and after which race)</label></section>';
}
J.acts.schTpl = function () {
  var S = J.S, id = $('schTplSel').value, t = allTpls(S).find(function (x) { return x.id === id; }); if (!t) return;
  var run = S.races.length;
  if (!confirm('Replace this schedule with ' + t.label + ' (' + t.rows.length + ' races)?' + (run ? ' The ' + J.plural(run, 'race') + ' you already ran stay attached to rounds 1 to ' + run + ' in order.' : ''))) return;
  var order = {}; S.schedule.forEach(function (r, i) { order[r.id] = i; });
  var keepIds = S.schedule.map(function (r) { return r.id; });
  S.schedule = t.rows.map(function (x, i) {
    var name = x[0] || (String(x[1]).replace(/(International |Motor |Superspeedway|Speedway|Raceway|Motorsports? Park)/g, ' ').replace(/\s+/g, ' ').trim() + ' (name TBA)');
    return { id: keepIds[i] || J.uid('s'), name: name, track: x[1], city: x[2], date: x[3], time: x[4], tv: x[5], stream: '', type: x[6] || J.guessType(x[1]), note: '' };
  });
  if ($('schTplChase').checked && t.cut) { S.chase.regularRaces = t.cut; if (t.size) S.chase.size = t.size; if (t.season >= 2026) S.chase.winLocks = false; }
  if (!run && t.season) S.season = t.season;
  J.realignAll(S); J.save(); J.toast(t.label + ' loaded.');
};
J.acts.schTplSave = async function () {
  var S = J.S, nm = prompt('Name for this template', J.seasonYear(S) + ' ' + S.series.label + ' (mine)'); if (!nm) return;
  var t = { id: 'my-' + Date.now().toString(36), series: S.series.id, season: +J.seasonYear(S) || 0, label: nm, cut: S.chase.regularRaces, size: S.chase.size, rows: S.schedule.map(function (r) { return [r.name, r.track || '', r.city || '', r.date || '', r.time || '', [r.tv, r.stream].filter(Boolean).join(' / '), r.type]; }) };
  J.settings.schedTemplates = myTpls().concat([t]); await J.saveSettings(); J.refresh(); J.toast('Saved as a template. It is in the list for every series.');
};
J.acts.schTplDel = async function () {
  var id = $('schTplSel').value, t = myTpls().find(function (x) { return x.id === id; }); if (!t) { J.toast('Pick one of your own templates to delete.', true); return; }
  if (!confirm('Delete the template "' + t.label + '"?')) return;
  J.settings.schedTemplates = myTpls().filter(function (x) { return x.id !== id; }); await J.saveSettings(); J.refresh();
};
J.acts.schStarter = function () {
  var S = J.S; if (S.races.length) { J.toast('You already have results tied to this schedule. Edit it race by race instead.', true); return; }
  if (!confirm('Replace the schedule with the ' + S.series.label + ' starter schedule?')) return;
  S.schedule = J.starterSchedule(S.id); J.save(); J.toast('Starter schedule loaded.');
};

/* ---------- League ---------- */
J.routes.league = function (S) {
  var c = S.chase;
  var leagues = J.seriesList.map(function (s) {
    var L = J.leagues[s.id], past = J.seasonsFor(s.id).filter(function (x) { return !x.current; });
    var head = '<div class="mrow"><div class="sername">' + J.seriesBadge(s.id) + '<div><b>' + esc(s.label) + '</b><small>' + (L ? J.seasonYear(L) + ' season, ' + J.plural(L.races.length, 'race') + ' run' + (L.id === S.id ? ' (open now)' : '') : 'Not started') + '</small></div></div><div class="inl">'
      + (L ? (L.id !== S.id ? '<button class="btn ghost sm" data-act="leagueOpen" data-id="' + s.id + '">Open</button>' : '') + '<button class="btn sm" data-act="seasonNew" data-id="' + s.id + '">Finish season, start next</button><button class="btn ghost sm" data-act="seasonNew" data-mode="cancel" data-id="' + s.id + '">Cancel season</button><button class="btn danger sm" data-act="leagueDel" data-id="' + s.id + '">Delete</button>' : '<button class="btn sm" data-act="leagueOpen" data-id="' + s.id + '">Start this series</button>') + '</div></div>';
    return head + past.map(function (x) { var P = J.leagues[x.id]; return '<div class="mrow past"><div><b>' + esc(x.label) + '</b><small>' + J.plural(P.races.length, 'race') + ', ' + J.plural(P.articles.length, 'story', 'stories') + (P.id === S.id ? ' (open now)' : '') + '</small></div><div class="inl">' + (P.id !== S.id ? '<button class="btn ghost sm" data-act="leagueOpen" data-id="' + esc(x.id) + '">Open</button>' : '') + '<button class="btn danger sm" data-act="seasonDel" data-id="' + esc(x.id) + '">Delete season</button></div></div>'; }).join('');
  }).join('');
  return J.phead('League', S.series.label + ' settings, announcements and backups')
    + '<section class="panel"><h3>Basics</h3><div class="fgrid">'
    + '<div class="field"><label for="lgName">League name</label><input id="lgName" value="' + esc(S.league.name) + '"></div>'
    + '<div class="field"><label for="chName">Playoff name</label><input id="chName" value="' + esc(c.name) + '"></div>'
    + '<div class="field"><label for="chSize">Drivers who make it</label><input id="chSize" type="number" min="2" max="40" value="' + c.size + '"></div>'
    + '<div class="field"><label for="chCut">Field set after race</label><input id="chCut" type="number" min="1" max="60" value="' + c.regularRaces + '"></div></div>'
    + '<label class="check"><input type="checkbox" id="chWins"' + (c.winLocks ? ' checked' : '') + '> A win locks a driver in (win and you are in)</label>'
    + '<div class="row"><button class="btn sm" data-act="lgSave">Save</button></div></section>'
    + pointsPanel(S) + outletPanel(S)
    + '<section class="panel"><h3>Commissioner note</h3><p class="sub">Shows at the top of the home page.</p><textarea id="annText" placeholder="Example: Martinsville moved to Saturday night.">' + esc(S.announcement.text) + '</textarea><div class="row"><button class="btn sm" data-act="annPost">Post note</button>' + (S.announcement.text ? '<button class="btn ghost sm" data-act="annClear">Remove note</button>' : '') + '</div></section>'
    + '<section class="panel"><h3>Series and seasons</h3><p class="sub">Each series has its own schedule, standings, news and fans. Finish a season to move it to past seasons (still viewable in the app and on the website) and start the next one with the same league, fans and settings. Cancel ends a season early and keeps it marked cancelled.</p>' + leagues + '</section>'
    + '<section class="panel"><h3>Backup</h3><p class="sub">Save everything (all series, stories, fans, photos) to one file, or bring a backup back. Your AI key and GitHub token are never put in a backup.</p><div class="row"><button class="btn sm" data-act="bkDown">Download backup</button><button class="btn ghost sm" data-act="bkUp">Restore a backup</button><input type="file" id="bkFile" accept=".json,application/json" hidden></div></section>'
    + '<section class="panel"><h3>Start over</h3><p class="sub">Only for ' + esc(S.series.label) + '. Download a backup first.</p><div class="row"><button class="btn danger sm" data-act="resetResults">Clear results only</button><button class="btn danger sm" data-act="resetSeason">New season (clear everything but the schedule)</button></div></section>';
};
function outletPanel(S) {
  return '<section class="panel"><h3>News outlets</h3><p class="sub">Rename the three outlets, their taglines and their writers. Old stories switch to the new names too.</p>'
    + Object.keys(J.OUTLET_BASE).map(function (k) { var o = J.OUTLETS[k]; return '<div class="olrow">' + J.outletLogo(k) + '<div class="field"><label for="olN_' + k + '">Name</label><input id="olN_' + k + '" value="' + esc(o.name) + '"></div><div class="field"><label for="olT_' + k + '">Tagline</label><input id="olT_' + k + '" value="' + esc(o.tag) + '"></div><div class="field"><label for="olS_' + k + '">Writers (commas)</label><input id="olS_' + k + '" value="' + esc(o.staff.join(', ')) + '"></div></div>'; }).join('')
    + '<div class="row"><button class="btn sm" data-act="olSave">Save outlets</button><button class="btn ghost sm" data-act="olReset">Back to the default names</button></div></section>';
}
J.acts.olSave = function () {
  var S = J.S; S.outletNames = {};
  Object.keys(J.OUTLET_BASE).forEach(function (k) { S.outletNames[k] = { name: $('olN_' + k).value.trim().slice(0, 40), tag: $('olT_' + k).value.trim().slice(0, 60), staff: $('olS_' + k).value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6) }; });
  J.useOutlets(S); J.save(); J.toast('Outlets saved.');
};
J.acts.olReset = function () { var S = J.S; delete S.outletNames; J.useOutlets(S); J.save(); J.toast('Default outlet names are back.'); };
function pointsPanel(S) {
  var sp = J.seasonPoints(S), cur = (S.points && S.points.template) || 'p2017';
  return '<section class="panel"><h3>Points system</h3><p class="sub">Used for every race you import this season. Pick a real NASCAR system or make your own. Stage points are not counted because NR2003 does not run stages. Picking 2026 also turns off win-and-in (the top drivers in points make it); the stage era turns it on.</p>'
    + '<div class="ptpl">' + J.POINTS_ORDER.map(function (k) { var t = J.POINTS[k], ex = t.table ? t.table.slice(0, 5).join(', ') + '...' : k === 'simple' ? 'last place 1, +1 per car beaten' : 'you set it'; return '<label class="pt' + (cur === k ? ' on' : '') + '"><input type="radio" name="ptTpl" value="' + k + '"' + (cur === k ? ' checked' : '') + '><b>' + esc(t.name) + '</b><small>' + esc(t.note) + '</small><span class="ptx">' + esc(ex) + (t.led || t.most ? ' / led a lap +' + t.led + ', most laps +' + t.most : '') + '</span></label>'; }).join('') + '</div>'
    + '<div class="fgrid" id="ptCustom"' + (cur === 'custom' ? '' : ' hidden') + '><div class="field" style="grid-column:1/-1"><label for="ptTable">Points for 1st, 2nd, 3rd... (commas; the last number repeats for everyone after)</label><input id="ptTable" value="' + esc(((S.points && S.points.table) || []).join(', ')) + '" placeholder="50, 45, 42, 40, 38, 36"></div><div class="field"><label for="ptLed">Bonus for leading a lap</label><input id="ptLed" type="number" min="0" max="50" value="' + esc((S.points && S.points.led) || 0) + '"></div><div class="field"><label for="ptMost">Bonus for leading the most laps</label><input id="ptMost" type="number" min="0" max="50" value="' + esc((S.points && S.points.most) || 0) + '"></div></div>'
    + '<div class="row"><button class="btn sm" data-act="ptSave">Save points system</button><button class="btn ghost sm" data-act="ptApply"' + (S.races.length ? '' : ' disabled') + '>Save and re-score all ' + J.plural(S.races.length, 'race') + ' run</button></div></section>';
}
function ptRead(S) {
  var k = (document.querySelector('input[name="ptTpl"]:checked') || {}).value || 'p2017';
  S.points = { template: k };
  if (k === 'custom') { S.points.table = $('ptTable').value.split(/[,\s]+/).map(Number).filter(function (x) { return isFinite(x) && x >= 0; }); S.points.led = +$('ptLed').value || 0; S.points.most = +$('ptMost').value || 0; if (!S.points.table.length) { J.toast('Type at least one number for the custom points.', true); return false; } }
  return true;
}
J.acts.ptSave = function () { var S = J.S; if (!ptRead(S)) return; var T = J.POINTS[S.points.template]; if (T && T.chase && T.chase.winLocks != null) S.chase.winLocks = T.chase.winLocks; J.save(); J.toast('Points system saved: ' + J.seasonPoints(S).name + '. New imports use it.'); };
J.acts.ptApply = function () {
  var S = J.S; if (!ptRead(S)) return; var T = J.POINTS[S.points.template]; if (T && T.chase && T.chase.winLocks != null) S.chase.winLocks = T.chase.winLocks;
  if (!confirm('Re-score all ' + J.plural(S.races.length, 'race') + ' with ' + J.seasonPoints(S).name + '? Standings will change.')) return;
  S.races.forEach(function (r) { if (r.mode !== 'file') { r.mode = S.points.template; r.custom = S.points.template === 'custom' ? S.points.table.join(',') : ''; J.rescoreRace(r); } });
  J.save(); J.toast('Every race re-scored with ' + J.seasonPoints(S).name + '.');
};
document.addEventListener('change', function (e) { if (e.target && e.target.name === 'ptTpl') { document.querySelectorAll('.pt').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); var c = $('ptCustom'); if (c) c.hidden = e.target.value !== 'custom'; } });
J.afters.league = function () { var f = $('bkFile'); if (f) f.addEventListener('change', function () { restore(this.files[0]); this.value = ''; }); };
J.nav.push({ id: 'league', label: 'League', group: 'Commissioner', admin: true });
J.acts.lgSave = function () {
  var S = J.S, n = function (id, lo, hi, d) { var v = parseInt($(id).value, 10); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  S.league.name = $('lgName').value.trim() || S.league.name;
  S.chase.name = $('chName').value.trim() || 'The Chase';
  S.chase.size = n('chSize', 2, 40, S.chase.size); S.chase.regularRaces = n('chCut', 1, 60, S.chase.regularRaces); S.chase.winLocks = $('chWins').checked;
  J.save(); J.toast('League settings saved.');
};
J.acts.annPost = function () { var S = J.S; S.announcement = { text: $('annText').value.trim(), date: J.todayISO() }; J.save(); J.toast(S.announcement.text ? 'Note posted.' : 'Note removed.'); };
J.acts.annClear = function () { J.S.announcement = { text: '', date: '' }; J.save(); };
J.acts.leagueOpen = function (el) { var id = el.dataset.id; if (J.SERIES[id]) J.acts.switchSeries({ value: id }); else J.acts.switchSeason(id); };
J.acts.leagueDel = async function (el) {
  var id = el.dataset.id, L = J.leagues[id]; if (!L) return;
  if (!confirm('Delete the whole ' + L.series.label + ' league? This cannot be undone. Download a backup first if you might want it.')) return;
  if (prompt('Type DELETE to confirm') !== 'DELETE') return;
  for (var i = 0; i < L.media.length; i++) { try { await J.store.delMedia(L.media[i].id); await J.store.delMedia(L.media[i].id + ':poster'); } catch (e) {} }
  delete J.leagues[id]; await J.store.deleteLeague(id);
  if (!Object.keys(J.leagues).length) { J.leagues.cup = J.newLeague('cup'); await J.store.saveLeague(J.leagues.cup); }
  if (J.S.id === id) { J.S = J.leagues[Object.keys(J.leagues)[0]]; await J.store.setActive(J.S.id); await J.store.loadBlobs(J.S); }
  J.save(); J.toast('League deleted.');
};
J.acts.bkDown = async function () {
  J.toast('Building the backup...');
  var media = {};
  for (var k in J.leagues) { var L = J.leagues[k]; for (var i = 0; i < L.media.length; i++) { var m = L.media[i]; try { var b = await J.store.getMedia(m.id); if (b && b.size < 60e6) media[m.id] = { type: b.type, data: await J.blobToBase64(b) }; var p = await J.store.getMedia(m.id + ':poster'); if (p) media[m.id + ':poster'] = { type: p.type, data: await J.blobToBase64(p) }; } catch (e) {} } }
  var out = { kind: 'jss-backup', v: 1, at: new Date().toISOString(), active: J.S.id, leagues: J.leagues, media: media };
  J.download('jss-backup-' + J.todayISO() + '.json', JSON.stringify(out), 'application/json');
};
J.acts.bkUp = function () { $('bkFile').click(); };
async function restore(f) {
  if (!f) return;
  try {
    var p = JSON.parse(await J.readFileText(f)), leagues = {};
    if (p && p.kind === 'jss-backup') Object.keys(p.leagues || {}).forEach(function (k) { leagues[k] = J.normalize(p.leagues[k]); });
    else if (p && Array.isArray(p.races)) { var L = J.normalize(Object.assign({ id: 'cup', series: { id: 'cup', label: 'Cup Series', short: 'CUP' } }, p)); leagues[L.id] = L; } // beta backup
    else throw new Error('not a JSS backup');
    if (!confirm('Replace ' + Object.keys(leagues).map(function (k) { return leagues[k].series.label; }).join(', ') + ' with this backup?')) return;
    var media = p.media || {};
    for (var key in media) { var bin = atob(media[key].data), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); await J.store.putMedia(key, new Blob([u], { type: media[key].type || '' })); }
    for (var k in leagues) { J.leagues[k] = leagues[k]; await J.store.saveLeague(leagues[k]); }
    J.S = J.leagues[p.active] || leagues[Object.keys(leagues)[0]]; await J.store.setActive(J.S.id); await J.store.loadBlobs(J.S);
    J.save(); J.toast('Backup restored.');
  } catch (e) { J.toast('That is not a backup this app can read (' + e.message + ').', true); }
}
J.acts.resetResults = function () { if (!confirm('Clear every race result and all points for ' + J.S.series.label + '?')) return; J.S.races = []; J.save(); J.toast('Results cleared.'); };
J.acts.resetSeason = function () {
  var S = J.S; if (!confirm('Start a new season for ' + S.series.label + '? Results, stories, fan posts, interviews, reputations and highlights are cleared. The schedule, league settings and fan accounts stay.')) return;
  S.races = []; S.articles = []; S.posts = []; S.interviews = []; S.rep = {}; S.ai = {}; S.media = [];
  S.fans.forEach(function (f) { if (f.stance) f.stance.seen = 0; });
  J.save(); J.toast('New season ready.');
};

/* ---------- articles: edit / delete / reactions ---------- */
J.acts.editArticle = function (el) {
  var S = J.S, a = S.articles.find(function (x) { return x.id === el.dataset.id; }); if (!a) return;
  var media = S.media.map(function (m) { return '<label class="check"><input type="checkbox" data-am="' + esc(m.id) + '"' + ((a.media || []).indexOf(m.id) >= 0 ? ' checked' : '') + '> ' + esc(m.caption || m.name) + '</label>'; }).join('');
  $('dlgBody').innerHTML = '<div class="dlg-h"><h3>Edit story</h3><button class="dlg-x" data-act="closeDlg" aria-label="Close">&#10005;</button></div><div class="dlg-b">'
    + '<div class="fgrid"><div class="field"><label for="eOut">Outlet</label><select id="eOut">' + Object.keys(J.OUTLETS).map(function (k) { return '<option value="' + k + '"' + (a.outlet === k ? ' selected' : '') + '>' + esc(J.OUTLETS[k].name) + '</option>'; }).join('') + '</select></div><div class="field"><label for="eAuth">Byline</label><input id="eAuth" value="' + esc(a.author || '') + '"></div></div>'
    + '<div class="field"><label for="eHead">Headline</label><input id="eHead" value="' + esc(a.headline) + '"></div><div class="field" style="margin-top:10px"><label for="eDek">Summary line</label><input id="eDek" value="' + esc(a.dek || '') + '"></div>'
    + '<div class="field" style="margin-top:10px"><label for="eBody">Story</label><textarea id="eBody" style="min-height:300px">' + esc(a.body) + '</textarea></div>'
    + (media ? '<h3 style="font-size:18px;margin-top:14px">Photos and video in this story</h3>' + media : '')
    + '<div class="row"><button class="btn" data-act="saveArticle" data-id="' + esc(a.id) + '">Save</button><button class="btn ghost" data-act="closeDlg">Cancel</button></div></div>';
  $('dlg').showModal();
};
J.acts.saveArticle = function (el) {
  var S = J.S, a = S.articles.find(function (x) { return x.id === el.dataset.id; }); if (!a) return;
  a.outlet = $('eOut').value; a.author = $('eAuth').value.trim(); a.headline = $('eHead').value.trim() || a.headline; a.dek = $('eDek').value.trim(); a.body = $('eBody').value; a.auto = false;
  a.media = Array.prototype.filter.call(document.querySelectorAll('[data-am]'), function (c) { return c.checked; }).map(function (c) { return c.dataset.am; });
  J.acts.closeDlg(); J.save(); J.toast('Story saved.');
};
J.acts.delArticle = function (el) {
  var S = J.S, id = el.dataset.id; if (!confirm('Delete this story? Fan reactions to it are deleted too.')) return;
  S.articles = S.articles.filter(function (x) { return x.id !== id; });
  S.posts = S.posts.filter(function (p) { return !(p.ref && p.ref.type === 'article' && p.ref.id === id); });
  S.interviews = S.interviews.filter(function (x) { return x.ref !== id; });
  J.save({ render: false }); J.go('news'); J.toast('Story deleted.');
};
var reacting = {};
J.reactToArticle = async function (id, quiet) {
  var S = J.S, a = S.articles.find(function (x) { return x.id === id; }); if (!a) return;
  if (!J.ai.hasKey()) { J.toast('Add your ' + J.ai.name() + ' key in Settings first.', true); return; }
  if (reacting[id]) return; reacting[id] = 1;
  if (!quiet) J.toast('The fans are reading the story. About 30 seconds.');
  try {
    var nx = J.nextRound(S), preSid = a.preSid || '';
    var race = preSid ? null : (S.races.find(function (r) { return r.id === a.raceId; }) || S.races[S.races.length - 1]);
    var facts = (preSid ? J.ai.sessionFacts(S, preSid) + '\n' : race ? J.ai.raceFacts(S, race) + '\n' : '') + 'THE ARTICLE (' + J.OUTLETS[a.outlet].name + '):\n' + a.headline + '\n' + (a.dek || '') + '\n' + a.body.slice(0, 3500);
    var n = await J.ai.threads(S, { facts: facts, story: a, focus: a.tags || [], at: a.ts, race: !!(race && a.raceId === race.id), ref: { type: 'article', id: a.id }, task: 'Write 4 to 6 threads reacting to THIS article. People quote it, argue with it, call it fake news, add context, or bring up something it left out. Keep every fact consistent with the article and the race data.' });
    J.driftFans(S); J.save({ render: J.route().name === 'news' || J.route().name === 'garage' });
    J.toast(n + ' fan posts added.');
  } catch (e) { J.toast('Fan reactions failed: ' + e.message, true); }
  delete reacting[id];
};
J.acts.reactArticle = function (el) { J.reactToArticle(el.dataset.id); };
J.acts.runNewsroom = function () { garageRun('news'); };

/* ---------- Garage tools ---------- */
function sillyNote(S) {
  var ph = J.sillyPhase(S), pct = Math.round(ph.rate * 100);
  var how = { preseason: 'Only this season\'s sponsor and paint scheme news, no rumors about next year yet.', early: 'Real teams almost never announce next year this early, so it is whispers and rumors only.', spring: 'Rumors heat up and teams start talks, but no big announcements yet.', summer: 'The busiest stretch. This is when real teams confirm most of next year.', playoffs: 'Most rides are set. The last open seats and quiet crew chief whispers.', finale: 'Teams stay quiet so they do not step on the title fight.', offseason: 'Announcement season: crew chief swaps, new sponsors, the last open seats.' }[ph.id];
  return '<p class="fine">Silly season right now: <b>' + esc(ph.label) + '</b>. ' + esc(how) + ' Each newsroom run has about a ' + pct + '% chance of a silly season story.</p>';
}
var gBusy = '';
async function garageRun(kind) {
  var S = J.S; if (gBusy) return; if (J.refreshAll && J.refreshAll.running) { J.toast('Wait for Refresh everything to finish (or stop it) first.', true); return; } if (!J.ai.hasKey()) { J.toast('Add your ' + J.ai.name() + ' key in Settings first.', true); return; }
  var newsFor = ($('newsFor') || {}).value || ''; J.ui.newsFor = newsFor;
  var nx = J.nextRound(S), pre = nx && J.sessionsFor(S, nx.id).length;
  if (!S.races.length && !pre && kind !== 'news') { J.toast('Import a race, practice or qualifying first.', true); return; }
  if (kind === 'outlooks' && !S.races.length) { J.toast('Outlook commentary needs at least one race. Practice and qualifying already show in the Race Outlook.', true); return; }
  gBusy = kind; J.refresh();
  try {
    if (kind === 'refresh' || kind === 'talk') {
      await J.ai.chatter(S);
    }
    if (kind === 'news') { var nsid = newsFor; var made = await J.ai.newsCycle(S, nsid ? { phase: 'pre', sid: nsid } : { phase: 'week' }); J.driftFans(S); J.save({ render: false }); J.toast(made.length + (made.length === 1 ? ' new story' : ' new stories') + ' from the newsroom.'); gBusy = ''; J.refresh(); return; }
    if ((kind === 'refresh' || kind === 'outlooks') && S.races.length) await J.ai.outlooks(S);
    J.driftFans(S); J.save({ render: false }); J.toast('The Garage is refreshed.');
  } catch (e) { J.toast(e.message, true); }
  gBusy = ''; J.refresh();
}
J.acts.genGarage = function () { garageRun('refresh'); };
J.acts.gtRun = function (el) { garageRun(el.dataset.k); };
J.routes.garagetools = function (S) {
  var hasKey = J.ai.hasKey(), ths = J.threadsOf(S), ages = { teen: 0, young: 0, adult: 0, oldhead: 0 }, st = { good: 0, bad: 0, none: 0 };
  S.fans.forEach(function (f) { ages[f.age] = (ages[f.age] || 0) + 1; if (f.stance && f.stance.level > 0) st.good++; else if (f.stance && f.stance.level < 0) st.bad++; else st.none++; });
  var b = function (k, label) { return '<button class="btn' + (k === 'refresh' ? '' : ' ghost') + ' sm" data-act="gtRun" data-k="' + k + '"' + (gBusy || !hasKey ? ' disabled' : '') + '>' + (gBusy === k ? 'Working...' : label) + '</button>'; };
  var drivers = J.roster(S);
  return J.phead('Garage Tools', 'Keep the fan chat and outlooks fresh')
    + (!hasKey ? '<div class="warn" style="margin:0 0 18px">These need an AI key (Gemini is free). Add it in <a href="#/settings"><b>Settings</b></a>.</div>' : '')
    + '<section class="panel"><h3>Refresh</h3><p class="sub">Race imports do this for you. Use these between races or when the Garage feels stale.</p><div class="row" style="margin-top:0">' + b('refresh', 'Refresh the Garage') + b('talk', 'New fan chatter only') + b('outlooks', 'New outlook commentary only') + '</div></section>'
    + '<section class="panel"><h3>Regenerate the AI people</h3><p class="sub">Give every fan account a brand new identity (name, handle, bio, hometown, profile), or give the media personalities new names and handles. Accounts keep their old posts under the new names. To rewrite the posts in their new voices too, run Refresh everything below afterwards.</p><div class="row" style="margin-top:0"><button class="btn sm" data-act="regenFans">New identities for all ' + S.fans.length + ' fans</button><button class="btn ghost sm" data-act="regenFans" data-reroll="1">New identities and new favorite drivers</button><button class="btn ghost sm" data-act="regenFigs">New media personalities</button>' + (S.figureOverrides ? '<button class="btn ghost sm" data-act="figsReset">Original media personalities</button>' : '') + '</div></section>'
    + '<section class="panel"><h3>Newsroom</h3><p class="sub">The outlets write 1 to 3 new stories. Pick a race to get previews dated the morning of that race, or "This week" for news between races. Silly season stories follow the real NASCAR calendar, so early in the season they are rare.</p>'
    + '<div class="inl"><select id="newsFor" aria-label="Stories about"><option value="">This week (between races)</option>' + S.schedule.filter(function (r) { return !S.races.some(function (x) { return x.sid === r.id; }); }).map(function (r) { var d = J.roundDate(S, r.id), nx = J.nextRound(S); return '<option value="' + esc(r.id) + '"' + ((J.ui.newsFor != null ? J.ui.newsFor === r.id : nx && nx.id === r.id) ? ' selected' : '') + '>Before ' + esc(r.name) + (d ? ' (' + esc(J.fmtDate(d)) + ')' : ' (no date set)') + '</option>'; }).join('') + '</select>' + b('news', 'Run the newsroom') + '</div>'
    + sillyNote(S) + sillyAdmin(S) + '</section>' + J.refreshPanel(S)
    + '<section class="panel"><h3>Fan accounts</h3><p class="sub">' + J.plural(S.fans.length, 'account') + ': ' + ages.teen + ' teens, ' + ages.young + ' young adults, ' + ages.adult + ' adults, ' + ages.oldhead + ' old-heads. ' + st.good + ' back a driver, ' + st.bad + ' are haters, ' + st.none + ' are neutral.</p>'
    + '<div class="row" style="margin-top:0"><button class="btn ghost sm" data-act="fansFill"' + (drivers.length ? '' : ' disabled') + '>Add more fans</button><button class="btn danger sm" data-act="fansReset"' + (S.fans.length ? '' : ' disabled') + '>Replace all fans</button></div></section>'
    + '<section class="panel"><h3>Nudge a reputation</h3><p class="sub">Something happened that the app did not see? Move a driver\'s reputation yourself. Fans react to big swings over time.</p>'
    + '<div class="inl"><select id="repDrv" aria-label="Driver">' + drivers.map(function (d) { return '<option value="' + esc(d.name) + '">' + esc(d.name) + ' (' + J.repOf(S, d.key).score + ')</option>'; }).join('') + '</select><select id="repDelta" aria-label="Change"><option value="6">+6 big gain</option><option value="3">+3</option><option value="1">+1</option><option value="-1">-1</option><option value="-3">-3</option><option value="-6">-6 big drop</option></select><input id="repWhy" placeholder="Why (fans will see this)" style="flex:1;min-width:220px"><button class="btn sm" data-act="repNudge"' + (drivers.length ? '' : ' disabled') + '>Apply</button></div></section>'
    + '<section class="panel"><h3>Posts</h3><p class="sub">' + J.plural(ths.length, 'thread') + ' in the Garage. Delete anything you do not like.</p>'
    + (ths.length ? ths.slice(0, 40).map(function (t) { var au = J.postAuthor(S, t.root); return '<div class="mrow"><div style="flex:1;min-width:0"><b>' + esc(t.root.title || (au ? au.name : '')) + '</b><small>' + esc(t.root.text.slice(0, 140)) + (t.root.text.length > 140 ? '...' : '') + '</small><small>' + J.plural(t.posts.length, 'post') + ', ' + esc(t.platform === 'forum' ? 'forum' : 'feed') + ', ' + esc(J.agoText(t.root.ts)) + '</small></div><button class="btn danger sm" data-act="thDel" data-id="' + esc(t.id) + '">Delete</button></div>'; }).join('') + '<div class="row"><button class="btn danger sm" data-act="postsClear">Delete all posts</button></div>' : '<p class="dim">No posts yet.</p>') + '</section>'
    + '<section class="panel"><h3>Pit road quotes</h3>' + (S.interviews.length ? S.interviews.map(function (x) { return '<div class="mrow"><div style="flex:1"><b>' + esc(x.driver) + '</b><small>' + esc(x.quote) + '</small></div><button class="btn danger sm" data-act="ivDel" data-id="' + esc(x.id) + '">Delete</button></div>'; }).join('') : '<p class="dim">No quotes yet.</p>') + '</section>';
};
J.nav.push({ id: 'garagetools', label: 'Garage Tools', group: 'Commissioner', admin: true });

/* ---------- Teams and contracts ---------- */
function yearOpts(S, sel) { var y = J.seasonNum(S), o = ''; for (var k = y - 1; k <= y + 5; k++) o += '<option value="' + k + '"' + (+sel === k ? ' selected' : '') + '>' + (k < y ? 'Expired (' + k + ')' : k === y ? y + ' (final year)' : k) + '</option>'; return o; }
function teamOpts(S, sel) { return '<option value="">No team</option>' + Object.keys(S.teams || {}).sort(function (a, b) { return S.teams[a].name.localeCompare(S.teams[b].name); }).map(function (k) { return '<option value="' + esc(k) + '"' + (sel === k ? ' selected' : '') + '>' + esc(S.teams[k].name) + '</option>'; }).join('') + '<option value="__new">+ New team...</option>'; }
J.routes.contracts = function (S) {
  J.ensureContracts(S, J.rosterLookup ? J.rosterLookup(S) : null);
  var ds = J.roster(S), canFill = J.rosterLookup && J.rosterLookup(S);
  return J.phead('Teams and Contracts', 'Who drives for whom, the car number, and how long the deal runs. Happiness is worked out from results, teammates, contract years and rumors.')
    + '<section class="panel"><h3>Fill in from the real roster</h3><p class="sub">Matches your drivers by name to the real ' + esc(S.series.label) + ' teams and car numbers' + (canFill ? '' : ' (no real roster loaded for this series)') + '. Drivers it cannot match keep what they have.</p><div class="row" style="margin-top:0"><button class="btn sm" data-act="rosterFill"' + (canFill ? '' : ' disabled') + '>Fill teams and numbers</button></div></section>'
    + '<section class="panel"><h3>Drivers</h3><div class="tw"><table class="data ctr"><thead><tr><th>Driver</th><th>Car</th><th>Team</th><th>Signed through</th><th>Mood baseline</th></tr></thead><tbody>' + ds.map(function (d) {
      var c = S.contracts[d.key] || {};
      return '<tr><td><a href="#/drivers/' + esc(d.key) + '"><b>' + esc(d.name) + '</b></a></td><td><input class="cnum" data-ct="car" data-k="' + esc(d.key) + '" value="' + esc(c.car || d.car || '') + '" aria-label="Car number"></td><td><select data-ct="team" data-k="' + esc(d.key) + '" aria-label="Team">' + teamOpts(S, c.team) + '</select></td><td><select data-ct="through" data-k="' + esc(d.key) + '" aria-label="Signed through">' + yearOpts(S, c.through) + '</select></td><td><input type="range" min="20" max="90" data-ct="base" data-k="' + esc(d.key) + '" value="' + (c.base || 60) + '" aria-label="Mood baseline"></td></tr>';
    }).join('') + '</tbody></table></div></section>'
    + '<section class="panel"><h3>Teams</h3>' + Object.keys(S.teams || {}).map(function (k) { return J.teamEditor(S, k, true); }).join('') + '<div class="row"><button class="btn ghost sm" data-act="teamNew">Add a team</button></div></section>';
};
J.nav.push({ id: 'contracts', label: 'Teams and Contracts', group: 'Commissioner', admin: true });
J.teamEditor = function (S, id, compact) {
  var t = S.teams[id]; if (!t) return '';
  return '<div class="teamed"' + (compact ? '' : ' style="margin-top:18px"') + '>' + (compact ? '' : '<h4>Edit team</h4>') + '<input type="color" data-tm="color" data-id="' + esc(id) + '" value="' + esc(t.color || '#888888') + '" aria-label="Team color"><input data-tm="name" data-id="' + esc(id) + '" value="' + esc(t.name) + '" aria-label="Team name"><input data-tm="base" data-id="' + esc(id) + '" value="' + esc(t.base || '') + '" placeholder="Base (city, state)" aria-label="Base"><select data-tm="mfr" data-id="' + esc(id) + '" aria-label="Manufacturer">' + ['', 'Chevrolet', 'Ford', 'Toyota'].map(function (m) { return '<option' + (t.mfr === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select><span class="dim">' + J.plural(J.teamDrivers(S, id).length, 'driver') + '</span><button class="btn danger sm" data-act="teamDel" data-id="' + esc(id) + '">Remove</button></div>';
};
J.driverEditor = function (S, key) {
  var c = S.contracts[key] || {};
  return '<section class="aside-card"><h4>Commissioner</h4><div class="field"><label>Team</label><select data-ct="team" data-k="' + esc(key) + '">' + teamOpts(S, c.team) + '</select></div><div class="field"><label>Car number</label><input data-ct="car" data-k="' + esc(key) + '" value="' + esc(c.car || '') + '"></div><div class="field"><label>Signed through</label><select data-ct="through" data-k="' + esc(key) + '">' + yearOpts(S, c.through) + '</select></div><div class="field"><label>Mood baseline (how happy they are before results)</label><input type="range" min="20" max="90" data-ct="base" data-k="' + esc(key) + '" value="' + (c.base || 60) + '"></div></section>';
};
document.addEventListener('change', function (e) {
  var t = e.target, S = J.S; if (!S) return;
  if (t.dataset && t.dataset.ct) {
    var c = S.contracts[t.dataset.k] = S.contracts[t.dataset.k] || { base: 60, through: J.seasonNum(S) };
    var f = t.dataset.ct; c.auto = false;
    if (f === 'team' && t.value === '__new') { var nm = prompt('New team name'); if (!nm) { t.value = c.team || ''; return; } var id = J.slug(nm); S.teams[id] = S.teams[id] || { id: id, name: nm.trim(), color: J.TEAM_COLORS[Object.keys(S.teams).length % J.TEAM_COLORS.length], base: '', mfr: '' }; c.team = id; }
    else c[f] = f === 'through' || f === 'base' ? +t.value : t.value.trim();
    J.save({ render: f === 'team' });
  } else if (t.dataset && t.dataset.tm) {
    var tm = S.teams[t.dataset.id]; if (!tm) return; tm[t.dataset.tm] = t.value.trim(); J.save({ render: false });
  }
});
J.acts.teamNew = function () { var S = J.S, nm = prompt('Team name'); if (!nm) return; var id = J.slug(nm); S.teams[id] = S.teams[id] || { id: id, name: nm.trim(), color: J.TEAM_COLORS[Object.keys(S.teams).length % J.TEAM_COLORS.length], base: '', mfr: '' }; J.save(); };
J.acts.teamDel = function (el) { var S = J.S, id = el.dataset.id, t = S.teams[id]; if (!t || !confirm('Remove ' + t.name + '? Its drivers will have no team.')) return; J.teamDrivers(S, id).forEach(function (k) { S.contracts[k].team = ''; }); delete S.teams[id]; J.save(); };
J.acts.rosterFill = function () {
  var S = J.S, look = J.rosterLookup && J.rosterLookup(S); if (!look) return;
  var n = 0; J.roster(S).forEach(function (d) { var k = look(d.name); if (!k) return; var id = J.slug(k.team); S.teams[id] = S.teams[id] || { id: id, name: k.team, color: k.color || '#888', base: k.base || '', mfr: k.mfr || '' }; var c = S.contracts[d.key] = S.contracts[d.key] || { base: 60, through: J.seasonNum(S) }; c.team = id; if (k.number) c.car = k.number; n++; });
  J.save(); J.toast('Matched ' + n + ' of ' + J.roster(S).length + ' drivers to the real roster.');
};
J.acts.regenFans = function (el) {
  var S = J.S, reroll = !!el.dataset.reroll;
  if (!S.fans.length) { J.ai.ensureFans(S); }
  if (!confirm('Give all ' + S.fans.length + ' fan accounts new names, handles and profiles' + (reroll ? ', ages and favorite drivers' : '') + '? This also changes them on the website.')) return;
  var n = J.ai.regenFans(S, reroll); J.save(); J.toast(n + ' fan accounts regenerated.');
};
J.acts.regenFigs = function () { var S = J.S; if (!confirm('Give the 10 media personalities new names and handles?')) return; J.ai.regenFigures(S); J.save(); J.toast('New media personalities. Their roles stay the same.'); };
J.acts.figsReset = function () { var S = J.S; delete S.figureOverrides; J.useFigures(S); J.save(); J.toast('Original media personalities are back.'); };
function sillyAdmin(S) {
  var all = (S.silly || []).slice().reverse(); if (!all.length) return '';
  return '<h3 style="font-size:19px;margin-top:14px">Silly season storylines</h3>' + all.map(function (x) { return '<div class="mrow"><div><b>' + esc(x.title) + '</b><small>' + esc(J.SILLY_LABEL[x.stage]) + ', ' + J.plural(x.history.length, 'story') + ', started at race ' + x.openedAt + '</small></div><div class="inl"><select data-sl="' + esc(x.id) + '" aria-label="Stage">' + J.SILLY_STAGES.map(function (k) { return '<option value="' + k + '"' + (x.stage === k ? ' selected' : '') + '>' + J.SILLY_LABEL[k] + '</option>'; }).join('') + '</select><button class="btn danger sm" data-act="slDel" data-id="' + esc(x.id) + '">Remove</button></div></div>'; }).join('');
}
document.addEventListener('change', function (e) { var t = e.target; if (!t.dataset || !t.dataset.sl) return; var x = (J.S.silly || []).find(function (q) { return q.id === t.dataset.sl; }); if (x) { x.stage = t.value; J.save({ render: false }); J.toast('Storyline set to ' + J.SILLY_LABEL[x.stage].toLowerCase() + '.'); } });
J.acts.slDel = function (el) { var S = J.S; S.silly = (S.silly || []).filter(function (x) { return x.id !== el.dataset.id; }); J.save(); };
J.acts.fansFill = function () { var n = J.S.fans.length; J.ai.ensureFans(J.S); J.save(); J.toast((J.S.fans.length - n) + ' fans added.'); };
J.acts.fansReset = function () { if (!confirm('Replace every fan account? Their posts are deleted too.')) return; var S = J.S; S.fans = []; S.posts = []; J.ai.ensureFans(S); J.save(); J.toast(S.fans.length + ' new fan accounts.'); };
J.acts.repNudge = function () { var S = J.S, why = $('repWhy').value.trim() || 'Commissioner adjustment'; if (J.repApply(S, $('repDrv').value, Number($('repDelta').value), why, 'track', '')) { J.driftFans(S); J.save(); J.toast('Reputation updated.'); } };
J.acts.thDel = function (el) { var S = J.S; S.posts = S.posts.filter(function (p) { return p.thread !== el.dataset.id; }); J.save(); };
J.acts.postsClear = function () { if (!confirm('Delete every post in the Garage?')) return; J.S.posts = []; J.save(); };
J.acts.ivDel = function (el) { var S = J.S; S.interviews = S.interviews.filter(function (x) { return x.id !== el.dataset.id; }); J.save(); };

/* ---------- Settings ---------- */
var MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5 (recommended)'], ['claude-haiku-5-5', 'Haiku 5.5 (cheaper)'], ['claude-opus-5-5', 'Opus 5.5 (priciest)']];
function modelSel(id, cur) { var known = MODELS.some(function (m) { return m[0] === cur; }); return '<select id="' + id + '">' + MODELS.map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === cur ? ' selected' : '') + '>' + esc(m[1]) + '</option>'; }).join('') + (known ? '' : '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>') + '</select>'; }
J.routes.settings = function () {
  var s = J.settings, P = J.publisher, url = P ? P.publicUrl() : '', prov = J.ai.provider();
  return J.phead('Settings', 'AI writing, the public website and how the app behaves')
    + '<section class="panel"><h3>Appearance</h3><p class="sub">For this app on this computer. Visitors pick their own on the website\'s Settings tab.</p><div class="seg big" role="radiogroup" aria-label="Theme">' + [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Match my computer']].map(function (x) { return '<button data-act="setTheme" data-v="' + x[0] + '" class="' + (J.themePref() === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></section>'
    + '<section class="panel"><h3>AI writing</h3><p class="sub">Writes the news, the fan chatter in The Garage and the outlook commentary.</p>'
    + '<div class="seg big" role="radiogroup" aria-label="AI service"><button data-act="setProv" data-v="gemini" class="' + (prov === 'gemini' ? 'on' : '') + '">Gemini (free)</button><button data-act="setProv" data-v="claude" class="' + (prov === 'claude' ? 'on' : '') + '">Claude (paid)</button></div>'
    + (prov === 'gemini'
      ? '<p class="sub" style="margin-top:12px">Free from Google, no credit card. Get a key: go to <b>aistudio.google.com</b>, sign in with a Google account, click <b>Get API key</b>, then <b>Create API key</b>, and copy it. Google gives a daily allowance of free requests (a race import uses about 3). Google may use what you send on the free plan to improve its products, so keep personal info out of your story notes.</p>'
        + '<div class="fgrid"><div class="field wide"><label for="sGKey">Gemini API key</label><div class="inl"><input id="sGKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(s.geminiKey) + '" placeholder="AIza..." style="flex:1"><button class="btn ghost sm" data-act="showSecret" data-for="sGKey">Show</button><button class="btn sm" data-act="testKey">Test key</button></div></div>'
        + ((s.geminiList || []).length ? '<div class="field wide" style="max-width:460px"><label for="sGModel">Model</label><select id="sGModel">' + s.geminiList.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === s.geminiModel ? ' selected' : '') + '>' + esc(m.label) + (m.id === s.geminiList[0].id ? ' (recommended)' : '') + '</option>'; }).join('') + '</select></div>' : '') + '</div>'
      : '<p class="sub" style="margin-top:12px">The best writing. You pay Anthropic for what you use: roughly 10 to 15 cents per imported race. Get a key at <b>console.anthropic.com</b> under API Keys (needs credit added under Billing).</p>'
        + '<div class="fgrid"><div class="field wide"><label for="sKey">Claude API key</label><div class="inl"><input id="sKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(s.apiKey) + '" placeholder="sk-ant-..." style="flex:1"><button class="btn ghost sm" data-act="showSecret" data-for="sKey">Show</button><button class="btn sm" data-act="testKey">Test key</button></div></div>'
        + '<div class="field"><label for="sWriter">Model for news stories</label>' + modelSel('sWriter', s.writerModel) + '</div><div class="field"><label for="sChat">Model for fan chatter and outlooks</label>' + modelSel('sChat', s.chatterModel) + '</div></div>')
    + '<label class="check"><input type="checkbox" id="sAuto"' + (s.autoCoverage !== false ? ' checked' : '') + '> After each import, have the AI write the recap and fan reactions automatically</label>'
    + '<label class="check"><input type="checkbox" id="sNews"' + (s.autoNews !== false ? ' checked' : '') + '> Newsroom: the outlets also write their own stories after each import (previews, analysis, silly season rumors)</label>'
    + '<div class="row"><button class="btn sm" data-act="saveAi">Save</button></div><div id="keyMsg" class="msg" hidden></div></section>'
    + '<section class="panel"><h3>Public website</h3><p class="sub">Every change you make here goes up to your free GitHub Pages site on its own. Visitors see it about 1 to 2 minutes later (GitHub takes a moment to update the site).</p>'
    + (url ? '<div class="urlbox"><span>Your site:</span><b id="pubUrl">' + esc(url) + '</b><button class="btn ghost sm" data-act="copyUrl">Copy link</button><button class="btn ghost sm" data-act="openUrl">Open</button></div>' : '')
    + '<div class="fgrid"><div class="field"><label for="gOwner">GitHub username</label><input id="gOwner" value="' + esc(s.ghOwner) + '" placeholder="yourname" spellcheck="false"></div><div class="field"><label for="gRepo">Repository name</label><input id="gRepo" value="' + esc(s.ghRepo) + '" placeholder="jss" spellcheck="false"></div><div class="field"><label for="gBranch">Branch for the website</label><input id="gBranch" value="' + esc(s.ghBranch || 'gh-pages') + '" spellcheck="false"></div>'
    + '<div class="field wide"><label for="gToken">GitHub access token</label><div class="inl"><input id="gToken" type="password" autocomplete="off" spellcheck="false" value="' + esc(s.ghToken) + '" placeholder="github_pat_..." style="flex:1"><button class="btn ghost sm" data-act="showSecret" data-for="gToken">Show</button></div></div></div>'
    + '<label class="check"><input type="checkbox" id="gAuto"' + (s.autoPublish !== false ? ' checked' : '') + '> Publish automatically after every change</label>'
    + '<div class="row"><button class="btn sm" data-act="saveGh">Save and connect</button><button class="btn ghost sm" data-act="pubNow">Publish now</button></div><div id="ghMsg" class="msg" hidden></div>'
    + '<details class="guide"' + (s.ghOwner && s.ghToken ? '' : ' open') + '><summary>First-time setup (about 5 minutes)</summary><ol>'
    + '<li>Make a free account at <b>github.com</b>.</li>'
    + '<li>Click <b>+</b> (top right) then <b>New repository</b>. Name it something like <b>jss</b>, choose <b>Public</b>, and create it. If you already put the app\'s files in a repository for the installer, use that same one.</li>'
    + '<li>Click your profile picture, then <b>Settings</b>, <b>Developer settings</b>, <b>Personal access tokens</b>, <b>Fine-grained tokens</b>, <b>Generate new token</b>.</li>'
    + '<li>Give it a name, set the expiration to the longest it allows, and under <b>Repository access</b> pick <b>Only select repositories</b> and choose your jss repository.</li>'
    + '<li>Under <b>Permissions</b>, set <b>Contents</b> to <b>Read and write</b>. Nothing else is needed. Click <b>Generate token</b> and copy it.</li>'
    + '<li>Paste your username, the repository name and the token above, then click <b>Save and connect</b>. The app builds the site.</li>'
    + '<li>Only the first time: on GitHub open the repository, click <b>Settings</b>, then <b>Pages</b>. Under <b>Branch</b> pick <b>gh-pages</b> and <b>/ (root)</b>, then <b>Save</b>. A minute or two later your site is live.</li></ol>'
    + '<p class="fine">The token only works on that one repository. It is stored on this computer, encrypted, and never put on the website or in backups.</p></details></section>';
};
J.nav.push({ id: 'settings', label: 'Settings', group: 'Commissioner', admin: true });
J.acts.showSecret = function (el) { var i = $(el.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'password' ? 'Show' : 'Hide'; };
function boxMsg(id, t, err) { var m = $(id); if (!m) return; m.hidden = false; m.className = 'msg' + (err ? ' err' : ''); m.textContent = t; }
function readAi() {
  var s = J.settings, g = function (id) { return $(id); };
  if (g('sKey')) s.apiKey = g('sKey').value.trim();
  if (g('sWriter')) { s.writerModel = g('sWriter').value; s.chatterModel = g('sChat').value; }
  if (g('sGKey')) { var k = g('sGKey').value.trim(); if (k !== s.geminiKey) { s.geminiKey = k; s.geminiModel = ''; s.geminiList = []; } }
  if (g('sGModel')) s.geminiModel = g('sGModel').value;
  if (g('sAuto')) s.autoCoverage = g('sAuto').checked;
  if (g('sNews')) s.autoNews = g('sNews').checked;
}
J.acts.setTheme = function (el) { J.setTheme(el.dataset.v); J.refresh(); };
J.acts.setProv = async function (el) { readAi(); J.settings.aiProvider = el.dataset.v; await J.saveSettings(); J.refresh(); };
J.acts.saveAi = async function () { readAi(); await J.saveSettings(); boxMsg('keyMsg', 'Saved.'); };
J.acts.testKey = async function () {
  readAi(); await J.saveSettings(); if (!J.ai.hasKey()) { boxMsg('keyMsg', 'Paste your key first.', true); return; }
  boxMsg('keyMsg', 'Checking...');
  try {
    var ok = await J.ai.test(), nm = J.ai.name(), hadList = !!$('sGModel');
    if (J.ai.provider() === 'gemini' && !hadList) J.refresh();
    boxMsg('keyMsg', ok ? 'The key works. ' + nm + ' is ready.' + (J.ai.provider() === 'gemini' ? ' Answered by ' + (J.ai.lastModel || J.settings.geminiModel) + '.' : '') : nm + ' answered, but oddly. It should still work.', !ok);
  }
  catch (e) { boxMsg('keyMsg', 'That did not work: ' + e.message, true); }
};
J.acts.saveGh = async function () {
  var s = J.settings; s.ghOwner = $('gOwner').value.trim().replace(/^@/, ''); s.ghRepo = $('gRepo').value.trim().replace(/\.git$/, '').split('/').pop(); s.ghBranch = $('gBranch').value.trim() || 'gh-pages'; s.ghToken = $('gToken').value.trim(); s.autoPublish = $('gAuto').checked;
  await J.saveSettings();
  if (!s.ghOwner || !s.ghRepo || !s.ghToken) { boxMsg('ghMsg', 'Saved. Fill in all three (username, repository, token) to connect.', true); J.publisher.refreshState(); return; }
  boxMsg('ghMsg', 'Connecting to GitHub and publishing your site...');
  try { var r = await J.publisher.connect(); J.refresh(); boxMsg('ghMsg', r); }
  catch (e) { boxMsg('ghMsg', e.message, true); }
};
J.acts.pubNow = async function () { try { var r = await J.publisher.run(true); boxMsg('ghMsg', r || 'Published.'); } catch (e) { boxMsg('ghMsg', e.message, true); } };
J.acts.copyUrl = function () { var u = J.publisher.publicUrl(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { J.toast('Link copied.'); }, function () { prompt('Copy this link:', u); }); };
J.acts.openUrl = function () { J.openExternal(J.publisher.publicUrl()); };

J.nav.push({ id: 'preview', label: 'Preview public site', group: 'Commissioner', admin: true });

/* external links open in the normal web browser */
document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[target="_blank"]'); if (a && window.jssNative) { e.preventDefault(); J.openExternal(a.href); } }, true);
})();
