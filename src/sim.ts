import type {
  FactoryEvent, Kpi, Layout, LotKind, LotSnap, MachineDef, MachineState, Snapshot, Status,
} from './types';
import { TYPES, param, specOf } from './machineTypes';
import { CampusRouter } from './routes';
import { carrierKind, transferDuration, type CarrierKind } from './transport';
import { buildingOf } from './layout';
import type { Point2 } from './types';
import { queuePos } from './geometry';
import { SolarDispatch,solarPeak } from './solar';
import { machineElectricKw, machineResources } from './resources';

interface Lot {
  id: string;
  kind: LotKind;
  color: string;
  target: string;
  kg: number;
  parkingSlot?: number;
}

interface Transit { lot: Lot; from: string; to: string; t0: number; dur: number; route: Point2[]; carrier: CarrierKind }

class Station {
  job?: NonNullable<MachineState['job']>;
  queue: Lot[] = [];
  inbound = 0;
  current: Lot | null = null;
  out: Lot | null = null;
  progress = 0;
  duration = 1;
  timer = 0;
  deliveryReturnAt = 0;
  status: Status = 'IDLE';
  down = false;
  manualDown = false;
  repairLeft = 0;
  counters = { good: 0, reject: 0, runtimeS: 0, downtimeS: 0 };
  tele: Record<string, number> = {};
  info = '';
  steamDraw = 0;
  // utility state
  pressure = 0;
  stock = 0;
  constructor(public def: MachineDef) {}
}

const PALETTE = ['#c0392b', '#2471a3', '#1e8449', '#d4ac0d', '#7d3c98', '#e67e22', '#17202a', '#117a65', '#cb4335', '#2e4053'];
const GREIGE = '#ddd6c2';
const STEAM_MIN_BAR = 6;

export class FactorySim {
  t = 0;
  stations = new Map<string, Station>();
  transits: Transit[] = [];
  events: FactoryEvent[] = [];
  faultsEnabled = true;
  wipCap = 40;
  private lotSeq = 1;
  private lotsAlive = 0;
  private producedKg = 0;
  private palletsShipped = 0;
  private steamOk = false;
  private router!: CampusRouter;
  private routeWarnings = new Set<string>();
  readonly solar=new SolarDispatch();private powerOk=true;private peakKw=0;
  private solarMode='';

  constructor(public layout: Layout) {
    if(layout.dyeRevision===1)this.wipCap=80;
    this.sync();
    if(layout.receivingRevision === 3) {
      // The reference contains existing stock, not decorative, permanently immovable pallets.
      const stock=(kg:number,slot?:number):Lot=>({id:`L${String(this.lotSeq++).padStart(4,'0')}`,kind:'raw_roll',color:GREIGE,target:PALETTE[0],kg,parkingSlot:slot});
      const holding=this.stations.get('RECEIPT-HOLD');
      if(holding){for(let i=0;i<5;i++){holding.queue.push(stock(600+i*50,i));this.lotsAlive++;}holding.current=holding.queue.shift()!;holding.duration=30;holding.status='RUNNING';}
      const scanner=this.stations.get('RECEIPT-SCAN');
      if(scanner){scanner.queue.push(stock(650,0));scanner.current=stock(700);scanner.duration=15;scanner.status='RUNNING';this.lotsAlive+=2;}
      const scale=this.stations.get('RECEIPT-WEIGH');
      if(scale){scale.current=stock(1250.5);scale.duration=12;scale.status='RUNNING';scale.tele={weightKg:1250.5,confirmed:0};this.lotsAlive++;}
    }
    if(layout.rawRevision===1){
      const store=this.stations.get('RAWSTORE-01');
      if(store)for(const i of [0,1,2,3,4,5,6,7,12,13,18,19]){store.queue.push({id:`L${String(this.lotSeq++).padStart(4,'0')}`,kind:'raw_roll',color:GREIGE,target:PALETTE[i%PALETTE.length],kg:600+i*25,parkingSlot:i});this.lotsAlive++;}
    }
    if(layout.shippingRevision===2){const store=this.stations.get('WH-01');if(store)for(let i=0;i<12;i++){store.queue.push({id:`L${String(this.lotSeq++).padStart(4,'0')}`,kind:'pallet',color:'#b58a57',target:PALETTE[0],kg:500+i*20,parkingSlot:i});this.lotsAlive++;}}
  }

