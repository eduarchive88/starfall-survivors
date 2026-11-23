'use strict';
// ============================================================
// canvas / view
// ============================================================
const cv = $('c');
const ctx = cv.getContext('2d');
const view = { dpr: 1, S: 3, vw: 200, vh: 300, cw: 0, ch: 0, safeTop: 0, safeBottom: 0 };
function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.cw = window.innerWidth; view.ch = window.innerHeight;
  cv.width = Math.round(view.cw * view.dpr);
  cv.height = Math.round(view.ch * view.dpr);
  view.S = Math.max(1, Math.round(Math.min(cv.width, cv.height) / 200));
  view.vw = cv.width / view.S; view.vh = cv.height / view.S;
  const r = $('safe').getBoundingClientRect();
  view.safeTop = r.top; view.safeBottom = view.ch - r.bottom;
}
window.addEventListener('resize', resize);
resize();

// ground texture (tiles seamlessly; decorations kept away from edges)
const GROUND = (() => {
  const N = 512, c = makeCanvas(N, N), x = c.getContext('2d'), rnd = mulberry32(1337);
  x.fillStyle = '#263a26'; x.fillRect(0, 0, N, N);
  const blob = (cx, cy, rad, col) => {
    x.fillStyle = col;
    for (let i = 0; i < rad * rad * 1.6; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * rad;
      const px = Math.floor(cx + Math.cos(a) * d), py = Math.floor(cy + Math.sin(a) * d * 0.7);
      x.fillRect(((px % N) + N) % N, ((py % N) + N) % N, 2, 2);
    }
  };
  for (let i = 0; i < 26; i++) blob(rnd() * N, rnd() * N, 14 + rnd() * 22, pick(['#2a422a', '#223522', '#2d472b']));
  for (let i = 0; i < 9; i++) blob(rnd() * N, rnd() * N, 10 + rnd() * 16, '#36301f');
  for (let i = 0; i < 2600; i++) { x.fillStyle = pick(['#2e462c', '#20321f', '#304b2e', '#29402a']); x.fillRect((rnd() * N) | 0, (rnd() * N) | 0, 1, 1); }
  for (let i = 0; i < 420; i++) {
    const px = (rnd() * N) | 0, py = (rnd() * N) | 0;
    x.fillStyle = '#3d5e37'; x.fillRect(px, py, 1, 2); x.fillRect(px + 2, py - 1, 1, 3); x.fillRect(px + 4, py, 1, 2);
  }
  for (let i = 0; i < 90; i++) {
    const px = (rnd() * N) | 0, py = (rnd() * N) | 0;
    x.fillStyle = pick(['#e8dc78', '#d8789a', '#9ac8f0', '#f0f0f0']); x.fillRect(px, py, 1, 1);
    x.fillStyle = '#2f4f2c'; x.fillRect(px, py + 1, 1, 1);
  }
  for (let i = 0; i < 70; i++) {
    const px = (rnd() * N) | 0, py = (rnd() * N) | 0;
    x.fillStyle = '#4a4a50'; x.fillRect(px, py, 3, 2); x.fillStyle = '#6a6a72'; x.fillRect(px, py, 2, 1);
  }
  for (let i = 0; i < 10; i++) x.drawImage(ITEM.tomb.c, (20 + rnd() * (N - 40)) | 0, (20 + rnd() * (N - 40)) | 0);
  for (let i = 0; i < 14; i++) x.drawImage(ITEM.bush.c, (20 + rnd() * (N - 40)) | 0, (20 + rnd() * (N - 40)) | 0);
  return c;
})();

// ============================================================
// audio (tiny synth)
// ============================================================
let actx = null;
function audio() {
  if (!save.sound || SIM) return null;
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfxT = {};
function throttle(k, ms) { const n = performance.now(); if (sfxT[k] && n - sfxT[k] < ms) return false; sfxT[k] = n; return true; }
let gemPitch = 0, gemPitchT = 0;
const sfx = {
  hit() { if (throttle('hit', 45)) tone(rand(180, 260), 0.05, 'square', 0.025, -80); },
  gem() {
    const n = performance.now();
    gemPitch = n - gemPitchT < 350 ? Math.min(gemPitch + 1, 24) : 0; gemPitchT = n;
    if (throttle('gem', 28)) tone(700 * Math.pow(2, gemPitch / 24), 0.06, 'triangle', 0.04);
  },
  coin() { tone(988, 0.06, 'square', 0.03); tone(1319, 0.12, 'square', 0.03, 0, 0.06); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.045, 0, i * 0.07)); },
  hurt() { if (throttle('hurt', 160)) tone(160, 0.14, 'sawtooth', 0.06, -90); },
  chest() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, 0, i * 0.09)); },
  zap() { if (throttle('zap', 60)) tone(1200, 0.12, 'sawtooth', 0.035, -1000); },
  boom() { tone(90, 0.4, 'sawtooth', 0.08, -60); },
  pick() { tone(660, 0.08, 'square', 0.04); tone(880, 0.1, 'square', 0.04, 0, 0.07); },
  boss() { [196, 185, 175, 165].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.05, 0, i * 0.22)); },
  click() { tone(440, 0.04, 'square', 0.03); },
};
function vibrate(ms) { if (save.vibe && navigator.vibrate && !SIM) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }

// ============================================================
// run state
// ============================================================
let run = null;
let st = {};
// online co-op hooks (filled in by net.js): event queue for the guest + game-loop callbacks
const NETQ = { on: false, ev: [] };
const NET = { ws: null, role: null, code: '', peer: null, inGame: false, snapT: 0, invT: 0, inT: 0, lastSnap: 0, hostRun: 0, hostHold: 0, emap: new Map(), pmap: new Map() };
function netEv(e) { if (NETQ.on && NETQ.ev.length < 600) NETQ.ev.push(e); }
const hooks = { holding: () => false, tick: () => {}, guest: null, holdText: () => '' };
const netHoldText = () => hooks.holdText();
const ENEMY_KEYS = Object.keys(ENEMIES), ENEMY_IDX = Object.fromEntries(ENEMY_KEYS.map((k, i) => [k, i]));
let eid = 0, pid = 0;

function xpFor(lv) {
  const m = run && run.players.length > 1 ? 1.25 : 1;
  if (lv < 20) return (5 + (lv - 1) * 10) * m;
  if (lv < 40) return (195 + (lv - 20) * 13) * m;
  return (455 + (lv - 40) * 20) * m;
}
function powerLv(id) { return save.power[id] || 0; }

// players: each has its own character, meta power-ups, weapons and passives.
// `use(p)` points the shared shortcuts (run.player, st, run.weapons, ...) at one player,
// so weapon / level-up code written for a single hero works for whoever is acting.
function use(p) {
  run.player = p; st = p.st;
  run.weapons = p.weapons; run.passives = p.passives; run.passiveOrder = p.passiveOrder; run.char = p.char;
}
const alive = p => !p.down && !p.gone;
function activePlayers() { return run.players.filter(p => !p.gone); }
function alivePlayers() { return run.players.filter(alive); }

function computeStats(p = run.player) {
  const b = p.char.bonus, pl = id => p.passives[id] || 0, pw = id => p.power[id] || 0;
  const old = p.st.maxHp;
  p.st = {
    might: 1 + pw('might') * 0.05 + pl('might') * 0.1 + (b.might || 0),
    armor: pw('armor') + pl('armor') + (b.armor || 0),
    maxHp: Math.round(p.char.hp * (1 + pl('maxhp') * 0.2) + pw('maxhp') * 10),
    recovery: pw('recovery') * 0.1 + pl('recovery') * 0.2 + (b.recovery || 0),
    cooldown: Math.max(0.4, 1 - pw('cooldown') * 0.025 - pl('cooldown') * 0.08 + (b.cooldown || 0)),
    area: 1 + pw('area') * 0.05 + pl('area') * 0.1 + (b.area || 0),
    speed: 1 + pw('speed') * 0.05 + pl('speed') * 0.1 + (b.speed || 0),
    duration: 1 + pw('duration') * 0.05 + pl('duration') * 0.1 + (b.duration || 0),
    amount: pw('amount') + pl('amount'),
    move: 72 * (1 + pw('move') * 0.05 + pl('move') * 0.1 + (b.move || 0)),
    magnet: 40 * (1 + pw('magnet') * 0.1 + pl('magnet') * 0.3),
    luck: 1 + pw('luck') * 0.1 + pl('luck') * 0.1 + (b.luck || 0),
    growth: 1 + pw('growth') * 0.03 + pl('growth') * 0.08,
    greed: 1 + pw('greed') * 0.1,
  };
  if (SIM && window.SIM_VAC) p.st.magnet = 3000;
  if (old && p.st.maxHp > old) p.hp += p.st.maxHp - old;
  p.hp = Math.min(p.hp, p.st.maxHp);
  if (run.player === p) st = p.st;
}

