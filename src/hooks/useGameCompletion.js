import { useState, useEffect } from 'react';
import { allDistrictsAssigned, calculateSeatsWithSwing, getDistrictStats } from '../utils/gameLogic';
import { computePopulationDeviation, checkConstraintViolations } from '../utils/legalConstraints';
import { computeCoreStats, buildEndGameStats } from '../utils/computeGameStats';
import { isDistrictConnected } from '../utils/fairMapGenerator';
import { resolveGreyPopulation } from '../utils/greyReveal';
import { GREY } from '../utils/formatUtils';
import { createRng, randomSeed } from '../utils/rng';

// Uniform national swing: ±4%. Local uncertainty is no longer synthetic
// per-district noise — it's the grey (undecided) population breaking in
// clusters at the reveal.
const MAX_SWING_PCT = 4;

function mapHasGrey(populationMap) {
  const party = populationMap?.party;
  if (!party) return false;
  for (let y = 0; y < party.length; y++) {
    for (let x = 0; x < party[y].length; x++) {
      if (party[y][x] === GREY) return true;
    }
  }
  return false;
}

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
  // The election-night resolution of the grey population — a NEW map with all
  // undecided cells assigned. Null until completion (and on grey-free boards).
  // GameApp renders this over the live map once it exists, so the board
  // visually "declares itself"; Try Again clears it back to grey.
  const [revealedMap, setRevealedMap] = useState(null);
  // Dismissing the modal must NOT clear gameComplete — the ghost-map comparison
  // stays on screen so the player can study it after closing the dialog.
  const [modalDismissed, setModalDismissed] = useState(false);

  function computeStats() {
    const isThreeParty = difficulty === 'three-party';
    // Nominal ("as drawn") stats are always from the ORIGINAL map: decided
    // votes only. The target derives from the decided-vote share and is
    // frozen before the reveal — no moving goalposts.
    const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty);
    const constraintViolations = checkConstraintViolations(populationMap, districts, numDistricts, constraints);

    const hasGrey = !isThreeParty && mapHasGrey(populationMap);
    let swing = null;
    let revealed = null;
    if ((electionUncertainty || hasGrey) && !isThreeParty) {
      const rng = createRng(randomSeed());
      const swingPct = electionUncertainty ? (rng() * 2 - 1) * MAX_SWING_PCT : 0;
      revealed = hasGrey ? resolveGreyPopulation(populationMap, rng).revealedMap : populationMap;
      const swungSeats = calculateSeatsWithSwing(revealed, districts, numDistricts, swingPct);
      swing = {
        swingPct,
        seats: swungSeats,
        revealed: hasGrey,
        // Per-district votes AFTER the undecideds broke — the breakdown shows
        // each district's grey→blue/red split from the delta vs. the nominal.
        revealedDistrictStats: hasGrey ? getDistrictStats(revealed, districts, numDistricts, false) : null
      };
    }

    const stats = buildEndGameStats(core, { playerParty, isThreeParty, numDistricts, constraintViolations, swing });
    return { stats, revealed: hasGrey ? revealed : null };
  }

  useEffect(() => {
    const valid = !!(populationMap && populationMap.party && districts.length > 0 &&
      allDistrictsAssigned(districts, numDistricts) &&
      areAllDistrictsValid(populationMap, districts, numDistricts));
    setIsMapValid(valid);

    if (valid && !manual) {
      const { stats, revealed } = computeStats();
      setGameStats(stats);
      setRevealedMap(revealed);
      setGameComplete(true);
      setModalDismissed(false);
    }
  }, [districts, numDistricts, targetSeatPercentage, populationMap, playerParty, difficulty, constraints, electionUncertainty, manual]);

  // Manual completion trigger. Returns the computed stats so the caller can
  // build the daily result record synchronously (state updates are async).
  function finalize() {
    if (!isMapValid) return null;
    const { stats, revealed } = computeStats();
    setGameStats(stats);
    setRevealedMap(revealed);
    setGameComplete(true);
    setModalDismissed(false);
    return stats;
  }

  function resetCompletion() {
    setGameComplete(false);
    setGameStats(null);
    setRevealedMap(null);
    setModalDismissed(false);
  }

  return {
    gameComplete,
    gameStats,
    isMapValid,
    revealedMap,
    finalize,
    showModal: gameComplete && !modalDismissed,
    dismissModal: () => setModalDismissed(true),
    resetCompletion
  };
}
