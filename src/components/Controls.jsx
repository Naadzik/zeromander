import '../styles/Controls.css'

export default function Controls({
  difficulty,
  onDifficultyChange,
  numCounties,
  onCountiesChange,
  numCities,
  onNumCitiesChange,
  numTowns,
  onNumTownsChange,
  bluePercentage,
  onBluePercentageChange,
  greenPercentage,
  onGreenPercentageChange,
  numDistricts,
  onDistrictsChange,
  maxDistricts,
  currentDistrict,
  onDistrictSelect,
  onResetGame,
  constraints,
  onPopDeviationEnabledChange,
  onPopDeviationModeChange,
  onPopDeviationThresholdChange,
  electionUncertainty,
  onElectionUncertaintyChange,
  durabilityReport,
  includeCommunity,
  onIncludeCommunityChange,
  onDurabilityReportChange,
  decadeMode,
  onDecadeModeChange,
  greyPercentage,
  onGreyPercentageChange
}) {
  const DIFFICULTY_SETTINGS = {
    small: { gridSize: 50, numDistricts: 8, targetSeats: 50, minCounties: 100, maxCounties: 300 },
    medium: { gridSize: 80, numDistricts: 10, targetSeats: 50, minCounties: 150, maxCounties: 800 },
    large: { gridSize: 100, numDistricts: 12, targetSeats: 50, minCounties: 200, maxCounties: 1000 },
    'three-party': { gridSize: 80, numDistricts: 10, targetSeats: 0, minCounties: 150, maxCounties: 800 }
  };
  const isThreeParty = difficulty === 'three-party';

  const minCounties = DIFFICULTY_SETTINGS[difficulty]?.minCounties || 50;
  const maxCounties = DIFFICULTY_SETTINGS[difficulty]?.maxCounties || 250;

  return (
    <div className="controls-panel">
      <div className="control-section">
        <h3>Game Setup</h3>
        <div className="control-group">
          <label>Difficulty</label>
          <div className="difficulty-buttons">
            {['small', 'medium', 'large', 'three-party'].map(level => (
              <button
                key={level}
                className={`difficulty-btn ${difficulty === level ? 'active' : ''}`}
                onClick={() => onDifficultyChange(level)}
              >
                {level === 'three-party' ? '3rd Party' : level.charAt(0).toUpperCase() + level.slice(1)}
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
          <label>Cities: {numCities === 0 ? 'none' : numCities}</label>
          <input
            type="range"
            min="0"
            max="6"
            value={Math.min(numCities, 6)}
            onChange={(e) => onNumCitiesChange(parseInt(e.target.value))}
            className="slider"
          />
        </div>

        {isThreeParty && (
          <div className="control-group">
            <label>Towns: {numTowns === 0 ? 'none' : numTowns}</label>
            <input
              type="range"
              min="0"
              max="8"
              value={numTowns}
              onChange={(e) => onNumTownsChange(parseInt(e.target.value))}
              className="slider"
              style={{ accentColor: 'var(--green-party)' }}
            />
          </div>
        )}

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

        {isThreeParty && (
          <div className="control-group">
            <label>Farmers Coalition Population: {greenPercentage}%</label>
            <input
              type="range"
              min="5"
              max={Math.min(40, 95 - bluePercentage)}
              value={greenPercentage}
              onChange={(e) => onGreenPercentageChange(parseInt(e.target.value))}
              className="slider"
              style={{ accentColor: 'var(--green-party)' }}
            />
          </div>
        )}

        <button className="btn-primary" onClick={onResetGame}>
          Generate Map
        </button>
      </div>

      {constraints && (
        <div className="control-section">
          <h3>Legal Requirements</h3>

          <div className="control-group constraint-row">
            <label className="constraint-label-static">
              <span className="constraint-status constraint-status--pass">✓</span> Contiguity
            </label>
            <span className="constraint-hint">Always enforced — a district can never be disconnected.</span>
          </div>

          <div className="control-group constraint-row">
            <label className="constraint-toggle">
              <input
                type="checkbox"
                checked={constraints.populationDeviation.enabled}
                onChange={(e) => onPopDeviationEnabledChange(e.target.checked)}
              />
              Strict Population Deviation
            </label>
          </div>

          {constraints.populationDeviation.enabled && (
            <>
              <div className="control-group">
                <label>Threshold: ±{constraints.populationDeviation.thresholdPct}% (base is ±10%)</label>
                <input
                  type="range"
                  min="1"
                  max="9"
                  value={constraints.populationDeviation.thresholdPct}
                  onChange={(e) => onPopDeviationThresholdChange(parseInt(e.target.value))}
                  className="slider"
                />
              </div>

              <div className="control-group">
                <label>Enforcement</label>
                <div className="difficulty-buttons">
                  <button
                    className={`difficulty-btn ${constraints.populationDeviation.mode === 'hard' ? 'active' : ''}`}
                    onClick={() => onPopDeviationModeChange('hard')}
                    title="Blocks moves that would exceed the limit in real time."
                  >
                    Hard
                  </button>
                  <button
                    className={`difficulty-btn ${constraints.populationDeviation.mode === 'soft' ? 'active' : ''}`}
                    onClick={() => onPopDeviationModeChange('soft')}
                    title="Map can complete, but a violating map is struck down by court at the end."
                  >
                    Soft
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!isThreeParty && (
        <div className="control-section">
          <h3>Election Night</h3>
          <div className="control-group">
            <label>Undecided Voters: {greyPercentage}%</label>
            <input
              type="range"
              min="0"
              max="20"
              value={greyPercentage}
              onChange={(e) => onGreyPercentageChange(parseInt(e.target.value))}
              className="slider"
            />
            <span className="constraint-hint">
              Grey areas on the map hold voters who only decide on election night — whole neighborhoods break together. Recommended: 8%.
            </span>
          </div>
          <div className="control-group constraint-row">
            <label className="constraint-toggle">
              <input
                type="checkbox"
                checked={includeCommunity}
                onChange={(e) => onIncludeCommunityChange(e.target.checked)}
              />
              Community of interest
            </label>
            <span className="constraint-hint">
              Adds a protected "community of interest" (~20% of voters, dashed amber). Give them fair representation — cracking or packing them raises Litigation Risk. It's the heart of Voting Rights Act cases.
            </span>
          </div>
          <div className="control-group constraint-row">
            <label className="constraint-toggle">
              <input
                type="checkbox"
                checked={electionUncertainty}
                onChange={(e) => onElectionUncertaintyChange(e.target.checked)}
              />
              National Swing (±4%)
            </label>
            <span className="constraint-hint">
              When you finish, a random nationwide swing of up to ±4% shifts every district at once — the election-night result decides win or lose, not the map as drawn. Local uncertainty comes from the undecided voters above.
            </span>
          </div>
          <div className="control-group constraint-row">
            <label className="constraint-toggle">
              <input
                type="checkbox"
                checked={durabilityReport}
                onChange={(e) => onDurabilityReportChange(e.target.checked)}
              />
              Durability report
            </label>
            <span className="constraint-hint">
              After you lock in, stress-test the map: how big a wave it survives, and how it holds across the ways the undecideds could break. A greedy map wins big but shatters in a wave — a "dummymander".
            </span>
          </div>
          <div className="control-group constraint-row">
            <label className="constraint-toggle">
              <input
                type="checkbox"
                checked={decadeMode}
                onChange={(e) => onDecadeModeChange(e.target.checked)}
              />
              Decade campaign
            </label>
            <span className="constraint-hint">
              Instead of one election night, play your map across five elections of national swings and slow population drift. "Run the decade" replaces the finish, and you can step through each year's seat map to see how it aged.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
