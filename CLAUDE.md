# Vassal (web)

Browser version of **Vassal**, a two-player area-control card game played with a standard 54-card deck
(Battle Line / Schotten Totten style). v1 is hot-seat + vs AI, fully client-side. The engine is
authoritative and serializable so online play can be added later without changing it.

The rules, including every interpretation we adopted (Clarifications C1–C14), are the single source of truth:

@docs/rules.md

## Commands

- `npm run dev`: Vite dev server (`?seed=123` gives a deterministic deal)
- `npm run test` / `npm run test:watch`: Vitest (engine + AI)
- `npm run typecheck` / `npm run lint` / `npm run format`
- `npm run e2e`: Playwright (desktop + mobile, uses installed Chrome)
- `npm run sim -- --games 500 --p0 easy --p1 normal`: headless AI-vs-AI simulator
- `http://localhost:5173/prevodi` (dev server only): translation editor; saves edits to `text-edits.json` (gitignored). "primeni prevode" = apply that file to the source, then delete it. `npm run texts` dumps all texts as JSON.
- `npm run check`: typecheck + lint + test. **This is the definition of done for any change.**

## Layout

- `src/engine/`: pure TypeScript rules engine (cards, strength, proof, rules, view, replay)
- `src/ai/`: AI opponents, run in a Web Worker
- `src/ui/`: React UI
- `scripts/sim.ts`: simulator CLI. `e2e/`: Playwright specs.

## Architecture invariants

- `src/engine` is pure: no React, no DOM, no `Math.random` (use `createRng` from `rng.ts`). ESLint enforces this.
- `step()` in `rules.ts` is the only implementation of the turn sequence; `applyMove()` is its pure wrapper.
- The UI and AI see the game only through `getPlayerView()`. Never pass `GameState` or the seed to the AI.
- Proofs (`proof.ts`) use public table information only (C4). They never read hands or the pile.
- Card ids: 0..51 = suit*13 + rank-1 (♠♣♥♦), 52/53 = player 0/1 joker. Use `parseCards('2♠ 3♥ 4♣')` in tests.
- Strength = tier*64 + combined rank; compare with plain `>`. Ties are broken by `completedAt`.

## Conventions

- Every rule behaviour has a test that names the rule or clarification ID it covers (e.g. `C5: ...`).
- Changing a rule: follow the `rule-change` skill, then ask the `rules-referee` agent to review.
- Named exports only in engine/AI code; state updates go through `step`/`applyMove`.
- A PostToolUse hook formats and lints each edited file and runs related engine/AI tests; fix what it reports.
- Use context7 for current React 19 / Vite 8 / Vitest 5 / motion APIs instead of guessing.
