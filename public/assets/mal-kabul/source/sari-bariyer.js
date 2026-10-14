// MAL KABUL — SARI-SİYAH GÜVENLİK ELEMANLARI (00_ortak.js gerekir)
// createBollard: sarı uyarı direği | createSafetyRail: sarı korkuluk | createWheelStop: tekerlek durdurucu

function createBollard({ height = 1.0 } = {}) {
  const g = new THREE.Group();
  const { cylY } = kit(g);
  const yellow = M(0xf2c200, 0.2, 0.5), black = M(0x14181c, 0.4, 0.5), steel = M(0x8c949b, 0.8, 0.4);
  cylY(0.1, 0.04, steel, 0, 0.02, 0, 24);                                    // taban plakası
  cylY(0.07, height, yellow, 0, height / 2 + 0.04, 0, 24);
  cylY(0.0705, 0.12, black, 0, height * 0.55, 0, 24);                        // siyah bant
  cylY(0.0705, 0.12, black, 0, height * 0.82, 0, 24);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), yellow);
  cap.position.y = height + 0.04;
  g.add(cap);
  return g;
}

function createSafetyRail({ length = 3, height = 1.0 } = {}) {
  const g = new THREE.Group();
  const { box, cylX, cylY } = kit(g);
  const yellow = M(0xf2c200, 0.2, 0.5), black = M(0x14181c, 0.4, 0.5), steel = M(0x8c949b, 0.8, 0.4);
  const posts = Math.max(2, Math.round(length / 1.5) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (i * length) / (posts - 1);
    box(0.06, height, 0.06, yellow, x, height / 2, 0);
    box(0.22, 0.02, 0.22, steel, x, 0.01, 0);
    for (const dx of [-0.08, 0.08]) for (const dz of [-0.08, 0.08]) cylY(0.012, 0.025, black, x + dx, 0.03, dz, 8);
  }
  cylX(0.025, length, yellow, 0, height - 0.05, 0, 16);                       // üst korkuluk
  cylX(0.02, length, yellow, 0, height * 0.55, 0, 16);                        // orta korkuluk
  box(length, 0.12, 0.02, yellow, 0, 0.1, 0);                                 // süpürgelik
  return g;
}

function createWheelStop({ length = 1.2 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const rubber = M(0x111214, 0, 0.95), yellow = M(0xf2c200, 0.1, 0.6);
  box(length, 0.12, 0.2, rubber, 0, 0.06, 0);
  box(length * 0.2, 0.121, 0.201, yellow, -length * 0.35, 0.06, 0);
  box(length * 0.2, 0.121, 0.201, yellow, length * 0.35, 0.06, 0);
  return g;
}

(function () {
  const g = new THREE.Group();
  const b = createBollard(); b.position.set(-1, 0, 0); g.add(b);
  const r = createSafetyRail(); r.position.set(1.5, 0, 0); g.add(r);
  const w = createWheelStop(); w.position.set(0, 0, 1.2); g.add(w);
  demo(g);
})();
