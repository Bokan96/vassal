import { describe, expect, it } from 'vitest';
import { NATURAL_COUNT, parseCards } from './cards.ts';
import { DEFAULT_CONFIG, type RulesConfig } from './config.ts';
import {
  allianceStrength,
  formatTier,
  houseWinner,
  jokerStrength,
  makeStrength,
  naturalStrength,
  resolveAlliance,
  Tier,
  tierOf,
  TIER_NAMES,
} from './strength.ts';
import type { House } from './state.ts';

const cfg = DEFAULT_CONFIG;
const noMotive: RulesConfig = { ...DEFAULT_CONFIG, motive: false };
const s = (cards: string, config: RulesConfig = cfg) => allianceStrength(parseCards(cards), config);
const tierName = (cards: string, config: RulesConfig = cfg) => TIER_NAMES[tierOf(s(cards, config))];

describe('alliance tiers (rulebook table)', () => {
  it.each([
    ['2♠ 3♠ 4♠', 'Coup'],
    ['2♠ 3♣ 4♠', 'Scheme'],
    ['2♠ 3♥ 4♣', 'Plan'],
    ['2♠ 4♠ 8♠', 'Intent'],
    ['2♠ 4♣ 8♠', 'Motive'],
    ['2♠ 4♥ 8♣', 'Discord'],
  ])('%s is a %s', (cards, tier) => {
    expect(tierName(cards)).toBe(tier);
  });

  it('ignores play order', () => {
    expect(s('4♠ 2♠ 3♠')).toBe(s('2♠ 3♠ 4♠'));
  });

  it('orders the rulebook example: Plan > Intent > Discord 15 > Discord 12', () => {
    const ordered = ['2♠ 3♥ 4♣', '2♠ 4♠ 6♠', '2♠ 4♥ 9♣', '2♠ 4♥ 6♣'].map((c) => s(c));
    expect(ordered).toEqual([...ordered].sort((a, b) => b - a));
    expect(new Set(ordered).size).toBe(4);
  });

  it('breaks equal tiers by combined rank (A=1, J=11, Q=12, K=13)', () => {
    expect(s('J♠ Q♥ K♣')).toBe(makeStrength(Tier.Plan, 36));
    expect(s('A♠ 2♥ 3♣')).toBe(makeStrength(Tier.Plan, 6));
  });

  it('C1: ace is low only', () => {
    expect(tierName('A♠ 2♠ 3♠')).toBe('Coup');
    expect(tierName('Q♠ K♠ A♠')).toBe('Intent');
    expect(tierName('K♠ A♠ 2♠')).toBe('Intent');
  });

  it('No-Motive variant turns same-colour alliances into Discord', () => {
    expect(tierName('2♠ 4♣ 8♠', noMotive)).toBe('Discord');
    expect(tierName('2♠ 4♠ 8♠', noMotive)).toBe('Intent');
  });
});

describe('exhaustive tier counts over all 22,100 three-card hands', () => {
  const count = (motive: boolean) => {
    const counts = new Array(7).fill(0);
    for (let a = 0; a < NATURAL_COUNT; a++)
      for (let b = a + 1; b < NATURAL_COUNT; b++)
        for (let c = b + 1; c < NATURAL_COUNT; c++)
          counts[tierOf(naturalStrength(a, b, c, motive))]++;
    return counts;
  };

  it('matches the rulebook probabilities (C1, C10)', () => {
    const [, discord, motive, intent, plan, scheme, coup] = count(true);
    expect({ coup, scheme, plan, intent, motive, discord }).toEqual({
      coup: 44,
      scheme: 132,
      plan: 528,
      intent: 1100,
      motive: 3924,
      discord: 16372,
    });
  });

  it('folds Motive into Discord without the Motive tier', () => {
    const counts = count(false);
    expect(counts[Tier.Motive]).toBe(0);
    expect(counts[Tier.Discord]).toBe(20296);
  });
});

describe('jokers', () => {
  it('take the identity that maximises the alliance', () => {
    expect(resolveAlliance(parseCards('5♠ 7♠ 🃏'), cfg)).toEqual({
      strength: makeStrength(Tier.Coup, 18),
      effective: parseCards('5♠ 7♠ 6♠'),
      jokerAs: parseCards('6♠')[0],
    });
    expect(s('J♠ Q♠ 🃏')).toBe(makeStrength(Tier.Coup, 36));
  });

  it('C2: may duplicate a card already in the alliance', () => {
    expect(s('K♠ 2♠ 🃏')).toBe(makeStrength(Tier.Intent, 28));
  });

  it('C1 + C2: K♠ A♠ 🃏 is Intent 27, not a Q-K-A sequence', () => {
    expect(s('K♠ A♠ 🃏')).toBe(makeStrength(Tier.Intent, 27));
  });

  it('is never weaker than any concrete card and equals the best one', () => {
    for (const motive of [true, false]) {
      for (let a = 0; a < NATURAL_COUNT; a++) {
        for (let b = a + 1; b < NATURAL_COUNT; b++) {
          let best = 0;
          for (let x = 0; x < NATURAL_COUNT; x++)
            best = Math.max(best, naturalStrength(a, b, x, motive));
          expect(jokerStrength(a, b, motive)).toBe(best);
        }
      }
    }
  });

  it('C3: rejects two jokers in one alliance', () => {
    expect(() => s('🃏 🃏1 2♠')).toThrow();
  });
});

describe('house winner', () => {
  const house = (p0: string, p1: string, completedAt: [number | null, number | null]): House => ({
    sides: [parseCards(p0), parseCards(p1)],
    completedAt,
    claim: null,
  });

  it('awards the stronger alliance', () => {
    expect(houseWinner(house('2♠ 3♥ 4♣', '2♠ 4♠ 6♠', [5, 2]), 0, cfg)).toBe(0);
  });

  it('breaks exact ties in favour of the player who completed first', () => {
    expect(houseWinner(house('2♠ 3♥ 4♣', '2♦ 3♣ 4♥', [7, 4]), 0, cfg)).toBe(1);
    expect(houseWinner(house('2♠ 3♥ 4♣', '2♦ 3♣ 4♥', [3, 4]), 1, cfg)).toBe(0);
  });

  it('C8: full beats incomplete; incompletes compare by rank; ties go to the starting player', () => {
    const variant = { ...cfg, wildcards: false };
    expect(houseWinner(house('2♠ 2♥ 3♠', '6♠ 7♥', [9, null]), 1, variant)).toBe(0);
    expect(houseWinner(house('6♠ 7♥', '2♠ 2♥', [null, null]), 1, variant)).toBe(0);
    expect(houseWinner(house('2♣ 2♦', '2♠ 2♥', [null, null]), 1, variant)).toBe(1);
  });
});

describe('tier labels', () => {
  it('name the tier and its power, without the rank sum', () => {
    expect(formatTier(s('2♠ 3♥ 4♣'), cfg)).toBe('Plan (4)');
    expect(formatTier(s('J♠ Q♠ K♠'), cfg)).toBe('Coup (6)');
    expect(formatTier(s('2♠ 4♥ 8♣'), cfg)).toBe('Discord (1)');
  });

  it('renumber the tiers above Motive when the Motive tier is not in play', () => {
    expect(formatTier(s('2♠ 3♥ 4♣', noMotive), noMotive)).toBe('Plan (3)');
    expect(formatTier(s('J♠ Q♠ K♠', noMotive), noMotive)).toBe('Coup (5)');
    expect(formatTier(s('2♠ 4♣ 8♠', noMotive), noMotive)).toBe('Discord (1)');
  });
});
