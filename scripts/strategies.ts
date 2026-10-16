/**
 * Strategy bots for playtesting the meta (analysis only, not used by the app).
 *
 * Most archetypes are the Easy heuristic plus a bias towards one plan, so they differ in intent
 * rather than skill. `trips-pure` is deliberately single-minded. Like the real bots, every
 * strategy sees only a PlayerView.
 */
import { chooseMove } from '../src/ai/bots.ts';
import { scoreMoves } from '../src/ai/easy.ts';
import {
  ALLIANCE_SIZE,
  allianceStrength,
  colorOf,
  isJoker,
  jokerOf,
  other,
  rankOf,
  suitOf,
  tablePool,
  Tier,
  tierOf,
  type CardId,
  type House,
  type Move,
  type PlayerView,
  type Rng,
} from '../src/engine/index.ts';

export type Strategy = (view: PlayerView, rng: Rng) => Move;

/** Same softmax temperature as the Easy bot, so biased bots play with the same "noise". */
const TEMPERATURE = 4;

function pick(moves: Move[], scores: number[], rng: Rng, temperature = TEMPERATURE): Move {
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[best]!) best = i;
  if (temperature <= 0) return moves[best]!;
  const top = scores[best]!;
  const weights = scores.map((s) => Math.exp((s - top) / temperature));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return moves[i]!;
  }
  return moves[best]!;
}

/** What a move would do to the viewer's side of its house. */
interface MoveContext {
  view: PlayerView;
  move: Move;
  house: House;
  /** The viewer's side after the move. */
  after: CardId[];
  /** Naturals on the viewer's side after the move. */
  naturals: CardId[];
  /** avail[c] = 1 when natural c is not on the table (it may be in a hand or the pile). */
  avail: Uint8Array;
}

const sameRank = (cards: CardId[]) => cards.every((c) => rankOf(c) === rankOf(cards[0]!));
const sameSuit = (cards: CardId[]) => cards.every((c) => suitOf(c) === suitOf(cards[0]!));
const sameColour = (cards: CardId[]) => cards.every((c) => colorOf(c) === colorOf(cards[0]!));

/** Could these naturals still be (part of) a run of three consecutive ranks? (ace low) */
function runPossible(cards: CardId[]): boolean {
  const ranks = cards.map(rankOf);
  if (new Set(ranks).size !== ranks.length) return false;
  return Math.max(...ranks) - Math.min(...ranks) <= 2;
}

/**
 * Copies of `rank` that could still join this side: not on the table and not already on it.
 * Cards in the viewer's hand count (they are the viewer's to play).
 */
function copiesLeft(rank: number, ctx: MoveContext): number {
  let n = 0;
  for (let s = 0; s < 4; s++) {
    const c = s * 13 + rank - 1;
    if (ctx.avail[c] && !ctx.after.includes(c)) n++;
  }
  return n;
}

/** Can this side still end up as a Three of a Kind? */
function tripsAlive(ctx: MoveContext): boolean {
  const { naturals, after, view } = ctx;
  if (naturals.length === 0) return true;
  if (!sameRank(naturals)) return false;
  const missing = ALLIANCE_SIZE - after.length;
  const joker = jokerOf(view.me);
  const jokerHelp = view.hand.includes(joker) && !after.some(isJoker) ? 1 : 0;
  return copiesLeft(rankOf(naturals[0]!), ctx) + jokerHelp >= missing;
}

function contexts(view: PlayerView, moves: Move[]): MoveContext[] {
  const { avail } = tablePool(view.houses, view.config);
  return moves.map((move) => {
    const house = view.houses[move.house]!;
    const after = [...house.sides[view.me], move.card];
    return { view, move, house, after, naturals: after.filter((c) => !isJoker(c)), avail };
  });
}

/** Build a strategy from the Easy scores plus a bias. */
function biased(bias: (ctx: MoveContext) => number): Strategy {
  return (view, rng) => {
    const { moves, scores } = scoreMoves({
      config: view.config,
      me: view.me,
      hand: view.hand,
      houses: view.houses,
    });
    const ctxs = contexts(view, moves);
    // Claimed houses are pure discards: leave the Easy score alone there.
    const biasedScores = scores.map((s, i) => (ctxs[i]!.house.claim ? s : s + bias(ctxs[i]!)));
    return pick(moves, biasedScores, rng);
  };
}

const builtIn =
  (level: 'random' | 'easy' | 'normal' | 'hard'): Strategy =>
  (view, rng) =>
    chooseMove(view, level, { seed: rng.int(2 ** 31), budgetMs: 300 }).move;

// ---------------------------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------------------------