  /** Layout'a eklenen/silinen makineleri simülasyona yansıtır (mevcut durumu korur) */
  sync() {
    this.peakKw=this.layout.solarRevision?solarPeak(this.layout):0;
    this.router = new CampusRouter(this.layout);
    this.routeWarnings.clear();
    const ids = new Set(this.layout.machines.map((m) => m.id));
    for (const m of this.layout.machines) {
      const s = this.stations.get(m.id);
      if (!s) {
        const ns = new Station(m);
        if (specOf(m).role === 'utility' && m.type === 'boiler') ns.pressure = 10;
        if (m.type === 'dyeprep') ns.stock = 2;
        this.stations.set(m.id, ns);
      } else s.def = m;
    }
    for (const [id, s] of [...this.stations]) {
      if (ids.has(id)) continue;
      [s.current, s.out, ...s.queue].forEach((l) => l && this.kill(l));
      this.stations.delete(id);
      this.transits = this.transits.filter((tr) => {
        if (tr.to === id || tr.from === id) { if (tr.to === id) this.kill(tr.lot); return tr.from === id && tr.to !== id; }
        return true;
      });
    }
  }

  private kill(_l: Lot) { this.lotsAlive--; }
  private log(level: FactoryEvent['level'], text: string, machineId?: string) {
    this.events.push({ t: this.t, level, text, machineId });
  }
  private name(s: Station) { return s.def.name ?? s.def.id; }

  toggleFault(id: string) {
    const s = this.stations.get(id);
    if (!s) return;
    if (s.down) { s.down = false; s.manualDown = false; this.log('info', `${this.name(s)} manuel olarak devreye alındı`, id); }
    else this.fail(s, true);
  }

  private fail(s: Station, manual: boolean) {
    s.down = true;
    s.manualDown = manual;
    s.repairLeft = param(s.def, 'mttrMin') * 60 * (0.6 + Math.random() * 0.8);
    this.log('alarm', `${this.name(s)} ${manual ? 'durduruldu' : 'ARIZA verdi'}`, s.def.id);
  }

  private downTick(s: Station, dt: number): boolean {
    if (!s.down) return false;
    s.counters.downtimeS += dt;
    s.status = 'DOWN';
    if (!s.manualDown) {
      s.repairLeft -= dt;
      if (s.repairLeft <= 0) { s.down = false; this.log('info', `${this.name(s)} onarıldı`, s.def.id); }
    }
    return true;
  }

  private randomFault(s: Station, dt: number, active: boolean) {
    const mtbf = param(s.def, 'mtbfH');
    if (this.faultsEnabled && active && mtbf > 0 && Math.random() < dt / (mtbf * 3600)) this.fail(s, false);
  }

