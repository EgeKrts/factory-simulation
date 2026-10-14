// MAL KABUL — KAPALI TENTE / ÇATI (portal çelik çerçeve, 00_ortak.js gerekir)
// Duvar x = 0'dadır; çatı +X yönüne doğru alçalır, uzunluk +Z boyunca. Sarı korumalı lacivert kolonlar.

function createCanopy({ length = 18, depth = 5.5, height = 5.5, columns = 4 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const roof = M(0x7c8794, 0.6, 0.4), navy = M(0x20252b, 0.6, 0.45), yellow = M(0xf2c200, 0.2, 0.5);
  const black = M(0x14181c, 0.4, 0.5), steel = M(0xaab4be, 0.9, 0.3);
  const light = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
  const rise = 0.8, a = Math.atan2(rise, depth), slope = Math.hypot(depth, rise);

  // çatı levhası + nervürler + saçak oluğu
  box(slope + 0.3, 0.1, length + 0.3, roof, depth / 2, height + rise / 2 + 0.1, length / 2, 0, 0, -a);
  for (let z = 0.3; z < length; z += 0.6) box(slope + 0.3, 0.04, 0.05, steel, depth / 2, height + rise / 2 + 0.17, z, 0, 0, -a);
  box(0.12, 0.15, length + 0.3, steel, depth + 0.1, height - 0.05, length / 2);
  box(0.25, 0.3, length, navy, depth, height - 0.05, length / 2);                  // saçak kirişi

  // kolonlar, sarı koruma, portal kirişi, köşe takviyesi
  const gap = length / (columns - 1);
  for (let i = 0; i < columns; i++) {
    const z = i * gap;
    box(0.35, height - 0.2, 0.35, navy, depth, (height - 0.2) / 2, z);
    box(0.46, 0.9, 0.46, yellow, depth, 0.45, z);
    for (let k = 0; k < 3; k++) box(0.48, 0.08, 0.48, black, depth, 0.15 + k * 0.28, z);
    box(slope, 0.3, 0.22, navy, depth / 2, height + rise / 2 - 0.1, z, 0, 0, -a);
    const dx = -0.9, dy = 0.85;
    box(Math.hypot(dx, dy), 0.12, 0.12, navy, depth - 0.45, height - 0.9 + dy / 2, z, 0, 0, Math.atan2(dy, dx));
  }
  // lineer LED armatürler
  for (let z = 1.5; z < length; z += 3.5) {
    box(0.2, 0.07, 2.0, light, depth - 1.6, height - 0.6, z);
    for (const dz of [-0.8, 0.8]) box(0.02, 0.85, 0.02, steel, depth - 1.6, height - 0.18, z + dz);
  }
  return g;
}

demo(createCanopy());
