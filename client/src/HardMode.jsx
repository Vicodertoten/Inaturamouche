import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import './HardMode.css';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const INITIAL_GUESSES = 10;
const HINT_COST = 2;

function HardMode({ question, score, onNextQuestion, onQuit }) {
  const [knownTaxa, setKnownTaxa] = useState({});
  const [guesses, setGuesses] = useState(INITIAL_GUESSES);
  const [currentScore, setCurrentScore] = useState(score);
  const [incorrectGuessIds, setIncorrectGuessIds] = useState([]);

  useEffect(() => {
    setKnownTaxa({});
    setIncorrectGuessIds([]);
    setGuesses(INITIAL_GUESSES);
    setCurrentScore(score);
  }, [question, score]);

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
          newPoints += 10;
        }
      }
      
      setKnownTaxa(newKnownTaxa);
      setCurrentScore(prev => prev + newPoints);

      const isSpeciesGuessed = newKnownTaxa.species?.id === bonne_reponse.id;

      if (isSpeciesGuessed) {
        const finalPoints = newPoints + (newGuessesCount * 5);
        alert(`🎉 Espèce trouvée ! Bonus de ${finalPoints - newPoints} points !`);
        setTimeout(() => onNextQuestion(finalPoints), 2000);
      } else {
        const isSelectionCorrectAncestor = bonneReponseAncestorIds.has(guessedTaxonHierarchy.id);
        if (!isSelectionCorrectAncestor || newPoints === 0) {
          alert("Incorrect. Cette suggestion n'est pas une partie valide de la classification.");
          setIncorrectGuessIds(prev => [...prev, selection.id]);
        } else if (newPoints > 0) {
            alert(`Bonne branche ! Vous avez débloqué de nouveaux rangs supérieurs.`);
        }
        
        if (newGuessesCount <= 0) {
          alert("Partie terminée. La réponse était : " + bonne_reponse.name);
          setTimeout(() => onNextQuestion(0), 2000);
        }
      }

    } catch (error) {
      console.error("Erreur de validation", error);
      alert("Une erreur est survenue lors de la vérification.");
      if (guesses - 1 <= 0) {
        alert("Partie terminée. La réponse était : " + question.bonne_reponse.name);
        setTimeout(() => onNextQuestion(0), 2000);
      }
    }
  };

  const handleHint = () => {
    // ... (la logique de l'indice reste identique)
    if (guesses < HINT_COST) {
      alert("Pas assez de chances restantes pour un indice !");
      return;
    }
    const firstUnknownRank = RANKS.find(rank => !knownTaxa[rank]);
    if (firstUnknownRank) {
      setGuesses(prev => prev - HINT_COST);
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
  
  const isGameOver = knownTaxa.species || guesses <= 0;

  return (
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
        
        
       <div className="external-links-container">

          <a href={question.inaturalist_url} target="_blank" rel="noopener noreferrer" className="external-link">
            Voir sur iNaturalist
          </a>
          
          {question.bonne_reponse.wikipedia_url && (
            <a href={question.bonne_reponse.wikipedia_url} target="_blank" rel="noopener noreferrer" className="external-link">
               Page Wikipédia
            </a>
          )}
        </div>
      </div>

      <div className="actions-panel">
        <div className="hard-mode-stats">Chances : {guesses} | Score : {currentScore}</div>
        <div className="hard-mode-actions">
          <button onClick={onQuit} disabled={isGameOver}>Abandonner</button>
          <button onClick={handleHint} disabled={isGameOver || !RANKS.find(r => !knownTaxa[r])}>Indice (-{HINT_COST} essais )</button>
        </div>
      </div>
    </div>
  );
}

export default HardMode;