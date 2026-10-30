// Inline game.js into index.html -> one self-contained file you can email or host anywhere.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const js = readFileSync('game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const out = html.replace('<script src="game.js"></script>', () => `<script>${js}</script>`);
if (out === html) throw new Error('script tag not found');
writeFileSync('zombie-killer.html', out);
console.log('zombie-killer.html', (statSync('zombie-killer.html').size / 1024).toFixed(0) + ' KB');
