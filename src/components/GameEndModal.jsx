import { useState } from 'react'
import '../styles/GameEndModal.css'

export default function GameEndModal({ stats, challenge, onTryAgain, onClose }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = stats.won ? '#10B981' : '#EF4444';
  const statusText = stats.won ? '🎉 YOU WON!' : '❌ You Lost';
  const statusMessage = stats.won
    ? 'Congratulations! You achieved your goal!'
    : 'Keep trying! You\'ll get there next time.';

  return (
    <div className="modal-overlay" onClick={expanded ? onClose : undefined}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: expanded ? '90vh' : 'auto' }}>
        <div className="modal-header" style={{ borderBottomColor: statusColor }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h2 style={{ color: statusColor, margin: 0 }}>{statusText}</h2>
              <p style={{ margin: '0.5rem 0 0 0' }}>{statusMessage}</p>
            </div>
            {expanded && (
              <button
                className="close-btn"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6B7280',
                  padding: '0.5rem'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="modal-body" style={{ overflowY: expanded ? 'auto' : 'visible' }}>
          <h3>Final Results</h3>

          <div className="results-grid">
            <div className="result-card">
              <div className="result-label">Urban Union Seats</div>
              <div className="result-value" style={{ color: '#3B82F6' }}>
                {stats.blueWins} / {stats.totalDistricts}
              </div>
              <div className="result-percentage">{stats.blueSeats}%</div>
            </div>

            <div className="result-card">
              <div className="result-label">Heartland Alliance Seats</div>
              <div className="result-value" style={{ color: '#EF4444' }}>
                {stats.redWins} / {stats.totalDistricts}
              </div>
              <div className="result-percentage">{stats.redSeats}%</div>
            </div>
          </div>

          {challenge && (
            <div className="challenge-summary">
              <h4>{challenge.name}</h4>
              <p>{challenge.goalDescription}</p>
              <div className={`challenge-badge ${stats.won ? 'won' : 'lost'}`}>
                {stats.won ? '✓ Challenge Completed' : '✗ Challenge Failed'}
              </div>
            </div>
          )}

          {expanded && stats.allStats && (
            <div className="detailed-stats">
              <h3>Detailed Statistics</h3>

              <div className="stats-section">
                <h4>Population & Representation</h4>
                <div className="stat-line">
                  <span>Urban Union Population:</span>
                  <strong>{stats.allStats.bluePopPercent}%</strong>
                </div>
                <div className="stat-line">
                  <span>Heartland Alliance Population:</span>
                  <strong>{stats.allStats.redPopPercent}%</strong>
                </div>
              </div>

              <div className="stats-section">
                <h4>Efficiency Gap</h4>
                <div className="stat-line">
                  <span>Gap:</span>
                  <strong>{stats.allStats.efficiencyGap}%</strong>
                </div>
                <div className="stat-line">
                  <span>Urban Union Wasted Votes:</span>
                  <strong>{stats.allStats.blueWasted}</strong>
                </div>
                <div className="stat-line">
                  <span>Heartland Alliance Wasted Votes:</span>
                  <strong>{stats.allStats.redWasted}</strong>
                </div>
              </div>

              <div className="stats-section">
                <h4>District Metrics</h4>
                <div className="stat-line">
                  <span>Compactness:</span>
                  <strong>{stats.allStats.compactness}%</strong>
                </div>
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
              </div>

              {stats.allStats.districtBreakdown && (
                <div className="stats-section">
                  <h4>District Breakdown</h4>
                  <div className="districts-breakdown">
                    {stats.allStats.districtBreakdown.map(d => (
                      <div key={d.id} className="district-breakdown-row">
                        <span className="district-num">D{d.id}</span>
                        <span className="district-bar">
                          <span
                            className="bar-blue"
                            style={{ width: `${(d.blue / (d.blue + d.red)) * 100}%` }}
                          >
                            {d.blue > 0 ? d.blue : ''}
                          </span>
                          <span
                            className="bar-red"
                            style={{ width: `${(d.red / (d.blue + d.red)) * 100}%` }}
                          >
                            {d.red > 0 ? d.red : ''}
                          </span>
                        </span>
                        <span className="district-winner">
                          {d.blue > d.red ? '🔵 UU' : '🔴 HA'}
                        </span>
                      </div>
                    ))}
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
          {expanded && (
            <button className="btn-secondary" onClick={onClose}>
              Close & View Game
            </button>
          )}
          <button className="btn-primary" onClick={onTryAgain}>
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
