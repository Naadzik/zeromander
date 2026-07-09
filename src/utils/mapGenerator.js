function distToNearest(seeds, x, y) {
  let min = Infinity;
  for (const s of seeds) {
    const dx = x - s.x, dy = y - s.y;
    min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
  }
  return min;
}

function placeSeeds(count, gridSize, rng, { maxAttempts = Infinity, accept, make } = {}) {
  const seeds = [];
  let attempts = 0;
  while (seeds.length < count && attempts < maxAttempts) {
    attempts++;
    const x = rng() * gridSize;
    const y = rng() * gridSize;
    if (accept && !accept(x, y)) continue;
    seeds.push(make ? make(x, y) : { x, y });
  }
  return seeds;
}

function makeSparsePatches(gridSize, rng) {
  const count = 3 + Math.floor(rng() * 5);
  return placeSeeds(count, gridSize, rng, { make: (x, y) => ({ x, y, r: 3 + rng() * 4 }) });
}

function inAnyPatch(patches, x, y) {
  return patches.some(p => {
    const dx = x - p.x, dy = y - p.y;
    return Math.sqrt(dx * dx + dy * dy) < p.r;
  });
}

function ruralCellDensity(sparsePatches, x, y, rng) {
  return inAnyPatch(sparsePatches, x, y) ? 1 : 2 + Math.floor(rng() * 3);
}

function shuffledCells(gridSize, rng) {
  const cells = [];
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < gridSize; x++)
      cells.push({ x, y });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

// Nudges partyId's population share toward targetPop by flipping random cells:
// under target, cells matching takeFrom become partyId; over target, partyId
// cells spill to spillTo.
function rebalancePartyShare(partyMap, densityMap, cells, targetPop, partyId, takeFrom, spillTo) {
  let current = 0;
  for (const { x, y } of cells) {
    if (partyMap[y][x] === partyId) current += densityMap[y][x];
  }

  if (current < targetPop) {
    const deficit = targetPop - current;
    let added = 0;
    for (let i = 0; i < cells.length && added < deficit; i++) {
      const { x, y } = cells[i];
      if (takeFrom(partyMap[y][x])) {
        partyMap[y][x] = partyId;
        added += densityMap[y][x];
      }
    }
  } else if (current > targetPop) {
    const excess = current - targetPop;
    let removed = 0;
    for (let i = 0; i < cells.length && removed < excess; i++) {
      const { x, y } = cells[i];
      if (partyMap[y][x] === partyId) {
        partyMap[y][x] = spillTo;
        removed += densityMap[y][x];
      }
    }
  }
}

// `greyPercentage`: share of the population marked undecided (party 3) in
// contiguous blobs — they count as people but cast no votes until the
// election-night reveal.
//
// This IS the natural-board model (unconditional since 2026-07-08; the legacy
// "perfect circles + random rebalance" path and its rollout flags solidCities/
// naturalBoard were removed once every mode had migrated).
// `communityPercentage`: share of the population belonging to a fictional,
// non-partisan "community of interest" (VRA layer) — a SEPARATE boolean overlay
// grid, independent of party. Trailing param + zero rng when 0, so every board
// that doesn't ask for a community is byte-identical to before.
export function generatePopulationMap(gridSize, bluePercentage, numCities = 4, polarization = 50, rng = Math.random, greyPercentage = 0, communityPercentage = 0) {
  return generateNaturalBoard(gridSize, bluePercentage, numCities, polarization, rng, greyPercentage, communityPercentage);
}

// ---------- Natural board model ----------
// The replacement look: warped non-round cities, a density gradient that
// widens outward, and a "dim seam" city edge — red near a city stays sparse,
// so a city feathers into the countryside instead of ending in a bright halo.
// Party stays a hard step (every cell is solidly one party); only density
// fades. See ~/.claude/plans/zeromander-natural-board-B.md.
//
// RNG DRAW ORDER IS FROZEN once the daily ships on this path: city seeds
// (4 draws each) → party roll (raster) → [0-city fallback shuffle] → real
// densities (raster) → corrective flips (walk order) → grey blobs (guarded).
// Reordering any of it re-rolls every seeded board.

