import { useState } from 'react';
import type { AiLevel } from '../../ai/bots.ts';
import type { Player } from '../../engine/index.ts';
import type { Mode, NewGameOptions } from '../hooks/useGame.ts';
import { HOUSES } from '../houses.ts';
import { LanguageSwitch } from '../components/LanguageSwitch.tsx';
import { Shield } from '../components/Shield.tsx';
import { SoundToggle } from '../components/SoundToggle.tsx';
import { useI18n } from '../i18n.ts';

interface StartScreenProps {
  canResume: boolean;
  onStart: (opts: NewGameOptions) => void;
  onResume: () => void;
  onRules: () => void;
  onTutorial: () => void;
  /** Until the tutorial has been seen, it is suggested to first-time visitors. */
  tutorialSeen: boolean;
}

/** Difficulty slider positions, easiest first. */
const LEVELS = ['easy', 'normal', 'hard'] as const;

export function StartScreen({
  canResume,
  onStart,
  onResume,
  onRules,
  onTutorial,
  tutorialSeen,
}: StartScreenProps) {
  const [mode, setMode] = useState<Mode>('ai');
  const { t } = useI18n();
  const [aiLevel, setAiLevel] = useState<(typeof LEVELS)[number]>('normal');
  const [start, setStart] = useState<Player | 'random'>('random');
  // Optional rules from the rulebook. The game starts without wildcards by default.
  const [noMotive, setNoMotive] = useState(false);
  const [noWildcards, setNoWildcards] = useState(true);

  const first =
    mode === 'ai' ? [t.name('you'), t.computer] : [t.name('player1'), t.name('player2')];
  const level = t.levels[aiLevel];

  return (
    <main className="start">
      <div className="start__lang">
        <SoundToggle />
        <LanguageSwitch />
      </div>
      <div className="start__crest" aria-hidden="true">
        {HOUSES.map((arms, i) => (
          <Shield key={i} arms={arms} />
        ))}
      </div>
      <h1 className="start__title">Vassal</h1>
      <p className="start__tagline">{t.tagline}</p>

      {!tutorialSeen && (
        <p className="start__hint">
          <button type="button" className="button button--primary" onClick={onTutorial}>
            {t.tutorial}
          </button>
          <span>{t.tutorialHint}</span>
        </p>
      )}

      <form
        className="start__form"
        onSubmit={(e) => {
          e.preventDefault();
          onStart({
            mode,
            aiLevel: aiLevel satisfies AiLevel,
            start,
            config: { motive: !noMotive, wildcards: !noWildcards },
          });
        }}
      >
        <fieldset className="choice">
          <legend>{t.opponent}</legend>
          <label className={`choice__option${mode === 'ai' ? ' is-checked' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'ai'}
              onChange={() => setMode('ai')}
            />
            <span>{t.computer}</span>
          </label>
          <label className={`choice__option${mode === 'hotseat' ? ' is-checked' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'hotseat'}
              onChange={() => setMode('hotseat')}
            />
            <span>{t.friend}</span>
          </label>
        </fieldset>

        {mode === 'ai' && (
          <fieldset className="choice level">
            <legend>{t.difficulty}</legend>
            <p className="level__current" aria-hidden="true">
              {level.label} <small>{level.hint}</small>
            </p>
            <input
              type="range"
              className="level__range"
              min={0}
              max={LEVELS.length - 1}
              step={1}
              value={LEVELS.indexOf(aiLevel)}
              onChange={(e) => setAiLevel(LEVELS[Number(e.target.value)]!)}
              aria-label={t.difficulty}
              aria-valuetext={`${level.label}, ${level.hint}`}
            />
            <div className="level__ticks">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  tabIndex={-1}
                  className={`level__tick${l === aiLevel ? ' is-active' : ''}`}
                  onClick={() => setAiLevel(l)}
                >
                  {t.levels[l].label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="choice">
          <legend>{t.firstMove}</legend>
          {(['random', 0, 1] as const).map((s) => (
            <label key={s} className={`choice__option${start === s ? ' is-checked' : ''}`}>
              <input type="radio" name="start" checked={start === s} onChange={() => setStart(s)} />
              <span>{s === 'random' ? t.random : first[s]}</span>
            </label>
          ))}
        </fieldset>

        <details className="variants">
          <summary>{t.variants}</summary>
          <label className="toggle">
            <input
              type="checkbox"
              checked={noMotive}
              onChange={(e) => setNoMotive(e.target.checked)}
            />
            <span>
              {t.noMotive} <small>{t.noMotiveHint}</small>
            </span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={noWildcards}
              onChange={(e) => setNoWildcards(e.target.checked)}
            />
            <span>
              {t.noWildcards} <small>{t.noWildcardsHint}</small>
            </span>
          </label>
        </details>

        <div className="start__actions">
          <button type="submit" className="button button--primary">
            {t.begin}
          </button>
          {canResume && (
            <button type="button" className="button" onClick={onResume}>
              {t.resume}
            </button>
          )}
          <button type="button" className="button button--quiet" onClick={onRules}>
            {t.howToPlay}
          </button>
          {tutorialSeen && (
            <button type="button" className="button button--quiet" onClick={onTutorial}>
              {t.tutorial}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
