// src/achievements.js

export const ACHIEVEMENTS = {
  first_game: {
    titleKey: 'achievements.list.first_game.title',
    descriptionKey: 'achievements.list.first_game.description',
  },
  ten_games: {
    titleKey: 'achievements.list.ten_games.title',
    descriptionKey: 'achievements.list.ten_games.description',
  },
  high_score_10k: {
    titleKey: 'achievements.list.high_score_10k.title',
    descriptionKey: 'achievements.list.high_score_10k.description',
  },
  globetrotter: {
    titleKey: 'achievements.list.globetrotter.title',
    descriptionKey: 'achievements.list.globetrotter.description',
  },
  LEVEL_5: {
    titleKey: 'achievements.list.LEVEL_5.title',
    descriptionKey: 'achievements.list.LEVEL_5.description',
  },
  LEVEL_10: {
    titleKey: 'achievements.list.LEVEL_10.title',
    descriptionKey: 'achievements.list.LEVEL_10.description',
  },
  ACCURACY_HARD_75: {
    titleKey: 'achievements.list.ACCURACY_HARD_75.title',
    descriptionKey: 'achievements.list.ACCURACY_HARD_75.description',
  },
  MASTER_5_SPECIES: {
    titleKey: 'achievements.list.MASTER_5_SPECIES.title',
    descriptionKey: 'achievements.list.MASTER_5_SPECIES.description',
  },
};

// Fonction qui vérifie si de nouveaux succès sont débloqués
export const checkNewAchievements = (profile) => {
    const unlocked = [];
    const { xp, stats, achievements } = profile;

    // Calcul du niveau pour les succès
    const currentLevel = Math.floor(0.1 * Math.sqrt(xp || 0));

    // Vérifications existantes (mises à jour)
    if (stats.gamesPlayed >= 1 && !achievements.includes('first_game')) unlocked.push('first_game');
    if (stats.gamesPlayed >= 10 && !achievements.includes('ten_games')) unlocked.push('ten_games');
    if (xp >= 10000 && !achievements.includes('high_score_10k')) unlocked.push('high_score_10k');
    if (Object.keys(stats.packsPlayed).length >= 3 && !achievements.includes('globetrotter')) unlocked.push('globetrotter');

    // NOUVELLES VÉRIFICATIONS
    if (currentLevel >= 5 && !achievements.includes('LEVEL_5')) unlocked.push('LEVEL_5');
    if (currentLevel >= 10 && !achievements.includes('LEVEL_10')) unlocked.push('LEVEL_10');
    
    if (stats.hardQuestionsAnswered >= 25 && (stats.correctHard / stats.hardQuestionsAnswered) >= 0.75 && !achievements.includes('ACCURACY_HARD_75')) {
      unlocked.push('ACCURACY_HARD_75');
    }

    const masteredSpeciesCount = Object.values(stats.speciesMastery || {})
      .filter(m => (m.correct || 0) >= 3).length;
    if (masteredSpeciesCount >= 5 && !achievements.includes('MASTER_5_SPECIES')) {
      unlocked.push('MASTER_5_SPECIES');
    }

    return unlocked; // Retourne un tableau des IDs des nouveaux succès
};
