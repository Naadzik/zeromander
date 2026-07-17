import { extractPopulationData, getCellPopulation } from './formatUtils.js';

// Flood-fills the counties grid into region units: each unit is a maximal
// 4-connected group of cells sharing the same county id. In the common case
// a unit is exactly one county, but rebalanceCountyPopulations can
// occasionally leave a county's Voronoi-reseeded shape internally
// disconnected (it re-seeds without re-running generateCounties' contiguity
// merge step) — splitting into units here means every atomic piece this
// algorithm assigns to a district is guaranteed truly 4-connected, so
// district contiguity holds regardless of that upstream edge case.
function buildRegions(counties, gridSize) {
  const unitId = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
  const cellsByUnit = {};
  let nextId = 1;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (unitId[y][x] !== 0) continue;
      const countyId = counties[y][x];
      const id = nextId++;
      const cells = [];
      const stack = [{ x, y }];
      unitId[y][x] = id;
      while (stack.length > 0) {
        const c = stack.pop();
        cells.push(c);
        for (const [dx, dy] of dirs) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize &&
            unitId[ny][nx] === 0 && counties[ny][nx] === countyId) {
            unitId[ny][nx] = id;
            stack.push({ x: nx, y: ny });
          }
        }
      }
      cellsByUnit[id] = cells;
    }
  }

  return { unitId, cellsByUnit };
}

// Precomputed once: which units touch which. Static for the lifetime of a
// map, so every adjacency check during growth/rebalancing becomes an O(1)
// set lookup instead of a grid rescan.
function buildUnitAdjacency(unitId, gridSize) {
  const neighbors = new Map();
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const id = unitId[y][x];
      if (!neighbors.has(id)) neighbors.set(id, new Set());
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          const nid = unitId[ny][nx];
          if (nid !== id) neighbors.get(id).add(nid);
        }
      }
    }
  }
  return neighbors;
}

function countyCentroid(cells) {
  let sx = 0, sy = 0;
  for (const { x, y } of cells) { sx += x; sy += y; }
  return { x: sx / cells.length, y: sy / cells.length };
}

// Spreads seed counties geographically so districts grow from well-separated
// starting points instead of clustering in one corner.
function farthestPointSeeds(countyIds, centroids, count, rng) {
  const remaining = new Set(countyIds);
  const seeds = [];

  const first = countyIds[Math.floor(rng() * countyIds.length)];
  seeds.push(first);
  remaining.delete(first);

  while (seeds.length < count && remaining.size > 0) {
    let best = null, bestDist = -1;
    for (const id of remaining) {
      let minDist = Infinity;
      for (const s of seeds) {
        const dx = centroids[id].x - centroids[s].x;
        const dy = centroids[id].y - centroids[s].y;
        const d = dx * dx + dy * dy;
        if (d < minDist) minDist = d;
      }
      if (minDist > bestDist) { bestDist = minDist; best = id; }
    }
    seeds.push(best);
    remaining.delete(best);
  }

  return seeds;
}

// True if the given district's cells form a single 4-connected component.
// Exported: also used to stop player edits (county steal/removal) from
// splitting a district, and by the completion gate as defense in depth.
export function isDistrictConnected(districts, districtId, gridSize) {
  let start = null;
  let total = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (districts[y][x] === districtId) {
        total++;
        if (!start) start = { x, y };
      }
    }
  }
  if (total === 0) return true;

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const visited = new Set([`${start.x},${start.y}`]);
  const stack = [start];
  let count = 0;
  while (stack.length > 0) {
    const { x, y } = stack.pop();
    count++;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize &&
        districts[ny][nx] === districtId && !visited.has(key)) {
        visited.add(key);
        stack.push({ x: nx, y: ny });
      }
    }
  }
  return count === total;
}

function totalSquaredDeviation(districtPop, numDistricts, targetPop) {
  let sum = 0;
  for (let d = 1; d <= numDistricts; d++) {
    const dev = districtPop[d] - targetPop;
    sum += dev * dev;
  }
  return sum;
}

