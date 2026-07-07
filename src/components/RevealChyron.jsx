import { PARTY } from '../utils/partyConfig'
import '../styles/RevealChyron.css'

// Compass flavor for a cluster from its centroid — broadcast anchors don't
// say "cluster 2", they say "the northwestern precincts".
function regionName(cells, gridSize) {
  let sx = 0, sy = 0;
  for (const { x, y } of cells) { sx += x; sy += y; }
  const cx = sx / cells.length / gridSize;
  const cy = sy / cells.length / gridSize;
  const ns = cy < 0.34 ? 'north' : cy > 0.66 ? 'south' : '';
  const ew = cx < 0.34 ? 'west' : cx > 0.66 ? 'east' : '';
  if (!ns && !ew) return 'Central';
  const name = ns && ew ? `${ns}${ew}` : (ns || ew);
  return name.charAt(0).toUpperCase() + name.slice(1) + 'ern';
}

// Broadcast lower-third narrating the election-night reveal while the map
// resolves behind it. Purely presentational; clicking skips to the verdict.
export default function RevealChyron({ step, clusters, swingPct, gridSize, onSkip }) {
  const n = clusters.length;

  let beat;
  if (step === 0) {
    beat = <>Polls closed. <strong>{n} undecided {n === 1 ? 'area' : 'areas'}</strong> reporting…</>;
  } else if (step <= n) {
    const c = clusters[step - 1];
    const total = c.bluePop + c.redPop;
    const bluePct = Math.round((c.bluePop / total) * 100);
    const winner = bluePct >= 50 ? 'blue' : 'red';
    const hi = Math.max(bluePct, 100 - bluePct);
    return (
      <button className="reveal-chyron" onClick={onSkip} title="Skip to the verdict">
        <span className="reveal-chyron__live">LIVE</span>
        <span key={step} className="reveal-chyron__beat">
          {regionName(c.cells, gridSize)} cluster breaks{' '}
          <strong style={{ color: PARTY[winner].color }}>{PARTY[winner].label}</strong>, {hi}–{100 - hi}
        </span>
        <span className="reveal-chyron__skip">tap to skip</span>
      </button>
    );
  } else {
    beat = swingPct !== 0
      ? <>National swing: <strong>{swingPct > 0 ? '+' : ''}{Math.round(swingPct * 10) / 10}%</strong> · Decision desk is calling it…</>
      : <>All precincts in. Decision desk is calling it…</>;
  }

  return (
    <button className="reveal-chyron" onClick={onSkip} title="Skip to the verdict">
      <span className="reveal-chyron__live">LIVE</span>
      <span key={String(step)} className="reveal-chyron__beat">{beat}</span>
      <span className="reveal-chyron__skip">tap to skip</span>
    </button>
  );
}
