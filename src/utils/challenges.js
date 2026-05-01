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
