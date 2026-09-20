export type Point = { x: number; y: number };

export type ValidationResult = {
  valid: boolean;
  reasons: string[];
  area: number;
  clockwise: boolean;
  selfIntersects: boolean;
  angles: number[];
  vertexCompatibility: { angle: number; combinations: number[][] }[];
};

const EPS = 1e-7;

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function signedArea(poly: Point[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

function orient(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, p: Point) {
  return Math.abs(orient(a, b, p)) < EPS &&
    p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d);
  const o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) &&
      ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

export function hasSelfIntersection(poly: Point[]) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (i === 0 && j === n - 1) continue;
      const c = poly[j], d = poly[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export function interiorAngles(poly: Point[]) {
  const ccw = signedArea(poly) > 0;
  return poly.map((p, i) => {
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const next = poly[(i + 1) % poly.length];
    const v1 = { x: prev.x - p.x, y: prev.y - p.y };
    const v2 = { x: next.x - p.x, y: next.y - p.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const cross = v1.x * v2.y - v1.y * v2.x;
    let ang = Math.atan2(Math.abs(cross), dot) * 180 / Math.PI;
    const turn = orient(prev, p, next);
    const reflex = ccw ? turn < -EPS : turn > EPS;
    if (reflex) ang = 360 - ang;
    return ang;
  });
}

function angleCombinations(angles: number[], target = 360, maxCount = 8) {
  const unique = Array.from(new Set(angles.map(a => Math.round(a * 1e5) / 1e5)));
  const out: number[][] = [];
  const walk = (start: number, sum: number, combo: number[]) => {
    if (Math.abs(sum - target) < 1e-4) {
      out.push([...combo]);
      return;
    }
    if (sum > target + 1e-4 || combo.length >= maxCount || out.length >= 30) return;
    for (let i = start; i < unique.length; i++) {
      combo.push(unique[i]);
      walk(i, sum + unique[i], combo);
      combo.pop();
    }
  };
  walk(0, 0, []);
  return out;
}

export function validatePolygon(poly: Point[]): ValidationResult {
  const reasons: string[] = [];
  if (poly.length < 3) reasons.push("A polygon needs at least 3 vertices.");
  const areaSigned = poly.length >= 3 ? signedArea(poly) : 0;
  const selfIntersects = poly.length >= 4 ? hasSelfIntersection(poly) : false;
  if (Math.abs(areaSigned) < EPS) reasons.push("The polygon has zero area.");
  if (selfIntersects) reasons.push("The boundary intersects itself.");

  const angles = reasons.length === 0 ? interiorAngles(poly) : [];
  const allCombos = angles.length ? angleCombinations(angles) : [];
  const vertexCompatibility = angles.map(angle => ({
    angle,
    combinations: allCombos.filter(c => c.some(a => Math.abs(a - angle) < 1e-4)),
  }));

  if (angles.length && vertexCompatibility.some(v => v.combinations.length === 0)) {
    reasons.push("At least one vertex angle cannot participate in any tested 360° vertex combination.");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    area: Math.abs(areaSigned),
    clockwise: areaSigned < 0,
    selfIntersects,
    angles,
    vertexCompatibility,
  };
}

export function normalizePolygon(poly: Point[]) {
  if (!poly.length) return poly;
  const minX = Math.min(...poly.map(p => p.x));
  const minY = Math.min(...poly.map(p => p.y));
  return poly.map(p => ({ x: p.x - minX, y: p.y - minY }));
}
