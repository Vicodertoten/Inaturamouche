import React, { useState, useMemo, useLayoutEffect, useRef } from 'react';
import ImageViewer from './ImageViewer';
import RoundSummaryModal from './RoundSummaryModal';
import GameHeader from './GameHeader';
import LevelUpNotification from './LevelUpNotification';
import { computeScore } from '../utils/scoring';
import { getDisplayName } from '../utils/speciesUtils';
import { useGameData } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { vibrateSuccess, vibrateError } from '../utils/haptics';

const HINT_COST_XP = 5; // Coût en XP pour utiliser l'indice

/**
 * EasyMode corrigé :
 * - Affiche les labels de question.choix_mode_facile
 * - Utilise question.choix_mode_facile_ids (aligné index ↔ label) pour la sélection
 * - Vérifie la bonne réponse via question.choix_mode_facile_correct_index
 * - L’indice retire des choix en se basant sur les IDs (pas les labels)
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
  // Paires (id, label) alignées. Fallback si serveur ancien (sans ids/index).
  const { t, getTaxonDisplayNames } = useLanguage();
  const hasQuestionLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;
  const soundUrl = question?.sounds?.[0]?.file_url;
  const showAudio = (mediaType === 'sounds' || mediaType === 'both') && !!soundUrl;
  const showImage = mediaType === 'images' || mediaType === 'both' || (mediaType === 'sounds' && !soundUrl);
  // `imageAltRaw` may contain the answer — do not expose it as `alt` to
  // prevent long-press/context menu from revealing the answer on Android.
  const imageAltRaw = useMemo(() => {
    const taxon = question?.bonne_reponse;
    const common = taxon?.preferred_common_name || taxon?.common_name;
    const scientific = taxon?.name;
    if (common && scientific && common !== scientific) return `${common} (${scientific})`;
    return common || scientific || t('easy.image_alt');
  }, [question?.bonne_reponse, t]);

  const imageAlt = t('easy.image_alt');

  // Réf pour détecter un changement de question avant le rendu
  const questionRef = useRef(question);
  const emptyRemovedRef = useRef(new Set());
  const hasRecordedRef = useRef(false);

  const choiceDetailMap = useMemo(() => {
    const details = Array.isArray(question?.choice_taxa_details) ? question.choice_taxa_details : [];
    return new Map(details.map((detail) => [String(detail.taxon_id), detail]));
  }, [question?.choice_taxa_details]);

  const easyPairs = useMemo(() => {
    const labels = Array.isArray(question?.choix_mode_facile) ? question.choix_mode_facile : [];
    const ids = Array.isArray(question?.choix_mode_facile_ids) ? question.choix_mode_facile_ids : labels;
    return labels.map((((label, i) => {
      const id = ids[i] ?? label;
      return {
        id,
        label,
        detail: choiceDetailMap.get(String(id)),
      };
    })));
  }, [choiceDetailMap, question]);

  const fallbackLabel = question?.bonne_reponse?.preferred_common_name || question?.bonne_reponse?.common_name;
  const correctIndexFromServer = Number.isInteger(question?.choix_mode_facile_correct_index)
    ? question.choix_mode_facile_correct_index
    : Math.max(0, easyPairs.findIndex(p => p.label === fallbackLabel)); // fallback robuste

  const [answered, setAnswered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

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
    hasRecordedRef.current = false;
  }, [question]);

  const isCurrentQuestion = questionRef.current === question;
  const answeredThisQuestion = answered && isCurrentQuestion;
  const hintUsedThisQuestion = hintUsed && isCurrentQuestion;
  const activeRemovedIds = isCurrentQuestion ? removedIds : emptyRemovedRef.current;

  const remainingPairs = easyPairs.filter(p => !activeRemovedIds.has(String(p.id)));
  const correctPair = easyPairs[correctIndexFromServer];

  const isCorrectAnswer = answeredThisQuestion && selectedIndex !== null
    ? (remainingPairs[selectedIndex]?.id?.toString() === correctPair?.id?.toString())
    : false;

  const streakBonus = isCorrectAnswer ? 2 * (currentStreak + 1) : 0;
  const baseScoreInfo = computeScore({ mode: 'easy', isCorrect: isCorrectAnswer });
  
  // L'indice réduit l'XP gagné de -5 XP
  const hintPenalty = hintUsedThisQuestion ? -HINT_COST_XP : 0;
  const scoreInfo = { 
    ...baseScoreInfo, 
    bonus: (baseScoreInfo.bonus || 0) + hintPenalty, // Appliquer au bonus XP
    streakBonus 
  };



  const handleSelectAnswer = (idx) => {
    if (answeredThisQuestion) return;
    setSelectedIndex(idx);
    setAnswered(true);
    
    // Haptic feedback based on correctness
    const pair = remainingPairs[idx];
    const isCorrect = pair && correctPair && pair.id.toString() === correctPair.id.toString();
    if (isCorrect) {
      vibrateSuccess();
    } else {
      vibrateError();
    }
    
    const answeredQuestion = questionRef.current;
    setTimeout(() => {
      if (questionRef.current === answeredQuestion) {
        setShowSummary(true);
      }
    }, 1200);
  };

  const handleNext = () => {
    completeRound({
      ...scoreInfo,
      isCorrect: isCorrectAnswer,
      roundMeta: { ...roundMeta, wasCorrect: isCorrectAnswer },
    });
  };

  const handleHint = () => {
    if (hintUsedThisQuestion || answeredThisQuestion) return;

    // On choisit au hasard un leurre restant (≠ correct) parmi les non-supprimés
    const incorrectRemaining = remainingPairs.filter(p => p.id.toString() !== correctPair.id.toString());
    if (incorrectRemaining.length <= 1) return; // garder au moins 1 leurre
    const toRemove = incorrectRemaining[Math.floor(Math.random() * incorrectRemaining.length)];
    const newSet = new Set(removedIds);
    newSet.add(String(toRemove.id));
    setRemovedIds(newSet);
    setHintUsed(true);
    // L'indice coûte 5 XP (réduit le bonus XP)
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
    return pair && correctPair && pair.id.toString() === correctPair.id.toString();
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
            answeredThisQuestion ||
            remainingPairs.length <= 2
          }
        />
        <div className="card">
          <main className="game-main">
            <div className="image-section">
              {showAudio && (
                <div className="audio-panel">
                  <audio controls src={soundUrl} className="audio-player" preload="none" />
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
                    disabled={answeredThisQuestion}
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
