import { useState } from 'react';

const DEFAULT_CONSTRAINTS = {
  populationDeviation: { enabled: false, mode: 'hard', thresholdPct: 5 },
  contiguity: { enabled: true, mode: 'hard' }
};

export function useLegalConstraints() {
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);

  function setPopDeviationEnabled(enabled) {
    setConstraints(c => ({ ...c, populationDeviation: { ...c.populationDeviation, enabled } }));
  }

  function setPopDeviationMode(mode) {
    setConstraints(c => ({ ...c, populationDeviation: { ...c.populationDeviation, mode } }));
  }

  function setPopDeviationThreshold(thresholdPct) {
    setConstraints(c => ({ ...c, populationDeviation: { ...c.populationDeviation, thresholdPct } }));
  }

  return { constraints, setPopDeviationEnabled, setPopDeviationMode, setPopDeviationThreshold };
}
