// MAL KABUL — ZEMİN ÇİZGİLERİ VE İŞARETLERİ (00_ortak.js gerekir)
// Forklift şeridi (sarı), eğik yaya geçidi, yön okları, kesikli bekleme alanı, yaya piktogramı.
// Tüm düzlemler y ≈ 0.012'de, polygonOffset ile z-fighting önlenir.

function createFloorMarkings({ w = 24, d = 16 } = {}) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const yellow = mat(0xf2c200), white = mat(0xf4f4f0), green = mat(0x2f9e5b);

  const put = (geo, m, x, z, rot = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.set(-Math.PI / 2, 0, rot);
    mesh.position.set(x, 0.012, z);
    g.add(mesh);
    return mesh;
  };
  const line = (x, z, len, wd, m = yellow, rot = 0) => put(new THREE.PlaneGeometry(len, wd), m, x, z, rot);

  // forklift şeridi (iki sarı çizgi) + beyaz kesik orta çizgi
  line(0, -1.8, w, 0.12);
  line(0, 1.8, w, 0.12);
  for (let x = -w / 2 + 1; x < w / 2 - 0.9; x += 2) line(x, 0, 1.0, 0.1, white);

  // yön okları
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.6, 0.12); arrow.lineTo(0.1, 0.12); arrow.lineTo(0.1, 0.32); arrow.lineTo(0.65, 0);
  arrow.lineTo(0.1, -0.32); arrow.lineTo(0.1, -0.12); arrow.lineTo(-0.6, -0.12); arrow.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrow);
  for (const x of [-w / 4, w / 4]) { put(arrowGeo, yellow, x, -0.9); put(arrowGeo, yellow, x, 0.9, Math.PI); }

  // eğik sarı şeritli yaya geçidi
  const cx = -w / 2 + 4.5;
  for (let i = 0; i < 9; i++) line(cx + i * 0.55, 0, 0.3, 3.4, yellow, 0.0).rotation.z = 0.55;

  // yeşil yaya yolu + beyaz kenar çizgileri + piktogram
  const pz = d / 2 - 1.2;
  line(0, pz, w - 1, 1.0, green);
  line(0, pz - 0.55, w - 1, 0.08, white);
  line(0, pz + 0.55, w - 1, 0.08, white);
  const ped = canvasTex(128, 128, (c, W, H) => {
    c.clearRect(0, 0, W, H); c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.arc(64, 26, 14, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(64, 44); c.lineTo(64, 84); c.moveTo(64, 56); c.lineTo(36, 74); c.moveTo(64, 56); c.lineTo(92, 74);
    c.moveTo(64, 84); c.lineTo(42, 116); c.moveTo(64, 84); c.lineTo(88, 116); c.stroke();
  });
  const icon = new THREE.MeshStandardMaterial({ map: ped, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (let x = -w / 2 + 3; x < w / 2 - 2; x += 6) put(new THREE.PlaneGeometry(0.7, 0.7), icon, x, pz, -Math.PI / 2);

  // kesikli bekleme / palet alanı çerçeveleri
  const bay = (x, z, bw, bd) => {
    for (let a = -bw / 2 + 0.3; a < bw / 2 - 0.2; a += 0.7) { line(x + a, z - bd / 2, 0.45, 0.1); line(x + a, z + bd / 2, 0.45, 0.1); }
    for (let b = -bd / 2 + 0.3; b < bd / 2 - 0.2; b += 0.7) { line(x - bw / 2, z + b, 0.1, 0.45); line(x + bw / 2, z + b, 0.1, 0.45); }
  };
  bay(w / 4, -d / 2 + 2.6, 5, 3.2);
  bay(w / 4 + 6, -d / 2 + 2.6, 5, 3.2);

  // durma çizgisi
  line(-w / 2 + 1.2, 0, 0.3, 3.6, white);
  return g;
}

demo(createFloorMarkings());
