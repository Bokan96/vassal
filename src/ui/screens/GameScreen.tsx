import { LayoutGroup } from 'motion/react';
import { useEffect, useState } from 'react';
import { formatCard, type CardId, type Player } from '../../engine/index.ts';
import { CardBack } from '../components/Card.tsx';
import { CombinationsTable } from '../components/CombinationsBoard.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Deck } from '../components/Deck.tsx';
import { GameLog } from '../components/GameLog.tsx';
import { Hand } from '../components/Hand.tsx';
import { House } from '../components/House.tsx';
import { UnseenCardsDialog } from '../components/UnseenCardsDialog.tsx';
import { useArrivals, type Arrival } from '../hooks/useArrivals.ts';
import { FAST, useGame, type Model, type Session } from '../hooks/useGame.ts';
import { describeEntry } from '../describe.ts';
import { useI18n } from '../i18n.ts';
import { playSfx } from '../sound.ts';
import { SoundToggle } from '../components/SoundToggle.tsx';
import { TugOfWar } from '../components/TugOfWar.tsx';

interface GameScreenProps {
  session: Session;
  onMenu: () => void;
  onRules: () => void;
  onNewGame: () => void;
}

/**
 * How long the mover keeps seeing the table before the hot-seat hand-off: long enough for the drawn
 * card to leave the deck, fly in and be shown off (useArrivals, Card).
 */
const HAND_OFF_DELAY_MS = 2300;
/** Let the final move and claims sink in before the result is announced. */
const RESULT_DELAY_MS = FAST ? 300 : 1600;
/** A claim's chime follows the sound of the card being placed. */
const CLAIM_SOUND_DELAY_MS = 260;

/**
 * Cards that should visibly travel from the deck right now: the opening hand the first time a player
 * sees it, or the card the viewer just drew.
 */
function arrivalsFor(model: Model, viewer: Player, handHidden: boolean, hand: CardId[]): Arrival[] {
  if (handHidden) return [];
  const { mode, record } = model.session;
  const moves = record.moves.length;
  const firstLook = mode === 'ai' ? moves === 0 : moves === (viewer === record.start ? 0 : 1);
  if (firstLook) return hand.map((card) => ({ card, opening: true }));
  return model.lastEvents.flatMap((e) =>
    e.t === 'drew' && e.p === viewer && e.card !== null ? [{ card: e.card, opening: false }] : [],
  );
}

