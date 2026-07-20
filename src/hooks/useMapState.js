import { useState, useEffect, useRef } from 'react';
import { generatePopulationMap, generatePopulationMap3Party } from '../utils/mapGenerator';
import { generateCounties, rebalanceCountyPopulations, getCountyCells } from '../utils/countyGenerator';
import { createRng, randomSeed } from '../utils/rng';
import { isCountyAdjacentToDistrict } from '../utils/gameLogic';
import { isDistrictConnected } from '../utils/fairMapGenerator';
import { extractPopulationData, getCellPopulation, totalPopulation } from '../utils/formatUtils';
import { PARITY_AID_PCT, drawCapPopulation } from '../utils/legalConstraints';
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
  const { difficulty, gridSize, numDistricts, numCounties, numCities, bluePercentage, greenPercentage, numTowns, greyPercentage = 0, communityPercentage = 0, modelVersion = 1 } = config;
  const fixedSeed = options.seed;

  const [populationMap, setPopulationMap] = useState([]);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [currentDistrict, setCurrentDistrict] = useState(1);
  // The seed that actually generated the current board — lets any game be
  // reproduced (challenge links) and pins the neutral-map seed per board.
  const [boardSeed, setBoardSeed] = useState(null);
  const [lastRejection, setLastRejection] = useState(null);
  const rejectionRef = useRef(null);
  // "Add to empty only" mode (a mobile drawing aid): when on, painting skips
  // any county already in another district, so a stray finger-drag can't
  // cannibalise districts you've drawn — you only claim unassigned ground.
  // Mirrored into a ref because paint handlers read off refs mid-drag, not the
  // render closure, so a stale flag would leak into a stroke already underway.
  const addUnclaimedOnlyRef = useRef(false);
  addUnclaimedOnlyRef.current = !!options.addUnclaimedOnly;
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
    setBoardSeed(effectiveSeed);
    const rng = createRng(effectiveSeed);
    const pop = difficulty === 'three-party'
      ? generatePopulationMap3Party(gridSize, bluePercentage, greenPercentage, numCities, numTowns, rng)
      : generatePopulationMap(gridSize, bluePercentage, numCities, 100, rng, greyPercentage, communityPercentage, modelVersion);
    installMap(pop, gridSize, numCounties, rng);
  }

  // With a fixed seed this effect is idempotent — a re-fire regenerates the
  // exact same board, so daily mode survives config echoes harmlessly.
  useEffect(() => {
    const timer = setTimeout(() => generateNewGame(), 150);
    return () => clearTimeout(timer);
  }, [gridSize, bluePercentage, greenPercentage, numCities, numTowns, greyPercentage, communityPercentage, fixedSeed, modelVersion]);

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

    // "Add to empty only": never steal — silently skip any county owned by
    // another district (no rejection toast; a drag across the map stays quiet).
    if (addUnclaimedOnlyRef.current && donorDistricts.size > 0) return null;

    let currentPopulation = 0;
    for (let y = 0; y < newDistricts.length; y++)
      for (let x = 0; x < newDistricts[y].length; x++)
        if (newDistricts[y][x] === currentDistrict)
          currentPopulation += getCellPopulation(densityMap, y, x);

    let countyPopulation = 0;
    for (const { x, y } of countyCells)
      countyPopulation += getCellPopulation(densityMap, y, x);

    const combinedPopulation = currentPopulation + countyPopulation;
    // The draw cap IS the displayed aid band (±5% by default): painting can
    // never push a district past the range the capacity bar shows — the two
    // used to disagree (band ±5%, cap +10%), which let a "full" district
    // quietly take one more county and read over its own printed maximum.
    // The sandbox's strict hard mode still substitutes its own threshold —
    // an explicit experiment knob, labeled as replacing the default cap.
    const popConstraint = constraints?.populationDeviation;
    const usingStrictCap = popConstraint?.enabled && popConstraint.mode === 'hard';
    const deviationPct = usingStrictCap ? popConstraint.thresholdPct : PARITY_AID_PCT;
    const maxPopulation = drawCapPopulation(totalPopulation(populationMap), numDistricts, deviationPct);

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

    if (!withinCap) {
      // Always explain a cap rejection — a silently dead tap reads as a bug
      // (the old base cap rejected without a word; only strict mode spoke).
      rejectionRef.current = {
        reason: 'population-cap',
        message: `Blocked: District ${currentDistrict} is at its population ceiling (max ${maxPopulation.toLocaleString('en-US')}, ±${deviationPct}%). Grow another district, or take counties from this one.`
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
    boardSeed,
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
