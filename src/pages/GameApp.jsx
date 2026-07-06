import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import GameCanvasCounty from '../components/GameCanvasCounty'
import Controls from '../components/Controls'
import GameStats from '../components/GameStats'
import GameEndModal from '../components/GameEndModal'
import GameHeader from '../components/GameHeader'
import GameToolbar from '../components/GameToolbar'
import GhostMapComparison from '../components/GhostMapComparison'
import DailyObjectiveBanner from '../components/DailyObjectiveBanner'
import Tutorial, { STEPS_3PARTY } from '../components/Tutorial'
import '../styles/Tutorial.css'
import { exportMapPng } from '../utils/exportMap'
import { computeCoreStats } from '../utils/computeGameStats'
import { useGameConfig } from '../hooks/useGameConfig'
import { useMapState } from '../hooks/useMapState'
import { usePlayerParty } from '../hooks/usePlayerParty'
import { useTutorial } from '../hooks/useTutorial'
import { useGameCompletion } from '../hooks/useGameCompletion'
import { useLegalConstraints } from '../hooks/useLegalConstraints'
import { useFairMap } from '../hooks/useFairMap'
import { getDailyChallenge, buildDailyResult } from '../utils/dailyChallenge'
import { getResultFor, recordDailyResult } from '../utils/dailyHistory'
import '../styles/App.css'

// Collapsed/expanded panel preference, remembered across sessions.
function usePersistentToggle(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? stored === '1' : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  function toggle() {
    setValue(v => {
      try { localStorage.setItem(key, v ? '0' : '1'); } catch { /* private mode */ }
      return !v;
    });
  }
  return [value, toggle];
}

// Side panel that folds into a slim rail so the map gets the full stage.
// Vertical rail beside the map on desktop; horizontal bar above/below it
// when the layout stacks (≤1100px).
function CollapsiblePanel({ title, side, collapsed, onToggle, children }) {
  if (collapsed) {
    return (
      <button className="panel-rail" onClick={onToggle} title={`Show ${title}`} aria-expanded="false">
        <span className="panel-rail__chevron">{side === 'left' ? '»' : '«'}</span>
        <span className="panel-rail__label">{title}</span>
      </button>
    );
  }
  return (
    <div className="collapsible-panel">
      <button className="panel-collapse-btn" onClick={onToggle} title={`Hide ${title}`} aria-expanded="true">
        {side === 'left' ? '«' : '»'}
      </button>
      {children}
    </div>
  );
}

