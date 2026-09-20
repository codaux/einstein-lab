import polygonClipping from "polygon-clipping";
import type { Point } from "./geometry";

export type Polygon = Point[];

const EPS = 1e-8;

type Ring = [number, number][];
type PCPolygon = Ring[];
type PCMultiPolygon = PCPolygon[];

function closeRing(poly: Polygon): Ring {
  const ring: Ring = poly.map(p => [p.x, p.y]);
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > EPS || Math.abs(first[1] - last[1]) > EPS) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function ringArea(ring: Ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

function multiPolygonArea(mp: PCMultiPolygon | null | undefined) {
  if (!mp?.length) return 0;
  let total = 0;
  for (const polygon of mp) {
    if (!polygon.length) continue;
    total += ringArea(polygon[0]);
    for (let i = 1; i < polygon.length; i++) total -= ringArea(polygon[i]);
  }
  return Math.max(0, total);
}

/**
 * Returns true only when the interiors overlap with positive area.
 * Shared edges and shared vertices are valid tiling contacts.
 */
export function polygonsInteriorOverlap(a: Polygon, b: Polygon, eps = EPS) {
  if (a.length < 3 || b.length < 3) return false;

  const intersection = polygonClipping.intersection(
    [closeRing(a)],
    [closeRing(b)]
  ) as PCMultiPolygon | null;

  return multiPolygonArea(intersection) > eps;
}

export function intersectionArea(a: Polygon, b: Polygon) {
  if (a.length < 3 || b.length < 3) return 0;
  const intersection = polygonClipping.intersection(
    [closeRing(a)],
    [closeRing(b)]
  ) as PCMultiPolygon | null;
  return multiPolygonArea(intersection);
}
