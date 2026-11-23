'use strict';
// ============================================================
// utils
// ============================================================
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const $ = id => document.getElementById(id);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SIM = /[?&]sim=1/.test(location.search);

// ============================================================
// save data
// ============================================================
const SAVE_KEY = 'starfall-survivors-v1';
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* ignore */ }
  const d = { gold: 0, power: {}, chars: { knight: true, mage: true, rogue: true }, best: {}, clears: {}, sound: true, nums: true, vibe: true, runs: 0, kills: 0, lastChar: 'knight' };
  return Object.assign(d, s || {});
}
let save = loadSave();
function persist() { if (SIM) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ============================================================
// pixel sprites
// ============================================================
const BASE_PAL = { k: '#1b1424', s: '#f2c29b', e: '#1b1424', w: '#ffffff', b: '#4a3020' };
const TINTS = { W: '#ffffff', R: '#ff3a3a', B: 'rgba(110,200,255,0.55)', D: '#000000' };
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function makeSprite(rows, pal) {
  pal = Object.assign({}, BASE_PAL, pal);
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = makeCanvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    if (ch === '.' || ch === ' ') continue;
    x.fillStyle = pal[ch] || '#ff00ff';
    x.fillRect(i, j, 1, 1);
  }
  return { c, w, h, cache: {} };
}
// cached flipped / tinted versions: key = tint letters + optional 'f'
function variant(spr, key) {
  let v = spr.cache[key];
  if (v) return v;
  const flip = key.includes('f'), tint = key.replace('f', '');
  const c = makeCanvas(spr.w, spr.h), x = c.getContext('2d');
  if (flip) { x.translate(spr.w, 0); x.scale(-1, 1); }
  x.drawImage(spr.c, 0, 0);
  if (tint) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = TINTS[tint];
    x.fillRect(0, 0, spr.w, spr.h);
  }
  return (spr.cache[key] = c);
}

const HUMAN_TOP = [
  '....kkkk....',
  '..kkhhhhkk..',
  '.khhhhhhhhk.',
  '.khhhhhhhhk.',
  '.khsssssshk.',
  '.kseesseesk.',
  '..kssssssk..',
  '...kkaakk...',
  '..kccaacck..',
  '.kcccaaccck.',
  '.ksccddccsk.',
  '.kkccddcckk.',
  '..kddddddk..',
];
const HUMAN_LEGS = [
  ['..kdk..kdk..', '..kbk..kbk..', '..kkk..kkk..'],
  ['...kdkkdk...', '...kbkkbk...', '...kkkkkk...'],
];
const humanFrames = pal => HUMAN_LEGS.map(l => makeSprite(HUMAN_TOP.concat(l), pal));

const R_BAT = [
  ['kk........kk', 'kpk.kkkk.kpk', 'kppkppppkppk', '.kppprrpppk.', '..kppppppk..', '...kpkkpk...', '....k..k....', '............'],
  ['............', '....kkkk....', '...kppppk...', '.kkpprrppkk.', 'kppppppppppk', 'kpk.kppk.kpk', 'kk...kk...kk', '............'],
];
const R_SLIME = ['............', '....kkkk....', '...kggggk...', '..kgwggggk..', '.kgwggggggk.', '.kggeggeggk.', 'kggggggggggk', 'kggggggggggk', '.kkkkkkkkkk.'];
const R_GHOST = ['....kkkk....', '..kkwwwwkk..', '.kwwwwwwwwk.', '.kweewweewk.', '.kwwwwwwwwk.', 'kwwwwoowwwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwkkwwkkwwk', '.kk..kk..kk.'];
const R_EYE = ['....kkkk....', '..kkwwwwkk..', '.kwwwwwwwwk.', '.kwwwwwwwwk.', 'kwwwiiiiwwwk', 'kwwiippiiwwk', 'kwwiippiiwwk', 'kwwwiiiiwwwk', '.kwwwwwwwwk.', '.krwwwwwwrk.', '..kkwwwwkk..', '....kkkk....'];
const R_BRUTE = ['..k........k..', '.kfk......kfk.', '.kffkkkkkkffk.', 'kffffffffffffk', 'kffrffffffrffk', 'kffffnnnnffffk', '.kffnwnnwnffk.', '..kffffffffk..', '.kffffnnffffk.', 'kfffkfnnfkfffk', 'kffk.fnnf.kffk', 'kwwk.ffff.kwwk', '.kk.kffffk.kk.', '....kfkkfk....', '...kfk..kfk...', '...kkk..kkk...'];
const R_FLOWER = ['....kkkk....', '..kkppppkk..', '.kpppyypppk.', 'kppyyyyyyppk', 'kpyykyykyypk', 'kpyyyyyyyypk', 'kppykkkkyppk', '.kpppyypppk.', '..kkppppkk..', '....kggk....', '..kggkgkggk.', '...kkkgkkk..', '.....kgk....', '....kkkkk...'];
const R_REAPER = ['....kkkkkk....', '...kcccccck...', '..kcccccccck..', '..kckkkkkkck..', '..kckrkkrkck..', '..kckkkkkkck..', '.kcccckkcccck.', 'kcccccccccccck', 'kccdcccccdccck', 'kcdccccccccdck', 'kcccccccccccck', '.kccccccccccck', '.kcccccccccck.', '.kcdcccccdcck.', '..kcccccccck..', '..kcdccccdck..', '...kckcckck...', '....k.kk.k....'];

