import { useCallback, useEffect, useState } from 'react';
import { applyMove, type GameEvent, type Move } from '../../engine/index.ts';
import { FAST } from '../hooks/useGame.ts';
import { TUTORIAL_STEPS, tutorialStart } from './script.ts';

/** Pause before the scripted opponent moves, so the player can read the step. */
const OPPONENT_DELAY_MS = FAST ? 150 : 1100;

const sameMove = (a: Move, b: Move) => a.card === b.card && a.house === b.house;
const lastStep = TUTORIAL_STEPS.length - 1;

/**
 * Runs the scripted tutorial. The player's moves must match the step; the opponent's moves play
 * themselves, after which the player acknowledges them with "Next"; info steps wait for "Next".
 * While `hold` is true (cards still arriving) the opponent waits.
 */
export function useTutorial(hold: boolean) {
  const [game, setGame] = useState(() => ({
    state: tutorialStart(),
    lastEvents: [] as GameEvent[],
    lastPlayed: null as Move | null,
    stepIndex: 0,
    moves: 0,
    /** The opponent has played this step's move; waiting for the player to read it. */
    opponentDone: false,
  }));
  const step = TUTORIAL_STEPS[game.stepIndex]!;

  const apply = useCallback((move: Move, byOpponent: boolean) => {
    setGame((g) => {
      const { state, events } = applyMove(g.state, move);
      return {
        state,
        lastEvents: events,
        lastPlayed: move,
        stepIndex: byOpponent ? g.stepIndex : Math.min(g.stepIndex + 1, lastStep),
        moves: g.moves + 1,
        opponentDone: byOpponent,
      };
    });
  }, []);

  /** The player's move: accepted only if it is the one this step asks for. */
  const play = useCallback(
    (move: Move) => {
      if (step.expect && sameMove(step.expect, move)) apply(move, false);
    },
    [step, apply],
  );

  /** "Next": allowed on info steps and after the opponent has played. */
  const next = useCallback(() => {
    setGame((g) => {
      const current = TUTORIAL_STEPS[g.stepIndex]!;
      const waiting = current.expect || (current.opponent && !g.opponentDone);
      if (waiting) return g;
      return { ...g, stepIndex: Math.min(g.stepIndex + 1, lastStep), opponentDone: false };
    });
  }, []);

  // The scripted opponent plays after a pause.
  const opponentDone = game.opponentDone;
  useEffect(() => {
    if (!step.opponent || hold || opponentDone) return;
    const move = step.opponent;
    const timer = setTimeout(() => apply(move, true), OPPONENT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step, hold, opponentDone, apply]);

  return {
    ...game,
    step,
    total: TUTORIAL_STEPS.length,
    /** Whether "Next" is available right now. */
    canAdvance: !step.expect && !step.outro && (!step.opponent || game.opponentDone),
    play,
    next,
  };
}
