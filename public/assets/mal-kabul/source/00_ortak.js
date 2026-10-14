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
  t.anisotropy = 4;
  return t;
}

// Dosya tek başına çalıştırılınca nesneyi sahneye ekler; yerleşim dosyasında SKIP_DEMO = true yapılır
function demo(obj) {
  if (!globalThis.SKIP_DEMO) {
    root.add(obj);
    helpers.enableShadows(root);
  }
  return obj;
}
