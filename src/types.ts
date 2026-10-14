export type MachineType =
  | 'raw_entry' | 'raw_store' | 'inspection' | 'cart' | 'ht_jet' | 'stenter' | 'compactor'
  | 'cut' | 'sew' | 'iron' | 'pack' | 'pallet' | 'warehouse' | 'dock' | 'truck_out'
  | 'boiler' | 'dyeprep' | 'slot' | 'spread' | 'hanger' | 'form_finish' | 'conveyor'
  | 'rope_open' | 'centrifuge' | 'dryer' | 'water_treatment' | 'compressor' | 'tank'
  | 'receipt_desk' | 'receipt_scan' | 'receipt_scale' | 'receipt_hold' | 'inverter' | 'battery' | 'switchgear' | 'transformer';

export type Status =
  | 'IDLE' | 'RUNNING' | 'SETUP' | 'BLOCKED' | 'STARVED'
  | 'WAITING_UTILITY' | 'DOWN' | 'MAINTENANCE';

export type LotKind = 'raw_roll' | 'dyed_batch' | 'finished_roll' | 'cut_bundle' | 'garment_bundle' | 'garment_box' | 'pallet';

export interface MachineDef {
  operator?: { id: string; name: string };
  id: string;
  type: MachineType;
  name?: string;
  area: string;
  position: [number, number, number];
  rotationY: number;
  params: Record<string, number>;
  /** Akış bağlantıları: ürün bu makineden sonra hangi makinelere gidebilir */
  next: string[];
  /** GLB yolu (yoksa prosedürel model kullanılır) */
  asset?: string;
}

export interface AreaDef {
  id: string;
  name: string;
  color: string;
  center: [number, number];
  size: [number, number];
  buildingId?: string;
}

export type Point2 = [number, number];
export interface DoorDef { id: string; side: 'north' | 'south' | 'east' | 'west'; offset: number; width: number; height: number }
export interface BuildingDef {
  id: string; name: string; center: Point2; size: Point2; height: number; color: string;
  doors: DoorDef[];
  rooms?: { name: string; center: Point2; size: Point2; doorZ: number }[];
}
export interface RoadDef { id: string; points: Point2[]; width: number; public?: boolean }
export interface OutdoorDef { id: string; name: string; center: Point2; size: Point2; kind: 'yard' | 'parking' | 'walkway' }
export interface UtilityRoute { from: string; to: string; kind: 'steam' | 'dye'; points: Point2[]; height: number }

export interface Layout {
  version: number;
  garmentRevision?: number;
  dyeRevision?: number;
  receivingRevision?: number;
  rawRevision?: number;
  shippingRevision?: number;
  energyRevision?: number;
  solarRevision?: number;
  floor: { size: [number, number]; center: [number, number] };
  areas: AreaDef[];
  machines: MachineDef[];
  buildings?: BuildingDef[];
  roads?: RoadDef[];
  outdoors?: OutdoorDef[];
  utilityRoutes?: UtilityRoute[];
  obstacles?: {id:string;center:Point2;size:Point2}[];
}

/** MQTT: factory/{site}/{area}/{machineId}/state ile birebir aynı şema */
export interface MachineState {
  operator?: { id: string; name: string; simulated?: boolean };
  resources?: { electricityKw: number; waterM3H?: number; steamKgH?: number; gasNm3H?: number };
  job?: { lotId: string; kg: number; startedAt: number; finishedAt?: number; electricityKwh: number; waterM3: number; steamKg: number; gasNm3: number };
  id: string;
  status: Status;
  currentLotId?: string;
  progress: number; // 0..1
  telemetry: Record<string, number>;
  info?: string;
  counters: { good: number; reject: number; runtimeS: number; downtimeS: number };
  queue: number;
}

export type LotPlace = 'queue' | 'current' | 'out' | 'transit';

export interface LotSnap {
  id: string;
  kind: LotKind;
  color: string;
  kg: number;
  place: LotPlace;
  stationId?: string;
  idx?: number;
  from?: string;
  to?: string;
  progress?: number;
  /** Frozen path used by the simulator and renderer, including during layout edits. */
  route?: Point2[];
  /** Selected when dispatching; loading + travel + unloading use the same profile. */
  carrier?: 'forklift' | 'fabric_cart' | 'trolley';
}

export interface Kpi {
  simTime: number;
  producedKg: number;
  palletsShipped: number;
  wip: number;
  rejects: number;
  steamBar: number;
  steamLoadKgH: number;
  dyeStock: number;
  utilizationPct: number;
}

export interface Snapshot {
  power?:PowerSnapshot;
  t: number;
  machines: MachineState[];
  lots: LotSnap[];
  kpi: Kpi;
}

export interface PowerSnapshot {solarKw:number;loadKw:number;chargeKw:number;dischargeKw:number;importKw:number;exportKw:number;curtailedKw:number;unservedKw:number;storedKwh:number;capacityKwh:number;socPct:number;generatedKwh:number;exportedKwh:number;importedKwh:number;incomeTl:number;costTl:number}

export interface FactoryEvent {
  t: number;
  level: 'info' | 'warn' | 'alarm';
  machineId?: string;
  text: string;
}
