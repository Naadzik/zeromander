import { useTheme, NEXT_LABEL } from '../hooks/useTheme'

export default function GameHeader({ onBack, onHelp }) {
  const { edition, cycleEdition } = useTheme();
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button className="app-header__back" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">←</span>
          <span className="app-header__back-label">Back</span>
        </button>
        <div className="app-header__title">
          <h1>Zeromander</h1>
          <p>Master the art of electoral redistricting</p>
        </div>
        <div className="app-header__actions">
          {/* Label names the edition you'd switch TO, like a light/dark toggle.
              The " edition" suffix is dropped on phones (CSS) to save the row. */}
          <button className="app-header__help app-header__edition" onClick={cycleEdition} title="Switch visual edition">
            {NEXT_LABEL[edition].replace(/ edition$/, '')}
            <span className="app-header__edition-suffix"> edition</span>
          </button>
          <button className="app-header__help" onClick={onHelp} title="Replay tutorial">
            ? Help
          </button>
        </div>
      </div>
    </header>
  );
}
