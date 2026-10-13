---
paths:
  - 'src/ai/**'
---

# AI rules

- Bots receive a `PlayerView` only. Hidden cards are sampled by `determinize()`; never read `GameState`, hands or the seed.
- Bots must always return a move from `legalMoves`; the UI validates it.
- Bots run in a Web Worker (`ai.worker.ts`) with a time budget (`budgetMs`); tests pass a fixed iteration count for determinism.
- Measure strength changes with the simulator (`npm run sim`, or the `playtest` skill) before claiming an improvement.
