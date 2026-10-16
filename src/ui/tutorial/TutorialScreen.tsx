import { LayoutGroup, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getPlayerView, type CardId } from '../../engine/index.ts';
import { CombinationsTable } from '../components/CombinationsBoard.tsx';
import { Deck } from '../components/Deck.tsx';
import { Hand } from '../components/Hand.tsx';
import { House } from '../components/House.tsx';
import { RichText } from '../components/RichText.tsx';
import { Shield } from '../components/Shield.tsx';
import { HOUSES } from '../houses.ts';
import { SoundToggle } from '../components/SoundToggle.tsx';
import { TugOfWar } from '../components/TugOfWar.tsx';
import { useArrivals, type Arrival } from '../hooks/useArrivals.ts';
import { useI18n, type Role } from '../i18n.ts';
import { playSfx } from '../sound.ts';
import { TUTORIAL_HOUSES, type TutorialStep } from './script.ts';
import { useTutorial } from './useTutorial.ts';

interface TutorialScreenProps {
  /** Leave the tutorial: back to the menu, or straight into a real game. */
  onExit: (then: 'menu' | 'play') => void;
}

const ROLES: [Role, Role] = ['you', 'opponent'];
/** The tutorial's houses sit in the middle of a 9-house row (columns 3–7). */
const FIRST_COLUMN = 3;
/** Columns revealed at the end, showing the full 9-house board. */
const EXTRA_COLUMNS = [1, 2, 8, 9];
const CLAIM_SOUND_DELAY_MS = 260;

