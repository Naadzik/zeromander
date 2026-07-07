import { useEffect, useRef } from 'react'
import { extractPopulationData } from '../utils/formatUtils'
import {
  parseHex,
  strokeRegionBoundary,
  strokeAllBoundaries,
  fillCells,
  getCanvasTheme
} from '../utils/canvasDraw'
import '../styles/GhostMapComparison.css'

const DISTRICT_COLORS = [
  '#A78BFA', '#F472B6', '#22D3EE', '#34D399',
  '#FBBF24', '#818CF8', '#2DD4BF', '#E879F9',
  '#38BDF8', '#A3E635', '#FB923C', '#94A3B8'
];

// Read-only district map — no drag/hover/click handling, always renders the
// districts overlay. Used for the fair-map comparison, never for gameplay.
// `canvasRef` (optional) exposes the underlying <canvas> so a parent can
// stitch it into an exported share image.
export default function GhostMapCanvas({ populationMap, counties, districts, size = 400, canvasRef: externalRef, view = 'districts' }) {
  const localRef = useRef(null);
  const canvasRef = externalRef ?? localRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !populationMap || !(populationMap.party || populationMap.length > 0) || !districts) return;
    const ctx = canvas.getContext('2d');

    const theme = getCanvasTheme();
    const { partyMap, densityMap } = extractPopulationData(populationMap);
    const gridSize = partyMap.length;
    const cellSize = canvas.width / gridSize;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const party = partyMap[y][x];
        const density = densityMap ? densityMap[y][x] : 1;
        const [r, g, b] = parseHex(theme.party[party]);
        const alpha = 0.35 + (density / 10) * 0.65;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    const numDistricts = Math.max(...districts.flat().filter(d => d > 0), 0);
    for (let districtId = 1; districtId <= numDistricts; districtId++) {
      const color = DISTRICT_COLORS[(districtId - 1) % DISTRICT_COLORS.length];
      // 'party' view leaves the party colors readable — no fill overlay, just
      // district outlines (in a light neutral) so the shapes still show.
      if (view === 'districts') {
        fillCells(ctx, districts, v => v === districtId, cellSize, color + '99');
        ctx.strokeStyle = color;
      } else {
        ctx.strokeStyle = 'rgba(233, 238, 245, 0.6)';
      }
      ctx.lineWidth = 2;
      strokeRegionBoundary(ctx, districts, v => v === districtId, cellSize);
    }

    ctx.strokeStyle = theme.countyBorder;
    ctx.lineWidth = 1;
    strokeAllBoundaries(ctx, counties, cellSize);
  }, [populationMap, counties, districts, view]);

  return (
    <canvas ref={canvasRef} className="ghost-map-canvas" width={size} height={size} />
  );
}
