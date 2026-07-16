import { useMemo } from 'react'
import { getDistrictPopulation, classifyDistricts } from '../utils/gameLogic'
import { computeCoreStats, round1, targetSeatCount } from '../utils/computeGameStats'
import { checkConstraintViolations, computePopulationDeviation } from '../utils/legalConstraints'
import { litigationRisk } from '../utils/litigation'
import { communityRepresentation } from '../utils/community'
import { PARTY } from '../utils/partyConfig'
import PartyIcon from './ui/PartyIcon'
import Icon from './ui/Icons'
import SeatBar from './ui/SeatBar'
import { METRIC_DESCRIPTIONS } from '../utils/metricDescriptions'
import { useState } from 'react'
import '../styles/GameStats.css'

function MetricInfo({ metric }) {
  const [open, setOpen] = useState(false);
  const info = METRIC_DESCRIPTIONS[metric];
  if (!info) return null;
  return (
    <span className="metric-info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}>
      <span className="metric-info-icon" aria-label={`Explain ${info.title}`}>?</span>
      {open && (
        <span className="metric-info-popover">
          <strong>{info.title}</strong>
          <span>{info.body}</span>
          {info.source && <span className="metric-info-source">Source: {info.source}</span>}
        </span>
      )}
    </span>
  );
}

