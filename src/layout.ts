import type { AreaDef, BuildingDef, Layout, MachineDef, Point2 } from './types';
import { TYPES, specOf, param } from './machineTypes';
import { queuePos } from './geometry';
import { upgradeDyeHall } from './dyeLayout';
import { upgradeReceivingHall } from './receivingLayout';
import { upgradeRawWarehouse } from './rawLayout';
import { upgradeShippingWarehouse } from './shippingLayout';
import { upgradeEnergyCentre } from './energyLayout';
import { upgradeSolar } from './solar';

const building = (id: string, name: string, center: Point2, size: Point2, height: number, color: string, side: 'north' | 'south' | 'west' = 'south'): BuildingDef => ({
  id, name, center, size, height, color, doors: [{ id: `${id}-load`, side, offset: 0, width: 8, height: 5 }],
});

export function createCampus(legacy: Layout): Layout {
  const buildings = [
    building('receiving', '01 · MAL KABUL', [-87, -42], [32, 30], 8, '#577082'),
    building('raw', '02 · HAM KUMAŞ DEPOSU', [-87, 35], [32, 40], 9, '#637888', 'north'),
    building('dye', '03 · BOYAHANE', [-28, -34], [54, 50], 10, '#3d7b8a'),
    building('finish', '04 · APRE / KALİTE', [63, -34], [58, 48], 9, '#657d83'),
    building('garment', '05 · KONFEKSİYON', [62, 42], [56, 50], 8, '#698574', 'north'),
    building('warehouse', '06 · MAMUL / SEVKİYAT', [-27, 43], [54, 46], 11, '#ad8b53', 'north'),
    building('utility', '07 · ENERJİ MERKEZİ', [-28, -72], [22, 16], 12, '#8b7971', 'west'),
  ];
  buildings[5].doors.push({ id: 'warehouse-dock', side: 'south', offset: 0, width: 9, height: 5 });
  buildings[2].rooms = [{ name: 'BOYA HAZIRLAMA', center: [-44, -21], size: [17, 20], doorZ: -21 }];
  const defs: [string, string, string | undefined, Point2, Point2, string][] = [
    ['receiving', 'MAL KABUL', 'receiving', [-87, -42], [32, 30], '#89a9c0'],
    ['inbound', 'HAM KUMAŞ DEPOSU', 'raw', [-87, 35], [32, 40], '#89a9c0'],
    ['dyehouse', 'BOYAHANE', 'dye', [-28, -34], [54, 50], '#55b8c4'],
    ['dyeprep', 'BOYA HAZIRLAMA', 'dye', [-44, -21], [17, 20], '#77b4ae'],
    ['finishing', 'APRE', 'finish', [59, -34], [50, 48], '#e4a56d'],
    ['quality', 'FİNAL KALİTE', 'finish', [77, -23], [18, 18], '#ad92c4'],
    ['garment', 'KONFEKSİYON', 'garment', [62, 42], [56, 50], '#82b897'],
    ['warehouse', 'MAMUL DEPO', 'warehouse', [-27, 43], [54, 46], '#e6bf72'],
    ['shipping', 'SEVKİYAT AVLUSU', undefined, [-27, 73], [52, 14], '#6cbeb5'],
    ['utilities', 'ENERJİ MERKEZİ', 'utility', [-28, -72], [22, 16], '#c5ad93'],
  ];
  const areas: AreaDef[] = defs.map(([id, name, buildingId, center, size, color]) => ({ id, name, buildingId, center, size, color }));
  const positions: Record<string, Point2> = {
    'ENTRY-01': [-88, -43], 'RAWSTORE-01': [-86, 31], 'INSP-01': [-43, -42], 'CART-01': [-33, -42],
    'HT-01': [-20, -47], 'HT-02': [-20, -38], 'HT-03': [-20, -29], 'HT-04': [-20, -20], 'CART-02': [-8, -33],
    'STENTER-01': [55, -42], 'COMPACT-01': [74, -42], 'INSP-02': [77, -23], 'CUT-01': [48, 27],
    'SEW-01': [66, 26], 'SEW-02': [66, 37], 'SEW-03': [66, 48], 'IRON-01': [77, 58], 'GQC-01': [63, 58], 'PACK-01': [48, 58],
    'PALLET-01': [-43, 37], 'WH-01': [-22, 46], 'DOCK-01': [-27, 64], 'TRUCK-01': [-27, 77],
    'BOILER-01': [-28, -72], 'DYEPREP-01': [-44, -21], 'SLOT-WET-1': [-8, -47], 'SLOT-WET-2': [-8, -19],
    'SLOT-FIN-1': [53, -23], 'SLOT-POSTQC': [77, -51],
  };
  const remapArea = (m: MachineDef) => m.type === 'raw_entry' ? 'receiving' : m.type === 'dyeprep' ? 'dyeprep' : m.area;
  const machines = legacy.machines.map((m) => {
    const area = remapArea(m);
    const old = legacy.areas.find((a) => a.id === m.area);
    const next = areas.find((a) => a.id === area);
    const p = positions[m.id] ?? [m.position[0] + (next?.center[0] ?? 0) - (old?.center[0] ?? 0), m.position[2] + (next?.center[1] ?? 0) - (old?.center[1] ?? 0)];
    return { ...m, area, position: [p[0], 0, p[1]] as [number, number, number], rotationY: ['dock', 'truck_out'].includes(m.type) ? -Math.PI / 2 : m.rotationY, params: { ...m.params }, next: [...m.next] };
  });
  const roads: NonNullable<Layout['roads']> = [
    { id: 'spine', points: [[-108, 3], [108, 3]], width: 12 },
    { id: 'west-service', points: [[-62, -87], [-62, 89]], width: 10 },
    { id: 'east-service', points: [[20, -87], [20, 79]], width: 10 },
    { id: 'ring', points: [[-108, 79], [-108, -87], [108, -87], [108, 79], [-108, 79]], width: 6 },
    { id: 'entry', points: [[-62, 79], [-62, 103]], width: 10 },
    { id: 'public', points: [[-180, 103], [180, 103]], width: 12, public: true },
  ];
  const outdoors: NonNullable<Layout['outdoors']> = [
    { id: 'receive-yard', name: 'Mal kabul avlusu', center: [-87, -15], size: [24, 26], kind: 'yard' },
    { id: 'raw-yard', name: 'Ham depo yaklaşımı', center: [-87, 12], size: [20, 8], kind: 'yard' },
    { id: 'dye-yard', name: 'Boyahane yaklaşımı', center: [-28, -4], size: [20, 14], kind: 'yard' },
    { id: 'finish-yard', name: 'Apre yaklaşımı', center: [63, -3], size: [20, 16], kind: 'yard' },
    { id: 'garment-yard', name: 'Konfeksiyon yaklaşımı', center: [62, 12], size: [20, 12], kind: 'yard' },
    { id: 'warehouse-yard', name: 'Depo yaklaşımı', center: [-27, 14], size: [20, 14], kind: 'yard' },
    { id: 'shipping-yard', name: 'Sevkiyat avlusu', center: [-27, 73], size: [52, 14], kind: 'yard' },
    { id: 'utility-yard', name: 'Enerji servis alanı', center: [-49, -72], size: [28, 12], kind: 'yard' },
    { id: 'parking', name: 'Personel / ziyaretçi', center: [74, 79], size: [40, 12], kind: 'parking' },
  ];
  const utilityRoutes: NonNullable<Layout['utilityRoutes']> = [];
  const boiler = machines.find((m) => m.type === 'boiler');
  const prep = machines.find((m) => m.type === 'dyeprep');
  for (const m of machines) for (const kind of specOf(m).utilities) {
    const src = kind === 'steam' ? boiler : prep;
    if (!src) continue;
    const points: Point2[] = kind === 'steam'
      ? [[src.position[0], src.position[2]], [-2, -72], [-2, -61], [m.position[0], -61], [m.position[0], m.position[2]]]
      : [[src.position[0], src.position[2]], [-35, -21], [-35, m.position[2]], [m.position[0], m.position[2]]];
    utilityRoutes.push({ from: src.id, to: m.id, kind, points, height: kind === 'steam' ? 8 : 6.5 });
  }
  return upgradeSolar(upgradeEnergyCentre(upgradeShippingWarehouse(upgradeRawWarehouse(upgradeReceivingHall(upgradeDyeHall(upgradeGarmentHall(combineProcessingBuildings({ version: 2, floor: { center: [0, 0], size: [240, 180] }, areas, machines, buildings, roads, outdoors, utilityRoutes }))))))));
}

