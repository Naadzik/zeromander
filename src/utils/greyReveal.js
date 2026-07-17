import { extractPopulationData, GREY } from './formatUtils.js';
import { normal } from './rng.js';

// Election-night resolution of the undecided (grey) population — v2 model.
//
// Clustered leans, not per-cell coin flips: each contiguous grey cluster
// draws ONE lean and its cells resolve around it. Independent per-cell 50/50
// flips would average out to nothing on any sizable cluster — correlation is
// what makes a big grey cluster a real risk worth planning around.
//
// Each cluster's lean = 50% + W_LOCAL·(neighborhood − 50%) + β + ε:
//
//   W_LOCAL = 0.5 — late deciders are anchored to their surroundings at HALF
//     strength, not fully (v1 used the full neighborhood share). They are
//     disproportionately weak partisans, "activated" toward local
//     fundamentals but not all the way (Gelman & King 1993; Fournier et al.
//     2004; Panagopoulos 2016 — the once-popular "incumbent rule" decayed
//     after 1992).
//   β ~ Normal(0, SIGMA_NAT) — drawn ONCE per election: the systematic
//     "late deciders broke the same way EVERYWHERE" shock. v1 drew every
//     cluster independently, which made the documented 2016 pattern
//     (last-week deciders ~59–30 statewide, per the AAPOR post-mortem)
//     literally impossible: independent clusters average out. σ = 7pp puts
//     map-wide breaks at mean |break−50| ≈ 5.6pp with a 2016-Wisconsin-scale
//     break as a ≈2σ tail — "historically, undecideds split about evenly"
//     stays the central case.
//   ε ~ Normal(0, SIGMA_CLUSTER) — per-cluster idiosyncrasy (local
//     candidates, turnout). Combined cluster SD √(.07²+.08²) ≈ .106 — near
//     the old ±25-uniform's SD (.144) but with normal tails: big breaks
//     possible, no longer 40%-likely.
//   Plus COUPLE × the national swing when the caller supplies one (decade
//     mode): the same environment that moves decided voters moves late
//     deciders — the 2016 pattern. Deterministic, no draw. The sandbox
//     reveal passes no swing (its polling-error draw is a separate concept).
//
// DRAW ORDER IS FROZEN (fixed arity per unit, MODELSPECS §0): β first
// (exactly 2 draws, once), then per cluster in row-major flood-fill order
// exactly 2 draws (ε via cosine Box–Muller), then 1 draw per grey cell.
// Budget: 2 + 2·clusters + greyCells. Zero draws when no grey exists.
//
// Pure: same map + same rng seed → same resolution. Returns a NEW populationMap
// (original is never mutated) plus per-cluster info for display/animation.
const W_LOCAL = 0.5;
const SIGMA_NAT = 0.07;
const SIGMA_CLUSTER = 0.08;
const COUPLE = 0.5;
const LEAN_MIN = 0.05;
const LEAN_MAX = 0.95;

export function resolveGreyPopulation(populationMap, rng, { nationalSwingPct = 0 } = {}) {
  const { partyMap, densityMap, communityMap } = extractPopulationData(populationMap);
  const gridSize = partyMap.length;

  // No grey → return the input untouched WITHOUT consuming any rng draws.
  let hasGrey = false;
  for (let y = 0; y < gridSize && !hasGrey; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (partyMap[y][x] === GREY) { hasGrey = true; break; }
    }
  }
  if (!hasGrey) return { revealedMap: populationMap, clusters: [] };

  // The election-wide break shock: one draw for the whole night, shared by
  // every cluster — plus the coupled share of the national swing (no draw).
  const beta = normal(rng) * SIGMA_NAT + COUPLE * (nationalSwingPct / 100);

  const newParty = partyMap.map(row => [...row]);

  // Flood-fill contiguous grey clusters (4-connected).
  const visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const clusters = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (partyMap[y][x] !== GREY || visited[y][x]) continue;
      const cells = [];
      const stack = [{ x, y }];
      visited[y][x] = true;
      while (stack.length > 0) {
        const c = stack.pop();
        cells.push(c);
        for (const [dx, dy] of dirs) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize &&
              !visited[ny][nx] && partyMap[ny][nx] === GREY) {
            visited[ny][nx] = true;
            stack.push({ x: nx, y: ny });
          }
        }
      }

      // Neighborhood baseline: decided (blue/red) population within
      // Chebyshev distance 2 of any cluster cell, density-weighted.
      let nBlue = 0, nRed = 0;
      const seen = new Set();
      for (const { x: cx, y: cy } of cells) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
            const key = ny * gridSize + nx;
            if (seen.has(key)) continue;
            seen.add(key);
            const p = partyMap[ny][nx];
            const pop = densityMap ? densityMap[ny][nx] : 1;
            if (p === 0) nBlue += pop;
            else if (p === 1) nRed += pop;
          }
        }
      }
      const baseline = (nBlue + nRed) > 0 ? nBlue / (nBlue + nRed) : 0.5;

      // The cluster's lean: half-strength local anchor + the shared
      // election-wide shock + this cluster's own surprise.
      const center = 0.5 + W_LOCAL * (baseline - 0.5);
      const lean = Math.min(LEAN_MAX, Math.max(LEAN_MIN, center + beta + normal(rng) * SIGMA_CLUSTER));
      let bluePop = 0, redPop = 0;
      for (const { x: cx, y: cy } of cells) {
        const toBlue = rng() < lean;
        newParty[cy][cx] = toBlue ? 0 : 1;
        const pop = densityMap ? densityMap[cy][cx] : 1;
        if (toBlue) bluePop += pop; else redPop += pop;
      }
      clusters.push({ cells, lean, bluePop, redPop });
    }
  }

  // Forward the community-of-interest layer untouched — election night only
  // resolves the undecideds; the community grid is independent of party and must
  // survive the reveal so its overlay still renders on the resolved map.
  const revealedMap = { party: newParty, density: densityMap };
  if (communityMap) revealedMap.community = communityMap;

  return {
    revealedMap,
    clusters
  };
}
