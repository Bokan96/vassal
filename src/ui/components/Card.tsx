import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.ts';
import {
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
  /** Tutorial: draw attention to this card. */
  spotlight?: boolean;
  /** Tutorial: shown but not playable right now. */
  dimmed?: boolean;
  /** Just drawn: flies in from the deck slowly, enlarged for a moment so the player sees it. */
  drawn?: boolean;
}

/** Swift re-sorting and flights between deck, hand and board. */
const LAYOUT = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const;
/** The flight of a freshly drawn card from the deck into its place in the hand. */
const DRAW_FLIGHT = { type: 'tween', duration: 0.7, ease: [0.3, 0.7, 0.2, 1] } as const;
/** How much a drawn card grows, and the shape of that moment: grow on the way, hold, settle. */
const DRAW_POP = { scale: 1.35, duration: 1.5, times: [0, 0.35, 0.75, 1] } as const;

/**
 * The drawn-card moment. It is decided once, when the card mounts in the hand, and then runs its
 * course even if `drawn` is cleared meanwhile (the opponent answering mid-flight starts a new
 * batch of arrivals). The scale lives on scaleX/scaleY so it composes with the `scale` the card
 * already animates (tutorial spotlight).
 */
function useDrawPop(drawn: boolean | undefined) {
  const pop = useMotionValue(1);
  const [showing, setShowing] = useState(!!drawn);
  useEffect(() => {
    if (!showing) return;
    const t = setTimeout(() => setShowing(false), DRAW_POP.duration * 1000);
    return () => clearTimeout(t);
  }, [showing]);
  const reduce = useReducedMotion();
  const atMount = useRef({ drawn, reduce });
  useEffect(() => {
    const { drawn, reduce } = atMount.current;
    if (!drawn || reduce) return;
    const s = DRAW_POP.scale;
    const controls = animate(pop, [1, s, s, 1], {
      duration: DRAW_POP.duration,
      times: [...DRAW_POP.times],
      ease: 'easeInOut',
    });
    return () => {
      controls.stop();
      pop.set(1);
    };
  }, [pop]);
  return { pop, showing };
}

function Face({ card, size, jokerAs }: Pick<CardProps, 'card' | 'size' | 'jokerAs'>) {
  const joker = useI18n().t.joker;
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
        {size === 'hand' && <span className="card__joker-label">{joker}</span>}
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
  spotlight,
  dimmed,
  drawn,
}: CardProps) {
  const { pop, showing: showingDraw } = useDrawPop(drawn);
  const tone = isJoker(card) ? 'joker' : colorOf(card) === RED ? 'red' : 'black';
  const className = `card card--${size} card--${tone}${selected ? ' is-selected' : ''}${fresh ? ' is-fresh' : ''}${spotlight ? ' is-spotlight with-arrow' : ''}${dimmed ? ' is-dimmed' : ''}${showingDraw ? ' is-drawn' : ''}`;
  const { t } = useI18n();
  const label = t.cardName(card) + (jokerAs != null ? t.standingIn(jokerAs) : '');
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
        style={{ scaleX: pop, scaleY: pop }}
        animate={{ y: selected ? -14 : 0, scale: spotlight ? 1.14 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 34, layout: showingDraw ? DRAW_FLIGHT : LAYOUT }}
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
