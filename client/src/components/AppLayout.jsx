import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PreferencesMenu from './PreferencesMenu';
import ToastContainer from './ToastContainer';
import BottomNavigationBar from './BottomNavigationBar';
import { CollectionIcon, ProfileIcon as SharedProfileIcon } from './NavigationIcons';
import Footer from './Footer';
import titleImage from '../assets/inaturaquizz-title.webp';
import logoImage from '../assets/inaturaquizz-logo.webp';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePageMeta } from '../hooks/usePageMeta';

// Use shared icons for consistent desktop/mobile appearance
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';
const ReportModal = lazy(() => import('./ReportModal'));
const HelpCenterModal = lazy(() => import('./HelpCenterModal'));
const AchievementModal = lazy(() => import('./AchievementModal'));

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGameActive, isGameOver, resetToLobby } = useGameData();
  const { achievementQueue, popAchievement } = useUser();
  const { t, language } = useLanguage();
  const [isReportVisible, setIsReportVisible] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  });

  const handleTitleClick = useCallback(() => {
    if (isGameActive || isGameOver) {
      resetToLobby(true);
    }
    navigate('/');
  }, [isGameActive, isGameOver, navigate, resetToLobby]);

  const handleTitleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTitleClick();
    }
  }, [handleTitleClick]);

  const showReport = useCallback(() => setIsReportVisible(true), []);
  const closeReport = useCallback(() => setIsReportVisible(false), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);

  const showProfile = useCallback(() => {
    if (location.pathname !== '/profile') navigate('/profile');
  }, [location.pathname, navigate]);

  const isCompactFooter = location.pathname === '/play';

  const togglePreferences = useCallback(() => {
    setIsPreferencesOpen((prev) => !prev);
  }, []);

  const outletContext = useMemo(() => ({ showReport }), [showReport]);

  const pageMeta = useMemo(() => {
    const path = location.pathname || '/';
    if (path === '/') {
      return {
        title: t('seo.home.title', {}, 'iNaturaQuizz - Quiz nature interactif'),
        description: t(
          'seo.home.description',
          {},
          "Quiz nature interactif pour apprendre à reconnaître animaux, plantes et champignons à partir d'observations réelles iNaturalist."
        ),
        robots: 'index,follow,max-image-preview:large',
        canonicalPath: '/',
      };
    }
    if (path === '/legal') {
      return {
        title: t('seo.legal.title', {}, 'Mentions légales - iNaturaQuizz'),
        description: t(
          'seo.legal.description',
          {},
          "Mentions légales, conditions d'utilisation et politique de confidentialité d'iNaturaQuizz."
        ),
        robots: 'index,follow,max-image-preview:large',
        canonicalPath: '/legal',
      };
    }
    if (path === '/collection') {
      return {
        title: t('seo.collection.title', {}, 'Collection - iNaturaQuizz'),
        description: t('seo.collection.description', {}, 'Consulte ta collection naturaliste et ta progression.'),
        robots: 'noindex,nofollow',
        canonicalPath: '/collection',
      };
    }
    if (path === '/profile') {
      return {
        title: t('seo.profile.title', {}, 'Profil - iNaturaQuizz'),
        description: t('seo.profile.description', {}, 'Gère ton profil, tes statistiques et tes récompenses.'),
        robots: 'noindex,nofollow',
        canonicalPath: '/profile',
      };
    }
    if (path.startsWith('/challenge/')) {
      return {
        title: t('seo.challenge.title', {}, 'Défi - iNaturaQuizz'),
        description: t('seo.challenge.description', {}, 'Relève un défi iNaturaQuizz.'),
        robots: 'noindex,nofollow',
        canonicalPath: '/challenge',
      };
    }
    if (path.startsWith('/collection/share/')) {
      return {
        title: t('seo.collection_share.title', {}, 'Collection partagée - iNaturaQuizz'),
        description: t('seo.collection_share.description', {}, "Découvre la collection partagée d'un joueur iNaturaQuizz."),
        robots: 'noindex,nofollow',
        canonicalPath: '/collection/share',
      };
    }
    if (path === '/play') {
      return {
        title: t('seo.play.title', {}, 'Partie en cours - iNaturaQuizz'),
        description: t('seo.play.description', {}, 'Session de quiz nature en cours.'),
        robots: 'noindex,nofollow',
        canonicalPath: '/play',
      };
    }
    if (path === '/end') {
      return {
        title: t('seo.end.title', {}, 'Résultats - iNaturaQuizz'),
        description: t('seo.end.description', {}, 'Résumé de ta partie iNaturaQuizz.'),
        robots: 'noindex,nofollow',
        canonicalPath: '/end',
      };
    }
    return {
      title: 'iNaturaQuizz',
      description: t(
        'seo.default.description',
        {},
        'Quiz nature interactif basé sur les données iNaturalist.'
      ),
      robots: 'index,follow,max-image-preview:large',
      canonicalPath: path,
    };
  }, [location.pathname, t]);

  usePageMeta({
    title: pageMeta.title,
    description: pageMeta.description,
    robots: pageMeta.robots,
    canonicalPath: pageMeta.canonicalPath,
    language,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handleChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return (
    <div className="App">
      {isReportVisible && (
        <Suspense fallback={null}>
          <ReportModal onClose={closeReport} />
        </Suspense>
      )}
      {isHelpOpen && (
        <Suspense fallback={null}>
          <HelpCenterModal isOpen={isHelpOpen} onClose={closeHelp} />
        </Suspense>
      )}
      {achievementQueue[0] && (
        <Suspense fallback={null}>
          <AchievementModal achievementId={achievementQueue[0]} onClose={popAchievement} />
        </Suspense>
      )}
      <ToastContainer />
      {/* Desktop Navigation (Top Right) - Hidden on Mobile */}
      <nav className="main-nav desktop-nav tutorial-main-nav" aria-label={t('nav.main_label', {}, 'Navigation principale')}>
        <div className="main-nav-items">
          <button
            className="nav-pill nav-icon nav-elevated tutorial-nav-collection"
            onClick={() => navigate('/collection')}
            aria-label={t('nav.collection_label')}
            title={t('nav.collection_label')}
            type="button"
          >
            <CollectionIcon />
          </button>
          <button
            className="profile-button nav-pill nav-icon nav-elevated tutorial-nav-profile"
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
      <BottomNavigationBar
        onSettingsClick={togglePreferences}
        isSettingsOpen={isPreferencesOpen}
      />

      <header className="app-header">
        {!isMobileViewport ? (
          <img
            src={titleImage}
            alt={t('nav.title_alt')}
            className="app-title-image app-title-wide clickable"
            onClick={handleTitleClick}
            onKeyDown={handleTitleKeyDown}
            role="button"
            tabIndex={0}
            title={t('nav.title_tooltip')}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            width={1228}
            height={383}
          />
        ) : (
          <img
            src={logoImage}
            alt={t('nav.title_alt')}
            className="app-title-image clickable"
            onClick={handleTitleClick}
            onKeyDown={handleTitleKeyDown}
            role="button"
            tabIndex={0}
            title={t('nav.title_tooltip')}
            loading="eager"
            decoding="async"
            width={105}
            height={105}
          />
        )}
      </header>

      <main className="screen-container">
        <Outlet context={outletContext} />
      </main>

      <Footer onReportClick={showReport} compact={isCompactFooter} />
    </div>
  );
};

export default AppLayout;
