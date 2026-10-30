// Bootstrap: load assets with a progress bar, then start the game.
import { loadAssets } from './assets.js';

const fill = document.getElementById('boot-fill'), txt = document.getElementById('boot-txt'), boot = document.getElementById('boot');

function fatal(e) {
  console.error(e);
  let el = document.getElementById('fatal');
  if (!el) { el = document.createElement('div'); el.id = 'fatal'; document.body.appendChild(el); }
  el.style.display = 'flex';
  el.textContent = 'Zombie Killer failed to start.\n\n' + (e && e.message ? e.message : e) +
    '\n\nIf you opened index.html directly from disk, run start.cmd (or "npm start") instead - the game loads assets over http.';
}

loadAssets((p) => { fill.style.width = (p * 100).toFixed(0) + '%'; txt.textContent = `DIGGING UP ASSETS… ${(p * 100).toFixed(0)}%`; })
  .then(() => { txt.textContent = 'BUILDING THE GRAVEYARD…'; return new Promise(r => setTimeout(r, 30)); })
  .then(() => import('./game.js'))
  .then(() => { boot.classList.add('done'); setTimeout(() => boot.remove(), 700); })
  .catch(fatal);
