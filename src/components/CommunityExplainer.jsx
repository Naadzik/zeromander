import '../styles/CommunityExplainer.css'

// Hexapolis-style teaching panel for the community scenario: the SAME 10
// Riverlands cells (a fifth of a 50-cell, 10-district territory) drawn three
// ways. Each column is a district; a column that is majority-amber (>=3 of 5)
// is a "majority-community" district the Riverlands can carry. Same people,
// different lines -> 0, 1, or 2 seats. Mirrors the >=50% rule the live
// Community meter uses (community.js).
const COLS = 10, ROWS = 5, MAJORITY = 3;

// Each entry: amber-cell count per district-column (fills from the bottom).
// All three total 10 cells — the point is the lines moved, not the people.
const SCENARIOS = [
  { key: 'cracked', label: 'Cracked', seats: 0, columns: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], caption: 'Sliced thin — a majority nowhere.' },
  { key: 'packed',  label: 'Packed',  seats: 1, columns: [5, 1, 1, 1, 1, 1, 0, 0, 0, 0], caption: 'Crammed into one — the surplus is wasted.' },
  { key: 'fair',    label: 'Fair',    seats: 2, columns: [3, 3, 1, 1, 1, 1, 0, 0, 0, 0], caption: 'Two districts just past half — their fair share.' },
];

function MiniMap({ columns }) {
  const cell = 11, gap = 2, pitch = cell + gap;
  const W = COLS * pitch - gap, H = ROWS * pitch - gap;
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} className="cx-map" role="img" aria-hidden="true">
      {columns.map((amber, c) => {
        const majority = amber >= MAJORITY;
        const x = c * pitch;
        return (
          <g key={c}>
            {Array.from({ length: ROWS }).map((_, r) => (
              <rect
                key={r}
                x={x}
                y={r * pitch}
                width={cell}
                height={cell}
                rx="1.5"
                className={`cx-cell${r >= ROWS - amber ? ' cx-cell--comm' : ''}`}
              />
            ))}
            {majority && (
              <rect x={x - 1.5} y={-1.5} width={cell + 3} height={H + 3} rx="2.5" className="cx-seat-ring" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function CommunityExplainer() {
  return (
    <div className="community-explainer">
      <p className="cx-head">
        <strong>The Riverlands are ~20% of voters — a fair share of 2 seats in 10.</strong>{' '}
        The dashed amber cells are the same people in all three maps. Only the district lines change:
      </p>
      <div className="cx-panels">
        {SCENARIOS.map(s => (
          <figure key={s.key} className="cx-panel" data-outcome={s.key}>
            <figcaption className="cx-label">{s.label}</figcaption>
            <MiniMap columns={s.columns} />
            <div className="cx-seats">{s.seats} seat{s.seats === 1 ? '' : 's'}</div>
            <div className="cx-caption">{s.caption}</div>
          </figure>
        ))}
      </div>
      <p className="cx-take">
        <strong>Aim for the third map:</strong> two districts where the Riverlands sit just past half.
        That reads <span className="cx-fair-chip">2 / 2 · fair</span> on the Community meter and adds
        nothing to your Litigation Risk. Cracking them (0 seats) or packing them (1) dilutes their
        vote — and the risk meter climbs.
      </p>
    </div>
  );
}
