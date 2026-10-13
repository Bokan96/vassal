import {
  compareCards,
  formatCard,
  formatTier,
  isJoker,
  resolveAlliance,
  sumOf,
  tierOf,
  type GameEvent,
  type GameState,
  type House,
  type Player,
  type RulesConfig,
} from '../engine/index.ts';
import { houseLabel } from './houses.ts';

/** A card as text for sentences: "7♥", or "the Joker". */
export const cardText = (c: number): string => (isJoker(c) ? 'the Joker' : formatCard(c));

export interface LogEntry {
  id: number;
  text: string;
  kind: 'play' | 'draw' | 'claim' | 'win';
  player: Player;
}

/**
 * Alliance label for a full side, e.g. "Scheme (5): 2♣ 3♠ 4♣". Cards are listed in display order,
 * with a joker shown where the card it mirrors would sort.
 */
export function allianceLabel(cards: readonly number[], config: RulesConfig): string {
  const r = resolveAlliance(cards, config);
  const shown = cards
    .map((c) => ({ c, as: isJoker(c) && r.jokerAs !== null ? r.jokerAs : c }))
    .sort((a, b) => compareCards(a.as, b.as))
    .map(({ c, as }) => (isJoker(c) ? `Joker as ${formatCard(as)}` : formatCard(c)));
  return `${formatTier(r.strength, config)}: ${shown.join(' ')}`;
}

/** A player's name as used mid-sentence: "you", "the opponent", "Player 2". */
const mid = (name: string): string =>
  name === 'You' ? 'you' : name === 'Opponent' ? 'the opponent' : name;

/** Why a house was claimed, in words. Rank sums are mentioned only when they decide it. */
export function claimExplanation(
  house: House,
  config: RulesConfig,
  names: [string, string],
): string {
  const c = house.claim;
  if (!c) return '';
  const winner = house.sides[c.by];
  const loser = house.sides[c.by === 0 ? 1 : 0];
  const loserName = mid(names[c.by === 0 ? 1 : 0]);
  switch (c.reason) {
    case 'compare': {
      const ws = resolveAlliance(winner, config).strength;
      const ls = resolveAlliance(loser, config).strength;
      const versus = `${allianceLabel(winner, config)} against ${allianceLabel(loser, config)}`;
      if (tierOf(ws) !== tierOf(ls))
        return `${allianceLabel(winner, config)} beats ${allianceLabel(loser, config)}`;
      if (ws !== ls) return `${versus}, higher rank sum ${sumOf(ws)} vs ${sumOf(ls)}`;
      return `${versus}, equal rank sum ${sumOf(ws)}; completed first`;
    }
    case 'proof': {
      if (c.oppBest === undefined || c.oppBest < 0) {
        return `${allianceLabel(winner, config)} is unbeatable: ${loserName} can no longer complete an alliance here`;
      }
      const mine = resolveAlliance(winner, config).strength;
      const sameTier = tierOf(c.oppBest) === tierOf(mine);
      const best = `${formatTier(c.oppBest, config)}${sameTier ? ` with rank sum ${sumOf(c.oppBest)}` : ''}`;
      return `${allianceLabel(winner, config)}${sameTier ? ` (rank sum ${sumOf(mine)})` : ''} is unbeatable: the best ${loserName} could still form is ${best}`;
    }
    case 'final':
      return 'Resolved after the last card was played';
  }
}

export function describeEvent(
  e: GameEvent,
  state: GameState,
  names: [string, string],
  id: number,
): LogEntry | null {
  switch (e.t) {
    case 'played':
      return {
        id,
        kind: 'play',
        player: e.p,
        text: `${names[e.p]} played ${cardText(e.card)} to ${houseLabel(e.house)}`,
      };
    case 'drew':
      return null;
    case 'claimed':
      return {
        id,
        kind: 'claim',
        player: e.claim.by,
        text: `${names[e.claim.by]} ${names[e.claim.by] === 'You' ? 'win' : 'wins'} ${houseLabel(e.house)}: ${claimExplanation(
          state.houses[e.house]!,
          state.config,
          names,
        )}`,
      };
    case 'won': {
      const how =
        e.result.reason === 'adjacent'
          ? `three adjacent houses (${e.result.houses[0]! + 1}–${e.result.houses.at(-1)! + 1})`
          : e.result.reason === 'five'
            ? `${e.result.houses.length} houses`
            : `a majority of houses (${e.result.houses.length})`;
      return {
        id,
        kind: 'win',
        player: e.result.winner,
        text: `${names[e.result.winner]} wins with ${how}`,
      };
    }
  }
}