/** Install the reference sewing hall once. Preserve parameters and nonstandard branches. */
export function upgradeGarmentHall(input: Layout): Layout {
  if (input.garmentRevision === 1) {
    if(input.machines.some(m=>m.id==='FORM-01') && input.machines.some(m=>m.type==='boiler') && !input.utilityRoutes?.some(r=>r.to==='FORM-01')) {
      const repaired=structuredClone(input); connectGarmentSteam(repaired); return repaired;
    }
    return input;
  }
  if (!input.machines.some((m) => m.id === 'CUT-01') || !input.buildings?.some((b) => b.id === 'garment')) return input;
  const result = structuredClone(input);
  const positions: Record<string, Point2> = { 'CUT-01':[46,28], 'SEW-01':[65,31], 'SEW-02':[65,40], 'SEW-03':[65,49], 'GQC-01':[45,59], 'IRON-01':[57,59], 'PACK-01':[81,64] };
  for (const m of result.machines) if (positions[m.id]) {
    const p = positions[m.id]; m.position = [p[0],0,p[1]]; m.rotationY = 0;
    if (m.id === 'CUT-01') m.name = '01 · Kesim';
    if (m.type === 'sew') m.name = `0${Number(m.id.slice(-2)) + 1} · Dikim Bandı ${Number(m.id.slice(-2))}`;
    if (m.id === 'GQC-01') m.name = '06 · Konfeksiyon Son Kalite Kontrol';
    if (m.id === 'IRON-01') m.name = '07 · Ütü';
    if (m.id === 'PACK-01') m.name = '08 · Paketleme / Koli';
  }
  const add = (id: string, type: MachineDef['type'], name: string, position: Point2, next: string[], rotationY = 0) => {
    if (!result.machines.some((m) => m.id === id)) result.machines.push({ id,type,name,area:'garment',position:[position[0],0,position[1]],rotationY,params:{},next });
  };
  add('SPREAD-01','spread','01 · Kumaş Serim',[46,20],['CUT-01']);
  add('HANGER-01','hanger','05 · Askı Taşıma Sistemi',[83,39],['GQC-01'],Math.PI / 2);
  add('FORM-01','form_finish','07 · Form Finisher',[69,59],['CONVEYOR-01']);
  add('CONVEYOR-01','conveyor','08 · Rulo Konveyör',[81,59],['PACK-01']);
  const replace = (id: string, previous: string, next: string) => {
    const m = result.machines.find((m) => m.id === id); if (m) m.next = m.next.map((n) => n === previous ? next : n);
  };
  replace('INSP-02','CUT-01','SPREAD-01');
  for (const id of ['SEW-01','SEW-02','SEW-03']) replace(id,'IRON-01','HANGER-01');
  replace('GQC-01','PACK-01','IRON-01'); replace('IRON-01','GQC-01','FORM-01');
  connectGarmentSteam(result);
  result.garmentRevision = 1;
  return result;
}
function connectGarmentSteam(layout:Layout) {
  const boiler=layout.machines.find(m=>m.type==='boiler'),form=layout.machines.find(m=>m.id==='FORM-01');
  if(boiler && form && !layout.utilityRoutes?.some(r=>r.to===form.id)) {
    layout.utilityRoutes??=[];
    layout.utilityRoutes.push({from:boiler.id,to:form.id,kind:'steam',height:6.5,points:[[boiler.position[0],boiler.position[2]],[-2,-72],[-2,-61],[20,-61],[20,3],[form.position[0],3],[form.position[0],form.position[2]]]});
  }
}

