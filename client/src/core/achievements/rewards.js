/**
 * rewards.js - Système de gestion des récompenses avancées
 * 
 * Gère les différents types de récompenses des succès :
 * - XP_FLAT: XP direct
 * - PERM_MULTIPLIER: Bonus XP permanent par catégorie
 * - TITLE: Titre déblocable
 * - BORDER: Bordure avatar déblocable
 */

import { ACHIEVEMENTS, REWARD_TYPES, AVAILABLE_BORDERS, AVAILABLE_TITLES, TAXON_GROUP_FILTERS } from './definitions';

/**
 * @typedef {Object} MultiplierBonus
 * @property {string} achievementId - ID du succès source
 * @property {number} value - Valeur du multiplicateur (ex: 0.02 = +2%)
 * @property {string} filter - Filtre taxonomique ('Aves', 'Plantae', 'all', etc.)
 */

/**
 * @typedef {Object} RewardState
 * @property {Array<string>} unlockedTitles - IDs des titres débloqués
 * @property {string|null} equippedTitle - ID du titre équipé
 * @property {Array<string>} unlockedBorders - IDs des bordures débloquées
 * @property {string|null} equippedBorder - ID de la bordure équipée
 * @property {Array<MultiplierBonus>} permanentMultipliers - Multiplicateurs permanents actifs
 */

/**
 * Génère l'état initial des récompenses
 * @returns {RewardState}
 */
export const getDefaultRewardState = () => ({
  unlockedTitles: ['default'],
  equippedTitle: 'default',
  unlockedBorders: ['default'],
  equippedBorder: 'default',
  permanentMultipliers: [],
});

/**
 * Fusionne l'état des récompenses avec les valeurs par défaut
 * @param {Partial<RewardState>} saved - État sauvegardé
 * @returns {RewardState}
 */
export const mergeRewardState = (saved = {}) => {
  const defaults = getDefaultRewardState();
  return {
    unlockedTitles: Array.isArray(saved.unlockedTitles) 
      ? [...new Set([...defaults.unlockedTitles, ...saved.unlockedTitles])]
      : defaults.unlockedTitles,
    equippedTitle: saved.equippedTitle || defaults.equippedTitle,
    unlockedBorders: Array.isArray(saved.unlockedBorders)
      ? [...new Set([...defaults.unlockedBorders, ...saved.unlockedBorders])]
      : defaults.unlockedBorders,
    equippedBorder: saved.equippedBorder || defaults.equippedBorder,
    permanentMultipliers: Array.isArray(saved.permanentMultipliers)
      ? saved.permanentMultipliers
      : defaults.permanentMultipliers,
  };
};

/**
 * Extrait la récompense d'un succès par son ID
 * @param {string} achievementId - ID du succès
 * @returns {Object|null} Objet récompense ou null
 */
export const getRewardForAchievement = (achievementId) => {
  const achievement = ACHIEVEMENTS[achievementId];
  return achievement?.reward || null;
};

/**
 * Applique une récompense au profil joueur
 * @param {Object} profile - Profil joueur actuel
 * @param {string} achievementId - ID du succès débloqué
 * @returns {{profile: Object, xpGained: number, titleUnlocked: string|null, borderUnlocked: string|null}}
 */
export const applyReward = (profile, achievementId) => {
  const reward = getRewardForAchievement(achievementId);
  if (!reward) {
    return { profile, xpGained: 0, titleUnlocked: null, borderUnlocked: null };
  }

  const updatedProfile = { ...profile };
  let xpGained = 0;
  let titleUnlocked = null;
  let borderUnlocked = null;

  // Initialiser rewards si nécessaire
  if (!updatedProfile.rewards) {
    updatedProfile.rewards = getDefaultRewardState();
  }

  switch (reward.type) {
    case REWARD_TYPES.XP_FLAT:
      xpGained = reward.value || 0;
      updatedProfile.xp = (updatedProfile.xp || 0) + xpGained;
      break;

    case REWARD_TYPES.PERM_MULTIPLIER:
      // Ajouter le multiplicateur permanent
      const newMultiplier = {
        achievementId,
        value: reward.value,
        filter: reward.filter || 'all',
      };
      // Éviter les doublons
      const existingIndex = updatedProfile.rewards.permanentMultipliers.findIndex(
        m => m.achievementId === achievementId
      );
      if (existingIndex === -1) {
        updatedProfile.rewards.permanentMultipliers.push(newMultiplier);
      }
      break;

    case REWARD_TYPES.TITLE:
      // Débloquer le titre
      const titleId = reward.value;
      if (titleId && !updatedProfile.rewards.unlockedTitles.includes(titleId)) {
        updatedProfile.rewards.unlockedTitles.push(titleId);
        titleUnlocked = titleId;
      }
      break;

    case REWARD_TYPES.BORDER:
      // Débloquer la bordure
      const borderId = reward.value;
      if (borderId && !updatedProfile.rewards.unlockedBorders.includes(borderId)) {
        updatedProfile.rewards.unlockedBorders.push(borderId);
        borderUnlocked = borderId;
      }
      break;

    default:
      console.warn(`Unknown reward type: ${reward.type}`);
  }

  return { profile: updatedProfile, xpGained, titleUnlocked, borderUnlocked };
};

/**
 * Applique toutes les récompenses pour une liste de succès
 * @param {Object} profile - Profil joueur
 * @param {Array<string>} achievementIds - IDs des succès débloqués
 * @returns {{profile: Object, totalXP: number, titlesUnlocked: Array<string>, bordersUnlocked: Array<string>}}
 */
