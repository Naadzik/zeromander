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

export function forEachCell(grid, fn) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      fn(grid[y][x], x, y);
    }
  }
}

export function totalPopulation(populationMap) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  let total = 0;
  forEachCell(partyMap, (_, x, y) => {
    total += getCellPopulation(densityMap, y, x);
  });
  return total;
}

// Party cell values: 0 = blue, 1 = red, 2 = green (green only on 3-party maps).
export function getDistrictVotes(partyMap, densityMap, districts, districtId) {
  const votes = { blue: 0, red: 0, green: 0 };
  forEachCell(partyMap, (party, x, y) => {
    if (districts[y][x] === districtId) {
      const population = getCellPopulation(densityMap, y, x);
      if (party === 0) votes.blue += population;
      else if (party === 1) votes.red += population;
      else votes.green += population;
    }
  });
  return votes;
}
