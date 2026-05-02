import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import GameCanvasCounty from '../components/GameCanvasCounty'
import Controls from '../components/Controls'
import GameStats from '../components/GameStats'
import GameEndModal from '../components/GameEndModal'
import { generatePopulationMap } from '../utils/mapGenerator'
import { generateCounties, rebalanceCountyPopulations, getCountyCells } from '../utils/countyGenerator'
import { getChallengeById, checkChallengeCompletion } from '../utils/challenges'
import { calculateSeats, getSeatPercentage, allDistrictsAssigned, getDistrictStats, calculateEfficiencyGap, getPopulationPercentage, validateCountyPopulations } from '../utils/gameLogic'
import { calculateCompactness, calculateCompetitiveness, calculatePartisanAsymmetry } from '../utils/metrics'
import '../styles/App.css'

const DIFFICULTY_SETTINGS = {
  easy: { gridSize: 25, numDistricts: 4, maxDistricts: 10, targetSeats: 55, maxCounties: 100 },
  medium: { gridSize: 35, numDistricts: 6, maxDistricts: 16, targetSeats: 52, maxCounties: 200 },
  hard: { gridSize: 50, numDistricts: 8, maxDistricts: 24, targetSeats: 50, maxCounties: 300 }
};

export default function GameApp() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState('easy');
  const [gridSize, setGridSize] = useState(DIFFICULTY_SETTINGS.easy.gridSize);
  const [numDistricts, setNumDistricts] = useState(DIFFICULTY_SETTINGS.easy.numDistricts);
  const [numCounties, setNumCounties] = useState(DIFFICULTY_SETTINGS.easy.numDistricts * 5);
  const [numCities, setNumCities] = useState(4);
  const [bluePercentage, setBluePercentage] = useState(45);
  const [populationMap, setPopulationMap] = useState([]);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [currentDistrict, setCurrentDistrict] = useState(1);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [targetSeatPercentage, setTargetSeatPercentage] = useState(55);
  const [gameWon, setGameWon] = useState(false);
  const [highlightedDistrict, setHighlightedDistrict] = useState(null);
  const [showUnassignedCounties, setShowUnassignedCounties] = useState(false);
  const [showCurrentDistrict, setShowCurrentDistrict] = useState(true);
  const [gameComplete, setGameComplete] = useState(false);
  const [gameStats, setGameStats] = useState(null);

  useEffect(() => {
    generateNewGame();
  }, [gridSize, bluePercentage, numCities]);

  function areAllDistrictsValid() {
    if (!populationMap || districts.length === 0) return false;

    const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
    const densityMap = isNewFormat ? populationMap.density : null;
    const gridSize = isNewFormat ? populationMap.party.length : populationMap.length;

    let totalPopulation = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        totalPopulation += densityMap ? densityMap[y][x] : 1;
      }
    }

    const targetPopulation = totalPopulation / numDistricts;
    const minPopulation = Math.ceil(targetPopulation * 0.9);
    const maxPopulation = Math.ceil(targetPopulation * 1.1);

    for (let districtId = 1; districtId <= numDistricts; districtId++) {
      let districtPop = 0;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (districts[y][x] === districtId) {
            districtPop += densityMap ? densityMap[y][x] : 1;
          }
        }
      }
      if (districtPop < minPopulation || districtPop > maxPopulation) {
        return false;
      }
    }
    return true;
  }

  useEffect(() => {
    if (populationMap && populationMap.party && districts.length > 0 && allDistrictsAssigned(districts, numDistricts) && areAllDistrictsValid()) {
      const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
      const partyMap = isNewFormat ? populationMap.party : populationMap;
      const gridSize = isNewFormat ? populationMap.party.length : populationMap.length;

      const seats = calculateSeats(populationMap, districts, numDistricts);
      const blueSeats = getSeatPercentage(seats.blue, numDistricts);
      const popPercent = getPopulationPercentage(populationMap);
      const gap = calculateEfficiencyGap(populationMap, districts, numDistricts);
      const districtStats = getDistrictStats(populationMap, districts, numDistricts);
      const compactness = calculateCompactness(districts, numDistricts, gridSize);
      const competitiveness = calculateCompetitiveness(populationMap, districts, numDistricts);
      const asymmetry = calculatePartisanAsymmetry(populationMap, districts, numDistricts);

      const challenge = selectedChallenge ? getChallengeById(selectedChallenge) : null;

      let won = false;
      if (challenge) {
        won = checkChallengeCompletion(challenge, {
          blueSeats,
          gap: gap.gap,
          compactness: compactness.average,
          competitiveness: competitiveness.percentage
        });
      } else {
        won = blueSeats >= targetSeatPercentage;
      }

      setGameStats({
        blueSeats: Math.round(blueSeats * 10) / 10,
        redSeats: Math.round((100 - blueSeats) * 10) / 10,
        blueWins: seats.blue,
        redWins: seats.red,
        totalDistricts: numDistricts,
        won,
        allStats: {
          bluePopPercent: Math.round(popPercent * 10) / 10,
          redPopPercent: Math.round((100 - popPercent) * 10) / 10,
          efficiencyGap: Math.round(gap.gap * 10) / 10,
          blueWasted: gap.blueWasted,
          redWasted: gap.redWasted,
          compactness: Math.round(compactness.average * 100),
          competitiveness: Math.round(competitiveness.percentage * 10) / 10,
          competitiveCount: competitiveness.competitive,
          asymmetry: Math.round(asymmetry.asymmetry * 10) / 10,
          districtBreakdown: districtStats.map(d => ({
            id: d.id,
            blue: d.blue,
            red: d.red,
            total: d.total
          }))
        }
      });
      setGameComplete(true);
    }
  }, [districts, numDistricts, targetSeatPercentage, selectedChallenge, populationMap]);

  function generateNewGame() {
    const pop = generatePopulationMap(gridSize, bluePercentage, numCities);
    setPopulationMap(pop);

    let counties_ = generateCounties(gridSize, numCounties);
    counties_ = rebalanceCountyPopulations(pop, counties_, numCounties, 10);
    setCounties(counties_);

    const dists = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    setDistricts(dists);
    setCurrentDistrict(1);
    setGameWon(false);
  }

  function handleDifficultyChange(newDifficulty) {
    const settings = DIFFICULTY_SETTINGS[newDifficulty];
    setDifficulty(newDifficulty);
    setGridSize(settings.gridSize);
    setNumDistricts(settings.numDistricts);
    setNumCounties(settings.numDistricts * 5);
    setTargetSeatPercentage(settings.targetSeats);
    setNumCities(4);
    setSelectedChallenge(null);
  }

  function handleChallengeSelect(challengeId) {
    if (selectedChallenge === challengeId) {
      setSelectedChallenge(null);
      generateNewGame();
    } else {
      const challenge = getChallengeById(challengeId);
      if (challenge) {
        const config = challenge.config;
        setSelectedChallenge(challengeId);
        setNumCounties(config.numCounties);
        setBluePercentage(config.bluePercentage);
        setNumDistricts(config.numDistricts);
        setTargetSeatPercentage(config.targetSeatPercentage);
        setGridSize(35); // Challenge default size
        setNumCities(4);

        const pop = generatePopulationMap(35, config.bluePercentage, 4);
        setPopulationMap(pop);

        let counties_ = generateCounties(35, config.numCounties);
        counties_ = rebalanceCountyPopulations(pop, counties_, config.numCounties, 10);
        setCounties(counties_);

        const dists = Array(35).fill(null).map(() => Array(35).fill(0));
        setDistricts(dists);
        setCurrentDistrict(1);
        setGameWon(false);
      }
    }
  }

  function handleCountiesChange(value) {
    setNumCounties(value);
  }

  function handleNumCitiesChange(value) {
    setNumCities(value);
  }

  function handleBluePercentageChange(value) {
    setBluePercentage(value);
  }

  function handleDistrictsChange(value) {
    setNumDistricts(value);
  }

  function handleDistrictSelect(districtId) {
    setCurrentDistrict(districtId);
  }

  function handleCountyClick(countyId) {
    if (currentDistrict === 0) return;

    const newDistricts = districts.map(row => [...row]);
    const countyCells = getCountyCells(counties, countyId);

    const isNewFormat = populationMap && typeof populationMap === 'object' && !Array.isArray(populationMap) && populationMap.party;
    const densityMap = isNewFormat ? populationMap.density : null;

    const isAlreadyAssigned = countyCells.some(({ x, y }) => newDistricts[y][x] === currentDistrict);

    if (isAlreadyAssigned) {
      for (const { x, y } of countyCells) {
        if (newDistricts[y][x] === currentDistrict) {
          newDistricts[y][x] = 0;
        }
      }
    } else {
      let currentPopulation = 0;
      for (let y = 0; y < newDistricts.length; y++) {
        for (let x = 0; x < newDistricts[y].length; x++) {
          if (newDistricts[y][x] === currentDistrict) {
            currentPopulation += densityMap ? densityMap[y][x] : 1;
          }
        }
      }

      let countyPopulation = 0;
      for (const { x, y } of countyCells) {
        countyPopulation += densityMap ? densityMap[y][x] : 1;
      }

      const totalPopulation = currentPopulation + countyPopulation;

      const totalPop = isNewFormat ?
        (() => {
          let sum = 0;
          for (let y = 0; y < densityMap.length; y++) {
            for (let x = 0; x < densityMap[y].length; x++) {
              sum += densityMap[y][x];
            }
          }
          return sum;
        })() :
        gridSize * gridSize;

      const targetPopulation = totalPop / numDistricts;
      const minPopulation = Math.ceil(targetPopulation * 0.9);
      const maxPopulation = Math.ceil(targetPopulation * 1.1);

      if (totalPopulation <= maxPopulation && isCountyAdjacentToDistrict(newDistricts, counties, countyId, currentDistrict)) {
        for (const { x, y } of countyCells) {
          newDistricts[y][x] = currentDistrict;
        }
      }
    }

    setDistricts(newDistricts);
  }

  function handleGenerateMap() {
    generateNewGame();
  }

  function handleTryAgain() {
    setGameComplete(false);
    setGameStats(null);
    setHighlightedDistrict(null);
    setShowUnassignedCounties(false);
    generateNewGame();
  }

  function handleCloseEndModal() {
    setGameComplete(false);
  }

  function getCountyCells(counties, countyId) {
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

  function isCountyAdjacentToDistrict(dists, counties, countyId, districtId) {
    let hasAdjacent = false;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (let y = 0; y < counties.length; y++) {
      for (let x = 0; x < counties[y].length; x++) {
        if (counties[y][x] === countyId) {
          if (dists[y][x] === districtId) {
            return true;
          }

          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < counties[y].length &&
              ny >= 0 && ny < counties.length &&
              dists[ny][nx] === districtId) {
              hasAdjacent = true;
            }
          }
        }
      }
    }

    let districtHasCells = false;
    for (let y = 0; y < dists.length; y++) {
      for (let x = 0; x < dists[y].length; x++) {
        if (dists[y][x] === districtId) {
          districtHasCells = true;
          break;
        }
      }
      if (districtHasCells) break;
    }

    return !districtHasCells || hasAdjacent;
  }

  return (
    <div className="app">
      {gameComplete && gameStats && (
        <GameEndModal
          stats={gameStats}
          challenge={selectedChallenge ? getChallengeById(selectedChallenge) : null}
          onTryAgain={handleTryAgain}
          onClose={handleCloseEndModal}
        />
      )}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.5rem',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← Back
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1>Zeromander</h1>
            <p>Master the art of electoral redistricting</p>
          </div>
        </div>
      </header>

      <div className="app-container">
        <Controls
          difficulty={difficulty}
          onDifficultyChange={handleDifficultyChange}
          numCounties={numCounties}
          onCountiesChange={handleCountiesChange}
          numCities={numCities}
          onNumCitiesChange={handleNumCitiesChange}
          bluePercentage={bluePercentage}
          onBluePercentageChange={handleBluePercentageChange}
          numDistricts={numDistricts}
          onDistrictsChange={handleDistrictsChange}
          maxDistricts={DIFFICULTY_SETTINGS[difficulty].maxDistricts}
          currentDistrict={currentDistrict}
          onDistrictSelect={handleDistrictSelect}
          selectedChallenge={selectedChallenge}
          onChallengeSelect={handleChallengeSelect}
          onResetGame={handleGenerateMap}
        />

        <div className="game-main" style={{ flexDirection: 'column', display: 'flex' }}>
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '1rem',
            backgroundColor: '#F9FAFB',
            borderBottom: '1px solid #E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              flex: '1 1 100%'
            }}>
              {Array.from({ length: numDistricts }).map((_, i) => {
                const districtId = i + 1;
                return (
                  <button
                    key={districtId}
                    onClick={() => handleDistrictSelect(districtId)}
                    style={{
                      padding: '0.625rem 0.75rem',
                      border: currentDistrict === districtId ? '2px solid #663399' : '2px solid #E5E7EB',
                      background: currentDistrict === districtId ? '#663399' : 'white',
                      color: currentDistrict === districtId ? 'white' : '#6B7280',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      minWidth: '2.5rem',
                      textAlign: 'center'
                    }}
                  >
                    D{districtId}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowCurrentDistrict(!showCurrentDistrict)}
              style={{
                padding: '0.625rem 1rem',
                border: '2px solid #E5E7EB',
                background: showCurrentDistrict ? '#663399' : 'white',
                color: showCurrentDistrict ? 'white' : '#6B7280',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              title={showCurrentDistrict ? 'Hide current district' : 'Show current district'}
            >
              {showCurrentDistrict ? '👁️ Visible' : '👁️‍🗨️ Hidden'}
            </button>
          </div>
          {(populationMap.party || populationMap.length > 0) && (
            <GameCanvasCounty
              populationMap={populationMap}
              counties={counties}
              districts={districts}
              currentDistrict={currentDistrict}
              onCountyClick={handleCountyClick}
              highlightedDistrict={highlightedDistrict}
              showUnassignedCounties={showUnassignedCounties}
              showDistricts={showCurrentDistrict}
            />
          )}
        </div>

        {(populationMap.party || populationMap.length > 0) && (
          <GameStats
            populationMap={populationMap}
            districts={districts}
            numDistricts={numDistricts}
            currentDistrict={currentDistrict}
            targetSeatPercentage={targetSeatPercentage}
            selectedChallenge={selectedChallenge}
            gameWon={gameWon}
            onDistrictSelect={setHighlightedDistrict}
            onToggleUnassigned={() => setShowUnassignedCounties(!showUnassignedCounties)}
            showUnassignedCounties={showUnassignedCounties}
          />
        )}
      </div>
    </div>
  );
}
