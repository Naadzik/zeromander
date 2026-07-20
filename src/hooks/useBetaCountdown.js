import { useEffect, useState } from 'react';
import { MODEL_V2_UTC } from '../utils/rng';

// The Beta launch date — PROMOTIONAL ONLY, and deliberately its own constant
// rather than a reuse of MODEL_V2_UTC.
//
// The two were briefly the same value and that was a trap: the board-model
// boundary is a frozen determinism guarantee (moving it re-rolls real boards),
// while this is a marketing date that can move whenever the launch does. They
// answer different questions and must be free to differ — the new model goes
// live 2026-07-20; the launch it is promoted under is 2026-08-01.
//
// MODEL_V2_UTC *is* imported below, but only to DESCRIBE itself in copy (see
// modelIsLive). The rule that matters runs the other way: nothing in board
// generation may ever read this launch date.
export const BETA_LAUNCH_UTC = Date.UTC(2026, 7, 1); // 2026-08-01

// Time until that launch.
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
  const ms = BETA_LAUNCH_UTC - Date.now();
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

// The launch date, formatted for display. Rendered in UTC on purpose: the
// countdown ends at a UTC midnight, so a viewer in Auckland or Los Angeles is
// told the same date everyone else sees, not their local rendering of it.
export const BETA_DATE_LABEL = new Date(BETA_LAUNCH_UTC).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', timeZone: 'UTC',
});

// COPY ONLY — the banner claims the new maps are live, so it has to actually
// know whether they are. The model boundary and the launch date are different
// dates (see above), so "the new maps are here" is true from MODEL_V2_UTC, not
// from the launch. Reading the boundary to describe it is fine; the rule that
// matters runs the other way — nothing in board generation may ever read
// BETA_LAUNCH_UTC.
export const modelIsLive = () => Date.now() >= MODEL_V2_UTC;

export const MODEL_DATE_LABEL = new Date(MODEL_V2_UTC).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', timeZone: 'UTC',
});
