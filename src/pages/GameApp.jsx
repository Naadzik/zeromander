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
import LessonGuide from '../components/LessonGuide'
import DecadeResults from '../components/DecadeResults'
import CommunityExplainer from '../components/CommunityExplainer'
import BroadsheetGamePage from '../components/broadsheet/BroadsheetGamePage'
import MobileScoreStrip from '../components/MobileScoreStrip'
import { useTheme } from '../hooks/useTheme'
import { classifyDistricts, getPopulationShares } from '../utils/gameLogic'
import Tutorial, { STEPS_3PARTY } from '../components/Tutorial'
import '../styles/Tutorial.css'
import { exportMapPng } from '../utils/exportMap'
import { computeCoreStats, targetSeatCount } from '../utils/computeGameStats'
import { swingRobustness, breakRobustness } from '../utils/electionVariation'
import { useGameConfig, DIFFICULTY_SETTINGS } from '../hooks/useGameConfig'
import { useMapState } from '../hooks/useMapState'
import { usePlayerParty } from '../hooks/usePlayerParty'
import { useTutorial } from '../hooks/useTutorial'
import { useGameCompletion } from '../hooks/useGameCompletion'
import { useLegalConstraints } from '../hooks/useLegalConstraints'
import { useFairMap } from '../hooks/useFairMap'
import { getDailyChallenge, buildDailyResult, fairSeedFrom, TIER_LABELS } from '../utils/dailyChallenge'
import { getResultFor, recordDailyResult } from '../utils/dailyHistory'
import { utcDateString, createRng } from '../utils/rng'
import { runDecade, readBestDecade, saveBestDecade } from '../utils/decade'
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

// The First Heist teaching board: fixed seed, small, 3 districts, two blue
// cities in red countryside, no grey/swing — so pack+crack always works.
const LESSON = {
  // Kept deliberately COARSE — one tap claims a whole county, so ~15 counties
  // means the whole heist is ~15 taps and finishes well inside 60 seconds (the
  // old 90-county board took far longer and lost first-comers). Seed 37 chosen
  // (solver-verified) so the taught pack+crack wins 2/3 with CONTIGUOUS,
  // population-balanced districts and COMFORTABLE margins: two clear blue blobs
  // (left + bottom-centre) each hold ~59–74% once carved, so a rough split
  // still wins — a beginner can't easily fumble it.
  seed: 37,
  config: {
    difficulty: 'small', gridSize: 50, numDistricts: 3, numCounties: 15,
    numCities: 2, numTowns: 0, bluePercentage: 40, greyPercentage: 0,
    targetSeatPercentage: 50, isThreeParty: false
  }
};

// The community-of-interest scenario board (?scenario=community): a fixed,
// competitive 10-district map with a 20% protected community (fair share ≈ 2
// opportunity seats). The lesson is the trilemma — win your seats without
// cracking or packing the community.
const COMMUNITY_SCENARIO = {
  seed: 88,
  config: {
    difficulty: 'medium', gridSize: 80, numDistricts: 10, numCounties: 475,
    numCities: 4, numTowns: 0, bluePercentage: 48, greyPercentage: 0,
    communityPercentage: 20, targetSeatPercentage: 50, isThreeParty: false
  }
};

// Decade mode (?decade): a FRESH random medium board each visit — no grey, no
// community (the decade's own swing + drift are the only variation). You draw
// once as Urban Union, then defend the map through five elections.
const DECADE_CONFIG = {
  difficulty: 'medium', gridSize: 80, numDistricts: 10, numCounties: 475,
  numCities: 4, numTowns: 0, bluePercentage: 45, greyPercentage: 0,
  communityPercentage: 0, targetSeatPercentage: 50, isThreeParty: false
};

// FNV-1a over the districts grid → a stable per-map fingerprint. Combined with
// the board seed it makes each map face ONE fixed decade (no re-roll fishing),
// while different maps get different decades.
function hashGrid(grid) {
  let h = 2166136261;
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      h ^= grid[y][x] + 1;
      h = Math.imul(h, 16777619);
    }
  return h >>> 0;
}

