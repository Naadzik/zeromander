import { createRng, dailySeed, dailyNumber, utcDateString } from './rng.js';

// "The Heist" daily challenge — everything about a day's puzzle is a pure
// function of the UTC date, so every player worldwide gets the same board,
// the same assigned party, and the same neutral baseline to steal from.

// Distinct RNG streams derived from the day seed. The board, the config knobs,
// and the fair map each get their own stream so consuming random numbers in
// one never shifts the sequence of another.
const CONFIG_STREAM = 0x5F356495;
const FAIR_STREAM = 0x9E3779B9;

// Assigned party rotates daily — over any week the public gerrymanders for
// both sides equally, which is a neutrality feature, not a gameplay detail.
export function dailyParty(dayNumber) {
  return dayNumber % 2 === 0 ? 'red' : 'blue';
}

// Deterministic voter split for the assigned party, in a band where the
// heist is always uphill (minority → majority of seats): 38–48%.
export function dailyVoterSplit(rng) {
  return 38 + Math.floor(rng() * 11);
}

// The single source of truth for a day's puzzle.
export function getDailyChallenge(date = new Date()) {
  const seed = dailySeed(date);
  const dayNumber = dailyNumber(date);
  const party = dailyParty(dayNumber);
  const configRng = createRng((seed ^ CONFIG_STREAM) >>> 0);
  const split = dailyVoterSplit(configRng);

  return {
    date: utcDateString(date),
    dayNumber,
    seed,                                  // seeds the board generation
    fairSeed: (seed ^ FAIR_STREAM) >>> 0,  // seeds the neutral map — MUST be
                                           // deterministic or "seats stolen"
                                           // isn't comparable between players
    party,
    config: {
      difficulty: 'medium',
      gridSize: 80,
      numDistricts: 10,
      numCounties: 475,
      numCities: 4,
      numTowns: 3,
      // bluePercentage is Urban Union's share; when the heist party is red,
      // red gets the minority split, i.e. blue gets the complement.
      bluePercentage: party === 'blue' ? split : 100 - split,
      targetSeatPercentage: 50
    }
  };
}

// THE score: seats beyond what a party-blind process would have produced.
// Both cores must be computed with playerParty === the day's assigned party.
export function seatsStolen(playerCore, fairCore) {
  return playerCore.ourSeatCount - fairCore.ourSeatCount;
}

// Spoiler-safe seat strip, one colored square per district in district order —
// the Wordle-grid trick: legible in a tweet without a screenshot.
export function seatGridString(districtBreakdown) {
  if (!districtBreakdown || districtBreakdown.length === 0) return null;
  return districtBreakdown.map(d => {
    const winner = d.winner ?? (d.blue > d.red ? 'blue' : 'red');
    return winner === 'blue' ? '🟦' : winner === 'green' ? '🟩' : '🟥';
  }).join('');
}

// The canonical persisted/shareable record — exactly what a future backend
// POST would send verbatim. Keep additive (bump `v` on shape changes).
export function buildDailyResult({ date, dayNumber, party, playerCore, fairCore, districtBreakdown, numDistricts }) {
  return {
    date,
    dayNumber,
    party,
    playerSeats: playerCore.ourSeatCount,
    neutralSeats: fairCore.ourSeatCount,
    seatsStolen: seatsStolen(playerCore, fairCore),
    popPercent: Math.round(playerCore.ourPopPercent),
    numDistricts,
    seatGrid: seatGridString(districtBreakdown),
    submittedAt: new Date().toISOString(),
    v: 1
  };
}
