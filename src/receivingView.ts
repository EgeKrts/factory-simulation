import * as THREE from 'three';
import * as supplied from './receivingAssets';
import { batchStaticAsset } from './assets';
import type { Layout, MachineDef, MachineState, Snapshot } from './types';

function shadows(root: THREE.Object3D) {
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; o.userData.sharedAsset = true; } });
  return root;
}
const staticModels = new Map<string, THREE.Object3D>();
function staticModel(key: string, create: () => THREE.Object3D) {
  if (!staticModels.has(key)) staticModels.set(key, shadows(batchStaticAsset(create())));
  return staticModels.get(key)!.clone(true);
}
function screenTexture(root: THREE.Object3D): THREE.CanvasTexture | undefined {
  let result: THREE.CanvasTexture | undefined;
  root.traverse(o => { if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
    const m = o.material as THREE.MeshStandardMaterial;
    if (m.emissiveMap instanceof THREE.CanvasTexture) result = m.emissiveMap;
  } });
  return result;
}
function worker(pose: string, x: number, z: number, rotation: number) {
  const g = supplied.createWorker({pose});
  for (const child of g.children) if (child instanceof THREE.Group && Math.abs(child.position.y - 1.43) < .01) {
    child.userData.receivingArm = child.rotation.x;
    child.traverse(o => { if (o instanceof THREE.Mesh) o.userData.motion = 'receiving-arm'; });
  }
  g.position.set(x, .065, z); g.rotation.y = rotation; shadows(g); return g;
}

/** A compact, supported load for both forklift sockets and floor staging. */
export function receivingPallet(cols=2,layers=2) {
  return staticModel(`cargo-${cols}-${layers}`, () => supplied.createFabricRollPallet({cols,layers,rollR:cols===3?.4:.29,rollLen:1.15}));
}

export function receivingMachine(d: MachineDef): THREE.Object3D | undefined {
  let root: THREE.Object3D, file: string;
  if (d.type === 'receipt_desk') {
    root = staticModel('desk', () => supplied.createReceptionDesk({length:4.5,monitors:2}));
    root.add(worker('type', .5, 1.3, Math.PI)); file = 'kabul-masasi.js';
  } else if (d.type === 'receipt_scan') {
    const authored = supplied.createScanPortal({conveyorLength:14,gateX:4.8});
    authored.traverse(o => { if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry && o.geometry.parameters.radiusTop === .025) o.userData.motion = 'receiving-roller'; });
    root = shadows(authored); file = 'tarama-kapisi.js';
  } else if (d.type === 'receipt_scale') {
    root = supplied.createFloorScale({size:2.2,display:'0.0 kg'});
    root.userData.weightScreen = screenTexture(root);
    root = Object.assign(shadows(batchStaticAsset(root)), {userData: root.userData});
    root.add(worker('carry', 1.65, .55, -Math.PI / 2)); file = 'zemin-tartisi.js';
  } else if (d.type === 'receipt_hold') {
    root = staticModel('holding', () => supplied.createHoldingCage({w:7,d:6,h:2,signText:['GEÇİCİ BEKLEME','KONTROL BEKLEYEN','MALZEME']}));
    file = 'bekleme-kafesi.js';
  } else if (d.id === 'ENTRY-01' && ['receiving','receiving_unload'].includes(d.area)) {
    root = new THREE.Group();
    for (const z of [-2.8,2.8]) {
      const stop = staticModel('stop', () => supplied.createWheelStop({length:3})); stop.position.set(0,.065,z); root.add(stop);
    }
    root.add(worker('carry', 1.8, -1.3, Math.PI / 2)); file = 'tir.js / boşaltma alanı';
  } else return undefined;
  // Floor top is 6 cm above world zero; the supplied factories were authored at y=0.
  root.position.y += .065; root.userData.assetUrl = `/assets/mal-kabul/source/${file}`;
  return root;
}

