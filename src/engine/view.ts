import type { CardId } from './cards.ts';
import type { RulesConfig } from './config.ts';
import type { GameEvent } from './rules.ts';
import {
  cloneHouse,
  other,
  type GameResult,
  type GameState,
  type House,
  type Player,
} from './state.ts';

/**
 * Everything one player is allowed to know. The UI and the AI only ever see this: the
 * opponent's hand and the draw pile are reduced to counts.
 */
export interface PlayerView {
  me: Player;
  config: RulesConfig;
  start: Player;
  turn: number;
  active: Player;
  hand: CardId[];
  oppHandCount: number;
  pileCount: number;
  houses: House[];
  result: GameResult | null;
}

export function getPlayerView(s: GameState, me: Player): PlayerView {
  return {
    me,
    config: s.config,
    start: s.start,
    turn: s.turn,
    active: s.active,
    hand: s.hands[me].slice(),
    oppHandCount: s.hands[other(me)].length,
    pileCount: s.pile.length,
    houses: s.houses.map(cloneHouse),
    result: s.result ? { ...s.result, houses: s.result.houses.slice() } : null,
  };
}

/** Hide the identity of cards the viewer did not draw. */
export function redactEvent(e: GameEvent, viewer: Player): GameEvent {
  if (e.t === 'drew' && e.p !== viewer) return { ...e, card: null };
  return e;
}
