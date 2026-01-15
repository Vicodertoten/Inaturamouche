import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { active_session } from '../services/db';

const Configurator = lazy(() => import('../Configurator'));

// dailyChallengeLabel moved inside component to use translations

const LobbyPillars = ({ t, onSelectReview, canStartReview, missedCount }) => (
  <div className="lobby-pillars">
    <div className="lobby-pillar pillar-play">
      <div className="pillar-header">
        <p className="eyebrow">{t('home.play_pillar_title')}</p>
        <h3>{t('home.play_pillar_desc')}</h3>
        <p className="learn-tip">{t('home.easy_mode_description')}</p>
      </div>
    </div>
    <div className="lobby-pillar pillar-learn">
      <div className="pillar-header">
        <p className="eyebrow">{t('home.learn_pillar_title')}</p>
        <h3>{t('home.learn_pillar_desc')}</h3>
      </div>
      <div className="learn-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onSelectReview}
          disabled={!canStartReview}
        >
          {t('home.learn_action_review')}
        </button>
        <p className="learn-tip">
          {canStartReview ? t('home.learn_pillar_desc') : t('home.learn_action_review_disabled')}
        </p>
        {missedCount > 0 && (
          <div className="review-chip">
            <span className="review-count">{missedCount}</span>
            <span className="review-label">{t('common.review_mistakes')}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ReviewCard = ({ canStartReview, missedCount, onStartReview, t }) => (
  <div className="review-card">
    <div className="review-copy">
      <p className="review-label">{t('home.learn_pillar_title')}</p>
      <h3>{t('home.learn_action_review')}</h3>
      <p className="review-meta">
        {canStartReview ? t('home.learn_pillar_desc') : t('home.learn_action_review_disabled')}
      </p>
      <div className="review-chip">
        <p className="review-count">{missedCount}</p>
        <span className="review-label">{t('common.review_mistakes')}</span>
      </div>
    </div>
    <div className="review-actions">
      <button
        className="start-review-button"
        disabled={!canStartReview}
        onClick={onStartReview}
        type="button"
      >
        {t('common.review_mistakes')}
      </button>
    </div>
  </div>
);

const HomePage = () => {
  const navigate = useNavigate();
  const { startGame, resumeGame, clearSessionFromDB } = useGameData();
  const { t } = useLanguage();
  const dailyChallengeLabel = t('home.daily_challenge_label');
  
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resumeSessionData, setResumeSessionData] = useState(null);

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

  const handleStart = useCallback(
    ({ review = false, maxQuestions, mediaType } = {}) => {
      startGame({ review, maxQuestions, mediaType });
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
      <div className="home-dashboard card">
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
            <section className="daily-challenge-cta">
              <button
                type="button"
                className="btn btn--primary start-button"
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
