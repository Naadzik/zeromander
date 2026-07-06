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

// Density tiers shared by both generators: dense blue urban cores, sparse otherwise.
function cityCellDensity(distCity, party, rng) {
  if (party === 0) {
    if (distCity < 3) return 20 + Math.floor(rng() * 11);
    if (distCity < 5) return 15 + Math.floor(rng() * 6);
    return 10 + Math.floor(rng() * 6);
  }
  return 2 + Math.floor(rng() * 3);
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
// election-night reveal. Trailing param so existing call sites are untouched.
export function generatePopulationMap(gridSize, bluePercentage, numCities = 4, polarization = 50, rng = Math.random, greyPercentage = 0) {
  const partyMap = [];
  const densityMap = [];

  const citySeeds = placeSeeds(numCities, gridSize, rng, {
    make: (x, y) => ({ x, y, radius: 5 + rng() * 5 })
  });

  // At polarization=0 (balanced): cities are 50/50 random, rural is 15% blue (sparse)
  // At polarization=50 (moderate): cities 72.5% blue, rural 10% blue (very sparse)
  // At polarization=100 (extreme): cities 95% blue, rural 5% blue (extremely sparse)
  const polarizationFactor = polarization / 100;
  const cityBluePct = 50 + (45 * polarizationFactor);
  const ruralBluePct = 15 - (10 * polarizationFactor);

  for (let y = 0; y < gridSize; y++) {
    partyMap[y] = [];
    densityMap[y] = [];

    for (let x = 0; x < gridSize; x++) {
      const distToCity = distToNearest(citySeeds, x, y);

      // Add noise to city boundaries for irregular shapes
      const boundaryNoise = Math.sin(x * 0.3 + y * 0.4) * 2 + Math.sin(x * 0.7 + y * 0.2) * 2;
      const isCity = distToCity < (12 + boundaryNoise);
      const roll = rng() * 100;

      partyMap[y][x] = roll < (isCity ? cityBluePct : ruralBluePct) ? 0 : 1;
    }
  }

  const sparsePatches = makeSparsePatches(gridSize, rng);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const distToCity = distToNearest(citySeeds, x, y);
      if (distToCity < 12) {
        densityMap[y][x] = cityCellDensity(distToCity, partyMap[y][x], rng);
      } else {
        densityMap[y][x] = ruralCellDensity(sparsePatches, x, y, rng);
      }
    }
  }

  let totalPop = 0;
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < gridSize; x++)
      totalPop += densityMap[y][x];

  const cells = shuffledCells(gridSize, rng);
  const targetBlue = Math.round(totalPop * bluePercentage / 100);
  rebalancePartyShare(partyMap, densityMap, cells, targetBlue, 0, p => p === 1, 1);

  // HARD GUARD on 0: this block must consume zero rng draws when grey is off,
  // or every seeded (daily) board silently changes. Do not "simplify" this.
  if (greyPercentage > 0) {
    applyGreyBlobs(partyMap, densityMap, gridSize, greyPercentage, totalPop, rng);
  }

  return {
    party: partyMap,
    density: densityMap
  };
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

export function generatePopulationMap3Party(gridSize, bluePercentage, greenPercentage, numCities, numTowns = 3, rng = Math.random) {
  const citySeeds = placeSeeds(numCities, gridSize, rng);

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
      const distCity = distToNearest(citySeeds, x, y);
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

  // Density: mirrors normal mode for city cells; small-town green gets 4–9
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const distCity = distToNearest(citySeeds, x, y);
      const distTown = distToNearest(townSeeds, x, y);

      if (distCity < 12) {
        densityMap[y][x] = cityCellDensity(distCity, partyMap[y][x], rng);
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
