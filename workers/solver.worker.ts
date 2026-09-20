/// <reference lib="webworker" />

import { growPatch } from "../lib/tiling";
import { detectPeriodicTranslations } from "../lib/periodic";
import { certifyFundamentalDomain } from "../lib/fundamental";
import { detectHierarchy } from "../lib/hierarchy";
import type { Point } from "../lib/geometry";

type Request = {
  points: Point[];
  maxTiles: number;
  allowReflection: boolean;
};

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const { points, maxTiles, allowReflection } = event.data;
    const patch = growPatch(points, { maxTiles, allowReflection, beamWidth: 18 });
    const periodic = patch.reached >= 6 ? detectPeriodicTranslations(patch.sampleTiles) : null;
    const certificate = periodic?.u && periodic?.v
      ? certifyFundamentalDomain(patch.sampleTiles, periodic.u, periodic.v)
      : null;
    const hierarchy = patch.reached >= 12 ? detectHierarchy(patch.sampleTiles) : null;

    self.postMessage({ type: "done", patch, periodic, certificate, hierarchy });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
