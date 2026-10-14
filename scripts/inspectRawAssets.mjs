import fs from 'node:fs';
import * as THREE from 'three';
const folder=process.argv[2]??'public/assets/ham-kumas-depo';
for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.glb'))){
 const buffer=fs.readFileSync(`${folder}/${file}`),g=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
 const bounds=new THREE.Box3();
 const visit=(i,parent=new THREE.Matrix4())=>{const n=g.nodes[i],m=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));m.premultiply(parent);for(const p of g.meshes?.[n.mesh]?.primitives??[]){const a=g.accessors[p.attributes.POSITION];if(a.min&&a.max)bounds.union(new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)).applyMatrix4(m));}for(const c of n.children??[])visit(c,m);};
 for(const n of g.scenes[g.scene??0].nodes)visit(n);
 console.log(JSON.stringify({file,size:bounds.getSize(new THREE.Vector3()).toArray().map(n=>+n.toFixed(2)),min:bounds.min.toArray().map(n=>+n.toFixed(2)),nodes:g.nodes.length,names:g.nodes.map(n=>n.name).filter(Boolean).slice(0,14),images:g.images?.length??0}));
}
