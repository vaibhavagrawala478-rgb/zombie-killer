// Gem pickups in the world + the gem market (prices drift, events spike/crash them).
import * as THREE from 'three';
import { G } from './state.js';
import { GEMS, GEM_IDS } from './data.js';
import { glowTex } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Gems {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const tex = glowTex();
    this.geo = {
      ruby: new THREE.OctahedronGeometry(0.17, 0),
      emerald: new THREE.CylinderGeometry(0.13, 0.15, 0.3, 6),
      sapphire: new THREE.IcosahedronGeometry(0.17, 0),
      amethyst: new THREE.OctahedronGeometry(0.13, 0),
      diamond: new THREE.OctahedronGeometry(0.2, 0),
    };
    this.mat = {}; this.spriteMat = {}; this.pillarMat = {};
    GEM_IDS.forEach((id, i) => {
      const c = GEMS[id].color;
      this.mat[id] = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 + i * 0.15, roughness: 0.08, metalness: 0.35, flatShading: true });
      this.spriteMat[id] = new THREE.SpriteMaterial({ map: tex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.75 });
      this.pillarMat[id] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2 + i * 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: i >= 3 ? false : true, toneMapped: false });
    });
    this.pillarGeo = new THREE.CylinderGeometry(0.06, 0.14, 7, 8, 1, true).translate(0, 3.5, 0);
  }

  spawn(id, x, z) {
    const rank = GEM_IDS.indexOf(id);
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(this.geo[id], this.mat[id]);
    mesh.scale.y = id === 'amethyst' ? 2.4 : id === 'emerald' ? 1.0 : 1.4;
    mesh.castShadow = false;
    g.add(mesh);
    const sp = new THREE.Sprite(this.spriteMat[id]);
    sp.scale.setScalar(0.9 + rank * 0.28); g.add(sp);
    if (rank >= 2) { const p = new THREE.Mesh(this.pillarGeo, this.pillarMat[id]); p.scale.set(1 + (rank - 2) * 0.4, rank >= 3 ? 1.8 : 1, 1 + (rank - 2) * 0.4); p.position.y = -0.4; g.add(p); g.userData.pillar = p; }
    g.position.set(x, 1.1, z);
    this.scene.add(g);
    const a = Math.random() * 6.283, sp2 = rnd(1.2, 3.2);
    this.list.push({
      id, rank, group: g, mesh, vx: Math.cos(a) * sp2, vy: rnd(3.5, 6), vz: Math.sin(a) * sp2,
      landed: false, age: 0, phase: Math.random() * 6, magnet: false, mv: 0,
    });
    G.fx.burst(g.position, GEMS[id].color, 8 + rank * 3);
  }

  clear() { for (const g of this.list) this.scene.remove(g.group); this.list.length = 0; }

  update(dt, t) {
    const P = G.player;
    const rad = 3.2 + (P.perks.magnet || 0) * 2.2;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i], p = g.group.position;
      g.age += dt;
      if (!g.landed) {
        g.vy -= 18 * dt;
        p.x += g.vx * dt; p.y += g.vy * dt; p.z += g.vz * dt;
        if (p.y <= 0.45) { p.y = 0.45; if (g.vy < -2.5) { g.vy *= -0.38; g.vx *= 0.6; g.vz *= 0.6; } else { g.landed = true; } }
        G.world.resolve(p, 0.2);
      }
      g.mesh.rotation.y += dt * 2.4;
      if (g.landed && !g.magnet) p.y = 0.55 + Math.sin(t * 2.2 + g.phase) * 0.1;

      const dx = P.pos.x - p.x, dy = (P.pos.y + 1.0) - p.y, dz = P.pos.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (g.landed && d < rad) g.magnet = true;
      if (g.magnet) {
        g.mv = Math.min(24, g.mv + dt * 40);
        const k = Math.min(d, g.mv * dt) / (d || 1);
        p.x += dx * k; p.y += dy * k; p.z += dz * k;
      }
      if (d < 0.95 && g.landed || (g.magnet && d < 0.7)) { this.collect(g); this.list.splice(i, 1); continue; }

      if (Math.random() < dt * (1.5 + g.rank)) G.fx.sparkle(p, GEMS[g.id].color);
      // expire
      if (g.age > 85) {
        g.group.visible = Math.floor(g.age * 8) % 2 === 0;
        if (g.age > 95) { this.scene.remove(g.group); this.list.splice(i, 1); }
      }
    }
  }

  collect(g) {
    const P = G.player, id = g.id;
    P.gems[id] = (P.gems[id] || 0) + 1;
    G.stats.gems++;
    G.sound.pickup(g.rank);
    G.fx.burst(g.group.position, GEMS[id].color, 14);
    G.ui.gemPop(id);
    this.scene.remove(g.group);
  }
}

// -------- market --------
export class Market {
  constructor() {
    this.mult = {}; this.hist = {}; this.trend = {}; this.timer = 0; this.news = [];
    for (const id of GEM_IDS) { this.mult[id] = 1; this.hist[id] = Array(24).fill(1); this.trend[id] = 0; }
    this.headline = 'Markets open. Gems are shiny. Zombies are hungry.';
  }
  reset() { Object.assign(this, new Market()); }
  price(id) {
    const hag = (G.player?.perks?.haggler || 0) * 0.06;
    return Math.max(1, Math.round(GEMS[id].base * this.mult[id] * (1 + hag)));
  }
  tick(eventChance = 0.18) {
    for (const id of GEM_IDS) {
      const m = this.mult[id];
      const drift = (Math.random() - 0.5) * 0.28 + (1 - m) * 0.14;
      this.trend[id] = drift;
      this.mult[id] = Math.min(2.2, Math.max(0.5, m * (1 + drift)));
    }
    if (Math.random() < eventChance) {
      const id = GEM_IDS[Math.floor(Math.random() * GEM_IDS.length)];
      const up = Math.random() < 0.6;
      const f = up ? rnd(1.35, 1.7) : rnd(0.55, 0.75);
      this.mult[id] = Math.min(2.4, Math.max(0.45, this.mult[id] * f));
      this.trend[id] = up ? 0.3 : -0.3;
      const n = GEMS[id].name.toUpperCase();
      const ups = [`${n} CRAZE! Collectors are paying through the nose.`, `Rumor: a rich survivor wants ${n}S. Prices surge!`, `${n} SHORTAGE reported across the dead zone.`];
      const downs = [`${n} MARKET FLOODED. Prices tumble.`, `Fake ${n}S spotted! Buyers are nervous.`, `Looters dumped a ${n} stash. Prices crash.`];
      this.headline = (up ? ups : downs)[Math.floor(Math.random() * 3)];
      this.news.push({ id, up });
    }
    for (const id of GEM_IDS) { this.hist[id].push(this.mult[id]); this.hist[id].shift(); }
    G.ui?.marketUpdated();
  }
  update(dt) {
    this.timer += dt;
    if (this.timer > 32) { this.timer = 0; this.tick(0.12); }
  }
}
