// src/HardMode.jsx (corrigé et amélioré)

import React, { useState, useEffect } from 'react';
import ImageViewer from './components/ImageViewer';
import AutocompleteInput from './AutocompleteInput';
import RoundSummaryModal from './components/RoundSummaryModal';
import './HardMode.css';
import { getTaxonDetails } from './services/api'; // NOUVEL IMPORT
import { computeScore } from './utils/scoring';
import StreakBadge from './components/StreakBadge';

const RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const INITIAL_GUESSES = 6;
const REVEAL_HINT_COST = 2;

const SCORE_PER_RANK = { kingdom:5, phylum:10, class:15, order:20, family:25, genus:30, species:40 };

function HardMode({ question, score, onNextQuestion, onQuit, nextImageUrl, currentStreak }) {
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

  const showFeedback = (msg) => { setFeedbackMessage(msg); setTimeout(() => setFeedbackMessage(''), 3000); };

  const handleGuess = async (selection) => {
    if (!selection?.id) return;
    const newGuessesCount = guesses - 1; setGuesses(newGuessesCount);
    try {
      const guessed = await getTaxonDetails(selection.id);
      if (!guessed) throw new Error("Données du taxon invalides");

      const { bonne_reponse } = question;
      const bonneSet = new Set(bonne_reponse.ancestors.map(a => a.id).concat(bonne_reponse.id));

      let newKnown = { ...knownTaxa };
      let add = 0;
      const toCheck = [...guessed.ancestors, guessed];

      for (const t of toCheck) {
        if (bonneSet.has(t.id) && RANKS.includes(t.rank) && !newKnown[t.rank]) {
          newKnown[t.rank] = { id: t.id, name: t.preferred_common_name || t.name };
          add += SCORE_PER_RANK[t.rank] || 0;
        }
      }

      const roundPoints = currentScore + add - score;
      setKnownTaxa(newKnown);
      setCurrentScore(p => p + add);

      const guessedSpecies = newKnown.species?.id === bonne_reponse.id;
      if (guessedSpecies) {
        const { points, bonus } = computeScore({ mode: 'hard', basePoints: roundPoints, guessesRemaining: newGuessesCount, isCorrect: true });
        const streakBonus = 2 * (currentStreak + 1);
        setScoreInfo({ points, bonus, streakBonus }); setRoundStatus('win'); return;
      }

      if (newGuessesCount <= 0) {
        const { points, bonus } = computeScore({ mode: 'hard', basePoints: roundPoints, guessesRemaining: newGuessesCount, isCorrect: false });
        setScoreInfo({ points, bonus, streakBonus: 0 }); setRoundStatus('lose'); return;
      }

      if (add > 0) showFeedback(`Bonne branche ! +${add} points !`);
      else if (bonneSet.has(guessed.id)) showFeedback("Correct, mais pas de nouveau rang révélé.");
      else { showFeedback("Incorrect : pas dans la bonne lignée."); setIncorrectGuessIds(prev => [...prev, selection.id]); }

    } catch (err) {
      console.error("Erreur de validation", err);
      showFeedback("Erreur lors de la vérification.");
      if (guesses - 1 <= 0) {
        const total = currentScore - score;
        const { points, bonus } = computeScore({ mode: 'hard', basePoints: total, guessesRemaining: guesses - 1, isCorrect: false });
        setScoreInfo({ points, bonus, streakBonus: 0 }); setRoundStatus('lose');
      }
    }
  };

  const handleNext = () => {
    const result = {
      points: scoreInfo?.points || 0,
      bonus: scoreInfo?.bonus || 0,
      streakBonus: scoreInfo?.streakBonus || 0,
      isCorrect: roundStatus === 'win'
    };
    onNextQuestion(result);
  };

  const handleRevealNameHint = () => {
    if (guesses < REVEAL_HINT_COST) { showFeedback("Pas assez de chances pour cet indice !"); return; }
    const firstUnknown = RANKS.find(r => !knownTaxa[r]);
    if (!firstUnknown) return;

    const newGuesses = guesses - REVEAL_HINT_COST; setGuesses(newGuesses);
    const data = firstUnknown === 'species' ? question.bonne_reponse : question.bonne_reponse.ancestors.find(a => a.rank === firstUnknown);
    if (!data) return;

    setKnownTaxa(prev => ({ ...prev, [firstUnknown]: { id: data.id, name: data.preferred_common_name ? `${data.preferred_common_name} (${data.name})` : data.name } }));
    showFeedback(`Indice : ${firstUnknown} révélé.`);

    if (firstUnknown === 'species') {
      const add = SCORE_PER_RANK.species || 0;
      const roundPoints = currentScore + add - score; setCurrentScore(p => p + add);
      const { points, bonus } = computeScore({ mode: 'hard', basePoints: roundPoints, guessesRemaining: newGuesses, isCorrect: true });
      const streakBonus = 2 * (currentStreak + 1);
      setScoreInfo({ points, bonus, streakBonus }); setRoundStatus('win');
    } else if (newGuesses <= 0) {
      const roundPoints = currentScore - score;
      const { points, bonus } = computeScore({ mode: 'hard', basePoints: roundPoints, guessesRemaining: newGuesses, isCorrect: false });
      setScoreInfo({ points, bonus, streakBonus: 0 }); setRoundStatus('lose');
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
                      extraParams={{ rank }}
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
            nextImageUrl={nextImageUrl}
          />
        </div>

        <div className="actions-panel">
          {feedbackMessage && <div className="feedback-bar" aria-live="polite">{feedbackMessage}</div>}
          <div className="hard-mode-stats">
            <span>Chances : {guesses} | Score : {currentScore}</span>
            <StreakBadge streak={currentStreak} />
          </div>
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
