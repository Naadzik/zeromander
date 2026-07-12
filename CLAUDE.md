# Zeromander — project memory

Interactive web game about gerrymandering. Draw districts on a procedurally
generated map, watch fairness metrics update live, see how the same voters
yield different seat outcomes. Client-only; no server, nothing leaves the browser.

## Stack & commands

- **React 18 + Vite**, HTML5 Canvas for the map, plain CSS with design tokens.
  No game-engine or state-management deps.
- `npm install` — install (dev needs it; the built site is static).
- `npm run dev` — dev server at `http://localhost:5173`.
- `npm run build` — production build → `dist/` (gitignored).
- `npm run preview` — serve the built `dist/`.
- No test runner or linter is configured. Verify UI changes by building and,
  when layout matters, screenshotting the real compiled CSS (see below).

## Where things live

- `src/pages/GameApp.jsx` — main container, holds all game state.
- `src/pages/Landing.jsx`, `src/App.jsx`, `src/main.jsx` — routing (Landing → GameApp).
- `src/components/` — `GameCanvasCounty.jsx` (canvas + drag), `Controls.jsx`,
  `GameStats.jsx`, `GameEndModal.jsx` (win/lose + share), `Tutorial.jsx`.
- `src/utils/` — game math (`gameLogic.js`, `metrics.js`), map generation
  (`mapGenerator.js`, `countyGenerator.js`), and `verdictCopy.jsx` (shared
  result content: status copy, result grids, swing/durability/anatomy panels,
  detailed stats, share text — reused verbatim by the modal and the Broadsheet
  article so the two can't drift).
- `src/styles/` — per-component CSS plus the global design system.
- `docs/ARCHITECTURE.md` — algorithms (Voronoi counties, two-pass population
  clustering, contiguity, efficiency gap, Polsby-Popper compactness).

## Styling conventions

- Use design tokens from `src/styles/design-system.css` — spacing
  (`--spacing-sm/md/lg/xl/2xl` = 8/12/16/24/32px), font sizes
  (`--font-size-sm`…`--font-size-4xl`), colors, radii. Don't hardcode values
  that a token already covers.
- Global buttons carry `min-height: 44px` (accessible tap-target floor) — reduce
  padding/font to pack buttons tighter on mobile, but don't fight the 44px floor.
- Mobile breakpoints in component CSS: `@media (max-width: 600px)` (phone/small
  tablet) and `@media (max-width: 480px)` (narrow phones). Modals use
  `max-height: 90dvh` (dvh handles mobile browser chrome) with a fixed
  header + scrollable body + fixed footer, so on phones keep the fixed
  header/footer compact or the scrollable body gets squeezed to a sliver.

## Verifying layout changes

Playwright + a preinstalled Chromium are available in this environment
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; don't run `playwright install`).
For CSS-only changes, a reliable check is a static HTML harness that `<link>`s
the real compiled `dist/assets/index-*.css` and reproduces the target
component's DOM, screenshotted at a phone viewport (e.g. 360px wide,
`deviceScaleFactor: 3`) with the modal's `dvh` cap in place. Require Playwright
via CommonJS (`require('/opt/node22/lib/node_modules/playwright')`).

## Deployment

GitHub Actions builds and deploys to GitHub Pages on push to `main`.
`vite.config.js` sets `base: '/zeromander/'`. Live at
https://naadzik.github.io/zeromander/.
