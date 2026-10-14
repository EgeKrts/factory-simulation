import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { carrierKind, transferDuration, transferPose, PICKUP_SECONDS, transportSpeed } from './transport';
import { TransportFleet } from './logisticsView';
import { AssetLibrary, fitAsset, batchStaticAsset, identifyForks } from './assets';
import { pathLength } from './routes';
import type { LotSnap, Point2 } from './types';
import { dressGarmentModel, animateGarment } from './garmentView';
import type { MachineDef } from './types';
import { ModelBatches } from './modelBatches';
import { dressDyeModel, animateDye } from './dyeView';

const route: Point2[] = [[0,0], [10,0], [10,20]];
assert.equal(carrierKind('pallet', false), 'forklift');
assert.equal(carrierKind('garment_box', false), 'trolley');
assert.equal(carrierKind('dyed_batch', false), 'fabric_cart');
assert.equal(carrierKind('raw_roll', true), 'forklift');
for (const kind of ['forklift', 'fabric_cart', 'trolley'] as const) {
  const duration = transferDuration(route, kind);
  const pickup = transferPose(route, kind, 3 / duration);
  assert.equal(pickup.phase, 'pickup'); assert.deepEqual(pickup.point, route[0]);
  const middle = transferPose(route, kind, (PICKUP_SECONDS + 15 / transportSpeed(kind)) / duration);
  assert.equal(middle.phase, 'travel'); assert(Math.hypot(middle.point[0] - 10, middle.point[1] - 5) < 1e-8);
  const end = transferPose(route, kind, 1);
  assert.equal(end.phase, 'unload'); assert.deepEqual(end.point, route[2]); assert(end.lift < 1e-8);
}

const scene = new THREE.Scene();
const library = { definition: async () => undefined, load: async () => null } as unknown as AssetLibrary;
const fleet = new TransportFleet(scene, library);
const cargo = new THREE.Group();
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshStandardMaterial()); mesh.position.y = 0.4; cargo.add(mesh);
const lot: LotSnap = { id: 'LOAD', kind: 'pallet', color: '#fff', kg: 500, place: 'transit', route, progress: 0.5, carrier: 'forklift' };
fleet.sync(20, new Set(['LOAD'])); fleet.carry(lot, cargo, 'forklift');
assert.equal(cargo.parent?.name, 'loadSocket', 'Cargo must belong to the vehicle hierarchy.');
const root = cargo.parent!.parent!;
assert.equal(root.userData.carrierKind, 'forklift');
scene.updateMatrixWorld(true);
const bottom = new THREE.Box3().setFromObject(cargo).min.y;
assert(Math.abs(bottom - 0.25) < 1e-6, 'Loaded pallet rides at low fork travel height.');
const socket = cargo.parent!;
const forks = root.userData.forks as THREE.Object3D;
assert(Math.abs(forks.position.y - socket.position.y - 0.06) < 1e-6, 'Forks stay within the pallet fork pocket.');
const at = cargo.getWorldPosition(new THREE.Vector3()); root.rotation.y += 0.8; root.position.x += 5;
assert(cargo.getWorldPosition(new THREE.Vector3()).distanceTo(at) > 4, 'Cargo follows vehicle turns and translation.');
scene.attach(cargo); fleet.release('LOAD');
assert.equal(root.userData.transportPhase, 'return'); assert.equal(cargo.parent, scene, 'Return trip must be empty.');
fleet.sync(20 + pathLength(route) / 2.2 / 2, new Set());
assert(root.parent === scene, 'Vehicle must remain visible while returning.');
const pausedPosition = root.position.clone(); fleet.sync(20 + pathLength(route) / 2.2 / 2, new Set());
assert(root.position.equals(pausedPosition), 'Paused simulation must pause returning vehicles.');
fleet.sync(20 + pathLength(route) / 2.2 + 1, new Set()); assert.equal(root.parent, null);
fleet.reset();

const handLoad = new THREE.Group(); const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7)); parcel.position.y = 0.3; handLoad.add(parcel);
fleet.sync(50, new Set(['BOX']));
fleet.carry({ ...lot, id: 'BOX', kind: 'garment_box', progress: 0.5 }, handLoad, 'trolley');
scene.updateMatrixWorld(true);
assert(Math.abs(new THREE.Box3().setFromObject(handLoad).min.y - 0.48) < 1e-6, 'Cart loads must rest on its deck.');
fleet.carry({ ...lot, id: 'BOX', kind: 'garment_box', progress: 1 }, handLoad, 'trolley');
scene.updateMatrixWorld(true);
assert(Math.abs(new THREE.Box3().setFromObject(handLoad).min.y) < 1e-6, 'Cart unload finishes on the floor, without a vertical jump.');
assert(handLoad.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(10,0,20)) < 1e-6, 'Unloading must not move cargo away from its reserved bay.');
fleet.reset();

const authored = new THREE.Group(); authored.position.set(1000, 20, -900);
authored.add(new THREE.Mesh(new THREE.BoxGeometry(1200, 800, 900), new THREE.MeshStandardMaterial()));
const originalBounds = new THREE.Box3().setFromObject(authored);
const fitted = fitAsset(authored, [1.2,0.8,0.9], 90);
const bounds = new THREE.Box3().setFromObject(fitted), size = bounds.getSize(new THREE.Vector3());
assert(Math.abs(bounds.min.y) < 1e-6); assert(size.x <= 1.2 + 1e-6 && size.y <= 0.8 + 1e-6 && size.z <= 0.9 + 1e-6);
assert(new THREE.Box3().setFromObject(authored).equals(originalBounds), 'Asset normalization must not mutate the cached model.');
console.log('PASS: load/unload timing, carrier selection, physical load socket, fork height, empty return, pause and asset units.');

