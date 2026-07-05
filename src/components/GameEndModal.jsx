import { useState, useEffect } from 'react'
import '../styles/GameEndModal.css'
import { seatGridString } from '../utils/dailyChallenge'
import { currentStreak } from '../utils/dailyHistory'
import { METRIC_DESCRIPTIONS, NEUTRAL_MAP_NOTE } from '../utils/metricDescriptions'
import { PARTY } from '../utils/partyConfig'
import PartyIcon from './ui/PartyIcon'

// `daily`: { dayNumber, party, result: DailyResult } when showing a locked
// Heist result — switches the header and share text to the daily format.
export default function GameEndModal({ stats, difficulty, fairStats, daily, onTryAgain, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Election-night reveal: with uncertainty on, hold the verdict back for a
  // short "counting votes" beat before showing the swung result. Presentation
  // only — the swung result was already computed and stays authoritative.
  const [phase, setPhase] = useState(() => (stats.swung ? 'counting' : 'result'));
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
            <h2 className="counting-title">🗳️ ELECTION NIGHT</h2>
            <p className="counting-message">Counting votes…</p>
            <div className="counting-swing">
              national swing <strong>{tickPct > 0 ? '+' : ''}{tickPct}%</strong>
            </div>
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
      ? `This map would have won, but violates the ${CONSTRAINT_LABELS[stats.struckDownReason] ?? stats.struckDownReason} requirement — a court struck it down.`
      : stats.won
        ? 'Congratulations! You achieved your goal!'
        : 'Keep trying! You\'ll get there next time.';

  function buildShareText() {
    if (dailyResult) {
      const streak = currentStreak();
      const stolenLabel = stolen > 0 ? `Stole +${stolen}` : stolen === 0 ? 'Stole +0' : `Stole ${stolen}`;
      return [
        `Zeromander Daily #${daily.dayNumber}`,
        `🕵️ The Heist — ${ourLabel}`,
        `${dailyResult.popPercent}% of the vote → ${dailyResult.seatGrid}  (${dailyResult.playerSeats}/${dailyResult.numDistricts} seats)`,
        `⚖️ Neutral map: ${dailyResult.neutralSeats}/${dailyResult.numDistricts} · ${stolenLabel}`,
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

  const ourWins = stats.ourWins ?? stats.blueWins;
  const theirWins = stats.theirWins ?? stats.redWins;
  const ourSeatsPct = stats.ourSeats ?? stats.blueSeats;
  const theirSeatsPct = stats.theirSeats ?? stats.redSeats;

  return (
    <div className="modal-overlay" onClick={expanded ? onClose : undefined}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header" data-won={stats.won ? 'true' : 'false'}>
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

              {dailyResult && (
                <div className="swing-comparison">
                  <div className="stat-line">
                    <span>⚖️ Neutral map ({ourLabel}):</span>
                    <strong>{dailyResult.neutralSeats}/{dailyResult.numDistricts} seats</strong>
                  </div>
                  <div className="stat-line">
                    <span>🕵️ Seats stolen:</span>
                    <strong>{stolen > 0 ? `+${stolen}` : stolen}</strong>
                  </div>
                  <div className="stat-line">
                    <span>🔥 Daily streak:</span>
                    <strong>{currentStreak()}</strong>
                  </div>
                </div>
              )}

              {stats.swung && (
                <div className="swing-comparison">
                  <div className="stat-line">
                    <span>Nominal (as drawn):</span>
                    <strong>{stats.nominal.ourSeats}% seats — {stats.nominal.won ? 'WIN' : 'LOSE'}</strong>
                  </div>
                  <div className="stat-line">
                    <span>Election night ({stats.swung.swingPct > 0 ? '+' : ''}{stats.swung.swingPct}% national ± local swings):</span>
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
                          Election-night swing shown per district (national + local); → marks a flipped seat.
                        </p>
                      )}
                      <div className="districts-breakdown">
                        {stats.allStats.districtBreakdown.map(d => {
                          const total = isThreeParty ? d.total : (d.blue + d.red);
                          const winnerParty = isThreeParty
                            ? d.winner
                            : (d.blue > d.red ? 'blue' : 'red');
                          return (
                            <div key={d.id} className="district-breakdown-row">
                              <span className="district-num">D{d.id}</span>
                              <span className="district-bar">
                                <span
                                  className="bar-blue"
                                  style={{ width: `${(d.blue / total) * 100}%` }}
                                >
                                  {d.blue > 0 ? d.blue : ''}
                                </span>
                                {isThreeParty && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: `${(d.green / total) * 100}%`,
                                      background: '#16A34A',
                                      color: 'white',
                                      fontSize: '0.65rem',
                                      overflow: 'hidden',
                                      textAlign: 'center',
                                      whiteSpace: 'nowrap',
                                      padding: '0 2px'
                                    }}
                                  >
                                    {d.green > 0 ? d.green : ''}
                                  </span>
                                )}
                                <span
                                  className="bar-red"
                                  style={{ width: `${(d.red / total) * 100}%` }}
                                >
                                  {d.red > 0 ? d.red : ''}
                                </span>
                              </span>
                              <span className="district-winner"><PartyIcon party={winnerParty} /></span>
                              {d.swing !== undefined && (
                                <span className={`district-swing${d.flipped ? ' district-swing--flip' : ''}`}>
                                  {d.swing > 0 ? '+' : ''}{d.swing}%
                                  {d.flipped && <> → <PartyIcon party={d.swungWinner} /></>}
                                </span>
                              )}
                            </div>
                          );
                        })}
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
            {copied ? '✓ Copied!' : '📋 Share Result'}
          </button>
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
