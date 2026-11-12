/* Virtual NASCAR - AI layer: Gemini (free) or Claude (paid) (commissioner app only; never published) */
(function () {
'use strict';
var J = window.JSS, AI = J.ai = {};
J.settings = J.settings || {};

/* ---------- network (Electron bridge when present, plain fetch otherwise) ---------- */
J.http = function (url, opts) {
  opts = opts || {};
  if (window.jssNative && window.jssNative.http) return window.jssNative.http({ url: url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body, timeoutMs: opts.timeoutMs });
  var ctl = window.AbortController ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeoutMs || 180000) : null;
  return fetch(url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body, signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.text().then(function (x) { clearTimeout(t); return { status: r.status, text: x }; }); })
    .catch(function (e) { clearTimeout(t); return { status: 0, text: JSON.stringify({ message: 'Network error (' + (e && e.name === 'AbortError' ? 'timed out' : (e && e.message) || e) + ')' }) }; });
};
/* one automatic retry when the connection itself fails (not when the server answers with an error) */
J.httpRetry = async function (url, opts) {
  var r = await J.http(url, opts);
  if (r.status === 0 && !/timed out|Blocked host/.test(r.text || '')) { await new Promise(function (ok) { setTimeout(ok, 2500); }); r = await J.http(url, opts); }
  return r;
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
  var r = await J.httpRetry('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': J.settings.apiKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
  var data; try { data = JSON.parse(r.text); } catch (e) { throw new Error('Claude sent back something unreadable (HTTP ' + r.status + ').'); }
  if (r.status === 0) throw new Error('The app could not connect to Anthropic' + (data && data.message ? ' (' + String(data.message).replace(/^Network error \(|\)$/g, '') + ')' : '') + '. If your browser works, an antivirus web shield, VPN or firewall may be blocking the JSS app.');
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
  var e = (data && data.error) || {}, m = e.message || (data && data.message) || '', st = e.status || '';
  var err;
  if (/API key not valid|API_KEY_INVALID/i.test(m) || (r.status === 400 && /key/i.test(m))) err = 'Your Gemini key was not accepted. Copy it again from aistudio.google.com (Get API key) and paste it in Settings.';
  else if (r.status === 403 || st === 'PERMISSION_DENIED') err = 'Google says this key is not allowed to use Gemini. Make a new key at aistudio.google.com.';
  else if (r.status === 429 || st === 'RESOURCE_EXHAUSTED') err = 'You have used today\'s free Gemini requests. They reset overnight (about 3 AM Eastern). Try again tomorrow.';
  else if (r.status >= 500) err = 'Gemini is busy right now. Try again in a few minutes.';
  else if (r.status === 404) err = 'That Gemini model is not available any more. Click Test key in Settings and the app will pick a new one.';
  else if (r.status === 0) err = /timed out/.test(m) ? 'Google took too long to answer (over 3 minutes). Try again; if it keeps happening pick a "Lite" model in Settings.' : 'The app could not connect to Google' + (m ? ' (' + m.replace(/^Network error \(|\)$/g, '') + ')' : '') + '. If your browser works, an antivirus "web shield", VPN or firewall may be blocking the JSS app. Try again, or allow the app in that program.';
  else err = 'Gemini problem (' + r.status + '): ' + (m || 'unknown error');
  var x = new Error(err); x.status = r.status; x.gstatus = st; return x;
}
AI.geminiModels = async function () {
  var all = [], token = '';
  for (var i = 0; i < 5; i++) {
    var r = await J.httpRetry(GEM + 'models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { method: 'GET', headers: gemHeaders(), timeoutMs: 30000 });
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
      if (e.status === 400 && e.gmsg && /thinking/i.test(e.gmsg) && !J.settings.geminiNoThinkCfg) { J.settings.geminiNoThinkCfg = true; i--; continue; }
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
  if (!J.settings.geminiNoThinkCfg) gen.thinkingConfig = { thinkingLevel: 'low' };
  var body = { systemInstruction: { parts: [{ text: o.system }] }, contents: [{ role: 'user', parts: parts }], generationConfig: gen };
  var r = await J.httpRetry(GEM + 'models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: gemHeaders(), body: JSON.stringify(body), timeoutMs: 180000 });
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
var LASTN = ['Miller', 'Johnson', 'Smith', 'Davis', 'Brown', 'Wilson', 'Moore', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Cooper', 'Peterson', 'Reed', 'Bailey', 'Bell', 'Howard', 'Ward', 'Cox', 'Richardson', 'Wood', 'Brooks', 'Watson', 'Gray', 'Hughes', 'Price', 'Sanders', 'Myers', 'Long', 'Ross', 'Foster', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan', 'Fisher', 'Henderson', 'Coleman', 'Simmons', 'Patterson', 'Jordan', 'Reynolds', 'Hamilton', 'Graham', 'Kim', 'Gonzalez', 'Alvarez', 'Hayes', 'Myers', 'Ford', 'Wells', 'Webb', 'Tucker', 'Porter', 'Hunter', 'Hicks', 'Crawford', 'Boyd', 'Mason', 'Dixon', 'Hunt', 'Pope', 'Barnes', 'Dunn', 'Pruitt', 'Cagle', 'Beasley', 'Honeycutt', 'Puckett', 'Satterfield', 'Whitaker', 'Blevins', 'Dobbins', 'Tillman'];
var PLACES = ['Charlotte, NC', 'Concord, NC', 'Mooresville, NC', 'Raleigh, NC', 'Greensboro, NC', 'Hickory, NC', 'Wilkesboro, NC', 'Greenville, SC', 'Spartanburg, SC', 'Florence, SC', 'Columbia, SC', 'Knoxville, TN', 'Bristol, TN', 'Johnson City, TN', 'Nashville, TN', 'Chattanooga, TN', 'Birmingham, AL', 'Huntsville, AL', 'Talladega, AL', 'Daytona Beach, FL', 'Jacksonville, FL', 'Tampa, FL', 'Atlanta, GA', 'Dawsonville, GA', 'Macon, GA', 'Richmond, VA', 'Martinsville, VA', 'Roanoke, VA', 'Indianapolis, IN', 'Fort Wayne, IN', 'Columbus, OH', 'Dayton, OH', 'Toledo, OH', 'Detroit, MI', 'Grand Rapids, MI', 'Pittsburgh, PA', 'Pocono, PA', 'Harrisburg, PA', 'Dover, DE', 'Fort Worth, TX', 'Houston, TX', 'San Antonio, TX', 'Kansas City, KS', 'St. Louis, MO', 'Des Moines, IA', 'Madison, WI', 'Phoenix, AZ', 'Las Vegas, NV', 'Sacramento, CA', 'Bakersfield, CA', 'Lancaster, NY', 'Watkins Glen, NY', 'Concord, NH', 'Mobile, AL', 'Shreveport, LA', 'Tulsa, OK', 'Wichita, KS', 'Louisville, KY', 'Bowling Green, KY', 'Toronto, ON'];
var STATE_TAG = { NC: ['NC', 'Carolina', 'Tarheel'], SC: ['SC', 'Carolina', 'Gamecock'], TN: ['Tn', 'Vol', 'Tenn'], AL: ['Bama', 'Bama', 'Roll'], FL: ['FL', 'Gator', 'Florida'], GA: ['GA', 'Dawg', 'Peach'], VA: ['VA', 'Hokie', 'Va'], IN: ['Indy', 'Hoosier', 'IN'], OH: ['Ohio', 'Buckeye', 'OH'], MI: ['MI', 'Mich', 'Spartan'], PA: ['PA', 'Penn', 'Yinz'], TX: ['TX', 'Texas', 'Tx'], KS: ['KS', 'Jayhawk', 'KC'], MO: ['MO', 'Stl', 'Mizzou'], IA: ['Iowa', 'IA', 'Hawkeye'], WI: ['Wis', 'Badger', 'Cheese'], AZ: ['AZ', 'Desert', 'Az'], NV: ['Vegas', 'NV', 'Vegas'], CA: ['Cali', 'CA', 'Socal'], NY: ['NY', 'Upstate', 'NY'], NH: ['NH', 'Granite', 'NE'], LA: ['Cajun', 'LA', 'Geaux'], OK: ['Okie', 'OK', 'Sooner'], KY: ['KY', 'Bluegrass', 'Kentucky'], DE: ['DE', 'Del', 'Monster'], ON: ['Canuck', 'ON', 'Canada'] };
// who an interest fits: M male, F female, T teen, Y 20s, A adults (not teens), O old-heads, blank anyone
var INTERESTS = ['M|Ford guy', 'M|Chevy guy', 'F|Chevy girl', 'F|Ford girl', '|Toyota fan', '|hunting and fishing', '|Bama football', '|Go Dawgs', '|Go Vols', '|Clemson fan', '|Gamecocks', '|Buckeyes', '|Steelers', '|Panthers', '|Colts', '|Braves', '|Cubs', 'A|golf when it is not race day', '|dirt late models on Saturday night', '|local short track regular', '|sim racer', '|iRacing on weeknights', '|diecast collector', 'A|weekend camper at the track', 'A|grill master', 'A|coffee first', '|country music', 'A|classic trucks', '|lifted trucks', '|fantasy NASCAR', 'Y|DFS grinder', 'A|photographer', 'A|welder', 'A|nurse', 'A|teacher', 'A|lineman', 'A|truck driver', 'A|mechanic', 'A|firefighter', 'A|farmer', 'A|Army vet', 'Y|college student', 'T|high school', 'O|retired', 'MO|grandpa of 5', 'FO|grandma of 4', 'FA|boy mom', 'MA|girl dad', 'A|dog dad', 'FA|cat mom', '|Truck Series enjoyer', '|ARCA nerd'];
var FEM = { mila: 1, brynn: 1, rylee: 1, kenzie: 1, lexi: 1, aubree: 1, paisley: 1, kayla: 1, chelsea: 1, alyssa: 1, hannah: 1, morgan: 1, brittany: 1, jess: 1, donna: 1, tammy: 1, kelly: 1, heather: 1, lisa: 1, amy: 1, jen: 1, missy: 1, janet: 1, linda: 1, darlene: 1, shirley: 1 };
function fits(code, age, fem) {
  if (!code) return true;
  if (code.indexOf('M') >= 0 && fem) return false; if (code.indexOf('F') >= 0 && !fem) return false;
  var ages = code.replace(/[MF]/g, ''); if (!ages) return true;
  return ages.indexOf(age === 'teen' ? 'T' : age === 'young' ? 'Y' : age === 'oldhead' ? 'O' : 'X') >= 0 || (ages.indexOf('A') >= 0 && age !== 'teen');
}
var RD_A = ['Spicy', 'Fluffy', 'Ok', 'Low', 'Quiet', 'Broad', 'Loud', 'Bright', 'Nervous', 'Rare', 'Former', 'Polite', 'Tough', 'Federal', 'Massive', 'Visual', 'Practical', 'Unusual', 'Vegetable', 'Odd', 'Expensive', 'Weekly', 'Equivalent', 'Reasonable', 'Ancient', 'Upstairs', 'Wonderful', 'Pristine', 'Dry', 'Tall'];
var RD_N = ['Antelope', 'Pickle', 'Banana', 'Sandwich', 'Lobster', 'Ostrich', 'Toaster', 'Pineapple', 'Raccoon', 'Badger', 'Walrus', 'Pancake', 'Potato', 'Otter', 'Moose', 'Cactus', 'Bagel', 'Penguin', 'Falcon', 'Turnip', 'Kettle', 'Lamp', 'Sock', 'Biscuit', 'Squirrel'];
var EMO = ['🏁', '🏎️', '🇺🇸', '🔧', '🔥', '🦅', '☕', '🌻', '🎣', '🏈', '⚾', '🐾'];
var COLORS = ['#ffc20e', '#e3202c', '#2f6fff', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#94a3b8', '#eab308', '#14b8a6', '#ef4444', '#8b5cf6', '#0ea5e9', '#84cc16'];
var QUIRKS = {
  teen: ['types in lowercase with almost no punctuation', 'reacts fast and short, sometimes just an emoji', 'stan-account energy for their driver, makes edits', 'borrows streamer and meme slang', 'gets dramatic, then forgets about it a post later', 'replies to big accounts hoping to get noticed'],
  young: ['sarcastic group-chat humor', 'has a fantasy lineup and a bet slip riding on it', 'complains about the broadcast and strategy calls', 'swears mildly', 'loves dunking on bad takes with a quote post', 'brings receipts from old posts when someone is wrong', 'posts hungover on race day', 'treats every race like a fantasy draft'],
  adult: ['dad energy, watches with their kid or their own dad', 'explains pit strategy and fuel mileage nobody asked about', 'grumbles about officiating, dry humor', 'writes full sentences with a shrug at the end', 'mentions work, the grill or a long week', 'tries to be the reasonable one and gets dunked on', 'opens takes like they are controversial when they are not', 'asks the reporter accounts for clarification'],
  oldhead: ['nostalgic: compares everything to the old days', 'thinks there are too many cautions and the cars look the same', 'types sloppy: ellipses, random CAPS, missing punctuation', 'Facebook-comment energy, signs off with an initial now and then', 'thinks the playoff format ruined everything', 'loves the sport and will defend it to the end']
};
function weighted(rand, items, w) { var t = w.reduce(function (a, b) { return a + b; }, 0), r = rand() * t; for (var i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
// X handles: letters, numbers and _ only, 4 to 15 long. Reddit: also -, up to 20.
function clean(h, forum) { h = String(h).replace(forum ? /[^A-Za-z0-9_\-]/g : /[^A-Za-z0-9_]/g, ''); return h.length > (forum ? 20 : 15) || h.length < 4 ? '' : h; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
var BORN = { teen: [2007, 2011], young: [1992, 2003], adult: [1971, 1991], oldhead: [1948, 1970] };
// Real handles are mostly boring: names, initials, birth years, home state, a car number, a truck brand, a football team.
// Racing-themed handles are the minority, and auto-generated Reddit names are common.
function handleFor(age, level, drv, rand, first, platform, last, born, place) {
  var fem = !!FEM[first.toLowerCase()];
  var P = function (a) { return J.pick(rand, a); }, f = first.toLowerCase(), F = cap(f), l = last.toLowerCase(), L = last, fi = f.charAt(0), li = l.charAt(0);
  var yy = String(born).slice(2), yyyy = String(born), n2 = String(1 + Math.floor(rand() * 98)), n3 = String(100 + Math.floor(rand() * 899)), n4 = String(1000 + Math.floor(rand() * 8999));
  var st = (place && place.split(', ')[1]) || 'NC', tag = P(STATE_TAG[st] || ['']), car = drv ? String(drv.car || '').replace(/[^0-9]/g, '') : '', dl = drv ? J.lastName(drv.name).replace(/[^A-Za-z]/g, '') : '';
  if (platform === 'forum') {
    if (rand() < 0.42) return P(RD_A) + P(['_', '-', '']) + P(RD_N) + P(['_', '-', '']) + n4; // Reddit's own suggested names
    return P([f + l + n2, fi + l + yy, f + '_' + l, 'the' + f + l, f + P(['racing', 'raceday', '_turns_left', 'fan']) + n2, l + '_' + yyyy, tag.toLowerCase() + '_' + f, 'throwaway_' + f + n3, (car ? car + '_' : '') + f + '_' + l, f + li + n4, (dl ? dl.toLowerCase() + 'fan' + n2 : f + 'fan' + n2), P(['loose', 'tight', 'lapped', 'loosewheel', 'greenwhite', 'trackbar']) + '_' + f]);
  }
  var fanOf = drv && level > 0 && rand() < (level === 2 ? 0.55 : 0.25);
  if (fanOf) return P([dl + 'Fan' + n2, dl + car + 'Fan', 'Team' + dl + (rand() < 0.5 ? car : ''), car + F + yy, F + '_' + car, 'No' + car + F, dl + 'Nation' + (rand() < 0.5 ? n2 : ''), f + '4' + dl.toLowerCase(), F + dl + car]);
  if (drv && level === -2 && rand() < 0.2) return P(['AnybodyBut' + car, 'Not' + car + 'Again', dl + 'Overrated', F + 'HatesThe' + car]);
  var plain = [f + l, f + '_' + l, F + L, f + l + n2, f + li + n2, fi + l + n2, F + li + yy, f + '_' + l + yy, fi + fi + l, f + l.slice(0, 3) + n2, l + f.slice(0, 1) + yy, f + yy, 'the_' + f + l, 'Real' + F + L, f + '_' + li + li];
  var hobby = [tag + F + n2, F + tag, tag + '_' + f, P(['Ford', 'Chevy', 'Mopar', 'Tundra']) + (fem ? P(['Girl', 'Fan', 'Gal']) : P(['Guy', 'Fan', 'Man'])) + yy, P(['Silverado', 'F150', 'Ram', 'Duramax', 'Cummins']) + F, F + P(['Hunts', 'Fishes', 'Grills', 'Golfs']), P(['Dawg', 'Vol', 'Bama', 'Tiger', 'Gator', 'Buck']) + F + n2, F + P(['DFS', 'Fantasy', 'Picks']) + (rand() < 0.5 ? yy : ''), 'Coach' + L, (fem ? P(['Mama', 'Momma', 'Nana']) : P(['Papa', 'Pops', 'Big'])) + F + (rand() < 0.5 ? yy : ''), F + 'Racing' + n2, 'Turn' + P(['3', '4', '1']) + F];
  var racing = ['Lapped' + F, F + 'OnTheBox', 'Backstretch' + F, F + 'TwoTires', 'Pit' + P(['Road', 'Box']) + F, F + 'Scanner', 'RaceDay' + F, F + '_Infield', 'Loose' + F + n2];
  var pool = age === 'teen' ? [plain, plain, hobby, racing] : age === 'oldhead' ? [plain, plain, plain, hobby, hobby] : [plain, plain, plain, hobby, hobby, racing];
  var h = P(P(pool));
  if (age === 'teen' && rand() < 0.5) h = h.toLowerCase();
  if (rand() < 0.12) h = h + '_';
  return h;
}
var JOKE_USED = {};
function displayName(age, handle, rand, first, drv, level, last) {
  var fem = !!FEM[first.toLowerCase()];
  var P = function (a) { return J.pick(rand, a); }, f = cap(first), l = last, c = drv && level > 0 ? String(drv.car || '') : '', r = rand();
  var em = rand() < (age === 'teen' ? 0.35 : age === 'young' ? 0.25 : age === 'adult' ? 0.18 : 0.08) ? ' ' + P(EMO) : '';
  if (age === 'teen') return r < 0.4 ? first.toLowerCase() + em : r < 0.6 ? f + ' ' + l.charAt(0) : r < 0.75 && c ? first.toLowerCase() + ' #' + c : r < 0.9 ? f + em : f + ' ' + l;
  if (age === 'young') return r < 0.4 ? f + ' ' + l + em : r < 0.6 ? f + em : r < 0.72 && c ? f + ' | #' + c : r < 0.85 ? f + ' ' + l.charAt(0) + '.' : handle;
  if (age === 'adult') return r < 0.55 ? f + ' ' + l + em : r < 0.7 ? f + em : r < 0.8 ? (fem ? 'Coach ' + l : P(['Coach ', 'Big ']) + (rand() < 0.5 ? l : f)) : r < 0.9 && c ? f + ' ' + l + ' #' + c : f + ' ' + l.charAt(0);
  return r < 0.65 ? f + ' ' + l : r < 0.8 ? f + ' ' + l.charAt(0) : r < 0.9 ? (fem ? P(['Aunt ', 'Nana ', 'Miss ']) : P(['Uncle ', 'Papa ', 'Ol\' '])) + f : f + em;
}
function bioFor(age, rand, drv, level, place, born, first) {
  var fem = !!FEM[String(first).toLowerCase()], P = function (a) { return J.pick(rand, a); }, bits = J.shuffle(INTERESTS.filter(function (x) { return fits(x.split('|')[0], age, fem); }).map(function (x) { return x.split('|')[1]; }), rand).slice(0, rand() < 0.4 ? 1 : rand() < 0.75 ? 2 : 3);
  if (drv && level > 0) bits.splice(Math.floor(rand() * (bits.length + 1)), 0, P(['#' + drv.car + ' fan', J.lastName(drv.name) + ' fan since day one', '#' + drv.car + ' til I die', 'ride or die for the ' + drv.car]));
  if (rand() < 0.12) bits.push('opinions are my own');
  if (rand() < 0.25) return '';
  var sep = P([' | ', '. ', ' / ', ' • ', ', ']);
  var out = bits.map(function (b, i) { return i === 0 ? cap(b) : sep === '. ' ? cap(b) : b; }).join(sep);
  return age === 'teen' && rand() < 0.5 ? out.toLowerCase() : out;
}
function makeFan(S, ds, rand, used, keep, reroll) {
  var age = keep && !reroll ? keep.age : weighted(rand, ['teen', 'young', 'adult', 'oldhead'], [15, 34, 33, 18]);
  var platform = keep && !reroll ? keep.platform : (rand() < (age === 'teen' ? 0.88 : age === 'oldhead' ? 0.5 : 0.62) ? 'x' : 'forum');
  var drv = null, level = 0;
  if (keep && !reroll) { if (keep.stance && keep.stance.driver) { drv = ds.find(function (d) { return d.key === keep.stance.driver; }) || null; level = keep.stance.level; } }
  else if (rand() < 0.7) { drv = weighted(rand, ds, ds.map(function (d, i) { return i < 3 ? 5 : i < 8 ? 3 : i < 20 ? 1.5 : 1; })); level = weighted(rand, [2, 1, -1, -2], [22, 40, 26, 12]); }
  for (var tries = 0; tries < 40; tries++) {
    var first = J.pick(rand, FIRST[age]), last = J.pick(rand, LASTN), b = BORN[age], born = b[0] + Math.floor(rand() * (b[1] - b[0] + 1)), place = rand() < 0.62 ? J.pick(rand, PLACES) : '';
    var h = clean(handleFor(age, level, drv, rand, first, platform, last, born, place), platform === 'forum');
    if (!h || used[h.toLowerCase()]) continue;
    used[h.toLowerCase()] = 1;
    var f = keep || { id: 'f' + (S.fans.length + 1) + J.uid('').slice(-3) };
    f.age = age; f.platform = platform;
    f.stance = drv ? { driver: drv.key, level: level, seen: (S.rep[drv.key] ? S.rep[drv.key].events.length : 0) } : { driver: null, level: 0, seen: 0 };
    f.handle = h; f.name = platform === 'forum' ? h : displayName(age, h, rand, first, drv, level, last); f.v = 3;
    f.color = J.pick(rand, COLORS); f.quirks = J.shuffle(QUIRKS[age], rand).slice(0, 2).join('; '); f.qv = 2;
    f.followers = Math.round(Math.pow(rand(), 3.2) * (age === 'oldhead' ? 900 : 3800)) + 8;
    f.following = Math.round(80 + rand() * (age === 'teen' ? 900 : 600));
    f.place = platform === 'forum' ? '' : place; f.bio = platform === 'forum' ? '' : bioFor(age, rand, drv, level, place, born, first);
    var j0 = Math.max(2008, born + 13), jy = Math.min(2025, j0 + Math.floor(rand() * Math.max(1, 2026 - j0))); f.joined = jy + '-' + String(1 + Math.floor(rand() * 12)).padStart(2, '0');
    f.karma = platform === 'forum' ? Math.round(Math.pow(rand(), 2) * 48000) + 120 : 0;
    return f;
  }
  return null;
}
// New identities for every fan account (same ids, so their posts follow them). reroll also re-picks age, platform and who they cheer for.
// New names, handles and bios for the media personalities (roles and how they post stay the same)
var FIG_FIRST = ['Jamie', 'Kyle', 'Brett', 'Casey', 'Dustin', 'Marty', 'Shannon', 'Trey', 'Lindsey', 'Cole', 'Hailey', 'Rusty', 'Dana', 'Jeff', 'Kristen', 'Reid', 'Toni', 'Grant', 'Bobby', 'Erin', 'Wade', 'Nikki', 'Darrell', 'Skip'];
var FIG_LAST = ['Kraft', 'Pennington', 'Albright', 'Delaney', 'Ruffin', 'Stroud', 'McAllister', 'Hargrove', 'Benton', 'Yates', 'Castellano', 'Dorsey', 'Lockhart', 'Mabry', 'Ingram', 'Vickers', 'Hollis', 'Sapp', 'Rowland', 'Gaither'];
var FIG_BRAND = { tommy: ['LooseWheelTV', 'RedFlagRants', 'TurnFourTV', 'WideOpenRacing', 'PitWallTV'], sam: ['LapByLapStats', 'LoopDataLive', 'StintStats', 'RaceByNumbers', 'GreenFlagData'], pod: ['TheBumpDraftPod', 'DraftingRoomPod', 'TwoTirePod', 'PitRoadPodcast', 'BackstretchPod'], memes: ['CautionClockMemes', 'LeftTurnMemes', 'DebrisCautionHQ', 'WreckedMemes', 'InfieldMemes'] };
AI.regenFigures = function (S) {
  var rand = J.rng('figs' + S.id + Date.now()), used = {}, out = {};
  Object.keys(J.FIGURE_BASE).forEach(function (k) {
    var b = J.FIGURE_BASE[k], first, last, name, handle;
    for (var t = 0; t < 30; t++) { first = J.pick(rand, FIG_FIRST); last = J.pick(rand, FIG_LAST); if (!used[first] && !used[last]) break; }
    used[first] = used[last] = 1;
    if (FIG_BRAND[k]) { var br = J.pick(rand, FIG_BRAND[k]); name = k === 'tommy' ? first + ' ' + last : br.replace(/([a-z])([A-Z])/g, '$1 $2'); handle = '@' + br; }
    else { name = first + ' ' + last; handle = '@' + J.pick(rand, [first + last, first + last + 'Racing', first + 'On' + J.pick(rand, ['PitRoad', 'TheBox', 'TheWall', 'Track']), last + 'Reports', first.charAt(0) + last + 'NASCAR']).slice(0, 15); }
    if (k === 'tommy') handle = '@' + J.pick(rand, FIG_BRAND.tommy);
    var fl = Math.round((parseFloat(b.followers) || 100) * (0.6 + rand() * 0.9)), fol = /M$/.test(b.followers) ? (fl / 1).toFixed(1) + 'M' : fl + 'K';
    out[k] = { name: name, handle: handle, followers: fol };
  });
  S.figureOverrides = out; J.useFigures(S); return out;
};
AI.regenFans = function (S, reroll) {
  var ds = J.roster(S); if (!ds.length) return 0;
  var rand = J.rng('regen' + S.id + Date.now()), used = {};
  S.fans.forEach(function (f) { makeFan(S, ds, rand, used, f, reroll); });
  return S.fans.length;
};
AI.ensureFans = function (S) {
  var ds = J.roster(S); if (!ds.length) return false;
  var target = Math.min(170, Math.max(140, ds.length + 100)), rand = J.rng('fans2' + S.id + S.fans.length + ':' + S.races.length), used = {};
  S.fans.forEach(function (f) { if (f.v === 3) used[String(f.handle).toLowerCase()] = 1; });
  S.fans.forEach(function (f) { if (f.v !== 3) makeFan(S, ds, rand, used, f); }); // older accounts get real-world style handles, names and profiles (same id and stance)
  S.fans.forEach(function (f) { if (f.qv !== 2 && QUIRKS[f.age]) { f.quirks = J.shuffle(QUIRKS[f.age], rand).slice(0, 2).join('; '); f.qv = 2; } }); // quirks used to name catchphrases, which got repeated
  var guard = 0;
  while (S.fans.length < target && guard++ < 600) { var f = makeFan(S, ds, rand, used, null); if (f) S.fans.push(f); }
  return true;
};

/* ---------- context builders ---------- */
function standingsText(S, n, races) {
  var main = J.standings(S, races || S.races).slice(0, n || 10).map(function (d, i) { return (i + 1) + '. ' + d.name + ' ' + d.pts + ' pts' + (d.wins ? ' (' + d.wins + (d.wins === 1 ? ' win' : ' wins') + ')' : ''); }).join('; ');
  var pt = J.partTimers(S, races || S.races).slice(0, 8).map(function (d) { var sh = J.sharesCar(S, d.key); return d.name + ' (#' + (d.car || '?') + (sh.length ? ', shares it with ' + sh.slice(0, 3).join(', ') : '') + ')'; });
  return main + (main && pt.length ? '. PART-TIME drivers (not in the championship points, never call them points leaders or say they are in the playoff hunt): ' + pt.join('; ') : '');
}
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
  var cu = info.rows.map(function (r) { var c = S.contracts && S.contracts[J.driverKey(r.driver)]; return c && c.callup ? r.driver + ' (' + ((J.SERIES[c.callup] || {}).label || c.callup) + ' regular making a call-up start, finished P' + r.position + ')' : ''; }).filter(Boolean);
  if (cu.length) lines.push('Call-up starts this race: ' + cu.join('; ') + '.');
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
  var before = racesBefore(S, sid), ran = S.races.some(function (x) { return x.sid === sid; });
  if (ran) lines.push('(This preview is written as of the morning of the race, so it must not know or hint at how the race turned out.)');
  if (before.length) {
    lines.push('Points standings going in: ' + standingsText(S, 10, before) + '.');
    var T = r.type || J.guessType(r.track || r.name), form = J.agg(before).map(function (d) { var h = d.hist.filter(function (x) { var rc = S.races.find(function (q) { return q.id === x.raceId; }); return rc && J.raceType(S, rc) === T; }); return { n: d.name, c: h.length, avg: h.length ? h.reduce(function (a, b) { return a + b.pos; }, 0) / h.length : 99 }; }).filter(function (x) { return x.c; }).sort(function (a, b) { return a.avg - b.avg; }).slice(0, 6);
    if (form.length) lines.push('Best average finish at ' + (J.TYPES[T] || '').toLowerCase() + ' tracks so far: ' + form.map(function (x) { return x.n + ' ' + x.avg.toFixed(1) + ' (' + x.c + ')'; }).join(', ') + '.');
    var prevAt = before.filter(function (x) { return r.track && x.track === r.track; }).pop();
    if (prevAt) lines.push('Last time here (' + prevAt.name + '): won by ' + J.raceInfo(prevAt).winner.driver + '.');
    var last = before[before.length - 1]; if (last) lines.push('Previous race: ' + last.name + ', won by ' + J.raceInfo(last).winner.driver + '.');
  } else lines.push('This is the first race of the season, so there are no points yet.');
  return lines.join('\n');
};
function racesBefore(S, sid) {
  var idx = S.schedule.findIndex(function (x) { return x.id === sid; }), r = S.schedule[idx], day = J.roundDate(S, sid);
  return S.races.filter(function (x) {
    if (x.sid === sid) return false;
    var j = S.schedule.findIndex(function (q) { return q.id === x.sid; });
    if (idx >= 0 && j >= 0) return j < idx;
    return day && x.date ? x.date < day : true;
  });
}
AI.racesBefore = racesBefore;
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

/* ---------- repetition control ----------
   Reads what is already on the site and lists phrases and openers that have been used too often, so every prompt can
   ban them. Driver names, track names and plain grammar ("in the", "of the") are ignored. */
var STOPW = {}; ('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they we you i me my our your his her their them him us not no so too very just than then there here what which who whom when where why how all any both each few more most other some such only own same can will would should could do does did done has have had having up down out off over under again once about into through during before after above below between also yet still really get got gonna its im dont cant thats hes shes theyre youre').split(' ').forEach(function (w) { STOPW[w] = 1; });
function words(t) { return String(t || '').toLowerCase().replace(/https?:\S+/g, ' ').replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean); }
AI.wornOut = function (S, extraTexts) {
  var nameW = {}; J.roster(S).forEach(function (d) { words(d.name).forEach(function (w) { nameW[w] = 1; }); });
  S.schedule.forEach(function (r) { words(r.name + ' ' + r.track).forEach(function (w) { nameW[w] = 1; }); });
  Object.keys(J.FIGURES).forEach(function (k) { words(J.FIGURES[k].name).forEach(function (w) { nameW[w] = 1; }); });
  var texts = S.posts.slice(-260).map(function (p) { return p.text; })
    .concat(S.articles.slice(0, 30).map(function (a) { return a.headline + '. ' + (a.dek || '') + '. ' + a.body; }))
    .concat(['chase', 'race', 'season'].map(function (k) { return S.ai[k] ? S.ai[k].headline + '. ' + S.ai[k].summary + ' ' + Object.keys(S.ai[k].notes || {}).map(function (x) { return S.ai[k].notes[x]; }).join(' ') : ''; }))
    .concat(extraTexts || []);
  var cnt = {}, openers = {};
  texts.forEach(function (t) {
    var w = words(t), seen = {};
    for (var n = 2; n <= 5; n++) for (var i = 0; i + n <= w.length; i++) {
      var g = w.slice(i, i + n); if (g.every(function (x) { return STOPW[x] || nameW[x] || /^\d+$/.test(x); })) continue;
      if (g.some(function (x) { return nameW[x]; })) continue;
      var real = g.filter(function (x) { return !STOPW[x]; }).length; if (n === 2 && real < 2) continue;
      var k = g.join(' '); if (!seen[k]) { seen[k] = 1; cnt[k] = (cnt[k] || 0) + 1; }
    }
    if (w.length >= 3) { var o = w.slice(0, 2).join(' '); openers[o] = (openers[o] || 0) + 1; }
  });
  var keep = Object.keys(cnt).filter(function (k) { var n = k.split(' ').length; return cnt[k] >= (n === 2 ? 6 : n === 3 ? 3 : 2); });
  keep = keep.filter(function (k) { return !keep.some(function (o) { return o !== k && o.indexOf(k) >= 0 && cnt[o] >= cnt[k] - 1; }); });
  keep.sort(function (a, b) { return cnt[b] * b.split(' ').length - cnt[a] * a.split(' ').length; });
  var op = Object.keys(openers).filter(function (k) { return openers[k] >= 3 && !k.split(' ').every(function (x) { return nameW[x]; }); }).sort(function (a, b) { return openers[b] - openers[a]; });
  return { phrases: keep.slice(0, 45), openers: op.slice(0, 14) };
};
function wornText(S) {
  var w = AI.wornOut(S); if (!w.phrases.length && !w.openers.length) return '';
  return 'WORN OUT ON THIS SITE ALREADY (each has been used several times; do not use these phrases or close variants, find new words): ' + w.phrases.map(function (p) { return '"' + p + '"'; }).join(', ')
    + (w.openers.length ? '\nOVERUSED WAYS TO START A POST (do not open with these): ' + w.openers.map(function (p) { return '"' + p + '..."'; }).join(', ') : '');
}
AI.wornText = wornText;
/* near-duplicate check: same short reply over and over, or a long post that mostly repeats an earlier one */
function shingles(t) { var w = words(t), out = {}; for (var i = 0; i + 3 <= w.length; i++) { var g = w.slice(i, i + 3); if (g.every(function (x) { return STOPW[x]; })) continue; out[g.join(' ')] = 1; } return out; }
function tooSimilar(text, pool) {
  var w = words(text), norm = w.join(' '); if (!norm) return true;
  if (w.length <= 4) return pool.short[norm] >= 1;
  var a = shingles(text), ak = Object.keys(a); if (!ak.length) return false;
  for (var i = 0; i < pool.long.length; i++) { var b = pool.long[i], inter = 0; ak.forEach(function (k) { if (b[k]) inter++; }); if (inter >= 3 && inter / ak.length >= 0.6) return true; }
  return false;
}
function simPool(S) {
  var pool = { short: {}, long: [] };
  S.posts.slice(-300).forEach(function (p) { addPool(pool, p.text); });
  return pool;
}
function addPool(pool, text) { var w = words(text); if (w.length <= 4) { var k = w.join(' '); pool.short[k] = (pool.short[k] || 0) + 1; } else pool.long.push(shingles(text)); }

/* rotating vocabulary: each batch gets a few slang words and reply types to draw from, so the same ones do not show up every time */
var SLANG = ['lowkey', 'highkey', 'no shot', 'ain\'t no way', 'be so serious', 'it\'s giving', 'touch grass', 'I\'m crying', 'chat is this real', 'the way he', 'not him again', 'respectfully', 'mid', 'washed', 'fraud watch', 'he\'s HIM', 'down bad', 'say less', 'we been knew', 'the audacity', 'bffr', 'tweaking', 'cooked (sparingly)', 'he ate', 'peak', 'cinema', 'aura', 'unc', 'unserious', 'nah because', 'genuinely', 'insane behavior', 'invisible all day', 'free him', 'locked in', 'fumbled', 'menace', 'he\'s so back', 'it\'s over for him', 'built different'];
var SHORT = ['ratio', 'nah', 'L', 'W', 'real', 'source?', 'this', 'LMAO', 'cope', 'lol', 'fair', 'and?', 'no', 'facts', 'who asked', 'huh', 'yikes', 'easy', 'ok and', 'bruh', 'sure', 'wrong', 'clip it', 'called it', 'meh', 'boring', 'stop', 'wait what', 'hm', 'yep', 'nope', '??', 'oof', 'agreed'];
var ANGLES = ['a "rate the race" post (people give it a score out of 10)', 'driver ratings out of 10 after the race', 'a "this you?" quote of somebody\'s old take', 'a reporter posting a small nugget from the garage', 'a post-race thread on the subreddit', 'a fantasy or DFS argument', 'the broadcast or a camera miss', 'a pit call being second-guessed', 'a driver in a slump', 'a mid-pack surprise', 'an officiating or rules gripe', 'a stat that starts a fight', 'who is best at this kind of track', 'a nostalgic comparison to the old days', 'the cut line math', 'a rumor from the insider', 'a meme format described in words', 'somebody\'s watch party or race-day setup', 'a crew chief decision', 'tire wear or fuel', 'a young driver getting hype', 'a hot take that gets dragged', 'a prediction for next week', 'a driver everybody forgot about', 'someone who only watched the last 10 laps', 'a ranking or tier list', 'someone asking an honest newbie question', 'a callback to a post that aged badly', 'a rivalry heating up'];
function fanStyle(rand) {
  var slang = J.shuffle(SLANG, rand).slice(0, 5), short = J.shuffle(SHORT, rand).slice(0, 7);
  return FAN_STYLE.replace('{SLANG}', slang.map(function (x) { return '"' + x + '"'; }).join(', ')).replace('{SHORT}', short.map(function (x) { return '"' + x + '"'; }).join(', '));
}

/* ---------- Garage: threads ---------- */
var FAN_STYLE = 'YOU ARE WRITING REAL-LOOKING NASCAR SOCIAL MEDIA (X/Twitter and the r/NASCAR subreddit) FOR A SIM-RACING LEAGUE SITE.\n'
  + 'It has to pass as real posts from real people in the mid 2020s. If it reads like a brand account, a press release or an AI, it fails.\n\n'
  + 'HOW PEOPLE ACTUALLY POST NOW\n'
  + '- Most posts are short and lowercase-leaning. Many are one line. Punctuation is optional. Nobody writes a tidy paragraph on X unless they are an analyst or mad.\n'
  + '- Real reply culture: dunks, very short replies, people misreading the post, people answering a question nobody asked, someone posting a stat to end the argument, someone digging up an old post, someone tagging @ an account. Short replies you can draw from in THIS batch (each at most once, and you can invent others): {SHORT}.\n'
  + '- Modern slang in small doses, only from young people. Slang available for THIS batch (each at most once in the whole batch, many posts use none): {SLANG}. Older people do NOT talk like this.\n'
  + '- VARIETY IS THE WHOLE JOB. No two posts may share a phrase of 3+ words. No two posts may start with the same two words. Do not reuse a joke structure. A person\'s quirk is a tendency, not a catchphrase: it should show in maybe one of their posts, phrased differently each time.\n'
  + '- Emoji: teens and young adults use 💀 😭 🫡 🤡 📉 🐐 🔥 sometimes (max one or two, and many posts have none). Adults rarely. Old-heads use 👍 or none.\n'
  + '- Quote posts: someone quotes an earlier post with their own short take on top ("quote": index). Polls: big accounts and some fans post polls ("poll": 2 to 4 short options). Use one or two of each across the whole batch, not every thread.\n'
  + '- Reddit (forum) is different: posts have a title, comments are longer and nerdier, people say "Edit: ...", "Came here to say this", correct each other on facts, and the top comment is usually a joke. Reddit users never use display names or emoji much.\n\n'
  + 'HOW REAL FANS TALK ABOUT DRIVERS\n'
  + '- Almost never the full name. Last name ("Creed"), first name for favorites ("Sheldon"), the car number ("the 00", "the 7 car"), or a nickname the fanbase uses. Teams by the owner or shop name only if it is in the facts.\n'
  + '- People get small things wrong, misremember a finish by a spot, and get corrected in the replies. People argue about what they saw on TV, not what is in a stats table. Only analysts and stats accounts quote exact numbers.\n'
  + '- Most fans post because they feel something (annoyed, hyped, smug, bored), not to inform. A lot of posts are reactions to one moment: a restart, a pit call, a block, the broadcast cutting to commercial.\n\n'
  + 'THINGS THAT GIVE AWAY AI (never do these)\n'
  + '- No em dashes or en dashes. No semicolons in fan posts. No "Absolutely", "Truly", "a testament to", "showcasing", "masterclass", "electric atmosphere", "what a race, folks", "the field", "it is worth noting", "let\'s dive in".\n'
  + '- No ending a post with a neat summary line or a question to the audience unless it is a poll or a podcast account. No hashtags except the rare one a real person would use. No two posts built the same way.\n'
  + '- Not every post is about the top 3. Fans of midpack drivers talk about P14 like it was a win.\n\n'
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
  + '4. Never open two posts the same way. No repeated jokes or phrases, including anything in the RECENT POSTS and WORN OUT lists. Do not echo the headline.\n'
  + '5. Banned, they read as AI: cooking/cooked, no crumbs, masterclass, chef\'s kiss, no notes, buckle up, hold my beer, rent free, this is the way, "let\'s gooo", "absolute scenes", "what a race folks", hashtags (except a rare #NASCAR from an old-head), em dashes, "folks", "y\'all ready".\n'
  + '6. Typos and bad grammar are fine where the person would make them. Not everyone is funny. Some posts are boring or just wrong.\n'
  + '7. Spread it out: not everything is about the winner. Mid-pack drivers, the broadcast, fantasy, a bad pit call, someone\'s own bad day, a random hot take.\n'
  + '8. Prominent accounts keep their own voice (listed below) and get big reactions. Fans reply to them, argue with them, quote them and @ them.\n'
  + 'This is a simulated sim-racing league. Everything stays on the racing.';
var THREAD_SCHEMA = 'Return ONLY JSON: {"threads":[{"platform":"x" or "forum","title":"forum threads only","posts":[{"by":"<persona id or figure id>","text":"...","replyTo":null or <index of an earlier post in this thread>,"quote":<optional index of an earlier post this one quote-posts>,"poll":<optional ["option","option"]>}]}]}\nThe first post of every thread has replyTo null. Every other post replies to an earlier post by index. A quote post usually has replyTo null only when it is the first post of a new thread quoting nothing; inside a thread give it replyTo AND quote.';

function figureLines() { return Object.keys(J.FIGURES).map(function (k) { var f = J.FIGURES[k]; return k + ' = ' + f.name + ' ' + f.handle + ' (' + f.badge.toLowerCase() + '): ' + f.voice; }).join('\n'); }
AI.threads = async function (S, o) {
  if (!o.at && J.dated(S)) o.at = J.leagueNow(S) + 2 * 60000;
  AI.ensureFans(S); if (!S.fans.length) throw new Error('Import a race, practice or qualifying first so there are drivers for the fans to talk about.');
  var rand = J.rng('pick' + Date.now());
  var focus = {}; (o.focus || []).forEach(function (n) { var d = J.findDriver(S, n); if (d) focus[d.key] = 1; });
  var fans = S.fans.slice(), pri = fans.filter(function (f) { return f.stance && focus[f.stance.driver]; }), rest = J.shuffle(fans.filter(function (f) { return !(f.stance && focus[f.stance.driver]); }), rand);
  var chosen = J.shuffle(pri, rand).slice(0, 14).concat(rest).slice(0, 34);
  var recent = S.posts.slice(-30).map(function (p) { return '- ' + p.text.slice(0, 90); }).join('\n');
  var angles = J.shuffle(ANGLES.filter(function (x) { return J.talkPhase(S).playoff >= 2 || !/cut line/.test(x); }), rand).slice(0, 8), worn = wornText(S);
  var rumors = J.sillyActive(S).slice(-5).map(function (x) { return x.title + ' (' + J.SILLY_LABEL[x.stage].toLowerCase() + ')'; });
  var lastRace = S.races[S.races.length - 1], extra = [];
  if (lastRace) {
    var shown = {}; J.raceInfo(lastRace).rows.slice(0, 15).forEach(function (r) { shown[J.driverKey(r.driver)] = 1; });
    var want = {}; chosen.forEach(function (f) { if (f.stance && f.stance.driver && !shown[f.stance.driver]) want[f.stance.driver] = 1; });
    lastRace.rows.forEach(function (r) { var k = J.driverKey(r.driver); if (want[k]) extra.push(r.driver + ' finished P' + r.position + ' (started P' + (r.start || '?') + (J.isDnf(r) ? ', ' + r.status : '') + (r.interval && /(\d+)\s*l/i.test(r.interval) ? ', ' + (function (n) { return n + (n === '1' ? ' lap' : ' laps'); })(r.interval.match(/(\d+)\s*l/i)[1]) + ' down' : '') + ')'); });
  }
  var tp = J.talkPhase(S), cp = tp.playoff ? J.chasePicture(S) : null, cutTxt = cp && cp.lastIn && cp.firstOut ? (tp.playoff === 1 ? '(Background only: just stats accounts or the analyst would mention this, as an aside.) ' : '') + S.chase.name + ' cut line right now: ' + cp.lastIn.name + ' is the last driver in on points, ' + cp.firstOut.name + ' the first out, ' + Math.abs(cp.lastIn.pts - cp.firstOut.pts) + ' points apart.' : '';
  var heads = S.articles.slice(0, 5).map(function (a) { return '"' + a.headline + '" (' + (J.OUTLETS[a.outlet] || J.OUTLETS.wire).name + ')'; });
  var user = 'LEAGUE: ' + S.league.name + ' (' + S.series.label + '), ' + J.seasonYear(S) + ' season. Races run: ' + S.races.length + ' of ' + Math.max(S.schedule.length, S.races.length) + '.\n\n'
    + 'FACTS (use only these):\n' + o.facts + (extra.length ? '\nOther drivers the fans below follow, last race: ' + extra.join('; ') + '.' : '') + (cutTxt ? '\n' + cutTxt : '') + '\n\n'
    + J.talkLine(S) + '\n\n'
    + (o.story ? 'THE STORY EVERYONE IS REACTING TO: "' + o.story.headline + '" - ' + (o.story.dek || '') + '\n\n' : '')
    + (heads.length ? 'LATEST HEADLINES ON THE SITE (people may react to or argue with these): ' + heads.join('; ') + '\n\n' : '')
    + 'DRIVER REPUTATION (0-100, higher = more liked): ' + repText(S) + '\n\n'
    + (rumors.length ? 'SILLY SEASON STORYLINES PEOPLE ARE TALKING ABOUT (unconfirmed unless it says confirmed): ' + rumors.join('; ') + '\n\n' : '')
    + (recent ? 'RECENT POSTS ALREADY ON THE SITE (do not repeat their wording, jokes or openers):\n' + recent + '\n\n' : '')
    + (worn ? worn + '\n\n' : '')
    + 'FANS YOU MAY WRITE AS (id | handle | display name | platform | age | stance | quirks):\n' + chosen.map(function (f) { return personaLine(S, f); }).join('\n') + '\n\n'
    + 'PROMINENT ACCOUNTS (id = name handle (role): voice):\n' + figureLines() + '\n\n'
    + 'TASK: ' + (o.task || 'Write 7 to 9 threads reacting to the facts and the story.') + ' About two thirds should be platform "x" (3 to 7 posts each), the rest "forum" (5 to 9 posts with comment chains). Use at least 18 different fans and at least 5 different prominent accounts. Include one or two quote posts and one poll somewhere. Every fan\'s stance must show in how they talk about that driver. ' + (o.race ? 'Give each thread a different angle ON THIS RACE (the angle is flavor; the subject is still what happened in this race): ' : 'Give each thread a different angle; use these for this batch, one per thread: ') + angles.join('; ') + '.\n\n' + THREAD_SCHEMA;
  var res = await AI.json({ system: fanStyle(rand), user: user, role: 'chatter', maxTokens: 9000 });
  var n = AI.applyThreads(S, res, o.ref, o.at);
  if (!n) throw new Error(AI.name() + ' did not write any usable fan posts. Try again.');
  return n;
};
AI.applyThreads = function (S, res, ref, at) {
  var now = Date.now(), added = 0, dropped = 0, ok = {}, pool = simPool(S), fresh = []; S.fans.forEach(function (f) { ok[f.id] = f; });
  (res.threads || []).forEach(function (th, ti) {
    var plat = th.platform === 'forum' ? 'forum' : 'x', tid = J.uid('t'), ids = [], clock;
    clock = at ? at + (3 + ti * (4 + Math.floor(Math.random() * 11))) * 60000 : now - (2 + ti * (3 + Math.floor(Math.random() * 9))) * 60000;
    var limit = at ? Infinity : now;
    (th.posts || []).forEach(function (p, pi) {
      var by = null, text = String(p.text || '').trim(); if (!text) return;
      if (J.FIGURES[p.by]) by = { type: 'figure', id: p.by }; else if (ok[p.by]) by = { type: 'fan', id: p.by }; else return;
      var parent = null; if (pi > 0) { var pr = p.replyTo; parent = (typeof pr === 'number' && ids[pr]) ? ids[pr] : (ids[0] || null); } else if (ids.length) return;
      text = text.replace(/\s+[—–]\s+/g, ', ').slice(0, plat === 'forum' ? 1400 : 560);
      if (tooSimilar(text, pool)) { dropped++; if (pi === 0) { ids = []; return; } ids[pi] = parent; return; } // repeat: skip it, its replies attach to its parent
      addPool(pool, text);
      clock += (1 + Math.floor(Math.random() * 6)) * 60000; if (clock > limit) clock = limit - Math.floor(Math.random() * 40000);
      if (pi > 0 && !ids[0]) return; // thread opener was a repeat, drop the thread
      var id = J.uid('p'); ids[pi] = id;
      var post = { id: id, thread: tid, parent: parent, platform: plat, title: pi === 0 && plat === 'forum' ? String(th.title || '').slice(0, 140) : '', by: by, text: text, ts: clock, ref: ref || null };
      if (typeof p.quote === 'number' && ids[p.quote] && ids[p.quote] !== id) post.quote = ids[p.quote];
      if (Array.isArray(p.poll) && p.poll.length >= 2) post.poll = p.poll.slice(0, 4).map(function (x) { return String(x).slice(0, 40); });
      S.posts.push(post); added++; if (fresh.indexOf(tid) < 0) fresh.push(tid);
    });
  });
  AI.lastDropped = dropped;
  J.trimThreads(S, 110, fresh); // never trims what was just written
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
var NEWS_SCHEMA = 'Return ONLY JSON: {"article":{"headline":"...","dek":"one sentence","body":"paragraphs separated by a blank line","tags":["Driver Name"],"photoCaptions":["caption for image 1","..."],"extras":{"pullQuote":{"text":"a striking line from the story or an interview","by":"who said it"},"keyMoments":[{"when":"Lap 112 or Stage 2 or Friday practice","text":"what happened"}],"byNumbers":[{"value":"3","label":"wins this season"}],"takeaways":["short point"],"whatsNext":"one sentence about what comes next"}},"interviews":[{"driver":"Full Name as in standings","quote":"...","tone":"gracious|salty|cocky|humble|fired up|frustrated","repDelta":-6 to 6,"why":"short reason fans would react"}],"reputation":[{"driver":"Full Name","delta":-8 to 8,"why":"the on-track moment that changed how fans see them"}]}\nreputation is for on-track moments (clean pass for the win, a block, a wreck someone caused, good sportsmanship). Mostly small numbers (1 to 4), rarely 6 or more. Leave arrays empty if nothing applies.\nextras make the story page richer: 3 to 6 keyMoments (in order, only real moments from the data), 3 or 4 byNumbers (numbers taken straight from the data, never invented), 2 to 4 takeaways, one pullQuote. For a silly season story keyMoments can be the timeline of the rumor. Omit any part you cannot ground in the data.';

AI.articleDraft = async function (S, o) {
  var outlet = o.outlet || 'wire', race = o.race || null, parts = [];
  parts.push('LEAGUE STANDINGS NOW: ' + (standingsText(S, 12) || 'no races run yet') + '.');
  if (race) parts.push('RACE DATA:\n' + AI.raceFacts(S, race));
  else if (o.preSid) parts.push('PRE-RACE DATA (this story is a PREVIEW written the morning of the race):\n' + AI.sessionFacts(S, o.preSid));
  if (outlet === 'silly') { var ph = J.sillyPhase(S), act = J.sillyActive(S); parts.push('WHERE THE SEASON IS (silly season calendar): ' + ph.label + '. ' + ph.guide + (act.length ? ' Storylines already running: ' + act.map(function (x) { return x.title + ' (' + J.SILLY_LABEL[x.stage].toLowerCase() + ')'; }).join('; ') + '.' : '')); }
  if (o.headline) parts.push('COMMISSIONER\'S WORKING HEADLINE (this is the topic; keep its meaning, you may sharpen the wording): ' + o.headline);
  if (o.notes) parts.push('COMMISSIONER\'S NOTES (facts you may use):\n' + o.notes);
  if (o.images && o.images.length) parts.push(o.images.length + ' image(s) are attached in this order: ' + o.images.map(function (im, i) { return (i + 1) + '=' + (im.label || 'untitled'); }).join(', ') + '. Add one caption per image in photoCaptions.');
  parts.push('DRIVER REPUTATION RIGHT NOW (0-100): ' + repText(S));
  var tp = J.talkPhase(S); parts.push('WHERE THE SEASON IS: ' + tp.label + ' (race ' + tp.run + ' of ' + tp.total + '). WHAT REAL NASCAR MEDIA COVERS AT THIS POINT: ' + tp.media + (tp.playoff ? '' : ' Leave ' + J.theChase(S) + ' and the cut line out unless the commissioner\'s notes bring it up.'));
  var worn = wornText(S); if (worn) parts.push(worn);
  parts.push('Write the story now. ' + (o.interviews === false ? 'Return an empty interviews array.' : 'Include 2 to 3 pit road interviews tied to the story.') + '\n\n' + NEWS_SCHEMA);
  return AI.json({ system: newsSystem(S, outlet), user: parts.join('\n\n'), images: o.images || [], role: 'writer', maxTokens: 6500 });
};
AI.article = async function (S, o) {
  var res = await AI.articleDraft(S, o), race = o.race || null;
  return AI.applyArticle(S, res, { outlet: o.outlet || 'wire', raceId: race ? race.id : '', preSid: o.preSid || '', media: o.mediaIds || [], replaceAutoFor: race ? race.id : null, ts: o.ts });
};
function cleanExtras(x) {
  if (!x || typeof x !== 'object') return null;
  var str = function (v, n) { return String(v == null ? '' : v).slice(0, n).trim(); }, out = {};
  if (x.pullQuote && x.pullQuote.text) out.pullQuote = { text: str(x.pullQuote.text, 240), by: str(x.pullQuote.by, 60) };
  out.keyMoments = (Array.isArray(x.keyMoments) ? x.keyMoments : []).filter(function (m) { return m && m.text; }).slice(0, 8).map(function (m) { return { when: str(m.when, 30), text: str(m.text, 220) }; });
  out.byNumbers = (Array.isArray(x.byNumbers) ? x.byNumbers : []).filter(function (m) { return m && m.value != null && m.label; }).slice(0, 6).map(function (m) { return { value: str(m.value, 12), label: str(m.label, 60) }; });
  out.takeaways = (Array.isArray(x.takeaways) ? x.takeaways : []).map(function (t) { return str(t, 200); }).filter(Boolean).slice(0, 5);
  if (x.whatsNext) out.whatsNext = str(x.whatsNext, 240);
  return out;
}
AI.applyArticle = function (S, res, o) {
  var a = res.article || {}; if (!a.headline || !a.body) throw new Error(AI.name() + ' returned a story without a headline or body.');
  var staff = (J.OUTLETS[o.outlet] || J.OUTLETS.wire).staff, now = o.ts || Date.now();
  var art = { id: J.uid('a'), outlet: o.outlet, headline: String(a.headline).slice(0, 160), dek: String(a.dek || '').slice(0, 260), body: String(a.body), author: staff[Math.floor(Math.random() * staff.length)], ts: now, raceId: o.raceId || '', preSid: o.preSid || '', tags: (a.tags || []).slice(0, 6).map(String), media: o.media || [] };
  art.extras = cleanExtras(a.extras);
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
  wire: 'OUTLET_WIRE (race coverage): previews, recaps, points-race news. Straight news voice. 350 to 550 words.',
  silly: 'OUTLET_SILLY (contracts, rides, sponsors, crew chiefs, rumors): league fiction about rides, contracts, sponsors, crew chiefs or team moves ONLY. Follow the SILLY SEASON CALENDAR below for what is realistic right now. One storyline per story. Prefer moving an existing storyline forward (or killing it) over starting a new one. Sourcing like "per sources", "is said to be", "nothing is signed" until a storyline is confirmed. Never personal life, money figures, legal trouble or health. 300 to 450 words.',
  notes: 'OUTLET_NOTES (analysis and features): one angle the data supports (momentum, cut-line math, a track-type trend, a rivalry, a slump), argued with numbers. A few "## " subheads allowed. 450 to 650 words.'
};
function deskText(k) { return String(DESK[k]).replace('OUTLET_WIRE', J.OUTLETS.wire.name).replace('OUTLET_SILLY', J.OUTLETS.silly.name).replace('OUTLET_NOTES', J.OUTLETS.notes.name); }
function deskNotes(S) {
  var tp = J.talkPhase(S), fm = ['power rankings', 'winners and losers', 'what we learned', 'by the numbers', 'a trend at this kind of track', 'a driver feature', 'who is hot and who is not', 'a rivalry or grudge'];
  if (tp.playoff >= 2) fm = ['bubble watch', 'what each driver needs', J.theChase(S) + ' picture'].concat(fm.slice(0, 4));
  return J.OUTLETS.notes.name + ' (analysis and features): one angle the data supports, argued with real numbers. Pick a format that fits and that the RECENT HEADLINES have not used lately: ' + fm.join(', ') + '.' + (tp.playoff ? '' : ' Not the cut line: it is too early for that.') + ' A few "## " subheads allowed. 450 to 650 words.';
}
function sillyBlock(S) {
  var ph = J.sillyPhase(S), all = (S.silly || []).slice(-10);
  return 'SILLY SEASON CALENDAR: ' + ph.label + ' (race ' + ph.run + ' of ' + ph.total + '; field for ' + S.chase.name + ' set after race ' + ph.cut + '). ' + ph.guide + ' The furthest a storyline may go right now: "' + ph.maxStage + '".'
    + '\nSTORYLINE STAGES in order: whisper, rumor, talks, close, confirmed (or dead if it falls through). A storyline moves one stage per story, two at most, and needs at least two earlier stories before it can be confirmed.'
    + (all.length ? '\nSTORYLINES SO FAR (id | title | stage | stories so far | race it started):\n' + all.map(function (x) { return x.id + ' | ' + x.title + ' | ' + x.stage + ' | ' + x.history.length + ' | race ' + x.openedAt; }).join('\n') : '\nNo storylines yet.')
    + contractsBlock(S)
    + '\nFor the ' + J.OUTLETS.silly.name + ' story add "storyline":{"id":"existing id or new","title":"short label, e.g. Gibbs to the 22 for next season","drivers":["Full Name"],"team":"team they are linked to, if any","stage":"..."}.';
}
// contracts, moods and the other series: what a real silly season reporter would know
function contractsBlock(S) {
  var cross = J.crossFor(S), pr = J.sillyPredictions(S, cross).filter(function (x) { return x.p >= 0.12; }).slice(0, 10), out = '';
  if (pr.length) out += '\nCONTRACTS AND MOOD (from the league data; use it, do not contradict it): ' + pr.map(function (x) { return x.name + (x.team ? ' (' + x.team.name + ')' : '') + (x.pt ? ' [part-time]' : '') + ': ' + x.contract.label.toLowerCase() + ', ' + (x.happy ? x.happy.label.toLowerCase() : 'unknown mood') + (x.why.length ? ' because ' + x.why.slice(0, 2).join(' and ') : ''); }).join('; ') + '.';
  var deals = (S.moves || []).filter(function (m) { return m.status === 'approved' || m.status === 'done'; });
  if (deals.length) out += '\nDONE DEALS FOR NEXT SEASON (decided by the league; treat them as fact, report them as official news when the silly season calendar allows a confirmation, otherwise as strong rumors close to done): ' + deals.map(function (m) { return m.name + ' ' + J.moveLine(m, S) + (m.why && m.why.length ? ' (' + m.why[0] + ')' : ''); }).join('; ') + '.';
  var cus = (S.callups || []).filter(function (c) { return c.status === 'approved'; });
  if (cus.length) out += '\nCALL-UPS THIS SEASON: ' + cus.map(function (c) { return c.name + ' (' + ((J.SERIES[c.from] || {}).label || c.from) + ' regular) runs ' + J.plural(c.rounds.length, 'race') + ' in the ' + ((J.SERIES[c.to] || {}).label || c.to) + ' ' + c.team + ' #' + c.car; }).join('; ') + '. A strong call-up is how real drivers earn a full-time ride a series up.';
  var hot = Object.keys(S.contracts || {}).map(function (k) { var t = J.teamView(S, k); return t && t.score < 35 && !(S.contracts[k].pt) ? (S.contracts[k].name || k) + ' (' + t.why.slice(0, 2).join(', ') + ')' : ''; }).filter(Boolean).slice(0, 4);
  if (hot.length) out += '\nHOT SEATS (the team is not happy with the driver): ' + hot.join('; ') + '.';
  if (cross && cross.stars && cross.stars.length) out += '\nRISING STARS ONE SERIES DOWN (' + cross.downLabel + '): ' + cross.stars.map(function (x) { return x.name + ' (' + J.plural(x.wins, 'win') + ', ' + x.avg.toFixed(1) + ' avg finish)'; }).join('; ') + '. Real silly season often links standouts from the series below to open seats.';
  if (cross && cross.upOpen && cross.upOpen.length) out += '\nSEATS THAT COULD OPEN ONE SERIES UP (' + cross.up + '): ' + cross.upOpen.map(function (x) { return x.team + ' (' + x.from + ' may leave)'; }).join('; ') + '. A strong driver here could be linked to one of them.';
  return out;
}
var ORDER = J.SILLY_STAGES;
AI.applyStoryline = function (S, sl, art) {
  if (!sl || !sl.title && !sl.id) return null;
  var ph = J.sillyPhase(S), cap = ORDER.indexOf(ph.maxStage), want = ORDER.indexOf(sl.stage); if (want < 0) want = 1;
  var x = (S.silly || []).find(function (q) { return q.id === sl.id; });
  if (!x) {
    x = { id: J.uid('sl'), title: String(sl.title || art.headline).slice(0, 90), drivers: (sl.drivers || []).slice(0, 3).map(String), team: String(sl.team || '').slice(0, 60), stage: 'whisper', openedAt: S.races.length, history: [] };
    want = Math.min(want, 1); S.silly.push(x);
  } else if (x.stage === 'confirmed' || x.stage === 'dead') return x;
  else if (sl.team && !x.team) x.team = String(sl.team).slice(0, 60);
  var cur = ORDER.indexOf(x.stage), next = want;
  if (next !== 5) { next = Math.min(next, cur + 2, cap); if (next === 4 && x.history.length < 2) next = 3; if (next < cur) next = cur; }
  x.stage = ORDER[next]; x.history.push({ ts: art.ts, stage: x.stage, art: art.id }); art.storyline = x.id;
  S.silly = S.silly.slice(-30);
  return x;
};
AI.newsCycle = async function (S, o) {
  o = o || {}; var phase = o.phase || 'week', parts = [], plan;
  if (!J.roster(S).length) throw new Error('The newsroom needs drivers to write about. Import a race, practice or qualifying first.');
  var nx = J.nextRound(S), race = o.race || (phase === 'post' ? S.races[S.races.length - 1] : null);
  var sp = J.sillyPhase(S), roll = J.rng('silly' + S.races.length + ':' + S.articles.length + ':' + phase)(), wantSilly = o.silly === true || (o.silly !== false && roll < sp.rate);
  if (o.only) plan = o.only.slice();
  else if (phase === 'preseason') plan = ['notes', 'wire', 'silly'];
  else if (phase === 'post') plan = wantSilly ? ['notes', 'silly'] : ['notes'];
  else if (phase === 'pre') plan = ['wire'].concat(S.races.length ? ['notes'] : []).concat(wantSilly ? ['silly'] : []).slice(0, 2);
  else plan = (S.races.length ? ['wire', 'notes'] : ['wire']).concat(wantSilly ? ['silly'] : []);
  var target = o.sid ? S.schedule.find(function (x) { return x.id === o.sid; }) : nx;
  var before = target ? racesBefore(S, target.id) : S.races, ranTarget = target && S.races.some(function (x) { return x.sid === target.id; });
  parts.push('LEAGUE STANDINGS' + (phase === 'post' ? ' NOW' : ' GOING IN') + ': ' + (standingsText(S, 16, phase === 'post' ? S.races : before) || 'no races run yet') + '.');
  var tp = J.talkPhase(S), cp = tp.playoff ? J.chasePicture(S) : null;
  parts.push('WHERE THE SEASON IS: ' + tp.label + ' (race ' + tp.run + ' of ' + tp.total + (tp.left > 0 ? ', ' + tp.left + ' before ' + J.theChase(S) + ' cut' : '') + '). WHAT REAL NASCAR MEDIA COVERS AT THIS POINT: ' + tp.media + (tp.playoff ? '' : ' Do NOT write about ' + J.theChase(S) + ' cut line or playoff math; it is too early and nobody covers it yet.'));
  if (cp && cp.lastIn && cp.firstOut && !ranTarget) parts.push((tp.playoff === 1 ? '(Background; a passing mention at most.) ' : '') +S.chase.name.toUpperCase() + ' PICTURE: top ' + cp.size + ' make it after race ' + cp.cutRace + ' (' + (cp.decided ? 'field is set' : cp.left + ' races left before the cut') + '). ' + (cp.winners ? cp.winners + ' race winner(s) locked in. ' : '') + 'Last in on points: ' + cp.lastIn.name + ' (' + cp.lastIn.pts + '). First out: ' + cp.firstOut.name + ' (' + cp.firstOut.pts + ').');
  if (phase === 'preseason') parts.push(AI.preseasonFacts(S) + '\nTHESE ARE PRESEASON STORIES. The season has not started. ' + J.OUTLETS.notes.name + ' writes the expectations piece: what to expect from the drivers this year, grouped the way real previews do it (title contenders, ' + J.theChase(S) + ' hopefuls, dark horses, rookies and new rides to watch), grounded in the test speeds, last season and the rides. ' + J.OUTLETS.wire.name + ' writes the test session report. ' + J.OUTLETS.silly.name + ' writes about contract years and seats to watch this season. Never invent race results.');
  if (race) parts.push('LATEST RACE:\n' + AI.raceFacts(S, race));
  var preSid = phase === 'post' || phase === 'preseason' ? '' : (o.sid || (nx ? nx.id : ''));
  if (preSid) parts.push('THE RACE THESE STORIES PREVIEW (has NOT been run as of these stories):\n' + AI.sessionFacts(S, preSid));
  else if (nx) parts.push('NEXT RACE (has NOT been run): ' + nx.name + (nx.track ? ' at ' + nx.track : '') + ' (' + J.TYPES[nx.type].toLowerCase() + ')' + (nx.date ? ', ' + nx.date : '') + '.');
  var ro = nx && (!preSid || preSid === nx.id) ? J.raceOutlook(S) : null;
  if (ro && ro.favorites) parts.push('MODEL WIN ODDS FOR THE NEXT RACE (from the site\'s simulator; quote as "the model" if you use them): ' + ro.rows.slice(0, 6).map(function (r) { return r.name + ' ' + Math.round(r.win * 100) + '%'; }).join(', ') + '.');
  parts.push('DRIVER REPUTATION (0-100): ' + repText(S));
  if (plan.indexOf('silly') >= 0) parts.push(sillyBlock(S));
  var roundArts = S.articles.filter(function (a) { return (preSid && a.preSid === preSid) || (race && a.raceId === race.id); });
  if (roundArts.length) parts.push('ALREADY PUBLISHED FOR THIS RACE WEEKEND (do NOT write these stories again; find a different angle, a different driver, or news that is new since):\n' + roundArts.map(function (a) { return '- [' + (J.OUTLETS[a.outlet] || J.OUTLETS.wire).name + '] ' + a.headline + (a.dek ? ': ' + a.dek : ''); }).join('\n'));
  var recent = S.articles.slice(0, 16).map(function (a) { return '- [' + (J.OUTLETS[a.outlet] || J.OUTLETS.wire).name + '] ' + a.headline; });
  if (recent.length) parts.push('RECENT HEADLINES (do not repeat these angles or headline shapes; continue storylines instead):\n' + recent.join('\n'));
  var worn = wornText(S); if (worn) parts.push(worn);
  parts.push('WRITE ' + plan.length + ' ' + (plan.length === 1 ? 'STORY' : 'STORIES, one per outlet, in this order') + ': ' + plan.map(function (k) { return J.OUTLETS[k].name; }).join(', ') + '.\n' + plan.map(function (k) { return '- ' + (k === 'notes' ? deskNotes(S) : deskText(k)); }).join('\n')
    + (phase !== 'post' ? '\nThe race being previewed has NOT happened. Previews may predict, never report a result.' : '')
    + '\n\nReturn ONLY JSON: {"articles":[{"outlet":"wire|silly|notes","headline":"...","dek":"one sentence","body":"paragraphs separated by a blank line","tags":["Driver Name"],"extras":{"pullQuote":{"text":"a striking line from the story or an interview","by":"who said it"},"keyMoments":[{"when":"Lap 112 or Stage 2 or Friday practice","text":"what happened"}],"byNumbers":[{"value":"3","label":"wins this season"}],"takeaways":["short point"],"whatsNext":"one sentence about what comes next"},"storyline":{...only for the silly season outlet...}}]} (extras: only facts from the data; keyMoments and byNumbers can be empty)');
  var sys = 'You are the editors of three fictional outlets covering "' + S.league.name + '", a SIMULATED ' + S.series.label + ' league run in NASCAR Racing 2003. The drivers are the league\'s sim drivers. Everything is fiction for a sim-racing fan site; keep it on racing and the league. Nothing about anyone\'s real-world personal life, politics, family, health, legal matters or money.\n\n' + NEWS_RULES + ' Headlines read like real motorsport headlines: specific, no puns stacked on puns, no colons-and-questions template. Each story has a different angle, different drivers where possible, and its own vocabulary: no shared phrases between the stories. No quotes from drivers in these stories.';
  var res = await AI.json({ system: sys, user: parts.join('\n\n'), role: 'writer', maxTokens: 12000 });
  var made = [];
  (res.articles || []).slice(0, 3).forEach(function (a, i) {
    var outlet = J.OUTLETS[a.outlet] ? a.outlet : plan[i] || 'notes';
    if (!a || !a.headline || !a.body) return;
    var kind = phase === 'post' ? (outlet === 'silly' ? 'silly' : 'analysis') : phase === 'pre' || o.sid ? 'preview' : 'now';
    if (sameStory(a.headline, S.articles)) return; // the same story again: skip it
    var ts = o.at ? o.at + i * 35 * 60000 : kind === 'now' ? J.weekTime(S) + i * 47 * 60000 : J.storyTime(S, kind, { race: phase === 'post' ? race : null, sid: preSid, slot: i });
    try {
      var art = AI.applyArticle(S, { article: a, interviews: [], reputation: [] }, { outlet: outlet, raceId: phase === 'post' && race ? race.id : '', preSid: preSid, media: [], ts: ts });
      art.desk = true; if (kind === 'now') art.week = true; if (outlet === 'silly') AI.applyStoryline(S, a.storyline, art); made.push(art);
    } catch (e) { /* skip a bad one */ }
  });
  if (!made.length) throw new Error(AI.name() + ' did not write any usable stories. Try again.');
  return made;
};
function headWords(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(function (w) { return w && !STOPW[w]; }); }
function sameStory(h, arts) {
  var a = headWords(h); if (a.length < 3) return false;
  return arts.slice(0, 40).some(function (x) { var b = headWords(x.headline), hit = a.filter(function (w) { return b.indexOf(w) >= 0; }).length; return hit / Math.max(a.length, b.length) >= 0.7; });
};

/* ---------- outlook commentary (numbers come from the engine, words from Claude) ---------- */
AI.outlooks = async function (S) {
  var co = J.chaseOutlook(S), ro = J.raceOutlook(S), so = J.seasonOutlook(S); if (!co) throw new Error('Not enough results yet for outlooks.');
  var p = function (x) { return Math.round(x * 100) + '%'; }, gate = co.sim.gate, noChase = gate.chase === 'none' && !co.sim.decided, noTitle = gate.title === 'none';
  var user = 'LEAGUE: ' + S.league.name + ' (' + S.series.label + '). Races run ' + S.races.length + ' of ' + Math.max(S.schedule.length, S.races.length) + '. ' + S.chase.name + ' takes the top ' + S.chase.size + ' after race ' + S.chase.regularRaces + '.\n\n'
    + (S.chase.winLocks ? 'A race win locks a driver into ' + S.chase.name + ' (as long as there are not more winners than spots). ' : '') + (S.races.length < 4 ? 'EARLY SEASON: only ' + S.races.length + ' race(s) run, so the model has very little to go on and most odds are close together. Say so plainly instead of overreading the numbers. ' : '') + '\n\n'
    + (noChase ? 'ODDS ARE NOT OPEN YET: only ' + S.races.length + ' race(s) are run (chase odds open after race ' + gate.chaseFrom + ', title odds after race ' + gate.titleFrom + '). In the chase and season takes give NO percentages, NO odds and NO title favorite or bubble talk: just what the early results and the points show, and what to watch.\n\n' : (noTitle ? 'TITLE TALK IS NOT OPEN YET (title odds open after race ' + gate.titleFrom + '): no title favorite talk, no championship percentages anywhere.\n\n' : '') + (gate.chase === 'early' ? 'EARLY READ: the odds below are rough and rounded, pulled toward even. Treat them as a loose look, not a forecast.\n\n' : ''))
    + (noChase ? 'POINTS SO FAR: ' + co.rows.slice(0, 15).map(function (r) { return r.name + ' ' + r.curPts + ' pts' + (r.curWins ? ', ' + J.plural(r.curWins, 'win') : ''); }).join('; ') + '\n\n' : 'CHASE ODDS (from 2,500 simulated seasons, tempered for sample size): ' + co.rows.slice(0, 22).map(function (r) { return r.name + ' ' + r.curPts + ' pts, ' + p(r.chaseOdds) + (r.best.length ? ', best at ' + r.best.map(function (t) { return J.TYPES[t].toLowerCase(); }).join('/') : ''); }).join('; ') + '\n\n')
    + (ro && ro.favorites ? 'NEXT RACE: ' + ro.next.name + ' at ' + (ro.next.track || 'TBD') + ' (' + J.TYPES[ro.type].toLowerCase() + '). Win odds: ' + ro.rows.slice(0, 8).map(function (r) { return r.name + ' ' + p(r.win); }).join('; ') + '. Should run well: ' + ro.shouldRunWell.map(function (r) { return r.name; }).join(', ') + '. Dark horses: ' + (ro.darkHorses.map(function (r) { return r.name; }).join(', ') || 'none yet (not enough races at this kind of track)') + '. Not expected up front: ' + ro.notUpFront.map(function (r) { return r.name; }).join(', ') + '. Highest wreck risk: ' + ro.wreckRisk.map(function (r) { return r.name + ' ' + p(r.dnf); }).join(', ') + '.\n\n' : 'NEXT RACE: none left on the schedule.\n\n')
    + (noChase ? '' : 'SEASON PROJECTION: ' + so.rows.slice(0, 12).map(function (r) { return r.name + ' projected P' + r.rankMed + ', ' + Math.round(r.projPts) + ' pts' + (noTitle ? '' : ', title odds ' + p(r.champOdds)); }).join('; ') + '\n\n')
    + 'DRIVER REPUTATION: ' + repText(S) + '\n\n'
    + (J.talkPhase(S).playoff < 2 ? 'TIMING: it is ' + J.talkPhase(S).label.toLowerCase() + ', ' + J.talkPhase(S).left + ' races before the cut. Real analysts treat ' + S.chase.name + ' odds this far out as a long-range look: no bubble, must-win or cut-line drama in any of the three takes. The race and season takes should be about racing.\n\n' : '')
    + (S.ai.chase ? 'LAST TIME THEY SAID (say something new, do not reuse these words): ' + ['chase', 'race', 'season'].map(function (k) { return S.ai[k] ? S.ai[k].headline + ' / ' + S.ai[k].summary : ''; }).join(' | ') + '\n\n' : '')
    + (wornText(S) ? wornText(S) + '\n\n' : '')
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

// what the newsroom knows before a season: the test session, last season, the rides
AI.preseasonFacts = function (S) {
  var p = S.preseason, out = [];
  if (p && p.rows && p.rows.length) out.push('PRESEASON TEST (' + p.name + (p.track ? ' at ' + p.track : '') + '): ' + p.rows.slice(0, 20).map(function (r) { return 'P' + r.position + ' ' + r.driver + (r.car ? ' #' + r.car : '') + (r.time ? ' ' + r.time : ''); }).join('; ') + '. Test speeds are only a hint: teams sandbag and run different programs.');
  var prev = J.leagues ? Object.keys(J.leagues).map(function (k) { return J.leagues[k]; }).filter(function (L) { return L.archived && L.series.id === S.series.id; }).sort(function (a, b) { return J.seasonNum(b) - J.seasonNum(a); })[0] : null;
  if (prev && prev.races.length) { var ds = J.agg(prev.races); out.push('LAST SEASON (' + J.seasonYear(prev) + '): ' + ds.slice(0, 12).map(function (d, i) { return (i + 1) + '. ' + d.name + ' (' + J.plural(d.wins, 'win') + ', ' + (d.fin / d.starts).toFixed(1) + ' avg)'; }).join('; ') + '.'); var lastNames = {}; ds.forEach(function (d) { lastNames[d.key] = 1; }); var rookies = J.roster(S).filter(function (d) { return !lastNames[d.key]; }); if (rookies.length) out.push('NEW TO THE SERIES THIS YEAR: ' + rookies.slice(0, 10).map(function (d) { return d.name; }).join(', ') + '.'); }
  var rides = J.roster(S).map(function (d) { var t = J.teamOf(S, d.key), ci = J.contractInfo(S, d.key); return t || ci ? d.name + (t ? ' (' + t.name + ')' : '') + (ci && ci.status === 'expiring' ? ' in a contract year' : '') : ''; }).filter(Boolean);
  if (rides.length) out.push('RIDES: ' + rides.slice(0, 40).join('; ') + '.');
  var nx = J.nextRound(S); if (nx) out.push('SEASON OPENER: ' + nx.name + (nx.track ? ' at ' + nx.track : '') + (nx.date ? ', ' + nx.date : '') + '.');
  return out.join('\n');
};
AI.raceReactionTask = function (S, race) { return 'The ' + race.name + ' just ended. Write 7 to 9 threads of fans and accounts reacting to THIS race, right after the checkered flag. Nearly every thread is about what actually happened in it, using the real names and finishing spots from FACTS: the winner and how they won, the drivers who ran up front, who got wrecked or had problems, a big mover, someone furious about where their driver finished' + (J.talkPhase(S).playoff >= 2 ? ', what the result does to the points and ' + J.theChase(S) + ' cut line' : J.talkPhase(S).playoff === 1 ? ', maybe one stats account noting the points' : '') + '. People name the drivers and the finishing positions. At most one thread looks ahead to next week.'; };
// Garage chatter between races (or before the next race once practice/qualifying are in)
AI.chatter = async function (S, o) {
  o = o || {}; var nx = J.nextRound(S), pre = nx && J.sessionsFor(S, nx.id).length, race = S.races[S.races.length - 1];
  if (!race && !pre) throw new Error('Import a race, practice or qualifying first.');
  var facts = pre ? AI.sessionFacts(S, nx.id) + (race ? '\n\nLAST RACE, for context:\n' + AI.raceFacts(S, race) : '') : AI.raceFacts(S, race) + (nx ? '\nNext race: ' + nx.name + ' at ' + (nx.track || 'TBD') + ' (' + J.TYPES[nx.type].toLowerCase() + ').' : '');
  return AI.threads(S, { facts: facts, focus: [], at: o.at, ref: { type: 'week', id: race ? race.id : nx.id }, task: pre ? 'The next race has NOT been run yet. Write 5 to 7 threads of pre-race chatter: practice and qualifying takes, predictions, fantasy picks, hype, someone worried about their driver, a rumor. Never say who won the next race.' : 'It is the middle of the week between races. Write 5 to 7 threads of the usual chatter for this point of the season: takes about the last race and the standings, predictions for the next race, someone still mad about last week, a fantasy lineup argument, a rumor, one person asking a dumb question and getting roasted. Not everything is about the last race.' });
};
// Fans after practice / qualifying / happy hour
AI.sessionHype = function (S, sess, at) {
  var top = sess.rows.slice(0, 3).map(function (r) { return r.driver; });
  return AI.threads(S, { facts: AI.sessionFacts(S, sess.sid), focus: top, ref: { type: 'session', id: sess.id }, at: at, task: 'The race has NOT happened yet. ' + J.SESSIONS[sess.type] + ' just finished. Write 5 to 7 threads of pre-race talk: reactions to who was fast and who was slow, hype and predictions for the race, someone mad about where their driver ended up, a fantasy or betting pick, a "practice speed means nothing" argument, a media figure with an observation. Never say who won the race.' });
};

/* ---------- one pipeline for "a race just happened" ---------- */
AI.coverage = async function (S, race, step) {
  step = step || function () {};
  var art = null, fail = 0;
  step('recap', 'run');
  try { art = await AI.article(S, { outlet: 'wire', race: race, headline: '', notes: '', ts: J.storyTime(S, 'recap', { race: race }) }); step('recap', 'ok', art.headline); } catch (e) { fail++; step('recap', 'err', e.message); }
  if (J.settings.autoNews !== false) {
    step('news', 'run');
    try { var made = await AI.newsCycle(S, { phase: 'post', race: race }); step('news', 'ok', made.length + (made.length === 1 ? ' story' : ' stories')); } catch (e) { fail++; step('news', 'err', e.message); }
  }
  var info = J.raceInfo(race), focus = [info.winner.driver]; if (info.mover) focus.push(info.mover.row.driver); if (info.poleRow) focus.push(info.poleRow.driver);
  step('fans', 'run');
  try { var n = await AI.threads(S, { facts: AI.raceFacts(S, race), story: art, focus: focus, race: true, at: art ? art.ts : J.storyTime(S, 'recap', { race: race }), ref: art ? { type: 'article', id: art.id } : { type: 'race', id: race.id }, task: AI.raceReactionTask(S, race) }); step('fans', 'ok', n + ' posts'); } catch (e) { fail++; step('fans', 'err', e.message); }
  step('outlooks', 'run');
  try { await AI.outlooks(S); step('outlooks', 'ok'); } catch (e) { fail++; step('outlooks', 'err', e.message); }
  var ch = J.driftFans(S); step('drift', 'ok', ch.length ? ch.length + ' fans changed sides' : 'no one switched');
  return fail;
};
})();
