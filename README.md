# Zeromander

**Master the art of electoral redistricting.**

An interactive web game about gerrymandering. Draw district lines on a procedurally-generated map, watch fairness metrics update in real time, and see for yourself how the same voters can produce wildly different election results depending on who draws the boundaries.

**[Play it now →](https://naadzik.github.io/zeromander/)**

## What you'll learn

- **How gerrymandering actually works** — packing, cracking, and the trade-offs between them.
- **What fairness metrics measure** — efficiency gap, Polsby-Popper compactness, competitiveness, partisan asymmetry.
- **Why redistricting is hard** — every county matters; small moves cascade.

## How to play

1. Choose a difficulty (Small, Medium, Large, or 3rd Party mode).
2. Pick which party you're drawing for — Urban Union, Heartland Alliance, and in 3rd Party mode, Farmers Coalition.
3. Click counties to assign them to the selected district. **Drag** to paint multiple counties at once.
4. Districts must stay contiguous; each district's population must land within ±10% of the target.
5. Win when every county is assigned and your seat share exceeds your population share.

Every completed game (win or lose) can be saved to a local leaderboard, scoped per difficulty — see the [Leaderboard](https://naadzik.github.io/zeromander/leaderboard). Nothing leaves your browser; there's no server.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

```bash
npm run build   # production build → dist/
```

## Inspiration

- [Hexapolis](https://observablehq.com/@mcmcclur/hexapolis-538) by Mark McClure — the grid-based redistricting visualization that started it all
- [NY Times — Lesson of the Day: A Gerrymandering Game](https://www.nytimes.com/2022/02/08/learning/lesson-plans/lesson-of-the-day-a-gerrymandering-game.html)
- The [Metric Geometry and Gerrymandering Group (MGGG)](https://mggg.org/) — academic research on electoral systems

## Architecture notes

For implementation details (county generation, population clustering, contiguity checks, fairness metric formulas), see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

Educational use. Built for learning about democratic processes.

---

**Play responsibly. Fair representation matters.**
