import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isJoker, jokerOf, NATURAL_COUNT, parseCards, type CardId } from './cards.ts';
import type { RulesConfig } from './config.ts';
import { bestCompletion, proveHouse, tablePool } from './proof.ts';
import { allianceStrength, makeStrength, Tier } from './strength.ts';
import { makeState } from './testing.ts';

/** Brute force: try every way of adding cards from the pool, with at most one joker (C3). */
function oracle(side: CardId[], avail: Uint8Array, joker: CardId | null, config: RulesConfig) {
  const candidates: CardId[] = [];
  for (let c = 0; c < NATURAL_COUNT; c++) if (avail[c]) candidates.push(c);
  if (joker !== null && !side.some(isJoker)) candidates.push(joker);
  const missing = 3 - side.length;
  let best = -1;
  const rec = (from: number, chosen: CardId[]) => {
    if (chosen.length === missing) {
      best = Math.max(best, allianceStrength([...side, ...chosen], config));
      return;
    }
    for (let i = from; i < candidates.length; i++) rec(i + 1, [...chosen, candidates[i]!]);
  };
  rec(0, []);
  return best;
}

const configArb = fc.record({ motive: fc.boolean(), wildcards: fc.constant(true) });

describe('bestCompletion', () => {
  it('matches a brute-force oracle', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.uniqueArray(fc.integer({ min: 0, max: NATURAL_COUNT - 1 }), {
          minLength: 3,
          maxLength: 40,
        }),
        fc.integer({ min: 0, max: 2 }),
        fc.boolean(),
        fc.boolean(),
        (config, table, sideSize, sideJoker, jokerFree) => {
          // The first cards of `table` form the side; the rest are elsewhere on the table.
          const side: CardId[] = table.slice(0, sideSize);
          if (sideJoker && sideSize > 0) side[0] = jokerOf(1);
          const avail = new Uint8Array(NATURAL_COUNT).fill(1);
          for (const c of table) avail[c] = 0;
          const joker = jokerFree && !(sideJoker && sideSize > 0) ? jokerOf(1) : null;
          const result = bestCompletion(side, avail, joker, config);
          expect(result.strength).toBe(oracle(side, avail, joker, config));
          if (result.strength >= 0) {
            expect(allianceStrength([...side, ...result.witness], config)).toBe(result.strength);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('matches the oracle for an empty side', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.uniqueArray(fc.integer({ min: 0, max: NATURAL_COUNT - 1 }), { maxLength: 45 }),
        fc.boolean(),
        (config, table, jokerFree) => {
          const avail = new Uint8Array(NATURAL_COUNT).fill(1);
          for (const c of table) avail[c] = 0;
          const joker = jokerFree ? jokerOf(1) : null;
          expect(bestCompletion([], avail, joker, config).strength).toBe(
            oracle([], avail, joker, config),
          );
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('tablePool (C4)', () => {
  it('only removes cards on the table and tracks each joker separately', () => {
    const state = makeState({
      hands: ['K♥ Q♥', 'A♣'],
      pile: '5♦',
      houses: { 0: { p0: '2♠ 🃏' }, 4: { p1: '3♣' } },
    });
    const pool = tablePool(state.houses, state.config);
    expect([...parseCards('2♠ 3♣')].map((c) => pool.avail[c])).toEqual([0, 0]);
    expect([...parseCards('K♥ Q♥ A♣ 5♦')].map((c) => pool.avail[c])).toEqual([1, 1, 1, 1]);
    expect(pool.jokerFree).toEqual([false, true]);
  });
});

describe('proveHouse', () => {
  it('C4 + C14: K-K-K is claimable as soon as it is completed, even against an empty side', () => {
    const state = makeState({ houses: { 0: { p0: 'K♠ K♥ K♦' } } });
    expect(proveHouse(state.houses, 0, 0, state.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Triumvirate, 36),
    });
  });

  it('C14: a J-Q-K Coup is not provable while any Triumvirate is still possible', () => {
    const state = makeState({ houses: { 0: { p0: 'J♠ Q♠ K♠' } } });
    expect(proveHouse(state.houses, 0, 0, state.config)?.provable).toBe(false);
  });

  it('10-J-Q suited is not provable while J-Q-K of another suit is still possible', () => {
    const state = makeState({ houses: { 0: { p0: '10♠ J♠ Q♠' } } });
    expect(proveHouse(state.houses, 0, 0, state.config)?.provable).toBe(false);
  });

  it("uses the opponent's committed cards", () => {
    // 2♥ 5♣ can be neither a sequence, a Triumvirate nor one colour: Discord at best (joker as K).
    const state = makeState({ houses: { 0: { p0: '10♠ J♠ Q♠', p1: '2♥ 5♣' } } });
    expect(proveHouse(state.houses, 0, 0, state.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Discord, 20),
    });
  });

  it('gives ties to the claimant, who completed first', () => {
    const state = makeState({ houses: { 0: { p0: 'J♠ Q♠ K♠', p1: 'J♥ Q♥' } } });
    expect(proveHouse(state.houses, 0, 0, state.config)?.provable).toBe(true);
  });

  it("accounts for the opponent's joker while it is off the table", () => {
    const houses = { 0: { p0: '2♠ 3♠ 4♠', p1: '5♥ 6♥' }, 1: { p0: '4♥ 7♥' } };
    const withJoker = makeState({ houses });
    expect(proveHouse(withJoker.houses, 0, 0, withJoker.config)?.provable).toBe(false);

    const jokerPlayed = makeState({ houses: { ...houses, 2: { p1: '🃏1' } } });
    expect(proveHouse(jokerPlayed.houses, 0, 0, jokerPlayed.config)?.provable).toBe(true);
  });

  it("never lets the opponent use the claimant's own joker", () => {
    const state = makeState({
      houses: { 0: { p0: '2♠ 3♠ 4♠', p1: '5♥ 6♥' }, 1: { p0: '4♥ 7♥' }, 2: { p1: '🃏1' } },
    });
    // Player 0's joker (🃏) is still in hand, yet the proof holds.
    expect(proveHouse(state.houses, 0, 0, state.config)?.provable).toBe(true);
  });

  it('does not apply to claimed houses, incomplete claimants or full opponents', () => {
    const state = makeState({
      houses: {
        0: { p0: 'J♠ Q♠ K♠', claim: { by: 0, reason: 'proof', turn: 1 } },
        1: { p0: 'J♥ Q♥' },
        2: { p0: 'J♣ Q♣ K♣', p1: '2♦ 3♦ 4♦' },
      },
    });
    expect(proveHouse(state.houses, 0, 0, state.config)).toBeNull();
    expect(proveHouse(state.houses, 1, 0, state.config)).toBeNull();
    expect(proveHouse(state.houses, 2, 0, state.config)).toBeNull();
  });
});
