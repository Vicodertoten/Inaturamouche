// src/achievements.js

export const ACHIEVEMENTS = {
  // --- Succès existants ---
  'first_game': { title: 'Premier Pas', description: 'Terminer votre toute première partie.' },
  'ten_games': { title: 'Habitué', description: 'Terminer 10 parties.' },
  'high_score_10k': { title: 'Naturaliste Aguerri', description: 'Atteindre un score total de 10 000 XP.' },
  'globetrotter': { title: 'Globe-trotter', description: 'Jouer à 3 packs de jeu différents.' },
  
  // --- NOUVEAUX SUCCÈS ---
  'LEVEL_5': { title: "Apprenti Naturaliste", description: "Atteindre le niveau 5." },
  'LEVEL_10': { title: "Naturaliste Confirmé", description: "Atteindre le niveau 10." },
  'ACCURACY_HARD_75': { title: "Expert du Terrain", description: "Atteindre 75% de précision en mode Difficile (min. 25 questions)." },
  'MASTER_5_SPECIES': { title: "Spécialiste", description: "Maîtriser 5 espèces différentes (3 bonnes réponses pour chacune)." }
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

    const masteredSpeciesCount = Object.values(stats.speciesMastery?.correct || {}).filter(count => count >= 3).length;
    if (masteredSpeciesCount >= 5 && !achievements.includes('MASTER_5_SPECIES')) {
      unlocked.push('MASTER_5_SPECIES');
    }

    return unlocked; // Retourne un tableau des IDs des nouveaux succès
};