function makePlayer(idx, charId, power, ctrl) {
  const ch = CHARS.find(c => c.id === charId) || CHARS[0], pw = id => power[id] || 0;
  return {
    idx, char: ch, power, ctrl, x: idx * 26, y: 0, tx: idx * 26, ty: 0, hp: 1, r: 5, fx: 1, fy: 0, faceX: 1, moving: false, anim: 0, hurtT: 0, inv: 0,
    st: {}, weapons: [], passives: {}, passiveOrder: [], dmgBy: {}, evoHinted: {}, healCap: 0,
    pending: 0, rerolls: 1 + pw('reroll'), skips: pw('skip'), revivals: pw('revival'),
    down: false, downT: 0, revP: 0, gone: false, busy: null, vw: view.vw, vh: view.vh, auraR: 0, auraEvo: false,
  };
}
// list: [{ char, power, ctrl: 'local' | 'remote' | 'bot' }]
function newRun(list) {
  if (typeof list === 'string') list = [{ char: list, power: save.power, ctrl: 'local' }];
  eid = 0; pid = 0;
  run = {
    t: 0, kills: 0, gold: 0, level: 1, xp: 0, xpNext: 5,
    players: list.map((o, i) => makePlayer(i, o.char, o.power, o.ctrl)),
    enemies: [], projs: [], gems: [], pickups: [], props: [], parts: [], nums: [], fx: [], timers: [],
    spawnT: 0.5, eliteT: 90, propT: 2, evIdx: 0, freezeT: 0, flashT: 0, shake: 0, banner: null,
    cleared: false, reaperOn: false, reaperT: 0, bigGem: null, bossBar: null,
  };
  run.me = run.players.find(p => p.ctrl === 'local') || run.players[0];
  run.xpNext = xpFor(1);
  for (const p of run.players) {
    use(p);
    computeStats(p);
    p.hp = p.st.maxHp;
    addWeapon(p.char.weapon);
  }
  use(run.me);
}

function wstats(w) {
  const d = WEAPONS[w.id], s = Object.assign({}, d.base);
  const add = u => { for (const k in u) s[k] = (s[k] || 0) + u[k]; };
  for (let i = 0; i < w.lvl - 1; i++) add(d.levels[i]);
  if (w.evo) add(d.evo);
  return s;
}
function addWeapon(id) {
  const w = { id, lvl: 1, evo: false, t: 0.3, orbs: [] };
  w.s = wstats(w);
  run.weapons.push(w);
  return w;
}
function levelWeapon(w) {
  w.lvl = Math.min(MAX_WLV, w.lvl + 1);
  w.s = wstats(w);
  if (w.id === 'runes') resetOrbs(w);
}
function evolveWeapon(w) {
  w.evo = true; w.lvl = MAX_WLV;
  w.s = wstats(w);
  if (w.id === 'runes') resetOrbs(w);
}
function resetOrbs(w) { for (const o of w.orbs) o.dead = true; w.orbs = []; w.t = 0; }
function addPassive(id) {
  const R = run;
  if (!R.passives[id]) R.passiveOrder.push(id);
  R.passives[id] = (R.passives[id] || 0) + 1;
  computeStats();
}
function weaponName(w) { return w.evo ? WEAPONS[w.id].evoName : WEAPONS[w.id].name; }
function evoReady(w) { return !w.evo && w.lvl >= MAX_WLV && run.passives[WEAPONS[w.id].evoWith] > 0; }

