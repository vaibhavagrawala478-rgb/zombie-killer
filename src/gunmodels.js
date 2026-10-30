// Procedural gun models built from primitives. Barrel points toward -Z.
import * as THREE from 'three';

const mats = {};
function mat(key, color, metal = 0.6, rough = 0.4, glow = 0.12) {
  if (!mats[key]) {
    mats[key] = new THREE.MeshStandardMaterial({
      color, metalness: metal, roughness: rough, emissive: color, emissiveIntensity: glow,
    });
  }
  return mats[key];
}
const M = {
  steel: () => mat('steel', 0x3a3f47, 0.85, 0.32, 0.1),
  dark: () => mat('dark', 0x16181c, 0.5, 0.5, 0.1),
  worn: () => mat('worn', 0x6c6f75, 0.9, 0.38, 0.1),
  wood: () => mat('wood', 0x7a4a24, 0.1, 0.7, 0.2),
  olive: () => mat('olive', 0x4a5a38, 0.3, 0.6, 0.2),
  glove: () => mat('glove', 0x2b2420, 0.0, 0.9, 0.2),
  sleeve: () => mat('sleeve', 0x3b4a2f, 0.0, 0.95, 0.22),
  orange: () => new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 1.5, roughness: 0.4 }),
  lens: () => new THREE.MeshStandardMaterial({ color: 0x33aaff, emissive: 0x2299ff, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.5 }),
  red: () => new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 1.5 }),
};

function box(g, w, h, d, x, y, z, m, rx = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  g.add(mesh);
  return mesh;
}
function cyl(g, r1, r2, len, x, y, z, m, seg = 12) {
  const geo = new THREE.CylinderGeometry(r1, r2, len, seg);
  geo.rotateX(Math.PI / 2); // axis along Z; r1 at +Z? (top) -> top maps to -Z
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}
function limb(g, from, to, w, m) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a); const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, w, len), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  g.add(mesh);
}

const HANDS = {
  pistol:  { r: [0.0, -0.11, 0.03], l: [0.0, -0.1, 0.0] },
  smg:     { r: [0.0, -0.12, 0.06], l: [0.0, -0.06, -0.3] },
  shotgun: { r: [0.0, -0.1, 0.1],  l: [0.0, -0.05, -0.38] },
  ar:      { r: [0.0, -0.12, 0.1], l: [0.0, -0.05, -0.34] },
  sniper:  { r: [0.0, -0.11, 0.12], l: [0.0, -0.06, -0.3] },
  rocket:  { r: [0.0, -0.13, 0.05], l: [0.0, -0.13, -0.38] },
};

