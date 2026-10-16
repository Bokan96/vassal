import type { RulesConfig } from '../../engine/index.ts';
import { describeEntry, type LogEntry } from '../describe.ts';
import { useI18n, type Role } from '../i18n.ts';

interface GameLogProps {
  log: LogEntry[];
  config: RulesConfig;
  roles: [Role, Role];
}

export function GameLog({ log, config, roles }: GameLogProps) {
  const { t } = useI18n();
  const entries = log.slice(-60).reverse();
  return (
    <section className="log" aria-label={t.gameLog}>
      <h2 className="log__title">{t.chronicle}</h2>
      {entries.length === 0 ? (
        <p className="log__empty">{t.logEmpty}</p>
      ) : (
        <ol className="log__list" aria-live="polite">
          {entries.map((e) => (
            <li key={e.id} className={`log__entry log__entry--${e.kind}`} data-seat={e.player}>
              {describeEntry(e, config, roles, t)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
