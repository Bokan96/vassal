/**
 * Rules-referee review of the engine against docs/rules.md (C1–C11).
 * Each test names the rule or clarification it checks. Reference implementations here are
 * written independently of strength.ts / proof.ts so they can catch mistakes in either.
 */
import { describe, expect, it } from 'vitest';
import {
  isJoker,
  jokerOf,
  NATURAL_COUNT,
  parseCard,
  parseCards,
  rankOf,
  suitOf,
  type CardId,
} from './cards.ts';
import { DEFAULT_CONFIG, HOUSE_COUNT, type RulesConfig } from './config.ts';
import { proveHouse } from './proof.ts';
import { createRng } from './rng.ts';
import { applyMove, legalMoves, step, winningHouses, type GameEvent, type Move } from './rules.ts';
import { newGame } from './setup.ts';
import {
  cloneState,
  other,
  type Claim,
  type GameResult,
  type House,
  type Player,
} from './state.ts';
import {
  allianceStrength,
  houseWinner,
  jokerStrength,
  makeStrength,
  naturalStrength,
  Tier,
} from './strength.ts';
import { makeState } from './testing.ts';
import { getPlayerView, redactEvent } from './view.ts';

const cfg = DEFAULT_CONFIG;
const noMotive: RulesConfig = { ...DEFAULT_CONFIG, motive: false };
const noWild: RulesConfig = { ...DEFAULT_CONFIG, wildcards: false };
const VARIANTS: RulesConfig[] = [
  { motive: true, wildcards: true },
  { motive: false, wildcards: true },
  { motive: true, wildcards: false },
  { motive: false, wildcards: false },
];

const play = (card: string, house: number): Move => ({
  type: 'play',
  card: parseCard(card),
  house,
});
const claimed = (by: Player): Claim => ({ by, reason: 'compare', turn: 0 });
const s = (cards: string, config: RulesConfig = cfg) => allianceStrength(parseCards(cards), config);

// ---------------------------------------------------------------------------------------------
// Independent reference: tiers straight from the rulebook table, ace low only (C1).
// ---------------------------------------------------------------------------------------------
function refStrength(cards: readonly CardId[], motive: boolean): number {
  const ranks = cards.map(rankOf).sort((a, b) => a - b);
  const suits = cards.map(suitOf);
  const isRed = (suit: number) => suit === 2 || suit === 3; // ♥ ♦
  const sequence = ranks[1] === ranks[0]! + 1 && ranks[2] === ranks[1]! + 1;
  const sameSuit = suits.every((x) => x === suits[0]);
  const sameColor = suits.every((x) => isRed(x) === isRed(suits[0]!));
  const tier = sequence
    ? sameSuit
      ? Tier.Coup
      : sameColor
        ? Tier.Scheme
        : Tier.Plan
    : sameSuit
      ? Tier.Intent
      : sameColor && motive
        ? Tier.Motive
        : Tier.Discord;
  return makeStrength(
    tier,
    ranks.reduce((a, b) => a + b, 0),
  );
}

/** Best strength of naturals a, b plus a joker that may mirror any of the 52 cards (C2). */
const refJokerTables = new Map<boolean, Int16Array>();
function refJoker(a: CardId, b: CardId, motive: boolean): number {
  let t = refJokerTables.get(motive);
  if (!t) {
    t = new Int16Array(NATURAL_COUNT * NATURAL_COUNT);
    for (let x = 0; x < NATURAL_COUNT; x++)
      for (let y = 0; y < NATURAL_COUNT; y++) {
        let best = -1;
        for (let z = 0; z < NATURAL_COUNT; z++)
          best = Math.max(best, refStrength([x, y, z], motive));
        t[x * NATURAL_COUNT + y] = best;
      }
    refJokerTables.set(motive, t);
  }
  return t[a * NATURAL_COUNT + b]!;
}

