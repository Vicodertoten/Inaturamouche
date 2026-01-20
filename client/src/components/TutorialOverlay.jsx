import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './TutorialOverlay.css';

const STEPS = [
  {
    id: 'welcome',
    title: "Bienvenue Explorateur 🌿",
    text: "Bienvenue, explorateur ! Ton but est d'identifier les espèces pour compléter ta collection.",
    targetClass: null,
    position: 'center'
  },
  {
    id: 'streak',
    title: "Le Bouclier Vital 🛡️",
    text: "Ceci est ta protection. Une erreur et c'est perdu ! Garde ton Streak actif pour gagner plus d'XP.",
    targetClass: '.streak-badge-container',
    position: 'top'
  },
  {
    id: 'modes',
    title: "Choisis ton Défi 🎯",
    text: "Le mode Quiz est idéal pour débuter. Le mode Riddle (Énigmes) est réservé aux experts !",
    targetClass: '.configurator-shell',
    position: 'bottom'
  },
  {
    id: 'start',
    title: "À toi de jouer !",
    text: "Prêt pour ta première identification ?",
    targetClass: '.play-btn',
    position: 'top',
    action: true
  }
];

const TutorialOverlay = () => {
  const { showTutorial, completeTutorial } = useUser();
  const { t } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeTutorial();
    }
  }, [currentStepIndex, completeTutorial]);

  const handleSkip = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleSkip();
    } else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
      e.preventDefault();
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex, handleNext, handleSkip]);

  useEffect(() => {
    const updateTargetPosition = () => {
      const step = STEPS[currentStepIndex];
      if (step.targetClass) {
        const targetElement = document.querySelector(step.targetClass);
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateTargetPosition();
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [currentStepIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!showTutorial) return null;

  const step = STEPS[currentStepIndex];

  return (
    <div className="tutorial-overlay">
      <div
        className={`tutorial-backdrop step-${step.id}`}
        style={targetRect ? {
          '--target-x': `${targetRect.left + targetRect.width / 2}px`,
          '--target-y': `${targetRect.top + targetRect.height / 2}px`,
          '--target-width': `${targetRect.width}px`,
          '--target-height': `${targetRect.height}px`
        } : {}}
      />

      <div
        className={`tutorial-card position-${step.position}`}
        style={targetRect ? {
          '--target-x': `${targetRect.left + targetRect.width / 2}px`,
          '--target-y': `${targetRect.top + targetRect.height / 2}px`
        } : {}}
      >
        <div className="tutorial-content">
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>

        <div className="tutorial-progress">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`progress-dot ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`}
            />
          ))}
        </div>

        <div className="tutorial-footer">
          <button className="tutorial-skip" onClick={handleSkip}>
            {t('tutorial.skip', {}, 'Passer')}
          </button>
          <button className="tutorial-next" onClick={handleNext}>
            {step.action ? t('tutorial.start', {}, "C'est parti !") : t('tutorial.next', {}, 'Suivant')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;

