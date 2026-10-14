import * as THREE from 'three';
import type { BuildingDef,MachineDef } from './types';
import { solarSlots } from './solar';
import { instanceGroup } from './environment';

const cube=new THREE.BoxGeometry(1,1,1),steel=new THREE.MeshStandardMaterial({color:'#9baab0',roughness:.45,metalness:.5}),dark=new THREE.MeshStandardMaterial({color:'#172d37',roughness:.6}),blue=new THREE.MeshStandardMaterial({color:'#1b6587',roughness:.5}),yellow=new THREE.MeshStandardMaterial({color:'#dfbd36',roughness:.7});
let cell:THREE.MeshStandardMaterial|undefined;const plane=new THREE.PlaneGeometry(1.13,2.2);
export function solarRoof(roof:THREE.Group,b:BuildingDef){
 if(!cell){const c=document.createElement('canvas');c.width=120;c.height=240;const g=c.getContext('2d')!;g.fillStyle='#142f52';g.fillRect(0,0,120,240);g.strokeStyle='#6984a2';g.lineWidth=1;for(let x=0;x<=120;x+=20){g.beginPath();g.moveTo(x,0);g.lineTo(x,240);g.stroke();}for(let y=0;y<=240;y+=20){g.beginPath();g.moveTo(0,y);g.lineTo(120,y);g.stroke();}g.strokeStyle='#c0cbd3';g.lineWidth=3;g.strokeRect(1,1,118,238);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;cell=new THREE.MeshStandardMaterial({map:texture,color:'#b8d7ff',metalness:.3,roughness:.35});}
 const panels=new THREE.Group();roof.add(panels);
 for(const p of solarSlots(b)){const frame=new THREE.Mesh(cube,steel);frame.scale.set(1.17,.07,2.24);frame.position.set(p.x,p.y,p.z);frame.rotation.x=p.angle;frame.castShadow=true;panels.add(frame);
  const face=new THREE.Mesh(plane,cell);face.position.set(p.x,p.y+.045,p.z);face.rotation.x=-Math.PI/2+p.angle;face.receiveShadow=true;panels.add(face);}
 instanceGroup(panels);
}
export function powerMachine(d:MachineDef):THREE.Group|undefined{
 if(!['inverter','battery','switchgear','transformer'].includes(d.type))return;
 const g=new THREE.Group();
 const box=(x:number,y:number,z:number,w:number,h:number,depth:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(cube,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,depth);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 if(d.type==='transformer'){
  box(0,.15,0,2.8,.3,3.5,dark);box(0,1.1,0,1.7,1.7,2.5,steel);
  for(const x of [-1,1])for(let z=-1.2;z<=1.2;z+=.18)box(x,1.1,z,.35,1.6,.08,steel);
  for(const x of [-.55,0,.55]){box(x,2.15,0,.13,.45,.13,dark);for(let y=2;y<2.4;y+=.1)box(x,y,0,.25,.025,.25,dark);}
  box(0,1.4,1.3,.9,.65,.12,blue);
 }else{
  const w=d.type==='switchgear'?3.5:1.6,h=d.type==='battery'?2.4:2.2;
  box(0,h/2,0,w,h,d.type==='battery'?1.2:1,steel);
  for(let x=-w/2+.4;x<w/2;x+=.75){box(x,h*.7,.52,.4,.25,.04,dark);box(x,h*.7,.55,.3,.14,.02,blue);for(let y=.3;y<.8;y+=.1)box(x,y,.52,.45,.025,.04,dark);}
  box(0,h*.45,.53,.18,.22,.03,yellow);
  if(d.type==='battery')for(let y=.25;y<2.2;y+=.4)box(0,y,.62,1.3,.025,.015,dark);
 }
 instanceGroup(g);return g;
}
