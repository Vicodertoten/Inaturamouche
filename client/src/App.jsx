// src/App.jsx

import React, { useState, useEffect, useCallback, useReducer } from 'react';

// --- CONFIGS & SERVICES (chemins standardisés) ---
import PACKS from '../../shared/packs.js';
import { initialCustomFilters, customFilterReducer } from './state/filterReducer';
import { loadProfileWithDefaults, saveProfile } from './services/PlayerProfile';
import { checkNewAchievements, ACHIEVEMENTS } from './achievements';
import { fetchQuizQuestion } from './services/api'; // NOUVEL IMPORT


// --- COMPOSANTS (chemins standardisés) ---
import Configurator from './Configurator';
import HardMode from './HardMode';
import EasyMode from './components/Easymode';
import EndScreen from './components/EndScreen';
import Spinner from './components/Spinner';
import HelpModal from './components/HelpModal';
import ProfileModal from './components/ProfileModal';
import titleImage from './assets/inaturamouche-title.png';

// --- STYLES ---
import './App.css';
import './HardMode.css';
import './components/ImageViewer.css'; 
import './configurator.css';
import './components/ProfileModal.css';
import './components/HelpModal.css'; 

const MAX_QUESTIONS_PER_GAME = 5;

function App() {
  // --- ÉTATS ---
  const [language] = useState(() => localStorage.getItem('inaturamouche_lang') || 'fr');
  const [activePackId, setActivePackId] = useState('custom');
  const [customFilters, dispatch] = useReducer(customFilterReducer, initialCustomFilters);
  const [question, setQuestion] = useState(null);
  const [nextQuestion, setNextQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correctAnswers: 0 });
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameMode, setGameMode] = useState('easy');
  const [playerProfile, setPlayerProfile] = useState(null);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(() => !localStorage.getItem('home_intro_seen'));
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const [sessionCorrectSpecies, setSessionCorrectSpecies] = useState([]);
  const [sessionSpeciesData, setSessionSpeciesData] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);