/** Consolidate the wet and finishing halls without relocating equipment or losing user parameters. */
export function combineProcessingBuildings(input: Layout): Layout {
  const dye = input.buildings?.find((b) => b.id === 'dye'), finish = input.buildings?.find((b) => b.id === 'finish');
  if (!dye || !finish) return input;
  const result = structuredClone(input);
  const minX = Math.min(dye.center[0] - dye.size[0] / 2, finish.center[0] - finish.size[0] / 2);
  const maxX = Math.max(dye.center[0] + dye.size[0] / 2, finish.center[0] + finish.size[0] / 2);
  const minZ = Math.min(dye.center[1] - dye.size[1] / 2, finish.center[1] - finish.size[1] / 2);
  const maxZ = Math.max(dye.center[1] + dye.size[1] / 2, finish.center[1] + finish.size[1] / 2);
  const combined = result.buildings!.find((b) => b.id === 'dye')!;
  combined.center = [(minX + maxX) / 2, (minZ + maxZ) / 2]; combined.size = [maxX - minX, maxZ - minZ];
  combined.height = Math.max(dye.height, finish.height); combined.name = '03 · BOYAHANE / APRE / KALİTE';
  combined.rooms = [...(dye.rooms ?? []), ...(finish.rooms ?? [])];
  combined.doors = [dye, finish].flatMap((b) => b.doors.filter((d) =>
    d.side === 'north' || d.side === 'south' || (d.side === 'west' && b.center[0] - b.size[0] / 2 === minX) || (d.side === 'east' && b.center[0] + b.size[0] / 2 === maxX)
  ).map((d) => ({ ...d, offset: d.offset + (d.side === 'north' || d.side === 'south' ? b.center[0] - combined.center[0] : b.center[1] - combined.center[1]) })));
  result.buildings = result.buildings!.filter((b) => b.id !== 'finish');
  result.buildings.forEach((b, i) => { b.name = b.name.replace(/^\d+\s*·/, `${String(i + 1).padStart(2, '0')} ·`); });
  result.areas.forEach((a) => { if (a.buildingId === 'finish') a.buildingId = 'dye'; });
  // Replace the old road through the gap with its exterior northern/southern sections.
  result.roads = result.roads?.flatMap((r) => {
    if (r.id !== 'east-service' || r.points.length !== 2) return [r];
    const x = r.points[0][0]; if (x <= minX || x >= maxX) return [r];
    const z0 = Math.min(r.points[0][1], r.points[1][1]), z1 = Math.max(r.points[0][1], r.points[1][1]);
    const roads = [];
    if (z0 < minZ - 7) roads.push({ ...r, id: `${r.id}-north`, points: [[x, z0], [x, minZ - 7]] as Point2[] });
    if (z1 > maxZ + 7) roads.push({ ...r, points: [[x, maxZ + 12], [x, z1]] as Point2[] });
    return roads;
  });
  return result;
}

