import { extractPopulationData, getCellPopulation } from './formatUtils.js';

// Community-of-interest representation (the VRA layer). Party-independent:
// measures whether the community can elect candidates of its choice — how many
// districts it forms an effective majority of (an "opportunity district"),
// versus its fair proportional share. Both failure modes dilute its voice:
//   • CRACKED — spread thin, a majority in no/too-few districts.
//   • PACKED  — crammed into fewer districts than fair, wasting its numbers.
// Returns null when the board has no community overlay.
export function communityRepresentation(populationMap, districts, numDistricts) {
  const { densityMap, communityMap } = extractPopulationData(populationMap);
  if (!communityMap || !districts) return null;
  const G = communityMap.length;

  const distComm = new Array(numDistricts + 1).fill(0);
  const distTotal = new Array(numDistricts + 1).fill(0);
  let communityPop = 0, totalPop = 0;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const pop = getCellPopulation(densityMap, y, x);
      totalPop += pop;
      if (communityMap[y][x]) communityPop += pop;
      const d = districts[y]?.[x] ?? 0;
      if (d >= 1 && d <= numDistricts) {
        distTotal[d] += pop;
        if (communityMap[y][x]) distComm[d] += pop;
      }
    }
  }

  let opportunityDistricts = 0, maxConcentration = 0;
  for (let d = 1; d <= numDistricts; d++) {
    if (distTotal[d] === 0) continue;
    const conc = distComm[d] / distTotal[d];
    // STRICT majority (> 0.5): the Bartlett v. Strickland (2009) threshold —
    // a community at exactly half cannot elect on its own votes. (Courts use
    // citizen voting-age population; here everyone votes, so population
    // stands in for CVAP — a disclosed simplification.)
    if (conc > 0.5) opportunityDistricts++;
    maxConcentration = Math.max(maxConcentration, conc);
  }

  const share = totalPop > 0 ? communityPop / totalPop : 0;
  const fairShare = Math.round(share * numDistricts);
  // 0 = fully represented, 1 = fully denied (feeds the litigation-risk score).
  const dilution = fairShare > 0 ? Math.min(1, Math.max(0, (fairShare - opportunityDistricts) / fairShare)) : 0;
  const status = opportunityDistricts >= fairShare ? 'fair'
    : maxConcentration >= 0.70 ? 'packed'
      : 'cracked';

  // maxConcentration feeds the Shaw/Cooper over-packing channel: using the
  // community far beyond a majority is also illegal (strict scrutiny).
  return { opportunityDistricts, fairShare, sharePct: Math.round(share * 100), status, dilution, maxConcentration };
}
