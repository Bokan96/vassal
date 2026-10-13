import { useState } from 'react';
import type { AiLevel } from '../../ai/bots.ts';
import type { Player } from '../../engine/index.ts';
import type { Mode, NewGameOptions } from '../hooks/useGame.ts';
import { HOUSES } from '../houses.ts';
import { Shield } from '../components/Shield.tsx';

interface StartScreenProps {
  canResume: boolean;
  onStart: (opts: NewGameOptions) => void;
  onResume: () => void;
  onRules: () => void;
}

const LEVELS: { id: AiLevel; label: string; hint: string }[] = [
  { id: 'easy', label: 'Squire', hint: 'Easy' },
  { id: 'normal', label: 'Knight', hint: 'Normal' },
  { id: 'hard', label: 'Chancellor', hint: 'Hard' },
];

export function StartScreen({ canResume, onStart, onResume, onRules }: StartScreenProps) {
  const [mode, setMode] = useState<Mode>('ai');
  const [aiLevel, setAiLevel] = useState<AiLevel>('normal');
  const [start, setStart] = useState<Player | 'random'>('random');
  // Optional rules from the rulebook; all off by default (standard game).
  const [noMotive, setNoMotive] = useState(false);
  const [noWildcards, setNoWildcards] = useState(false);

  const first = mode === 'ai' ? ['You', 'The computer'] : ['Player 1', 'Player 2'];

  return (
    <main className="start">
      <div className="start__crest" aria-hidden="true">
        {HOUSES.map((arms, i) => (
          <Shield key={i} arms={arms} />
        ))}
      </div>
      <h1 className="start__title">Vassal</h1>
      <p className="start__tagline">Win the allegiance of the nine noble houses.</p>

      <form
        className="start__form"
        onSubmit={(e) => {
          e.preventDefault();
          onStart({
            mode,
            aiLevel,
            start,
            config: { motive: !noMotive, wildcards: !noWildcards },
          });
        }}
      >
        <fieldset className="choice">
          <legend>Opponent</legend>
          <label className={`choice__option${mode === 'ai' ? ' is-checked' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'ai'}
              onChange={() => setMode('ai')}
            />
            <span>The computer</span>
          </label>
          <label className={`choice__option${mode === 'hotseat' ? ' is-checked' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'hotseat'}
              onChange={() => setMode('hotseat')}
            />
            <span>A friend on this device</span>
          </label>
        </fieldset>

        {mode === 'ai' && (
          <fieldset className="choice">
            <legend>Difficulty</legend>
            {LEVELS.map((l) => (
              <label
                key={l.id}
                className={`choice__option${aiLevel === l.id ? ' is-checked' : ''}`}
              >
                <input
                  type="radio"
                  name="level"
                  checked={aiLevel === l.id}
                  onChange={() => setAiLevel(l.id)}
                />
                <span>
                  {l.label} <small>{l.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <fieldset className="choice">
          <legend>First move</legend>
          {(['random', 0, 1] as const).map((s) => (
            <label key={s} className={`choice__option${start === s ? ' is-checked' : ''}`}>
              <input type="radio" name="start" checked={start === s} onChange={() => setStart(s)} />
              <span>{s === 'random' ? 'Random' : first[s]}</span>
            </label>
          ))}
        </fieldset>

        <details className="variants">
          <summary>Variants</summary>
          <label className="toggle">
            <input
              type="checkbox"
              checked={noMotive}
              onChange={(e) => setNoMotive(e.target.checked)}
            />
            <span>
              No Motive tier <small>Five tiers instead of six, as in Battle Line</small>
            </span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={noWildcards}
              onChange={(e) => setNoWildcards(e.target.checked)}
            />
            <span>
              No wildcards <small>Play without jokers, with 7-card hands</small>
            </span>
          </label>
        </details>

        <div className="start__actions">
          <button type="submit" className="button button--primary">
            Begin
          </button>
          {canResume && (
            <button type="button" className="button" onClick={onResume}>
              Resume game
            </button>
          )}
          <button type="button" className="button button--quiet" onClick={onRules}>
            How to play
          </button>
        </div>
      </form>
    </main>
  );
}