function refAlliance(cards: readonly CardId[], motive: boolean): number {
  const nats = cards.filter((c) => !isJoker(c));
  if (nats.length === 3) return refStrength(nats, motive);
  return refJoker(nats[0]!, nats[1]!, motive);
}

/**
 * Independent C4 oracle: can `claimant` prove house i? Pool = naturals not on the table plus the
 * opponent's joker while it is not on the table; at most one joker per alliance (C3); ties go to
 * the claimant.
 */
function oracleProvable(
  houses: readonly House[],
  i: number,
  claimant: Player,
  config: RulesConfig,
) {
  const opp = other(claimant);
  const onTable = new Set<CardId>();
  for (const h of houses) for (const side of h.sides) for (const c of side) onTable.add(c);
  const pool: CardId[] = [];
  for (let c = 0; c < NATURAL_COUNT; c++) if (!onTable.has(c)) pool.push(c);
  const oppSide = houses[i]!.sides[opp];
  const jokerUsable = config.wildcards && !onTable.has(jokerOf(opp)) && !oppSide.some(isJoker);
  const mine = refAlliance(houses[i]!.sides[claimant], config.motive);
  const beats = (cards: CardId[]) => refAlliance(cards, config.motive) > mine;
  const missing = 3 - oppSide.length;
  // Natural-only completions (plus a joker already on the side).
  const rec = (from: number, chosen: CardId[]): boolean => {
    if (chosen.length === missing) return beats([...oppSide, ...chosen]);
    for (let k = from; k < pool.length; k++) if (rec(k + 1, [...chosen, pool[k]!])) return true;
    return false;
  };
  if (rec(0, [])) return false;
  if (jokerUsable) {
    const recJ = (from: number, chosen: CardId[]): boolean => {
      if (chosen.length === missing - 1) return beats([...oppSide, ...chosen, jokerOf(opp)]);
      for (let k = from; k < pool.length; k++) if (recJ(k + 1, [...chosen, pool[k]!])) return true;
      return false;
    };
    if (recJ(0, [])) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
describe('referee: alliance strength (C1, C2, variants)', () => {
  it('C1 + C2: naturalStrength matches an independent reference for every 3-card multiset', () => {
    for (const motive of [true, false])
      for (let a = 0; a < NATURAL_COUNT; a++)
        for (let b = a; b < NATURAL_COUNT; b++)
          for (let c = b; c < NATURAL_COUNT; c++) {
            const got = naturalStrength(a, b, c, motive);
            if (got !== refStrength([a, b, c], motive)) {
              expect({ a, b, c, motive, got }).toEqual({
                a,
                b,
                c,
                motive,
                got: refStrength([a, b, c], motive),
              });
            }
          }
  });

  it('C2: jokerStrength equals the independent best over all 52 identities', () => {
    for (const motive of [true, false])
      for (let a = 0; a < NATURAL_COUNT; a++)
        for (let b = a + 1; b < NATURAL_COUNT; b++) {
          if (jokerStrength(a, b, motive) !== refJoker(a, b, motive)) {
            expect({ a, b, motive, got: jokerStrength(a, b, motive) }).toEqual({
              a,
              b,
              motive,
              got: refJoker(a, b, motive),
            });
          }
        }
  });

  it('C1 + C2: Q♠ K♠ 🃏 becomes J♠ (Coup 36), and A♠ 2♠ 🃏 becomes 3♠ (Coup 6)', () => {
    expect(s('Q♠ K♠ 🃏')).toBe(makeStrength(Tier.Coup, 36));
    expect(s('A♠ 2♠ 🃏')).toBe(makeStrength(Tier.Coup, 6));
    expect(s('A♠ 3♠ 🃏')).toBe(makeStrength(Tier.Coup, 6));
  });

  it('C2: 5♠ 5♣ 🃏 is Motive 23 (joker = a black king, no sequence possible)', () => {
    expect(s('5♠ 5♣ 🃏')).toBe(makeStrength(Tier.Motive, 23));
    expect(s('5♠ 5♥ 🃏')).toBe(makeStrength(Tier.Discord, 23));
  });

  it('No-Motive variant: Scheme survives; only Motive folds into Discord', () => {
    expect(s('2♠ 3♣ 4♠', noMotive)).toBe(makeStrength(Tier.Scheme, 9));
    expect(s('5♥ 9♦ K♥', noMotive)).toBe(makeStrength(Tier.Discord, 27));
  });

  it('No-Motive variant + C2: 2♠ 9♣ 🃏 is Discord 24 instead of Motive 24', () => {
    expect(s('2♠ 9♣ 🃏')).toBe(makeStrength(Tier.Motive, 24));
    expect(s('2♠ 9♣ 🃏', noMotive)).toBe(makeStrength(Tier.Discord, 24));
  });

  it('Tiers before rank: the weakest Coup (A♠ 2♠ 3♠) beats the strongest Scheme (J♠ Q♣ K♠)', () => {
    expect(s('A♠ 2♠ 3♠')).toBeGreaterThan(s('J♠ Q♣ K♠'));
    // ...and the weakest Plan beats the strongest Intent; the weakest Motive the best Discord.
    expect(s('A♠ 2♥ 3♣')).toBeGreaterThan(s('10♠ Q♠ K♠'));
    expect(s('A♠ 2♣ 4♠')).toBeGreaterThan(s('Q♠ K♥ K♦'));
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: house comparison (C8)', () => {
  const house = (p0: string, p1: string, completedAt: [number | null, number | null]): House => ({
    sides: [parseCards(p0), parseCards(p1)],
    completedAt,
    claim: null,
  });

  it('C8: the weakest full alliance beats the strongest incomplete one', () => {
    expect(houseWinner(house('A♠ 2♥ 4♣', 'Q♥ K♥', [5, null]), 1, noWild)).toBe(0);
  });

  it('C8: incomplete alliances compare by combined rank only, ignoring suit and sequence', () => {
    // 6♠ 7♠ would be a Coup draw, but as an incomplete alliance it is just 13 < 15.
    expect(houseWinner(house('6♠ 7♠', '2♥ K♣', [null, null]), 0, noWild)).toBe(1);
  });

  it('C8: a tie between incomplete alliances goes to the starting player (start = 0)', () => {
    expect(houseWinner(house('2♣ 2♦', '2♠ 2♥', [null, null]), 0, noWild)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: proofs (C4)', () => {
  it("C4: the claimant's hidden hand is not excluded from the opponent's pool", () => {
    // Only K♥ (or the opponent's joker, already played) beats 10♠ J♠ Q♠ here, and it sits in
    // player 0's own hand. The proof must not use that knowledge.
    const spec = (hand: string) =>
      makeState({
        hands: [hand, 'A♦'],
        houses: { 0: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' }, 5: { p1: '🃏1' } },
      });
    expect(applyMove(spec('2♣ K♥'), play('2♣', 3)).state.houses[0]!.claim).toBeNull();
    // Once K♥ is on the table the proof goes through (tie on 10♥ favours the claimant).
    expect(applyMove(spec('2♣ K♥'), play('K♥', 3)).state.houses[0]!.claim).toMatchObject({
      by: 0,
      reason: 'proof',
      oppBest: makeStrength(Tier.Coup, 33),
    });
  });

  it('C2 + C4: the opponent joker may duplicate a card already on the table', () => {
    // K♥ 2♥ + 🃏 = K♥ K♥ 2♥ (Intent 28) beats K♠ Q♠ 2♠ (Intent 27), even though Q♥ is gone.
    const houses = { 0: { p0: 'K♠ Q♠ 2♠', p1: 'K♥ 2♥' }, 1: { p0: 'Q♥' } };
    const free = makeState({ houses });
    expect(proveHouse(free.houses, 0, 0, free.config)).toMatchObject({
      provable: false,
      oppBest: makeStrength(Tier.Intent, 28),
    });
    const played = makeState({ houses: { ...houses, 2: { p1: '🃏1' } } });
    expect(proveHouse(played.houses, 0, 0, played.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Intent, 26),
    });
  });

  it('C1 + C4: K♥ A♥ can never become Q-K-A, so Intent 27 is provable (tie)', () => {
    const state = makeState({ houses: { 0: { p0: 'K♠ Q♠ 2♠', p1: 'K♥ A♥' } } });
    expect(proveHouse(state.houses, 0, 0, state.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Intent, 27),
    });
  });

  it('No-Motive variant: proofs rank completions with five tiers', () => {
    // 2♠ 9♣ + a black king is Motive 24 (beats Discord 38) only when Motive exists.
    const spec = (config: Partial<RulesConfig>) =>
      makeState({ config, houses: { 0: { p0: 'K♥ K♦ Q♠', p1: '2♠ 9♣' } } });
    const withMotive = spec({});
    expect(proveHouse(withMotive.houses, 0, 0, withMotive.config)).toMatchObject({
      provable: false,
      oppBest: makeStrength(Tier.Motive, 24),
    });
    const fiveTiers = spec({ motive: false });
    expect(proveHouse(fiveTiers.houses, 0, 0, fiveTiers.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Discord, 24),
    });
  });

  it('C4: without wildcards there is no joker in the pool', () => {
    const houses = { 0: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' }, 1: { p0: 'K♥' } };
    const wild = makeState({ houses });
    expect(proveHouse(wild.houses, 0, 0, wild.config)?.provable).toBe(false);
    const plain = makeState({ config: { wildcards: false }, houses });
    expect(proveHouse(plain.houses, 0, 0, plain.config)).toMatchObject({
      provable: true,
      oppBest: makeStrength(Tier.Coup, 33),
    });
  });

  it('C4 + C6: a joker discarded onto a claimed house no longer threatens other houses', () => {
    const state = makeState({
      houses: {
        0: { p0: '2♠ 3♠ 4♠', p1: '5♥ 6♥' },
        1: { p0: '4♥ 7♥' },
        3: { p0: 'J♣ Q♣ K♣', p1: '🃏1', claim: { by: 0, reason: 'proof', turn: 2 } },
      },
    });
    expect(proveHouse(state.houses, 0, 0, state.config)?.provable).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: evaluation order (C5, C6, C11)', () => {
  it('C11: every provable house is claimed in the same turn ("one or more other houses")', () => {
    const s0 = makeState({
      hands: ['2♣', 'A♦'],
      houses: {
        0: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' },
        1: { p0: '10♣ J♣ Q♣', p1: 'J♦ Q♦' },
        2: { p0: 'K♥ K♦' },
        5: { p1: '🃏1' },
      },
    });
    const { state, events } = applyMove(s0, play('2♣', 3));
    const proofs = events.flatMap((e) =>
      e.t === 'claimed' && e.claim.reason === 'proof' ? [e.house] : [],
    );
    expect(proofs).toEqual([0, 1]);
    expect(state.result).toBeNull();
  });

  it('C5: a 3a win for the active player ends the turn before 3b proof claims', () => {
    // K♥ wins house 2 by comparison (0-1-2 adjacent) and would also make house 8 provable.
    const s0 = makeState({
      hands: ['K♥', 'A♦'],
      houses: {
        0: { claim: claimed(0) },
        1: { claim: claimed(0) },
        2: { p0: 'J♣ Q♣', p1: '2♦ 4♦ 9♣' },
        7: { p1: '🃏1' },
        8: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' },
      },
    });
    const { state, events } = applyMove(s0, play('K♥', 2));
    expect(state.result).toEqual({ winner: 0, reason: 'adjacent', houses: [0, 1, 2] });
    expect(state.houses[8]!.claim).toBeNull();
    expect(events.filter((e) => e.t === 'won')).toHaveLength(1);
  });

  it('C5: the opponent never wins by proof on your turn, even when it would complete a line', () => {
    const s0 = makeState({
      hands: ['2♦', 'A♦'],
      houses: { 0: { claim: claimed(1) }, 1: { claim: claimed(1) }, 2: { p1: 'J♠ Q♠ K♠' } },
    });
    const { state } = applyMove(s0, play('2♦', 6));
    expect(state.result).toBeNull();
    expect(state.houses[2]!.claim).toBeNull();
    // ...but it is claimed (and wins) at the end of player 1's own next turn.
    const next = applyMove(state, play('A♦', 6)).state;
    expect(next.result).toMatchObject({ winner: 1, reason: 'adjacent', houses: [0, 1, 2] });
  });

  it('C6: a claim is never re-evaluated, even when both alliances become full later', () => {
    // Artificial: player 1 holds house 4 and player 0 completes a stronger alliance there.
    const s0 = makeState({
      hands: ['K♠', 'A♦'],
      houses: {
        4: { p0: 'J♠ Q♠', p1: '2♥ 3♥ 4♥', claim: { by: 1, reason: 'proof', turn: 3 } },
      },
    });
    const { state, events } = applyMove(s0, play('K♠', 4));
    expect(state.houses[4]!.claim).toEqual({ by: 1, reason: 'proof', turn: 3 });
    expect(events.some((e) => e.t === 'claimed')).toBe(false);
  });

  it('C6 + C11: a discard onto a claimed house can make another house provable', () => {
    const s0 = makeState({
      hands: ['K♥', 'A♦'],
      houses: {
        0: { p1: '🃏1' },
        3: { p0: '2♣', claim: claimed(1) },
        8: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' },
      },
    });
    const { state } = applyMove(s0, play('K♥', 3));
    expect(state.houses[3]!.claim).toEqual(claimed(1));
    expect(state.houses[8]!.claim).toMatchObject({ by: 0, reason: 'proof' });
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: win detection', () => {
  const owning = (p: Player, idx: number[]) =>
    makeState({ houses: Object.fromEntries(idx.map((i) => [i, { claim: claimed(p) }])) }).houses;

  it('Win: houses 6-7-8 at the end of the row are adjacent', () => {
    expect(winningHouses(owning(0, [6, 7, 8]), 0)).toEqual({
      reason: 'adjacent',
      houses: [6, 7, 8],
    });
  });

  it('Win: the row does not wrap around (8, 0, 1 is not adjacent)', () => {
    expect(winningHouses(owning(0, [8, 0, 1]), 0)).toBeNull();
    expect(winningHouses(owning(0, [7, 8, 0]), 0)).toBeNull();
  });

  it('Win: four scattered houses, or a broken run, do not win', () => {
    expect(winningHouses(owning(1, [0, 2, 4, 6]), 1)).toBeNull();
    expect(winningHouses(owning(1, [0, 1, 3, 4]), 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: no-wildcards ending (C8)', () => {
  it('C8: after the last card, majority decides even if the other player holds 3 adjacent', () => {
    // Player 1 (not the starter) plays the last card. Leftovers: house 3 goes to player 0
    // (full beats incomplete), house 6 to player 1, giving player 1 houses 6-7-8.
    const s0 = makeState({
      config: { wildcards: false },
      start: 0,
      active: 1,
      hands: ['', '8♣'],
      houses: {
        0: { claim: claimed(1) },
        1: { claim: claimed(0) },
        2: { claim: claimed(0) },
        4: { claim: claimed(0) },
        5: { claim: claimed(0) },
        7: { claim: claimed(1) },
        8: { claim: claimed(1) },
        3: { p0: '2♠ 4♥ 9♣', p1: 'K♥ K♦' },
        6: { p0: '5♠ 6♥', p1: 'A♣ 3♦ 7♥' },
      },
    });
    const { state } = applyMove(s0, play('8♣', 0));
    expect(state.houses[3]!.claim).toMatchObject({ by: 0, reason: 'final' });
    expect(state.houses[6]!.claim).toMatchObject({ by: 1, reason: 'final' });
    expect(state.result).toEqual({ winner: 0, reason: 'majority', houses: [1, 2, 3, 4, 5] });
  });

  it('C8: the ending waits until both hands are empty', () => {
    const s0 = makeState({
      config: { wildcards: false },
      start: 0,
      hands: ['4♣', '9♦'],
      houses: { 3: { p0: '2♠ 4♥' }, 6: { p1: '5♠ 6♥' } },
    });
    const { state } = applyMove(s0, play('4♣', 0));
    expect(state.result).toBeNull();
    expect(state.houses.every((h) => h.claim === null)).toBe(true);
    expect(state.active).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: hidden information', () => {
  it("redactEvent hides only the opponent's draws", () => {
    const s0 = newGame(cfg, 123, 0);
    const { events } = applyMove(s0, legalMoves(s0)[0]!);
    const drew = events.find((e) => e.t === 'drew')!;
    const played = events.find((e) => e.t === 'played')!;
    expect(redactEvent(drew, 1)).toEqual({ t: 'drew', p: 0, card: null });
    expect(redactEvent(drew, 0)).toEqual(drew);
    expect(drew).toMatchObject({ card: expect.any(Number) }); // original not mutated
    expect(redactEvent(played, 1)).toEqual(played);
  });

  it('getPlayerView exposes no hands, pile or seed, and shares no mutable table state', () => {
    const state = newGame(cfg, 99, 1);
    const view = getPlayerView(state, 0);
    expect(Object.keys(view).sort()).toEqual(
      [
        'active',
        'config',
        'hand',
        'houses',
        'me',
        'oppHandCount',
        'pileCount',
        'result',
        'start',
        'turn',
      ].sort(),
    );
    expect(view.hand).toEqual(state.hands[0]);
    expect(view.hand).not.toBe(state.hands[0]);
    expect(view.houses[0]).not.toBe(state.houses[0]);
    expect(view.oppHandCount).toBe(7);
    expect(view.pileCount).toBe(40);
  });
});

// ---------------------------------------------------------------------------------------------
describe('referee: integration property (C4, C5, C11)', () => {
  it('C11: after every turn the mover holds exactly the houses an independent oracle can prove', () => {
    let checked = 0;
    for (const config of VARIANTS) {
      for (let g = 0; g < 6; g++) {
        const seed = 1000 * g + (config.motive ? 1 : 0) + (config.wildcards ? 2 : 0);
        const s0 = newGame(config, seed, (g & 1) as Player);
        const rng = createRng(seed ^ 0xbeef);
        while (!s0.result) {
          const before = cloneState(s0);
          const mover = s0.active;
          const moves = legalMoves(s0);
          const events: GameEvent[] = [];
          step(s0, moves[rng.int(moves.length)]!, (e) => events.push(e));
          const claims = new Map<number, Claim>();
          for (const e of events) if (e.t === 'claimed') claims.set(e.house, e.claim);
          for (const c of claims.values()) if (c.reason === 'proof') expect(c.by).toBe(mover);
          const anyProof = [...claims.values()].some((c) => c.reason === 'proof');
          // A win in step 3a skips 3b (C5); nothing to check then.
          const result = s0.result as GameResult | null; // step() mutates s0
          if (result && result.reason !== 'majority' && !anyProof) continue;
          for (let i = 0; i < HOUSE_COUNT; i++) {
            if (before.houses[i]!.claim || claims.get(i)?.reason === 'compare') continue;
            const h = s0.houses[i]!;
            const applies = h.sides[mover].length === 3 && h.sides[other(mover)].length < 3;
            const expected = applies && oracleProvable(s0.houses, i, mover, config);
            expect({
              turn: before.turn,
              house: i,
              proof: claims.get(i)?.reason === 'proof',
            }).toEqual({ turn: before.turn, house: i, proof: expected });
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('3a, C5, C7, C8: compare/final claims and wins agree with an independent reference', () => {
    const hasWin = (houses: readonly House[], p: Player) => {
      const mine = houses.map((h) => h.claim?.by === p);
      if (mine.filter(Boolean).length >= 5) return true;
      return mine.some((_, i) => mine[i] && mine[i + 1] === true && mine[i + 2] === true);
    };
    const seen: Record<string, number> = {
      compare: 0,
      final: 0,
      majority: 0,
      five: 0,
      adjacent: 0,
    };
    for (const config of VARIANTS) {
      for (let g = 0; g < 8; g++) {
        const seed = 7919 * g + (config.motive ? 3 : 0) + (config.wildcards ? 5 : 0);
        const start = ((g >> 1) & 1) as Player;
        const s0 = newGame(config, seed, start);
        const rng = createRng(seed ^ 0x51);
        const completed = new Map<string, number>(); // our own record of first completion
        let plies = 0;
        while (!s0.result) {
          const turn = s0.turn;
          const moves = legalMoves(s0);
          const events: GameEvent[] = [];
          step(s0, moves[rng.int(moves.length)]!, (e) => events.push(e));
          plies++;
          s0.houses.forEach((h, i) =>
            h.sides.forEach((side, p) => {
              if (side.length === 3 && !completed.has(`${i}:${p}`))
                completed.set(`${i}:${p}`, turn);
            }),
          );
          for (const e of events) {
            if (e.t !== 'claimed' || e.claim.reason === 'proof') continue;
            const h = s0.houses[e.house]!;
            if (e.claim.reason === 'final') {
              expect(config.wildcards).toBe(false);
              expect(s0.pile.length + s0.hands[0].length + s0.hands[1].length).toBe(0);
            } else {
              expect(h.sides.map((x) => x.length)).toEqual([3, 3]);
            }
            // Full alliances beat incomplete ones; incompletes compare by rank sum (C8).
            const value = (cards: CardId[]) =>
              cards.length === 3
                ? 1000 + refAlliance(cards, config.motive)
                : cards.reduce((a, c) => a + rankOf(c), 0);
            const [v0, v1] = [value(h.sides[0]), value(h.sides[1])];
            let expected: Player;
            if (v0 !== v1) expected = v0 > v1 ? 0 : 1;
            else if (h.sides[0].length === 3)
              expected = completed.get(`${e.house}:0`)! < completed.get(`${e.house}:1`)! ? 0 : 1;
            else expected = start;
            expect({ house: e.house, by: e.claim.by }).toEqual({ house: e.house, by: expected });
            seen[e.claim.reason]!++;
          }
          const result = s0.result as GameResult | null; // step() mutates s0
          const wins = [hasWin(s0.houses, 0), hasWin(s0.houses, 1)];
          if (result) seen[result.reason]!++;
          if (!result) {
            expect(wins).toEqual([false, false]);
          } else if (result.reason === 'majority') {
            expect(config.wildcards).toBe(false);
            const counts = [0, 1].map((p) => s0.houses.filter((h) => h.claim?.by === p).length);
            expect(counts[0]! + counts[1]!).toBe(HOUSE_COUNT);
            expect(result.winner).toBe(counts[0]! > counts[1]! ? 0 : 1);
          } else {
            expect(wins[result.winner]).toBe(true);
            expect(wins[other(result.winner)]).toBe(false);
          }
        }
        expect(plies).toBeLessThanOrEqual(config.wildcards ? 54 : 52);
      }
    }
    // Make sure the sample actually exercised every path checked above.
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(0);
  });
});
