import * as THREE from 'three';
import { instanceGroup } from './environment';

export interface OutdoorComplex {
  readonly group: THREE.Group;
  setLabelsVisible(visible: boolean): void;
  overview(): { pos: THREE.Vector3; target: THREE.Vector3 };
}

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

function makeBoardTexture(
  title: string,
  sub: string,
  bg = '#0f291e',
  fg = '#f8fafc',
  accent = '#4ade80',
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
    g.roundRect(24, 24, 138, 38, 10);
    g.fill();
    g.fillStyle = '#0f172a';
    g.font = '700 20px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(badge, 93, 43);
  }

  g.fillStyle = fg;
  g.font = '700 32px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, c.width / 2, badge ? 102 : 76, c.width - 44);

  g.fillStyle = accent;
  g.font = '600 21px system-ui, sans-serif';
  g.fillText(sub, c.width / 2, badge ? 148 : 132, c.width - 44);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelSprite(title: string, sub: string, accent: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(12, 23, 32, 0.88)';
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
  g.font = '700 29px system-ui, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(title, 76, 48, 412);

  g.fillStyle = '#cbd5e1';
  g.font = '500 20px system-ui, sans-serif';
  g.fillText(sub, 76, 84, 412);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(7.5, 1.85, 1);
  sp.userData.noPick = true;
  return sp;
}

/** Ayakta veya oturan insan figürü */
function addPerson(
  parent: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  topColor: string,
  bottomColor: string,
  hairColor: string,
  seated = false,
  apronColor?: string,
) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  parent.add(g);

  const skin = mat('#eccab0', 0.65);
  const shoe = mat('#1e293b', 0.6);
  const top = mat(topColor, 0.68);
  const bot = mat(bottomColor, 0.72);
  const hair = mat(hairColor, 0.75);

  if (seated) {
    for (const sx of [-0.09, 0.09]) {
      box(g, [0.1, 0.24, 0.1], [sx, 0.2, 0.18], bot);
      box(g, [0.1, 0.1, 0.26], [sx, 0.42, 0.06], bot);
      box(g, [0.1, 0.06, 0.2], [sx, 0.05, 0.22], shoe);
    }
    box(g, [0.32, 0.46, 0.2], [0, 0.7, -0.02], top);
    for (const sx of [-0.19, 0.19]) {
      box(g, [0.08, 0.28, 0.08], [sx, 0.72, 0.05], top);
      sphere(g, [0.045, 0.045, 0.045], [sx, 0.62, 0.16], skin);
    }
    cyl(g, 0.048, 0.09, [0, 0.97, -0.02], skin);
    sphere(g, [0.11, 0.125, 0.11], [0, 1.09, -0.02], skin);
    sphere(g, [0.118, 0.1, 0.12], [0, 1.13, -0.035], hair);
  } else {
    for (const sx of [-0.09, 0.09]) {
      box(g, [0.1, 0.07, 0.22], [sx, 0.035, 0.03], shoe);
      cyl(g, 0.06, 0.72, [sx, 0.42, 0], bot);
    }
    box(g, [0.34, 0.5, 0.2], [0, 1.04, 0], top);
    if (apronColor) {
      box(g, [0.3, 0.46, 0.215], [0, 0.96, 0.01], mat(apronColor, 0.65));
    }
    for (const sx of [-0.21, 0.21]) {
      cyl(g, 0.05, 0.44, [sx, 1.02, 0.04], top);
      sphere(g, [0.048, 0.048, 0.048], [sx, 0.8, 0.08], skin);
    }
    cyl(g, 0.05, 0.1, [0, 1.33, 0], skin);
    sphere(g, [0.115, 0.13, 0.115], [0, 1.45, 0], skin);
    sphere(g, [0.122, 0.11, 0.125], [0, 1.49, -0.015], hair);
  }
}

/** Peyzaj ağacı (saksılı veya çim üstü) */
function addTree(parent: THREE.Object3D, x: number, z: number, scale = 1, withPlanter = true) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  parent.add(g);

  if (withPlanter) {
    box(g, [1.3, 0.38, 1.3], [0, 0.22, 0], mat('#d6d1c4', 0.78));
    box(g, [1.1, 0.06, 1.1], [0, 0.41, 0], mat('#443322', 0.9));
  }
  cyl(g, 0.16, 2.8, [0, 1.45, 0], mat('#6b533b', 0.85));
  const c1 = mat('#4d7c43', 0.78);
  const c2 = mat('#659457', 0.75);
  sphere(g, [1.45, 1.25, 1.45], [0, 3.3, 0], c1);
  sphere(g, [1.1, 1.0, 1.1], [-0.75, 2.85, 0.35], c2);
  sphere(g, [1.05, 0.95, 1.05], [0.7, 2.95, -0.3], c2);
}

