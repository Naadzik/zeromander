# Zeromander — project guide

An interactive, **client-only** web game about gerrymandering. You draw electoral
districts on a procedurally-generated map, fairness metrics update live, and the
election is called — showing how the same voters produce opposite seat outcomes
depending on who draws the lines. No server, no accounts; everything runs in the
browser and persists to `localStorage`. Live at
<https://naadzik.github.io/zeromander/>.

Strictly **nonpartisan**: every party is fictional, and the daily assigns you a
different side each day. The point is structural ("whoever holds the pen"), not
"they cheat".

## Stack & commands

- **React 18 + Vite**, HTML5 Canvas for the map, plain CSS with design tokens.
  No game-engine or state-management libraries.
- `npm install` — install deps.
- `npm run dev` — dev server at <http://localhost:5173/zeromander/>.
- `npm run build` — production build → `dist/` (gitignored).
- `npm run preview` — serve the built `dist/`.
- No test runner or linter is configured. Verify by building and, when layout or
  the map matters, **rendering and eyeballing** (see "Verifying changes").

## Where things live

- `src/pages/GameApp.jsx` — the main container; owns all game state and the
  URL-mode config selection. Big file; most modes branch here.
- `src/pages/Landing.jsx`, `src/App.jsx`, `src/main.jsx` — routing
  (Landing → GameApp → Methodology). Router `basename="/zeromander"`.
- `src/components/` — `GameCanvasCounty.jsx` (canvas + pointer/drag painting),
  `GameToolbar.jsx`, `GameStats.jsx`, `GameEndModal.jsx` (result modal + share),
  `Controls.jsx` (sandbox setup), `Tutorial.jsx` / `LessonGuide.jsx`,
  `RevealChyron.jsx`, `DailySpecimen.jsx`, and `broadsheet/` (the paper edition —
  see "The three editions").
- `src/hooks/` — `useMapState.js` (board + districts + paint actions),
  `useTheme.jsx` (edition/theme), `useFairMap`, `useUndoRedo`, etc.
- `src/utils/` — game math (`gameLogic.js`, `metrics.js`, `analyzeMap`),
  generation (`mapGenerator.js`, `countyGenerator.js`, `fairMapGenerator.js`),
  `rng.js` (seeded PRNG + `LAUNCH_UTC`), `dailyChallenge.js`, `dailyHistory.js`,
  `verdictCopy.jsx`, `engraved.js`, `share.js`.
- `src/styles/` — per-component CSS + `design-system.css` (tokens) +
  `theme-print.css` (the print/paper theme).
- `docs/ARCHITECTURE.md` — the algorithms (Voronoi counties, population
  clustering, contiguity, efficiency gap, Polsby-Popper compactness).

## ⚠️ Determinism is sacred — the daily must be byte-identical for everyone

The Daily Heist is "one board, everyone, one attempt": every player worldwide
must get the exact same board for a given date, and the "seats stolen vs. a fair
map" score must be comparable. A whole category of changes can silently break
this. **Frozen (do not casually change):**

- `LAUNCH_UTC` in `rng.js` (2026-07-01) — defines the "Daily #N" numbering.
- `MODEL_V2_UTC` in `rng.js` (2026-08-01) — the board-model era boundary.
  Moving it re-rolls every date that changes side, in either direction.
- The seeded generation path: `mapGenerator.js`, `countyGenerator.js`,
  `fairMapGenerator.js`. The **RNG draw order is frozen** (city seeds → party
  roll → densities → corrective flips → grey blobs); reordering re-rolls every
  past daily board. Both model eras share this order — a v2-only change must
  not move a draw, or it re-rolls v1 too.
- The neutral **ensemble**: `ENSEMBLE_INCREMENT`, `MAX_TRIES`, the seed
  schedule, the acceptance rule, the lower-median definition and the ghost
  selection in `neutralEnsemble.js`. "Seats stolen" is measured against the
  median of 25 neutral maps — change any of these and every score shifts.
- The neutral/"fair" map algorithm + its seed. The fair-map seed is pinned to
  the board seed via `fairSeedFrom(seed)` (daily AND sandbox/challenge) so
  "seats stolen" is comparable — don't unpin it.
- Two-tier daily: `getDailyChallenge()` returns `{small, full}`; `full` uses the
  raw day seed, `small` uses `seed ^ SMALL_STREAM`. Streak counts the **small**
  (Warm-up) tier. History schema `{date: {small?, full?}}` is additive-only.

**Determinism protocol (run before AND after touching any generator file):**
`npm run check:determinism`. It rebuilds frozen reference boards and fails if a
byte moved; CI runs it on every push and it gates the deploy, so a board-rerolling
change cannot reach the live site. Anchors live in `scripts/determinism-refs.json`
(both eras, both tiers, both assigned parties, several seeds; each entry pins its
`model`, and 2026-07-31/2026-08-01 fence the era boundary), and each board carries two
hashes: `pop` = `sha256(populationMap)` — the documented protocol hash, still
`SMALL 6a58c8fb70c7cdbc32e8cfd070d976c8c71bd01aa165e8206164480cede874d5` /
`FULL 253ba49aec76db12dc35b9f097f2512dc2fd36bbe1ff9871c81205eee2543b84` for
2026-07-08 — and `full` = `sha256({pop, counties})`, which also covers the county
layer (counties draw from the same rng stream but *after* the population map, so
a `countyGenerator.js` change re-rolls everyone's counties while leaving `pop`
green — `full` is what catches that).

