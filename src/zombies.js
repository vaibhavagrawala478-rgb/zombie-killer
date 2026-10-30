// Zombies: rigged glTF characters, animation state machine, per-type AI, hit detection, damage, drops.
import * as THREE from 'three';
import { G } from './state.js';
import { ZTYPES, MODEL_HEIGHT } from './content/zombies.js';
import { cloneCharacter } from './assets.js';
import { glowTex } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
const MAX_ALIVE_HARD = 46;

// ---- shared prop geometry/materials ----
const P = {
  shieldGeo: new THREE.BoxGeometry(1, 1, 1),
  shieldMat: new THREE.MeshStandardMaterial({ color: 0x35507a, metalness: 0.5, roughness: 0.25, transparent: true, opacity: 0.78, emissive: 0x0a1a30 }),
  frameMat: new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.8, roughness: 0.4 }),
  helmetGeo: new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  helmetMat: new THREE.MeshStandardMaterial({ color: 0x2c3340, metalness: 0.7, roughness: 0.35 }),
  maskGeo: new THREE.CylinderGeometry(0.06, 0.075, 0.14, 12).rotateX(Math.PI / 2),
  maskMat: new THREE.MeshStandardMaterial({ color: 0x1a1a18, metalness: 0.3, roughness: 0.6 }),
  tankGeo: new THREE.CylinderGeometry(0.07, 0.07, 0.38, 12),
  tankMat: new THREE.MeshStandardMaterial({ color: 0xc8c24a, metalness: 0.5, roughness: 0.4 }),
  hornGeo: new THREE.ConeGeometry(0.05, 0.3, 8),
  hornMat: new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.5 }),
  projGeo: new THREE.SphereGeometry(0.2, 12, 10),
  projMat: new THREE.MeshBasicMaterial({ color: 0x9dff4a, toneMapped: false }),
};
let GLOW = null;

function attachProps(z) {
  const def = z.def, s = z.s;
  const head = z.head;
  const add = (parent, geo, mat, x, y, z_, rx = 0, sc = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z_); m.rotation.x = rx; m.scale.setScalar(sc); m.castShadow = true; parent.add(m); return m; };
  if (def.shield) {
    const H = def.height / 1.95;
    const sh = new THREE.Group(); sh.position.set(0, 1.05 * H, 0.6 * H);
    const pane = new THREE.Mesh(P.shieldGeo, P.shieldMat); pane.scale.set(0.95 * H, 1.3 * H, 0.05); sh.add(pane);
    const frame = new THREE.Mesh(P.shieldGeo, P.frameMat); frame.scale.set(1.0 * H, 1.36 * H, 0.03); frame.position.z = -0.03; sh.add(frame);
    z.group.add(sh); z.shieldMesh = sh;
  }
  if (head && (def.shield || def.ai === 'brute')) add(head, P.helmetGeo, P.helmetMat, 0, 0.09, 0.0, 0, 1);
  if (head && def.mask) {
    add(head, P.maskGeo, P.maskMat, 0, 0.05, 0.13);
    const torso = z.root.getObjectByName('Torso');
    if (torso) add(torso, P.tankGeo, P.tankMat, 0, 0.12, -0.2);
  }
  if (head && def.horns) for (const sx of [-1, 1]) { const h = add(head, P.hornGeo, P.hornMat, sx * 0.09, 0.14, 0.0, 0, 1.6); h.rotation.z = -sx * 0.5; }
  if (def.boss || def.explode || def.ai === 'screamer') {
    if (!GLOW) GLOW = glowTex();
    const col = def.boss ? 0xa84bff : def.explode ? 0x9bff2a : 0xc27bff;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: def.boss ? 0.5 : 0.55 }));
    const H = def.height; sp.position.set(0, H * 0.55, def.explode ? 0.25 * H : 0); sp.scale.set(H * (def.boss ? 1.6 : 0.9), H * (def.boss ? 1.9 : 0.9), 1);
    z.group.add(sp); z.glow = sp;
  }
}

