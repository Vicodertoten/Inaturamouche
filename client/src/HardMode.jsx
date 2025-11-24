// src/HardMode.jsx (corrigé et amélioré)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import RoundSummaryModal from './components/RoundSummaryModal';
import './HardMode.css';
import { getTaxonDetails } from './services/api'; // NOUVEL IMPORT
import { computeScore } from './utils/scoring';
import StreakBadge from './components/StreakBadge';
import { useGame } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';
import PhylogeneticTree from './components/PhylogeneticTree.jsx';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const INITIAL_GUESSES = 6;
const REVEAL_HINT_COST = 2;

const SCORE_PER_RANK = {
  kingdom: 5,
  phylum: 10,
  class: 15,
  order: 20,
  family: 25,
  genus: 30,
  species: 40,
};

function HardMode() {
  const {
    question,
    score,
    nextImageUrl,
    currentStreak,
    completeRound,
    resetToLobby,
  } = useGame();
  const [knownTaxa, setKnownTaxa] = useState({});
  const [activeRank, setActiveRank] = useState(RANKS[0]);
  const [guesses, setGuesses] = useState(INITIAL_GUESSES);
  const [currentScore, setCurrentScore] = useState(score);
  const [incorrectGuessIds, setIncorrectGuessIds] = useState([]);
  
  const [roundStatus, setRoundStatus] = useState('playing');
  const [feedback, setFeedback] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [panelEffect, setPanelEffect] = useState('');
  const [roundMeta, setRoundMeta] = useState({
    mode: 'hard',
    hintsUsed: false,
    hintCount: 0,
  });
  const { t, language } = useLanguage();
  const feedbackTimeoutRef = useRef(null);
  const panelTimeoutRef = useRef(null);

  const targetLineage = useMemo(() => {
    const lineage = {};
    if (!question?.bonne_reponse) return lineage;
    RANKS.forEach((rank) => {
      if (rank === 'species') {
        lineage[rank] = question.bonne_reponse;
        return;
      }
      const match = question.bonne_reponse?.ancestors?.find((a) => a.rank === rank);
      if (match) lineage[rank] = match;
    });
    return lineage;
  }, [question]);

  const targetIds = useMemo(() => {
    const ids = new Set();
    if (question?.bonne_reponse?.id) ids.add(question.bonne_reponse.id);
    if (Array.isArray(question?.bonne_reponse?.ancestors)) {
      question.bonne_reponse.ancestors.forEach((taxon) => {
        if (taxon?.id) ids.add(taxon.id);
      });
    }
    return ids;
  }, [question]);

  const firstUnknownRank = useMemo(() => RANKS.find((rank) => !knownTaxa[rank]), [knownTaxa]);

  useEffect(() => {
    setKnownTaxa({});
    setIncorrectGuessIds([]);
    setGuesses(INITIAL_GUESSES);
    setCurrentScore(score);
    setRoundStatus('playing');
    setFeedback(null);
    setScoreInfo(null);
    setPanelEffect('');
    setRoundMeta({
      mode: 'hard',
      hintsUsed: false,
      hintCount: 0,
    });
    setActiveRank(RANKS[0]);
  }, [question, score]);
  
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (panelTimeoutRef.current) {
        clearTimeout(panelTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!firstUnknownRank) {
      if (activeRank !== 'species') {
        setActiveRank('species');
      }
      return;
    }
    if (!activeRank || knownTaxa[activeRank]) {
      setActiveRank(firstUnknownRank);
    }
  }, [activeRank, firstUnknownRank, knownTaxa]);

  const showFeedback = (message, type = 'info') => {
    setFeedback({ message, type });
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 3200);
  };

  const triggerPanelShake = () => {
    setPanelEffect('shake');
    if (panelTimeoutRef.current) {
      clearTimeout(panelTimeoutRef.current);
    }
    panelTimeoutRef.current = setTimeout(() => setPanelEffect(''), 600);
  };

  const handleGuess = async (selection) => {
    if (!selection?.id || roundStatus !== 'playing' || !question?.bonne_reponse || guesses <= 0) return;

    const updatedGuesses = guesses - 1;
    setGuesses(updatedGuesses);

    try {
      const guessedTaxonHierarchy = await getTaxonDetails(selection.id, language);
      if (!guessedTaxonHierarchy) throw new Error("Données du taxon invalides");

      const guessedLineage = [
        ...(Array.isArray(guessedTaxonHierarchy?.ancestors) ? guessedTaxonHierarchy.ancestors : []),
        guessedTaxonHierarchy,
      ];

      let gainedPoints = 0;
      const nextKnownTaxa = { ...knownTaxa };

      guessedLineage.forEach((taxon) => {
        const rank = taxon.rank;
        const targetTaxon = targetLineage[rank];
        if (!rank || !targetTaxon) return;
        if (targetTaxon.id === taxon.id && !nextKnownTaxa[rank]) {
          nextKnownTaxa[rank] = { id: taxon.id, taxon };
          gainedPoints += SCORE_PER_RANK[rank] || 0;
        }
      });

      const updatedScore = currentScore + gainedPoints;
      const roundPoints = updatedScore - score;
      if (gainedPoints > 0) {
        setKnownTaxa(nextKnownTaxa);
        setCurrentScore(updatedScore);
      }

      const isSpeciesGuessed = (nextKnownTaxa.species?.id || knownTaxa.species?.id) === question.bonne_reponse.id;
      const isSelectionCorrectAncestor = targetIds.has(guessedTaxonHierarchy.id);

      // --- Logique fin de partie ---
      if (isSpeciesGuessed) {
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: roundPoints,
          guessesRemaining: updatedGuesses,
          isCorrect: true
        });
        const streakBonus = 2 * (currentStreak + 1);
        setScoreInfo({ points, bonus, streakBonus });
        setRoundStatus('win');
        return;
      }

      if (updatedGuesses <= 0) {
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: roundPoints,
          guessesRemaining: updatedGuesses,
          isCorrect: false
        });
        setScoreInfo({ points, bonus, streakBonus: 0 });
        setRoundStatus('lose');
        return;
      }

      if (gainedPoints > 0) {
        showFeedback(t('hard.feedback.branch', { points: gainedPoints }), 'success');
      } else if (isSelectionCorrectAncestor) {
        showFeedback(t('hard.feedback.redundant'), 'info');
      } else {
        showFeedback(t('hard.feedback.wrong_branch'), 'error');
        setIncorrectGuessIds(prev => [...prev, selection.id]);
        triggerPanelShake();
      }

    } catch (error) {
      console.error("Erreur de validation", error);
      showFeedback(t('hard.feedback.error'), 'error');
      triggerPanelShake();
      if (updatedGuesses <= 0) {
        const totalPoints = currentScore - score;
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: totalPoints,
          guessesRemaining: updatedGuesses,
          isCorrect: false
        });
        setScoreInfo({ points, bonus, streakBonus: 0 });
        setRoundStatus('lose');
      }
    }
  };

  const handleNext = () => {
    // Réinitialise immédiatement l'état de fin de manche pour éviter
    // l'affichage furtif du résultat lors du chargement de la prochaine question.
    setRoundStatus('playing');
    setScoreInfo(null);

    const result = {
      points: scoreInfo?.points || 0,
      bonus: scoreInfo?.bonus || 0,
      streakBonus: scoreInfo?.streakBonus || 0,
      isCorrect: roundStatus === 'win'
    };
    completeRound({
      ...result,
      roundMeta: { ...roundMeta, wasCorrect: roundStatus === 'win' },
    });
  };

  const handleRevealNameHint = () => {
    if (roundStatus !== 'playing') return;
    if (guesses < REVEAL_HINT_COST) {
      showFeedback(t('hard.feedback.not_enough_guesses'), 'error');
      triggerPanelShake();
      return;
    }

    if (firstUnknownRank) {
      const newGuessesCount = guesses - REVEAL_HINT_COST;
      setGuesses(newGuessesCount);

      const rankLabel = t(`ranks.${firstUnknownRank}`);
      showFeedback(t('hard.feedback.hint_used', { rank: rankLabel }), 'info');
      
      const taxonData = targetLineage[firstUnknownRank];

      if (taxonData) {
        setKnownTaxa(prev => ({ 
          ...prev, 
          [firstUnknownRank]: { 
            id: taxonData.id, 
            taxon: taxonData
          }
        }));

        const isSpecies = firstUnknownRank === 'species';
        const speciesPoints = isSpecies ? (SCORE_PER_RANK.species || 0) : 0;
        const updatedScore = isSpecies ? currentScore + speciesPoints : currentScore;
        if (isSpecies && speciesPoints > 0) {
          setCurrentScore(updatedScore);
        }
        
        if (isSpecies) {
          const roundPoints = updatedScore - score;
          const { points, bonus } = computeScore({
            mode: 'hard',
            basePoints: roundPoints,
            guessesRemaining: newGuessesCount,
            isCorrect: true
          });
          const streakBonus = 2 * (currentStreak + 1);
          setScoreInfo({ points, bonus, streakBonus });
          setRoundStatus('win');
          return;
        }

        if (newGuessesCount <= 0) {
          const roundPoints = currentScore - score;
          const { points, bonus } = computeScore({
            mode: 'hard',
            basePoints: roundPoints,
            guessesRemaining: newGuessesCount,
            isCorrect: false
          });
          setScoreInfo({ points, bonus, streakBonus: 0 });
          setRoundStatus('lose');
        }
      }
      setRoundMeta((prev) => {
        return {
          ...prev,
          hintsUsed: true,
          hintCount: (prev.hintCount || 0) + 1,
        };
      });
    }
  };
  
  const isGameOver = roundStatus !== 'playing';
  const canUseAnyHint = !!firstUnknownRank;
  const placeholderText = t('hard.single_guess_placeholder_species', {}, "Devinez l'espèce...");

  const handleRankSelect = (rank) => {
    if (!rank || knownTaxa[rank]) return;
    setActiveRank(rank);
  };

  return (
    <>
      {isGameOver && (
        <RoundSummaryModal status={roundStatus} question={question} scoreInfo={scoreInfo} onNext={handleNext} />
      )}

      <div className="screen game-screen hard-mode">
        <div className="hard-mode-container">

          <div className="media-panel">
            <ImageViewer
              imageUrls={question.image_urls || [question.image_url]}
              photoMeta={question.image_meta}
              alt={t('hard.image_alt')}
              nextImageUrl={nextImageUrl}
            />
            <div className="hard-mode-stats">
              <span>{t('hard.stats_line', { guesses, score: currentScore })}</span>
              <StreakBadge streak={currentStreak} />
            </div>
          </div>

          <div className="proposition-panel tree-panel">
            <PhylogeneticTree
              knownTaxa={knownTaxa}
              targetTaxon={question?.bonne_reponse}
              activeRank={activeRank}
              onRankSelect={handleRankSelect}
            />
          </div>
        </div>

        <div className={`proposition-panel guess-panel floating ${panelEffect ? `panel-${panelEffect}` : ''}`}>
          <div className="guess-bar">
            <div className="guess-row">
              <AutocompleteInput
                key={`hard-guess-${Object.keys(knownTaxa).length}`}
                onSelect={handleGuess}
                disabled={isGameOver || guesses <= 0}
                placeholder={placeholderText}
                incorrectAncestorIds={incorrectGuessIds}
              />
              <div className="guess-actions-inline">
                <button 
                  onClick={handleRevealNameHint} 
                  disabled={
                    isGameOver ||
                    !canUseAnyHint ||
                    guesses < REVEAL_HINT_COST
                  }
                  className="action-button hint"
                >
                  {t('hard.reveal_button', { cost: REVEAL_HINT_COST })}
                </button>
                <button onClick={() => resetToLobby(true)} disabled={isGameOver} className="action-button quit">
                  {t('common.quit')}
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
    </>
  );
}

export default HardMode;
