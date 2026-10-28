/* Jet's Sim Series - AI layer: Gemini (free) or Claude (paid) (commissioner app only; never published) */
(function () {
'use strict';
var J = window.JSS, AI = J.ai = {};
J.settings = J.settings || {};

/* ---------- network (Electron bridge when present, plain fetch otherwise) ---------- */
J.http = function (url, opts) {
  opts = opts || {};
  if (window.jssNative && window.jssNative.http) return window.jssNative.http({ url: url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
  return fetch(url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body }).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); });
};
AI.provider = function () { return J.settings.aiProvider === 'claude' ? 'claude' : 'gemini'; };
AI.name = function () { return AI.provider() === 'claude' ? 'Claude' : 'Gemini'; };
AI.hasKey = function () { var k = AI.provider() === 'claude' ? J.settings.apiKey : J.settings.geminiKey; return !!(k && String(k).trim().length > 10); };
AI.call = function (o) {
  if (!AI.hasKey()) return Promise.reject(new Error('Add your ' + AI.name() + ' key in Settings first.'));
  return AI.provider() === 'claude' ? claudeCall(o) : geminiCall(o);
};

/* ---------- Claude (Anthropic, paid) ---------- */
async function claudeCall(o) {
  var content = []; (o.images || []).forEach(function (im) { content.push({ type: 'image', source: { type: 'base64', media_type: im.type || 'image/jpeg', data: im.data } }); });
  content.push({ type: 'text', text: o.user });
  var model = o.role === 'chatter' ? (J.settings.chatterModel || J.settings.writerModel) : J.settings.writerModel;
  var body = { model: model || 'claude-sonnet-5-5', max_tokens: o.maxTokens || 4000, system: o.system, messages: [{ role: 'user', content: content }] };
  var r = await J.http('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': J.settings.apiKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
  var data; try { data = JSON.parse(r.text); } catch (e) { throw new Error('Claude sent back something unreadable (HTTP ' + r.status + ').'); }
  if (r.status !== 200) {
    var em = (data.error && data.error.message) || '', et = (data.error && data.error.type) || '';
    if (r.status === 401 || et === 'authentication_error') throw new Error('Your Claude key was not accepted. Check it in Settings.');
    if (/credit balance|billing/i.test(em)) throw new Error('Your Anthropic account is out of credit. Add credit at console.anthropic.com (Billing).');
    if (r.status === 429) throw new Error('Too many Claude requests at once. Wait a minute and try again.');
    if (r.status === 529 || r.status >= 500 || et === 'overloaded_error') throw new Error('Claude is busy right now (' + (em || 'server error') + '). Try again in a minute.');
    if (/model/i.test(em) && r.status === 404) throw new Error('That Claude model is not available. Pick another one in Settings.');
    throw new Error(em || ('Claude request failed (HTTP ' + r.status + ')'));
  }
  return (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
}

/* ---------- Gemini (Google, free tier) ---------- */
var GEM = 'https://generativelanguage.googleapis.com/v1beta/';
function gemHeaders() { return { 'content-type': 'application/json', 'x-goog-api-key': String(J.settings.geminiKey || '').trim() }; }
function gemError(r, data) {
  var e = (data && data.error) || {}, m = e.message || '', st = e.status || '';
  var err;
  if (/API key not valid|API_KEY_INVALID/i.test(m) || (r.status === 400 && /key/i.test(m))) err = 'Your Gemini key was not accepted. Copy it again from aistudio.google.com (Get API key) and paste it in Settings.';
  else if (r.status === 403 || st === 'PERMISSION_DENIED') err = 'Google says this key is not allowed to use Gemini. Make a new key at aistudio.google.com.';
  else if (r.status === 429 || st === 'RESOURCE_EXHAUSTED') err = 'You have used today\'s free Gemini requests. They reset overnight (about 3 AM Eastern). Try again tomorrow.';
  else if (r.status >= 500) err = 'Gemini is busy right now. Try again in a few minutes.';
  else if (r.status === 404) err = 'That Gemini model is not available any more. Click Test key in Settings and the app will pick a new one.';
  else if (r.status === 0) err = 'Could not reach Google. Check your internet connection.';
  else err = 'Gemini problem (' + r.status + '): ' + (m || 'unknown error');
  var x = new Error(err); x.status = r.status; x.gstatus = st; return x;
}
AI.geminiModels = async function () {
  var all = [], token = '';
  for (var i = 0; i < 5; i++) {
    var r = await J.http(GEM + 'models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { method: 'GET', headers: gemHeaders() });
    var data = null; try { data = JSON.parse(r.text); } catch (e) {}
    if (r.status !== 200) throw gemError(r, data);
    (data.models || []).forEach(function (m) { if ((m.supportedGenerationMethods || []).indexOf('generateContent') >= 0) all.push({ id: String(m.name).replace(/^models\//, ''), label: m.displayName || m.name }); });
    token = data.nextPageToken; if (!token) break;
  }
  return all;
};
function gemScore(id) {
  var v = id.match(/gemini-(\d+(?:\.\d+)?)/), ver = v ? parseFloat(v[1]) : 0;
  return ver * 10 + (/preview|exp/.test(id) ? 0 : 3) + (/-\d{3,}$|-\d{2}-\d{2}/.test(id) ? -1 : 0);
}
var GEM_SKIP = /(tts|image|live|audio|embed|native|robotics|computer|omni|veo|imagen|thinking-exp|learnlm|gemma|aqa|nano)/i;
AI.geminiPickModels = async function () {
  var list = await AI.geminiModels(), s = J.settings;
  var flash = list.filter(function (m) { return /flash/i.test(m.id) && !GEM_SKIP.test(m.id); });
  var full = flash.filter(function (m) { return !/lite/i.test(m.id); }).sort(function (a, b) { return gemScore(b.id) - gemScore(a.id); });
  var lite = flash.filter(function (m) { return /lite/i.test(m.id); }).sort(function (a, b) { return gemScore(b.id) - gemScore(a.id); });
  if (!full.length && !lite.length) throw new Error('Your Gemini key works, but Google did not offer any Flash models to it. Try again later.');
  s.geminiList = full.concat(lite).map(function (m) { return { id: m.id, label: m.label }; });
  if (!s.geminiModel || !s.geminiList.some(function (m) { return m.id === s.geminiModel; })) s.geminiModel = (full[0] || lite[0]).id;
  s.geminiLite = (lite[0] || full[0]).id;
  if (J.saveSettings) await J.saveSettings();
  return s.geminiModel;
};
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
/* Try the chosen model first; if Google says it is busy or out of free requests, quietly try the others. */
async function geminiCall(o) {
  var s = J.settings;
  if (!s.geminiModel) await AI.geminiPickModels();
  var order = [s.geminiModel, s.geminiLite].concat((s.geminiList || []).map(function (m) { return m.id; }));
  var seen = {}, models = order.filter(function (m) { if (!m || seen[m]) return false; seen[m] = 1; return true; }).slice(0, 5);
  var lastErr = null, busyRetried = false, repicked = false, plain = false;
  for (var i = 0; i < models.length; i++) {
    try { return await geminiOnce(o, models[i], plain); }
    catch (e) {
      lastErr = e;
      if (e.status === 400 && e.gmsg && /mime|response_?mime|json/i.test(e.gmsg) && !plain) { plain = true; i--; continue; }
      if (e.status === 404 && !repicked) { repicked = true; s.geminiModel = ''; await AI.geminiPickModels(); return geminiCall(o); }
      if (e.status >= 500 && !busyRetried) { busyRetried = true; await sleep(2500); i--; continue; }
      if (e.status >= 500 || e.status === 429 || e.status === 404 || e.gstatus === 'RESOURCE_EXHAUSTED') continue;
      throw e;
    }
  }
  if (lastErr && lastErr.status >= 500 && lastErr.gmsg) lastErr.message += ' (Google said: ' + lastErr.gmsg.slice(0, 160) + ')';
  throw lastErr || new Error('Gemini did not answer. Try again in a minute.');
}
async function geminiOnce(o, model, plain) {
  var parts = []; (o.images || []).forEach(function (im) { parts.push({ inline_data: { mime_type: im.type || 'image/jpeg', data: im.data } }); });
  parts.push({ text: o.user });
  var gen = { maxOutputTokens: Math.max(8192, (o.maxTokens || 4000) * 2), temperature: 1 };
  if (o.json && !plain) gen.responseMimeType = 'application/json';
  var body = { systemInstruction: { parts: [{ text: o.system }] }, contents: [{ role: 'user', parts: parts }], generationConfig: gen };
  var r = await J.http(GEM + 'models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: gemHeaders(), body: JSON.stringify(body) });
  var data = null; try { data = JSON.parse(r.text); } catch (e) {}
  if (r.status !== 200) { var err = gemError(r, data); err.gmsg = (data && data.error && data.error.message) || String(r.text || '').slice(0, 200); err.model = model; throw err; }
  var c = (data.candidates || [])[0];
  if (!c) { var br = data.promptFeedback && data.promptFeedback.blockReason; throw new Error(br ? 'Gemini refused this one (' + br + '). Try rewording the headline or notes.' : 'Gemini sent back nothing. Try again.'); }
  var text = ((c.content && c.content.parts) || []).filter(function (p) { return !p.thought && p.text; }).map(function (p) { return p.text; }).join('');
  if (!text) throw new Error(c.finishReason === 'SAFETY' ? 'Gemini\'s safety filter blocked this one. Try rewording it.' : c.finishReason === 'MAX_TOKENS' ? 'Gemini ran out of room before finishing. Try again.' : 'Gemini sent back an empty answer. Try again.');
  AI.lastModel = model;
  return text;
}

function parseJson(t) { t = String(t).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim(); var a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('no json'); return JSON.parse(t.slice(a, b + 1)); }
AI.json = async function (o) {
  o = Object.assign({ json: true }, o);
  var txt = await AI.call(o);
  try { return parseJson(txt); } catch (e) {
    txt = await AI.call(Object.assign({}, o, { user: o.user + '\n\nYour last reply was not valid JSON. Reply again with ONLY the JSON object, nothing before or after it.' }));
    try { return parseJson(txt); } catch (e2) { throw new Error(AI.name() + ' did not send back a usable answer. Try again.'); }
  }
};
AI.test = async function () {
  if (AI.provider() === 'gemini') await AI.geminiPickModels();
  var t = await AI.call({ system: 'Reply with the single word OK.', user: 'ping', maxTokens: 20 }); return /ok/i.test(t);
};

/* ---------- fan roster: realistic usernames, ages, stances ---------- */
var FIRSTS = {
  teen: ['jace', 'kaden', 'mila', 'brynn', 'colt', 'aiden', 'rylee', 'maddox', 'kenzie', 'tyson', 'hayden', 'cam', 'jaxon', 'lexi'],
  young: ['Tyler', 'Brandon', 'Kayla', 'Dylan', 'Jordan', 'Chelsea', 'Cody', 'Mitch', 'Alyssa', 'Trent', 'Derek', 'Hannah', 'Ricky', 'Morgan'],
  adult: ['Greg', 'Donna', 'Mike', 'Tammy', 'Steve', 'Rob', 'Kelly', 'Jason', 'Heather', 'Scott', 'Dave', 'Brian', 'Lisa', 'Chad'],
  oldhead: ['Don', 'Ron', 'Bill', 'Gary', 'Larry', 'Earl', 'Wayne', 'Carl', 'Janet', 'Ray', 'Dale', 'Jim', 'Bobby', 'Linda']
};
var SURN = ['Hutchins', 'Pruitt', 'Maddox', 'Tillman', 'Beasley', 'Garrison', 'Wickham', 'Dunbar', 'Keller', 'Stroud', 'Pickett', 'Haskins', 'Mabry', 'Lindqvist', 'Okafor', 'Reyes', 'Novak', 'Brennan', 'Castillo', 'Hawkins'];
var ADJ = ['slow', 'dirty', 'loose', 'tight', 'late', 'sketchy', 'salty', 'lapped', 'green', 'cold', 'lucky', 'wrecked', 'tired', 'wild'];
var NOUN = ['pitcrew', 'restart', 'apron', 'draft', 'tires', 'fuel', 'splitter', 'pack', 'wall', 'groove', 'spotter', 'caution', 'bumper', 'stage'];
var TRACKS = ['Talladega', 'Bristol', 'Darlington', 'Martinsville', 'Daytona', 'Rockingham', 'Dover', 'Pocono', 'Charlotte'];
var JOBS = ['Weekend', 'Backyard', 'Garage', 'GrillMaster', 'Couch', 'Sunday'];
var COLORS = ['#0a1f44', '#1f4fb4', '#e3202c', '#b88a00', '#2c7a4b', '#6b3fa0', '#0f6e80', '#9a4a1a', '#5a6784', '#b03060'];
var QUIRKS = {
  teen: ['types in all lowercase with almost no punctuation', 'posts like a reaction image: ultra short', 'stan-account energy for their driver', 'uses a skull emoji now and then', 'gets dramatic fast', 'says "bro" and "fr" sparingly'],
  young: ['sarcastic, group-chat humor', 'has a fantasy lineup and a bet riding on it', 'complains about the broadcast and strategy calls', 'swears mildly (damn, hell, shit)', 'quote-tweet energy, loves a dunk', 'posts hungover on race day'],
  adult: ['dad energy, watches with their kid or their own dad', 'obsessed with pit strategy and fuel mileage', 'grumbles about officiating, dry humor', 'writes full sentences and signs off with a shrug', 'mentions work on Monday or the grill', 'tries to be the reasonable one'],
  oldhead: ['nostalgic: compares everything to the old days', 'complains the cars all look the same and there are too many cautions', 'types sloppy: ellipses, random CAPS, missing punctuation', 'sometimes signs off with their first initial, like "- D"', 'grudge against the points format', 'loves the sport and will defend it to the end']
};
function weighted(rand, items, w) { var t = w.reduce(function (a, b) { return a + b; }, 0), r = rand() * t; for (var i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
function clean(h) { return String(h).replace(/[^A-Za-z0-9_.]/g, '').slice(0, 24); }
function handleFor(age, level, drv, rand, first) {
  var L = J.lastName(drv ? drv.name : '').replace(/[^A-Za-z]/g, ''), l = L.toLowerCase(), c = (drv && drv.car) || '';
  var n = 10 + Math.floor(rand() * 89), P = function (a) { return J.pick(rand, a); };
  if (drv && level === 2) return P([L + 'Nation', L + '_Army', 'all_in_on_' + c, c + '_forever', L + 'Szn', 'team' + L, l + '_truther']);
  if (drv && level === -2) return P(['AnybodyBut' + L, L + 'IsDone', 'fire' + L, 'cant_stand_' + l, 'NotA' + L + 'Guy']);
  if (drv && level === -1 && rand() < 0.5) return P([L + 'Fumbles', l + '_overrated', 'no' + l + 'please']);
  if (drv && level === 1 && rand() < 0.4) return P([first + '_' + c + 'fan', l + 'fan' + n, c + 'Guy' + n]);
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  if (age === 'teen') return P([P(ADJ) + P(NOUN) + P(['07', '08', '09', '10']), first + '.edits', 'lil' + first, P(NOUN) + '_' + n, first + 'racing' + P(['08', '09', '07']), 'its' + cap(first)]);
  if (age === 'young') return P([P(ADJ) + '_' + P(NOUN), P(NOUN) + n, 'lap' + n + P(NOUN), cap(P(ADJ)) + cap(P(NOUN)) + n, first.toLowerCase() + '_on_the_apron', first + P(SURN).slice(0, 3) + n]);
  if (age === 'adult') return P([P(JOBS) + P(['Wrench', 'CrewChief', 'Racer', 'Spotter']) + first, first + P(SURN) + n, 'Dad' + cap(P(NOUN)), first + '_' + P(TRACKS).toLowerCase() + n, P(SURN) + 'Racing' + n]);
  return P([first + P(SURN), P(TRACKS) + first, 'OldSchool' + first, first + '_' + (1948 + Math.floor(rand() * 18)), first + P(SURN).slice(0, 1) + '1957', 'Rt' + (1 + Math.floor(rand() * 90)) + 'Racer']);
}
function displayName(age, handle, rand, f) {
  var s = J.pick(rand, SURN); f = f.charAt(0).toUpperCase() + f.slice(1);
  if (age === 'teen') return rand() < 0.5 ? f.toLowerCase() : handle;
  if (age === 'young') return rand() < 0.5 ? f + ' ' + s.charAt(0) : handle.replace(/[_.]/g, ' ');
  if (age === 'adult') return f + ' ' + s.charAt(0) + '.';
  return f + ' ' + s;
}
AI.ensureFans = function (S) {
  var ds = J.agg(S.races); if (!ds.length) return false;
  var target = Math.min(58, Math.max(36, ds.length + 12)), rand = J.rng('fans' + S.id + S.fans.length), used = {}, guard = 0;
  var usedName = {}; S.fans.forEach(function (f) { used[f.handle.toLowerCase()] = 1; usedName[String(f.name).toLowerCase()] = 1; });
  while (S.fans.length < target && guard++ < 500) {
    var age = weighted(rand, ['teen', 'young', 'adult', 'oldhead'], [12, 34, 32, 22]);
    var platform = rand() < (age === 'teen' ? 0.9 : age === 'oldhead' ? 0.45 : 0.62) ? 'x' : 'forum';
    var hasStance = rand() < 0.66, drv = null, level = 0;
    if (hasStance) {
      drv = weighted(rand, ds, ds.map(function (d, i) { return i < 3 ? 5 : i < 8 ? 3 : 1; }));
      level = weighted(rand, [2, 1, -1, -2], [22, 40, 26, 12]);
    }
    var first = J.pick(rand, FIRSTS[age]);
    var h = clean(handleFor(age, level, drv, rand, first)); if (h.length < 4 || used[h.toLowerCase()]) continue;
    var dn = displayName(age, h, rand, first); if (usedName[dn.toLowerCase()]) dn = h; used[h.toLowerCase()] = 1; usedName[dn.toLowerCase()] = 1;
    var q = J.shuffle(QUIRKS[age], rand).slice(0, 2);
    S.fans.push({ id: 'f' + (S.fans.length + 1) + J.uid('').slice(-3), handle: h, name: dn, platform: platform, age: age, color: J.pick(rand, COLORS), quirks: q.join('; '), stance: drv ? { driver: drv.key, level: level, seen: (S.rep[drv.key] ? S.rep[drv.key].events.length : 0) } : { driver: null, level: 0, seen: 0 } });
  }
  return true;
};

/* ---------- context builders ---------- */
function standingsText(S, n) { return J.agg(S.races).slice(0, n || 10).map(function (d, i) { return (i + 1) + '. ' + d.name + ' ' + d.pts + ' pts' + (d.wins ? ' (' + d.wins + (d.wins === 1 ? ' win' : ' wins') + ')' : ''); }).join('; '); }
AI.raceFacts = function (S, race) {
  var info = J.raceInfo(race), m = race.meta || {}, lines = [];
  var total = Math.max(S.schedule.length, S.races.length), idx = S.races.indexOf(race) + 1;
  lines.push('Race ' + idx + ' of ' + total + ': ' + race.name + (race.track ? ' at ' + race.track : '') + ' (' + J.TYPES[J.raceType(S, race)].toLowerCase() + ')' + (race.date ? ', ' + race.date : '') + '. ' + info.rows.length + ' starters' + (info.laps ? ', ' + info.laps + ' laps' : '') + '.');
  var bits = []; if (m.weather) bits.push('Weather ' + m.weather); if (m.cautions != null) bits.push(m.cautions + ' cautions'); if (m.leadChanges != null) bits.push(m.leadChanges + ' lead changes among ' + (m.leadDrivers || '?') + ' drivers'); if (m.pole) bits.push('Pole: ' + m.pole + (info.poleRow ? ' (finished P' + info.poleRow.position + ')' : ''));
  if (bits.length) lines.push(bits.join('. ') + '.');
  lines.push('Finish order (pos #car driver, started, laps led, status): ' + info.rows.slice(0, 15).map(function (r) { return r.position + ' #' + r.car + ' ' + r.driver + ' (st ' + (r.start || '?') + ', led ' + (r.lapsLed || 0) + (J.isDnf(r) ? ', ' + r.status : '') + ')'; }).join('; '));
  if (info.mover && info.mover.gain >= 6) lines.push('Biggest mover: ' + info.mover.row.driver + ' from P' + info.mover.row.start + ' to P' + info.mover.row.position + '.');
  if (info.dnfs.length) lines.push('Did not finish or dropped out: ' + info.dnfs.map(function (r) { return r.driver + ' (' + r.status + ')'; }).join(', ') + '.');
  if (info.margin != null) lines.push('Margin of victory: ' + info.margin.toFixed(3) + ' seconds.');
  lines.push('Points standings now: ' + standingsText(S, 10) + '.');
  return lines.join('\n');
};
function repText(S) {
  var out = []; J.agg(S.races).slice(0, 14).forEach(function (d) { var r = J.repOf(S, d.key); out.push(d.name + ' ' + r.score + (r.events[0] ? ' (latest: ' + (r.events[0].delta > 0 ? '+' : '') + r.events[0].delta + ' ' + r.events[0].why + ')' : '')); });
  return out.join('; ');
}
function personaLine(S, f) {
  var st = f.stance || {}, nm = st.driver ? ((J.agg(S.races).find(function (d) { return d.key === st.driver; }) || {}).name || st.driver) : null;
  return f.id + ' | ' + (f.platform === 'forum' ? 'u/' : '@') + f.handle + ' | ' + f.platform + ' | ' + f.age + ' | ' + (nm && st.level ? J.STANCE[st.level] + ' of ' + nm : 'no strong driver') + ' | ' + f.quirks;
}

/* ---------- Garage: threads ---------- */
var FAN_STYLE = 'HOW REAL NASCAR FANS ACTUALLY WRITE\n'
  + 'You are ghostwriting ordinary people typing about a race. Nobody should be able to tell an AI wrote it.\n\n'
  + 'Voices by age:\n'
  + '- Teens (13-19): lowercase, quick, barely punctuated. Driver stan culture, edits, ratio jokes. Slang in small doses (bro, fr, ngl, lowkey). Often 3 to 12 words. Easily dramatic. An occasional skull emoji.\n'
  + '- Young adults (20-34): sarcastic, group-chat humor, quote-tweet energy. Fantasy lineups, betting slips, hangovers, complaints about the broadcast. Mild swearing (damn, hell, ass, shit). They call out dumb strategy.\n'
  + '- Adults (35-55): measured but stubborn. Dad energy, watching with their kid or their own dad, the grill, work on Monday. Talk fuel mileage, tire wear, pit stops, officiating. Dry humor. Full sentences.\n'
  + '- Old-heads (56+): nostalgic and grumpy. The cars all look the same, too many cautions, "back when" comparisons, grudges against the points format. Sloppy typing: ellipses, random CAPS, missing punctuation, sign-offs with their first initial. Still love the sport and defend it.\n'
  + 'Forum posts (reddit style) run longer, can have a title, and people add corrections ("it was lap 21, not 22"), sarcasm, "this", "came here to say this". Upvote-bait takes get pushback.\n\n'
  + 'Stance (shown next to the username on the site, so every post must be consistent with it):\n'
  + '- superfan: blind loyalty, defends everything, denies the obvious, brings their driver up even off topic.\n'
  + '- fan: supportive, can admit a mistake.\n'
  + '- hater: dry and snarky, enjoys the driver having a bad day, credits them grudgingly.\n'
  + '- superhater: relentless, celebrates every setback, picks fights with that driver\'s fans.\n'
  + 'Haters rip the DRIVING and the results. Never someone\'s family, looks, health or real life. No slurs, no threats, no harassment.\n\n'
  + 'Rules that matter:\n'
  + '1. Real arguments. At least two threads need people disagreeing, and at least one reply chain needs two people going back and forth three or more times. Fans of a driver and haters of that same driver should collide.\n'
  + '2. Use specifics from the FACTS (positions, laps led, who got loose, points gaps). Never invent results, lap numbers or events.\n'
  + '3. Wildly uneven lengths. Some replies are 1 to 4 words ("this", "lmao no", "sure Jan"). A few run 3 to 4 sentences.\n'
  + '4. Never open two posts the same way. Never reuse a phrase. Do not echo the headline.\n'
  + '5. Banned cliches: cooking, cooked, no crumbs, masterclass, chef\'s kiss, no notes, hot potato, buckle up, hold my beer, let\'s go, W driver, rent free, this is the way, "chaos? yes". Almost no exclamation marks unless an angry old-head or a teen would. Zero or one emoji per post. Hashtags almost never. No em dashes.\n'
  + '6. Typos and sloppy grammar are fine where the persona would make them. Not everyone is witty. Some people just say something boring.\n'
  + '7. Not every post is about the winner. Some are about a wreck, the broadcast, an unrelated driver, their own bad day, fantasy, a tire.\n'
  + '8. Prominent accounts keep their own voice: Ray Calloway (reporter: factual, short, breaks quotes and facts), Tommy Bishop (YouTuber: loud, big opinions, plugs his next video), Dana Whitfield (analyst: numbers, tire falloff, polite but pointed), Big Lou Marchetti (radio host: old school, tells a story, mildly grumpy). Fans reply to them, argue with them and quote them.\n'
  + 'This is a simulated sim-racing league. Everything stays on the racing.';
var THREAD_SCHEMA = 'Return ONLY JSON: {"threads":[{"platform":"x" or "forum","title":"forum threads only","posts":[{"by":"<persona id or ray|tommy|dana|lou>","text":"...","replyTo":null or <index of an earlier post in this thread>}]}]}\nThe first post of every thread has replyTo null. Every other post replies to an earlier post by index.';

AI.threads = async function (S, o) {
  AI.ensureFans(S); if (!S.fans.length) throw new Error('Import a race first so there are drivers for the fans to talk about.');
  var rand = J.rng('pick' + Date.now()), ds = J.agg(S.races);
  var focus = {}; (o.focus || []).forEach(function (n) { var d = J.findDriver(S, n); if (d) focus[d.key] = 1; });
  var fans = S.fans.slice(), pri = fans.filter(function (f) { return f.stance && focus[f.stance.driver]; }), rest = J.shuffle(fans.filter(function (f) { return !(f.stance && focus[f.stance.driver]); }), rand);
  var chosen = J.shuffle(pri, rand).slice(0, 14).concat(rest).slice(0, 28);
  var recent = S.posts.slice(-14).map(function (p) { return '- ' + p.text.slice(0, 110); }).join('\n');
  var lastRace = S.races[S.races.length - 1], extra = [];
  if (lastRace) {
    var shown = {}; J.raceInfo(lastRace).rows.slice(0, 15).forEach(function (r) { shown[J.driverKey(r.driver)] = 1; });
    var want = {}; chosen.forEach(function (f) { if (f.stance && f.stance.driver && !shown[f.stance.driver]) want[f.stance.driver] = 1; });
    lastRace.rows.forEach(function (r) { var k = J.driverKey(r.driver); if (want[k]) extra.push(r.driver + ' finished P' + r.position + ' (started P' + (r.start || '?') + (J.isDnf(r) ? ', ' + r.status : '') + (r.interval && /(\d+)\s*l/i.test(r.interval) ? ', ' + (function (n) { return n + (n === '1' ? ' lap' : ' laps'); })(r.interval.match(/(\d+)\s*l/i)[1]) + ' down' : '') + ')'); });
  }
  var user = 'LEAGUE: ' + S.league.name + ' (' + S.series.label + '), ' + J.seasonYear(S) + ' season. Races run: ' + S.races.length + ' of ' + Math.max(S.schedule.length, S.races.length) + '.\n\n'
    + 'FACTS (use only these):\n' + o.facts + (extra.length ? '\nOther drivers the fans below follow, last race: ' + extra.join('; ') + '.' : '') + '\n\n' + (o.story ? 'THE STORY EVERYONE IS REACTING TO: "' + o.story.headline + '" - ' + (o.story.dek || '') + '\n\n' : '')
    + 'DRIVER REPUTATION (0-100, higher = more liked): ' + repText(S) + '\n\n'
    + (recent ? 'RECENT POSTS ALREADY ON THE SITE (do not repeat their wording or jokes):\n' + recent + '\n\n' : '')
    + 'FANS YOU MAY WRITE AS (id | handle | platform | age | stance | quirks):\n' + chosen.map(function (f) { return personaLine(S, f); }).join('\n') + '\n\n'
    + 'PROMINENT ACCOUNTS: ' + Object.keys(J.FIGURES).map(function (k) { return k + ' = ' + J.FIGURES[k].name + ' (' + J.FIGURES[k].badge.toLowerCase() + ')'; }).join('; ') + '\n\n'
    + 'TASK: ' + (o.task || 'Write 6 to 8 threads reacting to the facts and the story.') + ' About two thirds should be platform "x" (3 to 6 posts each), the rest "forum" (4 to 8 posts with comment chains). Use at least 14 different people. Use each prominent account at least once. Every fan\'s stance must show in how they talk about that driver.\n\n' + THREAD_SCHEMA;
  var res = await AI.json({ system: FAN_STYLE, user: user, role: 'chatter', maxTokens: 8000 });
  return AI.applyThreads(S, res, o.ref);
};
AI.applyThreads = function (S, res, ref) {
  var now = Date.now(), added = 0, ok = {}; S.fans.forEach(function (f) { ok[f.id] = f; });
  (res.threads || []).forEach(function (th, ti) {
    var plat = th.platform === 'forum' ? 'forum' : 'x', tid = J.uid('t'), t0 = now - (2 + ti * (3 + Math.floor(Math.random() * 9))) * 60000, ids = [], clock = t0;
    (th.posts || []).forEach(function (p, pi) {
      var by = null, text = String(p.text || '').trim(); if (!text) return;
      if (J.FIGURES[p.by]) by = { type: 'figure', id: p.by }; else if (ok[p.by]) by = { type: 'fan', id: p.by }; else return;
      var parent = null; if (pi > 0) { var pr = p.replyTo; parent = (typeof pr === 'number' && ids[pr]) ? ids[pr] : (ids[0] || null); } else if (ids.length) return;
      text = text.slice(0, plat === 'forum' ? 1400 : 560); clock += (1 + Math.floor(Math.random() * 6)) * 60000; if (clock > now) clock = now - Math.floor(Math.random() * 40000);
      var id = J.uid('p'); ids[pi] = id;
      S.posts.push({ id: id, thread: tid, parent: parent, platform: plat, title: pi === 0 && plat === 'forum' ? String(th.title || '').slice(0, 140) : '', by: by, text: text, ts: clock, ref: ref || null }); added++;
    });
  });
  var ths = J.threadsOf(S); if (ths.length > 70) { var keep = {}; ths.slice(0, 70).forEach(function (t) { keep[t.id] = 1; }); S.posts = S.posts.filter(function (p) { return keep[p.thread]; }); }
  return added;
};

/* ---------- News: articles, interviews, reputation ---------- */
var NEWS_RULES = 'How to write: specific, plain, grounded. Lead with the news. Short paragraphs, varied sentence length, real numbers from the data. Sound like a working motorsports journalist, not a press release. No em dashes. Do not use: testament, tapestry, rollercoaster, "in a thrilling", "edge of their seats", "the stage was set", masterclass, unleashed, "only time will tell". Never invent results, lap counts or events that are not in the data or the commissioner\'s notes.';
var OUTLET_VOICE = {
  wire: 'Straight race coverage. Inverted pyramid: the result and the key moment first, then how it happened, then the points picture, then what is next. 450 to 650 words. Past tense.',
  silly: 'Driver market, contracts and rides (silly season). Sourcing language like "per a team source", "expected to" and "has not been confirmed" is fine as league fiction, but ONLY for moves the commissioner\'s headline and notes describe. Do not add other deals, dollar amounts or other drivers\' moves. Explain what it means for the team, the points race and next season. 350 to 550 words. Slightly gossipy and sharp.',
  notes: 'Analysis and features. Pick one angle the data supports (momentum, a rivalry, a track-type trend, points-race math) and argue it. 500 to 750 words. Conversational but informed. You may use a few subhead lines that start with "## ".'
};
function newsSystem(S, outlet) {
  var o = J.OUTLETS[outlet] || J.OUTLETS.wire;
  return 'You are a staff writer at ' + o.name + ' (' + o.tag + '), covering "' + S.league.name + '", a SIMULATED ' + S.series.label + ' league run in NASCAR Racing 2003. The drivers are the league\'s sim drivers. Everything is fiction for a sim-racing fan site: keep it on the racing and the league. Nothing about real-world personal details, politics, family, health or private life.\n\n'
    + OUTLET_VOICE[outlet] + '\n\n' + NEWS_RULES + '\n\n'
    + 'Quotes: the only quotes you may put in the article are ones you also list in "interviews". Those are fictional pit road quotes by Ray Calloway\'s interviews: clipped racer talk, 1 to 3 sentences, sometimes salty, sometimes humble, always about the racing. If images are attached they are sim screenshots or race footage frames: describe only what you can actually see or what the commissioner told you, and never identify anyone by their face.';
}
var NEWS_SCHEMA = 'Return ONLY JSON: {"article":{"headline":"...","dek":"one sentence","body":"paragraphs separated by a blank line","tags":["Driver Name"],"photoCaptions":["caption for image 1","..."]},"interviews":[{"driver":"Full Name as in standings","quote":"...","tone":"gracious|salty|cocky|humble|fired up|frustrated","repDelta":-6 to 6,"why":"short reason fans would react"}],"reputation":[{"driver":"Full Name","delta":-8 to 8,"why":"the on-track moment that changed how fans see them"}]}\nreputation is for on-track moments (clean pass for the win, a block, a wreck someone caused, good sportsmanship). Mostly small numbers (1 to 4), rarely 6 or more. Leave arrays empty if nothing applies.';

AI.articleDraft = async function (S, o) {
  var outlet = o.outlet || 'wire', race = o.race || null, parts = [];
  parts.push('LEAGUE STANDINGS NOW: ' + (standingsText(S, 12) || 'no races run yet') + '.');
  if (race) parts.push('RACE DATA:\n' + AI.raceFacts(S, race));
  if (o.headline) parts.push('COMMISSIONER\'S WORKING HEADLINE (this is the topic; keep its meaning, you may sharpen the wording): ' + o.headline);
  if (o.notes) parts.push('COMMISSIONER\'S NOTES (facts you may use):\n' + o.notes);
  if (o.images && o.images.length) parts.push(o.images.length + ' image(s) are attached in this order: ' + o.images.map(function (im, i) { return (i + 1) + '=' + (im.label || 'untitled'); }).join(', ') + '. Add one caption per image in photoCaptions.');
  parts.push('DRIVER REPUTATION RIGHT NOW (0-100): ' + repText(S));
  parts.push('Write the story now. ' + (o.interviews === false ? 'Return an empty interviews array.' : 'Include 2 to 3 pit road interviews tied to the story.') + '\n\n' + NEWS_SCHEMA);
  return AI.json({ system: newsSystem(S, outlet), user: parts.join('\n\n'), images: o.images || [], role: 'writer', maxTokens: 5000 });
};
AI.article = async function (S, o) {
  var res = await AI.articleDraft(S, o), race = o.race || null;
  return AI.applyArticle(S, res, { outlet: o.outlet || 'wire', raceId: race ? race.id : '', media: o.mediaIds || [], replaceAutoFor: race ? race.id : null });
};
AI.applyArticle = function (S, res, o) {
  var a = res.article || {}; if (!a.headline || !a.body) throw new Error(AI.name() + ' returned a story without a headline or body.');
  var staff = (J.OUTLETS[o.outlet] || J.OUTLETS.wire).staff, now = Date.now();
  var art = { id: J.uid('a'), outlet: o.outlet, headline: String(a.headline).slice(0, 160), dek: String(a.dek || '').slice(0, 260), body: String(a.body), author: staff[Math.floor(Math.random() * staff.length)], ts: now, raceId: o.raceId || '', tags: (a.tags || []).slice(0, 6).map(String), media: o.media || [] };
  if (o.replaceAutoFor) S.articles = S.articles.filter(function (x) { return !(x.auto && x.raceId === o.replaceAutoFor); });
  (a.photoCaptions || []).forEach(function (c, i) { var m = S.media.find(function (x) { return x.id === (o.media || [])[i]; }); if (m && c && !m.caption) m.caption = String(c).slice(0, 200); });
  S.articles.unshift(art);
  (res.interviews || []).slice(0, 4).forEach(function (iv) {
    var d = J.findDriver(S, iv.driver); if (!d || !iv.quote) return;
    S.interviews.unshift({ id: J.uid('i'), ts: now, driver: d.name, quote: String(iv.quote).slice(0, 360), tone: String(iv.tone || ''), ref: art.id, raceId: o.raceId || '' });
    J.repApply(S, d.name, iv.repDelta, iv.why || ('Pit road: ' + iv.tone), 'interview', art.id);
  });
  S.interviews = S.interviews.slice(0, 40);
  (res.reputation || []).slice(0, 8).forEach(function (r) { J.repApply(S, r.driver, r.delta, r.why, 'track', art.id); });
  S.articles = S.articles.slice(0, 160);
  return art;
};

/* ---------- outlook commentary (numbers come from the engine, words from Claude) ---------- */
AI.outlooks = async function (S) {
  var co = J.chaseOutlook(S), ro = J.raceOutlook(S), so = J.seasonOutlook(S); if (!co) throw new Error('Not enough results yet for outlooks.');
  var p = function (x) { return Math.round(x * 100) + '%'; };
  var user = 'LEAGUE: ' + S.league.name + ' (' + S.series.label + '). Races run ' + S.races.length + ' of ' + Math.max(S.schedule.length, S.races.length) + '. ' + S.chase.name + ' takes the top ' + S.chase.size + ' after race ' + S.chase.regularRaces + '.\n\n'
    + (S.chase.winLocks ? 'A race win locks a driver into ' + S.chase.name + ' (as long as there are not more winners than spots). ' : '') + (S.races.length < 4 ? 'EARLY SEASON: only ' + S.races.length + ' race(s) run, so the model has very little to go on and most odds are close together. Say so plainly instead of overreading the numbers. ' : '') + '\n\n'
    + 'CHASE ODDS (from 2,500 simulated seasons): ' + co.rows.slice(0, 22).map(function (r) { return r.name + ' ' + r.curPts + ' pts, ' + p(r.chaseOdds) + (r.best.length ? ', best at ' + r.best.map(function (t) { return J.TYPES[t].toLowerCase(); }).join('/') : ''); }).join('; ') + '\n\n'
    + (ro && ro.favorites ? 'NEXT RACE: ' + ro.next.name + ' at ' + (ro.next.track || 'TBD') + ' (' + J.TYPES[ro.type].toLowerCase() + '). Win odds: ' + ro.rows.slice(0, 8).map(function (r) { return r.name + ' ' + p(r.win); }).join('; ') + '. Should run well: ' + ro.shouldRunWell.map(function (r) { return r.name; }).join(', ') + '. Dark horses: ' + (ro.darkHorses.map(function (r) { return r.name; }).join(', ') || 'none yet (not enough races at this kind of track)') + '. Not expected up front: ' + ro.notUpFront.map(function (r) { return r.name; }).join(', ') + '. Highest wreck risk: ' + ro.wreckRisk.map(function (r) { return r.name + ' ' + p(r.dnf); }).join(', ') + '.\n\n' : 'NEXT RACE: none left on the schedule.\n\n')
    + 'SEASON PROJECTION: ' + so.rows.slice(0, 12).map(function (r) { return r.name + ' projected P' + r.rankMed + ', ' + Math.round(r.projPts) + ' pts, title odds ' + p(r.champOdds); }).join('; ') + '\n\n'
    + 'DRIVER REPUTATION: ' + repText(S) + '\n\n'
    + 'Write three short takes as three different people, grounded ONLY in the numbers above. Do not change any number. Return ONLY JSON: {"chase":{"headline":"short","summary":"2 to 3 sentences","notes":{"Full Name":"one sentence"}},"race":{...same shape...},"season":{...same shape...}}. Up to 6 notes each, only for drivers with something interesting to say (bubble drivers, surprises, hot or cold streaks). '
    + 'Voices: chase = Dana Whitfield, analyst (precise, numbers first, polite but pointed). race = Tommy Bishop, racing YouTuber (loud, confident, a real opinion, one joke max). season = Big Lou Marchetti, radio host (old school, a little grumpy, a short story or comparison). Plain language, no em dashes, no cliches like "buckle up".';
  var res = await AI.json({ system: 'You write short analyst commentary for a simulated NASCAR Racing 2003 league website. Everything is fiction about sim drivers. Stay on the racing.', user: user, role: 'chatter', maxTokens: 3500 });
  var by = { chase: 'dana', race: 'tommy', season: 'lou' };
  ['chase', 'race', 'season'].forEach(function (k) {
    var r = res[k]; if (!r) return; var notes = {};
    Object.keys(r.notes || {}).forEach(function (nm) { var d = J.findDriver(S, nm); if (d) notes[d.key] = String(r.notes[nm]).slice(0, 220); });
    S.ai[k] = { by: by[k], headline: String(r.headline || '').slice(0, 100), summary: String(r.summary || '').slice(0, 600), notes: notes, ts: Date.now() };
  });
  return true;
};

/* ---------- one pipeline for "a race just happened" ---------- */
AI.coverage = async function (S, race, step) {
  step = step || function () {};
  var art = null, fail = 0;
  step('recap', 'run');
  try { art = await AI.article(S, { outlet: 'wire', race: race, headline: '', notes: '' }); step('recap', 'ok', art.headline); } catch (e) { fail++; step('recap', 'err', e.message); }
  var info = J.raceInfo(race), focus = [info.winner.driver]; if (info.mover) focus.push(info.mover.row.driver); if (info.poleRow) focus.push(info.poleRow.driver);
  step('fans', 'run');
  try { var n = await AI.threads(S, { facts: AI.raceFacts(S, race), story: art, focus: focus, ref: art ? { type: 'article', id: art.id } : { type: 'race', id: race.id } }); step('fans', 'ok', n + ' posts'); } catch (e) { fail++; step('fans', 'err', e.message); }
  step('outlooks', 'run');
  try { await AI.outlooks(S); step('outlooks', 'ok'); } catch (e) { fail++; step('outlooks', 'err', e.message); }
  var ch = J.driftFans(S); step('drift', 'ok', ch.length ? ch.length + ' fans changed sides' : 'no one switched');
  return fail;
};
})();
