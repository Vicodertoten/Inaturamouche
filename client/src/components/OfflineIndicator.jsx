import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import '../styles/OfflineIndicator.css';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { t } = useLanguage();
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Hide "back online" message after 3 seconds
      timeoutRef.current = setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
      // Clear timeout when going offline
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Cleanup timeout on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
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
