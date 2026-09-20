# Einstein Lab

An experimental web lab for testing straight-edged polygon monotile candidates.

## Current MVP

- Grid-based polygon editor
- Polygon validation
- Self-intersection detection
- Interior-angle analysis
- Basic 360° vertex-combination filter
- Constructive edge-to-edge local patch search
- Optional reflected copies
- Visual display of the best patch found

## Important scope

The current solver **does not prove** that a polygon tiles the entire plane and **does not test aperiodicity yet**.

The result categories are intentionally conservative:

1. **Rejected in preflight** — the polygon fails a necessary geometric test.
2. **Search stalled** — the current bounded local search did not grow a convincing patch.
3. **Local growth found** — the shape survives the first constructive test.

A future periodic-domain solver will search explicitly for a translational fundamental domain. Only after that should the app report a polygon as an aperiodic candidate.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Roadmap

- periodic fundamental-domain search
- stronger exact-cover / SAT solver
- worker-based search
- triangular and hexagonal lattice modes
- automatic shape enumeration / mutation
- hierarchy and substitution-rule discovery
