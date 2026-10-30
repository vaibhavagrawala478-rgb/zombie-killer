// Player: movement, camera, weapons, viewmodel, rockets, and the shop's buy/sell logic.
import * as THREE from 'three';
import { G } from './state.js';
import { WEAPONS, WEAPON_BY_ID, GEMS, GEM_IDS, PERKS } from './data.js';
import { buildGun } from './gunmodels.js';
import { SHOP_POS, SHOP_RADIUS } from './world.js';

const EYE = 1.7, FLASH_INTENSITY = 9;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// where the gun sits when aiming down sights (y, z) so the rear sight lines up with the crosshair
const ADS = { pistol: [-0.088, -0.33], smg: [-0.082, -0.36], shotgun: [-0.088, -0.4], ar: [-0.085, -0.38], sniper: [-0.1, -0.4], rocket: [-0.165, -0.32] };

function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.translate(64, 64);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,190,80,0.8)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  x.fillStyle = g; x.fillRect(-64, -64, 128, 128);
  x.fillStyle = 'rgba(255,230,160,0.9)';
  for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, -4); x.lineTo(62, 0); x.lineTo(0, 4); x.fill(); }
  return new THREE.CanvasTexture(c);
}

export class Player {
  constructor(camera, scene) {
    this.camera = camera; this.scene = scene;
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    this.vmRoot = new THREE.Group();
    camera.add(this.vmRoot);
    this.vms = {};
    const flashMat = new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    for (const w of WEAPONS) {
      const gun = buildGun(w.id);
      gun.traverse(o => { o.frustumCulled = false; });
      const fl = new THREE.Sprite(flashMat.clone()); fl.scale.setScalar(0.4); fl.visible = false;
      gun.userData.muzzle.add(fl); gun.userData.flash = fl;
      gun.visible = false;
      this.vmRoot.add(gun); this.vms[w.id] = gun;
    }
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 12, 1.8);
    camera.add(this.muzzleLight);

    // flashlight
    // shallow falloff: a steep one blows out the viewmodel sitting half a metre from the lamp
    this.flash = new THREE.SpotLight(0xdfe8ff, FLASH_INTENSITY, 55, 0.5, 0.65, 0.5);
    this.flash.position.set(0.15, -0.12, 0.1);
    this.flashTarget = new THREE.Object3D(); this.flashTarget.position.set(0, 0, -10);
    camera.add(this.flash, this.flashTarget);
    this.flash.target = this.flashTarget;
    this.flashOn = true;

