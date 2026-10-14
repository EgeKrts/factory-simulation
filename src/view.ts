import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Layout, LotKind, LotSnap, MachineDef, MachineState, MachineType, Snapshot, Status } from './types';
import { TYPES, specOf } from './machineTypes';
import { buildProcedural } from './procedural';
import { inPort, outPort, queuePos, toWorld } from './geometry';
import { CampusEnvironment, instanceGroup } from './environment';
import { buildingOf, placementErrors } from './layout';
import { CampusRouter, samplePath } from './routes';
import { animateMachine } from './procedural';
import { AssetLibrary, fitAsset } from './assets';
import { TransportFleet } from './logisticsView';
import { carrierKind } from './transport';
import { dressGarmentModel, sewingModules, animateGarment } from './garmentView';
import { ModelBatches } from './modelBatches';
import { dressDyeModel, animateDye } from './dyeView';
import { ReceivingHallView, receivingMachine, receivingPallet, animateReceiving } from './receivingView';
import { RawWarehouseView } from './rawView';
import { ShippingWarehouseView } from './shippingView';
import { EnergyCentreView,lightEnergyAsset } from './energyView';
import { powerMachine } from './solarView';

export const STATUS_COLOR: Record<Status, number> = {
  RUNNING: 0x22c55e, IDLE: 0x94a3b8, STARVED: 0x64748b, SETUP: 0xfacc15,
  BLOCKED: 0xf59e0b, WAITING_UTILITY: 0xd946ef, DOWN: 0xef4444, MAINTENANCE: 0x3b82f6,
};
export const STATUS_TR: Record<Status, string> = {
  RUNNING: 'Çalışıyor', IDLE: 'Boşta', STARVED: 'Malzeme bekliyor', SETUP: 'Hazırlanıyor',
  BLOCKED: 'Çıkış dolu', WAITING_UTILITY: 'Yardımcı tesis bekliyor', DOWN: 'ARIZA / Durdu', MAINTENANCE: 'Bakım',
};
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

interface MachineView {
  def: MachineDef;
  root: THREE.Group;
  model: THREE.Object3D;
  lamp: THREE.Mesh;
  label: THREE.Sprite;
  sel: THREE.LineSegments;
  status: Status;
}

interface Pipe { group: THREE.Group; pts: THREE.Vector3[]; lens: number[]; total: number; dots: THREE.Mesh[]; target: string; kind: 'steam' | 'dye' }

export interface ViewCallbacks {
  onSelect(id: string | null): void;
  onLayoutEdited(structural: boolean): void;
  onBuildingSelect?(id: string | null): void;
  onError?(text: string): void;
}

