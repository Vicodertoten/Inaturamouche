// src/HardMode.jsx (corrigé et amélioré)

import React, { useState, useEffect, useRef } from 'react';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import RoundSummaryModal from './components/RoundSummaryModal';
import './HardMode.css';
import { getTaxonDetails } from './services/api'; // NOUVEL IMPORT
import { computeScore } from './utils/scoring';
import StreakBadge from './components/StreakBadge';
import { useGame } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';

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
  const { t, language, getTaxonDisplayNames } = useLanguage();
  const feedbackTimeoutRef = useRef(null);
  const panelTimeoutRef = useRef(null);

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
    if (!selection || !selection.id) return;

    const newGuessesCount = guesses - 1;
    setGuesses(newGuessesCount);

    try {
      const guessedTaxonHierarchy = await getTaxonDetails(selection.id, language);
      if (!guessedTaxonHierarchy) throw new Error("Données du taxon invalides");

      const { bonne_reponse } = question;
      const bonneReponseAncestorIds = new Set(bonne_reponse.ancestors.map(a => a.id).concat(bonne_reponse.id));

      let newKnownTaxa = { ...knownTaxa };
      let newPoints = 0;
      const taxaToCheck = [...guessedTaxonHierarchy.ancestors, guessedTaxonHierarchy];

      for (const taxon of taxaToCheck) {
        if (bonneReponseAncestorIds.has(taxon.id) && RANKS.includes(taxon.rank) && !newKnownTaxa[taxon.rank]) {
          newKnownTaxa[taxon.rank] = {
            id: taxon.id,
            taxon,
          };
          newPoints += SCORE_PER_RANK[taxon.rank] || 0;
        }
      }

      const roundPoints = currentScore + newPoints - score;
      setKnownTaxa(newKnownTaxa);
      setCurrentScore(prev => prev + newPoints);

      const isSpeciesGuessed = newKnownTaxa.species?.id === bonne_reponse.id;

      // --- Logique fin de partie ---
      if (isSpeciesGuessed) {
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
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: roundPoints,
          guessesRemaining: newGuessesCount,
          isCorrect: false
        });
        setScoreInfo({ points, bonus, streakBonus: 0 });
        setRoundStatus('lose');
        return;
      }

      const isSelectionCorrectAncestor = bonneReponseAncestorIds.has(guessedTaxonHierarchy.id);
      if (newPoints > 0) {
        showFeedback(t('hard.feedback.branch', { points: newPoints }), 'success');
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
      if (newGuessesCount <= 0) {
        const totalPoints = currentScore - score;
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: totalPoints,
          guessesRemaining: newGuessesCount,
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
    if (guesses < REVEAL_HINT_COST) {
      showFeedback(t('hard.feedback.not_enough_guesses'), 'error');
      triggerPanelShake();
      return;
    }

    const firstUnknownRank = RANKS.find(rank => !knownTaxa[rank]);
    if (firstUnknownRank) {
      const newGuessesCount = guesses - REVEAL_HINT_COST;
      setGuesses(newGuessesCount);

      const rankLabel = t(`ranks.${firstUnknownRank}`);
      showFeedback(t('hard.feedback.hint_used', { rank: rankLabel }), 'info');
      
      const taxonData = firstUnknownRank === 'species' 
        ? question.bonne_reponse 
        : question.bonne_reponse.ancestors.find(a => a.rank === firstUnknownRank);

      if (taxonData) {
        setKnownTaxa(prev => ({ 
          ...prev, 
          [firstUnknownRank]: { 
            id: taxonData.id, 
            taxon: taxonData
          }
        }));
        
        if (firstUnknownRank === 'species') {
          const speciesPoints = SCORE_PER_RANK.species || 0;
          const roundPoints = currentScore + speciesPoints - score;
          setCurrentScore(prev => prev + speciesPoints);
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
  const canUseAnyHint = !!RANKS.find(r => !knownTaxa[r]);

  return (
    <>
      {isGameOver && (
        <RoundSummaryModal status={roundStatus} question={question} scoreInfo={scoreInfo} onNext={handleNext} />
      )}

      <div className="screen game-screen hard-mode">
        <div className="hard-mode-container">

        <div className={`proposition-panel ${panelEffect ? `panel-${panelEffect}` : ''}`}>
          <form onSubmit={(e) => e.preventDefault()} className="ranks-form">
            <div className="ranks-list">
              {RANKS.map((rank) => (
                <div className="rank-item" key={rank}>
                  <label>{t(`ranks.${rank}`)}</label>
                  {knownTaxa[rank] ? (
                    <div className="known-taxon">
                      {(() => {
                        const { primary, secondary } = getTaxonDisplayNames(knownTaxa[rank].taxon);
                        return (
                          <>
                            {primary}
                            {secondary && <small className="known-taxon-secondary">{secondary}</small>}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <AutocompleteInput
                      key={`${rank}-${Object.keys(knownTaxa).length}`}
                      onSelect={handleGuess}
                      extraParams={{ rank: rank }}
                      disabled={isGameOver}
                      placeholder={t('hard.rank_placeholder', { rank: t(`ranks.${rank}`) })}
                      incorrectAncestorIds={incorrectGuessIds}
                    />
                  )}
                </div>
              ))}
            </div>
          </form>
        </div>

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

        <div className="actions-panel">
          {feedback?.message && (
            <div className={`feedback-bar ${feedback.type}`} aria-live="polite">
              {feedback.message}
            </div>
          )}
          <div className="hard-mode-actions">
            <button onClick={() => resetToLobby(true)} disabled={isGameOver} className="action-button quit">{t('common.quit')}</button>
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
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

export default HardMode;
