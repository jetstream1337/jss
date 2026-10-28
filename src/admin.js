/* Jet's Sim Series - commissioner pages and app startup (never published) */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
J.seriesList = Object.keys(J.SERIES).map(function (k) { return { id: k, label: J.SERIES[k].label }; });

/* ---------- saving ---------- */
var saveT = null;
J.save = function (o) {
  o = o || {}; var S = J.S; if (!S) return;
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
    await J.store.loadBlobs(J.S);
  } catch (e) { console.error(e); J.toast('Could not load your league: ' + e.message, true); J.S = J.S || J.newLeague('cup'); J.leagues = J.leagues || { cup: J.S }; }
  if (!location.hash) location.hash = J.S.races.length ? '#/home' : '#/import';
  J.render();
  if (J.publisher) J.publisher.init();
  setInterval(function () { if (J.renderFoot) J.renderFoot(); }, 30000);
};

/* ---------- series / leagues ---------- */
J.acts.switchSeries = async function (el) {
  var id = el.value, S = J.S; if (S && id === S.id) return;
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
J.syncStatusHtml = function () {
  var P = J.publisher, s = P ? P.state : { kind: 'off' }, S = J.S;
  var label = { off: 'Website not set up', ok: 'Website up to date', busy: 'Publishing...', pending: 'Changes waiting to publish', err: 'Publishing problem' }[s.kind] || '';
  var sub = s.kind === 'off' ? '<a href="#/settings" style="color:var(--yellow)">Set it up in Settings</a>' : s.kind === 'err' ? esc(s.msg || '') : s.kind === 'ok' && s.at ? 'Last publish ' + esc(J.agoText(s.at)) : '';
  return '<div class="sync ' + s.kind + '"><b><i></i>' + label + '</b><small>' + sub + '</small>' + (S ? '<small>Saved ' + esc(J.agoText(S.updatedAt)) + '</small>' : '') + '</div>';
};

/* ---------- Races ---------- */
var MODES = { nascar: 'NASCAR style', file: 'Points in the file', simple: 'One per car beaten', custom: 'My own list' };
J.routes.races = function (S) {
  var list = S.races.slice().reverse();
  return J.phead('Races', S.races.length ? 'Rename, re-date, re-score or remove imported races.' : 'No races imported yet.', '<a class="btn sm" href="#/import">Import a race</a>')
    + (list.length ? '<section class="panel">' + list.map(function (r) {
      var info = J.raceInfo(r), arts = S.articles.filter(function (a) { return a.raceId === r.id; }).length;
      return '<div class="mrow"><div class="inl" style="flex:1"><input data-race="name" data-id="' + esc(r.id) + '" value="' + esc(r.name) + '" aria-label="Race name" style="min-width:200px;flex:1"><input type="date" data-race="date" data-id="' + esc(r.id) + '" value="' + esc(r.date || '') + '" aria-label="Date">'
        + '<select data-race="mode" data-id="' + esc(r.id) + '" aria-label="Points">' + Object.keys(MODES).map(function (k) { return '<option value="' + k + '"' + ((r.mode || 'nascar') === k ? ' selected' : '') + '>' + MODES[k] + '</option>'; }).join('') + '</select>'
        + (r.mode === 'custom' ? '<input data-race="custom" data-id="' + esc(r.id) + '" value="' + esc(r.custom || '') + '" placeholder="43,38,36..." aria-label="Custom points">' : '') + '</div>'
        + '<div class="inl"><small>Won by ' + esc(info.winner.driver) + ', ' + r.rows.length + ' cars, ' + J.plural(arts, 'story') + '</small><a class="btn ghost sm" href="#/results/' + esc(r.id) + '">View</a>' + (J.ai.hasKey() ? '<button class="btn ghost sm" data-act="raceCover" data-id="' + esc(r.id) + '">Write coverage</button>' : '') + '<button class="btn danger sm" data-act="raceDel" data-id="' + esc(r.id) + '">Remove</button></div></div>';
    }).join('') + '</section>' : J.empty('Nothing here yet', 'Import your first race and it shows up here.', '<a class="btn sm" href="#/import">Import a race</a>'));
};
J.nav.push({ id: 'races', label: 'Races', group: 'Commissioner', admin: true });
document.addEventListener('change', function (e) {
  var t = e.target, f = t.dataset && t.dataset.race; if (!f) return;
  var S = J.S, r = S.races.find(function (x) { return x.id === t.dataset.id; }); if (!r) return;
  if (f === 'name') r.name = t.value.trim() || r.name;
  else if (f === 'date') { r.date = t.value; S.races.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }); }
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
  var done = {}; S.races.forEach(function (r) { done[r.sid] = 1; });
  return J.phead('Edit Schedule', S.schedule.length + ' races. Track type drives the Race Outlook, so set it right.', '<button class="btn ghost sm" data-act="schStarter">Load starter schedule</button>')
    + '<section class="panel"><div class="schr hdr" style="background:none;border:0;padding:0 10px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em"><span>Race name</span><span>Track</span><span>Type</span><span>Date</span><span>Note</span><span></span></div>'
    + S.schedule.map(function (r, i) {
      return '<div class="schr' + (i + 1 === S.chase.regularRaces ? ' cut' : '') + '"><input data-sch="name" data-id="' + esc(r.id) + '" value="' + esc(r.name) + '" aria-label="Race ' + (i + 1) + ' name"><input data-sch="track" data-id="' + esc(r.id) + '" value="' + esc(r.track || '') + '" aria-label="Track">' + typeSel(r) + '<input type="date" data-sch="date" data-id="' + esc(r.id) + '" value="' + esc(r.date || '') + '" aria-label="Date"><input data-sch="note" data-id="' + esc(r.id) + '" value="' + esc(r.note || '') + '" placeholder="' + (done[r.id] ? 'Run' : 'Note') + '" aria-label="Note">'
        + '<div class="inl" style="flex-wrap:nowrap"><button class="btn ghost sm" data-act="schMove" data-d="-1" data-id="' + esc(r.id) + '" aria-label="Move up"' + (i ? '' : ' disabled') + '>&#9650;</button><button class="btn ghost sm" data-act="schMove" data-d="1" data-id="' + esc(r.id) + '" aria-label="Move down"' + (i < S.schedule.length - 1 ? '' : ' disabled') + '>&#9660;</button><button class="btn danger sm" data-act="schDel" data-id="' + esc(r.id) + '" aria-label="Delete"' + (done[r.id] ? ' disabled title="Has a result"' : '') + '>&#10005;</button></div></div>'
        + (i + 1 === S.chase.regularRaces ? '<div class="cutrow" style="margin:-2px 0 8px">' + esc(S.chase.name) + ' field is set after race ' + (i + 1) + '</div>' : '');
    }).join('')
    + '<div class="row"><button class="btn sm" data-act="schAdd">Add a race</button></div></section>';
};
J.nav.push({ id: 'editschedule', label: 'Edit Schedule', group: 'Commissioner', admin: true });
document.addEventListener('change', function (e) {
  var t = e.target, f = t.dataset && t.dataset.sch; if (!f) return;
  var S = J.S, r = S.schedule.find(function (x) { return x.id === t.dataset.id; }); if (!r) return;
  r[f] = t.value.trim();
  if (f === 'track' && t.value.trim()) { var g = J.guessType(t.value); if (g !== r.type) { r.type = g; J.save(); J.toast('Track type set to ' + J.TYPES[g] + '. Change it if that is wrong.'); return; } }
  J.save({ render: false });
});
J.acts.schAdd = function () { var S = J.S; S.schedule.push({ id: J.uid('s'), name: 'New race', track: '', type: 'inter', date: '', note: '' }); J.save(); setTimeout(function () { var x = document.querySelectorAll('[data-sch="name"]'); if (x.length) { x[x.length - 1].focus(); x[x.length - 1].select(); } }, 30); };
J.acts.schDel = function (el) { var S = J.S; S.schedule = S.schedule.filter(function (x) { return x.id !== el.dataset.id; }); J.save(); };
J.acts.schMove = function (el) { var l = J.S.schedule, i = l.findIndex(function (x) { return x.id === el.dataset.id; }), j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= l.length) return; var t = l[i]; l[i] = l[j]; l[j] = t; J.save(); };
J.acts.schStarter = function () {
  var S = J.S; if (S.races.length) { J.toast('You already have results tied to this schedule. Edit it race by race instead.', true); return; }
  if (!confirm('Replace the schedule with the ' + S.series.label + ' starter schedule?')) return;
  S.schedule = J.starterSchedule(S.id); J.save(); J.toast('Starter schedule loaded.');
};

