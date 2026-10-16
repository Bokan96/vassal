import { describe, expect, it } from 'vitest';
import {
  createRng,
  getPlayerView,
  isLegal,
  legalMoves,
  newGame,
  step,
  type GameState,
  type Player,
  type RulesConfig,
} from '../src/engine/index.ts';
import { STRATEGIES } from './strategies.ts';

function randomPosition(config: RulesConfig, seed: number, plies: number): GameState {
  const s = newGame(config, seed, (seed & 1) as Player);
  const rng = createRng(seed ^ 0xbeef);
  for (let i = 0; i < plies && !s.result; i++) {
    const moves = legalMoves(s);
    step(s, moves[rng.int(moves.length)]!);
  }
  return s;
}

const strategies = Object.keys(STRATEGIES).filter((s) => s !== 'hard' && s !== 'normal');

describe.each([
  { motive: true, wildcards: false },
  { motive: true, wildcards: true },
])('strategy bots (wildcards=$wildcards)', (config) => {
  it.each(strategies)('%s always returns a legal move', (name) => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = randomPosition(config, seed, seed % 45);
      if (s.result) continue;
      const move = STRATEGIES[name]!(getPlayerView(s, s.active), createRng(seed));
      expect(isLegal(s, move)).toBe(true);
    }
  });
});
