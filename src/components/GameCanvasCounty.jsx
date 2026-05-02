import { useEffect, useRef, useState } from 'react'
import '../styles/GameCanvas.css'

const DISTRICT_COLORS = [
  '#8B5CF6', '#EC4899', '#06B6D4', '#10B981',
  '#F59E0B', '#6366F1', '#14B8A6', '#D946EF',
  '#0EA5E9', '#84CC16', '#F97316', '#6B7280'
];

export default function GameCanvasCounty({
  populationMap,
  counties,
  districts,
  currentDistrict,
  onCountyClick,
  highlightedDistrict,
  showUnassignedCounties
}) {
  const canvasRef = useRef(null);
  const [hoveredCounty, setHoveredCounty] = useState(null);

  useEffect(() => {
    if (canvasRef.current && populationMap && (populationMap.party || populationMap.length > 0)) {
      drawMap();
    }
  }, [populationMap, counties, districts, currentDistrict, hoveredCounty, highlightedDistrict, showUnassignedCounties]);

  function drawMap() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    
    const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
    const partyMap = isNewFormat ? populationMap.party : populationMap;
    const densityMap = isNewFormat ? populationMap.density : null;

    const gridSize = partyMap.length;
    const cellSize = canvas.width / gridSize;

    
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const party = partyMap[y][x];
        const density = densityMap ? densityMap[y][x] : 1;

        
        let baseColor = party === 0 ? '#3B82F6' : '#EF4444'; 

        
        
        const densityFactor = density / 10; 
        const alpha = 0.4 + densityFactor * 0.6; 

        
        const rgb = baseColor.match(/\w\w/g);
        const r = parseInt(rgb[0], 16);
        const g = parseInt(rgb[1], 16);
        const b = parseInt(rgb[2], 16);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        
        if (density >= 7) {
          ctx.strokeStyle = party === 0 ? '#1E40AF' : '#991B1B';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    
    const numDistricts = Math.max(...districts.flat().filter(d => d > 0), 0);
    for (let districtId = 1; districtId <= numDistricts; districtId++) {
      const color = DISTRICT_COLORS[(districtId - 1) % DISTRICT_COLORS.length];
      const isHighlighted = highlightedDistrict === districtId;
      const isCurrent = currentDistrict === districtId;

      
      const opacity = isHighlighted ? 'E6' : (isCurrent ? 'AA' : '99');
      ctx.fillStyle = color + opacity;

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (districts[y][x] === districtId) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }

      
      const borderWidth = isHighlighted ? 3 : 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = borderWidth;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (districts[y][x] === districtId) {
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize ||
                districts[ny][nx] !== districtId) {
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                break;
              }
            }
          }
        }
      }
    }


    if (showUnassignedCounties) {

      const unassignedCounties = new Set();
      const assignedCounties = new Set();

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (districts[y][x] > 0) {
            assignedCounties.add(counties[y][x]);
          }
        }
      }

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const countyId = counties[y][x];
          if (countyId > 0 && !assignedCounties.has(countyId)) {
            unassignedCounties.add(countyId);
          }
        }
      }


      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (unassignedCounties.has(counties[y][x])) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    
    
    ctx.strokeStyle = 'rgba(80, 80, 80, 0.6)'; 
    ctx.lineWidth = 1; 

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const currentCounty = counties[y][x];
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        
        for (let i = 0; i < dirs.length; i++) {
          const [dx, dy] = dirs[i];
          const nx = x + dx;
          const ny = y + dy;

          
          const isExternalEdge = (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize ||
            counties[ny][nx] !== currentCounty);

          if (isExternalEdge) {
            
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
            } else if (dy === -1) {
              
              ctx.moveTo(x * cellSize, y * cellSize);
              ctx.lineTo((x + 1) * cellSize, y * cellSize);
            }
            ctx.stroke();
          }
        }
      }
    }

    
    if (hoveredCounty !== null) {
      ctx.fillStyle = '#FFEB3B' + '33';
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (counties[y][x] === hoveredCounty) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }

      ctx.strokeStyle = '#FFEB3B';
      ctx.lineWidth = 2;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (counties[y][x] === hoveredCounty) {
            const currentCounty = hoveredCounty;
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

            for (const [dx, dy] of dirs) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize ||
                counties[ny][nx] !== currentCounty) {
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                break;
              }
            }
          }
        }
      }
    }
  }

  function handleMouseMove(e) {
    const canvas = canvasRef.current;
    if (!canvas || !counties || counties.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const gridSize = counties.length;
    const cellSize = canvas.width / gridSize;
    const x = Math.floor(px / cellSize);
    const y = Math.floor(py / cellSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      setHoveredCounty(counties[y][x]);
    } else {
      setHoveredCounty(null);
    }
  }

  function handleMouseLeave() {
    setHoveredCounty(null);
  }

  function handleCanvasClick(e) {
    const canvas = canvasRef.current;
    if (!canvas || !counties || counties.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const gridSize = counties.length;
    const cellSize = canvas.width / gridSize;
    const x = Math.floor(px / cellSize);
    const y = Math.floor(py / cellSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      const countyId = counties[y][x];
      onCountyClick(countyId);
    }
  }

  return (
    <div className="game-canvas-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={640}
        height={640}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
