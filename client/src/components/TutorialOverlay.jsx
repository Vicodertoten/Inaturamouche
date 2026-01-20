import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './TutorialOverlay.css';

// ---------------------------------------------------------
// CONTENU DU TUTORIEL
// ---------------------------------------------------------
const STEPS = [
  {
    id: 'welcome',
    title: "Bienvenue, Naturaliste !",
    text: "Je suis le Professeur Mouche. Ma mission ? Vous aider à découvrir le monde vivant. Ensemble, nous allons observer, identifier et collectionner les espèces. Prêt pour l'aventure ?",
    targetClass: null, // Au centre
    position: 'center'
  },
  {
    id: 'daily',
    title: "Votre défi quotidien",
    text: "Chaque jour apporte son lot de surprises ! Ici, un nouveau défi vous attend. C'est souvent le meilleur moyen de gagner rapidement de l'expérience et de découvrir des espèces rares.",
    targetClass: '.daily-challenge-cta', // On vise le bouton du défi
    position: 'bottom'
  },
  {
    id: 'modes',
    title: "Votre laboratoire",
    text: "Vous voulez vous concentrer sur les oiseaux ? Les champignons ? Les plantes ? Configurez votre partie ici. Le mode Quiz est parfait pour débuter, tandis que l'Énigme vous mettra à l'épreuve.",
    targetClass: '.configurator-shell',
    position: 'center' // Centré de manière stratégique pour éviter les bugs de positionnement
  },
  {
    id: 'streak',
    title: "Vos séries",
    text: "Regardez ces compteurs importants. La série de jeu multiplie vos points quand vous enchaînez les bonnes réponses - attention, une erreur l'arrête ! La série journalière compte vos jours consécutifs de jeu, elle ne s'arrête jamais avec les erreurs. Le bouclier ne protège que la série de jeu.",
    targetClass: '.streak-badge-container',
    position: 'bottom'
  },
  {
    id: 'navigation',
    title: "Votre poste de commandement",
    text: "Voici vos outils principaux : signalez un problème si quelque chose ne va pas, explorez votre collection d'espèces découvertes, consultez votre profil pour voir votre progression et vos succès, et ajustez vos préférences selon vos goûts.",
    targetClass: '.main-nav', // La barre de navigation principale
    position: 'bottom'
  },
  {
    id: 'start',
    title: "À l'aventure !",
    text: "Vous avez maintenant tous les outils nécessaires. Lancez votre première identification et laissez-vous guider par la curiosité. La nature a tant de secrets à partager !",
    targetClass: '.play-btn', // Le bouton principal ou celui du daily
    position: 'top',
    action: true
  }
];

const TutorialOverlay = () => {
  const { showTutorial, completeTutorial } = useUser();
  const { t } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  
  // Petit état pour gérer si l'élément cible est introuvable (fallback au centre)
  const [isFallbackCenter, setIsFallbackCenter] = useState(false);

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
    } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
      e.preventDefault();
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex, handleNext, handleSkip]);

  // ---------------------------------------------------------
  // 🎯 LOGIQUE DE POSITIONNEMENT ROBUSTE
  // ---------------------------------------------------------
  useEffect(() => {
    const updateTargetPosition = () => {
      const step = STEPS[currentStepIndex];
      
      // Si pas de cible définie, on centre
      if (!step.targetClass) {
        setTargetRect(null);
        setIsFallbackCenter(false);
        return;
      }

      // On cherche l'élément
      const targetElement = document.querySelector(step.targetClass);
      
      if (targetElement) {
        // Pour toutes les étapes, on scroll vers l'élément pour l'assurer visibilité
        if (step.id !== 'welcome') { // Sauf pour welcome qui est déjà centré
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        const rect = targetElement.getBoundingClientRect();
        
        // Vérification si l'élément est visible à l'écran (non caché)
        if (rect.width === 0 && rect.height === 0) {
           setTargetRect(null);
           setIsFallbackCenter(true);
        } else {
           setTargetRect(rect);
           setIsFallbackCenter(false);
        }
      } else {
        // Si l'élément n'existe pas, on centre la bulle
        setTargetRect(null);
        setIsFallbackCenter(true);
      }
    };

    // Petit délai pour laisser le temps au DOM de se rendre (surtout au premier chargement)
    const timer = setTimeout(updateTargetPosition, 300); // Augmenté à 300ms

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [currentStepIndex]);

  useEffect(() => {
    if (showTutorial) {
        window.addEventListener('keydown', handleKeyDown);
    } else {
        window.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, showTutorial]);

  // Gestion du scroll - bloqué pendant le tutoriel
  useEffect(() => {
    if (showTutorial) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [showTutorial]);

  // Reset step index when tutorial restarts
  useEffect(() => {
    if (showTutorial) {
      setCurrentStepIndex(0);
    }
  }, [showTutorial]);

  if (!showTutorial) return null;

  const step = STEPS[currentStepIndex];
  // Logique de positionnement simplifiée
  const currentPosition = (isFallbackCenter || !targetRect) ? 'center' : step.position;

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true">
      {/* Le Backdrop avec le "trou" (mask). 
         Si targetRect est null, le backdrop est plein (opacité uniforme).
      */}
      <div
        className={`tutorial-backdrop ${targetRect && currentPosition !== 'center' ? 'has-target' : ''}`}
        style={targetRect ? {
          '--target-x': `${targetRect.left + targetRect.width / 2}px`,
          '--target-y': `${targetRect.top + targetRect.height / 2}px`,
          '--target-width': `${targetRect.width + 16}px`, // +16px de padding pour respirer
          '--target-height': `${targetRect.height + 16}px`
        } : {}}
        onClick={handleNext} // Cliquer à côté fait avancer (plus fluide)
      />

      <div
        className={`tutorial-card position-${currentPosition} step-anim`}
        style={targetRect ? {
          '--target-x': `${targetRect.left + targetRect.width / 2}px`,
          '--target-y': `${targetRect.top + targetRect.height / 2}px`,
           // Ajustement pour positionner la carte par rapport aux bords de l'élément
           '--target-top': `${targetRect.top}px`,
           '--target-bottom': `${targetRect.bottom}px`,
           '--target-left': `${targetRect.left}px`,
           '--target-right': `${targetRect.right}px`,
        } : {}}
      >
        <div className="tutorial-header">
           <h3>{step.title}</h3>
        </div>
        
        <div className="tutorial-content">
          <p>{step.text}</p>
        </div>

        <div className="tutorial-footer">
            <div className="tutorial-dots">
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  className={`progress-dot ${index === currentStepIndex ? 'active' : ''}`}
                />
              ))}
            </div>
            
            <div className="tutorial-buttons">
                <button className="tutorial-skip" onClick={handleSkip}>
                    {t('tutorial.skip', {}, 'Passer')}
                </button>
                <button className="tutorial-next btn-primary" onClick={handleNext}>
                    {step.action ? "C'est parti !" : t('tutorial.next', {}, 'Suivant →')}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;

