import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import '../styles/BottomNavigationBar.css';
import { HomeIcon, CollectionIcon, ProfileIcon, LanguageIcon } from './NavigationIcons';

const BottomNavigationBar = ({
  onNavigationChange,
  onSettingsClick,
  isSettingsOpen = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Acceuil', type: 'route', tutorialClass: 'tutorial-nav-home' },
    { path: '/profile', icon: ProfileIcon, label: 'Profil', type: 'route', tutorialClass: 'tutorial-nav-profile' },
    { path: '/collection', icon: CollectionIcon, label: 'Collection', type: 'route', tutorialClass: 'tutorial-nav-collection' },
    { path: 'settings', icon: LanguageIcon, label: 'Langue', type: 'action', tutorialClass: 'tutorial-nav-settings' },
  ];

  const handleNavClick = (item) => {
    if (item.type === 'action' && item.path === 'settings') {
      if (onSettingsClick) onSettingsClick();
    } else {
      navigate(item.path);
      if (onNavigationChange) onNavigationChange(item.path);
    }
  };

  return (
    <nav className="bottom-nav tutorial-bottom-nav" aria-label={t('nav.main_label', {}, 'Navigation')}>
      <div className="bottom-nav-container">
        {navItems.map((item) => {
          const { path, icon: Icon, label, type, tutorialClass } = item;
          const isActive = type === 'route' 
            ? location.pathname === path 
            : (type === 'action' && path === 'settings' && isSettingsOpen);
          return (
            <button
              key={path}
              className={`bottom-nav-item ${isActive ? 'active' : ''} ${tutorialClass || ''}`}
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
