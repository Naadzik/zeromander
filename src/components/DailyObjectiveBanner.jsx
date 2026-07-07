import { PARTY } from '../utils/partyConfig'
import PartyIcon from './ui/PartyIcon'
import Icon from './ui/Icons'

// The daily's mission statement: which day, whose side you're on, and the
// uphill arithmetic. The assigned party rotates by day — some days you rig
// the map for one side, some days the other. That's the point.
export default function DailyObjectiveBanner({ dayNumber, party, popPercent, tierLabel }) {
  const label = PARTY[party]?.label ?? party;
  return (
    <div className="daily-objective-banner">
      <span className="daily-objective-banner__day"><Icon name="spy" size={15} /> Daily Heist #{dayNumber}{tierLabel ? ` — ${tierLabel}` : ''}</span>
      <span className="daily-objective-banner__goal">
        Today you draw the map for <strong><PartyIcon party={party} /> {label}</strong> — {popPercent}% of the vote.
        Take more seats than a fair map would give you. Perfectly legal.
      </span>
    </div>
  );
}
