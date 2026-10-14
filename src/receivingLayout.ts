import type { Layout, MachineDef, MachineType } from './types';

/** Add the supplied receiving line once, preserving source settings and custom downstream branches. */
export function upgradeReceivingHall(input: Layout): Layout {
  if (input.receivingRevision === 3 || !input.buildings?.some(b => b.id === 'receiving') || !input.machines.some(m => m.id === 'ENTRY-01')) return input;
  const l = structuredClone(input), entry = l.machines.find(m => m.id === 'ENTRY-01')!;
  const b = l.buildings!.find(b => b.id === 'receiving')!;
  b.center = [-91,-42]; b.size=[40,28]; b.height=6;
  b.doors=[{id:'receiving-load',side:'south',offset:-12.5,width:8,height:5}];
  const [cx,cz]=b.center;
  const dx = cx + 87, dz = cz + 42;
  const area=l.areas.find(a=>a.id==='receiving');if(area){area.center=[...b.center];area.size=[...b.size];}
  for(const road of l.roads??[]) if(road.id==='ring'||road.id==='spine') for(const point of road.points) if(point[0]===-108)point[0]=-117;
  const yard=l.outdoors?.find(a=>a.id==='receive-yard');if(yard){yard.center=[cx,-15];yard.size=[40,26];}
  entry.name = 'TIR Boşaltma / Mal Kabul Girişi';
  entry.position = [cx-12.5, 0, -14 + dz]; entry.rotationY = Math.PI; entry.area = 'receiving_unload';
  l.areas=l.areas.filter(a=>a.id!=='receiving_unload');l.areas.push({id:'receiving_unload',name:'TIR BOŞALTMA AVLUSU',center:[cx-12.5,-14+dz],size:[12,20],color:'#89a9c0'});
  const downstream = [...(l.machines.find(m=>m.id==='RECEIPT-HOLD')?.next ?? entry.next)]; entry.next = ['RECEIPT-REG'];
  const add = (id: string, type: MachineType, name: string, x: number, z: number, next: string[]) => {
    const rotationY=['RECEIPT-REG','RECEIPT-SCAN'].includes(id)?Math.PI/2:0;
    const existing=l.machines.find(m=>m.id===id);if(existing){existing.position=[x+dx,0,z+dz];existing.rotationY=rotationY;existing.params.referenceLayout=1;return;}
    const m: MachineDef = { id, type, name, area: 'receiving', position: [x + dx, 0, z + dz], rotationY, params: {referenceLayout:1}, next };
    l.machines.push(m);
  };
  add('RECEIPT-REG', 'receipt_desk', '01 · Kayıt / Barkod Kabulü', cx-18.9-dx, cz-6-dz, ['RECEIPT-SCAN']);
  add('RECEIPT-SCAN', 'receipt_scan', '02 · Kumaş Topu Girişi / Tarama', cx-8-dx, cz-3-dz, ['RECEIPT-WEIGH']);
  add('RECEIPT-WEIGH', 'receipt_scale', '03 · Kontrol / Tartım', cx+5-dx, cz-5-dz, ['RECEIPT-HOLD']);
  add('RECEIPT-HOLD', 'receipt_hold', '04 · Geçici Bekleme / Depoya Onay', cx+15-dx, cz-4-dz, downstream);
  l.receivingRevision = 3;
  l.obstacles=(l.obstacles??[]).filter(o=>!o.id.startsWith('receiving-'));
  for(const z of [-14,-8,-2,4])l.obstacles.push({id:'receiving-column-'+z,center:[cx-14.5,cz+z],size:[.5,.5]});
  l.obstacles.push({id:'receiving-safety-rail',center:[cx-3,cz-7],size:[3,.12]});
  return l;
}
