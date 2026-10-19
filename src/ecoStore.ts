import * as THREE from 'three';
import { instanceGroup } from './environment';

export interface EcoStore {
  readonly group: THREE.Group;
  readonly center: [number, number, number];
  readonly size: [number, number];
  setOpen(open: boolean): void;
  setLabelsVisible(visible: boolean): void;
  overview(): { pos: THREE.Vector3; target: THREE.Vector3 };
}

const CX = -92;
const CZ = 99;
const W = 34; // x: -109 .. -75
const D = 22; // z: 88 .. 110
const H = 4.6;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 18);
const unitSphere = new THREE.SphereGeometry(1, 16, 12);

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.72, metalness = 0.06, opacity = 1): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}|${opacity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 0.95,
    });
    matCache.set(key, m);
  }
  return m;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  pos: [number, number, number],
  material: THREE.Material,
  rotY = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(unitBox, material);
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rotY) m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(
  parent: THREE.Object3D,
  r: number,
  h: number,
  pos: [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(unitCyl, material);
  m.scale.set(r, h, r);
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function sphere(
  parent: THREE.Object3D,
  r: [number, number, number],
  pos: [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(unitSphere, material);
  m.scale.set(r[0], r[1], r[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Tuval tabanlı şık tabela / poster / ekran dokusu üretir. */
function makeBoardTexture(
  title: string,
  sub: string,
  bg = '#152822',
  fg = '#f4efe6',
  accent = '#84cc16',
  badge?: string,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = accent;
  g.lineWidth = 6;
  g.strokeRect(10, 10, c.width - 20, c.height - 20);

  if (badge) {
    g.fillStyle = accent;
    g.beginPath();
    g.roundRect(26, 26, 128, 38, 10);
    g.fill();
    g.fillStyle = '#0f172a';
    g.font = '700 20px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(badge, 90, 45);
  }

  g.fillStyle = fg;
  g.font = '700 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, c.width / 2, badge ? 102 : 76, c.width - 48);

  g.fillStyle = accent;
  g.font = '600 21px system-ui, sans-serif';
  g.fillText(sub, c.width / 2, badge ? 148 : 132, c.width - 48);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelSprite(title: string, sub: string, accent: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(12, 24, 21, 0.88)';
  g.beginPath();
  g.roundRect(8, 8, c.width - 16, c.height - 16, 24);
  g.fill();
  g.strokeStyle = accent;
  g.lineWidth = 4;
  g.stroke();

  g.fillStyle = accent;
  g.beginPath();
  g.arc(46, 64, 14, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#f8fafc';
  g.font = '700 30px system-ui, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(title, 76, 48, 412);

  g.fillStyle = '#a7f3d0';
  g.font = '500 21px system-ui, sans-serif';
  g.fillText(sub, 76, 84, 412);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(6.8, 1.7, 1);
  sp.userData.noPick = true;
  return sp;
}

/** Mağaza çalışanı veya müşteri figürü */
function addPerson(
  parent: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  topColor: string,
  bottomColor: string,
  hairColor: string,
  opts?: { apron?: string; bagColor?: string; female?: boolean },
) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);

  const skin = mat('#eccab0', 0.65);
  const shoe = mat('#27272a', 0.6);
  const top = mat(topColor, 0.68);
  const bot = mat(bottomColor, 0.72);
  const hair = mat(hairColor, 0.75);

  for (const sx of [-0.09, 0.09]) {
    box(g, [0.1, 0.07, 0.22], [sx, 0.035, 0.03], shoe);
    cyl(g, 0.06, 0.72, [sx, 0.42, 0], bot);
  }
  if (opts?.female) {
    box(g, [0.34, 0.34, 0.24], [0, 0.72, 0], bot);
  }
  box(g, [0.34, 0.5, 0.2], [0, 1.04, 0], top);
  // Önlük (mağaza danışmanı / kasiyer için)
  if (opts?.apron) {
    box(g, [0.3, 0.46, 0.215], [0, 0.96, 0.01], mat(opts.apron, 0.65));
  }
  for (const sx of [-0.21, 0.21]) {
    cyl(g, 0.05, 0.44, [sx, 1.02, 0.04], top);
    sphere(g, [0.048, 0.048, 0.048], [sx, 0.8, 0.08], skin);
  }
  // Alışveriş çantası
  if (opts?.bagColor) {
    box(g, [0.08, 0.32, 0.26], [0.28, 0.62, 0.08], mat(opts.bagColor, 0.75));
    box(g, [0.02, 0.12, 0.1], [0.28, 0.81, 0.08], mat('#785c3a', 0.8));
  }
  cyl(g, 0.05, 0.1, [0, 1.33, 0], skin);
  sphere(g, [0.115, 0.13, 0.115], [0, 1.45, 0], skin);
  sphere(g, [0.122, 0.11, 0.125], [0, 1.49, -0.015], hair);
  if (opts?.female) {
    sphere(g, [0.065, 0.14, 0.065], [0, 1.42, -0.11], hair);
  }
}

/** Vitrin ve podyum mankeni (Eco-Tex koleksiyon giysili) */
function addMannequin(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rotY: number,
  garmentColor: string,
  accentColor: string,
  longDress = true,
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);

  const brass = mat('#c8a25a', 0.32, 0.75);
  const woodMannequin = mat('#e5d0b1', 0.55);
  const dressMat = mat(garmentColor, 0.68);
  const sashMat = mat(accentColor, 0.6);

  // Pirinç taban ve dikme
  cyl(g, 0.22, 0.04, [0, 0.02, 0], brass);
  cyl(g, 0.028, 0.85, [0, 0.45, 0], brass);

  // Elbise / bornoz / takım gövdesi
  if (longDress) {
    cyl(g, 0.22, 0.68, [0, 0.72, 0], dressMat);
  } else {
    for (const sx of [-0.08, 0.08]) cyl(g, 0.065, 0.55, [sx, 0.65, 0], sashMat);
  }
  box(g, [0.34, 0.48, 0.21], [0, 1.18, 0], dressMat);
  // Kuşak / şal detayı
  box(g, [0.36, 0.08, 0.23], [0, 1.02, 0], sashMat);
  box(g, [0.12, 0.46, 0.235], [0.06, 1.16, 0.01], sashMat);
  for (const sx of [-0.2, 0.2]) {
    cyl(g, 0.048, 0.42, [sx, 1.16, 0], dressMat);
  }
  // Ahşap terzi mankeni boyun ve başlığı
  cyl(g, 0.045, 0.12, [0, 1.46, 0], woodMannequin);
  sphere(g, [0.095, 0.125, 0.095], [0, 1.58, 0], woodMannequin);
  cyl(g, 0.04, 0.04, [0, 1.71, 0], brass);
}

/** İç mekân zeytin ağacı / dekoratif bitki */
function addOliveTree(parent: THREE.Object3D, x: number, z: number, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);

  // Terracotta saksı
  cyl(g, 0.38, 0.62, [0, 0.31, 0], mat('#b86b4b', 0.75));
  cyl(g, 0.42, 0.07, [0, 0.6, 0], mat('#c87a59', 0.72));
  cyl(g, 0.34, 0.04, [0, 0.62, 0], mat('#3f2e21', 0.9));

  // Gövde ve zeytin yeşili yaprak kümeleri
  cyl(g, 0.065, 1.45, [0, 1.25, 0], mat('#6e5842', 0.85));
  const leaf1 = mat('#5c7c54', 0.78);
  const leaf2 = mat('#76966b', 0.75);
  sphere(g, [0.55, 0.42, 0.55], [0, 2.05, 0], leaf1);
  sphere(g, [0.42, 0.35, 0.42], [-0.28, 1.85, 0.18], leaf2);
  sphere(g, [0.4, 0.34, 0.4], [0.26, 1.9, -0.16], leaf2);
  sphere(g, [0.35, 0.3, 0.35], [0.05, 2.32, 0.08], leaf2);
}

/** Katlanmış Eco-Tex kumaş / havlu / nevresim yığını */
function addFoldedStack(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  colors: string[],
  rotY = 0,
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (rotY) g.rotation.y = rotY;
  parent.add(g);

  const layerH = 0.055;
  colors.forEach((c, i) => {
    box(g, [w - (i % 2) * 0.02, layerH, d - (i % 2) * 0.02], [0, layerH / 2 + i * layerH, 0], mat(c, 0.82));
  });
  // Kraft bel kuşağı (organik etiket bandı)
  const totalH = colors.length * layerH;
  box(g, [w * 0.28, totalH + 0.01, d + 0.015], [0, totalH / 2, 0], mat('#d6bf9c', 0.78));
}

/** Kraft Eco-Tex alışveriş çantası */
function addShoppingBag(parent: THREE.Object3D, x: number, y: number, z: number, color = '#d6bf9b', rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (rotY) g.rotation.y = rotY;
  parent.add(g);
  box(g, [0.28, 0.34, 0.14], [0, 0.17, 0], mat(color, 0.78));
  // Yeşil Eco-Tex yaprak logosu şeridi
  box(g, [0.18, 0.09, 0.146], [0, 0.19, 0], mat('#15803d', 0.6));
  for (const sz of [-0.045, 0.045]) {
    box(g, [0.1, 0.09, 0.015], [0, 0.38, sz], mat('#5c4631', 0.8));
  }
}

/** Butik askılık ünitesi (kıyafet askıları ile) */
function addBoutiqueRack(
  parent: THREE.Object3D,
  x: number,
  z: number,
  length: number,
  rotY: number,
  palette: string[],
) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);

  const brass = mat('#c69f53', 0.32, 0.78);
  const oak = mat('#c7a477', 0.68);
  const darkBase = mat('#1f2937', 0.5, 0.4);

  // Alt ahşap & antrasit baza (ayakkabı/kutu tepsisi)
  box(g, [length + 0.2, 0.08, 0.68], [0, 0.04, 0], darkBase);
  box(g, [length + 0.12, 0.04, 0.6], [0, 0.09, 0], oak);

  // Pirinç dikmeler ve üst askı borusu
  for (const sx of [-length / 2, length / 2]) {
    cyl(g, 0.026, 1.68, [sx, 0.88, 0], brass);
  }
  box(g, [length + 0.06, 0.045, 0.045], [0, 1.72, 0], brass);
  // Üst ahşap şapka/katlı ürün rafı
  box(g, [length + 0.08, 0.04, 0.42], [0, 1.78, 0], oak);

  // Askıdaki Eco-Tex giysiler
  const count = Math.max(6, Math.floor(length * 4.5));
  for (let i = 0; i < count; i++) {
    const gx = -length / 2 + 0.18 + (i / (count - 1)) * (length - 0.36);
    const col = palette[i % palette.length];
    // Askı kancası
    box(g, [0.02, 0.12, 0.22], [gx, 1.64, 0], oak);
    // Giysi
    const h = i % 3 === 0 ? 0.96 : 0.78;
    box(g, [0.085, h, 0.48], [gx, 1.58 - h / 2, 0], mat(col, 0.78));
  }

  // Üst rafa hediye kutuları ve katlı ürünler
  addFoldedStack(g, -length * 0.26, 1.8, 0, 0.42, 0.32, ['#e2e8f0', '#86efac', '#bbf7d0']);
  addFoldedStack(g, length * 0.26, 1.8, 0, 0.42, 0.32, ['#fde68a', '#fed7aa', '#f5d0fe']);
}

export function createEcoStore(): EcoStore {
  const root = new THREE.Group();
  root.name = 'dokuma-eco-store';
  root.userData.ecoStore = true;

  const staticGeom = new THREE.Group();
  const roofGroup = new THREE.Group();
  const labelsGroup = new THREE.Group();
  const boardsGroup = new THREE.Group();
  root.add(staticGeom, roofGroup, boardsGroup, labelsGroup);

  // Malzemeler
  const travertine = mat('#e5dec9', 0.78);
  const basalt = mat('#475569', 0.82);
  const parquet = mat('#d4b48c', 0.62);
  const aisleStone = mat('#ebe5d8', 0.58);
  const rugMat = mat('#c9b99b', 0.88);
  const rugGreen = mat('#52796f', 0.85);
  const wallCream = mat('#f3efe6', 0.72);
  const wallSage = mat('#3b5e4c', 0.7);
  const darkSteel = mat('#1e293b', 0.42, 0.58);
  const thermowood = mat('#9c6b3f', 0.68);
  const oak = mat('#c89f70', 0.62);
  const walnut = mat('#5c3d28', 0.55);
  const marble = mat('#f8fafc', 0.28, 0.05);
  const brass = mat('#d4af37', 0.3, 0.78);
  const glass = mat('#93c5fd', 0.18, 0.1, 0.32);
  const ledWarm = new THREE.MeshStandardMaterial({
    color: '#fffbeb',
    emissive: '#fde68a',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const ledGreen = new THREE.MeshStandardMaterial({
    color: '#dcfce7',
    emissive: '#4ade80',
    emissiveIntensity: 1.2,
    roughness: 0.25,
  });

  // ============================================================================
  // 1. DIŞ MEYDAN, YÜRÜYÜŞ YOLU, OTOPARK & PEYZAJ (PLAZA & EXTERIOR)
  // ============================================================================
  // Ana traverten meydan (x: -112 .. -71, z: 84 .. 113)
  box(staticGeom, [41, 0.08, 29], [-91.5, 0.04, 98.5], travertine);
  // Giriş yoluna (x = -67) bağlanan doğu yaya promenadı
  box(staticGeom, [8, 0.08, 9], [-71, 0.04, 99], travertine);
  box(staticGeom, [8.4, 0.09, 0.35], [-71, 0.045, 94.6], basalt);
  box(staticGeom, [8.4, 0.09, 0.35], [-71, 0.045, 103.4], basalt);

  // Kuzey çevre yoluna (z = 82) bağlanan müşteri otopark cebi & yürüyüş yolu
  box(staticGeom, [26, 0.07, 4.4], [-97, 0.035, 84.2], basalt);
  for (let px = -108; px <= -86; px += 4.5) {
    box(staticGeom, [0.12, 0.08, 3.8], [px, 0.042, 84.2], mat('#f8fafc', 0.7));
  }
  // Mağaza önü ziyaretçi araçları
  for (const [cx, col] of [
    [-105.7, '#e2e8f0'],
    [-101.2, '#2dd4bf'],
    [-96.7, '#f59e0b'],
  ] as const) {
    const car = new THREE.Group();
    car.position.set(cx, 0.06, 84.2);
    staticGeom.add(car);
    box(car, [1.72, 0.58, 3.8], [0, 0.55, 0], mat(col, 0.38, 0.4));
    box(car, [1.44, 0.55, 1.9], [0, 1.08, -0.2], mat('#334155', 0.25, 0.3));
    for (const sx of [-0.82, 0.82]) {
      for (const sz of [-1.18, 1.18]) {
        const w = cyl(car, 0.32, 0.22, [sx, 0.32, sz], mat('#18181b', 0.8));
        w.rotation.z = Math.PI / 2;
      }
    }
  }

  // Meydan ahşap dinlenme bankları ve aydınlatma babaları (bollard)
  for (const bz of [92.5, 105.5]) {
    box(staticGeom, [0.7, 0.45, 2.4], [-72.5, 0.26, bz], oak);
    box(staticGeom, [0.12, 0.45, 2.4], [-72.8, 0.55, bz], oak);
    addOliveTree(staticGeom, -72.5, bz + (bz < 99 ? -2.1 : 2.1), 1.15);
  }
  for (const [lx, lz] of [
    [-68.5, 95.3],
    [-68.5, 102.7],
    [-73.8, 95.3],
    [-73.8, 102.7],
    [-85, 86.5],
    [-92, 86.5],
  ] as const) {
    cyl(staticGeom, 0.1, 0.85, [lx, 0.46, lz], darkSteel);
    cyl(staticGeom, 0.11, 0.18, [lx, 0.92, lz], ledWarm);
  }

  // Dış Mekan Eco-Tex Totem Tabelası (Ana giriş yolu kenarında: [-68.8, 0, 91.5])
  box(staticGeom, [1.3, 0.35, 0.7], [-68.8, 0.22, 91.5], basalt);
  box(staticGeom, [1.05, 3.8, 0.32], [-68.8, 2.25, 91.5], thermowood);
  box(staticGeom, [0.92, 3.4, 0.36], [-68.8, 2.3, 91.5], wallSage);
  const totemTex = makeBoardTexture('DOKUMA ECO-TEX', 'STORE & SHOWROOM →', '#132a21', '#f8fafc', '#4ade80', 'OEKO-TEX®');
  const totemMat = new THREE.MeshBasicMaterial({ map: totemTex });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 2.4), totemMat);
    p.position.set(-68.8, 2.45, 91.5 + side * 0.19);
    if (side < 0) p.rotation.y = Math.PI;
    boardsGroup.add(p);
  }

  // ============================================================================
  // 2. MAĞAZA İÇ ZEMİNİ & MİMARİ DUVARLAR (INTERIOR FLOOR & WALLS)
  // ============================================================================
  // İç zemin: Sıcak meşe parke + traverten ana yürüyüş aksı
  box(staticGeom, [W - 0.2, 0.12, D - 0.2], [CX, 0.08, CZ], parquet);
  // Girişten içeri uzanan taş koridor aksı
  box(staticGeom, [22, 0.02, 3.6], [CX + 4.5, 0.145, 99], aisleStone);
  box(staticGeom, [4.2, 0.02, 16], [-80.5, 0.145, 98.5], aisleStone);

  // Kuzey Duvarı (z = 88) — Koyu adaçayı yeşili & meşe akustik çıtalı arka duvar
  box(staticGeom, [W, H, 0.32], [CX, H / 2, 88], wallCream);
  box(staticGeom, [W - 0.4, H - 0.4, 0.08], [CX, H / 2, 88.2], wallSage);
  // Batı Duvarı (x = -109) — Kabinler ve VIP Lounge duvarı
  box(staticGeom, [0.32, H, D], [-109, H / 2, CZ], wallCream);
  box(staticGeom, [0.08, H - 0.4, D - 0.4], [-108.8, H / 2, CZ], mat('#e7dfd3', 0.72));

  // Batı ve Kuzey cephesi dış ahşap güneş kırıcı çıtalar (thermowood)
  for (let x = -108; x <= -76; x += 1.6) {
    box(staticGeom, [0.14, H - 0.2, 0.18], [x, H / 2, 87.78], thermowood);
  }
  for (let z = 89; z <= 109; z += 1.6) {
    box(staticGeom, [0.18, H - 0.2, 0.14], [-109.22, H / 2, z], thermowood);
  }

  // Güney Panoramik Vitrin Cephesi (z = 110) — Fabrika giriş tabelası yönü
  box(staticGeom, [W, 0.45, 0.32], [CX, 0.28, 110], darkSteel);
  box(staticGeom, [W - 0.4, 3.6, 0.08], [CX, 2.3, 110], glass);
  for (let x = -109; x <= -75; x += 6.8) {
    box(staticGeom, [0.22, H, 0.34], [x, H / 2, 110], darkSteel);
  }

  // Doğu Ana Giriş & Vitrin Cephesi (x = -75, kapı açıklığı z: 96.8 .. 101.2)
  box(staticGeom, [0.32, 0.45, 8.8], [-75, 0.28, 92.4], darkSteel);
  box(staticGeom, [0.32, 0.45, 8.8], [-75, 0.28, 105.6], darkSteel);
  box(staticGeom, [0.08, 3.6, 8.5], [-75, 2.3, 92.4], glass);
  box(staticGeom, [0.08, 3.6, 8.5], [-75, 2.3, 105.6], glass);
  for (const z of [88, 92.4, 96.8, 101.2, 105.6, 110]) {
    box(staticGeom, [0.34, H, 0.22], [-75, H / 2, z], darkSteel);
  }
  // Açık cam çift giriş kapısı kanatları ve karşılama paspası
  box(staticGeom, [0.06, 2.9, 1.6], [-74.3, 1.55, 97.1], glass, 0.35);
  box(staticGeom, [0.06, 2.9, 1.6], [-74.3, 1.55, 100.9], glass, -0.35);
  box(staticGeom, [2.2, 0.03, 3.4], [-74.8, 0.15, 99], rugGreen);

  // Doğu Giriş Sundurması (Canopy) ve Dış Cephe Tabelaları
  box(staticGeom, [3.2, 0.26, 8.6], [-73.3, 3.65, 99], darkSteel);
  box(staticGeom, [3.0, 0.08, 8.2], [-73.3, 3.5, 99], thermowood);
  box(staticGeom, [0.08, 0.06, 7.6], [-72.2, 3.45, 99], ledWarm);

  // ============================================================================
  // 3. AÇILABİLİR ÇATI & DIŞ TABELALAR (ROOF GROUP — İNCELEMEDE GİZLENİR)
  // ============================================================================
  box(roofGroup, [W + 1.2, 0.32, D + 1.2], [CX, H + 0.16, CZ], darkSteel);
  box(roofGroup, [W + 0.6, 0.14, D + 0.6], [CX, H + 0.38, CZ], mat('#d6d1c4', 0.75));
  // 3 büyük cam çatı feneri (Skylights)
  for (const sx of [-101, -92, -83]) {
    box(roofGroup, [6.2, 0.22, 8.5], [sx, H + 0.52, CZ], darkSteel);
    box(roofGroup, [5.6, 0.26, 7.9], [sx, H + 0.56, CZ], glass);
  }
  // Çatı alınlığı ve ışıklı mağaza tabelaları (Doğu ve Güney cepheleri)
  const eastSignTex = makeBoardTexture(
    'DOKUMA ECO-TEX STORE',
    'OEKO-TEX® STANDARD 100 · GOTS ORGANIC TEXTILES',
    '#0f291e',
    '#f8fafc',
    '#4ade80',
    'FLAGSHIP',
  );
  const eastSign = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 1.65),
    new THREE.MeshBasicMaterial({ map: eastSignTex }),
  );
  eastSign.position.set(-74.25, H + 0.95, 99);
  eastSign.rotation.y = Math.PI / 2;
  roofGroup.add(eastSign);
  box(roofGroup, [0.35, 1.85, 11.9], [-74.45, H + 0.95, 99], darkSteel);

  const southSignTex = makeBoardTexture(
    'DOKUMA ECO-TEX · FABRİKA SATIŞ MAĞAZASI',
    '%100 ORGANİK PAMUK · KETEN · BAMBU EV TEKSTİLİ & GİYİM',
    '#0f291e',
    '#f8fafc',
    '#4ade80',
    'ECO-TEX®',
  );
  const southSign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 1.75),
    new THREE.MeshBasicMaterial({ map: southSignTex }),
  );
  southSign.position.set(CX, H + 0.98, 110.55);
  roofGroup.add(southSign);
  box(roofGroup, [16.4, 1.95, 0.35], [CX, H + 0.98, 110.35], darkSteel);

  // ============================================================================
  // 4. KASA, POS & PAKETLEME BANKOSU (CHECKOUT & PACKAGING — KUZEYDOĞU)
  // ============================================================================
  // L-biçimli ceviz & beyaz mermer kasa bankosu (x: -83.5 .. -77.5, z: 89.8 .. 95.2)
  box(staticGeom, [5.6, 1.02, 1.15], [-80.5, 0.62, 91.2], walnut);
  box(staticGeom, [5.8, 0.1, 1.28], [-80.5, 1.16, 91.2], marble);
  // Ön cephe altın pirinç ve LED dekor şeridi
  box(staticGeom, [5.65, 0.06, 0.04], [-80.5, 1.02, 91.8], ledWarm);
  box(staticGeom, [5.65, 0.08, 0.04], [-80.5, 0.22, 91.8], brass);

  // Yan paketleme kanadı
  box(staticGeom, [1.1, 1.02, 3.2], [-82.8, 0.62, 93.3], walnut);
  box(staticGeom, [1.22, 0.1, 3.35], [-82.8, 1.16, 93.3], marble);

  // 2 Adet Çift Ekranlı POS Yazar Kasa, Barkod Okuyucu ve Kredi Kartı POS Terminali
  for (const px of [-81.4, -79.2]) {
    // POS Monitör ayağı ve dokunmatik ekranı
    box(staticGeom, [0.26, 0.04, 0.24], [px, 1.23, 91.15], darkSteel);
    cyl(staticGeom, 0.03, 0.28, [px, 1.36, 91.1], darkSteel);
    box(staticGeom, [0.48, 0.34, 0.04], [px, 1.52, 91.12], darkSteel);
    box(staticGeom, [0.43, 0.29, 0.045], [px, 1.52, 91.14], ledGreen);
    // Müşteri bilgi ekranı
    box(staticGeom, [0.24, 0.16, 0.03], [px + 0.22, 1.38, 91.38], darkSteel);
    box(staticGeom, [0.21, 0.13, 0.035], [px + 0.22, 1.38, 91.4], ledWarm);
    // Para çekmecesi ve fiş yazıcısı
    box(staticGeom, [0.42, 0.1, 0.38], [px - 0.35, 1.26, 91.15], darkSteel);
    box(staticGeom, [0.16, 0.15, 0.2], [px + 0.36, 1.28, 91.12], mat('#e2e8f0', 0.4));
    // Barkod okuyucu ve temassız kart pos cihazı
    cyl(staticGeom, 0.05, 0.22, [px + 0.54, 1.32, 91.22], darkSteel);
    box(staticGeom, [0.1, 0.07, 0.16], [px + 0.54, 1.43, 91.26], darkSteel);
    box(staticGeom, [0.12, 0.06, 0.18], [px + 0.52, 1.24, 91.52], mat('#0f172a', 0.4));
  }

  // Paketleme alanında katlanan ürünler, hediye kutuları ve Eco-Tex kraft çantalar
  addFoldedStack(staticGeom, -82.8, 1.21, 92.6, 0.55, 0.42, ['#bbf7d0', '#86efac', '#fef08a']);
  addShoppingBag(staticGeom, -82.8, 1.21, 93.45, '#d6bf9b', Math.PI / 2);
  addShoppingBag(staticGeom, -82.8, 1.21, 93.9, '#166534', Math.PI / 2);
  addShoppingBag(staticGeom, -78.1, 1.21, 91.25, '#d6bf9b', 0.2);

  // Kasa arkası ışıklı "DOKUMA ECO-TEX" marka duvarı ve paket çanta nişleri
  box(staticGeom, [6.2, 3.5, 0.28], [-80.5, 1.9, 88.45], walnut);
  box(staticGeom, [5.8, 3.1, 0.08], [-80.5, 1.95, 88.62], wallSage);
  const cashWallTex = makeBoardTexture(
    'DOKUMA ECO-TEX®',
    'SERTİFİKALI ORGANİK TEKSTİL · KASA & PAKETLEME',
    '#11261e',
    '#fefce8',
    '#84cc16',
    '100% BIO',
  );
  const cashSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 1.45),
    new THREE.MeshBasicMaterial({ map: cashWallTex }),
  );
  cashSign.position.set(-80.5, 2.75, 88.68);
  boardsGroup.add(cashSign);

  // Kasa arkası yedek kraft çanta ve hediye kutusu rafları
  box(staticGeom, [5.2, 0.06, 0.42], [-80.5, 1.35, 88.78], oak);
  for (let bx = -82.6; bx <= -78.4; bx += 0.6) {
    addShoppingBag(staticGeom, bx, 1.38, 88.82, bx % 1.2 === 0 ? '#166534' : '#d6bf9b');
  }

  // Kasiyerler ve ödeme yapan müşteri
  addPerson(staticGeom, -81.3, 89.85, 0, '#f8fafc', '#1e293b', '#292524', { apron: '#15803d', female: true });
  addPerson(staticGeom, -79.2, 89.85, -0.15, '#f8fafc', '#1e293b', '#451a03', { apron: '#15803d' });
  addPerson(staticGeom, -79.8, 92.55, Math.PI, '#e0f2fe', '#334155', '#78350f', {
    bagColor: '#d6bf9b',
    female: true,
  });

  // ============================================================================
  // 5. MERKEZ ÜRÜN ADALARI — OEKO-TEX® EV TEKSTİLİ & BORNOZ/HAVLU REYONLARI
  // ============================================================================
  // ADA 1: Organik Banyo, Havlu & Bornoz Koleksiyonu ([-88.2, 95.2])
  box(staticGeom, [5.4, 0.03, 3.4], [-88.2, 0.145, 95.2], rugMat);
  box(staticGeom, [4.4, 0.78, 2.1], [-88.2, 0.52, 95.2], oak);
  box(staticGeom, [4.6, 0.07, 2.25], [-88.2, 0.93, 95.2], marble);
  box(staticGeom, [3.2, 0.36, 1.1], [-88.2, 1.14, 95.2], oak);
  // Katlanmış organik havlu ve bornoz yığınları
  for (const [dx, dz, cols] of [
    [-1.65, -0.62, ['#86efac', '#4ade80', '#22c55e', '#dcfce7']],
    [-0.55, -0.62, ['#fed7aa', '#fdba74', '#fb923c', '#ffedd5']],
    [0.55, -0.62, ['#bae6fd', '#7dd3fc', '#38bdf8', '#e0f2fe']],
    [1.65, -0.62, ['#f5d0fe', '#f0abfc', '#e879f9', '#fae8ff']],
    [-1.65, 0.62, ['#fde68a', '#fcd34d', '#fbbf24', '#fef3c7']],
    [-0.55, 0.62, ['#d6d3d1', '#e7e5e4', '#f5f5f4', '#a8a29e']],
    [0.55, 0.62, ['#99f6e4', '#5eead4', '#2dd4bf', '#ccfbf1']],
    [1.65, 0.62, ['#fecdd3', '#fda4af', '#fb7185', '#ffe4e6']],
  ] as const) {
    addFoldedStack(staticGeom, -88.2 + dx, 0.97, 95.2 + dz, 0.72, 0.52, [...cols]);
  }
  // Üst podyumda rulo spa havlu sepetleri ve organik oda kokusu şişeleri
  for (const sx of [-1.05, 0, 1.05]) {
    cyl(staticGeom, 0.32, 0.26, [-88.2 + sx, 1.45, 95.2], mat('#b48a5a', 0.85));
    for (const rx of [-0.1, 0.1]) {
      cyl(staticGeom, 0.08, 0.34, [-88.2 + sx + rx, 1.56, 95.2], mat(sx < 0 ? '#86efac' : sx > 0 ? '#bae6fd' : '#fed7aa', 0.8));
    }
  }

  // ADA 2: Organik Keten Nevresim & Yatak Odası Showroom Podyumu ([-88.2, 102.6])
  box(staticGeom, [5.6, 0.03, 3.8], [-88.2, 0.145, 102.6], rugMat);
  // Ahşap platform üzerinde örnek organik yatak & nevresim sergisi + katlı set masası
  box(staticGeom, [4.8, 0.22, 3.0], [-88.2, 0.25, 102.6], oak);
  // Sol yarı: Organik keten yatak başlığı, şilte, katmanlı nevresim ve kırlentler
  box(staticGeom, [0.16, 1.35, 2.2], [-90.2, 0.98, 102.6], walnut);
  box(staticGeom, [2.3, 0.38, 2.0], [-89.0, 0.55, 102.6], mat('#f8fafc', 0.75));
  // Adaçayı yeşili organik keten yorgan ve toprak tonu yatak örtüsü (runner)
  box(staticGeom, [1.85, 0.14, 2.06], [-88.75, 0.78, 102.6], mat('#6b8e78', 0.82));
  box(staticGeom, [0.75, 0.16, 2.08], [-88.15, 0.8, 102.6], mat('#c27d56', 0.82));
  for (const pz of [-0.52, 0.52]) {
    box(staticGeom, [0.38, 0.22, 0.72], [-89.8, 0.86, 102.6 + pz], mat('#fef3c7', 0.78));
    box(staticGeom, [0.3, 0.24, 0.56], [-89.5, 0.88, 102.6 + pz], mat('#86efac', 0.78));
  }
  // Sağ yarı: Nevresim kutuları ve kumaş kartelası standı
  box(staticGeom, [1.5, 0.68, 2.2], [-86.7, 0.68, 102.6], oak);
  box(staticGeom, [1.6, 0.06, 2.3], [-86.7, 1.04, 102.6], marble);
  addFoldedStack(staticGeom, -86.7, 1.08, 101.9, 0.82, 0.58, ['#dcfce7', '#bbf7d0', '#86efac']);
  addFoldedStack(staticGeom, -86.7, 1.08, 102.6, 0.82, 0.58, ['#ffedd5', '#fed7aa', '#fdba74']);
  addFoldedStack(staticGeom, -86.7, 1.08, 103.3, 0.82, 0.58, ['#e0f2fe', '#bae6fd', '#7dd3fc']);

  // ADA 3: Sürdürülebilir Kapsül Koleksiyon & Ham Pamuk Sergisi ([-95.8, 95.2])
  box(staticGeom, [4.6, 0.03, 3.2], [-95.8, 0.145, 95.2], rugMat);
  box(staticGeom, [3.6, 0.78, 1.9], [-95.8, 0.52, 95.2], walnut);
  box(staticGeom, [3.8, 0.07, 2.05], [-95.8, 0.93, 95.2], marble);
  // Merkezde cam fanus içinde organik pamuk kozaları ve doğal boya kavanozları
  cyl(staticGeom, 0.42, 0.06, [-95.8, 0.99, 95.2], brass);
  cyl(staticGeom, 0.38, 0.52, [-95.8, 1.28, 95.2], glass);
  for (const [bx, bz] of [
    [-0.12, -0.08],
    [0.12, 0.06],
    [0, 0.12],
    [-0.06, 0.02],
  ] as const) {
    sphere(staticGeom, [0.09, 0.09, 0.09], [-95.8 + bx, 1.12, 95.2 + bz], mat('#fffbeb', 0.9));
  }
  addFoldedStack(staticGeom, -97.0, 0.97, 94.75, 0.7, 0.5, ['#bbf7d0', '#4ade80', '#16a34a']);
  addFoldedStack(staticGeom, -97.0, 0.97, 95.65, 0.7, 0.5, ['#fef08a', '#facc15', '#eab308']);
  addFoldedStack(staticGeom, -94.6, 0.97, 94.75, 0.7, 0.5, ['#fed7aa', '#fb923c', '#ea580c']);
  addFoldedStack(staticGeom, -94.6, 0.97, 95.65, 0.7, 0.5, ['#e9d5ff', '#c084fc', '#9333ea']);

  // ============================================================================
  // 6. BUTİK ASKILIKLAR & VİTRİN / PODYUM MANKENLERİ (GARMENT RACKS & MANNEQUINS)
  // ============================================================================
  addBoutiqueRack(staticGeom, -95.8, 102.6, 3.4, 0, [
    '#86efac',
    '#fef3c7',
    '#fed7aa',
    '#bae6fd',
    '#d8b4fe',
    '#f8fafc',
  ]);
  addBoutiqueRack(staticGeom, -99.8, 95.2, 3.0, Math.PI / 2, [
    '#bbf7d0',
    '#5eead4',
    '#fde68a',
    '#fda4af',
    '#e2e8f0',
  ]);
  addBoutiqueRack(staticGeom, -81.2, 102.6, 3.0, Math.PI / 2, [
    '#fed7aa',
    '#fdba74',
    '#fef08a',
    '#86efac',
    '#bae6fd',
  ]);

  // Doğu Giriş Vitrini Podyumu ve Mankenleri (x = -76.5)
  box(staticGeom, [1.8, 0.24, 5.2], [-76.6, 0.25, 92.5], oak);
  box(staticGeom, [1.85, 0.04, 5.25], [-76.6, 0.38, 92.5], brass);
  addMannequin(staticGeom, -76.6, 0.4, 91.0, Math.PI * 0.45, '#86efac', '#15803d', true);
  addMannequin(staticGeom, -76.6, 0.4, 93.8, Math.PI * 0.55, '#fef3c7', '#b45309', false);

  box(staticGeom, [1.8, 0.24, 5.2], [-76.6, 0.25, 105.5], oak);
  box(staticGeom, [1.85, 0.04, 5.25], [-76.6, 0.38, 105.5], brass);
  addMannequin(staticGeom, -76.6, 0.4, 104.0, Math.PI * 0.45, '#fed7aa', '#c2410c', true);
  addMannequin(staticGeom, -76.6, 0.4, 106.8, Math.PI * 0.55, '#bae6fd', '#0369a1', true);

  // Güney Panoramik Vitrin Podyumu (z = 108.4) — 3 Manken + Organik Kumaş Kemeri
  box(staticGeom, [9.6, 0.24, 1.9], [-92, 0.25, 108.3], oak);
  box(staticGeom, [9.7, 0.04, 1.95], [-92, 0.38, 108.3], brass);
  addMannequin(staticGeom, -95.2, 0.4, 108.3, 0, '#bbf7d0', '#166534', true);
  addMannequin(staticGeom, -92.0, 0.4, 108.3, 0, '#fde68a', '#15803d', true);
  addMannequin(staticGeom, -88.8, 0.4, 108.3, 0, '#f5d0fe', '#7e22ce', false);

  // ============================================================================
  // 7. KUZEY DUVARI IŞIKLI KUMAŞ, İPLİK & KOLEKSİYON RAFLARI (WALL SHELVING)
  // ============================================================================
  for (const sx of [-98.5, -93.8, -89.1]) {
    // Ceviz raf kasası ve LED raflar
    box(staticGeom, [4.1, 3.5, 0.65], [sx, 1.9, 88.6], walnut);
    for (const sy of [0.65, 1.35, 2.05, 2.75]) {
      box(staticGeom, [3.9, 0.06, 0.62], [sx, sy, 88.64], oak);
      box(staticGeom, [3.8, 0.03, 0.05], [sx, sy + 0.58, 88.9], ledWarm);
    }
    // Alt iki rafta renkli Eco-Tex kumaş topları (Fabric Rolls)
    const rollColors = ['#86efac', '#4ade80', '#fef08a', '#fed7aa', '#bae6fd', '#f5d0fe'];
    for (let i = 0; i < 6; i++) {
      const rx = sx - 1.5 + i * 0.6;
      const roll1 = cyl(staticGeom, 0.14, 0.52, [rx, 0.88, 88.66], mat(rollColors[i], 0.78));
      roll1.rotation.x = Math.PI / 2;
      const roll2 = cyl(staticGeom, 0.14, 0.52, [rx, 1.58, 88.66], mat(rollColors[(i + 2) % 6], 0.78));
      roll2.rotation.x = Math.PI / 2;
    }
    // 3. rafta katlı organik tekstil paketleri
    for (const dx of [-1.25, 0, 1.25]) {
      addFoldedStack(staticGeom, sx + dx, 2.09, 88.66, 0.85, 0.46, ['#f8fafc', '#86efac', '#bbf7d0']);
    }
    // En üst rafta organik iplik bobinleri (Yarn Cones) ve hediye kutuları
    for (let i = 0; i < 7; i++) {
      cyl(staticGeom, 0.1, 0.34, [sx - 1.5 + i * 0.5, 2.95, 88.66], mat(rollColors[i % 6], 0.72));
    }
  }

  // ============================================================================
  // 8. SOYUNMA KABİNLERİ (FITTING ROOMS) & SÜRDÜRÜLEBİLİRLİK KÖŞESİ (BATI)
  // ============================================================================
  // 3 Adet Şık Soyunma Kabini (x: -108.5 .. -103.2, z: 88.6 .. 93.8)
  for (let i = 0; i < 3; i++) {
    const cx = -107.4 + i * 1.9;
    // Yan bölmeler
    box(staticGeom, [0.1, 2.9, 2.2], [cx - 0.92, 1.55, 89.6], oak);
    if (i === 2) box(staticGeom, [0.1, 2.9, 2.2], [cx + 0.92, 1.55, 89.6], oak);
    // Arka boy aynası ve LED çerçevesi
    box(staticGeom, [1.1, 2.2, 0.06], [cx, 1.45, 88.58], ledWarm);
    box(staticGeom, [1.0, 2.1, 0.08], [cx, 1.45, 88.6], mat('#e0f2fe', 0.08, 0.85));
    // Kadife puf tabure
    cyl(staticGeom, 0.26, 0.42, [cx - 0.35, 0.34, 89.5], mat('#52796f', 0.8));
    // Pirinç perde borusu ve yarı açık keten perde
    box(staticGeom, [1.8, 0.04, 0.04], [cx, 2.85, 90.65], brass);
    box(staticGeom, [0.78, 2.55, 0.08], [cx - 0.45, 1.52, 90.65], mat('#dfd5c3', 0.85));
  }

  // Batı Duvarı İnteraktif Sürdürülebilirlik & Sertifika Ekranı (x = -108.6, z = 96.8)
  box(staticGeom, [0.18, 2.4, 3.8], [-108.65, 1.85, 96.8], darkSteel);
  const certTex = makeBoardTexture(
    'OEKO-TEX® & GOTS SERTİFİKALI ÜRETİM',
    '• %100 Güneş Enerjisi  • -%64 Su Tasarrufu  • Sıfır Zararlı Kimyasal',
    '#0d261d',
    '#f0fdf4',
    '#4ade80',
    'SERTİFİKA',
  );
  const certScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 2.1),
    new THREE.MeshBasicMaterial({ map: certTex }),
  );
  certScreen.position.set(-108.52, 1.85, 96.8);
  certScreen.rotation.y = Math.PI / 2;
  boardsGroup.add(certScreen);

  // ============================================================================
  // 9. VIP MÜŞTERİ DİNLENME & ECO-CAFE LOUNGE (GÜNEYBATI KÖŞESİ)
  // ============================================================================
  // Yuvarlak dokuma jüt halı ve traverten orta sehpa ([-104.2, 103.8])
  cyl(staticGeom, 3.2, 0.03, [-104.2, 0.145, 103.8], rugGreen);
  cyl(staticGeom, 1.05, 0.42, [-104.2, 0.35, 103.8], travertine);
  // Sehpa üzerinde kataloglar, kahve fincanları ve bonsai
  box(staticGeom, [0.45, 0.05, 0.34], [-104.4, 0.58, 103.6], mat('#166534', 0.6));
  box(staticGeom, [0.42, 0.04, 0.32], [-103.9, 0.58, 104.0], mat('#fef3c7', 0.7));
  cyl(staticGeom, 0.06, 0.09, [-104.1, 0.6, 103.5], marble);
  cyl(staticGeom, 0.06, 0.09, [-104.5, 0.6, 104.1], marble);

  // L-biçimli krem bukle (bouclé) kanepe
  box(staticGeom, [3.2, 0.42, 0.95], [-104.2, 0.35, 106.2], mat('#f5f0e6', 0.85));
  box(staticGeom, [3.2, 0.48, 0.24], [-104.2, 0.72, 106.56], mat('#f5f0e6', 0.85));
  // Kırlentler
  for (const kx of [-1.1, -0.3, 0.5, 1.2]) {
    box(staticGeom, [0.38, 0.34, 0.16], [-104.2 + kx, 0.68, 106.35], mat(kx < 0 ? '#52796f' : '#c27d56', 0.8));
  }
  // 2 Adet Terracotta Berjer Koltuk
  for (const [ax, az, rot] of [
    [-106.4, 103.6, Math.PI / 2],
    [-102.0, 103.6, -Math.PI / 2],
  ] as const) {
    const chair = new THREE.Group();
    chair.position.set(ax, 0.14, az);
    chair.rotation.y = rot;
    staticGeom.add(chair);
    box(chair, [0.88, 0.38, 0.86], [0, 0.24, 0], mat('#b86b4b', 0.8));
    box(chair, [0.88, 0.48, 0.2], [0, 0.62, -0.33], mat('#b86b4b', 0.8));
    for (const sx of [-0.38, 0.38]) box(chair, [0.14, 0.36, 0.82], [sx, 0.5, 0], mat('#b86b4b', 0.8));
  }

  // Self-Servis Eco-Espresso & Organik Bitki Çayı Barı (x = -108.1, z = 103.8)
  box(staticGeom, [0.9, 1.0, 3.2], [-108.1, 0.62, 103.8], walnut);
  box(staticGeom, [1.0, 0.08, 3.3], [-108.1, 1.15, 103.8], marble);
  // Espresso makinesi ve bitki çayı kavanozları
  box(staticGeom, [0.46, 0.44, 0.52], [-108.1, 1.4, 103.1], darkSteel);
  box(staticGeom, [0.48, 0.08, 0.54], [-108.1, 1.64, 103.1], brass);
  cyl(staticGeom, 0.14, 0.38, [-108.1, 1.38, 104.2], glass);
  cyl(staticGeom, 0.12, 0.28, [-108.1, 1.33, 104.2], mat('#bef264', 0.4, 0.05, 0.6));

  // İç mekân zeytin ağaçları ve müşteriler
  addOliveTree(staticGeom, -107.4, 107.8, 1.05);
  addOliveTree(staticGeom, -100.8, 107.8, 1.0);
  addOliveTree(staticGeom, -84.2, 89.4, 0.95);
  addOliveTree(staticGeom, -102.2, 89.4, 0.95);

  // Reyonları gezen müşteriler ve satış danışmanı
  addPerson(staticGeom, -88.2, 97.2, Math.PI, '#fef3c7', '#334155', '#451a03', {
    bagColor: '#166534',
    female: true,
  });
  addPerson(staticGeom, -93.6, 100.4, -Math.PI / 3, '#dcfce7', '#1e293b', '#1c1917', {
    apron: '#15803d',
    female: true,
  });
  addPerson(staticGeom, -94.8, 101.1, Math.PI / 4, '#f1f5f9', '#475569', '#78350f', {
    bagColor: '#d6bf9b',
  });
  addPerson(staticGeom, -104.4, 96.8, -Math.PI / 2, '#fae8ff', '#1e293b', '#27272a', {
    female: true,
  });

  // ============================================================================
  // 10. BÖLÜM ETİKETLERİ ("Etiket" #chkLabels İLE GİZLENİP AÇILABİLİR)
  // ============================================================================
  const sectionLabels: Array<[string, string, string, [number, number, number]]> = [
    ['Kasa & Paketleme', 'Çift POS · Kraft Eco-Tex Paketleme', '#4ade80', [-80.5, 3.6, 91.2]],
    ['OEKO-TEX® Ev Tekstili', 'Organik Havlu · Bornoz · Nevresim', '#38bdf8', [-88.2, 3.5, 98.8]],
    ['GOTS Organik Giyim & Kumaş', 'Sürdürülebilir Koleksiyon & İplik', '#facc15', [-95.8, 3.5, 98.8]],
    ['Deneme Kabinleri & Eco-Lounge', '3 Kabin · Sertifika Ekranı · Kahve Barı', '#c084fc', [-105.2, 3.5, 97.5]],
  ];
  for (const [title, sub, color, pos] of sectionLabels) {
    const sp = makeLabelSprite(title, sub, color);
    sp.position.set(pos[0], pos[1], pos[2]);
    labelsGroup.add(sp);
  }

  // Performans için statik geometrileri instanced hale getir
  instanceGroup(staticGeom);
  instanceGroup(roofGroup);

  return {
    group: root,
    center: [CX, 0, CZ],
    size: [W, D],
    setOpen(open: boolean) {
      roofGroup.visible = !open;
    },
    setLabelsVisible(visible: boolean) {
      labelsGroup.visible = visible;
    },
    overview() {
      return {
        pos: new THREE.Vector3(CX + 16, 22, CZ + 25),
        target: new THREE.Vector3(CX, 1.2, CZ),
      };
    },
  };
}
