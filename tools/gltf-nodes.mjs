// Prints the node hierarchy of a .gltf (read-only). Usage: node tools/gltf-nodes.mjs <file.gltf>
import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const walk = (i, d) => { const n = j.nodes[i]; console.log('  '.repeat(d) + n.name + (n.mesh !== undefined ? ` [mesh ${j.meshes[n.mesh].name}]` : '') + (n.scale ? ' scale=' + n.scale.map(v => +v.toFixed(2)) : '')); (n.children || []).forEach(c => walk(c, d + 1)); };
(j.scenes[0].nodes).forEach(i => walk(i, 0));
console.log('materials:', JSON.stringify(j.materials));
