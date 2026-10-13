import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import { RulesDialog } from './components/RulesDialog.tsx';
import {
  clearSavedSession,
  createSession,
  loadSavedSession,
  type NewGameOptions,
  type Session,
} from './hooks/useGame.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';

export function App() {
  const [saved, setSaved] = useState<Session | null>(loadSavedSession);
  const [session, setSession] = useState<Session | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

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
    <MotionConfig reducedMotion="user">
      {session ? (
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
        />
      )}
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </MotionConfig>
  );
}
