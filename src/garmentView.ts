import * as THREE from 'three';
import type { MachineDef } from './types';
import { fitAsset } from './assets';
import { instanceGroup } from './environment';

const cube = new THREE.BoxGeometry(1,1,1), headGeometry = new THREE.SphereGeometry(.14,10,8);
const metal = new THREE.MeshStandardMaterial({color:'#bbc5cb',metalness:.65,roughness:.4});
const blue = new THREE.MeshStandardMaterial({color:'#176cb7',roughness:.8});
const skin = new THREE.MeshStandardMaterial({color:'#cda17f',roughness:.9});
const dark = new THREE.MeshStandardMaterial({color:'#263744',roughness:.8});
const fabric = new THREE.MeshStandardMaterial({color:'#ece7de',roughness:.95});
const cardboard = new THREE.MeshStandardMaterial({color:'#b99157',roughness:.95});
function box(g: THREE.Group, size: number[], p: number[], material: THREE.Material) {
 const m=new THREE.Mesh(cube,material);m.scale.set(size[0],size[1],size[2]);m.position.set(p[0],p[1],p[2]);m.castShadow=true;g.add(m);return m;
}
function operator(g: THREE.Group,x:number,z:number,seated:boolean,side=1) {
 const person=new THREE.Group();person.position.set(x,0,z); person.rotation.y=side<0?Math.PI:0;g.add(person);
 const y=seated?.98:1.2;
 box(person,[.35,.48,.28],[0,y,0],blue);
 const head=new THREE.Mesh(headGeometry,skin);head.position.set(0,y+.4,0);person.add(head);
 for(const s of [-1,1]) {
  box(person,[.14,seated?.38:.75,.14],[s*.12,seated?.4:.43,seated?-.22:0],dark);
  const arm=box(person,[.12,.12,.43],[s*.23,y-.05,-.23],skin);arm.userData.garmentMotion='hand';arm.userData.baseY=arm.position.y;arm.userData.phase=x+s;
 }
}
/** Activity belongs to the station and is driven by its simulation state, not a decorative clock. */
export function dressGarmentModel(model: THREE.Object3D,d:MachineDef): THREE.Object3D {
 if(d.area!=='garment' && !(d.area==='warehouse' && ['pack','pallet'].includes(d.type))) return model;
 const activity=new THREE.Group();activity.name='garmentActivity';model.add(activity);
 if(d.type==='sew') {
  // Two opposing rows, six stations per imported module. Seats are in the provided GLB.
  for(const offset of [-4.5,4.5]) for(let i=0;i<6;i++) for(const side of [-1,1]) {
   const x=offset+(-3.625+i*1.45)*.96;
   operator(activity,x,side*1.3*.96,true,side);
   const needle=box(activity,[.024,.12,.024],[x,.9,side*.5],metal);needle.userData.garmentMotion='needle';needle.userData.baseY=.9;
   box(activity,[.3,.025,.22],[x,.79,side*.55],fabric);
  }
 }
 if(d.type==='hanger' || d.type==='sew') {
  // A supported closed rail loop; garments and hooks always move together below it.
  const railY=3.5;
  for(const side of [-1,1]) box(activity,[18,.06,.06],[0,railY,side*.62],metal);
  for(const x of [-9,9]) box(activity,[.06,.06,1.3],[x,railY,0],metal);
  if(d.type==='sew')for(const x of [-8.7,8.7])for(const side of [-1,1])box(activity,[.08,railY,.08],[x,railY/2,side*.62],metal);
  for(let i=0;i<(d.type==='hanger'?16:8);i++) {
   const load=new THREE.Group();load.userData.garmentMotion='hanger';load.userData.phase=i/(d.type==='hanger'?16:8);
   box(load,[.025,.3,.025],[0,-.15,0],metal);
   const hanger=box(load,[.55,.03,.025],[0,-.3,0],metal);hanger.rotation.z=.06;
   box(load,[.55,.75,.09],[0,-.7,0],i%2?blue:fabric);
   for(const s of [-1,1]) {const sleeve=box(load,[.18,.35,.09],[s*.33,-.49,0],i%2?blue:fabric);sleeve.rotation.z=s*.45;}
   load.position.y=railY;activity.add(load);
  }
 } else {
  operator(activity,0,d.type==='spread'||d.type==='cut'?1.15:1.2,false);
  if(d.type==='cut'||d.type==='spread') {
   const head=box(activity,[.28,.2,2.1],[0,1.16,0],blue);head.userData.garmentMotion='cut';
  }
  if(d.type==='conveyor') for(let i=0;i<4;i++) {
   const parcel=box(activity,[.58,.4,.5],[0,1.05,0],cardboard);parcel.userData.garmentMotion='parcel';parcel.userData.phase=i/4;
  }
  if(d.type==='form_finish'||d.type==='iron') {
   const steam=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),new THREE.MeshBasicMaterial({color:'#e5eef0',transparent:true,opacity:.15,depthWrite:false}));
   steam.position.set(.25,1.8,0);steam.userData.garmentMotion='steam';activity.add(steam);
  }
 }
 // Flatten static operators into shared geometry/material batches across the entire band.
 activity.updateMatrixWorld(true);
 const flatten:THREE.Mesh[]=[];
 activity.traverse(o=>{if(o instanceof THREE.Mesh && !o.parent?.userData.garmentMotion)flatten.push(o);});
 const inverse=activity.matrixWorld.clone().invert();
 for(const mesh of flatten) {
  const matrix=inverse.clone().multiply(mesh.matrixWorld);
  mesh.removeFromParent();matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);activity.add(mesh);
  if(mesh.userData.baseY!==undefined)mesh.userData.baseY=mesh.position.y;
 }
 activity.traverse(o=>{if(o.userData.garmentMotion)o.userData.motion='garment';});
 for(const motion of ['hand','needle']) {
  const parts=flatten.filter(m=>m.userData.garmentMotion===motion);
  if(!parts.length)continue;
  const batch=new THREE.InstancedMesh(cube,parts[0].material,parts.length);
  batch.userData.garmentMotion=`${motion}Batch`;batch.userData.motion='garment';
  batch.userData.parts=parts.map(m=>{m.updateMatrix();const matrix=m.matrix.clone();activity.remove(m);return {matrix,phase:m.userData.phase??0};});
  batch.castShadow=true; activity.add(batch);
 }
 instanceGroup(activity);
 return model;
}
export function sewingModules(source:THREE.Object3D,rotation=0) {
 const group=new THREE.Group();
 for(const x of [-4.5,4.5]) {const module=fitAsset(source,[9,1.5,3.2],rotation);module.position.x=x;group.add(module);}
 return group;
}
export function animateGarment(model:THREE.Object3D,t:number,running:boolean,progress:number) {
 if(running)model.userData.garmentProgress=progress;
 const heldProgress=running?progress:(model.userData.garmentProgress??0);
 model.traverse(o=>{
  const motion=o.userData.garmentMotion; if(!motion)return;
  if((motion==='handBatch'||motion==='needleBatch') && o instanceof THREE.InstancedMesh) {
   o.userData.parts.forEach((part:{matrix:THREE.Matrix4;phase:number},i:number)=>{
    const matrix=part.matrix.clone();matrix.elements[13]+=running?Math.sin(t*8+part.phase)*(motion==='needleBatch'?.045:.025):0;o.setMatrixAt(i,matrix);
   });o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();
  }
  if(motion==='hand'||motion==='needle') o.position.y=o.userData.baseY+(running?Math.sin(t*8+(o.userData.phase??0))*(motion==='needle'?.045:.025):0);
  if(motion==='cut') o.position.x=-2.5+5*progress;
  if(motion==='steam') {o.visible=running;o.scale.setScalar(.6+progress);o.position.y=1.8+progress*.6;}
  if(motion==='parcel') {o.visible=running; o.position.x=-2.7+5.4*((progress+o.userData.phase)%1);}
  if(motion==='hanger') {
   const f=(heldProgress+o.userData.phase)%1, distance=f*38.6;
   if(distance<18)o.position.set(-9+distance,3.5,.62);
   else if(distance<19.3)o.position.set(9,3.5,.62-(distance-18));
   else if(distance<37.3)o.position.set(9-(distance-19.3),3.5,-.62);
   else o.position.set(-9,3.5,-.62+(distance-37.3));
  }
 });
}
