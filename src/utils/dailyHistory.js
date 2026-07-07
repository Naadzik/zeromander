import { utcDateString } from './rng.js';

// Local record of played dailies. Since the two-tier update each day holds
// per-tier results: { [date: 'YYYY-MM-DD']: { small?: DailyResult, full?: DailyResult } }.
// Legacy (pre-tier) entries were flat DailyResult objects on full-size boards —
// normalizeDay() reads them as { full: legacy }, no rewrite needed.
// recordDailyResult is deliberately the ONLY write path — when a backend
// arrives, its POST slots in there and nothing else changes.

const STORAGE_KEY = 'zeromander.daily.history.v1';

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

// Legacy flat records carry DailyResult fields directly (date/party/v/…).
function normalizeDay(entry) {
  if (!entry || typeof entry !== 'object') return {};
  if (entry.small || entry.full) return entry;
  return { full: entry };
}

export function getHistory() {
  if (!storageAvailable()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getResultFor(date, tier = 'small') {
  return normalizeDay(getHistory()[date])[tier] ?? null;
}

export function hasPlayedToday(date = utcDateString(), tier = 'small') {
  return getResultFor(date, tier) !== null;
}

// One shot per day PER TIER: a locked tier is never overwritten. Returns the
// result that ended up stored for that date+tier.
export function recordDailyResult(result, tier = 'small') {
  const history = getHistory();
  const day = normalizeDay(history[result.date]);
  if (day[tier]) return day[tier];
  history[result.date] = { ...day, [tier]: result };
  if (storageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Quota/private-mode failure: the result still stands for this session.
    }
  }
  return result;
}

function dayPlayed(entry) {
  const day = normalizeDay(entry);
  return !!(day.small || day.full);
}

function previousUtcDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateString(d);
}

// Consecutive-day run ending today (or yesterday, so an unplayed "today"
// doesn't zero the streak before the player gets a chance to extend it).
// Any locked tier counts — with the gate, that effectively means the Warm-up,
// while legacy full-only days still keep their streaks.
export function currentStreak(history = getHistory(), today = utcDateString()) {
  let cursor = dayPlayed(history[today]) ? today : previousUtcDate(today);
  let streak = 0;
  while (dayPlayed(history[cursor])) {
    streak++;
    cursor = previousUtcDate(cursor);
  }
  return streak;
}

export function bestStreak(history = getHistory()) {
  const dates = Object.keys(history).filter(d => dayPlayed(history[d])).sort();
  let best = 0, run = 0, prev = null;
  for (const date of dates) {
    run = prev !== null && previousUtcDate(date) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}
