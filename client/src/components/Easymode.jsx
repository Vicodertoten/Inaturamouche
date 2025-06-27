import React, { useState, useEffect } from 'react';
import ImageViewer from './ImageViewer'; // Notez le chemin d'import mis à jour

const MAX_QUESTIONS_PER_GAME = 5;

const EasyMode = ({ question, score, questionCount, onAnswer }) => {
  const [answerStatus, setAnswerStatus] = useState({ answered: false, correctAnswer: '', selectedAnswer: '' });

  useEffect(() => {
    setAnswerStatus({ answered: false, correctAnswer: '', selectedAnswer: '' });
  }, [question]);

  const handleSelectAnswer = (selectedChoice) => {
    if (answerStatus.answered) return;
    const correctAnswer = question.bonne_reponse.common_name;
    const isCorrect = selectedChoice === correctAnswer;
    setAnswerStatus({ answered: true, correctAnswer, selectedAnswer: selectedChoice });
    setTimeout(() => onAnswer(isCorrect), 2000);
  };

  return (
    <div className="screen game-screen">
      <div className="card">
        <header className="game-header">
          <h2>Question {questionCount}/{MAX_QUESTIONS_PER_GAME}</h2>
          <h2 className="score">Score: {score}</h2>
        </header>
        <main className="game-main">
          <div className="image-section">
            <ImageViewer 
              imageUrls={question.image_urls || [question.image_url]}
              alt="Quelle est cette espèce ?"
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
          <div className="choices">
            {question.choix_mode_facile.map((choix) => {
              let buttonClass = '';
              if (answerStatus.answered) {
                if (choix === answerStatus.correctAnswer) buttonClass = 'correct';
                else if (choix === answerStatus.selectedAnswer) buttonClass = 'incorrect';
                else buttonClass = 'disabled';
              }
              return (
                <button key={choix} className={buttonClass} onClick={() => handleSelectAnswer(choix)} disabled={answerStatus.answered}>
                  {choix}
                </button>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default EasyMode;