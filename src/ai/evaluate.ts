import {
  ALLIANCE_SIZE,
  HOUSE_COUNT,
  isJoker,
  jokerOf,
  jokerStrength,
  makeStrength,
  NATURAL_COUNT,
  naturalStrength,
  other,
  proveHouse,
  rankOf,
  tablePool,
  Tier,
  TIER_STEP,
  WIN_ADJACENT,
  WIN_HOUSES,
  allianceStrength,
  type CardId,
  type House,
  type Player,
  type PlayerView,
  type ProofPool,
  type RulesConfig,
} from '../engine/index.ts';

/** Strength buckets: every possible strength is below (top tier + 1) * TIER_STEP. */
const BUCKETS = (Tier.Triumvirate + 1) * TIER_STEP;
/** Chance that a joker in hand ends up on a given side (it can only be used once). */
const JOKER_Q = 0.85;
const MIN_Q = 1e-4;

/**
 * What one player knows about where cards can still go, from their own view only.
 * q[p][c] is the estimated probability that player p can still put natural c on one of their sides.
 */
export interface Knowledge {
  me: Player;
  config: RulesConfig;
  q: [Float64Array, Float64Array];
  jokerQ: [number, number];
  pool: ProofPool;
}

export function knowledge(view: PlayerView): Knowledge {
  const me = view.me;
  const opp = other(me);
  const pool = tablePool(view.houses, view.config);
  const inHand = new Uint8Array(NATURAL_COUNT + 2);
  for (const c of view.hand) inHand[c] = 1;
  const oppJokerFree = pool.jokerFree[opp];
  const oppHandNaturals = view.oppHandCount - (oppJokerFree ? 1 : 0);
  const unseen = oppHandNaturals + view.pileCount;
  // The pile is drawn alternately, starting with the active player.
  const myDraws =
    view.active === me ? Math.ceil(view.pileCount / 2) : Math.floor(view.pileCount / 2);
  const oppDraws = view.pileCount - myDraws;
  const qMe = unseen > 0 ? myDraws / unseen : 0;
  const qOpp = unseen > 0 ? (oppHandNaturals + oppDraws) / unseen : 0;

  const q: [Float64Array, Float64Array] = [
    new Float64Array(NATURAL_COUNT),
    new Float64Array(NATURAL_COUNT),
  ];
  for (let c = 0; c < NATURAL_COUNT; c++) {
    if (!pool.avail[c]) continue;
    q[me][c] = inHand[c] ? 1 : qMe;
    q[opp][c] = inHand[c] ? 0 : qOpp;
  }
  const jokerQ: [number, number] = [0, 0];
  jokerQ[me] = inHand[jokerOf(me)] ? JOKER_Q : 0;
  jokerQ[opp] = oppJokerFree ? JOKER_Q : 0;
  return { me, config: view.config, q, jokerQ, pool };
}

// Scratch buffers reused across calls (evaluation is single-threaded).
const miss = new Float64Array(BUCKETS);

/** Prior for a side with no cards yet: a typical alliance under sensible play. */
function emptyPrior(config: RulesConfig, out: Float64Array): void {
  const tiers: [Tier, number][] = [
    [Tier.Discord, config.motive ? 0.27 : 0.55],
    [Tier.Motive, config.motive ? 0.28 : 0],
    [Tier.Intent, 0.18],
    [Tier.Plan, 0.14],
    [Tier.Scheme, 0.06],
    [Tier.Triumvirate, 0.03],
    [Tier.Coup, 0.04],
  ];
  for (const [tier, mass] of tiers) {
    for (const sum of [15, 20, 25]) out[makeStrength(tier, sum)]! += mass / 3;
  }
}

/** Turn per-bucket "no completion here" probabilities into the distribution of the best one. */
function sweep(out: Float64Array, fallback: number): void {
  let remaining = 1;
  for (let s = BUCKETS - 1; s >= 0 && remaining > 1e-9; s--) {
    const m = miss[s]!;
    if (m >= 1) continue;
    const mass = remaining * (1 - m);
    out[s]! += mass;
    remaining -= mass;
  }
  if (remaining > 1e-9) out[fallback]! += remaining;
}

/**
 * Distribution of the final strength of `who`'s alliance on one side, assuming each still-possible
 * card arrives independently with probability q and the best realised completion is used.
 */