export const applyAllRewards = (profile, achievementIds = []) => {
  let updatedProfile = { ...profile };
  let totalXP = 0;
  const titlesUnlocked = [];
  const bordersUnlocked = [];

  for (const achievementId of achievementIds) {
    const result = applyReward(updatedProfile, achievementId);
    updatedProfile = result.profile;
    totalXP += result.xpGained;
    if (result.titleUnlocked) titlesUnlocked.push(result.titleUnlocked);
    if (result.borderUnlocked) bordersUnlocked.push(result.borderUnlocked);
  }

  return { profile: updatedProfile, totalXP, titlesUnlocked, bordersUnlocked };
};

/**
 * Calcule le multiplicateur total applicable pour une question
 * @param {RewardState} rewards - État des récompenses du joueur
 * @param {Object} taxonData - Données du taxon de la question (optionnel)
 * @returns {number} Multiplicateur total (ex: 1.07 pour +7%)
 */
export const calculatePermanentMultiplier = (rewards, taxonData = null) => {
  if (!rewards?.permanentMultipliers?.length) {
    return 1.0;
  }

  let totalBonus = 0;

  for (const multiplier of rewards.permanentMultipliers) {
    // Multiplicateur "all" s'applique toujours
    if (multiplier.filter === 'all') {
      totalBonus += multiplier.value;
      continue;
    }

    // Pour les filtres spécifiques, vérifier si le taxon correspond
    if (taxonData) {
      const matchingIconicIds = TAXON_GROUP_FILTERS[multiplier.filter] || [];
      
      // Vérifier via iconic_taxon_id
      if (taxonData.iconic_taxon_id && matchingIconicIds.includes(taxonData.iconic_taxon_id)) {
        totalBonus += multiplier.value;
        continue;
      }
      
      // Vérifier via ancestor_ids
      if (Array.isArray(taxonData.ancestor_ids)) {
        const hasMatch = matchingIconicIds.some(id => taxonData.ancestor_ids.includes(id));
        if (hasMatch) {
          totalBonus += multiplier.value;
        }
      }
    }
  }

  return 1.0 + totalBonus;
};

/**
 * Équipe un titre
 * @param {Object} profile - Profil joueur
 * @param {string} titleId - ID du titre à équiper
 * @returns {Object} Profil mis à jour
 */
export const equipTitle = (profile, titleId) => {
  if (!profile?.rewards?.unlockedTitles?.includes(titleId)) {
    console.warn(`Title ${titleId} is not unlocked`);
    return profile;
  }

  return {
    ...profile,
    rewards: {
      ...profile.rewards,
      equippedTitle: titleId,
    },
  };
};

/**
 * Équipe une bordure
 * @param {Object} profile - Profil joueur
 * @param {string} borderId - ID de la bordure à équiper
 * @returns {Object} Profil mis à jour
 */
export const equipBorder = (profile, borderId) => {
  if (!profile?.rewards?.unlockedBorders?.includes(borderId)) {
    console.warn(`Border ${borderId} is not unlocked`);
    return profile;
  }

  return {
    ...profile,
    rewards: {
      ...profile.rewards,
      equippedBorder: borderId,
    },
  };
};

/**
 * Récupère les détails d'un titre
 * @param {string} titleId - ID du titre
 * @returns {Object|null} Détails du titre
 */
export const getTitleDetails = (titleId) => {
  return AVAILABLE_TITLES[titleId] || null;
};

/**
 * Récupère les détails d'une bordure
 * @param {string} borderId - ID de la bordure
 * @returns {Object|null} Détails de la bordure
 */
export const getBorderDetails = (borderId) => {
  return AVAILABLE_BORDERS[borderId] || null;
};

/**
 * Liste tous les titres avec leur statut de déverrouillage
 * @param {RewardState} rewards - État des récompenses
 * @returns {Array<{id: string, nameKey: string, unlocked: boolean, equipped: boolean}>}
 */
export const getAllTitlesWithStatus = (rewards) => {
  return Object.entries(AVAILABLE_TITLES).map(([id, title]) => ({
    id,
    nameKey: title.nameKey,
    value: title.value,
    unlocked: rewards?.unlockedTitles?.includes(id) || false,
    equipped: rewards?.equippedTitle === id,
  }));
};

/**
 * Liste toutes les bordures avec leur statut de déverrouillage
 * @param {RewardState} rewards - État des récompenses
 * @returns {Array<{id: string, nameKey: string, css: string, unlocked: boolean, equipped: boolean}>}
 */
export const getAllBordersWithStatus = (rewards) => {
  return Object.entries(AVAILABLE_BORDERS).map(([id, border]) => ({
    id,
    nameKey: border.nameKey,
    css: border.css,
    unlocked: rewards?.unlockedBorders?.includes(id) || false,
    equipped: rewards?.equippedBorder === id,
  }));
};

/**
 * Formate une récompense pour l'affichage
 * @param {Object} reward - Objet récompense
 * @param {Function} t - Fonction de traduction i18n
 * @returns {string} Description formatée
 */
export const formatRewardDescription = (reward, t) => {
  if (!reward) return '';

  switch (reward.type) {
    case REWARD_TYPES.XP_FLAT:
      return t('rewards.xp_flat', { value: reward.value });

    case REWARD_TYPES.PERM_MULTIPLIER:
      const percent = Math.round(reward.value * 100);
      if (reward.filter === 'all') {
        return t('rewards.perm_multiplier_all', { percent });
      }
      return t('rewards.perm_multiplier', { percent, filter: reward.filter });

    case REWARD_TYPES.TITLE:
      const title = getTitleDetails(reward.value);
      return t('rewards.title', { name: title?.value || reward.value });

    case REWARD_TYPES.BORDER:
      const border = getBorderDetails(reward.value);
      return t('rewards.border', { name: t(border?.nameKey) || reward.value });

    default:
      return '';
  }
};
