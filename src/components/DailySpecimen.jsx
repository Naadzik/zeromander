import { useEffect, useRef } from 'react'
import { getDailyChallenge } from '../utils/dailyChallenge'
import { generatePopulationMap } from '../utils/mapGenerator'
import { generateCounties, rebalanceCountyPopulations } from '../utils/countyGenerator'
import { createRng } from '../utils/rng'
import { extractPopulationData } from '../utils/formatUtils'
import { getCanvasTheme, parseHex, strokeAllBoundaries } from '../utils/canvasDraw'

// Today's ACTUAL daily board, drawn small for the landing hero — the real
// battleground everyone plays today, not marketing art. Deterministic, so
// it looks identical for every visitor until UTC midnight.
export default function DailySpecimen({ size = 400, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    // The Warm-up tier — the board a new visitor will actually play first.
    const { seed, config } = getDailyChallenge().small;
    const rng = createRng(seed);
    const pop = generatePopulationMap(
      config.gridSize, config.bluePercentage, config.numCities, 100, rng, config.greyPercentage
    );
    let counties = generateCounties(config.gridSize, config.numCounties, rng);
    counties = rebalanceCountyPopulations(pop, counties, config.numCounties, 10, rng);

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const theme = getCanvasTheme();
    const { partyMap, densityMap } = extractPopulationData(pop);
    const grid = partyMap.length;
    const cell = canvas.width / grid;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const [r, g, b] = parseHex(theme.party[partyMap[y][x]]);
        const alpha = 0.35 + ((densityMap ? densityMap[y][x] : 1) / 10) * 0.65;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.strokeStyle = theme.countyBorder;
    ctx.lineWidth = 0.5;
    strokeAllBoundaries(ctx, counties, cell);
  }, []);

  return <canvas ref={ref} width={size} height={size} className={className} aria-label="Today's daily board" />;
}
