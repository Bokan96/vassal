import { useRef } from 'react';
import { sortCards, type CardId } from '../../engine/index.ts';
import { useI18n } from '../i18n.ts';
import { Card } from './Card.tsx';

interface HandProps {
  cards: CardId[];
  selected: CardId | null;
  enabled: boolean;
  onSelect: (card: CardId | null) => void;
  /** Tutorial: only this card may be selected. */
  allowed?: CardId | null;
  /** Tutorial: the card to point at. */
  spotlight?: CardId | null;
}

/**
 * The viewer's hand, sorted by rank, colour and suit: a row of selectable cards with arrow-key
 * navigation (roving tabindex).
 */
export function Hand({
  cards: unsorted,
  selected,
  enabled,
  onSelect,
  allowed = null,
  spotlight = null,
}: HandProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const cards = sortCards(unsorted);
  const focusIndex = Math.max(0, selected === null ? 0 : cards.indexOf(selected));

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button.card');
    if (!buttons) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
      buttons[next]?.focus();
    }
  };

  return (
    <div
      className={`hand${enabled ? '' : ' is-disabled'}`}
      ref={ref}
      role="group"
      aria-label={t.yourHand}
    >
      {cards.map((c, i) => (
        <Card
          key={c}
          card={c}
          size="hand"
          selected={c === selected}
          tabIndex={i === focusIndex ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, i)}
          spotlight={c === spotlight}
          dimmed={allowed !== null && c !== allowed}
          onSelect={() =>
            enabled && (allowed === null || allowed === c) && onSelect(c === selected ? null : c)
          }
        />
      ))}
    </div>
  );
}
