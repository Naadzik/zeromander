# Architecture

Tech stack: **React 18 + Vite**, HTML5 Canvas for rendering, plain CSS with design tokens, no game-engine dependencies.

## Project layout

```
src/
├── App.jsx, main.jsx              # Routing (Landing → GameApp)
├── pages/
│   ├── Landing.jsx                # Public landing page
│   └── GameApp.jsx                # Main game container, holds all state
├── components/
│   ├── GameCanvasCounty.jsx       # Canvas drawing + mouse / drag handling
│   ├── Controls.jsx               # Sliders, difficulty selector
│   ├── GameStats.jsx              # Live metrics panel + tooltips
│   ├── GameEndModal.jsx           # Win/lose modal + share button
│   └── Tutorial.jsx               # First-run coachmark overlay
├── utils/
│   ├── mapGenerator.js            # Two-pass population clustering
│   ├── countyGenerator.js         # Voronoi + component merging
│   ├── gameLogic.js               # Seats, efficiency gap, contiguity
│   ├── metrics.js                 # Compactness, competitiveness, asymmetry
│   ├── formatUtils.js             # Map data extraction helpers
│   └── metricDescriptions.js      # Tooltip copy for fairness metrics
└── styles/                        # CSS modules + global design system
```

## Algorithms

### County generation (`countyGenerator.js`)

Voronoi seed-point assignment, then iterative merging:

1. Place `numCounties` random seed points.
2. Assign each cell to its nearest seed (Voronoi).
3. Flood-fill to find connected components. Any component smaller than 4 cells gets merged into an adjacent county.
4. Repeat up to 100 iterations until every county is contiguous and ≥ 4 cells.

After generation, `rebalanceCountyPopulations` swaps boundary cells to bring each county's population within ±25% of its fair share.

### Population distribution (`mapGenerator.js`)

Two-pass clustering avoids artificial stripe patterns:

- **Pass 1**: Seed-based clustering with `numCities` Urban Union centers. Each cell's blue/red affinity is a function of distance to the nearest seed plus randomness, producing natural-looking geographic patterns.
- **Pass 2**: Cell swapping to hit the exact target population percentage while preserving Pass 1's structure.

Each cell also gets a density value (1–10), so populated cells weight more in seat math than rural cells.

### Contiguity check (`gameLogic.js`)

When a county is added to a district, every cell in that county must be 4-neighbor-adjacent to an existing cell in the same district (or the district must be empty). This rules out disconnected blobs without expensive flood-fill on every move.

### Seat math (`gameLogic.js`)

A district is won by whichever party has more total voter density. `calculateSeats` returns `{ blue, red }` counts; the GameApp layer projects this through `playerParty` to determine the player's own seats.

### Efficiency gap (`gameLogic.js`)

Standard wasted-votes formulation:
- Losing party's votes are 100% wasted.
- Winning party's votes beyond `ceil(total / 2)` are wasted.
- `|blue_wasted − red_wasted| / total_votes`.

### Compactness (`metrics.js`)

Grid isoperimetric quotient: `(16 × area) / perimeter²`, capped at 1. Area is cell count; perimeter is number of external cell edges (cells whose neighbor is out-of-grid or in a different district). On a rook grid `perimeter ≥ 4√area` (Harary & Harborth 1976), so the score tops out at exactly 1 for perfect squares — this is Polsby-Popper's `4πA/P²` rescaled by `4/π`, because the circle normalization caps at π/4 ≈ 0.785 on cell geometry (a square, not a circle, is the grid optimum). Plan average is over drawn districts only (`null` when none). Companion: `calculateCutEdges(districts, counties)` counts adjacent county pairs assigned to different districts (the county dual graph — counties are the unit players assign), shown against the neutral map's count.

## Drag-to-select

`GameCanvasCounty.jsx` tracks drag state in a ref (not state, to avoid re-renders during the gesture). On `mousedown`, it records the starting county's current assignment and infers a paint mode (`'add'` or `'remove'`). On `mousemove`, if the cursor enters a *different* county, the same paint mode is applied. `GameApp.applyCountyAction(prev, countyId, mode)` enforces contiguity and population caps; failing actions are silently dropped so a drag never errors mid-stroke.

## Deployment

GitHub Actions builds and deploys to GitHub Pages on push to `main`. `vite.config.js` sets `base: '/zeromander/'`. `.nojekyll` prevents Jekyll preprocessing. See `DEPLOYMENT.md` for the full workflow.
