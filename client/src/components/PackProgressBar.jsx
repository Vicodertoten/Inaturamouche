import { useEffect, useState } from 'react';
import { getPackProgress } from '../utils/packProgress';
import { useLanguage } from '../context/LanguageContext';
import './PackProgressBar.css';

/**
 * PackProgressBar — shows mastery progress for a list-type pack.
 *
 * Displays a segmented bar (bronze/silver/gold/diamond) and
 * a "X% maîtrisé" label. Only renders for packs with taxa_ids.
 *
 * @param {{ taxaIds: number[], compact?: boolean }} props
 */
const PackProgressBar = ({ taxaIds, compact = false }) => {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!Array.isArray(taxaIds) || taxaIds.length === 0) return;
    let cancelled = false;
    getPackProgress(taxaIds).then((p) => {
      if (!cancelled) setProgress(p);
    });
    return () => { cancelled = true; };
  }, [taxaIds]);

  if (!progress || progress.total === 0) return null;

  const { total, seen, mastered, progressPercent, masteryBreakdown } = progress;

  // Segmented bar widths (as %)
  const diamondPct = (masteryBreakdown[4] / total) * 100;
  const goldPct = (masteryBreakdown[3] / total) * 100;
  const silverPct = (masteryBreakdown[2] / total) * 100;
  const bronzePct = (masteryBreakdown[1] / total) * 100;

  if (compact) {
    return (
      <div className="pack-progress pack-progress--compact" title={`${seen}/${total} ${t('pack_progress.seen', {}, 'vus')} · ${progressPercent}% ${t('pack_progress.mastered', {}, 'maîtrisé')}`}>
        <div className="pack-progress-bar">
          <div className="pack-progress-fill pack-progress-diamond" style={{ width: `${diamondPct}%` }} />
          <div className="pack-progress-fill pack-progress-gold" style={{ width: `${goldPct}%` }} />
          <div className="pack-progress-fill pack-progress-silver" style={{ width: `${silverPct}%` }} />
          <div className="pack-progress-fill pack-progress-bronze" style={{ width: `${bronzePct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pack-progress" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={t('pack_progress.aria', { percent: progressPercent }, `${progressPercent}% mastered`)}>
      <div className="pack-progress-header">
        <span className="pack-progress-label">
          {t('pack_progress.label', { seen, total }, `${seen}/${total}`)}
        </span>
        <span className="pack-progress-percent">{progressPercent}%</span>
      </div>
      <div className="pack-progress-bar">
        <div className="pack-progress-fill pack-progress-diamond" style={{ width: `${diamondPct}%` }} />
        <div className="pack-progress-fill pack-progress-gold" style={{ width: `${goldPct}%` }} />
        <div className="pack-progress-fill pack-progress-silver" style={{ width: `${silverPct}%` }} />
        <div className="pack-progress-fill pack-progress-bronze" style={{ width: `${bronzePct}%` }} />
      </div>
      <div className="pack-progress-legend">
        {mastered > 0 && <span className="pack-progress-stat">🏆 {mastered} {t('pack_progress.mastered', {}, 'maîtrisé')}</span>}
      </div>
    </div>
  );
};

export default PackProgressBar;
