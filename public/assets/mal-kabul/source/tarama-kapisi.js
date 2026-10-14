// MAL KABUL — "KUMAŞ TOPU GİRİŞİ" TARAMA KAPISI + KONVEYÖR (00_ortak.js gerekir)
// Konveyör X ekseninde, sarı portal Z'yi geçer. Yan direkte mavi ekranlı terminal.

function createScanPortal({ conveyorLength = 6, gateX = 0 } = {}) {
  const g = new THREE.Group();
  const { box, cylY, cylZ } = kit(g);
  const yellow = M(0xf2c200, 0.2, 0.5), black = M(0x14181c, 0.4, 0.5), steel = M(0xaab4be, 0.9, 0.3);
  const roller = M(0xc9ced4, 0.9, 0.3), grey = M(0x6a7078, 0.6, 0.5), dark = M(0x2b2f35, 0.7, 0.4);
  const lamp = new THREE.MeshStandardMaterial({ color: 0x2a7fb5, emissive: 0x2a7fb5, emissiveIntensity: 1.0 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1a2a, emissive: 0x2a7fb5, emissiveIntensity: 0.8 });
  const CW = 1.0, H = 2.5, half = CW / 2 + 0.35;
  const h = 0.7;                                                                // konveyör yüksekliği

  // konveyör
  for (const s of [-1, 1]) {
    box(conveyorLength, 0.12, 0.05, grey, 0, h, s * (CW / 2 + 0.02));
    for (let x = -conveyorLength / 2 + 0.4; x <= conveyorLength / 2 - 0.39; x += 1.4) {
      box(0.06, h, 0.06, yellow, x, h / 2, s * (CW / 2 + 0.02));
    }
  }
  for (let x = -conveyorLength / 2 + 0.1; x <= conveyorLength / 2 - 0.09; x += 0.14) cylZ(0.025, CW, roller, x, h + 0.015, 0, 14);

  // sarı portal
  for (const s of [-1, 1]) {
    box(0.14, H, 0.14, yellow, gateX, H / 2, s * half);
    for (let k = 0; k < 3; k++) box(0.16, 0.08, 0.16, black, gateX, 0.2 + k * 0.28, s * half);
    box(0.08, 0.5, 0.08, yellow, gateX, H - 0.55, s * (half - 0.2), 0.0, 0.0, s * 0.0);
    box(0.1, 0.28, 0.1, dark, gateX + 0.0, 1.3, s * (half - 0.1));            // sensör kutuları
    box(0.04, 0.1, 0.1, lamp, gateX - 0.07, 1.3, s * (half - 0.1));
  }
  box(0.18, 0.2, 2 * half + 0.2, yellow, gateX, H, 0);                         // üst kiriş
  box(0.12, 0.14, 0.5, dark, gateX, H - 0.17, 0);                              // tarama kafası
  box(0.04, 0.06, 0.4, lamp, gateX - 0.07, H - 0.17, 0);

  // terminal direği + mavi ekran
  cylY(0.03, 1.5, steel, gateX + 0.5, 0.75, half + 0.4, 12);
  box(0.34, 0.26, 0.04, dark, gateX + 0.5, 1.5, half + 0.4, -0.2, 0, 0);
  box(0.3, 0.2, 0.02, screen, gateX + 0.5, 1.5, half + 0.42, -0.2, 0, 0);
  box(0.3, 0.04, 0.3, dark, gateX + 0.5, 0.02, half + 0.4);
  return g;
}

demo(createScanPortal());
