// @ts-nocheck
// Generated from the supplied mal kabul factories. Run scripts/importReceivingAssets.mjs to regenerate.
import * as THREE from "three";

// Source: 00_ortak.js
// MAL KABUL — ORTAK YARDIMCILAR (diğer mal-kabul dosyalarından ÖNCE yüklenmeli)
// Ölçek: 1 birim = 1 m, zemin y = 0.

function M(color, metalness = 0.5, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function kit(g) {
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };
  return {
    add,
    box: (w, h, d, mat, x, y, z, rx, ry, rz) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz),
    cylY: (r, h, mat, x, y, z, s = 32) => add(new THREE.CylinderGeometry(r, r, h, s), mat, x, y, z),
    cylX: (r, h, mat, x, y, z, s = 32) => add(new THREE.CylinderGeometry(r, r, h, s), mat, x, y, z, 0, 0, Math.PI / 2),
    cylZ: (r, h, mat, x, y, z, s = 32) => add(new THREE.CylinderGeometry(r, r, h, s), mat, x, y, z, Math.PI / 2, 0, 0),
  };
}

// canvas ile doku üretir: draw(ctx, w, h)
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Dosya tek başına çalıştırılınca nesneyi sahneye ekler; yerleşim dosyasında SKIP_DEMO = true yapılır


// Source: bekleme-kafesi.js
// MAL KABUL — "GEÇİCİ BEKLEME" TEL KAFES (00_ortak.js gerekir)
// Sarı çerçeveli, siyah tel kafesli bölme. Ön yüz (+Z) açık kapıdır; levha "KONTROL BEKLEYEN MALZEME".

export function createHoldingCage({ w = 7, d = 6, h = 2.0, signText = ['GEÇİCİ BEKLEME', 'KONTROL BEKLEYEN', 'MALZEME'] } = {}) {
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



// Source: bilgi-ekrani.js
// MAL KABUL — DUVAR BİLGİ EKRANI ("MAL KABUL" kabul listesi, 00_ortak.js gerekir)
// Ön yüz +Z. rows: [parti no, durum, renk]. Canvas dokusu emissive olarak parlar.

export function createInfoBoard({
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



// Source: duvar-paneli.js
// MAL KABUL — OLUKLU SAC DUVAR + MAVİ BANT + SARI KORUMALI KOLONLAR (00_ortak.js gerekir)
// Duvar X ekseni boyunca ortalanmıştır, iç yüz +Z yönüne bakar. Kolonlar iç yüzün önünde durur.

export function createWallSection({ length = 10, height = 6, columnEvery = 5 } = {}) {
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



// Source: isci.js
// MAL KABUL — İŞÇİ (beyaz baret, mavi reflektörlü yelek, 00_ortak.js gerekir)
// Yüz +Z yönüne bakar, boy ≈ 1.8 m. pose: 'stand' | 'walk' | 'type' | 'carry'

export function createWorker({ pose = 'stand', shirt = 0x1f3a6e, vest = 0x2f6fd0, helmet = 0xffffff } = {}) {
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
    leg.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.85, 12), pants), 0, -0.45, 0));
    leg.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), boot), 0, -0.89, 0.04));
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
    arm.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.56, 10), shirtM), 0, -0.28, 0));
    arm.add(placed(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin), 0, -0.58, 0));
  }
  // boyun, kafa, baret
  cylY(0.045, 0.08, skin, 0, 1.54, 0, 10);
  add(new THREE.SphereGeometry(0.105, 18, 14), skin, 0, 1.66, 0);
  add(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 1.68, 0);
  box(0.26, 0.015, 0.2, helm, 0, 1.685, 0.07);
  return g;
}



// Source: kabul-masasi.js
// MAL KABUL — KAYIT / BARKOD KABUL MASASI (00_ortak.js gerekir)
// Ön yüz (operatör) +Z tarafında. Çekmeceli tezgâh, 2 monitör, klavye, barkod yazıcı ve el okuyucu.

