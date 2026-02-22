import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { decodeChallenge } from '../utils/challengeSeed';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import { normalizeGameMode } from '../hooks/game/gameUtils';
import './ChallengePage.css';

const ChallengePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { startGame, setActivePackId } = useGameData();
  const { t } = useLanguage();
  const { packs, loading: packsLoading, error: packsError, refresh: refreshPacks } = usePacks();
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      return;
    }
    const decoded = decodeChallenge(token);
    if (!decoded) {
      setError(true);
      return;
    }
    setChallenge(decoded);
  }, [token]);

  // Resolve pack name for display
  const packInfo = challenge && packs?.find((p) => p.id === challenge.packId);

  const handleAccept = () => {
    if (!challenge || startedRef.current) return;
    startedRef.current = true;
    const challengeMode = normalizeGameMode(challenge.gameMode, 'hard');

    // Set the pack and start a normal game with the same settings
    setActivePackId(challenge.packId);
    startGame({
      gameMode: challengeMode,
      maxQuestions: challenge.maxQuestions,
      mediaType: challenge.mediaType,
    });
    navigate('/play');
  };

  if (error) {
    return (
      <div className="screen challenge-screen">
        <div className="card challenge-card">
          <h1>❌ {t('challenge.invalid_title', {}, 'Lien invalide')}</h1>
          <p>{t('challenge.invalid_text', {}, 'Ce lien de défi n\'est pas valide ou a expiré.')}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
            {t('common.home', {}, 'Accueil')}
          </button>
        </div>
      </div>
    );
  }

  if (!challenge || packsLoading) {
    return (
      <div className="screen challenge-screen">
        <div className="card challenge-card challenge-status-card" role="status" aria-live="polite">
          <div className="challenge-status-spinner" aria-hidden="true" />
          <h1 className="challenge-status-title">
            {t('challenge.loading_title', {}, 'Chargement du défi…')}
          </h1>
          <p className="challenge-status-text">
            {t('challenge.loading_text', {}, 'Préparation des réglages et du pack.')}
          </p>
        </div>
      </div>
    );
  }

  if (packsError) {
    return (
      <div className="screen challenge-screen">
        <div className="card challenge-card challenge-status-card" role="alert" aria-live="assertive">
          <h1 className="challenge-status-title">
            {t('challenge.packs_error_title', {}, 'Impossible de charger le défi')}
          </h1>
          <p className="challenge-status-text">{packsError}</p>
          <div className="challenge-status-actions">
            <button type="button" className="btn btn--primary" onClick={() => void refreshPacks()}>
              {t('common.retry', {}, 'Réessayer')}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/')}>
              {t('common.home', {}, 'Accueil')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const challengeMode = normalizeGameMode(challenge.gameMode, 'hard');

  return (
    <div className="screen challenge-screen">
      <div className="card challenge-card">
        <div className="challenge-icon" aria-hidden="true">⚔️</div>
        <h1>{t('challenge.title', {}, 'Défi d\'un ami !')}</h1>
        <p className="challenge-desc">
          {challenge.score != null && challenge.total != null
            ? t('challenge.description_score', { score: challenge.score, total: challenge.total },
                `Un ami a fait ${challenge.score}/${challenge.total}. Fais mieux sur le même pack et les mêmes réglages !`
              )
            : t('challenge.description', {},
                'Un ami te défie de faire mieux sur le même pack et les mêmes réglages. À toi de jouer !'
              )
          }
        </p>
        <div className="challenge-details">
          {packInfo && (
            <span className="challenge-detail">
              📦 {packInfo.titleKey ? t(packInfo.titleKey) : challenge.packId}
            </span>
          )}
          <span className="challenge-detail">
            🎮 {challengeMode === 'hard'
              ? t('config.mode_hard', {}, 'Difficile')
              : t('config.mode_easy', {}, 'Facile')}
          </span>
          <span className="challenge-detail">❓ {challenge.maxQuestions} questions</span>
        </div>
        <button type="button" className="btn btn--primary challenge-accept" onClick={handleAccept}>
          {t('challenge.accept', {}, 'Relever le défi !')}
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => navigate('/')}>
          {t('common.home', {}, 'Accueil')}
        </button>
      </div>
    </div>
  );
};

export default ChallengePage;
