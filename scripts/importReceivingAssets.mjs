import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Keep the supplied files verbatim; the generated module only adapts their demo entry points.
const source = resolve('public/assets/mal-kabul/source');
mkdirSync(source, { recursive: true });
if (process.argv[2]) for (const file of readdirSync(process.argv[2]).filter(f => f.endsWith('.js')))
  copyFileSync(resolve(process.argv[2], file), resolve(source, file));
const files = readdirSync(source).filter(f => f.endsWith('.js') && f !== 'mal-kabul-yerlesim.js').sort();
let code = '// @ts-nocheck\n// Generated from the supplied mal kabul factories. Run scripts/importReceivingAssets.mjs to regenerate.\nimport * as THREE from "three";\n';
for (const file of files) {
  let body = readFileSync(resolve(source, file), 'utf8');
  body = body.replace(/function demo\([\s\S]*$/, '');
  body = body.replace(/\n\(function \(\) \{[\s\S]*$/, '');
  body = body.replace(/^demo\(.*\);?\s*$/gm, '');
  body = body.replace(/Object\.assign\((new THREE\.Mesh\([^\n]+?), \{ position: new THREE\.Vector3\(([^)]+)\) \}\)/g, 'placed($1, $2)');
  body = body.replace(/function (create\w+)\(/g, 'export function $1(');
  body = body.replace('t.anisotropy = 4;', 't.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;');
  code += `\n// Source: ${file}\n${body}\n`;
}
code += '\nfunction placed(mesh, x, y, z) { mesh.position.set(x,y,z); return mesh; }\n';
writeFileSync('src/receivingAssets.ts', code);
console.log('Receiving factories imported:', files.length, 'source files');
