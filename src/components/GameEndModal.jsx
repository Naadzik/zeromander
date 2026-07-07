import { useState, useEffect } from 'react'
import '../styles/GameEndModal.css'
import { seatGridString, TIER_LABELS } from '../utils/dailyChallenge'
import { currentStreak, getResultFor } from '../utils/dailyHistory'
import { METRIC_DESCRIPTIONS, NEUTRAL_MAP_NOTE } from '../utils/metricDescriptions'
import { PARTY } from '../utils/partyConfig'
import PartyIcon from './ui/PartyIcon'
import Icon from './ui/Icons'

// `daily`: { dayNumber, party, result: DailyResult } when showing a locked
// Heist result — switches the header and share text to the daily format.
// `challengeShare`: { stolen, url } — offers a "beat my score" link.
// `duelGoal`: the rival's stolen count when playing a challenge link.
export default function GameEndModal({ stats, difficulty, fairStats, daily, challengeShare, duelGoal, onTryAgain, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);

  function handleChallengeFriend() {
    if (!challengeShare) return;
    const s = challengeShare.stolen;
    const text = `I stole ${s > 0 ? '+' + s : s} seat${Math.abs(s) === 1 ? '' : 's'} on this map. Beat me: ${challengeShare.url}`;
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

  const playerParty = stats.playerParty || 'blue';
  const isThreeParty = !!stats.isThreeParty;
  const ourLabel = PARTY[playerParty]?.label ?? 'Unknown';
  const ourColor = PARTY[playerParty]?.color ?? '#888';
  // 2-party only
  const theirParty = playerParty === 'blue' ? 'red' : 'blue';
  const theirLabel = PARTY[theirParty].label;
  const theirColor = PARTY[theirParty].color;

  const CONSTRAINT_LABELS = { populationDeviation: 'strict population deviation', contiguity: 'contiguity' };

  const dailyResult = daily?.result ?? null;
  const stolen = dailyResult?.seatsStolen;

  const statusText = dailyResult
    ? (stolen > 0
        ? `DAILY #${daily.dayNumber}: STOLE +${stolen} SEAT${stolen === 1 ? '' : 'S'}`
        : `DAILY #${daily.dayNumber}: NOTHING STOLEN`)
    : stats.struckDown
      ? 'STRUCK DOWN BY COURT'
      : stats.won ? `PROJECTION: ${(PARTY[playerParty]?.label ?? 'YOU').toUpperCase()} WIN` : 'RESULT: TARGET MISSED';
  const statusMessage = dailyResult
    ? (stolen > 0
        ? `A party-blind map gives ${ourLabel} ${dailyResult.neutralSeats}/${dailyResult.numDistricts} seats. Yours delivers ${dailyResult.playerSeats}. Same voters, different lines — and it's legal in most states.`
        : `A party-blind map already gives ${ourLabel} ${dailyResult.neutralSeats}/${dailyResult.numDistricts} seats; your map delivers ${dailyResult.playerSeats}. The neutral commission out-drew you today.`)
    : stats.struckDown
      ? `The map would have won, but it violates the ${CONSTRAINT_LABELS[stats.struckDownReason] ?? stats.struckDownReason} requirement. The court sends its regards.`
      : stats.won
        ? 'A minority of the votes, a majority of the seats. Democracy, technically.'
        : 'The map held. You didn\'t. Try again — crueler this time.';

  function buildShareText() {
    if (dailyResult) {
      const streak = currentStreak();
      // Both tiers when locked — the Warm-up line and the Full Job flex.
      const tierLine = (tier) => {
        const r = getResultFor(daily.date, tier);
        if (!r) return null;
        const s = r.seatsStolen;
        return `${TIER_LABELS[tier]}: ${r.seatGrid} ${s > 0 ? `+${s}` : s} stolen`;
      };
      return [
        `Zeromander Daily #${daily.dayNumber}`,
        `🕵️ The Heist — ${ourLabel}, ${dailyResult.popPercent}% of the vote`,
        tierLine('small'),
        tierLine('full'),
        streak > 1 ? `🔥 Streak: ${streak}` : null,
        'naadzik.github.io/zeromander/?daily'
      ].filter(Boolean).join('\n');
    }
    const popPct = Math.round(stats.allStats?.ourPopPercent ?? stats.allStats?.bluePopPercent ?? 0);
    const seatsPct = Math.round(stats.ourSeats ?? stats.blueSeats ?? 0);
    return [
      'Zeromander 🗳️',
      `${ourLabel}: ${popPct}% votes → ${seatsPct}% seats`,
      seatGridString(stats.allStats?.districtBreakdown),
      stats.struckDown ? '⚖️ Struck down by court' : null,
      fairStats ? `Neutral map: ${fairStats.ourSeatCount}/${stats.totalDistricts} seats` : null,
      'naadzik.github.io/zeromander/'
    ].filter(Boolean).join('\n');
  }

  function handleShare() {
    const text = buildShareText();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  // The result cards show the FINAL outcome — after the election-night
  // reveal/swing when one happened. The "as drawn" numbers live in the
  // comparison rows below, so the cards, banner and side panel always agree.
  const ourWins = stats.swung ? stats.swung.ourSeatCount : (stats.ourWins ?? stats.blueWins);
  const theirWins = stats.swung ? stats.totalDistricts - stats.swung.ourSeatCount : (stats.theirWins ?? stats.redWins);
  const ourSeatsPct = stats.swung ? stats.swung.ourSeats : (stats.ourSeats ?? stats.blueSeats);
  const theirSeatsPct = stats.swung ? Math.round((100 - stats.swung.ourSeats) * 10) / 10 : (stats.theirSeats ?? stats.redSeats);

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

              {isThreeParty ? (
                <div className="results-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {['blue', 'red', 'green'].map(party => {
                    const p = PARTY[party];
                    const wins = stats.allStats[`${party}Seats`];
                    const pct  = stats.allStats[`${party}SeatsPct`];
                    const isUs = party === playerParty;
                    return (
                      <div key={party} className="result-card" style={{ outline: isUs ? `2px solid ${p.color}` : 'none' }}>
                        <div className="result-label"><PartyIcon party={party} /> {p.label}{isUs ? ' (You)' : ''}</div>
                        <div className="result-value" style={{ color: p.color }}>
                          {wins} / {stats.totalDistricts}
                        </div>
                        <div className="result-percentage">{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="results-grid">
                  <div className="result-card">
                    <div className="result-label"><PartyIcon party={playerParty} /> {ourLabel} (You)</div>
                    <div className="result-value" style={{ color: ourColor }}>
                      {ourWins} / {stats.totalDistricts}
                    </div>
                    <div className="result-percentage">{ourSeatsPct}%</div>
                  </div>

                  <div className="result-card">
                    <div className="result-label"><PartyIcon party={theirParty} /> {theirLabel}</div>
                    <div className="result-value" style={{ color: theirColor }}>
                      {theirWins} / {stats.totalDistricts}
                    </div>
                    <div className="result-percentage">{theirSeatsPct}%</div>
                  </div>
                </div>
              )}

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

              {dailyResult && (
                <div className="swing-comparison">
                  <div className="stat-line">
                    <span><Icon name="scale" size={14} /> Neutral map ({ourLabel}):</span>
                    <strong>{dailyResult.neutralSeats}/{dailyResult.numDistricts} seats</strong>
                  </div>
                  <div className="stat-line">
                    <span><Icon name="spy" size={14} /> Seats stolen:</span>
                    <strong>{stolen > 0 ? `+${stolen}` : stolen}</strong>
                  </div>
                  <div className="stat-line">
                    <span><Icon name="flame" size={14} /> Daily streak:</span>
                    <strong>{currentStreak()}</strong>
                  </div>
                </div>
              )}

              {stats.swung && (
                <div className="swing-comparison">
                  <div className="stat-line">
                    <span>{stats.swung.revealed ? 'As drawn (decided voters only):' : 'Nominal (as drawn):'}</span>
                    <strong>{stats.nominal.ourSeats}% seats — {stats.nominal.won ? 'WIN' : 'LOSE'}</strong>
                  </div>
                  <div className="stat-line">
                    <span>
                      Election night ({[
                        stats.swung.revealed ? 'undecideds broke' : null,
                        stats.swung.swingPct !== 0 ? `${stats.swung.swingPct > 0 ? '+' : ''}${stats.swung.swingPct}% national swing` : null
                      ].filter(Boolean).join(', ')}):
                    </span>
                    <strong>{stats.swung.ourSeats}% seats — {stats.swung.won ? 'WIN' : 'LOSE'}</strong>
                  </div>
                </div>
              )}

              {expanded && stats.allStats && (
                <div className="detailed-stats">
                  <h3>Detailed Statistics</h3>

                  <div className="stats-section">
                    <h4>Population & Representation</h4>
                    {isThreeParty ? (
                      <>
                        <div className="stat-line"><span><PartyIcon party="blue" /> Urban Union Population:</span><strong>{stats.allStats.bluePop}%</strong></div>
                        <div className="stat-line"><span><PartyIcon party="red" /> Heartland Alliance Population:</span><strong>{stats.allStats.redPop}%</strong></div>
                        <div className="stat-line"><span><PartyIcon party="green" /> Farmers Coalition Population:</span><strong>{stats.allStats.greenPop}%</strong></div>
                      </>
                    ) : (
                      <>
                        <div className="stat-line"><span><PartyIcon party="blue" /> Urban Union Population:</span><strong>{stats.allStats.bluePopPercent}%</strong></div>
                        <div className="stat-line"><span><PartyIcon party="red" /> Heartland Alliance Population:</span><strong>{stats.allStats.redPopPercent}%</strong></div>
                      </>
                    )}
                  </div>

                  {!isThreeParty && (
                    <div className="stats-section">
                      <h4>Efficiency Gap</h4>
                      <div className="stat-line">
                        <span>Gap:</span>
                        <strong>{stats.allStats.efficiencyGap}%</strong>
                      </div>
                      <div className="stat-line">
                        <span><PartyIcon party="blue" /> Urban Union Wasted Votes:</span>
                        <strong>{stats.allStats.blueWasted}</strong>
                      </div>
                      <div className="stat-line">
                        <span><PartyIcon party="red" /> Heartland Alliance Wasted Votes:</span>
                        <strong>{stats.allStats.redWasted}</strong>
                      </div>
                    </div>
                  )}

                  <div className="stats-section">
                    <h4>District Metrics</h4>
                    <div className="stat-line">
                      <span>Compactness:</span>
                      <strong>{stats.allStats.compactness}%</strong>
                    </div>
                    {!isThreeParty && (
                      <>
                        <div className="stat-line">
                          <span>Competitiveness:</span>
                          <strong>{stats.allStats.competitiveness}%</strong>
                        </div>
                        <div className="stat-line">
                          <span>Competitive Districts:</span>
                          <strong>{stats.allStats.competitiveCount}/{stats.totalDistricts}</strong>
                        </div>
                        <div className="stat-line">
                          <span>Partisan Asymmetry:</span>
                          <strong>{stats.allStats.asymmetry}%</strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="stats-section">
                    <h4>Methodology &amp; Sources</h4>
                    {Object.values(METRIC_DESCRIPTIONS).filter(m => m.source).map(m => (
                      <div className="stat-line" key={m.title}>
                        <span>{m.title}:</span>
                        <strong className="methodology-source">{m.source}</strong>
                      </div>
                    ))}
                    <p className="methodology-note">{NEUTRAL_MAP_NOTE}</p>
                  </div>

                  {stats.allStats.districtBreakdown && (
                    <div className="stats-section">
                      <h4>District Breakdown</h4>
                      {stats.swung && (
                        <p className="breakdown-caption">
                          {stats.swung.revealed
                            ? 'Bars are to scale. Lighter segments are undecided voters and the side they broke for; → marks a flipped seat.'
                            : 'Bars are to scale. Election-night national swing shown per district; → marks a flipped seat.'}
                        </p>
                      )}
                      <div className="districts-breakdown">
                        {(() => {
                          const rows = stats.allStats.districtBreakdown;
                          // Bars are TO SCALE: width ∝ the district's full vote
                          // count (decided + late-deciding grey), relative to
                          // the largest district. Late deciders render as
                          // lighter in-bar segments beside the camp they joined.
                          const fullTotal = d => isThreeParty
                            ? d.total
                            : d.blue + d.red + (d.greyBlue ?? 0) + (d.greyRed ?? 0);
                          const maxTotal = Math.max(...rows.map(fullTotal), 1);
                          // Only print a count when the segment is wide enough to hold it.
                          const label = (votes, total) => (votes > 0 && votes / total >= 0.13 ? votes : '');
                          return rows.map(d => {
                            const total = fullTotal(d);
                            const gB = d.greyBlue ?? 0;
                            const gR = d.greyRed ?? 0;
                            const winnerParty = isThreeParty
                              ? d.winner
                              : (d.blue + gB > d.red + gR ? 'blue' : 'red');
                            return (
                              <div key={d.id} className="district-breakdown-row">
                                <span className="district-num">D{d.id}</span>
                                <span className="district-bar-track">
                                  <span className="district-bar" style={{ width: `${(total / maxTotal) * 100}%` }}>
                                    <span className="bar-blue" style={{ width: `${(d.blue / total) * 100}%` }}>
                                      {label(d.blue, total)}
                                    </span>
                                    {gB > 0 && (
                                      <span className="bar-blue bar--late" style={{ width: `${(gB / total) * 100}%` }}>
                                        {label(gB, total)}
                                      </span>
                                    )}
                                    {isThreeParty && d.green > 0 && (
                                      <span className="bar-green" style={{ width: `${(d.green / total) * 100}%` }}>
                                        {label(d.green, total)}
                                      </span>
                                    )}
                                    {gR > 0 && (
                                      <span className="bar-red bar--late" style={{ width: `${(gR / total) * 100}%` }}>
                                        {label(gR, total)}
                                      </span>
                                    )}
                                    <span className="bar-red" style={{ width: `${(d.red / total) * 100}%` }}>
                                      {label(d.red, total)}
                                    </span>
                                  </span>
                                </span>
                                <span className="district-winner"><PartyIcon party={winnerParty} /></span>
                                {d.swing !== undefined && (d.swing !== 0 || d.flipped) && (
                                  <span className={`district-swing${d.flipped ? ' district-swing--flip' : ''}`}>
                                    {d.swing !== 0 && <>{d.swing > 0 ? '+' : ''}{d.swing}%</>}
                                    {d.flipped && <> → <PartyIcon party={d.swungWinner} /></>}
                                  </span>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide Details' : 'Show All Stats'}
          </button>
          <button className="btn-secondary" onClick={handleShare}>
            {copied ? '✓ Copied!' : 'Share Result'}
          </button>
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
          {onTryAgain ? (
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
        </div>
      </div>
    </div>
  );
}