const R_GEM = ['..kk..', '.kwgk.', 'kwgggk', 'kgggdk', 'kggddk', '.kgdk.', '..kk..'];
const R_COIN = ['..kkk..', '.kywyk.', 'kywyyyk', 'kyyyydk', 'kyyyddk', '.kyddk.', '..kkk..'];
const R_CHICKEN = ['....kkkkk..', '...kmmmmmk.', '..kmwmmmmmk', '..kmmmmmmmk', 'kk.kmmmmmdk', 'kwk.kmmmddk', 'kwwkkkdddk.', '.kk...kkk..'];
const R_MAGNET = ['.kkkkkkk.', 'krrrrbbbk', 'krrk.kbbk', 'krrk.kbbk', 'kwwk.kwwk', 'kwwk.kwwk', '.kk...kk.'];
const R_BOMB = ['......yy.', '.....k...', '...kkkk..', '..knnnnk.', '.knwnnnnk', '.knnnnnnk', '.knnnnnnk', '..knnnnk.', '...kkkk..'];
const R_ICE = ['...k...', '..kck..', '.kcwck.', 'kccwcck', 'kcccwck', '.kccck.', '.kccck.', '..kck..', '...k...'];
const R_CHEST = ['..kkkkkkkk..', '.kbbbbbbbbk.', 'kbbbbbbbbbbk', 'kyyyyyyyyyyk', 'kbbbkyykbbbk', 'kbbbbkkbbbbk', 'kbbbbbbbbbbk', 'kyyyyyyyyyyk', 'kbbbbbbbbbbk', '.kkkkkkkkkk.'];
const R_BRAZIER = ['kkkkkkkk', 'kyywyyyk', '.kyyyyk.', '..kddk..', '...kk...', '...kk...', '...kk...', '..kddk..', '.kddddk.', 'kkkkkkkk'];
const R_TOMB = ['..kkkk..', '.kgggwk.', 'kgggkggk', 'kggkkkgk', 'kgggkggk', 'kgggkggk', 'kggggggk', 'kggggggk', 'kkkkkkkk'];
const R_BUSH = ['...kkk.kk...', '.kkgggkggk..', 'kgggwgggggk.', 'kggggggwggk.', 'kgggggggggk.', '.kkgggggkkk.'];