  step(dt: number) {
    this.t += dt;
    // yardımcı tesisler
    let load = 0;
    for (const s of this.stations.values()) load += s.steamDraw;
    let boiler: Station | undefined;
    for (const s of this.stations.values()) {
      if (s.def.type === 'boiler') { this.tickBoiler(s, dt, load); boiler ??= s; }
      else if (s.def.type === 'dyeprep') this.tickDye(s, dt);
      else if(['water_treatment','compressor','tank','inverter','battery','switchgear','transformer'].includes(s.def.type)) {
        this.randomFault(s,dt,true);
        if(!this.downTick(s,dt)) {s.status='RUNNING';s.counters.runtimeS+=dt;s.tele={available:1,pressureBar:s.def.type==='compressor'?7:3};}
        else s.tele={available:0,pressureBar:0};
      }
    }
    for(const id of ['ENERGY-STEAM','ENERGY-RETURN']){const s=this.stations.get(id);if(s)s.tele={available:s.down?0:1,pressureBar:s.down?0:+(boiler?.pressure??0).toFixed(2),steamLoadKgH:s.down?0:Math.round(load)};}
    this.steamOk = !!boiler && boiler.pressure >= STEAM_MIN_BAR;
    for (const s of this.stations.values()) s.steamDraw = 0;

    // taşımalar
    for (let i = this.transits.length - 1; i >= 0; i--) {
      const tr = this.transits[i];
      if (this.t - tr.t0 < tr.dur) continue;
      this.transits.splice(i, 1);
      const dst = this.stations.get(tr.to);
      if (!dst) { this.kill(tr.lot); continue; }
      dst.inbound--;
      dst.queue.push(tr.lot);
    }

    this.tickPower(dt);
    for (const s of this.stations.values()) {
      const role = specOf(s.def).role;
      if (role === 'source') this.tickSource(s, dt);
      else if (role === 'process' || role === 'sink') this.tickProcess(s, dt);
    }
  }

  private tickPower(dt:number){
    if(!this.layout.solarRevision)return;
    const active=(type:string)=>[...this.stations.values()].filter(s=>s.def.type===type&&!s.down);
    const allBatteries=[...this.stations.values()].filter(s=>s.def.type==='battery');
    const capacity=allBatteries.reduce((n,s)=>n+param(s.def,'capacityKwh'),0);
    const inverter=active('inverter').reduce((n,s)=>n+param(s.def,'ratedKw'),0),battery=active('battery').reduce((n,s)=>n+param(s.def,'powerKw'),0);
    const main=this.stations.get('POWER-MAIN'),grid=this.stations.get('GRID-01'),distribution=!!main&&!main.down;
    let load=70;for(const s of this.stations.values())load+=machineElectricKw(s.def,s.status,s.down);
    const p=this.solar.step(dt,(6+this.t/3600)%24,this.peakKw,load,capacity,distribution?battery:0,distribution?inverter:0,distribution&&grid&&!grid.down?param(grid.def,'ratedKw'):0,!!grid?.def.params.exportEnabled,grid?param(grid.def,'sellTlKwh'):0,grid?param(grid.def,'buyTlKwh'):0);
    this.powerOk=p.unservedKw<.01;
    const mode=p.unservedKw>.01?'Elektrik yetersiz':p.exportKw>.1?'Fazla güneş enerjisi şebekeye satılıyor':p.chargeKw>.1?'Güneş enerjisi bataryada depolanıyor':p.dischargeKw>.1?'Batarya fabrikayı besliyor':p.importKw>.1?'Şebeke fabrikayı besliyor':'Güneş fabrikayı besliyor';
    if(mode!==this.solarMode){this.solarMode=mode;this.log(p.unservedKw>.01?'warn':'info',mode,'POWER-MAIN');}
    for(const s of this.stations.values()){
      if(s.def.type==='inverter')s.tele={acKw:s.down?0:p.solarKw*param(s.def,'ratedKw')/Math.max(1,inverter),ratedKw:param(s.def,'ratedKw')};
      if(s.def.type==='battery')s.tele={socPct:p.socPct,storedKwh:p.storedKwh*param(s.def,'capacityKwh')/Math.max(1,capacity),chargeKw:s.down?0:p.chargeKw*param(s.def,'powerKw')/Math.max(1,battery),dischargeKw:s.down?0:p.dischargeKw*param(s.def,'powerKw')/Math.max(1,battery)};
      if(s.def.type==='switchgear')s.tele={loadKw:p.loadKw,unservedKw:p.unservedKw};
      if(s.def.type==='transformer')s.tele={importKw:p.importKw,exportKw:p.exportKw,exportedKwh:p.exportedKwh,incomeTl:p.incomeTl,importCostTl:p.costTl};
      if(!s.down){if(s.def.type==='inverter')s.status=(s.tele.acKw??0)>.1?'RUNNING':'IDLE';if(s.def.type==='battery')s.status=p.chargeKw+p.dischargeKw>.1?'RUNNING':'IDLE';if(s.def.type==='transformer')s.status=p.importKw+p.exportKw>.1?'RUNNING':'IDLE';if(s.def.type==='switchgear')s.status=this.powerOk?'RUNNING':'WAITING_UTILITY';}
    }
  }

