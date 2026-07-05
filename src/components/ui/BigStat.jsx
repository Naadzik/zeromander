import '../../styles/ui.css';

// Label-over-number ticker block for headline stats.
export default function BigStat({ label, value, suffix, color }) {
  return (
    <div className="big-stat">
      <div className="broadcast-label">{label}</div>
      <div className="ticker-number big-stat__value" style={color ? { color } : undefined}>
        {value}
        {suffix && <span className="big-stat__suffix">{suffix}</span>}
      </div>
    </div>
  );
}