// 10x10 icons
const ICON_ROWS = {
  blade: ['........kk', '.......kwk', '......kwk.', '.....kwk..', '....kwk...', 'k..kwk....', 'kykwk.....', '.kyk......', 'kykyk.....', 'kk.kk.....'],
  bolt: ['....kk....', '...kyyk...', 'kkkyyyykkk', 'kyyyyyyyyk', '.kyyyyyyk.', '..kyyyyk..', '.kyyyyyyk.', '.kyykkyyk.', 'kyyk..kyyk', 'kkk....kkk'],
  dagger: ['......kkk.', '.....kwwk.', '....kwwk..', '...kwwk...', '..kwwk....', '.kkkk.....', 'kyyk......', 'kyk.......', 'kk........', '..........'],
  axe: ['.kkk..kkk.', 'kwwwkkwwwk', 'kwwwwwwwwk', 'kwwwkkwwwk', '.kkkbbkkk.', '....kbk...', '....kbk...', '....kbk...', '....kbk...', '....kkk...'],
  aura: ['...kkkk...', '.kkyyyykk.', '.kyk..kyk.', 'kyk....kyk', 'kyk.kk.kyk', 'kyk.kk.kyk', 'kyk....kyk', '.kyk..kyk.', '.kkyyyykk.', '...kkkk...'],
  runes: ['...kkkk...', '..kccwck..', '.kcccwwck.', 'kcccccccck', 'kcccccccdk', 'kccccccddk', '.kccccddk.', '..kcdddk..', '...kkkk...', '..........'],
  thunder: ['....kkkk..', '...kyyyk..', '..kyyyk...', '.kyyyk....', 'kyyyykkkk.', 'kkkyyyyyk.', '...kyyyk..', '..kyyk....', '.kyk......', '.kk.......'],
  flask: ['...kkkk...', '....kk....', '...kggk...', '...kggk...', '..kggggk..', '.kgoooogk.', 'kgoooooogk', 'kgoooooogk', '.kgoooogk.', '..kkkkkk..'],
  cross: ['...kkkk...', '...kwwk...', '...kwwk...', 'kkkkwwkkkk', 'kwwwwwwwwk', 'kwwwwwwwwk', 'kkkkwwkkkk', '...kwwk...', '...kwwk...', '...kkkk...'],
  might: ['..kkkkkk..', '.krrwrrrk.', 'krrwrrrrrk', 'krrrrrrrdk', '.krrrrrdk.', '..krrrdk..', '...krdk...', '....kk....', '..........', '..........'],
  armor: ['kkkkkkkkkk', 'kswsssssdk', 'kswssyssdk', 'ksssyyysdk', 'kssssyssdk', '.kssssssk.', '.kssssdsk.', '..kssdsk..', '...kssk...', '....kk....'],
  maxhp: ['.kkk..kkk.', 'krrrkkrrrk', 'krwrrrrrrk', 'krrrrrrrrk', '.krrrrrrk.', '..krrrrk..', '...krrk...', '....kk....', '..........', '..........'],
  recovery: ['......kkk.', '....kkgggk', '...kgggggk', '..kggwgggk', '.kgggwggk.', '.kggwggk..', 'kggwkkk...', 'kgwk......', 'kwk.......', 'kk........'],
  cooldown: ['kkkkkkkkkk', '.kyyyyyyk.', '..kyyyyk..', '...kyyk...', '....kk....', '...kwwk...', '..kwwwwk..', '.kwyyyywk.', '.kyyyyyyk.', 'kkkkkkkkkk'],
  area: ['..kkkk....', '.kccwck...', 'kccwccck..', 'kcccccck..', 'kcccccck..', '.kccccck..', '..kkkkkbk.', '.......kbk', '........kk', '..........'],
  speed: ['.......kk.', '......kwwk', '.....kwwwk', '....kwwwk.', '...kwwwk..', '..kwwwk...', '.kwwwk....', '.kwk......', 'kk........', '..........'],
  duration: ['....kk....', '...kyyk...', '...kyok...', '....kk....', '...kwwk...', '...kwwk...', '...kwwk...', '...kwwk...', '.kkkkkkkk.', '.kddddddk.'],
  amount: ['.kkk..kkk.', 'kcwk..kcwk', 'kcck..kcck', 'kcck..kcck', 'kcck..kcck', '.kk....kk.', '..k....k..', '.kkk..kkk.', '..........', '..........'],
  move: ['..kkkk....', '..kbbk....', '..kbbk....', '..kbbk....', '..kbbkkk..', '.kbbbbbbk.', 'kbbbbbbbbk', 'kkkkkkkkkk', '..........', '..........'],
  luck: ['.kkk.kkk..', 'kgggkgggk.', 'kgggggggk.', '.kgggggk..', 'kgggggggk.', 'kgggkgggk.', '.kkkgkkk..', '....kgk...', '.....kgk..', '......kk..'],
  growth: ['..........', 'k...kk...k', 'kk.kyyk.kk', 'kykyyyykyk', 'kyyyyyyyyk', 'kyryyyyryk', 'kyyyyyyyyk', 'kkkkkkkkkk', '..........', '..........'],
  reroll: ['kkkkkkkkkk', 'kwwwwwwwwk', 'kwkkwwwwwk', 'kwkkwwwwwk', 'kwwwkkwwwk', 'kwwwkkwwwk', 'kwwwwwkkwk', 'kwwwwwkkwk', 'kwwwwwwwwk', 'kkkkkkkkkk'],
  skip: ['..........', 'k...k.....', 'kk..kk....', 'kyk.kyk...', 'kyykkyyk..', 'kyykkyyk..', 'kyk.kyk...', 'kk..kk....', 'k...k.....', '..........'],
};
const ICON_PAL = {
  blade: [{ w: '#e0e8f0', y: '#c08030' }, { w: '#ff6a78', y: '#5a1020' }],
  bolt: [{ y: '#b070ff' }, { y: '#ff78e8' }],
  dagger: [{ w: '#d0d8e0', y: '#3a8a4a' }, { w: '#80f0ff', y: '#2050a0' }],
  axe: [{ w: '#c0c8d0', b: '#8a5a2a' }, { w: '#b080e0', b: '#402060' }],
  aura: [{ y: '#ffe080' }, { y: '#ff5080' }],
  runes: [{ c: '#50d0c0', w: '#e0fff8', d: '#208080' }, { c: '#d060ff', w: '#ffe0ff', d: '#702090' }],
  thunder: [{ y: '#ffe040' }, { y: '#80e8ff' }],
  flask: [{ g: '#c0e0f0', o: '#ff6030' }, { g: '#c0e0f0', o: '#9050ff' }],
  cross: [{ w: '#f0d060' }, { w: '#ffffff' }],
  might: [{ r: '#e03040', d: '#901020' }], armor: [{ s: '#8090a8', d: '#5a6478', y: '#f0d060' }],
  maxhp: [{ r: '#e03040' }], recovery: [{ g: '#40b060', w: '#a0f0a0' }], cooldown: [{ y: '#f0c060', w: '#c8e0f0' }],
  area: [{ c: '#80c0ff', b: '#8a5a2a' }], speed: [{ w: '#e0f0ff' }], duration: [{ y: '#ffe040', o: '#ff8020', w: '#f0e8d0', d: '#8a6a40' }],
  amount: [{ c: '#a0d8ff' }], move: [{ b: '#9a6a3a' }], luck: [{ g: '#40c060' }], growth: [{ y: '#ffd040', r: '#e03040' }],
  reroll: [{ w: '#f0f0f0' }], skip: [{ y: '#80c0ff' }],
};
const ICONS = {};
for (const id in ICON_ROWS) ICONS[id] = ICON_PAL[id].map(p => makeSprite(ICON_ROWS[id], p));

