import { useRef } from 'react';
import type { CardId } from '../../engine/index.ts';
import { Card } from './Card.tsx';

interface HandProps {
  cards: CardId[];
  selected: CardId | null;
  enabled: boolean;
  onSelect: (card: CardId | null) => void;
}

/** The viewer's hand: a row of selectable cards with arrow-key navigation (roving tabindex). */
export function Hand({ cards, selected, enabled, onSelect }: HandProps) {
  const ref = useRef<HTMLDivElement>(null);
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
      aria-label="Your hand"
    >
      {cards.map((c, i) => (
        <Card
          key={c}
          card={c}
          size="hand"
          selected={c === selected}
          tabIndex={i === focusIndex ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, i)}
          onSelect={() => enabled && onSelect(c === selected ? null : c)}
        />
      ))}
    </div>
  );
}
