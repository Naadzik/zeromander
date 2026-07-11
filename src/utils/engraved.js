// The Broadsheet's map engine: an engraved atlas plate. Instead of flat color
// fills, party is encoded by HATCHING DIRECTION and population density by
// hatch WEIGHT — the visual grammar of 19th-century printed election maps:
//   blue  (0) — horizontal lines        red  (1) — diagonal lines (45°)
//   green (2) — vertical lines          grey (3) — dot stipple
// Patterns are canvas-global, so hatching flows continuously across a region
// instead of restarting at every cell. Pure presentation: the grid data and
// all hit-testing are untouched.

// Density buckets → hatch spacing/weight AND wash strength. Denser population
// = tighter, heavier engraving over a deeper hand-tinted color wash — the
// look of a tinted lithograph, so party still reads in color at a glance.
const BUCKETS = [
  { max: 3, spacing: 7, lineWidth: 0.7, dotR: 0.7, tint: 0.16 },
  { max: 6, spacing: 5, lineWidth: 0.9, dotR: 0.9, tint: 0.26 },
  { max: 8, spacing: 4, lineWidth: 1.1, dotR: 1.1, tint: 0.36 },
  { max: Infinity, spacing: 3, lineWidth: 1.4, dotR: 1.3, tint: 0.48 },
];
const bucketFor = d => BUCKETS.find(b => d <= b.max);

// Blend party ink onto paper at `t` — the hand-tint under the hatching.
function mix(paperHex, inkHex, t) {
  const p = paperHex.match(/\w\w/g).map(h => parseInt(h, 16));
  const k = inkHex.match(/\w\w/g).map(h => parseInt(h, 16));
  const c = p.map((v, i) => Math.round(v + (k[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const PARTY_STYLE = ['horizontal', 'diagonal', 'vertical', 'stipple'];

// Pattern cache keyed by everything that affects the tile. Colors come from
// the live theme, so an edition/theme switch produces new keys automatically.
const patternCache = new Map();

function makeTile(style, ink, paper, spacing, lineWidth, dotR) {
  const tile = document.createElement('canvas');
  // Diagonal tiles must be square with the line drawn corner-to-corner so the
  // pattern repeat is seamless; others repeat on one axis.
  tile.width = spacing;
  tile.height = spacing;
  const t = tile.getContext('2d');
  t.fillStyle = paper;
  t.fillRect(0, 0, spacing, spacing);
  t.strokeStyle = ink;
  t.fillStyle = ink;
  t.lineWidth = lineWidth;
  if (style === 'horizontal') {
    t.beginPath(); t.moveTo(0, 0.5); t.lineTo(spacing, 0.5); t.stroke();
  } else if (style === 'vertical') {
    t.beginPath(); t.moveTo(0.5, 0); t.lineTo(0.5, spacing); t.stroke();
  } else if (style === 'diagonal') {
    // Three strokes so the corner-crossing line repeats without gaps.
    t.beginPath();
    t.moveTo(-1, 1); t.lineTo(1, -1);
    t.moveTo(-1, spacing + 1); t.lineTo(spacing + 1, -1);
    t.moveTo(spacing - 1, spacing + 1); t.lineTo(spacing + 1, spacing - 1);
    t.stroke();
  } else { // stipple
    t.beginPath(); t.arc(spacing / 2, spacing / 2, dotR, 0, Math.PI * 2); t.fill();
  }
  return tile;
}

// getEngravedPattern(ctx, theme, party, density) → CanvasPattern
export function getEngravedPattern(ctx, theme, party, density) {
  const b = bucketFor(density ?? 1);
  const ink = theme.denseOutline[party] ?? theme.party[party];
  const paper = theme.background;
  // The readability fix: hatch over a party-tinted wash, not bare paper —
  // regions read blue/red at a glance, density deepens the tint.
  const wash = mix(paper, theme.party[party] ?? ink, b.tint);
  const style = PARTY_STYLE[party] ?? 'stipple';
  const key = `${style}|${ink}|${wash}|${b.spacing}|${b.lineWidth}`;
  let pat = patternCache.get(key);
  if (!pat) {
    pat = ctx.createPattern(makeTile(style, ink, wash, b.spacing, b.lineWidth, b.dotR), 'repeat');
    patternCache.set(key, pat);
    if (patternCache.size > 128) patternCache.clear(); // theme churn guard
  }
  return pat;
}

// Strong uniform pattern for whole-district fills (the 'party' seat view).
export function getEngravedSeatPattern(ctx, theme, party) {
  return getEngravedPattern(ctx, theme, party, 9);
}

// Typeset district numerals at each district's centroid — the atlas-plate
// label. Paper halo behind ink text keeps numerals legible over hatching.
export function drawDistrictNumerals(ctx, districts, cellSize, theme, currentDistrict = null) {
  const gridSize = districts.length;
  const sums = new Map(); // id → {x, y, n}
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const d = districts[y][x];
      if (d > 0) {
        const s = sums.get(d) ?? { x: 0, y: 0, n: 0 };
        s.x += x; s.y += y; s.n++;
        sums.set(d, s);
      }
    }
  }
  const px = Math.max(14, Math.round(cellSize * 2.2));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${px}px 'Newsreader', Georgia, serif`;
  for (const [id, s] of sums) {
    const cx = (s.x / s.n + 0.5) * cellSize;
    const cy = (s.y / s.n + 0.5) * cellSize;
    ctx.lineWidth = Math.max(3, px / 5);
    ctx.strokeStyle = theme.background;
    ctx.strokeText(String(id), cx, cy);
    ctx.fillStyle = id === currentDistrict ? theme.hover : theme.denseOutline[3];
    ctx.fillText(String(id), cx, cy);
  }
  ctx.restore();
}
