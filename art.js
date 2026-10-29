/* Jet's Sim Series - artwork: page emblems, outlet logos, avatars, theme (shared by the app and the public site) */
(function () {
'use strict';
var J = window.JSS, esc = J.esc;

/* ---------- theme: dark (default) or light, per viewer ---------- */
var TK = 'jss_theme';
J.themePref = function () { try { return localStorage.getItem(TK) || 'dark'; } catch (e) { return 'dark'; } };
J.themeNow = function () { var p = J.themePref(); if (p === 'auto') return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark'; return p === 'light' ? 'light' : 'dark'; };
J.applyTheme = function () { document.documentElement.setAttribute('data-theme', J.themeNow()); };
J.setTheme = function (p) { try { localStorage.setItem(TK, p); } catch (e) {} J.applyTheme(); };
if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (J.themePref() === 'auto') J.applyTheme(); }); } catch (e) {} }
J.applyTheme();

/* ---------- icons (24px grid, drawn with the current text color) ---------- */
var I = {
  home: '<path d="M5 21V4"/><path d="M5 4.5c3-1.6 5 1.6 8 0s4.2-1 6 0v8c-1.8-1-3-1.6-6 0s-5-1.6-8 0"/>',
  standings: '<path d="M8 3.5h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5.2a2.3 2.3 0 0 0 2.5 4.2M16 5.5h2.8a2.3 2.3 0 0 1-2.5 4.2"/><path d="M12 13v3.5M9.5 20.5h5M10.5 16.5h3v4h-3z"/>',
  results: '<path d="M5 21.5V3.5"/><rect x="5" y="4" width="14" height="9.5"/><path fill="currentColor" stroke="none" d="M5 4h3.5v3.2H5zM12 4h3.5v3.2H12zM8.5 7.2H12v3.1H8.5zM15.5 7.2H19v3.1h-3.5zM5 10.3h3.5v3.2H5zM12 10.3h3.5v3.2H12z"/>',
  schedule: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><ellipse cx="12" cy="15" rx="4.6" ry="2.6"/>',
  news: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  highlights: '<path d="M3.5 8h3.2L8.3 5.5h7.4L17.3 8h3.2v11.5h-17z"/><circle cx="12" cy="13.6" r="3.6"/>',
  garage: '<path d="M3.5 5h11.5v8.5H9l-3.2 3v-3H3.5z"/><path d="M15 9.5h5.5v8.3h-2v3l-3.2-3H11v-2.3"/>',
  display: '<path d="M4 7h9.5M18.5 7H20M4 17h3.5M12.5 17H20"/><circle cx="16" cy="7" r="2.3"/><circle cx="10" cy="17" r="2.3"/>',
  desk: '<path d="M5 14v-2a7 7 0 0 1 14 0v2"/><rect x="3.5" y="13" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="13" width="4" height="6.5" rx="1.5"/><path d="M18.5 19.5c0 1.4-2 2.3-5 2.3"/>',
  import: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 15.5v4h16v-4"/>',
  studio: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3.5 3.5"/>',
  wrench: '<path d="M14.5 3.8a4.5 4.5 0 0 0-4.7 6.1L3.5 16.2l3.3 3.3 6.3-6.3a4.5 4.5 0 0 0 6.1-4.7l-2.7 2.7-2.6-.6-.6-2.6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  auto: '<rect x="3.5" y="4.5" width="17" height="12" rx="1.5"/><path d="M8.5 20h7M12 16.5V20"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'
};
J.icon = function (name, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || I.home) + '</svg>'; };

/* ---------- page identities: emblem + pattern + accent ---------- */
var PAGES = {
  home: { icon: 'home', acc: 'red' }, standings: { icon: 'standings', acc: 'yellow' }, results: { icon: 'results', acc: 'white' },
  schedule: { icon: 'schedule', acc: 'blue' }, news: { icon: 'news', acc: 'red' }, highlights: { icon: 'highlights', acc: 'blue' },
  garage: { icon: 'garage', acc: 'yellow' }, display: { icon: 'display', acc: 'white' },
  'import': { icon: 'import', acc: 'hazard' }, studio: { icon: 'studio', acc: 'hazard' }, races: { icon: 'results', acc: 'hazard' }, editschedule: { icon: 'schedule', acc: 'hazard' },
  league: { icon: 'desk', acc: 'hazard' }, garagetools: { icon: 'wrench', acc: 'hazard' }, settings: { icon: 'display', acc: 'hazard' }, preview: { icon: 'auto', acc: 'white' }
};
J.pageArt = function (route) { return PAGES[route] || PAGES.home; };

/* ---------- outlet logos ---------- */
var OL = {
  wire: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="3" fill="#2f6fff"/><g fill="#fff"><rect x="6" y="6" width="5" height="5"/><rect x="16" y="6" width="5" height="5"/><rect x="11" y="11" width="5" height="5"/><rect x="21" y="11" width="5" height="5"/><rect x="6" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/><rect x="11" y="21" width="5" height="5"/><rect x="21" y="21" width="5" height="5"/></g></svg>',
  silly: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="16" fill="#e3202c"/><path d="M8 9.5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9l-5 4v-4H8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="#fff"/><path d="M14.5 13.2a2.2 2.2 0 1 1 3.2 2c-.8.4-1.2.9-1.2 1.6" stroke="#e3202c" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="16.5" cy="19.2" r="1.05" fill="#e3202c"/></svg>',
  notes: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="3" fill="#ffc20e"/><rect x="9" y="6.5" width="14" height="20" rx="1.5" fill="#0b0d12"/><rect x="13" y="4.5" width="6" height="4" rx="1" fill="#0b0d12" stroke="#ffc20e" stroke-width="1.4"/><path d="M12 13h8M12 16.5h8M12 20h5" stroke="#ffc20e" stroke-width="1.6" stroke-linecap="round"/></svg>'
};
J.outletLogo = function (id, size) {
  var o = J.OUTLETS[id] || J.OUTLETS.wire;
  return '<span class="olog ol-' + o.id + (size ? ' ol-' + size : '') + '">' + (OL[o.id] || OL.wire) + '<b>' + esc(o.name) + '</b>' + (size === 'lg' ? '<small>' + esc(o.tag) + '</small>' : '') + '</span>';
};

/* ---------- avatars ---------- */
J.initials = function (name) { var w = String(name || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase(); };
J.avatar = function (au, big) {
  if (au.figure) return '<span class="av fig' + (big ? ' big' : '') + '" style="--c:' + au.color + '">' + esc(J.initials(au.name)) + '</span>';
  var f = au.fan || {}, src = f.handle || au.name;
  var ini = /[A-Za-z]/.test(String(f.name || '').charAt(0)) ? String(f.name).charAt(0).toUpperCase() : J.initials(src).charAt(0);
  return '<span class="av' + (big ? ' big' : '') + '" style="--c:' + (f.color || '#94a3b8') + '">' + esc(ini) + '</span>';
};
})();
