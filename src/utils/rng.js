// Mulberry32 — fast, single-state seeded PRNG. Returns a drop-in for Math.random().
export function createRng(seed) {
  let s = (seed >>> 0) || 1;
  return function() {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

// Standard normal draw — cosine-form Box–Muller, consuming EXACTLY 2 rng
// draws every call. The fixed arity is a determinism contract (see MODELSPECS
// §0): polar/rejection sampling consumes a variable number of draws, which
// would re-roll every draw after it on replay. Never "optimize" this into a
// rejection method. The u1 floor guards log(0).
export function normal(rng) {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// UTC calendar date string — the canonical key for a day's puzzle. UTC (not
// local) so "Daily #N" is the same board worldwide at the same instant.
export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Deterministic uint32 seed from the UTC date (FNV-1a over 'YYYY-MM-DD').
export function dailySeed(date = new Date()) {
  const str = utcDateString(date);
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Day 1 = launch day. Fixed forever once published — changing it renumbers
// every already-shared "Daily #N".
const LAUNCH_UTC = Date.UTC(2026, 6, 1); // 2026-07-01

// The Beta (model v2) era boundary, mirroring the LAUNCH_UTC pattern: daily
// boards dated on/after this generate under the v2 board model (rank-size
// cities, Clark-exponential density, continuous political gradient); archive
// dates before it regenerate under v1 rules FOREVER. Both rule sets freeze
// the day Beta ships.
//
// ⚠️ FROZEN — do not move. Dailies from 2026-08-01 onward are v2; every date
// before it stays v1 forever. Shifting this line re-rolls every daily on the
// wrong side of it, breaking boards players have already seen and every
// challenge link that reproduces one. It is deliberately a FUTURE date at
// merge: the era must flip at a UTC midnight, never mid-day underneath
// someone's in-progress daily. Until it arrives the landing page counts down
// to it (see BetaCountdown).
export const MODEL_V2_UTC = Date.UTC(2026, 7, 1); // 2026-08-01

// Which board-model era a daily date belongs to. Challenge links carry the
// version explicitly (`v=2`; absent = v1) because links have no date.
export function boardModelVersion(date = new Date()) {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return utcMidnight >= MODEL_V2_UTC ? 2 : 1;
}

export function dailyNumber(date = new Date()) {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((utcMidnight - LAUNCH_UTC) / 86400000) + 1;
}
