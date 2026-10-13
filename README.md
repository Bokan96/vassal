# Vassal (web)

A browser version of **Vassal**, a two-player area-control card game played with a standard 54-card deck,
in the spirit of Reiner Knizia's Battle Line / Schotten Totten. Win the allegiance of any **5** of the nine
noble houses, or **3 adjacent** ones, by forming stronger three-card alliances than your opponent.

- Play against the computer (three difficulty levels) or against a friend on the same device (hot-seat).
- Optional variants from the rulebook: _No Motive tier_ and _No wildcards_.
- Works on desktop and phones, with keyboard play (arrows / Enter / 1–9 / Esc).
- Runs entirely in the browser; games are saved locally and can be resumed.

Rules: [docs/rules.md](docs/rules.md) (transcribed from [the original PDF](docs/Vassal_1.0.pdf), with the
interpretations we adopted listed as Clarifications C1–C13).

## Getting started

Requires Node.js 22+ and, for end-to-end tests, Google Chrome.

```sh
npm install
npm run dev          # http://localhost:5173  (add ?seed=123 for a fixed deal)
```

| Command                                            | What it does                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                                      | Vite dev server                                                           |
| `npm run build`                                    | Type-check and build the static site into `dist/`                         |
| `npm test`                                         | Vitest: rules engine and AI (golden, exhaustive and property-based tests) |
| `npm run e2e`                                      | Playwright end-to-end tests (desktop and mobile, uses installed Chrome)   |
| `npm run sim -- --games 500 --p0 easy --p1 normal` | Headless bot-vs-bot simulator                                             |
| `npm run check`                                    | Typecheck + lint + tests (the definition of done)                         |

## Architecture

```
src/engine/   Pure TypeScript rules engine: no DOM, deterministic, seeded shuffles
  strength.ts   tiers, joker resolution, strength = tier*64 + combined rank
  proof.ts      "opponent can't beat this" proofs from table cards only (C4)
  rules.ts      the turn sequence: play → draw → resolve → proofs → win (C5)
  view.ts       per-player views that hide the opponent's hand and the pile
src/ai/       Bots that see only a PlayerView; run in a Web Worker
src/ui/       React 19 UI (motion for animation)
scripts/sim.ts  simulator   e2e/  Playwright specs
```

The engine is authoritative and serializable (`GameRecord` = config + seed + moves), so online play can be
added later by running `applyMove` on a server and sending each client `getPlayerView`.

### AI levels

| Level             | How it plays                                                        | Strength (simulator, standard rules) |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------ |
| Squire (easy)     | Greedy local heuristics with some randomness                        | beats random play 99.7%              |
| Knight (normal)   | One-ply search over a probabilistic evaluation of every house       | beats Squire ~77%                    |
| Chancellor (hard) | Monte Carlo: samples hidden cards, plays games out, ~0.9 s per move | beats Knight ~80%                    |

## Claude Code setup

This repo is set up for [Claude Code](https://code.claude.com):

- `CLAUDE.md`: project conventions; imports `docs/rules.md` so the rules are always in context.
- `.claude/rules/`: path-scoped guidance for `src/engine`, `src/ai` and `src/ui`.
- `.claude/settings.json`: permission allowlist and a PostToolUse hook (`.claude/hooks/post-edit.mjs`) that
  formats and lints every edited file and runs the related engine/AI tests.
- `.claude/agents/rules-referee.md`: adversarial reviewer that checks engine changes against the rules.
- `.claude/skills/`: `playtest` (simulator runs and AI benchmarks) and `rule-change` (checklist).

Recommended plugins (declared in `.claude/settings.json`; install once per machine):

```sh
npm install -g typescript-language-server typescript   # needed by typescript-lsp
claude plugin install typescript-lsp@claude-plugins-official --scope project
claude plugin install context7@claude-plugins-official --scope project
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install frontend-design@claude-plugins-official --scope project
claude plugin install commit-commands@claude-plugins-official --scope project
```

Check them with `/plugin` and `/mcp` inside Claude Code.

## License

MIT (see [LICENSE](LICENSE)). Vassal's rules are by their original author; see the rulebook PDF.
