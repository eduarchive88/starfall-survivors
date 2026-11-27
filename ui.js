'use strict';
// ============================================================
// icon helpers for DOM
// ============================================================
const urlCache = {};
function sprURL(spr, key, scale = 4) {
  const k = key + '@' + scale;
  if (urlCache[k]) return urlCache[k];
  const c = makeCanvas(spr.w * scale, spr.h * scale), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(spr.c, 0, 0, c.width, c.height);
  return (urlCache[k] = c.toDataURL());
}
function weaponIcon(id, evo) { return sprURL(ICONS[id][evo ? 1 : 0], 'w' + id + evo); }
function passiveIconURL(id) { return sprURL(passiveIcon(id), 'p' + id); }
function iconByName(name) {
  if (name === 'coin') return sprURL(ITEM.coin, 'coin');
  if (name === 'chicken') return sprURL(ITEM.chicken, 'chicken');
  if (name === 'magnet') return sprURL(ITEM.magnet, 'magnet');
  return sprURL(ICONS[name][0], 'i' + name);
}
function charURL(id) { return sprURL(CHAR_SPR[id][0], 'c' + id); }

const screens = ['title', 'chars', 'stages', 'shop', 'book', 'settings', 'levelup', 'chest', 'pause', 'result', 'mp', 'lobby'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('on', s === id);
  $('pauseBtn').style.display = state === 'play' && !id ? 'block' : 'none';
}
function on(id, fn) { $(id).addEventListener('click', e => { sfx.click(); fn(e); }); }

