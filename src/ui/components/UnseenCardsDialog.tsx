import { useEffect, useRef } from 'react';
import {
  cardId,
  cardName,
  jokerOf,
  RANK_LABELS,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  type CardId,
  type PlayerView,
} from '../../engine/index.ts';

interface UnseenCardsDialogProps {
  open: boolean;
  onClose: () => void;
  view: PlayerView;
  opponentName: string;
}

/**
 * The cards the viewer has not seen: everything except the cards on the table and in their own
 * hand. They are in the draw pile or in the opponent's hand.
 */
export function UnseenCardsDialog({ open, onClose, view, opponentName }: UnseenCardsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const seen = new Set<CardId>(view.hand);
  for (const h of view.houses) for (const side of h.sides) for (const c of side) seen.add(c);
  const opp = view.me === 0 ? 1 : 0;
  const unseenJoker = view.config.wildcards && !seen.has(jokerOf(opp));
  let unseen = unseenJoker ? 1 : 0;
  for (let c = 0; c < 52; c++) if (!seen.has(c)) unseen++;

  return (
    <dialog ref={ref} className="dialog unseen" onClose={onClose} aria-labelledby="unseen-title">
      <header className="dialog__header">
        <h2 id="unseen-title">Unseen cards ({unseen})</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="unseen__body">
        <p className="unseen__summary">
          Every card that is not on the table or in your hand: {view.pileCount} in the draw pile and{' '}
          {view.oppHandCount} in{' '}
          {opponentName === 'Opponent' ? "the opponent's" : `${opponentName}'s`} hand.
        </p>
        <div className="unseen__grid" role="list">
          {SUIT_SYMBOLS.map((symbol, suit) => (
            <div key={symbol} className="unseen__row" role="listitem" aria-label={SUIT_NAMES[suit]}>
              <span className={`unseen__suit${suit >= 2 ? ' is-red' : ''}`} aria-hidden="true">
                {symbol}
              </span>
              {RANK_LABELS.map((rank, r) => {
                const c = cardId(r + 1, suit);
                const gone = seen.has(c);
                return (
                  <span
                    key={rank}
                    className={`mini-card${suit >= 2 ? ' is-red' : ''}${gone ? ' is-gone' : ''}`}
                    aria-label={gone ? undefined : cardName(c)}
                    aria-hidden={gone || undefined}
                    role={gone ? undefined : 'img'}
                  >
                    {rank}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {view.config.wildcards && (
          <p className="unseen__joker">
            {unseenJoker
              ? `${opponentName === 'Opponent' ? 'The opponent' : opponentName} still holds their Joker.`
              : `${opponentName === 'Opponent' ? "The opponent's" : `${opponentName}'s`} Joker has been played.`}
          </p>
        )}
      </div>
    </dialog>
  );
}