const staticModel = new THREE.Group();
staticModel.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: '#ddd'})));
const second = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: '#ddd'})); second.position.x = 3; staticModel.add(second);
const errors: unknown[][] = [], originalError = console.error;
console.error = (...args) => errors.push(args);
const batched = batchStaticAsset(staticModel);
console.error = originalError;
assert.equal(errors.length, 0, 'Static assets must not call Object3D.add without objects.');
assert.equal(batched.children.length, 1); assert(new THREE.Box3().setFromObject(batched).equals(new THREE.Box3().setFromObject(staticModel)));

async function verifyProvidedForklift() {
  const filename = 'public/assets/forklift.glb'; if (!existsSync(filename)) return;
  const bytes = readFileSync(filename);
  const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  identifyForks(model.scene); const optimized = batchStaticAsset(model.scene);
  const providedLibrary = {
    definition: async (_group: string, key: string) => key === 'forklift' ? { file: 'forklift.glb' } : undefined,
    load: async () => optimized,
  } as unknown as AssetLibrary;
  const testScene = new THREE.Scene(), testFleet = new TransportFleet(testScene, providedLibrary);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const load = cargo.clone(true);
  testFleet.sync(0, new Set(['PROVIDED'])); testFleet.carry({ ...lot, id:'PROVIDED', progress:0.5 }, load, 'forklift');
  testScene.updateMatrixWorld(true);
  const vehicle = load.parent!.parent!, forks = vehicle.userData.assetForks as THREE.Mesh[];
  assert.equal(forks.length, 2, 'Provided forklift must retain both moving forks after batching.');
  for (const fork of forks) assert(Math.abs(new THREE.Box3().setFromObject(fork).max.y - 0.37) < 1e-5, 'Imported forks must track the pallet pocket at travel height.');
  assert.equal((vehicle.userData.forks as THREE.Object3D).visible, false, 'Imported forks replace procedural forks.');
  testFleet.reset();
  console.log('PASS: provided forklift GLB, two animated forks, pallet contact and static asset batching.');
}
void verifyProvidedForklift().catch((error) => { console.error(error); process.exitCode = 1; });

const sewingDef:MachineDef={id:'SEW-01',type:'sew',area:'garment',position:[0,0,0],rotationY:0,params:{},next:[]};
const sewing=dressGarmentModel(new THREE.Group(),sewingDef);
animateGarment(sewing,1,true,.2);
let hands:THREE.InstancedMesh|undefined, movingHanger:THREE.Object3D|undefined;
sewing.traverse(o=>{if(o.userData.garmentMotion==='handBatch')hands=o as THREE.InstancedMesh;if(o.userData.garmentMotion==='hanger')movingHanger=o;});
assert(hands && movingHanger, 'Batching must retain moving operators and hanging garments.');
assert.equal(hands.count,48,'All 24 sewing operators need both working hands.');
const firstPose=new THREE.Matrix4();hands.getMatrixAt(0,firstPose);
const hangerPose=movingHanger.position.clone();
animateGarment(sewing,2,true,.4);
const nextPose=new THREE.Matrix4();hands.getMatrixAt(0,nextPose);
assert(!firstPose.equals(nextPose)); assert(!movingHanger.position.equals(hangerPose));
const stoppedHanger=movingHanger.position.clone();animateGarment(sewing,5,false,0);
assert(movingHanger.position.equals(stoppedHanger),'Stopped line must hold its overhead garments in place.');
assert.equal(movingHanger.position.y,3.5,'Hangers remain supported by the overhead rail.');
console.log('PASS: garment working operators, instanced hands, moving rail garments and stopped-line hold.');

const batching=new ModelBatches(),batchScene=new THREE.Scene();batchScene.add(batching.group);
const machineGeometry=new THREE.BoxGeometry(2,2,2),machineMaterial=new THREE.MeshStandardMaterial();
const originals=[0,5].map(x=>{const root=new THREE.Group();root.position.x=x;const mesh=new THREE.Mesh(machineGeometry,machineMaterial);mesh.userData.sharedAsset=true;root.add(mesh);batchScene.add(root);return root;});
batching.rebuild(originals);const joined=batching.group.children[0] as THREE.InstancedMesh;
assert.equal(joined.count,2,'Repeated imported geometry should use one draw batch.');
const pickRay=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));
assert(pickRay.intersectObjects(originals,true).length>0,'Batched original geometry must remain usable for precise machine picking.');
originals[1].visible=false;batching.sync();assert.equal(joined.count,1,'Closed buildings must not draw their machines.');
originals[0].position.x=3;batching.sync();const movedMatrix=new THREE.Matrix4();joined.getMatrixAt(0,movedMatrix);assert.equal(movedMatrix.elements[12],3);
batching.reset();assert(originals[0].children[0].visible,'Reset must restore original models when editing or removing machines.');
const wetModel=dressDyeModel(new THREE.Group(),{...sewingDef,id:'CENT-01',type:'centrifuge',area:'finishing'});
const wetState={id:'CENT-01',status:'RUNNING',progress:.2,telemetry:{rpm:500},counters:{good:0,reject:0,runtimeS:1,downtimeS:0},queue:0} as const;
animateDye(wetModel,wetState,1);
const drum=wetModel.children[0].children.find(o=>o.userData.motion==='dye-drum')!;const angle=drum.rotation.y;
animateDye(wetModel,{...wetState,status:'DOWN',progress:.2},2);assert.equal(drum.rotation.y,angle,'Fault must stop centrifuge motion.');
console.log('PASS: repeated GLB instancing, hidden-building culling, exact picking, editing transforms and dye-machine fault animation.');
