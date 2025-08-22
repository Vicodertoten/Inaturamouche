// src/services/PlayerProfile.js

const PROFILE_KEY = 'inaturamouche_playerProfile';

// L'objet de profil par défaut pour un nouveau joueur ou pour mettre à jour un ancien profil
const getDefaultProfile = () => ({
  xp: 0,
  stats: {
    gamesPlayed: 0,
    easyQuestionsAnswered: 0,
    hardQuestionsAnswered: 0,
    correctEasy: 0,
    correctHard: 0,
    accuracyEasy: 0,
    accuracyHard: 0,
    // speciesMastery conserve désormais deux informations :
    // - correct : { taxonId: count, ... }
    // - failed  : [taxonId, ...]
    speciesMastery: { correct: {}, failed: [] },
    packsPlayed: {},
  },
  achievements: [],
});

// Charger le profil en fusionnant avec le profil par défaut pour la compatibilité
export const loadProfileWithDefaults = () => {
  try {
    const profileJson = localStorage.getItem(PROFILE_KEY);
    const loadedProfile = profileJson ? JSON.parse(profileJson) : {};

    const defaultProfile = getDefaultProfile();
    
    // Fusion profonde pour garantir que toutes les clés existent
    const finalProfile = {
      ...defaultProfile,
      ...loadedProfile,
      // On remplace totalScore par xp s'il existe
      xp: loadedProfile.totalScore || loadedProfile.xp || 0,
      stats: {
        ...defaultProfile.stats,
        ...(loadedProfile.stats || {}),
      },
    };
    // Migration de l'ancienne structure speciesMastery (objet simple)
    if (!finalProfile.stats.speciesMastery || Array.isArray(finalProfile.stats.speciesMastery)) {
      finalProfile.stats.speciesMastery = { correct: {}, failed: [] };
    } else if (!finalProfile.stats.speciesMastery.correct) {
      // l'ancien format était { taxonId: count, ... }
      const oldMastery = finalProfile.stats.speciesMastery;
      finalProfile.stats.speciesMastery = { correct: oldMastery, failed: [] };
    } else {
      finalProfile.stats.speciesMastery.correct = finalProfile.stats.speciesMastery.correct || {};
      finalProfile.stats.speciesMastery.failed = finalProfile.stats.speciesMastery.failed || [];
    }
    // Éviter les doublons et normaliser les IDs
    finalProfile.stats.speciesMastery.failed = [...new Set(
      finalProfile.stats.speciesMastery.failed.map(id => Number(id))
    )];
    // Migration des anciennes structures packsPlayed qui stockaient simplement un nombre
    if (finalProfile.stats.packsPlayed) {
      const migrated = {};
      Object.entries(finalProfile.stats.packsPlayed).forEach(([packId, data]) => {
        if (typeof data === 'number') {
          migrated[packId] = { correct: 0, answered: 0 };
        } else {
          migrated[packId] = {
            correct: data.correct || 0,
            answered: data.answered || 0,
          };
        }
      });
      finalProfile.stats.packsPlayed = migrated;
    }
    // On supprime l'ancienne clé totalScore pour faire le ménage
    delete finalProfile.totalScore;

    return finalProfile;

  } catch (error) {
    console.error("Erreur lors du chargement du profil :", error);
    return getDefaultProfile();
  }
};

// Sauvegarder le profil dans le localStorage
export const saveProfile = (profile) => {
  try {
    const profileJson = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, profileJson);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du profil :", error);
  }
};

// Supprimer complètement le profil sauvegardé
export const resetProfile = () => {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du profil :", error);
  }
};
