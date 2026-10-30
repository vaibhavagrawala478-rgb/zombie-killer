// Zombie archetypes (data only; behaviour lives in zombies.js keyed by `ai`).
//   model   : key into assets.js MODEL_FILES            height : standing height in metres (model is scaled to fit)
//   tint    : multiplied into the shared atlas texture   emissive: constant glow colour (0 = none)
//   anim    : clip names (see inspect-gltf output)       hit    : [yFrac, forwardFrac, radiusFrac, isHead] x height (or metres if hitAbs)
//   headMul : damage multiplier on head hits             frontMul/backMul: body-hit multipliers by facing
//   tip     : one-line counterplay shown the first time the type appears
const HUMAN_HIT = [[0.93, 0.03, 0.13, true], [0.72, 0, 0.2], [0.5, 0, 0.18], [0.24, 0, 0.17]];

const A_BASIC = { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact' };

export const MODEL_HEIGHT = { z_basic: 1.36, z_arm: 1.57, z_chubby: 1.64, z_rib: 1.06, dog: 0.95 };

export const ZTYPES = {
  walker: {
    name: 'Walker', ai: 'melee', model: 'z_basic', height: 1.75, tint: 0xd9e6c8, emissive: 0, anim: A_BASIC, move: 'walk',
    hp: 80, speed: 2.0, dmg: 11, reward: 10, radius: 0.42, hit: HUMAN_HIT, radar: '#ff3b4e',
    gemChance: 0.42, gems: [['ruby', 70], ['emerald', 24], ['sapphire', 6]], gemCount: [1, 1],
    tip: 'The basic horde. Many, slow, and persistent.',
  },
  runner: {
    name: 'Runner', ai: 'melee', model: 'z_basic', height: 1.7, tint: 0xc9d4ff, emissive: 0, anim: A_BASIC, move: 'run',
    hp: 50, speed: 5.4, dmg: 8, reward: 16, radius: 0.38, hit: HUMAN_HIT, radar: '#ff7a3b', attackCd: 0.7,
    gemChance: 0.48, gems: [['ruby', 45], ['emerald', 38], ['sapphire', 14], ['amethyst', 3]], gemCount: [1, 1],
    tip: 'Fast and fragile. They flank — keep your back covered.',
  },
  crawler: {
    name: 'Crawler', ai: 'melee', model: 'z_basic', modelAlt: 'z_rib', height: 1.75, tint: 0xb9a58f, emissive: 0, anim: { ...A_BASIC, walk: 'Crawl', run: 'Crawl', attack: 'Punch' }, move: 'run',
    hp: 45, speed: 4.0, dmg: 9, reward: 16, radius: 0.34, hitAbs: true, radar: '#ffb03b', attackCd: 0.8,
    hit: [[0.55, 0.35, 0.2, true], [0.42, 0.05, 0.27], [0.3, -0.35, 0.24]],
    gemChance: 0.5, gems: [['ruby', 45], ['emerald', 38], ['sapphire', 14], ['amethyst', 3]], gemCount: [1, 1],
    tip: 'Hugs the ground. Aim low — they\'re tiny targets.',
  },
  bloater: {
    name: 'Bloater', ai: 'melee', model: 'z_chubby', height: 2.0, tint: 0xb5d85a, emissive: 0x1e3a00, anim: A_BASIC, move: 'walk',
    hp: 170, speed: 1.6, dmg: 14, reward: 28, radius: 0.7, wide: 1.4, hit: HUMAN_HIT, radar: '#b6ff3a', explode: true,
    gemChance: 0.85, gems: [['emerald', 38], ['sapphire', 40], ['amethyst', 19], ['diamond', 3]], gemCount: [1, 2],
    tip: 'Bursts into toxic gas. Pop it while it\'s inside the crowd.',
  },
  brute: {
    name: 'Brute', ai: 'brute', model: 'z_arm', height: 2.3, tint: 0xd89a8a, emissive: 0, anim: A_BASIC, move: 'walk',
    hp: 520, speed: 2.0, dmg: 32, reward: 70, radius: 0.8, hit: HUMAN_HIT, radar: '#ff7a2a', headMul: 0.7, frontMul: 0.55, backMul: 1.3,
    gemChance: 1, gems: [['emerald', 20], ['sapphire', 42], ['amethyst', 30], ['diamond', 8]], gemCount: [2, 3],
    tip: 'Armoured front and head, and it CHARGES. Shoot its back, or sidestep.',
  },
  spitter: {
    name: 'Spitter', ai: 'spitter', model: 'z_basic', height: 1.75, tint: 0x9be07a, emissive: 0x0f4a08, anim: A_BASIC, move: 'walk',
    hp: 70, speed: 1.9, dmg: 14, reward: 24, radius: 0.4, hit: HUMAN_HIT, radar: '#7fff3a', attackCd: 2.6,
    gemChance: 0.7, gems: [['emerald', 40], ['sapphire', 40], ['amethyst', 18], ['diamond', 2]], gemCount: [1, 1],
    tip: 'Lobs acid from range. Keep moving — the puddles hurt.',
  },
  screamer: {
    name: 'Screamer', ai: 'screamer', model: 'z_basic', height: 1.65, tint: 0xe2c9ff, emissive: 0x3a1666, anim: A_BASIC, move: 'walk',
    hp: 55, speed: 2.4, dmg: 8, reward: 40, radius: 0.38, hit: HUMAN_HIT, radar: '#d45bff',
    gemChance: 0.9, gems: [['sapphire', 45], ['amethyst', 45], ['diamond', 10]], gemCount: [1, 2],
    tip: 'Screams to buff the horde and call reinforcements. Kill it first.',
  },
  leaper: {
    name: 'Leaper', ai: 'leaper', model: 'z_basic', height: 1.7, tint: 0xffb48a, emissive: 0x4a1a00, anim: A_BASIC, move: 'run',
    hp: 60, speed: 3.4, dmg: 18, reward: 26, radius: 0.38, hit: HUMAN_HIT, radar: '#ff9a3b',
    gemChance: 0.65, gems: [['ruby', 30], ['emerald', 35], ['sapphire', 28], ['amethyst', 7]], gemCount: [1, 1],
    tip: 'Crouches, then pounces. Strafe when it squats.',
  },
  riot: {
    name: 'Riot Zombie', ai: 'melee', model: 'z_basic', height: 1.95, tint: 0x9aa8d0, emissive: 0, anim: A_BASIC, move: 'walk', shield: true,
    hp: 260, speed: 1.9, dmg: 18, reward: 45, radius: 0.55, hit: HUMAN_HIT, radar: '#4a9bff', frontMul: 0.12,
    gemChance: 0.9, gems: [['sapphire', 50], ['amethyst', 35], ['diamond', 15]], gemCount: [1, 2],
    tip: 'Riot shield blocks the front. Aim for the head, flank it, or use explosives.',
  },
  hazmat: {
    name: 'Hazmat', ai: 'melee', model: 'z_basic', height: 1.85, tint: 0xf2dd48, emissive: 0x2a2400, anim: A_BASIC, move: 'walk', trail: true, mask: true,
    hp: 230, speed: 2.1, dmg: 16, reward: 55, radius: 0.5, hit: HUMAN_HIT, radar: '#ffe23b', headMul: 1.6,
    gemChance: 1, gems: [['sapphire', 35], ['amethyst', 45], ['diamond', 20]], gemCount: [1, 2],
    tip: 'Leaves a toxic trail. Don\'t fight on its footprints.',
  },
  hound: {
    name: 'Hellhound', ai: 'melee', model: 'dog', height: 1.0, tint: 0x8a6a5a, emissive: 0x3a0800, anim: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Attack', death: 'Death', hit: 'HitReact_Left' }, move: 'run',
    hp: 55, speed: 6.2, dmg: 10, reward: 18, radius: 0.4, hitAbs: true, radar: '#ff5a2a', attackCd: 0.65,
    hit: [[0.78, 0.5, 0.2, true], [0.62, 0.1, 0.27], [0.5, -0.35, 0.25]],
    gemChance: 0.5, gems: [['ruby', 40], ['emerald', 40], ['sapphire', 17], ['amethyst', 3]], gemCount: [1, 1],
    tip: 'Fast and low. They arrive before the horde does.',
  },
  boss: {
    name: 'The Gravelord', ai: 'boss', model: 'z_chubby', height: 4.4, tint: 0x9a6cc8, emissive: 0x2a0a50, anim: A_BASIC, move: 'walk', horns: true, boss: true,
    hp: 3400, speed: 2.7, dmg: 42, reward: 600, radius: 1.4, hit: HUMAN_HIT, radar: '#d45bff', headMul: 1.5,
    gemChance: 1, gems: [['sapphire', 30], ['amethyst', 45], ['diamond', 25]], gemCount: [9, 12], guaranteed: ['diamond', 'diamond'],
    tip: 'A boss. Slams the ground — jump to avoid the shockwave.',
  },
};

// Wave director weights: the first wave a type may appear, and how common it is relative to a walker.
export const SPAWN_TABLE = [
  ['walker', 1, 10], ['runner', 2, 3], ['crawler', 3, 3], ['hound', 3, 2], ['bloater', 4, 2], ['leaper', 4, 2.4],
  ['spitter', 5, 2.4], ['riot', 6, 2], ['screamer', 6, 1.2], ['brute', 7, 1.6], ['hazmat', 8, 1.6],
];
