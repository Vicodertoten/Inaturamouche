import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { active_session } from '../services/db';
import ReviewDashboardCard from '../components/ReviewDashboardCard';
import { getReviewStats } from '../services/CollectionService';

const Configurator = lazy(() => import('../features/configurator/Configurator'));

const HomePage = () => {
  const navigate = useNavigate();
  const { startGame, resumeGame, clearSessionFromDB, startReviewMode } = useGameData();
  const { t } = useLanguage();
  const dailyChallengeLabel = t('home.daily_challenge_label');
  
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resumeSessionData, setResumeSessionData] = useState(null);
  const [reviewStats, setReviewStats] = useState(null);

  // Vérifier s'il y a une session active au chargement de la page
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await active_session.get(1);
        if (session) {
          setHasActiveSession(true);
          setResumeSessionData(session);
        } else {
          setHasActiveSession(false);
          setResumeSessionData(null);
        }
      } catch (err) {
        console.error('[HomePage] Error checking active session:', err);
        setHasActiveSession(false);
        setResumeSessionData(null);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
    
    // Écouter les changements de visibilité pour recharger la session si l'onglet redevient visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReviewStats = async () => {
      try {
        const stats = await getReviewStats();
        if (isMounted) {
          setReviewStats(stats);
        }
      } catch (err) {
        console.error('[HomePage] Failed to load review stats:', err);
      }
    };

    loadReviewStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStart = useCallback(
    ({ maxQuestions, mediaType } = {}) => {
      startGame({ maxQuestions, mediaType });
      navigate('/play');
    },
    [navigate, startGame]
  );

  const handleResumeGame = useCallback(async () => {
    console.log('[HomePage] Starting resume game...');
    const sessionData = await resumeGame();
    console.log('[HomePage] Resume game completed, session data:', sessionData);
    if (sessionData) {
      // Petit délai pour laisser React traiter les state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[HomePage] Navigating to /play');
      navigate('/play');
    } else {
      console.warn('[HomePage] No session data returned from resumeGame');
    }
  }, [navigate, resumeGame]);

  const handleStartReview = useCallback(async () => {
    const started = await startReviewMode();
    if (started) {
      navigate('/play');
    }
    return started;
  }, [navigate, startReviewMode]);

  const handleAbandonSession = useCallback(async () => {
    await clearSessionFromDB();
    setHasActiveSession(false);
  }, [clearSessionFromDB]);

  const handleDailyChallenge = useCallback(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const dailySeed = `${year}-${month}-${day}`;
    // On ajoute un ID de session pour forcer le serveur à repartir de la question 1
    const seedSession = Date.now().toString();

    startGame({ seed: dailySeed, seed_session: seedSession, gameMode: 'hard', maxQuestions: 10 });
    navigate('/play');
  }, [navigate, startGame]);

  return (
    <div className="screen configurator-screen">
      <div className="home-dashboard card tutorial-home-dashboard">
        
        
        {/* Afficher le bouton "Reprendre la partie" si une session est active */}
        {hasActiveSession && !isCheckingSession && resumeSessionData && (
          <section className="resume-session-cta">
            <div className="resume-container">
              <div className="resume-header">
                <h3>{t('home.resume_game_title') || 'Reprendre votre partie'}</h3>
                <p className="resume-meta">
                  {resumeSessionData.currentQuestionIndex > 0
                    ? `${t('home.resume_game_meta') || 'Question'} ${resumeSessionData.currentQuestionIndex}${
                        resumeSessionData.gameConfig?.maxQuestions 
                          ? `/${resumeSessionData.gameConfig.maxQuestions}` 
                          : ''
                      }`
                    : t('home.resume_game_subtitle') || 'Vous avez une partie en cours'}
                </p>
              </div>
              <div className="resume-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--large resume-button"
                  onClick={handleResumeGame}
                >
                  {t('home.resume_game_button') || '▶ Reprendre'}
                </button>
                <button
                  type="button"
                  className="btn btn--tertiary abandon-button"
                  onClick={handleAbandonSession}
                  title={t('home.abandon_session_tooltip') || 'Supprimer cette partie'}
                >
                  {t('home.abandon_session') || 'Abandonner'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Afficher le mode normal si pas de session active */}
        {!hasActiveSession && !isCheckingSession && (
          <>
            {/* Zone prioritaire : Révision */}
            {reviewStats?.dueToday > 0 && (
              <section className="priority-section">
                <ReviewDashboardCard
                  dueToday={reviewStats.dueToday}
                  onStartReview={handleStartReview}
                />
              </section>
            )}

            <section className="daily-challenge-cta play-button-container">
              <button
                type="button"
                className="btn btn--primary start-button play-btn tutorial-daily-challenge"
                onClick={handleDailyChallenge}
                aria-label={dailyChallengeLabel}
              >
                {dailyChallengeLabel}
              </button>
            </section>

            <section className="configurator-shell">
              <Suspense
                fallback={
                  <div className="configurator-skeleton" aria-hidden="true">
                    <div className="skeleton-block"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                  </div>
                }
              >
                <Configurator onStartGame={handleStart} />
              </Suspense>
            </section>
          </>
        )}

        {/* Écran de chargement */}
        {isCheckingSession && (
          <div className="configurator-skeleton" aria-hidden="true">
            <div className="skeleton-block"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