const NATURAL = {
  WARP_FULL_AT: 8,  // warp amplitude ramps 0→full over this raw distance
  SIZE_MIN: 0.85,   // per-city footprint multiplier: 0.85–1.15
  SIZE_SPAN: 0.3
};

// Multi-octave sine warp; `phase` gives each city its own outline.
function naturalWarp(x, y, phase) {
  return Math.sin(x * 0.18 + y * 0.13 + phase) * 3.0
    + Math.sin(x * 0.37 + y * 0.29 + phase * 2) * 2.0
    + Math.sin(x * 0.73 + y * 0.61 + phase) * 1.2;
}

// Warped effective distance to the nearest city. Amplitude scales with raw
// distance, so downtown stays a solid disc while the fringe goes ragged.
function naturalDist(citySeeds, x, y) {
  let best = Infinity;
  for (const s of citySeeds) {
    const dx = x - s.x, dy = y - s.y;
    const raw = Math.sqrt(dx * dx + dy * dy);
    const amp = Math.min(1, raw / NATURAL.WARP_FULL_AT);
    const d = raw / s.size + amp * naturalWarp(x, y, s.phase);
    if (d < best) best = d;
  }
  return best;
}

// Density by NORMALIZED distance u = d / urbanEdge — the gradient is anchored
// to the city's political extent, so every city runs bright core → dim fringe
// and ends dim AT its own edge, whatever the day's vote split sizes it to.
// (Absolute-distance tiers failed here: at underdog splits the fitted city is
// small and its edge would still be dense — a bright cliff.) Red keeps a dim
// belt just outside the edge — that sparseness IS the seam.
function naturalDensity(u, party, rng) {
  if (party !== 0) {
    if (u < 1.35) return 2 + Math.floor(rng() * 3); // dim belt outside the edge
    return 1 + Math.floor(rng() * 3);               // rural
  }
  if (u < 0.25) return 20 + Math.floor(rng() * 11); // core
  if (u < 0.5) return 14 + Math.floor(rng() * 7);   // urban
  if (u < 0.75) return 8 + Math.floor(rng() * 7);   // inner suburb
  if (u < 1) return 4 + Math.floor(rng() * 6);      // outer suburb (dim edge)
  return 1 + Math.floor(rng() * 3);                 // rural blue speck
}

// Deterministic tier midpoints — lets share passes run BEFORE any density rng
// is spent (real densities depend on final parties).
function naturalDensityMid(u, party) {
  if (party !== 0) return u < 1.35 ? 3 : 2;
  if (u < 0.25) return 25;
  if (u < 0.5) return 17;
  if (u < 0.75) return 11;
  if (u < 1) return 6;
  return 2;
}

