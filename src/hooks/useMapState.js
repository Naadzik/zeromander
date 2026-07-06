import { useState, useEffect, useRef } from 'react';
import { generatePopulationMap, generatePopulationMap3Party } from '../utils/mapGenerator';
import { generateCounties, rebalanceCountyPopulations, getCountyCells } from '../utils/countyGenerator';
import { createRng, randomSeed } from '../utils/rng';
import { isCountyAdjacentToDistrict } from '../utils/gameLogic';
import { isDistrictConnected } from '../utils/fairMapGenerator';
import { extractPopulationData, getCellPopulation, totalPopulation } from '../utils/formatUtils';
import { useUndoRedo } from './useUndoRedo';

function findFirstCell(grid, value) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === value) return { x, y };
    }
  }
  return null;
}

// `options.seed` (uint32) makes generation deterministic — the daily
// challenge's whole premise. Omitted → random board, as always.
// `options.locked` freezes the board: undo/redo (buttons AND keyboard
// shortcuts) are disabled. Paint/click guards live at the GameApp level.
export function useMapState(config, constraints, options = {}) {
  const { difficulty, gridSize, numDistricts, numCounties, numCities, bluePercentage, greenPercentage, numTowns, greyPercentage = 0 } = config;
  const fixedSeed = options.seed;

  const [populationMap, setPopulationMap] = useState([]);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [currentDistrict, setCurrentDistrict] = useState(1);
  const [lastRejection, setLastRejection] = useState(null);
  const rejectionRef = useRef(null);
  // Synchronous mirror of `districts`: paint/click handlers compute the next
  // state from this instead of a setState updater, because rejections must be
  // detectable inside the SAME event (a deferred updater runs after the
  // rejection check, so toasts would silently never fire for single clicks).
  const districtsRef = useRef(districts);
  useEffect(() => { districtsRef.current = districts; }, [districts]);

  const undoRedo = useUndoRedo(districts, setDistricts, !options.locked);

  function installMap(pop, size, countyCount, rng) {
    setPopulationMap(pop);
    let counties_ = generateCounties(size, countyCount, rng);
    counties_ = rebalanceCountyPopulations(pop, counties_, countyCount, 10, rng);
    setCounties(counties_);
    setDistricts(Array(size).fill(null).map(() => Array(size).fill(0)));
    setCurrentDistrict(1);
    undoRedo.reset();
  }

  // Type-guarded because callers wire this straight into onClick, which would
  // otherwise pass the click event as `seed` (→ createRng(event >>> 0) = 1).
  function generateNewGame(seed) {
    const effectiveSeed = typeof seed === 'number' ? seed : (typeof fixedSeed === 'number' ? fixedSeed : randomSeed());
    const rng = createRng(effectiveSeed);
    const pop = difficulty === 'three-party'
      ? generatePopulationMap3Party(gridSize, bluePercentage, greenPercentage, numCities, numTowns, rng)
      : generatePopulationMap(gridSize, bluePercentage, numCities, 100, rng, greyPercentage);
    installMap(pop, gridSize, numCounties, rng);
  }

  // With a fixed seed this effect is idempotent — a re-fire regenerates the
  // exact same board, so daily mode survives config echoes harmlessly.
  useEffect(() => {
    const timer = setTimeout(() => generateNewGame(), 150);
    return () => clearTimeout(timer);
  }, [gridSize, bluePercentage, greenPercentage, numCities, numTowns, greyPercentage, fixedSeed]);

  function applyCountyAction(prevDistricts, countyId, mode) {
    if (currentDistrict === 0) return null;

    const newDistricts = prevDistricts.map(row => [...row]);
    const countyCells = getCountyCells(counties, countyId);
    const { densityMap } = extractPopulationData(populationMap);

    const isAlreadyAssigned = countyCells.some(({ x, y }) => newDistricts[y][x] === currentDistrict);

    if (mode === 'remove') {
      if (!isAlreadyAssigned) return null;
      for (const { x, y } of countyCells) {
        if (newDistricts[y][x] === currentDistrict) newDistricts[y][x] = 0;
      }
      // Removing a county from the middle of a district must not split it.
      if (!isDistrictConnected(newDistricts, currentDistrict, gridSize)) {
        rejectionRef.current = {
          reason: 'contiguity',
          message: `Blocked: removing this county would split District ${currentDistrict} in two.`
        };
        return null;
      }
      return newDistricts;
    }

    if (isAlreadyAssigned) return null;

    // Painting over another district's counties (a "steal") is allowed, but
    // only if every donor district is still one connected piece afterward —
    // this was the hole that let visibly split districts reach completion.
    const donorDistricts = new Set();
    for (const { x, y } of countyCells) {
      const d = newDistricts[y][x];
      if (d > 0 && d !== currentDistrict) donorDistricts.add(d);
    }

    let currentPopulation = 0;
    for (let y = 0; y < newDistricts.length; y++)
      for (let x = 0; x < newDistricts[y].length; x++)
        if (newDistricts[y][x] === currentDistrict)
          currentPopulation += getCellPopulation(densityMap, y, x);

    let countyPopulation = 0;
    for (const { x, y } of countyCells)
      countyPopulation += getCellPopulation(densityMap, y, x);

    const combinedPopulation = currentPopulation + countyPopulation;
    const popConstraint = constraints?.populationDeviation;
    const usingStrictCap = popConstraint?.enabled && popConstraint.mode === 'hard';
    const deviationPct = usingStrictCap ? popConstraint.thresholdPct : 10;
    const maxPopulation = Math.ceil((totalPopulation(populationMap) / numDistricts) * (1 + deviationPct / 100));

    const withinCap = combinedPopulation <= maxPopulation;
    const isContiguous = isCountyAdjacentToDistrict(newDistricts, counties, countyId, currentDistrict);

    if (withinCap && isContiguous) {
      for (const { x, y } of countyCells) {
        newDistricts[y][x] = currentDistrict;
      }
      for (const donor of donorDistricts) {
        if (!isDistrictConnected(newDistricts, donor, gridSize)) {
          rejectionRef.current = {
            reason: 'contiguity',
            message: `Blocked: this would split District ${donor} into disconnected pieces.`
          };
          return null;
        }
      }
      return newDistricts;
    }

    if (!withinCap && usingStrictCap) {
      rejectionRef.current = {
        reason: 'population-cap',
        message: `Blocked: District ${currentDistrict} would exceed the ±${deviationPct}% population limit.`
      };
    }

    return null;
  }

  function handleCountyClick(countyId) {
    rejectionRef.current = null;
    const prev = districtsRef.current;
    const cell = findFirstCell(counties, countyId);
    const inDistrict = cell && prev[cell.y][cell.x] === currentDistrict;
    const next = applyCountyAction(prev, countyId, inDistrict ? 'remove' : 'add');
    if (next) {
      districtsRef.current = next;
      setDistricts(next);
    }
    if (rejectionRef.current) setLastRejection(rejectionRef.current);
  }

  function handleCountyPaint(countyId, mode) {
    rejectionRef.current = null;
    const next = applyCountyAction(districtsRef.current, countyId, mode);
    if (next) {
      districtsRef.current = next;
      setDistricts(next);
    }
    if (rejectionRef.current) setLastRejection(rejectionRef.current);
  }

  // Reinstalls a saved districts grid (daily re-entry after lock-in). Only
  // valid for the same deterministic board it was drawn on. Shape-checked in
  // full: the grid comes from localStorage, which can be corrupted or stale.
  function restoreDistricts(savedGrid) {
    const valid = Array.isArray(savedGrid) && savedGrid.length === gridSize &&
      savedGrid.every(row =>
        Array.isArray(row) && row.length === gridSize &&
        row.every(v => Number.isInteger(v) && v >= 0 && v <= numDistricts)
      );
    if (!valid) return;
    setDistricts(savedGrid.map(row => [...row]));
  }

  return {
    populationMap,
    counties,
    districts,
    currentDistrict,
    setCurrentDistrict,
    generateNewGame,
    restoreDistricts,
    handleCountyClick,
    handleCountyPaint,
    lastRejection,
    clearRejection: () => setLastRejection(null),
    undoRedo
  };
}
