import { WIN_HOUSES, type Player } from '../../engine/index.ts';

interface TugOfWarProps {
  /** The player drawn at the bottom of the table; the opponent is at the top. */
  viewer: Player;
  /** Houses won by player 0 and player 1. */
  won: [number, number];
  names: [string, string];
}

/**
 * Vertical tug-of-war between the two players: the marker starts in the middle and moves one step
 * towards whichever player has won more houses for every house of difference.
 */
export function TugOfWar({ viewer, won, names }: TugOfWarProps) {
  const opponent: Player = viewer === 0 ? 1 : 0;
  const lead = won[viewer] - won[opponent];
  const steps = Math.min(Math.abs(lead), WIN_HOUSES);
  // Positive lead pulls the marker down towards the viewer; keep it inside the track's ends.
  const offset = (Math.sign(lead) * steps * 46) / WIN_HOUSES;
  const leader: Player | null = lead === 0 ? null : lead > 0 ? viewer : opponent;
  const text =
    leader === null
      ? `Level, ${won[viewer]} houses each`
      : `${names[leader]} ${names[leader] === 'You' ? 'lead' : 'leads'} by ${Math.abs(lead)} (${won[leader]} to ${won[leader === viewer ? opponent : viewer]})`;

  return (
    <div
      className="tug"
      role="meter"
      aria-label="Houses won"
      aria-valuemin={-WIN_HOUSES}
      aria-valuemax={WIN_HOUSES}
      aria-valuenow={lead}
      aria-valuetext={text}
      title={text}
    >
      <span className="tug__end" data-seat={opponent} />
      <span
        className="tug__track"
        style={
          {
            '--top': `var(--seat-${opponent})`,
            '--bottom': `var(--seat-${viewer})`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: 2 * WIN_HOUSES + 1 }, (_, i) => (
          <span
            key={i}
            className={`tug__tick${i === WIN_HOUSES ? ' tug__tick--middle' : ''}`}
            style={{ top: `${50 + ((i - WIN_HOUSES) * 46) / WIN_HOUSES}%` }}
          />
        ))}
        <span
          className="tug__marker"
          data-seat={leader ?? undefined}
          style={{ top: `${50 + offset}%` }}
        >
          {steps > 0 ? Math.abs(lead) : ''}
        </span>
      </span>
      <span className="tug__end" data-seat={viewer} />
    </div>
  );
}
