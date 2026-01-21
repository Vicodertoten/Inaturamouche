import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import './TutorialOverlay.css';

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

const TutorialOverlay = () => {
  const { showTutorial, completeTutorial } = useUser();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = useMemo(
    () => [
      {
        id: 'welcome',
        title: t('tutorial.step_welcome_title', {}, 'Bienvenue, naturaliste !'),
        text: t(
          'tutorial.step_welcome_text',
          {},
          "Ici le Professeur Mouche. Inaturamouche existe pour apprendre le vivant : observer, comprendre, mémoriser."
        ),
        note: t(
          'tutorial.step_welcome_note',
          {},
          "Je te guide pas à pas et je te fais visiter l'application."
        ),
        route: '/',
        position: 'center',
      },
      {
        id: 'daily',
        title: t('tutorial.step_daily_title', {}, 'Défi du jour'),
        text: t(
          'tutorial.step_daily_text',
          {},
          "Un run court, renouvelé chaque jour. Idéal pour lancer ta streak et croiser des espèces rares."
        ),
        route: '/',
        targetSelector: '.tutorial-daily-challenge',
        position: 'auto',
      },
      {
        id: 'review',
        title: t('tutorial.step_review_title', {}, 'Révisions intelligentes'),
        text: t(
          'tutorial.step_review_text',
          {},
          "Quand tu hésites, je note. Le mode Révision repropose ces espèces pour les ancrer durablement."
        ),
        note: t(
          'tutorial.step_review_note',
          {},
          "Si la carte n'apparaît pas encore, elle se débloque après tes premières parties."
        ),
        route: '/',
        targetSelector: '.tutorial-review-card',
        position: 'auto',
      },
      {
        id: 'packs',
        title: t('tutorial.step_packs_title', {}, 'Packs thématiques'),
        text: t(
          'tutorial.step_packs_text',
          {},
          "Choisis un pack pour définir ton terrain d'étude : oiseaux, champignons, arbres..."
        ),
        bullets: [
          t('tutorial.step_packs_bullet_1', {}, 'Un pack = un écosystème.'),
          t('tutorial.step_packs_bullet_2', {}, 'Plus de packs = plus de diversité.'),
          t('tutorial.step_packs_bullet_3', {}, 'Mode personnalisé pour créer ton propre terrain.'),
        ],
        route: '/',
        targetSelector: '.tutorial-pack-grid',
        position: 'auto',
        highlightSelector: '.pack-card, .pack-card-glow',
        spotlightPadding: 26,
        spotlightRadius: 28,
      },
      {
        id: 'modes',
        title: t('tutorial.step_modes_title', {}, 'Modes de jeu'),
        text: t(
          'tutorial.step_modes_text',
          {},
          "Change de rythme selon ton énergie. Chaque mode entraîne une compétence."
        ),
        bullets: [
          t('tutorial.step_modes_bullet_1', {}, 'Quiz : choix multiples, parfait pour démarrer.'),
          t('tutorial.step_modes_bullet_2', {}, 'Énigme : indices progressifs, logique fine.'),
          t('tutorial.step_modes_bullet_3', {}, 'Difficile : gravis la taxonomie.'),
          t('tutorial.step_modes_bullet_4', {}, 'Taxonomique : ascension complète (niveau expert).'),
        ],
        route: '/',
        targetSelector: '.tutorial-mode-cards',
        position: 'auto',
      },
      {
        id: 'settings',
        title: t('tutorial.step_settings_title', {}, 'Réglages de partie'),
        text: t(
          'tutorial.step_settings_text',
          {},
          "Choisis la durée et les médias. Les sons sont parfaits pour entraîner l'oreille."
        ),
        note: t(
          'tutorial.step_settings_note',
          {},
          "En Énigme, les sons sont désactivés pour garder les indices cohérents."
        ),
        route: '/',
        targetSelector: '.tutorial-game-settings',
        position: 'auto',
      },
      {
        id: 'navigation',
        title: t('tutorial.step_navigation_title', {}, 'Navigation rapide'),
        text: t(
          'tutorial.step_navigation_text',
          {},
          "Tout est à portée : collection, profil, signalement, réglages."
        ),
        route: '/',
        targetSelector: '.tutorial-main-nav, .tutorial-bottom-nav',
        highlightSelector: '.tutorial-nav-home, .tutorial-nav-collection, .tutorial-nav-profile, .tutorial-nav-report, .tutorial-nav-settings',
        position: 'auto',
        skipScroll: true,
        nextLabel: t('tutorial.step_navigation_next', {}, 'Voir la collection'),
      },
      {
        id: 'collection',
        title: t('tutorial.step_collection_title', {}, 'Ta collection vivante'),
        text: t(
          'tutorial.step_collection_text',
          {},
          'Ici, tu vois ce que tu as découvert et ce qui reste à maîtriser.'
        ),
        bullets: [
          t('tutorial.step_collection_bullet_1', {}, "Clique un groupe pour explorer l'ensemble."),
          t('tutorial.step_collection_bullet_2', {}, 'Filtre et trie tes trouvailles.'),
          t('tutorial.step_collection_bullet_3', {}, 'Les fantômes = vus mais pas encore maîtrisés.'),
        ],
        route: '/collection',
        targetSelector: '.tutorial-collection-grid',
        position: 'auto',
        nextLabel: t('tutorial.step_collection_next', {}, 'Voir le profil'),
      },
      {
        id: 'profile',
        title: t('tutorial.step_profile_title', {}, 'Ton profil'),
        text: t(
          'tutorial.step_profile_text',
          {},
          'Ton tableau de bord : niveau, XP, avatar, titres et bordures.'
        ),
        bullets: [
          t('tutorial.step_profile_bullet_1', {}, 'Résumé : progression globale.'),
          t('tutorial.step_profile_bullet_2', {}, 'Stats : précision et packs joués.'),
          t('tutorial.step_profile_bullet_3', {}, 'Succès : défis et récompenses.'),
        ],
        route: '/profile',
        targetSelector: '.tutorial-profile-hero',
        position: 'auto',
      },
      {
        id: 'streaks',
        title: t('tutorial.step_streaks_title', {}, 'Streaks & boucliers'),
        text: t(
          'tutorial.step_streaks_text',
          {},
          'La streak quotidienne récompense ta régularité. Les boucliers sauvent ta streak de jeu.'
        ),
        note: t(
          'tutorial.step_streaks_note',
          {},
          "En partie, la streak de bonnes réponses monte vite — protège-la !"
        ),
        route: '/profile',
        targetSelector: '.tutorial-streaks',
        position: 'auto',
      },
      {
        id: 'tabs',
        title: t('tutorial.step_tabs_title', {}, 'Révisions & progression'),
        text: t(
          'tutorial.step_tabs_text',
          {},
          'Onglet Statistiques = révisions, packs, précision. Onglet Succès = titres, bordures, bonus.'
        ),
        route: '/profile',
        targetSelector: '.tutorial-profile-tabs',
        position: 'auto',
        nextLabel: t('tutorial.step_tabs_next', {}, 'Retour au labo'),
      },
      {
        id: 'wrap',
        title: t('tutorial.step_wrap_title', {}, 'À toi de jouer !'),
        text: t(
          'tutorial.step_wrap_text',
          {},
          "Explore, collectionne, reviens demain. Je suis là pour t'aider à apprendre."
        ),
        route: '/',
        targetSelector: '.tutorial-start-game',
        position: 'auto',
      },
    ],
    [t]
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [isFallbackCenter, setIsFallbackCenter] = useState(false);
  const [cardStyle, setCardStyle] = useState({});
  const [cardPlacement, setCardPlacement] = useState('center');
  const [viewportTick, setViewportTick] = useState(0);
  const requestedRouteRef = useRef(null);
  const cardRef = useRef(null);

  const step = steps[currentStepIndex];

  const finishTutorial = useCallback(() => {
    completeTutorial();
    if (location.pathname !== '/') {
      navigate('/');
    }
  }, [completeTutorial, location.pathname, navigate]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      finishTutorial();
    }
  }, [currentStepIndex, finishTutorial, steps.length]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    finishTutorial();
  }, [finishTutorial]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        handleSkip();
      } else if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleBack();
      }
    },
    [handleBack, handleNext, handleSkip]
  );

  useEffect(() => {
    if (!showTutorial) return;

    const activeStep = steps[currentStepIndex];
    if (!activeStep?.route) return;

    if (location.pathname === activeStep.route) {
      requestedRouteRef.current = null;
      return;
    }

    if (requestedRouteRef.current !== activeStep.route) {
      requestedRouteRef.current = activeStep.route;
      navigate(activeStep.route);
    }
  }, [currentStepIndex, location.pathname, navigate, showTutorial, steps]);

  useEffect(() => {
    if (!showTutorial || !step) return;

    setTargetRect(null);
    setIsFallbackCenter(false);

    const updateTargetPosition = () => {
      const isRouteMatch = !step.route || location.pathname === step.route;
      if (!isRouteMatch) {
        setTargetRect(null);
        setIsFallbackCenter(true);
        return;
      }

      if (!step.targetSelector) {
        setTargetRect(null);
        setIsFallbackCenter(false);
        return;
      }

      const targetCandidates = Array.from(document.querySelectorAll(step.targetSelector));
      let targetElement = null;
      let rect = null;

      for (const candidate of targetCandidates) {
        const candidateRect = candidate.getBoundingClientRect();
        if (candidateRect.width > 0 && candidateRect.height > 0) {
          targetElement = candidate;
          rect = candidateRect;
          break;
        }
      }

      if (!targetElement) {
        setTargetRect(null);
        setIsFallbackCenter(true);
        return;
      }

      if (!step.skipScroll) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      setTargetRect(rect);
      setIsFallbackCenter(false);
    };

    const timer = setTimeout(updateTargetPosition, 320);

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [location.pathname, showTutorial, step]);

  useEffect(() => {
    if (!showTutorial || !step?.highlightSelector) return;
    const elements = Array.from(document.querySelectorAll(step.highlightSelector));
    elements.forEach((el) => el.classList.add('tutorial-highlight'));
    return () => {
      elements.forEach((el) => el.classList.remove('tutorial-highlight'));
    };
  }, [location.pathname, showTutorial, step?.highlightSelector]);

  useEffect(() => {
    if (!showTutorial) return;
    const handleResize = () => setViewportTick((prev) => prev + 1);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showTutorial]);

  useEffect(() => {
    if (showTutorial) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, showTutorial]);

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

  useEffect(() => {
    if (showTutorial) {
      setCurrentStepIndex(0);
      setCardPlacement('center');
      setCardStyle({});
      requestedRouteRef.current = null;
    }
  }, [showTutorial]);

  if (!showTutorial || !step) return null;

  const isCentered = isFallbackCenter || !targetRect;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredPosition =
    isCentered
      ? 'center'
      : step.position === 'auto'
        ? targetRect.top > viewportHeight * 0.55
          ? 'top'
          : 'bottom'
        : step.position;

  const spotlightPadding = step.spotlightPadding ?? 12;
  const spotlightRect = targetRect
    ? (() => {
        const rawLeft = targetRect.left - spotlightPadding;
        const rawTop = targetRect.top - spotlightPadding;
        const rawWidth = targetRect.width + spotlightPadding * 2;
        const rawHeight = targetRect.height + spotlightPadding * 2;
        const left = clampValue(rawLeft, 8, viewportWidth - 8);
        const top = clampValue(rawTop, 8, viewportHeight - 8);
        const width = Math.max(0, Math.min(rawWidth, viewportWidth - left - 8));
        const height = Math.max(0, Math.min(rawHeight, viewportHeight - top - 8));
        if (width === 0 || height === 0) return null;
        return { left, top, width, height };
      })()
    : null;
  const hasSpotlight = Boolean(
    spotlightRect && !isCentered && spotlightRect.width > 0 && spotlightRect.height > 0
  );
  const spotlightRadius = step.spotlightRadius ?? 18;

  useLayoutEffect(() => {
    if (!showTutorial) return;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const margin = 16;
    const gap = 18;
    let top;
    let left;
    let placement = preferredPosition;

    if (!targetRect || isFallbackCenter || preferredPosition === 'center') {
      top = (viewportHeight - cardRect.height) / 2;
      left = (viewportWidth - cardRect.width) / 2;
    } else {
      const topSpace = targetRect.top - gap;
      const bottomSpace = viewportHeight - targetRect.bottom - gap;
      const leftSpace = targetRect.left - gap;
      const rightSpace = viewportWidth - targetRect.right - gap;
      const fitsTop = topSpace >= cardRect.height;
      const fitsBottom = bottomSpace >= cardRect.height;
      const fitsLeft = leftSpace >= cardRect.width;
      const fitsRight = rightSpace >= cardRect.width;

      if (placement === 'top' && !fitsTop && fitsBottom) placement = 'bottom';
      if (placement === 'bottom' && !fitsBottom && fitsTop) placement = 'top';
      if (!fitsTop && !fitsBottom) {
        if (fitsRight) placement = 'right';
        else if (fitsLeft) placement = 'left';
      }

      if (placement === 'top') {
        top = targetRect.top - gap - cardRect.height;
        left = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
      } else if (placement === 'bottom') {
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
      } else if (placement === 'right') {
        top = targetRect.top + targetRect.height / 2 - cardRect.height / 2;
        left = targetRect.right + gap;
      } else if (placement === 'left') {
        top = targetRect.top + targetRect.height / 2 - cardRect.height / 2;
        left = targetRect.left - gap - cardRect.width;
      } else {
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
      }
    }

    top = clampValue(top, margin, viewportHeight - margin - cardRect.height);
    left = clampValue(left, margin, viewportWidth - margin - cardRect.width);

    setCardStyle({
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
    });
    setCardPlacement(placement);
  }, [
    currentStepIndex,
    isFallbackCenter,
    preferredPosition,
    showTutorial,
    targetRect,
    viewportHeight,
    viewportTick,
    viewportWidth,
  ]);

  const cardVars = targetRect
    ? {
        '--target-x': `${targetRect.left + targetRect.width / 2}px`,
        '--target-y': `${targetRect.top + targetRect.height / 2}px`,
        '--target-top': `${targetRect.top}px`,
        '--target-bottom': `${targetRect.bottom}px`,
        '--target-left': `${targetRect.left}px`,
        '--target-right': `${targetRect.right}px`,
      }
    : {};

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" data-step={step.id}>
      {hasSpotlight ? (
        <>
          <div
            className="tutorial-shade"
            style={{ top: 0, left: 0, width: '100%', height: `${spotlightRect.top}px` }}
            onClick={handleNext}
          />
          <div
            className="tutorial-shade"
            style={{
              top: `${spotlightRect.top + spotlightRect.height}px`,
              left: 0,
              width: '100%',
              height: `${Math.max(0, viewportHeight - (spotlightRect.top + spotlightRect.height))}px`,
            }}
            onClick={handleNext}
          />
          <div
            className="tutorial-shade"
            style={{
              top: `${spotlightRect.top}px`,
              left: 0,
              width: `${spotlightRect.left}px`,
              height: `${spotlightRect.height}px`,
            }}
            onClick={handleNext}
          />
          <div
            className="tutorial-shade"
            style={{
              top: `${spotlightRect.top}px`,
              left: `${spotlightRect.left + spotlightRect.width}px`,
              width: `${Math.max(0, viewportWidth - (spotlightRect.left + spotlightRect.width))}px`,
              height: `${spotlightRect.height}px`,
            }}
            onClick={handleNext}
          />
          <div
            className="tutorial-hole"
            style={{
              left: `${spotlightRect.left}px`,
              top: `${spotlightRect.top}px`,
              width: `${spotlightRect.width}px`,
              height: `${spotlightRect.height}px`,
              borderRadius: `${spotlightRadius}px`,
            }}
            onClick={handleNext}
          />
          <div
            className="tutorial-spotlight"
            style={{
              left: `${spotlightRect.left}px`,
              top: `${spotlightRect.top}px`,
              width: `${spotlightRect.width}px`,
              height: `${spotlightRect.height}px`,
              borderRadius: `${spotlightRadius}px`,
            }}
          />
        </>
      ) : (
        <div className="tutorial-backdrop" onClick={handleNext} />
      )}

      <div
        ref={cardRef}
        className={`tutorial-card position-${cardPlacement}`}
        style={{ ...cardStyle, ...cardVars }}
      >
        <div className="tutorial-header">
          <span className="tutorial-step">
            {t('tutorial.step_label', {}, 'Étape')} {currentStepIndex + 1}/{steps.length}
          </span>
          <h3>{step.title}</h3>
        </div>

        <div className="tutorial-content">
          {step.text && <p>{step.text}</p>}
          {step.bullets && (
            <ul className="tutorial-list">
              {step.bullets.map((item, index) => (
                <li key={`${step.id}-bullet-${index}`}>{item}</li>
              ))}
            </ul>
          )}
          {step.note && <p className="tutorial-note">{step.note}</p>}
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-dots">
            {steps.map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`progress-dot ${index === currentStepIndex ? 'active' : ''}`}
              />
            ))}
          </div>

          <div className="tutorial-buttons">
            {currentStepIndex > 0 && (
              <button className="tutorial-back" onClick={handleBack}>
                {t('tutorial.previous', {}, 'Précédent')}
              </button>
            )}
            <button className="tutorial-skip" onClick={handleSkip}>
              {t('tutorial.skip', {}, 'Passer')}
            </button>
            <button className="tutorial-next" onClick={handleNext}>
              {step.nextLabel || (currentStepIndex === steps.length - 1
                ? t('tutorial.finish', {}, "C'est parti !")
                : t('tutorial.next', {}, 'Suivant →'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