const SPR = {
  bat: R_BAT.map(r => makeSprite(r, { p: '#7a48b8', r: '#ff4040' })),
  slime: [makeSprite(R_SLIME, { g: '#4ccf5a', w: '#b8ffc0', e: '#123018' })],
  ghost: [makeSprite(R_GHOST, { w: '#e8f0ff', e: '#203050', o: '#405080' })],
  eye: [makeSprite(R_EYE, { w: '#f0e8e0', i: '#40a0ff', p: '#101020', r: '#d04040' })],
  brute: [makeSprite(R_BRUTE, { f: '#7a5a3a', n: '#b89a72', r: '#ffdd33', w: '#f0f0f0' })],
  golem: [makeSprite(R_BRUTE, { f: '#6e6e80', n: '#a8a8b8', r: '#40e8ff', w: '#d8d8e8' })],
  flower: [makeSprite(R_FLOWER, { p: '#e05080', y: '#ffd040', g: '#3a9a40' })],
  reaper: [makeSprite(R_REAPER, { k: '#000000', c: '#1c1a2c', d: '#34324c', r: '#ff2020' })],
  zombie: humanFrames({ h: '#3f5f34', s: '#8fbf6a', e: '#401010', c: '#6b5a8a', d: '#4a3d62', a: '#8fbf6a', b: '#3a2a1a' }),
  skeleton: humanFrames({ h: '#e8e4d0', s: '#e8e4d0', e: '#222222', c: '#d0ccb8', d: '#a8a490', a: '#e8e4d0', b: '#a8a490' }),
  mummy: humanFrames({ h: '#d8c8a0', s: '#d8c8a0', e: '#ff5030', c: '#c8b890', d: '#a89870', a: '#8a7a5a', b: '#8a7a5a' }),
  dknight: humanFrames({ h: '#3a3a4c', s: '#3a3a4c', e: '#ff3030', c: '#4a4a60', d: '#2a2a3a', a: '#a02030', b: '#1a1a24' }),
};
const ITEM = {
  gem: [makeSprite(R_GEM, { w: '#d8ecff', g: '#4fa3ff', d: '#2a5fd0' }), makeSprite(R_GEM, { w: '#d8ffe0', g: '#4ad86a', d: '#228a40' }), makeSprite(R_GEM, { w: '#ffd8d8', g: '#ff5050', d: '#b02020' })],
  coin: makeSprite(R_COIN, { y: '#ffd040', w: '#fff6c0', d: '#c08020' }),
  bag: makeSprite(R_COIN, { y: '#ff9a30', w: '#ffe0a0', d: '#b05010' }),
  chicken: makeSprite(R_CHICKEN, { m: '#d07a3a', w: '#f8f0e0', d: '#a0502a' }),
  magnet: makeSprite(R_MAGNET, { r: '#e03030', b: '#3060e0', w: '#e0e0e0' }),
  bomb: makeSprite(R_BOMB, { n: '#3a3a50', y: '#ffd040', w: '#9090b0' }),
  ice: makeSprite(R_ICE, { c: '#80e0ff', w: '#ffffff' }),
  chest: makeSprite(R_CHEST, { b: '#8a4a20', y: '#ffd040' }),
  brazier: makeSprite(R_BRAZIER, { y: '#c08040', w: '#f0c080', d: '#6a4a30' }),
  tomb: makeSprite(R_TOMB, { g: '#6e6e80', w: '#9a9aaa' }),
  bush: makeSprite(R_BUSH, { g: '#2f6a32', w: '#4a8a4a' }),
};

