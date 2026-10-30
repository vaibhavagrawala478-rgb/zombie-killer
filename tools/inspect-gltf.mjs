// Prints a compact summary of .gltf files (read-only): node/mesh/skin counts, animations, textures, buffer embedding.
// Usage: node tools/inspect-gltf.mjs <file.gltf> [...]
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const uris = [...(j.buffers || []).map(b => b.uri), ...(j.images || []).map(i => i.uri)].filter(Boolean);
  const bbox = (j.accessors || []).filter((a, i) => (j.meshes || []).some(m => m.primitives.some(p => p.attributes.POSITION === i)));
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const a of bbox) if (a.min && a.max) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a.min[k]); max[k] = Math.max(max[k], a.max[k]); }
  console.log(`\n# ${f}`);
  console.log(' nodes', j.nodes?.length, 'meshes', j.meshes?.length, 'skins', j.skins?.length, 'materials', j.materials?.length, 'images', j.images?.length, 'anims', j.animations?.length);
  console.log(' embedded buffers:', (j.buffers || []).every(b => !b.uri || b.uri.startsWith('data:')), '| external uris:', uris.filter(u => !u.startsWith('data:')).join(', ') || 'none');
  console.log(' mesh names:', (j.meshes || []).map(m => m.name).join(', '));
  console.log(' root nodes (scene 0):', (j.scenes?.[0]?.nodes || []).map(n => j.nodes[n].name).join(', '));
  console.log(' position bounds min', min.map(v => +v.toFixed(2)), 'max', max.map(v => +v.toFixed(2)));
  if (j.animations) console.log(' animations:', j.animations.map(a => a.name).join(', '));
  if (j.skins) console.log(' joints:', j.skins.map(s => s.joints.length).join(','));
}
