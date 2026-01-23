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
  // Nouvelles bordures
  butterfly_wings: { id: 'butterfly_wings', nameKey: 'borders.butterfly_wings', css: 'border-butterfly' },
  floral_crown: { id: 'floral_crown', nameKey: 'borders.floral_crown', css: 'border-floral' },
  mythic_bronze: { id: 'mythic_bronze', nameKey: 'borders.mythic_bronze', css: 'border-mythic-bronze' },
  mythic_gold: { id: 'mythic_gold', nameKey: 'borders.mythic_gold', css: 'border-mythic-gold' },
  binoculars_lens: { id: 'binoculars_lens', nameKey: 'borders.binoculars_lens', css: 'border-binoculars' },
  spartan_helmet: { id: 'spartan_helmet', nameKey: 'borders.spartan_helmet', css: 'border-spartan' },
  diamond_frame: { id: 'diamond_frame', nameKey: 'borders.diamond_frame', css: 'border-diamond' },
  // Next-Gen Premium bordures
  aurora_borealis: { id: 'aurora_borealis', nameKey: 'borders.aurora_borealis', css: 'border-aurora' },
  cosmic_nebula: { id: 'cosmic_nebula', nameKey: 'borders.cosmic_nebula', css: 'border-nebula' },
  phoenix_flame: { id: 'phoenix_flame', nameKey: 'borders.phoenix_flame', css: 'border-phoenix' },
  ocean_depth: { id: 'ocean_depth', nameKey: 'borders.ocean_depth', css: 'border-ocean' },
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
  // Nouveaux titres
  Alpha: { id: 'Alpha', nameKey: 'titles.alpha', value: 'Alpha' },
  Batracien: { id: 'Batracien', nameKey: 'titles.batracien', value: 'Batracien' },
  Oracle: { id: 'Oracle', nameKey: 'titles.oracle', value: 'Oracle' },
  Immortel: { id: 'Immortel', nameKey: 'titles.immortel', value: 'Immortel' },
  Vampire: { id: 'Vampire', nameKey: 'titles.vampire', value: 'Vampire' },
  Medium: { id: 'Medium', nameKey: 'titles.medium', value: 'Médium' },
  master_reviewer: { id: 'master_reviewer', nameKey: 'titles.master_reviewer', value: 'Maître Réviseur' },
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
  TREE_CLIMBER_FLAWLESS: {
    titleKey: 'achievements.list.TREE_CLIMBER_FLAWLESS.title',
    descriptionKey: 'achievements.list.TREE_CLIMBER_FLAWLESS.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🌲',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 600 },
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
  RARITY_LEGEND_HUNTER_3: {
    titleKey: 'achievements.list.RARITY_LEGEND_HUNTER_3.title',
    descriptionKey: 'achievements.list.RARITY_LEGEND_HUNTER_3.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🏹',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 600 },
  },
  RARITY_LEGEND_HUNTER_10: {
    titleKey: 'achievements.list.RARITY_LEGEND_HUNTER_10.title',
    descriptionKey: 'achievements.list.RARITY_LEGEND_HUNTER_10.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🏆',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1200 },
  },
  RARITY_EPIC_SEEKER_5: {
    titleKey: 'achievements.list.RARITY_EPIC_SEEKER_5.title',
    descriptionKey: 'achievements.list.RARITY_EPIC_SEEKER_5.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🔮',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 400 },
  },
  RARITY_EPIC_SEEKER_25: {
    titleKey: 'achievements.list.RARITY_EPIC_SEEKER_25.title',
    descriptionKey: 'achievements.list.RARITY_EPIC_SEEKER_25.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '✨',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 900 },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - MODE ENIGME
  // ============================================
  RIDDLE_SOLVER_10: {
    titleKey: 'achievements.list.RIDDLE_SOLVER_10.title',
    descriptionKey: 'achievements.list.RIDDLE_SOLVER_10.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🧩',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 300 },
  },
  RIDDLE_SOLVER_50: {
    titleKey: 'achievements.list.RIDDLE_SOLVER_50.title',
    descriptionKey: 'achievements.list.RIDDLE_SOLVER_50.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🧠',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 800 },
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

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : ORDRES & FAMILLES (Taxonomie Précise)
  // ============================================
  TAXON_LEPIDOPTERA: {
    titleKey: 'achievements.list.TAXON_LEPIDOPTERA.title',
    descriptionKey: 'achievements.list.TAXON_LEPIDOPTERA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🦋',
    reward: { type: REWARD_TYPES.BORDER, value: 'butterfly_wings' },
  },
  TAXON_COLEOPTERA: {
    titleKey: 'achievements.list.TAXON_COLEOPTERA.title',
    descriptionKey: 'achievements.list.TAXON_COLEOPTERA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🪲',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 750 },
  },
  TAXON_HYMENOPTERA: {
    titleKey: 'achievements.list.TAXON_HYMENOPTERA.title',
    descriptionKey: 'achievements.list.TAXON_HYMENOPTERA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🐝',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.03, filter: 'Hymenoptera' },
  },
  TAXON_ODONATA: {
    titleKey: 'achievements.list.TAXON_ODONATA.title',
    descriptionKey: 'achievements.list.TAXON_ODONATA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🪰',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  TAXON_CARNIVORA: {
    titleKey: 'achievements.list.TAXON_CARNIVORA.title',
    descriptionKey: 'achievements.list.TAXON_CARNIVORA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🦁',
    reward: { type: REWARD_TYPES.TITLE, value: 'Alpha' },
  },
  TAXON_RODENTIA: {
    titleKey: 'achievements.list.TAXON_RODENTIA.title',
    descriptionKey: 'achievements.list.TAXON_RODENTIA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🐭',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  TAXON_ROSACEAE: {
    titleKey: 'achievements.list.TAXON_ROSACEAE.title',
    descriptionKey: 'achievements.list.TAXON_ROSACEAE.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🌹',
    reward: { type: REWARD_TYPES.BORDER, value: 'floral_crown' },
  },
  TAXON_ASTERACEAE: {
    titleKey: 'achievements.list.TAXON_ASTERACEAE.title',
    descriptionKey: 'achievements.list.TAXON_ASTERACEAE.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🌼',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  TAXON_FAGACEAE: {
    titleKey: 'achievements.list.TAXON_FAGACEAE.title',
    descriptionKey: 'achievements.list.TAXON_FAGACEAE.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🌳',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  TAXON_AMPHIBIA: {
    titleKey: 'achievements.list.TAXON_AMPHIBIA.title',
    descriptionKey: 'achievements.list.TAXON_AMPHIBIA.description',
    category: ACHIEVEMENT_CATEGORIES.TAXONOMY,
    icon: '🐸',
    reward: { type: REWARD_TYPES.TITLE, value: 'Batracien' },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : MAÎTRISE & ENDURANCE
  // ============================================
  XP_HOARDER_50K: {
    titleKey: 'achievements.list.XP_HOARDER_50K.title',
    descriptionKey: 'achievements.list.XP_HOARDER_50K.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🏛️',
    reward: { type: REWARD_TYPES.BORDER, value: 'mythic_bronze' },
  },
  XP_HOARDER_100K: {
    titleKey: 'achievements.list.XP_HOARDER_100K.title',
    descriptionKey: 'achievements.list.XP_HOARDER_100K.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '⚡',
    reward: { type: REWARD_TYPES.BORDER, value: 'mythic_gold' },
  },
  QUIZ_MASTER_500: {
    titleKey: 'achievements.list.QUIZ_MASTER_500.title',
    descriptionKey: 'achievements.list.QUIZ_MASTER_500.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '❓',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  QUIZ_MASTER_1000: {
    titleKey: 'achievements.list.QUIZ_MASTER_1000.title',
    descriptionKey: 'achievements.list.QUIZ_MASTER_1000.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '📖',
    reward: { type: REWARD_TYPES.TITLE, value: 'Oracle' },
  },
  MASTER_SAGE_50: {
    titleKey: 'achievements.list.MASTER_SAGE_50.title',
    descriptionKey: 'achievements.list.MASTER_SAGE_50.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🧙',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.05, filter: 'all' },
  },
  SEEN_OBSERVER_500: {
    titleKey: 'achievements.list.SEEN_OBSERVER_500.title',
    descriptionKey: 'achievements.list.SEEN_OBSERVER_500.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🔭',
    reward: { type: REWARD_TYPES.BORDER, value: 'binoculars_lens' },
  },
  STREAK_UNSTOPPABLE_30: {
    titleKey: 'achievements.list.STREAK_UNSTOPPABLE_30.title',
    descriptionKey: 'achievements.list.STREAK_UNSTOPPABLE_30.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🔥',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 2000 },
  },
  STREAK_INVINCIBLE_50: {
    titleKey: 'achievements.list.STREAK_INVINCIBLE_50.title',
    descriptionKey: 'achievements.list.STREAK_INVINCIBLE_50.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '👑',
    reward: { type: REWARD_TYPES.TITLE, value: 'Immortel' },
  },
  HARD_SPARTAN_50: {
    titleKey: 'achievements.list.HARD_SPARTAN_50.title',
    descriptionKey: 'achievements.list.HARD_SPARTAN_50.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🛡️',
    reward: { type: REWARD_TYPES.BORDER, value: 'spartan_helmet' },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : TEMPS & CALENDRIER
  // ============================================
  WEEKLY_RITUAL_7: {
    titleKey: 'achievements.list.WEEKLY_RITUAL_7.title',
    descriptionKey: 'achievements.list.WEEKLY_RITUAL_7.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '📅',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  TWO_WEEKS_NOTICE: {
    titleKey: 'achievements.list.TWO_WEEKS_NOTICE.title',
    descriptionKey: 'achievements.list.TWO_WEEKS_NOTICE.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '📆',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  LUNCH_BREAK: {
    titleKey: 'achievements.list.LUNCH_BREAK.title',
    descriptionKey: 'achievements.list.LUNCH_BREAK.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🍽️',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 250 },
  },
  TEA_TIME: {
    titleKey: 'achievements.list.TEA_TIME.title',
    descriptionKey: 'achievements.list.TEA_TIME.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🍵',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 250 },
  },
  MIDNIGHT_CLUB: {
    titleKey: 'achievements.list.MIDNIGHT_CLUB.title',
    descriptionKey: 'achievements.list.MIDNIGHT_CLUB.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🌙',
    reward: { type: REWARD_TYPES.TITLE, value: 'Vampire' },
  },

  // ============================================
  // NOUVEAUX SUCCÈS - CATÉGORIE : MICRO-CHALLENGES & SKILL
  // ============================================
  SPEED_CHEETAH: {
    titleKey: 'achievements.list.SPEED_CHEETAH.title',
    descriptionKey: 'achievements.list.SPEED_CHEETAH.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🐆',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1500 },
  },
  SIXTH_SENSE: {
    titleKey: 'achievements.list.SIXTH_SENSE.title',
    descriptionKey: 'achievements.list.SIXTH_SENSE.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '👁️',
    reward: { type: REWARD_TYPES.TITLE, value: 'Medium' },
  },
  PACK_EXPLORER_5: {
    titleKey: 'achievements.list.PACK_EXPLORER_5.title',
    descriptionKey: 'achievements.list.PACK_EXPLORER_5.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '🗺️',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 1000 },
  },
  DIVERSITY_CHAMP: {
    titleKey: 'achievements.list.DIVERSITY_CHAMP.title',
    descriptionKey: 'achievements.list.DIVERSITY_CHAMP.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '🌈',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  HIGH_SCORE_5K: {
    titleKey: 'achievements.list.HIGH_SCORE_5K.title',
    descriptionKey: 'achievements.list.HIGH_SCORE_5K.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '💎',
    reward: { type: REWARD_TYPES.BORDER, value: 'diamond_frame' },
  },
  RECOVERY_KING: {
    titleKey: 'achievements.list.RECOVERY_KING.title',
    descriptionKey: 'achievements.list.RECOVERY_KING.description',
    category: ACHIEVEMENT_CATEGORIES.SKILL,
    icon: '💪',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 500 },
  },
  
  // ============================================
  // SUCCÈS SYSTÈME DE RÉVISION (Spaced Repetition)
  // ============================================
  FIRST_REVIEW: {
    titleKey: 'achievements.list.FIRST_REVIEW.title',
    descriptionKey: 'achievements.list.FIRST_REVIEW.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '📚',
    reward: { type: REWARD_TYPES.XP_FLAT, value: 50 },
  },
  DEDICATED_LEARNER: {
    titleKey: 'achievements.list.DEDICATED_LEARNER.title',
    descriptionKey: 'achievements.list.DEDICATED_LEARNER.description',
    category: ACHIEVEMENT_CATEGORIES.HABIT,
    icon: '🎓',
    reward: { type: REWARD_TYPES.PERM_MULTIPLIER, value: 0.25, filter: 'all', context: 'review' },
  },
  MASTER_REVIEWER: {
    titleKey: 'achievements.list.MASTER_REVIEWER.title',
    descriptionKey: 'achievements.list.MASTER_REVIEWER.description',
    category: ACHIEVEMENT_CATEGORIES.COLLECTION,
    icon: '📖',
    reward: { type: REWARD_TYPES.TITLE, value: 'master_reviewer' },
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
  // Nouveaux filtres pour ordres/familles spécifiques
  Lepidoptera: [47157],    // Papillons
  Coleoptera: [47208],     // Coléoptères
  Hymenoptera: [47201],    // Abeilles, Guêpes, Fourmis
  Odonata: [47792],        // Libellules
  Carnivora: [41573],      // Carnivores
  Rodentia: [43698],       // Rongeurs
  Rosaceae: [47347],       // Rosacées
  Asteraceae: [47604],     // Astéracées
  Fagaceae: [47853],       // Fagacées (Chênes, Hêtres)
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

  // Mode enigme: total de bonnes reponses
  const correctRiddle = stats?.correctRiddle || 0;
  if (correctRiddle >= 10 && !owned.has('RIDDLE_SOLVER_10')) {
    unlocked.push('RIDDLE_SOLVER_10');
  }
  if (correctRiddle >= 50 && !owned.has('RIDDLE_SOLVER_50')) {
    unlocked.push('RIDDLE_SOLVER_50');
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

  // Rareté: cumul de découvertes rares (via stats.rarityCounts)
  const rarityCounts = stats?.rarityCounts || {};
  const legendaryFound = rarityCounts.legendary || 0;
  const epicFound = rarityCounts.epic || 0;
  if (legendaryFound >= 3 && !owned.has('RARITY_LEGEND_HUNTER_3')) {
    unlocked.push('RARITY_LEGEND_HUNTER_3');
  }
  if (legendaryFound >= 10 && !owned.has('RARITY_LEGEND_HUNTER_10')) {
    unlocked.push('RARITY_LEGEND_HUNTER_10');
  }
  if (epicFound >= 5 && !owned.has('RARITY_EPIC_SEEKER_5')) {
    unlocked.push('RARITY_EPIC_SEEKER_5');
  }
  if (epicFound >= 25 && !owned.has('RARITY_EPIC_SEEKER_25')) {
    unlocked.push('RARITY_EPIC_SEEKER_25');
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

  // SPEC_ENTOMOLOGIST: 50 insectes ou arachnides
  const entomoCount = (taxCounts.Insecta || 0) + (taxCounts.Arachnida || 0);
  if (entomoCount >= 50 && !owned.has('SPEC_ENTOMOLOGIST')) {
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

  // ============================================
  // NOUVEAUX SUCCÈS - TAXONOMIE PRÉCISE (Ordres/Familles)
  // ============================================

  // TAXON_LEPIDOPTERA: 20 Papillons
  if ((taxCounts.Lepidoptera || 0) >= 20 && !owned.has('TAXON_LEPIDOPTERA')) {
    unlocked.push('TAXON_LEPIDOPTERA');
  }

  // TAXON_COLEOPTERA: 20 Coléoptères
  if ((taxCounts.Coleoptera || 0) >= 20 && !owned.has('TAXON_COLEOPTERA')) {
    unlocked.push('TAXON_COLEOPTERA');
  }

  // TAXON_HYMENOPTERA: 20 Abeilles/Guêpes/Fourmis
  if ((taxCounts.Hymenoptera || 0) >= 20 && !owned.has('TAXON_HYMENOPTERA')) {
    unlocked.push('TAXON_HYMENOPTERA');
  }

  // TAXON_ODONATA: 10 Libellules
  if ((taxCounts.Odonata || 0) >= 10 && !owned.has('TAXON_ODONATA')) {
    unlocked.push('TAXON_ODONATA');
  }

  // TAXON_CARNIVORA: 15 Carnivores
  if ((taxCounts.Carnivora || 0) >= 15 && !owned.has('TAXON_CARNIVORA')) {
    unlocked.push('TAXON_CARNIVORA');
  }

  // TAXON_RODENTIA: 15 Rongeurs
  if ((taxCounts.Rodentia || 0) >= 15 && !owned.has('TAXON_RODENTIA')) {
    unlocked.push('TAXON_RODENTIA');
  }

  // TAXON_ROSACEAE: 10 Rosacées
  if ((taxCounts.Rosaceae || 0) >= 10 && !owned.has('TAXON_ROSACEAE')) {
    unlocked.push('TAXON_ROSACEAE');
  }

  // TAXON_ASTERACEAE: 10 Astéracées
  if ((taxCounts.Asteraceae || 0) >= 10 && !owned.has('TAXON_ASTERACEAE')) {
    unlocked.push('TAXON_ASTERACEAE');
  }

  // TAXON_FAGACEAE: 5 Fagacées
  if ((taxCounts.Fagaceae || 0) >= 5 && !owned.has('TAXON_FAGACEAE')) {
    unlocked.push('TAXON_FAGACEAE');
  }

  // TAXON_AMPHIBIA: 10 Amphibiens (distinct du spécialiste)
  if ((taxCounts.Amphibia || 0) >= 10 && !owned.has('TAXON_AMPHIBIA')) {
    unlocked.push('TAXON_AMPHIBIA');
  }

  // ============================================
  // NOUVEAUX SUCCÈS - MAÎTRISE & ENDURANCE
  // ============================================

  // XP_HOARDER_50K, XP_HOARDER_100K
  const totalXP = xp || 0;
  if (totalXP >= 50000 && !owned.has('XP_HOARDER_50K')) unlocked.push('XP_HOARDER_50K');
  if (totalXP >= 100000 && !owned.has('XP_HOARDER_100K')) unlocked.push('XP_HOARDER_100K');

  // QUIZ_MASTER_500, QUIZ_MASTER_1000: Total questions répondues
  const totalQuestionsAnswered = stats?.totalQuestionsAnswered || 0;
  if (totalQuestionsAnswered >= 500 && !owned.has('QUIZ_MASTER_500')) unlocked.push('QUIZ_MASTER_500');
  if (totalQuestionsAnswered >= 1000 && !owned.has('QUIZ_MASTER_1000')) unlocked.push('QUIZ_MASTER_1000');

  // MASTER_SAGE_50: 50 espèces maîtrisées totalement
  const masteredFullCount = collectionStats?.fullyMasteredCount || masteredSpeciesCount;
  if (masteredFullCount >= 50 && !owned.has('MASTER_SAGE_50')) unlocked.push('MASTER_SAGE_50');

  // SEEN_OBSERVER_500: 500 espèces différentes
  if (pokedexCount >= 500 && !owned.has('SEEN_OBSERVER_500')) unlocked.push('SEEN_OBSERVER_500');

  // STREAK_UNSTOPPABLE_30, STREAK_INVINCIBLE_50: Streak records (in-game)
  if (longestStreak >= 30 && !owned.has('STREAK_UNSTOPPABLE_30')) unlocked.push('STREAK_UNSTOPPABLE_30');
  if (longestStreak >= 50 && !owned.has('STREAK_INVINCIBLE_50')) unlocked.push('STREAK_INVINCIBLE_50');

  // HARD_SPARTAN_50: 50 parties complètes en mode difficile
  const hardGamesPlayed = stats?.hardGamesCompleted || 0;
  if (hardGamesPlayed >= 50 && !owned.has('HARD_SPARTAN_50')) unlocked.push('HARD_SPARTAN_50');

  // ============================================
  // NOUVEAUX SUCCÈS - TEMPS & CALENDRIER
  // ============================================

  // WEEKLY_RITUAL_7: Série journalière de 7 jours
  if (dailyStreakCurrent >= 7 && !owned.has('WEEKLY_RITUAL_7')) unlocked.push('WEEKLY_RITUAL_7');

  // TWO_WEEKS_NOTICE: Série journalière de 14 jours
  if (dailyStreakCurrent >= 14 && !owned.has('TWO_WEEKS_NOTICE')) unlocked.push('TWO_WEEKS_NOTICE');

  // PACK_EXPLORER_5: 5 packs différents joués
  const packsPlayedCount = Object.keys(stats?.packsPlayed || {}).length;
  if (packsPlayedCount >= 5 && !owned.has('PACK_EXPLORER_5')) unlocked.push('PACK_EXPLORER_5');

  // ============================================
  // NOUVEAUX SUCCÈS - SYSTÈME DE RÉVISION
  // ============================================

  // FIRST_REVIEW: Compléter la première session de révision
  const reviewSessionsCompleted = stats?.reviewSessionsCompleted || 0;
  if (reviewSessionsCompleted >= 1 && !owned.has('FIRST_REVIEW')) {
    unlocked.push('FIRST_REVIEW');
  }

  // DEDICATED_LEARNER: 7 sessions de révision consécutives (7 jours)
  const consecutiveReviewDays = stats?.consecutiveReviewDays || 0;
  if (consecutiveReviewDays >= 7 && !owned.has('DEDICATED_LEARNER')) {
    unlocked.push('DEDICATED_LEARNER');
  }

  // MASTER_REVIEWER: 50+ espèces dans le système de révision
  const totalInReviewSystem = collectionStats?.totalInReviewSystem || 0;
  if (totalInReviewSystem >= 50 && !owned.has('MASTER_REVIEWER')) {
    unlocked.push('MASTER_REVIEWER');
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

  // TREE_CLIMBER_FLAWLESS: Perfect taxonomic ascent
  if (
    !owned.has('TREE_CLIMBER_FLAWLESS') &&
    roundMeta.mode === 'taxonomic' &&
    roundMeta.wasCorrect &&
    roundMeta.mistakes === 0
  ) {
    unlocked.push('TREE_CLIMBER_FLAWLESS');
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
    averageResponseTimeMs = null,
    uniqueClassesInGame = 0,
    hadErrorBeforeLast5 = false,
    last5AllCorrect = false,
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

  // ============================================
  // NOUVEAUX SUCCÈS - TEMPS & CALENDRIER
  // ============================================

  // LUNCH_BREAK: Partie entre 12h et 14h
  if (!owned.has('LUNCH_BREAK') && gameHour >= 12 && gameHour < 14 && gameWon) {
    unlocked.push('LUNCH_BREAK');
  }

  // TEA_TIME: Partie entre 16h et 18h
  if (!owned.has('TEA_TIME') && gameHour >= 16 && gameHour < 18 && gameWon) {
    unlocked.push('TEA_TIME');
  }

  // MIDNIGHT_CLUB: Partie entre 0h et 2h
  if (!owned.has('MIDNIGHT_CLUB') && gameHour >= 0 && gameHour < 2 && gameWon) {
    unlocked.push('MIDNIGHT_CLUB');
  }

  // ============================================
  // NOUVEAUX SUCCÈS - MICRO-CHALLENGES
  // ============================================

  // SPEED_CHEETAH: Moyenne < 2s/question (>10 Q)
  if (
    !owned.has('SPEED_CHEETAH') &&
    totalQuestions > 10 &&
    averageResponseTimeMs !== null &&
    averageResponseTimeMs < 2000
  ) {
    unlocked.push('SPEED_CHEETAH');
  }

  // SIXTH_SENSE: Partie parfaite (>10 Q) sans indices
  if (
    !owned.has('SIXTH_SENSE') &&
    totalQuestions > 10 &&
    correctAnswers === totalQuestions &&
    hintsUsed === 0
  ) {
    unlocked.push('SIXTH_SENSE');
  }

  // DIVERSITY_CHAMP: 5 classes différentes dans une seule partie
  if (!owned.has('DIVERSITY_CHAMP') && uniqueClassesInGame >= 5) {
    unlocked.push('DIVERSITY_CHAMP');
  }

  // HIGH_SCORE_5K: 5000+ XP en une seule partie
  if (!owned.has('HIGH_SCORE_5K') && sessionXP >= 5000) {
    unlocked.push('HIGH_SCORE_5K');
  }

  // RECOVERY_KING: 100% sur les 5 dernières questions après une erreur
  if (!owned.has('RECOVERY_KING') && hadErrorBeforeLast5 && last5AllCorrect) {
    unlocked.push('RECOVERY_KING');
  }

  return unlocked;
};