export function createReceptionDesk({ length = 4.5, monitors = 2 } = {}) {
  const g = new THREE.Group();
  const { add, box, cylY } = kit(g);
  const cabinet = M(0xe8e2d4, 0.1, 0.6), top = M(0xf6f6f4, 0.1, 0.4), dark = M(0x1b1d20, 0.5, 0.5);
  const steel = M(0xaab4be, 0.9, 0.3), grey = M(0x6a7078, 0.6, 0.5);
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1a2a, emissive: 0x2a7fb5, emissiveIntensity: 0.7 });
  const H = 0.75;

  // tezgâh: gövde, çekmeceler, tabla
  box(length, H, 0.7, cabinet, 0, H / 2, 0);
  for (let x = -length / 2 + 0.4; x < length / 2 - 0.2; x += 0.55) {
    box(0.5, 0.22, 0.02, grey, x, H - 0.25, 0.36);
    box(0.5, 0.22, 0.02, grey, x, H - 0.52, 0.36);
    box(0.12, 0.02, 0.03, steel, x, H - 0.17, 0.38);
  }
  box(length + 0.06, 0.04, 0.78, top, 0, H + 0.02, 0);
  box(length, 0.08, 0.05, dark, 0, 0.04, 0.34);                               // süpürgelik
  // arka tezgâh / yan ek
  box(1.6, H, 0.6, cabinet, -length / 2 + 0.8, H / 2, -0.7);
  box(1.66, 0.04, 0.66, top, -length / 2 + 0.8, H + 0.02, -0.7);

  // monitörler + klavyeler
  for (let i = 0; i < monitors; i++) {
    const x = -length / 2 + 1.0 + i * 1.3;
    box(0.55, 0.34, 0.03, dark, x, H + 0.4, -0.15);
    box(0.5, 0.29, 0.02, screen, x, H + 0.4, -0.13);
    cylY(0.02, 0.18, steel, x, H + 0.13, -0.15, 8);
    box(0.2, 0.015, 0.14, dark, x, H + 0.055, -0.15);
    box(0.4, 0.015, 0.14, dark, x, H + 0.055, 0.12);
  }
  // barkod yazıcı + el okuyucu + etiket rulosu
  box(0.3, 0.22, 0.28, dark, length / 2 - 0.9, H + 0.15, -0.05);
  box(0.26, 0.01, 0.1, M(0xffffff, 0, 0.9), length / 2 - 0.9, H + 0.27, 0.12);
  box(0.12, 0.05, 0.1, steel, length / 2 - 0.4, H + 0.07, 0.1);
  add(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 12), dark, length / 2 - 0.4, H + 0.14, 0.1, 0.5, 0, 0);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20), M(0xf2f2ee, 0, 0.8), length / 2 - 0.3, H + 0.07, -0.2, 0, 0, Math.PI / 2);
  // telefon
  box(0.16, 0.05, 0.2, dark, length / 2 - 1.5, H + 0.07, 0.0);
  return g;
}



// Source: kucuk-ekipman.js
// MAL KABUL — KÜÇÜK EKİPMANLAR (00_ortak.js gerekir)
// createPlanter: beton saksı + bitki | createSafetySign: uyarı / KKD levhası
// createElectricalCabinet: duvar elektrik panosu | createPendantLamp: sarkıt endüstriyel lamba

