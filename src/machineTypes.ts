import type { LotKind, MachineDef, MachineType } from './types';

export type Role = 'source' | 'process' | 'sink' | 'utility' | 'slot';

export interface TypeSpec {
  label: string;
  /** [genişlik(x), yükseklik(y), derinlik(z)] metre */
  size: [number, number, number];
  role: Role;
  utilities: ('steam' | 'dye')[];
  outKind?: LotKind;
  /** ürün makinenin içinde kapalı işlenir, görünmez */
  enclosed?: boolean;
  /** düzenlenebilir varsayılan parametreler */
  params: Record<string, number>;
}

export const PARAM_LABELS: Record<string, string> = {
  electricKw:'Çalışma elektrik gücü (kW)',waterM3H:'Proses suyu (m³/sa)',gasNm3PerKgSteam:'Doğalgaz / buhar (Nm³/kg)',
  cycleSec: 'Çevrim süresi (sn)',
  queueCap: 'Giriş kuyruğu',
  mtbfH: 'MTBF (saat)',
  mttrMin: 'MTTR (dk)',
  rejectPct: 'Red oranı (%)',
  spawnSec: 'Giriş aralığı (sn)',
  steamKgH: 'Buhar tüketimi (kg/sa)',
  capacityKg: 'Kapasite (kg)',
  steamCapKgH: 'Kazan kapasitesi (kg/sa)',
  stockCap: 'Stok kapasitesi',
  ratedKw:'Güç sınırı (kW)',capacityKwh:'Depolama kapasitesi (kWh)',powerKw:'Şarj / deşarj gücü (kW)',exportEnabled:'Şebekeye satış (0/1)',sellTlKwh:'Senaryo satış fiyatı (TL/kWh)',buyTlKwh:'Senaryo alış fiyatı (TL/kWh)',
};

const P = (cycleSec: number, queueCap = 2, mtbfH = 8, mttrMin = 12, extra: Record<string, number> = {}) => ({
  cycleSec, queueCap, mtbfH, mttrMin, ...extra,
});

