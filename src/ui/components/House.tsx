import {
  ALLIANCE_SIZE,
  compareCards,
  isJoker,
  resolveAlliance,
  tierOf,
  type CardId,
  type House as HouseState,
  type Move,
  type Player,
  type RulesConfig,
} from '../../engine/index.ts';
import { motion } from 'motion/react';
import { claimExplanation } from '../describe.ts';
import { HOUSES } from '../houses.ts';
import { useI18n, type Role } from '../i18n.ts';
import { Card } from './Card.tsx';
import { Shield } from './Shield.tsx';
import { Stars } from './Stars.tsx';

interface HouseProps {
  index: number;
  house: HouseState;
  config: RulesConfig;
  viewer: Player;
  roles: [Role, Role];
  /** Card currently selected in the viewer's hand, if it can be played here. */
  playable: CardId | null;
  winning: boolean;
  lastPlayed: Move | null;
  onPlay: (house: number) => void;
  /** Tutorial: draw attention to this house. */
  spotlight?: boolean;
  /** Tutorial: the board column (1–9) this house occupies. */
  column?: number;
}

function Side({
  cards,
  config,
  lastPlayed,
  className,
  label,
}: {
  cards: CardId[];
  config: RulesConfig;
  lastPlayed: CardId | null;
  className: string;
  label: string;
}) {
  const { t } = useI18n();
  const full = cards.length === ALLIANCE_SIZE;
  const resolved = full ? resolveAlliance(cards, config) : null;
  // Display order: rank, colour, suit; a joker in a full alliance sorts as the card it mirrors.
  const sortKey = (c: CardId) =>
    resolved && isJoker(c) && resolved.jokerAs !== null ? resolved.jokerAs : c;
  const shown = [...cards].sort((a, b) => compareCards(sortKey(a), sortKey(b)));
  return (
    <div className={`house__side ${className}`} aria-label={label}>
      <div className="house__cards">
        {shown.map((c) => (
          <Card
            key={c}
            card={c}
            size="board"
            fresh={c === lastPlayed}
            jokerAs={resolved && isJoker(c) ? resolved.jokerAs : null}
          />
        ))}
      </div>
      <div className="house__tier">
        {resolved && (
          <motion.span
            className="house__combo"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          >
            <span className="house__combo-name">{t.tierNames[tierOf(resolved.strength)]}</span>
            <Stars strength={resolved.strength} config={config} />
          </motion.span>
        )}
      </div>
    </div>
  );
}

export function House({
  index,
  house,
  config,
  viewer,
  roles,
  playable,
  winning,
  lastPlayed,
  onPlay,
  spotlight = false,
  column,
}: HouseProps) {
  const { t } = useI18n();
  const arms = HOUSES[index]!;
  const opponent: Player = viewer === 0 ? 1 : 0;
  const claim = house.claim;
  const fresh = lastPlayed?.house === index ? lastPlayed.card : null;
  const explanation = claim ? claimExplanation(house, config, roles, t) : '';
  const mine = house.sides[viewer];

  return (
    <div
      className={`house${playable !== null ? ' is-playable' : ''}${winning ? ' is-winning' : ''}${spotlight ? ' is-spotlight with-arrow' : ''}`}
      style={column ? ({ '--col': column } as React.CSSProperties) : undefined}
      // The winner's side takes their colour and the sigil leans towards them.
      data-claim={claim ? (claim.by === viewer ? 'viewer' : 'opponent') : 'none'}
      data-seat={claim ? claim.by : undefined}
      data-testid={`house-${index}`}
    >
      <Side
        className="house__side--opp"
        cards={house.sides[opponent]}
        config={config}
        lastPlayed={fresh}
        label={t.cardsAt(roles[opponent], index)}
      />
      <div className="house__token" title={explanation || undefined}>
        <Shield arms={arms} />
      </div>
      <Side
        className="house__side--mine"
        cards={mine}
        config={config}
        lastPlayed={fresh}
        label={t.cardsAt(roles[viewer], index)}
      />
      {playable !== null && (
        <button
          type="button"
          className="house__hit"
          onClick={() => onPlay(index)}
          aria-label={t.playTo(index)}
        />
      )}
      {claim && <span className="sr-only">{t.claimed(roles[claim.by], index, explanation)}</span>}
    </div>
  );
}