export function createPlanter({ length = 1.2, plants = 5 } = {}) {
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

export function createSafetySign({ type = 'warning', size = 0.6 } = {}) {
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

export function createElectricalCabinet({ w = 0.8, h = 1.2 } = {}) {
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

export function createPendantLamp({ drop = 1.0, color = 0x14181c } = {}) {
  const g = new THREE.Group();
  const { add, cylY } = kit(g);
  const shade = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 });
  cylY(0.012, drop, M(0x2b2f35, 0.6, 0.5), 0, drop / 2, 0, 8);                 // askı kablosu (ucu y = 0)
  add(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shade, 0, 0.0, 0);
  add(new THREE.CircleGeometry(0.15, 24), glow, 0, -0.01, 0, Math.PI / 2, 0, 0).rotation.x = Math.PI / 2;
  return g;
}


// Source: kumas-rulo-palet.js
// MAL KABUL — KUMAŞ RULO PALETİ (beyaz streç sarılı rulolar, piramit istif, 00_ortak.js gerekir)
// Rulolar Z ekseninde yatar. cols = alt sıradaki rulo sayısı, layers = kat sayısı.

export function createPallet({ w = 1.4, d = 1.25 } = {}) {
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

export function createFabricRollPallet({ cols = 3, layers = 2, rollR = 0.4, rollLen = 1.15 } = {}) {
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



// Source: sari-bariyer.js
// MAL KABUL — SARI-SİYAH GÜVENLİK ELEMANLARI (00_ortak.js gerekir)
// createBollard: sarı uyarı direği | createSafetyRail: sarı korkuluk | createWheelStop: tekerlek durdurucu

export function createBollard({ height = 1.0 } = {}) {
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

export function createSafetyRail({ length = 3, height = 1.0 } = {}) {
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

export function createWheelStop({ length = 1.2 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const rubber = M(0x111214, 0, 0.95), yellow = M(0xf2c200, 0.1, 0.6);
  box(length, 0.12, 0.2, rubber, 0, 0.06, 0);
  box(length * 0.2, 0.121, 0.201, yellow, -length * 0.35, 0.06, 0);
  box(length * 0.2, 0.121, 0.201, yellow, length * 0.35, 0.06, 0);
  return g;
}


// Source: tarama-kapisi.js
// MAL KABUL — "KUMAŞ TOPU GİRİŞİ" TARAMA KAPISI + KONVEYÖR (00_ortak.js gerekir)
// Konveyör X ekseninde, sarı portal Z'yi geçer. Yan direkte mavi ekranlı terminal.

export function createScanPortal({ conveyorLength = 6, gateX = 0 } = {}) {
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



// Source: tente-cati.js
// MAL KABUL — KAPALI TENTE / ÇATI (portal çelik çerçeve, 00_ortak.js gerekir)
// Duvar x = 0'dadır; çatı +X yönüne doğru alçalır, uzunluk +Z boyunca. Sarı korumalı lacivert kolonlar.

export function createCanopy({ length = 18, depth = 5.5, height = 5.5, columns = 4 } = {}) {
  const g = new THREE.Group();
  const { box } = kit(g);
  const roof = M(0x7c8794, 0.6, 0.4), navy = M(0x20252b, 0.6, 0.45), yellow = M(0xf2c200, 0.2, 0.5);
  const black = M(0x14181c, 0.4, 0.5), steel = M(0xaab4be, 0.9, 0.3);
  const light = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
  const rise = 0.8, a = Math.atan2(rise, depth), slope = Math.hypot(depth, rise);

  // çatı levhası + nervürler + saçak oluğu
  box(slope + 0.3, 0.1, length + 0.3, roof, depth / 2, height + rise / 2 + 0.1, length / 2, 0, 0, -a);
  for (let z = 0.3; z < length; z += 0.6) box(slope + 0.3, 0.04, 0.05, steel, depth / 2, height + rise / 2 + 0.17, z, 0, 0, -a);
  box(0.12, 0.15, length + 0.3, steel, depth + 0.1, height - 0.05, length / 2);
  box(0.25, 0.3, length, navy, depth, height - 0.05, length / 2);                  // saçak kirişi

  // kolonlar, sarı koruma, portal kirişi, köşe takviyesi
  const gap = length / (columns - 1);
  for (let i = 0; i < columns; i++) {
    const z = i * gap;
    box(0.35, height - 0.2, 0.35, navy, depth, (height - 0.2) / 2, z);
    box(0.46, 0.9, 0.46, yellow, depth, 0.45, z);
    for (let k = 0; k < 3; k++) box(0.48, 0.08, 0.48, black, depth, 0.15 + k * 0.28, z);
    box(slope, 0.3, 0.22, navy, depth / 2, height + rise / 2 - 0.1, z, 0, 0, -a);
    const dx = -0.9, dy = 0.85;
    box(Math.hypot(dx, dy), 0.12, 0.12, navy, depth - 0.45, height - 0.9 + dy / 2, z, 0, 0, Math.atan2(dy, dx));
  }
  // lineer LED armatürler
  for (let z = 1.5; z < length; z += 3.5) {
    box(0.2, 0.07, 2.0, light, depth - 1.6, height - 0.6, z);
    for (const dz of [-0.8, 0.8]) box(0.02, 0.85, 0.02, steel, depth - 1.6, height - 0.18, z + dz);
  }
  return g;
}



// Source: tir.js
// MAL KABUL — TIR (çekici + perdeli dorse), 00_ortak.js gerekir
// Öne bakan yön +X. Orijin = beşinci teker (kingpin). openFrac: dorse yan perdesinin açık kısmı (+Z yüzü).

export function createSemiTruck({ trailerLength = 13.6, openFrac = 0.55, loadRolls = true } = {}) {
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



// Source: zemin-cizgileri.js
// MAL KABUL — ZEMİN ÇİZGİLERİ VE İŞARETLERİ (00_ortak.js gerekir)
// Forklift şeridi (sarı), eğik yaya geçidi, yön okları, kesikli bekleme alanı, yaya piktogramı.
// Tüm düzlemler y ≈ 0.012'de, polygonOffset ile z-fighting önlenir.

export function createFloorMarkings({ w = 24, d = 16 } = {}) {
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



// Source: zemin-tartisi.js
// MAL KABUL — "KONTROL / TARTIM" ZEMİN TARTISI (00_ortak.js gerekir)
// Mavi platform, iki yanda rampa, üç kenarda sarı korkuluk, direkte yeşil kg göstergeli terminal.

export function createFloorScale({ size = 2.2, display = '1250.5 kg' } = {}) {
  const g = new THREE.Group();
  const { box, cylY } = kit(g);
  const blue = M(0x1f5fa8, 0.5, 0.45), plate = M(0x2b6fb8, 0.6, 0.4), yellow = M(0xf2c200, 0.2, 0.5);
  const steel = M(0xaab4be, 0.9, 0.3), dark = M(0x1b1d20, 0.6, 0.45);
  const D = size * 1.1, H = 0.14;

  // platform + ayarlı ayaklar + yükleme hücreleri
  box(size, H, D, blue, 0, H / 2 + 0.03, 0);
  box(size - 0.12, 0.03, D - 0.12, plate, 0, H + 0.045, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cylY(0.05, 0.05, steel, sx * (size / 2 - 0.15), 0.025, sz * (D / 2 - 0.15), 12);
  }
  // iki yan rampa
  for (const s of [-1, 1]) {
    const r = box(0.7, 0.04, D, steel, s * (size / 2 + 0.3), 0.07, 0, 0, 0, -s * 0.2);
    r.material = M(0x6a7078, 0.8, 0.45);
  }
  // sarı korkuluk (arka + iki yan; ön ve arka rampa tarafı açık)
  const rh = 0.95;
  for (const sz of [-1, 1]) {
    box(size, 0.05, 0.05, yellow, 0, H + rh, sz * (D / 2 - 0.05));
    box(size, 0.04, 0.04, yellow, 0, H + rh * 0.55, sz * (D / 2 - 0.05));
    for (const sx of [-1, 0, 1]) box(0.05, rh, 0.05, yellow, sx * (size / 2 - 0.05), H + rh / 2, sz * (D / 2 - 0.05));
  }
  // terminal direği + yeşil gösterge
  cylY(0.035, 1.3, steel, size / 2 - 0.1, 0.65, -D / 2 - 0.25, 12);
  box(0.4, 0.28, 0.1, dark, size / 2 - 0.1, 1.42, -D / 2 - 0.25, 0, 0.3, 0);
  const tex = canvasTex(256, 64, (c, W, Hh) => {
    c.fillStyle = '#031a08'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#4cff6e'; c.font = 'bold 40px monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(display, W / 2, Hh / 2 + 2);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }));
  face.position.set(size / 2 - 0.1 + 0.02, 1.46, -D / 2 - 0.19);
  face.rotation.y = 0.3;
  g.add(face);
  box(0.4, 0.04, 0.4, dark, size / 2 - 0.1, 0.02, -D / 2 - 0.25);
  return g;
}



function placed(mesh, x, y, z) { mesh.position.set(x,y,z); return mesh; }
