import * as THREE from 'three';
import type { MachineType } from './types';
import { TYPES } from './machineTypes';
import { instanceGroup } from './environment';
import type { CarrierKind } from './transport';
import { powerMachine } from './solarView';

const M = (c: number, metalness = 0.3, roughness = 0.6, emissive = 0) =>
  new THREE.MeshStandardMaterial({ color: c, metalness, roughness, emissive, emissiveIntensity: emissive ? 0.9 : 0 });

const STEEL = M(0x9aa5b1, 0.8, 0.35);
const DARK = M(0x2b3138, 0.5, 0.6);
const YELLOW = M(0xe0b01c, 0.2, 0.6);
const BLUE = M(0x2f6fb0, 0.5, 0.45);
const RED = M(0xb83a2e, 0.4, 0.5);
const WHITE = M(0xe8ecef, 0.1, 0.7);
const FABRIC = M(0xd8d1bd, 0, 0.95);
const WOOD = M(0x9b7a4b, 0, 0.9);
const GLASS = M(0x6fb7e0, 0.1, 0.2, 0x1b6aa0);

type G = THREE.Group;

function box(g: G, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(sharedBox, m);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}
/** axis: 'y' dikey, 'x' yatay(x), 'z' yatay(z) */
function cyl(g: G, r: number, len: number, m: THREE.Material, x = 0, y = 0, z = 0, axis: 'x' | 'y' | 'z' = 'y') {
  const key = `${r}:${len}`;
  if (!cylinders.has(key)) cylinders.set(key, new THREE.CylinderGeometry(r, r, len, 16));
  const mesh = new THREE.Mesh(cylinders.get(key)!, m);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}
function legs(g: G, w: number, d: number, h: number, m = STEEL) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.12, h, 0.12, m, (sx * (w - 0.2)) / 2, 0, (sz * (d - 0.2)) / 2);
}
function rollsRow(g: G, n: number, x0: number, y: number, z: number, step = 0.9) {
  for (let i = 0; i < n; i++) cyl(g, 0.38, 1.2, FABRIC, x0 + i * step, y + 0.38, z, 'z');
}