export default function GameApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // "The Heist" daily mode: same board, same assigned party, same neutral
  // baseline for everyone; one locked submission per UTC day.
  const isDaily = new URLSearchParams(location.search).has('daily');
  // Two tiers per day: the Warm-up (default, the gate) and the Full Job.
  const dailyTier = new URLSearchParams(location.search).get('tier') === 'full' ? 'full' : 'small';
  // Archive: ?daily=YYYY-MM-DD replays a PAST board — deterministic, so it's
  // free. Archive plays are unscored: no history write, no streak, no gate.
  const dailyDateParam = new URLSearchParams(location.search).get('daily');
  const isArchive = isDaily
    && /^\d{4}-\d{2}-\d{2}$/.test(dailyDateParam || '')
    && dailyDateParam < utcDateString();
  const challenge = useMemo(
    () => (isDaily ? getDailyChallenge(isArchive ? new Date(dailyDateParam + 'T12:00:00Z') : new Date()) : null),
    [isDaily, isArchive, dailyDateParam]
  );
  const tierData = challenge?.[dailyTier] ?? null;
  // Derive the lookup from the same challenge object — two separate
  // getDailyChallenge() calls could straddle UTC midnight and disagree.
  // Archive always starts fresh (unscored, replayable).
  const [dailyResult, setDailyResult] = useState(() => (challenge && !isArchive ? getResultFor(challenge.date, dailyTier) : null));

  // Tier switches re-render (not remount) this component — re-sync the
  // stored result for the tier now in view. (Archive stays fresh/unscored.)
  useEffect(() => {
    setDailyResult(challenge && !isArchive ? getResultFor(challenge.date, dailyTier) : null);
  }, [challenge, dailyTier, isArchive]);

  // The Full Job is gated on the Warm-up (today only — archive is ungated).
  useEffect(() => {
    if (isDaily && !isArchive && dailyTier === 'full' && challenge && !getResultFor(challenge.date, 'small')) {
      navigate('/game?daily', { replace: true });
    }
  }, [isDaily, isArchive, dailyTier, challenge, navigate]);

  // "First Heist" guided lesson: a fixed 3-district teaching board.
  const isLesson = new URLSearchParams(location.search).has('lesson');
  // Community-of-interest teaching scenario (VRA layer): a fixed board with a
  // protected community — win seats AND give them fair representation.
  const isCommunityScenario = new URLSearchParams(location.search).get('scenario') === 'community';
  // Decade campaign mode: draw once, defend it across five elections.
  const isDecade = new URLSearchParams(location.search).has('decade');

  // Challenge links: ?board=<seed> reproduces a friend's exact board (all
  // generation inputs are encoded), with their "seats stolen" as the goal.
  const duel = useMemo(() => {
    if (isDaily || isLesson || isCommunityScenario || isDecade) return null;
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
  // Daily/duel/lesson overrides are plain values layered over the sandbox
  // hook — Controls is hidden in those modes, so its setters are unreachable.
  // `communityPercentage: 0` is forced in every non-sandbox/non-scenario mode
  // so a sandbox community toggle can never leak into (and re-roll) a frozen
  // daily / lesson / challenge board.
  const config = isDaily
    ? { ...sandboxConfig, ...tierData.config, communityPercentage: 0, isThreeParty: false }
    : isLesson
      ? { ...sandboxConfig, ...LESSON.config, communityPercentage: 0 }
      : isCommunityScenario
        ? { ...sandboxConfig, ...COMMUNITY_SCENARIO.config }
        : isDecade
          ? { ...sandboxConfig, ...DECADE_CONFIG }
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
              communityPercentage: 0,
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
  // Mobile drawing aid: "add to empty only" mode (see useMapState) — a stray
  // finger-drag then claims unassigned counties without stealing from districts
  // you've already drawn.
  const [addUnclaimedOnly, setAddUnclaimedOnly] = useState(false);
  const map = useMapState(config, legalConstraints.constraints, {
    seed: tierData?.seed ?? duel?.seed ?? (isLesson ? LESSON.seed : isCommunityScenario ? COMMUNITY_SCENARIO.seed : undefined),
    locked: (isDaily && !!dailyResult) || gameCompleteRef.current,
    addUnclaimedOnly
  });
  const { playerParty, setPlayerParty, togglePlayerParty } = usePlayerParty();
  // The daily assigns your party; a duel puts you in the challenger's seat;
  // the lesson always casts you as the underdog Urban Union.
  const effectiveParty = isDaily ? challenge.party : (duel ? duel.party : (isLesson || isCommunityScenario || isDecade ? 'blue' : playerParty));
  const tutorial = useTutorial();
  const [electionUncertainty, setElectionUncertainty] = useState(false);
  const [durabilityReport, setDurabilityReport] = useState(false);
  // Decade mode: the played-out result, the prior best (for comparison), and
  // whether this run set a new record. All null until "Run the decade".
  const [decadeResult, setDecadeResult] = useState(null);
  const [decadeBest, setDecadeBest] = useState(null);
  const [decadeIsNewBest, setDecadeIsNewBest] = useState(false);
  // Scorecard dismissed to inspect the map — the decade report stays on file
  // (a reopen bar renders) instead of being lost with the modal.
  const [decadeDismissed, setDecadeDismissed] = useState(false);
  // Sandbox opt-in: run a decade on the board you drew (2-party). The ?decade
  // route is the dedicated version; this toggle brings the same flow to any
  // sandbox board without touching its config, party, or controls.
  const [decadeMode, setDecadeMode] = useState(false);
  const decadeActive = isDecade || decadeMode;
  // Mirror of fairMap.fairStats.ourSeatCount for the v2 target ("beat the
  // neutral map by one"). A ref because useFairMap sits BELOW this hook (its
  // `enabled` reads completion.gameComplete); assigned right after useFairMap
  // runs, read inside completion's computeStats at freeze/finalize time.
  const fairSeatsRef = useRef(null);
  const completion = useGameCompletion({
    populationMap: map.populationMap,
    districts: map.districts,
    numDistricts: config.numDistricts,
    playerParty: effectiveParty,
    difficulty: config.difficulty,
    targetSeatPercentage: config.targetSeatPercentage,
    constraints: legalConstraints.constraints,
    electionUncertainty: (isDaily || isLesson || decadeActive) ? false : electionUncertainty,
    manual: isDaily || decadeActive,
    fairSeatsRef
  });
  gameCompleteRef.current = completion.gameComplete;
  // boardLocked = the daily's post-lock-in state (drives daily-specific UI);
  // editLocked = any state where the board must be read-only.
  const boardLocked = isDaily && !!dailyResult;
  const editLocked = boardLocked || completion.gameComplete;

  // Lesson goal detection: drives the docked coach's auto-advance.
  const lessonSignals = useMemo(() => {
    if (!isLesson || !map.populationMap.party) return { packedRed: false, blueTwo: false };
    const rows = classifyDistricts(map.populationMap, map.districts, config.numDistricts);
    return {
      // A district where Heartland is warehoused (safe red ≥60%).
      packedRed: rows.some(r => r.status === 'red' && r.red / (r.blue + r.red || 1) >= 0.6),
      // Two districts leaning your way — the majority is in reach.
      blueTwo: rows.filter(r => r.status === 'blue').length >= 2
    };
  }, [isLesson, map.populationMap, map.districts, config.numDistricts]);

  function finishLesson(destination) {
    try { localStorage.setItem('zeromander.lessonDone', '1'); } catch { /* private mode */ }
    navigate(destination);
  }

  // Mark the lesson done the moment it completes (the modal handles routing).
  useEffect(() => {
    if (isLesson && completion.gameComplete) {
      try { localStorage.setItem('zeromander.lessonDone', '1'); } catch { /* private mode */ }
    }
  }, [isLesson, completion.gameComplete]);

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
      // Decade mode: the decade already played five election nights — the
      // undecideds resolve instantly and silently at inspect time instead of
      // re-running the staged single-election reveal after the scorecard.
      setRevealStep(decadeActive ? 'done' : 0);
    }
    if (!completion.gameComplete && revealStep !== null) {
      setRevealStep(null);
    }
  }, [completion.gameComplete, orderedClusters, revealStep, decadeActive]);

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

  // Toggling the sandbox decade switch swaps the whole end-game flow, so clear
  // any single-election completion (or stale decade result) that was in flight.
  useEffect(() => {
    completion.resetCompletion();
    setDecadeResult(null);
    setDecadeDismissed(false);
  }, [decadeMode]);

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
  fairSeatsRef.current = fairMap.fairStats?.ourSeatCount ?? null;

  // Re-entering a locked day: reinstall the submitted districts onto the
  // (identical, deterministic) board instead of offering a fresh one.
  useEffect(() => {
    if (!boardLocked || !dailyResult.districts || !map.counties.length) return;
    map.restoreDistricts(dailyResult.districts);
  }, [boardLocked, map.counties]);

  const playerCoreStats = useMemo(() => {
    if (!completion.gameComplete) return null;
    return computeCoreStats(effectiveMap, map.districts, config.numDistricts, effectiveParty, config.isThreeParty, map.counties);
  }, [completion.gameComplete, effectiveMap, map.districts, config.numDistricts, effectiveParty, config.isThreeParty, map.counties]);

  // Durability report — sandbox 2-party opt-in. Stress-tests the finished map
  // against a national swing AND against how the undecideds might break, using
  // Engine A (electionVariation). One-time compute when the game completes.
  const durability = useMemo(() => {
    if (!durabilityReport || isDaily || config.isThreeParty || !completion.gameComplete || !map.populationMap?.party) return null;
    const nd = config.numDistricts;
    // Grey share + target come from the RAW pre-reveal map — the revealed map
    // has no grey left, so reading it there would zero the undecided readout.
    const rawShares = getPopulationShares(map.populationMap);
    const greyShare = rawShares.grey ?? 0;
    const targetSeats = targetSeatCount(rawShares[effectiveParty] * (1 - greyShare / 100), nd, fairSeatsRef.current);
    const decidedMap = completion.revealedMap ?? map.populationMap; // grey resolved
    const swing = swingRobustness(decidedMap, map.districts, nd, effectiveParty, { targetSeats });
    const breaks = greyShare > 0.01
      ? breakRobustness(map.populationMap, map.districts, nd, effectiveParty, { runs: 200, targetSeats })
      : null;
    return { swing, breaks, targetSeats, numDistricts: nd };
  }, [durabilityReport, isDaily, config.isThreeParty, config.numDistricts, completion.gameComplete, completion.revealedMap, map.populationMap, map.districts, effectiveParty]);

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
    // A fresh board voids any decade report on file.
    setDecadeResult(null);
    setDecadeIsNewBest(false);
    setDecadeDismissed(false);
    map.generateNewGame();
  }

  // "Full results & map": close the scorecard and run the STANDARD end-game
  // surfaces (modal with stats/anatomy + neutral-map comparison) on the map as
  // drawn — the same read every other mode gets. The decade report stays on
  // file behind a reopen bar.
  function handleDecadeInspect() {
    setDecadeDismissed(true);
    // Always finalize — it re-arms the modal after a dismissal (the same
    // sanctioned "view result again" call the daily's locked bar uses), so
    // inspecting works every time, not just the first.
    completion.finalize();
  }

  // Decade mode: play the finished map out across five elections. The decade is
  // seeded deterministically from the board + drawn lines, so a given map faces
  // ONE fixed decade (you can't re-roll for a lucky run — you must redraw).
  function handleRunDecade() {
    if (!completion.isMapValid) return;
    const seed = (Math.imul((map.boardSeed ?? 0) >>> 0, 2654435761) ^ hashGrid(map.districts)) >>> 0;
    const result = runDecade(map.populationMap, map.districts, config.numDistricts, effectiveParty, createRng(seed), { elections: 5 });
    setDecadeBest(readBestDecade());     // the record BEFORE this run, for the comparison line
    setDecadeIsNewBest(saveBestDecade(result));
    setDecadeResult(result);
    // The decade IS election night(s): resolve the board's undecideds NOW so
    // the plate behind the scorecard already shows them broken, instead of
    // them snapping only after the scorecard closes. The staged reveal is
    // suppressed in decade mode, so this is instant and silent.
    completion.finalize();
  }

  function handleDecadeNewMap() {
    setDecadeResult(null);
    setDecadeIsNewBest(false);
    setDecadeDismissed(false);
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
    const record = { ...result, districts: map.districts };
    // Archive plays are unscored — hold the result locally for the modal,
    // but never touch history or the streak.
    setDailyResult(isArchive ? record : recordDailyResult(record, dailyTier));
  }

  const noop = () => {};
  const stolen = dailyResult?.seatsStolen;
  const { edition } = useTheme();

  // Dev-only test seam (stripped from production builds): lets automated
  // checks install a districts grid without simulating 475 county clicks.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.__zmTest = { restoreDistricts: map.restoreDistricts };
  }

  // ── The Broadsheet (paper edition): a distinct front-page shell over the
  // SAME state above. Hooks all live above this branch, so cycling editions
  // mid-game re-renders without remounting — the board survives. Modes with
  // dashboard-only furniture fall back to the print-themed dashboard.
  // Decade plays fully inside the Broadsheet; lesson/duel/community still
  // fall back to the print dashboard (they depend on dashboard-only coaching
  // and meters).
  const paperSupported = !isLesson && !duel && !isCommunityScenario;
  if (edition === 'paper' && paperSupported && hasMap) {
    return (
      <BroadsheetGamePage
        session={{
          config,
          map,
          effectiveMap,
          effectiveParty,
          completion,
          fairMap,
          playerCoreStats,
          reveal: { revealStep, orderedClusters, revealAnimating, revealPending, skipReveal },
          durability,
          challengeShare,
          daily: { isDaily, challenge, tierData, dailyTier, dailyResult, stolen, isArchive },
          decade: {
            active: decadeActive,
            result: decadeResult,
            dismissed: decadeDismissed,
            setDismissed: setDecadeDismissed,
            best: decadeBest,
            isNewBest: decadeIsNewBest,
            handleRunDecade,
            handleDecadeNewMap,
            handleDecadeInspect,
          },
          flags: { editLocked, boardLocked },
          handlers: {
            handleLockIn,
            handleTryAgain,
            handleExportMap,
            onCountyClick: editLocked ? noop : map.handleCountyClick,
            onCountyPaint: editLocked ? noop : map.handleCountyPaint,
            onDragStart: editLocked ? noop : map.undoRedo.snapshot,
            onPartyToggle: editLocked ? noop : togglePlayerParty,
            canUndo: !editLocked && map.undoRedo.canUndo,
            canRedo: !editLocked && map.undoRedo.canRedo,
            onUndo: editLocked ? noop : map.undoRedo.undo,
            onRedo: editLocked ? noop : map.undoRedo.redo,
            addUnclaimedOnly,
            onToggleAddUnclaimed: () => setAddUnclaimedOnly(v => !v),
          },
          sandbox: {
            difficulty: config.difficulty,
            onDifficultyChange: handleDifficultyChange,
            numDistricts: config.numDistricts,
            onDistrictsChange: config.setNumDistricts,
            maxDistricts: config.maxDistricts,
            numCounties: config.numCounties,
            onCountiesChange: config.setNumCounties,
            numCities: config.numCities,
            onNumCitiesChange: config.setNumCities,
            numTowns: config.numTowns,
            onNumTownsChange: config.setNumTowns,
            bluePercentage: config.bluePercentage,
            onBluePercentageChange: config.handleBluePercentageChange,
            greenPercentage: config.greenPercentage,
            onGreenPercentageChange: config.setGreenPercentage,
            greyPercentage: config.greyPercentage,
            onGreyPercentageChange: config.setGreyPercentage,
            electionUncertainty,
            onElectionUncertaintyChange: setElectionUncertainty,
            durabilityReport,
            onDurabilityReportChange: setDurabilityReport,
            includeCommunity: sandboxConfig.includeCommunity,
            onIncludeCommunityChange: sandboxConfig.setIncludeCommunity,
            decadeMode,
            onDecadeModeChange: setDecadeMode,
            constraints: legalConstraints.constraints,
            onPopDeviationEnabledChange: legalConstraints.setPopDeviationEnabled,
            onResetGame: map.generateNewGame,
          },
          view: {
            mapView,
            setMapView,
            highlightedDistrict,
            setHighlightedDistrict,
            showUnassignedCounties,
            onToggleUnassigned: () => setShowUnassignedCounties(!showUnassignedCounties),
          },
          tutorial,
          navigate,
        }}
      />
    );
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

      {isLesson && !completion.gameComplete && (
        <LessonGuide signals={lessonSignals} onSkip={() => finishLesson('/game?daily')} />
      )}

      {decadeActive && decadeResult && !decadeDismissed && (
        <DecadeResults
          result={decadeResult}
          playerParty={effectiveParty}
          numDistricts={config.numDistricts}
          best={decadeBest}
          isNewBest={decadeIsNewBest}
          onNewMap={handleDecadeNewMap}
          onBack={() => navigate('/')}
          onInspect={handleDecadeInspect}
          districts={map.districts}
          counties={map.counties}
          populationMap={map.populationMap}
        />
      )}

      {completion.showModal && completion.gameStats && !revealAnimating && !revealPending && (
        <GameEndModal
          stats={completion.gameStats}
          difficulty={config.difficulty}
          fairStats={fairMap.fairStats}
          daily={isDaily ? { dayNumber: challenge.dayNumber, party: challenge.party, tier: dailyTier, date: challenge.date, result: dailyResult, archive: isArchive } : null}
          challengeShare={isLesson ? null : challengeShare}
          durability={durability}
          duelGoal={duel?.goal ?? null}
          lesson={isLesson ? { onPlayDaily: () => finishLesson('/game?daily') } : null}
          onTryAgain={isDaily ? undefined : handleTryAgain}
          onClose={completion.dismissModal}
        />
      )}

      <GameHeader onBack={() => navigate('/')} onHelp={tutorial.openTutorial} />

      <div className="app-container">
        {!isDaily && !duel && !isLesson && !isCommunityScenario && !isDecade && (
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
            durabilityReport={durabilityReport}
            onDurabilityReportChange={setDurabilityReport}
            decadeMode={decadeMode}
            onDecadeModeChange={setDecadeMode}
            includeCommunity={sandboxConfig.includeCommunity}
            onIncludeCommunityChange={sandboxConfig.setIncludeCommunity}
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
              tierLabel={isArchive ? `Archive · ${TIER_LABELS[dailyTier]}` : TIER_LABELS[dailyTier]}
              popPercent={challenge.party === 'blue' ? tierData.config.bluePercentage : 100 - tierData.config.bluePercentage}
            />
          )}
          {isCommunityScenario && (
            <>
              <div className="daily-objective-banner">
                <span className="daily-objective-banner__day">Community scenario</span>
                <span className="daily-objective-banner__goal">
                  The dashed amber region is the <strong>Riverlands community</strong> — about 20% of voters, so their fair share is <strong>2 of the 10 seats</strong>. Draw <strong>two districts where they're a majority</strong> while you win your own seats for Urban Union. <strong>Crack</strong> them (a majority in none) or <strong>pack</strong> them (all crammed into one) and you dilute their vote — and your <strong>Litigation Risk</strong> climbs.
                </span>
              </div>
              <CommunityExplainer />
            </>
          )}
          {isDecade && (
            <div className="daily-objective-banner">
              <span className="daily-objective-banner__day">The Decade</span>
              <span className="daily-objective-banner__goal">
                Draw one map, then defend it through <strong>five elections</strong> of national swings and a slow drift of voters toward the cities. A greedy map wins big today and shatters in a wave — build one that <strong>lasts</strong>. You're Urban Union; hold the majority as long as you can.
              </span>
            </div>
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
          {decadeActive && !decadeResult && (
            <div className="daily-lock-bar">
              <button
                className="btn-primary"
                disabled={!completion.isMapValid}
                onClick={handleRunDecade}
              >
                {completion.isMapValid ? '▶ Run the decade' : 'Assign every district to run the decade'}
              </button>
            </div>
          )}
          {decadeActive && decadeResult && decadeDismissed && (
            <div className="daily-lock-bar daily-lock-bar--locked">
              <span>
                Decade on file — {decadeResult.heldMajority}/{decadeResult.totalElections} majorities held, {decadeResult.cumulativeOurSeats} cumulative seats
              </span>
              <button className="btn-secondary" onClick={() => setDecadeDismissed(false)}>
                Reopen the scorecard
              </button>
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
            onPartySelect={(editLocked || duel || isLesson || isDecade) ? noop : setPlayerParty}
            onPartyToggle={(editLocked || duel || isLesson || isDecade) ? noop : togglePlayerParty}
            mapView={mapView}
            onMapViewChange={setMapView}
            canUndo={!editLocked && map.undoRedo.canUndo}
            canRedo={!editLocked && map.undoRedo.canRedo}
            onUndo={editLocked ? noop : map.undoRedo.undo}
            onRedo={editLocked ? noop : map.undoRedo.redo}
            onExport={handleExportMap}
            addUnclaimedOnly={addUnclaimedOnly}
            onToggleAddUnclaimed={() => setAddUnclaimedOnly(v => !v)}
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
          {hasMap && (
            <MobileScoreStrip
              populationMap={effectiveMap}
              districts={map.districts}
              numDistricts={config.numDistricts}
              currentDistrict={map.currentDistrict}
              playerParty={effectiveParty}
              isThreeParty={config.isThreeParty}
              onExpand={() => { if (statsCollapsed) toggleStats(); }}
              fairSeats={fairMap.fairStats?.ourSeatCount ?? null}
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
            fairCompactness={fairMap.fairStats?.compactness?.average ?? null}
            fairSeats={fairMap.fairStats?.ourSeatCount ?? null}
            fairGapSeats={fairMap.fairStats?.gap?.gapSeats ?? null}
            fairGapPct={fairMap.fairStats?.gap?.gap ?? null}
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
