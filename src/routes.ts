import type { BuildingDef, Layout, MachineDef, Point2 } from './types';
import { inPort, outPort, queuePos } from './geometry';
import { doorPosition } from './layout';
import { specOf } from './machineTypes';

export function pathLength(points: Point2[]): number {
  return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
}
export function samplePath(points: Point2[], progress: number): { point: Point2; angle: number } {
  if (progress >= 1 && points.length >= 2) {
    const b = points[points.length - 1], a = points[points.length - 2];
    return { point: [...b], angle: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
  }
  let distance = pathLength(points) * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (distance <= length || i === points.length - 1) {
      const t = length ? Math.min(1, distance / length) : 0;
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
    }
    distance -= length;
  }
  return { point: points[0] ?? [0, 0], angle: 0 };
}

const inside = (p: Point2, center: Point2, size: Point2, padding = 0) => Math.abs(p[0] - center[0]) <= size[0] / 2 + padding && Math.abs(p[1] - center[1]) <= size[1] / 2 + padding;
const segmentDistance = (p: Point2, a: Point2, b: Point2) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};

// One metre navigation raster. Walls and machine footprints are solid; doors are explicit portals.
export class CampusRouter {
  private x0: number; private z0: number; private width: number; private depth: number;
  private walkable: Uint8Array;
  private obstacles: { center: Point2; size: Point2 }[];
  private cache = new Map<string, Point2[] | null>();
  constructor(readonly layout: Layout) {
    this.x0 = Math.floor(layout.floor.center[0] - layout.floor.size[0] / 2);
    this.z0 = Math.floor(layout.floor.center[1] - layout.floor.size[1] / 2);
    this.width = Math.ceil(layout.floor.size[0]) + 1; this.depth = Math.ceil(layout.floor.size[1]) + 1;
    this.obstacles = layout.machines.filter((m) => m.type !== 'slot' && m.type !== 'receipt_hold').map((m) => {
      const [w, , d] = specOf(m).size, c = Math.abs(Math.cos(m.rotationY)), s = Math.abs(Math.sin(m.rotationY));
      return { center: [m.position[0], m.position[2]], size: [w * c + d * s + 1.1, w * s + d * c + 1.1] };
    });
    for(const m of layout.machines.filter(m=>m.type==='receipt_hold')) {
      const [x,,z]=m.position;
      // Authored cage has a 2.4 m opening on its south face. Its storage cells stay walkable.
      this.obstacles.push({center:[x,z-3],size:[7.5,.6]}, {center:[x-3.5,z],size:[.6,6.5]}, {center:[x+3.5,z],size:[.6,6.5]}, {center:[x-2.35,z+3],size:[2.3,.6]}, {center:[x+2.35,z+3],size:[2.3,.6]});
    }
    for(const o of layout.obstacles??[])this.obstacles.push({center:o.center,size:[o.size[0]+1.1,o.size[1]+1.1]});
    this.walkable = new Uint8Array(this.width * this.depth);
    for (let z = 0; z < this.depth; z++) for (let x = 0; x < this.width; x++) this.walkable[z * this.width + x] = Number(this.isWalkable([x + this.x0, z + this.z0]));
  }

  isWalkable(p: Point2): boolean {
    if (this.obstacles.some((o) => inside(p, o.center, o.size))) return false;
    for (const b of this.layout.buildings ?? []) {
      if (!inside(p, b.center, b.size, 0.5)) continue;
      const inner = inside(p, b.center, b.size, -0.5);
      if (!inner && !b.doors.some((d) => {
        const at = doorPosition(b, d), horizontal = d.side === 'north' || d.side === 'south';
        return Math.abs(p[horizontal ? 0 : 1] - at[horizontal ? 0 : 1]) < d.width / 2 - 0.6 && Math.abs(p[horizontal ? 1 : 0] - at[horizontal ? 1 : 0]) < 1.1;
      })) return false;
      for (const r of b.rooms ?? []) {
        if (inside(p, r.center, r.size, 0.45) && !inside(p, r.center, r.size, -0.45)) {
          const right = r.center[0] + r.size[0] / 2;
          if (!(Math.abs(p[0] - right) < 1 && Math.abs(p[1] - r.doorZ) < 2)) return false;
        }
      }
      return true;
    }
    if (this.layout.outdoors?.some((a) => a.kind !== 'parking' && inside(p, a.center, a.size))) return true;
    return this.layout.roads?.some((r) => r.points.slice(1).some((end, i) => segmentDistance(p, r.points[i], end) <= r.width / 2 - 0.6)) ?? false;
  }

