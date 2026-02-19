import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import { useGeoDefaultPack, useDetectedRegion } from '../hooks/useGeoDefaultPack';
import { usePackPreviews } from '../hooks/usePackPreviews';
import { active_session } from '../services/db';
import { getReviewStats } from '../services/CollectionService';
import { notify } from '../services/notifications';
import AdvancedSettings from '../components/AdvancedSettings';
import PackIcon from '../components/PackIcons';
import { SettingsIcon } from '../components/NavigationIcons';
import { debugError, debugLog, debugWarn } from '../utils/logger';
import { getTodayDailySeed, isDailyCompleted, isDailySeedStale } from '../utils/dailyChallenge';
import '../features/configurator/Configurator.css';
import './HomePage.css';

const HOME_SECTION_LIMIT = 3;
const DESKTOP_PACK_LIMIT = 6;
const DESKTOP_MEDIA_QUERY = '(min-width: 900px)';
const RECENT_PACKS_STORAGE_KEY = 'inaturamouche_recent_packs_v1';
const RECENT_PACKS_MAX_ITEMS = 8;
const CustomFilter = lazy(() => import('../features/configurator/components/CustomFilter'));

function readRecentPackIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PACKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || '').trim())
      .filter((item) => item && item !== 'custom')
      .slice(0, RECENT_PACKS_MAX_ITEMS);
  } catch {
    return [];
  }
}

function pushRecentPackId(packId) {
  if (typeof window === 'undefined') return;
  const normalizedId = String(packId || '').trim();
  if (!normalizedId || normalizedId === 'custom') return;
  const next = [normalizedId, ...readRecentPackIds().filter((id) => id !== normalizedId)]
    .slice(0, RECENT_PACKS_MAX_ITEMS);
  try {
    window.localStorage.setItem(RECENT_PACKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op: storage can be unavailable in private mode
  }
}

let playPagePreloadPromise = null;
function preloadPlayPageModule() {
  if (!playPagePreloadPromise) {
    playPagePreloadPromise = import('../pages/PlayPage').catch((err) => {
      playPagePreloadPromise = null;
      throw err;
    });
  }
  return playPagePreloadPromise;
}

const ResumeIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5v14l11-7z" fill="currentColor" />
  </svg>
);

const TargetIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const QuestionIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9.2 9.1a2.8 2.8 0 1 1 4.5 2.2c-.9.7-1.6 1.3-1.6 2.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const MediaIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 8h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 8l1.3-2h5.4L16 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="13.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const PackSettingsIcon = () => (
  <svg className="hero-inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 7h10v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10 12h4M10 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg className="close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const HomePage = () => {
  const navigate = useNavigate();
  const {
    startGame, resumeGame, clearSessionFromDB, startReviewMode,
    gameMode, setGameMode, activePackId, setActivePackId, maxQuestions, mediaType,
    customFilters, dispatchCustomFilters,
  } = useGameData();
  const { profile } = useUser();
  const { t } = useLanguage();
  const {
    packs,
    loading: packsLoading,
    homeSections,
    homeCustomEntry,
    homeLoading,
    refreshHomeCatalog,
  } = usePacks();
  const geoDefaultPack = useGeoDefaultPack();

  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resumeSessionData, setResumeSessionData] = useState(null);
  const [reviewStats, setReviewStats] = useState(null);
  const [geoApplied, setGeoApplied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches
      : false
  ));

  const todaySeed = getTodayDailySeed();
  const dailyAlreadyCompleted = isDailyCompleted(todaySeed);
  const hasPlayedGame = (profile?.stats?.gamesPlayed || 0) > 0;
  const recentPackIds = useMemo(() => readRecentPackIds(), []);
  const detectedRegion = useDetectedRegion();

  /* ── Auto-select geo-based pack for new players ── */
  useEffect(() => {
    if (geoApplied || packsLoading) return;
    if (!hasPlayedGame && activePackId === 'custom') {
      const packExists = packs.some((p) => p.id === geoDefaultPack);
      if (packExists) {
        debugLog('[HomePage] Auto-selecting geo pack:', geoDefaultPack);
        setActivePackId(geoDefaultPack);
      }
    }
    setGeoApplied(true);
  }, [geoApplied, packsLoading, hasPlayedGame, activePackId, packs, geoDefaultPack, setActivePackId]);

  /* ── Check for active session ── */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await active_session.get(1);
        if (session) {
          const sessionSeed = session.gameConfig?.dailySeed;
          if (sessionSeed && isDailySeedStale(sessionSeed)) {
            debugLog('[HomePage] Discarding stale daily session');
            await active_session.delete(1);
            setHasActiveSession(false);
            setResumeSessionData(null);
          } else {
            setHasActiveSession(true);
            setResumeSessionData(session);
          }
        } else {
          setHasActiveSession(false);
          setResumeSessionData(null);
        }
      } catch (err) {
        debugError('[HomePage] Error checking active session:', err);
        setHasActiveSession(false);
        setResumeSessionData(null);
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
    const handleVis = () => { if (document.visibilityState === 'visible') checkSession(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  /* ── Load review stats ── */
  useEffect(() => {
    let mounted = true;
    getReviewStats()
      .then((s) => mounted && setReviewStats(s))
      .catch((e) => debugError('[HomePage] review stats:', e));
    return () => { mounted = false; };
  }, []);

  const preloadPlayPage = useCallback(() => {
    preloadPlayPageModule().catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let idleId;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        preloadPlayPage();
      }, { timeout: 1200 });
      return () => {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    idleId = window.setTimeout(() => {
      preloadPlayPage();
    }, 250);
    return () => window.clearTimeout(idleId);
  }, [preloadPlayPage]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    void refreshHomeCatalog({
      region: detectedRegion,
      recentPackIds,
    });
  }, [detectedRegion, recentPackIds, refreshHomeCatalog]);

  /* ── Handlers ── */
  const handleStart = useCallback(() => {
    preloadPlayPage();
    setAdvancedOpen(false);
    pushRecentPackId(activePackId);
    startGame({ maxQuestions, mediaType });
    navigate('/play');
  }, [navigate, preloadPlayPage, startGame, maxQuestions, mediaType, activePackId]);

  const handleResumeGame = useCallback(async () => {
    preloadPlayPage();
    debugLog('[HomePage] Resuming game...');
    const data = await resumeGame();
    if (data) {
      await new Promise((r) => setTimeout(r, 100));
      navigate('/play');
    } else {
      debugWarn('[HomePage] No session data');
      notify(t?.resumeFailed || 'Impossible de reprendre la partie. La session a expiré.', {
        type: 'error',
        duration: 4000,
      });
    }
  }, [navigate, preloadPlayPage, resumeGame, t]);

  const handleAbandonSession = useCallback(async () => {
    await clearSessionFromDB();
    setHasActiveSession(false);
  }, [clearSessionFromDB]);

  const handleDailyChallenge = useCallback(() => {
    preloadPlayPage();
    if (isDailyCompleted(todaySeed)) return;
    if (hasActiveSession && resumeSessionData?.gameConfig?.dailySeed === todaySeed) {
      handleResumeGame();
      return;
    }
    startGame({ seed: todaySeed, seed_session: todaySeed, gameMode: 'hard', maxQuestions: 10 });
    navigate('/play');
  }, [navigate, preloadPlayPage, startGame, todaySeed, hasActiveSession, resumeSessionData, handleResumeGame]);

  const handleStartReview = useCallback(async () => {
    preloadPlayPage();
    const started = await startReviewMode();
    if (started) navigate('/play');
    return started;
  }, [navigate, preloadPlayPage, startReviewMode]);

  const handlePackSelect = useCallback((packId) => {
    setActivePackId(packId);
  }, [setActivePackId]);
  const preloadCustomFilter = useCallback(() => {
    import('../features/configurator/components/CustomFilter');
  }, []);

  const [customOpen, setCustomOpen] = useState(false);
  const advancedPanelRef = useRef(null);
  const advancedButtonRef = useRef(null);

  /* ── Derived ── */
  const activePack = packs.find((p) => p.id === activePackId);
  const activePackLabel = activePack?.titleKey ? t(activePack.titleKey) : activePackId;
  const customEntryTitle = t(
    homeCustomEntry?.titleKey || 'home.custom_create_title',
    {},
    'Creer mon pack'
  );
  const customEntryDescription = t(
    homeCustomEntry?.descriptionKey || 'home.custom_create_desc',
    {},
    'Choisis tes taxons, ton lieu et ta periode'
  );
  const modeName = gameMode === 'easy' ? t('home.easy_mode')
    : gameMode === 'hard' ? t('home.hard_mode')
    : gameMode === 'riddle' ? t('home.riddle_mode')
    : t('home.taxonomic_mode');
  const qLabel = Number.isInteger(maxQuestions) && maxQuestions > 0 ? `${maxQuestions} Q` : '∞';
  const mediaName = mediaType === 'sounds'
    ? t('configurator.option_sounds', {}, 'Sons')
    : mediaType === 'both'
      ? t('configurator.option_both', {}, 'Images + Sons')
      : t('configurator.option_images', {}, 'Images');
  const settingsLabel = t('home.settings_label', {}, 'Paramètres');
  const isResuming = hasActiveSession && !isCheckingSession && resumeSessionData;

  useEffect(() => {
    if (isResuming) return;
    if (gameMode !== 'easy' && gameMode !== 'hard') {
      setGameMode('easy');
    }
  }, [gameMode, isResuming, setGameMode]);

  useEffect(() => {
    if (!advancedOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (advancedPanelRef.current?.contains(target)) return;
      if (advancedButtonRef.current?.contains(target)) return;
      setAdvancedOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAdvancedOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [advancedOpen]);

  const isCatalogLoading = packsLoading || homeLoading;
  const packsById = useMemo(
    () => Object.fromEntries(packs.map((pack) => [pack.id, pack])),
    [packs]
  );
  const visibleHomeSections = useMemo(() => {
    if (!Array.isArray(homeSections)) return [];
    return homeSections
      .slice(0, HOME_SECTION_LIMIT)
      .map((section) => {
        const sectionPacks = Array.isArray(section?.packs) ? section.packs : [];
        const packsForSection = sectionPacks
          .map((pack) => {
            const id = typeof pack === 'string' ? pack : pack?.id;
            if (!id || id === 'custom') return null;
            return packsById[id] || pack || null;
          })
          .filter(Boolean);
        return {
          id: String(section?.id || 'explore'),
          titleKey: section?.titleKey || `home.section_${section?.id || 'explore'}`,
          packs: packsForSection,
        };
      })
      .filter((section) => section.packs.length > 0);
  }, [homeSections, packsById]);

  /* ── Pack preview images ── */
  const { getPhotos, loadPreview } = usePackPreviews();
  const activePackHeroImage = useMemo(() => {
    if (!activePackId || activePackId === 'custom') return null;
    const photos = getPhotos(activePackId);
    return photos?.[0]?.url ?? null;
  }, [activePackId, getPhotos]);

  useEffect(() => {
    if (!activePackId || activePackId === 'custom') return;
    if (activePackHeroImage) return;
    loadPreview(activePackId);
  }, [activePackHeroImage, activePackId, loadPreview]);

  /* ── Hover description with delay ── */
  const hoverTimerRef = useRef(null);
  const [hoveredPackId, setHoveredPackId] = useState(null);
  const handlePackMouseEnter = useCallback((packId) => {
    loadPreview(packId);
    hoverTimerRef.current = setTimeout(() => setHoveredPackId(packId), 400);
  }, [loadPreview]);
  const handlePackMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredPackId(null);
  }, []);
  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  /* ── Loading ── */
  if (isCheckingSession) {
    return (
      <div className="screen home-screen">
        <div className="home-skeleton" aria-hidden="true">
          <div className="skeleton-block" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      </div>
    );
  }

  return (
    <div className="screen home-screen">
      <h1 className="sr-only">
        {t('seo.home.h1', {}, 'iNaturaQuizz - Quiz nature interactif')}
      </h1>
      {/* ═══════ HERO ZONE ═══════ */}
      <section className="home-hero">
        {isResuming ? (
          <div className="hero-cta-group">
            <button
              type="button"
              className="hero-cta hero-cta--resume"
              onClick={handleResumeGame}
              onMouseEnter={preloadPlayPage}
              onFocus={preloadPlayPage}
              onTouchStart={preloadPlayPage}
            >
              <span className="hero-cta-label">
                <span className="hero-cta-action-icon" aria-hidden="true">
                  <ResumeIcon />
                </span>
                {t('home.resume_game_button_text', {}, 'Reprendre')}
              </span>
              <span className="hero-cta-meta">
                {resumeSessionData.currentQuestionIndex > 0
                  ? t('home.resume_progress', { current: resumeSessionData.currentQuestionIndex, total: resumeSessionData.gameConfig?.maxQuestions || '∞' }, `Question ${resumeSessionData.currentQuestionIndex} sur ${resumeSessionData.gameConfig?.maxQuestions || '∞'}`)
                  : t('home.resume_game_subtitle', {}, 'Partie en cours')}
              </span>
            </button>
            <button
              type="button"
              className="hero-abandon"
              onClick={handleAbandonSession}
              title={t('home.abandon_session_tooltip', {}, 'Abandonner')}
              aria-label={t('home.abandon_session_tooltip', {}, 'Abandonner')}
            >
              <CloseIcon />
            </button>
          </div>
        ) : (
          <div className="hero-cta-shell">
            <button
              type="button"
              className="hero-cta hero-cta--play tutorial-hero-cta"
              onClick={handleStart}
              onMouseEnter={preloadPlayPage}
              onFocus={preloadPlayPage}
              onTouchStart={preloadPlayPage}
              disabled={packsLoading}
            >
              {activePackHeroImage && (
                <span
                  className="hero-cta-pack-photo"
                  aria-hidden="true"
                  style={{ backgroundImage: `url("${activePackHeroImage}")` }}
                />
              )}
              <span className="hero-cta-label">
                <span className="hero-cta-play-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                {t('common.start_game', {}, 'Jouer')}
              </span>
              <span className="hero-cta-meta">
                <span className="hero-cta-meta-chip" aria-label={`${t('configurator.pack_label', {}, 'Pack')} : ${activePackLabel}`}>
                  <PackIcon packId={activePackId} className="hero-cta-pack-icon" />
                  <span>{activePackLabel}</span>
                </span>
                <span className="hero-cta-meta-chip" aria-label={`${t('home.play_pillar_title', {}, 'Mode')} : ${modeName}`}>
                  <span className="hero-chip-icon" aria-hidden="true">
                    <TargetIcon />
                  </span>
                  <span>{modeName}</span>
                </span>
                <span className="hero-cta-meta-chip" aria-label={`${t('configurator.question_count_label', {}, 'Questions')} : ${qLabel}`}>
                  <span className="hero-chip-icon" aria-hidden="true">
                    <QuestionIcon />
                  </span>
                  <span>{qLabel}</span>
                </span>
                <span className="hero-cta-meta-chip" aria-label={`${t('configurator.media_type_label', {}, 'Média')} : ${mediaName}`}>
                  <span className="hero-chip-icon" aria-hidden="true">
                    <MediaIcon />
                  </span>
                  <span>{mediaName}</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              ref={advancedButtonRef}
              className={`hero-advanced-trigger tutorial-nav-settings ${advancedOpen ? 'open' : ''}`}
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-label={settingsLabel}
              aria-expanded={advancedOpen}
              aria-controls="home-advanced-settings-panel"
            >
              <SettingsIcon className="hero-advanced-trigger-icon" />
            </button>
            {advancedOpen && (
              <>
                <div
                  className="home-advanced-backdrop"
                  aria-hidden="true"
                  onClick={() => setAdvancedOpen(false)}
                />
                <div
                  id="home-advanced-settings-panel"
                  ref={advancedPanelRef}
                  className="home-advanced-popover"
                  role="dialog"
                  aria-modal="false"
                  aria-label={settingsLabel}
                >
                  <p className="home-advanced-popover-title">
                    {settingsLabel}
                  </p>
                  <AdvancedSettings
                    open={advancedOpen}
                    onOpenChange={setAdvancedOpen}
                    showToggle={false}
                    className="home-advanced-settings-popover"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Quick-action chips */}
        <div className="home-chips">
          <button
            type="button"
            className={`home-chip home-chip--daily ${dailyAlreadyCompleted ? 'done' : 'highlight'}`}
            onClick={handleDailyChallenge}
            onMouseEnter={preloadPlayPage}
            onFocus={preloadPlayPage}
            onTouchStart={preloadPlayPage}
            disabled={dailyAlreadyCompleted}
          >
            <span className="chip-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" /></svg></span>
            <span className="chip-text">
              {dailyAlreadyCompleted
                ? t('home.daily_done_short_text', {}, 'Défi terminé')
                : t('home.daily_chip', {}, 'Défi du jour')}
            </span>
          </button>

          {reviewStats?.dueToday > 0 && (
            <button
              type="button"
              className="home-chip home-chip--review highlight"
              onClick={handleStartReview}
              onMouseEnter={preloadPlayPage}
              onFocus={preloadPlayPage}
              onTouchStart={preloadPlayPage}
            >
              <span className="chip-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg></span>
              <span className="chip-text">{t('home.review_chip', {}, 'Révisions')}</span>
              <span className="chip-badge">{reviewStats.dueToday}</span>
            </button>
          )}
        </div>
      </section>

      {/* ═══════ PACK CATALOG — Netflix-style cards ═══════ */}
      <section className="home-packs">
        <p className="home-section-label">{t('home.pick_pack', {}, 'Choisis un pack')}</p>

        {!isCatalogLoading && (
          <div className="home-custom-entry">
            <button
              type="button"
              className={`home-custom-card ${activePackId === 'custom' ? 'active' : ''} ${customOpen ? 'open' : ''}`}
              onMouseEnter={preloadCustomFilter}
              onFocus={preloadCustomFilter}
              onTouchStart={preloadCustomFilter}
              onClick={() => {
                const alreadyCustom = activePackId === 'custom';
                handlePackSelect('custom');
                setCustomOpen(alreadyCustom ? !customOpen : true);
              }}
              aria-pressed={activePackId === 'custom'}
              aria-expanded={customOpen}
              aria-controls="home-custom-panel"
            >
              <span className="home-custom-card-icon" aria-hidden="true">
                <PackIcon packId="custom" className="pack-card-icon" />
              </span>
              <span className="home-custom-card-copy">
                <span className="home-custom-card-title">{customEntryTitle}</span>
                <span className="home-custom-card-subtitle">{customEntryDescription}</span>
              </span>
            </button>
          </div>
        )}

        {/* ── Custom filter panel (collapsible) ── */}
        {customOpen && (
          <div className="home-custom-panel" id="home-custom-panel">
            <div className="home-custom-header">
              <p className="home-section-label home-section-label-icon">
                <PackSettingsIcon />
                <span>{customEntryTitle}</span>
              </p>
              <button type="button" className="home-custom-close" onClick={() => setCustomOpen(false)} aria-label="Fermer">
                <CloseIcon />
              </button>
            </div>
            <Suspense
              fallback={
                <p className="custom-filter-description">
                  {t('home.custom_filter_loading', {}, 'Chargement des filtres...')}
                </p>
              }
            >
              <CustomFilter filters={customFilters} dispatch={dispatchCustomFilters} />
            </Suspense>
          </div>
        )}

        {isCatalogLoading && (
          <div className="home-catalog-row">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="pack-card skeleton" key={`sk-${i}`} aria-hidden="true" />
            ))}
          </div>
        )}

        {!isCatalogLoading && visibleHomeSections.map((section) => (
          <PackRow
            key={section.id}
            label={t(section.titleKey, {}, section.id)}
            packs={section.packs}
            activePackId={activePackId}
            hoveredPackId={hoveredPackId}
            onSelect={(id) => { handlePackSelect(id); setCustomOpen(false); }}
            onMouseEnter={handlePackMouseEnter}
            onMouseLeave={handlePackMouseLeave}
            getPhotos={getPhotos}
            loadPreview={loadPreview}
            isDesktop={isDesktop}
            maxDesktopCards={DESKTOP_PACK_LIMIT}
            t={t}
          />
        ))}
      </section>

    </div>
  );
};

