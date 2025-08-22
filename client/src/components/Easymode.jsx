import React, { useState, useEffect } from 'react';
import ImageViewer from './ImageViewer';
import RoundSummaryModal from './RoundSummaryModal';

const MAX_QUESTIONS_PER_GAME = 5;
const HINT_COST_EASY = 5; // Pénalité de 5 points pour utiliser l'indice

// MODIFIÉ: Ajout de onUpdateScore pour la pénalité de l'indice
const EasyMode = ({ question, score, questionCount, onAnswer, onUpdateScore, nextImageUrl }) => {
  const [answerStatus, setAnswerStatus] = useState({ answered: false, correctAnswer: '', selectedAnswer: '' });
  const [showSummary, setShowSummary] = useState(false);
  
  // NOUVEAU: États pour l'indice
  const [removedChoices, setRemovedChoices] = useState([]);
  const [hintUsed, setHintUsed] = useState(false);

  useEffect(() => {
    setAnswerStatus({ answered: false, correctAnswer: '', selectedAnswer: '' });
    setShowSummary(false);
    // NOUVEAU: Réinitialiser l'indice
    setRemovedChoices([]);
    setHintUsed(false);
  }, [question]);

  const handleSelectAnswer = (selectedChoice) => {
    if (answerStatus.answered) return;
    const correctAnswer = question.bonne_reponse.common_name;
    setAnswerStatus({ answered: true, correctAnswer, selectedAnswer: selectedChoice });
    
    // MODIFIÉ: On attend une seconde pour que le joueur voie la correction, PUIS on affiche le modal
    setTimeout(() => {
      setShowSummary(true);
    }, 1200); 
  };
  
  const handleNext = () => {
    const isCorrect = answerStatus.selectedAnswer === answerStatus.correctAnswer;
    // Le score est déjà déduit si l'indice a été utilisé
    onAnswer(isCorrect, isCorrect ? 10 : 0); 
  };

  const handleHint = () => {
    if (hintUsed || answerStatus.answered) return;

    const incorrectChoices = question.choix_mode_facile.filter(
      choix => choix !== question.bonne_reponse.common_name && !removedChoices.includes(choix)
    );

    if (incorrectChoices.length > 1) { // On s'assure de ne pas enlever le dernier leurre
      const choiceToRemove = incorrectChoices[Math.floor(Math.random() * incorrectChoices.length)];
      setRemovedChoices([...removedChoices, choiceToRemove]);
      setHintUsed(true);
      onUpdateScore(-HINT_COST_EASY); // Appliquer la pénalité
    }
  };

  return (
    <>
      {showSummary && (
        <RoundSummaryModal
          status={answerStatus.selectedAnswer === answerStatus.correctAnswer ? 'win' : 'lose'}
          question={question}
          scoreInfo={{ 
            points: answerStatus.selectedAnswer === answerStatus.correctAnswer ? 10 : 0, 
            bonus: 0 
          }}
          onNext={handleNext}
        />
      )}

      <div className="screen game-screen">
        <div className="card">
          <header className="game-header">
            <div className="header-left">
              <h2>Question {questionCount}/{MAX_QUESTIONS_PER_GAME}</h2>
              {/* NOUVEAU: Bouton d'indice */}
              <button 
                className="hint-button-easy" 
                onClick={handleHint} 
                disabled={hintUsed || answerStatus.answered || (question.choix_mode_facile.length - removedChoices.length <= 2)}
              >
                Indice (-{HINT_COST_EASY} pts)
              </button>
            </div>
            <h2 className="score">Score: {score}</h2>
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
              {question.choix_mode_facile.map((choix) => {
                let buttonClass = '';
                if (answerStatus.answered) {
                  if (choix === answerStatus.correctAnswer) buttonClass = 'correct';
                  else if (choix === answerStatus.selectedAnswer) buttonClass = 'incorrect';
                  else buttonClass = 'disabled';
                }
                // NOUVEAU: Logique pour griser le choix enlevé par l'indice
                if (removedChoices.includes(choix)) {
                  buttonClass = 'removed';
                }

                return (
                  <button 
                    key={choix} 
                    className={buttonClass} 
                    onClick={() => handleSelectAnswer(choix)} 
                    disabled={answerStatus.answered || removedChoices.includes(choix)}
                  >
                    {choix}
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