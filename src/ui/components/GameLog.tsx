import type { LogEntry } from '../describe.ts';

export function GameLog({ log }: { log: LogEntry[] }) {
  const entries = log.slice(-60).reverse();
  return (
    <section className="log" aria-label="Game log">
      <h2 className="log__title">Chronicle</h2>
      {entries.length === 0 ? (
        <p className="log__empty">The houses await your first move.</p>
      ) : (
        <ol className="log__list" aria-live="polite">
          {entries.map((e) => (
            <li key={e.id} className={`log__entry log__entry--${e.kind}`} data-seat={e.player}>
              {e.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
