import React, { useState, useEffect, useCallback, useReducer } from 'react';

// --- CONFIGS & SERVICES (chemins standardisés) ---
import { PACKS } from './packs';
import { initialCustomFilters, customFilterReducer } from './state/filterReducer';
import { loadProfile, saveProfile } from './services/PlayerProfile';
import { checkNewAchievements, ACHIEVEMENTS } from './achievements';

// --- COMPOSANTS (chemins standardisés) ---
import Configurator from './Configurator';
import HardMode from './HardMode';
import EasyMode from './components/Easymode';
import EndScreen from './components/EndScreen';
import Spinner from './components/Spinner';
import ProfileModal from './components/ProfileModal';
import LanguageSwitcher from './components/LanguageSwitcher';
import titleImage from './assets/inaturamouche-title.png';

// --- STYLES ---
import './App.css';
import './HardMode.css';
import './components/ImageViewer.css'; 
import './configurator.css';
import './components/ProfileModal.css'; 

const MAX_QUESTIONS_PER_GAME = 5;

function App() {
  // --- ÉTATS ---
  const [language, setLanguage] = useState(() => localStorage.getItem('inaturamouche_lang') || 'fr');
  const [activePackId, setActivePackId] = useState('custom');
  const [customFilters, dispatch] = useReducer(customFilterReducer, initialCustomFilters);
  const [question, setQuestion] = useState(null);
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
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);

  // --- EFFETS ---
  useEffect(() => {
    setPlayerProfile(loadProfile());
  }, []);

    useEffect(() => {
    localStorage.setItem('inaturamouche_lang', language);
  }, [language]);

  const fetchQuestion = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const activePack = PACKS.find(p => p.id === activePackId);
      let queryParams = new URLSearchParams();

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
      
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${apiUrl}/api/quiz-question?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Une erreur est survenue.");
      }
      setQuestion(await response.json());
    } catch (err) { 
      setError(err.message); 
      setIsGameActive(false); 
      setIsGameOver(false); 
    } finally { 
      setLoading(false); 
    }
  }, [activePackId, customFilters]);

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
    setSessionStats({ correctAnswers: 0 });
    setNewlyUnlocked([]);
  };
  
  const returnToConfig = () => {
    setIsGameActive(false);
    setIsGameOver(false);
    setQuestionCount(0);
    setError(null);
  };

  const handleNextQuestion = (pointsGagnes = 0) => {
    const isCorrect = pointsGagnes > 0;
    
    setScore(prev => prev + pointsGagnes);
    if(isCorrect) {
      setSessionStats(prev => ({...prev, correctAnswers: prev.correctAnswers + 1}));
    }

    if (questionCount < MAX_QUESTIONS_PER_GAME) {
      setQuestionCount(prev => prev + 1);
      setQuestion(null);
    } else {
      const finalScore = score + pointsGagnes;
      const finalCorrectAnswers = sessionStats.correctAnswers + (isCorrect ? 1 : 0);
      const updatedProfile = { ...playerProfile };
      
      updatedProfile.totalScore += finalScore;
      updatedProfile.stats.gamesPlayed = (updatedProfile.stats.gamesPlayed || 0) + 1;
      updatedProfile.stats.packsPlayed[activePackId] = (updatedProfile.stats.packsPlayed[activePackId] || 0) + 1;
      updatedProfile.stats.questionsAnswered = (updatedProfile.stats.questionsAnswered || 0) + MAX_QUESTIONS_PER_GAME;
      if(gameMode === 'easy') updatedProfile.stats.correctEasy = (updatedProfile.stats.correctEasy || 0) + finalCorrectAnswers;
      else updatedProfile.stats.correctHard = (updatedProfile.stats.correctHard || 0) + finalCorrectAnswers;

      const unlockedIds = checkNewAchievements(updatedProfile);
      if (unlockedIds.length > 0) {
        updatedProfile.achievements.push(...unlockedIds);
        setNewlyUnlocked(unlockedIds);
        setTimeout(() => setNewlyUnlocked([]), 5000);
      }
      
      saveProfile(updatedProfile);
      setPlayerProfile(updatedProfile);
      setIsGameActive(false);
      setIsGameOver(true);
    }
  };

  // --- RENDU DU COMPOSANT ---
  return (
    <div className="App">
      {/* Affichage de la modale de profil si elle est visible */}
      {isProfileVisible && <ProfileModal profile={playerProfile} onClose={() => setIsProfileVisible(false)} />}
      
      {/* Notification de Succès */}
      {newlyUnlocked.length > 0 && (
        <div className="achievement-toast">
          🏆 Succès Débloqué !
          <p>{ACHIEVEMENTS[newlyUnlocked[0]].title}</p>
        </div>
      )}
      <nav className="main-nav">
          <button onClick={() => setIsProfileVisible(true)}>Mon Profil</button>
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
                ? <EasyMode question={question} score={score} questionCount={questionCount} onAnswer={(isCorrect) => handleNextQuestion(isCorrect ? 10 : 0)} />
                : <HardMode question={question} score={score} onNextQuestion={handleNextQuestion} onQuit={returnToConfig} />
            )
        ) : isGameOver ? (
          <EndScreen score={score} onRestart={startGame} />
        ) : (
          <div className="screen configurator-screen">
            <div className="card">
               <div className="mode-selector">
                  <h3>Choisir le mode :</h3>
                  <button onClick={() => setGameMode('easy')} className={gameMode === 'easy' ? 'active' : ''}>Facile</button>
                  <button onClick={() => setGameMode('hard')} className={gameMode === 'hard' ? 'active' : ''}>Difficile</button>
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
