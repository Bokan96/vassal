import { isJoker, NATURAL_COUNT, rankOf, suitOf, type CardId } from './cards.ts';
import type { RulesConfig } from './config.ts';
import type { House, Player } from './state.ts';

/** Alliance tiers, weakest to strongest. Incomplete only matters in the no-wildcards ending (C8). */
export const Tier = {
  Incomplete: 0,
  Discord: 1,
  Motive: 2,
  Intent: 3,
  Plan: 4,
  Scheme: 5,
  Coup: 6,
  /** Three of a kind: a house rule and the highest tier (C14). */
  Triumvirate: 7,
} as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

export const TIER_NAMES = [
  'Incomplete',
  'Discord',
  'Motive',
  'Intent',
  'Plan',
  'Scheme',
  'Coup',
  'Triumvirate',
] as const;

/**
 * Strength is a single comparable number: tier * TIER_STEP + combined rank.
 * The combined rank of three cards is at most 39, so tiers never overlap.
 */
export type Strength = number;
export const TIER_STEP = 64;

export const tierOf = (s: Strength): Tier => Math.floor(s / TIER_STEP) as Tier;
export const sumOf = (s: Strength): number => s % TIER_STEP;
export const makeStrength = (tier: Tier, sum: number): Strength => tier * TIER_STEP + sum;

export function formatStrength(s: Strength): string {
  return `${TIER_NAMES[tierOf(s)]} · ${sumOf(s)}`;
}

/**
 * A tier's power among the tiers in play: Discord 1 … Triumvirate 7, or 6 without the Motive tier.
 */
export function tierPower(tier: Tier, config: RulesConfig): number {
  return !config.motive && tier > Tier.Motive ? tier - 1 : tier;
}

/** Tier label with its power, e.g. "Plan (4)". */
export function formatTier(s: Strength, config: RulesConfig): string {
  const tier = tierOf(s);
  return `${TIER_NAMES[tier]} (${tierPower(tier, config)})`;
}

/**
 * Strength of three natural cards. Duplicates are allowed because a joker may mirror a card
 * already in its alliance (C2). Ace is low only (C1).
 */
export function naturalStrength(a: CardId, b: CardId, c: CardId, motive: boolean): Strength {
  const ra = rankOf(a);
  const rb = rankOf(b);
  const rc = rankOf(c);
  let lo = ra;
  let mid = rb;
  let hi = rc;
  if (lo > mid) [lo, mid] = [mid, lo];
  if (mid > hi) [mid, hi] = [hi, mid];
  if (lo > mid) [lo, mid] = [mid, lo];
  const sequence = mid === lo + 1 && hi === mid + 1;
  const sa = suitOf(a);
  const sb = suitOf(b);
  const sc = suitOf(c);
  const sameSuit = sa === sb && sb === sc;
  const sameColor = sa >> 1 === sb >> 1 && sb >> 1 === sc >> 1;
  let tier: Tier;
  if (sequence) tier = sameSuit ? Tier.Coup : sameColor ? Tier.Scheme : Tier.Plan;
  else if (ra === rb && rb === rc)
    tier = Tier.Triumvirate; // C14
  else if (sameSuit) tier = Tier.Intent;
  else if (sameColor && motive) tier = Tier.Motive;
  else tier = Tier.Discord;
  return tier * TIER_STEP + ra + rb + rc;
}

interface JokerTable {
  strength: Uint16Array;
  substitute: Uint8Array;
}

const jokerTables: [JokerTable | undefined, JokerTable | undefined] = [undefined, undefined];

function jokerTable(motive: boolean): JokerTable {
  const key = motive ? 1 : 0;
  const cached = jokerTables[key];
  if (cached) return cached;
  const strength = new Uint16Array(NATURAL_COUNT * NATURAL_COUNT);
  const substitute = new Uint8Array(NATURAL_COUNT * NATURAL_COUNT);
  for (let a = 0; a < NATURAL_COUNT; a++) {
    for (let b = a; b < NATURAL_COUNT; b++) {
      let best = -1;
      let bestX = 0;
      for (let x = 0; x < NATURAL_COUNT; x++) {
        const s = naturalStrength(a, b, x, motive);
        if (s > best) {
          best = s;
          bestX = x;
        }
      }
      strength[a * NATURAL_COUNT + b] = strength[b * NATURAL_COUNT + a] = best;
      substitute[a * NATURAL_COUNT + b] = substitute[b * NATURAL_COUNT + a] = bestX;
    }
  }
  const table = { strength, substitute };
  jokerTables[key] = table;
  return table;
}

/** Strength of two naturals plus a joker that takes the best possible identity. */
export function jokerStrength(a: CardId, b: CardId, motive: boolean): Strength {
  return jokerTable(motive).strength[a * NATURAL_COUNT + b]!;
}

/** The natural card a joker mirrors when played alongside a and b. */
export function jokerSubstitute(a: CardId, b: CardId, motive: boolean): CardId {
  return jokerTable(motive).substitute[a * NATURAL_COUNT + b]!;
}

export interface ResolvedAlliance {
  strength: Strength;
  /** The cards with any joker replaced by the card it mirrors. */
  effective: CardId[];
  /** The card the joker mirrors, if the alliance contains one. */
  jokerAs: CardId | null;
}

/**
 * Strength of the cards on one side of a house.
 * Fewer than three cards is an Incomplete alliance compared by combined rank (C8).
 */
export function resolveAlliance(cards: readonly CardId[], config: RulesConfig): ResolvedAlliance {
  if (cards.length < 3) {
    let sum = 0;
    for (const c of cards) if (!isJoker(c)) sum += rankOf(c);
    return { strength: makeStrength(Tier.Incomplete, sum), effective: [...cards], jokerAs: null };
  }
  if (cards.length > 3) throw new Error('An alliance has at most three cards');
  const naturals = cards.filter((c) => !isJoker(c));
  if (naturals.length === 3) {
    const [a, b, c] = naturals as [CardId, CardId, CardId];
    return {
      strength: naturalStrength(a, b, c, config.motive),
      effective: [...cards],
      jokerAs: null,
    };
  }
  if (naturals.length === 2) {
    const [a, b] = naturals as [CardId, CardId];
    const sub = jokerSubstitute(a, b, config.motive);
    return {
      strength: jokerStrength(a, b, config.motive),
      effective: cards.map((c) => (isJoker(c) ? sub : c)),
      jokerAs: sub,
    };
  }
  throw new Error('An alliance contains at most one joker (C3)');
}

export function allianceStrength(cards: readonly CardId[], config: RulesConfig): Strength {
  return resolveAlliance(cards, config).strength;
}

/**
 * Winner of a contested house: higher strength wins; equal strength goes to the side that
 * completed first; two equal incomplete alliances go to the starting player (C8).
 */
export function houseWinner(house: House, start: Player, config: RulesConfig): Player {
  const s0 = allianceStrength(house.sides[0], config);
  const s1 = allianceStrength(house.sides[1], config);
  if (s0 !== s1) return s0 > s1 ? 0 : 1;
  const [c0, c1] = house.completedAt;
  if (c0 !== null && c1 !== null) return c0 < c1 ? 0 : 1;
  return start;
}