// ============================================================
// game data
// ============================================================
const CHARS = [
  { id: 'knight', name: '레온', title: '방패 기사', weapon: 'blade', hp: 120, bonus: { armor: 1 }, desc: '방어 +1 · 체력 120', cost: 0, pal: { h: '#a8b2c4', c: '#3a64c8', d: '#253f85', a: '#f2c94c' } },
  { id: 'mage', name: '미라', title: '견습 마법사', weapon: 'bolt', hp: 90, bonus: { cooldown: -0.1 }, desc: '쿨다운 -10% · 체력 90', cost: 0, pal: { h: '#7b3fbf', c: '#8e4fd6', d: '#5a2c96', a: '#f2c94c' } },
  { id: 'rogue', name: '카이', title: '그림자 도적', weapon: 'dagger', hp: 90, bonus: { move: 0.2 }, desc: '이동속도 +20% · 체력 90', cost: 0, pal: { h: '#2f2f3a', c: '#3c8c4a', d: '#24572e', a: '#c0a060' } },
  { id: 'priest', name: '셀린', title: '새벽의 사제', weapon: 'aura', hp: 110, bonus: { recovery: 0.4 }, desc: '초당 회복 +0.4 · 체력 110', cost: 600, pal: { h: '#f4e2a8', c: '#eeeeee', d: '#b0bcd2', a: '#e0b040' } },
  { id: 'dwarf', name: '브론', title: '광산 전사', weapon: 'axe', hp: 130, bonus: { might: 0.2, move: -0.1 }, desc: '공격력 +20% · 이동 -10%', cost: 1000, pal: { h: '#c8641e', c: '#8a5a2b', d: '#5c3a1a', a: '#c0c0c0' } },
  { id: 'shaman', name: '루나', title: '폭풍 주술사', weapon: 'thunder', hp: 100, bonus: { luck: 0.2 }, desc: '행운 +20% · 체력 100', cost: 1500, pal: { h: '#3fb7d9', c: '#2a4a8a', d: '#18305a', a: '#ffe14a' } },
  { id: 'alchemist', name: '피오', title: '떠돌이 연금술사', weapon: 'flask', hp: 100, bonus: { area: 0.1 }, desc: '범위 +10% · 체력 100', cost: 2200, pal: { h: '#5a321e', c: '#b04a3a', d: '#6e2a22', a: '#50c878' } },
  { id: 'paladin', name: '에린', title: '성기사', weapon: 'cross', hp: 115, bonus: { speed: 0.15 }, desc: '투사체 속도 +15%', cost: 3000, pal: { h: '#e8e8f0', c: '#c8a040', d: '#8a6a20', a: '#ffffff' } },
  { id: 'scholar', name: '오르', title: '룬 학자', weapon: 'runes', hp: 95, bonus: { duration: 0.15 }, desc: '지속시간 +15% · 체력 95', cost: 4000, pal: { h: '#b8b8c8', c: '#2f7f7f', d: '#1d5050', a: '#e0d070' } },
];
const CHAR_SPR = {};
for (const c of CHARS) CHAR_SPR[c.id] = humanFrames(c.pal);

