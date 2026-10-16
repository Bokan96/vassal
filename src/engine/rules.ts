import type { CardId } from './cards.ts';
import { ALLIANCE_SIZE, WIN_ADJACENT, WIN_HOUSES } from './config.ts';
import { proveHouse, tablePool } from './proof.ts';
import {
  cloneState,
  other,
  type Claim,
  type GameResult,
  type GameState,
  type House,
  type Player,
} from './state.ts';
import { houseWinner } from './strength.ts';

export interface Move {
  type: 'play';
  card: CardId;
  house: number;
}

export type GameEvent =
  | { t: 'played'; p: Player; card: CardId; house: number }
  /** card is null when redacted for the other player. */
  | { t: 'drew'; p: Player; card: CardId | null }
  | { t: 'claimed'; house: number; claim: Claim }
  | { t: 'won'; result: GameResult };

export type Emit = (e: GameEvent) => void;

/** Every legal move for the active player. A legal move always exists until the game ends (C7). */
export function legalMoves(s: GameState): Move[] {
  if (s.result) return [];
  const moves: Move[] = [];
  const hand = s.hands[s.active];
  for (let house = 0; house < s.houses.length; house++) {
    if (s.houses[house]!.sides[s.active].length >= ALLIANCE_SIZE) continue;
    for (const card of hand) moves.push({ type: 'play', card, house });
  }
  return moves;
}

export function isLegal(s: GameState, m: Move): boolean {
  return (
    !s.result &&
    m.type === 'play' &&
    Number.isInteger(m.house) &&
    m.house >= 0 &&
    m.house < s.houses.length &&
    s.hands[s.active].includes(m.card) &&
    s.houses[m.house]!.sides[s.active].length < ALLIANCE_SIZE
  );
}

/** The houses that satisfy a win condition for p, or null. */
export function winningHouses(
  houses: readonly House[],
  p: Player,
): Pick<GameResult, 'reason' | 'houses'> | null {
  for (let i = 0; i + WIN_ADJACENT <= houses.length; i++) {
    let run = true;
    for (let j = i; j < i + WIN_ADJACENT; j++) if (houses[j]!.claim?.by !== p) run = false;
    if (run) {
      return { reason: 'adjacent', houses: Array.from({ length: WIN_ADJACENT }, (_, k) => i + k) };
    }
  }
  const owned = houses.flatMap((h, i) => (h.claim?.by === p ? [i] : []));
  if (owned.length >= WIN_HOUSES) return { reason: 'five', houses: owned };
  return null;
}

function checkWin(s: GameState, emit: Emit | undefined): boolean {
  for (const p of [s.active, other(s.active)]) {
    const win = winningHouses(s.houses, p);
    if (win) {
      s.result = { winner: p, ...win };
      emit?.({ t: 'won', result: s.result });
      return true;
    }
  }
  return false;
}

function claim(s: GameState, house: number, c: Claim, emit: Emit | undefined): void {
  s.houses[house]!.claim = c;
  emit?.({ t: 'claimed', house, claim: c });
}

/** Step 1: put the card on the active player's side (claimed houses stay open, C6). */
export function playCard(s: GameState, m: Move, emit?: Emit): void {
  if (!isLegal(s, m)) throw new Error(`Illegal move: ${JSON.stringify(m)}`);
  const p = s.active;
  const hand = s.hands[p];
  hand.splice(hand.indexOf(m.card), 1);
  const house = s.houses[m.house]!;
  house.sides[p].push(m.card);
  if (house.sides[p].length === ALLIANCE_SIZE) house.completedAt[p] = s.turn;
  emit?.({ t: 'played', p, card: m.card, house: m.house });
}

/** Step 2: draw a card if the pile isn't empty. */
export function drawCard(s: GameState, emit?: Emit): void {
  const drawn = s.pile.pop();
  if (drawn !== undefined) {
    s.hands[s.active].push(drawn);
    emit?.({ t: 'drew', p: s.active, card: drawn });
  }
}

/**
 * Steps 3 and 4: 3a resolve full-vs-full houses (either player may win) → win check →
 * 3b automatic proof claims for the active player → win check (C5, C11) → no-wildcards
 * ending once every card is played (C8). Uses only the table and card counts, so the AI can
 * run it on a determinized state.
 */
export function resolveAllegiances(s: GameState, emit?: Emit): void {
  const p = s.active;

  // 3a. Resolve houses where both alliances are full.
  for (let i = 0; i < s.houses.length; i++) {
    const h = s.houses[i]!;
    if (h.claim || h.sides[0].length < ALLIANCE_SIZE || h.sides[1].length < ALLIANCE_SIZE) continue;
    claim(s, i, { by: houseWinner(h, s.start, s.config), reason: 'compare', turn: s.turn }, emit);
  }
  if (checkWin(s, emit)) return;

  // 3b. Claim every house the active player can prove (C4, C11).
  const pool = tablePool(s.houses, s.config);
  for (let i = 0; i < s.houses.length; i++) {
    const proof = proveHouse(s.houses, i, p, s.config, pool);
    if (proof?.provable) {
      claim(s, i, { by: p, reason: 'proof', turn: s.turn, oppBest: proof.oppBest }, emit);
    }
  }
  if (checkWin(s, emit)) return;

  // No-wildcards ending: every card played without a winner (C8).
  if (s.pile.length === 0 && s.hands[0].length === 0 && s.hands[1].length === 0) {
    for (let i = 0; i < s.houses.length; i++) {
      const h = s.houses[i]!;
      if (h.claim) continue;
      claim(s, i, { by: houseWinner(h, s.start, s.config), reason: 'final', turn: s.turn }, emit);
    }
    const counts = [0, 0];
    for (const h of s.houses) counts[h.claim!.by]++;
    const winner: Player = counts[0]! > counts[1]! ? 0 : 1;
    s.result = {
      winner,
      reason: 'majority',
      houses: s.houses.flatMap((h, i) => (h.claim!.by === winner ? [i] : [])),
    };
    emit?.({ t: 'won', result: s.result });
  }
}

/**
 * Apply a move in place. This is the single implementation of the turn sequence:
 * play → draw → evaluate allegiances → check winning conditions → next player.
 * Throws on an illegal move.
 */
export function step(s: GameState, m: Move, emit?: Emit): void {
  playCard(s, m, emit);
  drawCard(s, emit);
  resolveAllegiances(s, emit);
  if (!s.result) {
    s.turn++;
    s.active = other(s.active);
  }
}

/** Pure wrapper around step: returns the next state and the events produced. */
export function applyMove(s: GameState, m: Move): { state: GameState; events: GameEvent[] } {
  const next = cloneState(s);
  const events: GameEvent[] = [];
  step(next, m, (e) => events.push(e));
  return { state: next, events };
}
