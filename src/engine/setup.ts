import { jokerOf, NATURAL_COUNT, type CardId } from './cards.ts';
import { dealSize, HOUSE_COUNT, type RulesConfig } from './config.ts';
import { createRng, shuffle } from './rng.ts';
import { emptyHouse, type GameState, type Player } from './state.ts';

/**
 * Set up a new game: shuffle the 52 naturals, deal 6 to each player plus their own joker
 * (or 7 without wildcards), and leave the rest as the draw pile.
 */
export function newGame(config: RulesConfig, seed: number, start: Player): GameState {
  const rng = createRng(seed);
  const naturals: CardId[] = Array.from({ length: NATURAL_COUNT }, (_, i) => i);
  shuffle(naturals, rng);
  const n = dealSize(config);
  const hands: [CardId[], CardId[]] = [naturals.slice(0, n), naturals.slice(n, 2 * n)];
  if (config.wildcards) {
    hands[0].push(jokerOf(0));
    hands[1].push(jokerOf(1));
  }
  return {
    v: 1,
    config,
    start,
    turn: 1,
    active: start,
    hands,
    pile: naturals.slice(2 * n),
    houses: Array.from({ length: HOUSE_COUNT }, emptyHouse),
    result: null,
  };
}