const PASSIVES = {
  might: { name: '힘의 부적', max: 5, desc: '공격력 +10%' },
  armor: { name: '강철 망토', max: 5, desc: '받는 피해 -1' },
  maxhp: { name: '거인의 심장', max: 5, desc: '최대 체력 +20%' },
  recovery: { name: '재생의 이끼', max: 5, desc: '초당 체력 회복 +0.2' },
  cooldown: { name: '시간의 모래시계', max: 5, desc: '쿨다운 -8%' },
  area: { name: '확장 렌즈', max: 5, desc: '공격 범위 +10%' },
  speed: { name: '바람 깃털', max: 5, desc: '투사체 속도 +10%' },
  duration: { name: '영원의 촛불', max: 5, desc: '지속시간 +10%' },
  amount: { name: '쌍둥이 거울', max: 2, desc: '투사체 수 +1' },
  move: { name: '가죽 장화', max: 5, desc: '이동속도 +10%' },
  magnet: { name: '자석 반지', max: 5, desc: '아이템 획득 범위 +30%' },
  luck: { name: '네잎클로버', max: 5, desc: '행운 +10%' },
  growth: { name: '현자의 왕관', max: 5, desc: '경험치 획득 +8%' },
};

// levels[i] is the upgrade applied when going from level i+1 to i+2
const WEAPONS = {
  blade: { name: '검기', desc: '앞뒤로 넓게 베어요. 레벨이 오를수록 강해져요.', evoName: '핏빛 초승달', evoWith: 'maxhp', evoDesc: '거대한 베기. 치명타가 터지고 적을 벨 때마다 체력을 흡수해요.',
    base: { dmg: 10, cd: 1.35, area: 1, amount: 2 },
    levels: [{ dmg: 3, area: 0.1 }, { dmg: 5 }, { dmg: 5, area: 0.1 }, { dmg: 5 }, { dmg: 5, area: 0.1 }, { dmg: 5 }, { dmg: 5 }],
    evo: { dmg: 15, area: 0.35 } },
  bolt: { name: '마력탄', desc: '가장 가까운 적에게 마력탄을 쏴요.', evoName: '아케인 폭풍', evoWith: 'cooldown', evoDesc: '쉬지 않고 쏟아지는 관통 마력탄.',
    base: { dmg: 10, cd: 1.2, amount: 1, speed: 170, pierce: 1 },
    levels: [{ amount: 1 }, { cd: -0.2 }, { amount: 1 }, { dmg: 10 }, { amount: 1 }, { pierce: 1 }, { dmg: 10 }],
    evo: { cd: -0.65, pierce: 2, dmg: 5 } },
  dagger: { name: '투척 단검', desc: '이동하는 방향으로 단검을 던져요.', evoName: '천 개의 칼날', evoWith: 'speed', evoDesc: '끝없이 쏟아지는 칼날의 비.',
    base: { dmg: 7, cd: 0.8, amount: 1, speed: 300, pierce: 1 },
    levels: [{ amount: 1 }, { amount: 1, dmg: 5 }, { amount: 1 }, { pierce: 1 }, { amount: 1 }, { amount: 1, dmg: 5 }, { pierce: 1 }],
    evo: { cd: -0.65, dmg: 3 } },
  axe: { name: '손도끼', desc: '위로 던져 포물선을 그리며 관통해요.', evoName: '죽음의 나선', evoWith: 'area', evoDesc: '사방으로 회전하는 낫을 날려 모든 적을 관통해요.',
    base: { dmg: 20, cd: 3, amount: 1, pierce: 3, area: 1 },
    levels: [{ amount: 1 }, { dmg: 20 }, { pierce: 2 }, { amount: 1 }, { dmg: 20 }, { pierce: 2 }, { dmg: 20 }],
    evo: { dmg: 20, cd: -0.5 } },
  aura: { name: '성스러운 기운', desc: '주변의 적에게 지속 피해를 줘요.', evoName: '영혼 포식자', evoWith: 'recovery', evoDesc: '범위가 크게 넓어지고 피해를 줄 때 체력을 회복해요.',
    base: { dmg: 6, cd: 1.2, area: 1 },
    levels: [{ area: 0.2, dmg: 2 }, { cd: -0.1, dmg: 1 }, { area: 0.2, dmg: 1 }, { cd: -0.1, dmg: 2 }, { area: 0.2, dmg: 1 }, { cd: -0.1, dmg: 1 }, { area: 0.2, dmg: 1 }],
    evo: { area: 0.4, dmg: 5 } },
  runes: { name: '수호 룬', desc: '주위를 도는 룬 구슬을 소환해요.', evoName: '영원의 룬', evoWith: 'duration', evoDesc: '룬이 사라지지 않고 영원히 회전해요.',
    base: { dmg: 10, cd: 3, dur: 3, amount: 2, speed: 1, area: 1 },
    levels: [{ amount: 1 }, { speed: 0.3, area: 0.25 }, { dur: 0.5, dmg: 10 }, { amount: 1 }, { speed: 0.3, area: 0.25 }, { dur: 0.5, dmg: 10 }, { amount: 1 }],
    evo: { dmg: 10 } },
  thunder: { name: '번개 부적', desc: '무작위 적에게 벼락을 떨어뜨려요.', evoName: '뇌신의 고리', evoWith: 'amount', evoDesc: '벼락이 두 번씩 내리치고 폭발 범위가 넓어져요.',
    base: { dmg: 15, cd: 4.5, amount: 2, area: 1 },
    levels: [{ amount: 1 }, { area: 0.5, dmg: 10 }, { amount: 1 }, { dmg: 20 }, { amount: 1 }, { area: 0.5, dmg: 20 }, { amount: 1 }],
    evo: { dmg: 10, cd: -0.5 } },
  flask: { name: '화염병', desc: '던진 자리에 불바다를 만들어요.', evoName: '지옥불 지대', evoWith: 'magnet', evoDesc: '거대한 불길이 적을 쫓아다니며 태워요.',
    base: { dmg: 5, cd: 4.5, amount: 1, dur: 2, area: 1 },
    levels: [{ amount: 1, area: 0.15 }, { dmg: 4, dur: 0.5 }, { area: 0.15, dur: 0.3 }, { dmg: 4, dur: 0.3 }, { amount: 1, area: 0.15 }, { dmg: 3, dur: 0.3 }, { dmg: 3, area: 0.15 }],
    evo: { dur: 2, area: 0.4, dmg: 6 } },
  cross: { name: '성십자', desc: '날아갔다 되돌아오는 십자가를 던져요.', evoName: '천상의 성검', evoWith: 'luck', evoDesc: '더 크고 강력해지며 치명타가 터져요.',
    base: { dmg: 10, cd: 2, amount: 1, speed: 1, area: 1 },
    levels: [{ dmg: 10 }, { amount: 1 }, { area: 0.1, speed: 0.25 }, { amount: 1 }, { dmg: 10 }, { area: 0.1, speed: 0.25 }, { dmg: 10 }],
    evo: { dmg: 10, area: 0.3 } },
};
const MAX_WLV = 8;