  private tickBoiler(s: Station, dt: number, load: number) {
    const cap = param(s.def, 'steamCapKgH');
    this.randomFault(s, dt, true);
    const dead = this.downTick(s, dt);
    const unavailable=!this.powerOk || s.def.params.energyEquipment && ['ENERGY-WATER','ENERGY-FEED','ENERGY-FUEL'].some(id=>this.stations.get(id)?.down);
    const target = dead || unavailable ? 0 : load > cap ? 5 : 10;
    s.pressure += (target - s.pressure) * Math.min(1, dt * 0.06);
    if (!dead) { s.status = unavailable ? 'WAITING_UTILITY' : s.pressure >= STEAM_MIN_BAR ? 'RUNNING' : 'SETUP'; if(!unavailable)s.counters.runtimeS += dt; }
    s.tele = { pressureBar: +s.pressure.toFixed(2), steamLoadKgH: Math.round(load), capacityKgH: cap };
    s.progress = Math.min(1, load / cap);
    s.info = unavailable ? 'Besleme suyu / yakıt yardımcı tesisi bekleniyor' : load > cap ? 'Aşırı yük!' : '';
  }

  private tickDye(s: Station, dt: number) {
    this.randomFault(s, dt, true);
    if (this.downTick(s, dt)) return;
    const cap = param(s.def, 'stockCap');
    if (s.stock < cap) {
      s.status = 'RUNNING';
      s.counters.runtimeS += dt;
      s.timer += dt;
      s.progress = s.timer / param(s.def, 'cycleSec');
      if (s.timer >= param(s.def, 'cycleSec')) { s.timer = 0; s.stock++; s.counters.good++; }
    } else { s.status = 'IDLE'; s.progress = 0; }
    s.tele = { stockBatches: s.stock, stockCap: cap };
  }

  private tickSource(s: Station, dt: number) {
    s.tele = {truckReturnSeconds:Math.max(0,s.deliveryReturnAt-this.t)};
    if (this.downTick(s, dt)) return;
    if (s.deliveryReturnAt > this.t) { s.status='WAITING_UTILITY';s.info='Yeni TIR bekleniyor';return; }
    s.info='';
    if (s.out) { s.status = 'BLOCKED'; this.dispatch(s); return; }
    s.timer += dt;
    s.progress = Math.min(1, s.timer / param(s.def, 'spawnSec'));
    s.status = this.lotsAlive >= this.wipCap ? 'IDLE' : 'RUNNING';
    if (s.timer >= param(s.def, 'spawnSec') && this.lotsAlive < this.wipCap) {
      s.timer = 0;
      const lot: Lot = {
        id: `L${String(this.lotSeq++).padStart(4, '0')}`, kind: 'raw_roll', color: GREIGE,
        target: PALETTE[Math.floor(Math.random() * PALETTE.length)], kg: 300 + Math.round(Math.random() * 500),
      };
      this.lotsAlive++;
      s.out = lot;
      s.counters.good++;
      if (s.counters.good % 8 === 0) {
        this.log('info', `Kamyon kabul: ${s.counters.good} parti boşaltıldı`, s.def.id);
        if (this.layout.receivingRevision === 3) {s.deliveryReturnAt=this.t+100;s.tele.truckReturnSeconds=100;}
      }
      this.dispatch(s);
    }
  }

  private needsSteam(s: Station): boolean {
    const spec = specOf(s.def);
    if (!spec.utilities.includes('steam')) return false;
    if (s.def.type === 'ht_jet') { const f = s.progress; return f > 0.1 && f < 0.75; }
    return true;
  }

