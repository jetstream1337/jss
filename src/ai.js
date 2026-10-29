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

/* ---------- fan roster: realistic usernames, ages, stances ----------
   Real people rarely put their full name on social media. Display names here are first names, nicknames,
   initials, inside jokes, a car number or the handle itself. Handles are racing words, numbers and reddit-style
   auto names, never first + last name. */
var FIRST = {
  teen: ['jace', 'kaden', 'mila', 'brynn', 'colt', 'aiden', 'rylee', 'maddox', 'kenzie', 'tyson', 'hayden', 'cam', 'jaxon', 'lexi', 'bentley', 'kash', 'aubree', 'easton', 'paisley', 'ryder'],
  young: ['Tyler', 'Brandon', 'Kayla', 'Dylan', 'Jordan', 'Chelsea', 'Cody', 'Mitch', 'Alyssa', 'Trent', 'Derek', 'Hannah', 'Ricky', 'Morgan', 'Austin', 'Brittany', 'Colby', 'Tanner', 'Jess', 'Zach', 'Kyle', 'Dakota'],
  adult: ['Greg', 'Donna', 'Mike', 'Tammy', 'Steve', 'Rob', 'Kelly', 'Jason', 'Heather', 'Scott', 'Dave', 'Brian', 'Lisa', 'Chad', 'Shawn', 'Travis', 'Amy', 'Wes', 'Darren', 'Jen', 'Troy', 'Missy'],
  oldhead: ['Don', 'Ron', 'Bill', 'Gary', 'Larry', 'Earl', 'Wayne', 'Carl', 'Janet', 'Dale', 'Jim', 'Bobby', 'Linda', 'Harold', 'Junior', 'Buck', 'Darlene', 'Roy', 'Glenn', 'Shirley']
};
var RACE_N = ['lugnut', 'splitter', 'apron', 'draft', 'restart', 'caution', 'pitroad', 'spotter', 'trackbar', 'wedge', 'tirerub', 'stickers', 'scuffs', 'bumpdraft', 'yellowline', 'backstretch', 'frontstretch', 'infield', 'hauler', 'loosewheel', 'bigone', 'overtime', 'stage2', 'checkers', 'pacecar', 'pitbox', 'catchcan', 'roundofwedge', 'fuelmileage', 'twotires', 'outsidelane', 'tandem', 'freightrain', 'dogbox', 'pylon'];
var RACE_ADJ = ['loose', 'tight', 'sketchy', 'salty', 'lapped', 'wrecked', 'late', 'cursed', 'washed', 'mid', 'cooked_tire', 'greenflag', 'unhinged', 'tired', 'pole', 'stagewin', 'lucky_dog'];
var TRACKS = ['Talladega', 'Bristol', 'Darlington', 'Martinsville', 'Daytona', 'Rockingham', 'Dover', 'Pocono', 'Charlotte', 'Wilkesboro', 'Richmond', 'Atlanta', 'Phoenix', 'Michigan'];
var RD_A = ['Spicy', 'Fluffy', 'Ok', 'Ill', 'Low', 'Fast', 'Quiet', 'Broad', 'Loud', 'Strict', 'Bright', 'Nervous', 'Rare', 'Former', 'Sad', 'Polite', 'Tough', 'Electrical', 'Federal', 'Massive', 'Visual', 'Practical'];
var RD_N = ['Lugnut', 'Mechanic', 'Spray', 'Tie', 'Engine', 'Garage', 'Hammer', 'Tire', 'Bumper', 'Wrench', 'Gasket', 'Throttle', 'Chassis', 'Antelope', 'Pickle', 'Banana', 'Sandwich', 'Shift', 'Pin', 'Exhaust'];
var EMO = ['🏁', '🏎️', '🔧', '🛞', '⚡', '🍺', '🔥', '🦅', '🐐', '☕'];
var COLORS = ['#ffc20e', '#e3202c', '#2f6fff', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#94a3b8', '#eab308', '#14b8a6', '#ef4444'];
var QUIRKS = {
  teen: ['types in all lowercase with almost no punctuation', 'communicates in short reactions and the odd 💀 or 😭', 'stan-account energy, makes edits of their driver', 'says "chat" and "bro thinks" like a streamer', 'gets dramatic fast, then forgets about it', 'one-liners like "not him again" or "be so for real"'],
  young: ['sarcastic, group-chat humor', 'has a fantasy lineup and a bet slip riding on it', 'complains about the broadcast and strategy calls', 'swears mildly (damn, hell, shit)', 'quote-posts with one word or "L take"', 'replies "this aged badly" when someone is wrong', 'starts harsh takes with "respectfully"', 'posts hungover on race day'],
  adult: ['dad energy, watches with their kid or their own dad', 'explains pit strategy and fuel mileage nobody asked about', 'grumbles about officiating, dry humor', 'writes full sentences and signs off with a shrug', 'mentions work on Monday or the grill', 'tries to be the reasonable one', 'posts "unpopular opinion:" then a popular opinion', 'tags the reporter asking for clarification'],
  oldhead: ['nostalgic: compares everything to the old days', 'complains the cars all look the same and there are too many cautions', 'types sloppy: ellipses, random CAPS, missing punctuation', 'Facebook-comment energy, sometimes signs off with an initial', 'thinks the playoff format ruined everything', 'loves the sport and will defend it to the end']
};
function weighted(rand, items, w) { var t = w.reduce(function (a, b) { return a + b; }, 0), r = rand() * t; for (var i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
function clean(h) { h = String(h).replace(/[^A-Za-z0-9_\-]/g, ''); return h.length > 21 ? '' : h; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function handleFor(age, level, drv, rand, first, platform) {
  var P = function (a) { return J.pick(rand, a); }, n2 = 10 + Math.floor(rand() * 89), yy = P(['07', '08', '09', '10', '11', '98', '99', '01', '03', '05']);
  var L = J.lastName(drv ? drv.name : '').replace(/[^A-Za-z]/g, ''), l = L.toLowerCase(), c = (drv && drv.car) || '';
  if (platform === 'forum' && rand() < 0.45) return P(RD_A) + P(['-', '_']) + P(RD_N) + P(['-', '_']) + (1000 + Math.floor(rand() * 8999));
  if (drv && level === 2) return P([L + 'Nation', 'team' + l, l + 'szn', c + 'szn', l + 'stan' + yy, 'ride_or_die_' + c, 'no' + c + 'enjoyer', L + 'Brigade']);
  if (drv && level === -2) return P(['anyonebut' + c, l + 'isoverrated', 'not' + c + 'again', l + '_hater_acct', 'Fade' + L]);
  if (drv && level === -1 && rand() < 0.4) return P([l + '_overrated', 'no' + l + 'please', l + 'fumbles']);
  if (drv && level === 1 && rand() < 0.35) return P([c + '_til_i_die', l + 'fan' + n2, 'the' + c + 'guy', l + 'brainrot']);
  var rn = P(RACE_N), ra = P(RACE_ADJ);
  if (age === 'teen') return P([P(['', 'its', 'the', 'lil']) + rn + P(['szn', '_', 'x', 'edits', 'clips', 'fr', 'zz']), rn + yy, ra + rn + P(['', 'hours']), first + P(['.edits', 'zone', '_racing', 'tv']), 'pitroad' + P(['princess', 'prince', 'menace'])]);
  if (age === 'young') return P([ra + '_' + rn, rn + '_enjoyer', 'pushin_the_' + P(['draft', 'apron', 'limit', 'tandem', 'pack']), 'not_your_spotter', 'certified_' + P(['caution', 'restart', 'playoff', 'stage', 'debris']) + '_hater', cap(rn) + n2, 'Fantasy' + cap(rn) + n2, rn + 'brain', first.toLowerCase() + '_on_the_' + P(['apron', 'wall', 'draft', 'box'])]);
  if (age === 'adult') return P(['Sunday' + P(['Grill', 'Couch', 'Garage']) + P(['Dad', 'Guy', 'Mom', 'King']), cap(rn) + first, 'TwoTire' + first, 'Section' + (100 + Math.floor(rand() * 220)) + 'Seats', 'Turn' + P(['1', '2', '3', '4']) + P(['Grandstand', 'Fence', 'Camper']), first + '_' + P(TRACKS).toLowerCase() + n2, 'CrewChief' + first]);
  return P(['OldSchool' + P(['Oval', 'Racing', 'Fan']), P(TRACKS) + P(['Forever', 'Fan', 'Regular']) + (rand() < 0.5 ? n2 : ''), 'BiasPly' + first, 'Carburetor' + P(['Era', 'Days', 'Kid']), (1968 + Math.floor(rand() * 27)) + P(TRACKS), first + '_from_' + P(TRACKS), 'Rt' + (1 + Math.floor(rand() * 90)) + 'Racer']);
}
var JOKE_USED = {};
function displayName(age, handle, rand, first, drv, level) {
  var nm = displayName0(age, handle, rand, first, drv, level);
  if (/^(certified hater|spotter hours|caution clock victim|Dad of 3)/.test(nm)) { if (JOKE_USED[nm]) return cap(first); JOKE_USED[nm] = 1; }
  return nm;
}
function displayName0(age, handle, rand, first, drv, level) {
  var P = function (a) { return J.pick(rand, a); }, f = cap(first), c = drv && level > 0 ? drv.car : '', r = rand();
  var em = rand() < (age === 'teen' ? 0.5 : age === 'young' ? 0.3 : 0.15) ? ' ' + P(EMO) : '';
  if (age === 'teen') return r < 0.35 ? first + em : r < 0.55 ? handle.replace(/[_.]/g, ' ') : r < 0.75 && c ? first + ' | #' + c : P([first.slice(0, 3), first + ' ✨', first + 'ie', 'its ' + first]);
  if (age === 'young') return r < 0.35 ? f + em : r < 0.5 && c ? f + ' | #' + c : r < 0.65 ? f.charAt(0) + P(['J', 'T', 'M', 'K', 'B']) : r < 0.8 ? P(['Big ' + f.charAt(0), f + ' (fantasy commish)', 'certified hater', 'spotter hours', 'caution clock victim', f + ' on the apron']) : handle;
  if (age === 'adult') return r < 0.4 ? f + em : r < 0.55 ? P(['Big ' + f, 'Coach ' + f, f + ' the Grill Sgt']) : r < 0.7 && c ? f + ' | #' + c : r < 0.85 ? P(['Dad of 3' + em, f + ' (Turn 3)', 'Two Tire ' + f]) : f.charAt(0) + '.' + P(['W.', 'R.', 'K.', 'D.']);
  return r < 0.45 ? f : r < 0.65 ? P(['Uncle ' + f, f + ' from ' + P(TRACKS), 'Ol\' ' + f]) : r < 0.8 ? f + ' (since \'' + (68 + Math.floor(rand() * 27)) + ')' : f + ' ' + P(['G', 'W', 'H', 'R', 'B']);
}
function makeFan(S, ds, rand, used, keep) {
  var age = keep ? keep.age : weighted(rand, ['teen', 'young', 'adult', 'oldhead'], [16, 36, 30, 18]);
  var platform = keep ? keep.platform : (rand() < (age === 'teen' ? 0.9 : age === 'oldhead' ? 0.5 : 0.62) ? 'x' : 'forum');
  var drv = null, level = 0;
  if (keep) { if (keep.stance && keep.stance.driver) { drv = ds.find(function (d) { return d.key === keep.stance.driver; }) || null; level = keep.stance.level; } }
  else if (rand() < 0.68) { drv = weighted(rand, ds, ds.map(function (d, i) { return i < 3 ? 5 : i < 8 ? 3 : i < 20 ? 1.5 : 1; })); level = weighted(rand, [2, 1, -1, -2], [22, 40, 26, 12]); }
  for (var tries = 0; tries < 30; tries++) {
    var first = J.pick(rand, FIRST[age]), h = clean(handleFor(age, level, drv, rand, first, platform));
    if (h.length < 4 || used[h.toLowerCase()]) continue;
    used[h.toLowerCase()] = 1;
    var f = keep || { id: 'f' + (S.fans.length + 1) + J.uid('').slice(-3), age: age, platform: platform, stance: drv ? { driver: drv.key, level: level, seen: (S.rep[drv.key] ? S.rep[drv.key].events.length : 0) } : { driver: null, level: 0, seen: 0 } };
    f.handle = h; f.name = displayName(age, h, rand, first, drv, level); f.v = 2;
    f.color = J.pick(rand, COLORS); f.quirks = J.shuffle(QUIRKS[age], rand).slice(0, 2).join('; ');
    f.followers = Math.round(Math.pow(rand(), 3) * (age === 'oldhead' ? 900 : 4200)) + 12;
    return f;
  }
  return null;
}
AI.ensureFans = function (S) {
  var ds = J.roster(S); if (!ds.length) return false;
  var target = Math.min(170, Math.max(140, ds.length + 100)), rand = J.rng('fans2' + S.id + S.fans.length + ':' + S.races.length), used = {};
  JOKE_USED = {}; S.fans.forEach(function (f) { if (f.v === 2) { used[String(f.handle).toLowerCase()] = 1; JOKE_USED[f.name] = 1; } });
  S.fans.forEach(function (f) { if (f.v !== 2) makeFan(S, ds, rand, used, f); }); // older accounts get modern handles and names, same id and stance
  var guard = 0;
  while (S.fans.length < target && guard++ < 600) { var f = makeFan(S, ds, rand, used, null); if (f) S.fans.push(f); }
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
/* Facts for the days before a race: practice, qualifying, happy hour. The race itself has NOT happened. */
AI.sessionFacts = function (S, sid) {
  var r = S.schedule.find(function (x) { return x.id === sid; }) || { name: 'the next race', track: '', type: 'inter' };
  var idx = S.schedule.indexOf(r) + 1, lines = [];
  lines.push('UPCOMING RACE: ' + r.name + (r.track ? ' at ' + r.track : '') + ' (' + (J.TYPES[r.type] || 'oval').toLowerCase() + ')' + (idx ? ', round ' + idx + ' of ' + S.schedule.length : '') + (r.date ? ', ' + r.date : '') + '.');
  lines.push('THE RACE HAS NOT BEEN RUN YET. Nobody has won it. Do not invent race results, finishing spots, wrecks in the race or a winner. Talk about practice and qualifying, predictions and hype.');
  J.sessionsFor(S, sid).forEach(function (x) {
    var rows = x.rows.slice().sort(function (a, b) { return a.position - b.position; });
    lines.push(J.SESSIONS[x.type] + (x.meta && x.meta.weather ? ' (weather ' + x.meta.weather + ')' : '') + ', ' + rows.length + ' cars: ' + rows.slice(0, 20).map(function (q) { return q.position + ' #' + (q.car || '?') + ' ' + q.driver + (q.time ? ' ' + q.time : ''); }).join('; ') + (rows.length > 20 ? '; ... last: ' + rows.slice(-3).map(function (q) { return q.position + ' ' + q.driver; }).join(', ') : '') + '.');
    if (x.type === 'qualifying' && rows[0]) lines.push('Pole sitter: ' + rows[0].driver + (rows[0].time ? ' (' + rows[0].time + ')' : '') + '.' + (rows[1] ? ' Outside pole: ' + rows[1].driver + '.' : ''));
  });
  if (S.races.length) lines.push('Points standings going in: ' + standingsText(S, 10) + '.');
  else lines.push('This is the first race of the season, so there are no points yet.');
  return lines.join('\n');
};
/* Read a results table off one or more screenshots. Returns {session, track, rows:[...]} */
AI.readScreenshot = async function (S, images, typeHint) {
  var names = J.roster(S).map(function (d) { return d.name + (d.car ? ' #' + d.car : ''); }).slice(0, 80);
  var user = 'The commissioner says this is: ' + (typeHint === 'race' ? 'RACE RESULTS' : (J.SESSIONS[typeHint] || 'a results table').toUpperCase() + ' results') + '.\n'
    + (names.length ? 'Drivers already in this league (use these exact spellings when the screenshot clearly shows one of them): ' + names.join(', ') + '.\n' : '')
    + (images.length > 1 ? images.length + ' screenshots are attached; together they may show one long list. Merge them, no duplicates.\n' : '')
    + 'Copy every row you can see, top to bottom. If a name is cut off or unreadable, write what you can see and add "?" at the end. Never make up a driver.\n'
    + 'Return ONLY JSON: {"session":"race|qualifying|practice|happy|unknown","track":"track name if shown or empty","rows":[{"pos":1,"car":"11","driver":"Full Name","time":"lap time or empty","laps":null,"led":null,"start":null,"interval":"gap or empty","status":"Running or reason out, or empty"}]}';
  var res = await AI.json({ system: 'You transcribe results tables from screenshots of the racing sim NASCAR Racing 2003 and similar games. You copy exactly what is on screen. You never guess or invent names or numbers.', user: user, images: images, role: 'writer', maxTokens: 6000 });
  var rows = (res.rows || []).filter(function (r) { return r && r.driver; }).map(function (r, i) {
    var n = function (v) { var m = String(v == null ? '' : v).match(/-?\d+/); return m ? parseInt(m[0], 10) : 0; };
    return { position: n(r.pos) || i + 1, start: n(r.start), driver: String(r.driver).trim(), car: String(r.car || '').replace(/[^\w]/g, ''), team: '', laps: n(r.laps), lapsLed: n(r.led), filePoints: null, status: String(r.status || ''), interval: String(r.interval || ''), time: String(r.time || '') };
  });
  var seen = {}; rows = rows.filter(function (r) { var k = r.position + '|' + r.driver.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).sort(function (a, b) { return a.position - b.position; });
  return { session: res.session || 'unknown', track: res.track || '', rows: rows };
};
function repText(S) {
  var out = []; J.roster(S).slice(0, 14).forEach(function (d) { var r = J.repOf(S, d.key); out.push(d.name + ' ' + r.score + (r.events[0] ? ' (latest: ' + (r.events[0].delta > 0 ? '+' : '') + r.events[0].delta + ' ' + r.events[0].why + ')' : '')); });
  return out.join('; ');
}
function personaLine(S, f) {
  var st = f.stance || {}, nm = st.driver ? ((J.roster(S).find(function (d) { return d.key === st.driver; }) || {}).name || st.driver) : null;
  return f.id + ' | ' + (f.platform === 'forum' ? 'u/' : '@') + f.handle + ' | shown as "' + f.name + '" | ' + f.platform + ' | ' + f.age + ' | ' + (nm && st.level ? J.STANCE[st.level] + ' of ' + nm : 'no strong driver') + ' | ' + f.quirks;
}

/* ---------- Garage: threads ---------- */
var FAN_STYLE = 'YOU ARE WRITING REAL-LOOKING NASCAR SOCIAL MEDIA (X/Twitter and the r/NASCAR subreddit) FOR A SIM-RACING LEAGUE SITE.\n'
  + 'It has to pass as real posts from real people in the mid 2020s. If it reads like a brand account, a press release or an AI, it fails.\n\n'
  + 'HOW PEOPLE ACTUALLY POST NOW\n'
  + '- Most posts are short and lowercase-leaning. Many are one line. Punctuation is optional. Nobody writes a tidy paragraph on X unless they are an analyst or mad.\n'
  + '- Real reply culture: dunks, one-word replies ("ratio", "nah", "L", "real", "source?", "this", "LMAO"), people misreading the post, people answering a question nobody asked, someone posting a stat to end the argument, someone saying "this aged badly" a week later, someone tagging @ an account.\n'
  + '- Modern phrasing in small doses, matched to age: "be so for real", "bro thinks", "not him again", "respectfully", "lowkey", "chat is this real", "the way he...", "it\'s giving", "touch grass", "ain\'t no way", "I\'m crying", "W"/"L" as a one-word verdict. Never stack more than one per post. Older people do NOT talk like this.\n'
  + '- Emoji: teens and young adults use 💀 😭 🫡 🤡 📉 🐐 🔥 sometimes (max one or two, and many posts have none). Adults rarely. Old-heads use 👍 or none.\n'
  + '- Quote posts: someone quotes an earlier post with their own short take on top ("quote": index). Polls: big accounts and some fans post polls ("poll": 2 to 4 short options). Use one or two of each across the whole batch, not every thread.\n'
  + '- Reddit (forum) is different: posts have a title, comments are longer and nerdier, people say "Edit: ...", "Came here to say this", correct each other on facts, and the top comment is usually a joke. Reddit users never use display names or emoji much.\n\n'
  + 'VOICES BY AGE\n'
  + '- Teens: lowercase, fast, stan culture, edits, dramatic for one post then on to the next thing. 2 to 12 words.\n'
  + '- 20s to early 30s: sarcastic group-chat humor, DFS lineups and bet slips, complaining about the broadcast and pit calls, mild swearing (damn, hell, ass, shit).\n'
  + '- 35 to 55: full sentences, strategy talk (two tires vs four, fuel windows, track position), dad jokes, Monday-at-work energy, tries to be the reasonable one.\n'
  + '- Old-heads: Facebook-comment energy, random CAPS, ellipses..., "back in my day", hates the playoff format, still loves the sport.\n\n'
  + 'STANCE (shown as a green or red tag by each username, so every post must match it)\n'
  + '- superfan: blind loyalty, defends everything, brings their driver up even off topic.  - fan: supportive, can admit a bad day.\n'
  + '- hater: dry and snarky, enjoys their bad days, gives grudging credit.  - superhater: relentless, celebrates every setback, picks fights with that driver\'s fans.\n'
  + 'Haters rip the DRIVING and the RESULTS only. Never anyone\'s family, looks, health, politics or private life. No slurs, no threats, no harassment.\n\n'
  + 'RULES\n'
  + '1. Real arguments. Several threads need disagreement, and at least one reply chain goes back and forth 3+ times between the same two people. Fans and haters of the same driver collide.\n'
  + '2. Only use facts you are given (positions, laps led, gaps, points, practice and qualifying times). Never invent results, lap numbers, wrecks or quotes.\n'
  + '3. Wildly uneven lengths. Lots of 1 to 6 word replies. A few longer posts.\n'
  + '4. Never open two posts the same way. No repeated jokes or phrases, including from the RECENT POSTS list. Do not echo the headline.\n'
  + '5. Banned, they read as AI: cooking/cooked, no crumbs, masterclass, chef\'s kiss, no notes, buckle up, hold my beer, rent free, this is the way, "let\'s gooo", "absolute scenes", "what a race folks", hashtags (except a rare #NASCAR from an old-head), em dashes, "folks", "y\'all ready".\n'
  + '6. Typos and bad grammar are fine where the person would make them. Not everyone is funny. Some posts are boring or just wrong.\n'
  + '7. Spread it out: not everything is about the winner. Mid-pack drivers, the broadcast, fantasy, a bad pit call, someone\'s own bad day, a random hot take.\n'
  + '8. Prominent accounts keep their own voice (listed below) and get big reactions. Fans reply to them, argue with them, quote them and @ them.\n'
  + 'This is a simulated sim-racing league. Everything stays on the racing.';
var THREAD_SCHEMA = 'Return ONLY JSON: {"threads":[{"platform":"x" or "forum","title":"forum threads only","posts":[{"by":"<persona id or figure id>","text":"...","replyTo":null or <index of an earlier post in this thread>,"quote":<optional index of an earlier post this one quote-posts>,"poll":<optional ["option","option"]>}]}]}\nThe first post of every thread has replyTo null. Every other post replies to an earlier post by index. A quote post usually has replyTo null only when it is the first post of a new thread quoting nothing; inside a thread give it replyTo AND quote.';

function figureLines() { return Object.keys(J.FIGURES).map(function (k) { var f = J.FIGURES[k]; return k + ' = ' + f.name + ' ' + f.handle + ' (' + f.badge.toLowerCase() + '): ' + f.voice; }).join('\n'); }
AI.threads = async function (S, o) {
  AI.ensureFans(S); if (!S.fans.length) throw new Error('Import a race, practice or qualifying first so there are drivers for the fans to talk about.');
  var rand = J.rng('pick' + Date.now());
  var focus = {}; (o.focus || []).forEach(function (n) { var d = J.findDriver(S, n); if (d) focus[d.key] = 1; });
  var fans = S.fans.slice(), pri = fans.filter(function (f) { return f.stance && focus[f.stance.driver]; }), rest = J.shuffle(fans.filter(function (f) { return !(f.stance && focus[f.stance.driver]); }), rand);
  var chosen = J.shuffle(pri, rand).slice(0, 14).concat(rest).slice(0, 34);
  var recent = S.posts.slice(-20).map(function (p) { return '- ' + p.text.slice(0, 100); }).join('\n');
  var lastRace = S.races[S.races.length - 1], extra = [];
  if (lastRace) {
    var shown = {}; J.raceInfo(lastRace).rows.slice(0, 15).forEach(function (r) { shown[J.driverKey(r.driver)] = 1; });
    var want = {}; chosen.forEach(function (f) { if (f.stance && f.stance.driver && !shown[f.stance.driver]) want[f.stance.driver] = 1; });
    lastRace.rows.forEach(function (r) { var k = J.driverKey(r.driver); if (want[k]) extra.push(r.driver + ' finished P' + r.position + ' (started P' + (r.start || '?') + (J.isDnf(r) ? ', ' + r.status : '') + (r.interval && /(\d+)\s*l/i.test(r.interval) ? ', ' + (function (n) { return n + (n === '1' ? ' lap' : ' laps'); })(r.interval.match(/(\d+)\s*l/i)[1]) + ' down' : '') + ')'); });
  }
  var cp = J.chasePicture(S), cutTxt = cp && cp.lastIn && cp.firstOut ? S.chase.name + ' cut line right now: ' + cp.lastIn.name + ' is the last driver in on points, ' + cp.firstOut.name + ' the first out, ' + Math.abs(cp.lastIn.pts - cp.firstOut.pts) + ' points apart.' : '';
  var heads = S.articles.slice(0, 5).map(function (a) { return '"' + a.headline + '" (' + (J.OUTLETS[a.outlet] || J.OUTLETS.wire).name + ')'; });
  var user = 'LEAGUE: ' + S.league.name + ' (' + S.series.label + '), ' + J.seasonYear(S) + ' season. Races run: ' + S.races.length + ' of ' + Math.max(S.schedule.length, S.races.length) + '.\n\n'
    + 'FACTS (use only these):\n' + o.facts + (extra.length ? '\nOther drivers the fans below follow, last race: ' + extra.join('; ') + '.' : '') + (cutTxt ? '\n' + cutTxt : '') + '\n\n'
    + (o.story ? 'THE STORY EVERYONE IS REACTING TO: "' + o.story.headline + '" - ' + (o.story.dek || '') + '\n\n' : '')
    + (heads.length ? 'LATEST HEADLINES ON THE SITE (people may react to or argue with these): ' + heads.join('; ') + '\n\n' : '')
    + 'DRIVER REPUTATION (0-100, higher = more liked): ' + repText(S) + '\n\n'
    + (recent ? 'RECENT POSTS ALREADY ON THE SITE (do not repeat their wording, jokes or openers):\n' + recent + '\n\n' : '')
    + 'FANS YOU MAY WRITE AS (id | handle | display name | platform | age | stance | quirks):\n' + chosen.map(function (f) { return personaLine(S, f); }).join('\n') + '\n\n'
    + 'PROMINENT ACCOUNTS (id = name handle (role): voice):\n' + figureLines() + '\n\n'
    + 'TASK: ' + (o.task || 'Write 7 to 9 threads reacting to the facts and the story.') + ' About two thirds should be platform "x" (3 to 7 posts each), the rest "forum" (5 to 9 posts with comment chains). Use at least 18 different fans and at least 5 different prominent accounts. Include one or two quote posts and one poll somewhere. Every fan\'s stance must show in how they talk about that driver.\n\n' + THREAD_SCHEMA;
  var res = await AI.json({ system: FAN_STYLE, user: user, role: 'chatter', maxTokens: 9000 });
  var n = AI.applyThreads(S, res, o.ref);
  if (!n) throw new Error(AI.name() + ' did not write any usable fan posts. Try again.');
  return n;
};
AI.applyThreads = function (S, res, ref) {
  var now = Date.now(), added = 0, ok = {}; S.fans.forEach(function (f) { ok[f.id] = f; });
  (res.threads || []).forEach(function (th, ti) {
    var plat = th.platform === 'forum' ? 'forum' : 'x', tid = J.uid('t'), t0 = now - (2 + ti * (3 + Math.floor(Math.random() * 9))) * 60000, ids = [], clock = t0;
    (th.posts || []).forEach(function (p, pi) {
      var by = null, text = String(p.text || '').trim(); if (!text) return;
      if (J.FIGURES[p.by]) by = { type: 'figure', id: p.by }; else if (ok[p.by]) by = { type: 'fan', id: p.by }; else return;
      var parent = null; if (pi > 0) { var pr = p.replyTo; parent = (typeof pr === 'number' && ids[pr]) ? ids[pr] : (ids[0] || null); } else if (ids.length) return;
      text = text.replace(/\s+[—–]\s+/g, ', ').slice(0, plat === 'forum' ? 1400 : 560);
      clock += (1 + Math.floor(Math.random() * 6)) * 60000; if (clock > now) clock = now - Math.floor(Math.random() * 40000);
      var id = J.uid('p'); ids[pi] = id;
      var post = { id: id, thread: tid, parent: parent, platform: plat, title: pi === 0 && plat === 'forum' ? String(th.title || '').slice(0, 140) : '', by: by, text: text, ts: clock, ref: ref || null };
      if (typeof p.quote === 'number' && ids[p.quote] && ids[p.quote] !== id) post.quote = ids[p.quote];
      if (Array.isArray(p.poll) && p.poll.length >= 2) post.poll = p.poll.slice(0, 4).map(function (x) { return String(x).slice(0, 40); });
      S.posts.push(post); added++;
    });
  });
  var ths = J.threadsOf(S); if (ths.length > 90) { var keep = {}; ths.slice(0, 90).forEach(function (t) { keep[t.id] = 1; }); S.posts = S.posts.filter(function (p) { return keep[p.thread]; }); }
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
  else if (o.preSid) parts.push('PRE-RACE DATA (this story is a PREVIEW written before the race):\n' + AI.sessionFacts(S, o.preSid));
  if (o.headline) parts.push('COMMISSIONER\'S WORKING HEADLINE (this is the topic; keep its meaning, you may sharpen the wording): ' + o.headline);
  if (o.notes) parts.push('COMMISSIONER\'S NOTES (facts you may use):\n' + o.notes);
  if (o.images && o.images.length) parts.push(o.images.length + ' image(s) are attached in this order: ' + o.images.map(function (im, i) { return (i + 1) + '=' + (im.label || 'untitled'); }).join(', ') + '. Add one caption per image in photoCaptions.');
  parts.push('DRIVER REPUTATION RIGHT NOW (0-100): ' + repText(S));
  parts.push('Write the story now. ' + (o.interviews === false ? 'Return an empty interviews array.' : 'Include 2 to 3 pit road interviews tied to the story.') + '\n\n' + NEWS_SCHEMA);
  return AI.json({ system: newsSystem(S, outlet), user: parts.join('\n\n'), images: o.images || [], role: 'writer', maxTokens: 5000 });
};
AI.article = async function (S, o) {
  var res = await AI.articleDraft(S, o), race = o.race || null;
  return AI.applyArticle(S, res, { outlet: o.outlet || 'wire', raceId: race ? race.id : '', preSid: o.preSid || '', media: o.mediaIds || [], replaceAutoFor: race ? race.id : null });
};
AI.applyArticle = function (S, res, o) {
  var a = res.article || {}; if (!a.headline || !a.body) throw new Error(AI.name() + ' returned a story without a headline or body.');
  var staff = (J.OUTLETS[o.outlet] || J.OUTLETS.wire).staff, now = Date.now();
  var art = { id: J.uid('a'), outlet: o.outlet, headline: String(a.headline).slice(0, 160), dek: String(a.dek || '').slice(0, 260), body: String(a.body), author: staff[Math.floor(Math.random() * staff.length)], ts: now, raceId: o.raceId || '', preSid: o.preSid || '', tags: (a.tags || []).slice(0, 6).map(String), media: o.media || [] };
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

/* ---------- the newsroom: outlets write their own stories each race week ----------
   One request writes 2 or 3 stories at once (saves the free daily allowance). phase: 'post' (after a race),
   'pre' (after practice or qualifying), 'week' (commissioner pressed the button). */
var DESK = {
  wire: 'Checkered Wire (race coverage): previews, recaps, points-race news. Straight news voice. 350 to 550 words.',
  silly: 'Silly Season Daily (contracts, rides, sponsors, crew chiefs, rumors): with no commissioner input you MAY invent league-fiction rumors, but only about rides, contracts, sponsors, crew chief or team moves, always framed as unconfirmed ("per sources", "is said to be", "nothing is signed"), one storyline per story, and continue an earlier rumor from RECENT HEADLINES when there is one instead of starting a new one. Never personal life, money figures, legal trouble or health. 300 to 450 words.',
  notes: 'Pit Notes (analysis and features): one angle the data supports (momentum, cut-line math, a track-type trend, a rivalry, a slump), argued with numbers. A few "## " subheads allowed. 450 to 650 words.'
};
AI.newsCycle = async function (S, o) {
  o = o || {}; var phase = o.phase || 'week', parts = [], plan;
  if (!J.roster(S).length) throw new Error('The newsroom needs drivers to write about. Import a race, practice or qualifying first.');
  var nx = J.nextRound(S), race = o.race || (phase === 'post' ? S.races[S.races.length - 1] : null);
  if (phase === 'post') plan = ['notes', 'silly'];
  else if (phase === 'pre') plan = ['wire', S.races.length ? 'notes' : 'silly'];
  else plan = S.races.length ? ['wire', 'notes', 'silly'] : ['wire', 'silly'];
  parts.push('LEAGUE STANDINGS NOW: ' + (standingsText(S, 16) || 'no races run yet') + '.');
  var cp = J.chasePicture(S);
  if (cp && cp.lastIn && cp.firstOut) parts.push(S.chase.name.toUpperCase() + ' PICTURE: top ' + cp.size + ' make it after race ' + cp.cutRace + ' (' + (cp.decided ? 'field is set' : cp.left + ' races left before the cut') + '). ' + (cp.winners ? cp.winners + ' race winner(s) locked in. ' : '') + 'Last in on points: ' + cp.lastIn.name + ' (' + cp.lastIn.pts + '). First out: ' + cp.firstOut.name + ' (' + cp.firstOut.pts + ').');
  if (race) parts.push('LATEST RACE:\n' + AI.raceFacts(S, race));
  var preSid = o.sid || (nx && J.sessionsFor(S, nx.id).length ? nx.id : '');
  if (nx) parts.push(preSid ? 'NEXT RACE (has NOT been run):\n' + AI.sessionFacts(S, preSid) : 'NEXT RACE (has NOT been run): ' + nx.name + (nx.track ? ' at ' + nx.track : '') + ' (' + J.TYPES[nx.type].toLowerCase() + ')' + (nx.date ? ', ' + nx.date : '') + '.');
  var ro = nx ? J.raceOutlook(S) : null;
  if (ro && ro.favorites) parts.push('MODEL WIN ODDS FOR THE NEXT RACE (from the site\'s simulator; quote as "the model" if you use them): ' + ro.rows.slice(0, 6).map(function (r) { return r.name + ' ' + Math.round(r.win * 100) + '%'; }).join(', ') + '.');
  parts.push('DRIVER REPUTATION (0-100): ' + repText(S));
  var recent = S.articles.slice(0, 14).map(function (a) { return '- [' + (J.OUTLETS[a.outlet] || J.OUTLETS.wire).name + '] ' + a.headline; });
  if (recent.length) parts.push('RECENT HEADLINES (do not repeat these angles; continue storylines instead):\n' + recent.join('\n'));
  parts.push('WRITE ' + plan.length + ' STORIES, one per outlet, in this order: ' + plan.map(function (k) { return J.OUTLETS[k].name; }).join(', ') + '.\n' + plan.map(function (k) { return '- ' + DESK[k]; }).join('\n')
    + (phase === 'pre' || (phase === 'week' && nx) ? '\nThe next race has NOT happened. Previews may predict, never report a result.' : '')
    + '\n\nReturn ONLY JSON: {"articles":[{"outlet":"wire|silly|notes","headline":"...","dek":"one sentence","body":"paragraphs separated by a blank line","tags":["Driver Name"]}]}');
  var sys = 'You are the editors of three fictional outlets covering "' + S.league.name + '", a SIMULATED ' + S.series.label + ' league run in NASCAR Racing 2003. The drivers are the league\'s sim drivers. Everything is fiction for a sim-racing fan site; keep it on racing and the league. Nothing about anyone\'s real-world personal life, politics, family, health, legal matters or money.\n\n' + NEWS_RULES + ' Headlines read like real motorsport headlines: specific, no puns stacked on puns, no colons-and-questions template. Each story has a different angle and different drivers where possible. No quotes from drivers in these stories.';
  var res = await AI.json({ system: sys, user: parts.join('\n\n'), role: 'writer', maxTokens: 9000 });
  var made = [];
  (res.articles || []).slice(0, 3).forEach(function (a, i) {
    var outlet = J.OUTLETS[a.outlet] ? a.outlet : plan[i] || 'notes';
    if (!a || !a.headline || !a.body) return;
    try { var art = AI.applyArticle(S, { article: a, interviews: [], reputation: [] }, { outlet: outlet, raceId: phase === 'post' && race ? race.id : '', preSid: phase !== 'post' && preSid ? preSid : '', media: [] }); art.desk = true; art.ts -= (i + 1) * 300000; made.push(art); } catch (e) { /* skip a bad one */ }
  });
  if (!made.length) throw new Error(AI.name() + ' did not write any usable stories. Try again.');
  return made;
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
  if (J.settings.autoNews !== false) {
    step('news', 'run');
    try { var made = await AI.newsCycle(S, { phase: 'post', race: race }); step('news', 'ok', made.length + (made.length === 1 ? ' story' : ' stories')); } catch (e) { fail++; step('news', 'err', e.message); }
  }
  var info = J.raceInfo(race), focus = [info.winner.driver]; if (info.mover) focus.push(info.mover.row.driver); if (info.poleRow) focus.push(info.poleRow.driver);
  step('fans', 'run');
  try { var n = await AI.threads(S, { facts: AI.raceFacts(S, race), story: art, focus: focus, ref: art ? { type: 'article', id: art.id } : { type: 'race', id: race.id } }); step('fans', 'ok', n + ' posts'); } catch (e) { fail++; step('fans', 'err', e.message); }
  step('outlooks', 'run');
  try { await AI.outlooks(S); step('outlooks', 'ok'); } catch (e) { fail++; step('outlooks', 'err', e.message); }
  var ch = J.driftFans(S); step('drift', 'ok', ch.length ? ch.length + ' fans changed sides' : 'no one switched');
  return fail;
};
})();
