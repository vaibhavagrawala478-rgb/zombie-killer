// Builds the shippable folder dist/ = index.html + minified game.js + ONLY the assets src/assets.js actually loads.
// Usage (project root): npm run dist      (then zip dist/ or drag the folder into Netlify Drop)
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (c) => execSync(c, { cwd: root, stdio: 'inherit' });

run('node tools/prepare-assets.mjs');
run('npx esbuild src/main.js --bundle --format=iife --outfile=game.js --minify --target=es2020');

const src = readFileSync(join(root, 'src', 'assets.js'), 'utf8');
const models = [...src.matchAll(/'((?:characters|weapons|environment|vehicles)\/[A-Za-z0-9_]+)'/g)].map(m => m[1]);
const texSets = [...src.matchAll(/\['([a-z0-9_]+)', \[([^\]]+)\]\]/g)].map(m => ({ id: m[1], maps: [...m[2].matchAll(/'([a-z_]+)'/g)].map(x => x[1]) }));
const sky = src.match(/assets\/env\/([A-Za-z0-9_]+\.hdr)/)[1];

const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'game.js'), join(dist, 'game.js'));
const a = join(root, 'assets');
const copy = (rel) => { if (!existsSync(join(a, rel))) throw new Error('missing asset ' + rel); cpSync(join(a, rel), join(dist, 'assets', rel)); };
for (const m of models) copy(`models/${m}.gltf`);
copy('models/License.txt');
for (const t of texSets) for (const map of t.maps) copy(`tex/${t.id}/${t.id}_${map}_1k.jpg`);
copy(`env/${sky}`);

let bytes = 0;
const sum = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? sum(p) : (bytes += statSync(p).size); } };
sum(dist);
console.log(`\ndist/ ready: ${(bytes / 1048576).toFixed(1)} MB  (${models.length} models, ${texSets.reduce((n, t) => n + t.maps.length, 0)} textures, 1 HDRI)`);
if (bytes > 30 * 1048576) console.warn('WARNING: over the 30 MB first-load budget - run the asset optimiser');
