'use strict';
// ============================================================
// online co-op (2 players)
// The host's phone runs the whole simulation. The guest moves its own hero
// locally, sends its position, and draws the snapshots the host streams back.
// server.js only pairs the two phones by a 4-digit room code and relays messages.
// ============================================================
const SNAP_DT = 0.05;
const PKINDS = ['bolt', 'dagger', 'axe', 'cross', 'scythe', 'orb', 'flask', 'pool'];
const PICKS = ['coin', 'bag', 'chicken', 'magnet', 'bomb', 'ice', 'chest'];
const SPINNERS = { axe: 12, cross: 12, scythe: 14, flask: 10 };

function netSend(o) {
  const ws = NET.ws;
  if (!ws || ws.readyState !== 1) return;
  ws.send(o instanceof ArrayBuffer ? o : JSON.stringify(o));
}
function netConnect(first) {
  netClose();
  let ws;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { mpMsg('서버에 연결할 수 없어요'); return; }
  ws.binaryType = 'arraybuffer';
  NET.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify(first));
  ws.onmessage = ev => {
    if (NET.ws !== ws) return;
    if (typeof ev.data !== 'string') { onSnap(ev.data); return; }
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    onMsg(m);
  };
  ws.onclose = () => { if (NET.ws === ws) { NET.ws = null; onDrop(); } };
}
function netClose() {
  const ws = NET.ws;
  NET.ws = null;
  if (ws) try { ws.close(); } catch (e) { /* ignore */ }
}
function netLeave() {
  netClose();
  NET.role = null; NET.peer = null; NET.code = ''; NET.inGame = false;
  NETQ.on = false; NETQ.ev.length = 0;
  hooks.guest = null;
}
function mpMsg(t) { $('mpMsg').textContent = t || ''; }
function remoteP() { return run && run.players.find(p => p.ctrl === 'remote'); }
function cleanPower(pw) {
  const o = {};
  for (const p of POWERUPS) { const v = pw ? Math.floor(+pw[p.id]) : 0; if (v > 0) o[p.id] = Math.min(p.max, v); }
  return o;
}
function myChar() { return save.chars[save.lastChar] ? save.lastChar : 'knight'; }
function sendMe() { netSend({ t: 'me', char: myChar(), power: save.power, vw: view.vw, vh: view.vh }); }

// ============================================================
// lobby screens
// ============================================================
function showMp() { state = 'mp'; run = null; mpMsg(''); show('mp'); }
on('bCoop', showMp);
on('bMpBack', () => { netLeave(); showTitle(); });
on('bCreate', () => { mpMsg('방을 만드는 중…'); netConnect({ t: 'create' }); });
on('bJoin', () => {
  const code = $('joinCode').value.replace(/\D/g, '');
  if (code.length !== 4) { mpMsg('방 코드 4자리를 입력하세요'); return; }
  mpMsg('접속 중…');
  netConnect({ t: 'join', code });
});
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('bJoin').click(); });

function playerRow(label, charId, me) {
  if (!charId) return `<div class="recipe"><div class="ico sm" style="opacity:.3"></div><div class="nm"><b>${label}</b><br><span class="dim">기다리는 중…</span></div></div>`;
  const c = CHARS.find(x => x.id === charId) || CHARS[0];
  return `<div class="recipe"><img class="ico sm" src="${charURL(c.id)}" alt=""><div class="nm"><b>${label}</b>${me ? ' <span class="gold-t">(나)</span>' : ''}<br><span class="dim">${c.name} · ${c.title}</span></div><img class="ico sm" src="${weaponIcon(c.weapon)}" alt=""></div>`;
}
function showLobby() {
  if (!NET.ws) { netLeave(); showTitle(); return; }
  state = 'lobby'; run = null;
  NET.inGame = false; NETQ.on = false; hooks.guest = null;
  const host = NET.role === 'host';
  $('lCode').textContent = NET.code;
  const peerChar = NET.peer && NET.peer.char;
  $('lPlayers').innerHTML = host
    ? playerRow('1P', myChar(), true) + playerRow('2P', peerChar, false)
    : playerRow('1P', peerChar, false) + playerRow('2P', myChar(), true);
  $('bLStart').style.display = host ? 'block' : 'none';
  $('bLStart').disabled = !NET.peer;
  $('lHint').innerHTML = host
    ? (NET.peer ? '준비 완료! 시작을 누르세요.' : '친구에게 방 코드를 알려주세요.<br>친구는 [함께하기 → 참가하기]에서 코드를 입력하면 돼요.')
    : (NET.peer ? '방장이 시작하길 기다리는 중…' : '방장 정보를 받는 중…');
  show('lobby');
}
on('bLChar', () => {
  charPickMode = id => { if (id) sendMe(); showLobby(); };
  selChar = myChar();
  showChars();
});
on('bLLeave', () => { netLeave(); showMp(); });
on('bLStart', () => {
  if (NET.role !== 'host' || !NET.peer) return;
  const list = [
    { char: myChar(), power: save.power, ctrl: 'local' },
    { char: NET.peer.char, power: NET.peer.power, ctrl: 'remote' },
  ];
  netSend({ t: 'start', chars: [list[0].char, list[1].char] });
  startRun(list);
  const G = remoteP();
  G.vw = NET.peer.vw; G.vh = NET.peer.vh; G.tx = G.x; G.ty = G.y;
  NET.inGame = true; NETQ.on = true; NETQ.ev.length = 0;
  NET.snapT = 0; NET.invT = 0;
  sendInv(G);
});

