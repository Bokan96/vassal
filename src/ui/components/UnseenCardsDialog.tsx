import { useEffect, useRef } from 'react';
import {
  cardId,
  jokerOf,
  RANK_LABELS,
  SUIT_SYMBOLS,
  type CardId,
  type PlayerView,
} from '../../engine/index.ts';
import { useI18n, type Role } from '../i18n.ts';

interface UnseenCardsDialogProps {
  open: boolean;
  onClose: () => void;
  view: PlayerView;
  opponent: Role;
}

/**
 * The cards the viewer has not seen: everything except the cards on the table and in their own
 * hand. They are in the draw pile or in the opponent's hand.
 */
export function UnseenCardsDialog({ open, onClose, view, opponent }: UnseenCardsDialogProps) {
  const { t } = useI18n();
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
        <h2 id="unseen-title">{t.unseenTitle(unseen)}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </header>
      <div className="unseen__body">
        <p className="unseen__summary">
          {t.unseenSummary(view.pileCount, view.oppHandCount, opponent)}
        </p>
        <div className="unseen__grid" role="list">
          {SUIT_SYMBOLS.map((symbol, suit) => (
            <div
              key={symbol}
              className="unseen__row"
              role="listitem"
              aria-label={t.suitNames[suit]}
            >
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
                    aria-label={gone ? undefined : t.cardName(c)}
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
            {unseenJoker ? t.jokerHeld(opponent) : t.jokerPlayed(opponent)}
          </p>
        )}
      </div>
    </dialog>
  );
}
