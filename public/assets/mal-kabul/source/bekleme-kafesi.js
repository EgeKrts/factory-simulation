// MAL KABUL — "GEÇİCİ BEKLEME" TEL KAFES (00_ortak.js gerekir)
// Sarı çerçeveli, siyah tel kafesli bölme. Ön yüz (+Z) açık kapıdır; levha "KONTROL BEKLEYEN MALZEME".

function createHoldingCage({ w = 7, d = 6, h = 2.0, signText = ['GEÇİCİ BEKLEME', 'KONTROL BEKLEYEN', 'MALZEME'] } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const yellow = M(0xf2c200, 0.2, 0.5), black = M(0x14181c, 0.4, 0.5);

  // tel kafes dokusu (şeffaf)
  const meshTex = canvasTex(128, 128, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.strokeStyle = '#14181c'; c.lineWidth = 5;
    for (let i = 0; i <= W; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(W, i); c.stroke(); }
  });
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  const panelMat = (pw) => {
    const t = meshTex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(pw / 0.18, h / 0.18);
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide });
  };
  const panel = (pw, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, h - 0.2), panelMat(pw));
    m.position.set(x, h / 2, z); m.rotation.y = ry; g.add(m);
  };

  // arka + iki yan duvar
  panel(w, 0, -d / 2, 0);
  panel(d, -w / 2, 0, Math.PI / 2);
  panel(d, w / 2, 0, Math.PI / 2);
  // ön: iki yarım panel, ortada kapı boşluğu
  const door = 2.4, side = (w - door) / 2;
  panel(side, -(door / 2 + side / 2), d / 2, 0);
  panel(side, (door / 2 + side / 2), d / 2, 0);

  // sarı çerçeve: köşe + ara direkler, üst ve alt kuşaklar
  const posts = [];
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4) { posts.push([x, -d / 2]); }
  for (const z of [-d / 4, 0, d / 4]) posts.push([-w / 2, z], [w / 2, z]);
  posts.push([-w / 2, d / 2], [-door / 2, d / 2], [door / 2, d / 2], [w / 2, d / 2]);
  for (const [x, z] of posts) box(0.07, h, 0.07, yellow, x, h / 2, z);
  for (const y of [0.1, h - 0.05]) {
    box(w, 0.06, 0.06, yellow, 0, y, -d / 2);
    box(0.06, 0.06, d, yellow, -w / 2, y, 0);
    box(0.06, 0.06, d, yellow, w / 2, y, 0);
    box(side, 0.06, 0.06, yellow, -(door / 2 + side / 2), y, d / 2);
    box(side, 0.06, 0.06, yellow, (door / 2 + side / 2), y, d / 2);
  }
  box(door, 0.06, 0.06, yellow, 0, h - 0.05, d / 2);                       // kapı üst kuşağı

  // zemin içi kesikli sarı çerçeve
  const dash = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const seg = (x, z, sw, sd) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), dash); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); g.add(m); };
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.5; x += 1.0) { seg(x, -d / 2 + 0.5, 0.6, 0.1); seg(x, d / 2 - 0.5, 0.6, 0.1); }
  for (let z = -d / 2 + 0.6; z < d / 2 - 0.5; z += 1.0) { seg(-w / 2 + 0.5, z, 0.1, 0.6); seg(w / 2 - 0.5, z, 0.1, 0.6); }

  // levha
  const sign = canvasTex(512, 320, (c, W, H) => {
    c.fillStyle = '#f2c200'; c.fillRect(0, 0, W, 110);
    c.fillStyle = '#14181c'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(signText[0], W / 2, 58);
    c.fillStyle = '#ffffff'; c.fillRect(0, 110, W, H - 110);
    c.fillStyle = '#14181c'; c.font = 'bold 54px sans-serif';
    c.fillText(signText[1], W / 2, 180); c.fillText(signText[2], W / 2, 250);
    c.strokeStyle = '#14181c'; c.lineWidth = 8; c.strokeRect(4, 4, W - 8, H - 8);
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 }));
  plane.position.set(door / 2 + 0.9, 1.1, d / 2 + 0.06);
  g.add(plane);
  return g;
}

demo(createHoldingCage());
