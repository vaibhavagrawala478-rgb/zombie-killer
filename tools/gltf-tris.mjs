// Triangle / vertex count per mesh of a .gltf (read-only). Usage: node tools/gltf-tris.mjs <file.gltf> [...]
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  let tris = 0, verts = 0; const per = [];
  for (const m of j.meshes) for (const p of m.primitives) {
    const t = p.indices !== undefined ? j.accessors[p.indices].count / 3 : j.accessors[p.attributes.POSITION].count / 3;
    const v = j.accessors[p.attributes.POSITION].count; tris += t; verts += v; per.push(`${m.name}:${t}`);
  }
  console.log(f.split(/[\\/]/).pop(), '| tris', tris, '| verts', verts, '|', per.join(' '));
}