// ============================================================
// spatial grid
// ============================================================
const CELL = 32;
const grid = new Map();
const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
function gridBuild() {
  grid.clear();
  for (const e of run.enemies) {
    if (e.dead) continue;
    const k = gkey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(e);
  }
}
// calls fn(e) for enemies in cells overlapping the circle; stop when fn returns true
function forNear(x, y, r, fn) {
  const x0 = Math.floor((x - r - 8) / CELL), x1 = Math.floor((x + r + 8) / CELL);
  const y0 = Math.floor((y - r - 8) / CELL), y1 = Math.floor((y + r + 8) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = grid.get(gkey(cx, cy));
    if (!a) continue;
    for (let i = 0; i < a.length; i++) { const e = a[i]; if (!e.dead && fn(e)) return; }
  }
}
function nearestEnemy(x, y, maxR) {
  let best = null, bd = maxR * maxR;
  for (const e of run.enemies) {
    if (e.dead || e.type === 'reaper') continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function onScreen(e, pad = 0, P = run.player) {
  return Math.abs(e.x - P.x) < P.vw / 2 - pad && Math.abs(e.y - P.y) < P.vh / 2 - pad;
}
function randomVisibleEnemy() {
  const list = [];
  for (const e of run.enemies) if (!e.dead && e.type !== 'reaper' && onScreen(e, 4)) list.push(e);
  return list.length ? pick(list) : null;
}
function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const p of run.players) {
    if (!alive(p)) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function randomAlive() { const a = alivePlayers(); return a.length ? pick(a) : run.me; }

// ============================================================
// spawning
// ============================================================
// co-op scaling: more players → more and tougher enemies
function coopN() { return run.players.length > 1 ? activePlayers().length : 1; }
function spawnPos(P = randomAlive()) {
  const hw = P.vw / 2 + 16, hh = P.vh / 2 + 16;
  if (Math.random() * (hw + hh) < hw) return [P.x + rand(-hw, hw), P.y + (Math.random() < 0.5 ? -hh : hh)];
  return [P.x + (Math.random() < 0.5 ? -hw : hw), P.y + rand(-hh, hh)];
}
function spawnEnemy(type, o = {}) {
  const T = ENEMIES[type], m = run.t / 60, n = coopN();
  const hpMul = (1 + m * 0.08 + Math.max(0, m - 12) * 0.05) * (1 + (n - 1) * 0.3);
  const pos = o.pos || spawnPos(o.near);
  const e = {
    id: ++eid, type, x: pos[0], y: pos[1], r: T.r, xp: T.xp, kbRes: T.kb,
    hp: T.hp * hpMul, dmg: T.dmg * (1 + m * 0.03), spd: T.spd * rand(0.9, 1.08),
    sc: 1, flash: 0, kbx: 0, kby: 0, atkT: 0, anim: Math.random() * 2, cd: null,
    spr: SPR[T.spr], alpha: T.alpha || 1, dead: false,
  };
  if (o.elite) { e.elite = true; e.hp *= 14; e.sc = 2; e.r *= 1.8; e.kbRes *= 0.15; e.xp *= 10; e.dmg *= 1.4; e.spd *= 1.05; }
  if (o.boss) {
    let wn = 0;
    for (const p of activePlayers()) wn += p.weapons.length;
    wn /= activePlayers().length;
    e.boss = true; e.hp = o.hp * (0.85 + 0.15 * wn / 3) * (1 + (n - 1) * 0.6); e.sc = 3; e.r *= 2.6; e.kbRes = 0; e.xp = 100; e.dmg *= 2; e.name = o.name; e.spd *= 1.1;
  }
  if (type === 'reaper') { e.sc = 1.5; e.dmg = 999; e.kbRes = 0; }
  e.maxHp = e.hp;
  run.enemies.push(e);
  return e;
}
function spawning(dt) {
  const R = run, n = coopN();
  if (R.reaperOn) {
    R.reaperT -= dt;
    if (R.reaperT <= 0) { R.reaperT = 30; for (const p of alivePlayers()) spawnEnemy('reaper', { near: p }); }
    return;
  }
  const W = WAVES[Math.min(WAVES.length - 1, (R.t / 60) | 0)];
  const cap = MAX_ENEMIES + (n - 1) * 100;
  R.spawnT -= dt;
  if (R.spawnT <= 0) {
    R.spawnT = W.iv;
    let al = 0;
    for (const e of R.enemies) if (!e.dead && !e.line && !e.ring) al++;
    const min = Math.round(W.min * (1 + (n - 1) * 0.6));
    let k = Math.round(W.batch * (1 + (n - 1) * 0.6));
    if (al < min) k += Math.min(min - al, 24 * n);
    k = Math.min(k, cap - R.enemies.length);
    for (let i = 0; i < k; i++) spawnEnemy(pick(W.types));
  }
  R.eliteT -= dt;
  if (R.eliteT <= 0) {
    R.eliteT = 60;
    for (const p of alivePlayers()) spawnEnemy(W.types[W.types.length - 1], { elite: true, near: p });
  }
}
function triggerEvent(ev) {
  const R = run;
  if (ev.type === 'swarm') {
    const P = randomAlive();
    const a = rand(0, TAU), dist = Math.max(P.vw, P.vh) / 2 + 50;
    const cx = P.x + Math.cos(a) * dist, cy = P.y + Math.sin(a) * dist;
    const dx = -Math.cos(a), dy = -Math.sin(a);
    const cnt = Math.round(ev.n * (1 + (coopN() - 1) * 0.5));
    for (let i = 0; i < cnt; i++) {
      const off = rand(-70, 70), back = rand(0, 120);
      const e = spawnEnemy(ev.enemy, { pos: [cx - dy * off - dx * back, cy + dx * off - dy * back] });
      e.line = true; e.dx = dx; e.dy = dy; e.spd = ENEMIES[ev.enemy].spd * 1.35; e.life = 16;
    }
    banner(ev.text);
  } else if (ev.type === 'ring') {
    for (const P of alivePlayers()) {
      const rad = Math.min(P.vw, P.vh) * 0.48 + 20;
      for (let i = 0; i < ev.n; i++) {
        const a = i / ev.n * TAU;
        const e = spawnEnemy(ev.enemy, { pos: [P.x + Math.cos(a) * rad, P.y + Math.sin(a) * rad] });
        e.ring = true; e.life = 40;
      }
    }
    banner(ev.text);
  } else if (ev.type === 'boss') {
    const b = spawnEnemy(ev.enemy, { boss: true, hp: ev.hp, name: ev.name });
    R.bossBar = b;
    banner('⚠ ' + ev.name + ' 등장!', '#ff6070');
    sfx.boss(); vibrate(200);
  } else if (ev.type === 'reaper') {
    R.cleared = true; R.reaperOn = true; R.reaperT = 4;
    for (const e of R.enemies) { e.dead = true; e.silent = true; }
    R.flashT = 0.5;
    banner('20분 생존 성공! 사신이 깨어났다…', '#ffd040', 5);
    sfx.boss();
  }
}
// global banner (everyone sees it) / personal banner (only the acting player)
function banner(text, color = '#fff0c0', dur = 3) { run.banner = { text, color, t: dur, dur }; netEv(['b', text, color, dur]); }
function pbanner(text, color = '#fff0c0', dur = 3) { bannerTo(run.player, text, color, dur); }
function bannerTo(P, text, color = '#fff0c0', dur = 3) {
  if (P === run.me) run.banner = { text, color, t: dur, dur };
  else if (P.ctrl === 'remote') netEv(['b', text, color, dur]);
}

// ============================================================
// damage / drops
// ============================================================
function addNum(x, y, v, crit) {
  netEv(['n', Math.round(x), Math.round(y), Math.round(v), crit ? 1 : 0]);
  if (!save.nums || SIM) return;
  const N = run.nums;
  if (N.length > 90) N.shift();
  N.push({ x: x + rand(-3, 3), y, v: Math.round(v), t: 0, crit });
}
function hitEnemy(e, dmg, wid, kx, ky, kb, crit) {
  if (e.dead) return;
  const R = run, P = R.player;
  P.dmgBy[wid] = (P.dmgBy[wid] || 0) + Math.min(dmg, Math.max(0, e.hp));
  e.hp -= dmg; e.flash = 0.1;
  if (kb && e.kbRes) { const f = kb * e.kbRes * 110; e.kbx += kx * f; e.kby += ky * f; }
  addNum(e.x, e.y - e.spr[0].h * e.sc / 2, dmg, crit);
  sfx.hit();
  if (wid === 'blade' && R.weapons.find(w => w.id === 'blade' && w.evo)) healPlayer(0.4);
  if (wid === 'aura' && R.weapons.find(w => w.id === 'aura' && w.evo)) healPlayer(0.25);
  if (e.hp <= 0) killEnemy(e);
}
function healPlayer(v) {
  const P = run.player;
  if (P.healCap <= 0 || !alive(P)) return;
  const amt = Math.min(v, P.healCap);
  P.healCap -= amt;
  P.hp = Math.min(st.maxHp, P.hp + amt);
}
function killEnemy(e) {
  const R = run;
  e.dead = true;
  R.kills++;
  dropGem(e.x, e.y, e.xp);
  if (Math.random() < 0.012 * st.luck) R.pickups.push({ type: 'coin', x: e.x + 4, y: e.y, v: 1 });
  if (e.elite || e.boss) R.pickups.push({ type: 'chest', x: e.x, y: e.y, boss: !!e.boss });
  if (e.boss) { R.bossBar = null; R.flashT = 0.25; sfx.boom(); }
  killParts(e.x, e.y, e.type, e.boss, e.elite);
  netEv(['k', Math.round(e.x), Math.round(e.y), ENEMY_IDX[e.type], e.boss ? 2 : e.elite ? 1 : 0]);
}
function killParts(x, y, type, boss, elite) {
  const R = run;
  const col = type === 'slime' ? '#4ccf5a' : type === 'ghost' ? '#e8f0ff' : '#c02838';
  const n = boss ? 24 : elite ? 12 : 4;
  for (let i = 0; i < n && R.parts.length < 400; i++) {
    const a = rand(0, TAU), s = rand(20, 70);
    R.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: rand(0.25, 0.5), c: Math.random() < 0.5 ? col : '#ffffff', sz: boss ? 2 : 1 });
  }
}
function dropGem(x, y, v) {
  const R = run;
  if (v <= 0) return;
  if (R.gems.length >= 320) {
    if (!R.bigGem || R.bigGem.dead) { R.bigGem = { x, y, v: 0, to: null, sp: 0 }; R.gems.push(R.bigGem); }
    R.bigGem.v += v;
    return;
  }
  R.gems.push({ x: x + rand(-2, 2), y: y + rand(-2, 2), v, to: null, sp: 0 });
}
function hitProps(x, y, r) {
  for (const p of run.props) {
    if (p.dead) continue;
    const dx = p.x - x, dy = p.y - y, rr = r + 5;
    if (dx * dx + dy * dy < rr * rr) breakProp(p);
  }
}
function breakProp(p) {
  const R = run;
  p.dead = true;
  const r = Math.random(), L = st.luck;
  let type = 'coin', v = 10;
  if (r < 0.28) type = 'chicken';
  else if (r < 0.28 + 0.1 * L) type = 'magnet';
  else if (r < 0.38 + 0.16 * L) { type = 'bag'; v = 25; }
  else if (r < 0.38 + 0.22 * L) type = 'bomb';
  else if (r < 0.38 + 0.28 * L) type = 'ice';
  R.pickups.push({ type, x: p.x, y: p.y, v });
  for (let i = 0; i < 8; i++) R.parts.push({ x: p.x, y: p.y - 6, vx: rand(-40, 40), vy: rand(-70, -10), t: 0, life: 0.4, c: pick(['#ffb040', '#ff6020', '#ffe080']), sz: 1 });
}