/** Güneş şemsiyeli (parasol) yuvarlak bahçe kafeterya masası + 4 sandalye */
function addUmbrellaTable(
  parent: THREE.Object3D,
  x: number,
  z: number,
  umbrellaColor: string,
  people: Array<[number, string, string, string]>,
) {
  const g = new THREE.Group();
  g.position.set(x, 0.08, z);
  parent.add(g);

  const oak = mat('#c79d6d', 0.62);
  const darkSteel = mat('#1e293b', 0.42, 0.55);
  const canopyMat = mat(umbrellaColor, 0.72);
  const cream = mat('#f8fafc', 0.5);

  // Yuvarlak ahşap masa ve demir ayak
  cyl(g, 0.35, 0.05, [0, 0.03, 0], darkSteel);
  cyl(g, 0.05, 0.74, [0, 0.4, 0], darkSteel);
  cyl(g, 0.85, 0.06, [0, 0.76, 0], oak);

  // Masa üstü kahve fincanları, tabaklar ve tepsi
  cyl(g, 0.055, 0.09, [-0.28, 0.83, 0.18], cream);
  cyl(g, 0.055, 0.09, [0.26, 0.83, -0.2], cream);
  cyl(g, 0.14, 0.025, [0.18, 0.8, 0.24], cream);
  box(g, [0.32, 0.02, 0.22], [-0.22, 0.8, -0.22], mat('#334155', 0.4, 0.5));

  // Güneş şemsiyesi direği ve 2 katmanlı tente kubbesi
  cyl(g, 0.04, 2.55, [0, 1.3, 0], darkSteel);
  cyl(g, 1.65, 0.18, [0, 2.48, 0], canopyMat);
  cyl(g, 0.95, 0.16, [0, 2.6, 0], canopyMat);
  cyl(g, 0.12, 0.08, [0, 2.7, 0], oak);

  // 4 Bahçe Sandalyesi
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  angles.forEach((ang, idx) => {
    const cx = Math.sin(ang) * 1.25;
    const cz = Math.cos(ang) * 1.25;
    const chair = new THREE.Group();
    chair.position.set(cx, 0, cz);
    chair.rotation.y = ang + Math.PI;
    g.add(chair);
    box(chair, [0.46, 0.05, 0.46], [0, 0.42, 0], oak);
    box(chair, [0.46, 0.42, 0.05], [0, 0.65, -0.21], oak);
    for (const sx of [-0.2, 0.2]) {
      for (const sz of [-0.2, 0.2]) {
        cyl(chair, 0.022, 0.42, [sx, 0.21, sz], darkSteel);
      }
    }
    const p = people.find((item) => item[0] === idx);
    if (p) {
      addPerson(chair, 0, 0, 0, p[1], p[2], p[3], true);
    }
  });
}

/** Pergola kamelya (outdoor lounge booth) */
function addPergolaBooth(parent: THREE.Object3D, x: number, z: number, cushionColor: string) {
  const g = new THREE.Group();
  g.position.set(x, 0.08, z);
  parent.add(g);

  const thermowood = mat('#9a693d', 0.68);
  const darkSteel = mat('#1e293b', 0.42, 0.58);
  const cushion = mat(cushionColor, 0.8);
  const tableMat = mat('#e5dec9', 0.65);
  const ledWarm = new THREE.MeshStandardMaterial({
    color: '#fffbeb',
    emissive: '#fde68a',
    emissiveIntensity: 1.3,
    roughness: 0.25,
  });

  // 4 Köşe çelik/ahşap dikme (4.4m × 3.4m)
  for (const sx of [-2.0, 2.0]) {
    for (const sz of [-1.5, 1.5]) {
      box(g, [0.16, 2.8, 0.16], [sx, 1.4, sz], darkSteel);
    }
  }
  // Üst çerçeve ve bioklimatik ahşap lamel kirişler
  box(g, [4.3, 0.18, 0.18], [0, 2.82, -1.5], darkSteel);
  box(g, [4.3, 0.18, 0.18], [0, 2.82, 1.5], darkSteel);
  box(g, [0.18, 0.18, 3.2], [-2.0, 2.82, 0], darkSteel);
  box(g, [0.18, 0.18, 3.2], [2.0, 2.82, 0], darkSteel);
  for (let lx = -1.75; lx <= 1.75; lx += 0.35) {
    box(g, [0.12, 0.12, 3.1], [lx, 2.86, 0], thermowood);
  }
  box(g, [3.6, 0.04, 0.06], [0, 2.75, 0], ledWarm);

  // İçeride U-biçimli bahçe sedir koltukları ve orta sehpa
  box(g, [3.2, 0.38, 0.78], [0, 0.22, -0.95], thermowood);
  box(g, [3.1, 0.12, 0.72], [0, 0.46, -0.95], cushion);
  box(g, [3.1, 0.42, 0.16], [0, 0.7, -1.25], cushion);

  for (const sx of [-1.35, 1.35]) {
    box(g, [0.75, 0.38, 1.5], [sx, 0.22, 0.15], thermowood);
    box(g, [0.7, 0.12, 1.44], [sx, 0.46, 0.15], cushion);
  }
  // Orta sehpa
  box(g, [1.6, 0.4, 0.85], [0, 0.22, 0.15], tableMat);
}

