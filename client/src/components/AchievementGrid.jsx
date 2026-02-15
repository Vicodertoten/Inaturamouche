import { useMemo, useState, useCallback } from 'react';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  REWARD_TYPES,
  getRewardForAchievement,
  getTitleDetails,
  getBorderDetails,
} from '../core/achievements';
import { useLanguage } from '../context/LanguageContext.jsx';

const CATEGORY_META = [
  { key: ACHIEVEMENT_CATEGORIES.TAXONOMY, icon: '🔬', labelKey: 'achievements.categories.taxonomy' },
  { key: ACHIEVEMENT_CATEGORIES.COLLECTION, icon: '📚', labelKey: 'achievements.categories.collection' },
  { key: ACHIEVEMENT_CATEGORIES.SKILL, icon: '⚡', labelKey: 'achievements.categories.skill' },
  { key: ACHIEVEMENT_CATEGORIES.HABIT, icon: '📅', labelKey: 'achievements.categories.habit' },
];

const RewardBadge = ({ reward, t }) => {
  if (!reward) return null;

  const display = (() => {
    switch (reward.type) {
      case REWARD_TYPES.XP_FLAT:
        return { icon: '✨', label: `+${reward.value} XP` };
      case REWARD_TYPES.PERM_MULTIPLIER:
        return { icon: '📈', label: `+${Math.round(reward.value * 100)}%` };
      case REWARD_TYPES.TITLE: {
        const title = getTitleDetails(reward.value);
        return { icon: '🏷️', label: t('rewards.title', { name: title?.value || t(title?.nameKey) || reward.value }) };
      }
      case REWARD_TYPES.BORDER: {
        const border = getBorderDetails(reward.value);
        return { icon: '🖼️', label: t('rewards.border', { name: t(border?.nameKey) || reward.value }) };
      }
      default:
        return null;
    }
  })();

  if (!display) return null;

  return (
    <span className={`reward-badge reward-badge-${reward.type.toLowerCase()}`}>
      <span className="reward-badge-icon">{display.icon}</span>
      <span className="reward-badge-label">{display.label}</span>
    </span>
  );
};

const AchievementCard = ({ achievement, unlocked, reward, t }) => (
  <li
    className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
    aria-label={achievement.titleKey ? t(achievement.titleKey) : achievement.id}
  >
    <div className="achievement-icon" aria-hidden="true">{achievement.icon}</div>
    <div className="achievement-details">
      <h4 className="achievement-title">
        {achievement.titleKey ? t(achievement.titleKey) : achievement.id}
      </h4>
      {achievement.descriptionKey && (
        <p className="achievement-description">{t(achievement.descriptionKey)}</p>
      )}
      {reward && <RewardBadge reward={reward} t={t} />}
    </div>
  </li>
);

/**
 * Grille d'achievements regroupés par catégorie, avec sections dépliables.
 */
export default function AchievementGrid({ unlockedAchievements = [] }) {
  const { t } = useLanguage();
  const [openCategories, setOpenCategories] = useState({});

  const toggleCategory = useCallback((cat) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const byCategory = useMemo(() => {
    const cats = {};
    CATEGORY_META.forEach(({ key }) => { cats[key] = []; });
    Object.entries(ACHIEVEMENTS).forEach(([id, a]) => {
      const cat = a.category || ACHIEVEMENT_CATEGORIES.SKILL;
      if (cats[cat]) cats[cat].push({ id, ...a });
    });
    return cats;
  }, []);

  return (
    <div className="profile-section fade-in">
      <div className="achievements-header">
        <h3>
          {t('profile.achievements_title', {
            count: unlockedAchievements.filter(id => ACHIEVEMENTS[id]).length,
            total: Object.keys(ACHIEVEMENTS).length,
          })}
        </h3>
      </div>

      {CATEGORY_META.map(({ key, icon, labelKey }) => {
        const items = byCategory[key];
        if (!items || items.length === 0) return null;
        const isOpen = !!openCategories[key];

        return (
          <div key={key} className="achievement-category">
            <button
              type="button"
              className="category-header"
              onClick={() => toggleCategory(key)}
              aria-expanded={isOpen}
            >
              <span className="category-title">
                <span className="category-icon">{icon}</span>
                {t(labelKey)}
              </span>
              <span className="category-chevron" aria-hidden="true">
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen && (
              <ul className="achievements-grid">
                {items.map((achievement) => {
                  const unlocked = unlockedAchievements.includes(achievement.id);
                  const reward = getRewardForAchievement(achievement.id);
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      unlocked={unlocked}
                      reward={reward}
                      t={t}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
