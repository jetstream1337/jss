/* Virtual NASCAR - number cards by series.
   - Pulls the card pictures for the open series from its DiecastCharv page (one page per series) and matches each picture to its car number.
   - Your own pictures do not need to be renamed: the number is read from the file name when there is one, otherwise from the picture
     itself (AI), otherwise you type it once in a small grid. */
(function () {
'use strict';
var J = window.JSS, $ = J.$, esc = J.esc;
J.CARD_PAGES = {
  cup: { url: 'https://diecastcharv.com/cup-number-card-tracker/', label: 'Cup' },
  xfinity: { url: 'https://diecastcharv.com/oreilly-auto-parts-driver-number-cards/', label: "O'Reilly" },
  truck: { url: 'https://diecastcharv.com/truck-driver-number-cards/', label: 'Craftsman Truck' }
};
var JUNK = /logo|icon|avatar|favicon|banner|header|footer|asset-|cropped|slide\d|dad-and|sprite|emoji|gravatar|facebook|twitter|instagram|youtube|pixel|spacer|loading|placeholder|donate|paypal|subscribe/i;
var GENERIC = /^(img|image|photo|pic|picture|screenshot|screen shot|download|dsc|file|untitled|unnamed|capture|scan|whatsapp|received|signal)/i;

function baseName(u) { var p = String(u || '').split('?')[0].split('#')[0].split('/').pop() || ''; try { p = decodeURIComponent(p); } catch (e) {} return p.replace(/\.[a-z0-9]+$/i, '').replace(/-\d{2,4}x\d{2,4}$/i, '').replace(/-scaled$/i, ''); }
function numFromText(t) {
  t = String(t || '').trim(); if (!t) return '';
  var m = t.match(/^(?:#|no\.?\s*|number\s*)?\s*(\d{1,2}|00|\d{3})\s*(?:[-:.)–—]|\s)\s*[A-Za-z]/i) || t.match(/#\s*(\d{1,3})\b/) || t.match(/^(\d{1,3})$/);
  return m ? m[1] : '';
}
function numFromFile(u) { var b = baseName(u); if (!b || GENERIC.test(b)) return ''; return J.artNumFromName(b); }
function bestSrc(im, base) {
  var cands = [im.getAttribute('data-large-file'), im.getAttribute('data-orig-file'), im.getAttribute('data-full-url')], ss = im.getAttribute('srcset') || im.getAttribute('data-srcset') || im.getAttribute('data-lazy-srcset');
  if (ss) { var best = null, bw = 0; ss.split(',').forEach(function (p) { var q = p.trim().split(/\s+/), w = parseInt(q[1], 10) || 1; if (q[0] && w >= bw) { bw = w; best = q[0]; } }); if (best) cands.push(best); }
  cands.push(im.getAttribute('data-src'), im.getAttribute('data-lazy-src'), im.getAttribute('data-original'), im.getAttribute('src'));
  var a = im.closest && im.closest('a'); if (a && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.getAttribute('href') || '')) cands.unshift(a.getAttribute('href'));
  for (var i = 0; i < cands.length; i++) { var s = cands[i]; if (!s || /^data:/i.test(s)) continue; try { return new URL(s, base).href; } catch (e) {} }
  return '';
}
// reads the page and works out which picture belongs to which car number
J.cardScan = function (html, base) {
  var doc = new DOMParser().parseFromString(html, 'text/html');
  ['script', 'style', 'noscript', 'nav', 'footer', 'aside', '[id*="sidebar"]', '[id*="comment"]', '[class*="comments"]'].forEach(function (sel) { try { doc.querySelectorAll(sel).forEach(function (n) { if (n !== doc.body && !n.querySelector('article, main, .entry-content')) n.remove(); }); } catch (e) {} });
  var ctx = '', found = [], loose = [], seenSrc = {}, skipped = 0;
  var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  var n; while ((n = walker.nextNode())) {
    var tag = n.tagName;
    if (/^(H[1-6]|STRONG|B|TH|TD|FIGCAPTION|LI|P|SUMMARY|A|SPAN|DIV)$/.test(tag)) {
      if (tag === 'DIV' || tag === 'SPAN' || tag === 'A' || tag === 'P' || tag === 'LI' || tag === 'TD') { if (n.children.length > 3 || n.textContent.length > 60) continue; }
      var t = (n.textContent || '').replace(/\s+/g, ' ').trim(), k = /^H[1-6]$/.test(tag) || tag === 'STRONG' || tag === 'B' || tag === 'FIGCAPTION' ? numFromText(t) : (t.length < 40 ? numFromText(t) : '');
      if (k && !/^\d{4}$/.test(k)) ctx = k;
    }
    if (tag !== 'IMG') continue;
    var src = bestSrc(n, base); if (!src) { skipped++; continue; }
    var w = parseInt(n.getAttribute('width'), 10), h = parseInt(n.getAttribute('height'), 10);
    if ((w && h && w < 60 && h < 60) || JUNK.test(baseName(src)) || JUNK.test(n.getAttribute('class') || '') || /\.svg(\?|$)/i.test(src) || seenSrc[src]) { skipped++; continue; }
    seenSrc[src] = 1;
    var fig = n.closest('figure'), cap = fig && fig.querySelector('figcaption') ? fig.querySelector('figcaption').textContent : '';
    var num = numFromText(n.getAttribute('alt')) || numFromText(n.getAttribute('title')) || numFromText(cap), why = num ? 'from its caption' : '';
    if (!num) { num = numFromFile(src); why = num ? 'from the file name' : ''; }
    if (!num && ctx) { num = ctx; why = 'under the #' + ctx + ' heading'; }
    (num ? found : loose).push({ num: num, src: src, why: why, alt: n.getAttribute('alt') || '' });
  }
  var by = {}, dup = 0; found = found.filter(function (c) { if (by[c.num]) { dup++; return false; } by[c.num] = 1; return true; });
  return { cards: found, loose: loose, skipped: skipped, dup: dup };
};

/* ---------- reading a number from a picture ---------- */
function shrinkBlob(src, max) {
  return new Promise(function (res, rej) {
    var u = typeof src === 'string' ? src : URL.createObjectURL(src), im = new Image();
    im.onload = function () { var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s)); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); if (typeof src !== 'string') URL.revokeObjectURL(u); res({ type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1], url: c.toDataURL('image/jpeg', 0.6) }); };
    im.onerror = function () { if (typeof src !== 'string') URL.revokeObjectURL(u); rej(new Error('unreadable picture')); };
    im.src = u;
  });
}
J.artReadNumber = async function (img) {
  var r = await J.ai.json({ system: 'You read the car number printed on a NASCAR-style number card, driver card or car picture. You never guess.', user: 'What car number is shown on this picture? It is the large number, not a year, sponsor or lap count. Return ONLY JSON: {"number":"24","confidence":0.0}. Use "" for number when no car number is visible. Keep leading zeros ("00", "07").', images: [{ type: img.type, data: img.data }], role: 'chatter', maxTokens: 120 });
  var n = String((r && r.number) || '').replace(/[^0-9]/g, ''); return { num: n, conf: Number(r && r.confidence) || (n ? 0.7 : 0) };
};

