import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { usePacks } from '../../context/PacksContext.jsx';
import { useGameData } from '../../context/GameContext';
import { useGeoDefaultPack } from '../../hooks/useGeoDefaultPack';
import { usePackPreviews } from '../../hooks/usePackPreviews';
import { trackMetric } from '../../services/metrics';
import { Button } from '../../shared/ui';
import './Onboarding.css';

const ONBOARDING_STORAGE_KEY = 'inaturamouche_onboarding_done';
const MAX_VISIBLE_PACKS = 6;

/**
 * Format a pack ID for display: replace underscores with spaces and capitalize.
 */
function formatPackId(id) {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Mark onboarding as done in localStorage.
 */
function markOnboardingDone() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // storage unavailable – silently continue
  }
}

/**
 * Onboarding — 3-step flow for first-time users.
 *
 * Step 1: Welcome — app logo + concept description
 * Step 2: Choose a pack — preview photos + proper names
 * Step 3: Ready — confirmation
 */
export default function Onboarding({ onComplete }) {
  const { t } = useLanguage();
  const { packs, loading: packsLoading } = usePacks();
  const { setActivePackId } = useGameData();
  const geoDefaultPack = useGeoDefaultPack();
  const { getPhotos, loadPreview } = usePackPreviews();

  const [step, setStep] = useState(0);
  const [selectedPack, setSelectedPack] = useState(null);
  const [direction, setDirection] = useState('forward'); // for slide animation

  // Pre-select geo-based pack if available
  useEffect(() => {
    if (!selectedPack && !packsLoading && packs.length > 0) {
      const geo = packs.find((p) => p.id === geoDefaultPack);
      if (geo) {
        setSelectedPack(geoDefaultPack);
      } else if (packs.length > 0) {
        setSelectedPack(packs[0].id);
      }
    }
  }, [packsLoading, packs, geoDefaultPack, selectedPack]);

  // Visible packs for step 2 (exclude 'custom')
  const visiblePacks = useMemo(() => {
    if (!packs) return [];
    return packs
      .filter((p) => p.id !== 'custom' && !p.hidden)
      .slice(0, MAX_VISIBLE_PACKS);
  }, [packs]);

  // Load pack preview photos when reaching step 2
  useEffect(() => {
    if (step === 1 && visiblePacks.length > 0) {
      visiblePacks.forEach((pack) => loadPreview(pack.id));
    }
  }, [step, visiblePacks, loadPreview]);

  const handleNext = useCallback(() => {
    setDirection('forward');
    void trackMetric('onboarding_step', { step: step + 1, action: 'next' });
    if (step < 2) {
      setStep((s) => s + 1);
    } else {
      // Final step — apply pack selection and finish
      if (selectedPack) {
        setActivePackId(selectedPack);
      }
      markOnboardingDone();
      void trackMetric('onboarding_complete', { pack: selectedPack });
      onComplete?.();
    }
  }, [step, selectedPack, setActivePackId, onComplete]);

  const handleBack = useCallback(() => {
    setDirection('backward');
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    void trackMetric('onboarding_skip', { step });
    markOnboardingDone();
    onComplete?.();
  }, [step, onComplete]);

  const getPackName = useCallback(
    (pack) => {
      if (pack.titleKey) return t(pack.titleKey);
      return formatPackId(pack.label || pack.name || pack.id);
    },
    [t],
  );

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label={t('onboarding.welcome_title', {}, 'Bienvenue')}>
      <div className="onboarding-container">
        {/* Skip */}
        <button type="button" className="onboarding-skip" onClick={handleSkip}>
          {t('onboarding.skip', {}, 'Passer')}
        </button>

        {/* Step content */}
        <div className={`onboarding-step onboarding-step--${direction}`} key={step}>
          {/* Step 0: Welcome */}
          {step === 0 && (
            <>
              <div className="onboarding-logo-wrapper">
                <picture>
                  <source srcSet="/assets/inaturaquizz-title.avif" type="image/avif" />
                  <source srcSet="/assets/inaturaquizz-title.webp" type="image/webp" />
                  <img
                    src="/assets/inaturaquizz-title.png"
                    alt="iNaturaQuizz"
                    className="onboarding-logo"
                    width="220"
                    height="60"
                  />
                </picture>
              </div>
              <h2 className="onboarding-title">
                {t('onboarding.welcome_title', {}, 'Bienvenue sur iNaturaQuizz !')}
              </h2>
              <p className="onboarding-description">
                {t(
                  'onboarding.welcome_description',
                  {},
                  'Apprenez à reconnaître la faune et la flore qui vous entourent grâce à des quiz interactifs basés sur de vraies observations naturalistes.',
                )}
              </p>
            </>
          )}

          {/* Step 1: Choose pack */}
          {step === 1 && (
            <>
              <h2 className="onboarding-title">
                {t('onboarding.pack_title', {}, 'Choisissez votre pack')}
              </h2>
              <p className="onboarding-description">
                {t(
                  'onboarding.pack_description',
                  {},
                  "Chaque pack contient des espèces d'une région ou d'un thème. Vous pourrez en changer à tout moment.",
                )}
              </p>
              <div
                className="onboarding-packs"
                role="radiogroup"
                aria-label={t('onboarding.pack_title', {}, 'Choisissez votre pack')}
              >
                {packsLoading ? (
                  <div className="onboarding-packs-loading">
                    <span className="onboarding-spinner" aria-hidden="true" />
                    {t('common.loading', {}, 'Chargement...')}
                  </div>
                ) : (
                  visiblePacks.map((pack) => {
                    const photos = getPhotos(pack.id);
                    const isSelected = selectedPack === pack.id;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        className={`onboarding-pack-card${isSelected ? ' onboarding-pack-card--selected' : ''}`}
                        onClick={() => setSelectedPack(pack.id)}
                        aria-pressed={isSelected}
                      >
                        {photos && photos.length > 0 ? (
                          <div className="onboarding-pack-photos">
                            {Array.from({ length: 4 }, (_, i) => {
                              const photo = photos[i % photos.length];
                              return (
                                <img
                                  key={i}
                                  src={photo.url}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="onboarding-pack-photo"
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="onboarding-pack-placeholder" />
                        )}
                        <span className="onboarding-pack-name">{getPackName(pack)}</span>
                        {isSelected && (
                          <span className="onboarding-pack-check" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 12l5 5L19 7"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Step 2: Ready */}
          {step === 2 && (
            <>
              <div className="onboarding-ready-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="onboarding-title">
                {t('onboarding.ready_title', {}, 'Vous êtes prêt !')}
              </h2>
              <p className="onboarding-description">
                {t(
                  'onboarding.ready_description',
                  {},
                  'Identifiez les espèces à partir de photos, gagnez des points et enrichissez votre collection. Bonne découverte !',
                )}
              </p>
            </>
          )}
        </div>

        {/* Progress dots */}
        <div className="onboarding-dots" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`onboarding-dot${i === step ? ' onboarding-dot--active' : ''}${i < step ? ' onboarding-dot--done' : ''}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="onboarding-actions">
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={handleBack}>
              {t('common.prev', {}, 'Précédent')}
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            fullWidth={step === 0}
            className="onboarding-next-btn"
          >
            {step === 2
              ? t('onboarding.start_playing', {}, "C'est parti !")
              : t('common.next', {}, 'Suivant')}
          </Button>
        </div>
      </div>
    </div>
  );
}
