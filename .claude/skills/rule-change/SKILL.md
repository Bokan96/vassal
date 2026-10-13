---
name: rule-change
description: Checklist for adding or changing a Vassal game rule or rule interpretation in the engine. Use whenever gameplay behaviour in src/engine must change.
---

# Changing a rule

1. **Spec first.** Update `docs/rules.md`. If the rulebook doesn't settle the question, add or edit a
   clarification row (next free `C<n>` id) stating the decision and why.
2. **Failing test.** Add a scenario test with `makeState` / `parseCards` (see `src/engine/testing.ts`)
   whose name starts with the rule or C-id. Run it and confirm it fails for the expected reason.
3. **Engine change.** Implement it in the one right place: tiers/joker in `strength.ts`, proof pool in
   `proof.ts`, turn order/claims/win in `step()` in `rules.ts`, dealing in `setup.ts`.
4. **Verify.** `npm run check`. Then run the `playtest` skill with random bots across `--variant all`
   to confirm 0 invariant failures.
5. **Review.** Ask the `rules-referee` agent to review the diff and address what it finds.
6. **UI/AI follow-up.** If the change affects explanations (claim reasons, tier labels) or AI
   heuristics, update `src/ui` / `src/ai` accordingly.
