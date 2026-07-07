import { useRef, useState } from 'react'
import GhostMapCanvas from './GhostMapCanvas'
import { buildComparisonCanvas, shareOrDownloadCanvas } from '../utils/exportMap'
import '../styles/GhostMapComparison.css'

function StatRow({ label, value }) {
  return (
    <div className="ghost-stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatColumn({ title, populationMap, counties, districts, coreStats, numDistricts, isThreeParty, canvasRef, view }) {
  return (
    <div className="ghost-map-panel">
      <h4>{title}</h4>
      <GhostMapCanvas populationMap={populationMap} counties={counties} districts={districts} canvasRef={canvasRef} view={view} />
      <StatRow label="Seats" value={`${coreStats.ourSeatCount}/${numDistricts}`} />
      {!isThreeParty && (
        <StatRow label="Efficiency Gap" value={`${Math.round(coreStats.gap.gap)}%`} />
      )}
      <StatRow label="Compactness" value={`${Math.round(coreStats.compactness.average * 100)}%`} />
    </div>
  );
}

// Side-by-side comparison of the player's drawn map against a party-blind
// "neutral" map generated from the same counties — the pedagogical payoff of
// the fair-map feature: "here's what an apolitical process would have drawn."
export default function GhostMapComparison({ populationMap, counties, playerDistricts, fairDistricts, playerCoreStats, fairCoreStats, numDistricts, isThreeParty, playerParty, isComputing }) {
  const playerCanvasRef = useRef(null);
  const ghostCanvasRef = useRef(null);
  const [shareState, setShareState] = useState(null); // null | 'shared' | 'downloaded'
  const [view, setView] = useState('districts'); // 'districts' | 'party'

  if (isComputing) {
    return <div className="ghost-map-comparison ghost-map-comparison--loading">Generating neutral map…</div>;
  }
  if (!fairDistricts || !fairCoreStats || !playerCoreStats) return null;

  async function handleShareComparison() {
    if (!playerCanvasRef.current || !ghostCanvasRef.current) return;
    const canvas = buildComparisonCanvas(playerCanvasRef.current, ghostCanvasRef.current, {
      playerStats: playerCoreStats,
      fairStats: fairCoreStats,
      playerParty,
      numDistricts
    });
    const text = `My map vs. a party-blind neutral map — same voters, different lines. naadzik.github.io/zeromander/`;
    const result = await shareOrDownloadCanvas(canvas, { filename: 'zeromander-comparison.png', text });
    setShareState(result);
    setTimeout(() => setShareState(null), 2500);
  }

  return (
    <div className="ghost-map-comparison">
      <div className="ghost-view-toggle" role="group" aria-label="Map coloring">
        <button className={view === 'districts' ? 'is-active' : ''} onClick={() => setView('districts')}>Districts</button>
        <button className={view === 'party' ? 'is-active' : ''} onClick={() => setView('party')}>Party colors</button>
      </div>
      <div className="ghost-map-columns">
        <StatColumn
          title="Your Map"
          populationMap={populationMap}
          counties={counties}
          districts={playerDistricts}
          coreStats={playerCoreStats}
          numDistricts={numDistricts}
          isThreeParty={isThreeParty}
          canvasRef={playerCanvasRef}
          view={view}
        />
        <StatColumn
          title="Neutral Map"
          populationMap={populationMap}
          counties={counties}
          districts={fairDistricts}
          coreStats={fairCoreStats}
          numDistricts={numDistricts}
          isThreeParty={isThreeParty}
          canvasRef={ghostCanvasRef}
          view={view}
        />
      </div>
      <div className="ghost-share-row">
        <button className="btn-secondary" onClick={handleShareComparison}>
          {shareState === 'downloaded' ? '✓ Image saved' : shareState === 'shared' ? '✓ Shared' : 'Share comparison'}
        </button>
      </div>
    </div>
  );
}
