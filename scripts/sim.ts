/**
 * Headless simulator: plays bot-vs-bot games and reports outcomes, tier statistics and any
 * invariant violation. Usage: npm run sim -- --games 500 --p0 easy --p1 normal [--variant all]
 */
import { parseArgs } from 'node:util';
import { chooseMove, type AiLevel } from '../src/ai/bots.ts';
import {
  ALLIANCE_SIZE,
  allianceStrength,
  findInvariantViolation,
  getPlayerView,
  isLegal,
  newGame,
  step,
  tierOf,
  TIER_NAMES,
  type Player,
  type RulesConfig,
  type WinReason,
} from '../src/engine/index.ts';

const VARIANTS: Record<string, RulesConfig> = {
  standard: { motive: true, wildcards: true },
  'no-motive': { motive: false, wildcards: true },
  'no-wildcards': { motive: true, wildcards: false },
  plain: { motive: false, wildcards: false },
};
const LEVELS: AiLevel[] = ['random', 'easy', 'normal', 'hard'];

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '200' },
    p0: { type: 'string', default: 'random' },
    p1: { type: 'string', default: 'random' },
    seed: { type: 'string', default: '1' },
    variant: { type: 'string', default: 'standard' },
    budget: { type: 'string', default: '300' },
  },
});

const games = Number(values.games);
const baseSeed = Number(values.seed);
const budgetMs = Number(values.budget);
const bots = [values.p0, values.p1] as AiLevel[];
for (const b of bots) {
  if (!LEVELS.includes(b)) throw new Error(`Unknown bot "${b}" (use ${LEVELS.join('|')})`);
}
const variants = values.variant === 'all' ? Object.keys(VARIANTS) : [values.variant!];

const pct = (n: number, d: number) => (d === 0 ? '-' : `${((100 * n) / d).toFixed(1)}%`);

let totalFailures = 0;
for (const variant of variants) {
  const config = VARIANTS[variant];
  if (!config) throw new Error(`Unknown variant "${variant}"`);
  const wins: [number, number] = [0, 0];
  const winsAsStarter: [number, number] = [0, 0];
  const reasons: Record<WinReason, number> = { five: 0, adjacent: 0, majority: 0 };
  const claims = { compare: 0, proof: 0, final: 0 };
  const tiers = new Array(TIER_NAMES.length).fill(0);
  const moveMs: [number, number] = [0, 0];
  const moveCount: [number, number] = [0, 0];
  let plies = 0;
  const failures: string[] = [];
  const started = Date.now();

  for (let g = 0; g < games; g++) {
    const seed = baseSeed + g;
    const start = (g % 2) as Player;
    const state = newGame(config, seed, start);
    let ply = 0;
    try {
      while (!state.result) {
        const p = state.active;
        const t0 = performance.now();
        const { move } = chooseMove(getPlayerView(state, p), bots[p]!, {
          seed: seed * 1000 + ply,
          budgetMs,
        });
        moveMs[p] += performance.now() - t0;
        moveCount[p]++;
        if (!isLegal(state, move)) throw new Error(`bot ${bots[p]} chose an illegal move`);
        step(state, move, (e) => {
          if (e.t === 'claimed') claims[e.claim.reason]++;
        });
        ply++;
        const violation = findInvariantViolation(state);
        if (violation) throw new Error(violation);
      }
    } catch (err) {
      failures.push(`seed ${seed} (start ${start}, ply ${ply}): ${(err as Error).message}`);
      continue;
    }
    const result = state.result!;
    wins[result.winner]++;
    if (result.winner === start) winsAsStarter[result.winner]++;
    reasons[result.reason]++;
    plies += ply;
    for (const h of state.houses) {
      for (const p of [0, 1] as const) {
        if (h.sides[p].length !== ALLIANCE_SIZE) continue;
        tiers[tierOf(allianceStrength(h.sides[p], config))]++;
      }
    }
  }

  const played = games - failures.length;
  const completed = tiers.reduce((a: number, b: number) => a + b, 0);
  console.log(`\n=== ${variant}: ${bots[0]} (p0) vs ${bots[1]} (p1), ${games} games ===`);
  console.log(
    `wins     p0 ${bots[0]}: ${wins[0]} (${pct(wins[0], played)})   p1 ${bots[1]}: ${wins[1]} (${pct(wins[1], played)})`,
  );
  console.log(`starter  won ${pct(winsAsStarter[0] + winsAsStarter[1], played)} of games`);
  console.log(
    `reason   five ${pct(reasons.five, played)}   adjacent ${pct(reasons.adjacent, played)}   majority ${pct(reasons.majority, played)}`,
  );
  console.log(
    `claims   compare ${claims.compare}   proof ${claims.proof}   final ${claims.final}   avg plies ${(plies / Math.max(1, played)).toFixed(1)}`,
  );
  console.log(
    `tiers    ${TIER_NAMES.slice(1)
      .map((name, i) => `${name} ${pct(tiers[i + 1], completed)}`)
      .join('   ')}`,
  );
  console.log(
    `ms/move  p0 ${(moveMs[0] / Math.max(1, moveCount[0])).toFixed(1)}   p1 ${(moveMs[1] / Math.max(1, moveCount[1])).toFixed(1)}   total ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  console.log(`failures ${failures.length}`);
  for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
  totalFailures += failures.length;
}

process.exitCode = totalFailures > 0 ? 1 : 0;
