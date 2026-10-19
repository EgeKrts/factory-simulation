import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { Layout } from './types';
import { createCampus, parseLayout, placementErrors, doorPosition, combineProcessingBuildings, buildingOf, upgradeGarmentHall } from './layout';
import { CampusRouter, pathLength, routeErrors, samplePath } from './routes';
import { FactorySim } from './sim';
import { transferDuration } from './transport';
import { upgradeDyeHall } from './dyeLayout';
import { upgradeReceivingHall } from './receivingLayout';
import { queuePos } from './geometry';
import { upgradeRawWarehouse, rawLotCells } from './rawLayout';
import { upgradeShippingWarehouse,shippingCells } from './shippingLayout';
import { upgradeEnergyCentre,energyEquipment } from './energyLayout';
import { SolarDispatch,solarPeak,solarSlots,upgradeSolar } from './solar';

const layout = JSON.parse(readFileSync('public/layouts/default.layout.json', 'utf8')) as Layout;
const jobLayout=structuredClone(layout);delete jobLayout.solarRevision;
jobLayout.machines=jobLayout.machines.filter(m=>['HT-01','BOILER-01'].includes(m.id));
// Select the first jet by type so the assertion survives layout naming changes.
const jetDef=structuredClone(layout.machines.find(m=>m.type==='ht_jet')!);
jetDef.next=[];jetDef.operator={id:'OP-007',name:'Test Operatörü'};jetDef.params.electricKw=40;
jobLayout.machines=[jetDef,structuredClone(layout.machines.find(m=>m.type==='boiler')!)];
const jobs=new FactorySim(jobLayout);jobs.faultsEnabled=false;
const jet=jobs.stations.get(jetDef.id)!;
jet.current={id:'PARTI-001',kind:'raw_roll',color:'#fff',target:'#123',kg:500};jet.progress=.2;jet.duration=100;
jobs.step(10);
let jobState=jobs.snapshot().machines.find(m=>m.id===jetDef.id)!;
assert.equal(jobState.currentLotId,'PARTI-001');assert.equal(jobState.operator?.id,'OP-007');
assert.equal(jobState.resources?.electricityKw,40);assert.equal(jobState.resources?.waterM3H,12);
assert(Math.abs(jobState.job!.electricityKwh-40*10/3600)<1e-8);
assert(Math.abs(jobState.job!.steamKg-paramSteam(jetDef)*10/3600)<1e-8);
const beforeFault=jobState.job!.electricityKwh;jobs.toggleFault(jetDef.id);jobs.step(10);
jobState=jobs.snapshot().machines.find(m=>m.id===jetDef.id)!;
assert.equal(jobState.resources?.electricityKw,0);assert.equal(jobState.resources?.waterM3H,0);assert.equal(jobState.job!.electricityKwh,beforeFault);
jobs.toggleFault(jetDef.id);jet.progress=.99;jobs.step(10);
jobState=jobs.snapshot().machines.find(m=>m.id===jetDef.id)!;
assert.equal(jobState.currentLotId,undefined);assert.equal(jobState.job!.lotId,'PARTI-001');assert(jobState.job!.finishedAt!==undefined);
jet.out=null;jet.current={id:'PARTI-002',kind:'raw_roll',color:'#fff',target:'#123',kg:400};jet.progress=0;jobs.step(1);
jobState=jobs.snapshot().machines.find(m=>m.id===jetDef.id)!;
assert.equal(jobState.job!.lotId,'PARTI-002');assert(jobState.job!.electricityKwh<beforeFault);
assert(jobs.snapshot().machines.find(m=>m.id==='BOILER-01')!.resources?.gasNm3H!==undefined);
function paramSteam(d:{params:Record<string,number>}){return d.params.steamKgH??1800;}
console.log('PASS: active batch, assigned operator, per-job resource integration, fault pause and next-job reset.');
assert.equal(layout.version, 2);
assert.equal(upgradeSolar(layout),layout,'Solar upgrade must preserve edited saved layouts.');
assert(solarPeak(layout)>500);
for(const b of layout.buildings!)for(const p of solarSlots(b)){assert(Math.abs(p.x-b.center[0])+1.17/2<b.size[0]/2);assert(Math.abs(p.z-b.center[1])+2.24/2<b.size[1]/2);assert(Math.abs(p.z-b.center[1])>=2.3);}
const dispatch=new SolarDispatch();dispatch.storedKwh=0;
let power=dispatch.step(3600,12,1000,200,1000,400,1000,1200,true,2.5,4);
assert.equal(power.chargeKw,400);assert.equal(power.exportKw,280);assert.equal(power.storedKwh,384);assert.equal(power.incomeTl,700);
power=dispatch.step(3600,0,1000,300,1000,400,1000,1200,true,2.5,4);
assert.equal(power.solarKw,0);assert.equal(power.dischargeKw,300);assert.equal(power.importKw,0);
dispatch.storedKwh=0;power=dispatch.step(3600,0,1000,300,1000,400,1000,1200,true,2.5,4);assert.equal(power.importKw,300);
dispatch.storedKwh=1000;power=dispatch.step(3600,12,1000,200,1000,400,1000,1200,false,2.5,4);assert.equal(power.exportKw,0);assert.equal(power.curtailedKw,680);
assert(Math.abs(power.solarKw+power.dischargeKw+power.importKw-power.loadKw-power.chargeKw-power.exportKw-power.curtailedKw+power.unservedKw)<1e-8);
dispatch.storedKwh=0;power=dispatch.step(3600,0,1000,300,1000,0,0,0,true,2.5,4);assert.equal(power.unservedKw,300);
const electrical=new FactorySim(layout);electrical.faultsEnabled=false;electrical.t=21600;electrical.solar.storedKwh=1000;electrical.step(.5);
assert(electrical.snapshot().power!.exportKw>0,'Full battery at noon must export surplus through the transformer.');
electrical.toggleFault('GRID-01');electrical.step(.5);assert.equal(electrical.snapshot().power!.exportKw,0);
for(const id of ['INV-01','INV-02','BAT-01','BAT-02','BAT-03','BAT-04'])electrical.toggleFault(id);
electrical.step(.5);assert.equal(electrical.snapshot().power!.solarKw,0);assert(electrical.snapshot().power!.unservedKw>0);
assert(electrical.snapshot().machines.some(m=>m.status==='WAITING_UTILITY'));
electrical.toggleFault('GRID-01');electrical.step(.5);assert.equal(electrical.snapshot().power!.unservedKw,0);assert(electrical.snapshot().power!.importKw>0);
console.log(`PASS: ${Math.round(solarPeak(layout)/.55)} roof panels; solar balance, storage limits, night imports, export curtailment and electrical faults.`);
assert.equal(upgradeEnergyCentre(layout),layout,'Energy migration must be idempotent.');
const energyBuilding=layout.buildings!.find(b=>b.id==='utility')!;
for(const e of energyEquipment){const m=layout.machines.find(m=>m.id===e.id)!;assert.deepEqual(m.position,[energyBuilding.center[0]+e.p[0],e.id==='ENERGY-STEAM'?3.6:0,energyBuilding.center[1]+e.p[1]]);assert.equal(m.asset,`enerji-odasi/${e.file}`);}
const oldEnergy=structuredClone(layout);delete oldEnergy.energyRevision;oldEnergy.machines.find(m=>m.id==='BOILER-01')!.params.steamCapKgH=12345;
assert.equal(upgradeEnergyCentre(oldEnergy).machines.find(m=>m.id==='BOILER-01')!.params.steamCapKgH,12345);
assert.equal(layout.buildings?.length, 7);
assert(!layout.buildings?.some((b) => b.id === 'finish'));
assert.equal(buildingOf(layout, layout.machines.find((m) => m.id === 'STENTER-01')!)?.id, 'dye');
assert.equal(buildingOf(layout, layout.machines.find((m) => m.id === 'INSP-02')!)?.id, 'dye');
assert.deepEqual(layout.floor.size, [240, 209]);
assert.equal(upgradeRawWarehouse(layout),layout,'Raw warehouse migration must be idempotent.');
assert.equal(upgradeShippingWarehouse(layout),layout,'Shipping migration must be idempotent.');
const finishedStore=layout.machines.find(m=>m.id==='WH-01')!,finishedBuilding=layout.buildings!.find(b=>b.id==='warehouse')!;
shippingCells.forEach((p,i)=>assert.deepEqual(queuePos(finishedStore,i),[finishedBuilding.center[0]+p[0],finishedBuilding.center[1]+p[1]]));
const oldFinished=structuredClone(layout);delete oldFinished.shippingRevision;oldFinished.machines.find(m=>m.id==='WH-01')!.params.cycleSec=33;
assert.equal(upgradeShippingWarehouse(oldFinished).machines.find(m=>m.id==='WH-01')!.params.cycleSec,33);
const rawBuilding=layout.buildings!.find(b=>b.id==='raw')!,rawStore=layout.machines.find(m=>m.id==='RAWSTORE-01')!;
assert.deepEqual(rawBuilding.size,[32,24]);
const oldRaw=structuredClone(layout);delete oldRaw.rawRevision;oldRaw.machines.find(m=>m.id==='RAWSTORE-01')!.params.cycleSec=19;
assert.equal(upgradeRawWarehouse(oldRaw).machines.find(m=>m.id==='RAWSTORE-01')!.params.cycleSec,19,'Raw warehouse must preserve saved process parameters.');
rawLotCells.forEach((p,i)=>assert.deepEqual(queuePos(rawStore,i),[rawBuilding.center[0]+p[0],rawBuilding.center[1]+p[1]]));
assert.equal(upgradeReceivingHall(layout),layout,'Receiving migration must be idempotent.');
const receiving=layout.buildings!.find(b=>b.id==='receiving')!;
assert.deepEqual(receiving.size,[40,28]);assert.equal(receiving.height,6);
for(const [id,x,z,r] of [['RECEIPT-REG',-18.9,-6,Math.PI/2],['RECEIPT-SCAN',-8,-3,Math.PI/2],['RECEIPT-WEIGH',5,-5,0],['RECEIPT-HOLD',15,-4,0]] as const) {
  const m=layout.machines.find(m=>m.id===id)!;
  assert(Math.abs(m.position[0]-receiving.center[0]-x)<1e-8 && Math.abs(m.position[2]-receiving.center[1]-z)<1e-8,`${id} must retain the supplied reference coordinates.`);
  assert.equal(m.rotationY,r);
}
const referenceHold=layout.machines.find(m=>m.id==='RECEIPT-HOLD')!;
for(const [i,x,z] of [[0,13.5,-5],[1,16.5,-3],[2,6,8],[3,10,10],[4,14,6.5]])assert.deepEqual(queuePos(referenceHold,i),[receiving.center[0]+x,receiving.center[1]+z]);
const oldReceiving=structuredClone(layout);delete oldReceiving.receivingRevision;
oldReceiving.machines=oldReceiving.machines.filter(m=>!m.id.startsWith('RECEIPT-'));
const oldSource=oldReceiving.machines.find(m=>m.id==='ENTRY-01')!;oldSource.next=['RAWSTORE-01','CUSTOM'];oldSource.params.spawnSec=37;
const migratedReceiving=upgradeReceivingHall(oldReceiving);
assert.equal(migratedReceiving.machines.find(m=>m.id==='ENTRY-01')!.params.spawnSec,37);
assert.deepEqual(migratedReceiving.machines.find(m=>m.id==='RECEIPT-HOLD')!.next,['RAWSTORE-01','CUSTOM']);
assert.equal(oldReceiving.receivingRevision,undefined,'Original receiving save must remain available for backup.');
assert.deepEqual(layout.machines.flatMap((m) => placementErrors(layout, m)), [], 'Default machines and their maximum queues must fit.');
const router = new CampusRouter(layout);
assert.deepEqual(routeErrors(layout, router), [], 'Every production link must have a valid path.');
for (const m of layout.machines) for (const id of m.next) {
  const route = router.route(m, layout.machines.find((n) => n.id === id)!)!;
  for (let i = 1; i < route.length; i++) assert(router.clearSegment(route[i - 1], route[i]), `${m.id}>${id}: path crosses a wall or machine`);
  assert(pathLength(route) > 0);
  assert.deepEqual(samplePath(route, 1).point, route[route.length - 1]);
}
const dye = layout.buildings!.find((b) => b.id === 'dye')!;
assert.deepEqual(dye.size, [147, 50]);
assert.equal(layout.machines.filter(m=>m.type==='ht_jet').length,12);
for(const type of ['rope_open','centrifuge','dryer','stenter','compactor'])assert.equal(layout.machines.filter(m=>m.type===type).length,3,`${type} must have three working machines.`);
assert.equal(upgradeDyeHall(layout),layout,'Dye plant upgrade must be idempotent.');
const priorDye=structuredClone(layout);delete priorDye.dyeRevision;
priorDye.machines.find(m=>m.id==='HT-01')!.params.capacityKg=371;
priorDye.machines.find(m=>m.id==='HT-01')!.next.push('CUSTOM-OUT');
const renewed=upgradeDyeHall(priorDye);
assert.equal(renewed.machines.find(m=>m.id==='HT-01')!.params.capacityKg,371);
assert(renewed.machines.find(m=>m.id==='HT-01')!.next.includes('CUSTOM-OUT'));
assert.equal(priorDye.dyeRevision,undefined,'Dye upgrade must preserve the backup source.');
const oldCampus = structuredClone(layout);
const oldDye = oldCampus.buildings!.find((b) => b.id === 'dye')!;
oldDye.center = [-28,-34]; oldDye.size = [54,50]; oldDye.doors = [{ id:'dye-load', side:'south', offset:0, width:8, height:5 }];
oldCampus.buildings!.push({ id:'finish', name:'APRE', center:[63,-34], size:[58,48], height:9, color:'#657d83', doors:[{ id:'finish-load', side:'south', offset:0, width:8, height:5 }] });
oldCampus.areas.filter((a) => ['finishing','quality'].includes(a.id)).forEach((a) => a.buildingId = 'finish');
const merged = combineProcessingBuildings(oldCampus);
assert.equal(merged.buildings?.length, 7); assert.deepEqual(merged.machines, oldCampus.machines);
assert.equal(oldCampus.buildings?.length, 8, 'Merge must preserve its source backup.');
assert.equal(combineProcessingBuildings(merged), merged, 'Merge must be idempotent.');
assert(!router.isWalkable([dye.center[0] - dye.size[0] / 2, dye.center[1]]), 'Solid walls must block travel.');
assert(router.isWalkable(doorPosition(dye, dye.doors[0])), 'Loading door must admit travel.');
const blocked = structuredClone(layout);
blocked.buildings!.find((b) => b.id === 'dye')!.doors = [];
assert(new CampusRouter(blocked).route(blocked.machines.find((m) => m.id === 'RAWSTORE-01')!, blocked.machines.find((m) => m.id === 'INSP-01')!) === null, 'No doors means no inter-building transfer.');
const moved = structuredClone(layout.machines[0]); moved.position = [200, 0, 200];
assert(placementErrors(layout, moved).length > 0);
assert.deepEqual(parseLayout(JSON.parse(JSON.stringify(layout)), layout), layout, 'JSON export/import must retain all campus data.');
assert.throws(() => parseLayout({ version: 2 }, layout));
const duplicate = structuredClone(layout); duplicate.machines.push(duplicate.machines[0]);
assert.throws(() => parseLayout(duplicate, layout));

