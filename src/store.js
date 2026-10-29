/* Jet's Sim Series - commissioner storage (never published).
   In the desktop app everything goes through window.jssNative (files on disk, secrets encrypted by Windows).
   In a plain browser it falls back to localStorage (leagues, settings) and IndexedDB (photos, video). */
(function () {
'use strict';
var J = window.JSS, N = window.jssNative || null, ST = J.store = {};
var LK = 'jss_app_leagues_v1', SK = 'jss_app_settings_v1';
ST.native = !!(N && N.store);
var DEFAULTS = { aiProvider: '', geminiKey: '', geminiModel: '', geminiLite: '', geminiList: [], apiKey: '', writerModel: 'claude-sonnet-5-5', chatterModel: 'claude-haiku-5-5', autoCoverage: true, autoNews: true, ghOwner: '', ghRepo: '', ghBranch: 'gh-pages', ghToken: '', autoPublish: true };
ST.defaults = DEFAULTS;

/* ---- leagues ---- */
ST.loadLeagues = async function () {
  var raw = null;
  if (ST.native) raw = await N.store.load();
  else { try { raw = JSON.parse(localStorage.getItem(LK) || 'null'); } catch (e) { raw = null; } }
  raw = raw || { leagues: {}, active: 'cup' };
  var out = { leagues: {}, active: raw.active || 'cup' };
  Object.keys(raw.leagues || {}).forEach(function (k) { out.leagues[k] = J.normalize(raw.leagues[k]); });
  return out;
};
function browserSaveAll() {
  var all = { leagues: J.leagues || {}, active: J.S ? J.S.id : 'cup' };
  try { localStorage.setItem(LK, JSON.stringify(all)); return true; } catch (e) { J.toast('This browser is out of storage space. Download a backup now.', true); return false; }
}
ST.saveLeague = async function (S) { if (ST.native) return N.store.saveLeague(S.id, JSON.stringify(S)); return browserSaveAll(); };
ST.deleteLeague = async function (id) { if (ST.native) return N.store.deleteLeague(id); return browserSaveAll(); };
ST.setActive = async function (id) { if (ST.native) return N.store.setActive(id); return browserSaveAll(); };

/* ---- settings (API key and GitHub token live here, never in league data) ---- */
ST.loadSettings = async function () {
  var s = null;
  if (ST.native) s = await N.settings.load();
  else { try { s = JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { s = null; } }
  s = Object.assign({}, DEFAULTS, s || {});
  if (!s.aiProvider) s.aiProvider = s.apiKey ? 'claude' : 'gemini';
  return s;
};
ST.saveSettings = async function (s) {
  if (ST.native) return N.settings.save(s);
  try { localStorage.setItem(SK, JSON.stringify(s)); } catch (e) { J.toast('Could not save settings.', true); }
};

/* ---- media blobs ---- */
var dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(function (res, rej) {
    var rq = indexedDB.open('jss_media', 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore('m'); };
    rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { rej(rq.error); };
  });
  return dbp;
}
function tx(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('m', mode), s = t.objectStore('m'), r = fn(s); t.oncomplete = function () { res(r && r.result); }; t.onerror = function () { rej(t.error); }; }); }); }
ST.putMedia = async function (key, blob) {
  if (ST.native) { var buf = await blob.arrayBuffer(); return N.media.put(key, buf, blob.type || ''); }
  return tx('readwrite', function (s) { return s.put(blob, key); });
};
ST.getMedia = async function (key) {
  if (ST.native) { var r = await N.media.get(key); return r ? new Blob([r.data], { type: r.type || '' }) : null; }
  return tx('readonly', function (s) { return s.get(key); });
};
ST.delMedia = async function (key) {
  if (ST.native) return N.media.del(key);
  return tx('readwrite', function (s) { return s.delete(key); });
};
/* Load every photo/video of a league into object URLs for display. */
ST.loadBlobs = async function (S) {
  Object.keys(J.blobs).forEach(function (k) { try { URL.revokeObjectURL(J.blobs[k]); } catch (e) {} delete J.blobs[k]; });
  for (var i = 0; i < S.media.length; i++) {
    var m = S.media[i];
    try {
      var b = await ST.getMedia(m.id); if (b) J.blobs[m.id] = URL.createObjectURL(b);
      if (m.type === 'video') { var p = await ST.getMedia(m.id + ':poster'); if (p) J.blobs[m.id + ':poster'] = URL.createObjectURL(p); }
    } catch (e) { console.warn('media load failed', m.id, e); }
  }
};

/* ---- reading the app's own files (for building the public website) ---- */
J.readAppFile = async function (name) {
  if (N && N.readAppFile) return N.readAppFile(name);
  var r = await fetch(name + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('Could not read ' + name); return r.text();
};
J.blobToBase64 = function (blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(blob); }); };
J.textToBase64 = function (t) { var b = new TextEncoder().encode(t), s = ''; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
J.openExternal = function (url) { if (N && N.openExternal) N.openExternal(url); else window.open(url, '_blank', 'noopener'); };
})();
