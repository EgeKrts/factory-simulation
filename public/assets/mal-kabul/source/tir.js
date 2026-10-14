// MAL KABUL — TIR (çekici + perdeli dorse), 00_ortak.js gerekir
// Öne bakan yön +X. Orijin = beşinci teker (kingpin). openFrac: dorse yan perdesinin açık kısmı (+Z yüzü).

function createSemiTruck({ trailerLength = 13.6, openFrac = 0.55, loadRolls = true } = {}) {
  const g = new THREE.Group();
  const { box, cylX, cylY, cylZ } = kit(g);
  const white = M(0xf4f5f6, 0.3, 0.5), grey = M(0xdfe2e5, 0.3, 0.5), dark = M(0x1b1d20, 0.6, 0.45);
  const steel = M(0x8c949b, 0.9, 0.3), glass = M(0x20323c, 0.9, 0.1), tire = M(0x0f1012, 0, 0.9);
  const roll = M(0xf2f2ee, 0, 0.9), core = M(0xc8a06a, 0, 0.9);
  const red = new THREE.MeshStandardMaterial({ color: 0xd91f1f, emissive: 0xd91f1f, emissiveIntensity: 0.5 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xfff2b0, emissiveIntensity: 0.6 });
  const W = 2.5;
  const wheel = (x, z) => { cylZ(0.5, 0.28, tire, x, 0.5, z, 32); cylZ(0.26, 0.3, steel, x, 0.5, z, 16); };

  // ----- çekici -----
  box(5.6, 0.3, 0.9, dark, 1.4, 0.85, 0);
  cylY(0.5, 0.1, steel, 0, 1.08, 0, 32);
  box(2.3, 2.3, 2.45, white, 3.0, 2.2, 0);                           // kabin
  box(0.9, 0.55, 2.4, white, 2.2, 3.55, 0, 0, 0, -0.25);             // rüzgâr deflektörü
  box(0.06, 1.0, 2.2, glass, 4.17, 2.7, 0, 0, 0, -0.12);             // ön cam
  box(0.14, 0.7, 2.2, dark, 4.2, 1.45, 0);                           // ızgara
  box(0.2, 0.25, 2.4, dark, 4.25, 0.95, 0);                          // tampon
  for (const s of [-1, 1]) {
    box(1.1, 0.8, 0.05, glass, 3.4, 2.7, s * 1.24);                  // yan cam
    box(0.12, 0.4, 0.2, dark, 4.0, 2.8, s * 1.36);                   // ayna
    box(0.1, 0.18, 0.45, lamp, 4.22, 1.55, s * 0.8);                 // far
    cylX(0.28, 1.0, steel, 1.3, 0.95, s * 1.2);                      // yakıt deposu
    box(0.5, 0.1, 0.25, dark, 3.2, 1.0, s * 1.3);                    // basamak
  }
  wheel(3.4, 1.05); wheel(3.4, -1.05);                               // ön aks
  for (const x of [0.5, -0.8]) for (const s of [-1, 1]) { wheel(x, s * 0.8); wheel(x, s * 1.12); }   // çekici çift aks

  // ----- dorse -----
  const L = trailerLength, tx0 = -0.2, cx = tx0 - L / 2, fy = 1.25;
  box(L, 0.14, W, dark, cx, fy, 0);
  for (const s of [-1, 1]) box(L, 0.22, 0.1, steel, cx, fy - 0.15, s * 0.9);
  box(0.08, 2.7, W, grey, tx0 - 0.04, fy + 1.4, 0);                  // ön duvar
  box(L, 0.08, W, white, cx, fy + 2.75, 0);                           // tavan
  for (const x of [tx0 - 0.05, tx0 - L + 0.05]) for (const s of [-1, 1]) box(0.1, 2.7, 0.1, steel, x, fy + 1.4, s * (W / 2 - 0.05));
  box(L, 2.6, 0.05, white, cx, fy + 1.4, -W / 2 + 0.03);             // sol perde (kapalı)
  const closed = L * (1 - openFrac);
  box(closed, 2.6, 0.05, white, tx0 - L + closed / 2, fy + 1.4, W / 2 - 0.03);   // sağ perde (arka kısım kapalı)
  for (let x = tx0 - 0.6; x > tx0 - L + 0.2; x -= 0.9) {
    box(0.03, 2.6, 0.06, steel, x, fy + 1.4, -W / 2 + 0.03);
    if (x < tx0 - L + closed) box(0.03, 2.6, 0.06, steel, x, fy + 1.4, W / 2 - 0.03);
  }
  for (const s of [-1, 1]) box(L - 6, 0.35, 0.04, white, cx + 1.0, fy - 0.3, s * (W / 2));   // etek
  // içindeki rulolar (açık bölgede)
  if (loadRolls) {
    for (let x = tx0 - 0.5; x > tx0 - L + closed + 0.3; x -= 0.95) {
      for (let l = 0; l < 2; l++) for (const z of [-0.6, 0.6]) {
        cylZ(0.43, 1.15, roll, x, fy + 0.07 + 0.43 + l * 0.85, z, 24);
        cylZ(0.12, 1.17, core, x, fy + 0.07 + 0.43 + l * 0.85, z, 12);
      }
    }
  }
  // dorse aksları, ayaklar, arka ışıklar
  for (const dx of [1.4, 2.7, 4.0]) for (const s of [-1, 1]) { wheel(tx0 - L + dx, s * 0.8); wheel(tx0 - L + dx, s * 1.12); }
  for (const s of [-1, 1]) {
    box(0.1, 0.9, 0.1, steel, tx0 - 2.2, 0.7, s * 0.9);
    box(0.05, 0.2, 0.3, red, tx0 - L - 0.02, fy + 0.1, s * 1.0);
  }
  box(0.12, 0.25, W, dark, tx0 - L - 0.05, 0.9, 0);                  // arka tampon
  return g;
}

demo(createSemiTruck());
