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
  const d = { gold: 0, power: {}, chars: { knight: true, mage: true, rogue: true }, best: {}, clears: {}, stages: {}, stage: 0, sound: true, nums: true, vibe: true, runs: 0, kills: 0, lastChar: 'knight' };
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

// new monsters for the themed stages
const R_SPIDER = [
  ['.k..kkkk..k.', 'k.kkppppkk.k', '..kpwppwpk..', 'kkkprpprpkkk', '..kppppppk..', '.kkkppppkkk.', 'k..kkkkkk..k', '.k..k..k..k.'],
  ['k...kkkk...k', '.kkkppppkkk.', '..kpwppwpk..', '.kkprpprpkk.', 'k.kppppppk.k', '..kkppppkk..', '.k.kkkkkk.k.', 'k..k....k..k'],
];
const R_SCORPION = ['........kkk.', '.......kyryk', '........kyk.', '.kk.....kyk.', 'kyyk...kyyk.', 'kyk.kkkyyk..', '.kkkyyyyyk..', '..kyeyyeyk..', '.kykkykkyyk.', '.k.k.k.k.k..'];
const R_IMP = [
  ['.k........k.', 'kwk......kwk', '.kwkkkkkkwk.', 'k.krrrrrrk.k', 'kkrryrryrrkk', 'kdkrrrrrrkdk', 'kddkrkkrkddk', '.kdkrrrrkdk.', '..kkrrrrkk..', '...krkkrk...', '...kk..kk...'],
  ['.k........k.', '.kwk....kwk.', '..kwkkkkwk..', '.kkrrrrrrkk.', 'kdrryrryrrdk', 'kddkrrrrkddk', '.kdkrkkrkdk.', '..kkrrrrkk..', '..kkrrrrkk..', '...krkkrk...', '...kk..kk...'],
];
const R_MUSH = ['....kkkk....', '..kkmmwmkk..', '.kmwmmmmmmk.', 'kmmmmwmmwmmk', 'kmwmmmmmmmmk', '.kkkkkkkkkk.', '..kssssssk..', '..kseesesk..', '..kssssssk..', '..kssssssk..', '...kskksk...', '...kk..kk...'];

// sprite sources: rows (one entry per animation frame) + default palette; stage variants recolour these
const SPR_SRC = {
  bat: [R_BAT, { p: '#7a48b8', r: '#ff4040' }],
  slime: [[R_SLIME], { g: '#4ccf5a', w: '#b8ffc0', e: '#123018' }],
  ghost: [[R_GHOST], { w: '#e8f0ff', e: '#203050', o: '#405080' }],
  eye: [[R_EYE], { w: '#f0e8e0', i: '#40a0ff', p: '#101020', r: '#d04040' }],
  brute: [[R_BRUTE], { f: '#7a5a3a', n: '#b89a72', r: '#ffdd33', w: '#f0f0f0' }],
  golem: [[R_BRUTE], { f: '#6e6e80', n: '#a8a8b8', r: '#40e8ff', w: '#d8d8e8' }],
  flower: [[R_FLOWER], { p: '#e05080', y: '#ffd040', g: '#3a9a40' }],
  reaper: [[R_REAPER], { k: '#000000', c: '#1c1a2c', d: '#34324c', r: '#ff2020' }],
  zombie: ['human', { h: '#3f5f34', s: '#8fbf6a', e: '#401010', c: '#6b5a8a', d: '#4a3d62', a: '#8fbf6a', b: '#3a2a1a' }],
  skeleton: ['human', { h: '#e8e4d0', s: '#e8e4d0', e: '#222222', c: '#d0ccb8', d: '#a8a490', a: '#e8e4d0', b: '#a8a490' }],
  mummy: ['human', { h: '#d8c8a0', s: '#d8c8a0', e: '#ff5030', c: '#c8b890', d: '#a89870', a: '#8a7a5a', b: '#8a7a5a' }],
  dknight: ['human', { h: '#3a3a4c', s: '#3a3a4c', e: '#ff3030', c: '#4a4a60', d: '#2a2a3a', a: '#a02030', b: '#1a1a24' }],
  spider: [R_SPIDER, { p: '#4a3a5a', r: '#ff4060', w: '#8a7aa0' }],
  scorpion: [[R_SCORPION], { y: '#c89040', r: '#ff4030', e: '#1b1424' }],
  imp: [R_IMP, { w: '#f0e0c0', r: '#d83a2a', y: '#ffe040', d: '#7a1a20' }],
  mushroom: [[R_MUSH], { m: '#d04040', w: '#f8f0e0', s: '#e8d8b8', e: '#1b1424' }],
};
const buildSpr = (src, pal) => src[0] === 'human' ? humanFrames(Object.assign({}, src[1], pal)) : src[0].map(r => makeSprite(r, Object.assign({}, src[1], pal)));
const SPR = {};
for (const k in SPR_SRC) SPR[k] = buildSpr(SPR_SRC[k]);
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

