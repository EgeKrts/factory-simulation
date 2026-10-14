// MAL KABUL — DUVAR BİLGİ EKRANI ("MAL KABUL" kabul listesi, 00_ortak.js gerekir)
// Ön yüz +Z. rows: [parti no, durum, renk]. Canvas dokusu emissive olarak parlar.

function createInfoBoard({
  w = 2.6, h = 1.5, title = 'MAL KABUL',
  rows = [
    ['KB-1024', 'Kabul Edildi', '#4cd964'],
    ['KB-1025', 'Kabul Edildi', '#4cd964'],
    ['KB-1026', 'İşlemde', '#ffb300'],
    ['KB-1027', 'Kabul Edildi', '#4cd964'],
  ],
} = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const dark = M(0x14181c, 0.6, 0.4), steel = M(0xaab4be, 0.9, 0.3);

  const tex = canvasTex(1024, 600, (c, W, H) => {
    c.fillStyle = '#06142e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0d3b8e'; c.fillRect(0, 0, W, 110);
    c.fillStyle = '#ffffff'; c.font = 'bold 70px sans-serif';
    c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillText(title, W / 2, 58);
    c.textAlign = 'left'; c.font = 'bold 54px sans-serif';
    rows.forEach(([id, status, col], i) => {
      const y = 190 + i * 110;
      c.fillStyle = '#e8eef8'; c.fillText(id, 60, y);
      c.fillStyle = col; c.fillText(status, 420, y);
      c.fillStyle = '#16315f'; c.fillRect(40, y + 48, W - 80, 3);
    });
  });
  const screenMat = new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.4
  });

  box(w + 0.1, h + 0.1, 0.08, dark, 0, 0, 0);                                  // çerçeve
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
  face.position.z = 0.045;
  g.add(face);
  // duvar braketi
  box(0.5, 0.08, 0.3, steel, 0, h / 2 + 0.1, -0.15);
  box(0.08, 0.08, 0.3, steel, -w / 3, h / 2 + 0.05, -0.15);
  box(0.08, 0.08, 0.3, steel, w / 3, h / 2 + 0.05, -0.15);
  return g;
}

demo(createInfoBoard());
