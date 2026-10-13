import {
  ALLIANCE_SIZE,
  compareCards,
  formatTier,
  isJoker,
  resolveAlliance,
  type CardId,
  type House as HouseState,
  type Move,
  type Player,
  type RulesConfig,
} from '../../engine/index.ts';
import { claimExplanation } from '../describe.ts';
import { HOUSES, houseLabel } from '../houses.ts';
import { Card } from './Card.tsx';
import { Shield } from './Shield.tsx';

interface HouseProps {
  index: number;
  house: HouseState;
  config: RulesConfig;
  viewer: Player;
  names: [string, string];
  /** Card currently selected in the viewer's hand, if it can be played here. */
  playable: CardId | null;
  winning: boolean;
  lastPlayed: Move | null;
  onPlay: (house: number) => void;
}

function Side({
  cards,
  config,
  lastPlayed,
  slots,
  className,
  label,
}: {
  cards: CardId[];
  config: RulesConfig;
  lastPlayed: CardId | null;
  slots: number;
  className: string;
  label: string;
}) {
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
        {Array.from({ length: slots }, (_, i) => (
          <div key={`slot-${i}`} className="slot" aria-hidden="true" />
        ))}
      </div>
      <div className="house__tier">{resolved ? formatTier(resolved.strength, config) : ''}</div>
    </div>
  );
}

export function House({
  index,
  house,
  config,
  viewer,
  names,
  playable,
  winning,
  lastPlayed,
  onPlay,
}: HouseProps) {
  const arms = HOUSES[index]!;
  const label = houseLabel(index);
  const opponent: Player = viewer === 0 ? 1 : 0;
  const claim = house.claim;
  const fresh = lastPlayed?.house === index ? lastPlayed.card : null;
  const explanation = claim ? claimExplanation(house, config, names) : '';
  const mine = house.sides[viewer];
  const showSlot = playable !== null && mine.length < ALLIANCE_SIZE ? 1 : 0;
  const whose = (p: Player) => (p === viewer && names[p] === 'You' ? 'Your' : `${names[p]}'s`);

  return (
    <div
      className={`house${playable !== null ? ' is-playable' : ''}${winning ? ' is-winning' : ''}`}
      // Which way the token leans (towards the winner) and whose colour the house takes.
      data-claim={claim ? (claim.by === viewer ? 'viewer' : 'opponent') : 'none'}
      data-seat={claim ? claim.by : undefined}
      data-testid={`house-${index}`}
    >
      <Side
        className="house__side--opp"
        cards={house.sides[opponent]}
        config={config}
        lastPlayed={fresh}
        slots={0}
        label={`${whose(opponent)} cards at ${label}`}
      />
      <div className="house__token" title={explanation || undefined}>
        <Shield arms={arms} />
        <span className="house__number" aria-hidden="true">
          {index + 1}
        </span>
        {claim && (
          <span className="house__pledge">
            {names[claim.by]}
            {claim.reason === 'proof' ? ' · proof' : ''}
          </span>
        )}
      </div>
      <Side
        className="house__side--mine"
        cards={mine}
        config={config}
        lastPlayed={fresh}
        slots={showSlot}
        label={`${whose(viewer)} cards at ${label}`}
      />
      {playable !== null && (
        <button
          type="button"
          className="house__hit"
          onClick={() => onPlay(index)}
          aria-label={`Play to ${label}`}
        />
      )}
      {claim && (
        <span className="sr-only">{`${names[claim.by]} won ${label}. ${explanation}`}</span>
      )}
    </div>
  );
}
