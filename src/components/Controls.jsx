import { useState } from 'react'
import { getAllChallenges } from '../utils/challenges'
import ChallengeModal from './ChallengeModal'
import '../styles/Controls.css'

export default function Controls({
  difficulty,
  onDifficultyChange,
  numCounties,
  onCountiesChange,
  numCities,
  onNumCitiesChange,
  bluePercentage,
  onBluePercentageChange,
  numDistricts,
  onDistrictsChange,
  maxDistricts,
  currentDistrict,
  onDistrictSelect,
  selectedChallenge,
  onChallengeSelect,
  onResetGame
}) {
  const [selectedChallengeModal, setSelectedChallengeModal] = useState(null);
  const challenges = getAllChallenges();

  const DIFFICULTY_SETTINGS = {
    easy: { gridSize: 25, numDistricts: 4, targetSeats: 55, maxCounties: 100 },
    medium: { gridSize: 35, numDistricts: 6, targetSeats: 52, maxCounties: 200 },
    hard: { gridSize: 50, numDistricts: 8, targetSeats: 50, maxCounties: 300 }
  };

  const maxCounties = DIFFICULTY_SETTINGS[difficulty]?.maxCounties || 250;
  const minCounties = numDistricts * 5;

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
          <label>Districts: {numDistricts}</label>
          <input
            type="range"
            min="2"
            max={maxDistricts || 12}
            value={numDistricts}
            onChange={(e) => onDistrictsChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <div className="control-group">
          <label>Counties: {numCounties} (min: {minCounties}, max: {maxCounties})</label>
          <input
            type="range"
            min={minCounties}
            max={maxCounties}
            value={numCounties}
            onChange={(e) => onCountiesChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <div className="control-group">
          <label>Cities: {numCities}</label>
          <input
            type="range"
            min="1"
            max="6"
            value={numCities}
            onChange={(e) => onNumCitiesChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        <div className="control-group">
          <label>Urban Union Population: {bluePercentage}%</label>
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
              onClick={() => setSelectedChallengeModal(challenge)}
              title={challenge.description}
            >
              <span className="challenge-icon">{challenge.icon}</span>
              <span className="challenge-name">{challenge.name}</span>
            </button>
          ))}
        </div>
      </div>

      <ChallengeModal
        challenge={selectedChallengeModal}
        isOpen={!!selectedChallengeModal}
        onClose={() => setSelectedChallengeModal(null)}
        onSelect={onChallengeSelect}
      />

    </div>
  );
}
