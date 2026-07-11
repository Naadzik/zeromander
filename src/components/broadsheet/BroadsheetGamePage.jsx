import { useEffect, useRef } from 'react'
import GameCanvasCounty from '../GameCanvasCounty'
import GhostMapComparison from '../GhostMapComparison'
import RevealChyron from '../RevealChyron'
import DecadeResults from '../DecadeResults'
import Tutorial, { STEPS_3PARTY } from '../Tutorial'
import ReturnsAgate from './ReturnsAgate'
import PaperCompositor from './PaperCompositor'
import PaperMapRoom from './PaperMapRoom'
import PaperVerdictArticle from './PaperVerdictArticle'
import { useTheme, NEXT_LABEL } from '../../hooks/useTheme'
import { liveHeadline } from '../../utils/liveHeadline'
import { verdictStatus } from '../../utils/verdictCopy'
import { PARTY } from '../../utils/partyConfig'
import { TIER_LABELS } from '../../utils/dailyChallenge'
import '../../styles/broadsheet.css'

// The Broadsheet edition of /game: a newspaper front page, not a dashboard.
// All game state lives in GameApp (this is a pure presentation shell); the
// page rewrites itself — headline, standfirst, and a below-the-fold article —
// as the reader draws and the returns come in. No modals.
export default function BroadsheetGamePage({ session }) {
  const {
    config, map, effectiveMap, effectiveParty, completion, fairMap,
    playerCoreStats, reveal, durability, challengeShare, daily, decade, flags,
    handlers, sandbox, view, tutorial, navigate,
  } = session;
  const { edition, cycleEdition } = useTheme();

  const complete = completion.gameComplete && !reveal.revealAnimating && !reveal.revealPending;
  const phase = flags.boardLocked && !completion.gameComplete ? 'locked'
    : complete ? 'complete'
    : (reveal.revealAnimating || reveal.revealPending) ? 'revealing'
    : (completion.isMapValid && daily.isDaily && !flags.boardLocked) ? 'ready'
    : 'drawing';

  // Count assigned districts + unclaimed counties for the live standfirst.
  let assigned = 0;
  const unclaimed = new Set();
  if (map.districts.length) {
    const seen = new Set();
    for (let y = 0; y < map.districts.length; y++) {
      for (let x = 0; x < map.districts[y].length; x++) {
        const v = map.districts[y][x];
        if (v > 0) seen.add(v);
        else if (map.counties[y]?.[x] > 0) unclaimed.add(map.counties[y][x]);
      }
    }
    assigned = seen.size;
  }

  const verdict = complete && completion.gameStats
    ? { ...verdictStatus({ stats: completion.gameStats, daily: daily.isDaily ? { dayNumber: daily.challenge?.dayNumber, archive: daily.isArchive, result: daily.dailyResult } : null, lesson: null }),
        won: completion.gameStats.won, struckDown: completion.gameStats.struckDown, stolen: daily.stolen }
    : null;

  const head = liveHeadline({
    phase,
    assignedDistricts: assigned,
    totalDistricts: config.numDistricts,
    unassignedCounties: unclaimed.size,
    isDaily: daily.isDaily,
    dailyTier: daily.dailyTier,
    dayNumber: daily.challenge?.dayNumber,
    archive: daily.isArchive,
    partyLabel: PARTY[effectiveParty].label,
    popPercent: daily.isDaily ? (effectiveParty === 'blue' ? daily.tierData?.config.bluePercentage : 100 - (daily.tierData?.config.bluePercentage ?? 50)) : null,
    clustersReporting: reveal.orderedClusters?.length ?? 0,
    verdict,
  });

  // When the verdict lands, bring the reader back to the flipped headline.
  const flippedRef = useRef(false);
  useEffect(() => {
    if (complete && !flippedRef.current) {
      flippedRef.current = true;
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* older browsers */ }
    }
    if (!completion.gameComplete) flippedRef.current = false;
  }, [complete, completion.gameComplete]);

  const dateline = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const folio = daily.isDaily
    ? `DAILY EDITION No. ${daily.challenge?.dayNumber}${daily.isArchive ? ' — ARCHIVE' : ''} · ${TIER_LABELS[daily.dailyTier] ?? ''}`
    : 'SANDBOX PRINTING';

  return (
    <div className="paper-page">
      {tutorial.showTutorial && <Tutorial onClose={tutorial.dismissTutorial} />}
      {tutorial.show3PartyTutorial && <Tutorial steps={STEPS_3PARTY} onClose={tutorial.dismiss3PartyTutorial} />}
      {decade.active && decade.result && !decade.dismissed && (
        <DecadeResults
          result={decade.result}
          playerParty={effectiveParty}
          numDistricts={config.numDistricts}
          best={decade.best}
          isNewBest={decade.isNewBest}
          onNewMap={decade.handleDecadeNewMap}
          onBack={() => navigate('/')}
          onInspect={decade.handleDecadeInspect}
          districts={map.districts}
          counties={map.counties}
          populationMap={map.populationMap}
        />
      )}
      {reveal.revealAnimating && reveal.orderedClusters && (
        <RevealChyron
          step={reveal.revealStep}
          clusters={reveal.orderedClusters}
          swingPct={completion.gameStats?.swung?.swingPct ?? 0}
          gridSize={config.gridSize}
          onSkip={reveal.skipReveal}
        />
      )}

      <header className="paper-masthead">
        <div className="paper-folio">
          <span>{dateline}</span>
          <span>{folio}</span>
          <span>PRICE: FREE — LIKE MOST BAD MAPS</span>
        </div>
        <div className="paper-nameplate-row">
          <button className="paper-agate-link" onClick={() => navigate('/')}>← Front desk</button>
          <h1 className="paper-nameplate">The Zeromander</h1>
          <span className="paper-mast-actions">
            <button className="paper-agate-link" onClick={cycleEdition}>{NEXT_LABEL[edition]}</button>
            <button className="paper-agate-link" onClick={tutorial.openTutorial}>How to read this page</button>
          </span>
        </div>
      </header>

      <section className="paper-head">
        <p className="paper-kicker">{head.kicker}</p>
        <h2 className="paper-headline">{head.headline}</h2>
        <p className="paper-standfirst">{head.standfirst}</p>
      </section>

      <div className="paper-sheet">
        <figure className="paper-plate">
          <PaperCompositor
            numDistricts={config.numDistricts}
            currentDistrict={map.currentDistrict}
            onDistrictSelect={map.setCurrentDistrict}
            isThreeParty={config.isThreeParty}
            playerParty={effectiveParty}
            onPartyToggle={handlers.onPartyToggle}
            mapView={view.mapView}
            onMapViewChange={view.setMapView}
            canUndo={handlers.canUndo}
            canRedo={handlers.canRedo}
            onUndo={handlers.onUndo}
            onRedo={handlers.onRedo}
            onExport={handlers.handleExportMap}
          />
          <GameCanvasCounty
            populationMap={effectiveMap}
            counties={map.counties}
            districts={map.districts}
            currentDistrict={map.currentDistrict}
            onCountyClick={handlers.onCountyClick}
            onCountyPaint={handlers.onCountyPaint}
            onDragStart={handlers.onDragStart}
            highlightedDistrict={view.highlightedDistrict}
            showUnassignedCounties={view.showUnassignedCounties}
            mapView={view.mapView}
          />
          <figcaption className="paper-plate-caption">
            FIG. 1 — {config.numDistricts} districts, drawn by the reader. Hatch direction = party; engraving weight = population.
          </figcaption>
          {decade.active && !decade.result && (
            <div className="paper-pressbar">
              <button
                className="paper-desk-btn paper-desk-btn--recount"
                disabled={!completion.isMapValid}
                onClick={decade.handleRunDecade}
              >
                {completion.isMapValid ? 'RUN THE DECADE — ten years, one map' : 'Assign every district to run the decade'}
              </button>
            </div>
          )}
          {decade.active && decade.result && decade.dismissed && (
            <div className="paper-pressbar">
              <span className="paper-agate-foot">
                Decade on file — {decade.result.heldMajority}/{decade.result.totalElections} majorities, {decade.result.cumulativeOurSeats} cumulative seats.
              </span>
              <button className="paper-desk-btn" onClick={() => decade.setDismissed(false)}>
                Reopen the scorecard
              </button>
            </div>
          )}
          {daily.isDaily && !flags.boardLocked && (
            <div className="paper-pressbar">
              <button
                className="paper-desk-btn paper-desk-btn--recount"
                disabled={!completion.isMapValid || !fairMap.fairStats}
                onClick={handlers.handleLockIn}
              >
                {completion.isMapValid ? 'STOP THE PRESSES — lock in the heist' : 'Assign every district to go to press'}
              </button>
            </div>
          )}
          {flags.boardLocked && !completion.gameComplete && (
            <div className="paper-pressbar">
              <span className="paper-agate-foot">Late edition on file. </span>
              <button className="paper-desk-btn" onClick={() => completion.finalize()}>Read the full report</button>
              {daily.dailyTier === 'small' && (
                <button className="paper-desk-btn" onClick={() => navigate('/game?daily&tier=full')}>The Full Job is open →</button>
              )}
            </div>
          )}
        </figure>

        <aside className="paper-rail">
          <ReturnsAgate
            populationMap={effectiveMap}
            districts={map.districts}
            numDistricts={config.numDistricts}
            isThreeParty={config.isThreeParty}
            playerParty={effectiveParty}
            highlightedDistrict={view.highlightedDistrict}
            onDistrictSelect={view.setHighlightedDistrict}
            showUnassignedCounties={view.showUnassignedCounties}
            onToggleUnassigned={view.onToggleUnassigned}
            lastRejection={map.lastRejection}
            greyPercentage={config.greyPercentage}
          />
          {!daily.isDaily && <PaperMapRoom sandbox={sandbox} />}
        </aside>
      </div>

      {complete && completion.gameStats && (
        <PaperVerdictArticle
          stats={completion.gameStats}
          daily={daily.isDaily ? { dayNumber: daily.challenge?.dayNumber, party: daily.challenge?.party, tier: daily.dailyTier, date: daily.challenge?.date, result: daily.dailyResult, archive: daily.isArchive } : null}
          fairStats={fairMap.fairStats}
          durability={durability}
          challengeShare={challengeShare}
          onTryAgain={daily.isDaily ? null : handlers.handleTryAgain}
        />
      )}

      {complete && (
        <figure className="paper-neutral">
          <h3 className="paper-slug">The Neutral Map</h3>
          <p className="paper-standfirst paper-standfirst--small">What a party-blind commission would have drawn from the same voters.</p>
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
        </figure>
      )}

      <footer className="paper-colophon">
        Set in Newsreader &amp; Libre Franklin · Fictional parties, real formulas ·{' '}
        <a href="https://github.com/Naadzik/zeromander" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
