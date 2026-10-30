// Particle pools (instanced), bullet tracers and blood decals.
import * as THREE from 'three';
import { G } from './state.js';

const rnd = (a, b) => a + Math.random() * (b - a);

function radialTexture(stops, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const glowTex = () => radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);

class Pool {
  constructor(scene, max, geometry, material, billboard) {
    this.max = max; this.n = 0; this.billboard = billboard;
    geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
    material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
    };
    material.customProgramCacheKey = () => 'pool-alpha';
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    // SoA state
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.size1 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.col = new Float32Array(max * 3); this.alpha = new Float32Array(max);
    this.fade = new Uint8Array(max); // 0 none, 1 fade-out
    this.floor = new Uint8Array(max);
    this.rot = new Float32Array(max); this.spin = new Float32Array(max);
    this.dummy = new THREE.Object3D();
    this.c = new THREE.Color();
  }
  emit(o) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = o.x; this.p[i * 3 + 1] = o.y; this.p[i * 3 + 2] = o.z;
    this.v[i * 3] = o.vx || 0; this.v[i * 3 + 1] = o.vy || 0; this.v[i * 3 + 2] = o.vz || 0;
    this.life[i] = this.maxLife[i] = o.life || 0.5;
    this.size[i] = o.size || 0.1; this.size1[i] = o.size1 ?? this.size[i];
    this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0;
    this.c.set(o.color ?? 0xffffff);
    this.col[i * 3] = this.c.r; this.col[i * 3 + 1] = this.c.g; this.col[i * 3 + 2] = this.c.b;
    this.alpha[i] = o.alpha ?? 1;
    this.fade[i] = o.fade === false ? 0 : 1;
    this.floor[i] = o.floor ? 1 : 0;
    this.rot[i] = Math.random() * 6.28; this.spin[i] = o.spin ?? 0;
  }
  swap(a, b) {
    for (let k = 0; k < 3; k++) {
      this.p[a * 3 + k] = this.p[b * 3 + k]; this.v[a * 3 + k] = this.v[b * 3 + k]; this.col[a * 3 + k] = this.col[b * 3 + k];
    }
    this.life[a] = this.life[b]; this.maxLife[a] = this.maxLife[b]; this.size[a] = this.size[b]; this.size1[a] = this.size1[b];
    this.grav[a] = this.grav[b]; this.drag[a] = this.drag[b]; this.alpha[a] = this.alpha[b]; this.fade[a] = this.fade[b];
    this.floor[a] = this.floor[b]; this.rot[a] = this.rot[b]; this.spin[a] = this.spin[b];
  }
  update(dt, camQuat) {
    const d = this.dummy, aAttr = this.mesh.geometry.attributes.aAlpha, ic = this.mesh.instanceColor;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.n--; if (i !== this.n) this.swap(i, this.n); continue; }
      const k = i * 3;
      const drag = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= drag; this.v[k + 2] *= drag; this.v[k + 1] = this.v[k + 1] * drag - this.grav[i] * dt;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.floor[i] && this.p[k + 1] < 0.03) { this.p[k + 1] = 0.03; this.v[k] *= 0.3; this.v[k + 1] = 0; this.v[k + 2] *= 0.3; this.grav[i] = 0; }
      const t = 1 - this.life[i] / this.maxLife[i];
      const s = this.size[i] + (this.size1[i] - this.size[i]) * t;
      d.position.set(this.p[k], this.p[k + 1], this.p[k + 2]);
      if (this.billboard) { d.quaternion.copy(camQuat); d.rotateZ(this.rot[i] + this.spin[i] * t); }
      else d.rotation.set(this.rot[i] + t * 4, this.rot[i] * 2 + t * 3, 0);
      d.scale.setScalar(s);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      ic.setXYZ(i, this.col[k], this.col[k + 1], this.col[k + 2]);
      aAttr.array[i] = this.alpha[i] * (this.fade[i] ? Math.min(1, this.life[i] / this.maxLife[i] * 2.2) : 1);
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    ic.needsUpdate = true;
    aAttr.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    const tex = glowTex();
    this.solid = new Pool(scene, 900, new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), false);
    this.glow = new Pool(scene, 700, new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), true);
    this.smoke = new Pool(scene, 500, new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), true);

    // tracers
    this.tracers = [];
    const tg = new THREE.BoxGeometry(0.012, 0.012, 1);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd488, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.visible = false; m.userData.life = 0; scene.add(m); this.tracers.push(m);
    }
    this.tr = 0;

    // blood decals
    const dc = document.createElement('canvas'); dc.width = dc.height = 128;
    const x = dc.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 44, rr = 4 + Math.random() * 14;
      const gx = 64 + Math.cos(a) * r, gy = 64 + Math.sin(a) * r;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, rr);
      g.addColorStop(0, 'rgba(120,10,10,0.95)'); g.addColorStop(0.7, 'rgba(90,6,6,0.8)'); g.addColorStop(1, 'rgba(60,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    const dt = new THREE.CanvasTexture(dc);
    this.decalMat = new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.decals = []; this.dIdx = 0;

    // shared explosion light (never added/removed, so shaders don't recompile)
    this.boom = new THREE.PointLight(0xff8a30, 0, 40, 1.6);
    scene.add(this.boom);
    this.boomT = 0;
  }

  // ---- spawners ----
  blood(p, dir, n = 8, scale = 1) {
    for (let i = 0; i < n; i++) {
      const sp = rnd(1.5, 6);
      this.solid.emit({
        x: p.x, y: p.y, z: p.z,
        vx: dir.x * sp * 0.6 + rnd(-2, 2), vy: rnd(0.5, 4), vz: dir.z * sp * 0.6 + rnd(-2, 2),
        life: rnd(0.5, 1.1), size: rnd(0.03, 0.08) * scale, grav: 14, color: Math.random() < 0.75 ? 0x8a0b0b : 0x4d0505, floor: true, fade: false,
      });
    }
    // mist
    this.smoke.emit({ x: p.x, y: p.y, z: p.z, vx: dir.x, vy: 0.4, vz: dir.z, life: 0.45, size: 0.15 * scale, size1: 0.6 * scale, color: 0x7a0000, alpha: 0.5, drag: 3 });
    if (Math.random() < 0.35 * scale) this.decal(p.x + dir.x * rnd(0.3, 1.8), p.z + dir.z * rnd(0.3, 1.8), rnd(0.5, 1.2) * scale);
  }
  gibs(p, scale = 1) {
    for (let i = 0; i < 24 * scale; i++) {
      this.solid.emit({
        x: p.x, y: p.y, z: p.z, vx: rnd(-5, 5), vy: rnd(2, 8), vz: rnd(-5, 5),
        life: rnd(0.8, 1.6), size: rnd(0.05, 0.15) * Math.sqrt(scale), grav: 16, color: [0x8a0b0b, 0x4d0505, 0x5a6a45, 0x3a3328][i % 4], floor: true, fade: false,
      });
    }
    this.decal(p.x, p.z, 1.6 * scale);
  }
  decal(x, z, size = 1) {
    let m;
    if (this.decals.length < 70) {
      m = new THREE.Mesh(this.decalGeo, this.decalMat); this.scene.add(m); this.decals.push(m);
    } else { m = this.decals[this.dIdx]; this.dIdx = (this.dIdx + 1) % this.decals.length; }
    m.position.set(x, 0.02 + Math.random() * 0.01, z);
    m.rotation.y = Math.random() * 6.28;
    m.scale.setScalar(size);
  }
  impact(p, nrm, color = 0xffc070) {
    for (let i = 0; i < 6; i++) {
      this.glow.emit({
        x: p.x, y: p.y, z: p.z, vx: nrm.x * 3 + rnd(-2.5, 2.5), vy: nrm.y * 3 + rnd(0, 3), vz: nrm.z * 3 + rnd(-2.5, 2.5),
        life: rnd(0.15, 0.35), size: 0.12, size1: 0.02, grav: 8, color,
      });
    }
    for (let i = 0; i < 3; i++) {
      this.smoke.emit({ x: p.x, y: p.y, z: p.z, vx: nrm.x + rnd(-0.5, 0.5), vy: rnd(0.2, 1), vz: nrm.z + rnd(-0.5, 0.5), life: 0.6, size: 0.2, size1: 0.7, color: 0x6a665a, alpha: 0.4, drag: 2 });
    }
  }
  muzzleSmoke(p) {
    this.smoke.emit({ x: p.x, y: p.y, z: p.z, vx: rnd(-0.2, 0.2), vy: rnd(0.2, 0.6), vz: rnd(-0.2, 0.2), life: 0.9, size: 0.1, size1: 0.6, color: 0x9a9a9a, alpha: 0.25, drag: 1.5 });
  }
  sparkle(p, color) {
    this.glow.emit({
      x: p.x + rnd(-0.2, 0.2), y: p.y + rnd(-0.1, 0.4), z: p.z + rnd(-0.2, 0.2), vx: 0, vy: rnd(0.3, 0.8), vz: 0,
      life: rnd(0.4, 0.8), size: rnd(0.12, 0.22), size1: 0, color, spin: 3,
    });
  }
  burst(p, color, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = rnd(1, 4);
      this.glow.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp, vy: rnd(1, 4), vz: Math.sin(a) * sp, life: rnd(0.4, 0.9), size: rnd(0.1, 0.25), size1: 0, grav: 5, color });
    }
  }
  explosion(p, radius) {
    const n = Math.floor(30 + radius * 6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.2 - 0.2, sp = rnd(2, radius * 1.8);
      this.glow.emit({
        x: p.x, y: p.y + 0.3, z: p.z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp * 0.8 + 2, vz: Math.sin(a) * Math.cos(e) * sp,
        life: rnd(0.3, 0.9), size: rnd(0.8, 1.8), size1: rnd(2, 3.5), color: Math.random() < 0.5 ? 0xff9a2a : 0xff5a12, drag: 2.5, alpha: 0.9,
      });
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, sp = rnd(1, radius);
      this.smoke.emit({
        x: p.x, y: p.y + 0.5, z: p.z, vx: Math.cos(a) * sp * 0.6, vy: rnd(1, 5), vz: Math.sin(a) * sp * 0.6,
        life: rnd(1.4, 2.6), size: rnd(1, 2), size1: rnd(4, 7), color: 0x2a2724, alpha: 0.75, drag: 1.6,
      });
    }
    for (let i = 0; i < 40; i++) {
      this.solid.emit({ x: p.x, y: p.y + 0.3, z: p.z, vx: rnd(-9, 9), vy: rnd(3, 12), vz: rnd(-9, 9), life: rnd(0.7, 1.5), size: rnd(0.05, 0.14), grav: 18, color: [0x2b2118, 0x4a3a28, 0xff8a20][i % 3], floor: true, fade: false });
    }
    this.boom.position.set(p.x, p.y + 1.5, p.z);
    this.boom.intensity = 900; this.boomT = 0.5;
    this.boom.color.set(0xff8a30);
    G.shake = Math.max(G.shake, Math.min(1, 14 / (p.distanceTo(G.camera.position) + 2)));
  }
  gas(p) {
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * 6.28, sp = rnd(0.5, 3.2);
      this.smoke.emit({
        x: p.x, y: p.y + 0.3, z: p.z, vx: Math.cos(a) * sp, vy: rnd(0.3, 1.2), vz: Math.sin(a) * sp,
        life: rnd(1.6, 3.2), size: rnd(0.8, 1.4), size1: rnd(3, 4.5), color: Math.random() < 0.5 ? 0x7fcf2a : 0x4f9a1a, alpha: 0.7, drag: 1.4,
      });
    }
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * 6.28, sp = rnd(1, 5);
      this.glow.emit({ x: p.x, y: p.y + 0.4, z: p.z, vx: Math.cos(a) * sp, vy: rnd(1, 4), vz: Math.sin(a) * sp, life: rnd(0.4, 0.9), size: 0.25, size1: 0, color: 0xa8ff3a, grav: 4 });
    }
    this.decal(p.x, p.z, 2.5);
    this.boom.position.set(p.x, p.y + 1, p.z);
    this.boom.color.set(0x7fff2a); this.boom.intensity = 250; this.boomT = 0.4;
  }
  tracer(from, to, color = 0xffd488) {
    const m = this.tracers[this.tr]; this.tr = (this.tr + 1) % this.tracers.length;
    const len = from.distanceTo(to);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to);
    m.scale.set(1, 1, len);
    m.material.color.set(color);
    m.material.opacity = 0.7;
    m.userData.life = 0.07;
    m.visible = true;
  }

  update(dt, camera) {
    const q = camera.quaternion;
    this.solid.update(dt, q); this.glow.update(dt, q); this.smoke.update(dt, q);
    for (const m of this.tracers) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      if (m.userData.life <= 0) m.visible = false; else m.material.opacity = m.userData.life / 0.07 * 0.7;
    }
    if (this.boomT > 0) {
      this.boomT -= dt;
      this.boom.intensity *= Math.pow(0.002, dt * 2);
      if (this.boomT <= 0) this.boom.intensity = 0;
    }
  }
}
