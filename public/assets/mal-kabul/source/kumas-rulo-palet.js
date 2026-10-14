// MAL KABUL — KUMAŞ RULO PALETİ (beyaz streç sarılı rulolar, piramit istif, 00_ortak.js gerekir)
// Rulolar Z ekseninde yatar. cols = alt sıradaki rulo sayısı, layers = kat sayısı.

function createPallet({ w = 1.4, d = 1.25 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const wood = M(0xb88a55, 0, 0.9);
  for (let i = 0; i < 5; i++) box(w, 0.022, 0.12, wood, 0, 0.145, -d / 2 + 0.06 + i * ((d - 0.12) / 4));
  for (const x of [-w / 2 + 0.06, 0, w / 2 - 0.06]) {
    for (const z of [-d / 2 + 0.06, 0, d / 2 - 0.06]) box(0.1, 0.1, 0.1, wood, x, 0.09, z);
    box(0.1, 0.022, d, wood, x, 0.011, 0);
  }
  return g;
}

function createFabricRollPallet({ cols = 3, layers = 2, rollR = 0.4, rollLen = 1.15 } = {}) {
  const g = new THREE.Group();
  const { add, box, cylZ } = kit(g);
  const wrap = new THREE.MeshStandardMaterial({ color: 0xf6f6f3, roughness: 0.55, metalness: 0.0 });
  const core = M(0xc8a06a, 0, 0.9), label = M(0xffffff, 0, 0.9), band = M(0x1f4fa8, 0.1, 0.5);

  g.add(createPallet({ w: Math.max(1.2, cols * rollR * 2 + 0.1), d: rollLen + 0.1 }));
  for (let l = 0; l < layers; l++) {
    const n = cols - l;
    if (n <= 0) break;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * rollR * 2;
      const y = 0.16 + rollR + l * rollR * 1.75;
      cylZ(rollR, rollLen, wrap, x, y, 0, 40);
      cylZ(rollR * 0.28, rollLen + 0.04, core, x, y, 0, 16);                    // uçlardan görünen karton göbek
      box(0.2, 0.12, 0.01, label, x, y + rollR - 0.1, rollLen / 2 + 0.003);
    }
  }
  // sabitleme bandı
  const topY = 0.16 + rollR + (layers - 1) * rollR * 1.75;
  box(cols * rollR * 2, 0.02, 0.05, band, 0, 0.16 + rollR * 2 * 0.0 + rollR + 0.0, rollLen / 2 + 0.02);
  return g;
}

demo(createFabricRollPallet());
