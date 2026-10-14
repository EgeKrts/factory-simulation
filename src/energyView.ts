import * as THREE from 'three';
import { AssetLibrary,fitAsset } from './assets';
import { instanceGroup } from './environment';
import type { Layout } from './types';

let reflection:THREE.CubeTexture|undefined;
const reflectiveMaterials=new WeakMap<THREE.Material,THREE.Material>();
/** Local industrial reflections keep stainless steel visible without changing the source GLBs. */
export function lightEnergyAsset(root:THREE.Object3D):THREE.Object3D{
 if(!reflection){const faces=Array.from({length:6},(_,side)=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!,gradient=g.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#e1e5e2');gradient.addColorStop(.5,'#a3aaa6');gradient.addColorStop(1,'#454c48');g.fillStyle=gradient;g.fillRect(0,0,128,128);if(side!==3){g.fillStyle='#fff8dc';g.fillRect(15,18,98,7);g.fillRect(34,45,64,4);}return c;});reflection=new THREE.CubeTexture(faces);reflection.colorSpace=THREE.SRGBColorSpace;reflection.needsUpdate=true;}
 root.traverse(o=>{if(o instanceof THREE.Mesh){const reflect=(source:THREE.Material)=>{if(!reflectiveMaterials.has(source)){const m=source.clone();if(m instanceof THREE.MeshStandardMaterial){m.envMap=reflection!;m.envMapIntensity=.8;m.roughness=Math.max(.27,m.roughness);}reflectiveMaterials.set(source,m);}return reflectiveMaterials.get(source)!;};o.material=Array.isArray(o.material)?o.material.map(reflect):reflect(o.material);}});
 return root;
}

/** Fixed utility infrastructure; selectable equipment is supplied by the layout's machine assets. */
export class EnergyCentreView {
 readonly interior=new THREE.Group();readonly exterior=new THREE.Group();
 constructor(layout:Layout,assets:AssetLibrary){
  const b=layout.buildings!.find(b=>b.id==='utility')!,[cx,cz]=b.center;
  const place=async(group:THREE.Group,file:string,x:number,y:number,z:number,size:[number,number,number],r=0)=>{
   const s=await assets.load(`enerji-odasi/${file}`);if(!s)return;
   const g=fitAsset(s,size);lightEnergyAsset(g);g.position.set(cx-x,y,cz+z);g.rotation.y=r;group.add(g);
  };
  void place(this.exterior,'chimney.glb',-6,4,7,[2.6,7.45,2.66]);
  for(const x of [-4.2,4.2])void place(this.interior,'Pipe run wall.glb',x,2.65,7.35,[8.51,3.66,1.02]);
  void place(this.interior,'Utility props.glb',0,.065,7.7,[13.49,6.03,.4]);
  const steel=new THREE.MeshStandardMaterial({color:'#657176',metalness:.7,roughness:.4}),yellow=new THREE.MeshStandardMaterial({color:'#e9c33e',roughness:.8}),dark=new THREE.MeshStandardMaterial({color:'#343e43',metalness:.4,roughness:.7});
  const cube=new THREE.BoxGeometry(1,1,1);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(cube,m);mesh.position.set(cx-x,y,cz+z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;this.interior.add(mesh);};
  // Service bays follow equipment footprints, leaving a continuous inspection corridor.
  for(const [x,z,w,d] of [[0,.5,4.7,8],[-8,.2,3.5,2],[-4.7,3.4,4.5,3.3],[-8,-3.8,3.3,2.2],[-3,-6,6,2.4],[7,-5.2,4.8,2.2]])
   for(const side of [-1,1]){box(x+side*w/2,.08,z,.07,.018,d,yellow);box(x,.08,z+side*d/2,w,.018,.07,yellow);}
  for(const x of [-10.5,10.5])for(const z of [-7.4,0,7.4]){box(x,.6,z,.14,1.2,.14,yellow);box(x,.9,z,.155,.2,.155,dark);}
  const lamps=new THREE.MeshStandardMaterial({color:'#fff5d5',emissive:'#fff2cc',emissiveIntensity:.7});
  for(const x of [-10.7,-5,1,6,10.7]){box(x,3.25,7.75,.22,6.5,.22,dark);if(x<8)box(x+2,5.5,7.6,2.2,.1,.18,lamps);}
  for(const z of [-7.5,-2,3,7.5]){box(-10.75,3.25,z,.22,6.5,.22,dark);box(-10.6,5.5,z+.7,.18,.1,1.8,lamps);}
  for(const z of [-7,0])box(0,.08,z,21,.02,.2,dark);
  for(const x of [-6,3.4])box(x,.08,0,.2,.02,14,dark);
  // Supported overhead feedwater, steam and fuel links join the supplied skids.
  const red=new THREE.MeshStandardMaterial({color:'#ad3428',metalness:.45,roughness:.5});
  const pipe=(points:number[][],radius:number,m:THREE.Material)=>{for(let i=1;i<points.length;i++){
   const a=new THREE.Vector3(cx-points[i-1][0],points[i-1][1],cz+points[i-1][2]),c=new THREE.Vector3(cx-points[i][0],points[i][1],cz+points[i][2]);
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,a.distanceTo(c),12),m);mesh.position.copy(a).add(c).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),c.sub(a).normalize());mesh.castShadow=true;this.interior.add(mesh);
  }};
  pipe([[-4.7,3.6,3.4],[-2.6,3.6,3.4],[-2.6,4.4,.5],[0,4.4,.5]],.12,steel);
  pipe([[0,4.7,1],[3.5,4.7,1],[3.5,4.7,4.5],[6,4.7,6.3]],.14,steel);
  pipe([[-3,1,-6],[-3,1,-3],[0,1,-3]],.09,yellow);
  pipe([[6,2.8,3.5],[5,2.8,-.9],[5,2.8,6.6],[-4.7,2.8,6.6],[-4.7,2.8,3.4]],.075,red);
  for(const z of [1,4.5]){box(3.5,2.25,z,.12,4.5,.12,steel);box(2,4.5,z,3,.12,.12,steel);}
  instanceGroup(this.interior);
 }
}



