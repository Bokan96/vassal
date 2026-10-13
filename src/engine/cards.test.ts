import { describe, expect, it } from 'vitest';
import { formatCards, parseCards, sortCards } from './cards.ts';

describe('sortCards', () => {
  it('orders by rank, then colour (black first), then suit, with jokers last', () => {
    const sorted = sortCards(parseCards('🃏 K♦ 2♥ A♣ 2♠ 2♦ 10♣ 2♣ A♠'));
    expect(formatCards(sorted)).toBe('A♠ A♣ 2♠ 2♣ 2♥ 2♦ 10♣ K♦ 🃏');
  });

  it('does not change its input', () => {
    const cards = parseCards('K♠ 2♠');
    sortCards(cards);
    expect(formatCards(cards)).toBe('K♠ 2♠');
  });
});
