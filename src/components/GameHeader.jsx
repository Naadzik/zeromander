import { useTheme, NEXT_LABEL } from '../hooks/useTheme'

export default function GameHeader({ onBack, onHelp }) {
  const { edition, cycleEdition } = useTheme();
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button className="app-header__back" onClick={onBack}>
          ← Back
        </button>
        <div className="app-header__title">
          <h1>Zeromander</h1>
          <p>Master the art of electoral redistricting</p>
        </div>
        <div className="app-header__actions">
          {/* Label names the edition you'd switch TO, like a light/dark toggle. */}
          <button className="app-header__help app-header__edition" onClick={cycleEdition} title="Switch visual edition">
            {NEXT_LABEL[edition]}
          </button>
          <button className="app-header__help" onClick={onHelp} title="Replay tutorial">
            ? Help
          </button>
        </div>
      </div>
    </header>
  );
}
