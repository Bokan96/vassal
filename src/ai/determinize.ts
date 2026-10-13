import {
  jokerOf,
  NATURAL_COUNT,
  other,
  shuffle,
  type CardId,
  type GameState,
  type PlayerView,
  type Rng,
} from '../engine/index.ts';
import { cloneHouse } from '../engine/state.ts';

/**
 * Sample a full game state consistent with what `view.me` knows: the unseen naturals (neither on
 * the table nor in my hand) are shuffled between the opponent's hand and the draw pile. The
 * opponent's joker is in their hand iff it is not on the table (C3).
 */
export function determinize(view: PlayerView, rng: Rng): GameState {
  const me = view.me;
  const opp = other(me);
  const seen = new Uint8Array(NATURAL_COUNT + 2);
  for (const c of view.hand) seen[c] = 1;
  for (const h of view.houses) for (const side of h.sides) for (const c of side) seen[c] = 1;

  const unseen: CardId[] = [];
  for (let c = 0; c < NATURAL_COUNT; c++) if (!seen[c]) unseen.push(c);
  shuffle(unseen, rng);

  const oppJoker = jokerOf(opp);
  const oppHand: CardId[] = [];
  if (view.config.wildcards && !seen[oppJoker]) oppHand.push(oppJoker);
  const naturalsInOppHand = view.oppHandCount - oppHand.length;
  oppHand.push(...unseen.slice(0, naturalsInOppHand));
  const pile = unseen.slice(naturalsInOppHand);
  if (pile.length !== view.pileCount) {
    throw new Error(
      `Inconsistent view: ${pile.length} unseen cards for a pile of ${view.pileCount}`,
    );
  }

  const hands: [CardId[], CardId[]] = [[], []];
  hands[me] = view.hand.slice();
  hands[opp] = oppHand;
  return {
    v: 1,
    config: view.config,
    start: view.start,
    turn: view.turn,
    active: view.active,
    hands,
    pile,
    houses: view.houses.map(cloneHouse),
    result: view.result ? { ...view.result, houses: view.result.houses.slice() } : null,
  };
}
