import type { LotKind, Point2 } from './types';
import { pathLength, samplePath } from './routes';

export type CarrierKind = 'forklift' | 'fabric_cart' | 'trolley';
export const PICKUP_SECONDS = 6;
export const UNLOAD_SECONDS = 6;
export function carrierKind(kind: LotKind, external: boolean): CarrierKind {
  if (external || kind === 'pallet') return 'forklift';
  return ['raw_roll', 'finished_roll', 'dyed_batch'].includes(kind) ? 'fabric_cart' : 'trolley';
}
export const transportSpeed = (kind: CarrierKind) => kind === 'forklift' ? 2.2 : 1.2;
export function transferDuration(route: Point2[], kind: CarrierKind): number {
  return PICKUP_SECONDS + pathLength(route) / transportSpeed(kind) + UNLOAD_SECONDS;
}
export function transferPose(route: Point2[], kind: CarrierKind, progress: number) {
  const duration = transferDuration(route, kind);
  const elapsed = Math.min(1, Math.max(0, progress)) * duration;
  const travel = pathLength(route) / transportSpeed(kind);
  const pathProgress = Math.max(0, Math.min(1, (elapsed - PICKUP_SECONDS) / Math.max(0.001, travel)));
  const phase = elapsed < PICKUP_SECONDS ? 'pickup' : elapsed < PICKUP_SECONDS + travel ? 'travel' : 'unload';
  const lift = phase === 'pickup' ? elapsed / PICKUP_SECONDS : phase === 'unload' ? Math.max(0, 1 - (elapsed - PICKUP_SECONDS - travel) / UNLOAD_SECONDS) : 1;
  const sample = samplePath(route, pathProgress);
  // Forks first approach the output pallet, then reverse clear before travelling forward.
  const distance = pathProgress * pathLength(route);
  const reversing = kind === 'forklift' && distance < 1.2 && phase !== 'unload';
  const turn = Math.min(1, Math.max(0, (distance - 1.2) / 1.2));
  return { ...sample, phase, pathProgress, lift: lift * lift * (3 - 2 * lift), reversing,
    heading: sample.angle + (kind === 'forklift' && phase !== 'unload' ? Math.PI * (1 - turn * turn * (3 - 2 * turn)) : 0) };
}
