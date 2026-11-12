/* Virtual NASCAR - "Refresh everything": rewrites the season's fan posts (and, if picked, the newsroom's stories and the
   automatic recaps) from the first weekend to now, in league-calendar order. Each step only sees what had happened by then,
   so early-season chatter sounds early-season. Saves after every step and can be stopped and continued later.
   Story Studio stories are never rewritten. (Commissioner only, never published.) */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
var R = J.refreshAll = { running: false, stop: false, msg: '', label: '', err: '' };
var opts = { posts: true, news: true, recaps: false };
var PAUSE = 3000; // between AI requests, keeps Gemini's free per-minute limit happy
R.setPause = function (ms) { PAUSE = ms; };

function isRecap(a) { return a.outlet === 'wire' && a.raceId && !a.desk && !a.preSid && !a.studio && !(a.media || []).length; }
function isStudio(a) { return !a.desk && !isRecap(a); }
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

// Every moment worth rewriting, in calendar order.
R.plan = function (S, o) {
  var ev = [], dated = J.dated(S), order = {}; S.schedule.forEach(function (r, i) { order[r.id] = i; });
  var seq = 0, fake = function () { return Date.now() - 864e5 * 30 + (seq++) * 3600000; };
  var rounds = S.schedule.filter(function (r) { return S.races.some(function (x) { return x.sid === r.id; }) || S.sessions.some(function (x) { return x.sid === r.id; }); });
  S.races.filter(function (r) { return !order.hasOwnProperty(r.sid); }).forEach(function (r) { rounds.push({ id: '_' + r.id, race: r }); });
  rounds.forEach(function (rd) {
    var sess = S.sessions.filter(function (x) { return x.sid === rd.id; }).sort(function (a, b) { return J.sessionTime(S, a) - J.sessionTime(S, b); });
    sess.forEach(function (x) { ev.push({ kind: 'session', id: x.id, sid: x.sid, t: dated ? J.sessionTime(S, x) : fake(), label: J.SESSIONS[x.type] + ', ' + (rd.name || x.name) }); });
    var race = rd.race || S.races.find(function (x) { return x.sid === rd.id; });
    if (race) {
      var rt = dated && /^\d{4}-\d{2}-\d{2}$/.test(race.date || '') ? J.storyTime(S, 'recap', { race: race }) : fake();
      ev.push({ kind: 'race', id: race.id, t: rt, label: race.name });
      ev.push({ kind: 'week', id: race.id, t: dated ? rt + (72 + 12 - 21) * 3600000 - 40 * 60000 : fake(), label: 'Midweek after ' + race.name });
    }
  });
  if (o.posts) S.articles.filter(function (a) { return a.studio || (isStudio(a)); }).forEach(function (a) { ev.push({ kind: 'react', id: a.id, t: a.ts + 60000, label: 'Reactions to "' + a.headline.slice(0, 50) + '"' }); });
  ev.sort(function (a, b) { return a.t - b.t; });
  // midweek chatter has to happen before the next weekend starts
  ev.forEach(function (e, i) { if (e.kind !== 'week') return; var nx = ev.slice(i + 1).find(function (x) { return x.kind === 'session' || x.kind === 'race'; }); var prev = ev[i - 1]; if (nx && e.t > nx.t - 3600000) e.t = Math.round(((prev ? prev.t : e.t - 864e5) + nx.t) / 2); });
  ev.sort(function (a, b) { return a.t - b.t; });
  // The Garage keeps about the last four weekends of chatter (older stories keep their reactions), so older practice,
  // qualifying and midweek chatter would be written only to be trimmed: skip it and save the free requests.
  var rk = ev.filter(function (e) { return e.kind === 'race'; }), recent = rk.length > 4 ? rk[rk.length - 5].t : -Infinity;
  ev.forEach(function (e) { if ((e.kind === 'week' && e.t <= recent + 5 * 864e5) || (e.kind === 'session' && e.t <= recent)) e.oldChat = true; });
  var calls = 0; ev.forEach(function (e) { if (e.oldChat && e.kind === 'week') e.skip = true; if (!o.posts && (e.kind === 'week' || e.kind === 'react')) e.skip = true; if (e.oldChat && e.kind === 'session' && !o.news) e.skip = true; if (e.skip) return;
    calls += (o.posts && !e.oldChat ? 1 : 0) + (e.kind === 'race' ? (o.news ? 1 : 0) + (o.recaps ? 1 : 0) : 0) + (e.kind === 'session' && o.news ? 1 : 0); });
  return { events: ev.filter(function (e) { return !e.skip; }), calls: calls };
};

