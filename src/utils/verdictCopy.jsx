import { seatGridString, TIER_LABELS } from './dailyChallenge'
import { currentStreak, getResultFor } from './dailyHistory'
import { analyzeMap, efficiencyGapContext } from './mapAnatomy'
import { PARTY } from './partyConfig'
import PartyIcon from '../components/ui/PartyIcon'
import Icon from '../components/ui/Icons'

// ============================================================================
// Shared verdict content — the single source for everything the end-of-game
// MODAL (broadcast/print dashboard) and the Broadsheet ARTICLE both render.
// Logic and markup were moved VERBATIM from GameEndModal so the two surfaces
// cannot drift; class names are kept so the existing modal + print CSS apply.
// ============================================================================

// One-line read on how big an adverse wave the map survives.
export function durabilityVerdict(adverse) {
  if (adverse <= 1) return 'A dummymander — one bad night and it collapses.';
  if (adverse <= 3) return 'Solid for a normal year; a real wave would crack it.';
  return 'Robust — it survives even a big wave.';
}

// The editorial tail for the closest-hold ("EDGE") line, scaled to the margin
// it is describing. A district won by `marginPct` points of the two-party vote
// flips on a uniform swing of about HALF that (the winner sits at 50+margin/2,
// a swing of margin/2 pulls them to 50) — so a 1-point margin is a genuine
// knife-edge while a 14-point margin is a wall. The line used to hardcode "a
// wave barely bigger than a rounding error takes it back" for EVERY margin,
// which read as absurd on a safe seat — a reported 14.5% hold called a
// rounding error. Now the words match the number. Thresholds are on the
// swing-to-flip (marginPct/2): <1pt, <2.5pt (a normal year), <5pt (a real
// wave), and beyond.
export function edgeVerdict(marginPct) {
  const swingToFlip = marginPct / 2;
  if (swingToFlip < 1) return 'a swing barely bigger than a rounding error takes it back.';
  if (swingToFlip < 2.5) return 'a normal election-year swing could take it back.';
  if (swingToFlip < 5) return 'it would take a real wave to dislodge.';
  return 'comfortable enough to ride out a landslide.';
}

// Tiny seats-vs-national-swing sparkline for the durability panel.
export function DurabilitySpark({ swing, numDistricts }) {
  const W = 220, H = 56, pad = 5;
  const xs = s => pad + ((s + 10) / 20) * (W - 2 * pad);
  const ys = v => (H - pad) - (v / Math.max(1, numDistricts)) * (H - 2 * pad);
  const pts = swing.curve.map(p => `${xs(p.swingPct).toFixed(1)},${ys(p.seats).toFixed(1)}`).join(' ');
  return (
    <svg className="durability-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Seats held versus national swing">
      <line x1={pad} x2={W - pad} y1={ys(swing.targetSeats)} y2={ys(swing.targetSeats)} className="dspark-target" strokeDasharray="3 3" />
      <line x1={xs(0)} x2={xs(0)} y1={pad} y2={H - pad} className="dspark-zero" />
      <polyline points={pts} className="dspark-curve" fill="none" />
    </svg>
  );
}

export const nfmt = n => Math.round(n).toLocaleString('en-US');
// Knife-thin margins keep their precision; the smallness IS the point.
export const pctFmt = p => (p < 1 ? p.toFixed(2) : p.toFixed(1));
export const dList = ids => ids.map(i => `D${i}`).join(', ');

const CONSTRAINT_LABELS = { populationDeviation: 'strict population deviation', contiguity: 'contiguity' };

