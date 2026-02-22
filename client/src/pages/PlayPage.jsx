import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HardMode from '../features/quiz/components/HardMode';
import EasyMode from '../components/Easymode';
import QuestionSkeleton from '../components/QuestionSkeleton';
import RarityCelebration from '../components/RarityCelebration';
import { useGameData, useGameUI } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './PlayPage.css';

const PlayPage = () => {
  const navigate = useNavigate();
  const {
    isGameActive,
    isGameOver,
    question,
    gameMode,
    maxQuestions,
    mediaType,
    isReviewMode,
    startGame,
    isStartingNewGame,
    rarityCelebration,
    setRarityCelebration,
  } = useGameData();
  const { loading, error, clearError } = useGameUI();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isGameActive && !isStartingNewGame) {
      navigate(isGameOver ? '/end' : '/', { replace: true });
    }
  }, [isGameActive, isGameOver, isStartingNewGame, navigate]);

  const handleRetry = useCallback(() => {
    clearError();
    void startGame({
      gameMode,
      maxQuestions,
      mediaType,
      review: isReviewMode,
    });
  }, [clearError, gameMode, isReviewMode, maxQuestions, mediaType, startGame]);

  if (error && isGameActive) {
    const errorMessage =
      typeof error === 'string' && error.trim()
        ? error
        : t('errors.game_load_failed', {}, 'Impossible de charger la question.');

    return (
      <div className="screen game-screen centered-screen">
        <div className="card play-status-card" role="status" aria-live="polite">
          <h2 className="play-status-title">
            {t('errors.game_load_title', {}, 'Oups, la question n’a pas pu être chargée')}
          </h2>
          <p className="play-status-text">{errorMessage}</p>
          <div className="play-status-actions">
            <button type="button" className="btn btn--primary" onClick={handleRetry}>
              {t('common.retry', {}, 'Réessayer')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate('/', { replace: true })}
            >
              {t('common.home', {}, 'Accueil')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isStartingNewGame || !isGameActive || loading || !question) {
    return <QuestionSkeleton />;
  }

  const activeMode = gameMode === 'hard' ? 'hard' : 'easy';

  return (
    <>
      {rarityCelebration?.tier && (
        <RarityCelebration
          tier={rarityCelebration.tier}
          stamp={rarityCelebration.stamp}
          onComplete={() => setRarityCelebration(null)}
        />
      )}
      {activeMode === 'easy' && <EasyMode />}
      {activeMode === 'hard' && <HardMode />}
    </>
  );
};

export default PlayPage;