// ============================================================
// messages
// ============================================================
function onDrop() {
  if (NET.role === 'host' && NET.inGame && run) { partnerGone(); return; }
  if (NET.role === 'guest' && run && state !== 'result') { gameOver('연결이 끊겼어요'); hooks.guest = null; return; }
  if (state === 'lobby' || state === 'mp') { const r = NET.role; netLeave(); showMp(); mpMsg(r ? '연결이 끊겼어요' : '서버에 연결할 수 없어요'); }
}
function partnerGone() {
  const G = remoteP();
  if (G && !G.gone) {
    G.gone = true; G.down = true; G.busy = null;
    banner('동료가 게임을 떠났어요. 혼자 계속해요!', '#ff8090', 3);
  }
  NETQ.on = false;
}
function onMsg(m) {
  switch (m.t) {
    // --- from the relay server
    case 'created': NET.role = 'host'; NET.code = m.code; NET.peer = null; showLobby(); break;
    case 'joined': NET.role = 'guest'; NET.code = m.code; NET.peer = null; sendMe(); showLobby(); break;
    case 'err': netLeave(); showMp(); mpMsg(m.msg); break;
    case 'peer-joined':
      if (NET.inGame || state === 'play' || state === 'levelup' || state === 'chest' || state === 'pause') { netSend({ t: 'busy' }); break; }
      sendMe();
      break;
    case 'peer-left':
      NET.peer = null;
      if (NET.role === 'host') {
        if (NET.inGame) partnerGone();
        else if (state === 'lobby') showLobby();
      } else {
        const playing = run && state !== 'result';
        netLeave();
        if (playing) { NET.role = null; gameOver('방장과 연결이 끊겼어요'); }
        else if (state === 'lobby') { showMp(); mpMsg('방장이 방을 나갔어요'); }
      }
      break;
    // --- from the partner
    case 'me':
      if (!CHARS.some(c => c.id === m.char)) break;
      NET.peer = { char: m.char, power: cleanPower(m.power), vw: clamp(+m.vw || 200, 100, 600), vh: clamp(+m.vh || 300, 100, 900) };
      if (state === 'lobby') showLobby();
      break;
    case 'busy': netLeave(); showMp(); mpMsg('이미 게임이 진행 중인 방이에요'); break;
    default:
      if (NET.role === 'host') hostMsg(m); else if (NET.role === 'guest') guestMsg(m);
  }
}

