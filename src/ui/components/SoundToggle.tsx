import { useI18n } from '../i18n.ts';
import { setMuted, useMuted } from '../sound.ts';

/** Speaker button that mutes or unmutes the sound effects. */
export function SoundToggle() {
  const { t } = useI18n();
  const muted = useMuted();
  return (
    <button
      type="button"
      className="icon-button sound-toggle"
      aria-label={t.sound}
      aria-pressed={!muted}
      title={muted ? t.soundOff : t.soundOn}
      onClick={() => setMuted(!muted)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path
            d="M16 9l5 6M21 9l-5 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