const builders: Record<Exclude<MachineType, 'receipt_desk' | 'receipt_scan' | 'receipt_scale' | 'receipt_hold' | 'spread' | 'hanger' | 'form_finish' | 'conveyor' | 'rope_open' | 'centrifuge' | 'dryer' | 'water_treatment' | 'compressor' | 'tank' | 'inverter' | 'battery' | 'switchgear' | 'transformer'>, (g: G, w: number, h: number, d: number) => void> = {
  raw_entry(g, w, h, d) {
    legs(g, w, d - 2, 0.75, DARK);
    box(g, w, 0.15, d - 2, STEEL, 0, 0.75, 0);
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.6) { const roll = cyl(g, 0.12, d - 2.2, STEEL, x, 1, 0, 'z'); roll.userData.motion = 'roller'; }
    box(g, 0.15, h, 0.15, YELLOW, -w / 2, 0, -d / 2 + 0.2);
    box(g, 0.15, h, 0.15, YELLOW, w / 2, 0, -d / 2 + 0.2);
    box(g, w, 0.2, 0.25, YELLOW, 0, h, -d / 2 + 0.2);
    rollsRow(g, 3, -2.2, 0.9, 0);
  },
  raw_store(g, w, h, d) {
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) box(g, 0.15, h, 0.15, BLUE, x, 0, z);
    for (const y of [0.1, 1.5, 2.9]) {
      box(g, w - 0.2, 0.1, d - 0.2, STEEL, 0, y, 0);
      rollsRow(g, 6, -3.2, y + 0.1, -1.2);
      rollsRow(g, 6, -3.2, y + 0.1, 1.2);
    }
  },
  inspection(g, w, h, d) {
    legs(g, w, d, 1.0);
    box(g, w, 0.15, d, STEEL, 0, 1.0, 0);
    const t = box(g, w - 0.4, 0.1, d - 0.4, WHITE, 0, 1.15, 0); t.rotation.x = -0.35;
    cyl(g, 0.3, d, DARK, -w / 2 + 0.3, 1.9, 0, 'z');
    box(g, 0.15, 1.6, d, STEEL, w / 2 - 0.2, 1.0, 0);
    box(g, 1.4, 0.9, 0.1, GLASS, 0, 1.8, -d / 2 + 0.1);
    cyl(g, 0.3, 1.0, FABRIC, -w / 2 + 0.3, 1.9, 0, 'z');
  },
  cart(g, w, _h, d) {
    box(g, w, 0.15, d, YELLOW, 0, 0.3, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.15, 0.1, DARK, sx * (w / 2 - 0.3), 0.15, sz * (d / 2 - 0.2), 'z');
    box(g, 0.1, 1.0, d, STEEL, -w / 2 + 0.05, 0.3, 0);
  },
  ht_jet(g, w, h, d) {
    legs(g, w - 0.5, d - 0.4, 0.7, DARK);
    cyl(g, 1.15, w - 1.2, STEEL, 0, 1.9, 0, 'x');
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 12), STEEL); e.scale.set(0.45, 1, 1); e.position.set(s * (w - 1.2) / 2, 1.9, 0); g.add(e); }
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), GLASS); door.position.set(0, 1.9, d / 2 - 0.18); g.add(door);
    cyl(g, 0.65, 0.12, DARK, 0, 1.9, d / 2 - 0.4, 'z');
    cyl(g, 0.35, 1.0, BLUE, -1.2, 3.1, 0);
    cyl(g, 0.25, 0.8, RED, 1.2, 3.1, 0);
    box(g, 1.0, 1.4, 0.6, DARK, w / 2 - 0.3, 0.7, d / 2 - 0.2);
    void h;
  },
  stenter(g, w, h, d) {
    const n = 5, sw = (w - 1) / n;
    for (let i = 0; i < n; i++) {
      box(g, sw - 0.1, h - 1.2, d, M(i % 2 ? 0xb7c0c8 : 0xa9b3bc, 0.6, 0.4), -w / 2 + 0.5 + sw * (i + 0.5), 0.5, 0);
      cyl(g, 0.3, 0.9, DARK, -w / 2 + 0.5 + sw * (i + 0.5), h - 0.3, 0);
    }
    box(g, w, 0.5, d + 0.2, DARK, 0, 0, 0);
    box(g, 0.8, 1.4, d, YELLOW, -w / 2 + 0.2, 0.5, 0);
    box(g, 0.8, 1.4, d, YELLOW, w / 2 - 0.2, 0.5, 0);
    box(g, 1.2, 1.2, 0.5, GLASS, w / 2 - 2, 1.0, d / 2 + 0.1);
  },
  compactor(g, w, h, d) {
    box(g, w, h - 1.2, d, M(0x6e8a9e, 0.5, 0.45), 0, 0.4, 0);
    cyl(g, 0.8, d - 0.2, STEEL, -1.5, h - 0.4, 0, 'z');
    cyl(g, 0.6, d - 0.2, STEEL, 1, h - 0.3, 0, 'z');
    box(g, 1.2, 2.0, 0.8, WHITE, w / 2 - 1, 0, d / 2 + 0.5);
    box(g, 0.6, 0.4, 0.05, GLASS, w / 2 - 1, 1.3, d / 2 + 0.92);
  },
  cut(g, w, h, d) {
    legs(g, w, d, h - 0.1);
    box(g, w, 0.1, d, WHITE, 0, h - 0.1, 0);
    box(g, w - 0.3, 0.2, d - 0.4, FABRIC, 0, h, 0);
    box(g, 0.5, 0.5, d, RED, 1, h + 0.1, 0);
    cyl(g, 0.3, d, FABRIC, -w / 2 - 0.2, h + 0.3, 0, 'z');
  },
  sew(g, w, h, d) {
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const x = -w / 2 + 1 + i * 2;
      box(g, 1.3, 0.8, 0.8, WHITE, x, 0, s * 1.2);
      box(g, 0.5, 0.4, 0.4, BLUE, x, 0.8, s * 1.2);
      box(g, 0.4, 0.5, 0.4, DARK, x, 0, s * 0.45 * 2.3);
    }
    box(g, w, 0.05, 0.4, YELLOW, 0, 0, 0);
    void h; void d;
  },
  iron(g, w, h, d) {
    legs(g, w, d, h - 0.1);
    box(g, w, 0.12, d, M(0x5f7a8a), 0, h - 0.12, 0);
    box(g, 1.4, 0.18, 0.7, STEEL, 0.4, h + 0.05, 0);
    box(g, 0.1, 1.0, 0.1, DARK, -w / 2 + 0.4, h, 0);
  },
  pack(g, w, h, d) {
    legs(g, w, d, h - 0.1);
    box(g, w, 0.1, d, WOOD, 0, h - 0.1, 0);
    for (let i = 0; i < 3; i++) box(g, 0.7, 0.5, 0.6, M(0xb48a54), -1.4 + i * 1.0, h, 0);
  },
  pallet(g, w, h, d) {
    box(g, w - 1, 0.15, d - 1, WOOD, 0, 0, 0);
    for (let y = 0; y < 3; y++) for (const sx of [-0.7, 0.7]) for (const sz of [-0.6, 0.6]) box(g, 1.1, 0.5, 0.9, M(0xb48a54), sx, 0.15 + y * 0.5, sz);
    const wrap = box(g, 2.6, 1.6, 2.2, GLASS, 0, 0.15, 0);
    (wrap.material as THREE.MeshStandardMaterial).transparent = true; (wrap.material as THREE.MeshStandardMaterial).opacity = 0.2;
    void h; void w; void d;
  },
  warehouse(g, w, h, d) {
    for (const row of [-1, 1]) {
      const z = row * (d / 2 - 1.2);
      for (let i = 0; i <= 6; i++) box(g, 0.15, h, 0.15, BLUE, -w / 2 + 0.3 + (i * (w - 0.6)) / 6, 0, z);
      for (const y of [0.1, 2.0, 3.9]) {
        box(g, w - 0.4, 0.12, 1.2, YELLOW, 0, y, z);
        for (let i = 0; i < 6; i++) if ((i + y * 3 + row) % 4) box(g, 1.6, 1.3, 1.0, M(0xb48a54 + i * 0x010100), -w / 2 + 1.5 + i * 2.5, y + 0.12, z);
      }
    }
  },
  dock(g, w, h, d) {
    box(g, w, 0.8, d, M(0x555d66), 0, 0, 0);
    box(g, 0.4, h, d, M(0x7b838b), w / 2 - 0.2, 0, 0);
    box(g, 0.3, h - 1, 3.2, DARK, w / 2 - 0.45, 0.8, 0);
    box(g, 3.5, 0.15, 3.0, YELLOW, w / 2 - 2, 0.8, 0);
    for (let i = 0; i < 4; i++) box(g, 0.7, 0.5, 0.6, M(0xb48a54), -2 + (i % 2) * 0.9, 0.8, -1 + Math.floor(i / 2) * 0.8);
  },
  truck_out(g, w, h, d) {
    box(g, w - 2.6, h - 1, d, WHITE, -1.3, 0.9, 0);
    box(g, 2.0, 2.2, d - 0.3, RED, w / 2 - 1.1, 0.9, 0);
    box(g, 0.1, 0.9, d - 0.8, GLASS, w / 2 - 0.05, 1.8, 0);
    for (const x of [-3.2, -2, 3.5]) for (const z of [-1, 1]) { const wh = cyl(g, 0.5, 0.35, DARK, x, 0.5, z * 1.55, 'z'); wh.scale.set(1, 1, 1); }
    box(g, w, 0.3, d - 0.4, DARK, 0, 0.5, 0);
  },
  boiler(g, w, h, d) {
    cyl(g, 1.8, 5, M(0x8e3b2e, 0.6, 0.4), 0, 3.0, 0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x8e3b2e, 0.6, 0.4)); dome.position.y = 5.5; g.add(dome);
    cyl(g, 0.4, 3.2, DARK, 0, h - 1.6 + 0.2, 0);
    box(g, 2.2, 1.6, 2.0, BLUE, 0, 0, d / 2 - 0.8 + 0.6 - 0.6);
    for (const x of [-1.5, 1.5]) box(g, 0.25, 1.0, 0.25, STEEL, x, 0, -d / 2 + 0.3);
    void w;
  },
  dyeprep(g, w, h, d) {
    box(g, w, 0.4, d, M(0x555d66), 0, 0, 0);
    [0x1abc9c, 0xe74c3c, 0xf1c40f].forEach((c, i) => {
      cyl(g, 0.85, 2.4, M(c, 0.3, 0.4), -2.4 + i * 2.4, 1.6, -0.8);
      box(g, 0.1, 1.0, 0.1, STEEL, -2.4 + i * 2.4, 0.4, 0.7);
    });
    box(g, w - 1, 0.1, 1.4, YELLOW, 0, 0.4, 1.4);
    box(g, 1.4, 1.5, 0.8, WHITE, w / 2 - 1, 0.4, d / 2 - 0.5);
    void h;
  },
  slot(g, w, _h, d) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 }));
    plane.rotation.x = -Math.PI / 2; plane.position.y = 0.05; g.add(plane);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 2.5, d)), new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
    edges.position.y = 1.25; g.add(edges);
  },
};

