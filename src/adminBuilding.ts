import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { AssetLibrary } from './assets';
import { batchStaticAsset } from './assets';

/**
 * Yönetim binası (yonetim-bina.glb) entegrasyonu.
 * - Yalnızca `fabrika-idari-binasi` alınır; arkadaki `cevre` (zemin/yol/fabrika siluetleri) alınmaz.
 * - İç duvarlar/dolgu hacmi, tavan ışıkları ve eski kafeterya mobilyaları çıkarılır; katlar boş bırakılır.
 * - Kat sayısı `ADMIN_FLOORS` ile ayarlanır (modelde 4 kat vardır).
 * - Zemin kat batı kanadında İzleme Odası (SCADA video duvarı, masa, bilgisayarlar, oturan çalışanlar) vardır.
 * - Bina içine "kat kesiti" ile girilir: seçilen katın üstü kesme düzlemiyle gizlenir.
 */
export const ADMIN_FLOORS = 3;
/** Modelin ham ölçüleri (metre): zemin kat 4.1 m, sonraki katlar 3.6 m, çatı döşemesi 15.2 m'den başlar. */
const MODEL_FLOORS = 4, FLOOR_HEIGHT = 3.6, ROOF_START = 15.2, FIRST_SLAB_TOP = 4.4;
/** Fabrika sınırı içinde, halka yolun güneyinde; ön cephe (+z) güneydeki giriş kapısına bakar. */
export const ADMIN_PLACEMENT = { position: [-18.5, 0, 94.75] as [number, number, number], rotationY: 0 };
/** Her katın döşeme üst kotu ve tavan altı (kesme) kotu — model koordinatı. */
const FLOOR_Y = [0.15, 4.4, 8.0], CEILING_Y = [4.1, 7.7, 11.3];

export interface AdminUnit {
  id: string; name: string; floor: number; icon: string;
  /** Model koordinatında [x, z] merkez ve [genişlik, derinlik]. */
  center: [number, number]; size: [number, number];
  desc: string; status: 'ready' | 'planned';
}
export const ADMIN_UNITS: AdminUnit[] = [
  { id: 'monitor', name: 'İzleme Odası', floor: 0, icon: '🖥️', center: [-12.75, -2], size: [13.5, 11.6], desc: 'SCADA video duvarı · enerji, buhar ve hat izleme', status: 'ready' },
  { id: 'lobby', name: 'Ana Lobi & Sergi', floor: 0, icon: '🛋️', center: [6.9, -2], size: [25.6, 11.6], desc: 'Ürün sergisi · broşür & figürler · bekleme alanı · asansörler', status: 'ready' },
  { id: 'reception', name: 'Giriş / Resepsiyon', floor: 0, icon: '🛎️', center: [5, 7.2], size: [10, 6.6], desc: 'Güvenlik · ziyaretçi kaydı · karşılama bankosu', status: 'ready' },
  { id: 'cafeteria', name: 'Kafeterya', floor: 0, icon: '🍽️', center: [-26.75, 1], size: [13.5, 14], desc: 'Kantin · kahve köşesi · yemek salonu', status: 'ready' },
  { id: 'it', name: 'Bilgi İşlem & Sistem Odası', floor: 0, icon: '🖧', center: [24.25, -1], size: [8.4, 13.8], desc: 'Sunucu kabinetleri · ağ & siber güvenlik (NOC) · UPS güç merkezi', status: 'ready' },
  { id: 'gm', name: 'Genel Müdürlük', floor: 1, icon: '👔', center: [-12.75, -3.05], size: [13.5, 9.4], desc: 'Makam odası · VIP ağırlama · strateji masası · özel kalem', status: 'ready' },
  { id: 'meeting', name: 'Toplantı Salonu', floor: 1, icon: '🗣️', center: [0, -3.05], size: [12, 9.4], desc: 'Yönetim kurulu masası · 4K sunum duvarı · kürsü · ikram büfesi', status: 'ready' },
  { id: 'hr', name: 'İnsan Kaynakları', floor: 1, icon: '🧑‍💼', center: [11.8, -3.05], size: [11.6, 9.4], desc: 'Personel & bordro ofisi · mülakat masası · İSG eğitim alanı', status: 'ready' },
  { id: 'rd', name: 'Ar-Ge & Tasarım Stüdyosu', floor: 1, icon: '✂️', center: [24.25, -1], size: [8.4, 13.8], desc: 'Koleksiyon tasarım adası · canlı mankenler · numune kesim & dijital baskı', status: 'ready' },
  { id: 'planning', name: 'Üretim Planlama', floor: 2, icon: '📋', center: [-12.75, -3.05], size: [13.5, 9.4], desc: 'Gantt & kapasite ekranı · MRP çalışma adası · kalıp plotter & pafta masası', status: 'ready' },
  { id: 'quality', name: 'Kalite & Laboratuvar', floor: 2, icon: '🧪', center: [0, -3.05], size: [12, 9.4], desc: 'Fiziksel & kimyasal test tezgâhları · D65 renk kabini · mukavemet cihazı', status: 'ready' },
  { id: 'finance', name: 'Muhasebe & Satın Alma', floor: 2, icon: '📊', center: [11.8, -3.05], size: [11.6, 9.4], desc: 'Muhasebe & finans adası · satın alma & tedarikçi masası · fatura arşivi', status: 'ready' },
  { id: 'logistics', name: 'İhracat & Lojistik Ofisi', floor: 2, icon: '🚢', center: [24.25, -1], size: [8.4, 13.8], desc: 'Küresel konteyner takip · gümrük operasyon adası · yurt dışı müşteri salonu', status: 'ready' },
];

export interface AdminBuilding {
  group: THREE.Group;
  units: AdminUnit[];
  floors: number;
  /** -1 = tüm bina; 0.. = o katın üstü kesilir (kat kesiti). */
  setFloor(floor: number): void;
  /** Birim işaretini vurgular (null = hepsi sönük). */
  highlight(id: string | null): void;
  /** Üst menüdeki "Etiket" tikiyle birim etiketlerini göster/gizle. */
  setLabelsVisible(visible: boolean): void;
  /** Birimin dünya koordinatında kamera hedefi. */
  focus(id: string): { pos: THREE.Vector3; target: THREE.Vector3 } | null;
  /** Dünya noktasına denk gelen birim (kat kesiti açıkken). */
  unitAt(world: THREE.Vector3): AdminUnit | null;
  overview(): { pos: THREE.Vector3; target: THREE.Vector3 };
  /** Verilen dünya yüksekliği kesme düzleminin üstünde mi (görünmüyor mu)? */
  clipped(y: number): boolean;
}

// İzleme odası (zemin kat batı kanadı) iç ölçüleri, model koordinatında.
const ROOM = { x0: -19.5, x1: -6, z0: -7.88, z1: 3.6 };

export async function createAdminBuilding(assets: AssetLibrary, floors = ADMIN_FLOORS): Promise<AdminBuilding | null> {
  const source = await assets.load('yonetim-bina/yonetim-bina.glb', true);
  if (!source) return null;
  const root = source.getObjectByName('fabrika-idari-binasi');
  if (!root) { console.warn('yonetim-bina.glb içinde fabrika-idari-binasi bulunamadı.'); return null; }
  source.updateMatrixWorld(true);
  const n = THREE.MathUtils.clamp(Math.round(floors), 1, MODEL_FLOORS);
  const dy = (MODEL_FLOORS - n) * FLOOR_HEIGHT, cut = FIRST_SLAB_TOP + (n - 1) * FLOOR_HEIGHT, eps = 0.01;
  const main = new THREE.Group();
  const groupOf = (o: THREE.Object3D) => { let p: THREE.Object3D | null = o; while (p && p.parent !== root) p = p.parent; return p?.name ?? ''; };
  let cekirdekMat: THREE.MeshStandardMaterial | null = null;

  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const part = groupOf(o), material = o.material as THREE.MeshStandardMaterial;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    geometry.computeBoundingBox();
    const b = geometry.boundingBox!, size = b.getSize(new THREE.Vector3());
    const drop = () => geometry.dispose();
    // Dolgu hacmi: ana bloğu ve doğu çekirdek bloğunu içten dolu gösteren kutular — iç mekân boş kalmalı.
    if (part === 'ana-blok' && size.x > 39 && size.y > 15 && size.z > 11) return drop();
    if (part === 'cekirdek' && size.x > 8 && size.y > 16 && size.z > 13) { cekirdekMat = material; return drop(); }
    // Ana blok ile doğu çekirdek arasındaki sağır duvar (x ≈ 20): koridor geçişi açmak için aşağıda parçalı oluşturulur.
    if (part === 'ana-blok' && b.min.x > 19.5 && size.x < 0.5 && size.z > 10) return drop();
    // Tavan/şerit aydınlatmaları (ince ve emissive) iç mekânın parçası.
    if (material.emissiveIntensity > 0 && material.emissive.getHex() !== 0 && size.y < 1) return drop();
    // Kafeterya mobilyası ve resepsiyon masası: zemin döşemesi (≤0.15 m) dışındaki alçak parçalar.
    if ((part === 'kafeterya' && b.max.y < 1 && b.max.y > 0.3) || (part === 'giris-pavyonu' && b.max.y < 1.5 && b.max.y > 0.3)) return drop();
    if (n < MODEL_FLOORS) {
      if (b.min.y >= cut - eps && b.max.y <= ROOF_START + eps) return drop();   // kaldırılan katlar
      const pos = geometry.getAttribute('position');
      if (b.min.y >= ROOF_START - eps) for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - dy);  // çatı elemanları aşağı iner
      else if (size.y > 4 && b.min.y < cut - eps && b.max.y > cut + eps) {           // tüm kat boyunca uzanan dikmeler/duvarlar kısalır
        const k = (size.y - dy) / size.y;
        for (let i = 0; i < pos.count; i++) pos.setY(i, b.min.y + (pos.getY(i) - b.min.y) * k);
      }
      pos.needsUpdate = true;
    }
    for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (material.transparent) { mesh.castShadow = false; material.depthWrite = false; }
    main.add(mesh);
  });

  // Zemin kat döşemesi + doğu çekirdek bloğu (x: 20 .. 28.5, z: -8 .. 6) dış duvarları ve kat döşemeleri
  const slabMat = new THREE.MeshStandardMaterial({ color: '#7d766a', roughness: 0.7, metalness: 0.2 });
  const wallMat = cekirdekMat ?? new THREE.MeshStandardMaterial({ color: '#d5cfc4', roughness: 0.65, metalness: 0.2 });
  const addStructBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    geom.deleteAttribute('uv');
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; main.add(m);
  };
  addStructBox(39.6, 0.15, 11.6, 0, 0.075, -2, slabMat);
  // Doğu çekirdek bloğu (x: 20.0 .. 28.5, z: -8.0 .. 6.0) kat döşemeleri ve çatı plağı
  const hCek = 17.0 - dy, hMain = ROOF_START - dy;
  addStructBox(8.5, 0.15, 14.0, 24.25, 0.075, -1.0, slabMat);
  for (const sy of [4.25, 7.85, 11.45]) addStructBox(8.5, 0.3, 14.0, 24.25, sy, -1.0, slabMat);
  addStructBox(8.5, 0.3, 14.0, 24.25, hCek - 0.15, -1.0, slabMat);
  // Doğu çekirdek bloğu çevre duvarları (kuzey, doğu, güney ve koridor geçişli batı ara duvarı)
  addStructBox(8.5, hCek, 0.24, 24.25, hCek / 2, -7.88, wallMat);
  addStructBox(0.24, hCek, 14.0, 28.38, hCek / 2, -1.0, wallMat);
  addStructBox(8.5, hCek, 0.24, 24.25, hCek / 2, 5.88, wallMat);
  addStructBox(0.24, hCek, 2.35, 20.0, hCek / 2, 4.825, wallMat);    // z: 3.65 .. 6.00 (güney çıkıntı batı duvarı)
  addStructBox(0.25, hMain, 9.75, 20.0, hMain / 2, -3.225, wallMat); // z: -8.10 .. 1.65 (asansör arkası ara duvar; z: 1.65..3.65 koridor geçişi açık!)

  const monitorRoom = buildMonitoringRoom();

  const building = new THREE.Group();
  building.rotation.y = ADMIN_PLACEMENT.rotationY;
  building.position.set(...ADMIN_PLACEMENT.position);
  const shell = batchStaticAsset(main);
  building.add(
    shell,
    monitorRoom, buildCafeteria(), buildReception(), buildLobby(), buildITServerRoom(),
    buildUpperFloorCorridor(1), buildExecutiveSuite(), buildMeetingRoom(), buildHumanResources(), buildRDDesignStudio(),
    buildUpperFloorCorridor(2), buildProductionPlanning(), buildQualityLab(), buildFinancePurchasing(), buildExportLogistics()
  );

  // Kat kesiti: tüm bina malzemelerine dünya uzayında yatay kesme düzlemi.
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
  building.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.clippingPlanes = [clip]; m.clipShadows = true; }
  });

  const markers = buildMarkers(), markerOf = new Map<string, { zone: THREE.Mesh; edge: THREE.LineSegments; label: THREE.Sprite; unit: AdminUnit }>();
  for (const m of markers.children as THREE.Group[]) markerOf.set(m.name, m.userData as never);
  building.add(markers);

  const group = new THREE.Group();
  group.name = 'admin-building'; group.userData.adminBuilding = true;
  group.add(building);

  const pos = new THREE.Vector3(...ADMIN_PLACEMENT.position);
  const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), ADMIN_PLACEMENT.rotationY).add(pos);
  let shownFloor = -1, labelsVisible = true, highlightedId: string | null = null;
  const syncMarkers = () => {
    for (const [key, m] of markerOf) {
      const onFloor = shownFloor >= 0 && m.unit.floor === shownFloor;
      m.zone.parent!.visible = onFloor;
      m.label.visible = labelsVisible;
      m.edge.visible = labelsVisible || key === highlightedId;
      (m.zone.material as THREE.MeshBasicMaterial).opacity = key === highlightedId ? 0.28 : 0.0;
      (m.edge.material as THREE.LineBasicMaterial).color.set(key === highlightedId ? '#ffe08a' : '#ffffff');
    }
  };
  const api: AdminBuilding = {
    group, units: ADMIN_UNITS, floors: n,
    setFloor(floor) {
      shownFloor = Math.min(floor, n - 1);
      clip.constant = shownFloor < 0 ? 100 : CEILING_Y[shownFloor];
      syncMarkers();
    },
    highlight(id) {
      highlightedId = id;
      syncMarkers();
    },
    setLabelsVisible(visible) {
      labelsVisible = visible;
      syncMarkers();
    },
    focus(id) {
      const u = ADMIN_UNITS.find((x) => x.id === id); if (!u) return null;
      const t = toWorld(u.center[0], FLOOR_Y[u.floor] + 0.8, u.center[1]), d = Math.max(...u.size) * 0.75 + 4;
      return { pos: t.clone().add(new THREE.Vector3(0, d * 0.95, d * 0.8)), target: t };
    },
    unitAt(world) {
      const p = world.clone().sub(pos);
      if (shownFloor < 0) return null;
      return ADMIN_UNITS.find((u) => u.floor === shownFloor && Math.abs(p.x - u.center[0]) <= u.size[0] / 2 && Math.abs(p.z - u.center[1]) <= u.size[1] / 2) ?? null;
    },
    clipped: (y) => y > clip.constant + 0.01,
    overview() { return { pos: toWorld(26, 34, 34), target: toWorld(-3, 2, -1) }; },
  };
  api.setFloor(-1); api.highlight(null);
  return api;
}

// ---------------------------------------------------------------------------------------------
const std = (color: string, roughness = 0.7, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function slabBox(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material); m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function rounded(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], material: THREE.Material, rx = 0, r = 0.025) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, r), material); m.position.set(...pos); m.rotation.x = rx; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(parent: THREE.Object3D, r: number, h: number, pos: [number, number, number], material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), material); m.position.set(...pos); m.castShadow = true; parent.add(m); return m;
}
/** İki nokta arasına silindir (kol/bacak). */
function limb(parent: THREE.Object3D, a: [number, number, number], b: [number, number, number], r: number, material: THREE.Material) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, len, 10), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  m.castShadow = true; parent.add(m); return m;
}

