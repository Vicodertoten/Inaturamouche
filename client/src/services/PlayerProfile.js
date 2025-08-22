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
    speciesMastery: {}, // ex: { taxonId: count, ... }
    packsPlayed: {}
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
