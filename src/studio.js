/* Jet's Sim Series - Story Studio (commissioner only): photos/video + headline -> article */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
var VIDEO_PUBLISH_MAX = 40 * 1024 * 1024; // bigger clips stay in the app; the site shows a still + an optional link
var AI_IMAGE_CAP = 8;
var st = J.studio = { items: [], outlet: 'wire', raceId: '', headline: '', notes: '', highlights: true, react: true, interviews: true, draft: null, busy: false, manual: false };

/* ---------- media processing ---------- */
function loadImg(src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('Could not open that image.')); }; im.src = src; }); }
function canvasFrom(src, w, h, max) { var s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s)); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c; }
function toBlob(c, q) { return new Promise(function (res) { c.toBlob(function (b) { res(b); }, 'image/jpeg', q || 0.86); }); }
function toB64(c) { return c.toDataURL('image/jpeg', 0.8).split(',')[1]; }
async function processImage(file) {
  var url = URL.createObjectURL(file);
  try {
    var im = await loadImg(url), W = im.naturalWidth, H = im.naturalHeight;
    var big = canvasFrom(im, W, H, 1600), small = canvasFrom(im, W, H, 1024);
    var blob = await toBlob(big, 0.86);
    return { type: 'image', blob: blob, preview: URL.createObjectURL(blob), ai: [{ data: toB64(small), type: 'image/jpeg' }], size: blob.size };
  } finally { URL.revokeObjectURL(url); }
}
function seek(v, t) { return new Promise(function (res, rej) { var done = false, to = setTimeout(function () { if (!done) rej(new Error('seek timeout')); }, 6000); v.onseeked = function () { done = true; clearTimeout(to); res(); }; v.currentTime = t; }); }
async function processVideo(file) {
  var url = URL.createObjectURL(file), v = document.createElement('video'), frames = [], poster = null, dur = 0;
  v.muted = true; v.preload = 'auto'; v.playsInline = true; v.src = url;
  try {
    await new Promise(function (res, rej) { var to = setTimeout(function () { rej(new Error('timeout')); }, 10000); v.onloadeddata = function () { clearTimeout(to); res(); }; v.onerror = function () { clearTimeout(to); rej(new Error('unsupported')); }; });
    dur = v.duration && isFinite(v.duration) ? v.duration : 0;
    var n = dur > 20 ? 6 : dur > 6 ? 5 : 4;
    for (var i = 0; i < n; i++) {
      var t = dur ? Math.min(dur - 0.05, dur * (0.08 + 0.84 * i / (n - 1))) : 0;
      try { await seek(v, Math.max(0, t)); } catch (e) { continue; }
      var c = canvasFrom(v, v.videoWidth, v.videoHeight, 1024);
      if (!isBlank(c)) { frames.push({ data: toB64(c), type: 'image/jpeg', t: t }); if (!poster) poster = await toBlob(canvasFrom(v, v.videoWidth, v.videoHeight, 1280), 0.84); }
    }
  } catch (e) { console.warn('video frames', e); }
  finally { v.removeAttribute('src'); v.load(); }
  return { type: 'video', blob: file, preview: URL.createObjectURL(file), posterBlob: poster, posterPreview: poster ? URL.createObjectURL(poster) : '', ai: frames, size: file.size, duration: dur, noFrames: !frames.length };
}
function isBlank(c) {
  try { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, sum = 0, n = 0; for (var i = 0; i < d.length; i += 4 * 97) { sum += d[i] + d[i + 1] + d[i + 2]; n++; } return sum / (n * 3) < 6; } catch (e) { return false; }
}
J.studioAddFiles = async function (list) {
  var files = Array.prototype.filter.call(list || [], function (f) { return /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|mp4|webm|mov|m4v)$/i.test(f.name); });
  if (!files.length) { J.toast('Those are not photos or videos. Race result files go on the Import Race page.', true); return; }
  for (var i = 0; i < files.length; i++) {
    var f = files[i], isVid = /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
    var it = { id: J.uid('m'), name: f.name, caption: '', link: '', loading: true, type: isVid ? 'video' : 'image' };
    st.items.push(it); paintItems();
    try { Object.assign(it, isVid ? await processVideo(f) : await processImage(f)); }
    catch (e) { it.error = e.message || 'Could not read this file.'; }
    it.loading = false; paintItems();
  }
};

