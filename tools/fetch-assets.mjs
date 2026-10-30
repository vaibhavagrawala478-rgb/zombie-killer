// Downloads every asset listed in tools/assets.manifest.json into assets-src/<pack>/.
// Usage (from the project root):  node tools/fetch-assets.mjs [packId ...]
// Idempotent: existing files are skipped. Downloaded files are untrusted data -
// they are only ever read by optimize-assets.mjs / the game, never executed.
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'tools', 'assets.manifest.json'), 'utf8'));
const only = new Set(process.argv.slice(2));
const UA = { 'User-Agent': 'Mozilla/5.0 (zombie-killer asset fetch)' };

const exists = (p) => access(p).then(() => true, () => false);
function safeJoin(base, rel) {
  const full = resolve(base, rel);
  if (!full.startsWith(base + sep)) throw new Error('path escapes pack dir: ' + rel);
  return full;
}
async function get(url, asText = false) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return asText ? r.text() : Buffer.from(await r.arrayBuffer());
}
async function save(dest, buf) { await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, buf); }

let ok = 0, skipped = 0; const failed = [];
for (const pack of manifest.packs) {
  if (only.size && !only.has(pack.id)) continue;
  const base = join(root, 'assets-src', pack.id);
  await mkdir(base, { recursive: true });
  console.log(`\n== ${pack.id}`);

  const jobs = []; // {dest, url}
  if (pack.source === 'gdrive') {
    for (const f of pack.files) jobs.push({ dest: safeJoin(base, f.path), url: `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t` });
  } else if (pack.source === 'polyhaven') {
    for (const id of pack.items) {
      try {
        const files = JSON.parse(await get(`https://api.polyhaven.com/files/${id}`, true));
        if (pack.kind === 'texture') {
          for (const m of pack.maps) {
            const key = { diff: 'Diffuse', nor_gl: 'nor_gl', rough: 'Rough', ao: 'AO', arm: 'arm', disp: 'Displacement' }[m];
            const u = files[key]?.[pack.resolution]?.jpg?.url;
            if (u) jobs.push({ dest: safeJoin(base, `${id}/${id}_${m}_${pack.resolution}.jpg`), url: u });
            else console.log(`   (no ${m} map for ${id})`);
          }
        } else {
          const u = files.hdri?.[pack.resolution]?.hdr?.url;
          if (u) jobs.push({ dest: safeJoin(base, `${id}_${pack.resolution}.hdr`), url: u });
          else console.log(`   (no hdr for ${id})`);
        }
      } catch (e) { failed.push(`${id}: ${e.message}`); console.log('   FAIL', id, e.message); }
    }
  }

  for (const j of jobs) {
    if (await exists(j.dest)) { skipped++; continue; }
    const name = j.dest.slice(base.length + 1);
    let lastErr;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const buf = await get(j.url);
        // Drive returns an HTML interstitial when rate-limited: never save that as an asset.
        if (buf.length < 400000 && buf.subarray(0, 15).toString().toLowerCase().includes('<!doctype')) throw new Error('got HTML instead of file');
        await save(j.dest, buf); ok++; lastErr = null;
        console.log('   ok  ', name, (buf.length / 1024).toFixed(0) + ' KB');
        break;
      } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 2500 * attempt)); }
    }
    if (lastErr) { failed.push(`${name}: ${lastErr.message}`); console.log('   FAIL', name, lastErr.message); }
  }
}
console.log(`\ndone: ${ok} downloaded, ${skipped} already present, ${failed.length} failed`);
if (failed.length) { console.log(failed.join('\n')); process.exitCode = 1; }
