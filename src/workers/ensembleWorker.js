import { generateNeutralEnsemble } from '../utils/neutralEnsemble.js';

// Web Worker shell around the (pure, deterministic) neutral-ensemble
// generator. 25 fair maps take ~0.3s (small tier) to ~1.4s (full) in Node and
// worse on mid-range phones — off the main thread the cost is invisible: the
// daily kicks the job off eagerly at board load and the player needs minutes
// to draw. `jobId` is echoed back so a stale result (board regenerated while
// a job was in flight) can be ignored by the caller.
self.onmessage = (e) => {
  const { jobId, populationMap, counties, numDistricts, gridSize, baseSeed, playerParty, isThreeParty } = e.data;
  const result = generateNeutralEnsemble(populationMap, counties, numDistricts, gridSize, baseSeed, playerParty, isThreeParty);
  self.postMessage({ jobId, result });
};
