import {
  calculateSeats,
  getSeatPercentage,
  getPopulationShares,
  calculateEfficiencyGap,
  getDistrictStats,
  allDistrictsAssigned,
  applySwingToVotes
} from './gameLogic.js';
import { getGridSize, totalPopulation } from './formatUtils.js';
import {
  calculateCompactness,
  calculateCompetitiveness,
  calculatePartisanAsymmetry,
  calculateCutEdges
} from './metrics.js';

export const round1 = v => Math.round(v * 10) / 10;

// The gerrymandering goal: the FEWEST seats whose share strictly exceeds your
// vote share. floor(share × districts) + 1 is the smallest integer greater
// than your proportional entitlement, so this is exactly the classic
// "seat% > vote%" win condition, just surfaced as a concrete seat count.
// (Using round() instead demands +1 over the *rounded* share, which can be
// unachievable — e.g. 20% across 4 districts cannot win 2 seats.)
// Capped at the number of districts. Two-party framing.
export function targetSeatCount(ourPopPercent, numDistricts) {
  const proportional = Math.floor((ourPopPercent / 100) * numDistricts);
  return Math.min(numDistricts, proportional + 1);
}

// Single source of truth for all game metrics — used by the live stats panel
// and by the end-of-game modal, so the two can never disagree.
// `counties` is optional (trailing, additive): when provided, the county
// dual-graph cut-edges count joins the core — callers that don't have the
// county grid in scope simply don't get it.
export function computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty, counties = null) {
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

  // Party-free, so computed for every mode. Only when the caller has the
  // county grid — the metric is defined on county adjacency, not cells.
  if (counties && counties.length > 0) {
    core.cutEdges = calculateCutEdges(districts, counties);
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
    // Same target semantics as 2-party: the fewest seats that beat your
    // proportional entitlement. Plurality wins make seats cheaper in a
    // 3-way race, but the bar is still relative to your own vote share.
    const targetSeats3 = targetSeatCount(core.ourPopPercent, numDistricts);
    return {
      playerParty,
      isThreeParty: true,
      ourSeats: round1(core.ourSeatsPct),
      ourSeatCount: core.ourSeatCount,
      ourWins: core.ourSeatCount,
      totalDistricts: numDistricts,
      targetSeats: targetSeats3,
      won: core.ourSeatCount >= targetSeats3 && !struckDown,
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

  const targetSeats = targetSeatCount(ourPopPercent, numDistricts);
  const nominalWon = core.ourSeatCount >= targetSeats;

  // When uncertainty mode is on, the swung result is what actually decides
  // won/lost — the nominal number is kept only for the "as drawn" comparison.
  // A struck-down map is dispositive regardless: it was never legally valid,
  // so whether it would have won election night is moot.
  let swung = null;
  let won = nominalWon;
  if (swing) {
    const ourSwungSeatCount = swing.seats[playerParty];
    const ourSwungSeatsPct = getSeatPercentage(ourSwungSeatCount, numDistricts);
    const swungWon = ourSwungSeatCount >= targetSeats;
    won = swungWon;
    swung = {
      swingPct: round1(swing.swingPct),
      ourSeats: round1(ourSwungSeatsPct),
      ourSeatCount: ourSwungSeatCount,
      revealed: !!swing.revealed,
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
    targetSeats,
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
      // Wasted votes are people — the model carries the exact half-vote the
      // winner's-surplus term can produce on odd district totals, the display
      // shows whole voters.
      blueWasted: Math.round(gap.blueWasted),
      redWasted: Math.round(gap.redWasted),
      compactness: Math.round(compactness.average * 100),
      competitiveness: round1(competitiveness.percentage),
      competitiveCount: competitiveness.competitive,
      asymmetry: round1(asymmetry.asymmetry),
      districtBreakdown: districtStats.map((d, i) => {
        const entry = { id: d.id, blue: d.blue, red: d.red, total: d.total };
        // Election night per district: how the undecideds broke (delta vs.
        // the nominal tallies) plus the national swing, and whether the
        // combination flipped the seat.
        if (swing) {
          const rv = swing.revealedDistrictStats ? swing.revealedDistrictStats[i] : d;
          entry.greyBlue = rv.blue - d.blue;
          entry.greyRed = rv.red - d.red;
          entry.swing = round1(swing.swingPct);
          const swungVotes = applySwingToVotes({ blue: rv.blue, red: rv.red }, swing.swingPct);
          const baseWinner = d.blue > d.red ? 'blue' : 'red';
          const swungWinner = swungVotes.blue > swungVotes.red ? 'blue' : 'red';
          entry.swungWinner = swungWinner;
          entry.flipped = baseWinner !== swungWinner;
        }
        return entry;
      })
    }
  };
}
