// Shared board reproduction for the check harnesses (determinism + models).
//
// This is the ONE place that knows how to rebuild a daily board outside the
// browser. It mirrors the app's real generation path exactly — useMapState's
// generateNewGame + installMap — because a guard that reproduces the board
// differently from the app guards nothing.
//
// The app's path (src/hooks/useMapState.js):
//   rng = createRng(seed)
//   pop = generatePopulationMap(gridSize, bluePercentage, numCities, 100, rng,
//                               greyPercentage, communityPercentage)
//   counties = generateCounties(gridSize, numCounties, rng)
//   counties = rebalanceCountyPopulations(pop, counties, numCounties, 10, rng)
// All three stages share ONE rng stream, so their draw order is jointly frozen.

import { createHash } from 'node:crypto';
import { createRng } from '../../src/utils/rng.js';
import { getDailyChallenge } from '../../src/utils/dailyChallenge.js';
import { generatePopulationMap } from '../../src/utils/mapGenerator.js';
import { generateCounties, rebalanceCountyPopulations } from '../../src/utils/countyGenerator.js';

export const sha256 = (value) =>
  createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

// Parses 'YYYY-MM-DD' as UTC midnight — the daily's canonical key. Never use
// `new Date('YYYY-MM-DD')` semantics indirectly through local time here: the
// board for a date must be the same in every timezone the CI runner picks.
export function utcDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Rebuilds one tier of one day's board. Returns the population map and the
// counties separately so callers can hash them at whatever granularity they
// need (see hashBoard).
export function buildBoard(tier) {
  const { seed, config } = tier;
  const { gridSize, bluePercentage, numCities, numCounties, greyPercentage = 0, communityPercentage = 0, modelVersion = 1 } = config;
  const rng = createRng(seed);
  const pop = generatePopulationMap(gridSize, bluePercentage, numCities, 100, rng, greyPercentage, communityPercentage, modelVersion);
  let counties = generateCounties(gridSize, numCounties, rng);
  counties = rebalanceCountyPopulations(pop, counties, numCounties, 10, rng);
  return { pop, counties, seed, config };
}

// Both tiers of a given date, keyed as the daily itself keys them.
export function buildDailyBoards(dateString) {
  const daily = getDailyChallenge(utcDate(dateString));
  return {
    date: daily.date,
    dayNumber: daily.dayNumber,
    party: daily.party,
    small: buildBoard(daily.small),
    full: buildBoard(daily.full),
  };
}

// TWO hashes per board, deliberately:
//
// `pop`  — sha256 of the population map alone. This is the hash the CLAUDE.md
//          determinism protocol documents, so it stays directly comparable to
//          the reference constants recorded there and in past sessions.
// `full` — sha256 of the population map AND the counties. The counties are
//          drawn from the same rng stream but AFTER the population map, so a
//          change to countyGenerator.js re-rolls every player's counties while
//          leaving the `pop` hash green. `full` is what closes that hole.
export function hashBoard({ pop, counties }) {
  return {
    pop: sha256(pop),
    full: sha256({ pop, counties }),
  };
}