/* ---------- League ---------- */
J.routes.league = function (S) {
  var c = S.chase;
  var leagues = J.seriesList.map(function (s) { var L = J.leagues[s.id]; return '<div class="mrow"><div><b>' + esc(s.label) + '</b><small>' + (L ? esc(L.league.name) + ', ' + J.plural(L.races.length, 'race') + ' run' + (L.id === S.id ? ' (open now)' : '') : 'Not started') + '</small></div><div class="inl">' + (L ? (L.id !== S.id ? '<button class="btn ghost sm" data-act="leagueOpen" data-id="' + s.id + '">Open</button>' : '') + '<button class="btn danger sm" data-act="leagueDel" data-id="' + s.id + '">Delete</button>' : '<button class="btn sm" data-act="leagueOpen" data-id="' + s.id + '">Start this league</button>') + '</div></div>'; }).join('');
  return J.phead('League', S.series.label + ' settings, announcements and backups')
    + '<section class="panel"><h3>Basics</h3><div class="fgrid">'
    + '<div class="field"><label for="lgName">League name</label><input id="lgName" value="' + esc(S.league.name) + '"></div>'
    + '<div class="field"><label for="chName">Playoff name</label><input id="chName" value="' + esc(c.name) + '"></div>'
    + '<div class="field"><label for="chSize">Drivers who make it</label><input id="chSize" type="number" min="2" max="40" value="' + c.size + '"></div>'
    + '<div class="field"><label for="chCut">Field set after race</label><input id="chCut" type="number" min="1" max="60" value="' + c.regularRaces + '"></div></div>'
    + '<label class="check"><input type="checkbox" id="chWins"' + (c.winLocks ? ' checked' : '') + '> A win locks a driver in (win and you are in)</label>'
    + '<div class="row"><button class="btn sm" data-act="lgSave">Save</button></div></section>'
    + '<section class="panel"><h3>Commissioner note</h3><p class="sub">Shows at the top of the home page.</p><textarea id="annText" placeholder="Example: Martinsville moved to Saturday night.">' + esc(S.announcement.text) + '</textarea><div class="row"><button class="btn sm" data-act="annPost">Post note</button>' + (S.announcement.text ? '<button class="btn ghost sm" data-act="annClear">Remove note</button>' : '') + '</div></section>'
    + '<section class="panel"><h3>Series</h3><p class="sub">Each series is its own league. Switch between them with the Series box in the sidebar.</p>' + leagues + '</section>'
    + '<section class="panel"><h3>Backup</h3><p class="sub">Save everything (all series, stories, fans, photos) to one file, or bring a backup back. Your AI key and GitHub token are never put in a backup.</p><div class="row"><button class="btn sm" data-act="bkDown">Download backup</button><button class="btn ghost sm" data-act="bkUp">Restore a backup</button><input type="file" id="bkFile" accept=".json,application/json" hidden></div></section>'
    + '<section class="panel"><h3>Start over</h3><p class="sub">Only for ' + esc(S.series.label) + '. Download a backup first.</p><div class="row"><button class="btn danger sm" data-act="resetResults">Clear results only</button><button class="btn danger sm" data-act="resetSeason">New season (clear everything but the schedule)</button></div></section>';
};
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
J.acts.leagueOpen = function (el) { J.acts.switchSeries({ value: el.dataset.id }); };
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
    var race = S.races.find(function (r) { return r.id === a.raceId; }) || S.races[S.races.length - 1];
    var facts = (race ? J.ai.raceFacts(S, race) + '\n' : '') + 'THE ARTICLE (' + J.OUTLETS[a.outlet].name + '):\n' + a.headline + '\n' + (a.dek || '') + '\n' + a.body.slice(0, 3500);
    var n = await J.ai.threads(S, { facts: facts, story: a, focus: a.tags || [], ref: { type: 'article', id: a.id }, task: 'Write 4 to 6 threads reacting to THIS article. People quote it, argue with it, call it fake news, add context, or bring up something it left out. Keep every fact consistent with the article and the race data.' });
    J.driftFans(S); J.save({ render: J.route().name === 'news' || J.route().name === 'garage' });
    J.toast(n + ' fan posts added.');
  } catch (e) { J.toast('Fan reactions failed: ' + e.message, true); }
  delete reacting[id];
};
J.acts.reactArticle = function (el) { J.reactToArticle(el.dataset.id); };