R.start = function (S, o) {
  var p = R.plan(S, o);
  var job = { opts: o, events: p.events, i: 0, started: Date.now(), oldPosts: [], oldArts: [], newsDone: {}, recapFor: {} };
  if (o.posts) job.oldPosts = S.posts.map(function (q) { return q.id; });
  job.oldArts = S.articles.filter(function (a) { return (o.news && a.desk) || (o.recaps && isRecap(a)); }).map(function (a) { return a.id; });
  if (o.news) { S.silly = []; }
  S.refreshJob = job; J.save({ render: false });
  return R.run(S);
};

function setOf(arr) { var m = {}; (arr || []).forEach(function (x) { m[x] = 1; }); return m; }
function raceTime(job, id) { var e = job.events.find(function (x) { return x.kind === 'race' && x.id === id; }); return e ? e.t : Infinity; }
function sessTime(job, id) { var e = job.events.find(function (x) { return x.kind === 'session' && x.id === id; }); return e ? e.t : Infinity; }

// The league as it looked at moment t: only races, sessions, stories and posts from before then.
function viewAt(S, job, t) {
  var oldP = setOf(job.oldPosts), oldA = setOf(job.oldArts), V = Object.assign({}, S);
  V.races = S.races.filter(function (r) { return raceTime(job, r.id) <= t + 1000; });
  V.sessions = S.sessions.filter(function (x) { return sessTime(job, x.id) <= t + 1000; });
  V.articles = S.articles.filter(function (a) { return a.ts <= t + 60000 && !oldA[a.id]; }).sort(function (a, b) { return b.ts - a.ts; });
  V.posts = S.posts.filter(function (q) { return q.ts <= t + 60000 && !oldP[q.id]; });
  return V;
}
function mergeBack(S, V) {
  var pid = setOf(S.posts.map(function (q) { return q.id; })), aid = setOf(S.articles.map(function (a) { return a.id; }));
  V.posts.forEach(function (q) { if (!pid[q.id]) S.posts.push(q); });
  V.articles.filter(function (a) { return !aid[a.id]; }).reverse().forEach(function (a) { S.articles.unshift(a); });
  ['silly', 'interviews', 'fans', 'rep', 'media', 'ai'].forEach(function (k) { if (V[k] !== S[k]) S[k] = V[k]; });
}
// After a step: old things dated before the next step have been replaced, so they go.
function sweep(S, job, until) {
  var oldP = setOf(job.oldPosts), oldA = setOf(job.oldArts), goneA = {};
  S.articles = S.articles.filter(function (a) { if (oldA[a.id] && a.ts < until) { goneA[a.id] = a; return false; } return true; });
  Object.keys(goneA).forEach(function (id) { var a = goneA[id], nw = isRecap(a) && job.recapFor[a.raceId];
    S.posts.forEach(function (q) { if (q.ref && q.ref.type === 'article' && q.ref.id === id) q.ref = nw ? { type: 'article', id: nw } : a.raceId ? { type: 'race', id: a.raceId } : null; });
  });
  S.interviews = S.interviews.filter(function (iv) { return !goneA[iv.ref]; });
  S.posts = S.posts.filter(function (q) { return !(oldP[q.id] && q.ts < until); });
  job.oldPosts = job.oldPosts.filter(function (id) { return S.posts.some(function (q) { return q.id === id; }); });
  job.oldArts = job.oldArts.filter(function (id) { return !goneA[id]; });
}