  private tickProcess(s: Station, dt: number) {
    const spec = specOf(s.def);
    if(s.current && s.job?.lotId!==s.current.id)s.job={lotId:s.current.id,kg:s.current.kg,startedAt:this.t-dt,electricityKwh:0,waterM3:0,steamKg:0,gasNm3:0};
    this.randomFault(s, dt, !!s.current);
    if (this.downTick(s, dt)) { this.updateTele(s); return; }

    // başlat
    if (!s.current && s.queue.length) {
      const needDye = spec.utilities.includes('dye');
      const dye = needDye ? [...this.stations.values()].filter((x) => x.def.type === 'dyeprep' && !x.down && x.stock > 0).sort((a,b)=>b.stock-a.stock || a.counters.good-b.counters.good)[0] : undefined;
      if (needDye && !dye) { s.status = 'WAITING_UTILITY'; s.info = 'Boya bekleniyor'; this.updateTele(s); return; }
      if (dye) dye.stock--;
      s.current = s.queue.shift()!;
      s.job={lotId:s.current.id,kg:s.current.kg,startedAt:this.t-dt,electricityKwh:0,waterM3:0,steamKg:0,gasNm3:0};
      s.progress = 0;
      s.duration = Math.max(1, param(s.def, 'cycleSec') * (0.9 + Math.random() * 0.2));
      s.info = '';
    }

    if (s.current) {
      if (s.progress < 1) {
        if(this.layout.solarRevision&&!this.powerOk){s.status='WAITING_UTILITY';s.info='Elektrik beslemesi yetersiz';return;}
        if(s.def.type==='ht_jet')for(const type of ['water_treatment','compressor']) {
          const services=[...this.stations.values()].filter(st=>st.def.type===type && !st.def.params.energyEquipment);
          if(services.length && !services.some(st=>!st.down)) {s.status='WAITING_UTILITY';s.info=type==='compressor'?'Basınçlı hava bekleniyor':'Arıtılmış su bekleniyor';this.updateTele(s);return;}
        }
        if (this.needsSteam(s) && !this.steamOk) { s.status = 'WAITING_UTILITY'; s.info = 'Buhar basıncı yetersiz'; this.updateTele(s); return; }
        s.info = '';
        s.status = 'RUNNING';
        s.counters.runtimeS += dt;
        if (this.needsSteam(s)) s.steamDraw = param(s.def, 'steamKgH');
        if(!s.job || s.job.lotId!==s.current.id)s.job={lotId:s.current.id,kg:s.current.kg,startedAt:this.t-dt,electricityKwh:0,waterM3:0,steamKg:0,gasNm3:0};
        const rates=machineResources(s.def,s.status,s.down,true,s.steamDraw)!;
        const seconds=Math.min(dt,Math.max(0,(1-s.progress)*s.duration));
        s.job.electricityKwh+=rates.electricityKw*seconds/3600;
        s.job.waterM3+=(rates.waterM3H??0)*seconds/3600;
        s.job.steamKg+=(rates.steamKgH??0)*seconds/3600;
        s.job.gasNm3+=(rates.gasNm3H??0)*seconds/3600;
        s.progress = Math.min(1, s.progress + dt / s.duration);
      }
      if (s.progress >= 1) this.finish(s);
    } else if (!s.out) { s.status = s.queue.length ? 'IDLE' : 'STARVED'; s.progress = 0; }

    if (s.out) { this.dispatch(s); if (s.out) s.status = 'BLOCKED'; }
    this.updateTele(s);
  }

  private finish(s: Station) {
    const spec = specOf(s.def);
    const lot = s.current!;
    if(s.job?.lotId===lot.id && s.job.finishedAt===undefined)s.job.finishedAt=this.t;
    if (spec.role === 'sink') {
      s.current = null; s.counters.good++; this.kill(lot);
      if (lot.kind === 'pallet') {
        this.palletsShipped++;
        if (s.counters.good % 6 === 0) this.log('info', `Kamyon sevk edildi (6 palet), toplam ${this.palletsShipped}`, s.def.id);
      }
      s.progress = 0;
      return;
    }
    if (s.out) return; // çıkış dolu → bekle
    const rej = param(s.def, 'rejectPct');
    if (rej > 0 && Math.random() * 100 < rej) {
      s.counters.reject++; s.current = null; s.progress = 0; this.kill(lot);
      this.log('warn', `${lot.id} kontrolde reddedildi (${this.name(s)})`, s.def.id);
      return;
    }
    if (s.def.type === 'ht_jet') { lot.color = lot.target; this.producedKg += lot.kg; }
    if (spec.outKind) lot.kind = spec.outKind;
    if (s.def.type === 'cut') lot.color = lot.target;
    s.current = null; s.out = lot; s.counters.good++; s.progress = 0;
  }