export function buildingOf(layout: Layout, machine: MachineDef): BuildingDef | undefined {
  const id = layout.areas.find((a) => a.id === machine.area)?.buildingId;
  return layout.buildings?.find((b) => b.id === id);
}

export function doorPosition(b: BuildingDef, d: BuildingDef['doors'][number]): Point2 {
  const [x, z] = b.center, [w, depth] = b.size;
  return d.side === 'north' ? [x + d.offset, z - depth / 2] : d.side === 'south' ? [x + d.offset, z + depth / 2]
    : d.side === 'west' ? [x - w / 2, z + d.offset] : [x + w / 2, z + d.offset];
}

export function placementErrors(layout: Layout, m: MachineDef): string[] {
  const errors: string[] = [];
  const b = buildingOf(layout, m);
  const [w, , depth] = specOf(m).size;
  const c = Math.abs(Math.cos(m.rotationY)), s = Math.abs(Math.sin(m.rotationY));
  const hw = (w * c + depth * s) / 2, hd = (w * s + depth * c) / 2;
  if (!b && (Math.abs(m.position[0] - layout.floor.center[0]) + hw > layout.floor.size[0] / 2 || Math.abs(m.position[2] - layout.floor.center[1]) + hd > layout.floor.size[1] / 2))
    errors.push(`${m.id}: yerleşke sınırının dışına taşıyor.`);
  if (b) {
    if (Math.abs(m.position[0] - b.center[0]) + hw + 0.6 > b.size[0] / 2 || Math.abs(m.position[2] - b.center[1]) + hd + 0.6 > b.size[1] / 2)
      errors.push(`${m.id}: ${b.name} duvarı ile çakışıyor.`);
    for (let i = 0; i < param(m, 'queueCap'); i++) {
      const p = queuePos(m, i);
      if (Math.abs(p[0] - b.center[0]) + 0.7 > b.size[0] / 2 || Math.abs(p[1] - b.center[1]) + 0.7 > b.size[1] / 2) {
        errors.push(`${m.id}: giriş kuyruğu bina dışına taşıyor.`); break;
      }
    }
  } else if (!layout.areas.some((a) => a.id === m.area)) errors.push(`${m.id}: bölüm tanımlı değil.`);
  else if (layout.areas.find((a) => a.id === m.area)?.buildingId && !b) errors.push(`${m.id}: bölümün binası bulunamadı.`);
  for (const other of layout.machines) {
    if (other.id === m.id || other.type === 'slot' || m.type === 'slot') continue;
    const [ow, , od] = specOf(other).size, oc = Math.abs(Math.cos(other.rotationY)), os = Math.abs(Math.sin(other.rotationY));
    if (Math.abs(m.position[0] - other.position[0]) < hw + (ow * oc + od * os) / 2 + 0.4 && Math.abs(m.position[2] - other.position[2]) < hd + (ow * os + od * oc) / 2 + 0.4)
      errors.push(`${m.id}: ${other.id} ile çakışıyor.`);
    for (let i = 0; i < param(m, 'queueCap'); i++) {
      const p = queuePos(m, i);
      if (Math.abs(p[0] - other.position[0]) < (ow * oc + od * os) / 2 + 0.65 && Math.abs(p[1] - other.position[2]) < (ow * os + od * oc) / 2 + 0.65) {
        errors.push(`${m.id}: giriş kuyruğu ${other.id} ile çakışıyor.`); break;
      }
    }
  }
  return errors;
}