// ============================================================
// title / character select
// ============================================================
function bestText() {
  const vals = Object.values(save.best);
  return vals.length ? '최고 생존 ' + fmtTime(Math.max(...vals)) : '';
}
function showTitle() {
  state = 'title';
  run = null;
  GROUND = makeGround(save.stage | 0);
  $('tGold').textContent = Math.floor(save.gold);
  $('tBest').textContent = bestText();
  show('title');
}
let selChar = save.lastChar;
function showChars() {
  const g = $('charGrid');
  g.innerHTML = '';
  for (const c of CHARS) {
    const owned = save.chars[c.id];
    const el = document.createElement('div');
    el.className = 'cc' + (c.id === selChar ? ' sel' : '') + (owned ? '' : ' lock');
    el.innerHTML = `<img src="${charURL(c.id)}" alt=""><div class="n">${c.name}</div><div class="dim">${owned ? c.title : '● ' + c.cost}</div>`;
    el.onclick = () => { sfx.click(); selChar = c.id; showChars(); };
    g.appendChild(el);
  }
  const c = CHARS.find(x => x.id === selChar) || CHARS[0];
  const W = WEAPONS[c.weapon];
  const owned = save.chars[c.id];
  const best = save.best[c.id];
  $('charInfo').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <img class="ico" src="${weaponIcon(c.weapon)}" alt="">
      <div><div style="font-weight:700;font-size:17px">${c.name} <span class="dim" style="font-size:13px">${c.title}</span></div>
      <div style="font-size:13px;margin-top:3px">시작 무기: <b>${W.name}</b></div>
      <div class="dim" style="font-size:13px;margin-top:2px">${c.desc}</div>
      ${best ? `<div style="font-size:12px;margin-top:2px" class="${save.clears[c.id] ? 'gold-t' : 'dim'}">${save.clears[c.id] ? '★ 클리어 · ' : ''}최고 ${fmtTime(best)}</div>` : ''}</div>
    </div>`;
  const go = $('bGo');
  if (owned) { go.textContent = charPickMode ? '이 캐릭터로!' : '출발!'; go.disabled = false; }
  else { go.textContent = `● ${c.cost} 골드로 해금`; go.disabled = save.gold < c.cost; }
  show('chars');
}
let charPickMode = null; // set to a callback when choosing a character for the co-op lobby
on('bStart', () => { charPickMode = null; showChars(); });
on('bCharBack', () => { if (charPickMode) { const f = charPickMode; charPickMode = null; f(null); } else showTitle(); });
on('bGo', () => {
  const c = CHARS.find(x => x.id === selChar);
  if (!save.chars[c.id]) {
    if (save.gold < c.cost) return;
    save.gold -= c.cost; save.chars[c.id] = true; persist();
    sfx.chest();
    showChars();
    return;
  }
  save.lastChar = c.id; persist();
  if (charPickMode) { const f = charPickMode; charPickMode = null; f(c.id); return; }
  showStages(si => { if (si === null) showChars(); else startRun(c.id, si); });
});
function startRun(id, si = save.stage) {
  newRun(typeof id === 'string' ? [{ char: id, power: save.power, ctrl: 'local' }] : id, si);
  state = 'play';
  input.active = false;
  show(null);
  audio();
}

// ============================================================
// stage select
// ============================================================
let stagePick = null; // callback(stageIndex | null)
function stageThumb(i) {
  const key = 'stg' + i;
  if (urlCache[key]) return urlCache[key];
  const S = STAGES[i], c = makeCanvas(72, 48), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(makeGround(i), 100, 100, 72, 48, 0, 0, 72, 48);
  const boss = ENEMIES[S.bosses[2][0]], sp = SPR[boss.spr][0];
  x.drawImage(sp.c, 36 - sp.w, 24 - sp.h, sp.w * 2, sp.h * 2);
  const mob = ENEMIES[S.classic ? 'bat' : S.pool[0]], ms = SPR[mob.spr][0];
  x.drawImage(ms.c, 6, 30 - ms.h / 2); x.drawImage(ms.c, 72 - ms.w - 6, 14 - ms.h / 2);
  return (urlCache[key] = c.toDataURL());
}
function showStages(cb) {
  stagePick = cb;
  if (!stageUnlocked(save.stage | 0)) save.stage = 0;
  const box = $('stageList');
  box.innerHTML = STAGES.map((S, i) => {
    const open = stageUnlocked(i), rec = save.stages[i] || {};
    const status = !open ? '🔒 이전 스테이지를 클리어하면 열려요' : rec.clear ? `<span class="gold-t">★ 클리어</span> · 최고 ${fmtTime(rec.best || 0)}` : rec.best ? `최고 ${fmtTime(rec.best)}` : '도전 가능!';
    return `<div class="stg${open ? '' : ' lock'}${i === (save.stage | 0) ? ' sel' : ''}" data-i="${i}">
      <img src="${stageThumb(i)}" alt="">
      <div style="flex:1"><div class="no">STAGE ${i + 1} · 보상 ×${stageGoldMul(i).toFixed(1)}</div><div class="t">${S.name}</div><div class="d">${open ? S.desc : '???'}</div><div class="d">${status}</div></div></div>`;
  }).join('');
  [...box.children].forEach(el => el.onclick = () => {
    const i = +el.dataset.i;
    if (!stageUnlocked(i)) return;
    sfx.click();
    save.stage = i; persist();
    const f = stagePick; stagePick = null;
    if (f) f(i);
  });
  show('stages');
  const sel = box.querySelector('.sel');
  if (sel) sel.scrollIntoView({ block: 'center' });
}
on('bStageBack', () => { const f = stagePick; stagePick = null; if (f) f(null); else showTitle(); });
function stageGoldMul(i) { return 1 + i * 0.3; }

// ============================================================
// shop
// ============================================================
function powerCost(p) {
  const total = Object.values(save.power).reduce((a, b) => a + b, 0);
  return Math.round(p.cost * (powerLv(p.id) + 1) * (1 + 0.1 * total));
}
let shopSel = null;
function showShop() {
  $('sGold').textContent = Math.floor(save.gold);
  const g = $('shopGrid');
  g.innerHTML = '';
  for (const p of POWERUPS) {
    const lv = powerLv(p.id), max = lv >= p.max, cost = powerCost(p);
    const el = document.createElement('div');
    el.className = 'pu' + (max ? ' max' : save.gold < cost ? ' poor' : '');
    if (shopSel === p.id) el.style.boxShadow = 'inset 0 0 0 3px #ffd040,0 4px 0 #000';
    let pips = '';
    for (let i = 0; i < p.max; i++) pips += `<div class="pip${i < lv ? ' on' : ''}"></div>`;
    el.innerHTML = `<img src="${iconByName(p.icon)}" alt=""><div class="n">${p.name}</div><div class="pips">${pips}</div><div class="c">${max ? 'MAX' : '● ' + cost}</div>`;
    el.onclick = () => {
      if (shopSel !== p.id) { shopSel = p.id; sfx.click(); showShop(); return; }
      if (max || save.gold < cost) { tone(150, 0.1, 'square', 0.04); return; }
      save.gold -= cost; save.power[p.id] = lv + 1; persist();
      sfx.coin();
      showShop();
    };
    g.appendChild(el);
  }
  const p = POWERUPS.find(x => x.id === shopSel);
  $('shopInfo').innerHTML = p
    ? `<b>${p.name}</b> · ${p.per}<br><span class="dim">현재 ${powerLv(p.id)}/${p.max}단계. 한 번 더 누르면 구매해요.</span>`
    : '파워업은 모든 캐릭터에게 영구 적용돼요. 항목을 누르면 설명이 보이고, 한 번 더 누르면 구매해요. 하나 살 때마다 다른 파워업 가격도 조금씩 올라가요.';
  show('shop');
}
on('bShop', () => { shopSel = null; showShop(); });
on('bShopBack', showTitle);
on('bRefund', () => {
  let spent = 0;
  const snapshot = Object.assign({}, save.power);
  save.power = {};
  // replay purchases in a fixed order to compute the refund exactly
  for (const p of POWERUPS) {
    for (let i = 0; i < (snapshot[p.id] || 0); i++) { spent += powerCost(p); save.power[p.id] = (save.power[p.id] || 0) + 1; }
  }
  if (!spent) return;
  if (!confirm(`파워업을 전부 환불할까요? (● ${spent} 돌려받음)`)) { save.power = snapshot; return; }
  save.power = {};
  save.gold += spent; persist();
  showShop();
});

// ============================================================
// evolution book / settings
// ============================================================
function recipeHTML(filter) {
  let h = '';
  for (const id in WEAPONS) {
    if (filter && !filter(id)) continue;
    const W = WEAPONS[id];
    h += `<div class="recipe"><img class="ico sm" src="${weaponIcon(id)}" alt=""><span class="plus">+</span><img class="ico sm" src="${passiveIconURL(W.evoWith)}" alt=""><span class="plus">→</span><img class="ico sm" src="${weaponIcon(id, true)}" alt="">
      <div class="nm"><b>${W.evoName}</b><br><span class="dim" style="font-size:11px">${W.name} Lv8 + ${PASSIVES[W.evoWith].name}</span></div></div>`;
  }
  return h;
}
function comboHTML(filter) {
  let h = '';
  for (const id in EVO2) {
    if (filter && !filter(id)) continue;
    const W = WEAPONS[id], P = WEAPONS[EVO2[id].with];
    h += `<div class="recipe"><img class="ico sm" src="${weaponIcon(id, true)}" alt=""><span class="plus">+</span><img class="ico sm" src="${weaponIcon(EVO2[id].with, true)}" alt=""><span class="plus">→</span><img class="ico sm" src="${weaponIcon(id, true)}" alt="">
      <div class="nm"><b>${W.evoName}+</b> <span class="gold-t" style="font-size:11px">${EVO2[id].combo}</span><br><span class="dim" style="font-size:11px">${W.evoName} + ${P.evoName}</span></div></div>`;
  }
  return h;
}
on('bBook', () => { $('bookList').innerHTML = '<div class="dim center" style="font-size:12px;margin-bottom:4px">1단계 · 진화</div>' + recipeHTML() + '<div class="dim center" style="font-size:12px;margin:8px 0 4px">2단계 · 진화 강화</div>' + comboHTML(); show('book'); });
on('bBookBack', showTitle);
function togglesHTML() {
  const t = (k, label) => `<div class="toggle"><span>${label}</span><button data-k="${k}" class="${save[k] ? 'on' : ''}">${save[k] ? '켜짐' : '꺼짐'}</button></div>`;
  return t('sound', '효과음') + t('nums', '피해 숫자 표시') + t('vibe', '진동');
}
function bindToggles(root) {
  root.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k; save[k] = !save[k]; persist();
    b.classList.toggle('on', save[k]); b.textContent = save[k] ? '켜짐' : '꺼짐';
    sfx.click();
  });
}
on('bSettings', () => { $('setList').innerHTML = togglesHTML(); bindToggles($('setList')); show('settings'); });
on('bSetBack', showTitle);
on('bReset', () => {
  if (!confirm('정말 모든 진행 상황(골드, 파워업, 캐릭터)을 지울까요?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  save = loadSave(); selChar = 'knight';
  showTitle();
});

// ============================================================
// level up
// ============================================================
function upgradeText(u) {
  const parts = [];
  for (const k in u) {
    const v = u[k];
    if (k === 'dmg') parts.push(`피해 +${v}`);
    else if (k === 'cd') parts.push(`쿨다운 ${v}초`);
    else if (k === 'amount') parts.push(`투사체 +${v}`);
    else if (k === 'area') parts.push(`범위 +${Math.round(v * 100)}%`);
    else if (k === 'pierce') parts.push(`관통 +${v}`);
    else if (k === 'speed') parts.push(`속도 +${Math.round(v * 100)}%`);
    else if (k === 'dur') parts.push(`지속시간 +${v}초`);
  }
  return parts.join(', ');
}
function weightedPick(arr) {
  let tot = 0;
  for (const a of arr) tot += a.w;
  let r = Math.random() * tot;
  for (let i = 0; i < arr.length; i++) { r -= arr[i].w; if (r <= 0) return i; }
  return arr.length - 1;
}
function rollChoices() {
  const R = run, pool = [];
  for (const w of R.weapons) if (w.lvl < MAX_WLV) pool.push({ type: 'wup', id: w.id, w: 3 });
  if (R.weapons.length < 6) for (const id in WEAPONS) if (!R.weapons.find(w => w.id === id)) pool.push({ type: 'wnew', id, w: 1 });
  for (const id of R.passiveOrder) if (R.passives[id] < PASSIVES[id].max) pool.push({ type: 'pup', id, w: 2.5 });
  if (R.passiveOrder.length < 8) for (const id in PASSIVES) if (!R.passives[id]) pool.push({ type: 'pnew', id, w: 1 });
  const n = 3 + (Math.random() < Math.min(0.9, 0.1 + (st.luck - 1) * 0.9) ? 1 : 0);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(weightedPick(pool), 1)[0]);
  if (!out.length) out.push({ type: 'gold' }, { type: 'heal' });
  return out;
}
function applyChoice(c) {
  const R = run;
  if (c.type === 'wnew') addWeapon(c.id);
  else if (c.type === 'wup') levelWeapon(R.weapons.find(w => w.id === c.id));
  else if (c.type === 'pnew' || c.type === 'pup') addPassive(c.id);
  else if (c.type === 'gold') R.gold += 25;
  else if (c.type === 'heal') R.player.hp = Math.min(st.maxHp, R.player.hp + 30);
  const hinted = R.player.evoHinted;
  for (const w of R.weapons) if (evoReady(w) && !hinted[w.id]) {
    hinted[w.id] = true;
    pbanner(`${WEAPONS[w.id].name} 진화 준비 완료! 보물상자를 찾으세요`, '#ffd040', 3.5);
  }
  evo2Hint();
}
// called after any change that could complete a 진화 강화 pair (level-up pick or chest)
function evo2Hint() {
  const R = run, hinted = R.player.evoHinted;
  for (const w of R.weapons) if (evo2Ready(w) && !hinted['2' + w.id]) {
    hinted['2' + w.id] = true;
    pbanner(`${EVO2[w.id].combo} 조합 완성! 보물상자를 열면 ${WEAPONS[w.id].evoName} 강화`, '#ffd040', 3.5);
  }
}
function choiceCard(c) {
  const R = run;
  let icon, name, desc, tag = '', evo = false;
  if (c.type === 'wnew' || c.type === 'wup') {
    const W = WEAPONS[c.id], w = R.weapons.find(x => x.id === c.id);
    icon = weaponIcon(c.id); name = W.name;
    if (w) { tag = `<span class="tag">Lv ${w.lvl + 1}</span>`; desc = upgradeText(W.levels[w.lvl - 1]); }
    else { tag = '<span class="tag new">NEW</span>'; desc = W.desc; }
    if (w && w.lvl + 1 === MAX_WLV) desc += ` · <span class="gold-t">최대 레벨! (진화: ${PASSIVES[W.evoWith].name})</span>`;
  } else if (c.type === 'pnew' || c.type === 'pup') {
    const P = PASSIVES[c.id], lv = R.passives[c.id] || 0;
    icon = passiveIconURL(c.id); name = P.name; desc = P.desc;
    tag = lv ? `<span class="tag">Lv ${lv + 1}</span>` : '<span class="tag new">NEW</span>';
    const pair = R.weapons.find(w => WEAPONS[w.id].evoWith === c.id && !w.evo);
    if (pair) { desc += ` · <span class="gold-t">${WEAPONS[pair.id].name} 진화 재료</span>`; evo = true; }
  } else if (c.type === 'gold') { icon = iconByName('coin'); name = '금화 주머니'; desc = '골드 +25'; }
  else { icon = iconByName('chicken'); name = '통닭'; desc = '체력 30 회복'; }
  return `<div class="card${evo ? ' evo' : ''}"><img class="ico" src="${icon}" alt=""><div><div class="t">${name}${tag}</div><div class="d">${desc}</div></div></div>`;
}
let curChoices = [];
function openLevelUp(reroll) {
  if (SIM) { simPick(); return; }
  showChoices(rollChoices(), reroll);
}
// shows a set of level-up choices for the local hero (on a co-op guest they come from the host)
function showChoices(choices, quiet) {
  const me = run.me;
  state = 'levelup';
  input.active = false;
  if (!quiet) sfx.level();
  curChoices = choices;
  const box = $('lvCards');
  box.innerHTML = curChoices.map(choiceCard).join('');
  [...box.children].forEach((el, i) => el.onclick = () => {
    sfx.click();
    if (NET.role === 'guest') { netSend({ t: 'pick', i }); waitHost(); return; }
    applyChoice(curChoices[i]);
    finishLevel();
  });
  $('bReroll').textContent = `새로고침 (${me.rerolls})`;
  $('bReroll').disabled = me.rerolls <= 0;
  $('bSkip').textContent = `건너뛰기 (${me.skips})`;
  $('bSkip').disabled = me.skips <= 0;
  show('levelup');
}
// guest: choice sent, keep playing view until the host answers
function waitHost() { state = 'play'; show(null); }
function finishLevel() {
  run.me.pending--;
  if (run.me.pending > 0) openLevelUp();
  else { state = 'play'; show(null); }
}
on('bReroll', () => {
  if (run.me.rerolls <= 0) return;
  if (NET.role === 'guest') { netSend({ t: 'reroll' }); return; }
  run.me.rerolls--; openLevelUp(true);
});
on('bSkip', () => {
  if (run.me.skips <= 0) return;
  if (NET.role === 'guest') { netSend({ t: 'skip' }); waitHost(); return; }
  run.me.skips--; run.xp += run.xpNext * 0.1; finishLevel();
});

// ============================================================
// chest
// ============================================================
function openChest(boss) {
  const R = run;
  const L = st.luck, late = R.t > 600;
  let count = 1;
  const r = Math.random();
  if (boss) count = late ? 5 : 3;
  else if (r < 0.03 * L * (late ? 2 : 1)) count = 5;
  else if (r < 0.13 * L) count = 3;
  const items = [];
  for (let i = 0; i < count; i++) {
    const ew = R.weapons.find(evoReady);
    if (ew) { evolveWeapon(ew); items.push({ kind: 'evo', id: ew.id }); continue; }
    const e2 = R.weapons.find(evo2Ready);
    if (e2) { empowerWeapon(e2); items.push({ kind: 'evo2', id: e2.id }); continue; }
    const pool = [];
    for (const w of R.weapons) if (w.lvl < MAX_WLV) pool.push({ kind: 'w', id: w.id });
    for (const id of R.passiveOrder) if (R.passives[id] < PASSIVES[id].max) pool.push({ kind: 'p', id });
    if (!pool.length) { items.push({ kind: 'gold' }); R.gold += 40; continue; }
    const it = pick(pool);
    if (it.kind === 'w') { const w = R.weapons.find(x => x.id === it.id); levelWeapon(w); it.lv = w.lvl; } else { addPassive(it.id); it.lv = R.passives[it.id]; }
    items.push(it);
  }
  const g = Math.round((boss ? rand(80, 150) : rand(20, 60)) * (late ? 1.5 : 1));
  R.gold += g;
  if (SIM) return;
  evo2Hint();
  if (R.player !== R.me) { netChest(R.player, items, count, Math.round(g * st.greed)); return; }
  showChest(items, count, Math.round(g * st.greed));
}
function showChest(items, count, g) {
  state = 'chest';
  input.active = false;
  sfx.chest(); vibrate(60);
  $('chestTitle').textContent = items.some(i => i.kind === 'evo2') ? '진화 강화!' : items.some(i => i.kind === 'evo') ? '진화!' : count > 1 ? `보물상자 ×${count}!` : '보물상자!';
  $('chestItems').innerHTML = items.map(it => {
    if (it.kind === 'evo') { const W = WEAPONS[it.id]; return `<div class="card evo chest-item"><img class="ico" src="${weaponIcon(it.id, true)}" alt=""><div><div class="t gold-t">${W.evoName}<span class="tag">진화</span></div><div class="d">${W.evoDesc}</div></div></div>`; }
    if (it.kind === 'evo2' && EVO2[it.id]) { const W = WEAPONS[it.id]; return `<div class="card evo chest-item"><img class="ico" src="${weaponIcon(it.id, true)}" alt=""><div><div class="t gold-t">${W.evoName}+<span class="tag">강화</span></div><div class="d">${EVO2[it.id].combo} 조합 완성! 진화 무기가 더 강력해졌어요.</div></div></div>`; }
    if (it.kind === 'w') return `<div class="card chest-item"><img class="ico" src="${weaponIcon(it.id)}" alt=""><div><div class="t">${WEAPONS[it.id].name}<span class="tag">Lv ${it.lv}</span></div></div></div>`;
    if (it.kind === 'p') return `<div class="card chest-item"><img class="ico" src="${passiveIconURL(it.id)}" alt=""><div><div class="t">${PASSIVES[it.id].name}<span class="tag">Lv ${it.lv}</span></div></div></div>`;
    return `<div class="card chest-item"><img class="ico" src="${iconByName('coin')}" alt=""><div><div class="t">금화</div></div></div>`;
  }).join('');
  $('chestGold').textContent = `+ ● ${g}`;
  show('chest');
  [...$('chestItems').children].forEach((el, i) => setTimeout(() => { el.classList.add('show'); tone(600 + i * 120, 0.1, 'square', 0.04); }, 250 + i * 280));
}
on('bChestOk', () => { state = 'play'; show(null); if (NET.role === 'guest') netSend({ t: 'chestOk' }); });

// ============================================================
// pause / results
// ============================================================
function invHTML() {
  const R = run;
  $('pWeapons').innerHTML = R.weapons.map(w => `<div class="slot"><img class="ico sm" src="${weaponIcon(w.id, w.evo)}" title="${weaponName(w)}" alt=""><span class="lv">${w.evo2 ? '★★' : w.evo ? '★' : w.lvl}</span></div>`).join('');
  $('pPassives').innerHTML = R.passiveOrder.map(id => `<div class="slot"><img class="ico sm" src="${passiveIconURL(id)}" alt=""><span class="lv">${R.passives[id]}</span></div>`).join('') || '<span class="dim" style="font-size:12px">없음</span>';
}
function pct(v) { const p = Math.round((v - 1) * 100); return (p >= 0 ? '+' : '') + p + '%'; }
function openPause() {
  if (state !== 'play') return;
  state = 'pause';
  input.active = false;
  invHTML();
  $('pStats').innerHTML = [
    ['최대 체력', Math.round(st.maxHp)], ['회복', st.recovery.toFixed(1) + '/초'], ['방어', st.armor],
    ['공격력', pct(st.might)], ['범위', pct(st.area)], ['투사체 속도', pct(st.speed)], ['지속시간', pct(st.duration)],
    ['쿨다운', pct(st.cooldown)], ['투사체 수', '+' + st.amount], ['이동속도', pct(st.move / 72)], ['행운', pct(st.luck)], ['경험치', pct(st.growth)],
  ].map(([a, b]) => `<div class="stat"><span class="dim">${a}</span><b>${b}</b></div>`).join('');
  const owned = id => run.weapons.find(w => w.id === id && !w.evo);
  const rec = recipeHTML(owned);
  const rec2 = comboHTML(id => run.weapons.some(w => w.id === id && w.evo && !w.evo2));
  $('pRecipes').innerHTML = (rec ? `<div class="dim center" style="font-size:12px;margin-bottom:4px">보유 무기 진화법</div>${rec}` : '')
    + (rec2 ? `<div class="dim center" style="font-size:12px;margin:6px 0 4px">진화 강화 조합</div>${rec2}` : '')
    || '<div class="dim center" style="font-size:12px">모든 무기가 최대로 강해졌어요!</div>';
  $('pToggles').innerHTML = togglesHTML();
  bindToggles($('pToggles'));
  $('bQuit').textContent = NET.role ? '이번 판 나가기' : '포기하기';
  show('pause');
  if (NET.role === 'guest') netSend({ t: 'hold', on: true });
}
function resume() {
  if (state !== 'pause') return;
  state = 'play'; show(null);
  if (NET.role === 'guest') netSend({ t: 'hold', on: false });
}
$('pauseBtn').addEventListener('click', openPause);
on('bResume', resume);
on('bQuit', () => {
  const msg = NET.role === 'host' ? '이번 판을 끝낼까요? 동료의 게임도 함께 끝나요. 모은 골드는 받아요.'
    : NET.role === 'guest' ? '이번 판에서 나갈까요? 동료는 혼자 계속해요. 모은 골드는 받아요.' : '이번 판을 포기할까요? 모은 골드는 받아요.';
  if (!confirm(msg)) return;
  if (NET.role === 'guest') netSend({ t: 'quit' });
  gameOver();
});

function gameOver(note) {
  const R = run, me = R.me;
  if (state === 'result') return;
  state = 'result';
  input.active = false;
  use(me);
  if (NET.role === 'host') netGameOver();
  const mul = stageGoldMul(R.si);
  const bonus = Math.floor(R.t / 60) * 10 * st.greed * mul;
  const gold = R.gold * st.greed * mul;
  const earned = Math.floor(gold + bonus);
  save.gold += earned;
  save.runs++; save.kills += R.kills;
  const id = R.char.id;
  save.best[id] = Math.max(save.best[id] || 0, Math.floor(R.t));
  if (R.cleared) save.clears[id] = true;
  const rec = save.stages[R.si] || (save.stages[R.si] = {});
  rec.best = Math.max(rec.best || 0, Math.floor(R.t));
  const newly = R.cleared && !rec.clear;
  if (R.cleared) rec.clear = true;
  const next = STAGES[R.si + 1];
  if (newly && next) save.stage = R.si + 1;
  persist();
  if (SIM) return;
  $('rTitle').textContent = note || (R.cleared ? `★ ${R.S.name} 클리어! ★` : '쓰러졌다…');
  $('rTitle').style.color = R.cleared ? '#ffd040' : '#ff8090';
  $('rStats').innerHTML = [
    ['스테이지', `${R.si + 1}. ${R.S.name}`], ['캐릭터', R.char.name], ['생존 시간', fmtTime(R.t)], ['레벨', R.level], ['처치', R.kills],
    ['획득 골드', `<span class="gold-t">● ${Math.floor(gold)}</span>`], ['생존 보너스', `<span class="gold-t">● ${Math.floor(bonus)}</span>`],
    ['합계', `<span class="gold-t">● ${earned}</span>`],
  ].map(([a, b]) => `<div class="stat"><span class="dim">${a}</span><b>${b}</b></div>`).join('')
    + (newly && next ? `<div class="center gold-t" style="margin-top:8px;font-weight:700">🔓 새 스테이지 열림: STAGE ${R.si + 2} ${next.name}</div>` : newly ? '<div class="center gold-t" style="margin-top:8px;font-weight:700">👑 모든 스테이지를 정복했어요!</div>' : '');
  const rows = R.weapons.map(w => ({ w, d: me.dmgBy[w.id] || 0 })).sort((a, b) => b.d - a.d);
  $('rDmg').innerHTML = '<div class="dim center" style="font-size:12px;margin-bottom:4px">무기별 피해량</div>' + rows.map(({ w, d }) =>
    `<div class="recipe"><img class="ico sm" src="${weaponIcon(w.id, w.evo)}" alt=""><div class="nm"><b>${weaponName(w)}</b> <span class="dim">Lv${w.lvl}</span></div><b>${Math.round(d).toLocaleString()}</b></div>`).join('');
  R.nextSi = !NET.role && R.cleared && next ? R.si + 1 : R.si;
  $('bAgain').textContent = NET.role ? '방으로' : R.nextSi !== R.si ? '다음 스테이지' : '다시 하기';
  $('bMenu').textContent = NET.role ? '방 나가기' : '메인으로';
  show('result');
  sfx.boss();
}
on('bAgain', () => { if (NET.role) showLobby(); else startRun(run.char.id, run.nextSi); });
on('bMenu', () => { if (NET.role) netLeave(); showTitle(); });

// ============================================================
// input
// ============================================================
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  e.preventDefault();
  input.active = true; input.id = e.pointerId;
  input.ox = e.clientX; input.oy = e.clientY; input.jx = input.jy = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  audio();
});
cv.addEventListener('pointermove', e => {
  if (!input.active || e.pointerId !== input.id) return;
  let dx = e.clientX - input.ox, dy = e.clientY - input.oy;
  const d = Math.hypot(dx, dy), R = 46;
  if (d > R) { input.ox = e.clientX - dx / d * R; input.oy = e.clientY - dy / d * R; dx = dx / d * R; dy = dy / d * R; }
  const m = Math.min(d, R) / R;
  if (m < 0.12) { input.jx = input.jy = 0; return; }
  const k = Math.min(1, (m - 0.12) / 0.6) / (Math.hypot(dx, dy) || 1);
  input.jx = dx * k; input.jy = dy * k;
});
const endTouch = e => { if (e.pointerId === input.id) { input.active = false; input.jx = input.jy = 0; } };
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);
window.addEventListener('keydown', e => {
  input.keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'play') openPause();
    else if (state === 'pause') resume();
  }
});
window.addEventListener('keyup', e => { input.keys[e.code] = false; });
window.addEventListener('blur', () => { input.keys = {}; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') openPause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
// balance simulation (?sim=1): headless bot that kites enemies
// ============================================================
function simPick() {
  for (const p of run.players) {
    use(p);
    while (p.pending > 0) {
      const ch = rollChoices();
      ch.sort((a, b) => ({ wup: 0, pup: 1, wnew: 2, pnew: 3 }[a.type] ?? 4) - ({ wup: 0, pup: 1, wnew: 2, pnew: 3 }[b.type] ?? 4));
      applyChoice(ch[0]);
      p.pending--;
    }
  }
  use(run.me);
}
function simBot(P = run.me) {
  let fx = 0, fy = 0;
  for (const e of run.enemies) {
    const dx = P.x - e.x, dy = P.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > 90 * 90) continue;
    const w = (e.boss ? 4 : 1) / Math.max(d2, 25);
    fx += dx * w; fy += dy * w;
  }
  const danger = Math.hypot(fx, fy);
  let target = null, bd = 1e9;
  for (const p of run.pickups) { const d = (p.x - P.x) ** 2 + (p.y - P.y) ** 2; if (d < bd) { bd = d; target = p; } }
  for (const g of run.gems) { const d = (g.x - P.x) ** 2 + (g.y - P.y) ** 2 + 400; if (d < bd) { bd = d; target = g; } }
  if (target && bd < 160 * 160) {
    const d = Math.sqrt(bd) || 1, pullW = danger > 0.03 ? 0.004 : 0.03;
    fx += (target.x - P.x) / d * pullW; fy += (target.y - P.y) / d * pullW;
  }
  fx += Math.cos(run.t * 0.3) * 0.006; fy += Math.sin(run.t * 0.3) * 0.006;
  const l = Math.hypot(fx, fy) || 1;
  if (P === run.me) input.bot = [fx / l, fy / l];
  else P.bot = [fx / l, fy / l];
}
function runSim(charId, powered, duo, si = 0) {
  const saved = save;
  save = loadSave(); save.sound = false;
  if (powered) for (const p of POWERUPS) save.power[p.id] = Math.min(p.max, powered === true ? 2 : powered);
  const list = [{ char: charId, power: save.power, ctrl: 'local' }];
  if (duo) for (const d of duo.split(',')) list.push({ char: d, power: save.power, ctrl: 'bot' });
  newRun(list, si);
  state = 'play';
  let steps = 0, nextSnap = 60;
  const dt = 1 / 30, snaps = [];
  while (state === 'play' && run.t < STAGE_LEN + 30 && steps < 30 * 60 * 25) {
    for (const p of run.players) if (p.ctrl !== 'remote') simBot(p);
    update(dt); if (run.me.pending) simPick(); steps++;
    if (run.t >= nextSnap) { nextSnap += 60; snaps.push(`${Math.round(run.t / 60)}m L${run.level} k${run.kills} e${run.enemies.length} dmgIn${Math.round(run.taken || 0)}`); }
  }
  const out = { stage: si + 1, char: charId + (duo ? '+' + duo : ''), powered, t: Math.round(run.t), lv: run.level, kills: run.kills, gold: Math.round(run.gold), cleared: run.cleared, weapons: run.players.map(p => p.weapons.map(w => w.id + (w.evo2 ? '**' : w.evo ? '*' : w.lvl)).join(',')).join(' | '), takenBy: run.takenBy, snaps, dmg: Object.fromEntries(Object.entries(run.me.dmgBy).map(([k, v]) => [k, Math.round(v)])) };
  save = saved;
  input.bot = null;
  return out;
}

// ============================================================
// boot
// ============================================================
$('loading').remove();
if (SIM) {
  const qs = new URLSearchParams(location.search);
  const chars = (qs.get('chars') || 'knight,mage,rogue').split(',');
  window.SIM_GOD = qs.get('god') === '1';
  window.SIM_VAC = qs.get('vac') === '1';
  const res = [];
  const duo = qs.get('duo');
  const stages = (qs.get('stages') || '1').split(',').map(n => (+n || 1) - 1);
  const pws = (qs.get('pw') || '0,2').split(',').map(Number);
  for (const si of stages) for (const c of chars) for (const pw of pws) res.push(runSim(c, pw, duo, si));
  const pre = document.createElement('pre');
  pre.id = 'simout';
  pre.textContent = JSON.stringify(res);
  document.body.appendChild(pre);
  run = null;
} else {
  showTitle();
  const qs = new URLSearchParams(location.search);
  if (qs.get('shot')) {
    // debug: fast-forward a bot run to inspect visuals (?shot=char&t=secs&ui=levelup|pause|chest|result)
    const list = [{ char: qs.get('shot'), power: save.power, ctrl: 'local' }];
    if (qs.get('duo')) for (const d of qs.get('duo').split(',')) list.push({ char: d, power: save.power, ctrl: 'bot' });
    newRun(list, (+qs.get('stage') || 1) - 1); state = 'play'; show(null);
    const until = +qs.get('t') || 60;
    while (run.t < until && state !== 'result') {
      for (const p of run.players) simBot(p);
      update(1 / 30);
      if (state === 'levelup') { simPick(); state = 'play'; show(null); }
      if (state === 'chest') { state = 'play'; show(null); }
    }
    input.bot = null;
    const ui = qs.get('ui');
    if (ui === 'levelup') { run.me.pending = 1; openLevelUp(); }
    if (ui === 'pause') openPause();
    if (ui === 'chest') openChest(true);
    if (ui === 'result') gameOver();
    if (ui === 'freeze') state = 'frozen';
  }
  requestAnimationFrame(t => { lastT = t; frame(t); });
}
