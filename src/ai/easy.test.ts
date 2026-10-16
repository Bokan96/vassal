import { describe, expect, it } from 'vitest';
import { parseCard, parseCards } from '../engine/index.ts';
import { makeState } from '../engine/testing.ts';
import { scoreMoves } from './easy.ts';

describe('easy bot heuristics', () => {
  it('C14: does not count a pair card as its own third card for a Triumvirate', () => {
    // 7♣ and 7♦ are on the table, so 7♠ 7♥ can never become a Triumvirate; 7♠ 8♠ can still
    // become a Straight Flush.
    const s = makeState({
      hands: ['7♥ 8♠', ''],
      houses: { 0: { p0: '7♠' }, 3: { p1: '7♣' }, 5: { p1: '7♦' } },
    });
    const { moves, scores } = scoreMoves({
      config: s.config,
      me: 0,
      hand: parseCards('7♥ 8♠'),
      houses: s.houses,
    });
    const score = (card: string) =>
      scores[moves.findIndex((m) => m.house === 0 && m.card === parseCard(card))]!;
    expect(score('8♠')).toBeGreaterThan(score('7♥'));
  });
});
