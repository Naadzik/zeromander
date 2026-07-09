import { createRng } from './rng.js';
import { calculateSeats, calculateSeatsWithSwing } from './gameLogic.js';
import { resolveGreyPopulation } from './greyReveal.js';

// Engine A — "run the election under variation". Pure helpers that stress-test
// a finished map two ways: against a uniform national swing, and against how
// the undecideds (grey) might break. Nothing new is computed here — this file
// only LOOPS the existing pure primitives (`calculateSeatsWithSwing`,
// `resolveGreyPopulation`), so results stay deterministic and testable.
// 2-party only, matching the swing/efficiency-gap scope elsewhere.

const ourSeats = (seats, playerParty) => (playerParty === 'red' ? seats.red : seats.blue);

// How the map holds as a uniform national swing moves the electorate from
// `from`% to `to`%. `map` should be the DECIDED/revealed map (grey resolved).
// Returns the seat curve plus how big a swing TOWARD THE OPPONENT ("adverse")
// the map survives before the player drops below its as-drawn seat count —
// i.e. the dummymander test: a fragile gerrymander cracks under a small wave.
export function swingRobustness(map, districts, numDistricts, playerParty, opts = {}) {
  const { from = -10, to = 10, step = 1, targetSeats = null } = opts;
  const curve = [];
  for (let k = 0; ; k++) {
    const s = Math.round((from + k * step) * 100) / 100;
    if (s > to + 1e-9) break;
    curve.push({ swingPct: s, seats: ourSeats(calculateSeatsWithSwing(map, districts, numDistricts, s), playerParty) });
  }
  const seatsAtZero = ourSeats(calculateSeatsWithSwing(map, districts, numDistricts, 0), playerParty);

  // Positive swingPct = toward blue. Walk each side outward from 0 and stop at
  // the first swing that drops the player below their as-drawn seats.
  const holdMag = (side, bar) => {
    let m = 0;
    for (const p of side) { if (p.seats >= bar) m = Math.abs(p.swingPct); else break; }
    return m;
  };
  const towardBlue = holdMag(curve.filter(p => p.swingPct > 0).sort((a, b) => a.swingPct - b.swingPct), seatsAtZero);
  const towardRed = holdMag(curve.filter(p => p.swingPct < 0).sort((a, b) => b.swingPct - a.swingPct), seatsAtZero);

  return {
    curve,
    seatsAtZero,
    // Adverse = toward the opponent (the number that matters); favorable = your way.
    adverseHold: playerParty === 'red' ? towardBlue : towardRed,
    favorableHold: playerParty === 'red' ? towardRed : towardBlue,
    targetSeats
  };
}

// How the map holds as the undecideds (grey) break differently: re-resolve the
// grey population `runs` times with distinct seeds and tally the player's seats.
// On a map with no grey, `resolveGreyPopulation` returns the map unchanged
// without consuming rng, so every run is identical (spread 0) — callers should
// only surface this when grey is present.
export function breakRobustness(populationMap, districts, numDistricts, playerParty, opts = {}) {
  const { runs = 200, targetSeats = null, baseSeed = 0x9e3779b9 } = opts;
  const dist = [];
  let meets = 0;
  for (let i = 0; i < runs; i++) {
    const { revealedMap } = resolveGreyPopulation(populationMap, createRng((baseSeed + i * 0x85ebca6b) >>> 0));
    const s = ourSeats(calculateSeats(revealedMap, districts, numDistricts, false), playerParty);
    dist.push(s);
    if (targetSeats != null && s >= targetSeats) meets++;
  }
  dist.sort((a, b) => a - b);
  const q = f => dist[Math.min(dist.length - 1, Math.floor(f * dist.length))];
  return {
    runs,
    meetsTargetPct: targetSeats != null ? Math.round((meets / runs) * 100) : null,
    seatDist: { min: dist[0], p25: q(0.25), med: q(0.5), p75: q(0.75), max: dist[dist.length - 1] },
    spread: dist[dist.length - 1] - dist[0]
  };
}