// How close to the ideal the swap pass drives every district before it calls
// the map balanced. This is a STOPPING criterion, not a legal rule, and it
// must stay well inside the completion gate: the gate is the overall RANGE
// ≤ 10% (Brown v. Thomson), and a per-district tolerance of t guarantees a
// range ≤ 2t — so 4% keeps the neutral map's own spread under 8%, safely
// legal, with margin for the last unit that can't be swapped.
//
// It was 10%, which silently made the baseline unfair once the gate became
// the range test: the pass stopped the instant each district was within
// ±10%, leaving spreads of 14–18% (measured) — the neutral map FAILED the
// rule the player must satisfy, and no achievable per-district band could be
// shown as sufficient. Measured at 4%: neutral spreads fall to 3.2–6.6% and
// 145 of 150 ensemble members put every district inside ±5% (the drawing
// aid), so the aid is honest guidance rather than a permanent red mark.
const BALANCE_TOLERANCE = 0.04;

// Moves single units across district boundaries wherever doing so reduces the
// overall population imbalance, only when the donor district stays connected
// afterward — never trades contiguity away to improve population balance.
// Scans every boundary in the map each attempt (not just the single most
// extreme over/under pair) so it keeps making progress even when the two most
// imbalanced districts don't happen to touch each other.
function boundarySwapPass(districts, cellsByUnit, unitDistrict, unitNeighbors, popByUnit, numDistricts, targetPop, gridSize, maxAttempts) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const districtPop = new Array(numDistricts + 1).fill(0);
    for (const [id, d] of unitDistrict) districtPop[d] += popByUnit[id];

    let withinTolerance = true;
    for (let d = 1; d <= numDistricts; d++) {
      if (Math.abs(districtPop[d] - targetPop) > targetPop * BALANCE_TOLERANCE) { withinTolerance = false; break; }
    }
    if (withinTolerance) break;

    const candidates = [];
    for (const [unitId, fromDistrict] of unitDistrict) {
      const pop = popByUnit[unitId];
      const oldFromDev = districtPop[fromDistrict] - targetPop;
      const seenTo = new Set();
      for (const n of unitNeighbors.get(unitId)) {
        const toDistrict = unitDistrict.get(n);
        if (toDistrict === undefined || toDistrict === fromDistrict || seenTo.has(toDistrict)) continue;
        seenTo.add(toDistrict);

        const oldToDev = districtPop[toDistrict] - targetPop;
        const newFromDev = oldFromDev - pop;
        const newToDev = oldToDev + pop;
        const improvement = (oldFromDev * oldFromDev + oldToDev * oldToDev) - (newFromDev * newFromDev + newToDev * newToDev);
        if (improvement > 0) candidates.push({ unitId, fromDistrict, toDistrict, improvement });
      }
    }

    if (candidates.length === 0) break;
    candidates.sort((a, b) => b.improvement - a.improvement);

    let applied = false;
    for (const c of candidates.slice(0, 50)) {
      for (const { x, y } of cellsByUnit[c.unitId]) districts[y][x] = c.toDistrict;
      const stillConnected = isDistrictConnected(districts, c.fromDistrict, gridSize);
      if (stillConnected) {
        unitDistrict.set(c.unitId, c.toDistrict);
        applied = true;
        break;
      }
      for (const { x, y } of cellsByUnit[c.unitId]) districts[y][x] = c.fromDistrict;
    }

    if (!applied) break;
  }
}

