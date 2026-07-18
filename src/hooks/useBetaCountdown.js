import { useEffect, useState } from 'react';
import { MODEL_V2_UTC } from '../utils/rng';

// Time until the Beta board model takes over (MODEL_V2_UTC, a UTC midnight).
//
// SELF-RETIRING BY DESIGN: once the date passes, `active` goes false forever
// and every surface that uses this renders nothing. Nobody has to remember to
// take the banner down on the morning it ships — which is exactly the kind of
// chore that gets forgotten and leaves a live site counting down to a date in
// the past.
//
// Ticks once a minute like useUtcMidnightCountdown, and for the same reason:
// the label is human-scale, so a second-by-second re-render would buy nothing.
function compute() {
  const ms = MODEL_V2_UTC - Date.now();
  if (ms <= 0) return { active: false, days: 0, hours: 0, label: '' };

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  // Coarse while it's far away, precise as it lands — the last day is the
  // only one where an hour is interesting.
  const label = days >= 1
    ? `${days} day${days === 1 ? '' : 's'}`
    : hours >= 1
      ? `${hours}h ${minutes}m`
      : minutes >= 1 ? `${minutes}m` : 'any minute now';

  return { active: true, days, hours, label };
}

export function useBetaCountdown() {
  const [state, setState] = useState(compute);
  useEffect(() => {
    if (!state.active) return;            // nothing left to count
    const id = setInterval(() => setState(compute()), 60_000);
    return () => clearInterval(id);
  }, [state.active]);
  return state;
}

// The cutover date, formatted for display. Rendered in UTC on purpose: the
// era flips at a UTC midnight, so a viewer in Auckland or Los Angeles must be
// told the same date the game will actually use, not their local rendering of
// the instant.
export const BETA_DATE_LABEL = new Date(MODEL_V2_UTC).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', timeZone: 'UTC',
});
