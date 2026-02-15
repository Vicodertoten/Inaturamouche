import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import RoundSummaryModal from './RoundSummaryModal';
import GameHeader from './GameHeader';
import LevelUpNotification from './LevelUpNotification';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { submitQuizAnswer } from '../services/api';
import { notify } from '../services/notifications';
import { computeInGameStreakBonus } from '../utils/scoring';
import './RiddleMode.css';

const RIDDLE_POINTS = [10, 5, 1];

const RiddleMode = () => {
  const {
    question,
    questionCount,
    maxQuestions,
    currentStreak,
    inGameShields,
    hasPermanentShield,
    levelUpNotification,
    completeRound,
    endGame,
    dailySeedSession,
  } = useGameData();
  const { t, getTaxonDisplayNames, nameFormat } = useLanguage();

  const questionRef = useRef(question);
  const [clueIndex, setClueIndex] = useState(0);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [selectedId, setSelectedId] = useState(null);
  const [lastWrongId, setLastWrongId] = useState(null);
  const [eliminatedIds, setEliminatedIds] = useState(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [roundMeta, setRoundMeta] = useState({
    mode: 'riddle',
    hintsUsed: false,
    hintCount: 0,
    clueIndex: 0,
  });
  const [lastAnswer, setLastAnswer] = useState(null);
  const transitionTimeoutRef = useRef(null);
  const summaryTimeoutRef = useRef(null);

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

  const visiblePairs = useMemo(
    () => easyPairs.filter((pair) => !eliminatedIds.has(String(pair.id))),
    [easyPairs, eliminatedIds]
  );

  const riddleClues = useMemo(
    () => (Array.isArray(question?.riddle?.clues) ? question.riddle.clues : []),
    [question?.riddle?.clues]
  );
  const activeClue =
    riddleClues[clueIndex] || t('riddle.fallback_clue', {}, 'Papy Mouche cherche ses notes...');

  useLayoutEffect(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (summaryTimeoutRef.current) {
      clearTimeout(summaryTimeoutRef.current);
      summaryTimeoutRef.current = null;
    }
    questionRef.current = question;
    setClueIndex(0);
    setRoundStatus('playing');
    setSelectedId(null);
    setLastWrongId(null);
    setEliminatedIds(new Set());
    setShowSummary(false);
    setIsTransitioning(false);
    setIsSubmitting(false);
    setValidationResult(null);
    setLastAnswer(null);
    setRoundMeta({
      mode: 'riddle',
      hintsUsed: false,
      hintCount: 0,
      clueIndex: 0,
    });
  }, [question]);

  useEffect(() => {
    setRoundMeta((prev) => ({
      ...prev,
      clueIndex,
      hintsUsed: clueIndex > 0,
      hintCount: clueIndex,
    }));
  }, [clueIndex]);

  useEffect(() => () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (summaryTimeoutRef.current) {
      clearTimeout(summaryTimeoutRef.current);
      summaryTimeoutRef.current = null;
    }
  }, []);

  const isCurrentQuestion = questionRef.current === question;
  const answeredThisQuestion = roundStatus !== 'playing' && isCurrentQuestion;
  const isCorrectAnswer = roundStatus === 'win' && isCurrentQuestion && Boolean(validationResult?.is_correct);
  const correctTaxonId = validationResult?.correct_taxon_id ? String(validationResult.correct_taxon_id) : null;

  const pointsForClue = RIDDLE_POINTS[clueIndex] ?? 1;
  const streakBonus = isCorrectAnswer ? computeInGameStreakBonus(currentStreak + 1) : 0;
  const scoreInfo = { points: isCorrectAnswer ? pointsForClue : 0, bonus: 0, streakBonus };
  const resolvedQuestion = useMemo(() => {
    if (!question || !validationResult?.correct_answer) return question;
    return {
      ...question,
      bonne_reponse: validationResult.correct_answer,
      inaturalist_url: validationResult.inaturalist_url || question.inaturalist_url || null,
    };
  }, [question, validationResult]);

  const handleNext = () => {
    completeRound({
      ...scoreInfo,
      isCorrect: isCorrectAnswer,
      roundMeta: { ...roundMeta, wasCorrect: isCorrectAnswer, clueIndex, serverValidated: true },
      resolvedQuestion,
      validationResult,
    });
  };

  const handleAdvanceClue = () => {
    if (answeredThisQuestion || isTransitioning) return;
    setClueIndex((prev) => Math.min(prev + 1, RIDDLE_POINTS.length - 1));
  };

  const handleSelectAnswer = async (idx) => {
    if (answeredThisQuestion || isTransitioning || isSubmitting) return;
    const pair = visiblePairs[idx];
    if (!pair) return;
    setSelectedId(pair.id);
    setLastAnswer(pair);
    if (!question?.round_id || !question?.round_signature) return;

    setIsSubmitting(true);
    try {
      const result = await submitQuizAnswer({
        roundId: question.round_id,
        roundSignature: question.round_signature,
        selectedTaxonId: pair.id,
        seedSession: dailySeedSession,
      });
      if (questionRef.current !== question) return;

      if (result?.status === 'retry') {
        setIsTransitioning(true);
        setLastWrongId(pair.id);
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        transitionTimeoutRef.current = setTimeout(() => {
          if (questionRef.current === question) {
            setEliminatedIds((prev) => {
              const next = new Set(prev);
              next.add(String(pair.id));
              return next;
            });
            setClueIndex((prev) => Math.min(prev + 1, RIDDLE_POINTS.length - 1));
            setSelectedId(null);
            setLastWrongId(null);
            setIsTransitioning(false);
          }
          transitionTimeoutRef.current = null;
        }, 900);
        return;
      }

      setValidationResult(result);
      setRoundStatus(result?.is_correct ? 'win' : 'lose');
      if (!result?.is_correct) {
        setLastWrongId(pair.id);
      }
      if (summaryTimeoutRef.current) {
        clearTimeout(summaryTimeoutRef.current);
      }
      summaryTimeoutRef.current = setTimeout(() => {
        if (questionRef.current === question) setShowSummary(true);
        summaryTimeoutRef.current = null;
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
  };

  const isIndexCorrect = (idx) => {
    const pair = visiblePairs[idx];
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
          userAnswer={lastAnswer}
        />
      )}

      <div className="screen game-screen riddle-mode">
        <GameHeader
          mode="riddle"
          currentStreak={currentStreak}
          questionCount={questionCount}
          maxQuestions={maxQuestions}
          onQuit={endGame}
          isGameOver={answeredThisQuestion}
        />
        <div className="card">
          <section className="game-main" aria-label={t('game.main_section', {}, 'Zone de jeu')}>
            <div className="image-section">
              <div className="riddle-panel">
                <div className="riddle-header">
                  <div className="riddle-title">{t('riddle.title', {}, "L'enigme de Papy Mouche")}</div>
                  <div className="riddle-points">{t('riddle.points', { points: pointsForClue }, `+${pointsForClue} pts`)}</div>
                </div>
                <p className="riddle-clue">{activeClue}</p>
                <div className="riddle-meta">
                  <span>
                    {t('riddle.clue_progress', { current: clueIndex + 1, total: RIDDLE_POINTS.length }, `Indice ${clueIndex + 1}/${RIDDLE_POINTS.length}`)}
                  </span>
                  {question?.riddle?.source === 'fallback' && (
                    <span className="riddle-source">
                      {t('riddle.fallback_tag', {}, 'Indice maison')}
                    </span>
                  )}
                </div>
                <div className="riddle-actions">
                  <button
                    className="btn btn--secondary"
                    onClick={handleAdvanceClue}
                    disabled={
                      answeredThisQuestion ||
                      clueIndex >= RIDDLE_POINTS.length - 1 ||
                      isTransitioning ||
                      isSubmitting
                    }
                    type="button"
                  >
                    {t('riddle.next_clue', {}, 'Indice suivant')}
                  </button>
                </div>
              </div>
            </div>

            <div className="choices">
              {visiblePairs.map((p, idx) => {
                let buttonClass = '';
                if (answeredThisQuestion) {
                  if (isIndexCorrect(idx)) buttonClass = 'correct';
                  else if (selectedId != null && String(p.id) === String(selectedId)) buttonClass = 'incorrect';
                  else buttonClass = 'disabled';
                } else if (lastWrongId != null && String(p.id) === String(lastWrongId)) {
                  buttonClass = 'incorrect';
                }
                return (
                  <button
                    key={p.id ?? p.label}
                    className={buttonClass}
                    onClick={() => handleSelectAnswer(idx)}
                    disabled={answeredThisQuestion || isTransitioning || isSubmitting}
                  >
                    <span className="choice-number">{idx + 1}</span>
                    {(() => {
                      const { primary, secondary } = getTaxonDisplayNames(p.detail, p.label);
                      return (
                        <span className="choice-label">
                          <span className="choice-primary">{primary}</span>
                          {nameFormat !== 'scientific' && secondary && (
                            <span className="choice-secondary">{secondary}</span>
                          )}
                        </span>
                      );
                    })()}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default RiddleMode;
