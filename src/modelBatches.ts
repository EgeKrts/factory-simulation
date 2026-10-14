import * as THREE from 'three';

/** Share repeated imported geometry across machines while keeping original meshes for exact picking. */
export class ModelBatches {
 readonly group=new THREE.Group();
 private batches:{mesh:THREE.InstancedMesh;sources:THREE.Mesh[]}[]=[];
 rebuild(models:THREE.Object3D[]) {
  this.reset();
  const groups=new Map<string,THREE.Mesh[]>();
  for(const root of models)root.traverse(o=>{
   if(!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || !o.userData.sharedAsset || o.userData.motion || Array.isArray(o.material))return;
   const key=`${o.geometry.uuid}:${o.material.uuid}`;
   if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(o);
  });
  for(const sources of groups.values()) {
   if(sources.length<2)continue;
   const mesh=new THREE.InstancedMesh(sources[0].geometry,sources[0].material,sources.length);
   mesh.castShadow=sources.some(s=>s.castShadow);mesh.receiveShadow=true;mesh.frustumCulled=false;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   for(const source of sources){source.userData.renderBatched=true;source.visible=false;}
   this.group.add(mesh);this.batches.push({mesh,sources});
  }
  this.sync();
 }
 sync() {
  for(const {mesh,sources} of this.batches) {
   let count=0;
   for(const source of sources) {
    let visible=true;
    for(let parent=source.parent;parent;parent=parent.parent)if(!parent.visible){visible=false;break;}
    if(!visible)continue;
    source.updateWorldMatrix(true,false);mesh.setMatrixAt(count++,source.matrixWorld);
   }
   mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;
  }
 }
 reset() {
  for(const {mesh,sources} of this.batches){for(const source of sources){source.visible=true;delete source.userData.renderBatched;}mesh.dispose();}
  this.batches=[];this.group.clear();
 }
}
