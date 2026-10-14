import type { Layout, MachineDef, Point2 } from './types';

/** Dense, three-lane wet processing plant. Existing machine identities and user parameters survive. */
export function upgradeDyeHall(input:Layout):Layout {
 if(input.dyeRevision===1 || !input.buildings?.some(b=>b.id==='dye') || !input.machines.some(m=>m.id==='HT-01'))return input;
 const result=structuredClone(input), hall=result.buildings!.find(b=>b.id==='dye')!;
 hall.rooms=[{name:'BOYA / KİMYASAL HAZIRLAMA',center:[-43,-49],size:[23,18],doorZ:-49}];
 const areas:Record<string,{center:Point2;size:Point2}>= {dyehouse:{center:[-1,-33],size:[76,50]},dyeprep:{center:[-43,-49],size:[23,18]},finishing:{center:[64,-33],size:[56,50]},quality:{center:[64,-55],size:[55,6]}};
 for(const area of result.areas)if(areas[area.id])Object.assign(area,areas[area.id],{buildingId:'dye'});
 if(!result.areas.some(a=>a.id==='dye-service'))result.areas.push({id:'dye-service',name:'SU / BASINÇLI HAVA / TANKLAR',buildingId:'dye',center:[7,-55],size:[63,6],color:'#94adb6'});
 const ensure=(id:string,type:MachineDef['type'],name:string,area:string,p:Point2,next:string[],params:Record<string,number>={})=>{
  let m=result.machines.find(m=>m.id===id);
  if(!m){m={id,type,name,area,position:[p[0],0,p[1]],rotationY:0,params:{...params},next:[]};result.machines.push(m);}
  m.name=name;m.area=area;m.position=[p[0],0,p[1]];m.rotationY=0;
  // Keep bespoke branches while replacing the previous standard pipeline.
  m.next=[...new Set([...next,...m.next.filter(n=>! /^(?:INSP|OPEN|CART|HT|CENT|DRY|STENTER|COMPACT)-\d+$/.test(n) && n!=='SPREAD-01' && n!=='CUT-01')])];
  return m;
 };
 const inspectIds=['INSP-01','INSP-03','INSP-04'];
 const openIds=['OPEN-01','OPEN-02','OPEN-03'];
 const inputCarts=['CART-01','CART-03','CART-04'];
 const outputCarts=['CART-02','CART-05','CART-06'];
 const finalIds=['INSP-02','INSP-05','INSP-06'];
 const target=result.machines.some(m=>m.id==='SPREAD-01')?'SPREAD-01':'CUT-01';
 for(let lane=0;lane<3;lane++) {
  const n=String(lane+1).padStart(2,'0'),z=-47+lane*12;
  const htIds=Array.from({length:4},(_,col)=>`HT-${String(lane*4+col+1).padStart(2,'0')}`);
  ensure(inspectIds[lane],'inspection',`02 · Giriş Kumaş Kontrol ${lane+1}`,'dyehouse',[-46,-35+lane*10],[openIds[lane]]);
  ensure(openIds[lane],'rope_open',`02 · Halat Açma ${lane+1}`,'dyehouse',[-32,-35+lane*10],[inputCarts[lane]]);
  ensure(inputCarts[lane],'cart',`Parti Arabası ${lane+1}`,'dyehouse',[-23+lane*14,-12],htIds,{queueCap:3});
  for(let col=0;col<4;col++)ensure(htIds[col],'ht_jet',`04 · HT Jet ${lane+1}.${col+1}`,'dyehouse',[-17+col*15,z],[outputCarts[lane]],{cycleSec:240+col*40,capacityKg:[250,500,750,1000][col]});
  ensure(outputCarts[lane],'cart',`Islak Kumaş Arabası ${lane+1}`,'dyehouse',[36+lane*16,-12],[`CENT-${n}`],{queueCap:4});
  ensure(`CENT-${n}`,'centrifuge',`05 · Sıkma / Santrifüj ${lane+1}`,'finishing',[42,z],[`DRY-${n}`]);
  ensure(`DRY-${n}`,'dryer',`06 · Kurutma ${lane+1}`,'finishing',[51,z],[`STENTER-${n}`]);
  ensure(`STENTER-${n}`,'stenter',`07 · Ramöz ${lane+1}`,'finishing',[66,z],[`COMPACT-${n}`]);
  ensure(`COMPACT-${n}`,'compactor',`08 · Kompaktör / Fikse ${lane+1}`,'finishing',[83,z],[finalIds[lane]]);
  ensure(finalIds[lane],'inspection',`09 · Final Kalite ${lane+1}`,'quality',[80-lane*17,-55],[target],{rejectPct:2});
 }
 const raw=result.machines.find(m=>m.id==='RAWSTORE-01');
 if(raw)raw.next=[...new Set([...inspectIds,...raw.next.filter(n=>n!=='INSP-01')])];
 ensure('DYEPREP-01','dyeprep','03 · Boya / Kimyasal Hazırlama 1','dyeprep',[-43,-53],[]);
 ensure('DYEPREP-02','dyeprep','03 · Boya / Kimyasal Hazırlama 2','dyeprep',[-43,-45],[]);
 for(let i=0;i<3;i++)ensure(`TANK-0${i+1}`,'tank',`Proses Su Tankı ${i+1}`,'dye-service',[-25+i*6,-55],[]);
 for(let i=0;i<2;i++) {
  ensure(`WATER-0${i+1}`,'water_treatment',`Su Arıtma ${i+1}`,'dye-service',[1+i*10,-55],[]);
  ensure(`AIR-0${i+1}`,'compressor',`Kompresör ${i+1}`,'dye-service',[23+i*11,-55],[]);
 }
 const boiler=result.machines.find(m=>m.type==='boiler');
 if(boiler && boiler.params.steamCapKgH===undefined)boiler.params.steamCapKgH=32000;
 const entry=result.machines.find(m=>m.id==='ENTRY-01');
 if(entry && entry.params.spawnSec===undefined)entry.params.spawnSec=30;
 const dyeMachineIds=new Set(result.machines.filter(m=>['dyehouse','dyeprep','finishing','quality'].includes(m.area)).map(m=>m.id));
 result.utilityRoutes=(result.utilityRoutes??[]).filter(r=>!dyeMachineIds.has(r.to));
 for(const m of result.machines.filter(m=>dyeMachineIds.has(m.id))) {
  if(boiler && ['ht_jet','stenter','dryer'].includes(m.type))result.utilityRoutes.push({from:boiler.id,to:m.id,kind:'steam',height:8,points:[[boiler.position[0],boiler.position[2]],[-28,-61],[-28,-41],[m.position[0],-41],[m.position[0],m.position[2]]]});
  if(m.type==='ht_jet') {
   const src=result.machines.find(m=>m.id===`DYEPREP-0${m.position[2]===-47?1:2}`)!;
   result.utilityRoutes.push({from:src.id,to:m.id,kind:'dye',height:7.6,points:[[src.position[0],src.position[2]],[-30,src.position[2]],[-30,-29],[m.position[0],-29],[m.position[0],m.position[2]]]});
  }
 }
 result.dyeRevision=1;
 return result;
}
