// Varsayılan layout üreticisi: node scripts/genLayout.mjs
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
await build({ entryPoints: ['src/layout.ts'], bundle: true, platform: 'node', format: 'esm', outfile: 'node_modules/.cache/campus-layout.mjs' });
const { createCampus } = await import('../node_modules/.cache/campus-layout.mjs');

const m = (id, type, name, area, x, z, rot = 0, next = [], params = {}) => ({
  id, type, name, area, position: [x, 0, z], rotationY: rot, params, next,
});

const machines = [
  m('ENTRY-01', 'raw_entry', 'Kumaş Topu Girişi', 'inbound', -52, -12, 0, ['RAWSTORE-01']),
  m('RAWSTORE-01', 'raw_store', 'Ham Kumaş Deposu', 'inbound', -44, -12, 0, ['INSP-01']),
  m('INSP-01', 'inspection', 'Kumaş Kontrol (Giriş)', 'dyehouse', -34, -12, 0, ['CART-01'], { rejectPct: 3 }),
  m('CART-01', 'cart', 'Taşıma Arabası 1', 'dyehouse', -26, -12, 0, ['HT-01', 'HT-02', 'HT-03', 'HT-04']),
  m('HT-01', 'ht_jet', 'HT/Jet Boya 250kg', 'dyehouse', -14, -25, 0, ['CART-02'], { cycleSec: 200, capacityKg: 250 }),
  m('HT-02', 'ht_jet', 'HT/Jet Boya 500kg', 'dyehouse', -14, -18, 0, ['CART-02'], { cycleSec: 240, capacityKg: 500 }),
  m('HT-03', 'ht_jet', 'HT/Jet Boya 750kg', 'dyehouse', -14, -6, 0, ['CART-02'], { cycleSec: 280, capacityKg: 750 }),
  m('HT-04', 'ht_jet', 'HT/Jet Boya 1000kg', 'dyehouse', -14, 1, 0, ['CART-02'], { cycleSec: 320, capacityKg: 1000 }),
  m('CART-02', 'cart', 'Taşıma Arabası 2', 'dyehouse', -4, -12, 0, ['STENTER-01']),
  m('STENTER-01', 'stenter', 'Ramöz', 'finishing', 8, -12, 0, ['COMPACT-01']),
  m('COMPACT-01', 'compactor', 'Kompaktör', 'finishing', 22, -12, 0, ['INSP-02']),
  m('INSP-02', 'inspection', 'Kumaş Kontrol (Final)', 'quality', 33, -12, 0, ['CUT-01'], { rejectPct: 2 }),
  m('CUT-01', 'cut', 'Serim + Kesim', 'garment', 44, -6, 0, ['SEW-01', 'SEW-02', 'SEW-03']),
  m('SEW-01', 'sew', 'Dikim Bandı 1', 'garment', 46, 1, 0, ['IRON-01']),
  m('SEW-02', 'sew', 'Dikim Bandı 2', 'garment', 46, 8, 0, ['IRON-01']),
  m('SEW-03', 'sew', 'Dikim Bandı 3', 'garment', 46, 15, 0, ['IRON-01']),
  m('IRON-01', 'iron', 'Ütü', 'garment', 46, 22, 0, ['GQC-01']),
  m('GQC-01', 'inspection', 'Konfeksiyon Son Kontrol', 'garment', 36, 22, 0, ['PACK-01'], { cycleSec: 20, rejectPct: 2 }),
  m('PACK-01', 'pack', 'Paketleme / Koli', 'garment', 27, 22, 0, ['PALLET-01']),
  m('PALLET-01', 'pallet', 'Paletleme', 'warehouse', 16, 22, 0, ['WH-01']),
  m('WH-01', 'warehouse', 'Mamul Depo', 'warehouse', 0, 24, 0, ['DOCK-01']),
  m('DOCK-01', 'dock', 'Sevkiyat Rampası', 'shipping', -20, 22, 0, ['TRUCK-01']),
  m('TRUCK-01', 'truck_out', 'Nakliye Kamyonu', 'shipping', -38, 22, 0, []),
  m('BOILER-01', 'boiler', 'Buhar Kazanı', 'utilities', -6, -37, 0, []),
  m('DYEPREP-01', 'dyeprep', 'Boya Hazırlama', 'utilities', -24, -37, 0, []),
  m('SLOT-WET-1', 'slot', 'Rezerv: HT-Ramöz arası 1', 'dyehouse', -4, -23, 0, []),
  m('SLOT-WET-2', 'slot', 'Rezerv: HT-Ramöz arası 2', 'dyehouse', -4, -2, 0, []),
  m('SLOT-FIN-1', 'slot', 'Rezerv: Kompaktör sonrası', 'finishing', 22, -23, 0, []),
  m('SLOT-POSTQC', 'slot', 'Rezerv: Final kontrol sonrası', 'quality', 33, -23, 0, []),
];

const layout = {
  version: 1,
  floor: { size: [126, 80], center: [-1, -7] },
  areas: [
    { id: 'inbound', name: 'KUMAŞ GİRİŞİ / HAM DEPO', color: '#8d6e63', center: [-49, -12], size: [22, 16] },
    { id: 'dyehouse', name: 'BOYAHANE', color: '#1e88e5', center: [-19, -12], size: [38, 34] },
    { id: 'finishing', name: 'APRE', color: '#f4511e', center: [14, -14], size: [28, 28] },
    { id: 'quality', name: 'FİNAL KALİTE', color: '#8e24aa', center: [33.5, -14], size: [9, 24] },
    { id: 'garment', name: 'KONFEKSİYON', color: '#43a047', center: [40, 10], size: [34, 40] },
    { id: 'warehouse', name: 'MAMUL DEPO', color: '#fb8c00', center: [4, 22], size: [36, 16] },
    { id: 'shipping', name: 'SEVKİYAT', color: '#00acc1', center: [-30, 22], size: [32, 16] },
    { id: 'utilities', name: 'YARDIMCI TESİSLER', color: '#fdd835', center: [-15, -37], size: [24, 12] },
  ],
  machines,
};

const campus = createCampus(layout);
writeFileSync('public/layouts/default.layout.json', JSON.stringify(campus, null, 2));
console.log('layout yazıldı:', campus.machines.length, 'makine');
