import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import '../styles/BottomNavigationBar.css';
import { HomeIcon, CollectionIcon, ProfileIcon, SettingsIcon } from './NavigationIcons';

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