  clearSegment(a: Point2, b: Point2): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4));
    for (let i = 0; i <= steps; i++) if (!this.isWalkable([a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps])) return false;
    return true;
  }
  private point(id: number): Point2 { return [id % this.width + this.x0, Math.floor(id / this.width) + this.z0]; }
  private nearest(p: Point2): number | null {
    let best: number | null = null, distance = Infinity;
    const cx = Math.round(p[0] - this.x0), cz = Math.round(p[1] - this.z0);
    for (let z = cz - 2; z <= cz + 2; z++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (x < 0 || z < 0 || x >= this.width || z >= this.depth) continue;
      const id = z * this.width + x, at = this.point(id), d = Math.hypot(at[0] - p[0], at[1] - p[1]);
      if (this.walkable[id] && d < distance && this.clearSegment(p, at)) { best = id; distance = d; }
    }
    return best;
  }
  route(from: MachineDef, to: MachineDef, slot?: number): Point2[] | null {
    const key = `${from.id}>${to.id}:${slot ?? 'entry'}`;
    if (!this.cache.has(key)) this.cache.set(key, this.between(outPort(from), slot === undefined ? inPort(to) : queuePos(to, slot)));
    return this.cache.get(key)!;
  }
  between(a: Point2, b: Point2): Point2[] | null {
    const key=`${a[0]},${a[1]}>${b[0]},${b[1]}`;
    if(!this.pointCache.has(key))this.pointCache.set(key,this.findBetween(a,b));
    return this.pointCache.get(key)!;
  }
  private pointCache=new Map<string,Point2[]|null>();
  private findBetween(a:Point2,b:Point2):Point2[]|null {
    if (this.clearSegment(a, b)) return [a, b];
    const start = this.nearest(a), target = this.nearest(b);
    if (start === null || target === null) return null;
    const scores = new Float64Array(this.walkable.length).fill(Infinity), parent = new Int32Array(this.walkable.length).fill(-1);
    const heap: { id: number; f: number }[] = [];
    const push = (entry: { id: number; f: number }) => {
      heap.push(entry); let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= entry.f) break; heap[i] = heap[p]; i = p; } heap[i] = entry;
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++; if (last.f <= heap[c].f) break; heap[i] = heap[c]; i = c; } heap[i] = last; }
      return top;
    };
    const tp = this.point(target), h = (id: number) => { const p = this.point(id); return Math.abs(p[0] - tp[0]) + Math.abs(p[1] - tp[1]); };
    scores[start] = 0; push({ id: start, f: h(start) });
    while (heap.length) {
      const current = pop();
      if (current.f > scores[current.id] + h(current.id)) continue;
      if (current.id === target) {
        const nodes: Point2[] = []; let at = target;
        while (at !== -1) { nodes.push(this.point(at)); at = parent[at]; }
        nodes.reverse();
        const path = [a, ...nodes, b].filter((p, i, all) => !i || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 0.001);
        const compact: Point2[] = [];
        for (let i = 0; i < path.length; i++) {
          const prev = compact[compact.length - 1], next = path[i + 1], p = path[i];
          if (prev && next && (p[0] - prev[0]) * (next[1] - p[1]) === (p[1] - prev[1]) * (next[0] - p[0])) continue;
          compact.push(p);
        }
        return compact;
      }
      for (const delta of [-1, 1, -this.width, this.width]) {
        const next = current.id + delta;
        if (next < 0 || next >= this.walkable.length || !this.walkable[next] || (Math.abs(delta) === 1 && Math.floor(next / this.width) !== Math.floor(current.id / this.width))) continue;
        const cost = scores[current.id] + 1;
        if (cost >= scores[next] || !this.clearSegment(this.point(current.id), this.point(next))) continue;
        scores[next] = cost; parent[next] = current.id; push({ id: next, f: cost + h(next) });
      }
    }
    return null;
  }
}

export function routeErrors(layout: Layout, router = new CampusRouter(layout)): string[] {
  const errors: string[] = [];
  for (const m of layout.machines) for (const id of m.next) {
    const target = layout.machines.find((n) => n.id === id);
    if (!target) errors.push(`${m.id}: ${id} istasyonu bulunamadı.`);
    else if (!router.route(m, target)) errors.push(`${m.id} → ${id}: kapı ve koridorlardan geçen açık güzergâh yok.`);
  }
  return errors;
}
