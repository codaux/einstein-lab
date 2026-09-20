import { describe, expect, it } from "vitest";
import { intersectionArea, polygonsInteriorOverlap } from "./overlap";

describe("polygon interior overlap", () => {
  const concave = [
    {x:0,y:0},{x:4,y:0},{x:4,y:1},
    {x:2,y:1},{x:2,y:3},{x:0,y:3}
  ];

  it("detects positive-area overlap in a concave polygon", () => {
    const shifted = concave.map(p => ({x:p.x+1,y:p.y+0.5}));
    expect(intersectionArea(concave, shifted)).toBeGreaterThan(0);
    expect(polygonsInteriorOverlap(concave, shifted)).toBe(true);
  });

  it("allows pure edge contact", () => {
    const squareA = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    const squareB = [{x:1,y:0},{x:2,y:0},{x:2,y:1},{x:1,y:1}];
    expect(intersectionArea(squareA, squareB)).toBe(0);
    expect(polygonsInteriorOverlap(squareA, squareB)).toBe(false);
  });

  it("rejects identical coincident polygons", () => {
    const square = [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}];
    expect(intersectionArea(square, square)).toBeCloseTo(4, 8);
    expect(polygonsInteriorOverlap(square, square)).toBe(true);
  });
});