export function buildProcedural(type: MachineType): THREE.Group {
  if(type==='inverter'||type==='battery'||type==='switchgear'||type==='transformer')return powerMachine({id:'',type,area:'power',position:[0,0,0],rotationY:0,params:{},next:[]})!;
  const g = new THREE.Group();
  const [w, h, d] = TYPES[type].size;
  const fallback = type === 'receipt_desk' ? 'pack' : type === 'receipt_scan' ? 'raw_entry' : type === 'receipt_scale' ? 'cart' : type === 'receipt_hold' ? 'raw_store' : type === 'spread' ? 'cut' : type === 'hanger' ? 'sew' : type === 'form_finish' ? 'iron' : type === 'conveyor' ? 'pack' : type === 'rope_open' ? 'compactor' : type === 'centrifuge' || type === 'tank' ? 'boiler' : type === 'dryer' ? 'stenter' : type === 'water_treatment' ? 'dyeprep' : type === 'compressor' ? 'ht_jet' : type;
  builders[fallback](g, w, h, d);
  if (['ht_jet', 'stenter', 'compactor', 'inspection', 'dyeprep', 'boiler'].includes(type)) {
    box(g, 0.7, 1.3, 0.4, WHITE, w / 2 - 0.7, 0.1, d / 2 - 0.35);
    box(g, 0.48, 0.35, 0.035, GLASS, w / 2 - 0.7, 0.9, d / 2 - 0.12);
    for (const x of [-0.16, 0, 0.16]) cyl(g, 0.04, 0.04, x ? BLUE : RED, w / 2 - 0.7 + x, 0.7, d / 2 - 0.1, 'z');
    const motor = cyl(g, 0.24, 0.65, BLUE, -w / 2 + 0.7, 0.6, -d / 2 + 0.45, 'x'); motor.userData.motion = 'motor';
    for (let i = 0; i < 6; i++) box(g, 0.04, 0.48, 0.48, STEEL, -w / 2 + 0.4 + i * 0.09, 0.36, -d / 2 + 0.45);
  }
  if (type === 'ht_jet' || type === 'boiler') {
    for (const x of [-w / 4, w / 4]) {
      cyl(g, 0.065, 0.7, STEEL, x, h - 0.25, -d / 4);
      const valve = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 12), RED); valve.position.set(x, h + 0.1, -d / 4); valve.rotation.x = Math.PI / 2; valve.userData.motion = 'valve'; g.add(valve);
    }
  }
  if (type === 'sew') for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 1 + i * 2;
    box(g, 0.35, 0.5, 0.32, M(0x62716a), x, 0.7, 0.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), M(0xc6ad8c)); head.position.set(x, 1.4, 0.1); g.add(head);
    const needle = box(g, 0.025, 0.18, 0.025, STEEL, x, 0.95, 1.3); needle.userData.motion = 'needle'; needle.userData.baseY = needle.position.y;
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && type !== 'slot') { o.castShadow = true; o.receiveShadow = true; } });
  instanceGroup(g);
  return g;
}

