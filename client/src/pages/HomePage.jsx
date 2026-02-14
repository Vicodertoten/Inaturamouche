import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { active_session } from '../services/db';
import ReviewDashboardCard from '../components/ReviewDashboardCard';
import GettingStartedModal from '../components/GettingStartedModal';
import { getReviewStats } from '../services/CollectionService';
import { debugError, debugLog, debugWarn } from '../utils/logger';
import { getTodayDailySeed, isDailyCompleted, isDailySeedStale } from '../utils/dailyChallenge';

const Configurator = lazy(() => import('../features/configurator/Configurator'));

const HomePage = () => {
  const navigate = useNavigate();
  const { startGame, resumeGame, clearSessionFromDB, startReviewMode, gameMode, activePackId } = useGameData();
  const { profile, showTutorial } = useUser();
  const { t } = useLanguage();
  const dailyChallengeLabel = t('home.daily_challenge_label');
  const hasPickedPack = Boolean(activePackId) && activePackId !== 'custom';
  const hasChosenMode = Boolean(gameMode);
  const hasPlayedGame = (profile?.stats?.gamesPlayed || 0) > 0;
  
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resumeSessionData, setResumeSessionData] = useState(null);
  const [reviewStats, setReviewStats] = useState(null);
  const [isGettingStartedOpen, setIsGettingStartedOpen] = useState(false);

  const todaySeed = getTodayDailySeed();
  const dailyAlreadyCompleted = isDailyCompleted(todaySeed);

  // Vérifier s'il y a une session active au chargement de la page
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await active_session.get(1);
        if (session) {
          // If the session is a daily challenge from a previous day, discard it
          const sessionSeed = session.gameConfig?.dailySeed;
          if (sessionSeed && isDailySeedStale(sessionSeed)) {
            debugLog('[HomePage] Discarding stale daily session (seed: %s)', sessionSeed);
            await active_session.delete(1);
            setHasActiveSession(false);
            setResumeSessionData(null);
          } else {
            setHasActiveSession(true);
            setResumeSessionData(session);
          }
        } else {
          setHasActiveSession(false);
          setResumeSessionData(null);
        }
      } catch (err) {
        debugError('[HomePage] Error checking active session:', err);
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
        debugError('[HomePage] Failed to load review stats:', err);
      }
    };

    loadReviewStats();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasPlayedGame && !isCheckingSession && !showTutorial) {
      setIsGettingStartedOpen(true);
    } else {
      setIsGettingStartedOpen(false);
    }
  }, [hasPlayedGame, isCheckingSession, showTutorial]);

  // Don't show getting started until tutorial is done
  const shouldShowGettingStarted = !hasPlayedGame && !isCheckingSession && !showTutorial;

  const handleStart = useCallback(
    ({ maxQuestions, mediaType } = {}) => {
      startGame({ maxQuestions, mediaType });
      navigate('/play');
    },
    [navigate, startGame]
  );

  const handleResumeGame = useCallback(async () => {
    debugLog('[HomePage] Starting resume game...');
    const sessionData = await resumeGame();
    debugLog('[HomePage] Resume game completed');
    if (sessionData) {
      // Petit délai pour laisser React traiter les state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      debugLog('[HomePage] Navigating to /play');
      navigate('/play');
    } else {
      debugWarn('[HomePage] No session data returned from resumeGame');
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
    // Guard: already completed today
    if (isDailyCompleted(todaySeed)) return;

    // If there's already an in-progress daily session for today, resume it instead
    if (hasActiveSession && resumeSessionData?.gameConfig?.dailySeed === todaySeed) {
      handleResumeGame();
      return;
    }

    // Use the seed itself as session ID so every user shares the same server-side state
    const seedSession = todaySeed;
    startGame({ seed: todaySeed, seed_session: seedSession, gameMode: 'hard', maxQuestions: 10 });
    navigate('/play');
  }, [navigate, startGame, todaySeed, hasActiveSession, resumeSessionData, handleResumeGame]);

  return (
    <div className="screen configurator-screen">
      <GettingStartedModal
        isOpen={isGettingStartedOpen && shouldShowGettingStarted}
        onClose={() => setIsGettingStartedOpen(false)}
        hasChosenMode={hasChosenMode}
        hasPickedPack={hasPickedPack}
        hasPlayedGame={hasPlayedGame}
        onStartGame={handleStart}
      />
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
                className={`btn start-button play-btn tutorial-daily-challenge ${dailyAlreadyCompleted ? 'btn--secondary' : 'btn--primary'}`}
                onClick={handleDailyChallenge}
                disabled={dailyAlreadyCompleted}
                aria-label={dailyChallengeLabel}
              >
                {dailyAlreadyCompleted
                  ? (t('home.daily_challenge_done') || '✅ Défi du jour terminé')
                  : dailyChallengeLabel}
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
