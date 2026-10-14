// MAL KABUL — İŞÇİ (beyaz baret, mavi reflektörlü yelek, 00_ortak.js gerekir)
// Yüz +Z yönüne bakar, boy ≈ 1.8 m. pose: 'stand' | 'walk' | 'type' | 'carry'

function createWorker({ pose = 'stand', shirt = 0x1f3a6e, vest = 0x2f6fd0, helmet = 0xffffff } = {}) {
  const g = new THREE.Group();
  const { add, box, cylY } = kit(g);
  const skin = M(0xe0b090, 0, 0.8), shirtM = M(shirt, 0, 0.9), vestM = M(vest, 0, 0.8);
  const pants = M(0x2b3140, 0, 0.9), boot = M(0x1b1d20, 0, 0.8), helm = M(helmet, 0.2, 0.4);
  const stripe = M(0xdfe6ea, 0.6, 0.3);
  const pivot = (x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); return p; };

  // bacaklar (kalça pivotu) + botlar
  const swing = pose === 'walk' ? 0.35 : 0;
  for (const s of [-1, 1]) {
    const leg = pivot(s * 0.1, 0.92, 0);
    leg.rotation.x = s * swing;
    leg.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.85, 12), pants), { position: new THREE.Vector3(0, -0.45, 0) }));
    leg.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), boot), { position: new THREE.Vector3(0, -0.89, 0.04) }));
  }
  // gövde + yelek + reflektör şeritleri
  box(0.34, 0.58, 0.22, shirtM, 0, 1.2, 0);
  box(0.36, 0.5, 0.24, vestM, 0, 1.22, 0);
  box(0.37, 0.04, 0.25, stripe, 0, 1.12, 0);
  box(0.37, 0.04, 0.25, stripe, 0, 1.32, 0);
  // kollar (omuz pivotu)
  const armX = pose === 'type' ? -1.15 : pose === 'carry' ? -0.95 : 0;
  for (const s of [-1, 1]) {
    const arm = pivot(s * 0.22, 1.43, 0);
    arm.rotation.x = pose === 'walk' ? -s * swing : armX;
    arm.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.56, 10), shirtM), { position: new THREE.Vector3(0, -0.28, 0) }));
    arm.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin), { position: new THREE.Vector3(0, -0.58, 0) }));
  }
  // boyun, kafa, baret
  cylY(0.045, 0.08, skin, 0, 1.54, 0, 10);
  add(new THREE.SphereGeometry(0.105, 18, 14), skin, 0, 1.66, 0);
  add(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 1.68, 0);
  box(0.26, 0.015, 0.2, helm, 0, 1.685, 0.07);
  return g;
}

demo(createWorker());
