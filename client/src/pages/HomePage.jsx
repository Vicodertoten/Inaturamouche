import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../context/GameContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { usePacks } from '../context/PacksContext.jsx';
import { useGeoDefaultPack } from '../hooks/useGeoDefaultPack';
import { usePackPreviews } from '../hooks/usePackPreviews';
import { active_session } from '../services/db';
import { getReviewStats } from '../services/CollectionService';
import { notify } from '../services/notifications';
import { trackMetric } from '../services/metrics';
import { debugError, debugLog, debugWarn } from '../utils/logger';
import { getTodayDailySeed, isDailyCompleted, isDailySeedStale } from '../utils/dailyChallenge';
import { buildPackSnapshot, encodePackSnapshot, buildPackShareUrl } from '../utils/packShare';
import { savePack as savePackToStorage, getSavedPacks, deleteSavedPack } from '../utils/savedPacks';
import { copyToClipboard } from '../utils/shareCard';
import { isOnboardingDone } from '../features/onboarding';
import HeroZone from './home/HeroZone';
import PackCatalog from './home/PackCatalog';
import '../features/configurator/Configurator.css';
import './HomePage.css';

const OnboardingLazy = lazy(() =>
  import('../features/onboarding/Onboarding').then((m) => ({ default: m.default }))
);