const handleProfileReset = () => {
  setPlayerProfile(loadProfileWithDefaults());
};

  const handleCloseHelp = () => {
    localStorage.setItem('home_intro_seen', '1');
    setIsHelpVisible(false);
  };

  // --- EFFETS ---
  useEffect(() => {
    setPlayerProfile(loadProfileWithDefaults());
  }, []);

  useEffect(() => {
    localStorage.setItem('inaturamouche_lang', language);
  }, [language]);

  const fetchQuestion = useCallback(async (prefetchOnly = false) => {
    if (!prefetchOnly) {
      setLoading(true);
      setError(null);
    }
    try {
      const activePack = PACKS.find(p => p.id === activePackId);
      let queryParams = new URLSearchParams();
      queryParams.set('locale', language); // On passe la langue à l'API

      if (activePack.type === 'list') {
        activePack.taxa_ids.forEach(id => queryParams.append('taxon_ids', id));
      } else if (activePack.type === 'dynamic') {
        queryParams.set('pack_id', activePack.id);
      } else { // 'custom'
        customFilters.includedTaxa.forEach(t => queryParams.append('include_taxa', t.id));
        customFilters.excludedTaxa.forEach(t => queryParams.append('exclude_taxa', t.id));
        if (customFilters.place_enabled) {
          queryParams.set('lat', customFilters.lat);
          queryParams.set('lng', customFilters.lng);
          queryParams.set('radius', customFilters.radius);
        }
        if (customFilters.date_enabled) {
          if(customFilters.d1) queryParams.set('d1', customFilters.d1);
          if(customFilters.d2) queryParams.set('d2', customFilters.d2);
        }
      }

      const questionData = await fetchQuizQuestion(queryParams);
      if (prefetchOnly) {
        setNextQuestion(questionData);
      } else {
        setQuestion(questionData);
        // Préchargement de la question suivante
        fetchQuestion(true);
      }
    } catch (err) {
      if (!prefetchOnly) {
        setError(err.message);
        setIsGameActive(false);
        setIsGameOver(false);
      }
    } finally {
      if (!prefetchOnly) {
        setLoading(false);
      }
    }
  }, [activePackId, customFilters, language]);

  useEffect(() => {
    if (isGameActive && !question && questionCount > 0 && !loading) {
      fetchQuestion();
    }
  }, [questionCount, isGameActive, question, loading, fetchQuestion]);


  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
  const startGame = () => {
    setScore(0);
    setQuestionCount(1);
    setIsGameActive(true);
    setIsGameOver(false);
    setError(null);
    setQuestion(null);
    setNextQuestion(null);
    setSessionStats({ correctAnswers: 0 });
    setNewlyUnlocked([]);
    setSessionCorrectSpecies([]);
    setSessionSpeciesData([]);
    setCurrentStreak(0);
  };

  const returnToConfig = () => {
    setIsGameActive(false);
    setIsGameOver(false);
    setQuestionCount(0);
    setError(null);
    setQuestion(null);
    setNextQuestion(null);
  };

  const updateScore = (delta) => {
    setScore(prev => prev + delta);
  };

  const handleNextQuestion = (pointsGagnes = 0, isCorrectParam = null) => {
    const isCorrect = isCorrectParam ?? (pointsGagnes > 0);
    const currentQuestionId = question.bonne_reponse.id; // On sauvegarde l'ID avant de changer de question
    setSessionSpeciesData(prev => [
      ...prev,
      {
        id: currentQuestionId,
        name: question.bonne_reponse.name,
        common_name: question.bonne_reponse.common_name,
        wikipedia_url: question.bonne_reponse.wikipedia_url,
        inaturalist_url: question.inaturalist_url,
      },
    ]);
    let bonus = 0;

    if (isCorrect) {
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      bonus = 2 * newStreak;
      setSessionStats(prev => ({ ...prev, correctAnswers: prev.correctAnswers + 1 }));
      setSessionCorrectSpecies(prev => [...prev, currentQuestionId]);
    } else {
      setCurrentStreak(0);
    }

    // Mise à jour des stats de la session en cours
    updateScore(pointsGagnes + bonus);

    // Si la partie n'est pas terminée, on passe à la question suivante
    if (questionCount < MAX_QUESTIONS_PER_GAME) {
      setQuestionCount(prev => prev + 1);
      if (nextQuestion) {
        setQuestion(nextQuestion);
        setNextQuestion(null);
        fetchQuestion(true);
      } else {
        setQuestion(null);
        fetchQuestion();
      }
    } else {
      // --- DÉBUT DU BLOC DE FIN DE PARTIE : C'EST ICI QUE TOUT SE JOUE ---
      // Ce bloc est maintenant la seule source de vérité pour la mise à jour du profil.
      
      const finalCorrectAnswersInSession = sessionStats.correctAnswers + (isCorrect ? 1 : 0);
      const finalScoreInGame = score + pointsGagnes + bonus;
      
      // On s'assure de travailler sur une copie fraîche du profil
      const updatedProfile = JSON.parse(JSON.stringify(playerProfile));
      
      // --- MISE À JOUR ATOMIQUE DES STATS ---
      // On garantit que les compteurs de bonnes réponses et de questions jouées
      // sont TOUJOURS mis à jour ensemble.
      
      updatedProfile.xp = (updatedProfile.xp || 0) + finalScoreInGame;
      updatedProfile.stats.gamesPlayed = (updatedProfile.stats.gamesPlayed || 0) + 1;

      if(gameMode === 'easy') {
        updatedProfile.stats.correctEasy = (updatedProfile.stats.correctEasy || 0) + finalCorrectAnswersInSession;
        updatedProfile.stats.easyQuestionsAnswered = (updatedProfile.stats.easyQuestionsAnswered || 0) + MAX_QUESTIONS_PER_GAME;
        updatedProfile.stats.accuracyEasy = updatedProfile.stats.easyQuestionsAnswered > 0
          ? updatedProfile.stats.correctEasy / updatedProfile.stats.easyQuestionsAnswered
          : 0;
      } else { // mode 'hard'
        updatedProfile.stats.correctHard = (updatedProfile.stats.correctHard || 0) + finalCorrectAnswersInSession;
        updatedProfile.stats.hardQuestionsAnswered = (updatedProfile.stats.hardQuestionsAnswered || 0) + MAX_QUESTIONS_PER_GAME;
        updatedProfile.stats.accuracyHard = updatedProfile.stats.hardQuestionsAnswered > 0
          ? updatedProfile.stats.correctHard / updatedProfile.stats.hardQuestionsAnswered
          : 0;
      }

      // Le reste de la logique pour la maîtrise, les packs et les succès
      const finalCorrectSpecies = isCorrect ? [...sessionCorrectSpecies, currentQuestionId] : sessionCorrectSpecies;
      if (!updatedProfile.stats.speciesMastery) updatedProfile.stats.speciesMastery = {};
      finalCorrectSpecies.forEach(speciesId => {
        updatedProfile.stats.speciesMastery[speciesId] = (updatedProfile.stats.speciesMastery[speciesId] || 0) + 1;
      });

      if (!updatedProfile.stats.packsPlayed) updatedProfile.stats.packsPlayed = {};
      if (!updatedProfile.stats.packsPlayed[activePackId]) {
        updatedProfile.stats.packsPlayed[activePackId] = { correct: 0, answered: 0 };
      }
      updatedProfile.stats.packsPlayed[activePackId].correct += finalCorrectAnswersInSession;
      updatedProfile.stats.packsPlayed[activePackId].answered += MAX_QUESTIONS_PER_GAME;

      const unlockedIds = checkNewAchievements(updatedProfile);
      if (unlockedIds.length > 0) {
        if(!updatedProfile.achievements) updatedProfile.achievements = [];
        updatedProfile.achievements.push(...unlockedIds);
        setNewlyUnlocked(unlockedIds);
        setTimeout(() => setNewlyUnlocked([]), 5000);
      }
      
      // On sauvegarde le profil mis à jour et on termine la partie
      saveProfile(updatedProfile);
      setPlayerProfile(updatedProfile);
      setIsGameActive(false);
      setIsGameOver(true);
      // --- FIN DU BLOC DE FIN DE PARTIE ---
    }
  };

  // --- RENDU DU COMPOSANT ---
  return (
    <div className="App">
      {isProfileVisible && (
        <ProfileModal
          profile={playerProfile}
          onClose={() => setIsProfileVisible(false)}
          onResetProfile={handleProfileReset}
        />
      )}
      {isHelpVisible && <HelpModal onClose={handleCloseHelp} />}
      
      {newlyUnlocked.length > 0 && (
        <div className="achievement-toast">
          🏆 Succès Débloqué !
          <p>{ACHIEVEMENTS[newlyUnlocked[0]].title}</p>
        </div>
      )}
      <nav className="main-nav">
          <button onClick={() => {
              setIsProfileVisible(true);
            }}>
            Mon Profil
          </button>
      </nav>
      <header className="app-header">
       <img 
          src={titleImage} 
          alt="Titre Inaturamouche" 
          className={`app-title-image ${isGameActive || isGameOver ? 'clickable' : ''}`}
          onClick={isGameActive || isGameOver ? returnToConfig : undefined}
          title={isGameActive || isGameOver ? 'Retour au menu principal' : ''}
        />
      </header>
      
      <main className="screen-container">
        {isGameActive ? (
          loading || !question 
            ? <Spinner /> 
            : ( gameMode === 'easy' 
                ? <EasyMode
                    question={question}
                    score={score}
                    questionCount={questionCount}
                    onAnswer={(isCorrect, points) => handleNextQuestion(points, isCorrect)}
                    onUpdateScore={updateScore}
                  />
                : <HardMode question={question} score={score} onNextQuestion={handleNextQuestion} onQuit={returnToConfig} />
            )
        ) : isGameOver ? (
          <EndScreen
            score={score}
            sessionStats={sessionStats}
            sessionCorrectSpecies={sessionCorrectSpecies}
            sessionSpeciesData={sessionSpeciesData}
            newlyUnlocked={newlyUnlocked}
            onRestart={startGame}
            onShowProfile={() => setIsProfileVisible(true)}
          />
        ) : (
          <div className="screen configurator-screen">
            <div className="card">
              <button
                className="help-button"
                onClick={() => setIsHelpVisible(true)}
                title="Aide et informations"
              >
                ?
              </button>
              <div className="mode-selector">
                    <h3>Choisir le mode :</h3>
                    <button
                      onClick={() => setGameMode('easy')}
                      className={gameMode === 'easy' ? 'active' : ''}
                      title="Mode facile : choix multiple"
                    >
                      Facile
                    </button>
                    <button
                      onClick={() => setGameMode('hard')}
                      className={gameMode === 'hard' ? 'active' : ''}
                      title="Mode difficile : réponse libre"
                    >
                      Difficile
                    </button>
                </div>
              <Configurator 
                onStartGame={startGame} 
                error={error}
                activePackId={activePackId}
                setActivePackId={setActivePackId}
                customFilters={customFilters}
                dispatch={dispatch}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
