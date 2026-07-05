import { extractPopulationData, forEachCell, getCellPopulation, totalPopulation } from './formatUtils.js';

// Shared by the real-time draw cap (base 10%, or a stricter hard-mode threshold)
// and the end-of-game constraint check (any configured thresholdPct).
export function computePopulationDeviation(populationMap, districts, numDistricts, thresholdPct) {
  const { densityMap } = extractPopulationData(populationMap);
  const target = totalPopulation(populationMap) / numDistricts;
  const minPop = Math.ceil(target * (1 - thresholdPct / 100));
  const maxPop = Math.ceil(target * (1 + thresholdPct / 100));

  const districtPops = new Array(numDistricts + 1).fill(0);
  forEachCell(districts, (districtId, x, y) => {
    if (districtId > 0) districtPops[districtId] += getCellPopulation(densityMap, y, x);
  });

  let worstDeviationPct = 0;
  let pass = true;
  for (let districtId = 1; districtId <= numDistricts; districtId++) {
    const pop = districtPops[districtId];
    if (pop < minPop || pop > maxPop) pass = false;
    const deviationPct = target > 0 ? Math.abs(pop - target) / target * 100 : 0;
    if (deviationPct > worstDeviationPct) worstDeviationPct = deviationPct;
  }

  return { pass, worstDeviationPct: Math.round(worstDeviationPct * 10) / 10, minPop, maxPop };
}

// Contiguity is enforced structurally by isCountyAdjacentToDistrict at draw time
// (see useMapState.applyCountyAction) — this just reports it for the live panel,
// it can never actually fail.
export function checkConstraintViolations(populationMap, districts, numDistricts, constraints) {
  const results = {
    contiguity: { enabled: constraints?.contiguity?.enabled ?? true, mode: 'hard', pass: true }
  };

  const pop = constraints?.populationDeviation;
  if (pop?.enabled) {
    const { pass, worstDeviationPct } = computePopulationDeviation(populationMap, districts, numDistricts, pop.thresholdPct);
    results.populationDeviation = { enabled: true, mode: pop.mode, pass, worstDeviationPct, thresholdPct: pop.thresholdPct };
  }

  return results;
}
