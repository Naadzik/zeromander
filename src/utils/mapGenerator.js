export function generatePopulationMap(gridSize, bluePercentage, numCities = 4) {
  const partyMap = [];
  const densityMap = [];

  const citySeeds = [];

  for (let i = 0; i < numCities; i++) {
    citySeeds.push({
      x: Math.random() * gridSize,
      y: Math.random() * gridSize,
      radius: 3 + Math.random() * 4
    });
  }

  for (let y = 0; y < gridSize; y++) {
    partyMap[y] = [];
    densityMap[y] = [];

    for (let x = 0; x < gridSize; x++) {
      let distToCity = Infinity;
      for (const city of citySeeds) {
        const dx = x - city.x;
        const dy = y - city.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        distToCity = Math.min(distToCity, dist);
      }

      const isCity = distToCity < 8;

      if (isCity) {
        partyMap[y][x] = 0;
      } else {
        partyMap[y][x] = 1;
      }
    }
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let distToCity = Infinity;

      for (const city of citySeeds) {
        const dx = x - city.x;
        const dy = y - city.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        distToCity = Math.min(distToCity, dist);
      }

      const isCity = distToCity < 8;
      const party = partyMap[y][x];

      if (isCity) {
        if (party === 0) {
          if (distToCity < 3) {
            densityMap[y][x] = 15 + Math.floor(Math.random() * 6);
          } else if (distToCity < 5) {
            densityMap[y][x] = 10 + Math.floor(Math.random() * 6);
          } else {
            densityMap[y][x] = 5 + Math.floor(Math.random() * 6);
          }
        } else {
          densityMap[y][x] = 1 + Math.floor(Math.random() * 3);
        }
      } else {
        densityMap[y][x] = 1 + Math.floor(Math.random() * 5);
      }
    }
  }

  let totalBlue = 0;
  let totalRed = 0;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const density = densityMap[y][x];
      if (partyMap[y][x] === 0) {
        totalBlue += density;
      } else {
        totalRed += density;
      }
    }
  }

  const totalPopulation = totalBlue + totalRed;
  const targetBlue = Math.round(totalPopulation * bluePercentage / 100);
  let currentBlue = totalBlue;

  if (currentBlue !== targetBlue) {
    const cells = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        cells.push({ x, y });
      }
    }

    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    if (currentBlue < targetBlue) {
      const deficit = targetBlue - currentBlue;
      let added = 0;

      for (let i = 0; i < cells.length && added < deficit; i++) {
        const { x, y } = cells[i];
        if (partyMap[y][x] === 1) {
          partyMap[y][x] = 0;
          added += densityMap[y][x];
        }
      }
    } else if (currentBlue > targetBlue) {
      const excess = currentBlue - targetBlue;
      let removed = 0;

      for (let i = 0; i < cells.length && removed < excess; i++) {
        const { x, y } = cells[i];
        if (partyMap[y][x] === 0) {
          partyMap[y][x] = 1;
          removed += densityMap[y][x];
        }
      }
    }
  }

  return {
    party: partyMap,
    density: densityMap
  };
}

export function countPopulation(populationMap) {
  if (Array.isArray(populationMap)) {
    let blue = 0, red = 0;
    for (let y = 0; y < populationMap.length; y++) {
      for (let x = 0; x < populationMap[y].length; x++) {
        if (populationMap[y][x] === 0) blue++;
        else red++;
      }
    }
    return { blue, red, total: blue + red };
  }

  const { party, density } = populationMap;
  let blue = 0, red = 0;

  for (let y = 0; y < party.length; y++) {
    for (let x = 0; x < party[y].length; x++) {
      const pop = density[y][x];
      if (party[y][x] === 0) {
        blue += pop;
      } else {
        red += pop;
      }
    }
  }

  return { blue, red, total: blue + red };
}
