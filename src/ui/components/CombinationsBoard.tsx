import { DEFAULT_CONFIG, makeStrength, Tier } from '../../engine/index.ts';
import { useI18n } from '../i18n.ts';
import { Stars } from './Stars.tsx';

/** Each combination with an example, strongest first. */
const TIERS: [Tier, string][] = [
  [Tier.Triumvirate, '7♠ 7♥ 7♦'],
  [Tier.Coup, '2♠ 3♠ 4♠'],
  [Tier.Scheme, '2♠ 3♣ 4♠'],
  [Tier.Plan, '2♠ 3♥ 4♣'],
  [Tier.Intent, '2♠ 4♠ 8♠'],
  [Tier.Motive, '2♠ 4♣ 8♠'],
  [Tier.Discord, '2♠ 4♥ 8♣'],
];

function Example({ cards }: { cards: string }) {
  return (
    <span className="example">
      {cards.split(' ').map((c) => (
        <span key={c} className={/[♥♦]/.test(c) ? 'is-red' : undefined}>
          {c}
        </span>
      ))}
    </span>
  );
}

interface CombinationsTableProps {
  /** Rows to emphasise. */
  highlight?: readonly Tier[];
  /** Show only these rows (strongest first). */
  only?: readonly Tier[];
}

/** The combinations, strongest first: name, star rating and an example. */
export function CombinationsTable({ highlight = [], only }: CombinationsTableProps) {
  const { t } = useI18n();
  const rows = only ? TIERS.filter(([tier]) => only.includes(tier)) : TIERS;
  return (
    <table className="tiers">
      <tbody>
        {rows.map(([tier, ex]) => (
          <tr key={tier} className={highlight.includes(tier) ? 'is-highlighted' : undefined}>
            <th scope="row">
              {t.tierNames[tier]}
              <br />
              <Stars strength={makeStrength(tier, 0)} config={DEFAULT_CONFIG} />
            </th>
            <td>
              <Example cards={ex} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