export function GameScreen({ session, onMenu, onRules, onNewGame }: GameScreenProps) {
  // Nobody moves until the opening hand has been dealt (a resumed game skips the deal).
  const [openingDealt, setOpeningDealt] = useState(session.record.moves.length > 0);
  const game = useGame(session, !openingDealt);
  const { model, view, viewer, opponent, roles, thinking, humanToMove, play } = game;
  const { t } = useI18n();
  const { state } = model;
  const moveCount = model.session.record.moves.length;
  const [selected, setSelected] = useState<CardId | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [deckOpen, setDeckOpen] = useState(false);
  /** Phone sheets: the combinations and the game log. */
  const [sheet, setSheet] = useState<'combos' | 'log' | null>(null);

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
  const {
    pending,
    dealing,
    pendingCards: pendingMine,
    outgoing,
    drawn,
  } = useArrivals(arrivals, arrivalKey, () => setOpeningDealt(true));
  // Cards still flying in can't be played yet.
  const canPlay = humanToMove && pending.length === 0;

  // Sound for each move: the card landing, then a chime for every house it decided.
  const lastEvents = model.lastEvents;
  useEffect(() => {
    if (lastEvents.length === 0) return;
    playSfx('place');
    const timers = lastEvents
      .filter((e) => e.t === 'claimed')
      .map((e, i) =>
        setTimeout(
          () => playSfx(e.claim.by === viewer ? 'claimMine' : 'claimTheirs'),
          CLAIM_SOUND_DELAY_MS * (i + 1),
        ),
      );
    return () => timers.forEach(clearTimeout);
    // Only when a new move arrives, not when the perspective changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvents]);

  // The result is announced after a short pause.
  const [resultShown, setResultShown] = useState(false);
  const finished = state.result;
  useEffect(() => {
    if (!finished || resultShown) return;
    const timer = setTimeout(() => {
      setResultShown(true);
      const humanLost = session.mode === 'ai' && finished.winner !== session.human;
      playSfx(humanLost ? 'lose' : 'win');
    }, RESULT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [finished, resultShown, session]);

  // Drop a selection that is no longer in hand (after playing, or on a hot-seat hand-off).
  const selection = selected !== null && view.hand.includes(selected) && canPlay ? selected : null;

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
  if (result) status = t.winsTitle(roles[result.winner]);
  else if (model.awaitingPass) status = t.toPlay(roles[state.active]);
  else if (thinking) status = t.deliberating;
  else if (dealing) status = t.dealing;
  else if (canPlay && selection !== null) status = t.chooseHouseFor(formatCard(selection));
  else if (canPlay) status = t.chooseCard(session.mode === 'hotseat' ? roles[viewer] : null);
  else status = t.toPlay(roles[state.active]);

  const lastMoveText =
    model.lastPlayed && !result
      ? `${t.played(roles[state.active === 0 ? 1 : 0], model.lastPlayed.card, model.lastPlayed.house)}.`
      : '';
  const lastEntry = model.log.at(-1);

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="topbar__brand" onClick={onMenu} aria-label={t.backToMenu}>
          Vassal
        </button>
        <p className="topbar__status" role="status">
          {status}
        </p>
        <div className="topbar__actions">
          <SoundToggle />
          <button
            type="button"
            className="icon-button only-phone"
            aria-label={t.combinations}
            title={t.combinations}
            onClick={() => setSheet('combos')}
          >
            ★
          </button>
          <button
            type="button"
            className="icon-button only-phone"
            aria-label={t.chronicle}
            title={t.chronicle}
            onClick={() => setSheet('log')}
          >
            ☰
          </button>
          <button
            type="button"
            className="button button--quiet topbar__text-button"
            aria-label={t.rules}
            onClick={onRules}
          >
            <span className="label-full">{t.rules}</span>
            <span className="label-icon" aria-hidden="true">
              ?
            </span>
          </button>
          <button
            type="button"
            className="button button--quiet topbar__text-button"
            aria-label={t.newGame}
            onClick={onNewGame}
          >
            <span className="label-full">{t.newGame}</span>
            <span className="label-icon" aria-hidden="true">
              ⟲
            </span>
          </button>
        </div>
      </header>

      <div className="game__layout">
        <LayoutGroup>
          <main className="table">
            <div className="seat seat--opponent">
              <span className="seat__name" data-seat={opponent}>
                {t.name(roles[opponent])}
              </span>
            </div>

            <div className="arena">
              <TugOfWar viewer={viewer} won={won} roles={roles} />
              <div className="board" aria-label={t.nobleHouses}>
                {view.houses.map((house, i) => (
                  <House
                    key={i}
                    index={i}
                    house={house}
                    config={view.config}
                    viewer={viewer}
                    roles={roles}
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
                  {t.name(roles[viewer])}
                </span>
              </div>
              <Deck count={view.pileCount} outgoing={outgoing} onOpen={() => setDeckOpen(true)} />
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
                  enabled={canPlay}
                  drawn={drawn}
                  onSelect={(c) => {
                    if (c !== null) playSfx('select');
                    setSelected(c);
                  }}
                />
              )}
            </div>
          </main>
        </LayoutGroup>

        <aside className="game__side">
          <section className="game__combos" aria-label={t.combinations}>
            <h2 className="log__title">{t.combinations}</h2>
            <CombinationsTable />
          </section>
          <GameLog log={model.log} config={view.config} roles={roles} />
        </aside>
      </div>

      <Sheet open={sheet === 'combos'} onClose={() => setSheet(null)} title={t.combinations}>
        <CombinationsTable />
      </Sheet>
      <Sheet open={sheet === 'log'} onClose={() => setSheet(null)} title={t.chronicle}>
        <GameLog log={model.log} config={view.config} roles={roles} />
      </Sheet>

      <UnseenCardsDialog
        open={deckOpen && !handHidden}
        onClose={() => setDeckOpen(false)}
        view={view}
        opponent={roles[opponent]}
      />

      {handOffVisible && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pass-title">
          <div className="overlay__panel">
            <h2 id="pass-title">{t.passTo(roles[state.active])}</h2>
            {lastMoveText && <p>{lastMoveText}</p>}
            <p className="overlay__hint">{t.passHint}</p>
            <button
              type="button"
              className="button button--primary"
              autoFocus
              onClick={game.acknowledgePass}
            >
              {t.showHand(roles[state.active])}
            </button>
          </div>
        </div>
      )}

      {result && resultShown && showResult && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="overlay__panel">
            <h2 id="result-title">{status}</h2>
            {lastEntry && <p>{describeEntry(lastEntry, view.config, roles, t)}</p>}
            <div className="overlay__actions">
              <button
                type="button"
                className="button button--primary"
                autoFocus
                onClick={onNewGame}
              >
                {t.newGame}
              </button>
              <button type="button" className="button" onClick={() => setShowResult(false)}>
                {t.viewBoard}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
