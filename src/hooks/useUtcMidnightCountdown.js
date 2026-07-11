import { useEffect, useState } from 'react';

// Time until the next daily board (UTC midnight). One 60s interval; label is
// human-scale ("7h 32m", "41m", "under a minute"). StrictMode-safe: the
// effect cleans up its interval on unmount/remount.
function compute() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = Math.max(0, next - now.getTime());
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const label = ms < 60_000
    ? 'under a minute'
    : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { hours, minutes, label };
}

export function useUtcMidnightCountdown() {
  const [state, setState] = useState(compute);
  useEffect(() => {
    const id = setInterval(() => setState(compute()), 60_000);
    return () => clearInterval(id);
  }, []);
  return state;
}
