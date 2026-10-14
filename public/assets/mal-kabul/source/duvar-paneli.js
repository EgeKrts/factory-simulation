// MAL KABUL — OLUKLU SAC DUVAR + MAVİ BANT + SARI KORUMALI KOLONLAR (00_ortak.js gerekir)
// Duvar X ekseni boyunca ortalanmıştır, iç yüz +Z yönüne bakar. Kolonlar iç yüzün önünde durur.

function createWallSection({ length = 10, height = 6, columnEvery = 5 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const plinth = M(0x5a5f66, 0.5, 0.6), blue = M(0x2f5f9a, 0.3, 0.5), blueLight = M(0x5b8cc4, 0.3, 0.5);
  const navy = M(0x20252b, 0.6, 0.45), yellow = M(0xf2c200, 0.2, 0.5), black = M(0x14181c, 0.4, 0.5);
  const cap = M(0xb4b9bd, 0.6, 0.4);

  // oluklu sac dokusu
  const tex = canvasTex(256, 64, (c, W, H) => {
    for (let x = 0; x < W; x += 16) {
      c.fillStyle = '#d9dcd9'; c.fillRect(x, 0, 8, H);
      c.fillStyle = '#c0c3c0'; c.fillRect(x + 8, 0, 8, H);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(length / 0.5, 1);
  const wall = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.35 });

  box(length, height, 0.14, wall, 0, height / 2, 0);
  box(length, 0.5, 0.17, plinth, 0, 0.25, 0.01);                              // taban kuşağı
  box(length + 0.02, 0.42, 0.17, blue, 0, height * 0.58, 0.01);               // mavi bant
  box(length + 0.02, 0.1, 0.17, blueLight, 0, height * 0.58 - 0.3, 0.01);     // ince açık mavi şerit
  box(length + 0.1, 0.12, 0.22, cap, 0, height + 0.06, 0);                    // üst başlık

  // kolonlar + sarı-siyah tabanlı koruma
  for (let x = -length / 2; x <= length / 2 + 0.01; x += columnEvery) {
    box(0.3, height + 0.4, 0.3, navy, x, (height + 0.4) / 2, 0.22);
    box(0.42, 0.9, 0.42, yellow, x, 0.45, 0.22);
    for (let k = 0; k < 3; k++) box(0.44, 0.08, 0.44, black, x, 0.15 + k * 0.28, 0.22);
  }
  return g;
}

demo(createWallSection());
