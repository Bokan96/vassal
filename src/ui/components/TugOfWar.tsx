import { WIN_HOUSES, type Player } from '../../engine/index.ts';
import { useI18n, type Role } from '../i18n.ts';

interface TugOfWarProps {
  /** The player drawn at the bottom of the table (on the right in portrait); the opponent faces them. */
  viewer: Player;
  /** Houses won by player 0 and player 1. */
  won: [number, number];
  roles: [Role, Role];
}

/** Distance from the middle to the last step, as a percentage of the track length. */
const REACH = 46;

/**
 * Tug-of-war between the two players: the marker starts in the middle and moves one step towards
 * whichever player has won more houses for every house of difference. Vertical beside the board on
 * wide screens (opponent on top); horizontal above it in portrait (opponent left, viewer right).
 */
export function TugOfWar({ viewer, won, roles }: TugOfWarProps) {
  const { t } = useI18n();
  const opponent: Player = viewer === 0 ? 1 : 0;
  const lead = won[viewer] - won[opponent];
  const steps = Math.min(Math.abs(lead), WIN_HOUSES);
  // Positive lead pulls the marker towards the viewer's end of the track.
  const offset = (Math.sign(lead) * steps * REACH) / WIN_HOUSES;
  const leader: Player | null = lead === 0 ? null : lead > 0 ? viewer : opponent;
  const text =
    leader === null
      ? t.tugLevel(won[viewer])
      : t.tugLead(
          roles[leader],
          Math.abs(lead),
          won[leader],
          won[leader === viewer ? opponent : viewer],
        );
  const at = (p: number) => ({ '--p': `${p}%` }) as React.CSSProperties;

  return (
    <div
      className="tug"
      role="meter"
      aria-label={t.housesWon}
      aria-valuemin={-WIN_HOUSES}
      aria-valuemax={WIN_HOUSES}
      aria-valuenow={lead}
      aria-valuetext={text}
      title={text}
    >
      <span className="tug__side tug__side--opponent" data-seat={opponent}>
        <span className="tug__name">{t.name(roles[opponent])}</span>
        <span className="tug__end" />
      </span>
      <span
        className="tug__track"
        style={
          {
            '--from': `var(--seat-${opponent})`,
            '--to': `var(--seat-${viewer})`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: 2 * WIN_HOUSES + 1 }, (_, i) => (
          <span
            key={i}
            className={`tug__tick${i === WIN_HOUSES ? ' tug__tick--middle' : ''}`}
            style={at(((i - WIN_HOUSES) * REACH) / WIN_HOUSES)}
          />
        ))}
        <span className="tug__marker" data-seat={leader ?? undefined} style={at(offset)}>
          {steps > 0 ? Math.abs(lead) : ''}
        </span>
      </span>
      <span className="tug__side tug__side--viewer" data-seat={viewer}>
        <span className="tug__end" />
        <span className="tug__name">{t.name(roles[viewer])}</span>
      </span>
    </div>
  );
}
