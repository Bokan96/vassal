import { describe, expect, it } from 'vitest';
import { jokerOf, NATURAL_COUNT, parseCard, parseCards, rankOf } from './cards.ts';
import { DEFAULT_CONFIG, type RulesConfig } from './config.ts';
import { bestCompletion, proveHouse, tablePool } from './proof.ts';
import { applyMove } from './rules.ts';
import {
  allianceStrength,
  houseWinner,
  jokerStrength,
  makeStrength,
  naturalStrength,
  resolveAlliance,
  Tier,
  tierOf,
  TIER_NAMES,
  tierPower,
} from './strength.ts';
import type { House } from './state.ts';
import { makeState } from './testing.ts';

const cfg = DEFAULT_CONFIG;
const noMotive: RulesConfig = { ...DEFAULT_CONFIG, motive: false };
const s = (cards: string, config: RulesConfig = cfg) => allianceStrength(parseCards(cards), config);
const house = (p0: string, p1: string, completedAt: [number | null, number | null]): House => ({
  sides: [parseCards(p0), parseCards(p1)],
  completedAt,
  claim: null,
});

describe('C14: Triumvirate tier boundaries and encoding', () => {
  it('C14: the weakest Triumvirate (A A A) beats the strongest Coup and the strongest Scheme', () => {
    expect(s('A♠ A♣ A♥')).toBeGreaterThan(s('J♠ Q♠ K♠'));
    expect(s('A♠ A♣ A♥')).toBeGreaterThan(s('J♠ Q♣ K♠'));
  });

  it('C14: strength bands never overlap and fit Uint16 (tier * 64 + sum, sum <= 39)', () => {
    const max = new Map<number, number>();
    const min = new Map<number, number>();
    for (const motive of [true, false])
      for (let a = 0; a < NATURAL_COUNT; a++)
        for (let b = a + 1; b < NATURAL_COUNT; b++)
          for (let c = b + 1; c < NATURAL_COUNT; c++) {
            const st = naturalStrength(a, b, c, motive);
            const t = tierOf(st);
            max.set(t, Math.max(max.get(t) ?? -1, st));
            min.set(t, Math.min(min.get(t) ?? 1e9, st));
          }
    const tiers = [...max.keys()].sort((x, y) => x - y);
    for (let i = 1; i < tiers.length; i++)
      expect(min.get(tiers[i]!)!).toBeGreaterThan(max.get(tiers[i - 1]!)!);
    expect(max.get(Tier.Triumvirate)!).toBeLessThan(65536);
    expect(TIER_NAMES[Tier.Triumvirate]).toBe('Triumvirate');
    expect(TIER_NAMES.length).toBe(Tier.Triumvirate + 1);
  });

  it('C14: exactly 52 natural Triumvirates in both variants, and every same-rank triple is one', () => {
    for (const motive of [true, false]) {
      let count = 0;
      for (let a = 0; a < NATURAL_COUNT; a++)
        for (let b = a + 1; b < NATURAL_COUNT; b++)
          for (let c = b + 1; c < NATURAL_COUNT; c++) {
            const trips = rankOf(a) === rankOf(b) && rankOf(b) === rankOf(c);
            const isT = tierOf(naturalStrength(a, b, c, motive)) === Tier.Triumvirate;
            expect(isT).toBe(trips);
            if (isT) count++;
          }
      expect(count).toBe(52);
    }
  });

  it('C14 No Motive: tierPower is Scheme 4, Coup 5 and Triumvirate 6 (ordering preserved)', () => {
    expect(tierPower(Tier.Scheme, noMotive)).toBe(4);
    expect(tierPower(Tier.Coup, noMotive)).toBe(5);
    expect(tierPower(Tier.Triumvirate, noMotive)).toBe(6);
    expect(s('2♠ 2♣ 2♥', noMotive)).toBeGreaterThan(s('J♠ Q♣ K♠', noMotive));
  });
});

