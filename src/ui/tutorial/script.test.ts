import { describe, expect, it } from 'vitest';
import { applyMove, findInvariantViolation, isLegal, type GameState } from '../../engine/index.ts';
import { TUTORIAL_HOUSES, TUTORIAL_STEPS, tutorialStart } from './script.ts';

/** Play the whole script, returning the state after each step. */
function replay(): GameState[] {
  let state = tutorialStart();
  return TUTORIAL_STEPS.map((step) => {
    const move = step.expect ?? step.opponent;
    if (move) {
      expect(isLegal(state, move), JSON.stringify(step.text.en)).toBe(true);
      expect(state.active).toBe(step.expect ? 0 : 1);
      state = applyMove(state, move).state;
      expect(findInvariantViolation(state)).toBeNull();
    }
    return state;
  });
}

describe('tutorial script', () => {
  it('starts on a card-complete 5-house board with the player to move', () => {
    const s = tutorialStart();
    expect(s.houses).toHaveLength(TUTORIAL_HOUSES);
    expect(s.hands[0]).toHaveLength(7);
    expect(findInvariantViolation(s)).toBeNull();
  });

  it('plays out exactly as the lesson describes', () => {
    const states = replay();
    const at = (fragment: string) => {
      const i = TUTORIAL_STEPS.findIndex((st) => st.text.en.includes(fragment));
      expect(i, fragment).toBeGreaterThanOrEqual(0);
      return states[i]!;
    };
    // Nothing is claimed before the third king.
    expect(at('Add your second king').houses.every((h) => !h.claim)).toBe(true);
    // Three kings are claimed at once by proof.
    expect(at('Complete Three of a Kind').houses[2]!.claim).toMatchObject({
      by: 0,
      reason: 'proof',
    });
    // The opponent's flush alone does not claim house 2.
    expect(at('completed a Flush').houses[1]!.claim).toBeNull();
    // The straight flush beats the flush by comparison.
    expect(at('to complete the Straight Flush').houses[1]!.claim).toMatchObject({
      by: 0,
      reason: 'compare',
    });
    // The opponent never wins a house.
    expect(states.at(-1)!.houses.some((h) => h.claim?.by === 1)).toBe(false);
    // The last move wins with three adjacent houses.
    expect(states.at(-1)!.result).toEqual({ winner: 0, reason: 'adjacent', houses: [1, 2, 3] });
    expect(states.at(-2)!.result).toEqual(states.at(-1)!.result);
  });

  it('has texts in both languages and ends with the 9-house outro', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.text.sr.length).toBeGreaterThan(10);
      expect(step.text.en.length).toBeGreaterThan(10);
    }
    const last = TUTORIAL_STEPS.at(-1)!;
    expect(last.outro).toBe(true);
    expect(last.text.sr).toMatch(/9 kuća/);
    expect(last.text.en).toMatch(/9 houses/);
  });
});