// ============================================================
// host side
// ============================================================
function hostMsg(m) {
  const G = remoteP();
  if (!G || G.gone || !NET.inGame) return;
  switch (m.t) {
    case 'in':
      if (!isFinite(m.x) || !isFinite(m.y)) break;
      G.tx = +m.x; G.ty = +m.y;
      G.fx = clamp(+m.fx || 0, -1, 1); G.fy = clamp(+m.fy || 0, -1, 1);
      if (!G.fx && !G.fy) G.fx = 1;
      G.faceX = m.fc < 0 ? -1 : 1; G.moving = !!m.mv;
      if (m.vw) { G.vw = clamp(+m.vw, 100, 600); G.vh = clamp(+m.vh, 100, 900); }
      break;
    case 'pick': {
      if (G.busy !== 'lv') break;
      const c = G.choices && G.choices[m.i | 0];
      if (!c) break;
      use(G); applyChoice(c); use(run.me);
      G.pending--; G.busy = null;
      sendInv(G);
      break;
    }
    case 'reroll':
      if (G.busy !== 'lv' || G.rerolls <= 0) break;
      G.rerolls--; remoteLevel(G, true);
      break;
    case 'skip':
      if (G.busy !== 'lv' || G.skips <= 0) break;
      G.skips--; run.xp += run.xpNext * 0.1;
      G.pending--; G.busy = null;
      sendInv(G);
      break;
    case 'chestOk': if (G.busy === 'chest') G.busy = null; break;
    case 'hold':
      if (m.on && !G.busy) G.busy = 'pause';
      else if (!m.on && G.busy === 'pause') G.busy = null;
      break;
    case 'quit': partnerGone(); break;
  }
}
function remoteLevel(G, quiet) {
  use(G); G.choices = rollChoices(); use(run.me);
  G.busy = 'lv';
  netSend({ t: 'lv', ch: G.choices, rr: G.rerolls, sk: G.skips, q: quiet ? 1 : 0 });
}
// called by openChest when the partner opened it
function netChest(G, items, count, g) {
  G.busy = 'chest';
  sendInv(G);
  netSend({ t: 'chest', items, count, g });
}
function sendInv(G) {
  if (!G) return;
  const dmg = {};
  for (const k in G.dmgBy) dmg[k] = Math.round(G.dmgBy[k]);
  netSend({ t: 'inv', w: G.weapons.map(w => [w.id, w.lvl, w.evo ? 1 : 0]), ps: G.passives, po: G.passiveOrder, st: G.st, rr: G.rerolls, sk: G.skips, dmg });
}
function netGameOver() {
  const R = run, G = remoteP();
  if (G && !G.gone) {
    const dmg = {};
    for (const k in G.dmgBy) dmg[k] = Math.round(G.dmgBy[k]);
    sendInv(G);
    netSend({ t: 'over', time: R.t, gold: R.gold, kills: R.kills, lv: R.level, cl: R.cleared ? 1 : 0, dmg });
  }
  NET.inGame = false; NETQ.on = false;
}

