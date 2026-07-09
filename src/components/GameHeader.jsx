import { useTheme } from '../hooks/useTheme'

export default function GameHeader({ onBack, onHelp }) {
  const { theme, toggleTheme } = useTheme();
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
          <button className="app-header__help app-header__edition" onClick={toggleTheme} title="Switch visual edition">
            {theme === 'print' ? 'Broadcast edition' : 'Print edition'}
          </button>
          <button className="app-header__help" onClick={onHelp} title="Replay tutorial">
            ? Help
          </button>
        </div>
      </div>
    </header>
  );
}
