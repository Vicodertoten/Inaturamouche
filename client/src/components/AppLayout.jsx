import { useState, useCallback, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AchievementModal from './AchievementModal';
import HelpModal from './HelpModal';
import PreferencesMenu from './PreferencesMenu';
import titleImage from '../assets/inaturamouche-title.png';
import logoImage from '../assets/inaturamouche-logo.png';
import { useGame } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGameActive, isGameOver, resetToLobby } = useGame();
  const { achievementQueue, popAchievement } = useUser();
  const { t } = useLanguage();
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
  const outletContext = useMemo(() => ({ showHelp }), [showHelp]);

  return (
    <div className="App">
      {isHelpVisible && <HelpModal onClose={closeHelp} />}
      {achievementQueue[0] && (
        <AchievementModal achievementId={achievementQueue[0]} onClose={popAchievement} />
      )}

      <nav className="main-nav">
        <div className="nav-actions">
          <button
            className="nav-pill nav-icon nav-elevated"
            onClick={showHelp}
            aria-label={t('nav.help_label')}
            title={t('nav.help_label')}
            type="button"
          >
            ?
          </button>
          <button
            className="profile-button nav-pill nav-elevated"
            onClick={showProfile}
            aria-label={t('nav.profile_label')}
            title={t('nav.profile_label')}
            type="button"
          >
            <span className="profile-text">{t('common.profile')}</span>
            <span className="profile-icon" aria-hidden="true">
              👤
            </span>
          </button>
        </div>
        <PreferencesMenu />
      </nav>

      <header className="app-header">
        <img
          src={titleImage}
          alt={t('nav.title_alt')}
          className={`app-title-image app-title-wide ${isTitleInteractive ? 'clickable' : ''}`}
          onClick={isTitleInteractive ? handleTitleClick : undefined}
          title={isTitleInteractive ? t('nav.title_tooltip') : ''}
          decoding="async"
          fetchPriority="high"
        />
        <img
          src={logoImage}
          alt={t('nav.title_alt')}
          className={`app-title-image app-title-compact ${isTitleInteractive ? 'clickable' : ''}`}
          onClick={isTitleInteractive ? handleTitleClick : undefined}
          title={isTitleInteractive ? t('nav.title_tooltip') : ''}
          decoding="async"
          fetchPriority="high"
        />
      </header>

      <main className="screen-container">
        <Outlet context={outletContext} />
      </main>
    </div>
  );
};

export default AppLayout;
