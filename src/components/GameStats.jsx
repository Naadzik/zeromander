import { useMemo } from 'react'
import { getDistrictPopulation } from '../utils/gameLogic'
import { computeCoreStats, round1, targetSeatCount } from '../utils/computeGameStats'
import { checkConstraintViolations } from '../utils/legalConstraints'
import { PARTY } from '../utils/partyConfig'
import PartyIcon from './ui/PartyIcon'
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
  constraints
}) {
  const ourLabel = PARTY[playerParty].label;
  const ourColor = PARTY[playerParty].cssColor;
  const currentDistrictPop = useMemo(
    () => getDistrictPopulation(populationMap, districts, currentDistrict),
    [populationMap, districts, currentDistrict]
  );

  const stats = useMemo(() => {
    const core = computeCoreStats(populationMap, districts, numDistricts, playerParty, isThreeParty);
    const base = {
      seats: core.seats,
      ourSeats: round1(core.ourSeatsPct),
      ourSeatCount: core.ourSeatCount,
      ourPopPercent: round1(core.ourPopPercent),
      assigned: core.assigned,
      mapTotalPop: core.mapTotalPop,
      compactness: Math.round(core.compactness.average * 100),
      targetSeats: targetSeatCount(core.ourPopPercent, numDistricts),
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

    return {
      ...base,
      blueSeats: round1((core.seats.blue / numDistricts) * 100),
      popPercent: round1(core.shares.blue),
      gap: round1(core.gap.gap),
      blueWasted: core.gap.blueWasted,
      redWasted: core.gap.redWasted,
      competitiveness: round1(core.competitiveness.percentage),
      competitiveCount: core.competitiveness.competitive,
      totalDistricts: core.competitiveness.total,
      asymmetry: round1(core.asymmetry.asymmetry),
      asymmetryBlueVote: core.asymmetry.blueVotePercent,
      asymmetryBlueSeat: core.asymmetry.blueSeatPercent,
      districtStats: core.districtStats
    };
  }, [populationMap, districts, numDistricts, playerParty, isThreeParty]);

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
        <div className="stat-value ticker-number" style={{ color: ourColor }}>{stats.ourSeats}% ({stats.ourSeatCount}/{numDistricts})</div>
        <SeatBar seats={stats.seats} numDistricts={numDistricts} isThreeParty={isThreeParty} />
        {isThreeParty ? (
          <div className="target-label">
            Pop: <PartyIcon party="blue" /> {stats.pops?.blue}% &nbsp;<PartyIcon party="red" /> {stats.pops?.red}% &nbsp;<PartyIcon party="green" /> {stats.pops?.green}%
          </div>
        ) : (
          <div className="target-label">
            Target: {stats.targetSeats}/{numDistricts} seats <span className="target-hint">(+1 vs. your {stats.ourPopPercent}% vote share)</span>
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

          return (
            <div
              key={district.id}
              className="district-stat-row"
              data-status={status}
              onClick={() => onDistrictSelect(district.id)}
            >
              <div className="district-name">
                D{district.id}
                {withinBounds && <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: '#22C55E' }}>✓</span>}
                {overBounds && <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: '#EF4444' }}>!</span>}
                {underBounds && <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem', color: '#F59E0B' }}>…</span>}
              </div>
              <div className="district-votes">
                <span className="blue-votes"><PartyIcon party="blue" /> {district.blue}</span>
                <span className="red-votes"><PartyIcon party="red" /> {district.red}</span>
                {isThreeParty && <span style={{ color: 'var(--green-party)' }}><PartyIcon party="green" /> {district.green}</span>}
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
          <div className="metric-value">{stats.compactness}%</div>
          <div className="metric-desc">Polsby-Popper (higher = rounder)</div>
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
            <div className="metric-label">Partisan Asymmetry <MetricInfo metric="asymmetry" /></div>
            <div className="metric-value">{stats.asymmetry}%</div>
            <div className="metric-desc">|seats% - votes%|</div>
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
