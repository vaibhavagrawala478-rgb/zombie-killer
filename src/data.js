// Static game data: gems, weapons, zombies, perks.

export const GEMS = {
  ruby:     { name: 'Ruby',     color: 0xff2d55, css: '#ff2d55', base: 20 },
  emerald:  { name: 'Emerald',  color: 0x2cff8a, css: '#2cff8a', base: 50 },
  sapphire: { name: 'Sapphire', color: 0x2f86ff, css: '#4a9bff', base: 110 },
  amethyst: { name: 'Amethyst', color: 0xc15bff, css: '#c97bff', base: 250 },
  diamond:  { name: 'Diamond',  color: 0xb8f4ff, css: '#c8f7ff', base: 600 },
};
export const GEM_IDS = Object.keys(GEMS);

// dmg = per pellet. rate = shots / second. spread = radians (cone half-angle).
export const WEAPONS = [
  {
    id: 'pistol', name: 'Rusty .45', tag: 'SIDEARM', price: 0,
    desc: 'Dented, dependable, and free. Infinite ammo.',
    dmg: 32, pellets: 1, spread: 0.008, rate: 4.2, auto: false, mag: 12, reload: 1.0,
    packSize: 0, packCost: 0, maxReserve: Infinity, startReserve: Infinity,
    range: 140, pierce: 1, kick: 0.045, zoom: 1.3, upBase: 200,
  },
  {
    id: 'smg', name: 'Rattler SMG', tag: 'FULL AUTO', price: 450,
    desc: 'Hoses down walkers. Cheap to feed.',
    dmg: 18, pellets: 1, spread: 0.022, rate: 14, auto: true, mag: 32, reload: 1.5,
    packSize: 64, packCost: 40, maxReserve: 384, startReserve: 96,
    range: 90, pierce: 1, kick: 0.03, zoom: 1.3, upBase: 350, falloff: [30, 90],
  },
  {
    id: 'shotgun', name: 'Boomstick', tag: 'PUMP SHOTGUN', price: 1000,
    desc: 'Nine pellets of close-range regret.',
    dmg: 16, pellets: 9, spread: 0.065, rate: 1.35, auto: false, mag: 6, reload: 2.2,
    packSize: 12, packCost: 45, maxReserve: 72, startReserve: 18,
    range: 60, pierce: 1, kick: 0.1, zoom: 1.2, upBase: 600, falloff: [7, 32],
  },
  {
    id: 'ar', name: 'AK-Reaper', tag: 'ASSAULT RIFLE', price: 1900,
    desc: 'Hard-hitting, accurate, relentless.',
    dmg: 34, pellets: 1, spread: 0.014, rate: 9.5, auto: true, mag: 30, reload: 1.9,
    packSize: 60, packCost: 80, maxReserve: 360, startReserve: 90,
    range: 130, pierce: 1, kick: 0.04, zoom: 1.5, upBase: 900, falloff: [50, 130],
  },
  {
    id: 'sniper', name: 'Longshot', tag: 'SNIPER RIFLE', price: 3200,
    desc: 'One round punches through a whole line of dead.',
    dmg: 280, pellets: 1, spread: 0, rate: 1.05, auto: false, mag: 5, reload: 2.6,
    packSize: 10, packCost: 90, maxReserve: 60, startReserve: 15,
    range: 300, pierce: 4, kick: 0.12, zoom: 4.2, upBase: 1500, scope: true,
  },
  {
    id: 'rocket', name: 'Doomhammer', tag: 'ROCKET LAUNCHER', price: 6000,
    desc: 'Why shoot one zombie when you can shoot thirty?',
    dmg: 340, pellets: 1, spread: 0.004, rate: 0.9, auto: false, mag: 2, reload: 2.8,
    packSize: 4, packCost: 220, maxReserve: 24, startReserve: 6,
    range: 200, pierce: 1, kick: 0.16, zoom: 1.3, upBase: 2600, rocket: true, blast: 7.5,
  },
];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

// Zombie archetypes live in content/zombies.js (data-driven; one file per content kind).
export { ZTYPES } from './content/zombies.js';

// One-time & stackable perks sold at the Emporium.
export const PERKS = [
  { id: 'medkit', name: 'Medkit', desc: 'Restore 50 health.', cost: 100, consumable: true, icon: '✚' },
  { id: 'armor', name: 'Kevlar Vest', desc: 'Add 50 armor. Absorbs 60% of damage.', cost: 175, consumable: true, icon: '⛨' },
  { id: 'maxhp', name: 'Iron Constitution', desc: '+25 max health and heal 25.', cost: 600, max: 4, mult: 1.6, icon: '♥' },
  { id: 'boots', name: 'Marathon Boots', desc: '+8% move speed.', cost: 450, max: 3, mult: 1.8, icon: '➤' },
  { id: 'magnet', name: 'Gem Magnet', desc: 'Pull gems in from further away.', cost: 350, max: 3, mult: 1.7, icon: '◎' },
  { id: 'lucky', name: 'Lucky Charm', desc: 'More gems, better gems.', cost: 800, max: 3, mult: 1.9, icon: '☘' },
  { id: 'haggler', name: "Haggler's Tongue", desc: '+6% gem sell price.', cost: 1200, max: 3, mult: 2.0, icon: '$' },
];

export const ZEKE_QUOTES = {
  welcome: ["Well butter my biscuit, a customer!", "Gems in, guns out. That's the deal.", "Don't bleed on the counter."],
  buy: ["Pleasure doing business!", "She's a beaut. Don't get her wet.", "Sold! Go make some noise.", "Ka-ching, friend."],
  sell: ["Shiny! I'll take 'em.", "Now THAT'S a haul.", "Don't ask where I sell 'em.", "Cash on the barrelhead."],
  poor: ["Come back when you've got the coin.", "I ain't running a charity, friend.", "Bring me more gems."],
  full: ["Your ammo's already topped up.", "Can't carry any more of that."],
};
