import { utcDateString } from './rng.js';

// Local record of played dailies: { [date: 'YYYY-MM-DD']: DailyResult }.
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

export function getResultFor(date) {
  return getHistory()[date] ?? null;
}

export function hasPlayedToday(date = utcDateString()) {
  return getResultFor(date) !== null;
}

// One shot per day: a date that already has a locked result is never
// overwritten. Returns the result that ended up stored for that date.
export function recordDailyResult(result) {
  const history = getHistory();
  if (history[result.date]) return history[result.date];
  history[result.date] = result;
  if (storageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Quota/private-mode failure: the result still stands for this session.
    }
  }
  return result;
}

function previousUtcDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateString(d);
}

// Consecutive-day run ending today (or yesterday, so an unplayed "today"
// doesn't zero the streak before the player gets a chance to extend it).
export function currentStreak(history = getHistory(), today = utcDateString()) {
  let cursor = history[today] ? today : previousUtcDate(today);
  let streak = 0;
  while (history[cursor]) {
    streak++;
    cursor = previousUtcDate(cursor);
  }
  return streak;
}

export function bestStreak(history = getHistory()) {
  const dates = Object.keys(history).sort();
  let best = 0, run = 0, prev = null;
  for (const date of dates) {
    run = prev !== null && previousUtcDate(date) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}