A failure is never fixed by updating a hash: that silently redefines a board
players have already seen. Either revert, or — if the change is intended —
version-gate it as a new era (the `LAUNCH_UTC` pattern), keep the old era
generating the old boards, and add the new era's anchors *alongside* the old.
`--update` exists for opening an era, not for making CI green.

**Model calibration:** `npm run check:models` asserts each model spec's
calibration targets (`scripts/models/*.check.mjs`, auto-discovered). Per the
MODEL-SPECS appendix, a target is renegotiated in the spec document first, never
silently in code.

**New optional generator features must consume ZERO rng draws when disabled**
(see the hard `greyPercentage > 0` / `communityPercentage > 0` guards in
`generatePopulationMap`). `communityPercentage` is force-set to 0 in every
daily/lesson/challenge branch so a sandbox toggle can't leak into a frozen board.

## The board generator — TWO frozen eras (v1 and v2/Beta)

`generatePopulationMap` in `mapGenerator.js` is the 2-party board generator for
every board (daily both tiers, sandbox, challenge, lesson, scenarios). It takes
a trailing `modelVersion` argument, **defaulting to 1 deliberately**, and one
code path serves both eras with an identical rng draw count and order.

- **Which era a board uses:** dailies from `MODEL_V2_UTC` (2026-08-01) onward
  are v2; every earlier date stays v1 **forever** (that is what the archive and
  old challenge links replay). `boardModelVersion(date)` decides. Challenge
  links carry it explicitly as `v=2` (absent = v1) because a link has no date.
  Sandbox and decade are always v2; the lesson and community scenario pin
  `modelVersion: 2` in their configs.
- **v1 (pre-Beta):** warped non-round cities and a **hard party step** — every
  cell solidly one party, no competitive suburbs — with the gradient carried by
  **density**, not party. Cities feather into rural red via a "dim seam".
- **v2 (Beta):** rank-size city footprints, Clark-exponential density
  (`D₀ 31`, `γ 1.9`), and a **continuous logistic political gradient**, so
  competitive suburbs now exist as a cell mixture. Corrective share passes never
  peel blue past `PROTECT_U` — the countryside keeps sparse blue specks, so no
  county is ever 100% one party. The V2 dials are a frozen constants block; they
  were chosen by eye against rendered boards and are **not** free parameters.

Both eras run two share passes that land the displayed vote share within
~0.14pp of target (the UI says "X% of the vote", so it must stay honest).
`generatePopulationMap3Party` shares only the *look* and keeps its own
three-way model (sandbox-only, nothing frozen).

⚠️ The two eras are both live and both anchored. A change that "simplifies" the
v1 path re-rolls every archived daily; a change to the v2 path re-rolls every
daily from August 2026 on. `npm run check:determinism` guards both (18 boards,
10 v1 + 8 v2) and additionally asserts each date's era, so moving
`MODEL_V2_UTC` fails loudly rather than silently re-rolling boards.

Insight that cost real time: **numeric tests can pass while the board looks
wrong.** Always eyeball a rendered board, not just metrics. Feather with density,
never a party gradient (that reintroduces purple, which was rejected).

## The three editions (broadcast / print / paper)

The toggle cycles `localStorage['zeromander.ui.theme']` ∈ `broadcast | print |
paper`.

- **broadcast** — the default dark "studio broadcast" dashboard.
- **print** — a light newsprint reskin. `html[data-theme='print']`; all styling
  in `theme-print.css` (token + structural overrides). Same layout as broadcast.
- **paper (the Broadsheet)** — a *distinct* newspaper front-page shell, not a
  reskin. Sets BOTH `data-theme='print'` (shared tokens) AND
  `data-edition='paper'`. Own component tree in `components/broadsheet/`, all
  `paper-*` class names; own engraved map engine (`engraved.js`). Has its own
  `/game` shell (`BroadsheetGamePage`) AND its own landing (`BroadsheetLanding`);
  `GameApp`/`Landing` branch to it when `edition === 'paper'`.

Invariants:

- **Never remount on edition change** — a remount regenerates a mid-game board.
  `GameApp` renders the Broadsheet as a *second return branch* over the same
  hooks; `useTheme` applies the attribute in `useLayoutEffect` and keeps legacy
  `theme`/`toggleTheme` aliases (canvas redraw deps rely on them). An inline boot
  script in `index.html` sets the attribute before first paint (keep it in sync).
- **`verdictCopy.jsx` is the single source** of all end-of-game content (status
  copy, result grids, anatomy readouts, share text). The dashboard modal
  (`GameEndModal`) and the Broadsheet article (`PaperVerdictArticle`) both consume
  it so the two can't drift — never fork the copy.
