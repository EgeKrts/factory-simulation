import type { MachineDef, MachineState, Status } from './types';
import { param, specOf } from './machineTypes';

// Illustrative operating rates; editable per machine, not measured meter data.
const electric: Record<string, number> = {ht_jet:38,stenter:55,dryer:45,compactor:22,centrifuge:18,sew:10,boiler:18,water_treatment:12,compressor:20};
export function resourceDefaults(d: MachineDef): Record<string, number> {
  if (['inverter','battery','switchgear','transformer','slot'].includes(d.type)) return {};
  const defaults: Record<string, number> = {electricKw:electric[d.type]??3};
  if(d.type==='cart')defaults.electricKw=0;
  if(d.type==='ht_jet')defaults.waterM3H=12;
  if(d.type==='dyeprep')defaults.waterM3H=2;
  if(d.type==='boiler'){defaults.waterM3H=0;defaults.gasNm3PerKgSteam=.08;}
  if(specOf(d).utilities.includes('steam'))defaults.steamKgH=param(d,'steamKgH');
  if(d.type==='iron'||d.type==='compactor')defaults.steamKgH=d.type==='iron'?80:150;
  return defaults;
}
export function machineElectricKw(d: MachineDef, status: Status, down=false): number {
  const base=resourceDefaults(d).electricKw;
  return down||base===undefined?0:(d.params.electricKw??base)*(status==='RUNNING'?1:.15);
}
export function machineResources(d: MachineDef,status: Status,down:boolean,hasJob:boolean,steamDraw:number,steamLoad=0): NonNullable<MachineState['resources']> | undefined {
  const defaults=resourceDefaults(d);if(defaults.electricKw===undefined)return;
  const running=status==='RUNNING'&&!down;
  const flow=running&&(hasJob||specOf(d).role==='utility');
  const r:NonNullable<MachineState['resources']>={electricityKw:machineElectricKw(d,status,down)};
  if('waterM3H' in defaults)r.waterM3H=flow?(d.type==='boiler'?steamLoad/1000*1.05:d.params.waterM3H??defaults.waterM3H):0;
  if('steamKgH' in defaults)r.steamKgH=flow?steamDraw:0;
  if(d.type==='boiler')r.gasNm3H=flow?steamLoad*(d.params.gasNm3PerKgSteam??defaults.gasNm3PerKgSteam):0;
  return r;
}