function generateNaturalBoard(gridSize, bluePercentage, numCities, polarization, rng, greyPercentage, communityPercentage = 0) {
  const citySeeds = [];
  for (let i = 0; i < numCities; i++) {
    citySeeds.push({
      x: rng() * gridSize,
      y: rng() * gridSize,
      phase: rng() * Math.PI * 2,
      size: NATURAL.SIZE_MIN + rng() * NATURAL.SIZE_SPAN
    });
  }

  const polarizationFactor = polarization / 100;
  const cityBluePct = 50 + 45 * polarizationFactor;
  const ruralBluePct = 15 - 10 * polarizationFactor;

  // Distance field once (no rng).
  const dist = [];
  for (let y = 0; y < gridSize; y++) {
    dist[y] = [];
    for (let x = 0; x < gridSize; x++) {
      dist[y][x] = citySeeds.length ? naturalDist(citySeeds, x, y) : Infinity;
    }
  }

  // Size the political city boundary to the TARGET SHARE up front (binary
  // search on tier midpoints — zero rng): a fixed radius would overshoot at
  // underdog splits and the share passes would then peel away exactly the dim
  // suburb rings that display the density gradient. With T fitted, the passes
  // only fine-tune the edge. Low targets → compact cities, high targets →
  // honest sprawl — and since density tiers are u = d/T, the full bright→dim
  // gradient fits inside the city either way.
  const expectedShare = (T) => {
    let blue = 0, total = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const u = dist[y][x] / T;
        const p = (u < 1 ? cityBluePct : ruralBluePct) / 100;
        blue += p * naturalDensityMid(u, 0);
        total += p * naturalDensityMid(u, 0) + (1 - p) * naturalDensityMid(u, 1);
      }
    }
    return blue / total;
  };
  const targetShare = bluePercentage / 100;
  let urbanEdge = 1; // any positive value works for the 0-city board (u = ∞)
  if (citySeeds.length) {
    let lo = 0.5, hi = gridSize * 1.5;
    for (let it = 0; it < 24; it++) {
      const mid = (lo + hi) / 2;
      if (expectedShare(mid) < targetShare) lo = mid; else hi = mid;
    }
    urbanEdge = (lo + hi) / 2;
  }

  // Normalized distance field + party as a hard step on the fitted boundary.
  const partyMap = [];
  const uOf = [];
  for (let y = 0; y < gridSize; y++) {
    partyMap[y] = [];
    uOf[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const u = dist[y][x] / urbanEdge;
      uOf[y][x] = u;
      partyMap[y][x] = rng() * 100 < (u < 1 ? cityBluePct : ruralBluePct) ? 0 : 1;
    }
  }

  // Cells ordered near→far. Share passes walk this: a blue surplus peels from
  // the FAR end in (fringe first, cores last), a deficit grows blue from the
  // NEAR end out — so the city edge moves, never the core. With no cities
  // every distance ties at Infinity, so shuffle instead: scattered speckle,
  // like the legacy model's 0-city boards.
  const cells = [];
  for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) cells.push({ x, y });
  if (citySeeds.length) {
    cells.sort((a, b) => dist[a.y][a.x] - dist[b.y][b.x]);
  } else {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
  }

  // Pass 1 — approximate the target share on tier midpoints (no rng spent).
  let blueMid = 0, totalMid = 0;
  for (const { x, y } of cells) {
    const m = naturalDensityMid(uOf[y][x], partyMap[y][x]);
    totalMid += m;
    if (partyMap[y][x] === 0) blueMid += m;
  }
  if (blueMid / totalMid > targetShare) {
    for (let i = cells.length - 1; i >= 0 && blueMid / totalMid > targetShare; i--) {
      const { x, y } = cells[i];
      if (partyMap[y][x] !== 0) continue;
      const u = uOf[y][x];
      blueMid -= naturalDensityMid(u, 0);
      totalMid += naturalDensityMid(u, 1) - naturalDensityMid(u, 0);
      partyMap[y][x] = 1;
    }
  } else {
    for (let i = 0; i < cells.length && blueMid / totalMid < targetShare; i++) {
      const { x, y } = cells[i];
      if (partyMap[y][x] !== 1) continue;
      const u = uOf[y][x];
      blueMid += naturalDensityMid(u, 0);
      totalMid += naturalDensityMid(u, 0) - naturalDensityMid(u, 1);
      partyMap[y][x] = 0;
    }
  }

  // Real densities (the dim seam lands here), raster order.
  const densityMap = [];
  let bluePop = 0, totalPop = 0;
  for (let y = 0; y < gridSize; y++) {
    densityMap[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const v = naturalDensity(uOf[y][x], partyMap[y][x], rng);
      densityMap[y][x] = v;
      totalPop += v;
      if (partyMap[y][x] === 0) bluePop += v;
    }
  }

  // Pass 2 — corrective: land the REAL share on target. A flipped cell
  // re-rolls its density into the new party's tier (keeps the seam dim);
  // both population totals are tracked through each flip.
  let guard = gridSize * gridSize;
  if (bluePop / totalPop > targetShare) {
    for (let i = cells.length - 1; i >= 0 && bluePop / totalPop > targetShare && guard-- > 0; i--) {
      const { x, y } = cells[i];
      if (partyMap[y][x] !== 0) continue;
      const oldD = densityMap[y][x];
      const newD = naturalDensity(uOf[y][x], 1, rng);
      partyMap[y][x] = 1;
      densityMap[y][x] = newD;
      bluePop -= oldD;
      totalPop += newD - oldD;
    }
  } else {
    for (let i = 0; i < cells.length && bluePop / totalPop < targetShare && guard-- > 0; i++) {
      const { x, y } = cells[i];
      if (partyMap[y][x] !== 1) continue;
      const oldD = densityMap[y][x];
      const newD = naturalDensity(uOf[y][x], 0, rng);
      partyMap[y][x] = 0;
      densityMap[y][x] = newD;
      bluePop += newD;
      totalPop += newD - oldD;
    }
  }

  // Same contract as the legacy path: grey must consume zero rng when off.
  if (greyPercentage > 0) {
    applyGreyBlobs(partyMap, densityMap, gridSize, greyPercentage, totalPop, rng);
  }

  // HARD GUARD on 0 (like grey): a community layer must consume zero rng and
  // add no keys when off, or every seeded board silently changes.
  if (communityPercentage > 0) {
    const community = growCommunity(gridSize, densityMap, communityPercentage, totalPop, rng);
    return { party: partyMap, density: densityMap, community };
  }

  return { party: partyMap, density: densityMap };
}

