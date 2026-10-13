---
name: playtest
description: Run headless Vassal games (random or AI bots) through the simulator and report engine invariants, balance and AI strength. Use after engine or AI changes, or when asked how strong an AI level is.
---

# Playtest

Run the simulator and interpret the results. Pick the matchups that fit the change:

- Engine change: `npm run sim -- --games 2000 --p0 random --p1 random --variant all`
- AI change: `npm run sim -- --games 500 --p0 easy --p1 normal` and swap seats (`--p0 normal --p1 easy`),
  then the same for `normal` vs `hard` (use fewer games for hard: about 200).
- Reproduce a failure: add `--seed <n>` (it prints the seed of every failing game).

Options: `--games N`, `--p0/--p1 random|easy|normal|hard`, `--seed S`,
`--variant standard|no-motive|no-wildcards|plain|all`, `--budget <ms per AI move>`.

Report, briefly:

1. **Invariant failures**: must be 0. If not, give the seed and the failing check and stop to investigate.
2. **Outcomes**: win rate per seat and per bot, win type split (five / adjacent / majority), average plies.
3. **Tier histogram** of completed alliances, compared with the random-hand expectation in `docs/rules.md`.
4. **AI targets**: Normal beats Easy ≥ 65%, Hard beats Normal ≥ 60% (seat-averaged). Say whether each is met
   and whether results moved compared to the previous run you know of.
