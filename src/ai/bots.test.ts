import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createRng,
  findInvariantViolation,
  getPlayerView,
  isLegal,
  legalMoves,
  newGame,
  parseCard,
  step,
  type GameState,
  type Player,
} from '../engine/index.ts';
import { makeState, withFullDeck } from '../engine/testing.ts';
import { chooseMove, viewMoves, type AiLevel } from './bots.ts';
import { determinize } from './determinize.ts';
import { evaluateView } from './evaluate.ts';

/** A random mid-game position. */
function randomPosition(seed: number, plies: number): GameState {
  const s = newGame({ motive: true, wildcards: true }, seed, (seed & 1) as Player);
  const rng = createRng(seed ^ 0x5eed);
  for (let i = 0; i < plies && !s.result; i++) {
    const moves = legalMoves(s);
    step(s, moves[rng.int(moves.length)]!);
  }
  return s;
}

describe('determinize', () => {
  it('produces a legal full state that looks identical from my seat', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 0, max: 40 }),
        fc.integer(),
        (seed, plies, sample) => {
          const s = randomPosition(seed, plies);
          if (s.result) return;
          const view = getPlayerView(s, s.active);
          const det = determinize(view, createRng(sample));
          expect(findInvariantViolation(det)).toBeNull();
          expect(getPlayerView(det, s.active)).toEqual(view);
        },
      ),
      { numRuns: 80 },
    );
  });
});

describe('bots', () => {
  it.each<AiLevel>(['random', 'easy', 'normal'])('%s always returns a legal move', (level) => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 50 }), (seed, plies) => {
        const s = randomPosition(seed, plies);
        if (s.result) return;
        const { move } = chooseMove(getPlayerView(s, s.active), level, { seed });
        expect(isLegal(s, move)).toBe(true);
      }),
      { numRuns: 40 },
    );
  });

  it('hard returns a legal move and is deterministic for a fixed iteration count', () => {
    for (const seed of [3, 17, 99]) {
      const s = randomPosition(seed, 12);
      const view = getPlayerView(s, s.active);
      const a = chooseMove(view, 'hard', { seed, iterations: 60 });
      const b = chooseMove(view, 'hard', { seed, iterations: 60 });
      expect(isLegal(s, a.move)).toBe(true);
      expect(b.move).toEqual(a.move);
      expect(a.stats.iterations).toBeLessThanOrEqual(60);
    }
  });

  it('only offers moves for the active seat', () => {
    const s = randomPosition(5, 3);
    expect(viewMoves(getPlayerView(s, s.active === 0 ? 1 : 0))).toEqual([]);
  });

  // Player 0 holds houses 6 and 7; K♠ completes an unbeatable J♠ Q♠ K♠ at house 8.
  const winningSpot = () =>
    withFullDeck(
      makeState({
        hands: ['2♦ K♠ 5♥', '3♣ 4♣'],
        pile: '9♦ 9♣ 8♦',
        houses: {
          6: { claim: { by: 0, reason: 'compare', turn: 1 } },
          7: { claim: { by: 0, reason: 'compare', turn: 1 } },
          8: { p0: 'J♠ Q♠' },
        },
      }),
    );

  it.each<AiLevel>(['easy', 'normal', 'hard'])('%s takes an immediate win', (level) => {
    const s = winningSpot();
    const { move } = chooseMove(getPlayerView(s, 0), level, { seed: 1, iterations: 40 });
    expect(move).toEqual({ type: 'play', card: parseCard('K♠'), house: 8 });
  });

  it('evaluates a won position as +1 and a lost one as -1', () => {
    const s = winningSpot();
    step(s, { type: 'play', card: parseCard('K♠'), house: 8 });
    expect(evaluateView(getPlayerView(s, 0)).value).toBe(1);
    expect(evaluateView(getPlayerView(s, 1)).value).toBe(-1);
  });
});
