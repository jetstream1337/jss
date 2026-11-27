/* Virtual NASCAR - the driver life cycle: real ages, aging every season, retirement, new young drivers.
   Ages come from real birth years (the ones I was less sure of are marked approximate and can be corrected on the driver's page).
   Retirement is rare before the late 30s, considered in the mid and late 40s, and a driver still racing at 50 is very uncommon. */
(function () {
'use strict';
var J = window.JSS, esc = J.esc;

/* ---------- real birth years. "?" = my best recollection, not checked ---------- */
var SRC = 'Kyle Larson:1992,Chase Elliott:1995,William Byron:1997,Alex Bowman:1993,Denny Hamlin:1980,Chase Briscoe:1994,Christopher Bell:1994,Ty Gibbs:2002,Austin Cindric:1998,Ryan Blaney:1993,Joey Logano:1990,Brad Keselowski:1984,Chris Buescher:1992,Ryan Preece:1990,Corey LaJoie:1991,Ross Chastain:1992,Connor Zilisch:2006,Shane van Gisbergen:1989,Kevin Magnussen:1992,Bubba Wallace:1993,Riley Herbst:1999,Tyler Reddick:1996,Corey Heim:2002,Austin Dillon:1990,Kyle Busch:1985,Austin Hill:1994,Jesse Love:2004,Daniel Suarez:1991,Michael McDowell:1984,Carson Hocevar:2003,Noah Gragson:1998,Todd Gilliland:2000,Zane Smith:1999,Chandler Smith:2002,Ty Dillon:1992,AJ Allmendinger:1982,John Hunter Nemechek:1997,Erik Jones:1996,Jimmie Johnson:1975,Josh Berry:1990,Cole Custer:1998,Ricky Stenhouse Jr.:1987,Cody Ware:1996,Casey Mears:1978,Anthony Alfredo:1999,BJ McLeod:1983,Katherine Legge:1980,JJ Yeley:1976,Joey Gase:1993,Josh Bilicki:1995,Gray Gaulding:1998,Timmy Hill:1993,Justin Allgaier:1986,Daniel Dye:2001?,Chad Finchum:1987?,'
  + 'Carson Kvapil:2003,Sammy Smith:2004,Rajah Caruth:2002,Jake Finch:1996?,Garrett Mitchell:2001?,William Sawalich:2005,Brent Crews:2006,Brandon Jones:1997,Taylor Gray:2003?,Sheldon Creed:1998,Sam Mayer:2003,Corey Day:2005,Patrick Staropoli:2001?,Mason Maggio:1998?,Josh Williams:1989?,Jeremy Clements:1985,Jeb Burton:1992,Blaine Perkins:1996?,Andrew Patterson:2001?,Jordan Anderson:1991?,Austin Green:1999?,Nick Sanchez:2001?,Ryan Sieg:1988,Kyle Sieg:1996?,Garrett Smithley:1992,Parker Retzlaff:2001?,Ryan Ellis:1990?,Nathan Byrd:1980?,Harrison Burton:2000,Dean Thompson:2001?,Brennan Poole:1991,Lavar Scott:1998?,'
  + 'Kaden Honeycutt:2002?,Tanner Gray:1999,Gio Ruggiero:2004?,Adam Andretti:2000?,Nick Leitz:2002?,Cole Butcher:2006?,Ty Majeski:1994,Jake Garcia:2002?,Ben Rhodes:1997,Layne Riggs:2002,Brenden Queen:2005?,Mini Tyrrell:1993?,Justin Haley:1999,Tyler Ankrum:2001,Daniel Hemric:1991,Kris Wright:1996?,Christian Eckes:2001,Andres Perez de Lara:2005?,Landen Lewis:2001?,Tyler Reif:2000?,Parker Eatmon:2001?,Connor Hall:2001?,Connor Mosack:1998,Tristan McKee:2007,Frankie Muniz:1985,Luke Baldwin:2003?,Clayton Green:1999?,Josh Reaume:1978?,Stewart Friesen:1983,Grant Enfinger:1985,Spencer Boyd:1992?,Nathan Nicholson:1999?,Dawson Sutton:2007?,Toni Breidinger:1999,Caleb Costner:1996?,Tony Stewart:1971,Colin Braun:1988,Carson Ferguson:2002?,'
  + 'Jake Bollman:2000?,Isabella Robusto:2005?,Thomas Annunziata:2004?,Gavan Boschele:2006?,Jade Avedisian:2007,Max Reaves:2003?,Carson Brown:2004?,Taylor Reimer:2004?,Lanie Buice:2008?,Jason Kitzmiller:1991?,Takuma Koga:2002?,Michael Maples:1964?,Ryan Vargas:2001?,Austin Vaughn:1996?,Alex Clubb:1993?,Jeff Maconi:1966?,Brad Smith:1976?,Nate Moeller:1998?,Bobby Dale Earnhardt:2001?,Andy Jankowiak:1990?,Isaac Kitzmiller:1990?,Kevin Campbell:1986?,Dale Shearer:1985?,George Siciliano:2003?';
var BIRTH = null;
function birthTable() { if (BIRTH) return BIRTH; BIRTH = {}; SRC.split(',').forEach(function (p) { var i = p.lastIndexOf(':'), nm = p.slice(0, i), v = p.slice(i + 1); BIRTH[J.nameKey(nm)] = { y: parseInt(v, 10), approx: /\?$/.test(v) }; }); return BIRTH; }
J.realBirth = function (name) { return birthTable()[J.nameKey(name)] || null; };

/* ---------- age ---------- */
var AGE_RANGE = { cup: [24, 39], xfinity: [21, 37], truck: [20, 35], arca: [17, 31] };
// a driver's age this season. Real birth year if we have one, else his set age, else a believable made-up one (marked as estimated).
J.ageOf = function (S, key) {
  var c = (S.contracts || {})[key]; if (!c) return null; var yr = J.seasonNum(S);
  if (c.birth == null) {
    var rb = c.fictional ? null : J.realBirth(c.name || key);
    if (rb) { c.birth = rb.y; c.birthEst = rb.approx; }
    else if (c.age) { c.birth = yr - c.age; c.birthEst = !c.ageSet; }
    else { var r = J.rng('age' + S.series.id + key), rg = AGE_RANGE[S.series.id] || [22, 36], old = c.pt || c.extra ? 1.15 : 1; c.birth = yr - Math.round(rg[0] + Math.pow(r(), 1.3) * (rg[1] - rg[0]) * old); c.birthEst = true; }
  }
  c.age = yr - c.birth; return c.age;
};
J.setAge = function (S, key, age) { var c = (S.contracts || {})[key]; if (!c || !(age >= 14 && age <= 80)) return false; c.birth = J.seasonNum(S) - age; c.age = age; c.ageSet = true; c.birthEst = false; return true; };

// age of a free agent (he has no contract to hold a birth year)
J.ageOfFA = function (S, f) {
  var yr = J.seasonNum(S); if (f.birth != null) return yr - f.birth;
  var rb = f.fictional ? null : J.realBirth(f.name); if (rb) { f.birth = rb.y; return yr - rb.y; }
  var r = J.rng('agefa' + f.key), rg = AGE_RANGE[S.series.id] || [22, 36]; f.birth = yr - Math.round(rg[0] + Math.pow(r(), 1.3) * (rg[1] - rg[0])); return yr - f.birth;
};
/* ---------- when drivers retire ---------- */
// chance a driver of this age hangs it up after the season, before anything else is considered
var HZ = { 35: 0.01, 36: 0.015, 37: 0.02, 38: 0.03, 39: 0.04, 40: 0.05, 41: 0.06, 42: 0.08, 43: 0.1, 44: 0.13, 45: 0.18, 46: 0.25, 47: 0.33, 48: 0.45, 49: 0.6, 50: 0.75, 51: 0.85 };
J.RETIRE = { off: 0, rare: 0.5, normal: 1, more: 1.5 };
J.retireChance = function (S, key, stat, prog) {
  var set = (J.settings && J.settings.retire) || 'normal', mul = J.RETIRE[set]; if (mul == null) mul = 1; if (!mul) return 0;
  var c = S.contracts[key], age = J.ageOf(S, key); if (!c || age == null || age < 35) return 0;
  var p = age >= 52 ? 0.92 : HZ[age] || 0, why = [];
  if (stat && stat.rank && stat.n) { if (stat.rank <= Math.max(3, stat.n * 0.25) || stat.d && stat.d.wins > 0) { p *= 0.55; } else if (stat.rank > stat.n * 0.7) p *= 1.5; }
  var left = (c.through || 0) - J.seasonNum(S); if (left >= 2) p *= 0.6; else if (left <= 0) p *= 1.2;
  if (c.pt) p *= 1.25;
  if (J.isOwnerDriver && J.isOwnerDriver(S, key)) p *= 0.5;
  var rt = S.ratings && S.ratings.drivers && S.ratings.drivers[key]; if (rt && J.rtOverall && age >= 38 && J.rtOverall(rt) < 45) p *= 1.4;
  return Math.min(0.97, p * mul);
};
J.retireWhy = function (S, key, stat) {
  var age = J.ageOf(S, key), a = ['Age ' + age + ', announces he is stepping away'];
  if (stat && stat.rank) a.push('P' + stat.rank + ' in points this season');
  return a;
};
J.noteRetired = function (L, m, c) {
  L.retired = L.retired || []; if (L.retired.some(function (r) { return r.key === m.key; })) return;
  L.retired.push({ key: m.key, name: m.name || c.name || m.key, age: J.ageOf(L, m.key), year: J.seasonNum(L), series: L.series.id, team: m.fromTeam || '', car: m.fromCar || c.car || '', base: c.base || 60, rl: c.rl || null, birth: c.birth != null ? c.birth : null, fictional: !!c.fictional });
};

/* ---------- new young drivers (entry-level series only) ---------- */
var FIRST = 'Cody,Tyler,Brady,Colton,Hayden,Mason,Landon,Wyatt,Dalton,Garrett,Jace,Kyler,Tanner,Braxton,Cooper,Easton,Gage,Hudson,Knox,Levi,Maddie,Riley,Kenzie,Sydney,Harper,Jordan,Parker,Reese,Trey,Zach,Dillon,Ryder,Brooks,Chase,Drew,Evan,Grant,Holden,Jaxon,Kade'.split(',');
var LAST = 'Whitlock,Rourke,Calloway,Pruitt,Hargrove,Dunmore,Teague,Ballard,Kimbrough,Lockhart,Maddox,Overby,Pickett,Rutledge,Sizemore,Tolliver,Underwood,Vance,Wimberly,Yates,Ashby,Bledsoe,Cantrell,Dickens,Eubanks,Fairchild,Gentry,Haskins,Ingram,Jessup,Kincaid,Lathrop,McBride,Nolen,Orr,Pettigrew,Quarles,Redmond,Sloan,Tillery,Upchurch,Vickers,Whitaker,Yancey,Zimmer,Bishop,Coley,Doyle,Ellison,Frady'.split(',');
J.makeRookieName = function (S, rr) {
  for (var i = 0; i < 60; i++) { var nm = FIRST[Math.floor(rr() * FIRST.length)] + ' ' + LAST[Math.floor(rr() * LAST.length)]; if (!S.contracts[J.driverKey(nm)] && !(S.removed || {})[J.driverKey(nm)] && !(S.retired || []).some(function (r) { return r.key === J.driverKey(nm); })) return nm; }
  return 'Rookie ' + Math.floor(rr() * 9000 + 1000);
};
J.spawnRookies = function (S, n) {
  var yr = J.seasonNum(S), made = [], rr = J.rng('rookies' + S.series.id + yr + (S.races || []).length);
  J.openCars(S).sort(function () { return rr() - 0.5; }).slice(0, n).forEach(function (o) {
    var nm = J.makeRookieName(S, rr), k = J.driverKey(nm), age = 17 + Math.floor(rr() * 6);
    S.contracts[k] = { name: nm, team: o.tid, car: o.num, through: yr + 1 + (rr() < 0.5 ? 1 : 0), base: 44 + Math.floor(rr() * 20), auto: false, pt: false, ptSet: true, fictional: true, rookie: true, birth: yr - age, age: age, birthEst: false, signedFa: yr };
    made.push(nm + ' (' + o.team + ' #' + o.num + ', age ' + age + ')');
  });
  return made;
};

/* ---------- the retired list ---------- */
J.retiredPanel = function (S, all, LAD, cur, sLabel) {
  var rows = []; (all ? LAD : [S.series.id]).forEach(function (s) { var L = cur(s); (L && L.retired || []).forEach(function (r) { rows.push({ s: s, r: r }); }); });
  rows.sort(function (a, b) { return b.r.year - a.r.year || (b.r.age || 0) - (a.r.age || 0); });
  return '<h3 style="margin-top:14px">Retired drivers (' + rows.length + ')</h3><p class="sub">Drivers who have hung it up. Their rides open for someone else. Bring one back if you want him to un-retire (he becomes a free agent).</p>'
    + (rows.length ? '<div class="tw"><table class="data"><thead><tr>' + (all ? '<th>Series</th>' : '') + '<th>Driver</th><th>Age</th><th>Last ride</th><th>Retired</th><th></th></tr></thead><tbody>' + rows.map(function (x) { return '<tr>' + (all ? '<td>' + esc(sLabel(x.s)) + '</td>' : '') + '<td><b>' + esc(x.r.name) + '</b></td><td>' + esc(x.r.age == null ? '' : x.r.age) + '</td><td>' + esc(x.r.team || '') + (x.r.car ? ' #' + esc(x.r.car) : '') + '</td><td>' + esc(x.r.year) + '</td><td><button class="btn ghost sm" data-act="unretire" data-sid="' + esc(x.s) + '" data-k="' + esc(x.r.key) + '">Bring back</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim">Nobody has retired yet.</p>');
};
J.acts.unretire = function (el) {
  var L = J.leagues[el.dataset.sid]; if (!L) return; var i = -1; (L.retired || []).forEach(function (r, n) { if (r.key === el.dataset.k) i = n; }); if (i < 0) return;
  var r = L.retired.splice(i, 1)[0]; L.freeAgents = L.freeAgents || []; L.freeAgents.push({ key: r.key, name: r.name, from: r.team || '', fromId: '', base: r.base || 60, rl: r.rl || null, year: J.seasonNum(L) });
  var c = { name: r.name, base: r.base, birth: r.birth }; if (r.birth == null) delete c.birth;
  J.save(); if (J.saveDirty) J.saveDirty(); J.toast(r.name + ' is a free agent again.'); J.refresh();
};
})();
