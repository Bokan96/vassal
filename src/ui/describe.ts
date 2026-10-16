import {
  cloneHouse,
  compareCards,
  formatCard,
  isJoker,
  resolveAlliance,
  sumOf,
  tierOf,
  tierPower,
  Tier,
  type GameEvent,
  type GameState,
  type House,
  type Player,
  type RulesConfig,
  type Strength,
} from '../engine/index.ts';
import type { Dict, Role } from './i18n.ts';

/**
 * One line of the game log, kept as data so it can be shown in whichever language is active.
 * Claims carry a snapshot of their house, because cards may still be played there later (C6).
 */
export interface LogEntry {
  id: number;
  kind: 'play' | 'claim' | 'win';
  player: Player;
  event: GameEvent;
  house?: House;
}

/** Turn engine events into log entries ("drew" events are not logged). */
export function logEntries(events: GameEvent[], state: GameState, firstId: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (const e of events) {
    const id = firstId + out.length;
    if (e.t === 'played') out.push({ id, kind: 'play', player: e.p, event: e });
    else if (e.t === 'claimed') {
      out.push({
        id,
        kind: 'claim',
        player: e.claim.by,
        event: e,
        house: cloneHouse(state.houses[e.house]!),
      });
    } else if (e.t === 'won') out.push({ id, kind: 'win', player: e.result.winner, event: e });
  }
  return out;
}

/**
 * Star rating of an alliance: Mixed has no stars and every level above it adds one, so the top
 * level fills every slot (6 slots, or 5 without the Same Colour level).
 */
export function starRating(s: Strength, config: RulesConfig): { filled: number; slots: number } {
  const slots = tierPower(Tier.Triumvirate, config) - 1;
  return { filled: Math.max(0, tierPower(tierOf(s), config) - 1), slots };
}

export const starText = ({ filled, slots }: { filled: number; slots: number }): string =>
  '★'.repeat(filled) + '☆'.repeat(slots - filled);

/** Tier name with its stars, e.g. "Straight ★★★☆☆☆". */
export function tierLabel(s: Strength, config: RulesConfig, t: Dict): string {
  return `${t.tierNames[tierOf(s)]} ${starText(starRating(s, config))}`;
}

/**
 * Alliance label for a full side, e.g. "Scheme (5): 2♣ 3♠ 4♣". Cards are listed in display order,
 * with a joker shown where the card it mirrors would sort.
 */
export function allianceLabel(cards: readonly number[], config: RulesConfig, t: Dict): string {
  const r = resolveAlliance(cards, config);
  const shown = cards
    .map((c) => ({ c, as: isJoker(c) && r.jokerAs !== null ? r.jokerAs : c }))
    .sort((a, b) => compareCards(a.as, b.as))
    .map(({ c, as }) => (isJoker(c) ? t.jokerAs(formatCard(as)) : formatCard(c)));
  return `${tierLabel(r.strength, config, t)}: ${shown.join(' ')}`;
}

/** Why a house was claimed, in words. Rank sums are mentioned only when they decide it. */
export function claimExplanation(
  house: House,
  config: RulesConfig,
  roles: [Role, Role],
  t: Dict,
): string {
  const c = house.claim;
  if (!c) return '';
  const winner = house.sides[c.by];
  const loser = house.sides[c.by === 0 ? 1 : 0];
  const loserRole = roles[c.by === 0 ? 1 : 0];
  const a = allianceLabel(winner, config, t);
  switch (c.reason) {
    case 'compare': {
      const ws = resolveAlliance(winner, config).strength;
      const ls = resolveAlliance(loser, config).strength;
      const b = allianceLabel(loser, config, t);
      if (tierOf(ws) !== tierOf(ls)) return t.beats(a, b);
      if (ws !== ls) return t.higherSum(a, b, sumOf(ws), sumOf(ls));
      return t.equalSum(a, b, sumOf(ws));
    }
    case 'proof': {
      if (c.oppBest === undefined || c.oppBest < 0) return t.unbeatableNone(a, loserRole);
      const mine = resolveAlliance(winner, config).strength;
      const sameTier = tierOf(c.oppBest) === tierOf(mine);
      const best = sameTier
        ? t.withSum(tierLabel(c.oppBest, config, t), sumOf(c.oppBest))
        : tierLabel(c.oppBest, config, t);
      return t.unbeatableBest(sameTier ? a + t.rankSum(sumOf(mine)) : a, loserRole, best);
    }
    case 'final':
      return t.finalResolved;
  }
}

/** The text of a log entry in the active language. */
export function describeEntry(
  entry: LogEntry,
  config: RulesConfig,
  roles: [Role, Role],
  t: Dict,
): string {
  const e = entry.event;
  switch (e.t) {
    case 'played':
      return t.played(roles[e.p], e.card, e.house);
    case 'claimed':
      return t.claimed(
        roles[e.claim.by],
        e.house,
        entry.house ? claimExplanation(entry.house, config, roles, t) : '',
      );
    case 'won':
      return t.wonWith(roles[e.result.winner], e.result);
    case 'drew':
      return '';
  }
}
