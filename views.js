/* Virtual NASCAR - pages (shared by the desktop app and the public site) */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
J.S = null; J.leagues = null; J.seriesList = []; J.blobs = {}; J.afters = {};
J.ui = { repAll: false, repWorst: false, feedFilter: 'all', newsFilter: 'all' };

var NAMES = {};
function refreshNames(S) { NAMES = {}; J.roster(S).forEach(function (d) { NAMES[d.key] = d.name; }); }
function pct(x) { if (x <= 0) return '0%'; if (x < 0.01) return '<1%'; if (x > 0.99) return '>99%'; return Math.round(x * 100) + '%'; }
function plural(n, w) { return n + ' ' + (n === 1 ? w : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's'); }
function empty(t, s, extra) { return '<div class="empty"><b>' + esc(t) + '</b><span>' + esc(s || '') + '</span>' + (extra || '') + '</div>'; }
function phead(title, sub, actions) {
  var r = J.route().name, a = J.pageArt(r);
  return '<header class="banner bn-' + esc(r) + ' acc-' + a.acc + '"><span class="emblem">' + J.icon(a.icon) + '</span><div class="bn-t"><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '<i class="bn-stripe" aria-hidden="true"></i></header>';
}
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
function outletTag(a) { return J.outletLogo(a.outlet, 'sm'); }
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

