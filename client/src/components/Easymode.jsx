import React, { useState, useMemo, useLayoutEffect, useRef, useCallback } from 'react';
import ImageViewer from './ImageViewer';
import RoundSummaryModal from './RoundSummaryModal';
import GameHeader from './GameHeader';
import LevelUpNotification from './LevelUpNotification';
import { computeScore } from '../utils/scoring';
import { HINT_XP_PENALTY_PERCENT } from '../utils/economy';
import { getAudioMimeType, normalizeMediaUrl } from '../utils/mediaUtils';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { vibrateSuccess, vibrateError } from '../utils/haptics';
import { notify } from '../services/notifications';
import { submitQuizAnswer } from '../services/api';

const HINT_COST_XP = HINT_XP_PENALTY_PERCENT;

/**
 * Easy mode:
 * - displays labels from question.choix_mode_facile
 * - keeps id/label alignment using question.choix_mode_facile_ids
 * - validates the selected answer server-side via /api/quiz/submit
 * - hint removal works on IDs (not labels)
 */
const EasyMode = () => {
  const {
    question,
    questionCount,
    maxQuestions,
    mediaType,
    currentStreak,
    inGameShields,
    hasPermanentShield,
    levelUpNotification,
    nextImageUrl,
    completeRound,
    endGame,
  } = useGameData();
  // Paires (id, label) alignées.
  const { t, getTaxonDisplayNames } = useLanguage();
  const soundUrl = normalizeMediaUrl(question?.sounds?.[0]?.file_url);
  const soundType = getAudioMimeType(soundUrl);
  const showAudio = (mediaType === 'sounds' || mediaType === 'both') && !!soundUrl;
  const showImage = mediaType === 'images' || mediaType === 'both' || (mediaType === 'sounds' && !soundUrl);

  const imageAlt = t('easy.image_alt');

  // Réf pour détecter un changement de question avant le rendu
  const questionRef = useRef(question);
  const emptyRemovedRef = useRef(new Set());

  const choiceDetailMap = useMemo(() => {
    const details = Array.isArray(question?.choice_taxa_details) ? question.choice_taxa_details : [];
    return new Map(details.map((detail) => [String(detail.taxon_id), detail]));
  }, [question?.choice_taxa_details]);

  const easyPairs = useMemo(() => {
    const labels = Array.isArray(question?.choix_mode_facile) ? question.choix_mode_facile : [];
    const ids = Array.isArray(question?.choix_mode_facile_ids) ? question.choix_mode_facile_ids : labels;
    return labels.map((label, i) => {
      const id = ids[i] ?? label;
      return {
        id,
        label,
        detail: choiceDetailMap.get(String(id)),
      };
    });
  }, [choiceDetailMap, question]);

  const [answered, setAnswered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Indice (ids supprimés)
  const [removedIds, setRemovedIds] = useState(new Set());
  const [hintUsed, setHintUsed] = useState(false);
  const [roundMeta, setRoundMeta] = useState({
    mode: 'easy',
    hintsUsed: false,
    hintCount: 0,
  });

  useLayoutEffect(() => {
    questionRef.current = question;
    setAnswered(false);
    setSelectedIndex(null);
    setShowSummary(false);
    setRemovedIds(new Set());
    setHintUsed(false);
    setRoundMeta({
      mode: 'easy',
      hintsUsed: false,
      hintCount: 0,
    });
    setValidationResult(null);
    setIsSubmitting(false);
  }, [question]);

  const isCurrentQuestion = questionRef.current === question;
  const answeredThisQuestion = answered && isCurrentQuestion;
  const hintUsedThisQuestion = hintUsed && isCurrentQuestion;
  const activeRemovedIds = isCurrentQuestion ? removedIds : emptyRemovedRef.current;

  const remainingPairs = easyPairs.filter(p => !activeRemovedIds.has(String(p.id)));
  const correctTaxonId = validationResult?.correct_taxon_id ? String(validationResult.correct_taxon_id) : null;

  const isCorrectAnswer = answeredThisQuestion && selectedIndex !== null
    ? Boolean(validationResult?.is_correct)
    : false;

  const streakBonus = isCorrectAnswer ? 2 * (currentStreak + 1) : 0;
  const baseScoreInfo = computeScore({ mode: 'easy', isCorrect: isCorrectAnswer });
  
  // Hint penalty is applied later in the shared XP economy model.
  const scoreInfo = { 
    ...baseScoreInfo, 
    streakBonus 
  };

  const hintsTemporarilyDisabled = true;



  const resolvedQuestion = useMemo(() => {
    if (!question || !validationResult?.correct_answer) return question;
    return {
      ...question,
      bonne_reponse: validationResult.correct_answer,
      inaturalist_url: validationResult.inaturalist_url || question.inaturalist_url || null,
    };
  }, [question, validationResult]);

  const handleSelectAnswer = useCallback(async (idx) => {
    if (answeredThisQuestion || isSubmitting) return;
    const selected = remainingPairs[idx];
    if (!selected?.id || !question?.round_id || !question?.round_signature) return;

    setIsSubmitting(true);
    setSelectedIndex(idx);

    try {
      const validation = await submitQuizAnswer({
        roundId: question.round_id,
        roundSignature: question.round_signature,
        selectedTaxonId: selected.id,
      });

      if (questionRef.current !== question) return;
      setValidationResult(validation);
      setAnswered(true);

      if (validation?.is_correct) {
        vibrateSuccess();
      } else {
        vibrateError();
      }

      setTimeout(() => {
        if (questionRef.current === question) {
          setShowSummary(true);
        }
      }, 1200);
    } catch (error) {
      notify(error?.message || t('errors.generic'), { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [answeredThisQuestion, isSubmitting, question, remainingPairs, t]);

  const handleNext = () => {
    completeRound({
      ...scoreInfo,
      isCorrect: isCorrectAnswer,
      roundMeta: { ...roundMeta, wasCorrect: isCorrectAnswer, serverValidated: true },
      resolvedQuestion,
      validationResult,
    });
  };

  const handleHint = () => {
    if (hintsTemporarilyDisabled) {
      notify(t('errors.generic', {}, 'Fonction indisponible pour le moment'), {
        type: 'info',
        duration: 2000,
      });
      return;
    }
    if (hintUsedThisQuestion || answeredThisQuestion) return;

    // On choisit au hasard un leurre restant (≠ correct) parmi les non-supprimés
    const incorrectRemaining = correctTaxonId
      ? remainingPairs.filter((p) => String(p.id) !== String(correctTaxonId))
      : remainingPairs.slice();
    if (incorrectRemaining.length <= 1) return; // garder au moins 1 leurre
    const toRemove = incorrectRemaining[Math.floor(Math.random() * incorrectRemaining.length)];
    const newSet = new Set(removedIds);
    newSet.add(String(toRemove.id));
    setRemovedIds(newSet);
    setHintUsed(true);
    
    notify(`Malus de manche: -${HINT_COST_XP}% XP`, {
      type: 'info',
      duration: 2000,
    });
    
    setRoundMeta((prev) => {
      return {
        ...prev,
        hintsUsed: true,
        hintCount: (prev.hintCount || 0) + 1,
      };
    });
  };

  // Pour déterminer les classes d'état, on compare via IDs
  const isIndexCorrect = (idx) => {
    const pair = remainingPairs[idx];
    return pair && correctTaxonId && String(pair.id) === String(correctTaxonId);
  };

  return (
    <>
      {levelUpNotification && (
        <LevelUpNotification 
          oldLevel={levelUpNotification.oldLevel}
          newLevel={levelUpNotification.newLevel}
          onClose={() => {}}
        />
      )}
      
      {showSummary && isCurrentQuestion && (
        <RoundSummaryModal
          status={isCorrectAnswer ? 'win' : 'lose'}
          question={resolvedQuestion}
          scoreInfo={scoreInfo}
          onNext={handleNext}
          userAnswer={remainingPairs[selectedIndex]}
        />
      )}

      <div className="screen game-screen easy-mode">
        <GameHeader
          mode="easy"
          currentStreak={currentStreak}
          inGameShields={inGameShields}
          hasPermanentShield={hasPermanentShield}
          questionCount={questionCount}
          maxQuestions={maxQuestions}
          onQuit={endGame}
          isGameOver={answeredThisQuestion}
          onHint={handleHint}
          hintDisabled={
          hintUsedThisQuestion ||
          hintsTemporarilyDisabled ||
          answeredThisQuestion ||
          isSubmitting ||
          remainingPairs.length <= 2
          }
          hintCost={HINT_COST_XP}
        />
        <div className="card">
          <main className="game-main">
            <div className="image-section">
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

            <div className="choices">
              {remainingPairs.map((p, idx) => {
                let buttonClass = '';
                if (answeredThisQuestion) {
                  if (isIndexCorrect(idx)) buttonClass = 'correct';
                  else if (idx === selectedIndex) buttonClass = 'incorrect';
                  else buttonClass = 'disabled';
                }
                return (
                  <button
                    key={p.id ?? p.label}
                    className={buttonClass}
                    onClick={() => handleSelectAnswer(idx)}
                    disabled={answeredThisQuestion || isSubmitting}
                  >
                    <span className="choice-number">{idx + 1}</span>
                    {(() => {
                      const { primary, secondary } = getTaxonDisplayNames(p.detail, p.label);
                      return (
                        <span className="choice-label">
                          <span className="choice-primary">{primary}</span>
                          {secondary && <span className="choice-secondary">{secondary}</span>}
                        </span>
                      );
                    })()}
                  </button>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default EasyMode;
