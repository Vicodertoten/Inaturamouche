import React, { useState, useEffect, useMemo } from 'react';
import ImageViewer from './ImageViewer';
import RoundSummaryModal from './RoundSummaryModal';
import { computeScore } from '../utils/scoring';
import StreakBadge from './StreakBadge';

const MAX_QUESTIONS_PER_GAME = 5;
const HINT_COST_EASY = 5; // Pénalité de 5 points pour utiliser l'indice

/**
 * EasyMode corrigé :
 * - Affiche les labels de question.choix_mode_facile
 * - Utilise question.choix_mode_facile_ids (aligné index ↔ label) pour la sélection
 * - Vérifie la bonne réponse via question.choix_mode_facile_correct_index
 * - L’indice retire des choix en se basant sur les IDs (pas les labels)
 */
const EasyMode = ({ question, score, questionCount, onAnswer, onUpdateScore, nextImageUrl, currentStreak }) => {
  // Paires (id, label) alignées. Fallback si serveur ancien (sans ids/index).
  const easyPairs = useMemo(() => {
    const labels = Array.isArray(question?.choix_mode_facile) ? question.choix_mode_facile : [];
    const ids = Array.isArray(question?.choix_mode_facile_ids) ? question.choix_mode_facile_ids : labels;
    return labels.map((label, i) => ({ id: ids[i] ?? label, label }));
  }, [question]);

  const correctIndexFromServer = Number.isInteger(question?.choix_mode_facile_correct_index)
    ? question.choix_mode_facile_correct_index
    : Math.max(0, easyPairs.findIndex(p => p.label === question?.bonne_reponse?.common_name)); // fallback robuste

  const [answered, setAnswered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  // Indice (ids supprimés)
  const [removedIds, setRemovedIds] = useState(new Set());
  const [hintUsed, setHintUsed] = useState(false);

  useEffect(() => {
    setAnswered(false);
    setSelectedIndex(null);
    setShowSummary(false);
    setRemovedIds(new Set());
    setHintUsed(false);
  }, [question]);

  const remainingPairs = easyPairs.filter(p => !removedIds.has(String(p.id)));
  const correctPair = easyPairs[correctIndexFromServer];

  const isCorrectAnswer = answered && selectedIndex !== null
    ? (remainingPairs[selectedIndex]?.id?.toString() === correctPair?.id?.toString())
    : false;

  const streakBonus = isCorrectAnswer ? 2 * (currentStreak + 1) : 0;
  const scoreInfo = { ...computeScore({ mode: 'easy', isCorrect: isCorrectAnswer }), streakBonus };

  const handleSelectAnswer = (idx) => {
    if (answered) return;
    setSelectedIndex(idx);
    setAnswered(true);
    setTimeout(() => setShowSummary(true), 1200);
  };

  const handleNext = () => {
    onAnswer({ ...scoreInfo, isCorrect: isCorrectAnswer });
  };

  const handleHint = () => {
    if (hintUsed || answered) return;

    // On choisit au hasard un leurre restant (≠ correct) parmi les non-supprimés
    const incorrectRemaining = remainingPairs.filter(p => p.id.toString() !== correctPair.id.toString());
    if (incorrectRemaining.length <= 1) return; // garder au moins 1 leurre
    const toRemove = incorrectRemaining[Math.floor(Math.random() * incorrectRemaining.length)];
    const newSet = new Set(removedIds);
    newSet.add(String(toRemove.id));
    setRemovedIds(newSet);
    setHintUsed(true);
    onUpdateScore(-HINT_COST_EASY);
  };

  // Pour déterminer les classes d'état, on compare via IDs
  const isIndexCorrect = (idx) => {
    const pair = remainingPairs[idx];
    return pair && correctPair && pair.id.toString() === correctPair.id.toString();
  };

  return (
    <>
      {showSummary && (
        <RoundSummaryModal
          status={isCorrectAnswer ? 'win' : 'lose'}
          question={question}
          scoreInfo={scoreInfo}
          onNext={handleNext}
        />
      )}

      <div className="screen game-screen easy-mode">
        <div className="card">
          <header className="game-header">
            <div className="header-left">
              <h2>Question {questionCount}/{MAX_QUESTIONS_PER_GAME}</h2>
              <button
                className="hint-button-easy"
                onClick={handleHint}
                disabled={
                  hintUsed ||
                  answered ||
                  remainingPairs.length <= 2 // ne retire pas si déjà 2 choix (bon + 1 leurre)
                }
              >
                Indice (-{HINT_COST_EASY} pts)
              </button>
            </div>
            <div className="score-container">
              <h2 className="score">Score: {score}</h2>
              <StreakBadge streak={currentStreak} />
            </div>
          </header>

          <main className="game-main">
            <div className="image-section">
              <ImageViewer
                imageUrls={question.image_urls || [question.image_url]}
                alt="Quelle est cette espèce ?"
                nextImageUrl={nextImageUrl}
              />
            </div>

            <div className="choices">
              {remainingPairs.map((p, idx) => {
                let buttonClass = '';
                if (answered) {
                  if (isIndexCorrect(idx)) buttonClass = 'correct';
                  else if (idx === selectedIndex) buttonClass = 'incorrect';
                  else buttonClass = 'disabled';
                }
                return (
                  <button
                    key={p.id ?? p.label}
                    className={buttonClass}
                    onClick={() => handleSelectAnswer(idx)}
                    disabled={answered}
                  >
                    {p.label}
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