// ground decorations for the stage maps
const DECO = {
  tomb: ITEM.tomb, bush: ITEM.bush,
  shroom: makeSprite(['..kkkk..', '.kmmwmk.', 'kmwmmmmk', 'kkkkkkkk', '..kssk..', '..kssk..', '..kkkk..'], { m: '#40c0a0', w: '#c0fff0', s: '#d8e8d0' }),
  web: makeSprite(['k...k...k', '.k..k..k.', '..kkkkk..', 'kkk.k.kkk', '..kkkkk..', '.k..k..k.', 'k...k...k'], { k: 'rgba(220,230,240,0.35)' }),
  cactus: makeSprite(['....kk....', '...kggk...', '...kgwk.k.', '.k.kggkkgk', 'kgkkggkggk', 'kggggggkk.', '.kkkggk...', '...kggk...', '...kggk...', '..kkkkkk..'], { g: '#4a9a50', w: '#8ad080' }),
  bones: makeSprite(['k.......k', 'wk.....kw', '.wwwwwww.', 'wk.....kw', 'k.......k'], { w: '#e8e0c8', k: '#a89a80' }),
  pine: makeSprite(['....kk....', '...kggk...', '..kgwggk..', '...kggk...', '..kgggwk..', '.kgwggggk.', '..kggggk..', '.kgggggwk.', 'kggwggggk.', 'kkkkbbkkkk', '....bb....', '....bb....'], { g: '#3a6a5a', w: '#f0f8ff', b: '#5a3a2a' }),
  icerock: makeSprite(['...kkk...', '..kcwck..', '.kccwcck.', 'kccccccdk', 'kcccccddk', '.kkkkkkk.'], { c: '#90c8f0', w: '#f0ffff', d: '#5a8ab8' }),
  deadtree: makeSprite(['k...k..k..', '.k..k.k...', '..k.kk..k.', '...kbk.k..', '....kbk...', '....kbk...', '....kbk...', '...kbbbk..', '..kkkkkkk.'], { b: '#4a4040', k: '#2a2424' }),
  puddle: makeSprite(['..kkkkkk..', '.kppwpppk.', 'kppppppwpk', '.kppppppk.', '..kkkkkk..'], { p: '#4a6a40', w: '#8ab070', k: '#2a3a20' }),
  reed: makeSprite(['.b...b.', '.b..bb.', 'bb..g..', '.g..g.b', '.g.g..g', '.g.g.g.', '..gg.g.', '..ggg..'], { b: '#6a4a2a', g: '#5a7a3a' }),
  crystal: makeSprite(['....k....', '...kwk...', '..kcwck.k', '..kccckwk', 'k.kccckck', 'kwkccdkck', 'kckccdkdk', 'kkkkkkkkk'], { c: '#9070e0', w: '#e0d0ff', d: '#5040a0' }),
  lava: makeSprite(['..kkk.....', '.krryk.kk.', 'kryyrrkrrk', '.krrrryyrk', '..kkrrrrk.', '....kkkk..'], { r: '#ff5010', y: '#ffd040', k: '#1a0e0c' }),
  pillar: makeSprite(['kkkkkkkk', 'kwssssdk', '.kssssk.', '.kwssdk.', '.kwssdk.', '.kwssdk.', '.kwssdk.', '.kwssdk.', 'kwssssdk', 'kkkkkkkk'], { s: '#9a968e', w: '#c8c4bc', d: '#6a665e' }),
  star: makeSprite(['..w..', '..w..', 'wwyww', '..w..', '..w..'], { w: 'rgba(200,180,255,0.7)', y: '#ffffff' }),
};