const sharedBox = new THREE.BoxGeometry(1, 1, 1);
const cylinders = new Map<string, THREE.CylinderGeometry>();

export function buildCarrier(kind: CarrierKind): THREE.Group {
  const root = new THREE.Group(); root.userData.carrierKind = kind;
  const body = new THREE.Group(); body.name = 'carrierBody'; root.add(body); root.userData.body = body;
  const wheels: THREE.Mesh[] = [];
  const wheel = (x: number, z: number, radius: number) => { const w = cyl(body, radius, 0.16, DARK, x, radius, z, 'z'); w.userData.motion = 'wheel'; wheels.push(w); };
  if (kind === 'forklift') {
    // Load origin is over the forks. The chassis and driver are behind it.
    box(body, 1.7, 0.32, 1.05, YELLOW, -1.45, 0.28, 0);
    box(body, 0.65, 0.65, 1.0, YELLOW, -2.0, 0.58, 0);
    box(body, 0.55, 0.18, 0.5, DARK, -1.45, 0.85, 0);
    box(body, 0.12, 0.5, 0.55, DARK, -1.74, 0.93, 0);
    for (const x of [-2.0, -0.9]) for (const z of [-0.53, 0.53]) wheel(x, z, 0.28);
    for (const z of [-0.43, 0.43]) {
      box(body, 0.1, 2.0, 0.1, DARK, -1.94, 0.55, z);
      box(body, 0.12, 2.2, 0.1, STEEL, -0.6, 0.22, z);
    }
    box(body, 1.55, 0.12, 1.05, YELLOW, -1.25, 2.45, 0);
    const forks = new THREE.Group(); root.add(forks); root.userData.forks = forks;
    box(forks, 0.1, 0.45, 0.94, STEEL, -0.57, 0, 0);
    for (const z of [-0.38, 0.38]) box(forks, 1.28, 0.06, 0.12, STEEL, 0, 0, z);
    forks.position.y = 0.13;
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), DARK); steering.rotation.y = Math.PI / 2; steering.position.set(-0.96, 1.2, 0); body.add(steering);
    box(body, 0.12, 0.18, 0.14, M(0xffd16a, 0.1, 0.4, 0xffb000), -1.2, 2.57, 0);
  } else {
    box(body, 1.35, 0.1, 1.45, STEEL, 0, 0.38, 0);
    for (const x of [-0.52, 0.52]) for (const z of [-0.58, 0.58]) wheel(x, z, 0.15);
    for (const z of [-0.67, 0.67]) box(body, 1.32, 0.07, 0.06, STEEL, 0, 0.64, z);
    for (const z of [-0.6, 0.6]) box(body, 0.06, 0.58, 0.06, STEEL, -0.65, 0.44, z);
    box(body, 0.06, 0.06, 1.3, STEEL, -0.65, 1.0, 0);
  }
  const driver = new THREE.Group(); root.add(driver); root.userData.driver = driver;
  const x = kind === 'forklift' ? -1.42 : -1.22;
  const y = kind === 'forklift' ? 1.06 : 0.94;
  box(driver, 0.33, 0.5, 0.44, M(0xe0b839), x, y, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M(0xc5a382)); head.position.set(x, y + 0.66, 0); driver.add(head);
  cyl(driver, 0.19, 0.1, YELLOW, x, y + 0.82, 0);
  for (const z of [-0.15, 0.15]) {
    const leg = box(driver, 0.14, kind === 'forklift' ? 0.45 : 0.8, 0.14, BLUE, x, kind === 'forklift' ? 0.65 : 0.1, z);
    leg.userData.walkLeg = z < 0 ? -1 : 1; leg.userData.motion = 'walk';
    box(driver, 0.14, 0.13, 0.25, DARK, x + 0.08, kind === 'forklift' ? 0.58 : 0.02, z);
    const arm = box(driver, 0.55, 0.12, 0.12, M(0xc5a382), x + 0.33, y + 0.33, z * 1.5); arm.rotation.z = -0.18;
  }
  root.userData.wheels = wheels;
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; o.userData.sharedAsset = true; } });
  instanceGroup(body); instanceGroup(driver);
  return root;
}

export function animateMachine(root: THREE.Object3D, dt: number, progress: number) {
  root.traverse((o) => {
    if (o.userData.motion === 'roller' || o.userData.motion === 'motor') o.rotateY(dt * 2);
    if (o.userData.motion === 'valve' && dt) o.rotateZ(dt * 0.2);
    if (o.userData.motion === 'needle') o.position.y = o.userData.baseY + (dt ? Math.sin(progress * 200) * 0.08 : 0);
  });
}

