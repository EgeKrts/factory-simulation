import type { Layout, MachineDef, Point2 } from './types';

export const rawLotCells: Point2[] = [[1,-8],[8,-8],[1,0],[8,0],[1,8],[8,8],
  [4.5,-8],[11.5,-8],[1,-4],[4.5,-4],[8,-4],[11.5,-4],
  [4.5,0],[11.5,0],[1,4],[4.5,4],[8,4],[11.5,4],[4.5,8],[11.5,8]];
export function rawCell(d: MachineDef, slot: number): Point2 {
  const cell=rawLotCells[slot]??[20+(slot-rawLotCells.length)*3,0];
  return [d.position[0]+10+cell[0],d.position[2]-9+cell[1]];
}
export function upgradeRawWarehouse(input: Layout): Layout {
  if(input.rawRevision===1 || !input.buildings?.some(b=>b.id==='raw'))return input;
  const l=structuredClone(input),b=l.buildings!.find(b=>b.id==='raw')!;
  b.size=[32,24];b.height=7.5;
  b.doors=[{id:'raw-load',side:'north',offset:8.5,width:6,height:5}];
  const area=l.areas.find(a=>a.buildingId==='raw');if(area){area.size=[...b.size];area.center=[...b.center];}
  const yard=l.outdoors?.find(a=>a.id==='raw-yard');if(yard){yard.center=[b.center[0]+5,b.center[1]-21];yard.size=[24,20];}
  const station=l.machines.find(m=>m.id==='RAWSTORE-01');
  if(station){station.position=[b.center[0]-10,0,b.center[1]+9];station.rotationY=0;station.params.rawReference=1;station.name='Stok Kontrol / Ham Kumaş Deposu';}
  l.obstacles=(l.obstacles??[]).filter(o=>!o.id.startsWith('raw-rack-'));
  for(const z of [-7,0,7])l.obstacles.push({id:`raw-rack-${z}`,center:[b.center[0]-14.3,b.center[1]+z],size:[1.2,6.95]});
  l.rawRevision=1;return l;
}