// Status headline + standfirst. Precedence: lesson → daily → struck → won/lost.
export function verdictStatus({ stats, daily, lesson }) {
  const playerParty = stats.playerParty || 'blue';
  const ourLabel = PARTY[playerParty]?.label ?? 'Unknown';
  const dailyResult = daily?.result ?? null;
  const stolen = dailyResult?.seatsStolen;
  const dayLabel = daily ? `${daily.archive ? 'ARCHIVE · ' : ''}DAILY #${daily.dayNumber}` : '';
  const title = lesson
    ? (stats.won ? 'YOU JUST GERRYMANDERED' : 'ALMOST — RUN IT BACK')
    : dailyResult
    ? (stolen > 0
        ? `${dayLabel}: STOLE +${stolen} SEAT${stolen === 1 ? '' : 'S'}`
        : `${dayLabel}: NOTHING STOLEN`)
    : stats.struckDown
      ? 'STRUCK DOWN BY COURT'
      : stats.won ? `PROJECTION: ${(PARTY[playerParty]?.label ?? 'YOU').toUpperCase()} WIN` : 'RESULT: TARGET MISSED';
  const message = lesson
    ? (stats.won
        ? `40% of the vote. ${stats.ourWins} of ${stats.totalDistricts} seats. You did this — and in most states, it's perfectly legal. Now try today's real board.`
        : 'Not quite a majority this time — but you felt how it works: pack them tight, crack the rest. Redraw, or jump to today\'s real board.')
    : dailyResult
    ? (stolen > 0
        ? `A party-blind map gives ${ourLabel} ${dailyResult.neutralSeats}/${dailyResult.numDistricts} seats. Yours delivers ${dailyResult.playerSeats}. Same voters, different lines — and it's legal in most states.`
        : `A party-blind map already gives ${ourLabel} ${dailyResult.neutralSeats}/${dailyResult.numDistricts} seats; your map delivers ${dailyResult.playerSeats}. The neutral commission out-drew you today.`)
    : stats.struckDown
      ? `The map would have won, but it violates the ${CONSTRAINT_LABELS[stats.struckDownReason] ?? stats.struckDownReason} requirement. The court sends its regards.`
      : stats.won
        ? 'A minority of the votes, a majority of the seats. Democracy, technically.'
        : 'The map held. You didn\'t. Try again — crueler this time.';
  return { title, message };
}

// Party labels/colors + FINAL seat counts (post-swing when election night ran).
export function resultCounts(stats) {
  const playerParty = stats.playerParty || 'blue';
  const isThreeParty = !!stats.isThreeParty;
  const ourLabel = PARTY[playerParty]?.label ?? 'Unknown';
  const ourColor = PARTY[playerParty]?.cssColor ?? '#888';
  // 2-party only
  const theirParty = playerParty === 'blue' ? 'red' : 'blue';
  const theirLabel = PARTY[theirParty].label;
  const theirColor = PARTY[theirParty].cssColor;
  const ourWins = stats.swung ? stats.swung.ourSeatCount : (stats.ourWins ?? stats.blueWins);
  const theirWins = stats.swung ? stats.totalDistricts - stats.swung.ourSeatCount : (stats.theirWins ?? stats.redWins);
  const ourSeatsPct = stats.swung ? stats.swung.ourSeats : (stats.ourSeats ?? stats.blueSeats);
  const theirSeatsPct = stats.swung ? Math.round((100 - stats.swung.ourSeats) * 10) / 10 : (stats.theirSeats ?? stats.redSeats);
  return { playerParty, isThreeParty, ourLabel, ourColor, theirParty, theirLabel, theirColor, ourWins, theirWins, ourSeatsPct, theirSeatsPct };
}

// Anatomy inputs + the panel gate. Null-safe for 3-party (no anatomy there).
export function anatomyData(stats) {
  const playerParty = stats.playerParty || 'blue';
  const isThreeParty = !!stats.isThreeParty;
  const anatomy = !isThreeParty && stats.allStats?.districtBreakdown
    ? analyzeMap(stats.allStats.districtBreakdown, playerParty) : null;
  const gapContextLine = (!isThreeParty && stats.allStats)
    ? efficiencyGapContext(stats.allStats.efficiencyGap, stats.totalDistricts) : null;
  const votePct = stats.allStats?.ourPopPercent;
  const seatPct = stats.ourSeats;
  const seatBonus = (votePct != null && seatPct != null) ? Math.round(seatPct - votePct) : null;
  const showAnatomy = !!anatomy && (
    anatomy.packIds.length > 0 || anatomy.crackIds.length > 0 ||
    (seatBonus != null && Math.abs(seatBonus) >= 8)
  );
  return { anatomy, gapContextLine, votePct, seatPct, seatBonus, showAnatomy };
}

