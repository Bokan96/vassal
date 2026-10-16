import { tierOf, type RulesConfig, type Strength } from '../../engine/index.ts';
import { starRating } from '../describe.ts';
import { useI18n } from '../i18n.ts';

/** An alliance's level as filled and empty stars; the level's name is in the tooltip. */
export function Stars({ strength, config }: { strength: Strength; config: RulesConfig }) {
  const { t } = useI18n();
  const { filled, slots } = starRating(strength, config);
  const name = t.tierNames[tierOf(strength)];
  return (
    <span
      className="stars"
      role="img"
      aria-label={`${name}, ${t.starsOf(filled, slots)}`}
      title={name}
    >
      {Array.from({ length: slots }, (_, i) => (
        <span key={i} className={i < filled ? 'stars__on' : 'stars__off'} aria-hidden="true">
          {i < filled ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