/** Binek otomobil veya Elektrikli Araç (EV) modeli */
function addVehicle(
  parent: THREE.Object3D,
  x: number,
  z: number,
  rotY: number,
  color: string,
  isEV = false,
  isSUV = false,
) {
  const g = new THREE.Group();
  g.position.set(x, 0.06, z);
  g.rotation.y = rotY;
  parent.add(g);

  const bodyMat = mat(color, 0.35, 0.42);
  const cabinMat = mat('#1e293b', 0.22, 0.35);
  const glassRoof = mat('#0f172a', 0.15, 0.5);
  const wheelMat = mat('#18181b', 0.82);
  const rimMat = mat('#cbd5e1', 0.3, 0.75);
  const lampFront = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    emissive: '#e0f2fe',
    emissiveIntensity: 0.9,
  });
  const lampRear = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.7,
  });

  const hBody = isSUV ? 0.68 : 0.56;
  const hCabin = isSUV ? 0.62 : 0.52;
  const lenCabin = isSUV ? 2.45 : 2.05;

  // Alt gövde ve kabin
  box(g, [1.82, hBody, 4.25], [0, 0.34 + hBody / 2, 0], bodyMat);
  box(g, [1.54, hCabin, lenCabin], [0, 0.34 + hBody + hCabin / 2 - 0.04, isSUV ? -0.15 : -0.1], cabinMat);
  // Panoramik cam tavan (EV'lerde koyu cam, diğerlerinde gövde rengi)
  box(
    g,
    [1.46, 0.08, lenCabin - 0.25],
    [0, 0.34 + hBody + hCabin - 0.04, isSUV ? -0.15 : -0.1],
    isEV ? glassRoof : bodyMat,
  );

  // Tekerlekler ve jantlar
  for (const sx of [-0.88, 0.88]) {
    for (const sz of [-1.32, 1.32]) {
      const w = cyl(g, 0.34, 0.24, [sx, 0.34, sz], wheelMat);
      w.rotation.z = Math.PI / 2;
      const rim = cyl(g, 0.2, 0.25, [sx, 0.34, sz], rimMat);
      rim.rotation.z = Math.PI / 2;
    }
  }

  // Ön farlar, arka stop barı ve plaka (EV ise yeşil şeritli plaka)
  for (const sx of [-0.62, 0.62]) {
    box(g, [0.36, 0.14, 0.06], [sx, 0.68, 2.13], lampFront);
  }
  box(g, [1.56, 0.12, 0.06], [0, 0.74, -2.13], lampRear);
  box(g, [0.52, 0.12, 0.05], [0, 0.48, 2.14], mat(isEV ? '#4ade80' : '#f8fafc', 0.5));
  box(g, [0.52, 0.12, 0.05], [0, 0.48, -2.14], mat(isEV ? '#4ade80' : '#f8fafc', 0.5));
}

/** 300 kW Ultra-Hızlı DC Elektrikli Araç Şarj İstasyonu Ünitesi */
function addEVCharger(parent: THREE.Object3D, x: number, z: number, connectedToCar = true) {
  const g = new THREE.Group();
  g.position.set(x, 0.08, z);
  parent.add(g);

  const whiteSteel = mat('#f8fafc', 0.35, 0.25);
  const darkSteel = mat('#0f172a', 0.38, 0.55);
  const cableMat = mat('#18181b', 0.75);
  const yellowGuard = mat('#eab308', 0.5, 0.3);
  const ledCharging = new THREE.MeshStandardMaterial({
    color: '#bbf7d0',
    emissive: '#22c55e',
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    emissive: '#0284c7',
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });

  // Beton kaide ve koruma demirleri (bollard)
  box(g, [1.1, 0.14, 0.75], [0, 0.07, 0], mat('#94a3b8', 0.8));
  for (const sx of [-0.46, 0.46]) {
    cyl(g, 0.055, 0.65, [sx, 0.35, -0.32], yellowGuard);
  }

  // Ana DC Şarj Kabini
  box(g, [0.76, 2.15, 0.42], [0, 1.2, 0], whiteSteel);
  box(g, [0.64, 1.95, 0.45], [0, 1.2, 0], darkSteel);
  // Üst parlayan yeşil LED şarj durumu tacı
  box(g, [0.78, 0.12, 0.46], [0, 2.24, 0], ledCharging);
  // Yan LED şeritler
  for (const sx of [-0.39, 0.39]) {
    box(g, [0.03, 1.75, 0.12], [sx, 1.25, 0], ledCharging);
  }
  // Dokunmatik LCD şarj ekranı (kuzeye, araca bakar)
  box(g, [0.42, 0.52, 0.04], [0, 1.48, -0.22], screenMat);

  // CCS Şarj Tabancası Yuvaları ve Araca Uzanan Şarj Kablosu
  for (const sx of [-0.42, 0.42]) {
    box(g, [0.1, 0.24, 0.16], [sx, 1.05, -0.1], darkSteel);
  }
  if (connectedToCar) {
    // Şarj ünitesinden aracın şarj portuna uzanan kablo kemeri
    box(g, [0.055, 0.055, 1.35], [0.38, 0.86, -0.72], cableMat);
    box(g, [0.055, 0.32, 0.055], [0.38, 0.98, -0.1], cableMat);
    box(g, [0.12, 0.1, 0.18], [0.32, 0.86, -1.38], ledCharging);
  }
}

