import { LayoutGroup } from 'motion/react';
import { useEffect, useState } from 'react';
import { formatCard, WIN_HOUSES, type CardId } from '../../engine/index.ts';
import { CardBack } from '../components/Card.tsx';
import { GameLog } from '../components/GameLog.tsx';
import { Hand } from '../components/Hand.tsx';
import { House } from '../components/House.tsx';
import { useGame, type Session } from '../hooks/useGame.ts';
import { cardText } from '../describe.ts';
import { houseName } from '../houses.ts';

interface GameScreenProps {
  session: Session;
  onMenu: () => void;
  onRules: () => void;
  onNewGame: () => void;
}

export function GameScreen({ session, onMenu, onRules, onNewGame }: GameScreenProps) {
  const game = useGame(session);
  const { model, view, viewer, opponent, names, thinking, humanToMove, play } = game;
  const { state } = model;
  const [selected, setSelected] = useState<CardId | null>(null);
  const [showResult, setShowResult] = useState(true);

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

  const owned = (p: number) => view.houses.filter((h) => h.claim?.by === p).length;
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
      ? `${names[state.active === 0 ? 1 : 0]} played ${cardText(model.lastPlayed.card)} to ${houseName(model.lastPlayed.house)}.`
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
        <main className="table">
          <div className="seat seat--opponent">
            <span className="seat__name">{names[opponent]}</span>
            <span
              className="seat__score"
              aria-label={`${names[opponent]} holds ${owned(opponent)} houses`}
            >
              {owned(opponent)}/{WIN_HOUSES}
            </span>
            <span className="seat__hand" aria-label={`${view.oppHandCount} cards in hand`}>
              {Array.from({ length: view.oppHandCount }, (_, i) => (
                <CardBack key={i} small />
              ))}
            </span>
            <span className="seat__pile" title="Draw pile">
              <CardBack small /> {view.pileCount}
            </span>
          </div>

          <LayoutGroup>
            <div className="board" aria-label="Noble houses">
              {view.houses.map((house, i) => (
                <House
                  key={i}
                  index={i}
                  house={house}
                  config={view.config}
                  viewer={viewer}
                  names={names}
                  playable={selection !== null && house.sides[viewer].length < 3 ? selection : null}
                  winning={!!result?.houses.includes(i)}
                  lastPlayed={model.lastPlayed}
                  onPlay={playTo}
                />
              ))}
            </div>

            <div className="seat seat--viewer">
              <span className="seat__name">{names[viewer]}</span>
              <span
                className="seat__score"
                aria-label={`${names[viewer]} holds ${owned(viewer)} houses`}
              >
                {owned(viewer)}/{WIN_HOUSES}
              </span>
            </div>
            {model.awaitingPass ? (
              <div className="hand hand--hidden" aria-hidden="true">
                {view.hand.map((c) => (
                  <CardBack key={c} />
                ))}
              </div>
            ) : (
              <Hand
                cards={view.hand}
                selected={selection}
                enabled={humanToMove}
                onSelect={setSelected}
              />
            )}
          </LayoutGroup>
        </main>

        <GameLog log={model.log} viewer={viewer} />
      </div>

      {model.awaitingPass && (
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