// ============================================================
// player
// ============================================================
function hurtPlayer(d, src) {
  const R = run, P = R.player;
  if (P.inv > 0 || P.hp <= 0 || !alive(P)) return;
  d = Math.max(1, d - st.armor);
  if (SIM) { run.taken = (run.taken || 0) + d; const k = src ? src.type + (src.boss ? '!' : src.elite ? '+' : src.line ? '~' : src.ring ? 'o' : '') : '?'; (run.takenBy || (run.takenBy = {}))[k] = (run.takenBy[k] || 0) + d; if (window.SIM_GOD) return; }
  P.hp -= d; P.hurtT = 0.15;
  sfx.hurt();
  if (P === R.me) { R.shake = Math.min(R.shake + 1.5, 4); vibrate(25); }
}
// XP is shared: every player levels up together and picks their own upgrade
function addXp(v) {
  const R = run;
  R.xp += v * st.growth;
  while (R.xp >= R.xpNext) {
    R.xp -= R.xpNext;
    R.level++;
    R.xpNext = xpFor(R.level);
    for (const p of R.players) if (!p.gone) p.pending++;
  }
}
function collectPickup(p) {
  const R = run, P = R.player;
  switch (p.type) {
    case 'coin': case 'bag': R.gold += p.v; sfx.coin(); break;
    case 'chicken': P.hp = Math.min(st.maxHp, P.hp + 30); sfx.pick(); break;
    case 'magnet': for (const g of R.gems) g.to = P; sfx.pick(); break;
    case 'bomb': {
      R.flashT = 0.35; sfx.boom(); vibrate(80);
      for (const e of R.enemies) if (!e.dead && onScreen(e, -10)) {
        if (e.boss || e.type === 'reaper') hitEnemy(e, 300, 'bomb', 0, 0, 0); else killEnemy(e);
      }
      break;
    }
    case 'ice': R.freezeT = 8; sfx.pick(); banner('적들이 얼어붙었다!', '#90e0ff', 1.6); break;
    case 'chest': openChest(p.boss); break;
  }
}

// ============================================================
// weapons
// ============================================================
function addFx(f) { run.fx.push(f); netEv(['f', f]); }
function later(d, fn) { run.timers.push({ t: run.t + d, fn, p: run.player }); }
function proj(o) {
  const p = Object.assign({ id: ++pid & 0xffff, own: run.player, x: run.player.x, y: run.player.y, vx: 0, vy: 0, r: 4, pierce: 1, life: 2, rot: 0, spin: 0, rehit: 0, kb: 0.5, crit: 0, dead: false }, o);
  if (!p.rehit) p.hit = new Set();
  run.projs.push(p);
  return p;
}
function updateWeapon(w, dt) {
  const R = run, P = R.player, s = w.s;
  const dmg = s.dmg * st.might;
  const amount = (s.amount || 0) + st.amount;
  if (w.id === 'aura') {
    const rad = 28 * s.area * st.area;
    w.rad = rad; P.auraR = rad; P.auraEvo = w.evo;
    forNear(P.x, P.y, rad, e => {
      const dx = e.x - P.x, dy = e.y - P.y, rr = rad + e.r;
      if (dx * dx + dy * dy > rr * rr) return;
      if (e.cd && e.cd.aura > R.t) return;
      (e.cd || (e.cd = {})).aura = R.t + s.cd * st.cooldown;
      const d = Math.hypot(dx, dy) || 1;
      hitEnemy(e, dmg, 'aura', dx / d, dy / d, 0.6);
    });
    hitProps(P.x, P.y, rad);
    return;
  }
  if (w.id === 'runes') {
    w.orbs = w.orbs.filter(o => !o.dead);
    if (w.orbs.length) return;
    w.t -= dt;
    if (w.t > 0) return;
    const life = w.evo ? 1e9 : s.dur * st.duration;
    for (let i = 0; i < amount; i++) {
      w.orbs.push(proj({ kind: 'orb', wid: 'runes', ang: i / amount * TAU, rad: 38 * s.area * st.area, as: 3.2 * s.speed * st.speed, r: 6 * Math.sqrt(st.area), dmg, pierce: 1e9, rehit: 0.6, key: 'runes', life, kb: 0.8, evo: w.evo }));
    }
    w.t = s.cd * st.cooldown;
    return;
  }
  w.t -= dt;
  if (w.t > 0) return;
  w.t = s.cd * st.cooldown;
  switch (w.id) {
    case 'blade': {
      for (let i = 0; i < amount; i++) {
        later(i * 0.12, () => {
          const side = i % 2 === 0 ? P.faceX : -P.faceX;
          const yo = -Math.floor(i / 2) * 10;
          const area = s.area * st.area, bw = (w.evo ? 86 : 66) * area, bh = (w.evo ? 26 : 18) * area;
          const cx = run.player.x + side * (bw / 2 + 3), cy = run.player.y - 2 + yo;
          forNear(cx, cy, bw / 2, e => {
            if (Math.abs(e.x - cx) > bw / 2 + e.r || Math.abs(e.y - cy) > bh / 2 + e.r) return;
            const crit = w.evo && Math.random() < 0.2;
            hitEnemy(e, crit ? dmg * 2 : dmg, 'blade', side, 0, 0.7, crit);
          });
          hitProps(cx, cy, bw / 2);
          addFx({ kind: 'slash', x: cx, y: cy, w: bw, h: bh, side, t: 0, life: 0.22, evo: w.evo });
        });
      }
      break;
    }
    case 'bolt': {
      const n = amount;
      for (let i = 0; i < n; i++) {
        later(i * (w.evo ? 0.05 : 0.1), () => {
          const t = nearestEnemy(run.player.x, run.player.y, 320);
          const a = t ? Math.atan2(t.y - run.player.y, t.x - run.player.x) + rand(-0.06, 0.06) : rand(0, TAU);
          const sp = s.speed * st.speed;
          proj({ kind: 'bolt', wid: 'bolt', x: run.player.x, y: run.player.y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3.5 * Math.sqrt(st.area), dmg, pierce: s.pierce, life: 2.2, kb: 0.4, evo: w.evo });
        });
      }
      break;
    }
    case 'dagger': {
      for (let i = 0; i < amount; i++) {
        later(i * 0.06, () => {
          const fx = run.player.fx, fy = run.player.fy;
          const off = ((i % 3) - 1) * 4;
          const sp = s.speed * st.speed;
          proj({ kind: 'dagger', wid: 'dagger', x: run.player.x - fy * off, y: run.player.y + fx * off, vx: fx * sp, vy: fy * sp, rot: Math.atan2(fy, fx), r: 3.5, dmg, pierce: s.pierce, life: 1.1, kb: 0.3, evo: w.evo });
        });
      }
      break;
    }
    case 'axe': {
      const area = s.area * st.area;
      if (w.evo) {
        const n = 8 + amount;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU, sp = 120 * st.speed;
          proj({ kind: 'scythe', wid: 'axe', vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: 14, r: 9 * area, sc: area, dmg, pierce: 1e9, life: 2.4 * st.duration, kb: 0.6 });
        }
      } else {
        for (let i = 0; i < amount; i++) {
          later(i * 0.12, () => {
            const sp = st.speed;
            const dir = i === 0 ? rand(-1, 1) : (i % 2 ? -1 : 1) * rand(0.6, 1.4);
            proj({ kind: 'axe', wid: 'axe', vx: dir * 40 * sp, vy: -230 * sp, g: 420 * sp, spin: 12 * (dir < 0 ? -1 : 1), r: 6 * area, sc: area, dmg, pierce: s.pierce, life: 3, kb: 0.5 });
          });
        }
      }
      break;
    }
    case 'thunder': {
      const area = s.area * st.area;
      for (let i = 0; i < amount; i++) {
        later(i * 0.12, () => {
          const e = randomVisibleEnemy();
          if (!e) return;
          const strike = (x, y, rad, d) => {
            forNear(x, y, rad, t => {
              const dx = t.x - x, dy = t.y - y, rr = rad + t.r;
              if (dx * dx + dy * dy < rr * rr) hitEnemy(t, d, 'thunder', 0, 0, 0);
            });
            hitProps(x, y, rad);
            addFx({ kind: 'bolt', x, y, r: rad, t: 0, life: 0.28, evo: w.evo });
            sfx.zap();
          };
          const ex = e.x, ey = e.y;
          strike(ex, ey, (w.evo ? 22 : 12) * area, dmg);
          if (w.evo) later(0.18, () => strike(ex, ey, 26 * area, dmg));
        });
      }
      break;
    }
    case 'flask': {
      const area = s.area * st.area;
      for (let i = 0; i < amount; i++) {
        later(i * 0.1, () => {
          const e = randomVisibleEnemy();
          const P2 = run.player;
          const tx = e ? e.x + rand(-10, 10) : P2.x + rand(-80, 80), ty = e ? e.y + rand(-10, 10) : P2.y + rand(-80, 80);
          proj({ kind: 'flask', wid: 'flask', noHit: true, sx: P2.x, sy: P2.y, tx, ty, ft: 0, fdur: 0.45, life: 1, onLand: p => {
            proj({ kind: 'pool', wid: 'flask', ground: true, x: p.tx, y: p.ty, r: (w.evo ? 30 : 20) * area, dmg, pierce: 1e9, rehit: 0.6, key: 'flask', life: s.dur * st.duration, chase: w.evo, kb: 0, evo: w.evo });
          } });
        });
      }
      break;
    }
    case 'cross': {
      const area = s.area * st.area;
      for (let i = 0; i < amount; i++) {
        later(i * 0.12, () => {
          const P2 = run.player;
          const t = nearestEnemy(P2.x, P2.y, 300);
          const a = t ? Math.atan2(t.y - P2.y, t.x - P2.x) + (i ? rand(-0.3, 0.3) : 0) : rand(0, TAU);
          const sp = 220 * s.speed * st.speed;
          proj({ kind: 'cross', wid: 'cross', dx: Math.cos(a), dy: Math.sin(a), v: sp, dec: sp * 1.4, spin: 12, r: 7 * area, sc: area * (w.evo ? 1.3 : 1), dmg, pierce: 1e9, rehit: 0.35, key: 'cross', life: 3, kb: 0.4, crit: w.evo ? 0.25 : 0 });
        });
      }
      break;
    }
  }
}
function updateProjs(dt) {
  const R = run;
  for (const p of R.projs) {
    if (p.dead) continue;
    const P = p.own;
    if (!alive(P) && (p.kind === 'orb' || P.gone)) { p.dead = true; continue; }
    use(P);
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; continue; }
    switch (p.kind) {
      case 'axe': p.vy += p.g * dt; // fall through
      case 'bolt': case 'dagger': case 'scythe':
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; break;
      case 'orb':
        p.ang += p.as * dt;
        p.x = P.x + Math.cos(p.ang) * p.rad; p.y = P.y + Math.sin(p.ang) * p.rad;
        break;
      case 'cross':
        p.v -= p.dec * dt;
        p.x += p.dx * p.v * dt; p.y += p.dy * p.v * dt; p.rot += p.spin * dt;
        break;
      case 'flask': {
        p.ft += dt;
        const k = Math.min(1, p.ft / p.fdur);
        p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 30;
        p.rot += 10 * dt;
        if (k >= 1) { p.dead = true; p.onLand(p); }
        continue;
      }
      case 'pool':
        if (p.chase) {
          const t = nearestEnemy(p.x, p.y, 200);
          if (t) { const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1; p.x += dx / d * 30 * dt; p.y += dy / d * 30 * dt; }
        }
        break;
    }
    if (p.noHit) continue;
    projHits(p);
  }
}
function projHits(p) {
  const R = run;
  forNear(p.x, p.y, p.r, e => {
    const dx = e.x - p.x, dy = e.y - p.y, rr = p.r + e.r;
    if (dx * dx + dy * dy > rr * rr) return false;
    if (p.rehit) {
      if (e.cd && e.cd[p.key] > R.t) return false;
      (e.cd || (e.cd = {}))[p.key] = R.t + p.rehit;
    } else {
      if (p.hit.has(e.id)) return false;
      p.hit.add(e.id);
    }
    const crit = p.crit && Math.random() < p.crit;
    const d = Math.hypot(dx, dy) || 1;
    hitEnemy(e, crit ? p.dmg * 2.5 : p.dmg, p.wid, dx / d, dy / d, p.kb, crit);
    if (--p.pierce <= 0) { p.dead = true; return true; }
    return false;
  });
  if (!p.dead) hitProps(p.x, p.y, p.r);
}

