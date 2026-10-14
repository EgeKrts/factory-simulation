// MAL KABUL — "KONTROL / TARTIM" ZEMİN TARTISI (00_ortak.js gerekir)
// Mavi platform, iki yanda rampa, üç kenarda sarı korkuluk, direkte yeşil kg göstergeli terminal.

function createFloorScale({ size = 2.2, display = '1250.5 kg' } = {}) {
  const g = new THREE.Group();
  const { box, cylY } = kit(g);
  const blue = M(0x1f5fa8, 0.5, 0.45), plate = M(0x2b6fb8, 0.6, 0.4), yellow = M(0xf2c200, 0.2, 0.5);
  const steel = M(0xaab4be, 0.9, 0.3), dark = M(0x1b1d20, 0.6, 0.45);
  const D = size * 1.1, H = 0.14;

  // platform + ayarlı ayaklar + yükleme hücreleri
  box(size, H, D, blue, 0, H / 2 + 0.03, 0);
  box(size - 0.12, 0.03, D - 0.12, plate, 0, H + 0.045, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cylY(0.05, 0.05, steel, sx * (size / 2 - 0.15), 0.025, sz * (D / 2 - 0.15), 12);
  }
  // iki yan rampa
  for (const s of [-1, 1]) {
    const r = box(0.7, 0.04, D, steel, s * (size / 2 + 0.3), 0.07, 0, 0, 0, -s * 0.2);
    r.material = M(0x6a7078, 0.8, 0.45);
  }
  // sarı korkuluk (arka + iki yan; ön ve arka rampa tarafı açık)
  const rh = 0.95;
  for (const sz of [-1, 1]) {
    box(size, 0.05, 0.05, yellow, 0, H + rh, sz * (D / 2 - 0.05));
    box(size, 0.04, 0.04, yellow, 0, H + rh * 0.55, sz * (D / 2 - 0.05));
    for (const sx of [-1, 0, 1]) box(0.05, rh, 0.05, yellow, sx * (size / 2 - 0.05), H + rh / 2, sz * (D / 2 - 0.05));
  }
  // terminal direği + yeşil gösterge
  cylY(0.035, 1.3, steel, size / 2 - 0.1, 0.65, -D / 2 - 0.25, 12);
  box(0.4, 0.28, 0.1, dark, size / 2 - 0.1, 1.42, -D / 2 - 0.25, 0, 0.3, 0);
  const tex = canvasTex(256, 64, (c, W, Hh) => {
    c.fillStyle = '#031a08'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#4cff6e'; c.font = 'bold 40px monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(display, W / 2, Hh / 2 + 2);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }));
  face.position.set(size / 2 - 0.1 + 0.02, 1.46, -D / 2 - 0.19);
  face.rotation.y = 0.3;
  g.add(face);
  box(0.4, 0.04, 0.4, dark, size / 2 - 0.1, 0.02, -D / 2 - 0.25);
  return g;
}

demo(createFloorScale());
