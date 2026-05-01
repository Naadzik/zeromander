import { useMemo } from 'react'
import {
  calculateSeats,
  getSeatPercentage,
  getPopulationPercentage,
  calculateEfficiencyGap,
  allDistrictsAssigned,
  getDistrictPopulation,
  getDistrictStats
} from '../utils/gameLogic'
import {
  calculateCompactness,
  calculateCompetitiveness,
  calculatePartisanAsymmetry
} from '../utils/metrics'
import { getChallengeById, checkChallengeCompletion } from '../utils/challenges'
import '../styles/GameStats.css'

export default function GameStats({
  populationMap,
  districts,
  numDistricts,
  currentDistrict,
  targetSeatPercentage,
  selectedChallenge,
  gameWon,
  onDistrictSelect,
  onToggleUnassigned,
  showUnassignedCounties
}) {
  const stats = useMemo(() => {
    
    const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
    const partyMap = isNewFormat ? populationMap.party : populationMap;
    const gridSize = isNewFormat ? populationMap.party.length : populationMap.length;

    const seats = calculateSeats(populationMap, districts, numDistricts);
    const blueSeats = getSeatPercentage(seats.blue, numDistricts);
    const popPercent = getPopulationPercentage(populationMap);
    const gap = calculateEfficiencyGap(populationMap, districts, numDistricts);
    const assigned = allDistrictsAssigned(districts, numDistricts);
    const currentDistrictPop = getDistrictPopulation(populationMap, districts, currentDistrict);
    const compactness = calculateCompactness(districts, numDistricts, gridSize);
    const competitiveness = calculateCompetitiveness(populationMap, districts, numDistricts);
    const asymmetry = calculatePartisanAsymmetry(populationMap, districts, numDistricts);
    const districtStats = getDistrictStats(populationMap, districts, numDistricts);

    
    const completedDistricts = new Set();
    let allAssigned = true;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (districts[y][x] === 0) {
          allAssigned = false;
          break;
        }
      }
      if (!allAssigned) break;
    }

    
    if (allAssigned) {
      for (let i = 1; i <= numDistricts; i++) {
        completedDistricts.add(i);
      }
    }

    return {
      seats,
      blueSeats: Math.round(blueSeats * 10) / 10,
      popPercent: Math.round(popPercent * 10) / 10,
      gap: Math.round(gap.gap * 10) / 10,
      blueWasted: gap.blueWasted,
      redWasted: gap.redWasted,
      assigned,
      currentDistrictPop,
      compactness: Math.round(compactness.average * 100),
      competitiveness: Math.round(competitiveness.percentage * 10) / 10,
      competitiveCount: competitiveness.competitive,
      totalDistricts: competitiveness.total,
      asymmetry: Math.round(asymmetry.asymmetry * 10) / 10,
      asymmetryBlueVote: asymmetry.blueVotePercent,
      asymmetryBlueSeat: asymmetry.blueSeatPercent,
      districtStats,
      completedDistricts
    };
  }, [populationMap, districts, numDistricts, currentDistrict]);

  
  const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
  const densityMap = isNewFormat ? populationMap.density : null;
  const gridSize = isNewFormat ? populationMap.party.length : populationMap.length;

  
  let totalPopulation = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      totalPopulation += densityMap ? densityMap[y][x] : 1;
    }
  }

  const targetPopulation = totalPopulation / numDistricts;
  const minPopulation = Math.ceil(targetPopulation * 0.9);
  const maxPopulation = Math.ceil(targetPopulation * 1.1);

  const challenge = selectedChallenge ? getChallengeById(selectedChallenge) : null;
  const challengeComplete = challenge ? checkChallengeCompletion(challenge, {
    blueSeats: stats.blueSeats,
    gap: stats.gap,
    compactness: stats.compactness / 100,
    competitiveness: stats.competitiveness
  }) : false;

  const progress = Math.min(100, (stats.blueSeats / targetSeatPercentage) * 100);

  return (
    <div className="stats-panel">
      <h3>Game Stats</h3>

      <div className="stat-block">
        <div className="stat-label">Blue Population</div>
        <div className="stat-value">{stats.popPercent}%</div>
      </div>

      <div className="stat-block">
        <div className="stat-label">Blue Seats</div>
        <div className="stat-value">{stats.blueSeats}% ({stats.seats.blue}/{numDistricts})</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="target-label">Target: {targetSeatPercentage}%</div>
      </div>

      <div className="stat-block">
        <div className="stat-label">Efficiency Gap</div>
        <div className="stat-value">{stats.gap}%</div>
        <div className="gap-breakdown">
          <div>Blue wasted: {stats.blueWasted}</div>
          <div>Red wasted: {stats.redWasted}</div>
        </div>
      </div>

      <div className="stat-block">
        <div className="stat-label">Status</div>
        <div className="stat-value">
          {stats.assigned ? '✓ All districts assigned' : '⌛ Assigning districts...'}
        </div>
      </div>

      {currentDistrict > 0 && (
        <div className="stat-block">
          <div className="stat-label">District {currentDistrict} Population</div>
          <div className="stat-value">{stats.currentDistrictPop} votes</div>
          <div className="capacity-bar">
            <div
              className="capacity-fill"
              style={{
                width: `${(stats.currentDistrictPop / maxPopulation) * 100}%`,
                backgroundColor: stats.currentDistrictPop < minPopulation ? '#FF6B6B' :
                  stats.currentDistrictPop > maxPopulation ? '#FF6B6B' : '#4ECDC4'
              }}
            ></div>
          </div>
          <div className="capacity-range">
            Range: {minPopulation}-{maxPopulation} votes (±10%)
          </div>
        </div>
      )}

      <hr className="stat-divider" />

      <h4>Metrics</h4>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Compactness</div>
          <div className="metric-value">{stats.compactness}%</div>
          <div className="metric-desc">Polsby-Popper (higher = rounder)</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Competitiveness</div>
          <div className="metric-value">{stats.competitiveness}%</div>
          <div className="metric-desc">{stats.competitiveCount}/{stats.totalDistricts} competitive</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Partisan Asymmetry</div>
          <div className="metric-value">{stats.asymmetry}%</div>
          <div className="metric-desc">|seats% - votes%|</div>
        </div>
      </div>

      <div className="asymmetry-detail">
        <div>Blue votes: {stats.asymmetryBlueVote}%</div>
        <div>Blue seats: {stats.asymmetryBlueSeat}%</div>
      </div>

      {challenge && (
        <div className={`challenge-display ${challengeComplete ? 'complete' : ''}`}>
          <div className="challenge-icon">{challenge.icon}</div>
          <div className="challenge-content">
            <div className="challenge-title">{challenge.name}</div>
            <div className="challenge-goal">{challenge.goalDescription}</div>
            {challengeComplete && (
              <div className="challenge-badge">✓ Challenge Complete!</div>
            )}
          </div>
        </div>
      )}

      <hr className="stat-divider" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>District Details</h4>
        <button
          className="btn-unassigned"
          onClick={onToggleUnassigned}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.75rem',
            fontWeight: '600',
            backgroundColor: showUnassignedCounties ? '#667eea' : '#E5E7EB',
            color: showUnassignedCounties ? 'white' : '#6B7280',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          Unassigned
        </button>
      </div>
      <div className="districts-list">
        {stats.districtStats.map(district => {
          const isComplete = stats.completedDistricts.has(district.id);
          const partyWon = district.blue > district.red ? 'blue' : 'red';

          let bgColor = '#F9FAFB';
          let borderColor = '#667eea';
          let borderWidth = '3px';

          if (isComplete) {
            
            bgColor = '#FEF3C7';
            borderColor = '#F59E0B';
            borderWidth = '4px';
          }

          return (
            <div
              key={district.id}
              className="district-stat-row"
              onClick={() => onDistrictSelect(district.id)}
              style={{
                backgroundColor: bgColor,
                borderLeftColor: borderColor,
                borderLeftWidth: borderWidth,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: isComplete ? '700' : '600'
              }}
            >
              <div className="district-name">
                D{district.id}
                {isComplete && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: partyWon === 'blue' ? '#3B82F6' : '#EF4444' }}>✓</span>}
              </div>
              <div className="district-votes">
                <span className="blue-votes">🔵 {district.blue}</span>
                <span className="red-votes">🔴 {district.red}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
