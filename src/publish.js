/* Jet's Sim Series - publishes the public website to GitHub Pages (commissioner only, never published) */
(function () {
'use strict';
var J = window.JSS, P = J.publisher = {};
var API = 'https://api.github.com';
var VIDEO_MAX = 40 * 1024 * 1024;
P.state = { kind: 'off', msg: '', at: 0 };
var timer = null, running = null, again = false;

function cfg() { var s = J.settings || {}; return { owner: s.ghOwner, repo: s.ghRepo, branch: s.ghBranch || 'gh-pages', token: s.ghToken, auto: s.autoPublish !== false }; }
P.ready = function () { var c = cfg(); return !!(c.owner && c.repo && c.token); };
P.publicUrl = function () {
  var c = cfg(); if (!c.owner || !c.repo) return '';
  var o = c.owner.toLowerCase(); return c.repo.toLowerCase() === o + '.github.io' ? 'https://' + o + '.github.io/' : 'https://' + o + '.github.io/' + c.repo + '/';
};
function set(kind, msg) { P.state = { kind: kind, msg: msg || '', at: kind === 'ok' ? Date.now() : P.state.at }; if (J.renderFoot) J.renderFoot(); }
P.refreshState = function () { if (!P.ready()) set('off'); else if (P.state.kind === 'off') set('pending'); };
P.init = function () { if (!P.ready()) { set('off'); return; } set('pending'); if (cfg().auto) P.schedule(1500); };
P.schedule = function (ms) {
  if (!P.ready() || !cfg().auto) { if (!P.ready()) set('off'); return; }
  if (P.state.kind !== 'busy') set('pending');
  clearTimeout(timer); timer = setTimeout(function () { P.run(false).catch(function () {}); }, ms || 4000);
};

/* ---------- GitHub API ---------- */
async function gh(method, path, body) {
  var c = cfg();
  var r = await J.http(API + path, { method: method, headers: { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  var data = null; try { data = r.text ? JSON.parse(r.text) : null; } catch (e) {}
  if (r.status >= 200 && r.status < 300) return data;
  var e = new Error(explain(r.status, data, path)); e.status = r.status; e.data = data; throw e;
}
function explain(status, data, path) {
  var m = (data && data.message) || '';
  if (status === 401) return 'GitHub did not accept your token. It may be mistyped or expired. Make a new one and paste it in Settings.';
  if (status === 403 && /rate limit/i.test(m)) return 'GitHub says the app is publishing too often. It will try again in a few minutes.';
  if (status === 403) return 'Your token is not allowed to do this. Check that it has Contents: Read and write on this repository' + (/pages/.test(path) ? ' and Pages: Read and write' : '') + '.';
  if (status === 404) return 'GitHub could not find ' + cfg().owner + '/' + cfg().repo + '. Check the username and repository name, and that the token was made for this repository.';
  if (status === 409) return 'The repository is empty or busy. Try again in a moment.';
  if (status === 422 && /too large|size/i.test(m)) return 'A file is too big for GitHub. Try a shorter video clip.';
  if (status === 0) return 'Could not reach GitHub. Check your internet connection.';
  return 'GitHub problem (' + status + '): ' + (m || 'unknown error');
}
function sha1js(m) {
  var l = m.length, w = new Uint32Array(80), H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
  var n = ((l + 9 + 63) >> 6) << 6, p = new Uint8Array(n); p.set(m); p[l] = 0x80; var bits = l * 8;
  p[n - 4] = bits >>> 24; p[n - 3] = (bits >>> 16) & 255; p[n - 2] = (bits >>> 8) & 255; p[n - 1] = bits & 255; p[n - 5] = Math.floor(l / 0x20000000) & 255;
  for (var o = 0; o < n; o += 64) {
    for (var i = 0; i < 16; i++) w[i] = (p[o + 4 * i] << 24) | (p[o + 4 * i + 1] << 16) | (p[o + 4 * i + 2] << 8) | p[o + 4 * i + 3];
    for (i = 16; i < 80; i++) { var x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];
    for (i = 0; i < 80; i++) {
      var f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      var k = i < 20 ? 0x5A827999 : i < 40 ? 0x6ED9EBA1 : i < 60 ? 0x8F1BBCDC : 0xCA62C1D6;
      var t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0; e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
  }
  return H.map(function (h) { return (h >>> 0).toString(16).padStart(8, '0'); }).join('');
}
P._sha1 = sha1js;
async function gitSha(bytes) {
  var head = new TextEncoder().encode('blob ' + bytes.length + '\0'), all = new Uint8Array(head.length + bytes.length); all.set(head, 0); all.set(bytes, head.length);
  if (window.crypto && crypto.subtle) { var d = await crypto.subtle.digest('SHA-1', all); return Array.prototype.map.call(new Uint8Array(d), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  return sha1js(all);
}
function b64ToBytes(b) { var s = atob(b), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

/* ---------- what the public site is made of ---------- */
P.publicIndex = function (html) {
  var A = '<!' + '--ADMIN_START--' + '>', Z = '<!' + '--ADMIN_END--' + '>';
  for (;;) { var a = html.indexOf(A); if (a < 0) break; var z = html.indexOf(Z, a); if (z < 0) break; html = html.slice(0, a) + html.slice(z + Z.length); }
  return html.replace('data-mode="admin"', 'data-mode="public"');
};
function extOf(m, blob) { var t = (blob && blob.type) || ''; if (m.type === 'image') return /png/.test(t) ? 'png' : /webp/.test(t) ? 'webp' : /gif/.test(t) ? 'gif' : 'jpg'; return /webm/.test(t) || /\.webm$/i.test(m.name) ? 'webm' : /quicktime/.test(t) || /\.mov$/i.test(m.name) ? 'mov' : 'mp4'; }
P.buildFiles = async function () {
  var files = [], add = function (path, text) { files.push({ path: path, text: text }); };
  add('index.html', P.publicIndex(await J.readAppFile('index.html')));
  for (var i = 0, n = ['core.js', 'art.js', 'views.js', 'style.css']; i < n.length; i++) add(n[i], await J.readAppFile(n[i]));
  add('.nojekyll', '');
  var ids = Object.keys(J.leagues).filter(function (k) { var L = J.leagues[k]; return L.races.length || L.articles.length || L.id === J.S.id; });
  var order = Object.keys(J.SERIES); ids.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
  add('data/index.json', JSON.stringify({ series: ids.map(function (k) { return { id: k, label: J.leagues[k].series.label }; }), default: ids.indexOf('cup') >= 0 ? 'cup' : ids[0] }));
  for (var j = 0; j < ids.length; j++) {
    var L = J.leagues[ids[j]], pub = J.publicData(L);
    for (var k = 0; k < pub.media.length; k++) {
      var m = pub.media[k], blob = null;
      try { blob = await J.store.getMedia(m.id); } catch (e) {}
      if (blob && !(m.type === 'video' && blob.size > VIDEO_MAX)) { m.url = 'media/' + m.id + '.' + extOf(m, blob); files.push({ path: m.url, blob: blob, immutable: true }); }
      else m.url = '';
      if (m.type === 'video') { var pb = null; try { pb = await J.store.getMedia(m.id + ':poster'); } catch (e) {} if (pb) { m.poster = 'media/' + m.id + '-poster.jpg'; files.push({ path: m.poster, blob: pb, immutable: true }); } }
    }
    add('data/' + L.id + '.json', JSON.stringify(pub));
  }
  return files;
};

/* ---------- connect (first time): check repo, turn on Pages, publish ---------- */
P.connect = async function () {
  var c = cfg();
  var repo = await gh('GET', '/repos/' + c.owner + '/' + c.repo);
  if (repo.private) throw new Error('That repository is private. GitHub Pages is free only for public repositories. On GitHub open the repository, then Settings, scroll to the bottom and choose Change visibility, Public.');
  if (repo.permissions && repo.permissions.push === false) throw new Error('Your token can read this repository but cannot change it. Give it Contents: Read and write.');
  await P.run(true);
  var pagesNote = '';
  try {
    var pages = null;
    try { pages = await gh('GET', '/repos/' + c.owner + '/' + c.repo + '/pages'); } catch (e) { if (e.status !== 404) throw e; }
    if (!pages) await gh('POST', '/repos/' + c.owner + '/' + c.repo + '/pages', { source: { branch: c.branch, path: '/' } });
    else if (!pages.source || pages.source.branch !== c.branch || (pages.source.path || '/') !== '/') await gh('PUT', '/repos/' + c.owner + '/' + c.repo + '/pages', { source: { branch: c.branch, path: '/' } });
  } catch (e) {
    pagesNote = ' One last step, only needed once: on GitHub open your ' + c.repo + ' repository, click Settings, then Pages. Under Branch pick "' + c.branch + '" and "/ (root)", then click Save.';
  }
  return 'Connected. Your site is building at ' + P.publicUrl() + ' and is usually live within 2 minutes.' + pagesNote;
};

/* ---------- publish: one commit with only the files that changed ---------- */
P.run = function (force) {
  if (!P.ready()) { set('off'); return Promise.reject(new Error('Fill in the GitHub details in Settings first.')); }
  if (running) { again = true; return running; }
  clearTimeout(timer);
  running = doRun(force).then(function (r) { running = null; if (again) { again = false; P.schedule(1000); } return r; }, function (e) { running = null; again = false; throw e; });
  return running;
};
async function doRun(force, force_init) {
  var c = cfg(), base = '/repos/' + c.owner + '/' + c.repo;
  set('busy');
  try {
    var files = await P.buildFiles();
    var head = null, treeSha = null, remote = {};
    try { var ref = await gh('GET', base + '/git/ref/heads/' + encodeURIComponent(c.branch)); head = ref.object.sha; }
    catch (e) {
      if (e.status === 409 && !force_init) { await gh('PUT', base + '/contents/README.md', { message: 'Start the repository', content: J.textToBase64('# ' + (J.S ? J.S.league.name : 'JSS') + '\n\nThe league website lives on the ' + c.branch + ' branch.\n') }); await new Promise(function (r) { setTimeout(r, 1500); }); return doRun(force, true); }
      if (e.status !== 404) throw e;
    }
    if (head) {
      var commit = await gh('GET', base + '/git/commits/' + head); treeSha = commit.tree.sha;
      var tree = await gh('GET', base + '/git/trees/' + treeSha + '?recursive=1');
      (tree.tree || []).forEach(function (t) { if (t.type === 'blob') remote[t.path] = t.sha; });
    }
    var entries = [], wanted = {}, uploaded = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i]; wanted[f.path] = 1;
      if (f.immutable && remote[f.path]) continue;
      var bytes = f.blob ? new Uint8Array(await f.blob.arrayBuffer()) : new TextEncoder().encode(f.text);
      var sha = await gitSha(bytes);
      if (remote[f.path] === sha) continue;
      if (f.blob && f.blob.size > 95 * 1024 * 1024) continue;
      var b64 = f.blob ? await J.blobToBase64(f.blob) : J.textToBase64(f.text);
      var blob = await gh('POST', base + '/git/blobs', { content: b64, encoding: 'base64' });
      entries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha }); uploaded++;
    }
    Object.keys(remote).forEach(function (p) { if (!wanted[p] && (/^media\//.test(p) || /^data\/[a-z]+\.json$/.test(p))) entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
    if (!entries.length) { set('ok'); return 'Already up to date.'; }
    var newTree = await gh('POST', base + '/git/trees', treeSha ? { base_tree: treeSha, tree: entries } : { tree: entries.filter(function (e) { return e.sha; }) });
    var msg = 'Update ' + (J.S ? J.S.league.name + ' (' + J.S.series.label + ')' : 'site') + ' ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
    var nc = await gh('POST', base + '/git/commits', { message: msg, tree: newTree.sha, parents: head ? [head] : [] });
    if (head) await gh('PATCH', base + '/git/refs/heads/' + encodeURIComponent(c.branch), { sha: nc.sha, force: false });
    else await gh('POST', base + '/git/refs', { ref: 'refs/heads/' + c.branch, sha: nc.sha });
    set('ok');
    return 'Published ' + J.plural(uploaded, 'file') + '. Visitors see it in about 1 to 2 minutes.';
  } catch (e) {
    set('err', e.message || String(e));
    if (e.status === 403 && /rate limit/i.test(e.message)) P.schedule(5 * 60000);
    throw e;
  }
}
})();
