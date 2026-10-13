import { useEffect, useRef } from 'react';

const TIERS: [string, string, string][] = [
  ['Coup', 'In sequence and of the same suit', '2♠ 3♠ 4♠'],
  ['Scheme', 'In sequence and of the same colour', '2♠ 3♣ 4♠'],
  ['Plan', 'In sequence', '2♠ 3♥ 4♣'],
  ['Intent', 'Of the same suit', '2♠ 4♠ 8♠'],
  ['Motive', 'Of the same colour', '2♠ 4♣ 8♠'],
  ['Discord', 'Anything else', '2♠ 4♥ 8♣'],
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

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog rules" onClose={onClose} aria-labelledby="rules-title">
      <header className="dialog__header">
        <h2 id="rules-title">How to play</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close rules">
          ✕
        </button>
      </header>
      <div className="rules__body">
        <p>
          Win the allegiance of <strong>any 5</strong> noble houses, or <strong>3 adjacent</strong>{' '}
          ones, by assigning people of influence (cards) to them.
        </p>
        <h3>Your turn</h3>
        <ol>
          <li>Play a card from your hand to a house on your side (at most 3 per house).</li>
          <li>Draw a card while the draw pile lasts.</li>
          <li>Houses are evaluated and claimed automatically.</li>
        </ol>
        <h3>Alliances, strongest first</h3>
        <table className="tiers">
          <tbody>
            {TIERS.map(([name, rule, ex]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{rule}</td>
                <td>
                  <Example cards={ex} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Within a tier the higher combined rank wins (A = 1, J = 11, Q = 12, K = 13). Aces are low
          only: Q K A is not a sequence. If still tied, whoever completed their alliance first wins.
        </p>
        <h3>Claiming houses</h3>
        <ul>
          <li>When both alliances at a house are complete, the stronger one claims it.</li>
          <li>
            At the end of your turn you also claim any house where your complete alliance cannot be
            beaten by any cards not yet on the table. This proof happens automatically.
          </li>
          <li>Cards can still be played to a claimed house, but it no longer changes hands.</li>
        </ul>
        <h3>Jokers</h3>
        <p>
          Each player starts with one joker. It mirrors whatever card makes its alliance strongest,
          even a card already in play.
        </p>
      </div>
    </dialog>
  );
}
