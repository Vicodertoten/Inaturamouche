import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ImageViewer from '../../../components/ImageViewer';
import AutocompleteInput from '../../../shared/ui/AutocompleteInput';
import RoundSummaryModal from '../../../components/RoundSummaryModal';
import GameHeader from '../../../components/GameHeader';
import LevelUpNotification from '../../../components/LevelUpNotification';
import FloatingXPIndicator from '../../../components/FloatingXPIndicator';
import './HardMode.css';
import { computeScore, computeInGameStreakBonus } from '../../../utils/scoring';
import { getAudioMimeType, normalizeMediaUrl } from '../../../utils/mediaUtils';
import { useGameData } from '../../../context/GameContext';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { vibrateSuccess, vibrateError } from '../../../utils/haptics';
import { submitQuizAnswer } from '../../../services/api';
import { notify } from '../../../services/notifications';
import { trackMetric } from '../../../services/metrics';

const INITIAL_GUESSES = 3;

function HardMode() {
  const {
    question,
    nextImageUrl,
    currentStreak,
    inGameShields,
    hasPermanentShield,
    levelUpNotification,
    completeRound,
    endGame,
    mediaType,
    questionCount,
    maxQuestions,
    dailySeedSession,
    activePackId,
    isReviewMode,
  } = useGameData();

  const { t, getTaxonDisplayNames } = useLanguage();
  const maxGuesses = Math.max(1, Number(question?.hard_mode?.max_guesses) || INITIAL_GUESSES);
  const basePoints = Math.max(0, Number(question?.hard_mode?.base_points) || 30);

  const [guesses, setGuesses] = useState(maxGuesses);
  const [incorrectGuessIds, setIncorrectGuessIds] = useState([]);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [feedback, setFeedback] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [panelEffect, setPanelEffect] = useState('');
  const [isGuessing, setIsGuessing] = useState(false);
  const [liveXPGain, setLiveXPGain] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [lastGuess, setLastGuess] = useState(null);

  const feedbackTimeoutRef = useRef(null);
  const panelTimeoutRef = useRef(null);
  const questionRef = useRef(question);

  const soundUrl = normalizeMediaUrl(question?.sounds?.[0]?.file_url);
  const soundType = getAudioMimeType(soundUrl);
  const showAudio = (mediaType === 'sounds' || mediaType === 'both') && !!soundUrl;
  const showImage = mediaType === 'images' || mediaType === 'both' || (mediaType === 'sounds' && !soundUrl);
  const imageAlt = t('hard.image_alt');
  const isCurrentQuestion = questionRef.current === question;

  useEffect(() => {
    questionRef.current = question;
    setIncorrectGuessIds([]);
    setGuesses(maxGuesses);
    setRoundStatus('playing');
    setFeedback(null);
    setScoreInfo(null);
    setPanelEffect('');
    setIsGuessing(false);
    setLiveXPGain(0);
    setValidationResult(null);
    setLastGuess(null);
  }, [question, maxGuesses]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    if (panelTimeoutRef.current) clearTimeout(panelTimeoutRef.current);
  }, []);

  const showFeedback = useCallback((message, type = 'info') => {
    setFeedback({ message, type });
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 3200);
  }, []);

  const triggerPanelShake = useCallback(() => {
    setPanelEffect('shake');
    if (panelTimeoutRef.current) clearTimeout(panelTimeoutRef.current);
    panelTimeoutRef.current = setTimeout(() => setPanelEffect(''), 600);
  }, []);

  const mapSelectedTaxonToUserAnswer = useCallback(
    (taxon) => {
      if (!taxon?.id) return null;
      const { primary, secondary } = getTaxonDisplayNames(taxon);
      return {
        id: Number(taxon.id) || taxon.id,
        image_url: taxon.default_photo?.url || taxon.default_photo?.square_url,
        wikipedia_url: taxon.wikipedia_url || null,
        inaturalist_url: taxon.url || null,
        primaryName: primary,
        secondaryName: secondary,
      };
    },
    [getTaxonDisplayNames]
  );

  const handleGuess = useCallback(
    async (selection) => {
      if (!selection?.id || roundStatus !== 'playing' || isGuessing) return;
      if (!question?.round_id || !question?.round_signature) return;

      void trackMetric('answer_submit', {
        mode: 'hard',
        pack_id: activePackId || null,
        round_id: question.round_id,
        question_index: Number.isInteger(questionCount) ? questionCount : null,
        selected_taxon_id: String(selection.id),
        attempt: Math.max(1, maxGuesses - guesses + 1),
        review: Boolean(isReviewMode),
        is_daily_challenge: Boolean(dailySeedSession),
      });

      setIsGuessing(true);
      try {
        const result = await submitQuizAnswer({
          roundId: question.round_id,
          roundSignature: question.round_signature,
          selectedTaxonId: selection.id,
          roundAction: 'hard_guess',
          seedSession: dailySeedSession,
        });

        if (questionRef.current !== question) return;

        setValidationResult(result);

        const hardState = result?.hard_state || {};
        const guessesRemaining = Math.max(0, Number(hardState.guesses_remaining || 0));
        setGuesses(guessesRemaining);

        if (result?.selected_taxon) {
          setLastGuess(mapSelectedTaxonToUserAnswer(result.selected_taxon));
        }

        const isCorrect = result?.guess_outcome === 'correct';

        if (isCorrect) {
          vibrateSuccess();
          const guessXP = basePoints + guessesRemaining * 5;
          setLiveXPGain(guessXP);
          showFeedback(t('hard.feedback.correct', {}, 'Bonne réponse !'), 'success');
        } else {
          vibrateError();
          showFeedback(
            guessesRemaining > 0
              ? t('hard.feedback.wrong', { remaining: guessesRemaining }, `Incorrect. ${guessesRemaining} essai(s) restant(s).`)
              : t('hard.feedback.wrong_last', {}, 'Incorrect. Plus de tentatives.'),
            'error'
          );
          setIncorrectGuessIds((prev) => [...prev, selection.id]);
          triggerPanelShake();
        }

        if (result?.round_consumed || result?.status === 'win' || result?.status === 'lose') {
          setScoreInfo({
            points: isCorrect ? basePoints : 0,
            bonus: 0,
            streakBonus: 0,
            guessesRemaining,
          });
          setRoundStatus(result?.status === 'win' ? 'win' : 'lose');
        }
      } catch (error) {
        if (error?.code === 'ROUND_EXPIRED') {
          notify(t('errors.round_expired', {}, 'Question expirée, passage à la suivante…'), { type: 'warning' });
          completeRound({ points: 0, bonus: 0, streakBonus: 0, isCorrect: false, roundMeta: { mode: 'hard', wasCorrect: false, serverValidated: false, skippedExpired: true } });
          return;
        }
        showFeedback(error?.message || t('hard.feedback.error'), 'error');
        triggerPanelShake();
      } finally {
        setIsGuessing(false);
      }
    },
    [
      basePoints,
      completeRound,
      isGuessing,
      mapSelectedTaxonToUserAnswer,
      question,
      roundStatus,
      showFeedback,
      t,
      triggerPanelShake,
      dailySeedSession,
      activePackId,
      guesses,
      isReviewMode,
      maxGuesses,
      questionCount,
    ]
  );

  const resolvedQuestion = useMemo(() => {
    if (!question || !validationResult?.correct_answer) return question;
    return {
      ...question,
      bonne_reponse: validationResult.correct_answer,
      inaturalist_url: validationResult.inaturalist_url || question.inaturalist_url || null,
    };
  }, [question, validationResult]);

  const handleNext = () => {
    setRoundStatus('playing');
    const savedScoreInfo = scoreInfo;
    setScoreInfo(null);

    const isCorrect = roundStatus === 'win';
    const streakBonusCalc = isCorrect ? computeInGameStreakBonus(currentStreak + 1) : 0;

    const baseScoreInfo = computeScore({
      mode: 'hard',
      isCorrect,
      basePoints: savedScoreInfo?.points || 0,
      guessesRemaining: savedScoreInfo?.guessesRemaining || 0,
    });

    const finalScoreInfo = {
      points: baseScoreInfo.points,
      bonus: baseScoreInfo.bonus || 0,
      streakBonus: streakBonusCalc,
    };

    completeRound({
      ...finalScoreInfo,
      isCorrect,
      roundMeta: {
        mode: 'hard',
        wasCorrect: isCorrect,
        hintCount: 0,
        hintsUsed: false,
        serverValidated: true,
      },
      resolvedQuestion,
      validationResult,
    });
  };

  const isGameOver = roundStatus !== 'playing';
  const placeholderText = t('hard.single_guess_placeholder_species', {}, "Devinez l'espèce...");

  return (
    <>
      {levelUpNotification && (
        <LevelUpNotification
          oldLevel={levelUpNotification.oldLevel}
          newLevel={levelUpNotification.newLevel}
          onClose={() => {}}
        />
      )}

      <FloatingXPIndicator xpGain={liveXPGain} position="center" />

      {isGameOver && isCurrentQuestion && (
        <RoundSummaryModal
          status={roundStatus}
          question={resolvedQuestion}
          scoreInfo={scoreInfo}
          onNext={handleNext}
          userAnswer={lastGuess}
        />
      )}

      <div className="screen game-screen hard-mode">
        <div className="hard-mode-container">
          <GameHeader
            mode="hard"
            currentStreak={currentStreak}
            inGameShields={inGameShields}
            hasPermanentShield={hasPermanentShield}
            questionCount={questionCount}
            maxQuestions={maxQuestions}
            guesses={guesses}
            onQuit={endGame}
            isGameOver={isGameOver}
          />

          <div className="hard-mode-layout">
            <div className="media-column">
              <div className="left-stack">
                <div className="media-panel">
                  {showAudio && (
                    <div className="audio-panel">
                      <audio
                        controls
                        className="audio-player"
                        preload="metadata"
                        playsInline
                        controlsList="nodownload noplaybackrate"
                      >
                        {soundType ? (
                          <source src={soundUrl} type={soundType} />
                        ) : (
                          <source src={soundUrl} />
                        )}
                      </audio>
                    </div>
                  )}
                  {showImage && (
                    <ImageViewer
                      imageUrls={question.image_urls || [question.image_url]}
                      photoMeta={question.image_meta}
                      alt={imageAlt}
                      nextImageUrl={nextImageUrl}
                    />
                  )}
                </div>

                <div className={`proposition-panel guess-panel ${panelEffect ? `panel-${panelEffect}` : ''}`}>
                  <div className="guess-bar">
                    <div className="guess-row">
                      <AutocompleteInput
                        key={`hard-guess-${guesses}`}
                        onSelect={handleGuess}
                        disabled={isGameOver || guesses <= 0 || isGuessing}
                        placeholder={placeholderText}
                        incorrectAncestorIds={incorrectGuessIds}
                      />
                    </div>
                  </div>
                  {feedback?.message && (
                    <div className={`feedback-bar ${feedback.type}`} aria-live="polite">
                      {feedback.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default HardMode;