export function createOutdoorComplex(): OutdoorComplex {
  const root = new THREE.Group();
  root.name = 'dokuma-outdoor-complex';
  root.userData.outdoorComplex = true;

  const staticGeom = new THREE.Group();
  const boardsGroup = new THREE.Group();
  const labelsGroup = new THREE.Group();
  root.add(staticGeom, boardsGroup, labelsGroup);

  const travertine = mat('#e5dec9', 0.76);
  const woodDeck = mat('#a67546', 0.7);
  const thermowood = mat('#8f5d34', 0.68);
  const oak = mat('#c89f70', 0.62);
  const darkSteel = mat('#1e293b', 0.4, 0.58);
  const marble = mat('#f8fafc', 0.28, 0.05);
  const asphalt = mat('#475056', 0.85);
  const curbMat = mat('#cbd5e1', 0.78);
  const paintWhite = mat('#f8fafc', 0.7);
  const evGreenBay = mat('#166534', 0.78);
  const evStripe = mat('#4ade80', 0.65);
  const solarPanel = mat('#172554', 0.25, 0.65);
  const waterMat = mat('#38bdf8', 0.15, 0.1, 0.82);
  const ledWarm = new THREE.MeshStandardMaterial({
    color: '#fffbeb',
    emissive: '#fde68a',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  // ============================================================================
  // BÖLÜM 1: AÇIK HAVA BAHÇE KAFETERYASI & SOSYAL TERAS (x: 17 .. 61, z: 84 .. 115)
  // ============================================================================
  // Ana traverten teras zemini ve ahşap deck oturma adaları
  box(staticGeom, [43, 0.08, 29], [39, 0.04, 99.5], travertine);
  // Kuzey halka yola (z = 82) ve idari binaya (x = 14) yaya bağlantı yolları
  box(staticGeom, [6.5, 0.08, 4.0], [34, 0.04, 83.5], travertine);
  box(staticGeom, [5.5, 0.08, 7.0], [16.5, 0.04, 96.5], travertine);

  // Ahşap deck kaplamalı açık yemek terası (x: 20 .. 44, z: 94.5 .. 112.5)
  box(staticGeom, [25, 0.04, 18.5], [32, 0.09, 103.5], woodDeck);

  // 1.1 KAFETERYA KİOSK / AÇIK BÜFE & ESPRESSO BARI (x: 21 .. 36, z: 86.2 .. 92.4)
  // Kiosk arka ve yan mimari duvarları + ahşap pergola çatısı
  box(staticGeom, [14.5, 3.3, 0.35], [28.2, 1.7, 86.5], darkSteel);
  box(staticGeom, [14.1, 3.0, 0.12], [28.2, 1.7, 86.72], thermowood);
  box(staticGeom, [0.35, 3.3, 4.8], [21.1, 1.7, 88.7], darkSteel);
  box(staticGeom, [15.4, 0.28, 6.4], [28.2, 3.45, 89.2], darkSteel);
  box(staticGeom, [15.0, 0.1, 6.0], [28.2, 3.28, 89.2], thermowood);
  box(staticGeom, [14.4, 0.06, 0.08], [28.2, 3.24, 92.1], ledWarm);

  // Kiosk Çatı Alınlığı Işıklı Tabelası
  const cafeSignTex = makeBoardTexture(
    'DOKUMA GARDEN CAFE & BISTRO',
    'ESPRESSO BAR · TAZE FIRIN · ORGANİK SALATA & IZGARA',
    '#132a21',
    '#fefce8',
    '#4ade80',
    'AÇIK KAFE',
  );
  const cafeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 1.35),
    new THREE.MeshBasicMaterial({ map: cafeSignTex }),
  );
  cafeSign.position.set(28.2, 4.28, 92.25);
  boardsGroup.add(cafeSign);
  box(staticGeom, [11.9, 1.55, 0.28], [28.2, 4.28, 92.08], darkSteel);

  // Ön Servis & Bar Bankosu (Mermer & Ceviz)
  box(staticGeom, [12.6, 1.05, 1.15], [28.5, 0.6, 90.8], thermowood);
  box(staticGeom, [12.9, 0.1, 1.32], [28.5, 1.16, 90.8], marble);
  box(staticGeom, [12.6, 0.06, 0.05], [28.5, 1.02, 91.4], ledWarm);

  // Tezgâh üstü ekipmanlar: 2 Profesyonel Espresso Makinesi, Camlı Pasta/Sandviç Dolabı, İçecek Sebilleri, POS Kasa
  for (const ex of [23.5, 25.4]) {
    box(staticGeom, [0.75, 0.48, 0.52], [ex, 1.44, 90.75], darkSteel);
    box(staticGeom, [0.78, 0.08, 0.55], [ex, 1.7, 90.75], mat('#d4af37', 0.3, 0.8));
  }
  // Camlı soğuk sandviç & tatlı teşhir vitrini
  box(staticGeom, [2.4, 0.62, 0.78], [28.2, 1.52, 90.8], mat('#bae6fd', 0.18, 0.1, 0.42));
  for (const sy of [1.35, 1.58]) {
    box(staticGeom, [2.25, 0.03, 0.68], [28.2, sy, 90.8], marble);
    for (let px = -0.8; px <= 0.8; px += 0.4) {
      cyl(staticGeom, 0.13, 0.08, [28.2 + px, sy + 0.06, 90.8], mat(px < 0 ? '#fde68a' : '#fda4af', 0.7));
    }
  }
  // Limonata & taze meyve suyu sebilleri + POS yazar kasa
  for (const [jx, col] of [
    [30.6, '#fde047'],
    [31.2, '#fb923c'],
    [31.8, '#4ade80'],
  ] as const) {
    cyl(staticGeom, 0.15, 0.44, [jx, 1.43, 90.8], mat(col, 0.35, 0.05, 0.78));
  }
  box(staticGeom, [0.46, 0.34, 0.05], [33.4, 1.48, 90.85], darkSteel);

  // Arka hazırlık tezgâhı ve menü panoları
  box(staticGeom, [12.2, 0.95, 0.75], [28.5, 0.56, 87.3], darkSteel);
  // Banko önü yüksek bar tabureleri
  for (let bx = 23.2; bx <= 33.6; bx += 1.3) {
    cyl(staticGeom, 0.035, 0.72, [bx, 0.44, 92.05], darkSteel);
    cyl(staticGeom, 0.21, 0.06, [bx, 0.82, 92.05], oak);
  }
  // Baristalar ve büfe önündeki çalışanlar
  addPerson(staticGeom, 25.0, 89.2, 0, '#f8fafc', '#1e293b', '#27272a', false, '#15803d');
  addPerson(staticGeom, 29.5, 89.2, 0, '#f8fafc', '#1e293b', '#451a03', false, '#15803d');
  addPerson(staticGeom, 27.6, 92.7, Math.PI, '#38bdf8', '#334155', '#1c1917');
  addPerson(staticGeom, 32.8, 92.7, Math.PI, '#fde047', '#1e293b', '#78350f');

  // 1.2 GÜNEŞ ŞEMSİYELİ BAHÇE MASALARI (8 Adet Yuvarlak Masa + Oturan Çalışanlar)
  const umbrellaTables: Array<[number, number, string, Array<[number, string, string, string]>]> = [
    [23.5, 97.2, '#15803d', [[0, '#e0f2fe', '#1e293b', '#292524'], [2, '#fef08a', '#334155', '#78350f']]],
    [29.5, 97.2, '#f59e0b', [[1, '#dcfce7', '#1e293b', '#1c1917'], [3, '#f5d0fe', '#475569', '#451a03']]],
    [35.5, 97.2, '#15803d', [[0, '#fed7aa', '#1e293b', '#27272a']]],
    [41.5, 97.2, '#0284c7', [[1, '#f1f5f9', '#334155', '#1c1917'], [2, '#86efac', '#1e293b', '#78350f']]],
    [23.5, 103.5, '#f59e0b', [[0, '#fae8ff', '#1e293b', '#451a03'], [3, '#bae6fd', '#334155', '#27272a']]],
    [29.5, 103.5, '#15803d', [[1, '#fef3c7', '#1e293b', '#1c1917'], [2, '#bbf7d0', '#334155', '#451a03']]],
    [35.5, 103.5, '#0284c7', [[0, '#fed7aa', '#475569', '#78350f']]],
    [41.5, 103.5, '#15803d', [[2, '#e0f2fe', '#1e293b', '#292524'], [3, '#fde68a', '#334155', '#1c1917']]],
  ];
  for (const [tx, tz, col, p] of umbrellaTables) {
    addUmbrellaTable(staticGeom, tx, tz, col, p);
  }

  // 1.3 AHŞAP PERGOLA KAMELYALAR (3 Adet — x: 42, 48.5, 55, z: 89.2)
  addPergolaBooth(staticGeom, 42.0, 89.2, '#52796f');
  addPergolaBooth(staticGeom, 48.5, 89.2, '#c27d56');
  addPergolaBooth(staticGeom, 55.0, 89.2, '#52796f');

  // 1.4 DEKORATİF SÜS HAVUZU, FISKİYE & ZEN BAHÇESİ (x: 52.5, z: 103.5)
  box(staticGeom, [11.5, 0.36, 9.5], [52.5, 0.22, 103.5], mat('#cbd5e1', 0.65));
  box(staticGeom, [10.5, 0.28, 8.5], [52.5, 0.3, 103.5], waterMat);
  // Merkez taş fıskiye heykeli ve su köpüğü küreleri
  cyl(staticGeom, 1.1, 0.45, [52.5, 0.48, 103.5], darkSteel);
  cyl(staticGeom, 0.55, 0.95, [52.5, 0.9, 103.5], marble);
  sphere(staticGeom, [0.45, 0.65, 0.45], [52.5, 1.55, 103.5], mat('#e0f2fe', 0.2, 0.05, 0.85));
  // Havuz kenarı ahşap dinlenme bankları
  for (const bz of [97.8, 109.2]) {
    box(staticGeom, [3.2, 0.44, 0.65], [52.5, 0.28, bz], oak);
  }

  // 1.5 REKREASYON KÖŞESİ: AÇIK HAVA MASA TENİSİ (PİNG-PONG) & DİNLENME BANKLARI (x: 26 .. 38, z: 109.5)
  // Masa tenisi masası (x = 28, z = 109.5)
  box(staticGeom, [2.74, 0.06, 1.52], [28.0, 0.84, 109.5], mat('#1d4ed8', 0.45));
  box(staticGeom, [2.76, 0.065, 0.04], [28.0, 0.845, 109.5], paintWhite);
  box(staticGeom, [0.03, 0.16, 1.62], [28.0, 0.95, 109.5], paintWhite);
  for (const sx of [-1.1, 1.1]) {
    for (const sz of [-0.6, 0.6]) {
      box(staticGeom, [0.06, 0.76, 0.06], [28.0 + sx, 0.46, 109.5 + sz], darkSteel);
    }
  }
  addPerson(staticGeom, 26.3, 109.5, Math.PI / 2, '#22c55e', '#1e293b', '#1c1917');
  addPerson(staticGeom, 29.7, 109.5, -Math.PI / 2, '#f97316', '#334155', '#451a03');

  // Kafeterya çevresi peyzaj ağaçları ve aydınlatma direkleri
  for (const [tx, tz] of [
    [19.2, 87.5],
    [19.2, 100.5],
    [19.2, 111.5],
    [45.8, 111.5],
    [59.2, 96.5],
    [59.2, 110.5],
  ] as const) {
    addTree(staticGeom, tx, tz, 1.0);
  }

  // ============================================================================
  // BÖLÜM 2: GENİŞ OTOPARK & GÜNEŞ ENERJİLİ EV HIZLI ŞARJ İSTASYONU (x: 63 .. 115, z: 84 .. 115)
  // ============================================================================
  // Ana asfalt otopark platformu (51m × 30m) ve çevre bordür taşları
  box(staticGeom, [51, 0.07, 30], [89, 0.035, 99.5], asphalt);
  // Kuzey halka yola (z = 82) bağlanan 2 geniş giriş/çıkış ağzı (x = 69 ve x = 96)
  box(staticGeom, [8.5, 0.075, 4.2], [69, 0.038, 83.2], asphalt);
  box(staticGeom, [8.5, 0.075, 4.2], [96, 0.038, 83.2], asphalt);
  // Sürüş koridoru kesikli şerit çizgileri
  for (let lx = 68; lx <= 108; lx += 4.5) {
    box(staticGeom, [2.1, 0.02, 0.14], [lx, 0.078, 88.2], paintWhite);
    box(staticGeom, [2.1, 0.02, 0.14], [lx, 0.078, 102.5], paintWhite);
  }

  // Otopark & EV Şarj Giriş Totemi (x = 64.2, z = 85.2)
  box(staticGeom, [1.25, 3.6, 0.34], [64.2, 1.85, 85.2], darkSteel);
  const evTotemTex = makeBoardTexture(
    'OTOPARK & EV HIZLI ŞARJ',
    '10× 300 kW DC SUPERCHARGER · SOLAR CARPORT',
    '#0c241c',
    '#f8fafc',
    '#4ade80',
    '⚡ EV 300kW',
  );
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 2.5),
      new THREE.MeshBasicMaterial({ map: evTotemTex }),
    );
    p.position.set(64.2, 2.05, 85.2 + side * 0.19);
    if (side < 0) p.rotation.y = Math.PI;
    boardsGroup.add(p);
  }

  // 2.1 GÜNEY SIRASI: 10 ADET ELEKTRİKLİ ARAÇ (EV) HIZLI ŞARJ PARK YERİ + SOLAR CARPORT KANOPİSİ
  // (x: 67 .. 111, z: 108.5 .. 113.8)
  const evCars: Array<[number, string, boolean]> = [
    [0, '#f8fafc', false],
    [1, '#0ea5e9', true],
    [2, '#10b981', false],
    [4, '#e2e8f0', true],
    [5, '#6366f1', false],
    [6, '#22c55e', true],
    [8, '#f1f5f9', false],
    [9, '#14b8a6', true],
  ];

  for (let i = 0; i < 10; i++) {
    const bx = 68.5 + i * 4.5;
    // Yeşil EV zemin kaplaması ve parlayan çerçeve şeritleri
    box(staticGeom, [3.8, 0.02, 5.2], [bx, 0.078, 109.2], evGreenBay);
    box(staticGeom, [0.14, 0.025, 5.4], [bx - 2.25, 0.08, 109.2], evStripe);
    if (i === 9) box(staticGeom, [0.14, 0.025, 5.4], [bx + 2.25, 0.08, 109.2], evStripe);
    // Tekerlek stoperi (wheel stopper)
    box(staticGeom, [1.8, 0.12, 0.22], [bx, 0.13, 111.3], mat('#eab308', 0.6));

    const carEntry = evCars.find((c) => c[0] === i);
    // 300 kW DC Hızlı Şarj Ünitesi (z = 113.2)
    addEVCharger(staticGeom, bx, 113.2, !!carEntry);
    if (carEntry) {
      addVehicle(staticGeom, bx, 109.0, 0, carEntry[1], true, carEntry[2]);
    }
  }

  // EV Sırası Üzerinde Güneş Panelli Çelik Carport Kanopisi (Solar EV Canopy — 46m uzunluğunda)
  for (let cx = 67.5; cx <= 111.5; cx += 8.8) {
    box(staticGeom, [0.26, 3.6, 0.26], [cx, 1.85, 112.4], darkSteel);
    box(staticGeom, [0.22, 0.22, 5.8], [cx, 3.6, 109.8], darkSteel);
  }
  const evRoof = box(staticGeom, [46.5, 0.16, 6.2], [89.0, 3.72, 109.8], darkSteel);
  evRoof.rotation.x = -0.08;
  const evPanels = box(staticGeom, [45.6, 0.08, 5.7], [89.0, 3.82, 109.8], solarPanel);
  evPanels.rotation.x = -0.08;
  // Kanopi altı sıcak LED aydınlatma barı
  box(staticGeom, [44.5, 0.05, 0.12], [89.0, 3.52, 108.2], ledWarm);

  // EV Kanopisi Alınlık Tabelası
  const canopySignTex = makeBoardTexture(
    '⚡ DOKUMA EV SUPERCHARGER · %100 SOLAR ENERJİ',
    '10× 300 kW ULTRA-HIZLI DC ŞARJ İSTASYONU',
    '#0a221a',
    '#f0fdf4',
    '#4ade80',
    'SOLAR EV',
  );
  const canopySign = new THREE.Mesh(
    new THREE.PlaneGeometry(14.5, 1.15),
    new THREE.MeshBasicMaterial({ map: canopySignTex }),
  );
  canopySign.position.set(89.0, 4.35, 106.7);
  canopySign.rotation.y = Math.PI;
  boardsGroup.add(canopySign);
  box(staticGeom, [14.9, 1.3, 0.22], [89.0, 4.35, 106.82], darkSteel);

  // 2.2 ORTA ADA: ÇİFT YÖNLÜ PERSONEL & ZİYARETÇİ OTOPARKI (16 Park Yeri — x: 68.5 .. 104.5, z: 92 .. 99.5)
  // Ortada bordürlü peyzaj refüjü (z = 95.6)
  box(staticGeom, [39.5, 0.18, 1.2], [87.0, 0.14, 95.6], curbMat);
  box(staticGeom, [38.8, 0.08, 0.85], [87.0, 0.24, 95.6], mat('#4d7c43', 0.85));

  const staffCarsNorth: Array<[number, string, boolean]> = [
    [0, '#cbd5e1', false],
    [1, '#334155', true],
    [3, '#dc2626', false],
    [4, '#f59e0b', false],
    [6, '#0284c7', true],
    [7, '#e2e8f0', false],
  ];
  const staffCarsSouth: Array<[number, string, boolean]> = [
    [0, '#475569', true],
    [2, '#f8fafc', false],
    [3, '#0d9488', false],
    [5, '#7c3aed', true],
    [6, '#94a3b8', false],
    [8, '#ea580c', false],
  ];

  for (let i = 0; i < 9; i++) {
    const bx = 69.0 + i * 4.4;
    // Kuzey cepleri (z = 92.4) ve Güney cepleri (z = 98.8)
    box(staticGeom, [0.12, 0.02, 4.8], [bx - 2.2, 0.078, 92.4], paintWhite);
    box(staticGeom, [0.12, 0.02, 4.8], [bx - 2.2, 0.078, 98.8], paintWhite);
    if (i === 8) {
      box(staticGeom, [0.12, 0.02, 4.8], [bx + 2.2, 0.078, 92.4], paintWhite);
      box(staticGeom, [0.12, 0.02, 4.8], [bx + 2.2, 0.078, 98.8], paintWhite);
    }
    const cn = staffCarsNorth.find((c) => c[0] === i);
    if (cn) addVehicle(staticGeom, bx, 92.4, Math.PI, cn[1], false, cn[2]);
    const cs = staffCarsSouth.find((c) => c[0] === i);
    if (cs) addVehicle(staticGeom, bx, 98.8, 0, cs[1], false, cs[2]);
  }

  // Refüj üzerinde ağaçlar ve çift kollu otopark aydınlatma direkleri
  for (const lx of [72, 82, 92, 102]) {
    cyl(staticGeom, 0.09, 5.6, [lx, 2.9, 95.6], darkSteel);
    box(staticGeom, [0.4, 0.1, 1.8], [lx, 5.7, 95.6], ledWarm);
  }
  for (const tx of [77, 87, 97]) {
    addTree(staticGeom, tx, 95.6, 0.85, false);
  }

  // 2.3 E-SCOOTER & ELEKTRİKLİ BİSİKLET ŞARJ DURAĞI (x = 64.2, z = 96.5)
  box(staticGeom, [2.4, 0.12, 6.2], [64.2, 0.1, 96.5], curbMat);
  box(staticGeom, [2.2, 2.35, 0.14], [64.2, 1.25, 93.5], darkSteel);
  box(staticGeom, [2.2, 2.35, 0.14], [64.2, 1.25, 99.5], darkSteel);
  box(staticGeom, [2.5, 0.14, 6.4], [64.2, 2.45, 96.5], darkSteel);
  box(staticGeom, [2.2, 0.06, 6.0], [64.2, 2.52, 96.5], solarPanel);
  for (let sz = 94.3; sz <= 98.7; sz += 0.88) {
    // Şarj standı ve E-Scooter'lar
    box(staticGeom, [0.22, 0.85, 0.18], [63.4, 0.55, sz], evStripe);
    box(staticGeom, [0.95, 0.08, 0.18], [64.1, 0.24, sz], darkSteel);
    cyl(staticGeom, 0.03, 0.88, [63.7, 0.65, sz], darkSteel);
    box(staticGeom, [0.08, 0.06, 0.42], [63.7, 1.08, sz], darkSteel);
    for (const wx of [63.68, 64.52]) {
      const sw = cyl(staticGeom, 0.14, 0.08, [wx, 0.22, sz], mat('#18181b', 0.8));
      sw.rotation.x = Math.PI / 2;
    }
  }

  // ============================================================================
  // BÖLÜM 3: BÖLGE ETİKETLERİ ("Etiket" #chkLabels İLE GİZLENİP AÇILABİLİR)
  // ============================================================================
  const labels: Array<[string, string, string, [number, number, number]]> = [
    ['Açık Hava Kafeterya & Sosyal Teras', 'Espresso Bar · Şemsiyeli Masalar · Kamelyalar', '#4ade80', [34, 5.8, 98]],
    ['EV Hızlı Şarj İstasyonu (10×300 kW)', 'Solar Carport · Elektrikli Araç Şarj Alanı', '#38bdf8', [89, 6.2, 110]],
    ['Personel & Ziyaretçi Otoparkı', 'Çift Sıra Otopark & E-Scooter Şarj Durağı', '#facc15', [86, 5.8, 95.6]],
  ];
  for (const [title, sub, col, pos] of labels) {
    const sp = makeLabelSprite(title, sub, col);
    sp.position.set(pos[0], pos[1], pos[2]);
    labelsGroup.add(sp);
  }

  instanceGroup(staticGeom);

  return {
    group: root,
    setLabelsVisible(visible: boolean) {
      labelsGroup.visible = visible;
    },
    overview() {
      return {
        pos: new THREE.Vector3(64, 38, 142),
        target: new THREE.Vector3(64, 1.0, 99),
      };
    },
  };
}
