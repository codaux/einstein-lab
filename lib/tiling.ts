import { Point, distance } from "./geometry";
import { polygonsInteriorOverlap } from "./overlap";

export type Tile = Point[];
export type PatchResult = {
  reached: number;
  placementsTried: number;
  deadEnds: number;
  sampleTiles: Tile[];
  status: "grown" | "stalled";
};

function transformEdgeToEdge(poly: Tile, edgeIndex: number, targetA: Point, targetB: Point, reflected: boolean) {
  const q0 = poly[edgeIndex];
  const q1 = poly[(edgeIndex + 1) % poly.length];
  let base = poly.map(p => ({...p}));

  if (reflected) {
    const ax = q1.x - q0.x, ay = q1.y - q0.y;
    const len = Math.hypot(ax, ay) || 1;
    const ux = ax/len, uy = ay/len;
    base = base.map(p => {
      const vx = p.x - q0.x, vy = p.y - q0.y;
      const along = vx*ux + vy*uy;
      const perp = vx*(-uy) + vy*ux;
      return {
        x: q0.x + along*ux + perp*uy,
        y: q0.y + along*uy - perp*ux,
      };
    });
  }

  const s0 = base[edgeIndex], s1 = base[(edgeIndex + 1) % poly.length];
  const from = Math.atan2(s1.y-s0.y, s1.x-s0.x);
  const to = Math.atan2(targetA.y-targetB.y, targetA.x-targetB.x);
  const theta = to-from;
  const ct = Math.cos(theta), st = Math.sin(theta);
  const rotated = base.map(p => {
    const x = p.x-s0.x, y = p.y-s0.y;
    return { x: x*ct-y*st, y: x*st+y*ct };
  });
  const movedS0 = rotated[edgeIndex];
  return rotated.map(p => ({
    x: p.x + targetB.x - movedS0.x,
    y: p.y + targetB.y - movedS0.y,
  }));
}

type BoundaryEdge = { a: Point; b: Point };

function edgeKey(a: Point, b: Point) {
  const f = (v:number) => Math.round(v*1e5)/1e5;
  const p1 = `${f(a.x)},${f(a.y)}`, p2 = `${f(b.x)},${f(b.y)}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

function boundaryOf(tiles: Tile[]) {
  const map = new Map<string, BoundaryEdge>();
  for (const tile of tiles) {
    for (let i=0;i<tile.length;i++) {
      const a=tile[i], b=tile[(i+1)%tile.length], k=edgeKey(a,b);
      if (map.has(k)) map.delete(k); else map.set(k,{a,b});
    }
  }
  return [...map.values()];
}

export function growPatch(poly: Tile, options?: { maxTiles?: number; allowReflection?: boolean; beamWidth?: number }): PatchResult {
  const maxTiles = options?.maxTiles ?? 30;
  const allowReflection = options?.allowReflection ?? true;
  const beamWidth = options?.beamWidth ?? 12;
  let frontier: Tile[][] = [[poly]];
  let best = frontier[0];
  let tried = 0, deadEnds = 0;

  for (let step=1; step<maxTiles; step++) {
    const next: Tile[][] = [];
    for (const state of frontier) {
      const boundary = boundaryOf(state);
      const targets = boundary.slice(0, Math.min(boundary.length, 6));
      for (const target of targets) {
        for (let e=0;e<poly.length;e++) {
          if (Math.abs(distance(poly[e], poly[(e+1)%poly.length]) - distance(target.a,target.b)) > 1e-5) continue;
          for (const reflected of (allowReflection ? [false,true] : [false])) {
            tried++;
            const candidate = transformEdgeToEdge(poly,e,target.a,target.b,reflected);

            // Critical validity rule: tile interiors must be disjoint.
            // Shared edges / vertices are allowed; positive-area intersection is not.
            if (state.some(t => polygonsInteriorOverlap(candidate, t))) continue;

            const ns = [...state,candidate];
            next.push(ns);
            if (ns.length > best.length) best = ns;
            if (best.length >= maxTiles) {
              return { reached: best.length, placementsTried: tried, deadEnds, sampleTiles: best, status: "grown" };
            }
          }
        }
      }
      if (!next.length) deadEnds++;
    }

    if (!next.length) break;
    next.sort((a,b) => boundaryOf(a).length - boundaryOf(b).length);
    frontier = next.slice(0, beamWidth);
  }

  return { reached: best.length, placementsTried: tried, deadEnds, sampleTiles: best, status: best.length >= 6 ? "grown" : "stalled" };
}
