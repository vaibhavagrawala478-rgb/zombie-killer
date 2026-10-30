// Runtime asset loading: glTF models, Poly Haven PBR texture sets, HDRI sky.
// Everything is fetched from ./assets/ (see tools/prepare-assets.mjs). Credits live in tools/assets.manifest.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const A = { models: {}, tex: {}, sky: null, moonDir: null };

const M = 'assets/models/';
const MODEL_FILES = {
  z_basic: 'characters/Zombie_Basic', z_arm: 'characters/Zombie_Arm', z_chubby: 'characters/Zombie_Chubby', z_rib: 'characters/Zombie_Ribcage',
  dog: 'characters/Characters_GermanShepherd',
  w_pistol: 'weapons/Pistol', w_rifle: 'weapons/Rifle', w_shotgun: 'weapons/Shotgun', w_smg: 'weapons/SMG',
  barrel: 'environment/Barrel', chest: 'environment/Chest', cinder: 'environment/CinderBlock', cont_g: 'environment/Container_Green', cont_r: 'environment/Container_Red',
  hydrant: 'environment/FireHydrant', pallet: 'environment/Pallet', pallet_b: 'environment/Pallet_Broken', pipes: 'environment/Pipes', barrier: 'environment/PlasticBarrier',
  streetlights: 'environment/StreetLights', tbar1: 'environment/TrafficBarrier_1', tbar2: 'environment/TrafficBarrier_2', cone1: 'environment/TrafficCone_1', cone2: 'environment/TrafficCone_2',
  trash1: 'environment/TrashBag_1', trash2: 'environment/TrashBag_2', tower: 'environment/WaterTower', wheels: 'environment/Wheels_Stack', sign: 'environment/TownSign', couch: 'environment/Couch',
  blood1: 'environment/Blood_1', blood2: 'environment/Blood_2', blood3: 'environment/Blood_3',
  car_pickup: 'vehicles/Vehicle_Pickup', car_sports: 'vehicles/Vehicle_Sports', car_truck: 'vehicles/Vehicle_Truck',
};
// id -> which maps to load (every map costs ~5 MB of VRAM at 1k, so only what earns its keep)
const TEX_SETS = {
  mud: ['brown_mud_leaves_01', ['diff', 'nor_gl', 'rough']],
  gravel: ['bicolour_gravel', ['diff', 'nor_gl']],
  planks: ['brown_planks_03', ['diff', 'nor_gl', 'rough']],
  metal: ['box_profile_metal_sheet', ['diff', 'nor_gl']],
  rock: ['aerial_rocks_02', ['diff', 'nor_gl']],
};
const SKY = 'assets/env/moonlit_golf_1k.hdr';

export async function loadAssets(onProgress = () => {}) {
  const gl = new GLTFLoader(), tl = new THREE.TextureLoader();
  const jobs = [];
  let done = 0;
  const track = (p) => p.then((r) => { onProgress(++done / jobs.length); return r; });

  for (const [key, file] of Object.entries(MODEL_FILES)) jobs.push(track(gl.loadAsync(`${M}${file}.gltf`).then(g => { A.models[key] = g; })));
  for (const [key, [id, maps]] of Object.entries(TEX_SETS)) {
    A.tex[key] = {};
    for (const m of maps) jobs.push(track(tl.loadAsync(`assets/tex/${id}/${id}_${m}_1k.jpg`).then(t => { A.tex[key][m] = t; })));
  }
  jobs.push(track(new HDRLoader().loadAsync(SKY).then(t => { A.sky = t; })));
  // jobs.length is only final after the loops above, so progress is computed lazily via closure
  await Promise.all(jobs);
  A.moonDir = findBrightest(A.sky);
}

// Direction (unit vector) of the brightest texel in an equirectangular HDR = the moon.
function findBrightest(tex) {
  const { data, width, height } = tex.image;
  const half = data instanceof Uint16Array;
  const h2f = (v) => THREE.DataUtils.fromHalfFloat(v);
  let best = -1, bi = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const l = half ? h2f(data[o]) + h2f(data[o + 1]) + h2f(data[o + 2]) : data[o] + data[o + 1] + data[o + 2];
    if (l > best) { best = l; bi = i; }
  }
  const x = bi % width, y = Math.floor(bi / width);
  // three's equirect lookup: u = atan2(dir.z, dir.x)/(2pi) + .5 ; v = asin(dir.y)/pi + .5 (v measured from the bottom of the image)
  const u = (x + 0.5) / width, v = 1 - (y + 0.5) / height;
  const phi = (u - 0.5) * Math.PI * 2, el = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el)).normalize();
}

// Fresh skinned clone of a loaded character (shares geometry, textures and clips).
export function cloneCharacter(key) {
  const g = A.models[key];
  return { scene: cloneSkinned(g.scene), clips: g.animations };
}

// Static prop clone (fresh scene graph; geometry/materials shared).
export function cloneProp(key) { return A.models[key].scene.clone(true); }

// Tiling PBR material from a loaded texture set.
export function pbr(set, repeatX = 1, repeatY = 1, o = {}) {
  const t = A.tex[set];
  const prep = (src, srgb) => {
    if (!src) return null;
    const c = src.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(repeatX, repeatY);
    c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    c.anisotropy = 8; c.needsUpdate = true;
    return c;
  };
  return new THREE.MeshStandardMaterial({
    map: prep(t.diff, true), normalMap: prep(t.nor_gl, false), roughnessMap: prep(t.rough, false),
    normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    color: o.color ?? 0xffffff, roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
    side: o.side ?? THREE.FrontSide,
  });
}
