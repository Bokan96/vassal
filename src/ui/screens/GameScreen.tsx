import { LayoutGroup } from 'motion/react';
import { useEffect, useState } from 'react';
import { formatCard, type CardId, type Player } from '../../engine/index.ts';
import { CardBack } from '../components/Card.tsx';
import { Deck } from '../components/Deck.tsx';
import { GameLog } from '../components/GameLog.tsx';
import { Hand } from '../components/Hand.tsx';
import { House } from '../components/House.tsx';
import { UnseenCardsDialog } from '../components/UnseenCardsDialog.tsx';
import { useGame, type Model, type Session } from '../hooks/useGame.ts';
import { cardText } from '../describe.ts';
import { houseLabel } from '../houses.ts';
import { TugOfWar } from '../components/TugOfWar.tsx';

interface GameScreenProps {
  session: Session;
  onMenu: () => void;
  onRules: () => void;
  onNewGame: () => void;
}

/** How long the mover keeps seeing the table (and their new card) before the hot-seat hand-off. */
const HAND_OFF_DELAY_MS = 1100;
/** Pause before each card leaves the deck; the opening deal is staggered by the same amount. */
const DEAL_STEP_MS = 80;

/** One of the viewer's cards on its way from the deck to their hand. */
type Arrival = { card: CardId };

const arrivalLayoutId = (a: Arrival): string => `card-${a.card}`;

/**
 * Cards that should visibly travel from the deck right now: the opening hand the first time a player
 * sees it, or the card the viewer just drew.
 */
function arrivalsFor(model: Model, viewer: Player, handHidden: boolean, hand: CardId[]): Arrival[] {
  if (handHidden) return [];
  const { mode, record } = model.session;
  const moves = record.moves.length;
  const firstLook = mode === 'ai' ? moves === 0 : moves === (viewer === record.start ? 0 : 1);
  if (firstLook) return hand.map((card) => ({ card }));
  return model.lastEvents.flatMap((e) =>
    e.t === 'drew' && e.p === viewer && e.card !== null ? [{ card: e.card }] : [],
  );
}

