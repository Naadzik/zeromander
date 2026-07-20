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

// Winner per assigned district: party index 0 (blue), 1 (red), 2 (green) — or
// 3 (grey) when the seat is NOT YET DECIDED because undecided voters could
// still take it. A district paints grey when the leader's margin is within
// the district's undecided population (|blue − red| ≤ greyPop) — the same
// "not banked" band the seat bar and the district-detail "?" already use, so
// the map now agrees with them instead of flattering a 21-vote lead over 571
// undecideds into a solid blue seat. All-undecided districts (no decided
// votes) are the greyPop ≥ 0 = margin 0 case of the same rule. Post-reveal
// the grey has resolved (greyPop 0), so this reduces to the plain winner with
// blue-beats-red / green-strictly-wins tie-breaks — the frozen behavior.
export function computeDistrictWinners(partyMap, densityMap, districts) {
  const gridSize = partyMap.length;
  const voteCounts = {};
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const d = districts[y][x];
      if (d > 0) {
        if (!voteCounts[d]) voteCounts[d] = { blue: 0, red: 0, green: 0, grey: 0 };
        const density = densityMap ? densityMap[y][x] : 1;
        if (partyMap[y][x] === 0) voteCounts[d].blue += density;
        else if (partyMap[y][x] === 1) voteCounts[d].red += density;
        else if (partyMap[y][x] === 2) voteCounts[d].green += density;
        else voteCounts[d].grey += density; // undecided — no vote until the reveal
      }
    }
  }
  const winners = {};
  for (const [id, votes] of Object.entries(voteCounts)) {
    const decided = votes.blue + votes.red + votes.green;
    // Undecided outnumber the two-party margin ⇒ the seat is a tossup; show it
    // grey, not the current leader's color. (Guarded to 2-party boards: grey
    // is forced to 0 in three-party mode, so this never mislabels a green win.)
    if (decided === 0 || (votes.green === 0 && votes.grey >= Math.abs(votes.blue - votes.red))) winners[id] = 3;
    else if (votes.blue >= votes.red && votes.blue >= votes.green) winners[id] = 0;
    else if (votes.green > votes.blue && votes.green > votes.red) winners[id] = 2;
    else winners[id] = 1;
  }
  return winners;
}

// District overlay palette fallbacks — the tokens (--district-1..12) are the
// source of truth; this array only covers a missing token. Lifted lightness/
// saturation so overlays stay legible on the navy map.
const DISTRICT_FALLBACKS = [
  '#A78BFA', '#F472B6', '#22D3EE', '#34D399',
  '#FBBF24', '#818CF8', '#2DD4BF', '#E879F9',
  '#38BDF8', '#A3E635', '#FB923C', '#94A3B8'
];

// All canvas colors in one place, resolved from CSS variables with the current
// look as fallback — restyling the map means changing tokens, not draw code.
// NOTE: `districts`, `community` and `hover` must stay 6-digit #RRGGBB (draw
// code appends hex alpha pairs); popGain/Loss/Neutral are returned pre-parsed
// as [r,g,b] because the population view lerps channels.
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
    unassignedFill: v('--canvas-unassigned', 'rgba(245, 158, 11, 0.2)'),
    districts: DISTRICT_FALLBACKS.map((fb, i) => v(`--district-${i + 1}`, fb)),
    community: v('--canvas-community', '#FBBF24'),
    popGain: parseHex(v('--canvas-pop-gain', '#34D399')),
    popLoss: parseHex(v('--canvas-pop-loss', '#E2844A')),
    popNeutral: parseHex(v('--canvas-pop-neutral', '#222C3E')),
    popOutline: v('--canvas-pop-outline', 'rgba(233, 238, 245, 0.28)')
  };
}