const DESKTOP_MEDIA_QUERY = '(min-width: 900px)';
const RECENT_PACKS_STORAGE_KEY = 'inaturamouche_recent_packs_v1';
const RECENT_PACKS_MAX_ITEMS = 8;

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
    regionOverride,
    effectiveRegion,
  } = usePacks();
  const geoDefaultPack = useGeoDefaultPack();

  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resumeSessionData, setResumeSessionData] = useState(null);
  const [reviewStats, setReviewStats] = useState(null);
  const [geoApplied, setGeoApplied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone());
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches
      : false
  ));

  const todaySeed = getTodayDailySeed();
  const dailyAlreadyCompleted = isDailyCompleted(todaySeed);
  const hasPlayedGame = (profile?.stats?.gamesPlayed || 0) > 0;
  const recentPackIds = useMemo(() => readRecentPackIds(), []);

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
        debugError('[HomePage] Error checking session:', err);
        setHasActiveSession(false);
        setResumeSessionData(null);
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  /* ── Review stats ── */
  useEffect(() => {
    getReviewStats()
      .then((stats) => setReviewStats(stats))
      .catch((err) => debugError('[HomePage] Error loading review stats:', err));
  }, []);

  /* ── Preload play page ── */
  const preloadPlayPage = useCallback(() => {
    preloadPlayPageModule();
  }, []);

  /* ── Desktop media query ── */
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
      region: effectiveRegion,
      regionOverride,
      recentPackIds,
    });
  }, [effectiveRegion, regionOverride, recentPackIds, refreshHomeCatalog]);

  /* ── Handlers ── */
  const handleStart = useCallback(() => {
    preloadPlayPage();
    setAdvancedOpen(false);
    pushRecentPackId(activePackId);
    void trackMetric('play_click', {
      source: 'home_play_cta',
      pack_id: activePackId || null,
      mode: gameMode || 'easy',
      max_questions: Number.isInteger(maxQuestions) ? maxQuestions : null,
      media_type: mediaType || 'images',
      has_active_session: Boolean(hasActiveSession),
    });
    startGame({ maxQuestions, mediaType });
    navigate('/play');
  }, [activePackId, gameMode, hasActiveSession, maxQuestions, mediaType, navigate, preloadPlayPage, startGame]);

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
    void trackMetric('play_click', {
      source: 'daily_challenge_cta',
      pack_id: null,
      mode: 'easy',
      max_questions: 10,
      media_type: mediaType || 'images',
      is_daily_challenge: true,
    });
    startGame({ seed: todaySeed, seed_session: todaySeed, gameMode: 'easy', maxQuestions: 10 });
    navigate('/play');
  }, [handleResumeGame, hasActiveSession, mediaType, navigate, preloadPlayPage, resumeSessionData, startGame, todaySeed]);

  const handleStartReview = useCallback(async () => {
    preloadPlayPage();
    const started = await startReviewMode(gameMode);
    if (started) {
      void trackMetric('play_click', {
        source: 'review_mode_cta',
        pack_id: activePackId || null,
        mode: gameMode || 'easy',
        media_type: mediaType || 'images',
        review: true,
      });
      navigate('/play');
    }
    return started;
  }, [activePackId, gameMode, mediaType, navigate, preloadPlayPage, startReviewMode]);

  const handlePackSelect = useCallback((packId) => {
    setActivePackId(packId);
    if (packId !== 'custom') {
      setCustomPackLabel(null);
      setSavePackName('');
    }
    /* scroll hero CTA into view after selection */
    requestAnimationFrame(() => {
      const cta = document.querySelector('.hero-cta--play, .hero-cta--resume');
      if (cta) cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [setActivePackId]);

  const preloadCustomFilter = useCallback(() => {
    import('../features/configurator/components/CustomFilter');
  }, []);

  const [customOpen, setCustomOpen] = useState(false);
  const [savePackName, setSavePackName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savedPacksVersion, setSavedPacksVersion] = useState(0);
  const [customPackLabel, setCustomPackLabel] = useState(null);
  const [pendingDeletePack, setPendingDeletePack] = useState(null);

  const handleCustomEntryClick = useCallback(() => {
    const alreadyCustom = activePackId === 'custom';
    setActivePackId('custom');
    setCustomOpen(alreadyCustom ? !customOpen : true);
    if (!alreadyCustom) {
      setCustomPackLabel(null);
      setSavePackName('');
    }
  }, [activePackId, customOpen, setActivePackId]);

  void savedPacksVersion;
  const savedPacks = getSavedPacks();
  const advancedPanelRef = useRef(null);
  const advancedButtonRef = useRef(null);
  const customPanelRef = useRef(null);
  const customButtonRef = useRef(null);

  /* ── Derived ── */
  const activePack = packs.find((p) => p.id === activePackId);
  const activePackLabel = activePackId === 'custom' && customPackLabel
    ? customPackLabel
    : activePack?.titleKey ? t(activePack.titleKey) : activePackId;
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
  const modeName = gameMode === 'hard' ? t('home.hard_mode') : t('home.easy_mode');
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

  /* ── Click-outside: advanced settings ── */
  useEffect(() => {
    if (!advancedOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (advancedPanelRef.current?.contains(target)) return;
      if (advancedButtonRef.current?.contains(target)) return;
      setAdvancedOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setAdvancedOpen(false);
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

  /* ── Click-outside: custom panel ── */
  useEffect(() => {
    if (!customOpen) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (customPanelRef.current?.contains(target)) return;
      if (customButtonRef.current?.contains(target)) return;
      setCustomOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setCustomOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [customOpen]);

  /* ── Save / Share custom pack ── */
  const handleSavePack = useCallback(() => {
    const name = savePackName.trim();
    if (!name) return;
    savePackToStorage(name, customFilters);
    setCustomPackLabel(name);
    notify(t('pack_share.saved', {}, 'Pack sauvegardé !'), { type: 'success' });
    setShowSaveInput(false);
    setSavedPacksVersion((v) => v + 1);
  }, [savePackName, customFilters, t]);

  const handleSharePack = useCallback(async () => {
    const name = savePackName.trim();
    if (!name) {
      setShowSaveInput(true);
      notify(t('pack_share.name_required', {}, 'Donne un nom au pack avant de partager'), { type: 'warning' });
      return;
    }
    const snapshot = buildPackSnapshot(name, customFilters);
    if (!snapshot) return;
    const token = encodePackSnapshot(snapshot);
    if (!token) return;
    const url = buildPackShareUrl(token);
    const ok = await copyToClipboard(url);
    notify(
      ok
        ? t('pack_share.link_copied', {}, 'Lien du pack copié !')
        : t('pack_share.copy_failed', {}, 'Échec de la copie'),
      { type: ok ? 'success' : 'error' }
    );
  }, [customFilters, savePackName, t]);

  const handleSelectSavedPack = useCallback(
    (savedPack) => {
      setActivePackId('custom');
      setCustomOpen(true);
      setCustomPackLabel(savedPack.name);
      setSavePackName(savedPack.name);
      dispatchCustomFilters({ type: 'RESTORE', payload: savedPack.filters });
    },
    [setActivePackId, dispatchCustomFilters]
  );

  const handleDeleteSavedPack = useCallback((e, pack) => {
    e.stopPropagation();
    setPendingDeletePack(pack);
  }, []);

  const confirmDeletePack = useCallback(() => {
    if (!pendingDeletePack) return;
    deleteSavedPack(pendingDeletePack.id);
    setSavedPacksVersion((v) => v + 1);
    setPendingDeletePack(null);
  }, [pendingDeletePack]);

  const cancelDeletePack = useCallback(() => {
    setPendingDeletePack(null);
  }, []);

  const isCatalogLoading = packsLoading || homeLoading;
  const packsById = useMemo(
    () => Object.fromEntries(packs.map((pack) => [pack.id, pack])),
    [packs]
  );
  const visibleHomeSections = useMemo(() => {
    if (!Array.isArray(homeSections)) return [];
    return homeSections
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
  const { getPhotos, loadPreview, preloadPackPreviews, loadSavedPackPreview } = usePackPreviews();
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

  /* ── Load saved pack previews ── */
  useEffect(() => {
    for (const sp of savedPacks) {
      const taxaIds = sp.filters?.includedTaxa?.map((t) => t.id).filter(Boolean);
      if (taxaIds && taxaIds.length > 0) {
        loadSavedPackPreview(sp.id, taxaIds);
      }
    }
  }, [savedPacks, loadSavedPackPreview]);

  /* ── Hover description with delay ── */
  const hoverTimerRef = useRef(null);
  const [hoveredPackId, setHoveredPackId] = useState(null);
  const handlePackMouseEnter = useCallback((packId) => {
    loadPreview(packId);
    hoverTimerRef.current = setTimeout(() => setHoveredPackId(packId), 300);
  }, [loadPreview]);
  const handlePackMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    setHoveredPackId(null);
  }, []);
  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  /* ═══════ RENDER ═══════ */
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
      {/* ═══════ ONBOARDING (first-time users) ═══════ */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingLazy onComplete={() => {
            setShowOnboarding(false);
            handleStart();
          }} />
        </Suspense>
      )}

      <h1 className="sr-only">
        {t('seo.home.h1', {}, 'iNaturaQuizz - Quiz nature interactif')}
      </h1>

      {/* ═══════ HERO ZONE ═══════ */}
      <HeroZone
        isResuming={isResuming}
        resumeSessionData={resumeSessionData}
        handleResumeGame={handleResumeGame}
        handleAbandonSession={handleAbandonSession}
        handleStart={handleStart}
        packsLoading={packsLoading}
        activePackId={activePackId}
        activePackLabel={activePackLabel}
        activePackHeroImage={activePackHeroImage}
        hasPlayedGame={hasPlayedGame}
        modeName={modeName}
        qLabel={qLabel}
        mediaName={mediaName}
        preloadPlayPage={preloadPlayPage}
        advancedOpen={advancedOpen}
        setAdvancedOpen={setAdvancedOpen}
        advancedButtonRef={advancedButtonRef}
        advancedPanelRef={advancedPanelRef}
        settingsLabel={settingsLabel}
        activePack={activePack}
        dailyAlreadyCompleted={dailyAlreadyCompleted}
        handleDailyChallenge={handleDailyChallenge}
        reviewStats={reviewStats}
        handleStartReview={handleStartReview}
        t={t}
      />

      {/* ═══════ PACK CATALOG ═══════ */}
      <PackCatalog
        isCatalogLoading={isCatalogLoading}
        isDesktop={isDesktop}
        customButtonRef={customButtonRef}
        customPanelRef={customPanelRef}
        activePackId={activePackId}
        customOpen={customOpen}
        handleCustomEntryClick={handleCustomEntryClick}
        preloadCustomFilter={preloadCustomFilter}
        customEntryTitle={customEntryTitle}
        customEntryDescription={customEntryDescription}
        customFilters={customFilters}
        dispatchCustomFilters={dispatchCustomFilters}
        showSaveInput={showSaveInput}
        setShowSaveInput={setShowSaveInput}
        savePackName={savePackName}
        setSavePackName={setSavePackName}
        handleSavePack={handleSavePack}
        handleSharePack={handleSharePack}
        savedPacks={savedPacks}
        handleSelectSavedPack={handleSelectSavedPack}
        handleDeleteSavedPack={handleDeleteSavedPack}
        pendingDeletePack={pendingDeletePack}
        confirmDeletePack={confirmDeletePack}
        cancelDeletePack={cancelDeletePack}
        visibleHomeSections={visibleHomeSections}
        hoveredPackId={hoveredPackId}
        handlePackSelect={handlePackSelect}
        handlePackMouseEnter={handlePackMouseEnter}
        handlePackMouseLeave={handlePackMouseLeave}
        getPhotos={getPhotos}
        loadPreview={loadPreview}
        preloadPackPreviews={preloadPackPreviews}
        t={t}
      />
    </div>
  );
};

export default HomePage;