export class FactoryView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private tc: TransformControls;
  private hemi = new THREE.HemisphereLight(0xdbeafe, 0x39414c, 1.8);
  private sun = new THREE.DirectionalLight(0xffffff, 3);
  private machines = new Map<string, MachineView>();
  private lots = new Map<string, { mesh: THREE.Object3D; kind: LotKind; color: string }>();
  private assets = new AssetLibrary();
  private fleet = new TransportFleet(this.scene, this.assets);
  private customModels = new Map<string, THREE.Object3D>();
  private stationModels = new Map<string, { model: THREE.Object3D; rotationY?: number }>();
  private cargoModels = new Map<LotKind, THREE.Object3D>();
  private modelRotations = new Map<MachineType, number>();
  private campus!: CampusEnvironment;
  private garmentDecor = new THREE.Group();
  private receivingHall?: ReceivingHallView;
  private rawWarehouse?: RawWarehouseView;
  private shippingWarehouse?: ShippingWarehouseView;
  private energyCentre?: EnergyCentreView;
  private modelBatches = new ModelBatches();
  private modelBatchDirty = true;
  private activeClothColors = new Map<string,string>();
  private router!: CampusRouter;
  openBuildingId: string | null = null;
  private validTransforms = new Map<string, { position: MachineDef['position']; rotation: number }>();
  private dragBaselineErrors = new Set<string>();
  private deliveryTruck: THREE.Object3D = buildProcedural('truck_out');
  private truckDepartAt = -1;
  private receivedCount = 0;
  private shippedCount = 0;
  private latestTime = 0;
  private shippingTruck = buildProcedural('truck_out');
  private shippingDepartAt = -1;
  private showPipeFlow = false;
  lightMode: 'auto' | 'day' | 'night' = 'day';
  private frameTimes: number[] = [];
  readonly metrics = { fps: 0, calls: 0, triangles: 0, width: 0, height: 0 };
  private states = new Map<string, MachineState>();
  private envGroup = new THREE.Group();
  private arrowGroup = new THREE.Group();
  private pipeGroup = new THREE.Group();
  private pipes: Pipe[] = [];
  private glbCache = new Map<MachineType, THREE.Object3D>();
  private gltf = new GLTFLoader();
  private raycaster = new THREE.Raycaster();
  private keys = new Set<string>();
  private flyTo: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private overviewScale = 1;
  private dirty = true;
  private pipeClock = 0;
  layout!: Layout;
  selectedId: string | null = null;
  editMode = false;
  showLabels = true;

  constructor(private canvas: HTMLCanvasElement, private cb: ViewCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene.background = new THREE.Color(0xc4d5d5);
    this.scene.fog = new THREE.Fog(0xc4d5d5, 300, 850);

    this.camera.position.set(155, 150, 195);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 800;

    this.scene.add(this.hemi, this.sun);
    this.sun.position.set(40, 90, 50);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -165, right: 165, top: 145, bottom: -145, near: 1, far: 500 });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.envGroup, this.arrowGroup, this.pipeGroup);
    this.arrowGroup.visible = false;
    this.scene.add(this.deliveryTruck);
    this.scene.add(this.shippingTruck); this.shippingTruck.visible = false;

    this.tc = new TransformControls(this.camera, canvas);
    this.tc.setTranslationSnap(0.5);
    this.tc.setRotationSnap(THREE.MathUtils.degToRad(15));
    this.tc.showY = false;
    this.scene.add(this.tc.getHelper());
    this.tc.addEventListener('dragging-changed', (e) => {
      this.controls.enabled = !e.value;
      const mv = this.selectedId ? this.machines.get(this.selectedId) : undefined;
      if (e.value && mv) {
        this.validTransforms.set(mv.def.id, { position: [...mv.def.position], rotation: mv.def.rotationY });
        this.dragBaselineErrors = new Set(this.layout.machines.flatMap((m) => placementErrors(this.layout, m)));
      }
      if (!e.value && mv) {
        const errors = this.layout.machines.flatMap((m) => placementErrors(this.layout, m)).filter((e) => !this.dragBaselineErrors.has(e));
        if (errors.length) {
          const valid = this.validTransforms.get(mv.def.id)!;
          mv.def.position = [...valid.position]; mv.def.rotationY = valid.rotation;
          mv.root.position.set(...valid.position); mv.root.rotation.y = valid.rotation; this.cb.onError?.(errors[0]);
        }
        this.dirty = true; this.cb.onLayoutEdited(false);
      }
    });
    this.tc.addEventListener('objectChange', () => this.onTransform());

    let down: [number, number] | null = null;
    canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || this.tc.dragging) return;
      this.pick(e);
    });
    addEventListener('keydown', (e) => { if (!this.typing(e)) this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    for (const kind of ['raw_roll', 'dyed_batch', 'finished_roll', 'cut_bundle', 'garment_box', 'pallet'] as LotKind[]) void this.loadCargo(kind);
  }

  private typing(e: Event) {
    const t = e.target as HTMLElement;
    return t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
  }

  private resize() {
    const p = this.canvas.parentElement!;
    this.renderer.setSize(p.clientWidth, p.clientHeight, false);
    this.camera.aspect = p.clientWidth / Math.max(1, p.clientHeight);
    this.camera.updateProjectionMatrix();
    const scale = Math.max(1, 1.25 / this.camera.aspect);
    if (!this.openBuildingId && !this.selectedId) {
      const ratio = scale / this.overviewScale;
      this.camera.position.sub(this.controls.target).multiplyScalar(ratio).add(this.controls.target);
      if (this.flyTo) this.flyTo.pos.sub(this.flyTo.target).multiplyScalar(ratio).add(this.flyTo.target);
    }
    this.overviewScale = scale;
  }

  // ---------------- layout ----------------
  setLayout(layout: Layout) {
    this.layout = layout;
    this.modelBatches.reset();this.modelBatchDirty=true;
    this.scene.add(this.modelBatches.group);
    for (const mv of this.machines.values()) this.scene.remove(mv.root);
    this.machines.clear();
    for (const lot of this.lots.values()) { lot.mesh.removeFromParent(); this.disposeLot(lot.mesh); }
    this.lots.clear();
    this.fleet.reset();
    this.states.clear(); this.openBuildingId = null;
    this.select(null);
    this.buildEnvironment();
    if(this.energyCentre)this.scene.remove(this.energyCentre.interior,this.energyCentre.exterior);
    this.energyCentre=layout.energyRevision===3?new EnergyCentreView(layout,this.assets):undefined;
    if(this.energyCentre){this.scene.add(this.energyCentre.interior,this.energyCentre.exterior);const b=layout.buildings!.find(b=>b.id==='utility')!;
      const label=this.textSprite('Baca','#e2e8f0',34,'#94a3b8');label.position.set(b.center[0]+6,11,b.center[1]+7);label.scale.set(4,1.2,1);this.energyCentre.interior.add(label);}
    if(this.shippingWarehouse)this.scene.remove(this.shippingWarehouse.group);
    this.shippingWarehouse=layout.shippingRevision===2?new ShippingWarehouseView(layout,this.assets):undefined;
    if(this.shippingWarehouse){this.scene.add(this.shippingWarehouse.group);const b=layout.buildings!.find(b=>b.id==='warehouse')!;
      this.fleet.park('forklift',[b.center[0]-19,b.center[1]+9],Math.PI);
      for(const [text,x,y,z] of [['Ürün Depolama Rafları',-3,8,-3],['Sevkiyat Hazırlık Alanı',-15,3,16],['Sevke Hazır Ürünler',13,3,17]] as const){const label=this.textSprite(text,'#e2e8f0',34,'#94a3b8');label.position.set(b.center[0]+x,y,b.center[1]+z);label.scale.set(9,1.5,1);this.shippingWarehouse.group.add(label);}
    }
    if(this.rawWarehouse)this.scene.remove(this.rawWarehouse.group);
    this.rawWarehouse=layout.rawRevision===1 ? new RawWarehouseView(layout,this.assets) : undefined;
    if(this.rawWarehouse){
      this.scene.add(this.rawWarehouse.group);
      const b=layout.buildings!.find(b=>b.id==='raw')!;
      this.fleet.park('forklift',[b.center[0]-7,b.center[1]]);
      for(const [text,x,y,z] of [['Raf Depolama',-14,6,0],['Parti / Lot Alanı',5,3.5,2],['Forklift Koridoru',-8,1.5,4],['Ham Kumaş Deposu',8.5,8.3,-11]] as const){const label=this.textSprite(text,'#e2e8f0',34,'#22c55e');label.position.set(b.center[0]+x,y,b.center[1]+z);label.scale.set(7,1.3,1);this.rawWarehouse.group.add(label);}
    }
    if (this.receivingHall) this.scene.remove(this.receivingHall.interior);
    this.scene.remove(this.deliveryTruck);
    this.receivingHall = layout.receivingRevision === 3 ? new ReceivingHallView(layout) : undefined;
    if (this.receivingHall) {
      this.scene.add(this.receivingHall.interior);
      const receiving = layout.buildings!.find(b => b.id === 'receiving')!;
      this.fleet.park('forklift', [receiving.center[0] + .1, receiving.center[1] + 4]);
      const walls=this.campus.buildings.get('receiving')!.walls;
      for(const side of ['north','west']) {walls[side].traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});walls[side].clear();}
      walls.north.add(this.receivingHall.northWall);
      walls.west.add(this.receivingHall.westWall,this.receivingHall.canopy);
    }
    this.deliveryTruck = this.receivingHall?.truck ?? buildProcedural('truck_out');
    this.scene.add(this.deliveryTruck); this.truckDepartAt=-1; this.receivedCount=0;
    layout.machines.forEach((d) => this.createMachine(d));
    this.scene.remove(this.garmentDecor); this.garmentDecor = new THREE.Group();
    const decor = this.garmentDecor; this.scene.add(decor);
    const paint = new THREE.MeshStandardMaterial({color:'#e0be46',roughness:.85});
    const lineGeometry = new THREE.BoxGeometry(1,1,1);
    for(const d of layout.machines.filter(m=>m.area==='garment')) {
      const [w,,depth]=specOf(d).size;
      for(const side of [-1,1]) for(const horizontal of [false,true]) {
        const stripe=new THREE.Mesh(lineGeometry,paint);
        stripe.scale.set(horizontal?w+.8:.06,.015,horizontal?.06:depth+.8);
        const p=toWorld(d,horizontal?0:side*(w/2+.4),horizontal?side*(depth/2+.4):0);
        stripe.position.set(p[0],.085,p[1]);stripe.rotation.y=d.rotationY;decor.add(stripe);
      }
    }
    void this.assets.load('konfeksiyon/aski-rafi.glb').then(model=>{
      if(!model||this.garmentDecor!==decor)return;
      for(const z of [38,46]){const rack=fitAsset(model,[2.4,2.5,4]);rack.position.set(36,0,z);decor.add(rack);}
    });
    instanceGroup(decor);
    decor.visible = this.openBuildingId === 'garment';
    this.dirty = true;
  }

  private buildEnvironment() {
    this.campus?.dispose();
    this.envGroup.clear();
    this.campus = new CampusEnvironment(this.layout);
    this.envGroup.add(this.campus.group);
    this.router = new CampusRouter(this.layout);
  }

  private textSprite(text: string, color: string, px = 40, dot?: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.drawLabel(sp, text, color, px, dot);
    return sp;
  }

  private drawLabel(sp: THREE.Sprite, text: string, color: string, px: number, dot?: string, sub?: string) {
    const tex = (sp.material as THREE.SpriteMaterial).map as THREE.CanvasTexture;
    const c = tex.image as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    if (dot) {
      g.fillStyle = 'rgba(8,12,20,0.82)';
      g.beginPath(); g.roundRect(4, 4, c.width - 8, c.height - 8, 18); g.fill();
      g.fillStyle = dot; g.beginPath(); g.arc(40, 48, 20, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = color; g.font = `600 ${px}px system-ui, sans-serif`; g.textBaseline = 'middle';
    g.textAlign = dot ? 'left' : 'center';
    g.fillText(text, dot ? 72 : c.width / 2, sub ? 36 : 48, dot ? 420 : 500);
    if (sub) { g.fillStyle = '#94a3b8'; g.font = '500 28px system-ui, sans-serif'; g.fillText(sub, 72, 72, 420); }
    tex.needsUpdate = true;
  }

  private createMachine(d: MachineDef) {
    this.validTransforms.set(d.id, { position: [...d.position], rotation: d.rotationY });
    const spec = specOf(d);
    const root = new THREE.Group();
    root.userData.machineId = d.id;
    root.position.set(d.position[0], 0, d.position[2]);
    root.rotation.y = d.rotationY;

    const model = this.makeModel(d);
    root.add(model);

    const [w, h, dd] = spec.size;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: STATUS_COLOR.IDLE }));
    lamp.position.set(-w / 2 + 0.4, h + 0.6, dd / 2 - 0.3);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), new THREE.MeshStandardMaterial({ color: 0x222831 }));
    pole.position.set(lamp.position.x, h + 0.3, lamp.position.z);
    const label = this.textSprite(d.name ?? d.id, '#e2e8f0', 34, hex(STATUS_COLOR.IDLE));
    label.scale.set(9, 1.7, 1);
    label.position.set(0, h + 2.4, 0);
    if(d.type==='receipt_desk') {label.position.set(-5,3,5);label.scale.set(7,1.3,1);}
    const sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.5, h + 0.5, dd + 0.5)), new THREE.LineBasicMaterial({ color: 0x22d3ee }));
    sel.position.y = (h + 0.5) / 2 - 0.05; sel.visible = false;
    if (spec.role !== 'slot') root.add(lamp, pole);
    root.add(label, sel);
    if(d.params.energyEquipment){label.scale.set(d.type==='boiler'?4.5:5.5,.95,1);label.position.y=d.id==='ENERGY-STEAM'?4.8:specOf(d).size[1]+.6;}
    if(['inverter','battery','switchgear','transformer'].includes(d.type)){label.scale.set(d.type==='transformer'?4.5:3,.65,1);label.position.y=specOf(d).size[1]+.5;}
    label.userData.noPick = true;
    this.scene.add(root);
    this.machines.set(d.id, { def: d, root, model, lamp, label, sel, status: 'IDLE' });
    this.modelBatchDirty=true;
    void this.tryLoadGlb(d);
    this.updateVisibility();
  }

  private makeModel(d: MachineDef): THREE.Object3D {
    if(!d.asset){const power=powerMachine(d);if(power)return power;}
    if(this.shippingWarehouse&&!d.asset){if(d.id==='WH-01')return this.shippingWarehouse.stockDesk;if(d.id==='PALLET-01')return dressGarmentModel(this.shippingWarehouse.palletStation,d);if(d.id==='DOCK-01')return this.shippingWarehouse.ramp;}
    if(d.id==='RAWSTORE-01' && this.rawWarehouse && !d.asset)return this.rawWarehouse.desk;
    if (!d.asset && this.layout.receivingRevision === 3) { const supplied = receivingMachine(d); if (supplied) return supplied; }
    const station = d.asset ? undefined : this.stationModels.get(d.id);
    if (station) return dressDyeModel(dressGarmentModel(fitAsset(station.model, specOf(d).size, station.rotationY), d),d);
    const glb = d.asset ? this.customModels.get(d.asset) : this.glbCache.get(d.type);
    if(glb && d.params.energyEquipment)return lightEnergyAsset(fitAsset(glb,specOf(d).size));
    if (glb) return dressDyeModel(dressGarmentModel(d.type === 'sew' ? sewingModules(glb, this.modelRotations.get(d.type)) : fitAsset(glb, specOf(d).size, d.asset ? 0 : this.modelRotations.get(d.type)), d),d);
    return dressDyeModel(dressGarmentModel(buildProcedural(d.type), d),d);
  }

  // ---------------- GLB ----------------
  private glbTried = new Set<string>();
  private async tryLoadGlb(d: MachineDef) {
    if(!d.asset && this.shippingWarehouse && ['WH-01','PALLET-01','DOCK-01'].includes(d.id))return;
    if (!d.asset && this.layout.receivingRevision === 3 && (d.type.startsWith('receipt_') || d.id === 'ENTRY-01')) return;
    const station = d.asset ? undefined : await this.assets.definition('stations', d.id);
    const key = d.asset ?? (station ? d.id : d.type);
    if (this.glbTried.has(key) || d.type === 'slot') return;
    this.glbTried.add(key);
    const def = d.asset ? { file: d.asset } : station ?? await this.assets.definition('machines', d.type);
    let model = def ? await this.assets.load(def.file) : null;
    if (!model && !d.asset) model = await this.assets.load(`${d.type}.glb`);
    if (!model) return;
    if (d.asset) {
      this.customModels.set(d.asset, model);
      for (const mv of this.machines.values()) if (mv.def.asset === d.asset) this.rebuildModel(mv);
    } else if (station) {
      this.stationModels.set(d.id, { model, rotationY: station.rotationY });
      const mv = this.machines.get(d.id); if (mv) this.rebuildModel(mv);
    } else {
      this.modelRotations.set(d.type, def?.rotationY ?? 0); this.setGlb(d.type, model);
    }
  }

  private async loadCargo(kind: LotKind) {
    const def = await this.assets.definition('cargo', kind); if (!def) return;
    if(kind==='raw_roll' && this.layout?.receivingRevision === 3)return;
    const model = await this.assets.load(def.file); if (!model) return;
    this.cargoModels.set(kind, fitAsset(model, kind === 'pallet' ? (this.layout.shippingRevision===2 ? [1.8,2.6,1.5] : [1.3, 1.7, 1.1]) : [1.2, 0.9, 1.3], def.rotationY));
    for (const [id, e] of this.lots) if (e.kind === kind) { e.mesh.removeFromParent(); this.disposeLot(e.mesh); this.lots.delete(id); }
  }

  async applyGlbFile(type: MachineType, file: File) {
    const buf = await file.arrayBuffer();
    const gltf = await this.gltf.parseAsync(buf, '');
    gltf.scene.traverse((o) => { if (o instanceof THREE.Mesh) o.userData.sharedAsset = true; });
    this.setGlb(type, gltf.scene);
  }

  private setGlb(type: MachineType, scene: THREE.Object3D) {
    this.glbCache.set(type, scene);
    for (const mv of this.machines.values()) if (mv.def.type === type) this.rebuildModel(mv);
    if (type === 'truck_out') {
      this.scene.remove(this.deliveryTruck, this.shippingTruck);
      this.deliveryTruck = this.receivingHall?.truck ?? fitAsset(scene, TYPES.truck_out.size, this.modelRotations.get(type));
      this.shippingTruck = fitAsset(scene, TYPES.truck_out.size, this.modelRotations.get(type));
      this.scene.add(this.deliveryTruck, this.shippingTruck);
    }
  }

  private rebuildModel(mv: MachineView) {
    this.modelBatches.reset();this.modelBatchDirty=true;
    mv.root.remove(mv.model);
    mv.model = this.makeModel(mv.def);
    mv.root.add(mv.model);
  }

  // ---------------- editing ----------------
  addMachine(d: MachineDef) {
    const errors = placementErrors(this.layout, d);
    if (errors.length) { this.cb.onError?.(errors[0]); return; }
    this.layout.machines.push(d);
    this.createMachine(d);
    this.dirty = true;
    this.cb.onLayoutEdited(true);
    this.select(d.id);
  }

  removeMachine(id: string) {
    const mv = this.machines.get(id);
    if (!mv) return;
    this.select(null);
    this.scene.remove(mv.root);
    this.machines.delete(id);
    this.modelBatchDirty=true;
    this.layout.machines = this.layout.machines.filter((m) => m.id !== id);
    this.layout.machines.forEach((m) => { m.next = m.next.filter((n) => n !== id); });
    this.dirty = true;
    this.cb.onLayoutEdited(true);
  }

  refreshMachine(id: string) {
    const mv = this.machines.get(id);
    if (!mv) return;
    mv.root.position.set(mv.def.position[0], 0, mv.def.position[2]);
    mv.root.rotation.y = mv.def.rotationY;
    this.drawLabel(mv.label, mv.def.name ?? mv.def.id, '#e2e8f0', 34, hex(STATUS_COLOR[mv.status]));
    this.dirty = true;
  }

  setEditMode(on: boolean) {
    this.editMode = on;
    this.updateVisibility();
    this.syncGizmo();
  }

  setTransformMode(mode: 'translate' | 'rotate') {
    this.tc.setMode(mode);
    this.tc.showX = mode === 'translate'; this.tc.showZ = mode === 'translate'; this.tc.showY = mode === 'rotate';
  }

  private syncGizmo() {
    const mv = this.selectedId ? this.machines.get(this.selectedId) : undefined;
    if (this.editMode && mv) { this.tc.attach(mv.root); this.setTransformMode(this.tc.mode as 'translate' | 'rotate'); }
    else this.tc.detach();
  }

  private onTransform() {
    const mv = this.selectedId ? this.machines.get(this.selectedId) : undefined;
    if (!mv) return;
    mv.root.position.y = 0;
    mv.def.position = [mv.root.position.x, 0, mv.root.position.z];
    mv.def.rotationY = mv.root.rotation.y;
    if (!this.tc.dragging) this.dirty = true;
  }

  select(id: string | null) {
    if (this.selectedId) { const o = this.machines.get(this.selectedId); if (o) o.sel.visible = false; }
    this.selectedId = id;
    const mv = id ? this.machines.get(id) : undefined;
    if (mv) {
      const building = buildingOf(this.layout, mv.def);
      if (building && building.id !== this.openBuildingId) this.inspectBuilding(building.id, false);
    }
    if (mv) mv.sel.visible = true;
    this.syncGizmo();
    this.cb.onSelect(id);
  }

  private pick(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const roots = [...this.machines.values()].filter((m) => !buildingOf(this.layout, m.def) || buildingOf(this.layout, m.def)?.id === this.openBuildingId).map((m) => m.root);
    roots.push(...[...this.campus.buildings.values()].map((b) => b.group));
    const visible = (object: THREE.Object3D): boolean => { for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible && !o.userData.renderBatched) return false; return true; };
    const hit = this.raycaster.intersectObjects(roots, true).find((h) => visible(h.object) && !h.object.userData.noPick && !(h.object as THREE.Sprite).isSprite && !(h.object as THREE.LineSegments).isLineSegments);
    if (!hit) { this.select(null); return; }
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.machineId && !o.userData.buildingId) o = o.parent;
    if (o?.userData.machineId) this.select(o.userData.machineId as string);
    else if (o?.userData.buildingId) this.inspectBuilding(o.userData.buildingId as string);
  }

  focus(id: string) {
    const d = this.layout.machines.find((m) => m.id === id);
    if (!d) return;
    this.select(id);
    this.flyToPoint(new THREE.Vector3(d.position[0], 0, d.position[2]), 26);
  }

  flyToPoint(target: THREE.Vector3, dist: number) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (dir.y < 0.35) dir.y = 0.5;
    dir.normalize();
    this.flyTo = { pos: target.clone().add(dir.multiplyScalar(dist)), target: target.clone() };
  }

  overview() {
    this.openBuildingId = null; this.select(null); this.updateVisibility(); this.cb.onBuildingSelect?.(null);
    this.flyTo = { pos: new THREE.Vector3(155, 150, 195).multiplyScalar(this.overviewScale), target: new THREE.Vector3(0, 0, 0) };
  }

  inspectBuilding(id: string, fly = true) {
    const b = this.campus.buildings.get(id)?.def;
    if (!b) return;
    this.openBuildingId = id;
    if (fly) this.select(null);
    this.updateVisibility(); this.cb.onBuildingSelect?.(id);
    if (fly) {
      const receiving = b.id === 'receiving' || b.id === 'raw' || b.id==='warehouse' || b.id==='utility';
      const distance = Math.max(Math.max(...b.size) * (receiving ? .7 : 1.15), b.height * 2.8) * Math.max(1, (receiving ? 1.35 : .95) / this.camera.aspect);
      // View the northern service building from its yard, above the neighbouring roof.
      const northService = b.id === 'utility';
      this.flyTo = { pos: new THREE.Vector3(b.center[0] + distance * (northService?-.9:receiving?.9:.55), distance * (receiving?.75:.85), b.center[1] + distance * (northService ? -.9 : receiving?.9:.8)), target: new THREE.Vector3(b.center[0], b.height * .15, b.center[1]) };
    }
  }
  private updateVisibility() {
    for (const mv of this.machines.values()) {
      const b = buildingOf(this.layout, mv.def);
      mv.root.visible = !b || b.id === this.openBuildingId;
      mv.label.visible = this.showLabels && (b ? b.id === this.openBuildingId : this.openBuildingId !== null);
      if (mv.def.type === 'slot') mv.root.visible = this.editMode && b?.id === this.openBuildingId;
    }
  }

  // ---------------- akış okları + borular ----------------
  private rebuildOverlays() {
    this.router = new CampusRouter(this.layout);
    this.arrowGroup.clear();
    const am = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
    const cm = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const byId = new Map(this.layout.machines.map((m) => [m.id, m]));
    for (const d of this.layout.machines) {
      for (const nid of d.next) {
        const n = byId.get(nid);
        if (!n) continue;
        const route = this.router.route(d, n);
        if (!route) continue;
        const geo = new THREE.BufferGeometry().setFromPoints(route.map((p) => new THREE.Vector3(p[0], 0.12, p[1])));
        this.arrowGroup.add(new THREE.Line(geo, am));
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 10), cm);
        const sample = samplePath(route, 0.5), dir = new THREE.Vector3(Math.cos(sample.angle), 0, -Math.sin(sample.angle));
        cone.position.set(sample.point[0], 0.2, sample.point[1]);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        cone.rotateX(0); cone.position.y = 0.4;
        this.arrowGroup.add(cone);
      }
    }
    this.buildPipes();
  }

  private buildPipes() {
    this.pipeGroup.clear();
    this.pipes = [];
    const fixed = new THREE.Group(); this.pipeGroup.add(fixed);
    const unitBox = new THREE.BoxGeometry(1,1,1), unitPipe = new THREE.CylinderGeometry(.12,.12,1,8);
    const steamMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.3 });
    const dyeMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, metalness: 0.5, roughness: 0.4 });
    let i = 0;
    for (const d of this.layout.machines) {
      const u = specOf(d).utilities;
      for (const kind of ['steam','dye'] as const) {
        if (!u.includes(kind)) continue;
        const utility = this.layout.utilityRoutes?.find((r) => r.to === d.id && r.kind === kind);
        const src = this.layout.machines.find(m=>m.id===utility?.from);
        if (!utility || !src) continue;
        const y = utility.height + (i++ % 4) * 0.12;
        const sp = specOf(src);
        const pts = [
          new THREE.Vector3(src.position[0], sp.size[1] * (kind === 'steam' ? 0.9 : 0.6), src.position[2]),
          ...utility.points.map((p) => new THREE.Vector3(p[0], y, p[1])),
          new THREE.Vector3(d.position[0], specOf(d).size[1] * 0.9, d.position[2]),
        ];
        const g = new THREE.Group();
        if (kind === 'steam') for (const p of utility.points.slice(1, -1)) {
          const support = new THREE.Mesh(unitBox, steamMat);support.scale.set(.16,y,.16);
          support.position.set(p[0], y / 2, p[1] + 0.5); support.castShadow = true; fixed.add(support);
          const bracket = new THREE.Mesh(unitBox, steamMat);bracket.scale.set(.2,.15,1.4); bracket.position.set(p[0], y - 0.15, p[1]); fixed.add(bracket);
        }
        const lens: number[] = [];
        let total = 0;
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1];
          const len = a.distanceTo(b);
          lens.push(len); total += len;
          if (len < 0.01) continue;
          const seg = new THREE.Mesh(unitPipe, kind === 'steam' ? steamMat : dyeMat);seg.scale.y=len;
          seg.position.copy(a).add(b).multiplyScalar(0.5);
          seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          fixed.add(seg);
        }
        const dots: THREE.Mesh[] = [];
        for (let k = 0; k < Math.max(4, Math.floor(total / 8)); k++) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: kind === 'steam' ? 0xffffff : 0x5eead4 }));
          g.add(dot); dots.push(dot);
        }
        this.pipeGroup.add(g);
        this.pipes.push({ group: g, pts, lens, total, dots, target: d.id, kind });
      }
    }
    instanceGroup(fixed);
  }

  private animatePipes(dt: number) {
    this.pipeClock += dt;
    for (const p of this.pipes) {
      const st = this.states.get(p.target);
      const active = p.kind === 'steam' ? (st?.telemetry.steamKgH ?? 0) > 0 : st?.status === 'RUNNING';
      p.dots.forEach((dot, i) => {
        dot.visible = !!active && this.showPipeFlow;
        if (!active) return;
        let s = ((this.pipeClock * 2.5 + (i / p.dots.length) * p.total) % p.total);
        let k = 0;
        while (k < p.lens.length - 1 && s > p.lens[k]) { s -= p.lens[k]; k++; }
        const t = p.lens[k] ? s / p.lens[k] : 0;
        dot.position.lerpVectors(p.pts[k], p.pts[k + 1], t);
      });
    }
  }

  setOverlayVisible(kind: 'arrows' | 'pipes' | 'labels', v: boolean) {
    if (kind === 'arrows') this.arrowGroup.visible = v;
    if (kind === 'pipes') this.showPipeFlow = v;
    if (kind === 'labels') { this.showLabels = v; this.updateVisibility(); }
  }

  // ---------------- veri ----------------
  stateOf(id: string) { return this.states.get(id); }
  modelInfo(id:string) {const model=this.machines.get(id)?.model;return model?.userData.assetUrl?.split('/assets/')[1] ?? (this.machines.get(id)?.def.type==='sew' && this.glbCache.has('sew')?'konfeksiyon/dikis-istasyonu.glb':'Prosedürel model');}

  applySnapshot(s: Snapshot) {
    this.latestTime = s.t;
    this.receivingHall?.snapshot(s);
    this.activeClothColors.clear();for(const lot of s.lots)if(lot.place==='current' && lot.stationId)this.activeClothColors.set(lot.stationId,lot.color);
    const received = s.machines.find((m) => m.id === 'ENTRY-01')?.counters.good ?? 0;
    if (Math.floor(received / 8) > Math.floor(this.receivedCount / 8)) this.truckDepartAt = s.t;
    this.receivedCount = received;
    if (Math.floor(s.kpi.palletsShipped / 6) > Math.floor(this.shippedCount / 6)) this.shippingDepartAt = s.t;
    this.shippedCount = s.kpi.palletsShipped;
    for (const ms of s.machines) {
      this.states.set(ms.id, ms);
      const mv = this.machines.get(ms.id);
      if (!mv) continue;
      const labelText=mv.def.params.rawReference || mv.def.params.mamulStore ? `Stok Kontrol · ${s.lots.filter(l=>l.stationId===ms.id).length} palet` : mv.def.name ?? mv.def.id;
      if((mv.def.params.rawReference || mv.def.params.mamulStore) && mv.label.userData.stockText!==labelText){mv.label.userData.stockText=labelText;this.drawLabel(mv.label,labelText,'#e2e8f0',34,hex(STATUS_COLOR[ms.status]));}
      if (ms.status === mv.status) continue;
      mv.status = ms.status;
      (mv.lamp.material as THREE.MeshBasicMaterial).color.setHex(STATUS_COLOR[ms.status]);
      this.drawLabel(mv.label, labelText, '#e2e8f0', 34, hex(STATUS_COLOR[ms.status]));
    }
    // gün/gece (06:00'da başlar)
    const hour = (6 + s.t / 3600) % 24;
    const day = this.lightMode === 'day' ? 1 : this.lightMode === 'night' ? 0 : Math.max(0, Math.sin(((hour - 5) / 14) * Math.PI));
    this.hemi.intensity = 0.4 + 1.5 * day;
    this.sun.intensity = 0.05 + 3 * day;
    this.sun.color.setHex(day > 0.4 ? 0xfff4df : 0xf0be85);
    this.sun.position.set(90 * Math.cos((hour - 6) / 12 * Math.PI), 45 + 110 * day, 80);
    const sky = new THREE.Color(0x111e2e).lerp(new THREE.Color(0xc7d9dc), Math.sqrt(day));
    (this.scene.background as THREE.Color).copy(sky); (this.scene.fog as THREE.Fog).color.copy(sky);
    this.campus.daylight(day);

    const seen = new Set<string>();
    this.fleet.sync(s.t, new Set(s.lots.filter((l) => l.place === 'transit' && l.route).map((l) => l.id)));
    const byId = new Map(this.layout.machines.map((m) => [m.id, m]));
    for (const l of s.lots) {
      seen.add(l.id);
      let e = this.lots.get(l.id);
      const rawCargo=!!this.rawWarehouse && (l.stationId==='RAWSTORE-01' || l.from==='RAWSTORE-01');
      if (!e || e.kind !== l.kind || !!e.mesh.userData.rawCargo !== rawCargo) {
        if (e) { e.mesh.removeFromParent(); this.disposeLot(e.mesh); }
        e = { mesh: this.makeLot(l.kind, l.color, l), kind: l.kind, color: l.color };
        this.scene.add(e.mesh);
        this.lots.set(l.id, e);
      }
      if (e.color !== l.color) { e.color = l.color; this.tint(e.mesh, l.color); }
      if (l.place === 'transit' && l.route) {
        const from = byId.get(l.from!), to = byId.get(l.to!);
        const external = !from || !to || buildingOf(this.layout, from)?.id !== buildingOf(this.layout, to)?.id;
        this.fleet.carry(l, e.mesh, l.carrier ?? carrierKind(l.kind, external));
      } else {
        this.scene.add(e.mesh); this.placeLot(e.mesh, l, byId);
      }
    }
    for (const [id, e] of this.lots) if (!seen.has(id)) { e.mesh.removeFromParent(); this.disposeLot(e.mesh); this.lots.delete(id); }
  }
  private disposeLot(root: THREE.Object3D) {
    root.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.sharedAsset) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach((m) => m.dispose()); } });
  }

  private tint(o: THREE.Object3D, color: string) {
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh && c.userData.tint) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(color); });
  }

  private makeLot(kind: LotKind, color: string, lot?: LotSnap): THREE.Object3D {
    if(kind==='raw_roll' && this.rawWarehouse && (lot?.stationId==='RAWSTORE-01' || lot?.from==='RAWSTORE-01'))return this.rawWarehouse.cargo();
    if (kind === 'raw_roll' && this.layout.receivingRevision === 3) return lot?.stationId==='RECEIPT-HOLD' ? receivingPallet(3,(lot.idx??0)>=2?3:2) : lot?.stationId==='RECEIPT-SCAN' && lot.place==='queue' ? receivingPallet(3,2) : receivingPallet();
    const g = new THREE.Group();
    g.name = `cargo-${kind}`;
    const tinted = (geo: THREE.BufferGeometry, c: string) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
      m.userData.tint = true; m.castShadow = true; return m;
    };
    const fixed = (geo: THREE.BufferGeometry, c: number) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); m.castShadow = true; return m; };
    const palletBase = (w: number, d: number, c = 0x8d6e43) => {
      for (const z of [-d * 0.4, 0, d * 0.4]) {
        const runner = fixed(new THREE.BoxGeometry(w, 0.025, 0.14), c); runner.position.set(0, 0.0125, z); g.add(runner);
        for (const x of [-w * 0.4, 0, w * 0.4]) { const block = fixed(new THREE.BoxGeometry(0.15, 0.10, 0.14), c); block.position.set(x, 0.075, z); g.add(block); }
      }
      for (let i = 0; i < 5; i++) { const board = fixed(new THREE.BoxGeometry(w, 0.04, d / 6), c); board.position.set(0, 0.15, -d * 0.4 + i * d * 0.2); g.add(board); }
    };
    const asset = this.cargoModels.get(kind);
    if (asset) {
      const model = asset.clone(true);
      if (kind !== 'pallet') { palletBase(1.18, 1.4); model.position.y = 0.17; }
      g.add(model); return g;
    }
    if (kind === 'raw_roll' || kind === 'finished_roll') {
      const r = tinted(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 20), color); r.rotation.x = Math.PI / 2; g.add(r);
      const core = fixed(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10), 0xb08d57); core.rotation.x = Math.PI / 2; g.add(core);
      r.position.y = core.position.y = 0.58;
      // A supported roll cradle on a small pallet, instead of a roll floating over a vehicle.
      palletBase(1.18, 1.45);
      for (const x of [-0.36, 0.36]) { const cradle = fixed(new THREE.BoxGeometry(0.18, 0.22, 1.3), 0x768080); cradle.position.set(x, 0.27, 0); cradle.rotation.z = x > 0 ? -0.3 : 0.3; g.add(cradle); }
    } else if (kind === 'dyed_batch') {
      palletBase(1.15, 1.35, 0x7c8587);
      const tub = fixed(new THREE.BoxGeometry(1.15, 0.06, 1.35), 0x7c8587); tub.position.y = 0.2; g.add(tub);
      for (const z of [-0.66, 0.66]) { const side = fixed(new THREE.BoxGeometry(1.15, 0.52, 0.04), 0xa3adaf); side.position.set(0, 0.48, z); g.add(side); }
      for (const x of [-0.56, 0.56]) { const side = fixed(new THREE.BoxGeometry(0.04, 0.52, 1.35), 0xa3adaf); side.position.set(x, 0.48, 0); g.add(side); }
      for (let i = 0; i < 5; i++) { const fold = tinted(new THREE.BoxGeometry(1.05, 0.07, 0.65), color); fold.position.set(0, 0.29 + i * 0.07, (i % 2 ? -1 : 1) * 0.22); fold.rotation.z = (i % 2 ? -1 : 1) * 0.06; g.add(fold); }
    } else if (kind === 'cut_bundle' || kind === 'garment_bundle') {
      palletBase(1.1, 0.95);
      const bundle = tinted(new THREE.BoxGeometry(1.0, 0.35, 0.8), color); bundle.position.y = 0.345; g.add(bundle);
    } else if (kind === 'garment_box') {
      palletBase(1.15, 1.05);
      const carton = fixed(new THREE.BoxGeometry(0.8, 0.6, 0.7), 0xb48a54); carton.position.y = 0.47; g.add(carton);
      const s = tinted(new THREE.BoxGeometry(0.82, 0.035, 0.2), color); s.position.y = 0.785; g.add(s);
    } else {
      palletBase(1.4, 1.2);
      for (let y = 0; y < 3; y++) { const b = fixed(new THREE.BoxGeometry(1.3, 0.5, 1.1), 0xb48a54); b.position.y = 0.33 + y * 0.52; g.add(b); }
      const band = tinted(new THREE.BoxGeometry(1.34, 0.14, 1.14), color); band.position.y = 1.0; g.add(band);
    }
    const bottom = new THREE.Box3().setFromObject(g).min.y;
    for (const child of g.children) child.position.y -= bottom;
    return g;
  }

  private placeLot(mesh: THREE.Object3D, l: LotSnap, byId: Map<string, MachineDef>) {
    mesh.visible = true;
    if (l.place === 'transit') {
      mesh.visible = false; // Transfers are rendered exclusively by the vehicle's load socket.
      return;
    }
    const d = byId.get(l.stationId!);
    if (!d) { mesh.visible = false; return; }
    const spec = specOf(d);
    const building = buildingOf(this.layout,d);
    if (building && building.id !== this.openBuildingId) { mesh.visible=false;return; }
    if (l.place === 'current') {
      if(d.params.rawReference || d.params.mamulStore){const p=queuePos(d,l.idx??0);mesh.position.set(p[0],d.params.mamulStore?.065:.15,p[1]);mesh.rotation.y=0;return;}
      if(d.params.shippingDock || d.params.shippingLine){mesh.position.set(d.position[0],d.params.shippingDock?.22:1.85,d.position[2]);mesh.rotation.y=d.rotationY;return;}
      if (d.area === 'garment' || spec.enclosed || ['raw_store', 'warehouse', 'truck_out', 'sew', 'pallet'].includes(d.type)) { mesh.visible = false; return; }
      const progress=this.states.get(d.id)?.progress??0;
      const p = d.type==='receipt_scan' ? toWorld(d,-6+progress*12,0) : d.type==='receipt_hold' ? queuePos(d,l.idx??0) : toWorld(d,0,0);
      const surface: Partial<Record<MachineType, number>> = { receipt_scan: .805, receipt_scale: .255, receipt_hold: .065, raw_entry: 0.9, inspection: 0.9, cart: 0.5, spread: 1, cut: 1.3, iron: 1.5, conveyor: .9, pack: 1.4, dock: 0.8 };
      mesh.position.set(p[0], surface[d.type] ?? 0, p[1]);
      mesh.rotation.y = d.rotationY;
    } else if (l.place === 'out') {
      const p = d.type==='receipt_hold' || d.params.rawReference || d.params.mamulStore ? queuePos(d,l.idx??0) : outPort(d);
      mesh.position.set(p[0], 0, p[1]);
      mesh.rotation.y = d.rotationY;
    } else {
      const p = queuePos(d, l.idx ?? 0);
      mesh.position.set(p[0], 0, p[1]);
      mesh.rotation.y = d.rotationY;
    }
    if(d.type==='receipt_hold')mesh.rotation.y=(l.idx??0)>=2?.5:(l.idx??0)===0?.1:-.1;
    if(d.params.rawReference)mesh.position.y=.15;
  }

  // ---------------- döngü ----------------
  update(dt: number) {
    if (this.dirty) { this.dirty = false; this.rebuildOverlays(); }
    if (this.flyTo) {
      const k = 1 - Math.pow(0.001, dt);
      this.camera.position.lerp(this.flyTo.pos, k);
      this.controls.target.lerp(this.flyTo.target, k);
      if (this.camera.position.distanceTo(this.flyTo.pos) < 0.2) this.flyTo = null;
    }
    // WASD
    if (this.keys.size) {
      const f = new THREE.Vector3(); this.camera.getWorldDirection(f); f.y = 0; f.normalize();
      const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
      const mv = new THREE.Vector3();
      if (this.keys.has('KeyW')) mv.add(f);
      if (this.keys.has('KeyS')) mv.sub(f);
      if (this.keys.has('KeyD')) mv.add(r);
      if (this.keys.has('KeyA')) mv.sub(r);
      if (mv.lengthSq()) {
        mv.normalize().multiplyScalar(dt * 30 * (this.keys.has('ShiftLeft') ? 3 : 1));
        this.camera.position.add(mv); this.controls.target.add(mv); this.flyTo = null;
      }
    }
    this.animatePipes(dt);
    for (const mv of this.machines.values()) {
      const progress = this.states.get(mv.def.id)?.progress ?? 0;
      animateMachine(mv.model, mv.status === 'RUNNING' ? dt : 0, progress);
      animateGarment(mv.model, this.latestTime, mv.status === 'RUNNING', progress);
      animateDye(mv.model,this.states.get(mv.def.id),this.latestTime,this.activeClothColors.get(mv.def.id));
      animateReceiving(mv.model,this.states.get(mv.def.id),this.latestTime);
    }
    this.controls.update();
    this.campus.inspect(this.openBuildingId, this.camera);
    if(this.energyCentre)this.energyCentre.interior.visible=this.openBuildingId==='utility';
    if(this.shippingWarehouse)this.shippingWarehouse.group.visible=this.openBuildingId==='warehouse';
    if(this.rawWarehouse){this.rawWarehouse.group.visible=this.openBuildingId==='raw';if(this.openBuildingId==='raw'){const walls=this.campus.buildings.get('raw')!.walls;walls.north.visible=false;walls.west.visible=false;}}
    this.garmentDecor.visible = this.openBuildingId === 'garment';
    if (this.receivingHall) this.receivingHall.interior.visible = this.openBuildingId === 'receiving';
    const receivingSource=this.layout.machines.find(m=>m.id==='ENTRY-01');
    const deliveryX=this.receivingHall?(receivingSource?.position[0]??-103.5):-87;
    const deliveryRoute: [number, number][] = [[deliveryX, this.receivingHall ? -9 : -19], [deliveryX, 3], [-62, 3], [-62, 103], [-110, 103]];
    const shippingRoute: [number, number][] = this.shippingWarehouse ? [[-65,53],[-62,53],[-62,79],[-62,103],[0,103]] : [[-27, 77], [-27, 79], [-62, 79], [-62, 103], [0, 103]];
    this.animateTruck(this.deliveryTruck, deliveryRoute, this.truckDepartAt);
    const departing = this.shippingDepartAt >= 0 && this.latestTime - this.shippingDepartAt < 100;
    this.shippingTruck.visible = departing;
    const truck = this.machines.get('TRUCK-01'); if (truck) truck.model.visible = !departing;
    if (departing) this.animateTruck(this.shippingTruck, shippingRoute, this.shippingDepartAt);
    const viewDistance = this.camera.position.distanceTo(this.controls.target);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = Math.max(300, viewDistance + 100);
    fog.far = Math.max(850, viewDistance + 650);
    if(this.modelBatchDirty){this.modelBatchDirty=false;this.modelBatches.rebuild([...this.machines.values()].map(m=>m.model));}
    this.modelBatches.sync();
    this.fleet.visibility(this.layout,this.openBuildingId);
    this.renderer.render(this.scene, this.camera);
    if (dt > 0 && dt < 1) { this.frameTimes.push(dt); if (this.frameTimes.length > 120) this.frameTimes.shift(); }
    this.metrics.fps = this.frameTimes.length / this.frameTimes.reduce((a, b) => a + b, 0);
    this.metrics.calls = this.renderer.info.render.calls; this.metrics.triangles = this.renderer.info.render.triangles;
    this.metrics.width = this.canvas.width; this.metrics.height = this.canvas.height;
  }
  private animateTruck(truck: THREE.Object3D, route: [number, number][], departure: number) {
    const elapsed = departure < 0 ? 0 : Math.max(0, this.latestTime - departure);
    const progress = elapsed >= 100 ? 0 : elapsed < 50 ? elapsed / 50 : (100 - elapsed) / 50;
    const sample = samplePath(route, progress); truck.position.set(sample.point[0], 0, sample.point[1]); truck.rotation.y = sample.angle + (elapsed >= 50 && elapsed < 100 ? Math.PI : 0);
  }
}



