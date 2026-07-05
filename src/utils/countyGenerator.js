export function generateCounties(gridSize, numCounties, rng = Math.random) {
  const counties = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));

  const seeds = [];
  for (let i = 1; i <= numCounties; i++) {
    seeds.push({
      id: i,
      x: rng() * gridSize,
      y: rng() * gridSize
    });
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let nearest = seeds[0];
      let minDist = Infinity;

      for (const seed of seeds) {
        const dx = x - seed.x;
        const dy = y - seed.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearest = seed;
        }
      }

      counties[y][x] = nearest.id;
    }
  }

  let changed = true;
  const MIN_SIZE = 4;
  const maxIterations = 100;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    const visited = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    const components = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!visited[y][x]) {
          const component = floodFill(counties, visited, x, y, gridSize);
          if (component.length > 0) {
            components.push(component);
          }
        }
      }
    }

    for (const component of components) {
      if (component.length < MIN_SIZE) {
        changed = true;
        const adjacentCounties = findAdjacentCounties(counties, component, gridSize);
        if (adjacentCounties.length > 0) {
          const targetCounty = adjacentCounties.reduce((a, b) =>
            countCountyCells(counties, b) > countCountyCells(counties, a) ? b : a
          );
          for (const { x, y } of component) {
            counties[y][x] = targetCounty;
          }
        }
      }
    }
  }

  return counties;
}

function floodFill(counties, visited, startX, startY, gridSize) {
  const component = [];
  const stack = [{ x: startX, y: startY }];
  const countyId = counties[startY][startX];

  while (stack.length > 0) {
    const { x, y } = stack.pop();

    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
    if (visited[y][x] || counties[y][x] !== countyId) continue;

    visited[y][x] = true;
    component.push({ x, y });

    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }

  return component;
}

function findAdjacentCounties(counties, component, gridSize) {
  const adjacent = new Set();
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const { x, y } of component) {
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        const neighborCounty = counties[ny][nx];
        if (neighborCounty !== counties[y][x]) {
          adjacent.add(neighborCounty);
        }
      }
    }
  }

  return Array.from(adjacent);
}

function countCountyCells(counties, countyId) {
  let count = 0;
  for (let y = 0; y < counties.length; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      if (counties[y][x] === countyId) count++;
    }
  }
  return count;
}

export function getCountyCells(counties, countyId) {
  const cells = [];
  for (let y = 0; y < counties.length; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      if (counties[y][x] === countyId) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export function getAllCounties(counties) {
  const countyIds = new Set();
  for (let y = 0; y < counties.length; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      if (counties[y][x] > 0) {
        countyIds.add(counties[y][x]);
      }
    }
  }
  return Array.from(countyIds).sort((a, b) => a - b);
}

import { extractPopulationData } from './formatUtils.js';

export function getCountyPopulation(populationMap, counties, countyId) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);

  let blue = 0, red = 0;
  for (let y = 0; y < counties.length; y++) {
    for (let x = 0; x < counties[y].length; x++) {
      if (counties[y][x] === countyId) {
        const population = densityMap ? densityMap[y][x] : 1;
        if (partyMap[y][x] === 0) blue += population;
        else red += population;
      }
    }
  }
  return { blue, red, total: blue + red };
}

export function rebalanceCountyPopulations(populationMap, counties, numCounties, maxAttempts = 10, rng = Math.random) {
  const { partyMap, densityMap } = extractPopulationData(populationMap);
  const gridSize = counties.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let totalPopulation = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const pop = densityMap ? densityMap[y][x] : 1;
        totalPopulation += pop;
      }
    }

    const fairShare = totalPopulation / numCounties;
    const minPop = Math.ceil(fairShare * 0.75);
    const maxPop = Math.ceil(fairShare * 1.25);

    const countyPops = {};
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const countyId = counties[y][x];
        if (countyId > 0) {
          const pop = densityMap ? densityMap[y][x] : 1;
          countyPops[countyId] = (countyPops[countyId] || 0) + pop;
        }
      }
    }

    let allValid = true;
    const violations = [];
    for (const countyId in countyPops) {
      const pop = countyPops[countyId];
      if (pop < minPop || pop > maxPop) {
        allValid = false;
        violations.push(parseInt(countyId));
      }
    }

    if (allValid) {
      return counties;
    }

    if (attempt < maxAttempts - 1) {
      const rebalanced = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
      const seeds = [];
      for (let i = 1; i <= numCounties; i++) {
        const oldCells = [];
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            if (counties[y][x] === i) {
              oldCells.push({ x, y });
            }
          }
        }
        if (oldCells.length > 0) {
          const center = oldCells[Math.floor(rng() * oldCells.length)];
          seeds.push({ id: i, x: center.x, y: center.y });
        } else {
          seeds.push({ id: i, x: rng() * gridSize, y: rng() * gridSize });
        }
      }

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          let nearest = seeds[0];
          let minDist = Infinity;

          for (const seed of seeds) {
            const dx = x - seed.x;
            const dy = y - seed.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
              minDist = dist;
              nearest = seed;
            }
          }

          rebalanced[y][x] = nearest.id;
        }
      }

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          counties[y][x] = rebalanced[y][x];
        }
      }
    }
  }

  return counties;
}
