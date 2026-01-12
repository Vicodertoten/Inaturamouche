// src/HardMode.jsx (corrigé et amélioré)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import RoundSummaryModal from './components/RoundSummaryModal';
import './HardMode.css';
import { getTaxonDetails } from './services/api'; // NOUVEL IMPORT
import { computeScore } from './utils/scoring';
import StreakBadge from './components/StreakBadge';
import { useGameData } from './context/GameContext';
import { useLanguage } from './context/LanguageContext.jsx';
import { useUser } from './context/UserContext.jsx';
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
    endGame,
    mediaType,
    questionCount,
    maxQuestions,
  } = useGameData();
  const { updatePokedex } = useUser();
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
  const soundUrl = question?.sounds?.[0]?.file_url;
  const showAudio = (mediaType === 'sounds' || mediaType === 'both') && !!soundUrl;
  const showImage = mediaType === 'images' || mediaType === 'both' || (mediaType === 'sounds' && !soundUrl);
  const hasQuestionLimit = Number.isInteger(maxQuestions) && maxQuestions > 0;
  const imageAlt = useMemo(() => {
    const taxon = question?.bonne_reponse;
    const common = taxon?.preferred_common_name || taxon?.common_name;
    const scientific = taxon?.name;
    if (common && scientific && common !== scientific) return `${common} (${scientific})`;
    return common || scientific || t('hard.image_alt');
  }, [question?.bonne_reponse, t]);
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
    setRoundStatus('playing');
    setScoreInfo(null);
  
    const isCorrect = roundStatus === 'win';
    const species = question.bonne_reponse;
    const thumbnail = question.image_urls?.[0];
    if (species) {
      updatePokedex(species, isCorrect, thumbnail);
    }
  
    const result = {
      points: scoreInfo?.points || 0,
      bonus: scoreInfo?.bonus || 0,
      streakBonus: scoreInfo?.streakBonus || 0,
      isCorrect,
    };
  
    completeRound({
      ...result,
      roundMeta: { ...roundMeta, wasCorrect: isCorrect },
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

  return (
    <>
      {isGameOver && (
        <RoundSummaryModal status={roundStatus} question={question} scoreInfo={scoreInfo} onNext={handleNext} />
      )}

      <div className="screen game-screen hard-mode">
        <div className="hard-mode-container">
          <header className="hard-mode-header">
            <div className="header-stats">
              <div className="stat-pill score-pill">
                <span className="pill-label">{t('hard.stats.score', {}, 'Score')}</span>
                <span className="pill-value">{currentScore}</span>
              </div>
              <div className="stat-pill">
                <span className="pill-label">{t('hard.stats.question', {}, 'Question')}</span>
                <span className="pill-value">
                  {hasQuestionLimit ? `${questionCount}/${maxQuestions}` : questionCount}
                </span>
              </div>
              <div className={`stat-pill lives-pill ${guesses <= 1 ? 'critical' : ''}`}>
                <span className="pill-label">{t('hard.stats.guesses', {}, 'Vies')}</span>
                <span className="pill-value">{guesses}</span>
              </div>
              <div className="streak-chip">
                <StreakBadge streak={currentStreak} />
              </div>
            </div>
            <div className="header-actions">
              <button onClick={endGame} disabled={isGameOver} className="action-button quit">
                {t('common.finish')}
              </button>
            </div>
          </header>

          <div className="hard-mode-layout">
            <div className="media-column">
              <div className="left-stack">
                <div className="media-panel">
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

                <div className={`proposition-panel guess-panel ${panelEffect ? `panel-${panelEffect}` : ''}`}>
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

            <div className="tree-column">
              <div className="proposition-panel tree-panel">
                <PhylogeneticTree
                  knownTaxa={knownTaxa}
                  targetTaxon={question?.bonne_reponse}
                  activeRank={activeRank}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default HardMode;