  private dispatch(s: Station) {
    const lot = s.out;
    if (!lot) return;
    const pickup=s.def.type==='receipt_hold' || s.def.params.mamulStore || (s.def.type==='raw_store' && s.def.params.rawReference) ? queuePos(s.def,lot.parkingSlot??0) : undefined;
    const routeTo=(target:MachineDef,slot?:number)=>pickup ? this.router.between(pickup,queuePos(target,slot??0)) : this.router.route(s.def,target,slot);
    let best: Station | null = null;
    let bestSlot = 0;
    let bestLoad = Infinity;
    for (const id of s.def.next) {
      const d = this.stations.get(id);
      if (!d) continue;
      if (!routeTo(d.def)) {
        const key = `${s.def.id}>${id}`;
        if (!this.routeWarnings.has(key)) { this.routeWarnings.add(key); this.log('warn', `${s.def.id} → ${id}: taşıma güzergâhı kapalı`, s.def.id); }
        continue;
      }
      const cap = param(d.def, 'queueCap');
      if (d.queue.length + d.inbound >= cap) continue;
      const occupied = new Set([
        ...((d.def.type==='receipt_hold' || d.def.params.rawReference || d.def.params.mamulStore) ? [d.current?.parkingSlot,d.out?.parkingSlot] : []),
        ...d.queue.map((l, i) => l.parkingSlot ?? i),
        ...this.transits.filter((tr) => tr.to === id).map((tr) => tr.lot.parkingSlot),
      ]);
      let slot = -1;
      for (let i = 0; i < cap; i++) if (!occupied.has(i) && routeTo(d.def, i)) { slot = i; break; }
      if (slot < 0) continue;
      const l = d.queue.length + d.inbound + (d.current ? 1 : 0) + (d.down ? 3 : 0);
      if (l < bestLoad || (l === bestLoad && best && d.counters.good < best.counters.good)) { bestLoad = l; best = d; bestSlot = slot; }
    }
    if (!best) return;
    const route = routeTo(best.def,bestSlot)!;
    lot.parkingSlot = bestSlot;
    const receiving = [s.def.area,best.def.area].some(a=>a==='receiving'||a==='receiving_unload');
    const carrier = carrierKind(lot.kind, receiving || buildingOf(this.layout, s.def)?.id !== buildingOf(this.layout, best.def)?.id);
    best.inbound++;
    this.transits.push({ lot, from: s.def.id, to: best.def.id, t0: this.t, dur: transferDuration(route, carrier), route, carrier });
    s.out = null;
  }

