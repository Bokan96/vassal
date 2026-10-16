/**
 * Strategy tournament: round robin between the strategy bots in scripts/strategies.ts.
 * Usage: npm run meta -- --games 400 --variant default --out <file-prefix> [--bots a,b,c]
 * Variants: default (no wildcards), jokers, no-colour (no wildcards, no Same Colour level).
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  ALLIANCE_SIZE,
  allianceStrength,
  createRng,
  findInvariantViolation,
  getPlayerView,
  isJoker,
  isLegal,
  newGame,
  rankOf,
  step,
  TIER_NAMES,
  Tier,
  tierOf,
  type CardId,
  type GameState,
  type Player,
  type RulesConfig,
} from '../src/engine/index.ts';
import { STRATEGIES } from './strategies.ts';

const VARIANTS: Record<string, RulesConfig> = {
  default: { motive: true, wildcards: false },
  jokers: { motive: true, wildcards: true },
  'no-colour': { motive: false, wildcards: false },
};

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '400' },
    variant: { type: 'string', default: 'default' },
    bots: { type: 'string' },
    seed: { type: 'string', default: '1' },
    out: { type: 'string' },
  },
});

const GAMES = Number(values.games);
const config = VARIANTS[values.variant!];
if (!config) throw new Error(`Unknown variant ${values.variant}`);
const bots = (
  values.bots ??
  Object.keys(STRATEGIES)
    .filter((b) => b !== 'hard')
    .join(',')
)
  .split(',')
  .map((b) => b.trim());
for (const b of bots) if (!STRATEGIES[b]) throw new Error(`Unknown bot ${b}`);
const baseSeed = Number(values.seed);

/** Per-bot statistics. */
interface BotStats {
  games: number;
  wins: number;
  winReasons: Record<string, number>;
  /** Completed alliances by tier. */
  completed: number[];
  /** Houses won, by the tier of the winning side (Incomplete for C8 endings). */
  wonByTier: number[];
  /** Houses lost while holding a completed side of this tier. */
  lostByTier: number[];
  claims: { compare: number; proof: number; final: number };
  trips: {
    /** Sides that held a natural pair of one rank at some point. */
    attempts: number;
    completed: number;
    /** Houses won by sides that attempted / completed a Three of a Kind. */
    attemptWon: number;
    completedWon: number;
    /** Where the missing copies of a failed attempt's rank ended up. */
    missingCopies: {
      oppTable: number;
      oppHand: number;
      ownElsewhere: number;
      ownHand: number;
      pile: number;
    };
  };
}

const newStats = (): BotStats => ({
  games: 0,
  wins: 0,
  winReasons: { five: 0, adjacent: 0, majority: 0 },
  completed: new Array(TIER_NAMES.length).fill(0),
  wonByTier: new Array(TIER_NAMES.length).fill(0),
  lostByTier: new Array(TIER_NAMES.length).fill(0),
  claims: { compare: 0, proof: 0, final: 0 },
  trips: {
    attempts: 0,
    completed: 0,
    attemptWon: 0,
    completedWon: 0,
    missingCopies: { oppTable: 0, oppHand: 0, ownElsewhere: 0, ownHand: 0, pile: 0 },
  },
});

const stats = new Map(bots.map((b) => [b, newStats()]));
/** wins[a][b] = games bot a won against bot b; played[a][b] likewise. */
const wins: Record<string, Record<string, number>> = {};
const played: Record<string, Record<string, number>> = {};
for (const a of bots) {
  wins[a] = {};
  played[a] = {};
  for (const b of bots) {
    wins[a]![b] = 0;
    played[a]![b] = 0;
  }
}
let starterWins = 0;
let totalGames = 0;
let totalPlies = 0;
const failures: string[] = [];

const naturalPairRank = (side: CardId[]): number | null => {
  const nats = side.filter((c) => !isJoker(c));
  if (nats.length < 2) return null;
  const r = rankOf(nats[0]!);
  return nats.slice(0, 2).every((c) => rankOf(c) === r) ? r : null;
};

