import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { LotKind, MachineType } from './types';
import type { CarrierKind } from './transport';

export interface AssetDef { file: string; rotationY?: number; loadPoint?: [number, number, number] }
export interface AssetManifest {
  machines?: Partial<Record<MachineType, string | AssetDef>>;
  stations?: Record<string, string | AssetDef>;
  carriers?: Partial<Record<CarrierKind, string | AssetDef>>;
  cargo?: Partial<Record<LotKind, string | AssetDef>>;
}
const defaults: AssetManifest = {
  machines: { ht_jet: 'ht.glb', stenter: 'ramoz.glb', compactor: 'kompaktor.glb', inspection: 'kumas-kontrol.glb', cart: 'kumas-araba.glb', boiler: 'buhar-kazani.glb', dyeprep: 'boya-hazirlama.glb', truck_out: 'kamyon.glb', cut: 'konfeksiyon/kesim-makinesi.glb', sew: 'konfeksiyon/dikis-istasyonu.glb', iron: 'konfeksiyon/utu-masasi.glb', pack: 'konfeksiyon/paketleme-masasi.glb', pallet: 'konfeksiyon/palet-koli.glb' },
  stations: { 'GQC-01': 'konfeksiyon/kalite-kontrol-masasi.glb' },
  carriers: { forklift: 'forklift.glb', fabric_cart: 'kumas-araba.glb', trolley: 'tasima-arabasi.glb' },
  cargo: { raw_roll: 'kumas-topu.glb', finished_roll: 'kumas-topu.glb', garment_box: 'koli.glb', pallet: 'konfeksiyon/palet-koli.glb', cut_bundle: 'kesim-demeti.glb', dyed_batch: 'boyali-kumas.glb' },
};
Object.assign(defaults.machines!, { rope_open:'halat-acma.glb',centrifuge:'santrifuj.glb',dryer:'kurutma.glb',water_treatment:'su-aritma.glb',compressor:'kompresor.glb',tank:'dikey-tank.glb',spread:'konfeksiyon/serim-makinesi.glb',hanger:'konfeksiyon/aski-tasima-sistemi.glb',form_finish:'konfeksiyon/form-finisher.glb',conveyor:'konfeksiyon/rulo-konveyor.glb' });
const def = (value: string | AssetDef): AssetDef => typeof value === 'string' ? { file: value } : value;
export function assetUrl(file: string) {
  if (/^(?:https?:|blob:|data:|\/)/.test(file)) return file;
  return `${import.meta.env.BASE_URL}assets/${file}`;
}
export class AssetLibrary {
  private loader = new GLTFLoader();
  private requests = new Map<string, Promise<THREE.Object3D | null>>();
  private manifest = this.readManifest();
  private async readManifest(): Promise<AssetManifest> {
    try {
      const r = await fetch(assetUrl('manifest.json'));
      if (r.ok && !r.headers.get('content-type')?.includes('text/html')) {
        const m = await r.json() as AssetManifest;
        return { machines: { ...defaults.machines, ...m.machines }, stations: { ...defaults.stations, ...m.stations }, carriers: { ...defaults.carriers, ...m.carriers }, cargo: { ...defaults.cargo, ...m.cargo } };
      }
    } catch(error) { console.warn('Model eşleme dosyası okunamadı; standart asset adları kullanılıyor.',error); }
    return defaults;
  }
  async definition(group: keyof AssetManifest, key: string): Promise<AssetDef | undefined> {
    const entries = (await this.manifest)[group] as Record<string, string | AssetDef> | undefined;
    const entry = entries?.[key]; return entry ? def(entry) : undefined;
  }
  load(file: string, preserveParts = false): Promise<THREE.Object3D | null> {
    const url = assetUrl(file);
    const key=url+(preserveParts?'#parts':'');
    if (!this.requests.has(key)) this.requests.set(key, (async () => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return null;
        const gltf = await this.loader.loadAsync(url);
        if (/forklift/i.test(file)) identifyForks(gltf.scene);
        const scene = preserveParts || gltf.animations.length ? gltf.scene : batchStaticAsset(gltf.scene);
        scene.userData.assetUrl = url;
        scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; o.userData.sharedAsset = true; } });
        return scene;
      } catch (error) { console.warn(`Model yüklenemedi: ${url}`, error); return null; }
    })());
    return this.requests.get(key)!;
  }
}

export function identifyForks(source: THREE.Object3D) {
  source.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(source), size = all.getSize(new THREE.Vector3()), center = all.getCenter(new THREE.Vector3());
  source.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
    if (b.min.x > center.x + size.x * 0.045 && s.y < size.y * 0.07 && s.x > size.x * 0.15 && s.x > s.z * 3 && b.min.y < all.min.y + size.y * 0.3) o.userData.motion = 'fork';
  });
}

/** Imported procedural GLBs often contain hundreds of small meshes of the same material. */
export function batchStaticAsset(source: THREE.Object3D): THREE.Object3D {
  let supported = true;
  source.traverse((o) => { if (o instanceof THREE.SkinnedMesh || (o instanceof THREE.Mesh && (Array.isArray(o.material) || Object.keys(o.geometry.morphAttributes).length))) supported = false; });
  if (!supported) return source;
  source.updateMatrixWorld(true);
  const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  const moving: THREE.Mesh[] = [];
  source.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.userData.motion) {
      const mesh = new THREE.Mesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material);
      mesh.userData = { ...o.userData }; moving.push(mesh); return;
    }
    const m = o.material as THREE.MeshStandardMaterial;
    const key = [m.type, m.color?.getHex(), m.metalness, m.roughness, m.emissive?.getHex(), m.emissiveIntensity, m.opacity, m.transparent, m.side, m.map?.uuid, m.normalMap?.uuid, m.roughnessMap?.uuid, m.alphaMap?.uuid, m.vertexColors, Object.keys(o.geometry.attributes).sort().join(','), !!o.geometry.index].join(':');
    if (!groups.has(key)) groups.set(key, { material: m, geometries: [] });
    groups.get(key)!.geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  if (!groups.size) return source;
  const result = new THREE.Group();
  if (moving.length) result.add(...moving);
  for (const { material, geometries } of groups.values()) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) { geometries.forEach((g) => g.dispose()); return source; }
    result.add(new THREE.Mesh(geometry, material)); geometries.forEach((g) => g.dispose());
  }
  return result;
}
/** Keep source resources shared and normalize authored units/orientation to metre bounds. */
export function fitAsset(source: THREE.Object3D, size: [number, number, number], rotationY = 0): THREE.Group {
  const object = clone(source); object.rotation.y += rotationY * Math.PI / 180;
  const b = new THREE.Box3().setFromObject(object), dims = b.getSize(new THREE.Vector3());
  const k = Math.min(...size.map((s, i) => s / Math.max(0.001, dims.getComponent(i))));
  object.scale.multiplyScalar(k);
  const fitted = new THREE.Box3().setFromObject(object), center = fitted.getCenter(new THREE.Vector3());
  object.position.add(new THREE.Vector3(-center.x, -fitted.min.y, -center.z));
  const root = new THREE.Group(); root.userData.assetUrl = source.userData.assetUrl; root.add(object); return root;
}