// ============================================================
// game data
// ============================================================
const CHARS = [
  { id: 'knight', name: '레온', title: '방패 기사', weapon: 'blade', hp: 120, bonus: { armor: 1 }, desc: '방어 +1 · 체력 120', cost: 0 },
  { id: 'mage', name: '미라', title: '견습 마법사', weapon: 'bolt', hp: 90, bonus: { cooldown: -0.1 }, desc: '쿨다운 -10% · 체력 90', cost: 0 },
  { id: 'rogue', name: '카이', title: '그림자 도적', weapon: 'dagger', hp: 90, bonus: { move: 0.2 }, desc: '이동속도 +20% · 체력 90', cost: 0 },
  { id: 'priest', name: '셀린', title: '새벽의 사제', weapon: 'aura', hp: 110, bonus: { recovery: 0.4 }, desc: '초당 회복 +0.4 · 체력 110', cost: 600 },
  { id: 'dwarf', name: '브론', title: '광산 전사', weapon: 'axe', hp: 130, bonus: { might: 0.2, move: -0.1 }, desc: '공격력 +20% · 이동 -10%', cost: 1000 },
  { id: 'shaman', name: '루나', title: '폭풍 주술사', weapon: 'thunder', hp: 100, bonus: { luck: 0.2 }, desc: '행운 +20% · 체력 100', cost: 1500 },
  { id: 'alchemist', name: '피오', title: '떠돌이 연금술사', weapon: 'flask', hp: 100, bonus: { area: 0.1 }, desc: '범위 +10% · 체력 100', cost: 2200 },
  { id: 'paladin', name: '에린', title: '성기사', weapon: 'cross', hp: 115, bonus: { speed: 0.15 }, desc: '투사체 속도 +15%', cost: 3000 },
  { id: 'scholar', name: '오르', title: '룬 학자', weapon: 'runes', hp: 95, bonus: { duration: 0.15 }, desc: '지속시간 +15% · 체력 95', cost: 4000 },
];
// hero sprites (14x16): every hero has their own silhouette — 13 rows of body + 3 rows of legs, 2 walk frames
const LEGS_PANTS = [
  ['...kdk..kdk...', '...kbk..kbk...', '...kkk..kkk...'],
  ['....kdkkdk....', '....kbkkbk....', '....kkkkkk....'],
];
const LEGS_ROBE = [
  ['..kddddddddk..', '..kddddddddk..', '...kbbk.kbbk..'],
  ['..kddddddddk..', '...kddddddk...', '....kbbkbbk...'],
];
const LEGS_SHORT = [
  ['..kdddk.kdddk.', '..kbbbk.kbbbk.', '..kkkkk.kkkkk.'],
  ['...kdddkdddk..', '...kbbbkbbbk..', '...kkkkkkkkk..'],
];
const HERO_TOP = {
  knight: [
    '......krk.....',
    '....kkkrkkk...',
    '...kmmmrmmmk..',
    '..kmwmmmmmmnk.',
    '..kmmmmmmmmnk.',
    '..kkekkkkekkk.',
    '...knmmmmmnk..',
    'kkkkkkaakkk...',
    'kcackmcaacmk..',
    'kaaakccaaccmk.',
    'kcackccddccmk.',
    '.kck.kcddcckk.',
    '..k..kddddddk.',
  ],
  mage: [
    '.......kk.....',
    '......khak....',
    '.....khhhk....',
    '....khhhhhk...',
    '..kkkttttttkk.',
    '.khhrrrrrrrrhk',
    '..krseesseesk.',
    '..rkssssssskr.',
    '.rkcckaakcckn.',
    '.kccccaaccckon',
    '.ksccccdccsknk',
    '.kkcccddccck.n',
    '..kccddddcck.n',
  ],
  rogue: [
    '....kkkkkk....',
    '...khhhhhhk...',
    '..khhhhhhhhk..',
    '..khhhhhhhhk..',
    '..khkssssskhk.',
    '..khseesseshk.',
    '..khmmmmmmmhk.',
    '.rrrkkkkkkk...',
    'rrkrccaaccck..',
    'r.kcccaacccck.',
    '..ksccbbbccsk.',
    '..kkccddddckk.',
    '...kddddddk...',
  ],
  priest: [
    '...kyyyyyyk...',
    '....kkkkkk....',
    '...khhhhhhk...',
    '..khhhhhhhhk..',
    '..khsssssshk..',
    '..khseesseshk.',
    '..khhssrsshhk.',
    '..khkkaakkhk..',
    '..hkwwaawwkh..',
    '.kwwwaaaawwwk.',
    '.kswwwaawwwsk.',
    '.kkwwwaawwwkk.',
    '..kwwwaawwwk..',
  ],
  dwarf: [
    '.w..........w.',
    '.wk.kkkkkk.kw.',
    '..wkmmmmmmkw..',
    '..kmmmammmmk..',
    '.kkkkkkkkkkkk.',
    '.khsseesseshk.',
    '.khssssnsssh..',
    '.khhhhhhhhhhk.',
    'kcchhhhhhhhcck',
    'kschhhhhhhhcsk',
    'kkcchhhhhhcckk',
    '.kcacakkacack.',
    '.kddddddddddk.',
  ],
  shaman: [
    '..r..y..r.....',
    '..rk.y.kr.....',
    '...kkhkkk.....',
    '..khhhhhhkk...',
    '.khhhhhhhhhk..',
    '.khsrssssrhk..',
    '.khseesseeshk.',
    '.khhssssshhhk.',
    '.hkwkwkwkwkh..',
    '.hkcccaaccckh.',
    '..kscccccccsk.',
    '..kkcccdccckk.',
    '...kddadddk...',
  ],
  alchemist: [
    '...kkkkkkk....',
    '..khhhhhhhk...',
    '.khhhhhhhhhk..',
    '.kkkkkkkkkkk..',
    '.kgggkhkgggk..',
    '.kgwgkskgwgk..',
    '..kssssssssk..',
    '..kksssssskk..',
    '.kcckwwwwkcck.',
    '.kcccwwwwccck.',
    'kgksccwwccsk..',
    'kakkcckkcckk..',
    '.k.kccddcck...',
  ],
  paladin: [
    'w.....kk.....w',
    'ww...kaak...ww',
    '.wwkkaaaakkww.',
    '..wkaaaaaakw..',
    '...kaaaaaaak..',
    '..kasseesesak.',
    '..kassssssak..',
    '.rrkkkaakkkrr.',
    '.rkwwwaawwwkr.',
    'rkmwwaaaawwmkr',
    'rksmwwaawwmskr',
    'rkkwwwaawwwkkr',
    '.rkwwwaawwwkr.',
  ],
  scholar: [
    '....kkkkkk....',
    '...kswssssk...',
    '..kssssssssk..',
    '.khsssssssshk.',
    '.khkkkkkkkkhk.',
    '.khkgekkegkhk.',
    '.khhkkhhkkhhk.',
    '..khhhhhhhhk..',
    '.kcchhhhhhcck.',
    '.kccchhhhccck.',
    'knnnnkhhkccsk.',
    'knwwwnkkcckk..',
    'knnnnkddddk...',
  ],
};
const HERO_PAL = {
  knight: { m: '#c8d0dc', n: '#7a8698', c: '#3a64c8', d: '#253f85', a: '#f2c94c', r: '#e03a3a', e: '#9fe8ff', b: '#4a3020' },
  mage: { h: '#6a3fbf', t: '#f2c94c', a: '#f2c94c', r: '#ff8ab0', c: '#8e4fd6', d: '#5a2c96', o: '#7fe0ff', n: '#8a5a2a', b: '#3a2050' },
  rogue: { a: '#c0a060', h: '#2f2f3a', m: '#1e1e28', c: '#3c8c4a', d: '#24572e', r: '#d03838', e: '#ffe060', b: '#2a2018' },
  priest: { y: '#ffe680', h: '#f4e2a8', r: '#e89090', w: '#f4f4f8', a: '#e0b040', d: '#c8d0e0', e: '#3a6ad0', b: '#a08050' },
  dwarf: { w: '#f0ead8', m: '#9098a8', a: '#f2c94c', h: '#e0742a', n: '#d0906a', c: '#8a5a2b', d: '#5c3a1a', e: '#1b1424', b: '#3a2410' },
  shaman: { r: '#e04040', y: '#ffe14a', h: '#3fb7d9', w: '#f0ead8', c: '#2a4a8a', d: '#18305a', a: '#ffe14a', b: '#3a2a1a' },
  alchemist: { h: '#5a321e', g: '#50c878', w: '#e8f0e0', c: '#b04a3a', d: '#6e2a22', a: '#ffd040', b: '#3a2010' },
  paladin: { w: '#ffffff', a: '#e8c050', r: '#c03040', m: '#c8d0dc', e: '#1b1424', d: '#8a6a20', b: '#6a4a20' },
  scholar: { s: '#f2c29b', h: '#d8d8e0', g: '#9fd8ff', c: '#2f7f7f', d: '#1d5050', n: '#8a3a2a', w: '#f0e8d0', e: '#1b1424', b: '#3a2a1a' },
};
const HERO_LEGS = { knight: LEGS_PANTS, mage: LEGS_ROBE, rogue: LEGS_PANTS, priest: LEGS_ROBE, dwarf: LEGS_SHORT, shaman: LEGS_PANTS, alchemist: LEGS_PANTS, paladin: LEGS_PANTS, scholar: LEGS_ROBE };
const CHAR_SPR = {};
for (const c of CHARS) CHAR_SPR[c.id] = HERO_LEGS[c.id].map(l => makeSprite(HERO_TOP[c.id].concat(l), HERO_PAL[c.id]));

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
  spider: { hp: 14, spd: 55, dmg: 6, xp: 2, r: 6, spr: 'spider', kb: 1.1 },
  scorpion: { hp: 38, spd: 40, dmg: 10, xp: 3, r: 6, spr: 'scorpion', kb: 0.8 },
  imp: { hp: 32, spd: 58, dmg: 9, xp: 3, r: 6, spr: 'imp', kb: 1 },
  mushroom: { hp: 60, spd: 30, dmg: 9, xp: 3, r: 6, spr: 'mushroom', kb: 0.7 },
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
const MAX_ENEMIES = 360;

