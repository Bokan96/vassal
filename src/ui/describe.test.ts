import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseCards, type House } from '../engine/index.ts';
import { allianceLabel, claimExplanation } from './describe.ts';

const names: [string, string] = ['You', 'Opponent'];
const house = (p0: string, p1: string, claim: House['claim']): House => ({
  sides: [parseCards(p0), parseCards(p1)],
  completedAt: [1, 2],
  claim,
});

describe('alliance labels', () => {
  it('show the tier power without the rank sum, cards in display order', () => {
    expect(allianceLabel(parseCards('4♣ 2♠ 3♥'), DEFAULT_CONFIG)).toBe('Plan (4): 2♠ 3♥ 4♣');
  });

  it('place a joker where the card it mirrors sorts', () => {
    expect(allianceLabel(parseCards('🃏 7♠ 5♠'), DEFAULT_CONFIG)).toBe(
      'Coup (6): 5♠ Joker as 6♠ 7♠',
    );
  });
});

describe('claim explanations', () => {
  it('compare tiers by name when the tiers differ', () => {
    const h = house('2♠ 3♥ 4♣', '2♠ 4♠ 6♠', { by: 0, reason: 'compare', turn: 3 });
    expect(claimExplanation(h, DEFAULT_CONFIG, names)).toBe(
      'Plan (4): 2♠ 3♥ 4♣ beats Intent (3): 2♠ 4♠ 6♠',
    );
  });

  it('mention rank sums only when the tiers are equal', () => {
    const h = house('2♠ 4♥ 9♣', '2♦ 4♥ 6♣', { by: 0, reason: 'compare', turn: 3 });
    expect(claimExplanation(h, DEFAULT_CONFIG, names)).toBe(
      'Discord (1): 2♠ 4♥ 9♣ against Discord (1): 2♦ 4♥ 6♣, higher rank sum 15 vs 12',
    );
  });

  it('explain proofs with the best alliance the opponent could still form', () => {
    const h = house('2♠ 3♠ 4♠', '4♦ 9♣', { by: 0, reason: 'proof', turn: 3, oppBest: 64 + 26 });
    expect(claimExplanation(h, DEFAULT_CONFIG, names)).toBe(
      'Coup (6): 2♠ 3♠ 4♠ is unbeatable: the best the opponent could still form is Discord (1)',
    );
  });
});