export function parseLayout(value: unknown, defaults: Layout): Layout {
  const l = value as Layout;
  const pair = (v: unknown): boolean => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  if (!l || ![1, 2].includes(l.version) || !l.floor || !pair(l.floor.center) || !pair(l.floor.size) || !Array.isArray(l.machines) || !Array.isArray(l.areas)) throw new Error('Geçerli bir yerleşim dosyası değil.');
  const ids = new Set<string>();
  for (const m of l.machines) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.type !== 'string' || !Object.hasOwn(TYPES, m.type) || typeof m.area !== 'string' || !Array.isArray(m.position) || m.position.length !== 3 || !m.position.every(Number.isFinite) || !Number.isFinite(m.rotationY) || !m.params || !Object.values(m.params).every(Number.isFinite) || !Array.isArray(m.next) || !m.next.every((v) => typeof v === 'string')) throw new Error('Makine tanımları hatalı veya kimlikler tekrarlanıyor.');
    ids.add(m.id);
    if(m.operator && (typeof m.operator.id!=='string'||typeof m.operator.name!=='string'||!m.operator.id.trim()||!m.operator.name.trim()))throw new Error('Operatör sicili ve adı geçerli metin olmalı.');
    for(const key of ['electricKw','waterM3H','gasNm3PerKgSteam'])if(m.params[key]!==undefined&&m.params[key]<0)throw new Error('Kaynak tüketim parametreleri negatif olamaz.');
  }
  if (l.areas.some((a) => !a || typeof a.id !== 'string' || !pair(a.center) || !pair(a.size))) throw new Error('Bölüm tanımları hatalı.');
  if (l.version === 1) {
    const result = structuredClone(defaults);
    // Preserve every old machine, including custom positions relative to its old department.
    const standard = createCampus(l);
    result.machines = standard.machines;
    for (const a of l.areas) if (!result.areas.some((n) => n.id === a.id)) {
      result.areas.push(structuredClone(a));
      for (const m of result.machines.filter((m) => m.area === a.id)) {
        const original = l.machines.find((o) => o.id === m.id)!; m.position = [...original.position];
      }
    }
    for (const m of result.machines) {
      const old = l.machines.find((o) => o.id === m.id)!;
      const original = LEGACY_POSITIONS[m.id];
      if (original) { m.position[0] += old.position[0] - original[0]; m.position[2] += old.position[2] - original[1]; }
    }
    return result;
  }
  if (!Array.isArray(l.buildings) || !Array.isArray(l.roads) || !Array.isArray(l.outdoors) || !Array.isArray(l.utilityRoutes)) throw new Error('Bina ve yol tanımları eksik.');
  if(l.obstacles && (!Array.isArray(l.obstacles) || l.obstacles.some(o=>!o || typeof o.id!=='string' || !pair(o.center) || !pair(o.size) || o.size.some(v=>v<=0))))throw new Error('Sabit ekipman engelleri hatalı.');
  const buildingIds = new Set<string>();
  for (const b of l.buildings) {
    if (!b || typeof b.id !== 'string' || buildingIds.has(b.id) || typeof b.name !== 'string' || typeof b.color !== 'string' || !pair(b.center) || !pair(b.size) || b.size.some((v) => v <= 0) || !Number.isFinite(b.height) || b.height <= 0 || !Array.isArray(b.doors) || b.doors.some((d) => !d || !['north', 'south', 'east', 'west'].includes(d.side) || !Number.isFinite(d.offset) || !Number.isFinite(d.width) || !(d.width > 0) || !Number.isFinite(d.height) || !(d.height > 0) || d.height > b.height || Math.abs(d.offset) + d.width / 2 > b.size[d.side === 'north' || d.side === 'south' ? 0 : 1] / 2)) throw new Error('Bina veya kapı tanımı hatalı.');
    if (b.rooms && (!Array.isArray(b.rooms) || b.rooms.some((r) => !r || typeof r.name !== 'string' || !pair(r.center) || !pair(r.size) || r.size.some((v) => v <= 0) || !Number.isFinite(r.doorZ)))) throw new Error('İç bölme tanımı hatalı.');
    buildingIds.add(b.id);
  }
  for (const r of l.roads) if (!Number.isFinite(r.width) || !(r.width > 0) || !Array.isArray(r.points) || r.points.length < 2 || !r.points.every(pair)) throw new Error('Yol tanımı hatalı.');
  for (const a of l.outdoors) if (!pair(a.center) || !pair(a.size) || a.size.some((v) => v <= 0) || !['yard','parking','walkway'].includes(a.kind)) throw new Error('Dış saha tanımı hatalı.');
  for (const r of l.utilityRoutes) if (!Array.isArray(r.points) || !r.points.every(pair) || !Number.isFinite(r.height)) throw new Error('Boru güzergâhı hatalı.');
  return structuredClone(l);
}

const LEGACY_POSITIONS: Record<string, Point2> = {
  'ENTRY-01': [-52,-12], 'RAWSTORE-01': [-44,-12], 'INSP-01': [-34,-12], 'CART-01': [-26,-12],
  'HT-01': [-14,-25], 'HT-02': [-14,-18], 'HT-03': [-14,-6], 'HT-04': [-14,1], 'CART-02': [-4,-12],
  'STENTER-01': [8,-12], 'COMPACT-01': [22,-12], 'INSP-02': [33,-12], 'CUT-01': [44,-6],
  'SEW-01': [46,1], 'SEW-02': [46,8], 'SEW-03': [46,15], 'IRON-01': [46,22], 'GQC-01': [36,22], 'PACK-01': [27,22],
  'PALLET-01': [16,22], 'WH-01': [0,24], 'DOCK-01': [-20,22], 'TRUCK-01': [-38,22], 'BOILER-01': [-6,-37], 'DYEPREP-01': [-24,-37],
  'SLOT-WET-1': [-4,-23], 'SLOT-WET-2': [-4,-2], 'SLOT-FIN-1': [22,-23], 'SLOT-POSTQC': [33,-23],
};

