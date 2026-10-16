import { Fragment } from 'react';
import { parseCard } from '../../engine/index.ts';
import { useI18n } from '../i18n.ts';

const CARD = /(10|[2-9AJQK])([♠♣♥♦])/g;

/** Text in which card mentions such as "6♥" are drawn as small card icons. */
export function RichText({ text }: { text: string }) {
  const { t } = useI18n();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CARD)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [token, rank, suit] = m;
    parts.push(
      <span
        key={m.index}
        className={`inline-card${suit === '♥' || suit === '♦' ? ' is-red' : ''}`}
        role="img"
        aria-label={t.cardName(parseCard(token))}
      >
        {rank}
        {suit}
      </span>,
    );
    last = m.index + token.length;
  }
  parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
