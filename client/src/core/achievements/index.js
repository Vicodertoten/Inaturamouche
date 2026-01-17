// Core achievements module - centralized achievement logic
export { 
  ACHIEVEMENTS, 
  ACHIEVEMENT_CATEGORIES,
  REWARD_TYPES,
  AVAILABLE_BORDERS,
  AVAILABLE_TITLES,
  ICONIC_TAXON_MAP,
  TAXON_GROUP_FILTERS,
  checkNewAchievements, 
  evaluateMicroChallenges,
  checkEndOfGameAchievements,
} from './definitions';
export { checkStreakAchievements, checkPerfectGameAchievements } from './checker';
export {
  getDefaultRewardState,
  mergeRewardState,
  getRewardForAchievement,
  applyReward,
  applyAllRewards,
  calculatePermanentMultiplier,
  equipTitle,
  equipBorder,
  getTitleDetails,
  getBorderDetails,
  getAllTitlesWithStatus,
  getAllBordersWithStatus,
  formatRewardDescription,
} from './rewards';
