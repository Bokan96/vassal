import { motion } from 'motion/react';
import {
  cardName,
  colorOf,
  formatCard,
  isJoker,
  rankOf,
  RANK_LABELS,
  RED,
  suitOf,
  SUIT_SYMBOLS,
  type CardId,
} from '../../engine/index.ts';

interface CardProps {
  card: CardId;
  size: 'hand' | 'board';
  selected?: boolean;
  /** Visually emphasise (e.g. the card just played). */
  fresh?: boolean;
  /** The card a joker stands for in a full alliance. */
  jokerAs?: CardId | null;
  onSelect?: () => void;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/** Swift re-sorting and flights between deck, hand and board. */
const LAYOUT = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const;

function Face({ card, size, jokerAs }: Pick<CardProps, 'card' | 'size' | 'jokerAs'>) {
  if (isJoker(card)) {
    return (
      <>
        <span className="card__index">
          <span className="card__rank">★</span>
        </span>
        <svg className="card__crown" viewBox="0 0 40 30" aria-hidden="true">
          <path d="M3 26 L6 8 L14 17 L20 3 L26 17 L34 8 L37 26 Z" />
          <circle cx="6" cy="7" r="2.4" />
          <circle cx="20" cy="2.6" r="2.4" />
          <circle cx="34" cy="7" r="2.4" />
        </svg>
        {size === 'hand' && <span className="card__joker-label">Joker</span>}
        {jokerAs != null && <span className="card__as">={formatCard(jokerAs)}</span>}
      </>
    );
  }
  const suit = SUIT_SYMBOLS[suitOf(card)];
  const rank = RANK_LABELS[rankOf(card) - 1];
  return (
    <>
      <span className="card__index">
        <span className="card__rank">{rank}</span>
        <span className="card__suit">{suit}</span>
      </span>
      <span className="card__pip" aria-hidden="true">
        {suit}
      </span>
      {size === 'hand' && (
        <span className="card__index card__index--bottom" aria-hidden="true">
          <span className="card__rank">{rank}</span>
          <span className="card__suit">{suit}</span>
        </span>
      )}
    </>
  );
}

export function Card({
  card,
  size,
  selected,
  fresh,
  jokerAs,
  onSelect,
  tabIndex,
  onKeyDown,
}: CardProps) {
  const tone = isJoker(card) ? 'joker' : colorOf(card) === RED ? 'red' : 'black';
  const className = `card card--${size} card--${tone}${selected ? ' is-selected' : ''}${fresh ? ' is-fresh' : ''}`;
  const label =
    cardName(card) + (jokerAs != null ? `, standing in for the ${cardName(jokerAs)}` : '');
  const layoutId = `card-${card}`;
  if (onSelect) {
    return (
      <motion.button
        layoutId={layoutId}
        type="button"
        className={className}
        aria-label={label}
        aria-pressed={!!selected}
        onClick={onSelect}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        animate={{ y: selected ? -14 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 34, layout: LAYOUT }}
      >
        <Face card={card} size={size} jokerAs={jokerAs} />
      </motion.button>
    );
  }
  return (
    <motion.div
      layoutId={layoutId}
      className={className}
      role="img"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, layout: LAYOUT }}
    >
      <Face card={card} size={size} jokerAs={jokerAs} />
    </motion.div>
  );
}

export function CardBack({
  small,
  className = '',
  layoutId,
}: {
  small?: boolean;
  className?: string;
  /** Lets a back fly between places (e.g. from the deck to the opponent's hand). */
  layoutId?: string;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={{ layout: LAYOUT }}
      className={`card-back${small ? ' card-back--small' : ''} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