export const TYPES: Record<MachineType, TypeSpec> = {
  receipt_desk: { label: 'Kayıt / Barkod Kabulü', size: [4.5, 2, .8], role: 'process', utilities: [], enclosed: true, params: P(12, 2, 0) },
  receipt_scan: { label: 'Kumaş Topu Girişi / Tarama', size: [14, 2.7, 3], role: 'process', utilities: [], params: P(15, 2, 12, 8) },
  receipt_scale: { label: 'Kontrol / Tartım', size: [4, 2, 3.2], role: 'process', utilities: [], params: P(12, 2, 12, 8) },
  receipt_hold: { label: 'Geçici Bekleme / Depoya Onay', size: [7, 2, 6], role: 'process', utilities: [], params: P(30, 5, 0) },
  raw_entry: { label: 'Kumaş Topu Girişi', size: [8, 3, 6], role: 'source', utilities: [], params: { spawnSec: 50, queueCap: 1, mtbfH: 0, mttrMin: 0, cycleSec: 1 } },
  raw_store: { label: 'Ham Kumaş Deposu', size: [8, 4, 6], role: 'process', utilities: [], params: P(4, 20, 0) },
  inspection: { label: 'Kumaş Kontrol Makinesi', size: [4, 2.5, 2.5], role: 'process', utilities: [], params: P(25, 2, 10, 8, { rejectPct: 3 }) },
  cart: { label: 'Kumaş Taşıma Arabası', size: [3, 1.2, 2], role: 'process', utilities: [], params: P(8, 2, 0) },
  ht_jet: { label: 'HT / Jet Boya Makinesi', size: [11.5, 6.3, 4.2], role: 'process', utilities: ['steam', 'dye'], outKind: 'dyed_batch', enclosed: true, params: P(240, 1, 6, 20, { steamKgH: 1800, capacityKg: 500 }) },
  stenter: { label: 'Ramöz', size: [17, 5.5, 4], role: 'process', utilities: ['steam'], outKind: 'finished_roll', enclosed: true, params: P(45, 2, 8, 15, { steamKgH: 2500 }) },
  compactor: { label: 'Kompaktör', size: [12, 3.6, 4], role: 'process', utilities: ['steam'], enclosed: true, params: P(35, 2, 8, 12,{steamKgH:150}) },
  rope_open: { label: 'Halat Açma / Parti Hazırlama', size: [9, 6.2, 3.2], role: 'process', utilities: [], enclosed: true, params: P(30, 2, 10, 10) },
  centrifuge: { label: 'Sıkma / Santrifüj', size: [3.2, 3.1, 2.5], role: 'process', utilities: [], enclosed: true, params: P(40, 2, 8, 12) },
  dryer: { label: 'Kurutma', size: [8, 4.5, 3.5], role: 'process', utilities: ['steam'], enclosed: true, params: P(50, 2, 10, 12, { steamKgH: 900 }) },
  water_treatment: { label: 'Su Arıtma', size: [6, 3.2, 2], role: 'utility', utilities: [], params: {mtbfH:30,mttrMin:15,queueCap:0,cycleSec:1} },
  compressor: { label: 'Kompresör', size: [7, 2.2, 2], role: 'utility', utilities: [], params: {mtbfH:30,mttrMin:15,queueCap:0,cycleSec:1} },
  tank: { label: 'Proses Su Tankı', size: [2.2, 5, 2], role: 'utility', utilities: [], params: {mtbfH:0,mttrMin:0,queueCap:0,cycleSec:1} },
  cut: { label: 'Serim + Kesim', size: [8, 1.3, 3], role: 'process', utilities: [], outKind: 'cut_bundle', params: P(40, 2, 10, 10) },
  sew: { label: 'Dikim Bandı', size: [18, 2.4, 5], role: 'process', utilities: [], outKind: 'garment_bundle', params: P(120, 2, 6, 10) },
  spread: { label: 'Kumaş Serim', size: [8, 2, 3], role: 'process', utilities: [], params: P(30, 2, 10, 8) },
  hanger: { label: 'Askı Taşıma Sistemi', size: [24, 4.5, 3], role: 'process', utilities: [], enclosed: true, params: P(25, 3, 12, 10) },
  form_finish: { label: 'Form Finisher / Son İşlem', size: [4, 2.8, 2.5], role: 'process', utilities: ['steam'], enclosed: true, params: P(20, 2, 10, 8, { steamKgH: 200 }) },
  conveyor: { label: 'Paketleme Konveyörü', size: [8, 1.3, 2], role: 'process', utilities: [], params: P(12, 2, 12, 8) },
  iron: { label: 'Ütü', size: [4, 1.5, 2], role: 'process', utilities: ['steam'], params: P(25, 2, 10, 8,{steamKgH:80}) },
  pack: { label: 'Paketleme / Koli', size: [5, 1.4, 2.5], role: 'process', utilities: [], outKind: 'garment_box', params: P(20, 3, 10, 8) },
  pallet: { label: 'Paletleme', size: [4, 1.8, 4], role: 'process', utilities: [], outKind: 'pallet', params: P(30, 3, 12, 8) },
  warehouse: { label: 'Mamul Depo (Raf)', size: [16, 6, 8], role: 'process', utilities: [], params: P(10, 12, 0) },
  dock: { label: 'Sevkiyat Rampası', size: [8, 4, 6], role: 'process', utilities: [], params: P(15, 4, 0) },
  truck_out: { label: 'Nakliye Kamyonu', size: [10, 3.8, 3.5], role: 'sink', utilities: [], params: P(10, 4, 0) },
  boiler: { label: 'Buhar Kazanı', size: [5, 8, 5], role: 'utility', utilities: [], params: { mtbfH: 24, mttrMin: 25, steamCapKgH: 9000, cycleSec: 1, queueCap: 0 } },
  dyeprep: { label: 'Boya Hazırlama', size: [20, 6.5, 4], role: 'utility', utilities: [], params: { cycleSec: 45, mtbfH: 30, mttrMin: 15, stockCap: 3, queueCap: 0 } },
  inverter: {label:'Güneş İnverteri',size:[1.6,2.2,1],role:'utility',utilities:[],params:{queueCap:0,mtbfH:120,mttrMin:20}},
  battery: {label:'Batarya Kabini',size:[1.6,2.4,1.2],role:'utility',utilities:[],params:{queueCap:0,capacityKwh:250,powerKw:100,mtbfH:120,mttrMin:20}},
  switchgear: {label:'Elektrik Dağıtım Panosu',size:[3.5,2.2,1],role:'utility',utilities:[],params:{queueCap:0,mtbfH:120,mttrMin:20}},
  transformer: {label:'Şebeke Trafosu',size:[2.8,2.5,3.5],role:'utility',utilities:[],params:{queueCap:0,mtbfH:120,mttrMin:20}},
  slot: { label: 'Rezerv Slot', size: [6, 0.2, 4], role: 'slot', utilities: [], params: {} },
};

const baseSpecOf = (d: MachineDef): TypeSpec => d.params.mamulStore ? {...TYPES.warehouse,size:[4.3,1.8,2.7]} : d.params.shippingDock ? {...TYPES.dock,size:[5,1,6]} : d.type === 'raw_store' && d.params.rawReference ? {...TYPES.raw_store,size:[4.3,1.8,2.7]} : d.type === 'raw_entry' && d.area === 'receiving_unload' ? {...TYPES.raw_entry,size:[8,3,18]} : TYPES[d.type];

export function specOf(d:MachineDef):TypeSpec { const base=baseSpecOf(d); return d.params.energyEquipment ? {...base,size:[d.params.modelWidth,d.params.modelHeight,d.params.modelDepth]} : base; }

export function param(d: MachineDef, key: string): number {
  return d.params[key] ?? TYPES[d.type].params[key] ?? 0;
}


