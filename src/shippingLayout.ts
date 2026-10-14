import type { Layout,MachineDef,Point2 } from './types';
export const shippingCells:Point2[]=[[-21,16],[-17,16],[-13,16],[-9,16],[7,15],[11,15],[15,15],[19,15],[7,19],[11,19],[15,19],[19,19]];
export function shippingCell(d:MachineDef,i:number):Point2{const p=shippingCells[i]??[30+(i-12)*3,18];return[d.position[0]-24+p[0],d.position[2]+20+p[1]];}
export function upgradeShippingWarehouse(input:Layout):Layout{
 if(input.shippingRevision===2||!input.buildings?.some(b=>b.id==='warehouse')||!['PALLET-01','WH-01','DOCK-01','TRUCK-01'].every(id=>input.machines.some(m=>m.id===id)))return input;
 const l=structuredClone(input),b=l.buildings!.find(b=>b.id==='warehouse')!,[x,z]=b.center;b.height=9.5;
 b.doors=[{id:'warehouse-in',side:'north',offset:18,width:7,height:6},{id:'warehouse-load',side:'west',offset:10,width:7,height:7},{id:'warehouse-load-back',side:'west',offset:-7,width:7,height:7}];
 const yard=l.outdoors!.find(a=>a.id==='warehouse-yard')!;yard.center=[x+18,z-29];yard.size=[20,14];
 const shipyard=l.outdoors!.find(a=>a.id==='shipping-yard')!;shipyard.center=[x-35,z+3];shipyard.size=[24,38];
 const shipping=l.areas.find(a=>a.id==='shipping')!;shipping.center=[x-38,z+10];shipping.size=[18,26];
 const place=(id:string,px:number,pz:number,r=0)=>{const m=l.machines.find(m=>m.id===id)!;m.position=[x+px,0,z+pz];m.rotationY=r;return m;};
 const pallet=place('PALLET-01',18,7);pallet.params.shippingLine=1;
 const wh=place('WH-01',24,-20);wh.params.mamulStore=1;
 const dock=place('DOCK-01',-23,10,Math.PI);dock.params.shippingDock=1;
 place('TRUCK-01',-38,10);
 const pack=l.machines.find(m=>m.id==='PACK-01');if(pack)pack.next=pack.next.map(id=>id==='PALLET-01'?'SHIP-CONVEYOR':id);
 if(!l.machines.some(m=>m.id==='SHIP-CONVEYOR'))l.machines.push({id:'SHIP-CONVEYOR',type:'conveyor',name:'Paketleme Hattı',area:'warehouse',position:[x+18,0,z-13],rotationY:-Math.PI/2,params:{},next:['SHIP-LABEL']});
 if(!l.machines.some(m=>m.id==='SHIP-LABEL'))l.machines.push({id:'SHIP-LABEL',type:'pack',name:'Etiketleme / Barkod',area:'warehouse',position:[x+18,0,z-2],rotationY:-Math.PI/2,params:{},next:['PALLET-01']});
 place('SHIP-CONVEYOR',18,-13,-Math.PI/2);place('SHIP-LABEL',18,-2,-Math.PI/2);
 l.obstacles=(l.obstacles??[]).filter(o=>!o.id.startsWith('shipping-rack-'));
 for(const rx of [-12,-3,6])l.obstacles.push({id:`shipping-rack-${rx}`,center:[x+rx,z-3],size:[1.5,27]});
 l.shippingRevision=2;return l;
}