const POWERUPS = [
  { id: 'might', icon: 'might', name: '공격력', max: 5, cost: 200, per: '단계당 +5%' },
  { id: 'armor', icon: 'armor', name: '방어력', max: 3, cost: 600, per: '단계당 +1' },
  { id: 'maxhp', icon: 'maxhp', name: '최대 체력', max: 3, cost: 200, per: '단계당 +10' },
  { id: 'recovery', icon: 'recovery', name: '회복', max: 5, cost: 200, per: '단계당 초당 +0.1' },
  { id: 'cooldown', icon: 'cooldown', name: '쿨다운', max: 2, cost: 900, per: '단계당 -2.5%' },
  { id: 'area', icon: 'area', name: '범위', max: 2, cost: 300, per: '단계당 +5%' },
  { id: 'speed', icon: 'speed', name: '투사체 속도', max: 2, cost: 300, per: '단계당 +5%' },
  { id: 'duration', icon: 'duration', name: '지속시간', max: 2, cost: 300, per: '단계당 +5%' },
  { id: 'amount', icon: 'amount', name: '투사체 수', max: 1, cost: 5000, per: '+1' },
  { id: 'move', icon: 'move', name: '이동속도', max: 2, cost: 300, per: '단계당 +5%' },
  { id: 'magnet', icon: 'magnet', name: '획득 범위', max: 2, cost: 300, per: '단계당 +10%' },
  { id: 'luck', icon: 'luck', name: '행운', max: 3, cost: 600, per: '단계당 +10%' },
  { id: 'growth', icon: 'growth', name: '성장', max: 5, cost: 900, per: '단계당 경험치 +3%' },
  { id: 'greed', icon: 'coin', name: '탐욕', max: 5, cost: 200, per: '단계당 골드 +10%' },
  { id: 'revival', icon: 'maxhp', name: '부활', max: 1, cost: 10000, per: '쓰러져도 1회 부활' },
  { id: 'reroll', icon: 'reroll', name: '새로고침', max: 5, cost: 500, per: '단계당 +1회' },
  { id: 'skip', icon: 'skip', name: '건너뛰기', max: 5, cost: 200, per: '단계당 +1회' },
];

