import type { CardId } from './cards.ts';
import type { RulesConfig } from './config.ts';
import type { Strength } from './strength.ts';

export type Player = 0 | 1;
export const PLAYERS: readonly Player[] = [0, 1];
export const other = (p: Player): Player => (p === 0 ? 1 : 0);

/**
 * How a house was won:
 * - compare: both alliances were full and the stronger (or first completed) won.
 * - proof: the claimant proved the opponent cannot beat their full alliance (C4, C11).
 * - final: resolved after every card was played in the no-wildcards variant (C8).
 */
export type ClaimReason = 'compare' | 'proof' | 'final';

export interface Claim {
  by: Player;
  reason: ClaimReason;
  /** The ply on which the claim was made. */
  turn: number;
  /** For proof claims: the strongest alliance the opponent could still form there. */
  oppBest?: Strength;
}

export interface House {
  /** Cards assigned by each player, in play order (max 3 per side). */
  sides: [CardId[], CardId[]];
  /** Ply on which each side's alliance became full, used for tie-breaks. */
  completedAt: [number | null, number | null];
  claim: Claim | null;
}

export type WinReason = 'five' | 'adjacent' | 'majority';

export interface GameResult {
  winner: Player;
  reason: WinReason;
  /** The houses that satisfied the win condition (for highlighting). */
  houses: number[];
}

export interface GameState {
  v: 1;
  config: RulesConfig;
  /** The starting player (also wins incomplete-vs-incomplete ties, C8). */
  start: Player;
  /** Ply counter, starting at 1. */
  turn: number;
  active: Player;
  hands: [CardId[], CardId[]];
  /** Draw pile; the next card drawn is the last element. */
  pile: CardId[];
  houses: House[];
  result: GameResult | null;
}

export function emptyHouse(): House {
  return { sides: [[], []], completedAt: [null, null], claim: null };
}

export function cloneHouse(h: House): House {
  return {
    sides: [h.sides[0].slice(), h.sides[1].slice()],
    completedAt: [h.completedAt[0], h.completedAt[1]],
    claim: h.claim ? { ...h.claim } : null,
  };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    hands: [s.hands[0].slice(), s.hands[1].slice()],
    pile: s.pile.slice(),
    houses: s.houses.map(cloneHouse),
    result: s.result ? { ...s.result, houses: s.result.houses.slice() } : null,
  };
}
