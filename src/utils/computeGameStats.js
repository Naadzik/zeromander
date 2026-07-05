import {
  calculateSeats,
  getSeatPercentage,
  getPopulationShares,
  calculateEfficiencyGap,
  getDistrictStats,
  allDistrictsAssigned
} from './gameLogic.js';
import { getGridSize, totalPopulation } from './formatUtils.js';
import {
  calculateCompactness,
  calculateCompetitiveness,
  calculatePartisanAsymmetry
} from './metrics.js';

export const round1 = v => Math.round(v * 10) / 10;

// Single source of truth for all game metrics — used by the live stats panel
// and by the end-of-game modal, so the two can never disagree.
export function computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty) {
  const gridSize = getGridSize(populationMap);
  const mapTotalPop = totalPopulation(populationMap);
  const assigned = allDistrictsAssigned(districts, numDistricts);
  const compactness = calculateCompactness(districts, numDistricts, gridSize);
  const seats = calculateSeats(populationMap, districts, numDistricts, isThreeParty);
  const shares = getPopulationShares(populationMap);
  const districtStats = getDistrictStats(populationMap, districts, numDistricts, isThreeParty);

  const ourSeatCount = seats[playerParty];
  const ourSeatsPct = getSeatPercentage(ourSeatCount, numDistricts);
  const ourPopPercent = shares[playerParty];

  const core = {
    gridSize,
    mapTotalPop,
    assigned,
    compactness,
    seats,
    shares,
    districtStats,
    ourSeatCount,
    ourSeatsPct,
    ourPopPercent
  };

  if (!isThreeParty) {
    core.gap = calculateEfficiencyGap(populationMap, districts, numDistricts);
    core.competitiveness = calculateCompetitiveness(populationMap, districts, numDistricts);
    core.asymmetry = calculatePartisanAsymmetry(populationMap, districts, numDistricts);
  }

  return core;
}

// A struck-down map was never a legally valid outcome — any enabled constraint
// (hard or soft) failing at completion time overrides a would-be win.
function getStrikeDown(constraintViolations) {
  if (!constraintViolations) return { struckDown: false, struckDownReason: null };
  const failed = Object.entries(constraintViolations).find(([, v]) => v.enabled && !v.pass);
  return { struckDown: !!failed, struckDownReason: failed ? failed[0] : null };
}

// Builds the gameStats object consumed by GameEndModal.
export function buildEndGameStats(core, { playerParty, isThreeParty, numDistricts, constraintViolations, swing }) {
  const { seats, shares, compactness, districtStats } = core;
  const { struckDown, struckDownReason } = getStrikeDown(constraintViolations);

  if (isThreeParty) {
    return {
      playerParty,
      isThreeParty: true,
      ourSeats: round1(core.ourSeatsPct),
      ourSeatCount: core.ourSeatCount,
      ourWins: core.ourSeatCount,
      totalDistricts: numDistricts,
      won: core.ourSeatsPct > core.ourPopPercent && !struckDown,
      struckDown,
      struckDownReason,
      allStats: {
        ourPopPercent: round1(core.ourPopPercent),
        blueSeats: seats.blue,
        redSeats: seats.red,
        greenSeats: seats.green,
        blueSeatsPct: Math.round((seats.blue / numDistricts) * 1000) / 10,
        redSeatsPct: Math.round((seats.red / numDistricts) * 1000) / 10,
        greenSeatsPct: Math.round((seats.green / numDistricts) * 1000) / 10,
        bluePop: round1(shares.blue),
        redPop: round1(shares.red),
        greenPop: round1(shares.green),
        compactness: Math.round(compactness.average * 100),
        districtBreakdown: districtStats.map(d => ({
          id: d.id, blue: d.blue, red: d.red, green: d.green, total: d.total, winner: d.winner
        })),
      }
    };
  }

  const blueSeatsPct = getSeatPercentage(seats.blue, numDistricts);
  const ourSeats = core.ourSeatsPct;
  const ourPopPercent = core.ourPopPercent;
  const { gap, competitiveness, asymmetry } = core;

  const nominalWon = ourSeats > ourPopPercent;

  // When uncertainty mode is on, the swung result is what actually decides
  // won/lost — the nominal number is kept only for the "as drawn" comparison.
  // A struck-down map is dispositive regardless: it was never legally valid,
  // so whether it would have won election night is moot.
  let swung = null;
  let won = nominalWon;
  if (swing) {
    const ourSwungSeatCount = swing.seats[playerParty];
    const ourSwungSeatsPct = getSeatPercentage(ourSwungSeatCount, numDistricts);
    const swungWon = ourSwungSeatsPct > ourPopPercent;
    won = swungWon;
    swung = {
      swingPct: round1(swing.swingPct),
      ourSeats: round1(ourSwungSeatsPct),
      ourSeatCount: ourSwungSeatCount,
      won: swungWon
    };
  }
  won = won && !struckDown;

  return {
    playerParty,
    ourSeats: round1(ourSeats),
    theirSeats: round1(100 - ourSeats),
    ourWins: playerParty === 'blue' ? seats.blue : seats.red,
    theirWins: playerParty === 'blue' ? seats.red : seats.blue,
    blueSeats: round1(blueSeatsPct),
    redSeats: round1(100 - blueSeatsPct),
    blueWins: seats.blue,
    redWins: seats.red,
    totalDistricts: numDistricts,
    won,
    struckDown,
    struckDownReason,
    nominal: { won: nominalWon, ourSeats: round1(ourSeats) },
    swung,
    allStats: {
      ourPopPercent: round1(ourPopPercent),
      theirPopPercent: round1(100 - ourPopPercent),
      bluePopPercent: round1(shares.blue),
      redPopPercent: round1(100 - shares.blue),
      efficiencyGap: round1(gap.gap),
      blueWasted: gap.blueWasted,
      redWasted: gap.redWasted,
      compactness: Math.round(compactness.average * 100),
      competitiveness: round1(competitiveness.percentage),
      competitiveCount: competitiveness.competitive,
      asymmetry: round1(asymmetry.asymmetry),
      districtBreakdown: districtStats.map(d => ({
        id: d.id,
        blue: d.blue,
        red: d.red,
        total: d.total
      }))
    }
  };
}