// snapshot: JSON header (players, pickups, events…) + packed binary lists of enemies, gems and projectiles
const enc = new TextEncoder(), dec = new TextDecoder();
const r1 = v => Math.round(v * 10) / 10;
function encodeSnap(G) {
  const R = run, bx = G.vw / 2 + 70, by = G.vh / 2 + 70;
  const near = (x, y) => Math.abs(x - G.x) < bx && Math.abs(y - G.y) < by;
  const ev = [];
  let nn = 0, nk = 0;
  for (const e of NETQ.ev) {
    if (e[0] === 'n') { if (nn < 50 && near(e[1], e[2])) { ev.push(e); nn++; } }
    else if (e[0] === 'k') { if (nk < 40 && near(e[1], e[2])) { ev.push(e); nk++; } }
    else if (e[0] === 'f') {
      const f = e[1];
      if (near(f.x, f.y)) ev.push(['f', f.kind === 'slash' ? { kind: 'slash', x: r1(f.x), y: r1(f.y), w: r1(f.w), h: r1(f.h), side: f.side, life: f.life, evo: f.evo ? 1 : 0 } : { kind: f.kind, x: r1(f.x), y: r1(f.y), r: r1(f.r), life: f.life, evo: f.evo ? 1 : 0 }]);
    } else ev.push(e);
  }
  const holding = R.players.some(p => p.ctrl === 'remote' && !p.gone && p.busy);
  const b = R.bossBar && !R.bossBar.dead ? R.bossBar : null;
  const head = {
    t: R.t, k: R.kills, g: R.gold, lv: R.level, xp: Math.floor(R.xp), xn: R.xpNext, fz: r1(R.freezeT), fl: r1(R.flashT), cl: R.cleared ? 1 : 0,
    run: state === 'play' && !holding ? 1 : 0, hold: state === 'play' ? 0 : state,
    boss: b ? [b.name, Math.round(b.hp), Math.round(b.maxHp)] : 0,
    pl: R.players.map(p => [r1(p.x), r1(p.y), r1(Math.max(0, p.hp)), p.st.maxHp, p.faceX, p.moving ? 1 : 0, p.hurtT > 0 ? 1 : 0, p.inv > 0 ? 1 : 0,
      p.down ? 1 : 0, r1(p.revP), r1(p.downT), r1(p.auraR), p.auraEvo ? 1 : 0, p.gone ? 1 : 0]),
    pk: R.pickups.filter(p => near(p.x, p.y)).map(p => [PICKS.indexOf(p.type), Math.round(p.x), Math.round(p.y)]),
    pr: R.props.filter(p => !p.dead && near(p.x, p.y)).map(p => [Math.round(p.x), Math.round(p.y), r1(p.ph)]),
    ev,
  };
  const hb = enc.encode(JSON.stringify(head));
  const es = R.enemies.filter(e => !e.dead && near(e.x, e.y));
  const gs = R.gems.filter(g => near(g.x, g.y)).slice(0, 400);
  const ps = R.projs.filter(p => !p.dead && near(p.x, p.y)).slice(0, 500);
  const buf = new ArrayBuffer(4 + hb.length + 6 + es.length * 12 + gs.length * 9 + ps.length * 16);
  const dv = new DataView(buf);
  dv.setUint32(0, hb.length);
  new Uint8Array(buf, 4, hb.length).set(hb);
  let o = 4 + hb.length;
  dv.setUint16(o, es.length); o += 2;
  for (const e of es) {
    dv.setUint16(o, e.id & 0xffff); dv.setUint8(o + 2, ENEMY_IDX[e.type]);
    dv.setUint8(o + 3, (e.elite ? 1 : 0) | (e.boss ? 2 : 0) | (e.flash > 0 ? 4 : 0) | (e.line ? 8 : 0) | (e.line && e.dx < 0 ? 16 : 0));
    dv.setFloat32(o + 4, e.x); dv.setFloat32(o + 8, e.y); o += 12;
  }
  dv.setUint16(o, gs.length); o += 2;
  for (const g of gs) {
    dv.setUint8(o, g.v >= 100 ? 3 : g.v >= 20 ? 2 : g.v >= 5 ? 1 : 0);
    dv.setFloat32(o + 1, g.x); dv.setFloat32(o + 5, g.y); o += 9;
  }
  dv.setUint16(o, ps.length); o += 2;
  for (const p of ps) {
    const rot = p.kind === 'bolt' ? Math.atan2(p.vy, p.vx) : p.rot || 0;
    dv.setUint16(o, p.id); dv.setUint8(o + 2, PKINDS.indexOf(p.kind));
    dv.setUint8(o + 3, (p.evo ? 1 : 0) | (p.crit ? 2 : 0) | (p.ground ? 4 : 0));
    dv.setFloat32(o + 4, p.x); dv.setFloat32(o + 8, p.y);
    dv.setUint8(o + 12, (((rot % TAU) + TAU) % TAU) / TAU * 256 & 255);
    dv.setUint8(o + 13, Math.min(255, Math.round(p.r * 2)));
    dv.setUint8(o + 14, Math.min(255, Math.round((p.sc || 1) * 40)));
    dv.setUint8(o + 15, Math.min(255, Math.round(Math.max(0, p.life) * 100)));
    o += 16;
  }
  return buf;
}
function hostTick(dt) {
  const R = run, G = remoteP();
  if (!R || !NET.inGame || !G || G.gone) return;
  if (state !== 'result' && !R.cleared) {
    if (!G.busy && G.pending > 0) remoteLevel(G);
  }
  NET.snapT += dt;
  if (NET.snapT >= SNAP_DT) {
    NET.snapT = 0;
    netSend(encodeSnap(G));
    NETQ.ev.length = 0;
    sfxSent.clear();
  }
  NET.invT += dt;
  if (NET.invT > 2) { NET.invT = 0; sendInv(G); }
}