/* ---------- page ---------- */
function itemsHtml() {
  if (!st.items.length) return '';
  return '<div class="thumbs">' + st.items.map(function (it) {
    var src = it.type === 'video' ? it.posterPreview : it.preview;
    var note = it.loading ? 'Reading...' : it.error ? it.error : it.type === 'video' ? (it.noFrames ? 'Could not read frames' : it.ai.length + ' frames for Claude') + (it.size > VIDEO_PUBLISH_MAX ? ', too big for the site' : '') : Math.round(it.size / 1024) + ' KB';
    return '<figure>' + (src ? '<img src="' + esc(src) + '" alt="">' : '<div class="nomedia" style="width:110px;height:76px">' + (it.type === 'video' ? 'Video' : 'Photo') + '</div>') + '<button data-act="stRemove" data-id="' + esc(it.id) + '" aria-label="Remove">&#10005;</button><small title="' + esc(it.name) + '">' + esc(it.name) + '</small><small class="' + (it.error ? 'dnf' : '') + '">' + esc(note) + '</small>'
      + (it.type === 'video' && it.size > VIDEO_PUBLISH_MAX ? '<input class="vlink" data-id="' + esc(it.id) + '" placeholder="YouTube link (optional)" value="' + esc(it.link) + '">' : '') + '</figure>';
  }).join('') + '</div>' + (st.items.some(function (it) { return it.type === 'video' && it.size > VIDEO_PUBLISH_MAX; }) ? '<div class="warn">Videos over 40 MB are too big to put on the website. The site will show a still frame from it instead. If you upload the clip to YouTube, paste the link under it and the site will link to it.</div>' : '');
}
function paintItems() { var el = $('stItems'); if (el) el.innerHTML = itemsHtml(); }
function draftHtml() {
  var d = st.draft; if (!d) return '';
  var a = d.article || {};
  return '<section class="panel" id="stDraft"><h3>Preview</h3><p class="sub">Edit anything you like, then publish. Nothing is on the site until you press Publish.</p>'
    + '<div class="field"><label for="dHead">Headline</label><input id="dHead" value="' + esc(a.headline || '') + '"></div>'
    + '<div class="field" style="margin-top:10px"><label for="dDek">Summary line</label><input id="dDek" value="' + esc(a.dek || '') + '"></div>'
    + '<div class="field" style="margin-top:10px"><label for="dBody">Story (blank line between paragraphs, ## for a subhead)</label><textarea id="dBody" style="min-height:320px">' + esc(a.body || '') + '</textarea></div>'
    + ((d.interviews || []).length ? '<h3 style="font-size:19px;margin-top:16px">Pit road quotes</h3>' + d.interviews.map(function (iv, i) { return '<label class="check"><input type="checkbox" data-iv="' + i + '" checked> <span><b>' + esc(iv.driver) + '</b> (' + esc(iv.tone || '') + ') ' + esc(iv.quote) + '</span></label>'; }).join('') : '')
    + ((d.reputation || []).length ? '<h3 style="font-size:19px;margin-top:16px">Reputation changes</h3>' + d.reputation.map(function (r, i) { return '<label class="check"><input type="checkbox" data-rp="' + i + '" checked> <span><b class="' + (r.delta > 0 ? 'up' : 'down') + '">' + (r.delta > 0 ? '+' : '') + Number(r.delta) + '</b> ' + esc(r.driver) + ': ' + esc(r.why || '') + '</span></label>'; }).join('') : '')
    + '<div class="row"><button class="btn good" data-act="stPublish">Publish story</button>' + (d.manual ? '' : '<button class="btn ghost" data-act="stGenerate">Write it again</button>') + '<button class="btn ghost" data-act="stDiscard">Discard</button></div></section>';
}
J.routes.studio = function (S) {
  var hasKey = J.ai && J.ai.hasKey(), races = S.races.slice().reverse();
  if (st.raceId === '' && races[0] && !st._touchedRace) st.raceId = races[0].id;
  return J.phead('Story Studio', 'Add race photos or video, write a headline, and Claude writes the story in the outlet\'s voice.')
    + '<section class="panel"><div class="fgrid">'
    + '<div class="field"><label for="stOutlet">Outlet</label><select id="stOutlet">' + Object.keys(J.OUTLETS).map(function (k) { return '<option value="' + k + '"' + (st.outlet === k ? ' selected' : '') + ' title="' + esc(J.OUTLETS[k].tag) + '">' + esc(J.OUTLETS[k].name) + ': ' + esc(J.OUTLETS[k].tag.toLowerCase()) + '</option>'; }).join('') + '</select></div>'
    + '<div class="field"><label for="stRace">Race it is about</label><select id="stRace"><option value="">No specific race</option>' + races.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === st.raceId ? ' selected' : '') + '>' + esc(r.name) + (r.date ? ' (' + esc(J.fmtDate(r.date)) + ')' : '') + '</option>'; }).join('') + '</select></div>'
    + '<div class="field wide"><label for="stHead">Your headline</label><input id="stHead" value="' + esc(st.headline) + '" placeholder="Example: Blaney and Logano tangle in turn 3, Blaney furious"></div>'
    + '<div class="field wide"><label for="stNotes">What happened (optional, but the more you say the better the story)</label><textarea id="stNotes" placeholder="Lap 22, Logano got into the back of Blaney off turn 2. Blaney spun and lost 3 laps. Blaney waved at him under caution...">' + esc(st.notes) + '</textarea></div></div>'
    + '<div class="drop" id="sDrop"><strong>Drop photos or video here</strong><p>Screenshots or replay clips from NR2003. Claude looks at them while writing. Videos: the app pulls a few frames out for Claude to look at.</p><div class="row" style="justify-content:center"><button class="btn ghost" data-act="stPick">Choose photos or video</button></div><input type="file" id="stFile" accept="image/*,video/*" multiple hidden></div>'
    + '<div id="stItems">' + itemsHtml() + '</div>'
    + '<label class="check"><input type="checkbox" id="stHigh"' + (st.highlights ? ' checked' : '') + '> Also show these photos and videos on the Highlights page</label>'
    + '<label class="check"><input type="checkbox" id="stInts"' + (st.interviews ? ' checked' : '') + '> Include pit road interview quotes (these move driver reputations)</label>'
    + '<label class="check"><input type="checkbox" id="stReact"' + (st.react ? ' checked' : '') + '> Let the fans react in The Garage after it is published</label>'
    + '<div class="row">' + (hasKey ? '<button class="btn" data-act="stGenerate"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? 'Claude is writing...' : 'Write the story') + '</button>' : '<span class="warn" style="margin:0">Add your Claude key in Settings to have stories written for you.</span>')
    + '<button class="btn ghost" data-act="stManual">Write it myself</button><button class="btn ghost" data-act="stHighOnly">Just add to Highlights</button></div>'
    + '<div id="stMsg" class="msg" hidden></div></section>'
    + '<div id="stDraftSlot">' + draftHtml() + '</div>';
};
J.afters.studio = function () { var f = $('stFile'); if (f) f.addEventListener('change', function () { J.studioAddFiles(this.files); this.value = ''; }); };
J.nav.push({ id: 'studio', label: 'Story Studio', group: 'Commissioner', admin: true });

