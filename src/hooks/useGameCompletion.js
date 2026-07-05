import { useState, useEffect } from 'react';
import { allDistrictsAssigned, calculateSeatsWithSwing } from '../utils/gameLogic';
import { computePopulationDeviation, checkConstraintViolations } from '../utils/legalConstraints';
import { computeCoreStats, buildEndGameStats } from '../utils/computeGameStats';
import { isDistrictConnected } from '../utils/fairMapGenerator';
import { createRng, randomSeed } from '../utils/rng';

const MAX_SWING_PCT = 4;          // uniform national swing: ±4%
const MAX_DISTRICT_SWING_PCT = 2; // additional per-district noise: ±2% each

// The base ±10% completion gate is unaffected by constraint settings — even in
// soft mode, a violating map must be allowed to complete so it can be struck down.
// Contiguity, however, is a hard gate: draw-time enforcement should make a
// split district impossible, but a map with one must never count as finished.
function areAllDistrictsValid(populationMap, districts, numDistricts) {
  if (!populationMap || districts.length === 0) return false;
  if (!computePopulationDeviation(populationMap, districts, numDistricts, 10).pass) return false;
  const gridSize = districts.length;
  for (let d = 1; d <= numDistricts; d++) {
    if (!isDistrictConnected(districts, d, gridSize)) return false;
  }
  return true;
}

// Watches the board; once every district is assigned and within population
// bounds, freezes the final stats for the end-of-game modal.
// `manual: true` (daily challenge) suppresses auto-completion: the hook only
// tracks `isMapValid` so the player can keep optimizing, and the caller
// decides when to `finalize()` — the one-shot "lock in heist" moment.
export function useGameCompletion({ populationMap, districts, numDistricts, playerParty, difficulty, targetSeatPercentage, constraints, electionUncertainty, manual = false }) {
  const [gameComplete, setGameComplete] = useState(false);
  const [gameStats, setGameStats] = useState(null);
  const [isMapValid, setIsMapValid] = useState(false);
  // Dismissing the modal must NOT clear gameComplete — the ghost-map comparison
  // stays on screen so the player can study it after closing the dialog.
  const [modalDismissed, setModalDismissed] = useState(false);

  function computeStats() {
    const isThreeParty = difficulty === 'three-party';
    const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty);
    const constraintViolations = checkConstraintViolations(populationMap, districts, numDistricts, constraints);

    let swing = null;
    if (electionUncertainty && !isThreeParty) {
      const rng = createRng(randomSeed());
      const swingPct = (rng() * 2 - 1) * MAX_SWING_PCT;
      const districtSwings = [];
      for (let d = 1; d <= numDistricts; d++) {
        districtSwings[d] = (rng() * 2 - 1) * MAX_DISTRICT_SWING_PCT;
      }
      const swungSeats = calculateSeatsWithSwing(populationMap, districts, numDistricts, swingPct, districtSwings);
      swing = { swingPct, districtSwings, seats: swungSeats };
    }

    return buildEndGameStats(core, { playerParty, isThreeParty, numDistricts, constraintViolations, swing });
  }

  useEffect(() => {
    const valid = !!(populationMap && populationMap.party && districts.length > 0 &&
      allDistrictsAssigned(districts, numDistricts) &&
      areAllDistrictsValid(populationMap, districts, numDistricts));
    setIsMapValid(valid);

    if (valid && !manual) {
      setGameStats(computeStats());
      setGameComplete(true);
      setModalDismissed(false);
    }
  }, [districts, numDistricts, targetSeatPercentage, populationMap, playerParty, difficulty, constraints, electionUncertainty, manual]);

  // Manual completion trigger. Returns the computed stats so the caller can
  // build the daily result record synchronously (state updates are async).
  function finalize() {
    if (!isMapValid) return null;
    const stats = computeStats();
    setGameStats(stats);
    setGameComplete(true);
    setModalDismissed(false);
    return stats;
  }

  function resetCompletion() {
    setGameComplete(false);
    setGameStats(null);
    setModalDismissed(false);
  }

  return {
    gameComplete,
    gameStats,
    isMapValid,
    finalize,
    showModal: gameComplete && !modalDismissed,
    dismissModal: () => setModalDismissed(true),
    resetCompletion
  };
}
