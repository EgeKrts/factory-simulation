import type { Layout } from './types';

/** Kamuya açık yolun yeni konumu ve fabrika güney sınırı (idari bina sınır içine alınır). */
export const ADMIN_PUBLIC_Z = 128;
const OLD_PUBLIC_Z = 103, SOUTH_EDGE = 119;

/**
 * İdari bina için fabrika sınırını güneye genişletir: zemin alanı, giriş yolu, kamuya açık yol ve giriş meydanı.
 * Kayıtlı yerleşimlerde yalnızca bir kez uygulanır; kullanıcı düzenlemeleri korunur.
 */
export function upgradeAdmin(input: Layout): Layout {
  if (input.adminRevision === 1 || !input.roads || !input.outdoors) return input;
  const l = structuredClone(input);
  l.adminRevision = 1;
  const north = l.floor.center[1] - l.floor.size[1] / 2, south = Math.max(l.floor.center[1] + l.floor.size[1] / 2, SOUTH_EDGE);
  l.floor = { center: [l.floor.center[0], (north + south) / 2], size: [l.floor.size[0], south - north] };
  for (const id of ['entry', 'public']) {
    const road = l.roads!.find((r) => r.id === id);
    if (road) road.points = road.points.map(([x, z]) => [x, z >= OLD_PUBLIC_Z ? ADMIN_PUBLIC_Z : z]);
  }
  if (!l.outdoors!.some((o) => o.id === 'admin-yard')) l.outdoors!.push({ id: 'admin-yard', name: 'Yönetim giriş meydanı', center: [-15, 109.5], size: [60, 6], kind: 'yard' });
  return l;
}
