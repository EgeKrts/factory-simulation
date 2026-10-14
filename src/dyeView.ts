import * as THREE from 'three';
import type { MachineDef, MachineState } from './types';
import { specOf } from './machineTypes';
import { instanceGroup } from './environment';

const cube=new THREE.BoxGeometry(1,1,1),head=new THREE.SphereGeometry(.15,10,8);
const rotor=new THREE.TorusGeometry(.2,.035,6,12);
const mats={blue:new THREE.MeshStandardMaterial({color:'#176cbc',roughness:.75}),skin:new THREE.MeshStandardMaterial({color:'#c79d79',roughness:.8}),dark:new THREE.MeshStandardMaterial({color:'#253540',roughness:.8}),steel:new THREE.MeshStandardMaterial({color:'#b5bec5',metalness:.7,roughness:.3}),paint:new THREE.MeshStandardMaterial({color:'#ddbb3c',roughness:.8})};
const eligible=(d:MachineDef)=>['dyehouse','dyeprep','finishing','quality','dye-service'].includes(d.area)&&d.type!=='slot';
function box(g:THREE.Group,size:number[],p:number[],mat:THREE.Material) {
 const mesh=new THREE.Mesh(cube,mat);mesh.scale.set(size[0],size[1],size[2]);mesh.position.set(p[0],p[1],p[2]);mesh.castShadow=true;g.add(mesh);return mesh;
}
/** Imported assets remain intact; station workers, controls and cloth motion follow production. */
export function dressDyeModel(model:THREE.Object3D,d:MachineDef) {
 if(!eligible(d))return model;
 const [w,,depth]=specOf(d).size,activity=new THREE.Group();activity.name='dyeActivity';model.add(activity);
 for(const side of [-1,1])for(const horizontal of [false,true])box(activity,horizontal?[w+.6,.015,.06]:[.06,.015,depth+.6],horizontal?[0,.085,side*(depth/2+.3)]:[side*(w/2+.3),.085,0],mats.paint).castShadow=false;
 if(!['tank','cart'].includes(d.type)) {
  const x=w*.3,z=depth*.3;
  box(activity,[.34,.5,.28],[x,1.15,z],mats.blue);
  const face=new THREE.Mesh(head,mats.skin);face.position.set(x,1.58,z);activity.add(face);
  for(const side of [-1,1]) {
   box(activity,[.14,.72,.16],[x+side*.12,.47,z],mats.dark);
   const hand=box(activity,[.12,.12,.43],[x+side*.22,1.18,z-.23],mats.skin);
   hand.userData.motion='dye-hand';hand.userData.baseY=1.18;hand.userData.phase=side;
  }
  const control=new THREE.Mesh(rotor,mats.steel);control.position.set(-w*.25,1.2,depth/2);control.userData.motion='dye-rotor';activity.add(control);
 }
 if(['stenter','compactor','inspection','rope_open'].includes(d.type)) {
  const cloth=new THREE.MeshStandardMaterial({color:'#e6dfd0',roughness:.96});
  const web=box(activity,[w*.48,.026,Math.min(1.25,depth*.45)],[0,d.type==='inspection'?1.25:1.3,0],cloth);
  web.userData.motion='dye-cloth';web.userData.baseX=0;web.userData.webWidth=w*.48;
 }
 if(['ht_jet','dryer','dyeprep'].includes(d.type)) {
  const steam=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),new THREE.MeshBasicMaterial({color:'#edf2f4',transparent:true,opacity:.13,depthWrite:false}));
  steam.position.set(-w*.25,specOf(d).size[1]*.7,0);steam.userData.motion='dye-steam';steam.userData.baseY=steam.position.y;activity.add(steam);
 }
 if(d.type==='centrifuge') {
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.045,16),mats.dark);
  drum.position.y=2.35;drum.userData.motion='dye-drum';activity.add(drum);
 }
 instanceGroup(activity);return model;
}
export function animateDye(model:THREE.Object3D,state:MachineState|undefined,t:number,color?:string) {
 const running=state?.status==='RUNNING',progress=state?.progress??0;
 model.traverse(o=>{
  const motion=o.userData.motion;
  if(motion==='dye-hand')o.position.y=o.userData.baseY+(running?Math.sin(t*5+o.userData.phase)*.035:0);
  if(motion==='dye-rotor' && running)o.rotation.z=progress*Math.PI*4;
  if(motion==='dye-drum' && running)o.rotation.y=progress*Math.PI*100;
  if(motion==='dye-cloth') {
   if(color)(o as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.set(color);
   if(running)o.position.x=Math.sin(progress*Math.PI*4)*.07;
  }
  if(motion==='dye-steam') {o.visible=running && (state?.telemetry.steamKgH??(state?.id.startsWith('DYEPREP')?1:0))>0;o.position.y=o.userData.baseY+progress*.3;o.scale.setScalar(.6+progress*.5);}
 });
}
