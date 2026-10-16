import { useId } from 'react';
import { DICTS, LANGS, useI18n, type Lang } from '../i18n.ts';

/** Serbian tricolour (red, blue, white). */
function SerbianFlag() {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="13.34" fill="#0c4076" />
      <rect width="30" height="6.67" fill="#c6363c" />
    </svg>
  );
}

/** Union Jack. */
function BritishFlag() {
  const id = useId();
  return (
    <svg viewBox="0 0 60 30" aria-hidden="true">
      <defs>
        <clipPath id={`${id}s`}>
          <rect width="60" height="30" />
        </clipPath>
        <clipPath id={`${id}t`}>
          <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}s)`}>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#${id}t)`}
          stroke="#c8102e"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  );
}

const FLAGS: Record<Lang, () => React.JSX.Element> = { sr: SerbianFlag, en: BritishFlag };

/** Flag buttons that switch the interface language. */
export function LanguageSwitch() {
  const { lang, t, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t.language}>
      {LANGS.map((l) => {
        const Flag = FLAGS[l];
        return (
          <button
            key={l}
            type="button"
            lang={l}
            className={`lang-switch__flag${l === lang ? ' is-active' : ''}`}
            aria-label={DICTS[l].langName}
            aria-pressed={l === lang}
            title={DICTS[l].langName}
            onClick={() => setLang(l)}
          >
            <Flag />
          </button>
        );
      })}
    </div>
  );
}
