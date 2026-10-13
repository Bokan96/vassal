import { CardBack } from './Card.tsx';

interface DeckProps {
  count: number;
  /**
   * layoutIds of cards that are about to be drawn: they sit on the deck for a moment and then fly to
   * the element (hand card or opponent card back) that takes over the same layoutId.
   */
  outgoing: string[];
  onOpen: () => void;
}

/** The draw pile. Clicking it shows the cards the viewer has not seen. */
export function Deck({ count, outgoing, onOpen }: DeckProps) {
  const layers = Math.min(3, Math.ceil(count / 14));
  return (
    <div className="deck" data-testid="deck">
      <button
        type="button"
        className="deck__button"
        onClick={onOpen}
        aria-label={`Draw pile, ${count} cards. Show the cards you have not seen`}
      >
        <span className="deck__stack">
          {count === 0 ? (
            <span className="deck__empty" />
          ) : (
            Array.from({ length: layers }, (_, i) => <CardBack key={i} className="deck__card" />)
          )}
          {outgoing.map((id) => (
            <CardBack key={id} layoutId={id} className="deck__card deck__ghost" />
          ))}
        </span>
        <span className="deck__count">{count}</span>
      </button>
    </div>
  );
}
