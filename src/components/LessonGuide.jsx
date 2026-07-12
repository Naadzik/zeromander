import { useState, useEffect } from 'react'
import '../styles/LessonGuide.css'

// The "First Heist": a docked, step-by-step coach on a fixed 3-district board.
// Steps auto-advance when the player actually pulls off the move (goal
// detection via `signals`), with a manual Next so nobody gets stuck.
const STEPS = [
  {
    title: 'The 60-second heist',
    body: 'This is Heartland country — they have 60% of the vote. You are Urban Union, stuck at 40%. Watch: you are going to win a majority of the seats anyway. Three districts. Follow along.',
  },
  {
    title: 'Step 1 — PACK',
    body: 'Select District 1 and paint it over the red countryside. Cram as many Heartland voters as you can into one district they win in a landslide. Every vote past 50% there is a wasted vote.',
    done: s => s.packedRed,
  },
  {
    title: 'Step 2 — CRACK',
    body: 'Two districts left. Carve the blue neighborhoods into District 2 and District 3 so your side edges out both — even if it is close. Two narrow wins beat one landslide.',
    done: s => s.blueTwo,
  },
  {
    title: 'Step 3 — Call the election',
    body: 'Assign every last county to a district. The moment the map is complete, the results come in.',
  },
];

export default function LessonGuide({ signals, onSkip }) {
  const [step, setStep] = useState(0);
  // Foldable so the coach can be tucked out of the way to reach the counties
  // beneath it (Step 3 fills the whole board).
  const [folded, setFolded] = useState(false);

  // Auto-advance the instant the current step's goal is achieved.
  useEffect(() => {
    const goal = STEPS[step]?.done;
    if (goal && goal(signals)) {
      const t = setTimeout(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 500);
      return () => clearTimeout(t);
    }
  }, [signals, step]);

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className={`lesson-guide${folded ? ' lesson-guide--folded' : ''}`}>
      <div className="lesson-guide__head">
        <div className="lesson-guide__dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`lesson-guide__dot${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`} />
          ))}
        </div>
        {folded && (
          <button className="lesson-guide__peek" onClick={() => setFolded(false)}>{s.title}</button>
        )}
        <button
          className="lesson-guide__fold"
          onClick={() => setFolded(f => !f)}
          aria-expanded={!folded}
          title={folded ? 'Show the lesson coach' : 'Fold the coach out of the way'}
        >
          {folded ? 'Show ⌃' : 'Fold ⌄'}
        </button>
      </div>
      {!folded && (
        <>
          <div className="lesson-guide__title">{s.title}</div>
          <p className="lesson-guide__body">{s.body}</p>
          <div className="lesson-guide__actions">
            <button className="lesson-guide__skip" onClick={onSkip}>Skip lesson</button>
            {!isLast && (
              <button className="lesson-guide__next" onClick={() => setStep(step + 1)}>Next ›</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
