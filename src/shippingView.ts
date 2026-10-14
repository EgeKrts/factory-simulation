import * as THREE from 'three';
import { AssetLibrary,fitAsset } from './assets';
import type { Layout } from './types';
import { receivingPallet } from './receivingView';
import { instanceGroup } from './environment';

export class ShippingWarehouseView{
 readonly group=new THREE.Group();readonly stockDesk=new THREE.Group();readonly palletStation=new THREE.Group();readonly ramp=new THREE.Group();
 constructor(layout:Layout,assets:AssetLibrary){
  const b=layout.buildings!.find(b=>b.id==='warehouse')!,[cx,cz]=b.center;this.group.visible=false;
  const place=async(file:string,x:number,z:number,size:[number,number,number],rotation=0,y=.065)=>{const source=await assets.load(file);if(!source)return;const g=fitAsset(source,size);g.position.set(cx+x,y,cz+z);g.rotation.y=rotation;this.group.add(g);};
  const racks=new THREE.Group();this.group.add(racks);
  void assets.load('ham-kumas-depo/raf.glb').then(source=>{if(!source)return;
   for(const x of [-12,-3,6])for(const z of [-12,-3,6]){const r=fitAsset(source,[8.68,6.77,1.48]);r.position.set(cx+x,.065,cz+z);r.rotation.y=Math.PI/2;racks.add(r);}
   for(const z of [-12,-4,4,12]){const r=fitAsset(source,[5,3.9,.86]);r.position.set(cx+24,.065,cz+z);r.rotation.y=Math.PI/2;racks.add(r);}
   // Put repeated GLB meshes in one parent so all thirteen modules share draw batches.
   racks.updateMatrixWorld(true);const inverse=racks.matrixWorld.clone().invert(),meshes:THREE.Mesh[]=[];
   racks.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
   for(const mesh of meshes){const transform=inverse.clone().multiply(mesh.matrixWorld);mesh.removeFromParent();transform.decompose(mesh.position,mesh.quaternion,mesh.scale);racks.add(mesh);}
   instanceGroup(racks);
  });
  void assets.load('ham-kumas-depo/Stock control station.glb').then(s=>{if(s)this.stockDesk.add(fitAsset(s,[4.23,1.77,2.68]));});
  void assets.load('konfeksiyon/paketleme-masasi.glb').then(s=>{if(s)this.palletStation.add(fitAsset(s,[4,1.8,3.5]));});
  void place('ham-kumas-depo/Pallet jack worker.glb',-7,11,[1.04,1.77,2.58],Math.PI/2);
  void place('ham-kumas-depo/Small props.glb',13,-22,[8.2,2.5,.27]);
  for(const x of [-24,24])for(const z of [-19,20])void place('ham-kumas-depo/planter.glb',x,z,[1.5,1.33,.81]);
  for(const x of [-24,-7,4,24])for(const z of [12,21])void place('ham-kumas-depo/Bollard.glb',x,z,[.34,1.11,.34]);
  const paint=new THREE.MeshStandardMaterial({color:'#edc345',roughness:.85}),white=new THREE.MeshStandardMaterial({color:'#eeeeea',roughness:.85}),steel=new THREE.MeshStandardMaterial({color:'#647078',metalness:.7,roughness:.45});
  const unit=new THREE.BoxGeometry(1,1,1);
  const box=(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(unit,m);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.receiveShadow=true;g.add(mesh);return mesh;};
  const lamp=new THREE.MeshStandardMaterial({color:'#fff7dd',emissive:'#fff0cc',emissiveIntensity:.9}),columns=new THREE.MeshStandardMaterial({color:'#303a3e',roughness:.5,metalness:.5});
  for(const x of [-26,-18,-10,-2,6,14,26]){box(this.group,cx+x,4.75,cz-22.6,.35,9.5,.35,columns);if(x<24)box(this.group,cx+x+2,8.2,cz-22.5,3,.1,.22,lamp);}
  for(const z of [-22,-15,0,18,22]){box(this.group,cx-26.6,4.75,cz+z,.35,9.5,.35,columns);box(this.group,cx-26.5,8.2,cz+z+1,.22,.1,2,lamp);}
  box(this.ramp,0,.1,0,5,.2,6,steel);
  for(const z of [-3,3]){box(this.ramp,0,.5,z,5,.08,.08,paint);for(const x of [-2.4,2.4])box(this.ramp,x,.3,z,.08,.6,.08,paint);}
  const line=(x:number,z:number,w:number,d:number,m=paint)=>box(this.group,cx+x,.08,cz+z,w,.018,d,m);
  for(const x of [-14,-10,-5,-1,4,8])line(x,-3,.06,28);
  for(const [x,z,w,d] of [[-15,16,18,6],[13,17,18,8],[18,-3,8,28]]){for(const s of [-1,1]){line(x+s*w/2,z,.09,d);line(x,z+s*d/2,w,.09);}}
  for(const x of [-8,1,11])for(const z of [-12,-3,7,12]){const shape=new THREE.Shape();shape.moveTo(-.12,-.7);shape.lineTo(.12,-.7);shape.lineTo(.12,.15);shape.lineTo(.45,.15);shape.lineTo(0,.7);shape.lineTo(-.45,.15);shape.lineTo(-.12,.15);shape.closePath();const a=new THREE.Mesh(new THREE.ShapeGeometry(shape),white);a.rotation.x=-Math.PI/2;a.position.set(cx+x,.1,cz+z);this.group.add(a);}
  for(let x=-5;x<=3;x+=.7)line(x,21,.35,2,white);
  // Folded-fabric lots in the left preparation area use the provided raw-depot pallet.
  for(const z of [-18])for(const x of [-23,-19]){const p=receivingPallet();p.position.set(cx+x,.065,cz+z);this.group.add(p);}
 }
}