const ENEMIES = {
  bat: { hp: 4, spd: 50, dmg: 3, xp: 1, r: 5, spr: 'bat', kb: 1.2 },
  slime: { hp: 9, spd: 30, dmg: 4, xp: 1, r: 6, spr: 'slime', kb: 1 },
  zombie: { hp: 16, spd: 33, dmg: 6, xp: 2, r: 6, spr: 'zombie', kb: 1 },
  skeleton: { hp: 28, spd: 40, dmg: 8, xp: 2, r: 6, spr: 'skeleton', kb: 1 },
  ghost: { hp: 22, spd: 56, dmg: 7, xp: 2, r: 6, spr: 'ghost', kb: 1.2, alpha: 0.78 },
  eye: { hp: 45, spd: 46, dmg: 10, xp: 3, r: 6, spr: 'eye', kb: 0.9 },
  brute: { hp: 100, spd: 47, dmg: 13, xp: 4, r: 7, spr: 'brute', kb: 0.6 },
  mummy: { hp: 200, spd: 34, dmg: 16, xp: 5, r: 6, spr: 'mummy', kb: 0.5 },
  knight: { hp: 340, spd: 42, dmg: 20, xp: 7, r: 6, spr: 'dknight', kb: 0.4 },
  golem: { hp: 600, spd: 36, dmg: 25, xp: 10, r: 7, spr: 'golem', kb: 0.2 },
  flower: { hp: 50, spd: 6, dmg: 8, xp: 2, r: 6, spr: 'flower', kb: 0 },
  reaper: { hp: 6.66e7, spd: 150, dmg: 999, xp: 0, r: 7, spr: 'reaper', kb: 0 },
};

const WAVES = [
  { types: ['bat', 'slime'], min: 10, iv: 2.0, batch: 1 },
  { types: ['bat', 'slime', 'zombie'], min: 18, iv: 1.5, batch: 2 },
  { types: ['zombie', 'bat'], min: 28, iv: 1.2, batch: 2 },
  { types: ['zombie', 'skeleton'], min: 38, iv: 1.1, batch: 3 },
  { types: ['skeleton', 'ghost', 'zombie'], min: 46, iv: 1.0, batch: 3 },
  { types: ['skeleton', 'ghost'], min: 55, iv: 0.9, batch: 4 },
  { types: ['ghost', 'eye'], min: 65, iv: 0.85, batch: 4 },
  { types: ['eye', 'brute'], min: 70, iv: 0.8, batch: 4 },
  { types: ['skeleton', 'eye', 'brute'], min: 80, iv: 0.8, batch: 5 },
  { types: ['brute', 'mummy'], min: 85, iv: 0.75, batch: 5 },
  { types: ['eye', 'mummy'], min: 90, iv: 0.75, batch: 5 },
  { types: ['ghost', 'brute', 'mummy'], min: 100, iv: 0.7, batch: 5 },
  { types: ['mummy', 'knight'], min: 110, iv: 0.7, batch: 6 },
  { types: ['eye', 'brute', 'knight'], min: 120, iv: 0.65, batch: 6 },
  { types: ['mummy', 'knight'], min: 130, iv: 0.65, batch: 6 },
  { types: ['brute', 'knight'], min: 135, iv: 0.6, batch: 6 },
  { types: ['eye', 'mummy', 'knight'], min: 145, iv: 0.6, batch: 7 },
  { types: ['knight', 'golem'], min: 155, iv: 0.55, batch: 7 },
  { types: ['mummy', 'knight', 'golem'], min: 165, iv: 0.55, batch: 7 },
  { types: ['knight', 'golem'], min: 180, iv: 0.5, batch: 8 },
];
const EVENTS = [
  { t: 150, type: 'swarm', enemy: 'bat', n: 40, text: '박쥐 떼가 몰려온다!' },
  { t: 300, type: 'boss', enemy: 'brute', hp: 2500, name: '거대 늑대인간' },
  { t: 420, type: 'ring', enemy: 'flower', n: 36, text: '식인꽃에 포위당했다!' },
  { t: 480, type: 'swarm', enemy: 'bat', n: 60, text: '박쥐 떼가 몰려온다!' },
  { t: 600, type: 'boss', enemy: 'mummy', hp: 9000, name: '고대 파라오' },
  { t: 780, type: 'swarm', enemy: 'ghost', n: 50, text: '유령의 행렬!' },
  { t: 900, type: 'boss', enemy: 'knight', hp: 22000, name: '타락한 기사단장' },
  { t: 960, type: 'ring', enemy: 'flower', n: 48, text: '식인꽃에 포위당했다!' },
  { t: 1080, type: 'swarm', enemy: 'ghost', n: 70, text: '유령의 행렬!' },
  { t: 1200, type: 'reaper' },
];
const RUN_END = 1200;
const MAX_ENEMIES = 360;
