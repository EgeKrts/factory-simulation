// MAL KABUL — KAYIT / BARKOD KABUL MASASI (00_ortak.js gerekir)
// Ön yüz (operatör) +Z tarafında. Çekmeceli tezgâh, 2 monitör, klavye, barkod yazıcı ve el okuyucu.

function createReceptionDesk({ length = 4.5, monitors = 2 } = {}) {
  const g = new THREE.Group();
  const { add, box, cylY } = kit(g);
  const cabinet = M(0xe8e2d4, 0.1, 0.6), top = M(0xf6f6f4, 0.1, 0.4), dark = M(0x1b1d20, 0.5, 0.5);
  const steel = M(0xaab4be, 0.9, 0.3), grey = M(0x6a7078, 0.6, 0.5);
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1a2a, emissive: 0x2a7fb5, emissiveIntensity: 0.7 });
  const H = 0.75;

  // tezgâh: gövde, çekmeceler, tabla
  box(length, H, 0.7, cabinet, 0, H / 2, 0);
  for (let x = -length / 2 + 0.4; x < length / 2 - 0.2; x += 0.55) {
    box(0.5, 0.22, 0.02, grey, x, H - 0.25, 0.36);
    box(0.5, 0.22, 0.02, grey, x, H - 0.52, 0.36);
    box(0.12, 0.02, 0.03, steel, x, H - 0.17, 0.38);
  }
  box(length + 0.06, 0.04, 0.78, top, 0, H + 0.02, 0);
  box(length, 0.08, 0.05, dark, 0, 0.04, 0.34);                               // süpürgelik
  // arka tezgâh / yan ek
  box(1.6, H, 0.6, cabinet, -length / 2 + 0.8, H / 2, -0.7);
  box(1.66, 0.04, 0.66, top, -length / 2 + 0.8, H + 0.02, -0.7);

  // monitörler + klavyeler
  for (let i = 0; i < monitors; i++) {
    const x = -length / 2 + 1.0 + i * 1.3;
    box(0.55, 0.34, 0.03, dark, x, H + 0.4, -0.15);
    box(0.5, 0.29, 0.02, screen, x, H + 0.4, -0.13);
    cylY(0.02, 0.18, steel, x, H + 0.13, -0.15, 8);
    box(0.2, 0.015, 0.14, dark, x, H + 0.055, -0.15);
    box(0.4, 0.015, 0.14, dark, x, H + 0.055, 0.12);
  }
  // barkod yazıcı + el okuyucu + etiket rulosu
  box(0.3, 0.22, 0.28, dark, length / 2 - 0.9, H + 0.15, -0.05);
  box(0.26, 0.01, 0.1, M(0xffffff, 0, 0.9), length / 2 - 0.9, H + 0.27, 0.12);
  box(0.12, 0.05, 0.1, steel, length / 2 - 0.4, H + 0.07, 0.1);
  add(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 12), dark, length / 2 - 0.4, H + 0.14, 0.1, 0.5, 0, 0);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20), M(0xf2f2ee, 0, 0.8), length / 2 - 0.3, H + 0.07, -0.2, 0, 0, Math.PI / 2);
  // telefon
  box(0.16, 0.05, 0.2, dark, length / 2 - 1.5, H + 0.07, 0.0);
  return g;
}

demo(createReceptionDesk());
