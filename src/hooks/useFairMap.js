import { useState, useEffect, useRef } from 'react';
import { generateNeutralEnsemble } from '../utils/neutralEnsemble';
import { computeCoreStats } from '../utils/computeGameStats';
import { randomSeed } from '../utils/rng';

// The party-blind baseline for a board — v2: a deterministic 25-map
// mini-ensemble (utils/neutralEnsemble.js) instead of a single draw. The hook
// exposes the same shape consumers always had, which is the point:
//
//   fairDistricts — the GHOST map drawn on screen: the lowest-seed ensemble
//                   member whose seat count equals the ensemble MEDIAN, so
//                   the displayed map always shows the number the score is
//                   measured against.
//   fairStats     — computeCoreStats of that ghost map, plus `.ensemble`
//                   ({median, min, max, n, histogram}) for the surfaces that
//                   want the range. fairStats.ourSeatCount === median by
//                   construction, so every existing consumer — "seats
//                   stolen", the v2 target, share text, litigation anchors —
//                   became median-anchored without changing.
//
// `seed`: the ensemble BASE seed (fairSeedFrom(boardSeed)), pinned to the
// board everywhere so all players score against the identical baseline.
// Sandbox omits it and gets a random base.
//
// The generation runs in a Web Worker (25 maps ≈ 0.3–1.4s; worse on phones);
// the daily kicks it off eagerly at board load so it's long done before
// lock-in. Falls back to a synchronous run if Worker construction fails.
export function useFairMap({ populationMap, counties, numDistricts, gridSize, playerParty, isThreeParty, enabled, seed }) {
  const [fairDistricts, setFairDistricts] = useState(null);
  const [fairStats, setFairStats] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const workerRef = useRef(null);
  // Monotonic job id: a result is applied only if it answers the LATEST job,
  // so a board regenerated mid-flight can't install a stale baseline.
  const jobRef = useRef(0);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || !counties.length || !populationMap.party) {
      setFairDistricts(null);
      setFairStats(null);
      return;
    }

    setIsComputing(true);
    const jobId = ++jobRef.current;
    const baseSeed = typeof seed === 'number' ? seed : randomSeed();

    const apply = (result) => {
      if (jobId !== jobRef.current) return; // stale board
      const core = computeCoreStats(populationMap, result.ghostDistricts, numDistricts, playerParty, isThreeParty, counties);
      core.ensemble = {
        median: result.median,
        min: result.min,
        max: result.max,
        n: result.n,
        histogram: result.histogram,
      };
      setFairDistricts(result.ghostDistricts);
      setFairStats(core);
      setIsComputing(false);
    };

    const runSync = () => {
      apply(generateNeutralEnsemble(populationMap, counties, numDistricts, gridSize, baseSeed, playerParty, isThreeParty));
    };

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('../workers/ensembleWorker.js', import.meta.url), { type: 'module' });
      }
      workerRef.current.onmessage = (e) => {
        if (e.data.jobId !== jobRef.current) return;
        apply(e.data.result);
      };
      workerRef.current.onerror = () => {
        workerRef.current?.terminate();
        workerRef.current = null;
        runSync();
      };
      workerRef.current.postMessage({ jobId, populationMap, counties, numDistricts, gridSize, baseSeed, playerParty, isThreeParty });
    } catch {
      runSync();
    }
  }, [enabled, populationMap, counties, numDistricts, gridSize, playerParty, isThreeParty, seed]);

  return { fairDistricts, fairStats, isComputing };
}
