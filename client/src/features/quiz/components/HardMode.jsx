import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ImageViewer from '../../../components/ImageViewer';
import AutocompleteInput from '../../../shared/ui/AutocompleteInput';
import RoundSummaryModal from '../../../components/RoundSummaryModal';
import GameHeader from '../../../components/GameHeader';
import LevelUpNotification from '../../../components/LevelUpNotification';
import FloatingXPIndicator from '../../../components/FloatingXPIndicator';
import './HardMode.css';
import { computeScore, computeInGameStreakBonus } from '../../../utils/scoring';
import { HINT_XP_PENALTY_PERCENT } from '../../../utils/economy';
import { getAudioMimeType, normalizeMediaUrl } from '../../../utils/mediaUtils';
import { useGameData } from '../../../context/GameContext';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { vibrateSuccess, vibrateError } from '../../../utils/haptics';
import { notify } from '../../../services/notifications';
import { submitQuizAnswer } from '../../../services/api';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const INITIAL_GUESSES = 3;
const MAX_HINTS = 1;

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
  } = useGameData();

  const { t, getTaxonDisplayNames } = useLanguage();
  const maxGuesses = Math.max(1, Number(question?.hard_mode?.max_guesses) || INITIAL_GUESSES);
  const maxHints = Math.max(0, Number(question?.hard_mode?.max_hints) || MAX_HINTS);

  const [knownTaxa, setKnownTaxa] = useState({});
  const [activeRank, setActiveRank] = useState(RANKS[0]);
  const [guesses, setGuesses] = useState(maxGuesses);
  const [incorrectGuessIds, setIncorrectGuessIds] = useState([]);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [feedback, setFeedback] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [panelEffect, setPanelEffect] = useState('');
  const [currentScore, setCurrentScore] = useState(0);
  const [isGuessing, setIsGuessing] = useState(false);
  const [liveXPGain, setLiveXPGain] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [roundMeta, setRoundMeta] = useState({
    mode: 'hard',
    hintsUsed: false,
    hintCount: 0,
  });
  const [lastGuess, setLastGuess] = useState(null);

  const feedbackTimeoutRef = useRef(null);
  const panelTimeoutRef = useRef(null);
  const questionRef = useRef(question);

  const soundUrl = normalizeMediaUrl(question?.sounds?.[0]?.file_url);
  const soundType = getAudioMimeType(soundUrl);
  const showAudio = (mediaType === 'sounds' || mediaType === 'both') && !!soundUrl;
  const showImage = mediaType === 'images' || mediaType === 'both' || (mediaType === 'sounds' && !soundUrl);
  const imageAlt = t('hard.image_alt');

  const firstUnknownRank = useMemo(() => RANKS.find((rank) => !knownTaxa[rank]), [knownTaxa]);
  const isCurrentQuestion = questionRef.current === question;

  useEffect(() => {
    questionRef.current = question;
    setKnownTaxa({});
    setIncorrectGuessIds([]);
    setGuesses(maxGuesses);
    setRoundStatus('playing');
    setFeedback(null);
    setScoreInfo(null);
    setPanelEffect('');
    setCurrentScore(0);
    setIsGuessing(false);
    setLiveXPGain(0);
    setValidationResult(null);
    setRoundMeta({
      mode: 'hard',
      hintsUsed: false,
      hintCount: 0,
    });
    setLastGuess(null);
    setActiveRank(RANKS[0]);
  }, [question, maxGuesses]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    if (panelTimeoutRef.current) clearTimeout(panelTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!firstUnknownRank) {
      if (activeRank !== 'species') setActiveRank('species');
      return;
    }
    if (!activeRank || knownTaxa[activeRank]) {
      setActiveRank(firstUnknownRank);
    }
  }, [activeRank, firstUnknownRank, knownTaxa]);

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

  const applyHardState = useCallback(
    (result) => {
      const hardState = result?.hard_state || {};
      if (hardState.known_taxa && typeof hardState.known_taxa === 'object') {
        setKnownTaxa(hardState.known_taxa);
      }
      if (Number.isFinite(hardState.guesses_remaining)) {
        setGuesses(Math.max(0, Number(hardState.guesses_remaining)));
      }
      if (Number.isFinite(hardState.points_earned)) {
        setCurrentScore(Math.max(0, Number(hardState.points_earned)));
      }
      const hintCount = Math.max(0, Number.parseInt(String(hardState.hint_count || 0), 10) || 0);
      setRoundMeta((prev) => ({
        ...prev,
        hintsUsed: hintCount > 0,
        hintCount,
      }));
      if (result?.selected_taxon) {
        setLastGuess(mapSelectedTaxonToUserAnswer(result.selected_taxon));
      }

      return {
        guessesRemaining: Math.max(0, Number(hardState.guesses_remaining || 0)),
        pointsEarned: Math.max(0, Number(hardState.points_earned || 0)),
        gainedRanks: Array.isArray(hardState.gained_ranks) ? hardState.gained_ranks : [],
        hintRevealedRank: hardState.hint_revealed_rank || null,
      };
    },
    [mapSelectedTaxonToUserAnswer]
  );

  const handleGuess = useCallback(
    async (selection) => {
      if (!selection?.id || roundStatus !== 'playing' || isGuessing) return;
      if (!question?.round_id || !question?.round_signature) return;

      setIsGuessing(true);
      try {
        const result = await submitQuizAnswer({
          roundId: question.round_id,
          roundSignature: question.round_signature,
          selectedTaxonId: selection.id,
          roundAction: 'hard_guess',
        });

        if (questionRef.current !== question) return;

        setValidationResult(result);
        const { guessesRemaining, pointsEarned, gainedRanks } = applyHardState(result);

        if (gainedRanks.length > 0) {
          const gainedPoints = gainedRanks.length > 1 ? null : pointsEarned;
          vibrateSuccess();
          setLiveXPGain(
            Number.isFinite(gainedPoints)
              ? Math.max(0, gainedPoints - (currentScore || 0))
              : Math.max(0, pointsEarned - (currentScore || 0))
          );
          showFeedback(t('hard.feedback.branch', { points: Math.max(0, pointsEarned - (currentScore || 0)) }), 'success');
        } else if (result?.guess_outcome === 'redundant') {
          showFeedback(t('hard.feedback.redundant'), 'info');
        } else {
          vibrateError();
          showFeedback(t('hard.feedback.wrong_branch'), 'error');
          setIncorrectGuessIds((prev) => [...prev, selection.id]);
          triggerPanelShake();
        }

        if (result?.round_consumed || result?.status === 'win' || result?.status === 'lose') {
          setScoreInfo({
            points: pointsEarned,
            bonus: 0,
            streakBonus: 0,
            guessesRemaining,
          });
          setRoundStatus(result?.status === 'win' ? 'win' : 'lose');
        }
      } catch (error) {
        showFeedback(error?.message || t('hard.feedback.error'), 'error');
        triggerPanelShake();
      } finally {
        setIsGuessing(false);
      }
    },
    [
      applyHardState,
      currentScore,
      isGuessing,
      question,
      roundStatus,
      showFeedback,
      t,
      triggerPanelShake,
    ]
  );

  const handleRevealNameHint = useCallback(async () => {
    if (roundStatus !== 'playing' || isGuessing) return;
    if (!question?.round_id || !question?.round_signature) return;

    setIsGuessing(true);
    try {
      const result = await submitQuizAnswer({
        roundId: question.round_id,
        roundSignature: question.round_signature,
        roundAction: 'hard_hint',
      });
      if (questionRef.current !== question) return;

      setValidationResult(result);
      const { guessesRemaining, pointsEarned, hintRevealedRank } = applyHardState(result);

      if (hintRevealedRank) {
        const rankLabel = t(`ranks.${hintRevealedRank}`, hintRevealedRank);
        showFeedback(
          t('hard.feedback.hint_used', { rank: rankLabel }, `Indice utilisé (${rankLabel})`),
          'info'
        );
        notify(`Malus de manche: -${HINT_XP_PENALTY_PERCENT}% XP`, {
          type: 'info',
          duration: 2000,
        });
      }

      if (result?.round_consumed || result?.status === 'win' || result?.status === 'lose') {
        setScoreInfo({
          points: pointsEarned,
          bonus: 0,
          streakBonus: 0,
          guessesRemaining,
        });
        setRoundStatus(result?.status === 'win' ? 'win' : 'lose');
      }
    } catch (error) {
      showFeedback(error?.message || t('hard.feedback.error'), 'error');
      triggerPanelShake();
    } finally {
      setIsGuessing(false);
    }
  }, [applyHardState, isGuessing, question, roundStatus, showFeedback, t, triggerPanelShake]);

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
    const streakBonusCalc = isCorrect ? computeInGameStreakBonus(currentStreak, 'hard') : 0;

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
        ...roundMeta,
        wasCorrect: isCorrect,
        hintCount: roundMeta.hintCount || 0,
        serverValidated: true,
      },
      resolvedQuestion,
      validationResult,
    });
  };

  const isGameOver = roundStatus !== 'playing';
  const canUseAnyHint = !!firstUnknownRank && roundMeta.hintCount < maxHints;
  const placeholderText = t('hard.single_guess_placeholder_species', {}, "Devinez l'espèce.. .");

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
                        key={`hard-guess-${Object.keys(knownTaxa).length}`}
                        onSelect={handleGuess}
                        disabled={isGameOver || guesses <= 0 || isGuessing}
                        placeholder={placeholderText}
                        incorrectAncestorIds={incorrectGuessIds}
                      />
                      <div className="guess-actions-inline">
                        <button
                          onClick={handleRevealNameHint}
                          disabled={isGameOver || !canUseAnyHint || isGuessing}
                          className="action-button hint"
                          aria-label={t(
                            'hard.reveal_button_xp',
                            { cost: HINT_XP_PENALTY_PERCENT },
                            `Révéler (malus -${HINT_XP_PENALTY_PERCENT}% XP)`
                          )}
                        >
                          {t(
                            'hard.reveal_button_xp',
                            { cost: HINT_XP_PENALTY_PERCENT },
                            `Révéler (malus -${HINT_XP_PENALTY_PERCENT}% XP)`
                          )}
                        </button>
                      </div>
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
