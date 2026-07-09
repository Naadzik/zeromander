import { useEffect, useRef } from 'react'
import { useTheme } from '../hooks/useTheme'
import { extractPopulationData } from '../utils/formatUtils'
import {
  parseHex,
  strokeRegionBoundary,
  strokeAllBoundaries,
  fillCells,
  computeDistrictWinners,
  getCanvasTheme
} from '../utils/canvasDraw'
import '../styles/GhostMapComparison.css'

// 'population' view lerp — diverging heat of where people moved vs. a baseline
// year. Colors come from getCanvasTheme() (party-neutral green gain / rust
// loss, so it never reads as a party map).
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

// Read-only district map — no drag/hover/click handling, always renders the
// districts overlay. Used for the fair-map comparison, never for gameplay.
// `canvasRef` (optional) exposes the underlying <canvas> so a parent can
// stitch it into an exported share image.
export default function GhostMapCanvas({ populationMap, counties, districts, size = 400, canvasRef: externalRef, view = 'districts', districtWinners = null, baselineDensity = null, popScale = null }) {
  const localRef = useRef(null);
  const canvasRef = externalRef ?? localRef;
  // Redraw trigger only — colors resolve from CSS vars via getCanvasTheme().
  const { theme: edition } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !populationMap || !(populationMap.party || populationMap.length > 0) || !districts) return;
    const ctx = canvas.getContext('2d');

    const theme = getCanvasTheme();
    const { partyMap, densityMap, communityMap } = extractPopulationData(populationMap);
    const gridSize = partyMap.length;
    const cellSize = canvas.width / gridSize;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // In 'party' view each district is filled solid with its WINNING party's
    // color — the same seat map the live board shows — so the two panels read
    // as "who holds which seat" and can be compared at a glance. The other
    // views keep the raw per-cell voter colors, density-faded. `districtWinners`
    // (optional) overrides the computed winners — decade mode passes a specific
    // election's result so the map shows that year, swing and all.
    const districtWinner = view === 'party'
      ? (districtWinners ?? computeDistrictWinners(partyMap, densityMap, districts))
      : {};

    // 'population' colors each cell by its PERCENT change vs. the baseline year
    // (like a Census county % -change map) so a rural area losing a big share
    // reads as strongly as a dense city gaining one. Auto-scaled to the biggest
    // move on screen so even a realistic (small) decade shift stays legible.
    // `popScale` (optional) fixes the color scale across a whole decade so the
    // heat BUILDS year to year (an early year looks fainter than the last),
    // rather than each frame self-scaling to look equally intense.
    const popMode = view === 'population' && baselineDensity && densityMap;
    let maxRel = popScale ?? 0;
    if (popMode && popScale == null) {
      for (let y = 0; y < gridSize; y++)
        for (let x = 0; x < gridSize; x++) {
          const base = baselineDensity[y][x];
          if (base > 0) maxRel = Math.max(maxRel, Math.abs((densityMap[y][x] - base) / base));
        }
    }

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const d = districts[y][x];
        if (view === 'party' && d > 0 && districtWinner[d] !== undefined) {
          const [r, g, b] = parseHex(theme.party[districtWinner[d]]);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else if (popMode) {
          const base = baselineDensity[y][x];
          const rel = base > 0 ? (densityMap[y][x] - base) / base : 0;
          const t = maxRel > 0 ? Math.max(-1, Math.min(1, rel / maxRel)) : 0;
          const to = t >= 0 ? theme.popGain : theme.popLoss;
          const m = Math.abs(t);
          ctx.fillStyle = `rgb(${lerp(theme.popNeutral[0], to[0], m)}, ${lerp(theme.popNeutral[1], to[1], m)}, ${lerp(theme.popNeutral[2], to[2], m)})`;
        } else {
          const party = partyMap[y][x];
          const density = densityMap ? densityMap[y][x] : 1;
          const [r, g, b] = parseHex(theme.party[party]);
          const alpha = 0.35 + (density / 10) * 0.65;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // 'original' shows the raw battleground with no district lines at all;
    // 'districts' fills each district a distinct color; 'party' leaves the
    // winner-filled seats and just outlines the districts in their winner color.
    if (view !== 'original') {
      const numDistricts = Math.max(...districts.flat().filter(d => d > 0), 0);
      for (let districtId = 1; districtId <= numDistricts; districtId++) {
        if (view === 'districts') {
          const color = theme.districts[(districtId - 1) % theme.districts.length];
          fillCells(ctx, districts, v => v === districtId, cellSize, color + '99');
          ctx.strokeStyle = color;
        } else if (view === 'population') {
          // Faint outlines just for context — the heat is the story here.
          ctx.strokeStyle = theme.popOutline;
        } else {
          ctx.strokeStyle = theme.partyBorder[districtWinner[districtId]] ?? 'rgba(233, 238, 245, 0.6)';
        }
        ctx.lineWidth = view === 'population' ? 1.2 : 2;
        strokeRegionBoundary(ctx, districts, v => v === districtId, cellSize);
      }
    }

    ctx.strokeStyle = (view === 'party' || view === 'population') ? theme.countyBorderParty : theme.countyBorder;
    ctx.lineWidth = 1;
    strokeAllBoundaries(ctx, counties, cellSize);

    // Community-of-interest overlay (VRA layer) — amber dashed outline, same as
    // the game canvas, so the comparison shows the community too.
    if (communityMap) {
      ctx.save();
      ctx.strokeStyle = theme.community;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 3]);
      strokeRegionBoundary(ctx, communityMap, v => v === true, cellSize);
      ctx.restore();
    }
  }, [populationMap, counties, districts, view, districtWinners, baselineDensity, popScale, edition]);

  return (
    <canvas ref={canvasRef} className="ghost-map-canvas" width={size} height={size} />
  );
}
