// MAL KABUL — KÜÇÜK EKİPMANLAR (00_ortak.js gerekir)
// createPlanter: beton saksı + bitki | createSafetySign: uyarı / KKD levhası
// createElectricalCabinet: duvar elektrik panosu | createPendantLamp: sarkıt endüstriyel lamba

function createPlanter({ length = 1.2, plants = 5 } = {}) {
  const g = new THREE.Group();
  const { add, box } = kit(g);
  const concrete = M(0xbfc1bf, 0.1, 0.9), soil = M(0x3b2f26, 0, 1.0);
  const greens = [0x2f6a2b, 0x3a7a30, 0x4f8a35, 0x5d9b3c];
  box(length, 0.55, 0.5, concrete, 0, 0.275, 0);
  box(length - 0.1, 0.02, 0.4, soil, 0, 0.55, 0);
  for (let i = 0; i < plants; i++) {
    const x = -length / 2 + 0.2 + (i * (length - 0.4)) / Math.max(plants - 1, 1);
    const h = 0.5 + (i % 3) * 0.2;
    add(new THREE.ConeGeometry(0.12 + (i % 2) * 0.03, h, 8), M(greens[i % greens.length], 0, 0.9), x, 0.55 + h / 2, (i % 2 ? 0.05 : -0.05));
    add(new THREE.SphereGeometry(0.12, 10, 8), M(greens[(i + 1) % greens.length], 0, 0.9), x + 0.08, 0.7, 0.05);
  }
  return g;
}

function createSafetySign({ type = 'warning', size = 0.6 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const tex = canvasTex(256, 256, (c, W, H) => {
    if (type === 'warning') {
      c.fillStyle = '#f2c200'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#14181c'; c.beginPath(); c.moveTo(W / 2, 30); c.lineTo(W - 30, H - 40); c.lineTo(30, H - 40); c.closePath();
      c.lineWidth = 14; c.strokeStyle = '#14181c'; c.stroke();
      c.font = 'bold 130px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', W / 2, H / 2 + 28);
    } else {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#1559b8'; c.beginPath(); c.arc(W / 2, H / 2, 108, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(W / 2, H / 2 + 8, 52, Math.PI, 0); c.fill();                         // baret
      c.fillRect(W / 2 - 62, H / 2 + 6, 124, 14);
      c.beginPath(); c.arc(W / 2, H / 2 + 70, 20, 0, Math.PI * 2); c.fill();                      // kafa
    }
  });
  box(size + 0.04, size + 0.04, 0.03, M(0x14181c, 0.3, 0.6), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  face.position.z = 0.017;
  g.add(face);
  return g;
}

function createElectricalCabinet({ w = 0.8, h = 1.2 } = {}) {
  const g = new THREE.Group();
  const { add, box, cylY } = kit(g);
  const grey = M(0xb9bec2, 0.5, 0.5), dark = M(0x2b2f35, 0.6, 0.5), steel = M(0xaab4be, 0.9, 0.3);
  const lamp = new THREE.MeshStandardMaterial({ color: 0x22d65a, emissive: 0x22d65a, emissiveIntensity: 0.9 });
  box(w, h, 0.28, grey, 0, h / 2, 0);
  box(w - 0.1, h - 0.1, 0.02, M(0xc9cdd1, 0.5, 0.5), 0, h / 2, 0.15);          // kapı
  box(0.03, 0.2, 0.04, dark, w / 2 - 0.12, h / 2, 0.18);                       // kol
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), lamp, -w / 2 + 0.15, h - 0.15, 0.17, Math.PI / 2, 0, 0);
  box(0.28, 0.14, 0.01, M(0xf2c200, 0, 0.6), 0, h - 0.3, 0.165);               // uyarı etiketi
  for (const s of [-1, 1]) cylY(0.03, 0.15, steel, s * (w / 2 - 0.12), h + 0.07, 0, 10);   // kablo girişi
  return g;
}

function createPendantLamp({ drop = 1.0, color = 0x14181c } = {}) {
  const g = new THREE.Group();
  const { add, cylY } = kit(g);
  const shade = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 });
  cylY(0.012, drop, M(0x2b2f35, 0.6, 0.5), 0, drop / 2, 0, 8);                 // askı kablosu (ucu y = 0)
  add(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shade, 0, 0.0, 0);
  add(new THREE.CircleGeometry(0.15, 24), glow, 0, -0.01, 0, Math.PI / 2, 0, 0).rotation.x = Math.PI / 2;
  return g;
}

(function () {
  const g = new THREE.Group();
  const p = createPlanter(); p.position.set(-2, 0, 0); g.add(p);
  const s1 = createSafetySign({ type: 'warning' }); s1.position.set(-0.8, 1.5, 0); g.add(s1);
  const s2 = createSafetySign({ type: 'ppe' }); s2.position.set(0, 1.5, 0); g.add(s2);
  const c = createElectricalCabinet(); c.position.set(1.2, 0, 0); g.add(c);
  const l = createPendantLamp(); l.position.set(2.5, 2.5, 0); g.add(l);
  demo(g);
})();
