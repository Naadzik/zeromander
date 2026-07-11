import { PARTY } from '../../utils/partyConfig'

// "THE COMPOSITOR'S ROW" — the Broadsheet's bespoke toolbar. Typeset numerals
// for the district in hand, small-caps tabs for the plate view, glyph buttons
// for the desk actions. Same handlers as the dashboard toolbar, none of its
// markup.
export default function PaperCompositor({
  numDistricts, currentDistrict, onDistrictSelect,
  isThreeParty, playerParty, onPartyToggle,
  mapView, onMapViewChange,
  canUndo, canRedo, onUndo, onRedo, onExport,
}) {
  const p = PARTY[playerParty];
  const views = [
    ['original', 'Territory'],
    ['districts', 'Districts'],
    ['party', 'Seats'],
  ];
  return (
    <div className="paper-compositor">
      <div className="paper-compositor__row">
        <span className="paper-compositor__label">Setting district</span>
        <span className="paper-compositor__numerals">
          {Array.from({ length: numDistricts }, (_, i) => i + 1).map(id => (
            <button
              key={id}
              className={`paper-numeral${currentDistrict === id ? ' is-set' : ''}`}
              onClick={() => onDistrictSelect(id)}
            >
              {id}
            </button>
          ))}
        </span>
      </div>
      <div className="paper-compositor__row">
        <span className="paper-compositor__label">Plate</span>
        <span className="paper-compositor__tabs">
          {views.map(([v, label]) => (
            <button
              key={v}
              className={`paper-tab${mapView === v ? ' is-open' : ''}`}
              onClick={() => onMapViewChange(v)}
            >
              {label}
            </button>
          ))}
        </span>
        <span className="paper-compositor__desk">
          <button className="paper-desk-btn" disabled={!canUndo} onClick={onUndo}>↶ undo</button>
          <button className="paper-desk-btn" disabled={!canRedo} onClick={onRedo}>↷ redo</button>
          <button className="paper-desk-btn" onClick={onExport}>⤓ plate</button>
          <button className="paper-desk-btn paper-desk-btn--party" onClick={onPartyToggle} title="Switch party">
            filing as <strong style={{ color: p.cssColor }}>{p.shortLabel}</strong>{isThreeParty ? ' ⇄' : ' ⇄'}
          </button>
        </span>
      </div>
    </div>
  );
}
