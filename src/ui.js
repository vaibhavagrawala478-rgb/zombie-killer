// HUD, minimap, floating text, menus and the Emporium shop UI.
import * as THREE from 'three';
import { G } from './state.js';
import { GEMS, GEM_IDS, WEAPONS, WEAPON_BY_ID, PERKS, ZEKE_QUOTES } from './data.js';
import { SHOP_POS } from './world.js';

const $ = (s) => document.querySelector(s);
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pickQ = (k) => ZEKE_QUOTES[k][Math.floor(Math.random() * ZEKE_QUOTES[k].length)];

export function gemSVG(id, cls = '') {
  const c = GEMS[id].css;
  let body;
  switch (id) {
    case 'emerald':
      body = `<polygon points="7,2 17,2 22,7 22,17 17,22 7,22 2,17 2,7" fill="${c}"/><polygon points="9,6 15,6 18,9 18,15 15,18 9,18 6,15 6,9" fill="rgba(255,255,255,.28)"/><polygon points="7,2 17,2 15,6 9,6" fill="rgba(255,255,255,.35)"/><polygon points="22,7 22,17 18,15 18,9" fill="rgba(0,0,0,.22)"/>`; break;
    case 'sapphire':
      body = `<polygon points="12,1 21,6 21,18 12,23 3,18 3,6" fill="${c}"/><polygon points="12,1 21,6 12,12 3,6" fill="rgba(255,255,255,.4)"/><polygon points="12,12 21,6 21,18 12,23" fill="rgba(0,0,0,.25)"/><polygon points="3,6 12,12 3,18" fill="rgba(255,255,255,.1)"/>`; break;
    case 'amethyst':
      body = `<polygon points="12,1 18,7 17,20 12,23 7,20 6,7" fill="${c}"/><polygon points="12,1 18,7 12,9 6,7" fill="rgba(255,255,255,.4)"/><polygon points="12,9 18,7 17,20 12,23" fill="rgba(0,0,0,.28)"/>`; break;
    case 'ruby':
      body = `<polygon points="12,3 21,10 12,22 3,10" fill="${c}"/><polygon points="12,3 21,10 12,12 3,10" fill="rgba(255,255,255,.35)"/><polygon points="3,10 12,12 12,22" fill="rgba(0,0,0,.2)"/><polygon points="21,10 12,12 12,22" fill="rgba(255,255,255,.1)"/>`; break;
    default: // diamond
      body = `<polygon points="6,3 18,3 23,9 12,22 1,9" fill="${c}"/><polygon points="6,3 18,3 16,9 8,9" fill="rgba(255,255,255,.55)"/><polygon points="1,9 8,9 12,22" fill="rgba(0,60,90,.18)"/><polygon points="23,9 16,9 12,22" fill="rgba(0,60,90,.28)"/><polygon points="8,9 16,9 12,22" fill="rgba(255,255,255,.2)"/>`;
  }
  return `<svg class="${cls}" viewBox="0 0 24 24" style="color:${c}">${body}</svg>`;
}