// ============================================================
// update
// ============================================================
const input = { keys: {}, active: false, id: null, ox: 0, oy: 0, cx: 0, cy: 0, jx: 0, jy: 0, bot: null };
function moveVec() {
  if (input.bot) return input.bot;
  let x = 0, y = 0;
  const k = input.keys;
  if (k.ArrowLeft || k.KeyA) x -= 1;
  if (k.ArrowRight || k.KeyD) x += 1;
  if (k.ArrowUp || k.KeyW) y -= 1;
  if (k.ArrowDown || k.KeyS) y += 1;
  if (input.active) { x += input.jx; y += input.jy; }
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return [x, y];
}
function steer(P, mx, my, dt) {
  const ml = Math.hypot(mx, my);
  P.moving = ml > 0.05;
  if (P.moving) {
    P.x += mx * P.st.move * dt; P.y += my * P.st.move * dt;
    P.fx = mx / ml; P.fy = my / ml;
    if (Math.abs(mx) > 0.1) P.faceX = mx > 0 ? 1 : -1;
    P.anim += dt;
  }
}

const REVIVE_NEAR = 2.5, REVIVE_AUTO = 20;
function updatePlayer(P, dt) {
  if (P.gone) return;
  if (P.down) {
    P.moving = false;
    P.downT += dt;
    let helper = false;
    for (const q of run.players) if (q !== P && alive(q) && (q.x - P.x) ** 2 + (q.y - P.y) ** 2 < 24 * 24) helper = true;
    P.revP = helper ? P.revP + dt : Math.max(0, P.revP - dt * 0.5);
    if (P.revP >= REVIVE_NEAR || P.downT >= REVIVE_AUTO) revive(P, 0.5);
    return;
  }
  if (P.ctrl === 'remote') {
    // the guest owns its position; ease toward the last reported spot
    const k = Math.min(1, dt * 20);
    P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
    if (P.moving) P.anim += dt;
  }
  else if (P.ctrl === 'bot') steer(P, P.bot[0], P.bot[1], dt);
  else { const [mx, my] = moveVec(); steer(P, mx, my, dt); }
  if (P.hurtT > 0) P.hurtT -= dt;
  if (P.inv > 0) P.inv -= dt;
  P.healCap = Math.min(P.healCap + dt * 4, 4);
  P.hp = Math.min(P.st.maxHp, P.hp + P.st.recovery * dt);
}
function revive(P, frac) {
  P.down = false; P.revP = 0; P.downT = 0;
  P.hp = P.st.maxHp * frac; P.inv = 2.5;
  for (const e of run.enemies) if (!e.boss && e.type !== 'reaper' && onScreen(e, -20, P)) killEnemy(e);
  banner(run.players.length > 1 ? `${P.idx + 1}P 부활!` : '부활!', '#ffd040', 2);
  if (P === run.me) run.flashT = 0.5;
  sfx.level();
}

