// "THE MAP ROOM" — board settings as a classifieds column. Bespoke markup;
// the same sandbox-config handlers as the dashboard's Controls panel.
export default function PaperMapRoom({ sandbox }) {
  const {
    difficulty, onDifficultyChange,
    numDistricts, onDistrictsChange, maxDistricts,
    numCounties, onCountiesChange,
    numCities, onNumCitiesChange,
    numTowns, onNumTownsChange,
    bluePercentage, onBluePercentageChange,
    greenPercentage, onGreenPercentageChange,
    greyPercentage, onGreyPercentageChange,
    electionUncertainty, onElectionUncertaintyChange,
    durabilityReport, onDurabilityReportChange,
    includeCommunity, onIncludeCommunityChange,
    decadeMode, onDecadeModeChange,
    constraints, onPopDeviationEnabledChange,
    onResetGame,
  } = sandbox;
  const isThreeParty = difficulty === 'three-party';

  const num = (label, value, onChange, min, max) => (
    <label className="paper-classified">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))); }}
      />
    </label>
  );
  const tick = (label, checked, onChange) => (
    <label className="paper-classified paper-classified--tick">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  return (
    <details className="paper-maproom">
      <summary>The Map Room — commission a new board</summary>
      <div className="paper-maproom__body">
        <div className="paper-classified paper-classified--row">
          <span>Board</span>
          <span className="paper-maproom__difficulties">
            {['small', 'medium', 'large', 'three-party'].map(d => (
              <button
                key={d}
                className={`paper-tab${difficulty === d ? ' is-open' : ''}`}
                onClick={() => onDifficultyChange(d)}
              >
                {d === 'three-party' ? '3rd party' : d}
              </button>
            ))}
          </span>
        </div>
        {num('Districts', numDistricts, onDistrictsChange, 2, maxDistricts || 12)}
        {num('Counties', numCounties, onCountiesChange, 50, 1000)}
        {num('Cities', numCities, onNumCitiesChange, 0, 6)}
        {isThreeParty && num('Towns', numTowns, onNumTownsChange, 0, 8)}
        {num('Urban Union share %', bluePercentage, onBluePercentageChange, 20, 80)}
        {isThreeParty && num('Farmers share %', greenPercentage, onGreenPercentageChange, 5, 40)}
        {!isThreeParty && num('Undecided %', greyPercentage, onGreyPercentageChange, 0, 20)}
        {!isThreeParty && (
          <div className="paper-maproom__ticks">
            {tick('Strict population deviation', !!constraints?.populationDeviation?.enabled, onPopDeviationEnabledChange)}
            {tick('National swing (±4%)', electionUncertainty, onElectionUncertaintyChange)}
            {tick('Durability report', durabilityReport, onDurabilityReportChange)}
            {tick('Community of interest', includeCommunity, onIncludeCommunityChange)}
            {tick('Decade campaign (opens the studio edition)', decadeMode, onDecadeModeChange)}
          </div>
        )}
        <button className="paper-desk-btn paper-maproom__commission" onClick={onResetGame}>
          SET IN FRESH TYPE — new board
        </button>
      </div>
    </details>
  );
}
