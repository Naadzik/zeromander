import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import GameCanvasCounty from '../components/GameCanvasCounty'
import Controls from '../components/Controls'
import GameStats from '../components/GameStats'
import GameEndModal from '../components/GameEndModal'
import GameHeader from '../components/GameHeader'
import GameToolbar from '../components/GameToolbar'
import GhostMapComparison from '../components/GhostMapComparison'
import DailyObjectiveBanner from '../components/DailyObjectiveBanner'
import RevealChyron from '../components/RevealChyron'
import Tutorial, { STEPS_3PARTY } from '../components/Tutorial'
import '../styles/Tutorial.css'
import { exportMapPng } from '../utils/exportMap'
import { computeCoreStats } from '../utils/computeGameStats'
import { useGameConfig, DIFFICULTY_SETTINGS } from '../hooks/useGameConfig'
import { useMapState } from '../hooks/useMapState'
import { usePlayerParty } from '../hooks/usePlayerParty'
import { useTutorial } from '../hooks/useTutorial'
import { useGameCompletion } from '../hooks/useGameCompletion'
import { useLegalConstraints } from '../hooks/useLegalConstraints'
import { useFairMap } from '../hooks/useFairMap'
import { getDailyChallenge, buildDailyResult, fairSeedFrom, TIER_LABELS } from '../utils/dailyChallenge'
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
  // Two tiers per day: the Warm-up (default, the gate) and the Full Job.
  const dailyTier = new URLSearchParams(location.search).get('tier') === 'full' ? 'full' : 'small';
  const challenge = useMemo(() => (isDaily ? getDailyChallenge() : null), [isDaily]);
  const tierData = challenge?.[dailyTier] ?? null;
  // Derive the lookup from the same challenge object — two separate
  // getDailyChallenge() calls could straddle UTC midnight and disagree.
  const [dailyResult, setDailyResult] = useState(() => (challenge ? getResultFor(challenge.date, dailyTier) : null));

  // Tier switches re-render (not remount) this component — re-sync the
  // stored result for the tier now in view.
  useEffect(() => {
    setDailyResult(challenge ? getResultFor(challenge.date, dailyTier) : null);
  }, [challenge, dailyTier]);

  // The Full Job is gated: no Warm-up lock for today → back to the Warm-up.
  useEffect(() => {
    if (isDaily && dailyTier === 'full' && challenge && !getResultFor(challenge.date, 'small')) {
      navigate('/game?daily', { replace: true });
    }
  }, [isDaily, dailyTier, challenge, navigate]);

  // Challenge links: ?board=<seed> reproduces a friend's exact board (all
  // generation inputs are encoded), with their "seats stolen" as the goal.
  const duel = useMemo(() => {
    if (isDaily) return null;
    const p = new URLSearchParams(location.search);
    if (!p.has('board')) return null;
    const int = (k, fallback) => {
      const v = parseInt(p.get(k), 10);
      return Number.isFinite(v) ? v : fallback;
    };
    const dif = ['small', 'medium', 'large'].includes(p.get('dif')) ? p.get('dif') : 'medium';
    return {
      seed: int('board', 1) >>> 0,
      difficulty: dif,
      numDistricts: Math.min(40, Math.max(2, int('d', 10))),
      bluePercentage: Math.min(80, Math.max(20, int('b', 45))),
      greyPercentage: Math.min(20, Math.max(0, int('g', 8))),
      numCounties: int('c', 475),
      numCities: int('ct', 4),
      numTowns: int('t', 3),
      party: p.get('p') === 'red' ? 'red' : 'blue',
      goal: p.has('goal') ? int('goal', null) : null
    };
  }, [isDaily, location.search]);

  const sandboxConfig = useGameConfig();
  // Daily/duel overrides are plain values layered over the sandbox hook —
  // Controls is hidden in both modes, so its orphaned setters are unreachable.
  const config = isDaily
    ? { ...sandboxConfig, ...tierData.config, isThreeParty: false }
    : duel
      ? {
          ...sandboxConfig,
          difficulty: duel.difficulty,
          gridSize: DIFFICULTY_SETTINGS[duel.difficulty].gridSize,
          numDistricts: duel.numDistricts,
          numCounties: duel.numCounties,
          numCities: duel.numCities,
          numTowns: duel.numTowns,
          bluePercentage: duel.bluePercentage,
          greyPercentage: duel.greyPercentage,
          targetSeatPercentage: 50,
          isThreeParty: false
        }
      : sandboxConfig;

  const legalConstraints = useLegalConstraints();
  // The board also locks once a SANDBOX game completes — election night has
  // happened; editing would re-roll the reveal (a slot-machine exploit).
  // A ref carries last render's completion state across the hook-order cycle
  // (useMapState ← completion ← map); the one-render lag is sub-frame.
  const gameCompleteRef = useRef(false);
  const map = useMapState(config, legalConstraints.constraints, {
    seed: tierData?.seed ?? duel?.seed,
    locked: (isDaily && !!dailyResult) || gameCompleteRef.current
  });
  const { playerParty, setPlayerParty, togglePlayerParty } = usePlayerParty();
  // The daily assigns your party — and a duel puts you in the challenger's
  // seat, or the comparison means nothing.
  const effectiveParty = isDaily ? challenge.party : (duel ? duel.party : playerParty);
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
  gameCompleteRef.current = completion.gameComplete;
  // boardLocked = the daily's post-lock-in state (drives daily-specific UI);
  // editLocked = any state where the board must be read-only.
  const boardLocked = isDaily && !!dailyResult;
  const editLocked = boardLocked || completion.gameComplete;

  const [highlightedDistrict, setHighlightedDistrict] = useState(null);
  const [showUnassignedCounties, setShowUnassignedCounties] = useState(false);
  const [mapView, setMapView] = useState('districts');

  // ── Election-night reveal sequence ────────────────────────────────────
  // The board declares itself cluster by cluster: revealStep counts how many
  // grey clusters have resolved on screen (then 'done' opens the modal).
  // Purely presentational — the final revealedMap/stats were precomputed at
  // completion; this only controls what the canvas shows when.
  const [revealStep, setRevealStep] = useState(null);

  // Small clusters break first, the biggest is the finale.
  const orderedClusters = useMemo(() => {
    if (!completion.revealClusters?.length) return null;
    return [...completion.revealClusters].sort((a, b) => a.cells.length - b.cells.length);
  }, [completion.revealClusters]);

  useEffect(() => {
    if (completion.gameComplete && orderedClusters && revealStep === null) {
      setRevealStep(0);
    }
    if (!completion.gameComplete && revealStep !== null) {
      setRevealStep(null);
    }
  }, [completion.gameComplete, orderedClusters, revealStep]);

  useEffect(() => {
    if (revealStep === null || revealStep === 'done' || !orderedClusters) return;
    // Long enough to read the narration; compressed when there are many
    // clusters so the whole sequence stays ~10s. Always skippable.
    const beatMs = orderedClusters.length > 5 ? 1200 : 1700;
    const t = setTimeout(
      () => setRevealStep(s => (s >= orderedClusters.length ? 'done' : s + 1)),
      revealStep >= orderedClusters.length ? 900 : beatMs
    );
    return () => clearTimeout(t);
  }, [revealStep, orderedClusters]);

  const revealAnimating = revealStep !== null && revealStep !== 'done';
  function skipReveal() { setRevealStep('done'); }

  // The map the player sees mid-sequence: original board with the first
  // `revealStep` clusters resolved to their final colors.
  const stagedMap = useMemo(() => {
    if (!revealAnimating || !orderedClusters || !completion.revealedMap) return null;
    const party = map.populationMap.party.map(row => [...row]);
    for (let i = 0; i < Math.min(revealStep, orderedClusters.length); i++) {
      for (const { x, y } of orderedClusters[i].cells) {
        party[y][x] = completion.revealedMap.party[y][x];
      }
    }
    return { party, density: map.populationMap.density };
  }, [revealAnimating, revealStep, orderedClusters, completion.revealedMap, map.populationMap]);

  // After the election-night reveal the board shows the RESOLVED map (grey
  // cells now colored); the underlying live map is untouched, so Try Again
  // returns to a grey board. Completion math stays on the original map.
  // `revealPending` covers the one render between completion and the
  // sequence starting — without it the final map would flash early.
  const revealPending = completion.gameComplete && !!orderedClusters && revealStep === null;
  const effectiveMap = revealPending
    ? map.populationMap
    : (stagedMap ?? completion.revealedMap ?? map.populationMap);

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

  // A fresh board always exits the completed state. Without this, Generate
  // Map / config changes after a completed game would deliver a new board
  // that is still edit-locked, with Try Again unreachable (modal dismissed).
  useEffect(() => {
    completion.resetCompletion();
  }, [map.populationMap]);

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
    // Neutral map is pinned to the board seed everywhere: same board →
    // same baseline → "seats stolen" comparable across challenge players.
    // (For the daily, fairSeedFrom(dailySeed) === challenge.fairSeed.)
    seed: map.boardSeed != null ? fairSeedFrom(map.boardSeed) : undefined
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

  // "Challenge a friend": a URL that reproduces this exact board (all
  // generation inputs) with your final seats-stolen as the goal to beat.
  // Available after any completed 2-party sandbox/duel game.
  const challengeShare = useMemo(() => {
    if (isDaily || config.isThreeParty) return null;
    if (!completion.gameComplete || !completion.gameStats || !fairMap.fairStats || map.boardSeed == null) return null;
    const stats = completion.gameStats;
    const finalSeats = stats.swung?.ourSeatCount ?? stats.ourWins;
    const stolen = finalSeats - fairMap.fairStats.ourSeatCount;
    const params = new URLSearchParams({
      board: String(map.boardSeed),
      dif: config.difficulty,
      d: String(config.numDistricts),
      b: String(config.bluePercentage),
      g: String(config.greyPercentage ?? 0),
      c: String(config.numCounties),
      ct: String(config.numCities),
      t: String(config.numTowns),
      p: effectiveParty,
      goal: String(stolen)
    });
    return { stolen, url: `https://naadzik.github.io/zeromander/game?${params.toString()}` };
  }, [isDaily, config, completion.gameComplete, completion.gameStats, fairMap.fairStats, map.boardSeed, effectiveParty]);

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
    setDailyResult(recordDailyResult({ ...result, districts: map.districts }, dailyTier));
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
      {revealAnimating && orderedClusters && (
        <RevealChyron
          step={revealStep}
          clusters={orderedClusters}
          swingPct={completion.gameStats?.swung?.swingPct ?? 0}
          gridSize={config.gridSize}
          onSkip={skipReveal}
        />
      )}

      {completion.showModal && completion.gameStats && !revealAnimating && !revealPending && (
        <GameEndModal
          stats={completion.gameStats}
          difficulty={config.difficulty}
          fairStats={fairMap.fairStats}
          daily={isDaily ? { dayNumber: challenge.dayNumber, party: challenge.party, tier: dailyTier, date: challenge.date, result: dailyResult } : null}
          challengeShare={challengeShare}
          duelGoal={duel?.goal ?? null}
          onTryAgain={isDaily ? undefined : handleTryAgain}
          onClose={completion.dismissModal}
        />
      )}

      <GameHeader onBack={() => navigate('/')} onHelp={tutorial.openTutorial} />

      <div className="app-container">
        {!isDaily && !duel && (
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
              tierLabel={TIER_LABELS[dailyTier]}
              popPercent={challenge.party === 'blue' ? tierData.config.bluePercentage : 100 - tierData.config.bluePercentage}
            />
          )}
          {duel && (
            <div className="daily-objective-banner">
              <span className="daily-objective-banner__day">Challenge board</span>
              <span className="daily-objective-banner__goal">
                {duel.goal !== null
                  ? <>A rival stole <strong>{duel.goal > 0 ? `+${duel.goal}` : duel.goal} seats</strong> here, playing as {duel.party === 'blue' ? 'Urban Union' : 'Heartland Alliance'}. Your move.</>
                  : <>A shared board. Set the score.</>}
              </span>
            </div>
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
                {TIER_LABELS[dailyTier]} locked — {stolen > 0 ? `stole +${stolen}` : stolen === 0 ? 'stole +0' : `${stolen}`} seats vs. the neutral map
              </span>
              <button className="btn-secondary" onClick={() => completion.finalize()}>
                View result
              </button>
              {dailyTier === 'small' && !getResultFor(challenge.date, 'full') && (
                <button className="btn-primary" onClick={() => navigate('/game?daily&tier=full')}>
                  The Full Job is open →
                </button>
              )}
            </div>
          )}
          <GameToolbar
            numDistricts={config.numDistricts}
            currentDistrict={map.currentDistrict}
            onDistrictSelect={map.setCurrentDistrict}
            isThreeParty={config.isThreeParty}
            playerParty={effectiveParty}
            onPartySelect={(editLocked || duel) ? noop : setPlayerParty}
            onPartyToggle={(editLocked || duel) ? noop : togglePlayerParty}
            mapView={mapView}
            onMapViewChange={setMapView}
            canUndo={!editLocked && map.undoRedo.canUndo}
            canRedo={!editLocked && map.undoRedo.canRedo}
            onUndo={editLocked ? noop : map.undoRedo.undo}
            onRedo={editLocked ? noop : map.undoRedo.redo}
            onExport={handleExportMap}
          />
          {hasMap && (
            <GameCanvasCounty
              populationMap={effectiveMap}
              counties={map.counties}
              districts={map.districts}
              currentDistrict={map.currentDistrict}
              onCountyClick={editLocked ? noop : map.handleCountyClick}
              onCountyPaint={editLocked ? noop : map.handleCountyPaint}
              onDragStart={editLocked ? noop : map.undoRedo.snapshot}
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
