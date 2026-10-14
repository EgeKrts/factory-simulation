// MAL KABUL — YERLEŞİM (hedef görseldeki sahneyi kurar)
//
// KULLANIM — tek script ortamında dosyaları şu sırayla yapıştır:
//   1) bu dosyanın ilk satırı:   globalThis.SKIP_DEMO = true;
//   2) 00_ortak.js
//   3) tir, tente-cati, kabul-masasi, bilgi-ekrani, tarama-kapisi, zemin-tartisi, kumas-rulo-palet,
//      bekleme-kafesi, sari-bariyer, zemin-cizgileri, isci, duvar-paneli, kucuk-ekipman
//      (isteğe bağlı: önceki assets/10_forklift.js — içindeki `const M = ...` ve `function kit` satırlarını sil)
//   4) bu dosyanın geri kalanı
//
// Koordinatlar: x sağa, z kameraya doğru, y yukarı. Salon 40 × 28 m (x: -20..20, z: -14..14).
// Sol duvar (x = -20) ve arka duvar (z = -14) var, çatı açık.

globalThis.SKIP_DEMO = true;

const put = (obj, x, z, ry = 0, y = 0) => {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  root.add(obj);
  return obj;
};

// ---- kabuk: duvarlar + tente ----
put(createWallSection({ length: 40, height: 6, columnEvery: 5 }), 0, -14);                  // arka duvar
put(createWallSection({ length: 28, height: 6, columnEvery: 7 }), -20, 0, Math.PI / 2);     // sol duvar (iç yüz +X)
put(createCanopy({ length: 18, depth: 5.5, height: 5.5, columns: 4 }), -20, -14);           // sol duvara bitişik kapalı tente

// ---- kayıt / barkod kabul (tentenin altında) ----
put(createReceptionDesk({ length: 4.5, monitors: 2 }), -18.9, -6, Math.PI / 2);
put(createInfoBoard(), -19.85, -9, Math.PI / 2, 3.2);
put(createWorker({ pose: 'type' }), -17.6, -6.5, Math.PI / 2);
put(createWorker({ pose: 'stand' }), -16.2, -1.5, Math.PI);
put(createPlanter({ length: 1.2 }), -18.8, -12.5, Math.PI / 2);
put(createPlanter({ length: 1.2 }), -18.8, 2.5, Math.PI / 2);

// ---- kumaş topu girişi: tarama kapısı + konveyör ----
put(createScanPortal({ conveyorLength: 6, gateX: 0.5 }), -8, -3);
put(createFabricRollPallet({ cols: 3, layers: 2 }), -10.5, 1.5, 0.3);                      // konveyör girişinde bekleyen palet

// ---- kontrol / tartım ----
put(createFloorScale({ size: 2.2, display: '1250.5 kg' }), 5, -5);
put(createFabricRollPallet({ cols: 2, layers: 2 }), 5, -5, 0, 0.18);                        // tartıdaki palet
put(createWorker({ pose: 'carry' }), 6.8, -4.6, -Math.PI / 2);

// ---- geçici bekleme (tel kafes + paletler) ----
put(createHoldingCage({ w: 7, d: 6, h: 2.0 }), 15, -4);
put(createFabricRollPallet({ cols: 3, layers: 2 }), 13.5, -5, 0.1);
put(createFabricRollPallet({ cols: 3, layers: 2 }), 16.5, -3, -0.1);

// ---- depolama paletleri (ön sağ) ----
[[6, 8, -0.5], [10, 10, -0.5], [14, 6.5, -0.5]].forEach(([x, z, r]) =>
  put(createFabricRollPallet({ cols: 3, layers: 3 }), x, z, r));

// ---- forklift + palet ----
if (typeof createForklift === 'function') {
  put(createForklift({ forkY: 0.2 }), -2, 4, 0);
  put(createFabricRollPallet({ cols: 2, layers: 1 }), 0.1, 4, 0, 0.2);
}

// ---- tır (kabin +Z yönünde, açık perde tarafı +X'e bakar) ----
const truck = createSemiTruck({ openFrac: 0.55, loadRolls: true });
truck.scale.z = -1;
truck.rotation.y = -Math.PI / 2;
truck.position.set(-12.5, 0, 24);
root.add(truck);
put(createWorker({ pose: 'stand' }), -9.8, 11, -Math.PI / 2);                               // yükü kontrol eden işçi

// ---- yer çizgileri ----
put(createFloorMarkings({ w: 24, d: 16 }), 2, 4);

// ---- güvenlik: bariyer direkleri ----
[[-14, 6], [-14, 12], [-4, 10], [-4, 14], [8, 13], [18, 8], [18, 1], [-15, -12], [-4, -12], [10, -12]]
  .forEach(([x, z]) => put(createBollard({ height: 1.0 }), x, z));
put(createSafetyRail({ length: 3 }), -3, -7, 0);

// ---- duvar ekipmanı: levhalar, pano, sarkıt lambalar ----
put(createSafetySign({ type: 'warning' }), 6, -13.85, 0, 1.7);
put(createSafetySign({ type: 'ppe' }), 7.2, -13.85, 0, 1.7);
put(createElectricalCabinet(), 3, -13.75);
for (let x = -16; x <= 16; x += 6) put(createPendantLamp({ drop: 0.8 }), x, -12.8, 0, 5.3);

helpers.enableShadows(root);
