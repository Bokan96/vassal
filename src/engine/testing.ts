import { jokerOf, NATURAL_COUNT, parseCards, type CardId } from './cards.ts';
import { DEFAULT_CONFIG, HOUSE_COUNT, type RulesConfig } from './config.ts';
import { emptyHouse, type Claim, type GameState, type Player } from './state.ts';

export interface HouseSpec {
  /** Player 0's cards, e.g. "2♠ 3♥ 4♣". */
  p0?: string;
  /** Player 1's cards. */
  p1?: string;
  completedAt?: [number | null, number | null];
  claim?: Claim;
}

export interface StateSpec {
  config?: Partial<RulesConfig>;
  start?: Player;
  active?: Player;
  turn?: number;
  hands?: [string, string];
  pile?: string;
  houses?: Record<number, HouseSpec>;
}

/**
 * Make a hand-built state card-complete: every natural not listed anywhere goes to the bottom of the
 * pile, and an unlisted joker goes to its owner's hand. Needed wherever hidden-card counts matter
 * (e.g. determinization in AI tests).
 */
export function withFullDeck(s: GameState): GameState {
  const listed = new Set<CardId>([...s.hands[0], ...s.hands[1], ...s.pile]);
  for (const h of s.houses) for (const side of h.sides) for (const c of side) listed.add(c);
  const missing: CardId[] = [];
  for (let c = 0; c < NATURAL_COUNT; c++) if (!listed.has(c)) missing.push(c);
  const hands: [CardId[], CardId[]] = [s.hands[0].slice(), s.hands[1].slice()];
  if (s.config.wildcards) {
    for (const p of [0, 1] as const) if (!listed.has(jokerOf(p))) hands[p].push(jokerOf(p));
  }
  return { ...s, hands, pile: [...missing, ...s.pile] };
}

/**
 * Build a game state from readable card strings, for scenario tests.
 * It does not enforce card conservation; only the cards that matter need to be listed.
 * Full sides without an explicit completedAt get distinct, increasing completion plies.
 */
export function makeState(spec: StateSpec): GameState {
  const houses = Array.from({ length: HOUSE_COUNT }, emptyHouse);
  let completion = -100;
  for (const [key, h] of Object.entries(spec.houses ?? {})) {
    const house = houses[Number(key)]!;
    house.sides = [parseCards(h.p0 ?? ''), parseCards(h.p1 ?? '')];
    house.completedAt = h.completedAt ?? [
      house.sides[0].length === 3 ? completion++ : null,
      house.sides[1].length === 3 ? completion++ : null,
    ];
    house.claim = h.claim ?? null;
  }
  return {
    v: 1,
    config: { ...DEFAULT_CONFIG, ...spec.config },
    start: spec.start ?? 0,
    turn: spec.turn ?? 1,
    active: spec.active ?? spec.start ?? 0,
    hands: [parseCards(spec.hands?.[0] ?? ''), parseCards(spec.hands?.[1] ?? '')],
    pile: parseCards(spec.pile ?? ''),
    houses,
    result: null,
  };
}
