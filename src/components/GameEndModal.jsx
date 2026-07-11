import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../styles/GameEndModal.css'
import Icon from './ui/Icons'
import {
  verdictStatus,
  buildShareText,
  buildChallengeText,
  FinalResultsGrid,
  DailyComparison,
  SwingComparison,
  DurabilityPanel,
  AnatomyPanel,
  DetailedStats,
} from '../utils/verdictCopy'

// `daily`: { dayNumber, party, result: DailyResult } when showing a locked
// Heist result — switches the header and share text to the daily format.
// `challengeShare`: { stolen, url } — offers a "beat my score" link.
// `duelGoal`: the rival's stolen count when playing a challenge link.
// All verdict content (status copy, result grids, swing/durability/anatomy
// panels, detailed stats, share text) lives in utils/verdictCopy.jsx, shared
// verbatim with the Broadsheet edition's article so the two can't drift.
export default function GameEndModal({ stats, difficulty, fairStats, daily, challengeShare, durability, duelGoal, lesson, onTryAgain, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);

  function handleChallengeFriend() {
    if (!challengeShare) return;
    const text = buildChallengeText(challengeShare);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setChallengeCopied(true);
        setTimeout(() => setChallengeCopied(false), 2000);
      });
    }
  }

  // Election-night counting beat — only for swing-WITHOUT-grey games. When
  // grey voters exist, the on-map cluster reveal (GameApp) already played
  // before this modal opened, so a second counting screen would be redundant.
  const [phase, setPhase] = useState(() => (stats.swung && !stats.swung.revealed ? 'counting' : 'result'));
  const [tickPct, setTickPct] = useState(0);

  useEffect(() => {
    if (phase !== 'counting') return;
    // Jittering swing readout for suspense; lands on the real number at reveal.
    const ticker = setInterval(() => setTickPct(((Math.random() * 8 - 4)).toFixed(1)), 130);
    const reveal = setTimeout(() => setPhase('result'), 2200);
    return () => { clearInterval(ticker); clearTimeout(reveal); };
  }, [phase]);

  if (phase === 'counting') {
    return (
      <div className="modal-overlay">
        <div className="modal-content modal-content--counting" onClick={() => setPhase('result')}>
          <div className="counting-screen">
            <h2 className="counting-title"><Icon name="ballot" size={22} /> ELECTION NIGHT</h2>
            <p className="counting-message">{stats.swung?.revealed ? 'Counting undecided precincts…' : 'Counting votes…'}</p>
            {stats.swung?.swingPct !== 0 && (
              <div className="counting-swing">
                national swing <strong>{tickPct > 0 ? '+' : ''}{tickPct}%</strong>
              </div>
            )}
            <div className="counting-dots"><span /><span /><span /></div>
            <p className="counting-skip">tap to skip</p>
          </div>
        </div>
      </div>
    );
  }

  const { title: statusText, message: statusMessage } = verdictStatus({ stats, daily, lesson });

  function handleShare() {
    const text = buildShareText({ stats, daily, fairStats });
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div className="modal-overlay" onClick={expanded ? onClose : undefined}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header" data-won={stats.won ? 'true' : 'false'}>
          {stats.struckDown && <div className="court-stamp">Struck<br />Down</div>}
          <div className="modal-header__row">
            <div>
              <h2 className="modal-status-title">{statusText}</h2>
              <p className="modal-status-message">{statusMessage}</p>
            </div>
            {expanded && (
              <button className="modal-close-btn" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="modal-body">
              <h3>Final Results</h3>

              <FinalResultsGrid stats={stats} />

              {duelGoal !== null && challengeShare && (
                <div className="swing-comparison">
                  <div className="stat-line">
                    <span><Icon name="target" size={14} /> Rival's score:</span>
                    <strong>{duelGoal > 0 ? `+${duelGoal}` : duelGoal} stolen</strong>
                  </div>
                  <div className="stat-line">
                    <span>Yours:</span>
                    <strong>
                      {challengeShare.stolen > 0 ? `+${challengeShare.stolen}` : challengeShare.stolen} stolen —{' '}
                      {challengeShare.stolen > duelGoal ? 'rival beaten' : challengeShare.stolen === duelGoal ? 'dead heat' : 'not this time'}
                    </strong>
                  </div>
                </div>
              )}

              <DailyComparison daily={daily} stats={stats} />

              <SwingComparison stats={stats} />

              <DurabilityPanel durability={durability} />

              <AnatomyPanel stats={stats} />

              {expanded && stats.allStats && <DetailedStats stats={stats} />}
        </div>

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide Details' : 'Show All Stats'}
          </button>
          {!lesson && (
            <button className="btn-secondary" onClick={handleShare}>
              {copied ? '✓ Copied!' : 'Share Result'}
            </button>
          )}
          {challengeShare && (
            <button className="btn-secondary" onClick={handleChallengeFriend}>
              {challengeCopied ? '✓ Link copied!' : 'Challenge a friend'}
            </button>
          )}
          {expanded && (
            <button className="btn-secondary" onClick={onClose}>
              Close & View Game
            </button>
          )}
          {lesson ? (
            <>
              <button className="btn-secondary" onClick={onTryAgain}>Redraw</button>
              <button className="btn-primary" onClick={lesson.onPlayDaily}>Play today's Daily →</button>
            </>
          ) : onTryAgain ? (
            <button className="btn-primary" onClick={onTryAgain}>
              Try Again
            </button>
          ) : (
            // Daily mode: one submission per day, no retries — offer Close instead.
            !expanded && (
              <button className="btn-primary" onClick={onClose}>
                Close & View Game
              </button>
            )
          )}
          <Link to="/methodology" target="_blank" rel="noopener noreferrer" className="modal-methodology-link">
            Methodology &amp; sources ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