export function GameScreen({ session, onMenu, onRules, onNewGame }: GameScreenProps) {
  const game = useGame(session);
  const { model, view, viewer, opponent, names, thinking, humanToMove, play } = game;
  const { state } = model;
  const moveCount = model.session.record.moves.length;
  const [selected, setSelected] = useState<CardId | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [deckOpen, setDeckOpen] = useState(false);

  // Hot-seat hand-off: the mover first watches their move and draw land, then the screen is covered.
  const [handOffShownAt, setHandOffShownAt] = useState(-1);
  const moverStillLooking = model.awaitingPass && viewer !== state.active;
  const handOffVisible = model.awaitingPass && (!moverStillLooking || handOffShownAt === moveCount);
  useEffect(() => {
    if (!moverStillLooking || handOffShownAt === moveCount) return;
    const t = setTimeout(() => setHandOffShownAt(moveCount), HAND_OFF_DELAY_MS);
    return () => clearTimeout(t);
  }, [moverStillLooking, handOffShownAt, moveCount]);
  const handHidden = handOffVisible;

  // Cards travelling from the deck are revealed one at a time.
  const arrivals = arrivalsFor(model, viewer, handHidden, view.hand);
  const arrivalKey = `${viewer}:${moveCount}:${handHidden}`;
  const [reveal, setReveal] = useState({ key: '', count: 0 });
  const revealed = reveal.key === arrivalKey ? reveal.count : 0;
  const pending = arrivals.slice(revealed);
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setTimeout(() => setReveal({ key: arrivalKey, count: revealed + 1 }), DEAL_STEP_MS);
    return () => clearTimeout(t);
  }, [arrivalKey, revealed, pending.length]);
  const pendingMine = new Set(pending.map((a) => a.card));

  // Drop a selection that is no longer in hand (after playing, or on a hot-seat hand-off).
  const selection =
    selected !== null && view.hand.includes(selected) && humanToMove ? selected : null;

  const playTo = (house: number) => {
    if (selection === null) return;
    const side = view.houses[house]!.sides[viewer];
    if (side.length >= 3) return;
    play({ type: 'play', card: selection, house });
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('dialog, input, select')) return;
      if (e.key === 'Escape') setSelected(null);
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 9 && selection !== null) {
        e.preventDefault();
        playTo(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const won: [number, number] = [0, 0];
  for (const h of view.houses) if (h.claim) won[h.claim.by]++;
  const result = state.result;

  let status: string;
  if (result)
    status = `${names[result.winner]} ${names[result.winner] === 'You' ? 'win' : 'wins'}!`;
  else if (model.awaitingPass) status = `${names[state.active]} to play`;
  else if (thinking) status = 'The opponent is deliberating…';
  else if (humanToMove && selection !== null)
    status = `Choose a house for ${formatCard(selection)} (keys 1–9)`;
  else if (humanToMove)
    status =
      session.mode === 'hotseat' ? `${names[viewer]}: choose a card` : 'Choose a card to play';
  else status = `${names[state.active]} to play`;

  const lastMoveText =
    model.lastPlayed && !result
      ? `${names[state.active === 0 ? 1 : 0]} played ${cardText(model.lastPlayed.card)} to ${houseLabel(model.lastPlayed.house)}.`
      : '';

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="topbar__brand" onClick={onMenu} aria-label="Back to menu">
          Vassal
        </button>
        <p className="topbar__status" role="status">
          {status}
        </p>
        <div className="topbar__actions">
          <button type="button" className="button button--quiet" onClick={onRules}>
            Rules
          </button>
          <button type="button" className="button button--quiet" onClick={onNewGame}>
            New game
          </button>
        </div>
      </header>

      <div className="game__layout">
        <LayoutGroup>
          <main className="table">
            <div className="seat seat--opponent">
              <span className="seat__name" data-seat={opponent}>
                {names[opponent]}
              </span>
            </div>

            <div className="arena">
              <TugOfWar viewer={viewer} won={won} names={names} />
              <div className="board" aria-label="Noble houses">
                {view.houses.map((house, i) => (
                  <House
                    key={i}
                    index={i}
                    house={house}
                    config={view.config}
                    viewer={viewer}
                    names={names}
                    playable={
                      selection !== null && house.sides[viewer].length < 3 ? selection : null
                    }
                    winning={!!result?.houses.includes(i)}
                    lastPlayed={model.lastPlayed}
                    onPlay={playTo}
                  />
                ))}
              </div>
            </div>

            <div className="tray">
              <div className="seat seat--viewer">
                <span className="seat__name" data-seat={viewer}>
                  {names[viewer]}
                </span>
              </div>
              <Deck
                count={view.pileCount}
                outgoing={pending.map(arrivalLayoutId)}
                onOpen={() => setDeckOpen(true)}
              />
              {handHidden ? (
                <div className="hand hand--hidden" aria-hidden="true">
                  {view.hand.map((c) => (
                    <CardBack key={c} />
                  ))}
                </div>
              ) : (
                <Hand
                  cards={view.hand.filter((c) => !pendingMine.has(c))}
                  selected={selection}
                  enabled={humanToMove}
                  onSelect={setSelected}
                />
              )}
            </div>
          </main>
        </LayoutGroup>

        <GameLog log={model.log} />
      </div>

      <UnseenCardsDialog
        open={deckOpen && !handHidden}
        onClose={() => setDeckOpen(false)}
        view={view}
        opponentName={names[opponent]}
      />

      {handOffVisible && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pass-title">
          <div className="overlay__panel">
            <h2 id="pass-title">Pass the device to {names[state.active]}</h2>
            {lastMoveText && <p>{lastMoveText}</p>}
            <p className="overlay__hint">The other player should look away while you play.</p>
            <button
              type="button"
              className="button button--primary"
              autoFocus
              onClick={game.acknowledgePass}
            >
              I am {names[state.active]}: show my hand
            </button>
          </div>
        </div>
      )}

      {result && showResult && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="overlay__panel">
            <h2 id="result-title">{status}</h2>
            <p>{model.log.at(-1)?.text}</p>
            <div className="overlay__actions">
              <button
                type="button"
                className="button button--primary"
                autoFocus
                onClick={onNewGame}
              >
                New game
              </button>
              <button type="button" className="button" onClick={() => setShowResult(false)}>
                View the board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
