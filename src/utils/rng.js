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

export function dailyNumber(date = new Date()) {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((utcMidnight - LAUNCH_UTC) / 86400000) + 1;
}
