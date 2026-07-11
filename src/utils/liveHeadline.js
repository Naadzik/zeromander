import { TIER_LABELS } from './dailyChallenge';

// The Broadsheet's living front page: one pure function from game state to
// {kicker, headline, standfirst}. The page literally rewrites itself as the
// reader draws, the returns come in, and the verdict lands.
export function liveHeadline(s) {
  const {
    phase, // 'drawing' | 'ready' | 'revealing' | 'complete' | 'locked'
    assignedDistricts, totalDistricts, unassignedCounties,
    isDaily, dailyTier, dayNumber, archive, partyLabel, popPercent,
    clustersReporting, verdict,
  } = s;

  const dailyKicker = `DAILY EDITION No. ${dayNumber}${archive ? ' — ARCHIVE' : ''} · ${TIER_LABELS[dailyTier] ?? ''}`;

  if (phase === 'revealing') {
    return {
      kicker: 'ELECTION NIGHT — LIVE',
      headline: 'Undecided Precincts Break Late',
      standfirst: `${clustersReporting} area${clustersReporting === 1 ? '' : 's'} reporting. The decision desk is warming up.`,
    };
  }

  if (phase === 'complete' || phase === 'locked') {
    const v = verdict ?? {};
    if (isDaily && v.stolen != null) {
      return v.stolen > 0
        ? { kicker: dailyKicker, headline: `+${v.stolen} Seat${v.stolen === 1 ? '' : 's'} Stolen; Entirely Legal`, standfirst: v.message }
        : { kicker: dailyKicker, headline: 'Commission Out-Draws the Gerrymanderer', standfirst: v.message };
    }
    if (v.struckDown) {
      return { kicker: 'FROM THE COURTS', headline: 'Court Strikes the Map; Sends Regards', standfirst: v.message };
    }
    return v.won
      ? { kicker: 'THE MORNING AFTER', headline: 'Minority of Votes, Majority of Seats', standfirst: v.message }
      : { kicker: 'THE MORNING AFTER', headline: 'The Map Held; the Cartographer Didn\'t', standfirst: v.message };
  }

  if (phase === 'ready' && isDaily) {
    return {
      kicker: dailyKicker,
      headline: 'Every District Drawn; Presses Hold',
      standfirst: 'The neutral commission filed its map hours ago. Lock yours in and see who out-drew whom.',
    };
  }

  if (isDaily) {
    return {
      kicker: dailyKicker,
      headline: `${partyLabel} Operative Takes Up the Pen`,
      standfirst: `Same board as everyone. One submission. ${popPercent}% of the vote to work with — the rest is cartography.`,
    };
  }

  return {
    kicker: 'SPECIAL COVERAGE: REDISTRICTING',
    headline: 'Reader Redraws the State; State Unaware',
    standfirst: `${assignedDistricts} of ${totalDistricts} districts drawn. ${unassignedCounties} counties still unclaimed. The map is not yet an election.`,
  };
}