function update(dt) {
  const R = run;
  R.t += dt;
  R.me.vw = view.vw; R.me.vh = view.vh;
  while (R.evIdx < EVENTS.length && R.t >= EVENTS[R.evIdx].t) triggerEvent(EVENTS[R.evIdx++]);

  // timers
  if (R.timers.length) {
    const due = [];
    R.timers = R.timers.filter(t => (t.t <= R.t ? (due.push(t), false) : true));
    for (const t of due) if (alive(t.p)) { use(t.p); t.fn(); }
  }

  for (const P of R.players) { use(P); updatePlayer(P, dt); }
  if (R.freezeT > 0) R.freezeT -= dt;
  if (R.flashT > 0) R.flashT -= dt;
  R.shake = Math.max(0, R.shake - dt * 12);
  if (R.banner && (R.banner.t -= dt) <= 0) R.banner = null;

  spawning(dt);
  updateEnemies(dt);
  gridBuild();
  separate();
  for (const P of R.players) {
    if (!alive(P)) continue;
    use(P);
    for (const w of P.weapons) updateWeapon(w, dt);
  }
  updateProjs(dt);

  // contact damage
  for (const P of R.players) {
    if (!alive(P)) continue;
    use(P);
    forNear(P.x, P.y, 24, e => {
      const dx = e.x - P.x, dy = e.y - P.y, rr = e.r * (e.sc > 1 ? 0.9 : 1) + P.r - 1;
      if (dx * dx + dy * dy > rr * rr || e.atkT > R.t) return;
      e.atkT = R.t + (e.type === 'reaper' ? 0.1 : 0.5);
      hurtPlayer(e.dmg, e);
    });
  }

  updatePickups(dt);
  updateProps(dt);

  // particles, numbers, effects
  for (const p of R.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
  R.parts = R.parts.filter(p => p.t < p.life);
  for (const n of R.nums) n.t += dt;
  R.nums = R.nums.filter(n => n.t < 0.6);
  for (const f of R.fx) f.t += dt;
  R.fx = R.fx.filter(f => f.t < f.life);

  // cleanup
  R.enemies = R.enemies.filter(e => !e.dead);
  R.projs = R.projs.filter(p => !p.dead);

  // knocked out → use a revival, or go down and wait for a teammate
  for (const P of R.players) {
    if (!alive(P) || P.hp > 0) continue;
    use(P);
    if (P.revivals > 0) { P.revivals--; revive(P, 0.5); continue; }
    P.down = true; P.hp = 0; P.downT = 0; P.revP = 0;
    for (const Q of alivePlayers()) bannerTo(Q, `${P.idx + 1}P 쓰러짐! 곁에 서서 일으켜 주세요`, '#ff8090', 3);
  }
  use(R.me);
  if (!alivePlayers().length) { gameOver(); return; }
  if (R.me.pending > 0 && !R.cleared && state === 'play') openLevelUp();
}

function updateEnemies(dt) {
  const R = run, frozen = R.freezeT > 0;
  for (const e of R.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    const P = nearestPlayer(e.x, e.y) || R.me;
    let vx = 0, vy = 0;
    if (e.line) {
      e.life -= dt;
      if (e.life <= 0) { e.dead = true; continue; }
      vx = e.dx * e.spd; vy = e.dy * e.spd;
      e.anim += dt;
    } else if (!frozen || e.type === 'reaper') {
      if (e.ring && (e.life -= dt) <= 0) { e.dead = true; continue; }
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      vx = dx / d * e.spd; vy = dy / d * e.spd;
      e.anim += dt;
    }
    e.x += (vx + e.kbx) * dt; e.y += (vy + e.kby) * dt;
    const k = Math.exp(-8 * dt);
    e.kbx *= k; e.kby *= k;
    if (!e.boss && !e.line && !e.ring && e.type !== 'reaper' && (Math.abs(e.x - P.x) > P.vw / 2 + 140 || Math.abs(e.y - P.y) > P.vh / 2 + 140)) {
      const pos = spawnPos(P); e.x = pos[0]; e.y = pos[1];
    }
  }
}
function separate() {
  for (const a of grid.values()) {
    const n = Math.min(a.length, 14);
    for (let i = 0; i < n; i++) {
      const A = a[i];
      for (let j = i + 1; j < n; j++) {
        const B = a[j], dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 0.0001) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.3, nx = dx / d, ny = dy / d;
        const wa = A.boss ? 0.1 : 1, wb = B.boss ? 0.1 : 1;
        A.x -= nx * push * wa; A.y -= ny * push * wa;
        B.x += nx * push * wb; B.y += ny * push * wb;
      }
    }
  }
}
function updatePickups(dt) {
  const R = run, pls = alivePlayers();
  for (let i = R.gems.length - 1; i >= 0; i--) {
    const g = R.gems[i];
    if (g.to && !alive(g.to)) g.to = null;
    let got = null;
    for (const P of pls) {
      const dx = P.x - g.x, dy = P.y - g.y, d2 = dx * dx + dy * dy;
      if (d2 < (P.r + 5) ** 2) { got = P; break; }
      if (!g.to && d2 < P.st.magnet ** 2) g.to = P;
    }
    if (got) {
      use(got);
      addXp(g.v); sfx.gem(); g.dead = true;
      R.gems[i] = R.gems[R.gems.length - 1]; R.gems.pop();
      continue;
    }
    if (g.to) {
      const dx = g.to.x - g.x, dy = g.to.y - g.y, d = Math.hypot(dx, dy) || 1;
      g.sp = Math.min(g.sp + 520 * dt, 420);
      const step = Math.min(d, g.sp * dt);
      g.x += dx / d * step; g.y += dy / d * step;
    }
  }
  for (const p of R.pickups) {
    for (const P of pls) {
      const dx = P.x - p.x, dy = P.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 < (P.r + 7) ** 2) { p.dead = true; use(P); collectPickup(p); break; }
      if ((p.type === 'coin' || p.type === 'bag') && d2 < P.st.magnet ** 2) {
        const d = Math.sqrt(d2); p.x += dx / d * 160 * dt; p.y += dy / d * 160 * dt;
        break;
      }
    }
  }
  R.pickups = R.pickups.filter(p => !p.dead);
  use(R.me);
}
function updateProps(dt) {
  const R = run, pls = alivePlayers();
  R.props = R.props.filter(p => !p.dead && pls.some(P => Math.abs(p.x - P.x) < 700 && Math.abs(p.y - P.y) < 700));
  R.propT -= dt;
  if (R.propT <= 0) {
    R.propT = 7;
    if (R.props.length < 4 * pls.length) {
      const P = randomAlive(), a = rand(0, TAU), d = rand(120, 260);
      R.props.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, dead: false, ph: rand(0, 6) });
    }
  }
}

