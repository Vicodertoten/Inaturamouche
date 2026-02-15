import { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getTitleDetails, getBorderDetails } from '../core/achievements';
import { getLevelFromXp, getXpForLevel } from '../utils/scoring';

const ProfileHero = ({ profile, onEdit }) => {
  const { t, formatNumber } = useLanguage();

  const displayName = useMemo(
    () => profile?.name || profile?.username || t('profile.title'),
    [profile?.name, profile?.username, t]
  );

  const avatarDisplay = useMemo(() => {
    if (profile?.avatar?.type === 'emoji') return { type: 'emoji', value: profile.avatar.value };
    if (profile?.avatar?.type === 'image') return { type: 'image', value: profile.avatar.value };
    return { type: 'letter', value: displayName ? displayName.charAt(0).toUpperCase() : 'E' };
  }, [profile?.avatar, displayName]);

  const levelInfo = useMemo(() => {
    const level = getLevelFromXp(profile?.xp);
    const xpForCurrentLevel = getXpForLevel(level);
    const xpForNextLevel = getXpForLevel(level + 1);
    const xpProgress = (profile?.xp || 0) - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = xpNeededForLevel > 0 ? (xpProgress / xpNeededForLevel) * 100 : 100;
    return { level, xpProgress, xpNeededForLevel, progressPercentage };
  }, [profile?.xp]);

  const equippedTitle = profile.rewards?.equippedTitle || 'default';
  const equippedBorder = profile.rewards?.equippedBorder || 'default';
  const titleDetails = getTitleDetails(equippedTitle);
  const borderDetails = getBorderDetails(equippedBorder);
  const borderCss = borderDetails?.css || '';

  return (
    <div className="profile-hero sticky-hero tutorial-profile-hero">
      <button
        type="button"
        className="profile-edit-btn"
        onClick={onEdit}
        aria-label={t('profile.edit_profile')}
        title={t('profile.edit_profile')}
      >
        ✏️
      </button>

      <div className="hero-content">
        <div className={`avatar-ring ${borderCss}`} aria-label={t('profile.title')}>
          {avatarDisplay.type === 'emoji' && <span className="avatar-emoji">{avatarDisplay.value}</span>}
          {avatarDisplay.type === 'image' && <img src={avatarDisplay.value} alt="Avatar" className="avatar-image" />}
          {avatarDisplay.type === 'letter' && <span className="avatar-letter">{avatarDisplay.value}</span>}
        </div>

        <h2 className="player-name">{displayName}</h2>

        {titleDetails && equippedTitle !== 'default' && (
          <p className="equipped-title">{titleDetails.value || t(titleDetails.nameKey)}</p>
        )}

        <div className="level-chip">
          <span className="level-label">{t('profile.level', { level: levelInfo.level })}</span>
          <span className="level-number">#{levelInfo.level}</span>
        </div>

        <div className="hero-streaks">
          <span className="hero-streak-chip" title={t('profile.daily_streak', {}, 'Streak quotidienne')}>
            📅 {profile.stats.dailyStreak || 0}
          </span>
          <span className="hero-streak-chip" title={t('profile.best_streak', {}, 'Meilleur streak')}>
            🔥 {profile.stats.longestStreak || 0}
          </span>
        </div>

        <div className="hero-progress">
          <div
            className="xp-bar-container xp-bar-hero"
            aria-label={t('profile.xp_counter', {
              current: formatNumber(levelInfo.xpProgress),
              total: formatNumber(levelInfo.xpNeededForLevel),
            })}
          >
            <div className="xp-bar" style={{ width: `${levelInfo.progressPercentage}%` }} />
            <div className="xp-shine" />
          </div>
          <div className="xp-label hero-xp-label">
            <span>
              {t('profile.xp_counter', {
                current: formatNumber(levelInfo.xpProgress),
                total: formatNumber(levelInfo.xpNeededForLevel),
              })}
            </span>
            <span className="xp-total">XP: {formatNumber(profile.xp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHero;