/** Ekran içeriği: referans fotoğraftaki SCADA panolarını anımsatan çizimler. */
function screenTexture(kind: 'blue' | 'energy' | 'boiler' | 'plant' | 'map' | 'desk' | 'menu' | 'coffee' | 'logo' | 'directory' | 'showroom' | 'gm_wall' | 'exec_kpi' | 'board_pres' | 'hr_board' | 'plan_board' | 'lab_board' | 'fin_board') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const g = c.getContext('2d')!;
  if (kind === 'blue') {
    g.fillStyle = '#4a4de0'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#05060f'; g.beginPath(); g.roundRect(196, 130, 120, 26, 4); g.fill();
    g.fillStyle = '#e5e7eb'; g.font = '600 14px system-ui'; g.textAlign = 'center'; g.fillText('NO SIGNAL', 256, 148);
  } else if (kind === 'logo') {
    g.fillStyle = '#10343a'; g.fillRect(0, 0, 512, 288);
    g.strokeStyle = '#d6b878'; g.lineWidth = 3; g.strokeRect(14, 14, 484, 260);
    g.fillStyle = '#d6b878'; g.font = '700 84px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DOKUMA', 256, 118);
    g.fillStyle = '#e9e3cf'; g.font = '500 28px system-ui'; g.fillText('TEKSTİL YERLEŞKESİ', 256, 190);
    g.fillRect(150, 222, 212, 3);
  } else if (kind === 'gm_wall') {
    g.fillStyle = '#141c24'; g.fillRect(0, 0, 512, 288);
    g.strokeStyle = '#d6b878'; g.lineWidth = 4; g.strokeRect(14, 14, 484, 260);
    g.strokeStyle = 'rgba(214,184,120,0.4)'; g.lineWidth = 1.5; g.strokeRect(24, 24, 464, 240);
    g.fillStyle = '#d6b878'; g.font = '700 44px system-ui'; g.textAlign = 'center'; g.fillText('DOKUMA HOLDİNG', 256, 86);
    g.fillStyle = '#f3ede0'; g.font = '600 24px system-ui'; g.fillText('GENEL MÜDÜRLÜK MAKAMI', 256, 134);
    g.fillStyle = '#d6b878'; g.fillRect(146, 156, 220, 3);
    g.fillStyle = '#9fb3c8'; g.font = '500 18px system-ui'; g.fillText('Kuruluş: 1984 · Entegre Tekstil & Konfeksiyon', 256, 198);
    g.fillStyle = '#d6b878'; g.font = '600 16px system-ui'; g.fillText('KALİTE · SÜRDÜRÜLEBİLİRLİK · KÜRESEL İHRACAT', 256, 236);
  } else if (kind === 'exec_kpi') {
    g.fillStyle = '#0f172a'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#1e293b'; g.fillRect(0, 0, 512, 36);
    g.fillStyle = '#f8fafc'; g.font = '700 18px system-ui'; g.textAlign = 'left'; g.fillText('📊 YÖNETİM KURULU · 2026 STRATEJİK PERFORMANS', 16, 24);
    const cards: [string, string, string][] = [['YILLIK CİRO', '$48,6M', '#22c55e'], ['İHRACAT PAYI', '%74,2', '#38bdf8'], ['KAPASİTE (OEE)', '%91,4', '#f59e0b']];
    cards.forEach(([lbl, val, col], i) => {
      const x = 18 + i * 162;
      g.fillStyle = '#1e293b'; g.fillRect(x, 50, 150, 74);
      g.fillStyle = '#94a3b8'; g.font = '600 13px system-ui'; g.fillText(lbl, x + 12, 72);
      g.fillStyle = col; g.font = '700 28px system-ui'; g.fillText(val, x + 12, 108);
    });
    g.fillStyle = '#1e293b'; g.fillRect(18, 138, 474, 132);
    g.fillStyle = '#cbd5e1'; g.font = '600 14px system-ui'; g.fillText('AYLIK İHRACAT & ÜRETİM TRENDİ (Q1-Q4)', 30, 162);
    for (let i = 0; i < 10; i++) {
      const h = 35 + ((i * 19 + 11) % 65);
      g.fillStyle = i > 6 ? '#22c55e' : '#38bdf8';
      g.fillRect(36 + i * 44, 254 - h, 26, h);
    }
  } else if (kind === 'board_pres') {
    g.fillStyle = '#0b1528'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#1d3557'; g.fillRect(0, 0, 512, 38);
    g.fillStyle = '#e2e8f0'; g.font = '700 18px system-ui'; g.textAlign = 'left'; g.fillText('🗣️ YÖNETİM KURULU · 2026 YATIRIM & KAPASİTE PLANI', 16, 25);
    g.fillStyle = '#132238'; g.fillRect(16, 50, 300, 222);
    g.fillStyle = '#d6b878'; g.font = '700 16px system-ui'; g.fillText('BOYA & APRE HATTI MODERNİZASYONU', 28, 76);
    [['Su Geri Kazanım Oranı', '%88 (+14%)', '#22c55e'], ['GES Çatı Enerji Payı', '%62 (+18%)', '#38bdf8'], ['Konfeksiyon Otomasyon', '%94 (+9%)', '#f59e0b']].forEach(([k, v, col], i) => {
      g.fillStyle = '#94a3b8'; g.font = '500 14px system-ui'; g.fillText(k, 28, 110 + i * 50);
      g.fillStyle = '#1e293b'; g.fillRect(28, 118 + i * 50, 200, 14);
      g.fillStyle = col; g.fillRect(28, 118 + i * 50, 145 + i * 18, 14);
      g.font = '700 14px system-ui'; g.fillText(v, 236, 130 + i * 50);
    });
    // Sağda video konferans katılımcı pencereleri
    [['Münih Ofis', '#1e3a5f'], ['Milano Showroom', '#2a4365'], ['Londra Depo', '#1a365d'], ['Bursa Tesis', '#2c5282']].forEach(([loc, bg], i) => {
      const vx = 328 + (i % 2) * 86, vy = 50 + Math.floor(i / 2) * 114;
      g.fillStyle = bg; g.fillRect(vx, vy, 80, 104);
      g.fillStyle = '#cbd5e1'; g.beginPath(); g.arc(vx + 40, vy + 40, 16, 0, Math.PI * 2); g.fill();
      g.fillRect(vx + 18, vy + 62, 44, 24);
      g.fillStyle = '#0f172a'; g.fillRect(vx, vy + 84, 80, 20);
      g.fillStyle = '#38bdf8'; g.font = '600 10px system-ui'; g.textAlign = 'center'; g.fillText(loc, vx + 40, vy + 98);
    });
  } else if (kind === 'hr_board') {
    g.fillStyle = '#122429'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#0f766e'; g.fillRect(0, 0, 512, 38);
    g.fillStyle = '#f8fafc'; g.font = '700 18px system-ui'; g.textAlign = 'left'; g.fillText('🧑‍💼 İNSAN KAYNAKLARI · ORGANİZASYON & İSG PANOSU', 16, 25);
    [['TOPLAM PERSONEL', '486 Kişi', '#2dd4bf'], ['İSG SIFIR KAZA', '412 Gün', '#22c55e'], ['EĞİTİM TAMAMLAMA', '%96,8', '#facc15']].forEach(([t, v, col], i) => {
      const x = 18 + i * 162;
      g.fillStyle = '#1b353c'; g.fillRect(x, 52, 150, 76);
      g.fillStyle = '#99f6e4'; g.font = '600 12px system-ui'; g.fillText(t, x + 12, 74);
      g.fillStyle = col; g.font = '700 26px system-ui'; g.fillText(v, x + 12, 110);
    });
    g.fillStyle = '#1b353c'; g.fillRect(18, 142, 474, 130);
    g.fillStyle = '#f1f5f9'; g.font = '700 15px system-ui'; g.fillText('DEPARTMAN DAĞILIMI & AKTİF ORYANTASYON PROGRAMI', 30, 168);
    [['Boyahane & Apre: 164', '#38bdf8', 30, 200], ['Konfeksiyon & Kesim: 218', '#34d399', 260, 200], ['Kalite & Ar-Ge: 52', '#fbbf24', 30, 240], ['İdari & Lojistik: 52', '#a78bfa', 260, 240]].forEach(([txt, col, x, y]) => {
      g.fillStyle = col as string; g.fillRect(x as number, (y as number) - 12, 12, 12);
      g.fillStyle = '#e2e8f0'; g.font = '500 15px system-ui'; g.fillText(txt as string, (x as number) + 20, y as number);
    });
  } else if (kind === 'plan_board') {
    g.fillStyle = '#0f172a'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, 512, 38);
    g.fillStyle = '#f8fafc'; g.font = '700 17px system-ui'; g.textAlign = 'left'; g.fillText('📋 ÜRETİM PLANLAMA · MRP & HAT GANTT ÇİZELGESİ', 16, 25);
    const lines: [string, number, number, string, string][] = [
      ['HT-01 Dokuma', 20, 210, '#38bdf8', '%94 · #PO-4821'],
      ['HT-02 Boyahane', 65, 195, '#22c55e', '%89 · #PO-4824'],
      ['HT-03 Ram/Apre', 40, 220, '#f59e0b', '%92 · #PO-4829'],
      ['HT-04 Kesim/CAD', 95, 180, '#a78bfa', '%97 · #PO-4832'],
      ['HT-05 Konfeksiyon', 30, 240, '#34d399', '%91 · #PO-4835'],
    ];
    lines.forEach(([name, st, w, col, pct], i) => {
      const y = 56 + i * 44;
      g.fillStyle = '#1e293b'; g.fillRect(16, y, 480, 34);
      g.fillStyle = '#cbd5e1'; g.font = '600 13px system-ui'; g.fillText(name, 26, y + 22);
      g.fillStyle = '#0f172a'; g.fillRect(150, y + 7, 230, 20);
      g.fillStyle = col; g.fillRect(150 + st * 0.6, y + 7, w * 0.75, 20);
      g.fillStyle = '#f8fafc'; g.font = '700 12px system-ui'; g.fillText(pct, 390, y + 22);
    });
  } else if (kind === 'lab_board') {
    g.fillStyle = '#0c1f24'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#0e7490'; g.fillRect(0, 0, 512, 38);
    g.fillStyle = '#f8fafc'; g.font = '700 17px system-ui'; g.textAlign = 'left'; g.fillText('🧪 KALİTE KONTROL & LABORATUVAR TEST SONUÇLARI', 16, 25);
    [['RENK SAPMASI (ΔE)', '0,38 (OK)', '#22c55e'], ['KOPMA MUKAVEMETİ', '640 N', '#38bdf8'], ['YIKAMA HASLIĞI', '4-5 / 5', '#facc15']].forEach(([t, v, col], i) => {
      const x = 18 + i * 162;
      g.fillStyle = '#16323a'; g.fillRect(x, 52, 150, 74);
      g.fillStyle = '#a5f3fc'; g.font = '600 12px system-ui'; g.fillText(t, x + 12, 74);
      g.fillStyle = col; g.font = '700 24px system-ui'; g.fillText(v, x + 12, 108);
    });
    g.fillStyle = '#16323a'; g.fillRect(18, 140, 474, 132);
    g.fillStyle = '#e2e8f0'; g.font = '700 14px system-ui'; g.fillText('SPEKTROFOTOMETRE · D65 GÜN IŞIĞI & MUKAVEMET EĞRİSİ', 30, 166);
    g.strokeStyle = '#38bdf8'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 12; i++) { const px = 34 + i * 36, py = 248 - Math.sin(i * 0.45) * 55 - (i % 3) * 8; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
    g.strokeStyle = '#22c55e'; g.beginPath();
    for (let i = 0; i <= 12; i++) { const px = 34 + i * 36, py = 252 - Math.cos(i * 0.38) * 42; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  } else if (kind === 'fin_board') {
    g.fillStyle = '#141b2d'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#1e40af'; g.fillRect(0, 0, 512, 38);
    g.fillStyle = '#f8fafc'; g.font = '700 17px system-ui'; g.textAlign = 'left'; g.fillText('📊 MUHASEBE, FİNANS & TEDARİK ZİNCİRİ PANOSU', 16, 25);
    [['AYLIK FATURA HACMİ', '₺64,8M', '#34d399'], ['HAMMADDE STOK DEVİR', '14,2 Gün', '#38bdf8'], ['ONAYLI TEDARİKÇİ', '128 Firma', '#fbbf24']].forEach(([t, v, col], i) => {
      const x = 18 + i * 162;
      g.fillStyle = '#1f2942'; g.fillRect(x, 52, 150, 74);
      g.fillStyle = '#93c5fd'; g.font = '600 12px system-ui'; g.fillText(t, x + 12, 74);
      g.fillStyle = col; g.font = '700 24px system-ui'; g.fillText(v, x + 12, 108);
    });
    g.fillStyle = '#1f2942'; g.fillRect(18, 140, 474, 132);
    g.fillStyle = '#e2e8f0'; g.font = '700 14px system-ui'; g.fillText('PAMUK / İPLİK / BOYA SATIN ALMA & İHRACAT TAHSİLAT AKIŞI', 30, 166);
    for (let i = 0; i < 8; i++) {
      const bx = 36 + i * 56, h1 = 38 + (i * 17) % 52, h2 = 30 + (i * 23 + 9) % 56;
      g.fillStyle = '#38bdf8'; g.fillRect(bx, 258 - h1, 18, h1);
      g.fillStyle = '#34d399'; g.fillRect(bx + 20, 258 - h2, 18, h2);
    }
  } else if (kind === 'showroom') {
    g.fillStyle = '#18242c'; g.fillRect(0, 0, 512, 288);
    g.strokeStyle = '#d6b878'; g.lineWidth = 3; g.strokeRect(12, 12, 488, 264);
    g.fillStyle = '#d6b878'; g.font = '700 32px system-ui'; g.textAlign = 'center'; g.fillText('KOLEKSİYON & ÜRÜN SERGİSİ', 256, 54);
    g.fillStyle = '#cfe2df'; g.font = '500 20px system-ui'; g.fillText('Sürdürülebilir Kumaş · Boyama · Konfeksiyon', 256, 94);
    const badges: [string, string, string][] = [['OEKO-TEX®', 'STANDARD 100', '#22c55e'], ['ISO 9001', 'KALİTE YÖNETİMİ', '#38bdf8'], ['GOTS', 'ORGANİK TEKSTİL', '#f59e0b']];
    badges.forEach(([t1, t2, col], i) => {
      const bx = 42 + i * 150;
      g.fillStyle = '#0f1720'; g.fillRect(bx, 126, 128, 120);
      g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(bx, 126, 128, 120);
      g.fillStyle = col; g.font = '700 20px system-ui'; g.fillText(t1, bx + 64, 174);
      g.fillStyle = '#e2e8f0'; g.font = '500 13px system-ui'; g.fillText(t2, bx + 64, 208);
    });
  } else if (kind === 'directory') {
    g.fillStyle = '#12202b'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#d6b878'; g.font = '700 30px system-ui'; g.textAlign = 'center'; g.fillText('HOŞ GELDİNİZ', 256, 42);
    g.font = '600 20px system-ui'; g.textAlign = 'left';
    [['ZEMİN', 'İzleme · Resepsiyon · Kafeterya'], ['1. KAT', 'Genel Müdürlük · Toplantı · İK'], ['2. KAT', 'Planlama · Kalite · Muhasebe']].forEach(([a, b], i) => { g.fillStyle = '#38bdf8'; g.fillText(a, 28, 105 + i * 62); g.fillStyle = '#e8eef2'; g.font = '500 18px system-ui'; g.fillText(b, 28, 130 + i * 62); g.font = '600 20px system-ui'; });
  } else if (kind === 'menu' || kind === 'coffee') {
    const coffee = kind === 'coffee';
    g.fillStyle = coffee ? '#2b1d14' : '#16231f'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = coffee ? '#d6a15c' : '#e8c46a'; g.font = '700 30px system-ui'; g.textAlign = 'center'; g.fillText(coffee ? '☕ KAHVE KÖŞESİ' : 'GÜNÜN MENÜSÜ', 256, 46);
    g.font = '500 22px system-ui'; g.fillStyle = '#f1efe6';
    const rows = coffee ? [['Türk Kahvesi', '25'], ['Filtre Kahve', '30'], ['Latte', '45'], ['Çay', '10'], ['Bitki Çayı', '20']] : [['Mercimek Çorbası', '15'], ['Tavuk Sote + Pilav', '75'], ['Izgara Köfte', '85'], ['Mevsim Salata', '30'], ['Sütlaç', '25']];
    rows.forEach(([a, b], i) => { g.textAlign = 'left'; g.fillText(a, 40, 100 + i * 36); g.textAlign = 'right'; g.fillText(b + ' ₺', 472, 100 + i * 36); });
  } else if (kind === 'desk') {
    g.fillStyle = '#0f2742'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 512, 30);
    g.fillStyle = '#e2e8f0'; g.fillRect(24, 56, 300, 190); g.fillStyle = '#16a34a'; g.fillRect(24, 56, 300, 22);
    g.fillStyle = '#334155'; for (let i = 0; i < 7; i++) g.fillRect(40, 96 + i * 20, 150 + (i * 37) % 110, 8);
    g.fillStyle = '#f59e0b'; g.fillRect(350, 70, 130, 70); g.fillStyle = '#38bdf8'; g.fillRect(350, 160, 130, 70);
  } else {
    g.fillStyle = '#f4f6f4'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#15803d'; g.fillRect(0, 0, 512, 26);
    g.fillStyle = '#fff'; g.font = '700 16px system-ui'; g.textAlign = 'left'; g.fillText(({ energy: 'ENERJİ İZLEME', boiler: 'BUHAR KAZANI', plant: 'ÜRETİM HATTI', map: 'KAMPÜS HARİTASI' })[kind], 10, 19);
    if (kind === 'energy') {
      g.font = '700 26px system-ui'; g.fillStyle = '#dc2626'; g.fillText('221,07 kW', 20, 70); g.fillText('224,48 kW', 190, 70); g.fillStyle = '#16a34a'; g.fillText('6644 Kg', 360, 70);
      g.strokeStyle = '#334155'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.strokeRect(30 + i * 120, 110, 90, 50); g.beginPath(); g.moveTo(75 + i * 120, 160); g.lineTo(75 + i * 120, 220); g.stroke(); }
      g.fillStyle = '#2563eb'; g.fillRect(40, 235, 140, 30); g.fillStyle = '#16a34a'; g.fillRect(200, 235, 140, 30);
    } else if (kind === 'boiler') {
      g.fillStyle = '#94a3b8'; g.fillRect(40, 70, 40, 180); g.fillStyle = '#b91c1c'; g.beginPath(); g.roundRect(130, 150, 200, 90, 16); g.fill();
      g.fillStyle = '#64748b'; g.beginPath(); g.roundRect(350, 120, 120, 100, 20); g.fill();
      g.fillStyle = '#0f172a'; g.font = '700 20px system-ui'; g.fillText('162,8 °C', 140, 120); g.fillText('5,72 bar', 360, 100);
    } else if (kind === 'plant') {
      g.strokeStyle = '#475569'; g.lineWidth = 4; g.beginPath(); g.moveTo(20, 140); g.lineTo(490, 140); g.stroke();
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#0ea5e9' : '#22c55e'; g.fillRect(30 + i * 78, 100, 50, 80); }
      g.fillStyle = '#0f172a'; g.font = '600 16px system-ui'; for (let i = 0; i < 4; i++) g.fillText(`HT-0${i + 1}  %${60 + i * 9}`, 30 + i * 120, 230);
    } else {
      for (const [x, y, w, h, col] of [[30, 50, 140, 90, '#60a5fa'], [190, 50, 150, 90, '#34d399'], [360, 50, 120, 90, '#fbbf24'], [30, 160, 200, 100, '#f472b6'], [250, 160, 230, 100, '#a78bfa']] as const) { g.fillStyle = col; g.fillRect(x, y, w, h); }
    }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
type Kind = Parameters<typeof screenTexture>[0];
function screen(parent: THREE.Object3D, w: number, h: number, kind: Kind, pos: [number, number, number], rotY = 0) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = rotY;
  slabBox(g, [w + 0.06, h + 0.06, 0.08], [0, 0, 0], std('#0b0d12', 0.5, 0.5));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: screenTexture(kind), toneMapped: false }));
  face.position.z = 0.045; g.add(face); parent.add(g); return g;
}

/** Ofis koltuğu: yuvarlatılmış oturak/sırtlık, kolçak, gaz pistonu, 5 kollu ayak ve tekerlekler. +z öne bakar. */
function officeChair(parent: THREE.Object3D, x: number, z: number, rotY: number, mats: { seat: THREE.Material; back: THREE.Material; metal: THREE.Material }) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rotY; parent.add(c);
  rounded(c, [0.5, 0.08, 0.5], [0, 0.5, 0], mats.seat, 0, 0.03);
  rounded(c, [0.46, 0.5, 0.07], [0, 0.86, -0.25], mats.back, -0.1, 0.03);
  rounded(c, [0.22, 0.12, 0.06], [0, 1.18, -0.29], mats.back, -0.1, 0.025);
  for (const s of [-1, 1]) { slabBox(c, [0.03, 0.2, 0.03], [s * 0.27, 0.63, -0.04], mats.metal); rounded(c, [0.06, 0.035, 0.28], [s * 0.27, 0.74, -0.02], mats.back, 0, 0.012); }
  cyl(c, 0.035, 0.34, [0, 0.29, 0], mats.metal);
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5, arm = slabBox(c, [0.045, 0.03, 0.3], [Math.sin(a) * 0.15, 0.11, Math.cos(a) * 0.15], mats.metal); arm.rotation.y = a;
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mats.back); wheel.position.set(Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3); c.add(wheel);
  }
  return c;
}

/** Oturan çalışan (öne +z bakar; koltuk merkezine göre). Gövde, baş, saç, klavyeye uzanan kollar. */
function seatedWorker(chair: THREE.Object3D, shirt: string, hair: string, female = false) {
  const w = new THREE.Group(); chair.add(w);
  const skin = std('#d9a883', 0.85, 0), shirtM = std(shirt, 0.9, 0), pants = std('#2b3140', 0.9, 0), shoe = std('#16181b', 0.8, 0.1), hairM = std(hair, 0.9, 0);
  rounded(w, [0.34, 0.16, 0.24], [0, 0.59, -0.02], pants, 0, 0.04);                         // kalça
  rounded(w, [0.36, 0.5, 0.2], [0, 0.9, -0.05], shirtM, 0.05, 0.06);                         // gövde
  cyl(w, 0.045, 0.1, [0, 1.2, -0.02], skin);                                                  // boyun
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), skin); head.position.set(0, 1.32, 0); head.scale.set(0.95, 1.1, 1); w.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.113, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM); cap.position.set(0, 1.335, -0.012); cap.scale.set(0.95, 1.1, 1); w.add(cap);
  if (female) {   // omuz hizasına inen saç, kirpik/ruj hissi için kıvrık uç
    const back = rounded(w, [0.22, 0.34, 0.1], [0, 1.24, -0.09], hairM, 0.05, 0.05); back.castShadow = true;
    for (const s of [-1, 1]) rounded(w, [0.04, 0.2, 0.1], [s * 0.1, 1.28, -0.02], hairM, 0, 0.02);
    rounded(w, [0.4, 0.12, 0.3], [0, 0.6, 0.06], pants, 0, 0.05);   // etek hacmi
  }
  for (const s of [-1, 1]) {
    limb(w, [s * 0.1, 0.6, 0], [s * 0.1, 0.6, 0.42], 0.075, pants);                           // uyluk
    limb(w, [s * 0.1, 0.58, 0.42], [s * 0.1, 0.09, 0.46], 0.062, pants);                      // baldır
    rounded(w, [0.11, 0.07, 0.25], [s * 0.1, 0.045, 0.52], shoe, 0, 0.03);                    // ayakkabı
    limb(w, [s * 0.2, 1.1, -0.04], [s * 0.22, 0.9, 0.2], 0.05, shirtM);                       // üst kol
    limb(w, [s * 0.22, 0.9, 0.2], [s * 0.12, 0.86, 0.5], 0.043, shirtM);                      // ön kol
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin); hand.position.set(s * 0.12, 0.86, 0.52); w.add(hand);
  }
}

/** Masa üstü bilgisayar: monitör (ekranlı), ayak, klavye, fare. Yerel +z oturana bakar. */
function computer(parent: THREE.Object3D, x: number, y: number, z: number, rotY: number, screenMat: THREE.Material, black: THREE.Material, mat: THREE.Material) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
  slabBox(g, [0.22, 0.015, 0.16], [0, 0.008, 0], black);
  slabBox(g, [0.04, 0.2, 0.03], [0, 0.11, -0.02], black);
  slabBox(g, [0.6, 0.36, 0.03], [0, 0.3, 0], black);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), screenMat); face.position.set(0, 0.3, 0.018); g.add(face);
  rounded(g, [0.42, 0.02, 0.14], [0, 0.012, 0.33], mat, 0, 0.008);                              // klavye
  rounded(g, [0.06, 0.025, 0.1], [0.32, 0.014, 0.33], black, 0, 0.012);                         // fare
}