function playGame(names: [string, string], seed: number, start: Player): GameState {
  const state = newGame(config!, seed, start);
  const rngs = [createRng(seed * 7 + 1), createRng(seed * 7 + 2)];
  // Track Three of a Kind attempts: key `${house}:${seat}` -> rank.
  const attempts = new Map<string, number>();
  let ply = 0;
  while (!state.result) {
    const p = state.active;
    const move = STRATEGIES[names[p]]!(getPlayerView(state, p), rngs[p]!);
    if (!isLegal(state, move)) throw new Error(`${names[p]} chose an illegal move`);
    step(state, move, (e) => {
      if (e.t === 'claimed') stats.get(names[e.claim.by])!.claims[e.claim.reason]++;
    });
    ply++;
    const violation = findInvariantViolation(state);
    if (violation) throw new Error(violation);
    const side = state.houses[move.house]!.sides[p];
    const pairRank = naturalPairRank(side);
    const key = `${move.house}:${p}`;
    if (pairRank !== null && !attempts.has(key)) attempts.set(key, pairRank);
  }
  totalPlies += ply;

  // House-level statistics.
  state.houses.forEach((h, i) => {
    for (const p of [0, 1] as const) {
      const s = stats.get(names[p])!;
      const full = h.sides[p].length === ALLIANCE_SIZE;
      const tier = full ? tierOf(allianceStrength(h.sides[p], config!)) : Tier.Incomplete;
      if (full) s.completed[tier]++;
      if (h.claim?.by === p) s.wonByTier[tier]++;
      else if (h.claim && full) s.lostByTier[tier]++;
      const rank = attempts.get(`${i}:${p}`);
      if (rank === undefined) continue;
      s.trips.attempts++;
      const won = h.claim?.by === p;
      if (won) s.trips.attemptWon++;
      if (tier === Tier.Triumvirate) {
        s.trips.completed++;
        if (won) s.trips.completedWon++;
      } else {
        // Where did the other copies of this rank go?
        const opp = (1 - p) as Player;
        for (let suit = 0; suit < 4; suit++) {
          const c = suit * 13 + rank - 1;
          if (h.sides[p].includes(c)) continue;
          const m = s.trips.missingCopies;
          if (state.houses.some((x) => x.sides[opp].includes(c))) m.oppTable++;
          else if (state.hands[opp].includes(c)) m.oppHand++;
          else if (state.houses.some((x) => x.sides[p].includes(c))) m.ownElsewhere++;
          else if (state.hands[p].includes(c)) m.ownHand++;
          else m.pile++;
        }
      }
    }
  });
  return state;
}

const started = Date.now();
const pairs: [string, string][] = [];
for (let i = 0; i < bots.length; i++)
  for (let j = i + 1; j < bots.length; j++) pairs.push([bots[i]!, bots[j]!]);

pairs.forEach(([a, b], pi) => {
  for (let g = 0; g < GAMES; g++) {
    // Alternate seats and starting player so neither bot gets a positional edge.
    const aSeat = (g % 2) as Player;
    const start = ((g >> 1) % 2) as Player;
    const names: [string, string] = aSeat === 0 ? [a, b] : [b, a];
    const seed = baseSeed + pi * 100_000 + g;
    try {
      const state = playGame(names, seed, start);
      const r = state.result!;
      const winner = names[r.winner];
      const loser = names[1 - r.winner];
      wins[winner]![loser]!++;
      played[a]![b]!++;
      played[b]![a]!++;
      const ws = stats.get(winner)!;
      ws.wins++;
      ws.winReasons[r.reason]!++;
      stats.get(a)!.games++;
      stats.get(b)!.games++;
      if (r.winner === start) starterWins++;
      totalGames++;
    } catch (err) {
      failures.push(`${a} vs ${b} seed ${seed}: ${(err as Error).message}`);
    }
  }
  process.stderr.write(`  ${pi + 1}/${pairs.length} ${a} vs ${b}\n`);
});

// Elo-style ratings fitted to all results (logistic, 400-point scale), centred on easy = 0.
const elo = new Map(bots.map((b) => [b, 0]));
for (let iter = 0; iter < 2000; iter++) {
  for (const a of bots) {
    let grad = 0;
    for (const b of bots) {
      if (a === b || played[a]![b] === 0) continue;
      const expected = 1 / (1 + 10 ** ((elo.get(b)! - elo.get(a)!) / 400));
      grad += wins[a]![b]! - expected * played[a]![b]!;
    }
    elo.set(a, elo.get(a)! + grad * 0.05);
  }
}
const anchor = elo.get('easy') ?? 0;
for (const b of bots) elo.set(b, Math.round(elo.get(b)! - anchor));

