---
paths:
  - 'src/engine/**'
---

# Engine rules

- Keep it pure and deterministic: no DOM, no React, no I/O, no `Math.random`, no `Date.now`.
- Before changing behaviour, re-read `docs/rules.md` and cite the rule or clarification ID (C1–C14) in a comment and in the test name.
- `step()` is the single implementation of the turn sequence (play → draw → 3a compare → win → 3b proofs → win → C8 ending). Don't duplicate rule logic elsewhere; the AI calls `step` too.
- Proof code receives houses only (C4). Never let it see hands or the pile.
- Performance matters: `step`, `bestCompletion` and `proveHouse` run inside AI rollouts. Avoid allocations in hot loops.
- Every behaviour change needs a scenario test (`makeState` from `testing.ts`) and must keep `game.property.test.ts` green.
