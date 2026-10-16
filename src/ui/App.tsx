import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { RulesDialog } from './components/RulesDialog.tsx';
import { I18nProvider } from './I18nProvider.tsx';
import {
  clearSavedSession,
  createSession,
  loadSavedSession,
  type NewGameOptions,
  type Session,
} from './hooks/useGame.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { markTutorialSeen, tutorialSeen } from './tutorial/seen.ts';
import { TutorialScreen } from './tutorial/TutorialScreen.tsx';

export function App() {
  const [saved, setSaved] = useState<Session | null>(loadSavedSession);
  const [session, setSession] = useState<Session | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [inTutorial, setInTutorial] = useState(false);
  const [seen, setSeen] = useState(tutorialSeen);

  const start = (opts: NewGameOptions) => {
    clearSavedSession();
    setSaved(null);
    setSession(createSession(opts));
  };

  const toMenu = () => {
    setSaved(loadSavedSession());
    setSession(null);
  };

  return (
    <I18nProvider>
      <MotionConfig reducedMotion="user">
        {inTutorial ? (
          <TutorialScreen
            onExit={(then) => {
              markTutorialSeen();
              setSeen(true);
              setInTutorial(false);
              // A first real game against the easiest computer opponent.
              if (then === 'play') {
                start({
                  mode: 'ai',
                  aiLevel: 'easy',
                  start: 'random',
                  config: { motive: true, wildcards: false },
                });
              }
            }}
          />
        ) : session ? (
          <GameScreen
            key={`${session.record.seed}-${session.aiSeed}`}
            session={session}
            onMenu={toMenu}
            onRules={() => setRulesOpen(true)}
            onNewGame={toMenu}
          />
        ) : (
          <StartScreen
            canResume={saved !== null}
            onStart={start}
            onResume={() => saved && setSession(saved)}
            onRules={() => setRulesOpen(true)}
            onTutorial={() => setInTutorial(true)}
            tutorialSeen={seen}
          />
        )}
        <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </MotionConfig>
    </I18nProvider>
  );
}