const pct = (n: number, d: number) => (d === 0 ? '–' : `${Math.round((100 * n) / d)}%`);
const ranking = [...bots].sort((x, y) => elo.get(y)! - elo.get(x)!);
const lines: string[] = [];
lines.push(`# Meta tournament — variant: ${values.variant}`);
lines.push(
  `${GAMES} games per pairing, ${totalGames} games, ${failures.length} failures, starter won ${pct(starterWins, totalGames)}, ` +
    `avg ${(totalPlies / Math.max(1, totalGames)).toFixed(1)} plies, ${((Date.now() - started) / 1000).toFixed(0)} s`,
);
lines.push(
  '',
  '## Ranking',
  '',
  '| Bot | Elo | Win % | Five | Adjacent | Majority | Proof claims | Completed: tier mix |',
  '|---|---|---|---|---|---|---|---|',
);
for (const b of ranking) {
  const s = stats.get(b)!;
  const done = s.completed.reduce((x, y) => x + y, 0);
  const mix = TIER_NAMES.map((n, t) => (s.completed[t] ? `${n} ${pct(s.completed[t]!, done)}` : ''))
    .filter(Boolean)
    .join(', ');
  const claimsTotal = s.claims.compare + s.claims.proof + s.claims.final;
  lines.push(
    `| ${b} | ${elo.get(b)} | ${pct(s.wins, s.games)} | ${pct(s.winReasons.five!, s.wins)} | ${pct(s.winReasons.adjacent!, s.wins)} | ${pct(s.winReasons.majority!, s.wins)} | ${pct(s.claims.proof, claimsTotal)} | ${mix} |`,
  );
}
lines.push('', '## Win-rate matrix (row bot vs column bot)', '');
lines.push(`| | ${ranking.join(' | ')} |`, `|---|${ranking.map(() => '---').join('|')}|`);
for (const a of ranking) {
  lines.push(
    `| ${a} | ${ranking.map((b) => (a === b ? '·' : pct(wins[a]![b]!, played[a]![b]!))).join(' | ')} |`,
  );
}
lines.push('', '## How often each tier wins its house (completed sides only)', '');
lines.push(`| Tier | ${ranking.join(' | ')} |`, `|---|${ranking.map(() => '---').join('|')}|`);
for (let t = Tier.Triumvirate; t >= Tier.Discord; t--) {
  lines.push(
    `| ${TIER_NAMES[t]} | ${ranking
      .map((b) => {
        const s = stats.get(b)!;
        const n = s.wonByTier[t]! + s.lostByTier[t]!;
        return n < 20 ? '–' : pct(s.wonByTier[t]!, n);
      })
      .join(' | ')} |`,
  );
}
lines.push('', '## Three of a Kind', '');
lines.push(
  '| Bot | Attempts / game | Completed / game | Conversion | Attempt house win % | Completed house win % | Missing copies: opp table / opp hand / own elsewhere / own hand / pile |',
  '|---|---|---|---|---|---|---|',
);
for (const b of ranking) {
  const s = stats.get(b)!;
  const t = s.trips;
  const m = t.missingCopies;
  const mt = m.oppTable + m.oppHand + m.ownElsewhere + m.ownHand + m.pile;
  lines.push(
    `| ${b} | ${(t.attempts / s.games).toFixed(2)} | ${(t.completed / s.games).toFixed(2)} | ${pct(t.completed, t.attempts)} | ${pct(t.attemptWon, t.attempts)} | ${pct(t.completedWon, t.completed)} | ${pct(m.oppTable, mt)} / ${pct(m.oppHand, mt)} / ${pct(m.ownElsewhere, mt)} / ${pct(m.ownHand, mt)} / ${pct(m.pile, mt)} |`,
  );
}
if (failures.length)
  lines.push('', '## Failures', '', ...failures.slice(0, 20).map((f) => `- ${f}`));

const report = lines.join('\n');
console.log(report);
if (values.out) {
  writeFileSync(`${values.out}.md`, report);
  writeFileSync(
    `${values.out}.json`,
    JSON.stringify(
      {
        variant: values.variant,
        config,
        games: GAMES,
        totalGames,
        starterWins,
        failures,
        elo: Object.fromEntries(elo),
        wins,
        played,
        stats: Object.fromEntries(stats),
      },
      null,
      2,
    ),
  );
}
process.exitCode = failures.length > 0 ? 1 : 0;
