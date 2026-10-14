import type { MachineDef } from './types';
import { specOf } from './machineTypes';
import { rawCell } from './rawLayout';
import { shippingCell } from './shippingLayout';

/** Makine yerel (x,z) koordinatını dünya (x,z) koordinatına çevirir */
export function toWorld(d: MachineDef, lx: number, lz: number): [number, number] {
  const r = d.rotationY;
  return [
    d.position[0] + lx * Math.cos(r) + lz * Math.sin(r),
    d.position[2] - lx * Math.sin(r) + lz * Math.cos(r),
  ];
}

export function inPort(d: MachineDef): [number, number] {
  if(d.params.mamulStore)return [d.position[0]-4,d.position[2]+4];
  if(d.params.rawReference)return [d.position[0]+5,d.position[2]-18];
  if (d.type === 'receipt_desk') return toWorld(d, 0, 2.8);
  if (d.type === 'receipt_hold') return toWorld(d, 0, 4.2);
  return toWorld(d, -(specOf(d).size[0] / 2 + 1.2), 0);
}

export function outPort(d: MachineDef): [number, number] {
  if(d.params.mamulStore)return inPort(d);
  if (d.type === 'receipt_desk') return toWorld(d, 0, 2.8);
  if (d.type === 'receipt_hold') return toWorld(d, 0, 4.2);
  return toWorld(d, specOf(d).size[0] / 2 + 1.2, 0);
}

/** Kuyruktaki i. ürünün dünya konumu (giriş cephesinde ızgara dizilimi) */
export function queuePos(d: MachineDef, i: number): [number, number] {
  if(d.params.mamulStore)return shippingCell(d,i);
  if(d.params.shippingDock || (d.id==='TRUCK-01' && d.area==='shipping'))return toWorld(d,-(specOf(d).size[0]/2+1.2)-Math.floor(i/3)*2,((i%3)-1)*2);
  if(d.type==='raw_store' && d.params.rawReference)return rawCell(d,i);
  if (d.type === 'receipt_scan' && d.params.referenceLayout) return i===0 ? [d.position[0]-2.5,d.position[2]+4.5] : inPort(d);
  if (d.type === 'receipt_desk') return toWorld(d, ((i%2)-.5)*2.8, 2.8+Math.floor(i/2)*1.5);
  if (d.type === 'receipt_hold' && d.params.referenceLayout) {
    const slots=[[-1.5,-1],[1.5,1],[-9,12],[-5,14],[-1,10.5]];
    const slot=slots[i];if(slot)return toWorld(d,slot[0],slot[1]);
  }
  if (d.type === 'receipt_hold') return toWorld(d, ((i % 3) - 1) * 1.3, 4.5 + Math.floor(i / 3) * 1.3);
  const w = specOf(d).size[0];
  return toWorld(d, -(w / 2 + 1.2) - Math.floor(i / 3) * 1.3, ((i % 3) - 1) * 1.3);
}

export function currentY(d: MachineDef): number {
  return Math.min(specOf(d).size[1], 1.6) + 0.45;
}
