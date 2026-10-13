import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isJoker } from './cards.ts';
import { totalPlies, type RulesConfig } from './config.ts';
import { replay, type GameRecord } from './replay.ts';
import { findInvariantViolation } from './invariants.ts';
import { createRng } from './rng.ts';
import { legalMoves, step } from './rules.ts';
import { newGame } from './setup.ts';
import { cloneState, other, type GameState, type Player } from './state.ts';
import { allianceStrength } from './strength.ts';
import { getPlayerView } from './view.ts';

const VARIANTS: RulesConfig[] = [
  { motive: true, wildcards: true },
  { motive: false, wildcards: true },
  { motive: true, wildcards: false },
  { motive: false, wildcards: false },
];

function checkInvariants(s: GameState): void {
  expect(findInvariantViolation(s)).toBeNull();
}

function playRandomGame(config: RulesConfig, seed: number, moveSeed: number, start: Player) {
  const state = newGame(config, seed, start);
  const record: GameRecord = { config, seed, start, moves: [] };
  const rng = createRng(moveSeed);
  const snapshots: GameState[] = [];
  checkInvariants(state);
  while (!state.result) {
    const moves = legalMoves(state);
    const move = moves[rng.int(moves.length)]!;
    record.moves.push(move);
    step(state, move);
    checkInvariants(state);
    snapshots.push(cloneState(state));
  }
  return { state, record, snapshots };
}

describe.each(VARIANTS)('random games (motive=$motive, wildcards=$wildcards)', (config) => {
  it('always end with a winner within the ply bound, keeping every invariant', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.constantFrom<Player>(0, 1),
        (seed, moveSeed, start) => {
          const { state, record } = playRandomGame(config, seed, moveSeed, start);
          expect(state.result).not.toBeNull();
          expect(record.moves.length).toBeLessThanOrEqual(totalPlies(config));
          if (config.wildcards) expect(state.result!.reason).not.toBe('majority');
        },
      ),
      { numRuns: 120 },
    );
  });

  it('never lets an opponent beat a proved claim', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (seed, moveSeed) => {
        const { state } = playRandomGame(config, seed, moveSeed, 0);
        for (const h of state.houses) {
          if (h.claim?.reason !== 'proof') continue;
          const opp = h.sides[other(h.claim.by)];
          if (opp.length < 3) continue;
          expect(allianceStrength(opp, config)).toBeLessThanOrEqual(
            allianceStrength(h.sides[h.claim.by], config),
          );
        }
      }),
      { numRuns: 120 },
    );
  });

  it('replays deterministically and survives a JSON round trip', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (seed, moveSeed) => {
        const { state, record } = playRandomGame(config, seed, moveSeed, 1);
        expect(replay(record).state).toEqual(state);
        expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      }),
      { numRuns: 40 },
    );
  });
});

describe('player views', () => {
  it("don't change when hidden cards move between the opponent's hand and the pile", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer({ min: 0, max: 30 }),
        fc.integer(),
        (seed, moveSeed, ply, swapSeed) => {
          const { snapshots } = playRandomGame(
            { motive: true, wildcards: true },
            seed,
            moveSeed,
            0,
          );
          const s = snapshots[Math.min(ply, snapshots.length - 1)]!;
          const me = s.active;
          const opp = other(me);
          const swapped = cloneState(s);
          const rng = createRng(swapSeed);
          const hidden = [...swapped.hands[opp].filter((c) => !isJoker(c)), ...swapped.pile];
          for (let i = hidden.length - 1; i > 0; i--) {
            const j = rng.int(i + 1);
            [hidden[i], hidden[j]] = [hidden[j]!, hidden[i]!];
          }
          const keepJoker = swapped.hands[opp].filter(isJoker);
          const n = swapped.hands[opp].length - keepJoker.length;
          swapped.hands[opp] = [...keepJoker, ...hidden.slice(0, n)];
          swapped.pile = hidden.slice(n);
          expect(getPlayerView(swapped, me)).toEqual(getPlayerView(s, me));
        },
      ),
      { numRuns: 60 },
    );
  });
});
