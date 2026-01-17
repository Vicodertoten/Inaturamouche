// src/core/achievements/definitions.js
import { getLevelFromXp } from '../../utils/scoring';

/**
 * @typedef {'XP_FLAT' | 'PERM_MULTIPLIER' | 'TITLE' | 'BORDER'} RewardType
 * 
 * @typedef {Object} AchievementReward
 * @property {RewardType} type - Type de récompense
 * @property {number|string} value - Valeur de la récompense (XP, pourcentage, ou ID)
 * @property {string} [filter] - Filtre taxonomique pour PERM_MULTIPLIER (ex: 'Aves', 'all')
 * 
 * @typedef {Object} Achievement
 * @property {string} titleKey - Clé i18n pour le titre
 * @property {string} descriptionKey - Clé i18n pour la description
 * @property {'TAXONOMY' | 'COLLECTION' | 'SKILL' | 'HABIT'} [category] - Catégorie du succès
 * @property {string} [icon] - Emoji ou icône du succès
 * @property {AchievementReward} [reward] - Récompense associée
 */

/**
 * Types de récompenses disponibles
 */
export const REWARD_TYPES = Object.freeze({
  XP_FLAT: 'XP_FLAT',         // XP direct
  PERM_MULTIPLIER: 'PERM_MULTIPLIER', // Multiplicateur permanent
  TITLE: 'TITLE',             // Titre déblocable
  BORDER: 'BORDER',           // Bordure avatar déblocable
});

/**
 * Catégories de succès
 */
export const ACHIEVEMENT_CATEGORIES = Object.freeze({
  TAXONOMY: 'TAXONOMY',       // Spécialisation taxonomique
  COLLECTION: 'COLLECTION',   // Encyclopédie & maîtrise
  SKILL: 'SKILL',             // Compétence & performance
  HABIT: 'HABIT',             // Habitudes & temps de jeu
});

/**
 * Bordures disponibles (débloquées par succès)
 */
export const AVAILABLE_BORDERS = Object.freeze({
  default: { id: 'default', nameKey: 'borders.default', css: '' },
  scales_theme: { id: 'scales_theme', nameKey: 'borders.scales_theme', css: 'border-scales' },
  silver_frame: { id: 'silver_frame', nameKey: 'borders.silver_frame', css: 'border-silver' },
  gold_book_frame: { id: 'gold_book_frame', nameKey: 'borders.gold_book_frame', css: 'border-gold-book' },
  hardened_steel: { id: 'hardened_steel', nameKey: 'borders.hardened_steel', css: 'border-steel' },
  platinum_ring: { id: 'platinum_ring', nameKey: 'borders.platinum_ring', css: 'border-platinum' },
});

/**
 * Titres disponibles (débloqués par succès)
 */
export const AVAILABLE_TITLES = Object.freeze({
  default: { id: 'default', nameKey: 'titles.default' },
  explorateur_marin: { id: 'explorateur_marin', nameKey: 'titles.explorateur_marin', value: 'Explorateur Marin' },
  professeur: { id: 'professeur', nameKey: 'titles.professeur', value: 'Professeur' },
  flash: { id: 'flash', nameKey: 'titles.flash', value: 'Flash' },
  gardien_du_temps: { id: 'gardien_du_temps', nameKey: 'titles.gardien_du_temps', value: 'Gardien du Temps' },
});