function smsg(t, err) { var m = $('stMsg'); if (!m) return; m.hidden = !t; m.className = 'msg' + (err ? ' err' : ''); m.textContent = t || ''; }
function readForm() {
  var g = function (id) { return $(id); };
  if (!g('stOutlet')) return;
  st.outlet = g('stOutlet').value; st.raceId = g('stRace').value; st.headline = g('stHead').value; st.notes = g('stNotes').value;
  st.highlights = g('stHigh').checked; st.interviews = g('stInts').checked; st.react = g('stReact').checked;
}
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.classList && t.classList.contains('vlink')) { var it = st.items.find(function (x) { return x.id === t.dataset.id; }); if (it) it.link = t.value.trim(); return; }
  if (/^st(Head|Notes)$/.test(t.id)) readForm();
});
document.addEventListener('change', function (e) { if (/^st(Outlet|Race|High|Ints|React)$/.test(e.target.id)) { if (e.target.id === 'stRace') st._touchedRace = true; readForm(); } });
J.acts.stPick = function () { $('stFile').click(); };
J.acts.stRemove = function (el) { st.items = st.items.filter(function (x) { return x.id !== el.dataset.id; }); paintItems(); };
J.acts.stDiscard = function () { st.draft = null; $('stDraftSlot').innerHTML = ''; };
J.acts.stManual = function () {
  readForm();
  st.draft = { manual: true, article: { headline: st.headline, dek: '', body: st.notes, tags: [] }, interviews: [], reputation: [] };
  $('stDraftSlot').innerHTML = draftHtml(); $('stDraft').scrollIntoView({ behavior: 'smooth' });
};
function aiImages() {
  var imgs = [];
  st.items.forEach(function (it, idx) { if (it.error || it.loading) return; (it.ai || []).forEach(function (a, k) { imgs.push({ data: a.data, type: a.type, label: (it.type === 'video' ? 'frame ' + (k + 1) + ' from video ' : 'photo ') + '"' + it.name + '"', item: idx }); }); });
  if (imgs.length <= AI_IMAGE_CAP) return imgs;
  var photos = imgs.filter(function (x) { return /^photo/.test(x.label); }).slice(0, AI_IMAGE_CAP), room = AI_IMAGE_CAP - photos.length, frames = imgs.filter(function (x) { return !/^photo/.test(x.label); }), pick = [];
  for (var i = 0; i < room && frames.length; i++) pick.push(frames[Math.floor(i * frames.length / room)]);
  return photos.concat(pick);
}
J.acts.stGenerate = async function () {
  readForm(); var S = J.S;
  if (!st.headline.trim()) { smsg('Write a headline first. It tells Claude what the story is about.', true); return; }
  if (st.items.some(function (x) { return x.loading; })) { smsg('Still reading your files. Give it a second.', true); return; }
  st.busy = true; J.refresh(); smsg('Claude is writing the story. This usually takes 20 to 40 seconds.');
  try {
    var race = S.races.find(function (r) { return r.id === st.raceId; }) || null;
    var notes = st.notes + (st.items.length ? '\n\nThe commissioner attached ' + st.items.length + ' photo/video item(s): ' + st.items.map(function (x) { return x.name + (x.duration ? ' (' + Math.round(x.duration) + 's clip)' : ''); }).join(', ') + '.' : '');
    var res = await J.ai.articleDraft(S, { outlet: st.outlet, race: race, headline: st.headline, notes: notes, images: aiImages(), interviews: st.interviews });
    if (!res.article || !res.article.body) throw new Error('Claude returned an empty story. Try again.');
    res.interviews = (res.interviews || []).filter(function (x) { return x && x.quote && J.findDriver(S, x.driver); });
    res.reputation = (res.reputation || []).filter(function (x) { return x && Number(x.delta) && J.findDriver(S, x.driver); });
    st.draft = res; st.busy = false; J.refresh(); smsg('');
    var d = $('stDraft'); if (d) d.scrollIntoView({ behavior: 'smooth' });
  } catch (e) { st.busy = false; J.refresh(); smsg(e.message || String(e), true); }
};
async function saveItems(S, raceId, publish) {
  var ids = [];
  for (var i = 0; i < st.items.length; i++) {
    var it = st.items[i]; if (it.error || it.loading || !it.blob) continue;
    await J.store.putMedia(it.id, it.blob);
    if (it.posterBlob) await J.store.putMedia(it.id + ':poster', it.posterBlob);
    J.blobs[it.id] = it.preview; if (it.posterPreview) J.blobs[it.id + ':poster'] = it.posterPreview;
    var link = /^https?:\/\//i.test(it.link || '') ? it.link : '';
    S.media.push({ id: it.id, type: it.type, name: it.name, caption: it.caption || '', raceId: raceId || '', ts: Date.now(), url: '', poster: '', published: !!publish, size: it.size || 0, link: link, big: it.type === 'video' && it.size > VIDEO_PUBLISH_MAX });
    ids.push(it.id);
  }
  return ids;
}
J.acts.stHighOnly = async function () {
  readForm(); var S = J.S;
  if (!st.items.length) { smsg('Add a photo or video first.', true); return; }
  var ids = await saveItems(S, st.raceId, true);
  if (st.headline.trim()) S.media.forEach(function (m) { if (ids.indexOf(m.id) >= 0 && !m.caption) m.caption = st.headline.trim(); });
  st.items = []; J.save(); J.toast(J.plural(ids.length, 'item') + ' added to Highlights.');
};
J.acts.stPublish = async function () {
  var S = J.S, d = st.draft; if (!d) return;
  var a = { headline: $('dHead').value.trim(), dek: $('dDek').value.trim(), body: $('dBody').value.trim(), tags: (d.article && d.article.tags) || [], photoCaptions: (d.article && d.article.photoCaptions) || [] };
  if (!a.headline || !a.body) { J.toast('The story needs a headline and some text.', true); return; }
  var ivs = (d.interviews || []).filter(function (_, i) { var c = document.querySelector('[data-iv="' + i + '"]'); return !c || c.checked; });
  var reps = (d.reputation || []).filter(function (_, i) { var c = document.querySelector('[data-rp="' + i + '"]'); return !c || c.checked; });
  var raceId = st.raceId, ids = await saveItems(S, raceId, st.highlights);
  var art = J.ai.applyArticle(S, { article: a, interviews: ivs, reputation: reps }, { outlet: st.outlet, raceId: raceId, media: ids });
  if (d.manual) { art.author = 'Commissioner'; }
  var react = st.react && J.ai.hasKey();
  st.items = []; st.draft = null; st.headline = ''; st.notes = '';
  J.save({ render: false }); J.go('news/' + art.id);
  J.toast('Story published.' + (react ? ' The fans are reading it now.' : ''));
  if (react) J.reactToArticle(art.id, true);
};
})();
