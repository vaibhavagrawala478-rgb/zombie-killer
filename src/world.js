// The graveyard-at-night arena: terrain, props, the Emporium, lighting, collision.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildGun } from './gunmodels.js';
import { WEAPONS, GEMS, GEM_IDS } from './data.js';
import { glowTex } from './fx.js';
import { G } from './state.js';
import { A, cloneProp, pbr } from './assets.js';

export const ARENA_R = 60;
export const SHOP_POS = new THREE.Vector3(0, 0, 5.2); // interaction centre (in front of the counter)
export const SHOP_RADIUS = 7.5;

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = mulberry32(1337);
const rr = (a, b) => a + rand() * (b - a);

function canvasTex(size, paint, rep = [1, 1], aniso = 8) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

const painters = {
  ground(x, s) {
    x.fillStyle = '#26301f'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const h = 70 + rand() * 50, sat = 15 + rand() * 25, l = 9 + rand() * 14;
      x.fillStyle = `hsla(${h},${sat}%,${l}%,${0.35 + rand() * 0.5})`;
      const w = 2 + rand() * 7;
      x.fillRect(rand() * s, rand() * s, w, w * (0.5 + rand() * 1.5));
    }
    for (let i = 0; i < 40; i++) { // dirt patches
      const px = rand() * s, py = rand() * s, r = 12 + rand() * 40;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(60,44,28,0.5)'); g.addColorStop(1, 'rgba(60,44,28,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
  },
  gravel(x, s) {
    x.fillStyle = '#4a4034'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 3200; i++) {
      const l = 18 + rand() * 30;
      x.fillStyle = `hsl(${25 + rand() * 15},${10 + rand() * 18}%,${l}%)`;
      const w = 1.5 + rand() * 4.5; x.fillRect(rand() * s, rand() * s, w, w * (0.6 + rand() * 0.8));
    }
  },
  wood(x, s) {
    x.fillStyle = '#5a3d22'; x.fillRect(0, 0, s, s);
    const n = 4, pw = s / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = `hsl(${24 + rand() * 6},${34 + rand() * 12}%,${24 + rand() * 12}%)`;
      x.fillRect(i * pw + 2, 0, pw - 4, s);
      for (let k = 0; k < 24; k++) {
        x.strokeStyle = `rgba(20,10,0,${0.1 + rand() * 0.2})`; x.lineWidth = 1 + rand();
        const gx = i * pw + 4 + rand() * (pw - 8);
        x.beginPath(); x.moveTo(gx, rand() * s); x.lineTo(gx + rand() * 4 - 2, rand() * s); x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(i * pw, 0, 2, s);
    }
  },
  rust(x, s) {
    x.fillStyle = '#5b4333'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 16) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i, 0, 3, s); x.fillStyle = 'rgba(255,200,150,0.07)'; x.fillRect(i + 3, 0, 2, s); }
    for (let i = 0; i < 60; i++) {
      const px = rand() * s, py = rand() * s, r = 6 + rand() * 30;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${150 + rand() * 60},${70 + rand() * 30},20,0.5)`); g.addColorStop(1, 'rgba(120,50,10,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
  },
  stone(x, s) {
    x.fillStyle = '#5a5e66'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) { const l = 25 + rand() * 30; x.fillStyle = `hsla(220,6%,${l}%,0.5)`; const w = 2 + rand() * 6; x.fillRect(rand() * s, rand() * s, w, w); }
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(60,90,50,${0.1 + rand() * 0.2})`; x.beginPath(); x.arc(rand() * s, rand() * s, 6 + rand() * 18, 0, 6.3); x.fill(); }
  },
  crate(x, s) {
    painters.wood(x, s);
    x.strokeStyle = '#2a1a0c'; x.lineWidth = 10; x.strokeRect(5, 5, s - 10, s - 10);
    x.beginPath(); x.moveTo(5, 5); x.lineTo(s - 5, s - 5); x.moveTo(s - 5, 5); x.lineTo(5, s - 5); x.stroke();
  },
};

function instanced(scene, geo, mat, items, cast = true, receive = false) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    d.position.set(it.x, it.y ?? 0, it.z);
    d.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
    d.scale.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
    d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    if (it.color !== undefined) m.setColorAt(i, new THREE.Color(it.color));
  });
  m.castShadow = cast; m.receiveShadow = receive;
  m.instanceMatrix.needsUpdate = true;
  scene.add(m);
  return m;
}