// Grows a fictional "community of interest" as a SEPARATE contiguous boolean
// overlay (1–2 blobs) covering ~communityPercentage of the density-weighted
// population — independent of party, so packing/cracking it is its own puzzle.
// Same blob-claim shape as applyGreyBlobs, but never touches party/density.
function growCommunity(gridSize, densityMap, communityPercentage, totalPop, rng) {
  const target = (totalPop * communityPercentage) / 100;
  const community = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
  const numBlobs = 1 + Math.floor(rng() * 2); // 1–2
  const seeds = [];
  for (let i = 0; i < numBlobs; i++) seeds.push({ x: rng() * gridSize, y: rng() * gridSize });

  const scored = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let minDist = Infinity;
      for (const s of seeds) {
        const dx = x - s.x, dy = y - s.y;
        minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
      }
      const noise = Math.sin(x * 0.4 + y * 0.3) * 1.5 + Math.sin(x * 0.2 + y * 0.6) * 1.5;
      scored.push({ x, y, score: minDist + noise });
    }
  }
  scored.sort((a, b) => a.score - b.score);

  let pop = 0;
  for (const { x, y } of scored) {
    if (pop >= target) break;
    community[y][x] = true;
    pop += densityMap[y][x];
  }
  return community;
}

// Marks ~greyPercentage of the population (density-weighted) as undecided
// (party 3), grown as 3–6 contiguous blobs: cells are claimed in order of
// noisy distance to the nearest blob seed, so each blob is an organic disc.
// Clusters are deliberately spatial — the reveal breaks them together, which
// is what makes a big grey cluster a strategic risk rather than averaged-out
// noise.
function applyGreyBlobs(partyMap, densityMap, gridSize, greyPercentage, totalPop, rng) {
  const targetGrey = totalPop * greyPercentage / 100;
  const numBlobs = 3 + Math.floor(rng() * 4); // 3–6
  const seeds = [];
  for (let i = 0; i < numBlobs; i++) {
    seeds.push({ x: rng() * gridSize, y: rng() * gridSize });
  }

  const scored = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let minDist = Infinity;
      for (const s of seeds) {
        const dx = x - s.x, dy = y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
      const boundaryNoise = Math.sin(x * 0.5 + y * 0.3) * 1.5 + Math.sin(x * 0.2 + y * 0.7) * 1.5;
      scored.push({ x, y, score: minDist + boundaryNoise });
    }
  }
  scored.sort((a, b) => a.score - b.score);

  let greyPop = 0;
  for (const { x, y } of scored) {
    if (greyPop >= targetGrey) break;
    partyMap[y][x] = 3;
    greyPop += densityMap[y][x];
  }
}

