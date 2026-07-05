import { useEffect, useRef, useState } from 'react'
import { extractPopulationData } from '../utils/formatUtils'
import {
  parseHex,
  strokeRegionBoundary,
  strokeAllBoundaries,
  fillCells,
  computeDistrictWinners,
  getCanvasTheme
} from '../utils/canvasDraw'
import '../styles/GameCanvas.css'

// Lifted lightness/saturation so district overlays stay legible on the navy map.
const DISTRICT_COLORS = [
  '#A78BFA', '#F472B6', '#22D3EE', '#34D399',
  '#FBBF24', '#818CF8', '#2DD4BF', '#E879F9',
  '#38BDF8', '#A3E635', '#FB923C', '#94A3B8'
];

export default function GameCanvasCounty({
  populationMap,
  counties,
  districts,
  currentDistrict,
  onCountyClick,
  onCountyPaint,
  onDragStart,
  highlightedDistrict,
  showUnassignedCounties,
  mapView = 'districts'
}) {
  const canvasRef = useRef(null);
  const [hoveredCounty, setHoveredCounty] = useState(null);
  const dragStateRef = useRef({ active: false, mode: null, lastCountyId: null, pointerId: null });

  useEffect(() => {
    if (canvasRef.current && populationMap && (populationMap.party || populationMap.length > 0)) {
      drawMap();
    }
  }, [populationMap, counties, districts, currentDistrict, hoveredCounty, highlightedDistrict, showUnassignedCounties, mapView]);

  function drawMap() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const theme = getCanvasTheme();
    const { partyMap, densityMap } = extractPopulationData(populationMap);

    const gridSize = partyMap.length;
    const cellSize = canvas.width / gridSize;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const districtWinner = mapView === 'party'
      ? computeDistrictWinners(partyMap, densityMap, districts)
      : {};

    // Draw base cells
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const party = partyMap[y][x];
        const density = densityMap ? densityMap[y][x] : 1;
        const d = districts[y][x];

        if (mapView === 'party' && d > 0) {
          const [r, g, b] = parseHex(theme.party[districtWinner[d]]);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else {
          const [r, g, b] = parseHex(theme.party[party]);
          const alpha = 0.35 + (density / 10) * 0.65;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          if (density >= 7) {
            ctx.strokeStyle = theme.denseOutline[party];
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // 'districts' mode: colored overlay per district
    if (mapView === 'districts') {
      const numDistricts = Math.max(...districts.flat().filter(d => d > 0), 0);
      for (let districtId = 1; districtId <= numDistricts; districtId++) {
        const color = DISTRICT_COLORS[(districtId - 1) % DISTRICT_COLORS.length];
        const isHighlighted = highlightedDistrict === districtId;
        const isCurrent = currentDistrict === districtId;
        const opacity = isHighlighted ? 'E6' : (isCurrent ? 'AA' : '99');
        fillCells(ctx, districts, v => v === districtId, cellSize, color + opacity);
        ctx.strokeStyle = color;
        ctx.lineWidth = isHighlighted ? 3 : 2;
        strokeRegionBoundary(ctx, districts, v => v === districtId, cellSize);
      }
    }

    // 'party' mode: draw district borders using winning party color
    if (mapView === 'party') {
      const assignedDistricts = [...new Set(districts.flat().filter(d => d > 0))];
      for (const districtId of assignedDistricts) {
        const isHighlighted = highlightedDistrict === districtId;
        const isCurrent = currentDistrict === districtId;
        ctx.strokeStyle = theme.partyBorder[districtWinner[districtId]];
        ctx.lineWidth = isHighlighted ? 3 : (isCurrent ? 2.5 : 2);
        strokeRegionBoundary(ctx, districts, v => v === districtId, cellSize);
      }
    }

    // Unassigned county highlight
    if (showUnassignedCounties) {
      const assignedCounties = new Set();
      for (let y = 0; y < gridSize; y++)
        for (let x = 0; x < gridSize; x++)
          if (districts[y][x] > 0) assignedCounties.add(counties[y][x]);

      fillCells(
        ctx, counties,
        c => c > 0 && !assignedCounties.has(c),
        cellSize, theme.unassignedFill
      );
    }

    // County borders
    ctx.strokeStyle = mapView === 'party' ? theme.countyBorderParty : theme.countyBorder;
    ctx.lineWidth = 1;
    strokeAllBoundaries(ctx, counties, cellSize);

    // Hovered county highlight
    if (hoveredCounty !== null) {
      fillCells(ctx, counties, c => c === hoveredCounty, cellSize, theme.hover + '33');

      ctx.strokeStyle = theme.hover;
      ctx.lineWidth = 2;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (counties[y][x] === hoveredCounty) {
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || counties[ny][nx] !== hoveredCounty) {
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                break;
              }
            }
          }
        }
      }
    }
  }

  function getCountyAt(e) {
    const canvas = canvasRef.current;
    if (!canvas || !counties || counties.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const gridSize = counties.length;
    const cellSize = canvas.width / gridSize;
    const x = Math.floor(px / cellSize);
    const y = Math.floor(py / cellSize);

    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return null;
    return { countyId: counties[y][x], x, y };
  }

  function isCountyInCurrentDistrict(countyId) {
    if (!counties || !districts || districts.length === 0) return false;
    for (let y = 0; y < counties.length; y++) {
      for (let x = 0; x < counties[y].length; x++) {
        if (counties[y][x] === countyId) {
          return districts[y][x] === currentDistrict;
        }
      }
    }
    return false;
  }

  function handlePointerMove(e) {
    const drag = dragStateRef.current;
    // A second finger must not repaint with the first finger's mode.
    if (drag.active && e.pointerId !== drag.pointerId) return;

    const hit = getCountyAt(e);
    const countyId = hit ? hit.countyId : null;
    setHoveredCounty(countyId);

    if (drag.active && countyId !== null && countyId !== drag.lastCountyId) {
      drag.lastCountyId = countyId;
      if (onCountyPaint) onCountyPaint(countyId, drag.mode);
    }
  }

  function handlePointerLeave() {
    setHoveredCounty(null);
  }

  function handlePointerDown(e) {
    // Ignore secondary pointers while a paint-drag is in progress.
    if (dragStateRef.current.active) return;
    const hit = getCountyAt(e);
    if (!hit) return;
    e.preventDefault();
    // Keep receiving pointermove even when the finger/cursor leaves the canvas.
    // Capture is best-effort: it can throw for already-released pointers, and
    // painting must not depend on it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { countyId } = hit;
    const mode = isCountyInCurrentDistrict(countyId) ? 'remove' : 'add';
    dragStateRef.current = { active: true, mode, lastCountyId: countyId, pointerId: e.pointerId };
    if (onDragStart) onDragStart();
    if (onCountyPaint) {
      onCountyPaint(countyId, mode);
    } else if (onCountyClick) {
      onCountyClick(countyId);
    }
  }

  function handlePointerUp(e) {
    const drag = dragStateRef.current;
    if (drag.active && e.pointerId !== drag.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    // No cursor on touch — don't leave a stale highlight after lifting the finger.
    if (e.pointerType === 'touch') setHoveredCounty(null);
    dragStateRef.current = { active: false, mode: null, lastCountyId: null, pointerId: null };
  }

  useEffect(() => {
    // Fallback: reset drag state if the pointer is lost outside the canvas
    // (e.g. pointercancel from an OS gesture) so a stroke can't get stuck on.
    const resetDrag = () => {
      dragStateRef.current = { active: false, mode: null, lastCountyId: null, pointerId: null };
    };
    window.addEventListener('pointerup', resetDrag);
    window.addEventListener('pointercancel', resetDrag);
    return () => {
      window.removeEventListener('pointerup', resetDrag);
      window.removeEventListener('pointercancel', resetDrag);
    };
  }, []);

  return (
    <div className="game-canvas-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={640}
        height={640}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
