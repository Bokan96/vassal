import {
  ALLIANCE_SIZE,
  allianceStrength,
  bestCompletion,
  isJoker,
  jokerOf,
  other,
  rankOf,
  suitOf,
  tierOf,
  Tier,
  NATURAL_COUNT,
  type CardId,
  type House,
  type Move,
  type Player,
  type Rng,
  type RulesConfig,
} from '../engine/index.ts';

/** The minimal position a policy needs; both GameState (rollouts) and PlayerView provide it. */
export interface PolicyInput {
  config: RulesConfig;
  me: Player;
  hand: readonly CardId[];
  houses: readonly House[];
}

const JOKER_EARLY_PENALTY = 30;

/** Whether natural `c` is still off the table. */
type Avail = Uint8Array;

function tableAvail(houses: readonly House[]): { avail: Avail; jokerOnTable: [boolean, boolean] } {
  const avail = new Uint8Array(NATURAL_COUNT).fill(1);
  const jokerOnTable: [boolean, boolean] = [false, false];
  for (const h of houses) {
    for (const side of h.sides) {
      for (const c of side) {
        if (isJoker(c)) jokerOnTable[c - NATURAL_COUNT] = true;
        else avail[c] = 0;
      }
    }
  }
  return { avail, jokerOnTable };
}

/** Best tier two cards can still grow into, given which naturals are still off the table. */
function pairPotential(a: CardId, b: CardId, avail: Avail, motive: boolean): Tier {
  if (isJoker(a) || isJoker(b)) return Tier.Triumvirate;
  const ra = rankOf(a);
  const rb = rankOf(b);
  const sa = suitOf(a);
  const sb = suitOf(b);
  const sameSuit = sa === sb;
  const sameColor = sa >> 1 === sb >> 1;
  const lo = Math.min(ra, rb);
  const hi = Math.max(ra, rb);
  const needed: number[] = [];
  if (hi - lo === 1) needed.push(lo - 1, hi + 1);
  else if (hi - lo === 2) needed.push(lo + 1);
  let tier: Tier = sameSuit ? Tier.Intent : sameColor && motive ? Tier.Motive : Tier.Discord;
  for (const r of needed) {
    if (r < 1 || r > 13) continue;
    for (let s = 0; s < 4; s++) {
      if (!avail[s * 13 + r - 1]) continue;
      const t =
        sameSuit && s === sa
          ? Tier.Coup
          : sameColor && s >> 1 === sa >> 1
            ? Tier.Scheme
            : Tier.Plan;
      if (t > tier) tier = t;
    }
  }
  // A pair can become a Triumvirate while a third card of its rank is still off the table (C14).
  // `avail` only tracks the table, so the pair's own cards must be skipped explicitly.
  if (ra === rb && tier < Tier.Triumvirate) {
    for (let s = 0; s < 4; s++) {
      if (s !== sa && s !== sb && avail[s * 13 + ra - 1]) return Tier.Triumvirate;
    }
  }
  return tier;
}

/**
 * Heuristic score of every legal move from local features only. Cheap enough to drive rollouts.
 * Higher is better for `input.me`.
 */
export function scoreMoves(input: PolicyInput): { moves: Move[]; scores: number[] } {
  const { config, me, hand, houses } = input;
  const opp = other(me);
  const { avail, jokerOnTable } = tableAvail(houses);
  const oppJoker = config.wildcards && !jokerOnTable[opp] ? jokerOf(opp) : null;
  const myJoker = jokerOf(me);
  const moves: Move[] = [];
  const scores: number[] = [];

  // Houses where the outcome no longer depends on me: claimed, or the opponent is full and I
  // can no longer beat them. Cards played there are free discards (C6).
  const dead = houses.map((h) => {
    if (h.claim) return true;
    const mine = h.sides[me];
    const theirs = h.sides[opp];
    if (theirs.length < ALLIANCE_SIZE || mine.length >= ALLIANCE_SIZE) return false;
    const joker = hand.includes(myJoker) ? myJoker : null;
    return bestCompletion(mine, avail, joker, config).strength <= allianceStrength(theirs, config);
  });

  for (let hi = 0; hi < houses.length; hi++) {
    const h = houses[hi]!;
    const mine = h.sides[me];
    if (mine.length >= ALLIANCE_SIZE) continue;
    const theirs = h.sides[opp];
    // Value of a house grows with neighbouring houses I own (towards 3 adjacent).
    const neighbours =
      (hi > 0 && houses[hi - 1]!.claim?.by === me ? 1 : 0) +
      (hi < houses.length - 1 && houses[hi + 1]!.claim?.by === me ? 1 : 0);
    const weight = 1 + 0.25 * neighbours;

    for (const c of hand) {
      let score: number;
      const joker = isJoker(c);
      if (dead[hi]) {
        // Discard the least useful card; never waste the joker.
        score = -12 - (joker ? 100 : rankOf(c) * 0.4);
        if (!h.claim && mine.length === ALLIANCE_SIZE - 1) score -= 6; // would hand them the house now
      } else if (mine.length === ALLIANCE_SIZE - 1) {
        const s = allianceStrength([...mine, c], config);
        if (theirs.length === ALLIANCE_SIZE) {
          score = s > allianceStrength(theirs, config) ? 70 * weight : -70;
        } else {
          const threat = bestCompletion(theirs, avail, oppJoker, config).strength;
          score = (s >= threat ? 60 : 8 * tierOf(s) + (s % 64) / 4) * weight;
        }
      } else if (mine.length === 1) {
        const tier = pairPotential(mine[0]!, c, avail, config.motive);
        score =
          (7 * tier + (isJoker(mine[0]!) ? 0 : rankOf(mine[0]!) + rankOf(c)) / 4 - 22) * weight;
        if (joker) score -= JOKER_EARLY_PENALTY;
        // Don't build a weak alliance against a strong, complete one.
        if (theirs.length === ALLIANCE_SIZE && tier < tierOf(allianceStrength(theirs, config))) {
          score -= 15;
        }
      } else {
        score = 2 + (joker ? -JOKER_EARLY_PENALTY - 10 : rankOf(c) / 4) - 2 * theirs.length;
      }
      moves.push({ type: 'play', card: c, house: hi });
      scores.push(score);
    }
  }
  return { moves, scores };
}

/** Pick a move: softmax over heuristic scores (temperature 0 = greedy). */
export function chooseEasy(input: PolicyInput, rng: Rng, temperature: number): Move {
  const { moves, scores } = scoreMoves(input);
  if (moves.length === 0) throw new Error('No legal moves');
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[best]!) best = i;
  if (temperature <= 0) return moves[best]!;
  const top = scores[best]!;
  const weights = scores.map((s) => Math.exp((s - top) / temperature));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return moves[i]!;
  }
  return moves[best]!;
}