// Construct a minimal legacy custom layout: all custom metadata and department-relative positions survive.
const legacy: Layout = { version: 1, floor: { size: [126,80], center: [-1,-7] }, areas: [{ id: 'inbound', name: 'HAM', color: '#fff', center: [-49,-12], size: [22,16] }], machines: [
  { ...structuredClone(layout.machines.find((m) => m.id === 'RAWSTORE-01')!), area: 'inbound', position: [-41,0,-10], params: { queueCap: 7 }, next: [] },
  { ...structuredClone(layout.machines.find((m) => m.id === 'RAWSTORE-01')!), id: 'CUSTOM-01', area: 'inbound', position: [-48,0,-11], params: { cycleSec: 9 }, next: ['RAWSTORE-01'] },
] };
const migrated = parseLayout(legacy, layout);
assert.equal(migrated.machines.filter(m=>!['power','grid'].includes(m.area)).length, 2);
assert.deepEqual(migrated.machines[0].position, [-94,0,46]);
assert.deepEqual(migrated.machines[0].params, { queueCap: 7, rawReference:1 });
assert.deepEqual(migrated.machines[1].next, ['RAWSTORE-01']);
assert.deepEqual(migrated.machines[1].position, [-86,0,36]);
assert.equal(legacy.version, 1, 'Migration must not modify its source backup.');
assert.equal(createCampus(legacy).version, 2);
assert.equal(upgradeGarmentHall(layout), layout, 'Garment upgrade must be idempotent.');
const previousGarment = structuredClone(layout); delete previousGarment.garmentRevision;
previousGarment.machines = previousGarment.machines.filter(m=>!['SPREAD-01','HANGER-01','FORM-01','CONVEYOR-01'].includes(m.id));
previousGarment.machines.find(m=>m.id==='SEW-01')!.params.cycleSec=143;
const upgradedGarment = upgradeGarmentHall(previousGarment);
assert.equal(upgradedGarment.machines.find(m=>m.id==='SEW-01')!.params.cycleSec,143);
assert(!previousGarment.machines.some(m=>m.id==='HANGER-01'), 'Source garment save must remain available for backup.');

