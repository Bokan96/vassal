import { useEffect, useRef, useState } from 'react';
import type { CardId } from '../../engine/index.ts';
import { playSfx } from '../sound.ts';
import { FAST } from './useGame.ts';

/** One of the viewer's cards on its way from the deck to their hand (opening = the first deal). */
export type Arrival = { card: CardId; opening: boolean };

/** Pause before each drawn card leaves the deck. */
const DRAW_STEP_MS = 80;
/** The opening hand is dealt more slowly, one card at a time. */
const OPENING_DEAL_STEP_MS = FAST ? 30 : 260;

export const arrivalLayoutId = (a: Arrival): string => `card-${a.card}`;

/**
 * Reveals cards travelling from the deck one at a time. `key` identifies the batch (it changes with
 * every move); `onOpeningDealt` fires once the last card of an opening deal has landed.
 */
export function useArrivals(arrivals: Arrival[], key: string, onOpeningDealt?: () => void) {
  const [reveal, setReveal] = useState({ key: '', count: 0 });
  const revealed = reveal.key === key ? reveal.count : 0;
  const pending = arrivals.slice(revealed);
  const pendingCount = pending.length;
  const dealing = pendingCount > 0 && pending[0]!.opening;
  const onDealt = useRef(onOpeningDealt);
  useEffect(() => {
    onDealt.current = onOpeningDealt;
  });

  useEffect(() => {
    if (pendingCount === 0) return;
    const t = setTimeout(
      () => {
        playSfx('draw');
        setReveal({ key, count: revealed + 1 });
        if (dealing && pendingCount === 1) onDealt.current?.();
      },
      dealing ? OPENING_DEAL_STEP_MS : DRAW_STEP_MS,
    );
    return () => clearTimeout(t);
  }, [key, revealed, pendingCount, dealing]);

  return {
    pending,
    dealing,
    /** Cards not yet in the hand (still on the deck). */
    pendingCards: new Set(pending.map((a) => a.card)),
    /** layoutIds for the Deck's outgoing cards. */
    outgoing: pending.map(arrivalLayoutId),
  };
}