/** The coach's text, its buttons and (on small screens) the combinations it talks about. */
function Coach({
  step,
  index,
  total,
  canAdvance,
  onNext,
  onExit,
  compact,
}: {
  step: TutorialStep;
  index: number;
  total: number;
  canAdvance: boolean;
  onNext: () => void;
  onExit: TutorialScreenProps['onExit'];
  compact: boolean;
}) {
  const { lang, t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const rows = step.combos === 'all' ? undefined : step.combos;
  return (
    <section className="coach" aria-live="polite" data-testid="coach">
      <p className="coach__step">{t.stepOf(index + 1, total)}</p>
      <p className="coach__text">
        <RichText text={step.text[lang]} />
      </p>
      {compact && (step.combos || showAll) && (
        <div className="coach__combos" data-testid="coach-combos">
          <CombinationsTable only={showAll ? undefined : rows} highlight={rows ?? []} />
        </div>
      )}
      <div className="coach__actions">
        {compact && step.combos !== 'all' && !step.outro && (
          <button
            type="button"
            className="button button--quiet"
            aria-pressed={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {t.combinations}
          </button>
        )}
        {canAdvance && (
          <button type="button" className="button button--primary" autoFocus onClick={onNext}>
            {t.next}
          </button>
        )}
        {step.outro && (
          <>
            <button type="button" className="button button--primary" onClick={() => onExit('play')}>
              {t.playGame}
            </button>
            <button type="button" className="button" onClick={() => onExit('menu')}>
              {t.menu}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export function TutorialScreen({ onExit }: TutorialScreenProps) {
  const { t } = useI18n();
  const [openingDealt, setOpeningDealt] = useState(false);
  const tutorial = useTutorial(!openingDealt);
  const { state, step, stepIndex, total, lastEvents, lastPlayed, moves } = tutorial;
  const view = getPlayerView(state, 0);
  const [selected, setSelected] = useState<CardId | null>(null);

  // The opening hand is dealt one card at a time; afterwards drawn cards fly in.
  const arrivals: Arrival[] = !openingDealt
    ? view.hand.map((card) => ({ card, opening: true }))
    : lastEvents.flatMap((e) =>
        e.t === 'drew' && e.p === 0 && e.card !== null ? [{ card: e.card, opening: false }] : [],
      );
  const { pending, pendingCards, outgoing } = useArrivals(
    arrivals,
    openingDealt ? `move-${moves}` : 'opening',
    () => setOpeningDealt(true),
  );
  const expected = step.expect ?? null;
  const canPlay = openingDealt && pending.length === 0 && expected !== null;
  const selection = canPlay && selected === expected?.card ? selected : null;

  // Sounds: card placed, then a chime per claim, then the fanfare on victory.
  useEffect(() => {
    if (lastEvents.length === 0) return;
    playSfx('place');
    const timers = lastEvents
      .filter((e) => e.t === 'claimed')
      .map((e, i) =>
        setTimeout(
          () => playSfx(e.claim.by === 0 ? 'claimMine' : 'claimTheirs'),
          CLAIM_SOUND_DELAY_MS * (i + 1),
        ),
      );
    if (lastEvents.some((e) => e.t === 'won')) {
      timers.push(setTimeout(() => playSfx('win'), CLAIM_SOUND_DELAY_MS * 3));
    }
    return () => timers.forEach(clearTimeout);
  }, [lastEvents]);

  const playTo = (house: number) => {
    if (selection === null) return;
    tutorial.play({ type: 'play', card: selection, house });
    setSelected(null);
  };

  const won: [number, number] = [0, 0];
  for (const h of view.houses) if (h.claim) won[h.claim.by]++;
  const focus = step.focus ?? {};
  const highlight = step.combos === 'all' ? [] : (step.combos ?? []);
  const coach = (compact: boolean) => (
    <Coach
      key={`${stepIndex}-${compact}`}
      step={step}
      index={stepIndex}
      total={total}
      canAdvance={tutorial.canAdvance}
      onNext={tutorial.next}
      onExit={onExit}
      compact={compact}
    />
  );

  return (
    <div className="game tutorial">
      <header className="topbar">
        <button
          type="button"
          className="topbar__brand"
          onClick={() => onExit('menu')}
          aria-label={t.backToMenu}
        >
          Vassal
        </button>
        <p className="topbar__status" role="status">
          {t.tutorial}
        </p>
        <div className="topbar__actions">
          <SoundToggle />
          {!step.outro && (
            <button type="button" className="button button--quiet" onClick={() => onExit('menu')}>
              {t.skipTutorial}
            </button>
          )}
        </div>
      </header>

      <div className="game__layout">
        <LayoutGroup>
          <main className="table">
            <div className="seat seat--opponent">
              <span className="seat__name" data-seat={1}>
                {t.name('opponent')}
              </span>
            </div>
            <div className="arena">
              <div className={focus.tug ? 'is-spotlight with-arrow tug-spot' : 'tug-spot'}>
                <TugOfWar viewer={0} won={won} roles={ROLES} />
              </div>
              <div
                className={`board board--tutorial${focus.board ? ' is-spotlight' : ''}`}
                aria-label={t.nobleHouses}
              >
                {step.outro &&
                  EXTRA_COLUMNS.map((col, i) => (
                    <motion.div
                      key={`extra-${col}`}
                      className="house house--extra"
                      style={{ '--col': col } as React.CSSProperties}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + i * 0.18, duration: 0.5, ease: 'easeOut' }}
                      aria-hidden="true"
                    >
                      <div className="house__side house__side--opp" />
                      <div className="house__token">
                        <Shield arms={HOUSES[TUTORIAL_HOUSES + i]!} />
                      </div>
                      <div className="house__side house__side--mine" />
                    </motion.div>
                  ))}
                {view.houses.map((house, i) => (
                  <House
                    key={i}
                    index={i}
                    house={house}
                    config={view.config}
                    viewer={0}
                    roles={ROLES}
                    playable={selection !== null && expected?.house === i ? selection : null}
                    winning={!!state.result?.houses.includes(i)}
                    lastPlayed={lastPlayed}
                    onPlay={playTo}
                    spotlight={focus.houses?.includes(i) ?? false}
                    column={FIRST_COLUMN + i}
                  />
                ))}
              </div>
            </div>

            <div className="tutorial__coach-inline">{coach(true)}</div>

            <div className="tray">
              <div className="seat seat--viewer">
                <span className="seat__name" data-seat={0}>
                  {t.name('you')}
                </span>
              </div>
              <div className={focus.deck ? 'is-spotlight with-arrow deck-spot' : 'deck-spot'}>
                <Deck count={view.pileCount} outgoing={outgoing} onOpen={() => {}} />
              </div>
              <Hand
                cards={view.hand.filter((c) => !pendingCards.has(c))}
                selected={selection}
                enabled={canPlay}
                allowed={expected?.card ?? (openingDealt ? -1 : null)}
                spotlight={focus.card ?? null}
                onSelect={(c) => {
                  if (c !== null) playSfx('select');
                  setSelected(c);
                }}
              />
            </div>
          </main>
        </LayoutGroup>

        <aside className="tutorial__side">
          {coach(false)}
          <section
            className={`tutorial__combos${focus.combos ? ' is-spotlight' : ''}`}
            aria-label={t.combinations}
          >
            <h2 className="log__title">{t.combinations}</h2>
            <CombinationsTable highlight={highlight} />
          </section>
        </aside>
      </div>
    </div>
  );
}
