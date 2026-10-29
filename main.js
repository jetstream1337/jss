// JSS Commissioner - Electron main process.
// Holds the window, does network requests (so Claude and GitHub calls are not blocked by the browser),
// and keeps leagues, photos/videos and settings on disk. API key and GitHub token are encrypted with Windows' own protection.
const { app, BrowserWindow, ipcMain, safeStorage, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, 'src');
const DATA = () => app.getPath('userData');
const LEAGUES = () => path.join(DATA(), 'leagues');
const MEDIA = () => path.join(DATA(), 'media');
const STATE = () => path.join(DATA(), 'state.json');
const SETTINGS = () => path.join(DATA(), 'settings.json');
const SECRET_KEYS = ['apiKey', 'geminiKey', 'ghToken'];
const ALLOWED_HOSTS = ['api.anthropic.com', 'api.github.com', 'generativelanguage.googleapis.com'];

function ensureDirs() { [LEAGUES(), MEDIA()].forEach((d) => fs.mkdirSync(d, { recursive: true })); }
function safeName(s) { return String(s).replace(/[^a-zA-Z0-9_:-]/g, '').replace(/:/g, '__'); }
function writeAtomic(file, data) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }

// ---- network (only Claude and GitHub) ----
ipcMain.handle('http', async (_e, req) => {
  const u = new URL(req.url);
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.includes(u.hostname)) return { status: 0, text: JSON.stringify({ message: 'Blocked host' }) };
  const headers = Object.assign({}, req.headers || {});
  delete headers['anthropic-dangerous-direct-browser-access'];
  if (u.hostname === 'api.github.com') headers['User-Agent'] = 'JSS-Commissioner';
  try {
    const r = await fetch(req.url, { method: req.method || 'GET', headers, body: req.body });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: JSON.stringify({ message: 'Network error: ' + e.message }) };
  }
});

// ---- leagues ----
ipcMain.handle('store:load', () => {
  ensureDirs();
  const leagues = {};
  for (const f of fs.readdirSync(LEAGUES())) {
    if (!f.endsWith('.json')) continue;
    const d = readJson(path.join(LEAGUES(), f), null);
    if (d) leagues[f.replace(/\.json$/, '')] = d;
  }
  return { leagues, active: readJson(STATE(), {}).active || 'cup' };
});
ipcMain.handle('store:saveLeague', (_e, id, json) => {
  ensureDirs();
  const file = path.join(LEAGUES(), safeName(id) + '.json');
  if (fs.existsSync(file)) { try { fs.copyFileSync(file, file + '.bak'); } catch (e) { /* ignore */ } }
  writeAtomic(file, json);
  return true;
});
ipcMain.handle('store:deleteLeague', (_e, id) => { const f = path.join(LEAGUES(), safeName(id) + '.json'); if (fs.existsSync(f)) fs.unlinkSync(f); return true; });
ipcMain.handle('store:setActive', (_e, id) => { ensureDirs(); writeAtomic(STATE(), JSON.stringify({ active: id })); return true; });

// ---- settings (secrets encrypted) ----
ipcMain.handle('settings:load', () => {
  const s = readJson(SETTINGS(), {});
  for (const k of SECRET_KEYS) {
    if (s[k + 'Enc']) {
      try { s[k] = safeStorage.decryptString(Buffer.from(s[k + 'Enc'], 'base64')); } catch (e) { s[k] = ''; }
      delete s[k + 'Enc'];
    }
  }
  return s;
});
ipcMain.handle('settings:save', (_e, s) => {
  ensureDirs();
  const out = Object.assign({}, s);
  for (const k of SECRET_KEYS) {
    if (out[k] && safeStorage.isEncryptionAvailable()) { out[k + 'Enc'] = safeStorage.encryptString(out[k]).toString('base64'); delete out[k]; }
  }
  writeAtomic(SETTINGS(), JSON.stringify(out, null, 2));
  return true;
});

// ---- photos and video ----
ipcMain.handle('media:put', (_e, key, buf, type) => {
  ensureDirs();
  const f = path.join(MEDIA(), safeName(key));
  fs.writeFileSync(f, Buffer.from(buf));
  fs.writeFileSync(f + '.type', String(type || ''));
  return true;
});
ipcMain.handle('media:get', (_e, key) => {
  const f = path.join(MEDIA(), safeName(key));
  if (!fs.existsSync(f)) return null;
  let type = ''; try { type = fs.readFileSync(f + '.type', 'utf8'); } catch (e) { /* ignore */ }
  return { data: fs.readFileSync(f), type };
});
ipcMain.handle('media:del', (_e, key) => { const f = path.join(MEDIA(), safeName(key)); for (const x of [f, f + '.type']) if (fs.existsSync(x)) fs.unlinkSync(x); return true; });

// ---- the app's own files (used to build the public website) ----
ipcMain.handle('app:readFile', (_e, name) => {
  if (!['index.html', 'core.js', 'art.js', 'views.js', 'style.css'].includes(name)) throw new Error('Not allowed');
  return fs.readFileSync(path.join(SRC, name), 'utf8');
});
ipcMain.handle('app:openExternal', (_e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return true; });
ipcMain.handle('app:dataFolder', () => { shell.openPath(DATA()); return DATA(); });

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 980, minHeight: 640,
    title: "Jet's Sim Series - Commissioner",
    backgroundColor: '#0a1f44',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });
  win.loadFile(path.join(SRC, 'index.html'));
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [{ label: 'Open data folder', click: () => shell.openPath(DATA()) }, { type: 'separator' }, { role: 'quit' }] },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
]));

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