  private updateTele(s: Station) {
    const f = s.progress;
    const running = s.status === 'RUNNING';
    switch (s.def.type) {
      case 'ht_jet': {
        const temp = !s.current ? 30 : f < 0.15 ? 30 + f * 100 : f < 0.4 ? 45 + ((f - 0.15) / 0.25) * 85 : f < 0.7 ? 130 : f < 0.9 ? 130 - ((f - 0.7) / 0.2) * 85 : 45;
        s.tele = { tempC: Math.round(temp), steamKgH: s.steamDraw && running ? s.steamDraw : 0, pressureBar: s.current ? +(1 + (temp - 30) * 0.03).toFixed(1) : 0 };
        s.info = s.current ? (f < 0.15 ? 'Yükleme' : f < 0.4 ? 'Isıtma' : f < 0.7 ? 'Boyama (130°C)' : f < 0.9 ? 'Soğutma / yıkama' : 'Boşaltma') : s.info;
        break;
      }
      case 'stenter': s.tele = { tempC: running ? 180 : 60, speedMpm: running ? 25 : 0, steamKgH: s.steamDraw }; break;
      case 'compactor': s.tele = { speedMpm: running ? 20 : 0 }; break;
      case 'rope_open': s.tele = {speedMpm:running?18:0}; break;
      case 'centrifuge': s.tele = {rpm:running?Math.round(800*Math.sin(Math.PI*f)):0}; break;
      case 'dryer': s.tele = {tempC:running?120:30,steamKgH:s.steamDraw}; break;
      case 'receipt_scale': s.tele = {weightKg:s.current?.kg??0,confirmed:running && f>.8?1:0}; break;
      case 'receipt_scan': s.tele = {speedMpm:running?16:0,barcodeRead:s.current && f>.5?1:0}; break;
      case 'inspection': s.tele = { speedMpm: running ? 35 : 0 }; break;
      default: break;
    }
  }

  snapshot(): Snapshot {
    const machines: MachineState[] = [];
    const lots: LotSnap[] = [];
    let util = 0, utilN = 0, rejects = 0, dye = 0, steam = 0, load = 0;
    const snap = (l: Lot, extra: Partial<LotSnap>) => lots.push({ id: l.id, kind: l.kind, color: l.color, kg: l.kg, place: 'queue', ...extra });
    for (const s of this.stations.values()) {
      const role = specOf(s.def).role;
      machines.push({
        operator: role==='slot'||['inverter','battery','switchgear','transformer'].includes(s.def.type)?undefined:s.def.operator??{id:`OP-${s.def.id}`,name:'Simülasyon operatörü',simulated:true},
        resources: machineResources(s.def,s.status,s.down,!!s.current,s.steamDraw,s.tele.steamLoadKgH??0),
        job: s.current ? s.job?.lotId===s.current.id?{...s.job}:{lotId:s.current.id,kg:s.current.kg,startedAt:this.t,electricityKwh:0,waterM3:0,steamKg:0,gasNm3:0} : s.job?{...s.job}:undefined,
        id: s.def.id, status: role === 'slot' ? 'IDLE' : s.status, currentLotId: s.current?.id,
        progress: s.progress, telemetry: s.tele, info: s.info, counters: { ...s.counters },
        queue: s.queue.length,
      });
        if (s.current) snap(s.current, { place: 'current', stationId: s.def.id, idx:s.current.parkingSlot });
        if (s.out) snap(s.out, { place: 'out', stationId: s.def.id, idx:s.out.parkingSlot });
      s.queue.forEach((l, i) => snap(l, { place: 'queue', stationId: s.def.id, idx: l.parkingSlot ?? i }));
      rejects += s.counters.reject;
      if (role === 'process' && s.def.type !== 'cart' && s.def.type !== 'raw_store' && s.def.type !== 'warehouse') {
        util += s.counters.runtimeS / Math.max(1, this.t); utilN++;
      }
      if (s.def.type === 'dyeprep') dye += s.stock;
      if (s.def.type === 'boiler' && !steam) { steam = s.pressure; load = s.tele.steamLoadKgH ?? 0; }
    }
    for (const tr of this.transits) {
      snap(tr.lot, { place: 'transit', from: tr.from, to: tr.to, progress: Math.min(1, (this.t - tr.t0) / tr.dur), route: tr.route, carrier: tr.carrier });
    }
    const kpi: Kpi = {
      simTime: this.t, producedKg: this.producedKg, palletsShipped: this.palletsShipped, wip: this.lotsAlive,
      rejects, steamBar: steam, steamLoadKgH: load, dyeStock: dye, utilizationPct: utilN ? (util / utilN) * 100 : 0,
    };
    return { t: this.t, machines, lots, kpi, power:this.layout.solarRevision?{...this.solar.snapshot}:undefined };
  }

  drainEvents(): FactoryEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

export { TYPES };

