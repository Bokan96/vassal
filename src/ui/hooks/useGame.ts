import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { chooseMove, type AiLevel } from '../../ai/bots.ts';
import type { AiRequest, AiResponse } from '../../ai/ai.worker.ts';
import {
  applyMove,
  getPlayerView,
  isLegal,
  legalMoves,
  newGame,
  other,
  randomSeed,
  type GameEvent,
  type GameRecord,
  type GameState,
  type Move,
  type Player,
  type RulesConfig,
} from '../../engine/index.ts';
import { logEntries, type LogEntry } from '../describe.ts';
import type { Role } from '../i18n.ts';

export type Mode = 'hotseat' | 'ai';

export interface Session {
  mode: Mode;
  aiLevel: AiLevel;
  /** The human's seat in vs-AI games. */
  human: Player;
  /** Seed for the AI's own sampling; independent of the deck seed, which the AI never sees. */
  aiSeed: number;
  record: GameRecord;
}

export interface NewGameOptions {
  mode: Mode;
  aiLevel: AiLevel;
  config: RulesConfig;
  /** Who starts: a seat, or random. In vs-AI games seat 0 is the human. */
  start: Player | 'random';
}

export interface Model {
  session: Session;
  state: GameState;
  log: LogEntry[];
  /** Hot-seat: the next player must confirm before their hand is shown. */
  awaitingPass: boolean;
  /**
   * Whose side of the table is shown. In hot-seat it stays with the player who just moved until the
   * next player confirms the hand-off, so the mover sees their draw arrive.
   */
  perspective: Player;
  lastPlayed: Move | null;
  /** Events of the most recent move (empty after loading a saved game), for animations. */
  lastEvents: GameEvent[];
}

type Action = { type: 'play'; move: Move } | { type: 'acknowledge-pass' };

const STORAGE_KEY = 'vassal.session.v1';
const params = new URLSearchParams(globalThis.location?.search ?? '');
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
/** `?fast=1` removes the AI's reading delay (used by end-to-end tests). */
export const FAST = params.get('fast') === '1';
const AI_MIN_DELAY_MS = FAST ? 0 : 650;
const AI_BUDGET_MS: Record<AiLevel, number> = { random: 0, easy: 0, normal: 0, hard: 900 };

/** Who each seat is for the reader: "you" and "opponent", or Player 1 and 2 in hot-seat. */
export function playerRoles(session: Session): [Role, Role] {
  if (session.mode === 'hotseat') return ['player1', 'player2'];
  const roles: [Role, Role] = ['opponent', 'opponent'];
  roles[session.human] = 'you';
  return roles;
}

function appendLog(log: LogEntry[], events: GameEvent[], state: GameState): LogEntry[] {
  return [...log, ...logEntries(events, state, log.length)];
}

/** Rebuild the model from a saved record, replaying every move. */
function fromSession(session: Session): Model {
  let state = newGame(session.record.config, session.record.seed, session.record.start);
  let log: LogEntry[] = [];
  for (const move of session.record.moves) {
    const r = applyMove(state, move);
    state = r.state;
    log = appendLog(log, r.events, state);
  }
  const lastPlayed = session.record.moves.at(-1) ?? null;
  return {
    session,
    state,
    log,
    awaitingPass: session.mode === 'hotseat' && !state.result,
    perspective: session.mode === 'ai' ? session.human : state.active,
    lastPlayed,
    lastEvents: [],
  };
}

function reducer(model: Model, action: Action): Model {
  switch (action.type) {
    case 'play': {
      if (!isLegal(model.state, action.move)) return model;
      const { state, events } = applyMove(model.state, action.move);
      const session: Session = {
        ...model.session,
        record: { ...model.session.record, moves: [...model.session.record.moves, action.move] },
      };
      return {
        session,
        state,
        log: appendLog(model.log, events, state),
        awaitingPass: session.mode === 'hotseat' && !state.result,
        perspective: model.perspective,
        lastPlayed: action.move,
        lastEvents: events,
      };
    }
    case 'acknowledge-pass':
      return { ...model, awaitingPass: false, perspective: model.state.active };
  }
}

export function createSession(opts: NewGameOptions): Session {
  const seed = FIXED_SEED ?? randomSeed();
  const start: Player = opts.start === 'random' ? ((seed >>> 7) & 1 ? 1 : 0) : opts.start;
  return {
    mode: opts.mode,
    aiLevel: opts.aiLevel,
    human: 0,
    aiSeed: randomSeed(),
    record: { config: opts.config, seed, start, moves: [] },
  };
}

export function loadSavedSession(): Session | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return fromSession(session).state.result ? null : session;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage may be unavailable (private mode); the game still works without it.
  }
}

export function clearSavedSession(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Runs one game session: state, log, hot-seat hand-off and the AI opponent.
 * While `hold` is true (the opening deal is still on screen) nobody may move.
 */
export function useGame(initial: Session, hold = false) {
  const [model, dispatch] = useReducer(reducer, initial, fromSession);
  const [thinking, setThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const { session, state } = model;

  useEffect(() => saveSession(session), [session]);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const worker = new Worker(new URL('../../ai/ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Let the AI move whenever it is its turn.
  useEffect(() => {
    if (hold || session.mode !== 'ai' || state.result || state.active === session.human) return;
    const id = ++requestId.current;
    const started = performance.now();
    const request: AiRequest = {
      id,
      view: getPlayerView(state, state.active),
      level: session.aiLevel,
      seed: (session.aiSeed ^ Math.imul(state.turn, 2654435761)) >>> 0,
      budgetMs: AI_BUDGET_MS[session.aiLevel],
    };
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (move: Move | null) => {
      if (cancelled || id !== requestId.current) return;
      const fallback = legalMoves(state)[0]!;
      const chosen = move && isLegal(state, move) ? move : fallback;
      const wait = Math.max(0, AI_MIN_DELAY_MS - (performance.now() - started));
      timer = setTimeout(() => {
        if (cancelled) return;
        setThinking(false);
        dispatch({ type: 'play', move: chosen });
      }, wait);
    };
    // Defer so the "thinking" state is set outside the effect body.
    const kickoff = setTimeout(() => {
      if (cancelled) return;
      setThinking(true);
      const worker = workerRef.current;
      if (worker) {
        const onMessage = (e: MessageEvent<AiResponse>) => {
          if (e.data.id !== id) return;
          worker.removeEventListener('message', onMessage);
          finish(e.data.ok ? e.data.result.move : null);
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage(request);
      } else {
        finish(chooseMove(request.view, request.level, request).move);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
      if (timer) clearTimeout(timer);
    };
  }, [state, session, hold]);

  const play = useCallback((move: Move) => dispatch({ type: 'play', move }), []);
  const acknowledgePass = useCallback(() => dispatch({ type: 'acknowledge-pass' }), []);

  // Whose perspective the table is drawn from.
  const viewer = model.perspective;
  const humanToMove =
    !hold &&
    !state.result &&
    !model.awaitingPass &&
    (session.mode === 'hotseat' || state.active === session.human);

  return {
    model,
    view: getPlayerView(state, viewer),
    viewer,
    opponent: other(viewer),
    roles: playerRoles(session),
    thinking: thinking && !state.result,
    humanToMove,
    play,
    acknowledgePass,
  };
}