let seed = 20261007;
const originalRandom = Math.random;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
try {
  const sim = new FactorySim(structuredClone(layout)); sim.faultsEnabled = false;
  const initial=sim.snapshot();
  assert.equal(initial.kpi.wip,32,'Receiving, raw warehouse and shipping pallets must be real initial stock.');
  assert.equal(initial.lots.filter(l=>l.stationId==='WH-01').length,12);
  assert.equal(initial.lots.filter(l=>l.stationId==='RAWSTORE-01').length,12);
  for(let i=0;i<5;i++)assert(initial.lots.some(l=>l.stationId==='RECEIPT-HOLD' && l.idx===i));
  sim.step(.5);
  for(let i=0;i<70;i++)sim.step(.5);
  const rawMove=sim.transits.find(tr=>tr.from==='RAWSTORE-01');assert(rawMove,'Warehouse must supply dyehouse using physical transport.');
  const finishedMove=sim.transits.find(tr=>tr.from==='WH-01');assert(finishedMove,'Shipping stock must travel to the loading area.');
  assert(shippingCells.some((_p,i)=>JSON.stringify(queuePos(finishedStore,i))===JSON.stringify(finishedMove.route[0])));
  assert.equal(finishedMove.carrier,'forklift');
  assert(rawLotCells.some((_p,i)=>JSON.stringify(queuePos(rawStore,i))===JSON.stringify(rawMove.route[0])),'Warehouse pickup must start at the stored pallet.');
  assert.equal(rawMove.carrier,'forklift');
  const firstStockMove=sim.transits.find(tr=>tr.from==='RECEIPT-HOLD');assert(firstStockMove);
  assert.deepEqual(firstStockMove.route[0],queuePos(referenceHold,0),'Forklift must pick stock up from its actual cage cell.');
  for(let i=1;i<firstStockMove.route.length;i++)assert(router.clearSegment(firstStockMove.route[i-1],firstStockMove.route[i]),'Stock pickup must use the cage doorway.');
  const run = (seconds: number) => { for (let i = 0; i < seconds * 2; i++) sim.step(0.5); };
  run(4 * 3600);
  const before = sim.snapshot();
  for(const id of ['RECEIPT-REG','RECEIPT-SCAN','RECEIPT-WEIGH','RECEIPT-HOLD','SHIP-CONVEYOR','SHIP-LABEL','PALLET-01','WH-01','DOCK-01'])
    assert(before.machines.find(m=>m.id===id)!.counters.good>0,`${id} must process real lots.`);
  const receiptSim=new FactorySim(structuredClone(layout));receiptSim.faultsEnabled=false;
  const receiptSource=receiptSim.stations.get('ENTRY-01')!;
  for(let i=0;i<4000 && receiptSource.counters.good<8;i++)receiptSim.step(.5);
  assert.equal(receiptSource.counters.good,8);
  for(let i=0;i<190;i++)receiptSim.step(.5);
  assert.equal(receiptSource.counters.good,8,'No fabric may spawn while its delivery truck is away.');
  const receiptWeigh=receiptSim.stations.get('RECEIPT-WEIGH')!;
  const weighingLot=sim.transits[0]?.lot;assert(weighingLot);
  receiptWeigh.current={...weighingLot,kg:482};receiptWeigh.progress=.2;receiptWeigh.duration=12;receiptSim.step(.5);
  assert.equal(receiptWeigh.tele.weightKg,482,'Scale display must use the actual lot weight.');
  assert(receiptSim.transits.filter(tr=>tr.from.startsWith('RECEIPT-')||tr.from==='ENTRY-01').every(tr=>tr.carrier==='forklift'));
  for(const def of layout.machines.filter(m=>['ht_jet','rope_open','centrifuge','dryer','stenter','compactor'].includes(m.type)))
    assert(before.machines.find(m=>m.id===def.id)!.counters.good>0, `${def.id} must process real lots, not only decorate the hall.`);
  const airLayout=structuredClone(layout),airSim=new FactorySim(airLayout);airSim.faultsEnabled=false;
  const energySim=new FactorySim(layout);energySim.faultsEnabled=false;energySim.toggleFault('ENERGY-FUEL');
  for(let i=0;i<120;i++)energySim.step(.5);
  assert.equal(energySim.snapshot().machines.find(m=>m.id==='BOILER-01')!.status,'WAITING_UTILITY');
  assert(energySim.snapshot().kpi.steamBar<6.5,'Fuel skid failure must reduce boiler pressure.');
  assert.equal(energySim.snapshot().machines.find(m=>m.id==='ENERGY-STEAM')!.telemetry.pressureBar,+energySim.snapshot().kpi.steamBar.toFixed(2));
  energySim.toggleFault('ENERGY-FUEL');for(let i=0;i<120;i++)energySim.step(.5);
  assert.equal(energySim.snapshot().machines.find(m=>m.id==='BOILER-01')!.status,'RUNNING');
  const loadedStation=airSim.stations.get('HT-01')!;
  // Reuse an already circulating physical lot to isolate redundant utility behavior.
  const flowing=sim.transits[0]?.lot;
  assert(flowing);loadedStation.current={...flowing};loadedStation.progress=.3;loadedStation.duration=240;
  airSim.toggleFault('AIR-01');airSim.step(.5);
  assert.equal(airSim.snapshot().machines.find(m=>m.id==='HT-01')!.status,'RUNNING','Standby compressor must keep the plant running.');
  airSim.toggleFault('AIR-02');airSim.step(.5);
  assert.equal(airSim.snapshot().machines.find(m=>m.id==='HT-01')!.status,'WAITING_UTILITY');
  airSim.toggleFault('AIR-01');airSim.step(.5);
  assert.equal(airSim.snapshot().machines.find(m=>m.id==='HT-01')!.status,'RUNNING');
  for(const id of ['SPREAD-01','CUT-01','SEW-01','SEW-02','SEW-03','HANGER-01','GQC-01','IRON-01','FORM-01','CONVEYOR-01','PACK-01'])
    assert(before.machines.find(m=>m.id===id)!.counters.good>0, `${id} must process real production, including all three sewing lines.`);
  assert(before.kpi.producedKg > 0 && before.kpi.palletsShipped > 0, 'Production must reach shipping.');
  assert(before.kpi.wip >= 0 && before.kpi.wip <= sim.wipCap);
  for (const transit of sim.transits) {
    assert.equal(transit.dur, transferDuration(transit.route, transit.carrier));
    const snap = before.lots.find((l) => l.id === transit.lot.id)!;
    assert.deepEqual(snap.route, transit.route, 'Renderer must receive the simulator path.');
    assert.equal(snap.carrier, transit.carrier);
  }
  assert(!sim.drainEvents().some((e) => e.text.includes('güzergâhı kapalı')));
  sim.toggleFault('BOILER-01'); run(1800);
  assert(sim.snapshot().machines.some((m) => m.id.startsWith('HT-') && m.status === 'WAITING_UTILITY'));
  sim.toggleFault('BOILER-01'); run(7200);
  assert(sim.snapshot().kpi.palletsShipped > before.kpi.palletsShipped, 'Repair must resume shipping.');
  const inFlight = sim.transits[0];
  if (inFlight) {
    const path = structuredClone(inFlight.route);
    sim.layout.machines.find((m) => m.id === inFlight.from)!.position[0] += 2;
    sim.sync(); assert.deepEqual(inFlight.route, path, 'Layout edits must not teleport in-flight lots.');
  }
  console.log(`PASS: campus geometry, ${layout.machines.reduce((n,m) => n + m.next.length, 0)} routes, doors, migration, import, transfer duration, 6.5h production and boiler recovery.`);
  console.log(JSON.stringify(sim.snapshot().kpi));
} finally { Math.random = originalRandom; }

