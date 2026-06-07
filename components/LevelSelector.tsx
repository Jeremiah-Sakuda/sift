import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from '@/lib/types';
import type { Level } from '@/lib/types';

/**
 * The intensity gradient control: Off · Tag · Verify · Block.
 * A single segmented control — the whole product is this one dial.
 */
export function LevelSelector({
  value,
  onChange,
  size = 'lg',
}: {
  value: Level;
  onChange: (level: Level) => void;
  size?: 'lg' | 'sm';
}) {
  return (
    <div>
      <div className={`seg seg-${size}`} role="group" aria-label="Sift intensity level">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`seg-btn${value === level ? ' active' : ''}`}
            data-level={level}
            aria-pressed={value === level}
            onClick={() => onChange(level)}
            title={LEVEL_DESCRIPTIONS[level]}
          >
            {LEVEL_LABELS[level]}
          </button>
        ))}
      </div>
      {size === 'lg' && <p className="seg-desc">{LEVEL_DESCRIPTIONS[value]}</p>}
    </div>
  );
}