// ============================================================
// rendering
// ============================================================
let camX = 0, camY = 0, frameT = 0;
function drawSpr(spr, x, y, sc = 1, flip = false, tint = '') {
  const S = view.S;
  const img = flip || tint ? variant(spr, tint + (flip ? 'f' : '')) : spr.c;
  const w = spr.w * sc, h = spr.h * sc;
  ctx.drawImage(img, Math.round((x - w / 2) * S) / S, Math.round((y - h / 2) * S) / S, w, h);
}
function shadow(x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.35, 0, 0, TAU); ctx.fill();
}
function render(dt) {
  frameT += dt;
  const S = view.S, R = run;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (!R) { renderIdle(); return; }
  const P = R.me;
  const sh = R.shake;
  camX = P.x - view.vw / 2 + (sh ? rand(-sh, sh) : 0);
  camY = P.y - view.vh / 2 + (sh ? rand(-sh, sh) : 0);
  const ox = Math.round(-camX * S), oy = Math.round(-camY * S);
  ctx.setTransform(S, 0, 0, S, ox, oy);
  drawGround(camX, camY);

  // ground layer: pools, aura
  for (const p of R.projs) if (p.ground) drawProj(p);
  for (const Q of R.players) if (Q.auraR && alive(Q)) {
    const pulse = 1 + Math.sin(frameT * 6) * 0.03;
    ctx.fillStyle = Q.auraEvo ? 'rgba(255,80,140,0.13)' : 'rgba(255,236,150,0.12)';
    ctx.beginPath(); ctx.arc(Q.x, Q.y, Q.auraR * pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = Q.auraEvo ? 'rgba(255,90,150,0.45)' : 'rgba(255,240,170,0.4)';
    ctx.lineWidth = 1; ctx.stroke();
  }
  // props
  for (const p of R.props) {
    shadow(p.x, p.y + 5, 5);
    drawSpr(ITEM.brazier, p.x, p.y);
    const f = Math.sin(frameT * 14 + p.ph);
    ctx.fillStyle = '#ff7020'; ctx.fillRect(p.x - 3, p.y - 9 - (f > 0 ? 1 : 0), 6, 4);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(p.x - 2, p.y - 11 + (f > 0.3 ? 1 : 0), 4, 4);
    ctx.fillStyle = '#fff6c0'; ctx.fillRect(p.x - 1, p.y - 9, 2, 2);
  }
  // gems & pickups
  for (const g of R.gems) {
    const spr = ITEM.gem[g.v >= 20 ? 2 : g.v >= 5 ? 1 : 0];
    drawSpr(spr, g.x, g.y, g.v >= 100 ? 1.5 : 1);
  }
  for (const p of R.pickups) {
    const spr = ITEM[p.type];
    const bob = p.type === 'chest' ? 0 : Math.sin(frameT * 4 + p.x) * 1;
    shadow(p.x, p.y + spr.h / 2, spr.w / 2.5);
    drawSpr(spr, p.x, p.y + bob);
    if (p.type === 'chest' && Math.sin(frameT * 8) > 0) { ctx.fillStyle = 'rgba(255,230,120,0.25)'; ctx.fillRect(p.x - 7, p.y - 6, 14, 12); }
  }
  // enemies
  R.enemies.sort((a, b) => a.y - b.y);
  const frozen = R.freezeT > 0;
  for (const e of R.enemies) {
    const sp = e.spr, fr = sp[sp.length > 1 ? ((e.anim * (e.type === 'bat' ? 8 : 5)) | 0) % sp.length : 0];
    const tgt = e.line ? null : nearestPlayer(e.x, e.y) || P;
    const flip = e.line ? e.dx < 0 : tgt.x < e.x;
    const bob = sp.length === 1 && e.type !== 'flower' ? Math.round(Math.sin(e.anim * 8) * 0.6) : 0;
    const h = fr.h * e.sc;
    if (e.type !== 'bat' && e.type !== 'ghost') shadow(e.x, e.y + h / 2, fr.w * e.sc / 3);
    if (e.alpha < 1) ctx.globalAlpha = e.alpha;
    if (e.elite || e.boss) {
      // glowing outline
      const tint = e.boss ? 'R' : 'R';
      ctx.globalAlpha = 0.6 + Math.sin(frameT * 8) * 0.2;
      for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawSpr(fr, e.x + ddx, e.y + ddy + bob, e.sc, flip, tint);
      ctx.globalAlpha = e.alpha;
    }
    drawSpr(fr, e.x, e.y + bob, e.sc, flip, e.flash > 0 ? 'W' : '');
    if (frozen && e.type !== 'reaper') drawSpr(fr, e.x, e.y + bob, e.sc, flip, 'B');
    ctx.globalAlpha = 1;
    if (e.type === 'reaper') drawScythe(e, flip);
  }
  // players (partner first so the local hero is drawn on top)
  for (const Q of R.players) if (Q !== P && !Q.gone) drawPlayer(Q);
  drawPlayer(P);
  // projectiles & fx
  for (const p of R.projs) if (!p.ground) drawProj(p);
  for (const f of R.fx) drawFx(f);
  for (const p of R.parts) { ctx.fillStyle = p.c; ctx.globalAlpha = 1 - p.t / p.life; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
  ctx.globalAlpha = 1;

  // screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (R.freezeT > 0) { ctx.fillStyle = 'rgba(80,160,255,0.10)'; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (R.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, R.flashT * 2)})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  drawNums(ox, oy);
  if (R.players.length > 1) drawTags(ox, oy);
  drawHud();
  drawJoystick();
}
const PCOL = ['#ffb040', '#60c8ff'];
function drawPlayer(Q) {
  const mhp = Q.st.maxHp || 1;
  if (Q.down) {
    shadow(Q.x, Q.y + 6, 5);
    ctx.globalAlpha = 0.85;
    drawSpr(ITEM.tomb, Q.x, Q.y + 1);
    ctx.globalAlpha = 1;
    const k = clamp(Math.max(Q.revP / REVIVE_NEAR, Q.downT / REVIVE_AUTO), 0, 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(Q.x, Q.y, 14, 0, TAU); ctx.stroke();
    ctx.strokeStyle = Q.revP > 0 ? '#7df09a' : '#ffd040'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(Q.x, Q.y, 14, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
    return;
  }
  const spr = CHAR_SPR[Q.char.id];
  const fr = spr[Q.moving ? ((Q.anim * 7) | 0) % 2 : 0];
  shadow(Q.x, Q.y + 8, 5);
  const blink = Q.inv > 0 && Math.sin(frameT * 30) > 0;
  if (!blink) drawSpr(fr, Q.x, Q.y, 1, Q.faceX < 0, Q.hurtT > 0 ? 'R' : '');
  // hp bar
  const hpw = 16, hx = Q.x - hpw / 2, hy = Q.y + 10;
  ctx.fillStyle = '#000'; ctx.fillRect(hx - 0.5, hy - 0.5, hpw + 1, 3);
  ctx.fillStyle = '#5a1a22'; ctx.fillRect(hx, hy, hpw, 2);
  ctx.fillStyle = Q === run.me ? '#ff4050' : '#40d0ff'; ctx.fillRect(hx, hy, hpw * clamp(Q.hp / mhp, 0, 1), 2);
}
// co-op: name tags over heroes, and an arrow at the screen edge pointing to an off-screen partner
function drawTags(ox, oy) {
  const R = run, S = view.S, d = view.dpr, W = cv.width, H = cv.height;
  ctx.textBaseline = 'middle';
  for (const Q of R.players) {
    if (Q.gone) continue;
    const sx = Q.x * S + ox, sy = Q.y * S + oy, col = PCOL[Q.idx % 2];
    const margin = 22 * d, top = view.safeTop * d + 70 * d, bot = H - view.safeBottom * d - 24 * d;
    if (sx > margin && sx < W - margin && sy > top && sy < bot) {
      hudText((Q.idx + 1) + 'P', sx, sy - 14 * S, 10, col, 'center');
      if (Q.down) hudText(Q.revP > 0 ? '부활 중…' : '쓰러짐', sx, sy + 20 * S, 10, '#ffd040', 'center');
      continue;
    }
    // off screen: clamp to edge
    const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min((W / 2 - margin) / Math.abs(dx || 1e-6), (H / 2 - margin - 40 * d) / Math.abs(dy || 1e-6));
    const ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(12 * d, 0); ctx.lineTo(-6 * d, -9 * d); ctx.lineTo(-6 * d, 9 * d); ctx.fill();
    ctx.fillStyle = Q.down ? '#ffd040' : col; ctx.beginPath(); ctx.moveTo(9 * d, 0); ctx.lineTo(-4 * d, -6 * d); ctx.lineTo(-4 * d, 6 * d); ctx.fill();
    ctx.restore();
    hudText((Q.idx + 1) + 'P' + (Q.down ? ' !' : ''), ax - Math.cos(a) * 18 * d, ay - Math.sin(a) * 16 * d, 10, Q.down ? '#ffd040' : col, 'center');
  }
  ctx.textBaseline = 'alphabetic';
}
function drawScythe(e, flip) {
  const s = flip ? -1 : 1, x = e.x + 9 * s, y = e.y;
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 0.5, y - 14, 1.5, 24);
  ctx.strokeStyle = '#c8d0e0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x - 8 * s, y - 12, 9, flip ? 0.2 : Math.PI - 1.4, flip ? 1.4 : Math.PI - 0.2); ctx.stroke();
}
function drawGround(cx, cy) {
  const N = 512;
  const x0 = Math.floor(cx / N) * N, y0 = Math.floor(cy / N) * N;
  for (let x = x0; x < cx + view.vw; x += N) for (let y = y0; y < cy + view.vh; y += N) ctx.drawImage(GROUND, x, y);
}
function drawProj(p) {
  switch (p.kind) {
    case 'bolt': {
      const c1 = p.evo ? '#ff78e8' : '#b070ff';
      ctx.fillStyle = c1; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.r + 1.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      break;
    }
    case 'dagger':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = '#000'; ctx.fillRect(-6, -1.5, 12, 3);
      ctx.fillStyle = p.evo ? '#80f0ff' : '#e8eef8'; ctx.fillRect(-2, -1, 7, 2);
      ctx.fillStyle = p.evo ? '#2050a0' : '#3a8a4a'; ctx.fillRect(-5, -1, 3, 2);
      ctx.restore();
      break;
    case 'axe': case 'cross': {
      const spr = ICONS[p.kind === 'axe' ? 'axe' : 'cross'][p.crit ? 1 : 0];
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      const sc = (p.sc || 1) * 1.2;
      ctx.drawImage(spr.c, -spr.w * sc / 2, -spr.h * sc / 2, spr.w * sc, spr.h * sc);
      ctx.restore();
      break;
    }
    case 'scythe':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 1.1); ctx.stroke();
      ctx.strokeStyle = '#c090f0'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      break;
    case 'orb': {
      ctx.fillStyle = 'rgba(80,220,200,0.3)';
      const evo = p.evo;
      if (evo) ctx.fillStyle = 'rgba(210,100,255,0.3)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 2, 0, TAU); ctx.fill();
      drawSpr(ICONS.runes[evo ? 1 : 0], p.x, p.y + 1, 1.1);
      break;
    }
    case 'flask':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(ICONS.flask[0].c, -4, -4, 8, 8);
      ctx.restore();
      break;
    case 'pool': {
      const a = Math.min(1, p.life * 2);
      ctx.globalAlpha = 0.75 * a;
      const cols = p.evo ? ['#5020a0', '#9050ff', '#d0a0ff'] : ['#a02010', '#ff6020', '#ffd040'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        const rr = p.r * (1 - i * 0.3);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * 0.55, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = cols[2];
      for (let i = 0; i < 5; i++) {
        const fx = p.x + Math.sin(frameT * 3 + i * 1.7 + p.x) * p.r * 0.7;
        const fy = p.y + Math.cos(frameT * 2.3 + i * 2.1) * p.r * 0.35 - ((frameT * 20 + i * 5) % 6);
        ctx.fillRect(fx, fy, 1.5, 2);
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}
function drawFx(f) {
  const k = f.t / f.life;
  if (f.kind === 'slash') {
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(f.x, f.y);
    ctx.scale(f.side, 1);
    const w = f.w / 2, h = f.h / 2;
    ctx.fillStyle = f.evo ? '#ff4060' : '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, Math.PI, TAU);
    ctx.ellipse(0, h * 0.5, w * 0.92, h * 0.6, 0, TAU, Math.PI, true);
    ctx.fill();
    ctx.fillStyle = f.evo ? '#ffc0c8' : '#c8e0ff';
    ctx.fillRect(-w * 0.8 + k * w * 1.2, -h * 0.6, w * 0.5, 1.5);
    ctx.restore();
  } else if (f.kind === 'bolt') {
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = f.evo ? '#80e8ff' : '#fff6a0'; ctx.lineWidth = 2;
    ctx.beginPath();
    let x = f.x + rand(-3, 3), y = f.y - 110;
    ctx.moveTo(x, y);
    while (y < f.y) { y += 12; x = f.x + rand(-5, 5); ctx.lineTo(x, Math.min(y, f.y)); }
    ctx.stroke();
    ctx.fillStyle = f.evo ? 'rgba(128,232,255,0.4)' : 'rgba(255,246,160,0.4)';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k * 0.6), 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawNums(ox, oy) {
  const R = run, S = view.S, d = view.dpr;
  ctx.textAlign = 'center';
  for (const n of R.nums) {
    const k = n.t / 0.6;
    const sx = n.x * S + ox, sy = (n.y - k * 10) * S + oy;
    const size = (n.crit ? 13 : 10) * d;
    ctx.font = `700 ${size}px G, monospace`;
    ctx.globalAlpha = 1 - k * k;
    ctx.fillStyle = '#000';
    ctx.fillText(n.v, sx + d, sy + d);
    ctx.fillStyle = n.crit ? '#ffd040' : '#ffffff';
    ctx.fillText(n.v, sx, sy);
  }
  ctx.globalAlpha = 1;
}
function hudText(t, x, y, size, color = '#fff', align = 'left') {
  const d = view.dpr;
  ctx.font = `700 ${size * d}px G, monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = '#000';
  ctx.fillText(t, x + d * 1.5, y + d * 1.5);
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}
function drawHud() {
  const R = run, d = view.dpr, W = cv.width;
  const top = view.safeTop * d;
  // xp bar
  const bh = 12 * d;
  ctx.fillStyle = '#000'; ctx.fillRect(0, top, W, bh + 2 * d);
  ctx.fillStyle = '#1a1a3a'; ctx.fillRect(d, top + d, W - 2 * d, bh);
  ctx.fillStyle = '#3a7aff'; ctx.fillRect(d, top + d, (W - 2 * d) * clamp(R.xp / R.xpNext, 0, 1), bh);
  ctx.fillStyle = '#7ab0ff'; ctx.fillRect(d, top + d, (W - 2 * d) * clamp(R.xp / R.xpNext, 0, 1), 2 * d);
  ctx.textBaseline = 'middle';
  hudText('LV ' + R.level, W - 8 * d, top + d + bh / 2, 11, '#fff', 'right');
  // timer
  hudText(fmtTime(R.t), W / 2, top + 30 * d, 20, R.cleared ? '#ffd040' : '#ffffff', 'center');
  // kills & gold
  hudText('☠ ' + R.kills, W - 8 * d, top + 26 * d, 12, '#e8e0f0', 'right');
  hudText('● ' + Math.floor(R.gold * (st.greed || 1)), W - 8 * d, top + 42 * d, 12, '#ffd040', 'right');
  // inventory icons
  const isz = 16 * d, gap = 2 * d;
  let x = 6 * d, y = top + 18 * d;
  for (const w of R.weapons) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, isz, isz);
    ctx.drawImage(ICONS[w.id][w.evo ? 1 : 0].c, x + 2 * d, y + 2 * d, isz - 4 * d, isz - 4 * d);
    if (evoReady(w)) { ctx.strokeStyle = Math.sin(frameT * 8) > 0 ? '#ffd040' : '#fff'; ctx.lineWidth = d; ctx.strokeRect(x + d / 2, y + d / 2, isz - d, isz - d); }
    x += isz + gap;
  }
  x = 6 * d; y += isz + gap;
  for (const id of R.passiveOrder) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, isz, isz);
    ctx.drawImage(passiveIcon(id).c, x + 2 * d, y + 2 * d, isz - 4 * d, isz - 4 * d);
    x += isz + gap;
  }
  // boss bar
  const b = R.bossBar;
  if (b && !b.dead) {
    const bw = Math.min(W - 130 * d, 300 * d), bx = (W - bw) / 2, by = top + 62 * d;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - d, by - d, bw + 2 * d, 8 * d);
    ctx.fillStyle = '#3a0a10'; ctx.fillRect(bx, by, bw, 6 * d);
    ctx.fillStyle = '#e02040'; ctx.fillRect(bx, by, bw * clamp(b.hp / b.maxHp, 0, 1), 6 * d);
    hudText(b.name, W / 2, by + 16 * d, 11, '#ff8090', 'center');
  }
  // co-op: waiting on the partner / knocked down
  const hold = netHoldText();
  if (hold) {
    const hy = cv.height * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, hy - 14 * d, W, 28 * d);
    hudText(hold, W / 2, hy, 13, '#c8e0ff', 'center');
  } else if (R.me.down && R.players.length > 1) {
    const hy = cv.height * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, hy - 14 * d, W, 28 * d);
    hudText(`쓰러졌어요… ${Math.max(0, Math.ceil(REVIVE_AUTO - R.me.downT))}초 뒤 부활 (동료가 오면 더 빨리)`, W / 2, hy, 12, '#ffd040', 'center');
  }
  // banner
  if (R.banner) {
    const bn = R.banner, a = Math.min(1, bn.t * 2, (bn.dur - bn.t) * 4);
    ctx.globalAlpha = clamp(a, 0, 1);
    const by = cv.height * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, by - 18 * d, W, 36 * d);
    hudText(bn.text, W / 2, by, 16, bn.color, 'center');
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'alphabetic';
}
function passiveIcon(id) { return id === 'magnet' ? ITEM.magnet : ICONS[id][0]; }
function drawJoystick() {
  if (!input.active) return;
  const d = view.dpr;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(input.ox * d, input.oy * d, 46 * d, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * d; ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((input.ox + input.jx * 46) * d, (input.oy + input.jy * 46) * d, 18 * d, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}
// title-screen background: slow drifting field with a few wandering monsters
const idle = { t: 0, mobs: [] };
function renderIdle() {
  const S = view.S;
  idle.t += 1 / 60;
  if (!idle.mobs.length) for (let i = 0; i < 26; i++) idle.mobs.push({ x: rand(0, 600), y: rand(0, 900), k: pick(['bat', 'slime', 'zombie', 'skeleton', 'ghost', 'eye']), a: rand(0, 3) });
  const cx = idle.t * 8, cy = idle.t * 4;
  ctx.setTransform(S, 0, 0, S, Math.round(-cx * S), Math.round(-cy * S));
  drawGround(cx, cy);
  for (const m of idle.mobs) {
    m.a += 1 / 60;
    const sp = SPR[ENEMIES[m.k].spr];
    const x = cx + ((m.x - cx * 0.4) % (view.vw + 40) + view.vw + 40) % (view.vw + 40) - 20;
    const y = cy + ((m.y + cy * 0.2) % (view.vh + 40) + view.vh + 40) % (view.vh + 40) - 20;
    ctx.globalAlpha = 0.85;
    drawSpr(sp[((m.a * 5) | 0) % sp.length], x, y);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ============================================================
// main loop
// ============================================================
let state = 'title';
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (run && hooks.guest) hooks.guest(dt);
  else if (state === 'play' && run && !hooks.holding()) update(dt);
  hooks.tick(dt);
  render(dt);
}
