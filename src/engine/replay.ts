import type { RulesConfig } from './config.ts';
import { step, type GameEvent, type Move } from './rules.ts';
import { newGame } from './setup.ts';
import type { GameState, Player } from './state.ts';

/**
 * Everything needed to reproduce a game. The seed reveals the deck order, so a record is kept
 * by whoever runs the authoritative engine and is never handed to the AI or an opponent.
 */
export interface GameRecord {
  config: RulesConfig;
  seed: number;
  start: Player;
  moves: Move[];
}

export function replay(record: GameRecord): { state: GameState; events: GameEvent[] } {
  const state = newGame(record.config, record.seed, record.start);
  const events: GameEvent[] = [];
  for (const m of record.moves) step(state, m, (e) => events.push(e));
  return { state, events };
}