export function buildShareText({ stats, daily, fairStats }) {
  const { ourLabel } = resultCounts(stats);
  const dailyResult = daily?.result ?? null;
  const stolen = dailyResult?.seatsStolen;
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
      `Zeromander Daily #${daily.dayNumber}${daily.archive ? ' (archive)' : ''}`,
      `🕵️ The Heist — ${ourLabel}, ${dailyResult.popPercent}% of the vote`,
      daily.archive ? `${TIER_LABELS[daily.tier]}: ${dailyResult.seatGrid} ${stolen > 0 ? `+${stolen}` : stolen} stolen` : tierLine('small'),
      daily.archive ? null : tierLine('full'),
      (!daily.archive && streak > 1) ? `🔥 Streak: ${streak}` : null,
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
    // v2 baseline: the median of the party-blind ensemble, with its range —
    // "the typical neutral map", not one arbitrary draw.
    fairStats?.ensemble
      ? `Neutral maps: median ${fairStats.ensemble.median}/${stats.totalDistricts} seats (range ${fairStats.ensemble.min}–${fairStats.ensemble.max})`
      : fairStats ? `Neutral map: ${fairStats.ourSeatCount}/${stats.totalDistricts} seats` : null,
    'naadzik.github.io/zeromander/'
  ].filter(Boolean).join('\n');
}

export function buildChallengeText(challengeShare) {
  const s = challengeShare.stolen;
  return `I stole ${s > 0 ? '+' + s : s} seat${Math.abs(s) === 1 ? '' : 's'} on this map. Beat me: ${challengeShare.url}`;
}

// ── Shared JSX blocks (markup byte-identical to the former modal render) ──

