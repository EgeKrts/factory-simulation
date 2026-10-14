import * as THREE from 'three';
import type { BuildingDef, Layout, Point2 } from './types';
import { doorPosition } from './layout';
import { solarRoof } from './solarView';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string, metalness = 0, roughness = 0.85) {
  const key = `${color}:${metalness}:${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
  return materials.get(key)!;
}

function surface(kind: 'asphalt' | 'concrete' | 'metal' | 'grass', color: string, repeat: number) {
  const key = `${kind}:${color}:${repeat}`;
  if (materials.has(key)) return materials.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
  let seed = 37; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 18000; i++) {
    const a = random() * (kind === 'grass' ? 0.16 : 0.1);
    ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(random() * 256, random() * 256, kind === 'grass' ? 2 : 1, 1);
  }
  if (kind === 'concrete') { ctx.strokeStyle = '#00000018'; ctx.lineWidth = 1; ctx.strokeRect(1, 1, 254, 254); }
  if (kind === 'metal') for (let x = 0; x < 256; x += 16) { ctx.fillStyle = '#ffffff18'; ctx.fillRect(x, 0, 3, 256); ctx.fillStyle = '#00000020'; ctx.fillRect(x + 3, 0, 2, 256); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: texture, roughness: kind === 'metal' ? 0.62 : 0.94, metalness: kind === 'metal' ? 0.4 : 0, bumpMap: texture, bumpScale: kind === 'metal' ? 0.07 : 0.025 });
  materials.set(key, m); return m;
}

function box(g: THREE.Group, size: [number, number, number], position: [number, number, number], mat: THREE.Material) {
  const m = new THREE.Mesh(boxGeometry, mat); m.scale.set(...size); m.position.set(...position);
  m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function cylinder(g: THREE.Group, r: number, height: number, position: [number, number, number], mat: THREE.Material) {
  const m = new THREE.Mesh(cylinderGeometry, mat); m.scale.set(r, height, r); m.position.set(...position); m.castShadow = true; g.add(m); return m;
}
function plaque(g: THREE.Group, text: string, width: number, position: [number, number, number], rotation = 0) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  const ctx = c.getContext('2d')!; ctx.fillStyle = '#16363c'; ctx.fillRect(0, 0, 1024, 192);
  ctx.fillStyle = '#d9a85c'; ctx.fillRect(0, 0, 16, 192);
  ctx.fillStyle = '#f4f2e9'; ctx.font = '600 55px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 520, 96, 960);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = box(g, [width, width * 192 / 1024, 0.08], position, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); mesh.rotation.y = rotation;
}

export interface BuildingView { def: BuildingDef; group: THREE.Group; roof: THREE.Group; walls: Record<string, THREE.Group> }
export function instanceGroup(group: THREE.Group) {
  for (const child of group.children) if (child instanceof THREE.Group) instanceGroup(child);
  const batches = new Map<THREE.Material, Map<THREE.BufferGeometry, THREE.Mesh[]>>();
  for (const child of [...group.children]) if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh) && !child.userData.motion && !Array.isArray(child.material)) {
    if (!batches.has(child.material)) batches.set(child.material, new Map());
    const geometries = batches.get(child.material)!;
    if (!geometries.has(child.geometry)) geometries.set(child.geometry, []);
    geometries.get(child.geometry)!.push(child);
  }
  for (const [mat, geometries] of batches) for (const [geometry, meshes] of geometries) {
    if (meshes.length < 2) continue;
    const batch = new THREE.InstancedMesh(geometry, mat, meshes.length);
    batch.castShadow = meshes.some((m) => m.castShadow); batch.receiveShadow = meshes.some((m) => m.receiveShadow);
    meshes.forEach((m, i) => { m.updateMatrix(); batch.setMatrixAt(i, m.matrix); group.remove(m); });
    batch.computeBoundingSphere(); group.add(batch);
  }
}
export class CampusEnvironment {
  readonly group = new THREE.Group();
  readonly buildings = new Map<string, BuildingView>();
  private lamps = new THREE.MeshStandardMaterial({ color: '#fff0ce', emissive: '#ffe1a0', emissiveIntensity: 0 });
  private lights: THREE.PointLight[] = [];
  constructor(readonly layout: Layout) {
    this.landscape();
    for (const b of layout.buildings ?? []) this.makeBuilding(b);
    this.details();
    instanceGroup(this.group);
  }

  private landscape() {
    const grass = surface('grass', '#697650', 95);
    box(this.group, [1400, 0.2, 1400], [0, -0.18, 0], grass).castShadow = false;
    for (const yard of this.layout.outdoors ?? []) {
      box(this.group, [yard.size[0], 0.08, yard.size[1]], [yard.center[0], -0.005, yard.center[1]], surface('concrete', '#adb0a7', 7));
      if (yard.kind === 'parking') for (let x = yard.center[0] - yard.size[0] / 2 + 2; x < yard.center[0] + yard.size[0] / 2; x += 3.8)
        box(this.group, [0.09, 0.02, 5], [x, 0.055, yard.center[1] + 2], material('#ecebdd'));
    }
    const asphalt = surface('asphalt', '#505653', 22), paint = material('#e3e0ce'), curb = material('#b9bbae');
    for (const road of this.layout.roads ?? []) for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), angle = Math.atan2(dx, dz);
      if (!length) continue;
      const r = box(this.group, [road.width, 0.1, length + road.width / 2], [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2], asphalt); r.rotation.y = angle;
      for (let s = 2; s < length - 2; s += 5) {
        const t = s / length, x = a[0] + dx * t, z = a[1] + dz * t;
        const dash = box(this.group, [0.14, 0.014, 2], [x, 0.061, z], paint); dash.rotation.y = angle; dash.castShadow = false;
      }
      if (road.public) continue;
      for (let s = 1; s < length; s += 2) for (const side of [-1, 1]) {
        const t = s / length, x = a[0] + dx * t + side * dz / length * (road.width / 2 + 0.45), z = a[1] + dz * t - side * dx / length * (road.width / 2 + 0.45);
        const access = this.layout.outdoors?.some((y) => Math.abs(x - y.center[0]) < y.size[0] / 2 + 1 && Math.abs(z - y.center[1]) < y.size[1] / 2 + 1);
        const intersection = this.layout.roads?.some((other) => other !== road && other.points.slice(1).some((end, j) => {
          const start = other.points[j]; return Math.abs(x - (start[0] + end[0]) / 2) < Math.abs(end[0] - start[0]) / 2 + other.width / 2 + 1 && Math.abs(z - (start[1] + end[1]) / 2) < Math.abs(end[1] - start[1]) / 2 + other.width / 2 + 1;
        }));
        if (access || intersection) continue;
        const c = box(this.group, [0.75, 0.15, 1.96], [x, 0.085, z], curb); c.rotation.y = angle;
      }
    }
    for (const x of [-87, -28, 63]) for (let dx = -4; dx <= 4; dx += 1.3) box(this.group, [0.65, 0.018, 9], [x + dx, 0.067, 3], paint).castShadow = false;
  }

  private makeBuilding(b: BuildingDef) {
    const root = new THREE.Group(); root.userData.buildingId = b.id; this.group.add(root);
    const roof = new THREE.Group(), walls: Record<string, THREE.Group> = {};
    const [x, z] = b.center, [w, d] = b.size, h = b.height;
    const concrete = surface('concrete', '#bcbdb4', 5), cladding = surface(b.id==='utility'?'concrete':'metal', b.id==='utility'?'#c1bca8':'#d2d5ca', 4), accent = material(b.color, 0.3), steel = material('#575e5a', 0.6, 0.48);
    box(root, [w, 0.12, d], [x, 0, z], surface('concrete', '#b3b4a8', 10));
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      const group = new THREE.Group(); walls[side] = group; root.add(group);
      const horizontal = side === 'north' || side === 'south', length = horizontal ? w : d;
      const direction = side === 'north' || side === 'west' ? -1 : 1;
      const doorDefs = b.doors.filter((door) => door.side === side).sort((a, c) => a.offset - c.offset);
      const wallPart = (start: number, end: number, height: number, base = 0) => {
        if (end - start <= 0) return;
        const center = (start + end) / 2;
        box(group, horizontal ? [end - start, height, 0.36] : [0.36, height, end - start], horizontal ? [x + center, base + height / 2, z + direction * d / 2] : [x + direction * w / 2, base + height / 2, z + center], cladding);
      };
      let cursor = -length / 2;
      for (const door of doorDefs) {
        wallPart(cursor, door.offset - door.width / 2, h);
        wallPart(door.offset - door.width / 2, door.offset + door.width / 2, h - door.height, door.height);
        const p = doorPosition(b, door);
        box(group, horizontal ? [door.width + 0.5, 0.45, 0.5] : [0.5, 0.45, door.width + 0.5], [p[0], door.height + 0.15, p[1]], accent);
        for (const offset of [-door.width / 2, door.width / 2]) box(group, horizontal ? [0.22, door.height, 0.55] : [0.55, door.height, 0.22], horizontal ? [p[0] + offset, door.height / 2, p[1]] : [p[0], door.height / 2, p[1] + offset], steel);
        const rotation = side === 'north' ? Math.PI : side === 'west' ? -Math.PI / 2 : side === 'east' ? Math.PI / 2 : 0;
        plaque(group, b.name, Math.min(length - 3, 19), [p[0] + (horizontal ? 0 : direction * 0.24), h - 2, p[1] + (horizontal ? direction * 0.24 : 0)], rotation);
        const canopy = box(group, horizontal ? [door.width + 2, 0.15, 3] : [3, 0.15, door.width + 2], [p[0] + (horizontal ? 0 : direction * 1.5), door.height + 0.6, p[1] + (horizontal ? direction * 1.5 : 0)], accent);
        canopy.receiveShadow = true;
        cursor = door.offset + door.width / 2;
      }
      wallPart(cursor, length / 2, h);
      box(group, horizontal ? [length, 0.45, 0.39] : [0.39, 0.45, length], horizontal ? [x, h - 3, z + direction * d / 2] : [x + direction * w / 2, h - 3, z], accent);
      box(group, horizontal ? [length, 0.9, 0.4] : [0.4, 0.9, length], horizontal ? [x, 0.45, z + direction * d / 2] : [x + direction * w / 2, 0.45, z], concrete);
      // The plinth is split at loading doors too: clear portal down to the floor.
      if (doorDefs.length) { group.remove(group.children[group.children.length - 1]); for (const [a, c] of [[-length / 2, doorDefs[0].offset - doorDefs[0].width / 2], [doorDefs[doorDefs.length - 1].offset + doorDefs[doorDefs.length - 1].width / 2, length / 2]]) {
        if (c > a) box(group, horizontal ? [c - a, 0.9, 0.4] : [0.4, 0.9, c - a], horizontal ? [x + (a + c) / 2, 0.45, z + direction * d / 2] : [x + direction * w / 2, 0.45, z + (a + c) / 2], concrete);
      } }
      for (let s = -length / 2 + 3; s < length / 2 - 2; s += 5) {
        const p: [number, number, number] = horizontal ? [x + s, h - 1.3, z + direction * (d / 2 + 0.21)] : [x + direction * (w / 2 + 0.21), h - 1.3, z + s];
        box(group, horizontal ? [2.8, 1.2, 0.13] : [0.13, 1.2, 2.8], p, steel);
        box(group, horizontal ? [2.55, 0.98, 0.15] : [0.15, 0.98, 2.55], [p[0] + (horizontal ? 0 : direction * 0.08), p[1], p[2] + (horizontal ? direction * 0.08 : 0)], material('#78999c', 0.65, 0.22));
      }
      // Personnel door, gutter and downpipes.
      const p: [number, number, number] = horizontal ? [x - length / 2 + 2, 1.2, z + direction * (d / 2 + 0.22)] : [x + direction * (w / 2 + 0.22), 1.2, z - length / 2 + 2];
      box(group, horizontal ? [1.15, 2.4, 0.12] : [0.12, 2.4, 1.15], p, accent);
      for (const s of [-length / 2 + 0.6, length / 2 - 0.6]) cylinder(group, 0.09, h, horizontal ? [x + s, h / 2, z + direction * (d / 2 + 0.3)] : [x + direction * (w / 2 + 0.3), h / 2, z + s], steel);
    }
    if (!['receiving','raw','warehouse','utility'].includes(b.id)) for (let px = -w / 2 + 0.8; px <= w / 2; px += 7) for (const pz of [-d / 2 + 0.8, d / 2 - 0.8]) box(root, [0.35, h, 0.35], [x + px, h / 2, z + pz], steel);
    if (!['receiving','raw','warehouse','utility'].includes(b.id)) for (let px = -w / 2 + 4; px < w / 2; px += 9) for (const pz of [-d / 4, d / 4]) box(root, [3, 0.12, 0.32], [x + px, h - 0.8, z + pz], this.lamps);
    const light = new THREE.PointLight('#fff0d5', 35, Math.max(w, d), 1.2); light.position.set(x, h - 1, z); light.userData.buildingId = b.id; root.add(light); this.lights.push(light);
    const aisles: Record<string, [Point2, Point2]> = {
      receiving: [[-79,-51],[-79,-31]], raw: [[-78,19],[-78,50]], dye: [[-25,-50],[-25,-12]],
      finish: [[63,-32],[63,-13]], garment: [[56,21],[56,54]], warehouse: [[-7,24],[-7,61]],
    };
    const aisle = ['receiving','raw','warehouse','utility'].includes(b.id) ? undefined : aisles[b.id];
    if (aisle) for (const side of [-1,1]) box(root, [0.07, 0.015, aisle[1][1] - aisle[0][1]], [aisle[0][0] + side * 1.6, 0.075, (aisle[0][1] + aisle[1][1]) / 2], material('#c4ac5d'));
    if (b.id === 'dye' && w > 100) {
      // Continuous interior transport corridor links dyeing, finishing and final inspection.
      for (const side of [-1, 1]) {
        if(this.layout.dyeRevision===1) {
          for(const az of [-41,-29])box(root,[121,.015,.07],[19,.075,az+side*1.6],material('#c4ac5d'));
        } else {
          box(root, [107, 0.015, 0.07], [22.5, 0.075, -12 + side * 1.6], material('#c4ac5d'));
          box(root, [0.07, 0.015, 19], [63 + side * 1.6, 0.075, -22.5], material('#c4ac5d'));
        }
      }
    }
    for (const room of b.rooms ?? []) {
      const [rx, rz] = room.center, [rw, rd] = room.size, rh = 4;
      for (const sx of [-1, 1]) {
        if (sx === 1) {
          box(root, [0.15, rh, Math.max(0.1, room.doorZ - 2 - (rz - rd / 2))], [rx + rw / 2, rh / 2, (rz - rd / 2 + room.doorZ - 2) / 2], material('#d5d2c0'));
          box(root, [0.15, rh, Math.max(0.1, rz + rd / 2 - (room.doorZ + 2))], [rx + rw / 2, rh / 2, (rz + rd / 2 + room.doorZ + 2) / 2], material('#d5d2c0'));
        } else box(root, [0.15, rh, rd], [rx - rw / 2, rh / 2, rz], material('#d5d2c0'));
      }
      for (const sz of [-1, 1]) box(root, [rw, rh, 0.15], [rx, rh / 2, rz + sz * rd / 2], material('#d5d2c0'));
      plaque(root, room.name, 8, [rx, 3, rz + rd / 2 + 0.15]);
    }
    root.add(roof);
    const rise = 2, angle = Math.atan2(rise, d / 2), slant = Math.hypot(d / 2, rise);
    const roofMat = surface('metal', '#858f87', 8);
    for (const side of [-1, 1]) {
      const panel = box(roof, [w + 1.3, 0.18, slant + 0.7], [x, h + rise / 2, z + side * d / 4], roofMat); panel.rotation.x = side * angle;
      box(roof, [w + 1.3, 0.2, 0.22], [x, h - 0.05, z + side * (d / 2 + 0.6)], steel);
    }
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(0, rise); shape.lineTo(d / 2, 0); shape.closePath();
      const end = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#afb7ad', side: THREE.DoubleSide }));
      end.rotation.y = Math.PI / 2; end.position.set(x + side * w / 2, h, z); roof.add(end);
    }
    // Skylights, extractors and ridge cap break up the industrial roof silhouette.
    box(roof, [w + 1, 0.25, 0.45], [x, h + rise + 0.08, z], steel);
    for (let px = x - w / 2 + 6; px < x + w / 2 - 4; px += 10) {
      const skylight = box(roof, [4, 0.17, 3], [px, h + 1.25, z - d / 4], material('#a7c2c0', 0.6, 0.23)); skylight.rotation.x = -angle;
      cylinder(roof, 0.45, 1.3, [px, h + 2.7, z], steel);
      cylinder(roof, 0.7, 0.25, [px, h + 3.45, z], accent);
    }
    if (b.id === 'utility' && !this.layout.energyRevision) { cylinder(roof, 0.6, 13, [x + 6, h + 6, z - 3], material('#806d57', 0.45)); cylinder(roof, 0.78, 0.35, [x + 6, h + 12.4, z - 3], steel); }
    if(b.id==='power'){
      for(const xx of [-5,4.5]){box(root,[.28,.12,10],[x+xx,h-1,z],steel);for(const zz of [-4,0,4])box(root,[.06,1,.06],[x+xx,h-.5,z+zz],steel);}
      box(root,[9.5,.12,.28],[x,h-1,z+4],steel);
      for(const xx of [-6.2,-3.8,1.5,7.5])box(root,[.07,.02,11],[x+xx,.08,z],material('#d9ba42'));
      plaque(root,'GÜNEŞ / BATARYA MERKEZİ',10,[x,4,z-6.7]);
    }
    if(this.layout.solarRevision)solarRoof(roof,b);
    this.buildings.set(b.id, { def: b, group: root, roof, walls });
  }

  private details() {
    const steel = material('#53625c', 0.65), fence = material('#788278', 0.55), white = material('#eee9d9'), yellow = material('#dcb34e');
    // Perimeter fencing with a real opening at the southern entrance.
    for (const side of ['north', 'south', 'east', 'west']) {
      const horizontal = side === 'north' || side === 'south', length = horizontal ? 240 : 180, edge = side === 'north' || side === 'west' ? -1 : 1;
      for (let s = -length / 2 + 1; s < length / 2; s += 4) {
        if (side === 'south' && s > -69 && s < -54) continue;
        const x = horizontal ? s : edge * 119, z = horizontal ? edge * 89 : s;
        box(this.group, [0.09, 2.6, 0.09], [x, 1.3, z], steel);
        for (const y of [0.4, 1.4, 2.5]) box(this.group, horizontal ? [4, 0.055, 0.055] : [0.055, 0.055, 4], [x + (horizontal ? 2 : 0), y, z + (horizontal ? 0 : 2)], fence);
        for (let offset = 0.5; offset < 4; offset += 0.5) box(this.group, [0.028, 2.3, 0.028], [x + (horizontal ? offset : 0), 1.35, z + (horizontal ? 0 : offset)], fence);
      }
    }
    box(this.group, [8, 3.2, 6], [-49, 1.6, 85], material('#c8c9bc'));
    box(this.group, [8.6, 0.25, 6.6], [-49, 3.3, 85], steel);
    box(this.group, [5, 1.4, 0.1], [-49, 2, 88.06], material('#739a9d', 0.55, 0.15));
    plaque(this.group, 'GÜVENLİK / GİRİŞ', 7, [-49, 3, 88.18]);
    box(this.group, [0.7, 1.1, 0.7], [-56, 0.55, 90], yellow);
    box(this.group, [7.5, 0.12, 0.14], [-60, 1.2, 90], white);
    for (let x = -63; x < -57; x += 1.2) box(this.group, [0.5, 0.14, 0.17], [x, 1.2, 90], material('#b75742'));
    plaque(this.group, 'DOKUMA · TEKSTİL YERLEŞKESİ', 20, [-84, 4.5, 91]);
    for (const x of [-93, -75]) box(this.group, [0.2, 4.5, 0.2], [x, 2.25, 91], steel);
    for (let x = -108; x < 109; x += 27) for (const z of [-6, 12, 78]) {
      if (z === 78 && x > 45) continue;
      cylinder(this.group, 0.09, 6, [x, 3, z], steel);
      box(this.group, [1.5, 0.1, 0.45], [x + 0.6, 6.05, z], this.lamps);
      if (x % 2 === 0 && z === 12) { const light = new THREE.PointLight('#ffdeb1', 0, 25, 2); light.position.set(x, 5.8, z); this.group.add(light); this.lights.push(light); }
    }
    for (const [x, z] of [[-113,-65],[-113,-35],[-113,35],[112,-65],[112,35],[110,64],[-5,74],[5,70],[100,87],[-98,86],[-14,-82],[53,-75],[76,-72],[99,-75]] as Point2[]) this.tree(x, z);
    for (let i = 0; i < 28; i++) this.tree(-160 + i * 13, -120 - (i % 4) * 11);
    for (let i = 0; i < 7; i++) this.car(58 + i * 4.6, 80, ['#c3c7b9', '#385e6a', '#825346', '#c6bc9d'][i % 4]);
    for (const b of this.layout.buildings ?? []) {
      const d = b.doors[0], p = doorPosition(b, d);
      if (d.side === 'west') continue;
      for (const sx of [-1, 1]) cylinder(this.group, 0.13, 1, [p[0] + sx * 4.7, 0.5, p[1] + (d.side === 'north' ? -1 : 1)], yellow);
    }
  }
  private tree(x: number, z: number) {
    if ((this.layout.buildings ?? []).some(b => Math.abs(x-b.center[0]) < b.size[0]/2+3.5 && Math.abs(z-b.center[1]) < b.size[1]/2+3.5)) return;
    cylinder(this.group, 0.22, 3.5, [x, 1.75, z], material('#70614a'));
    for (const [dx, dy, dz, r] of [[0,5,0,2.3],[-1.1,4.1,0.4,1.8],[1,4.4,-0.3,1.7]]) {
      const crown = new THREE.Mesh(sphereGeometry, material('#526b42')); crown.position.set(x + dx, dy, z + dz); crown.scale.set(r, r * 1.25, r); crown.castShadow = true; this.group.add(crown);
    }
  }
  private car(x: number, z: number, color: string) {
    const g = new THREE.Group(); g.position.set(x, 0, z); this.group.add(g);
    box(g, [1.7, 0.6, 3.9], [0, 0.6, 0], material(color, 0.45, 0.35));
    box(g, [1.4, 0.65, 2], [0, 1.15, -0.25], material('#536e73', 0.65, 0.15));
    box(g, [1.45, 0.12, 1.4], [0, 1.52, -0.25], material(color, 0.45, 0.35));
    for (const sx of [-1,1]) for (const sz of [-1,1]) { const wheel = cylinder(g, 0.34, 0.23, [sx * 0.84, 0.34, sz * 1.2], material('#292e2c')); wheel.rotation.z = Math.PI / 2; }
    for (const sx of [-0.55,0.55]) box(g, [0.32, 0.18, 0.08], [sx, 0.7, 1.98], this.lamps);
  }

  inspect(id: string | null, camera: THREE.Camera) {
    for (const light of this.lights) if (light.userData.buildingId) light.visible = light.userData.buildingId === id;
    for (const [key, b] of this.buildings) {
      const open = key === id; b.roof.visible = !open;
      for (const [side, wall] of Object.entries(b.walls)) wall.visible = !open || (side === 'east' ? camera.position.x < b.def.center[0] : side === 'west' ? camera.position.x > b.def.center[0] : side === 'south' ? camera.position.z < b.def.center[1] : camera.position.z > b.def.center[1]);
    }
  }
  daylight(day: number) {
    this.lamps.emissiveIntensity = 0.15 + (1 - day) * 2.5;
    for (const light of this.lights) light.intensity = 12 + (1 - day) * 45;
    for (const light of this.lights) if (!light.userData.buildingId) light.visible = day < 0.4;
    const glass = material('#78999c', 0.65, 0.22); glass.emissive.set('#edc984'); glass.emissiveIntensity = (1 - day) * 0.42;
  }
  dispose() {
    // Shared materials and primitives are retained; release per-building plaque textures.
    this.group.traverse((o) => { if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.material instanceof THREE.MeshStandardMaterial && o.material.map && ![...materials.values()].includes(o.material)) { o.material.map.dispose(); o.material.dispose(); } });
  }
}