const ZEKE_SVG = `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="112" rx="42" ry="8" fill="rgba(0,0,0,.4)"/>
<rect x="30" y="86" width="60" height="30" rx="8" fill="#6b3a22"/><rect x="52" y="86" width="16" height="30" fill="#8c7a5a"/>
<rect x="38" y="30" width="44" height="50" rx="12" fill="#d9a47c"/>
<path d="M32 62 Q60 112 88 62 L88 74 Q60 120 32 74Z" fill="#cfcfd6"/><path d="M42 66 Q60 84 78 66 Q60 74 42 66Z" fill="#b5b5be"/>
<rect x="44" y="46" width="12" height="6" rx="2" fill="#1a1010"/><rect x="64" y="46" width="12" height="6" rx="2" fill="#1a1010"/>
<rect x="43" y="40" width="14" height="4" fill="#cfcfd6"/><rect x="63" y="40" width="14" height="4" fill="#cfcfd6"/>
<rect x="56" y="52" width="8" height="12" rx="3" fill="#c28e68"/>
<ellipse cx="60" cy="30" rx="44" ry="7" fill="#3a2a1a"/><path d="M40 30 Q40 6 60 6 Q80 6 80 30Z" fill="#4a3624"/><rect x="40" y="22" width="40" height="6" fill="#ffd23a"/>
<rect x="53" y="70" width="14" height="3" rx="1" fill="#3a1a1a"/></svg>`;

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'wave-n', 'wave-info', 'wave-sub', 'cash', 'cash-gain', 'gemrows', 'gemval', 'radar', 'crosshair', 'hitmarker', 'prompt', 'banner', 'feed', 'floaters', 'indicators',
      'hp-fill', 'hp-n', 'ar-fill', 'ar-n', 'wname', 'ammo', 'reload', 'slots', 'menu', 'pause', 'shop', 'gameover', 'fx-damage', 'fx-low', 'fx-scope', 'best', 'go-stats', 'go-sub',
      'wave-prog', 'bossbar', 'boss-fill', 'hint', 'carry', 'streak', 'settings'])
      this.el[id] = document.getElementById(id);
    this.streakN = 0; this.streakT = 0;
    this.bossHp = 1;
    this.initSettings();
    this.rctx = this.el.radar.getContext('2d');
    this.icons = {};
    this.cache = {};
    this.floaters = []; this.fpool = [];
    this.pendingCash = 0; this.cashT = 0; this.hitT = 0;
    this.v = new THREE.Vector3();
    this.tab = 'armory';
    this.say_ = '';

    // gem rows
    this.el.gemrows.innerHTML = GEM_IDS.map(id => `<div class="gemrow" data-g="${id}">${gemSVG(id)}<span>${GEMS[id].name}</span><span class="n">0</span></div>`).join('');
    this.gemRows = Object.fromEntries(GEM_IDS.map(id => [id, this.el.gemrows.querySelector(`[data-g=${id}]`)]));
    this.el.shop.addEventListener('click', (e) => this.shopClick(e));
    this.showBest();
  }

  setIcons(icons) {
    this.icons = icons;
    this.el.slots.innerHTML = WEAPONS.map((w, i) => `<div class="slot" data-w="${w.id}"><span>${i + 1}</span><img src="${icons[w.id]}"></div>`).join('');
    this.slotEls = Object.fromEntries(WEAPONS.map(w => [w.id, this.el.slots.querySelector(`[data-w=${w.id}]`)]));
  }

  showBest() {
    let b = null; try { b = JSON.parse(localStorage.getItem('zk_best')); } catch (e) { /* ignore */ }
    this.el.best.innerHTML = b ? `BEST RUN: WAVE <b>${b.wave}</b> · <b>${b.kills}</b> KILLS · <b>${fmt(b.cash)}</b> EARNED` : '';
  }

  show(name) {
    for (const n of ['menu', 'pause', 'shop', 'gameover', 'settings']) this.el[n].classList.toggle('hidden', n !== name);
    this.el.hud.classList.toggle('hidden', name === 'menu' || name === 'gameover' || (name === 'settings' && G.state === 'menu'));
    this.current = name;
  }

  // ---------- settings ----------
  initSettings() {
    const S = G.settings, $id = (i) => document.getElementById(i);
    const sliders = [['sens', (v) => v.toFixed(2) + '×'], ['fov', (v) => v + '°'], ['volume', (v) => Math.round(v * 100) + '%'], ['music', (v) => Math.round(v * 100) + '%']];
    for (const [k, f] of sliders) {
      const input = $id('s-' + k), out = $id('o-' + k);
      input.value = S[k]; out.textContent = f(+S[k]);
      input.addEventListener('input', () => { S[k] = +input.value; out.textContent = f(S[k]); G.saveSettings(); G.sound.applyVolume(); });
    }
    const q = $id('s-quality'); q.value = S.quality;
    q.addEventListener('change', () => { S.quality = q.value; G.saveSettings(); G.applySettings?.(); });
    for (const k of ['bloom', 'numbers']) {
      const input = $id('s-' + k); input.checked = !!S[k];
      input.addEventListener('change', () => { S[k] = input.checked; G.saveSettings(); G.applySettings?.(); });
    }
    $id('open-settings').addEventListener('click', () => this.openSettings());
    $id('pause-settings').addEventListener('click', () => this.openSettings());
    $id('settings-back').addEventListener('click', () => this.show(this.settingsFrom));
  }
  openSettings() { this.settingsFrom = this.current === 'pause' ? 'pause' : 'menu'; this.show('settings'); }
  hideOverlays() { this.show(null); }

  // ---------- per-frame HUD ----------
  setText(key, value) { if (this.cache[key] !== value) { this.cache[key] = value; const e = this.el[key]; if (e) e.textContent = value; } }

  update(dt, waveInfo) {
    const P = G.player;
    this.setText('wave-n', 'WAVE ' + waveInfo.n);
    this.setText('wave-info', waveInfo.info);
    this.setText('wave-sub', waveInfo.sub);
    this.setText('cash', fmt(P.cash));
    // bars
    const hpR = P.hp / P.maxHp;
    this.el['hp-fill'].style.transform = `scaleX(${hpR})`;
    this.setText('hp-n', Math.ceil(P.hp));
    this.el['ar-fill'].style.transform = `scaleX(${P.armor / 100})`;
    this.setText('ar-n', Math.ceil(P.armor));
    this.el['fx-low'].style.opacity = P.hp < 35 && !P.dead ? (1 - P.hp / 35) * 0.9 : 0;
    // gems
    let val = 0;
    for (const id of GEM_IDS) {
      const n = P.gems[id], row = this.gemRows[id];
      if (this.cache['g' + id] !== n) { this.cache['g' + id] = n; row.querySelector('.n').textContent = n; row.classList.toggle('has', n > 0); }
      val += n * G.market.price(id);
    }
    this.setText('gemval', fmt(val));
    // ammo
    this.ammoChanged();
    if (P.reloadT > 0) { this.el.reload.style.visibility = 'visible'; this.el.reload.firstChild.style.width = (100 * (1 - P.reloadT / P.reloadTotal)) + '%'; }
    else this.el.reload.style.visibility = 'hidden';
    // crosshair
    const w = P.w;
    const spread = (w.spread * (P.moving ? 1.5 : 1) * (1 - P.ads * 0.55) + P.bloom) * 900 + (P.onGround ? 0 : 14);
    const gap = 7 + Math.min(60, spread), s = this.el.crosshair.style;
    s.setProperty('--t', (-gap - 8) + 'px'); s.setProperty('--b', gap + 'px'); s.setProperty('--l', (-gap - 8) + 'px'); s.setProperty('--r', gap + 'px');
    s.opacity = (w.scope && P.ads > 0.5) || P.dead ? 0 : 1 - P.ads * 0.35;
    // prompt
    const showP = P.nearShop && G.state === 'playing' && !P.dead;
    if (this.cache.prompt !== showP) {
      this.cache.prompt = showP;
      this.el.prompt.classList.toggle('show', showP);
      if (showP) this.el.prompt.innerHTML = `<kbd>E</kbd>OLD ZEKE'S EMPORIUM`;
    }
    // wave progress
    this.el['wave-prog'].style.width = (waveInfo.progress * 100).toFixed(1) + '%';
    // boss bar
    const boss = G.zombies.list.find(z => !z.dead && z.def.boss);
    this.el.bossbar.classList.toggle('hidden', !boss);
    if (boss) this.el['boss-fill'].style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
    // reload / ammo hint
    const sl = P.slot, magMax = P.magSize(P.cur);
    let hint = '';
    if (!P.dead && G.state === 'playing' && P.reloadT <= 0) {
      if (sl.mag === 0 && sl.reserve === 0) hint = 'NO AMMO — VISIT THE EMPORIUM';
      else if (sl.mag === 0 || (sl.mag <= magMax * 0.25 && sl.reserve > 0 && magMax > 3)) hint = sl.reserve > 0 ? 'RELOAD [R]' : '';
    }
    this.setHtml('hint', hint, (e) => e.classList.toggle('show', !!hint));
    // gems-on-you reminder
    let carried = 0, value = 0;
    for (const id of GEM_IDS) { carried += P.gems[id]; value += P.gems[id] * G.market.price(id); }
    const showCarry = carried > 0 && !P.nearShop && G.state === 'playing' && !P.dead;
    const dist = Math.round(Math.hypot(P.pos.x - SHOP_POS.x, P.pos.z - SHOP_POS.z));
    this.setHtml('carry', showCarry ? `◆ ${carried} GEM${carried > 1 ? 'S' : ''} · <b>${fmt(value)}</b> — EMPORIUM ${dist}m` : '', (e) => e.classList.toggle('show', showCarry));
    // streak decay
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streakN = 0; }
    // hit marker fade
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.className = ''; }
    // cash gain
    if (this.cashT > 0) { this.cashT -= dt; if (this.cashT <= 0) { this.el['cash-gain'].style.opacity = 0; this.pendingCash = 0; } }
    this.updateFloaters(dt);
    this.drawRadar();
  }

  setHtml(key, html, after) {
    if (this.cache['h' + key] !== html) { this.cache['h' + key] = html; if (html) this.el[key].innerHTML = html; after?.(this.el[key]); }
  }

  ammoChanged() {
    const P = G.player, s = P.slot; if (!s) return;
    const res = s.reserve === Infinity ? '∞' : s.reserve;
    const key = P.cur + s.mag + '/' + res;
    if (this.cache.ammoKey === key) return;
    this.cache.ammoKey = key;
    this.el.ammo.innerHTML = `${s.mag}<small> / ${res}</small>`;
    this.el.ammo.classList.toggle('low', s.mag <= Math.ceil(P.magSize(P.cur) * 0.25) && res !== 0);
  }
  weaponChanged() {
    const P = G.player;
    this.setText('wname', P.w.name.toUpperCase());
    this.cache.ammoKey = null; this.ammoChanged();
    if (!this.slotEls) return;
    for (const w of WEAPONS) {
      const e = this.slotEls[w.id];
      e.classList.toggle('own', !!P.owned[w.id]); e.classList.toggle('cur', P.cur === w.id);
    }
  }
  setScope(on) { if (this.cache.scope !== on) { this.cache.scope = on; this.el['fx-scope'].style.display = on ? 'block' : 'none'; } }

  // ---------- events ----------
  hitMarker(head, kill) {
    const h = this.el.hitmarker;
    h.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    this.hitT = kill ? 0.18 : 0.09;
  }
  killMarker() {
    this.streakN++; this.streakT = 2.5;
    const labels = { 3: 'TRIPLE KILL', 4: 'QUAD KILL', 5: 'MEGA KILL', 8: 'RAMPAGE', 12: 'UNSTOPPABLE', 16: 'GODLIKE' };
    const label = this.streakN === 2 ? 'DOUBLE KILL' : labels[this.streakN] || (this.streakN > 16 && this.streakN % 5 === 0 ? `${this.streakN} KILL STREAK` : null);
    if (!label) return;
    const s = this.el.streak; s.textContent = label; s.classList.remove('show'); void s.offsetWidth; s.classList.add('show');
  }
  cashPop(n) {
    this.pendingCash += n; this.cashT = 1.4;
    const e = this.el['cash-gain']; e.textContent = '+' + fmt(this.pendingCash); e.style.opacity = 1;
  }
  gemPop(id) {
    const row = this.gemRows[id]; row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop');
    const d = document.createElement('div');
    d.className = 'feeditem'; d.style.color = GEMS[id].css; d.innerHTML = `+1 ${GEMS[id].name.toUpperCase()} <span style="color:#9a93b3;font-size:16px">${fmt(G.market.price(id))}</span>`;
    this.el.feed.appendChild(d); setTimeout(() => d.remove(), 1800);
    if (this.el.feed.children.length > 6) this.el.feed.firstChild.remove();
  }
  feed(text, color = '#fff') {
    const d = document.createElement('div'); d.className = 'feeditem'; d.style.color = color; d.textContent = text;
    this.el.feed.appendChild(d); setTimeout(() => d.remove(), 1800);
  }
  // first-sighting tip for a new enemy type
  tip(title, text, color = '#ff3b4e') {
    const box = document.getElementById('tips');
    const d = document.createElement('div'); d.className = 'tipitem'; d.style.setProperty('--c', color);
    d.innerHTML = `<b>NEW: ${title}</b><span>${text}</span>`;
    box.appendChild(d); setTimeout(() => d.remove(), 7000);
    while (box.children.length > 3) box.firstChild.remove();
  }
  banner(title, sub = '', cls = '') {
    const b = this.el.banner;
    b.className = cls; b.querySelector('h1').textContent = title; b.querySelector('p').textContent = sub;
    void b.offsetWidth; b.classList.add('show');
  }
  damageFlash(amount) {
    const f = this.el['fx-damage']; f.style.transition = 'none'; f.style.opacity = Math.min(1, 0.45 + amount / 40);
    void f.offsetWidth; f.style.transition = 'opacity .5s'; f.style.opacity = 0;
  }
  hitIndicator(worldAngle, yaw) {
    const d = document.createElement('div'); d.className = 'hind';
    d.style.transform = `rotate(${(yaw + Math.PI - worldAngle)}rad)`;
    this.el.indicators.appendChild(d); setTimeout(() => d.remove(), 1000);
  }
  damageNumber(x, y, z, amount, head, kill) {
    if (!G.settings.numbers || this.floaters.length > 30) return;
    let el = this.fpool.pop();
    if (!el) { el = document.createElement('div'); this.el.floaters.appendChild(el); }
    el.className = 'dn' + (head ? ' head' : '') + (kill ? ' kill' : '');
    el.textContent = amount; el.style.display = 'block';
    this.floaters.push({ el, x: x + (Math.random() - 0.5) * 0.4, y, z: z + (Math.random() - 0.5) * 0.4, age: 0, vy: 1.4 + Math.random() * 0.8 });
  }
  updateFloaters(dt) {
    const cam = G.camera, W = innerWidth, H = innerHeight;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.age += dt; f.y += f.vy * dt;
      if (f.age > 0.8) { f.el.style.display = 'none'; this.fpool.push(f.el); this.floaters.splice(i, 1); continue; }
      this.v.set(f.x, f.y, f.z).project(cam);
      if (this.v.z > 1) { f.el.style.opacity = 0; continue; }
      f.el.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * W}px,${(-this.v.y * 0.5 + 0.5) * H}px) translate(-50%,-50%) scale(${1 + (f.age < 0.1 ? (0.1 - f.age) * 6 : 0)})`;
      f.el.style.left = '0'; f.el.style.top = '0';
      f.el.style.opacity = f.age > 0.5 ? 1 - (f.age - 0.5) / 0.3 : 1;
    }
  }

  // ---------- radar ----------
  drawRadar() {
    const c = this.rctx, S = 412, R = S / 2, range = 40, k = (R - 6) / range;
    const P = G.player;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(R, R, R - 3, 0, 6.3); c.clip();
    c.fillStyle = 'rgba(6,10,20,0.6)'; c.fillRect(0, 0, S, S);
    c.strokeStyle = 'rgba(53,224,255,0.18)'; c.lineWidth = 2;
    for (const f of [0.33, 0.66, 1]) { c.beginPath(); c.arc(R, R, (R - 6) * f, 0, 6.3); c.stroke(); }
    c.beginPath(); c.moveTo(R, 6); c.lineTo(R, S - 6); c.moveTo(6, R); c.lineTo(S - 6, R); c.stroke();
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const toScreen = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z; return [R + (dx * rx + dz * rz) * k, R - (dx * fx + dz * fz) * k]; };
    // arena edge
    c.strokeStyle = 'rgba(255,61,154,0.35)'; c.lineWidth = 3; c.beginPath();
    { const [ex, ey] = toScreen(0, 0); c.arc(ex, ey, 60 * k, 0, 6.3); } c.stroke();
    // view cone
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.moveTo(R, R); c.arc(R, R, R, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); c.fill();
    // gems
    for (const g of G.gems.list) {
      const [sx, sy] = toScreen(g.group.position.x, g.group.position.z);
      if (Math.hypot(sx - R, sy - R) > R - 8) continue;
      c.fillStyle = GEMS[g.id].css; c.save(); c.translate(sx, sy); c.rotate(0.785); c.fillRect(-5, -5, 10, 10); c.restore();
    }
    // zombies
    for (const z of G.zombies.list) {
      if (z.dead) continue;
      const [sx, sy] = toScreen(z.pos.x, z.pos.z);
      if (Math.hypot(sx - R, sy - R) > R - 6) continue;
      c.fillStyle = z.def.radar || '#ff3b4e';
      c.beginPath(); c.arc(sx, sy, z.key === 'boss' ? 10 : z.key === 'brute' || z.key === 'bloater' ? 7 : 5, 0, 6.3); c.fill();
    }
    // shop
    {
      let [sx, sy] = toScreen(SHOP_POS.x, 0);
      let dx = sx - R, dy = sy - R; const d = Math.hypot(dx, dy), lim = R - 20;
      const out = d > lim; if (out) { dx *= lim / d; dy *= lim / d; }
      c.fillStyle = '#ffd23a'; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.beginPath(); c.arc(R + dx, R + dy, 15, 0, 6.3); c.fill(); c.stroke();
      c.fillStyle = '#000'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', R + dx, R + dy + 1);
    }
    // player
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(R, R - 11); c.lineTo(R + 8, R + 9); c.lineTo(R, R + 4); c.lineTo(R - 8, R + 9); c.closePath(); c.fill();
    c.restore();
  }

  marketUpdated() { if (G.state === 'shop') this.renderShop(); }

  // ---------- game over ----------
  showGameOver(stats, wave) {
    const t = Math.round(stats.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    this.el['go-sub'].textContent = wave >= 5 ? 'THE DEAD WILL REMEMBER YOU' : 'THEY GOT YOU. THEY ALWAYS DO.';
    this.el['go-stats'].innerHTML = [
      ['WAVE REACHED', wave], ['ZOMBIES KILLED', stats.kills], ['GEMS COLLECTED', stats.gems],
      ['CASH EARNED', fmt(stats.cash)], ['GEM SALES', fmt(stats.gemCash)], ['TIME SURVIVED', `${mm}:${ss}`],
    ].map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
    let best = null; try { best = JSON.parse(localStorage.getItem('zk_best')); } catch (e) { /* ignore */ }
    if (!best || wave > best.wave || (wave === best.wave && stats.kills > best.kills)) {
      try { localStorage.setItem('zk_best', JSON.stringify({ wave, kills: stats.kills, cash: stats.cash })); } catch (e) { /* ignore */ }
      this.el['go-sub'].textContent += '  ·  NEW PERSONAL BEST!';
    }
    this.showBest();
    this.show('gameover');
  }

  // ---------- SHOP ----------
  openShop() {
    const P = G.player;
    const hasGems = GEM_IDS.some(id => P.gems[id] > 0);
    this.tab = hasGems ? 'gems' : this.tab;
    this.say_ = pickQ('welcome');
    this.shownCash = P.cash;
    this.show('shop');
    this.renderShop();
  }
  say(type) { this.say_ = pickQ(type); const b = this.el.shop.querySelector('.bubble'); if (b) b.textContent = this.say_; }

  renderShop() {
    const P = G.player, M = G.market, sc = this.el.shop.querySelector('.tabcontent');
    const keep = sc ? sc.scrollTop : 0;
    const gemCount = GEM_IDS.reduce((a, id) => a + P.gems[id], 0);
    const gemValue = GEM_IDS.reduce((a, id) => a + P.gems[id] * M.price(id), 0);
    const tabs = [['armory', 'ARMORY'], ['supplies', 'SUPPLIES & PERKS'], ['gems', 'GEM EXCHANGE']];
    this.el.shop.innerHTML = `
    <div class="shop">
      <div class="shop-head">
        <div class="shop-title">OLD ZEKE'S <span>EMPORIUM</span></div>
        <div class="shop-cash"><small>YOUR CASH</small><span id="shop-cash-n">${fmt(this.shownCash ?? P.cash)}</span></div>
        <button class="xbtn" data-act="close" title="Close (E)">✕</button>
      </div>
      <div class="ticker"><div class="tag">MARKET NEWS</div><div class="txt">${M.headline} &nbsp; ◆ &nbsp; ${M.headline}</div></div>
      <div class="shop-body">
        <div class="keeper">${ZEKE_SVG}<div class="bubble">${this.say_}</div>
          <div class="inv"><h4>YOUR GEMS</h4>
            ${GEM_IDS.map(id => `<div class="r">${gemSVG(id)}<span>${GEMS[id].name}</span><b>${P.gems[id]}</b></div>`).join('')}
            <div class="r" style="border-top:1px solid rgba(255,255,255,.12);margin-top:4px;color:var(--gold)"><span>Worth</span><b>${fmt(gemValue)}</b></div>
          </div>
        </div>
        <div class="shop-main">
          <div class="tabs">${tabs.map(([k, n]) => `<div class="tab ${this.tab === k ? 'on' : ''} ${k === 'gems' ? 'gem' : ''}" data-act="tab" data-tab="${k}"><kbd class="k" style="font-size:11px">${tabs.findIndex(t => t[0] === k) + 1}</kbd>${n}${k === 'gems' && gemCount ? `<span class="badge">${gemCount}</span>` : ''}</div>`).join('')}</div>
          <div class="tabcontent">${this.tab === 'armory' ? this.armoryHTML() : this.tab === 'supplies' ? this.suppliesHTML() : this.gemsHTML()}</div>
        </div>
      </div>
      <div class="shop-foot"><span>Spend it all. The dead don't take credit.</span><button class="btn" data-act="close">BACK TO THE SLAUGHTER [E]</button></div>
    </div>`;
    this.el.shop.querySelector('.tabcontent').scrollTop = keep;
    if (this.tab === 'gems') this.drawSparks();
    this.tweenCash(P.cash);
  }

  // count the cash readout up/down so sales and purchases feel weighty
  tweenCash(to) {
    const from = this.shownCash ?? to, t0 = performance.now(), dur = 450;
    const gain = to >= from;
    cancelAnimationFrame(this.cashRaf);
    const step = (now) => {
      const el = document.getElementById('shop-cash-n'); if (!el) return;
      const k = Math.min(1, (now - t0) / dur), v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      this.shownCash = v; el.textContent = fmt(v);
      el.style.color = k < 1 ? (gain ? '#b6ffd0' : '#ff9aa6') : '';
      if (k < 1) this.cashRaf = requestAnimationFrame(step);
    };
    if (from === to) { this.shownCash = to; return; }
    this.cashRaf = requestAnimationFrame(step);
  }

  setTab(k) { if (this.tab === k) return; this.tab = k; G.sound.uiClick(); this.renderShop(); }

  btn(label, cost, act, data, cls = '', canAfford = true) {
    const poor = !canAfford;
    return `<button class="b ${cls} ${poor ? 'poor' : ''}" data-act="${act}" ${data}>${label}${cost !== null ? ` <em>${fmt(cost)}</em>` : ''}</button>`;
  }

  armoryHTML() {
    const P = G.player;
    const maxDmg = Math.max(...WEAPONS.map(w => w.dmg * w.pellets * 1.6)), maxRate = 14, maxMag = 32, maxRange = 300;
    // sqrt scale so a 32-damage pistol isn't a sliver next to a 340-damage rocket
    const bar = (lbl, v, max, txt) => `<div class="stat"><span>${lbl}</span><div class="bg"><i style="width:${Math.max(6, Math.min(100, Math.sqrt(v / max) * 100))}%"></i></div><b>${txt}</b></div>`;
    return `<div class="grid">` + WEAPONS.map(w => {
      const own = P.owned[w.id], dmg = own ? P.dmgOf(w.id) : w.dmg;
      const total = Math.round(dmg * w.pellets);
      const mag = own ? P.magSize(w.id) : w.mag;
      let acts = '';
      if (!own) acts = this.btn('BUY', w.price, 'buyw', `data-id="${w.id}"`, '', P.cash >= w.price);
      else {
        if (w.packSize) {
          const full = P.ammoFull(w.id);
          acts += full ? `<button class="b max">AMMO FULL</button>` : this.btn(`+${w.packSize} AMMO`, w.packCost, 'ammo', `data-id="${w.id}"`, 'alt', P.cash >= w.packCost);
        }
        const dc = P.dmgUpgradeCost(w.id);
        acts += dc === null ? `<button class="b max">DMG MAX</button>` : this.btn(`DMG +25% (${own.dmgLvl}/3)`, dc, 'dmg', `data-id="${w.id}"`, 'gold', P.cash >= dc);
        const mc = P.magUpgradeCost(w.id);
        acts += mc === null ? `<button class="b max">EXT MAG ✓</button>` : this.btn('EXT MAG +50%', mc, 'mag', `data-id="${w.id}"`, 'gold', P.cash >= mc);
        if (P.cur !== w.id) acts += `<button class="b alt" data-act="equip" data-id="${w.id}">EQUIP</button>`;
      }
      const reserve = own ? (own.reserve === Infinity ? '∞' : `${own.reserve}/${w.maxReserve}`) : null;
      return `<div class="card ${P.cur === w.id ? 'eq' : ''}" data-card="${w.id}">
        <div class="top"><img src="${this.icons[w.id]}"><div><h3>${w.name}</h3><div class="tag">${w.tag}${P.cur === w.id ? ' · EQUIPPED' : ''}</div></div>
          <div class="price ${own ? 'owned' : ''}">${own ? 'OWNED' : fmt(w.price)}</div></div>
        <p class="d">${w.desc}</p>
        ${bar('DAMAGE', total, maxDmg, total)}
        ${bar('RATE', w.rate, maxRate, w.rate + '/s')}
        ${bar('MAGAZINE', mag, maxMag, mag)}
        ${bar('RANGE', w.range, maxRange, w.range + 'm')}
        ${reserve ? `<div class="have" style="font-size:12px;color:var(--dim);letter-spacing:.12em">RESERVE AMMO <b style="color:var(--text)">${reserve}</b></div>` : ''}
        <div class="acts">${acts}</div></div>`;
    }).join('') + `</div>`;
  }

  suppliesHTML() {
    const P = G.player;
    return `<div class="grid">` + PERKS.map(p => {
      const lvl = P.perks[p.id] || 0, cost = P.perkCost(p);
      let act;
      if (p.consumable) act = this.btn('BUY', cost, 'perk', `data-id="${p.id}"`, '', P.cash >= cost);
      else act = lvl >= p.max ? `<button class="b max">MAXED</button>` : this.btn(lvl ? 'UPGRADE' : 'BUY', cost, 'perk', `data-id="${p.id}"`, 'gold', P.cash >= cost);
      const pips = p.consumable ? '' : `<div class="pips">${Array.from({ length: p.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
      const extra = p.id === 'medkit' ? `<div class="have" style="font-size:12px;color:var(--dim)">HEALTH ${Math.ceil(P.hp)} / ${P.maxHp}</div>` : p.id === 'armor' ? `<div class="have" style="font-size:12px;color:var(--dim)">ARMOR ${Math.ceil(P.armor)} / 100</div>` : '';
      return `<div class="card perk" data-card="${p.id}"><div class="top"><div class="ico">${p.icon}</div><div><h3>${p.name}</h3><div class="tag">${p.consumable ? 'CONSUMABLE' : `LEVEL ${lvl} / ${p.max}`}</div></div></div>
        <p class="d">${p.desc}</p>${pips}${extra}<div class="acts">${act}</div></div>`;
    }).join('') + `</div>`;
  }

  gemsHTML() {
    const P = G.player, M = G.market;
    const total = GEM_IDS.reduce((a, id) => a + P.gems[id] * M.price(id), 0);
    const haggle = (P.perks.haggler || 0) * 6;
    return `<div class="gemex-top">
      <div class="tip">Prices drift over time and spike on news. Hold rare gems for a boom — or cash out before a crash.${haggle ? ` <b style="color:var(--gold)">Haggler bonus +${haggle}%</b>` : ''}</div>
      ${total > 0 ? this.btn('SELL EVERYTHING', total, 'sellall', '', 'gold') : `<button class="b max">NO GEMS TO SELL</button>`}
    </div>` + GEM_IDS.map(id => {
      const n = P.gems[id], price = M.price(id), base = GEMS[id].base, diff = (M.mult[id] - 1) * 100;
      const tr = M.trend[id];
      const arrow = tr > 0.02 ? '▲' : tr < -0.02 ? '▼' : '■';
      return `<div class="grow" data-card="g-${id}">
        ${gemSVG(id, 'gem')}
        <div><div class="nm" style="color:${GEMS[id].css}">${GEMS[id].name.toUpperCase()}</div><div class="have">YOU HAVE ${n} · BASE ${fmt(base)}</div></div>
        <div><div class="pr">${fmt(price)}</div><div class="ch ${diff >= 0 ? 'up' : 'dn2'}">${arrow} ${diff >= 0 ? '+' : ''}${diff.toFixed(0)}% vs base</div></div>
        <canvas class="spark" width="240" height="76" data-spark="${id}"></canvas>
        <div class="btns">${n > 0 ? this.btn('SELL 1', price, 'sell1', `data-id="${id}"`) + this.btn(`SELL ALL (${n})`, price * n, 'sellg', `data-id="${id}"`, 'gold') : `<button class="b max">NONE</button>`}</div>
      </div>`;
    }).join('');
  }

  drawSparks() {
    this.el.shop.querySelectorAll('canvas[data-spark]').forEach(cv => {
      const id = cv.dataset.spark, h = G.market.hist[id], c = cv.getContext('2d'), W = cv.width, H = cv.height;
      const min = 0.4, max = 2.3;
      c.clearRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); const y1 = H - (1 - min) / (max - min) * H; c.moveTo(0, y1); c.lineTo(W, y1); c.stroke();
      const up = h[h.length - 1] >= h[h.length - 2];
      c.strokeStyle = up ? '#46ff8a' : '#ff3b4e'; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
      h.forEach((v, i) => { const x = i / (h.length - 1) * (W - 6) + 3, y = H - (v - min) / (max - min) * (H - 6) - 3; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
      const lx = W - 3, ly = H - (h[h.length - 1] - min) / (max - min) * (H - 6) - 3;
      c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(lx, ly, 4, 0, 6.3); c.fill();
    });
  }

  shopClick(e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, id = t.dataset.id, P = G.player, S = G.sound;
    if (act === 'close') { G.closeShop(true); return; }
    if (act === 'tab') { this.setTab(t.dataset.tab); return; }
    let r, flashId = id, quote = 'buy';
    switch (act) {
      case 'buyw': r = P.buyWeapon(id); break;
      case 'ammo': r = P.buyAmmo(id); break;
      case 'dmg': r = P.upgradeDmg(id); break;
      case 'mag': r = P.upgradeMag(id); break;
      case 'equip': P.switchTo(id); r = { ok: true, silent: true }; break;
      case 'perk': r = P.buyPerk(id); break;
      case 'sell1': r = P.sellGem(id, 1); quote = 'sell'; flashId = 'g-' + id; break;
      case 'sellg': r = P.sellGem(id, 'all'); quote = 'sell'; flashId = 'g-' + id; break;
      case 'sellall': r = P.sellAll(); quote = 'sell'; flashId = null; break;
      default: return;
    }
    if (r.ok) {
      if (!r.silent) { if (quote === 'sell') S.cash(r.total > 600); else S.buy(); }
      else S.uiClick();
      this.say_ = pickQ(r.silent ? 'welcome' : quote);
    } else {
      S.deny(); this.say_ = pickQ(r.why === 'poor' ? 'poor' : 'full');
    }
    this.weaponChanged();
    this.renderShop();
    if (r.ok && flashId) { const c = this.el.shop.querySelector(`[data-card="${flashId}"]`); if (c) c.classList.add('flash'); }
  }
}