export default function GameStats({
  populationMap,
  districts,
  numDistricts,
  currentDistrict,
  targetSeatPercentage,
  playerParty = 'blue',
  onDistrictSelect,
  onToggleUnassigned,
  showUnassignedCounties,
  isThreeParty = false,
  constraints,
  // Plan-average compactness of this board's party-blind map, when computed
  // (the daily computes it eagerly; sandbox only at completion). Anchors the
  // litigation gauge's shape factor to THIS board's achievable compactness
  // instead of a fixed threshold.
  fairCompactness = null,
  // The neutral map's seat count for the player — drives the v2 target
  // ("beat the neutral map by one"); null falls back to the proportional rule.
  fairSeats = null,
  // The neutral map's efficiency gap (signed seat-equivalents + unsigned %):
  // anchors the litigation EG factor and the tile's baseline line.
  fairGapSeats = null,
  fairGapPct = null
}) {
  const ourLabel = PARTY[playerParty].label;
  const ourColor = PARTY[playerParty].cssColor;
  const currentDistrictPop = useMemo(
    () => getDistrictPopulation(populationMap, districts, currentDistrict),
    [populationMap, districts, currentDistrict]
  );

  const stats = useMemo(() => {
    const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty);
    // Base the target on the player's share of the WHOLE electorate (undecideds
    // counted in the denominator), not the decided-only share. The decided
    // share swings with WHERE the grey landed — showing it leaks how the
    // undecideds lean before the reveal. Electorate share stays ~the dealt
    // number, so toggling undecideds no longer gives the population away.
    const electorateShare = core.ourPopPercent * (1 - (core.shares.grey ?? 0) / 100);
    const base = {
      seats: core.seats,
      ourSeats: round1(core.ourSeatsPct),
      ourSeatCount: core.ourSeatCount,
      ourPopPercent: round1(electorateShare),
      assigned: core.assigned,
      mapTotalPop: core.mapTotalPop,
      // null until a first district is drawn — a blank board has no shape to
      // score, and the tile shows "—" instead of a fake 0%.
      compactness: core.compactness.average == null ? null : Math.round(core.compactness.average * 100),
      targetSeats: targetSeatCount(electorateShare, numDistricts, fairSeats),
      // Which rule set the target — drives the caption under the seat bar.
      targetFromNeutral: fairSeats != null,
      fairSeats,
      districtStats: core.districtStats
    };

    if (isThreeParty) {
      return {
        ...base,
        pops: {
          blue: round1(core.shares.blue),
          red: round1(core.shares.red),
          green: round1(core.shares.green),
        }
      };
    }

    // Risk-aware live view: seats a district's undecided population could
    // still flip are shown as tossups, not banked wins.
    const classified = classifyDistricts(populationMap, districts, numDistricts);
    const safeSeats = {
      blue: classified.filter(r => r.status === 'blue').length,
      red: classified.filter(r => r.status === 'red').length
    };
    const tossups = classified.filter(r => r.status === 'tossup').length;
    const ourSafe = playerParty === 'blue' ? safeSeats.blue : safeSeats.red;

    const dev = computePopulationDeviation(populationMap, districts, numDistricts, 10);
    const community = communityRepresentation(populationMap, districts, numDistricts);
    const litigation = litigationRisk({
      compactness: core.compactness.average,
      fairCompactness,
      gapSeats: core.gap.gapSeats,
      fairGapSeats,
      meanMedian: core.meanMedian.valid ? core.meanMedian.mm : null,
      numDistricts,
      worstDeviationPct: dev.worstDeviationPct,
      communityDilution: community ? community.dilution : null
    });

    return {
      ...base,
      litigation,
      community,
      classified,
      safeSeats,
      tossups,
      ourSafe,
      greyShare: round1(core.shares.grey ?? 0),
      blueSeats: round1((core.seats.blue / numDistricts) * 100),
      popPercent: round1(core.shares.blue),
      gap: round1(core.gap.gap),
      gapFavors: core.gap.favors,
      gapSeatsAbs: round1(Math.abs(core.gap.gapSeats)),
      // The same board's party-blind gap — the fair comparison; null until
      // the neutral map is computed (daily: eagerly; sandbox: at completion).
      fairGap: fairGapSeats != null && fairGapPct != null ? round1(fairGapPct) : null,
      // Wasted votes are people — the model carries the exact half-vote the
      // winner's-surplus term can produce on odd district totals, the display
      // shows whole voters.
      blueWasted: Math.round(core.gap.blueWasted),
      redWasted: Math.round(core.gap.redWasted),
      competitiveness: round1(core.competitiveness.percentage),
      competitiveCount: core.competitiveness.competitive,
      totalDistricts: core.competitiveness.total,
      asymmetry: round1(core.asymmetry.asymmetry),
      asymmetryBlueVote: core.asymmetry.blueVotePercent,
      asymmetryBlueSeat: core.asymmetry.blueSeatPercent,
      // Signed pp toward the player; null (shown "—") until every district
      // has two-party votes — the metric never guesses from a partial map.
      meanMedian: core.meanMedian.valid ? round1(core.meanMedian.mm) : null,
      districtStats: core.districtStats
    };
  }, [populationMap, districts, numDistricts, playerParty, isThreeParty, fairCompactness, fairSeats, fairGapSeats, fairGapPct]);

  const violations = useMemo(
    () => constraints ? checkConstraintViolations(populationMap, districts, numDistricts, constraints) : null,
    [populationMap, districts, numDistricts, constraints]
  );

  const targetPopulation = stats.mapTotalPop / numDistricts;
  const minPopulation = Math.ceil(targetPopulation * 0.9);
  const maxPopulation = Math.ceil(targetPopulation * 1.1);

  return (
    <div className="stats-panel">
      <h3>Game Stats</h3>

      {currentDistrict > 0 && (
        <div className="stat-block">
          <div className="stat-label">District {currentDistrict}</div>
          <div className="stat-value ticker-number">{currentDistrictPop} votes</div>
          <div className="capacity-bar">
            <div
              className="capacity-fill"
              style={{
                width: `${(currentDistrictPop / maxPopulation) * 100}%`,
                backgroundColor: currentDistrictPop < minPopulation || currentDistrictPop > maxPopulation
                  ? 'var(--error-color)' : 'var(--win-green)'
              }}
            ></div>
          </div>
          <div className="capacity-range">
            Range: {minPopulation}-{maxPopulation} votes (±10%)
          </div>
          {stats.districtStats[currentDistrict - 1] && (
            <div className="district-votes">
              <div><PartyIcon party="blue" /> Urban Union: {stats.districtStats[currentDistrict - 1].blue}</div>
              <div><PartyIcon party="red" /> Heartland Alliance: {stats.districtStats[currentDistrict - 1].red}</div>
              {isThreeParty && <div style={{ color: 'var(--green-party)' }}><PartyIcon party="green" /> Farmers Coalition: {stats.districtStats[currentDistrict - 1].green}</div>}
            </div>
          )}
        </div>
      )}

      <hr className="stat-divider" />

      <div className="stat-block">
        <div className="stat-label"><PartyIcon party={playerParty} /> Your Seats</div>
        {isThreeParty ? (
          <div className="stat-value ticker-number" style={{ color: ourColor }}>{stats.ourSeats}% ({stats.ourSeatCount}/{numDistricts})</div>
        ) : (
          <div className="stat-value ticker-number" style={{ color: ourColor }}>
            {round1((stats.ourSafe / numDistricts) * 100)}% ({stats.ourSafe}/{numDistricts})
            {stats.tossups > 0 && <span className="tossup-chip">+{stats.tossups} tossup</span>}
          </div>
        )}
        <SeatBar
          seats={isThreeParty ? stats.seats : stats.safeSeats}
          numDistricts={numDistricts}
          isThreeParty={isThreeParty}
          tossup={isThreeParty ? 0 : stats.tossups}
          target={stats.targetSeats}
        />
        <div className="target-label">
          Target: {stats.targetSeats}/{numDistricts} seats{' '}
          <span className="target-hint">
            {stats.targetFromNeutral
              ? `(a party-blind map wins ${stats.fairSeats} — beat it by one)`
              : `(+1 vs. your ${stats.ourPopPercent}% vote share)`}
          </span>
        </div>
        {!isThreeParty && stats.greyShare > 0 && (
          <div className="target-label">
            <Icon name="undecided" size={12} /> {stats.greyShare}% undecided <MetricInfo metric="undecided" />
          </div>
        )}
        {isThreeParty && (
          <div className="target-label">
            Pop: <PartyIcon party="blue" /> {stats.pops?.blue}% &nbsp;<PartyIcon party="red" /> {stats.pops?.red}% &nbsp;<PartyIcon party="green" /> {stats.pops?.green}%
          </div>
        )}
      </div>

      <hr className="stat-divider" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>District Details</h4>
        <button
          className={`btn-unassigned${showUnassignedCounties ? ' btn-unassigned--active' : ''}`}
          onClick={onToggleUnassigned}
        >
          Unassigned
        </button>
      </div>
      <div className="districts-list">
        {stats.districtStats.map(district => {
          const hasContent = district.total > 0;
          const withinBounds = hasContent && district.total >= minPopulation && district.total <= maxPopulation;
          const overBounds = district.total > maxPopulation;
          const underBounds = hasContent && district.total < minPopulation;
          const status = withinBounds ? 'ok' : overBounds ? 'over' : underBounds ? 'under' : 'empty';
          const classifiedRow = stats.classified?.[district.id - 1];
          const isTossup = classifiedRow?.status === 'tossup' && hasContent;

          return (
            <div
              key={district.id}
              className="district-stat-row"
              data-status={status}
              onClick={() => onDistrictSelect(district.id)}
            >
              <div className="district-name">
                D{district.id}
                {withinBounds && <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: 'var(--success-color)' }}>✓</span>}
                {overBounds && <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: 'var(--error-color)' }}>!</span>}
                {underBounds && <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: 'var(--warning-color)' }}>…</span>}
                {isTossup && <span title="Tossup — undecided voters here could flip this district" style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: 'var(--grey-party)', fontWeight: 700 }}>?</span>}
              </div>
              <div className="district-votes">
                <span className="blue-votes"><PartyIcon party="blue" /> {district.blue}</span>
                <span className="red-votes"><PartyIcon party="red" /> {district.red}</span>
                {isThreeParty && <span style={{ color: 'var(--green-party)' }}><PartyIcon party="green" /> {district.green}</span>}
                {classifiedRow?.greyPop > 0 && <span style={{ color: 'var(--grey-party)' }}><Icon name="undecided" size={11} /> {classifiedRow.greyPop}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {!isThreeParty && (
        <div className="stat-block">
          <div className="stat-label">Efficiency Gap <MetricInfo metric="efficiencyGap" /></div>
          <div className="stat-value ticker-number">{stats.gap}%</div>
          <div className="gap-breakdown">
            {stats.gapFavors !== 'none' && (
              <div>favoring {PARTY[stats.gapFavors]?.label} · ≈{stats.gapSeatsAbs} seats</div>
            )}
            {stats.fairGap != null && (
              <div>party-blind map here: {stats.fairGap}%</div>
            )}
            <div>Blue wasted: {stats.blueWasted}</div>
            <div>Red wasted: {stats.redWasted}</div>
          </div>
        </div>
      )}

      <hr className="stat-divider" />

      <h4>Metrics</h4>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Compactness <MetricInfo metric="compactness" /></div>
          <div className="metric-value">{stats.compactness == null ? '—' : `${stats.compactness}%`}</div>
          <div className="metric-desc">100% = a perfect square (chunky beats snaky)</div>
        </div>

        {!isThreeParty && (
          <div className="metric-card">
            <div className="metric-label">Competitiveness <MetricInfo metric="competitiveness" /></div>
            <div className="metric-value">{stats.competitiveness}%</div>
            <div className="metric-desc">{stats.competitiveCount}/{stats.totalDistricts} competitive</div>
          </div>
        )}

        {!isThreeParty && (
          <div className="metric-card">
            <div className="metric-label">Disproportionality <MetricInfo metric="asymmetry" /></div>
            <div className="metric-value">{stats.asymmetry}%</div>
            <div className="metric-desc">|seats% − votes%| — a seat bonus is normal</div>
          </div>
        )}

        {!isThreeParty && (
          <div className="metric-card">
            <div className="metric-label">Mean–Median <MetricInfo metric="meanMedian" /></div>
            <div className="metric-value">
              {stats.meanMedian == null ? '—' : `${stats.meanMedian > 0 ? '+' : ''}${stats.meanMedian}pp`}
            </div>
            <div className="metric-desc">middle vs. average district — + leans your way</div>
          </div>
        )}

        {!isThreeParty && stats.litigation && (
          <div className="metric-card">
            <div className="metric-label">Litigation Risk <MetricInfo metric="litigationRisk" /></div>
            <div className="metric-value" data-risk={stats.litigation.band}>{stats.litigation.score}</div>
            <div className="metric-desc">
              {stats.litigation.band}{stats.litigation.drivers.length ? ` · ${stats.litigation.drivers[0]}` : ''}
            </div>
          </div>
        )}

        {!isThreeParty && stats.community && (
          <div className="metric-card">
            <div className="metric-label">Community <MetricInfo metric="communityRepresentation" /></div>
            <div className="metric-value" data-community={stats.community.status}>{stats.community.opportunityDistricts}/{stats.community.fairShare}</div>
            <div className="metric-desc">opportunity seats · {stats.community.status}</div>
          </div>
        )}
      </div>

      {!isThreeParty && (
        <div className="asymmetry-detail">
          <div><PartyIcon party={playerParty} /> {ourLabel} votes: {playerParty === 'blue' ? stats.asymmetryBlueVote : Math.round((100 - stats.asymmetryBlueVote) * 100) / 100}%</div>
          <div><PartyIcon party={playerParty} /> {ourLabel} seats: {playerParty === 'blue' ? stats.asymmetryBlueSeat : Math.round((100 - stats.asymmetryBlueSeat) * 100) / 100}%</div>
        </div>
      )}

      {violations && (
        <>
          <hr className="stat-divider" />
          <h4>Legal Requirements</h4>
          <div className="constraint-status-list">
            <div className="constraint-status-row" data-pass={violations.contiguity.pass}>
              <span className="constraint-status-icon">{violations.contiguity.pass ? '✓' : '✗'}</span>
              <span>Contiguity</span>
            </div>
            {violations.populationDeviation && (
              <div className="constraint-status-row" data-pass={violations.populationDeviation.pass}>
                <span className="constraint-status-icon">{violations.populationDeviation.pass ? '✓' : '✗'}</span>
                <span>
                  Population Deviation (±{violations.populationDeviation.thresholdPct}%, {violations.populationDeviation.mode})
                  {!violations.populationDeviation.pass && ` — worst: ${violations.populationDeviation.worstDeviationPct}%`}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
