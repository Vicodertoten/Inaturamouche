import { useState, useCallback, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AchievementModal from './AchievementModal';
import HelpModal from './HelpModal';
import PreferencesMenu from './PreferencesMenu';
import ToastContainer from './ToastContainer';
import BottomNavigationBar from './BottomNavigationBar';
import { CollectionIcon, ProfileIcon as SharedProfileIcon, HelpIcon } from './NavigationIcons';
import titleImage from '../assets/inaturamouche-title.png';
import logoImage from '../assets/inaturamouche-logo.webp';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';

// Use shared icons for consistent desktop/mobile appearance

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGameActive, isGameOver, resetToLobby } = useGameData();
  const { achievementQueue, popAchievement } = useUser();
  const { t } = useLanguage();
  const [isHelpVisible, setIsHelpVisible] = useState(() => !localStorage.getItem('home_intro_seen'));
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const closeHelp = useCallback(() => {
    localStorage.setItem('home_intro_seen', '1');
    setIsHelpVisible(false);
  }, []);

  const handleTitleClick = useCallback(() => {
    if (isGameActive || isGameOver) {
      resetToLobby(true);
    }
    navigate('/');
  }, [isGameActive, isGameOver, navigate, resetToLobby]);

  const showHelp = useCallback(() => setIsHelpVisible(true), []);

  const showProfile = useCallback(() => {
    if (location.pathname !== '/profile') navigate('/profile');
  }, [location.pathname, navigate]);

  const togglePreferences = useCallback(() => {
    setIsPreferencesOpen((prev) => !prev);
  }, []);

  const outletContext = useMemo(() => ({ showHelp }), [showHelp]);

  return (
    <div className="App">
      {isHelpVisible && <HelpModal onClose={closeHelp} />}
      {achievementQueue[0] && (
        <AchievementModal achievementId={achievementQueue[0]} onClose={popAchievement} />
      )}
      <ToastContainer />

      {/* Desktop Navigation (Top Right) - Hidden on Mobile */}
      <nav className="main-nav desktop-nav" aria-label={t('nav.main_label', {}, 'Navigation principale')}>
        <div className="main-nav-items">
          <button
            className="nav-pill nav-icon nav-elevated"
            onClick={showHelp}
            aria-label={t('nav.help_label')}
            title={t('nav.help_label')}
            type="button"
          >
            <HelpIcon />
          </button>
          <button
            className="nav-pill nav-icon nav-elevated"
            onClick={() => navigate('/collection')}
            aria-label={t('nav.collection_label')}
            title={t('nav.collection_label')}
            type="button"
          >
            <CollectionIcon />
          </button>
          <button
            className="profile-button nav-pill nav-icon nav-elevated"
            onClick={showProfile}
            aria-label={t('nav.profile_label')}
            title={t('nav.profile_label')}
            type="button"
          >
            <SharedProfileIcon />
          </button>
          <PreferencesMenu />
        </div>
      </nav>

      {/* Preferences Menu - Shared between desktop and mobile */}
      <PreferencesMenu isOpen={isPreferencesOpen} onToggle={togglePreferences} isMobileControlled />

      {/* Mobile Bottom Navigation - Hidden on Desktop */}
      <BottomNavigationBar onSettingsClick={togglePreferences} isSettingsOpen={isPreferencesOpen} />

      <header className="app-header">
        <img
          src={titleImage}
          alt={t('nav.title_alt')}
          className="app-title-image app-title-wide clickable"
          onClick={handleTitleClick}
          title={t('nav.title_tooltip')}
          decoding="async"
          width={1228}
          height={383}
        />
        <img
          src={logoImage}
          alt={t('nav.title_alt')}
          className="app-title-image app-title-compact clickable"
          onClick={handleTitleClick}
          title={t('nav.title_tooltip')}
          decoding="async"
          fetchPriority="high"
          width={105}
          height={105}
        />
      </header>

      <main className="screen-container">
        <Outlet context={outletContext} />
      </main>
    </div>
  );
};

export default AppLayout;
