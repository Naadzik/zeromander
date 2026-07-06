export function parseHex(hex) {
  const m = hex.match(/\w\w/g);
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

// Draw only the one cell-edge that faces outward (dx,dy direction).
export function strokeEdge(ctx, x, y, dx, dy, cellSize) {
  ctx.beginPath();
  if (dx === 1) {
    ctx.moveTo((x + 1) * cellSize, y * cellSize);
    ctx.lineTo((x + 1) * cellSize, (y + 1) * cellSize);
  } else if (dx === -1) {
    ctx.moveTo(x * cellSize, y * cellSize);
    ctx.lineTo(x * cellSize, (y + 1) * cellSize);
  } else if (dy === 1) {
    ctx.moveTo(x * cellSize, (y + 1) * cellSize);
    ctx.lineTo((x + 1) * cellSize, (y + 1) * cellSize);
  } else {
    ctx.moveTo(x * cellSize, y * cellSize);
    ctx.lineTo((x + 1) * cellSize, y * cellSize);
  }
  ctx.stroke();
}

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

// Stroke every outward-facing edge of the region where matches(value) is true.
export function strokeRegionBoundary(ctx, grid, matches, cellSize) {
  const gridSize = grid.length;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!matches(grid[y][x])) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || !matches(grid[ny][nx])) {
          strokeEdge(ctx, x, y, dx, dy, cellSize);
        }
      }
    }
  }
}

// Stroke every edge between two cells with different values (e.g. all county lines).
export function strokeAllBoundaries(ctx, grid, cellSize) {
  const gridSize = grid.length;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const value = grid[y][x];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || grid[ny][nx] !== value) {
          strokeEdge(ctx, x, y, dx, dy, cellSize);
        }
      }
    }
  }
}

export function fillCells(ctx, grid, matches, cellSize, fillStyle) {
  ctx.fillStyle = fillStyle;
  const gridSize = grid.length;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (matches(grid[y][x])) ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

// Winner per assigned district: party index 0 (blue), 1 (red) or 2 (green).
// Ties: blue beats red and green; green must strictly beat both.
export function computeDistrictWinners(partyMap, densityMap, districts) {
  const gridSize = partyMap.length;
  const voteCounts = {};
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const d = districts[y][x];
      if (d > 0) {
        if (!voteCounts[d]) voteCounts[d] = { blue: 0, red: 0, green: 0 };
        const density = densityMap ? densityMap[y][x] : 1;
        if (partyMap[y][x] === 0) voteCounts[d].blue += density;
        else if (partyMap[y][x] === 1) voteCounts[d].red += density;
        else if (partyMap[y][x] === 2) voteCounts[d].green += density;
        // grey (3) is undecided — no vote until the reveal
      }
    }
  }
  const winners = {};
  for (const [id, votes] of Object.entries(voteCounts)) {
    if (votes.blue >= votes.red && votes.blue >= votes.green) winners[id] = 0;
    else if (votes.green > votes.blue && votes.green > votes.red) winners[id] = 2;
    else winners[id] = 1;
  }
  return winners;
}

// All canvas colors in one place, resolved from CSS variables with the current
// look as fallback — restyling the map means changing tokens, not draw code.
export function getCanvasTheme() {
  const cssVars = getComputedStyle(document.documentElement);
  const v = (name, fallback) => (cssVars.getPropertyValue(name) || fallback).trim();
  // Indexed by party cell value: 0 blue, 1 red, 2 green, 3 grey (undecided).
  const party = [
    v('--blue-party', '#3B82F6'),
    v('--red-party', '#EF4444'),
    v('--green-party', '#16A34A'),
    v('--grey-party', '#94A3B8')
  ];
  return {
    background: v('--canvas-bg', '#F8F9FA'),
    party,
    denseOutline: [
      v('--blue-party-deep', '#1E40AF'),
      v('--red-party-deep', '#991B1B'),
      v('--green-party-deep', '#14532D'),
      v('--grey-party-deep', '#64748B')
    ],
    partyBorder: [
      v('--canvas-blue-border', '#1D4ED8'),
      v('--canvas-red-border', '#B91C1C'),
      v('--canvas-green-border', '#14532D'),
      v('--canvas-grey-border', '#64748B')
    ],
    countyBorder: v('--canvas-county-border', 'rgba(80, 80, 80, 0.6)'),
    countyBorderParty: v('--canvas-county-border-party', 'rgba(80, 80, 80, 0.15)'),
    hover: v('--canvas-hover', '#FFEB3B'),
    unassignedFill: v('--canvas-unassigned', 'rgba(245, 158, 11, 0.2)')
  };
}