// Recursive dead-tree geometry (merged, so a forest is a handful of draw calls).
function treeGeometry(seed) {
  const r = mulberry32(seed);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  function branch(origin, dir, len, rad, depth) {
    const g = new THREE.CylinderGeometry(rad * 0.62, rad, len, 6, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    g.applyMatrix4(new THREE.Matrix4().compose(origin, q, new THREE.Vector3(1, 1, 1)));
    parts.push(g);
    if (depth <= 0) return;
    const end = origin.clone().addScaledVector(dir, len);
    const n = depth === 3 ? 4 : 2 + (r() > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.3, depth === 3 ? 0.15 + r() * 0.5 : (r() - 0.35) * 0.6, (r() - 0.5) * 1.3)).normalize();
      const o = depth === 3 ? origin.clone().addScaledVector(dir, len * (0.55 + r() * 0.4)) : end;
      branch(o, nd, len * (0.55 + r() * 0.25), rad * 0.5, depth - 1);
    }
  }
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12).normalize(), 3.2 + r() * 1.2, 0.26, 3);
  return mergeGeometries(parts);
}

export function buildWorld(scene, fx) {
  const world = {
    circles: [], boxes: [], flames: [], animated: [], shopPos: SHOP_POS, shopRadius: SHOP_RADIUS,
  };

  // ---------- atmosphere ----------
  const fogColor = 0x0a0f1c;
  scene.background = new THREE.Color(fogColor);
  scene.fog = new THREE.FogExp2(fogColor, 0.024);

  scene.add(new THREE.HemisphereLight(0x6f86c8, 0x2a2018, 0.55));
  const moon = new THREE.DirectionalLight(0x93adff, 1.7);
  moon.position.set(-40, 70, -50);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 10; sc.far = 200;
  moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);
  world.moon = moon;
  world.moonOffset = new THREE.Vector3(-40, 70, -50);

  // HDRI night sky (Poly Haven, CC0): visible sky + image-based lighting; the moon light is aimed at the HDRI's moon
  if (A.sky) {
    A.sky.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = A.sky; scene.backgroundIntensity = 0.85;
    const pm = new THREE.PMREMGenerator(G.renderer);
    scene.environment = pm.fromEquirectangular(A.sky).texture; scene.environmentIntensity = 0.5;
    pm.dispose();
    if (A.moonDir) {
      const d = A.moonDir.clone(); d.y = Math.max(d.y, 0.45); d.normalize();
      world.moonOffset.copy(d).multiplyScalar(95);
    }
  }

  // ---------- ground (PBR) ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), pbr('mud', 110, 110, { normal: 1.3, color: 0xb8b8b8 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const gravelOpts = { normal: 1.2, color: 0xc8c0b8 };
  const decalFix = (m) => { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; return m; };
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(15, 48).rotateX(-Math.PI / 2), decalFix(pbr('gravel', 7, 7, gravelOpts)));
  plaza.position.set(0, 0.01, 4); plaza.receiveShadow = true; scene.add(plaza);
  for (const [ang, len] of [[0, 52], [Math.PI / 2, 52], [Math.PI * 0.78, 48], [-Math.PI * 0.3, 48]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.6, len).rotateX(-Math.PI / 2), decalFix(pbr('gravel', 1.5, len / 3.4, gravelOpts)));
    p.position.set(Math.sin(ang) * (len / 2 + 8), 0.008, 4 + Math.cos(ang) * (len / 2 + 8));
    p.rotation.y = ang; p.receiveShadow = true; scene.add(p);
  }

  // dead grass tufts
  {
    // three thin blades per tuft, merged -> one geometry; dark and short so they read as scrub, not spikes
    const blades = [0, 1, 2].map(i => { const b = new THREE.ConeGeometry(0.028, 0.5, 3).translate(0, 0.25, 0); b.rotateZ((i - 1) * 0.35); b.rotateY(i * 2.1); return b; });
    const geo = mergeGeometries(blades);
    const items = [];
    for (let i = 0; i < 1800; i++) {
      const a = rand() * 6.283, d = Math.sqrt(rand()) * 72;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.hypot(x, z - 4) < 15) continue;
      items.push({ x, z, ry: rand() * 6, s: 0.7 + rand() * 0.9, sy: 0.6 + rand() * 0.9 });
    }
    instanced(scene, geo, new THREE.MeshStandardMaterial({ color: 0x2c2a1a, roughness: 1, envMapIntensity: 0.2 }), items, false, false);
  }

  // ---------- materials ----------
  const woodMat = pbr('planks', 1, 1, { color: 0xa09080 });
  const rustMat = pbr('metal', 2, 1, { color: 0xb08a6e, metalness: 0.55, roughness: 0.85 });
  const stoneMat = pbr('rock', 1, 1, { color: 0xb4b4b4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.9 });

  const addBox = (parent, w, h, d, x, y, z, m, cast = true, receive = true) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.castShadow = cast; b.receiveShadow = receive; parent.add(b); return b;
  };
  const circ = (x, z, r, h = 3) => world.circles.push({ x, z, r, h });
  const aabb = (x0, x1, z0, z1, h) => world.boxes.push({ x0, x1, z0, z1, h });

  // ---------- fence ring ----------
  {
    const posts = [], rails = [];
    const N = 150;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, r = ARENA_R + 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 1.3 + rand() * 0.8;
      posts.push({ x, z, sy: h, ry: -a, rz: (rand() - 0.5) * 0.18, rx: (rand() - 0.5) * 0.12 });
      if (rand() > 0.22) {
        const a2 = (i + 0.5) / N * Math.PI * 2, len = 2 * Math.PI * r / N;
        rails.push({ x: Math.cos(a2) * r, z: Math.sin(a2) * r, y: 0.55 + rand() * 0.15, ry: -a2 - Math.PI / 2, sz: len * 1.02, rx: (rand() - 0.5) * 0.1 });
        if (rand() > 0.35) rails.push({ x: Math.cos(a2) * r, z: Math.sin(a2) * r, y: 1.15 + rand() * 0.2, ry: -a2 - Math.PI / 2, sz: len * 1.02, rx: (rand() - 0.5) * 0.1 });
      }
    }
    instanced(scene, new THREE.BoxGeometry(0.2, 1, 0.2).translate(0, 0.5, 0), woodMat, posts, true, false);
    instanced(scene, new THREE.BoxGeometry(0.06, 0.14, 1), woodMat, rails, true, false);
  }

  // ---------- trees ----------
  {
    const geos = [11, 22, 33, 44].map(treeGeometry);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
    const buckets = geos.map(() => []);
    for (let i = 0; i < 90; i++) {
      const a = rand() * 6.283, d = ARENA_R + 6 + rand() * 60;
      buckets[i % 4].push({ x: Math.cos(a) * d, z: Math.sin(a) * d, ry: rand() * 6.3, s: 1.2 + rand() * 1.3 });
    }
    for (let i = 0; i < 16; i++) { // a few inside the arena as cover
      let x, z, tries = 0;
      do { const a = rand() * 6.283, d = 14 + rand() * 42; x = Math.cos(a) * d; z = Math.sin(a) * d; tries++; } while (Math.hypot(x, z - 4) < 15 && tries < 20);
      const s = 0.9 + rand() * 0.7;
      buckets[i % 4].push({ x, z, ry: rand() * 6.3, s });
      circ(x, z, 0.42 * s, 6);
    }
    geos.forEach((g, i) => instanced(scene, g, mat, buckets[i], true, false));
  }

  // ---------- graveyard ----------
  {
    const items = [];
    const cx = -31, cz = -24;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
      if (rand() < 0.15) continue;
      const x = cx + col * 3.1 + rr(-0.3, 0.3), z = cz + row * 3.4 + rr(-0.3, 0.3);
      const tall = rand() > 0.6;
      items.push({ x, z, ry: rr(-0.25, 0.25), rz: rr(-0.18, 0.18), rx: rr(-0.1, 0.1), sy: tall ? 1.35 : 0.85, sx: 0.9 + rand() * 0.3 });
      circ(x, z, 0.5, 1.2);
    }
    const geo = new THREE.BoxGeometry(0.7, 1, 0.16).translate(0, 0.5, 0);
    instanced(scene, geo, stoneMat, items, true, true);
    // crosses
    const cr = [];
    for (let i = 0; i < 7; i++) {
      const x = cx + rr(-2, 22), z = cz + rr(-3, 15);
      cr.push({ x, z, ry: rand() * 6.3, rz: rr(-0.2, 0.2), s: 1 }); circ(x, z, 0.3, 2);
    }
    const cg = mergeGeometries([new THREE.BoxGeometry(0.12, 1.7, 0.12).translate(0, 0.85, 0), new THREE.BoxGeometry(0.8, 0.12, 0.12).translate(0, 1.35, 0)]);
    instanced(scene, cg, woodMat, cr, true, false);
    // crypt
    const crypt = new THREE.Group(); crypt.position.set(cx + 24, 0, cz + 6);
    addBox(crypt, 5, 3.2, 4, 0, 1.6, 0, stoneMat);
    addBox(crypt, 5.6, 0.4, 4.6, 0, 3.4, 0, stoneMat);
    addBox(crypt, 1.4, 2.2, 0.2, 0, 1.1, 2.05, darkMat);
    scene.add(crypt);
    aabb(crypt.position.x - 2.5, crypt.position.x + 2.5, crypt.position.z - 2, crypt.position.z + 2, 3.5);
  }

  // ---------- rocks ----------
  {
    const items = [];
    for (let i = 0; i < 40; i++) {
      const a = rand() * 6.283, d = 14 + rand() * 44;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.hypot(x + 31, z + 24) < 14 && x < -10) continue;
      const s = 0.4 + rand() * 1.1;
      items.push({ x, z, y: s * 0.25, ry: rand() * 6.3, sx: s * (1 + rand() * 0.5), sy: s * 0.7, sz: s });
      if (s > 0.7) circ(x, z, s * 0.85, 1);
    }
    instanced(scene, new THREE.DodecahedronGeometry(0.8, 0), stoneMat, items, true, true);
  }

  // ---------- props (Quaternius Zombie Apocalypse Kit, CC0) - instanced so each prop type costs ~1 draw call ----------
  function scatterProp(key, list) {
    if (!list.length) return;
    const model = A.models[key].scene; model.updateMatrixWorld(true);
    const d = new THREE.Object3D();
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
      list.forEach((it, i) => {
        d.position.set(it.x, it.y || 0, it.z); d.rotation.set(0, it.ry || 0, 0); d.scale.setScalar(it.s || 1); d.updateMatrix();
        im.setMatrixAt(i, d.matrix.clone().multiply(mesh.matrixWorld));
      });
      im.castShadow = true; im.receiveShadow = true;
      scene.add(im);
    });
  }
  const quarter = (ry) => Math.round(ry / (Math.PI / 2)) % 2 !== 0; // is a prop turned 90 degrees (swap its collider axes)?
  const boxProp = (x, z, ry, hx, hz, h) => { const sw = quarter(ry); aabb(x - (sw ? hz : hx), x + (sw ? hz : hx), z - (sw ? hx : hz), z + (sw ? hx : hz), h); };

  // barrels: five burning ones with light + flames, plus scattered cold ones
  const fireSpots = [[-9, 6.5], [9.5, 7], [0, -14], [-26, -4], [30, -20]];
  const coldBarrels = [[-13, 8], [-6, -9], [18, -4], [-20, 22], [14, 26], [3, 30], [-12.4, 9], [-33, 8], [36, -8]];
  scatterProp('barrel', [...fireSpots, ...coldBarrels].map(([x, z]) => ({ x, z, ry: rand() * 6.28 })));
  for (const [x, z] of coldBarrels) circ(x, z, 0.42, 1.15);
  fireSpots.forEach(([x, z], idx) => {
    circ(x, z, 0.42, 1.15);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false }));
    top.position.set(x, 1.1, z); scene.add(top);
    const light = idx < 3 ? new THREE.PointLight(0xff8a3a, 16, 24, 1.8) : null;
    if (light) { light.position.set(x, 1.8, z); scene.add(light); }
    world.flames.push({ x, z, light, seed: rand() * 100 });
  });

  // cover: pallets, chests, cinder blocks, containers
  const clusterSpots = [[-11, 12], [13, 10], [-24, 3], [22, 18], [6, -22], [-16, -14], [28, -2], [-4, -34]];
  const pallets = [], chests = [], blocks = [], trash = [], wheels = [];
  for (const [x, z] of clusterSpots) {
    pallets.push({ x, z, ry: rr(-0.4, 0.4) }); circ(x, z, 0.75, 0.2);
    chests.push({ x: x + 0.2, z: z + 0.1, y: 0.14, ry: rr(-0.5, 0.5) });
    blocks.push({ x: x + 1.2, z: z - 0.4, ry: rr(0, 3) }, { x: x + 1.5, z: z - 0.1, y: 0.23, ry: rr(0, 3) });
    trash.push({ x: x - 1.1, z: z + 0.6, ry: rr(0, 6) }, { x: x - 1.5, z: z + 0.1, ry: rr(0, 6) });
    circ(x, z, 0.85, 1.0);
  }
  for (const [x, z] of [[8, 14], [-3, 19], [-14, 26], [24, 5]]) wheels.push({ x, z, ry: rand() * 6 });
  scatterProp('pallet', pallets); scatterProp('chest', chests); scatterProp('cinder', blocks); scatterProp('trash1', trash); scatterProp('wheels', wheels);
  for (const w of wheels) circ(w.x, w.z, 0.4, 0.6);
  const bigCover = [['cont_g', -18, -24, 0, 2.85, 1.28], ['cont_r', 21, 31, Math.PI / 2, 2.85, 1.28], ['cont_g', 36, 6, Math.PI / 2, 2.85, 1.28]];
  for (const [key, x, z, ry, hx, hz] of bigCover) { scatterProp(key, [{ x, z, ry }]); boxProp(x, z, ry, hx, hz, 2.7); }

  // street dressing along the paths
  const cones = [], barriers = [], hydrants = [];
  for (const [x, z] of [[4, 22], [5.5, 23], [-5, 26], [-6.5, 27], [10, -8], [11, -9.5]]) cones.push({ x, z, ry: rand() * 6 });
  for (const [x, z, ry] of [[2, 20, 0.1], [-2.5, 24, -0.15], [12, 3, Math.PI / 2], [-12, 3, Math.PI / 2]]) { barriers.push({ x, z, ry }); circ(x, z, 0.55, 0.6); }
  for (const [x, z] of [[-4.5, 12], [15, 12]]) { hydrants.push({ x, z, ry: rand() * 6 }); circ(x, z, 0.28, 0.8); }
  scatterProp('cone1', cones); scatterProp('barrier', barriers); scatterProp('hydrant', hydrants);
  scatterProp('couch', [{ x: -8.5, z: -1.5, ry: Math.PI / 2 + 0.2 }]); boxProp(-8.5, -1.5, Math.PI / 2, 0.8, 1.55, 1.2);
  scatterProp('tower', [{ x: -46, z: -42, ry: 0.4 }]); circ(-46, -42, 1.5, 9);

  // wrecked vehicles (axis-aligned collider boxes)
  const cars = [['car_pickup', -21, 15, Math.PI / 2, 1.2, 2.6], ['car_sports', 25, -14, 0, 1.35, 2.85], ['car_truck', -3, 40, Math.PI, 1.4, 3.1], ['car_truck', 33, 22, Math.PI / 2, 1.4, 3.1]];
  for (const [key, x, z, ry, hx, hz] of cars) { scatterProp(key, [{ x, z, ry }]); boxProp(x, z, ry, hx, hz, 2.0); }

  // street lamps (model + additive halo so they glow through the fog)
  for (const [x, z] of [[-7, 11], [7, 11], [-17, 0], [17, 1]]) {
    const g = cloneProp('streetlights'); g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-x, -(z - 4));
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffcf80, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    halo.scale.set(2.2, 2.2, 1); halo.material.opacity = 0.5; halo.position.set(0, 6.3, 2.6); g.add(halo);
    scene.add(g); circ(x, z, 0.22, 6.6);
    world.animated.push({ type: 'lamp', halo, seed: rand() * 50 });
  }

  // ---------- THE EMPORIUM ----------
  const shop = new THREE.Group(); scene.add(shop);
  const planks = pbr('planks', 3, 1, { color: 0xc9b8a8 });
  const floorM = pbr('planks', 4, 3, { color: 0x8a7a6a });
  addBox(shop, 10.6, 0.3, 6.6, 0, 0.15, 0, floorM);
  addBox(shop, 10.4, 3.7, 0.3, 0, 2.0, -3.1, planks);
  addBox(shop, 0.3, 3.7, 6.4, -5.1, 2.0, 0, planks);
  addBox(shop, 0.3, 3.7, 6.4, 5.1, 2.0, 0, planks);
  const roof = addBox(shop, 11.8, 0.3, 8.4, 0, 3.95, 0.9, rustMat); roof.rotation.x = 0.045;
  addBox(shop, 0.28, 3.9, 0.28, -5.5, 1.95, 4.5, woodMat);
  addBox(shop, 0.28, 3.9, 0.28, 5.5, 1.95, 4.5, woodMat);
  // counter
  const counterMat = pbr('planks', 4, 1, { color: 0xb59a80 });
  addBox(shop, 10.2, 1.2, 0.9, 0, 0.8, 2.5, counterMat);
  addBox(shop, 10.6, 0.14, 1.3, 0, 1.46, 2.5, new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.5 }));
  // shelves + gems
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.8 });
  const displayGems = [];
  [1.2, 2.0].forEach((y, row) => {
    addBox(shop, 9.4, 0.1, 0.7, 0, y, -2.65, shelfMat);
    for (let i = 0; i < 12; i++) {
      const id = GEM_IDS[(i + row * 2) % GEM_IDS.length];
      const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshStandardMaterial({ color: GEMS[id].color, emissive: GEMS[id].color, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2 }));
      gm.scale.y = 1.3;
      gm.position.set(-4.2 + i * 0.77, y + 0.2, -2.55);
      shop.add(gm); displayGems.push(gm);
    }
  });
  // wall-mounted guns
  WEAPONS.forEach((w, i) => {
    const gun = buildGun(w.id); gun.userData.hands.visible = false;
    gun.rotation.y = -Math.PI / 2;
    const col = i % 3, row = Math.floor(i / 3);
    gun.position.set(-3.3 + col * 3.3, 2.85 + row * 0.5 - (row ? 0.1 : 0), -2.85);
    gun.scale.setScalar(1.15);
    shop.add(gun);
  });
  // lantern + lights
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false }));
  lantern.position.set(0, 3.25, 0.2); shop.add(lantern);
  const shopLight = new THREE.PointLight(0xffa860, 26, 26, 1.6); shopLight.position.set(0, 3.0, 0.6); scene.add(shopLight);
  const frontLight = new THREE.PointLight(0xffc890, 22, 20, 1.7); frontLight.position.set(0, 3.2, 5.2); scene.add(frontLight);
  // sign
  const signTex = canvasTex(1024, (x, s) => {
    x.fillStyle = '#0b0710'; x.fillRect(0, 0, s, s);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 190px Impact, "Arial Black", sans-serif';
    x.shadowColor = '#ff2a8a'; x.shadowBlur = 44; x.fillStyle = '#ff7ab8';
    x.fillText('GEMS', s / 2, 260); x.fillText('GEMS', s / 2, 260);
    x.shadowColor = '#00e5ff'; x.fillStyle = '#9ff6ff';
    x.fillText('& GUNS', s / 2, 520); x.fillText('& GUNS', s / 2, 520);
    x.shadowBlur = 18; x.shadowColor = '#ffd23a'; x.fillStyle = '#ffe58a';
    x.font = '700 70px Impact, "Arial Black", sans-serif';
    x.fillText("OLD ZEKE'S EMPORIUM", s / 2, 740);
    x.font = '700 48px Impact, "Arial Black", sans-serif';
    x.fillText('OPEN 24/7  ·  NO REFUNDS', s / 2, 840);
    x.strokeStyle = '#ff2a8a'; x.lineWidth = 14; x.shadowColor = '#ff2a8a'; x.shadowBlur = 30; x.strokeRect(24, 24, s - 48, s - 48);
  });
  signTex.repeat.set(1, 1);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), signMat);
  sign.position.set(0, 7.1, 1.9); shop.add(sign);
  addBox(shop, 5.8, 5.8, 0.2, 0, 7.1, 1.75, darkMat, false);
  addBox(shop, 0.2, 3.4, 0.2, -2.0, 4.8, 1.75, rustMat, false);
  addBox(shop, 0.2, 3.4, 0.2, 2.0, 4.8, 1.75, rustMat, false);
  const neon = new THREE.PointLight(0xff2a9a, 40, 30, 1.6); neon.position.set(0, 7.1, 4.2); scene.add(neon);
  const neon2 = new THREE.PointLight(0x20d8ff, 20, 26, 1.6); neon2.position.set(0, 5.2, 4.2); scene.add(neon2);
  // beacon diamond
  const bigGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0xb8f4ff, emissive: 0x6fe6ff, emissiveIntensity: 1.6, roughness: 0.05, metalness: 0.3, flatShading: true }));
  bigGem.scale.y = 1.5; bigGem.position.set(0, 11.2, 1.9); shop.add(bigGem);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.1, 90, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(0, 55, 1.9); shop.add(beam);
  // glowing interaction ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(SHOP_RADIUS - 0.18, SHOP_RADIUS, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ring.position.set(SHOP_POS.x, 0.05, SHOP_POS.z); scene.add(ring);
  // collider (whole building incl. counter)
  aabb(-5.3, 5.3, -3.3, 3.1, 4);
  circ(-5.5, 4.5, 0.2, 4); circ(5.5, 4.5, 0.2, 4);

  // Old Zeke
  const zeke = new THREE.Group(); zeke.position.set(0, 0.3, 1.3);
  {
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a47c, roughness: 0.8, emissive: 0xd9a47c, emissiveIntensity: 0.15 });
    const vest = new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x8c7a5a, roughness: 0.9 });
    const beard = new THREE.MeshStandardMaterial({ color: 0xbfbfc4, roughness: 1, emissive: 0xbfbfc4, emissiveIntensity: 0.12 });
    const hatM = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
    addBox(zeke, 0.78, 0.95, 0.46, 0, 0.95, 0, shirt, true, false);
    addBox(zeke, 0.8, 0.9, 0.5, 0, 0.95, 0.01, vest, true, false).scale.set(1, 1, 0.75);
    const head = new THREE.Group(); head.position.set(0, 1.62, 0); zeke.add(head);
    addBox(head, 0.36, 0.4, 0.36, 0, 0, 0, skin, true, false);
    addBox(head, 0.4, 0.34, 0.24, 0, -0.14, 0.12, beard, true, false);
    addBox(head, 0.06, 0.06, 0.04, -0.09, 0.05, 0.19, darkMat, false); addBox(head, 0.06, 0.06, 0.04, 0.09, 0.05, 0.19, darkMat, false);
    addBox(head, 0.07, 0.12, 0.08, 0, -0.02, 0.2, skin, false);
    addBox(head, 0.1, 0.03, 0.06, -0.09, 0.1, 0.19, beard, false); addBox(head, 0.1, 0.03, 0.06, 0.09, 0.1, 0.19, beard, false);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 16), hatM); brim.position.y = 0.22; head.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.26, 14), hatM); crown.position.y = 0.36; head.add(crown);
    const armL = addBox(zeke, 0.17, 0.17, 0.9, -0.5, 1.22, 0.55, shirt, true, false); armL.rotation.x = 0.35;
    const armR = addBox(zeke, 0.17, 0.17, 0.9, 0.5, 1.22, 0.55, shirt, true, false); armR.rotation.x = 0.35;
    zeke.userData = { head, armL, armR };
  }
  shop.add(zeke);
  world.zeke = zeke;

  // ---------- update ----------
  const tmp = new THREE.Vector3();
  world.update = (dt, t, playerPos) => {
    // fire flicker + flames
    for (const f of world.flames) {
      const fl = 0.75 + Math.sin(t * 13 + f.seed) * 0.12 + Math.sin(t * 7.3 + f.seed * 2) * 0.1 + (Math.random() - 0.5) * 0.15;
      if (f.light) f.light.intensity = 16 * fl;
      if (Math.random() < dt * 40) {
        fx.glow.emit({ x: f.x + (Math.random() - 0.5) * 0.4, y: 1.05, z: f.z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 0.4, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 0.4, life: 0.5 + Math.random() * 0.4, size: 0.5, size1: 0.1, color: Math.random() < 0.5 ? 0xff9a2a : 0xff5a10, alpha: 0.8 });
      }
      if (Math.random() < dt * 4) fx.smoke.emit({ x: f.x, y: 1.5, z: f.z, vx: 0.3, vy: 1.2, vz: 0.1, life: 2.2, size: 0.4, size1: 1.8, color: 0x2a2a2e, alpha: 0.3, drag: 0.2 });
    }
    // neon flicker
    const fl = Math.random() < 0.02 ? 0.35 : 1;
    neon.intensity = (36 + Math.sin(t * 3) * 6) * fl;
    neon2.intensity = (18 + Math.sin(t * 2.3 + 1) * 4) * fl;
    signMat.color.setScalar(0.88 + 0.12 * fl * (0.8 + 0.2 * Math.sin(t * 5)));
    shopLight.intensity = 26 + Math.sin(t * 9) * 1.5;
    bigGem.rotation.y = t * 0.9; bigGem.position.y = 11.2 + Math.sin(t * 1.4) * 0.2;
    beam.material.opacity = 0.07 + Math.sin(t * 1.2) * 0.02;
    ring.material.opacity = 0.28 + Math.sin(t * 2) * 0.1;
    displayGems.forEach((g, i) => { g.rotation.y = t * 0.8 + i; });
    for (const a of world.animated) if (a.type === 'lamp') a.halo.material.opacity = 0.5 + Math.sin(t * 6 + a.seed) * 0.06 + (Math.random() < 0.01 ? -0.3 : 0);
    // Zeke watches the player
    const zd = zeke.userData;
    tmp.set(playerPos.x - zeke.position.x, 0, playerPos.z - zeke.position.z);
    zd.head.rotation.y += (Math.max(-0.9, Math.min(0.9, Math.atan2(tmp.x, tmp.z))) - zd.head.rotation.y) * Math.min(1, dt * 3);
    zd.head.rotation.x = Math.sin(t * 1.3) * 0.03;
    zeke.position.y = 0.3 + Math.sin(t * 1.8) * 0.01;
    zd.armL.rotation.x = 0.35 + Math.sin(t * 2.0) * 0.02; zd.armR.rotation.x = 0.35 + Math.sin(t * 2.0 + 1) * 0.02;
    // moon shadow rig follows the player
    moon.target.position.set(playerPos.x, 0, playerPos.z);
    moon.position.copy(moon.target.position).add(world.moonOffset);
  };

  // ---------- collision helpers ----------
  world.resolve = (pos, r) => {
    for (const c of world.circles) {
      const dx = pos.x - c.x, dz = pos.z - c.z, rr2 = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr2 * rr2) {
        const d = Math.sqrt(d2) || 0.0001;
        pos.x = c.x + dx / d * rr2; pos.z = c.z + dz / d * rr2;
      }
    }
    for (const b of world.boxes) {
      const cx = Math.max(b.x0, Math.min(pos.x, b.x1)), cz = Math.max(b.z0, Math.min(pos.z, b.z1));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
        else { // centre inside the box: push out along the shallowest axis
          const l = pos.x - b.x0, rgt = b.x1 - pos.x, f = pos.z - b.z0, bk = b.z1 - pos.z, m = Math.min(l, rgt, f, bk);
          if (m === l) pos.x = b.x0 - r; else if (m === rgt) pos.x = b.x1 + r; else if (m === f) pos.z = b.z0 - r; else pos.z = b.z1 + r;
        }
      }
    }
    const d = Math.hypot(pos.x, pos.z), lim = ARENA_R - r;
    if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
  };

  // nearest obstruction along a ray; returns distance or Infinity
  world.rayBlock = (o, d, maxT) => {
    let best = Infinity;
    for (const c of world.circles) {
      const fx_ = o.x - c.x, fz = o.z - c.z;
      const a = d.x * d.x + d.z * d.z; if (a < 1e-8) continue;
      const b = 2 * (fx_ * d.x + fz * d.z), cc = fx_ * fx_ + fz * fz - c.r * c.r;
      const disc = b * b - 4 * a * cc; if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < best && t < maxT) { const y = o.y + d.y * t; if (y >= 0 && y <= c.h) best = t; }
    }
    for (const bx of world.boxes) {
      let t0 = 0, t1 = Math.min(maxT, best);
      const sl = (p, dd, lo, hi) => {
        if (Math.abs(dd) < 1e-8) return p >= lo && p <= hi;
        let a = (lo - p) / dd, b = (hi - p) / dd; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1;
      };
      if (sl(o.x, d.x, bx.x0, bx.x1) && sl(o.y, d.y, 0, bx.h) && sl(o.z, d.z, bx.z0, bx.z1) && t0 > 0 && t0 < best) best = t0;
    }
    // ground
    if (d.y < 0) { const t = -o.y / d.y; if (t > 0 && t < best && t < maxT) best = t; }
    return best;
  };

  return world;
}