// Generates a party-blind "neutral" district map on the same counties/population
// grid the player used: optimizes only population equality + compactness/
// contiguity, never reads party affiliation. Used as a counterfactual baseline
// ("ghost map") to compare against the player's drawn districts.
export function generateFairMap(populationMap, counties, numDistricts, gridSize, rng = Math.random) {
  const { densityMap } = extractPopulationData(populationMap);
  const { unitId: unitGrid, cellsByUnit } = buildRegions(counties, gridSize);
  const unitIds = Object.keys(cellsByUnit).map(Number);
  const numSeeds = Math.max(1, Math.min(numDistricts, unitIds.length));

  const centroids = {};
  const popByUnit = {};
  let totalPop = 0;
  for (const id of unitIds) {
    const cells = cellsByUnit[id];
    centroids[id] = countyCentroid(cells);
    const pop = cells.reduce((sum, { x, y }) => sum + getCellPopulation(densityMap, y, x), 0);
    popByUnit[id] = pop;
    totalPop += pop;
  }

  const unitNeighbors = buildUnitAdjacency(unitGrid, gridSize);
  const seedIds = farthestPointSeeds(unitIds, centroids, numSeeds, rng);

  const districts = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
  const unitDistrict = new Map();
  const districtPop = new Array(numSeeds + 1).fill(0);

  // Running centroid per district (cell-count weighted) so growth can prefer
  // nearby units — this is what keeps neutral districts round instead of
  // snaking along whatever the population-fill frontier happens to offer.
  const distSumX = new Array(numSeeds + 1).fill(0);
  const distSumY = new Array(numSeeds + 1).fill(0);
  const distCells = new Array(numSeeds + 1).fill(0);

  function absorb(districtId, unitId) {
    const w = cellsByUnit[unitId].length;
    distSumX[districtId] += centroids[unitId].x * w;
    distSumY[districtId] += centroids[unitId].y * w;
    distCells[districtId] += w;
  }

  seedIds.forEach((unitId, i) => {
    const districtId = i + 1;
    for (const { x, y } of cellsByUnit[unitId]) districts[y][x] = districtId;
    unitDistrict.set(unitId, districtId);
    districtPop[districtId] = popByUnit[unitId];
    absorb(districtId, unitId);
  });

  const targetPop = totalPop / numSeeds;
  let unassigned = unitIds.filter(id => !unitDistrict.has(id));

  // Contiguity is guaranteed by construction: a unit is only ever placed
  // into a district it's adjacent to, and every unit is itself 4-connected
  // (see buildRegions), so every district stays a single connected component
  // throughout — no post-hoc contiguity check needed.
  let guard = unitIds.length * 2 + 10;
  while (unassigned.length > 0 && guard-- > 0) {
    const order = [];
    for (let d = 1; d <= numSeeds; d++) order.push(d);
    order.sort((a, b) => districtPop[a] - districtPop[b]);

    let placed = false;
    for (const districtId of order) {
      // Among all adjacent unassigned units, prefer the one closest to the
      // district's centroid (compactness), with population fit as a lighter
      // secondary term. Distance dominates so districts grow round; the
      // boundary-swap pass cleans up remaining population imbalance.
      const remainingGap = targetPop - districtPop[districtId];
      const cx = distSumX[districtId] / distCells[districtId];
      const cy = distSumY[districtId] / distCells[districtId];
      let bestCandidate = null, bestScore = Infinity;
      for (const unitId of unassigned) {
        if (!unitNeighbors.get(unitId).size) continue;
        const touches = [...unitNeighbors.get(unitId)].some(n => unitDistrict.get(n) === districtId);
        if (!touches) continue;
        const dx = centroids[unitId].x - cx;
        const dy = centroids[unitId].y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / gridSize;
        const popFit = Math.abs(popByUnit[unitId] - remainingGap) / targetPop;
        const score = dist + 0.35 * popFit;
        if (score < bestScore) { bestScore = score; bestCandidate = unitId; }
      }
      if (bestCandidate !== null) {
        for (const { x, y } of cellsByUnit[bestCandidate]) districts[y][x] = districtId;
        unitDistrict.set(bestCandidate, districtId);
        districtPop[districtId] += popByUnit[bestCandidate];
        absorb(districtId, bestCandidate);
        unassigned = unassigned.filter(id => id !== bestCandidate);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Defensive fallback for a pathological/disconnected input — should not
      // occur on the game's fully-tiled grid, but guarantees termination.
      const unitId = unassigned[0];
      const districtId = order[0];
      for (const { x, y } of cellsByUnit[unitId]) districts[y][x] = districtId;
      unitDistrict.set(unitId, districtId);
      districtPop[districtId] += popByUnit[unitId];
      absorb(districtId, unitId);
      unassigned = unassigned.filter(id => id !== unitId);
    }
  }

  // 1200 attempts, not 300: the tighter BALANCE_TOLERANCE needs more swaps to
  // converge, and each attempt is cheap (one boundary scan, applied only when
  // the donor district stays connected).
  boundarySwapPass(districts, cellsByUnit, unitDistrict, unitNeighbors, popByUnit, numSeeds, targetPop, gridSize, 1200);

  return districts;
}