/** Easy, but strongly prefers building and completing Three of a Kind while it is alive. */
const tripsLean = biased((ctx) => {
  const n = ctx.after.length;
  if (n === 1) {
    // Open with a rank I hold more copies of.
    const r = rankOf(ctx.move.card);
    if (isJoker(ctx.move.card)) return 0;
    const twins = ctx.view.hand.filter(
      (c) => c !== ctx.move.card && !isJoker(c) && rankOf(c) === r,
    );
    return twins.length > 0 && tripsAlive(ctx) ? 10 : 0;
  }
  if (!tripsAlive(ctx)) return 0;
  return n === ALLIANCE_SIZE ? 35 : 22;
});

const straight = biased((ctx) => {
  const n = ctx.after.length;
  if (n < 2 || !runPossible(ctx.naturals)) return 0;
  return n === ALLIANCE_SIZE ? 25 : 16;
});

const flush = biased((ctx) => {
  const n = ctx.after.length;
  if (n < 2 || !sameSuit(ctx.naturals)) return 0;
  return n === ALLIANCE_SIZE ? 25 : 16;
});

const colour = biased((ctx) => {
  const n = ctx.after.length;
  if (n < 2 || !sameColour(ctx.naturals)) return 0;
  return n === ALLIANCE_SIZE ? 20 : 12;
});

/** Finish alliances quickly: completion wins ties and lets proofs lock houses early. */
const rusher = biased((ctx) => {
  const n = ctx.after.length;
  if (n === ALLIANCE_SIZE) return 22;
  if (n === 2) return 8;
  return -8;
});

/** Spread out and wait: open new houses, only complete when the alliance is decent. */
const waiter = biased((ctx) => {
  const n = ctx.after.length;
  if (n === 1) return 8;
  if (n === ALLIANCE_SIZE) {
    const tier = tierOf(allianceStrength(ctx.after, ctx.view.config));
    return tier >= Tier.Plan ? 6 : -20;
  }
  return 0;
});

/** Play for three adjacent houses in the middle of the row. */
const centre = biased((ctx) => {
  const i = ctx.move.house;
  const me = ctx.view.me;
  const houses = ctx.view.houses;
  let b = i >= 2 && i <= 6 ? 6 : -6;
  for (const j of [i - 1, i + 1]) if (houses[j]?.claim?.by === me) b += 6;
  return b;
});

/** Avoid fights: prefer houses the opponent has not committed to, ignore adjacency. */
const spread = biased((ctx) => {
  const theirs = ctx.house.sides[other(ctx.view.me)].length;
  return theirs === 0 ? 8 : -4 * theirs;
});

/**
 * Single-minded Three of a Kind hunter. It only builds same-rank sides; every other card is dumped
 * where it hurts least (claimed houses, then sides that are already broken).
 */
const tripsPure: Strategy = (view, rng) => {
  const moves: Move[] = [];
  for (let house = 0; house < view.houses.length; house++) {
    if (view.houses[house]!.sides[view.me].length >= ALLIANCE_SIZE) continue;
    for (const card of view.hand) moves.push({ type: 'play', card, house });
  }
  const ctxs = contexts(view, moves);
  const scores = ctxs.map((ctx) => {
    const { move, after, naturals, house } = ctx;
    const n = after.length;
    const card = move.card;
    const r = isJoker(card) ? 0 : rankOf(card);
    if (house.claim) return isJoker(card) ? -200 : 5 - r / 10; // free discard
    const before = after.slice(0, -1);
    const beforeCtx = { ...ctx, after: before, naturals: before.filter((c) => !isJoker(c)) };
    const sideWasLive = before.length > 0 && tripsAlive(beforeCtx);
    if (isJoker(card)) {
      // Only spend the joker to finish a Three of a Kind.
      return n === ALLIANCE_SIZE && sameRank(naturals) ? 100 : -150;
    }
    if (tripsAlive(ctx)) {
      if (n === ALLIANCE_SIZE) return 90 + r / 10;
      if (n === 2) return 60 + r / 10;
      // Opening: favour ranks I already hold twice and ranks with many copies left.
      const twins = view.hand.filter((c) => c !== card && !isJoker(c) && rankOf(c) === r).length;
      return 20 + 12 * twins + 3 * copiesLeft(r, ctx) + r / 10;
    }
    // Not a Three of a Kind: dump it, preferably on a side that is already broken.
    if (sideWasLive) return -60; // would ruin a live attempt
    const brokenSide = before.length > 0 ? 0 : -10; // don't waste an empty house
    const handsOverHouse = n === ALLIANCE_SIZE ? -8 : 0;
    return brokenSide + handsOverHouse - r / 10;
  });
  return pick(moves, scores, rng, 0.5);
};

export const STRATEGIES: Record<string, Strategy> = {
  random: builtIn('random'),
  easy: builtIn('easy'),
  normal: builtIn('normal'),
  hard: builtIn('hard'),
  'trips-pure': tripsPure,
  'trips-lean': tripsLean,
  straight,
  flush,
  colour,
  rusher,
  waiter,
  centre,
  spread,
};