// ============================================================
// guest side
// ============================================================
function guestRun(chars) {
  eid = 0;
  run = {
    t: 0, kills: 0, gold: 0, level: 1, xp: 0, xpNext: 5,
    players: chars.map((c, i) => makePlayer(i, c, {}, i === 1 ? 'local' : 'remote')),
    enemies: [], projs: [], gems: [], pickups: [], props: [], parts: [], nums: [], fx: [], timers: [],
    freezeT: 0, flashT: 0, shake: 0, banner: null, cleared: false, bossBar: null,
  };
  run.me = run.players[1];
  for (const p of run.players) {
    const ch = p.char;
    p.st = { maxHp: ch.hp, move: 72 * (1 + (ch.bonus.move || 0)), greed: 1, might: 1, armor: 0, recovery: 0, cooldown: 1, area: 1, speed: 1, duration: 1, amount: 0, luck: 1, growth: 1, magnet: 40 };
    p.hp = ch.hp; p.weapons = [{ id: ch.weapon, lvl: 1, evo: false }];
    p.tx = p.x; p.ty = p.y; p.vx = 0; p.vy = 0;
  }
  NET.emap = new Map(); NET.pmap = new Map();
  NET.lastSnap = performance.now(); NET.hostRun = 1; NET.hostHold = 0;
  use(run.me);
}
function guestMsg(m) {
  switch (m.t) {
    case 'start':
      if (!Array.isArray(m.chars) || m.chars.length !== 2) break;
      guestRun(m.chars);
      NET.inGame = true;
      hooks.guest = guestUpdate;
      state = 'play'; input.active = false;
      show(null); audio();
      break;
    case 'inv': {
      if (!run || !run.me) break;
      const p = run.me;
      p.weapons = (m.w || []).filter(a => WEAPONS[a[0]]).map(([id, lvl, evo]) => ({ id, lvl, evo: !!evo }));
      p.passives = {}; p.passiveOrder = [];
      for (const id of m.po || []) if (PASSIVES[id]) { p.passiveOrder.push(id); p.passives[id] = m.ps[id] | 0; }
      if (m.st && m.st.maxHp) p.st = m.st;
      p.rerolls = m.rr | 0; p.skips = m.sk | 0; p.dmgBy = m.dmg || {};
      use(p);
      break;
    }
    case 'lv':
      if (!run || state === 'result' || !Array.isArray(m.ch)) break;
      run.me.rerolls = m.rr | 0; run.me.skips = m.sk | 0;
      showChoices(m.ch.filter(c => c.type === 'gold' || c.type === 'heal' || WEAPONS[c.id] || PASSIVES[c.id]), !!m.q);
      break;
    case 'chest':
      if (!run || state === 'result') break;
      showChest(m.items || [], m.count | 0, m.g | 0);
      break;
    case 'over':
      if (!run) break;
      run.t = +m.time || run.t; run.gold = +m.gold || 0; run.kills = m.kills | 0; run.level = m.lv | 0; run.cleared = !!m.cl;
      run.me.dmgBy = m.dmg || run.me.dmgBy;
      NET.inGame = false;
      gameOver();
      hooks.guest = null;
      break;
  }
}
// dead-reckoned smoothing toward the latest snapshot position
function track(o, x, y, dts) {
  if (o.tx === undefined || Math.abs(x - o.tx) > 60 || Math.abs(y - o.ty) > 60) { o.x = o.tx = x; o.y = o.ty = y; o.vx = o.vy = 0; return; }
  if (dts > 0) { o.vx = clamp((x - o.tx) / dts, -500, 500); o.vy = clamp((y - o.ty) / dts, -500, 500); }
  o.tx = x; o.ty = y;
}
function onSnap(buf) {
  const R = run;
  if (NET.role !== 'guest' || !R || !hooks.guest) return;
  const dv = new DataView(buf);
  const hl = dv.getUint32(0);
  let h;
  try { h = JSON.parse(dec.decode(new Uint8Array(buf, 4, hl))); } catch (e) { return; }
  const dts = h.t > R.t ? h.t - R.t : 0;
  R.t = h.t; R.kills = h.k; R.gold = h.g; R.level = h.lv; R.xp = h.xp; R.xpNext = h.xn;
  R.freezeT = h.fz; R.cleared = !!h.cl;
  if (h.fl > R.flashT) R.flashT = h.fl;
  NET.hostRun = h.run; NET.hostHold = h.hold; NET.lastSnap = performance.now();
  R.bossBar = h.boss ? { name: h.boss[0], hp: h.boss[1], maxHp: h.boss[2], dead: false } : null;
  h.pl.forEach((a, i) => {
    const p = R.players[i];
    if (!p) return;
    const [x, y, hp, mhp, fc, mv, hurt, inv, down, revP, downT, auraR, auraEvo, gone] = a;
    if (p === R.me) {
      if (hp < p.hp - 0.5 && !down) { sfx.hurt(); vibrate(25); R.shake = Math.min(R.shake + 1.5, 4); }
      if (down && !p.down) { p.x = x; p.y = y; }
    } else {
      track(p, x, y, dts);
      p.faceX = fc; p.moving = !!mv;
    }
    p.hp = hp; p.st.maxHp = mhp; p.hurtT = hurt ? 0.1 : 0; p.inv = inv ? 1 : 0;
    p.down = !!down; p.revP = revP; p.downT = downT; p.auraR = auraR; p.auraEvo = !!auraEvo; p.gone = !!gone;
  });
  R.pickups = h.pk.filter(a => PICKS[a[0]]).map(a => ({ type: PICKS[a[0]], x: a[1], y: a[2] }));
  R.props = h.pr.map(a => ({ x: a[0], y: a[1], ph: a[2], dead: false }));
  for (const e of h.ev) guestEvent(e);

  let o = 4 + hl;
  // enemies
  const n = dv.getUint16(o); o += 2;
  const em = new Map(), list = [];
  for (let i = 0; i < n; i++, o += 12) {
    const id = dv.getUint16(o), type = ENEMY_KEYS[dv.getUint8(o + 2)], fl = dv.getUint8(o + 3);
    const x = dv.getFloat32(o + 4), y = dv.getFloat32(o + 8);
    if (!type) continue;
    let e = NET.emap.get(id);
    if (!e || e.type !== type) e = { id, type, spr: SPR[ENEMIES[type].spr], alpha: ENEMIES[type].alpha || 1, anim: Math.random() * 2, flash: 0 };
    track(e, x, y, dts);
    e.elite = !!(fl & 1); e.boss = !!(fl & 2); e.line = !!(fl & 8); e.dx = fl & 16 ? -1 : 1;
    if (fl & 4) e.flash = 0.1;
    e.sc = e.boss ? 3 : e.elite ? 2 : type === 'reaper' ? 1.5 : 1;
    em.set(id, e); list.push(e);
  }
  NET.emap = em; R.enemies = list;
  // gems
  const ng = dv.getUint16(o); o += 2;
  const gems = [];
  for (let i = 0; i < ng; i++, o += 9) gems.push({ v: [1, 5, 20, 100][dv.getUint8(o)], x: dv.getFloat32(o + 1), y: dv.getFloat32(o + 5) });
  R.gems = gems;
  // projectiles
  const np = dv.getUint16(o); o += 2;
  const pm = new Map(), projs = [];
  for (let i = 0; i < np; i++, o += 16) {
    const id = dv.getUint16(o), kind = PKINDS[dv.getUint8(o + 2)], fl = dv.getUint8(o + 3);
    if (!kind) continue;
    let p = NET.pmap.get(id);
    if (!p || p.kind !== kind) p = { id, kind, rot: dv.getUint8(o + 12) / 256 * TAU };
    track(p, dv.getFloat32(o + 4), dv.getFloat32(o + 8), dts);
    p.evo = !!(fl & 1); p.crit = fl & 2 ? 1 : 0; p.ground = !!(fl & 4);
    if (!SPINNERS[kind]) p.rot = dv.getUint8(o + 12) / 256 * TAU;
    p.r = dv.getUint8(o + 13) / 2; p.sc = dv.getUint8(o + 14) / 40; p.life = dv.getUint8(o + 15) / 100;
    if (kind === 'bolt') { p.vx = Math.cos(p.rot) * 200; p.vy = Math.sin(p.rot) * 200; }
    pm.set(id, p); projs.push(p);
  }
  NET.pmap = pm; R.projs = projs;
}
function guestEvent(e) {
  const R = run;
  switch (e[0]) {
    case 'n':
      if (!save.nums) break;
      if (R.nums.length > 90) R.nums.shift();
      R.nums.push({ x: e[1] + rand(-3, 3), y: e[2], v: e[3], t: 0, crit: !!e[4] });
      break;
    case 'k': {
      const type = ENEMY_KEYS[e[3]];
      if (type) killParts(e[1], e[2], type, e[4] === 2, e[4] === 1);
      break;
    }
    case 'f': R.fx.push(Object.assign({}, e[1], { t: 0 })); break;
    case 's': if (sfx[e[1]]) sfx[e[1]](); break;
    case 'b': R.banner = { text: String(e[1]), color: e[2], t: e[3], dur: e[3] }; break;
  }
}
function guestUpdate(dt) {
  const R = run, P = R.me;
  const live = performance.now() - NET.lastSnap < 1000;
  const running = NET.hostRun && live && state !== 'result';
  P.vw = view.vw; P.vh = view.vh;
  if (running && state === 'play' && !P.down && !P.gone) { const [mx, my] = moveVec(); steer(P, mx, my, dt); }
  else P.moving = false;
  // smooth everything else toward the host's positions
  const k = Math.min(1, dt * 18);
  const step = o => {
    if (running) { o.tx += o.vx * dt; o.ty += o.vy * dt; }
    o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
  };
  const frozen = R.freezeT > 0;
  for (const e of R.enemies) {
    step(e);
    if (running && (!frozen || e.type === 'reaper')) e.anim += dt;
    if (e.flash > 0) e.flash -= dt;
  }
  for (const p of R.projs) {
    step(p);
    if (running && SPINNERS[p.kind]) p.rot += SPINNERS[p.kind] * dt;
  }
  for (const p of R.players) if (p !== P) { step(p); if (p.moving && running) p.anim += dt; }
  if (R.flashT > 0) R.flashT -= dt;
  R.shake = Math.max(0, R.shake - dt * 12);
  if (R.banner && (R.banner.t -= dt) <= 0) R.banner = null;
  for (const p of R.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
  R.parts = R.parts.filter(p => p.t < p.life);
  for (const n of R.nums) n.t += dt;
  R.nums = R.nums.filter(n => n.t < 0.6);
  for (const f of R.fx) f.t += dt;
  R.fx = R.fx.filter(f => f.t < f.life);
  // report our position to the host
  NET.inT += dt;
  if (NET.inT >= 0.033 && state !== 'result') {
    NET.inT = 0;
    netSend({ t: 'in', x: r1(P.x), y: r1(P.y), fx: r1(P.fx), fy: r1(P.fy), fc: P.faceX, mv: P.moving ? 1 : 0, vw: Math.round(view.vw), vh: Math.round(view.vh) });
  }
}

// ============================================================
// hooks into the game loop
// ============================================================
hooks.holding = () => NET.role === 'host' && NET.inGame && !!run && run.players.some(p => p.ctrl === 'remote' && !p.gone && p.busy);
hooks.tick = dt => { if (NET.role === 'host') hostTick(dt); };
hooks.holdText = () => {
  if (!NET.role || !run || state !== 'play') return '';
  if (NET.role === 'host') {
    const G = remoteP();
    if (!NET.inGame || !G || G.gone || !G.busy) return '';
    return G.busy === 'lv' ? '동료가 레벨업 보상을 고르는 중…' : G.busy === 'chest' ? '동료가 보물상자를 여는 중…' : '동료가 일시정지했어요';
  }
  if (!NET.inGame) return '';
  if (performance.now() - NET.lastSnap > 1500) return '연결 대기 중…';
  if (NET.hostRun) return '';
  const h = NET.hostHold;
  return h === 'levelup' ? '동료가 레벨업 보상을 고르는 중…' : h === 'chest' ? '동료가 보물상자를 여는 중…' : h === 'pause' ? '동료가 일시정지했어요' : '';
};

// sounds: on the host, personal sounds (gems, coins, hurt…) only play for whoever triggered them;
// everything else is also forwarded to the guest
const PERSONAL_SFX = new Set(['gem', 'coin', 'pick', 'hurt', 'chest', 'level']);
const sfxSent = new Set();
for (const k of Object.keys(sfx)) {
  const f = sfx[k];
  sfx[k] = () => {
    if (NETQ.on && run && run.players) {
      const mine = run.player === run.me, personal = PERSONAL_SFX.has(k);
      if (k !== 'click' && (!personal || !mine) && !sfxSent.has(k)) { sfxSent.add(k); netEv(['s', k]); }
      if (personal && !mine) return;
    }
    f();
  };
}