/** @type {Record<string, Achievement>} */
export const ACHIEVEMENTS = {
  // ============================================
  // SUCCÈS EXISTANTS (legacy)
  // ============================================
  first_game: {
    titleKey: 'achievements.list.first_game.title',
    descriptionKey: 'achievements.list.first_game.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🎮',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 100 },
  },
  ten_games: {
    titleKey: 'achievements.list.ten_games.title',
    descriptionKey: 'achievements.list.ten_games.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🎯',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 300 },
  },
  globetrotter: {
    titleKey: 'achievements.list.globetrotter.title',
    descriptionKey: 'achievements.list.globetrotter.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🌍',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  LEVEL_5: {
    titleKey: 'achievements.list.LEVEL_5.title',
    descriptionKey: 'achievements.list.LEVEL_5.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '⭐',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 250 },
  },
  LEVEL_10: {
    titleKey: 'achievements.list.LEVEL_10.title',
    descriptionKey: 'achievements.list.LEVEL_10.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🌟',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  ACCURACY_HARD_75: {
    titleKey: 'achievements.list.ACCURACY_HARD_75.title',
    descriptionKey: 'achievements.list.ACCURACY_HARD_75.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🎯',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 750 },
  },
  MASTER_5_SPECIES: {
    titleKey: 'achievements.list.MASTER_5_SPECIES.title',
    descriptionKey: 'achievements.list.MASTER_5_SPECIES.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '📚',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  GENUS_NO_HINTS_3: {
    titleKey: 'achievements.list.GENUS_NO_HINTS_3.title',
    descriptionKey: 'achievements.list.GENUS_NO_HINTS_3.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🧬',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 400 },
  },
  BIOME_MASTER_TUNDRA: {
    titleKey: 'achievements.list.BIOME_MASTER_TUNDRA.title',
    descriptionKey: 'achievements.list.BIOME_MASTER_TUNDRA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '❄️',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 600 },
  },
  SKILL_SPEEDRUN: {
    titleKey: 'achievements.list.SKILL_SPEEDRUN.title',
    descriptionKey: 'achievements.list.SKILL_SPEEDRUN.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '⚡',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 200 },
  },
  // Streak Achievements
  STREAK_STARTER_3: {
    titleKey: 'achievements.list.STREAK_STARTER_3.title',
    descriptionKey: 'achievements.list.STREAK_STARTER_3.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🔥',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 150 },
  },
  STREAK_MASTER_5: {
    titleKey: 'achievements.list.STREAK_MASTER_5.title',
    descriptionKey: 'achievements.list.STREAK_MASTER_5.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🔥',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 300 },
  },
  STREAK_LEGEND_10: {
    titleKey: 'achievements.list.STREAK_LEGEND_10.title',
    descriptionKey: 'achievements.list.STREAK_LEGEND_10.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🔥',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  STREAK_TITAN_20: {
    titleKey: 'achievements.list.STREAK_TITAN_20.title',
    descriptionKey: 'achievements.list.STREAK_TITAN_20.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '⚡',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  STREAK_GUARDIAN: {
    titleKey: 'achievements.list.STREAK_GUARDIAN.title',
    descriptionKey: 'achievements.list.STREAK_GUARDIAN.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🛡️',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 2000 },
  },
  PERFECT_GAME: {
    titleKey: 'achievements.list.PERFECT_GAME.title',
    descriptionKey: 'achievements.list.PERFECT_GAME.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '💎',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 750 },
  },
  FLAWLESS_HARD: {
    titleKey: 'achievements.list.FLAWLESS_HARD.title',
    descriptionKey: 'achievements.list.FLAWLESS_HARD.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '👑',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1500 },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : TAXONOMIE (Le Spécialiste)
  // ============================================
  SPEC_ORNITHOLOGIST: {
    titleKey: 'achievements.list.SPEC_ORNITHOLOGIST.title',
    descriptionKey: 'achievements.list.SPEC_ORNITHOLOGIST.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🐦',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.02, filter: 'Aves' },
  },
  SPEC_BOTANIST: {
    titleKey: 'achievements.list.SPEC_BOTANIST.title',
    descriptionKey: 'achievements.list.SPEC_BOTANIST.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🌿',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.02, filter: 'Plantae' },
  },
  SPEC_ENTOMOLOGIST: {
    titleKey: 'achievements.list.SPEC_ENTOMOLOGIST.title',
    descriptionKey: 'achievements.list.SPEC_ENTOMOLOGIST.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🦗',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.02, filter: 'Insecta' },
  },
  SPEC_MYCOLOGIST: {
    titleKey: 'achievements.list.SPEC_MYCOLOGIST.title',
    descriptionKey: 'achievements.list.SPEC_MYCOLOGIST.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🍄',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  SPEC_HERPETOLOGIST: {
    titleKey: 'achievements.list.SPEC_HERPETOLOGIST.title',
    descriptionKey: 'achievements.list.SPEC_HERPETOLOGIST.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🦎',
    reward: { type: REWARD_TYPES.BORDER, value: 'scales_theme' },
  },
  SPEC_MAMMALOGIST: {
    titleKey: 'achievements.list.SPEC_MAMMALOGIST.title',
    descriptionKey: 'achievements.list.SPEC_MAMMALOGIST.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🦊',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  SPEC_DIVER: {
    titleKey: 'achievements.list.SPEC_DIVER.title',
    descriptionKey: 'achievements.list.SPEC_DIVER.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🐠',
    reward: { type: REWARD_TYPES.TITLE, value: 'explorateur_marin' },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : COLLECTION (L'Encyclopédiste)
  // ============================================
  COLL_ROOKIE_50: {
    titleKey: 'achievements.list.COLL_ROOKIE_50.title',
    descriptionKey: 'achievements.list.COLL_ROOKIE_50.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '📖',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  COLL_EXPERT_150: {
    titleKey: 'achievements.list.COLL_EXPERT_150.title',
    descriptionKey: 'achievements.list.COLL_EXPERT_150.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '📚',
    reward: { type: REWARD_TYPES.BORDER, value: 'silver_frame' },
  },
  COLL_MASTER_300: {
    titleKey: 'achievements.list.COLL_MASTER_300.title',
    descriptionKey: 'achievements.list.COLL_MASTER_300.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🏛️',
    reward: { type: REWARD_TYPES.BORDER, value: 'gold_book_frame' },
  },
  MASTERY_PROFESSOR_10: {
    titleKey: 'achievements.list.MASTERY_PROFESSOR_10.title',
    descriptionKey: 'achievements.list.MASTERY_PROFESSOR_10.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🎓',
    reward: { type: REWARD_TYPES.TITLE, value: 'professeur' },
  },
  MASTERY_GENIUS_25: {
    titleKey: 'achievements.list.MASTERY_GENIUS_25.title',
    descriptionKey: 'achievements.list.MASTERY_GENIUS_25.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🧠',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.05, filter: 'all' },
  },
  FAMILY_REUNION: {
    titleKey: 'achievements.list.FAMILY_REUNION.title',
    descriptionKey: 'achievements.list.FAMILY_REUNION.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '👨‍👩‍👧‍👦',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1500 },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : ÉLITE & HARD MODE
  // ============================================
  HARD_VETERAN_50: {
    titleKey: 'achievements.list.HARD_VETERAN_50.title',
    descriptionKey: 'achievements.list.HARD_VETERAN_50.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '💪',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 2000 },
  },
  HARD_VETERAN_200: {
    titleKey: 'achievements.list.HARD_VETERAN_200.title',
    descriptionKey: 'achievements.list.HARD_VETERAN_200.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🏆',
    reward: { type: REWARD_TYPES.BORDER, value: 'hardened_steel' },
  },
  SCORING_JACKPOT: {
    titleKey: 'achievements.list.SCORING_JACKPOT.title',
    descriptionKey: 'achievements.list.SCORING_JACKPOT.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '💰',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  SPEED_LIGHTNING: {
    titleKey: 'achievements.list.SPEED_LIGHTNING.title',
    descriptionKey: 'achievements.list.SPEED_LIGHTNING.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '⚡',
    reward: { type: REWARD_TYPES.TITLE, value: 'flash' },
  },
  PURIST_NO_HINT: {
    titleKey: 'achievements.list.PURIST_NO_HINT.title',
    descriptionKey: 'achievements.list.PURIST_NO_HINT.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🏅',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 2500 },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : HABITUDES & TEMPS
  // ============================================
  GAMES_50: {
    titleKey: 'achievements.list.GAMES_50.title',
    descriptionKey: 'achievements.list.GAMES_50.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🎮',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  GAMES_100: {
    titleKey: 'achievements.list.GAMES_100.title',
    descriptionKey: 'achievements.list.GAMES_100.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🎮',
    reward: { type: REWARD_TYPES.BORDER, value: 'platinum_ring' },
  },
  EARLY_BIRD: {
    titleKey: 'achievements.list.EARLY_BIRD.title',
    descriptionKey: 'achievements.list.EARLY_BIRD.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🌅',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 300 },
  },
  NIGHT_OWL: {
    titleKey: 'achievements.list.NIGHT_OWL.title',
    descriptionKey: 'achievements.list.NIGHT_OWL.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🦉',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 300 },
  },
  STREAK_MONTH: {
    titleKey: 'achievements.list.STREAK_MONTH.title',
    descriptionKey: 'achievements.list.STREAK_MONTH.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '📅',
    reward: { type: REWARD_TYPES.TITLE, value: 'gardien_du_temps' },
  },
  SHIELD_HOARDER: {
    titleKey: 'achievements.list.SHIELD_HOARDER.title',
    descriptionKey: 'achievements.list.SHIELD_HOARDER.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🛡️',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 250 },
  },
  WEEKEND_WARRIOR: {
    titleKey: 'achievements.list.WEEKEND_WARRIOR.title',
    descriptionKey: 'achievements.list.WEEKEND_WARRIOR.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '⚔️',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
};

// ============================================
// LOGIQUE DE VÉRIFICATION DES SUCCÈS
// ============================================

/**
 * Mapping des iconic_taxon_id iNaturalist vers les filtres de succès
 * Basé sur l'API iNaturalist: https://api.inaturalist.org/v1/taxa/autocomplete
 */
export const ICONIC_TAXON_MAP = Object.freeze({
  // Animalia
  1: 'Animalia',      // Animals
  3: 'Aves',          // Birds
  20978: 'Amphibia',  // Amphibians
  26036: 'Reptilia',  // Reptiles
  40151: 'Mammalia',  // Mammals
  47178: 'Actinopterygii', // Fish
  47115: 'Mollusca',  // Molluscs
  47119: 'Arachnida', // Arachnids
  47158: 'Insecta',   // Insects
  // Plantae
  47126: 'Plantae',   // Plants
  // Fungi
  47170: 'Fungi',     // Fungi
  // Protozoa
  48222: 'Protozoa',
});

/**
 * Mapping des noms de classes/règnes vers les groupes pour les filtres PERM_MULTIPLIER
 */
export const TAXON_GROUP_FILTERS = Object.freeze({
  Aves: [3],
  Plantae: [47126],
  Insecta: [47158],
  Fungi: [47170],
  Reptilia: [26036],
  Amphibia: [20978],
  Mammalia: [40151],
  Actinopterygii: [47178],
  Marine: [47178, 47115], // Poissons + Mollusques marins
  all: null, // Appliqué à tout
});

/**
 * Vérifie si un succès profile-based doit être débloqué
 * @param {Object} profile - Profil joueur complet
 * @param {Object} collectionStats - Stats de collection (from DB)
 * @param {Object} [sessionContext] - Contexte de session (pour succès temps réel)
 * @returns {Array<string>} IDs des succès débloqués
 */
export const checkNewAchievements = (profile, collectionStats = {}, sessionContext = {}) => {
  const unlocked = [];
  const { xp, stats, achievements = [], dailyStreak = {} } = profile || {};
  const owned = new Set(achievements);

  // Calcul du niveau pour les succès
  const currentLevel = getLevelFromXp(xp || 0);

  // ============================================
  // SUCCÈS LEGACY (existants)
  // ============================================
  
  // Parties jouées
  if ((stats?.gamesPlayed || 0) >= 1 && !owned.has('first_game')) {
    unlocked.push('first_game');
  }
  if ((stats?.gamesPlayed || 0) >= 10 && !owned.has('ten_games')) {
    unlocked.push('ten_games');
  }
  
  // Globe-trotter: 3 packs différents
  if (Object.keys(stats?.packsPlayed || {}).length >= 3 && !owned.has('globetrotter')) {
    unlocked.push('globetrotter');
  }

  // Niveaux
  if (currentLevel >= 5 && !owned.has('LEVEL_5')) unlocked.push('LEVEL_5');
  if (currentLevel >= 10 && !owned.has('LEVEL_10')) unlocked.push('LEVEL_10');

  // Précision mode difficile
  const hardAnswered = stats?.hardQuestionsAnswered || 0;
  const correctHard = stats?.correctHard || 0;
  if (
    hardAnswered >= 25 &&
    (correctHard / hardAnswered) >= 0.75 &&
    !owned.has('ACCURACY_HARD_75')
  ) {
    unlocked.push('ACCURACY_HARD_75');
  }

  // Maîtrise 5 espèces (3 bonnes réponses chacune)
  const masteredSpeciesCount = Object.values(stats?.speciesMastery || {}).filter(
    (m) => (m.correct || 0) >= 3
  ).length;
  if (masteredSpeciesCount >= 5 && !owned.has('MASTER_5_SPECIES')) {
    unlocked.push('MASTER_5_SPECIES');
  }

  // Streaks combo (in-game)
  const longestStreak = stats?.longestStreak || 0;
  if (longestStreak >= 3 && !owned.has('STREAK_STARTER_3')) unlocked.push('STREAK_STARTER_3');
  if (longestStreak >= 5 && !owned.has('STREAK_MASTER_5')) unlocked.push('STREAK_MASTER_5');
  if (longestStreak >= 10 && !owned.has('STREAK_LEGEND_10')) unlocked.push('STREAK_LEGEND_10');
  if (longestStreak >= 20 && !owned.has('STREAK_TITAN_20')) unlocked.push('STREAK_TITAN_20');
  if (longestStreak >= 50 && !owned.has('STREAK_GUARDIAN')) unlocked.push('STREAK_GUARDIAN');

  // ============================================
  // NOUVEAUX SUCCÈS - HABITUDES & TEMPS
  // ============================================

  // GAMES_50, GAMES_100
  const gamesPlayed = stats?.gamesPlayed || 0;
  if (gamesPlayed >= 50 && !owned.has('GAMES_50')) unlocked.push('GAMES_50');
  if (gamesPlayed >= 100 && !owned.has('GAMES_100')) unlocked.push('GAMES_100');

  // STREAK_MONTH: Série journalière de 30 jours
  const dailyStreakCurrent = dailyStreak?.current || 0;
  if (dailyStreakCurrent >= 30 && !owned.has('STREAK_MONTH')) {
    unlocked.push('STREAK_MONTH');
  }

  // SHIELD_HOARDER: Posséder 5 boucliers (in-game shields accumulation)
  const totalShields = dailyStreak?.shields || 0;
  if (totalShields >= 5 && !owned.has('SHIELD_HOARDER')) {
    unlocked.push('SHIELD_HOARDER');
  }

  // WEEKEND_WARRIOR: Jouer Samedi ET Dimanche (vérification via weekendPlayed flag)
  if (stats?.weekendWarriorCompleted && !owned.has('WEEKEND_WARRIOR')) {
    unlocked.push('WEEKEND_WARRIOR');
  }

  // ============================================
  // NOUVEAUX SUCCÈS - HARD MODE / ÉLITE
  // ============================================

  // HARD_VETERAN_50, HARD_VETERAN_200
  if (correctHard >= 50 && !owned.has('HARD_VETERAN_50')) unlocked.push('HARD_VETERAN_50');
  if (correctHard >= 200 && !owned.has('HARD_VETERAN_200')) unlocked.push('HARD_VETERAN_200');

  // ============================================
  // NOUVEAUX SUCCÈS - COLLECTION (utilise collectionStats)
  // ============================================

  // COLL_ROOKIE_50, COLL_EXPERT_150, COLL_MASTER_300
  const pokedexCount = collectionStats?.totalSpeciesSeen || Object.keys(profile?.pokedex || {}).length || 0;
  if (pokedexCount >= 50 && !owned.has('COLL_ROOKIE_50')) unlocked.push('COLL_ROOKIE_50');
  if (pokedexCount >= 150 && !owned.has('COLL_EXPERT_150')) unlocked.push('COLL_EXPERT_150');
  if (pokedexCount >= 300 && !owned.has('COLL_MASTER_300')) unlocked.push('COLL_MASTER_300');

  // MASTERY_PROFESSOR_10, MASTERY_GENIUS_25: Maîtrise max (niveau Diamond = XP >= 300)
  const maxMasteryCount = collectionStats?.diamondMasteryCount || 0;
  if (maxMasteryCount >= 10 && !owned.has('MASTERY_PROFESSOR_10')) unlocked.push('MASTERY_PROFESSOR_10');
  if (maxMasteryCount >= 25 && !owned.has('MASTERY_GENIUS_25')) unlocked.push('MASTERY_GENIUS_25');

  // FAMILY_REUNION: 5 espèces de la même famille maîtrisées
  if (collectionStats?.familyReunionComplete && !owned.has('FAMILY_REUNION')) {
    unlocked.push('FAMILY_REUNION');
  }

  // ============================================
  // NOUVEAUX SUCCÈS - TAXONOMIE (Spécialistes)
  // Utilise collectionStats.taxonomyCounts = { Aves: N, Plantae: N, ... }
  // ============================================
  const taxCounts = collectionStats?.taxonomyCounts || {};

  // SPEC_ORNITHOLOGIST: 50 oiseaux
  if ((taxCounts.Aves || 0) >= 50 && !owned.has('SPEC_ORNITHOLOGIST')) {
    unlocked.push('SPEC_ORNITHOLOGIST');
  }

  // SPEC_BOTANIST: 50 plantes
  if ((taxCounts.Plantae || 0) >= 50 && !owned.has('SPEC_BOTANIST')) {
    unlocked.push('SPEC_BOTANIST');
  }

  // SPEC_ENTOMOLOGIST: 50 insectes
  if ((taxCounts.Insecta || 0) >= 50 && !owned.has('SPEC_ENTOMOLOGIST')) {
    unlocked.push('SPEC_ENTOMOLOGIST');
  }

  // SPEC_MYCOLOGIST: 20 champignons
  if ((taxCounts.Fungi || 0) >= 20 && !owned.has('SPEC_MYCOLOGIST')) {
    unlocked.push('SPEC_MYCOLOGIST');
  }

  // SPEC_HERPETOLOGIST: 20 reptiles ou amphibiens
  const herpsCount = (taxCounts.Reptilia || 0) + (taxCounts.Amphibia || 0);
  if (herpsCount >= 20 && !owned.has('SPEC_HERPETOLOGIST')) {
    unlocked.push('SPEC_HERPETOLOGIST');
  }

  // SPEC_MAMMALOGIST: 20 mammifères
  if ((taxCounts.Mammalia || 0) >= 20 && !owned.has('SPEC_MAMMALOGIST')) {
    unlocked.push('SPEC_MAMMALOGIST');
  }

  // SPEC_DIVER: 20 espèces marines
  const marineCount = taxCounts.Marine || (taxCounts.Actinopterygii || 0) + (taxCounts.Mollusca || 0);
  if (marineCount >= 20 && !owned.has('SPEC_DIVER')) {
    unlocked.push('SPEC_DIVER');
  }

  return unlocked;
};

// ============================================
// VÉRIFICATION MICRO-CHALLENGES (temps réel)
// ============================================

const SPEEDRUN_THRESHOLD_MS = 8000;
const LIGHTNING_THRESHOLD_MS = 1500;
const HINTLESS_WINDOW = 3;
const TARGET_BIOME = 'tundra';

/**
 * Évalue les micro-challenges en temps réel pendant une session
 * @param {Object} snapshot - État de session
 * @param {Array<string>} alreadyUnlocked - Succès déjà possédés
 * @returns {Array<string>} Nouveaux succès débloqués
 */
export const evaluateMicroChallenges = (snapshot = {}, alreadyUnlocked = []) => {
  const unlocked = [];
  const owned = new Set(alreadyUnlocked || []);
  const sessionSpeciesData = snapshot.sessionSpeciesData || [];
  const roundMeta = snapshot.roundMeta || {};
  const currentStreak = snapshot.currentStreak || 0;
  const sessionXP = snapshot.sessionXP || 0;
  const consecutiveFastAnswers = snapshot.consecutiveFastAnswers || 0;
  const gameHour = snapshot.gameHour ?? new Date().getHours();
  const totalQuestionsAnswered = snapshot.totalQuestionsAnswered || sessionSpeciesData.length;
  const hintsUsedInSession = snapshot.hintsUsedInSession || 0;
  const correctAnswersInSession = snapshot.correctAnswersInSession || sessionSpeciesData.filter(e => e.wasCorrect).length;

  // GENUS_NO_HINTS_3: 3 genres sans indices
  if (!owned.has('GENUS_NO_HINTS_3')) {
    const recentWindow = sessionSpeciesData.slice(-HINTLESS_WINDOW);
    if (recentWindow.length === HINTLESS_WINDOW) {
      const allWithoutHints = recentWindow.every(
        (entry) => entry.wasCorrect && !entry.hintsUsed
      );
      if (allWithoutHints) {
        const uniqueGenera = new Set(
          recentWindow.map((entry) => entry.genusId).filter(Boolean)
        );
        if (uniqueGenera.size >= HINTLESS_WINDOW) {
          unlocked.push('GENUS_NO_HINTS_3');
        }
      }
    }
  }

  // BIOME_MASTER_TUNDRA: 3 réponses parfaites dans la toundra
  if (!owned.has('BIOME_MASTER_TUNDRA')) {
    const streakWindow = currentStreak > 0 ? sessionSpeciesData.slice(-currentStreak) : [];
    const biomePerfectRun = streakWindow.filter(
      (entry) =>
        entry.wasCorrect &&
        Array.isArray(entry.biomes) &&
        entry.biomes.includes(TARGET_BIOME)
    ).length;
    if (biomePerfectRun >= 3) {
      unlocked.push('BIOME_MASTER_TUNDRA');
    }
  }

  // SKILL_SPEEDRUN: Réponse < 8s
  if (
    !owned.has('SKILL_SPEEDRUN') &&
    roundMeta.wasCorrect &&
    typeof roundMeta.responseTimeMs === 'number' &&
    roundMeta.responseTimeMs <= SPEEDRUN_THRESHOLD_MS
  ) {
    unlocked.push('SKILL_SPEEDRUN');
  }

  // SPEED_LIGHTNING: 5 réponses < 1.5s consécutives
  if (!owned.has('SPEED_LIGHTNING') && consecutiveFastAnswers >= 5) {
    unlocked.push('SPEED_LIGHTNING');
  }

  // SCORING_JACKPOT: 2000 XP en une partie
  if (!owned.has('SCORING_JACKPOT') && sessionXP >= 2000) {
    unlocked.push('SCORING_JACKPOT');
  }

  // PURIST_NO_HINT: Partie parfaite (10+ Q) sans indices
  if (
    !owned.has('PURIST_NO_HINT') &&
    totalQuestionsAnswered >= 10 &&
    correctAnswersInSession === totalQuestionsAnswered &&
    hintsUsedInSession === 0
  ) {
    unlocked.push('PURIST_NO_HINT');
  }

  // EARLY_BIRD: Gagner entre 5h et 8h
  if (!owned.has('EARLY_BIRD') && gameHour >= 5 && gameHour < 8 && roundMeta.wasCorrect) {
    // Sera confirmé à la fin de la partie via sessionContext
    if (snapshot.gameWon) {
      unlocked.push('EARLY_BIRD');
    }
  }

  // NIGHT_OWL: Gagner entre 0h et 4h
  if (!owned.has('NIGHT_OWL') && gameHour >= 0 && gameHour < 4 && roundMeta.wasCorrect) {
    if (snapshot.gameWon) {
      unlocked.push('NIGHT_OWL');
    }
  }

  // PERFECT_GAME: 5 questions sans erreur (sans bouclier)
  if (!owned.has('PERFECT_GAME')) {
    const { shieldsUsed = 0 } = snapshot;
    if (
      totalQuestionsAnswered >= 5 &&
      correctAnswersInSession === totalQuestionsAnswered &&
      shieldsUsed === 0
    ) {
      unlocked.push('PERFECT_GAME');
    }
  }

  // FLAWLESS_HARD: 10 questions en mode difficile sans erreur ni bouclier
  if (!owned.has('FLAWLESS_HARD')) {
    const { gameMode = 'easy', shieldsUsed = 0 } = snapshot;
    if (
      gameMode === 'hard' &&
      totalQuestionsAnswered >= 10 &&
      correctAnswersInSession === totalQuestionsAnswered &&
      shieldsUsed === 0
    ) {
      unlocked.push('FLAWLESS_HARD');
    }
  }

  return unlocked;
};

/**
 * Vérifie les succès à la fin d'une partie
 * @param {Object} sessionData - Données de fin de session
 * @param {Array<string>} alreadyUnlocked - Succès déjà possédés
 * @returns {Array<string>} Nouveaux succès débloqués
 */
export const checkEndOfGameAchievements = (sessionData = {}, alreadyUnlocked = []) => {
  const unlocked = [];
  const owned = new Set(alreadyUnlocked || []);
  
  const {
    sessionXP = 0,
    gameHour = new Date().getHours(),
    totalQuestions = 0,
    correctAnswers = 0,
    hintsUsed = 0,
    shieldsUsed = 0,
    gameMode = 'easy',
    gameWon = false,
  } = sessionData;

  // SCORING_JACKPOT
  if (!owned.has('SCORING_JACKPOT') && sessionXP >= 2000) {
    unlocked.push('SCORING_JACKPOT');
  }

  // PURIST_NO_HINT
  if (
    !owned.has('PURIST_NO_HINT') &&
    totalQuestions >= 10 &&
    correctAnswers === totalQuestions &&
    hintsUsed === 0
  ) {
    unlocked.push('PURIST_NO_HINT');
  }

  // EARLY_BIRD
  if (!owned.has('EARLY_BIRD') && gameHour >= 5 && gameHour < 8 && gameWon) {
    unlocked.push('EARLY_BIRD');
  }

  // NIGHT_OWL
  if (!owned.has('NIGHT_OWL') && gameHour >= 0 && gameHour < 4 && gameWon) {
    unlocked.push('NIGHT_OWL');
  }

  // PERFECT_GAME
  if (
    !owned.has('PERFECT_GAME') &&
    totalQuestions >= 5 &&
    correctAnswers === totalQuestions &&
    shieldsUsed === 0
  ) {
    unlocked.push('PERFECT_GAME');
  }

  // FLAWLESS_HARD
  if (
    !owned.has('FLAWLESS_HARD') &&
    gameMode === 'hard' &&
    totalQuestions >= 10 &&
    correctAnswers === totalQuestions &&
    shieldsUsed === 0
  ) {
    unlocked.push('FLAWLESS_HARD');
  }

  return unlocked;
};