export function animateReceiving(root: THREE.Object3D, state: MachineState | undefined, time: number) {
  const running = state?.status === 'RUNNING';
  root.traverse(o => {
    if (o.userData.receivingArm !== undefined && running) o.rotation.x = o.userData.receivingArm + Math.sin(time * 5 + o.position.x * 7) * .08;
    if (o.userData.motion === 'receiving-roller' && running) o.rotation.z = time * 2;
  });
  const texture = root.userData.weightScreen as THREE.CanvasTexture | undefined;
  if (texture) {
    const kg = state?.telemetry.weightKg ?? 0, text = `${kg.toFixed(1)} kg`;
    if (root.userData.lastWeight !== text) {
      const c = texture.image as HTMLCanvasElement, ctx = c.getContext('2d')!;
      ctx.fillStyle='#031a08';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#4cff6e';ctx.font='bold 40px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2);
      texture.needsUpdate=true;root.userData.lastWeight=text;
    }
  }
}

export class ReceivingHallView {
  readonly interior = new THREE.Group();
  readonly northWall = new THREE.Group();
  readonly canopy = new THREE.Group();
  readonly westWall = new THREE.Group();
  readonly truck: THREE.Object3D;
  private boardTexture?: THREE.CanvasTexture;
  private lastBoard = '';
  private accepted: string[] = [];
  private seenAccepted = new Set<string>();
  private truckLoads: THREE.Mesh[] = [];
  constructor(layout: Layout) {
    const b=layout.buildings?.find(b=>b.id==='receiving');
    const [cx,cz]=b?.center??[-87,-42], [w,d]=b?.size??[32,30];
    const place=(group:THREE.Group,obj:THREE.Object3D,x:number,z:number,rotation=0,y=.065)=>{obj.position.set(x,y,z);obj.rotation.y=rotation;group.add(obj);return obj;};
    // Coordinates and orientations are taken verbatim from mal-kabul-yerlesim.js.
    place(this.northWall,supplied.createWallSection({length:40,height:6,columnEvery:5}),cx,cz-14);
    place(this.westWall,supplied.createWallSection({length:28,height:6,columnEvery:7}),cx-20,cz,Math.PI/2);
    place(this.canopy,supplied.createCanopy({length:18,depth:5.5,height:5.5,columns:4}),cx-20,cz-14);
    for (let x=-16;x<=16;x+=6) place(this.northWall,supplied.createPendantLamp({drop:.8}),cx+x,cz-12.8,0,5.3);
    const board=supplied.createInfoBoard({rows:[]});this.boardTexture=screenTexture(board);
    place(this.westWall,board,cx-19.85,cz-9,Math.PI/2,3.2);
    for (const [x,type] of [[6,'warning'],[7.2,'ppe']] as const) place(this.northWall,supplied.createSafetySign({type}),cx+x,cz-13.85,0,1.7);
    place(this.northWall,supplied.createElectricalCabinet(),cx+3,cz-13.75);
    for (const z of [-12.5,2.5]) place(this.interior,staticModel('reference-planter',()=>supplied.createPlanter({length:1.2})),cx-18.8,cz+z,Math.PI/2);
    const secondWorker=worker('stand',cx-16.2,cz-1.5,Math.PI);this.interior.add(secondWorker);
    const markings=supplied.createFloorMarkings({w:24,d:16});
    // The image uses a yellow longitudinal forklift lane, with no green strip through the stock bays.
    markings.traverse(o=>{if(o instanceof THREE.Mesh && !Array.isArray(o.material)){
      const mat=o.material as THREE.MeshStandardMaterial;
      if(mat.color.getHex()===0x2f9e5b || mat.color.getHex()===0xf4f4f0 || mat.map || o.position.z < -3)o.visible=false;
    }});
    // Hidden prototype paint must not be brought back by static batching.
    for(const child of [...markings.children])if(!child.visible)markings.remove(child);
    place(this.interior,markings,cx-2,cz+1,Math.PI/2,.07);
    const paint=new THREE.MeshStandardMaterial({color:0xf2c200,roughness:.9});
    const dashGeometry=new THREE.BoxGeometry(1,.018,1);
    for(const [x,z] of [[6,8],[10,10],[14,6.5]]) {
      const bay=new THREE.Group();
      for(let a=-1.8;a<=1.8;a+=.65)for(const side of [-1,1]){const dash=new THREE.Mesh(dashGeometry,paint);dash.scale.set(.42,1,.07);dash.position.set(a,.078,side*1.35);bay.add(dash);}
      for(let a=-1.1;a<=1.1;a+=.6)for(const side of [-1,1]){const dash=new THREE.Mesh(dashGeometry,paint);dash.scale.set(.07,1,.4);dash.position.set(side*2,.078,a);bay.add(dash);}
      place(this.interior,bay,cx+x,cz+z,.5,0);
    }
    for(const [x,z] of [[-14,6],[-14,12],[-4,10],[-4,14],[8,13],[18,8],[18,1],[-15,-12],[-4,-12],[10,-12]])
      place(this.interior,staticModel('reference-bollard',()=>supplied.createBollard({height:1})),cx+x,cz+z);
    place(this.interior,supplied.createSafetyRail({length:3}),cx-3,cz-7);
    this.interior=shadows(batchStaticAsset(this.interior)) as THREE.Group;
    this.northWall=shadows(batchStaticAsset(this.northWall)) as THREE.Group;
    this.westWall=shadows(batchStaticAsset(this.westWall)) as THREE.Group;
    this.canopy=shadows(batchStaticAsset(this.canopy)) as THREE.Group;
    const truck=supplied.createSemiTruck({trailerLength:13.6,openFrac:.75,loadRolls:true});
    truck.traverse(o=>{if(o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry && [ .43,.12 ].includes(o.geometry.parameters.radiusTop) && o.geometry.parameters.height>1) {o.userData.motion='truck-load';this.truckLoads.push(o);}});
    this.truck=shadows(batchStaticAsset(truck));
    this.truckLoads=[];this.truck.traverse(o=>{if(o instanceof THREE.Mesh && o.userData.motion==='truck-load')this.truckLoads.push(o);});
  }
  snapshot(s: Snapshot) {
    const rows: [string,string,string][]=[];
    for(const id of ['RECEIPT-REG','RECEIPT-SCAN','RECEIPT-WEIGH','RECEIPT-HOLD']) {
      const state=s.machines.find(m=>m.id===id),lot=s.lots.find(l=>l.place==='current'&&l.stationId===id);
      if(lot) rows.push([lot.id,id==='RECEIPT-WEIGH'?`${lot.kg} kg / Tartım`:id==='RECEIPT-HOLD'?'Depo onayı':'İşlemde',state?.status==='DOWN'?'#ff5454':'#ffb300']);
      for(const l of s.lots.filter(l=>l.from==='RECEIPT-HOLD'&&l.place==='transit')) if(!this.seenAccepted.has(l.id)){this.seenAccepted.add(l.id);this.accepted.unshift(l.id);this.accepted=this.accepted.slice(0,8);}
    }
    for(const id of this.accepted)rows.push([id,'Kabul edildi','#4cd964']);
    const count=s.machines.find(m=>m.id==='RECEIPT-HOLD')?.counters.good??0;
    const text=JSON.stringify([count,rows.slice(0,6)]);
    if(this.boardTexture && text!==this.lastBoard){
      this.lastBoard=text;const c=this.boardTexture.image as HTMLCanvasElement,ctx=c.getContext('2d')!;
      ctx.fillStyle='#06142e';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#0d3b8e';ctx.fillRect(0,0,c.width,110);ctx.font='bold 64px sans-serif';ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(`MAL KABUL · ${count}`,c.width/2,58);
      ctx.textAlign='left';ctx.font='42px sans-serif';rows.slice(0,6).forEach(([id,status,color],i)=>{ctx.fillStyle='#fff';ctx.fillText(id,40,155+i*70);ctx.fillStyle=color;ctx.fillText(status,300,155+i*70);});this.boardTexture.needsUpdate=true;
    }
    const received=s.machines.find(m=>m.id==='ENTRY-01')?.counters.good??0;
    const away=(s.machines.find(m=>m.id==='ENTRY-01')?.telemetry.truckReturnSeconds??0)>0;
    const remaining=away?0:1-(received%8)/8;
    for(let i=0;i<this.truckLoads.length;i++)this.truckLoads[i].visible=i<this.truckLoads.length*remaining;
  }
}
