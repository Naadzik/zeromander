import { PARTY, PARTY_IDS } from '../utils/partyConfig';
import PartyIcon from './ui/PartyIcon';
import Icon from './ui/Icons';
import '../styles/GameToolbar.css';

export default function GameToolbar({
  numDistricts,
  currentDistrict,
  onDistrictSelect,
  isThreeParty,
  playerParty,
  onPartySelect,
  onPartyToggle,
  mapView,
  onMapViewChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport
}) {
  return (
    <div className="game-toolbar">
      <div className="game-toolbar__districts">
        {Array.from({ length: numDistricts }).map((_, i) => {
          const districtId = i + 1;
          return (
            <button
              key={districtId}
              className={`toolbar-btn district-btn${currentDistrict === districtId ? ' toolbar-btn--active' : ''}`}
              onClick={() => onDistrictSelect(districtId)}
            >
              D{districtId}
            </button>
          );
        })}
      </div>

      {isThreeParty ? (
        <div className="game-toolbar__party-picker">
          <span className="toolbar-label">Playing as:</span>
          {PARTY_IDS.map(party => (
            <button
              key={party}
              className={`toolbar-btn party-btn${playerParty === party ? ' party-btn--active' : ''}`}
              data-party={party}
              onClick={() => onPartySelect(party)}
            >
              <PartyIcon party={party} /> {PARTY[party].shortLabel}
            </button>
          ))}
        </div>
      ) : (
        <button
          className="toolbar-btn party-toggle"
          data-party={playerParty}
          onClick={onPartyToggle}
          title="Switch which party you're playing for"
        >
          Playing as: <PartyIcon party={playerParty} /> {PARTY[playerParty].shortLabel}
        </button>
      )}

      {/* Wrappers flatten on desktop (display: contents) and become the
          mobile segmented rows — button class names are untouched, which the
          print theme's selectors depend on. */}
      <div className="game-toolbar__views">
        {[
          { key: 'original', label: 'Original' },
          { key: 'districts', label: 'Districts' },
          { key: 'party', label: 'Party Colors' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`toolbar-btn${mapView === key ? ' toolbar-btn--active' : ''}`}
            onClick={() => onMapViewChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="game-toolbar__actions">
        <button
          className="toolbar-btn toolbar-btn--action"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Icon name="undo" /> Undo
        </button>
        <button
          className="toolbar-btn toolbar-btn--action"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Icon name="redo" /> Redo
        </button>
        <button
          className="toolbar-btn toolbar-btn--action"
          onClick={onExport}
          title="Download current map view as PNG"
        >
          <Icon name="download" /> Export
        </button>
      </div>
    </div>
  );
}