export function FinalResultsGrid({ stats }) {
  const { playerParty, isThreeParty, ourLabel, ourColor, theirParty, theirLabel, theirColor, ourWins, theirWins, ourSeatsPct, theirSeatsPct } = resultCounts(stats);
  if (isThreeParty) {
    return (
      <div className="results-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {['blue', 'red', 'green'].map(party => {
          const p = PARTY[party];
          const wins = stats.allStats[`${party}Seats`];
          const pct  = stats.allStats[`${party}SeatsPct`];
          const isUs = party === playerParty;
          return (
            <div key={party} className="result-card" style={{ outline: isUs ? `2px solid ${p.cssColor}` : 'none' }}>
              <div className="result-label"><PartyIcon party={party} /> {p.label}{isUs ? ' (You)' : ''}</div>
              <div className="result-value" style={{ color: p.cssColor }}>
                {wins} / {stats.totalDistricts}
              </div>
              <div className="result-percentage">{pct}%</div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
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
  );
}

export function DailyComparison({ daily, stats }) {
  const { ourLabel } = resultCounts(stats);
  const dailyResult = daily?.result ?? null;
  if (!dailyResult) return null;
  const stolen = dailyResult.seatsStolen;
  // v2 records carry the ensemble context (median of n party-blind maps +
  // their range); v1 records in stored history predate it — render the old
  // single-map line for those, never invent a range.
  const hasEnsemble = dailyResult.ensembleN != null;
  return (
    <div className="swing-comparison">
      <div className="stat-line">
        <span><Icon name="scale" size={14} /> {hasEnsemble ? `Party-blind maps, median of ${dailyResult.ensembleN} (${ourLabel}):` : `Neutral map (${ourLabel}):`}</span>
        <strong>
          {dailyResult.neutralSeats}/{dailyResult.numDistricts} seats
          {hasEnsemble ? ` (range ${dailyResult.neutralMin}–${dailyResult.neutralMax})` : ''}
        </strong>
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
  );
}

export function SwingComparison({ stats }) {
  if (!stats.swung) return null;
  return (
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
  );
}

export function DurabilityPanel({ durability }) {
  if (!durability) return null;
  return (
    <div className="durability">
      <h4>Durability</h4>
      <div className="durability-swing">
        <DurabilitySpark swing={durability.swing} numDistricts={durability.numDistricts} />
        <p className="durability-line">
          Holds <strong>{durability.swing.seatsAtZero}/{durability.numDistricts}</strong> until the national mood swings <strong>{durability.swing.adverseHold}%</strong> against you.{' '}
          {durabilityVerdict(durability.swing.adverseHold)}
        </p>
      </div>
      {durability.breaks && (
        <p className="durability-line durability-breaks">
          <Icon name="undecided" size={13} /> If the undecideds broke differently, you still hit target in <strong>{durability.breaks.meetsTargetPct}%</strong> of scenarios (typically {durability.breaks.seatDist.min}–{durability.breaks.seatDist.max} seats).
        </p>
      )}
    </div>
  );
}

export function AnatomyPanel({ stats }) {
  const { theirLabel } = resultCounts(stats);
  const { anatomy, votePct, seatPct, seatBonus, showAnatomy } = anatomyData(stats);
  if (!showAnatomy) return null;
  return (
    <div className="map-anatomy">
      <h4>Anatomy of your map</h4>
      {seatBonus != null && (
        <p className="anatomy-line">
          <span className="anatomy-tag anatomy-tag--stat">HAUL</span>
          {seatBonus >= 0
            ? <>{Math.round(votePct)}% of the vote, <strong>{Math.round(seatPct)}%</strong> of the seats — a <strong>+{seatBonus}-point</strong> bonus you drew for yourself.</>
            : <>{Math.round(votePct)}% of the vote but only <strong>{Math.round(seatPct)}%</strong> of the seats — the lines worked against you.</>}
        </p>
      )}
      {anatomy.packIds.length > 0 && (
        <p className="anatomy-line">
          <span className="anatomy-tag anatomy-tag--pack">PACK</span>
          {theirLabel} crammed into {dList(anatomy.packIds)} — up to {anatomy.worstPackPct}% of the vote there, and everything past 50% is wasted.
        </p>
      )}
      {anatomy.crackIds.length > 0 && (
        <p className="anatomy-line">
          <span className="anatomy-tag anatomy-tag--crack">CRACK</span>
          {theirLabel} split across {dList(anatomy.crackIds)} — a 40–49% minority in each that wins none of them.
        </p>
      )}
      {anatomy.wasted && (
        <p className="anatomy-line">
          <span className="anatomy-tag anatomy-tag--stat">WASTED</span>
          <strong>{nfmt(anatomy.wasted.voters)}</strong> voters — {anatomy.wasted.pct}% of everyone who turned out — backed a losing candidate. Their ballots elected no one.
        </p>
      )}
      {anatomy.margins && (
        <p className="anatomy-line">
          <span className="anatomy-tag anatomy-tag--stat">SPREAD</span>
          You win your seats by <strong>~{anatomy.margins.ourAvg} pts</strong> on average; they win theirs by <strong>~{anatomy.margins.theirAvg}</strong>.{' '}
          {anatomy.margins.theirAvg - anatomy.margins.ourAvg >= 8
            ? 'That gap is the whole trick — your wins are lean, theirs are wasted landslides.'
            : anatomy.margins.theirAvg - anatomy.margins.ourAvg >= 3
              ? 'You win a little tighter than they do — a modest efficiency edge.'
              : 'Your wins are no leaner than theirs — the seats came from where the lines fell, not from thinner margins.'}
        </p>
      )}
      {anatomy.tippingPoint && (
        <p className="anatomy-line">
          <span className="anatomy-tag anatomy-tag--stat">EDGE</span>
          Your thinnest hold is <strong>D{anatomy.tippingPoint.id}</strong>, a <strong>{pctFmt(anatomy.tippingPoint.marginPct)}% margin</strong> ({nfmt(anatomy.tippingPoint.marginVoters)} voters) — {edgeVerdict(anatomy.tippingPoint.marginPct)}
        </p>
      )}
    </div>
  );
}

export function DistrictBreakdownBars({ stats }) {
  const isThreeParty = !!stats.isThreeParty;
  if (!stats.allStats?.districtBreakdown) return null;
  return (
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
        const fmt = n => Math.round(n).toLocaleString();
        const seg = (w, total, cls, title) => w > 0 && (
          <span className={cls} style={{ width: `${(w / total) * 100}%` }} title={title} />
        );
        return rows.map(d => {
          const total = fullTotal(d);
          const gB = d.greyBlue ?? 0;
          const gR = d.greyRed ?? 0;
          const blueTot = d.blue + gB;
          const redTot = d.red + gR;
          const greenTot = isThreeParty ? (d.green ?? 0) : 0;
          const winnerParty = isThreeParty
            ? d.winner
            : (blueTot > redTot ? 'blue' : 'red');
          const nm = { blue: 'Urban Union', red: 'Heartland', green: 'Farmers' };
          const legendItem = (party, votes) => (
            <span className={`legend-item${winnerParty === party ? ' legend-item--win' : ''}`}>
              <PartyIcon party={party} size={11} /> {fmt(votes)}
            </span>
          );
          return (
            <div key={d.id} className={`district-breakdown-row${d.flipped ? ' district-breakdown-row--flipped' : ''}`}>
              <span className="district-num">D{d.id}</span>
              <span className="district-bar-track">
                <span className="district-bar" style={{ width: `${(total / maxTotal) * 100}%` }}>
                  {seg(d.blue, total, 'bar-blue', `${nm.blue}: ${fmt(d.blue)}`)}
                  {seg(gB, total, 'bar-blue bar--late', `Undecided → ${nm.blue}: ${fmt(gB)}`)}
                  {isThreeParty && seg(d.green, total, 'bar-green', `${nm.green}: ${fmt(d.green)}`)}
                  {seg(gR, total, 'bar-red bar--late', `Undecided → ${nm.red}: ${fmt(gR)}`)}
                  {seg(d.red, total, 'bar-red', `${nm.red}: ${fmt(d.red)}`)}
                </span>
              </span>
              <span className="district-result">
                {d.flipped && <span className="flip-badge">FLIPPED</span>}
                {d.swing !== undefined && d.swing !== 0 && (
                  <span className="district-swing">{d.swing > 0 ? '+' : ''}{d.swing}%</span>
                )}
                <PartyIcon party={winnerParty} size={18} />
              </span>
              <span className="district-legend">
                {legendItem('blue', blueTot)}
                {isThreeParty && legendItem('green', greenTot)}
                {legendItem('red', redTot)}
              </span>
            </div>
          );
        });
      })()}
    </div>
  );
}

