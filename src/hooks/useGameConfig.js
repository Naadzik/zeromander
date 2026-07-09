import { useState } from 'react';

export const DIFFICULTY_SETTINGS = {
  small: { gridSize: 50, numDistricts: 8, maxDistricts: 24, targetSeats: 50, minCounties: 100, maxCounties: 300 },
  medium: { gridSize: 80, numDistricts: 10, maxDistricts: 32, targetSeats: 50, minCounties: 150, maxCounties: 800 },
  large: { gridSize: 100, numDistricts: 12, maxDistricts: 40, targetSeats: 50, minCounties: 200, maxCounties: 1000 },
  'three-party': { gridSize: 80, numDistricts: 10, maxDistricts: 32, targetSeats: 0, minCounties: 150, maxCounties: 800, isThreeParty: true }
};

export function useGameConfig(initialDifficulty = 'medium') {
  const initial = DIFFICULTY_SETTINGS[initialDifficulty];
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [gridSize, setGridSize] = useState(initial.gridSize);
  const [numDistricts, setNumDistricts] = useState(initial.numDistricts);
  const [numCounties, setNumCounties] = useState(Math.round((initial.minCounties + initial.maxCounties) / 2));
  const [numCities, setNumCities] = useState(4);
  const [bluePercentage, setBluePercentage] = useState(45);
  const [greenPercentage, setGreenPercentage] = useState(25);
  const [numTowns, setNumTowns] = useState(3);
  const [targetSeatPercentage, setTargetSeatPercentage] = useState(initial.targetSeats);
  // Undecided ("grey") population share — 2-party only for now.
  const [greyPercentage, setGreyPercentage] = useState(8);
  // Optional "community of interest" (VRA layer) — 2-party only.
  const [includeCommunity, setIncludeCommunity] = useState(false);

  const isThreeParty = difficulty === 'three-party';

  function applyDifficulty(newDifficulty) {
    const settings = DIFFICULTY_SETTINGS[newDifficulty];
    setDifficulty(newDifficulty);
    setGridSize(settings.gridSize);
    setNumDistricts(settings.numDistricts);
    setNumCounties(Math.round((settings.minCounties + settings.maxCounties) / 2));
    setTargetSeatPercentage(settings.targetSeats);
  }

  function handleBluePercentageChange(value) {
    setBluePercentage(value);
    setGreenPercentage(g => Math.min(g, 95 - value));
  }

  return {
    difficulty,
    isThreeParty,
    gridSize,
    numDistricts,
    setNumDistricts,
    numCounties,
    setNumCounties,
    numCities,
    setNumCities,
    bluePercentage,
    handleBluePercentageChange,
    greenPercentage,
    setGreenPercentage,
    numTowns,
    setNumTowns,
    // Forced to 0 in three-party mode at the source, so generation and every
    // consumer see a grey-free config there without per-site checks.
    greyPercentage: isThreeParty ? 0 : greyPercentage,
    setGreyPercentage,
    includeCommunity,
    setIncludeCommunity,
    // A fixed 20% share when enabled → a fair share of ~2 seats to protect.
    communityPercentage: isThreeParty || !includeCommunity ? 0 : 20,
    targetSeatPercentage,
    applyDifficulty,
    maxDistricts: DIFFICULTY_SETTINGS[difficulty].maxDistricts
  };
}
