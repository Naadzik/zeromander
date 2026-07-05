export default function GameHeader({ onBack, onHelp }) {
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
        <button className="app-header__help" onClick={onHelp} title="Replay tutorial">
          ? Help
        </button>
      </div>
    </header>
  );
}