// `fairStats`: the neutral map's core stats when computed — anchors the gap
// to the same board's party-blind baseline (the honest comparison; statewide
// thresholds mislead at this district count).
export function DetailedStats({ stats, fairStats = null }) {
  const isThreeParty = !!stats.isThreeParty;
  const { gapContextLine } = anatomyData(stats);
  const favors = stats.allStats?.gapFavors;
  const favorsLabel = favors && favors !== 'none' ? PARTY[favors]?.label : null;
  const fairGapPct = fairStats?.gap ? Math.round(fairStats.gap.gap * 10) / 10 : null;
  return (
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
            <strong>
              {stats.allStats.efficiencyGap}%
              {favorsLabel ? ` favoring ${favorsLabel}` : ''}
              {stats.allStats.gapSeats != null ? ` (≈${stats.allStats.gapSeats} seats)` : ''}
            </strong>
          </div>
          {fairGapPct != null && (
            <div className="stat-line">
              <span>Party-blind map on this board:</span>
              <strong>{fairGapPct}%</strong>
            </div>
          )}
          <div className="stat-line">
            <span><PartyIcon party="blue" /> Urban Union Wasted Votes:</span>
            <strong>{stats.allStats.blueWasted}</strong>
          </div>
          <div className="stat-line">
            <span><PartyIcon party="red" /> Heartland Alliance Wasted Votes:</span>
            <strong>{stats.allStats.redWasted}</strong>
          </div>
          {gapContextLine && <p className="gap-context">{gapContextLine}</p>}
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
              <span>Disproportionality:</span>
              <strong>{stats.allStats.asymmetry}%</strong>
            </div>
            {stats.allStats.meanMedian != null && (
              <div className="stat-line">
                <span>Mean–median (+ = your way):</span>
                <strong>{stats.allStats.meanMedian > 0 ? '+' : ''}{stats.allStats.meanMedian}pp</strong>
              </div>
            )}
            {stats.allStats.bias50Seats != null && (
              <div className="stat-line">
                <span>Seats in a tied election:</span>
                <strong>{stats.allStats.bias50Seats}/{stats.totalDistricts}</strong>
              </div>
            )}
          </>
        )}
      </div>

      {stats.allStats.districtBreakdown && (
        <div className="stats-section">
          <h4>District Breakdown</h4>
          {stats.swung && (
            <p className="breakdown-caption">
              Bars are to scale; darker = decided votes, lighter = undecideds and the side
              they broke for. Totals are listed under each bar; a gold <strong>FLIPPED</strong> tag
              marks a seat the undecideds turned.
            </p>
          )}
          <DistrictBreakdownBars stats={stats} />
        </div>
      )}
    </div>
  );
}
