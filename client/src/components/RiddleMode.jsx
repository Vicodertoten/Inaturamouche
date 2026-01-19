import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import RoundSummaryModal from './RoundSummaryModal';
import GameHeader from './GameHeader';
import LevelUpNotification from './LevelUpNotification';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
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
  } = useGameData();
  const { t, getTaxonDisplayNames } = useLanguage();

  const questionRef = useRef(question);
  const [clueIndex, setClueIndex] = useState(0);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [selectedId, setSelectedId] = useState(null);
  const [lastWrongId, setLastWrongId] = useState(null);
  const [eliminatedIds, setEliminatedIds] = useState(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [roundMeta, setRoundMeta] = useState({
    mode: 'riddle',
    hintsUsed: false,
    hintCount: 0,
    clueIndex: 0,
  });
  const [lastAnswer, setLastAnswer] = useState(null);

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

  const fallbackLabel = question?.bonne_reponse?.preferred_common_name || question?.bonne_reponse?.common_name;
  const correctIndexFromServer = Number.isInteger(question?.choix_mode_facile_correct_index)
    ? question.choix_mode_facile_correct_index
    : Math.max(0, easyPairs.findIndex((p) => p.label === fallbackLabel));

  const correctPair = easyPairs[correctIndexFromServer];
  const correctId = correctPair?.id ?? null;
  const visiblePairs = useMemo(
    () => easyPairs.filter((pair) => !eliminatedIds.has(String(pair.id))),
    [easyPairs, eliminatedIds]
  );

  const riddleClues = useMemo(
    () => (Array.isArray(question?.riddle?.clues) ? question.riddle.clues : []),
    [question?.riddle?.clues]
  );
  const activeClue =
    riddleClues[clueIndex] || t('riddle.fallback_clue', {}, 'Le Professeur cherche ses notes...');

  useLayoutEffect(() => {
    questionRef.current = question;
    setClueIndex(0);
    setRoundStatus('playing');
    setSelectedId(null);
    setLastWrongId(null);
    setEliminatedIds(new Set());
    setShowSummary(false);
    setIsTransitioning(false);
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

  const isCurrentQuestion = questionRef.current === question;
  const answeredThisQuestion = roundStatus !== 'playing' && isCurrentQuestion;
  const isCorrectAnswer = roundStatus === 'win' && isCurrentQuestion;

  const pointsForClue = RIDDLE_POINTS[clueIndex] ?? 1;
  const streakBonus = isCorrectAnswer ? 2 * (currentStreak + 1) : 0;
  const scoreInfo = { points: isCorrectAnswer ? pointsForClue : 0, bonus: 0, streakBonus };

  const handleNext = () => {
    completeRound({
      ...scoreInfo,
      isCorrect: isCorrectAnswer,
      roundMeta: { ...roundMeta, wasCorrect: isCorrectAnswer, clueIndex },
    });
  };

  const handleAdvanceClue = () => {
    if (answeredThisQuestion || isTransitioning) return;
    setClueIndex((prev) => Math.min(prev + 1, RIDDLE_POINTS.length - 1));
  };

  const handleSelectAnswer = (idx) => {
    if (answeredThisQuestion || isTransitioning) return;
    const pair = visiblePairs[idx];
    if (!pair) return;
    setSelectedId(pair.id);
    setLastAnswer(pair);

    const isCorrect = pair && correctPair && String(pair.id) === String(correctPair.id);
    if (isCorrect) {
      setRoundStatus('win');
      setTimeout(() => {
        if (questionRef.current === question) setShowSummary(true);
      }, 1200);
      return;
    }

    if (clueIndex < RIDDLE_POINTS.length - 1) {
      setIsTransitioning(true);
      setLastWrongId(pair.id);
      setTimeout(() => {
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
      }, 900);
    } else {
      setRoundStatus('lose');
      setLastWrongId(pair.id);
      setTimeout(() => {
        if (questionRef.current === question) setShowSummary(true);
      }, 1200);
    }
  };

  const isIndexCorrect = (idx) => {
    const pair = visiblePairs[idx];
    return pair && correctPair && String(pair.id) === String(correctPair.id);
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
          question={question}
          scoreInfo={scoreInfo}
          onNext={handleNext}
          userAnswer={lastAnswer}
        />
      )}

      <div className="screen game-screen riddle-mode">
        <GameHeader
          mode="riddle"
          currentStreak={currentStreak}
          inGameShields={inGameShields}
          hasPermanentShield={hasPermanentShield}
          questionCount={questionCount}
          maxQuestions={maxQuestions}
          onQuit={endGame}
          isGameOver={answeredThisQuestion}
        />
        <div className="card">
          <main className="game-main">
            <div className="image-section">
              <div className="riddle-panel">
                <div className="riddle-header">
                  <div className="riddle-title">{t('riddle.title', {}, "L'enigme du Professeur")}</div>
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
                    disabled={answeredThisQuestion || clueIndex >= RIDDLE_POINTS.length - 1 || isTransitioning}
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
                    disabled={answeredThisQuestion || isTransitioning}
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

export default RiddleMode;
