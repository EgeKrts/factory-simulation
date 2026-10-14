import type { Layout,PowerSnapshot } from './types';

export function solarSlots(b:{id:string;center:[number,number];size:[number,number];height:number}){
 const slots:{x:number;y:number;z:number;angle:number}[]=[],[w,d]=b.size,[cx,cz]=b.center,angle=Math.atan2(2,d/2);
 for(let x=-w/2+2;x<w/2-2;x+=1.35)for(let z=-d/2+2.4;z<d/2-2.4;z+=2.5){
  if(Math.abs(z)<2.3)continue;
  let obstructed=false;for(let sx=-w/2+6;sx<w/2-4;sx+=10)if(Math.abs(x-sx)<2.7&&Math.abs(z+d/4)<2.2)obstructed=true;
  if(b.id==='utility'&&Math.abs(x-6)<2.5&&Math.abs(z-7)<2.5)obstructed=true;
  if(!obstructed)slots.push({x:cx+x,y:b.height+2*(1-Math.abs(z)/(d/2))+.2,z:cz+z,angle:Math.sign(z)*angle});
 }return slots;
}
export function solarPeak(layout:Layout){return(layout.buildings??[]).reduce((n,b)=>n+solarSlots(b).length*.55,0);}
export function upgradeSolar(input:Layout):Layout{
 if(input.solarRevision===1||!input.buildings)return input;
 const l=structuredClone(input);l.solarRevision=1;
 l.buildings!.push({id:'power',name:'07 · GÜNEŞ / BATARYA MERKEZİ',center:[0,-74],size:[18,14],height:5.5,color:'#45788a',doors:[{id:'power-door',side:'north',offset:0,width:4,height:3}]});
 l.areas.push({id:'power',name:'GÜNEŞ / BATARYA MERKEZİ',buildingId:'power',center:[0,-74],size:[18,14],color:'#5dbbc0'}, {id:'grid',name:'TRAFO / ŞEBEKE',center:[-13,-74],size:[5,10],color:'#dbbb66'});
 l.outdoors!.push({id:'grid-yard',name:'Trafo servis avlusu',center:[-13,-74],size:[5,10],kind:'yard'});
 const add=(id:string,type:'inverter'|'battery'|'switchgear'|'transformer',name:string,x:number,z:number,params:Record<string,number>={})=>l.machines.push({id,type,name,area:type==='transformer'?'grid':'power',position:[x,0,z],rotationY:0,params:{mtbfH:120,mttrMin:20,queueCap:0,...params},next:[]});
 for(let i=0;i<2;i++)add(`INV-0${i+1}`,'inverter',`İnverter ${i+1}`,-5,-77+i*6,{ratedKw:solarPeak(l)*.5});
 for(let i=0;i<4;i++)add(`BAT-0${i+1}`,'battery',`Batarya Kabini ${i+1}`,3+(i%2)*3,-77+Math.floor(i/2)*6,{capacityKwh:250,powerKw:100});
 add('POWER-MAIN','switchgear','Fabrika Dağıtım Panosu',0,-69,{ratedKw:2000});
 add('GRID-01','transformer','Trafo / Çift Yönlü Sayaç',-13,-74,{ratedKw:1200,exportEnabled:1,sellTlKwh:2.5,buyTlKwh:4});
 return l;
}
/** Illustrative clear-sky dispatch model. All powers are kW, stored energy is kWh. */
export class SolarDispatch {
 storedKwh=500;generatedKwh=0;exportedKwh=0;importedKwh=0;incomeTl=0;costTl=0;
 snapshot:PowerSnapshot={solarKw:0,loadKw:0,chargeKw:0,dischargeKw:0,importKw:0,exportKw:0,curtailedKw:0,unservedKw:0,storedKwh:500,capacityKwh:1000,socPct:50,generatedKwh:0,exportedKwh:0,importedKwh:0,incomeTl:0,costTl:0};
 step(dt:number,hour:number,peak:number,load:number,capacity:number,batteryKw:number,inverterKw:number,gridKw:number,exportEnabled:boolean,sell:number,buy:number){
  const hours=dt/3600,eta=.96;this.storedKwh=Math.min(capacity,this.storedKwh);
  const solar=Math.min(peak*Math.max(0,Math.sin((hour-6)/12*Math.PI))*.88,inverterKw);
  let surplus=Math.max(0,solar-load),need=Math.max(0,load-solar);
  const charge=Math.min(surplus,batteryKw,hours>0?(capacity-this.storedKwh)/(eta*hours):0);surplus-=charge;
  const discharge=Math.min(need,batteryKw,hours>0?this.storedKwh*eta/hours:0);need-=discharge;
  const imported=Math.min(need,gridKw),exported=exportEnabled?Math.min(surplus,gridKw):0;
  this.storedKwh=Math.max(0,Math.min(capacity,this.storedKwh+(charge*eta-discharge/eta)*hours));
  this.generatedKwh+=solar*hours;this.exportedKwh+=exported*hours;this.importedKwh+=imported*hours;this.incomeTl+=exported*hours*sell;this.costTl+=imported*hours*buy;
  return this.snapshot={solarKw:solar,loadKw:load,chargeKw:charge,dischargeKw:discharge,importKw:imported,exportKw:exported,curtailedKw:surplus-exported,unservedKw:need-imported,storedKwh:this.storedKwh,capacityKwh:capacity,socPct:capacity?this.storedKwh/capacity*100:0,generatedKwh:this.generatedKwh,exportedKwh:this.exportedKwh,importedKwh:this.importedKwh,incomeTl:this.incomeTl,costTl:this.costTl};
 }
}
