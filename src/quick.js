/* Virtual NASCAR - one-tap automation (commissioner only).
   Big buttons that do a whole job: sim a race, sim a season, run the offseason, roll into next year, or do all of it for every series. */
(function () {
'use strict';
var J = window.JSS, esc = J.esc, LAD = J.LADDER;
function cur(sid) { return J.curLeague ? J.curLeague(sid) : null; }
function lives() { return LAD.map(cur).filter(function (L) { return L && !L.archived; }); }
function left(L) { return (L.schedule || []).filter(function (r) { return !(L.races || []).some(function (x) { return x.sid === r.id; }); }).length; }
function persistAll() { var all = lives(); return Promise.all(all.map(function (L) { return L === J.S ? Promise.resolve() : J.store.saveLeague(L); })); }

// the finish-the-year step, without any questions: archive this season, start the next one (schedule carries over)
J.rollSeason = async function (sid, year) {
  var old = J.leagues[sid]; if (!old || old.archived) return null;
  year = year || (parseInt(J.seasonYear(old), 10) + 1);
  if (J.S && J.S.id === sid) await J.store.saveLeague(J.S);
  await J.archiveSeason(old, false);
  var L = J.nextSeason(old, { year: year }); L.id = sid; J.leagues[sid] = L; await J.store.saveLeague(L);
  if (J.S === old || (J.S && J.S.id === sid)) { J.S = L; await J.store.setActive(sid); await J.store.loadBlobs(J.S); }
  if (L && AI_ON()) setTimeout(function () { J.ai.offseasonCoverage(L).then(function () { if (J.S === L) J.save({ render: true }); else J.store.saveLeague(L); }).catch(function (e) { console.error(e); }); }, 200);
  return L;
};
function AI_ON() { return J.ai && J.ai.hasKey() && J.settings.autoCoverage !== false; }
// sims every series (or just one) to the end of its schedule
J.simSeasons = function (only) {
  var n = 0, ran = 0; lives().forEach(function (L) { if (only && L.id !== only) return; if (!left(L)) return; var k = J.simRounds(L, 0, { ai: L === J.S }); if (k) { n += k; ran++; } });
  return { races: n, series: ran };
};
J.runYear = async function (o) {
  o = o || {}; var keep = J.S && J.S.series.id, out = { races: 0, rolled: 0 };
  var s = J.simSeasons(); out.races = s.races; await persistAll();
  if (o.roll) {
    if (J.autoOffseason) { try { J.autoOffseason(); } catch (e) { console.error(e); } }
    var ui = J.ui.cmAll; J.ui.cmAll = true; try { J.acts.faPlace(true); } catch (e) { console.error(e); } J.ui.cmAll = ui;
    var sids = LAD.filter(function (x) { return cur(x); });
    for (var i = 0; i < sids.length; i++) { if (await J.rollSeason(sids[i])) out.rolled++; }
    if (J.leagues[keep]) { J.S = J.leagues[keep]; await J.store.setActive(keep); await J.store.loadBlobs(J.S); }
    if (J.saveDirty) J.saveDirty();
  }
  J.save({ render: true }); return out;
};
J.acts.qSimNext = function () {
  var S = J.S; if (!J.nextRound(S)) { J.toast('Every race on the schedule has been run.', true); return; }
  var n = J.simRounds(S, 1, { ai: true }); if (!n) { J.toast('The sim has no drivers yet. Import the real roster first (League page).', true); return; }
  J.save({ render: true }); J.toast('Race simmed. Standings, news and fan chatter are updated.');
};
J.acts.qSimRest = function () {
  var S = J.S, k = left(S); if (!k) { J.toast('Every race on the schedule has been run.', true); return; }
  var n = J.simRounds(S, 0, { ai: true }); J.save({ render: true }); J.toast(J.plural(n, 'race') + ' simmed, with recaps and fan chatter.');
};
J.acts.qSimAll = async function () {
  var all = lives().filter(left); if (!all.length) { J.toast('Every series has run its whole schedule.', true); return; }
  if (!confirm('Sim the rest of the season for ' + all.map(function (L) { return L.series.label; }).join(', ') + '? Results count like real races.')) return;
  var r = await J.runYear({ roll: false }); J.toast(J.plural(r.races, 'race') + ' simmed across ' + J.plural(r.series || all.length, 'series', 'series') + '.');
};
J.acts.qOffseason = function () {
  if (!confirm('Run the offseason now for every series? Moves, re-signings, retirements and free agents get decided (nothing starts until you press Finish season).')) return;
  var n = J.autoOffseason ? J.autoOffseason() : 0; var ui = J.ui.cmAll; J.ui.cmAll = true; J.acts.faPlace(true); J.ui.cmAll = ui; J.refresh();
  J.toast(J.plural(n, 'move') + ' decided. Review them on Career Moves, then press Finish season.');
};
J.acts.qFinish = async function () {
  var S = J.S, y = parseInt(J.seasonYear(S), 10) + 1;
  if (!confirm('Finish the ' + J.seasonYear(S) + ' ' + S.series.label + ' season and start ' + y + '? The offseason (moves, re-signings, free agents, progression) runs by itself first.')) return;
  if (J.autoOffseason && !(J.settings && J.settings.autopilot === false)) { try { J.autoOffseason(); } catch (e) { console.error(e); } }
  var L = await J.rollSeason(S.series.id, y); if (L) { if (J.saveDirty) J.saveDirty(); J.save({ render: true }); J.toast(y + ' season started.'); }
};
J.acts.qEverything = async function () {
  var all = lives(), y = all.length ? parseInt(J.seasonYear(all[0]), 10) + 1 : 0;
  if (!confirm('Do the whole year for all ' + all.length + ' series? Sim every race that is left, run the offseason, then start ' + y + '. Past seasons stay saved. Download a backup first if you want to be safe.')) return;
  J.toast('Working on it...'); var r = await J.runYear({ roll: true }); J.toast(J.plural(r.races, 'race') + ' simmed, ' + J.plural(r.rolled, 'series', 'series') + ' rolled into the new season.');
};
J.acts.qChatter = function () {
  var S = J.S, race = S.races[S.races.length - 1]; if (!race) { J.toast('Run a race first.', true); return; }
  var n = J.localChatter(S, race); J.save({ render: true }); J.toast(n ? n + ' new fan posts.' : 'No fan accounts yet.', !n);
};
J.acts.qRatingsUpdate = function () {
  var S = J.S; if (!J.progressAuto) return; if (!S.races.length) { J.toast('Run a race first.', true); return; }
  try { J.progressAuto(S); J.save({ render: true }); J.toast('Ratings updated from this season.'); } catch (e) { J.toast('Could not update ratings: ' + e.message, true); }
};

J.routes.quick = function (S) {
  var all = lives(), big = function (act, title, sub, cls) { return '<button class="qbtn ' + (cls || '') + '" data-act="' + act + '"><b>' + title + '</b><small>' + sub + '</small></button>'; };
  var nx = J.nextRound(S), k = left(S), rest = all.filter(left).length;
  return J.phead('One-Tap', 'Buttons that do a whole job for you. Everything here uses the same sim, news and fan chatter as the rest of the app.')
    + '<section class="panel"><h3>' + esc(S.series.label) + ' (open now)</h3><p class="sub">' + (nx ? 'Next race: ' + esc(nx.name) + '. ' + J.plural(k, 'race') + ' left.' : 'Every race on the schedule has been run.') + '</p>'
    + '<div class="qgrid">' + big('qSimNext', 'Sim next race', 'Results, recap, standings and fan chatter') + big('qSimRest', 'Sim the rest of the season', 'Every race left, each with its recap and fans') + big('qFinish', 'Finish season, start next', 'Offseason runs by itself, then the new year starts') + '</div></section>'
    + '<section class="panel"><h3>Every series at once</h3><p class="sub">' + J.plural(rest, 'series', 'series') + ' still ha' + (rest === 1 ? 's' : 've') + ' races to run.</p>'
    + '<div class="qgrid">' + big('qSimAll', 'Sim all series to the end', 'Cup, O\'Reilly, Trucks and ARCA') + big('qOffseason', 'Run the offseason', 'Moves, re-signings, retirements, free agents. You review before the new year', '') + big('qEverything', 'Do the whole year', 'Sim, offseason and the next season for all four series', 'hot') + '</div></section>'
    + '<section class="panel"><h3>Extras</h3><div class="qgrid">' + big('qChatter', 'Fresh fan chatter', 'Fans react to the last race again') + big('qRatingsUpdate', 'Update ratings from results', 'Progression for everyone based on the season so far') + '<a class="qbtn" href="#/ratings"><b>Ratings import</b><small>Drop in an NR Ratings screenshot or export</small></a><a class="qbtn" href="#/careers"><b>Career moves</b><small>Review who moves where</small></a></div></section>';
};
(function () { var i = J.nav.findIndex(function (n) { return n.id === 'races'; }); J.nav.splice(i < 0 ? J.nav.length : i, 0, { id: 'quick', label: 'One-Tap', group: 'Commissioner', admin: true }); })();
})();