export function buildGun(id) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  let muzzleZ = -0.3, muzzleY = 0.02;

  switch (id) {
    case 'pistol':
      box(body, 0.055, 0.06, 0.27, 0, 0.03, -0.1, M.steel());
      box(body, 0.05, 0.04, 0.2, 0, -0.015, -0.06, M.dark());
      box(body, 0.05, 0.15, 0.07, 0, -0.09, 0.03, M.wood(), 0.25);
      box(body, 0.012, 0.016, 0.02, 0, 0.068, -0.22, M.worn());
      box(body, 0.03, 0.016, 0.02, 0, 0.068, 0.02, M.worn());
      cyl(body, 0.013, 0.013, 0.03, 0, 0.03, -0.245, M.dark());
      muzzleZ = -0.27; muzzleY = 0.03;
      break;
    case 'smg':
      box(body, 0.065, 0.09, 0.34, 0, 0.0, -0.1, M.dark());
      box(body, 0.055, 0.055, 0.16, 0, 0.0, -0.33, M.steel());
      cyl(body, 0.012, 0.012, 0.14, 0, 0.0, -0.46, M.steel());
      box(body, 0.045, 0.18, 0.06, 0, -0.13, -0.08, M.steel());
      box(body, 0.05, 0.12, 0.06, 0, -0.095, 0.07, M.dark(), 0.2);
      box(body, 0.02, 0.03, 0.22, 0, 0.0, 0.2, M.steel());
      box(body, 0.04, 0.02, 0.08, 0, 0.055, -0.1, M.worn());
      box(body, 0.012, 0.03, 0.012, 0, 0.065, -0.4, M.worn());
      muzzleZ = -0.55; muzzleY = 0.0;
      break;
    case 'shotgun':
      cyl(body, 0.022, 0.022, 0.78, 0, 0.02, -0.42, M.steel());
      cyl(body, 0.019, 0.019, 0.55, 0, -0.025, -0.34, M.worn());
      box(body, 0.065, 0.055, 0.2, 0, -0.03, -0.4, M.wood());
      box(body, 0.062, 0.09, 0.26, 0, 0.0, -0.02, M.dark());
      box(body, 0.05, 0.1, 0.32, 0, -0.025, 0.3, M.wood(), -0.08);
      box(body, 0.045, 0.1, 0.06, 0, -0.085, 0.05, M.wood(), 0.2);
      box(body, 0.01, 0.025, 0.01, 0, 0.05, -0.8, M.worn());
      muzzleZ = -0.82; muzzleY = 0.02;
      break;
    case 'ar':
      box(body, 0.065, 0.1, 0.4, 0, 0.0, -0.02, M.dark());
      box(body, 0.06, 0.07, 0.3, 0, -0.005, -0.37, M.olive());
      cyl(body, 0.012, 0.012, 0.26, 0, 0.012, -0.6, M.steel());
      cyl(body, 0.02, 0.02, 0.06, 0, 0.012, -0.74, M.dark());
      box(body, 0.045, 0.2, 0.075, 0, -0.15, -0.1, M.steel(), 0.28);
      box(body, 0.045, 0.11, 0.055, 0, -0.095, 0.1, M.dark(), 0.2);
      box(body, 0.05, 0.12, 0.26, 0, -0.01, 0.29, M.olive(), -0.06);
      box(body, 0.012, 0.045, 0.012, 0, 0.065, -0.62, M.worn());
      box(body, 0.03, 0.03, 0.04, 0, 0.065, 0.1, M.worn());
      muzzleZ = -0.78; muzzleY = 0.012;
      break;
    case 'sniper':
      box(body, 0.06, 0.09, 0.42, 0, 0.0, -0.04, M.dark());
      cyl(body, 0.014, 0.014, 1.0, 0, 0.01, -0.7, M.steel());
      cyl(body, 0.022, 0.022, 0.12, 0, 0.01, -1.15, M.dark());
      box(body, 0.055, 0.13, 0.42, 0, -0.02, 0.34, M.olive(), -0.08);
      box(body, 0.045, 0.11, 0.055, 0, -0.095, 0.1, M.dark(), 0.2);
      cyl(body, 0.034, 0.034, 0.34, 0, 0.115, -0.05, M.dark());
      cyl(body, 0.045, 0.045, 0.04, 0, 0.115, -0.24, M.dark());
      cyl(body, 0.043, 0.043, 0.04, 0, 0.115, 0.14, M.dark());
      box(body, 0.022, 0.05, 0.03, 0, 0.075, -0.12, M.worn());
      box(body, 0.022, 0.05, 0.03, 0, 0.075, 0.04, M.worn());
      cyl(body, 0.036, 0.036, 0.01, 0, 0.115, -0.265, M.lens());
      box(body, 0.04, 0.012, 0.012, 0.045, 0.02, 0.08, M.steel());
      muzzleZ = -1.22; muzzleY = 0.01;
      break;
    case 'rocket':
      cyl(body, 0.075, 0.075, 0.95, 0, 0.0, -0.3, M.olive(), 16);
      cyl(body, 0.095, 0.075, 0.14, 0, 0.0, -0.84, M.dark(), 16);
      cyl(body, 0.075, 0.1, 0.14, 0, 0.0, 0.22, M.dark(), 16);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 12).rotateX(-Math.PI / 2), M.orange());
      tip.position.set(0, 0, -0.85); body.add(tip);
      box(body, 0.04, 0.05, 0.16, 0, 0.1, -0.2, M.steel());
      box(body, 0.012, 0.05, 0.012, 0, 0.14, -0.26, M.red());
      box(body, 0.05, 0.14, 0.07, 0, -0.1, 0.0, M.dark(), 0.15);
      box(body, 0.05, 0.14, 0.07, 0, -0.1, -0.38, M.dark(), -0.1);
      box(body, 0.09, 0.16, 0.06, 0, 0.0, 0.3, M.dark());
      muzzleZ = -0.95; muzzleY = 0.0;
      break;
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ);
  g.add(muzzle);

  const hands = new THREE.Group();
  const h = HANDS[id];
  const gl = M.glove(), sl = M.sleeve();
  const rh = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.1), gl); rh.position.set(...h.r); hands.add(rh);
  const lh = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.1), gl); lh.position.set(...h.l); hands.add(lh);
  limb(hands, [h.r[0] + 0.01, h.r[1] - 0.01, h.r[2] + 0.04], [h.r[0] + 0.14, h.r[1] - 0.2, h.r[2] + 0.6], 0.1, sl);
  limb(hands, [h.l[0] - 0.01, h.l[1] - 0.01, h.l[2] + 0.04], [h.l[0] - 0.22, h.l[1] - 0.22, h.l[2] + 0.62], 0.1, sl);
  g.add(hands);

  g.userData = { muzzle, hands, body, id };
  return g;
}

// Render each gun to a PNG for UI icons.
export function renderIcons(ids) {
  const W = 360, H = 180;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H, false);
  r.setPixelRatio(1);
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x302820, 1.6));
  const key = new THREE.DirectionalLight(0xfff0d8, 3.0); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x66aaff, 2.0); rim.position.set(3, 1, -3); scene.add(rim);
  const cam = new THREE.OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 20);
  const out = {};
  for (const id of ids) {
    const gun = buildGun(id);
    gun.userData.hands.visible = false;
    gun.rotation.y = 0.22; // side-on view (camera on +X sees the barrel pointing right) with a slight 3/4 turn
    gun.rotation.x = 0.06;
    scene.add(gun);
    gun.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(gun);
    const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const width = Math.max(s.z * 1.08, s.y * 2.4);
    cam.left = -width / 2; cam.right = width / 2; cam.top = width / 4; cam.bottom = -width / 4;
    cam.position.set(c.x + 6, c.y + 0.4, c.z + 0.0);
    cam.lookAt(c.x, c.y, c.z);
    cam.updateProjectionMatrix();
    r.render(scene, cam);
    out[id] = r.domElement.toDataURL('image/png');
    scene.remove(gun);
  }
  r.dispose();
  return out;
}