function build(key) {
  const def = ZTYPES[key];
  const model = def.modelAlt && Math.random() < 0.45 ? def.modelAlt : def.model;
  const { scene: root, clips } = cloneCharacter(model);
  const vs = def.boss ? 1 : rnd(0.95, 1.07);
  const height = def.height * vs;
  const s = height / MODEL_HEIGHT[model];
  root.scale.setScalar(s);
  const group = new THREE.Group(); group.add(root);

  const mats = [], meshes = []; let eyelid = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'Eyelid') eyelid = o; // tiny extra draw call per zombie: only worth it up close
    o.frustumCulled = false; o.castShadow = true;
    const m = o.material.clone();
    m.color.setHex(def.tint); m.emissive.setHex(def.emissive); m.side = THREE.FrontSide;
    o.material = m; mats.push(m); meshes.push(o);
  });
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const c of clips) actions[c.name] = mixer.clipAction(c);
  const z = { def, key, group, root, mixer, actions, mats, meshes, eyelid, s, height, head: root.getObjectByName('Head'), model };
  attachProps(z);
  return z;
}

export class Zombies {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.hazards = []; // lingering clouds/puddles {x,z,t,r,dps,color}
    this.proj = [];    // spitter projectiles
    this.projPool = [];
    this.tmpV = new THREE.Vector3();
  }

  get aliveCount() { let n = 0; for (const z of this.list) if (!z.dead) n++; return n; }

  spawn(key, x, z, wave) {
    const def = ZTYPES[key];
    const parts = build(key);
    const hpMul = 1 + (wave - 1) * 0.1 + (key === 'boss' ? (wave / 5 - 1) * 0.5 : 0);
    const zed = Object.assign(parts, {
      pos: parts.group.position, yaw: Math.atan2(-x, -z), vx: 0, vz: 0,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul,
      speed: def.speed * (1 + Math.min(0.6, wave * 0.03)) * rnd(0.9, 1.12),
      scale: parts.height / 1.8, r: def.radius,
      dead: false, deadT: 0, state: 'loco', stateT: 0, anim: null, animAcc: 0,
      attackCd: rnd(0, 0.5), didHit: false, flash: 0, stagger: 0, groanT: rnd(1, 6), buffT: 0,
      cd: rnd(2.5, 6), knock: new THREE.Vector3(), air: null, trailD: 0, chargeYaw: 0,
    });
    zed.pos.set(x, 0, z);
    zed.group.rotation.y = zed.yaw;
    this.scene.add(zed.group);
    this.list.push(zed);
    this.play(zed, def.anim.walk, { fade: 0 });
    if (G.ui && !G.seenTypes?.has(key) && key !== 'walker') {
      (G.seenTypes ||= new Set()).add(key);
      G.ui.tip(def.name.toUpperCase(), def.tip, def.radar);
    }
    return zed;
  }

  // ---- animation ----
  play(z, name, o = {}) {
    const a = z.actions[name]; if (!a) return;
    if (z.anim === a) { if (o.timeScale) a.timeScale = o.timeScale; return; }
    a.enabled = true; a.setEffectiveWeight(1);
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = !!o.once;
    a.timeScale = o.timeScale ?? 1;
    a.reset().play();
    if (z.anim && o.fade !== 0) a.crossFadeFrom(z.anim, o.fade ?? 0.2, false); else if (z.anim) z.anim.stop();
    z.anim = a;
  }
  clip(z, key, fallback) { const n = z.def.anim[key]; return z.actions[n] ? n : fallback; }

  chooseAnim(z) {
    const A = z.def.anim, spd = Math.hypot(z.vx, z.vz);
    switch (z.state) {
      case 'dead': return [A.death, { once: true, fade: 0.1 }];
      case 'attack': return [this.attackClip(z), { timeScale: 1.25, fade: 0.1 }];
      case 'hit': return [A.hit, { once: true, fade: 0.05, timeScale: 1.4 }];
      case 'windup': case 'scream': case 'spit': case 'slam': return [z.actions.Idle_Attack ? 'Idle_Attack' : A.attack, { timeScale: 0.9 }];
      case 'charge': return [A.run, { timeScale: 1.5 }];
      case 'crouch': return [z.actions.Jump_Idle ? 'Jump_Idle' : A.idle, {}];
      case 'air': return [z.actions.Jump ? 'Jump' : A.run, { timeScale: 1.0 }];
      case 'land': return [z.actions.Jump_Land ? 'Jump_Land' : A.idle, { once: true, timeScale: 1.4 }];
      case 'stagger': return [A.idle, {}];
      default: {
        if (spd < 0.35) return [A.idle, {}];
        const run = z.def.move === 'run' || spd > 3.4;
        const ref = z.def.ref ?? (run ? 5.2 : 2.1);
        return [run ? A.run : A.walk, { timeScale: clamp(spd / ref, 0.55, 1.9) }];
      }
    }
  }
  attackClip(z) { const n = z.def.anim.attack; return z.actions[n] ? n : (z.actions.Jump ? 'Jump' : z.def.anim.idle); }

  setState(z, st, t = 0) { z.state = st; z.stateT = t; z.didHit = false; }

  // ---- hit detection ----
  spheres(z) {
    const def = z.def, abs = def.hitAbs, H = z.height, c = Math.cos(z.yaw), si = Math.sin(z.yaw);
    const wide = def.wide || 1;
    const out = z._sph || (z._sph = [{}, {}, {}, {}].slice(0, def.hit.length));
    for (let i = 0; i < def.hit.length; i++) {
      const [fy, fz, fr, head] = def.hit[i], o = out[i] || (out[i] = {});
      const fwd = abs ? fz : fz * H;
      o.x = z.pos.x + si * fwd; o.z = z.pos.z + c * fwd; o.y = z.pos.y + (abs ? fy : fy * H);
      o.r = (abs ? fr : fr * H) * (head ? 1 : wide); o.head = !!head;
    }
    return out;
  }
  raycast(o, d, maxT) {
    const hits = [];
    for (const z of this.list) {
      if (z.dead) continue;
      const dx = z.pos.x - o.x, dz = z.pos.z - o.z;
      if (dx * dx + dz * dz > (maxT + 4) * (maxT + 4)) continue;
      let bestT = Infinity, head = false;
      for (const s of this.spheres(z)) {
        const mx = o.x - s.x, my = o.y - s.y, mz = o.z - s.z;
        const b = mx * d.x + my * d.y + mz * d.z;
        const c = mx * mx + my * my + mz * mz - s.r * s.r;
        if (c > 0 && b > 0) continue;
        const disc = b * b - c; if (disc < 0) continue;
        let t = -b - Math.sqrt(disc); if (t < 0) t = 0;
        if (t < bestT && t <= maxT) { bestT = t; head = s.head; }
      }
      if (bestT < Infinity) hits.push({ z, t: bestT, head });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  // ---- damage ----
  damage(z, amount, { head = false, dir = null, knock = 0, point = null, silent = false, explosive = false } = {}) {
    if (z.dead) return;
    const def = z.def;
    let blocked = false;
    if (head) amount *= def.headMul ?? 2.2;
    else if (dir && (def.frontMul || def.backMul)) {
      const fx = Math.sin(z.yaw), fz = Math.cos(z.yaw), dl = Math.hypot(dir.x, dir.z) || 1;
      const dot = (dir.x * fx + dir.z * fz) / dl; // <0: projectile travelling against the zombie's facing, i.e. hitting the front
      if (dot < -0.3 && def.frontMul) { amount *= explosive ? Math.max(def.frontMul, 0.6) : def.frontMul; blocked = !!def.shield && !explosive; }
      else if (dot > 0.3 && def.backMul) amount *= def.backMul;
    }
    z.hp -= amount;
    z.flash = 0.12;
    if (dir && knock) { z.knock.x += dir.x * knock; z.knock.z += dir.z * knock; }
    const p = point || this.tmpV.set(z.pos.x, 1.2 * z.scale, z.pos.z);
    if (blocked) {
      G.fx.impact(p, { x: -(dir?.x || 0), y: 0.2, z: -(dir?.z || 0) }, 0x9ad0ff);
      G.sound.ricochet(z.pos.x, z.pos.z);
    } else {
      G.fx.blood(p, dir ? { x: dir.x, y: 0, z: dir.z } : { x: 0, y: 0, z: 0 }, head ? 10 : 6, z.scale > 1.4 ? 1.4 : 1);
      if (!silent) G.sound.zombieHit(z.pos.x, z.pos.z, head);
    }
    const killed = z.hp <= 0;
    G.ui.damageNumber(p.x, p.y, p.z, Math.round(amount), head, killed);
    if (killed) this.kill(z, head, dir);
    else if (!blocked && z.state === 'loco' && !def.boss && z.key !== 'brute' && (amount / z.maxHp > 0.14 || knock > 1.2 || Math.random() < 0.18)) {
      this.setState(z, 'hit', 0.4);
    }
    return killed;
  }

  kill(z, head, dir) {
    z.dead = true; z.deadT = 0; z.state = 'dead';
    z.deadSpin = rnd(-0.3, 0.3);
    if (dir) { z.knock.x += dir.x * 2.2; z.knock.z += dir.z * 2.2; }
    if (z.shieldMesh) z.group.remove(z.shieldMesh);
    if (z.glow) z.glow.visible = false;
    const [name, o] = this.chooseAnim(z); this.play(z, name, o);
    const def = z.def, Pl = G.player;
    G.stats.kills++;
    G.sound.zombieDie(z.pos.x, z.pos.z, z.scale);
    const cash = Math.round(def.reward * (head ? 1.5 : 1));
    Pl.addCash(cash);
    G.ui.cashPop(cash, head);
    G.ui.killMarker(head);
    const lucky = Pl.perks.lucky || 0;
    if (Math.random() < Math.min(1, def.gemChance + lucky * 0.1)) {
      const n = Math.floor(rnd(def.gemCount[0], def.gemCount[1] + 0.999));
      for (let i = 0; i < n; i++) G.gems.spawn(this.rollGem(def, lucky), z.pos.x, z.pos.z);
    }
    if (def.guaranteed) for (const gid of def.guaranteed) G.gems.spawn(gid, z.pos.x, z.pos.z);
    if (head) G.fx.blood(this.tmpV.set(z.pos.x, 1.65 * z.scale, z.pos.z), { x: 0, y: 0, z: 0 }, 14, 1.2);
    if (def.explode) this.bloaterBlast(z);
    if (def.boss) { G.fx.gibs(this.tmpV.set(z.pos.x, 1.5, z.pos.z), 2.5); G.shake = 1; G.ui.banner('THE GRAVELORD HAS FALLEN', 'Gems everywhere. Grab them.', 'good'); }
    const corpses = this.list.filter(c => c.dead);
    if (corpses.length > 18) this.remove(corpses[0]);
  }

  rollGem(def, lucky) {
    const w = def.gems.map(([id, wt], i) => [id, wt * (1 + lucky * 0.35 * i)]);
    const tot = w.reduce((a, b) => a + b[1], 0);
    let r = Math.random() * tot;
    for (const [id, wt] of w) { r -= wt; if (r <= 0) return id; }
    return w[0][0];
  }

  bloaterBlast(z) {
    const p = this.tmpV.set(z.pos.x, 1.0, z.pos.z);
    G.fx.gas(p);
    G.sound.gas(z.pos.x, z.pos.z);
    const pd = Math.hypot(G.player.pos.x - z.pos.x, G.player.pos.z - z.pos.z);
    if (pd < 4.5) G.player.hurt(26 * (1 - pd / 5.5), z.pos);
    for (const o of this.list) {
      if (o === z || o.dead) continue;
      const d = Math.hypot(o.pos.x - z.pos.x, o.pos.z - z.pos.z);
      if (d < 4.2) this.damage(o, 140 * (1 - d / 5), { dir: { x: (o.pos.x - z.pos.x) / (d || 1), z: (o.pos.z - z.pos.z) / (d || 1) }, knock: 4, silent: true, explosive: true });
    }
    this.hazards.push({ x: z.pos.x, z: z.pos.z, t: 3.5, r: 3.2, dps: 7, color: 0x6fbf20 });
  }

  explode(p, radius, dmg) {
    G.fx.explosion(p, radius);
    G.sound.explosion(p.x, p.z);
    for (const z of this.list) {
      if (z.dead) continue;
      const d = Math.hypot(z.pos.x - p.x, (z.scale * 0.9) - p.y * 0.3, z.pos.z - p.z) - z.r;
      if (d > radius) continue;
      const f = 1 - Math.max(0, d) / radius * 0.75;
      const nx = z.pos.x - p.x, nz = z.pos.z - p.z, nl = Math.hypot(nx, nz) || 1;
      this.damage(z, dmg * f, { dir: { x: nx / nl, z: nz / nl }, knock: z.def.boss ? 1 : 7 * f, explosive: true, point: this.tmpV.set(z.pos.x, 1.1 * z.scale, z.pos.z) });
    }
    const pd = Math.hypot(G.player.pos.x - p.x, G.player.pos.y - p.y, G.player.pos.z - p.z);
    if (pd < radius * 0.55) G.player.hurt(38 * (1 - pd / (radius * 0.55)), p, true);
    if (pd < radius) G.player.vel.y += (1 - pd / radius) * 4;
  }

  remove(z) {
    this.scene.remove(z.group);
    z.mixer.stopAllAction(); z.mixer.uncacheRoot(z.root);
    for (const m of z.mats) m.dispose();
    const i = this.list.indexOf(z); if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const z of [...this.list]) this.remove(z);
    this.hazards.length = 0;
    for (const p of this.proj) { p.mesh.visible = false; this.projPool.push(p.mesh); }
    this.proj.length = 0;
  }

  // ---- AI ----
  update(dt) {
    const Pl = G.player, W = G.world, arr = this.list;
    for (let i = arr.length - 1; i >= 0; i--) {
      const z = arr[i];
      if (z.dead) { this.updateDead(z, dt); if (z.deadT > 7) this.remove(z); continue; }
      this.think(z, dt, Pl, W, arr);
    }
    this.updateProjectiles(dt, Pl);
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.t -= dt;
      if (Math.random() < dt * 14 * (h.r / 3)) G.fx.smoke.emit({ x: h.x + rnd(-h.r, h.r) * 0.7, y: 0.3, z: h.z + rnd(-h.r, h.r) * 0.7, vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.7), vz: rnd(-0.3, 0.3), life: 1.4, size: h.r * 0.4, size1: h.r, color: h.color, alpha: 0.45, drag: 0.5 });
      if (Math.hypot(Pl.pos.x - h.x, Pl.pos.z - h.z) < h.r && Pl.pos.y < 1.8) Pl.hurt(h.dps * dt, null, false, true);
      if (h.t <= 0) this.hazards.splice(i, 1);
    }
  }

  think(z, dt, Pl, W, arr) {
    const def = z.def, ai = def.ai;
    const dx = Pl.pos.x - z.pos.x, dz = Pl.pos.z - z.pos.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    z.flash = Math.max(0, z.flash - dt);
    z.buffT = Math.max(0, z.buffT - dt);
    z.cd -= dt; z.attackCd -= dt;
    z.stateT -= dt;

    let faceRate = ai === 'boss' ? 4 : 8, moveYaw = null, speedMul = 1;
    const reach = z.r + 0.7 + 0.25 * z.scale;
    const buff = z.buffT > 0 ? 1.35 : 1;

    // --- state machine ---
    switch (z.state) {
      case 'hit': speedMul = 0.1; if (z.stateT <= 0) this.setState(z, 'loco'); break;
      case 'attack':
        speedMul = 0.15;
        if (!z.didHit && z.stateT < 0.45) {
          z.didHit = true;
          if (dist < reach + 0.5 && !Pl.dead) { Pl.hurt(def.dmg * (1 + (G.wave - 1) * 0.03), z.pos); G.sound.claw(z.pos.x, z.pos.z); }
        }
        if (z.stateT <= 0) this.setState(z, 'loco');
        break;
      case 'windup': // brute roar before charging
        speedMul = 0; faceRate = 10;
        if (z.stateT <= 0) { this.setState(z, 'charge', 1.15); z.chargeYaw = want; G.sound.groan(z.pos.x, z.pos.z, 4); }
        break;
      case 'charge':
        moveYaw = z.chargeYaw; faceRate = 0; speedMul = 3.6;
        if (!z.didHit && dist < reach + 0.4 && !Pl.dead) {
          z.didHit = true; Pl.hurt(def.dmg * 1.25, z.pos);
          Pl.vel.x += Math.sin(z.chargeYaw) * 9; Pl.vel.z += Math.cos(z.chargeYaw) * 9; Pl.vel.y = 4; Pl.onGround = false;
          G.shake = Math.max(G.shake, 0.6); this.setState(z, 'stagger', 1.1);
        } else if (z.stateT <= 0) this.setState(z, 'stagger', 1.1);
        break;
      case 'stagger': speedMul = 0; if (z.stateT <= 0) { this.setState(z, 'loco'); z.cd = rnd(5, 8); } break;
      case 'spit':
        speedMul = 0; faceRate = 12;
        if (!z.didHit && z.stateT < 0.35) { z.didHit = true; this.spit(z, Pl); }
        if (z.stateT <= 0) this.setState(z, 'loco');
        break;
      case 'scream':
        speedMul = 0; faceRate = 6;
        if (z.stateT <= 0) { this.scream(z); this.setState(z, 'loco'); z.cd = rnd(7, 10); }
        break;
      case 'slam':
        speedMul = 0;
        if (z.stateT <= 0) { this.bossSlam(z); this.setState(z, 'loco'); z.cd = rnd(5, 8); }
        break;
      case 'crouch': // leaper telegraph
        speedMul = 0; faceRate = 14;
        if (z.stateT <= 0) this.startLeap(z, Pl, dist);
        break;
      case 'air': this.stepAir(z, dt, Pl); faceRate = 0; speedMul = 0; break;
      case 'land': speedMul = 0; if (z.stateT <= 0) this.setState(z, 'loco'); break;
      default: { // 'loco'
        if (Pl.dead) { speedMul = 0.5; break; }
        if (ai === 'spitter' || ai === 'screamer') {
          const lo = ai === 'spitter' ? 7 : 11, hi = ai === 'spitter' ? 12 : 16;
          if (dist < lo) { moveYaw = want + Math.PI; speedMul = 1.1; }
          else if (dist > hi) speedMul = 1;
          else speedMul = 0;
          if (ai === 'spitter' && z.cd <= 0 && dist < 22 && dist > 4) { this.setState(z, 'spit', 0.9); z.cd = rnd(2.2, 3.4); }
          if (ai === 'screamer' && z.cd <= 0 && dist < 34) { this.setState(z, 'scream', 1.3); z.cd = 99; G.sound.scream(z.pos.x, z.pos.z); }
        } else if (ai === 'leaper' && z.cd <= 0 && dist > 5.5 && dist < 14) {
          this.setState(z, 'crouch', 0.6); z.cd = 99; G.sound.groan(z.pos.x, z.pos.z, 0.7);
        } else if (ai === 'brute' && z.cd <= 0 && dist > 6 && dist < 17) {
          this.setState(z, 'windup', 0.85); z.cd = 99;
        } else if (ai === 'boss' && z.cd <= 0 && dist < 11) {
          this.setState(z, 'slam', 0.95); z.cd = 99; G.sound.groan(z.pos.x, z.pos.z, 4);
        }
        if (dist < reach && ai !== 'spitter' && ai !== 'screamer' && z.attackCd <= 0 && z.state === 'loco') {
          this.setState(z, 'attack', 0.75); z.attackCd = def.attackCd ?? (def.boss ? 1.1 : 1.0);
        }
        if (dist < reach * 0.9 && z.state === 'loco') speedMul = 0;
      }
    }
    // cooldowns that need re-arming after the special finished
    if (z.state === 'loco' && z.cd > 50) z.cd = rnd(2, 5);

    // --- yaw + movement ---
    if (z.state !== 'air' && faceRate > 0) z.yaw += angDiff(z.yaw, want) * Math.min(1, dt * faceRate);
    if (z.state !== 'air') {
      const my = moveYaw ?? z.yaw;
      const spd = z.speed * speedMul * buff * (z.stagger > 0 ? 0.3 : 1);
      z.vx += (Math.sin(my) * spd - z.vx) * Math.min(1, dt * 6);
      z.vz += (Math.cos(my) * spd - z.vz) * Math.min(1, dt * 6);
      z.pos.x += (z.vx + z.knock.x) * dt;
      z.pos.z += (z.vz + z.knock.z) * dt;
      z.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
      for (let j = 0; j < arr.length; j++) {
        const o = arr[j]; if (o === z || o.dead) continue;
        const ox = z.pos.x - o.pos.x, oz = z.pos.z - o.pos.z, min = (z.r + o.r) * 0.9;
        if (Math.abs(ox) > min || Math.abs(oz) > min) continue;
        const d2 = ox * ox + oz * oz;
        if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), push = (min - d) * 0.5 * (o.r > z.r ? 1 : 0.5); z.pos.x += ox / d * push; z.pos.z += oz / d * push; }
      }
      if (dist < z.r + 0.3 && dist > 0.001) { z.pos.x -= dx / dist * (z.r + 0.3 - dist); z.pos.z -= dz / dist * (z.r + 0.3 - dist); }
      G.world.resolve(z.pos, z.r);
    }

    // hazmat toxic trail
    if (def.trail) {
      z.trailD += Math.hypot(z.vx, z.vz) * dt;
      if (z.trailD > 1.6) { z.trailD = 0; this.hazards.push({ x: z.pos.x, z: z.pos.z, t: 4.5, r: 1.3, dps: 6, color: 0xbfd83a }); }
    }
    z.groanT -= dt;
    if (z.groanT <= 0) { z.groanT = rnd(4, 11); if (dist < 45) G.sound.groan(z.pos.x, z.pos.z, z.scale); }

    this.animate(z, dt, dist);
  }

  spit(z, Pl) {
    const from = this.tmpV.set(z.pos.x + Math.sin(z.yaw) * 0.5, z.height * 0.85, z.pos.z + Math.cos(z.yaw) * 0.5);
    const T = clamp(Math.hypot(Pl.pos.x - z.pos.x, Pl.pos.z - z.pos.z) / 15, 0.5, 1.4);
    const tx = Pl.pos.x + Pl.vel.x * T * 0.7, tz = Pl.pos.z + Pl.vel.z * T * 0.7;
    const g = 14;
    let mesh = this.projPool.pop();
    if (!mesh) { mesh = new THREE.Mesh(P.projGeo, P.projMat); this.scene.add(mesh); }
    mesh.visible = true; mesh.position.copy(from);
    this.proj.push({ mesh, vx: (tx - from.x) / T, vz: (tz - from.z) / T, vy: (0.4 - from.y + 0.5 * g * T * T) / T, g, life: 4 });
    G.sound.spit(z.pos.x, z.pos.z);
  }

  updateProjectiles(dt, Pl) {
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i], m = p.mesh;
      p.life -= dt; p.vy -= p.g * dt;
      m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
      G.fx.glow.emit({ x: m.position.x, y: m.position.y, z: m.position.z, vx: 0, vy: 0.3, vz: 0, life: 0.3, size: 0.35, size1: 0.05, color: 0x9dff4a });
      const near = Math.hypot(Pl.pos.x - m.position.x, (Pl.pos.y + 1.0) - m.position.y, Pl.pos.z - m.position.z) < 0.85;
      if (m.position.y <= 0.15 || near || p.life <= 0) {
        const px = m.position.x, pz = m.position.z;
        if (Math.hypot(Pl.pos.x - px, Pl.pos.z - pz) < 1.5 && Pl.pos.y < 1.5) Pl.hurt(13, { x: px, z: pz });
        this.hazards.push({ x: px, z: pz, t: 4.5, r: 1.7, dps: 8, color: 0x7fff3a });
        G.fx.burst(m.position, 0x9dff4a, 14); G.fx.decal(px, pz, 1.4);
        G.sound.splat(px, pz);
        m.visible = false; this.projPool.push(m); this.proj.splice(i, 1);
      }
    }
  }

  scream(z) {
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * 6.283;
      G.fx.glow.emit({ x: z.pos.x, y: 1.4, z: z.pos.z, vx: Math.cos(a) * 16, vy: 0.2, vz: Math.sin(a) * 16, life: 0.6, size: 0.8, size1: 0.1, color: 0xc27bff, drag: 2 });
    }
    G.shake = Math.max(G.shake, 0.35);
    let buffed = 0;
    for (const o of this.list) if (!o.dead && o !== z && Math.hypot(o.pos.x - z.pos.x, o.pos.z - z.pos.z) < 24) { o.buffT = 8; buffed++; }
    // call reinforcements
    if (this.aliveCount < MAX_ALIVE_HARD) for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.283, d = rnd(3, 6);
      this.spawn(Math.random() < 0.3 ? 'runner' : 'walker', z.pos.x + Math.cos(a) * d, z.pos.z + Math.sin(a) * d, G.wave);
    }
    G.ui.feed('⚠ SCREAMER — HORDE BUFFED', '#d98bff');
  }

  startLeap(z, Pl, dist) {
    const T = clamp(dist / 15, 0.4, 0.95), g = 22;
    const tx = Pl.pos.x + Pl.vel.x * T * 0.6, tz = Pl.pos.z + Pl.vel.z * T * 0.6;
    z.air = { vx: (tx - z.pos.x) / T, vz: (tz - z.pos.z) / T, vy: 0.5 * g * T, g };
    z.yaw = Math.atan2(z.air.vx, z.air.vz);
    this.setState(z, 'air', 0);
    G.sound.jump();
  }
  stepAir(z, dt, Pl) {
    const a = z.air;
    z.pos.x += a.vx * dt; z.pos.z += a.vz * dt; z.pos.y += a.vy * dt; a.vy -= a.g * dt;
    G.world.resolve(z.pos, z.r);
    z.vx = a.vx * 0.3; z.vz = a.vz * 0.3;
    const d = Math.hypot(Pl.pos.x - z.pos.x, Pl.pos.z - z.pos.z);
    if (!z.didHit && d < z.r + 0.9 && z.pos.y < 2.0 && !Pl.dead) { z.didHit = true; Pl.hurt(z.def.dmg, z.pos); G.sound.claw(z.pos.x, z.pos.z); }
    if (z.pos.y <= 0 && a.vy < 0) { z.pos.y = 0; z.air = null; this.setState(z, 'land', 0.5); z.cd = rnd(3.5, 6); z.vx = z.vz = 0; }
  }

  bossSlam(z) {
    const p = this.tmpV.set(z.pos.x, 0.2, z.pos.z);
    G.fx.explosion(p, 4);
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * 6.283;
      G.fx.glow.emit({ x: z.pos.x, y: 0.3, z: z.pos.z, vx: Math.cos(a) * 14, vy: 0.5, vz: Math.sin(a) * 14, life: 0.5, size: 0.9, size1: 0.2, color: 0xb04bff, drag: 1.5 });
    }
    G.sound.explosion(z.pos.x, z.pos.z);
    G.shake = Math.max(G.shake, 0.8);
    const d = Math.hypot(G.player.pos.x - z.pos.x, G.player.pos.z - z.pos.z);
    if (d < 8 && G.player.pos.y < 0.9) G.player.hurt(z.def.dmg * (1 - d / 10), z.pos);
  }

  animate(z, dt, dist) {
    // animation LOD: far zombies tick their skeleton less often
    z.animAcc += dt;
    const step = dist < 20 ? 0 : dist < 38 ? 1 / 30 : 1 / 15;
    // state-driven clip choice
    const [name, o] = this.chooseAnim(z);
    this.play(z, name, o);
    if (z.animAcc >= step) { z.mixer.update(z.animAcc); z.animAcc = 0; }
    z.group.rotation.y = z.yaw;
    // cast shadows only when close enough to matter
    const cs = dist < 20;
    for (const m of z.meshes) m.castShadow = cs;
    if (z.eyelid) { z.eyelid.visible = dist < 14; z.eyelid.castShadow = false; }
    const f = z.flash > 0 ? 0.9 : 0, base = z.def.emissive;
    const buff = z.buffT > 0 ? 0.35 + 0.2 * Math.sin(G.time * 12) : 0;
    for (const m of z.mats) {
      m.emissive.setHex(base);
      if (f || buff) m.emissive.r += f + buff * 0.8, m.emissive.g += f * 0.1, m.emissive.b += buff;
    }
    if (z.glow) z.glow.material.opacity = (z.def.boss ? 0.45 : 0.5) + 0.12 * Math.sin(G.time * 3 + z.pos.x);
  }

  updateDead(z, dt) {
    z.deadT += dt;
    z.mixer.update(dt);
    z.pos.x += z.knock.x * dt; z.pos.z += z.knock.z * dt;
    z.knock.multiplyScalar(Math.max(0, 1 - dt * 5));
    z.group.position.y = z.deadT > 5 ? -(z.deadT - 5) * 0.5 : 0;
    const f = Math.max(0, 0.9 - z.deadT * 4);
    for (const m of z.mats) { m.emissive.setHex(z.def.emissive); if (f > 0) m.emissive.r += f; }
    for (const m of z.meshes) m.castShadow = false;
  }
}
