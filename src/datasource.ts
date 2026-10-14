import type { FactoryEvent, Layout, MachineState, Snapshot } from './types';
import { FactorySim } from './sim';

/**
 * Görselleştirme katmanı yalnızca bu arayüzü bilir.
 * Bugün SimulationSource, yarın MqttSource / ApiSource aynı Snapshot'ı üretir.
 */
export interface DataSource {
  readonly kind: 'simulation' | 'live';
  /** Sadece simülasyonda anlamlı kontroller */
  readonly controllable: boolean;
  tick(realDt: number): void;
  onSnapshot(cb: (s: Snapshot) => void): void;
  onEvent(cb: (e: FactoryEvent) => void): void;
  layoutChanged?(): void;
  setSpeed?(x: number): void;
  setPaused?(p: boolean): void;
  toggleFault?(id: string): void;
  setFaultsEnabled?(v: boolean): void;
  readonly speed?: number;
  readonly paused?: boolean;
}

export class SimulationSource implements DataSource {
  readonly kind = 'simulation' as const;
  readonly controllable = true;
  speed = 1;
  paused = false;
  private sim: FactorySim;
  private snapCbs: ((s: Snapshot) => void)[] = [];
  private evCbs: ((e: FactoryEvent) => void)[] = [];

  constructor(layout: Layout) {
    this.sim = new FactorySim(layout);
  }

  onSnapshot(cb: (s: Snapshot) => void) { this.snapCbs.push(cb); }
  onEvent(cb: (e: FactoryEvent) => void) { this.evCbs.push(cb); }
  layoutChanged() { this.sim.sync(); }
  setSpeed(x: number) { this.speed = x; }
  setPaused(p: boolean) { this.paused = p; }
  toggleFault(id: string) { this.sim.toggleFault(id); }
  setFaultsEnabled(v: boolean) { this.sim.faultsEnabled = v; }

  tick(realDt: number) {
    if (!this.paused) {
      let remaining = Math.min(realDt, 0.1) * this.speed;
      while (remaining > 0) {
        const dt = Math.min(0.5, remaining);
        this.sim.step(dt);
        remaining -= dt;
      }
    }
    for (const e of this.sim.drainEvents()) this.evCbs.forEach((cb) => cb(e));
    const snap = this.sim.snapshot();
    this.snapCbs.forEach((cb) => cb(snap));
  }
}

/** mqtt.js client benzeri minimal arayüz: `import mqtt from 'mqtt'; mqtt.connect('ws://broker:9001')` ile verilir */
export interface MqttLikeClient {
  subscribe(topic: string): void;
  on(event: 'message', cb: (topic: string, payload: Uint8Array | string) => void): void;
}

/**
 * Gerçek veri kaynağı iskeleti.
 * Topic şeması:
 *   factory/{site}/{area}/{machineId}/state   -> MachineState JSON
 *   factory/{site}/{area}/{machineId}/alarm   -> { level, text }
 * Lot konumları için `factory/{site}/lots/{lotId}/event` ileride eklenecek.
 */
export class MqttSource implements DataSource {
  readonly kind = 'live' as const;
  readonly controllable = false;
  private states = new Map<string, MachineState>();
  private snapCbs: ((s: Snapshot) => void)[] = [];
  private evCbs: ((e: FactoryEvent) => void)[] = [];
  private dirty = false;

  constructor(client: MqttLikeClient, site = 'main') {
    client.subscribe(`factory/${site}/+/+/state`);
    client.subscribe(`factory/${site}/+/+/alarm`);
    client.on('message', (topic, payload) => this.handle(topic, payload));
  }

  private handle(topic: string, payload: Uint8Array | string) {
    const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const parts = topic.split('/');
    const kind = parts[parts.length - 1];
    const id = parts[parts.length - 2];
    try {
      const data = JSON.parse(text);
      if (kind === 'state') { this.states.set(id, { ...data, id }); this.dirty = true; }
      else if (kind === 'alarm') this.evCbs.forEach((cb) => cb({ t: Date.now() / 1000, level: data.level ?? 'alarm', machineId: id, text: data.text }));
    } catch { /* hatalı payload yok sayılır */ }
  }

  onSnapshot(cb: (s: Snapshot) => void) { this.snapCbs.push(cb); }
  onEvent(cb: (e: FactoryEvent) => void) { this.evCbs.push(cb); }

  tick() {
    if (!this.dirty) return;
    this.dirty = false;
    const snap: Snapshot = {
      t: Date.now() / 1000, machines: [...this.states.values()], lots: [],
      kpi: { simTime: 0, producedKg: 0, palletsShipped: 0, wip: 0, steamBar: 0, steamLoadKgH: 0, dyeStock: 0, rejects: 0, utilizationPct: 0 },
    };
    this.snapCbs.forEach((cb) => cb(snap));
  }
}
