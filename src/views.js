/* Jet's Sim Series - pages (shared by the desktop app and the public site) */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
J.S = null; J.leagues = null; J.seriesList = []; J.blobs = {}; J.afters = {};
J.ui = { repAll: false, repWorst: false, feedFilter: 'all', newsFilter: 'all' };

var NAMES = {};
function refreshNames(S) { NAMES = {}; J.roster(S).forEach(function (d) { NAMES[d.key] = d.name; }); }
function pct(x) { if (x <= 0) return '0%'; if (x < 0.01) return '<1%'; if (x > 0.99) return '>99%'; return Math.round(x * 100) + '%'; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function empty(t, s, extra) { return '<div class="empty"><b>' + esc(t) + '</b><span>' + esc(s || '') + '</span>' + (extra || '') + '</div>'; }
function phead(title, sub, actions) { return '<header class="phead"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</header><div class="stripe"><i></i><i></i><i></i></div>'; }
J.phead = phead; J.empty = empty; J.pct = pct; J.plural = plural;
function mediaOf(S, id) { return S.media.find(function (m) { return m.id === id; }); }
function mediaSrc(m) { return J.blobs[m.id] || m.url || ''; }
function posterSrc(m) { return J.blobs[m.id + ':poster'] || m.poster || ''; }
function mediaTag(m, cls) {
  if (m.type === 'video') {
    var src = mediaSrc(m);
    if (src) return '<video class="' + (cls || '') + '" controls preload="metadata" ' + (posterSrc(m) ? 'poster="' + esc(posterSrc(m)) + '"' : '') + ' src="' + esc(src) + '"></video>';
    return posterSrc(m) ? '<img class="' + (cls || '') + '" src="' + esc(posterSrc(m)) + '" alt="' + esc(m.caption || m.name || '') + '" loading="lazy">' : '<div class="nomedia">Video</div>';
  }
  var s = mediaSrc(m); return s ? '<img class="' + (cls || '') + '" src="' + esc(s) + '" alt="' + esc(m.caption || m.name || '') + '" loading="lazy">' : '<div class="nomedia">Photo</div>';
}
function thumbOf(S, a) { var id = (a.media || [])[0], m = id && mediaOf(S, id); if (!m) return ''; var src = m.type === 'video' ? posterSrc(m) : mediaSrc(m); return src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : ''; }
function outletTag(a) { var o = J.OUTLETS[a.outlet] || J.OUTLETS.wire; return '<span class="otag" style="--oc:' + o.color + '">' + esc(o.name) + '</span>'; }
function carPlate(c) { return '<span class="car">' + esc(c || '-') + '</span>'; }

function sessionTable(x, limit) {
  var rows = x.rows.slice().sort(function (a, b) { return a.position - b.position; }), lead = J.timeSecs(rows[0] && rows[0].time);
  return '<div class="tw"><table class="data"><thead><tr><th>Pos</th><th>Car</th><th>Driver</th><th>Time</th><th>Gap</th></tr></thead><tbody>' + rows.slice(0, limit || 99).map(function (r) {
    var t = J.timeSecs(r.time), gap = (t != null && lead != null && r.position > 1) ? '+' + (t - lead).toFixed(3) : '';
    return '<tr data-driver="' + esc(J.driverKey(r.driver)) + '"><td class="rank">' + r.position + '</td><td>' + carPlate(r.car) + '</td><td><b>' + esc(r.driver) + '</b></td><td>' + esc(r.time || '-') + '</td><td class="dim">' + gap + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}
function sessionBlocks(S, sid, openFirst) {
  return J.sessionsFor(S, sid).slice().reverse().map(function (x, i) { return '<details class="card sess"' + (openFirst && i === 0 ? ' open' : '') + '><summary>' + esc(J.SESSIONS[x.type]) + '<small>' + J.plural(x.rows.length, 'car') + (x.type === 'qualifying' && x.rows[0] ? ', pole ' + esc(x.rows[0].driver) : '') + (x.meta && x.meta.weather ? ', ' + esc(x.meta.weather) : '') + '</small></summary>' + sessionTable(x) + '</details>'; }).join('');
}
J.sessionBlocks = sessionBlocks;

/* ---------- rail (sidebar) ---------- */
function renderRail() {
  var S = J.S, r = J.route(), items = J.nav.filter(function (n) { return !n.admin || !J.isPublicView(); });
  var html = '', lastGroup = '';
  items.forEach(function (n) {
    if (n.group && n.group !== lastGroup) { html += '<div class="navgroup">' + esc(n.group) + '</div>'; lastGroup = n.group; }
    html += '<a href="#/' + n.id + '" class="' + (r.name === n.id ? 'on' : '') + '">' + esc(n.label) + '</a>';
  });
  $('navlist').innerHTML = html;
  $('brandName').textContent = S ? S.league.name : "Jet's Sim Series";
  $('brandSub').textContent = S ? S.series.label.toUpperCase() : '';
  var opts = J.seriesList;
  var showSel = !J.isPublicView() || (J.MODE === 'public' ? opts.length > 1 : Object.keys(J.leagues || {}).length > 1);
  $('seriesBox').innerHTML = showSel
    ? '<label for="seriesSel">Series</label><select id="seriesSel">' + opts.map(function (o) { return '<option value="' + esc(o.id) + '"' + (S && o.id === S.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select>' : '';
}
function renderFoot() {
  var S = J.S, el = $('railFoot'); if (!el) return;
  if (J.MODE === 'admin') { el.innerHTML = J.syncStatusHtml ? J.syncStatusHtml() : ''; return; }
  el.innerHTML = S ? '<span class="live"><i></i>Live</span><small>Updated ' + esc(J.agoText(S.updatedAt)) + '</small>' : '';
}
J.renderFoot = renderFoot;

/* ---------- router ---------- */
J.route = function () { var h = location.hash.replace(/^#\/?/, ''); var p = h.split('/'); return { name: p[0] || 'home', args: p.slice(1) }; };
J.go = function (path) { location.hash = '#/' + path; };
J.render = function (keepScroll) {
  var S = J.S, r = J.route(), fn = J.routes[r.name] || J.routes.home;
  if (!S) { $('view').innerHTML = '<div class="page">' + empty('Nothing published yet', 'Check back after the commissioner posts the first race.') + '</div>'; renderRail(); return; }
  refreshNames(S);
  var y = window.scrollY;
  $('view').innerHTML = '<div class="page p-' + esc(r.name) + '">' + fn(S, r.args) + '</div>';
  if (J.afters[r.name]) J.afters[r.name](S, r.args);
  renderRail(); renderFoot();
  window.scrollTo(0, keepScroll ? y : 0);
};
J.refresh = function () { J.render(true); };
window.addEventListener('hashchange', function () { J.render(false); });

/* ---------- Home ---------- */
J.routes.home = function (S) {
  var ds = J.agg(S.races), L = ds[0], last = S.races[S.races.length - 1], nx = J.nextRound(S), total = Math.max(S.schedule.length, S.races.length);
  var arts = S.articles.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 4);
  var withPic = arts.findIndex(function (a) { return thumbOf(S, a); }); if (withPic > 0 && arts[withPic].ts > Date.now() - 864e5 * 3) arts.unshift(arts.splice(withPic, 1)[0]);
  var pyl = ds.slice(0, 10).map(function (d, i) { return '<a class="pyl" href="#/standings"><b>' + (i + 1) + '</b><span>' + esc(J.lastName(d.name).slice(0, 3).toUpperCase()) + '</span><em>' + d.pts + '</em></a>'; }).join('');
  var out = '<section class="hero"><div class="hero-l"><div class="kicker">' + esc(S.series.label) + ' / ' + esc(J.seasonYear(S)) + ' season</div><h1>' + esc(S.league.name) + '</h1>'
    + '<p class="lede">' + (L ? esc(L.name) + ' leads the points with ' + L.pts + '. ' + (last ? esc(J.raceInfo(last).winner.driver) + ' won the latest race at ' + esc(last.track || last.name) + '.' : '') : 'The season has not started. Standings, results, news and the fan feed fill in after the first race.') + '</p>'
    + '<div class="cta"><a class="btn" href="#/standings">Standings</a><a class="btn ghost-l" href="#/news">Latest news</a></div></div>'
    + '<div class="hero-r"><div class="pyl-h">Points</div>' + (pyl || '<div class="pyl-empty">No points yet</div>') + '</div></section>';
  out += '<section class="strip"><div><small>Races run</small><b>' + S.races.length + '/' + total + '</b></div><div><small>Drivers</small><b>' + ds.length + '</b></div><div><small>Leader</small><b>' + (L ? esc(J.lastName(L.name)) : '-') + '</b></div><div><small>Up next</small><b>' + (nx ? esc(nx.name) : 'Season complete') + '</b></div></section>';
  if (S.announcement.text) out += '<aside class="notice"><b>Commissioner note</b><span>' + esc(S.announcement.text) + '</span></aside>';
  out += '<div class="grid2"><section class="card"><div class="card-h"><h3>Top stories</h3><a href="#/news">All news</a></div><div class="card-b">';
  out += arts.length ? arts.map(function (a, i) { return '<a class="story' + (i === 0 ? ' lead' : '') + (thumbOf(S, a) ? ' hasthumb' : '') + '" href="#/news/' + esc(a.id) + '">' + (thumbOf(S, a) ? '<div class="sthumb">' + thumbOf(S, a) + '</div>' : '') + '<div>' + outletTag(a) + '<h4>' + esc(a.headline) + '</h4>' + (i === 0 && a.dek ? '<p>' + esc(a.dek) + '</p>' : '') + '<small>' + esc(J.agoText(a.ts)) + '</small></div></a>'; }).join('') : empty('No stories yet', 'Race coverage shows up here.');
  out += '</div></section><div class="stack">';
  if (last) {
    var info = J.raceInfo(last);
    out += '<section class="card"><div class="card-h"><h3>Last race</h3><a href="#/results/' + esc(last.id) + '">Full results</a></div><div class="card-b"><div class="wl"><span>' + esc(last.name) + '</span><b>' + esc(info.winner.driver) + '</b></div><table class="mini">' + info.rows.slice(0, 5).map(function (r) { return '<tr><td class="rk">' + r.position + '</td><td>' + carPlate(r.car) + '</td><td>' + esc(r.driver) + '</td><td class="num">' + r.points + '</td></tr>'; }).join('') + '</table></div></section>';
  }
  if (nx) {
    var ro = J.raceOutlook(S);
    out += '<section class="card"><div class="card-h"><h3>Up next</h3><a href="#/garage/race">Race outlook</a></div><div class="card-b"><div class="wl"><span>' + esc(J.TYPES[nx.type] || '') + '</span><b>' + esc(nx.name) + '</b></div><p class="sub">' + esc(nx.track || '') + (nx.date ? ', ' + esc(J.fmtDate(nx.date)) : '') + '</p>' + (function () { var q = J.sessionOf(S, nx.id, 'qualifying'); return q && q.rows[0] ? '<p class="sub"><b>Pole: ' + esc(q.rows[0].driver) + '</b>' + (q.rows[0].time ? ' (' + esc(q.rows[0].time) + ')' : '') + '</p>' : ''; })()
      + (ro && ro.favorites ? '<div class="favs">' + ro.favorites.slice(0, 3).map(function (f) { return '<div><span>' + esc(f.name) + '</span><b>' + pct(f.win) + '</b></div>'; }).join('') + '</div><small class="sub">Win odds</small>' : '') + '</div></section>';
  }
  out += '</div></div>';
  return out;
};
J.nav.push({ id: 'home', label: 'Home' });

/* ---------- Standings ---------- */
J.routes.standings = function (S) {
  var ds = J.agg(S.races), n = S.races.length;
  if (!ds.length) return phead('Standings', 'Driver points championship') + empty('No points yet', 'Standings appear after the first race.');
  var prev = {}; if (n > 1) J.agg(S.races.slice(0, -1)).forEach(function (d, i) { prev[d.key] = i; });
  var top = ds[0].pts || 1, size = S.chase.size;
  var pod = ds.slice(0, 3).map(function (d, i) { return '<div class="pod p' + (i + 1) + '" data-driver="' + esc(d.key) + '"><div class="pos">' + (i + 1) + '</div><div><b>' + esc(d.name) + '</b><small>' + (d.car ? '#' + esc(d.car) + ' ' : '') + esc(d.team || '') + '</small><div class="pp">' + d.pts + ' pts</div><small>' + d.wins + ' W, ' + d.t5 + ' top 5</small></div></div>'; }).join('');
  var rows = ds.map(function (d, i) {
    var mv = '<small class="flat">-</small>';
    if (n > 1 && prev[d.key] != null) { var c = prev[d.key] - i; mv = c > 0 ? '<small class="up">&#9650;' + c + '</small>' : c < 0 ? '<small class="down">&#9660;' + (-c) + '</small>' : '<small class="flat">-</small>'; }
    var cut = (i === size) ? '<tr class="cutline"><td colspan="11">' + esc(S.chase.name) + ' cut line after race ' + S.chase.regularRaces + ' (top ' + size + ')</td></tr>' : '';
    return cut + '<tr data-driver="' + esc(d.key) + '"><td class="rank">' + (i + 1) + mv + '</td><td><div class="drv">' + carPlate(d.car) + '<div><b>' + esc(d.name) + '</b><small>' + esc(d.team || '') + '</small></div></div></td><td class="pts"><b>' + d.pts + '</b><span class="bar"><i style="width:' + Math.max(3, Math.round(d.pts / top * 100)) + '%"></i></span></td><td class="dim">' + (i ? '-' + (ds[0].pts - d.pts) : 'Leader') + '</td><td>' + d.starts + '</td><td>' + d.wins + '</td><td>' + d.t5 + '</td><td>' + d.t10 + '</td><td>' + d.poles + '</td><td>' + d.led + '</td><td>' + d.avg.toFixed(1) + '</td></tr>';
  }).join('');
  return phead('Standings', S.series.label + ' driver championship after ' + plural(n, 'race'), '<button class="btn ghost sm" data-act="exportCsv">Export CSV</button>')
    + '<div class="podium">' + pod + '</div><div class="card"><div class="tw"><table class="data"><thead><tr><th>Pos</th><th>Driver</th><th>Points</th><th>Behind</th><th>Starts</th><th>Wins</th><th>Top 5</th><th>Top 10</th><th>Poles</th><th>Led</th><th>Avg</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};
J.nav.push({ id: 'standings', label: 'Standings' });
J.acts.exportCsv = function () {
  var S = J.S, ds = J.agg(S.races); if (!ds.length) { J.toast('No standings to export yet.'); return; }
  var q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
  var lines = [['Position', 'Driver', 'Car', 'Team', 'Points', 'Behind', 'Starts', 'Wins', 'Top 5', 'Top 10', 'Poles', 'Laps Led', 'Avg Finish']].concat(ds.map(function (d, i) { return [i + 1, d.name, d.car, d.team, d.pts, i ? ds[0].pts - d.pts : 0, d.starts, d.wins, d.t5, d.t10, d.poles, d.led, d.avg.toFixed(1)]; }));
  J.download('standings.csv', lines.map(function (r) { return r.map(q).join(','); }).join('\n'));
};

/* ---------- Race results ---------- */
J.routes.results = function (S, args) {
  if (!S.races.length) { var nx0 = J.nextRound(S), ss0 = nx0 ? J.sessionsFor(S, nx0.id) : []; return phead('Race Results', 'Finish order, laps led and points') + empty('No races yet', J.MODE === 'admin' ? 'Import a race and it shows up here.' : 'Results land here after the first race.') + (ss0.length ? '<h3 class="sech">' + esc(nx0.name) + ': practice and qualifying</h3>' + sessionBlocks(S, nx0.id, true) : ''); }
  var race = S.races.find(function (r) { return r.id === args[0]; }) || S.races[S.races.length - 1], info = J.raceInfo(race), w = info.winner, m = race.meta || {};
  var sel = '<select class="sel" id="raceSel" aria-label="Choose a race">' + S.races.slice().reverse().map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === race.id ? ' selected' : '') + '>' + esc(r.name) + (r.date ? ' (' + esc(J.fmtDate(r.date)) + ')' : '') + '</option>'; }).join('') + '</select>';
  var chips = []; if (race.track) chips.push('Track <b>' + esc(race.track) + '</b>'); chips.push('Type <b>' + esc(J.TYPES[J.raceType(S, race)]) + '</b>'); if (race.date) chips.push('<b>' + esc(J.fmtDate(race.date)) + '</b>'); if (m.weather) chips.push('Weather <b>' + esc(m.weather) + '</b>'); if (m.pole) chips.push('Pole <b>' + esc(m.pole) + '</b>'); if (m.cautions != null) chips.push('Cautions <b>' + m.cautions + '</b>'); if (m.leadChanges != null) chips.push('Lead changes <b>' + m.leadChanges + '</b>'); if (info.laps) chips.push('Laps <b>' + info.laps + '</b>');
  var rows = info.rows.map(function (r) {
    var d = '<span class="flat">-</span>'; if (r.start > 0) { var g = r.start - r.position; d = g > 0 ? '<span class="up">&#9650;' + g + '</span>' : g < 0 ? '<span class="down">&#9660;' + (-g) + '</span>' : '<span class="flat">=</span>'; }
    return '<tr data-driver="' + esc(J.driverKey(r.driver)) + '"><td class="rank">' + r.position + '</td><td>' + (r.start || '-') + ' ' + d + '</td><td>' + carPlate(r.car) + '</td><td><b>' + esc(r.driver) + '</b></td><td>' + (r.laps || '-') + '</td><td>' + (r.lapsLed || 0) + '</td><td class="' + (J.isDnf(r) ? 'dnf' : 'dim') + '">' + esc(r.status || '-') + '</td><td class="pts"><b>' + r.points + '</b></td></tr>';
  }).join('');
  var art = S.articles.filter(function (a) { return a.raceId === race.id; }).sort(function (a, b) { return b.ts - a.ts; });
  var gal = S.media.filter(function (x) { return x.raceId === race.id; });
  return phead('Race Results', race.name, sel)
    + '<div class="card"><div class="winner"><div><small>Race winner</small><b>' + esc(w.driver) + '</b><span>' + (w.car ? '#' + esc(w.car) + ', ' : '') + 'started P' + (w.start || '?') + (w.lapsLed ? ', led ' + w.lapsLed + ' laps' : '') + '</span></div>'
    + (art.length ? '<a class="btn sm" href="#/news/' + esc(art[0].id) + '">Read the story</a>' : '') + '</div>'
    + '<div class="chips">' + chips.map(function (c) { return '<span class="chip">' + c + '</span>'; }).join('') + '</div>'
    + '<div class="tw"><table class="data"><thead><tr><th>Fin</th><th>Start</th><th>Car</th><th>Driver</th><th>Laps</th><th>Led</th><th>Status</th><th>Pts</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
    + (J.sessionsFor(S, race.sid).length ? '<h3 class="sech">Practice and qualifying</h3>' + sessionBlocks(S, race.sid, false) : '')
    + (gal.length ? '<h3 class="sech">From the race</h3><div class="gallery">' + gal.map(function (x) { return '<button class="gitem" data-act="lightbox" data-id="' + esc(x.id) + '">' + mediaTag(x) + '</button>'; }).join('') + '</div>' : '');
};
J.nav.push({ id: 'results', label: 'Race Results' });

/* ---------- Schedule ---------- */
J.routes.schedule = function (S) {
  var done = {}; S.races.forEach(function (r) { done[r.sid] = r; }); var nx = J.nextRound(S);
  if (!S.schedule.length) return phead('Schedule', 'Season calendar') + empty('No schedule yet', 'The commissioner has not added races.');
  return phead('Schedule', S.schedule.length + ' races, ' + S.races.length + ' run')
    + '<div class="card">' + S.schedule.map(function (r, i) {
      var rc = done[r.id], isNext = nx && nx.id === r.id;
      var st = rc ? '<a class="chip g" href="#/results/' + esc(rc.id) + '">Won by ' + esc(J.lastName(J.raceInfo(rc).winner.driver)) + '</a>' : isNext ? '<span class="chip y">Next up' + (J.sessionOf(S, r.id, 'qualifying') ? ', qualifying in' : J.sessionsFor(S, r.id).length ? ', practice in' : '') + '</span>' : '<span class="chip">Scheduled</span>';
      var cut = (i + 1 === S.chase.regularRaces) ? '<div class="cutrow">' + esc(S.chase.name) + ' field set after this race</div>' : '';
      return '<div class="srow' + (isNext ? ' next' : '') + '"><div class="rd">' + (i + 1) + '</div><div class="sm"><b>' + esc(r.name) + '</b><small>' + esc(r.track || 'Track TBD') + (r.date ? ', ' + esc(J.fmtDate(r.date)) : '') + (r.note ? ', ' + esc(r.note) : '') + '</small></div><span class="chip b">' + esc(J.TYPES[r.type] || '') + '</span>' + st + '</div>' + cut;
    }).join('') + '</div>';
};
J.nav.push({ id: 'schedule', label: 'Schedule' });

/* ---------- News ---------- */
function bodyHtml(a) {
  return String(a.body || '').split(/\n\s*\n/).map(function (p) { p = p.trim(); if (!p) return ''; if (/^>\s?/.test(p)) return '<blockquote>' + esc(p.replace(/^>\s?/, '')) + '</blockquote>'; if (/^##\s?/.test(p)) return '<h3>' + esc(p.replace(/^##\s?/, '')) + '</h3>'; return '<p>' + esc(p) + '</p>'; }).join('');
}
J.routes.news = function (S, args) {
  var arts = S.articles.slice().sort(function (a, b) { return b.ts - a.ts; });
  if (args[0]) {
    var a = arts.find(function (x) { return x.id === args[0]; });
    if (!a) return phead('News', '') + empty('Story not found', 'It may have been removed.', '<a class="btn sm" href="#/news">Back to news</a>');
    var o = J.OUTLETS[a.outlet] || J.OUTLETS.wire, media = (a.media || []).map(function (id) { return mediaOf(S, id); }).filter(Boolean);
    var threads = J.threadsOf(S).filter(function (t) { return t.ref && t.ref.type === 'article' && t.ref.id === a.id; }).slice(0, 3);
    var iv = (S.interviews || []).filter(function (x) { return x.ref === a.id; });
    return '<div class="crumb"><a href="#/news">&#8592; All news</a></div><article class="article"><div class="a-top" style="--oc:' + o.color + '"><span class="otag" style="--oc:' + o.color + '">' + esc(o.name) + '</span><span class="otag-sub">' + esc(o.tag) + '</span></div>'
      + '<h1>' + esc(a.headline) + '</h1>' + (a.dek ? '<p class="dek">' + esc(a.dek) + '</p>' : '')
      + '<div class="byline"><b>By ' + esc(a.author || o.staff[0]) + '</b><span>' + esc(J.fmtStamp(a.ts)) + '</span>' + (a.auto ? '<span class="chip">Automatic recap</span>' : '') + '</div>'
      + (media.length ? '<div class="a-media' + (media.length === 1 ? ' one' : '') + '">' + media.map(function (m) { return '<figure><button class="gitem" data-act="lightbox" data-id="' + esc(m.id) + '">' + mediaTag(m) + '</button>' + (m.caption ? '<figcaption>' + esc(m.caption) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>' : '')
      + '<div class="a-body">' + bodyHtml(a) + '</div>'
      + (iv.length ? '<div class="ivbox"><h3>From pit road</h3>' + iv.map(function (x) { return '<blockquote><b>' + esc(x.driver) + '</b> ' + esc(x.quote) + '</blockquote>'; }).join('') + '</div>' : '')
      + ((a.tags || []).length ? '<div class="tags">' + a.tags.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' : '')
      + '<p class="fine">Coverage of a simulated league. Articles and quotes are written by AI and are not real statements by real people.</p></article>'
      + (threads.length ? '<h3 class="sech">Fans react</h3><div class="card">' + threads.map(function (t) { return threadHtml(S, t); }).join('') + '</div>' : '')
      + (J.MODE === 'admin' && !J.isPublicView() ? '<div class="adminbar"><button class="btn ghost sm" data-act="editArticle" data-id="' + esc(a.id) + '">Edit</button><button class="btn ghost sm" data-act="reactArticle" data-id="' + esc(a.id) + '">Generate fan reactions</button><button class="btn danger sm" data-act="delArticle" data-id="' + esc(a.id) + '">Delete story</button></div>' : '');
  }
  var f = J.ui.newsFilter, list = arts.filter(function (x) { return f === 'all' || x.outlet === f; });
  var chips = '<div class="fchips"><button class="fc' + (f === 'all' ? ' on' : '') + '" data-act="newsFilter" data-v="all">All outlets</button>' + Object.keys(J.OUTLETS).map(function (k) { return '<button class="fc' + (f === k ? ' on' : '') + '" data-act="newsFilter" data-v="' + k + '">' + esc(J.OUTLETS[k].name) + '</button>'; }).join('') + '</div>';
  var head = phead('News', 'Three outlets cover the league: race coverage, silly season and analysis.') + chips;
  if (!list.length) return head + empty('No stories here yet', J.MODE === 'admin' ? 'Import a race or write one in Story Studio.' : 'Check back after the next race.');
  var first = list[0], rest = list.slice(1);
  return head + '<a class="feat" href="#/news/' + esc(first.id) + '">' + (thumbOf(S, first) ? '<div class="fthumb">' + thumbOf(S, first) + '</div>' : '') + '<div>' + outletTag(first) + '<h2>' + esc(first.headline) + '</h2><p>' + esc(first.dek || '') + '</p><small>' + esc(first.author || '') + ' / ' + esc(J.fmtStamp(first.ts)) + '</small></div></a>'
    + '<div class="ngrid">' + rest.map(function (a) { return '<a class="acard" href="#/news/' + esc(a.id) + '">' + (thumbOf(S, a) ? '<div class="athumb">' + thumbOf(S, a) + '</div>' : '') + outletTag(a) + '<h4>' + esc(a.headline) + '</h4><p>' + esc(a.dek || '') + '</p><small>' + esc(J.fmtStamp(a.ts)) + '</small></a>'; }).join('') + '</div>';
};
J.nav.push({ id: 'news', label: 'News' });
J.acts.newsFilter = function (el) { J.ui.newsFilter = el.dataset.v; J.refresh(); };

/* ---------- Highlights ---------- */
J.routes.highlights = function (S) {
  var ms = S.media.slice().sort(function (a, b) { return b.ts - a.ts; });
  if (!ms.length) return phead('Highlights', 'Photos and video from the races') + empty('No highlights yet', J.MODE === 'admin' ? 'Add photos or video in Story Studio and they show up here.' : 'Race photos and clips will show up here.');
  return phead('Highlights', plural(ms.length, 'clip') + ' from the races') + '<div class="gallery big">' + ms.map(function (m) {
    var art = S.articles.find(function (a) { return (a.media || []).indexOf(m.id) >= 0; });
    return '<figure class="hl"><button class="gitem" data-act="lightbox" data-id="' + esc(m.id) + '">' + mediaTag(m) + (m.type === 'video' ? '<span class="play">Video</span>' : '') + '</button><figcaption><b>' + esc(m.caption || m.name || 'Race highlight') + '</b>' + (m.link ? '<a href="' + esc(m.link) + '" target="_blank" rel="noopener">Watch the full clip</a>' : '') + (art ? '<a href="#/news/' + esc(art.id) + '">Read the story</a>' : '') + '</figcaption></figure>';
  }).join('') + '</div>';
};
J.nav.push({ id: 'highlights', label: 'Highlights' });
J.acts.lightbox = function (el) {
  var S = J.S, m = mediaOf(S, el.dataset.id); if (!m) return;
  var art = S.articles.find(function (a) { return (a.media || []).indexOf(m.id) >= 0; });
  $('dlgBody').innerHTML = '<div class="lb">' + mediaTag(m) + '<div class="lb-c"><b>' + esc(m.caption || m.name || '') + '</b>' + (m.link ? '<a href="' + esc(m.link) + '" target="_blank" rel="noopener">Watch the full clip</a>' : '') + (art ? '<a href="#/news/' + esc(art.id) + '" data-act="closeDlg">Read the story</a>' : '') + '<button class="btn ghost sm" data-act="closeDlg">Close</button></div></div>';
  var d = $('dlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
};
J.acts.closeDlg = function () { var d = $('dlg'); if (d.close) d.close(); else d.removeAttribute('open'); };

/* ---------- Garage ---------- */
function stanceTag(fan) {
  var st = fan && fan.stance; if (!st || !st.level || !st.driver) return '';
  var label = J.STANCE[st.level], nm = NAMES[st.driver] ? J.lastName(NAMES[st.driver]) : st.driver;
  return '<span class="stance ' + (st.level > 0 ? 'good' : 'bad') + '">' + label + ' / ' + esc(nm) + '</span>';
}
function postHtml(S, p, depth) {
  var au = J.postAuthor(S, p); if (!au) return '';
  var likes = J.likesFor(p, au.figure), forum = p.platform === 'forum';
  if (!au.figure) au.handle = (forum ? 'u/' : '@') + au.fan.handle;
  var tag = au.figure ? '<span class="badge">' + esc(au.badge) + '</span>' : stanceTag(au.fan);
  var ini = au.name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase() || '?';
  return '<div class="post' + (au.figure ? ' fig' : '') + (forum ? ' forum' : '') + '"><div class="av" style="background:' + au.color + '">' + esc(ini) + '</div><div class="pb"><div class="ph"><b>' + esc(forum && !au.figure ? au.handle : au.name) + '</b>' + (au.figure ? '<span class="hdl">' + esc(au.handle) + '</span>' : (forum ? '' : '<span class="hdl">' + esc(au.handle) + '</span>')) + tag + '<span class="tm">' + esc(J.ago(p.ts)) + '</span></div><p>' + esc(p.text).replace(/\n/g, '<br>') + '</p><div class="rx"><span>' + (forum ? '&#9650; ' : '&#9825; ') + likes + '</span>' + (forum ? '<span>Reply</span>' : '<span>Repost ' + Math.floor(likes / 5) + '</span>') + '</div></div></div>';
}
function threadHtml(S, t) {
  var kids = {}; t.posts.forEach(function (p) { if (p.parent) (kids[p.parent] = kids[p.parent] || []).push(p); });
  function walk(p, d) { return postHtml(S, p) + ((kids[p.id] || []).length ? '<div class="replies' + (d >= 2 ? ' flat' : '') + '">' + kids[p.id].map(function (c) { return walk(c, d + 1); }).join('') + '</div>' : ''); }
  var root = t.root, forum = t.platform === 'forum';
  var head = forum && root.title ? '<h4 class="ftitle">' + esc(root.title) + '</h4>' : '';
  return '<article class="thread ' + (forum ? 'forumt' : '') + '">' + head + walk(root, 0) + '</article>';
}
J.threadHtml = threadHtml;
function repPanel(S) {
  var ds = J.roster(S); if (!ds.length) return '<section class="card"><div class="card-h"><h3>Driver reputation</h3></div><div class="card-b">' + empty('No drivers yet', 'Reputations start at 50 once drivers are in.') + '</div></section>';
  var list = ds.map(function (d) { var r = J.repOf(S, d.key); return { d: d, score: r.score, ev: r.events.length, tr: J.repTrend(S, d.key) }; });
  list.sort(function (a, b) { return J.ui.repWorst ? a.score - b.score : b.score - a.score; });
  var shown = J.ui.repAll ? list : list.slice(0, 10);
  return '<section class="card"><div class="card-h"><h3>Driver reputation</h3><div class="seg"><button class="' + (!J.ui.repWorst ? 'on' : '') + '" data-act="repSort" data-v="best">Liked</button><button class="' + (J.ui.repWorst ? 'on' : '') + '" data-act="repSort" data-v="worst">Disliked</button></div></div><div class="card-b rep">'
    + shown.map(function (x) { var c = x.score >= 62 ? 'g' : x.score < 40 ? 'r' : 'n'; return '<button class="repi" data-act="repOpen" data-k="' + esc(x.d.key) + '"><span class="rn">' + esc(x.d.name) + '</span><span class="rb ' + c + '"><i style="width:' + x.score + '%"></i></span><span class="rv">' + x.score + '</span><span class="rt ' + (x.tr > 0 ? 'up' : x.tr < 0 ? 'down' : 'flat') + '">' + (x.tr > 0 ? '&#9650;' : x.tr < 0 ? '&#9660;' : '-') + '</span><small>' + J.repLabel(x.score) + '</small></button>'; }).join('')
    + (list.length > 10 ? '<button class="more" data-act="repAll">' + (J.ui.repAll ? 'Show fewer' : 'Show all ' + list.length) + '</button>' : '') + '<p class="fine">Moves with what drivers say on pit road and what happens on track. Fans change sides over time.</p></div></section>';
}
J.acts.repSort = function (el) { J.ui.repWorst = el.dataset.v === 'worst'; J.refresh(); };
J.acts.repAll = function () { J.ui.repAll = !J.ui.repAll; J.refresh(); };
J.acts.repOpen = function (el) {
  var S = J.S, k = el.dataset.k, r = J.repOf(S, k), nm = NAMES[k] || k;
  var evs = r.events.length ? r.events.map(function (e) { return '<li><span class="' + (e.delta > 0 ? 'up' : 'down') + '">' + (e.delta > 0 ? '+' : '') + e.delta + '</span><div>' + esc(e.why) + '<small>' + (e.src === 'interview' ? 'Pit road interview' : e.src === 'track' ? 'On track' : 'Story') + ' / ' + esc(J.ago(e.t)) + '</small></div></li>'; }).join('') : '<li class="dim">Nothing has moved this driver yet.</li>';
  var fans = S.fans.filter(function (f) { return f.stance && f.stance.driver === k && f.stance.level; });
  var cnt = function (lv) { return fans.filter(function (f) { return f.stance.level === lv; }).length; };
  $('dlgBody').innerHTML = '<div class="dlg-h"><div><h3>' + esc(nm) + '</h3><small>' + J.repLabel(r.score) + ', ' + r.score + '/100</small></div><button class="dlg-x" data-act="closeDlg" aria-label="Close">&#10005;</button></div><div class="dlg-b"><div class="fanmix"><span class="good">Superfans ' + cnt(2) + '</span><span class="good">Fans ' + cnt(1) + '</span><span class="bad">Haters ' + cnt(-1) + '</span><span class="bad">Superhaters ' + cnt(-2) + '</span></div><ul class="evs">' + evs + '</ul></div>';
  var d = $('dlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
};
function gtabs(cur) {
  var t = [['feed', 'Fan Feed'], ['chase', 'Chase Outlook'], ['race', 'Race Outlook'], ['season', 'Season Outlook']];
  return '<nav class="gtabs">' + t.map(function (x) { return '<a href="#/garage/' + x[0] + '" class="' + (cur === x[0] ? 'on' : '') + '">' + (x[0] === 'chase' ? 'Chase Outlook' : x[1]) + '</a>'; }).join('') + '</nav>';
}
function aiNote(S, kind, key) { var a = S.ai[kind]; return a && a.notes && a.notes[key] ? '<small class="note">' + esc(a.notes[key]) + '</small>' : ''; }
function analyst(S, kind, fallback) {
  var a = S.ai[kind]; var fig = J.FIGURES[(a && a.by) || 'dana'];
  var text = a && a.summary ? a.summary : fallback;
  return '<div class="analyst"><div class="av" style="background:' + fig.color + '">' + esc(fig.name.split(' ').map(function (x) { return x[0]; }).join('')) + '</div><div><b>' + esc(a && a.headline ? a.headline : fig.name) + '</b><span class="hdl">' + esc(fig.handle) + '</span><p>' + esc(text) + '</p></div></div>';
}
function oddsBar(v, cls) { return '<span class="odds ' + (cls || '') + '"><i style="width:' + Math.max(1, Math.round(v * 100)) + '%"></i><b>' + pct(v) + '</b></span>'; }

function feedPage(S) {
  var f = J.ui.feedFilter, ths = J.threadsOf(S).filter(function (t) { return f === 'all' || t.platform === f; }).slice(0, 40);
  var chips = '<div class="fchips"><button class="fc' + (f === 'all' ? ' on' : '') + '" data-act="feedFilter" data-v="all">Everything</button><button class="fc' + (f === 'x' ? ' on' : '') + '" data-act="feedFilter" data-v="x">Feed</button><button class="fc' + (f === 'forum' ? ' on' : '') + '" data-act="feedFilter" data-v="forum">Forum</button></div>';
  var figs = '<div class="figs">' + Object.keys(J.FIGURES).map(function (k) { var x = J.FIGURES[k]; return '<div class="fig-c"><div class="av" style="background:' + x.color + '">' + x.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2) + '</div><div><b>' + esc(x.name) + '</b><span class="badge">' + x.badge + '</span><small>' + esc(x.handle) + ' / ' + x.followers + ' followers</small></div></div>'; }).join('') + '</div>';
  var body = ths.length ? '<div class="card">' + ths.map(function (t) { return threadHtml(S, t); }).join('') + '</div>' : empty('The Garage is quiet', J.MODE === 'admin' ? 'Import a race with an AI key saved and the fans show up. Add a free Gemini key in Settings.' : 'Fans start talking after the next race.');
  var iv = (S.interviews || []).slice(0, 4);
  var ivh = iv.length ? '<section class="card"><div class="card-h"><h3>Pit road</h3><small class="dim">Ray Calloway, interviews</small></div><div class="card-b">' + iv.map(function (x) { return '<blockquote class="iv"><b>' + esc(x.driver) + '</b> ' + esc(x.quote) + '<small>' + esc(x.tone || '') + ' / ' + esc(J.ago(x.ts)) + '</small></blockquote>'; }).join('') + '<p class="fine">Fictional quotes written for the league.</p></div></section>' : '';
  return '<div class="garage"><div class="gmain">' + chips + figs + body + '<p class="fine">Every account here is a made-up fan or media persona written by AI for this league. Not real people or real social posts.</p></div><aside class="gside">' + repPanel(S) + ivh + '</aside></div>';
}
J.acts.feedFilter = function (el) { J.ui.feedFilter = el.dataset.v; J.refresh(); };

function chasePage(S) {
  var co = J.chaseOutlook(S), nm = S.chase.name;
  if (!co) return empty(nm + ' outlook needs results', 'Import a race to see who is on track to make ' + nm + '.');
  var sim = co.sim, lead = co.rows[0], size = S.chase.size, cutter = co.rows[size - 1];
  var fallback = lead.name + ' leads the points and makes ' + nm + ' in ' + pct(lead.chaseOdds) + ' of ' + sim.N.toLocaleString() + ' simulated seasons. ' + (sim.decided ? 'The field is set.' : 'The field is set after race ' + sim.cutAt + ', with ' + plural(Math.max(0, sim.cutAt - sim.played), 'race') + ' left to run.') + (cutter ? ' Right now the last spot belongs to ' + cutter.name + ' with ' + cutter.curPts + ' points.' : '');
  var rows = co.rows.map(function (r, i) {
    var cl = r.chaseOdds >= 0.75 ? 'good' : r.chaseOdds >= 0.4 ? 'mid' : 'low';
    return (i === size ? '<tr class="cutline"><td colspan="7">Cut line: top ' + size + ' advance</td></tr>' : '') + '<tr data-driver="' + esc(r.key) + '"><td class="rank">' + r.pos + '</td><td><div class="drv">' + carPlate(r.car) + '<div><b>' + esc(r.name) + '</b>' + aiNote(S, 'chase', r.key) + '</div></div></td><td>' + r.curPts + '</td><td>' + r.curWins + '</td><td>' + oddsBar(r.chaseOdds, cl) + '</td><td><span class="chip ' + (cl === 'good' ? 'g' : cl === 'low' ? 'r' : 'y') + '">' + esc(r.status) + '</span></td><td>' + (r.best.length ? r.best.map(function (t) { return '<span class="chip b">' + esc(J.TYPES[t]) + '</span>'; }).join(' ') : '<span class="dim">Not enough data</span>') + '</td></tr>';
  }).join('');
  return analyst(S, 'chase', fallback) + '<div class="card"><div class="tw"><table class="data"><thead><tr><th>Pos</th><th>Driver</th><th>Pts</th><th>Wins</th><th>' + esc(nm) + ' odds</th><th>Outlook</th><th>Best track types</th></tr></thead><tbody>' + rows + '</tbody></table></div></div><p class="fine">Odds come from ' + sim.N.toLocaleString() + ' simulated seasons using results so far, each driver\'s record by track type and the remaining schedule. Early in the season the numbers move a lot.</p>';
}
function racePage(S) {
  var ro = J.raceOutlook(S);
  if (ro.none) return empty('No race left on the schedule', 'Add more races in the commissioner app to see the next outlook.');
  if (ro.empty) return '<div class="rhead"><b>' + esc(ro.next.name) + '</b><span>' + esc(ro.next.track || '') + ', ' + esc(J.TYPES[ro.type]) + '</span></div>' + empty('Race Outlook needs results', 'Once practice, qualifying or a race is in, this page shows who to expect up front.');
  var nx = ro.next, fav = ro.favorites[0];
  var fallback = fav.name + ' is the favorite at ' + pct(fav.win) + ' to win ' + nx.name + '. This is a ' + J.TYPES[ro.type].toLowerCase() + ' race, so ' + (ro.type === 'super' ? 'expect a pack and a lot of luck.' : ro.type === 'short' ? 'track position and patience matter most.' : ro.type === 'road' ? 'braking and mistakes decide it.' : 'tire wear and long runs matter most.');
  function grp(title, list, why) { return list.length ? '<section class="card grp"><div class="card-h"><h3>' + title + '</h3></div><div class="card-b">' + list.map(function (r) { return '<div class="gline" data-driver="' + esc(r.key) + '"><div><b>' + esc(r.name) + '</b><small>' + esc(why(r)) + '</small>' + aiNote(S, 'race', r.key) + '</div><span class="num">' + pct(r.top10) + ' top 10</span></div>'; }).join('') + '</div></section>' : ''; }
  var typeWhy = function (r) { var q = r.qual ? 'Qualified P' + r.qual + '. ' : ''; return q + (r.typeN ? 'Avg finish ' + r.typeAvg.toFixed(1) + ' at ' + J.TYPES[ro.type].toLowerCase() + ' tracks' : r.avgAll != null ? 'Avg finish ' + r.avgAll.toFixed(1) + ' so far' : 'First race in the league'); };
  return '<div class="rhead"><div><small>Next race</small><b>' + esc(nx.name) + '</b><span>' + esc(nx.track || '') + (nx.date ? ', ' + esc(J.fmtDate(nx.date)) : '') + '</span></div><span class="chip b">' + esc(J.TYPES[ro.type]) + '</span></div>'
    + analyst(S, 'race', fallback)
    + '<section class="card"><div class="card-h"><h3>Win odds</h3></div><div class="card-b">' + ro.rows.slice(0, 8).map(function (r) { return '<div class="wo" data-driver="' + esc(r.key) + '"><span>' + esc(r.name) + '</span>' + oddsBar(r.win / (ro.rows[0].win || 1), 'ww') + '<em>' + pct(r.win) + '</em></div>'; }).join('') + '</div></section>'
    + '<div class="grid2">' + grp('Expect them up front', ro.favorites, typeWhy) + grp('Should run well', ro.shouldRunWell, typeWhy) + grp('Dark horses', ro.darkHorses, function (r) { return 'Better at this track type than their overall form'; }) + grp('Do not expect them', ro.notUpFront, typeWhy) + '</div>'
    + '<section class="card grp"><div class="card-h"><h3>Wreck and failure risk</h3></div><div class="card-b">' + ro.wreckRisk.map(function (r) { return '<div class="gline"><div><b>' + esc(r.name) + '</b></div><span class="num">' + pct(r.dnf) + ' chance of a DNF</span></div>'; }).join('') + '</div></section>'
    + (J.sessionsFor(S, nx.id).length ? '<h3 class="sech">Practice and qualifying</h3>' + sessionBlocks(S, nx.id, true) : '')
    + '<p class="fine">Based on ' + ro.N.toLocaleString() + ' simulated races' + (ro.sessionsUsed && ro.sessionsUsed.length ? ', including ' + ro.sessionsUsed.map(function (k) { return J.SESSIONS[k].toLowerCase(); }).join(' and ') + ' speed' : '') + '. Bars are scaled to the favorite so small differences are visible.</p>';
}
function seasonPage(S) {
  var so = J.seasonOutlook(S); if (!so) return empty('Season Outlook needs results', 'Import a race to see projected finishes for the full season.');
  var sim = so.sim, champ = so.rows.slice().sort(function (a, b) { return b.champOdds - a.champOdds; })[0];
  var fallback = champ.name + ' is the most likely champion at ' + pct(champ.champOdds) + '. ' + (sim.remaining ? plural(sim.remaining, 'race') + ' remain on the schedule.' : 'The schedule is complete.') + ' Projections tighten as more races are run.';
  var rows = so.rows.map(function (r) {
    return '<tr data-driver="' + esc(r.key) + '"><td class="rank">' + r.projRank + '</td><td><div class="drv">' + carPlate(r.car) + '<div><b>' + esc(r.name) + '</b>' + aiNote(S, 'season', r.key) + '</div></div></td><td>' + r.curRank + '</td><td class="pts"><b>' + Math.round(r.projPts) + '</b></td><td>P' + r.rankMed + ' <small class="dim">(P' + r.rankLo + ' to P' + r.rankHi + ')</small></td><td>' + r.projAvg.toFixed(1) + '</td><td>' + r.projWins.toFixed(1) + '</td><td>' + oddsBar(r.champOdds, 'ww') + '</td></tr>';
  }).join('');
  return analyst(S, 'season', fallback) + '<div class="card"><div class="tw"><table class="data"><thead><tr><th>Proj.</th><th>Driver</th><th>Now</th><th>Proj. points</th><th>Final standing</th><th>Avg finish</th><th>Wins</th><th>Title odds</th></tr></thead><tbody>' + rows + '</tbody></table></div></div><p class="fine">Projected from ' + sim.N.toLocaleString() + ' simulated seasons over the ' + sim.remaining + ' races left. Range shows the 10th to 90th percentile finish.</p>';
}
J.routes.garage = function (S, args) {
  var tab = args[0] || 'feed', body = tab === 'chase' ? chasePage(S) : tab === 'race' ? racePage(S) : tab === 'season' ? seasonPage(S) : feedPage(S);
  var sub = { feed: 'Fans, media and a lot of opinions', chase: 'Who is making ' + S.chase.name + ' and who is in trouble', race: 'What to expect at the next race', season: 'Where everyone is headed by the finale' }[tab] || '';
  var actions = (J.MODE === 'admin' && !J.isPublicView()) ? '<button class="btn sm" data-act="genGarage">Refresh the Garage</button>' : '';
  return phead('The Garage', sub, actions) + gtabs(tab) + body;
};
J.nav.push({ id: 'garage', label: 'The Garage' });

/* ---------- driver dialog + global clicks ---------- */
function openDriver(key) {
  var S = J.S, d = J.agg(S.races).find(function (x) { return x.key === key; }); if (!d) return;
  var r = J.repOf(S, key), hist = d.hist.map(function (h) { return '<tr><td>' + esc(h.race) + '</td><td>' + (h.start || '-') + '</td><td><b>' + h.pos + '</b></td><td>' + h.led + '</td><td class="' + (J.isDnf(h) ? 'dnf' : 'dim') + '">' + esc(h.status || '-') + '</td><td class="pts"><b>' + h.pts + '</b></td></tr>'; }).join('');
  $('dlgBody').innerHTML = '<div class="dlg-h">' + carPlate(d.car) + '<div><h3>' + esc(d.name) + '</h3><small>' + esc(d.team || 'Independent') + ' / ' + J.repLabel(r.score) + ' with fans</small></div><button class="dlg-x" data-act="closeDlg" aria-label="Close">&#10005;</button></div>'
    + '<div class="tiles"><div><small>Points</small><b>' + d.pts + '</b></div><div><small>Wins</small><b>' + d.wins + '</b></div><div><small>Top 5</small><b>' + d.t5 + '</b></div><div><small>Poles</small><b>' + d.poles + '</b></div><div><small>Laps led</small><b>' + d.led + '</b></div><div><small>Avg finish</small><b>' + d.avg.toFixed(1) + '</b></div><div><small>DNFs</small><b>' + d.dnf + '</b></div></div>'
    + '<div class="tw" style="max-height:340px;overflow:auto"><table class="data"><thead><tr><th>Race</th><th>Start</th><th>Finish</th><th>Led</th><th>Status</th><th>Pts</th></tr></thead><tbody>' + hist + '</tbody></table></div>';
  var dl = $('dlg'); if (dl.showModal) dl.showModal(); else dl.setAttribute('open', '');
}
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (el) { var fn = J.acts[el.dataset.act]; if (fn) { if (el.tagName === 'A' && el.dataset.act !== 'closeDlg') e.preventDefault(); fn(el, e); } return; }
  var tr = e.target.closest('[data-driver]'); if (tr) openDriver(tr.dataset.driver);
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.id === 'raceSel') J.go('results/' + t.value);
  else if (t.id === 'seriesSel') { if (J.acts.switchSeries) J.acts.switchSeries(t); }
});
document.addEventListener('DOMContentLoaded', function () { var d = $('dlg'); if (d) d.addEventListener('click', function (e) { if (e.target === d) J.acts.closeDlg(); }); });

/* ---------- public boot: load published data, poll for changes ---------- */
J.loadSeries = function (id, first) {
  var url = 'data/' + id + '.json?t=' + Date.now();
  return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (data) {
    var S = J.normalize(data);
    if (first || !J.S || J.S.id !== S.id || S.updatedAt !== J.S.updatedAt) { J.S = S; J.render(!first); }
    else renderFoot();
    try { localStorage.setItem('jss_public_series', id); } catch (e) {}
  });
};
J.boot = function () {
  fetch('data/index.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('none'); return r.json(); }).then(function (idx) {
    J.seriesList = idx.series || []; var want = null;
    try { want = new URLSearchParams(location.search).get('s') || localStorage.getItem('jss_public_series'); } catch (e) {}
    var id = (J.seriesList.some(function (s) { return s.id === want; }) ? want : idx.default) || (J.seriesList[0] && J.seriesList[0].id);
    return J.loadSeries(id, true).then(function () { setInterval(function () { if (!document.hidden && J.S) J.loadSeries(J.S.id, false).catch(function () {}); }, 30000); });
  }).catch(function () { J.S = null; J.render(); });
  J.acts.switchSeries = function (el) { J.loadSeries(el.value, true).catch(function () { J.toast('Could not load that series.', true); }); };
  setInterval(renderFoot, 30000);
};
})();
