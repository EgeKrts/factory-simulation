import type { Layout,MachineType,Point2 } from './types';

export const energyEquipment:{id:string;type:MachineType;name:string;file:string;p:Point2;size:[number,number,number];rotation:number}[]=[
 {id:'ENERGY-WATER',type:'water_treatment',name:'Su Yumuşatma Sistemi',file:'Water softener.glb',p:[8,.2],size:[2.88,2.29,1.35],rotation:0},
 {id:'ENERGY-FEED',type:'tank',name:'Besleme Suyu Tankı',file:'Feedwater tank.glb',p:[4.7,3.4],size:[3.97,3.97,2.7],rotation:0},
 {id:'ENERGY-DOSING',type:'tank',name:'Kimyasal Dozaj Ünitesi',file:'Chemical dosing.glb',p:[8,-3.8],size:[2.75,1.42,1.65],rotation:0},
 {id:'ENERGY-FUEL',type:'tank',name:'Yakıt Hattı',file:'Fuel line.glb',p:[3,-6],size:[5.48,1.86,1.71],rotation:0},
 {id:'ENERGY-AIR',type:'compressor',name:'Kompresör',file:'Air compressor.glb',p:[-7,-5.2],size:[4.08,1.95,1.4],rotation:0},
 {id:'ENERGY-STEAM',type:'tank',name:'Buhar Manifoldu',file:'Steam manifold.glb',p:[-6,6.3],size:[5.38,2.33,1.91],rotation:0},
 {id:'ENERGY-RETURN',type:'tank',name:'Kondens Dönüş Hattı',file:'Condensate return.glb',p:[-6,3.5],size:[4.57,3.5,1.09],rotation:0},
];
/** Install supplied energy equipment once, preserving the boiler's fault and capacity settings. */
export function upgradeEnergyCentre(input:Layout):Layout {
 if(input.energyRevision===3||!input.buildings?.some(b=>b.id==='utility')||!input.machines.some(m=>m.id==='BOILER-01'))return input;
 const l=structuredClone(input),b=l.buildings!.find(b=>b.id==='utility')!,[x,z]=b.center;
 b.height=6.5;b.size=[22,16];b.color='#7b8b93';
 const boiler=l.machines.find(m=>m.id==='BOILER-01')!;
 boiler.position=[x,0,z+.5];boiler.rotationY=-Math.PI/2;boiler.params.energyEquipment=1;
 Object.assign(boiler.params,{modelWidth:7,modelHeight:5.28,modelDepth:3.28});
 if(!boiler.asset)boiler.asset='buhar-kazani.glb';
 for(const e of energyEquipment){let m=l.machines.find(m=>m.id===e.id);
  if(!m){m={id:e.id,type:e.type,name:e.name,area:'utilities',position:[x+e.p[0],0,z+e.p[1]],rotationY:e.rotation,params:{},next:[],asset:`enerji-odasi/${e.file}`};l.machines.push(m);}
  m.position=[x+e.p[0],e.id==='ENERGY-STEAM'?3.6:0,z+e.p[1]];m.rotationY=e.rotation;m.name=e.name;
  Object.assign(m.params,{energyEquipment:1,modelWidth:e.size[0],modelHeight:e.size[1],modelDepth:e.size[2],queueCap:0,mtbfH:m.params.mtbfH??48,mttrMin:m.params.mttrMin??15});
 }
 for(const r of l.utilityRoutes??[])if(r.from===boiler.id){r.points[0]=[x,z+.5];}
 l.energyRevision=3;return l;
}


