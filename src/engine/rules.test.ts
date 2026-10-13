import { describe, expect, it } from 'vitest';
import { DECK_SIZE, jokerOf, parseCard, parseCards } from './cards.ts';
import { DEFAULT_CONFIG } from './config.ts';
import { applyMove, legalMoves, winningHouses, type Move } from './rules.ts';
import { newGame } from './setup.ts';
import { makeState } from './testing.ts';
import type { Claim } from './state.ts';

const play = (card: string, house: number): Move => ({
  type: 'play',
  card: parseCard(card),
  house,
});
const claimed = (by: 0 | 1): Claim => ({ by, reason: 'compare', turn: 0 });

describe('setup', () => {
  it('deals 6 naturals plus the own joker to each player and leaves 40 to draw', () => {
    const s = newGame(DEFAULT_CONFIG, 42, 1);
    expect(s.hands[0]).toHaveLength(7);
    expect(s.hands[1]).toHaveLength(7);
    expect(s.hands[0]).toContain(jokerOf(0));
    expect(s.hands[1]).toContain(jokerOf(1));
    expect(s.pile).toHaveLength(40);
    expect(new Set([...s.hands[0], ...s.hands[1], ...s.pile]).size).toBe(DECK_SIZE);
    expect(s.active).toBe(1);
    expect(s.start).toBe(1);
  });

  it('deals 7 naturals each without wildcards', () => {
    const s = newGame({ ...DEFAULT_CONFIG, wildcards: false }, 42, 0);
    expect(s.hands[0]).toHaveLength(7);
    expect(s.hands[0]).not.toContain(jokerOf(0));
    expect(s.pile).toHaveLength(38);
  });

  it('is deterministic per seed', () => {
    expect(newGame(DEFAULT_CONFIG, 7, 0)).toEqual(newGame(DEFAULT_CONFIG, 7, 0));
    expect(newGame(DEFAULT_CONFIG, 7, 0)).not.toEqual(newGame(DEFAULT_CONFIG, 8, 0));
  });

  it('offers every card on every house on the first turn', () => {
    expect(legalMoves(newGame(DEFAULT_CONFIG, 1, 0))).toHaveLength(63);
  });
});

describe('turn sequence', () => {
  it('plays, draws, then passes the turn', () => {
    const s = makeState({ hands: ['2♠ 3♠', '4♠'], pile: '9♦ K♣' });
    const { state, events } = applyMove(s, play('2♠', 4));
    expect(state.houses[4]!.sides[0]).toEqual(parseCards('2♠'));
    expect(state.hands[0]).toEqual(parseCards('3♠ K♣'));
    expect(state.pile).toEqual(parseCards('9♦'));
    expect(state.active).toBe(1);
    expect(state.turn).toBe(2);
    expect(events.map((e) => e.t)).toEqual(['played', 'drew']);
    expect(s.hands[0]).toEqual(parseCards('2♠ 3♠')); // applyMove is pure
  });

  it('skips the draw when the pile is empty', () => {
    const { state, events } = applyMove(makeState({ hands: ['2♠', '4♠'] }), play('2♠', 0));
    expect(state.hands[0]).toEqual([]);
    expect(events.map((e) => e.t)).toEqual(['played']);
  });

  it('rejects cards not in hand and full sides', () => {
    const s = makeState({ hands: ['2♠', '4♠'], houses: { 3: { p0: '5♠ 6♠ 7♠' } } });
    expect(() => applyMove(s, play('4♠', 0))).toThrow(/Illegal/);
    expect(() => applyMove(s, play('2♠', 3))).toThrow(/Illegal/);
    expect(legalMoves(s).some((m) => m.house === 3)).toBe(false);
  });

  it('records the ply on which an alliance is completed', () => {
    const s = makeState({ turn: 11, hands: ['4♠', 'A♦'], houses: { 2: { p0: '2♠ 3♠' } } });
    expect(applyMove(s, play('4♠', 2)).state.houses[2]!.completedAt[0]).toBe(11);
  });
});