function buildMonitoringRoom() {
  const g = new THREE.Group(); g.name = 'monitoring-room';
  const cx = (ROOM.x0 + ROOM.x1) / 2, cz = (ROOM.z0 + ROOM.z1) / 2;
  const wood = std('#8a6a47', 0.55, 0.05), dark = std('#14171c', 0.5, 0.5), tableTop = std('#6b4a2c', 0.45, 0.05);
  // Parke zemin
  slabBox(g, [ROOM.x1 - ROOM.x0, 0.03, ROOM.z1 - ROOM.z0], [cx, 0.165, cz], wood).castShadow = false;
  // Tavan LED panelleri (zemin kat tavan altı 4.1 m)
  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.6 });
  for (const x of [cx - 4, cx, cx + 4]) for (const z of [-5, -1.5, 2]) slabBox(g, [1.2, 0.03, 0.6], [x, 4.06, z], led).castShadow = false;
  // Cam bölme (doğu yüz): kapı boşluğu bırakılır; iç duvar değil, şeffaf oda sınırı.
  const glass = new THREE.MeshStandardMaterial({ color: '#8db7c9', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
  for (const [a, b] of [[ROOM.z0, 0.2], [1.4, ROOM.z1]] as const) { slabBox(g, [0.04, 3.0, b - a], [ROOM.x1, 1.65, (a + b) / 2], glass).castShadow = false; slabBox(g, [0.07, 0.05, b - a], [ROOM.x1, 3.17, (a + b) / 2], dark); }
  for (const z of [ROOM.z0, 0.2, 1.4, ROOM.z1]) slabBox(g, [0.07, 3.15, 0.07], [ROOM.x1, 1.7, z], dark);
  // Video duvarı: 3 x 2 panel, arka duvarda
  const pw = 1.9, ph = 1.07, kinds: Kind[] = ['blue', 'blue', 'energy', 'plant', 'blue', 'map'];
  kinds.forEach((kind, i) => screen(g, pw, ph, kind, [cx + (i % 3 - 1) * (pw + 0.07), 2.9 - Math.floor(i / 3) * (ph + 0.07), ROOM.z0 + 0.07]));
  // Yan ekranlar (sehpalı)
  for (const side of [-1, 1]) {
    const x = cx + side * 5.3, z = ROOM.z0 + 2.6, rot = -side * (Math.PI / 2 - 0.45);
    const stand = new THREE.Group(); stand.position.set(x, 0, z); stand.rotation.y = rot; g.add(stand);
    screen(stand, 2.3, 1.3, side < 0 ? 'energy' : 'boiler', [0, 1.55, 0]);
    for (const lx of [-0.8, 0.8]) { const leg = slabBox(stand, [0.06, 1.1, 0.06], [lx, 0.6, -0.3], dark); leg.rotation.x = 0.25; slabBox(stand, [0.06, 0.06, 0.7], [lx, 0.2, -0.05], dark); }
    slabBox(stand, [1.8, 0.05, 0.05], [0, 0.95, -0.2], dark);
  }
  // Toplantı masası
  const tz = ROOM.z0 + 6.6, tw = 6, td = 1.9, tcx = cx;
  rounded(g, [tw, 0.07, td], [tcx, 0.78, tz], tableTop, 0, 0.03);
  for (const sx of [-1, 1]) { slabBox(g, [0.06, 0.74, td - 0.3], [tcx + sx * (tw / 2 - 0.4), 0.4, tz], dark); slabBox(g, [0.5, 0.04, td - 0.3], [tcx + sx * (tw / 2 - 0.4), 0.03, tz], dark); }
  // Bilgisayarlar + koltuklar + oturan çalışanlar
  const deskScreen = new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false }), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: std('#2b3038', 0.85, 0.05), back: std('#1c2026', 0.9, 0.05), metal: std('#8d949c', 0.35, 0.8) };
  const shirts = ['#2f5fa8', '#a8b3bd', '#3f7f6a', '#b0553d', '#5b6b8c', '#8e8a5a'], hairs = ['#2a1d14', '#7a5a3a', '#161616', '#5a3b22'];
  const xs = [-2.1, -0.7, 0.7, 2.1];
  let wi = 0;
  for (const side of [1, -1]) xs.forEach((dx, i) => {
    const x = tcx + dx, chairZ = tz + side * 1.25, rotY = side > 0 ? Math.PI : 0;  // +side: duvara (video) dönük oturur
    computer(g, x, 0.815, tz + side * 0.28, side > 0 ? 0 : Math.PI, deskScreen, black, keys);
    const chair = officeChair(g, x, chairZ, rotY, chairMats);
    if (side > 0 || i === 0 || i === 3) { seatedWorker(chair, shirts[wi % shirts.length], hairs[wi % hairs.length]); wi++; }
  });
  officeChair(g, tcx - tw / 2 - 0.55, tz, -Math.PI / 2, chairMats); officeChair(g, tcx + tw / 2 + 0.55, tz, Math.PI / 2, chairMats);
  // Masa üstü eşyalar
  slabBox(g, [0.3, 0.02, 0.22], [tcx - 0.2, 0.825, tz + 0.05], std('#e8e6df', 0.9, 0));
  rounded(g, [0.3, 0.02, 0.2], [tcx + 0.5, 0.83, tz - 0.05], std('#222831', 0.4, 0.6), 0, 0.008);
  cyl(g, 0.04, 0.1, [tcx - 1.1, 0.865, tz], std('#d9d9d9', 0.4, 0.2));
  return batchStaticAsset(g);
}

/** Ana lobi ve sergi alanı: taş zemin, ürün/manken podyumu, kumaş numune masası, 3B fabrika maketi, broşür standları, bekleme grupları ve asansörler. x -5.9..19.7, z -7.75..3.7. */
function buildLobby() {
  const g = new THREE.Group(); g.name = 'lobby';
  const X0 = -5.9, X1 = 19.7, Z0 = -7.75, Z1 = 3.7, cx = (X0 + X1) / 2;
  const stone = std('#d8d3c6', 0.35, 0.1), stoneDark = std('#a9a498', 0.4, 0.1), wood = std('#8a6a47', 0.5, 0.05), dark = std('#14171c', 0.5, 0.4), steel = std('#aab2ba', 0.3, 0.85), chairLeg = std('#2a2d33', 0.4, 0.7);
  const leather = std('#3d4a52', 0.7, 0.05), accent = std('#c2553a', 0.8, 0), rug = std('#2f5560', 0.95, 0), gold = std('#c9a24a', 0.3, 0.8), cream = std('#efeae0', 0.6, 0.05);
  // Zemin: tüm orta ve doğu kanat boyunca açık taş + koyu şerit çerçeve
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, (Z0 + Z1) / 2], stone).castShadow = false;
  for (const z of [-0.7, 3.6]) slabBox(g, [X1 - X0, 0.032, 0.08], [cx, 0.168, z], stoneDark).castShadow = false;
  // Sağ arka duvar: ahşap çıta panel + aydınlatmalı DOKUMA tabelası
  for (let x = 9; x <= 17; x += 0.25) slabBox(g, [0.12, 3.5, 0.08], [x, 1.9, Z0 + 0.06], wood);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.36), new THREE.MeshBasicMaterial({ map: screenTexture('logo'), toneMapped: false })); logo.position.set(13, 2.2, Z0 + 0.14); g.add(logo);
  slabBox(g, [8.2, 0.04, 0.1], [13, 0.4, Z0 + 0.14], std('#fff1d6', 0.4, 0)).castShadow = false;

  // --- Sol/Orta Sergi & Showroom Alanı (x: -5.9 .. 6.2) ---
  // Arka duvar: Koleksiyon & Sertifika panosu + kumaş flama şeritleri
  for (let x = -4.2; x <= 4.6; x += 0.25) slabBox(g, [0.1, 3.4, 0.06], [x, 1.85, Z0 + 0.05], wood);
  const show = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.14), new THREE.MeshBasicMaterial({ map: screenTexture('showroom'), toneMapped: false })); show.position.set(0.2, 2.2, Z0 + 0.13); g.add(show);
  for (const [fx, col] of [[-3.3, '#2f6f8f'], [-2.5, '#c2553a'], [2.9, '#d9a441'], [3.7, '#4f8a5b']] as const) {
    slabBox(g, [0.55, 2.2, 0.04], [fx, 2.1, Z0 + 0.12], std(col, 0.85, 0));
    slabBox(g, [0.62, 0.05, 0.06], [fx, 3.22, Z0 + 0.12], gold);
  }

  // Manken & Tekstil Figür Podyumu (x = 0.2, z = -4.7): 3 adet giydirilmiş vitrin mankeni
  rounded(g, [4.8, 0.14, 1.8], [0.2, 0.25, -4.7], cream, 0, 0.04);
  slabBox(g, [4.86, 0.03, 1.86], [0.2, 0.32, -4.7], gold);
  const mannequin = (mx: number, mz: number, coat: string, skirt: string, scarf: string, tall = false) => {
    const m = new THREE.Group(); m.position.set(mx, 0.33, mz); g.add(m);
    const dressM = std(coat, 0.75, 0.05), lowerM = std(skirt, 0.8, 0), scarfM = std(scarf, 0.6, 0.1), dummy = std('#e6ddd0', 0.6, 0.05);
    cyl(m, 0.22, 0.03, [0, 0.015, 0], gold); cyl(m, 0.022, 0.65, [0, 0.34, 0], steel);               // metal stand
    cyl(m, 0.15, 0.48, [0, 0.62, 0], lowerM);                                                         // etek / alt kalıp
    rounded(m, [0.36, 0.52, 0.22], [0, 1.06, 0], dressM, 0, 0.07);                                    // ceket / üst gövde
    for (const s of [-1, 1]) limb(m, [s * 0.2, 1.26, 0], [s * 0.25, 0.78, 0.04], 0.048, dressM);      // kollar
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 8, 18), scarfM); sash.rotation.x = Math.PI / 2 - 0.25; sash.position.set(0, 1.33, 0.01); m.add(sash);
    cyl(m, 0.045, 0.1, [0, 1.38, 0], dummy);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), dummy); head.position.set(0, 1.52, 0); head.scale.set(0.88, tall ? 1.25 : 1.15, 0.92); m.add(head);
    cyl(m, 0.035, 0.03, [0, 1.65, 0], gold);
  };
  mannequin(-1.35, -4.7, '#1f4e5f', '#d8d3c6', '#e0a94f');
  mannequin(0.2, -4.55, '#b84a39', '#232830', '#f3ede0', true);
  mannequin(1.75, -4.7, '#3f6e58', '#c9bfa8', '#d97b52');

  // Sol Vitrin: Kumaş Ruloları, Katlanmış Ürünler & Ödül Figürü Masası (x = -3.5, z = -1.7)
  {
    const tx = -3.5, tz = -1.7;
    rounded(g, [2.6, 0.76, 1.15], [tx, 0.56, tz], wood, 0, 0.03);
    rounded(g, [2.72, 0.06, 1.25], [tx, 0.97, tz], cream, 0, 0.02);
    // Yatay kumaş topları (rulolar)
    const rollCols = ['#2f6f8f', '#c2553a', '#d9a441', '#4f8a5b', '#7a528a'];
    rollCols.forEach((col, i) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.52, 14), std(col, 0.8, 0));
      r.rotation.x = Math.PI / 2; r.position.set(tx - 0.9 + (i % 3) * 0.22, 1.08 + Math.floor(i / 3) * 0.15, tz - 0.15); r.castShadow = true; g.add(r);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.56, 10), cream);
      core.rotation.x = Math.PI / 2; core.position.copy(r.position); g.add(core);
    });
    // Katlanmış tekstil paketleri & kartela
    for (let s = 0; s < 3; s++) for (let k = 0; k < 4; k++) {
      rounded(g, [0.32, 0.045, 0.26], [tx + 0.05 + s * 0.38, 1.03 + k * 0.05, tz + 0.18], std(rollCols[(s + k) % 5], 0.85, 0), 0, 0.01);
    }
    // Cam fanus içinde altın dokuma figürü / ödül kupası
    cyl(g, 0.16, 0.06, [tx + 0.95, 1.03, tz - 0.15], dark);
    const trophy = new THREE.Mesh(new THREE.TorusKnotGeometry(0.11, 0.028, 36, 8), gold); trophy.position.set(tx + 0.95, 1.24, tz - 0.15); g.add(trophy);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16), new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false }));
    dome.position.set(tx + 0.95, 1.27, tz - 0.15); g.add(dome);
  }

  // Merkez Kaide & Sanatsal "Dokuma Halkaları" Heykel Figürü (x = 0.2, z = -1.5)
  cyl(g, 0.55, 0.88, [0.2, 0.62, -1.5], cream); cyl(g, 0.58, 0.05, [0.2, 1.08, -1.5], gold);
  for (const [r, ry, rx] of [[0.42, 0.3, 0.15], [0.3, -0.5, -0.25], [0.19, 1.1, 0.35]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.032, 12, 28), gold);
    ring.position.set(0.2, 1.55, -1.5); ring.rotation.set(rx, ry, 0); ring.castShadow = true; g.add(ring);
  }
  const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), std('#c2553a', 0.4, 0.3)); coreSphere.position.set(0.2, 1.55, -1.5); g.add(coreSphere);

  // Sağ Vitrin: 3B Minyatür Fabrika Yerleşke Maketi (x = 3.8, z = -1.7)
  {
    const mx = 3.8, mz = -1.7;
    rounded(g, [2.4, 0.78, 1.5], [mx, 0.57, mz], dark, 0, 0.03);
    slabBox(g, [2.3, 0.04, 1.4], [mx, 0.98, mz], std('#4d7a45', 0.9, 0));                           // maket çim tabanı
    slabBox(g, [2.1, 0.015, 0.16], [mx, 1.005, mz], std('#505653', 0.8, 0));                         // maket ana yol
    // Minyatür fabrika binaları + mavi solar çatılar
    const miniBlds: [number, number, number, number, string][] = [
      [-0.75, -0.35, 0.42, 0.36, '#577082'], [-0.1, -0.35, 0.68, 0.38, '#3d7b8a'], [0.65, -0.35, 0.55, 0.36, '#657d83'],
      [-0.75, 0.32, 0.42, 0.36, '#637888'], [-0.1, 0.32, 0.62, 0.36, '#ad8b53'], [0.65, 0.32, 0.58, 0.38, '#698574'],
    ];
    for (const [bx, bz, bw, bd, col] of miniBlds) {
      slabBox(g, [bw, 0.14, bd], [mx + bx, 1.07, mz + bz], std(col, 0.6, 0.2));
      slabBox(g, [bw - 0.06, 0.02, bd - 0.06], [mx + bx, 1.15, mz + bz], std('#1e3a8a', 0.3, 0.6)); // mini güneş paneli
    }
    const caseGlass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false });
    slabBox(g, [2.36, 0.45, 1.46], [mx, 1.22, mz], caseGlass).castShadow = false;
  }

  // Ön Sıra: Ayaklı Broşür / Katalog Standları + Katalog İnceleme Sehpası ve Puflar (z = 1.85)
  const brochureRack = (bx: number, bz: number, rotY: number) => {
    const r = new THREE.Group(); r.position.set(bx, 0, bz); r.rotation.y = rotY; g.add(r);
    rounded(r, [0.58, 0.04, 0.42], [0, 0.2, 0], dark, 0, 0.015);
    for (const sx of [-0.22, 0.22]) slabBox(r, [0.035, 1.25, 0.05], [sx, 0.82, -0.08], steel);
    const panel = rounded(r, [0.52, 1.05, 0.03], [0, 0.92, 0], cream, -0.24, 0.015);
    void panel;
    const cols = ['#c2553a', '#2f6f8f', '#d9a441', '#22c55e', '#f3ede0', '#38bdf8'];
    for (let row = 0; row < 3; row++) {
      const ry = 0.62 + row * 0.28, rz = 0.08 - row * 0.065;
      slabBox(r, [0.48, 0.025, 0.08], [0, ry - 0.07, rz + 0.03], steel);
      for (let c = 0; c < 3; c++) rounded(r, [0.13, 0.19, 0.018], [-0.15 + c * 0.15, ry, rz], std(cols[(row * 3 + c) % cols.length], 0.6, 0), -0.24, 0.005);
    }
  };
  brochureRack(-4.4, 1.85, 0.25);
  brochureRack(-2.1, 1.85, -0.2);
  brochureRack(2.5, 1.85, 0.2);
  // Katalog inceleme sehpası + 3 puf koltuk (x = 0.2, z = 1.85)
  cyl(g, 0.95, 0.02, [0.2, 0.19, 1.85], rug).castShadow = false;
  cyl(g, 0.48, 0.04, [0.2, 0.52, 1.85], cream); cyl(g, 0.05, 0.34, [0.2, 0.35, 1.85], gold); cyl(g, 0.26, 0.03, [0.2, 0.19, 1.85], gold);
  // Sehpa üstünde açık kataloglar ve küçük figür
  slabBox(g, [0.28, 0.02, 0.2], [0.05, 0.55, 1.78], std('#c2553a', 0.6, 0));
  slabBox(g, [0.24, 0.02, 0.18], [0.35, 0.55, 1.92], std('#2f6f8f', 0.6, 0));
  cyl(g, 0.05, 0.14, [0.18, 0.61, 1.68], gold);
  for (const [px, pz, col] of [[-0.65, 1.85, '#c2553a'], [1.05, 1.85, '#3d4a52'], [0.2, 2.68, '#d9a441']] as const) {
    cyl(g, 0.26, 0.36, [px, 0.36, pz], std(col, 0.85, 0));
    cyl(g, 0.27, 0.04, [px, 0.2, pz], gold);
  }

  // --- Sağ Bekleme & Geçiş Alanı (x: 6.2 .. 19.7) ---
  const sofa = (x: number, z: number, rotY: number, w: number, mat: THREE.Material) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rotY; g.add(s);
    rounded(s, [w, 0.2, 0.85], [0, 0.3, 0], mat, 0, 0.06); rounded(s, [w - 0.1, 0.18, 0.7], [0, 0.46, 0.02], mat, 0, 0.07);
    rounded(s, [w, 0.55, 0.2], [0, 0.72, -0.34], mat, -0.1, 0.07);
    for (const sx of [-1, 1]) rounded(s, [0.16, 0.45, 0.85], [sx * (w / 2 - 0.02), 0.5, 0], mat, 0, 0.06);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(s, 0.025, 0.12, [sx * (w / 2 - 0.12), 0.06, sz * 0.35], chairLeg);
  };
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false });
  const group = (x: number, armchairs: boolean) => {
    slabBox(g, [4.2, 0.02, 3.4], [x, 0.19, -3.8], rug).castShadow = false;
    sofa(x, -5.45, 0, 2.1, leather); sofa(x, -2.15, Math.PI, 2.1, armchairs ? leather : accent);
    if (armchairs) { sofa(x - 1.75, -3.8, Math.PI / 2, 0.95, accent); sofa(x + 1.75, -3.8, -Math.PI / 2, 0.95, accent); }
    rounded(g, [1.2, 0.04, 0.65], [x, 0.4, -3.8], glass, 0, 0.015); slabBox(g, [1.1, 0.03, 0.55], [x, 0.22, -3.8], wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.02, 0.2, [x + sx * 0.5, 0.3, -3.8 + sz * 0.25], steel);
    slabBox(g, [0.3, 0.015, 0.22], [x - 0.2, 0.43, -3.8], std('#e8e1d0', 0.8, 0)); cyl(g, 0.06, 0.12, [x + 0.25, 0.48, -3.78], std('#c9d7d4', 0.4, 0));
  };
  group(11, false); group(16.2, true);
  // Turnike geçişi (3 adet, orta geçit engelsiz): gövde + ışık + cam kanat
  for (const x of [11.2, 12.7, 14.2]) {
    rounded(g, [0.22, 1.0, 0.9], [x, 0.66, 1.7], dark, 0, 0.04); slabBox(g, [0.24, 0.03, 0.5], [x, 1.17, 1.7], std('#35c27a', 0.3, 0)).castShadow = false;
    slabBox(g, [0.03, 0.7, 0.5], [x + 0.14, 0.8, 1.55], glass).castShadow = false;
  }
  // Bilgi totemleri: ince ayaklı dikey ekran
  for (const x of [8.2, 18.2]) {
    slabBox(g, [0.7, 0.05, 0.5], [x, 0.19, 2.4], dark); slabBox(g, [0.1, 1.1, 0.1], [x, 0.74, 2.38], dark);
    screen(g, 0.8, 1.35, 'directory', [x, 1.85, 2.4]);
  }
  // Asansörler: doğu duvarında iki çelik kapı, çağrı paneli, kat göstergesi
  for (const z of [-3.2, -1.6]) {
    slabBox(g, [0.1, 2.4, 1.4], [19.65, 1.4, z], dark);
    for (const s of [-1, 1]) slabBox(g, [0.04, 2.2, 0.62], [19.58, 1.3, z + s * 0.32], steel);
    slabBox(g, [0.05, 0.1, 0.5], [19.55, 2.65, z], std('#e8431c', 0.3, 0.1)).castShadow = false;
  }
  slabBox(g, [0.05, 0.3, 0.14], [19.57, 1.15, -2.4], dark); cyl(g, 0.025, 0.02, [19.54, 1.2, -2.4], std('#35c27a', 0.3, 0)).rotation.z = Math.PI / 2; cyl(g, 0.025, 0.02, [19.54, 1.1, -2.4], std('#e8431c', 0.3, 0)).rotation.z = Math.PI / 2;
  // Bitkiler + su sebili
  const pot = std('#6a5a48', 0.8, 0), leaf = std('#4d7a45', 0.9, 0);
  for (const [x, z] of [[-5.2, Z0 + 0.5], [-5.2, 3.0], [6.7, Z0 + 0.5], [19.0, Z0 + 0.5], [19.0, 3.0], [9.5, -0.2]] as const) { cyl(g, 0.26, 0.5, [x, 0.4, z], pot); const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), leaf); f.position.set(x, 1.15, z); f.scale.y = 1.4; g.add(f); }
  rounded(g, [0.35, 1.0, 0.35], [6.7, 0.65, -6.9], std('#dfe5e8', 0.4, 0.2), 0, 0.03); cyl(g, 0.12, 0.3, [6.7, 1.3, -6.9], std('#8ec3dd', 0.2, 0.1));
  // Tavan: tüm lobi ve sergi alanı boyunca LED panelleri
  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1d6', emissiveIntensity: 1.5 });
  for (const x of [-3.5, 0.5, 4.5, 8.5, 13, 17.5]) for (const z of [-6, -2.5, 1]) slabBox(g, [1.2, 0.03, 0.6], [x, 4.06, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** Giriş / resepsiyon: karşılama tezgâhı, telefon + bilgisayar ve oturan sekreter. Pavyon x 0..10, z 3.8..10.2. */
function buildReception() {
  const g = new THREE.Group(); g.name = 'reception';
  const x = 6.9, front = 6.4, work = 5.65;
  const body = std('#e8e4da', 0.5, 0.1), top = std('#3a4047', 0.35, 0.3), wood = std('#8a6a47', 0.5, 0.05), dark = std('#14171c', 0.5, 0.4), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  // Karşılama tezgâhı (yüksek ön panel + üst plaka) ve arkasında çalışma masası
  rounded(g, [3.2, 1.05, 0.45], [x, 0.675, front], body, 0, 0.03);
  rounded(g, [3.4, 0.05, 0.75], [x, 1.2, front - 0.02], top, 0, 0.02);
  rounded(g, [3.0, 0.045, 0.75], [x, 0.74, work], wood, 0, 0.02);
  for (const sx of [-1, 1]) slabBox(g, [0.05, 0.72, 0.6], [x + sx * 1.45, 0.38, work], dark);
  // Ön panelde "RESEPSİYON" yazısı
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const k = c.getContext('2d')!;
  k.fillStyle = '#1f3a5f'; k.fillRect(0, 0, 512, 96); k.fillStyle = '#f1e7c8'; k.font = '700 46px system-ui'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('RESEPSİYON', 256, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); sign.position.set(x, 0.8, front + 0.23); g.add(sign);
  // Bilgisayar: monitör sekretere (−z) bakar
  computer(g, x + 0.1, 0.765, work + 0.12, Math.PI, new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false }), black, keys);
  // Masa telefonu: gövde, ahize, tuş takımı ve ekran
  const px = x - 0.85, pz = work - 0.05, phone = std('#1d2026', 0.4, 0.4);
  rounded(g, [0.22, 0.05, 0.26], [px, 0.787, pz], phone, 0, 0.02);
  const handset = rounded(g, [0.06, 0.045, 0.24], [px - 0.07, 0.835, pz], phone, 0, 0.02); handset.rotation.z = 0.0;
  slabBox(g, [0.02, 0.04, 0.05], [px - 0.07, 0.81, pz - 0.1], phone); slabBox(g, [0.02, 0.04, 0.05], [px - 0.07, 0.81, pz + 0.1], phone);
  slabBox(g, [0.1, 0.012, 0.12], [px + 0.04, 0.816, pz + 0.04], std('#9aa3ad', 0.5, 0.3));
  slabBox(g, [0.1, 0.012, 0.05], [px + 0.04, 0.817, pz - 0.08], std('#4aa3d8', 0.3, 0.1));
  // Küçük eşyalar: kalemlik, ziyaretçi zili, defter, bitki
  cyl(g, 0.045, 0.1, [x + 1.05, 0.815, work + 0.05], std('#2f6f8f', 0.6, 0.1)); cyl(g, 0.05, 0.03, [x + 1.1, 1.245, front - 0.1], std('#c9a24a', 0.3, 0.8));
  slabBox(g, [0.3, 0.02, 0.21], [x + 0.75, 0.775, work + 0.15], std('#f1f1f1', 0.8, 0)); cyl(g, 0.12, 0.2, [x - 1.5, 1.35, front], std('#6a5a48', 0.8, 0));
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std('#4d7a45', 0.9, 0)); leaf.position.set(x - 1.5, 1.62, front); g.add(leaf);
  // Sekreter: döner koltukta, bilgisayar başında
  const chair = officeChair(g, x + 0.1, work - 0.7, 0, { seat: std('#2b3038', 0.85, 0.05), back: std('#1c2026', 0.9, 0.05), metal: std('#8d949c', 0.35, 0.8) });
  seatedWorker(chair, '#f2f2f5', '#5a3320', true);
  return batchStaticAsset(g);
}

