/**
 * AchievementStatsService.js
 * 
 * Service pour calculer les statistiques nécessaires à la vérification des succès.
 * Optimisé pour éviter de charger toutes les données en mémoire.
 */

import db, { taxa as taxaTable, stats as statsTable } from './db.js';
import { ICONIC_TAXON_MAP } from '../core/achievements';
import { MASTERY_LEVELS } from './CollectionService.js';

// Threshold XP for Diamond mastery
const DIAMOND_XP_THRESHOLD = 300;

/**
 * Mapping des iconic_taxon_id vers les filtres de succès
 */
const ICONIC_TO_FILTER = {
  3: 'Aves',          // Birds
  20978: 'Amphibia',  // Amphibians
  26036: 'Reptilia',  // Reptiles
  40151: 'Mammalia',  // Mammals
  47178: 'Actinopterygii', // Fish (Marine)
  47115: 'Mollusca',  // Molluscs (Marine)
  47119: 'Arachnida', // Arachnids
  47158: 'Insecta',   // Insects
  47126: 'Plantae',   // Plants
  47170: 'Fungi',     // Fungi
};

/**
 * Calcule les statistiques de collection pour les succès
 * @returns {Promise<Object>} collectionStats pour checkNewAchievements
 */
export async function getCollectionStatsForAchievements() {
  try {
    const result = {
      totalSpeciesSeen: 0,
      diamondMasteryCount: 0,
      taxonomyCounts: {
        Aves: 0,
        Plantae: 0,
        Insecta: 0,
        Fungi: 0,
        Reptilia: 0,
        Amphibia: 0,
        Mammalia: 0,
        Actinopterygii: 0,
        Mollusca: 0,
        Marine: 0,
      },
      familyReunionComplete: false,
      familyMasteryCounts: {}, // { familyId: count } pour 5 espèces de même famille
    };

    // Compter le total d'espèces vues (stats table entries)
    result.totalSpeciesSeen = await statsTable.count();

    // Compter les espèces avec maîtrise Diamond (xp >= 300)
    const diamondStats = await statsTable
      .filter(stat => (stat.xp || 0) >= DIAMOND_XP_THRESHOLD)
      .count();
    result.diamondMasteryCount = diamondStats;

    // Compter par taxonomie (utilise l'index iconic_taxon_id)
    // Pour éviter de charger toutes les données, on fait des requêtes groupées
    for (const [iconicId, filterName] of Object.entries(ICONIC_TO_FILTER)) {
      const iconicIdNum = parseInt(iconicId, 10);
      const count = await statsTable
        .where('iconic_taxon_id')
        .equals(iconicIdNum)
        .count();
      result.taxonomyCounts[filterName] = count;
    }

    // Marine = Fish + Mollusques
    result.taxonomyCounts.Marine = 
      result.taxonomyCounts.Actinopterygii + 
      result.taxonomyCounts.Mollusca;

    // Vérifier FAMILY_REUNION: 5 espèces de la même famille maîtrisées (Diamond)
    // Cette vérification est plus complexe et nécessite les ancestor_ids
    const familyMasteryComplete = await checkFamilyReunion();
    result.familyReunionComplete = familyMasteryComplete;

    return result;
  } catch (error) {
    console.error('[AchievementStatsService] Failed to get collection stats:', error);
    return {
      totalSpeciesSeen: 0,
      diamondMasteryCount: 0,
      taxonomyCounts: {},
      familyReunionComplete: false,
    };
  }
}

/**
 * Vérifie si le joueur a maîtrisé 5 espèces de la même famille
 * @returns {Promise<boolean>}
 */
async function checkFamilyReunion() {
  try {
    // Récupérer toutes les stats avec maîtrise Diamond
    const masteredStats = await statsTable
      .filter(stat => (stat.xp || 0) >= DIAMOND_XP_THRESHOLD)
      .toArray();

    if (masteredStats.length < 5) {
      return false;
    }

    // Récupérer les taxons correspondants pour avoir les ancestor_ids
    const taxonIds = masteredStats.map(s => s.id);
    const taxa = await taxaTable.bulkGet(taxonIds);

    // Compter les espèces par famille (rank = family dans ancestors)
    const familyCounts = {};

    for (const taxon of taxa) {
      if (!taxon || !Array.isArray(taxon.ancestor_ids)) continue;

      // Chercher l'ancêtre de rang "family" dans la DB
      // On charge les ancêtres pour trouver la famille
      const ancestors = await taxaTable.bulkGet(taxon.ancestor_ids);
      const familyAncestor = ancestors.find(a => a?.rank === 'family');
      
      if (familyAncestor) {
        familyCounts[familyAncestor.id] = (familyCounts[familyAncestor.id] || 0) + 1;
        
        // Dès qu'on trouve 5, on retourne true
        if (familyCounts[familyAncestor.id] >= 5) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[AchievementStatsService] Failed to check family reunion:', error);
    return false;
  }
}

/**
 * Récupère les comptages taxonomiques pour un joueur
 * Version optimisée qui utilise les indexes
 * @returns {Promise<Object>} { Aves: N, Plantae: N, ... }
 */
export async function getTaxonomyCounts() {
  const counts = {};

  for (const [iconicId, filterName] of Object.entries(ICONIC_TO_FILTER)) {
    const iconicIdNum = parseInt(iconicId, 10);
    counts[filterName] = await statsTable
      .where('iconic_taxon_id')
      .equals(iconicIdNum)
      .count();
  }

  // Marine combiné
  counts.Marine = (counts.Actinopterygii || 0) + (counts.Mollusca || 0);

  return counts;
}

/**
 * Vérifie si le joueur a joué le weekend (samedi ET dimanche)
 * @param {Object} stats - Stats du profil
 * @param {Date} gameDate - Date de la partie
 * @returns {boolean} true si weekend warrior est complété cette semaine
 */
export function checkWeekendWarrior(stats, gameDate = new Date()) {
  const dayOfWeek = gameDate.getDay(); // 0 = Sunday, 6 = Saturday
  const lastPlayedDays = stats?.lastPlayedDays || [];
  
  // Ajouter le jour actuel s'il n'est pas déjà présent
  const updatedDays = [...new Set([...lastPlayedDays, dayOfWeek])];
  
  // Vérifier si samedi (6) ET dimanche (0) sont présents
  const hasSaturday = updatedDays.includes(6);
  const hasSunday = updatedDays.includes(0);
  
  return hasSaturday && hasSunday;
}

/**
 * Met à jour les stats de weekend warrior après une partie
 * @param {Object} stats - Stats du profil
 * @param {Date} gameDate - Date de la partie
 * @returns {Object} Stats mises à jour
 */
export function updateWeekendStats(stats, gameDate = new Date()) {
  const dayOfWeek = gameDate.getDay();
  const lastPlayedDays = stats?.lastPlayedDays || [];
  
  // Réinitialiser si on est lundi (nouveau week-end)
  const shouldReset = dayOfWeek === 1 && lastPlayedDays.length > 0;
  
  const updatedDays = shouldReset 
    ? [dayOfWeek]
    : [...new Set([...lastPlayedDays, dayOfWeek])];
  
  return {
    ...stats,
    lastPlayedDays: updatedDays,
    weekendWarriorCompleted: checkWeekendWarrior({ lastPlayedDays: updatedDays }),
  };
}

export default {
  getCollectionStatsForAchievements,
  getTaxonomyCounts,
  checkWeekendWarrior,
  updateWeekendStats,
};