/* ═══════ PACK ROW — horizontal scroll with desktop cap ═══════ */
function PackRow({
  label,
  packs: sourcePacks,
  activePackId,
  hoveredPackId,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  getPhotos,
  loadPreview,
  isDesktop,
  maxDesktopCards = DESKTOP_PACK_LIMIT,
  t,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const dragState = useRef({ active: false, startX: 0, scrollStart: 0, moved: false });
  const PRELOAD_BUFFER_CARDS = 2;
  const FALLBACK_CARD_WIDTH = 140;
  const [desktopVisibleCount, setDesktopVisibleCount] = useState(maxDesktopCards);

  const hasDesktopOverflow = isDesktop && sourcePacks.length > maxDesktopCards;
  const hasDesktopMore = isDesktop && sourcePacks.length > desktopVisibleCount;
  const desktopRemainingCount = Math.max(0, sourcePacks.length - desktopVisibleCount);
  const visiblePacks = useMemo(
    () => (isDesktop ? sourcePacks.slice(0, desktopVisibleCount) : sourcePacks),
    [isDesktop, sourcePacks, desktopVisibleCount]
  );

  useEffect(() => {
    setDesktopVisibleCount(maxDesktopCards);
  }, [isDesktop, sourcePacks, maxDesktopCards]);

  useEffect(() => {
    if (!isDesktop) return;
    for (const pack of visiblePacks) {
      if (pack?.id) loadPreview(pack.id);
    }
  }, [isDesktop, visiblePacks, loadPreview]);

  const handleSeeMore = useCallback(() => {
    if (!hasDesktopOverflow) return;
    if (hasDesktopMore) {
      setDesktopVisibleCount((current) => Math.min(sourcePacks.length, current + maxDesktopCards));
      return;
    }
    setDesktopVisibleCount(maxDesktopCards);
  }, [hasDesktopOverflow, hasDesktopMore, sourcePacks.length, maxDesktopCards]);

  const updateScroll = useCallback(() => {
    if (isDesktop) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      setScrollProgress(0);
      return;
    }

    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollProgress(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);

    // Load only cards that are visible (plus a small buffer) to avoid flooding /preview.
    const firstCard = el.firstElementChild;
    const measuredWidth = firstCard ? (firstCard.getBoundingClientRect().width || 0) : 0;
    const cardWidth = measuredWidth > 0 ? measuredWidth + 10 : FALLBACK_CARD_WIDTH;
    const startIndex = Math.max(0, Math.floor(el.scrollLeft / cardWidth) - PRELOAD_BUFFER_CARDS);
    const visibleCount = Math.max(1, Math.ceil(el.clientWidth / cardWidth));
    const endIndex = Math.min(
      sourcePacks.length,
      startIndex + visibleCount + PRELOAD_BUFFER_CARDS * 2
    );
    for (let i = startIndex; i < endIndex; i += 1) {
      const packId = sourcePacks[i]?.id;
      if (packId) loadPreview(packId);
    }
  }, [isDesktop, sourcePacks, loadPreview]);

  useEffect(() => {
    if (isDesktop) return undefined;
    const el = scrollRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect(); };
  }, [isDesktop, updateScroll, sourcePacks]);

  const scrollBy = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  }, []);

  /* ── Drag-to-scroll (pointer events) ── */
  const DRAG_THRESHOLD = 10; // px – must exceed this to count as a drag (not a click)

  const handlePointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { active: true, startX: e.clientX, scrollStart: el.scrollLeft, moved: false, pointerId: e.pointerId };
    // Don't capture yet — capture lazily once the user actually drags past the threshold
  }, []);

  const handlePointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.active) return;
    const dx = e.clientX - ds.startX;
    if (!ds.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      ds.moved = true;
      const el = scrollRef.current;
      // Lazy capture: only now grab pointer and apply drag styling
      try { el.setPointerCapture(ds.pointerId); } catch (_) { /* ignore */ }
      el.style.cursor = 'grabbing';
      el.style.scrollSnapType = 'none';
    }
    if (ds.moved) {
      scrollRef.current.scrollLeft = ds.scrollStart - dx;
    }
  }, []);

  const handlePointerUp = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.active) return;
    const el = scrollRef.current;
    ds.active = false;
    if (ds.moved) {
      try { el.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      el.style.cursor = '';
      el.style.scrollSnapType = '';
      // Suppress the click that follows a real drag
      const suppress = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', suppress, { capture: true, once: true });
    }
  }, []);

  // Dot count based on total scroll pages
  const dotCount = useMemo(() => {
    if (isDesktop) return 0;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return 0;
    return Math.ceil(el.scrollWidth / el.clientWidth);
  }, [isDesktop, sourcePacks]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDot = dotCount > 0
    ? Math.min(Math.round(scrollProgress * (dotCount - 1)), dotCount - 1)
    : 0;

  const renderPackCard = (pack) => {
    const selected = activePackId === pack.id;
    const photos = getPhotos(pack.id);
    const isHovered = hoveredPackId === pack.id;

    return (
      <button
        key={pack.id}
        data-pack-id={pack.id}
        type="button"
        className={`pack-card ${selected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={() => onSelect(pack.id)}
        onMouseEnter={() => onMouseEnter(pack.id)}
        onMouseLeave={onMouseLeave}
        onFocus={() => onMouseEnter(pack.id)}
        onBlur={onMouseLeave}
        aria-pressed={selected}
        aria-label={pack.titleKey ? t(pack.titleKey) : pack.id}
        role="listitem"
      >
        {/* 2×2 photo grid — fills entire card */}
        {photos && photos.length > 0 ? (
          <div className="pack-card-photos">
            {Array.from({ length: 4 }, (_, i) => {
              const photo = photos[i % photos.length];
              return (
                <div key={i} className="pack-card-photo-cell">
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="pack-card-img"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pack-card-photo-placeholder pack-card-skeleton">
            <PackIcon packId={pack.id} className="pack-card-icon-large" />
          </div>
        )}

        {/* Always visible title strip */}
        <div className="pack-card-info">
          <span className="pack-card-title">{pack.titleKey ? t(pack.titleKey) : pack.id}</span>
        </div>

        {/* Hover-expand description */}
        {isHovered && pack.descriptionKey && (
          <div className="pack-card-desc">
            <p>{t(pack.descriptionKey)}</p>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="home-pack-region">
      <div className="home-region-header">
        <div className="home-region-header-main">
          <p className="home-region-label">{label}</p>
          {!isDesktop && dotCount > 1 && (
            <div className="home-region-dots">
              {Array.from({ length: dotCount }, (_, i) => (
                <span key={i} className={`region-dot ${i === activeDot ? 'active' : ''}`} />
              ))}
            </div>
          )}
        </div>
        {hasDesktopOverflow && (
          <button
            type="button"
            className="home-region-see-more"
            onClick={handleSeeMore}
          >
            {hasDesktopMore
              ? `${t('home.see_more_packs', {}, 'Voir plus')} (${desktopRemainingCount})`
              : t('home.see_less_packs', {}, 'Voir moins')}
          </button>
        )}
      </div>
      {isDesktop ? (
        <div className="home-catalog-grid" role="list">
          {visiblePacks.map(renderPackCard)}
        </div>
      ) : (
        <div className="home-catalog-row-wrapper">
          {canScrollLeft && (
            <div className="catalog-fade catalog-fade-left" />
          )}
          {canScrollLeft && (
            <button type="button" className="catalog-scroll-arrow catalog-scroll-left" onClick={() => scrollBy(-1)} aria-label="Défiler à gauche">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          <div
            className="home-catalog-row"
            ref={scrollRef}
            role="list"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {visiblePacks.map(renderPackCard)}
          </div>
          {canScrollRight && (
            <div className="catalog-fade catalog-fade-right" />
          )}
          {canScrollRight && (
            <button type="button" className="catalog-scroll-arrow catalog-scroll-right" onClick={() => scrollBy(1)} aria-label="Défiler à droite">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default HomePage;
