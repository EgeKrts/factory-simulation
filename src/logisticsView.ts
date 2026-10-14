import * as THREE from 'three';
import type { LotSnap, Point2, Layout } from './types';
import { AssetLibrary, fitAsset, type AssetDef } from './assets';
import { buildCarrier } from './procedural';
import { pathLength, samplePath } from './routes';
import { transferPose, transportSpeed, type CarrierKind } from './transport';

interface Vehicle { root: THREE.Group; anchor: THREE.Group; kind: CarrierKind; route: Point2[]; travelled: number; cargo?: THREE.Object3D }
interface Returning { vehicle: Vehicle; started: number; duration: number }
/** Cargo is a child of a physical load socket; an empty vehicle returns on the same path. */
export class TransportFleet {
  /** Closed shells cover their internal vehicles; cull those draws without changing transport. */
  visibility(layout: Layout, openBuilding: string | null) {
    for (const v of this.all) {
      const [x,z]=[v.root.position.x,v.root.position.z];
      v.root.visible=!(layout.buildings??[]).some(b=>b.id!==openBuilding && Math.abs(x-b.center[0])<b.size[0]/2-1 && Math.abs(z-b.center[1])<b.size[1]/2-1);
    }
  }
  private active = new Map<string, Vehicle>();
  private returning: Returning[] = [];
  private idle: Vehicle[] = [];
  private models = new Map<CarrierKind, { scene: THREE.Object3D; def: AssetDef }>();
  private all = new Set<Vehicle>();
  private t = 0;
  constructor(private scene: THREE.Scene, private assets: AssetLibrary) {
    for (const kind of ['forklift', 'fabric_cart', 'trolley'] as CarrierKind[]) void this.loadModel(kind);
  }
  private async loadModel(kind: CarrierKind) {
    const def = await this.assets.definition('carriers', kind); if (!def) return;
    const model = await this.assets.load(def.file); if (!model) return;
    this.models.set(kind, { scene: model, def });
    for (const v of this.all) if (v.kind === kind) this.installModel(v);
  }
  private installModel(v: Vehicle) {
    const asset = this.models.get(v.kind); if (!asset) return;
    const slot = v.root.userData.body as THREE.Group;
    slot.clear();
    const fitted = fitAsset(asset.scene, v.kind === 'forklift' ? [3.3, 2.5, 1.3] : [1.45, 1.1, 1.55], asset.def.rotationY);
    const forks: THREE.Mesh[] = []; fitted.traverse((o) => { if (o instanceof THREE.Mesh && o.userData.motion === 'fork') forks.push(o); });
    fitted.updateMatrixWorld(true);
    const forkBounds = new THREE.Box3(); for (const fork of forks) forkBounds.expandByObject(fork);
    fitted.position.x = v.kind === 'forklift' ? (forks.length ? -forkBounds.getCenter(new THREE.Vector3()).x : -1.45) : 0;
    for (const fork of forks) {
      fork.userData.restY = fork.position.y;
      fork.userData.restTop = new THREE.Box3().setFromObject(fork).max.y;
      fork.userData.yScale = fork.getWorldScale(new THREE.Vector3()).y;
    }
    v.root.userData.assetForks = forks;
    if (v.root.userData.forks) (v.root.userData.forks as THREE.Group).visible = forks.length === 0;
    slot.add(fitted); v.root.userData.wheels = [];
    v.root.userData.assetUrl = fitted.userData.assetUrl;
  }
  private acquire(kind: CarrierKind, route: Point2[]) {
    const i = this.idle.findIndex((v) => v.kind === kind && Math.hypot(v.route[v.route.length - 1][0] - route[0][0], v.route[v.route.length - 1][1] - route[0][1]) < 0.01);
    let v = i < 0 ? undefined : this.idle.splice(i, 1)[0];
    if (!v) {
      const root = buildCarrier(kind), anchor = new THREE.Group(); anchor.name = 'loadSocket'; root.add(anchor);
      v = { root, anchor, kind, route, travelled: 0 }; this.all.add(v); this.installModel(v);
    }
    v.route = route; v.travelled = 0; this.scene.add(v.root); return v;
  }
  /** An empty reserve vehicle stays in its marked bay until a transfer acquires it. */
  park(kind: CarrierKind, point: Point2, heading = 0) {
    const v = this.acquire(kind, [point, point]);
    v.root.position.set(point[0], .065, point[1]); v.root.rotation.y = heading;
    v.root.userData.transportPhase = 'parked'; this.idle.push(v);
  }
  carry(lot: LotSnap, cargo: THREE.Object3D, kind: CarrierKind) {
    if (lot.place !== 'transit' || !lot.route) return false;
    let v = this.active.get(lot.id);
    if (!v) { v = this.acquire(kind, lot.route); this.active.set(lot.id, v); }
    v.anchor.add(cargo); v.cargo = cargo; cargo.position.set(0, 0, 0); cargo.rotation.set(0, 0, 0); cargo.visible = true;
    const pose = transferPose(v.route, v.kind, lot.progress ?? 0);
    v.root.position.set(pose.point[0], 0, pose.point[1]); v.root.rotation.y = pose.heading;
    const socket = this.models.get(kind)?.def.loadPoint;
    // A hand cart rolls under a raised load, then rolls clear before the operator lowers it.
    const handoff = kind === 'forklift' ? 0 : 1.5 * (1 - pose.lift);
    const travelHeight = socket?.[1] ?? (kind === 'forklift' ? 0.25 : 0.48);
    const height = travelHeight * (kind === 'forklift' ? pose.lift : Math.min(1, pose.lift / 0.15));
    v.anchor.position.set((socket?.[0] ?? 0) + handoff, height, socket?.[2] ?? 0);
    // Navigation describes the cargo centre, even when an imported vehicle uses an offset socket.
    v.root.position.x -= Math.cos(pose.heading) * v.anchor.position.x + Math.sin(pose.heading) * v.anchor.position.z;
    v.root.position.z -= -Math.sin(pose.heading) * v.anchor.position.x + Math.cos(pose.heading) * v.anchor.position.z;
    const driver = v.root.userData.driver as THREE.Group;
    driver.position.x = handoff > 0 ? handoff + Math.min(1, handoff / 0.2) * 0.9 : 0;
    if (v.root.userData.forks) (v.root.userData.forks as THREE.Group).position.y = v.anchor.position.y + 0.06;
    for (const fork of (v.root.userData.assetForks ?? []) as THREE.Mesh[]) fork.position.y = fork.userData.restY + (v.anchor.position.y + 0.12 - fork.userData.restTop) / fork.userData.yScale;
    this.wheels(v, pose.pathProgress * pathLength(v.route), pose.reversing);
    v.root.userData.transportPhase = pose.phase; v.root.userData.lotId = lot.id;
    return true;
  }
  release(id: string) {
    const v = this.active.get(id); if (!v) return;
    // The caller detaches the load first. Always leave it outside the returning hierarchy.
    if (v.cargo?.parent === v.anchor) this.scene.attach(v.cargo);
    v.cargo = undefined; this.active.delete(id);
    const reversed = [...v.route].reverse();
    v.route = [[v.root.position.x, v.root.position.z], ...reversed.slice(1)]; v.travelled = 0;
    (v.root.userData.driver as THREE.Group).position.x = 0;
    const p = samplePath(v.route, 0); v.root.position.set(p.point[0], 0, p.point[1]); v.root.rotation.y = p.angle;
    v.root.userData.transportPhase = 'return'; delete v.root.userData.lotId;
    this.returning.push({ vehicle: v, started: this.t, duration: Math.max(1, pathLength(v.route) / transportSpeed(v.kind)) });
  }
  sync(t: number, ids: Set<string>) {
    this.t = t;
    for (const id of this.active.keys()) if (!ids.has(id)) this.release(id);
    for (let i = this.returning.length - 1; i >= 0; i--) {
      const r = this.returning[i], progress = Math.max(0, Math.min(1, (t - r.started) / r.duration));
      const pose = samplePath(r.vehicle.route, progress);
      r.vehicle.root.position.set(pose.point[0], 0, pose.point[1]); r.vehicle.root.rotation.y = pose.angle;
      this.wheels(r.vehicle, progress * pathLength(r.vehicle.route), false);
      if (progress >= 1) { this.scene.remove(r.vehicle.root); this.idle.push(r.vehicle); this.returning.splice(i, 1); }
    }
  }
  private wheels(v: Vehicle, travelled: number, backwards: boolean) {
    const distance = travelled - v.travelled; v.travelled = travelled;
    for (const wheel of v.root.userData.wheels as THREE.Mesh[]) wheel.rotateY(distance / (v.kind === 'forklift' ? 0.28 : 0.15) * (backwards ? -1 : 1));
    if (v.kind !== 'forklift') (v.root.userData.driver as THREE.Group).traverse((o) => {
      if (o.userData.walkLeg) o.rotation.z = Math.abs(distance) < 0.001 ? 0 : Math.sin(travelled * 5) * 0.2 * o.userData.walkLeg;
    });
  }
  reset() {
    for (const id of this.active.keys()) {
      const cargo = this.active.get(id)?.cargo; if (cargo) cargo.removeFromParent();
    }
    for (const v of this.all) { this.scene.remove(v.root); v.cargo = undefined; }
    this.active.clear(); this.returning = []; this.idle = [...this.all]; this.t = 0;
  }
}
