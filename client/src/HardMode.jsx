// src/HardMode.jsx (corrigé et amélioré)

import React, { useState, useEffect } from 'react';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import RoundSummaryModal from './components/RoundSummaryModal';
import './HardMode.css';
import { getTaxonDetails } from './services/api'; // NOUVEL IMPORT
import { computeScore } from './utils/scoring';


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

function HardMode({ question, score, onNextQuestion, onQuit }) {
  const [knownTaxa, setKnownTaxa] = useState({});
  const [guesses, setGuesses] = useState(INITIAL_GUESSES);
  const [currentScore, setCurrentScore] = useState(score);
  const [incorrectGuessIds, setIncorrectGuessIds] = useState([]);
  
  const [roundStatus, setRoundStatus] = useState('playing');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [scoreInfo, setScoreInfo] = useState(null);

  useEffect(() => {
    setKnownTaxa({});
    setIncorrectGuessIds([]);
    setGuesses(INITIAL_GUESSES);
    setCurrentScore(score);
    setRoundStatus('playing');
    setFeedbackMessage('');
    setScoreInfo(null);
  }, [question, score]);
  
  const showFeedback = (message) => {
    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(''), 3000);
  };

  const handleGuess = async (selection) => {
    if (!selection || !selection.id) return;

    const newGuessesCount = guesses - 1;
    setGuesses(newGuessesCount);

    try {
      const guessedTaxonHierarchy = await getTaxonDetails(selection.id);
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
            name: taxon.preferred_common_name || taxon.name
          };
          newPoints += SCORE_PER_RANK[taxon.rank] || 0;
        }
      }
      
      setKnownTaxa(newKnownTaxa);
      setCurrentScore(prev => prev + newPoints);
      
      const isSpeciesGuessed = newKnownTaxa.species?.id === bonne_reponse.id;

      // --- CORRECTION MAJEURE : Logique de fin de partie restructurée ---

      // 1. On vérifie la condition de VICTOIRE en premier
      if (isSpeciesGuessed) {
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: newPoints,
          guessesRemaining: newGuessesCount,
          isCorrect: true
        });
        setScoreInfo({ points, bonus });
        setRoundStatus('win');
        return; // On arrête la fonction ici, c'est gagné.
      }

      // 2. Si ce n'est pas gagné, on vérifie la condition de DÉFAITE
      if (newGuessesCount <= 0) {
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: newPoints,
          guessesRemaining: newGuessesCount,
          isCorrect: false
        });
        setScoreInfo({ points, bonus });
        setRoundStatus('lose');
        return; // On arrête la fonction, c'est perdu.
      }

      // 3. Si la partie n'est ni gagnée ni perdue, on continue et on donne du feedback
      const isSelectionCorrectAncestor = bonneReponseAncestorIds.has(guessedTaxonHierarchy.id);
      if (newPoints > 0) {
        showFeedback(`Bonne branche ! +${newPoints} points !`);
      } else if (isSelectionCorrectAncestor) {
        showFeedback("Correct, mais cette proposition n'a pas révélé de nouveau rang.");
      } else {
        showFeedback("Incorrect. Cette suggestion n'est pas dans la bonne lignée.");
        setIncorrectGuessIds(prev => [...prev, selection.id]);
      }

    } catch (error) {
      console.error("Erreur de validation", error);
      showFeedback("Une erreur est survenue lors de la vérification.");
      // Sécurité : si une erreur arrive au dernier essai, on termine la partie
      if (newGuessesCount <= 0) {
        const { points, bonus } = computeScore({
          mode: 'hard',
          basePoints: 0,
          guessesRemaining: newGuessesCount,
          isCorrect: false
        });
        setScoreInfo({ points, bonus });
        setRoundStatus('lose');
      }
    }
  };
  
  const handleNext = () => {
    const result = {
      points: scoreInfo?.points || 0,
      bonus: scoreInfo?.bonus || 0,
      isCorrect: roundStatus === 'win'
    };
    onNextQuestion(result);
  };

  const handleRevealNameHint = () => {
    if (guesses < REVEAL_HINT_COST) {
      showFeedback("Pas assez de chances pour cet indice !");
      return;
    }

    const firstUnknownRank = RANKS.find(rank => !knownTaxa[rank]);
    if (firstUnknownRank) {
      // On calcule immédiatement le nouveau nombre de chances
      const newGuessesCount = guesses - REVEAL_HINT_COST;
      setGuesses(newGuessesCount);

      showFeedback(`Indice utilisé ! Le rang '${firstUnknownRank}' a été révélé.`);
      
      const taxonData = firstUnknownRank === 'species' 
        ? question.bonne_reponse 
        : question.bonne_reponse.ancestors.find(a => a.rank === firstUnknownRank);

      if (taxonData) {
        setKnownTaxa(prev => ({ 
          ...prev, 
          [firstUnknownRank]: { 
            id: taxonData.id, 
            name: taxonData.preferred_common_name ? `${taxonData.preferred_common_name} (${taxonData.name})` : taxonData.name
          }
        }));
        
        // D'abord, on vérifie si l'indice donne la victoire
        if (firstUnknownRank === 'species') {
          const speciesPoints = SCORE_PER_RANK.species || 0;
          setCurrentScore(prev => prev + speciesPoints);
          const { points, bonus } = computeScore({
            mode: 'hard',
            basePoints: speciesPoints,
            guessesRemaining: newGuessesCount,
            isCorrect: true
          });
          setScoreInfo({ points, bonus });
          setRoundStatus('win');
          return; // La partie est gagnée, on arrête tout
        }

        // NOUVEAU : Si ce n'est pas une victoire, on vérifie si l'indice a causé une défaite
        if (newGuessesCount <= 0) {
          const { points, bonus } = computeScore({
            mode: 'hard',
            basePoints: 0,
            guessesRemaining: newGuessesCount,
            isCorrect: false
          });
          setScoreInfo({ points, bonus });
          setRoundStatus('lose');
        }
      }
    }
  };
  
  const isGameOver = roundStatus !== 'playing';
  const canUseAnyHint = !!RANKS.find(r => !knownTaxa[r]);

  return (
<>
      {isGameOver && (
        <RoundSummaryModal status={roundStatus} question={question} scoreInfo={scoreInfo} onNext={handleNext} />
      )}

      <div className="hard-mode-container">
        <h2 className="main-hard-mode-title">Identifier l'espèce</h2>
        
        <div className="proposition-panel">
          <form onSubmit={(e) => e.preventDefault()} className="ranks-form">
            <div className="ranks-list">
              {RANKS.map((rank) => (
                <div className="rank-item" key={rank}>
                  <label>{rank.charAt(0).toUpperCase() + rank.slice(1)}</label>
                  {knownTaxa[rank] ? (
                    <div className="known-taxon">{knownTaxa[rank].name}</div>
                  ) : (
                    <AutocompleteInput
                      key={`${rank}-${Object.keys(knownTaxa).length}`}
                      onSelect={handleGuess}
                      extraParams={{ rank: rank }}
                      disabled={isGameOver}
                      placeholder={`Entrez un ${rank}...`}
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
            alt="Espèce à identifier" 
          />
        </div>

        <div className="actions-panel">
          {feedbackMessage && (
            <div className="feedback-bar" aria-live="polite">{feedbackMessage}</div>
          )}
          <div className="hard-mode-stats">Chances : {guesses} | Score : {currentScore}</div>
          
          {/* MODIFIÉ: Grille d'actions pour inclure les nouveaux indices */}
          <div className="hard-mode-actions">
            <button onClick={onQuit} disabled={isGameOver} className="action-button quit">Abandonner</button>
            <button 
              onClick={handleRevealNameHint} 
              disabled={isGameOver || !canUseAnyHint || guesses < REVEAL_HINT_COST}
              className="action-button hint"
            >
              Révéler (-{REVEAL_HINT_COST} chances)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default HardMode;
