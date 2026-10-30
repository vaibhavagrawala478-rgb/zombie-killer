// Shared mutable game state. One singleton keeps module wiring simple.
const DEFAULTS = { sens: 1, fov: 76, volume: 0.85, music: 0.55, bloom: true, numbers: true, quality: 'auto' };

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('zk_settings')) }; }
  catch (e) { return { ...DEFAULTS }; }
}

export const G = {
  state: 'menu', // menu | playing | shop | paused | dead
  time: 0,
  scene: null, camera: null, renderer: null,
  sound: null, fx: null, world: null, zombies: null, gems: null, player: null, ui: null,
  shake: 0,
  settings: loadSettings(),
  saveSettings() { try { localStorage.setItem('zk_settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ } },
  input: { keys: new Set(), mouseDown: false, rmb: false, dx: 0, dy: 0, pressed: new Set() },
};