async function doStep(S, job, e) {
  var o = job.opts, calls = [];
  var V = function () { return viewAt(S, job, e.t); };
  if (e.kind === 'session') {
    var sess = S.sessions.find(function (x) { return x.id === e.id; }); if (!sess) return;
    if (o.news) calls.push(async function () { var v = V(); await J.ai.newsCycle(v, { phase: 'pre', sid: sess.sid, only: job.newsDone[sess.sid] ? ['wire'] : null, at: e.t + 40 * 60000 }); job.newsDone[sess.sid] = 1; mergeBack(S, v); });
    if (o.posts && !e.oldChat) calls.push(async function () { var v = V(); await J.ai.sessionHype(v, sess, e.t + 12 * 60000); mergeBack(S, v); });
  } else if (e.kind === 'race') {
    var race = S.races.find(function (x) { return x.id === e.id; }); if (!race) return;
    if (o.recaps) calls.push(async function () { var v = V(); var res = await J.ai.articleDraft(v, { outlet: 'wire', race: race, headline: '', notes: '' }); res.reputation = []; var art = J.ai.applyArticle(v, res, { outlet: 'wire', raceId: race.id, replaceAutoFor: race.id, ts: e.t }); job.recapFor[race.id] = art.id; mergeBack(S, v); S.articles = S.articles.filter(function (a) { return !(a.auto && a.raceId === race.id); }); });
    if (o.news) calls.push(async function () { var v = V(); await J.ai.newsCycle(v, { phase: 'post', race: race, at: J.dated(S) ? 0 : e.t + 20 * 60000 }); mergeBack(S, v); });
    if (o.posts) calls.push(async function () {
      var v = V(), oldA = setOf(job.oldArts), story = S.articles.find(function (a) { return a.id === job.recapFor[race.id]; }) || S.articles.filter(function (a) { return isRecap(a) && a.raceId === race.id && !oldA[a.id]; })[0] || S.articles.filter(function (a) { return isRecap(a) && a.raceId === race.id; })[0] || null;
      var info = J.raceInfo(race), focus = [info.winner.driver]; if (info.mover) focus.push(info.mover.row.driver);
      await J.ai.threads(v, { facts: J.ai.raceFacts(v, race), story: story, focus: focus, race: true, at: e.t + 2 * 60000, ref: story ? { type: 'article', id: story.id } : { type: 'race', id: race.id }, task: J.ai.raceReactionTask(v, race) });
      mergeBack(S, v);
    });
  } else if (e.kind === 'week') {
    calls.push(async function () { var v = V(); await J.ai.chatter(v, { at: e.t }); mergeBack(S, v); });
  } else if (e.kind === 'react') {
    var a = S.articles.find(function (x) { return x.id === e.id; }); if (!a) return;
    calls.push(async function () {
      var v = V(), race = a.preSid ? null : S.races.find(function (r) { return r.id === a.raceId; });
      var facts = (a.preSid ? J.ai.sessionFacts(v, a.preSid) + '\n' : race ? J.ai.raceFacts(v, race) + '\n' : '') + 'THE ARTICLE (' + J.OUTLETS[a.outlet].name + '):\n' + a.headline + '\n' + (a.dek || '') + '\n' + a.body.slice(0, 3500);
      await J.ai.threads(v, { facts: facts, story: a, focus: a.tags || [], at: a.ts + 60000, race: !!race, ref: { type: 'article', id: a.id }, task: 'Write 4 to 6 threads reacting to THIS article. People quote it, argue with it, call it fake news, add context, or bring up something it left out. Keep every fact consistent with the article and the race data.' });
      mergeBack(S, v);
    });
  }
  for (var k = (e.done || 0); k < calls.length; k++) {
    if (R.stop) throw new Error('stopped');
    var tries = 0;
    for (;;) {
      try { await calls[k](); break; }
      catch (err) {
        if (++tries >= 2 || /quota|daily|limit|key|billing|permission/i.test(err.message)) throw err;
        R.msg = 'Retrying: ' + err.message; paint(); await wait(15000);
      }
    }
    e.done = k + 1; J.save({ render: false, quiet: true });
    await wait(PAUSE);
  }
}

R.run = async function (S) {
  var job = S.refreshJob; if (!job || R.running) return;
  if (!J.ai.hasKey()) { J.toast('Add your ' + J.ai.name() + ' key in Settings first.', true); return; }
  R.running = true; R.stop = false; R.err = ''; J.publisher.hold(true); paint();
  try {
    while (job.i < job.events.length) {
      var e = job.events[job.i]; R.label = e.label; R.msg = ''; paint();
      await doStep(S, job, e);
      var nx = job.events[job.i + 1]; sweep(S, job, nx ? nx.t : Infinity);
      job.i++; J.save({ render: false, quiet: true }); paint();
    }
    sweep(S, job, Infinity);
    J.trimThreads(S, 110);
    if (S.races.length) { try { await J.ai.outlooks(S); } catch (e2) { /* outlook commentary is optional */ } }
    delete S.refreshJob; R.label = ''; R.msg = 'Done.';
    J.toast('Refresh everything is done. Every post' + (job.opts.news ? ' and newsroom story' : '') + ' is rewritten.');
  } catch (err) {
    if (err.message === 'stopped') { R.msg = 'Stopped. Press Continue to pick up where it left off.'; J.toast('Stopped. You can continue later.'); }
    else { R.err = err.message; R.msg = 'Paused: ' + err.message + ' Press Continue to pick up where it left off (if Gemini\'s daily limit ran out, try tomorrow).'; J.toast('Refresh everything paused: ' + err.message, true); }
  }
  R.running = false; R.stop = false; J.publisher.hold(false); J.save({ render: false }); paint();
};

function paint() {
  var el = $('rfPanel'), job = J.S && J.S.refreshJob;
  if (el && R.running && job && el.querySelector('.rfbar') && !R.stop) { // while running, only the bar and the step text change, so Stop stays clickable
    var pct = Math.round(job.i / Math.max(1, job.events.length) * 100);
    el.querySelector('.rfbar i').style.width = pct + '%'; el.querySelector('.rfbar').setAttribute('aria-valuenow', pct);
    $('rfStep').textContent = 'Step ' + (job.i + 1) + ' of ' + job.events.length + ': ' + R.label + (R.msg ? '. ' + R.msg : '');
  } else if (el && J.S) el.outerHTML = J.refreshPanel(J.S);
  if (J.renderFoot) J.renderFoot();
} // only the panel redraws, the rest of the page stays put

