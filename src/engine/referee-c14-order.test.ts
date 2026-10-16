import { describe, expect, it } from 'vitest';
import { jokerOf, NATURAL_COUNT, parseCard, parseCards } from './cards.ts';
import { DEFAULT_CONFIG, type RulesConfig } from './config.ts';
import { bestCompletion, proveHouse, tablePool } from './proof.ts';
import { applyMove } from './rules.ts';
import { makeStrength, resolveAlliance, Tier } from './strength.ts';
import { makeState } from './testing.ts';

const cfg = DEFAULT_CONFIG;
const noMotive: RulesConfig = { ...DEFAULT_CONFIG, motive: false };
const allAvail = () => new Uint8Array(NATURAL_COUNT).fill(1);
const without = (cards: string) => {
  const a = allAvail();
  for (const c of parseCards(cards)) a[c] = 0;
  return a;
};

describe('C14 order: bestCompletion now tops out at Triumvirate', () => {
  it('C4 + C14: an empty side with every card free reaches K-K-K (Triumvirate 39), not J-Q-K', () => {
    expect(bestCompletion([], allAvail(), null, cfg).strength).toBe(
      makeStrength(Tier.Triumvirate, 39),
    );
  });

  it('C4 + C14: with three kings gone, one K + joker cannot make K-K-K; best is Q-Q-Q 36', () => {
    const avail = without('K♠ K♥ K♦');
    expect(bestCompletion([], avail, jokerOf(1), cfg).strength).toBe(
      makeStrength(Tier.Triumvirate, 36),
    );
  });

  it('C3 + C14: a side holding only its joker reaches Triumvirate 39 via any free pair of kings', () => {
    expect(bestCompletion(parseCards('🃏1'), allAvail(), null, cfg).strength).toBe(
      makeStrength(Tier.Triumvirate, 39),
    );
  });
});

describe('C14 order: proofs', () => {
  it('C14: J♠ Q♠ K♠ is no longer claimed at step 3b on completion (C5/C11)', () => {
    const s = makeState({ hands: ['K♠ A♦', '2♣'], pile: '3♣ 4♣', houses: { 0: { p0: 'J♠ Q♠' } } });
    const { state } = applyMove(s, { type: 'play', card: parseCard('K♠'), house: 0 });
    expect(state.houses[0]!.claim).toBeNull();
  });

  it('C14: A-A-A (Triumvirate 3) is provable against J♠ Q♠ even though Coup 36 is reachable', () => {
    const st = makeState({ houses: { 0: { p0: 'A♠ A♥ A♦', p1: 'J♠ Q♠' } } });
    expect(proveHouse(st.houses, 0, 0, st.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Coup, 36),
    });
  });

  it('C14: A-A-A is not provable against an empty side (2-2-2 and up remain possible)', () => {
    const st = makeState({ houses: { 0: { p0: 'A♠ A♥ A♦' } } });
    expect(proveHouse(st.houses, 0, 0, st.config)!.provable).toBe(false);
  });

  it('C4 + C14: Coup J♠ Q♠ K♠ vs Q♥ is not provable while two queens remain (Q-Q-Q 36 > Coup)', () => {
    const st = makeState({ houses: { 0: { p0: 'J♠ Q♠ K♠', p1: 'Q♥' } } });
    const p = proveHouse(st.houses, 0, 0, st.config)!;
    expect(p.provable).toBe(false);
    expect(p.oppBest).toBe(makeStrength(Tier.Triumvirate, 36));
  });

  it("C4 + C14: with Q♣ Q♦ gone the opponent's free joker cannot make Q-Q-Q; tie on Coup 36 favours claimant", () => {
    const st = makeState({
      houses: { 0: { p0: 'J♠ Q♠ K♠', p1: 'Q♥' }, 3: { p0: 'Q♣' }, 4: { p0: 'Q♦' } },
    });
    expect(tablePool(st.houses, st.config).jokerFree[1]).toBe(true);
    expect(proveHouse(st.houses, 0, 0, st.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Coup, 36),
    });
  });

  it("C13 + C14: the K♠ mirrored by the claimant's joker still lets the opponent complete K-K-K", () => {
    const st = makeState({
      houses: {
        0: { p0: 'J♠ Q♠ 🃏', p1: 'K♥ K♦' },
        3: { p0: 'K♣' },
        5: { p1: '🃏1' },
      },
    });
    expect(resolveAlliance(st.houses[0]!.sides[0], cfg).jokerAs).toBe(parseCard('K♠'));
    const p = proveHouse(st.houses, 0, 0, st.config)!;
    expect(p.provable).toBe(false);
    expect(p.witness).toEqual([parseCard('K♠')]);
  });

  it('C4 + C14: own joker never helps the opponent; K♠ K♥ 🃏 ties K♣ K♦ 🃏1 at 39 and is provable', () => {
    const st = makeState({ houses: { 0: { p0: 'K♠ K♥ 🃏', p1: 'K♣ K♦' } } });
    expect(proveHouse(st.houses, 0, 0, st.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Triumvirate, 39),
    });
  });

  it('C14 No Motive: K-K-K is provable on completion; J-Q-K suited is not', () => {
    const a = makeState({ config: noMotive, houses: { 0: { p0: 'K♠ K♥ K♦' } } });
    const b = makeState({ config: noMotive, houses: { 0: { p0: 'J♠ Q♠ K♠' } } });
    expect(proveHouse(a.houses, 0, 0, a.config)!.provable).toBe(true);
    expect(proveHouse(b.houses, 0, 0, b.config)!.provable).toBe(false);
  });

  it('C14 No wildcards: Q-Q-Q is provable once two kings are on the table (best left is J-J-J)', () => {
    const st = makeState({
      config: { wildcards: false },
      houses: { 0: { p0: 'Q♠ Q♥ Q♦' }, 2: { p1: 'K♣ K♦' } },
    });
    expect(proveHouse(st.houses, 0, 0, st.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Triumvirate, 33),
    });
  });
});
