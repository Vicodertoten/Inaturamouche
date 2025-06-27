export const ACHIEVEMENTS = {
  // --- Succès de progression ---
  'first_game': {
    title: 'Premier Pas',
    description: 'Terminer votre toute première partie.'
  },
  'ten_games': {
    title: 'Habitué',
    description: 'Terminer 10 parties.'
  },

  // --- Succès de performance ---
  'high_score_10k': {
    title: 'Naturaliste Aguerri',
    description: 'Atteindre un score total de 10 000 points.'
  },
  'perfect_game_easy': {
    title: 'Parfait !',
    description: 'Terminer une partie en mode facile avec 100% de bonnes réponses.'
  },

  // --- Succès thématiques ---
  'bird_watcher_10': {
    title: 'Ornithologue en Herbe',
    description: 'Identifier correctement 10 oiseaux (toutes parties confondues).'
  },
  'mycologist_apprentice': {
    title: 'Apprenti Mycologue',
    description: 'Jouer 5 fois avec le pack "Champignons d\'Europe".'
  },
  'globetrotter': {
    title: 'Globe-trotter',
    description: 'Jouer à 3 packs de jeu différents.'
  }
};

// Fonction qui vérifie si de nouveaux succès sont débloqués
export const checkNewAchievements = (profile) => {
    const unlocked = [];
    const { totalScore, stats } = profile;

    if (stats.gamesPlayed >= 1 && !profile.achievements.includes('first_game')) unlocked.push('first_game');
    if (stats.gamesPlayed >= 10 && !profile.achievements.includes('ten_games')) unlocked.push('ten_games');
    if (totalScore >= 10000 && !profile.achievements.includes('high_score_10k')) unlocked.push('high_score_10k');
    if (Object.keys(stats.packsPlayed).length >= 3 && !profile.achievements.includes('globetrotter')) unlocked.push('globetrotter');

    return unlocked; // Retourne un tableau des IDs des nouveaux succès
};