    this.rockets = [];
    this.rocketGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8).rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0x555a50, metalness: 0.6, roughness: 0.4 });
    this.rocketTipGeo = new THREE.ConeGeometry(0.07, 0.2, 8).rotateX(-Math.PI / 2);
    this.rocketTipMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });

    this._v = new THREE.Vector3(); this._o = new THREE.Vector3(); this._d = new THREE.Vector3();
    this._mz = new THREE.Vector3(); this._f = new THREE.Vector3(); this._r = new THREE.Vector3(); this._u = new THREE.Vector3();
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.pos.set(0, 0, 13); this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0; this.punch = 0; this.roll = 0;
    this.maxHp = 100; this.hp = 100; this.armor = 0;
    this.cash = 0; this.gems = {}; for (const id of GEM_IDS) this.gems[id] = 0;
    this.perks = {};
    this.owned = {};
    this.owned.pistol = { mag: 12, reserve: Infinity, dmgLvl: 0, ext: false };
    this.cur = 'pistol'; this.last = 'pistol';
    this.cool = 0; this.reloadT = 0; this.reloadTotal = 1; this.swapT = 0.3;
    this.ads = 0; this.bloom = 0; this.vmKick = 0; this.flashT = 0; this.bobT = 0; this.stepT = 0;
    this.lookDx = 0; this.lookDy = 0; this.sway = new THREE.Vector2();
    this.onGround = true; this.moving = false; this.sprinting = false;
    this.dead = false; this.deadT = 0; this.nearShop = false; this.hurtT = 0; this.heartT = 0; this.shotCount = 0;
    this.fov = G.settings.fov;
    for (const r of this.rockets) this.scene.remove(r.mesh);
    this.rockets.length = 0;
    this.setViewmodel();
  }

  get w() { return WEAPON_BY_ID[this.cur]; }
  get slot() { return this.owned[this.cur]; }
  magSize(id) { const w = WEAPON_BY_ID[id], s = this.owned[id]; return Math.ceil(w.mag * (s?.ext ? 1.5 : 1)); }
  dmgOf(id) { return WEAPON_BY_ID[id].dmg * (1 + 0.25 * (this.owned[id]?.dmgLvl || 0)); }
  get eye() { return this.pos.y + EYE; }

  setViewmodel() {
    for (const id in this.vms) this.vms[id].visible = id === this.cur;
  }

  switchTo(id) {
    if (!this.owned[id] || id === this.cur) return;
    this.last = this.cur; this.cur = id;
    this.reloadT = 0; this.swapT = 0.32; this.ads = 0;
    this.setViewmodel(); G.sound.swap(); G.ui.weaponChanged();
  }
  cycle(dir) {
    const ids = WEAPONS.filter(w => this.owned[w.id]).map(w => w.id);
    const i = ids.indexOf(this.cur);
    this.switchTo(ids[(i + dir + ids.length) % ids.length]);
  }

  addCash(n) { this.cash += n; G.stats.cash += n; }

  // ---------- damage ----------
  hurt(amount, from, self = false, dot = false) {
    if (this.dead || G.state !== 'playing') return;
    const abs = Math.min(this.armor, amount * 0.6);
    this.armor -= abs;
    this.hp -= amount - abs;
    if (!dot) {
      G.sound.hurt(); G.shake = Math.min(1, G.shake + 0.25 + amount * 0.01);
      G.ui.damageFlash(amount);
      this.hurtT = 0.4;
    } else this.hurtT = Math.max(this.hurtT, 0.15);
    if (from && !self) G.ui.hitIndicator(Math.atan2(from.x - this.pos.x, from.z - this.pos.z), this.yaw);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deadT = 0; G.gameOver(); }
  }

  // ---------- main update ----------
  update(dt, t) {
    const inp = G.input, cam = this.camera, w = this.w, slot = this.slot;
    const playing = G.state === 'playing' && !this.dead;

    if (playing) {
      const sens = 0.0021 * G.settings.sens * (this.fov / G.settings.fov);
      this.yaw -= inp.dx * sens; this.pitch = clamp(this.pitch - inp.dy * sens, -1.5, 1.5);
      this.lookDx = inp.dx; this.lookDy = inp.dy;
    } else { this.lookDx = this.lookDy = 0; }
    inp.dx = inp.dy = 0;

    // ----- movement -----
    const k = inp.keys;
    let fw = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), st = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (!playing) fw = st = 0;
    const len = Math.hypot(fw, st) || 1;
    fw /= len; st /= len;
    this.sprinting = playing && k.has('ShiftLeft') && fw > 0 && this.ads < 0.3;
    const speed = (this.sprinting ? 8.6 : 5.5) * (1 + 0.08 * (this.perks.boots || 0)) * (1 - this.ads * 0.35);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * fw + cy * st) * speed, wz = (-cy * fw - sy * st) * speed;
    const acc = this.onGround ? 16 : 3.5;
    this.vel.x += (wx - this.vel.x) * Math.min(1, acc * dt);
    this.vel.z += (wz - this.vel.z) * Math.min(1, acc * dt);
    if (playing && this.onGround && inp.pressed.has('Space')) { this.vel.y = 7.4; this.onGround = false; G.sound.jump(); }
    this.vel.y -= 23 * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { if (!this.onGround && this.vel.y < -6) { G.shake = Math.max(G.shake, 0.15); this.landDip = 0.12; } this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    G.world.resolve(this.pos, 0.42);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.moving = hs > 1.2 && this.onGround;
    if (this.moving) {
      this.bobT += dt * (this.sprinting ? 12.5 : 9.5) * Math.min(1.3, hs / 5.5);
      this.stepT -= dt * hs;
      if (this.stepT <= 0) { this.stepT = this.sprinting ? 3.2 : 2.6; G.sound.step(); }
    }
    this.landDip = Math.max(0, (this.landDip || 0) - dt * 0.6);

    // ----- weapons -----
    this.cool = Math.max(0, this.cool - dt);
    this.swapT = Math.max(0, this.swapT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.vmKick = Math.max(0, this.vmKick - dt * 9);
    this.bloom = Math.max(0, this.bloom - dt * 0.08);
    this.punch *= Math.max(0, 1 - dt * 9);
    this.nearShop = Math.hypot(this.pos.x - SHOP_POS.x, this.pos.z - SHOP_POS.z) < SHOP_RADIUS;

    if (playing) {
      if (inp.pressed.has('KeyR')) this.startReload();
      if (inp.pressed.has('KeyQ')) this.switchTo(this.last);
      if (inp.wheel) { this.cycle(inp.wheel > 0 ? 1 : -1); inp.wheel = 0; }
      for (let i = 0; i < WEAPONS.length; i++) if (inp.pressed.has('Digit' + (i + 1))) this.switchTo(WEAPONS[i].id);
      if (inp.pressed.has('KeyF')) { this.flashOn = !this.flashOn; G.sound.uiClick(); }
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    const wantAds = playing && inp.rmb && this.reloadT <= 0 && this.swapT <= 0.1 && !this.sprinting;
    this.ads += ((wantAds ? 1 : 0) - this.ads) * Math.min(1, dt * (w.scope ? 10 : 13));
    this.fov = G.settings.fov / (1 + (w.zoom - 1) * this.ads);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    // camera transform (before firing so muzzle/aim are current)
    this.updateCamera(dt, t);

    if (playing) {
      const trig = w.auto ? inp.mouseDown : inp.pressed.has('Mouse0');
      if (trig && this.cool <= 0 && this.reloadT <= 0 && this.swapT <= 0) {
        if (slot.mag > 0) this.fire(w, slot);
        else if (slot.reserve > 0) this.startReload();
        else if (inp.pressed.has('Mouse0')) G.sound.dry();
      }
    }
    this.updateRockets(dt);
    this.updateViewmodel(dt, t);

    this.flash.visible = true;
    this.flash.intensity = this.flashOn ? FLASH_INTENSITY : 0;
    this.muzzleLight.intensity = this.flashT > 0 ? 12 * (this.flashT / 0.05) : 0;
    for (const id in this.vms) this.vms[id].userData.flash.visible = id === this.cur && this.flashT > 0;

    // low health heartbeat
    if (playing && this.hp < 35) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 0.5 + this.hp / 70; G.sound.heartbeat(); }
    }
    this.hurtT = Math.max(0, this.hurtT - dt);
  }

  updateCamera(dt, t) {
    const cam = this.camera;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT * 1.6);
      cam.position.set(this.pos.x, 0.35 + (EYE - 0.35) * (1 - k * k), this.pos.z);
      cam.rotation.set(this.pitch * (1 - k) - 0.2 * k, this.yaw, 1.35 * k);
      return;
    }
    const bobAmt = this.moving ? (this.sprinting ? 0.055 : 0.032) : 0;
    const by = Math.sin(this.bobT * 2) * bobAmt * (1 - this.ads * 0.8);
    const bx = Math.cos(this.bobT) * bobAmt * 0.6 * (1 - this.ads * 0.8);
    const sh = G.shake;
    const rx = (Math.random() - 0.5) * sh * 0.06, ry = (Math.random() - 0.5) * sh * 0.06, rz = (Math.random() - 0.5) * sh * 0.08;
    G.shake = Math.max(0, G.shake - dt * 2.4);
    const sideTilt = -(this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw)) * 0.0022;
    this.roll += (sideTilt - this.roll) * Math.min(1, dt * 8);
    cam.position.set(this.pos.x + Math.cos(this.yaw) * bx * 0.3, this.pos.y + EYE + by - this.landDip, this.pos.z - Math.sin(this.yaw) * bx * 0.3);
    cam.rotation.set(this.pitch + this.punch + rx, this.yaw + ry, this.roll + rz);
  }

  // ---------- firing ----------
  startReload() {
    const w = this.w, s = this.slot;
    if (this.reloadT > 0 || s.mag >= this.magSize(w.id) || s.reserve <= 0 || this.swapT > 0) return;
    this.reloadT = this.reloadTotal = w.reload * (this.cur === 'shotgun' ? 1 : 1);
    G.sound.reload(this.reloadTotal);
  }
  finishReload() {
    const s = this.slot, need = this.magSize(this.cur) - s.mag, take = Math.min(need, s.reserve);
    s.mag += take; if (s.reserve !== Infinity) s.reserve -= take;
    G.ui.ammoChanged();
  }

  fire(w, slot) {
    slot.mag--; this.cool = 1 / w.rate; this.shotCount++;
    const cam = this.camera;
    this._f.set(0, 0, -1).applyQuaternion(cam.quaternion);
    this._r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    this._u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    this._o.copy(cam.position);
    const gun = this.vms[w.id];
    gun.updateMatrixWorld(true);
    gun.userData.muzzle.getWorldPosition(this._mz);

    const move = (this.moving ? 1.5 : 1) * (this.onGround ? 1 : 2.2) * (1 - this.ads * 0.55);
    const spread = w.spread * move + this.bloom;
    const dmg = this.dmgOf(w.id);

    if (w.rocket) this.fireRocket(w, dmg);
    else {
      for (let p = 0; p < w.pellets; p++) {
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * spread;
        this._d.copy(this._f).addScaledVector(this._r, Math.cos(a) * r).addScaledVector(this._u, Math.sin(a) * r).normalize();
        this.hitscan(w, dmg, p, this._d);
      }
    }
    // feedback
    G.sound.shot(w.id);
    const heavy = w.kick > 0.08;
    this.flashT = 0.05; this.vmKick = 1;
    const fl = gun.userData.flash; fl.scale.setScalar((heavy ? 0.7 : 0.4) * (0.8 + Math.random() * 0.5)); fl.material.rotation = Math.random() * 6.28;
    this.muzzleLight.position.copy(gun.userData.muzzle.position).add(gun.position).add(this.vmRoot.position);
    const kick = w.kick * (1 - this.ads * 0.4);
    this.pitch += kick * 0.45; this.punch += kick * 0.55; this.yaw += (Math.random() - 0.5) * kick * 0.3;
    this.bloom = Math.min(0.05, this.bloom + (w.auto ? 0.004 : 0.008));
    G.shake = Math.min(1, G.shake + (heavy ? 0.12 : 0.02));
    G.fx.muzzleSmoke(this._mz);
    G.ui.ammoChanged();
    if (slot.mag === 0 && slot.reserve > 0) setTimeout(() => { if (G.state === 'playing' && !this.dead && this.slot === slot) this.startReload(); }, 220);
  }

  hitscan(w, dmg, idx, d) {
    const o = this._o, world = G.world;
    const wall = world.rayBlock(o, d, w.range);
    const maxT = Math.min(w.range, wall);
    const hits = G.zombies.raycast(o, d, maxT);
    let pierced = 0, end = Math.min(maxT, 120);
    for (const h of hits) {
      const fall = w.falloff ? clamp(1 - (h.t - w.falloff[0]) / (w.falloff[1] - w.falloff[0]), 0.3, 1) : 1;
      const dd = dmg * fall * Math.pow(0.8, pierced);
      this._v.copy(o).addScaledVector(d, h.t);
      const killed = G.zombies.damage(h.z, dd, { head: h.head, dir: { x: d.x, z: d.z }, knock: w.pellets > 1 ? 1.2 : 0.7, point: this._v });
      G.ui.hitMarker(h.head, killed);
      end = h.t; pierced++;
      if (pierced >= w.pierce) break;
    }
    if (pierced < w.pierce && wall <= w.range) {
      this._v.copy(o).addScaledVector(d, wall);
      const ground = this._v.y <= 0.06;
      const n = ground ? { x: 0, y: 1, z: 0 } : { x: -d.x, y: -d.y, z: -d.z };
      G.fx.impact(this._v, n, ground ? 0xb8a070 : 0xffc070);
      end = wall;
    }
    if (w.pellets === 1 ? (w.rate < 8 || this.shotCount % 2 === 0) : idx < 3) {
      this._v.copy(o).addScaledVector(d, Math.min(end, 150));
      G.fx.tracer(this._mz, this._v);
    }
  }

  fireRocket(w, dmg) {
    // aim point 60m down the crosshair, fired from the muzzle
    const target = this._v.copy(this._o).addScaledVector(this._f, 60);
    const dir = target.sub(this._mz).normalize();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.rocketGeo, this.rocketMat)); const tip = new THREE.Mesh(this.rocketTipGeo, this.rocketTipMat); tip.position.z = -0.38; g.add(tip);
    g.position.copy(this._mz); g.lookAt(this._mz.clone().add(dir));
    this.scene.add(g);
    this.rockets.push({ mesh: g, dir: dir.clone(), speed: 48, age: 0, dmg, blast: w.blast, prev: this._mz.clone() });
  }

  updateRockets(dt) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i], pos = r.mesh.position;
      r.age += dt;
      r.speed = Math.min(78, r.speed + 40 * dt);
      const step = r.speed * dt;
      r.prev.copy(pos);
      const hits = G.zombies.raycast(r.prev, r.dir, step + 0.2);
      const wall = G.world.rayBlock(r.prev, r.dir, step + 0.1);
      let boom = null;
      if (hits.length && hits[0].t <= wall) boom = r.prev.clone().addScaledVector(r.dir, hits[0].t);
      else if (wall <= step + 0.1) boom = r.prev.clone().addScaledVector(r.dir, Math.max(0, wall - 0.15));
      else if (r.age > 3.5) boom = pos.clone();
      if (boom) {
        boom.y = Math.max(boom.y, 0.4);
        G.zombies.explode(boom, r.blast, r.dmg);
        this.scene.remove(r.mesh); this.rockets.splice(i, 1);
        continue;
      }
      pos.addScaledVector(r.dir, step);
      G.fx.glow.emit({ x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, life: 0.25, size: 0.5, size1: 0.1, color: 0xff9a2a });
      G.fx.smoke.emit({ x: pos.x - r.dir.x * 0.4, y: pos.y - r.dir.y * 0.4, z: pos.z - r.dir.z * 0.4, vx: 0, vy: 0.3, vz: 0, life: 1.2, size: 0.3, size1: 1.3, color: 0x7a7670, alpha: 0.5, drag: 1 });
    }
  }

  // ---------- viewmodel ----------
  updateViewmodel(dt, t) {
    const w = this.w, root = this.vmRoot, ads = this.ads;
    const hip = [0.23, -0.25, -0.5], a = ADS[w.id];
    let x = hip[0] * (1 - ads), y = hip[1] + (a[0] - hip[1]) * ads, z = hip[2] + (a[1] - hip[2]) * ads;
    const mv = this.moving ? 1 : 0, sp = this.sprinting ? 1 : 0;
    const bamp = (1 - ads * 0.85);
    x += Math.cos(this.bobT) * 0.012 * mv * bamp * (1 + sp);
    y += Math.abs(Math.sin(this.bobT)) * 0.014 * mv * bamp * (1 + sp) - 0.006 * Math.sin(t * 1.5) * (1 - mv);
    // sway from look
    this.sway.x += (clamp(-this.lookDx * 0.0006, -0.04, 0.04) - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (clamp(this.lookDy * 0.0006, -0.04, 0.04) - this.sway.y) * Math.min(1, dt * 10);
    x += this.sway.x * (1 - ads * 0.7); y += this.sway.y * (1 - ads * 0.7);
    z += this.vmKick * 0.06 * (1 - ads * 0.5);
    let rx = this.vmKick * 0.1 * (1 - ads * 0.5), ry = 0, rz = 0;
    if (sp) { rx += 0.15; ry += 0.35; y -= 0.04; }
    // reload
    if (this.reloadT > 0) {
      const p = 1 - this.reloadT / this.reloadTotal, s = Math.sin(Math.PI * p);
      y -= 0.14 * s; rx -= 0.5 * s; rz += 0.35 * s; x -= 0.04 * s;
      if (this.cur === 'shotgun' || this.cur === 'rocket') { ry += 0.5 * s; }
    }
    // swap
    if (this.swapT > 0) { const s = this.swapT / 0.32; y -= 0.38 * s * s; rx -= 0.6 * s; }
    root.position.set(x, y, z);
    root.rotation.set(rx, ry, rz);
    const hide = w.scope && ads > 0.55;
    this.vms[w.id].visible = !hide;
    G.ui.setScope(w.scope && ads > 0.9);
  }

  // ---------- shop logic ----------
  perkCost(p) {
    if (p.consumable) return p.cost;
    return Math.round(p.cost * Math.pow(p.mult, this.perks[p.id] || 0) / 5) * 5;
  }
  ammoFull(id) { const s = this.owned[id]; return s.reserve >= WEAPON_BY_ID[id].maxReserve; }
  dmgUpgradeCost(id) { const l = this.owned[id].dmgLvl; return l >= 3 ? null : WEAPON_BY_ID[id].upBase * (l + 1); }
  magUpgradeCost(id) { return this.owned[id].ext ? null : Math.round(WEAPON_BY_ID[id].upBase * 1.5); }

  spend(c) { if (this.cash < c) return false; this.cash -= c; G.stats.spent += c; return true; }

  buyWeapon(id) {
    const w = WEAPON_BY_ID[id];
    if (this.owned[id]) return { ok: false, why: 'owned' };
    if (!this.spend(w.price)) return { ok: false, why: 'poor' };
    this.owned[id] = { mag: w.mag, reserve: w.startReserve, dmgLvl: 0, ext: false };
    this.switchTo(id);
    return { ok: true };
  }
  buyAmmo(id) {
    const w = WEAPON_BY_ID[id], s = this.owned[id];
    if (!s || w.packSize === 0) return { ok: false, why: 'full' };
    if (s.reserve >= w.maxReserve) return { ok: false, why: 'full' };
    if (!this.spend(w.packCost)) return { ok: false, why: 'poor' };
    s.reserve = Math.min(w.maxReserve, s.reserve + w.packSize);
    return { ok: true };
  }
  upgradeDmg(id) {
    const c = this.dmgUpgradeCost(id); if (c === null) return { ok: false, why: 'max' };
    if (!this.spend(c)) return { ok: false, why: 'poor' };
    this.owned[id].dmgLvl++; return { ok: true };
  }
  upgradeMag(id) {
    const c = this.magUpgradeCost(id); if (c === null) return { ok: false, why: 'max' };
    if (!this.spend(c)) return { ok: false, why: 'poor' };
    this.owned[id].ext = true; this.owned[id].mag = this.magSize(id); return { ok: true };
  }
  buyPerk(id) {
    const p = PERKS.find(q => q.id === id);
    if (p.consumable) {
      if (id === 'medkit' && this.hp >= this.maxHp) return { ok: false, why: 'full' };
      if (id === 'armor' && this.armor >= 100) return { ok: false, why: 'full' };
    } else if ((this.perks[id] || 0) >= p.max) return { ok: false, why: 'max' };
    if (!this.spend(this.perkCost(p))) return { ok: false, why: 'poor' };
    if (id === 'medkit') this.hp = Math.min(this.maxHp, this.hp + 50);
    else if (id === 'armor') this.armor = Math.min(100, this.armor + 50);
    else {
      this.perks[id] = (this.perks[id] || 0) + 1;
      if (id === 'maxhp') { this.maxHp += 25; this.hp = Math.min(this.maxHp, this.hp + 25); }
    }
    return { ok: true };
  }
  sellGem(id, n) {
    const have = this.gems[id];
    const count = n === 'all' ? have : Math.min(n, have);
    if (count <= 0) return { ok: false, why: 'none' };
    const each = G.market.price(id), total = each * count;
    this.gems[id] -= count; this.addCash(total); G.stats.gemCash += total;
    return { ok: true, total, count };
  }
  sellAll() {
    let total = 0, count = 0;
    for (const id of GEM_IDS) { const r = this.sellGem(id, 'all'); if (r.ok) { total += r.total; count += r.count; } }
    return count ? { ok: true, total, count } : { ok: false, why: 'none' };
  }
}
