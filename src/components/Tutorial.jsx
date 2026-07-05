import { useState } from 'react'

const STEPS = [
  {
    title: 'Welcome to Zeromander',
    body: 'You\'re about to draw electoral districts. Your goal: get your party more seats by deciding which counties go into which district. Let\'s walk through the controls.'
  },
  {
    title: 'Step 1 — Pick a district',
    body: 'Use the D1, D2, D3 … buttons above the map to choose which district you\'re currently drawing into.'
  },
  {
    title: 'Step 2 — Click or drag counties',
    body: 'Click a county on the map to add it to the selected district. Drag across multiple counties to paint them in one stroke. Click an assigned county to remove it. Districts must stay contiguous.'
  },
  {
    title: 'Step 3 — Watch the stats',
    body: 'The right panel updates live — your seats, efficiency gap, compactness. Hover the (?) icon on any metric to learn what it means.'
  },
  {
    title: 'Step 4 — Win the round',
    body: 'Once every county is assigned and each district\'s population is within ±10% of the target, you win if your seat share beats the target. Good luck, cartographer.'
  }
];

export const STEPS_3PARTY = [
  {
    title: '3rd Party Mode',
    body: 'A third party has entered the race — the Farmers Coalition (green). The map now has three kinds of territory: blue city cores, green rural towns, and red open countryside.'
  },
  {
    title: 'Choose your party',
    body: 'Use the party buttons above the map to pick which party you\'re playing for. Each has a natural geographic base — cities for blue, towns for green, rural areas for red.'
  },
  {
    title: 'Three-way districts',
    body: 'Each district is won by plurality — the party with the most votes wins it, even without a majority. A district split 40 / 35 / 25 goes to blue. Concentrate your voters or spread the opposition thin.'
  },
  {
    title: 'Win condition',
    body: 'You win when your seat share exceeds your population share. If your party has 30% of voters but wins 40% of seats, that\'s a gerrymander — and a victory.'
  },
  {
    title: 'Map controls',
    body: 'Use the Cities and Towns sliders to shape the geography. More cities push blue outward; more towns create green clusters in the countryside. Try playing as each party for a different puzzle.'
  }
];

export default function Tutorial({ onClose, steps = STEPS }) {
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <div className="tutorial-overlay" onClick={onClose}>
      <div className="tutorial-card" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-progress">
          {steps.map((_, i) => (
            <span key={i} className={`tutorial-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="tutorial-actions">
          <button className="btn-skip" onClick={onClose}>Skip</button>
          {step > 0 && (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>Back</button>
          )}
          {isLast ? (
            <button className="btn-primary" onClick={onClose}>Start playing</button>
          ) : (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}
