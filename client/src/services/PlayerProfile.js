const PROFILE_KEY = 'inaturamouche_playerProfile';

// L'objet de profil par défaut pour un nouveau joueur
const getDefaultProfile = () => ({
  totalScore: 0,
  stats: {
    gamesPlayed: 0,
    questionsAnswered: 0,
    correctEasy: 0,
    correctHard: 0,
    rankAccuracy: {},
    packsPlayed: {}
  },
  achievements: [],
});

// Charger le profil depuis le localStorage
export const loadProfile = () => {
  try {
    const profileJson = localStorage.getItem(PROFILE_KEY);
    return profileJson ? JSON.parse(profileJson) : getDefaultProfile();
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

// Fonction pour mettre à jour le profil après une partie
export const updateProfileAfterGame = (currentProfile, gameData) => {
  const newProfile = { ...currentProfile };

  // Mise à jour du score total
  newProfile.totalScore += gameData.score;
  
  // Mise à jour des statistiques générales
  newProfile.stats.gamesPlayed = (newProfile.stats.gamesPlayed || 0) + 1;
  newProfile.stats.questionsAnswered = (newProfile.stats.questionsAnswered || 0) + gameData.questionsPlayed;

  // Mise à jour des stats par mode de jeu
  if(gameData.mode === 'easy') {
    newProfile.stats.correctEasy = (newProfile.stats.correctEasy || 0) + gameData.correctAnswers;
  } else {
    newProfile.stats.correctHard = (newProfile.stats.correctHard || 0) + gameData.correctAnswers;
    // On pourrait aussi mettre à jour la précision par rang ici
  }

  // Mise à jour des packs joués
  const packId = gameData.packId;
  newProfile.stats.packsPlayed[packId] = (newProfile.stats.packsPlayed[packId] || 0) + 1;
  
  saveProfile(newProfile);
  return newProfile;
};