export default function GameApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // "The Heist" daily mode: same board, same assigned party, same neutral
  // baseline for everyone; one locked submission per UTC day.
  const isDaily = new URLSearchParams(location.search).has('daily');
  const challenge = useMemo(() => (isDaily ? getDailyChallenge() : null), [isDaily]);
  // Derive the lookup from the same challenge object — two separate
  // getDailyChallenge() calls could straddle UTC midnight and disagree.
  const [dailyResult, setDailyResult] = useState(() => (challenge ? getResultFor(challenge.date) : null));

  const sandboxConfig = useGameConfig();
  // Daily overrides are plain values layered over the sandbox hook — Controls
  // is hidden in daily mode, so its orphaned setters are unreachable.
  const config = isDaily ? { ...sandboxConfig, ...challenge.config, isThreeParty: false } : sandboxConfig;

  const legalConstraints = useLegalConstraints();
  const map = useMapState(config, legalConstraints.constraints, {
    seed: challenge?.seed,
    locked: isDaily && !!dailyResult
  });
  const { playerParty, setPlayerParty, togglePlayerParty } = usePlayerParty();
  // The daily assigns your party — that day you gerrymander for whoever you're told.
  const effectiveParty = isDaily ? challenge.party : playerParty;
  const tutorial = useTutorial();
  const [electionUncertainty, setElectionUncertainty] = useState(false);
  const completion = useGameCompletion({
    populationMap: map.populationMap,
    districts: map.districts,
    numDistricts: config.numDistricts,
    playerParty: effectiveParty,
    difficulty: config.difficulty,
    targetSeatPercentage: config.targetSeatPercentage,
    constraints: legalConstraints.constraints,
    electionUncertainty: isDaily ? false : electionUncertainty,
    manual: isDaily
  });
  const boardLocked = isDaily && !!dailyResult;

  const [highlightedDistrict, setHighlightedDistrict] = useState(null);
  const [showUnassignedCounties, setShowUnassignedCounties] = useState(false);
  const [mapView, setMapView] = useState('districts');

  // After the election-night reveal the board shows the RESOLVED map (grey
  // cells now colored); the underlying live map is untouched, so Try Again
  // returns to a grey board. Completion math stays on the original map.
  const effectiveMap = completion.revealedMap ?? map.populationMap;

  // Panels start collapsed on small screens (the map is the point); the
  // user's explicit choice is remembered either way.
  const smallScreen = typeof window !== 'undefined' && window.innerWidth <= 1100;
  const [setupCollapsed, toggleSetup] = usePersistentToggle('zeromander.ui.setupCollapsed', smallScreen);
  const [statsCollapsed, toggleStats] = usePersistentToggle('zeromander.ui.statsCollapsed', smallScreen);

  useEffect(() => {
    if (!map.lastRejection) return;
    const timer = setTimeout(() => map.clearRejection(), 2500);
    return () => clearTimeout(timer);
  }, [map.lastRejection]);

  const fairMap = useFairMap({
    // Revealed electorate once election night has happened — the neutral
    // baseline must face the same voters as the player's final result.
    populationMap: effectiveMap,
    counties: map.counties,
    numDistricts: config.numDistricts,
    gridSize: config.gridSize,
    playerParty: effectiveParty,
    isThreeParty: config.isThreeParty,
    // Daily computes the neutral baseline eagerly (it's deterministic and the
    // lock button needs it); sandbox still waits for completion.
    enabled: isDaily ? map.counties.length > 0 : completion.gameComplete,
    seed: challenge?.fairSeed
  });

  // Re-entering a locked day: reinstall the submitted districts onto the
  // (identical, deterministic) board instead of offering a fresh one.
  useEffect(() => {
    if (!boardLocked || !dailyResult.districts || !map.counties.length) return;
    map.restoreDistricts(dailyResult.districts);
  }, [boardLocked, map.counties]);

  const playerCoreStats = useMemo(() => {
    if (!completion.gameComplete) return null;
    return computeCoreStats(effectiveMap, map.districts, config.numDistricts, effectiveParty, config.isThreeParty);
  }, [completion.gameComplete, effectiveMap, map.districts, config.numDistricts, effectiveParty, config.isThreeParty]);

  const hasMap = map.populationMap.party || map.populationMap.length > 0;

  function handleDifficultyChange(newDifficulty) {
    config.applyDifficulty(newDifficulty);
    if (newDifficulty !== 'three-party' && playerParty === 'green') {
      setPlayerParty('blue');
    }
    if (newDifficulty === 'three-party') {
      tutorial.show3PartyTutorialIfNew();
    }
  }

  function handleExportMap() {
    const gameCanvas = document.querySelector('canvas');
    if (!gameCanvas) return;
    exportMapPng(gameCanvas, {
      populationMap: effectiveMap,
      districts: map.districts,
      numDistricts: config.numDistricts,
      playerParty: effectiveParty,
      isThreeParty: config.isThreeParty,
      mapView,
      difficulty: config.difficulty
    });
  }

  function handleTryAgain() {
    completion.resetCompletion();
    setHighlightedDistrict(null);
    setShowUnassignedCounties(false);
    map.generateNewGame();
  }

  // The one-shot submission. Freezes stats, computes seats stolen against the
  // deterministic neutral map, and persists the day's result.
  function handleLockIn() {
    if (!completion.isMapValid || !fairMap.fairStats) return;
    const stats = completion.finalize();
    if (!stats) return;
    const result = buildDailyResult({
      date: challenge.date,
      dayNumber: challenge.dayNumber,
      party: challenge.party,
      playerCore: { ourSeatCount: stats.ourWins, ourPopPercent: stats.allStats.ourPopPercent },
      fairCore: fairMap.fairStats,
      districtBreakdown: stats.allStats.districtBreakdown,
      numDistricts: config.numDistricts
    });
    // `districts` is a local-only extra so the locked map can be redrawn on
    // re-entry; buildDailyResult itself stays the clean backend-ready record.
    setDailyResult(recordDailyResult({ ...result, districts: map.districts }));
  }

  const noop = () => {};
  const stolen = dailyResult?.seatsStolen;

  // Dev-only test seam (stripped from production builds): lets automated
  // checks install a districts grid without simulating 475 county clicks.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.__zmTest = { restoreDistricts: map.restoreDistricts };
  }

  return (
    <div className="app">
      {tutorial.showTutorial && <Tutorial onClose={tutorial.dismissTutorial} />}
      {tutorial.show3PartyTutorial && <Tutorial steps={STEPS_3PARTY} onClose={tutorial.dismiss3PartyTutorial} />}
      {completion.showModal && completion.gameStats && (
        <GameEndModal
          stats={completion.gameStats}
          difficulty={config.difficulty}
          fairStats={fairMap.fairStats}
          daily={isDaily ? { dayNumber: challenge.dayNumber, party: challenge.party, result: dailyResult } : null}
          onTryAgain={isDaily ? undefined : handleTryAgain}
          onClose={completion.dismissModal}
        />
      )}

      <GameHeader onBack={() => navigate('/')} onHelp={tutorial.openTutorial} />

      <div className="app-container">
        {!isDaily && (
          <CollapsiblePanel title="Game Setup" side="left" collapsed={setupCollapsed} onToggle={toggleSetup}>
          <Controls
            difficulty={config.difficulty}
            onDifficultyChange={handleDifficultyChange}
            numCounties={config.numCounties}
            onCountiesChange={config.setNumCounties}
            numCities={config.numCities}
            onNumCitiesChange={config.setNumCities}
            bluePercentage={config.bluePercentage}
            onBluePercentageChange={config.handleBluePercentageChange}
            greenPercentage={config.greenPercentage}
            onGreenPercentageChange={config.setGreenPercentage}
            numTowns={config.numTowns}
            onNumTownsChange={config.setNumTowns}
            numDistricts={config.numDistricts}
            onDistrictsChange={config.setNumDistricts}
            maxDistricts={config.maxDistricts}
            currentDistrict={map.currentDistrict}
            onDistrictSelect={map.setCurrentDistrict}
            onResetGame={map.generateNewGame}
            constraints={legalConstraints.constraints}
            onPopDeviationEnabledChange={legalConstraints.setPopDeviationEnabled}
            onPopDeviationModeChange={legalConstraints.setPopDeviationMode}
            onPopDeviationThresholdChange={legalConstraints.setPopDeviationThreshold}
            electionUncertainty={electionUncertainty}
            onElectionUncertaintyChange={setElectionUncertainty}
            greyPercentage={config.greyPercentage}
            onGreyPercentageChange={config.setGreyPercentage}
          />
          </CollapsiblePanel>
        )}

        <div className="game-main">
          {map.lastRejection && (
            <div className="toast-transient">{map.lastRejection.message}</div>
          )}
          {isDaily && (
            <DailyObjectiveBanner
              dayNumber={challenge.dayNumber}
              party={challenge.party}
              popPercent={challenge.party === 'blue' ? challenge.config.bluePercentage : 100 - challenge.config.bluePercentage}
            />
          )}
          {isDaily && !boardLocked && (
            <div className="daily-lock-bar">
              <button
                className="btn-primary"
                disabled={!completion.isMapValid || !fairMap.fairStats}
                onClick={handleLockIn}
              >
                {completion.isMapValid ? '🔒 Lock in heist' : 'Assign every district to lock in'}
              </button>
            </div>
          )}
          {boardLocked && !completion.showModal && (
            <div className="daily-lock-bar daily-lock-bar--locked">
              <span>
                Daily #{dailyResult.dayNumber} locked — {stolen > 0 ? `stole +${stolen}` : stolen === 0 ? 'stole +0' : `${stolen}`} seats vs. the neutral map
              </span>
              <button className="btn-secondary" onClick={() => completion.finalize()}>
                View result
              </button>
            </div>
          )}
          <GameToolbar
            numDistricts={config.numDistricts}
            currentDistrict={map.currentDistrict}
            onDistrictSelect={map.setCurrentDistrict}
            isThreeParty={config.isThreeParty}
            playerParty={effectiveParty}
            onPartySelect={isDaily ? noop : setPlayerParty}
            onPartyToggle={isDaily ? noop : togglePlayerParty}
            mapView={mapView}
            onMapViewChange={setMapView}
            canUndo={!boardLocked && map.undoRedo.canUndo}
            canRedo={!boardLocked && map.undoRedo.canRedo}
            onUndo={boardLocked ? noop : map.undoRedo.undo}
            onRedo={boardLocked ? noop : map.undoRedo.redo}
            onExport={handleExportMap}
          />
          {hasMap && (
            <GameCanvasCounty
              populationMap={effectiveMap}
              counties={map.counties}
              districts={map.districts}
              currentDistrict={map.currentDistrict}
              onCountyClick={boardLocked ? noop : map.handleCountyClick}
              onCountyPaint={boardLocked ? noop : map.handleCountyPaint}
              onDragStart={boardLocked ? noop : map.undoRedo.snapshot}
              highlightedDistrict={highlightedDistrict}
              showUnassignedCounties={showUnassignedCounties}
              mapView={mapView}
            />
          )}
        </div>

        {hasMap && (
          <CollapsiblePanel title="Game Stats" side="right" collapsed={statsCollapsed} onToggle={toggleStats}>
          <GameStats
            populationMap={effectiveMap}
            districts={map.districts}
            numDistricts={config.numDistricts}
            currentDistrict={map.currentDistrict}
            targetSeatPercentage={config.targetSeatPercentage}
            playerParty={effectiveParty}
            onDistrictSelect={setHighlightedDistrict}
            onToggleUnassigned={() => setShowUnassignedCounties(!showUnassignedCounties)}
            showUnassignedCounties={showUnassignedCounties}
            isThreeParty={config.isThreeParty}
            constraints={legalConstraints.constraints}
          />
          </CollapsiblePanel>
        )}
      </div>

      {completion.gameComplete && (
        <GhostMapComparison
          populationMap={effectiveMap}
          counties={map.counties}
          playerDistricts={map.districts}
          fairDistricts={fairMap.fairDistricts}
          playerCoreStats={playerCoreStats}
          fairCoreStats={fairMap.fairStats}
          numDistricts={config.numDistricts}
          isThreeParty={config.isThreeParty}
          playerParty={effectiveParty}
          isComputing={fairMap.isComputing}
        />
      )}
    </div>
  );
}
