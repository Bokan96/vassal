import {
  ALLIANCE_SIZE,
  createRng,
  getPlayerView,
  playCard,
  resolveAllegiances,
  step,
  type GameState,
  type Move,
  type PlayerView,
  type Rng,
} from '../engine/index.ts';
import { determinize } from './determinize.ts';
import { chooseEasy } from './easy.ts';
import { evaluateHouses, evaluateView, knowledge } from './evaluate.ts';

export type AiLevel = 'random' | 'easy' | 'normal' | 'hard';

export interface BotOptions {
  /** Seed for the bot's own randomness (sampling, tie-breaking). */
  seed: number;
  /** Time budget for Hard, in milliseconds. */
  budgetMs?: number;
  /** Fixed iteration count for Hard (overrides the budget; used by tests for determinism). */
  iterations?: number;
}

export interface BotResult {
  move: Move;
  stats: { level: AiLevel; candidates: number; iterations: number; ms: number };
}

/** Legal moves computed from a player view (same rules as legalMoves on the full state). */
export function viewMoves(view: PlayerView): Move[] {
  if (view.result || view.active !== view.me) return [];
  const moves: Move[] = [];
  view.houses.forEach((h, house) => {
    if (h.sides[view.me].length >= ALLIANCE_SIZE) return;
    for (const card of view.hand) moves.push({ type: 'play', card, house });
  });
  return moves;
}

const policyInput = (s: GameState) => ({
  config: s.config,
  me: s.active,
  hand: s.hands[s.active],
  houses: s.houses,
});

/**
 * Value of a move from the mover's perspective without seeing the draw: play it on a
 * determinized copy, resolve allegiances (which only uses the table and card counts), evaluate.
 */
function afterMoveValue(view: PlayerView, move: Move, rng: Rng): number {
  const s = determinize(view, rng);
  playCard(s, move);
  resolveAllegiances(s);
  if (s.result) return s.result.winner === view.me ? 2 : -2;
  const after = getPlayerView(s, view.me);
  return evaluateHouses(after.houses, knowledge(after)).value;
}

function rankMoves(view: PlayerView, rng: Rng): { move: Move; value: number }[] {
  const ranked = viewMoves(view).map((move) => ({ move, value: afterMoveValue(view, move, rng) }));
  ranked.sort((a, b) => b.value - a.value);
  return ranked;
}

function chooseNormal(view: PlayerView, rng: Rng): Move {
  return rankMoves(view, rng)[0]!.move;
}

/**
 * Perfect-information Monte Carlo: sample hidden cards, try the most promising moves, play the
 * game on with the fast Easy policy and score the outcome (or the evaluation at the depth cut).
 */
function chooseHard(
  view: PlayerView,
  rng: Rng,
  opts: BotOptions,
): BotResult['stats'] & { move: Move } {
  const started = Date.now();
  const ranked = rankMoves(view, rng);
  if (ranked.length === 1 || ranked[0]!.value >= 2) {
    return { move: ranked[0]!.move, level: 'hard', candidates: 1, iterations: 0, ms: 0 };
  }
  const candidates = ranked.slice(0, 10);
  const visits = new Array(candidates.length).fill(0);
  const totals = new Array(candidates.length).fill(0);
  const maxIterations = opts.iterations ?? Infinity;
  const budget = opts.iterations ? Infinity : (opts.budgetMs ?? 800);
  const depth = 14;
  let iterations = 0;

  while (iterations < maxIterations) {
    if (iterations % 16 === 0 && Date.now() - started > budget) break;
    // UCB1 over the candidate moves.
    let pick = 0;
    let bestUcb = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (visits[i] === 0) {
        pick = i;
        break;
      }
      const ucb = totals[i] / visits[i] + 0.6 * Math.sqrt(Math.log(iterations + 1) / visits[i]);
      if (ucb > bestUcb) {
        bestUcb = ucb;
        pick = i;
      }
    }
    const s = determinize(view, rng);
    step(s, candidates[pick]!.move);
    for (let ply = 0; ply < depth && !s.result; ply++)
      step(s, chooseEasy(policyInput(s), rng, 1.5));
    const reward = s.result
      ? s.result.winner === view.me
        ? 1
        : 0
      : (evaluateView(getPlayerView(s, view.me)).value + 1) / 2;
    visits[pick]++;
    totals[pick] += reward;
    iterations++;
  }
  let best = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (totals[i] / Math.max(1, visits[i]) > totals[best] / Math.max(1, visits[best])) best = i;
  }
  return {
    move: candidates[best]!.move,
    level: 'hard',
    candidates: candidates.length,
    iterations,
    ms: Date.now() - started,
  };
}

/** Choose a move for `view.me`, who must be the active player. Uses the view only. */
export function chooseMove(view: PlayerView, level: AiLevel, opts: BotOptions): BotResult {
  const started = Date.now();
  const rng = createRng(opts.seed);
  const moves = viewMoves(view);
  if (moves.length === 0) throw new Error('The bot has no legal move');
  const stats = (candidates: number): BotResult['stats'] => ({
    level,
    candidates,
    iterations: 0,
    ms: Date.now() - started,
  });
  switch (level) {
    case 'random':
      return { move: moves[rng.int(moves.length)]!, stats: stats(moves.length) };
    case 'easy':
      return {
        move: chooseEasy(
          { config: view.config, me: view.me, hand: view.hand, houses: view.houses },
          rng,
          4,
        ),
        stats: stats(moves.length),
      };
    case 'normal':
      return { move: chooseNormal(view, rng), stats: stats(moves.length) };
    case 'hard': {
      const { move, ...rest } = chooseHard(view, rng, opts);
      return { move, stats: rest };
    }
  }
}
