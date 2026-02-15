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
          "Je suis Papy Mouche. Je te montre l'essentiel en quelques secondes."
        ),
        route: '/',
        position: 'center',
      },
      {
        id: 'play',
        title: t('tutorial.step_play_title', {}, 'Lancer une partie'),
        text: t(
          'tutorial.step_play_text',
          {},
          'Appuie ici pour jouer tout de suite. Un pack est déjà choisi pour toi !'
        ),
        route: '/',
        targetSelector: '.tutorial-hero-cta',
        position: 'bottom',
        spotlightPadding: 12,
        spotlightRadius: 20,
      },
      {
        id: 'packs',
        title: t('tutorial.step_packs_title', {}, 'Choisir un terrain'),
        text: t(
          'tutorial.step_packs_text',
          {},
          'Change de pack pour explorer d\'autres espèces. Chaque pack est un terrain de jeu différent.'
        ),
        route: '/',
        targetSelector: '.tutorial-pack-grid',
        position: 'auto',
        spotlightPadding: 16,
        spotlightRadius: 20,
      },
      {
        id: 'navigation',
        title: t('tutorial.step_navigation_title', {}, 'Navigation rapide'),
        text: t(
          'tutorial.step_navigation_text',
          {},
          'Tout est à portée. Tu peux revenir ici à tout moment.'
        ),
        route: '/',
        targetSelector: '.tutorial-main-nav, .tutorial-bottom-nav',
        highlightSelector: '.tutorial-nav-home, .tutorial-nav-collection, .tutorial-nav-profile, .tutorial-nav-settings',
        position: 'auto',
        skipScroll: true,
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
  const stepId = step?.id;

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
        setIsFallbackCenter(step.position === 'center');
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
      document.body.classList.add('tutorial-active');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('tutorial-active');
    }

    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('tutorial-active');
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

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const isCentered = !step || isFallbackCenter || !targetRect;
  const preferredPosition =
    isCentered
      ? 'center'
      : step?.position === 'auto'
        ? targetRect.top > viewportHeight * 0.55
          ? 'top'
          : 'bottom'
        : step?.position;

  const spotlightPadding = step?.spotlightPadding ?? 18;
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
  const spotlightRadius = step?.spotlightRadius ?? 22;

  useLayoutEffect(() => {
    if (!showTutorial || !step) return;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const margin = 16;
    const gap = stepId === 'packs' ? 12 : 18;
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
    step,
    stepId,
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

  if (!showTutorial || !step) return null;

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
          <div className="tutorial-header-meta">
            <span className="tutorial-step">
              {currentStepIndex + 1}/{steps.length}
            </span>
            <button className="tutorial-skip-link" onClick={handleSkip} type="button">
              {t('tutorial.skip', {}, 'Passer')}
            </button>
          </div>
          <div className="tutorial-professor">
            <span className="tutorial-professor-avatar" aria-hidden="true">🪰</span>
            <span className="tutorial-professor-text">{t('tutorial.professor_name', {}, 'Papy Mouche')}</span>
          </div>
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
          <div className="tutorial-progress">
            <div className="tutorial-progress-bar" aria-hidden="true">
              <span
                className="tutorial-progress-fill"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="tutorial-buttons">
            <button className="tutorial-next" onClick={handleNext}>
              {step.nextLabel || (currentStepIndex === steps.length - 1
                ? t('tutorial.finish', {}, "C'est parti !")
                : t('tutorial.next', {}, 'Suivant'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
