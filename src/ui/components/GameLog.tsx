import type { Player } from '../../engine/index.ts';
import type { LogEntry } from '../describe.ts';

export function GameLog({ log, viewer }: { log: LogEntry[]; viewer: Player }) {
  const entries = log.slice(-60).reverse();
  return (
    <section className="log" aria-label="Game log">
      <h2 className="log__title">Chronicle</h2>
      {entries.length === 0 ? (
        <p className="log__empty">The houses await your first move.</p>
      ) : (
        <ol className="log__list" aria-live="polite">
          {entries.map((e) => (
            <li
              key={e.id}
              className={`log__entry log__entry--${e.kind} ${e.player === viewer ? 'is-viewer' : 'is-opponent'}`}
            >
              {e.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