/* ---------- little dialog: pictures with a number box each ---------- */
function openGrid(title, intro, items, okLabel) {
  return new Promise(function (resolve) {
    var d = $('dlg'), done = false;
    var finish = function (v) { if (done) return; done = true; d.removeEventListener('close', onClose); try { if (d.close) d.close(); else d.removeAttribute('open'); } catch (e) {} resolve(v); }, onClose = function () { if (!d.open) finish(null); };
    $('dlgBody').innerHTML = '<div class="dlg-h"><h3>' + esc(title) + '</h3><button class="dlg-x" id="cgX" aria-label="Close">&#10005;</button></div><div class="dlg-b"><p class="sub">' + intro + '</p><div class="cgrid">' + items.map(function (it, i) {
      return '<label class="ctile"><img src="' + esc(it.preview) + '" alt="" referrerpolicy="no-referrer"><span class="cn"><input type="checkbox" data-i="' + i + '"' + (it.on ? ' checked' : '') + '> #<input class="cnum" data-n="' + i + '" value="' + esc(it.num || '') + '" inputmode="numeric" aria-label="Car number"></span><small>' + esc(it.note || '') + '</small></label>';
    }).join('') + '</div><div class="row" style="margin-top:12px"><button class="btn" id="cgOk">' + esc(okLabel) + '</button><button class="btn ghost" id="cgNo">Cancel</button></div></div>';
    d.addEventListener('close', onClose);
    $('cgOk').addEventListener('click', function () { finish(items.map(function (it, i) { var on = d.querySelector('input[data-i="' + i + '"]').checked, num = d.querySelector('input[data-n="' + i + '"]').value.replace(/[^0-9]/g, ''); return on && num ? { item: it, num: num } : null; }).filter(Boolean)); });
    $('cgNo').addEventListener('click', function () { finish(null); }); $('cgX').addEventListener('click', function () { finish(null); });
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  });
}
J.cardGrid = openGrid;

