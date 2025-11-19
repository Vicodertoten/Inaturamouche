import { useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AchievementModal from './AchievementModal';
import HelpModal from './HelpModal';
import LanguageSwitcher from './LanguageSwitcher';
import titleImage from '../assets/inaturamouche-title.png';
import { useGame } from '../context/GameContext';
import { useUser } from '../context/UserContext';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGameActive, isGameOver, resetToLobby } = useGame();
  const { achievementQueue, popAchievement, language, setLanguage } = useUser();
  const [isHelpVisible, setIsHelpVisible] = useState(() => !localStorage.getItem('home_intro_seen'));

  const closeHelp = useCallback(() => {
    localStorage.setItem('home_intro_seen', '1');
    setIsHelpVisible(false);
  }, []);

  const handleTitleClick = useCallback(() => {
    if (isGameActive || isGameOver) {
      resetToLobby(true);
      navigate('/');
    }
  }, [isGameActive, isGameOver, navigate, resetToLobby]);

  const showHelp = useCallback(() => setIsHelpVisible(true), []);

  const showProfile = useCallback(() => {
    if (location.pathname !== '/profile') navigate('/profile');
  }, [location.pathname, navigate]);

  const isTitleInteractive = isGameActive || isGameOver;

  return (
    <div className="App">
      {isHelpVisible && <HelpModal onClose={closeHelp} />}
      {achievementQueue[0] && (
        <AchievementModal achievementId={achievementQueue[0]} onClose={popAchievement} />
      )}

      <nav className="main-nav">
        <button className="help-button" onClick={showHelp} aria-label="Aide et informations">
          ?
        </button>
        <button className="profile-button" onClick={showProfile} aria-label="Mon Profil">
          <span className="profile-text">Mon Profil</span>
          <span className="profile-icon" aria-hidden="true">
            👤
          </span>
        </button>
        <LanguageSwitcher currentLanguage={language} onLanguageChange={setLanguage} />
      </nav>

      <header className="app-header">
        <img
          src={titleImage}
          alt="Titre Inaturamouche"
          className={`app-title-image ${isTitleInteractive ? 'clickable' : ''}`}
          onClick={isTitleInteractive ? handleTitleClick : undefined}
          title={isTitleInteractive ? 'Retour au menu principal' : ''}
          decoding="async"
          fetchpriority="high"
        />
      </header>

      <main className="screen-container">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;

