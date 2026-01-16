import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import '../styles/OfflineIndicator.css';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Hide "back online" message after 3 seconds
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if online and never was offline
  if (isOnline && !wasOffline) return null;

  return (
    <div 
      className={`offline-banner ${isOnline ? 'online' : 'offline'}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="offline-banner-content">
        {isOnline ? (
          <>
            <span className="offline-icon">✓</span>
            <span>{t('offline.back_online') || 'Connexion rétablie'}</span>
          </>
        ) : (
          <>
            <span className="offline-icon">⚠</span>
            <span>{t('offline.no_connection') || 'Aucune connexion Internet'}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default OfflineIndicator;
