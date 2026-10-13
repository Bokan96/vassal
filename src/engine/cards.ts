import type { Player } from './state.ts';

/**
 * Card identity as a small integer.
 * 0..51 are naturals: suit * 13 + (rank - 1), suits ordered ♠ ♣ ♥ ♦ (so colour = suit >> 1).
 * 52 is player 0's joker, 53 is player 1's joker (C3: jokers are public and owned).
 */
export type CardId = number;

export const NATURAL_COUNT = 52;
export const DECK_SIZE = 54;
export const SUIT_SYMBOLS = ['♠', '♣', '♥', '♦'] as const;
export const SUIT_NAMES = ['Spades', 'Clubs', 'Hearts', 'Diamonds'] as const;
export const RANK_LABELS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;
export const RANK_NAMES = [
  'Ace',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Jack',
  'Queen',
  'King',
] as const;

export const BLACK = 0;
export const RED = 1;

export const isJoker = (c: CardId): boolean => c >= NATURAL_COUNT;
export const suitOf = (c: CardId): number => Math.floor(c / 13);
/** Rank 1..13 (A = 1, J = 11, Q = 12, K = 13). */
export const rankOf = (c: CardId): number => (c % 13) + 1;
export const colorOf = (c: CardId): number => suitOf(c) >> 1;
export const cardId = (rank: number, suit: number): CardId => suit * 13 + (rank - 1);
export const jokerOf = (p: Player): CardId => NATURAL_COUNT + p;
export const jokerOwner = (c: CardId): Player => (c - NATURAL_COUNT) as Player;

export function formatCard(c: CardId): string {
  if (isJoker(c)) return '🃏';
  return RANK_LABELS[rankOf(c) - 1] + SUIT_SYMBOLS[suitOf(c)];
}

export function formatCards(cards: readonly CardId[]): string {
  return cards.map(formatCard).join(' ');
}

/**
 * Display order: by rank (A low), then colour (black before red), then suit (♠ ♣ ♥ ♦); jokers last.
 * Because suits are numbered ♠ ♣ ♥ ♦, colour-then-suit is simply the suit index.
 */
export function compareCards(a: CardId, b: CardId): number {
  const ja = isJoker(a);
  const jb = isJoker(b);
  if (ja || jb) return ja === jb ? a - b : ja ? 1 : -1;
  return rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b);
}

export function sortCards(cards: readonly CardId[]): CardId[] {
  return [...cards].sort(compareCards);
}

/** Human-readable name for screen readers, e.g. "Queen of Hearts". */
export function cardName(c: CardId): string {
  if (isJoker(c)) return 'Joker';
  return `${RANK_NAMES[rankOf(c) - 1]} of ${SUIT_NAMES[suitOf(c)]}`;
}

const SUIT_ALIASES: Record<string, number> = {
  '♠': 0,
  s: 0,
  S: 0,
  '♣': 1,
  c: 1,
  C: 1,
  '♥': 2,
  h: 2,
  H: 2,
  '♦': 3,
  d: 3,
  D: 3,
};

/**
 * Parse "10♥", "Q♠", "as", "🃏" (player 0's joker) or "🃏1" (player 1's joker).
 * Intended for tests and debugging.
 */
export function parseCard(text: string): CardId {
  const s = text.trim();
  if (s.startsWith('🃏')) {
    const owner = s.slice('🃏'.length);
    return jokerOf(owner === '1' ? 1 : 0);
  }
  const suit = SUIT_ALIASES[s.slice(-1)];
  const rankLabel = s.slice(0, -1).toUpperCase();
  const rank = RANK_LABELS.indexOf(rankLabel as (typeof RANK_LABELS)[number]) + 1;
  if (suit === undefined || rank === 0) throw new Error(`Cannot parse card "${text}"`);
  return cardId(rank, suit);
}

/** Parse a whitespace-separated list such as "2♠ 3♥ 4♣". */
export function parseCards(text: string): CardId[] {
  return text.split(/\s+/).filter(Boolean).map(parseCard);
}