// ============================================================
// stage monsters: recoloured variants of the base monsters ([base, palette, stat multipliers, name])
// ============================================================
const VARIANTS = {
  slime_spore: ['slime', { g: '#b8c840', w: '#f0ffb0', e: '#2a3010' }, { hp: 1.2 }],
  brute_troll: ['brute', { f: '#4a7a3a', n: '#8ab070', r: '#ff6030', w: '#e0e0c0' }, { hp: 1.1 }],
  golem_moss: ['golem', { f: '#5a6a50', n: '#7a9a60', r: '#c0ff60', w: '#c8d8b0' }, {}],
  bat_desert: ['bat', { p: '#a07040', r: '#ffd040' }, { hp: 1.4, spd: 1.1 }],
  skeleton_sand: ['skeleton', { h: '#d8b878', s: '#e8d0a0', c: '#c8a870', d: '#a08050', a: '#e8d0a0', b: '#a08050' }, { hp: 1.1 }],
  golem_sand: ['golem', { f: '#b89058', n: '#d8b880', r: '#ff8030', w: '#f0e0c0' }, {}],
  flower_cactus: ['flower', { p: '#ff70b0', y: '#ffe080', g: '#3a8a50' }, { hp: 1.3, dmg: 1.3 }],
  slime_ice: ['slime', { g: '#70c8ff', w: '#e0f8ff', e: '#103050' }, { hp: 1.3, spd: 0.9 }],
  bat_ice: ['bat', { p: '#6080c8', r: '#a0f0ff' }, { hp: 1.5 }],
  skeleton_ice: ['skeleton', { h: '#c0e0ff', s: '#d8f0ff', e: '#2050a0', c: '#a0c8f0', d: '#7098c8', a: '#d8f0ff', b: '#7098c8' }, { hp: 1.15 }],
  ghost_frost: ['ghost', { w: '#c0f0ff', e: '#1050a0', o: '#3080c0' }, { hp: 1.2 }],
  brute_yeti: ['brute', { f: '#e8f0f8', n: '#b0c8e0', r: '#40a0ff', w: '#ffffff' }, { hp: 1.25 }],
  golem_ice: ['golem', { f: '#80b0e0', n: '#c0e0ff', r: '#ffffff', w: '#e0f8ff' }, { hp: 1.1 }],
  flower_ice: ['flower', { p: '#a0e0ff', y: '#ffffff', g: '#4a7aa0' }, { hp: 1.3 }],
  slime_toxic: ['slime', { g: '#9a50d0', w: '#e0b0ff', e: '#200a30' }, { hp: 1.4 }],
  spider_swamp: ['spider', { p: '#3a5a2a', r: '#e0ff40', w: '#6a8a4a' }, { hp: 1.3 }],
  zombie_swamp: ['zombie', { h: '#2a4a3a', s: '#6a9a6a', c: '#3a5a4a', d: '#2a3a2a' }, { hp: 1.3 }],
  eye_swamp: ['eye', { w: '#d0e0a0', i: '#a0d020', r: '#608020' }, { hp: 1.2 }],
  mushroom_toxic: ['mushroom', { m: '#8a40c0', w: '#e0ff80', s: '#c8c0a0' }, { hp: 1.2 }],
  brute_ogre: ['brute', { f: '#6a7a3a', n: '#a0a060', r: '#ff3030', w: '#e8e0c0' }, { hp: 1.3 }],
  flower_vine: ['flower', { p: '#6a3a8a', y: '#c0ff40', g: '#2a5a2a' }, { hp: 1.5, dmg: 1.2 }],
  bat_cave: ['bat', { p: '#3a6a80', r: '#80ffe0' }, { hp: 1.8, spd: 1.1 }],
  spider_cave: ['spider', { p: '#405070', r: '#60e0ff', w: '#80a0c0' }, { hp: 1.5 }],
  eye_crystal: ['eye', { w: '#c0e8ff', i: '#ff50d0', r: '#6080ff' }, { hp: 1.3 }],
  golem_crystal: ['golem', { f: '#6050a0', n: '#a090e0', r: '#ff80ff', w: '#e0d0ff' }, { hp: 1.2 }],
  flower_crystal: ['flower', { p: '#80e0ff', y: '#ff80ff', g: '#4050a0' }, { hp: 1.6 }],
  bat_fire: ['bat', { p: '#c03a1a', r: '#ffe040' }, { hp: 2, spd: 1.05 }],
  slime_fire: ['slime', { g: '#ff6020', w: '#ffe080', e: '#401000' }, { hp: 1.5, spd: 1.15 }],
  skeleton_fire: ['skeleton', { h: '#ff8030', s: '#3a2a2a', e: '#ffe040', c: '#4a3030', d: '#2a1a1a', a: '#ff8030', b: '#2a1a1a' }, { hp: 1.3 }],
  brute_fire: ['brute', { f: '#a02a1a', n: '#ff7030', r: '#ffe040', w: '#ffd0a0' }, { hp: 1.3 }],
  golem_lava: ['golem', { f: '#3a2a2a', n: '#ff6020', r: '#ffe040', w: '#ffb060' }, { hp: 1.3 }],
  flower_fire: ['flower', { p: '#ff5020', y: '#ffe040', g: '#5a2a1a' }, { hp: 1.6, dmg: 1.3 }],
  bat_void: ['bat', { p: '#2a1a4a', r: '#ff40ff' }, { hp: 2.5, spd: 1.15 }],
  eye_void: ['eye', { w: '#3a2a5a', i: '#ffe040', p: '#ffffff', r: '#ff40ff' }, { hp: 1.4 }],
  ghost_void: ['ghost', { w: '#a070ff', e: '#ffffff', o: '#2a1050' }, { hp: 1.6, spd: 1.1 }],
  imp_void: ['imp', { w: '#ffe0ff', r: '#5030a0', y: '#40ffff', d: '#1a0a3a' }, { hp: 1.5 }],
  knight_void: ['knight', { h: '#1a1030', s: '#2a1a4a', e: '#40ffff', c: '#3a2a6a', d: '#1a1030', a: '#ff40ff' }, { hp: 1.3 }],
  golem_void: ['golem', { f: '#1a1030', n: '#5030a0', r: '#ff40ff', w: '#a070ff' }, { hp: 1.3 }],
  flower_void: ['flower', { p: '#5030a0', y: '#40ffff', g: '#1a1030' }, { hp: 2, dmg: 1.4 }],
};
for (const id in VARIANTS) {
  const [base, pal, mul] = VARIANTS[id], B = ENEMIES[base];
  const sk = B.spr + '_' + id;
  SPR[sk] = buildSpr(SPR_SRC[B.spr], pal);
  ENEMIES[id] = Object.assign({}, B, { spr: sk, hp: B.hp * (mul.hp || 1), spd: B.spd * (mul.spd || 1), dmg: B.dmg * (mul.dmg || 1) });
}