// files with no number in their name: AI reads them (when a key is set), the rest are asked for in one grid
J.artIdentify = async function (files) {
  var items = [], i;
  for (i = 0; i < files.length; i++) { try { var im = await shrinkBlob(files[i], 640); items.push({ file: files[i], preview: im.url, img: im, num: '', note: files[i].name, on: true }); } catch (e) { items.push(null); } }
  items = items.filter(Boolean); if (!items.length) return [];
  if (J.ai && J.ai.hasKey()) {
    var q = items.slice(), work = async function () { while (q.length) { var it = q.shift(); try { var r = await J.artReadNumber(it.img); it.num = r.num; it.conf = r.conf; it.note = (r.num ? 'AI read #' + r.num : 'AI could not see a number') + ' (' + it.file.name + ')'; } catch (e) { it.note = 'AI error: ' + e.message; } } };
    await Promise.all([work(), work(), work()]);
  }
  var sure = items.filter(function (it) { return it.num && (it.conf || 0) >= 0.75; }), ask = items.filter(function (it) { return !(it.num && (it.conf || 0) >= 0.75); });
  var out = sure.map(function (it) { return { file: it.file, num: it.num }; });
  if (ask.length) {
    var got = await openGrid(ask.length === items.length && !(J.ai && J.ai.hasKey()) ? 'Which number is each picture?' : 'Check these numbers', (J.ai && J.ai.hasKey() ? 'The AI was not sure about these. ' : 'These file names have no car number in them. ') + 'Type the number for each picture (untick one to skip it).', ask.map(function (it) { return { preview: it.preview, num: it.num, note: it.note, on: true, file: it.file }; }), 'Use these numbers');
    (got || []).forEach(function (g) { out.push({ file: g.item.file, num: g.num }); });
  }
  return out;
};

/* ---------- pull the series' cards from the web ---------- */
async function bytesOf(url) {
  var r = await J.http(url, { binary: true, timeoutMs: 60000 }); if (r.status !== 200 || !r.b64) throw new Error('HTTP ' + r.status);
  var type = (r.type || '').split(';')[0] || (/\.png/i.test(url) ? 'image/png' : /\.webp/i.test(url) ? 'image/webp' : 'image/jpeg'); return 'data:' + type + ';base64,' + r.b64;
}
J.acts.cardsFetch = async function () {
  var S = J.S, sid = S.series.id, pg = J.CARD_PAGES[sid];
  if (!pg) { J.toast(S.series.label + ' has no card page. Use "Choose pictures" and drop your own.', true); return; }
  var say = function (t, bad) { var msg = $('artMsg'); if (msg) { msg.hidden = false; msg.className = 'msg' + (bad ? ' err' : ' ok'); msg.textContent = t; } else J.toast(t, bad); };
  say('Reading the ' + pg.label + ' page on DiecastCharv...');
  var r = await J.http(pg.url, { timeoutMs: 60000 });
  if (r.status !== 200) { var em = ''; try { em = JSON.parse(r.text).message || ''; } catch (e) {} say('Could not open the page (' + (r.status || 'no connection') + (em ? ': ' + em : '') + '). Check your internet, then try again.', true); return; }
  var scan = J.cardScan(r.text, pg.url);
  if (!scan.cards.length && !scan.loose.length) { say('That page showed no card pictures the app could use (' + scan.skipped + ' images skipped). Right-click the cards on the site, save them, and drop them in the box below: the app reads the numbers for you.', true); return; }
  var items = scan.cards.map(function (c) { return { preview: c.src, src: c.src, num: c.num, note: c.why, on: true }; }).concat(scan.loose.map(function (c) { return { preview: c.src, src: c.src, num: '', note: 'number not found: type it or leave it off', on: false }; }));
  say('Found ' + scan.cards.length + ' cards' + (scan.loose.length ? ' and ' + scan.loose.length + ' pictures without a number' : '') + '. Check them, then add.');
  var picked = await openGrid(pg.label + ' cards from DiecastCharv', 'Each picture is matched to its car number. Fix a number if it is wrong, untick anything you do not want. Cards replace the current ' + esc(S.series.label) + ' number pictures for those numbers (originals are kept).', items, 'Add ' + items.filter(function (i) { return i.on; }).length + ' cards');
  if (!picked || !picked.length) { say('Nothing added.'); return; }
  S.art = S.art || {}; S.art.nums = S.art.nums || {}; S.art.orig = S.art.orig || {};
  var done = 0, bad = 0, q = picked.slice(), work = async function () {
    while (q.length) { var p = q.shift(); try { var data = await bytesOf(p.item.src), sn = {}; S.art.nums[p.num] = await J.artFromData(data, { bg: J.ui.artBg || 'auto', height: 140, snap: sn }); if (sn.v) S.art.orig[p.num] = sn.v; done++; } catch (e) { bad++; } }
  };
  say('Downloading ' + picked.length + ' cards...'); await Promise.all([work(), work(), work()]);
  S.art.clean = 1; J.save(); say('Added ' + done + ' ' + pg.label + ' card' + (done === 1 ? '' : 's') + (bad ? ', ' + bad + ' could not be downloaded' : '') + '.', !done);
};
})();