// Shares the natural model's look (N6): warped non-round cities via
// naturalDist and the u-anchored density gradient. Party stays this mode's own
// three-way zone model + rebalance passes — the 2-party dim-seam/share-fitting
// don't apply here (three targets, sandbox-only, nothing frozen).
export function generatePopulationMap3Party(gridSize, bluePercentage, greenPercentage, numCities, numTowns = 3, rng = Math.random) {
  // The urban party zones end at 15 (75/10 band) — the density gradient is
  // anchored to that same extent so both feather out together.
  const URBAN_EXTENT = 15;
  const citySeeds = placeSeeds(numCities, gridSize, rng, {
    make: (x, y) => ({
      x, y,
      phase: rng() * Math.PI * 2,
      size: NATURAL.SIZE_MIN + rng() * NATURAL.SIZE_SPAN
    })
  });
  const cityDist = (x, y) => citySeeds.length ? naturalDist(citySeeds, x, y) : Infinity;

  // Small-town seeds: placed at least 20 units from any city (or anywhere if no cities)
  const townSeeds = placeSeeds(numTowns, gridSize, rng, {
    maxAttempts: 200,
    accept: (x, y) => distToNearest(citySeeds, x, y) > 20
  });

  // Green rural patches: larger zones in deep rural that give green geographic coherence
  // (prevents a random red/green mosaic — instead creates distinct red and green areas)
  const numGreenPatches = 3 + Math.floor(rng() * 4); // 3–6
  const greenRuralPatches = placeSeeds(numGreenPatches, gridSize, rng, {
    maxAttempts: 300,
    accept: (x, y) => distToNearest(citySeeds, x, y) > 25 && distToNearest(townSeeds, x, y) > 8,
    make: (x, y) => ({ x, y, r: 8 + rng() * 10 })
  });

  const partyMap = [];
  const densityMap = [];

  for (let y = 0; y < gridSize; y++) {
    partyMap[y] = [];
    densityMap[y] = [];
    for (let x = 0; x < gridSize; x++) {
      // Warped distance → the 8/15/25 zone boundaries go organic per city.
      const distCity = cityDist(x, y);
      const distTown = distToNearest(townSeeds, x, y);
      const inGreenPatch = inAnyPatch(greenRuralPatches, x, y);

      let bluePct, redPct;
      if (distCity < 8) {
        bluePct = 85; redPct = 8;   // green = 7
      } else if (distCity < 15) {
        bluePct = 75; redPct = 10;  // green = 15
      } else if (distCity < 25) {
        bluePct = 25; redPct = 35;  // green = 40
      } else if (distTown < 6) {
        bluePct = 5;  redPct = 20;  // green = 75
      } else if (inGreenPatch) {
        bluePct = 3;  redPct = 22;  // green = 75 — rural green patch
      } else {
        bluePct = 2;  redPct = 97;  // green = 1 — solid red rural
      }

      const roll = rng() * 100;
      if (roll < bluePct) partyMap[y][x] = 0;
      else if (roll < bluePct + redPct) partyMap[y][x] = 1;
      else partyMap[y][x] = 2;
    }
  }

  const sparsePatches = makeSparsePatches(gridSize, rng);

  // Density: the natural u-anchored gradient inside the urban extent (blue
  // bright core → dim fringe; red/green specks stay sparse); small-town green
  // keeps its dense nub; countryside keeps its sparse patches.
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const u = cityDist(x, y) / URBAN_EXTENT;
      const distTown = distToNearest(townSeeds, x, y);

      if (u < 1) {
        densityMap[y][x] = naturalDensity(u, partyMap[y][x] === 0 ? 0 : 1, rng);
      } else if (distTown < 6) {
        densityMap[y][x] = 4 + Math.floor(rng() * 6);
      } else {
        densityMap[y][x] = ruralCellDensity(sparsePatches, x, y, rng);
      }
    }
  }

  let totalPop = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < gridSize; x++)
      totalPop += densityMap[y][x];

  const targetBlue = Math.round(totalPop * bluePercentage / 100);
  const targetGreen = Math.round(totalPop * greenPercentage / 100);

  // Adjust blue (convert any non-blue ↔ blue), then green (red ↔ green only,
  // leaving blue intact)
  rebalancePartyShare(partyMap, densityMap, shuffledCells(gridSize, rng), targetBlue, 0, p => p !== 0, 1);
  rebalancePartyShare(partyMap, densityMap, shuffledCells(gridSize, rng), targetGreen, 2, p => p === 1, 1);

  return { party: partyMap, density: densityMap };
}