// ============================================================
// stages: 10 themed maps, each unlocked by clearing the one before.
// pool = monster tiers from weak to strong; hp/dmg/dens scale the whole stage.
// ============================================================
const STAGE_LEN = 900; // 15 minutes per stage
const STAGES = [
  { id: 'meadow', name: '별빛 초원', desc: '모험이 시작되는 고요한 들판. 몬스터들이 하나둘 깨어나요.', hp: 1, dmg: 1, dens: 0.85, classic: true,
    ground: { base: '#263a26', blobs: ['#2a422a', '#223522', '#2d472b'], dirt: '#36301f', dots: ['#2e462c', '#20321f', '#304b2e', '#29402a'], tuft: '#3d5e37', flowers: ['#e8dc78', '#d8789a', '#9ac8f0', '#f0f0f0'], rock: ['#4a4a50', '#6a6a72'], deco: [['tomb', 10], ['bush', 14]] },
    swarm: ['bat', '박쥐 떼가 몰려온다!'], swarm2: ['ghost', '유령의 행렬!'], ring: ['flower', '식인꽃에 포위당했다!'],
    bosses: [['brute', '거대 늑대인간'], ['mummy', '고대 파라오'], ['knight', '타락한 기사단장']] },
  { id: 'forest', name: '포자의 숲', desc: '빛나는 버섯과 거미줄이 가득한 깊은 숲. 버섯 고리를 조심하세요.', hp: 1.4, dmg: 1.12, dens: 0.95, weather: 'spores',
    pool: ['slime_spore', 'spider', 'zombie', 'mushroom', 'brute_troll', 'golem_moss'],
    ground: { base: '#1c3330', blobs: ['#203a35', '#18302a', '#24403a'], dirt: '#2a2a1e', dots: ['#24403a', '#152824', '#2a4a40'], tuft: '#2f5a48', flowers: ['#80ffe0', '#ffe080', '#c080ff'], rock: ['#3a4a48', '#5a6a68'], deco: [['shroom', 18], ['bush', 10], ['web', 6]] },
    swarm: ['spider', '거미 떼가 쏟아진다!'], swarm2: ['spider', '거미 떼가 쏟아진다!'], ring: ['mushroom', '요정의 버섯 고리에 갇혔다!'],
    bosses: [['spider', '거미 여왕'], ['mushroom', '버섯 대왕'], ['brute_troll', '숲의 트롤']] },
  { id: 'desert', name: '황금 사막', desc: '태양이 작열하는 모래 언덕. 전갈 떼와 깨어난 미라가 기다려요.', hp: 1.8, dmg: 1.25, dens: 1.1, weather: 'sand',
    pool: ['bat_desert', 'scorpion', 'skeleton_sand', 'mummy', 'scorpion', 'golem_sand'],
    ground: { base: '#c8a060', blobs: ['#d0aa68', '#bc955a', '#d8b475'], dirt: '#a88048', dots: ['#d8b070', '#b89050', '#e0c080'], tuft: '#8a9a40', flowers: ['#ff80b0', '#fff0c0'], rock: ['#9a7a50', '#c0a070'], deco: [['cactus', 12], ['bones', 8]] },
    swarm: ['scorpion', '전갈 떼가 몰려온다!'], swarm2: ['bat_desert', '모래 박쥐 떼!'], ring: ['flower_cactus', '선인장 꽃에 포위당했다!'],
    bosses: [['scorpion', '거대 전갈'], ['mummy', '사막의 파라오'], ['golem_sand', '모래 거신']] },
  { id: 'tundra', name: '얼음 설원', desc: '눈보라가 몰아치는 하얀 설원. 설인과 서리 망령이 살아요.', hp: 2.3, dmg: 1.38, dens: 1.15, weather: 'snow',
    pool: ['slime_ice', 'bat_ice', 'skeleton_ice', 'ghost_frost', 'brute_yeti', 'golem_ice'],
    ground: { base: '#dce8f0', blobs: ['#e8f0f8', '#c8d8e8', '#f0f8ff'], dirt: '#b0c4d8', dots: ['#c0d0e0', '#e8f0ff', '#a8bcd0'], tuft: '#8aa0b8', flowers: ['#80c0ff', '#ffffff'], rock: ['#7a8aa0', '#a0b0c8'], deco: [['pine', 12], ['icerock', 8]] },
    swarm: ['ghost_frost', '눈보라 망령들이 몰려온다!'], swarm2: ['bat_ice', '얼음 박쥐 떼!'], ring: ['flower_ice', '얼음꽃에 포위당했다!'],
    bosses: [['brute_yeti', '설인 대장'], ['ghost_frost', '서리 여왕'], ['golem_ice', '빙하 거인']] },
  { id: 'grave', name: '달빛 묘지', desc: '망자가 깨어나는 어두운 묘지. 시야가 좁아져요.', hp: 2.8, dmg: 1.5, dens: 1.2, dark: 0.6, weather: 'fog',
    pool: ['bat', 'zombie', 'skeleton', 'ghost', 'mummy', 'knight'],
    ground: { base: '#2a2a34', blobs: ['#30303c', '#24242c', '#34343f'], dirt: '#2a2620', dots: ['#3a3a46', '#202028', '#33333e'], tuft: '#3a4a3a', flowers: ['#a0a0ff', '#e0e0ff'], rock: ['#4a4a58', '#6a6a7a'], deco: [['tomb', 26], ['deadtree', 8]] },
    swarm: ['ghost', '유령의 행렬!'], swarm2: ['bat', '흡혈 박쥐 떼!'], ring: ['zombie', '무덤에서 망자가 일어났다!'],
    bosses: [['knight', '묘지기'], ['ghost', '망령 군주'], ['mummy', '저주받은 왕']] },
  { id: 'swamp', name: '독안개 늪', desc: '독기가 피어오르는 축축한 늪지. 독 슬라임과 오우거가 살아요.', hp: 3.4, dmg: 1.62, dens: 1.25, weather: 'rain',
    pool: ['slime_toxic', 'spider_swamp', 'zombie_swamp', 'eye_swamp', 'mushroom_toxic', 'brute_ogre'],
    ground: { base: '#2c3a24', blobs: ['#34442a', '#26321e', '#3a3a28'], dirt: '#3a4a3a', dots: ['#3a4a2e', '#222c1a', '#44502e'], tuft: '#5a6a30', flowers: ['#c0ff40', '#a060ff'], rock: ['#4a4a3a', '#6a6a50'], deco: [['puddle', 14], ['reed', 14]] },
    swarm: ['spider_swamp', '늪거미 떼가 쏟아진다!'], swarm2: ['zombie_swamp', '늪의 망자들이 몰려온다!'], ring: ['flower_vine', '독 덩굴에 포위당했다!'],
    bosses: [['slime_toxic', '거대 독슬라임'], ['brute_ogre', '늪 오우거'], ['eye_swamp', '늪의 눈']] },
  { id: 'cave', name: '수정 동굴', desc: '빛나는 수정이 가득한 깊은 동굴. 어둠 속에서 눈들이 번뜩여요.', hp: 4, dmg: 1.75, dens: 1.3, dark: 0.5, weather: 'sparkle',
    pool: ['bat_cave', 'spider_cave', 'skeleton', 'eye_crystal', 'knight', 'golem_crystal'],
    ground: { base: '#1a1c30', blobs: ['#20223a', '#161828', '#242640'], dirt: '#2a2440', dots: ['#262a44', '#14162a', '#2a2e4a'], tuft: '#3a3a6a', flowers: ['#80e0ff', '#ff80ff'], rock: ['#3a3a5a', '#5a5a80'], deco: [['crystal', 20], ['icerock', 6]] },
    swarm: ['bat_cave', '동굴 박쥐 떼!'], swarm2: ['spider_cave', '동굴 거미 떼!'], ring: ['flower_crystal', '수정꽃에 포위당했다!'],
    bosses: [['golem_crystal', '수정 골렘'], ['bat_cave', '흡혈 박쥐왕'], ['eye_crystal', '수정 눈알 군주']] },
  { id: 'volcano', name: '불타는 화산', desc: '용암이 흐르는 불의 산. 하늘에서 불덩이가 떨어져요!', hp: 4.7, dmg: 1.9, dens: 1.35, weather: 'ash', meteor: { iv: 7, dmg: 18, r: 22 },
    pool: ['slime_fire', 'bat_fire', 'skeleton_fire', 'imp', 'brute_fire', 'golem_lava'],
    ground: { base: '#2a1e1c', blobs: ['#322420', '#241a18', '#3a2622'], dirt: '#4a2018', dots: ['#3a2a26', '#1e1614', '#40302a'], tuft: '#5a3020', flowers: ['#ff6020', '#ffc040'], rock: ['#3a3030', '#5a4a48'], deco: [['lava', 14], ['bones', 6]] },
    swarm: ['bat_fire', '불박쥐 떼가 날아든다!'], swarm2: ['imp', '화염 임프 떼!'], ring: ['flower_fire', '불꽃 꽃에 포위당했다!'],
    bosses: [['golem_lava', '용암 골렘'], ['imp', '화염 마왕'], ['brute_fire', '불의 거인']] },
  { id: 'citadel', name: '폐허 성채', desc: '무너진 왕국의 마지막 요새. 최정예 기사단이 지키고 있어요.', hp: 5.4, dmg: 2.05, dens: 1.4, weather: 'fog',
    pool: ['bat', 'skeleton', 'ghost', 'eye', 'knight', 'golem'],
    ground: { base: '#4a4640', blobs: ['#524e48', '#42403a', '#585248'], dirt: '#3a3630', dots: ['#5a564e', '#3e3a34', '#605a50'], tuft: '#4a5a3a', flowers: ['#c0c0a0'], rock: ['#6a6660', '#8a8680'], tiles: '#3a3630', deco: [['pillar', 10], ['tomb', 4]] },
    swarm: ['bat', '박쥐 떼가 성채를 뒤덮는다!'], swarm2: ['skeleton', '해골 군단이 진격한다!'], ring: ['flower', '저주받은 화단에 갇혔다!'],
    bosses: [['knight', '타락한 기사단장'], ['golem', '석상 수호자'], ['mummy', '망국의 왕']] },
  { id: 'abyss', name: '별이 떨어진 곳', desc: '모든 별빛이 시작된 공허의 끝. 별똥별이 쏟아지는 마지막 전장.', hp: 6.2, dmg: 2.25, dens: 1.5, dark: 0.35, weather: 'stars', meteor: { iv: 6, dmg: 24, r: 24 },
    pool: ['bat_void', 'ghost_void', 'eye_void', 'imp_void', 'knight_void', 'golem_void'],
    ground: { base: '#140e24', blobs: ['#1a122e', '#100a1c', '#20163a'], dirt: '#2a1a40', dots: ['#ffffff', '#a080ff', '#40ffff', '#1e1636'], tuft: '#3a2a6a', flowers: ['#ffffff', '#ffe040', '#40ffff'], rock: ['#2a2040', '#4a3a70'], deco: [['crystal', 10], ['star', 30]] },
    swarm: ['ghost_void', '공허의 행렬!'], swarm2: ['bat_void', '공허 박쥐 떼!'], ring: ['flower_void', '공허의 꽃에 포위당했다!'],
    bosses: [['eye_void', '공허의 눈'], ['knight_void', '별을 삼킨 기사'], ['golem_void', '별의 파괴자']] },
];

