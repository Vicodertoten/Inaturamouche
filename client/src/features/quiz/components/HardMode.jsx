// src/features/quiz/components/HardMode.jsx (Version corrigée - BUG FIX:  question change auto-complete)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ImageViewer from '../../../components/ImageViewer';
import AutocompleteInput from '../../../shared/ui/AutocompleteInput';
import RoundSummaryModal from '../../../components/RoundSummaryModal';
import GameHeader from '../../../components/GameHeader';
import LevelUpNotification from '../../../components/LevelUpNotification';
import FloatingXPIndicator from '../../../components/FloatingXPIndicator';
import PhylogeneticTree from '../../../components/PhylogeneticTree.jsx';
import './HardMode.css';
import { getTaxonDetails } from '../../../services/api';
import { computeScore, computeInGameStreakBonus } from '../../../utils/scoring';
import { useGameData } from '../../../context/GameContext';
import { useUser } from '../../../context/UserContext';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { vibrateSuccess, vibrateError } from '../../../utils/haptics';
import { notify } from '../../../services/notifications';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const INITIAL_GUESSES = 3;
const REVEAL_HINT_XP_COST = 20;
const MAX_HINTS = 1;

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
  const { profile, updateProfile } = useUser();

  // États principaux
  const [knownTaxa, setKnownTaxa] = useState({});
  const [activeRank, setActiveRank] = useState(RANKS[0]);
  const [guesses, setGuesses] = useState(INITIAL_GUESSES);
  const [incorrectGuessIds, setIncorrectGuessIds] = useState([]);
  const [roundStatus, setRoundStatus] = useState('playing');
  const [feedback, setFeedback] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [panelEffect, setPanelEffect] = useState('');
  const [currentScore, setCurrentScore] = useState(0);
  const [isGuessing, setIsGuessing] = useState(false); // Prevent concurrent guesses
  const [liveXPGain, setLiveXPGain] = useState(0); // For floating XP indicator
  const [roundMeta, setRoundMeta] = useState({
    mode:  'hard',
    hintsUsed:  false,
    hintCount:  0,
  });

  const { t, language } = useLanguage();
  const feedbackTimeoutRef = useRef(null);
  const panelTimeoutRef = useRef(null);
  
  // FIX: Référence pour tracker la question actuelle (comme EasyMode)
  const questionRef = useRef(question);

  // Computed values
  const soundUrl = question?.sounds?.[0]?.file_url;
  const showAudio = (mediaType === 'sounds' || mediaType === 'both') && !!soundUrl;
  const showImage = mediaType === 'images' || mediaType === 'both' || (mediaType === 'sounds' && !soundUrl);

  // `imageAltRaw` may contain the answer (used elsewhere). Do NOT pass it
  // directly to the image `alt` attribute to avoid revealing the answer
  // on long-press/context menu on mobile. Use a generic alt for the image.
  const imageAltRaw = useMemo(() => {
    const taxon = question?.bonne_reponse;
    const common = taxon?. preferred_common_name || taxon?.common_name;
    const scientific = taxon?.name;
    if (common && scientific && common !== scientific) return `${common} (${scientific})`;
    return common || scientific || t('hard.image_alt');
  }, [question?.bonne_reponse, t]);

  const imageAlt = t('hard.image_alt');

  const targetLineage = useMemo(() => {
    const lineage = {};
    if (! question?.bonne_reponse) return lineage;
    RANKS.forEach((rank) => {
      if (rank === 'species') {
        lineage[rank] = question. bonne_reponse;
      } else {
        const match = question.bonne_reponse?. ancestors?.find((a) => a.rank === rank);
        if (match) lineage[rank] = match;
      }
    });
    return lineage;
  }, [question]);

  const targetIds = useMemo(() => {
    const ids = new Set();
    if (question?.bonne_reponse?. id) ids.add(question.bonne_reponse.id);
    if (Array.isArray(question?.bonne_reponse?.ancestors)) {
      question. bonne_reponse.ancestors.forEach((taxon) => {
        if (taxon?. id) ids.add(taxon.id);
      });
    }
    return ids;
  }, [question]);

  const firstUnknownRank = useMemo(() => RANKS.find((rank) => !knownTaxa[rank]), [knownTaxa]);

  // FIX: Vérifier si c'est toujours la même question
  const isCurrentQuestion = questionRef.current === question;

  // Reset à chaque nouvelle question
  useEffect(() => {
    questionRef.current = question; // FIX: Mettre à jour la référence
    setKnownTaxa({});
    setIncorrectGuessIds([]);
    setGuesses(INITIAL_GUESSES);
    setRoundStatus('playing');
    setFeedback(null);
    setScoreInfo(null);
    setPanelEffect('');
    setCurrentScore(0);
    setIsGuessing(false); // Reset guessing lock
    setLiveXPGain(0); // Reset XP indicator
    setRoundMeta({
      mode: 'hard',
      hintsUsed: false,
      hintCount: 0,
    });
    setActiveRank(RANKS[0]);
  }, [question]);

  // Cleanup des timers
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (panelTimeoutRef.current) clearTimeout(panelTimeoutRef.current);
    };
  }, []);

  // Gestion du rang actif
  useEffect(() => {
    if (! firstUnknownRank) {
      if (activeRank !== 'species') setActiveRank('species');
      return;
    }
    if (! activeRank || knownTaxa[activeRank]) {
      setActiveRank(firstUnknownRank);
    }
  }, [activeRank, firstUnknownRank, knownTaxa]);

  // FIX: Auto-défaite si 0 vies (avec vérification de la question actuelle)
  useEffect(() => {
    // ✅ Seulement si on est toujours sur la même question
    if (isCurrentQuestion && roundStatus === 'playing' && guesses <= 0) {
      setScoreInfo({
        points: currentScore,
        bonus: 0,
        streakBonus: 0,
        guessesRemaining: 0
      });
      setRoundStatus('lose');
    }
  }, [guesses, roundStatus, isCurrentQuestion, currentScore]);

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

  /**
   * Calcul unifié des points finaux incluant tous les rangs découverts
   */
  const calculateFinalScore = useCallback((knownTaxaObj) => {
    let totalPoints = 0;
    RANKS.forEach(rank => {
      if (knownTaxaObj[rank]) {
        totalPoints += SCORE_PER_RANK[rank] || 0;
      }
    });
    return totalPoints;
  }, []);

  /**
   * Fin de partie unifiée pour éviter les incohérences
   */
  const endRound = useCallback((isVictory, finalKnownTaxa, remainingGuesses) => {
    const finalScore = calculateFinalScore(finalKnownTaxa);
    
    setCurrentScore(finalScore);
    setScoreInfo({
      points: finalScore,
      bonus: 0, // Sera calculé dans handleNext avec computeScore
      streakBonus: 0, // Sera calculé dans handleNext
      guessesRemaining: isVictory ? remainingGuesses : 0
    });
    setRoundStatus(isVictory ? 'win' : 'lose');
  }, [calculateFinalScore]);

  const handleGuess = async (selection) => {
    // Prevent concurrent guesses
    if (!selection?.id || roundStatus !== 'playing' || !question?.bonne_reponse || guesses <= 0 || isGuessing) return;

    setIsGuessing(true); // Lock guessing during async operation
    const updatedGuesses = guesses - 1;
    setGuesses(updatedGuesses);

    try {
      const guessedTaxonHierarchy = await getTaxonDetails(selection.id, language);
      if (! guessedTaxonHierarchy) throw new Error("Données du taxon invalides");

      const guessedLineage = [
        ...(Array.isArray(guessedTaxonHierarchy?.ancestors) ? guessedTaxonHierarchy.ancestors : []),
        guessedTaxonHierarchy,
      ];

      let gainedPoints = 0;
      const nextKnownTaxa = { ...knownTaxa };

      guessedLineage.forEach((taxon) => {
        const rank = taxon.rank;
        const targetTaxon = targetLineage[rank];
        if (! rank || !targetTaxon) return;
        if (targetTaxon.id === taxon.id && ! nextKnownTaxa[rank]) {
          nextKnownTaxa[rank] = { id: taxon.id, taxon };
          gainedPoints += SCORE_PER_RANK[rank] || 0;
        }
      });

      // Mise à jour immédiate des états si gains
      if (gainedPoints > 0) {
        setKnownTaxa(nextKnownTaxa);
        setCurrentScore(prev => prev + gainedPoints);
        
        // Haptic feedback for correct guess
        vibrateSuccess();
        
        // Live XP feedback: Show floating animation
        setLiveXPGain(gainedPoints);
        showFeedback(t('hard.feedback.branch', { points: gainedPoints }), 'success');
      }

      const isSpeciesGuessed = nextKnownTaxa.species?.id === question.bonne_reponse.id;
      const isSelectionCorrectAncestor = targetIds.has(guessedTaxonHierarchy.id);

      // --- Logique de fin de partie ---
      if (isSpeciesGuessed) {
        endRound(true, nextKnownTaxa, updatedGuesses);
        return;
      }

      if (updatedGuesses <= 0) {
        endRound(false, nextKnownTaxa, 0);
        return;
      }

      // Feedback intermédiaire
      if (gainedPoints > 0) {
        // XP feedback already displayed at line 247
      } else if (isSelectionCorrectAncestor) {
        showFeedback(t('hard.feedback.redundant'), 'info');
      } else {
        // Haptic feedback for incorrect guess
        vibrateError();
        showFeedback(t('hard.feedback.wrong_branch'), 'error');
        setIncorrectGuessIds(prev => [...prev, selection.id]);
        triggerPanelShake();
      }

    } catch (error) {
      console.error('[HardMode] Error in handleGuess:', error);
      showFeedback(t('hard.feedback.error'), 'error');
      triggerPanelShake();
      
      if (updatedGuesses <= 0) {
        endRound(false, knownTaxa, 0);
      }
    } finally {
      // Always unlock guessing, regardless of success or error
      setIsGuessing(false);
    }
  };

  const handleNext = () => {
    setRoundStatus('playing');
    const savedScoreInfo = scoreInfo;
    setScoreInfo(null);

    const isCorrect = roundStatus === 'win';

    // Pas de streak bonus si indice utilisé
    const streakBonusCalc = (isCorrect && !roundMeta.hintsUsed) 
      ? computeInGameStreakBonus(currentStreak, 'hard') 
      : 0;

    // Calcul du score de base avec bonus de vies
    const baseScoreInfo = computeScore({
      mode: 'hard',
      isCorrect: isCorrect,
      basePoints: savedScoreInfo?.points || 0,
      guessesRemaining: savedScoreInfo?.guessesRemaining || 0
    });

    // Hint cost is now deducted from profile XP, not from bonus
    const finalScoreInfo = {
      points:  baseScoreInfo.points,
      bonus: baseScoreInfo.bonus || 0,
      streakBonus: streakBonusCalc
    };

    completeRound({
      ...finalScoreInfo,
      isCorrect,
      roundMeta: { ...roundMeta, wasCorrect: isCorrect },
    });
  };

  // Check if user has enough XP to use a hint
  const userXP = profile?.xp || 0;
  const canAffordHint = userXP >= REVEAL_HINT_XP_COST;

  const handleRevealNameHint = () => {
    if (roundStatus !== 'playing') return;
    
    if (roundMeta.hintCount >= MAX_HINTS) {
      showFeedback(t('hard.feedback.hint_limit', {}, 'Vous avez déjà utilisé votre indice'), 'error');
      triggerPanelShake();
      return;
    }

    // Check if user has enough XP
    if (!canAffordHint) {
      showFeedback(t('hints.not_enough_xp', { cost: REVEAL_HINT_XP_COST }, `XP insuffisant (${REVEAL_HINT_XP_COST} XP requis)`), 'error');
      triggerPanelShake();
      return;
    }

    if (! firstUnknownRank) return;

    const taxonData = targetLineage[firstUnknownRank];
    if (!taxonData) return;

    // Déduire le coût XP du profil utilisateur
    updateProfile((prev) => ({
      ...prev,
      xp: Math.max(0, (prev?.xp || 0) - REVEAL_HINT_XP_COST),
    }));

    const rankLabel = t(`ranks.${firstUnknownRank}`);
    showFeedback(t('hard.feedback.hint_used', { rank: rankLabel, cost: REVEAL_HINT_XP_COST }), 'info');
    
    notify(t('hints.used', { cost: REVEAL_HINT_XP_COST }, `-${REVEAL_HINT_XP_COST} XP`), {
      type: 'info',
      duration: 2000,
    });

    // Marquer l'indice comme utilisé
    setRoundMeta(prev => ({
      ...prev,
      hintsUsed: true,
      hintCount: 1,
    }));

    // Ajouter le taxon révélé ET calculer les points immédiatement
    const nextKnownTaxa = {
      ...knownTaxa,
      [firstUnknownRank]: { id: taxonData.id, taxon: taxonData }
    };

    setKnownTaxa(nextKnownTaxa);

    // Calculer les points du rang dévoilé
    const rankPoints = SCORE_PER_RANK[firstUnknownRank] || 0;
    const updatedScore = currentScore + rankPoints;
    setCurrentScore(updatedScore);

    // Si c'était l'espèce, victoire sans bonus
    if (firstUnknownRank === 'species') {
      setScoreInfo({
        points:  updatedScore,
        bonus:  0,
        streakBonus: 0,
        guessesRemaining: 0
      });
      setRoundStatus('win');
    }
  };

  const isGameOver = roundStatus !== 'playing';
  const canUseAnyHint = !!firstUnknownRank && roundMeta.hintCount < MAX_HINTS && canAffordHint;
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

      {/* Floating XP indicator for live feedback */}
      <FloatingXPIndicator xpGain={liveXPGain} position="center" />

      {isGameOver && isCurrentQuestion && (
        <RoundSummaryModal
          status={roundStatus}
          question={question}
          scoreInfo={scoreInfo}
          onNext={handleNext}
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

                <div className={`proposition-panel guess-panel ${panelEffect ?  `panel-${panelEffect}` : ''}`}>
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
                          disabled={isGameOver || !canUseAnyHint}
                          className={`action-button hint ${!canAffordHint ? 'insufficient-xp' : ''}`}
                          aria-label={t('hard.reveal_button_xp', { cost: REVEAL_HINT_XP_COST }, `Révéler (-${REVEAL_HINT_XP_COST} XP)`)}
                          title={!canAffordHint ? t('hints.not_enough_xp_tooltip', { cost: REVEAL_HINT_XP_COST, current: userXP }, `XP insuffisant (${userXP}/${REVEAL_HINT_XP_COST})`) : ''}
                        >
                          {t('hard.reveal_button_xp', { cost: REVEAL_HINT_XP_COST }, `Révéler (-${REVEAL_HINT_XP_COST} XP)`)}
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