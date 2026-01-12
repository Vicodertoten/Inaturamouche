// src/services/PlayerProfile.js
import { notify } from './notifications.js';

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
    speciesMastery: {}, // ex: { taxonId: { correct: n } }
    missedSpecies: [],
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

    // Migration de l'ancienne structure speciesMastery (stockant un nombre)
    if (finalProfile.stats.speciesMastery) {
      Object.entries(finalProfile.stats.speciesMastery).forEach(([id, val]) => {
        if (typeof val === 'number') {
          finalProfile.stats.speciesMastery[id] = { correct: val };
        } else {
          finalProfile.stats.speciesMastery[id] = { correct: val.correct || 0 };
        }
      });
    }

    // Normalisation de la liste des espèces ratées (suppression doublons + conversion en nombres)
    if (Array.isArray(finalProfile.stats.missedSpecies)) {
      const normalized = finalProfile.stats.missedSpecies
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id));
      finalProfile.stats.missedSpecies = Array.from(new Set(normalized));
    } else {
      finalProfile.stats.missedSpecies = [];
    }
    // On supprime l'ancienne clé totalScore pour faire le ménage
    delete finalProfile.totalScore;

    return finalProfile;

  } catch (error) {
    notify("Impossible de charger le profil.", { type: "error" });
    return getDefaultProfile();
  }
};

// Sauvegarder le profil dans le localStorage
export const saveProfile = (profile) => {
  try {
    const profileJson = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, profileJson);
  } catch (error) {
    notify("Impossible de sauvegarder le profil.", { type: "error" });
  }
};

// Supprimer complètement le profil sauvegardé
export const resetProfile = () => {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (error) {
    notify("Impossible de reinitialiser le profil.", { type: "error" });
  }
};