/* ---------- Garage tools ---------- */
var gBusy = '';
async function garageRun(kind) {
  var S = J.S; if (gBusy) return; if (!J.ai.hasKey()) { J.toast('Add your ' + J.ai.name() + ' key in Settings first.', true); return; }
  if (!S.races.length) { J.toast('Import a race first.', true); return; }
  gBusy = kind; J.refresh();
  try {
    if (kind === 'refresh' || kind === 'talk') {
      var race = S.races[S.races.length - 1], nx = J.nextRound(S);
      var facts = J.ai.raceFacts(S, race) + (nx ? '\nNext race: ' + nx.name + ' at ' + (nx.track || 'TBD') + ' (' + J.TYPES[nx.type].toLowerCase() + ').' : '');
      await J.ai.threads(S, { facts: facts, focus: [], ref: { type: 'week', id: race.id }, task: 'It is the middle of the week between races. Write 5 to 7 threads of the usual chatter: hot takes about the standings, predictions for the next race, someone still mad about last week, a fantasy lineup argument, a rumor, one person asking a dumb question and getting roasted. Not everything is about the last race.' });
    }
    if (kind === 'refresh' || kind === 'outlooks') await J.ai.outlooks(S);
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
  var drivers = J.agg(S.races);
  return J.phead('Garage Tools', 'Keep the fan chat and outlooks fresh')
    + (!hasKey ? '<div class="warn" style="margin:0 0 18px">These need an AI key (Gemini is free). Add it in <a href="#/settings"><b>Settings</b></a>.</div>' : '')
    + '<section class="panel"><h3>Refresh</h3><p class="sub">Race imports do this for you. Use these between races or when the Garage feels stale.</p><div class="row" style="margin-top:0">' + b('refresh', 'Refresh the Garage') + b('talk', 'New fan chatter only') + b('outlooks', 'New outlook commentary only') + '</div></section>'
    + '<section class="panel"><h3>Fan accounts</h3><p class="sub">' + J.plural(S.fans.length, 'account') + ': ' + ages.teen + ' teens, ' + ages.young + ' young adults, ' + ages.adult + ' adults, ' + ages.oldhead + ' old-heads. ' + st.good + ' back a driver, ' + st.bad + ' are haters, ' + st.none + ' are neutral.</p>'
    + '<div class="row" style="margin-top:0"><button class="btn ghost sm" data-act="fansFill"' + (drivers.length ? '' : ' disabled') + '>Add more fans</button><button class="btn danger sm" data-act="fansReset"' + (S.fans.length ? '' : ' disabled') + '>Replace all fans</button></div></section>'
    + '<section class="panel"><h3>Nudge a reputation</h3><p class="sub">Something happened that the app did not see? Move a driver\'s reputation yourself. Fans react to big swings over time.</p>'
    + '<div class="inl"><select id="repDrv" aria-label="Driver">' + drivers.map(function (d) { return '<option value="' + esc(d.name) + '">' + esc(d.name) + ' (' + J.repOf(S, d.key).score + ')</option>'; }).join('') + '</select><select id="repDelta" aria-label="Change"><option value="6">+6 big gain</option><option value="3">+3</option><option value="1">+1</option><option value="-1">-1</option><option value="-3">-3</option><option value="-6">-6 big drop</option></select><input id="repWhy" placeholder="Why (fans will see this)" style="flex:1;min-width:220px"><button class="btn sm" data-act="repNudge"' + (drivers.length ? '' : ' disabled') + '>Apply</button></div></section>'
    + '<section class="panel"><h3>Posts</h3><p class="sub">' + J.plural(ths.length, 'thread') + ' in the Garage. Delete anything you do not like.</p>'
    + (ths.length ? ths.slice(0, 40).map(function (t) { var au = J.postAuthor(S, t.root); return '<div class="mrow"><div style="flex:1;min-width:0"><b>' + esc(t.root.title || (au ? au.name : '')) + '</b><small>' + esc(t.root.text.slice(0, 140)) + (t.root.text.length > 140 ? '...' : '') + '</small><small>' + J.plural(t.posts.length, 'post') + ', ' + esc(t.platform === 'forum' ? 'forum' : 'feed') + ', ' + esc(J.agoText(t.root.ts)) + '</small></div><button class="btn danger sm" data-act="thDel" data-id="' + esc(t.id) + '">Delete</button></div>'; }).join('') + '<div class="row"><button class="btn danger sm" data-act="postsClear">Delete all posts</button></div>' : '<p class="dim">No posts yet.</p>') + '</section>'
    + '<section class="panel"><h3>Pit road quotes</h3>' + (S.interviews.length ? S.interviews.map(function (x) { return '<div class="mrow"><div style="flex:1"><b>' + esc(x.driver) + '</b><small>' + esc(x.quote) + '</small></div><button class="btn danger sm" data-act="ivDel" data-id="' + esc(x.id) + '">Delete</button></div>'; }).join('') : '<p class="dim">No quotes yet.</p>') + '</section>';
};
J.nav.push({ id: 'garagetools', label: 'Garage Tools', group: 'Commissioner', admin: true });
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
    + '<section class="panel"><h3>AI writing</h3><p class="sub">Writes the news, the fan chatter in The Garage and the outlook commentary.</p>'
    + '<div class="seg big" role="radiogroup" aria-label="AI service"><button data-act="setProv" data-v="gemini" class="' + (prov === 'gemini' ? 'on' : '') + '">Gemini (free)</button><button data-act="setProv" data-v="claude" class="' + (prov === 'claude' ? 'on' : '') + '">Claude (paid)</button></div>'
    + (prov === 'gemini'
      ? '<p class="sub" style="margin-top:12px">Free from Google, no credit card. Get a key: go to <b>aistudio.google.com</b>, sign in with a Google account, click <b>Get API key</b>, then <b>Create API key</b>, and copy it. Google gives a daily allowance of free requests (a race import uses about 3). Google may use what you send on the free plan to improve its products, so keep personal info out of your story notes.</p>'
        + '<div class="fgrid"><div class="field wide"><label for="sGKey">Gemini API key</label><div class="inl"><input id="sGKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(s.geminiKey) + '" placeholder="AIza..." style="flex:1"><button class="btn ghost sm" data-act="showSecret" data-for="sGKey">Show</button><button class="btn sm" data-act="testKey">Test key</button></div></div>'
        + ((s.geminiList || []).length ? '<div class="field wide" style="max-width:460px"><label for="sGModel">Model</label><select id="sGModel">' + s.geminiList.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === s.geminiModel ? ' selected' : '') + '>' + esc(m.label) + (m.id === s.geminiList[0].id ? ' (recommended)' : '') + '</option>'; }).join('') + '</select></div>' : '') + '</div>'
      : '<p class="sub" style="margin-top:12px">The best writing. You pay Anthropic for what you use: roughly 10 to 15 cents per imported race. Get a key at <b>console.anthropic.com</b> under API Keys (needs credit added under Billing).</p>'
        + '<div class="fgrid"><div class="field wide"><label for="sKey">Claude API key</label><div class="inl"><input id="sKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(s.apiKey) + '" placeholder="sk-ant-..." style="flex:1"><button class="btn ghost sm" data-act="showSecret" data-for="sKey">Show</button><button class="btn sm" data-act="testKey">Test key</button></div></div>'
        + '<div class="field"><label for="sWriter">Model for news stories</label>' + modelSel('sWriter', s.writerModel) + '</div><div class="field"><label for="sChat">Model for fan chatter and outlooks</label>' + modelSel('sChat', s.chatterModel) + '</div></div>')
    + '<label class="check"><input type="checkbox" id="sAuto"' + (s.autoCoverage !== false ? ' checked' : '') + '> After each race import, have the AI write the recap and fan reactions automatically</label>'
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
}
J.acts.setProv = async function (el) { readAi(); J.settings.aiProvider = el.dataset.v; await J.saveSettings(); J.refresh(); };
J.acts.saveAi = async function () { readAi(); await J.saveSettings(); boxMsg('keyMsg', 'Saved.'); };
J.acts.testKey = async function () {
  readAi(); await J.saveSettings(); if (!J.ai.hasKey()) { boxMsg('keyMsg', 'Paste your key first.', true); return; }
  boxMsg('keyMsg', 'Checking...');
  try {
    var ok = await J.ai.test(), nm = J.ai.name(), hadList = !!$('sGModel');
    if (J.ai.provider() === 'gemini' && !hadList) J.refresh();
    boxMsg('keyMsg', ok ? 'The key works. ' + nm + ' is ready.' + (J.ai.provider() === 'gemini' ? ' Using ' + J.settings.geminiModel + '.' : '') : nm + ' answered, but oddly. It should still work.', !ok);
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
