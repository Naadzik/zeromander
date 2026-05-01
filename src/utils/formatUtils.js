export function extractPopulationData(populationMap) {
  const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
  const partyMap = isNewFormat ? populationMap.party : populationMap;
  const densityMap = isNewFormat ? populationMap.density : null;
  return { isNewFormat, partyMap, densityMap };
}

export function getGridSize(populationMap) {
  const { partyMap } = extractPopulationData(populationMap);
  return partyMap ? partyMap.length : 0;
}

export function getCellPopulation(densityMap, y, x) {
  return densityMap ? densityMap[y][x] : 1;
}

export function getDistrictVotes(partyMap, densityMap, districts, districtId) {
  let blueVotes = 0, redVotes = 0;

  for (let y = 0; y < partyMap.length; y++) {
    for (let x = 0; x < partyMap[y].length; x++) {
      if (districts[y][x] === districtId) {
        const population = densityMap ? densityMap[y][x] : 1;
        if (partyMap[y][x] === 0) blueVotes += population;
        else redVotes += population;
      }
    }
  }

  return { blueVotes, redVotes };
}
