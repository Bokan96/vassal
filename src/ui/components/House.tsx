import {
  ALLIANCE_SIZE,
  formatStrength,
  isJoker,
  resolveAlliance,
  type CardId,
  type House as HouseState,
  type Move,
  type Player,
  type RulesConfig,
} from '../../engine/index.ts';
import { claimExplanation } from '../describe.ts';
import { HOUSES } from '../houses.ts';
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
  return (
    <div className={`house__side ${className}`} aria-label={label}>
      <div className="house__cards">
        {cards.map((c) => (
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
      <div className={`house__tier${resolved ? '' : ' is-empty'}`}>
        {resolved ? formatStrength(resolved.strength) : cards.length > 0 ? `${cards.length}/3` : ''}
      </div>
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
  const opponent: Player = viewer === 0 ? 1 : 0;
  const claim = house.claim;
  const claimSide = claim ? (claim.by === viewer ? 'viewer' : 'opponent') : 'none';
  const fresh = lastPlayed?.house === index ? lastPlayed.card : null;
  const explanation = claim ? claimExplanation(house, config, names) : '';
  const mine = house.sides[viewer];
  const showSlot = playable !== null && mine.length < ALLIANCE_SIZE ? 1 : 0;

  return (
    <div
      className={`house${playable !== null ? ' is-playable' : ''}${winning ? ' is-winning' : ''}`}
      data-claim={claimSide}
      data-testid={`house-${index}`}
    >
      <Side
        className="house__side--opp"
        cards={house.sides[opponent]}
        config={config}
        lastPlayed={fresh}
        slots={0}
        label={`${names[opponent]}'s cards at ${arms.name}`}
      />
      <div className="house__token" title={explanation || arms.name}>
        <Shield arms={arms} />
        <span className="house__name">{arms.name}</span>
        <span className="house__number" aria-hidden="true">
          {index + 1}
        </span>
        {claim && (
          <span className="house__pledge">
            {claim.by === viewer ? names[viewer] : names[opponent]}
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
        label={`${names[viewer]}'s cards at ${arms.name}`}
      />
      {playable !== null && (
        <button
          type="button"
          className="house__hit"
          onClick={() => onPlay(index)}
          aria-label={`Play to ${arms.name} (house ${index + 1})`}
        />
      )}
      {claim && (
        <span className="sr-only">{`${arms.name} pledged to ${names[claim.by]}. ${explanation}`}</span>
      )}
    </div>
  );
}
