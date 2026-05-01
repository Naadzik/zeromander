import { getAllChallenges } from '../utils/challenges'
import '../styles/Controls.css'

export default function Controls({
  difficulty,
  onDifficultyChange,
  numCounties,
  onCountiesChange,
  bluePercentage,
  onBluePercentageChange,
  numDistricts,
  onDistrictsChange,
  currentDistrict,
  onDistrictSelect,
  selectedChallenge,
  onChallengeSelect,
  onResetGame
}) {
  const challenges = getAllChallenges();

  return (
    <div className="controls-panel">
      <div className="control-section">
        <h3>Game Setup</h3>
        <div className="control-group">
          <label>Difficulty</label>
          <div className="difficulty-buttons">
            {['easy', 'medium', 'hard'].map(level => (
              <button
                key={level}
                className={`difficulty-btn ${difficulty === level ? 'active' : ''}`}
                onClick={() => onDifficultyChange(level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Counties: {numCounties}</label>
          <input
            type="range"
            min="5"
            max="250"
            value={numCounties}
            onChange={(e) => onCountiesChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <div className="control-group">
          <label>Blue Population: {bluePercentage}%</label>
          <input
            type="range"
            min="20"
            max="80"
            value={bluePercentage}
            onChange={(e) => onBluePercentageChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <button className="btn-primary" onClick={onResetGame}>
          Generate Map
        </button>
      </div>

      <div className="control-section">
        <h3>Challenges</h3>
        <div className="challenges-list">
          {challenges.map(challenge => (
            <button
              key={challenge.id}
              className={`challenge-btn ${selectedChallenge === challenge.id ? 'active' : ''}`}
              onClick={() => onChallengeSelect(challenge.id)}
              title={challenge.description}
            >
              <span className="challenge-icon">{challenge.icon}</span>
              <span className="challenge-name">{challenge.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <h3>Districts</h3>
        <div className="control-group">
          <label>Number: {numDistricts}</label>
          <input
            type="range"
            min="2"
            max="12"
            value={numDistricts}
            onChange={(e) => onDistrictsChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <div className="district-buttons">
          {Array.from({ length: numDistricts }).map((_, i) => {
            const districtId = i + 1;
            return (
              <button
                key={districtId}
                className={`district-btn ${currentDistrict === districtId ? 'active' : ''}`}
                onClick={() => onDistrictSelect(districtId)}
              >
                D{districtId}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
