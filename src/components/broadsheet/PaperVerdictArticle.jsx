import { useState } from 'react'
import { Link } from 'react-router-dom'
import { shareText } from '../../utils/share'
import {
  buildShareText, buildChallengeText,
  FinalResultsGrid, DailyComparison, SwingComparison,
  DurabilityPanel, AnatomyPanel, DetailedStats,
} from '../../utils/verdictCopy'

// The below-the-fold report. No modal: when the game completes, the front
// page's headline flips to the verdict and this article prints beneath the
// plate — returns, anatomy, stress test, the full precinct ledger, and a
// classifieds strip of actions. Content blocks are shared verbatim with the
// dashboard modal (utils/verdictCopy.jsx) so the two surfaces cannot drift.
function Slug({ children }) {
  return <h3 className="paper-slug">{children}</h3>;
}

export default function PaperVerdictArticle({ stats, daily, fairStats, durability, challengeShare, onTryAgain }) {
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);

  const copy = async (text, set) => {
    const outcome = await shareText(text);
    if (outcome === 'failed') return;
    set(outcome);
    setTimeout(() => set(false), 2000);
  };

  return (
    <article className="paper-article">
      <Slug>The Returns</Slug>
      <FinalResultsGrid stats={stats} />
      <DailyComparison daily={daily} stats={stats} />
      <SwingComparison stats={stats} />

      <AnatomyPanel stats={stats} />

      <DurabilityPanel durability={durability} />

      <Slug>The Precinct Ledger</Slug>
      <DetailedStats stats={stats} fairStats={fairStats} />

      <Slug>Notices</Slug>
      <div className="paper-notices">
        <button className="paper-desk-btn" onClick={() => copy(buildShareText({ stats, daily, fairStats }), setCopied)}>
          {copied === 'shared' ? '✓ Clipping shared' : copied === 'copied' ? '✓ Clipping copied' : 'Share the clipping'}
        </button>
        {challengeShare && (
          <button className="paper-desk-btn" onClick={() => copy(buildChallengeText(challengeShare), setChallengeCopied)}>
            {challengeCopied === 'shared' ? '✓ Notice sent' : challengeCopied === 'copied' ? '✓ Notice posted' : 'Challenge a rival'}
          </button>
        )}
        {onTryAgain && (
          <button className="paper-desk-btn paper-desk-btn--recount" onClick={onTryAgain}>
            ORDER A RECOUNT — redraw the map
          </button>
        )}
        <Link to="/methodology" target="_blank" rel="noopener noreferrer" className="paper-agate-link">
          Methodology &amp; sources ↗
        </Link>
      </div>
    </article>
  );
}