/** Kafeterya: kantin servis tezgâhı, kahve köşesi, yemek masaları ve oturma grubu. Yerel koordinat = model koordinatı. */
function buildCafeteria() {
  const g = new THREE.Group(); g.name = 'cafeteria';
  const X0 = -33.4, X1 = -20.1, Z0 = -5.9, Z1 = 7.9, cx = (X0 + X1) / 2;
  const tile = std('#cfc9bb', 0.6, 0.05), woodM = std('#9a7650', 0.55, 0.05), dark = std('#1b1e23', 0.5, 0.4), steel = std('#aab2ba', 0.3, 0.85), white = std('#eeeae0', 0.7, 0), counterM = std('#e9e5da', 0.5, 0.1);
  const seatCols = ['#c2553a', '#2f6f8f', '#d9a441', '#4f8a5b'].map((c) => std(c, 0.8, 0)), chairLeg = std('#2a2d33', 0.4, 0.7);
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, (Z0 + Z1) / 2], tile).castShadow = false;
  // Kahve köşesi zemini: ahşap
  slabBox(g, [3.2, 0.03, 7], [X0 + 1.7, 0.18, 3.6], woodM).castShadow = false;

  // --- Kantin: arka duvar boyunca servis tezgâhı ---
  const cz = Z0 + 1.7;
  rounded(g, [8.4, 1.0, 0.9], [-27.2, 0.65, cz], counterM, 0, 0.03);
  rounded(g, [8.6, 0.05, 1.05], [-27.2, 1.17, cz], std('#3a3f46', 0.4, 0.3), 0, 0.02);                  // tezgâh üstü
  slabBox(g, [8.4, 0.12, 0.2], [-27.2, 0.26, cz + 0.55], dark);                                           // tepsi rayı altı
  slabBox(g, [8.6, 0.03, 0.34], [-27.2, 0.92, cz + 0.72], steel);                                         // tepsi kayar rayı
  const guard = new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
  slabBox(g, [8.2, 0.5, 0.04], [-27.2, 1.47, cz + 0.4], guard).castShadow = false;                        // cam siperlik
  // sıcak yemek küvetleri (gastronorm) + yemekler
  ['#d9a441', '#b4532f', '#7fa14b', '#e5d9a6', '#a14b3a'].forEach((col, i) => {
    const x = -30.5 + i * 1.55;
    slabBox(g, [1.3, 0.12, 0.62], [x, 1.26, cz - 0.05], steel); slabBox(g, [1.12, 0.05, 0.46], [x, 1.33, cz - 0.05], std(col, 0.8, 0));
  });
  // tepsi yığını, kasa
  for (let i = 0; i < 6; i++) slabBox(g, [0.5, 0.03, 0.36], [-31.4, 1.22 + i * 0.035, cz + 0.72], std('#3b4b57', 0.6, 0.2));
  rounded(g, [0.4, 0.2, 0.34], [-23.6, 1.29, cz], dark, 0, 0.03); slabBox(g, [0.3, 0.18, 0.02], [-23.6, 1.46, cz + 0.05], std('#35c27a', 0.4, 0.2)).rotation.x = -0.3;
  // arka raf + menü panoları
  slabBox(g, [8.4, 0.05, 0.4], [-27.2, 1.5, Z0 + 0.3], woodM); slabBox(g, [8.4, 0.05, 0.4], [-27.2, 2.0, Z0 + 0.3], woodM);
  for (let i = 0; i < 12; i++) { slabBox(g, [0.28, 0.2, 0.28], [-30.9 + i * 0.66, 1.63, Z0 + 0.3], std(['#e7e1d3', '#b9c6c9', '#d6a15c'][i % 3], 0.7, 0)); slabBox(g, [0.22, 0.16, 0.22], [-30.7 + i * 0.66, 2.13, Z0 + 0.3], std(['#b4532f', '#7fa14b', '#e5d9a6'][i % 3], 0.8, 0)); }
  screen(g, 1.9, 1.07, 'menu', [-29.8, 3.1, Z0 + 0.08]); screen(g, 1.9, 1.07, 'menu', [-24.6, 3.1, Z0 + 0.08]);
  for (const x of [-31.4, -23]) cyl(g, 0.03, 0.9, [x, 1.2, Z0 + 0.12], steel);                              // askı çubukları

  // --- Kahve köşesi: batı duvarı boyunca bar ---
  const bx = X0 + 0.55;
  rounded(g, [0.7, 1.0, 5.4], [bx, 0.68, 3.9], counterM, 0, 0.03);
  rounded(g, [0.85, 0.05, 5.6], [bx + 0.05, 1.2, 3.9], std('#5a3b22', 0.4, 0.1), 0, 0.02);
  const mach = (z: number) => { rounded(g, [0.5, 0.5, 0.45], [bx - 0.05, 1.47, z], dark, 0, 0.04); slabBox(g, [0.4, 0.06, 0.4], [bx - 0.05, 1.75, z], steel); slabBox(g, [0.04, 0.12, 0.2], [bx + 0.22, 1.35, z], steel); cyl(g, 0.045, 0.1, [bx + 0.24, 1.2, z], std('#f3f1ea', 0.5, 0)); };
  mach(2.4); mach(3.4);                                                                                  // espresso makineleri
  rounded(g, [0.28, 0.5, 0.28], [bx - 0.05, 1.46, 4.4], steel, 0, 0.03);                                  // değirmen
  for (let i = 0; i < 6; i++) cyl(g, 0.04, 0.09, [bx + 0.18, 1.27, 4.8 + i * 0.12], std('#f3f1ea', 0.5, 0)); // fincan dizisi
  slabBox(g, [0.3, 0.04, 3.6], [X0 + 0.2, 2.1, 3.9], woodM);                                              // duvar rafı
  for (let i = 0; i < 8; i++) cyl(g, 0.045, 0.09, [X0 + 0.22, 2.17, 2.4 + i * 0.4], std(['#c2553a', '#f3f1ea', '#2f6f8f'][i % 3], 0.6, 0));
  screen(g, 1.5, 0.85, 'coffee', [X0 + 0.1, 3.0, 3.9], Math.PI / 2);
  for (let i = 0; i < 4; i++) {                                                                          // bar tabureleri
    const z = 2.5 + i * 1.25, s = new THREE.Group(); s.position.set(bx + 1.0, 0, z); g.add(s);
    cyl(s, 0.2, 0.06, [0, 0.76, 0], seatCols[i % 4]); cyl(s, 0.025, 0.7, [0, 0.4, 0], chairLeg); cyl(s, 0.2, 0.03, [0, 0.03, 0], chairLeg);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 16), chairLeg); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; s.add(ring);
  }

  // --- Yemek masaları ve sandalyeler ---
  const cafeChair = (x: number, z: number, rotY: number, mat: THREE.Material) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rotY; g.add(c);
    rounded(c, [0.42, 0.05, 0.42], [0, 0.46, 0], mat, 0, 0.02); rounded(c, [0.42, 0.38, 0.04], [0, 0.72, -0.2], mat, -0.06, 0.015);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(c, 0.018, 0.45, [sx * 0.18, 0.225, sz * 0.18], chairLeg);
  };
  const tableTop = std('#e6e0d2', 0.5, 0.05);
  [-28.3, -24.8, -21.5].forEach((x, ci) => [-0.1, 2.8, 5.7].forEach((z, ri) => {
    const round = (ci + ri) % 2 === 0, t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
    if (round) cyl(t, 0.5, 0.04, [0, 0.75, 0], tableTop);
    else rounded(t, [0.95, 0.04, 0.95], [0, 0.75, 0], tableTop, 0, 0.018);
    cyl(t, 0.04, 0.72, [0, 0.38, 0], chairLeg); cyl(t, 0.25, 0.03, [0, 0.03, 0], chairLeg);
    const mat = seatCols[(ci * 3 + ri) % 4];
    for (const [dx, dz, r] of [[0, 0.72, Math.PI], [0, -0.72, 0], [0.72, 0, -Math.PI / 2], [-0.72, 0, Math.PI / 2]] as const) cafeChair(x + dx, z + dz, r, mat);
    // masa üstü: tepsi, bardak, peçetelik
    slabBox(t, [0.36, 0.02, 0.26], [0.1, 0.78, 0.08], std('#3b4b57', 0.6, 0.2)); cyl(t, 0.04, 0.1, [-0.15, 0.83, -0.1], std('#f3f1ea', 0.5, 0)); slabBox(t, [0.1, 0.1, 0.06], [0.0, 0.82, -0.2], steel);
  }));
  // Oturma köşesi: 2 koltuk + sehpa (doğu-ön köşe)
  const sofa = (x: number, z: number, rotY: number) => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rotY; g.add(s); rounded(s, [0.9, 0.35, 0.8], [0, 0.3, 0], seatCols[1], 0, 0.08); rounded(s, [0.9, 0.5, 0.2], [0, 0.65, -0.32], seatCols[1], -0.08, 0.08); for (const sx of [-1, 1]) rounded(s, [0.15, 0.3, 0.8], [sx * 0.5, 0.5, 0], seatCols[1], 0, 0.06); };
  sofa(-30.4, 7.0, Math.PI); sofa(-22.8, 7.0, Math.PI); rounded(g, [0.9, 0.04, 0.6], [-26.6, 0.4, 7.0], woodM, 0, 0.015); cyl(g, 0.04, 0.36, [-26.6, 0.2, 7.0], chairLeg);
  // Bitkiler, çöp kovası, tavan LED panelleri
  const pot = std('#6a5a48', 0.8, 0), leaf = std('#4d7a45', 0.9, 0);
  for (const [x, z] of [[X1 - 0.4, Z0 + 0.5], [X0 + 0.5, Z1 - 0.5], [X1 - 0.4, Z1 - 0.5]] as const) { cyl(g, 0.22, 0.4, [x, 0.35, z], pot); const f = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), leaf); f.position.set(x, 0.95, z); f.scale.y = 1.3; g.add(f); }
  cyl(g, 0.17, 0.6, [X1 - 0.35, 0.45, 1.5], std('#4a5058', 0.6, 0.3));
  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1d6', emissiveIntensity: 1.5 });
  for (const x of [-30, -26.75, -23.5]) for (const z of [-3, 0.5, 4, 7]) slabBox(g, [1.2, 0.03, 0.6], [x, 4.76, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 1. ve 2. Kat — Boydan Boya Sirkülasyon Koridoru (z: 1.65 .. 3.65) & Doğu Asansör Holü (x: 17.6 .. 19.7). Odalara yalnızca koridordan girilir. */
function buildUpperFloorCorridor(floor: 1 | 2) {
  const g = new THREE.Group(); g.name = `floor-${floor}-corridor`;
  g.position.y = FLOOR_Y[floor] - 0.15;
  const ZC0 = 1.65, ZC1 = 3.65, zMid = (ZC0 + ZC1) / 2;
  const travertine = std('#d8d2c5', 0.38, 0.08), runner = std('#9c9486', 0.45, 0.1), gold = std('#c9a24a', 0.3, 0.8), dark = std('#15181f', 0.45, 0.45), steel = std('#aab2ba', 0.3, 0.85);
  const glass = new THREE.MeshStandardMaterial({ color: '#8db7c9', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.24, depthWrite: false });

  // Güney koridor zemini (x: -19.5 .. 20.2, z: 1.65 .. 3.65) + yürüyüş şeridi (doğu kuleye bağlanır)
  slabBox(g, [39.7, 0.03, ZC1 - ZC0], [0.35, 0.165, zMid], travertine).castShadow = false;
  slabBox(g, [39.2, 0.032, 0.65], [0.35, 0.168, zMid], runner).castShadow = false;
  slabBox(g, [39.2, 0.033, 0.05], [0.35, 0.17, ZC0 + 0.04], gold).castShadow = false;
  // Doğu Kule (x = 20.0, z: 1.65 .. 3.65) koridor geçiş kemeri / söveleri
  for (const zp of [ZC0 + 0.05, ZC1 - 0.05]) slabBox(g, [0.3, 2.85, 0.1], [20.0, 1.58, zp], dark);
  slabBox(g, [0.32, 0.1, ZC1 - ZC0 + 0.1], [20.0, 2.98, zMid], gold);

  // Doğu Asansör Holü zemini (x: 17.6 .. 19.7, z: -7.75 .. 1.65) — asansörlerden çıkanlar doğrudan koridora bağlanır
  slabBox(g, [2.1, 0.03, 9.4], [18.65, 0.165, -3.05], travertine).castShadow = false;
  slabBox(g, [0.7, 0.032, 8.6], [18.65, 0.168, -2.8], runner).castShadow = false;

  // Doğu Duvarı Asansör Kapıları (x = 19.65, z = -3.2 ve -1.6) + Çağrı Paneli
  for (const z of [-3.2, -1.6]) {
    slabBox(g, [0.1, 2.35, 1.4], [19.65, 1.35, z], dark);
    for (const s of [-1, 1]) slabBox(g, [0.04, 2.15, 0.62], [19.58, 1.25, z + s * 0.32], steel);
    slabBox(g, [0.05, 0.1, 0.5], [19.55, 2.58, z], gold).castShadow = false;
  }
  slabBox(g, [0.05, 0.28, 0.14], [19.57, 1.15, -2.4], dark);

  // Koridor–Oda Sınırı Cam Duvarı (z = 1.65, x: -19.5 .. 17.6): 3 odanın koridora açılan kapı boşlukları
  // Kapılar: Batı oda [-9.8, -8.2], Orta oda [-0.8, 0.8], Doğu oda [10.4, 12.0]
  const segments: [number, number][] = [[-19.5, -9.8], [-8.2, -6.0], [-6.0, -0.8], [0.8, 6.0], [6.0, 10.4], [12.0, 17.6]];
  for (const [ax, bx] of segments) {
    slabBox(g, [bx - ax, 2.75, 0.04], [(ax + bx) / 2, 1.55, ZC0], glass).castShadow = false;
    slabBox(g, [bx - ax, 0.05, 0.07], [(ax + bx) / 2, 2.95, ZC0], dark);
    slabBox(g, [bx - ax, 0.06, 0.06], [(ax + bx) / 2, 0.2, ZC0], dark);
  }
  // Kapı söveleri, üst lento ve kapı yanı oda tabelaları
  for (const [d0, d1] of [[-9.8, -8.2], [-0.8, 0.8], [10.4, 12.0]] as const) {
    slabBox(g, [0.08, 2.8, 0.08], [d0, 1.56, ZC0], dark);
    slabBox(g, [0.08, 2.8, 0.08], [d1, 1.56, ZC0], dark);
    slabBox(g, [d1 - d0 + 0.16, 0.08, 0.09], [(d0 + d1) / 2, 2.95, ZC0], gold);
    slabBox(g, [0.42, 0.16, 0.03], [d1 + 0.35, 1.65, ZC0 + 0.04], gold);
  }

  // Odalar Arası Yan Bölmeler (x = -6.0, x = 6.0 ve x = 17.6): YALNIZCA z: -7.75 .. 1.65 arasında (odadan odaya geçiş yok!)
  for (const xDiv of [-6.0, 6.0, 17.6]) {
    slabBox(g, [0.05, 2.75, 9.4], [xDiv, 1.55, -3.05], glass).castShadow = false;
    slabBox(g, [0.08, 0.05, 9.4], [xDiv, 2.95, -3.05], dark);
    for (const zp of [-7.75, -3.05, 1.65]) slabBox(g, [0.08, 2.8, 0.08], [xDiv, 1.56, zp], dark);
  }

  // Koridor boyunca dinlenme bankları, saksı bitkileri, su sebili ve tavan spotları
  const benchM = std('#7c3f23', 0.7, 0.05), pot = std('#5c4d3c', 0.75, 0.05), leaf = std('#3f6e43', 0.88, 0);
  for (const bx of [-13.8, -3.4, 3.4, 14.5]) {
    rounded(g, [1.6, 0.12, 0.48], [bx, 0.44, 3.22], benchM, 0, 0.04);
    for (const sx of [-0.65, 0.65]) slabBox(g, [0.05, 0.24, 0.42], [bx + sx, 0.28, 3.22], gold);
  }
  for (const px of [-18.6, -6.5, 5.5, 16.9, 18.8]) {
    cyl(g, 0.2, 0.38, [px, 0.35, 3.25], pot);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), leaf); f.position.set(px, 0.9, 3.25); f.scale.y = 1.3; g.add(f);
  }
  // Asansör holünde yönlendirme totemi + su sebili
  screen(g, 0.72, 1.2, 'directory', [18.65, 1.75, -6.9]);
  rounded(g, [0.34, 0.96, 0.34], [18.1, 0.64, 0.9], std('#dfe5e8', 0.4, 0.2), 0, 0.03);
  cyl(g, 0.11, 0.26, [18.1, 1.25, 0.9], std('#8ec3dd', 0.2, 0.1));

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [-16, -10, -4, 2, 8, 14, 18.6]) slabBox(g, [0.9, 0.03, 0.45], [x, 3.41, zMid], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 1. Kat — Genel Müdürlük (x: -19.5 .. -6.0, z: -7.75 .. 1.65): koridordan girilen ferah makam odası, VIP ağırlama köşesi ve özel kalem. */
function buildExecutiveSuite() {
  const g = new THREE.Group(); g.name = 'executive-suite';
  g.position.y = FLOOR_Y[1] - 0.15;
  const X0 = -19.5, X1 = -6.0, Z0 = -7.75, Z1 = 1.65, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const walnut = std('#5c3d28', 0.42, 0.08), parquet = std('#7a583b', 0.5, 0.06), dark = std('#15181f', 0.45, 0.45), gold = std('#c9a24a', 0.28, 0.82);
  const cream = std('#efeae0', 0.6, 0.05), leatherDark = std('#1e2229', 0.65, 0.08), leatherCognac = std('#7c3f23', 0.65, 0.06), burgundy = std('#5e1d24', 0.9, 0);
  const steel = std('#aab2ba', 0.3, 0.85), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const execChairMats = { seat: leatherDark, back: leatherDark, metal: gold };
  const guestChairMats = { seat: leatherCognac, back: leatherCognac, metal: gold };

  // Koyu ceviz makam parkesi
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], parquet).castShadow = false;

  // --- 1. Genel Müdür Makam Alanı (Batı-Kuzey, x = -15.6, z = -4.8) ---
  const gx = -15.6, gz = -4.75;
  slabBox(g, [5.2, 0.018, 3.6], [gx, 0.185, gz + 0.25], std('#2b3c4d', 0.92, 0)).castShadow = false;
  slabBox(g, [4.9, 0.02, 3.3], [gx, 0.188, gz + 0.25], burgundy).castShadow = false;

  // Arka duvar: Ceviz makam kütüphanesi / credenza + DOKUMA HOLDİNG makam panosu
  slabBox(g, [5.8, 2.65, 0.12], [gx, 1.5, Z0 + 0.12], walnut);
  const gmPlaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: screenTexture('gm_wall'), toneMapped: false }));
  gmPlaque.position.set(gx, 2.02, Z0 + 0.2); g.add(gmPlaque);
  rounded(g, [5.6, 0.68, 0.46], [gx, 0.52, Z0 + 0.38], dark, 0, 0.025);
  rounded(g, [5.66, 0.04, 0.5], [gx, 0.88, Z0 + 0.38], walnut, 0, 0.015);
  const bookCols = ['#8c2d2d', '#1f4e5f', '#c9a24a', '#2e5a44', '#d8d3c6', '#3b4252'];
  for (const side of [-1, 1]) {
    const bx = gx + side * 2.05;
    for (const sy of [1.32, 1.82, 2.32]) {
      slabBox(g, [1.35, 0.04, 0.32], [bx, sy, Z0 + 0.32], gold);
      for (let k = 0; k < 5; k++) {
        slabBox(g, [0.06, 0.24 + (k % 2) * 0.04, 0.22], [bx - 0.48 + k * 0.11, sy + 0.15, Z0 + 0.32], std(bookCols[(k + (side > 0 ? 2 : 0)) % bookCols.length], 0.7, 0.1));
      }
      cyl(g, 0.065, 0.16, [bx + 0.32, sy + 0.1, Z0 + 0.32], gold);
    }
  }
  // Türk Bayrağı (sol) ve Kurumsal Bayrak (sağ)
  for (const [fx, col] of [[gx - 3.15, '#c81d25'], [gx + 3.15, '#12354a']] as const) {
    cyl(g, 0.17, 0.05, [fx, 0.2, Z0 + 0.55], gold);
    cyl(g, 0.022, 2.25, [fx, 1.32, Z0 + 0.55], gold);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), gold); finial.position.set(fx, 2.48, Z0 + 0.55); g.add(finial);
    const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.92, 12), std(col, 0.75, 0.05));
    cloth.position.set(fx + 0.04, 1.82, Z0 + 0.55); cloth.rotation.z = -0.12; cloth.castShadow = true; g.add(cloth);
  }

  // L-Tipi Makam Masası + Çift Monitör + İsimlik + Oturan Genel Müdür
  rounded(g, [2.55, 0.07, 1.1], [gx, 0.79, gz], walnut, 0, 0.025);
  slabBox(g, [1.95, 0.015, 0.72], [gx, 0.83, gz], leatherDark);
  rounded(g, [2.4, 0.62, 0.08], [gx, 0.47, gz + 0.46], dark, 0, 0.02);
  slabBox(g, [2.2, 0.03, 0.09], [gx, 0.52, gz + 0.47], gold);
  for (const sx of [-1, 1]) rounded(g, [0.4, 0.62, 1.0], [gx + sx * 1.04, 0.47, gz], dark, 0, 0.02);
  rounded(g, [0.7, 0.66, 1.5], [gx - 1.45, 0.49, gz + 0.5], walnut, 0, 0.025);
  const deskMat = new THREE.MeshBasicMaterial({ map: screenTexture('exec_kpi'), toneMapped: false });
  computer(g, gx - 0.28, 0.83, gz + 0.08, Math.PI - 0.15, deskMat, black, keys);
  slabBox(g, [0.44, 0.09, 0.08], [gx + 0.35, 0.87, gz + 0.38], gold);                   // "GENEL MÜDÜR" isimliği
  rounded(g, [0.2, 0.05, 0.22], [gx - 0.88, 0.85, gz - 0.08], black, 0, 0.015);
  const gmChair = officeChair(g, gx, gz - 0.8, 0, execChairMats);
  rounded(gmChair, [0.48, 0.22, 0.07], [0, 1.22, -0.28], leatherDark, -0.08, 0.03);
  seatedWorker(gmChair, '#182436', '#2b2b2b');
  const guest1 = officeChair(g, gx - 0.65, gz + 1.08, Math.PI - 0.15, guestChairMats);
  seatedWorker(guest1, '#3b4d5e', '#4a3222');
  officeChair(g, gx + 0.65, gz + 1.08, Math.PI + 0.15, guestChairMats);

  // --- 2. VIP Makam Oturma Grubu (Batı-Güney, x = -15.6, z = -0.35 — koridor duvarından ferah mesafede) ---
  const vx = -15.6, vz = -0.35;
  slabBox(g, [4.6, 0.02, 2.5], [vx, 0.185, vz], std('#cfc6b4', 0.9, 0)).castShadow = false;
  slabBox(g, [4.2, 0.022, 2.1], [vx, 0.188, vz], std('#284654', 0.92, 0)).castShadow = false;
  const vipSofa = (x: number, z: number, rotY: number, w: number, mat: THREE.Material) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rotY; g.add(s);
    rounded(s, [w, 0.22, 0.82], [0, 0.31, 0], mat, 0, 0.06);
    rounded(s, [w - 0.12, 0.18, 0.68], [0, 0.48, 0.03], mat, 0, 0.07);
    rounded(s, [w, 0.54, 0.2], [0, 0.72, -0.32], mat, -0.1, 0.07);
    for (const sx of [-1, 1]) rounded(s, [0.16, 0.46, 0.82], [sx * (w / 2 - 0.02), 0.5, 0], mat, 0, 0.06);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(s, 0.026, 0.14, [sx * (w / 2 - 0.14), 0.1, sz * 0.32], gold);
  };
  vipSofa(vx, vz + 0.95, Math.PI, 2.15, leatherCognac);
  vipSofa(vx - 1.75, vz - 0.05, Math.PI / 2, 0.92, leatherDark);
  vipSofa(vx + 1.75, vz - 0.05, -Math.PI / 2, 0.92, leatherDark);
  rounded(g, [1.25, 0.05, 0.7], [vx, 0.44, vz - 0.05], cream, 0, 0.02);
  slabBox(g, [1.29, 0.025, 0.74], [vx, 0.43, vz - 0.05], gold);
  rounded(g, [0.42, 0.02, 0.28], [vx - 0.15, 0.475, vz - 0.05], steel, 0, 0.01);
  cyl(g, 0.038, 0.07, [vx - 0.24, 0.51, vz - 0.08], cream); cyl(g, 0.038, 0.07, [vx - 0.06, 0.51, vz + 0.02], cream);

  // --- 3. Yönetim Strateji Masası & Özel Kalem Giriş Karşılama (Doğu Bölümü, x = -9.0) ---
  // Koridor kapısından (x = -9.0, z = 1.65) girince sağda Özel Kalem, karşıda Strateji Masası
  const mx = -9.0, mz = -4.6;
  screen(g, 2.25, 1.28, 'exec_kpi', [mx, 2.02, Z0 + 0.12]);
  rounded(g, [1.95, 0.065, 2.5], [mx, 0.78, mz], walnut, 0, 0.04);
  slabBox(g, [1.25, 0.015, 1.8], [mx, 0.818, mz], leatherDark);
  for (const sz of [-0.75, 0.75]) cyl(g, 0.2, 0.6, [mx, 0.46, mz + sz], dark);
  const stratScreen = new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false });
  for (const side of [-1, 1]) {
    [-0.65, 0.65].forEach((dz, i) => {
      const ch = officeChair(g, mx + side * 1.35, mz + dz, side < 0 ? Math.PI / 2 : -Math.PI / 2, guestChairMats);
      if (side < 0 && i === 0) {
        seatedWorker(ch, '#2c4a3e', '#221a15', false);
        computer(g, mx + side * 0.55, 0.82, mz + dz, -Math.PI / 2, stratScreen, black, keys);
      } else {
        slabBox(g, [0.26, 0.018, 0.2], [mx + side * 0.58, 0.825, mz + dz], cream);
      }
    });
  }

  // Özel Kalem / Sekreterya (x = -7.55, z = -0.35 — koridor kapısının hemen yanında, geçişi kapatmaz)
  const sx = -7.55, sz = -0.35;
  rounded(g, [1.75, 0.74, 0.76], [sx, 0.53, sz], walnut, 0, 0.025);
  rounded(g, [1.82, 0.05, 0.82], [sx, 0.92, sz], cream, 0, 0.02);
  computer(g, sx - 0.15, 0.91, sz, Math.PI, stratScreen, black, keys);
  rounded(g, [0.18, 0.045, 0.2], [sx + 0.48, 0.92, sz], black, 0, 0.015);
  const secChair = officeChair(g, sx - 0.15, sz - 0.72, 0, execChairMats);
  seatedWorker(secChair, '#d8cfc2', '#4a2c18', true);

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [-17.0, -13.0, -8.8]) for (const z of [-5.5, -1.6]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 1. Kat — Toplantı Salonu (x: -6.0 .. 6.0, z: -7.75 .. 1.65): yalnızca ön koridordan girilen ferah yönetim kurulu salonu. */
function buildMeetingRoom() {
  const g = new THREE.Group(); g.name = 'meeting-room';
  g.position.y = FLOOR_Y[1] - 0.15;
  const X0 = -6.0, X1 = 6.0, Z0 = -7.75, Z1 = 1.65, cx = 0, cz = (Z0 + Z1) / 2;
  const oak = std('#846548', 0.48, 0.06), walnut = std('#5c3d28', 0.42, 0.08), dark = std('#15181f', 0.45, 0.45), gold = std('#c9a24a', 0.28, 0.82);
  const cream = std('#efeae0', 0.6, 0.05), navyRug = std('#1e3246', 0.92, 0), leather = std('#232832', 0.68, 0.08), cognac = std('#824628', 0.68, 0.06);
  const steel = std('#aab2ba', 0.3, 0.85), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);

  // Zemin parkesi + yönetim kurulu akustik halısı
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], oak).castShadow = false;
  slabBox(g, [8.2, 0.018, 4.8], [cx, 0.185, -2.55], std('#c9bfa8', 0.9, 0)).castShadow = false;
  slabBox(g, [7.7, 0.02, 4.3], [cx, 0.188, -2.55], navyRug).castShadow = false;

  // Kuzey Sunum Duvarı: ahşap akustik çıtalar + 4K Video Konferans Ekranı + Kamera/Soundbar
  for (let x = -4.6; x <= 4.6; x += 0.25) slabBox(g, [0.1, 2.85, 0.06], [x, 1.6, Z0 + 0.06], walnut);
  screen(g, 3.6, 1.95, 'board_pres', [0, 1.88, Z0 + 0.14]);
  rounded(g, [1.4, 0.09, 0.09], [0, 0.78, Z0 + 0.16], dark, 0, 0.02);
  rounded(g, [0.36, 0.07, 0.09], [0, 2.94, Z0 + 0.16], dark, 0, 0.02);

  // Sunum Kürsüsü (sol ön, x = -3.1, z = -6.0) + Yanlarda 2 Ayaklı Flipchart / Beyaz Tahta
  rounded(g, [0.66, 1.08, 0.5], [-3.1, 0.72, -6.0], walnut, 0, 0.025);
  rounded(g, [0.74, 0.05, 0.56], [-3.1, 1.28, -5.97], dark, 0.22, 0.015);
  slabBox(g, [0.48, 0.18, 0.02], [-3.1, 1.05, -5.73], gold);
  for (const side of [-1, 1]) {
    const fx = side * 4.55, fz = -6.0, rot = -side * 0.35;
    const wb = new THREE.Group(); wb.position.set(fx, 0, fz); wb.rotation.y = rot; g.add(wb);
    for (const lx of [-0.38, 0.38]) { slabBox(wb, [0.04, 1.75, 0.04], [lx, 1.02, 0], dark); slabBox(wb, [0.04, 0.04, 0.55], [lx, 0.19, 0], dark); }
    rounded(wb, [0.92, 1.15, 0.04], [0, 1.45, 0], cream, -0.08, 0.015);
    slabBox(wb, [0.72, 0.03, 0.05], [0, 0.9, 0.06], steel);
    slabBox(wb, [0.55, 0.025, 0.01], [-0.05, 1.65, 0.03], std('#2563eb', 0.5, 0));
    slabBox(wb, [0.45, 0.025, 0.01], [0.02, 1.45, 0.03], std('#16a34a', 0.5, 0));
    slabBox(wb, [0.5, 0.025, 0.01], [-0.02, 1.25, 0.03], std('#dc2626', 0.5, 0));
  }

  // Büyük Yönetim Kurulu Toplantı Masası (x = 0, z = -2.55, 5.8 m × 1.95 m — dört yanında geniş geçiş koridoru)
  const tz = -2.55, tw = 5.8, td = 1.95;
  rounded(g, [tw, 0.075, td], [0, 0.78, tz], walnut, 0, 0.035);
  slabBox(g, [tw - 0.9, 0.016, 0.65], [0, 0.822, tz], leather);
  for (const kx of [-1.6, 0, 1.6]) slabBox(g, [0.4, 0.02, 0.16], [kx, 0.828, tz], steel);
  for (const px of [-1.9, 0, 1.9]) {
    cyl(g, 0.26, 0.6, [px, 0.47, tz], dark);
    slabBox(g, [0.65, 0.04, 1.25], [px, 0.19, tz], dark);
  }

  // 12 Toplantı Koltuğu + Bilgisayarlar + Bloknotlar + Oturan Yönetim Kurulu Üyeleri
  const chairMats = { seat: cognac, back: leather, metal: gold };
  const headMats = { seat: leather, back: leather, metal: gold };
  const presScreen = new THREE.MeshBasicMaterial({ map: screenTexture('board_pres'), toneMapped: false });
  const deskScreen = new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false });
  const shirts = ['#1e3a5f', '#6b2d38', '#2d5a4c', '#d8cfc2', '#3a4b5c', '#5b4636'];
  const hairs = ['#1c1c1c', '#4a2e1b', '#6e5239', '#2b1d14', '#523624', '#161616'];
  const seatXs = [-2.0, -1.0, 0.0, 1.0, 2.0];
  let wi = 0;
  for (const side of [1, -1]) {
    seatXs.forEach((dx, i) => {
      const chairZ = tz + side * 1.32, rotY = side > 0 ? Math.PI : 0;
      const ch = officeChair(g, dx, chairZ, rotY, chairMats);
      const occupied = (side > 0 && (i === 0 || i === 2 || i === 4)) || (side < 0 && (i === 1 || i === 3));
      if (occupied) {
        seatedWorker(ch, shirts[wi % shirts.length], hairs[wi % hairs.length], wi % 2 === 1);
        if (i % 2 === 0) computer(g, dx, 0.82, tz + side * 0.38, side > 0 ? 0 : Math.PI, i === 2 ? presScreen : deskScreen, black, keys);
        else slabBox(g, [0.28, 0.018, 0.21], [dx, 0.825, tz + side * 0.52], cream);
        wi++;
      } else {
        slabBox(g, [0.26, 0.015, 0.2], [dx, 0.825, tz + side * 0.52], cream);
      }
      cyl(g, 0.032, 0.085, [dx + 0.22, 0.86, tz + side * 0.44], std('#bfe3f7', 0.2, 0.1));
    });
  }
  const westHead = officeChair(g, -tw / 2 - 0.58, tz, Math.PI / 2, headMats);
  seatedWorker(westHead, '#16202e', '#2a2a2a');
  computer(g, -tw / 2 + 0.45, 0.82, tz, -Math.PI / 2, presScreen, black, keys);
  const eastHead = officeChair(g, tw / 2 + 0.58, tz, -Math.PI / 2, headMats);
  seatedWorker(eastHead, '#3b2838', '#3d2314', true);

  // Batı yan duvar boyunca (x = -5.45, z = -2.55) ince Toplantı İkram & Kahve Büfesi (kapı önünü kapatmaz)
  rounded(g, [0.58, 0.78, 2.4], [-5.45, 0.56, -2.55], walnut, 0, 0.025);
  rounded(g, [0.64, 0.045, 2.48], [-5.45, 0.97, -2.55], cream, 0, 0.015);
  for (const dz of [-0.75, -0.3]) {
    cyl(g, 0.12, 0.34, [-5.45, 1.16, -2.55 + dz], steel);
    cyl(g, 0.13, 0.04, [-5.45, 1.34, -2.55 + dz], dark);
  }
  rounded(g, [0.34, 0.02, 0.58], [-5.45, 1.0, -2.1], gold, 0, 0.01);
  for (let k = 0; k < 4; k++) cyl(g, 0.036, 0.07, [-5.45, 1.045, -2.3 + k * 0.12], cream);

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [-3.6, 0, 3.6]) for (const z of [-5.5, -1.6]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 1. Kat — İnsan Kaynakları (x: 6.0 .. 17.6, z: -7.75 .. 1.65): koridordan girilen ferah personel & bordro ofisi, mülakat köşesi ve İSG eğitim alanı. */
function buildHumanResources() {
  const g = new THREE.Group(); g.name = 'human-resources';
  g.position.y = FLOOR_Y[1] - 0.15;
  const X0 = 6.0, X1 = 17.6, Z0 = -7.75, Z1 = 1.65, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floorM = std('#9c8468', 0.52, 0.05), oak = std('#8c6b4a', 0.48, 0.05), dark = std('#181c24', 0.48, 0.4), cream = std('#efeae0', 0.6, 0.05);
  const teal = std('#1f6f78', 0.78, 0.05), terra = std('#b8563a', 0.8, 0), steel = std('#aab2ba', 0.3, 0.85);
  const black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: std('#27323f', 0.82, 0.05), back: std('#1c242e', 0.88, 0.05), metal: steel };
  const guestMats = { seat: teal, back: teal, metal: steel };

  // Zemin kaplaması (yalnızca İK odası sınırları içinde, asansör holü ve koridor hariç)
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], floorM).castShadow = false;

  // --- 1. Personel & Bordro 4'lü Çalışma Adası + Özlük Arşivi (Batı-Kuzey, x = 9.2, z = -4.3) ---
  const wx = 9.2, wz = -4.3;
  screen(g, 2.2, 1.25, 'hr_board', [wx, 2.0, Z0 + 0.12]);
  const folderCols = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  for (const side of [-1, 1]) {
    const cxCab = wx + side * 2.05;
    rounded(g, [1.45, 2.1, 0.42], [cxCab, 1.22, Z0 + 0.34], oak, 0, 0.02);
    for (const sy of [0.65, 1.15, 1.65, 2.02]) {
      slabBox(g, [1.35, 0.035, 0.38], [cxCab, sy, Z0 + 0.36], dark);
      for (let k = 0; k < 7; k++) {
        slabBox(g, [0.065, 0.3, 0.26], [cxCab - 0.54 + k * 0.17, sy + 0.17, Z0 + 0.36], std(folderCols[(k + (side > 0 ? 2 : 0)) % folderCols.length], 0.65, 0));
      }
    }
  }

  rounded(g, [3.1, 0.055, 1.55], [wx, 0.76, wz], cream, 0, 0.02);
  rounded(g, [3.02, 0.36, 0.045], [wx, 0.97, wz], teal, 0, 0.015);
  rounded(g, [0.045, 0.36, 1.45], [wx, 0.97, wz], teal, 0, 0.015);
  for (const sx of [-1.4, 0, 1.4]) for (const sz of [-0.65, 0.65]) slabBox(g, [0.05, 0.58, 0.05], [wx + sx, 0.46, wz + sz], dark);
  const deskScreen = new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false });
  const hrWorkers: [number, number, boolean, string, string][] = [
    [-0.78, 1, true, '#c2553a', '#3b2214'],
    [0.78, 1, false, '#2b5876', '#1c1c1c'],
    [-0.78, -1, true, '#3a7a68', '#5c3c24'],
    [0.78, -1, false, '#525c6e', '#2e231a'],
  ];
  hrWorkers.forEach(([dx, side, female, sh, hr], idx) => {
    const x = wx + dx, chairZ = wz + side * 1.12, rotY = side > 0 ? Math.PI : 0;
    computer(g, x, 0.79, wz + side * 0.24, side > 0 ? 0 : Math.PI, deskScreen, black, keys);
    rounded(g, [0.15, 0.04, 0.17], [x + 0.4, 0.8, wz + side * 0.24], black, 0, 0.01);
    const ch = officeChair(g, x, chairZ, rotY, chairMats);
    if (idx < 3) seatedWorker(ch, sh, hr, female);
  });

  // --- 2. Mülakat & İş Görüşmesi Köşesi (Batı-Güney, x = 8.2, z = -0.35 — koridor kapısının solunda ferah alan) ---
  const ix = 8.2, iz = -0.35;
  cyl(g, 1.35, 0.02, [ix, 0.185, iz], std('#2f5560', 0.92, 0)).castShadow = false;
  cyl(g, 0.72, 0.05, [ix, 0.76, iz], oak);
  cyl(g, 0.07, 0.56, [ix, 0.47, iz], dark); cyl(g, 0.38, 0.03, [ix, 0.19, iz], dark);
  computer(g, ix - 0.22, 0.785, iz, Math.PI / 2, deskScreen, black, keys);
  slabBox(g, [0.22, 0.02, 0.28], [ix + 0.22, 0.795, iz + 0.08], std('#eab308', 0.7, 0));
  const interviewer = officeChair(g, ix - 1.02, iz, Math.PI / 2, guestMats);
  seatedWorker(interviewer, '#1f4e5f', '#3b2416', true);
  const candidate = officeChair(g, ix + 1.02, iz, -Math.PI / 2, { seat: terra, back: terra, metal: steel });
  seatedWorker(candidate, '#e8e4da', '#221c18', false);

  // --- 3. İSG & Oryantasyon Eğitim Alanı (Doğu Bölümü, x = 14.8, z: -7.5 .. 0.8) ---
  const tx = 14.8;
  screen(g, 2.25, 1.28, 'hr_board', [tx, 2.0, Z0 + 0.12]);
  rounded(g, [0.95, 0.74, 0.52], [13.2, 0.53, -6.1], oak, 0, 0.02);
  computer(g, 13.2, 0.91, -6.1, 0, deskScreen, black, keys);
  const trainScreen = new THREE.MeshBasicMaterial({ map: screenTexture('hr_board'), toneMapped: false });
  [-4.3, -2.0].forEach((rz, ri) => {
    [-1.05, 1.05].forEach((dx, ci) => {
      const gxDesk = tx + dx;
      rounded(g, [1.65, 0.045, 0.62], [gxDesk, 0.75, rz], cream, 0, 0.015);
      for (const lx of [-0.72, 0.72]) slabBox(g, [0.045, 0.56, 0.52], [gxDesk + lx, 0.46, rz], dark);
      for (const s of [-0.42, 0.42]) {
        const ch = officeChair(g, gxDesk + s, rz + 0.68, Math.PI, chairMats);
        slabBox(g, [0.24, 0.015, 0.18], [gxDesk + s, 0.785, rz + 0.04], std('#f8fafc', 0.8, 0));
        if ((ri === 0 && (ci === 0 || s < 0)) || (ri === 1 && ci === 1 && s > 0)) {
          seatedWorker(ch, ['#2f6f8f', '#d9a441', '#4f8a5b', '#8a527a'][(ri * 2 + ci + (s > 0 ? 1 : 0)) % 4], '#2b1e16', s > 0);
          if (ri === 0 && ci === 0 && s < 0) computer(g, gxDesk + s, 0.78, rz - 0.04, 0, trainScreen, black, keys);
        }
      }
    });
  });

  // Fotokopi / Yazıcı İstasyonu (doğu iç duvar önü, x = 15.6, z = 0.65)
  rounded(g, [2.0, 0.74, 0.54], [15.6, 0.53, 0.65], oak, 0, 0.02);
  rounded(g, [0.65, 0.4, 0.44], [15.1, 1.1, 0.65], cream, 0, 0.02);
  slabBox(g, [0.6, 0.05, 0.4], [15.1, 1.32, 0.65], dark);

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [8.2, 11.8, 15.4]) for (const z of [-5.5, -1.6]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 2. Kat — Üretim Planlama (x: -19.5 .. -6.0, z: -7.75 .. 1.65): Gantt & MRP merkezi, CAD kalıp plotter ve pafta inceleme masası. */
function buildProductionPlanning() {
  const g = new THREE.Group(); g.name = 'production-planning';
  g.position.y = FLOOR_Y[2] - 0.15;
  const X0 = -19.5, X1 = -6.0, Z0 = -7.75, Z1 = 1.65, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floorM = std('#8c7a65', 0.5, 0.06), oak = std('#846548', 0.48, 0.05), dark = std('#161b22', 0.45, 0.4), cream = std('#efeae0', 0.58, 0.05);
  const navy = std('#1e3a5f', 0.78, 0.05), steel = std('#aab2ba', 0.3, 0.85), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: std('#223042', 0.8, 0.05), back: std('#182230', 0.85, 0.05), metal: steel };
  const planScreen = new THREE.MeshBasicMaterial({ map: screenTexture('plan_board'), toneMapped: false });
  const deskScreen = new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false });

  // Zemin kaplaması
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], floorM).castShadow = false;

  // --- 1. Kuzey Duvarı: Dev Gantt & Kapasite Ekranı + KanBan Vardiya Panosu + 6'lı MRP Çalışma Adası (x = -15.6, z = -4.3) ---
  const px = -15.6, pz = -4.3;
  screen(g, 3.1, 1.55, 'plan_board', [px - 0.6, 2.02, Z0 + 0.12]);
  // Fiziksel KanBan / İş Emri Panosu (sağda, renkli iş emri kartlarıyla)
  rounded(g, [2.1, 1.35, 0.05], [px + 2.35, 1.98, Z0 + 0.1], cream, 0, 0.015);
  slabBox(g, [2.16, 1.41, 0.03], [px + 2.35, 1.98, Z0 + 0.08], dark);
  const cardCols = ['#38bdf8', '#22c55e', '#f59e0b', '#f43f5e', '#a78bfa'];
  for (let col = 0; col < 4; col++) {
    const kx = px + 1.55 + col * 0.52;
    slabBox(g, [0.015, 1.25, 0.02], [kx - 0.24, 1.98, Z0 + 0.12], dark);
    for (let row = 0; row < 4; row++) {
      slabBox(g, [0.38, 0.18, 0.015], [kx, 2.42 - row * 0.28, Z0 + 0.13], std(cardCols[(col + row) % cardCols.length], 0.6, 0));
    }
  }

  // 6 Kişilik MRP & Sipariş Planlama Masası
  rounded(g, [4.2, 0.055, 1.58], [px, 0.76, pz], cream, 0, 0.02);
  rounded(g, [4.1, 0.36, 0.045], [px, 0.97, pz], navy, 0, 0.015);
  for (const dx of [-0.7, 0.7]) rounded(g, [0.045, 0.36, 1.48], [px + dx, 0.97, pz], navy, 0, 0.015);
  for (const sx of [-1.95, 0, 1.95]) for (const sz of [-0.68, 0.68]) slabBox(g, [0.055, 0.58, 0.055], [px + sx, 0.46, pz + sz], dark);

  const planners: [number, number, boolean, string, string][] = [
    [-1.35, 1, false, '#1e3a5f', '#1c1c1c'],
    [0.0, 1, true, '#b8563a', '#3b2314'],
    [1.35, 1, false, '#2d5a4c', '#2b1e16'],
    [-1.35, -1, true, '#3a6b7c', '#4a2e1b'],
    [0.0, -1, false, '#4a5568', '#161616'],
    [1.35, -1, true, '#7c3f58', '#523624'],
  ];
  planners.forEach(([dx, side, female, sh, hr], i) => {
    const x = px + dx, chairZ = pz + side * 1.14, rotY = side > 0 ? Math.PI : 0;
    computer(g, x, 0.79, pz + side * 0.24, side > 0 ? 0 : Math.PI, i % 2 === 0 ? planScreen : deskScreen, black, keys);
    rounded(g, [0.15, 0.04, 0.17], [x + 0.38, 0.8, pz + side * 0.24], black, 0, 0.01);
    const ch = officeChair(g, x, chairZ, rotY, chairMats);
    if (i !== 4) seatedWorker(ch, sh, hr, female);
  });

  // --- 2. CAD Kalıp Plotter Çizici & Geniş Pafta / Pastal İnceleme Masası (Batı-Güney, x = -15.6, z = -0.3) ---
  // Endüstriyel Geniş Format Kalıp Plotter (x = -18.1, z = -0.35, doğuya bakar)
  const plx = -18.1, plz = -0.35;
  for (const sz of [-0.75, 0.75]) {
    slabBox(g, [0.07, 0.82, 0.07], [plx, 0.56, plz + sz], dark);
    slabBox(g, [0.55, 0.05, 0.08], [plx, 0.19, plz + sz], dark);
  }
  rounded(g, [0.46, 0.28, 1.85], [plx, 1.05, plz], dark, 0, 0.03);
  rounded(g, [0.36, 0.09, 1.72], [plx + 0.04, 1.22, plz], std('#2563eb', 0.4, 0.2), 0, 0.02);
  // Beyaz rulo kağıt ve aşağı sarkan çizilmiş kalıp paftası
  const roll = cyl(g, 0.09, 1.6, [plx - 0.14, 0.88, plz], std('#f8fafc', 0.8, 0));
  roll.rotation.x = Math.PI / 2;
  slabBox(g, [0.02, 0.55, 1.52], [plx + 0.22, 0.78, plz], std('#f8fafc', 0.85, 0));
  for (const dz of [-0.45, 0.0, 0.45]) slabBox(g, [0.025, 0.32, 0.28], [plx + 0.23, 0.78, plz + dz], std('#38bdf8', 0.6, 0));

  // Geniş Pafta & Numune Kumaş İnceleme Masası (x = -14.8, z = -0.35)
  const tx = -14.8, tz = -0.35;
  rounded(g, [2.7, 0.07, 1.25], [tx, 0.86, tz], oak, 0, 0.02);
  for (const sx of [-1.15, 1.15]) for (const sz of [-0.5, 0.5]) slabBox(g, [0.07, 0.68, 0.07], [tx + sx, 0.5, tz + sz], dark);
  slabBox(g, [2.3, 0.03, 0.9], [tx, 0.52, tz], oak); // alt raf
  // Masa üstünde açık pastal paftası, kumaş kartelaları ve T-cetveli
  slabBox(g, [1.85, 0.012, 0.88], [tx - 0.15, 0.902, tz], std('#f8fafc', 0.85, 0));
  for (const [dx, dz, w, d, col] of [[-0.65, -0.18, 0.48, 0.32, '#2563eb'], [-0.08, 0.12, 0.52, 0.34, '#16a34a'], [0.42, -0.15, 0.38, 0.28, '#f59e0b']] as const) {
    slabBox(g, [w, 0.015, d], [tx + dx, 0.912, tz + dz], std(col, 0.7, 0));
  }
  slabBox(g, [0.95, 0.015, 0.05], [tx - 0.1, 0.918, tz + 0.32], steel); // çelik cetvel
  for (let k = 0; k < 4; k++) {
    const r = cyl(g, 0.055, 0.42, [tx + 0.98, 0.95, tz - 0.32 + k * 0.2], std(cardCols[k], 0.75, 0));
    r.rotation.z = Math.PI / 2;
  }

  // --- 3. Doğu Bölümü: Kumaş/İplik Kartela Arşivi & Vardiya Koordinasyon Masası (x = -9.1, z = -4.2) ---
  const mx = -9.1, mz = -4.2;
  for (const side of [-1, 1]) {
    const rx = mx + side * 1.65;
    rounded(g, [1.45, 2.15, 0.42], [rx, 1.24, Z0 + 0.34], oak, 0, 0.02);
    for (const sy of [0.65, 1.15, 1.65, 2.05]) {
      slabBox(g, [1.35, 0.035, 0.38], [rx, sy, Z0 + 0.36], dark);
      for (let k = 0; k < 5; k++) {
        const bolt = cyl(g, 0.055, 0.3, [rx - 0.48 + k * 0.24, sy + 0.12, Z0 + 0.36], std(cardCols[(k + (side > 0 ? 2 : 0)) % cardCols.length], 0.7, 0));
        bolt.rotation.x = Math.PI / 2;
      }
    }
  }
  // Koordinasyon Masası + 4 Koltuk + 2 Oturan Planlama Uzmanı
  cyl(g, 1.55, 0.02, [mx, 0.185, mz], std('#24384d', 0.9, 0)).castShadow = false;
  cyl(g, 0.95, 0.055, [mx, 0.77, mz], oak);
  cyl(g, 0.14, 0.56, [mx, 0.47, mz], dark); cyl(g, 0.48, 0.035, [mx, 0.19, mz], dark);
  computer(g, mx - 0.25, 0.8, mz - 0.1, Math.PI / 4, planScreen, black, keys);
  slabBox(g, [0.32, 0.018, 0.24], [mx + 0.28, 0.805, mz + 0.15], cream);
  for (let k = 0; k < 4; k++) {
    const ang = k * Math.PI / 2 + Math.PI / 4;
    const ch = officeChair(g, mx + Math.sin(ang) * 1.28, mz + Math.cos(ang) * 1.28, ang + Math.PI, chairMats);
    if (k === 0 || k === 2) seatedWorker(ch, k === 0 ? '#1f4e5f' : '#d9a441', '#261c15', k === 2);
  }

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [-17.0, -13.0, -8.8]) for (const z of [-5.5, -1.6]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 2. Kat — Kalite & Laboratuvar (x: -6.0 .. 6.0, z: -7.75 .. 1.65): D65 renk kabini, mukavemet ve aşınma cihazları, çeker ocak ve mikroskopi adası. */
function buildQualityLab() {
  const g = new THREE.Group(); g.name = 'quality-lab';
  g.position.y = FLOOR_Y[2] - 0.15;
  const X0 = -6.0, X1 = 6.0, Z0 = -7.75, Z1 = 1.65, cx = 0, cz = (Z0 + Z1) / 2;
  const epoxy = std('#cfd6dc', 0.35, 0.08), benchTop = std('#1e2630', 0.4, 0.25), cabWhite = std('#eef2f6', 0.45, 0.1);
  const dark = std('#151921', 0.45, 0.4), steel = std('#b4bcc4', 0.25, 0.88), cyan = std('#0ea5e9', 0.5, 0.15);
  const black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const labGlass = new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false });
  const chairMats = { seat: std('#0f766e', 0.7, 0.05), back: std('#115e59', 0.75, 0.05), metal: steel };
  const labScreen = new THREE.MeshBasicMaterial({ map: screenTexture('lab_board'), toneMapped: false });

  // Hijyenik açık gri epoksi laboratuvar zemini + güvenlik şeritleri
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], epoxy).castShadow = false;
  for (const bx of [-3.1, 3.1]) slabBox(g, [3.9, 0.032, 2.0], [bx, 0.168, -2.5], std('#b8c4ce', 0.4, 0.1)).castShadow = false;

  // --- 1. Kuzey Duvarı: Kalite Ekranı + D65 Gün Işığı Renk Eşleştirme Kabini (Sol) + Çeker Ocak & Yıkama Haslığı (Sağ) ---
  screen(g, 2.75, 1.45, 'lab_board', [0, 2.02, Z0 + 0.12]);

  // Sol Kuzey (x = -3.7, z = -6.95): D65 Renk Kontrol Kabini (SpectraLight Booth) + Spektrofotometre Tezgâhı
  const lx = -3.7, lz = -6.95;
  rounded(g, [3.2, 0.82, 0.78], [lx, 0.57, lz], cabWhite, 0, 0.02);
  rounded(g, [3.28, 0.05, 0.84], [lx, 1.0, lz], benchTop, 0, 0.015);
  // Işık kabini gövdesi (D65 standart gün ışığı)
  slabBox(g, [1.45, 0.95, 0.68], [lx - 0.65, 1.5, lz - 0.02], std('#64748b', 0.5, 0.2));
  slabBox(g, [1.35, 0.82, 0.62], [lx - 0.65, 1.48, lz + 0.04], std('#94a3b8', 0.6, 0.1));
  const d65 = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e0f2fe', emissiveIntensity: 2.2 });
  slabBox(g, [1.2, 0.04, 0.45], [lx - 0.65, 1.86, lz + 0.02], d65).castShadow = false;
  // Kabin içinde eğimli numune tablası ve renkli kumaş svatchları
  rounded(g, [1.15, 0.03, 0.48], [lx - 0.65, 1.12, lz + 0.04], std('#cbd5e1', 0.6, 0.1), 0.18, 0.01);
  for (const [dx, col] of [[-0.98, '#ef4444'], [-0.65, '#3b82f6'], [-0.32, '#10b981']] as const) {
    slabBox(g, [0.24, 0.02, 0.3], [lx + dx, 1.16, lz + 0.06], std(col, 0.7, 0));
  }
  // Sağında Masaüstü Spektrofotometre + Bilgisayar
  rounded(g, [0.46, 0.34, 0.42], [lx + 0.48, 1.19, lz], cabWhite, 0, 0.025);
  cyl(g, 0.09, 0.12, [lx + 0.48, 1.38, lz + 0.08], dark);
  computer(g, lx + 1.15, 1.02, lz + 0.05, 0, labScreen, black, keys);

  // Sağ Kuzey (x = 3.7, z = -6.95): Çeker Ocak (Fume Hood) & Yıkama Haslığı / Evye Tezgâhı
  const rx = 3.7, rz = -6.95;
  rounded(g, [3.2, 0.82, 0.78], [rx, 0.57, rz], cabWhite, 0, 0.02);
  rounded(g, [3.28, 0.05, 0.84], [rx, 1.0, rz], benchTop, 0, 0.015);
  // Çeker Ocak Kabini + Havalandırma Bacası + Cam Sürgü
  slabBox(g, [1.55, 1.45, 0.76], [rx + 0.72, 1.75, rz - 0.02], cabWhite);
  slabBox(g, [1.42, 1.15, 0.66], [rx + 0.72, 1.65, rz + 0.04], std('#334155', 0.6, 0.1));
  slabBox(g, [1.38, 0.78, 0.03], [rx + 0.72, 1.78, rz + 0.36], labGlass).castShadow = false;
  cyl(g, 0.18, 0.95, [rx + 0.72, 2.92, rz - 0.05], steel);
  // Çeker ocak içinde renkli reaktif şişeleri / erlenmayerler
  for (const [dx, col] of [[0.35, '#06b6d4'], [0.65, '#f59e0b'], [0.95, '#10b981'], [1.15, '#ec4899']] as const) {
    cyl(g, 0.055, 0.2, [rx + dx, 1.14, rz + 0.05], std(col, 0.25, 0.1));
    cyl(g, 0.025, 0.08, [rx + dx, 1.26, rz + 0.05], cabWhite);
  }
  // Solunda Paslanmaz Laboratuvar Evyesi + Kuğu Musluk + Yıkama Haslığı Test Cihazı (Gyrowash)
  slabBox(g, [0.58, 0.03, 0.46], [rx - 0.95, 1.03, rz], steel);
  cyl(g, 0.02, 0.28, [rx - 0.95, 1.17, rz - 0.22], steel);
  rounded(g, [0.58, 0.36, 0.48], [rx - 0.22, 1.2, rz], steel, 0, 0.02);
  slabBox(g, [0.42, 0.08, 0.03], [rx - 0.22, 1.24, rz + 0.25], cyan);

  // --- 2. Batı Ada Tezgâhı (x = -3.1, z = -2.5): Kopma Mukavemeti (Tensile Tester) & Martindale Aşınma Testi ---
  const b1x = -3.1, b1z = -2.5;
  rounded(g, [3.3, 0.82, 1.35], [b1x, 0.57, b1z], cabWhite, 0, 0.02);
  rounded(g, [3.42, 0.06, 1.45], [b1x, 1.0, b1z], benchTop, 0, 0.015);
  // Universal Çekme / Kopma Mukavemet Test Cihazı (x = b1x - 1.05)
  const txm = b1x - 1.05;
  rounded(g, [0.62, 0.18, 0.52], [txm, 1.12, b1z], cabWhite, 0, 0.02);
  for (const sx of [-0.22, 0.22]) cyl(g, 0.03, 1.15, [txm + sx, 1.76, b1z], steel);
  rounded(g, [0.58, 0.12, 0.22], [txm, 2.32, b1z], dark, 0, 0.02); // üst köprü
  rounded(g, [0.54, 0.1, 0.2], [txm, 1.78, b1z], cyan, 0, 0.015);  // hareketli çekme çenesi
  slabBox(g, [0.12, 0.52, 0.015], [txm, 1.48, b1z], std('#dc2626', 0.7, 0)); // gerilen kumaş numunesi
  // Martindale 4-Başlıklı Aşınma & Boncuklanma Cihazı (x = b1x - 0.1)
  rounded(g, [0.78, 0.22, 0.62], [b1x - 0.1, 1.14, b1z], cabWhite, 0, 0.02);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.15, 0.15]) {
    cyl(g, 0.11, 0.06, [b1x - 0.1 + sx, 1.28, b1z + sz], steel);
    cyl(g, 0.05, 0.09, [b1x - 0.1 + sx, 1.34, b1z + sz], dark);
  }
  // Hassas Analitik Terazi (cam fanuslu, x = b1x + 0.65) + Bilgisayar (x = b1x + 1.2)
  rounded(g, [0.34, 0.08, 0.36], [b1x + 0.62, 1.07, b1z - 0.15], dark, 0, 0.015);
  slabBox(g, [0.3, 0.28, 0.3], [b1x + 0.62, 1.25, b1z - 0.15], labGlass).castShadow = false;
  computer(g, b1x + 1.15, 1.03, b1z + 0.18, Math.PI, labScreen, black, keys);
  const labTech1 = officeChair(g, b1x + 1.15, b1z + 1.08, Math.PI, chairMats);
  seatedWorker(labTech1, '#f8fafc', '#2b1d14', true); // beyaz laboratuvar önlüklü uzman
  const labTech2 = officeChair(g, b1x - 0.1, b1z - 1.08, 0, chairMats);
  seatedWorker(labTech2, '#f1f5f9', '#1c1c1c', false);

  // --- 3. Doğu Ada Tezgâhı (x = 3.1, z = -2.5): Lif Mikroskopi, Kimyasal Analiz & Şahit Numune Arşivi ---
  const b2x = 3.1, b2z = -2.5;
  rounded(g, [3.3, 0.82, 1.35], [b2x, 0.57, b2z], cabWhite, 0, 0.02);
  rounded(g, [3.42, 0.06, 1.45], [b2x, 1.0, b2z], benchTop, 0, 0.015);
  // Ada ortasında çift katlı cam reaktif rafı
  for (const sx of [-1.2, 0, 1.2]) slabBox(g, [0.04, 0.58, 0.04], [b2x + sx, 1.32, b2z], steel);
  for (const sy of [1.34, 1.58]) {
    slabBox(g, [2.7, 0.025, 0.26], [b2x, sy, b2z], labGlass).castShadow = false;
    for (let k = 0; k < 8; k++) {
      cyl(g, 0.04, 0.15, [b2x - 1.12 + k * 0.32, sy + 0.09, b2z], std(['#38bdf8', '#22c55e', '#f59e0b', '#a855f7'][k % 4], 0.25, 0.1));
    }
  }
  // 2 Adet Binoküler Lif Mikroskobu
  for (const mxOff of [-0.95, 0.15]) {
    const mxp = b2x + mxOff, mzp = b2z + 0.38;
    rounded(g, [0.22, 0.05, 0.28], [mxp, 1.055, mzp], cabWhite, 0, 0.015);
    slabBox(g, [0.06, 0.32, 0.08], [mxp, 1.22, mzp - 0.08], cabWhite);
    slabBox(g, [0.16, 0.02, 0.16], [mxp, 1.2, mzp + 0.02], dark); // mikroskop tablası
    const eyepiece = cyl(g, 0.035, 0.18, [mxp, 1.4, mzp + 0.03], dark);
    eyepiece.rotation.x = 0.55;
  }
  computer(g, b2x - 0.95, 1.03, b2z - 0.36, 0, labScreen, black, keys);
  computer(g, b2x + 1.05, 1.03, b2z + 0.36, Math.PI, labScreen, black, keys);
  const labTech3 = officeChair(g, b2x - 0.95, b2z - 1.08, 0, chairMats);
  seatedWorker(labTech3, '#f8fafc', '#4a2e1b', true);
  const labTech4 = officeChair(g, b2x + 1.05, b2z + 1.08, Math.PI, chairMats);
  seatedWorker(labTech4, '#f1f5f9', '#222222', false);

  // Doğu Duvarı Önü (x = 5.42, z = -2.5): Şahit Numune & Kumaş Test Arşiv Rafı
  rounded(g, [0.52, 2.1, 2.8], [5.42, 1.22, -2.5], dark, 0, 0.02);
  const sampleCols = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
  for (const sy of [0.6, 1.05, 1.5, 1.95]) {
    slabBox(g, [0.46, 0.035, 2.68], [5.42, sy, -2.5], steel);
    for (let k = 0; k < 6; k++) {
      slabBox(g, [0.34, 0.18, 0.34], [5.42, sy + 0.11, -3.6 + k * 0.44], std(sampleCols[(k + Math.round(sy * 2)) % sampleCols.length], 0.7, 0));
    }
  }

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f7ff', emissiveIntensity: 1.65 });
  for (const x of [-3.6, 0, 3.6]) for (const z of [-5.5, -1.6]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 2. Kat — Muhasebe & Satın Alma (x: 6.0 .. 17.6, z: -7.75 .. 1.65): finans & fatura adası, satın alma & tedarikçi masası, çelik kasa ve arşiv. */
function buildFinancePurchasing() {
  const g = new THREE.Group(); g.name = 'finance-purchasing';
  g.position.y = FLOOR_Y[2] - 0.15;
  const X0 = 6.0, X1 = 17.6, Z0 = -7.75, Z1 = 1.65, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floorM = std('#947d63', 0.5, 0.05), walnut = std('#63442d', 0.45, 0.06), oak = std('#8c6b4a', 0.48, 0.05);
  const dark = std('#181c24', 0.48, 0.4), cream = std('#efeae0', 0.6, 0.05), blue = std('#1e40af', 0.75, 0.05), emerald = std('#065f46', 0.78, 0.05);
  const gold = std('#c9a24a', 0.3, 0.8), steel = std('#aab2ba', 0.3, 0.85), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: std('#1e293b', 0.8, 0.05), back: std('#0f172a', 0.85, 0.05), metal: steel };
  const guestMats = { seat: emerald, back: emerald, metal: gold };
  const finScreen = new THREE.MeshBasicMaterial({ map: screenTexture('fin_board'), toneMapped: false });
  const deskScreen = new THREE.MeshBasicMaterial({ map: screenTexture('desk'), toneMapped: false });

  // Zemin kaplaması
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], floorM).castShadow = false;

  // --- 1. Batı-Kuzey (x = 9.1, z = -4.3): Muhasebe & Finans 4'lü Çalışma Adası + Fatura Klasör Arşivi + Çelik Kasa ---
  const fx = 9.1, fz = -4.3;
  screen(g, 2.3, 1.28, 'fin_board', [fx, 2.02, Z0 + 0.12]);
  const binderCols = ['#1d4ed8', '#047857', '#b45309', '#be123c', '#4338ca'];
  for (const side of [-1, 1]) {
    const cabX = fx + side * 2.05;
    rounded(g, [1.45, 2.15, 0.42], [cabX, 1.24, Z0 + 0.34], walnut, 0, 0.02);
    for (const sy of [0.65, 1.15, 1.65, 2.05]) {
      slabBox(g, [1.35, 0.035, 0.38], [cabX, sy, Z0 + 0.36], dark);
      for (let k = 0; k < 7; k++) {
        slabBox(g, [0.065, 0.3, 0.26], [cabX - 0.54 + k * 0.17, sy + 0.17, Z0 + 0.36], std(binderCols[(k + (side > 0 ? 2 : 0)) % binderCols.length], 0.65, 0));
      }
    }
  }
  // Çelik Para & Kıymetli Evrak Kasası (batı duvar önü, x = 6.55, z = -6.5)
  rounded(g, [0.72, 1.35, 0.68], [6.55, 0.85, -6.5], std('#27303f', 0.35, 0.65), 0, 0.03);
  slabBox(g, [0.04, 1.22, 0.58], [6.91, 0.85, -6.5], std('#334155', 0.3, 0.7));
  cyl(g, 0.08, 0.04, [6.93, 0.92, -6.38], gold).rotation.z = Math.PI / 2;
  slabBox(g, [0.03, 0.14, 0.12], [6.93, 1.12, -6.38], black);

  // Muhasebe 4'lü Çalışma Adası
  rounded(g, [3.1, 0.055, 1.55], [fx, 0.76, fz], cream, 0, 0.02);
  rounded(g, [3.02, 0.36, 0.045], [fx, 0.97, fz], blue, 0, 0.015);
  rounded(g, [0.045, 0.36, 1.45], [fx, 0.97, fz], blue, 0, 0.015);
  for (const sx of [-1.4, 0, 1.4]) for (const sz of [-0.65, 0.65]) slabBox(g, [0.05, 0.58, 0.05], [fx + sx, 0.46, fz + sz], dark);
  const finWorkers: [number, number, boolean, string, string][] = [
    [-0.78, 1, false, '#1e3a5f', '#1c1c1c'],
    [0.78, 1, true, '#2f6f8f', '#4a2e1b'],
    [-0.78, -1, true, '#8c3b4a', '#2b1d14'],
    [0.78, -1, false, '#3b4d5e', '#262626'],
  ];
  finWorkers.forEach(([dx, side, female, sh, hr], idx) => {
    const x = fx + dx, chairZ = fz + side * 1.12, rotY = side > 0 ? Math.PI : 0;
    computer(g, x, 0.79, fz + side * 0.24, side > 0 ? 0 : Math.PI, idx === 0 ? finScreen : deskScreen, black, keys);
    // Masaüstü muhasebe hesap makinesi + fatura klasörü
    rounded(g, [0.14, 0.03, 0.18], [x - 0.36, 0.8, fz + side * 0.28], dark, 0, 0.01);
    slabBox(g, [0.22, 0.025, 0.28], [x + 0.38, 0.8, fz + side * 0.26], std('#f8fafc', 0.8, 0));
    const ch = officeChair(g, x, chairZ, rotY, chairMats);
    if (idx !== 3) seatedWorker(ch, sh, hr, female);
  });

  // --- 2. Doğu-Kuzey (x = 14.7, z = -4.3): Satın Alma & Tedarik Zinciri 4'lü Çalışma Adası ---
  const sx = 14.7, sz = -4.3;
  screen(g, 2.3, 1.28, 'fin_board', [sx, 2.02, Z0 + 0.12]);
  for (const side of [-1, 1]) {
    const cabX = sx + side * 1.95;
    rounded(g, [1.35, 2.15, 0.42], [cabX, 1.24, Z0 + 0.34], oak, 0, 0.02);
    for (const sy of [0.65, 1.15, 1.65, 2.05]) {
      slabBox(g, [1.25, 0.035, 0.38], [cabX, sy, Z0 + 0.36], dark);
      for (let k = 0; k < 5; k++) {
        slabBox(g, [0.18, 0.24, 0.26], [cabX - 0.44 + k * 0.22, sy + 0.14, Z0 + 0.36], std(binderCols[(k + 1) % binderCols.length], 0.65, 0));
      }
    }
  }
  rounded(g, [3.0, 0.055, 1.55], [sx, 0.76, sz], cream, 0, 0.02);
  rounded(g, [2.92, 0.36, 0.045], [sx, 0.97, sz], emerald, 0, 0.015);
  rounded(g, [0.045, 0.36, 1.45], [sx, 0.97, sz], emerald, 0, 0.015);
  for (const lx of [-1.35, 0, 1.35]) for (const lz of [-0.65, 0.65]) slabBox(g, [0.05, 0.58, 0.05], [sx + lx, 0.46, sz + lz], dark);
  const buyerWorkers: [number, number, boolean, string, string][] = [
    [-0.74, 1, true, '#1f6f78', '#3b2214'],
    [0.74, 1, false, '#2d4a3e', '#1c1c1c'],
    [-0.74, -1, false, '#4a5568', '#2e231a'],
    [0.74, -1, true, '#b8563a', '#523624'],
  ];
  buyerWorkers.forEach(([dx, side, female, sh, hr], idx) => {
    const x = sx + dx, chairZ = sz + side * 1.12, rotY = side > 0 ? Math.PI : 0;
    computer(g, x, 0.79, sz + side * 0.24, side > 0 ? 0 : Math.PI, idx % 2 === 0 ? finScreen : deskScreen, black, keys);
    rounded(g, [0.15, 0.04, 0.17], [x + 0.38, 0.8, sz + side * 0.24], black, 0, 0.01);
    const ch = officeChair(g, x, chairZ, rotY, chairMats);
    if (idx !== 2) seatedWorker(ch, sh, hr, female);
  });

  // --- 3. Batı-Güney (x = 8.2, z = -0.35): Tedarikçi İhale & Sözleşme Masası (koridor kapısının solunda ferah alan) ---
  const vx = 8.2, vz = -0.35;
  cyl(g, 1.4, 0.02, [vx, 0.185, vz], std('#1e3a4c', 0.9, 0)).castShadow = false;
  cyl(g, 0.82, 0.05, [vx, 0.76, vz], walnut);
  cyl(g, 0.09, 0.56, [vx, 0.47, vz], dark); cyl(g, 0.42, 0.03, [vx, 0.19, vz], dark);
  computer(g, vx - 0.24, 0.785, vz, Math.PI / 2, finScreen, black, keys);
  slabBox(g, [0.24, 0.02, 0.3], [vx + 0.22, 0.795, vz + 0.1], std('#f59e0b', 0.7, 0));
  const buyerLead = officeChair(g, vx - 1.1, vz, Math.PI / 2, guestMats);
  seatedWorker(buyerLead, '#1e3a5f', '#221a14', false);
  const vendorRep = officeChair(g, vx + 1.1, vz, -Math.PI / 2, guestMats);
  seatedWorker(vendorRep, '#d8cfc2', '#3b2416', true);

  // --- 4. Doğu-Güney (x = 15.1, z = -0.35): Mali İşler & Finans Müdürü Masası ---
  const mx = 15.1, mz = -0.35;
  rounded(g, [2.05, 0.065, 0.95], [mx, 0.78, mz], walnut, 0, 0.025);
  rounded(g, [1.9, 0.6, 0.07], [mx, 0.47, mz - 0.4], dark, 0, 0.02);
  for (const side of [-1, 1]) rounded(g, [0.36, 0.6, 0.88], [mx + side * 0.82, 0.47, mz], dark, 0, 0.02);
  computer(g, mx - 0.2, 0.82, mz, 0, finScreen, black, keys);
  slabBox(g, [0.38, 0.08, 0.07], [mx + 0.42, 0.85, mz - 0.3], gold); // "MALİ İŞLER MÜDÜRÜ" isimliği
  const cfoChair = officeChair(g, mx, mz + 0.78, Math.PI, { seat: dark, back: dark, metal: gold });
  seatedWorker(cfoChair, '#182436', '#2b2b2b', false);

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [8.2, 11.8, 15.4]) for (const z of [-5.5, -1.6]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** Zemin Kat Doğu Kule (x: 20.15 .. 28.25, z: -7.75 .. 5.75) — Bilgi İşlem (IT) & Sistem Odası: 42U sunucu kabinetleri, NOC izleme masası ve UPS güç merkezi. */
function buildITServerRoom() {
  const g = new THREE.Group(); g.name = 'it-server-room';
  const X0 = 20.15, X1 = 28.25, Z0 = -7.75, Z1 = 5.75, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const raisedFloor = std('#2b3340', 0.42, 0.25), rackBody = std('#141820', 0.4, 0.55), dark = std('#101318', 0.5, 0.4);
  const cream = std('#efeae0', 0.6, 0.05), steel = std('#aab2ba', 0.3, 0.85), cyanGlow = new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.8 });
  const greenGlow = new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#16a34a', emissiveIntensity: 1.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#7dd3fc', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.26, depthWrite: false });
  const black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: std('#1e293b', 0.8, 0.05), back: std('#0f172a', 0.85, 0.05), metal: steel };
  const nocScreen = new THREE.MeshBasicMaterial({ map: screenTexture('energy'), toneMapped: false });
  const mapScreen = new THREE.MeshBasicMaterial({ map: screenTexture('map'), toneMapped: false });

  // Antistatik yükseltilmiş veri merkezi zemini + soğuk koridor şeridi
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], raisedFloor).castShadow = false;
  slabBox(g, [1.8, 0.032, 5.4], [cx, 0.168, -4.6], std('#1e293b', 0.35, 0.3)).castShadow = false;
  // Zemin kat lobi-koridor geçişi (x = 20.0, z: 1.65 .. 3.65) kemeri
  for (const zp of [1.7, 3.6]) slabBox(g, [0.3, 2.85, 0.1], [20.0, 1.58, zp], dark);
  slabBox(g, [0.32, 0.1, 2.0], [20.0, 2.98, 2.65], std('#c9a24a', 0.3, 0.8));

  // --- 1. Kuzey Veri Merkezi (Server Room, z: -7.5 .. -1.8): 2 Sıra × 4 Adet 42U Sunucu Kabineti + Cam Güvenlik Bölmesi ---
  screen(g, 2.6, 1.35, 'energy', [cx, 2.05, Z0 + 0.14]);
  for (const side of [-1, 1]) {
    const rx = cx + side * 2.15;
    for (const rz of [-6.2, -5.0, -3.8, -2.6]) {
      rounded(g, [0.82, 2.15, 0.92], [rx, 1.24, rz], rackBody, 0, 0.02);
      // Ön cam kapak ve içerideki sunucu blade üniteleri + durum LED'leri
      const doorX = rx - side * 0.42;
      slabBox(g, [0.02, 1.98, 0.78], [doorX, 1.24, rz], glass).castShadow = false;
      for (let u = 0; u < 6; u++) {
        const uy = 0.48 + u * 0.28;
        slabBox(g, [0.68, 0.16, 0.76], [rx, uy, rz], dark);
        slabBox(g, [0.02, 0.03, 0.58], [doorX + side * 0.03, uy + 0.03, rz], u % 2 === 0 ? cyanGlow : greenGlow).castShadow = false;
      }
      // Kabin üstü kablo tavası bağlantısı
      slabBox(g, [0.4, 0.04, 0.92], [rx, 2.36, rz], steel);
    }
  }
  // Sunucu odası ile NOC ofisi arasındaki iç cam bölme (z = -1.5, ortası açık geçiş)
  for (const [ax, bx] of [[X0 + 0.1, cx - 0.85], [cx + 0.85, X1 - 0.1]] as const) {
    slabBox(g, [bx - ax, 2.75, 0.04], [(ax + bx) / 2, 1.55, -1.5], glass).castShadow = false;
    slabBox(g, [bx - ax, 0.06, 0.07], [(ax + bx) / 2, 2.95, -1.5], dark);
  }

  // --- 2. Ağ & Siber Güvenlik İzleme Merkezi (NOC) + IT Destek Masası (Güney: z = 0.2 .. 4.8) ---
  const nx = 24.5, nz = 0.35;
  rounded(g, [3.2, 0.055, 1.5], [nx, 0.76, nz], cream, 0, 0.02);
  rounded(g, [3.1, 0.34, 0.045], [nx, 0.96, nz], std('#0284c7', 0.7, 0.1), 0, 0.015);
  for (const sx of [-1.45, 0, 1.45]) for (const sz of [-0.62, 0.62]) slabBox(g, [0.05, 0.58, 0.05], [nx + sx, 0.46, nz + sz], dark);
  for (const side of [1, -1]) {
    [-0.82, 0.82].forEach((dx, i) => {
      const x = nx + dx, chairZ = nz + side * 1.1, rotY = side > 0 ? Math.PI : 0;
      computer(g, x, 0.79, nz + side * 0.24, side > 0 ? 0 : Math.PI, (i + (side > 0 ? 0 : 1)) % 2 === 0 ? nocScreen : mapScreen, black, keys);
      const ch = officeChair(g, x, chairZ, rotY, chairMats);
      if (!(side < 0 && i === 1)) seatedWorker(ch, side > 0 ? '#1e3a5f' : '#0f766e', '#1c1c1c', side < 0);
    });
  }

  // Güney Duvarı Önü (z = 4.95): UPS Kesintisiz Güç Kaynağı Kabinleri & Yedek Donanım Rafları
  for (let k = 0; k < 3; k++) {
    const ux = 22.0 + k * 1.15;
    rounded(g, [0.92, 1.75, 0.68], [ux, 1.04, 5.05], std('#1e2530', 0.45, 0.45), 0, 0.02);
    slabBox(g, [0.35, 0.18, 0.03], [ux, 1.45, 4.7], cyanGlow).castShadow = false;
    slabBox(g, [0.65, 0.45, 0.02], [ux, 0.85, 4.7], std('#334155', 0.5, 0.5));
  }
  // Donanım & Yedek Parça Dolabı (sağ güney, x = 26.7, z = 4.95)
  rounded(g, [2.1, 1.85, 0.55], [26.6, 1.08, 5.1], steel, 0, 0.02);

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e0f2fe', emissiveIntensity: 1.55 });
  for (const x of [22.2, 26.2]) for (const z of [-5.2, -0.5, 3.8]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.72, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 1. Kat Doğu Kule (x: 20.15 .. 28.25, z: -7.75 .. 5.75) — Ar-Ge & Tasarım Stüdyosu: koleksiyon tasarım adası, terzi mankenleri, numune kesim ve dijital baskı. */
function buildRDDesignStudio() {
  const g = new THREE.Group(); g.name = 'rd-design-studio';
  g.position.y = FLOOR_Y[1] - 0.15;
  const X0 = 20.15, X1 = 28.25, Z0 = -7.75, Z1 = 5.75, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const parquet = std('#9e8468', 0.48, 0.05), oak = std('#8c6b4a', 0.45, 0.05), dark = std('#181c24', 0.45, 0.4), cream = std('#f4efe6', 0.58, 0.05);
  const gold = std('#c9a24a', 0.3, 0.8), steel = std('#aab2ba', 0.3, 0.85), black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: std('#7c3f58', 0.78, 0.05), back: std('#592b3e', 0.82, 0.05), metal: gold };
  const showScreen = new THREE.MeshBasicMaterial({ map: screenTexture('showroom'), toneMapped: false });

  // Açık meşe tasarım stüdyosu parkesi
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], parquet).castShadow = false;

  // --- 1. Kuzey Bölümü (z: -7.5 .. -2.2): Moodboard & Renk Trend Ekranı + 4'lü Moda Tasarım Adası + Terzi Mankenleri ---
  screen(g, 2.6, 1.38, 'showroom', [cx, 2.02, Z0 + 0.14]);
  // Kumaş & Pantone Renk Kartela Rafları (kuzey duvar iki yanı)
  const swatchCols = ['#e11d48', '#0284c7', '#16a34a', '#d97706', '#7c3aed', '#0d9488'];
  for (const side of [-1, 1]) {
    const sx = cx + side * 2.45;
    rounded(g, [1.65, 2.1, 0.4], [sx, 1.22, Z0 + 0.34], oak, 0, 0.02);
    for (const sy of [0.65, 1.15, 1.65, 2.02]) {
      slabBox(g, [1.55, 0.035, 0.36], [sx, sy, Z0 + 0.36], dark);
      for (let k = 0; k < 5; k++) {
        const roll = cyl(g, 0.055, 0.3, [sx - 0.54 + k * 0.27, sy + 0.11, Z0 + 0.36], std(swatchCols[(k + (side > 0 ? 2 : 0)) % swatchCols.length], 0.7, 0));
        roll.rotation.x = Math.PI / 2;
      }
    }
  }

  // 4 Kişilik Koleksiyon & CAD Tasarım Adası (x = 23.4, z = -4.2)
  const dx = 23.4, dz = -4.2;
  rounded(g, [3.0, 0.055, 1.55], [dx, 0.76, dz], cream, 0, 0.02);
  rounded(g, [2.9, 0.34, 0.045], [dx, 0.96, dz], std('#be185d', 0.75, 0.05), 0, 0.015);
  for (const sx of [-1.35, 0, 1.35]) for (const sz of [-0.65, 0.65]) slabBox(g, [0.05, 0.58, 0.05], [dx + sx, 0.46, dz + sz], dark);
  for (const side of [1, -1]) {
    [-0.75, 0.75].forEach((ox, i) => {
      const x = dx + ox, chairZ = dz + side * 1.12, rotY = side > 0 ? Math.PI : 0;
      computer(g, x, 0.79, dz + side * 0.24, side > 0 ? 0 : Math.PI, showScreen, black, keys);
      slabBox(g, [0.24, 0.02, 0.18], [x + 0.36, 0.8, dz + side * 0.26], std(swatchCols[(i * 2 + (side > 0 ? 0 : 1)) % swatchCols.length], 0.7, 0));
      const ch = officeChair(g, x, chairZ, rotY, chairMats);
      if (!(side < 0 && i === 0)) seatedWorker(ch, ['#be185d', '#0f766e', '#4338ca', '#b45309'][(i + (side > 0 ? 0 : 2)) % 4], '#2b1d14', side > 0 || i === 1);
    });
  }

  // Doğu Duvarı Önü (x = 27.1, z: -5.2 .. -1.8): 3 Adet Terzi Mankeni (Dress Form) + Yeni Sezon Koleksiyon Askılığı
  for (const [mz, col] of [[-5.0, '#e11d48'], [-3.8, '#0284c7'], [-2.6, '#16a34a']] as const) {
    cyl(g, 0.18, 0.04, [27.1, 0.19, mz], gold);
    cyl(g, 0.025, 0.95, [27.1, 0.66, mz], gold);
    cyl(g, 0.17, 0.58, [27.1, 1.25, mz], std(col, 0.72, 0.05));
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), std(col, 0.72, 0.05));
    sh.position.set(27.1, 1.54, mz); sh.scale.set(1.1, 0.55, 0.8); g.add(sh);
    cyl(g, 0.055, 0.12, [27.1, 1.68, mz], std('#e6dcc8', 0.8, 0));
  }

  // --- 2. Güney Bölümü (z: -0.2 .. 5.2): Numune Kesim & Drapaj Masası + Dijital Tekstil Baskı Makinesi ---
  // Geniş Drapaj & Numune Kesim Masası (x = 24.4, z = 0.6)
  const tx = 24.4, tz = 0.6;
  rounded(g, [3.2, 0.07, 1.35], [tx, 0.86, tz], cream, 0, 0.02);
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.55, 0.55]) slabBox(g, [0.07, 0.68, 0.07], [tx + sx, 0.5, tz + sz], oak);
  slabBox(g, [2.7, 0.03, 1.0], [tx, 0.48, tz], oak);
  // Masa üzerinde serili desenli kumaşlar, rulo toplar ve cetvel
  slabBox(g, [1.4, 0.016, 0.92], [tx - 0.5, 0.905, tz], std('#0284c7', 0.75, 0));
  slabBox(g, [0.95, 0.018, 0.78], [tx + 0.45, 0.908, tz - 0.05], std('#f43f5e', 0.75, 0));
  for (let k = 0; k < 3; k++) {
    const r = cyl(g, 0.065, 0.85, [tx + 1.22, 0.96, tz - 0.32 + k * 0.32], std(swatchCols[k + 2], 0.75, 0));
    r.rotation.z = Math.PI / 2;
  }

  // Güney Vitrin Önü (z = 4.3): Dijital Kumaş Süblimasyon Baskı Makinesi + Koleksiyon Askısı
  const px = 23.2, pz = 4.35;
  for (const sx of [-0.85, 0.85]) slabBox(g, [0.08, 0.82, 0.55], [px + sx, 0.56, pz], dark);
  rounded(g, [2.1, 0.32, 0.62], [px, 1.08, pz], dark, 0, 0.03);
  rounded(g, [1.9, 0.1, 0.48], [px, 1.26, pz], std('#0ea5e9', 0.4, 0.2), 0, 0.02);
  slabBox(g, [1.55, 0.58, 0.02], [px, 0.76, pz - 0.3], std('#ec4899', 0.7, 0)); // basılan desenli kumaş
  // Yanında Askıda Numune Koleksiyon Standı (x = 26.4, z = 4.2)
  for (const sx of [-0.7, 0.7]) cyl(g, 0.025, 1.45, [26.4 + sx, 0.9, 4.2], gold);
  const bar = cyl(g, 0.02, 1.45, [26.4, 1.6, 4.2], gold); bar.rotation.z = Math.PI / 2;
  for (let k = 0; k < 6; k++) slabBox(g, [0.08, 0.78, 0.42], [25.88 + k * 0.21, 1.15, 4.2], std(swatchCols[k % swatchCols.length], 0.75, 0));

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [22.2, 26.2]) for (const z of [-5.2, -0.5, 3.8]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

/** 2. Kat Doğu Kule (x: 20.15 .. 28.25, z: -7.75 .. 5.75) — İhracat & Lojistik Ofisi: küresel konteyner takip, gümrük operasyon adası ve müşteri salonu. */
function buildExportLogistics() {
  const g = new THREE.Group(); g.name = 'export-logistics';
  g.position.y = FLOOR_Y[2] - 0.15;
  const X0 = 20.15, X1 = 28.25, Z0 = -7.75, Z1 = 5.75, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floorM = std('#8b7762', 0.48, 0.05), walnut = std('#5c3d28', 0.44, 0.06), dark = std('#151922', 0.45, 0.4), cream = std('#efeae0', 0.6, 0.05);
  const navy = std('#1e3a5f', 0.78, 0.05), cognac = std('#7c3f23', 0.68, 0.06), gold = std('#c9a24a', 0.3, 0.8), steel = std('#aab2ba', 0.3, 0.85);
  const black = std('#101214', 0.5, 0.3), keys = std('#2a2e35', 0.6, 0.2);
  const chairMats = { seat: navy, back: dark, metal: steel };
  const mapScreen = new THREE.MeshBasicMaterial({ map: screenTexture('map'), toneMapped: false });
  const kpiScreen = new THREE.MeshBasicMaterial({ map: screenTexture('exec_kpi'), toneMapped: false });

  // Zemin parkesi
  slabBox(g, [X1 - X0, 0.03, Z1 - Z0], [cx, 0.165, cz], floorM).castShadow = false;

  // --- 1. Kuzey Bölümü (z: -7.5 .. -1.8): Küresel Sevkiyat & Harita Ekranı + 6 Kişilik İhracat/Gümrük Adası ---
  screen(g, 2.7, 1.4, 'map', [cx, 2.02, Z0 + 0.14]);
  // Gümrük Beyanname & Konşimento Arşiv Dolapları (kuzey duvar iki yanı)
  const docCols = ['#0284c7', '#16a34a', '#d97706', '#dc2626'];
  for (const side of [-1, 1]) {
    const cabX = cx + side * 2.5;
    rounded(g, [1.55, 2.1, 0.4], [cabX, 1.22, Z0 + 0.34], walnut, 0, 0.02);
    for (const sy of [0.65, 1.15, 1.65, 2.02]) {
      slabBox(g, [1.45, 0.035, 0.36], [cabX, sy, Z0 + 0.36], dark);
      for (let k = 0; k < 6; k++) {
        slabBox(g, [0.065, 0.28, 0.25], [cabX - 0.52 + k * 0.2, sy + 0.16, Z0 + 0.36], std(docCols[(k + (side > 0 ? 1 : 0)) % docCols.length], 0.65, 0));
      }
    }
  }

  // 6 Kişilik İhracat, Gümrük & Lojistik Operasyon Adası (x = 24.25, z = -4.2)
  const ex = 24.25, ez = -4.2;
  rounded(g, [4.2, 0.055, 1.55], [ex, 0.76, ez], cream, 0, 0.02);
  rounded(g, [4.1, 0.35, 0.045], [ex, 0.96, ez], navy, 0, 0.015);
  for (const dx of [-0.7, 0.7]) rounded(g, [0.045, 0.35, 1.45], [ex + dx, 0.96, ez], navy, 0, 0.015);
  for (const sx of [-1.95, 0, 1.95]) for (const sz of [-0.65, 0.65]) slabBox(g, [0.05, 0.58, 0.05], [ex + sx, 0.46, ez + sz], dark);
  for (const side of [1, -1]) {
    [-1.35, 0, 1.35].forEach((ox, i) => {
      const x = ex + ox, chairZ = ez + side * 1.12, rotY = side > 0 ? Math.PI : 0;
      computer(g, x, 0.79, ez + side * 0.24, side > 0 ? 0 : Math.PI, (i + (side > 0 ? 0 : 1)) % 2 === 0 ? mapScreen : kpiScreen, black, keys);
      rounded(g, [0.15, 0.04, 0.17], [x + 0.38, 0.8, ez + side * 0.24], black, 0, 0.01);
      const ch = officeChair(g, x, chairZ, rotY, chairMats);
      if (!(side < 0 && i === 1)) seatedWorker(ch, ['#1e3a5f', '#2d5a4c', '#7c3f23', '#3b4d5e', '#0f766e'][(i + (side > 0 ? 0 : 2)) % 5], '#221a14', (i + (side > 0 ? 1 : 0)) % 2 === 1);
    });
  }

  // --- 2. Güney Bölümü (z: 0.0 .. 5.2): Yurt Dışı Müşteri Ağırlama & İhracat Sipariş Masası + VIP Koltuk Grubu ---
  const lx = 24.4, lz = 1.65;
  slabBox(g, [4.6, 0.018, 5.2], [lx, 0.185, 2.3], std('#1e3246', 0.92, 0)).castShadow = false;
  // Oval Yurt Dışı Alıcı (Buyer) Toplantı Masası (x = 24.4, z = 0.75)
  rounded(g, [2.4, 0.065, 1.15], [lx, 0.77, 0.75], walnut, 0, 0.04);
  for (const sx of [-0.7, 0.7]) cyl(g, 0.16, 0.58, [lx + sx, 0.47, 0.75], dark);
  computer(g, lx - 0.35, 0.81, 0.75, 0, kpiScreen, black, keys);
  slabBox(g, [0.32, 0.025, 0.24], [lx + 0.38, 0.815, 0.75], std('#d6b878', 0.6, 0.2)); // ihracat numune kataloğu
  const expDir = officeChair(g, lx - 0.45, -0.25, 0, { seat: cognac, back: cognac, metal: gold });
  seatedWorker(expDir, '#182436', '#1c1c1c', false);
  const foreignBuyer1 = officeChair(g, lx - 0.45, 1.75, Math.PI, { seat: cognac, back: cognac, metal: gold });
  seatedWorker(foreignBuyer1, '#b8563a', '#4a2e1b', true);
  const foreignBuyer2 = officeChair(g, lx + 0.55, 1.75, Math.PI, { seat: cognac, back: cognac, metal: gold });
  seatedWorker(foreignBuyer2, '#2f5560', '#2b1d14', false);

  // Güney Vitrin Önü (z = 4.1): VIP Misafir Kanepe Köşesi + İhracat Sevkiyat Numune Koli/Askı Standı
  rounded(g, [2.1, 0.24, 0.8], [23.6, 0.32, 4.35], cognac, 0, 0.06);
  rounded(g, [2.1, 0.5, 0.2], [23.6, 0.68, 4.66], cognac, 0.08, 0.06);
  for (const sx of [-1, 1]) rounded(g, [0.16, 0.44, 0.8], [23.6 + sx * 0.98, 0.48, 4.35], cognac, 0, 0.05);
  rounded(g, [1.1, 0.045, 0.62], [23.6, 0.44, 3.35], cream, 0, 0.02);
  slabBox(g, [1.14, 0.02, 0.66], [23.6, 0.43, 3.35], gold);
  // Sağ güney köşe (x = 26.8, z = 3.9): İhracat Koli & Numune Rafı
  rounded(g, [1.3, 1.85, 0.5], [26.8, 1.08, 4.5], walnut, 0, 0.02);
  for (const sy of [0.6, 1.15, 1.65]) {
    slabBox(g, [1.2, 0.035, 0.45], [26.8, sy, 4.5], dark);
    for (let k = 0; k < 3; k++) slabBox(g, [0.3, 0.24, 0.34], [26.42 + k * 0.38, sy + 0.14, 4.5], std('#c8a276', 0.75, 0));
  }

  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.5 });
  for (const x of [22.2, 26.2]) for (const z of [-5.2, -0.5, 3.8]) slabBox(g, [1.2, 0.03, 0.6], [x, 3.41, z], led).castShadow = false;
  return batchStaticAsset(g);
}

