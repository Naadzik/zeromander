import { useState, useEffect } from 'react';
import { generateFairMap } from '../utils/fairMapGenerator';
import { computeCoreStats } from '../utils/computeGameStats';
import { createRng, randomSeed } from '../utils/rng';

// Computes the neutral/fair-map counterfactual once per completed game — this
// is O(counties) work that shouldn't rerun on every district edit.
// `seed`: the daily challenge passes a date-derived seed so every player's
// neutral baseline — and thus their "seats stolen" — is identical. Sandbox
// omits it and gets a fresh random draw.
export function useFairMap({ populationMap, counties, numDistricts, gridSize, playerParty, isThreeParty, enabled, seed }) {
  const [fairDistricts, setFairDistricts] = useState(null);
  const [fairStats, setFairStats] = useState(null);
  const [isComputing, setIsComputing] = useState(false);

  useEffect(() => {
    if (!enabled || !counties.length || !populationMap.party) {
      setFairDistricts(null);
      setFairStats(null);
      return;
    }

    setIsComputing(true);
    const rng = createRng(typeof seed === 'number' ? seed : randomSeed());
    const districts = generateFairMap(populationMap, counties, numDistricts, gridSize, rng);
    const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty, counties);
    setFairDistricts(districts);
    setFairStats(core);
    setIsComputing(false);
  }, [enabled, populationMap, counties, numDistricts, gridSize, playerParty, isThreeParty, seed]);

  return { fairDistricts, fairStats, isComputing };
}