export function sideDistribution(side: readonly CardId[], who: Player, k: Knowledge): Float64Array {
  const out = new Float64Array(BUCKETS);
  const { config } = k;
  const motive = config.motive;
  const q = k.q[who];
  const missing = ALLIANCE_SIZE - side.length;
  if (missing <= 0) {
    out[allianceStrength(side, config)] = 1;
    return out;
  }
  const hasJoker = side.some(isJoker);
  const jq = hasJoker ? 0 : k.jokerQ[who];
  const nats = side.filter((c) => !isJoker(c));
  let sideSum = 0;
  for (const c of nats) sideSum += rankOf(c);
  const fallback = makeStrength(Tier.Discord, sideSum + 2 * missing);

  if (missing === 3) {
    emptyPrior(config, out);
    if (who === k.me) raiseToCertainTriple(q, k.jokerQ[who], motive, out);
    return out;
  }

  miss.fill(1);
  if (missing === 1) {
    const a = nats[0]!;
    if (hasJoker) {
      for (let x = 0; x < NATURAL_COUNT; x++) {
        const qx = q[x]!;
        if (qx > MIN_Q) miss[jokerStrength(a, x, motive)]! *= 1 - qx;
      }
    } else {
      const b = nats[1]!;
      for (let x = 0; x < NATURAL_COUNT; x++) {
        const qx = q[x]!;
        if (qx > MIN_Q) miss[naturalStrength(a, b, x, motive)]! *= 1 - qx;
      }
      if (jq > 0) miss[jokerStrength(a, b, motive)]! *= 1 - jq;
    }
  } else if (hasJoker) {
    for (let x = 0; x < NATURAL_COUNT; x++) {
      const qx = q[x]!;
      if (qx <= MIN_Q) continue;
      for (let y = x + 1; y < NATURAL_COUNT; y++) {
        const qxy = qx * q[y]!;
        if (qxy > MIN_Q) miss[jokerStrength(x, y, motive)]! *= 1 - qxy;
      }
    }
  } else {
    const a = nats[0]!;
    for (let x = 0; x < NATURAL_COUNT; x++) {
      const qx = q[x]!;
      if (qx <= MIN_Q) continue;
      for (let y = x + 1; y < NATURAL_COUNT; y++) {
        const qxy = qx * q[y]!;
        if (qxy > MIN_Q) miss[naturalStrength(a, x, y, motive)]! *= 1 - qxy;
      }
      if (jq > 0) miss[jokerStrength(a, x, motive)]! *= 1 - qx * jq;
    }
  }
  sweep(out, fallback);
  return out;
}

/** For my own empty side: I can always reach at least the best triple already in my hand. */
function raiseToCertainTriple(
  q: Float64Array,
  jq: number,
  motive: boolean,
  out: Float64Array,
): void {
  const sure: CardId[] = [];
  for (let c = 0; c < NATURAL_COUNT; c++) if (q[c] === 1) sure.push(c);
  let best = -1;
  for (let i = 0; i < sure.length; i++) {
    for (let j = i + 1; j < sure.length; j++) {
      if (jq > 0) best = Math.max(best, jokerStrength(sure[i]!, sure[j]!, motive));
      for (let l = j + 1; l < sure.length; l++) {
        best = Math.max(best, naturalStrength(sure[i]!, sure[j]!, sure[l]!, motive));
      }
    }
  }
  if (best < 0) return;
  let below = 0;
  for (let s = 0; s < best; s++) {
    below += out[s]!;
    out[s] = 0;
  }
  out[best]! += below;
}

/** P(a > b) + tieShare * P(a = b) for independent distributions. */
function beats(a: Float64Array, b: Float64Array, tieShare: number): number {
  let below = 0;
  let p = 0;
  for (let s = 0; s < BUCKETS; s++) {
    const bs = b[s]!;
    const as = a[s]!;
    if (as > 0) p += as * (below + tieShare * bs);
    below += bs;
  }
  return p;
}

/** Estimated probability that `k.me` wins this house. */
export function houseWinProbability(houses: readonly House[], index: number, k: Knowledge): number {
  const h = houses[index]!;
  const me = k.me;
  const opp = other(me);
  if (h.claim) return h.claim.by === me ? 1 : 0;
  const mineFull = h.sides[me].length === ALLIANCE_SIZE;
  const theirsFull = h.sides[opp].length === ALLIANCE_SIZE;
  if (mineFull && proveHouse(houses, index, me, k.config, k.pool)?.provable) return 1;
  if (theirsFull && proveHouse(houses, index, opp, k.config, k.pool)?.provable) return 0;
  const a = sideDistribution(h.sides[me], me, k);
  const b = sideDistribution(h.sides[opp], opp, k);
  // Ties go to whoever completed first; if both are open it's a coin flip.
  const tie = mineFull ? 1 : theirsFull ? 0 : 0.5;
  return beats(a, b, tie);
}

/** Probability of reaching the win condition given independent per-house probabilities. */
export function winChance(p: readonly number[]): number {
  // Poisson-binomial: P(at least WIN_HOUSES houses).
  let dist = new Float64Array(HOUSE_COUNT + 1);
  dist[0] = 1;
  for (const ph of p) {
    const next = new Float64Array(HOUSE_COUNT + 1);
    for (let n = 0; n < HOUSE_COUNT; n++) {
      const d = dist[n]!;
      if (d === 0) continue;
      next[n]! += d * (1 - ph);
      next[n + 1]! += d * ph;
    }
    dist = next;
  }
  let five = 0;
  for (let n = WIN_HOUSES; n <= HOUSE_COUNT; n++) five += dist[n]!;
  let noRun = 1;
  for (let i = 0; i + WIN_ADJACENT <= p.length; i++) {
    let w = 1;
    for (let j = i; j < i + WIN_ADJACENT; j++) w *= p[j]!;
    noRun *= 1 - w;
  }
  return 1 - (1 - five) * noRun;
}

export interface Evaluation {
  /** Per-house probability that the viewer wins it. */
  houses: number[];
  /** In [-1, 1]: my estimated win chance minus the opponent's. */
  value: number;
}

export function evaluateHouses(houses: readonly House[], k: Knowledge): Evaluation {
  const p = houses.map((_, i) => houseWinProbability(houses, i, k));
  return { houses: p, value: winChance(p) - winChance(p.map((x) => 1 - x)) };
}

export function evaluateView(view: PlayerView): Evaluation {
  if (view.result) {
    const won = view.result.winner === view.me;
    return {
      houses: view.houses.map((h) => (h.claim?.by === view.me ? 1 : 0)),
      value: won ? 1 : -1,
    };
  }
  return evaluateHouses(view.houses, knowledge(view));
}
