export const CHALLENGES = {
  FAIR_REPRESENTATION: 'fair_representation',
  EXTREME_PACKING: 'extreme_packing',
  CRACKERS_PROBLEM: 'crackers_problem',
  COMPACT_DISTRICTS: 'compact_districts',
  BALANCE_ACT: 'balance_act',
  LANDSLIDE_VICTORY: 'landslide_victory'
};

const challengeDefinitions = {
  [CHALLENGES.FAIR_REPRESENTATION]: {
    name: 'Fair Representation',
    description: 'Achieve an efficiency gap < 5%',
    icon: '⚖️',
    rules: 'Create districts that minimize wasted votes. The efficiency gap measures how unfairly votes are distributed between parties. A gap below 5% indicates fair representation for both Urban Union and Heartland Alliance.',
    config: {
      numCounties: 12,
      bluePercentage: 50,
      numDistricts: 6,
      targetSeatPercentage: 50
    },
    goal: (stats) => stats.gap < 5,
    goalDescription: 'Efficiency Gap < 5%'
  },
  [CHALLENGES.EXTREME_PACKING]: {
    name: 'Extreme Packing',
    description: 'Win 60% of seats with only 40% of population',
    icon: '📦',
    rules: 'Demonstrate the power of gerrymandering by "packing" opponents into a few districts while winning the rest. Urban Union has only 40% of the population but you must secure 60% of the seats.',
    config: {
      numCounties: 15,
      bluePercentage: 40,
      numDistricts: 6,
      targetSeatPercentage: 60
    },
    goal: (stats) => stats.blueSeats >= 60,
    goalDescription: '60% Seats from 40% Population'
  },
  [CHALLENGES.CRACKERS_PROBLEM]: {
    name: 'Cracker\'s Problem',
    description: 'Win only 35% of seats with 35% population (without cheating)',
    icon: '🍘',
    rules: 'Urban Union has 35% of the population but is heavily diluted across districts. Create a fair map where both parties get seats proportional to their voting strength, not by advantage. Hold Urban Union to 35% of seats.',
    config: {
      numCounties: 14,
      bluePercentage: 35,
      numDistricts: 6,
      targetSeatPercentage: 35
    },
    goal: (stats) => stats.blueSeats <= 35.5,
    goalDescription: '35% Seats from 35% Population'
  },
  [CHALLENGES.COMPACT_DISTRICTS]: {
    name: 'Compact Districts',
    description: 'Achieve average compactness > 0.5',
    icon: '⭕',
    rules: 'Create districts that are as geometrically compact as possible. Avoid bizarre shapes and long tentacles that indicate gerrymandering. Round, contiguous districts are fairer and more representative of communities.',
    config: {
      numCounties: 12,
      bluePercentage: 50,
      numDistricts: 6,
      targetSeatPercentage: 50
    },
    goal: (stats) => stats.compactness > 0.5,
    goalDescription: 'Avg Compactness > 0.5'
  },
  [CHALLENGES.BALANCE_ACT]: {
    name: 'Balance Act',
    description: 'Win 50% seats AND keep efficiency gap < 3%',
    icon: '⚡',
    rules: 'Achieve both proportional representation and fair vote efficiency. Urban Union should win 50% of seats while maintaining an extremely low efficiency gap (< 3%), ensuring minimal wasted votes.',
    config: {
      numCounties: 12,
      bluePercentage: 50,
      numDistricts: 6,
      targetSeatPercentage: 50
    },
    goal: (stats) => stats.blueSeats >= 50 && stats.gap < 3,
    goalDescription: '50% Seats + Gap < 3%'
  },
  [CHALLENGES.LANDSLIDE_VICTORY]: {
    name: 'Landslide Victory',
    description: 'Secure 75% of seats (with 60% population)',
    icon: '🏆',
    rules: 'Urban Union has 60% of the population—use this advantage to dominate the map. Win 75% of the seats by strategically placing Urban Union voters to control as many districts as possible.',
    config: {
      numCounties: 16,
      bluePercentage: 60,
      numDistricts: 6,
      targetSeatPercentage: 75
    },
    goal: (stats) => stats.blueSeats >= 75,
    goalDescription: '75% Seats'
  }
};

export function getChallengeById(id) {
  return challengeDefinitions[id] || null;
}

export function getAllChallenges() {
  return Object.entries(challengeDefinitions).map(([id, challenge]) => ({
    id,
    ...challenge
  }));
}

export function checkChallengeCompletion(challenge, stats) {
  if (!challenge) return false;
  return challenge.goal(stats);
}