describe('evaluating allegiances', () => {
  it('resolves a full-vs-full house for the stronger alliance', () => {
    const s = makeState({ hands: ['4♣', 'A♦'], houses: { 5: { p0: '2♠ 3♥', p1: '2♦ 4♦ 6♦' } } });
    const { state, events } = applyMove(s, play('4♣', 5));
    expect(state.houses[5]!.claim).toMatchObject({ by: 0, reason: 'compare' });
    expect(events.at(-1)).toMatchObject({ t: 'claimed', house: 5 });
  });

  it('can hand the house to the opponent when completing a weaker alliance', () => {
    const s = makeState({ hands: ['9♣', 'A♦'], houses: { 5: { p0: '2♠ 4♥', p1: '2♦ 4♦ 6♦' } } });
    expect(applyMove(s, play('9♣', 5)).state.houses[5]!.claim?.by).toBe(1);
  });

  it('breaks equal alliances in favour of whoever completed first', () => {
    const s = makeState({
      turn: 20,
      hands: ['4♣', 'A♦'],
      houses: { 5: { p0: '2♠ 3♥', p1: '2♦ 3♣ 4♥', completedAt: [null, 12] } },
    });
    expect(applyMove(s, play('4♣', 5)).state.houses[5]!.claim?.by).toBe(1);
  });

  it('automatically claims provable houses for the active player (C11)', () => {
    const s = makeState({ hands: ['K♠', 'A♦'], houses: { 0: { p0: 'J♠ Q♠' } } });
    const { state } = applyMove(s, play('K♠', 0));
    expect(state.houses[0]!.claim).toMatchObject({ by: 0, reason: 'proof' });
  });

  it('only the active player claims by proof', () => {
    // Player 1's J-Q-K is unbeatable, but proof claims happen only at the end of their own turn.
    const s = makeState({
      hands: ['2♦', 'A♦'],
      houses: { 0: { p1: 'J♠ Q♠ K♠' } },
    });
    expect(applyMove(s, play('2♦', 4)).state.houses[0]!.claim).toBeNull();
  });

  it('a card played elsewhere can make another house provable', () => {
    const s = makeState({
      hands: ['K♥', 'A♦'],
      houses: { 8: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' }, 0: { p1: '🃏1' } },
    });
    const { state } = applyMove(s, play('K♥', 4));
    expect(state.houses[8]!.claim).toMatchObject({ by: 0, reason: 'proof' });
  });

  it('C6: cards may still be played to a claimed house without re-evaluating it', () => {
    const s = makeState({
      hands: ['A♣', ''],
      houses: { 1: { p0: 'J♠ Q♠ K♠', claim: { by: 0, reason: 'proof', turn: 3 } } },
    });
    const opp = applyMove({ ...s, active: 1, hands: [[], parseCards('A♣')] }, play('A♣', 1)).state;
    expect(opp.houses[1]!.sides[1]).toEqual(parseCards('A♣'));
    expect(opp.houses[1]!.claim).toMatchObject({ by: 0, reason: 'proof', turn: 3 });
  });
});

describe('winning', () => {
  it('detects three adjacent houses', () => {
    const s = makeState({
      houses: { 2: { claim: claimed(1) }, 3: { claim: claimed(1) }, 4: { claim: claimed(1) } },
    });
    expect(winningHouses(s.houses, 1)).toEqual({ reason: 'adjacent', houses: [2, 3, 4] });
    expect(winningHouses(s.houses, 0)).toBeNull();
  });

  it('detects any five houses', () => {
    const s = makeState({
      houses: Object.fromEntries([0, 2, 4, 6, 8].map((i) => [i, { claim: claimed(0) }])),
    });
    expect(winningHouses(s.houses, 0)).toEqual({ reason: 'five', houses: [0, 2, 4, 6, 8] });
  });

  // Player 1 holds houses 2-3, player 0 holds 6-7. Player 0 completes a losing alliance at
  // house 4, and the K♥ played there also makes house 8 provable for player 0.
  const raceSpec = (p0House4: string) =>
    makeState({
      hands: ['K♥ 5♣', 'A♦'],
      pile: '9♦',
      houses: {
        0: { p1: '🃏1' },
        2: { claim: claimed(1) },
        3: { claim: claimed(1) },
        4: { p0: p0House4, p1: '9♣ 10♣ J♣' },
        6: { claim: claimed(0) },
        7: { claim: claimed(0) },
        8: { p0: '10♠ J♠ Q♠', p1: 'J♥ Q♥' },
      },
    });

  it('C5: resolving full-vs-full houses comes before proof claims, so the opponent wins first', () => {
    const { state, events } = applyMove(raceSpec('2♦ 3♣'), play('K♥', 4));
    expect(state.result).toEqual({ winner: 1, reason: 'adjacent', houses: [2, 3, 4] });
    expect(state.houses[8]!.claim).toBeNull();
    expect(events.filter((e) => e.t === 'won')).toHaveLength(1);
  });

  it('C5: otherwise the active player wins through their proof claim', () => {
    const { state } = applyMove(raceSpec('2♦'), play('K♥', 4));
    expect(state.houses[4]!.claim).toBeNull();
    expect(state.result).toEqual({ winner: 0, reason: 'adjacent', houses: [6, 7, 8] });
  });

  it('stops the game once someone has won', () => {
    const { state } = applyMove(raceSpec('2♦'), play('K♥', 4));
    expect(legalMoves(state)).toEqual([]);
    expect(() => applyMove(state, play('5♣', 5))).toThrow(/Illegal/);
  });
});

describe('no-wildcards ending (C8)', () => {
  // Player 0 plays the last card of the game; houses 0-6 are already decided 4-3.
  const endgame = (p0House7: string, start: 0 | 1) =>
    makeState({
      config: { wildcards: false },
      start,
      active: 0,
      hands: ['4♣', ''],
      houses: {
        ...Object.fromEntries([0, 2, 4, 6].map((i) => [i, { claim: claimed(0) }])),
        ...Object.fromEntries([1, 3, 5].map((i) => [i, { claim: claimed(1) }])),
        7: { p0: p0House7, p1: '2♠ 2♥' },
        8: { p0: '3♠ 3♥', p1: 'Q♣ K♣ A♦' },
      },
    });

  it('resolves leftover incomplete alliances by combined rank and awards the majority', () => {
    const { state } = applyMove(endgame('6♠ 7♥', 1), play('4♣', 8));
    expect(state.houses[8]!.claim).toMatchObject({ by: 1, reason: 'compare' });
    expect(state.houses[7]!.claim).toMatchObject({ by: 0, reason: 'final' });
    expect(state.result).toEqual({ winner: 0, reason: 'majority', houses: [0, 2, 4, 6, 7] });
  });

  it('gives tied incomplete alliances to the starting player', () => {
    const { state } = applyMove(endgame('2♣ 2♦', 1), play('4♣', 8));
    expect(state.houses[7]!.claim).toMatchObject({ by: 1, reason: 'final' });
    expect(state.result?.winner).toBe(1);
  });
});
