import { extractPopulationData, GREY } from './formatUtils.js';

// Election-night resolution of the undecided (grey) population.
//
// Clustered leans, not per-cell coin flips: each contiguous grey cluster
// draws ONE lean and its cells resolve around it. Independent per-cell 50/50
// flips would average out to nothing on any sizable cluster — correlation is
// what makes a big grey cluster a real risk worth planning around.
//
// The lean is CONTEXT-AWARE: centered on the partisanship of the cluster's
// decided neighborhood (cells within 2 of the cluster), ± up to 25 points of
// noise, clamped to [10%, 90%]. So undecideds inside a blue city lean blue —
// but can still badly underperform what the city would have voted without
// them (the element of surprise), and occasionally overperform it.
//
// Pure: same map + same rng seed → same resolution. Returns a NEW populationMap
// (original is never mutated) plus per-cluster info for display/animation.
export function resolveGreyPopulation(populationMap, rng) {
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

      // The cluster's lean: local context ± real surprise.
      const lean = Math.min(0.9, Math.max(0.1, baseline + (rng() * 2 - 1) * 0.25));
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
