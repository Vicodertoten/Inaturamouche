// src/HardMode.jsx (mis à jour)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import RoundSummaryModal from './components/RoundSummaryModal'; // NOUVEAU: Import du modal
import './HardMode.css';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const INITIAL_GUESSES = 10;
const REVEAL_HINT_COST = 2;

const SCORE_PER_RANK = {
  kingdom: 5,
  phylum: 10,
  class: 15,
  order: 20,
  family: 25,
  genus: 30,
  species: 40, // Points pour la découverte du rang, le bonus final s'ajoute
};


function HardMode({ question, score, onNextQuestion, onQuit }) {
   const [knownTaxa, setKnownTaxa] = useState({});
  const [guesses, setGuesses] = useState(10); // Initial guesses
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
  
  // NOUVEAU: Fonction pour afficher un feedback temporaire
  const showFeedback = (message) => {
    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(''), 2500);
  };

  const handleGuess = async (selection) => {
    if (!selection || !selection.id) return;

    const newGuessesCount = guesses - 1;
    setGuesses(newGuessesCount);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/taxon/${selection.id}`);
      
      const guessedTaxonHierarchy = response.data;
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

      if (isSpeciesGuessed) {
        // MODIFIÉ: Logique de victoire
        const bonusPoints = newGuessesCount * 5;
        setScoreInfo({ points: newPoints, bonus: bonusPoints });
        setRoundStatus('won'); // Déclenche le modal de victoire
      } else {
        const isSelectionCorrectAncestor = bonneReponseAncestorIds.has(guessedTaxonHierarchy.id);
        if (newPoints > 0) {
            showFeedback(`Bonne branche ! +${newPoints} points !`);
        } else if (isSelectionCorrectAncestor) {
            // NOUVEAU CAS: Bonne lignée, mais rien de nouveau n'a été débloqué
            showFeedback("Correct, mais cette proposition n'a pas révélé de nouveau rang. Essayez un taxon différent.");
        } else {
            // Cas existant: Totalement incorrect
            showFeedback("Incorrect. Cette suggestion n'est pas dans la bonne lignée.");
            setIncorrectGuessIds(prev => [...prev, selection.id]);
        }
        
        if (newGuessesCount <= 0) {
          // MODIFIÉ: Logique de défaite
          setScoreInfo({ points: newPoints, bonus: 0 });
          setRoundStatus('lost'); // Déclenche le modal de défaite
        }
      }

    } catch (error) {
      console.error("Erreur de validation", error);
      showFeedback("Une erreur est survenue lors de la vérification."); // MODIFIÉ
      if (guesses - 1 <= 0) {
        setScoreInfo({ points: 0, bonus: 0 });
        setRoundStatus('lost');
      }
    }
  };
  
  const handleNext = () => {
    // MODIFIÉ: Gère le clic sur "Question Suivante" dans le modal
    const totalPoints = (scoreInfo?.points || 0) + (scoreInfo?.bonus || 0);
    onNextQuestion(totalPoints);
  };

  const handleRevealNameHint = () => {
    if (guesses < REVEAL_HINT_COST) {
      showFeedback("Pas assez de chances pour cet indice !");
      return;
    }
    const firstUnknownRank = RANKS.find(rank => !knownTaxa[rank]);
    if (firstUnknownRank) {
      setGuesses(prev => prev - REVEAL_HINT_COST);
      showFeedback(`Indice utilisé ! Le rang '${firstUnknownRank}' a été révélé.`);
      const taxonData = firstUnknownRank === 'species' 
        ? question.bonne_reponse 
        : question.bonne_reponse.ancestors.find(a => a.rank === firstUnknownRank);
      if (taxonData) {
        setKnownTaxa(prev => ({ ...prev, 
          [firstUnknownRank]: { 
            id: taxonData.id, 
            name: taxonData.preferred_common_name ? `${taxonData.preferred_common_name} (${taxonData.name})` : taxonData.name
          }
        }));
      }
    }
  };
  console.log("Données de la bonne réponse :", question.bonne_reponse);
  
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
          {feedbackMessage && <div className="feedback-bar">{feedbackMessage}</div>}
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