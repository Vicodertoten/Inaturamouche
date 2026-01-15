import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import '../styles/BottomNavigationBar.css';

const HomeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const CollectionIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
  </svg>
);

const ProfileIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l1.72-1.35c.15-.12.19-.34.1-.51l-1.63-2.83c-.12-.22-.37-.29-.59-.22l-2.03.81c-.42-.32-.9-.6-1.44-.81l-.3-2.16c-.04-.24-.24-.41-.48-.41h-3.26c-.24 0-.43.17-.47.41l-.3 2.16c-.54.21-1.02.49-1.44.81l-2.03-.81c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.22-.08.44.1.51l1.72 1.35c-.05.3-.07.62-.07.94s.02.64.07.94l-1.72 1.35c-.15.12-.19.34-.1.51l1.63 2.83c.12.22.37.29.59.22l2.03-.81c.42.32.9.6 1.44.81l.3 2.16c.04.24.24.41.48.41h3.26c.24 0 .43-.17.47-.41l.3-2.16c.54-.21 1.02-.49 1.44-.81l2.03.81c.22.09.47 0 .59-.22l1.63-2.83c.12-.22.08-.44-.1-.51l-1.72-1.35zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
    />
  </svg>
);

const BottomNavigationBar = ({ onNavigationChange, onSettingsClick, isSettingsOpen = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: '/', icon: HomeIcon, label: t('nav.home_label', {}, 'Accueil'), type: 'route' },
    { path: '/collection', icon: CollectionIcon, label: t('nav.collection_label'), type: 'route' },
    { path: '/profile', icon: ProfileIcon, label: t('nav.profile_label'), type: 'route' },
    { path: 'settings', icon: SettingsIcon, label: t('nav.settings_label', {}, 'Réglages'), type: 'action' },
  ];

  const handleNavClick = (item) => {
    if (item.type === 'action' && item.path === 'settings') {
      // Trigger settings menu instead of navigating
      if (onSettingsClick) onSettingsClick();
    } else {
      navigate(item.path);
      if (onNavigationChange) onNavigationChange(item.path);
    }
  };

  return (
    <nav className="bottom-nav" aria-label={t('nav.main_label', {}, 'Navigation')}>
      <div className="bottom-nav-container">
        {navItems.map((item) => {
          const { path, icon: Icon, label, type } = item;
          const isActive = type === 'route' 
            ? location.pathname === path 
            : (type === 'action' && path === 'settings' && isSettingsOpen);
          return (
            <button
              key={path}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item)}
              aria-label={label}
              title={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon />
              <span className="bottom-nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigationBar;
