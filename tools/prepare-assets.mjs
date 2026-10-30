// Copies the runtime subset of assets-src/ into assets/ (served as-is by the game).
// Usage (project root): node tools/prepare-assets.mjs
// Later this is where gltf-transform optimisation (meshopt/webp) plugs in.
import { cpSync, mkdirSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets-src'), out = join(root, 'assets');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const zk = join(src, 'quaternius-zombie-apocalypse');
if (!existsSync(zk)) throw new Error('assets-src missing - run: node tools/fetch-assets.mjs');
for (const d of ['characters', 'weapons', 'environment', 'vehicles']) cpSync(join(zk, d), join(out, 'models', d), { recursive: true });
cpSync(join(zk, 'License.txt'), join(out, 'models', 'License.txt'));

const tex = join(src, 'polyhaven-textures');
for (const id of readdirSync(tex)) if (statSync(join(tex, id)).isDirectory()) cpSync(join(tex, id), join(out, 'tex', id), { recursive: true });
for (const f of readdirSync(join(src, 'polyhaven-hdris'))) if (f.endsWith('.hdr')) cpSync(join(src, 'polyhaven-hdris', f), join(out, 'env', f));

let bytes = 0;
const sum = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? sum(p) : (bytes += statSync(p).size); } };
sum(out);
console.log(`assets/ ready: ${(bytes / 1048576).toFixed(1)} MB`);