- **6-digit-hex token invariant:** `--district-1..12`, `--canvas-hover`,
  `--canvas-community`, `--canvas-pop-{gain,loss,neutral}` MUST stay `#RRGGBB` —
  canvas draw code appends hex-alpha pairs / parses channels; an `rgba()` silently
  breaks the map. Guard comments are at both definition sites.

## Game-logic invariants

- **Party cell values:** `0 = blue`, `1 = red`, `2 = green` (3-party only),
  `3 = grey` (undecided). Never route party ints through else-buckets (grey used
  to land silently in a decided tally).
- **Population ≠ votes** (grey feature): grey counts toward the ±10% population
  parity but casts no vote until the election-night reveal. Anti-spoiler: the
  seat "Target" uses the player's share of the **whole** electorate
  (`ourPopPercent * (1 - greyShare/100)`), not the decided-only share (which
  would leak which way the grey leans). Don't "simplify" it back.
- **Contiguity:** districts must stay rook-connected. `repairCountyContiguity`
  runs at both exits of `rebalanceCountyPopulations` (rebalance could emit
  rook-disconnected counties that made districts impossible to complete).
- Painting a county claims/steals the **whole county** in one action. Stealing
  from another district is allowed only if every donor district stays connected
  and within the population cap.

## URL modes (all selected in `GameApp.jsx`)

`?daily` (Warm-up), `?daily&tier=full` (gated on Warm-up), `?daily=YYYY-MM-DD`
(archive: past board, UNSCORED), `?board=<seed>&…` (challenge link — reproduces a
friend's board + their score as the goal), `?lesson` (guided First Heist, fixed
15-county board), `?scenario=community` (VRA teaching board), `?decade` (draw
once, play 5 elections of swing + drift). Plus `/methodology`. Each new mode
follows the lesson pattern: plain config over `sandboxConfig`, Controls hidden,
`effectiveParty` fixed, added to the `duel` guard.

## Mobile & layout invariants

- **One-screen play:** on phones the square board fills `100dvh` minus a chrome
  budget (`--game-chrome-mobile`, set per surface via `:has()` in `App.css`;
  `--paper-chrome-mobile` for the Broadsheet). Always keep a `vh` fallback line
  before each `dvh`. If mobile chrome grows, re-measure and bump the budget or the
  board falls below the fold.
- **The board is the star — don't shrink it to fit chrome.** When a docked panel
  (coach, chyron, share bar) overlaps the board, make the panel foldable or
  reposition it; don't clamp the canvas smaller.
- **44px tap floor** via a `(pointer:coarse),(max-width:768px)` block. There is
  deliberately NO global `button{width:100%}` — full-width buttons are per-surface.
- **Share contract:** all text shares go through `utils/share.js` `shareText()` —
  `navigator.share` synchronously in the tap gesture, `AbortError ⇒ 'shared'`,
  clipboard fallback ⇒ `'copied'`, else `'failed'` (never a fake "Copied").
- **PWA-lite, no service worker (deliberate):** the date-keyed daily must never be
  served cache-stale. `manifest.json` + icons only.
- **Vite base trap:** in `index.html`, public-asset hrefs must be root-absolute
  *without* the base (`/manifest.json`) — Vite prepends `base: '/zeromander/'`;
  writing `/zeromander/…` double-prefixes.

## Styling conventions

- Use tokens from `design-system.css` — spacing (`--spacing-sm/md/lg/xl/2xl` =
  8/12/16/24/32px), font sizes, colors, radii. Don't hardcode what a token covers.
- Modals are `max-height: 90dvh` with a fixed header + scrollable body + fixed
  footer — keep the fixed header/footer compact on phones or the body is squeezed.
- Mobile breakpoints: `@media (max-width: 768px)`, `600px`, `480px`.

## Verifying changes

Build, then exercise the change in a real browser — screenshot layout at a phone
viewport and desktop, check the console, and for the daily run the determinism
hash check. For CSS-only work, a static HTML harness that `<link>`s the compiled
`dist/assets/index-*.css` and reproduces the component's DOM, screenshotted at a
phone viewport, is a reliable check. Never assume — render it.

## Deployment

GitHub Actions builds and deploys to **GitHub Pages** on push to `main` (built
`dist/` → `gh-pages` branch). Pages must be set to **Deploy from a branch →
`gh-pages` / root**.

**The blank-page trap (recurs):** Pages must serve the BUILT `dist/`, never raw
source. Symptom: the live `index.html` references `/src/main.jsx` → blank page.
Causes seen: the Pages source drifting to serve `main` root instead of `gh-pages`
(settings-only fix), or a feature branch missing `.github/`. Diagnose by
`curl`-ing the live `index.html` (should reference `/assets/…`, not `/src/…`).

The repo **must stay named `zeromander`** — `vite.config.js` hardcodes
`base: '/zeromander/'` and share URLs assume that path.

## Known deferred issues

- **Daily-history storage growth:** each locked daily stores the full districts
  grid (~15–25 KB) in `localStorage['zeromander.daily.history.v1']`. A daily
  player hits the quota in ~a year, after which persistence silently stops. Fix
  when picked up: on write, strip `districts` from all but the newest day (only
  the current day's board is ever redrawn).