/* ---------- header: series tabs, main nav, commissioner bar ---------- */
function renderRail() {
  var S = J.S, r = J.route(), pub = J.isPublicView();
  var ORDER = ['home', 'news', 'schedule', 'standings', 'results', 'drivers', 'teams', 'silly', 'garage', 'highlights', 'display'];
  var main = J.nav.filter(function (n) { return !n.admin && (n.pub ? pub : true) && !n.hide; }).sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); }), adm = pub ? [] : J.nav.filter(function (n) { return n.admin; });
  var link = function (n) { var on = r.name === n.id; return '<a href="#/' + n.id + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>'; };
  $('navlist').innerHTML = main.map(link).join('');
  $('cnav').innerHTML = adm.map(link).join(''); $('cbar').hidden = !adm.length;
  $('brand').innerHTML = J.logo();
  var fb = $('footBrand'); if (fb && !fb.innerHTML) fb.innerHTML = J.logo('foot');
  var opts = J.seriesList, cur = S ? S.series.id : '';
  var showSel = !J.isPublicView() || (J.MODE === 'public' ? opts.length > 1 : Object.keys(J.leagues || {}).length > 1);
  $('seriesTabs').innerHTML = (showSel ? opts : opts.filter(function (o) { return o.id === cur; })).map(function (o) {
    var on = o.id === cur; return '<button class="stab' + (on ? ' on' : '') + '" data-act="pickSeries" data-id="' + esc(o.id) + '"' + (on ? ' aria-current="true"' : '') + ' style="--sc:' + (J.SERIES_COLOR[o.id] || '#888') + '">' + J.seriesBadge(o.id) + '<span>' + esc((J.leagues && J.leagues[o.id] && J.leagues[o.id].series.label) || o.label) + '</span></button>';
  }).join('');
  var seasons = J.seasonsFor ? J.seasonsFor(cur) : [];
  $('sbarRight').innerHTML = (seasons.length > 1 ? '<label class="ssel"><span>Season</span><select id="seasonSel" aria-label="Season">' + seasons.map(function (x) { return '<option value="' + esc(x.id) + '"' + (S && x.id === S.id ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>' : (S ? '<span class="sseason">' + esc(J.seasonYear(S)) + ' season</span>' : ''))
    + (J.MODE === 'admin' ? '' : '<span id="liveDot" class="livedot"></span>') + '<button class="tbtn" data-act="themeFlip" aria-label="Switch light or dark">' + J.icon(J.themeNow() === 'light' ? 'moon' : 'sun', 'sm') + '</button>';
}
J.acts.themeFlip = function () { J.setTheme(J.themeNow() === 'light' ? 'dark' : 'light'); renderRail(); };
J.acts.pickSeries = function (t) { var S = J.S; if (S && t.dataset.id === S.series.id && !S.archived) return; var fake = { value: t.dataset.id }; if (J.acts.switchSeries) J.acts.switchSeries(fake); };
function renderFoot() {
  var S = J.S, el = J.MODE === 'admin' ? $('railFoot') : $('liveDot'); if (!el) return;
  if (J.MODE === 'admin') { el.innerHTML = J.syncStatusHtml ? J.syncStatusHtml() : ''; return; }
  el.innerHTML = S ? '<span class="live"><i></i>Live</span><small>Updated ' + esc(J.agoText(S.updatedAt)) + '</small>' : '';
}
J.renderFoot = renderFoot;

/* ---------- router ---------- */
J.route = function () { var h = location.hash.replace(/^#\/?/, ''); var p = h.split('/').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } }); return { name: p[0] || 'home', args: p.slice(1) }; };
J.go = function (path) { location.hash = '#/' + path; };
J.render = function (keepScroll) {
  var S = J.S, r = J.route(), fn = J.routes[r.name] || J.routes.home;
  J.useOutlets(S); J.useFigures(S);
  if (!S) { $('view').innerHTML = '<div class="page">' + empty('Nothing published yet', 'Check back after the commissioner posts the first race.') + '</div>'; renderRail(); return; }
  refreshNames(S);
  var y = window.scrollY;
  var past = S.archived ? '<div class="pastbar">' + J.seriesBadge(S.series.id) + '<span>You are looking at the <b>' + esc(J.seasonYear(S)) + '</b> ' + esc(S.series.label) + ' season' + (S.cancelled ? ' (cancelled)' : '') + '.</span><button class="btn sm" data-act="pickSeries" data-id="' + esc(S.series.id) + '">Go to the current season</button></div>' : '';
  $('view').innerHTML = past + '<div class="page p-' + esc(r.name) + '">' + fn(S, r.args) + '</div>';
  if (J.afters[r.name]) J.afters[r.name](S, r.args);
  renderRail(); renderFoot();
  window.scrollTo(0, keepScroll ? y : 0);
};
J.refresh = function () { J.render(true); };
window.addEventListener('hashchange', function () { J.render(false); });

/* ---------- Home ---------- */
// time and TV for a schedule round ("Sat, Apr 25 / 3:30 PM ET / FS1")
J.raceWhen = function (r) {
  if (!r) return '';
  var t = /^\d{1,2}:\d{2}$/.test(r.time || '') ? (function () { var h = +r.time.split(':')[0], m = r.time.split(':')[1]; return (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM') + ' ET'; })() : '';
  var d = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  return [d, t].filter(Boolean).join(' / ');
};
J.tvChips = function (r) { var x = [r && r.tv, r && r.stream].filter(Boolean).join(' / '); return x ? x.split(/\s*[\/,]\s*/).filter(Boolean).map(function (n) { return '<span class="tv">' + esc(n) + '</span>'; }).join('') : ''; };
// a picture for stories without a photo: outlet color, track, big outlined type
J.storyArt = function (S, a, big) {
  var race = a.raceId && S.races.find(function (r) { return r.id === a.raceId; }), rd = a.preSid && S.schedule.find(function (x) { return x.id === a.preSid; });
  var word = (race && (race.track || race.name)) || (rd && (rd.track || rd.name)) || S.series.short || '';
  word = String(word).replace(/(International |Motor |Raceway|Speedway|Superspeedway|Motorsports? Park|Circuit of The )/gi, ' ').trim().split(/\s+/)[0] || 'NEWS';
  var o = J.outlet ? J.outlet(S, a.outlet) : (J.OUTLETS[a.outlet] || J.OUTLETS.wire);
  return '<div class="sart' + (big ? ' big' : '') + '" style="--oc:' + o.color + ';--sc:' + (J.SERIES_COLOR[S.series.id] || '#888') + '"><b>' + esc(word.toUpperCase()) + '</b>' + J.seriesBadge(S.series.id) + '</div>';
};
function storyPic(S, a, big) { return thumbOf(S, a) || J.storyArt(S, a, big); }
J.routes.home = function (S) {
  var ds = J.standings(S), last = S.races[S.races.length - 1], nx = J.nextRound(S), total = Math.max(S.schedule.length, S.races.length), cp = J.chasePicture(S);
  var arts = S.articles.slice().sort(function (a, b) { return b.ts - a.ts; });
  var lead = arts.find(function (a) { return thumbOf(S, a) && a.ts > (arts[0] ? arts[0].ts : 0) - 864e5 * 3; }) || arts[0], rest = arts.filter(function (a) { return a !== lead; });
  var out = '';
  if (S.announcement.text) out += '<aside class="notice"><b>Commissioner note</b><span>' + esc(S.announcement.text) + '</span></aside>';
  // race weekend strip
  out += '<section class="rstrip">';
  if (nx) {
    var q = J.sessionOf(S, nx.id, 'qualifying'), rnd = S.schedule.indexOf(nx) + 1;
    out += '<a class="rnext" href="#/schedule"><span class="rk">Up next / Race ' + rnd + ' of ' + total + '</span><b>' + esc(nx.name) + '</b><span class="rtrack">' + esc(nx.track || '') + '</span><span class="rwhen">' + esc(J.raceWhen(nx)) + '</span><span class="rtv">' + J.tvChips(nx) + '</span>' + (q && q.rows[0] ? '<span class="rpole">Pole: <b>' + esc(q.rows[0].driver) + '</b></span>' : '') + '</a>';
  } else out += '<div class="rnext"><span class="rk">Season</span><b>' + (S.races.length ? 'Season complete' : 'Season starts soon') + '</b></div>';
  if (last) { var li = J.raceInfo(last); out += '<a class="rlast" href="#/results/' + esc(last.id) + '"><span class="rk">Last race</span><b>' + esc(last.name) + '</b><span class="rwin">' + carPlate(li.winner.car) + '<span><small>Winner</small>' + esc(li.winner.driver) + '</span></span></a>'; }
  out += '<div class="rcount"><span class="rk">' + esc(J.seasonYear(S)) + ' season</span><b>' + S.races.length + '<small>/' + total + '</small></b><span>races run</span></div></section>';
  // hero: lead story + headlines
  if (lead) {
    out += '<section class="hero2"><a class="lead" href="#/news/' + esc(lead.id) + '"><div class="leadpic">' + storyPic(S, lead, true) + '</div><div class="leadtxt">' + outletTag(lead) + '<h2>' + esc(lead.headline) + '</h2>' + (lead.dek ? '<p>' + esc(lead.dek) + '</p>' : '') + '<small>' + esc(J.agoText(lead.ts)) + '</small></div></a>'
      + '<div class="heads"><div class="heads-h">Top stories</div>' + rest.slice(0, 5).map(function (a) { return '<a class="hl" href="#/news/' + esc(a.id) + '"><div class="hlpic">' + storyPic(S, a) + '</div><div>' + outletTag(a) + '<h4>' + esc(a.headline) + '</h4><small>' + esc(J.agoText(a.ts)) + '</small></div></a>'; }).join('') + '<a class="more" href="#/news">All news</a></div></section>';
  } else out += '<section class="hero2 empty-hero">' + empty('No stories yet', 'Race coverage shows up here after the first import.') + '</section>';
  // modules: results, standings, up next
  out += '<div class="mods">';
  if (last) {
    var info = J.raceInfo(last);
    out += '<section class="card mod"><div class="card-h"><h3>Results</h3><a href="#/results/' + esc(last.id) + '">Full results</a></div><div class="card-b"><div class="modsub">' + esc(last.name) + (last.track ? ', ' + esc(last.track) : '') + '</div><table class="mini">' + info.rows.slice(0, 10).map(function (r) { return '<tr data-driver="' + esc(J.driverKey(r.driver)) + '"><td class="rk">' + r.position + '</td><td>' + carPlate(r.car) + '</td><td>' + esc(r.driver) + '</td><td class="num">' + r.points + '</td></tr>'; }).join('') + '</table></div></section>';
  }
  if (ds.length) {
    out += '<section class="card mod"><div class="card-h"><h3>Standings</h3><a href="#/standings">Full standings</a></div><div class="card-b"><table class="mini"><thead><tr><th></th><th></th><th>Driver</th><th class="num">Pts</th>' + (cp ? '<th class="num">+/- Cut</th>' : '') + '</tr></thead>' + ds.slice(0, 12).map(function (d, i) { var o = cp && cp.info[d.key]; return (cp && i === S.chase.size ? '<tr class="cutline"><td colspan="5"><span>' + esc(S.chase.name) + ' cut</span></td></tr>' : '') + '<tr data-driver="' + esc(d.key) + '"><td class="rk">' + (i + 1) + '</td><td>' + carPlate(d.car) + '</td><td>' + esc(d.name) + '</td><td class="num"><b>' + d.pts + '</b></td>' + (cp ? '<td class="num ' + (o && o.toCut > 0 ? 'up' : o && o.toCut < 0 ? 'down' : '') + '">' + (o && o.locked ? 'Win' : o && o.toCut != null ? (o.toCut > 0 ? '+' : '') + o.toCut : '') + '</td>' : '') + '</tr>'; }).join('') + '</table></div></section>';
  }
  if (nx) {
    var ro = J.raceOutlook(S), up = S.schedule.slice(S.schedule.indexOf(nx), S.schedule.indexOf(nx) + 4);
    out += '<section class="card mod"><div class="card-h"><h3>Schedule</h3><a href="#/schedule">Full schedule</a></div><div class="card-b">' + up.map(function (r, i) { return '<div class="srow' + (i === 0 ? ' next' : '') + '"><div class="sdate">' + (r.date ? '<b>' + esc(new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()) + '</b><span>' + esc(String(+r.date.slice(8))) + '</span>' : '<b>TBD</b>') + '</div><div class="sinfo"><b>' + esc(r.name) + '</b><small>' + esc(r.track || '') + '</small><small>' + esc(J.raceWhen(r).split(' / ').slice(1).join(' / ')) + ' ' + J.tvChips(r) + '</small></div></div>'; }).join('')
      + (ro && ro.favorites ? '<div class="favs">' + ro.favorites.slice(0, 3).map(function (f) { return '<div><span>' + esc(f.name) + '</span><b>' + pct(f.win) + '</b></div>'; }).join('') + '</div><small class="sub">Win odds for ' + esc(nx.name) + '</small>' : '') + '</div></section>';
  }
  out += '</div>';
  if (rest.length > 5) out += '<section class="newsgrid"><div class="sec-h"><h3>More news</h3><a href="#/news">All news</a></div><div class="ngrid">' + rest.slice(5, 11).map(function (a) { return '<a class="ncard" href="#/news/' + esc(a.id) + '"><div class="npic">' + storyPic(S, a) + '</div>' + outletTag(a) + '<h4>' + esc(a.headline) + '</h4><small>' + esc(J.agoText(a.ts)) + '</small></a>'; }).join('') + '</div></section>';
  var cx = J.crossFor(S);
  if (cx && cx.headlines && cx.headlines.length) out += '<section class="newsgrid"><div class="sec-h"><h3>Around Virtual NASCAR</h3></div><div class="around">' + cx.headlines.map(function (h) { return '<button class="arow" data-act="pickSeries" data-id="' + esc(h.sid) + '">' + J.seriesBadge(h.sid) + '<span><small>' + esc(h.series) + '</small><b>' + esc(h.headline) + '</b></span></button>'; }).join('') + '</div></section>';
  var buzz = J.threadsOf(S).slice(0, 3);
  if (buzz.length && J.postCard) out += '<section class="newsgrid"><div class="sec-h"><h3>From The Garage</h3><a href="#/garage">Open The Garage</a></div><div class="buzz">' + buzz.map(function (t) { return J.postCard(S, t.root, true); }).join('') + '</div></section>';
  return out;
};
J.nav.push({ id: 'home', label: 'Home' });

/* ---------- Standings ---------- */
function cutCell(o) {
  if (!o) return '<td class="cut dim">-</td>';
  if (o.status === 'win') return '<td class="cut"><span class="lock" title="Locked in with a win">Win</span></td>';
  if (o.status === 'needwin') return '<td class="cut"><span class="needwin" title="Every spot is taken by race winners">Needs a win</span></td>';
  if (o.toCut == null) return '<td class="cut dim">-</td>';
  var cls = o.toCut > 0 ? 'above' : o.toCut < 0 ? 'below' : 'tied';
  return '<td class="cut"><span class="tocut ' + cls + '">' + (o.toCut > 0 ? '+' : o.toCut < 0 ? '&minus;' : '') + Math.abs(o.toCut) + '</span></td>';
}
function bubbleCard(S, cp) {
  if (!cp || !cp.lastIn || !cp.firstOut) return '';
  var row = function (d, side) { var o = cp.info[d.key]; return '<button class="bub ' + side + '" data-driver="' + esc(d.key) + '"><span class="bp">P' + o.pos + '</span><b>' + esc(d.name) + '</b><span class="tocut ' + (o.toCut > 0 ? 'above' : o.toCut < 0 ? 'below' : 'tied') + '">' + (o.toCut > 0 ? '+' : o.toCut < 0 ? '&minus;' : '') + Math.abs(o.toCut || 0) + '</span></button>'; };
  var when = cp.decided ? 'Field is set' : cp.left === 1 ? 'Field set after the next race' : 'Field set in ' + cp.left + ' races (after race ' + cp.cutRace + ')';
  return '<section class="bubble"><div class="bub-h"><h3>On the bubble</h3><span>' + esc(when) + (cp.winners ? ', ' + plural(cp.winners, 'winner') + ' locked in, ' + plural(cp.spots, 'spot') + ' left on points' : '') + '</span></div>'
    + '<div class="bub-row"><div class="bub-side">' + cp.bubble.lastIn.map(function (d) { return row(d, 'in'); }).join('') + '</div><div class="bub-line" aria-hidden="true"><i></i></div><div class="bub-side">' + cp.bubble.firstOut.map(function (d) { return row(d, 'out'); }).join('') + '</div></div></section>';
}
J.routes.standings = function (S, args) {
  var ds = J.standings(S), pts = J.partTimers(S), n = S.races.length, view = args[0] === 'chase' ? 'chase' : 'points';
  if (!ds.length) return phead('Standings', 'Driver points championship') + empty('No points yet', 'Standings appear after the first race.');
  var prev = {}; if (n > 1) J.standings(S, S.races.slice(0, -1)).forEach(function (d, i) { prev[d.key] = i; });
  var top = ds[0].pts || 1, cp = J.chasePicture(S), byKey = {}; ds.forEach(function (d, i) { byKey[d.key] = { d: d, i: i }; });
  var tabs = '<nav class="subtabs" aria-label="Standings view"><a href="#/standings" class="' + (view === 'points' ? 'on' : '') + '">Points</a><a href="#/standings/chase" class="' + (view === 'chase' ? 'on' : '') + '">' + esc(S.chase.name) + ' grid</a></nav>';
  var pod = ds.slice(0, 3).map(function (d, i) { return '<div class="pod p' + (i + 1) + '" data-driver="' + esc(d.key) + '"><div class="pos">' + (i + 1) + '</div><div><b>' + esc(d.name) + '</b><small>' + (d.car ? '#' + esc(d.car) + ' ' : '') + esc(d.team || '') + '</small><div class="pp">' + d.pts + ' pts</div><small>' + plural(d.wins, 'win') + ', ' + d.t5 + ' top 5</small></div></div>'; }).join('');
  var cutRow = function (cols) { return '<tr class="cutline"><td colspan="' + cols + '"><span>' + esc(S.chase.name) + ' cut line</span></td></tr>'; };
  var mvOf = function (d, i) { if (!(n > 1 && prev[d.key] != null)) return '<small class="flat">-</small>'; var c = prev[d.key] - i; return c > 0 ? '<small class="up">&#9650;' + c + '</small>' : c < 0 ? '<small class="down">&#9660;' + (-c) + '</small>' : '<small class="flat">-</small>'; };
  var body;
  if (view === 'points') {
    var rows = ds.map(function (d, i) {
      var o = cp && cp.info[d.key];
      return (cp && i === cp.cutIndex ? cutRow(12) : '') + '<tr data-driver="' + esc(d.key) + '" class="' + (o && o.in ? 'inch' : 'outch') + '"><td class="rank">' + (i + 1) + mvOf(d, i) + '</td><td><div class="drv">' + carPlate(d.car) + '<div><b>' + esc(d.name) + '</b><small>' + esc(d.team || '') + '</small></div></div></td><td class="pts"><b>' + d.pts + '</b><span class="bar"><i style="width:' + Math.max(3, Math.round(d.pts / top * 100)) + '%"></i></span></td><td class="dim">' + (i ? '&minus;' + (ds[0].pts - d.pts) : 'Leader') + '</td>' + cutCell(o) + '<td>' + d.starts + '</td><td>' + d.wins + '</td><td>' + d.t5 + '</td><td>' + d.t10 + '</td><td>' + d.poles + '</td><td>' + d.led + '</td><td>' + d.avg.toFixed(1) + '</td></tr>';
    }).join('');
    body = '<div class="podium">' + pod + '</div>' + bubbleCard(S, cp)
      + '<div class="card"><div class="tw"><table class="data stand"><thead><tr><th>Pos</th><th>Driver</th><th>Points</th><th>Behind</th><th title="Points above or below the ' + esc(S.chase.name) + ' cut line">+/&minus; Cut</th><th>Starts</th><th>Wins</th><th>Top 5</th><th>Top 10</th><th>Poles</th><th>Led</th><th>Avg</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      + '<p class="fine">+/&minus; Cut is how many points a driver is above or below the cut line for ' + esc(S.chase.name) + '. ' + (S.chase.winLocks ? 'A race win locks a driver in, as long as there are not more winners than spots. ' : '') + 'The top ' + cp.size + ' make it after race ' + cp.cutRace + '.</p>';
  } else {
    var g = cp.grid.map(function (d, i) {
      var o = cp.info[d.key], k = byKey[d.key];
      return (i === cp.size ? cutRow(7) : '') + '<tr data-driver="' + esc(d.key) + '" class="' + (o.in ? 'inch' : 'outch') + '"><td class="rank">' + (i + 1) + '</td><td><div class="drv">' + carPlate(d.car) + '<div><b>' + esc(d.name) + '</b><small>P' + (k.i + 1) + ' in points</small></div></div></td><td>' + d.wins + '</td><td class="pts"><b>' + d.pts + '</b></td>' + cutCell(o) + '<td>' + (o.status === 'win' ? '<span class="chip g">In on a win</span>' : o.in ? '<span class="chip b">In on points</span>' : '<span class="chip r">Out</span>') + '</td><td>' + d.t5 + '</td></tr>';
    }).join('');
    body = bubbleCard(S, cp) + '<div class="card"><div class="tw"><table class="data stand"><thead><tr><th>Seed</th><th>Driver</th><th>Wins</th><th>Points</th><th>+/&minus; Cut</th><th>How</th><th>Top 5</th></tr></thead><tbody>' + g + '</tbody></table></div></div>'
      + '<p class="fine">If the field were set today. Winners are seeded first, then the rest by points. ' + (cp.decided ? 'The field is set.' : 'Odds of making it are on the Chase Outlook page in The Garage.') + '</p>';
  }
  if (view === 'points' && pts.length) body += '<h3 class="sech ptsh">Part-time drivers <small>not eligible for the championship</small></h3><div class="card ptcard"><div class="tw"><table class="data stand pt"><thead><tr><th>Driver</th><th>Car</th><th>Points</th><th>Starts</th><th>Wins</th><th>Top 5</th><th>Avg finish</th></tr></thead><tbody>' + pts.map(function (d) { var sh = J.sharesCar(S, d.key); return '<tr data-driver="' + esc(d.key) + '"><td><div class="drv"><span class="ptag">PT</span><div><b>' + esc(d.name) + '</b>' + (sh.length ? '<small>Shares the #' + esc(d.car) + ' with ' + esc(sh.slice(0, 3).join(', ')) + '</small>' : '') + '</div></div></td><td>' + carPlate(d.car) + '</td><td class="num"><b>' + d.pts + '</b></td><td>' + d.starts + '</td><td>' + d.wins + '</td><td>' + d.t5 + '</td><td>' + (d.fin / d.starts).toFixed(1) + '</td></tr>'; }).join('') + '</tbody></table></div></div><p class="fine">Part-time drivers share a car or run a limited schedule, like the real series. Their finishes count in race results but not in the championship or ' + esc(S.chase.name) + '.</p>';
  return phead('Standings', S.series.label + ' championship after ' + plural(n, 'race') + (pts.length ? ' (full-time drivers)' : ''), '<button class="btn ghost sm" data-act="exportCsv">Export CSV</button>') + tabs + body;
};
J.nav.push({ id: 'standings', label: 'Standings' });
J.acts.exportCsv = function () {
  var S = J.S, ds = J.standings(S); if (!ds.length) { J.toast('No standings to export yet.'); return; }
  var q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
  var cp = J.chasePicture(S), cutTxt = function (d) { var o = cp && cp.info[d.key]; return !o ? '' : o.status === 'win' ? 'Win' : o.status === 'needwin' ? 'Needs a win' : o.toCut == null ? '' : (o.toCut > 0 ? '+' : '') + o.toCut; };
  var lines = [['Position', 'Driver', 'Car', 'Team', 'Points', 'Behind', 'To Cut Line', 'Starts', 'Wins', 'Top 5', 'Top 10', 'Poles', 'Laps Led', 'Avg Finish']].concat(ds.map(function (d, i) { return [i + 1, d.name, d.car, d.team, d.pts, i ? ds[0].pts - d.pts : 0, cutTxt(d), d.starts, d.wins, d.t5, d.t10, d.poles, d.led, d.avg.toFixed(1)]; }));
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
    return '<tr data-driver="' + esc(J.driverKey(r.driver)) + '"><td class="rank">' + r.position + '</td><td>' + (r.start || '-') + ' ' + d + '</td><td>' + carPlate(r.car) + '</td><td><b>' + esc(r.driver) + '</b>' + (J.isPT(S, J.driverKey(r.driver)) ? ' <span class="ptag" title="Part-time: not in the championship points">PT</span>' : '') + '</td><td>' + (r.laps || '-') + '</td><td>' + (r.lapsLed || 0) + '</td><td class="' + (J.isDnf(r) ? 'dnf' : 'dim') + '">' + esc(r.status || '-') + '</td><td class="pts"><b>' + r.points + '</b></td></tr>';
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
J.routes.schedule = function (S, args) {
  var done = {}; S.races.forEach(function (r) { done[r.sid] = r; }); var nx = J.nextRound(S), view = args[0] || 'all';
  if (!S.schedule.length) return phead('Schedule', 'Season calendar') + empty('No schedule yet', 'The commissioner has not added races.');
  var tabs = '<nav class="subtabs" aria-label="Schedule view">' + [['all', 'Full season'], ['upcoming', 'Upcoming'], ['results', 'Completed']].map(function (t) { return '<a href="#/schedule' + (t[0] === 'all' ? '' : '/' + t[0]) + '" class="' + (view === t[0] ? 'on' : '') + '">' + t[1] + '</a>'; }).join('') + '</nav>';
  var month = '', out = '';
  S.schedule.forEach(function (r, i) {
    var rc = done[r.id], isNext = nx && nx.id === r.id;
    if ((view === 'upcoming' && rc) || (view === 'results' && !rc)) return;
    var m = /^\d{4}-\d{2}/.test(r.date || '') ? new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Date to be announced';
    if (m !== month) { out += '<h3 class="smonth">' + esc(m) + '</h3>'; month = m; }
    var d = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? new Date(r.date + 'T12:00:00') : null, info = rc && J.raceInfo(rc), q = J.sessionOf(S, r.id, 'qualifying');
    var right = rc ? '<div class="sres"><span class="slab">Winner</span><span class="swin">' + carPlate(info.winner.car) + '<b>' + esc(info.winner.driver) + '</b></span><a class="btn sm" href="#/results/' + esc(rc.id) + '">Results</a></div>'
      : '<div class="sres"><span class="slab">' + (isNext ? 'Up next' : 'Scheduled') + '</span>' + (q && q.rows[0] ? '<span class="spole">Pole: ' + esc(q.rows[0].driver) + '</span>' : '') + (isNext && J.sessionsFor(S, r.id).length ? '<a class="btn ghost sm" href="#/results">Practice and qualifying</a>' : '') + '</div>';
    out += '<article class="sched' + (isNext ? ' next' : '') + (rc ? ' run' : '') + (r.exhibition ? ' exh' : '') + '"><div class="sday">' + (d ? '<span>' + esc(d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()) + '</span><b>' + d.getDate() + '</b><span>' + esc(d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()) + '</span>' : '<b>TBD</b>') + '</div>'
      + '<div class="smain"><div class="sk">Race ' + (i + 1) + ' <i>/</i> ' + esc(J.TYPES[r.type] || '') + (i + 1 === S.chase.regularRaces ? ' <i>/</i> <em>Regular season finale</em>' : i + 1 > S.chase.regularRaces && S.chase.size ? ' <i>/</i> <em>' + esc(S.chase.name) + '</em>' : '') + '</div><h4>' + esc(r.name) + '</h4><div class="strk">' + esc(r.track || 'Track TBD') + (r.city ? ', ' + esc(r.city) : '') + '</div>'
      + '<div class="stime">' + (J.raceWhen(r).split(' / ')[1] ? '<b>' + esc(J.raceWhen(r).split(' / ')[1]) + '</b>' : '<b>Time TBD</b>') + J.tvChips(r) + (r.note ? '<span class="snote">' + esc(r.note) + '</span>' : '') + '</div></div>' + right + '</article>'
      + (i + 1 === S.chase.regularRaces && S.chase.size ? '<div class="cutrow">' + esc(S.chase.name) + ' field is set after this race</div>' : '');
  });
  return phead('Schedule', esc(J.seasonYear(S)) + ' ' + S.series.label + ': ' + S.schedule.length + ' races, ' + S.races.length + ' run. All times Eastern.') + tabs + (out || empty('Nothing here', view === 'results' ? 'No races run yet.' : 'Every race has been run.'));
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
    var o = J.OUTLETS[a.outlet] || J.OUTLETS.wire, media = (a.media || []).map(function (id) { return mediaOf(S, id); }).filter(Boolean), x = a.extras || {};
    var threads = J.threadsOf(S).filter(function (t) { return t.ref && t.ref.type === 'article' && t.ref.id === a.id; }).slice(0, 3);
    var iv = (S.interviews || []).filter(function (q) { return q.ref === a.id; });
    var race = a.raceId && S.races.find(function (r) { return r.id === a.raceId; }), rd = a.preSid && S.schedule.find(function (r) { return r.id === a.preSid; });
    var words = String(a.body || '').split(/\s+/).length, mins = Math.max(1, Math.round(words / 230));
    // body with a pull quote and key moments placed inside it
    var paras = bodyHtml(a).split('</p>'), bodyOut = '';
    paras.forEach(function (p, i) {
      bodyOut += p + (i < paras.length - 1 ? '</p>' : '');
      if (i === 1 && x.pullQuote) bodyOut += '<aside class="pq"><p>' + esc(x.pullQuote.text) + '</p>' + (x.pullQuote.by ? '<cite>' + esc(x.pullQuote.by) + '</cite>' : '') + '</aside>';
      if (i === Math.min(4, paras.length - 2) && x.byNumbers && x.byNumbers.length) bodyOut += '<aside class="bynum"><h4>By the numbers</h4><div>' + x.byNumbers.map(function (n) { return '<span><b>' + esc(n.value) + '</b><small>' + esc(n.label) + '</small></span>'; }).join('') + '</div></aside>';
    });
    var side = '';
    if (race) {
      var info = J.raceInfo(race);
      side += '<section class="aside-card"><h4>' + esc(race.name) + '</h4><div class="modsub">' + esc(race.track || '') + (race.date ? ', ' + esc(J.fmtDate(race.date)) : '') + '</div><table class="mini">' + info.rows.slice(0, 5).map(function (r) { return '<tr data-driver="' + esc(J.driverKey(r.driver)) + '"><td class="rk">' + r.position + '</td><td>' + carPlate(r.car) + '</td><td>' + esc(r.driver) + '</td><td class="num">' + (r.lapsLed ? r.lapsLed + ' led' : '') + '</td></tr>'; }).join('') + '</table>'
        + '<div class="asstats">' + (race.meta && race.meta.cautions != null ? '<span><b>' + race.meta.cautions + '</b>cautions</span>' : '') + (race.meta && race.meta.leadChanges != null ? '<span><b>' + race.meta.leadChanges + '</b>lead changes</span>' : '') + '<span><b>' + info.rows.length + '</b>starters</span></div><a class="btn sm" href="#/results/' + esc(race.id) + '">Full results</a></section>';
    } else if (rd) {
      var q = J.sessionOf(S, rd.id, 'qualifying'), pr = J.sessionOf(S, rd.id, 'practice');
      side += '<section class="aside-card"><h4>' + esc(rd.name) + '</h4><div class="modsub">' + esc(rd.track || '') + '</div><div class="rwhen">' + esc(J.raceWhen(rd)) + '</div><div class="rtv">' + J.tvChips(rd) + '</div>' + (q && q.rows[0] ? '<p class="sub">Pole: <b>' + esc(q.rows[0].driver) + '</b></p>' : '') + (pr && pr.rows[0] ? '<p class="sub">Fastest in practice: <b>' + esc(pr.rows[0].driver) + '</b></p>' : '') + '</section>';
    }
    if (x.takeaways && x.takeaways.length) side += '<section class="aside-card"><h4>Takeaways</h4><ol class="tk">' + x.takeaways.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></section>';
    var more = arts.filter(function (b) { return b.outlet === a.outlet && b.id !== a.id; }).slice(0, 4);
    if (more.length) side += '<section class="aside-card"><h4>More from ' + esc(o.name) + '</h4>' + more.map(function (b) { return '<a class="hl sm" href="#/news/' + esc(b.id) + '"><div class="hlpic">' + storyPic(S, b) + '</div><div><h4>' + esc(b.headline) + '</h4><small>' + esc(J.agoText(b.ts)) + '</small></div></a>'; }).join('') + '</section>';
    return '<div class="crumb"><a href="#/news">&#8592; All news</a></div>'
      + '<header class="ahead ol-' + o.id + '" style="--oc:' + o.color + '"><div class="ahead-pic">' + (media.length ? (media[0].type === 'video' ? mediaTag(media[0]) : '<button class="gitem" data-act="lightbox" data-id="' + esc(media[0].id) + '">' + mediaTag(media[0]) + '</button>') : J.storyArt(S, a, true)) + '</div><div class="ahead-txt"><div class="a-top">' + J.outletLogo(o.id, 'lg') + (a.preSid ? '<span class="chip y">Preview</span>' : '') + (a.outlet === 'silly' ? '<span class="chip r">Rumor mill</span>' : '') + '</div><h1>' + esc(a.headline) + '</h1>' + (a.dek ? '<p class="dek">' + esc(a.dek) + '</p>' : '')
      + '<div class="byline"><span class="av" style="--c:' + o.color + '">' + esc(J.initials(a.author || o.staff[0])) + '</span><div><b>By ' + esc(a.author || o.staff[0]) + '</b><span>' + esc(o.name) + ' / ' + esc(J.fmtStamp(a.ts)) + ' / ' + mins + ' min read</span></div>' + (a.auto ? '<span class="chip">Automatic recap</span>' : '') + '</div></div></header>'
      + '<div class="alayout"><article class="article ol-' + o.id + '">'
      + (media.length > 1 ? '<div class="a-media">' + media.slice(1).map(function (m) { return '<figure><button class="gitem" data-act="lightbox" data-id="' + esc(m.id) + '">' + mediaTag(m) + '</button>' + (m.caption ? '<figcaption>' + esc(m.caption) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>' : (media[0] && media[0].caption ? '<p class="fine">' + esc(media[0].caption) + '</p>' : ''))
      + '<div class="a-body">' + bodyOut + '</div>'
      + (x.keyMoments && x.keyMoments.length ? '<section class="kmoments"><h3>Key moments</h3><ol>' + x.keyMoments.map(function (m) { return '<li><b>' + esc(m.when || '') + '</b><span>' + esc(m.text) + '</span></li>'; }).join('') + '</ol></section>' : '')
      + (iv.length ? '<div class="ivbox"><h3>From pit road</h3>' + iv.map(function (q) { return '<blockquote><b>' + esc(q.driver) + '</b> ' + esc(q.quote) + '</blockquote>'; }).join('') + '</div>' : '')
      + (x.whatsNext ? '<aside class="wnext"><b>What\'s next</b><span>' + esc(x.whatsNext) + '</span></aside>' : '')
      + ((a.tags || []).length ? '<div class="tags">' + a.tags.map(function (t) { return '<span class="chip" data-driver="' + esc(J.driverKey(t)) + '">' + esc(t) + '</span>'; }).join('') + '</div>' : '')
      + '<p class="fine">Coverage of a simulated league. Articles and quotes are written by AI and are not real statements by real people.</p>'
      + (threads.length ? '<h3 class="sech">Fans react</h3><div class="card">' + threads.map(function (t) { return threadHtml(S, t); }).join('') + '</div>' : '')
      + '</article><aside class="aside">' + side + '</aside></div>'
      + (J.MODE === 'admin' && !J.isPublicView() ? '<div class="adminbar"><button class="btn ghost sm" data-act="editArticle" data-id="' + esc(a.id) + '">Edit</button><button class="btn ghost sm" data-act="reactArticle" data-id="' + esc(a.id) + '">Generate fan reactions</button><button class="btn danger sm" data-act="delArticle" data-id="' + esc(a.id) + '">Delete story</button></div>' : '');
  }
  var f = J.ui.newsFilter, list = arts.filter(function (x) { return f === 'all' || x.outlet === f; });
  var chips = '<div class="fchips"><button class="fc' + (f === 'all' ? ' on' : '') + '" data-act="newsFilter" data-v="all">All outlets</button>' + Object.keys(J.OUTLETS).map(function (k) { return '<button class="fc fc-ol' + (f === k ? ' on' : '') + '" data-act="newsFilter" data-v="' + k + '">' + J.outletLogo(k, 'xs') + '</button>'; }).join('') + '</div>';
  var head = phead('News', J.OUTLETS.wire.name + ', ' + J.OUTLETS.silly.name + ' and ' + J.OUTLETS.notes.name + ' cover the league.') + chips;
  if (!list.length) return head + empty('No stories here yet', J.MODE === 'admin' ? 'Import a race or write one in Story Studio.' : 'Check back after the next race.');
  var first = list[0], rest = list.slice(1);
  var board = (f === 'all' || f === 'silly') ? sillyBoard(S) : '';
  return head + board + '<a class="feat ol-' + esc(first.outlet) + '" href="#/news/' + esc(first.id) + '"><div class="fthumb">' + storyPic(S, first, true) + '</div><div>' + outletTag(first) + '<h2>' + esc(first.headline) + '</h2><p>' + esc(first.dek || '') + '</p><small>' + esc(first.author || '') + ' / ' + esc(J.fmtStamp(first.ts)) + '</small></div></a>'
    + '<div class="ngrid">' + rest.map(function (a) { return '<a class="acard" href="#/news/' + esc(a.id) + '"><div class="athumb">' + storyPic(S, a) + '</div>' + outletTag(a) + '<h4>' + esc(a.headline) + '</h4><p>' + esc(a.dek || '') + '</p><small>' + esc(J.fmtStamp(a.ts)) + '</small></a>'; }).join('') + '</div>';
};
function sillyBoard(S) {
  var all = (S.silly || []).slice().sort(function (a, b) { var la = a.history[a.history.length - 1], lb = b.history[b.history.length - 1]; return (lb ? lb.ts : 0) - (la ? la.ts : 0); }).slice(0, 8);
  if (!all.length) return '';
  var cls = { whisper: '', rumor: 'y', talks: 'y', close: 'b', confirmed: 'g', dead: 'r' };
  return '<section class="card sboard"><div class="card-h"><h3>Silly season board</h3><small class="dim">' + esc(J.sillyPhase(S).label) + '</small></div><div class="card-b">' + all.map(function (x) {
    var last = x.history[x.history.length - 1], idx = J.SILLY_STAGES.indexOf(x.stage);
    return '<div class="srum"><div class="srum-t">' + (last ? '<a href="#/news/' + esc(last.art) + '">' + esc(x.title) + '</a>' : esc(x.title)) + '<small>' + J.plural(x.history.length, 'report') + (last ? ', latest ' + esc(J.agoText(last.ts)) : '') + '</small></div>'
      + '<div class="srum-s"><span class="meter" aria-hidden="true">' + [0, 1, 2, 3, 4].map(function (i) { return '<i class="' + (x.stage === 'dead' ? 'dead' : i <= idx ? 'on' : '') + '"></i>'; }).join('') + '</span><span class="chip ' + cls[x.stage] + '">' + esc(J.SILLY_LABEL[x.stage]) + '</span></div></div>';
  }).join('') + '<p class="fine">League fiction. Rumors move from a whisper to confirmed (or fall through) over several reports.</p></div></section>';
}
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
  var label = J.STANCE[st.level], nm = NAMES[st.driver] ? J.lastName(NAMES[st.driver]) : st.driver, car = J.carOf ? J.carOf(J.S, st.driver) : '';
  return '<a class="stance s' + (st.level > 0 ? 'p' : 'n') + Math.abs(st.level) + '" href="#/garage/fans/' + esc(st.driver) + '" title="' + esc(label + ' of ' + (NAMES[st.driver] || nm)) + '">' + (car ? '<i class="car">' + esc(car) + '</i>' : '') + '<span>' + esc(label.toUpperCase()) + '</span><em>' + esc(nm) + '</em></a>';
}
function fmtCount(n) { return n >= 10000 ? (n / 1000).toFixed(0) + 'K' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); }
function profHref(au) { return au.figure ? '#/garage/m/' + au.id : '#/garage/u/' + au.fan.id; }
function authorLine(au, forum) {
  var h = profHref(au);
  return au.figure ? '<a class="aul" href="' + h + '"><b>' + esc(au.name) + '</b></a><span class="badge" style="--c:' + au.color + '">' + esc(au.badge) + '</span><span class="hdl">' + esc(au.handle) + '</span>'
    : forum ? '<a class="aul" href="' + h + '"><b>' + esc(au.handle) + '</b></a>' : '<a class="aul" href="' + h + '"><b>' + esc(au.name) + '</b></a><span class="hdl">' + esc(au.handle) + '</span>';
}
function quoteHtml(S, p) {
  var q = S.posts.find(function (x) { return x.id === p.quote; }); if (!q) return '';
  var au = J.postAuthor(S, q); if (!au) return '';
  if (!au.figure) au.handle = (q.platform === 'forum' ? 'u/' : '@') + au.fan.handle;
  var t = q.text.length > 220 ? q.text.slice(0, 217) + '...' : q.text;
  return '<div class="qpost">' + J.avatar(au) + '<div><div class="ph">' + authorLine(au, false) + '</div><p>' + esc(t) + '</p></div></div>';
}
function pollHtml(p, likes) {
  var r = J.rng('poll' + p.id), w = p.poll.map(function () { return 0.4 + r() * 2; }), sum = w.reduce(function (a, b) { return a + b; }, 0);
  var pc = w.map(function (x) { return Math.round(x / sum * 100); }), d = 100 - pc.reduce(function (a, b) { return a + b; }, 0); pc[0] += d;
  var top = Math.max.apply(null, pc), votes = Math.round(likes * (2 + r() * 4));
  return '<div class="poll">' + p.poll.map(function (o, i) { return '<div class="popt' + (pc[i] === top ? ' win' : '') + '"><i style="width:' + pc[i] + '%"></i><span>' + esc(o) + '</span><b>' + pc[i] + '%</b></div>'; }).join('') + '<small>' + fmtCount(votes) + ' votes, final results</small></div>';
}
J.postCard = function (S, p) { return '<div class="post-wrap">' + postHtml(S, p, 0) + '</div>'; };
function postHtml(S, p, kids) {
  var au = J.postAuthor(S, p); if (!au) return '';
  var likes = J.likesFor(p, au.figure), forum = p.platform === 'forum';
  if (!au.figure) au.handle = (forum ? 'u/' : '@') + au.fan.handle;
  var tag = au.figure ? '' : stanceTag(au.fan), reps = Math.floor(likes / (4 + (likes % 5))), replies = (kids || 0) + Math.floor(likes / 23);
  var rx = forum ? '<span class="vote">&#9650; ' + fmtCount(likes) + ' &#9660;</span><span>Reply</span><span>Share</span>'
    : '<span title="Replies">' + J.icon('garage', 'sm') + fmtCount(replies) + '</span><span title="Reposts">&#8645; ' + fmtCount(reps) + '</span><span title="Likes">&#9825; ' + fmtCount(likes) + '</span><span class="views" title="Views">' + fmtCount(likes * (18 + likes % 11)) + ' views</span>';
  return '<div class="post' + (au.figure ? ' fig' : '') + (forum ? ' forum' : '') + '"><a class="avl" href="' + profHref(au) + '" tabindex="-1" aria-hidden="true">' + J.avatar(au) + '</a><div class="pb"><div class="ph">' + authorLine(au, forum) + tag + '<span class="tm">' + esc(J.ago(p.ts)) + '</span></div><p>' + esc(p.text).replace(/\n/g, '<br>') + '</p>'
    + (p.quote ? quoteHtml(S, p) : '') + (p.poll ? pollHtml(p, likes) : '') + '<div class="rx">' + rx + '</div></div></div>';
}
function threadHtml(S, t) {
  var kids = {}; t.posts.forEach(function (p) { if (p.parent) (kids[p.parent] = kids[p.parent] || []).push(p); });
  function walk(p, d) { return postHtml(S, p, (kids[p.id] || []).length) + ((kids[p.id] || []).length ? '<div class="replies' + (d >= 2 ? ' flat' : '') + '">' + kids[p.id].map(function (c) { return walk(c, d + 1); }).join('') + '</div>' : ''); }
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
  var t = [['feed', 'Fan Feed'], ['fans', 'Fanbases'], ['chase', 'Chase Outlook'], ['race', 'Race Outlook'], ['season', 'Season Outlook']];
  return '<nav class="gtabs">' + t.map(function (x) { return '<a href="#/garage/' + x[0] + '" class="' + (cur === x[0] ? 'on' : '') + '">' + (x[0] === 'chase' ? 'Chase Outlook' : x[1]) + '</a>'; }).join('') + '</nav>';
}
function aiNote(S, kind, key) { var a = S.ai[kind]; return a && a.notes && a.notes[key] ? '<small class="note">' + esc(a.notes[key]) + '</small>' : ''; }
function analyst(S, kind, fallback) {
  var a = S.ai[kind]; var fig = J.FIGURES[(a && a.by) || 'dana'];
  var text = a && a.summary ? a.summary : fallback;
  return '<div class="analyst" style="--c:' + fig.color + '">' + J.avatar({ figure: true, name: fig.name, color: fig.color }, true) + '<div><div class="ph"><b>' + esc(fig.name) + '</b><span class="badge" style="--c:' + fig.color + '">' + esc(fig.badge) + '</span><span class="hdl">' + esc(fig.handle) + '</span></div>' + (a && a.headline ? '<h4>' + esc(a.headline) + '</h4>' : '') + '<p>' + esc(text) + '</p></div></div>';
}
function oddsBar(v, cls) { return '<span class="odds ' + (cls || '') + '"><i style="width:' + Math.max(1, Math.round(v * 100)) + '%"></i><b>' + pct(v) + '</b></span>'; }

function feedPage(S) {
  var f = J.ui.feedFilter, ths = J.threadsOf(S).filter(function (t) { return f === 'all' || t.platform === f; }).slice(0, 40);
  var chips = '<div class="fchips"><button class="fc' + (f === 'all' ? ' on' : '') + '" data-act="feedFilter" data-v="all">Everything</button><button class="fc' + (f === 'x' ? ' on' : '') + '" data-act="feedFilter" data-v="x">Feed</button><button class="fc' + (f === 'forum' ? ' on' : '') + '" data-act="feedFilter" data-v="forum">Forum</button></div>';
  var figs = '<section class="figs" aria-label="Accounts everyone follows"><h3>Accounts everyone follows</h3><div class="figrow">' + Object.keys(J.FIGURES).map(function (k) { var x = J.FIGURES[k]; return '<div class="fig-c" title="' + esc(x.bio) + '">' + J.avatar({ figure: true, name: x.name, color: x.color }) + '<div><b>' + esc(x.name) + '</b><small>' + esc(x.handle) + '</small><small><span class="badge" style="--c:' + x.color + '">' + esc(x.badge) + '</span> ' + x.followers + '</small></div></div>'; }).join('') + '</div></section>';
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
  var tab = args[0] || 'feed';
  if (tab === 'u') return fanProfile(S, args[1]);
  if (tab === 'm') return figProfile(S, args[1]);
  var body = tab === 'fans' ? fanbasePage(S, args[1]) : tab === 'chase' ? chasePage(S) : tab === 'race' ? racePage(S) : tab === 'season' ? seasonPage(S) : feedPage(S);
  var sub = { fans: 'Who loves whom, and who cannot stand them', feed: 'Fans, media and a lot of opinions', chase: 'Who is making ' + S.chase.name + ' and who is in trouble', race: 'What to expect at the next race', season: 'Where everyone is headed by the finale' }[tab] || '';
  var actions = (J.MODE === 'admin' && !J.isPublicView()) ? '<button class="btn sm" data-act="genGarage">Refresh the Garage</button>' : '';
  return phead('The Garage', sub, actions) + gtabs(tab) + body;
};
J.nav.push({ id: 'garage', label: 'The Garage' });

/* ---------- drivers, teams, silly season ---------- */
function teamChip(t) { return t ? '<a class="tchip" href="#/teams/' + esc(t.id) + '" style="--tc:' + esc(t.color || '#888') + '">' + esc(t.name) + '</a>' : '<span class="tchip none">No team set</span>'; }
function bar(v, max, cls, label) { var w = Math.max(0, Math.min(100, v / max * 100)); return '<span class="hbar k-' + (cls || 'good') + '" role="img" aria-label="' + esc(label || '') + '"><i style="width:' + w.toFixed(0) + '%"></i></span>'; }
function happyBar(h) { if (!h) return ''; var cls = h.score >= 65 ? 'good' : h.score >= 50 ? 'mid' : h.score >= 35 ? 'warn' : 'bad'; return '<div class="hrow"><span class="hlab">Happiness</span>' + bar(h.score, 100, cls, h.label + ' ' + h.score + ' of 100') + '<b class="hval k-' + cls + '">' + esc(h.label) + '</b></div>'; }
function contractBar(ci) { if (!ci) return ''; var yrs = Math.max(0, ci.left + 1), cls = ci.status === 'free' ? 'bad' : ci.status === 'expiring' ? 'warn' : ci.status === 'short' ? 'mid' : 'good'; return '<div class="hrow"><span class="hlab">Contract</span><span class="cseg">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= yrs ? 'on k-' + cls : '') + '"></i>'; }).join('') + '</span><b class="hval k-' + cls + '">' + esc(ci.label) + '</b></div>'; }
J.routes.drivers = function (S, args) {
  if (args[0]) return driverPage(S, args[0]);
  var ds = J.standings(S), all = J.agg(S.races), roster = J.allDrivers(S), byKey = {}; ds.forEach(function (d, i) { byKey[d.key] = { d: d, i: i }; }); all.forEach(function (d) { if (!byKey[d.key]) byKey[d.key] = { d: d, i: 900 - d.pts * 0.001 }; });
  if (!roster.length) return phead('Drivers', '') + empty('No drivers yet', 'Drivers show up after the first import.');
  var list = roster.slice().sort(function (a, b) { return (byKey[a.key] ? byKey[a.key].i : 999) - (byKey[b.key] ? byKey[b.key].i : 999); });
  return phead('Drivers', J.plural(list.length, 'driver') + ' in the ' + J.seasonYear(S) + ' ' + S.series.label) + '<div class="dgrid">' + list.map(function (r) {
    var x = byKey[r.key], d = x && x.d, t = J.teamOf(S, r.key), car = (S.contracts[r.key] && S.contracts[r.key].car) || r.car || '';
    return '<a class="dcard" href="#/drivers/' + esc(r.key) + '" style="--tc:' + esc((t && t.color) || '#555') + '"><span class="dnum">' + esc(car || '?') + '</span><div class="dmeta"><b>' + esc(r.name) + (J.isPT(S, r.key) ? ' <span class="ptag">PT</span>' : '') + '</b><small>' + esc(t ? t.name : 'No team set') + '</small></div><div class="dstats">' + (d ? '<span><b>' + (x.i < 900 ? x.i + 1 : 'PT') + '</b>Pos</span><span><b>' + d.pts + '</b>Pts</span><span><b>' + d.wins + '</b>Wins</span>' : '<span><b>-</b>No starts</span>') + '</div></a>';
  }).join('') + '</div>';
};
J.nav.push({ id: 'drivers', label: 'Drivers' });
function driverPage(S, key) {
  var d = J.agg(S.races).find(function (x) { return x.key === key; }), r0 = J.allDrivers(S).find(function (x) { return x.key === key; });
  if (!d && !r0) return phead('Drivers', '') + empty('Driver not found', '', '<a class="btn sm" href="#/drivers">All drivers</a>');
  var name = d ? d.name : r0.name, t = J.teamOf(S, key), ci = J.contractInfo(S, key), h = J.happiness(S, key), rep = J.repOf(S, key), car = (S.contracts[key] && S.contracts[key].car) || (d && d.car) || (r0 && r0.car) || '';
  var rank = d && !J.isPT(S, key) ? J.standings(S).findIndex(function (x) { return x.key === key; }) + 1 : null, shares = J.sharesCar(S, key), pred = (J.sillyPredictions(S, J.crossFor ? J.crossFor(S) : null) || []).find(function (x) { return x.key === key; });
  var mates = t ? J.teamDrivers(S, t.id).filter(function (k) { return k !== key; }) : [];
  var arts = S.articles.filter(function (a) { return (a.tags || []).some(function (n) { return J.driverKey(n) === key; }); }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 4);
  var other = J.otherSeriesFor ? J.otherSeriesFor(S, name) : [];
  var hist = d ? d.hist.slice().reverse().map(function (x) { return '<tr><td><a href="#/results/' + esc(x.raceId) + '">' + esc(x.race) + '</a></td><td>' + (x.start || '-') + '</td><td><b>' + x.pos + '</b></td><td>' + x.led + '</td><td class="' + (J.isDnf({ status: x.status }) ? 'down' : '') + '">' + esc(x.status || 'Running') + '</td><td class="num">' + x.pts + '</td></tr>'; }).join('') : '';
  var adm = J.MODE === 'admin' && !J.isPublicView() && J.driverEditor ? J.driverEditor(S, key) : '';
  return '<div class="crumb"><a href="#/drivers">&#8592; All drivers</a></div>'
    + '<section class="dhead" style="--tc:' + esc((t && t.color) || '#555') + '"><span class="dnum big">' + esc(car || '?') + '</span><div class="dh-t"><div class="kick">' + esc(S.series.label) + '</div><h1>' + esc(name) + '</h1>' + teamChip(t) + (J.isPT(S, key) ? ' <span class="ptag big">Part-time</span>' : '') + (shares.length ? '<div class="shares">Shares the #' + esc(car) + ' with ' + esc(shares.join(', ')) + '</div>' : '') + '</div><div class="dh-s">' + (d ? (rank ? '<span><b>' + rank + '</b>in points</span>' : '<span><b>PT</b>part-time</span>') + '<span><b>' + d.pts + '</b>points</span><span><b>' + d.wins + '</b>wins</span><span><b>' + d.t5 + '</b>top 5s</span><span><b>' + (d.fin / d.starts).toFixed(1) + '</b>avg finish</span>' : '<span><b>0</b>starts</span>') + '</div></section>'
    + '<div class="profgrid"><div>'
    + (hist ? '<section class="card"><div class="card-h"><h3>' + esc(J.seasonYear(S)) + ' results</h3></div><div class="tw"><table class="data"><thead><tr><th>Race</th><th>Start</th><th>Finish</th><th>Led</th><th>Status</th><th class="num">Pts</th></tr></thead><tbody>' + hist + '</tbody></table></div></section>' : '')
    + (arts.length ? '<h3 class="sech">In the news</h3><div class="ngrid two">' + arts.map(function (a) { return '<a class="ncard" href="#/news/' + esc(a.id) + '"><div class="npic">' + storyPic(S, a) + '</div>' + outletTag(a) + '<h4>' + esc(a.headline) + '</h4></a>'; }).join('') + '</div>' : '')
    + '</div><aside class="aside">'
    + '<section class="aside-card"><h4>With the team</h4>' + contractBar(ci) + happyBar(h) + (h && h.why.length ? '<ul class="why">' + h.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + (mates.length ? '<p class="sub">Teammates: ' + mates.map(function (k) { var x = J.roster(S).find(function (q) { return q.key === k; }); return '<a href="#/drivers/' + esc(k) + '">' + esc(x ? x.name : k) + '</a>'; }).join(', ') + '</p>' : '') + '</section>'
    + (pred ? '<section class="aside-card"><h4>Silly season outlook</h4><div class="hrow"><span class="hlab">Chance of a new ride</span>' + bar(pred.p, 1, pred.p >= 0.5 ? 'bad' : pred.p >= 0.25 ? 'warn' : 'good', Math.round(pred.p * 100) + '%') + '<b class="hval">' + Math.round(pred.p * 100) + '%</b></div>' + (pred.dest && pred.dest.length && pred.p >= 0.2 ? '<p class="sub">Most likely landing spot: <b>' + esc(pred.dest[0]) + '</b></p>' : '') + '<a class="btn ghost sm" href="#/silly">Silly Season</a></section>' : '')
    + '<section class="aside-card"><h4>With the fans</h4><div class="hrow"><span class="hlab">Reputation</span>' + bar(rep.score, 100, rep.score >= 60 ? 'good' : rep.score >= 40 ? 'mid' : 'bad') + '<b class="hval">' + esc(J.repLabel(rep.score)) + '</b></div><a class="btn ghost sm" href="#/garage/fans/' + esc(key) + '">See the fanbase</a></section>'
    + (other.length ? '<section class="aside-card"><h4>Also races in</h4>' + other.map(function (o) { return '<p class="sub"><b>' + esc(o.series) + '</b>: ' + esc(o.line) + '</p>'; }).join('') + '</section>' : '')
    + adm + '</aside></div>';
}
J.routes.teams = function (S, args) {
  if (args[0]) return teamPage(S, args[0]);
  var ds = J.agg(S.races), tids = Object.keys(S.teams || {}).filter(function (k) { return J.teamDrivers(S, k).length; });
  if (!tids.length) return phead('Teams', '') + empty('No teams yet', J.MODE === 'admin' ? 'Set teams in Teams and Contracts (commissioner bar).' : 'The commissioner has not set up teams yet.');
  var stat = function (k) { var ks = J.teamDrivers(S, k), w = 0, p = 0; ks.forEach(function (x) { var d = ds.find(function (q) { return q.key === x; }); if (d) { w += d.wins; p += d.pts; } }); return { w: w, p: p, n: ks.length }; };
  tids.sort(function (a, b) { return stat(b).p - stat(a).p; });
  return phead('Teams', J.plural(tids.length, 'team') + ' in the ' + S.series.label) + '<div class="tgrid">' + tids.map(function (k) {
    var t = S.teams[k], s = stat(k);
    return '<a class="tcard" href="#/teams/' + esc(k) + '" style="--tc:' + esc(t.color || '#555') + '"><div class="tc-top"><b>' + esc(t.name) + '</b><small>' + esc([t.base, t.mfr].filter(Boolean).join(' / ')) + '</small></div><div class="tc-cars">' + J.teamDrivers(S, k).map(function (x) { var c = S.contracts[x]; return '<span' + (c.pt ? ' class="ptc"' : '') + '><i class="car">' + esc(c.car || '?') + '</i>' + esc(J.lastName(c.name || x)) + (c.pt ? '<em>PT</em>' : '') + '</span>'; }).join('') + '</div><div class="tc-s"><span><b>' + s.w + '</b>wins</span><span><b>' + s.p + '</b>points</span></div></a>';
  }).join('') + '</div>';
};
J.nav.push({ id: 'teams', label: 'Teams' });
function teamPage(S, id) {
  var t = (S.teams || {})[id]; if (!t) return phead('Teams', '') + empty('Team not found', '', '<a class="btn sm" href="#/teams">All teams</a>');
  var ds = J.agg(S.races), ks = J.teamDrivers(S, id);
  ks.sort(function (a, b) { return (S.contracts[a].pt ? 1 : 0) - (S.contracts[b].pt ? 1 : 0) || String(S.contracts[a].car).localeCompare(String(S.contracts[b].car), undefined, { numeric: true }); });
  var rows = ks.map(function (k) { var d = ds.find(function (q) { return q.key === k; }), r = J.allDrivers(S).find(function (q) { return q.key === k; }), ci = J.contractInfo(S, k), h = J.happiness(S, k); return '<a class="tdrow" href="#/drivers/' + esc(k) + '"><span class="dnum">' + esc(S.contracts[k].car || (r && r.car) || '?') + '</span><div class="tdn"><b>' + esc(r ? r.name : k) + (S.contracts[k].pt ? ' <span class="ptag">PT</span>' : '') + '</b><small>' + (J.sharesCar(S, k).length ? 'Shares the #' + esc(S.contracts[k].car) + '. ' : '') + (d ? (S.contracts[k].pt ? 'Part-time, ' : 'P' + (J.standings(S).findIndex(function (q) { return q.key === k; }) + 1) + ' in points, ') + J.plural(d.wins, 'win') + ', ' + (d.fin / d.starts).toFixed(1) + ' avg finish' : 'No starts yet') + '</small></div><div class="tdb">' + contractBar(ci) + happyBar(h) + '</div></a>'; }).join('');
  var arts = S.articles.filter(function (a) { return (a.tags || []).some(function (n) { return ks.indexOf(J.driverKey(n)) >= 0; }) || String(a.body || '').indexOf(t.name) >= 0; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 4);
  var w = 0, top5 = 0, fin = 0, st = 0; ks.forEach(function (k) { var d = ds.find(function (q) { return q.key === k; }); if (d) { w += d.wins; top5 += d.t5; fin += d.fin; st += d.starts; } });
  return '<div class="crumb"><a href="#/teams">&#8592; All teams</a></div><section class="dhead team" style="--tc:' + esc(t.color || '#555') + '"><div class="dh-t"><div class="kick">' + esc(S.series.label) + '</div><h1>' + esc(t.name) + '</h1><small>' + esc([t.base, t.mfr, J.plural(ks.length, 'car')].filter(Boolean).join(' / ')) + '</small></div><div class="dh-s"><span><b>' + w + '</b>wins</span><span><b>' + top5 + '</b>top 5s</span><span><b>' + (st ? (fin / st).toFixed(1) : '-') + '</b>avg finish</span></div></section>'
    + '<h3 class="sech">Drivers</h3><div class="tdlist">' + rows + '</div>'
    + (arts.length ? '<h3 class="sech">In the news</h3><div class="ngrid">' + arts.map(function (a) { return '<a class="ncard" href="#/news/' + esc(a.id) + '"><div class="npic">' + storyPic(S, a) + '</div>' + outletTag(a) + '<h4>' + esc(a.headline) + '</h4></a>'; }).join('') + '</div>' : '')
    + (J.MODE === 'admin' && !J.isPublicView() && J.teamEditor ? J.teamEditor(S, id) : '');
}
J.routes.silly = function (S) {
  var ph = J.sillyPhase(S), cross = J.crossFor ? J.crossFor(S) : null, preds = J.sillyPredictions(S, cross), yr = J.seasonNum(S);
  var movers = preds.filter(function (x) { return x.p >= 0.2; }).slice(0, 12);
  var out = phead('Silly Season', 'Who is moving for ' + (yr + 1) + '. Predictions from contracts, form, happiness and ' + J.OUTLETS.silly.name + '\'s rumor mill.');
  out += '<section class="sphase"><div><span class="kick">Right now</span><b>' + esc(ph.label) + '</b></div><p>' + esc({ preseason: 'Rides for this season are set. Next year talk has not started.', early: 'Early whispers. Real teams almost never announce next year this early.', spring: 'Rumors heat up and talks start, but no big announcements yet.', summer: 'Peak silly season. This is when most deals get announced.', playoffs: 'Most rides are set. The last open seats are getting filled.', finale: 'Quiet. Teams wait until after the title race.', offseason: 'Announcement season: crew chiefs, sponsors and the last open seats.' }[ph.id] || '') + '</p></section>';
  if (!Object.keys(S.contracts || {}).length) return out + empty('No contracts yet', J.MODE === 'admin' ? 'Contracts are created after the first import, or set them in Teams and Contracts.' : 'Check back after the first race.');
  out += '<h3 class="sech">Predicted moves</h3>' + (movers.length ? '<div class="pgrid">' + movers.map(function (x) {
    var pc = Math.round(x.p * 100), cls = x.p >= 0.6 ? 'bad' : x.p >= 0.35 ? 'warn' : 'mid';
    return '<a class="pcard" href="#/drivers/' + esc(x.key) + '"><div class="pc-h"><span class="dnum">' + esc(x.car || '?') + '</span><div><b>' + esc(x.name) + '</b>' + (x.pt ? ' <span class="ptag">PT</span>' : '') + '<small>' + esc(x.team ? x.team.name : 'No team') + (x.pt ? ', part-time' : '') + '</small></div><span class="pc-p ' + cls + '">' + pc + '%</span></div>' + bar(x.p, 1, cls, pc + '% chance of a new ride')
      + (x.dest && x.dest.length ? '<div class="pc-d">Likely landing spot: <b>' + esc(x.dest[0]) + '</b>' + (x.dest[1] ? ' or ' + esc(x.dest[1]) : '') + '</div>' : '') + '<ul class="why">' + x.why.slice(0, 3).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' + (x.storyline ? '<span class="chip r">' + esc(J.SILLY_LABEL[x.storyline.stage]) + '</span>' : '') + '</a>';
  }).join('') + '</div>' : '<p class="sub">Nobody looks likely to move right now.</p>');
  if (cross && cross.stars && cross.stars.length) out += '<h3 class="sech">Coming up from the ' + esc(cross.downLabel) + '</h3><div class="xstars">' + cross.stars.map(function (s) { return '<div class="xs"><span class="car">' + esc(s.car || '?') + '</span><div><b>' + esc(s.name) + '</b><small>' + J.plural(s.wins, 'win') + ', ' + s.avg.toFixed(1) + ' avg finish in the ' + esc(cross.downLabel) + '</small></div></div>'; }).join('') + '</div>';
  out += sillyBoard(S);
  out += '<h3 class="sech">Contract tracker</h3><div class="tw"><table class="data ctrack"><thead><tr><th>Car</th><th>Driver</th><th>Team</th><th>Contract</th><th>Happiness</th><th class="num">Move chance</th></tr></thead><tbody>' + preds.slice().sort(function (a, b) { return a.contract.through - b.contract.through || b.p - a.p; }).map(function (x) {
    return '<tr data-driver="' + esc(x.key) + '"><td><span class="car">' + esc(x.car || '?') + '</span></td><td><b>' + esc(x.name) + '</b>' + (x.pt ? ' <span class="ptag">PT</span>' : '') + '</td><td>' + esc(x.team ? x.team.name : '-') + '</td><td>' + contractBar(x.contract) + '</td><td>' + happyBar(x.happy) + '</td><td class="num"><b>' + Math.round(x.p * 100) + '%</b></td></tr>';
  }).join('') + '</tbody></table></div>';
  return out;
};
J.nav.push({ id: 'silly', label: 'Silly Season' });

/* ---------- fan profiles, media profiles, fanbases ---------- */
J.carOf = function (S, key) { var d = J.agg(S.races).find(function (x) { return x.key === key; }) || J.roster(S).find(function (x) { return x.key === key; }); return d ? String(d.car || '') : ''; };
function fmtJoined(j) { if (!/^\d{4}-\d{2}/.test(j || '')) return ''; return 'Joined ' + new Date(j + '-15T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function postsBy(S, kind, id) {
  var mine = S.posts.filter(function (p) { return p.by && p.by.type === kind && p.by.id === id; }).sort(function (a, b) { return b.ts - a.ts; });
  return mine;
}
function postWithContext(S, p) {
  var parent = p.parent && S.posts.find(function (x) { return x.id === p.parent; }), pa = parent && J.postAuthor(S, parent);
  var ref = p.ref && p.ref.type === 'article' && S.articles.find(function (a) { return a.id === p.ref.id; });
  return '<div class="pctx">' + (pa ? '<div class="rto">Replying to <a href="' + profHref(pa) + '">' + esc(pa.figure ? pa.handle : (pa.fan.platform === 'forum' ? 'u/' : '@') + pa.fan.handle) + '</a></div>' : '') + (ref ? '<div class="rto">On <a href="#/news/' + esc(ref.id) + '">' + esc(ref.headline) + '</a></div>' : '') + postHtml(S, p, 0) + '</div>';
}
function meter(level) { return '<span class="smeter" aria-label="' + esc(J.STANCE[level] || 'neutral') + '">' + [-2, -1, 1, 2].map(function (k) { return '<i class="' + ((level < 0 && k >= level && k < 0) || (level > 0 && k <= level && k > 0) ? (k < 0 ? 'on n' : 'on p') : '') + '"></i>'; }).join('') + '</span>'; }
function fanProfile(S, id) {
  var f = S.fans.find(function (x) { return x.id === id; });
  if (!f) return phead('The Garage', '') + empty('Account not found', 'It may have been removed.', '<a class="btn sm" href="#/garage">Back to The Garage</a>');
  var forum = f.platform === 'forum', au = { figure: false, fan: f, name: f.name, color: f.color }, st = f.stance || {}, dn = st.driver ? (NAMES[st.driver] || st.driver) : '', mine = postsBy(S, 'fan', f.id);
  var rep = st.driver && S.rep[st.driver] ? Math.round(S.rep[st.driver].score) : null;
  var fandom = st.driver && st.level ? '<section class="card fandom ' + (st.level > 0 ? 'pos' : 'neg') + '"><div class="card-h"><h3>' + (st.level > 0 ? 'Cheers for' : 'Roots against') + '</h3></div><div class="card-b"><div class="fdrv">' + '<span class="car big">' + esc(J.carOf(S, st.driver) || '?') + '</span><div><b>' + esc(dn) + '</b><span class="slabel">' + esc(J.STANCE[st.level]) + '</span>' + meter(st.level) + '</div></div>'
    + '<p class="sub">' + esc({ 2: 'Blind loyalty. Defends every move, brings them up even when nobody asked.', 1: 'Supportive, but will admit a bad day.', '-1': 'Dry and snarky. Enjoys the bad days, gives grudging credit.', '-2': 'Relentless. Celebrates every setback and argues with their fans.' }[st.level]) + '</p>'
    + (rep != null ? '<p class="sub">Fan reputation of ' + esc(J.lastName(dn)) + ' right now: <b>' + rep + '/100</b></p>' : '') + '<a class="btn ghost sm" href="#/garage/fans/' + esc(st.driver) + '">See the whole fanbase</a></div></section>'
    : '<section class="card fandom"><div class="card-h"><h3>Fandom</h3></div><div class="card-b"><p class="sub">Just here for the racing. No favorite driver, no grudges.</p></div></section>';
  return '<div class="crumb"><a href="#/garage">&#8592; The Garage</a></div>'
    + '<section class="prof' + (forum ? ' forum' : '') + '" style="--c:' + (f.color || '#888') + '"><div class="prof-cover"></div><div class="prof-main">' + J.avatar(au, true)
    + '<div class="prof-id"><h1>' + esc(forum ? 'u/' + f.handle : f.name) + '</h1>' + (forum ? '' : '<span class="hdl">@' + esc(f.handle) + '</span>') + (st.level ? stanceTag(f) : '') + '</div>'
    + (f.bio ? '<p class="prof-bio">' + esc(f.bio) + '</p>' : '')
    + '<div class="prof-meta">' + (f.place ? '<span>' + J.icon('home', 'sm') + esc(f.place) + '</span>' : '') + (fmtJoined(f.joined) ? '<span>' + J.icon('schedule', 'sm') + esc(fmtJoined(f.joined)) + '</span>' : '') + '<span>' + esc(forum ? 'r/NASCAR regular' : 'on X') + '</span></div>'
    + '<div class="prof-counts">' + (forum ? '<span><b>' + esc((f.karma || 0).toLocaleString()) + '</b> karma</span>' : '<span><b>' + esc(String(f.following || 0)) + '</b> Following</span><span><b>' + esc(String(f.followers || 0)) + '</b> Followers</span>') + '<span><b>' + mine.length + '</b> posts here</span></div></div></section>'
    + '<div class="profgrid"><div class="profposts"><h3 class="sech">Posts and replies</h3>' + (mine.length ? mine.slice(0, 40).map(function (p) { return postWithContext(S, p); }).join('') : empty('No posts yet', 'This account has not said anything this season.')) + '</div><aside class="aside">' + fandom + '</aside></div>';
}
function figProfile(S, id) {
  var g = J.FIGURES[id]; if (!g) return phead('The Garage', '') + empty('Account not found', '');
  var au = { figure: true, id: id, name: g.name, handle: g.handle, badge: g.badge, color: g.color }, mine = postsBy(S, 'figure', id);
  return '<div class="crumb"><a href="#/garage">&#8592; The Garage</a></div><section class="prof fig" style="--c:' + g.color + '"><div class="prof-cover"></div><div class="prof-main">' + J.avatar(au, true) + '<div class="prof-id"><h1>' + esc(g.name) + ' <span class="verified" title="Media account">&#10003;</span></h1><span class="hdl">' + esc(g.handle) + '</span><span class="badge" style="--c:' + g.color + '">' + esc(g.badge) + '</span></div><p class="prof-bio">' + esc(g.bio) + '</p><div class="prof-counts"><span><b>' + esc(g.followers) + '</b> Followers</span><span><b>' + mine.length + '</b> posts here</span></div></div></section>'
    + '<div class="profposts"><h3 class="sech">Posts</h3>' + (mine.length ? mine.slice(0, 40).map(function (p) { return postWithContext(S, p); }).join('') : empty('No posts yet', '')) + '</div>';
}
function fanbasePage(S, key) {
  var ds = J.agg(S.races), roster = ds.length ? ds : J.roster(S), by = {};
  S.fans.forEach(function (f) { var st = f.stance; if (st && st.driver && st.level) { var b = by[st.driver] = by[st.driver] || { 2: [], 1: [], '-1': [], '-2': [] }; b[st.level].push(f); } });
  if (key) {
    var d = roster.find(function (x) { return x.key === key; }) || { key: key, name: NAMES[key] || key }, b = by[key] || { 2: [], 1: [], '-1': [], '-2': [] };
    var col = function (lv, title) { return '<section class="card fbcol l' + lv + '"><div class="card-h"><h3>' + title + ' <small>' + b[lv].length + '</small></h3></div><div class="card-b">' + (b[lv].length ? b[lv].map(function (f) { return '<a class="fbacct" href="#/garage/u/' + esc(f.id) + '">' + J.avatar({ fan: f, name: f.name }) + '<span><b>' + esc(f.platform === 'forum' ? 'u/' + f.handle : f.name) + '</b><small>' + esc(f.platform === 'forum' ? 'Reddit' : '@' + f.handle) + '</small></span></a>'; }).join('') : '<p class="sub">Nobody yet.</p>') + '</div></section>'; };
    var loud = S.posts.filter(function (p) { if (!p.by || p.by.type !== 'fan') return false; var f = S.fans.find(function (x) { return x.id === p.by.id; }); return f && f.stance && f.stance.driver === key && Math.abs(f.stance.level) === 2; }).sort(function (a, b) { return J.likesFor(b) - J.likesFor(a); }).slice(0, 4);
    return '<div class="crumb"><a href="#/garage/fans">&#8592; All fanbases</a></div><section class="fbhead"><span class="car big">' + esc(J.carOf(S, key) || '?') + '</span><div><h2>' + esc(d.name) + '</h2>' + fbBar(b) + '</div></section>'
      + '<div class="fbcols">' + col(2, 'Superfans') + col(1, 'Fans') + col(-1, 'Haters') + col(-2, 'Superhaters') + '</div>'
      + (loud.length ? '<h3 class="sech">Loudest takes</h3><div class="buzz">' + loud.map(function (p) { return J.postCard(S, p); }).join('') + '</div>' : '');
  }
  var rows = roster.map(function (d) { var b = by[d.key] || { 2: [], 1: [], '-1': [], '-2': [] }, pos = b[2].length + b[1].length, neg = b[-1].length + b[-2].length; return { d: d, b: b, n: pos + neg, net: pos - neg }; }).filter(function (r) { return r.n; }).sort(function (a, b) { return b.n - a.n; });
  if (!rows.length) return empty('No fanbases yet', 'Fan accounts pick their drivers after the first import.');
  return '<p class="sub fbintro">Every fan account has a driver they love or cannot stand. Green is love, red is hate. The darker the color, the louder they are.</p><div class="fblist">' + rows.map(function (r) {
    return '<a class="fbrow" href="#/garage/fans/' + esc(r.d.key) + '"><span class="car">' + esc(r.d.car || '?') + '</span><b>' + esc(r.d.name) + '</b>' + fbBar(r.b) + '<span class="fbnet ' + (r.net > 0 ? 'up' : r.net < 0 ? 'down' : '') + '">' + (r.net > 0 ? '+' : '') + r.net + '</span></a>';
  }).join('') + '</div>';
}
function fbBar(b) {
  var n = function (k) { return b[k].length; }, tot = Math.max(1, n(2) + n(1) + n(-1) + n(-2)), w = function (k) { return (n(k) / tot * 100).toFixed(1) + '%'; };
  return '<div class="fbbar" role="img" aria-label="' + n(2) + ' superfans, ' + n(1) + ' fans, ' + n(-1) + ' haters, ' + n(-2) + ' superhaters"><i class="l-2" style="width:' + w(-2) + '"></i><i class="l-1" style="width:' + w(-1) + '"></i><i class="l1" style="width:' + w(1) + '"></i><i class="l2" style="width:' + w(2) + '"></i></div><div class="fbleg"><span class="l-2">' + n(-2) + ' superhaters</span><span class="l-1">' + n(-1) + ' haters</span><span class="l1">' + n(1) + ' fans</span><span class="l2">' + n(2) + ' superfans</span></div>';
}

/* ---------- Settings for visitors (theme, default series) ---------- */
J.routes.display = function (S) {
  var p = J.themePref(), opt = function (k, label, desc, icon) { return '<label class="tchoice tc-' + k + (p === k ? ' on' : '') + '"><input type="radio" name="theme" value="' + k + '"' + (p === k ? ' checked' : '') + '><span class="tc-prev" aria-hidden="true"><i></i><i></i><i></i></span><span class="tc-t">' + J.icon(icon) + '<b>' + label + '</b></span><small>' + desc + '</small></label>'; };
  var list = J.seriesList || [], cur = ''; try { cur = localStorage.getItem('jss_public_series') || ''; } catch (e) {}
  return phead('Settings', 'How this site looks on your screen')
    + '<section class="panel"><h3>Appearance</h3><div class="tchoices" role="radiogroup" aria-label="Theme">'
    + opt('dark', 'Dark', 'Black with NASCAR yellow, red and blue. The default.', 'moon') + opt('light', 'Light', 'White pages with navy, easier in bright rooms.', 'sun') + opt('auto', 'Match my device', 'Follows your phone or computer setting.', 'auto')
    + '</div></section>'
    + (J.MODE === 'public' && list.length > 1 ? '<section class="panel"><h3>Series</h3><p class="sub">Which series opens when you visit.</p><div class="field" style="max-width:360px"><label for="defSeries">Open this series first</label><select id="defSeries">' + list.map(function (o) { return '<option value="' + esc(o.id) + '"' + ((cur || (S && S.id)) === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></div></section>' : '')
    + '<p class="fine">Saved in this browser only.</p>';
};
J.nav.push({ id: 'display', label: 'Settings', pub: true });
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.name === 'theme') { J.setTheme(t.value); document.querySelectorAll('.tchoice').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); }
  else if (t.id === 'defSeries') { try { localStorage.setItem('jss_public_series', t.value); } catch (x) {} if (J.acts.switchSeries && J.S && t.value !== J.S.id) J.acts.switchSeries(t); }
});

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
  var tr = e.target.closest('[data-driver]'); if (tr && !e.target.closest('a,button')) J.go('drivers/' + encodeURIComponent(tr.dataset.driver));
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.id === 'raceSel') J.go('results/' + t.value);
  else if (t.id === 'seriesSel') { if (J.acts.switchSeries) J.acts.switchSeries(t); }
  else if (t.id === 'seasonSel') { if (J.acts.switchSeason) J.acts.switchSeason(t.value); }
});
document.addEventListener('DOMContentLoaded', function () { var d = $('dlg'); if (d) d.addEventListener('click', function (e) { if (e.target === d) J.acts.closeDlg(); }); });

/* ---------- public boot: load published data, poll for changes ---------- */
J.loadSeries = function (id, first) {
  var url = 'data/' + id + '.json?t=' + Date.now();
  return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (data) {
    var S = J.normalize(data);
    if (first || !J.S || J.S.id !== S.id || S.updatedAt !== J.S.updatedAt) { J.S = S; J.render(!first); }
    else renderFoot();
    if (!S.archived) { try { localStorage.setItem('jss_public_series', id); } catch (e) {} }
  });
};
J.boot = function () {
  fetch('data/index.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('none'); return r.json(); }).then(function (idx) {
    J.seriesList = idx.series || []; J.seasonIndex = idx.seasons || {}; var want = null;
    try { want = new URLSearchParams(location.search).get('s') || localStorage.getItem('jss_public_series'); } catch (e) {}
    var id = (J.seriesList.some(function (s) { return s.id === want; }) ? want : idx.default) || (J.seriesList[0] && J.seriesList[0].id);
    return J.loadSeries(id, true).then(function () { setInterval(function () { if (!document.hidden && J.S) J.loadSeries(J.S.id, false).catch(function () {}); }, 30000); });
  }).catch(function () { J.S = null; J.render(); });
  J.acts.switchSeason = function (id) { J.loadSeries(id, true).catch(function () { J.toast('Could not load that season.', true); }); };
  J.acts.switchSeries = function (el) { J.loadSeries(el.value, true).catch(function () { J.toast('Could not load that series.', true); }); };
  setInterval(renderFoot, 30000);
};
})();
