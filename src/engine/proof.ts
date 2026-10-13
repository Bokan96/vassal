import { isJoker, jokerOf, jokerOwner, NATURAL_COUNT, type CardId } from './cards.ts';
import type { RulesConfig } from './config.ts';
import { other, type House, type Player } from './state.ts';
import { allianceStrength, jokerStrength, naturalStrength, type Strength } from './strength.ts';

/**
 * The cards that could still end up in an alliance, from public information only (C4):
 * every natural not on the table, plus each player's joker while it is not on the table.
 * Hands and the draw pile are never consulted, so proofs are reproducible from any player view.
 */
export interface ProofPool {
  /** avail[c] === 1 when natural card c is not on the table. */
  avail: Uint8Array;
  /** Whether each player's joker is still off the table. */
  jokerFree: [boolean, boolean];
}

export function tablePool(houses: readonly House[], config: RulesConfig): ProofPool {
  const avail = new Uint8Array(NATURAL_COUNT).fill(1);
  const jokerFree: [boolean, boolean] = [config.wildcards, config.wildcards];
  for (const h of houses) {
    for (const side of h.sides) {
      for (const c of side) {
        if (isJoker(c)) jokerFree[jokerOwner(c)] = false;
        else avail[c] = 0;
      }
    }
  }
  return { avail, jokerFree };
}

export interface Completion {
  /** Strongest full alliance reachable, or -1 if the side cannot be completed from the pool. */
  strength: Strength;
  /** The cards that would be added to reach it. */
  witness: CardId[];
}

interface SortedTables {
  /** All natural triples a<b<c packed as a | b << 6 | c << 12, strongest first. */
  triples: Int32Array;
  tripleStrength: Uint16Array;
  /** All natural pairs a<b packed as a | b << 6, by strength with a joker, strongest first. */
  pairs: Int32Array;
  pairStrength: Uint16Array;
}

const sortedTables: [SortedTables | undefined, SortedTables | undefined] = [undefined, undefined];

function tables(motive: boolean): SortedTables {
  const key = motive ? 1 : 0;
  const cached = sortedTables[key];
  if (cached) return cached;
  const tripleList: { packed: number; s: number }[] = [];
  const pairList: { packed: number; s: number }[] = [];
  for (let a = 0; a < NATURAL_COUNT; a++) {
    for (let b = a + 1; b < NATURAL_COUNT; b++) {
      pairList.push({ packed: a | (b << 6), s: jokerStrength(a, b, motive) });
      for (let c = b + 1; c < NATURAL_COUNT; c++) {
        tripleList.push({ packed: a | (b << 6) | (c << 12), s: naturalStrength(a, b, c, motive) });
      }
    }
  }
  tripleList.sort((x, y) => y.s - x.s);
  pairList.sort((x, y) => y.s - x.s);
  const t: SortedTables = {
    triples: Int32Array.from(tripleList, (e) => e.packed),
    tripleStrength: Uint16Array.from(tripleList, (e) => e.s),
    pairs: Int32Array.from(pairList, (e) => e.packed),
    pairStrength: Uint16Array.from(pairList, (e) => e.s),
  };
  sortedTables[key] = t;
  return t;
}

const NONE: Completion = { strength: -1, witness: [] };

/**
 * The strongest full alliance a side can still become, using naturals from `avail` and,
 * if `joker` is given and the side holds no joker yet, that joker (C3: at most one per alliance).
 */
export function bestCompletion(
  side: readonly CardId[],
  avail: Uint8Array,
  joker: CardId | null,
  config: RulesConfig,
): Completion {
  const motive = config.motive;
  const missing = 3 - side.length;
  if (missing <= 0) return { strength: allianceStrength(side, config), witness: [] };
  const sideHasJoker = side.some(isJoker);
  const nats = side.filter((c) => !isJoker(c));
  const useJoker = joker !== null && !sideHasJoker;
  let best = NONE;
  const consider = (strength: Strength, witness: CardId[]): void => {
    if (strength > best.strength) best = { strength, witness };
  };

  if (missing === 1) {
    if (sideHasJoker) {
      const a = nats[0]!;
      for (let x = 0; x < NATURAL_COUNT; x++)
        if (avail[x]) consider(jokerStrength(a, x, motive), [x]);
    } else {
      const [a, b] = nats as [CardId, CardId];
      for (let x = 0; x < NATURAL_COUNT; x++) {
        if (avail[x]) consider(naturalStrength(a, b, x, motive), [x]);
      }
      if (useJoker) consider(jokerStrength(a, b, motive), [joker]);
    }
    return best;
  }

  const t = tables(motive);
  const firstAvailablePair = (): Completion => {
    for (let i = 0; i < t.pairs.length; i++) {
      const p = t.pairs[i]!;
      const x = p & 63;
      const y = (p >> 6) & 63;
      if (avail[x] && avail[y]) return { strength: t.pairStrength[i]!, witness: [x, y] };
    }
    return NONE;
  };

  if (missing === 2) {
    if (sideHasJoker) return firstAvailablePair();
    const a = nats[0]!;
    for (let x = 0; x < NATURAL_COUNT; x++) {
      if (!avail[x]) continue;
      for (let y = x + 1; y < NATURAL_COUNT; y++) {
        if (avail[y]) consider(naturalStrength(a, x, y, motive), [x, y]);
      }
      if (useJoker) consider(jokerStrength(a, x, motive), [x, joker]);
    }
    return best;
  }

  // missing === 3: the side is empty.
  for (let i = 0; i < t.triples.length; i++) {
    const p = t.triples[i]!;
    const x = p & 63;
    const y = (p >> 6) & 63;
    const z = (p >> 12) & 63;
    if (avail[x] && avail[y] && avail[z]) {
      consider(t.tripleStrength[i]!, [x, y, z]);
      break;
    }
  }
  if (useJoker) {
    const pair = firstAvailablePair();
    if (pair.strength >= 0) consider(pair.strength, [...pair.witness, joker]);
  }
  return best;
}

export interface Proof {
  provable: boolean;
  /** The strongest alliance the opponent could still form there (-1 if none). */
  oppBest: Strength;
  /** Cards that would realise oppBest. */
  witness: CardId[];
}

/**
 * Can `claimant` prove that the opponent cannot beat their full alliance at this house? (C4)
 * Ties favour the claimant, who necessarily completed first.
 * Returns null when a proof claim does not apply (house claimed, claimant incomplete, or the
 * opponent's alliance is already full, which is resolved by comparison instead).
 */
export function proveHouse(
  houses: readonly House[],
  index: number,
  claimant: Player,
  config: RulesConfig,
  pool: ProofPool = tablePool(houses, config),
): Proof | null {
  const h = houses[index]!;
  const opp = other(claimant);
  if (h.claim || h.sides[claimant].length < 3 || h.sides[opp].length >= 3) return null;
  const mine = allianceStrength(h.sides[claimant], config);
  const joker = pool.jokerFree[opp] ? jokerOf(opp) : null;
  const best = bestCompletion(h.sides[opp], pool.avail, joker, config);
  return { provable: best.strength <= mine, oppBest: best.strength, witness: best.witness };
}