// Birim işaretleri (zemin boyası + kenar çizgisi + etiket)
function buildMarkers() {
  const root = new THREE.Group(); root.name = 'unit-markers';
  const colors = ['#38bdf8', '#a78bfa', '#34d399'];
  for (const u of ADMIN_UNITS) {
    const g = new THREE.Group(); g.name = u.id; g.position.set(u.center[0], FLOOR_Y[u.floor] + 0.04, u.center[1]);
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(u.size[0] - 0.4, u.size[1] - 0.4), new THREE.MeshBasicMaterial({ color: colors[u.floor], transparent: true, opacity: 0.16, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; g.add(zone);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(u.size[0] - 0.4, 0.02, u.size[1] - 0.4)), new THREE.LineBasicMaterial({ color: '#ffffff' })); g.add(edge);
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d')!; x.fillStyle = 'rgba(8,12,20,0.82)'; x.beginPath(); x.roundRect(4, 4, 504, 88, 18); x.fill();
    x.fillStyle = '#e2e8f0'; x.font = '600 38px system-ui, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(`${u.icon} ${u.name}`, 256, 50, 480);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    label.position.set(0, 3.2, 0); label.scale.set(7.5, 1.4, 1); g.add(label);
    g.userData = { zone, edge, label, unit: u };
    root.add(g);
  }
  return root;
}