describe('C14 + C2/C3: jokers', () => {
  it('C2 + C14: joker prefers Triumvirate 3 (A♠ A♣ 🃏) over the higher-sum Motive A♠ A♣ K♠', () => {
    const r = resolveAlliance(parseCards('A♠ A♣ 🃏'), cfg);
    expect(r.strength).toBe(makeStrength(Tier.Triumvirate, 3));
    expect(rankOf(r.jokerAs!)).toBe(1);
  });

  it('C2 + C14: a duplicate mirror still counts (K♠ K♣ 🃏 = Triumvirate 39)', () => {
    expect(s('K♠ K♣ 🃏1')).toBe(makeStrength(Tier.Triumvirate, 39));
  });

  it('C14: a joker pair reaches Triumvirate iff the two naturals share a rank (never Coup and Triumvirate at once)', () => {
    for (const motive of [true, false])
      for (let a = 0; a < NATURAL_COUNT; a++)
        for (let b = a + 1; b < NATURAL_COUNT; b++) {
          const t = tierOf(jokerStrength(a, b, motive));
          expect(t === Tier.Triumvirate).toBe(rankOf(a) === rankOf(b));
        }
  });

  it('C14: joker picks Coup over anything when the pair is suited and close (Q♠ K♠ 🃏 = Coup 36)', () => {
    expect(s('Q♠ K♠ 🃏')).toBe(makeStrength(Tier.Coup, 36));
    expect(s('5♠ 7♠ 🃏')).toBe(makeStrength(Tier.Coup, 18));
  });

  it('C3: an alliance with two jokers is rejected even if it would be a Triumvirate', () => {
    expect(() => s('5♠ 🃏 🃏1')).toThrow(/C3/);
  });
});

describe('C14: house resolution', () => {
  it('C14: Triumvirate beats Scheme and Coup; equal Triumvirates go to first completion', () => {
    expect(houseWinner(house('A♠ A♣ A♥', 'J♠ Q♣ K♠', [2, 1]), 1, cfg)).toBe(0);
    expect(houseWinner(house('A♠ A♣ A♥', 'J♦ Q♦ K♦', [2, 1]), 1, cfg)).toBe(0);
    expect(houseWinner(house('7♠ 7♣ 🃏', '7♥ 7♦ 🃏1', [5, 3]), 0, cfg)).toBe(1);
  });

  it('C5 + C14: completing a Triumvirate against a full Scheme claims the house in step 3a', () => {
    const st = makeState({
      hands: ['K♦ 2♣', '3♣'],
      pile: '4♣ 5♣',
      houses: { 0: { p0: 'K♠ K♥', p1: 'J♠ Q♣ K♣' } },
    });
    const { state } = applyMove(st, { type: 'play', card: parseCard('K♦'), house: 0 });
    expect(state.houses[0]!.claim?.by).toBe(0);
  });
});

describe('C4 + C14: proofs', () => {
  const base = {
    houses: {
      0: { p0: '7♠' },
      1: { p0: '7♥' },
      4: { p0: 'J♠ Q♣ K♠', p1: '7♣ 7♦' },
    },
  };

  it("C4 + C14: the opponent's unplayed joker can complete a Triumvirate that beats the claimant's Scheme", () => {
    const st = makeState(base);
    const proof = proveHouse(st.houses, 4, 0, st.config)!;
    expect(proof.provable).toBe(false);
    expect(proof.oppBest).toBe(makeStrength(Tier.Triumvirate, 21));
    expect(proof.witness).toEqual([jokerOf(1)]);
  });

  it("C4 + C14: once the opponent's joker is on the table, no third 7 remains and the Scheme is provable", () => {
    const st = makeState({ ...base, houses: { ...base.houses, 2: { p1: '🃏1' } } });
    expect(proveHouse(st.houses, 4, 0, st.config)!.provable).toBe(true);
  });

  it('C4 + C14: a free natural third card of the rank makes the opponent Triumvirate reachable', () => {
    const st = makeState({ houses: { 0: { p0: '7♠' }, 2: { p1: '🃏1' }, 4: base.houses[4] } });
    const pool = tablePool(st.houses, st.config);
    const best = bestCompletion(st.houses[4]!.sides[1], pool.avail, null, st.config);
    expect(best.strength).toBe(makeStrength(Tier.Triumvirate, 21));
    expect(best.witness).toEqual(parseCards('7♥'));
    expect(proveHouse(st.houses, 4, 0, st.config)!.provable).toBe(false);
  });

  it('C4 + C14: Q-Q-Q is not provable against an empty side while three kings are free', () => {
    const st = makeState({ houses: { 4: { p0: 'Q♠ Q♥ Q♦' } } });
    const proof = proveHouse(st.houses, 4, 0, st.config)!;
    expect(proof.provable).toBe(false);
    expect(proof.oppBest).toBe(makeStrength(Tier.Triumvirate, 39));
  });

  it('C4 + C14: K-K-K is provable against an empty side at once', () => {
    const st = makeState({ houses: { 4: { p0: 'K♠ K♥ K♦' } } });
    expect(proveHouse(st.houses, 4, 0, st.config)!.provable).toBe(true);
  });
});
