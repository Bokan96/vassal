import { describe, expect, it } from 'vitest';
import {
  allianceStrength,
  DEFAULT_CONFIG,
  parseCards,
  type GameResult,
  type House,
} from '../engine/index.ts';
import { allianceLabel, claimExplanation, starRating } from './describe.ts';
import { DICTS, type Role } from './i18n.ts';

const en = DICTS.en;
const sr = DICTS.sr;
const roles: [Role, Role] = ['you', 'opponent'];
const house = (p0: string, p1: string, claim: House['claim']): House => ({
  sides: [parseCards(p0), parseCards(p1)],
  completedAt: [1, 2],
  claim,
});

describe('alliance labels', () => {
  it('show the level name and its stars, cards in display order', () => {
    expect(allianceLabel(parseCards('4♣ 2♠ 3♥'), DEFAULT_CONFIG, en)).toBe(
      'Straight ★★★☆☆☆: 2♠ 3♥ 4♣',
    );
  });

  it('place a joker where the card it mirrors sorts', () => {
    expect(allianceLabel(parseCards('🃏 7♠ 5♠'), DEFAULT_CONFIG, en)).toBe(
      'Straight Flush ★★★★★☆: 5♠ Joker as 6♠ 7♠',
    );
  });

  it('use the Serbian level names', () => {
    expect(allianceLabel(parseCards('7♠ 7♥ 7♦'), DEFAULT_CONFIG, sr)).toBe(
      'Tripleta ★★★★★★: 7♠ 7♥ 7♦',
    );
    expect(allianceLabel(parseCards('🃏 7♠ 5♠'), DEFAULT_CONFIG, sr)).toBe(
      'Niz znak ★★★★★☆: 5♠ Džoker kao 6♠ 7♠',
    );
  });
});

describe('claim explanations', () => {
  it('compare tiers by name when the tiers differ', () => {
    const h = house('2♠ 3♥ 4♣', '2♠ 4♠ 6♠', { by: 0, reason: 'compare', turn: 3 });
    expect(claimExplanation(h, DEFAULT_CONFIG, roles, en)).toBe(
      'Straight ★★★☆☆☆: 2♠ 3♥ 4♣ beats Flush ★★☆☆☆☆: 2♠ 4♠ 6♠',
    );
    expect(claimExplanation(h, DEFAULT_CONFIG, roles, sr)).toBe(
      'Niz ★★★☆☆☆: 2♠ 3♥ 4♣ pobeđuje Znak ★★☆☆☆☆: 2♠ 4♠ 6♠',
    );
  });

  it('mention rank sums only when the tiers are equal', () => {
    const h = house('2♠ 4♥ 9♣', '2♦ 4♥ 6♣', { by: 0, reason: 'compare', turn: 3 });
    expect(claimExplanation(h, DEFAULT_CONFIG, roles, en)).toBe(
      'Mixed ☆☆☆☆☆☆: 2♠ 4♥ 9♣ against Mixed ☆☆☆☆☆☆: 2♦ 4♥ 6♣, higher rank sum 15 vs 12',
    );
  });

  it('explain proofs with the best alliance the opponent could still form', () => {
    const h = house('2♠ 3♠ 4♠', '4♦ 9♣', { by: 0, reason: 'proof', turn: 3, oppBest: 64 + 26 });
    expect(claimExplanation(h, DEFAULT_CONFIG, roles, en)).toBe(
      'Straight Flush ★★★★★☆: 2♠ 3♠ 4♠ is unbeatable: the best the opponent could still form is Mixed ☆☆☆☆☆☆',
    );
    expect(claimExplanation(h, DEFAULT_CONFIG, roles, sr)).toBe(
      'Niz znak ★★★★★☆: 2♠ 3♠ 4♠ se ne može nadmašiti: najbolje što protivnik još može da sklopi je Ništa ☆☆☆☆☆☆',
    );
    // From the opponent's point of view the claimant is "you".
    expect(claimExplanation(h, DEFAULT_CONFIG, ['opponent', 'you'], sr)).toBe(
      'Niz znak ★★★★★☆: 2♠ 3♠ 4♠ se ne može nadmašiti: najbolje što ti još možeš da sklopiš je Ništa ☆☆☆☆☆☆',
    );
  });
});

describe('Serbian grammar', () => {
  it('conjugates for "you" and the third person', () => {
    expect(sr.played('you', parseCards('7♥')[0]!, 2)).toBe('Ti igraš 7♥ na kuću 3');
    expect(sr.played('opponent', parseCards('7♥')[0]!, 2)).toBe('Protivnik igra 7♥ na kuću 3');
  });

  it('uses Serbian plural forms', () => {
    expect(sr.deckLabel(1)).toMatch(/^Špil, 1 karta\./);
    expect(sr.deckLabel(3)).toMatch(/^Špil, 3 karte\./);
    expect(sr.deckLabel(12)).toMatch(/^Špil, 12 karata\./);
    expect(sr.deckLabel(22)).toMatch(/^Špil, 22 karte\./);
    const five: GameResult = { winner: 0, reason: 'five', houses: [0, 2, 4, 6, 8] };
    expect(sr.wonWith('you', five)).toBe('Ti pobeđuješ sa 5 kuća');
  });

  it('names cards in Serbian', () => {
    expect(sr.cardName(parseCards('Q♥')[0]!)).toBe('Dama herc');
    expect(en.cardName(parseCards('Q♥')[0]!)).toBe('Queen of Hearts');
  });
});

describe('star ratings', () => {
  const stars = (cards: string, motive = true) => {
    const config = { ...DEFAULT_CONFIG, motive };
    return starRating(allianceStrength(parseCards(cards), config), config);
  };

  it('run from no stars for Mixed to all six for Three of a Kind', () => {
    expect(stars('2♠ 4♥ 8♣')).toEqual({ filled: 0, slots: 6 });
    expect(stars('2♠ 4♣ 8♠')).toEqual({ filled: 1, slots: 6 });
    expect(stars('2♠ 3♥ 4♣')).toEqual({ filled: 3, slots: 6 });
    expect(stars('2♠ 3♠ 4♠')).toEqual({ filled: 5, slots: 6 });
    expect(stars('7♠ 7♥ 7♦')).toEqual({ filled: 6, slots: 6 });
  });

  it('use five slots without the Same Colour level', () => {
    expect(stars('2♠ 4♣ 8♠', false)).toEqual({ filled: 0, slots: 5 });
    expect(stars('2♠ 3♥ 4♣', false)).toEqual({ filled: 2, slots: 5 });
    expect(stars('7♠ 7♥ 7♦', false)).toEqual({ filled: 5, slots: 5 });
  });
});