// waves for minute i of a stage: density follows the classic curve; monster types come from the stage pool
function stageWave(S, i) {
  const W = WAVES[Math.min(WAVES.length - 1, Math.floor(i * 20 / 15))];
  let types = W.types;
  if (!S.classic) {
    const k = Math.min(S.pool.length - 1, Math.floor(i * S.pool.length / 15));
    types = [...new Set([S.pool[k], S.pool[Math.max(0, k - 1)], i >= 9 ? S.pool[Math.max(0, k - 2)] : S.pool[k]])];
  }
  return { types, min: W.min * S.dens, iv: W.iv, batch: W.batch * S.dens };
}
// timeline: swarms, rings, three bosses, then the stage clears at 15:00
function stageEvents(S) {
  const bh = Math.pow(S.hp, 0.9);
  return [
    { t: 120, type: 'swarm', enemy: S.swarm[0], n: 40, text: S.swarm[1] },
    { t: 240, type: 'boss', enemy: S.bosses[0][0], hp: 2000 * bh, name: S.bosses[0][1] },
    { t: 330, type: 'ring', enemy: S.ring[0], n: 32, text: S.ring[1] },
    { t: 400, type: 'swarm', enemy: S.swarm2[0], n: 55, text: S.swarm2[1] },
    { t: 480, type: 'boss', enemy: S.bosses[1][0], hp: 7000 * bh, name: S.bosses[1][1] },
    { t: 600, type: 'swarm', enemy: S.swarm[0], n: 60, text: S.swarm[1] },
    { t: 660, type: 'ring', enemy: S.ring[0], n: 44, text: S.ring[1] },
    { t: 720, type: 'boss', enemy: S.bosses[2][0], hp: 17000 * bh, name: S.bosses[2][1] },
    { t: 810, type: 'swarm', enemy: S.swarm2[0], n: 70, text: S.swarm2[1] },
    { t: STAGE_LEN, type: 'reaper' },
  ];
}
function stageUnlocked(i) { return i === 0 || !!(save.stages[i - 1] && save.stages[i - 1].clear); }
