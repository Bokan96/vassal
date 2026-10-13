import { DECK_SIZE, isJoker, jokerOwner, NATURAL_COUNT, type CardId } from './cards.ts';
import { ALLIANCE_SIZE } from './config.ts';
import { legalMoves } from './rules.ts';
import type { GameState } from './state.ts';

/**
 * Check structural invariants that must hold after every completed move. Returns a description of
 * the first violation, or null. Used by property tests and the simulator.
 */
export function findInvariantViolation(s: GameState): string | null {
  const all: CardId[] = [...s.hands[0], ...s.hands[1], ...s.pile];
  for (let i = 0; i < s.houses.length; i++) {
    const h = s.houses[i]!;
    for (const p of [0, 1] as const) {
      const side = h.sides[p];
      all.push(...side);
      if (side.length > ALLIANCE_SIZE) return `house ${i}: player ${p} has ${side.length} cards`;
      if ((h.completedAt[p] !== null) !== (side.length === ALLIANCE_SIZE)) {
        return `house ${i}: completedAt of player ${p} out of sync`;
      }
      for (const c of side) {
        if (isJoker(c) && jokerOwner(c) !== p) return `house ${i}: joker on the wrong side (C3)`;
      }
    }
    if (!h.claim && h.sides[0].length === ALLIANCE_SIZE && h.sides[1].length === ALLIANCE_SIZE) {
      return `house ${i}: both alliances full but unclaimed`;
    }
    if (h.claim?.reason === 'proof' && h.sides[h.claim.by].length !== ALLIANCE_SIZE) {
      return `house ${i}: proof claim without a full alliance`;
    }
  }
  const expected = s.config.wildcards ? DECK_SIZE : NATURAL_COUNT;
  if (all.length !== expected) return `card count ${all.length}, expected ${expected}`;
  if (new Set(all).size !== all.length) return 'duplicate card';
  if (!s.config.wildcards && all.some(isJoker)) return 'joker in a no-wildcards game';
  if (!s.result && legalMoves(s).length === 0) return 'no legal move (C7)';
  return null;
}