// Garage Tools panel
J.refreshPanel = function (S) {
  var job = S.refreshJob, hasKey = J.ai.hasKey(), body;
  if (R.running && job) {
    var pct = Math.round(job.i / Math.max(1, job.events.length) * 100);
    body = '<div class="rfbar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>'
      + '<p class="fine" id="rfStep">Step ' + (job.i + 1) + ' of ' + job.events.length + ': ' + esc(R.label) + (R.msg ? '. ' + esc(R.msg) : '') + '</p>'
      + '<div class="inl"><button class="btn danger sm" data-act="rfStop"' + (R.stop ? ' disabled' : '') + '>' + (R.stop ? 'Stopping after this step...' : 'Stop') + '</button></div>';
  } else if (job) {
    body = '<p class="fine">' + (R.msg ? esc(R.msg) + ' ' : '') + 'Done ' + job.i + ' of ' + job.events.length + ' steps.</p>'
      + '<div class="inl"><button class="btn sm" data-act="rfGo"' + (hasKey ? '' : ' disabled') + '>Continue</button><button class="btn ghost sm" data-act="rfCancel">Cancel</button></div>'
      + '<p class="fine">Cancel keeps what is already rewritten and keeps the old posts and stories for the rest.</p>';
  } else {
    var p = R.plan(S, opts), mins = Math.max(1, Math.round(p.calls * (PAUSE / 1000 + 15) / 60));
    body = '<div class="inl rfopts">'
      + '<label><input type="checkbox" id="rfPosts"' + (opts.posts ? ' checked' : '') + '> Fan posts</label>'
      + '<label><input type="checkbox" id="rfNews"' + (opts.news ? ' checked' : '') + '> Newsroom stories (analysis, silly season, previews)</label>'
      + '<label><input type="checkbox" id="rfRecaps"' + (opts.recaps ? ' checked' : '') + '> Automatic race recaps</label></div>'
      + '<p class="fine">' + (R.msg ? esc(R.msg) + ' ' : '') + 'This season: ' + J.plural(p.events.length, 'step') + ', about ' + J.plural(p.calls, 'AI request') + ', roughly ' + J.plural(mins, 'minute') + '. Stories you wrote in Story Studio are never changed. Like always, the Garage keeps about the last four race weekends of chatter; older weekends keep the fan reactions to their stories.</p>'
      + '<div class="inl"><button class="btn sm" data-act="rfGo"' + (hasKey && p.events.length ? '' : ' disabled') + '>Refresh everything</button></div>';
  }
  return '<section class="panel" id="rfPanel"><h3>Refresh everything</h3><p class="sub">Rewrites the whole season with the newest AI style, from the first weekend to now, in order. Each weekend only knows what had happened by then, so early-season chatter sounds like early season. It saves after every step. If it stops (for example Gemini\'s free daily limit), press Continue later and it picks up where it left off. The website updates once at the end.</p>' + body + '</section>';
};
function readOpts() { ['posts', 'news', 'recaps'].forEach(function (k) { var el = $('rf' + k[0].toUpperCase() + k.slice(1)); if (el) opts[k] = el.checked; }); }
document.addEventListener('change', function (e) { if (e.target && /^rf(Posts|News|Recaps)$/.test(e.target.id)) { readOpts(); paint(); } });
J.acts.rfGo = function () {
  var S = J.S; if (R.running) return;
  if (S.refreshJob) { R.run(S); return; }
  readOpts(); if (!opts.posts && !opts.news && !opts.recaps) { J.toast('Pick at least one thing to refresh.', true); return; }
  var what = [opts.posts ? 'every fan post' : '', opts.news ? 'every newsroom story' : '', opts.recaps ? 'the automatic race recaps' : ''].filter(Boolean).join(', ');
  if (!confirm('This rewrites ' + what + ' for the whole season. The old ones are replaced as it goes. Want a copy of the old ones? Cancel, then use Download backup on the League page first. Start now?')) return;
  R.msg = ''; R.start(S, { posts: opts.posts, news: opts.news, recaps: opts.recaps });
};
J.acts.rfStop = function () { R.stop = true; paint(); };
J.acts.rfCancel = function () { var S = J.S; if (!confirm('Stop for good? What is already rewritten stays.')) return; delete S.refreshJob; R.msg = 'Cancelled.'; J.save({ render: false }); paint(); };
})();
