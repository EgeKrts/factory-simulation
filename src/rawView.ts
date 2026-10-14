import * as THREE from 'three';
import { AssetLibrary, batchStaticAsset, fitAsset } from './assets';
import type { Layout } from './types';

const folder='ham-kumas-depo/';
export class RawWarehouseView {
  readonly group=new THREE.Group();
  readonly desk=new THREE.Group();
  private pallet?: THREE.Object3D;
  private awaiting: THREE.Group[]=[];
  constructor(layout:Layout,assets:AssetLibrary){
    const b=layout.buildings!.find(b=>b.id==='raw')!,[cx,cz]=b.center;
    this.group.visible=false;
    const add=async(file:string,x:number,z:number,size:[number,number,number],rotation=0,y=.15)=>{
      const source=await assets.load(folder+file);if(!source)return;
      const model=fitAsset(source,size);model.position.set(cx+x,y,cz+z);model.rotation.y=rotation;this.group.add(model);
    };
    void assets.load(folder+'Stock control station.glb').then(source=>{if(source)this.desk.add(fitAsset(source,[4.23,1.77,2.68]));});
    for(const z of [-7,0,7])void add('raf.glb',-14.3,z,[6.95,5.42,1.19],Math.PI/2);
    for(const x of [2.75,9.75])for(const z of [-8,0,8])void add('Floor marking tile.glb',x,z,[6,.1,6],0,.155);
    void assets.load(folder+'Dock door.glb',true).then(source=>{
      if(!source)return;const door=source.clone(true);door.updateMatrixWorld(true);const panels:THREE.Object3D[]=[];
      door.traverse(o=>{if(o instanceof THREE.Mesh){const bounds=new THREE.Box3().setFromObject(o),s=bounds.getSize(new THREE.Vector3());if(s.x>3 && s.z<.3 && ((s.y>1 && bounds.min.y<2) || (s.y<.2 && bounds.min.y<3)))panels.push(o);}});panels.forEach(o=>o.removeFromParent());
      const model=batchStaticAsset(door);model.scale.setScalar(6/3.2);model.position.set(cx+8.5,.15,cz-11.75);this.group.add(model);
    });
    void add('Pallet jack worker.glb',12,3,[1.04,1.77,2.58],Math.PI/2);
    for(const [x,z] of [[-14,10],[-8,11],[14,-8],[14,9]])void add('planter.glb',x,z,[1.5,1.33,.81]);
    for(const [x,z] of [[-12,10],[-7,10],[-6,11],[14,10],[14,4],[14,-5],[5.1,-10.5],[11.9,-10.5]])void add('Bollard.glb',x,z,[.34,1.11,.34]);
    void add('Small props.glb',-3,-11.4,[8.2,2.5,.27]);
    // Preserve mesh boundaries to cut an actual north loading aperture in the supplied shell.
    void assets.load(folder+'Warehouse shell.glb',true).then(source=>{
      if(!source)return;const shell=source.clone(true);shell.scale.set(-4/3,4/3,4/3);shell.updateMatrixWorld(true);
      const replacements:THREE.Mesh[]=[];
      shell.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
        const bounds=new THREE.Box3().setFromObject(o),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
        if(center.z<-11.5 && bounds.max.x>5.5 && bounds.min.x<11.5 && bounds.min.y<5){
          o.visible=false;
          // Wide wall faces are rebuilt around the opening with their supplied material.
          if(size.x>15 && size.y>4){
            for(const [lo,hi,bottom,top] of [[bounds.min.x,5.5,bounds.min.y,bounds.max.y],[11.5,bounds.max.x,bounds.min.y,bounds.max.y],[5.5,11.5,5,bounds.max.y]]){
              if(hi<=lo||top<=bottom)continue;
              const wall=new THREE.Mesh(new THREE.BoxGeometry(hi-lo,top-bottom,size.z),o.material);wall.position.set((lo+hi)/2,(bottom+top)/2,center.z);replacements.push(wall);
            }
          }
        }
      });
      const hidden:THREE.Object3D[]=[];shell.traverse(o=>{if(!o.visible)hidden.push(o);});hidden.forEach(o=>o.removeFromParent());
      const merged=batchStaticAsset(shell);merged.add(...replacements);merged.position.set(cx,.03,cz);merged.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.userData.sharedAsset=true;}});this.group.add(merged);
    });
    const paint=new THREE.MeshStandardMaterial({color:0xf2c200,roughness:.85}),box=new THREE.BoxGeometry(1,1,1);
    const stripe=(x:number,z:number,w:number,d:number)=>{const m=new THREE.Mesh(box,paint);m.scale.set(w,.018,d);m.position.set(cx+x,.165,cz+z);this.group.add(m);};
    for(const x of [-11,-5])stripe(x,0,.09,22);
    for(let z=-10;z<=10;z+=.7)stripe(-8,z,3.8,.25);
    // Pedestrian crossing only at the front; the longitudinal corridor stays unpainted inside.
    for(const child of [...this.group.children])if(child instanceof THREE.Mesh&&child.scale.x===3.8&&child.position.z<cz+9)this.group.remove(child);
    for(const z of [-6,2,7]){const arrow=new THREE.Shape();arrow.moveTo(-.15,-.7);arrow.lineTo(.15,-.7);arrow.lineTo(.15,.1);arrow.lineTo(.5,.1);arrow.lineTo(0,.7);arrow.lineTo(-.5,.1);arrow.lineTo(-.15,.1);arrow.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(arrow),paint);m.rotation.x=-Math.PI/2;m.position.set(cx-8,.18,cz+z);this.group.add(m);}
    void assets.load(folder+'Fabric lot pallet.glb').then(source=>{if(!source)return;this.pallet=fitAsset(source,[1.6,2.45,3.25]);for(const g of this.awaiting){g.clear();g.add(this.pallet.clone(true));}this.awaiting=[];});
  }
  cargo(){const g=new THREE.Group();g.userData.rawCargo=true;if(this.pallet)g.add(this.pallet.clone(true));else this.awaiting.push(g);return g;}
}
