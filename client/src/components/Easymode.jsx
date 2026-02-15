import React, { useState, useMemo, useLayoutEffect, useRef, useCallback } from 'react';
import ImageViewer from './ImageViewer';
import RoundSummaryModal from './RoundSummaryModal';
import GameHeader from './GameHeader';
import LevelUpNotification from './LevelUpNotification';
import { computeScore, computeInGameStreakBonus } from '../utils/scoring';
import { getAudioMimeType, normalizeMediaUrl } from '../utils/mediaUtils';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { vibrateSuccess, vibrateError } from '../utils/haptics';
import { notify } from '../services/notifications';
import { submitQuizAnswer } from '../services/api';

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
    dailySeedSession,
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

  // Indice supprimé (Phase 3)
  const [roundMeta] = useState({
    mode: 'easy',
  });

  useLayoutEffect(() => {
    questionRef.current = question;
    setAnswered(false);
    setSelectedIndex(null);
    setShowSummary(false);
    setValidationResult(null);
    setIsSubmitting(false);
  }, [question]);

  const isCurrentQuestion = questionRef.current === question;
  const answeredThisQuestion = answered && isCurrentQuestion;

  const remainingPairs = easyPairs;
  const correctTaxonId = validationResult?.correct_taxon_id ? String(validationResult.correct_taxon_id) : null;

  const isCorrectAnswer = answeredThisQuestion && selectedIndex !== null
    ? Boolean(validationResult?.is_correct)
    : false;

  const streakBonus = isCorrectAnswer ? computeInGameStreakBonus(currentStreak + 1) : 0;
  const baseScoreInfo = computeScore({ mode: 'easy', isCorrect: isCorrectAnswer });
  const scoreInfo = { ...baseScoreInfo, streakBonus };

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
        seedSession: dailySeedSession,
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
      if (error?.code === 'ROUND_EXPIRED') {
        notify(t('errors.round_expired', {}, 'Question expirée, passage à la suivante…'), { type: 'warning' });
        completeRound({ points: 0, bonus: 0, streakBonus: 0, isCorrect: false, roundMeta: { ...roundMeta, wasCorrect: false, serverValidated: false, skippedExpired: true } });
        return;
      }
      notify(error?.message || t('errors.generic'), { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [answeredThisQuestion, isSubmitting, question, remainingPairs, t, completeRound, roundMeta]);

  const handleNext = () => {
    completeRound({
      ...scoreInfo,
      isCorrect: isCorrectAnswer,
      roundMeta: { ...roundMeta, wasCorrect: isCorrectAnswer, serverValidated: true },
      resolvedQuestion,
      validationResult,
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
          questionCount={questionCount}
          maxQuestions={maxQuestions}
          onQuit={endGame}
          isGameOver={answeredThisQuestion}
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
